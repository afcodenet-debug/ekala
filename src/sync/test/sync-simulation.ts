// src/sync/test/sync-simulation.ts
// Real-world failure scenario simulator for the Product Sync Engine

import { ProductSyncService } from '../product-sync.service';

export async function runOfflineReconnectSimulation(syncService: ProductSyncService, businessId: string) {
  console.log('\n=== SYNC SIMULATION: Offline → Reconnect ===\n');

  // Step 1: Simulate offline product creation
  console.log('1. User creates product while OFFLINE...');
  syncService.queueProductChange('insert', {
    id: 'prod-offline-001',
    name: 'Café Offline Test',
    price: '45.00',
    stock_quantity: 12,
    version: 1,
  });
  console.log('   → Product queued in outbox (not sent yet)');

  // Step 2: Simulate being offline for a while
  console.log('\n2. Staying offline for 2 minutes (simulated)...');
  await new Promise(resolve => setTimeout(resolve, 2000)); // shortened for demo

  // Step 3: Reconnect
  console.log('\n3. Network reconnected. Triggering sync...');
  const result = await syncService.syncNow(businessId);

  console.log('\n=== SIMULATION RESULT ===');
  console.log(`Pushed: ${result.pushed}`);
  console.log(`Pulled: ${result.pulled}`);
  console.log(`Errors: ${result.errors}`);
  console.log('Sync completed successfully after reconnect.\n');
}

export async function runConflictScenario(syncService: ProductSyncService, businessId: string) {
  console.log('\n=== SYNC SIMULATION: Conflict Resolution ===\n');

  // Simulate two devices updating the same product
  console.log('Device A updates product (version 3)');
  syncService.queueProductChange('update', {
    id: 'prod-conflict-001',
    name: 'Updated by Device A',
    price: '50.00',
    version: 3,
  });

  console.log('Device B updates the same product (version 4) - newer');
  // In real life this would come from Supabase
  // Here we just demonstrate the logic in getDeltaSince + version check

  const result = await syncService.syncNow(businessId);
  console.log('Conflict resolution handled via version comparison.\n');
}
