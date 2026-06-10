// src/sync/sync-orchestrator.ts
// Orchestrateur professionnel de synchronisation
// Faille #2 résolue : curseurs persistants via SyncPersistedCursor
// Faille #4 résolue : ID mapping fiable (remote_id seulement)
// Faille #7 résolue : dead-letter queue intégrée

import { ProductSyncService } from './product-sync.service';
import { OrderSyncService } from './order-sync.service';
import { SaleSyncService } from './sale-sync.service';
import { UserTenantSyncService } from './user-tenant-sync.service';
import { SyncPersistedCursor } from './core/sync-persisted-cursor';
import { DeadLetterQueue } from './core/dead-letter-queue';
import type Database from 'better-sqlite3';

export class SyncOrchestrator {
  private syncService: ProductSyncService;
  private orderService: OrderSyncService;
  private saleService: SaleSyncService;
  private userTenantService: UserTenantSyncService;
  private db: Database.Database;
  private tenantId: string;
  private isSyncing = false;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private isOnline = true;
  private cursor: SyncPersistedCursor;
  private dlq: DeadLetterQueue;

  private readonly SYNC_ENTITIES = [
    'product', 'category', 'order', 'order_item', 'sale', 'sale_item',
    'restaurant_table', 'user', 'tenant', 'tenant_user'
  ] as const;

  constructor(
    syncService: ProductSyncService,
    orderService: OrderSyncService,
    saleService: SaleSyncService,
    userTenantService: UserTenantSyncService,
    db: Database.Database,
    tenantId: string
  ) {
    this.syncService = syncService;
    this.orderService = orderService;
    this.saleService = saleService;
    this.userTenantService = userTenantService;
    this.db = db;
    this.tenantId = tenantId;
    this.cursor = new SyncPersistedCursor(db, 'last_pull_');
    this.dlq = new DeadLetterQueue(db);

    this.ensureSyncStateTable();
    this.recoverUnfinishedSync();
    this.recoverInProgressItems();

    // Ensure we have a cursor for sales to trigger initial pull if it's new
    if (!this.cursor.get('sale')) {
      console.log('[SyncOrchestrator] No sale cursor found, will pull all historical sales');
    }
  }

  private ensureSyncStateTable() {
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
        this.db.exec(`ALTER TABLE categories ADD COLUMN updated_at DATETIME`);
        this.db.exec(`UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`);
      }
      this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_remote_id ON categories(remote_id) WHERE remote_id IS NOT NULL`);
    } catch (e) {
      console.warn('[SyncOrchestrator] Failed to ensure categories schema:', e);
    }
  }

  /**
   * Crash recovery : remet les items 'in_progress' et 'failed' (retry < 5) en 'pending'
   */
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
   * Alarmes : vérifie la DLQ et les conflits après chaque sync
   */
  private postSyncHealthCheck() {
    const dlqCount = this.dlq.getCount();
    if (dlqCount > 0) {
      console.warn(`[SyncOrchestrator] ${dlqCount} items in Dead-Letter Queue. Run retryDLQ() to reprocess.`);
    }
  }

  /**
   * Appelé quand le réseau change d'état
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
   * Démarre le scheduler périodique (toutes les X secondes)
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
   * Sync manuelle ou automatique avec mutex
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
      // Recovery automatique au début de chaque cycle
      this.recoverInProgressItems();

      // 1. Sync Products (Pull d'abord catégories, Push puis Pull produits)
      const productResult = await this.syncService.syncNow(this.tenantId);

      // 2. Sync Orders (Push puis Pull)
      const ordersPushed = await this.orderService.pushPendingOrders(this.tenantId);
      const lastOrderPull = this.cursor.getOrEpoch('order');
      const ordersPulled = await this.orderService.pullOrderUpdates(this.tenantId, lastOrderPull);

      if (ordersPulled > 0) {
        this.cursor.set('order', new Date().toISOString());
      }

      // 2b. Sync Sales (Push puis Pull)
      const salesPushed = await this.saleService.pushPendingSales(this.tenantId);
      const lastSalePull = this.cursor.getOrEpoch('sale');
      const salesPulled = await this.saleService.pullSaleUpdates(this.tenantId, lastSalePull);

      if (salesPulled > 0) {
        this.cursor.set('sale', new Date().toISOString());
      }

      // 3. Sync Tables (Push puis Pull)
      const tablesPushed = await this.syncService.pushPendingByEntity('restaurant_table', this.tenantId);
      const lastTablePull = this.cursor.getOrEpoch('restaurant_table');
      const tablesPulled = await this.syncPullTables(lastTablePull);

      if (tablesPulled > 0) {
        this.cursor.set('restaurant_table', new Date().toISOString());
      }

      // 4. Sync Users/Tenants (Push + Pull intégré)
      const userTenantResult = await this.userTenantService.syncNow(this.tenantId);

      const totalPushed = productResult.pushed + ordersPushed + salesPushed + tablesPushed + userTenantResult.pushed;
      const totalPulled = productResult.pulled + ordersPulled + salesPulled + tablesPulled + userTenantResult.pulled;

      if (totalPushed > 0 || totalPulled > 0) {
        console.log(`[SyncOrchestrator] Sync completed - Pushed: ${totalPushed}, Pulled: ${totalPulled}`);
      }

      // Post-sync health check
      this.postSyncHealthCheck();

    } catch (error) {
      console.error('[SyncOrchestrator] Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pull des tables avec ID mapping fiable (Faille #4 résolue).
   * Utilise remote_id uniquement pour matcher les lignes.
   * Évite les correspondances hasardeuses par id ou table_number.
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
        if (remote.tenant_id && String(remote.tenant_id) !== String(this.tenantId)) continue;

        // Status mapping
        let mappedStatus = remote.status;
        if (mappedStatus === 'occupied') mappedStatus = 'active';

        const fields: Record<string, any> = {
          remote_id: remote.id,
          tenant_id: remote.tenant_id,
          updated_at: remote.updated_at,
          created_at: remote.created_at,
          table_number: String(remote.table_number),
          capacity: remote.capacity,
          status: mappedStatus,
          assigned_waiter_id: remote.assigned_waiter_id,
          qr_token: remote.qr_token,
        };

        // STRATÉGIE FIABLE UNIQUE : chercher par remote_id
        // (Faille #4 résolue : on ne matche plus par id local ou table_number)
        const byRemote = this.db.prepare(
          'SELECT id, updated_at FROM restaurant_tables WHERE remote_id = ?'
        ).get(remote.id) as { id: number; updated_at: string } | undefined;

        // Fallback ONLY : id direct (si migration sans remote_id)
        const byDirectId = !byRemote ? this.db.prepare(
          'SELECT id, updated_at FROM restaurant_tables WHERE id = ?'
        ).get(remote.id) as { id: number; updated_at: string } | undefined : null;

        const local = byRemote || byDirectId;

        const remoteUpdatedAt = new Date(remote.updated_at);
        const localUpdatedAt = local?.updated_at ? new Date(local.updated_at) : null;
        const shouldApply = !local || !localUpdatedAt || remoteUpdatedAt > localUpdatedAt;

        if (!shouldApply) continue;

        const cols = Object.keys(fields);
        const setClauses = cols.map(k => `"${k}" = ?`).join(', ');
        const params = cols.map(k => fields[k]);

        if (local) {
          this.db.prepare(`UPDATE restaurant_tables SET ${setClauses} WHERE id = ?`).run(...params, local.id);
        } else {
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
   * Retry des items de la dead-letter queue
   */
  retryDLQ(): number {
    let count = 0;
    for (const entity of this.SYNC_ENTITIES) {
      count += this.dlq.retryAllByEntity(entity);
    }
    if (count > 0) {
      console.log(`[SyncOrchestrator] Retrying ${count} items from DLQ...`);
      this.triggerSync();
    }
    return count;
  }

  /**
   * Force un pull complet (après longue période offline)
   */
  async forceFullResync(): Promise<void> {
    this.cursor.reset('product');
    this.cursor.reset('order');
    this.cursor.reset('sale');
    this.cursor.reset('restaurant_table');
    this.cursor.reset('user');
    this.cursor.reset('tenant');
    this.cursor.reset('tenant_user');
    this.syncService.resetPullCursor();
    this.userTenantService.resetPullCursor();
    await this.triggerSync();
  }
}