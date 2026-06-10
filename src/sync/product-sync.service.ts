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
    restaurant_table: 'restaurant_tables',
  };

  constructor(db: Database.Database, supabaseUrl: string, supabaseAnonKey: string) {
    this.db = db;
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.cursor = new SyncPersistedCursor(db, 'last_pull_');
    this.conflictResolver = new ConflictResolver(db);
    this.dlq = new DeadLetterQueue(db);
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

    this.db.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, entity, operation, record.id, payload, version);

    console.log(`[Sync] ${entity} ${operation} queued for ${record.id}`);
  }

  queueChangeInsideTransaction(entity: string, operation: 'insert' | 'update' | 'delete', record: any) {
    const id = newId();
    const payload = JSON.stringify(record);
    const version = (record as any).version || 1;

    this.db.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, entity, operation, record.id, payload, version);
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

      // Produits : Push d'abord (pour envoyer les modifs locales), puis Pull
      try {
        pushed += await this.pushPendingByEntity('product', tenantId);
        pulled += await this.pullByEntityFromSupabase('product', tenantId);
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
         WHERE entity = ? AND status = 'pending' 
         ORDER BY created_at ASC 
         LIMIT 50`
      )
      .all(entity) as unknown as OutboxItem[];

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
          await this.handleDelete(entity, table, item, recordId);
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

    if (payload.remote_id) {
      safeUpdate.id = Number(payload.remote_id);
    } else if (item.operation === 'update') {
      safeUpdate.id = recordId;
    }

    if (entity === 'product') {
      const cols = ['name', 'stock_quantity', 'selling_price', 'buying_price', 'is_available', 'category_id', 'barcode', 'description', 'unit', 'image_url', 'minimum_stock', 'sku', 'status', 'cost_method', 'archived_at', 'tenant_id'];
      cols.forEach(c => {
        if (payload[c] !== undefined) safeUpdate[c] = payload[c];
        if (c === 'buying_price' && payload.cost_price !== undefined) safeUpdate.buying_price = payload.cost_price;
        if (c === 'selling_price' && payload.price !== undefined) safeUpdate.selling_price = payload.price;
      });

      if (!safeUpdate.id || !safeUpdate.name) {
        try {
          const row = this.db.prepare('SELECT name FROM products WHERE id = ?').get(recordId) as any;
          if (row?.name) safeUpdate.name = row.name;
        } catch { /* ignore */ }
      }
    } else if (entity === 'category') {
      const cols = ['name', 'description', 'created_at', 'tenant_id'];
      cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
    } else if (entity === 'order') {
      const cols = ['table_id', 'waiter_id', 'customer_id', 'status', 'total', 'items', 'version', 'created_at', 'tenant_id'];
      cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
      // 'notes' et 'updated_at' n'existent pas dans le schéma Supabase orders
      delete safeUpdate.notes;
      delete safeUpdate.updated_at;
      console.log(`[Sync] Pushing order ${recordId} (remote=${safeUpdate.id}) status=${safeUpdate.status} to Supabase`);
    } else if (entity === 'order_item') {
      // Supabase order_items: id, order_id, product_id, quantity, unit_price, total_price, notes, created_at
      const cols = ['order_id', 'product_id', 'quantity', 'unit_price', 'total_price', 'notes'];
      cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
      delete safeUpdate.updated_at;
      delete safeUpdate.tenant_id;
    } else if (entity === 'sale') {
      // Supabase sales: id, invoice_number, order_id, user_id, customer_id, subtotal, discount, tax, total_amount, payment_method, version, created_at
      const cols = ['invoice_number', 'order_id', 'user_id', 'customer_id', 'subtotal', 'discount', 'tax', 'total_amount', 'payment_method', 'version', 'created_at'];
      cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
      delete safeUpdate.updated_at;
      delete safeUpdate.tenant_id;
      delete safeUpdate.remote_id;
      console.log(`[Sync] Pushing sale ${recordId} (remote=${safeUpdate.id}) to Supabase`);
    } else if (entity === 'sale_item') {
      // Supabase sale_items: id, sale_id, product_id, quantity, unit_price, total_price
      const cols = ['sale_id', 'product_id', 'quantity', 'unit_price', 'total_price'];
      cols.forEach(c => { if (payload[c] !== undefined) safeUpdate[c] = payload[c]; });
      delete safeUpdate.updated_at;
      delete safeUpdate.tenant_id;
      delete safeUpdate.remote_id;
    } else if (entity === 'restaurant_table') {
      await this.handleTableUpsert(item, payload, recordId, tenantId);
      return; // Le push table a sa propre logique avec continue
    }

    // Pour les inserts sans remote_id, ajouter tenant_id (sauf pour sale/sale_item qui n'ont pas cette colonne dans Supabase)
    if (!payload.remote_id && item.operation === 'insert') {
      if (tenantId && entity !== 'sale' && entity !== 'sale_item') {
        safeUpdate.tenant_id = Number(tenantId);
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

    // Status mapping: local 'active' -> remote 'occupied'
    if (safeUpdate.status === 'active') safeUpdate.status = 'occupied';
    if (safeUpdate.status === 'out_of_service') safeUpdate.status = 'available';

    if (!payload.remote_id && item.operation === 'insert') {
      delete safeUpdate.id;
      if (tenantId) safeUpdate.tenant_id = Number(tenantId);

      const { data, error } = await this.supabase
        .from(table)
        .upsert(safeUpdate, { onConflict: 'table_number' })
        .select('id')
        .single();

      if (error) {
        if (error.code !== '23505') throw error;
        console.log(`[Sync] Table "${safeUpdate.table_number}" already exists in Supabase`);
      } else if (data?.id) {
        this.db.prepare(`UPDATE ${table} SET remote_id = ? WHERE id = ?`).run(data.id, recordId);
      }
    } else {
      safeUpdate.id = payload.remote_id || recordId;
      if (tenantId) safeUpdate.tenant_id = Number(tenantId);

      const { data, error } = await this.supabase
        .from(table)
        .upsert(safeUpdate, { onConflict: 'table_number' })
        .select('id')
        .single();

      if (error) throw error;

      if (!payload.remote_id && data?.id) {
        this.db.prepare(`UPDATE ${table} SET remote_id = ? WHERE id = ?`).run(data.id, recordId);
      }
    }
  }

  private async handleDelete(
    entity: string,
    table: string,
    item: OutboxItem,
    recordId: number
  ) {
    if (entity === 'order_item') {
      const { error } = await this.supabase
        .from(table)
        .delete()
        .eq('id', recordId);
      if (error) throw error;
    } else {
      const safeDelete: Record<string, any> = { updated_at: new Date().toISOString() };
      if (entity === 'product') safeDelete.is_available = 0;
      if (entity === 'order') safeDelete.status = 'cancelled';

      const { error } = await this.supabase
        .from(table)
        .update(safeDelete)
        .eq('id', recordId);
      if (error) throw error;
    }
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
      .gt('updated_at', since)
      .order('updated_at', { ascending: true });

    let { data, error } = await query;

    if (error && error.message?.includes('updated_at')) {
      console.warn(`[Sync] Pulling ${entity} without updated_at column (using created_at fallback)...`);
      query = this.supabase
        .from(table)
        .select('*')
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

        // Vérifier si le remote est plus récent
        const shouldApply = !local || !local.updated_at ||
          (remoteUpdatedAt && remoteUpdatedAt > local.updated_at);

        if (!shouldApply) continue;

        const safeFields: Record<string, any> = {
          tenant_id: remote.tenant_id,
          updated_at: remoteUpdatedAt
            ? (remoteUpdatedAt instanceof Date ? remoteUpdatedAt.toISOString() : String(remoteUpdatedAt))
            : new Date().toISOString(),
        };

        // Version tracking
        if (remote.version !== undefined) {
          safeFields.version = remote.version;
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
        }

        await this.applyRemoteRow(entity, table, safeFields, local, remoteId, remoteUpdatedAt);
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

      return byLocalId || undefined;
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
    remoteUpdatedAt: any
  ) {
    const sanitize = (val: any) => {
      if (val === undefined || val === null) return null;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'boolean') return val ? 1 : 0;
      return val;
    };

    const updateFields = Object.keys(safeFields);
    if (updateFields.length === 0) return;

    // NE PAS inclure remoteId dans les SET, il va dans WHERE
    const setClauses = updateFields.map(k => `"${k}" = ?`).join(', ');
    const updateValues = updateFields.map(k => sanitize(safeFields[k]));

    // Déterminer la PK locale pour le WHERE
    const pk = local ? local.id : remoteId;

    // Tentative UPDATE d'abord
    const updateResult = this.db.prepare(`
      UPDATE ${table} SET ${setClauses} WHERE id = ?
    `).run(...updateValues, pk);

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
          const existing = this.db.prepare(
            `SELECT id FROM ${table} WHERE id = ? OR remote_id = ?`
          ).get(pk, pk) as { id: number } | undefined;
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
    if (entity === 'product') {
      return [
        'name', 'stock_quantity', 'selling_price', 'buying_price', 'is_available',
        'category_id', 'barcode', 'description', 'unit', 'image_url',
        'minimum_stock', 'sku', 'status', 'cost_method', 'archived_at', 'updated_at',
        'price', 'version'
      ];
    }
    if (entity === 'category') {
      return ['name', 'description', 'updated_at', 'created_at'];
    }
    return ['updated_at'];
  }

  async forceFullPull(tenantId: string): Promise<number> {
    this.cursor.reset();
    let pulled = await this.pullByEntityFromSupabase('category', tenantId);
    pulled += await this.pullByEntityFromSupabase('product', tenantId);
    return pulled;
  }
}