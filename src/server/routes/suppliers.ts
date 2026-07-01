import express from 'express';
import db from '../db/database';
import { requireRole } from '../middleware/auth';
import { env } from '../config/env';
import { supabaseQuery } from '../infrastructure/supabase-query';

const router = express.Router();

// ─── Suppliers ───────────────────────────────────────────────────────────────

// GET /suppliers
router.get('/', async (req: any, res) => {
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  // ===== Mode Cloud (Supabase) =====
  if (!db && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data, error } = await supabaseQuery('suppliers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== Mode Local (SQLite) =====
  try {
    const rows = db.prepare(`
      SELECT * FROM suppliers
      WHERE tenant_id = ?
      ORDER BY is_active DESC, name ASC
    `).all(tenantId);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /suppliers/:id
router.get('/:id', async (req: any, res) => {
  const { id } = req.params;
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  // ===== Mode Cloud (Supabase) =====
  if (!db && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data, error } = await supabaseQuery('suppliers')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();
      if (error) throw new Error(error.message);
      if (!data) return res.status(404).json({ error: 'Supplier not found' });
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== Mode Local (SQLite) =====
  try {
    const row = db.prepare(`SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?`).get(id, tenantId) as any;
    if (!row) return res.status(404).json({ error: 'Supplier not found' });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /suppliers
router.post('/', requireRole(['admin', 'manager']), async (req: any, res) => {
  const { name, contact_name, email, phone, address, tax_number, payment_terms } = req.body;
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  if (!name) return res.status(400).json({ error: 'Supplier name is required' });

  // ===== Mode Cloud (Supabase) =====
  if (!db && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data, error } = await supabaseQuery('suppliers')
        .insert([{
          name,
          contact_name: contact_name ?? null,
          email: email ?? null,
          phone: phone ?? null,
          address: address ?? null,
          tax_number: tax_number ?? null,
          payment_terms: payment_terms ?? 'net_30',
          tenant_id: tenantId,
          is_active: true,
        }])
        .select();
      if (error) throw new Error(error.message);
      return res.status(201).json(data?.[0] || data);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== Mode Local (SQLite) =====
  try {
    const result = db.prepare(`
      INSERT INTO suppliers (name, contact_name, email, phone, address, tax_number, payment_terms, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, contact_name ?? null, email ?? null, phone ?? null, address ?? null, tax_number ?? null, payment_terms ?? 'net_30', tenantId);

    const created = db.prepare('SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?').get(result.lastInsertRowid, tenantId);

    // Queue for sync to Supabase
    try {
      const { syncAfterWrite } = require('../../sync/sync-helper');
      syncAfterWrite('supplier', 'insert', { ...created, tenant_id: tenantId });
    } catch (syncErr) {
      console.warn('[Suppliers] Could not queue sync:', syncErr);
    }

    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /suppliers/:id
router.patch('/:id', requireRole(['admin', 'manager']), async (req: any, res) => {
  const { id } = req.params;
  const data = req.body;
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  const allowed = ['name', 'contact_name', 'email', 'phone', 'address', 'tax_number', 'payment_terms', 'is_active'];

  // ===== Mode Cloud (Supabase) =====
  if (!db && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const updates: Record<string, any> = {};
      for (const key of Object.keys(data)) {
        if (allowed.includes(key) && data[key] !== undefined) {
          updates[key] = data[key];
        }
      }
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

      const { data: updated, error } = await supabaseQuery('suppliers')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select();
      if (error) throw new Error(error.message);
      return res.json(updated?.[0] || updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== Mode Local (SQLite) =====
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
  values.push(tenantId);
  db.prepare(`UPDATE suppliers SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?').get(id, tenantId) as any;

  // Queue for sync to Supabase
  try {
    const { syncAfterWrite } = require('../../sync/sync-helper');
    syncAfterWrite('supplier', 'update', { ...updated, tenant_id: tenantId });
  } catch (syncErr) {
    console.warn('[Suppliers] Could not queue update sync:', syncErr);
  }

  res.json(updated);
});

// DELETE /suppliers/:id  (soft: is_active = 0)
router.delete('/:id', requireRole(['admin']), async (req: any, res) => {
  const { id } = req.params;
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  // ===== Mode Cloud (Supabase) =====
  if (!db && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { error } = await supabaseQuery('suppliers')
        .update({ is_active: false })
        .eq('id', id)
        .eq('tenant_id', tenantId);
      if (error) throw new Error(error.message);
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== Mode Local (SQLite) =====
  const { c: activePOs } = db.prepare(
    `SELECT COUNT(*) AS c FROM purchase_orders WHERE supplier_id = ? AND tenant_id = ? AND status NOT IN ('cancelled')`
  ).get(id, tenantId) as { c: number };

  if (activePOs > 0) {
    return res.status(400).json({ error: 'Cannot deactivate supplier with active purchase orders' });
  }

  db.prepare(`UPDATE suppliers SET is_active = 0 WHERE id = ? AND tenant_id = ?`).run(id, tenantId);

  // Queue for sync to Supabase
  try {
    const { syncAfterWrite } = require('../../sync/sync-helper');
    syncAfterWrite('supplier', 'update', { id: Number(id), is_active: 0, tenant_id: tenantId });
  } catch (syncErr) {
    console.warn('[Suppliers] Could not queue deactivate sync:', syncErr);
  }

  res.json({ success: true });
});

export default router;
