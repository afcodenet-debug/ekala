import express from 'express';
import path from 'path';
import db from '../db/database';
import { requireRole } from '../middleware/auth';
import fs from 'fs';
import { getProductSyncService, getOrchestratorV2 } from '../../sync';
import { AnalyticsService } from '../services/analytics.service';
import { notifyStockAdjustment, notifyNewProduct, loadRawSettings } from '../services/notification.service';
import { createNotification } from '../services/notification.repository';
import { env } from '../config/env';
import { dataSource } from '../infrastructure/data-source-manager';
import { productService } from '../products/services/product.service';
import { createClient } from '@supabase/supabase-js';
import { getRequestId, logTrace, runWithRequestId } from '../utils/trace-utils';

const router = express.Router();
const UPLOAD_DIR = path.resolve(process.cwd(), 'data', 'uploads', 'products');

// ─── Multipart Body Parser (zero extra dependency) ─────────────────────
interface BodyPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

function parseMultipart(buf: Buffer, boundary: string): BodyPart[] {
  const parts: BodyPart[] = [];
  const b = Buffer.from(`--${boundary}--`);
  const handlePart = (data: Buffer, name: string, filename?: string, contentType?: string) => {
    if (data.length > 0) {
      parts.push({ name, filename, contentType, data });
    }
  };
  let i = 0;
  while (i < buf.length) {
    const idx = buf.indexOf(b, i);
    const end = (idx === -1 ? buf.length : idx) - 4; // strip leading \r\n
    const slice = buf.slice(i, end);
    let pos = slice.indexOf(Buffer.from('\r\n\r\n'));
    if (pos === -1) pos = slice.indexOf(Buffer.from('\n\n'));
    if (pos === -1) { i = end + 4; continue; }
    const headersStr = slice.slice(0, pos).toString('utf-8');
    const contentData = slice.slice(pos + (slice[pos] === 0x0d ? 4 : 2));
    const nameM = headersStr.match(/name="([^"]+)"/);
    const filenameM = headersStr.match(/filename="([^"]+)"/);
    const typeM = headersStr.match(/Content-Type:\s*([^\r\n]+)/i);
    handlePart(contentData, nameM?.[1] || 'field', filenameM?.[1], typeM?.[1]?.trim());
    i = end + 4;
  }
  return parts;
}

function getBoundary(req: express.Request): string | null {
  const ct = req.headers['content-type'] || '';
  const m = ct.match(/boundary=([^;]+)/);
  return m ? m[1].replace(/^"|"$/g, '') : null;
}

// ─── Professional Analytics Endpoint ────────────────────────────────
// GET /products/analytics
// Must be declared BEFORE '/:id' route to avoid being captured as an ID
router.get('/analytics', async (_req, res) => {
  try {
    const data = await AnalyticsService.getInventoryAnalytics();
    res.json(data);
  } catch (error) {
    console.error('[Analytics] Failed to fetch:', error);
    res.status(500).json({ 
      error: 'Failed to fetch inventory analytics',
      valuation: { total_inventory_value: 0, potential_gross_profit: 0, actual_gross_profit: 0, active_skus: 0 },
      top_selling_products: [],
      low_stock_alerts: [],
      dead_stock: [],
      fast_moving_items: [],
      waste_analytics: [],
      stock_turnover_summary: []
    });
  }
});

// Get product by ID (with Supabase compat in cloud)
router.get('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const isSupabaseMode = dataSource.isTableCloud('products');
    const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

    if (!db && !isSupabaseMode) {
      console.warn('[Products] SQLite disabled (db is null). Returning 404 for /products/:id');
      return res.status(404).json({ error: 'Product not found (SQLite disabled)' });
    }

    if (isSupabaseMode) {
      const p = await productService.getProductById(id, String(tenantId)).catch(() => null as any);
      if (!p) return res.status(404).json({ error: 'Product not found' });

      let category_name: string | null = null;
      if (p.category_id && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
          const { data } = await supa.from('categories').select('name').eq('id', p.category_id).eq('tenant_id', tenantId).single();
          category_name = (data as any)?.name || null;
        } catch {}
      }

      return res.json({
        ...p,
        id: p.id,
        buying_price: p.cost_price != null ? Number(p.cost_price) : 0,
        selling_price: p.price != null ? Number(p.price) : 0,
        category_name,
        is_available: p.is_available ? 1 : 0,
      });
    }

    // legacy SQLite
    const product = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.tenant_id = ?
    `).get(id, tenantId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('[PRODUCTS_ROUTE_ERROR] Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create new product
router.post('/', requireRole(['admin', 'manager']), async (req: any, res) => {
  const requestId = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
  
  console.log(JSON.stringify({
    route: 'POST /api/products',
    file: 'src/server/routes/products.ts',
    line: 139,
    action: 'enter',
    requestId,
    headers: req.headers,
    body: req.body,
    user: req.user,
    tenantId: req.tenant_id
  }));
  
  return runWithRequestId(requestId, async () => {
    logTrace('ENTER products.ts:POST /');
    const isSupabaseMode = dataSource.isTableCloud('products');
    logTrace('CHOICE', { isSupabaseMode, tenantId: req.tenant_id, mode: dataSource.mode });
    const tenantId = parseInt(String(req.tenant_id), 10);
    if (!tenantId || isNaN(tenantId)) {
      console.log(JSON.stringify({
        route: 'POST /api/products',
        file: 'src/server/routes/products.ts',
        line: 148,
        status: 401,
        requestId,
        body: { error: 'TENANT_REQUIRED', message: 'tenant_id requis' }
      }));
      return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
    }

    if (isSupabaseMode) {
      logTrace('ENTER SupabaseRepository.create');
      try {
        const b = req.body || {};
        if (!b.name) return res.status(400).json({ error: 'Product name is required' });
        const dto = {
          name: b.name,
          description: (b.description === '' ? null : b.description) ?? null,
          sku: (b.sku === '' ? null : b.sku) ?? null,
          barcode: (b.barcode === '' ? null : b.barcode) ?? null,
          selling_price: b.selling_price != null ? String(b.selling_price) : '0',
          buying_price: b.buying_price != null ? String(b.buying_price) : null,
          stock_quantity: b.stock_quantity ?? 0,
          low_stock_threshold: b.minimum_stock ?? 5,
          image_url: (b.image_url === '' ? null : b.image_url) ?? null,
          is_available: b.is_available !== false,
          is_featured: !!b.is_featured,
          category_id: b.category_id ? String(b.category_id) : null,
          sort_order: 0,
        };
        logTrace('ENTER ProductService.createProduct', { dto });
        const created = await productService.createProduct(dto as any, String(tenantId), req.user?.sub);
        logTrace('EXIT ProductService.createProduct', { created });
        return res.status(201).json({
          ...created,
          selling_price: Number(created.price) || 0,
          buying_price: Number(created.cost_price) || 0,
        });
      } catch (e: any) {
        console.error(JSON.stringify({ requestId, errorType: e?.constructor?.name, errorCode: e?.code, errorMessage: e?.message, errorStack: e?.stack }));
        return res.status(500).json({ error: e?.message || 'Failed to create product (Supabase)' });
      }
    }

    const transaction = db.transaction(() => {
      try {
        logTrace('ENTER db.transaction callback');
        const allowed = ['name', 'barcode', 'sku', 'category_id', 'buying_price', 'selling_price',
                        'stock_quantity', 'minimum_stock', 'unit', 'status', 'image_url', 'description',
                        'is_available', 'cost_method'] as const;
        const data: Record<string, any> = {};
        allowed.forEach(key => { 
          if (req.body[key] !== undefined) {
            // Convert empty strings to null for optional fields (barcode, sku, description, image_url)
            const value = req.body[key];
            data[key] = (value === '' && ['barcode', 'sku', 'description', 'image_url'].includes(key)) ? null : value;
          }
        });

        if (!data.name) return res.status(400).json({ error: 'Product name is required' });
        if (data.selling_price === undefined) return res.status(400).json({ error: 'Selling price is required' });

        // ── Validate unique name per tenant ──────────────────────────────
        logTrace('ENTER db.prepare SELECT duplicateName');
        const duplicateName = db.prepare('SELECT id FROM products WHERE name = ? AND tenant_id = ? AND deleted_at IS NULL').get(data.name, tenantId);
        logTrace('EXIT db.prepare SELECT duplicateName', { duplicateName });
        if (duplicateName) {
          return res.status(400).json({ error: 'PRODUCT_NAME_DUPLICATE', message: 'Un produit avec ce nom existe déjà pour ce locataire.' });
        }

        // ── Validate unique SKU per tenant ───────────────────────────────
        if (data.sku && data.sku.trim() !== '') {
          logTrace('ENTER db.prepare SELECT duplicateSku');
          const duplicateSku = db.prepare('SELECT id FROM products WHERE sku = ? AND tenant_id = ? AND deleted_at IS NULL').get(data.sku, tenantId);
          logTrace('EXIT db.prepare SELECT duplicateSku', { duplicateSku });
          if (duplicateSku) {
            return res.status(400).json({ error: 'PRODUCT_SKU_DUPLICATE', message: 'Un produit avec ce SKU existe déjà pour ce locataire.' });
          }
        }

        // ── Validate category_id against live DB ───────────────────────────
        if (data.category_id !== undefined) {
          logTrace('ENTER db.prepare SELECT category');
          const cat = db.prepare('SELECT id FROM categories WHERE id = ? AND tenant_id = ?').get(data.category_id, (req as any).tenant_id) as any;
          logTrace('EXIT db.prepare SELECT category', { cat });
          if (!cat) {
            return res.status(400).json({ error: `Category #${data.category_id} does not exist` });
          }
        }

        // ── Apply safe defaults ───────────────────────────────────────────
        if (data.buying_price === undefined) data.buying_price = 0;
        if (data.stock_quantity === undefined) data.stock_quantity = 0;
        if (data.minimum_stock === undefined) data.minimum_stock = 0;
        if (data.unit === undefined) data.unit = 'pcs';

        // Ensure price and cost_price match selling and buying prices
        data.price = data.selling_price;
        data.cost_price = data.buying_price;

        // Generate SKU if missing
        if (!data.sku) {
          logTrace('ENTER db.prepare SELECT tenant');
          const tenant = db.prepare('SELECT name FROM tenants WHERE id = ?').get((req as any).tenant_id) as any;
          logTrace('EXIT db.prepare SELECT tenant', { tenant });
          const tenantName = tenant?.name || 'OUT';
          const rand4 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          const tPart = tenantName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const pPart = data.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const base = (tPart + pPart);
          const prefix = (base || 'XXXX').substring(0, 4).padEnd(4, 'X');
          data.sku = (prefix + rand4).substring(0, 8);
        }

        data.tenant_id = (req as any).tenant_id;
        data.created_by = req.user?.sub;
        data.updated_by = req.user?.sub;

        const cols = Object.keys(data);
        const vals = Object.values(data);
        const placeholders = cols.map(() => '?').join(', ');
        
        logTrace('ENTER db.prepare INSERT products', { cols, vals });
        const stmt = db.prepare(`INSERT INTO products (${cols.join(', ')}) VALUES (${placeholders})`);
        const result = stmt.run(...vals);
        logTrace('EXIT db.prepare INSERT products', { result, lastInsertRowid: result.lastInsertRowid });

        console.log('[PRODUCTS] New product created:', data.name);

        const newProduct = { id: result.lastInsertRowid, ...data };

        // Queue for sync (outbox pattern) - sync will be triggered AFTER transaction commit
        logTrace('ENTER queueChangeInsideTransaction');
        try {
          const sync = getProductSyncService();
          logTrace('Queueing product for sync', { id: newProduct.id, name: data.name, tenant_id: data.tenant_id });
          sync.queueChangeInsideTransaction('product', 'insert', {
            ...newProduct,
            created_by: data.created_by,
            updated_by: data.updated_by,
            updated_at: new Date().toISOString(),
          });
          logTrace('EXIT queueChangeInsideTransaction');
          console.log('[ROUTE] Product queued successfully for sync');
        } catch (syncErr: any) {
          console.error(JSON.stringify({ requestId, syncErrorType: syncErr?.constructor?.name, syncErrorCode: syncErr?.code, syncErrorMessage: syncErr?.message, syncErrorStack: syncErr?.stack }));
        }

        // ── Send new product notification (role-driven, non-blocking) ─────
        setImmediate(async () => {
          try {
            const settings = loadRawSettings();
            await notifyNewProduct(data.name, data, settings);
          } catch (notifyErr) {
            console.error('[Notification] newProduct failed:', notifyErr);
          }
        });

        res.status(201).json(newProduct);
      } catch (error: any) {
        console.error(JSON.stringify({ requestId, errorType: error?.constructor?.name, errorCode: error?.code, errorErrno: error?.errno, errorMessage: error?.message, errorStack: error?.stack, errorSql: error?.sql }));
        throw error;
      }
    });
    try { 
      logTrace('ENTER transaction()');
      transaction();
      logTrace('EXIT transaction()');
      // Trigger sync AFTER transaction commit (outbox is now visible)
      setImmediate(() => {
        try {
          const orchestrator = getOrchestratorV2();
          const genericSync = orchestrator.getGenericSync();
          console.log('[ROUTE] Triggering immediate push for product (tenant:', tenantId, ')');
          genericSync.pushByEntity('product', String(tenantId)).then((count: number) => {
            console.log('[ROUTE] Immediate sync completed - Pushed:', count);
          }).catch((syncErr: any) => {
            console.error('[ROUTE] Immediate sync failed:', syncErr);
          });
        } catch (syncErr) {
          console.error('[ROUTE] Failed to trigger sync:', syncErr);
        }
      });
    } catch (error: any) {
      console.error(JSON.stringify({ requestId, errorType: error?.constructor?.name, errorCode: error?.code, errorErrno: error?.errno, errorMessage: error?.message, errorStack: error?.stack, errorSql: error?.sql }));
      res.status(500).json({ error: 'Failed to create product', message: error?.message || 'Unknown error' });
    }
  });
});

// Update product

// Update product
router.patch('/:id', requireRole(['admin', 'manager']), async (req: any, res) => {
  const isSupabaseMode = dataSource.isTableCloud('products');
  const tenantId = parseInt(String(req.tenant_id), 10);
  if (!tenantId || isNaN(tenantId)) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  if (isSupabaseMode) {
    try {
      const id = (req.params.id as string) || '';
      const b = req.body || {};
      const dto: any = {};
      if (b.name !== undefined) dto.name = b.name;
      if (b.description !== undefined) dto.description = b.description;
      if (b.selling_price !== undefined) dto.selling_price = String(b.selling_price);
      if (b.buying_price !== undefined) dto.buying_price = b.buying_price != null ? String(b.buying_price) : null;
      if (b.stock_quantity !== undefined) dto.stock_quantity = b.stock_quantity;
      if (b.minimum_stock !== undefined) dto.low_stock_threshold = b.minimum_stock;
      if (b.category_id !== undefined) dto.category_id = b.category_id ? String(b.category_id) : null;
      // Ensure barcode is never empty/null - always use the value provided
      if (b.barcode !== undefined) dto.barcode = b.barcode;
      const updated = await productService.updateProduct(id, dto, String(tenantId));
      return res.json({ success: true, data: {
        ...updated,
        selling_price: Number(updated.price) || 0,
        buying_price: Number(updated.cost_price) || 0,
      }});
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Failed to update (Supabase)' });
    }
  }

  const transaction = db.transaction(() => {
    try {
      const { id } = req.params;

      // ── Column whitelist — never trust req.body keys as SQL column names ──
      // 'id', 'created_at', 'updated_at' are immutable from client side;
      // 'is_available' is handled by the soft-delete route instead.
      const allowed = ['name', 'barcode', 'sku', 'category_id', 'buying_price', 'selling_price',
                       'stock_quantity', 'minimum_stock', 'unit', 'status', 'image_url', 'description',
                       'cost_method'] as const;
      const updateData: Record<string, any> = {};
      allowed.forEach(key => { if (req.body[key] !== undefined) updateData[key] = req.body[key]; });

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // ── Validate unique name per tenant if name is changing ───────────
      if (updateData.name !== undefined) {
        const duplicateName = db.prepare('SELECT id FROM products WHERE name = ? AND tenant_id = ? AND id <> ? AND deleted_at IS NULL').get(updateData.name, tenantId, id);
        if (duplicateName) {
          return res.status(400).json({ error: 'PRODUCT_NAME_DUPLICATE', message: 'Un produit avec ce nom existe déjà pour ce locataire.' });
        }
      }

      // ── Validate unique SKU per tenant if SKU is changing ──────────────
      if (updateData.sku !== undefined && updateData.sku !== null && updateData.sku.trim() !== '') {
        const duplicateSku = db.prepare('SELECT id FROM products WHERE sku = ? AND tenant_id = ? AND id <> ? AND deleted_at IS NULL').get(updateData.sku, tenantId, id);
        if (duplicateSku) {
          return res.status(400).json({ error: 'PRODUCT_SKU_DUPLICATE', message: 'Un produit avec ce SKU existe déjà pour ce locataire.' });
        }
      }

      // ── Validate category_id if being changed ──────────────────────────
      if (updateData.category_id !== undefined) {
        const cat = db.prepare('SELECT id FROM categories WHERE id = ? AND tenant_id = ?').get(updateData.category_id, tenantId) as any;
        if (!cat) {
          return res.status(400).json({ error: `Category #${updateData.category_id} does not exist` });
        }
      }

      const cols = Object.keys(updateData);
      const vals = Object.values(updateData);
      const setClause = cols.map(c => `"${c}" = ?`).join(', ');

      const stmt = db.prepare(`
        UPDATE products
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `);

      const result = stmt.run(...vals, id, tenantId);

if (result.changes > 0) {
         // Queue for sync (outbox pattern) and trigger IMMEDIATE sync
         try {
           const sync = getProductSyncService();
           sync.queueChangeInsideTransaction('product', 'update', {
             id: Number(id),
             ...updateData,
             updated_at: new Date().toISOString(),
             tenant_id: tenantId
           });
           
           // Trigger immediate sync to Supabase (DON'T WAIT - fire and forget)
           Promise.resolve().then(async () => {
             try {
               console.log('[ROUTE] Triggering immediate sync for tenant:', tenantId);
               const result = await sync.syncNow(String(tenantId));
               console.log('[ROUTE] Immediate sync completed for product update #', id, '- Pushed:', result.pushed);
             } catch (syncErr) {
               console.error('[ROUTE] Immediate sync failed:', syncErr);
             }
           });
         } catch (syncErr) {
           console.warn('[Sync] Could not queue product change:', syncErr);
         }

         res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Product not found' });
      }
    } catch (error) {
      console.error('[PRODUCTS_ROUTE_ERROR] Error updating product:', error);
      throw error;
    }
  });

  try {
    transaction();
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/:id', requireRole(['admin', 'manager']), async (req: any, res) => {
  const isSupabaseMode = dataSource.isTableCloud('products');
  const tenantId = parseInt(String(req.tenant_id), 10);
  if (!tenantId || isNaN(tenantId)) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  try {
    const { id } = req.params;

    if (!isSupabaseMode) {
      // Check if product is used in any active orders (SQLite check)
      const activeOrders = db.prepare(`
        SELECT COUNT(*) as count FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.product_id = ? AND o.status IN ('pending', 'confirmed') AND o.tenant_id = ?
      `).get(id, tenantId) as any;

      if (activeOrders.count > 0) {
        return res.status(400).json({
          error: 'Cannot delete product that is part of active orders'
        });
      }

      // Delegate to productService which handles adapter logic and sync queuing
      await productService.deleteProduct(id, String(tenantId));

      // Vérifier si l'opération a vraiment eu lieu
      const checkDeleted = db.prepare(`SELECT is_available, deleted_at FROM products WHERE id = ? AND tenant_id = ?`).get(id, tenantId) as any;
      if (checkDeleted && checkDeleted.is_available !== 0 && !checkDeleted.deleted_at) {
        return res.status(500).json({ error: 'Delete operation may have failed - product still appears available' });
      }

      return res.json({ success: true });
    } else {
      // Supabase mode - use the modern service
      const id = (req.params.id as string) || '';
      const deleted = await productService.deleteProduct(id, String(tenantId));
      return res.json({ success: true, data: deleted });
    }
  } catch (error: any) {
    console.error('[PRODUCTS_ROUTE_ERROR] Error deleting product:', error);
    res.status(500).json({ error: error.message || 'Failed to delete product' });
  }
});

// Get low stock products (Supabase compat)
router.get('/low-stock', async (req: any, res) => {
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
  try {
    const isSupabaseMode = dataSource.isTableCloud('products');
    if (!db && !isSupabaseMode) {
      console.warn('[Products] SQLite disabled (db is null). Returning [] for low-stock');
      return res.json([]);
    }
    if (isSupabaseMode) {
      const result = await productService.listProducts(String(tenantId), { is_available: true, limit: 500, page: 1 });
      const low = (result.items || []).filter((p: any) => (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 0));
      // minimal shape for existing UI
      return res.json(low.map((p: any) => ({
        id: p.id, name: p.name, stock_quantity: p.stock_quantity, minimum_stock: p.low_stock_threshold,
        unit: 'pcs', category_name: null,
        selling_price: Number(p.price) || 0,
      })));
    }
    const products = db.prepare(`
      SELECT p.id, p.name, p.stock_quantity, p.minimum_stock, p.unit,
             c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_available = 1 AND p.stock_quantity <= p.minimum_stock AND p.tenant_id = ?
      ORDER BY (p.minimum_stock - p.stock_quantity) DESC
    `).all(tenantId);
    res.json(products);
  } catch (error: any) {
    console.error('[PRODUCTS API FORENSIC ERROR] /low-stock', {
      message: error?.message,
      sqliteCode: error?.code || error?.errno,
      stack: error?.stack,
      isSupabaseMode: env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS
    });
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

// Adjust stock (add/subtract quantity with professional movement tracking)
router.post('/:id/adjust-stock', requireRole(['admin', 'manager']), (req: any, res) => {
  const { quantity, movement_type = 'adjustment', reason = 'Manual adjustment', user_id } = req.body;
  const { id } = req.params;
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  // ── Capturable state populated by the transaction callback ──────────
  let notifyData: {
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
      'SELECT stock_quantity, buying_price, name, minimum_stock FROM products WHERE id = ? AND tenant_id = ?'
    ).get(id, tenantId) as any;
    if (!productRow) throw new Error('Product not found');

    const qtyBefore   = productRow.stock_quantity || 0;
    const qtyChanged  = Number(quantity);
    const qtyAfter    = qtyBefore + qtyChanged;
    const unitCost    = productRow.buying_price || 0;
    const totalValue  = Math.abs(qtyChanged) * unitCost;

    stamp: productRow.name ? notifyData.productName = productRow.name : null;
    notifyData.qtyBefore   = qtyBefore;
    notifyData.qtyChanged  = qtyChanged;
    notifyData.qtyAfter    = qtyAfter;
    notifyData.reason      = reason;
    notifyData.performedBy = user_id != null ? String(user_id) : undefined;

    db.prepare(`
      UPDATE products
      SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).run(qtyAfter, id, tenantId);

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
      user_id || null,
      'manual',
      tenantId
    );

    // Concrete trigger for STOCK_LOW (Phase 3)
    try {
      const minStock = productRow.minimum_stock || 0;
      if (qtyAfter <= minStock && qtyBefore > minStock) {
        createNotification({
          type: 'stockLow',
          title: 'Stock faible',
          message: `${productRow.name} est tombé sous le seuil minimum (${qtyAfter}/${minStock})`,
          priority: 'high',
          notification_type: 'STOCK_LOW',
          link: '/products',
          metadata: { product_id: id, stock: qtyAfter, minimum: minStock },
          tenant_id: tenantId,
        } as any);
      }
    } catch (e) {
      console.warn('[Products] Failed to create STOCK_LOW notification', e);
    }

    // Queue for Supabase push (outbox pattern)
    try {
      const sync = getProductSyncService();
      sync.queueChangeInsideTransaction('product', 'update', {
        id: Number(id),
        stock_quantity: qtyAfter,
        updated_at: new Date().toISOString(),
        tenant_id: tenantId
      });
    } catch (syncErr) {
      console.warn('[Sync] ProductSyncService not ready for stock adjustment, will retry on next cycle');
    }

    try {
      const sync = getOrchestratorV2().getGenericSync();
      sync.queueChangeInsideTransaction('inventory_movement', 'insert', {
        id: Number(movementResult.lastInsertRowid),
        product_id: id,
        movement_type,
        quantity_before: qtyBefore,
        quantity_changed: qtyChanged,
        quantity_after: qtyAfter,
        unit_cost: unitCost,
        total_value: totalValue,
        reason,
        created_by: user_id || null,
        reference_type: 'manual',
        tenant_id: tenantId,
        version: 1,
      });
    } catch (syncErr) {
      console.warn('[Sync] GenericSyncService not ready for inventory movement, will retry on next cycle');
    }

    return db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').get(id, tenantId);
  });

  try {
    const updated = transaction();
    res.json({ success: true, product: updated });

    // ── Fire-and-forget: email notification (non-blocking, after response)
    setImmediate(async () => {
      try {
        const settingsRows = db.prepare(
          "SELECT key, value FROM settings"
        ).all() as { key: string; value: string }[];
        const rawSettings = Object.fromEntries(
          settingsRows.map(r => [r.key, r.value])
        );
        await notifyStockAdjustment(
          notifyData.productName, Number(id),
          notifyData.qtyBefore, notifyData.qtyChanged, notifyData.qtyAfter,
          notifyData.reason,
          notifyData.performedBy,
          String(rawSettings.app_currency || 'USD'),
          rawSettings,
        );
      } catch (notifyErr) {
        console.error('[Notification] stock-adjustment email failed:', notifyErr);
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

// Upload product image (multipart/form-data)
// Stores file on disk under data/uploads/products/ and returns public URL
router.post(
  '/:id/upload-image',
  requireRole(['admin', 'manager']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const boundary = getBoundary(req);
      if (!boundary) {
        return res.status(400).json({ error: 'Expected multipart/form-data' });
      }

      // Consume request into a Buffer (max 10 MB)
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks);
      if (raw.length > 10 * 1024 * 1024) {
        return res.status(413).json({ error: 'File too large (max 10 MB)' });
      }

      const parts = parseMultipart(raw, boundary);
      const filePart = parts.find(p => p.name === 'image');
      if (!filePart || !filePart.filename) {
        return res.status(400).json({ error: 'No file provided in "image" field' });
      }

      // Basic type guard
      const ext = path.extname(filePart.filename).toLowerCase();
      const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      if (!allowed.includes(ext)) {
        return res.status(400).json({ error: 'Unsupported image type. Allowed: jpg, jpeg, png, gif, webp' });
      }

      // Verify product exists
      const product = db.prepare('SELECT id FROM products WHERE id = ? AND tenant_id = ?').get(id, (req as any).tenant_id) as any;
      if (!product) return res.status(404).json({ error: 'Product not found' });

      if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

      // Derive safe filename: product-{id}-{timestamp}{ext}
      const timestamp = Date.now();
      const safeName = `product-${id}-${timestamp}${ext}`;
      const dest = path.join(UPLOAD_DIR, safeName);

      fs.writeFileSync(dest, filePart.data);

      // Relative URL used in the API response and directly by the frontend image element
      const imageUrl = `/api/uploads/products/${safeName}`;

      // Persist URL in product record
      db.prepare('UPDATE products SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?').run(imageUrl, id, (req as any).tenant_id);

      console.log(`[Products] Image saved for product #${id}: ${safeName}`);
      res.json({ success: true, image_url: imageUrl });
    } catch (error) {
      console.error('Error uploading product image:', error);
      res.status(500).json({ error: 'Failed to upload product image' });
    }
  }
);

// ─── Professional Inventory Endpoints (PHASE 1) ─────────────────────

// GET /products - supports both legacy flat array and new professional pagination.
// In Supabase/Render cloud mode: delegates to modern productService + shape adapter
// so that POS, ProductsGrid, etc. receive selling_price, category_name, etc. (fixes price=0 bug).
router.get('/', async (req: any, res) => {
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
  try {
    const isSupabaseMode = dataSource.isTableCloud('products');
    // showArchived: admin/owner only - shows products with is_available=0 or deleted_at NOT NULL
    const showArchived = req.query.showArchived === 'true';
    const userRole = req.user?.role;

    if (!db && !isSupabaseMode) {
      console.warn('[Products] SQLite disabled (db is null) and not in Supabase mode. Returning [] for GET /products');
      return res.json([]);
    }

    if (isSupabaseMode) {
      const hasPagination = !!(req.query.page || req.query.limit || req.query.search || req.query.lowStock || req.query.category_id);

      const page = hasPagination ? Math.max(1, parseInt(String(req.query.page)) || 1) : 1;
      const limit = hasPagination
        ? Math.min(100, Math.max(5, parseInt(String(req.query.limit)) || 1000))
        : 1000;
      const search = (req.query.search as string || '').trim() || undefined;
      const categoryId = req.query.category_id ? String(req.query.category_id) : undefined;

      const svcResult = await productService.listProducts(String(tenantId), {
        page,
        limit,
        search,
        category_id: categoryId,
        is_available: showArchived ? undefined : true,
      });

      // Enrich category_name (Supabase products table has only category_id; frontend expects the name)
      const catMap = new Map<string, string>();
      if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
          const { data: cats } = await supa.from('categories').select('id, name').eq('tenant_id', tenantId);
          (cats || []).forEach((c: any) => catMap.set(String(c.id), c.name || ''));
        } catch (e) {
          console.warn('[Products] Supabase category enrichment skipped:', (e as any)?.message);
        }
      }

      const adapted = (svcResult.items || []).map((p: any) => ({
        id: p.id,                    // UUID string (tolerated by most UI; sync/desktop may differ)
        name: p.name,
        description: p.description ?? null,
        barcode: p.barcode ?? null,
        sku: (p as any).sku ?? null,
        image_url: p.image_url ?? null,
        buying_price: p.cost_price != null ? Number(p.cost_price) : 0,
        selling_price: p.price != null ? Number(p.price) : 0,   // ← critical fix for "prices show 0"
        stock_quantity: p.stock_quantity ?? 0,
        minimum_stock: p.low_stock_threshold ?? 0,
        unit: 'pcs',
        is_available: p.is_available ? 1 : 0,
        created_at: p.created_at,
        updated_at: p.updated_at,
        category_id: p.category_id,
        category_name: catMap.get(String(p.category_id)) || null,
      }));

      if (!hasPagination) {
        return res.json(adapted);
      }
      return res.json({
        data: adapted,
        pagination: {
          page: svcResult.page,
          limit: svcResult.limit,
          total: svcResult.total,
          totalPages: Math.ceil(svcResult.total / (svcResult.limit || 1)),
          hasNext: svcResult.hasMore,
          hasPrev: svcResult.page > 1,
        },
      });
    }

    // ── ORIGINAL LEGACY SQLITE PATH ──
    const hasPagination = req.query.page || req.query.limit || req.query.search || req.query.lowStock || req.query.category_id;

    if (!hasPagination) {
      // Legacy mode for existing components (POS, Dashboard, etc.)
      const whereAvailable = showArchived ? '' : 'p.is_available = 1 AND';
      const products = db.prepare(`
        SELECT p.id, p.name, p.barcode, p.image_url, p.description, p.buying_price, p.selling_price,
               p.stock_quantity, p.minimum_stock, p.unit, p.is_available, p.created_at,
               c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ${whereAvailable} p.tenant_id = ?
        ORDER BY p.name ASC
      `).all(tenantId);
      return res.json(products);
    }

    // Professional paginated mode
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();
    const lowStock = req.query.lowStock === 'true';
    const categoryId = req.query.category_id ? parseInt(req.query.category_id as string) : null;

    let where = 'p.is_available = 1 AND p.tenant_id = ?';
    const params: any[] = [tenantId];

    if (search) {
      where += ` AND (p.name LIKE ? OR p.barcode LIKE ? OR c.name LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (lowStock) {
      where += ` AND p.stock_quantity <= p.minimum_stock`;
    }
    if (categoryId) {
      where += ` AND p.category_id = ?`;
      params.push(categoryId);
    }

    const countStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where}
    `);
    const { total } = countStmt.get(...params) as any;

    const products = db.prepare(`
      SELECT p.id, p.name, p.barcode, p.image_url, p.description, p.buying_price, p.selling_price,
             p.stock_quantity, p.minimum_stock, p.unit, p.is_available, p.created_at, p.updated_at,
             c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where}
      ORDER BY p.name ASC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error: any) {
    console.error('[PRODUCTS API FORENSIC ERROR] GET /products', {
      message: error?.message,
      sqliteCode: error?.code || error?.errno || 'N/A',
      stack: error?.stack?.split('\n').slice(0, 8).join('\n'),
      query: 'legacy or repository path',
      isSupabaseMode: env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS,
      dbNull: !db
    });
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});


// GET /products/:id/history — unified history (movements + sales) for a single product
// No async/await in Express route callbacks; use Promise.all with .then/.catch
router.get('/:id/history', (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(200, Math.max(10, parseInt(req.query.limit as string) || 50));

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid product id' });
    }

    Promise.all([
      db.prepare('SELECT id, name, barcode, image_url, buying_price, selling_price, stock_quantity, minimum_stock, unit FROM products WHERE id = ? AND tenant_id = ?').get(id, (req as any).tenant_id) as any,
      db.prepare(`
        SELECT si.quantity, si.unit_price, si.total_price, s.invoice_number, s.created_at, s.payment_method
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE si.product_id = ? AND s.tenant_id = ?
        ORDER BY s.created_at DESC
        LIMIT ?
      `).all(parseInt(id), (req as any).tenant_id, limit),
      db.prepare(`
        SELECT m.*, m.created_at
        FROM inventory_movements m
        WHERE m.product_id = ? AND m.tenant_id = ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `).all(parseInt(id), (req as any).tenant_id, limit),
    ]).then(([product, saleItems, movements]) => {
      res.json({ product, saleItems, movements });
    }).catch(err => {
      console.error('Error in history:', err);
      res.status(500).json({ error: 'Failed to fetch product history' });
    });
  } catch (error) {
    console.error('Error setting up history query:', error);
    res.status(500).json({ error: 'Failed to fetch product history' });
  }
});

export default router;