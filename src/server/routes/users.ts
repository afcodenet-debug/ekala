import express from 'express';
import db from '../db/database';
import { requireRole } from '../middleware/auth';
import { env } from '../config/env';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

/**
 * Get all users
 * Includes `email` (nullable + unique, may be null for users without email).
 */
router.get('/', async (_req, res) => {
  try {
    if (!db) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[Users] SQLite disabled and Supabase not configured. Returning empty users list.');
        return res.json({ users: [] });
      }

      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
      });
      const { data: users, error } = await supabase
        .from('users')
        .select('id, full_name, username, phone, role, email, pin_code, is_active, created_at')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('[Users Supabase] Failed to fetch users:', error);
        return res.status(500).json({ error: 'Failed to fetch users from Supabase' });
      }

      return res.json({ users: users || [] });
    }

    const users = db.prepare(`
      SELECT id, full_name, username, phone, role, email, pin_code, is_active, created_at
      FROM users
      ORDER BY full_name ASC
    `).all();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

 // Create new user
router.post('/', requireRole(['admin', 'manager']), (req, res) => {
  console.log('*** USERS POST handler hit ***', {
    originalUrl: req.originalUrl,
    method: req.method,
    email: req.body?.email,
    body: req.body
  });
  const { full_name, username, phone, pin_code, role, email } = req.body;

  const normalizedEmail =
    typeof email === 'string' && email.trim().length > 0 ? email.trim().toLowerCase() : null;

  try {
    const stmt = db.prepare(`
      INSERT INTO users (full_name, username, phone, pin_code, role, email, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    const result = stmt.run(full_name, username, phone, pin_code, role, normalizedEmail);

    res.status(201).json({
      id: result.lastInsertRowid,
      full_name,
      role,
      email: normalizedEmail
    });
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE')) {
      if (error.message.includes('email')) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }
      return res.status(400).json({ error: 'Username ou téléphone déjà existant' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

 // Update user (including email, which is nullable + unique)
router.patch('/:id', requireRole(['admin', 'manager']), (req, res) => {
  const { id } = req.params;
  console.log('*** USERS PATCH handler hit ***', {
    id,
    originalUrl: req.originalUrl,
    method: req.method,
    email: req.body?.email,
    body: req.body
  });
  const body = req.body ?? {};

  const hasEmailField = Object.prototype.hasOwnProperty.call(body, 'email');

  const {
    full_name,
    username,
    phone,
    role,
    is_active,
    pin_code,
    email
  } = body;

  // Important:
  // - if email is NOT provided: do not touch email column
  // - if email is provided as "" => set NULL
  const normalizedEmail = typeof email === 'string'
    ? (email.trim().length > 0 ? email.trim().toLowerCase() : null)
    : null;

  try {
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (hasEmailField) {
      db.prepare(`
        UPDATE users
        SET
          full_name = COALESCE(?, full_name),
          username = COALESCE(?, username),
          phone = COALESCE(?, phone),
          role = COALESCE(?, role),
          email = ?,
          is_active = COALESCE(?, is_active),
          pin_code = COALESCE(?, pin_code)
        WHERE id = ?
      `).run(
        full_name ?? null,
        username ?? null,
        phone ?? null,
        role ?? null,
        normalizedEmail,
        is_active === undefined ? null : is_active,
        pin_code === undefined ? null : (pin_code || null),
        id
      );
    } else {
      db.prepare(`
        UPDATE users
        SET
          full_name = COALESCE(?, full_name),
          username = COALESCE(?, username),
          phone = COALESCE(?, phone),
          role = COALESCE(?, role),
          is_active = COALESCE(?, is_active),
          pin_code = COALESCE(?, pin_code)
        WHERE id = ?
      `).run(
        full_name ?? null,
        username ?? null,
        phone ?? null,
        role ?? null,
        is_active === undefined ? null : is_active,
        pin_code === undefined ? null : (pin_code || null),
        id
      );
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[USERS PATCH] error:', {
      id,
      body,
      hasEmailField,
      email,
      normalizedEmail,
      pin_code,
      role,
      is_active,
      roleType: typeof role,
      isActiveType: typeof is_active,
      pinCodeType: typeof pin_code,
      message: error?.message,
      stack: error?.stack
    });

    if (error?.message?.includes('UNIQUE') && error?.message?.includes('email')) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre utilisateur' });
    }
    if (error?.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Contrainte UNIQUE violée' });
    }
    res.status(500).json({
      error: 'Failed to update user',
      details: {
        message: error?.message ?? String(error),
        stack: error?.stack
      }
    });
  }
});

// Delete user (Soft delete by deactivating is safer, but here physical delete if requested)
router.delete('/:id', requireRole(['admin', 'manager']), (req, res) => {
  const { id } = req.params;
  try {
    // Check if user has active orders
    const orders = db.prepare('SELECT id FROM orders WHERE waiter_id = ? AND status NOT IN ("paid", "cancelled")').get(id);
    if (orders) return res.status(400).json({ error: 'Cannot delete user with active orders' });

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
