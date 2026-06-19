import express from 'express';
import db from '../db/database';
import { requireRole } from '../middleware/auth';

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generatePONumber(): string {
  const ts   = new Date().toISOString().slice(0, 10);          // YYYY-MM-DD
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PO-${ts}-${rand}`;
}

// ─── Purchase Orders ─────────────────────────────────────────────────────────

/**
 * GET /purchase-orders
 * Query params: ?supplier_id=N&status=ordered
 */
router.get('/', (req: any, res) => {
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
  try {
    const { supplier_id, status } = req.query;
    let sql = `
      SELECT po.*, s.name AS supplier_name
      FROM   purchase_orders po
      JOIN   suppliers s ON po.supplier_id = s.id
      WHERE  po.tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (supplier_id) { sql += ` AND po.supplier_id = ?`;  params.push(supplier_id); }
    if (status)      { sql += ` AND po.status = ?`;        params.push(status); }

    sql += ` ORDER BY po.created_at DESC LIMIT 200`;
    res.json(db.prepare(sql).all(...params));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /purchase-orders/:id
 * Includes line items.
 */
router.get('/:id', (req: any, res) => {
  const { id } = req.params;
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
  try {
    const po = db.prepare(`
      SELECT po.*, s.name AS supplier_name
      FROM   purchase_orders po
      JOIN   suppliers s ON po.supplier_id = s.id
      WHERE  po.id = ? AND po.tenant_id = ?
    `).get(id, tenantId) as any;

    if (!po) return res.status(404).json({ error: 'Purchase order not found' });

    const items = db.prepare(`
      SELECT poi.*, p.name AS product_name, p.barcode
      FROM   purchase_order_items poi
      LEFT   JOIN products p ON poi.product_id = p.id
      WHERE  poi.purchase_order_id = ? AND poi.tenant_id = ?
    `).all(id, tenantId);

    res.json({ ...po, items });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /purchase-orders
 * Body: { supplier_id, notes, created_by, items: [{ product_id, quantity_ordered, unit_cost }] }
 */
router.post('/', requireRole(['admin', 'manager']), (req: any, res) => {
  const { supplier_id, notes, created_by, items } = req.body;
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  if (!supplier_id)  return res.status(400).json({ error: 'supplier_id is required' });
  if (!items?.length) return res.status(400).json({ error: 'At least one line item is required' });

  const transaction = db.transaction(() => {
    const poNumber = generatePONumber();

    const poResult = db.prepare(`
      INSERT INTO purchase_orders (po_number, supplier_id, notes, created_by, status, tenant_id)
      VALUES (?, ?, ?, ?, 'draft', ?)
    `).run(poNumber, supplier_id, notes ?? null, created_by ?? 1, tenantId);

    const poId = poResult.lastInsertRowid;

    const itemStmt = db.prepare(`
      INSERT INTO purchase_order_items
        (purchase_order_id, product_id, quantity_ordered, unit_cost, total_cost, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      if (item.product_id === undefined || item.quantity_ordered === undefined || item.unit_cost === undefined) {
        throw new Error('Each item must have product_id, quantity_ordered, and unit_cost');
      }
      itemStmt.run(poId, item.product_id, item.quantity_ordered, item.unit_cost, item.quantity_ordered * item.unit_cost, tenantId);
    }

    // Calculate totals
    const { subtotal } = db.prepare(
      `SELECT COALESCE(SUM(total_cost), 0) AS subtotal FROM purchase_order_items WHERE purchase_order_id = ? AND tenant_id = ?`
    ).get(poId, tenantId) as { subtotal: number };

    db.prepare(`UPDATE purchase_orders SET subtotal = ?, total = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`)
       .run(subtotal, subtotal, poId, tenantId);

    return { id: poId, po_number: poNumber, status: 'draft' };
  });

  try {
    const result = transaction();
    res.status(201).json(db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ?').get(result.id, tenantId));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PATCH /purchase-orders/:id
 * Allowed transitions: draft→ordered|queued|partial|cancelled|received.
 */
router.patch('/:id', requireRole(['admin', 'manager']), (req: any, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  if (!status) return res.status(400).json({ error: 'status is required' });

  try {
    const existing = db.prepare(`SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ?`).get(id, tenantId) as any;
    if (!existing) return res.status(404).json({ error: 'Purchase order not found' });

    const allowed: Record<string, string[]> = {
      draft:   ['ordered', 'queued', 'partial', 'cancelled', 'received'],
      ordered: ['partial', 'received', 'cancelled'],
      partial: ['received', 'cancelled'],
    };
    const transitions = allowed[(existing as any).status] ?? [];
    if (!transitions.includes(status)) {
      return res.status(400).json({ error: `Cannot transition from '${(existing as any).status}' to '${status}'` });
    }

    db.prepare(`UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`).run(status, id, tenantId);
    res.json(db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ?').get(id, tenantId));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
