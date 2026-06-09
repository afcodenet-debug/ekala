import type Database from 'better-sqlite3';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProductEntity } from '../server/products/types/product.types'; // Réutilisation des types backend

function newId(): string {
  // Node >= 19: randomUUID exists; fallback to crypto.randomUUID-like.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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
}

export class ProductSyncService {
  private db: Database.Database;
  private supabase: SupabaseClient;
  private isRunning = false;
  private lastPullTimestamp: string | null = null;

  private readonly ENTITY_TABLE: Record<string, string> = {
    product: 'products',
    category: 'categories',
    order: 'orders',
    order_item: 'order_items',
    restaurant_table: 'restaurant_tables',
  };

  constructor(db: Database.Database, supabaseUrl: string, supabaseAnonKey: string) {
    this.db = db;
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  /**
   * Helper pour obtenir le mapping des colonnes par entité pour le PULL
   */
  private getAllowedFields(entity: string): string[] {
    if (entity === 'product') {
      return [
        'name', 'stock_quantity', 'selling_price', 'buying_price', 'is_available', 
        'category_id', 'barcode', 'description', 'unit', 'image_url', 
        'minimum_stock', 'sku', 'status', 'cost_method', 'archived_at', 'updated_at'
      ];
    }
    if (entity === 'category') {
      return ['name', 'description', 'updated_at', 'created_at'];
    }
    return ['updated_at'];
  }

  /**
   * Enregistre une modification produit dans l'outbox.
   */
  queueProductChange(operation: 'insert' | 'update' | 'delete', product: Partial<ProductEntity>) {
    this.queueChange('product', operation, product);
  }

  /**
   * Enregistre une modification catégorie dans l'outbox.
   */
  queueCategoryChange(operation: 'insert' | 'update' | 'delete', category: any) {
    this.queueChange('category', operation, category);
  }

  /**
   * Version interne à utiliser uniquement à l'intérieur d'une transaction déjà ouverte.
   */
  queueProductChangeInsideTransaction(operation: 'insert' | 'update' | 'delete', product: Partial<ProductEntity>) {
    this.queueChangeInsideTransaction('product', operation, product);
  }

  /**
   * Generic queue for any supported entity
   */
  queueChange(entity: string, operation: 'insert' | 'update' | 'delete', record: any) {
    const id = newId();
    const payload = JSON.stringify(record);
    const version = (record as any).version || 1;

    this.db.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, entity, operation, record.id, payload, version);

    console.log(`[Sync] ${entity} ${operation} queued for ${record.id}`);
  }

  /**
   * Generic queue to be called ONLY from inside an already-open SQLite transaction.
   */
  queueChangeInsideTransaction(entity: string, operation: 'insert' | 'update' | 'delete', record: any) {
    const id = newId();
    const payload = JSON.stringify(record);
    const version = (record as any).version || 1;

    this.db.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, entity, operation, record.id, payload, version);
  }

  /**
   * Lance le cycle de synchronisation complet (PUSH + PULL)
   */
  async syncNow(_businessId: string): Promise<{ pushed: number; pulled: number; errors: number }> {
    if (this.isRunning) {
      console.log('[Sync] Sync already in progress');
      return { pushed: 0, pulled: 0, errors: 0 };
    }

    this.isRunning = true;
    let pushed = 0, pulled = 0, errors = 0;

    try {
      // 0. Sync Categories (Pull then Push to ensure IDs exist locally first)
      pulled += await this.pullByEntityFromSupabase('category', _businessId);
      pushed += await this.pushPendingByEntity('category', _businessId);

      // 1. Sync Products (Push + Pull)
      pushed += await this.pushPendingByEntity('product', _businessId);
      pulled += await this.pullByEntityFromSupabase('product', _businessId);

    } catch (err: any) {
      console.error('[Sync] Sync cycle failed:', err);
      errors++;
    } finally {
      this.isRunning = false;
    }

    return { pushed, pulled, errors };
  }

  /**
   * Generic PUSH for any entity using outbox + version-safe upsert
   */
  async pushPendingByEntity(entity: string, _businessId: string): Promise<number> {
    const table = this.ENTITY_TABLE[entity] || `${entity}s`;
    const items: OutboxItem[] = this.db
      .prepare(
        `SELECT * FROM sync_outbox 
         WHERE entity = ? AND status = 'pending' 
         ORDER BY created_at ASC 
         LIMIT 50`
      )
      .all(entity) as unknown as OutboxItem[];

    let successCount = 0;

    for (const item of items) {
      // Mark as in_progress for crash detection + partial failure safety
      this.db.prepare(`UPDATE sync_outbox SET status = 'in_progress' WHERE id = ?`).run(item.id);

      try {
        const payload = JSON.parse(item.payload);

        // Normalize record_id (outbox stores it as TEXT, Supabase products.id is bigint)
        const recordId = Number(item.record_id);
        if (isNaN(recordId)) {
          console.warn(`[Sync] Skipping invalid record_id in outbox: ${item.record_id} for ${entity}`);
          this.db.prepare(`UPDATE sync_outbox SET status = 'failed', last_error = 'invalid record_id' WHERE id = ?`).run(item.id);
          continue;
        }

        if (item.operation === 'insert' || item.operation === 'update') {
          const safeUpdate: Record<string, any> = {
            updated_at: new Date().toISOString()
          };

          // Use remote_id if available
          if (payload.remote_id) {
            safeUpdate.id = Number(payload.remote_id);
          } else if (item.operation === 'update') {
            safeUpdate.id = recordId;
          }

          // Strict column filtering based on entity
          if (entity === 'product') {
            const cols = ['name', 'stock_quantity', 'selling_price', 'buying_price', 'is_available', 'category_id', 'barcode', 'description', 'unit', 'image_url', 'minimum_stock', 'sku', 'status', 'cost_method', 'archived_at'];
            cols.forEach(c => { 
              if (payload[c] !== undefined) safeUpdate[c] = payload[c]; 
              // Map cost_price to buying_price if needed
              if (c === 'buying_price' && payload.cost_price !== undefined) safeUpdate.buying_price = payload.cost_price;
              // Map price to selling_price if needed
              if (c === 'selling_price' && payload.price !== undefined) safeUpdate.selling_price = payload.price;
            });
            
            if (!safeUpdate.id || !safeUpdate.name) {
               try {
                 const row = this.db.prepare('SELECT name FROM products WHERE id = ?').get(recordId) as any;
                 if (row?.name) safeUpdate.name = row.name;
               } catch {}
            }
          } 
          else if (entity === 'category') {
            const cols = ['name', 'description', 'created_at'];
            cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
          }
          else if (entity === 'order') {
            const cols = ['table_id', 'waiter_id', 'customer_id', 'status', 'total', 'items', 'version', 'created_at', 'notes'];
            cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
            console.log(`[Sync] Pushing order ${recordId} (remote=${safeUpdate.id}) status=${safeUpdate.status} to Supabase`);
          } 
          else if (entity === 'order_item') {
            // order_items table in Supabase does NOT have a 'name' column
            const cols = ['order_id', 'product_id', 'quantity', 'unit_price', 'total_price', 'notes', 'created_at'];
            cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
          }
else if (entity === 'restaurant_table') {
            const cols = ['table_number', 'capacity', 'status', 'assigned_waiter_id', 'qr_token', 'created_at'];
            cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
            
            // Status mapping: local 'active' -> remote 'occupied' (Supabase CHECK constraint)
            if (safeUpdate.status === 'active') safeUpdate.status = 'occupied';
            // local 'out_of_service' -> remote 'available' (or keep if Supabase supports it, but migration says no)
            if (safeUpdate.status === 'out_of_service') safeUpdate.status = 'available';

            if (!payload.remote_id && item.operation === 'insert') {
              // For new tables, don't include id - let Supabase auto-generate
              // The unique key is table_number, so we upsert on table_number
              delete safeUpdate.id;
              
              // Include business_id if available to ensure correct ownership on Supabase
              if (_businessId) safeUpdate.business_id = _businessId;

              console.log(`[Sync] Pushing new table "${safeUpdate.table_number}" to Supabase...`);
              const { data, error } = await this.supabase
                .from(table)
                .upsert(safeUpdate, { onConflict: 'table_number' })
                .select('id')
                .single();

              if (error) {
                // If it's a duplicate key error, that's fine - the table exists remotely
                if (error.code !== '23505') throw error;
                console.log(`[Sync] Table "${safeUpdate.table_number}" already exists in Supabase, marking as done locally`);
              } else if (data?.id) {
                // Save remote_id locally
                this.db.prepare(`UPDATE ${table} SET remote_id = ? WHERE id = ?`).run(data.id, recordId);
                console.log(`[Sync] Table "${safeUpdate.table_number}" pushed to Supabase (remote_id=${data.id})`);
              }

              // Mark as successfully pushed
              this.db.prepare(`UPDATE sync_outbox SET status = 'done' WHERE id = ?`).run(item.id);
              successCount++;
              continue; 
            } else if (item.operation === 'update') {
              // For updates, use the remote_id if we have it, otherwise fallback to recordId
              safeUpdate.id = payload.remote_id || recordId;
              if (_businessId) safeUpdate.business_id = _businessId;
              
              console.log(`[Sync] Updating table "${safeUpdate.table_number}" (id=${safeUpdate.id}) in Supabase...`);
              const { data, error } = await this.supabase
                .from(table)
                .upsert(safeUpdate, { onConflict: 'table_number' })
                .select('id')
                .single();

              if (error) {
                console.error(`[Sync] Table update failed for "${safeUpdate.table_number}":`, error);
                throw error;
              }
              
              if (!payload.remote_id && data?.id) {
                this.db.prepare(`UPDATE ${table} SET remote_id = ? WHERE id = ?`).run(data.id, recordId);
              }

              this.db.prepare(`UPDATE sync_outbox SET status = 'done' WHERE id = ?`).run(item.id);
              successCount++;
              continue;
            }
          }

          // Use upsert to handle both insert and update
          const { data, error } = await this.supabase
            .from(table)
            .upsert(safeUpdate)
            .select('id')
            .single();

          if (error) throw error;

          // Save remote_id locally if it was a new record
          if (!payload.remote_id && data?.id) {
            this.db.prepare(`UPDATE ${table} SET remote_id = ? WHERE id = ?`).run(data.id, recordId);
          }
        } else if (item.operation === 'delete') {
          if (entity === 'order_item') {
            // Actual deletion for order items (normalized items)
            const { error } = await this.supabase
              .from(table)
              .delete()
              .eq('id', recordId);

            if (error) throw error;
          } else {
            // Soft-delete for products and orders
            const safeDelete: Record<string, any> = { 
              updated_at: new Date().toISOString() 
            };
            if (entity === 'product') safeDelete.is_available = 0;
            if (entity === 'order')   safeDelete.status = 'cancelled';

            const { error } = await this.supabase
              .from(table)
              .update(safeDelete)
              .eq('id', recordId);

            if (error) throw error;
          }
        }

        // Mark as successfully pushed
        this.db.prepare(`UPDATE sync_outbox SET status = 'done' WHERE id = ?`).run(item.id);
        successCount++;
      } catch (err: any) {
        this.db.prepare(`
          UPDATE sync_outbox 
          SET status = 'failed', retry_count = retry_count + 1, last_error = ?
          WHERE id = ?
        `).run(err?.message ?? String(err), item.id);

        console.error(`[Sync] Push failed for ${entity} ${item.record_id}:`, err?.message ?? err);
      }
    }

    return successCount;
  }

  /**
   * PULL : Récupère les changements depuis Supabase et les applique en local
   * Version générique pour Produits et Catégories
   */
  private async pullByEntityFromSupabase(entity: string, _businessId: string): Promise<number> {
    const table = this.ENTITY_TABLE[entity];
    if (!table) return 0;

    // Use a unique cursor per entity if possible, or fallback to the general one
    // For now we use the general cursor to maintain compatibility with existing state
    const since = this.lastPullTimestamp || new Date(0).toISOString();

    const { data, error } = await this.supabase
      .from(table)
      .select('*')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true });

    if (error) throw error;

    let applied = 0;
    const allowedFields = this.getAllowedFields(entity);

    for (const remote of (data || []) as Array<{ id: any; [key: string]: any }>) {
      try {
        const remoteId = Number(remote?.id);
        if (isNaN(remoteId)) continue;

        const local = this.db
          .prepare(`SELECT updated_at FROM ${table} WHERE id = ?`)
          .get(remoteId) as { updated_at?: string } | undefined;

        const remoteUpdatedAt = remote.updated_at;
        const shouldApply = !local || !local.updated_at || (remoteUpdatedAt && remoteUpdatedAt > local.updated_at);

        if (shouldApply) {
          const safeFields: Record<string, any> = {};

          // Ensure updated_at is properly formatted
          safeFields.updated_at = remoteUpdatedAt
            ? (remoteUpdatedAt instanceof Date ? remoteUpdatedAt.toISOString() : String(remoteUpdatedAt))
            : new Date().toISOString();

          // Map and filter fields
          allowedFields.forEach(field => {
            if (remote[field] !== undefined) {
              safeFields[field] = remote[field];
            }
          });

          // Special mapping for Products
          if (entity === 'product') {
            // Map 'price' -> 'selling_price' if selling_price is missing in remote payload but price is there
            if (remote.price !== undefined && remote.selling_price === undefined) {
              safeFields.selling_price = remote.price;
            }
            // Map 'cost_price' -> 'buying_price'
            if (remote.cost_price !== undefined && remote.buying_price === undefined) {
              safeFields.buying_price = remote.cost_price;
            }
          }

          const sanitize = (val: any) => {
            if (val === undefined || val === null) return null;
            if (val instanceof Date) return val.toISOString();
            if (typeof val === 'boolean') return val ? 1 : 0;
            return val;
          };

          const updateFields = Object.keys(safeFields).filter(k => allowedFields.includes(k) || k === 'updated_at');
          if (updateFields.length === 0) {
            applied++;
            continue;
          }

          const setClauses = updateFields.map(k => `"${k}" = ?`).join(', ');
          const updateParams = updateFields.map(k => sanitize(safeFields[k])).concat([remoteId]);

          const updateResult = this.db.prepare(`
            UPDATE ${table} SET ${setClauses} WHERE id = ?
          `).run(...updateParams);

          if (updateResult.changes === 0) {
            const insertKeys = ['id', ...updateFields];
            const insertParams = [remoteId, ...updateFields.map(k => sanitize(safeFields[k]))];
            this.db.prepare(`
              INSERT INTO ${table} (${insertKeys.map(c => `"${c}"`).join(', ')})
              VALUES (${insertParams.map(() => '?').join(', ')})
            `).run(...insertParams);
          }

          applied++;
        }
      } catch (perItemErr: any) {
        console.error(`[Sync] Error processing remote ${entity} in pull:`, perItemErr?.message || perItemErr);
      }
    }

    if (data && data.length > 0) {
      const lastUpdatedAt = data[data.length - 1].updated_at;
      const lastTs = lastUpdatedAt instanceof Date ? lastUpdatedAt.toISOString() : String(lastUpdatedAt || '');
      if (!this.lastPullTimestamp || lastTs > this.lastPullTimestamp) {
        this.lastPullTimestamp = lastTs;
      }
    }

    return applied;
  }

  /**
   * PUSH : Envoie les changements en attente vers Supabase (Products)
   * Delegates to the generic implementation for DRY + future entities
   */
  private async pushPendingProducts(_businessId: string): Promise<number> {
    return this.pushPendingByEntity('product', _businessId);
  }

  /**
   * PULL : Récupère les changements depuis Supabase et les applique en local
   * Legacy method maintained for compatibility
   */
  private async pullProductsFromSupabase(_businessId: string): Promise<number> {
    return this.pullByEntityFromSupabase('product', _businessId);
  }

  /**
   * Méthode utilitaire pour forcer un pull complet (utile après reconnexion longue)
   */
  async forceFullPull(_businessId: string): Promise<number> {
    this.lastPullTimestamp = null;
    let pulled = await this.pullByEntityFromSupabase('category', _businessId);
    pulled += await this.pullByEntityFromSupabase('product', _businessId);
    return pulled;
  }

  /** Reset the in-memory pull cursor so the next sync cycle will pull everything */
  resetPullCursor(): void {
    this.lastPullTimestamp = null;
  }
}
