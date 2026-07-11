/**
 * src/server/services/order-local-mirror.ts
 *
 * Miroir bidirectionnel des commandes : replique une commande Supabase (remote)
 * dans la base SQLite locale (et inversement). Utilisé en mode CLOUD pour que
 * les commandes créées côté Supabase soient également visibles dans SQLite, et
 * par le pull générique pour matérialiser les changements distants localement.
 *
 * Propriétés :
 *  - Idempotent : clé par `remote_id`. Un même ordre distant est inséré une
 *    seule fois puis mis à jour.
 *  - Résolution de FK : `table_id`, `waiter_id`, `customer_id`, `product_id`
 *    sont résolus vers leurs IDs locaux via `remote_id` (sinon NULL) pour ne
 *    jamais violer les contraintes SQLite.
 *  - Gestion de conflits : si une ligne locale existe ET diverge du remote
 *    (modification concurrente), le conflit est journalisé dans `sync_conflicts`
 *    (résolution LWW versionnée) via le ConflictResolver existant.
 *  - Défensif : aucun effet de bord si SQLite est indisponible (ex. RENDER_CLOUD_MODE)
 *    ou si la ligne distante ne peut pas être résolue.
 */

import db from '../db/database';
import { ConflictResolver } from '../../sync/core/conflict-resolver';

const IS_RENDER_CLOUD =
  process.env.RENDER_CLOUD_MODE === 'true' || process.env.RENDER_CLOUD_MODE === '1';

function localDb(): any {
  if (IS_RENDER_CLOUD) return null; // Pas de SQLite sur le backend cloud public
  try {
    // `db` peut être null si better-sqlite3 n'a pas pu s'initialiser
    return db && typeof db.prepare === 'function' ? db : null;
  } catch {
    return null;
  }
}

/** Résout un remote_id (ou id direct) vers un id local, sinon null. */
function resolveLocalId(database: any, table: string, remoteId: any): number | null {
  if (remoteId === null || remoteId === undefined) return null;
  try {
    const byRemote = database
      .prepare(`SELECT id FROM ${table} WHERE remote_id = ?`)
      .get(remoteId) as { id: number } | undefined;
    if (byRemote) return byRemote.id;

    const byDirect = database
      .prepare(`SELECT id FROM ${table} WHERE id = ?`)
      .get(remoteId) as { id: number } | undefined;
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
  localOrderId?: number;
  conflictLogged?: boolean;
}

/**
 * Réplique (upsert) une commande distante dans la SQLite locale.
 * @param tenantId  ID du tenant (numérique)
 * @param remote    Ligne `orders` telle que retournée par Supabase (doit contenir `id`)
 * @param remoteItems Optionnel : lignes `order_items` distantes (sinon lu depuis remote.items)
 */
export function mirrorRemoteOrderToLocal(
  tenantId: number,
  remote: any,
  remoteItems?: any[]
): MirrorResult {
  const database = localDb();
  if (!database || !remote || remote.id == null) {
    return { applied: false };
  }

  try {
    const conflictResolver = new ConflictResolver(database);
    const remoteId = Number(remote.id);

    // 1. Résolution de la ligne locale existante (par remote_id, fallback id direct)
    const local = database
      .prepare('SELECT id, updated_at, version FROM orders WHERE remote_id = ?')
      .get(remoteId) as { id: number; updated_at: string; version: number } | undefined;
    const existingLocal = local ||
      (database.prepare('SELECT id, updated_at, version FROM orders WHERE id = ?').get(remoteId) as
        | { id: number; updated_at: string; version: number }
        | undefined);

    // 2. Détection de conflit (modification concurrente locale + distante)
    let conflictLogged = false;
    if (existingLocal) {
      const localVersion = Number(existingLocal.version || 1);
      const remoteVersion = Number(remote.version || 1);
      const isConflict = conflictResolver.detectConflict(
        'order',
        existingLocal.id,
        remoteId,
        existingLocal.updated_at,
        remote.updated_at,
        localVersion,
        remoteVersion
      );
      if (isConflict) {
        const resolution = conflictResolver.resolveLWW(
          localVersion,
          remoteVersion,
          existingLocal.updated_at,
          remote.updated_at
        );
        conflictResolver.logResolvedConflict(
          { entity: 'order', localId: existingLocal.id, remoteId },
          'order',
          { status: undefined, updated_at: existingLocal.updated_at, version: localVersion },
          { status: remote.status, updated_at: remote.updated_at, version: remoteVersion },
          resolution,
          `Concurrent modification detected (local v${localVersion} vs remote v${remoteVersion}) — ${resolution}`
        );
        conflictLogged = true;
      }
    }

    // 3. Préparation des champs locaux
    const items = Array.isArray(remote.items)
      ? JSON.stringify(remote.items)
      : typeof remote.items === 'string'
        ? remote.items
        : JSON.stringify(remoteItems || []);

    const fields: Record<string, any> = {
      remote_id: remoteId,
      table_id: resolveLocalId(database, 'restaurant_tables', remote.table_id),
      waiter_id: resolveLocalId(database, 'users', remote.waiter_id),
      customer_id: resolveLocalId(database, 'customers', remote.customer_id),
      status: remote.status,
      total: remote.total != null ? Number(remote.total) : 0,
      items,
      notes: remote.notes ?? null,
      customer_phone: remote.customer_phone ?? null,
      source: remote.source || 'cloud',
      version: remote.version || 1,
      tenant_id: tenantId,
      created_at: remote.created_at ? String(remote.created_at) : new Date().toISOString(),
      updated_at: remote.updated_at ? String(remote.updated_at) : new Date().toISOString(),
    };

    const updateKeys = Object.keys(fields);
    const setClauses = updateKeys.map((k) => `"${k}" = ?`).join(', ');
    const params = updateKeys.map((k) => sanitize(fields[k]));

    let localOrderId: number;
    if (existingLocal) {
      database
        .prepare(`UPDATE orders SET ${setClauses} WHERE id = ?`)
        .run(...params, existingLocal.id);
      localOrderId = existingLocal.id;
    } else {
      const insertKeys = ['id', ...updateKeys];
      const insertParams = [remoteId, ...params];
      const result = database
        .prepare(
          `INSERT INTO orders (${insertKeys.map((k) => `"${k}"`).join(', ')}) VALUES (${insertKeys
            .map(() => '?')
            .join(', ')})`
        )
        .run(...insertParams);
      localOrderId = Number(result.lastInsertRowid);
    }

    // 4. Réplication des order_items (diff intelligent : delete + re-insert résolu)
    applyMirroredItems(database, conflictResolver, localOrderId, tenantId, remoteItems ?? remote.order_items ?? []);

    return { applied: true, localOrderId, conflictLogged };
  } catch (err: any) {
    console.warn('[OrderMirror] Failed to mirror remote order to local SQLite:', err?.message);
    return { applied: false };
  }
}

function applyMirroredItems(
  database: any,
  conflictResolver: ConflictResolver,
  localOrderId: number,
  tenantId: number,
  remoteItems: any[]
) {
  if (!Array.isArray(remoteItems)) return;

  // Supprime les items locaux existants pour cette commande (petit volume, simple & sûr)
  database
    .prepare('DELETE FROM order_items WHERE order_id = ? AND tenant_id = ?')
    .run(localOrderId, tenantId);

  const insertStmt = database.prepare(`
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, notes, tenant_id, remote_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of remoteItems) {
    const remoteProductId = item.product_id ?? item.productId;
    const localProductId = resolveLocalId(database, 'products', remoteProductId);
    // Pas de produit local correspondant : on ne peut pas satisfaire la FK NOT NULL.
    // L'item reste présent dans orders.items (JSON) — il sera complété au pull produit.
    if (!localProductId) {
      console.warn(`[OrderMirror] Skipping item for remote product ${remoteProductId}: no local product yet`);
      continue;
    }

    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price ?? item.unitPrice ?? item.price) || 0;

    try {
      insertStmt.run(
        localOrderId,
        localProductId,
        quantity,
        unitPrice,
        unitPrice * quantity,
        item.notes ?? null,
        tenantId,
        item.id != null ? Number(item.id) : null,
        item.created_at ? String(item.created_at) : new Date().toISOString(),
        item.updated_at ? String(item.updated_at) : new Date().toISOString()
      );
    } catch (err: any) {
      console.warn('[OrderMirror] Failed to insert mirrored order item:', err?.message);
    }
  }
}

/**
 * Supprime la commande miroir locale correspondant à un id distant.
 */
export function deleteMirroredOrder(tenantId: number, remoteId: number): void {
  const database = localDb();
  if (!database || remoteId == null) return;
  try {
    const local = database
      .prepare('SELECT id FROM orders WHERE remote_id = ? AND tenant_id = ?')
      .get(Number(remoteId), tenantId) as { id: number } | undefined;
    if (!local) return;
    database.prepare('DELETE FROM order_items WHERE order_id = ? AND tenant_id = ?').run(local.id, tenantId);
    database.prepare('DELETE FROM orders WHERE id = ? AND tenant_id = ?').run(local.id, tenantId);
  } catch (err: any) {
    console.warn('[OrderMirror] Failed to delete mirrored order:', err?.message);
  }
}
