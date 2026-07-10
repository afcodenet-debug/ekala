// src/sync/index.ts
// Point d'entrée du module Sync Engine V2
// Exporte tous les services de synchronisation

import { ProductSyncService } from './product-sync.service';
import { OrderSyncService } from './order-sync.service';
import { SaleSyncService } from './sale-sync.service';
import { UserTenantSyncService } from './user-tenant-sync.service';
// import { SyncOrchestrator } from './sync-orchestrator';
import { SyncOrchestratorV2 } from './sync-orchestrator-v2';
// import { GenericSyncService } from './core/generic-sync.service';
import { ensureSyncTables } from './core/ensure-sync-tables';
// import { getEntitiesBySyncOrder, getEntityDef, type SyncEntityDefinition } from './core/entity-registry';
import type Database from 'better-sqlite3';

let productSyncService: ProductSyncService | null = null;
let orderSyncService: OrderSyncService | null = null;
let saleSyncService: SaleSyncService | null = null;
let userTenantSyncService: UserTenantSyncService | null = null;
let orchestratorV2: SyncOrchestratorV2 | null = null;
let database: Database.Database | null = null;
// When false (local mode without ENABLE_SUPABASE_SYNC), the sync services are
// only used to queue writes into the local outbox — they must NEVER push to
// Supabase. This keeps local-first writes working without side effects.
let syncEnabled = false;

export function initializeProductSync(
  db: Database.Database,
  supabaseUrl: string,
  supabaseAnonKey: string
): ProductSyncService {
  database = db; // Always store DB reference for fallback
  if (!productSyncService) {
    try {
      ensureSyncTables(db);
    } catch (err: any) {
      console.warn('[Sync] ensureSyncTables partial failure:', err?.message);
      // Continue anyway - ProductSyncService can still queue to outbox
    }
    productSyncService = new ProductSyncService(db, supabaseUrl, supabaseAnonKey);
    console.log('[Sync] ProductSyncService initialized');
  }
  return productSyncService;
}

/**
 * Bind the live server database instance to the sync module without starting
 * the full sync engine. Required so that getProductSyncService()/getOrderSyncService()
 * can lazily initialize (and queue writes to the outbox) even in LOCAL mode where
 * initializeSyncV2() is intentionally skipped (ENABLE_SUPABASE_SYNC !== 'true').
 */
export function setSyncDatabase(dbInstance: Database.Database | null): void {
  if (dbInstance) {
    database = dbInstance;
  }
}

/**
 * Mark the sync engine as enabled (full cloud sync). Called by initializeSyncV2.
 * When NOT enabled (local mode), sync services only queue writes locally and must
 * never push to Supabase.
 */
export function setSyncEnabled(enabled: boolean): void {
  syncEnabled = enabled;
}

export function isSyncEnabled(): boolean {
  return syncEnabled;
}

export function getProductSyncService(): ProductSyncService | null {
  if (!productSyncService) {
    // Auto-initialize with minimal fallback if not yet initialized.
    // The sync engine (initializeSyncV2) is intentionally skipped in LOCAL mode
    // (ENABLE_SUPABASE_SYNC !== 'true'), but routes still call getProductSyncService()
    // to queue local writes to the outbox. Without this fallback every local
    // order/sale/product write would throw "ProductSyncService not initialized".
    // So we always allow a lazy init here to keep writes working offline.
    if (!database) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const serverDb = require('../server/db/database').db;
        if (serverDb) {
          database = serverDb;
          console.log('[Sync] ProductSyncService bound to server database (lazy)');
        }
      } catch {
        // database stays null — will be reported below
      }
    }

    if (database) {
      // Only auto-initialize when sync is actually available. In LOCAL mode
      // (ENABLE_SUPABASE_SYNC !== 'true' and no real Supabase credentials) we must
      // NOT instantiate a client with empty credentials (createClient throws
      // "supabaseUrl is required"). Sync queuing is then skipped — local writes
      // still succeed (callers already guard sync calls in try/catch).
      const realSupabaseUrl = process.env.SUPABASE_URL || '';
      const canSync = syncEnabled || realSupabaseUrl.length > 0;
      if (!canSync) {
        console.warn('[Sync] ProductSyncService NOT initialized (local mode, sync disabled). Writes will skip outbox queuing.');
        return null;
      }
      console.warn('[Sync] ProductSyncService auto-initializing (fallback)');
      try {
        ensureSyncTables(database);
        const supabaseUrl = syncEnabled ? realSupabaseUrl : realSupabaseUrl;
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

export function getOrderSyncService(): OrderSyncService | null {
  if (!orderSyncService) {
    const core = getProductSyncService();
    if (!core || !database) {
      // Sync not available (e.g. local mode without Supabase). Return null so
      // callers that queue writes can skip outbox queuing without breaking the
      // local transaction.
      return null;
    }
    orderSyncService = new OrderSyncService(core, database);
  }
  return orderSyncService;
}

export function getSaleSyncService(): SaleSyncService | null {
  if (!saleSyncService) {
    const core = getProductSyncService();
    if (!core || !database) {
      return null;
    }
    saleSyncService = new SaleSyncService(core, database);
  }
  return saleSyncService;
}

export function initializeUserTenantSync(
  db: Database.Database,
  supabaseUrl: string,
  supabaseAnonKey: string
): UserTenantSyncService {
  if (!userTenantSyncService) {
    try {
      ensureSyncTables(db);
    } catch (err: any) {
      console.warn('[Sync] ensureSyncTables partial failure in UserTenantSync:', err?.message);
    }
    userTenantSyncService = new UserTenantSyncService(db, supabaseUrl, supabaseAnonKey);
    console.log('[Sync] UserTenantSyncService initialized');
  }
  return userTenantSyncService;
}

export function getUserTenantSyncService(): UserTenantSyncService | null {
  return userTenantSyncService;
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

  // Services legacy (utilisés en complément)
  const pSync = initializeProductSync(db, supabaseUrl, supabaseAnonKey);
  const oSync = getOrderSyncService();
  const sSync = getSaleSyncService();
  const uSync = initializeUserTenantSync(db, supabaseUrl, supabaseAnonKey);

  // Orchestrator V2 (toutes les tables)
  orchestratorV2 = new SyncOrchestratorV2(
    db, supabaseUrl, supabaseAnonKey,
    pSync, oSync!, sSync!, uSync
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

// Export des entités et services
export { SyncOrchestrator } from './sync-orchestrator';
export { SyncOrchestratorV2 } from './sync-orchestrator-v2';
export { GenericSyncService } from './core/generic-sync.service';
export { withOutboxTransaction } from './with-outbox-transaction';
export { UserTenantSyncService } from './user-tenant-sync.service';
export { ensureSyncTables } from './core/ensure-sync-tables';
export { getEntitiesBySyncOrder, getEntityDef } from './core/entity-registry';
export type { SyncEntityDefinition } from './core/entity-registry';