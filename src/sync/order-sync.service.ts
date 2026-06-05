import type Database from 'better-sqlite3';
import { ProductSyncService } from './product-sync.service';
import { getSupabaseClient } from '../server/database/supabase.client';

interface OrderRecord {
  id: string | number;
  table_id?: number | string;
  waiter_id?: number | string;
  status: string;
  total?: number;
  items?: any; // JSON or array
  customer_phone?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  version?: number;
  remote_id?: string | number;
  [key: string]: any;
}

export class OrderSyncService {
  private coreSync: ProductSyncService;
  private db: Database.Database;
  private supabase = getSupabaseClient();

  constructor(coreSync: ProductSyncService, db: Database.Database) {
    this.coreSync = coreSync;
    this.db = db;
  }

  /**
   * Queue an order + its items for sync.
   * MUST be called from inside a withOutboxTransaction callback so that
   * the local order write + outbox insert are atomic.
   */
  queueOrderChange(
    operation: 'insert' | 'update' | 'delete',
    order: OrderRecord,
    businessId: string = 'default-business'
  ) {
    // Queue order header
    this.coreSync.queueChangeInsideTransaction('order', operation, {
      ...order,
      business_id: businessId,
    });

    // Queue order items for granular sync (only on insert/update)
    if (order.items && operation !== 'delete') {
      const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
      for (const item of items) {
        this.coreSync.queueChangeInsideTransaction('order_item', 'insert', {
          ...item,
          id: item.id || item.productId, // Fallback to productId if id is missing, but should be there now
          order_id: order.id,
          business_id: businessId,
          version: item.version || order.version || 1,
        });
      }
    }
  }

  /**
   * Push pending orders (and items) to Supabase — production safe
   */
  async pushPendingOrders(businessId: string): Promise<number> {
    const orderCount = await this.coreSync.pushPendingByEntity('order', businessId);
    const itemCount = await this.coreSync.pushPendingByEntity('order_item', businessId);
    return orderCount + itemCount;
  }

  /**
   * Pull recent order changes from Supabase (supports multi-device / QR updates)
   */
  async pullOrderUpdates(businessId: string, since: string): Promise<number> {
    console.log(`[Sync] Pulling orders since ${since}...`);
    
    const { data, error } = await this.supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('business_id', businessId)
      .gt('updated_at', since)
      .order('updated_at', { ascending: true });

    if (error) {
      console.error('[Sync] Failed to pull orders from Supabase:', error.message);
      throw error;
    }

    if (!data || data.length === 0) return 0;

    let applied = 0;
    const transaction = this.db.transaction((orders: any[]) => {
      for (const remote of orders) {
        try {
          const local = this.db.prepare('SELECT id, updated_at FROM orders WHERE id = ? OR remote_id = ?')
            .get(remote.id, remote.id) as { id: number, updated_at: string } | undefined;

          const shouldApply = !local || new Date(remote.updated_at) > new Date(local.updated_at);

          if (shouldApply) {
            this.applyRemoteOrder(remote);
            applied++;
          }
        } catch (err) {
          console.error(`[Sync] Error applying remote order ${remote.id}:`, err);
        }
      }
    });

    transaction(data);
    return applied;
  }

  private applyRemoteOrder(remote: any) {
    const sanitize = (val: any) => {
      if (val === undefined || val === null) return null;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'boolean') return val ? 1 : 0;
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    };

    // Columns that exist in local SQLite 'orders' table
    const allowedColumns = [
      'table_id', 'waiter_id', 'status', 'total', 'items', 
      'customer_phone', 'notes', 'created_at', 'updated_at', 'remote_id'
    ];

    const fields: Record<string, any> = {
      remote_id: remote.id,
      updated_at: remote.updated_at,
      created_at: remote.created_at,
      status: remote.status,
      total: remote.total,
      table_id: remote.table_id,
      waiter_id: remote.waiter_id,
      notes: remote.notes,
      items: typeof remote.items === 'string' ? remote.items : JSON.stringify(remote.items || []),
    };

    const updateFields = Object.keys(fields).filter(k => allowedColumns.includes(k));
    const setClauses = updateFields.map(k => `"${k}" = ?`).join(', ');
    const params = updateFields.map(k => sanitize(fields[k]));

    // Use remote_id to find local row
    const existing = this.db.prepare('SELECT id FROM orders WHERE id = ? OR remote_id = ?').get(remote.id, remote.id) as { id: number } | undefined;

    let localOrderId: number;

    if (existing) {
      this.db.prepare(`UPDATE orders SET ${setClauses} WHERE id = ?`).run(...params, existing.id);
      localOrderId = existing.id;
    } else {
      // For NEW orders from remote (e.g. QR), we might want to preserve the remote ID as the local ID if it's numeric
      // or just let SQLite generate one and link via remote_id.
      // Since Supabase uses BigInt/UUID and SQLite uses INTEGER, we link via remote_id.
      const insertKeys = updateFields;
      const insertParams = params;
      const result = this.db.prepare(`
        INSERT INTO orders (${insertKeys.map(k => `"${k}"`).join(', ')})
        VALUES (${insertParams.map(() => '?').join(', ')})
      `).run(...insertParams);
      localOrderId = Number(result.lastInsertRowid);
    }

    // Apply order items if present
    if (remote.order_items && Array.isArray(remote.order_items)) {
      this.db.prepare('DELETE FROM order_items WHERE order_id = ?').run(localOrderId);
      
      const itemStmt = this.db.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of remote.order_items) {
        itemStmt.run(
          localOrderId,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.total_price,
          item.notes || null,
          item.created_at || remote.created_at
        );
      }
    }
  }
}
