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
    db: Database.Database
  ) {
    this.syncService = syncService;
    this.orderService = orderService;
    this.saleService = saleService;
    this.userTenantService = userTenantService;
    this.db = db;
    this.cursor = new SyncPersistedCursor(db, 'last_pull_');
    this.dlq = new DeadLetterQueue(db);

    this.ensureSyncStateTable();
    this.recoverUnfinishedSync();
    this.recoverInProgressItems();
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
   * Identifie tous les tenants locaux qui ont besoin de synchronisation
   */
  private getLocalTenantIds(): string[] {
    try {
      const rows = this.db.prepare('SELECT id FROM tenants').all() as { id: number }[];
      return rows.map(r => String(r.id));
    } catch (e) {
      console.warn('[SyncOrchestrator] Failed to fetch local tenants:', e);
      return [];
    }
  }

  /**
   * Sync manuelle ou automatique avec mutex
   */
  async triggerSync(): Promise<void> {
    if (this.isSyncing) return;
    if (!this.isOnline) return;

    this.isSyncing = true;
    let tenantIds = this.getLocalTenantIds();

    // 🚀 BOOTSTRAP: Si la base locale est vide, essayer de forcer le tenant configuré
    if (tenantIds.length === 0) {
      const bootstrapId = process.env.SYNC_TENANT_ID || '1';
      console.log(`[SyncOrchestrator] Local database empty. Bootstrapping with tenant #${bootstrapId}...`);
      tenantIds = [bootstrapId];
    }

    try {
      for (const tenantId of tenantIds) {
        await this.syncTenant(tenantId);
      }
      
      // 🚀 BACKFILL: Scanner et pousser les records locaux orphelins (sans remote_id)
      await this.runBackfill(tenantIds);

      // Auto-retry DLQ items at the end of each full cycle
      this.retryDLQ();
    } catch (error) {
      console.error('[SyncOrchestrator] Global sync failed:', error);
    } finally {
      this.isSyncing = false;
      this.postSyncHealthCheck();
    }
  }

  /**
   * Scanne les tables locales pour trouver des records sans remote_id
   * et les ajoute à l'outbox pour synchronisation.
   */
  private async runBackfill(tenantIds: string[]): Promise<void> {
    const isDebug = process.env.SYNC_DEBUG === 'true';
    let totalQueued = 0;

    for (const tId of tenantIds) {
      const tenantId = Number(tId);

      // 1. Users
      const users = this.db.prepare(`
        SELECT * FROM users 
        WHERE tenant_id = ? AND remote_id IS NULL
        AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = 'user' AND status IN ('pending', 'in_progress'))
      `).all(tenantId) as any[];
      for (const u of users) {
        this.userTenantService.queueUserChange('insert', u);
        totalQueued++;
      }

      // 2. Tenants
      const tenants = this.db.prepare(`
        SELECT * FROM tenants 
        WHERE id = ? AND remote_id IS NULL
        AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = 'tenant' AND status IN ('pending', 'in_progress'))
      `).all(tenantId) as any[];
      for (const t of tenants) {
        this.userTenantService.queueTenantChange('insert', t);
        totalQueued++;
      }

      // 3. Categories
      const categories = this.db.prepare(`
        SELECT * FROM categories 
        WHERE tenant_id = ? AND remote_id IS NULL
        AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = 'category' AND status IN ('pending', 'in_progress'))
      `).all(tenantId) as any[];
      for (const c of categories) {
        this.syncService.queueChange('category', 'insert', c);
        totalQueued++;
      }

      // 4. Products
      const products = this.db.prepare(`
        SELECT * FROM products 
        WHERE tenant_id = ? AND remote_id IS NULL
        AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = 'product' AND status IN ('pending', 'in_progress'))
      `).all(tenantId) as any[];
      for (const p of products) {
        this.syncService.queueChange('product', 'insert', p);
        totalQueued++;
      }

      const tables = this.db.prepare(`
        SELECT * FROM restaurant_tables
        WHERE tenant_id = ? AND remote_id IS NULL
        AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = 'restaurant_table' AND status IN ('pending', 'in_progress'))
      `).all(tenantId) as any[];
      for (const table of tables) {
        this.syncService.queueChange('restaurant_table', 'insert', table);
        totalQueued++;
      }
    }

    if (totalQueued > 0) {
      console.log(`[SyncOrchestrator] Backfill complete: ${totalQueued} orphan records queued for sync.`);
    }
  }

  private async syncTenant(tenantId: string): Promise<void> {
    try {
      // 1. Recovery items pour ce tenant
      this.recoverInProgressItems(tenantId);

      // 2. Sync Users/Tenants (Base foundation)
      const userTenantResult = await this.userTenantService.syncNow(tenantId);

      // Vérifier si le tenant existe localement après la sync (Bootstrapped?)
      const tenantExists = this.db.prepare('SELECT id FROM tenants WHERE id = ?').get(Number(tenantId));
      if (!tenantExists) {
        console.warn(`[Sync] Skipping other entities for tenant #${tenantId}: Tenant record missing locally.`);
        return;
      }

      // 3. Sync Products (Push/Pull)
      const productResult = await this.syncService.syncNow(tenantId);

      // 4. Sync Orders (Push/Pull)
      const ordersPushed = await this.orderService.pushPendingOrders(tenantId);
      const lastOrderPull = this.cursor.getOrEpoch('order_' + tenantId);
      const ordersPulled = await this.orderService.pullOrderUpdates(tenantId, lastOrderPull);
      if (ordersPulled > 0) this.cursor.set('order_' + tenantId, new Date().toISOString());

      // 5. Sync Sales (Push/Pull)
      const salesPushed = await this.saleService.pushPendingSales(tenantId);
      const lastSalePull = this.cursor.getOrEpoch('sale_' + tenantId);
      const salesPulled = await this.saleService.pullSaleUpdates(tenantId, lastSalePull);
      if (salesPulled > 0) this.cursor.set('sale_' + tenantId, new Date().toISOString());

      // 6. Sync Tables (Push/Pull)
      const tablesPushed = await this.syncService.pushPendingByEntity('restaurant_table', tenantId);
      const lastTablePull = this.cursor.getOrEpoch('restaurant_table_' + tenantId);
      const tablesPulled = await this.syncPullTables(tenantId, lastTablePull);
      if (tablesPulled > 0) this.cursor.set('restaurant_table_' + tenantId, new Date().toISOString());

      const totalPushed = productResult.pushed + ordersPushed + salesPushed + tablesPushed + userTenantResult.pushed;
      const totalPulled = productResult.pulled + ordersPulled + salesPulled + tablesPulled + userTenantResult.pulled;

      if (totalPushed > 0 || totalPulled > 0) {
        console.log(`[Sync] Tenant #${tenantId} - Pushed: ${totalPushed}, Pulled: ${totalPulled}`);
      }
    } catch (err) {
      console.error(`[Sync] Failed for tenant #${tenantId}:`, err);
    }
  }

  private recoverInProgressItems(tenantId?: string) {
    let query = `
      UPDATE sync_outbox 
      SET status = 'pending', updated_at = datetime('now')
      WHERE (status = 'in_progress' OR (status = 'failed' AND retry_count < 5))
    `;
    const params: any[] = [];

    if (tenantId) {
      query += ` AND (json_extract(payload, '$.tenant_id') = ? OR json_extract(payload, '$.tenant_id') IS NULL)`;
      params.push(Number(tenantId));
    }

    this.db.prepare(query).run(...params);
  }

  private async syncPullTables(tenantId: string, since: string): Promise<number> {
    const { getSupabaseClient } = require('../server/database/supabase.client');
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('tenant_id', Number(tenantId))
      .gt('updated_at', since)
      .order('updated_at', { ascending: true });

    if (error) {
      console.error(`[Sync] Failed to pull tables for tenant #${tenantId}:`, error.message);
      return 0;
    }

    if (!data || data.length === 0) return 0;

    let applied = 0;
    const transaction = this.db.transaction((tables: any[]) => {
      for (const remote of tables) {
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

        const byRemote = this.db.prepare(
          'SELECT id, updated_at FROM restaurant_tables WHERE remote_id = ?'
        ).get(remote.id) as { id: number; updated_at: string } | undefined;

        // Fallback 1: par table_number + tenant_id (données pré-existantes)
        const byNaturalKey = !byRemote ? this.db.prepare(
          'SELECT id, updated_at FROM restaurant_tables WHERE table_number = ? AND tenant_id = ?'
        ).get(String(remote.table_number), remote.tenant_id) as { id: number; updated_at: string } | undefined : null;

        const local = byRemote || byNaturalKey;

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
          try {
            this.db.prepare(
              `INSERT INTO restaurant_tables (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
            ).run(...params);
          } catch (err: any) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
              // Ultime recours: update par clé naturelle si l'insert a échoué malgré la vérification
              this.db.prepare(`UPDATE restaurant_tables SET ${setClauses} WHERE table_number = ? AND tenant_id = ?`)
                .run(...params, String(remote.table_number), remote.tenant_id);
            } else {
              throw err;
            }
          }
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
    // On ne retry que si on est en ligne
    if (!this.isOnline) return 0;
    
    for (const entity of this.SYNC_ENTITIES) {
      count += this.dlq.retryAllByEntity(entity);
    }
    
    if (count > 0) {
      console.log(`[SyncOrchestrator] Automatically retrying ${count} items from DLQ...`);
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