// src/sync/production-sync-setup.ts
// Production-ready setup for the sync orchestration layer
// This file is meant to be imported from src/main/main.js

import { app } from 'electron';
import { initializeSyncV2 } from './index';
import { SyncOrchestratorV2 } from './sync-orchestrator-v2';
import Database from 'better-sqlite3';
import path from 'path';

let orchestrator: SyncOrchestratorV2 | null = null;

interface SyncSetupOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  tenantId?: string;
  syncIntervalMs?: number;
}

export function initializeProductionSync(options: SyncSetupOptions) {
  const {
    supabaseUrl,
    supabaseAnonKey,
    tenantId = 'default-tenant',
    syncIntervalMs = 30000,
  } = options;

  // IMPORTANT: Use the same database instance as the Express server layer
  // (data/database.db via src/server/db/database). Using a separate userData file
  // was causing stock/order mutations to never reach the outbox.
  // We import the live db after it has been initialized by the server boot sequence.
  let db: Database.Database;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { db: serverDb } = require('../server/db/database');
    if (serverDb) {
      db = serverDb;
      console.log('[ProductionSync] Reusing server database instance (data/database.db)');
    } else {
      throw new Error('Server db not ready');
    }
  } catch {
    // Fallback (should rarely happen in desktop): create our own connection to the canonical path
    const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
    const fallbackPath = path.join(dataDir, 'database.db');
    db = new Database(fallbackPath);
    db.pragma('journal_mode = WAL');
    console.warn('[ProductionSync] Fallback: opened data/database.db directly for sync');
  }

  // 1. Initialize the V2 sync orchestrator (covers ALL entities via GenericSyncService)
  orchestrator = initializeSyncV2(db, supabaseUrl, supabaseAnonKey, tenantId);

  // 3. Start the scheduler
  orchestrator.startScheduler(syncIntervalMs);

  // 4. Network status handling (Electron main process)
  // Note: In main process, we use 'net' module or listen to 'online'/'offline' events
  // For simplicity, we expose methods the main process can call

  // 5. Auto sync on app ready and focus
  app.on('ready', () => {
    orchestrator?.triggerSync().catch(console.error);
  });

  app.on('browser-window-focus', () => {
    orchestrator?.triggerSync().catch(console.error);
  });

  console.log('[ProductionSync] Production sync orchestration layer initialized');

  return orchestrator;
}

export function getSyncOrchestrator(): SyncOrchestratorV2 {
  if (!orchestrator) {
    throw new Error('Sync orchestrator not initialized. Call initializeProductionSync() first.');
  }
  return orchestrator;
}

// Helper to notify network status from main process
export function notifyNetworkStatus(isOnline: boolean) {
  if (orchestrator) {
    orchestrator.setNetworkStatus(isOnline);
  }
}
