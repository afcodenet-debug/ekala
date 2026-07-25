// src/sync/index.ts
// Point d'entrée du module Sync Engine V2
// Exporte tous les services de synchronisation

import { ProductSyncService } from './product-sync.service';
import { SyncOrchestratorV2 } from './sync-orchestrator-v2';
import { ensureSyncTables } from './core/ensure-sync-tables';
import type Database from 'better-sqlite3';

let productSyncService: ProductSyncService | null = null;
let orchestratorV2: SyncOrchestratorV2 | null = null;
let database: Database.Database | null = null;
let syncEnabled = false;

export function initializeProductSync(
  db: Database.Database,
  supabaseUrl: string,
  supabaseAnonKey: string
): ProductSyncService {
  database = db;
  if (!productSyncService) {
    try {
      ensureSyncTables(db);
    } catch (err: any) {
      console.warn('[Sync] ensureSyncTables partial failure:', err?.message);
    }
    productSyncService = new ProductSyncService(db, supabaseUrl, supabaseAnonKey);
    console.log('[Sync] ProductSyncService initialized');
  }
  return productSyncService;
}

export function setSyncDatabase(dbInstance: Database.Database | null): void {
  if (dbInstance) {
    database = dbInstance;
  }
}

export function setSyncEnabled(enabled: boolean): void {
  syncEnabled = enabled;
}

export function isSyncEnabled(): boolean {
  return syncEnabled;
}

export function getProductSyncService(): ProductSyncService | null {
  if (!productSyncService) {
    if (!database) {
      try {
        const serverDb = require('../server/db/database').db;
        if (serverDb) {
          database = serverDb;
          console.log('[Sync] ProductSyncService bound to server database (lazy)');
        }
      } catch {
        // database stays null
      }
    }

    if (database) {
      const realSupabaseUrl = process.env.SUPABASE_URL || '';
      const canSync = syncEnabled || realSupabaseUrl.length > 0;
      if (!canSync) {
        console.warn('[Sync] ProductSyncService NOT initialized (local mode, sync disabled). Writes will skip outbox queuing.');
        return null;
      }
      console.warn('[Sync] ProductSyncService auto-initializing (fallback)');
      try {
        ensureSyncTables(database);
        const supabaseUrl = realSupabaseUrl;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
        productSyncService = new ProductSyncService(database, supabaseUrl, supabaseKey);
        console.log('[Sync] ProductSyncService auto-initialized (fallback)');
      } catch (err: any) {
        console.error('[Sync] ProductSyncService auto-init failed:', err?.message);
        throw new Error('ProductSyncService not initialized. Call initializeProductSync first.');
      }
    } else {
      throw new Error('ProductSyncService not initialized. Call initializeProductSync first.');
    }
  }
  return productSyncService;
}

/**
 * Initialise le SyncOrchestratorV2 (recommandé)
 * Utilise le GenericSyncService pour couvrir TOUTES les tables
 */
export function initializeSyncV2(
  db: Database.Database,
  supabaseUrl: string,
  supabaseAnonKey: string,
  tenantId?: string
): SyncOrchestratorV2 {
  database = db;
  syncEnabled = true;

  const pSync = initializeProductSync(db, supabaseUrl, supabaseAnonKey);

  orchestratorV2 = new SyncOrchestratorV2(
    db, supabaseUrl, supabaseAnonKey,
    pSync
  );

  console.log('[Sync] SyncOrchestratorV2 initialized (ALL tables covered with GenericSyncService)');
  return orchestratorV2;
}

export function getOrchestratorV2(): SyncOrchestratorV2 {
  if (!orchestratorV2) {
    throw new Error('SyncOrchestratorV2 not initialized. Call initializeSyncV2 first.');
  }
  return orchestratorV2;
}

/**
 * Retourne le GenericSyncService pour synchroniser TOUTES les entités
 * (products, orders, sales, tables, categories, etc.)
 *
 * FIX #3: Unifier le chemin de synchronisation — retourne toujours un service valide.
 * Si le SyncOrchestratorV2 n'est pas initialisé, on fait un fallback sur
 * ProductSyncService (qui couvre products, orders, order_items, etc.).
 */
export function getGenericSyncService(): any {
  if (orchestratorV2) {
    return orchestratorV2.getGenericSync();
  }

  // Fallback: ProductSyncService (legacy, mais couvre les entités critiques)
  try {
    const productSync = getProductSyncService();
    if (productSync) {
      console.warn('[Sync] Using ProductSyncService as fallback for getGenericSyncService()');
      return productSync;
    }
  } catch (err: any) {
    console.warn('[Sync] ProductSyncService fallback failed:', err?.message);
  }

  console.warn('[Sync] GenericSyncService not available - running in local-only mode');
  return null;
}


// Export des entités et services
export { SyncOrchestratorV2 } from './sync-orchestrator-v2';
export { GenericSyncService } from './core/generic-sync.service';
export { withOutboxTransaction } from './with-outbox-transaction';
export { ensureSyncTables } from './core/ensure-sync-tables';
export { getEntitiesBySyncOrder, getEntityDef } from './core/entity-registry';
export type { SyncEntityDefinition } from './core/entity-registry';
