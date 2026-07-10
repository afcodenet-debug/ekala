/**
 * IDENTITY RESOLUTION SERVICE — Canonical user ID mapping across SQLite ↔ Supabase
 * 
 * Résout le problème critique des IDs incompatibles entre :
 *   - SQLite (auto-increment integers: 1, 2, 3...)
 *   - Supabase (UUIDs or integer IDs)
 *   - Frontend (local IDs)
 * 
 * Solution : **canonical_user_id** (UUID global) comme seul identifiant de relation.
 * 
 * Règles strictes :
 * 1. Aucune relation FK ne doit utiliser SQLite id directement
 * 2. Aucune relation FK ne doit utiliser Supabase id directement
 * 3. UNIQUEMENT canonical_user_id pour les relations cross-system
 * 
 * Mapping : canonical_id → { sqlite_id, supabase_id, remote_id }
 */

import crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface IdentityMapping {
  canonical_id: string;     // UUID global — SEUL identifiant pour les relations
  sqlite_id: number | null; // ID SQLite local (auto-increment)
  supabase_id: string | null; // ID Supabase (UUID ou integer)
  remote_id: number | null; // remote_id for sync
  tenant_id: number | null;
  user_type: 'staff' | 'admin' | 'customer' | 'system';
  created_at: string;
  updated_at: string;
}

export interface CanonicalUser {
  canonical_id: string;
  display_name: string;
  role: string;
  tenant_id: number | null;
}

// ── Identity Resolution Service ────────────────────────────────────────────────

export class IdentityResolutionService {
  private static instance: IdentityResolutionService;

  private constructor() {}

  static getInstance(): IdentityResolutionService {
    if (!IdentityResolutionService.instance) {
      IdentityResolutionService.instance = new IdentityResolutionService();
    }
    return IdentityResolutionService.instance;
  }

  /**
   * Génère un canonical_id (UUID v4).
   */
  generateCanonicalId(): string {
    return crypto.randomUUID();
  }

  /**
   * Enregistre un mapping d'identité dans la table identity_map.
   */
  registerMapping(mapping: {
    canonical_id?: string;
    sqlite_id?: number | null;
    supabase_id?: string | null;
    remote_id?: number | null;
    tenant_id?: number | null;
    user_type?: 'staff' | 'admin' | 'customer' | 'system';
  }): IdentityMapping | null {
    const canonical_id = mapping.canonical_id || this.generateCanonicalId();
    const now = new Date().toISOString();

    try {
      const db = require('../db/database').default;
      if (!db) return null;

      // Check if mapping already exists for this SQLite ID or Supabase ID
      let existing: IdentityMapping | null = null;
      
      if (mapping.sqlite_id) {
        existing = this.getBySqliteId(mapping.sqlite_id);
      }
      if (!existing && mapping.supabase_id) {
        existing = this.getBySupabaseId(mapping.supabase_id);
      }
      if (!existing && mapping.remote_id) {
        existing = this.getByRemoteId(mapping.remote_id);
      }

      if (existing) {
        // Update existing mapping
        db.prepare(`
          UPDATE identity_map SET
            supabase_id = COALESCE(?, supabase_id),
            remote_id = COALESCE(?, remote_id),
            tenant_id = COALESCE(?, tenant_id),
            user_type = COALESCE(?, user_type),
            updated_at = ?
          WHERE canonical_id = ?
        `).run(
          mapping.supabase_id || null,
          mapping.remote_id || null,
          mapping.tenant_id || null,
          mapping.user_type || null,
          now,
          existing.canonical_id,
        );

        return this.getByCanonicalId(existing.canonical_id);
      }

      // Create new mapping
      db.prepare(`
        INSERT INTO identity_map 
          (canonical_id, sqlite_id, supabase_id, remote_id, tenant_id, user_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        canonical_id,
        mapping.sqlite_id || null,
        mapping.supabase_id || null,
        mapping.remote_id || null,
        mapping.tenant_id || null,
        mapping.user_type || 'staff',
        now,
        now,
      );

      return this.getByCanonicalId(canonical_id);
    } catch (err: any) {
      console.error('[IdentityResolution] Register mapping error:', err.message);
      return null;
    }
  }

  /**
   * Résout un ID utilisateur quel que soit le système source.
   * Accepte : canonical_id, sqlite_id, supabase_id, remote_id
   * Retourne le mapping complet.
   */
  resolve(input_id: string | number): IdentityMapping | null {
    const strId = String(input_id);
    const numId = typeof input_id === 'number' ? input_id : parseInt(input_id, 10);

    // Try each ID type
    let result = this.getByCanonicalId(strId);
    if (result) return result;

    if (!isNaN(numId)) {
      result = this.getBySqliteId(numId);
      if (result) return result;
      result = this.getByRemoteId(numId);
      if (result) return result;
    }

    result = this.getBySupabaseId(strId);
    if (result) return result;

    return null;
  }

  /**
   * Résout un waiter ID pour assignation de table.
   * Si le waiter n'existe pas dans Supabase, le crée automatiquement.
   */
  async resolveForTableAssignment(waiter_id: number | string, tenant_id: number): Promise<{ canonical_id: string; supabase_id: string | null } | null> {
    // 1. Try to resolve existing mapping
    const existing = this.resolve(waiter_id);
    if (existing) {
      // If we have a canonical ID but no Supabase ID, try to sync
      if (!existing.supabase_id) {
        await this.syncToSupabase(existing.canonical_id);
        const updated = this.getByCanonicalId(existing.canonical_id);
        if (updated?.supabase_id) {
          return { canonical_id: updated.canonical_id, supabase_id: updated.supabase_id };
        }
      }
      return { canonical_id: existing.canonical_id, supabase_id: existing.supabase_id };
    }

    // 2. Not found — check if user exists in SQLite
    try {
      const db = require('../db/database').default;
      if (!db) return null;

      const user = db.prepare('SELECT * FROM users WHERE id = ? OR remote_id = ?').get(waiter_id, waiter_id) as any;
      if (!user) return null;

      // 3. Create mapping
      const mapping = this.registerMapping({
        sqlite_id: user.id,
        remote_id: user.remote_id,
        tenant_id,
        user_type: user.role === 'admin' ? 'admin' : 'staff',
      });

      if (!mapping) return null;

      // 4. Try to sync to Supabase
      await this.syncToSupabase(mapping.canonical_id);
      const updated = this.getByCanonicalId(mapping.canonical_id);

      return { canonical_id: mapping.canonical_id, supabase_id: updated?.supabase_id || null };
    } catch {
      return null;
    }
  }

  /**
   * Récupère un mapping par canonical_id.
   */
  getByCanonicalId(canonical_id: string): IdentityMapping | null {
    try {
      const db = require('../db/database').default;
      if (!db) return null;

      const row = db.prepare('SELECT * FROM identity_map WHERE canonical_id = ?').get(canonical_id) as any;
      return row ? this.rowToMapping(row) : null;
    } catch {
      return null;
    }
  }

  /**
   * Récupère un mapping par SQLite ID.
   */
  getBySqliteId(sqlite_id: number): IdentityMapping | null {
    try {
      const db = require('../db/database').default;
      if (!db) return null;

      const row = db.prepare('SELECT * FROM identity_map WHERE sqlite_id = ?').get(sqlite_id) as any;
      return row ? this.rowToMapping(row) : null;
    } catch {
      return null;
    }
  }

  /**
   * Récupère un mapping par Supabase ID.
   */
  getBySupabaseId(supabase_id: string): IdentityMapping | null {
    try {
      const db = require('../db/database').default;
      if (!db) return null;

      const row = db.prepare('SELECT * FROM identity_map WHERE supabase_id = ?').get(supabase_id) as any;
      return row ? this.rowToMapping(row) : null;
    } catch {
      return null;
    }
  }

  /**
   * Récupère un mapping par remote_id.
   */
  getByRemoteId(remote_id: number): IdentityMapping | null {
    try {
      const db = require('../db/database').default;
      if (!db) return null;

      const row = db.prepare('SELECT * FROM identity_map WHERE remote_id = ?').get(remote_id) as any;
      return row ? this.rowToMapping(row) : null;
    } catch {
      return null;
    }
  }

  /**
   * Crée ou met à jour un utilisateur dans Supabase pour un canonical_id donné.
   */
  async syncToSupabase(canonical_id: string): Promise<boolean> {
    try {
      const mapping = this.getByCanonicalId(canonical_id);
      if (!mapping) return false;

      // If already has Supabase ID, nothing to do
      if (mapping.supabase_id) return true;

      const db = require('../db/database').default;
      if (!db) return false;

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(mapping.sqlite_id) as any;
      if (!user) return false;

      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) return false;

      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
        db: { schema: 'public' },
      });

      // Check if user already exists in Supabase by email or username
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id')
        .or(`email.eq.${user.email || ''},username.eq.${user.username || ''}`)
        .limit(1);

      let supabaseUserId: string;

      if (existingUsers && existingUsers.length > 0) {
        supabaseUserId = existingUsers[0].id;
      } else {
        // Create user in Supabase
        const { data: newUser, error } = await supabase
          .from('users')
          .insert([{
            full_name: user.full_name,
            email: user.email,
            username: user.username,
            role: user.role || 'staff',
            is_active: true,
            tenant_id: mapping.tenant_id || user.tenant_id,
          }])
          .select('id')
          .single();

        if (error || !newUser) return false;
        supabaseUserId = newUser.id;
      }

      // Update mapping with Supabase ID
      db.prepare('UPDATE identity_map SET supabase_id = ?, updated_at = ? WHERE canonical_id = ?')
        .run(supabaseUserId, new Date().toISOString(), canonical_id);

      return true;
    } catch (err: any) {
      console.error('[IdentityResolution] Sync to Supabase error:', err.message);
      return false;
    }
  }

  // ── Privé ────────────────────────────────────────────────────────────────────

  private rowToMapping(row: any): IdentityMapping {
    return {
      canonical_id: row.canonical_id,
      sqlite_id: row.sqlite_id,
      supabase_id: row.supabase_id,
      remote_id: row.remote_id,
      tenant_id: row.tenant_id,
      user_type: row.user_type || 'staff',
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const identityResolver = IdentityResolutionService.getInstance();