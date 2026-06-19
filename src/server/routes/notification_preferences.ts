import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const router = express.Router();

// GET /api/notification_preferences - Get preferences for user/role
router.get('/', async (req: any, res) => {
  const { user_id, role } = req.query;
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  // Cloud mode: read from Supabase
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    let query = supabase.from('notification_preferences').select('*').eq('tenant_id', tenantId);

    if (user_id) {
      query = query.eq('user_id', Number(user_id));
    }
    if (role) {
      query = query.eq('role', role as string);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // Local mode
  const db = require('../db/database').db;
  if (!db) {
    return res.status(500).json({ error: 'SQLite not available' });
  }

  try {
    const params: any[] = [tenantId];
    let sql = 'SELECT * FROM notification_preferences WHERE tenant_id = ?';

    if (user_id) {
      sql += ' AND user_id = ?';
      params.push(Number(user_id));
    }
    if (role) {
      sql += ' AND role = ?';
      params.push(role as string);
    }
    sql += ' ORDER BY created_at DESC';

    const preferences = db.prepare(sql).all(...params);
    res.json(preferences);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notification_preferences - Create or update preferences
router.post('/', async (req: any, res) => {
  const { user_id, role, email_enabled, inapp_enabled, qr_orders, stock_alerts, daily_reports, inventory_summary, payment_failed, order_assigned, system_errors } = req.body;
  const tenantId = req.tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  if (user_id === undefined && role === undefined) {
    return res.status(400).json({ error: 'Either user_id or role is required' });
  }

  // Cloud mode: write to Supabase
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert({ 
        user_id: user_id ?? null,
        role: role ?? null,
        email_enabled: email_enabled ?? true,
        inapp_enabled: inapp_enabled ?? true,
        qr_orders: qr_orders ?? true,
        stock_alerts: stock_alerts ?? true,
        daily_reports: daily_reports ?? true,
        inventory_summary: inventory_summary ?? true,
        payment_failed: payment_failed ?? true,
        order_assigned: order_assigned ?? true,
        system_errors: system_errors ?? true,
        tenant_id: tenantId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,role,tenant_id' })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  // Local mode
  const db = require('../db/database').db;
  try {
    const exists = db.prepare(
      'SELECT id FROM notification_preferences WHERE user_id = ? AND role = ? AND tenant_id = ?'
    ).get(Number(user_id || 0), role as string || '', tenantId);

    let result;
    if (exists) {
      // Update existing
      result = db.prepare(`
        UPDATE notification_preferences SET
          email_enabled = ?, inapp_enabled = ?, qr_orders = ?, stock_alerts = ?,
          daily_reports = ?, inventory_summary = ?, payment_failed = ?, order_assigned = ?,
          system_errors = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND role = ? AND tenant_id = ?
      `).run(
        email_enabled ?? true, inapp_enabled ?? true, qr_orders ?? true, stock_alerts ?? true,
        daily_reports ?? true, inventory_summary ?? true, payment_failed ?? true, order_assigned ?? true,
        system_errors ?? true,
        Number(user_id || 0), role as string || '', tenantId
      );
    } else {
      // Insert new
      result = db.prepare(`
        INSERT INTO notification_preferences 
        (user_id, role, email_enabled, inapp_enabled, qr_orders, stock_alerts, daily_reports, inventory_summary, payment_failed, order_assigned, system_errors, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        Number(user_id || 0), role as string || '',
        email_enabled ?? true, inapp_enabled ?? true, qr_orders ?? true, stock_alerts ?? true,
        daily_reports ?? true, inventory_summary ?? true, payment_failed ?? true, order_assigned ?? true,
        system_errors ?? true, tenantId
      );
    }

    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;