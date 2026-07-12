/**
 * src/sync/core/generic-sync.service.ts
 * Service générique de synchronisation qui utilise le registre d'entités
 * pour synchroniser TOUTES les tables de manière uniforme.
 *
 * V3 (REFACTORED): Single-path sync engine
 * - Pagination complète avec offset (plus de perte d'items)
 * - Pas de dual-write (V2.3.2 OutboxRepository désactivé)
 * - FK résolues avec nullification explicite (pas de delete silencieux)
 * - Erreurs toutes loggées (pas de catch silencieux)
 * - Gestion de conflits LWW versionnée
 */
import type Database from 'better-sqlite3';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncEntityDefinition } from './entity-registry';
import { getEntityDef, getEntitiesBySyncOrder } from './entity-registry';
import { SyncPersistedCursor } from './sync-persisted-cursor';
import { ConflictResolver } from './conflict-resolver';
import { DeadLetterQueue } from './dead-letter-queue';

import { getRequestId, logTrace } from '../../server/utils/trace-utils';

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: number;
}

const OUTBOX_BATCH_SIZE = 50;

export class GenericSyncService {
  private db: Database.Database;
  private supabase: SupabaseClient;
  private cursor: SyncPersistedCursor;
  private conflictResolver: ConflictResolver;
  private dlq: DeadLetterQueue;

  constructor(
    db: Database.Database,
    supabase: SupabaseClient,
    cursor: SyncPersistedCursor,
    conflictResolver: ConflictResolver,
    dlq: DeadLetterQueue
  ) {
    this.db = db;
    this.supabase = supabase;
    this.cursor = cursor;
    this.conflictResolver = conflictResolver;
    this.dlq = dlq;
  }

  /* ==================================================================
   *  HELPERS
   * ================================================================== */

  private normalizeTenantId(tenantIdRaw: any): number | null {
    if (tenantIdRaw === undefined || tenantIdRaw === null) return null;
    const asStr = String(tenantIdRaw).trim();
    if (asStr === '') return null;
    const num = Number(asStr);
    if (!Number.isFinite(num)) return null;
    return parseInt(String(Math.trunc(num)), 10);
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    const { randomUUID } = require('crypto') as { randomUUID: () => string };
    return randomUUID();
  }

  private getRemoteId(table: string, localId: any): number | null {
    if (!localId) return null;
    try {
      const row = this.db.prepare(`SELECT remote_id FROM ${table} WHERE id = ?`).get(localId) as any;
      return row?.remote_id || null;
    } catch {
      return null;
    }
  }

  private getLocalId(table: string, remoteId: any): number | null {
    if (!remoteId) return null;
    try {
      const row = this.db.prepare(`SELECT id FROM ${table} WHERE remote_id = ?`).get(remoteId) as any;
      if (row) return row.id;
      const byDirect = this.db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(remoteId) as any;
      return byDirect ? byDirect.id : null;
    } catch {
      return null;
    }
  }

  private async findExistingRemoteRecord(def: SyncEntityDefinition, payload: any, tenantId: string): Promise<any | null> {
    if (def.entity === 'tenant') {
      if (payload.remote_id) {
        const { data } = await this.supabase.from(def.remoteTable).select('id').eq('id', payload.remote_id).maybeSingle();
        if (data) return data;
      }
      if (payload.slug) {
        const { data } = await this.supabase.from(def.remoteTable).select('id').eq('slug', payload.slug).maybeSingle();
        if (data) return data;
      }
      if (payload.owner_email) {
        const { data } = await this.supabase.from(def.remoteTable).select('id').eq('owner_email', payload.owner_email).maybeSingle();
        if (data) return data;
      }
      if (payload.name) {
        const { data } = await this.supabase.from(def.remoteTable).select('id').eq('name', payload.name).limit(1).single();
        if (data) return data;
      }
    }

    if (def.entity === 'product' && tenantId) {
      if (payload.barcode) {
        const { data } = await this.supabase.from(def.remoteTable).select('id').eq('barcode', payload.barcode).eq('tenant_id', tenantId).maybeSingle();
        if (data) return data;
      }
      if (payload.sku) {
        const { data } = await this.supabase.from(def.remoteTable).select('id').eq('sku', payload.sku).eq('tenant_id', tenantId).maybeSingle();
        if (data) return data;
      }
      if (payload.name) {
        const { data } = await this.supabase.from(def.remoteTable).select('id').eq('name', payload.name).eq('tenant_id', tenantId).maybeSingle();
        if (data) return data;
      }
    }

    if (def.entity === 'category' && payload.name && tenantId) {
      const tenantIdInt = parseInt(String(tenantId), 10);
      const { data } = await this.supabase.from(def.remoteTable).select('id, tenant_id').eq('name', payload.name).maybeSingle();
      if (data) {
        const remoteTenantId = Number(data.tenant_id);
        if (remoteTenantId === tenantIdInt) return data;
        return data;
      }
      return null;
    }

    if (def.entity === 'user' && payload.email) {
      const { data } = await this.supabase.from(def.remoteTable).select('id').eq('email', payload.email).maybeSingle();
      return data;
    }

    if (def.entity === 'tenant_user' && payload.tenant_id && payload.user_id) {
      const remoteTid = this.getRemoteId('tenants', payload.tenant_id) || payload.tenant_id;
      const remoteUid = this.getRemoteId('users', payload.user_id) || payload.user_id;
      const { data } = await this.supabase.from(def.remoteTable).select('id').eq('tenant_id', remoteTid).eq('user_id', remoteUid).maybeSingle();
      return data;
    }

    return null;
  }

  /* ==================================================================
   *  QUEUE HELPERS
   * ================================================================== */

  async queueChange(entity: string, operation: 'insert' | 'update' | 'delete', record: any): Promise<void> {
    const def = getEntityDef(entity);
    if (!def) return;

    const id = this.newId();
    const payload = JSON.stringify(record);
    const version = record.version || 1;
    const tenantId = def.entity === 'tenant'
      ? this.normalizeTenantId(record.id)
      : this.normalizeTenantId(record.tenant_id);

    try {
      const stmt = this.db.prepare(`
        INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, entity, operation, String(record.id), payload, version, tenantId);
    } catch (err: any) {
      console.error(`[GenericSync] queueChange failed for ${entity} ${operation} #${record.id}:`, err?.message);
      throw err;
    }
  }

  queueChangeInsideTransaction(entity: string, operation: 'insert' | 'update' | 'delete', record: any) {
    const id = this.newId();
    const payload = JSON.stringify(record);
    const version = record.version || 1;
    const tenantId = entity === 'tenant'
      ? this.normalizeTenantId(record.id)
      : this.normalizeTenantId(record.tenant_id);

    try {
      const stmt = this.db.prepare(`
        INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, entity, operation, String(record.id), payload, version, tenantId);
    } catch (err: any) {
      console.error(`[GenericSync] queueChangeInsideTransaction failed for ${entity} ${operation} #${record.id}:`, err?.message);
      throw err;
    }
  }

  /* ==================================================================
   *  PUSH – Outbox → Supabase (Avec pagination complète)
   * ================================================================== */

  async pushByEntity(entity: string, tenantId: string): Promise<number> {
    const def = getEntityDef(entity);
    if (!def) return 0;

    const tenantIdNum = parseInt(tenantId, 10);
    let totalPushed = 0;
    let offset = 0;
    let batchCount = 0;

    // Boucle de pagination: traite 50 items à la fois jusqu'à épuisement
    while (true) {
      const items = this.db.prepare(`
        SELECT * FROM sync_outbox
        WHERE entity = ? AND status = 'pending' AND (tenant_id IS NULL OR CAST(tenant_id AS INTEGER) = ?)
        ORDER BY created_at ASC
        LIMIT ? OFFSET ?
      `).all(entity, tenantIdNum, OUTBOX_BATCH_SIZE, offset) as any[];

      if (items.length === 0) break; // Plus rien à traiter
      batchCount++;

      let successCount = 0;
      for (const item of items) {
        this.db.prepare(`UPDATE sync_outbox SET status = 'in_progress' WHERE id = ?`).run(item.id);

        try {
          const payload = JSON.parse(item.payload);
          const recordId = Number(item.record_id);
          if (isNaN(recordId)) {
            this.db.prepare(`UPDATE sync_outbox SET status = 'failed', last_error = 'invalid record_id' WHERE id = ?`).run(item.id);
            continue;
          }

          if (item.operation === 'insert' || item.operation === 'update') {
            await this.handleUpsert(def, item, payload, recordId, tenantId);
          } else if (item.operation === 'delete') {
            const remoteId = payload.remote_id || this.getRemoteId(def.localTable, recordId);
            let resolvedRemoteId = remoteId;
            if (!resolvedRemoteId && def.entity === 'product' && payload.name && tenantId) {
              const existing = await this.findExistingRemoteRecord(def, payload, tenantId);
              if (existing?.id) resolvedRemoteId = existing.id;
            }
            await this.handleDelete(def, item, payload, recordId, resolvedRemoteId || remoteId);
          }

          this.db.prepare(`UPDATE sync_outbox SET status = 'done' WHERE id = ?`).run(item.id);
          successCount++;
        } catch (err: any) {
          const errorMsg = err?.message ?? String(err);
          const newRetryCount = (item.retry_count || 0) + 1;

          // Duplicate key = déjà synchronisé
          if (errorMsg.includes('duplicate key') || errorMsg.includes('unique constraint')) {
            this.db.prepare(`UPDATE sync_outbox SET status = 'done' WHERE id = ?`).run(item.id);
            successCount++;
            continue;
          }

          this.db.prepare(`
            UPDATE sync_outbox
            SET status = 'failed', retry_count = ?, last_error = ?
            WHERE id = ?
          `).run(newRetryCount, errorMsg, item.id);

          if (newRetryCount >= 5) {
            this.dlq.archiveFailedItem(item.id, errorMsg, newRetryCount);
          }
        }
      }

      totalPushed += successCount;
      offset += OUTBOX_BATCH_SIZE;

      // Si moins de 50 items dans ce batch, on a terminé
      if (items.length < OUTBOX_BATCH_SIZE) break;
    }

    if (totalPushed > 0) {
      console.log(`[GenericSync] pushByEntity ${def.entity}: completed ${totalPushed} items in ${batchCount} batch(es)`);
    }
    return totalPushed;
  }

  private async handleUpsert(def: SyncEntityDefinition, item: any, payload: any, recordId: number, tenantId: string): Promise<boolean> {
    const { localTable, remoteTable, fieldMappings, statusMapping, foreignKeys } = def;

    // NORMALIZATION: inventory_movement reference_id doit être un entier pour Supabase BIGINT
    if (def.entity === 'inventory_movement' && payload.reference_id !== undefined && payload.reference_id !== null) {
      const parsed = Number(payload.reference_id);
      if (!Number.isNaN(parsed)) payload.reference_id = Math.trunc(parsed);
    }

    const safeUpdate: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    const currentRemoteId = this.getRemoteId(localTable, recordId);
    const effectiveRemoteId = payload.remote_id || currentRemoteId;

    if (effectiveRemoteId) {
      safeUpdate.id = String(effectiveRemoteId);
    } else {
      const existingRemote = await this.findExistingRemoteRecord(def, payload, tenantId);
      if (existingRemote) safeUpdate.id = String(existingRemote.id);
      else if (item.operation === 'update') return true;
    }

    if (def.entity === 'tenant' && !safeUpdate.id && recordId) {
      const tid = Number(recordId);
      if (Number.isInteger(tid)) safeUpdate.id = String(tid);
    }

    if (safeUpdate.id !== undefined) {
      const idStr = String(safeUpdate.id);
      if (!/^\d+$/.test(idStr)) {
        delete safeUpdate.id;
      }
    }

    for (const field of def.allowedFields) {
      if (payload[field] !== undefined) {
        let val = payload[field];
        if (def.booleanFields?.includes(field) && typeof val === 'number') val = val === 1;
        safeUpdate[field] = val;
      }
    }

    if (!def.hasUpdatedAt) delete safeUpdate.updated_at;

    if (def.entity === 'product') {
      if (payload.sku !== undefined && payload.barcode !== undefined) {
        safeUpdate.sku = payload.sku;
        safeUpdate.barcode = payload.barcode;
      }
      if (safeUpdate.barcode !== undefined) {
        const b = String(safeUpdate.barcode).trim();
        if (b === '') safeUpdate.barcode = null;
      }
      delete safeUpdate.low_stock_threshold;
      if (safeUpdate.created_by === undefined) safeUpdate.created_by = payload.created_by ?? null;
      if (safeUpdate.updated_by === undefined) safeUpdate.updated_by = payload.updated_by ?? null;
      if (!safeUpdate.updated_at) safeUpdate.updated_at = new Date().toISOString();
      if (!safeUpdate.created_at && payload.created_at) safeUpdate.created_at = payload.created_at;
      if (!safeUpdate.created_at) safeUpdate.created_at = safeUpdate.updated_at;
    }

    if (def.entity === 'user') {
      const isPlatform = safeUpdate.is_platform_user === true || safeUpdate.is_platform_user === 1;
      if (isPlatform) delete safeUpdate.tenant_id;
    }

    if (fieldMappings) {
      for (const [remoteField, localField] of Object.entries(fieldMappings)) {
        if (payload[localField] !== undefined) safeUpdate[remoteField] = payload[localField];
      }
      for (const localField of Object.values(fieldMappings)) {
        if (localField !== undefined && localField !== null) delete safeUpdate[localField];
      }
    }

    delete safeUpdate.remote_id;

    if (statusMapping && safeUpdate.status) {
      const mapped = statusMapping[safeUpdate.status];
      if (mapped) safeUpdate.status = mapped;
    }

    // ─── GESTION DES FOREIGN KEYS ───────────────────────────────────────
    // Règle: si une FK n'est pas résolue → nullifier (pas delete, pas abandonner)
    // Cela permet à l'item d'être créé dans Supabase même si la FK n'est pas encore syncée.
    if (foreignKeys) {
      for (const [field, targetTable] of Object.entries(foreignKeys)) {
        if (safeUpdate[field] === undefined || safeUpdate[field] === null) continue;

        const remoteFkId = this.getRemoteId(targetTable, safeUpdate[field]);
        if (remoteFkId) {
          safeUpdate[field] = remoteFkId;
          continue;
        }

        // FK non résolue → nullifier systématiquement (l'item sera créé quand même)
        console.warn(`[GenericSync] FK ${field}->${targetTable}=${safeUpdate[field]} not resolved for ${def.entity} #${recordId}, nullifying`);
        delete safeUpdate[field];
      }
    }

    if (def.hasTenantId && tenantId) {
      const isPlatformUser = def.entity === 'user' && (safeUpdate.is_platform_user === true || safeUpdate.is_platform_user === 1);
      if (!isPlatformUser) {
        safeUpdate.tenant_id = Number(tenantId);
      }
    }

    if (def.entity === 'setting') {
      const query = this.supabase.from(remoteTable).select('id').eq('key', safeUpdate.key);
      if (tenantId) query.eq('tenant_id', tenantId);
      const existingSetting = await query.maybeSingle();
      if (existingSetting.data?.id) safeUpdate.id = existingSetting.data.id;
      else delete safeUpdate.id;
    }

    const isValidRemoteId = effectiveRemoteId && /^\d+$/.test(String(effectiveRemoteId));
    const upsertPayload = isValidRemoteId ? { ...safeUpdate, id: String(effectiveRemoteId) } : safeUpdate;

    const shouldInsert = def.entity === 'inventory_movement' && !effectiveRemoteId;

    if (shouldInsert) {
      const { data: insertData, error: insertError } = await this.supabase.from(remoteTable).insert(upsertPayload).select('id').single();
      if (insertError) throw insertError;
      if (!payload.remote_id && insertData?.id) {
        this.db.prepare(`UPDATE ${localTable} SET remote_id = ? WHERE id = ?`).run(insertData.id, recordId);
      }
      return true;
    }

    const { data, error } = await this.supabase.from(remoteTable).upsert(upsertPayload).select('id').single();
    if (error) {
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        const existing = await this.findExistingRemoteRecord(def, payload, tenantId);
        if (existing?.id) {
          this.db.prepare(`UPDATE ${localTable} SET remote_id = ? WHERE id = ?`).run(existing.id, recordId);
        }
        return true;
      }
      throw error;
    }

    if (data?.id) {
      const currentLocalRemoteId = this.getRemoteId(localTable, recordId);
      if (currentLocalRemoteId !== data.id) {
        this.db.prepare(`UPDATE ${localTable} SET remote_id = ? WHERE id = ?`).run(data.id, recordId);
      }
    }

    return true;
  }

  private async handleDelete(def: SyncEntityDefinition, _item: any, payload: any, recordId: number, remoteId?: number | string | null) {
    const { remoteTable, localTable, hasTenantId } = def;

    let targetId = remoteId || payload.remote_id;
    if (!targetId) {
      const localRemoteId = this.getRemoteId(localTable, recordId);
      if (localRemoteId) targetId = localRemoteId;
    }

    if (!targetId && def.entity === 'product' && payload.name && payload.tenant_id) {
      const existing = await this.findExistingRemoteRecord(def, payload, String(payload.tenant_id));
      if (existing?.id) targetId = existing.id;
    }

    const targetIdStr = targetId ? String(targetId) : null;
    const tenantId = payload.tenant_id ? String(payload.tenant_id) : null;

    let queryBuilder: any;

    if (def.entity === 'product') {
      queryBuilder = this.supabase.from(remoteTable).update({
        is_available: false, deleted_at: new Date().toISOString(), status: 'archived', updated_at: new Date().toISOString(),
      });
    } else if (def.entity === 'order') {
      queryBuilder = this.supabase.from(remoteTable).update({ status: 'cancelled', updated_at: new Date().toISOString() });
    } else {
      queryBuilder = this.supabase.from(remoteTable).delete();
    }

    if (targetIdStr) {
      queryBuilder = queryBuilder.eq('id', targetIdStr);
      if (hasTenantId && tenantId) {
        queryBuilder = queryBuilder.eq('tenant_id', def.entity === 'product' ? String(tenantId) : Number(tenantId));
      }
      const { error } = await queryBuilder;
      if (error) throw error;
    }
  }

  /* ==================================================================
   *  PULL – Supabase → SQLite
   * ================================================================== */

  async pullByEntity(entity: string, tenantId: string): Promise<number> {
    const def = getEntityDef(entity);
    if (!def) return 0;

    const { remoteTable, hasUpdatedAt } = def;
    const cursorKey = hasUpdatedAt ? entity : `${entity}_created`;
    const since = this.cursor.getOrEpoch(cursorKey);

    const tenantIdInt = Number.isFinite(Number(tenantId)) ? parseInt(tenantId, 10) : NaN;
    const tenantIdForQuery = Number.isNaN(tenantIdInt) ? tenantId : tenantIdInt;

    let query = this.supabase.from(remoteTable).select('*');

    if (entity === 'tenant') {
      query = query.gt('updated_at', since).order('updated_at', { ascending: true });
    } else {
      query = query.eq('tenant_id', tenantIdForQuery);
      if (hasUpdatedAt) query = query.gt('updated_at', since).order('updated_at', { ascending: true });
      else query = query.gt('created_at', since).order('created_at', { ascending: true });
    }

    const { data, error } = await query;
    if (error) {
      if (entity !== 'tenant' && hasUpdatedAt && error.message?.toLowerCase().includes('updated_at')) {
        const fallback = this.supabase.from(remoteTable).select('*').eq('tenant_id', tenantIdForQuery).gt('created_at', since).order('created_at', { ascending: true });
        const { data: fbData } = await fallback;
        if (fbData) return this.applyPullBatch(def, fbData, tenantId, cursorKey, since);
      }
      return 0;
    }
    if (!data || data.length === 0) return 0;

    return this.applyPullBatch(def, data, tenantId, cursorKey, since);
  }

  private applyPullBatch(def: SyncEntityDefinition, data: any[], tenantId: string, cursorKey: string, since: string): number {
    let applied = 0;
    let hadError = false;

    const transaction = this.db.transaction((rows: any[]) => {
      for (const remote of rows) {
        try {
          if (def.entity !== 'tenant') {
            const remoteTenantId = remote.tenant_id;
            if (remoteTenantId && def.entity !== 'user') {
              const remoteTenantInt = Number.isFinite(Number(remoteTenantId)) ? parseInt(String(remoteTenantId), 10) : NaN;
              const localTenantInt = Number.isFinite(Number(tenantId)) ? parseInt(String(tenantId), 10) : NaN;
              if (!Number.isNaN(remoteTenantInt) && !Number.isNaN(localTenantInt) && remoteTenantInt !== localTenantInt) continue;
            }
          }

          const remoteId = Number(remote.id);
          if (isNaN(remoteId)) continue;

          const local = this.findLocalRow(def, remoteId, remote);
          const isRemoteSoftDeleted = def.entity === 'product' && (remote.is_available === false || remote.deleted_at !== null || remote.status === 'archived');

          const remoteTs = remote.updated_at || remote.created_at;
          const localTs = local?.updated_at || local?.created_at;

          // Conflict detection (LWW versionnée)
          if (local && local.version) {
            const isConflict = this.conflictResolver.detectConflict(
              def.entity, local.id, remoteId,
              localTs || '', remoteTs || '',
              Number(local.version || 1), Number(remote.version || 1)
            );
            if (isConflict) {
              const resolution = this.conflictResolver.resolveLWW(
                Number(local.version || 1), Number(remote.version || 1),
                localTs || '', remoteTs || ''
              );
              this.conflictResolver.logResolvedConflict(
                { entity: def.entity, localId: local.id, remoteId },
                def.entity,
                { version: local.version, updated_at: localTs },
                { version: remote.version, updated_at: remoteTs },
                resolution,
                `Concurrent modification on pull — ${resolution}`
              );
            }
          }

          const shouldApply = !local || !localTs || (remoteTs && new Date(remoteTs) > new Date(localTs)) || isRemoteSoftDeleted;
          if (!shouldApply) continue;

          const fields = this.buildPullFields(def, remote, local, remoteId, tenantId);
          this.applyPullRow(def, fields, local, remoteId, remote);
          applied++;
        } catch (err: any) {
          hadError = true;
        }
      }
    });

    transaction(data);

    if (hadError) {
      this.cursor.reset(cursorKey);
    } else if (data.length > 0) {
      const lastTs = data[data.length - 1].updated_at || data[data.length - 1].created_at;
      if (lastTs) {
        this.cursor.set(cursorKey, lastTs instanceof Date ? lastTs.toISOString() : String(lastTs));
      }
    }

    return applied;
  }

  async mirrorRemoteRecordToLocal(entity: string, tenantId: string, remote: any, relatedItems?: any[]): Promise<{ applied: boolean; localId?: number; conflictLogged?: boolean }> {
    const def = getEntityDef(entity);
    if (!def || !remote || remote.id == null) return { applied: false };

    const remoteId = Number(remote.id);
    if (isNaN(remoteId)) return { applied: false };

    try {
      const local = this.findLocalRow(def, remoteId, remote);
      let conflictLogged = false;
      const localTs = (local?.updated_at || local?.created_at) ?? '';
      const remoteTs = (remote.updated_at || remote.created_at) ?? '';

      if (local && local.version) {
        const isConflict = this.conflictResolver.detectConflict(entity, local.id, remoteId, localTs, remoteTs, Number(local.version || 1), Number(remote.version || 1));
        if (isConflict) {
          const resolution = this.conflictResolver.resolveLWW(Number(local.version || 1), Number(remote.version || 1), localTs, remoteTs);
          this.conflictResolver.logResolvedConflict({ entity, localId: local.id, remoteId }, entity, { version: local.version, updated_at: localTs }, { version: remote.version, updated_at: remoteTs }, resolution, `Concurrent modification on mirror — ${resolution}`);
          conflictLogged = true;
        }
      }

      const fields = this.buildPullFields(def, remote, local, remoteId, tenantId);
      this.applyPullRow(def, fields, local, remoteId, remote);
      const localId = local ? local.id : remoteId;

      if (entity === 'order' && relatedItems && relatedItems.length) {
        for (const item of relatedItems) {
          if (item && item.id != null) {
            await this.mirrorRemoteRecordToLocal('order_item', tenantId, { ...item, order_id: item.order_id ?? remoteId });
          }
        }
      }

      return { applied: true, localId, conflictLogged };
    } catch (err: any) {
      console.warn(`[GenericSync] mirrorRemoteRecordToLocal(${entity}) failed:`, err?.message || err);
      return { applied: false };
    }
  }

  private findLocalRow(def: SyncEntityDefinition, remoteId: number, remote: any): { id: number; updated_at: string; created_at: string; version: number } | undefined {
    const { localTable } = def;
    try {
      const byRemote = this.db.prepare(`SELECT id, updated_at, created_at, version FROM ${localTable} WHERE remote_id = ?`).get(remoteId) as any;
      if (byRemote) return byRemote;

      const byDirectId = this.db.prepare(`SELECT id, updated_at, created_at, version FROM ${localTable} WHERE id = ?`).get(remoteId) as any;
      if (byDirectId) return byDirectId;

      if (def.entity === 'product' && remote.name && remote.tenant_id) {
        return this.db.prepare(`SELECT id, updated_at, created_at, version FROM products WHERE name = ? AND tenant_id = ?`).get(remote.name, remote.tenant_id) as any;
      }
      if (def.entity === 'category' && remote.name && remote.tenant_id) {
        return this.db.prepare(`SELECT id, updated_at, created_at, version FROM categories WHERE name = ? AND tenant_id = ?`).get(remote.name, remote.tenant_id) as any;
      }
      if (def.entity === 'restaurant_table' && remote.table_number && remote.tenant_id) {
        return this.db.prepare(`SELECT id, updated_at, created_at, version FROM restaurant_tables WHERE table_number = ? AND tenant_id = ?`).get(String(remote.table_number), remote.tenant_id) as any;
      }
      if (def.entity === 'user' && remote.username) {
        return this.db.prepare(`SELECT id, updated_at, created_at, version FROM users WHERE username = ?`).get(remote.username) as any;
      }
      if (def.entity === 'tenant' && remote.slug) {
        return this.db.prepare(`SELECT id, updated_at, created_at, version FROM tenants WHERE slug = ?`).get(remote.slug) as any;
      }
      if (def.entity === 'tenant' && remote.owner_email) {
        return this.db.prepare(`SELECT id, updated_at, created_at, version FROM tenants WHERE owner_email = ?`).get(remote.owner_email) as any;
      }
      if (def.entity === 'tenant' && remote.name) {
        return this.db.prepare(`SELECT id, updated_at, created_at, version FROM tenants WHERE name = ?`).get(remote.name) as any;
      }
      if (def.entity === 'tenant_user' && remote.tenant_id && remote.user_id) {
        const localTenantId = this.getLocalId('tenants', remote.tenant_id);
        const localUserId = this.getLocalId('users', remote.user_id);
        if (localTenantId && localUserId) {
          return this.db.prepare(`SELECT id, updated_at, created_at, version FROM tenant_users WHERE tenant_id = ? AND user_id = ?`).get(localTenantId, localUserId) as any;
        }
      }
      if (def.entity === 'setting' && remote.key) {
        const params: any[] = [remote.key];
        let sql = `SELECT key as id, updated_at, created_at, version FROM settings WHERE key = ?`;
        if (remote.tenant_id !== undefined && remote.tenant_id !== null) {
          sql += ` AND tenant_id = ?`;
          params.push(remote.tenant_id);
        }
        return this.db.prepare(sql).get(...params) as any;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private buildPullFields(def: SyncEntityDefinition, remote: any, _local: any, remoteId: number, tenantId: string): Record<string, any> {
    const { allowedFields, fieldMappings, reverseStatusMapping, booleanFields, jsonFields, foreignKeys } = def;

    const fields: Record<string, any> = {
      remote_id: remoteId,
      updated_at: remote.updated_at ? (remote.updated_at instanceof Date ? remote.updated_at.toISOString() : String(remote.updated_at)) : new Date().toISOString(),
      created_at: remote.created_at ? (remote.created_at instanceof Date ? remote.created_at.toISOString() : String(remote.created_at)) : new Date().toISOString(),
    };

    if (remote.version !== undefined) fields.version = remote.version;

    for (const field of allowedFields) {
      if (field === 'id' || field === 'created_at' || field === 'updated_at' || field === 'remote_id') continue;
      if (remote[field] !== undefined) fields[field] = remote[field];
    }

    if (foreignKeys) {
      for (const [field, targetTable] of Object.entries(foreignKeys)) {
        if (fields[field] !== undefined && fields[field] !== null) {
          const localFkId = this.getLocalId(targetTable, fields[field]);
          fields[field] = localFkId ?? null;
        }
      }
    }

    if (def.hasTenantId && remote.tenant_id !== undefined) fields.tenant_id = remote.tenant_id;
    if (booleanFields) {
      for (const field of booleanFields) {
        if (fields[field] !== undefined) fields[field] = fields[field] ? 1 : 0;
      }
    }

    if (jsonFields) {
      for (const field of jsonFields) {
        if (fields[field] !== undefined && typeof fields[field] !== 'string') {
          fields[field] = JSON.stringify(fields[field]);
        }
      }
    }

    if (reverseStatusMapping && fields.status) {
      const mapped = reverseStatusMapping[fields.status];
      if (mapped) fields.status = mapped;
    }

    return fields;
  }

  private applyPullRow(def: SyncEntityDefinition, fields: Record<string, any>, local: any, remoteId: number, remote: any) {
    const localTable = def.localTable;

    const sanitize = (val: any) => {
      if (val === undefined || val === null) return null;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'boolean') return val ? 1 : 0;
      return val;
    };

    const updateFields = Object.keys(fields);
    if (updateFields.length === 0) return;

    const setClauses = updateFields.map((k) => `"${k}" = ?`).join(', ');
    const params = updateFields.map((k) => sanitize(fields[k]));

    if (def.entity === 'setting') {
      const tenantId = fields.tenant_id;
      const existingSetting = this.db.prepare('SELECT key FROM settings WHERE key = ? AND tenant_id = ?').get(fields.key, tenantId) as any;
      if (existingSetting) {
        this.db.prepare(`UPDATE settings SET ${setClauses} WHERE key = ? AND tenant_id = ?`).run(...params, fields.key, tenantId);
      } else {
        this.db.prepare(`INSERT INTO settings (${updateFields.map((k) => `"${k}"`).join(', ')}) VALUES (${updateFields.map(() => '?').join(', ')})`).run(...params);
      }
      return;
    }

    const pk = local ? local.id : remoteId;
    const updateResult = this.db.prepare(`UPDATE ${localTable} SET ${setClauses} WHERE id = ?`).run(...params, pk);

    if (updateResult.changes === 0) {
      const insertKeys = ['id', ...updateFields];
      const insertParams = [pk, ...params];
      try {
        this.db.prepare(`INSERT INTO ${localTable} (${insertKeys.map((k) => `"${k}"`).join(', ')}) VALUES (${insertKeys.map(() => '?').join(', ')})`).run(...insertParams);
      } catch (insertErr: any) {
        if (String(insertErr?.code || '').includes('PRIMARY') || String(insertErr?.message || '').includes('PRIMARY KEY')) {
          if (def.entity === 'restaurant_table' && remote.table_number) {
            this.db.prepare(`UPDATE ${localTable} SET ${setClauses} WHERE table_number = ? AND tenant_id = ?`).run(...params, String(remote.table_number), remote.tenant_id);
          } else {
            throw insertErr;
          }
        } else if (String(insertErr?.code || '').includes('UNIQUE')) {
          if (def.entity === 'tenant' && remote?.slug) {
            const existing = this.db.prepare(`SELECT id, remote_id FROM tenants WHERE slug = ?`).get(remote.slug) as { id: number; remote_id: number | null } | undefined;
            if (existing) {
              this.db.prepare(`UPDATE ${localTable} SET ${setClauses} WHERE id = ?`).run(...params, existing.id);
              if (!existing.remote_id) this.db.prepare(`UPDATE ${localTable} SET remote_id = ? WHERE id = ?`).run(remoteId, existing.id);
            }
          } else if (def.entity === 'tenant_user' && remote.tenant_id && remote.user_id) {
            const localTenantId = this.getLocalId('tenants', remote.tenant_id);
            const localUserId = this.getLocalId('users', remote.user_id);
            if (localTenantId && localUserId) {
              this.db.prepare(`UPDATE ${localTable} SET ${setClauses} WHERE tenant_id = ? AND user_id = ?`).run(...params, localTenantId, localUserId);
            }
          }
        } else {
          throw insertErr;
        }
      }
    }
  }

  /* ==================================================================
   *  FULL SYNC pour un tenant
   * ================================================================== */

  async fullSyncForTenant(tenantId: string): Promise<SyncResult> {
    const entities = getEntitiesBySyncOrder();
    let pushed = 0;
    let pulled = 0;
    let errors = 0;

    // Products first (push + pull)
    const productDef = entities.find(e => e.entity === 'product');
    if (productDef) {
      try {
        pushed += await this.pushByEntity('product', tenantId);
        pulled += await this.pullByEntity('product', tenantId);
      } catch (err: any) {
        console.error(`[GenericSync] Product sync failed:`, err?.message || err);
        errors++;
      }
    }

    for (const def of entities) {
      if (def.entity === 'product') continue;
      try {
        pushed += await this.pushByEntity(def.entity, tenantId);
        pulled += await this.pullByEntity(def.entity, tenantId);
      } catch (err: any) {
        console.error(`[GenericSync] ${def.entity} sync failed:`, err?.message || err);
        errors++;
      }
    }

    return { pushed, pulled, errors };
  }

  /* ==================================================================
   *  UTILITIES
   * ================================================================== */

  diagnoseSyncOutbox(tenantId: string): void {
    const allProducts = this.db.prepare(`SELECT COUNT(*) as count FROM sync_outbox WHERE entity='product'`).get() as any;
    const pendingProducts = this.db.prepare(`SELECT COUNT(*) as count FROM sync_outbox WHERE entity='product' AND status='pending'`).get() as any;
    const productsByTenant = this.db.prepare(`SELECT tenant_id, COUNT(*) as count FROM sync_outbox WHERE entity='product' GROUP BY tenant_id`).all() as any[];
    const productsByStatus = this.db.prepare(`SELECT status, COUNT(*) as count FROM sync_outbox WHERE entity='product' GROUP BY status`).all() as any[];
    console.log('[DIAG] Products in outbox:', allProducts?.count || 0, 'pending:', pendingProducts?.count || 0);
  }

  backfillOrphans(tenantId: string): number {
    const entities = getEntitiesBySyncOrder();
    let total = 0;

    for (const def of entities) {
      if (def.entity !== 'tenant' && !def.hasTenantId) continue;
      try {
        const tableInfo = this.db.prepare(`PRAGMA table_info(${def.localTable})`).all() as Array<{ name: string }>;
        const colNames = tableInfo.map((c) => c.name);
        if (!colNames.includes('remote_id')) continue;

        if (def.entity === 'tenant') {
          const orphans = this.db.prepare(`SELECT * FROM ${def.localTable} WHERE (remote_id IS NULL OR CAST(remote_id AS INTEGER) != remote_id) AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = ? AND status IN ('pending', 'in_progress', 'failed'))`).all(def.entity) as any[];
          for (const record of orphans) { this.queueChange(def.entity, 'insert', record); total++; }
        } else {
          const orphans = this.db.prepare(`SELECT * FROM ${def.localTable} WHERE tenant_id = ? AND (remote_id IS NULL OR CAST(remote_id AS INTEGER) != remote_id) AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = ? AND status IN ('pending', 'in_progress', 'failed'))`).all(tenantId, def.entity) as any[];
          for (const record of orphans) { this.queueChange(def.entity, 'insert', record); total++; }
        }
      } catch { /* skip tables that don't exist */ }
    }
    return total;
  }

  async forceSyncTenant(tenantId: string): Promise<SyncResult> {
    return this.fullSyncForTenant(tenantId);
  }

  syncOrphanDeletes(tenantId: string): number {
    const def = getEntityDef('product');
    if (!def) return 0;
    let queued = 0;
    try {
      const softDeletedProducts = this.db.prepare(`SELECT p.* FROM ${def.localTable} p WHERE p.tenant_id = ? AND (p.deleted_at IS NOT NULL OR p.is_available = 0) AND p.id NOT IN (SELECT o.record_id FROM sync_outbox o WHERE o.entity = 'product' AND o.operation = 'delete' AND o.status IN ('pending', 'in_progress') AND o.tenant_id = ?)`).all(tenantId, tenantId) as any[];
      for (const product of softDeletedProducts) {
        const remoteId = product.remote_id;
        if (!remoteId) continue;
        this.queueChange('product', 'delete', { id: product.id, remote_id: remoteId, tenant_id: product.tenant_id, is_available: 0, deleted_at: product.deleted_at || new Date().toISOString(), updated_at: new Date().toISOString() });
        queued++;
      }
    } catch (err: any) {
      console.error('[GenericSync] Error syncing orphan deletes:', err?.message ?? err);
    }
    return queued;
  }

  async fixInventoryMovementsProductIds(tenantId: string): Promise<number> {
    const def = getEntityDef('inventory_movement');
    if (!def) return 0;
    let fixed = 0;
    try {
      const movementsToFix = this.db.prepare(`SELECT im.id, im.product_id, im.remote_id FROM ${def.localTable} im WHERE im.tenant_id = ? AND im.product_id IS NOT NULL AND im.remote_id IS NOT NULL AND EXISTS (SELECT 1 FROM products p WHERE p.id = im.product_id AND p.remote_id IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM sync_outbox o WHERE o.entity = 'inventory_movement' AND o.record_id = im.id AND o.status IN ('pending', 'in_progress'))`).all(parseInt(tenantId, 10)) as any[];
      for (const movement of movementsToFix) {
        const localProduct = this.db.prepare(`SELECT remote_id FROM products WHERE id = ?`).get(movement.product_id) as any;
        if (localProduct?.remote_id) {
          const { data: remoteMovement } = await this.supabase.from(def.remoteTable).select('id, product_id').eq('id', movement.remote_id).single();
          if (remoteMovement && remoteMovement.product_id === null) {
            await this.supabase.from(def.remoteTable).update({ product_id: localProduct.remote_id }).eq('id', movement.remote_id);
            fixed++;
          }
        }
      }
    } catch (err: any) {
      console.error('[GenericSync] Error fixing inventory movements product_ids:', err?.message ?? err);
    }
    return fixed;
  }
}
