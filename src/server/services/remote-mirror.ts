/**
 * src/server/services/remote-mirror.ts
 *
 * Miroir bidirectionnel AUTONOME Supabase → SQLite, réutilisable par TOUTES les
 * routes/services en mode cloud (OrderService, TableService, ProductRepository,
 * menu/checkout QR, …).
 *
 * ⚠️ Conçu pour ne PAS dépendre de l'orchestrateur de sync : il écrit directement
 * dans la SQLite locale en s'appuyant sur le registre d'entités (allowedFields,
 * foreignKeys, jsonFields) + le ConflictResolver. Ainsi, même si le moteur de
 * synchronisation n'est pas démarré (ex. mode cloud sans scheduler), le miroir
 * fonctionne et la commande apparaît immédiatement en SQLite.
 *
 * Idempotent : clé par `remote_id`. Résout les FK (remote_id → id local, sinon
 * NULL) pour ne jamais violer les contraintes SQLite. Journalise les conflits
 * (LWW versionné) dans `sync_conflicts`. Défensif : no-op si SQLite indisponible
 * (ex. RENDER_CLOUD_MODE) ou si la ligne distante ne peut être résolue.
 */

import db from '../db/database';
import { getEntityDef, type SyncEntityDefinition } from '../../sync/core/entity-registry';
import { ConflictResolver } from '../../sync/core/conflict-resolver';

const IS_RENDER_CLOUD =
  process.env.RENDER_CLOUD_MODE === 'true' || process.env.RENDER_CLOUD_MODE === '1';

function localDb(): any {
  if (IS_RENDER_CLOUD) return null; // Pas de SQLite sur le backend cloud public
  try {
    return db && typeof db.prepare === 'function' ? db : null;
  } catch {
    return null;
  }
}

/** Résout un remote_id (ou id direct) vers un id local, sinon null. */
function resolveLocalId(database: any, table: string, remoteId: any): number | null {
  if (remoteId === null || remoteId === undefined) return null;
  try {
    const byRemote = database.prepare(`SELECT id FROM ${table} WHERE remote_id = ?`).get(remoteId) as { id: number } | undefined;
    if (byRemote) return byRemote.id;
    const byDirect = database.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(remoteId) as { id: number } | undefined;
    return byDirect ? byDirect.id : null;
  } catch {
    return null;
  }
}

function sanitize(val: any): any {
  if (val === undefined || val === null) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

export interface MirrorResult {
  applied: boolean;
  localId?: number;
  conflictLogged?: boolean;
}

/**
 * Réplique (upsert) une ligne distante dans la SQLite locale, sans dépendre du
 * moteur de sync. Gère la cascade `order` → `order_item`.
 */
export function mirrorRemoteRecord(
  tenantId: number | string,
  entity: string,
  remoteRow: any,
  relatedItems?: any[]
): MirrorResult {
  const database = localDb();
  const def: SyncEntityDefinition | undefined = getEntityDef(entity);
  if (!database || !def || !remoteRow || remoteRow.id == null) return { applied: false };

  const remoteId = Number(remoteRow.id);
  if (isNaN(remoteId)) return { applied: false };

  try {
    const conflictResolver = new ConflictResolver(database);
    const local = database
      .prepare(`SELECT id, updated_at, created_at, version FROM ${def.localTable} WHERE remote_id = ?`)
      .get(remoteId) as { id: number; updated_at: string; created_at: string; version: number } | undefined;

    // Détection + journalisation de conflit (modification concurrente locale/distante)
    let conflictLogged = false;
    const localTs = (local?.updated_at || local?.created_at) ?? '';
    const remoteTs = (remoteRow.updated_at || remoteRow.created_at) ?? '';
    if (local && local.version) {
      const isConflict = conflictResolver.detectConflict(
        entity, local.id, remoteId, localTs, remoteTs,
        Number(local.version || 1), Number(remoteRow.version || 1)
      );
      if (isConflict) {
        const resolution = conflictResolver.resolveLWW(
          Number(local.version || 1), Number(remoteRow.version || 1), localTs, remoteTs
        );
        conflictResolver.logResolvedConflict(
          { entity, localId: local.id, remoteId },
          entity,
          { version: local.version, updated_at: localTs },
          { version: remoteRow.version, updated_at: remoteTs },
          resolution,
          `Concurrent modification on mirror (local v${local.version} vs remote v${remoteRow.version}) — ${resolution}`
        );
        conflictLogged = true;
      }
    }

    // Construction des champs locaux à partir du registre
    const fields: Record<string, any> = {
      remote_id: remoteId,
      created_at: remoteRow.created_at ? String(remoteRow.created_at) : new Date().toISOString(),
      updated_at: remoteRow.updated_at ? String(remoteRow.updated_at) : new Date().toISOString(),
    };
    if (remoteRow.version !== undefined) fields.version = remoteRow.version;

    for (const field of def.allowedFields) {
      if (['id', 'created_at', 'updated_at', 'remote_id'].includes(field)) continue;
      if (remoteRow[field] !== undefined) fields[field] = remoteRow[field];
    }

    // Résolution des FK (remote_id → id local, sinon NULL)
    if (def.foreignKeys) {
      for (const [field, targetTable] of Object.entries(def.foreignKeys)) {
        if (fields[field] != null) {
          fields[field] = resolveLocalId(database, String(targetTable), fields[field]) ?? null;
        }
      }
    }

    if (def.hasTenantId && remoteRow.tenant_id !== undefined) fields.tenant_id = remoteRow.tenant_id;
    if (def.jsonFields) {
      for (const field of def.jsonFields) {
        if (fields[field] !== undefined && typeof fields[field] !== 'string') {
          fields[field] = JSON.stringify(fields[field]);
        }
      }
    }

    const updateKeys = Object.keys(fields);
    const setClauses = updateKeys.map((k) => `"${k}" = ?`).join(', ');
    const params = updateKeys.map((k) => sanitize(fields[k]));

    let localId: number;
    if (local) {
      database.prepare(`UPDATE ${def.localTable} SET ${setClauses} WHERE id = ?`).run(...params, local.id);
      localId = local.id;
    } else {
      const insertKeys = ['id', ...updateKeys];
      const insertParams = [remoteId, ...params];
      const result = database
        .prepare(`INSERT INTO ${def.localTable} (${insertKeys.map((k) => `"${k}"`).join(', ')}) VALUES (${insertKeys.map(() => '?').join(', ')})`)
        .run(...insertParams);
      localId = Number(result.lastInsertRowid);
    }

    // Cascade order → order_item
    if (entity === 'order' && relatedItems && relatedItems.length) {
      for (const item of relatedItems) {
        if (item && item.id != null) {
          mirrorRemoteRecord(tenantId, 'order_item', { ...item, order_id: item.order_id ?? remoteId });
        }
      }
    }

    return { applied: true, localId, conflictLogged };
  } catch (err: any) {
    console.warn(`[RemoteMirror] Failed to mirror "${entity}" #${remoteId}:`, err?.message);
    return { applied: false };
  }
}

/**
 * Supprime la ligne miroir locale correspondant à un id distant.
 */
export function deleteMirroredRecord(tenantId: number | string, entity: string, remoteId: number): void {
  const database = localDb();
  if (!database || remoteId == null) return;
  try {
    const def = getEntityDef(entity);
    const localTable = def?.localTable || `${entity}s`;
    const local = database
      .prepare(`SELECT id FROM ${localTable} WHERE remote_id = ? AND tenant_id = ?`)
      .get(Number(remoteId), Number(tenantId)) as { id: number } | undefined;
    if (!local) return;
    database.prepare(`DELETE FROM ${localTable} WHERE id = ? AND tenant_id = ?`).run(local.id, Number(tenantId));
  } catch (err: any) {
    console.warn(`[RemoteMirror] Failed to delete mirrored "${entity}":`, err?.message);
  }
}
