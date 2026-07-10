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
  private lastConnectivityCheck = 0;
  private connectivityCheckInterval = 60000; // Check connectivity every 60s
  private consecutiveFailures = 0;
  private maxConsecutiveFailures = 3;

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
    if (isOnline && wasOffline) {
      console.log('[SyncV2] 🌐 Connection restored — triggering sync');
      this.triggerSync();
    } else if (!isOnline) {
      console.log('[SyncV2] 📡 Connection lost — sync paused');
    }
  }

  /**
   * Lightweight probe: true if Supabase is currently reachable.
   * Used by the server to avoid running a sync cycle while offline.
   */
  async isSupabaseReachable(): Promise<boolean> {
    return this.checkSupabaseConnectivity();
  }

  /**
   * Triggers a full sync cycle only if Supabase is reachable.
   * Perfect for the LOCAL mode "sync when online" requirement: a boot-time or
   * manually-triggered sync is silently skipped when there is no connectivity.
   */
  async triggerSyncIfOnline(): Promise<void> {
    const reachable = await this.isSupabaseReachable();
    if (!reachable) {
      console.log('[SyncV2] Sync skipped — Supabase not reachable (offline)');
      return;
    }
    return this.triggerSync();
  }

  /* ==================================================================
   *  SCHEDULER
   * ================================================================== */

  startScheduler(intervalMs = 30000) {
    if (this.schedulerInterval) return;
    this.schedulerInterval = setInterval(() => {
      this.handleSchedulerTick();
    }, intervalMs);
    console.log(`[SyncV2] Scheduler started (${intervalMs / 1000}s)`);
  }

  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Handles periodic scheduler tick with connectivity check
   */
  private async handleSchedulerTick() {
    if (!this.isOnline) {
      console.log('[SyncV2] ⏸️  Offline — skipping sync');
      return;
    }

    // Check connectivity periodically
    const now = Date.now();
    if (now - this.lastConnectivityCheck > this.connectivityCheckInterval) {
      const isReachable = await this.checkSupabaseConnectivity();
      this.lastConnectivityCheck = now;

      if (!isReachable) {
        this.consecutiveFailures++;
        console.warn(`[SyncV2] ⚠️  Supabase unreachable (${this.consecutiveFailures}/${this.maxConsecutiveFailures})`);
        
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
          console.error('[SyncV2] ❌ Max failures reached — pausing sync temporarily');
          this.isOnline = false;
          // Retry after 5 minutes
          setTimeout(() => {
            console.log('[SyncV2] 🔄 Retrying connectivity...');
            this.isOnline = true;
            this.consecutiveFailures = 0;
          }, 5 * 60 * 1000);
        }
        return;
      }

      // Reset failure counter on success
      if (this.consecutiveFailures > 0) {
        console.log('[SyncV2] ✅ Connectivity restored');
        this.consecutiveFailures = 0;
      }
    }

    // Proceed with sync
    await this.triggerSync();
  }

  /**
   * Checks if Supabase is reachable with a lightweight query
   */
  private async checkSupabaseConnectivity(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('tenants')
        .select('id')
        .limit(1);

      // If we get a response (even empty), Supabase is reachable
      return !error || error.code !== 'PGRST301'; // PGRST301 = network error
    } catch (err) {
      return false;
    }
  }

  /* ==================================================================
   *  TRIGGER PRINCIPAL
   * ================================================================== */

  async triggerSync(): Promise<void> {
    if (this.isSyncing || !this.isOnline) return;
    this.isSyncing = true;

    const startTime = Date.now();

    try {
      // Phase 0: Discover ALL remote tenants first (bidirectional discovery)
      console.log(`[SyncV2] =========================================`);
      console.log(`[SyncV2] Starting global sync - Phase 0: Remote tenant discovery`);
      console.log(`[SyncV2] =========================================`);
      
      const allTenantIds = await this.discoverAllRemoteTenants();
      
      console.log(`[SyncV2] ✓ Found ${allTenantIds.length} total tenants (local + remote)`);
      
      if (allTenantIds.length === 0) {
        const bootstrapId = process.env.SYNC_TENANT_ID || '1';
        console.log(`[SyncV2] No tenants found, bootstrapping with tenant #${bootstrapId}`);
        allTenantIds.push(bootstrapId);
      }

      // Phase 1: Sync each tenant
      console.log(`[SyncV2] Starting global sync - Phase 1: Tenant synchronization`);
      for (const tId of allTenantIds) {
        await this.syncTenant(tId);
      }

      // DLQ retry automatique
      this.retryDLQ();

      // Post-sync health check
      this.postSyncHealthCheck();

    } catch (err) {
      console.error('[SyncV2] Global sync failed:', err);
    } finally {
      this.isSyncing = false;
      const duration = Date.now() - startTime;
      console.log(`[SyncV2] Sync cycle completed in ${duration}ms`);
    }
  }

  /* ==================================================================
   *  SYNC D'UN TENANT
   * ================================================================== */

  private async syncTenant(tenantId: string): Promise<void> {
    const startTime = Date.now();
    console.log(`[SyncV2] =========================================`);
    console.log(`[SyncV2] Starting sync for tenant #${tenantId}`);
    console.log(`[SyncV2] =========================================`);

    let totalPushed = 0, totalPulled = 0, totalErrors = 0;

    try {
      // Phase 1: Skip legacy sync - GenericSync in Phase 3 handles all entities (tenant, user, tenant_user)
      // with proper foreign key resolution and ordering.

      // Vérifier si le tenant existe localement
      const tenant = this.db.prepare('SELECT id FROM tenants WHERE id = ?').get(Number(tenantId));
      if (!tenant) {
        console.warn(`[SyncV2] Tenant #${tenantId} not found locally, skipping data sync`);
        return;
      }
      
      console.log(`[SyncV2] ✓ Local tenant #${tenantId} found`);

      // Phase 2d: Discover remote tenants not yet in local DB (bidirectional sync)
      try {
        const discovered = await this.discoverRemoteTenants(tenantId);
        if (discovered > 0) console.log(`[SyncV2] ✓ Discovered ${discovered} remote tenants`);
        else console.log(`[SyncV2] No new remote tenants discovered`);
      } catch (discoveryErr: any) {
        console.warn('[SyncV2] ⚠ Remote tenant discovery partial failure:', discoveryErr?.message);
      }

      // Phase 2: Backfill - queue les orphelins locaux (résilient)
      try {
        const backfilled = this.genericSync.backfillOrphans(tenantId);
        if (backfilled > 0) console.log(`[SyncV2] Backfilled ${backfilled} orphan records`);
        this.genericSync.diagnoseSyncOutbox(tenantId);
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
      console.log(`[SyncV2] Starting generic sync for all entities...`);
      const result = await this.genericSync.fullSyncForTenant(tenantId);
      totalPushed += result.pushed;
      totalPulled += result.pulled;
      totalErrors += result.errors;
      console.log(`[SyncV2] ✓ Generic sync completed - Pushed: ${result.pushed}, Pulled: ${result.pulled}, Errors: ${result.errors}`);

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
      console.log(`[SyncV2] ✓ Tenant #${tenantId} sync completed - Pushed: ${totalPushed}, Pulled: ${totalPulled}, Errors: ${totalErrors} (${duration}ms)`);
      console.log(`[SyncV2] =========================================`);
    } catch (err) {
      console.error(`[SyncV2] ✗ Sync failed for tenant #${tenantId}:`, err);
      console.log(`[SyncV2] =========================================`);
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
        SELECT u.id, u.role FROM users u
        WHERE u.tenant_id = ?
        AND NOT EXISTS (SELECT 1 FROM tenant_users tu WHERE tu.tenant_id = u.tenant_id AND tu.user_id = u.id)
      `).all(Number(tenantId)) as { id: number; role?: string }[];

      for (const user of usersWithoutTU) {
        const VALID_ROLES = ['owner', 'admin', 'manager', 'cashier', 'waiter', 'staff'];
        const role = (user.role && VALID_ROLES.includes(user.role)) ? user.role : 'staff';
        this.db.prepare(`
          INSERT INTO tenant_users (tenant_id, user_id, role, is_default, is_active, joined_at)
          VALUES (?, ?, ?, 0, 1, datetime('now'))
        `).run(Number(tenantId), user.id, role);
        fixed++;
      }

      // Vérifier les remote_ids manquants après pull
      const entities = getEntitiesBySyncOrder();
      for (const def of entities) {
        if (def.entity === 'setting') continue;
        try {
          const whereClause = def.entity === 'tenant'
            ? 'remote_id IS NULL AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = ? AND status IN (\'pending\', \'in_progress\'))'
            : 'tenant_id = ? AND remote_id IS NULL AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = ? AND status IN (\'pending\', \'in_progress\'))';
          const params = def.entity === 'tenant' ? [def.entity] : [Number(tenantId), def.entity];

          const emptyRemoteIds = this.db.prepare(`
            SELECT COUNT(*) as count FROM ${def.localTable} WHERE ${whereClause}
          `).all(...(params as any[])) as { count: number }[];

          if (emptyRemoteIds[0]?.count > 0) {
            const orphans = this.db.prepare(`
              SELECT * FROM ${def.localTable} WHERE ${whereClause}
            `).all(...(params as any[])) as any[];

            for (const record of orphans) {
              const recordToQueue = def.entity === 'tenant' ? { ...record, tenant_id: record.id } : record;
              this.genericSync.queueChange(def.entity, 'insert', recordToQueue);
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

  /**
   * Discover ALL remote tenants from Supabase and ensure they exist locally
   * This is called at the start of global sync to find tenants like #16 that exist
   * only in Supabase
   */
  private async discoverAllRemoteTenants(): Promise<string[]> {
    const allTenantIds = new Set<string>();
    
    try {
      // Get local tenants first
      const localTenants = this.getLocalTenantIds();
      localTenants.forEach(id => allTenantIds.add(id));
      console.log(`[SyncV2] Found ${localTenants.length} local tenants`);

      // Discover remote tenants from Supabase
      const since = this.cursor.getOrEpoch('tenant');
      const { data: remoteTenants, error } = await this.supabase
        .from('tenants')
        .select('id, slug, name, owner_email, updated_at, created_at')
        .order('updated_at', { ascending: true });

      if (error) {
        console.warn('[SyncV2] Failed to discover remote tenants:', error.message);
        return Array.from(allTenantIds);
      }

      console.log(`[SyncV2] Found ${remoteTenants?.length || 0} remote tenants in Supabase`);

      for (const remote of (remoteTenants || [])) {
        const remoteId = String(remote.id);
        allTenantIds.add(remoteId);

        // Check if this remote tenant already exists locally
        let existing = this.db.prepare('SELECT id FROM tenants WHERE id = ?').get(remote.id);
        if (!existing && remote.slug) {
          existing = this.db.prepare('SELECT id FROM tenants WHERE slug = ?').get(remote.slug);
        }
        if (!existing && remote.owner_email) {
          existing = this.db.prepare('SELECT id FROM tenants WHERE owner_email = ?').get(remote.owner_email);
        }

        if (!existing) {
          // Insert the missing tenant locally with remote_id
          const cols = ['id', 'remote_id', 'slug', 'name', 'owner_email', 'updated_at', 'created_at'];
          const vals = [remote.id, remote.id, remote.slug, remote.name, remote.owner_email, remote.updated_at, remote.created_at];
          const placeholders = cols.map(() => '?').join(', ');

          this.db.prepare(`
            INSERT INTO tenants (${cols.map(c => `"${c}"`).join(', ')})
            VALUES (${placeholders})
          `).run(...vals);

          console.log(`[SyncV2] ✓ Discovered and created remote tenant #${remote.id} (${remote.name}) locally`);
        } else {
          console.log(`[SyncV2] ✓ Remote tenant #${remote.id} (${remote.name}) already exists locally`);
        }
      }

      // Update cursor
      if (remoteTenants && remoteTenants.length > 0) {
        const lastTs = remoteTenants[remoteTenants.length - 1].updated_at;
        if (lastTs) {
          this.cursor.set('tenant', lastTs instanceof Date ? lastTs.toISOString() : String(lastTs));
        }
      }

      return Array.from(allTenantIds);
    } catch (err: any) {
      console.warn('[SyncV2] Remote tenant discovery error:', err?.message || err);
      return Array.from(allTenantIds);
    }
  }

  private async discoverRemoteTenants(forLocalTenantId: string): Promise<number> {
    try {
      // Pull all tenants changed since cursor to discover any new remote tenants
      const since = this.cursor.getOrEpoch('tenant');
      const { data: remoteTenants, error } = await this.supabase
        .from('tenants')
        .select('id, slug, name, owner_email, updated_at, created_at')
        .gt('updated_at', since)
        .order('updated_at', { ascending: true });

      if (error) {
        console.warn('[SyncV2] Failed to discover remote tenants:', error.message);
        return 0;
      }

      let discovered = 0;

      for (const remote of (remoteTenants || [])) {
        // Check if this remote tenant already exists locally
        let existing = this.db.prepare('SELECT id FROM tenants WHERE id = ?').get(remote.id);
        if (!existing && remote.slug) {
          existing = this.db.prepare('SELECT id FROM tenants WHERE slug = ?').get(remote.slug);
        }
        if (!existing && remote.owner_email) {
          existing = this.db.prepare('SELECT id FROM tenants WHERE owner_email = ?').get(remote.owner_email);
        }

        if (!existing) {
          // Insert the missing tenant locally with remote_id
          const cols = ['id', 'remote_id', 'slug', 'name', 'owner_email', 'updated_at', 'created_at'];
          const vals = [remote.id, remote.id, remote.slug, remote.name, remote.owner_email, remote.updated_at, remote.created_at];
          const placeholders = cols.map(() => '?').join(', ');

          this.db.prepare(`
            INSERT INTO tenants (${cols.map(c => `"${c}"`).join(', ')})
            VALUES (${placeholders})
          `).run(...vals);

          console.log(`[SyncV2] Discovered remote tenant #${remote.id} (${remote.name}) created locally`);
          discovered++;
        }
      }

      // Update cursor
      if (remoteTenants && remoteTenants.length > 0) {
        const lastTs = remoteTenants[remoteTenants.length - 1].updated_at;
        if (lastTs) {
          this.cursor.set('tenant', lastTs instanceof Date ? lastTs.toISOString() : String(lastTs));
        }
      }

      return discovered;
    } catch (err: any) {
      console.warn('[SyncV2] Remote tenant discovery error:', err?.message || err);
      return 0;
    }
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