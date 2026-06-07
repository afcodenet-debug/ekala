import db from '../db/database';
import crypto from 'crypto';
import { getProductSyncService, withOutboxTransaction } from '../../sync';

export type TableStatus = 'available' | 'active' | 'reserved' | 'cleaning' | 'out_of_service';

export interface Table {
  id: number;
  table_number: string;
  capacity: number;
  status: TableStatus;
  assigned_waiter_id: number | null;
  qr_token?: string | null;
  created_at: string;
  updated_at: string;
}

export class TableService {
  static async getAll(params?: { waiter_id?: number; role?: string }): Promise<Table[]> {
    if (!db) {
      console.log('[TableService] SQLite disabled (db is null). Falling back to Supabase for getAll');
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        let query = supabase
          .from('restaurant_tables')
          .select('*, waiter:users(full_name)');

        if (params?.role === 'waiter' && params.waiter_id) {
          query = query.eq('assigned_waiter_id', params.waiter_id);
        }

        const { data, error } = await query.order('table_number', { ascending: true });
        if (error) throw error;

        return (data || []).map((t: any) => ({
          ...t,
          waiter_name: t.waiter?.full_name
        }));
      } catch (err: any) {
        console.error('[TableService] Supabase getAll failed:', err?.message || err);
        throw new Error('Failed to fetch tables via Supabase');
      }
    }

    try {
      let query = `
        SELECT
          t.*,
          u.full_name as waiter_name
        FROM restaurant_tables t
        LEFT JOIN users u ON t.assigned_waiter_id = u.id
      `;

      const conditions: string[] = [];
      const values: any[] = [];

      // Role-based filtering
      if (params?.role === 'waiter' && params.waiter_id) {
        conditions.push('t.assigned_waiter_id = ?');
        values.push(params.waiter_id);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY CAST(t.table_number AS UNSIGNED), t.table_number';

      const tables = db.prepare(query).all(...values) as any[];
      return tables;
    } catch (error) {
      console.error('[TableService] Error fetching tables:', error);
      throw new Error('Failed to fetch tables');
    }
  }

  static async getById(id: number): Promise<Table | null> {
    if (!db) {
      console.log(`[TableService] SQLite disabled (db is null). Falling back to Supabase for getById (id=${id})`);
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('restaurant_tables')
          .select('*, waiter:users(full_name)')
          .eq('id', id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') return null;
          throw error;
        }

        return {
          ...data,
          waiter_name: data.waiter?.full_name
        };
      } catch (err: any) {
        console.error('[TableService] Supabase getById failed:', err?.message || err);
        throw new Error('Failed to fetch table via Supabase');
      }
    }

    try {
      const table = db.prepare(`
        SELECT
          t.*,
          u.full_name as waiter_name
        FROM restaurant_tables t
        LEFT JOIN users u ON t.assigned_waiter_id = u.id
        WHERE t.id = ?
      `).get(id) as Table | undefined;

      return table || null;
    } catch (error) {
      console.error('[TableService] Error fetching table by ID:', error);
      throw new Error('Failed to fetch table');
    }
  }

  static async create(tableData: Omit<Table, 'id' | 'created_at' | 'updated_at'>): Promise<Table> {
    if (!db) {
      console.log('[TableService] SQLite disabled (db is null). Falling back to Supabase for create');
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();
        
        // 1. Check for duplicate table_number in Supabase first
        const { data: existing } = await supabase
          .from('restaurant_tables')
          .select('id')
          .eq('table_number', String(tableData.table_number))
          .maybeSingle();

        if (existing) {
          throw new Error(`Le numéro de table "${tableData.table_number}" existe déjà.`);
        }

        const qrToken = crypto.randomUUID().replace(/-/g, '');

        // 2. Insert without ID (let BigSerial handle it)
        const { data, error } = await supabase
          .from('restaurant_tables')
          .insert([{
            table_number: String(tableData.table_number),
            capacity: tableData.capacity,
            status: tableData.status,
            assigned_waiter_id: tableData.assigned_waiter_id,
            qr_token: qrToken,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) {
          console.error('[TableService] Supabase insert error details:', error);
          if (error.code === '23505') throw new Error(`Le numéro de table "${tableData.table_number}" existe déjà.`);
          throw new Error(`Erreur Supabase: ${error.message} (${error.code})`);
        }
        return data;
      } catch (err: any) {
        console.error('[TableService] Supabase create failed:', err?.message || err);
        throw new Error(err.message || 'Échec de la création de la table sur le Cloud');
      }
    }

    try {
      const businessId = process.env.SYNC_BUSINESS_ID || 'default-business';

      return withOutboxTransaction(db, businessId, () => {
        // Check if table number already exists locally
        const existing = db.prepare('SELECT id FROM restaurant_tables WHERE table_number = ?').get(tableData.table_number);
        if (existing) {
          throw new Error(`Le numéro de table "${tableData.table_number}" existe déjà.`);
        }

        const now = new Date().toISOString();
        const qrToken = crypto.randomUUID().replace(/-/g, '');
        const result = db.prepare(`
          INSERT INTO restaurant_tables (table_number, capacity, status, assigned_waiter_id, qr_token, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(tableData.table_number),
          tableData.capacity,
          tableData.status,
          tableData.assigned_waiter_id,
          qrToken,
          now,
          now
        );

        if (!result.lastInsertRowid) {
          throw new Error('Échec de la création de la table en local');
        }

        // We can't use await inside db.transaction directly in better-sqlite3 for fetching
        // but since it's a synchronous read, we can just call a non-async version or use db directly
        const newTable = db.prepare(`
          SELECT t.*, u.full_name as waiter_name
          FROM restaurant_tables t
          LEFT JOIN users u ON t.assigned_waiter_id = u.id
          WHERE t.id = ?
        `).get(Number(result.lastInsertRowid)) as Table;

        if (!newTable) {
          throw new Error('Échec de récupération de la table créée');
        }

        // Queue for sync
        getProductSyncService().queueChangeInsideTransaction('restaurant_table', 'insert', {
          ...newTable,
          business_id: businessId
        });

        return newTable;
      });
    } catch (error: any) {
      console.error('[TableService] Error creating table:', error);
      throw error;
    }
  }

  static async update(id: number, updates: Partial<Omit<Table, 'id' | 'created_at' | 'updated_at'>>): Promise<Table> {
    if (!db) {
      console.log(`[TableService] SQLite disabled (db is null). Falling back to Supabase for update (id=${id})`);
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('restaurant_tables')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        if (!data) throw new Error('Table not found');

        return data;
      } catch (err: any) {
        console.error('[TableService] Supabase update failed:', err?.message || err);
        throw new Error('Failed to update table via Supabase');
      }
    }

    try {
      const businessId = process.env.SYNC_BUSINESS_ID || 'default-business';

      return withOutboxTransaction(db, businessId, () => {
        const table = db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(id) as Table | undefined;
        if (!table) {
          throw new Error('Table not found');
        }

        // Check if table number conflict
        if (updates.table_number && updates.table_number !== table.table_number) {
          const existing = db.prepare('SELECT id FROM restaurant_tables WHERE table_number = ? AND id != ?')
            .get(updates.table_number, id);
          if (existing) {
            throw new Error(`Table number ${updates.table_number} already exists`);
          }
        }

        const updateFields: string[] = [];
        const values: any[] = [];

        Object.entries(updates).forEach(([key, value]) => {
          if (value !== undefined) {
            updateFields.push(`${key} = ?`);
            values.push(value);
          }
        });

        if (updateFields.length === 0) {
          return table; // No changes
        }

        updateFields.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);

        db.prepare(`
          UPDATE restaurant_tables
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `).run(...values);

        const updatedTable = db.prepare(`
          SELECT t.*, u.full_name as waiter_name
          FROM restaurant_tables t
          LEFT JOIN users u ON t.assigned_waiter_id = u.id
          WHERE t.id = ?
        `).get(id) as Table;

        if (!updatedTable) {
          throw new Error('Failed to retrieve updated table');
        }

        // Queue for sync
        getProductSyncService().queueChangeInsideTransaction('restaurant_table', 'update', {
          ...updatedTable,
          business_id: businessId
        });

        return updatedTable;
      });
    } catch (error: any) {
      console.error('[TableService] Error updating table:', error);
      throw error;
    }
  }

  static async updateStatus(id: number, status: TableStatus): Promise<Table> {
    return this.update(id, { status });
  }

  static async openTable(tableId: number, waiterId: number): Promise<Table> {
    try {
      const table = await this.getById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      if (table.status !== 'available' && table.status !== 'reserved') {
        throw new Error('Table is not available for opening');
      }

      return this.update(tableId, {
        status: 'active',
        assigned_waiter_id: waiterId
      });
    } catch (error: any) {
      console.error('[TableService] Error opening table:', error);
      throw error;
    }
  }

  static async reserveTable(tableId: number): Promise<Table> {
    try {
      const table = await this.getById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      if (table.status !== 'available') {
        throw new Error('Table is not available for reservation');
      }

      return this.update(tableId, { status: 'reserved' });
    } catch (error: any) {
      console.error('[TableService] Error reserving table:', error);
      throw error;
    }
  }

  static async markCleaning(tableId: number): Promise<Table> {
    return this.update(tableId, { status: 'cleaning' });
  }

  static async setAvailable(tableId: number): Promise<Table> {
    return this.update(tableId, {
      status: 'available',
      assigned_waiter_id: null
    });
  }

  static async assignWaiter(tableId: number, waiterId: number | null): Promise<Table> {
    return this.update(tableId, { assigned_waiter_id: waiterId });
  }

  static async delete(id: number): Promise<boolean> {
    if (!db) {
      console.log(`[TableService] SQLite disabled (db is null). Falling back to Supabase for delete (id=${id})`);
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        // Check if table has active orders
        const { count, error: countErr } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('table_id', id)
          .in('status', ['pending', 'confirmed', 'preparing', 'ready']);

        if (countErr) throw countErr;
        if (count && count > 0) {
          throw new Error('Cannot delete table with active orders');
        }

        const { error } = await supabase
          .from('restaurant_tables')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return true;
      } catch (err: any) {
        console.error('[TableService] Supabase delete failed:', err?.message || err);
        throw new Error(err?.message || 'Failed to delete table via Supabase');
      }
    }

    try {
      const businessId = process.env.SYNC_BUSINESS_ID || 'default-business';

      return withOutboxTransaction(db, businessId, () => {
        const table = db.prepare('SELECT id FROM restaurant_tables WHERE id = ?').get(id) as { id: number } | undefined;
        if (!table) {
          return false;
        }

        // Check if table has active orders
        const activeOrders = db.prepare(`
          SELECT COUNT(*) as count
          FROM orders
          WHERE table_id = ? AND status IN ('pending', 'confirmed', 'preparing', 'ready')
        `).get(id) as { count: number };

        if (activeOrders.count > 0) {
          throw new Error('Cannot delete table with active orders');
        }

        const result = db.prepare('DELETE FROM restaurant_tables WHERE id = ?').run(id);
        
        if (result.changes > 0) {
          // Queue for sync
          getProductSyncService().queueChangeInsideTransaction('restaurant_table', 'delete', { 
            id,
            business_id: businessId 
          });
        }

        return result.changes > 0;
      });
    } catch (error: any) {
      console.error('[TableService] Error deleting table:', error);
      throw error;
    }
  }

  static async regenerateQrToken(id: number): Promise<Table> {
    const businessId = process.env.SYNC_BUSINESS_ID || 'default-business';

    return withOutboxTransaction(db, businessId, () => {
      const table = db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(id) as Table | undefined;
      if (!table) {
        throw new Error('Table not found');
      }

      const newToken = crypto.randomUUID().replace(/-/g, '');
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE restaurant_tables
        SET qr_token = ?, updated_at = ?
        WHERE id = ?
      `).run(newToken, now, id);

      const updated = db.prepare(`
        SELECT t.*, u.full_name as waiter_name
        FROM restaurant_tables t
        LEFT JOIN users u ON t.assigned_waiter_id = u.id
        WHERE t.id = ?
      `).get(id) as Table;

      if (!updated) {
        throw new Error('Failed to retrieve updated table after regenerating QR token');
      }

      // Queue for sync
      getProductSyncService().queueChangeInsideTransaction('restaurant_table', 'update', {
        ...updated,
        business_id: businessId
      });

      return updated;
    });
  }
}