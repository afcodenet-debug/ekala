import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const router = express.Router();

// GET /api/scheduled_reports_log - Get scheduled reports log
router.get('/', async (req, res) => {
  const { report_type, limit } = req.query;

  // Cloud mode: read from Supabase
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    let query = supabase.from('scheduled_reports_log').select('*');

    if (report_type) {
      query = query.eq('report_type', report_type as string);
    }

    const { data, error } = await query
      .order('run_at', { ascending: false })
      .limit(Number(limit || 50));
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
      SELECT * FROM scheduled_reports_log
      ORDER BY run_at DESC
      LIMIT ?
    `);

    const params: any[] = [];
    if (report_type) {
      query = db.prepare(`
        SELECT * FROM scheduled_reports_log
        WHERE report_type = ?
        ORDER BY run_at DESC
        LIMIT ?
      `);
      params.push(report_type as string, Number(limit || 50));
    } else {
      params.push(Number(limit || 50));
    }

    const logs = query.all(...params);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;