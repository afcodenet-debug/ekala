import type Database from 'better-sqlite3';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProductEntity } from '../server/products/types/product.types';
import { SyncPersistedCursor } from './core/sync-persisted-cursor';
import { ConflictResolver } from './core/conflict-resolver';
import { DeadLetterQueue } from './core/dead-letter-queue';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const { randomUUID } = require('crypto') as { randomUUID: () => string };
  return randomUUID();
}

interface OutboxItem {
  id: string;
  entity: string;
  operation: 'insert' | 'update' | 'delete';
  record_id: string;
  payload: string;
  version: number;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export class ProductSyncService {
  private db: Database.Database;
  private supabase: SupabaseClient;
  private isRunning = false;
  private cursor: SyncPersistedCursor;
  private conflictResolver: ConflictResolver;
  private dlq: DeadLetterQueue;

  private readonly ENTITY_TABLE: Record<string, string> = {
    product: 'products',
    category: 'categories',
    order: 'orders',
    order_item: 'order_items',
    sale: 'sales',
    sale_item: 'sale_items',
    restaurant_table: 'restaurant_tables',
  };

  constructor(db: Database.Database, supabaseUrl: string, supabaseAnonKey: string) {
    this.db = db;
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.cursor = new SyncPersistedCursor(db, 'last_pull_');
    this.conflictResolver = new ConflictResolver(db);
    this.dlq = new DeadLetterQueue(db);
  }

  private getRemoteId(table: string, localId: any): number | null {
    if (!localId) return null;
    try {
      const row = this.db.prepare(
        `SELECT remote_id FROM ${table} WHERE id = ?`
      ).get(localId) as { remote_id: number | null } | undefined;
      return row?.remote_id || null;
    } catch {
      return null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public helpers                                                     */
  /* ------------------------------------------------------------------ */

  getConflictResolver(): ConflictResolver {
    return this.conflictResolver;
  }

  getDeadLetterQueue(): DeadLetterQueue {
    return this.dlq;
  }

  resetPullCursor() {
    this.cursor.reset();
  }

  /* ------------------------------------------------------------------ */
  /*  Queue helpers                                                      */
  /* ------------------------------------------------------------------ */

  queueProductChange(operation: 'insert' | 'update' | 'delete', product: Partial<ProductEntity>) {
    this.queueChange('product', operation, product);
  }

  queueCategoryChange(operation: 'insert' | 'update' | 'delete', category: any) {
    this.queueChange('category', operation, category);
  }

  queueProductChangeInsideTransaction(operation: 'insert' | 'update' | 'delete', product: Partial<ProductEntity>) {
    this.queueChangeInsideTransaction('product', operation, product);
  }

  queueChange(entity: string, operation: 'insert' | 'update' | 'delete', record: any) {
    const id = newId();
    const payload = JSON.stringify(record);
    const version = (record as any).version || 1;
    const tenantId = (record as any).tenant_id !== undefined ? String((record as any).tenant_id) : null;

    this.db.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, entity, operation, record.id, payload, version, tenantId);

    console.log(`[Sync] ${entity} ${operation} queued for ${record.id}`);
  }

  queueChangeInsideTransaction(entity: string, operation: 'insert' | 'update' | 'delete', record: any) {
    const id = newId();
    const payload = JSON.stringify(record);
    const version = (record as any).version || 1;
    const tenantId = (record as any).tenant_id !== undefined ? String((record as any).tenant_id) : null;

    this.db.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, entity, operation, record.id, payload, version, tenantId);
  }

  /* ------------------------------------------------------------------ */
  /*  Main sync cycle                                                     */
  /* ------------------------------------------------------------------ */

  async syncNow(tenantId: string): Promise<{ pushed: number; pulled: number; errors: number }> {
    if (this.isRunning) {
      console.log('[Sync] Sync already in progress');
      return { pushed: 0, pulled: 0, errors: 0 };
    }

    this.isRunning = true;
    let pushed = 0, pulled = 0, errors = 0;

    try {
      // Catégories : Pull d'abord (pour avoir les remote_ids), puis Push
      try {
        pulled += await this.pullByEntityFromSupabase('category', tenantId);
        pushed += await this.pushPendingByEntity('category', tenantId);
      } catch (e: any) {
        console.error('[Sync] Category sync failed (continuing):', e?.message || e);
        errors++;
      }

      // Produits : Bidirectional Sync (Push & Pull)
      try {
        pulled += await this.pullByEntityFromSupabase('product', tenantId);
        pushed += await this.pushPendingByEntity('product', tenantId);
      } catch (e: any) {
        console.error('[Sync] Product sync failed (continuing):', e?.message || e);
        errors++;
      }

    } catch (err: any) {
      console.error('[Sync] Sync cycle failed:', err);
      errors++;
    } finally {
      this.isRunning = false;
    }

    return { pushed, pulled, errors };
  }

  /* ------------------------------------------------------------------ */
  /*  PUSH – Outbox → Supabase                                           */
  /* ------------------------------------------------------------------ */

  async pushPendingByEntity(entity: string, tenantId: string): Promise<number> {
    const table = this.ENTITY_TABLE[entity] || `${entity}s`;
    const items: OutboxItem[] = this.db
      .prepare(
        `SELECT * FROM sync_outbox 
         WHERE entity = ? AND status = 'pending' AND tenant_id = ?
         ORDER BY created_at ASC 
         LIMIT 50`
      )
      .all(entity, tenantId) as unknown as OutboxItem[];

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
          await this.handleUpsert(entity, table, item, payload, recordId, tenantId);
        } else if (item.operation === 'delete') {
          const deleteResult = await this.handleDelete(entity, table, item, payload, recordId);
          
          // VÉRIFIER que la suppression a bien été appliquée dans Supabase (pour les produits)
          if (entity === 'product' && deleteResult) {
            const remoteId = payload.remote_id || this.getRemoteId(table, recordId);
            if (remoteId) {
              try {
                const { data: remoteProduct, error: verifyError } = await this.supabase
                  .from(table)
                  .select('is_available, deleted_at')
                  .eq('id', String(remoteId))
                  .eq('tenant_id', tenantId)
                  .maybeSingle();

                if (verifyError) {
                  console.error(`[Sync] Verification failed for product #${recordId} delete:`, verifyError.message);
                  throw new Error(`Verification failed: ${verifyError.message}`);
                }

                if (!remoteProduct || (remoteProduct.is_available !== false && !remoteProduct.deleted_at)) {
                  console.error(`[Sync] Product #${recordId} deletion NOT verified in Supabase - will retry`);
                  throw new Error('Deletion not verified in Supabase');
                }
              } catch (verifyErr: any) {
                // Ne pas marquer comme 'done' - laisser dans 'pending' pour retry
                this.db.prepare(`UPDATE sync_outbox SET status = 'pending', retry_count = ?, last_error = ? WHERE id = ?`)
                  .run((item.retry_count || 0) + 1, verifyErr.message, item.id);
                continue;
              }
            }
          }
          
          // Purge locale après succès du soft-delete dans Supabase
          // IMPORTANT: Ne pas hard supprimer localement - le soft-delete est déjà fait par l'adapter
          try {
            const checkRow = this.db.prepare(`SELECT deleted_at FROM products WHERE id = ?`).get(recordId) as any;
            if (checkRow && !checkRow.deleted_at) {
              this.db.prepare(`UPDATE products SET deleted_at = ?, is_available = 0, status = 'archived' WHERE id = ?`).run(new Date().toISOString(), recordId);
              console.log(`[Sync] Local soft-delete confirmed for ${entity} #${recordId}`);
            }
          } catch (purgeErr) {
            console.warn(`[Sync] Local purge failed for ${entity} #${recordId}:`, purgeErr);
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

        console.error(`[Sync] Push failed for ${entity} ${item.record_id}:`, err?.message ?? err);

        // Après MAX_RETRIES, archiver dans la DLQ (Faille #7 résolue)
        if (newRetryCount >= 5) {
          this.dlq.archiveFailedItem(item.id, err?.message ?? String(err), newRetryCount);
        }
      }
    }

    return successCount;
  }

  private async handleUpsert(
    entity: string,
    table: string,
    item: OutboxItem,
    payload: any,
    recordId: number,
    tenantId: string
  ) {
    const safeUpdate: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Récupérer le remote_id le plus frais depuis la DB locale (Faille de doublon résolue)
    const currentRemoteId = this.getRemoteId(table, recordId);
    const effectiveRemoteId = payload.remote_id || currentRemoteId;

    // Supabase utilise des UUID (strings) pour les IDs
    if (effectiveRemoteId) {
      safeUpdate.id = String(effectiveRemoteId);
    } else if (item.operation === 'update') {
      // Pour les updates sans remote_id, chercher par natural key
      const existingRemote = await this.findExistingRemoteRecord(table, payload, tenantId);
      if (existingRemote) {
        safeUpdate.id = String(existingRemote.id);
      } else {
        console.warn(`[Sync] Cannot push update for ${entity} #${recordId}: no remote_id and no matching remote record`);
        return;
      }
    }

    if (entity === 'product') {
      const cols = ['name', 'stock_quantity', 'is_available', 'category_id', 'barcode', 'description', 'unit', 'image_url', 'minimum_stock', 'sku', 'status', 'cost_method', 'archived_at', 'tenant_id', 'is_featured', 'sort_order', 'metadata', 'version'];
      cols.forEach(c => {
        if (payload[c] !== undefined) safeUpdate[c] = payload[c];
      });

      // Mappage vers les colonnes Supabase (selling_price / buying_price sont les noms réels pour ce client)
      // On garde 'price' et 'cost_price' en fallbacks au cas où
      if (payload.selling_price !== undefined) safeUpdate.selling_price = payload.selling_price;
      if (payload.price !== undefined && safeUpdate.selling_price === undefined) safeUpdate.selling_price = payload.price;
      
      if (payload.buying_price !== undefined) safeUpdate.buying_price = payload.buying_price;
      if (payload.cost_price !== undefined && safeUpdate.buying_price === undefined) safeUpdate.buying_price = payload.cost_price;

      // Map minimum_stock <-> low_stock_threshold (bidirectionnel)
      if (payload.minimum_stock !== undefined) {
        safeUpdate.low_stock_threshold = payload.minimum_stock;
        delete safeUpdate.minimum_stock;
      }
      if (payload.low_stock_threshold !== undefined && safeUpdate.minimum_stock === undefined) {
        safeUpdate.minimum_stock = payload.low_stock_threshold;
        delete safeUpdate.low_stock_threshold;
      }

      // Map category_id
      if (safeUpdate.category_id) {
        const remoteCatId = this.getRemoteId('categories', safeUpdate.category_id);
        if (remoteCatId) {
          safeUpdate.category_id = remoteCatId;
        } else {
          console.warn(`[Sync] Category ${safeUpdate.category_id} not yet synced for product ${recordId}, falling back to local ID`);
          // On laisse l'ID local en espérant qu'il corresponde si les IDs sont sync ou on l'enlève pour éviter FK error
          delete safeUpdate.category_id;
        }
      }

      if (!safeUpdate.id || !safeUpdate.name) {
        try {
          const row = this.db.prepare('SELECT name FROM products WHERE id = ?').get(recordId) as any;
          if (row?.name) safeUpdate.name = row.name;
        } catch { /* ignore */ }
      }

      if (!safeUpdate.name) {
        console.warn(`[Sync] Skipping product ${recordId} push: missing mandatory "name" field`);
        return; // Abandonner cet item sans crasher le cycle
      }
    } else if (entity === 'category') {
      const cols = ['name', 'description', 'created_at', 'tenant_id'];
      cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
    } else if (entity === 'order') {
      const cols = ['table_id', 'waiter_id', 'customer_id', 'status', 'total', 'items', 'version', 'created_at', 'tenant_id'];
      cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
      
      // Map FKeys
      if (safeUpdate.table_id) {
        const rId = this.getRemoteId('restaurant_tables', safeUpdate.table_id);
        if (!rId) throw new Error(`Table ${safeUpdate.table_id} not yet synced`);
        safeUpdate.table_id = rId;
      }
      if (safeUpdate.waiter_id) {
        const rId = this.getRemoteId('users', safeUpdate.waiter_id);
        if (!rId) throw new Error(`User ${safeUpdate.waiter_id} not yet synced`);
        safeUpdate.waiter_id = rId;
      }

      delete safeUpdate.notes;
      delete safeUpdate.updated_at;
      console.log(`[Sync] Pushing order ${recordId} (remote=${safeUpdate.id}) status=${safeUpdate.status} to Supabase`);
    } else if (entity === 'order_item') {
      const cols = ['order_id', 'product_id', 'quantity', 'unit_price', 'total_price', 'notes', 'tenant_id'];
      cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
      
      // Map FKeys
      if (safeUpdate.order_id) {
        const rId = this.getRemoteId('orders', safeUpdate.order_id);
        if (!rId) throw new Error(`Order ${safeUpdate.order_id} not yet synced`);
        safeUpdate.order_id = rId;
      }
      if (safeUpdate.product_id) {
        const rId = this.getRemoteId('products', safeUpdate.product_id);
        if (!rId) throw new Error(`Product ${safeUpdate.product_id} not yet synced`);
        safeUpdate.product_id = rId;
      }

      delete safeUpdate.updated_at;
    } else if (entity === 'sale') {
      const cols = ['invoice_number', 'order_id', 'user_id', 'customer_id', 'subtotal', 'discount', 'tax', 'total_amount', 'payment_method', 'version', 'created_at', 'tenant_id', 'updated_at'];
      cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });

      // Map FKeys
      if (safeUpdate.order_id) {
        const rId = this.getRemoteId('orders', safeUpdate.order_id);
        if (!rId) throw new Error(`Order ${safeUpdate.order_id} not yet synced`);
        safeUpdate.order_id = rId;
      }
      if (safeUpdate.user_id) {
        const rId = this.getRemoteId('users', safeUpdate.user_id);
        if (!rId) throw new Error(`User ${safeUpdate.user_id} not yet synced`);
        safeUpdate.user_id = rId;
      }

      delete safeUpdate.remote_id;
      console.log(`[Sync] Pushing sale ${recordId} (remote=${safeUpdate.id}) to Supabase`);
    } else if (entity === 'sale_item') {
      const cols = ['sale_id', 'product_id', 'quantity', 'unit_price', 'total_price', 'tenant_id'];
      cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });

      // Map FKeys
      if (safeUpdate.sale_id) {
        const rId = this.getRemoteId('sales', safeUpdate.sale_id);
        if (!rId) throw new Error(`Sale ${safeUpdate.sale_id} not yet synced`);
        safeUpdate.sale_id = rId;
      }
      if (safeUpdate.product_id) {
        const rId = this.getRemoteId('products', safeUpdate.product_id);
        if (!rId) throw new Error(`Product ${safeUpdate.product_id} not yet synced`);
        safeUpdate.product_id = rId;
      }

      delete safeUpdate.updated_at;
      delete safeUpdate.remote_id;
    } else if (entity === 'restaurant_table') {
      await this.handleTableUpsert(item, payload, recordId, tenantId);
      return;
    } else {
      const ignored = new Set(['id', 'remote_id', 'created_at', 'version']);
      Object.keys(payload).forEach((key) => {
        if (!ignored.has(key) && payload[key] !== undefined) {
          safeUpdate[key] = payload[key];
        }
      });
    }

    if (safeUpdate.tenant_id !== undefined && safeUpdate.tenant_id !== null && String(safeUpdate.tenant_id) !== String(tenantId)) {
      safeUpdate.tenant_id = tenantId;
    }

    if (!payload.remote_id && item.operation === 'insert') {
      if (tenantId) {
        // Vérifier si le tenant existe en remote avant de push (Faille FK résolue)
        const { data: remoteTenant } = await this.supabase.from('tenants').select('id').eq('id', tenantId).maybeSingle();
        if (!remoteTenant) {
          console.warn(`[Sync] Skipping ${entity} push: Tenant #${tenantId} does not exist in Supabase.`);
          return;
        }
        safeUpdate.tenant_id = tenantId;
      }
    }

    const { data, error } = await this.supabase
      .from(table)
      .upsert(safeUpdate)
      .select('id')
      .single();

    if (error) throw error;

    // Sauvegarder remote_id si c'était un nouvel enregistrement
    if (!payload.remote_id && data?.id) {
      this.db.prepare(`UPDATE ${table} SET remote_id = ? WHERE id = ?`).run(data.id, recordId);
    }
  }

  private async handleTableUpsert(
    item: OutboxItem,
    payload: any,
    recordId: number,
    tenantId: string
  ) {
    const table = 'restaurant_tables';
    const safeUpdate: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    const cols = ['table_number', 'capacity', 'status', 'assigned_waiter_id', 'qr_token', 'created_at', 'tenant_id'];
    cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });

    // 1. Resolve waiter_id to remote_id (Supabase needs the remote User ID)
    if (safeUpdate.assigned_waiter_id) {
      const rId = this.getRemoteId('users', safeUpdate.assigned_waiter_id);
      if (rId) {
        safeUpdate.assigned_waiter_id = rId;
      } else {
        // If waiter isn't synced yet, we MUST skip or nullify to avoid FK violation
        console.warn(`[Sync] Waiter ${safeUpdate.assigned_waiter_id} not yet synced. Nullifying for table ${safeUpdate.table_number}`);
        safeUpdate.assigned_waiter_id = null;
      }
    }

    // Status mapping: local 'active' -> remote 'occupied'
    if (safeUpdate.status === 'active') safeUpdate.status = 'occupied';
    if (safeUpdate.status === 'out_of_service') safeUpdate.status = 'available';

    // 2. Identify if this table already exists in Supabase (by natural key)
    let existingRemoteId = payload.remote_id || this.getRemoteId(table, recordId);
    
    if (!existingRemoteId) {
      const { data: remoteMatch } = await this.supabase
        .from(table)
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('table_number', String(safeUpdate.table_number))
        .maybeSingle();
      
      if (remoteMatch?.id) {
        existingRemoteId = remoteMatch.id;
        console.log(`[Sync] Found existing remote table for "${safeUpdate.table_number}" (id=${existingRemoteId})`);
      }
    }

    if (existingRemoteId) {
      safeUpdate.id = existingRemoteId;
    } else {
      delete safeUpdate.id; // Let Supabase generate ID
    }

    if (tenantId) safeUpdate.tenant_id = tenantId;

    // 3. Perform the Push
    const { data, error } = await this.supabase
      .from(table)
      .upsert(safeUpdate)
      .select('id')
      .single();

    if (error) {
      // Handle race conditions on table_number
      if (error.code === '23505') {
        console.warn(`[Sync] Conflict on table_number "${safeUpdate.table_number}". Re-trying fetch.`);
        const { data: refetch } = await this.supabase.from(table).select('id').eq('tenant_id', tenantId).eq('table_number', String(safeUpdate.table_number)).single();
        if (refetch?.id) {
          this.db.prepare(`UPDATE ${table} SET remote_id = ? WHERE id = ?`).run(refetch.id, recordId);
          return;
        }
      }
      throw error;
    }

    // 4. Record the remote_id locally
    if (data?.id) {
      this.db.prepare(`UPDATE ${table} SET remote_id = ? WHERE id = ?`).run(data.id, recordId);
    }
  }

  private async handleDelete(
    entity: string,
    table: string,
    item: OutboxItem,
    payload: any,
    recordId: number
  ): Promise<boolean> {
    const tenantId = payload.tenant_id ? Number(payload.tenant_id) : null;
    
    // Déterminer la requête de base selon le type d'entité
    let queryBuilder;
    let targetId: string | number | null = null;
    let shouldProceed = true;

    if (entity === 'product') {
      // Récupérer le remote_id depuis la DB locale si non présent dans le payload
      const localRemoteId = this.getRemoteId(table, recordId);
      targetId = payload.remote_id || localRemoteId || recordId;
      
      // Si on n'a pas de remote_id, essayer de trouver par clé naturelle (nom + tenant)
      if (!payload.remote_id && !localRemoteId && payload.name && tenantId) {
        try {
          const { data: existingProduct } = await this.supabase
            .from(table)
            .select('id')
            .eq('name', payload.name)
            .eq('tenant_id', tenantId)
            .maybeSingle();
          if (existingProduct?.id) {
            targetId = existingProduct.id;
            console.log(`[Sync] Found remote product by name for #${recordId}: remote_id=${targetId}`);
          }
        } catch (err: any) {
          console.warn(`[Sync] Failed to find remote product by name:`, err.message);
        }
      }
      
      // Si on n'a toujours pas de remote_id, c'est que le produit n'a jamais été synchronisé
      // Dans ce cas, on ne fait rien dans Supabase (le produit n'y existe pas)
      if (!targetId || targetId === recordId) {
        console.warn(`[Sync] Product #${recordId} has no remote_id - skipping remote delete (never synced to Supabase)`);
        shouldProceed = false;
      } else {
        // Utiliser le targetId trouvé
        targetId = targetId;
      }
      
      if (shouldProceed) {
        // Vérifier que le produit existe dans Supabase avant de tenter le soft delete
        const { data: existingProduct, error: checkError } = await this.supabase
          .from(table)
          .select('id, is_available, deleted_at')
          .eq('id', String(targetId))
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (checkError) {
          console.error(`[Sync] Failed to check product existence in Supabase:`, checkError.message);
          throw checkError;
        }

        if (!existingProduct) {
          console.warn(`[Sync] Product #${recordId} (remote=${targetId}) not found in Supabase - skipping remote delete`);
          shouldProceed = false;
        } else if (existingProduct.is_available === false && existingProduct.deleted_at) {
          // Déjà supprimé dans Supabase
          console.log(`[Sync] Product #${recordId} (remote=${targetId}) already soft-deleted in Supabase`);
          shouldProceed = false;
        }
      }
      
      if (shouldProceed) {
        // Soft delete dans Supabase avec is_available + deleted_at pour cohérence
        queryBuilder = this.supabase
          .from(table)
          .update({
            is_available: false,
            status: 'archived',
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      } else {
        // Retourner sans faire de requête
        console.log(`[Sync] Skipping delete for product #${recordId} (shouldProceed=false)`);
        return false;
      }
    } else if (entity === 'order') {
      targetId = payload.remote_id || recordId;
      // Soft delete (status = 'cancelled')
      queryBuilder = this.supabase
        .from(table)
        .update({ status: 'cancelled', updated_at: new Date().toISOString() });
    } else if (entity === 'restaurant_table') {
      targetId = payload.remote_id || recordId;
      // Soft delete (status = 'removed')
      queryBuilder = this.supabase
        .from(table)
        .update({ status: 'removed', updated_at: new Date().toISOString() });
    } else {
      targetId = payload.remote_id || recordId;
      // Suppression physique pour les autres entités
      queryBuilder = this.supabase
        .from(table)
        .delete();
    }

    // CRITIQUE: Toujours filtrer par id ET tenant_id pour éviter les suppressions cross-tenant
    queryBuilder = queryBuilder.eq('id', String(targetId));
    if (tenantId) {
      queryBuilder = queryBuilder.eq('tenant_id', tenantId);
    }

    const { error } = await queryBuilder;
    if (error) throw error;
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  PULL – Supabase → Outbox                                           */
  /* ------------------------------------------------------------------ */

  private async pullByEntityFromSupabase(entity: string, tenantId: string): Promise<number> {
    const table = this.ENTITY_TABLE[entity];
    if (!table) return 0;

    // Utilisation du curseur persistant (Faille #2 résolue)
    const since = this.cursor.getOrEpoch(entity);

    let query = this.supabase
      .from(table)
      .select('*')
      .eq('tenant_id', tenantId)
      .gt('updated_at', since)
      .order('updated_at', { ascending: true });

    let { data, error } = await query;

    if (error && error.message?.includes('updated_at')) {
      console.warn(`[Sync] Pulling ${entity} without updated_at column (using created_at fallback)...`);
      query = this.supabase
        .from(table)
        .select('*')
        .eq('tenant_id', tenantId)
        .gt('created_at', since)
        .order('created_at', { ascending: true });
      ({ data, error } = await query);
    }

    if (error) {
      console.error(`[Sync] Failed to pull ${entity} from Supabase:`, error.message);
      return 0;
    }

    let applied = 0;
    const allowedFields = this.getAllowedFields(entity);

    for (const remote of (data || []) as Array<{ id: any; [key: string]: any }>) {
      try {
        if (remote.tenant_id && String(remote.tenant_id) !== String(tenantId)) continue;

        const remoteId = Number(remote?.id);
        if (isNaN(remoteId)) continue;

        const local = this.findLocalRow(entity, table, remoteId, remote);
        const remoteUpdatedAt = remote.updated_at;
        const localVersion = local?.version || 0;
        const remoteVersion = remote.version || 0;

        // Détection de conflit (Faille #1 résolue)
        if (local) {
          const conflict = this.conflictResolver.detectConflict(
            entity, local.id, remoteId,
            local.updated_at || new Date(0).toISOString(),
            remoteUpdatedAt ? (remoteUpdatedAt instanceof Date ? remoteUpdatedAt.toISOString() : String(remoteUpdatedAt)) : new Date().toISOString(),
            localVersion, remoteVersion
          );

          if (conflict) {
            console.warn(`[Sync] ${entity} #${remoteId} conflict detected (local v${localVersion} vs remote v${remoteVersion})`);

            // Résolution automatique par Last-Writer-Wins
            const winner = this.conflictResolver.resolveLWW(
              localVersion, remoteVersion,
              local.updated_at || new Date(0).toISOString(),
              remoteUpdatedAt ? (remoteUpdatedAt instanceof Date ? remoteUpdatedAt.toISOString() : String(remoteUpdatedAt)) : new Date().toISOString()
            );

            if (winner === 'local_wins') {
              console.log(`[Sync] ${entity} #${remoteId}: local wins, skipping remote update`);
              applied++;
              continue;
            }
          }
        }

        // DÉTECTER LES SOFT DELETES - Toujours appliquer si le remote est supprimé
        const isRemoteSoftDeleted = entity === 'product' && 
          (remote.is_available === false || remote.deleted_at !== null);
        
        // Vérifier si le remote est plus récent OU si c'est un soft delete
        const shouldApply = !local || !local.updated_at ||
          (remoteUpdatedAt && remoteUpdatedAt > local.updated_at) ||
          isRemoteSoftDeleted;

        if (!shouldApply) continue;

        const safeFields: Record<string, any> = {
          tenant_id: remote.tenant_id,
          remote_id: remoteId, // Faille de doublon: On doit mapper le remote_id pour éviter le re-push
          updated_at: remoteUpdatedAt
            ? (remoteUpdatedAt instanceof Date ? remoteUpdatedAt.toISOString() : String(remoteUpdatedAt))
            : new Date().toISOString(),
        };

        // Version tracking
        if (remote.version !== undefined) {
          safeFields.version = remote.version;
        }

        // Pour les soft deletes, s'assurer que is_available et deleted_at sont inclus
        if (isRemoteSoftDeleted) {
          safeFields.is_available = false;
          safeFields.deleted_at = remote.deleted_at || new Date().toISOString();
        }

        allowedFields.forEach(field => {
          if (remote[field] !== undefined) {
            safeFields[field] = remote[field];
          }
        });

        // Special mappings for Products
        if (entity === 'product') {
          if (remote.price !== undefined && remote.selling_price === undefined) {
            safeFields.selling_price = remote.price;
          }
          if (remote.selling_price !== undefined && safeFields.price === undefined) {
            safeFields.price = remote.selling_price;
          }
          if (remote.cost_price !== undefined && remote.buying_price === undefined) {
            safeFields.buying_price = remote.cost_price;
          }
          // Map low_stock_threshold -> minimum_stock pour la compatibilité locale
          if (remote.low_stock_threshold !== undefined && safeFields.minimum_stock === undefined) {
            safeFields.minimum_stock = remote.low_stock_threshold;
          }
          // S'assurer que deleted_at est inclus si présent
          if (remote.deleted_at !== undefined) {
            safeFields.deleted_at = remote.deleted_at;
          }
          // S'assurer que is_available est inclus si présent
          if (remote.is_available !== undefined) {
            safeFields.is_available = remote.is_available;
          }
        }

        await this.applyRemoteRow(entity, table, safeFields, local, remoteId, remoteUpdatedAt, remote.tenant_id);
        
        if (isRemoteSoftDeleted) {
          console.log(`[Sync] Soft-delete applied for ${entity} #${remoteId} from Supabase`);
        }
        
        applied++;

      } catch (perItemErr: any) {
        console.error(`[Sync] Error processing remote ${entity} in pull:`, perItemErr?.message || perItemErr);
      }
    }

    // Sauvegarder le curseur persistant (Faille #2 résolue)
    if (data && data.length > 0) {
      const lastUpdatedAt = data[data.length - 1].updated_at;
      const lastTs = lastUpdatedAt instanceof Date ? lastUpdatedAt.toISOString() : String(lastUpdatedAt || '');
      this.cursor.set(entity, lastTs);
    }

    return applied;
  }

  private findLocalRow(
    entity: string,
    table: string,
    remoteId: number,
    remote: any
  ): { id: number; updated_at: string; version: number } | undefined {
    try {
      // 1) Chercher d'abord par remote_id (le plus fiable)
      const byRemote = this.db.prepare(
        `SELECT id, updated_at, version FROM ${table} WHERE remote_id = ?`
      ).get(remoteId) as { id: number; updated_at: string; version: number } | undefined;

      if (byRemote) return byRemote;

      // 2) Chercher par id local
      const byLocalId = this.db.prepare(
        `SELECT id, updated_at, version FROM ${table} WHERE id = ?`
      ).get(remoteId) as { id: number; updated_at: string; version: number } | undefined;

      if (byLocalId) return byLocalId;

      // 3) Natural Key Matching (Évite les doublons sur name/slug)
      if (entity === 'product' && remote.name && remote.tenant_id) {
        return this.db.prepare(
          `SELECT id, updated_at, version FROM products WHERE name = ? AND tenant_id = ?`
        ).get(remote.name, remote.tenant_id) as { id: number; updated_at: string; version: number } | undefined;
      }

      if (entity === 'category' && remote.name && remote.tenant_id) {
        return this.db.prepare(
          `SELECT id, updated_at, version FROM categories WHERE name = ? AND tenant_id = ?`
        ).get(remote.name, remote.tenant_id) as { id: number; updated_at: string; version: number } | undefined;
      }

      if (entity === 'restaurant_table' && remote.table_number && remote.tenant_id) {
        return this.db.prepare(
          `SELECT id, updated_at, version FROM restaurant_tables WHERE table_number = ? AND tenant_id = ?`
        ).get(String(remote.table_number), remote.tenant_id) as { id: number; updated_at: string; version: number } | undefined;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private async applyRemoteRow(
    entity: string,
    table: string,
    safeFields: Record<string, any>,
    local: { id: number; updated_at: string; version: number } | undefined,
    remoteId: number,
    remoteUpdatedAt: any,
    tenantId?: number
  ) {
    const sanitize = (val: any) => {
      if (val === undefined || val === null) return null;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'boolean') return val ? 1 : 0;
      // Conserver les strings ISO (comme deleted_at) telles quelles
      if (typeof val === 'string' && (val.endsWith('Z') || val.includes('T'))) {
        return val;
      }
      return val;
    };

    const updateFields = Object.keys(safeFields);
    if (updateFields.length === 0) return;

    // NE PAS inclure remoteId dans les SET, il va dans WHERE
    const setClauses = updateFields.map(k => `"${k}" = ?`).join(', ');
    const updateValues = updateFields.map(k => sanitize(safeFields[k]));

    // Déterminer la PK locale pour le WHERE - inclure tenant_id pour isolation
    const pk = local ? local.id : remoteId;

    // Construire la requête avec filtre tenant_id si disponible
    let whereClause = 'WHERE id = ?';
    let whereValues: any[] = [pk];
    if (tenantId !== undefined && entity === 'restaurant_table') {
      whereClause = 'WHERE id = ? AND tenant_id = ?';
      whereValues = [pk, tenantId];
    }

    // Tentative UPDATE d'abord
    const updateResult = this.db.prepare(`
      UPDATE ${table} SET ${setClauses} ${whereClause}
    `).run(...updateValues, ...whereValues);

    if (updateResult.changes === 0) {
      // Fallback: INSERT (en ignorant les erreurs de contrainte)
      const insertKeys = ['id', ...updateFields];
      const insertParams = [pk, ...updateValues];
      try {
        this.db.prepare(`
          INSERT INTO ${table} (${insertKeys.map(c => `"${c}"`).join(', ')})
          VALUES (${insertParams.map(() => '?').join(', ')})
        `).run(...insertParams);
      } catch (insertErr: any) {
        // Si l'insert échoue (PK existe déjà mais avec id différent), tenter un UPDATE sur existing
        if (insertErr?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
          let existing: { id: number } | undefined;
          if (entity === 'restaurant_table' && tenantId !== undefined) {
            existing = this.db.prepare(
              `SELECT id FROM ${table} WHERE id = ? AND tenant_id = ?`
            ).get(pk, tenantId) as { id: number } | undefined;
          } else {
            existing = this.db.prepare(
              `SELECT id FROM ${table} WHERE id = ? OR remote_id = ?`
            ).get(pk, pk) as { id: number } | undefined;
          }
          if (existing) {
            this.db.prepare(`UPDATE ${table} SET ${setClauses} WHERE id = ?`)
              .run(...updateValues, existing.id);
          }
        } else {
          throw insertErr;
        }
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                             */
  /* ------------------------------------------------------------------ */

  private getAllowedFields(entity: string): string[] {
    const common = ['updated_at', 'created_at', 'tenant_id', 'version', 'remote_id'];
    if (entity === 'product') {
      return [...common,
        'name', 'stock_quantity', 'selling_price', 'buying_price', 'is_available',
        'category_id', 'barcode', 'description', 'unit', 'image_url',
        'minimum_stock', 'low_stock_threshold', 'sku', 'status', 'cost_method', 
        'archived_at', 'price', 'deleted_at', 'is_featured', 'sort_order', 'metadata'
      ];
    }
    if (entity === 'category') {
      return [...common, 'name', 'description'];
    }
    if (entity === 'order') {
      return [...common, 'table_id', 'waiter_id', 'customer_id', 'status', 'total', 'items', 'source'];
    }
    if (entity === 'order_item') {
      return [...common, 'order_id', 'product_id', 'quantity', 'unit_price', 'total_price', 'notes'];
    }
    if (entity === 'sale') {
      return [...common, 'invoice_number', 'order_id', 'user_id', 'customer_id', 'subtotal', 'discount', 'tax', 'total_amount', 'payment_method'];
    }
    if (entity === 'sale_item') {
      return [...common, 'sale_id', 'product_id', 'quantity', 'unit_price', 'total_price'];
    }
    return common;
  }

  /**
   * Find existing remote record by natural key (e.g., product name + tenant)
   * Used when pushing updates for records that may not have a remote_id yet
   */
  private async findExistingRemoteRecord(table: string, payload: any, tenantId: string): Promise<any | null> {
    if (table === 'products' && payload.name && tenantId) {
      const { data } = await this.supabase
        .from('products')
        .select('id')
        .eq('name', payload.name)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    }
    if (table === 'categories' && payload.name && tenantId) {
      const { data } = await this.supabase
        .from('categories')
        .select('id')
        .eq('name', payload.name)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    }
    return null;
  }

  async forceFullPull(tenantId: string): Promise<number> {
    this.cursor.reset();
    let pulled = await this.pullByEntityFromSupabase('category', tenantId);
    pulled += await this.pullByEntityFromSupabase('product', tenantId);
    return pulled;
  }
}