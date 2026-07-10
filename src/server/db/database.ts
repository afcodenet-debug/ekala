import path from 'path';
import fs from 'fs';
import { applyAll as runMigrations } from '../infra/migrations/runner';

// better-sqlite3 ships native bindings.
// In Electron/packaged runs (macOS/Windows) or unusual Node/Electron versions,
// the native file might be missing and crash the whole server at import time.
// We must therefore tolerate missing bindings and boot in "db disabled" mode.
let Database: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Database = require('better-sqlite3');
} catch (e: any) {
  console.warn('[Database] better-sqlite3 native bindings unavailable at require time:', e?.message || e);
  Database = null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Database connector — Great Olive POS/ERP
// ══════════════════════════════════════════════════════════════════════════════
//
// Architecture
// ───────────
//  1. Open / create the database file.
//  2. Apply WAL + synchronous pragmas.
//  3. Run all forward migrations from backend/migrations/.
//     (Each migration is idempotent and records itself in the _migrations table.)
//  4. Seed data unconditionally — callers are responsible for the guard logic
//     inside each seeder so it never duplicates on re-runs.
//
// Why not inline CREATE TABLE?
// ──────────────────────────
//  Inline DDL creates the schema but destroys any ability to audit history.
//  A migration runner keeps a running ledger (the `_migrations` table) and
//  allows safe rollbacks via per-migration SQL reversal scripts.
//
// Data directory layout
// ──────────────────────
//   data/
//     database.db   — main SQLite file
//     uploads/products/ — product images written by the upload route
// ===============================================================================

// --- paths -----------------------------------------------------------------

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const uploadsDir  = path.resolve(dataDir, 'uploads', 'products');

if (!fs.existsSync(dataDir))    fs.mkdirSync(dataDir,    { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const dbPath = path.join(dataDir, 'database.db');

// === HARD GUARD: Prevent local SQLite on the public Render service when Supabase is enabled ===
// This makes it impossible to accidentally use SQLite on the cloud QR menu backend.
const renderCloudMode = process.env.RENDER_CLOUD_MODE === 'true' || process.env.RENDER_CLOUD_MODE === '1';
const useSupabaseTables = process.env.USE_SUPABASE_TABLES === 'true' || process.env.USE_SUPABASE_TABLES === '1';
const useSupabaseProducts = process.env.USE_SUPABASE_PRODUCTS === 'true' || process.env.USE_SUPABASE_PRODUCTS === '1';

let dbInstance: any = null;

try {
  if (renderCloudMode || ((useSupabaseTables || useSupabaseProducts) && process.env.NODE_ENV === 'production')) {
    console.warn('══════════════════════════════════════════════════════════════════');
    console.warn('[Database] Cloud mode detected — exporting null DB stub.');
    console.warn('RENDER_CLOUD_MODE=', renderCloudMode);
    console.warn('All data operations must go through Supabase repositories.');
    console.warn('══════════════════════════════════════════════════════════════════');

    dbInstance = null;
  } else {
    if (!Database) {
      console.warn('[Database] better-sqlite3 constructor unavailable — skipping local SQLite connection.');
      dbInstance = null;
    } else {
      console.log('[Database] Connecting to:', dbPath);

      dbInstance = new Database(dbPath, {
        verbose: undefined,
        timeout: 5000,
      });

      dbInstance.pragma('journal_mode = WAL');
      dbInstance.pragma('synchronous = NORMAL');
      dbInstance.pragma('busy_timeout = 15000');
      dbInstance.pragma('cache_size = -64000');
      dbInstance.pragma('foreign_keys = ON');
    }
  }
} catch (e: any) {
  console.error('[Database] CRITICAL: Failed to instantiate or configure SQLite (bindings or disk issue):', e?.message || e);
  console.warn('[Database] Continuing in degraded mode with db=null. Supabase-only features may still work if enabled.');
  dbInstance = null;
}

export let db: any = null;

// Query-builder minimal (compatible where().first().count().insert().update().orderBy())
// Permet aux plateformes d'utiliser: db('users').where(...).first()

interface QueryBuilder {
  where(col: string | ((qb: QueryBuilder) => void), val?: any, op?: string): QueryBuilder;
  whereRaw(sql: string): QueryBuilder;
  orWhere(col: string, val: any, op?: string): QueryBuilder;
  first(): any;
  all(): any[];
  count(col?: string): QueryBuilder;
  insert(data: Record<string, any>): { lastInsertRowid: number };
  update(data: Record<string, any>): { changes: number };
  orderBy(col: string): QueryBuilder;
  groupBy(col: string): QueryBuilder;
  select(...cols: string[]): QueryBuilder;
  leftJoin(table: string, condition: string): QueryBuilder;
  join(table: string, leftCol: string, rightCol: string): QueryBuilder;
  limit(n: number): QueryBuilder;
  offset(n: number): QueryBuilder;
  clone(): QueryBuilder;
  as(alias: string): string;
}

export function createQueryBuilder(rawDb: any, table: string): QueryBuilder {
  const clauses: { kind: string; col?: string; val?: any; op?: string; raw?: string }[] = [];
  let selectCols: string = '*';
  let orderCol: string | null = null;
  let groupCol: string | null = null;
  let countCol: string | null = null;
  let limitN: number | null = null;
  let offsetN: number | null = null;
  const joins: { kind: string; table: string; condition: string }[] = [];

  const cloneState = () => ({ clauses: JSON.parse(JSON.stringify(clauses)), selectCols, orderCol, groupCol, countCol, limitN, offsetN, joins: JSON.parse(JSON.stringify(joins)), table });

  const buildSelect = () => (countCol ? `COUNT(${countCol}) as count` : selectCols);

  const toSql = (state?: { clauses?: any[]; joins?: any[]; table?: string; selectCols?: string; countCol?: string | null; groupCol?: string | null; orderCol?: string | null; limitN?: number | null; offsetN?: number | null }) => {
    const c = state?.clauses ?? clauses;
    const j = state?.joins ?? joins;
    const t = state?.table ?? table;
    const sc = state?.selectCols ?? selectCols;
    const cc = state?.countCol ?? countCol;
    const gc = state?.groupCol ?? groupCol;
    const oc = state?.orderCol ?? orderCol;
    const ln = state?.limitN ?? limitN;
    const on = state?.offsetN ?? offsetN;
    const whereParts: string[] = [];
    const vals: any[] = [];
    for (const x of c) {
      if (x.kind === 'where' || x.kind === 'orWhere') {
        const prefix = x.kind === 'orWhere' ? 'OR' : '';
        if (x.raw) {
          whereParts.push(`${prefix} ${x.raw}`);
        } else {
          whereParts.push(`${prefix} ${x.col} ${x.op || '='} ?`);
          vals.push(x.val);
        }
      }
    }
    let sql = `SELECT ${cc ? `COUNT(${cc}) as count` : sc} FROM ${t}`;
    for (const jj of j) {
      sql += ` ${jj.kind} ${jj.table} ON ${jj.condition}`;
    }
    const whereStr = whereParts.join('');
    if (whereStr) sql += ' WHERE ' + whereStr;
    if (gc) sql += ` GROUP BY ${gc}`;
    if (oc) sql += ` ORDER BY ${oc}`;
    if (ln) sql += ` LIMIT ${ln}`;
    if (on) sql += ` OFFSET ${on}`;
    return { sql, vals };
  };

  return {
    where(col: string | ((qb: QueryBuilder) => void), val?: any, op?: string) {
      if (typeof col === 'function') {
        const sub = createQueryBuilder(rawDb, table);
        col(sub);
        const subState = (sub as any)._state;
        if (subState?.clauses?.length) {
          clauses.push(...subState.clauses);
        }
      } else {
        clauses.push({ kind: 'where', col, val: op ?? val, op: '=' });
      }
      return this as any;
    },
    whereRaw(sql: string) {
      clauses.push({ kind: 'where', raw: sql });
      return this as any;
    },
    orWhere(col: string, val: any, op?: string) {
      clauses.push({ kind: 'orWhere', col, val: op ?? val, op: '=' });
      return this as any;
    },
    select(...cols: string[]) {
      selectCols = cols.join(', ');
      return this as any;
    },
    orderBy(col: string) {
      orderCol = col;
      return this as any;
    },
    groupBy(col: string) {
      groupCol = col;
      return this as any;
    },
    join(tbl: string, leftCol: string, rightCol: string) {
      joins.push({ kind: 'JOIN', table: tbl, condition: `${leftCol} = ${rightCol}` });
      return this as any;
    },
    leftJoin(tbl: string, condition: string) {
      joins.push({ kind: 'LEFT JOIN', table: tbl, condition });
      return this as any;
    },
    limit(n: number) {
      limitN = n;
      return this as any;
    },
    offset(n: number) {
      offsetN = n;
      return this as any;
    },
    clone() {
      return createQueryBuilder(rawDb, table) as any;
    },
    all() {
      const { sql, vals } = toSql();
      if (!rawDb) return [];
      try {
        return rawDb.prepare(sql).all(...vals);
      } catch {
        return [];
      }
    },
    first() {
      const s = cloneState();
      s.limitN = s.limitN ?? 1;
      const { sql, vals } = toSql(s);
      if (!rawDb) return null;
      try {
        return rawDb.prepare(sql).all(...vals)[0] || null;
      } catch {
        return null;
      }
    },
    count(col = 'id') {
      const m = String(col).match(/^(.+?)\s+as\s+(\w+)$/i);
      countCol = m ? m[1].trim() : col;
      return this as any;
    },
    insert(data: Record<string, any>) {
      if (!rawDb) return { lastInsertRowid: 0 };
      const cols = Object.keys(data);
      const vals = cols.map(c => data[c]);
      const ph = cols.map(() => '?').join(',');
      const result = rawDb.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${ph})`).run(...vals);
      return { lastInsertRowid: result.lastInsertRowid };
    },
    update(data: Record<string, any>) {
      if (!rawDb) return { changes: 0 };
      const setCols = Object.keys(data);
      const setVals = setCols.map(c => data[c]);
      const whereParts: string[] = [];
      const whereVals: any[] = [];
      const extraParts: string[] = [];
      for (const c of clauses) {
        if (c.kind === 'where' || c.kind === 'orWhere') {
          const prefix = c.kind === 'orWhere' ? 'OR' : '';
          if (c.raw) {
            extraParts.push(`${prefix} ${c.raw}`);
          } else {
            whereParts.push(`${prefix} ${c.col} ${c.op || '='} ?`);
            whereVals.push(c.val);
          }
        }
      }
      const whereStr = [...extraParts, ...whereParts].join(' AND ');
      const sql = `UPDATE ${table} SET ${setCols.map(c => `${c} = ?`).join(', ')}${whereStr ? ' WHERE ' + whereStr : ''}`;
      try {
        const r = rawDb.prepare(sql).run(...setVals, ...whereVals);
        return { changes: r.changes };
      } catch {
        return { changes: 0 };
      }
    },
    as(alias: string) {
      const { sql, vals } = toSql();
      if (!rawDb) return `(${sql}) AS ${alias}`;
      return `(${sql}) AS ${alias}`;
    },
  } as any;
}

function _exec(rawDb: any, table: string, selectCols: string, countCol: string | null, clauses: any[], joins: any[], order: string | null, limit: number | null, offsetN: number | null): any[] {
  if (!rawDb) return [];
  const whereParts: string[] = [];
  const vals: any[] = [];
  for (const c of clauses) {
    if (c.type === 'where') {
      if (c.raw) {
        whereParts.push(c.raw);
      } else {
        whereParts.push(`${c.col} ${c.op || '='} ?`);
        vals.push(c.val);
      }
    }
  }
  const select = countCol ? `COUNT(${countCol}) as count` : selectCols;
  let sql = `SELECT ${select} FROM ${table}`;
  for (const j of joins) {
    sql += ` ${j.kind} ${j.table} ON ${j.condition}`;
  }
  if (whereParts.length) sql += ' WHERE ' + whereParts.join(' AND ');
  if (order) sql += ` ORDER BY ${order}`;
  if (limit) sql += ` LIMIT ${limit}`;
  if (offsetN) sql += ` OFFSET ${offsetN}`;
  try {
    return rawDb.prepare(sql).all(...vals);
  } catch {
    return [];
  }
}

export function queryBuilder(table: string): QueryBuilder {
  return createQueryBuilder(dbInstance, table);
}

// Wrappe db en fonction callable: db('users') → QueryBuilder
function makeCallable(rawDb: any): any {
  if (!rawDb) return () => createQueryBuilder(null, '');
  const call = ((tableName: string) => createQueryBuilder(rawDb, tableName)) as any;
  return new Proxy(call, {
    get(_target, prop: string) {
      if (prop === 'then') return undefined;
      const val = (rawDb as any)?.[prop];
      if (typeof val === 'function') return val.bind(rawDb);
      return val;
    },
  });
}

const callableDb = makeCallable(dbInstance);
db = callableDb;

// --- public factory --------------------------------------------------------

function seedQrTokensForTables(): void {
  if (!dbInstance) {
    console.log('[Database] seedQrTokensForTables: skipping (dbInstance is null)');
    return;
  }
  // Seed uniquement si la colonne existe (après migration)
  try {
    const hasColumn = dbInstance.prepare(`
      PRAGMA table_info(restaurant_tables);
    `).all().some((c: any) => c.name === 'qr_token');

    if (!hasColumn) return;

    const needs = dbInstance.prepare(`
      SELECT COUNT(*) AS cnt
      FROM restaurant_tables
      WHERE qr_token IS NULL OR qr_token = ''
    `).get() as { cnt: number };

    if (!needs.cnt) return;

    // UUID v4 sans tirets, déterministe “assez robuste” côté backend via crypto
    // Node >= 14 supporte crypto.randomUUID()
    const crypto = require('crypto') as typeof import('crypto');

    const rows = dbInstance.prepare(`
      SELECT id
      FROM restaurant_tables
      WHERE qr_token IS NULL OR qr_token = ''
    `).all() as Array<{ id: number }>;

    const update = dbInstance.prepare(`
      UPDATE restaurant_tables
      SET qr_token = ?
      WHERE id = ?
    `);

    const tokens: string[] = rows.map(() => crypto.randomUUID().replace(/-/g, ''));
    for (let i = 0; i < rows.length; i++) {
      update.run(tokens[i], rows[i].id);
    }
  } catch {
    // si restaurant_tables/qr_token n’existe pas encore, on ignore
  }
}

export function initializeDatabase(): void {
  console.log('[Database] initializeDatabase starting. dbInstance is null?', !dbInstance);
  if (!dbInstance) {
    console.log('[Database] Cloud mode or SQLite disabled — skipping initializeDatabase.');
    return;
  }
  // ── Create migrations bookkeeping table FIRST (before migrations run) ─────
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── Safety net: ensure minimum tables for QR menu on fresh DB (Render) ───
  // This MUST run BEFORE migrations to avoid "no such table" errors
  ensureCoreQrMenuTables();
  ensureAdvancedTables();

  // ── Migrations (forward-only, sequential, idempotent) ────────────────────
  runMigrations();

  // ── Seed data (wrapped for fresh DB tolerance on Render) ────────────────
  try {
    seedAdmin();
    seedManager();
    seedWaiter();
    seedCashier();
    seedTables();
    seedCategories();
    seedProducts();

    // Purge simple des produits "demo/test" existants dans la BD
    disableDemoTestProducts();

    seedMenuSchema(); // legacy QR menu schema seed (menu_categories/menu_items)
    seedSettings();

    // Seed QR tokens après seedTables (au cas où la table est vide au 1er run)
    seedQrTokensForTables();

    ensureEmailSettingsDefaults();
    ensureNotificationTables(); // Phase 3 - Notifications & Reports tables
    ensureTenantSyncColumns(); // Ensure sync columns exist for users/tenants/tenant_users

    // Add email column to users (nullable + unique)
    try {
      db.prepare(`ALTER TABLE users ADD COLUMN email TEXT`).run();
    } catch (e) {
      // Column already exists or table missing
    }

    // Create partial unique index for non-null emails
    try {
      db.prepare(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique 
        ON users(email) 
        WHERE email IS NOT NULL
      `).run();
    } catch (e) {
      // table or index issue on fresh DB
    }
  } catch (e: any) {
    console.warn('[Database] Seeding skipped due to missing tables (fresh DB):', e?.message || e);
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Bootstrap: force minimal schema for QR Public Menu on fresh deployments (Render)
// This runs after migrations so it acts as a safety net when early migrations are skipped.
// ───────────────────────────────────────────────────────────────────────────────
function ensureCoreQrMenuTables(): void {
  if (!dbInstance) return;
  // restaurant_tables (needed for /api/menu/table/:qr_token)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number TEXT NOT NULL,
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'available',
      assigned_waiter_id INTEGER,
      qr_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // categories (modern)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      remote_id INTEGER
    )
  `);

  // products (the table actually used by the public menu now)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      name TEXT NOT NULL,
      barcode TEXT,
      sku TEXT,
      buying_price REAL DEFAULT 0,
      selling_price REAL NOT NULL,
      stock_quantity REAL DEFAULT 0,
      minimum_stock REAL DEFAULT 0,
      unit TEXT DEFAULT 'pcs',
      is_available INTEGER DEFAULT 1,
      description TEXT,
      image_url TEXT,
      status TEXT DEFAULT 'active',
      cost_method TEXT DEFAULT 'average',
      created_by INTEGER,
      updated_by INTEGER,
      archived_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      sort_order INTEGER DEFAULT 0,
      tenant_id TEXT,
      is_featured INTEGER DEFAULT 0,
      metadata TEXT,
      version INTEGER DEFAULT 1,
      price REAL DEFAULT 0,
      cost_price REAL DEFAULT 0,
      remote_id INTEGER,
      sync_status TEXT DEFAULT 'synced'
    )
  `);

  // Basic orders table (needed for checkout flow)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER,
      waiter_id INTEGER,
      items TEXT,
      status TEXT DEFAULT 'pending',
      total REAL DEFAULT 0,
      customer_phone TEXT,
      notes TEXT,
      remote_id INTEGER,
      source TEXT DEFAULT 'local',
      customer_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Settings table (critical for app bootstrap)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Menu categories (for QR menu)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Menu items (for QR menu)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'ZMW',
      unit TEXT DEFAULT 'pcs',
      image_url TEXT,
      is_available INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE RESTRICT
    )
  `);

  // Ensure columns exist if table was already created (migration-like)
  try {
    // --- Product & Category & Orders & Sales Migrations ---
    const productCols = dbInstance.prepare("PRAGMA table_info(products)").all() as Array<{ name: string }>;
    if (!productCols.some(c => c.name === 'status')) dbInstance.exec(`ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active'`);
    if (!productCols.some(c => c.name === 'remote_id')) dbInstance.exec(`ALTER TABLE products ADD COLUMN remote_id INTEGER`);
    if (!productCols.some(c => c.name === 'price')) dbInstance.exec(`ALTER TABLE products ADD COLUMN price REAL DEFAULT 0`);
    if (!productCols.some(c => c.name === 'buying_price')) dbInstance.exec(`ALTER TABLE products ADD COLUMN buying_price REAL DEFAULT 0`);
    if (!productCols.some(c => c.name === 'cost_price')) dbInstance.exec(`ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0`);
    if (!productCols.some(c => c.name === 'tenant_id')) dbInstance.exec(`ALTER TABLE products ADD COLUMN tenant_id TEXT`);
    if (!productCols.some(c => c.name === 'business_id')) dbInstance.exec(`ALTER TABLE products ADD COLUMN business_id INTEGER`);
    if (!productCols.some(c => c.name === 'deleted_at')) dbInstance.exec(`ALTER TABLE products ADD COLUMN deleted_at DATETIME`);
    if (!productCols.some(c => c.name === 'is_featured')) dbInstance.exec(`ALTER TABLE products ADD COLUMN is_featured INTEGER DEFAULT 0`);
    if (!productCols.some(c => c.name === 'sort_order')) dbInstance.exec(`ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0`);
    if (!productCols.some(c => c.name === 'metadata')) dbInstance.exec(`ALTER TABLE products ADD COLUMN metadata TEXT`);
    if (!productCols.some(c => c.name === 'version')) dbInstance.exec(`ALTER TABLE products ADD COLUMN version INTEGER DEFAULT 1`);
    if (!productCols.some(c => c.name === 'sync_status')) dbInstance.exec(`ALTER TABLE products ADD COLUMN sync_status TEXT DEFAULT 'synced'`);
    if (!productCols.some(c => c.name === 'created_by')) dbInstance.exec(`ALTER TABLE products ADD COLUMN created_by INTEGER`);
    if (!productCols.some(c => c.name === 'updated_by')) dbInstance.exec(`ALTER TABLE products ADD COLUMN updated_by INTEGER`);
    if (!productCols.some(c => c.name === 'archived_at')) dbInstance.exec(`ALTER TABLE products ADD COLUMN archived_at DATETIME`);
    if (!productCols.some(c => c.name === 'sku')) dbInstance.exec(`ALTER TABLE products ADD COLUMN sku TEXT`);
    if (!productCols.some(c => c.name === 'barcode')) dbInstance.exec(`ALTER TABLE products ADD COLUMN barcode TEXT`);
    if (!productCols.some(c => c.name === 'cost_method')) dbInstance.exec(`ALTER TABLE products ADD COLUMN cost_method TEXT DEFAULT 'average'`);


    const categoryCols = dbInstance.prepare("PRAGMA table_info(categories)").all() as Array<{ name: string }>;
    if (!categoryCols.some(c => c.name === 'tenant_id')) dbInstance.exec(`ALTER TABLE categories ADD COLUMN tenant_id INTEGER`);
    if (!categoryCols.some(c => c.name === 'deleted_at')) dbInstance.exec(`ALTER TABLE categories ADD COLUMN deleted_at DATETIME`);
    if (!categoryCols.some(c => c.name === 'updated_at')) dbInstance.exec(`ALTER TABLE categories ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
    if (!categoryCols.some(c => c.name === 'remote_id')) dbInstance.exec(`ALTER TABLE categories ADD COLUMN remote_id INTEGER`);

    const orderCols = dbInstance.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>;
    if (!orderCols.some(c => c.name === 'waiter_id'))  dbInstance.exec(`ALTER TABLE orders ADD COLUMN waiter_id INTEGER`);
    if (!orderCols.some(c => c.name === 'items'))      dbInstance.exec(`ALTER TABLE orders ADD COLUMN items TEXT`);
    if (!orderCols.some(c => c.name === 'remote_id')) dbInstance.exec(`ALTER TABLE orders ADD COLUMN remote_id INTEGER`);
    if (!orderCols.some(c => c.name === 'source'))     dbInstance.exec(`ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'local'`);
    if (!orderCols.some(c => c.name === 'notes'))      dbInstance.exec(`ALTER TABLE orders ADD COLUMN notes TEXT`);
    if (!orderCols.some(c => c.name === 'customer_phone')) dbInstance.exec(`ALTER TABLE orders ADD COLUMN customer_phone TEXT`);
    if (!orderCols.some(c => c.name === 'customer_id'))    dbInstance.exec(`ALTER TABLE orders ADD COLUMN customer_id INTEGER`);
    if (!orderCols.some(c => c.name === 'tenant_id'))     dbInstance.exec(`ALTER TABLE orders ADD COLUMN tenant_id INTEGER`);
    if (!orderCols.some(c => c.name === 'deleted_at'))     dbInstance.exec(`ALTER TABLE orders ADD COLUMN deleted_at DATETIME`);

    const saleCols = dbInstance.prepare("PRAGMA table_info(sales)").all() as Array<{ name: string }>;
    if (!saleCols.some(c => c.name === 'tenant_id'))     dbInstance.exec(`ALTER TABLE sales ADD COLUMN tenant_id INTEGER`);
    if (!saleCols.some(c => c.name === 'deleted_at'))     dbInstance.exec(`ALTER TABLE sales ADD COLUMN deleted_at DATETIME`);

    const tableCols = dbInstance.prepare("PRAGMA table_info(restaurant_tables)").all() as Array<{ name: string }>;
    if (!tableCols.some(c => c.name === 'tenant_id')) dbInstance.exec(`ALTER TABLE restaurant_tables ADD COLUMN tenant_id INTEGER`);
    if (!tableCols.some(c => c.name === 'remote_id')) dbInstance.exec(`ALTER TABLE restaurant_tables ADD COLUMN remote_id INTEGER`);
  } catch (e) {
    console.warn('[Database] Column migration skipped (tables may be fresh):', e);
  }

  // Ensure unique index for categories remote_id
  try {
    dbInstance.exec(`CREATE INDEX IF NOT EXISTS idx_categories_remote_id ON categories(remote_id) WHERE remote_id IS NOT NULL`);
  } catch (e) {
    console.warn('[Database] Categories index skipped:', e);
  }

  // Ensure unique indexes for remote_ids to prevent sync duplicates
  try {
    dbInstance.exec(`
      CREATE INDEX IF NOT EXISTS idx_tables_remote_id ON restaurant_tables(remote_id) WHERE remote_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_products_remote_id ON products(remote_id) WHERE remote_id IS NOT NULL;
    `);
  } catch (e) {
    console.warn('[Database] Remote ID indexes skipped:', e);
  }

// users (needed by seedAdmin and some protected routes)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT NULL,
      phone TEXT NULL,
      pin_code TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'waiter' CHECK (role IN ('admin', 'cashier', 'waiter', 'manager', 'owner')),
      email TEXT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tenant_id INTEGER NULL,
      password_hash TEXT NULL,
      has_setup_pin INTEGER DEFAULT 0,
      remote_id INTEGER
    )
  `);
  
  try { dbInstance.prepare(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`).run(); } catch {}
  try { dbInstance.prepare(`CREATE INDEX IF NOT EXISTS idx_users_remote_id ON users(remote_id) WHERE remote_id IS NOT NULL`).run(); } catch {}
  try { dbInstance.prepare(`CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id)`).run(); } catch {}
  try { dbInstance.prepare(`CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)`).run(); } catch {}
  try { dbInstance.prepare(`UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL`).run(); } catch {}

  // ── Maintenance: Assign default password to users without one ──────────────────
  try {
    const bcrypt = require('bcryptjs');
    const defaultPassword = 'admin123';
    const defaultHash = bcrypt.hashSync(defaultPassword, 10);

    // Update those without any hash
    const stmt = dbInstance.prepare(`
      UPDATE users 
      SET password_hash = ? 
      WHERE password_hash IS NULL OR password_hash = ''
    `);
    const result = stmt.run(defaultHash);
    if (result.changes > 0) {
      console.log(`[Database] Assigned bcrypt default password 'admin123' to ${result.changes} users.`);
    }

    // Optional: Re-hash legacy PBKDF2 hashes (those not starting with $2)
    // ONLY if they match 'admin123' or are forced. For now, we'll just handle empty ones.
  } catch (e: any) {
    console.warn('[Database] Failed to assign default passwords:', e.message);
  }

  console.log('[Database] Core QR menu tables ensured (IF NOT EXISTS)');
}

function ensureAdvancedTables(): void {
  if (!dbInstance) return;

  // 1. Core Tables Creation (Robust)
  // customers
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone_number TEXT NOT NULL,
      pin_code TEXT NOT NULL,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // sales
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      order_id INTEGER,
      user_id INTEGER NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'mobile_money')),
      version INTEGER DEFAULT 1,
      remote_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      customer_id INTEGER,
      tenant_id INTEGER DEFAULT 5,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    )
  `);

  // sale_items
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      remote_id INTEGER,
      tenant_id INTEGER DEFAULT 5,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    )
  `);

  // inventory_movements (Correct Schema)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer', 'sale', 'return')),
      quantity_before REAL NOT NULL,
      quantity_changed REAL NOT NULL,
      quantity_after REAL NOT NULL,
      reference_id TEXT,
      reference_type TEXT,
      status TEXT DEFAULT 'confirmed',
      notes TEXT,
      unit_cost REAL DEFAULT 0,
      total_value REAL DEFAULT 0,
      created_by INTEGER,
      reason TEXT,
      tenant_id INTEGER DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // expenses
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      amount REAL NOT NULL,
      description TEXT,
      user_id INTEGER,
      date TEXT,
      tenant_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Safety Net for missing columns
  try {
    const saleCols = dbInstance.prepare("PRAGMA table_info(sales)").all() as Array<{ name: string }>;
    if (!saleCols.some(c => c.name === 'subtotal'))       dbInstance.exec(`ALTER TABLE sales ADD COLUMN subtotal REAL DEFAULT 0`);
    if (!saleCols.some(c => c.name === 'discount'))       dbInstance.exec(`ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0`);
    if (!saleCols.some(c => c.name === 'tax'))            dbInstance.exec(`ALTER TABLE sales ADD COLUMN tax REAL DEFAULT 0`);
    if (!saleCols.some(c => c.name === 'total_amount'))   dbInstance.exec(`ALTER TABLE sales ADD COLUMN total_amount REAL DEFAULT 0`);
    if (!saleCols.some(c => c.name === 'invoice_number')) dbInstance.exec(`ALTER TABLE sales ADD COLUMN invoice_number TEXT`);
    if (!saleCols.some(c => c.name === 'payment_method')) dbInstance.exec(`ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'cash'`);
    if (!saleCols.some(c => c.name === 'user_id'))        dbInstance.exec(`ALTER TABLE sales ADD COLUMN user_id INTEGER`);
    if (!saleCols.some(c => c.name === 'order_id'))       dbInstance.exec(`ALTER TABLE sales ADD COLUMN order_id INTEGER`);
    if (!saleCols.some(c => c.name === 'version'))        dbInstance.exec(`ALTER TABLE sales ADD COLUMN version INTEGER DEFAULT 1`);
    if (!saleCols.some(c => c.name === 'customer_id'))    dbInstance.exec(`ALTER TABLE sales ADD COLUMN customer_id INTEGER`);
    if (!saleCols.some(c => c.name === 'remote_id'))      dbInstance.exec(`ALTER TABLE sales ADD COLUMN remote_id INTEGER`);
    if (!saleCols.some(c => c.name === 'updated_at'))     dbInstance.exec(`ALTER TABLE sales ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
    if (!saleCols.some(c => c.name === 'tenant_id'))      dbInstance.exec(`ALTER TABLE sales ADD COLUMN tenant_id INTEGER`);

    const saleItemCols = dbInstance.prepare("PRAGMA table_info(sale_items)").all() as Array<{ name: string }>;
    if (!saleItemCols.some(c => c.name === 'remote_id')) dbInstance.exec(`ALTER TABLE sale_items ADD COLUMN remote_id INTEGER`);
    if (!saleItemCols.some(c => c.name === 'tenant_id')) dbInstance.exec(`ALTER TABLE sale_items ADD COLUMN tenant_id INTEGER`);

    const orderCols = dbInstance.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>;
    if (!orderCols.some(c => c.name === 'tenant_id')) dbInstance.exec(`ALTER TABLE orders ADD COLUMN tenant_id INTEGER`);

    const productCols = dbInstance.prepare("PRAGMA table_info(products)").all() as Array<{ name: string }>;
    if (!productCols.some(c => c.name === 'tenant_id')) dbInstance.exec(`ALTER TABLE products ADD COLUMN tenant_id INTEGER`);

    const categoryCols = dbInstance.prepare("PRAGMA table_info(categories)").all() as Array<{ name: string }>;
    if (!categoryCols.some(c => c.name === 'tenant_id')) dbInstance.exec(`ALTER TABLE categories ADD COLUMN tenant_id INTEGER`);

    const tableCols = dbInstance.prepare("PRAGMA table_info(restaurant_tables)").all() as Array<{ name: string }>;
    if (!tableCols.some(c => c.name === 'tenant_id')) dbInstance.exec(`ALTER TABLE restaurant_tables ADD COLUMN tenant_id INTEGER`);

    const userCols = dbInstance.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    if (!userCols.some(c => c.name === 'tenant_id')) dbInstance.exec(`ALTER TABLE users ADD COLUMN tenant_id INTEGER`);
    // Align local users schema with the Supabase `users` table so that all
    // columns can be synchronized (local-first → Supabase).
    if (!userCols.some(c => c.name === 'is_super_admin')) dbInstance.exec(`ALTER TABLE users ADD COLUMN is_super_admin INTEGER DEFAULT 0`);
    if (!userCols.some(c => c.name === 'is_platform_user')) dbInstance.exec(`ALTER TABLE users ADD COLUMN is_platform_user INTEGER DEFAULT 0`);
    if (!userCols.some(c => c.name === 'status')) dbInstance.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`);
    if (!userCols.some(c => c.name === 'revoked_at')) dbInstance.exec(`ALTER TABLE users ADD COLUMN revoked_at TEXT`);
    if (!userCols.some(c => c.name === 'revoked_by')) dbInstance.exec(`ALTER TABLE users ADD COLUMN revoked_by INTEGER`);
    if (!userCols.some(c => c.name === 'locked_until')) dbInstance.exec(`ALTER TABLE users ADD COLUMN locked_until TEXT`);

    const expCols = dbInstance.prepare("PRAGMA table_info(expenses)").all() as Array<{ name: string }>;
    if (!expCols.some(c => c.name === 'user_id'))   dbInstance.exec(`ALTER TABLE expenses ADD COLUMN user_id INTEGER`);
    if (!expCols.some(c => c.name === 'tenant_id')) dbInstance.exec(`ALTER TABLE expenses ADD COLUMN tenant_id INTEGER`);

    const invMoveCols = dbInstance.prepare("PRAGMA table_info(inventory_movements)").all() as Array<{ name: string }>;
    if (!invMoveCols.some(c => c.name === 'unit_cost'))      dbInstance.exec(`ALTER TABLE inventory_movements ADD COLUMN unit_cost REAL DEFAULT 0`);
    if (!invMoveCols.some(c => c.name === 'total_value'))    dbInstance.exec(`ALTER TABLE inventory_movements ADD COLUMN total_value REAL DEFAULT 0`);
    if (!invMoveCols.some(c => c.name === 'created_by'))     dbInstance.exec(`ALTER TABLE inventory_movements ADD COLUMN created_by INTEGER`);
    if (!invMoveCols.some(c => c.name === 'reason'))         dbInstance.exec(`ALTER TABLE inventory_movements ADD COLUMN reason TEXT`);
    if (!invMoveCols.some(c => c.name === 'reference_type')) dbInstance.exec(`ALTER TABLE inventory_movements ADD COLUMN reference_type TEXT`);
    if (!invMoveCols.some(c => c.name === 'reference_id'))   dbInstance.exec(`ALTER TABLE inventory_movements ADD COLUMN reference_id TEXT`);
    if (!invMoveCols.some(c => c.name === 'tenant_id'))      dbInstance.exec(`ALTER TABLE inventory_movements ADD COLUMN tenant_id INTEGER DEFAULT 5`);
    
    // CRITICAL FIX: Check if movement_type constraint includes 'sale'
    const tableSql = dbInstance.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='inventory_movements'").get()?.sql || '';
    if (tableSql && !tableSql.includes("'sale'")) {
      console.log('[Database] inventory_movements CHECK constraint is outdated. Correcting...');
      dbInstance.transaction(() => {
        dbInstance.exec(`
          PRAGMA foreign_keys = OFF;
          CREATE TABLE inventory_movements_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              product_id INTEGER NOT NULL,
              movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer', 'sale', 'return')),
              quantity_before REAL NOT NULL,
              quantity_changed REAL NOT NULL,
              quantity_after REAL NOT NULL,
              reference_id TEXT,
              reference_type TEXT,
              status TEXT DEFAULT 'confirmed',
              notes TEXT,
              unit_cost REAL DEFAULT 0,
              total_value REAL DEFAULT 0,
              created_by INTEGER,
              reason TEXT,
              tenant_id INTEGER DEFAULT 5,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
          );
          INSERT INTO inventory_movements_new (
              id, product_id, movement_type, quantity_before, quantity_changed, 
              quantity_after, reference_id, reference_type, status, notes, 
              unit_cost, total_value, created_by, reason, tenant_id, created_at
          )
          SELECT 
              id, product_id, movement_type, quantity_before, quantity_changed, 
              quantity_after, reference_id, reference_type, status, notes, 
              COALESCE(unit_cost, 0), COALESCE(total_value, 0), created_by, reason, COALESCE(tenant_id, 5), created_at
          FROM inventory_movements;
          DROP TABLE inventory_movements;
          ALTER TABLE inventory_movements_new RENAME TO inventory_movements;
          CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
          CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at DESC);
          PRAGMA foreign_keys = ON;
        `);
      })();
    }

    // 3. Sync Backfill & Force Pull logic
    const entitiesToBackfill = [
      { name: 'category', table: 'categories' },
      { name: 'product', table: 'products' },
      { name: 'order', table: 'orders' },
      { name: 'sale', table: 'sales' }
    ];

    const crypto = require('crypto');
    const insertOutbox = dbInstance.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id)
      VALUES (?, ?, 'insert', ?, ?, ?)
    `);

    for (const ent of entitiesToBackfill) {
      // 1. Backfill INSERTS (remote_id IS NULL)
      const pending = dbInstance.prepare(`
        SELECT t.* FROM ${ent.table} t
        WHERE t.remote_id IS NULL
        AND (t.deleted_at IS NULL OR t.deleted_at = '')
        AND NOT EXISTS (SELECT 1 FROM sync_outbox WHERE entity = ? AND record_id = CAST(t.id AS TEXT))
        LIMIT 500
      `).all(ent.name) as any[];

      if (pending.length > 0) {
        console.log(`[Database] Backfilling ${pending.length} ${ent.name} (inserts) into sync_outbox`);
        for (const record of pending) {
          const tid = record.tenant_id || record.business_id;
          if (!tid) continue;
          insertOutbox.run(crypto.randomUUID(), ent.name, 'insert', String(record.id), JSON.stringify(record), tid);

          // Handle children
          if (ent.name === 'sale') {
            const items = dbInstance.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(record.id) as any[];
            for (const it of items) insertOutbox.run(crypto.randomUUID(), 'sale_item', 'insert', String(it.id), JSON.stringify({ ...it, tenant_id: tid }), tid);
          }
          if (ent.name === 'order') {
            const items = dbInstance.prepare('SELECT * FROM order_items WHERE order_id = ?').all(record.id) as any[];
            for (const it of items) insertOutbox.run(crypto.randomUUID(), 'order_item', 'insert', String(it.id), JSON.stringify({ ...it, tenant_id: tid }), tid);
          }
        }
      }

      // 2. Backfill DELETES (deleted_at IS NOT NULL)
      const pendingDeletes = dbInstance.prepare(`
        SELECT t.* FROM ${ent.table} t
        WHERE t.deleted_at IS NOT NULL AND t.deleted_at != ''
        AND NOT EXISTS (SELECT 1 FROM sync_outbox WHERE entity = ? AND record_id = CAST(t.id AS TEXT) AND operation = 'delete')
        LIMIT 500
      `).all(ent.name) as any[];

      if (pendingDeletes.length > 0) {
        console.log(`[Database] Backfilling ${pendingDeletes.length} ${ent.name} (deletes) into sync_outbox`);
        for (const record of pendingDeletes) {
          const tid = record.tenant_id || record.business_id;
          if (!tid) continue;
          insertOutbox.run(crypto.randomUUID(), ent.name, 'delete', String(record.id), JSON.stringify(record), tid);
        }
      }
    }
  } catch (e) {
    console.warn('[Database] ensureAdvancedTables safety check error:', e);
  }

  console.log('[Database] Advanced tables ensured');
}

function ensureTenantSyncColumns(): void {
  if (!dbInstance) return;
  const needsTenants = !dbInstance.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='tenants'").get();
  if (needsTenants) {
    console.log('[Database] Creating tenants table (missing from migrations)');
    dbInstance.exec(`
      CREATE TABLE tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE,
        name TEXT NOT NULL,
        legal_name TEXT,
        owner_email TEXT NOT NULL,
        owner_phone TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        country TEXT NOT NULL DEFAULT 'ZM',
        city TEXT,
        address TEXT,
        logo_url TEXT,
        primary_color TEXT DEFAULT '#D4AF37',
        default_currency TEXT NOT NULL DEFAULT 'ZMW',
        default_locale TEXT NOT NULL DEFAULT 'en',
        timezone TEXT NOT NULL DEFAULT 'Africa/Lusaka',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled','trial')),
        is_provisioned INTEGER NOT NULL DEFAULT 0,
        provisioned_at TEXT,
        internal_notes TEXT,
        remote_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  
    try { dbInstance.prepare(`ALTER TABLE tenants ADD COLUMN remote_id INTEGER`).run(); } catch {}
    try { dbInstance.prepare(`CREATE INDEX IF NOT EXISTS idx_tenants_remote_id ON tenants(remote_id) WHERE remote_id IS NOT NULL`).run(); } catch {}
    try { dbInstance.prepare(`CREATE INDEX IF NOT EXISTS idx_tenants_tenant_id ON tenants(tenant_id)`).run(); } catch {}

    // Align local tenants schema with the Supabase `tenants` table so every
    // column can be synchronized (local-first → Supabase).
    const tenantCols = dbInstance.prepare("PRAGMA table_info(tenants)").all() as Array<{ name: string }>;
    if (!tenantCols.some(c => c.name === 'tenant_id')) dbInstance.exec(`ALTER TABLE tenants ADD COLUMN tenant_id TEXT`);
    if (!tenantCols.some(c => c.name === 'suspended_at')) dbInstance.exec(`ALTER TABLE tenants ADD COLUMN suspended_at TEXT`);
    if (!tenantCols.some(c => c.name === 'suspension_reason')) dbInstance.exec(`ALTER TABLE tenants ADD COLUMN suspension_reason TEXT`);
    if (!tenantCols.some(c => c.name === 'suspended_by')) dbInstance.exec(`ALTER TABLE tenants ADD COLUMN suspended_by INTEGER`);
    if (!tenantCols.some(c => c.name === 'last_reactivated_at')) dbInstance.exec(`ALTER TABLE tenants ADD COLUMN last_reactivated_at TEXT`);
    if (!tenantCols.some(c => c.name === 'last_reactivated_by')) dbInstance.exec(`ALTER TABLE tenants ADD COLUMN last_reactivated_by INTEGER`);
    if (!tenantCols.some(c => c.name === 'disabled_at')) dbInstance.exec(`ALTER TABLE tenants ADD COLUMN disabled_at TEXT`);
    if (!tenantCols.some(c => c.name === 'disabled_by')) dbInstance.exec(`ALTER TABLE tenants ADD COLUMN disabled_by INTEGER`);

  const needsTenantUsers = !dbInstance.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='tenant_users'").get();
  if (needsTenantUsers) {
    console.log('[Database] Creating tenant_users table (missing from migrations)');
    dbInstance.exec(`
      CREATE TABLE tenant_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'waiter' CHECK (role IN ('owner','admin','manager','cashier','waiter')),
        is_default INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        invited_at TEXT,
        joined_at TEXT,
        remote_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, user_id)
      )
    `);
  }

  // Relax the tenant_users role CHECK to include 'staff' (matches Supabase).
  // The original CHECK omitted 'staff', which broke the auto-backfill
  // (ensureIntegrity inserts role='staff') and the pull of Supabase rows.
  const tuSql = dbInstance.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tenant_users'").get()?.sql || '';
  if (tuSql && !tuSql.includes("'staff'")) {
    console.log('[Database] Relaxing tenant_users role CHECK to include staff');
    dbInstance.transaction(() => {
      dbInstance.exec(`
        CREATE TABLE tenant_users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL DEFAULT 'waiter' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff')),
          is_default INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          invited_at TEXT,
          joined_at TEXT,
          remote_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(tenant_id, user_id)
        )
      `);
      dbInstance.exec(`INSERT INTO tenant_users_new (id, tenant_id, user_id, role, is_default, is_active, invited_at, joined_at, remote_id, created_at, updated_at) SELECT id, tenant_id, user_id, role, is_default, is_active, invited_at, joined_at, remote_id, created_at, updated_at FROM tenant_users`);
      dbInstance.exec(`DROP TABLE tenant_users`);
      dbInstance.exec(`ALTER TABLE tenant_users_new RENAME TO tenant_users`);
      dbInstance.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_users_remote_id ON tenant_users(remote_id) WHERE remote_id IS NOT NULL`);
      dbInstance.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id)`);
    })();
  }

  try { dbInstance.prepare(`ALTER TABLE tenant_users ADD COLUMN remote_id INTEGER`).run(); } catch {}
  try { dbInstance.prepare(`CREATE INDEX IF NOT EXISTS idx_tenant_users_remote_id ON tenant_users(remote_id) WHERE remote_id IS NOT NULL`).run(); } catch {}
  try { dbInstance.prepare(`CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id)`).run(); } catch {}
}

function seedAdmin(): void {
  if (!dbInstance) return;
  dbInstance.prepare(`
    INSERT INTO users (full_name, username, pin_code, role, is_active)
    SELECT 'Administrator', 'admin', '1234', 'admin', 1
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')
  `).run();
}

function seedManager(): void {
  if (!dbInstance) return;
  dbInstance.prepare(`
    INSERT INTO users (full_name, username, pin_code, role, is_active)
    SELECT 'Manager', 'manager', '5678', 'manager', 1
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'manager')
  `).run();
}

function seedWaiter(): void {
  if (!dbInstance) return;
  dbInstance.prepare(`
    INSERT INTO users (full_name, username, pin_code, role, is_active)
    SELECT 'Waiter', 'waiter', '1111', 'waiter', 1
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'waiter')
  `).run();
}

function seedCashier(): void {
  if (!dbInstance) return;
  dbInstance.prepare(`
    INSERT INTO users (full_name, username, pin_code, role, is_active)
    SELECT 'Cashier', 'cashier', '2222', 'cashier', 1
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'cashier')
  `).run();
}

function seedTables(): void {
  if (!dbInstance) return;
  const { count } = dbInstance.prepare(`
    SELECT COUNT(*) AS count FROM restaurant_tables
  `).get() as { count: number };

  if (count === 0) {
    const stmt = dbInstance.prepare(`
      INSERT INTO restaurant_tables (table_number, capacity, tenant_id) VALUES (?, 4, 1)
    `);
    ['T1', 'T2', 'T3', 'T4', 'T5', 'Bar 1', 'Bar 2'].forEach(n => stmt.run(n));
  } else {
    // Ensure existing tables have tenant_id set to 1 (default tenant)
    dbInstance.prepare(`UPDATE restaurant_tables SET tenant_id = 1 WHERE tenant_id IS NULL`).run();
  }
}

function seedCategories(): void {
  if (!dbInstance) return;
  const { count } = dbInstance.prepare(`
    SELECT COUNT(*) AS count FROM categories
  `).get() as { count: number };

  if (count === 0) {
    const seedData = [
      ['Beers',       'Alcoholic beverages — beers'],
      ['Wines',       'Alcoholic beverages — wines'],
      ['Whisky',      'Alcoholic beverages — whisky'],
      ['Soft Drinks', 'Non-alcoholic beverages'],
      ['Cocktails',   'Mixed alcoholic drinks'],
      ['Food',        'Restaurant food items'],
    ];
    const stmt = dbInstance.prepare(`
      INSERT INTO categories (name, description, tenant_id) VALUES (?, ?, 1)
    `);
    for (const [name, desc] of seedData) stmt.run(name, desc);
  } else {
    // Ensure existing categories have tenant_id set
    dbInstance.prepare(`UPDATE categories SET tenant_id = 1 WHERE tenant_id IS NULL`).run();
  }
}

function seedProducts(): void {
  if (!dbInstance) return;
  const { count } = dbInstance.prepare(`
    SELECT COUNT(*) AS count FROM products
  `).get() as { count: number };

  if (count === 0) {
    const catStmt = dbInstance.prepare('SELECT id, name FROM categories');
    const categories = catStmt.all() as Array<{ id: number; name: string }>;
    
    const products = [
      { name: 'Mosi', selling_price: 23.0, category: 'Beers', unit: 'bottle', stock_quantity: 10 },
      { name: 'Castle Lite', selling_price: 36.0, category: 'Beers', unit: 'bottle', stock_quantity: 10 },
      { name: 'Hunters', selling_price: 30.0, category: 'Beers', unit: 'bottle', stock_quantity: 10 },
      { name: 'Budweiser', selling_price: 40.0, category: 'Beers', unit: 'bottle', stock_quantity: 10 },
      { name: 'Coc Cola', selling_price: 15.0, category: 'Soft Drinks', unit: 'bottle', stock_quantity: 10 },
      { name: 'Fanta Orange', selling_price: 15.0, category: 'Soft Drinks', unit: 'bottle', stock_quantity: 10 },
      { name: 'Sprite', selling_price: 15.0, category: 'Soft Drinks', unit: 'bottle', stock_quantity: 10 },
      { name: 'Water Bottle', selling_price: 5.0, category: 'Soft Drinks', unit: 'bottle', stock_quantity: 10 },
    ];

    const stmt = dbInstance.prepare(`
      INSERT INTO products (category_id, name, selling_price, buying_price, stock_quantity, minimum_stock, is_available, description, unit, price, updated_at, tenant_id)
      VALUES (?, ?, ?, ?, ?, 5, 1, '', ?, ?, '1970-01-01 00:00:00', 1)
    `);
    
    for (const p of products) {
      const cat = categories.find(c => c.name === p.category);
      stmt.run(cat?.id || 1, p.name, p.selling_price, p.selling_price * 0.7, p.stock_quantity, p.unit || 'bottle', p.selling_price);
    }
    console.log(`[Database] Seeded ${products.length} products with past updated_at`);
  } else {
    // Ensure existing products have tenant_id set
    dbInstance.prepare(`UPDATE products SET tenant_id = 1 WHERE tenant_id IS NULL`).run();
  }
}

/**
 * Idempotent: désactive les produits "demo/test" pour éviter d'afficher
 * des items fictifs ("Just for test", etc.) dans le menu QR.
 */
function disableDemoTestProducts(): void {
  if (!dbInstance) return;
  try {
    const stmt = dbInstance.prepare(`
      UPDATE products
      SET is_available = 0
      WHERE
        status = 'active'
        AND is_available = 1
        AND (
          lower(name) LIKE '%test%'
          OR lower(description) LIKE '%test%'
          OR lower(name) LIKE '%demo%'
          OR lower(description) LIKE '%demo%'
        )
    `);

    const info = stmt.run() as any;
    // better-sqlite3 exposes changes on result
    const changes = typeof info?.changes === 'number' ? info.changes : 0;
    if (changes > 0) {
      console.log(`[Database] Disabled demo/test products in products.is_available (rows: ${changes})`);
    }
  } catch (e) {
    console.error('[disableDemoTestProducts] error:', e);
  }
}

function seedSettings(): void {
  if (!dbInstance) return;
  const rows = dbInstance.prepare(`
    SELECT COUNT(*) AS count FROM settings
  `).get() as { count: number };

  if (rows.count > 0) return;   // already seeded

  const defaults: Array<{ key: string; value: string }> = [
    { key: 'app_language',                   value: 'en' },
    { key: 'app_currency',                   value: 'ZMW' },
    { key: 'currency_symbol',                value: 'ZK' },
    { key: 'tax_percentage',                 value: '0' },
    { key: 'offline_mode',                   value: 'true' },
    // Notifications (real Gmail delivery)
    { key: 'email_notifications_enabled',    value: 'true' },
    { key: 'email_provider',                 value: 'gmail' },
    { key: 'smtp_host',                      value: 'smtp.gmail.com' },
    { key: 'smtp_port',                      value: '587' },
    { key: 'smtp_secure',                    value: 'false' },
    { key: 'smtp_user',                      value: 'afcodenet@gmail.com' },
    { key: 'smtp_pass',                      value: 'mqiu vnjq ejmj cncs' },
    { key: 'email_forward_to',               value: '' },
    { key: 'notify_stock_adjustment',        value: 'true' },
    { key: 'notify_inventory_update',        value: 'true' },
    { key: 'notify_low_stock',               value: 'true' },
    { key: 'notify_out_of_stock',            value: 'true' },
    { key: 'notify_new_product',             value: 'true' },
    { key: 'notify_product_deleted',         value: 'true' },
    { key: 'notify_sales',                   value: 'true' },
    { key: 'role_notification_config',       value: JSON.stringify({
      ADMIN:   { notifications: { lowStock: true, inventory: true, stockAdj: true, sales: true, newProduct: true }, emails: ['admin@olive.com'] },
      MANAGER: { notifications: { lowStock: true, inventory: true, stockAdj: true, sales: true }, emails: [] },
      CASHIER: { notifications: { sales: true, orderConfirm: true }, emails: [] },
      SERVER:  { notifications: { sales: true, orderConfirm: true }, emails: [] },
    }) },
  ];
  const stmt = dbInstance.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);
  for (const s of defaults) stmt.run(s.key, s.value);
}

function seedMenuSchema(): void {
  if (!dbInstance) return;
  // Seed minimal des menus pour que le QR menu ait du contenu tout de suite.
  // Idempotent et auto-réparateur : insère les items manquants par catégorie.
  try {
    const { c: catCount } = dbInstance.prepare(`SELECT COUNT(*) as c FROM menu_categories`).get() as { c: number };
    if (catCount === 0) {
      const categories = [
        { name: 'Food', description: 'Restaurant food', display_order: 0 },
        { name: 'Drinks', description: 'Beverages', display_order: 1 },
      ];
      const stmt = dbInstance.prepare(`
        INSERT INTO menu_categories (name, description, display_order, is_active)
        VALUES (?, ?, ?, 1)
      `);
      for (const cat of categories) stmt.run(cat.name, cat.description, cat.display_order);
    }

    const foodCatId = dbInstance
      .prepare(`SELECT id FROM menu_categories WHERE name = 'Food' LIMIT 1`)
      .get() as any;
    const drinksCatId = dbInstance
      .prepare(`SELECT id FROM menu_categories WHERE name = 'Drinks' LIMIT 1`)
      .get() as any;

    const resolvedFoodId = foodCatId?.id ?? null;
    const resolvedDrinksId = drinksCatId?.id ?? null;

    const insertItemStmt = dbInstance.prepare(`
      INSERT INTO menu_items (category_id, name, description, price, currency, unit, image_url, is_available, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const ensureCategoryItems = (categoryId: number | null, items: Array<{
      name: string;
      description: string;
      price: number;
      display_order: number;
    }>) => {
      if (!categoryId) return;

      const { c: cnt } = dbInstance
        .prepare(`SELECT COUNT(*) as c FROM menu_items WHERE category_id = ?`)
        .get(categoryId) as { c: number };

      if (cnt > 0) return;

      for (const it of items) {
        insertItemStmt.run(
          categoryId,
          it.name,
          it.description,
          it.price,
          'ZMW',
          'pcs',
          null,
          it.display_order
        );
      }
    };

    ensureCategoryItems(resolvedFoodId, [
      { name: 'Chicken Burger', description: 'Tasty chicken burger', price: 50, display_order: 0 },
      { name: 'Beef Burger', description: 'Juicy beef burger', price: 65, display_order: 1 },
      { name: 'Fried Rice', description: 'Classic fried rice', price: 45, display_order: 2 },
    ]);

    ensureCategoryItems(resolvedDrinksId, [
      { name: 'Mango Juice', description: 'Fresh mango juice', price: 25, display_order: 0 },
      { name: 'Water', description: 'Bottled water', price: 10, display_order: 1 },
      { name: 'Coke', description: 'Cold soft drink', price: 15, display_order: 2 },
    ]);
  } catch (e) {
    console.error('[seedMenuSchema] error', e);
  }
}

function ensureEmailSettingsDefaults(): void {
  if (!dbInstance) return;
  const defaults: Array<{ key: string; value: string }> = [
    { key: 'email_notifications_enabled',    value: 'true' },
    { key: 'email_provider',                 value: 'gmail' },
    { key: 'smtp_host',                      value: 'smtp.gmail.com' },
    { key: 'smtp_port',                      value: '587' },
    { key: 'smtp_secure',                    value: 'false' },
    { key: 'smtp_user',                      value: 'afcodenet@gmail.com' },
    { key: 'smtp_pass',                      value: 'mqiu vnjq ejmj cncs' },
    { key: 'email_forward_to',               value: '' },
    { key: 'notify_stock_adjustment',        value: 'true' },
    { key: 'notify_inventory_update',        value: 'true' },
    { key: 'notify_low_stock',               value: 'true' },
    { key: 'notify_out_of_stock',            value: 'true' },
    { key: 'notify_new_product',             value: 'true' },
    { key: 'notify_product_deleted',         value: 'true' },
    { key: 'notify_sales',                   value: 'true' },
  ];
  const stmt = dbInstance.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);
  for (const s of defaults) stmt.run(s.key, s.value);
}

// ── Analytics Performance Indexes ─────────────────────────────────────────────
function createAnalyticsIndexes() {
  if (!dbInstance) return;
  dbInstance.exec(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
  `);
}

// ── Phase 3: Notifications Tables (SQLite + Supabase compatible) ───────────────
function ensureNotificationTables(): void {
  if (!dbInstance) return;
  try {
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id                  TEXT PRIMARY KEY,
        type                TEXT NOT NULL,
        title               TEXT NOT NULL,
        message             TEXT NOT NULL,
        priority            TEXT NOT NULL DEFAULT 'medium',
        notification_type   TEXT,
        metadata            TEXT,
        link                TEXT,
        user_id             INTEGER,
        role                TEXT,
        read_at             DATETIME,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role);
      CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(read_at) WHERE read_at IS NULL;

      CREATE TABLE IF NOT EXISTS notification_preferences (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id             INTEGER,
        role                TEXT NOT NULL,
        email_enabled       BOOLEAN DEFAULT 1,
        inapp_enabled       BOOLEAN DEFAULT 1,
        qr_orders           BOOLEAN DEFAULT 1,
        stock_alerts        BOOLEAN DEFAULT 1,
        daily_reports       BOOLEAN DEFAULT 1,
        inventory_summary   BOOLEAN DEFAULT 1,
        payment_failed      BOOLEAN DEFAULT 1,
        order_assigned      BOOLEAN DEFAULT 1,
        system_errors       BOOLEAN DEFAULT 1,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role, user_id)
      );

      CREATE TABLE IF NOT EXISTS scheduled_reports_log (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        report_type         TEXT NOT NULL,
        run_at              DATETIME NOT NULL,
        recipients_count    INTEGER DEFAULT 0,
        success             BOOLEAN DEFAULT 0,
        error_message       TEXT,
        metadata            TEXT,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_scheduled_reports_run ON scheduled_reports_log(run_at DESC);
      CREATE INDEX IF NOT EXISTS idx_scheduled_reports_type ON scheduled_reports_log(report_type);
    `);

    // Default preferences for roles (idempotent)
    const roles = ['admin', 'manager', 'cashier', 'waiter'];
    const insertPref = dbInstance.prepare(`
      INSERT OR IGNORE INTO notification_preferences (role) VALUES (?)
    `);
    roles.forEach(r => insertPref.run(r));

    console.log('[Database] Notification tables ensured (Phase 3)');
  } catch (e: any) {
    console.warn('[Database] Failed to ensure notification tables:', e.message);
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Export
// ───────────────────────────────────────────────────────────────────────────────

export default callableDb;
