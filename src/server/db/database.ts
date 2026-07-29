// src/server/db/database.ts (copy for PR artifact)
import path from 'path';
import fs from 'fs';
import { applyAll as runMigrations } from '../infra/migrations/runner';

let Database: any = null;
try {
  Database = require('better-sqlite3');
} catch (e: any) {
  console.warn('[Database] better-sqlite3 native bindings unavailable at require time:', e?.message || e);
  Database = null;
}

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const uploadsDir  = path.resolve(dataDir, 'uploads', 'products');

if (!fs.existsSync(dataDir))    fs.mkdirSync(dataDir,    { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const dbPath = path.join(dataDir, 'database.db');

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

      try {
        const originalExec = dbInstance.exec.bind(dbInstance);
        // @ts-ignore - dynamic patch for runtime resilience
        dbInstance.exec = function (sql: string) {
          try {
            return originalExec(sql);
          } catch (err: any) {
            const msg = err?.message || '';
            if (/ADD COLUMN/i.test(sql) && /CURRENT_TIMESTAMP/i.test(sql) && /non-constant default/i.test(msg)) {
              console.warn('[Database] ALTER TABLE with non-constant default detected. Falling back for SQL:', sql);
              const sqlNoDefault = sql.replace(/\s+DEFAULT\s+CURRENT_TIMESTAMP/ig, '');
              try {
                originalExec(sqlNoDefault);
                const colMatch = sqlNoDefault.match(/ADD COLUMN\s+([`\"']?)([\w_]+)\1/);
                const tblMatch = sqlNoDefault.match(/ALTER TABLE\s+([`\"']?)([\w_]+)\1/);
                if (colMatch && tblMatch) {
                  const col = colMatch[2];
                  const table = tblMatch[2];
                  originalExec(`UPDATE ${table} SET ${col} = CURRENT_TIMESTAMP WHERE ${col} IS NULL`);
                }
                return;
              } catch (err2: any) {
                console.warn('[Database] Fallback add-column failed:', err2?.message || err2);
                throw err; // rethrow original to be handled by outer catch
              }
            }
            throw err;
          }
        };
      } catch (e: any) {
        console.warn('[Database] exec fallback setup failed:', (e && (e as any).message) || e);
      }
    }
  }
} catch (e: any) {
  console.error('[Database] CRITICAL: Failed to instantiate or configure SQLite (bindings or disk issue):', e?.message || e);
  console.warn('[Database] Continuing in degraded mode with db=null. Supabase-only features may still work if enabled.');
  dbInstance = null;
}

export let db: any = null;

function makeCallable(rawDb: any): any {
  if (!rawDb) return () => ({ first: () => null, all: () => [] });
  const call = ((tableName: string) => ({ all: () => [], first: () => null })) as any;
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

export function queryBuilder(table: string): any { return createQueryBuilder(dbInstance, table); }
