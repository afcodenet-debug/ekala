// src/sync/sale-sync.service.ts
// Synchronisation professionnelle des ventes (sales) et articles vendus (sale_items)
// Aligné sur le schéma Supabase fourni par l'utilisateur

import type Database from 'better-sqlite3';
import { ProductSyncService } from './product-sync.service';
import { getSupabaseClient } from '../server/database/supabase.client';

export interface SaleRecord {
  id: number;
  invoice_number: string;
  order_id: number | null;
  user_id: number;
  customer_id: number | null;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  payment_method: string;
  version: number;
  created_at: string;
  updated_at: string;
  remote_id?: number;
  tenant_id?: number;
  items?: any[];
}

export class SaleSyncService {
  private coreSync: ProductSyncService;
  private db: Database.Database;
  private supabase = getSupabaseClient();

  constructor(coreSync: ProductSyncService, db: Database.Database) {
    this.coreSync = coreSync;
    this.db = db;
  }

  private getLocalId(table: string, remoteId: any): number | null {
    if (remoteId === null || remoteId === undefined) return null;
    try {
      const row = this.db.prepare(
        `SELECT id FROM ${table} WHERE remote_id = ?`
      ).get(remoteId) as { id: number } | undefined;
      return row ? row.id : null;
    } catch {
      return null;
    }
  }

  /**
   * Pousse les ventes et leurs articles vers Supabase.
   */
  async pushPendingSales(tenantId: string): Promise<number> {
    const saleCount = await this.coreSync.pushPendingByEntity('sale', tenantId);
    const itemCount = await this.coreSync.pushPendingByEntity('sale_item', tenantId);
    return saleCount + itemCount;
  }

  /**
   * Récupère les mises à jour des ventes depuis Supabase.
   */
  async pullSaleUpdates(tenantId: string, since: string): Promise<number> {
    console.log(`[Sync] Pulling sales since ${since}...`);

    const { data, error } = await this.supabase
      .from('sales')
      .select('*, sale_items(*)')
      .or(`updated_at.gt.${since},created_at.gt.${since}`)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.message?.includes('updated_at')) {
         // Fallback legacy
         const { data: d2, error: e2 } = await this.supabase
          .from('sales')
          .select('*, sale_items(*)')
          .gt('created_at', since)
          .order('created_at', { ascending: true });
         if (e2) {
           console.error('[Sync] Failed to pull sales from Supabase:', e2.message);
           return 0;
         }
         return this.processPulledSales(d2 || [], tenantId);
      }
      console.error('[Sync] Failed to pull sales from Supabase:', error.message);
      return 0;
    }

    return this.processPulledSales(data || [], tenantId);
  }

  private processPulledSales(sales: any[], tenantId: string): number {
    let applied = 0;
    const transaction = this.db.transaction((rows: any[]) => {
      for (const remote of rows) {
        try {
          if (remote.tenant_id && String(remote.tenant_id) !== String(tenantId)) continue;

          const local = this.db.prepare(
            'SELECT id, created_at, updated_at FROM sales WHERE remote_id = ?'
          ).get(remote.id) as { id: number; created_at: string, updated_at: string } | undefined;

          const remoteTs = remote.updated_at || remote.created_at;
          const localTs = local?.updated_at || local?.created_at || 0;

          const shouldApply = !local || new Date(remoteTs) > new Date(localTs);

          if (shouldApply) {
            this.applyRemoteSale(remote, local?.id);
            applied++;
          }
        } catch (err) {
          console.error(`[Sync] Error applying remote sale ${remote.id}:`, err);
        }
      }
    });

    transaction(sales);
    return applied;
  }

  private applyRemoteSale(remote: any, existingLocalId?: number) {
    const sanitize = (val: any) => {
      if (val === undefined || val === null) return null;
      if (typeof val === 'boolean') return val ? 1 : 0;
      return val;
    };

    // DYNAMIC SCHEMA FIX: Check columns locally
    const tableInfo = this.db.prepare("PRAGMA table_info(sales)").all() as any[];
    const hasLegacyTotal = tableInfo.some(c => c.name === 'total');
    const hasUpdatedAt = tableInfo.some(c => c.name === 'updated_at');
    const hasTenantId = tableInfo.some(c => c.name === 'tenant_id');

    const fields: Record<string, any> = {
      remote_id: remote.id,
      invoice_number: remote.invoice_number,
      order_id: this.getLocalId('orders', remote.order_id),
      user_id: this.getLocalId('users', remote.user_id) || 1,
      customer_id: this.getLocalId('customers', remote.customer_id),
      subtotal: remote.subtotal,
      discount: remote.discount ?? 0,
      tax: remote.tax ?? 0,
      total_amount: remote.total_amount,
      payment_method: remote.payment_method,
      version: remote.version || 1,
      created_at: remote.created_at,
    };

    if (hasLegacyTotal) fields.total = remote.total_amount;
    if (hasUpdatedAt)   fields.updated_at = remote.updated_at || remote.created_at;
    if (hasTenantId)    fields.tenant_id = remote.tenant_id || 5;

    const cols = Object.keys(fields);
    const setClauses = cols.map(k => `"${k}" = ?`).join(', ');
    const params = cols.map(k => sanitize(fields[k]));

    let localSaleId: number;

    if (existingLocalId) {
      this.db.prepare(`UPDATE sales SET ${setClauses} WHERE id = ?`)
        .run(...params, existingLocalId);
      localSaleId = existingLocalId;
    } else {
      const result = this.db.prepare(`
        INSERT INTO sales (${cols.map(c => `"${c}"`).join(', ')})
        VALUES (${cols.map(() => '?').join(', ')})
      `).run(...params);
      localSaleId = Number(result.lastInsertRowid);
    }

    if (remote.sale_items && Array.isArray(remote.sale_items)) {
      this.applyRemoteSaleItems(remote.sale_items, localSaleId);
    }
  }

  private applyRemoteSaleItems(remoteItems: any[], localSaleId: number) {
    console.log(`[Sync] Applying ${remoteItems.length} items for local sale ${localSaleId}`);
    
    // DYNAMIC SCHEMA FIX: Check columns locally
    const tableInfo = this.db.prepare("PRAGMA table_info(sale_items)").all() as any[];
    const hasTenantId = tableInfo.some(c => c.name === 'tenant_id');

    // Diff intelligent pour sale_items
    const localItems = this.db.prepare(
      'SELECT id, product_id, remote_id FROM sale_items WHERE sale_id = ?'
    ).all(localSaleId) as { id: number; product_id: number; remote_id: number }[];

    const localByRemoteId = new Map(localItems.filter(i => i.remote_id).map(i => [i.remote_id, i]));
    const remoteIds = new Set<number>();

    const insertStmt = this.db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price, remote_id${hasTenantId ? ', tenant_id' : ''})
      VALUES (?, ?, ?, ?, ?, ?${hasTenantId ? ', ?' : ''})
    `);

    const updateStmt = this.db.prepare(`
      UPDATE sale_items SET quantity = ?, unit_price = ?, total_price = ?
      WHERE id = ?
    `);

    for (const item of remoteItems) {
      remoteIds.add(item.id);
      const localProductId = this.getLocalId('products', item.product_id);
      
      if (!localProductId) {
        console.warn(`[Sync] Skipping sale item ${item.id}: Local product for remote_id ${item.product_id} not found`);
        continue;
      }

      const existing = localByRemoteId.get(item.id);

      if (existing) {
        updateStmt.run(item.quantity, item.unit_price, item.total_price, existing.id);
      } else {
        const params = [localSaleId, localProductId, item.quantity, item.unit_price, item.total_price, item.id];
        if (hasTenantId) params.push(item.tenant_id || 5);
        insertStmt.run(...params);
      }
    }

    // Nettoyage des items locaux orphelins (qui ont un remote_id mais ne sont plus dans le remote)
    if (remoteIds.size > 0) {
      const deleted = this.db.prepare(`
        DELETE FROM sale_items 
        WHERE sale_id = ? AND remote_id IS NOT NULL AND remote_id NOT IN (${Array.from(remoteIds).map(() => '?').join(',')})
      `).run(localSaleId, ...Array.from(remoteIds));
      if (deleted.changes > 0) console.log(`[Sync] Cleaned up ${deleted.changes} orphan sale items`);
    } else {
      // If remote has NO items for this sale, clean all local ones for this sale
      const deleted = this.db.prepare(`DELETE FROM sale_items WHERE sale_id = ? AND remote_id IS NOT NULL`).run(localSaleId);
      if (deleted.changes > 0) console.log(`[Sync] Cleaned up all ${deleted.changes} items for sale ${localSaleId} (remote is empty)`);
    }
  }
}
