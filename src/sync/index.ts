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

export function getProductSyncService(): ProductSyncService {
  if (!productSyncService) {
    // Auto-initialize with minimal fallback if not yet initialized
    // This ensures routes can always queue changes even if V2 sync failed
    if (database) {
      console.warn('[Sync] ProductSyncService auto-initializing (fallback)');
      try {
        ensureSyncTables(database);
        productSyncService = new ProductSyncService(database, process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
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

export function getOrderSyncService(): OrderSyncService {
  if (!orderSyncService) {
    const core = getProductSyncService();
    if (!database) {
      throw new Error('Database not initialized for sync. Call initializeProductSync first.');
    }
    orderSyncService = new OrderSyncService(core, database);
  }
  return orderSyncService;
}

export function getSaleSyncService(): SaleSyncService {
  if (!saleSyncService) {
    const core = getProductSyncService();
    if (!database) {
      throw new Error('Database not initialized for sync. Call initializeProductSync first.');
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

  // Services legacy (utilisés en complément)
  const pSync = initializeProductSync(db, supabaseUrl, supabaseAnonKey);
  const oSync = getOrderSyncService();
  const sSync = getSaleSyncService();
  const uSync = initializeUserTenantSync(db, supabaseUrl, supabaseAnonKey);

  // Orchestrator V2 (toutes les tables)
  orchestratorV2 = new SyncOrchestratorV2(
    db, supabaseUrl, supabaseAnonKey,
    pSync, oSync, sSync, uSync
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