/**
 * src/sync/core/generic-sync.service.ts
 * Service générique de synchronisation qui utilise le registre d'entités
 * pour synchroniser TOUTES les tables de manière uniforme.
 * 
 * Ce service remplace la logique ad-hoc dans ProductSyncService.handleUpsert
 * et ajoute la couverture pour toutes les tables manquantes.
 */
import type Database from 'better-sqlite3';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type SyncEntityDefinition,
  getEntityDef,
  getEntitiesBySyncOrder,
} from './entity-registry';
import { SyncPersistedCursor } from './sync-persisted-cursor';
import { ConflictResolver } from './conflict-resolver';
import { DeadLetterQueue } from './dead-letter-queue';

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: number;
}

export class GenericSyncService {
  private db: Database.Database;
  private supabase: SupabaseClient;
  private cursor: SyncPersistedCursor;
  private conflictResolver: ConflictResolver;
  private dlq: DeadLetterQueue;

  constructor(
    db: Database.Database,
    supabase: SupabaseClient,
    cursor: SyncPersistedCursor,
    conflictResolver: ConflictResolver,
    dlq: DeadLetterQueue
  ) {
    this.db = db;
    this.supabase = supabase;
    this.cursor = cursor;
    this.conflictResolver = conflictResolver;
    this.dlq = dlq;
  }

  /* ==================================================================
   *  QUEUE HELPERS
   * ================================================================== */

  /**
   * Ajoute un changement à l'outbox (hors transaction)
   */
  queueChange(entity: string, operation: 'insert' | 'update' | 'delete', record: any) {
    const def = getEntityDef(entity);
    if (!def) {
      console.warn(`[GenericSync] Unknown entity "${entity}", skipping queue`);
      return;
    }

    const id = this.newId();
    const payload = JSON.stringify(record);
    const version = record.version || 1;
    const tenantId = record.tenant_id !== undefined ? String(record.tenant_id) : null;

    this.db.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, entity, operation, String(record.id), payload, version, tenantId);
  }

  /**
   * Ajoute un changement à l'outbox (dans une transaction existante)
   */
  queueChangeInsideTransaction(
    entity: string,
    operation: 'insert' | 'update' | 'delete',
    record: any
  ) {
    const def = getEntityDef(entity);
    if (!def) return;

    const id = this.newId();
    const payload = JSON.stringify(record);
    const version = record.version || 1;
    const tenantId = record.tenant_id !== undefined ? String(record.tenant_id) : null;

    this.db.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, entity, operation, String(record.id), payload, version, tenantId);
  }

  /* ==================================================================
   *  PUSH – Outbox → Supabase
   * ================================================================== */

  /**
   * Push tous les items pending d'une entité vers Supabase
   */
  async pushByEntity(entity: string, tenantId: string): Promise<number> {
    const def = getEntityDef(entity);
    if (!def) {
      console.warn(`[GenericSync] Unknown entity "${entity}" for push`);
      return 0;
    }

    const items = this.db.prepare(`
      SELECT * FROM sync_outbox
      WHERE entity = ? AND status = 'pending' AND tenant_id = ?
      ORDER BY created_at ASC
      LIMIT 50
    `).all(entity, tenantId) as any[];

    let successCount = 0;

    for (const item of items) {
      this.db.prepare(`UPDATE sync_outbox SET status = 'in_progress' WHERE id = ?`).run(item.id);

      try {
        const payload = JSON.parse(item.payload);
        const recordId = Number(item.record_id);
        if (isNaN(recordId)) {
          this.db.prepare(`UPDATE sync_outbox SET status = 'failed', last_error = 'invalid record_id' WHERE id = ?`).run(item.id);
          continue;
        }

if (item.operation === 'insert' || item.operation === 'update') {
           await this.handleUpsert(def, item, payload, recordId, tenantId);
         } else if (item.operation === 'delete') {
           // Pour les suppressions, vérifier que le remote_id existe avant de pousser
           const remoteId = payload.remote_id || this.getRemoteId(def.localTable, recordId);
           
           // Si pas de remote_id et que l'entité est product, essayer de trouver le remote_id via la clé naturelle
           let resolvedRemoteId = remoteId;
           if (!resolvedRemoteId && def.entity === 'product' && payload.name && tenantId) {
             const existing = await this.findExistingRemoteRecord(def, payload, tenantId);
             if (existing?.id) {
               resolvedRemoteId = existing.id;
             }
           }
           
           await this.handleDelete(def, item, payload, recordId, resolvedRemoteId || remoteId);
           
           // Vérifier que la suppression a bien été appliquée dans Supabase avant de marquer localement
           if (def.entity === 'product' && (resolvedRemoteId || remoteId)) {
             try {
               const targetIdStr = String(resolvedRemoteId || remoteId);
               const { data: remoteCheck, error: verifyError } = await this.supabase
                 .from(def.remoteTable)
                 .select('is_available, deleted_at')
                 .eq('id', targetIdStr)
                 .eq('tenant_id', tenantId)
                 .maybeSingle();
               
               if (verifyError) {
                 console.error(`[GenericSync] Verification failed for ${def.entity} #${recordId} delete:`, verifyError.message);
                 // Ne pas marquer comme done, laisser pour retry
                 this.db.prepare(`UPDATE sync_outbox SET status = 'pending' WHERE id = ?`).run(item.id);
                 continue;
               }
               
               // Si la suppression n'est pas vérifiée dans Supabase, ne pas marquer comme fait
               if (!remoteCheck || (remoteCheck.is_available !== false && !remoteCheck.deleted_at)) {
                 console.error(`[GenericSync] ${def.entity} #${recordId} (remote=${targetIdStr}) deletion NOT verified in Supabase - will retry`);
                 this.db.prepare(`UPDATE sync_outbox SET status = 'pending' WHERE id = ?`).run(item.id);
                 continue;
               }
             } catch (verifyErr: any) {
               console.error(`[GenericSync] Delete verification failed for ${def.entity} #${recordId}:`, verifyErr.message);
               this.db.prepare(`UPDATE sync_outbox SET status = 'pending' WHERE id = ?`).run(item.id);
               continue;
             }
           }
           
           // Marquer le record comme supprimé localement si ce n'est pas déjà fait (soft-delete)
           // SEULEMENT si la suppression Supabase a réussi ou si c'est un produit sans remote_id (jamais sync)
           try {
             const checkRow = this.db.prepare(`SELECT deleted_at, is_available FROM ${def.localTable} WHERE id = ?`).get(recordId) as any;
             if (checkRow && (!checkRow.deleted_at || checkRow.is_available !== 0)) {
               this.db.prepare(`UPDATE ${def.localTable} SET deleted_at = ?, is_available = 0 WHERE id = ?`).run(new Date().toISOString(), recordId);
             }
           } catch (purgeErr) {
             console.warn(`[GenericSync] Local soft-delete failed for ${def.entity} #${recordId}:`, purgeErr);
           }
         }

        this.db.prepare(`UPDATE sync_outbox SET status = 'done' WHERE id = ?`).run(item.id);
        successCount++;
      } catch (err: any) {
        const newRetryCount = (item.retry_count || 0) + 1;
        this.db.prepare(`
          UPDATE sync_outbox
          SET status = 'failed', retry_count = ?, last_error = ?
          WHERE id = ?
        `).run(newRetryCount, err?.message ?? String(err), item.id);

        console.error(`[GenericSync] Push failed for ${entity} ${item.record_id}:`, err?.message ?? err);

        if (newRetryCount >= 5) {
          this.dlq.archiveFailedItem(item.id, err?.message ?? String(err), newRetryCount);
        }
      }
    }

    return successCount;
  }

private async handleUpsert(
     def: SyncEntityDefinition,
     item: any,
     payload: any,
     recordId: number,
     tenantId: string
   ) {
     const { localTable, remoteTable, fieldMappings, statusMapping, foreignKeys } = def;

     const safeUpdate: Record<string, any> = {
       updated_at: new Date().toISOString(),
     };

     // Récupérer le remote_id actuel depuis la DB locale
     const currentRemoteId = this.getRemoteId(localTable, recordId);
     const effectiveRemoteId = payload.remote_id || currentRemoteId;

     // Supabase utilise des UUID (strings) pour les IDs, pas des entiers
     if (effectiveRemoteId) {
       safeUpdate.id = String(effectiveRemoteId);
     } else if (item.operation === 'update') {
       // Pour les updates sans remote_id, on doit d'abord chercher si le record existe déjà dans Supabase
       // par nom/natural key. Si pas trouvé, on ne peut pas pousser.
       const existingRemote = await this.findExistingRemoteRecord(def, payload, tenantId);
       if (existingRemote) {
         safeUpdate.id = String(existingRemote.id);
       } else {
         console.warn(`[GenericSync] Cannot push update for ${def.entity} #${recordId}: no remote_id and no matching remote record`);
         return; // Skip this item - cannot sync without remote identity
       }
     }

    // Appliquer les champs autorisés
    for (const field of def.allowedFields) {
      if (payload[field] !== undefined) {
        let val = payload[field];

        // Boolean conversion
        if (def.booleanFields?.includes(field) && typeof val === 'number') {
          val = val === 1;
        }

        safeUpdate[field] = val;
      }
    }

    // Garantir une identité remote pour les INSERT products (Supabase UUID requis)
    if (def.entity === 'product' && item.operation === 'insert' && !safeUpdate.id) {
      safeUpdate.id = this.newId();
    }

    // Appliquer les fieldMappings : {remoteField: localField} → convertir SQLite vers Supabase
    // e.g., { cost_price: 'buying_price', price: 'selling_price', low_stock_threshold: 'minimum_stock' }
    // payload a les noms SQLite (buying_price, selling_price, minimum_stock)
    // safeUpdate doit avoir les noms Supabase (cost_price, price, low_stock_threshold)
    if (fieldMappings) {
      for (const [remoteField, localField] of Object.entries(fieldMappings)) {
        if (payload[localField] !== undefined) {
          safeUpdate[remoteField] = payload[localField];
        }
      }
      // Nettoyer les noms SQLite qui ne doivent PAS aller à Supabase
      for (const localField of Object.values(fieldMappings)) {
        if (localField !== undefined && localField !== null) {
          delete safeUpdate[localField];
        }
      }
    }

    // Sécurité: Ne JAMAIS envoyer remote_id comme une colonne à Supabase (c'est l'ID interne local)
    delete safeUpdate.remote_id;

    // Appliquer le mapping de statuts
    if (statusMapping && safeUpdate.status) {
      const mapped = statusMapping[safeUpdate.status];
      if (mapped) safeUpdate.status = mapped;
    }

    // Résoudre les clés étrangères (FK) pour Supabase
    if (foreignKeys) {
      for (const [field, targetTable] of Object.entries(foreignKeys)) {
        if (safeUpdate[field] !== undefined && safeUpdate[field] !== null) {
          const remoteFkId = this.getRemoteId(targetTable, safeUpdate[field]);
          if (remoteFkId) {
            safeUpdate[field] = remoteFkId;
          } else if (targetTable !== 'customers' && targetTable !== 'suppliers') {
            // Si c'est un soft-delete (is_available=0), on peut ignorer la FK manquante
            if (safeUpdate.is_available === false) {
              delete safeUpdate[field];
            } else {
              console.warn(`[GenericSync] FK ${targetTable}.id=${safeUpdate[field]} not yet synced for ${def.entity}. Skipping.`);
              return; // Important: ne pas push si une FK requise n'est pas synced
            }
          }
        }
      }
    }

    // S'assurer que tenant_id est un nombre (Supabase attend integer)
    if (def.hasTenantId && tenantId) {
      safeUpdate.tenant_id = Number(tenantId);
    }

    // Pour les INSERT sans remote_id
    if (!payload.remote_id && item.operation === 'insert' && def.entity !== 'tenant') {
      delete safeUpdate.id;
      // Vérifier si le tenant existe en remote (non bloquant pour restaurant_table, setting, customer)
      if (tenantId && !['restaurant_table', 'setting', 'customer'].includes(def.entity)) {
        try {
          const { data: remoteTenant, error } = await this.supabase
            .from('tenants')
            .select('id')
            .eq('id', tenantId)
            .maybeSingle();
          if (error || !remoteTenant) {
            console.warn(`[GenericSync] Tenant #${tenantId} not found in Supabase, but pushing ${def.entity} anyway (auto-create)`);
            // Procéder quand même - le tenant sera créé par le sync des tenants
          }
        } catch (tenantErr) {
          console.warn(`[GenericSync] Tenant check failed for ${def.entity}, pushing anyway:`, tenantErr);
        }
      }
    }

    // === Special handling pour settings (pas de champ id auto-incrémenté) ===
    if (def.entity === 'setting') {
      const { data: existingSetting } = await this.supabase
        .from(remoteTable)
        .select('id')
        .eq('key', safeUpdate.key)
        .maybeSingle();

      if (existingSetting) {
        safeUpdate.id = existingSetting.id;
      } else {
        delete safeUpdate.id;
      }
    }

    // Upsert vers Supabase
    const { data, error } = await this.supabase
      .from(remoteTable)
      .upsert(safeUpdate)
      .select('id')
      .single();

    if (error) {
      // Handle race conditions on unique constraint
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        console.warn(`[GenericSync] Conflict on ${def.entity} push. Trying to match existing...`);
        // Try to find the existing record and update remote_id
        const { data: existing } = await this.supabase
          .from(remoteTable)
          .select('id')
          .eq('tenant_id', tenantId)
          .limit(1);

        if (existing?.[0]?.id) {
          this.db.prepare(`UPDATE ${localTable} SET remote_id = ? WHERE id = ?`)
            .run(existing[0].id, recordId);
          return;
        }
      }
      throw error;
    }

    // Sauvegarder le remote_id localement
    if (!payload.remote_id && data?.id) {
      this.db.prepare(`UPDATE ${localTable} SET remote_id = ? WHERE id = ?`)
        .run(data.id, recordId);
    }
  }

private async handleDelete(
    def: SyncEntityDefinition,
    _item: any,
    payload: any,
    recordId: number,
    remoteId?: number | string | null
  ) {
    const { remoteTable, localTable, hasTenantId } = def;

    // Look up the remote_id from the local database or use the provided one
    let targetId = remoteId || payload.remote_id;
    if (!targetId) {
      const localRemoteId = this.getRemoteId(localTable, recordId);
      if (localRemoteId) {
        targetId = localRemoteId;
      }
    }
    
    // Pour les produits: si pas de remote_id, essayer de trouver par clé naturelle
    if (!targetId && def.entity === 'product' && payload.name && payload.tenant_id) {
      const existing = await this.findExistingRemoteRecord(def, payload, String(payload.tenant_id));
      if (existing?.id) {
        targetId = existing.id;
      }
    }
    
    // Si pas de remote_id trouvé, ce produit n'existe pas dans Supabase
    // Pour les produits, on peut quand même essayer de le trouver par son nom
    if (!targetId && def.entity === 'product') {
      console.log(`[GenericSync] ${def.entity} #${recordId} has no remote_id (never synced to Supabase or not found), skipping remote delete`);
      // Ne pas retourner ici, mais continuer pour permettre le soft-delete local
      // return;
    }

    // Convert to string for Supabase UUID compatibility
    const targetIdStr = targetId ? String(targetId) : null;
    const tenantId = payload.tenant_id ? String(payload.tenant_id) : null;

    // Déterminer la requête de base (selon le type de suppression)
    let queryBuilder;

    if (def.entity === 'product') {
      // Soft delete bidirectionnel: écrire aussi deleted_at
      queryBuilder = this.supabase
        .from(remoteTable)
        .update({
          is_available: false,
          deleted_at: new Date().toISOString(),
          // status peut varier selon le schéma; si non exposé en DB c'est harmless (sera ignoré si absent)
          status: 'archived',
          updated_at: new Date().toISOString(),
        });
    } else if (def.entity === 'order') {
      // Soft delete (status = 'cancelled') pour les orders
      queryBuilder = this.supabase
        .from(remoteTable)
        .update({ status: 'cancelled', updated_at: new Date().toISOString() });
    } else {
      // Hard delete pour les autres entités
      queryBuilder = this.supabase
        .from(remoteTable)
        .delete();
    }

    // Appliquer les filtres avec scoping tenant pour éviter les suppressions cross-tenant
    if (targetIdStr) {
      queryBuilder = queryBuilder.eq('id', targetIdStr);
      if (hasTenantId && tenantId) {
        queryBuilder = queryBuilder.eq('tenant_id', Number(tenantId));
      }

      const { error } = await queryBuilder;
      if (error) throw error;
    } else {
      // Si pas de targetId, on ne peut pas faire de requête
      console.warn(`[GenericSync] Cannot delete ${def.entity} #${recordId} in Supabase: no remote_id found`);
    }
  }

  /* ==================================================================
   *  PULL – Supabase → SQLite
   * ================================================================== */

  /**
   * Pull les mises à jour d'une entité depuis Supabase
   */
  async pullByEntity(entity: string, tenantId: string): Promise<number> {
    const def = getEntityDef(entity);
    if (!def) return 0;

    const { localTable: _localTable, remoteTable, hasUpdatedAt } = def;

    // Curseur persistant
    const cursorKey = hasUpdatedAt ? entity : `${entity}_created`;
    const since = this.cursor.getOrEpoch(cursorKey);

    // Normaliser tenantId en int (Supabase: int8)
    const tenantIdInt = Number.isFinite(Number(tenantId)) ? parseInt(tenantId, 10) : NaN;
    const tenantIdForQuery = Number.isNaN(tenantIdInt) ? tenantId : tenantIdInt;

    // Construire la requête Supabase
    let query = this.supabase
      .from(remoteTable)
      .select('*')
      .eq('tenant_id', tenantIdForQuery);

    if (hasUpdatedAt) {
      query = query.gt('updated_at', since).order('updated_at', { ascending: true });
    } else {
      query = query.gt('created_at', since).order('created_at', { ascending: true });
    }

    // Pour 'tenant', pas de filtre tenant_id
    if (entity === 'tenant') {
      query = this.supabase
        .from(remoteTable)
        .select('*')
        .eq('id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[GenericSync] Failed to pull ${entity} from Supabase:`, error.message);
      return 0;
    }

    if (!data || data.length === 0) return 0;

    let applied = 0;
    const transaction = this.db.transaction((rows: any[]) => {
      for (const remote of rows) {
        try {
          // Scoping tenant
          if (entity !== 'tenant') {
            const remoteTenantId = remote.tenant_id;
            if (remoteTenantId && entity !== 'user') {
              const remoteTenantInt = Number.isFinite(Number(remoteTenantId)) ? parseInt(String(remoteTenantId), 10) : NaN;
              const localTenantInt = Number.isFinite(Number(tenantId)) ? parseInt(String(tenantId), 10) : NaN;

              if (!Number.isNaN(remoteTenantInt) && !Number.isNaN(localTenantInt) && remoteTenantInt !== localTenantInt) {
                continue;
              }
            }
          } else {
            if (String(remote.id) !== String(tenantId)) continue;
          }

          const remoteId = Number(remote.id);
          if (isNaN(remoteId)) continue;

          // Trouver le local correspondant
          const local = this.findLocalRow(def, remoteId, remote);

          // Détection de conflit
          if (local && hasUpdatedAt && remote.updated_at) {
            const conflict = this.conflictResolver.detectConflict(
              entity, local.id, remoteId,
              local.updated_at || new Date(0).toISOString(),
              remote.updated_at instanceof Date ? remote.updated_at.toISOString() : String(remote.updated_at),
              local.version || 0,
              remote.version || 0
            );

            if (conflict) {
              const winner = this.conflictResolver.resolveLWW(
                local.version || 0,
                remote.version || 0,
                local.updated_at || new Date(0).toISOString(),
                remote.updated_at ? (remote.updated_at instanceof Date ? remote.updated_at.toISOString() : String(remote.updated_at)) : new Date().toISOString()
              );
              if (winner === 'local_wins') {
                applied++;
                continue;
              }
            }
          }

          // Vérifier si le remote est plus récent
          const remoteTs = remote.updated_at || remote.created_at;
          const localTs = local?.updated_at || local?.created_at;
          
          // DÉTECTER LES SOFT DELETES - Toujours appliquer si le remote est supprimé
          const isRemoteSoftDeleted = def.entity === 'product' && 
            (remote.is_available === false || remote.deleted_at !== null || remote.status === 'archived');
          
          // Vérifier si le remote est plus récent OU si c'est un soft delete
          const shouldApply = !local || !localTs || 
            (remoteTs && new Date(remoteTs) > new Date(localTs)) ||
            isRemoteSoftDeleted;
          
          if (!shouldApply) continue;

          // Construire les champs à appliquer
          const fields = this.buildPullFields(def, remote, local, remoteId, tenantId);

          // Appliquer
          this.applyPullRow(def, fields, local, remoteId, remote);

          applied++;
        } catch (err: any) {
          console.error(`[GenericSync] Error pulling ${entity} #${remote.id}:`, err?.message || err);
        }
      }
    });

    transaction(data);

    // Sauvegarder le curseur
    if (data.length > 0) {
      const lastTs = data[data.length - 1].updated_at || data[data.length - 1].created_at;
      if (lastTs) {
        this.cursor.set(cursorKey, lastTs instanceof Date ? lastTs.toISOString() : String(lastTs));
      }
    }

    return applied;
  }

  private findLocalRow(
    def: SyncEntityDefinition,
    remoteId: number,
    remote: any
  ): { id: number; updated_at: string; created_at: string; version: number } | undefined {
    const { localTable } = def;
    try {
      // 1) Par remote_id (canonique)
      const byRemote = this.db.prepare(
        `SELECT id, updated_at, created_at, version FROM ${localTable} WHERE remote_id = ?`
      ).get(remoteId) as any;
      if (byRemote) return byRemote;

      // 2) Par ID direct
      const byDirectId = this.db.prepare(
        `SELECT id, updated_at, created_at, version FROM ${localTable} WHERE id = ?`
      ).get(remoteId) as any;
      if (byDirectId) return byDirectId;

      // 3) Par clé naturelle
      if (def.entity === 'product' && remote.name && remote.tenant_id) {
        return this.db.prepare(
          `SELECT id, updated_at, created_at, version FROM products WHERE name = ? AND tenant_id = ?`
        ).get(remote.name, remote.tenant_id) as any;
      }
      if (def.entity === 'category' && remote.name && remote.tenant_id) {
        return this.db.prepare(
          `SELECT id, updated_at, created_at, version FROM categories WHERE name = ? AND tenant_id = ?`
        ).get(remote.name, remote.tenant_id) as any;
      }
      if (def.entity === 'restaurant_table' && remote.table_number && remote.tenant_id) {
        return this.db.prepare(
          `SELECT id, updated_at, created_at, version FROM restaurant_tables WHERE table_number = ? AND tenant_id = ?`
        ).get(String(remote.table_number), remote.tenant_id) as any;
      }
      if (def.entity === 'user' && remote.username) {
        return this.db.prepare(
          `SELECT id, updated_at, created_at, version FROM users WHERE username = ?`
        ).get(remote.username) as any;
      }
      if (def.entity === 'tenant' && remote.slug) {
        return this.db.prepare(
          `SELECT id, updated_at, created_at, version FROM tenants WHERE slug = ?`
        ).get(remote.slug) as any;
      }
      if (def.entity === 'tenant_user' && remote.tenant_id && remote.user_id) {
        const localTenantId = this.getLocalId('tenants', remote.tenant_id);
        const localUserId = this.getLocalId('users', remote.user_id);
        if (localTenantId && localUserId) {
          return this.db.prepare(
            `SELECT id, updated_at, created_at, version FROM tenant_users WHERE tenant_id = ? AND user_id = ?`
          ).get(localTenantId, localUserId) as any;
        }
      }
      if (def.entity === 'setting' && remote.key) {
        return this.db.prepare(
          `SELECT key as id, updated_at, created_at, version FROM settings WHERE key = ?`
        ).get(remote.key) as any;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private buildPullFields(
    def: SyncEntityDefinition,
    remote: any,
    local: any,
    remoteId: number,
    tenantId: string
  ): Record<string, any> {
    const { allowedFields, fieldMappings, reverseStatusMapping, booleanFields, jsonFields, foreignKeys } = def;
    const sanitize = (val: any) => {
      if (val === undefined || val === null) return null;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'boolean') return val ? 1 : 0;
      return val;
    };

    const fields: Record<string, any> = {
      remote_id: remoteId,
      updated_at: remote.updated_at ? (remote.updated_at instanceof Date ? remote.updated_at.toISOString() : String(remote.updated_at)) : new Date().toISOString(),
      created_at: remote.created_at ? (remote.created_at instanceof Date ? remote.created_at.toISOString() : String(remote.created_at)) : new Date().toISOString(),
    };

    // Version tracking
    if (remote.version !== undefined) fields.version = remote.version;

    // Field mappings inverses (remote field → local field)
    const inverseFieldMappings: Record<string, string> = {};
    if (fieldMappings) {
      for (const [remoteField, localField] of Object.entries(fieldMappings)) {
        inverseFieldMappings[localField] = remoteField;
      }
    }

    // Appliquer les champs autorisés
    for (const field of allowedFields) {
      if (field === 'id' || field === 'created_at' || field === 'updated_at' || field === 'remote_id') continue;
      if (remote[field] !== undefined) {
        fields[field] = remote[field];
      }
    }

    // Champs spéciaux (price → selling_price, etc.)
    if (inverseFieldMappings) {
      for (const [localField, remoteField] of Object.entries(inverseFieldMappings)) {
        if (remote[remoteField] !== undefined && fields[localField] === undefined) {
          fields[localField] = remote[remoteField];
        }
      }
    }

    // PUSH-only fields (ones that Supabase has but local might not)
    // These are not in allowedFields but we need to handle them
    if (def.entity === 'product') {
      if (remote.price !== undefined && fields.selling_price === undefined) fields.selling_price = remote.price;
      if (remote.cost_price !== undefined && fields.buying_price === undefined) fields.buying_price = remote.cost_price;
      if (remote.low_stock_threshold !== undefined && fields.minimum_stock === undefined) fields.minimum_stock = remote.low_stock_threshold;
      
      // S'assurer que deleted_at et is_available sont inclus pour les soft deletes
      if (remote.deleted_at !== undefined) {
        fields.deleted_at = remote.deleted_at;
      }
      if (remote.is_available !== undefined) {
        fields.is_available = remote.is_available ? 1 : 0;
      }
      if (remote.status !== undefined && fields.status === undefined) {
        fields.status = remote.status;
      }
    }

    // Boolean fields
    if (booleanFields) {
      for (const field of booleanFields) {
        if (fields[field] !== undefined) {
          fields[field] = fields[field] ? 1 : 0;
        }
      }
    }

    // JSON fields
    if (jsonFields) {
      for (const field of jsonFields) {
        if (fields[field] !== undefined && typeof fields[field] !== 'string') {
          fields[field] = JSON.stringify(fields[field]);
        }
      }
    }

    // Reverse status mapping (remote → local)
    if (reverseStatusMapping && fields.status) {
      const mapped = reverseStatusMapping[fields.status];
      if (mapped) fields.status = mapped;
    }

    // Resolve foreign keys (remote → local)
    if (foreignKeys) {
      for (const [field, targetTable] of Object.entries(foreignKeys)) {
        if (fields[field] !== undefined && fields[field] !== null) {
          const localFkId = this.getLocalId(targetTable, fields[field]);
          if (localFkId) {
            fields[field] = localFkId;
          }
        }
      }
    }

    // Tenant
    if (def.hasTenantId && remote.tenant_id !== undefined) {
      fields.tenant_id = remote.tenant_id;
    }

    return fields;
  }

  private applyPullRow(
    def: SyncEntityDefinition,
    fields: Record<string, any>,
    local: any,
    remoteId: number,
    remote: any
  ) {
    const localTable = def.localTable;
    const sanitize = (val: any) => {
      if (val === undefined || val === null) return null;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'boolean') return val ? 1 : 0;
      return val;
    };

    const updateFields = Object.keys(fields);
    if (updateFields.length === 0) return;

    const setClauses = updateFields.map(k => `"${k}" = ?`).join(', ');
    const params = updateFields.map(k => sanitize(fields[k]));

    // Special handling for settings
    if (def.entity === 'setting') {
      const existingSetting = this.db.prepare('SELECT key FROM settings WHERE key = ?').get(fields.key) as any;
      if (existingSetting) {
        this.db.prepare(`UPDATE settings SET ${setClauses} WHERE key = ?`).run(...params, fields.key);
      } else {
        this.db.prepare(`INSERT INTO settings (${updateFields.map(k => `"${k}"`).join(', ')}) VALUES (${updateFields.map(() => '?').join(', ')})`).run(...params);
      }
      return;
    }

    const pk = local ? local.id : remoteId;

    // Try UPDATE first
    const updateResult = this.db.prepare(`UPDATE ${localTable} SET ${setClauses} WHERE id = ?`).run(...params, pk);
    if (updateResult.changes === 0) {
      // INSERT fallback
      const insertKeys = ['id', ...updateFields];
      const insertParams = [pk, ...params];
      try {
        this.db.prepare(`INSERT INTO ${localTable} (${insertKeys.map(k => `"${k}"`).join(', ')}) VALUES (${insertKeys.map(() => '?').join(', ')})`).run(...insertParams);
      } catch (insertErr: any) {
        if (String(insertErr?.code || '').includes('PRIMARY') || String(insertErr?.message || '').includes('PRIMARY KEY')) {
          // Last resort: update by searching multiple ways
          if (def.entity === 'restaurant_table' && remote.table_number) {
            this.db.prepare(`UPDATE ${localTable} SET ${setClauses} WHERE table_number = ? AND tenant_id = ?`)
              .run(...params, String(remote.table_number), remote.tenant_id);
          } else {
            throw insertErr;
          }
        } else {
          throw insertErr;
        }
      }
    }
  }

  /* ==================================================================
   *  FULL SYNC pour un tenant
   * ================================================================== */

  /**
   * Sync complète (push + pull) de TOUTES les entités pour un tenant
   */
  async fullSyncForTenant(tenantId: string): Promise<SyncResult> {
    const entities = getEntitiesBySyncOrder();
    let pushed = 0, pulled = 0, errors = 0;

    console.log(`[GenericSync] Full sync for tenant #${tenantId} (${entities.length} entities)`);

    for (const def of entities) {
      try {
        // Push d'abord
        const p = await this.pushByEntity(def.entity, tenantId);
        pushed += p;

        // IMPORTANT: Skip pull for entities where SQLite is the source of truth
        // to prevent overwriting local data with stale Supabase data
        // NOTE: products must remain bidirectional, especially for deletions
        if (def.entity === 'restaurant_table' || def.entity === 'category') continue;

        // Pull ensuite
        const pl = await this.pullByEntity(def.entity, tenantId);
        pulled += pl;
      } catch (err: any) {
        console.error(`[GenericSync] Sync failed for ${def.entity}:`, err?.message || err);
        errors++;
      }
    }

    return { pushed, pulled, errors };
  }

  /**
   * Backfill: trouve les records locaux sans remote_id et les queue
   */
  backfillOrphans(tenantId: string): number {
    const entities = getEntitiesBySyncOrder();
    let total = 0;

    for (const def of entities) {
      if (def.entity === 'tenant' || !def.hasTenantId) continue;

      try {
        // Vérifier d'abord que la table a les colonnes nécessaires
        const tableInfo = this.db.prepare(`PRAGMA table_info(${def.localTable})`).all() as Array<{ name: string }>;
        const colNames = tableInfo.map(c => c.name);
        
        // Skip si la table n'a pas les colonnes requises
        if (!colNames.includes('tenant_id') || !colNames.includes('remote_id')) {
          continue;
        }

        const orphans = this.db.prepare(`
          SELECT * FROM ${def.localTable}
          WHERE tenant_id = ? AND remote_id IS NULL
          AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = ? AND status IN ('pending', 'in_progress'))
        `).all(tenantId, def.entity) as any[];

        for (const record of orphans) {
          this.queueChange(def.entity, 'insert', record);
          total++;
        }
      } catch (err: any) {
        console.warn(`[GenericSync] Backfill failed for ${def.entity}:`, err?.message || err);
      }
    }

    return total;
  }

  /**
   * Find existing remote record by natural key (e.g., product name + tenant)
   * Used when pushing updates for records that may not have a remote_id yet
   */
  private async findExistingRemoteRecord(def: SyncEntityDefinition, payload: any, tenantId: string): Promise<any | null> {
    if (def.entity === 'product' && payload.name && tenantId) {
      const { data } = await this.supabase
        .from(def.remoteTable)
        .select('id')
        .eq('name', payload.name)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    }
    if (def.entity === 'category' && payload.name && tenantId) {
      const { data } = await this.supabase
        .from(def.remoteTable)
        .select('id')
        .eq('name', payload.name)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    }
    return null;
  }

  /* ==================================================================
   *  SYNC DES SUPPRESSIONS ORPHELINES
   * ================================================================== */

  /**
   * Synchronise les produits qui ont été soft-deletés localement mais pas dans Supabase
   * C'est une méthode de récupération pour les cas où la suppression n'a pas été queued correctement
   */
  syncOrphanDeletes(tenantId: string): number {
    const def = getEntityDef('product');
    if (!def) {
      console.warn('[GenericSync] Cannot sync orphan deletes: product entity not found');
      return 0;
    }

    let queued = 0;
    
    try {
      // Trouver les produits locaux qui sont soft-deletés mais qui n'ont pas d'opération delete dans l'outbox
      const softDeletedProducts = this.db.prepare(`
        SELECT p.* 
        FROM ${def.localTable} p
        WHERE p.tenant_id = ?
        AND (p.deleted_at IS NOT NULL OR p.is_available = 0)
        AND p.id NOT IN (
          SELECT o.record_id 
          FROM sync_outbox o 
          WHERE o.entity = 'product' 
          AND o.operation = 'delete' 
          AND o.status IN ('pending', 'in_progress')
          AND o.tenant_id = ?
        )
      `).all(tenantId, tenantId) as any[];

      console.log(`[GenericSync] Found ${softDeletedProducts.length} soft-deleted products not in outbox for tenant #${tenantId}`);

      for (const product of softDeletedProducts) {
        // Vérifier si le produit a déjà été supprimé dans Supabase
        const remoteId = product.remote_id;
        if (!remoteId) {
          // Produit jamais sync vers Supabase, on ne peut pas le supprimer à distance
          console.log(`[GenericSync] Product #${product.id} has no remote_id, skipping orphan delete sync`);
          continue;
        }

        // Queue la suppression
        this.queueChange('product', 'delete', {
          id: product.id,
          remote_id: remoteId,
          tenant_id: product.tenant_id,
          is_available: 0,
          deleted_at: product.deleted_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        queued++;
        console.log(`[GenericSync] Queued orphan delete for product #${product.id} (remote=${remoteId})`);
      }
    } catch (err: any) {
      console.error(`[GenericSync] Error syncing orphan deletes:`, err?.message || err);
    }

    return queued;
  }

  /* ==================================================================
   *  HELPERS
   * ================================================================== */

  private getRemoteId(table: string, localId: any): number | null {
    if (!localId) return null;
    try {
      const row = this.db.prepare(`SELECT remote_id FROM ${table} WHERE id = ?`).get(localId) as any;
      return row?.remote_id || null;
    } catch {
      return null;
    }
  }

  private getLocalId(table: string, remoteId: any): number | null {
    if (!remoteId) return null;
    try {
      const row = this.db.prepare(`SELECT id FROM ${table} WHERE remote_id = ?`).get(remoteId) as any;
      if (row) return row.id;
      const byDirect = this.db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(remoteId) as any;
      return byDirect ? byDirect.id : null;
    } catch {
      return null;
    }
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    const { randomUUID } = require('crypto') as { randomUUID: () => string };
    return randomUUID();
  }
}