// src/sync/index.ts
// Point d'entrée du module Sync Engine

import { ProductSyncService } from './product-sync.service';
import Database from 'better-sqlite3';

let productSyncService: ProductSyncService | null = null;

export function initializeProductSync(
  db: Database.Database, 
  supabaseUrl: string, 
  supabaseAnonKey: string
): ProductSyncService {
  if (!productSyncService) {
    productSyncService = new ProductSyncService(db, supabaseUrl, supabaseAnonKey);
    console.log('[Sync] ProductSyncService initialized');
  }
  return productSyncService;
}

export function getProductSyncService(): ProductSyncService {
  if (!productSyncService) {
    throw new Error('ProductSyncService not initialized. Call initializeProductSync first.');
  }
  return productSyncService;
}

// Helper pour lancer la sync périodiquement (à appeler depuis le main process)
export function startPeriodicSync(businessId: string, intervalMs = 30000) {
  const service = getProductSyncService();
  
  setInterval(async () => {
    try {
      const result = await service.syncNow(businessId);
      if (result.pushed > 0 || result.pulled > 0) {
        console.log(`[Sync] Cycle completed - Pushed: ${result.pushed}, Pulled: ${result.pulled}`);
      }
    } catch (err) {
      console.error('[Sync] Periodic sync failed:', err);
    }
  }, intervalMs);

  console.log(`[Sync] Periodic sync started every ${intervalMs / 1000}s`);
}

export { SyncOrchestrator } from './sync-orchestrator';
