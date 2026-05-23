// src/sync/production-sync-setup.ts
// Production-ready setup for the sync orchestration layer
// This file is meant to be imported from src/main/main.js

import { app } from 'electron';
import { initializeProductSync, getProductSyncService } from './index';
import { SyncOrchestrator } from './sync-orchestrator';
import Database from 'better-sqlite3';
import path from 'path';

let orchestrator: SyncOrchestrator | null = null;

interface SyncSetupOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  businessId?: string;
  syncIntervalMs?: number;
}

export function initializeProductionSync(options: SyncSetupOptions) {
  const {
    supabaseUrl,
    supabaseAnonKey,
    businessId = 'default-business',
    syncIntervalMs = 30000,
  } = options;

  const dbPath = path.join(app.getPath('userData'), 'great-olive.db');
  const db = new Database(dbPath);

  // 1. Initialize the core sync service
  const syncService = initializeProductSync(db, supabaseUrl, supabaseAnonKey);

  // 2. Create the production orchestrator
  orchestrator = new SyncOrchestrator(syncService, db, businessId);

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

export function getSyncOrchestrator(): SyncOrchestrator {
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
