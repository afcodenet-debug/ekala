// src/sync/sync-orchestrator.ts
// Production-grade orchestration layer for the Product & Order Sync Engine
// Handles scheduling, mutex, offline detection, crash recovery, and lastSync persistence

import { ProductSyncService } from './product-sync.service';
import { OrderSyncService } from './order-sync.service';
import { UserTenantSyncService } from './user-tenant-sync.service';
import type Database from 'better-sqlite3';

export class SyncOrchestrator {
  private syncService: ProductSyncService;
  private orderService: OrderSyncService;
  private userTenantService: UserTenantSyncService;
  private db: Database.Database;
  private businessId: string;
  private isSyncing = false;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private isOnline = true;

  constructor(
    syncService: ProductSyncService,
    orderService: OrderSyncService,
    userTenantService: UserTenantSyncService,
    db: Database.Database,
    businessId: string
  ) {
    this.syncService = syncService;
    this.orderService = orderService;
    this.userTenantService = userTenantService;
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

    // Ensure categories has remote_id and updated_at for bidirectional sync
    try {
      const catCols = this.db.prepare("PRAGMA table_info(categories)").all() as any[];
      const catColNames = catCols.map(c => c.name);
      if (!catColNames.includes('remote_id')) {
        this.db.exec(`ALTER TABLE categories ADD COLUMN remote_id INTEGER`);
      }
      if (!catColNames.includes('updated_at')) {
        this.db.exec(`ALTER TABLE categories ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
      }
      this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_remote_id ON categories(remote_id) WHERE remote_id IS NOT NULL`);
    } catch (e) {
      console.warn('[SyncOrchestrator] Failed to ensure categories schema:', e);
    }
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
  private readonly SYNC_ENTITIES = ['product', 'category', 'order', 'order_item', 'restaurant_table', 'user', 'tenant', 'tenant_user'] as const;

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
      // Periodic recovery of stuck/failed items
      this.recoverInProgressItems();

      // 1. Sync Products (Push + Pull)
      const productResult = await this.syncService.syncNow(this.businessId);
      
      // 2. Sync Orders (Push + Pull)
      const ordersPushed = await this.orderService.pushPendingOrders(this.businessId);
      const lastOrderPull = this.getLastPullTimestamp('order') || '1970-01-01T00:00:00Z';
      const ordersPulled = await this.orderService.pullOrderUpdates(this.businessId, lastOrderPull);

      if (ordersPulled > 0) {
        this.setLastPullTimestamp('order', new Date().toISOString());
      }

      // 3. Sync Tables (Push + Pull)
      const tablesPushed = await this.syncService.pushPendingByEntity('restaurant_table', this.businessId);
      const lastTablePull = this.getLastPullTimestamp('restaurant_table') || '1970-01-01T00:00:00Z';
      const tablesPulled = await this.syncPullTables(lastTablePull);

      if (tablesPulled > 0) {
        this.setLastPullTimestamp('restaurant_table', new Date().toISOString());
      }

      // 4. Sync Users/Tenants (Push + Pull)
      const userTenantResult = await this.userTenantService.syncNow(this.businessId);

      const totalPushed = productResult.pushed + ordersPushed + tablesPushed + userTenantResult.pushed;
      const totalPulled = productResult.pulled + ordersPulled + tablesPulled + userTenantResult.pulled;

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
   * Internal pull for tables (bidirectional sync: Supabase -> local SQLite)
   *
   * Robust against:
   *  - Local row with no remote_id yet (newly created in local app)
   *  - Local row that has the same id as a Supabase row (race condition)
   *  - table_number conflict between local-only row and remote row
   *  - Stale cursor (always picks up everything modified after `since`)
   */
  private async syncPullTables(since: string): Promise<number> {
    const { getSupabaseClient } = require('../server/database/supabase.client');
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('*')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true });

    if (error) {
      console.error('[Sync] Failed to pull tables from Supabase:', error.message);
      return 0;
    }

    if (!data || data.length === 0) return 0;

    let applied = 0;
    const transaction = this.db.transaction((tables: any[]) => {
      for (const remote of tables) {
        // Business filter (manual if column wasn't in SQL query)
        if (remote.business_id && remote.business_id !== this.businessId) continue;

        // Status mapping: remote 'occupied' -> local 'active'
        let mappedStatus = remote.status;
        if (mappedStatus === 'occupied') mappedStatus = 'active';

        const fields: Record<string, any> = {
          remote_id: remote.id,
          business_id: remote.business_id,
          updated_at: remote.updated_at,
          created_at: remote.created_at,
          table_number: String(remote.table_number),
          capacity: remote.capacity,
          status: mappedStatus,
          assigned_waiter_id: remote.assigned_waiter_id,
          qr_token: remote.qr_token,
        };

        // 1) Find by remote_id (the canonical Supabase key)
        const byRemote = this.db.prepare(
          'SELECT id, updated_at, table_number FROM restaurant_tables WHERE remote_id = ?'
        ).get(remote.id) as { id: number; updated_at: string; table_number: string } | undefined;

        // 2) Find by local id (covers case where insert was done locally and used
        //    the same id as the Supabase row, or where remote_id was never set)
        const byLocalId = this.db.prepare(
          'SELECT id, updated_at, table_number FROM restaurant_tables WHERE id = ?'
        ).get(remote.id) as { id: number; updated_at: string; table_number: string } | undefined;

        // 3) Find by table_number (covers case where local row exists for the same
        //    table number but with a DIFFERENT id and no remote_id yet)
        const byNumber = this.db.prepare(
          'SELECT id, updated_at, table_number, remote_id FROM restaurant_tables WHERE table_number = ?'
        ).get(String(remote.table_number)) as { id: number; updated_at: string; table_number: string; remote_id: number | null } | undefined;

        // Pick the best match: prefer remote_id, then local id, then table_number
        const local = byRemote || byLocalId || byNumber;

        const remoteUpdatedAt = new Date(remote.updated_at);
        const localUpdatedAt = local?.updated_at ? new Date(local.updated_at) : null;
        const shouldApply = !local || !localUpdatedAt || remoteUpdatedAt > localUpdatedAt;

        if (!shouldApply) continue;

        const cols = Object.keys(fields);
        const setClauses = cols.map(k => `"${k}" = ?`).join(', ');
        const params = cols.map(k => fields[k]);

        if (local) {
          // Update existing local row, even if its id differs from the remote id.
          // This is safe because we matched on (remote_id OR id OR table_number).
          this.db.prepare(`UPDATE restaurant_tables SET ${setClauses} WHERE id = ?`).run(...params, local.id);
        } else {
          // Brand new row from Supabase — let SQLite auto-assign a new id
          this.db.prepare(
            `INSERT INTO restaurant_tables (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
          ).run(...params);
        }
        applied++;
      }
    });

    transaction(data);
    return applied;
  }

  /**
   * Force a full pull (useful after long offline period)
   */
  async forceFullResync(): Promise<void> {
    this.setLastPullTimestamp('product', null);
    this.setLastPullTimestamp('order', null);
    this.setLastPullTimestamp('user', null);
    this.setLastPullTimestamp('tenant', null);
    this.setLastPullTimestamp('tenant_user', null);
    this.syncService.resetPullCursor();
    this.userTenantService.resetPullCursor();
    await this.triggerSync();
  }
}
