/**
 * src/sync/core/generic-sync.service.ts
 * Service générique de synchronisation qui utilise le registre d'entités
 * pour synchroniser TOUTES les tables de manière uniforme.
 * 
 * V2.3.2: Migration progressive avec dual-write et feature flags
 */
import type Database from 'better-sqlite3';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncEntityDefinition } from './entity-registry';
import { getEntityDef, getEntitiesBySyncOrder } from './entity-registry';
import { SyncPersistedCursor } from './sync-persisted-cursor';
import { ConflictResolver } from './conflict-resolver';
import { DeadLetterQueue } from './dead-letter-queue';

import { getRequestId, logTrace } from '../../server/utils/trace-utils';

// V2.3.2: Feature flags for progressive migration
import { SyncEngineModeManager } from '../../server/infrastructure/synchronization/sync-engine-mode';
import { RetryPolicy } from '../../server/infrastructure/synchronization/retry-policy';

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: number;
}

export class GenericSyncService {
  private db: Database.Database;
  private supabase: SupabaseClient;
  private cursor: SyncPersistedCursor;
  private conflictResolver: ConflictResolver;
  private dlq: DeadLetterQueue;

  // V2.3.2: Optional components for dual-write mode
  private outboxRepo?: any;
  private retryPolicy?: RetryPolicy;
  private modeManager: SyncEngineModeManager;

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

    // V2.3.2: Initialize feature flag manager
    this.modeManager = SyncEngineModeManager.getInstance();
    this.modeManager.logMode();

    // V2.3.2: Initialize components if enabled
    if (this.modeManager.isIdempotencyEnabled() || this.modeManager.isRetryPolicyEnabled()) {
      try {
        const { SqliteOutboxRepositoryFactory } = require('../../server/infrastructure/synchronization/outbox-repository');
        // Self-healing: the V2.3.2 repository requires extra columns on sync_outbox
        // (idempotency_key, next_retry_at, max_retries, sequence, error). If they are
        // missing (legacy/migrated DB), we MUST fall back to the legacy outbox path
        // instead of crashing every push with "no such column: next_retry_at".
        const cols = (this.db.prepare("PRAGMA table_info(sync_outbox)").all() as Array<{ name: string }>).map(c => c.name);
        if (cols.includes('idempotency_key')) {
          this.outboxRepo = SqliteOutboxRepositoryFactory.create();
          this.retryPolicy = new RetryPolicy();
          console.log('[GenericSyncV2] ✓ OutboxRepository and RetryPolicy initialized');
        } else {
          console.warn('[GenericSyncV2] sync_outbox missing V2 columns (idempotency_key) — falling back to LEGACY outbox path');
        }
      } catch (err: any) {
        console.warn('[GenericSyncV2] Failed to initialize V2.3.2 components:', err?.message);
      }
    }
  }

  /* ==================================================================
   *  HELPERS
   * ================================================================== */

  /**
   * Normalize tenant_id into an integer so we never persist float-like strings
   * (e.g. "6.0") into sync_outbox/sync_dlq tenant_id.
   */
  private normalizeTenantId(tenantIdRaw: any): number | null {
    if (tenantIdRaw === undefined || tenantIdRaw === null) return null;

    // Handle empty strings
    const asStr = String(tenantIdRaw).trim();
    if (asStr === '') return null;

    // Parse float then truncate (so "6.0" -> 6, " 6 " -> 6)
    const num = Number(asStr);
    if (!Number.isFinite(num)) return null;

    // Force integer type to avoid "6.0" vs "6" mismatch in SQLite queries
    return parseInt(String(Math.trunc(num)), 10);
  }

  private newId(): string {
    // Prefer browser crypto
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    // Node fallback
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
        const { data } = await this.supabase
          .from(def.remoteTable)
          .select('id')
          .eq('id', payload.remote_id)
          .maybeSingle();
        if (data) return data;
      }

      if (payload.slug) {
        const { data } = await this.supabase
          .from(def.remoteTable)
          .select('id')
          .eq('slug', payload.slug)
          .maybeSingle();
        if (data) return data;
      }

      if (payload.owner_email) {
        const { data } = await this.supabase
          .from(def.remoteTable)
          .select('id')
          .eq('owner_email', payload.owner_email)
          .maybeSingle();
        if (data) return data;
      }

      if (payload.name) {
        const { data } = await this.supabase
          .from(def.remoteTable)
          .select('id')
          .eq('name', payload.name)
          .limit(1)
          .single();
        if (data) return data;
      }
    }

    if (def.entity === 'product' && tenantId) {
      if (payload.barcode) {
        const { data } = await this.supabase
          .from(def.remoteTable)
          .select('id')
          .eq('barcode', payload.barcode)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (data) return data;
      }

      if (payload.sku) {
        const { data } = await this.supabase
          .from(def.remoteTable)
          .select('id')
          .eq('sku', payload.sku)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (data) return data;
      }

      if (payload.name) {
        const { data } = await this.supabase
          .from(def.remoteTable)
          .select('id')
          .eq('name', payload.name)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (data) return data;
      }
    }

    if (def.entity === 'category' && payload.name && tenantId) {
      const tenantIdInt = parseInt(String(tenantId), 10);
      console.log('[CATEGORY DUPLICATE CHECK]', {
        name: payload.name,
        tenantId: tenantIdInt
      });
      
      // CRITICAL: The unique constraint is on 'name' only, not (name, tenant_id)
      // So we must search by name alone first
      const { data } = await this.supabase
        .from(def.remoteTable)
        .select('id, tenant_id')
        .eq('name', payload.name)
        .maybeSingle();
      
      console.log('[CATEGORY DUPLICATE RESULT]', data);
      
      // If found, check if it's for the same tenant
      if (data) {
        const remoteTenantId = Number(data.tenant_id);
        if (remoteTenantId === tenantIdInt) {
          // Same tenant - it's a true duplicate
          return data;
        } else {
          // Different tenant - this is a cross-tenant name conflict
          console.warn(`[CATEGORY] Name "${payload.name}" exists for tenant ${remoteTenantId}, but we're syncing for tenant ${tenantIdInt}`);
          // Return the existing record so we don't try to insert again
          return data;
        }
      }
      
      return null;
    }

    if (def.entity === 'user' && payload.email) {
      const { data } = await this.supabase
        .from(def.remoteTable)
        .select('id')
        .eq('email', payload.email)
        .maybeSingle();
      return data;
    }

    if (def.entity === 'tenant_user' && payload.tenant_id && payload.user_id) {
      const remoteTid = this.getRemoteId('tenants', payload.tenant_id) || payload.tenant_id;
      const remoteUid = this.getRemoteId('users', payload.user_id) || payload.user_id;

      const { data } = await this.supabase
        .from(def.remoteTable)
        .select('id')
        .eq('tenant_id', remoteTid)
        .eq('user_id', remoteUid)
        .maybeSingle();
      return data;
    }

    return null;
  }

  /* ==================================================================
   *  QUEUE HELPERS
   * ================================================================== */

  async queueChange(entity: string, operation: 'insert' | 'update' | 'delete', record: any): Promise<void> {
    const requestId = getRequestId();
    logTrace('ENTER GenericSyncService.queueChange', { entity, operation, recordId: record.id });
    const def = getEntityDef(entity);
    if (!def) {
      logTrace('EXIT GenericSyncService.queueChange', { reason: 'no entity def' });
      return;
    }

    const id = this.newId();
    const payload = JSON.stringify(record);
    const version = record.version || 1;

    const tenantId = def.entity === 'tenant'
      ? this.normalizeTenantId(record.id)
      : this.normalizeTenantId(record.tenant_id);

    // ============================================
    // V2.3.2: DUAL WRITE - Legacy + OutboxRepository
    // ============================================
    
    // 1. LEGACY WRITE (toujours actif)
    try {
      const stmt = this.db.prepare(`
        INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(id, entity, operation, String(record.id), payload, version, tenantId);
      logTrace('EXIT GenericSyncService.queueChange (legacy)', { result });
    } catch (err: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'generic-sync.service.ts',
        function: 'queueChange',
        errorType: err?.constructor?.name,
        errorCode: err?.code,
        errorMessage: err?.message,
        errorStack: err?.stack,
        entity,
        operation,
        recordId: record.id
      }));
      throw err;
    }

    // 2. V2.3.2 WRITE (si activé)
    if (this.modeManager.isIdempotencyEnabled() && this.outboxRepo) {
      try {
        const idempotencyKey = `${entity}:${record.id}:${operation}:${Date.now()}`;
        
        await this.outboxRepo.save({
          eventType: operation,
          entity,
          recordId: record.id,
          payload,
          idempotencyKey,
          status: 'pending', // OutboxStatus.PENDING
          retryCount: 0,
          maxRetries: 3,
          nextRetryAt: new Date(Date.now() + 1000),
          error: null,
          createdAt: new Date(),
          processedAt: null
        });

        console.log('[OutboxV2] Event saved with idempotency_key:', idempotencyKey);
        logTrace('EXIT GenericSyncService.queueChange (V2.3.2)', { idempotencyKey });
      } catch (err: any) {
        console.warn('[OutboxV2] Failed to save event (non-critical):', err?.message);
        // NE PAS throw - le legacy write a réussi
      }
    }
  }

  queueChangeInsideTransaction(entity: string, operation: 'insert' | 'update' | 'delete', record: any) {
    const requestId = getRequestId();
    logTrace('ENTER GenericSyncService.queueChangeInsideTransaction', { entity, operation, recordId: record.id });
    
    const id = this.newId();
    const payload = JSON.stringify(record);
    const version = record.version || 1;

    const tenantId = entity === 'tenant'
      ? this.normalizeTenantId(record.id)
      : this.normalizeTenantId(record.tenant_id);

    logTrace('ENTER db.prepare INSERT sync_outbox');
    try {
      const stmt = this.db.prepare(`
        INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(id, entity, operation, String(record.id), payload, version, tenantId);
      logTrace('EXIT db.prepare INSERT sync_outbox', { result });
    } catch (err: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'generic-sync.service.ts',
        function: 'queueChangeInsideTransaction',
        errorType: err?.constructor?.name,
        errorCode: err?.code,
        errorMessage: err?.message,
        errorStack: err?.stack,
        entity,
        operation,
        recordId: record.id
      }));
      throw err;
    }
  }

  /* ==================================================================
   *  PUSH – Outbox → Supabase
   * ================================================================== */

  async pushByEntity(entity: string, tenantId: string): Promise<number> {
    const requestId = getRequestId();
    logTrace('ENTER GenericSyncService.pushByEntity', { entity, tenantId });
    const def = getEntityDef(entity);
    if (!def) {
      logTrace('EXIT GenericSyncService.pushByEntity', { reason: 'no entity def' });
      return 0;
    }

    // IMPORTANT: Use CAST to handle both TEXT ("6.0") and INTEGER (6) tenant_id values
    const tenantIdNum = parseInt(tenantId, 10);
    
    // DIAGNOSTIC: Count all products in outbox before filtering
    if (entity === 'product') {
      logTrace('ENTER db.prepare SELECT DIAG outbox stats');
      const totalInOutbox = this.db.prepare(`
        SELECT COUNT(*) AS total FROM sync_outbox WHERE entity='product'
      `).get() as any;
      const pendingInOutbox = this.db.prepare(`
        SELECT COUNT(*) AS pending FROM sync_outbox WHERE entity='product' AND status='pending'
      `).get() as any;
      const pendingForTenant = this.db.prepare(`
        SELECT COUNT(*) AS pending_for_tenant FROM sync_outbox 
        WHERE entity='product' AND status='pending' AND CAST(tenant_id AS INTEGER)=?
      `).get(tenantIdNum) as any;
      logTrace('EXIT db.prepare SELECT DIAG outbox stats', { 
        total: totalInOutbox?.total, 
        pending: pendingInOutbox?.pending,
        pendingForTenant: pendingForTenant?.pending_for_tenant 
      });
      
      // Show tenant_id distribution
      logTrace('ENTER db.prepare SELECT DIAG tenant distribution');
      const byTenant = this.db.prepare(`
        SELECT tenant_id, status, COUNT(*) as count 
        FROM sync_outbox 
        WHERE entity='product' 
        GROUP BY tenant_id, status
      `).all() as any[];
      logTrace('EXIT db.prepare SELECT DIAG tenant distribution', { byTenant });
    }
    
    logTrace('ENTER db.prepare SELECT outbox items');
    
    // V2.3.2: Use OutboxRepository if enabled
    let items: any[] = [];
    if (this.modeManager.isIdempotencyEnabled() && this.outboxRepo) {
      // V2.3.2: Get pending events from OutboxRepository
      const pendingEvents = await this.outboxRepo.findPendingOrdered();
      items = pendingEvents
        .filter((e: any) => e.entity === entity && (e.tenantId === tenantIdNum || e.tenantId === null))
        .slice(0, 50);
      console.log('[OutboxV2] Using OutboxRepository, found', items.length, 'pending events');
    } else {
      // Legacy: Get from sync_outbox directly
      items = this.db.prepare(`
        SELECT * FROM sync_outbox
        WHERE entity = ? AND status = 'pending' AND (tenant_id IS NULL OR CAST(tenant_id AS INTEGER) = ?)
        ORDER BY created_at ASC
        LIMIT 50
      `).all(entity, tenantIdNum) as any[];
    }
    
    logTrace('EXIT db.prepare SELECT outbox items', { count: items.length });
    
    // Log detail pour diagnostic
    if (items.length === 0) {
      logTrace('ENTER db.prepare SELECT DIAG status distribution');
      const byStatus = this.db.prepare(`
        SELECT status, tenant_id, COUNT(*) as count
        FROM sync_outbox
        WHERE entity = ?
        GROUP BY status, tenant_id
      `).all(entity) as any[];
      logTrace('EXIT db.prepare SELECT DIAG status distribution', { byStatus });
    }

    let successCount = 0;

    logTrace(`[GenericSync] pushByEntity ${def.entity}: processing ${items.length} items`);

    for (const item of items) {
      logTrace('ENTER db.prepare UPDATE outbox in_progress');
      this.db.prepare(`UPDATE sync_outbox SET status = 'in_progress' WHERE id = ?`).run(item.id);
      logTrace('EXIT db.prepare UPDATE outbox in_progress');

      try {
        const payload = JSON.parse(item.payload);
        const recordId = Number(item.record_id);
        if (isNaN(recordId)) {
          console.error(`[GenericSync] Invalid record_id for ${def.entity}: ${item.record_id}`);
          logTrace('ENTER db.prepare UPDATE outbox failed (invalid record_id)');
          this.db.prepare(`UPDATE sync_outbox SET status = 'failed', last_error = 'invalid record_id' WHERE id = ?`).run(item.id);
          logTrace('EXIT db.prepare UPDATE outbox failed (invalid record_id)');
          continue;
        }

        logTrace(`[GenericSync] Processing ${def.entity} #${recordId} (op=${item.operation})`);

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

        logTrace('ENTER db.prepare UPDATE outbox done');
        this.db.prepare(`UPDATE sync_outbox SET status = 'done' WHERE id = ?`).run(item.id);
        logTrace('EXIT db.prepare UPDATE outbox done');
        successCount++;
        logTrace(`[GenericSync] ✓ ${def.entity} #${recordId} synced successfully`);
      } catch (err: any) {
        const errorMsg = err?.message ?? String(err);
        
        // V2.3.2: Use RetryPolicy if enabled
        let newRetryCount = (item.retry_count || 0) + 1;
        let shouldMoveToDLQ = false;

        if (this.modeManager.isRetryPolicyEnabled() && this.retryPolicy) {
          const errorType = this.retryPolicy.classifyError(err);
          const maxRetries = this.retryPolicy.getMaxRetries(errorType);
          const nextRetry = this.retryPolicy.calculateRetryDelay(newRetryCount);

          console.log(`[RetryPolicy] Classified error: ${errorType}, maxRetries: ${maxRetries}, nextRetry: ${nextRetry}ms`);

          if (newRetryCount >= maxRetries) {
            shouldMoveToDLQ = true;
          }
        } else {
          // Legacy: hardcoded 5 retries
          shouldMoveToDLQ = newRetryCount >= 5;
        }
        
        // Special handling for duplicate key errors - mark as done since data already exists
        if (errorMsg.includes('duplicate key') || errorMsg.includes('unique constraint')) {
          console.log(`[GenericSync] ✓ ${def.entity} #${item.record_id} synced (duplicate detected in catch)`);
          logTrace('ENTER db.prepare UPDATE outbox done (duplicate)');
          this.db.prepare(`UPDATE sync_outbox SET status = 'done' WHERE id = ?`).run(item.id);
          logTrace('EXIT db.prepare UPDATE outbox done (duplicate)');
          successCount++;
          continue;
        }
        
        console.error(`[GenericSync] ✗ ${def.entity} #${item.record_id} failed:`, errorMsg);
        
        logTrace('ENTER db.prepare UPDATE outbox failed');
        this.db.prepare(`
          UPDATE sync_outbox 
          SET status = 'failed', retry_count = ?, last_error = ?
          WHERE id = ?
        `).run(newRetryCount, errorMsg, item.id);
        logTrace('EXIT db.prepare UPDATE outbox failed');

        // V2.3.2: Move to DLQ if max retries reached
        if (shouldMoveToDLQ) {
          if (this.modeManager.isDLQEnabled() && this.outboxRepo) {
            try {
              // V2.3.2 DLQ
              const { SqliteDLQRepositoryFactory } = require('../../server/infrastructure/synchronization/dead-letter-queue.repository');
              const dlqRepo = SqliteDLQRepositoryFactory.create();
              await dlqRepo.add(
                item.eventType || item.operation,
                '1',
                item.payload,
                item.idempotencyKey || item.id,
                errorMsg
              );
              console.log('[DLQ] Event moved to DLQ:', item.id);
            } catch (dlqErr) {
              console.warn('[DLQ] Failed to move to V2.3.2 DLQ, using legacy DLQ');
              this.dlq.archiveFailedItem(item.id, errorMsg, newRetryCount);
            }
          } else {
            // Legacy DLQ
            this.dlq.archiveFailedItem(item.id, errorMsg, newRetryCount);
          }
        }
      }
    }

    logTrace(`[GenericSync] pushByEntity ${def.entity}: completed ${successCount}/${items.length}`);
    console.log(`[GenericSync] pushByEntity ${def.entity}: completed ${successCount}/${items.length}`);
    return successCount;
  }

  private async handleUpsert(def: SyncEntityDefinition, item: any, payload: any, recordId: number, tenantId: string): Promise<boolean> {
    const { localTable, remoteTable, fieldMappings, statusMapping, foreignKeys } = def;

    // NORMALIZATION: For inventory_movement, ensure reference_id is an integer for Supabase BIGINT
    // This handles cases where reference_id might be stored as "3.0" in SQLite (TEXT column)
    if (def.entity === 'inventory_movement' && payload.reference_id !== undefined && payload.reference_id !== null) {
      const parsed = Number(payload.reference_id);
      if (!Number.isNaN(parsed)) {
        payload.reference_id = Math.trunc(parsed);
      }
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

    // Tenants: preserve the local id when creating a brand-new tenant in Supabase so
    // that all child entities (products, users, ...) keep consistent foreign keys.
    if (def.entity === 'tenant' && !safeUpdate.id && recordId) {
      const tid = Number(recordId);
      if (Number.isInteger(tid)) safeUpdate.id = String(tid);
    }

    // IMPORTANT:
    // If remote_id is not a valid integer (e.g. 'migrated_from_1_1_...'), 
    // do NOT send `id` to Supabase as it expects a bigint PK.
    // Let Supabase auto-generate the id via upsert without explicit id.
    if (safeUpdate.id !== undefined) {
      const idStr = String(safeUpdate.id);
      // Only keep id if it's a valid integer string
      if (!/^\d+$/.test(idStr)) {
        delete safeUpdate.id;
        console.log(`[GenericSync] Stripped invalid id for ${def.entity} #${recordId}: "${idStr}"`);
      }
    }

    for (const field of def.allowedFields) {
      if (payload[field] !== undefined) {
        let val = payload[field];

        if (def.booleanFields?.includes(field) && typeof val === 'number') val = val === 1;
        safeUpdate[field] = val;
      }
    }

    // PRODUCTS: mapping sku/barcode
    if (def.entity === 'product' && payload.sku !== undefined && payload.barcode !== undefined) {
      safeUpdate.sku = payload.sku;
      safeUpdate.barcode = payload.barcode;
    } else if (def.entity === 'product' && payload.sku !== undefined && safeUpdate.barcode === undefined) {
      safeUpdate.sku = payload.sku;
    } else if (def.entity === 'product' && payload.barcode !== undefined && safeUpdate.sku === undefined) {
      safeUpdate.barcode = payload.barcode;
    }

    if (!def.hasUpdatedAt) {
      delete safeUpdate.updated_at;
    }

    // PRODUCTS: barcode '' -> null to avoid unique constraint collisions
    if (def.entity === 'product' && safeUpdate.barcode !== undefined) {
      if (safeUpdate.barcode === null) {
        // ok
      } else {
        const b = String(safeUpdate.barcode).trim();
        if (b === '') safeUpdate.barcode = null;
      }
    }

    // Hard guard: strip version if entity doesn't have versionField
    if (!def.versionField && safeUpdate.version !== undefined) {
      delete safeUpdate.version;
    }

    if (def.entity === 'product') {
      delete safeUpdate.low_stock_threshold;
      if (safeUpdate.created_by === undefined) safeUpdate.created_by = payload.created_by ?? null;
      if (safeUpdate.updated_by === undefined) safeUpdate.updated_by = payload.updated_by ?? null;

      if (!safeUpdate.updated_at) safeUpdate.updated_at = new Date().toISOString();
      if (!safeUpdate.created_at && payload.created_at) safeUpdate.created_at = payload.created_at;
      if (!safeUpdate.created_at) safeUpdate.created_at = safeUpdate.updated_at;
    }

    if (def.entity === 'user') {
      // Supabase trigger `fn_validate_platform_user_tenant` forbids platform
      // users (is_platform_user = true) from carrying a tenant_id. Drop it so
      // the upsert is accepted and the user syncs as a platform user.
      const isPlatform = safeUpdate.is_platform_user === true || safeUpdate.is_platform_user === 1;
      if (isPlatform) {
        delete safeUpdate.tenant_id;
      }
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

    // FK strategy: if target is products and FK parent isn't ready => remove FK field and continue
    if (foreignKeys) {
      for (const [field, targetTable] of Object.entries(foreignKeys)) {
        if (safeUpdate[field] === undefined || safeUpdate[field] === null) continue;

        const remoteFkId = this.getRemoteId(targetTable, safeUpdate[field]);
        if (remoteFkId) {
          safeUpdate[field] = remoteFkId;
          continue;
        }

        if (targetTable === 'users' || targetTable === 'tenants') {
          // For restaurant_table, nullify assigned_waiter_id if user not synced yet
          // This allows the table to be created in Supabase even if the waiter isn't synced
          console.warn(`[GenericSync] ${targetTable} FK ${field}=${safeUpdate[field]} not synced yet, nullifying for ${def.entity} #${recordId}`);
          delete safeUpdate[field];
          continue;
        }

        if (targetTable === 'products') {
          // Pour les mouvements d'inventaire, on tente de résoudre le product_id
          if (def.entity === 'inventory_movement' && safeUpdate[field] !== undefined) {
            let resolvedProductId = this.getRemoteId(targetTable, safeUpdate[field]);
            
            // Si pas résolu, essayer de récupérer le remote_id depuis la table produits locale
            if (!resolvedProductId) {
              try {
                const localProduct = this.db.prepare(
                  `SELECT remote_id FROM products WHERE id = ?`
                ).get(safeUpdate[field]) as any;
                resolvedProductId = localProduct?.remote_id;
              } catch (err) {
                console.warn(`[GenericSync] Could not fetch product remote_id for inventory_movement:`, err);
              }
            }
            
            if (resolvedProductId) {
              safeUpdate[field] = resolvedProductId;
              continue;
            } else {
              // Produit pas encore synchronisé dans Supabase.
              // Maintenant que le schéma Supabase permet product_id NULL,
              // on peut synchroniser le mouvement avec product_id NULL.
              // Le mouvement sera corrigé automatiquement quand le produit sera synchronisé.
              console.warn(`[GenericSync] Product not synced yet, setting product_id to NULL for inventory_movement #${recordId}`);
              delete safeUpdate[field]; // Supprime product_id pour éviter NOT NULL violation
              continue;
            }
          }
          
          delete safeUpdate[field];
          continue;
        }

        if (safeUpdate.is_available === false || field === 'created_by' || field === 'updated_by') {
          delete safeUpdate[field];
        } else if (def.entity === 'voucher_request' || def.entity === 'subscription_payment_request') {
          // For voucher entities, preserve plan_id even if not resolved yet
          // The plan_id is critical and should not be nullified
          console.log(`[GenericSync] Preserving ${field} for ${def.entity} #${recordId} (FK resolution pending)`);
        } else {
          // For restaurant_table with assigned_waiter_id, we already handled it above
          // For other entities, silently skip the FK field instead of aborting
          console.warn(`[GenericSync] FK ${field}->${targetTable} not resolved for ${def.entity} #${recordId}, nullifying`);
          delete safeUpdate[field];
        }
      }
    }

    if (def.hasTenantId && tenantId) {
      // Platform users must NOT carry a tenant_id (Supabase trigger rejects it)
      const isPlatformUser = def.entity === 'user' && (safeUpdate.is_platform_user === true || safeUpdate.is_platform_user === 1);
      if (!isPlatformUser) {
        if (def.entity === 'product') safeUpdate.tenant_id = String(tenantId);
        else safeUpdate.tenant_id = Number(tenantId);
      }
    }

    if (def.entity === 'setting') {
      // Supabase `settings` is tenant-scoped: look up the row for THIS tenant only,
      // otherwise we could reuse another tenant's remote id and corrupt sync.
      const query = this.supabase.from(remoteTable).select('id').eq('key', safeUpdate.key);
      if (tenantId) query.eq('tenant_id', tenantId);
      const existingSetting = await query.maybeSingle();
      if (existingSetting.data?.id) safeUpdate.id = existingSetting.data.id;
      else delete safeUpdate.id;
    }

    // For products with invalid remote_id (non-numeric strings like 'migrated_from_*'),
    // do NOT send the id to Supabase - let Supabase auto-generate it.
    // A valid remote_id must be numeric since Supabase uses bigserial.
    let upsertPayload: Record<string, any>;
    const isValidRemoteId = effectiveRemoteId && /^\d+$/.test(String(effectiveRemoteId));
    if (effectiveRemoteId && isValidRemoteId) {
      upsertPayload = { ...safeUpdate, id: String(effectiveRemoteId) };
    } else {
      upsertPayload = safeUpdate;
    }
    
    // ⭐ DEBUG: Log the payload before sending to Supabase
    console.log(`[SUPABASE PUSH] ${def.entity} #${recordId} payload:`, JSON.stringify(upsertPayload, null, 2));
    
    const shouldInsert = def.entity === 'inventory_movement' && !effectiveRemoteId;

    if (shouldInsert) {
      const { data: insertData, error: insertError } = await this.supabase.from(remoteTable).insert(upsertPayload).select('id').single();
      if (insertError) throw insertError;
      console.log(`[SUPABASE RESPONSE] ${def.entity} #${recordId} insert success:`, insertData?.id);
      if (!payload.remote_id && insertData?.id) {
        this.db.prepare(`UPDATE ${localTable} SET remote_id = ? WHERE id = ?`).run(insertData.id, recordId);
      }
      return true;
    }

    // Upsert
    console.log(`[SUPABASE UPLOAD] ${def.entity} #${recordId} upsert to ${remoteTable} with id=${upsertPayload.id || 'AUTO'}`);
    const { data, error } = await this.supabase.from(remoteTable).upsert(upsertPayload).select('id').single();
    console.log(`[SUPABASE RESPONSE] ${def.entity} #${recordId}:`, JSON.stringify({ data, error }, null, 2));
    if (error) {
      console.error(`[${def.entity.toUpperCase()} UPSERT ERROR]`, {
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        payload: upsertPayload,
        tenantId: tenantId,
        recordId: recordId
      });
      
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        // Duplicate found - the data already exists in Supabase
        // Update local remote_id mapping and mark as done
        const existing = await this.findExistingRemoteRecord(def, payload, tenantId);
        if (existing?.id) {
          this.db.prepare(`UPDATE ${localTable} SET remote_id = ? WHERE id = ?`).run(existing.id, recordId);
        }
        
        console.log(`[GenericSync] ✓ ${def.entity} #${recordId} synced (duplicate - data already exists)`);
        return true;
      }
      throw error;
    }

    // Always update local remote_id after successful Supabase upsert,
    // even if payload.remote_id already existed (it might be invalid like 'migrated_from_*')
    if (data?.id) {
      const currentLocalRemoteId = this.getRemoteId(localTable, recordId);
      // Only update if the remote_id changed (newly created or different from current)
      if (currentLocalRemoteId !== data.id) {
        this.db.prepare(`UPDATE ${localTable} SET remote_id = ? WHERE id = ?`).run(data.id, recordId);
        console.log(`[GenericSync] Updated ${def.entity} #${recordId} remote_id: ${currentLocalRemoteId || 'NULL'} → ${data.id}`);
      }
    }
    
    return true;
  }

  private async handleDelete(
    def: SyncEntityDefinition,
    _item: any,
    payload: any,
    recordId: number,
    remoteId?: number | string | null
  ) {
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
        is_available: false,
        deleted_at: new Date().toISOString(),
        status: 'archived',
        updated_at: new Date().toISOString(),
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
    } else {
      console.warn(`[GenericSync] Cannot delete ${def.entity} #${recordId} in Supabase: no remote_id found`);
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

    let data: any[] | null = null;
    let error: any = null;

    const { data: primaryData, error: primaryError } = await query;
    data = primaryData;
    error = primaryError;

    if (error && entity !== 'tenant' && hasUpdatedAt && error.message?.toLowerCase().includes('updated_at')) {
      console.warn(`[GenericSync] updated_at is unavailable for ${entity}; falling back to created_at`, error.message);
      const fallbackQuery = this.supabase.from(remoteTable)
        .select('*')
        .eq('tenant_id', tenantIdForQuery)
        .gt('created_at', since)
        .order('created_at', { ascending: true });
      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      if (fallbackError) {
        console.error(`[GenericSync] Failed to pull ${entity} from Supabase:`, fallbackError.message);
        return 0;
      }
      data = fallbackData;
    } else if (error) {
      console.error(`[GenericSync] Failed to pull ${entity} from Supabase:`, error.message);
      return 0;
    }
    if (!data || data.length === 0) return 0;

    let applied = 0;
    // Tracks whether any row in the batch failed to apply. If so we must NOT
    // advance the pull cursor (see below) so the next sync cycle re-pulls and
    // retries the failed rows instead of leaving them stranded "behind" the
    // cursor forever (which is how 2 orders could silently disappear).
    let hadError = false;

    const transaction = this.db.transaction((rows: any[]) => {
      for (const remote of rows) {
        try {
          // Scoping tenant: for tenant entity, accept any remote tenant (discovery sync)
          // For other entities, filter by tenant_id
          if (entity !== 'tenant') {
            const remoteTenantId = remote.tenant_id;
            if (remoteTenantId && entity !== 'user') {
              const remoteTenantInt = Number.isFinite(Number(remoteTenantId))
                ? parseInt(String(remoteTenantId), 10)
                : NaN;
              const localTenantInt = Number.isFinite(Number(tenantId))
                ? parseInt(String(tenantId), 10)
                : NaN;
              if (!Number.isNaN(remoteTenantInt) && !Number.isNaN(localTenantInt) && remoteTenantInt !== localTenantInt) {
                continue;
              }
            }
          }
          // For tenant entity, no scoping - we sync ALL remote tenants for discovery

          const remoteId = Number(remote.id);
          if (isNaN(remoteId)) continue;

          const local = this.findLocalRow(def, remoteId, remote);

          const isRemoteSoftDeleted =
            def.entity === 'product' &&
            (remote.is_available === false || remote.deleted_at !== null || remote.status === 'archived');

          const remoteTs = remote.updated_at || remote.created_at;
          const localTs = local?.updated_at || local?.created_at;

          // ─── Gestion de conflits (orders / order_items) ──────────────────────
          // Si une ligne locale existe ET a été modifiée de façon concurrente au
          // remote (écart de version > 1), on journalise le conflit dans
          // sync_conflicts (résolution LWW versionnée) avant d'appliquer le remote.
          if ((def.entity === 'order' || def.entity === 'order_item') && local && local.version) {
            const isConflict = this.conflictResolver.detectConflict(
              def.entity,
              local.id,
              remoteId,
              localTs || '',
              remoteTs || '',
              Number(local.version || 1),
              Number(remote.version || 1)
            );
            if (isConflict) {
              const resolution = this.conflictResolver.resolveLWW(
                Number(local.version || 1),
                Number(remote.version || 1),
                localTs || '',
                remoteTs || ''
              );
              this.conflictResolver.logResolvedConflict(
                { entity: def.entity, localId: local.id, remoteId },
                def.entity,
                { version: local.version, updated_at: localTs },
                { version: remote.version, updated_at: remoteTs },
                resolution,
                `Concurrent modification on pull (local v${local.version} vs remote v${remote.version}) — ${resolution}`
              );
            }
          }

          const shouldApply =
            !local || !localTs || (remoteTs && new Date(remoteTs) > new Date(localTs)) || isRemoteSoftDeleted;

          if (!shouldApply) continue;

          const fields = this.buildPullFields(def, remote, local, remoteId, tenantId);
          this.applyPullRow(def, fields, local, remoteId, remote);

          applied++;
        } catch (err: any) {
          hadError = true;
          console.error(`[GenericSync] Error pulling ${entity} #${remote.id}:`, err?.message || err);
        }
      }
    });

    transaction(data);

    // Self-healing cursor:
    // - If EVERY row applied cleanly, advance the cursor past this batch as usual.
    // - If ANY row failed to apply, reset the cursor to epoch so the NEXT sync
    //   cycle re-pulls the whole window and retries the rows that failed (e.g.
    //   orders whose FK referenced a not-yet-synced table/user). Without this a
    //   failed row is left permanently "behind" the cursor and the local SQLite
    //   DB silently loses that record (this is exactly how 2 orders went missing).
    if (hadError) {
      this.cursor.reset(cursorKey);
      console.warn(`[GenericSync] Pull of ${entity}: ${applied} applied but some rows failed — resetting cursor to retry next cycle`);
    } else if (data.length > 0) {
      const lastTs = (data as any[])[data.length - 1].updated_at || (data as any[])[data.length - 1].created_at;
      if (lastTs) {
        this.cursor.set(cursorKey, lastTs instanceof Date ? lastTs.toISOString() : String(lastTs));
      }
    }

    return applied;
  }

  private findLocalRow(
    def: SyncEntityDefinition,
    remoteId: number,
    remote: any
  ): { id: number; updated_at: string; created_at: string; version: number } | undefined {
    const { localTable } = def;
    try {
      const byRemote = this.db
        .prepare(`SELECT id, updated_at, created_at, version FROM ${localTable} WHERE remote_id = ?`)
        .get(remoteId) as any;
      if (byRemote) return byRemote;

      const byDirectId = this.db
        .prepare(`SELECT id, updated_at, created_at, version FROM ${localTable} WHERE id = ?`)
        .get(remoteId) as any;
      if (byDirectId) return byDirectId;

      if (def.entity === 'product' && remote.name && remote.tenant_id) {
        return this.db
          .prepare(`SELECT id, updated_at, created_at, version FROM products WHERE name = ? AND tenant_id = ?`)
          .get(remote.name, remote.tenant_id) as any;
      }

      if (def.entity === 'category' && remote.name && remote.tenant_id) {
        return this.db
          .prepare(`SELECT id, updated_at, created_at, version FROM categories WHERE name = ? AND tenant_id = ?`)
          .get(remote.name, remote.tenant_id) as any;
      }

      if (def.entity === 'restaurant_table' && remote.table_number && remote.tenant_id) {
        return this.db
          .prepare(
            `SELECT id, updated_at, created_at, version FROM restaurant_tables WHERE table_number = ? AND tenant_id = ?`
          )
          .get(String(remote.table_number), remote.tenant_id) as any;
      }

      if (def.entity === 'user' && remote.username) {
        return this.db
          .prepare(`SELECT id, updated_at, created_at, version FROM users WHERE username = ?`)
          .get(remote.username) as any;
      }

      if (def.entity === 'tenant' && remote.slug) {
        return this.db
          .prepare(`SELECT id, updated_at, created_at, version FROM tenants WHERE slug = ?`)
          .get(remote.slug) as any;
      }

      if (def.entity === 'tenant' && remote.owner_email) {
        return this.db
          .prepare(`SELECT id, updated_at, created_at, version FROM tenants WHERE owner_email = ?`)
          .get(remote.owner_email) as any;
      }

      if (def.entity === 'tenant' && remote.name) {
        return this.db
          .prepare(`SELECT id, updated_at, created_at, version FROM tenants WHERE name = ?`)
          .get(remote.name) as any;
      }

      if (def.entity === 'tenant_user' && remote.tenant_id && remote.user_id) {
        const localTenantId = this.getLocalId('tenants', remote.tenant_id);
        const localUserId = this.getLocalId('users', remote.user_id);
        if (localTenantId && localUserId) {
          return this.db
            .prepare(
              `SELECT id, updated_at, created_at, version FROM tenant_users WHERE tenant_id = ? AND user_id = ?`
            )
            .get(localTenantId, localUserId) as any;
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

  private buildPullFields(
    def: SyncEntityDefinition,
    remote: any,
    _local: any,
    remoteId: number,
    tenantId: string
  ): Record<string, any> {
    const { allowedFields, fieldMappings, reverseStatusMapping, booleanFields, jsonFields, foreignKeys } = def;

    const fields: Record<string, any> = {
      remote_id: remoteId,
      updated_at: remote.updated_at
        ? remote.updated_at instanceof Date
          ? remote.updated_at.toISOString()
          : String(remote.updated_at)
        : new Date().toISOString(),
      created_at: remote.created_at
        ? remote.created_at instanceof Date
          ? remote.created_at.toISOString()
          : String(remote.created_at)
        : new Date().toISOString(),
    };

    if (remote.version !== undefined) fields.version = remote.version;

    // Apply allowed fields
    for (const field of allowedFields) {
      if (field === 'id' || field === 'created_at' || field === 'updated_at' || field === 'remote_id') continue;
      if (remote[field] !== undefined) fields[field] = remote[field];
    }

    // Remote -> Local FK resolution already exists in local schema; keep it simple:
    if (foreignKeys) {
      for (const [field, targetTable] of Object.entries(foreignKeys)) {
        if (fields[field] !== undefined && fields[field] !== null) {
          const localFkId = this.getLocalId(targetTable, fields[field]);
          // If the referenced local row isn't synced yet, store NULL instead of
          // the dangling remote id. Keeping the remote id would violate the local
          // FK constraint and cause the whole row to be skipped (e.g. an order
          // whose table_id/waiter_id points to a not-yet-pulled table/user would
          // silently disappear from the local SQLite DB). The order must still
          // exist locally even if a related row is missing — mirroring the push
          // path's nullify behaviour and the previous dedicated order PullSync.
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

  private applyPullRow(
    def: SyncEntityDefinition,
    fields: Record<string, any>,
    local: any,
    remoteId: number,
    remote: any
  ) {
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
      // Settings are per-tenant: the primary key is (key, tenant_id). Always scope
      // by both so a remote row can never overwrite a *different* tenant's setting.
      const tenantId = fields.tenant_id;
      const existingSetting = this.db
        .prepare('SELECT key FROM settings WHERE key = ? AND tenant_id = ?')
        .get(fields.key, tenantId) as any;
      if (existingSetting) {
        this.db
          .prepare(`UPDATE settings SET ${setClauses} WHERE key = ? AND tenant_id = ?`)
          .run(...params, fields.key, tenantId);
      } else {
        this.db
          .prepare(
            `INSERT INTO settings (${updateFields.map((k) => `"${k}"`).join(', ')}) VALUES (${updateFields
              .map(() => '?')
              .join(', ')})`
          )
          .run(...params);
      }
      return;
    }

    const pk = local ? local.id : remoteId;

    const updateResult = this.db.prepare(`UPDATE ${localTable} SET ${setClauses} WHERE id = ?`).run(...params, pk);
    if (updateResult.changes === 0) {
      const insertKeys = ['id', ...updateFields];
      const insertParams = [pk, ...params];

      try {
        this.db
          .prepare(
            `INSERT INTO ${localTable} (${insertKeys.map((k) => `"${k}"`).join(', ')}) VALUES (${insertKeys
              .map(() => '?')
              .join(', ')})`
          )
          .run(...insertParams);
      } catch (insertErr: any) {
        if (String(insertErr?.code || '').includes('PRIMARY') || String(insertErr?.message || '').includes('PRIMARY KEY')) {
          if (def.entity === 'restaurant_table' && remote.table_number) {
            this.db
              .prepare(`UPDATE ${localTable} SET ${setClauses} WHERE table_number = ? AND tenant_id = ?`)
              .run(...params, String(remote.table_number), remote.tenant_id);
          } else {
            throw insertErr;
          }
        } else if (String(insertErr?.code || '').includes('UNIQUE')) {
          if (def.entity === 'tenant' && remote?.slug) {
            const existing = this.db.prepare(`SELECT id, remote_id FROM tenants WHERE slug = ?`).get(remote.slug) as { id: number; remote_id: number | null } | undefined;
            if (existing) {
              this.db.prepare(`UPDATE ${localTable} SET ${setClauses} WHERE id = ?`).run(...params, existing.id);
              if (!existing.remote_id) {
                this.db.prepare(`UPDATE ${localTable} SET remote_id = ? WHERE id = ?`).run(remoteId, existing.id);
              }
              return;
            }
          }
          if (def.entity === 'tenant_user' && remote.tenant_id && remote.user_id) {
            const localTenantId = this.getLocalId('tenants', remote.tenant_id);
            const localUserId = this.getLocalId('users', remote.user_id);
            if (localTenantId && localUserId) {
              this.db
                .prepare(`UPDATE ${localTable} SET ${setClauses} WHERE tenant_id = ? AND user_id = ?`)
                .run(...params, localTenantId, localUserId);
            }
          } else {
            console.warn(`[GenericSync] UNIQUE constraint skip for ${def.entity} #${remoteId}:`, insertErr.message);
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

    // Diagnostic: Check ALL pending outbox items before sync
    try {
      const allPending = this.db.prepare(`
        SELECT entity, COUNT(*) as count FROM sync_outbox 
        WHERE status = 'pending' AND (entity = 'tenant' OR CAST(tenant_id AS INTEGER) = ?)
        GROUP BY entity
      `).all(parseInt(tenantId, 10)) as { entity: string; count: number }[];
      if (allPending.length > 0) {
        console.log(`[GenericSync] Pending outbox items for tenant #${tenantId}:`, allPending.map(e => `${e.entity}:${e.count}`).join(', '));
      }
    } catch { /* ignore diagnostic errors */ }

    // Push-first for PRODUCTS to guarantee bidirectional freshness even when other tables fail pulling.
    const productDef = entities.find(e => e.entity === 'product');
    if (productDef) {
      try {
        console.log(`[GenericSync] >>> Starting PRODUCT sync (push then pull)`);
        const pendingProducts = this.db.prepare(`
          SELECT COUNT(*) as count FROM sync_outbox 
          WHERE entity = 'product' AND status = 'pending' AND CAST(tenant_id AS INTEGER) = ?
        `).get(parseInt(tenantId, 10)) as any;
        console.log(`[GenericSync] Pending products in outbox: ${pendingProducts?.count || 0}`);
        
        pushed += await this.pushByEntity('product', tenantId);
        console.log(`[GenericSync] Product push completed: ${pushed} items pushed`);
      } catch (err: any) {
        console.error(`[GenericSync] Product push failed:`, err?.message || err);
        errors++;
      }

      try {
        pulled += await this.pullByEntity('product', tenantId);
        console.log(`[GenericSync] Product pull completed: ${pulled} items pulled`);
      } catch (err: any) {
        console.error(`[GenericSync] Product pull failed:`, err?.message || err);
        errors++;
      }
    }

    for (const def of entities) {
      // Already handled product above (push+pull). Still keep ordering for other entities.
      if (def.entity === 'product') continue;

      try {
        // Log pending items before push for this entity
        const pendingCount = this.db.prepare(`
          SELECT COUNT(*) as count FROM sync_outbox 
          WHERE entity = ? AND status = 'pending' AND CAST(tenant_id AS INTEGER) = ?
        `).get(def.entity, parseInt(tenantId, 10)) as any;
        
        if (pendingCount?.count > 0) {
          console.log(`[GenericSync] Pending ${def.entity}: ${pendingCount.count} items - STARTING SYNC`);
        }
        
        const p = await this.pushByEntity(def.entity, tenantId);
        pushed += p;
        if (p > 0) console.log(`[GenericSync] ✓ ${def.entity} push completed: ${p} items`);
        else if (pendingCount?.count > 0) console.log(`[GenericSync] ⚠ ${def.entity} push: 0 items pushed (${pendingCount.count} pending)`);

        // Pull all entities including restaurant_table and category
        const pl = await this.pullByEntity(def.entity, tenantId);
        pulled += pl;
        if (pl > 0) console.log(`[GenericSync] ✓ ${def.entity} pull completed: ${pl} items`);
      } catch (err: any) {
        console.error(`[GenericSync] ✗ ${def.entity} sync failed:`, err?.message || err);
        errors++;
      }
    }

    // ── Self-heal: si order/order_item ont moins de lignes locales que distantes,
    // le curseur est coincé (lignes ratées passées derrière) → on le reset pour
    // que le prochain cycle re-tire tout et récupère les enregistrements manquants.
    try {
      for (const entity of ['order', 'order_item']) {
        const def = getEntityDef(entity);
        if (!def) continue;
        const localCount = this.db.prepare(`SELECT COUNT(*) as c FROM ${def.localTable} WHERE tenant_id = ?`).get(tenantId) as any;
        const { count: remoteCount, error } = await this.supabase
          .from(def.remoteTable)
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);
        const remoteCountNum = remoteCount ?? 0;
        if (!error && remoteCountNum > (localCount?.c ?? 0)) {
          console.warn(`[SyncV2] Self-heal ${entity}: local=${localCount.c} remote=${remoteCountNum} — resetting cursor`);
          this.cursor.reset(entity);
        }
      }
    } catch {}

    return { pushed, pulled, errors };
  }

  diagnoseSyncOutbox(tenantId: string): void {
    console.log('=== SYNC_OUTBOX DIAGNOSTIC ===');
    console.log('[DIAG] Tenant ID:', tenantId);
    
    const allProducts = this.db.prepare(`SELECT COUNT(*) as count FROM sync_outbox WHERE entity='product'`).get() as any;
    console.log('[DIAG] Total products in sync_outbox:', allProducts?.count || 0);
    
    const pendingProducts = this.db.prepare(`SELECT COUNT(*) as count FROM sync_outbox WHERE entity='product' AND status='pending'`).get() as any;
    console.log('[DIAG] Pending products in sync_outbox:', pendingProducts?.count || 0);
    
    const productsByTenant = this.db.prepare(`
      SELECT tenant_id, COUNT(*) as count 
      FROM sync_outbox 
      WHERE entity='product' 
      GROUP BY tenant_id
    `).all() as any[];
    console.log('[DIAG] Products by tenant_id:', productsByTenant);
    
    const productsByStatus = this.db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM sync_outbox 
      WHERE entity='product' 
      GROUP BY status
    `).all() as any[];
    console.log('[DIAG] Products by status:', productsByStatus);
    
    const nullTenantProducts = this.db.prepare(`
      SELECT COUNT(*) as count FROM sync_outbox 
      WHERE entity='product' AND tenant_id IS NULL
    `).get() as any;
    console.log('[DIAG] Products with NULL tenant_id:', nullTenantProducts?.count || 0);
    
    const sampleProducts = this.db.prepare(`
      SELECT id, entity, operation, record_id, tenant_id, status 
      FROM sync_outbox 
      WHERE entity='product' 
      LIMIT 10
    `).all() as any[];
    console.log('[DIAG] Sample products:', sampleProducts);
    
    console.log('=== END DIAGNOSTIC ===');
  }

  backfillOrphans(tenantId: string): number {
    const entities = getEntitiesBySyncOrder();
    let total = 0;

    for (const def of entities) {
      // Skip entities without tenant_id (except tenant which is handled separately)
      if (def.entity !== 'tenant' && !def.hasTenantId) continue;

      try {
        const tableInfo = this.db.prepare(`PRAGMA table_info(${def.localTable})`).all() as Array<{ name: string }>;
        const colNames = tableInfo.map((c) => c.name);
        if (!colNames.includes('remote_id')) continue;

        if (def.entity === 'tenant') {
          // For tenants: backfill by local id (no tenant_id filter)
          const orphans = this.db.prepare(`
            SELECT * FROM ${def.localTable}
            WHERE (remote_id IS NULL OR CAST(remote_id AS INTEGER) != remote_id)
            AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = ? AND status IN ('pending', 'in_progress', 'failed'))
          `).all(def.entity) as any[];

          for (const record of orphans) {
            this.queueChange(def.entity, 'insert', record);
            total++;
          }
        } else if (def.entity === 'setting') {
          const orphans = this.db
            .prepare(`
              SELECT * FROM ${def.localTable}
              WHERE tenant_id = ? AND (remote_id IS NULL OR CAST(remote_id AS INTEGER) != remote_id)
              AND key NOT IN (SELECT record_id FROM sync_outbox WHERE entity = ? AND status IN ('pending', 'in_progress', 'failed'))
            `)
            .all(tenantId, def.entity) as any[];

          for (const record of orphans) {
            this.queueChange(def.entity, 'insert', record);
            total++;
          }
        } else {
          const orphans = this.db
            .prepare(`
              SELECT * FROM ${def.localTable}
              WHERE tenant_id = ? AND (remote_id IS NULL OR CAST(remote_id AS INTEGER) != remote_id)
              AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = ? AND status IN ('pending', 'in_progress', 'failed'))
            `)
            .all(tenantId, def.entity) as any[];

          for (const record of orphans) {
            this.queueChange(def.entity, 'insert', record);
            total++;
          }
        }
      } catch {
        // ignore
      }
    }

    return total;
  }

  /**
   * Force sync for a specific tenant - useful for manual sync triggers
   */
  async forceSyncTenant(tenantId: string): Promise<SyncResult> {
    return this.fullSyncForTenant(tenantId);
  }

  /**
   * Synchronise les produits soft-deletés localement mais pas encore supprimés dans Supabase.
   * Méthode utilisée par l'orchestrateur pour les cas où la suppression n'a pas été queue correctement.
   */
  syncOrphanDeletes(tenantId: string): number {
    const def = getEntityDef('product');
    if (!def) {
      console.warn('[GenericSync] Cannot sync orphan deletes: product entity not found');
      return 0;
    }

    let queued = 0;

    try {
      const softDeletedProducts = this.db.prepare(`
        SELECT p.* 
        FROM ${def.localTable} p
        WHERE p.tenant_id = ?
          AND (p.deleted_at IS NOT NULL OR p.is_available = 0)
          AND p.id NOT IN (
            SELECT o.record_id 
            FROM sync_outbox o 
            WHERE o.entity = 'product' 
              AND o.operation = 'delete' 
              AND o.status IN ('pending', 'in_progress')
              AND o.tenant_id = ?
          )
      `).all(tenantId, tenantId) as any[];

      console.log(`[GenericSync] Found ${softDeletedProducts.length} soft-deleted products not in outbox for tenant #${tenantId}`);

      for (const product of softDeletedProducts) {
        const remoteId = product.remote_id;
        if (!remoteId) {
          console.log(`[GenericSync] Product #${product.id} has no remote_id, skipping orphan delete sync`);
          continue;
        }

        this.queueChange('product', 'delete', {
          id: product.id,
          remote_id: remoteId,
          tenant_id: product.tenant_id,
          is_available: 0,
          deleted_at: product.deleted_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        queued++;
        console.log(`[GenericSync] Queued orphan delete for product #${product.id} (remote=${remoteId})`);
      }
    } catch (err: any) {
      console.error('[GenericSync] Error syncing orphan deletes:', err?.message ?? err);
    }

    return queued;
  }

  /**
   * Corrige les mouvements d'inventaire avec product_id NULL en les associant
   * aux produits correspondants une fois ceux-ci synchronisés.
   * 
   * Cette méthode doit être appelée après la synchronisation des produits
   * pour corriger les mouvements qui ont été synchronisés avec product_id NULL.
   */
  fixInventoryMovementsProductIds(tenantId: string): Promise<number> {
    return this.fixInventoryMovementsProductIdsForTenant(tenantId);
  }

  private async fixInventoryMovementsProductIdsForTenant(tenantId: string): Promise<number> {
    const def = getEntityDef('inventory_movement');
    if (!def) {
      console.warn('[GenericSync] Cannot fix inventory movements: entity not found');
      return 0;
    }

    let fixed = 0;

    try {
      // Trouver les mouvements locaux avec product_id NULL qui ont été synchronisés
      // mais dont le produit local existe maintenant avec un remote_id
      const movementsToFix = this.db.prepare(`
        SELECT im.id, im.product_id, im.remote_id
        FROM ${def.localTable} im
        WHERE im.tenant_id = ?
          AND im.product_id IS NOT NULL
          AND im.remote_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM products p 
            WHERE p.id = im.product_id AND p.remote_id IS NOT NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM sync_outbox o
            WHERE o.entity = 'inventory_movement'
              AND o.record_id = im.id
              AND o.status IN ('pending', 'in_progress')
          )
      `).all(parseInt(tenantId, 10)) as any[];

      console.log(`[GenericSync] Found ${movementsToFix.length} inventory movements to check for product_id correction`);

      // Pour chaque mouvement, vérifier si son product_id a un remote_id dans Supabase
      for (const movement of movementsToFix) {
        const localProduct = this.db.prepare(
          `SELECT remote_id FROM products WHERE id = ?`
        ).get(movement.product_id) as any;

        if (localProduct?.remote_id) {
          // Vérifier si le mouvement dans Supabase a product_id NULL
          const { data: remoteMovement, error } = await this.supabase
            .from(def.remoteTable)
            .select('id, product_id')
            .eq('id', movement.remote_id)
            .single();

          if (error) {
            console.warn(`[GenericSync] Error fetching remote movement #${movement.remote_id}:`, error.message);
            continue;
          }

          if (remoteMovement && remoteMovement.product_id === null) {
            // Mettre à jour le mouvement dans Supabase avec le bon product_id
            const { error: updateError } = await this.supabase
              .from(def.remoteTable)
              .update({ product_id: localProduct.remote_id })
              .eq('id', movement.remote_id);

            if (updateError) {
              console.warn(`[GenericSync] Error updating product_id for movement #${movement.remote_id}:`, updateError.message);
            } else {
              console.log(`[GenericSync] Fixed inventory_movement #${movement.id} (remote=${movement.remote_id}) with product_id=${localProduct.remote_id}`);
              fixed++;
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[GenericSync] Error fixing inventory movements product_ids:', err?.message ?? err);
    }

    return fixed;
  }
}