/**
 * src/sync/startup-migration.ts
 * Vérifie et corrige le schéma de la base de données au démarrage.
 * Garantit que toutes les colonnes critiques existent avant toute synchronisation.
 */

import type Database from 'better-sqlite3';
import { ensureSyncTables } from './core/ensure-sync-tables';

export function runStartupMigrations(db: Database.Database): void {
  // ⭐ CRITICAL FIX: Guard against null database (Render cloud mode)
  if (!db) {
    console.warn('[Migration] Skipping startup migrations - database is null (cloud mode)');
    return;
  }

  console.log('[Migration] Running startup migrations...');

  // Étape 1: S'assurer que toutes les tables de sync existent
  try {
    ensureSyncTables(db);
    console.log('[Migration] ✓ Sync tables ensured');
  } catch (err: any) {
    console.error('[Migration] ✗ Failed to ensure sync tables:', err);
    throw new Error(`Database schema initialization failed: ${err?.message}`);
  }

  // Étape 2: Vérifier les colonnes critiques sur les tables principales
  const criticalTables = [
    { table: 'users', columns: ['tenant_id', 'remote_id', 'updated_at'] },
    { table: 'tenants', columns: ['remote_id', 'updated_at'] },
    { table: 'tenant_users', columns: ['tenant_id', 'user_id', 'remote_id', 'updated_at'] },
    { table: 'products', columns: ['tenant_id', 'remote_id', 'updated_at', 'created_by', 'updated_by'] },
    { table: 'orders', columns: ['tenant_id', 'remote_id', 'updated_at'] },
    { table: 'order_items', columns: ['tenant_id', 'remote_id', 'updated_at', 'order_id'] },
    { table: 'categories', columns: ['tenant_id', 'remote_id', 'updated_at'] },
    { table: 'restaurant_tables', columns: ['tenant_id', 'remote_id', 'updated_at'] },
    { table: 'customers', columns: ['tenant_id', 'remote_id', 'updated_at'] },
    { table: 'sales', columns: ['tenant_id', 'remote_id', 'updated_at'] },
    { table: 'expenses', columns: ['tenant_id', 'remote_id'] },
    { table: 'suppliers', columns: ['tenant_id', 'remote_id', 'updated_at'] },
  ];

  let fixedColumns = 0;

  for (const { table, columns } of criticalTables) {
    try {
      // Vérifier que la table existe
      const tableExists = db.prepare(
        `SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`
      ).get(table);

      if (!tableExists) {
        console.warn(`[Migration] ⚠ Table ${table} does not exist yet, skipping column check`);
        continue;
      }

      // Récupérer les colonnes existantes
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      const colNames = cols.map(c => c.name);

      // Ajouter les colonnes manquantes
      for (const col of columns) {
        if (!colNames.includes(col)) {
          try {
            let columnDef = '';

            // Définir le type et les contraintes par colonne
            switch (col) {
              case 'tenant_id':
                columnDef = 'tenant_id INTEGER DEFAULT 1';
                break;
              case 'remote_id':
                columnDef = 'remote_id INTEGER';
                break;
              case 'updated_at':
                columnDef = 'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP';
                break;
              case 'created_by':
                columnDef = 'created_by INTEGER';
                break;
              case 'updated_by':
                columnDef = 'updated_by INTEGER';
                break;
              default:
                columnDef = `${col} TEXT`;
            }

            db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
            console.log(`[Migration] ✓ Added missing column ${col} to ${table}`);
            fixedColumns++;
          } catch (err: any) {
            console.warn(`[Migration] ⚠ Could not add column ${col} to ${table}:`, err?.message);
          }
        }
      }

      // Créer des index sur les colonnes critiques si nécessaire
      try {
        if (colNames.includes('tenant_id')) {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table}(tenant_id)`);
        }
        if (colNames.includes('remote_id')) {
          db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_remote_id ON ${table}(remote_id) WHERE remote_id IS NOT NULL`);
        }
      } catch (err) {
        // Ignore index errors (might already exist)
      }

    } catch (err: any) {
      console.warn(`[Migration] ⚠ Could not verify columns for ${table}:`, err?.message);
    }
  }

  // Étape 3: Normaliser tenant_id dans les tables de sync (corrige les valeurs type "6.0")
  // Certains enregistrements ont été écrits avec un tenant_id flottant/texte (ex: '6.0'),
  // ce qui empêche pushByEntity() de retrouver les pending items.
  try {
    // sync_outbox
    const outboxHas = db.prepare(`
      SELECT 1 FROM sqlite_master WHERE type='table' AND name='sync_outbox'
    `).get();

    if (outboxHas) {
      const updated = db.prepare(`
        UPDATE sync_outbox
        SET tenant_id = CAST(CAST(tenant_id AS REAL) AS INTEGER)
        WHERE CAST(tenant_id AS TEXT) LIKE '%.%'
      `).run().changes;

      if (updated > 0) {
        console.log(`[Migration] ✓ Normalized tenant_id in sync_outbox (${updated} rows)`);
      }
    }

    // sync_dlq
    const dlqHas = db.prepare(`
      SELECT 1 FROM sqlite_master WHERE type='table' AND name='sync_dlq'
    `).get();

    if (dlqHas) {
      const updated = db.prepare(`
        UPDATE sync_dlq
        SET tenant_id = CAST(CAST(tenant_id AS REAL) AS INTEGER)
        WHERE CAST(tenant_id AS TEXT) LIKE '%.%'
      `).run().changes;

      if (updated > 0) {
        console.log(`[Migration] ✓ Normalized tenant_id in sync_dlq (${updated} rows)`);
      }
    }
  } catch (err: any) {
    console.warn('[Migration] ⚠ Could not normalize tenant_id in sync tables:', err?.message);
  }

  // Étape 4: Vérifier et réparer les contraintes d'intégrité
  try {
    repairIntegrityConstraints(db);
    console.log('[Migration] ✓ Integrity constraints verified');
  } catch (err: any) {
    console.warn('[Migration] ⚠ Integrity constraint check failed:', err?.message);
  }

  if (fixedColumns > 0) {
    console.log(`[Migration] ✓ Fixed ${fixedColumns} missing columns`);
  }

  console.log('[Migration] ✓ All startup migrations completed successfully');
}

/**
 * Répare les contraintes d'intégrité critiques
 */
function repairIntegrityConstraints(db: Database.Database): void {
  // Vérifier que tous les users ont un tenant_id
  try {
    const usersWithoutTenant = db.prepare(`
      SELECT COUNT(*) as count FROM users WHERE tenant_id IS NULL
    `).get() as { count: number };

    if (usersWithoutTenant.count > 0) {
      console.warn(`[Migration] Found ${usersWithoutTenant.count} users without tenant_id, fixing...`);
      db.prepare(`
        UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL
      `).run();
    }
  } catch (err) {
    // Table might not exist yet
  }

  // Vérifier que tous les tenant_users ont des tenant_id et user_id valides
  try {
    const orphanTenantUsers = db.prepare(`
      SELECT COUNT(*) as count FROM tenant_users
      WHERE tenant_id IS NULL OR user_id IS NULL
    `).get() as { count: number };

    if (orphanTenantUsers.count > 0) {
      console.warn(`[Migration] Found ${orphanTenantUsers.count} orphan tenant_users, removing...`);
      db.prepare(`
        DELETE FROM tenant_users WHERE tenant_id IS NULL OR user_id IS NULL
      `).run();
    }
  } catch (err) {
    // Table might not exist yet
  }
}