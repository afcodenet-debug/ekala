import db from '../db/database';
import crypto from 'crypto';
import { getProductSyncService, withOutboxTransaction } from '../../sync';
import { env } from '../config/env';
import { getCurrentTenantId } from '../db/tenant-context';
import { dataSource } from '../infrastructure/data-source-manager';

export type TableStatus = 'available' | 'active' | 'reserved' | 'cleaning' | 'out_of_service';

export interface Table {
  id: number;
  remote_id?: number | null;
  table_number: string;
  capacity: number;
  status: TableStatus;
  assigned_waiter_id: number | null;
  qr_token?: string | null;
  created_at: string;
  updated_at: string;
  tenant_id: number;
}

/**
 * Status mapping between local SQLite and Supabase (CHECK constraint).
 */
function localToRemoteStatus(status: string): string {
  if (status === 'active') return 'occupied';
  if (status === 'out_of_service') return 'available';
  return status;
}

function remoteToLocalStatus(status: string): string {
  if (status === 'occupied') return 'active';
  return status;
}

/**
 * Helper to get tenantId - explicit parameter takes priority over context
 */
function resolveTenantId(explicitTenantId?: number): number {
  if (explicitTenantId !== undefined && explicitTenantId !== null) {
    return explicitTenantId;
  }
  const ctxTenantId = getCurrentTenantId();
  if (ctxTenantId !== undefined && ctxTenantId !== null) {
    return ctxTenantId;
  }
  throw new Error('TENANT_ID_REQUIRED: tenant_id est requis. \nConnectez-vous ou utilisez un token JWT valide.');
}

export class TableService {
  /**
   * Get all tables for a tenant.
   * @param params - optional filter params (waiter_id, role)
   * @param tenantId - explicit tenant ID (required for proper isolation)
   */
  static async getAll(params?: { waiter_id?: number; role?: string }, tenantId?: number): Promise<Table[]> {
    const resolvedTenantId = resolveTenantId(tenantId);

    // ===== Mode Cloud (Supabase) =====
    if (dataSource.isCloudMode()) {
      try {
        const { supabaseQuery } = require('../infrastructure/supabase-query');
        let query = supabaseQuery('restaurant_tables')
          .select('*')
          .eq('tenant_id', resolvedTenantId)
          .order('table_number', { ascending: true });

        if (params?.role === 'waiter' && params.waiter_id) {
          query = query.eq('assigned_waiter_id', params.waiter_id);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return (data || []).map((t: any) => ({
          ...t,
          status: remoteToLocalStatus(t.status),
        })) as Table[];
      } catch (err: any) {
        console.error('[TableService] Supabase getAll failed:', err?.message || err);
        throw err;
      }
    }

    // ===== Mode Local (SQLite) =====
    try {
      let query = `
        WITH ActiveOrders AS (
          SELECT 
            o.table_id,
            o.waiter_id,
            o.total,
            o.created_at,
            o.status as order_status
          FROM orders o
          WHERE o.tenant_id = ? 
            AND o.status NOT IN ('paid', 'cancelled', 'rejected')
          GROUP BY o.table_id
          HAVING o.created_at = MAX(o.created_at)
        )
        SELECT
          t.*,
          COALESCE(uo.full_name, uo.username, ut.full_name, ut.username) as waiter_name,
          ao.total as active_order_total,
          ao.created_at as active_order_created_at
        FROM restaurant_tables t
        LEFT JOIN users ut ON (t.assigned_waiter_id = ut.id OR t.assigned_waiter_id = ut.remote_id)
        LEFT JOIN ActiveOrders ao ON t.id = ao.table_id
        LEFT JOIN users uo ON (ao.waiter_id = uo.id OR ao.waiter_id = uo.remote_id)
        WHERE t.tenant_id = ?
      `;

      const values: any[] = [resolvedTenantId, resolvedTenantId];

      if (params?.role === 'waiter' && params.waiter_id) {
        query += ' AND (t.assigned_waiter_id = ? OR t.assigned_waiter_id = (SELECT remote_id FROM users WHERE id = ?) OR ao.waiter_id = ? OR ao.waiter_id = (SELECT remote_id FROM users WHERE id = ?))';
        values.push(params.waiter_id, params.waiter_id, params.waiter_id, params.waiter_id);
      }

      query += ' ORDER BY CAST(t.table_number AS UNSIGNED), t.table_number';

      const tables = db.prepare(query).all(...values) as any[];
      return tables;
    } catch (error) {
      console.error('[TableService] Error fetching tables:', error);
      throw new Error('Failed to fetch tables');
    }
  }

  /**
   * Get a single table by ID.
   */
  static async getById(id: number, tenantId?: number): Promise<Table | null> {
    const resolvedTenantId = resolveTenantId(tenantId);

    // ===== Mode Cloud (Supabase) =====
    if (dataSource.isCloudMode()) {
      try {
        const { supabaseQuery } = require('../infrastructure/supabase-query');
        const { data, error } = await supabaseQuery('restaurant_tables')
          .select('*')
          .eq('id', id)
          .eq('tenant_id', resolvedTenantId)
          .single();

        if (error) throw new Error(error.message);
        if (!data) return null;

        return {
          ...data,
          status: remoteToLocalStatus(data.status),
        } as Table;
      } catch (err: any) {
        console.error('[TableService] Supabase getById failed:', err?.message || err);
        throw err;
      }
    }

    // ===== Mode Local (SQLite) =====
    try {
      const table = db.prepare(`
        SELECT
          t.*,
          COALESCE(u.full_name, u.username) as waiter_name
        FROM restaurant_tables t
        LEFT JOIN users u ON t.assigned_waiter_id = u.id
        WHERE t.id = ? AND t.tenant_id = ?
      `).get(id, resolvedTenantId) as Table | undefined;

      return table || null;
    } catch (error) {
      console.error('[TableService] Error fetching table by ID:', error);
      throw new Error('Failed to fetch table');
    }
  }

  /**
   * Create a new table.
   */
  static async create(tableData: Omit<Table, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>, tenantId: number): Promise<Table> {
    const resolvedTenantId = resolveTenantId(tenantId);

    // ===== Mode Local (SQLite) =====
    if (!dataSource.isCloudMode() && db) {
      try {
        const qrToken = crypto.randomUUID().replace(/-/g, '');
        const now = new Date().toISOString();

        const existing = db.prepare('SELECT id FROM restaurant_tables WHERE table_number = ? AND tenant_id = ?').get(String(tableData.table_number), resolvedTenantId) as { id: number } | undefined;
        if (existing) {
          throw new Error(`Le numéro de table "${tableData.table_number}" existe déjà pour ce locataire.`);
        }

        const result = db.prepare(`
          INSERT INTO restaurant_tables (
            table_number, capacity, status, assigned_waiter_id, qr_token,
            tenant_id, remote_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(tableData.table_number),
          tableData.capacity,
          tableData.status,
          tableData.assigned_waiter_id,
          qrToken,
          resolvedTenantId,
          null, // remote_id sera rempli après sync avec Supabase
          now,
          now
        );

        const inserted = db.prepare(`
          SELECT t.*, COALESCE(u.full_name, u.username) as waiter_name
          FROM restaurant_tables t
          LEFT JOIN users u ON t.assigned_waiter_id = u.id
          WHERE t.id = ?
        `).get(result.lastInsertRowid) as Table;

        if (!inserted) {
          throw new Error('Failed to retrieve newly created table');
        }

        try {
          getProductSyncService().queueChangeInsideTransaction('restaurant_table', 'insert', {
            ...inserted,
            tenant_id: resolvedTenantId
          });
        } catch (syncErr) {
          console.warn('[TableService] Failed to queue table creation for sync:', syncErr);
        }

        return inserted;
      } catch (error: any) {
        console.error('[TableService] Error creating table in SQLite:', error);
        throw error;
      }
    }

    // ===== Mode Cloud (Supabase) =====
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase not configured');
    }
    try {
      const { getSupabaseClient } = require('../database/supabase.client');
      const supabase = getSupabaseClient();

      const { data: existing, error: checkErr } = await supabase
        .from('restaurant_tables')
        .select('id')
        .eq('table_number', String(tableData.table_number))
        .eq('tenant_id', resolvedTenantId)
        .maybeSingle();
      if (checkErr) console.error('[TableService] Supabase check error:', checkErr);
      if (existing) {
        throw new Error(`Le numéro de table "${tableData.table_number}" existe déjà.`);
      }

      const qrToken = crypto.randomUUID().replace(/-/g, '');
      const supabaseStatus = localToRemoteStatus(tableData.status);

      const { data, error } = await supabase
        .from('restaurant_tables')
        .insert([{
          table_number: String(tableData.table_number),
          capacity: tableData.capacity,
          status: supabaseStatus,
          assigned_waiter_id: tableData.assigned_waiter_id,
          qr_token: qrToken,
          tenant_id: resolvedTenantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(`Le numéro de table "${tableData.table_number}" existe déjà.`);
        }
        throw new Error(`Erreur Supabase: ${error.message}`);
      }

      return {
        ...data,
        status: remoteToLocalStatus(data.status) as any
      } as Table;
    } catch (err: any) {
      console.error('[TableService] Supabase create failed:', err?.message || err);
      throw err;
    }
  }

  /**
   * Update a table.
   */
  static async update(id: number, updates: Partial<Table>, tenantId: number): Promise<Table> {
    const resolvedTenantId = resolveTenantId(tenantId);

    // ===== Mode Local (SQLite) =====
    if (!dataSource.isCloudMode() && db) {
      try {
        return withOutboxTransaction(db, String(resolvedTenantId), () => {
          const existing = db.prepare('SELECT * FROM restaurant_tables WHERE id = ? AND tenant_id = ?').get(id, resolvedTenantId) as Table | undefined;
          if (!existing) {
            throw new Error('Table not found');
          }

          const fields: string[] = [];
          const values: any[] = [];

          if (updates.table_number !== undefined) {
            fields.push('table_number = ?');
            values.push(String(updates.table_number));
          }
          if (updates.capacity !== undefined) {
            fields.push('capacity = ?');
            values.push(updates.capacity);
          }
          if (updates.status !== undefined) {
            fields.push('status = ?');
            values.push(updates.status);
          }
          if (updates.assigned_waiter_id !== undefined) {
            fields.push('assigned_waiter_id = ?');
            values.push(updates.assigned_waiter_id);
          }
          if (updates.remote_id !== undefined) {
            fields.push('remote_id = ?');
            values.push(updates.remote_id);
          }

          fields.push('updated_at = ?');
          values.push(new Date().toISOString());

          values.push(id, resolvedTenantId);

          db.prepare(`
            UPDATE restaurant_tables
            SET ${fields.join(', ')}
            WHERE id = ? AND tenant_id = ?
          `).run(...values);

          const updated = db.prepare(`
            SELECT t.*, COALESCE(u.full_name, u.username) as waiter_name
            FROM restaurant_tables t
            LEFT JOIN users u ON t.assigned_waiter_id = u.id
            WHERE t.id = ? AND t.tenant_id = ?
          `).get(id, resolvedTenantId) as Table;

          if (!updated) {
            throw new Error('Failed to retrieve updated table');
          }

          try {
            getProductSyncService().queueChangeInsideTransaction('restaurant_table', 'update', {
              ...updated,
              tenant_id: resolvedTenantId
            });
          } catch (syncErr) {
            console.warn('[TableService] Failed to queue table update for sync:', syncErr);
          }

          return updated;
        });
      } catch (error: any) {
        console.error('[TableService] Error updating table in SQLite:', error);
        throw error;
      }
    }

    // ===== Mode Cloud (Supabase) =====
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase not configured');
    }
    try {
      const { getSupabaseClient } = require('../database/supabase.client');
      const supabase = getSupabaseClient();

      const supabaseUpdates: any = { ...updates };
      if (supabaseUpdates.status) {
        supabaseUpdates.status = localToRemoteStatus(supabaseUpdates.status);
      }
      supabaseUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('restaurant_tables')
        .update(supabaseUpdates)
        .eq('id', id)
        .eq('tenant_id', resolvedTenantId)
        .select()
        .single();

      if (error) throw new Error(`Erreur Supabase: ${error.message}`);
      if (!data) throw new Error('Table non trouvée');

      return {
        ...data,
        remote_id: data.id,
        status: remoteToLocalStatus(data.status) as any,
        waiter_name: undefined
      } as Table;
    } catch (err: any) {
      console.error('[TableService] Supabase update failed:', err?.message || err);
      throw err;
    }
  }

  /**
   * Open table (assign waiter and set active).
   */
  static async openTable(id: number, waiterId: number, tenantId: number): Promise<Table> {
    const existing = await this.getById(id, tenantId);
    return this.update(id, {
      assigned_waiter_id: existing?.assigned_waiter_id ?? waiterId,
      status: 'active',
    } as any, tenantId);
  }

  /**
   * Reserve table.
   */
  static async reserveTable(id: number, tenantId: number): Promise<Table> {
    return this.update(id, { status: 'reserved' } as any, tenantId);
  }

  /**
   * Mark table for cleaning.
   */
  static async markCleaning(id: number, tenantId: number): Promise<Table> {
    return this.update(id, { status: 'cleaning' } as any, tenantId);
  }

  /**
   * Set table available.
   */
  static async setAvailable(id: number, tenantId: number): Promise<Table> {
    return this.update(id, { status: 'available', assigned_waiter_id: null } as any, tenantId);
  }

  /**
   * Update table status.
   */
  static async updateStatus(id: number, status: TableStatus, tenantId: number): Promise<Table> {
    return this.update(id, { status } as any, tenantId);
  }

  /**
   * Delete a table.
   */
  static async delete(id: number, tenantId: number): Promise<boolean> {
    const resolvedTenantId = resolveTenantId(tenantId);
    let deletedFromSqlite = false;
    let deletedFromSupabase = false;

    // 1. Mode Local (SQLite)
    if (!dataSource.isCloudMode() && db) {
      try {
        const result = db.prepare('DELETE FROM restaurant_tables WHERE id = ? AND tenant_id = ?').run(id, resolvedTenantId);
        deletedFromSqlite = result.changes > 0;
        if (deletedFromSqlite) {
          console.log(`[TableService] Deleted table ${id} from SQLite (tenant ${resolvedTenantId})`);
          try {
            getProductSyncService().queueChangeInsideTransaction('restaurant_table', 'delete', {
              id,
              tenant_id: resolvedTenantId
            });
          } catch (syncErr) {
            console.warn('[TableService] Failed to queue table deletion for sync:', syncErr);
          }
        }
      } catch (sqliteErr: any) {
        console.warn('[TableService] SQLite delete warning:', sqliteErr.message);
      }
    }

    // 2. Mode Cloud (Supabase)
    if (dataSource.isCloudMode()) {
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        const { error } = await supabase
          .from('restaurant_tables')
          .delete()
          .eq('id', id)
          .eq('tenant_id', resolvedTenantId);
        if (error) {
          console.warn('[TableService] Supabase delete warning:', error.message);
        } else {
          deletedFromSupabase = true;
          console.log(`[TableService] Deleted table ${id} from Supabase (tenant ${resolvedTenantId})`);
        }
      } catch (supabaseErr: any) {
        console.warn('[TableService] Supabase delete error:', supabaseErr.message);
      }
    }

    // Retourner true si au moins une suppression a réussi
    return deletedFromSqlite || deletedFromSupabase;
  }

  /**
   * Regenerate QR token.
   */
  static async regenerateQrToken(id: number, tenantId: number): Promise<Table> {
    const resolvedTenantId = resolveTenantId(tenantId);

    // ===== Mode Local (SQLite) =====
    if (!dataSource.isCloudMode() && db) {
      try {
        return withOutboxTransaction(db, String(resolvedTenantId), () => {
          const table = db.prepare('SELECT * FROM restaurant_tables WHERE id = ? AND tenant_id = ?').get(id, resolvedTenantId) as Table | undefined;
          if (!table) {
            throw new Error('Table not found');
          }

          const newToken = crypto.randomUUID().replace(/-/g, '');
          const now = new Date().toISOString();

          db.prepare(`
            UPDATE restaurant_tables
            SET qr_token = ?, updated_at = ?
            WHERE id = ? AND tenant_id = ?
          `).run(newToken, now, id, resolvedTenantId);

          const updated = db.prepare(`
            SELECT t.*, COALESCE(u.full_name, u.username) as waiter_name
            FROM restaurant_tables t
            LEFT JOIN users u ON t.assigned_waiter_id = u.id
            WHERE t.id = ? AND t.tenant_id = ?
          `).get(id, resolvedTenantId) as Table;

          if (!updated) {
            throw new Error('Failed to retrieve updated table after regenerating QR token');
          }

          try {
            getProductSyncService().queueChangeInsideTransaction('restaurant_table', 'update', {
              ...updated,
              tenant_id: resolvedTenantId
            });
          } catch (syncErr) {
            console.warn('[TableService] Failed to queue QR regeneration for sync:', syncErr);
          }

          return updated;
        });
      } catch (error: any) {
        console.error('[TableService] Error regenerating QR token in SQLite:', error);
        throw error;
      }
    }

    // ===== Mode Cloud (Supabase) =====
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase not configured');
    }
    try {
      const { getSupabaseClient } = require('../database/supabase.client');
      const supabase = getSupabaseClient();

      const newToken = crypto.randomUUID().replace(/-/g, '');
      const { data, error } = await supabase
        .from('restaurant_tables')
        .update({ qr_token: newToken, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', resolvedTenantId)
        .select()
        .single();

      if (error) throw new Error(`Erreur Supabase: ${error.message}`);
      if (!data) throw new Error('Table non trouvée');

      return {
        ...data,
        remote_id: data.id,
        status: remoteToLocalStatus(data.status) as any,
        waiter_name: undefined,
      } as Table;
    } catch (err: any) {
      console.error('[TableService] Supabase regenerate QR failed:', err?.message || err);
      throw err;
    }
  }
}
