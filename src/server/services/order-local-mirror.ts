/**
 * src/server/services/order-local-mirror.ts
 *
 * Adaptateur commandes du miroir cloud → SQLite. Délègue au miroir autonome
 * (remote-mirror) qui écrit directement dans la SQLite locale sans dépendre du
 * moteur de synchronisation — ainsi la commande apparaît même si le scheduler
 * de sync n'est pas démarré. `deleteMirroredOrder` reste autonome (db direct).
 */

import { mirrorRemoteRecord, deleteMirroredRecord } from './remote-mirror';

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
    const res = mirrorRemoteRecord(tenantId, 'order', remote, remoteItems);
    return { applied: res.applied, localOrderId: res.localId, conflictLogged: res.conflictLogged };
  } catch (err: any) {
    console.warn('[OrderMirror] local mirror failed (non-critical):', err?.message);
    return { applied: false };
  }
}

/**
 * Supprime la commande miroir locale correspondant à un id distant.
 */
export function deleteMirroredOrder(tenantId: number, remoteId: number): void {
  deleteMirroredRecord(tenantId, 'order', Number(remoteId));
}
