// src/sync/sync-orchestrator.ts
// Production-grade orchestration layer for the Product & Order Sync Engine
// Handles scheduling, mutex, offline detection, crash recovery, and lastSync persistence

import { ProductSyncService } from './product-sync.service';
import { OrderSyncService } from './order-sync.service';
import type Database from 'better-sqlite3';

export class SyncOrchestrator {
  private syncService: ProductSyncService;
  private orderService: OrderSyncService;
  private db: Database.Database;
  private businessId: string;
  private isSyncing = false;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private isOnline = true;

  constructor(
    syncService: ProductSyncService,
    orderService: OrderSyncService,
    db: Database.Database,
    businessId: string
  ) {
    this.syncService = syncService;
    this.orderService = orderService;
    this.db = db;
    this.businessId = businessId;

    this.ensureSyncStateTable();
    this.recoverUnfinishedSync();
    this.recoverInProgressItems(); // NEW: Crash recovery
  }

  private ensureSyncStateTable() {
    // Simple key-value table for sync state (avoids heavy schema changes)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  }

  private getLastPullTimestamp(entity: string): string | null {
    const key = `last_pull_timestamp_${entity}`;
    const row = this.db.prepare("SELECT value FROM sync_state WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value || null;
  }

  private setLastPullTimestamp(entity: string, timestamp: string | null) {
    const key = `last_pull_timestamp_${entity}`;
    if (timestamp === null) {
      this.db.prepare(`DELETE FROM sync_state WHERE key = ?`).run(key);
      return;
    }
    this.db.prepare(`
      INSERT OR REPLACE INTO sync_state (key, value) 
      VALUES (?, ?)
    `).run(key, timestamp);
  }

  /**
   * Crash recovery: resume any unfinished outbox items
   */
  private readonly SYNC_ENTITIES = ['product', 'order', 'order_item'] as const;

  private recoverUnfinishedSync() {
    for (const entity of this.SYNC_ENTITIES) {
      const pending = this.db.prepare(`
        SELECT COUNT(*) as count FROM sync_outbox 
        WHERE entity = ? AND status IN ('pending', 'in_progress')
      `).get(entity) as { count: number };

      if (pending.count > 0) {
        console.log(`[SyncOrchestrator] Crash recovery: ${pending.count} pending ${entity} sync items found`);
      }
    }
  }

  /**
   * Récupère les items bloqués en 'in_progress' ou 'failed' après un crash/redémarrage
   * et les remet en 'pending' pour qu'ils soient retentés (toutes entités supportées).
   */
  private recoverInProgressItems() {
    for (const entity of this.SYNC_ENTITIES) {
      const updated = this.db.prepare(`
        UPDATE sync_outbox 
        SET status = 'pending', 
            updated_at = datetime('now')
        WHERE entity = ? 
          AND (status = 'in_progress' OR (status = 'failed' AND retry_count < 5))
      `).run(entity);

      if (updated.changes > 0) {
        console.log(`[SyncOrchestrator] Recovered ${updated.changes} stuck/failed ${entity} sync items to 'pending'`);
      }
    }
  }

  /**
   * Called by the app when network status changes
   */
  setNetworkStatus(isOnline: boolean) {
    const wasOffline = !this.isOnline;
    this.isOnline = isOnline;

    if (isOnline && wasOffline) {
      console.log('[SyncOrchestrator] Network back online - triggering sync');
      this.triggerSync();
    } else if (!isOnline) {
      console.log('[SyncOrchestrator] Network offline - pausing sync');
      this.stopScheduler();
    }
  }

  /**
   * Start the periodic sync scheduler (every X seconds)
   */
  startScheduler(intervalMs = 30000) {
    if (this.schedulerInterval) return;

    this.schedulerInterval = setInterval(() => {
      if (this.isOnline) {
        this.triggerSync();
      }
    }, intervalMs);

    console.log(`[SyncOrchestrator] Periodic sync scheduler started (${intervalMs / 1000}s)`);
  }

  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Manual or automatic trigger with mutex protection
   */
  async triggerSync(): Promise<void> {
    if (this.isSyncing) {
      console.log('[SyncOrchestrator] Sync already running, skipping');
      return;
    }

    if (!this.isOnline) {
      console.log('[SyncOrchestrator] Offline - sync skipped');
      return;
    }

    this.isSyncing = true;

    try {
      // 1. Sync Products (Push + Pull)
      const productResult = await this.syncService.syncNow(this.businessId);
      
      // 2. Sync Orders (Push + Pull)
      const ordersPushed = await this.orderService.pushPendingOrders(this.businessId);
      const lastOrderPull = this.getLastPullTimestamp('order') || '1970-01-01T00:00:00Z';
      const ordersPulled = await this.orderService.pullOrderUpdates(this.businessId, lastOrderPull);

      if (ordersPulled > 0) {
        this.setLastPullTimestamp('order', new Date().toISOString());
      }

      const totalPushed = productResult.pushed + ordersPushed;
      const totalPulled = productResult.pulled + ordersPulled;

      if (totalPushed > 0 || totalPulled > 0) {
        console.log(`[SyncOrchestrator] Sync completed - Pushed: ${totalPushed}, Pulled: ${totalPulled}`);
      }

    } catch (error) {
      console.error('[SyncOrchestrator] Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Force a full pull (useful after long offline period)
   */
  async forceFullResync(): Promise<void> {
    this.setLastPullTimestamp('product', null);
    this.setLastPullTimestamp('order', null);
    this.syncService.resetPullCursor();
    await this.triggerSync();
  }
}
