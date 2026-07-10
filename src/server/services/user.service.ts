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
  /**
   * Get all users for a specific tenant.
   * @param tenantId - The tenant ID (required, must be provided by authenticated request)
   */
  static async getAll(tenantId: number): Promise<User[]> {
    if (!tenantId) {
      throw new Error('tenantId is required');
    }

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
          .eq('tenant_id', tenantId)
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
        WHERE tenant_id = ?
        ORDER BY full_name ASC
      `).all(tenantId) as User[];
      return rows;
    } catch (error) {
      console.error('[UserService] getAll error:', error);
      throw new Error('Failed to fetch users');
    }
  }

  /**
   * Get a single user by ID.
   * @param tenantId - The tenant ID (required)
   * @param id - The user ID to fetch
   */
  static async getById(tenantId: number, id: number): Promise<User | null> {
    if (!tenantId) {
      throw new Error('tenantId is required');
    }

    if (!db) {
      // Cloud mode: read from Supabase directly
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[UserService] No db and no Supabase configured. Returning null.');
        return null;
      }
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, username, phone, role, email, pin_code, is_active, created_at, password_hash, has_setup_pin, remote_id, tenant_id')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .single();
        if (error) throw error;
        return data as User | null;
      } catch (err: any) {
        console.error('[UserService] Supabase getById failed:', err?.message || err);
        throw new Error('Failed to fetch user via Supabase');
      }
    }

    // Local mode: read from SQLite
    try {
      const row = db.prepare(`
        SELECT id, full_name, username, phone, role, email, pin_code, is_active,
               password_hash, has_setup_pin, remote_id, tenant_id,
               created_at, updated_at
        FROM users
        WHERE id = ? AND tenant_id = ?
      `).get(id, tenantId) as User | undefined;
      return row || null;
    } catch (error) {
      console.error('[UserService] getById error:', error);
      throw new Error('Failed to fetch user');
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
  /**
      * Create a new user for a specific tenant.
      * @param tenantId - The tenant ID (required)
      * @param input - User creation data
      * @param requesterRole - The role of the user making the request (for owner-only restrictions)
      */
  static async create(tenantId: number, input: UserCreateInput, requesterRole?: UserRole): Promise<User> {
     if (!tenantId) {
       throw new Error('tenantId is required');
     }

     // Security: Only owners can create other owners
     if (input.role === 'owner' && requesterRole !== 'owner') {
       throw new Error('Seuls les utilisateurs ayant le rôle "owner" peuvent créer des utilisateurs avec ce rôle');
     }

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

        const bcrypt = require('bcryptjs');
        const passwordHash = input.password_hash || bcrypt.hashSync('admin123', 10);
        const hashedPin = input.pin_code ? bcrypt.hashSync(String(input.pin_code), 10) : null;

        const { data, error } = await supabase
          .from('users')
          .upsert([{
            full_name: input.full_name,
            username: input.username,
            phone: input.phone ?? null,
            email: normalizedEmail,
            pin_code: hashedPin,
            role: input.role,
            is_active: (input.is_active ?? 1) === 1,
            password_hash: passwordHash,
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
        const existing = db.prepare('SELECT id FROM users WHERE username = ? AND tenant_id = ?').get(input.username, tenantId);
        if (existing) {
          throw new Error(`Username "${input.username}" existe déjà.`);
        }

        // Check email uniqueness per tenant
        if (input.email && input.email.trim().length > 0) {
          const normalizedEmail = input.email.trim().toLowerCase();
          const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? AND tenant_id = ?').get(normalizedEmail, tenantId);
          if (existingEmail) {
            throw new Error(`L'email "${normalizedEmail}" existe déjà pour ce locataire.`);
          }
        }

        const normalizedEmail =
          typeof input.email === 'string' && input.email.trim().length > 0
            ? input.email.trim().toLowerCase()
            : null;

        const bcrypt = require('bcryptjs');
        const passwordHash = input.password_hash || bcrypt.hashSync('admin123', 10);
        const hashedPin = input.pin_code ? bcrypt.hashSync(String(input.pin_code), 10) : null;

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
          hashedPin,
          input.role,
          normalizedEmail,
          input.is_active ?? 1,
          passwordHash,
          input.has_setup_pin ?? 0,
          tenantId,
          now,
          now
        );

        if (!result.lastInsertRowid) {
          throw new Error('Échec de la création de l\'utilisateur en local');
        }

        const newUser = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(Number(result.lastInsertRowid), tenantId) as User;
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
/**
    * Update an existing user for a specific tenant.
    * @param tenantId - The tenant ID (required)
    * @param id - User ID to update
    * @param updates - Fields to update
    * @param requesterRole - The role of the user making the request (for owner-only restrictions)
    */
static async update(tenantId: number, id: number, updates: UserUpdateInput, requesterRole?: UserRole): Promise<User> {
     if (!tenantId) {
       throw new Error('tenantId is required');
     }

     // Security: Only owners can update a user to owner role
     if (updates.role === 'owner' && requesterRole !== 'owner') {
       throw new Error('Seuls les utilisateurs ayant le rôle "owner" peuvent attribuer le rôle "owner"');
     }

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
        if (updates.pin_code !== undefined) {
          const bcrypt = require('bcryptjs');
          let hashedPin = updates.pin_code;
          // Only hash if it's not already a bcrypt hash
          if (hashedPin && !hashedPin.startsWith('$2')) {
            hashedPin = bcrypt.hashSync(String(hashedPin), 10);
          }
          payload.pin_code = hashedPin;
        }
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
          .eq('tenant_id', tenantId)
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
        const existing = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(id, tenantId) as User | undefined;
        if (!existing) throw new Error('User not found');

        // Uniqueness checks
        if (updates.username && updates.username !== existing.username) {
          const dupUsername = db.prepare('SELECT id FROM users WHERE username = ? AND id != ? AND tenant_id = ?').get(updates.username, id, tenantId);
          if (dupUsername) throw new Error(`Username "${updates.username}" est déjà utilisé.`);
        }
        if (updates.email !== undefined && updates.email !== null) {
          const normalizedEmail = String(updates.email).trim().toLowerCase();
          if (normalizedEmail && normalizedEmail !== (existing.email || '').toLowerCase()) {
            const dupEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id != ? AND tenant_id = ?').get(normalizedEmail, id, tenantId);
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
        if (updates.pin_code !== undefined) {
          const bcrypt = require('bcryptjs');
          let hashedPin = updates.pin_code;
          // Only hash if it's not already a bcrypt hash
          if (hashedPin && !hashedPin.startsWith('$2')) {
            hashedPin = bcrypt.hashSync(String(hashedPin), 10);
          }
          setField('pin_code', hashedPin);
        }
        setField('role', updates.role);
        setField('is_active', updates.is_active);
        setField('password_hash', updates.password_hash);
        setField('has_setup_pin', updates.has_setup_pin);

        if (updateFields.length === 0) {
          return existing;
        }

        updateFields.push('updated_at = ?');
        values.push(new Date().toISOString());
        
        // Add ID and tenant_id to WHERE
        values.push(id);
        values.push(tenantId);

        db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...values);

        const updated = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(id, tenantId) as User;
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
  /**
   * Delete a user for a specific tenant.
   * @param tenantId - The tenant ID (required)
   * @param id - User ID to delete
   */
  static async delete(tenantId: number, id: number): Promise<boolean> {
    if (!tenantId) {
      throw new Error('tenantId is required');
    }

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
          .eq('tenant_id', tenantId)
          .in('status', ['pending', 'confirmed', 'preparing', 'ready']);
        if (countErr) throw countErr;
        if (count && count > 0) {
          throw new Error('Cannot delete user with active orders');
        }

        const { error } = await supabase.from('users').delete().eq('id', id).eq('tenant_id', tenantId);
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
        const user = db.prepare('SELECT id, remote_id FROM users WHERE id = ? AND tenant_id = ?').get(id, tenantId) as { id: number, remote_id: number | null } | undefined;
        if (!user) return false;

        const activeOrders = db.prepare(`
          SELECT COUNT(*) as count
          FROM orders
          WHERE waiter_id = ? AND tenant_id = ? AND status NOT IN ('paid', 'cancelled')
        `).get(id, tenantId) as { count: number };

        if (activeOrders.count > 0) {
          throw new Error('Cannot delete user with active orders');
        }

        const result = db.prepare('DELETE FROM users WHERE id = ? AND tenant_id = ?').run(id, tenantId);

        if (result.changes > 0) {
          try {
            const userTenantService = getUserTenantSyncService();
            if (userTenantService) {
              userTenantService.queueUserChange('delete', { id: user.id, remote_id: user.remote_id });
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
