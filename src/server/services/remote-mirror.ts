/**
 * src/server/services/remote-mirror.ts
 *
 * Helper générique de miroir bidirectionnel Supabase → SQLite, réutilisable par
 * TOUTES les routes/services en mode cloud. Délègue au moteur de synchronisation
 * (GenericSyncService.mirrorRemoteRecordToLocal) qui porte l'unique implémentation
 * du "remote → local" (idempotent par remote_id, résolution de FK, gestion de
 * conflits LWW). Défensif : si le moteur n'est pas prêt, le pull périodique
 * rattrape — aucune exception ne doit fuiter vers l'appelant.
 */

import { getOrchestratorV2 } from '../../sync';
import { getEntityDef } from '../../sync';
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

/**
 * Réplique (upsert) une ligne distante dans la SQLite locale.
 * @param tenantId   ID du tenant (numérique)
 * @param entity     Clé d'entité du registre (ex. 'product', 'restaurant_table', 'order')
 * @param remoteRow  Ligne telle que retournée par Supabase (doit contenir `id`)
 * @param relatedItems Items enfants à mirrorer en cascade (ex. order_items pour 'order')
 */
export async function mirrorRemoteRecord(
  tenantId: number,
  entity: string,
  remoteRow: any,
  relatedItems?: any[]
): Promise<{ applied: boolean; localId?: number; conflictLogged?: boolean }> {
  try {
    const generic = getOrchestratorV2().getGenericSync();
    const res = await generic.mirrorRemoteRecordToLocal(entity, String(tenantId), remoteRow, relatedItems);
    return { applied: res.applied, localId: res.localId, conflictLogged: res.conflictLogged };
  } catch (err: any) {
    console.warn(`[RemoteMirror] engine unavailable for "${entity}", skipping local mirror:`, err?.message);
    return { applied: false };
  }
}

/**
 * Supprime la ligne miroir locale correspondant à un id distant.
 */
export function deleteMirroredRecord(tenantId: number, entity: string, remoteId: number): void {
  const database = localDb();
  if (!database || remoteId == null) return;
  try {
    const def = getEntityDef(entity);
    const localTable = def?.localTable || entity + 's';
    const local = database
      .prepare(`SELECT id FROM ${localTable} WHERE remote_id = ? AND tenant_id = ?`)
      .get(Number(remoteId), tenantId) as { id: number } | undefined;
    if (!local) return;
    database.prepare(`DELETE FROM ${localTable} WHERE id = ? AND tenant_id = ?`).run(local.id, tenantId);
  } catch (err: any) {
    console.warn(`[RemoteMirror] Failed to delete mirrored "${entity}":`, err?.message);
  }
}
