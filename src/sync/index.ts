// src/sync/index.ts (copy for PR artifact)
// Point d'entrée du module Sync Engine

import { ensureSyncTables } from './core/ensure-sync-tables';
import { SyncScheduler } from './core/sync-scheduler';
import { SupabaseAdapter } from './core/supabase-adapter';
import type Database from 'better-sqlite3';
import { initializeProductSyncAdapter } from './compat';

let syncScheduler: SyncScheduler | null = null;
let database: Database.Database | null = null;

export function initializeSyncEngine(
  db: Database.Database,
  config?: { intervalMs?: number; mode?: 'local' | 'cloud' | 'hybrid'; enablePull?: boolean }
): SyncScheduler {
  database = db;

  ensureSyncTables(db);

  const supabaseAdapter = new SupabaseAdapter();

  syncScheduler = new SyncScheduler(db, supabaseAdapter, {
    mode: config?.mode ?? 'local',
    syncIntervalMs: config?.intervalMs ?? 30000,
    pushBatchSize: 100,
    enablePull: config?.mode !== 'local',
    enablePush: true,
    enableOrphanRecovery: true,
    workerId: `scheduler-${Date.now()}`,
  });

  initializeProductSyncAdapter(db);

  let emitEngineFingerprint: (...args: any[]) => void = () => {};
  let emitPushEngineFingerprint: (...args: any[]) => void = () => {};
  let emitPullEngineFingerprint: (...args: any[]) => void = () => {};
  try {
    const mf = require('../instrumentation/engine-fingerprint');
    emitEngineFingerprint = mf.emitEngineFingerprint ?? emitEngineFingerprint;
    emitPushEngineFingerprint = mf.emitPushEngineFingerprint ?? emitPushEngineFingerprint;
    emitPullEngineFingerprint = mf.emitPullEngineFingerprint ?? emitPullEngineFingerprint;
  } catch (e: any) {
    console.warn('[SyncV3] engine-fingerprint not available:', (e && (e as any).message) || e);
  }
  emitEngineFingerprint('SyncScheduler', 'V3', {
    timer: config?.intervalMs ?? 30000,
    mode: config?.mode ?? 'local',
    source: 'src/sync/index.ts:initializeSyncEngine',
  });
  emitPushEngineFingerprint(`push-${Date.now()}`, config?.mode ?? 'local', `scheduler-${Date.now()}`);
  if (config?.mode !== 'local') {
    emitPullEngineFingerprint(`pull-${Date.now()}`, config?.mode ?? 'local');
  }

  console.log('[SyncV3] SyncScheduler initialized');
  return syncScheduler;
}

export function getSyncScheduler(): SyncScheduler | null {
  return syncScheduler;
}

export function setSyncDatabase(dbInstance: Database.Database | null): void {
  if (dbInstance) {
    database = dbInstance;
  }
}

export function isSyncEnabled(): boolean {
  return !!syncScheduler;
}

export { DependencyGraph } from './core/dependency-graph';
export { withOutboxTransaction } from './with-outbox-transaction';
export { ensureSyncTables } from './core/ensure-sync-tables';
export { getEntitiesBySyncOrder, getEntityDef } from './core/entity-registry';
export type { SyncEntityDefinition } from './core/entity-registry';
