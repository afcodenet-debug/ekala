import express from 'express';
import db from '../db/database';
import { requireRole } from '../middleware/auth';

const router = express.Router();

// ─── Suppliers ───────────────────────────────────────────────────────────────

// GET /suppliers
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM suppliers
      ORDER BY is_active DESC, name ASC
    `).all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /suppliers/:id
router.get('/:id', (req, res) => {
  const { id } = req.params;
  try {
    const row = db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id) as any;
    if (!row) return res.status(404).json({ error: 'Supplier not found' });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /suppliers
router.post('/', requireRole(['admin', 'manager']), (req, res) => {
  const { name, contact_name, email, phone, address, tax_number, payment_terms } = req.body;

  if (!name) return res.status(400).json({ error: 'Supplier name is required' });

  try {
    const result = db.prepare(`
      INSERT INTO suppliers (name, contact_name, email, phone, address, tax_number, payment_terms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, contact_name ?? null, email ?? null, phone ?? null, address ?? null, tax_number ?? null, payment_terms ?? 'net_30');

    const created = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /suppliers/:id
router.patch('/:id', requireRole(['admin', 'manager']), (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const allowed = ['name', 'contact_name', 'email', 'phone', 'address', 'tax_number', 'payment_terms', 'is_active'];
  const updates: string[] = [];
  const values: any[] = [];

  for (const key of Object.keys(data)) {
    if (allowed.includes(key) && data[key] !== undefined) {
      updates.push(`"${key}" = ?`);
      values.push(data[key]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  values.push(id);
  db.prepare(`UPDATE suppliers SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
  res.json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any);
});

// DELETE /suppliers/:id  (soft: is_active = 0)
router.delete('/:id', requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const { c: activePOs } = db.prepare(
    `SELECT COUNT(*) AS c FROM purchase_orders WHERE supplier_id = ? AND status NOT IN ('cancelled')`
  ).get(id) as { c: number };

  if (activePOs > 0) {
    return res.status(400).json({ error: 'Cannot deactivate supplier with active purchase orders' });
  }

  db.prepare(`UPDATE suppliers SET is_active = 0 WHERE id = ?`).run(id);
  res.json({ success: true });
});

export default router;
