import express from 'express';
import db from '../db/database';
import { env } from '../config/env';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Log application errors
router.post('/', (req, res) => {
  const { level, message, stack, component_stack, user_id } = req.body;

  // Cloud mode: insert into Supabase
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES) {
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      supabase.from('app_logs').insert({ level, message: `${message}\n${stack || ''}`, user_id, component_stack }).then(({ error }) => {
        if (error) console.error('[Logs] Failed to insert:', error);
      });
    }
    return res.json({ success: true });
  }

  try {
    db.prepare(`
      INSERT INTO app_logs (level, message, user_id, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(level, `${message}\n${stack || ''}\n${component_stack || ''}`, user_id);

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to log error:', error);
    res.status(500).json({ error: 'Failed to log error' });
  }
});

// Get logs (admin only)
router.get('/', (req, res) => {
  // Cloud mode: read from Supabase
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    supabase.from('app_logs').select('*').order('created_at', { ascending: false }).limit(100).then(({ data, error }) => {
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    });
    return;
  }

  try {
    const logs = db.prepare(`
      SELECT l.*, u.full_name as user_name
      FROM app_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `).all();

    res.json(logs);
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;