import express from 'express';
import db from '../db/database';
import { env } from '../config/env';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Get all expenses
router.get('/', async (_req, res) => {
  if (!db) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Expenses] SQLite disabled and Supabase not configured. Returning empty list for GET /expenses');
      return res.status(200).json([]);
    }

    try {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
      });
      const { data, error } = await supabase
        .from('expenses')
        .select('id, description, amount, category, user_id, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Expenses Supabase] GET error:', error);
        return res.status(500).json({ error: 'Failed to fetch expenses from Supabase' });
      }

      return res.json(data || []);
    } catch (error: any) {
      console.error('[Expenses Supabase] GET error:', error);
      return res.status(500).json({ error: 'Failed to fetch expenses from Supabase' });
    }
  }

  try {
    // Use LEFT JOIN because user_id may not exist in older SQLite schemas
    let expenses: any[];
    try {
      expenses = db.prepare(`
        SELECT e.*, u.full_name as user_name
        FROM expenses e
        LEFT JOIN users u ON e.user_id = u.id
        ORDER BY e.created_at DESC
      `).all();
    } catch {
      // Fallback: user_id column may not exist yet
      expenses = db.prepare(`SELECT * FROM expenses ORDER BY created_at DESC`).all();
    }
    res.json(expenses);
  } catch (error) {
    console.error('[Expenses] GET error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Create new expense
router.post('/', async (req, res) => {
  const { description, amount, category, user_id } = req.body;

  if (!description || !amount || !category || !user_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!db) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Expenses] SQLite disabled and Supabase not configured. Cannot create expense.');
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    try {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
      });
      const { data, error } = await supabase.from('expenses').insert([
        {
          description,
          amount,
          category,
          user_id,
          created_at: new Date().toISOString()
        }
      ]).select('id');

      if (error) {
        console.error('[Expenses Supabase] POST error:', error);
        return res.status(500).json({ error: 'Failed to create expense in Supabase' });
      }

      return res.json({ id: data?.[0]?.id || null });
    } catch (error: any) {
      console.error('[Expenses Supabase] POST error:', error);
      return res.status(500).json({ error: 'Failed to create expense in Supabase' });
    }
  }

  try {
    const result = db.prepare(`
      INSERT INTO expenses (description, amount, category, user_id)
      VALUES (?, ?, ?, ?)
    `).run(description, amount, category, user_id);

    res.json({ id: result.lastInsertRowid });
  } catch (error) {
    console.error('[Expenses] POST error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Delete expense (admin/manager only)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (!db) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Expenses] SQLite disabled and Supabase not configured. Cannot delete expense.');
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    try {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
      });
      const { error } = await supabase.from('expenses').delete().eq('id', Number(id));

      if (error) {
        console.error('[Expenses Supabase] DELETE error:', error);
        return res.status(500).json({ error: 'Failed to delete expense in Supabase' });
      }

      return res.json({ success: true });
    } catch (error: any) {
      console.error('[Expenses Supabase] DELETE error:', error);
      return res.status(500).json({ error: 'Failed to delete expense in Supabase' });
    }
  }

  try {
    const result = db.prepare('DELETE FROM expenses WHERE id = ?').run(id);

    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Expense not found' });
    }
  } catch (error) {
    console.error('[Expenses] DELETE error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;