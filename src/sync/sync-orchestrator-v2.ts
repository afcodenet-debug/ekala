/**
 * src/sync/sync-orchestrator-v2.ts
 * Orchestrateur V2 de synchronisation bidirectionnelle.
 * Utilise le GenericSyncService et le registre d'entités pour synchroniser
 * TOUTES les tables de manière uniforme et professionnelle.
 * 
 * Résout:
 * - Faille #1: Conflict resolution via ConflictResolver
 * - Faille #2: Curseurs persistants via SyncPersistedCursor
 * - Faille #3: Atomicité orders + order_items via outbox transaction
 * - Faille #4: ID mapping fiable (remote_id)
 * - Faille #5: Pas de sync sur toutes les tables
 * - Faille #6: tenant_id obligatoire
 * - Faille #7: Dead-letter queue
 * - Faille #8: Pas de backfill automatique
 * - Faille #9: Pas de vérification d'intégrité après sync
 * - Faille #10: Pas de diff intelligent pour les items
 */
import type Database from 'better-sqlite3';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SyncPersistedCursor } from './core/sync-persisted-cursor';
import { ConflictResolver } from './core/conflict-resolver';
import { DeadLetterQueue } from './core/dead-letter-queue';
import { GenericSyncService, type SyncResult } from './core/generic-sync.service';
import { ensureSyncTables } from './core/ensure-sync-tables';
import { getEntitiesBySyncOrder, type SyncEntityDefinition } from './core/entity-registry';
import { ProductSyncService } from './product-sync.service';
import { OrderSyncService } from './order-sync.service';
import { SaleSyncService } from './sale-sync.service';
import { UserTenantSyncService } from './user-tenant-sync.service';

export class SyncOrchestratorV2 {
  private db: Database.Database;
  private supabase: SupabaseClient;
  private genericSync: GenericSyncService;
  private cursor: SyncPersistedCursor;
  private dlq: DeadLetterQueue;
  private conflictResolver: ConflictResolver;

  // Legacy services (keep for backward compat)
  private productSync: ProductSyncService;
  private orderSync: OrderSyncService;
  private saleSync: SaleSyncService;
  private userTenantSync: UserTenantSyncService;

  private isSyncing = false;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private isOnline = true;

  constructor(
    db: Database.Database,
    supabaseUrl: string,
    supabaseAnonKey: string,
    productSync: ProductSyncService,
    orderSync: OrderSyncService,
    saleSync: SaleSyncService,
    userTenantSync: UserTenantSyncService
  ) {
    // ⭐ CRITICAL FIX: Guard against null database (Render cloud mode)
    if (!db) {
      throw new Error('[SyncOrchestratorV2] Cannot initialize with null database. Use cloud mode (Supabase-only) instead.');
    }

    this.db = db;
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Core components
    this.cursor = new SyncPersistedCursor(db, 'last_pull_');
    this.conflictResolver = new ConflictResolver(db);
    this.dlq = new DeadLetterQueue(db);

    // Generic sync engine
    this.genericSync = new GenericSyncService(
      db, this.supabase, this.cursor, this.conflictResolver, this.dlq
    );

    // Legacy services
    this.productSync = productSync;
    this.orderSync = orderSync;
    this.saleSync = saleSync;
    this.userTenantSync = userTenantSync;

    // Initialisation (résiliente - continue même si le schéma a des problèmes)
    try {
      ensureSyncTables(db);
      console.log('[SyncOrchestratorV2] Sync tables initialized successfully');
    } catch (err: any) {
      console.warn('[SyncOrchestratorV2] ensureSyncTables encountered issues (non-critical):', err?.message);
      console.warn('[SyncOrchestratorV2] Sync will attempt to work with existing schema');
      // Don't throw - allow sync to attempt working with whatever schema exists
      // The individual sync operations have their own error handling
    }
    this.recoverInProgressItems();
  }

  /* ==================================================================
   *  GESTION RÉSEAU
   * ================================================================== */

  setNetworkStatus(isOnline: boolean) {
    const wasOffline = !this.isOnline;
    this.isOnline = isOnline;
    if (isOnline && wasOffline) this.triggerSync();
    else if (!isOnline) this.stopScheduler();
  }

  /* ==================================================================
   *  SCHEDULER
   * ================================================================== */

  startScheduler(intervalMs = 30000) {
    if (this.schedulerInterval) return;
    this.schedulerInterval = setInterval(() => {
      if (this.isOnline) this.triggerSync();
    }, intervalMs);
    console.log(`[SyncV2] Scheduler started (${intervalMs / 1000}s)`);
  }

  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /* ==================================================================
   *  TRIGGER PRINCIPAL
   * ================================================================== */

  async triggerSync(): Promise<void> {
    if (this.isSyncing || !this.isOnline) return;
    this.isSyncing = true;

    try {
      const tenantIds = this.getLocalTenantIds();
      if (tenantIds.length === 0) {
        const bootstrapId = process.env.SYNC_TENANT_ID || '1';
        console.log(`[SyncV2] Bootstrapping with tenant #${bootstrapId}`);
        await this.syncTenant(bootstrapId);
      } else {
        for (const tId of tenantIds) {
          await this.syncTenant(tId);
        }
      }

      // DLQ retry automatique
      this.retryDLQ();

      // Post-sync health check
      this.postSyncHealthCheck();

    } catch (err) {
      console.error('[SyncV2] Global sync failed:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  /* ==================================================================
   *  SYNC D'UN TENANT
   * ================================================================== */

  private async syncTenant(tenantId: string): Promise<void> {
    const startTime = Date.now();
    console.log(`[SyncV2] Starting sync for tenant #${tenantId}`);

    let totalPushed = 0, totalPulled = 0, totalErrors = 0;

    try {
      // Phase 1: Skip legacy sync - GenericSync in Phase 3 handles all entities (tenant, user, tenant_user)
      // with proper foreign key resolution and ordering.

      // Vérifier si le tenant existe localement
      const tenant = this.db.prepare('SELECT id FROM tenants WHERE id = ?').get(Number(tenantId));
      if (!tenant) {
        console.warn(`[SyncV2] Tenant #${tenantId} not found, skipping data sync`);
        return;
      }

      // Phase 2: Backfill - queue les orphelins locaux (résilient)
      try {
        const backfilled = this.genericSync.backfillOrphans(tenantId);
        if (backfilled > 0) console.log(`[SyncV2] Backfilled ${backfilled} orphan records`);
      } catch (backfillErr: any) {
        console.warn('[SyncV2] Backfill partial failure:', backfillErr?.message);
      }

      // Phase 2b: Sync des suppressions orphelines pour les produits
      try {
        const orphanDeletes = this.genericSync.syncOrphanDeletes(tenantId);
        if (orphanDeletes > 0) console.log(`[SyncV2] Queued ${orphanDeletes} orphan deletes for products`);
      } catch (orphanErr: any) {
        console.warn('[SyncV2] Orphan delete sync partial failure:', orphanErr?.message);
      }

      // Phase 2c: Correction des mouvements d'inventaire avec product_id NULL
      try {
        const fixedMovements = await this.genericSync.fixInventoryMovementsProductIds(tenantId);
        if (fixedMovements > 0) console.log(`[SyncV2] Fixed ${fixedMovements} inventory movements with product_id`);
      } catch (fixErr: any) {
        console.warn('[SyncV2] Inventory movement product_id fix partial failure:', fixErr?.message);
      }

      // Phase 3: Generic sync pour TOUTES les entités (dans l'ordre)
      const result = await this.genericSync.fullSyncForTenant(tenantId);
      totalPushed += result.pushed;
      totalPulled += result.pulled;
      totalErrors += result.errors;

      // Phase 4: Legacy Order sync (PUSH ONLY - pas de pull)
      const ordersPushed = await this.orderSync.pushPendingOrders(tenantId);
      totalPushed += ordersPushed;

      // Phase 5: Legacy Sale sync (PUSH ONLY - pas de pull)
      const salesPushed = await this.saleSync.pushPendingSales(tenantId);
      totalPushed += salesPushed;

      // Phase 6: Vérification d'intégrité post-sync
      const fixed = await this.ensureIntegrity(tenantId);
      if (fixed > 0) console.log(`[SyncV2] Fixed ${fixed} integrity issues`);

      const duration = Date.now() - startTime;
      if (totalPushed > 0 || totalPulled > 0 || totalErrors > 0) {
        console.log(`[SyncV2] Tenant #${tenantId} - Pushed: ${totalPushed}, Pulled: ${totalPulled}, Errors: ${totalErrors} (${duration}ms)`);
      }

    } catch (err) {
      console.error(`[SyncV2] Sync failed for tenant #${tenantId}:`, err);
    }
  }

  /* ==================================================================
   *  VÉRIFICATION D'INTÉGRITÉ POST-SYNC
   * ================================================================== */

  private async ensureIntegrity(tenantId: string): Promise<number> {
    let fixed = 0;

    try {
      // Vérifier que les users ont des tenant_users
      const usersWithoutTU = this.db.prepare(`
        SELECT u.id FROM users u
        WHERE u.tenant_id = ?
        AND NOT EXISTS (SELECT 1 FROM tenant_users tu WHERE tu.tenant_id = u.tenant_id AND tu.user_id = u.id)
      `).all(Number(tenantId)) as { id: number }[];

      for (const user of usersWithoutTU) {
        this.db.prepare(`
          INSERT INTO tenant_users (tenant_id, user_id, role, is_default, is_active, joined_at)
          VALUES (?, ?, 'staff', false, true, datetime('now'))
        `).run(Number(tenantId), user.id);
        fixed++;
      }

      // Vérifier les remote_ids manquants après pull
      const entities = getEntitiesBySyncOrder();
      for (const def of entities) {
        if (def.entity === 'tenant' || def.entity === 'setting') continue;
        try {
          const emptyRemoteIds = this.db.prepare(`
            SELECT COUNT(*) as count FROM ${def.localTable}
            WHERE tenant_id = ? AND remote_id IS NULL
          `).get(Number(tenantId)) as { count: number };

          if (emptyRemoteIds.count > 0) {
            // Backfill automatique
            const orphans = this.db.prepare(`
              SELECT * FROM ${def.localTable}
              WHERE tenant_id = ? AND remote_id IS NULL
              AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = ? AND status IN ('pending', 'in_progress'))
            `).all(Number(tenantId), def.entity) as any[];

            for (const record of orphans) {
              this.genericSync.queueChange(def.entity, 'insert', record);
              fixed++;
            }
          }
        } catch { /* ignore if table doesn't exist */ }
      }

    } catch (err: any) {
      console.warn(`[SyncV2] Integrity check failed:`, err?.message || err);
    }

    return fixed;
  }

  /* ==================================================================
   *  BACKFILL COMPLET
   * ================================================================== */

  async forceFullBackfill(): Promise<number> {
    const tenantIds = this.getLocalTenantIds();
    let total = 0;
    for (const tId of tenantIds) {
      total += this.genericSync.backfillOrphans(tId);
    }
    return total;
  }

  /* ==================================================================
   *  FORCE FULL RESYNC
   * ================================================================== */
  async forceFullResync(): Promise<void> {
    this.cursor.reset();
    await this.triggerSync();
  }

  /* ==================================================================
   *  DLQ
   * ================================================================== */
  retryDLQ(): number {
    if (!this.isOnline) return 0;
    const entities = getEntitiesBySyncOrder();
    let count = 0;
    for (const def of entities) {
      count += this.dlq.retryAllByEntity(def.entity);
    }
    return count;
  }

  /* ==================================================================
   *  HEALTH CHECK
   * ================================================================== */
  private postSyncHealthCheck() {
    const dlqCount = this.dlq.getCount();
    if (dlqCount > 0) {
      console.warn(`[SyncV2] ${dlqCount} items in DLQ. Run retryDLQ()`);
    }
  }

  /* ==================================================================
   *  HELPERS
   * ================================================================== */
  private recoverInProgressItems() {
    this.db.prepare(`
      UPDATE sync_outbox
      SET status = 'pending', updated_at = datetime('now')
      WHERE status = 'in_progress' OR (status = 'failed' AND retry_count < 5)
    `).run();
  }

  private getLocalTenantIds(): string[] {
    try {
      return (this.db.prepare('SELECT id FROM tenants').all() as { id: number }[]).map(r => String(r.id));
    } catch {
      return [];
    }
  }

  /** Expose le GenericSyncService pour usage externe */
  getGenericSync(): GenericSyncService {
    return this.genericSync;
  }
}