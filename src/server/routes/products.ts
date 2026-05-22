import express from 'express';
import path from 'path';
import db from '../db/database';
import { requireRole } from '../middleware/auth';
import fs from 'fs';
// import { syncService } from '../sync';
import { AnalyticsService } from '../services/analytics.service';
import { notifyStockAdjustment, notifyNewProduct, loadRawSettings } from '../services/notification.service';

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

// Get product by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const product = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(id);

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
router.post('/', requireRole(['admin', 'manager']), (req, res) => {
  const transaction = db.transaction(() => {
    try {
      const allowed = ['name', 'barcode', 'sku', 'category_id', 'buying_price', 'selling_price',
                      'stock_quantity', 'minimum_stock', 'unit', 'status', 'image_url', 'description',
                      'is_available', 'cost_method'] as const;
      const data: Record<string, any> = {};
      allowed.forEach(key => { if (req.body[key] !== undefined) data[key] = req.body[key]; });

      if (!data.name) return res.status(400).json({ error: 'Product name is required' });
      if (data.selling_price === undefined) return res.status(400).json({ error: 'Selling price is required' });

      // ── Validate category_id against live DB ───────────────────────────
      if (data.category_id !== undefined) {
        const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(data.category_id) as any;
        if (!cat) {
          return res.status(400).json({ error: `Category #${data.category_id} does not exist` });
        }
      }

      // ── Apply safe defaults ───────────────────────────────────────────
      if (data.buying_price === undefined) data.buying_price = 0;
      if (data.stock_quantity === undefined) data.stock_quantity = 0;
      if (data.minimum_stock === undefined) data.minimum_stock = 0;
      if (data.unit === undefined) data.unit = 'pcs';

      const cols = Object.keys(data);
      const vals = Object.values(data);
      const placeholders = cols.map(() => '?').join(', ');
      const stmt = db.prepare(`INSERT INTO products (${cols.join(', ')}) VALUES (${placeholders})`);
      const result = stmt.run(...vals);

      console.log('[PRODUCTS] New product created:', data.name);

      const newProduct = { id: result.lastInsertRowid, ...data };

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
    } catch (error) {
      console.error('[PRODUCTS_ROUTE_ERROR] Error creating product:', error);
      throw error;
    }
  });
  try { transaction(); } catch (error) { res.status(500).json({ error: 'Failed to create product' }); }
});

// Update product
router.patch('/:id', requireRole(['admin', 'manager']), (req, res) => {
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

      // ── Validate category_id if being changed ──────────────────────────
      if (updateData.category_id !== undefined) {
        const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(updateData.category_id) as any;
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
        WHERE id = ?
      `);

      const result = stmt.run(...vals, id);

      if (result.changes > 0) {
        // Queue for sync
        // syncService.queueChange('products', 'UPDATE', parseInt(id), updateData);

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

// Delete product (soft delete by setting is_available to 0)
router.delete('/:id', requireRole(['admin', 'manager']), (req, res) => {
  try {
    const { id } = req.params;

    // Check if product is used in any active orders
    const activeOrders = db.prepare(`
      SELECT COUNT(*) as count FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = ? AND o.status IN ('pending', 'confirmed')
    `).get(id) as any;

    if (activeOrders.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete product that is part of active orders'
      });
    }

    const result = db.prepare(`
      UPDATE products
      SET is_available = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    if (result.changes > 0) {
      // Queue for sync
      // syncService.queueChange('products', 'DELETE', parseInt(id), { id });

      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    console.error('[PRODUCTS_ROUTE_ERROR] Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Get low stock products
router.get('/low-stock', (_req, res) => {
  try {
    const products = db.prepare(`
      SELECT p.id, p.name, p.stock_quantity, p.minimum_stock, p.unit,
             c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_available = 1 AND p.stock_quantity <= p.minimum_stock
      ORDER BY (p.minimum_stock - p.stock_quantity) DESC
    `).all();
    res.json(products);
  } catch (error) {
    console.error('[PRODUCTS_ROUTE_ERROR] Error fetching low stock products:', error);
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

// Adjust stock (add/subtract quantity with professional movement tracking)
router.post('/:id/adjust-stock', requireRole(['admin', 'manager']), (req, res) => {
  const { quantity, movement_type = 'adjustment', reason = 'Manual adjustment', user_id } = req.body;
  const { id } = req.params;

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
      'SELECT stock_quantity, buying_price, name FROM products WHERE id = ?'
    ).get(id) as any;
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
      WHERE id = ?
    `).run(qtyAfter, id);

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
      user_id || null,
      'manual'
    );

    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
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
      const product = db.prepare('SELECT id FROM products WHERE id = ?').get(id) as any;
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
      db.prepare('UPDATE products SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(imageUrl, id);

      console.log(`[Products] Image saved for product #${id}: ${safeName}`);
      res.json({ success: true, image_url: imageUrl });
    } catch (error) {
      console.error('Error uploading product image:', error);
      res.status(500).json({ error: 'Failed to upload product image' });
    }
  }
);

// ─── Professional Inventory Endpoints (PHASE 1) ─────────────────────

// GET /products - supports both legacy flat array and new professional pagination
router.get('/', (req, res) => {
  try {
    const hasPagination = req.query.page || req.query.limit || req.query.search || req.query.lowStock || req.query.category_id;

    if (!hasPagination) {
      // Legacy mode for existing components (POS, Dashboard, etc.)
      const products = db.prepare(`
        SELECT p.id, p.name, p.barcode, p.image_url, p.description, p.buying_price, p.selling_price,
               p.stock_quantity, p.minimum_stock, p.unit, p.is_available, p.created_at,
               c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_available = 1
        ORDER BY p.name ASC
      `).all();
      return res.json(products);
    }

    // Professional paginated mode
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();
    const lowStock = req.query.lowStock === 'true';
    const categoryId = req.query.category_id ? parseInt(req.query.category_id as string) : null;

    let where = 'p.is_available = 1';
    const params: any[] = [];

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
  } catch (error) {
    console.error('Error fetching products:', error);
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
      db.prepare('SELECT id, name, barcode, image_url, buying_price, selling_price, stock_quantity, minimum_stock, unit FROM products WHERE id = ?').get(id) as any,
      db.prepare(`
        SELECT si.quantity, si.unit_price, si.total_price, s.invoice_number, s.created_at, s.payment_method
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE si.product_id = ?
        ORDER BY s.created_at DESC
        LIMIT ?
      `).all(parseInt(id), limit),
      db.prepare(`
        SELECT m.*, m.created_at
        FROM inventory_movements m
        WHERE m.product_id = ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `).all(parseInt(id), limit),
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