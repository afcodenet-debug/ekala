import express from 'express';
import db from '../db/database';
import { notifyOrderCheckout } from '../services/notification.service';
import { requirePermission } from '../middleware/auth';
import { getProductSyncService, getOrderSyncService } from '../../sync';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const router = express.Router();

// Get all sales for reports and history
router.get('/', async (_req, res) => {
  try {
    if (!db) {
      // Cloud fallback — read directly from Supabase so Render can show sales history
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Supabase not configured' });
      }
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      try {
        const { data, error } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.json(Array.isArray(data) ? data : []);
      } catch (e: any) {
        return res.status(500).json({ error: String(e) });
      }
    }

    const sales = db.prepare(`
      SELECT s.*, u.full_name as user_name 
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `).all();
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// Checkout logic: Convert Order to Sale
router.post('/checkout', requirePermission('PROCESS_PAYMENTS'), async (_req, res) => {
  const { order_id, payment_method: rawPaymentMethod, user_id: bodyUserId, discount = 0, tax = 0, items: requestItems } = _req.body;

  // Ensure user_id is present (not-null constraint)
  const user_id = bodyUserId || (_req as any).user?.id || 1;

  // Normalize to the exact values allowed by the DB CHECK constraint
  const allowed = ['cash', 'card', 'mobile_money'] as const;
  let payment_method = (rawPaymentMethod || 'cash').toString().toLowerCase().trim();
  if (!allowed.includes(payment_method as any)) {
    payment_method = 'cash';
  }

  console.log('[Sales] Checkout request:', { order_id, payment_method, user_id, discount, tax, itemsCount: Array.isArray(requestItems) ? requestItems.length : 'none' });

  // Cloud mode guard: db might be null (SQLite disabled)
  if (!db) {
    console.log('[Sales] SQLite disabled (db is null) — falling back to Supabase for checkout');
    try {
      const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        console.error('[Sales] Supabase config missing for cloud checkout');
        return res.status(500).json({ error: 'Supabase not configured' });
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
      
      // 1. Fetch order details from Supabase
      const { data: supaOrder, error: supaErr } = await supabase
        .from('orders')
        .select('id, status, table_id, waiter_id, items, total')
        .eq('id', order_id)
        .single();

      if (supaErr || !supaOrder) {
        console.error(`[Sales] Order ${order_id} not found in Supabase`, supaErr);
        return res.status(404).json({ error: 'Order not found in Supabase' });
      }

      // 2. Generate a unique invoice number (NOT NULL constraint)
      const invoiceNumber = `INV-${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 100)}`;
      console.log(`[Sales] Generated invoice number: ${invoiceNumber} for order ${order_id}`);

      const subtotal = Number((supaOrder as any).total || 0);
      const total_amount = subtotal - Number(discount) + Number(tax);

      // 3. Create the sale record
      const { data: saleData, error: saleErr } = await supabase
        .from('sales')
        .insert({
          invoice_number: invoiceNumber,
          order_id,
          user_id,
          payment_method,
          subtotal,
          discount: Number(discount),
          tax: Number(tax),
          total_amount,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (saleErr) {
        console.error('[Sales] Supabase sale insert failed:', saleErr);
        throw saleErr;
      }

      console.log(`[Sales] Sale ${saleData.id} created successfully in Supabase`);

      // 4. Insert sale items
      const items = Array.isArray(supaOrder.items) ? supaOrder.items : [];
      if (items.length > 0) {
        const saleItems = items.map((it: any) => ({
          sale_id: saleData.id,
          product_id: it.product_id || it.productId,
          quantity: Number(it.quantity) || 0,
          unit_price: Number(it.price || it.unit_price || 0),
          total_price: (Number(it.quantity) || 0) * Number(it.price || it.unit_price || 0)
        }));
        
        const { error: itemsErr } = await supabase.from('sale_items').insert(saleItems);
        if (itemsErr) console.warn('[Sales] Failed to insert sale items in Supabase:', itemsErr);
      }

      // 5. Update order status to paid
      await supabase.from('orders').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', order_id);

      return res.json({
        saleId: saleData.id,
        invoiceNumber: saleData.invoice_number || invoiceNumber,
        partial: false,
        blockedItems: [],
        soldItems: items,
        saleTotal: saleData.total_amount
      });
    } catch (err: any) {
      console.error('[Sales] Supabase checkout failed:', err?.message || err);
      return res.status(500).json({ error: err?.message || 'Failed to checkout via Supabase' });
    }
  }

  // ── Variables captured by the transaction closure (SQLite path) ──────────────────
  let invoiceNumber = '';
  let subtotal      = 0;
  let saleId: number = 0;
  let order: Record<string, any> = {};
  let itemsForNotify: Array<{ name: string; qty: number; price: number; totalPrice: number }> = [];

  const transaction = db.transaction(() => {
    try {
      order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id) as any;
      console.log('[Sales] Found order:', order);
      if (!order) throw new Error('Order not found');
      if (order.status === 'paid') throw new Error('Order already finalized');

      const isRemoteQrOrder = !!order.remote_id;   // orders pulled from Supabase via the QR pull worker

      let items: any[] = Array.isArray(requestItems) ? requestItems : [];

      if (items.length === 0) {
        if (isRemoteQrOrder) {
          // For remote QR orders, lock to the exact snapshot that was pulled from Supabase.
          const raw = JSON.parse(order.items || '[]');
          items = raw.map((it: any) => {
            const pid = it.product_id || it.productId;
            const prod = db.prepare('SELECT selling_price FROM products WHERE id = ?').get(pid) as any;
            return {
              productId: pid,
              quantity: Number(it.quantity) || 0,
              name: it.name || '',
              price: Number(it.price || it.unit_price || prod?.selling_price || 0),
              notes: it.notes || null
            };
          });
        } else {
          items = db.prepare(`
            SELECT
              oi.product_id AS productId,
              p.name AS name,
              oi.quantity,
              oi.unit_price AS price,
              oi.total_price,
              oi.notes,
              p.buying_price
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
          `).all(order_id) as any[];
        }
      }

      if (!items || items.length === 0) throw new Error('No items in order');

      subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

      // Verify stock
      const fulfilledItems: any[] = [];
      const blockedItems: any[]   = [];

      for (const item of items) {
        const product = db.prepare('SELECT stock_quantity, buying_price FROM products WHERE id = ?').get(item.productId) as any;
        const requested = Number(item.quantity);
        const available = Number(product?.stock_quantity || 0);

        if (available >= requested) {
          fulfilledItems.push({ ...item, quantity: requested, product });
        } else {
          fulfilledItems.push({ ...item, quantity: available, product });
          blockedItems.push({ ...item, quantity: requested - available, notes: item.notes ?? null });
        }
      }

      const fulfilledSubtotal = fulfilledItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

      if (fulfilledSubtotal <= 0) {
        const blockedNames = blockedItems.map(item => item.name).join(', ');
        throw new Error(`Insufficient stock for ${blockedNames}`);
      }

      const saleDiscount = discount && subtotal > 0 ? Math.round((fulfilledSubtotal / subtotal) * discount) : 0;
      const saleTax = tax && subtotal > 0 ? Math.round((fulfilledSubtotal / subtotal) * tax) : 0;
      const saleTotal = fulfilledSubtotal - saleDiscount + saleTax;

      itemsForNotify = fulfilledItems.map((item: any) => ({
        name: item.name,
        qty: Number(item.quantity),
        price: Number(item.price),
        totalPrice: Number(item.price) * Number(item.quantity),
      }));

      // Short invoice number
      invoiceNumber = `INV-${String(Date.now()).slice(-5)}${Math.floor(Math.random() * 10)}`;

      const saleStmt = db.prepare(`
        INSERT INTO sales (invoice_number, order_id, user_id, subtotal, discount, tax, total_amount, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const saleResult = saleStmt.run(
        invoiceNumber,
        order_id,
        user_id,
        fulfilledSubtotal,
        saleDiscount,
        saleTax,
        saleTotal,
        payment_method
      );
      saleId = Number(saleResult.lastInsertRowid);

      const itemStmt = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?)
      `);

      const movementStmt = db.prepare(`
        INSERT INTO inventory_movements (
          product_id, movement_type, 
          quantity_before, quantity_changed, quantity_after,
          unit_cost, total_value,
          reason, created_by, reference_type, reference_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of fulfilledItems) {
        const quantityBefore = Number(item.product.stock_quantity ?? 0);
        const quantityChanged = -Number(item.quantity);
        const quantityAfter = quantityBefore + quantityChanged;
        const unitCost = Number(item.product.buying_price ?? 0);
        const totalValue = Number(item.quantity) * unitCost;

        itemStmt.run(saleId, item.productId, item.quantity, item.price, item.price * item.quantity);
        
        movementStmt.run(
          item.productId,
          'sale',
          quantityBefore,
          quantityChanged,
          quantityAfter,
          unitCost,
          totalValue,
          `Sale #${saleId}`,
          user_id,
          'sale',
          saleId
        );

        db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(quantityAfter, item.productId);
        
        // Sync product stock
        getProductSyncService().queueChangeInsideTransaction('product', 'update', {
          id: item.productId,
          stock_quantity: quantityAfter
        });
      }

      let remainingOrder: any = null;
      if (blockedItems.length > 0) {
        const remainingTotal = blockedItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

        db.prepare(`
          UPDATE orders
          SET items = ?, total = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(JSON.stringify(blockedItems), remainingTotal, order_id);

        // Queue old items for deletion in sync
        try {
          const oldItems = db.prepare('SELECT id FROM order_items WHERE order_id = ?').all(order_id) as { id: number }[];
          const sync = getProductSyncService();
          for (const item of oldItems) {
            sync.queueChangeInsideTransaction('order_item', 'delete', { id: item.id });
          }
        } catch (e) {
          console.warn('[Sales] Failed to queue item deletions for sync:', e);
        }

        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(order_id);
        const orderItemStmt = db.prepare(`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const item of blockedItems) {
          orderItemStmt.run(order_id, item.productId, item.quantity, item.price, item.price * item.quantity, item.notes ?? null);
        }

        remainingOrder = {
          id: order_id,
          table_id: order.table_id,
          waiter_id: order.waiter_id,
          status: order.status,
          items: blockedItems,
          total: remainingTotal,
          discount: order.discount,
          tax: order.tax
        };

        // Queue order update for sync
        try {
          const itemsWithIds = db.prepare(`
            SELECT id, product_id as productId, quantity, unit_price as price, notes 
            FROM order_items WHERE order_id = ?
          `).all(order_id);
          getOrderSyncService().queueOrderChange('update', { ...remainingOrder, items: itemsWithIds }, 'default-business');
        } catch (e) {
          console.warn('[Sales] Failed to queue partial order update for sync:', e);
        }
      } else {
        db.prepare("UPDATE orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order_id);
        
        // Queue sync
        try {
          const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
          getOrderSyncService().queueOrderChange('update', updatedOrder, 'default-business');
        } catch (e) {
          console.warn('[Sales] Failed to queue order paid status for sync:', e);
        }
      }

      return {
        saleId,
        invoiceNumber,
        partial: blockedItems.length > 0,
        blockedItems,
        soldItems: fulfilledItems,
        saleTotal
      };
    } catch (error) {
      throw error;
    }
  });

  try {
    const result = transaction();

    // Send notifications after transaction
    try {
      const tableLabel = order.table_id ? `Table ${order.table_number || order.table_id}` : 'Counter';
      setImmediate(async () => {
        try {
          const { loadRawSettings, notifyOrderCheckout } = require('../services/notification.service');
          const rawSettings = loadRawSettings();
          await notifyOrderCheckout(
            order_id,
            itemsForNotify,
            result.saleTotal,
            payment_method,
            tableLabel,
            order.waiter_name,
            undefined,
            'USD',
            rawSettings
          );
        } catch (err) {
          console.error('[Sales] Notification failed:', err);
        }
      });
    } catch (err) {
      console.warn('[Sales] Async notification setup failed:', err);
    }

    res.json(result);
  } catch (error: any) {
    console.error('[Sales] Transaction error:', error);
    res.status(500).json({ error: error.message || 'Checkout failed' });
  }
});

export default router;
