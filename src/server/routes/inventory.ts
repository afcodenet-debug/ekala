import express from 'express';
import db from '../db/database';
import { notifyStockAdjustment, loadRawSettings } from '../services/notification.service';
import { env } from '../config/env';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
// const router = express.Router();

// Get stock levels for dashboard
router.get('/stock-levels', async (req: any, res) => {
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
  // Cloud mode: read from Supabase
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from('products')
      .select('id, name, stock_quantity, minimum_stock')
      .eq('is_available', true)
      .eq('tenant_id', tenantId);
    
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
      WHERE is_available = 1 AND tenant_id = ?
    `).all(tenantId) as any[];

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
router.get('/', async (req: any, res) => {
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
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
        .eq('tenant_id', tenantId)
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
      WHERE p.is_available = 1 AND p.tenant_id = ?
      ORDER BY p.name ASC
    `).all(tenantId);
    res.json(items);
  } catch (error) {
    console.error('[INVENTORY_ROUTE_ERROR] Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Update stock manually with movement logging
router.patch('/:id/stock', (req: any, res) => {
  const { quantity, movement_type = 'adjustment', reason = 'Manual stock adjustment', user_id } = req.body;
  const { id } = req.params;
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  if (quantity === undefined || Number.isNaN(Number(quantity))) {
    return res.status(400).json({ error: 'Quantity must be a valid number' });
  }

  if (!db) {
    return res.status(501).json({ error: 'Manual stock adjustment not supported in Cloud Mode via this endpoint yet.' });
  }

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
      'SELECT stock_quantity, buying_price, name FROM products WHERE id = ? AND tenant_id = ?'
    ).get(id, tenantId) as any;
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
      WHERE id = ? AND tenant_id = ?
    `).run(qtyAfter, id, tenantId);

    try {
      const { getProductSyncService } = require('../../sync');
      getProductSyncService()?.queueChangeInsideTransaction('product', 'update', {
        id: Number(id),
        stock_quantity: qtyAfter,
        updated_at: new Date().toISOString(),
        tenant_id: tenantId
      });
    } catch (syncErr) {
      console.warn('[Sync] Could not queue stock adjustment for sync:', syncErr);
    }

    const movementResult = db.prepare(`
      INSERT INTO inventory_movements (
        product_id, movement_type,
        quantity_before, quantity_changed, quantity_after,
        unit_cost, total_value,
        reason, created_by, reference_type,
        tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      'manual',
      tenantId
    );

    // Queue inventory movement for sync
    try {
      const { syncAfterWrite } = require('../../sync/sync-helper');
      syncAfterWrite('inventory_movement', 'insert', {
        id: movementResult.lastInsertRowid,
        product_id: Number(id),
        movement_type,
        quantity_before: qtyBefore,
        quantity_changed: qtyChanged,
        quantity_after: qtyAfter,
        unit_cost: unitCost,
        total_value: totalValue,
        reason,
        created_by: user_id ?? null,
        reference_type: 'manual',
        tenant_id: tenantId
      });
    } catch (syncErr) {
      console.warn('[Inventory] Could not queue movement sync:', syncErr);
    }

    return db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').get(id, tenantId);
  });

  try {
    const updated = transaction();
    res.json(updated);

    setImmediate(async () => {
      try {
        // Use loadRawSettings so defaults (app_language, app_currency) and
        // the tenant fallback are applied consistently with the rest of the app.
        const rawSettings = loadRawSettings(tenantId);
        await notifyStockAdjustment(
          notifyPayload.productName, Number(id),
          notifyPayload.qtyBefore, notifyPayload.qtyChanged, notifyPayload.qtyAfter,
          notifyPayload.reason,
          notifyPayload.performedBy,
          String(rawSettings.app_currency || 'ZMW'),
          rawSettings,
          tenantId,
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

router.get('/movements', async (req: any, res) => {
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
  try {
    const productId = req.query.product_id ? parseInt(req.query.product_id as string) : null;
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit as string) || 50));

    // Prefer the local SQLite database (the source of truth in local /
    // runtime mode). Stock adjustments live there and may not yet be
    // mirrored to Supabase, so reading from Supabase alone hides
    // adjustment movements from the Stock History view.
    // Only fall back to Supabase when the local DB is unavailable
    // (pure cloud mode).
    if (!db) {
      if (!(env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS) || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.json([]);
      }
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

      let queryBuilder = supabase
        .from('inventory_movements')
        .select('*, products(name, barcode)')
        .eq('tenant_id', tenantId)
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

    let query = `
      SELECT m.*, p.name as product_name, p.barcode
      FROM inventory_movements m
      LEFT JOIN products p ON m.product_id = p.id
      WHERE m.tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (productId) {
      query += ` AND m.product_id = ?`;
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
