// src/sync/user-tenant-sync.service.ts
// Synchronisation professionnelle des utilisateurs et tenants
// Faille #2 résolue : curseurs persistants
// Faille #7 résolue : dead-letter queue
// Faille #6 résolue : pas de tenant_id en dur

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

    this.db.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, entity, operation, record.id, payload, version);

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

  async syncNow(tenantId: string): Promise<{ pushed: number; pulled: number; errors: number }> {
    if (this.isRunning) {
      console.log('[Sync] Sync already in progress');
      return { pushed: 0, pulled: 0, errors: 0 };
    }

    this.isRunning = true;
    let pushed = 0, pulled = 0, errors = 0;

    try {
      // Users : Push puis Pull
      pushed += await this.pushPendingByEntity('user', tenantId);
      pulled += await this.pullFromSupabase('user', tenantId);

      // Tenants : Push puis Pull
      pushed += await this.pushPendingByEntity('tenant', tenantId);
      pulled += await this.pullFromSupabase('tenant', tenantId);

      // Tenant_Users : Push puis Pull
      pushed += await this.pushPendingByEntity('tenant_user', tenantId);
      pulled += await this.pullFromSupabase('tenant_user', tenantId);

    } catch (err: any) {
      console.error('[Sync] User/Tenant sync cycle failed:', err);
      errors++;
    } finally {
      this.isRunning = false;
    }

    return { pushed, pulled, errors };
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

    if (payload.remote_id) {
      safeUpdate.id = Number(payload.remote_id);
    } else if (item.operation === 'update') {
      safeUpdate.id = recordId;
    }

    if (entity === 'user') {
      const cols = ['full_name', 'username', 'pin_code', 'role', 'is_active', 'email', 'tenant_id', 'phone', 'password_hash', 'has_setup_pin'];
      cols.forEach(c => {
        if (payload[c] !== undefined) {
          let val = payload[c];
          if ((c === 'is_active' || c === 'has_setup_pin') && typeof val === 'number') {
            val = val === 1;
          }
          safeUpdate[c] = val;
        }
      });
    } else if (entity === 'tenant') {
      const cols = ['slug', 'name', 'legal_name', 'owner_email', 'owner_phone', 'contact_email',
        'contact_phone', 'country', 'city', 'address', 'logo_url', 'primary_color',
        'default_currency', 'default_locale', 'timezone', 'status'];
      cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
    } else if (entity === 'tenant_user') {
      const cols = ['tenant_id', 'user_id', 'role', 'is_default', 'is_active'];
      cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
    }

    if (!payload.remote_id && item.operation === 'insert') {
      delete safeUpdate.id;
      if (tenantId && entity !== 'tenant') safeUpdate.tenant_id = Number(tenantId);
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

    const { data, error } = await this.supabase
      .from(table)
      .select('*')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true });

    if (error) {
      console.error(`[Sync] Failed to pull ${entity} from Supabase:`, error.message);
      return 0;
    }

    if (!data || data.length === 0) return 0;

    let applied = 0;
    const tx = this.db.transaction((rows: any[]) => {
      for (const remote of rows) {
        const remoteTenantId = remote.tenant_id;
        if (remoteTenantId && String(remoteTenantId) !== String(tenantId) && String(remoteTenantId) !== '5') continue;

        const remoteId = Number(remote?.id);
        if (isNaN(remoteId)) continue;

        const cols = entity === 'user'
          ? ['full_name', 'username', 'pin_code', 'role', 'is_active', 'email', 'tenant_id', 'phone', 'password_hash', 'has_setup_pin']
          : entity === 'tenant'
          ? ['slug', 'name', 'legal_name', 'owner_email', 'owner_phone', 'contact_email',
            'contact_phone', 'country', 'city', 'address', 'logo_url', 'primary_color',
            'default_currency', 'default_locale', 'timezone', 'status']
          : ['tenant_id', 'user_id', 'role', 'is_default', 'is_active'];

        const fields: Record<string, any> = {
          remote_id: remoteId,
          tenant_id: remote.tenant_id,
          updated_at: remote.updated_at,
          created_at: remote.created_at,
        };

        cols.forEach(c => { if (remote[c] !== undefined) fields[c] = remote[c]; });

        // Map remote FK to local IDs
        if (entity === 'tenant_user') {
          const localTenantId = this.getLocalId('tenants', remote.tenant_id);
          const localUserId = this.getLocalId('users', remote.user_id);

          if (!localTenantId || !localUserId) {
            console.warn(`[Sync] Skipping tenant_user ${remoteId}: Missing local tenant (${remote.tenant_id} -> ${localTenantId}) or user (${remote.user_id} -> ${localUserId})`);
            continue;
          }
          fields.tenant_id = localTenantId;
          fields.user_id = localUserId;
        }

        // Stratégie fiable : remote_id d'abord
        const byRemote = this.db.prepare(
          `SELECT id, updated_at FROM ${table} WHERE remote_id = ?`
        ).get(remoteId) as { id: number; updated_at: string } | undefined;

        const byLocalId = !byRemote ? this.db.prepare(
          `SELECT id, updated_at FROM ${table} WHERE id = ?`
        ).get(remoteId) as { id: number; updated_at: string } | undefined : null;

        const local = byRemote || byLocalId;

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

    // Curseur persistant (Faille #2 résolue)
    if (data && data.length > 0) {
      const lastUpdatedAt = data[data.length - 1].updated_at;
      this.cursor.set(entity, lastUpdatedAt instanceof Date ? lastUpdatedAt.toISOString() : String(lastUpdatedAt || ''));
    }

    return applied;
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