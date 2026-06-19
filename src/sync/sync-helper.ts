/**
 * src/sync/sync-helper.ts
 * Helper utilitaire pour ajouter l'outbox dans les routes existantes.
 * Permet d'ajouter la synchronisation sans modifier la logique métier.
 */
import type Database from 'better-sqlite3';
import { getEntityDef } from './core/entity-registry';

let outboxDb: Database.Database | null = null;

export function setOutboxDatabase(db: Database.Database) {
  outboxDb = db;
}

/**
 * Queue un changement dans l'outbox pour synchronisation vers Supabase.
 * À appeler APRÈS l'insert/update/delete local réussi.
 * 
 * Usage dans les routes:
 *   const result = db.prepare(`INSERT INTO expenses ...`).run(...);
 *   queueSyncChange('expense', 'insert', { id: result.lastInsertRowid, ...req.body, tenant_id: tenantId });
 */
export function queueSyncChange(
  entity: string,
  operation: 'insert' | 'update' | 'delete',
  record: any
) {
  if (!outboxDb) return;

  const def = getEntityDef(entity);
  if (!def) {
    console.warn(`[SyncHelper] Unknown entity "${entity}"`);
    return;
  }

  try {
    const id = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
    const payload = JSON.stringify(record);
    const version = record.version || 1;
    const tenantIdRaw = record.tenant_id !== undefined ? record.tenant_id : null;
    const tenantId = (tenantIdRaw !== null && tenantIdRaw !== '') ? parseInt(String(tenantIdRaw), 10) : null;

    outboxDb.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, entity, operation, String(record.id), payload, version, tenantId);
  } catch (err: any) {
    console.warn(`[SyncHelper] Failed to queue ${entity} ${operation} #${record.id}:`, err?.message || err);
  }
}

/**
 * Helper pour ajouter l'outbox dans les routes POST/PATCH/DELETE.
 * Exemple:
 *   const expense = { id: result.lastInsertRowid, description, amount, category, user_id, tenant_id: tenantId };
 *   syncAfterWrite('expense', 'insert', expense);
 */
export function syncAfterWrite(
  entity: string,
  operation: 'insert' | 'update' | 'delete',
  record: any
) {
  // Utiliser setImmediate pour ne pas bloquer la réponse HTTP
  setImmediate(() => {
    queueSyncChange(entity, operation, record);
  });
}

export default { setOutboxDatabase, queueSyncChange, syncAfterWrite };