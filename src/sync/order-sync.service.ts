// src/sync/order-sync.service.ts
// Production-grade sync service for Orders
// Handles: create, update (status, items, payment), delete
// Uses the same Outbox + Orchestrator infrastructure as Products

import { ProductSyncService } from './product-sync.service';
import { getSupabaseClient } from '../server/database/supabase.client';

interface OrderRecord {
  id: string | number;
  table_id?: number | string;
  waiter_id?: number | string;
  status: string;
  total?: number;
  items?: any[];
  customer_phone?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  version?: number;
  [key: string]: any;
}

export class OrderSyncService {
  private coreSync: ProductSyncService;
  private supabase = getSupabaseClient();

  constructor(coreSync: ProductSyncService) {
    this.coreSync = coreSync;
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
    // Queue order header (version bumped on caller side if needed)
    this.coreSync.queueChangeInsideTransaction('order', operation, {
      ...order,
      business_id: businessId,
    });

    // Queue order items for granular sync (only on insert/update)
    if (order.items && operation !== 'delete') {
      for (const item of order.items) {
        this.coreSync.queueChangeInsideTransaction('order_item', 'insert', {
          ...item,
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
    // Push order headers first, then items (simple ordering)
    const orderCount = await this.coreSync.pushPendingByEntity('order', businessId);
    const itemCount = await this.coreSync.pushPendingByEntity('order_item', businessId);
    return orderCount + itemCount;
  }

  /**
   * Pull recent order changes from Supabase (supports multi-device / QR updates)
   * For now returns count; full local apply + conflict resolution can be added
   * when we have local order repository.
   */
  async pullOrderUpdates(businessId: string, since: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('business_id', businessId)
      .gt('updated_at', since)
      .order('updated_at', { ascending: true });

    if (error) throw error;

    // TODO: apply to local SQLite using version-based merge (same pattern as products)
    // For MVP we just return how many were available
    return data?.length || 0;
  }
}
