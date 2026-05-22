import express from 'express';
import db from '../db/database';
import { requireRole } from '../middleware/auth';

const router = express.Router();

// ─── Stock Adjustments ───────────────────────────────────────────────────────

// GET /stock-adjustments  — list with optional ?status= & ?type= filters
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT sa.*,
             u1.full_name AS created_by_name,
             u2.full_name AS approved_by_name,
             s.name        AS session_name
      FROM   stock_adjustments sa
      LEFT   JOIN users u1 ON sa.created_by  = u1.id
      LEFT   JOIN users u2 ON sa.approved_by = u2.id
      LEFT   JOIN inventory_sessions s ON sa.session_id = s.id
      ORDER  BY sa.created_at DESC
      LIMIT  200
    `).all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /stock-adjustments  — create a new adjustment document
// In 'draft' or 'pending_approval' status, preparing it for review.
router.post('/', requireRole(['admin', 'manager']), (req, res) => {
  const { adjustment_code, adjustment_type, reason, notes, total_value, created_by, session_id } = req.body;

  if (!adjustment_code || !adjustment_type || !reason) {
    return res.status(400).json({ error: 'adjustment_code, adjustment_type, and reason are required' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO stock_adjustments
        (adjustment_code, adjustment_type, reason, notes, total_value, created_by, status, session_id)
      VALUES (?, ?, ?, ?, ?, ?, 'draft', COALESCE(?, NULL))
    `).run(adjustment_code, adjustment_type, reason, notes ?? null, total_value ?? 0, created_by ?? 0, session_id ?? null);

    const created = db.prepare('SELECT * FROM stock_adjustments WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /stock-adjustments/:id/approve  — change status to approved
router.post('/:id/approve', requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;

  try {
    db.prepare(`
      UPDATE stock_adjustments
      SET status = 'approved',
          approved_by = ?,
          approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(approved_by ?? 0, id);

    const updated = db.prepare('SELECT * FROM stock_adjustments WHERE id = ?').get(id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /stock-adjustments/:id/reject
router.post('/:id/reject', requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const { approved_by, notes } = req.body;

  try {
    db.prepare(`
      UPDATE stock_adjustments
      SET status = 'rejected',
          approved_by = ?,
          approved_at = CURRENT_TIMESTAMP,
          notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(approved_by ?? 0, notes ?? null, id);

    res.json({ success: true, status: 'rejected' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /stock-adjustments/:id/items  — add a line item
router.post('/:id/items', requireRole(['admin', 'manager']), (req, res) => {
  const { id } = req.params;
  const { product_id, quantity_before, quantity_change, unit_cost, reason } = req.body;

  if (product_id === undefined || quantity_change === undefined) {
    return res.status(400).json({ error: 'product_id and quantity_change are required' });
  }

  try {
    const p = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(product_id) as any;
    if (!p) return res.status(404).json({ error: 'Product not found' });

    const quantity_before_val = quantity_before ?? p.stock_quantity;
    const quantity_after      = quantity_before_val + quantity_change;
    const unit_cost_val       = unit_cost ?? 0;
    const total_value         = quantity_change * unit_cost_val;

    db.prepare(`
      INSERT INTO stock_adjustment_items
        (adjustment_id, product_id, quantity_before, quantity_change, quantity_after, unit_cost, total_value, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(Number(id), product_id, quantity_before_val, quantity_change, quantity_after, unit_cost_val, total_value, reason ?? null);

    res.status(201).json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /stock-adjustments/:id/items
router.get('/:id/items', (req, res) => {
  const { id } = req.params;
  const items = db.prepare(`
    SELECT sai.*, p.name AS product_name, p.barcode
    FROM stock_adjustment_items sai
    LEFT JOIN products p ON sai.product_id = p.id
    WHERE sai.adjustment_id = ?
  `).all(id);
  res.json(items);
});

// DELETE /stock-adjustments/:id/cancel
router.post('/:id/cancel', requireRole(['admin', 'manager']), (req, res) => {
  const { id } = req.params;

  try {
    db.prepare(`UPDATE stock_adjustments SET status = 'cancelled' WHERE id = ?`).run(id);
    res.json({ success: true, status: 'cancelled' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
