/**
 * src/server/services/order-local-mirror.ts
 *
 * Point d'entrée du miroir cloud → SQLite pour les commandes.
 *
 * Délègue le travail au miroir universel du moteur de synchronisation
 * (GenericSyncService.mirrorRemoteRecordToLocal) qui gère TOUTES les tables
 * de façon bidirectionnelle et idempotente (clé par remote_id, résolution de
 * FK, gestion de conflits LWW). On garde ici uniquement l'adaptateur pour les
 * commandes + la suppression, qui reste défensif si le moteur n'est pas prêt.
 */

import { getOrchestratorV2 } from '../../sync';
import db from '../db/database';

const IS_RENDER_CLOUD =
  process.env.RENDER_CLOUD_MODE === 'true' || process.env.RENDER_CLOUD_MODE === '1';

function localDb(): any {
  if (IS_RENDER_CLOUD) return null;
  try {
    return db && typeof db.prepare === 'function' ? db : null;
  } catch {
    return null;
  }
}

export interface MirrorResult {
  applied: boolean;
  localOrderId?: number;
  conflictLogged?: boolean;
}

/**
 * Réplique (upsert) une commande distante dans la SQLite locale.
 * @param tenantId   ID du tenant (numérique)
 * @param remote     Ligne `orders` telle que retournée par Supabase (doit contenir `id`)
 * @param remoteItems Optionnel : lignes `order_items` distantes (sinon lu depuis remote.items)
 */
export async function mirrorRemoteOrderToLocal(
  tenantId: number,
  remote: any,
  remoteItems?: any[]
): Promise<MirrorResult> {
  try {
    const generic = getOrchestratorV2().getGenericSync();
    const res = await generic.mirrorRemoteRecordToLocal('order', String(tenantId), remote, remoteItems);
    return { applied: res.applied, localOrderId: res.localId, conflictLogged: res.conflictLogged };
  } catch (err: any) {
    // Moteur non initialisé (ex. sync désactivé) → le pull périodique rattrapera.
    console.warn('[OrderMirror] engine unavailable, skipping local mirror:', err?.message);
    return { applied: false };
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
