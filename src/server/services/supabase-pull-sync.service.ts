/**
 * Supabase → SQLite Pull Sync Worker (Multi-tenant dynamic)
 * Synchronise les orders, order_items, restaurant_tables, inventory_movements,
 * categories ET products depuis Supabase vers la SQLite locale pour le mode LOCAL.
 * 
 * V3 : Ajout du pull des products (stock_quantity, prix, disponibilité) et des
 * categories pour une synchronisation bidirectionnelle complète du stock.
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
  productsPulled: number;
  productsInserted: number;
  productsUpdated: number;
  categoriesPulled: number;
  categoriesInserted: number;
  categoriesUpdated: number;
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
  productsPulled: 0,
  productsInserted: 0,
  productsUpdated: 0,
  categoriesPulled: 0,
  categoriesInserted: 0,
  categoriesUpdated: 0,
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

  if (dataSource.isCloud()) enabled = false;
  if (!dbAvailable) enabled = false;

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

    // Products
    const prodCols = db.prepare("PRAGMA table_info(products)").all() as any[];
    const prodNames = prodCols.map(c => c.name);
    if (!prodNames.includes('remote_id')) db.exec(`ALTER TABLE products ADD COLUMN remote_id INTEGER`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_products_remote_id ON products(remote_id) WHERE remote_id IS NOT NULL`);

    // Categories
    const catCols = db.prepare("PRAGMA table_info(categories)").all() as any[];
    const catNames = catCols.map(c => c.name);
    if (!catNames.includes('remote_id')) db.exec(`ALTER TABLE categories ADD COLUMN remote_id INTEGER`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_remote_id ON categories(remote_id) WHERE remote_id IS NOT NULL`);
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
    const storedProductCursor = (db.prepare(`SELECT value FROM sync_metadata WHERE key = 'last_supabase_pull_products'`).get() as any)?.value;

    let effectiveSince: string;
    let productSince: string;
    if (!hasDoneBootstrap) {
      effectiveSince = new Date(Date.now() - BOOTSTRAP_LOOKBACK_MINUTES * 60 * 1000).toISOString();
      productSince = effectiveSince;
      console.log(`[PullSync] BOOTSTRAP lookback enabled (${BOOTSTRAP_LOOKBACK_MINUTES}m)`);
      hasDoneBootstrap = true;
    } else {
      effectiveSince = storedCursor || new Date(Date.now() - config.lookbackMinutes * 60 * 1000).toISOString();
      productSince = storedProductCursor || effectiveSince;
    }

    for (const tId of tenantIds) {
      // ⭐ Ordre : catégories (FK) → produits (stock) → tables → mouvements → commandes
      await pullCategories(supabase, productSince, tId);
      await pullProducts(supabase, productSince, tId);
      await pullRestaurantTables(supabase, effectiveSince, tId);
      await pullInventoryMovements(supabase, effectiveSince, tId);
      await pullOrders(supabase, effectiveSince, tId);
      await pullOrderItems(supabase, effectiveSince, tId);
    }

    // Curseur orders avec décalage de sécurité (-1s) pour éviter de manquer
    // des commandes qui auraient le même timestamp que le curseur.
    // Sans ce décalage, une commande créée dans le cloud avec updated_at
    // égal au curseur ne serait jamais tirée.
    const orderRow = db.prepare(`SELECT MAX(updated_at) as max_ts FROM orders WHERE remote_id IS NOT NULL`).get() as any;
    const nextCursor = orderRow?.max_ts 
      ? new Date(new Date(orderRow.max_ts).getTime() - 1000).toISOString()
      : new Date(Date.now() - 60000).toISOString();
    db.prepare(`INSERT INTO sync_metadata (key, value) VALUES ('last_supabase_pull', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(nextCursor);

    // Curseur dédié produits avec le même décalage
    const productRow = db.prepare(`SELECT MAX(updated_at) as max_ts FROM products WHERE remote_id IS NOT NULL`).get() as any;
    const productCursor = productRow?.max_ts
      ? new Date(new Date(productRow.max_ts).getTime() - 1000).toISOString()
      : new Date(Date.now() - 60000).toISOString();
    db.prepare(`INSERT INTO sync_metadata (key, value) VALUES ('last_supabase_pull_products', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(productCursor);

    console.log(`[PullSync] Cycle completed: cursor=${nextCursor.substring(0,19)} productsCursor=${productCursor.substring(0,19)} orders=${lastPullStatus.ordersPulled} products=${lastPullStatus.productsPulled}`);

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
 * Pull les categories depuis Supabase vers SQLite.
 * Exécuté en premier car les produits y font référence (FK category_id).
 */
async function pullCategories(supabase: SupabaseClient, since: string, tenantId: number) {
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`updated_at.gte.${since},created_at.gte.${since}`)
    .order('updated_at', { ascending: true });

  if (error) {
    console.warn(`[PullSync] Failed to pull categories for tenant #${tenantId}:`, error.message);
    return;
  }
  if (!categories || categories.length === 0) return;

  for (const c of categories as any[]) {
    const existing = db.prepare('SELECT id FROM categories WHERE remote_id = ?').get(c.id) as any;

    if (existing) {
      db.prepare(`UPDATE categories SET name=?, description=?, updated_at=? WHERE id=?`)
        .run(c.name, c.description || null, c.updated_at || new Date().toISOString(), existing.id);
      lastPullStatus.categoriesUpdated++;
    } else {
      const result = db.prepare(`
        INSERT INTO categories (remote_id, name, description, created_at, updated_at, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        c.id, c.name, c.description || null,
        c.created_at || new Date().toISOString(),
        c.updated_at || new Date().toISOString(),
        tenantId
      );
      lastPullStatus.categoriesInserted++;
      console.log(`[PullSync] INSERTED category remote=${c.id} (local=${result.lastInsertRowid}) name=${c.name}`);
    }
    lastPullStatus.categoriesPulled++;
  }
}

/**
 * Pull les products depuis Supabase vers SQLite.
 * Met à jour : stock_quantity, selling_price, is_available, name, barcode, etc.
 * Résout category_id (FK) via remote_id.
 * CRITIQUE : synchronise le stock après chaque commande cloud.
 */
async function pullProducts(supabase: SupabaseClient, since: string, tenantId: number) {
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`updated_at.gte.${since},created_at.gte.${since}`)
    .order('updated_at', { ascending: true });

  if (error) {
    console.warn(`[PullSync] Failed to pull products for tenant #${tenantId}:`, error.message);
    return;
  }
  if (!products || products.length === 0) return;

  for (const p of products as any[]) {
    const existing = db.prepare('SELECT id, stock_quantity FROM products WHERE remote_id = ?').get(p.id) as any;

    // Résoudre category_id remote → local
    let localCategoryId: number | null = null;
    if (p.category_id) {
      const cat = db.prepare('SELECT id FROM categories WHERE remote_id = ?').get(p.category_id) as any;
      if (cat) localCategoryId = cat.id;
    }

    // Résoudre created_by / updated_by
    let localCreatedBy: number | null = null;
    if (p.created_by) {
      const user = db.prepare('SELECT id FROM users WHERE remote_id = ?').get(p.created_by) as any;
      if (user) localCreatedBy = user.id;
    }
    let localUpdatedBy: number | null = null;
    if (p.updated_by) {
      const user = db.prepare('SELECT id FROM users WHERE remote_id = ?').get(p.updated_by) as any;
      if (user) localUpdatedBy = user.id;
    }

    if (existing) {
      const oldStock = existing.stock_quantity ?? 0;
      const newStock = p.stock_quantity ?? 0;
      const stockChanged = oldStock !== newStock;

      db.prepare(`
        UPDATE products 
        SET name=?, stock_quantity=?, selling_price=?, buying_price=?, is_available=?,
            category_id=?, barcode=?, description=?, unit=?, image_url=?, sku=?,
            status=?, cost_method=?, minimum_stock=?, price=?, cost_price=?,
            created_by=?, updated_by=?, sort_order=?, is_featured=?, metadata=?,
            deleted_at=?, archived_at=?, updated_at=?
        WHERE id=?
      `).run(
        p.name, p.stock_quantity ?? 0,
        p.selling_price ?? p.price ?? 0, p.buying_price ?? p.cost_price ?? 0,
        p.is_available === true ? 1 : 0,
        localCategoryId, p.barcode ?? null, p.description ?? null, p.unit ?? null,
        p.image_url ?? null, p.sku ?? null, p.status ?? 'active', p.cost_method ?? 'average',
        p.minimum_stock ?? p.low_stock_threshold ?? 0, p.price ?? p.selling_price ?? 0,
        p.cost_price ?? p.buying_price ?? 0,
        localCreatedBy, localUpdatedBy, p.sort_order ?? 0,
        p.is_featured === true ? 1 : 0,
        p.metadata ? (typeof p.metadata === 'string' ? p.metadata : JSON.stringify(p.metadata)) : null,
        p.deleted_at ?? null, p.archived_at ?? null,
        p.updated_at || new Date().toISOString(), existing.id
      );
      lastPullStatus.productsUpdated++;
      if (stockChanged) {
        console.log(`[PullSync] 📦 STOCK CHANGED product #${existing.id} (remote=${p.id}) "${p.name}": ${oldStock} → ${newStock}`);
      }
    } else {
      const result = db.prepare(`
        INSERT INTO products 
          (remote_id, name, stock_quantity, selling_price, buying_price, is_available,
           category_id, barcode, description, unit, image_url, sku,
           status, cost_method, minimum_stock, price, cost_price,
           created_by, updated_by, sort_order, is_featured, metadata,
           deleted_at, archived_at, created_at, updated_at, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        p.id, p.name, p.stock_quantity ?? 0,
        p.selling_price ?? p.price ?? 0, p.buying_price ?? p.cost_price ?? 0,
        p.is_available === true ? 1 : 0,
        localCategoryId, p.barcode ?? null, p.description ?? null, p.unit ?? null,
        p.image_url ?? null, p.sku ?? null, p.status ?? 'active', p.cost_method ?? 'average',
        p.minimum_stock ?? p.low_stock_threshold ?? 0, p.price ?? p.selling_price ?? 0,
        p.cost_price ?? p.buying_price ?? 0,
        localCreatedBy, localUpdatedBy, p.sort_order ?? 0,
        p.is_featured === true ? 1 : 0,
        p.metadata ? (typeof p.metadata === 'string' ? p.metadata : JSON.stringify(p.metadata)) : null,
        p.deleted_at ?? null, p.archived_at ?? null,
        p.created_at || new Date().toISOString(),
        p.updated_at || new Date().toISOString(), tenantId
      );
      lastPullStatus.productsInserted++;
      console.log(`[PullSync] INSERTED product remote=${p.id} (local=${result.lastInsertRowid}) name=${p.name} stock=${p.stock_quantity}`);
    }
    lastPullStatus.productsPulled++;
  }
}

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

    let localWaiterId: number | null = null;
    if (t.assigned_waiter_id) {
      const waiter = db.prepare('SELECT id FROM users WHERE remote_id = ?').get(t.assigned_waiter_id) as any;
      if (waiter) localWaiterId = waiter.id;
    }

    const statusMap: Record<string, string> = {
      'occupied': 'active', 'available': 'out_of_service',
      'cleaning': 'cleaning', 'reserved': 'reserved',
    };
    const localStatus = statusMap[t.status] || t.status || 'active';

    if (existing) {
      db.prepare(`UPDATE restaurant_tables SET table_number=?, capacity=?, status=?, assigned_waiter_id=?, qr_token=?, updated_at=? WHERE id=?`)
        .run(String(t.table_number), t.capacity ?? 0, localStatus, localWaiterId,
          t.qr_token ?? null, t.updated_at || new Date().toISOString(), existing.id);
      lastPullStatus.tablesUpdated++;
    } else {
      const result = db.prepare(`
        INSERT INTO restaurant_tables (remote_id, table_number, capacity, status, assigned_waiter_id, qr_token, created_at, updated_at, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(t.id, String(t.table_number), t.capacity ?? 0, localStatus, localWaiterId,
        t.qr_token ?? null, t.created_at || new Date().toISOString(),
        t.updated_at || new Date().toISOString(), tenantId);
      lastPullStatus.tablesInserted++;
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
    
    let localTable = db.prepare('SELECT id FROM restaurant_tables WHERE remote_id = ?').get(o.table_id) as any;
    if (!localTable && o.table_id) localTable = db.prepare('SELECT id FROM restaurant_tables WHERE id = ?').get(o.table_id) as any;
    if (!localTable && o.table?.table_number) localTable = db.prepare('SELECT id FROM restaurant_tables WHERE table_number = ?').get(o.table.table_number) as any;
    
    let localWaiter = db.prepare('SELECT id FROM users WHERE remote_id = ?').get(o.waiter_id) as any;
    if (!localWaiter && o.waiter_id) localWaiter = db.prepare('SELECT id FROM users WHERE id = ?').get(o.waiter_id) as any;
    
    const tableId = localTable ? localTable.id : o.table_id;
    const waiterId = localWaiter ? localWaiter.id : o.waiter_id;

    let transformedItems = o.items || [];
    if (Array.isArray(transformedItems)) {
      transformedItems = transformedItems.map((it: any) => {
        const pid = it.product_id || it.productId;
        const localProd = db.prepare('SELECT id FROM products WHERE remote_id = ?').get(pid) as any;
        return { ...it, product_id: localProd ? localProd.id : pid, productId: localProd ? localProd.id : pid };
      });
    }

    const rawSource = (o.source || '').toLowerCase();
    let normalizedSource: string;
    if (rawSource === 'qr') normalizedSource = 'QR';
    else if (rawSource === 'pos' || rawSource === 'lp') normalizedSource = 'LP';
    else normalizedSource = 'CP';

    if (existing) {
      db.prepare(`UPDATE orders SET status=?, total=?, items=?, source=?, table_id=?, waiter_id=?, updated_at=? WHERE id=?`)
        .run(o.status, o.total, JSON.stringify(transformedItems), normalizedSource, tableId, waiterId, o.updated_at, existing.id);
    } else {
      db.prepare(`INSERT INTO orders (remote_id, source, table_id, waiter_id, status, total, items, created_at, updated_at, tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(o.id, normalizedSource, tableId, waiterId, o.status, o.total, JSON.stringify(transformedItems), o.created_at, o.updated_at, tenantId);
      if (o.status === 'pending' && normalizedSource === 'QR') {
        try { createNotification({ type: 'newQrOrder', title: 'Nouvelle commande QR', message: `Tenant #${tenantId} - Nouvelle commande en attente`, priority: 'high', notification_type: 'NEW_QR_ORDER', link: '/orders', metadata: { remote_id: o.id, tenant_id: tenantId } }); } catch {}
      }
    }
    lastPullStatus.ordersPulled++;
  }
}

async function pullOrderItems(supabase: SupabaseClient, _since: string, tenantId: number) {
  const { data: items, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', _since);
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

async function pullInventoryMovements(supabase: SupabaseClient, since: string, tenantId: number) {
  const { data: movements, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  if (error) return;
  if (!movements || movements.length === 0) return;

  for (const m of movements as any[]) {
    const existing = db.prepare('SELECT id FROM inventory_movements WHERE remote_id = ?').get(m.id) as any;
    let localProductId: number | null = null;
    if (m.product_id) {
      const p = db.prepare('SELECT id FROM products WHERE remote_id = ?').get(m.product_id) as any;
      if (p) localProductId = p.id;
    }
    if (existing) {
      db.prepare(`UPDATE inventory_movements SET product_id=?, movement_type=?, quantity_before=?, quantity_changed=?, quantity_after=?, reference_id=?, reference_type=?, status=?, notes=?, unit_cost=?, total_value=?, created_by=?, reason=?, movement_code=?, inventory_session_id=?, approved_by=? WHERE id=?`)
        .run(localProductId, m.movement_type ?? null, m.quantity_before ?? 0, m.quantity_changed ?? 0, m.quantity_after ?? 0, m.reference_id ?? null, m.reference_type ?? null, m.status ?? null, m.notes ?? null, m.unit_cost ?? 0, m.total_value ?? 0, null, m.reason ?? null, m.movement_code ?? null, m.inventory_session_id ?? null, null, existing.id);
    } else {
      db.prepare(`INSERT INTO inventory_movements (remote_id, product_id, movement_type, quantity_before, quantity_changed, quantity_after, reference_id, reference_type, status, notes, unit_cost, total_value, created_by, reason, movement_code, inventory_session_id, approved_by, created_at, tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(m.id, localProductId, m.movement_type ?? null, m.quantity_before ?? 0, m.quantity_changed ?? 0, m.quantity_after ?? 0, m.reference_id ?? null, m.reference_type ?? null, m.status ?? null, m.notes ?? null, m.unit_cost ?? 0, m.total_value ?? 0, null, m.reason ?? null, m.movement_code ?? null, m.inventory_session_id ?? null, null, m.created_at || new Date().toISOString(), tenantId);
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