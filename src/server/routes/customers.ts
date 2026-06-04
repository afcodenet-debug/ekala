import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const router = express.Router();

// Get all customers
router.get('/', async (req, res) => {
  // Cloud mode: read from Supabase
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(Array.isArray(data) ? data : []);
  }

  // Local mode: read from SQLite
  const db = require('../db/database').db;
  if (!db) {
    return res.status(500).json({ error: 'SQLite not available' });
  }

  try {
    const customers = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create customer
router.post('/', async (req, res) => {
  const { phone_number, name, pin_code, email } = req.body;

  if (!phone_number) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // Cloud mode: write to Supabase
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    
    const { data, error } = await supabase
      .from('customers')
      .insert({ phone_number, name, pin_code, email })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  // Local mode
  const db = require('../db/database').db;
  try {
    const result = db.prepare(
      'INSERT INTO customers (phone_number, name, pin_code, email) VALUES (?, ?, ?, ?)'
    ).run(phone_number, name, pin_code, email);
    res.status(201).json({ id: result.lastInsertRowid, phone_number, name, pin_code, email });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;