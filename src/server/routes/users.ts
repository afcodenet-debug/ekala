import express from 'express';
import { requireRole } from '../middleware/auth';
import { UserService, UserRole } from '../services/user.service';

const router = express.Router();

/**
 * Get all users
 * Includes `email` (nullable + unique, may be null for users without email).
 *
 * In local mode, reads from SQLite (the local mirror is kept in sync by
 * SyncOrchestrator via the user/tenant sync service). In cloud mode, reads
 * directly from Supabase.
 */
router.get('/', async (req, res) => {
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
  try {
    const users = await UserService.getAll(tenantId);
    res.json({ users });
  } catch (error: any) {
    console.error('[Users] GET / failed:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: error?.message });
  }
});

router.get('/:id', async (req, res) => {
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
  const id = Number(req.params.id);
  try {
    const user = await UserService.getById(tenantId, id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error: any) {
    console.error('[Users] GET /:id failed:', error);
    res.status(500).json({ error: 'Failed to fetch user', details: error?.message });
  }
});

/**
 * Create a new user.
 *
 * Routes through `UserService.create()` so the change is:
 *  - applied locally (SQLite), AND
 *  - queued in the sync outbox for push to Supabase
 *  - (in cloud mode) applied directly to Supabase.
 *
 * This makes user creation truly bidirectional (local edits reach Supabase
 * and vice-versa), matching the pattern of `restaurant_tables`.
 */
router.post('/', requireRole(['owner', 'admin', 'manager']), async (req, res) => {
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
  const { full_name, username, phone, pin_code, role, email, is_active } = req.body ?? {};

  try {
    if (!full_name || !username || !role) {
      return res.status(400).json({ error: 'full_name, username et role sont obligatoires' });
    }

    const created = await UserService.create(tenantId, {
      full_name,
      username,
      phone: phone ?? null,
      pin_code: pin_code ?? null,
      role: role as UserRole,
      email: email ?? null,
      is_active: typeof is_active === 'number' ? is_active : 1,
    }, (req as any).user?.role);

    res.status(201).json({
      id: created.id,
      full_name: created.full_name,
      role: created.role,
      email: created.email,
    });
  } catch (error: any) {
    if (error?.message?.includes('Seuls les utilisateurs')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    if (error?.message?.includes('UNIQUE') || error?.message?.includes('existe déjà') || error?.message?.includes('déjà utilisé')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[Users] POST / failed:', error);
    res.status(500).json({ error: 'Failed to create user', details: error?.message });
  }
});

/**
 * Update user (including email, which is nullable + unique).
 *
 * Behavior mirrors `UserService.create()`: applies locally + queues outbox for
 * Supabase push, or writes directly to Supabase in cloud mode.
 */
router.patch('/:id', requireRole(['owner', 'admin', 'manager']), async (req, res) => {
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
  const id = Number(req.params.id);
  const body = req.body ?? {};
  const { full_name, username, phone, role, is_active, pin_code, email } = body;

  try {
    const updated = await UserService.update(tenantId, id, {
      full_name,
      username,
      phone,
      role: role as UserRole | undefined,
      is_active,
      pin_code,
      email,
    }, (req as any).user?.role);

    res.json({ success: true, user: { id: updated.id, full_name: updated.full_name, role: updated.role, email: updated.email } });
  } catch (error: any) {
    if (error?.message?.includes('Seuls les utilisateurs')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    if (error?.message?.includes('not found') || error?.message?.includes('non trouvé')) {
      return res.status(404).json({ error: error.message });
    }
    if (error?.message?.includes('UNIQUE') || error?.message?.includes('déjà utilisé') || error?.message?.includes('existe déjà')) {
      return res.status(400).json({ error: error.message });
    }
    if (error?.message?.includes('active orders')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[Users] PATCH /:id failed:', error);
    res.status(500).json({ error: 'Failed to update user', details: error?.message });
  }
});

/**
 * Delete user.
 *
 * Refuses if the user has active orders. In local mode, deletion is local +
 * queued in outbox for sync to Supabase. In cloud mode, deletion hits Supabase
 * directly.
 */
router.delete('/:id', requireRole(['owner', 'admin', 'manager']), async (req, res) => {
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }
  const id = Number(req.params.id);

  try {
    const ok = await UserService.delete(tenantId, id);
    res.json({ success: ok });
  } catch (error: any) {
    if (error?.message?.includes('active orders')) {
      return res.status(400).json({ error: error.message });
    }
    if (error?.message?.includes('not found') || error?.message?.includes('non trouvé')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('[Users] DELETE /:id failed:', error);
    res.status(500).json({ error: 'Failed to delete user', details: error?.message });
  }
});

export default router;