import express from 'express';
import db from '../db/database';
import { notifyOrderCheckout } from '../services/notification.service';
import { requirePermission } from '../middleware/auth';
import { getProductSyncService, getOrderSyncService, getOrchestratorV2 } from '../../sync';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { dataSource } from '../infrastructure/data-source-manager';

const router = express.Router();

// Get all sales for reports and history
router.get('/', async (req: any, res) => {
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
  try {
    if (!db) {
      // Cloud fallback — read directly from Supabase so Render can show sales history
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Supabase not configured' });
      }
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      try {
        const { data, error } = await supabase.from('sales').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
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
      WHERE s.tenant_id = ?
      ORDER BY s.created_at DESC
    `).all(tenantId);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// =============================================================================
// Cloud Checkout Handler (Supabase) — Extracted to avoid db.prepare() before
// cloud mode detection. En cloud mode (RENDER_CLOUD_MODE=true), le default
// export de database.ts est un Proxy/fonction qui n'a PAS de méthode .prepare().
// =============================================================================
async function handleCloudCheckout(
  req: any,
  res: any,
  normalizedOrderId: number,
  normalizedUserId: number | null,
  rawPaymentMethod: string | undefined,
  discount: number,
  tax: number,
  requestItems: any[] | undefined
) {
  let tenantId = req.tenant_id;
  let user_id = normalizedUserId || req.user?.sub || 1;

  console.log(`[Sales] Cloud mode. Using Supabase for checkout (tenant=${tenantId})`);
  try {
    const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error('[Sales] Supabase config missing for cloud checkout');
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    
    // 1. Fetch order details from Supabase
    console.log(`[Sales] Fetching order ${normalizedOrderId} from Supabase...`);
    const { data: supaOrder, error: supaErr } = await supabase
      .from('orders')
      .select('id, status, table_id, waiter_id, items, total')
      .eq('id', normalizedOrderId)
      .eq('tenant_id', tenantId)
      .single();

    if (supaErr || !supaOrder) {
      console.error(`[Sales] Order ${normalizedOrderId} not found in Supabase for tenant ${tenantId}`, supaErr);
      return res.status(404).json({ error: 'Order not found in Supabase', details: supaErr?.message });
    }

    console.log(`[Sales] Order found:`, { id: supaOrder.id, status: supaOrder.status, total: supaOrder.total });

    // 2. Generate a unique invoice number (NOT NULL constraint)
    const invoiceNumber = `INV-${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 100)}`;
    console.log(`[Sales] Generated invoice number: ${invoiceNumber} for order ${normalizedOrderId}`);

    const subtotal = Number((supaOrder as any).total || 0);
    const total_amount = subtotal - Number(discount) + Number(tax);

    // 3. Create the sale record
    console.log(`[Sales] Creating sale in Supabase...`);
    const { data: saleData, error: saleErr } = await supabase
      .from('sales')
      .insert({
        invoice_number: invoiceNumber,
        order_id: normalizedOrderId,
        user_id: user_id,
        payment_method: rawPaymentMethod || 'cash',
        subtotal,
        discount: Number(discount),
        tax: Number(tax),
        total_amount,
        tenant_id: tenantId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saleErr) {
      console.error('[Sales] Supabase sale insert failed:', saleErr);
      return res.status(500).json({ 
        error: 'Failed to create sale in Supabase', 
        details: saleErr.message,
        code: saleErr.code,
        hint: saleErr.hint
      });
    }

    console.log(`[Sales] Sale ${saleData.id} created successfully in Supabase`);

    // 4. Insert sale items
    const rawItems = typeof supaOrder.items === 'string' ? JSON.parse(supaOrder.items) : (supaOrder.items || []);
    const items = Array.isArray(rawItems) ? rawItems : [];
    console.log(`[Sales] Processing ${items.length} sale items...`);
    
    if (items.length > 0) {
      const saleItems = items.map((it: any) => ({
        sale_id: saleData.id,
        product_id: it.product_id || it.productId,
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.price || it.unit_price || 0),
        total_price: (Number(it.quantity) || 0) * Number(it.price || it.unit_price || 0),
        tenant_id: tenantId
      }));
      
      const { error: itemsErr } = await supabase.from('sale_items').insert(saleItems);
      if (itemsErr) {
        console.error('[Sales] Failed to insert sale items in Supabase:', itemsErr);
        // Don't fail the whole checkout if items fail
      } else {
        console.log(`[Sales] ${saleItems.length} sale items inserted successfully`);
      }
    }

    // 5. Update order status to paid
    console.log(`[Sales] Updating order ${normalizedOrderId} status to paid...`);
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', normalizedOrderId)
      .eq('tenant_id', tenantId);
    
    if (updateErr) {
      console.error('[Sales] Failed to update order status:', updateErr);
    } else {
      console.log(`[Sales] Order ${normalizedOrderId} marked as paid`);
    }

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
    console.error('[Sales] Error stack:', err?.stack);
    return res.status(500).json({ 
      error: err?.message || 'Failed to checkout via Supabase',
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    });
  }
}

// Checkout logic: Convert Order to Sale
router.post('/checkout', requirePermission('PROCESS_PAYMENTS'), async (req: any, res) => {
  const { order_id, payment_method: rawPaymentMethod, user_id: bodyUserId, discount = 0, tax = 0, items: requestItems } = req.body;

  // Normalize numeric IDs from request body to prevent float strings like "3.0"
  const normalizeId = (value: any): number | null => {
    if (value === undefined || value === null) return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.trunc(num);
  };
  
  const normalizedOrderId = normalizeId(order_id);
  const normalizedUserId = bodyUserId ? normalizeId(bodyUserId) : null;
  
  // VALIDATION: Ensure we have a valid order_id
  if (normalizedOrderId === null) {
    return res.status(400).json({ error: 'Invalid order_id - must be a valid number' });
  }

  // ===== Mode Cloud (Supabase) — VÉRIFIÉ EN PREMIER avant tout accès SQLite =====
  // CRITIQUE: dataSource.isCloudMode() DOIT être appelé avant tout db.prepare()
  // car en cloud mode (RENDER_CLOUD_MODE=true), db est un Proxy/fonction sans .prepare()
  if (dataSource.isCloudMode()) {
    return await handleCloudCheckout(req, res, normalizedOrderId, normalizedUserId, rawPaymentMethod, discount, tax, requestItems);
  }

  // ===== Mode Local (SQLite) =====
  // Resolve tenantId and user_id to local IDs to prevent FK failures
  let tenantId = req.tenant_id;
  let user_id = normalizedUserId || req.user?.sub || 1;

  // 1. Resolve tenantId: if current tenantId doesn't exist in 'tenants' table, try finding a valid one
  try {
    const validTenant = db ? db.prepare('SELECT id FROM tenants WHERE id = ?').get(tenantId) : null;
    if (db && !validTenant) {
      const fallbackTenant = db.prepare('SELECT id FROM tenants LIMIT 1').get() as { id: number } | undefined;
      if (fallbackTenant) {
        console.log(`[Sales] Current tenant_id ${tenantId} not found in tenants table. Falling back to ${fallbackTenant.id}`);
        tenantId = fallbackTenant.id;
      }
    }
  } catch (e) {
    console.warn('[Sales] Tenant resolution failed:', e);
  }

  // 2. Resolve user_id: if user_id doesn't exist in 'users' table, check if it's a remote_id
  try {
    const validUser = db ? db.prepare('SELECT id FROM users WHERE id = ?').get(user_id) : null;
    if (db && !validUser) {
      const remoteUser = db.prepare('SELECT id FROM users WHERE remote_id = ?').get(user_id) as { id: number } | undefined;
      if (remoteUser) {
        console.log(`[Sales] user_id ${user_id} not found as local ID, but found as remote_id. Using local id ${remoteUser.id}`);
        user_id = remoteUser.id;
      } else {
        // Last resort: use the first admin or user ID 1
        const firstUser = db.prepare('SELECT id FROM users WHERE role = "admin" OR is_active = 1 LIMIT 1').get() as { id: number } | undefined;
        user_id = firstUser?.id || 1;
      }
    }
  } catch (e) {
    console.warn('[Sales] User resolution failed:', e);
  }

  // Normalize to the exact values allowed by the DB CHECK constraint
  const allowed = ['cash', 'card', 'mobile_money'] as const;
  let payment_method = (rawPaymentMethod || 'cash').toString().toLowerCase().trim();
  if (!allowed.includes(payment_method as any)) {
    payment_method = 'cash';
  }

  console.log('[Sales] Checkout request:', { order_id: normalizedOrderId, payment_method, user_id, discount, tax, itemsCount: Array.isArray(requestItems) ? requestItems.length : 'none' });

  // ── Variables captured by the transaction closure (SQLite path) ──────────────────
  let invoiceNumber = '';
  let subtotal      = 0;
  let saleId: number = 0;
  let order: Record<string, any> = {};
  let itemsForNotify: Array<{ name: string; qty: number; price: number; totalPrice: number }> = [];

  const transaction = db.transaction(() => {
    try {
      order = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(normalizedOrderId, tenantId) as any;
      console.log('[Sales] Found order:', order);
      if (!order) throw new Error('Order not found');
      if (order.status === 'paid') throw new Error('Order already finalized');

      const isRemoteQrOrder = order.source === 'qr';   // orders pulled from Supabase via the QR pull worker

      let items: any[] = Array.isArray(requestItems) ? requestItems : [];

      if (items.length === 0) {
        if (isRemoteQrOrder) {
          // For remote QR orders, lock to the exact snapshot that was pulled from Supabase.
          const raw = JSON.parse(order.items || '[]');
          items = raw.map((it: any) => {
            const pid = it.product_id || it.productId;
            
            // Pro-active ID resolution: check if it's a local ID first, then try remote_id
            let localProd = db.prepare('SELECT id, selling_price FROM products WHERE id = ? AND tenant_id = ?').get(pid, tenantId) as any;
            if (!localProd) {
              localProd = db.prepare('SELECT id, selling_price FROM products WHERE remote_id = ? AND tenant_id = ?').get(pid, tenantId) as any;
              if (localProd) {
                console.log(`[Sales] Resolved remote product_id ${pid} to local id ${localProd.id}`);
              }
            }
            
            return {
              productId: localProd ? localProd.id : pid,
              quantity: Number(it.quantity) || 0,
              name: it.name || '',
              price: Number(it.price || it.unit_price || localProd?.selling_price || 0),
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
            WHERE oi.order_id = ? AND oi.tenant_id = ?
          `).all(normalizedOrderId, tenantId) as any[];
        }
      }

      if (!items || items.length === 0) throw new Error('No items in order');

      subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

      // Verify stock
      const fulfilledItems: any[] = [];
      const blockedItems: any[]   = [];

      for (const item of items) {
        const product = db.prepare('SELECT stock_quantity, buying_price FROM products WHERE id = ? AND tenant_id = ?').get(item.productId, tenantId) as any;
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

      // DYNAMIC SCHEMA FIX: Check if legacy 'total' column exists and is NOT NULL
      const tableInfo = db.prepare("PRAGMA table_info(sales)").all() as any[];
      const hasLegacyTotal = tableInfo.some(c => c.name === 'total');
      
      let saleStmt;
      if (hasLegacyTotal) {
        saleStmt = db.prepare(`
          INSERT INTO sales (invoice_number, order_id, user_id, subtotal, discount, tax, total_amount, total, payment_method, tenant_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
      } else {
        saleStmt = db.prepare(`
          INSERT INTO sales (invoice_number, order_id, user_id, subtotal, discount, tax, total_amount, payment_method, tenant_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
      }

      const saleParams = [
        invoiceNumber,
        normalizedOrderId,
        user_id,
        fulfilledSubtotal,
        saleDiscount,
        saleTax,
        saleTotal,
      ];

      if (hasLegacyTotal) {
        saleParams.push(saleTotal); // Provide value for legacy 'total' column
      }
      saleParams.push(payment_method);
      saleParams.push(tenantId);

      const saleResult = saleStmt.run(...saleParams);
      saleId = Number(saleResult.lastInsertRowid);

      // --- SYNC INTEGRATION ---
      try {
        const { getProductSyncService } = require('../../sync/index');
        const coreSync = getProductSyncService();

        // Prepare sale record for outbox
        const saleForSync = {
          id: saleId,
          invoice_number: invoiceNumber,
          order_id: normalizedOrderId,
          user_id,
          subtotal: fulfilledSubtotal,
          discount: saleDiscount,
          tax: saleTax,
          total_amount: saleTotal,
          payment_method,
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tenant_id: tenantId
        };

        // Prepare sale items for outbox
        const saleItemsForSync = fulfilledItems.map((item: any) => ({
          sale_id: saleId,
          product_id: item.productId,
          quantity: Number(item.quantity),
          unit_price: Number(item.price),
          total_price: Number(item.price) * Number(item.quantity),
          tenant_id: tenantId
        }));

        // Use coreSync to queue the changes
        db.transaction(() => {
          coreSync.queueChangeInsideTransaction('sale', 'insert', saleForSync);
          for (const sItem of saleItemsForSync) {
            coreSync.queueChangeInsideTransaction('sale_item', 'insert', sItem);
          }
        })();
        console.log(`[Sales] Sale ${saleId} and its items queued for sync`);
      } catch (syncErr) {
        console.error('[Sales] Failed to queue sale for sync:', syncErr);
        // Don't fail the checkout if sync queuing fails
      }
      // --- END SYNC INTEGRATION ---

      const itemStmt = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const movementStmt = db.prepare(`
        INSERT INTO inventory_movements (
          product_id, movement_type, 
          quantity_before, quantity_changed, quantity_after,
          unit_cost, total_value,
          reason, created_by, reference_type, reference_id,
          tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of fulfilledItems) {
        const quantityBefore = Number(item.product.stock_quantity ?? 0);
        const quantityChanged = -Number(item.quantity);
        const quantityAfter = quantityBefore + quantityChanged;
        const unitCost = Number(item.product.buying_price ?? 0);
        const totalValue = Number(item.quantity) * unitCost;

        itemStmt.run(saleId, item.productId, item.quantity, item.price, item.price * item.quantity, tenantId);
        
        const saleReferenceId = Math.trunc(Number(saleId));

        const movementResult = movementStmt.run(
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
          saleReferenceId,
          tenantId
        );

        try {
          getOrchestratorV2().getGenericSync().queueChangeInsideTransaction('inventory_movement', 'insert', {
            id: Number(movementResult.lastInsertRowid),
            product_id: item.productId,
            movement_type: 'sale',
            quantity_before: quantityBefore,
            quantity_changed: quantityChanged,
            quantity_after: quantityAfter,
            unit_cost: unitCost,
            total_value: totalValue,
            reason: `Sale #${saleId}`,
            created_by: user_id,
            reference_type: 'sale',
            reference_id: Math.trunc(Number(saleReferenceId)),
            tenant_id: tenantId,
            version: 1,
          });
        } catch (syncErr) {
          console.warn('[Sales] Failed to queue inventory movement for sync:', syncErr);
        }

        db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ? AND tenant_id = ?').run(quantityAfter, item.productId, tenantId);
        
        // Sync product stock
        getProductSyncService().queueChangeInsideTransaction('product', 'update', {
          id: item.productId,
          stock_quantity: quantityAfter,
          tenant_id: tenantId
        });
      }

      let remainingOrder: any = null;
      if (blockedItems.length > 0) {
        const remainingTotal = blockedItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

        db.prepare(`
          UPDATE orders
          SET items = ?, total = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND tenant_id = ?
        `).run(JSON.stringify(blockedItems), remainingTotal, normalizedOrderId, tenantId);

        // Queue old items for deletion in sync
        try {
          const oldItems = db.prepare('SELECT id FROM order_items WHERE order_id = ? AND tenant_id = ?').all(normalizedOrderId, tenantId) as { id: number }[];
          const sync = getProductSyncService();
          for (const item of oldItems) {
            sync.queueChangeInsideTransaction('order_item', 'delete', { id: item.id, tenant_id: tenantId });
          }
        } catch (e) {
          console.warn('[Sales] Failed to queue item deletions for sync:', e);
        }

        db.prepare('DELETE FROM order_items WHERE order_id = ? AND tenant_id = ?').run(normalizedOrderId, tenantId);
        const orderItemStmt = db.prepare(`
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, notes, tenant_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of blockedItems) {
          orderItemStmt.run(normalizedOrderId, item.productId, item.quantity, item.price, item.price * item.quantity, item.notes ?? null, tenantId);
        }

        remainingOrder = {
          id: normalizedOrderId,
          table_id: order.table_id,
          waiter_id: order.waiter_id,
          status: order.status,
          items: blockedItems,
          total: remainingTotal,
          discount: order.discount,
          tax: order.tax,
          tenant_id: tenantId
        };

        // Queue order update for sync
        try {
          const itemsWithIds = db.prepare(`
            SELECT id, product_id as productId, quantity, unit_price as price, notes 
            FROM order_items WHERE order_id = ? AND tenant_id = ?
          `).all(normalizedOrderId, tenantId);
          getOrderSyncService().queueOrderChange('update', { ...remainingOrder, items: itemsWithIds }, String(tenantId));
        } catch (e) {
          console.warn('[Sales] Failed to queue partial order update for sync:', e);
        }
      } else {
        db.prepare("UPDATE orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").run(normalizedOrderId, tenantId);
        
        // Queue sync
        try {
          const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ? AND tenant_id = ?').get(normalizedOrderId, tenantId);
          getOrderSyncService().queueOrderChange('update', updatedOrder, String(tenantId));
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
            normalizedOrderId,
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