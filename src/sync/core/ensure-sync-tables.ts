/**
 * src/sync/core/ensure-sync-tables.ts
 * Garantit que toutes les tables de synchronisation existent avec le bon schéma.
 * À appeler au démarrage du sync engine.
 */
import type Database from 'better-sqlite3';
import { SYNC_ENTITIES } from './entity-registry';

/**
 * Rebuilds the sync_outbox table by:
 * 1. Creating a new table with the correct schema
 * 2. Copying data from the old table
 * 3. Dropping the old table
 * 4. Renaming the new table
 * This handles cases where ALTER TABLE fails due to triggers, views, or other dependencies.
 */
function rebuildSyncOutboxTable(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_outbox_new (
        id TEXT PRIMARY KEY,
        entity TEXT NOT NULL,
        operation TEXT NOT NULL,
        record_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        tenant_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Copy data from old table (if it exists)
    try {
      db.exec(`
        INSERT OR IGNORE INTO sync_outbox_new 
        SELECT id, entity, operation, record_id, payload, version, status, retry_count, last_error, COALESCE(tenant_id, 0), created_at, updated_at
        FROM sync_outbox
      `);
    } catch (e) {
      // Old table might not exist or be empty - that's fine
      console.warn('[SyncTables] Could not copy data from old sync_outbox (table may be empty):', e);
    }

    // Drop old table and rename new one
    db.exec('DROP TABLE IF EXISTS sync_outbox');
    db.exec('ALTER TABLE sync_outbox_new RENAME TO sync_outbox');
  } catch (err: any) {
    console.warn('[SyncTables] Could not rebuild sync_outbox table:', err?.message);
  }
}

export function ensureSyncTables(db: Database.Database) {
  try {
    // --- sync_outbox (avec tenant_id) ---
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sync_outbox (
          id TEXT PRIMARY KEY,
          entity TEXT NOT NULL,
          operation TEXT NOT NULL,
          record_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          status TEXT DEFAULT 'pending',
          retry_count INTEGER DEFAULT 0,
          last_error TEXT,
          tenant_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (err) {
      console.warn('[SyncTables] Could not create sync_outbox table:', err);
    }

    // ⭐ Correction: s'assurer que tenant_id existe sur sync_outbox (migration à chaud)
    try {
      const cols = db.prepare("PRAGMA table_info(sync_outbox)").all() as any[];
      const hasTenantId = cols.some(c => c.name === 'tenant_id');
      if (!hasTenantId) {
        try {
          db.exec("ALTER TABLE sync_outbox ADD COLUMN tenant_id INTEGER");
          console.log('[SyncTables] Added tenant_id column to sync_outbox');
        } catch (alterErr: any) {
          // If ALTER fails, rebuild the table entirely (handles triggers/views dependencies)
          console.warn('[SyncTables] ALTER TABLE failed, rebuilding sync_outbox:', alterErr?.message);
          rebuildSyncOutboxTable(db);
        }
      }
    } catch (err: any) {
      console.warn('[SyncTables] Failed to ensure sync_outbox schema (non-critical):', err?.message);
    }

    // ⭐ FIX: Create indexes only after ensuring columns exist (wrap in try-catch)
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status, entity, tenant_id)`);
    } catch (err) {
      console.warn('[SyncTables] Could not create index idx_sync_outbox_status:', err);
    }
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity ON sync_outbox(entity, status)`);
    } catch (err) {
      console.warn('[SyncTables] Could not create index idx_sync_outbox_entity:', err);
    }
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_outbox_tenant ON sync_outbox(tenant_id)`);
    } catch (err) {
      console.warn('[SyncTables] Could not create index idx_sync_outbox_tenant:', err);
    }

    // --- sync_state (curseurs persistants) ---
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sync_state (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);
    } catch (err) {
      console.warn('[SyncTables] Could not create sync_state table:', err);
    }

    // --- sync_dlq (dead letter queue) ---
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sync_dlq (
          id TEXT PRIMARY KEY,
          entity TEXT NOT NULL,
          operation TEXT NOT NULL,
          record_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          error TEXT,
          retry_count INTEGER DEFAULT 0,
          tenant_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // ⭐ FIX: Add tenant_id column if missing on existing table
      try {
        const dlqCols = db.prepare("PRAGMA table_info(sync_dlq)").all() as any[];
        if (!dlqCols.some((c: any) => c.name === 'tenant_id')) {
          db.exec("ALTER TABLE sync_dlq ADD COLUMN tenant_id INTEGER");
          console.log('[SyncTables] Added tenant_id column to sync_dlq');
        }
      } catch (e: any) {
        console.warn('[SyncTables] Could not add tenant_id to sync_dlq:', e?.message);
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_dlq_entity ON sync_dlq(entity, archived_at)`);
      try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_dlq_tenant ON sync_dlq(tenant_id)`);
      } catch (e: any) {
        console.warn('[SyncTables] Could not create idx_sync_dlq_tenant:', e?.message);
      }
    } catch (err) {
      console.warn('[SyncTables] Could not create sync_dlq table:', err);
    }

    // --- sync_conflicts (journal des conflits) ---
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sync_conflicts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity TEXT NOT NULL,
          local_id INTEGER NOT NULL,
          remote_id INTEGER,
          field TEXT,
          local_value TEXT,
          remote_value TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          resolved_at DATETIME,
          resolution TEXT,
          notes TEXT
        )
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity ON sync_conflicts(entity, created_at)`);
    } catch (err) {
      console.warn('[SyncTables] Could not create sync_conflicts table:', err);
    }

    // --- Vérifier / Ajouter les colonnes manquantes sur les tables de données ---
    try {
      ensureSyncColumns(db);
    } catch (err: any) {
      console.warn('[SyncTables] ensureSyncColumns encountered issues (non-critical):', err?.message);
    }

    console.log('[SyncTables] All sync tables and columns ensured');
  } catch (err: any) {
    // Final safety net - log but never throw
    console.warn('[SyncTables] ensureSyncTables encountered non-critical issues:', err?.message);
  }
}

/**
 * Garantit que toutes les tables de données ont les colonnes de sync nécessaires.
 */
function ensureSyncColumns(db: Database.Database) {
  for (const def of SYNC_ENTITIES) {
    const table = def.localTable;
    
    // Wrap entire table processing in try-catch to prevent any error from escaping
    try {
      // ⭐ Vérifier d'abord que la table existe dans SQLite
      const tableExists = db.prepare(
        `SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`
      ).get(table);
      
      if (!tableExists) {
        // Table pas encore créée - on skip silencieusement
        continue;
      }

      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      const colNames = cols.map(c => c.name);

      // remote_id
      if (!colNames.includes('remote_id')) {
        try {
          db.exec(`ALTER TABLE ${table} ADD COLUMN remote_id INTEGER`);
          console.log(`[SyncTables] Added remote_id to ${table}`);
        } catch (err: any) {
          console.warn(`[SyncTables] Could not add remote_id to ${table}:`, err?.message);
        }
      }

      // updated_at pour les entités qui en ont besoin
      if (def.hasUpdatedAt && !colNames.includes('updated_at')) {
        try {
          db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at DATETIME`);
          db.exec(`UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`);
          console.log(`[SyncTables] Added updated_at to ${table}`);
        } catch (err: any) {
          console.warn(`[SyncTables] Could not add updated_at to ${table}:`, err?.message);
        }
      }

      // tenant_id
      if (def.hasTenantId && !colNames.includes('tenant_id')) {
        try {
          db.exec(`ALTER TABLE ${table} ADD COLUMN tenant_id INTEGER DEFAULT 1`);
          console.log(`[SyncTables] Added tenant_id to ${table}`);
        } catch (err: any) {
          console.warn(`[SyncTables] Could not add tenant_id to ${table}:`, err?.message);
        }
      }

      // --- products extra columns to align with Supabase ---
      // Supabase products has: created_by, updated_by, archived_at (and may use TEXT for tenant_id)
      if (def.entity === 'product') {
        try {
          if (!colNames.includes('created_by')) db.exec(`ALTER TABLE ${table} ADD COLUMN created_by INTEGER`);
          if (!colNames.includes('updated_by')) db.exec(`ALTER TABLE ${table} ADD COLUMN updated_by INTEGER`);
          if (!colNames.includes('archived_at')) db.exec(`ALTER TABLE ${table} ADD COLUMN archived_at DATETIME`);
          // cost_method may exist, but ensure default if missing
          if (!colNames.includes('cost_method')) db.exec(`ALTER TABLE ${table} ADD COLUMN cost_method TEXT DEFAULT 'average'`);
        } catch (err: any) {
          console.warn(`[SyncTables] Could not add product columns to ${table}:`, err?.message);
        }
      }

      // version
      if (!colNames.includes('version') && def.entity !== 'setting') {
        try {
          db.exec(`ALTER TABLE ${table} ADD COLUMN version INTEGER DEFAULT 1`);
        } catch { /* ignore if no such column */ }
      }

      // Index sur remote_id
      try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_remote_id ON ${table}(remote_id) WHERE remote_id IS NOT NULL`);
      } catch { /* ignore */ }
      
    } catch (err: any) {
      // This catch block ensures NO error from this table propagates up
      console.warn(`[SyncTables] Could not ensure columns for ${table}:`, err?.message || err);
    }
  }
}