import express from 'express';
import db from '../db/database';
import { notifyStockAdjustment } from '../services/notification.service';
import { env } from '../config/env';
import { createClient } from '@supabase/supabase-js';
// import { syncService } from '../sync';

const router = express.Router();

// Get stock levels for dashboard
router.get('/stock-levels', async (req, res) => {
  // Cloud mode: read from Supabase
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from('products')
      .select('id, name, stock_quantity, minimum_stock')
      .eq('is_available', true);
    
    if (error) return res.status(500).json({ error: error.message });
    
    const items = data || [];
    const lowStock = items.filter((item: any) => item.stock_quantity <= item.minimum_stock);

    return res.json({
      totalItems: items.length,
      lowStockItems: lowStock.length,
      stockLevels: items
    });
  }

  try {
    const items = db.prepare(`
      SELECT id, name, stock_quantity, minimum_stock
      FROM products
      WHERE is_available = 1
    `).all() as any[];

    const lowStock = items.filter((item: any) => item.stock_quantity <= item.minimum_stock);

    res.json({
      totalItems: items.length,
      lowStockItems: lowStock.length,
      stockLevels: items
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock levels' });
  }
});

// Get all products (legacy /api/inventory compatibility)
router.get('/', async (req, res) => {
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS) {
    try {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Supabase not configured' });
      }
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data, error } = await supabase
        .from('products')
        .select('id, name, barcode, price:selling_price, quantity:stock_quantity, categories(name), created_at, updated_at')
        .eq('is_available', true)
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      const items = (data || []).map((p: any) => ({
        ...p,
        category: p.categories?.name,
        categories: undefined
      }));
      return res.json(items);
    } catch (error) {
      console.error('[INVENTORY_ROUTE_ERROR] Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch inventory' });
    }
  }

  try {
    const items = db.prepare(`
      SELECT p.id, p.name, p.barcode, p.selling_price as price, p.stock_quantity as quantity,
             c.name as category, p.created_at, p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_available = 1
      ORDER BY p.name ASC
    `).all();
    res.json(items);
  } catch (error) {
    console.error('[INVENTORY_ROUTE_ERROR] Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Update stock manually with movement logging
router.patch('/:id/stock', (req, res) => {
  const { quantity, movement_type = 'adjustment', reason = 'Manual stock adjustment', user_id } = req.body;
  const { id } = req.params;

  if (quantity === undefined || Number.isNaN(Number(quantity))) {
    return res.status(400).json({ error: 'Quantity must be a valid number' });
  }

  // Cloud mode: Not implemented yet for PATCH via direct route (should use sync or dedicated service)
  if (!db) {
    return res.status(501).json({ error: 'Manual stock adjustment not supported in Cloud Mode via this endpoint yet.' });
  }

  // ── Snapshot captured by the transaction closure ──────────────────
  let notifyPayload: {
    productName: string;
    qtyBefore:   number;
    qtyChanged:  number;
    qtyAfter:    number;
    reason:      string;
    performedBy: string | undefined;
  } = {
    productName: `#${id}`,
    qtyBefore:   0,
    qtyChanged:  0,
    qtyAfter:    0,
    reason,
    performedBy: user_id != null ? String(user_id) : undefined,
  };

  const transaction = db.transaction(() => {
    const productRow = db.prepare(
      'SELECT stock_quantity, buying_price, name FROM products WHERE id = ?'
    ).get(id) as any;
    if (!productRow) throw new Error('Product not found');

    const qtyBefore = productRow.stock_quantity ?? 0;
    const qtyChanged = Number(quantity);
    const qtyAfter   = qtyBefore + qtyChanged;
    const unitCost   = productRow.buying_price ?? 0;
    const totalValue = Math.abs(qtyChanged) * unitCost;

    if (productRow.name) notifyPayload.productName = productRow.name;
    notifyPayload.qtyBefore  = qtyBefore;
    notifyPayload.qtyChanged = qtyChanged;
    notifyPayload.qtyAfter   = qtyAfter;

    db.prepare(`
      UPDATE products
      SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP, version = version + 1
      WHERE id = ?
    `).run(qtyAfter, id);

    // Queue for sync
    try {
      const { getProductSyncService } = require('../../sync');
      getProductSyncService().queueChangeInsideTransaction('product', 'update', {
        id: Number(id),
        stock_quantity: qtyAfter,
        updated_at: new Date().toISOString()
      });
    } catch (syncErr) {
      console.warn('[Sync] Could not queue stock adjustment for sync:', syncErr);
    }

    db.prepare(`
      INSERT INTO inventory_movements (
        product_id, movement_type,
        quantity_before, quantity_changed, quantity_after,
        unit_cost, total_value,
        reason, created_by, reference_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      movement_type,
      qtyBefore,
      qtyChanged,
      qtyAfter,
      unitCost,
      totalValue,
      reason,
      user_id ?? null,
      'manual'
    );

    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  });

  try {
    const updated = transaction();
    res.json(updated);

    // ── Fire-and-forget: email notification (non-blocking) ──────────
    setImmediate(async () => {
      try {
        const settingsRows = db.prepare(
          "SELECT key, value FROM settings"
        ).all() as { key: string; value: string }[];
        const rawSettings = Object.fromEntries(
          settingsRows.map(r => [r.key, r.value])
        );
        await notifyStockAdjustment(
          notifyPayload.productName, Number(id),
          notifyPayload.qtyBefore, notifyPayload.qtyChanged, notifyPayload.qtyAfter,
          notifyPayload.reason,
          notifyPayload.performedBy,
          String(rawSettings.app_currency || 'USD'),
          rawSettings,
        );
      } catch (notifyErr) {
        console.error('[Notification] email failed:', notifyErr);
      }
    });
  } catch (error: any) {
    console.error('[INVENTORY_ROUTE_ERROR]', error);
    if (error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// ─── Professional Inventory History ───────────────────────────────────
// GET /inventory/movements — unified stock movement log
// Query params: ?product_id=123&limit=50
router.get('/movements', async (req, res) => {
  try {
    const productId = req.query.product_id ? parseInt(req.query.product_id as string) : null;
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit as string) || 50));

    // Cloud mode: read from Supabase
    if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Supabase not configured' });
      }
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      
      let queryBuilder = supabase
        .from('inventory_movements')
        .select('*, products(name, barcode)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (productId) {
        queryBuilder = queryBuilder.eq('product_id', productId);
      }

      const { data, error } = await queryBuilder;
      
      if (error) throw error;
      
      const movements = (data || []).map((m: any) => ({
        ...m,
        product_name: m.products?.name,
        barcode: m.products?.barcode,
        products: undefined
      }));
      
      return res.json(movements);
    }

    if (!db) {
      return res.json([]);
    }

    let query = `
      SELECT m.*, p.name as product_name, p.barcode
      FROM inventory_movements m
      LEFT JOIN products p ON m.product_id = p.id
    `;
    const params: any[] = [];

    if (productId) {
      query += ` WHERE m.product_id = ?`;
      params.push(productId);
    }

    query += ` ORDER BY m.created_at DESC LIMIT ?`;
    params.push(limit);

    const movements = db.prepare(query).all(...params);
    res.json(movements);
  } catch (error) {
    console.error('Error fetching movements:', error);
    res.status(500).json({ error: 'Failed to fetch inventory movements' });
  }
});

export default router;
