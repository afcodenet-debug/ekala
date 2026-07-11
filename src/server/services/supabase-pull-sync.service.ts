/**
 * Supabase → SQLite Pull Sync Worker (Multi-tenant dynamic)
 * Synchronise les orders, order_items ET restaurant_tables depuis Supabase
 * vers la SQLite locale pour le mode LOCAL (Electron).
 * 
 * V2 : Ajout du pull des restaurant_tables pour la synchronisation bidirectionnelle
 * des tables de restaurant (créées/modifiées dans le cloud → visibles en local).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db/database';
import { dataSource } from '../infrastructure/data-source-manager';
import { createNotification } from './notification.repository';

let pullInterval: NodeJS.Timeout | null = null;
let isPulling = false;
let hasDoneBootstrap = false;

interface PullStatus {
  workerRunning: boolean;
  enabled: boolean;
  pullIntervalMs: number;
  lastPullAt: string | null;
  lastSuccessfulPullAt: string | null;
  lastCursor: string | null;
  ordersPulled: number;
  ordersInserted: number;
  ordersUpdated: number;
  itemsPulled: number;
  tablesPulled: number;
  tablesInserted: number;
  tablesUpdated: number;
  lastError: string | null;
  errors: string[];
}

let lastPullStatus: PullStatus = {
  workerRunning: false,
  enabled: false,
  pullIntervalMs: 8000,
  lastPullAt: null,
  lastSuccessfulPullAt: null,
  lastCursor: null,
  ordersPulled: 0,
  ordersInserted: 0,
  ordersUpdated: 0,
  itemsPulled: 0,
  tablesPulled: 0,
  tablesInserted: 0,
  tablesUpdated: 0,
  lastError: null,
  errors: [],
};

interface PullConfig {
  enabled: boolean;
  intervalMs: number;
  lookbackMinutes: number;
}

const BOOTSTRAP_LOOKBACK_MINUTES = 60;

function getPullConfig(): PullConfig {
  const explicit = process.env.ENABLE_SUPABASE_PULL;
  const dbAvailable = !!db;

  let enabled =
    explicit === 'true' ||
    explicit === '1';

  // In CLOUD mode (RENDER_CLOUD_MODE) there is no local SQLite, so the
  // Supabase → SQLite pull is meaningless and would crash on `db.prepare`.
  if (dataSource.isCloud()) enabled = false;
  if (!dbAvailable) enabled = false;

  // NOTE: LOCAL mode is now ALLOWED for pull when explicitly configured.
  // Previously disabled because the GenericSync was supposed to handle pulls,
  // but GenericSync scheduler only runs when sync engine is fully initialized
  // (requires Supabase credentials + ENABLE_SUPABASE_SYNC). When running in
  // LOCAL mode without full sync engine, the PullSyncWorker is the ONLY way
  // to get cloud data into the local SQLite.
  // The old line `if (dataSource.isLocal()) enabled = false;` was REMOVED to
  // enable bidirectional sync: local→cloud via outbox, cloud→local via this worker.
  
  return {
    enabled,
    intervalMs: parseInt(process.env.SUPABASE_PULL_INTERVAL_MS || '8000', 10),
    lookbackMinutes: parseInt(process.env.SUPABASE_PULL_LOOKBACK_MIN || '60', 10),
  };
}

function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('[PullSync] Credentials missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

function ensureRemoteSyncSchema() {
  if (!db) return;
  try {
    // Orders
    const orderCols = db.prepare("PRAGMA table_info(orders)").all() as any[];
    const orderNames = orderCols.map(c => c.name);
    if (!orderNames.includes('remote_id')) db.exec(`ALTER TABLE orders ADD COLUMN remote_id INTEGER`);
    if (!orderNames.includes('source')) db.exec(`ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'local'`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_remote_id ON orders(remote_id) WHERE remote_id IS NOT NULL`);

    // Restaurant tables
    const tableCols = db.prepare("PRAGMA table_info(restaurant_tables)").all() as any[];
    const tableNames = tableCols.map(c => c.name);
    if (!tableNames.includes('remote_id')) db.exec(`ALTER TABLE restaurant_tables ADD COLUMN remote_id INTEGER`);
    if (!tableNames.includes('updated_at')) db.exec(`ALTER TABLE restaurant_tables ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_tables_remote_id ON restaurant_tables(remote_id) WHERE remote_id IS NOT NULL`);
  } catch {}
}

export async function runSupabasePullOnce(): Promise<void> {
  const config = getPullConfig();
  if (!config.enabled || isPulling) return;

  if (!db) {
    lastPullStatus.lastError = '[PullSync] db is not available (SQLite disabled). Worker skipped.';
    isPulling = false;
    return;
  }

  isPulling = true;
  lastPullStatus.lastPullAt = new Date().toISOString();

  try {
    ensureRemoteSyncSchema();
    const supabase = getSupabaseClient();
    
    // Multi-tenant discovery
    const tenants = db.prepare('SELECT id FROM tenants').all() as { id: number }[];
    const tenantIds = tenants.map(t => t.id);

    const storedCursor = (db.prepare(`SELECT value FROM sync_metadata WHERE key = 'last_supabase_pull'`).get() as any)?.value;

    let effectiveSince: string;
    if (!hasDoneBootstrap) {
      effectiveSince = new Date(Date.now() - BOOTSTRAP_LOOKBACK_MINUTES * 60 * 1000).toISOString();
      console.log(`[PullSync] BOOTSTRAP lookback enabled (${BOOTSTRAP_LOOKBACK_MINUTES}m)`);
      hasDoneBootstrap = true;
    } else {
      effectiveSince = storedCursor || new Date(Date.now() - config.lookbackMinutes * 60 * 1000).toISOString();
    }

    for (const tId of tenantIds) {
      await pullRestaurantTables(supabase, effectiveSince, tId);
      await pullOrders(supabase, effectiveSince, tId);
      await pullOrderItems(supabase, effectiveSince, tId);
    }

    const row = db.prepare(`SELECT MAX(updated_at) as max_ts FROM orders WHERE remote_id IS NOT NULL`).get() as any;
    const nextCursor = row?.max_ts || new Date().toISOString();
    db.prepare(`INSERT INTO sync_metadata (key, value) VALUES ('last_supabase_pull', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(nextCursor);

    lastPullStatus.lastCursor = nextCursor;
    lastPullStatus.lastSuccessfulPullAt = new Date().toISOString();
  } catch (err: any) {
    console.error('[PullSync] Cycle failed:', err.message);
    lastPullStatus.lastError = err.message;
  } finally {
    isPulling = false;
    lastPullStatus.workerRunning = true;
  }
}

/**
 * Pull les restaurant_tables depuis Supabase vers la SQLite locale.
 * Résout les assigned_waiter_id (FK vers users) via remote_id.
 * Statut mapping : 'occupied'/'available'/'cleaning'/'reserved' (Supabase)
 *              →  'active'/'out_of_service'/'cleaning'/'reserved' (local)
 */
async function pullRestaurantTables(supabase: SupabaseClient, since: string, tenantId: number) {
  const { data: tables, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`updated_at.gte.${since},created_at.gte.${since}`)
    .order('updated_at', { ascending: true });

  if (error) {
    console.warn(`[PullSync] Failed to pull restaurant_tables for tenant #${tenantId}:`, error.message);
    return;
  }
  if (!tables || tables.length === 0) return;

  for (const t of tables as any[]) {
    const existing = db.prepare('SELECT id, status FROM restaurant_tables WHERE remote_id = ?').get(t.id) as any;

    // Resolve assigned_waiter_id (remote_id → local id)
    let localWaiterId: number | null = null;
    if (t.assigned_waiter_id) {
      const waiter = db.prepare('SELECT id FROM users WHERE remote_id = ?').get(t.assigned_waiter_id) as any;
      if (waiter) {
        localWaiterId = waiter.id;
      } else {
        // Fallback: try by direct id
        const waiterById = db.prepare('SELECT id FROM users WHERE id = ?').get(t.assigned_waiter_id) as any;
        if (waiterById) localWaiterId = waiterById.id;
      }
    }

    // Status mapping: Supabase → local
    // Supabase uses: 'occupied', 'available', 'cleaning', 'reserved'
    // Local uses:    'active', 'out_of_service', 'cleaning', 'reserved'
    const statusMap: Record<string, string> = {
      'occupied': 'active',
      'available': 'out_of_service',
      'cleaning': 'cleaning',
      'reserved': 'reserved',
    };
    const localStatus = statusMap[t.status] || t.status || 'active';

    if (existing) {
      // UPDATE existing table
      db.prepare(`
        UPDATE restaurant_tables 
        SET table_number=?, capacity=?, status=?, assigned_waiter_id=?, qr_token=?, updated_at=?
        WHERE id=?
      `).run(
        String(t.table_number),
        t.capacity ?? 0,
        localStatus,
        localWaiterId,
        t.qr_token ?? null,
        t.updated_at || new Date().toISOString(),
        existing.id
      );
      lastPullStatus.tablesUpdated++;
      console.log(`[PullSync] UPDATED table #${existing.id} (remote=${t.id}) num=${t.table_number} status=${localStatus}`);
    } else {
      // INSERT new table
      const result = db.prepare(`
        INSERT INTO restaurant_tables 
          (remote_id, table_number, capacity, status, assigned_waiter_id, qr_token, created_at, updated_at, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        t.id,
        String(t.table_number),
        t.capacity ?? 0,
        localStatus,
        localWaiterId,
        t.qr_token ?? null,
        t.created_at || new Date().toISOString(),
        t.updated_at || new Date().toISOString(),
        tenantId
      );
      lastPullStatus.tablesInserted++;
      console.log(`[PullSync] INSERTED table remote=${t.id} (local=${result.lastInsertRowid}) num=${t.table_number} status=${localStatus}`);
    }
    lastPullStatus.tablesPulled++;
  }
}

async function pullOrders(supabase: SupabaseClient, since: string, tenantId: number) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('tenant_id', tenantId)
    .or(`updated_at.gte.${since},created_at.gte.${since}`)
    .order('updated_at', { ascending: true });

  if (error) throw error;
  if (!orders) return;

  for (const o of orders as any[]) {
    const existing = db.prepare('SELECT id FROM orders WHERE remote_id = ?').get(o.id) as any;
    
    // Resolve remote IDs to local IDs
    let localTable = db.prepare('SELECT id FROM restaurant_tables WHERE remote_id = ?').get(o.table_id) as any;
    if (!localTable && o.table_id) {
      localTable = db.prepare('SELECT id FROM restaurant_tables WHERE id = ?').get(o.table_id) as any;
    }
    if (!localTable && o.table?.table_number) {
      localTable = db.prepare('SELECT id FROM restaurant_tables WHERE table_number = ?').get(o.table.table_number) as any;
    }
    
    let localWaiter = db.prepare('SELECT id FROM users WHERE remote_id = ?').get(o.waiter_id) as any;
    if (!localWaiter && o.waiter_id) {
      localWaiter = db.prepare('SELECT id FROM users WHERE id = ?').get(o.waiter_id) as any;
    }
    
    const tableId = localTable ? localTable.id : o.table_id;
    const waiterId = localWaiter ? localWaiter.id : o.waiter_id;

    // Transform items JSON to use local product IDs if possible
    let transformedItems = o.items || [];
    if (Array.isArray(transformedItems)) {
      transformedItems = transformedItems.map((it: any) => {
        const pid = it.product_id || it.productId;
        const localProd = db.prepare('SELECT id FROM products WHERE remote_id = ?').get(pid) as any;
        return {
          ...it,
          product_id: localProd ? localProd.id : pid,
          productId: localProd ? localProd.id : pid
        };
      });
    }

    // ─── Standardisation de la source ─────────────────────────────────────
    const rawSource = (o.source || '').toLowerCase();
    let normalizedSource: string;
    if (rawSource === 'qr') {
      normalizedSource = 'QR';
    } else if (rawSource === 'pos' || rawSource === 'lp') {
      normalizedSource = 'LP';
    } else {
      normalizedSource = 'CP';
    }

    if (existing) {
      const remoteStatus = o.status;

      db.prepare(`UPDATE orders SET status=?, total=?, items=?, source=?, table_id=?, waiter_id=?, updated_at=? WHERE id=?`)
        .run(remoteStatus, o.total, JSON.stringify(transformedItems), normalizedSource, tableId, waiterId, o.updated_at, existing.id);
      
      console.log(`[PullSync] UPDATED order #${existing.id} (remote=${o.id}) status=${remoteStatus} source=${normalizedSource} table=${tableId}`);
    } else {
      db.prepare(`INSERT INTO orders (remote_id, source, table_id, waiter_id, status, total, items, created_at, updated_at, tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(o.id, normalizedSource, tableId, waiterId, o.status, o.total, JSON.stringify(transformedItems), o.created_at, o.updated_at, tenantId);
      
      console.log(`[PullSync] INSERTED order #${o.id} status=${o.status} source=${normalizedSource} table=${tableId}`);

      if (o.status === 'pending' && normalizedSource === 'QR') {
        console.log(`[PullSync] 📣 NEW QR ORDER #${o.id} for Tenant #${tenantId}`);
        try {
          createNotification({
            type: 'newQrOrder',
            title: 'Nouvelle commande QR',
            message: `Tenant #${tenantId} - Nouvelle commande en attente`,
            priority: 'high',
            notification_type: 'NEW_QR_ORDER',
            link: '/orders',
            metadata: { remote_id: o.id, tenant_id: tenantId },
          });
        } catch {}
      }
    }
    lastPullStatus.ordersPulled++;
  }
}

async function pullOrderItems(supabase: SupabaseClient, since: string, tenantId: number) {
  const { data: items, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', since);
  
  if (error || !items) return;

  for (const it of items as any[]) {
    const parent = db.prepare('SELECT id FROM orders WHERE remote_id = ?').get(it.order_id) as any;
    if (!parent) continue;

    const existing = db.prepare('SELECT id FROM order_items WHERE remote_id = ?').get(it.id) as any;
    if (!existing) {
      const localProd = db.prepare('SELECT id FROM products WHERE remote_id = ?').get(it.product_id) as any;
      const productId = localProd ? localProd.id : it.product_id;

      db.prepare(`INSERT INTO order_items (remote_id, order_id, product_id, quantity, unit_price, total_price, notes, created_at, tenant_id) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(it.id, parent.id, productId, it.quantity, it.unit_price, it.total_price, it.notes, it.created_at, tenantId);
      lastPullStatus.itemsPulled++;
    }
  }
}

export function startSupabasePullWorker(): void {
  const config = getPullConfig();
  if (!config.enabled || !db) return;

  setTimeout(() => runSupabasePullOnce().catch(console.error), 5000);
  if (pullInterval) clearInterval(pullInterval);
  pullInterval = setInterval(() => runSupabasePullOnce().catch(console.error), config.intervalMs);
  lastPullStatus.workerRunning = true;
}

export function stopSupabasePullWorker(): void {
  if (pullInterval) clearInterval(pullInterval);
  lastPullStatus.workerRunning = false;
}

export function getPullSyncStatus(): PullStatus {
  return { ...lastPullStatus };
}