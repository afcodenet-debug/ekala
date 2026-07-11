import db from '../db/database';
import { notifyOrderCheckout, loadRawSettings } from '../services/notification.service';
import { getOrderSyncService, getProductSyncService, withOutboxTransaction, isSyncEnabled } from '../../sync';
import { getCurrentTenantId } from '../db/tenant-context';
import { dataSource } from '../infrastructure/data-source-manager';
import { mirrorRemoteOrderToLocal, deleteMirroredOrder } from './order-local-mirror';

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
  table_waiter_name?: string | null;
  order_waiter_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export class OrderService {
  private static getItemsForOrder(orderId: number, fallbackJson?: string, isRemote: boolean = false): OrderItem[] {
    const tenantId = getCurrentTenantId();
    try {
      // Cloud mode guard: if in cloud mode, we can only rely on fallbackJson (JSON snapshot in orders.items)
      if (dataSource.isCloudMode()) {
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

          const prod = db.prepare('SELECT selling_price FROM products WHERE id = ? AND tenant_id = ?').get(pid, tenantId) as any;
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
        WHERE oi.order_id = ? AND oi.tenant_id = ?
      `).all(orderId, tenantId) as any[];

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

      const order = db.prepare('SELECT items FROM orders WHERE id = ? AND tenant_id = ?').get(orderId, tenantId) as any;
      return order ? JSON.parse(order.items || '[]') : [];
    } catch (error) {
      console.error('[OrderService] Error fetching order items:', error);
      return [];
    }
  }

  private static resolveEffectiveWaiterId(table_id: number | null, waiter_id: number): number {
    const tenantId = getCurrentTenantId();
    if (dataSource.isCloudMode() || !table_id) return waiter_id || 1;

    const table = db.prepare(
      'SELECT assigned_waiter_id FROM restaurant_tables WHERE id = ? AND tenant_id = ?'
    ).get(table_id, tenantId) as { assigned_waiter_id: number | null } | undefined;

    return table?.assigned_waiter_id || waiter_id || 1;
  }

  private static insertOrderItems(orderId: number, items: OrderItem[]): void {
    if (dataSource.isCloudMode()) return;
    const tenantId = getCurrentTenantId();
    const itemStmt = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, quantity, unit_price, total_price, notes, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items as any[]) {
      const productId = item.productId ?? item.product_id;
      const unitPrice =
        Number(item.price) ||
        Number(item.unit_price) ||
        Number(item.unitPrice) ||
        0;
      const quantity = Number(item.quantity) || 0;

      itemStmt.run(
        orderId,
        productId,
        quantity,
        unitPrice,
        unitPrice * quantity,
        item.notes ?? null,
        tenantId
      );
    }
  }

  private static replaceOrderItems(orderId: number, items: OrderItem[]): void {
    if (dataSource.isCloudMode()) return;
    const tenantId = getCurrentTenantId();
    // Queue deletions for sync
    try {
      const oldItems = db.prepare('SELECT id FROM order_items WHERE order_id = ? AND tenant_id = ?').all(orderId, tenantId) as { id: number }[];
      const sync = getProductSyncService();
      if (sync) {
        for (const item of oldItems) {
          sync.queueChangeInsideTransaction('order_item', 'delete', { id: item.id });
        }
      }
    } catch (e) {
      console.warn('[OrderService] Failed to queue item deletions for sync:', e);
    }

    db.prepare('DELETE FROM order_items WHERE order_id = ? AND tenant_id = ?').run(orderId, tenantId);
    this.insertOrderItems(orderId, items);
  }

  static async getAll(params: {
    waiter_id?: number;
    role?: string;
    table_id?: number;
    status?: string;
  } = {}): Promise<OrderData[]> {
    const { waiter_id, role, table_id, status } = params;
    const tenantId = getCurrentTenantId();

    // ===== Mode Cloud (Supabase) =====
    if (dataSource.isCloudMode()) {
      console.log(`[OrderService] Cloud mode. Using Supabase for getAll (tenant=${tenantId})`);
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        let query = supabase
          .from('orders')
          .select('*, table:restaurant_tables(table_number, assigned_waiter_id, waiter:users(full_name, username)), waiter:users(full_name, username)')
          .eq('tenant_id', tenantId);

        if (role === 'waiter' && waiter_id) {
          query = query.eq('waiter_id', waiter_id);
        }
        if (table_id) {
          query = query.eq('table_id', table_id);
        }
        if (status) {
          query = query.eq('status', status);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((order: any) => {
          const tableWaiterName = order.table?.waiter?.full_name || order.table?.waiter?.username;
          const orderWaiterName = order.waiter?.full_name || order.waiter?.username;
          return {
            ...order,
            table_number: order.table?.table_number,
            table_waiter_name: tableWaiterName,
            order_waiter_name: orderWaiterName,
            waiter_name: tableWaiterName || orderWaiterName,
            waiter_role: order.table?.waiter?.role || order.waiter?.role,
            items: typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || [])
          };
        });
      } catch (err: any) {
        console.error('[OrderService] Supabase getAll failed:', err?.message || err);
        throw new Error('Failed to fetch orders via Supabase');
      }
    }

    console.log(`[OrderService] Using SQLite as source of truth (tenant=${tenantId})`);

    let query = `
      SELECT
        o.*,
        COALESCE(t.table_number, t2.table_number) as table_number,
        COALESCE(ut.full_name, ut.username, u.full_name, u.username) as waiter_name,
        TRIM(COALESCE(ut.full_name, '') || ' ' || COALESCE(ut.username, '')) as table_waiter_name,
        TRIM(COALESCE(u.full_name, '') || ' ' || COALESCE(u.username, '')) as order_waiter_name,
        ut.role as waiter_role
      FROM orders o
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      LEFT JOIN restaurant_tables t2 ON o.table_id = t2.remote_id AND t2.id != t.id
      LEFT JOIN users ut ON (t.assigned_waiter_id = ut.id OR t.assigned_waiter_id = ut.remote_id)
      LEFT JOIN users u ON (o.waiter_id = u.id OR o.waiter_id = u.remote_id)
      WHERE o.tenant_id = ?
    `;
    const queryParams: any[] = [tenantId];

    // RBAC filtering
    if (role === 'waiter' && waiter_id) {
      query += ` AND (o.waiter_id = ? OR o.waiter_id = (SELECT remote_id FROM users WHERE id = ?))`;
      queryParams.push(waiter_id, waiter_id);
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

      // For orders synced from Supabase, table_id might reference a remote ID
      // that doesn't match local restaurant_tables.id. Fix by re-resolving.
      for (const order of orders) {
        if (order.table_id && !order.table_number) {
          // table_id didn't match local id, try remote_id first
          let matchByRemote = db.prepare(
            `SELECT id, table_number FROM restaurant_tables WHERE remote_id = ? AND tenant_id = ?`
          ).get(order.table_id, tenantId) as any;
          
          // Fallback: try by table_number if we can extract it from table_id
          if (!matchByRemote && typeof order.table_id === 'string') {
            matchByRemote = db.prepare(
              `SELECT id, table_number FROM restaurant_tables WHERE table_number = ? AND tenant_id = ?`
            ).get(order.table_id, tenantId) as any;
          }
          
          // Fallback: try by id directly
          if (!matchByRemote) {
            matchByRemote = db.prepare(
              `SELECT id, table_number FROM restaurant_tables WHERE id = ? AND tenant_id = ?`
            ).get(order.table_id, tenantId) as any;
          }
          
          if (matchByRemote) {
            order.table_id = matchByRemote.id;
            order.table_number = matchByRemote.table_number;
          }
        }
      }

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

  static async getById(id: number): Promise<OrderData | null> {
    const tenantId = getCurrentTenantId();
    // ===== Mode Cloud (Supabase) =====
    if (dataSource.isCloudMode()) {
      console.log(`[OrderService] Cloud mode. Using Supabase for getById (id=${id}, tenant=${tenantId})`);
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('orders')
          .select('*, table:restaurant_tables(table_number, assigned_waiter_id, waiter:users(full_name, username)), waiter:users(full_name, username)')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        const rawItems = typeof data.items === 'string' ? JSON.parse(data.items) : (data.items || []);
        
        // Enrich items with prices and names if they are missing (common for QR orders)
        // We do a bulk fetch of products to be efficient
        const productIds = rawItems.map((it: any) => it.product_id || it.productId).filter(Boolean);
        let productsMap = new Map();
        
        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from('products')
            .select('id, name, selling_price')
            .in('id', productIds)
            .eq('tenant_id', tenantId);
          
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

        const tableWaiterName = data.table?.waiter?.full_name || data.table?.waiter?.username;
        const orderWaiterName = data.waiter?.full_name || data.waiter?.username;

        return {
          ...data,
          table_number: data.table?.table_number,
          table_waiter_name: tableWaiterName,
          order_waiter_name: orderWaiterName,
          waiter_name: tableWaiterName || orderWaiterName,
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
          COALESCE(t.table_number, t2.table_number) as table_number,
          COALESCE(ut.full_name, ut.username, u.full_name, u.username) as waiter_name,
          TRIM(COALESCE(ut.full_name, '') || ' ' || COALESCE(ut.username, '')) as table_waiter_name,
          TRIM(COALESCE(u.full_name, '') || ' ' || COALESCE(u.username, '')) as order_waiter_name
        FROM orders o
        LEFT JOIN restaurant_tables t ON o.table_id = t.id
        LEFT JOIN restaurant_tables t2 ON o.table_id = t2.remote_id AND t2.id != t.id
        LEFT JOIN users ut ON (t.assigned_waiter_id = ut.id OR t.assigned_waiter_id = ut.remote_id)
        LEFT JOIN users u ON (o.waiter_id = u.id OR o.waiter_id = u.remote_id)
        WHERE o.id = ? AND o.tenant_id = ?
      `).get(id, tenantId) as any;

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

  static async create(orderData: Omit<OrderData, 'id' | 'created_at' | 'updated_at'>): Promise<OrderData> {
    const tenantId = getCurrentTenantId();

    // ===== Mode Cloud (Supabase) =====
    if (dataSource.isCloudMode()) {
      console.log(`[OrderService] Cloud mode. Using Supabase for create (tenant=${tenantId})`);
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();
        const { table_id, waiter_id, items, status, customer_id } = orderData;
        const effectiveWaiterId = this.resolveEffectiveWaiterId(table_id, waiter_id);

        const normalizedItems = items.map((item: any) => ({
          ...item,
          productId: item.productId ?? item.product_id,
          name: item.name || '',
          quantity: Number(item.quantity),
          price: Number(item.price),
          notes: item.notes ?? null,
          tenant_id: tenantId
        }));

        const total = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const { data, error } = await supabase
          .from('orders')
          .insert([{
            table_id,
            waiter_id: effectiveWaiterId,
            customer_id,
            items: normalizedItems,
            status: status || 'pending',
            total,
            version: 1,
            tenant_id: tenantId,
            source: 'local',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;

        // Miroir bidirectionnel : la commande cloud est aussi matérialisée dans SQLite
        // (no-op si aucune SQLite locale disponible, ex. RENDER_CLOUD_MODE sur Render
        // où il n'y a pas de fichier SQLite — la commande reste dans Supabase et sera
        // tirée par l'app locale en mode LOCAL via le pull du moteur de sync).
        try {
          const mirrorRes = await mirrorRemoteOrderToLocal(tenantId, data, normalizedItems);
          if (!mirrorRes.applied) {
            console.log(`[OrderService] Order #${data?.id} saved to Supabase only (local SQLite mirror skipped — no local DB in this environment). The local app (mode LOCAL) will pull it via sync.`);
          }
        } catch (mirrorErr: any) {
          console.warn('[OrderService] Cloud→SQLite mirror failed (non-critical):', mirrorErr?.message);
        }

        return {
          ...data,
          items: normalizedItems
        };
      } catch (err: any) {
        console.error('[OrderService] Supabase create failed:', err?.message || err);
        throw new Error(err?.message || 'Failed to create order via Supabase');
      }
    }

    return withOutboxTransaction(db, String(tenantId), () => {
      try {
        const { table_id, waiter_id, items, status } = orderData;
        const effectiveWaiterId = this.resolveEffectiveWaiterId(table_id, waiter_id);

        const normalizedItems = items.map((item: any) => ({
          ...item,
          productId: item.productId ?? item.product_id,
          name: item.name || '',
          quantity: Number(item.quantity),
          price: Number(item.price),
          notes: item.notes ?? null,
          tenant_id: tenantId
        }));

        const total = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        if (table_id) {
          const existingOrder = db.prepare(`
            SELECT id, items, version FROM orders
            WHERE table_id = ? AND tenant_id = ? AND status NOT IN ('paid', 'cancelled')
            ORDER BY created_at DESC LIMIT 1
          `).get(table_id, tenantId) as any;

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
              WHERE id = ? AND tenant_id = ?
            `).run(JSON.stringify(mergedItems), mergedTotal, existingOrder.id, tenantId);

            this.replaceOrderItems(existingOrder.id, mergedItems);

            const updatedOrder = db.prepare(`
              SELECT
                o.*,
                t.table_number,
                COALESCE(ut.full_name, ut.username, u.full_name, u.username) as waiter_name,
                TRIM(COALESCE(ut.full_name, '') || ' ' || COALESCE(ut.username, '')) as table_waiter_name,
                TRIM(COALESCE(u.full_name, '') || ' ' || COALESCE(u.username, '')) as order_waiter_name
              FROM orders o
              LEFT JOIN restaurant_tables t ON o.table_id = t.id
              LEFT JOIN users ut ON (t.assigned_waiter_id = ut.id OR t.assigned_waiter_id = ut.remote_id)
              LEFT JOIN users u ON (o.waiter_id = u.id OR o.waiter_id = u.remote_id)
              WHERE o.id = ? AND o.tenant_id = ?
            `).get(existingOrder.id, tenantId) as any;

            const finalOrder = { ...updatedOrder, items: mergedItems };
            getOrderSyncService()?.queueOrderChange('update', finalOrder, String(tenantId));
            if (isSyncEnabled()) getOrderSyncService()?.pushPendingOrders(String(tenantId)).catch(e => console.warn('[OrderService] Sync push failed:', e));

            return finalOrder;
          }
        }

        const result = db.prepare(`
          INSERT INTO orders (table_id, waiter_id, items, status, total, tenant_id, source, created_at, updated_at, version)
          VALUES (?, ?, ?, ?, ?, ?, 'local', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
        `).run(
          table_id,
          effectiveWaiterId,
          JSON.stringify(normalizedItems),
          status || 'pending',
          total,
          tenantId
        );

        const orderId = Number(result.lastInsertRowid);
        this.insertOrderItems(orderId, normalizedItems);

        const newOrder = db.prepare(`
          SELECT o.*, t.table_number,
            COALESCE(ut.full_name, ut.username, u.full_name, u.username) as waiter_name,
            TRIM(COALESCE(ut.full_name, '') || ' ' || COALESCE(ut.username, '')) as table_waiter_name,
            TRIM(COALESCE(u.full_name, '') || ' ' || COALESCE(u.username, '')) as order_waiter_name
          FROM orders o
          LEFT JOIN restaurant_tables t ON o.table_id = t.id
          LEFT JOIN users ut ON (t.assigned_waiter_id = ut.id OR t.assigned_waiter_id = ut.remote_id)
          LEFT JOIN users u ON (o.waiter_id = u.id OR o.waiter_id = u.remote_id)
          WHERE o.id = ? AND o.tenant_id = ?
        `).get(orderId, tenantId) as any;

        const finalOrder = {
          ...newOrder,
          items: this.getItemsForOrder(orderId, JSON.stringify(normalizedItems))
        };
        
        getOrderSyncService()?.queueOrderChange('insert', finalOrder, String(tenantId));
        if (isSyncEnabled()) getOrderSyncService()?.pushPendingOrders(String(tenantId)).catch(e => console.warn('[OrderService] Sync push failed:', e));

        return finalOrder;
      } catch (error) {
        throw error;
      }
    });
  }

  static async updateItems(id: number, items: OrderItem[]): Promise<OrderData> {
    const tenantId = getCurrentTenantId();

    // ===== Mode Cloud (Supabase) =====
    if (dataSource.isCloudMode()) {
      console.log(`[OrderService] Cloud mode. Using Supabase for updateItems (tenant=${tenantId})`);
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        const normalizedItems = items.map(item => ({
          ...item,
          name: item.name || '',
          quantity: Number(item.quantity),
          price: Number(item.price),
          notes: item.notes ?? null,
          tenant_id: tenantId
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
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (error) throw error;
        if (!data) throw new Error('Order not found');

        // Miroir bidirectionnel : reflète la mise à jour dans SQLite
        try {
          mirrorRemoteOrderToLocal(tenantId, data, normalizedItems);
        } catch (mirrorErr: any) {
          console.warn('[OrderService] Cloud→SQLite mirror failed (non-critical):', mirrorErr?.message);
        }

        return {
          ...data,
          items: normalizedItems
        };
      } catch (err: any) {
        console.error('[OrderService] Supabase updateItems failed:', err?.message || err);
        throw new Error(err?.message || 'Failed to update order items via Supabase');
      }
    }

    return withOutboxTransaction(db, String(tenantId), () => {
      try {
        const existingOrder = db.prepare('SELECT id FROM orders WHERE id = ? AND tenant_id = ?').get(id, tenantId);
        if (!existingOrder) {
          throw new Error('Order not found');
        }

        const normalizedItems = items.map(item => ({
          ...item,
          name: item.name || '',
          quantity: Number(item.quantity),
          price: Number(item.price),
          notes: item.notes ?? null,
          tenant_id: tenantId
        }));

        const total = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        db.prepare(`
          UPDATE orders
          SET items = ?, total = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND tenant_id = ?
        `).run(JSON.stringify(normalizedItems), total, id, tenantId);

        this.replaceOrderItems(id, normalizedItems);

        const updatedOrder = db.prepare(`
          SELECT
            o.*,
            t.table_number,
            COALESCE(ut.full_name, ut.username, u.full_name, u.username) as waiter_name,
            TRIM(COALESCE(ut.full_name, '') || ' ' || COALESCE(ut.username, '')) as table_waiter_name,
            TRIM(COALESCE(u.full_name, '') || ' ' || COALESCE(u.username, '')) as order_waiter_name
          FROM orders o
          LEFT JOIN restaurant_tables t ON o.table_id = t.id
          LEFT JOIN users ut ON (t.assigned_waiter_id = ut.id OR t.assigned_waiter_id = ut.remote_id)
          LEFT JOIN users u ON (o.waiter_id = u.id OR o.waiter_id = u.remote_id)
          WHERE o.id = ? AND o.tenant_id = ?
        `).get(id, tenantId) as any;

        const result = {
          ...updatedOrder,
          items: normalizedItems
        };

        getOrderSyncService()?.queueOrderChange('update', result, String(tenantId));

        return result;
      } catch (error) {
        throw error;
      }
    });
  }

  static async updateStatus(id: number, status: OrderData['status']): Promise<OrderData> {
    const tenantId = getCurrentTenantId();

    // ===== Mode Cloud (Supabase) =====
    if (dataSource.isCloudMode()) {
      console.log(`[OrderService] Cloud mode. Using Supabase for updateStatus (id=${id}, status=${status}, tenant=${tenantId})`);
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
          .eq('tenant_id', tenantId)
          .select('*, table:restaurant_tables(table_number, assigned_waiter_id, waiter:users(full_name, username)), waiter:users(full_name, username)')
          .single();

        if (error) throw error;
        if (!data) throw new Error('Order not found');

        // Miroir bidirectionnel : reflète le changement de statut dans SQLite
        try {
          mirrorRemoteOrderToLocal(tenantId, data);
        } catch (mirrorErr: any) {
          console.warn('[OrderService] Cloud→SQLite mirror failed (non-critical):', mirrorErr?.message);
        }

        // 2. Handle table status side-effects (matching local behavior)
        if (status === 'paid' && data.table_id) {
          await supabase
            .from('restaurant_tables')
            .update({ status: 'cleaning' })
            .eq('id', data.table_id)
            .eq('tenant_id', tenantId);
        } else if (status === 'cancelled' && data.table_id) {
          // Check if there are other active orders for this table
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('table_id', data.table_id)
            .eq('tenant_id', tenantId)
            .not('status', 'in', '("paid","cancelled")');
          
          if (count === 0) {
            await supabase
              .from('restaurant_tables')
              .update({ status: 'available' })
              .eq('id', data.table_id)
              .eq('tenant_id', tenantId);
          }
        }

        const tableWaiterName = data.table?.waiter?.full_name || data.table?.waiter?.username;
        const orderWaiterName = data.waiter?.full_name || data.waiter?.username;

        return {
          ...data,
          table_number: data.table?.table_number,
          table_waiter_name: tableWaiterName,
          order_waiter_name: orderWaiterName,
          waiter_name: tableWaiterName || orderWaiterName,
          items: typeof data.items === 'string' ? JSON.parse(data.items) : (data.items || [])
        };
      } catch (err: any) {
        console.error('[OrderService] Supabase updateStatus failed:', err?.message || err);
        throw new Error(err?.message || 'Failed to update order status via Supabase');
      }
    }

    return withOutboxTransaction(db, String(tenantId), () => {
      try {
        const wasPaid = (db.prepare('SELECT status FROM orders WHERE id = ? AND tenant_id = ?').get(id, tenantId) as any)?.status === 'paid';
        
        if (status === 'paid') {
          const order = db.prepare('SELECT table_id FROM orders WHERE id = ? AND tenant_id = ?').get(id, tenantId) as any;
          if (order && order.table_id) {
            db.prepare("UPDATE restaurant_tables SET status = 'cleaning' WHERE id = ? AND tenant_id = ?").run(order.table_id, tenantId);
          }
        } else if (status === 'cancelled') {
          const order = db.prepare('SELECT table_id FROM orders WHERE id = ? AND tenant_id = ?').get(id, tenantId) as any;
          if (order && order.table_id) {
            const activeOrders = db.prepare(`
              SELECT COUNT(*) as count FROM orders
              WHERE table_id = ? AND tenant_id = ? AND status NOT IN ('paid', 'cancelled')
            `).get(order.table_id, tenantId) as any;
            if (activeOrders.count === 0) {
              db.prepare("UPDATE restaurant_tables SET status = 'available' WHERE id = ? AND tenant_id = ?").run(order.table_id, tenantId);
            }
          }
        }

        // ─── [FORENSIC TRACE] SQLite status write ──────────────────────────
        console.log('[FORENSIC][STATUS_WRITE] SQLite update', {
          orderId: id,
          newStatus: status,
          tenantId,
          timestamp: new Date().toISOString(),
          source: 'OrderService.updateStatus'
        });

        db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?').run(status, id, tenantId);

        const updatedOrder = db.prepare(`
          SELECT
            o.*,
            t.table_number,
            COALESCE(ut.full_name, ut.username, u.full_name, u.username) as waiter_name,
            TRIM(COALESCE(ut.full_name, '') || ' ' || COALESCE(ut.username, '')) as table_waiter_name,
            TRIM(COALESCE(u.full_name, '') || ' ' || COALESCE(u.username, '')) as order_waiter_name
          FROM orders o
          LEFT JOIN restaurant_tables t ON o.table_id = t.id
          LEFT JOIN users ut ON (t.assigned_waiter_id = ut.id OR t.assigned_waiter_id = ut.remote_id)
          LEFT JOIN users u ON (o.waiter_id = u.id OR o.waiter_id = u.remote_id)
          WHERE o.id = ? AND o.tenant_id = ?
        `).get(id, tenantId) as any;

        const result = {
          ...updatedOrder,
          items: this.getItemsForOrder(id, updatedOrder.items)
        };

        // Queue for sync - CRITICAL for real-time status consistency
        console.log(`[OrderService] Queuing sync for order ${id} with status ${status}`);
        getOrderSyncService()?.queueOrderChange('update', result, String(tenantId));
        if (isSyncEnabled()) getOrderSyncService()?.pushPendingOrders(String(tenantId)).catch(e => console.warn('[OrderService] Sync push failed:', e));

        if (!wasPaid && status === 'paid') {
          const saleExists = db.prepare('SELECT 1 FROM sales WHERE order_id = ? AND tenant_id = ? LIMIT 1').get(id, tenantId);
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
    const tenantId = getCurrentTenantId();

    // ===== Mode Cloud (Supabase) =====
    if (dataSource.isCloudMode()) {
      console.log(`[OrderService] Cloud mode. Using Supabase for deleteOrder (id=${id}, tenant=${tenantId})`);
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        // Supabase has ON DELETE CASCADE on order_items, but let's be safe if needed
        const { error } = await supabase
          .from('orders')
          .delete()
          .eq('id', id)
          .eq('tenant_id', tenantId);

        if (error) throw error;

        // Miroir bidirectionnel : supprime aussi la commande de la SQLite locale
        try {
          deleteMirroredOrder(tenantId, id);
        } catch (mirrorErr: any) {
          console.warn('[OrderService] Cloud→SQLite mirror delete failed (non-critical):', mirrorErr?.message);
        }
        return;
      } catch (err: any) {
        console.error('[OrderService] Supabase deleteOrder failed:', err?.message || err);
        throw new Error(err?.message || 'Failed to delete order via Supabase');
      }
    }

    return withOutboxTransaction(db, String(tenantId), () => {
      try {
        // delete items first (FK safety)
        db.prepare('DELETE FROM order_items WHERE order_id = ? AND tenant_id = ?').run(id, tenantId);
        const result = db.prepare('DELETE FROM orders WHERE id = ? AND tenant_id = ?').run(id, tenantId);
        if (result.changes === 0) {
          throw new Error('Order not found');
        }

        getOrderSyncService()?.queueOrderChange('delete', { id } as any, String(tenantId));
      } catch (error) {
        throw error;
      }
    });
  }
}
