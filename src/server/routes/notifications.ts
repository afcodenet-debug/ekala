import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const router = express.Router();

// GET /api/notifications - Get all notifications
router.get('/', async (req, res) => {
  const { user_id, role, unread_only } = req.query;

  // Cloud mode: read from Supabase
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    let query = supabase.from('notifications').select('*');

    if (unread_only === 'true') {
      query = query.is('read_at', null);
    }
    if (role) {
      query = query.eq('role', role as string);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // Local mode
  const db = require('../db/database').db;
  if (!db) {
    return res.status(500).json({ error: 'SQLite not available' });
  }

  try {
    let query = db.prepare(`
      SELECT n.*, u.full_name as user_name
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      ORDER BY n.created_at DESC
      LIMIT 100
    `);

    const notifications = query.all();
    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications - Create notification
router.post('/', async (req, res) => {
  const { type, title, message, priority, notification_type, metadata, link, user_id, role } = req.body;

  // Cloud mode: write to Supabase
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from('notifications')
      .insert({ type, title, message, priority, notification_type, metadata, link, user_id, role })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  // Local mode
  const db = require('../db/database').db;
  try {
    const result = db.prepare(
      'INSERT INTO notifications (type, title, message, priority, notification_type, metadata, link, user_id, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(type, title, message, priority || 'medium', notification_type, JSON.stringify(metadata || {}), link, user_id, role);

    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/notifications/:id/read - Mark as read
router.patch('/:id/read', async (req, res) => {
  const notificationId = req.params.id;

  // Cloud mode
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  // Local mode
  const db = require('../db/database').db;
  try {
    db.prepare('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ?').run(notificationId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;