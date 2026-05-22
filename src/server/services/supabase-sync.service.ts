/**
 * Supabase Sync Service (Version Incrémentale)
 *
 * L'application reste 100% sur SQLite comme source de vérité.
 * Toutes les X minutes (si internet), on pousse UNIQUEMENT les modifications
 * vers Supabase (synchronisation incrémentale).
 */

import { db } from '../db/database';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import https from 'https';

interface SyncConfig {
  enabled: boolean;
  intervalMs: number;
  onStartup: boolean;
  maxRetries: number;
  timeoutMs: number;
}

let supabase: SupabaseClient | null = null;
let syncInterval: NodeJS.Timeout | null = null;
let isSyncing = false;

const DEFAULT_TABLES_TO_SYNC = [
  'users',
  'categories',
  'products',
  'restaurant_tables',
  'menu_categories',
  'menu_items',
  'customers',
  'orders',
  'order_items',
  'sales',
  'sale_items',
  'settings',
  'inventory_movements',
];

// Tables qui ont un updated_at (sinon on utilise created_at)
const TABLES_WITH_UPDATED_AT = new Set([
  'users', 'products', 'restaurant_tables', 'menu_categories', 'menu_items',
  'customers', 'orders', 'sales', 'settings', 'inventory_movements'
]);

function getConfig(): SyncConfig {
  return {
    enabled: process.env.ENABLE_SUPABASE_SYNC === 'true',
    intervalMs: parseInt(process.env.SUPABASE_SYNC_INTERVAL_MS || '60000', 10),
    onStartup: process.env.SUPABASE_SYNC_ON_STARTUP === 'true',
    maxRetries: parseInt(process.env.SUPABASE_SYNC_MAX_RETRIES || '5', 10),
    timeoutMs: parseInt(process.env.SUPABASE_SYNC_TIMEOUT_MS || '120000', 10),
  };
}

function getSupabaseClient(): SupabaseClient {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('[SupabaseSync] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY manquant');
  }

  supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return supabase;
}

async function isOnline(): Promise<boolean> {
  return new Promise((resolve) => {
    https.get('https://www.google.com', { timeout: 5000 }, () => resolve(true))
      .on('error', () => resolve(false));
  });
}

/**
 * Récupère la dernière date de synchronisation réussie
 */
function getLastSyncTime(): string | null {
  try {
    const row = db.prepare(`
      SELECT value FROM sync_metadata WHERE key = 'last_supabase_sync'
    `).get() as { value: string } | undefined;

    return row?.value || null;
  } catch {
    return null;
  }
}

/**
 * Met à jour la date de dernière synchronisation
 */
function updateLastSyncTime(isoDate: string) {
  db.prepare(`
    INSERT INTO sync_metadata (key, value, updated_at)
    VALUES ('last_supabase_sync', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(isoDate);
}

/**
 * Détermine la colonne de date à utiliser pour une table
 */
function getTimestampColumn(tableName: string): string {
  return TABLES_WITH_UPDATED_AT.has(tableName) ? 'updated_at' : 'created_at';
}

async function syncTableIncremental(tableName: string, since: string | null): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const timestampCol = getTimestampColumn(tableName);

    let query = `SELECT * FROM ${tableName}`;
    const params: any[] = [];

    if (since) {
      query += ` WHERE ${timestampCol} > ?`;
      params.push(since);
    }

    // On trie par date pour avoir un ordre cohérent
    query += ` ORDER BY ${timestampCol} ASC`;

    const rows = db.prepare(query).all(...params);

    if (rows.length === 0) {
      return { success: true, count: 0 };
    }

    const client = getSupabaseClient();

    const { error } = await client
      .from(tableName)
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: rows.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

export async function runSupabaseSync(): Promise<void> {
  const config = getConfig();

  if (!config.enabled) return;
  if (isSyncing) return;

  const online = await isOnline();
  if (!online) {
    console.log('[SupabaseSync] Pas de connexion internet. Synchronisation ignorée.');
    return;
  }

  isSyncing = true;
  const startTime = Date.now();

  const lastSync = getLastSyncTime();
  const syncMode = lastSync ? 'INCRÉMENTAL' : 'COMPLET (première fois)';

  console.log(`[SupabaseSync] Démarrage (${syncMode})...`);

  let totalSynced = 0;
  let failedTables = 0;

  for (const table of DEFAULT_TABLES_TO_SYNC) {
    try {
      const result = await syncTableIncremental(table, lastSync);

      if (result.success) {
        totalSynced += result.count;
        if (result.count > 0) {
          console.log(`[SupabaseSync] ✓ ${table}: ${result.count} enregistrement(s) synchronisé(s)`);
        }
      } else {
        failedTables++;
        console.error(`[SupabaseSync] ✗ ${table}: ${result.error}`);
      }
    } catch (err: any) {
      failedTables++;
      console.error(`[SupabaseSync] Erreur sur ${table}:`, err.message);
    }
  }

  // On met à jour la date de dernière synchro uniquement si tout s'est bien passé
  if (failedTables === 0) {
    const now = new Date().toISOString();
    updateLastSyncTime(now);
    console.log(`[SupabaseSync] Date de dernière synchro mise à jour → ${now}`);
  } else {
    console.warn(`[SupabaseSync] Synchronisation partielle (${failedTables} table(s) en échec). Date non mise à jour.`);
  }

  const duration = Date.now() - startTime;
  console.log(`[SupabaseSync] Terminé en ${duration}ms. Total synchronisé: ${totalSynced}. Échecs: ${failedTables}`);

  isSyncing = false;
}

export function startSupabaseSyncScheduler(): void {
  const config = getConfig();

  if (!config.enabled) {
    console.log('[SupabaseSync] Synchronisation désactivée.');
    return;
  }

  if (config.onStartup) {
    setTimeout(() => runSupabaseSync().catch(console.error), 8000);
  }

  if (syncInterval) clearInterval(syncInterval);

  syncInterval = setInterval(() => {
    runSupabaseSync().catch(console.error);
  }, config.intervalMs);

  console.log(`[SupabaseSync] Scheduler démarré (toutes les ${config.intervalMs / 1000}s)`);
}

export function stopSupabaseSyncScheduler(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[SupabaseSync] Scheduler arrêté.');
  }
}
