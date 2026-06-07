import db from '../db/database';
import { notifyOrderCheckout, loadRawSettings } from '../services/notification.service';
import { getOrderSyncService, getProductSyncService, withOutboxTransaction } from '../../sync';

export interface OrderItem {
  id?: number;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string | null;
}

export interface OrderData {
  id?: number;
  table_id: number | null;
  waiter_id: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled' | 'rejected';
  items: OrderItem[];
  total: number;
  discount?: number;
  tax?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_id?: number | null;
  remote_id?: number;
  created_at?: string;
  updated_at?: string;
}

export class OrderService {
  private static getItemsForOrder(orderId: number, fallbackJson?: string, isRemote: boolean = false): OrderItem[] {
    try {
      // Cloud mode guard: if db is null, we can only rely on fallbackJson (JSON snapshot in orders.items)
      if (!db) {
        if (fallbackJson) {
          try {
            return JSON.parse(fallbackJson || '[]') as OrderItem[];
          } catch {
            return [];
          }
        }
        return [];
      }

      // For remote QR orders (pulled from Supabase), the pulled JSON snapshot is the source of truth.
      // The public menu only sends {product_id, quantity, name} — we enrich with current local price.
      if (isRemote && fallbackJson) {
        let data: any = fallbackJson;
        
        // robust multi-pass parsing
        try {
          if (typeof data === 'string') data = JSON.parse(data);
          if (typeof data === 'string') data = JSON.parse(data);
        } catch (e: any) {
          console.warn('[OrderService] fallbackJson parse error:', e.message);
        }

        // Handle both direct array and wrapped object { items: [], notes: ... }
        let itemsArray: any[] = [];
        if (Array.isArray(data)) {
          itemsArray = data;
        } else if (data && typeof data === 'object' && Array.isArray(data.items)) {
          itemsArray = data.items;
        } else if (data && typeof data === 'object') {
          // If it's an object but not a standard wrapper, maybe it's just one item or malformed
          console.warn('[OrderService] fallbackJson is an object but no items array found:', data);
          // try to recover if it looks like a single item
          if (data.product_id || data.productId) itemsArray = [data];
        }

        return itemsArray.map((it: any) => {
          const pid = it.product_id || it.productId;
          if (!pid) return null;

          const prod = db.prepare('SELECT selling_price FROM products WHERE id = ?').get(pid) as any;
          const price = Number(prod?.selling_price ?? it.price ?? it.unit_price ?? 0);
          return {
            id: it.id,
            productId: pid,
            name: it.name || prod?.name || 'Unknown',
            price,
            quantity: Number(it.quantity) || 0,
            notes: it.notes ?? undefined
          };
        }).filter(Boolean) as OrderItem[];
      }

      const items = db.prepare(`
        SELECT
          oi.id,
          oi.product_id AS productId,
          p.name,
          oi.unit_price AS price,
          oi.quantity,
          oi.notes
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `).all(orderId) as any[];

      if (items.length > 0) {
        return items.map(item => ({
          id: item.id,
          productId: item.productId,
          name: item.name || '',
          price: item.price,
          quantity: item.quantity,
          notes: item.notes ?? undefined
        }));
      }

      if (fallbackJson) {
        try {
          return JSON.parse(fallbackJson || '[]') as OrderItem[];
        } catch {
          return [];
        }
      }

      const order = db.prepare('SELECT items FROM orders WHERE id = ?').get(orderId) as any;
      return order ? JSON.parse(order.items || '[]') : [];
    } catch (error) {
      console.error('[OrderService] Error fetching order items:', error);
      return [];
    }
  }

  private static insertOrderItems(orderId: number, items: OrderItem[]): void {
    if (!db) return;
    const itemStmt = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, quantity, unit_price, total_price, notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of items as any[]) {
      const productId = item.productId ?? item.product_id;

      itemStmt.run(
        orderId,
        productId,
        Number(item.quantity),
        Number(item.price),
        Number(item.price) * Number(item.quantity),
        item.notes ?? null
      );
    }
  }

  private static replaceOrderItems(orderId: number, items: OrderItem[]): void {
    if (!db) return;
    // Queue deletions for sync
    try {
      const oldItems = db.prepare('SELECT id FROM order_items WHERE order_id = ?').all(orderId) as { id: number }[];
      const sync = getProductSyncService();
      for (const item of oldItems) {
        sync.queueChangeInsideTransaction('order_item', 'delete', { id: item.id });
      }
    } catch (e) {
      console.warn('[OrderService] Failed to queue item deletions for sync:', e);
    }

    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
    this.insertOrderItems(orderId, items);
  }

  /**
   * Get all orders with filtering
   */
  static async getAll(params: {
    waiter_id?: number;
    role?: string;
    table_id?: number;
    status?: string;
  } = {}): Promise<OrderData[]> {
    const { waiter_id, role, table_id, status } = params;

    // Cloud mode guard: db might be null (SQLite disabled on Render)
    // CRITICAL: In cloud mode, we use Supabase directly as the source of truth
    const pullEnabled = process.env.ENABLE_SUPABASE_PULL === 'true' || process.env.ENABLE_SUPABASE_PULL === '1';
    const cloudMode = process.env.RENDER_CLOUD_MODE === 'true' || process.env.RENDER_CLOUD_MODE === '1';
    
    console.log(`[OrderService] getAll - db=${db ? 'available' : 'null'}, pullEnabled=${pullEnabled}, cloudMode=${cloudMode}`);
    console.log(`[OrderService] getAll - params:`, params);
    
    if (!db || cloudMode) {
      // In cloud mode or when db is null, use Supabase directly
      console.log('[OrderService] Using Supabase as source of truth (cloud mode or db null)');
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();
        
        console.log('[OrderService] Supabase client created successfully');

        let query = supabase
          .from('orders')
          .select('*, table:restaurant_tables(table_number), waiter:users(full_name, role)');

        if (role === 'waiter' && waiter_id) {
          query = query.eq('waiter_id', waiter_id);
        }
        if (table_id) {
          query = query.eq('table_id', table_id);
        }
        if (status) {
          query = query.eq('status', status);
        }

        console.log('[OrderService] Executing Supabase query with filters:', { role, waiter_id, table_id, status });
        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          console.error('[OrderService] Supabase query error:', error);
          throw error;
        }

        console.log(`[OrderService] Supabase returned ${data?.length || 0} orders`);
        return (data || []).map((order: any) => ({
          ...order,
          table_number: order.table?.table_number,
          waiter_name: order.waiter?.full_name,
          waiter_role: order.waiter?.role,
          items: typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || [])
        }));
      } catch (err: any) {
        console.error('[OrderService] Supabase getAll failed:', err?.message || err);
        console.error('[OrderService] Stack:', err?.stack);
        throw new Error('Failed to fetch orders via Supabase: ' + (err?.message || String(err)));
      }
    } else {
      // Use SQLite as source of truth (local development or pull sync mode)
      console.log('[OrderService] Using SQLite as source of truth');
    }

    let query = `
      SELECT
        o.*,
        t.table_number,
        u.full_name as waiter_name,
        u.role as waiter_role
      FROM orders o
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.waiter_id = u.id
      WHERE 1=1
    `;
    const queryParams: any[] = [];

    // RBAC filtering
    if (role === 'waiter' && waiter_id) {
      query += ` AND o.waiter_id = ?`;
      queryParams.push(waiter_id);
    }

    if (table_id) {
      query += ` AND o.table_id = ?`;
      queryParams.push(table_id);
    }

    if (status) {
      query += ` AND o.status = ?`;
      queryParams.push(status);
    }

    query += ` ORDER BY o.created_at DESC`;

    try {
      const orders = db.prepare(query).all(...queryParams) as any[];
      return orders.map(order => ({
        ...order,
        items: this.getItemsForOrder(order.id, order.items, !!order.remote_id)
      }));
    } catch (error: any) {
      console.error('[OrderService] Error fetching orders (real error):', error);
      console.error(error.stack);
      throw new Error('Failed to fetch orders: ' + (error.message || 'unknown'));
    }
  }

  /**
   * Get order by ID
   */
  static async getById(id: number): Promise<OrderData | null> {
    // Cloud mode guard: db might be null (SQLite disabled on Render)
    if (!db) {
      console.log(`[OrderService] SQLite disabled (db is null). Falling back to Supabase for getById (id=${id})`);
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('orders')
          .select('*, table:restaurant_tables(table_number), waiter:users(full_name)')
          .eq('id', id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') return null; // Not found
          throw error;
        }

        const rawItems = typeof data.items === 'string' ? JSON.parse(data.items) : (data.items || []);
        
        // Enrich items with prices and names if they are missing (common for QR orders)
        // We do a bulk fetch of products to be efficient
        const productIds = rawItems.map((it: any) => it.product_id || it.productId).filter(Boolean);
        let productsMap = new Map();
        
        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from('products')
            .select('id, name, selling_price')
            .in('id', productIds);
          
          if (products) {
            products.forEach((p: any) => productsMap.set(p.id, p));
          }
        }

        const enrichedItems = rawItems.map((it: any) => {
          const pid = it.product_id || it.productId;
          const product = productsMap.get(pid);
          return {
            id: it.id,
            productId: pid,
            name: it.name || product?.name || 'Unknown Product',
            price: Number(it.price || it.unit_price || product?.selling_price || 0),
            quantity: Number(it.quantity) || 0,
            notes: it.notes ?? undefined
          };
        });

        return {
          ...data,
          table_number: data.table?.table_number,
          waiter_name: data.waiter?.full_name,
          items: enrichedItems
        };
      } catch (err: any) {
        console.error('[OrderService] Supabase getById failed:', err?.message || err);
        throw new Error('Failed to fetch order via Supabase');
      }
    }

    try {
      const order = db.prepare(`
        SELECT
          o.*,
          t.table_number,
          u.full_name as waiter_name
        FROM orders o
        LEFT JOIN restaurant_tables t ON o.table_id = t.id
        LEFT JOIN users u ON o.waiter_id = u.id
        WHERE o.id = ?
      `).get(id) as any;

      if (order) {
        return {
          ...order,
          items: this.getItemsForOrder(order.id, order.items, !!order.remote_id)
        };
      }
      return null;
    } catch (error) {
      console.error('[OrderService] Error fetching order:', error);
      throw new Error('Failed to fetch order');
    }
  }

  /**
   * Create new order with item merging logic
   */
  static async create(orderData: Omit<OrderData, 'id' | 'created_at' | 'updated_at'>): Promise<OrderData> {
    const businessId = process.env.SYNC_BUSINESS_ID || 'default-business';

    // Cloud mode guard: db might be null (SQLite disabled on Render)
    if (!db) {
      console.log('[OrderService] SQLite disabled (db is null). Falling back to Supabase for create');
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();
        const { table_id, waiter_id, items, status, customer_id } = orderData;

        const normalizedItems = items.map((item: any) => ({
          ...item,
          productId: item.productId ?? item.product_id,
          name: item.name || '',
          quantity: Number(item.quantity),
          price: Number(item.price),
          notes: item.notes ?? null
        }));

        const total = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const { data, error } = await supabase
          .from('orders')
          .insert([{
            table_id,
            waiter_id,
            customer_id,
            items: normalizedItems,
            status: status || 'pending',
            total,
            version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;
        return {
          ...data,
          items: normalizedItems
        };
      } catch (err: any) {
        console.error('[OrderService] Supabase create failed:', err?.message || err);
        throw new Error(err?.message || 'Failed to create order via Supabase');
      }
    }

    return withOutboxTransaction(db, businessId, () => {
      try {
        const { table_id, waiter_id, items, status } = orderData;

        const normalizedItems = items.map((item: any) => ({
          ...item,
          productId: item.productId ?? item.product_id,
          name: item.name || '',
          quantity: Number(item.quantity),
          price: Number(item.price),
          notes: item.notes ?? null
        }));

        const total = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        if (table_id) {
          const existingOrder = db.prepare(`
            SELECT id, items, version FROM orders
            WHERE table_id = ? AND status NOT IN ('paid', 'cancelled')
            ORDER BY created_at DESC LIMIT 1
          `).get(table_id) as any;

          if (existingOrder) {
            console.log(`[OrderService] Merging items into existing order ${existingOrder.id}`);
            const existingItems = this.getItemsForOrder(existingOrder.id, existingOrder.items);
            const itemMap = new Map<number, OrderItem>();

            existingItems.forEach((item: OrderItem) => itemMap.set(item.productId, { ...item }));
            normalizedItems.forEach((newItem: OrderItem) => {
              const existing = itemMap.get(newItem.productId);
              if (existing) {
                existing.quantity += newItem.quantity;
              } else {
                itemMap.set(newItem.productId, { ...newItem });
              }
            });

            const mergedItems = Array.from(itemMap.values());
            const mergedTotal = mergedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

            db.prepare(`
              UPDATE orders
              SET items = ?, total = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(JSON.stringify(mergedItems), mergedTotal, existingOrder.id);

            this.replaceOrderItems(existingOrder.id, mergedItems);

            const updatedOrder = db.prepare(`
              SELECT
                o.*,
                t.table_number,
                u.full_name as waiter_name
              FROM orders o
              LEFT JOIN restaurant_tables t ON o.table_id = t.id
              LEFT JOIN users u ON o.waiter_id = u.id
              WHERE o.id = ?
            `).get(existingOrder.id) as any;

            const finalOrder = { ...updatedOrder, items: mergedItems };
            getOrderSyncService().queueOrderChange('update', finalOrder, businessId);

            return finalOrder;
          }
        }

        const result = db.prepare(`
          INSERT INTO orders (table_id, waiter_id, items, status, total, created_at, updated_at, version)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
        `).run(
          table_id,
          waiter_id,
          JSON.stringify(normalizedItems),
          status || 'pending',
          total
        );

        const orderId = Number(result.lastInsertRowid);
        this.insertOrderItems(orderId, normalizedItems);

        const newOrder = db.prepare(`
          SELECT o.*, t.table_number, u.full_name as waiter_name
          FROM orders o
          LEFT JOIN restaurant_tables t ON o.table_id = t.id
          LEFT JOIN users u ON o.waiter_id = u.id
          WHERE o.id = ?
        `).get(orderId) as any;

        const finalOrder = {
          ...newOrder,
          items: this.getItemsForOrder(orderId, JSON.stringify(normalizedItems))
        };
        
        getOrderSyncService().queueOrderChange('insert', finalOrder, businessId);

        return finalOrder;
      } catch (error) {
        throw error;
      }
    });
  }

  /**
   * Update order items
   */
  static async updateItems(id: number, items: OrderItem[]): Promise<OrderData> {
    const businessId = process.env.SYNC_BUSINESS_ID || 'default-business';

    // Cloud mode guard: db might be null (SQLite disabled on Render)
    if (!db) {
      console.log('[OrderService] SQLite disabled (db is null). Falling back to Supabase for updateItems');
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        const normalizedItems = items.map(item => ({
          ...item,
          name: item.name || '',
          quantity: Number(item.quantity),
          price: Number(item.price),
          notes: item.notes ?? null
        }));

        const total = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const { data, error } = await supabase
          .from('orders')
          .update({
            items: normalizedItems,
            total,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        if (!data) throw new Error('Order not found');

        return {
          ...data,
          items: normalizedItems
        };
      } catch (err: any) {
        console.error('[OrderService] Supabase updateItems failed:', err?.message || err);
        throw new Error(err?.message || 'Failed to update order items via Supabase');
      }
    }

    return withOutboxTransaction(db, businessId, () => {
      try {
        const existingOrder = db.prepare('SELECT id FROM orders WHERE id = ?').get(id);
        if (!existingOrder) {
          throw new Error('Order not found');
        }

        const normalizedItems = items.map(item => ({
          ...item,
          name: item.name || '',
          quantity: Number(item.quantity),
          price: Number(item.price),
          notes: item.notes ?? null
        }));

        const total = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        db.prepare(`
          UPDATE orders
          SET items = ?, total = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(JSON.stringify(normalizedItems), total, id);

        this.replaceOrderItems(id, normalizedItems);

        const updatedOrder = db.prepare(`
          SELECT
            o.*,
            t.table_number,
            u.full_name as waiter_name
          FROM orders o
          LEFT JOIN restaurant_tables t ON o.table_id = t.id
          LEFT JOIN users u ON o.waiter_id = u.id
          WHERE o.id = ?
        `).get(id) as any;

        const result = {
          ...updatedOrder,
          items: normalizedItems
        };

        getOrderSyncService().queueOrderChange('update', result, businessId);

        return result;
      } catch (error) {
        throw error;
      }
    });
  }

  /**
   * Update order status
   */
  static async updateStatus(id: number, status: OrderData['status']): Promise<OrderData> {
    const businessId = process.env.SYNC_BUSINESS_ID || 'default-business';

    // Cloud mode guard: db might be null (SQLite disabled on Render)
    if (!db) {
      console.log(`[OrderService] SQLite disabled (db is null). Falling back to Supabase for updateStatus (id=${id}, status=${status})`);
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        // 1. Update the order
        const { data, error } = await supabase
          .from('orders')
          .update({ 
            status, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        if (!data) throw new Error('Order not found');

        // 2. Handle table status side-effects (matching local behavior)
        if (status === 'paid' && data.table_id) {
          await supabase
            .from('restaurant_tables')
            .update({ status: 'cleaning' })
            .eq('id', data.table_id);
        } else if (status === 'cancelled' && data.table_id) {
          // Check if there are other active orders for this table
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('table_id', data.table_id)
            .not('status', 'in', '("paid","cancelled")');
          
          if (count === 0) {
            await supabase
              .from('restaurant_tables')
              .update({ status: 'available' })
              .eq('id', data.table_id);
          }
        }

        return {
          ...data,
          items: typeof data.items === 'string' ? JSON.parse(data.items) : (data.items || [])
        };
      } catch (err: any) {
        console.error('[OrderService] Supabase updateStatus failed:', err?.message || err);
        throw new Error(err?.message || 'Failed to update order status via Supabase');
      }
    }

    return withOutboxTransaction(db, businessId, () => {
      try {
        const wasPaid = (db.prepare('SELECT status FROM orders WHERE id = ?').get(id) as any)?.status === 'paid';
        
        if (status === 'paid') {
          const order = db.prepare('SELECT table_id FROM orders WHERE id = ?').get(id) as any;
          if (order && order.table_id) {
            db.prepare("UPDATE restaurant_tables SET status = 'cleaning' WHERE id = ?").run(order.table_id);
          }
        } else if (status === 'cancelled') {
          const order = db.prepare('SELECT table_id FROM orders WHERE id = ?').get(id) as any;
          if (order && order.table_id) {
            const activeOrders = db.prepare(`
              SELECT COUNT(*) as count FROM orders
              WHERE table_id = ? AND status NOT IN ('paid', 'cancelled')
            `).get(order.table_id) as any;
            if (activeOrders.count === 0) {
              db.prepare("UPDATE restaurant_tables SET status = 'available' WHERE id = ?").run(order.table_id);
            }
          }
        }

        db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);

        const updatedOrder = db.prepare(`
          SELECT
            o.*,
            t.table_number,
            u.full_name as waiter_name
          FROM orders o
          LEFT JOIN restaurant_tables t ON o.table_id = t.id
          LEFT JOIN users u ON o.waiter_id = u.id
          WHERE o.id = ?
        `).get(id) as any;

        const result = {
          ...updatedOrder,
          items: this.getItemsForOrder(id, updatedOrder.items)
        };

        // Queue for sync
        getOrderSyncService().queueOrderChange('update', result, businessId);

        if (!wasPaid && status === 'paid') {
          const saleExists = db.prepare('SELECT 1 FROM sales WHERE order_id = ? LIMIT 1').get(id);
          if (saleExists) {
            console.log('[OrderService] Order already has sale record, skipping duplicate checkout notification.');
          } else {
            setImmediate(async () => {
              try {
                const rawSettings = loadRawSettings();
                const orderItems = result.items.map((item: any) => ({
                  name: item.name,
                  qty: item.quantity,
                  unitPrice: item.price,
                  total: item.price * item.quantity,
                }));
                const tableLabel = result.table_id
                  ? `Table ${result.table_number || result.table_id}`
                  : 'Counter';
                await notifyOrderCheckout(
                  id,
                  orderItems,
                  result.total,
                  'cash',
                  tableLabel,
                  result.waiter_name,
                  undefined,
                  'USD',
                  rawSettings,
                );
              } catch (err) {
                console.error('[OrderService] Failed to send checkout notification:', err);
              }
            });
          }
        }

        return result;
      } catch (error) {
        throw error;
      }
    });
  }

  /**
   * Validate order operations
   */
  static validateOrderOperation(order: OrderData, operation: string): void {
    switch (operation) {
      case 'checkout':
        if (order.status === 'paid') {
          throw new Error('Order is already paid');
        }
        if (order.status === 'cancelled') {
          throw new Error('Cannot checkout cancelled order');
        }
        break;

      case 'update':
        if (order.status === 'paid') {
          throw new Error('Cannot update paid order');
        }
        if (order.status === 'cancelled') {
          throw new Error('Cannot update cancelled order');
        }
        break;

      default:
        break;
    }
  }

  /**
   * Hard delete order + its items (used for rejecting pending QR orders)
   */
  static async deleteOrder(id: number): Promise<void> {
    const businessId = process.env.SYNC_BUSINESS_ID || 'default-business';

    // Cloud mode guard: db might be null (SQLite disabled on Render)
    if (!db) {
      console.log(`[OrderService] SQLite disabled (db is null). Falling back to Supabase for deleteOrder (id=${id})`);
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        // Supabase has ON DELETE CASCADE on order_items, but let's be safe if needed
        const { error } = await supabase
          .from('orders')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return;
      } catch (err: any) {
        console.error('[OrderService] Supabase deleteOrder failed:', err?.message || err);
        throw new Error(err?.message || 'Failed to delete order via Supabase');
      }
    }

    return withOutboxTransaction(db, businessId, () => {
      try {
        // delete items first (FK safety)
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);
        const result = db.prepare('DELETE FROM orders WHERE id = ?').run(id);
        if (result.changes === 0) {
          throw new Error('Order not found');
        }

        getOrderSyncService().queueOrderChange('delete', { id } as any, businessId);
      } catch (error) {
        throw error;
      }
    });
  }
}
