// src/server/services/user.service.ts
//
// Service unifié pour la table `users` (POS staff).
// Suit le même pattern bidirectionnel que `TableService` :
//  - Mode cloud (RENDER_CLOUD_MODE ou db=null) : écrit directement dans Supabase.
//  - Mode local (SQLite actif) : INSERT/UPDATE/DELETE local + queue dans l'outbox
//    via `UserTenantSyncService.queueUserChange`. La pousse vers Supabase est
//    effectuée par `SyncOrchestrator` (pull + push) avec retry automatique.
//  - La pull depuis Supabase est faite par `UserTenantSyncService` dans son cycle.
//
// Pourquoi un service séparé ?
// ────────────────────────────
// Avant ce service, `src/server/routes/users.ts` faisait un INSERT/UPDATE/DELETE
// local direct SANS outbox. Conséquence : les nouveaux utilisateurs ou les
// modifications ne se répercutaient JAMAIS sur Supabase, alors que la table
// canonique est désormais Supabase. Ce service aligne la table `users` sur le
// pattern déjà éprouvé pour les `restaurant_tables` (cf. docs/bidirectional-table-sync.md).
//
// Colonnes requises pour la synchronisation bidirectionnelle :
//   users.remote_id     (BIGINT) — id Supabase (= `users.id` côté Supabase)
//   users.tenant_id     (INTEGER) — généralement 5
//   users.updated_at    (DATETIME) — pour last-write-wins lors du pull
//
// Ces colonnes sont garanties par `src/server/db/database.ts` (lignes 393-418)
// en local.

import db from '../db/database';
import { env } from '../config/env';
import { getUserTenantSyncService, withOutboxTransaction } from '../../sync';

export type UserRole = 'admin' | 'manager' | 'cashier' | 'waiter' | 'owner';

export interface User {
  id: number;
  full_name: string;
  username: string;
  phone: string | null;
  email: string | null;
  pin_code: string | null;
  role: UserRole;
  is_active: number;
  password_hash?: string | null;
  has_setup_pin?: number;
  remote_id?: number | null;
  tenant_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserCreateInput {
  full_name: string;
  username: string;
  phone?: string | null;
  email?: string | null;
  pin_code?: string | null;
  role: UserRole;
  is_active?: number;
  password_hash?: string | null;
  has_setup_pin?: number;
}

export interface UserUpdateInput {
  full_name?: string;
  username?: string;
  phone?: string | null;
  email?: string | null;
  pin_code?: string | null;
  role?: UserRole;
  is_active?: number;
  password_hash?: string | null;
  has_setup_pin?: number;
}

/**
 * Get all users (with optional Supabase fallback in cloud mode).
 * Always uses SQLite if db is available (the local mirror is the authoritative
 * read source for the local app; the SyncOrchestrator keeps it fresh).
 */
export class UserService {
  static async getAll(): Promise<User[]> {
    if (!db) {
      // Cloud mode: read from Supabase directly
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[UserService] No db and no Supabase configured. Returning empty users.');
        return [];
      }
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, username, phone, role, email, pin_code, is_active, created_at, password_hash, has_setup_pin')
          .order('full_name', { ascending: true });
        if (error) throw error;
        return (data || []) as User[];
      } catch (err: any) {
        console.error('[UserService] Supabase getAll failed:', err?.message || err);
        throw new Error('Failed to fetch users via Supabase');
      }
    }

    // Local mode: read from SQLite (the sync orchestrator keeps it in sync)
    try {
      const rows = db.prepare(`
        SELECT id, full_name, username, phone, role, email, pin_code, is_active,
               password_hash, has_setup_pin, remote_id, tenant_id,
               created_at, updated_at
        FROM users
        ORDER BY full_name ASC
      `).all() as User[];
      return rows;
    } catch (error) {
      console.error('[UserService] getAll error:', error);
      throw new Error('Failed to fetch users');
    }
  }

  /**
   * Create a new user.
   *
   * Behavior is CONSISTENT across modes:
   *  - Cloud mode (no local db): insert directly in Supabase.
   *  - Local mode: insert in SQLite + queue an outbox entry so the
   *    SyncOrchestrator pushes it to Supabase. The local write is durable,
   *    the Supabase write is retried automatically.
   */
  static async create(input: UserCreateInput): Promise<User> {
    const tenantId = Number(process.env.SYNC_TENANT_ID || '5');

    if (!db || env.RENDER_CLOUD_MODE) {
      // ── Cloud mode: direct Supabase write ──
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase not configured');
      }
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        const normalizedEmail =
          typeof input.email === 'string' && input.email.trim().length > 0
            ? input.email.trim().toLowerCase()
            : null;

        const { data, error } = await supabase
          .from('users')
          .upsert([{
            full_name: input.full_name,
            username: input.username,
            phone: input.phone ?? null,
            email: normalizedEmail,
            pin_code: input.pin_code ?? null,
            role: input.role,
            is_active: (input.is_active ?? 1) === 1,
            password_hash: input.password_hash ?? null,
            has_setup_pin: (input.has_setup_pin ?? 0) === 1,
            tenant_id: tenantId,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }], { onConflict: 'username' })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error(`Username "${input.username}" existe déjà.`);
          }
          throw new Error(`Erreur Supabase: ${error.message}`);
        }

        return data as User;
      } catch (err: any) {
        console.error('[UserService] Supabase create failed:', err?.message || err);
        throw new Error(err.message || 'Échec de la création de l\'utilisateur');
      }
    }

    // ── Local mode: SQLite + outbox ──
    try {
      return withOutboxTransaction(db, String(tenantId), () => {
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(input.username);
        if (existing) {
          throw new Error(`Username "${input.username}" existe déjà.`);
        }

        const normalizedEmail =
          typeof input.email === 'string' && input.email.trim().length > 0
            ? input.email.trim().toLowerCase()
            : null;

        const now = new Date().toISOString();
        const result = db.prepare(`
          INSERT INTO users (
            full_name, username, phone, pin_code, role, email, is_active,
            password_hash, has_setup_pin, tenant_id,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          input.full_name,
          input.username,
          input.phone ?? null,
          input.pin_code ?? null,
          input.role,
          normalizedEmail,
          input.is_active ?? 1,
          input.password_hash ?? null,
          input.has_setup_pin ?? 0,
          tenantId,
          now,
          now
        );

        if (!result.lastInsertRowid) {
          throw new Error('Échec de la création de l\'utilisateur en local');
        }

        const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid)) as User;
        if (!newUser) throw new Error('Échec de récupération de l\'utilisateur créé');

        // Queue the change for Supabase push via the SyncOrchestrator.
        try {
          const userTenantService = getUserTenantSyncService();
          if (userTenantService) {
            userTenantService.queueUserChange('insert', newUser);
          } else {
            console.warn('[UserService] UserTenantSyncService not initialized — user will not be pushed to Supabase. Make sure initializeUserTenantSync() is called.');
          }
        } catch (syncErr) {
          console.warn('[UserService] Failed to queue user for sync:', syncErr);
        }

        return newUser;
      });
    } catch (error: any) {
      console.error('[UserService] Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update an existing user.
   * Same dual-mode pattern as `create()`.
   */
  static async update(id: number, updates: UserUpdateInput): Promise<User> {
    const tenantId = Number(process.env.SYNC_TENANT_ID || '5');

    if (!db || env.RENDER_CLOUD_MODE) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase not configured');
      }
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        const payload: Record<string, any> = { updated_at: new Date().toISOString() };
        if (updates.full_name !== undefined) payload.full_name = updates.full_name;
        if (updates.username !== undefined) payload.username = updates.username;
        if (updates.phone !== undefined) payload.phone = updates.phone;
        if (updates.email !== undefined) {
          payload.email =
            typeof updates.email === 'string' && updates.email.trim().length > 0
              ? updates.email.trim().toLowerCase()
              : null;
        }
        if (updates.pin_code !== undefined) payload.pin_code = updates.pin_code;
        if (updates.role !== undefined) payload.role = updates.role;
        if (updates.is_active !== undefined) payload.is_active = updates.is_active === 1;
        if (updates.password_hash !== undefined) payload.password_hash = updates.password_hash;
        if (updates.has_setup_pin !== undefined) payload.has_setup_pin = updates.has_setup_pin === 1;
        if (tenantId) {
          payload.tenant_id = tenantId;
        }

        const { data, error } = await supabase
          .from('users')
          .update(payload)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error('Username ou email déjà utilisé par un autre utilisateur.');
          }
          throw new Error(`Erreur Supabase: ${error.message}`);
        }
        if (!data) throw new Error('Utilisateur non trouvé');
        return data as User;
      } catch (err: any) {
        console.error('[UserService] Supabase update failed:', err?.message || err);
        throw err;
      }
    }

    // ── Local mode: SQLite + outbox ──
    try {
      return withOutboxTransaction(db, String(tenantId), () => {
        const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
        if (!existing) throw new Error('User not found');

        // Uniqueness checks
        if (updates.username && updates.username !== existing.username) {
          const dupUsername = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(updates.username, id);
          if (dupUsername) throw new Error(`Username "${updates.username}" est déjà utilisé.`);
        }
        if (updates.email !== undefined && updates.email !== null) {
          const normalizedEmail = String(updates.email).trim().toLowerCase();
          if (normalizedEmail && normalizedEmail !== (existing.email || '').toLowerCase()) {
            const dupEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, id);
            if (dupEmail) throw new Error('Cet email est déjà utilisé par un autre utilisateur.');
          }
        }

        const updateFields: string[] = [];
        const values: any[] = [];

        const setField = (key: string, value: any) => {
          if (value !== undefined) {
            updateFields.push(`${key} = ?`);
            values.push(value);
          }
        };

        setField('full_name', updates.full_name);
        setField('username', updates.username);
        setField('phone', updates.phone);
        if (updates.email !== undefined) {
          setField(
            'email',
            typeof updates.email === 'string' && updates.email.trim().length > 0
              ? updates.email.trim().toLowerCase()
              : null
          );
        }
        setField('pin_code', updates.pin_code);
        setField('role', updates.role);
        setField('is_active', updates.is_active);
        setField('password_hash', updates.password_hash);
        setField('has_setup_pin', updates.has_setup_pin);

        if (updateFields.length === 0) {
          return existing;
        }

        updateFields.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);

        db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);

        const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User;
        if (!updated) throw new Error('Failed to retrieve updated user');

        try {
          const userTenantService = getUserTenantSyncService();
          if (userTenantService) {
            userTenantService.queueUserChange('update', updated);
          } else {
            console.warn('[UserService] UserTenantSyncService not initialized — user will not be pushed to Supabase.');
          }
        } catch (syncErr) {
          console.warn('[UserService] Failed to queue user update for sync:', syncErr);
        }

        return updated;
      });
    } catch (error: any) {
      console.error('[UserService] Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete a user. Same dual-mode pattern.
   * Note: physical delete in local mode (kept consistent with the previous
   * behavior in `routes/users.ts`); the outbox entry will cause a hard delete
   * in Supabase as well.
   */
  static async delete(id: number): Promise<boolean> {
    const tenantId = Number(process.env.SYNC_TENANT_ID || '5');

    if (!db || env.RENDER_CLOUD_MODE) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase not configured');
      }
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        // Refuse if user has active orders
        const { count, error: countErr } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('waiter_id', id)
          .in('status', ['pending', 'confirmed', 'preparing', 'ready']);
        if (countErr) throw countErr;
        if (count && count > 0) {
          throw new Error('Cannot delete user with active orders');
        }

        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
        return true;
      } catch (err: any) {
        console.error('[UserService] Supabase delete failed:', err?.message || err);
        throw new Error(err?.message || 'Failed to delete user via Supabase');
      }
    }

    // ── Local mode: SQLite + outbox ──
    try {
      return withOutboxTransaction(db, String(tenantId), () => {
        const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id) as { id: number } | undefined;
        if (!user) return false;

        const activeOrders = db.prepare(`
          SELECT COUNT(*) as count
          FROM orders
          WHERE waiter_id = ? AND status NOT IN ('paid', 'cancelled')
        `).get(id) as { count: number };

        if (activeOrders.count > 0) {
          throw new Error('Cannot delete user with active orders');
        }

        const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);

        if (result.changes > 0) {
          try {
            const userTenantService = getUserTenantSyncService();
            if (userTenantService) {
              userTenantService.queueUserChange('delete', { id });
            } else {
              console.warn('[UserService] UserTenantSyncService not initialized — user deletion will not be pushed to Supabase.');
            }
          } catch (syncErr) {
            console.warn('[UserService] Failed to queue user deletion for sync:', syncErr);
          }
        }

        return result.changes > 0;
      });
    } catch (error: any) {
      console.error('[UserService] Error deleting user:', error);
      throw error;
    }
  }
}

export default UserService;
