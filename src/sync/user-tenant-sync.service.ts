// src/sync/user-tenant-sync.service.ts
// Synchronisation professionnelle des utilisateurs et tenants
// VERSION AMÉLIORÉE: Gestion atomique des dépendances et détection automatique
// =============================================================================

import type Database from 'better-sqlite3';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SyncPersistedCursor } from './core/sync-persisted-cursor';
import { DeadLetterQueue } from './core/dead-letter-queue';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const { randomUUID } = require('crypto') as { randomUUID: () => string };
  return randomUUID();
}

interface OutboxItem {
  id: string;
  entity: string;
  operation: 'insert' | 'update' | 'delete';
  record_id: string;
  payload: string;
  version: number;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
}

export class UserTenantSyncService {
  private db: Database.Database;
  private supabase: SupabaseClient;
  private isRunning = false;
  private cursor: SyncPersistedCursor;
  private dlq: DeadLetterQueue;

  private readonly ENTITY_TABLE: Record<string, string> = {
    user: 'users',
    tenant: 'tenants',
    tenant_user: 'tenant_users',
  };

  constructor(db: Database.Database, supabaseUrl: string, supabaseAnonKey: string) {
    this.db = db;
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.cursor = new SyncPersistedCursor(db, 'last_pull_');
    this.dlq = new DeadLetterQueue(db);
  }

  queueChange(entity: 'user' | 'tenant' | 'tenant_user', operation: 'insert' | 'update' | 'delete', record: any) {
    const id = newId();
    const payload = JSON.stringify(record);
    const version = (record as any).version || 1;
    const tenantId = (record as any).tenant_id !== undefined ? String((record as any).tenant_id) : null;

    this.db.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, entity, operation, record.id, payload, version, tenantId);

    console.log(`[Sync] ${entity} ${operation} queued for ${record.id}`);
  }

  private getLocalId(table: string, remoteId: any): number | null {
    if (remoteId === null || remoteId === undefined) return null;
    try {
      // Stratégie fiable : remote_id d'abord
      const row = this.db.prepare(
        `SELECT id FROM ${table} WHERE remote_id = ?`
      ).get(remoteId) as { id: number } | undefined;

      if (row) return row.id;

      // Fallback : id direct
      const byDirectId = this.db.prepare(
        `SELECT id FROM ${table} WHERE id = ?`
      ).get(remoteId) as { id: number } | undefined;

      return byDirectId ? byDirectId.id : null;
    } catch {
      return null;
    }
  }

  queueUserChange(operation: 'insert' | 'update' | 'delete', user: Partial<any>) {
    this.queueChange('user', operation, user);
  }

  queueTenantChange(operation: 'insert' | 'update' | 'delete', tenant: Partial<any>) {
    this.queueChange('tenant', operation, tenant);
  }

  queueTenantUserChange(operation: 'insert' | 'update' | 'delete', tenantUser: Partial<any>) {
    this.queueChange('tenant_user', operation, tenantUser);
  }

  async syncNow(tenantId: string): Promise<{ pushed: number; pulled: number; errors: number; fixed: number }> {
    if (this.isRunning) {
      console.log('[Sync] Sync already in progress');
      return { pushed: 0, pulled: 0, errors: 0, fixed: 0 };
    }

    this.isRunning = true;
    let pushed = 0, pulled = 0, errors = 0, fixed = 0;

    try {
      // ⭐ ORDRE CRITIQUE: tenants -> users -> tenant_users -> autres
      const syncOrder = ['tenant', 'user', 'tenant_user'];
      
      for (const entity of syncOrder) {
        pushed += await this.pushPendingByEntity(entity, tenantId);
        pulled += await this.pullFromSupabase(entity, tenantId);
      }

      // Vérifier et réparer l'intégrité après synchronisation
      const integrityResult = await this.ensureDataIntegrity(tenantId);
      fixed += integrityResult.fixed;

    } catch (err: any) {
      console.error('[Sync] User/Tenant sync cycle failed:', err);
      errors++;
    } finally {
      this.isRunning = false;
    }

    return { pushed, pulled, errors, fixed };
  }

  async pushPendingByEntity(entity: string, tenantId: string): Promise<number> {
    const items: OutboxItem[] = this.db
      .prepare(`
        SELECT * FROM sync_outbox 
        WHERE entity = ? AND status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT 50
      `)
      .all(entity) as unknown as OutboxItem[];

    let successCount = 0;

    for (const item of items) {
      this.db.prepare(`UPDATE sync_outbox SET status = 'in_progress' WHERE id = ?`).run(item.id);

      try {
        const payload = JSON.parse(item.payload);
        const recordId = Number(item.record_id);
        const table = this.ENTITY_TABLE[entity] || `${entity}s`;

        if (isNaN(recordId)) {
          this.db.prepare(`UPDATE sync_outbox SET status = 'failed', last_error = 'invalid record_id' WHERE id = ?`).run(item.id);
          continue;
        }

        if (item.operation === 'insert' || item.operation === 'update') {
          await this.handleUpsert(entity, table, item, payload, recordId, tenantId);
        } else if (item.operation === 'delete') {
          const { error } = await this.supabase.from(table).delete().eq('id', recordId);
          if (error) throw error;
        }

        this.db.prepare(`UPDATE sync_outbox SET status = 'done' WHERE id = ?`).run(item.id);
        successCount++;
      } catch (err: any) {
        const newRetryCount = (item.retry_count || 0) + 1;
        this.db.prepare(`
          UPDATE sync_outbox 
          SET status = 'failed', retry_count = ?, last_error = ?
          WHERE id = ?
        `).run(newRetryCount, err?.message ?? String(err), item.id);

        console.error(`[Sync] Push failed for ${entity} ${item.record_id}:`, err?.message ?? err);

        if (newRetryCount >= 5) {
          this.dlq.archiveFailedItem(item.id, err?.message ?? String(err), newRetryCount);
        }
      }
    }

    return successCount;
  }

  private async handleUpsert(
    entity: string, table: string, item: OutboxItem,
    payload: any, recordId: number, tenantId: string
  ) {
    const safeUpdate: Record<string, any> = { updated_at: new Date().toISOString() };

    // Récupérer le remote_id le plus frais depuis la DB locale (Faille de doublon résolue)
    const currentRemoteId = this.getLocalId(table, recordId);
    const effectiveRemoteId = payload.remote_id || currentRemoteId;

    if (effectiveRemoteId) {
      safeUpdate.id = effectiveRemoteId;
    } else if (item.operation === 'update') {
      safeUpdate.id = recordId;
    }

    if (entity === 'user') {
      const cols = ['full_name', 'username', 'pin_code', 'role', 'is_active', 'email', 'tenant_id', 'phone', 'password_hash', 'has_setup_pin', 'is_super_admin', 'is_platform_user', 'status', 'revoked_at', 'revoked_by', 'locked_until'];
      cols.forEach(c => {
        if (payload[c] !== undefined) {
          let val = payload[c];
          // INTEGER (0/1) stored locally → BOOLEAN expected by Supabase
          if ((c === 'is_active' || c === 'has_setup_pin' || c === 'is_platform_user') && typeof val === 'number') {
            val = val === 1;
          }
          safeUpdate[c] = val;
        }
      });

      // Resolve the self-referencing FK revoked_by → remote user id
      if (safeUpdate.revoked_by) {
        const remoteRevokedBy = this.getLocalId('users', safeUpdate.revoked_by);
        if (remoteRevokedBy) safeUpdate.revoked_by = remoteRevokedBy;
        else delete safeUpdate.revoked_by;
      }

      // Supabase trigger forbids platform users from having a tenant_id
      const isPlatform = safeUpdate.is_platform_user === true || safeUpdate.is_platform_user === 1;
      if (isPlatform) {
        delete safeUpdate.tenant_id;
      }
    } else if (entity === 'tenant') {
      const cols = ['slug', 'name', 'legal_name', 'owner_email', 'owner_phone', 'contact_email',
        'contact_phone', 'country', 'city', 'address', 'logo_url', 'primary_color',
        'default_currency', 'default_locale', 'timezone', 'status', 'is_provisioned', 'provisioned_at',
        'internal_notes', 'tenant_id', 'suspended_at', 'suspension_reason', 'suspended_by',
        'last_reactivated_at', 'last_reactivated_by', 'disabled_at', 'disabled_by'];
      cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
    } else if (entity === 'tenant_user') {
      const cols = ['tenant_id', 'user_id', 'role', 'is_default', 'is_active', 'invited_at', 'joined_at', 'created_at', 'updated_at'];
      cols.forEach(c => {
        if (payload[c] !== undefined) {
          let val = payload[c];
          if ((c === 'is_default' || c === 'is_active') && typeof val === 'number') val = val === 1;
          safeUpdate[c] = val;
        }
      });
    }

    if (!payload.remote_id && item.operation === 'insert') {
      // Tenants: preserve the local id so child-entity FKs stay consistent.
      if (entity === 'tenant') safeUpdate.id = String(recordId);
      else delete safeUpdate.id;
      if (tenantId && entity !== 'tenant') {
        // Vérifier si le tenant existe en remote avant de push
        const { data: remoteTenant } = await this.supabase.from('tenants').select('id').eq('id', tenantId).maybeSingle();
        if (!remoteTenant && entity !== 'tenant') {
          console.warn(`[Sync] Skipping ${entity} push: Tenant #${tenantId} does not exist in Supabase.`);
          return;
        }
        // Platform users must not carry a tenant_id (Supabase trigger rejects it)
        const platformUser = safeUpdate.is_platform_user === true || safeUpdate.is_platform_user === 1;
        if (!platformUser) {
          safeUpdate.tenant_id = tenantId;
        }
      }
    }

    const { data, error } = await this.supabase
      .from(table)
      .upsert(safeUpdate)
      .select('id')
      .single();

    if (error) throw error;

    if (!payload.remote_id && data?.id) {
      this.db.prepare(`UPDATE ${table} SET remote_id = ? WHERE id = ?`).run(data.id, recordId);
    }
  }

  private async pullFromSupabase(entity: string, tenantId: string): Promise<number> {
    const table = this.ENTITY_TABLE[entity] || `${entity}s`;
    const since = this.cursor.getOrEpoch(entity);

    let query = this.supabase
      .from(table)
      .select('*')
      .or(`updated_at.gt.${since},created_at.gt.${since}`)
      .order('updated_at', { ascending: true });

    // Filtrage par tenant
    if (entity === 'tenant') {
      query = query.eq('id', tenantId);
    } else {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[Sync] Failed to pull ${entity} from Supabase:`, error.message);
      return 0;
    }

    if (!data || data.length === 0) {
      if (entity === 'tenant') {
        console.warn(`[Sync] Tenant #${tenantId} NOT FOUND in Supabase. Bidirectional sync will be limited.`);
      }
      // ⭐ CORRECTION: Vérifier les dépendances manquantes pour tenant_users
      if (entity === 'tenant_user') {
        await this.ensureTenantUserDependencies(tenantId);
      }
      return 0;
    }

    let applied = 0;
    const tx = this.db.transaction((rows: any[]) => {
      for (const remote of rows) {
        // Scoping: Pour les users et tenant_users, on ne prend que ceux du tenant actuel (ou legacy 5)
        if (entity !== 'tenant') {
          const remoteTenantId = remote.tenant_id;
          if (remoteTenantId && String(remoteTenantId) !== String(tenantId) && String(remoteTenantId) !== '5') continue;
        } else {
          // Pour l'entité tenant elle-même, on ne prend que si c'est notre tenant
          if (String(remote.id) !== String(tenantId)) continue;
        }

        const remoteId = Number(remote?.id);
        if (isNaN(remoteId)) continue;

        const cols = entity === 'user'
          ? ['full_name', 'username', 'pin_code', 'role', 'is_active', 'email', 'tenant_id', 'phone', 'password_hash', 'has_setup_pin', 'is_super_admin', 'is_platform_user', 'status', 'revoked_at', 'revoked_by', 'locked_until']
          : entity === 'tenant'
          ? ['slug', 'name', 'legal_name', 'owner_email', 'owner_phone', 'contact_email',
            'contact_phone', 'country', 'city', 'address', 'logo_url', 'primary_color',
            'default_currency', 'default_locale', 'timezone', 'status', 'is_provisioned', 'provisioned_at',
            'internal_notes', 'tenant_id', 'suspended_at', 'suspension_reason', 'suspended_by',
            'last_reactivated_at', 'last_reactivated_by', 'disabled_at', 'disabled_by']
          : ['tenant_id', 'user_id', 'role', 'is_default', 'is_active', 'invited_at', 'joined_at', 'created_at', 'updated_at'];

        const fields: Record<string, any> = {
          remote_id: remoteId,
          updated_at: remote.updated_at,
          created_at: remote.created_at,
        };

        // On n'ajoute tenant_id que si l'entité n'est pas 'tenant'
        if (entity !== 'tenant' && remote.tenant_id !== undefined) {
          fields.tenant_id = remote.tenant_id;
        }

        cols.forEach(c => { if (remote[c] !== undefined) fields[c] = remote[c]; });

        // ⭐ GESTION SPÉCIALE POUR tenant_users
        if (entity === 'tenant_user') {
          const localTenantId = this.getLocalId('tenants', remote.tenant_id);
          const localUserId = this.getLocalId('users', remote.user_id);

          if (!localTenantId || !localUserId) {
            console.warn(`[Sync] Skipping tenant_user ${remoteId}: Missing local tenant (${remote.tenant_id} -> ${localTenantId}) or user (${remote.user_id} -> ${localUserId})`);
            
            // ⭐ CRÉER LES DÉPENDANCES SI ELLES MANQUENT
            this.createMissingDependencies(remote, entity);
            continue;
          }
          fields.tenant_id = localTenantId;
          fields.user_id = localUserId;
        }

        // Stratégie fiable : remote_id d'abord
        let local = this.db.prepare(
          `SELECT id, updated_at FROM ${table} WHERE remote_id = ?`
        ).get(remoteId) as { id: number; updated_at: string } | undefined;

        // Fallback 1: par ID direct (si migration manuelle)
        if (!local) {
          local = this.db.prepare(
            `SELECT id, updated_at FROM ${table} WHERE id = ?`
          ).get(remoteId) as { id: number; updated_at: string } | undefined;
        }

        // Fallback 2: par Clé Naturelle (Natural Key Matching) - Évite les doublons
        if (!local) {
          if (entity === 'user' && remote.username) {
            local = this.db.prepare(
              `SELECT id, updated_at FROM users WHERE username = ?`
            ).get(remote.username) as { id: number; updated_at: string } | undefined;
          } else if (entity === 'tenant' && remote.slug) {
            local = this.db.prepare(
              `SELECT id, updated_at FROM tenants WHERE slug = ?`
            ).get(remote.slug) as { id: number; updated_at: string } | undefined;
          }
        }

        const remoteUpdatedAt = new Date(remote.updated_at);
        const localUpdatedAt = local?.updated_at ? new Date(local.updated_at) : null;
        const shouldApply = !local || !localUpdatedAt || remoteUpdatedAt > localUpdatedAt;

        if (!shouldApply) continue;

        const sanitize = (val: any) => {
          if (val === undefined || val === null) return null;
          if (val instanceof Date) return val.toISOString();
          if (typeof val === 'boolean') return val ? 1 : 0;
          return val;
        };

        const updateFields = Object.keys(fields);
        const setClauses = updateFields.map(k => `"${k}" = ?`).join(', ');
        const params = updateFields.map(k => sanitize(fields[k]));

        if (local) {
          this.db.prepare(`UPDATE ${table} SET ${setClauses} WHERE id = ?`).run(...params, local.id);
        } else {
          if (entity === 'user' && fields.username) {
            const existingByUsername = this.db.prepare(
              `SELECT id, updated_at, remote_id FROM ${table} WHERE username = ?`
            ).get(fields.username) as { id: number; updated_at: string; remote_id: number | null } | undefined;

            if (existingByUsername) {
              const existingUpdatedAt = existingByUsername.updated_at ? new Date(existingByUsername.updated_at) : null;
              if (!existingUpdatedAt || remoteUpdatedAt > existingUpdatedAt) {
                this.db.prepare(`UPDATE ${table} SET ${setClauses} WHERE id = ?`).run(...params, existingByUsername.id);
                if (!existingByUsername.remote_id) {
                  this.db.prepare(`UPDATE ${table} SET remote_id = ? WHERE id = ?`).run(remoteId, existingByUsername.id);
                }
              }
              applied++;
              continue;
            }
          }

          try {
            const insertCols = ['id', ...updateFields];
            const insertParams = [remoteId, ...params];
            this.db.prepare(
              `INSERT INTO ${table} (${insertCols.map(c => `"${c}"`).join(', ')}) VALUES (${insertParams.map(() => '?').join(', ')})`
            ).run(...insertParams);
          } catch (insertErr: any) {
            if (insertErr?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
              const insertCols = updateFields;
              const insertParams = params;
              const result = this.db.prepare(
                `INSERT INTO ${table} (${insertCols.map(c => `"${c}"`).join(', ')}) VALUES (${insertParams.map(() => '?').join(', ')})`
              ).run(...insertParams);
              if (!updateFields.includes('remote_id')) {
                this.db.prepare(`UPDATE ${table} SET remote_id = ? WHERE id = ?`).run(remoteId, result.lastInsertRowid);
              }
            } else if (insertErr?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
              if (entity === 'tenant_user') {
                const localTenantId = this.getLocalId('tenants', remote.tenant_id);
                const localUserId = this.getLocalId('users', remote.user_id);
                if (localTenantId && localUserId) {
                  const existing = this.db.prepare(
                    `SELECT id FROM ${table} WHERE tenant_id = ? AND user_id = ?`
                  ).get(localTenantId, localUserId) as { id: number } | undefined;
                  if (existing) {
                    this.db.prepare(`UPDATE ${table} SET remote_id = ?, updated_at = ? WHERE id = ?`)
                      .run(remoteId, remote.updated_at, existing.id);
                  }
                }
                continue;
              } else {
                console.warn(`[Sync] Skipping ${entity} ${remoteId} due to unique constraint`);
                continue;
              }
            } else {
              throw insertErr;
            }
          }
        }
        applied++;
      }
    });

    tx(data);

    // Curseur persistant
    if (data && data.length > 0) {
      const lastUpdatedAt = data[data.length - 1].updated_at;
      this.cursor.set(entity, lastUpdatedAt instanceof Date ? lastUpdatedAt.toISOString() : String(lastUpdatedAt || ''));
    }

    return applied;
  }

  /**
   * Crée les dépendances manquantes pour une entité tenant_user
   */
  private createMissingDependencies(remote: any, entity: string) {
    if (entity === 'tenant_user') {
      // Vérifier et créer le tenant s'il manque
      if (!this.getLocalId('tenants', remote.tenant_id)) {
        console.log(`[Sync] Creating missing tenant dependency for tenant_id: ${remote.tenant_id}`);
        this.queueChange('tenant', 'insert', {
          id: remote.tenant_id,
          name: `Tenant ${remote.tenant_id}`,
          owner_email: `admin+${remote.tenant_id}@example.com`,
          status: 'active'
        });
      }

      // Vérifier et créer l'utilisateur s'il manque
      if (!this.getLocalId('users', remote.user_id)) {
        console.log(`[Sync] Creating missing user dependency for user_id: ${remote.user_id}`);
        this.queueChange('user', 'insert', {
          id: remote.user_id,
          email: `user+${remote.user_id}@example.com`,
          username: `user_${remote.user_id}`,
          full_name: `User ${remote.user_id}`,
          role: remote.role || 'staff',
          is_active: true,
          tenant_id: remote.tenant_id
        });
      }
    }
  }

  /**
   * Vérifie et répare l'intégrité des données pour un tenant
   */
  private async ensureDataIntegrity(tenantId: string): Promise<{ fixed: number }> {
    let fixed = 0;
    
    // Vérifier que tous les users du tenant ont une entrée tenant_users
    const localUsers = this.db.prepare(
      `SELECT id FROM users WHERE tenant_id = ?`
    ).all(tenantId) as { id: number }[];
    
    for (const user of localUsers) {
      const existingTu = this.db.prepare(
        `SELECT id FROM tenant_users WHERE tenant_id = ? AND user_id = ?`
      ).get(tenantId, user.id) as { id: number } | undefined;
      
      if (!existingTu) {
        // Créer la relation manquante
        this.db.prepare(`
          INSERT INTO tenant_users (tenant_id, user_id, role, is_default, is_active, joined_at)
          VALUES (?, ?, 'staff', false, true, ?)
        `).run(tenantId, user.id, new Date().toISOString());
        
        // Marquer pour sync vers Supabase
        this.queueTenantUserChange('insert', {
          tenant_id: tenantId,
          user_id: user.id,
          role: 'staff',
          is_default: false,
          is_active: true,
          joined_at: new Date().toISOString()
        });
        
        fixed++;
      }
    }
    
    // Vérifier qu'il y a au moins un owner
    const owners = this.db.prepare(
      `SELECT id FROM tenant_users WHERE tenant_id = ? AND role = 'owner'`
    ).all(tenantId) as { id: number }[];
    
    if (owners.length === 0) {
      // Trouver le premier user et le promouvoir owner
      const firstUser = this.db.prepare(
        `SELECT id FROM users WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1`
      ).get(tenantId) as { id: number } | undefined;
      
      if (firstUser) {
        const existingTu = this.db.prepare(
          `SELECT id FROM tenant_users WHERE tenant_id = ? AND user_id = ?`
        ).get(tenantId, firstUser.id) as { id: number } | undefined;
        
        if (existingTu) {
          // Mettre à jour en owner
          this.db.prepare(
            `UPDATE tenant_users SET role = 'owner', is_default = true WHERE id = ?`
          ).run(existingTu.id);
          
          this.queueTenantUserChange('update', {
            id: existingTu.id,
            tenant_id: tenantId,
            user_id: firstUser.id,
            role: 'owner',
            is_default: true,
            is_active: true
          });
          fixed++;
        } else {
          // Créer la relation en tant qu'owner
          this.db.prepare(`
            INSERT INTO tenant_users (tenant_id, user_id, role, is_default, is_active, joined_at)
            VALUES (?, ?, 'owner', true, true, ?)
          `).run(tenantId, firstUser.id, new Date().toISOString());
          
          this.queueTenantUserChange('insert', {
            tenant_id: tenantId,
            user_id: firstUser.id,
            role: 'owner',
            is_default: true,
            is_active: true,
            joined_at: new Date().toISOString()
          });
          fixed++;
        }
      }
    }
    
    // Vérifier qu'il y a un utilisateur par défaut
    const defaultUsers = this.db.prepare(
      `SELECT id FROM tenant_users WHERE tenant_id = ? AND is_default = true`
    ).all(tenantId) as { id: number }[];
    
    if (defaultUsers.length === 0) {
      // Trouver le premier owner/admin et le marquer comme default
      const firstOwner = this.db.prepare(
        `SELECT id FROM tenant_users WHERE tenant_id = ? AND role IN ('owner', 'admin') ORDER BY created_at ASC LIMIT 1`
      ).get(tenantId) as { id: number } | undefined;
      
      if (firstOwner) {
        this.db.prepare(
          `UPDATE tenant_users SET is_default = true WHERE id = ?`
        ).run(firstOwner.id);
        
        const tu = this.db.prepare(
          `SELECT * FROM tenant_users WHERE id = ?`
        ).get(firstOwner.id) as any;
        
        this.queueTenantUserChange('update', tu);
        fixed++;
      }
    }
    
    return { fixed };
  }

  /**
   * Assure que toutes les dépendances pour tenant_users existent
   */
  private async ensureTenantUserDependencies(tenantId: string) {
    // Vérifier d'abord que le tenant existe localement pour éviter FK error
    const tenantExists = this.db.prepare('SELECT id FROM tenants WHERE id = ?').get(tenantId);
    if (!tenantExists) {
      console.log(`[Sync] Skipping tenant_user dependency check: Tenant #${tenantId} not found locally.`);
      return;
    }

    // Pour chaque user du tenant, vérifier qu'il y a une entrée tenant_users
    const localUsers = this.db.prepare(
      `SELECT id, tenant_id FROM users WHERE tenant_id = ?`
    ).all(tenantId) as { id: number; tenant_id: number }[];
    
    for (const user of localUsers) {
      const existingTu = this.db.prepare(
        `SELECT id FROM tenant_users WHERE tenant_id = ? AND user_id = ?`
      ).get(user.tenant_id, user.id) as { id: number } | undefined;
      
      if (!existingTu) {
        // Créer la relation manquante
        this.db.prepare(`
          INSERT INTO tenant_users (tenant_id, user_id, role, is_default, is_active, joined_at)
          VALUES (?, ?, 'staff', false, true, ?)
        `).run(user.tenant_id, user.id, new Date().toISOString());
        
        // Marquer pour sync
        this.queueTenantUserChange('insert', {
          tenant_id: user.tenant_id,
          user_id: user.id,
          role: 'staff',
          is_default: false,
          is_active: true,
          joined_at: new Date().toISOString()
        });
      }
    }
  }

  resetPullCursor(entity?: string) {
    if (entity) {
      this.cursor.reset(entity);
    } else {
      this.cursor.reset();
    }
  }
}

export default UserTenantSyncService;

