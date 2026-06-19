// src/sync/order-sync.service.ts
// Synchronisation professionnelle des commandes avec atomicité garantie
// Faille #3 résolue : orders + order_items atomiques
// Faille #10 résolue : pas de DELETE massif, diff intelligent
// Faille #6 résolue : tenant_id obligatoire
// Faille #4 résolue : ID mapping fiable

import type Database from 'better-sqlite3';
import { ProductSyncService } from './product-sync.service';
import { getSupabaseClient } from '../server/database/supabase.client';

interface OrderRecord {
  id: string | number;
  table_id?: number | string;
  waiter_id?: number | string;
  status: string;
  total?: number;
  items?: any;
  customer_phone?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  version?: number;
  remote_id?: string | number;
  tenant_id?: number;
  [key: string]: any;
}

export class OrderSyncService {
  private coreSync: ProductSyncService;
  private db: Database.Database;
  private supabase = getSupabaseClient();

  constructor(coreSync: ProductSyncService, db: Database.Database) {
    this.coreSync = coreSync;
    this.db = db;
  }

  /**
   * Résout un remote_id vers un ID local de manière fiable.
   * Utilise d'abord remote_id, puis id direct en fallback.
   */
  private getLocalId(table: string, remoteId: any): number | null {
    if (remoteId === null || remoteId === undefined) return null;
    try {
      // Stratégie unique et fiable : remote_id d'abord, puis id direct
      const row = this.db.prepare(
        `SELECT id FROM ${table} WHERE remote_id = ?`
      ).get(remoteId) as { id: number } | undefined;

      if (row) return row.id;

      // Fallback : id direct (pour les données migrées sans remote_id)
      const byDirectId = this.db.prepare(
        `SELECT id FROM ${table} WHERE id = ?`
      ).get(remoteId) as { id: number } | undefined;

      return byDirectId ? byDirectId.id : null;
    } catch {
      return null;
    }
  }

  /**
   * Queue un ordre + ses items atomiquement dans l'outbox.
   * À appeler UNIQUEMENT depuis un callback withOutboxTransaction.
   * 
   * Faille #3 résolue : L'ordre et ses items sont dans la même transaction
   * ce qui garantit que tout ou rien est pushé.
   * 
   * Faille #6 résolue : tenantId est obligatoire (pas de valeur par défaut)
   */
  queueOrderChange(
    operation: 'insert' | 'update' | 'delete',
    order: OrderRecord,
    tenantId: string  // OBLIGATOIRE, pas de valeur par défaut
  ) {
    if (!tenantId) {
      console.error('[Sync] queueOrderChange: tenantId is required!');
      throw new Error('tenantId is required for order sync');
    }

    const orderPayload: any = {
      id: order.id,
      table_id: order.table_id ?? null,
      waiter_id: order.waiter_id ?? null,
      status: order.status,
      total: order.total,
      items: order.items,
      customer_id: order.customer_id ?? null,
      tenant_id: Number(tenantId),
    };

    if (order.created_at !== undefined && order.created_at !== null) orderPayload.created_at = order.created_at;
    if (order.updated_at !== undefined && order.updated_at !== null) orderPayload.updated_at = order.updated_at;
    if (order.version) orderPayload.version = order.version;
    if (order.remote_id) orderPayload.remote_id = order.remote_id;

    this.coreSync.queueChangeInsideTransaction('order', operation, orderPayload);

    if (order.items && operation !== 'delete') {
      const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
      for (const item of items) {
        const itemId = item.id || item.productId || this._newId();
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.price ?? item.unit_price);
        const itemPayload: any = {
          id: itemId,
          order_id: order.id,
          product_id: item.productId ?? item.product_id,
          quantity,
          unit_price: unitPrice,
          total_price: unitPrice * quantity,
          notes: item.notes ?? null,
          tenant_id: Number(tenantId),
          version: item.version || order.version || 1,
        };
        this.coreSync.queueChangeInsideTransaction('order_item', 'insert', itemPayload);
      }
    }
  }

  /**
   * Push les commandes en attente vers Supabase.
   * L'ordre et les items sont pushés individuellement mais 
   * l'atomicité de l'outbox garantit l'intégrité.
   */
  async pushPendingOrders(tenantId: string): Promise<number> {
    // Push orders d'abord (pour que les orders existent avant les items)
    const orderCount = await this.coreSync.pushPendingByEntity('order', tenantId);
    // Puis push order_items
    const itemCount = await this.coreSync.pushPendingByEntity('order_item', tenantId);
    return orderCount + itemCount;
  }

  /**
   * Pull les mises à jour de commandes depuis Supabase.
   * Faille #10 résolue : on ne supprime pas les items locaux non modifiés.
   * On fait un diff intelligent entre items distants et locaux.
   */
  async pullOrderUpdates(tenantId: string, since: string): Promise<number> {
    console.log(`[Sync] Pulling orders since ${since}...`);

    const { data, error } = await this.supabase
      .from('orders')
      .select('*, order_items(*)')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true });

    if (error) {
      console.error('[Sync] Failed to pull orders from Supabase:', error.message);
      throw error;
    }

    if (!data || data.length === 0) return 0;

    let applied = 0;
    const transaction = this.db.transaction((orders: any[]) => {
      for (const remote of orders) {
        try {
          // Trouver la commande locale par remote_id OU id
          const local = this.db.prepare(
            'SELECT id, updated_at FROM orders WHERE remote_id = ?'
          ).get(remote.id) as { id: number; updated_at: string } | undefined;

          const localById = !local ? this.db.prepare(
            'SELECT id, updated_at FROM orders WHERE id = ?'
          ).get(remote.id) as { id: number; updated_at: string } | undefined : local;

          const existingLocal = local || localById;

          // Vérifier si le remote est plus récent
          const shouldApply = !existingLocal ||
            new Date(remote.updated_at) > new Date(existingLocal.updated_at);

          if (shouldApply) {
            this.applyRemoteOrder(remote, existingLocal?.id);
            applied++;
          }
        } catch (err) {
          console.error(`[Sync] Error applying remote order ${remote.id}:`, err);
        }
      }
    });

    transaction(data);
    return applied;
  }

  private _newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    const { randomUUID } = require('crypto') as { randomUUID: () => string };
    return randomUUID();
  }

  private applyRemoteOrder(remote: any, existingLocalId?: number) {
    const sanitize = (val: any) => {
      if (val === undefined || val === null) return null;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'boolean') return val ? 1 : 0;
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    };

    // Colonnes locales autorisées
    const allowedColumns = [
      'table_id', 'waiter_id', 'status', 'total', 'items',
      'customer_phone', 'notes', 'created_at', 'updated_at', 'remote_id',
      'customer_id', 'source', 'version'
    ];

    const fields: Record<string, any> = {
      remote_id: remote.id,
      updated_at: remote.updated_at,
      created_at: remote.created_at,
      status: remote.status,
      total: remote.total,
      table_id: this.getLocalId('restaurant_tables', remote.table_id),
      waiter_id: this.getLocalId('users', remote.waiter_id),
      notes: remote.notes,
      customer_id: remote.customer_id,
      source: remote.source || 'qr',
      items: typeof remote.items === 'string' ? remote.items : JSON.stringify(remote.items || []),
      version: remote.version || 1,
    };

    const updateFields = Object.keys(fields).filter(k => allowedColumns.includes(k));
    const setClauses = updateFields.map(k => `"${k}" = ?`).join(', ');
    const params = updateFields.map(k => sanitize(fields[k]));

    // Trouver le local par remote_id (stratégie fiable)
    const existingByRemote = this.db.prepare(
      'SELECT id FROM orders WHERE remote_id = ?'
    ).get(remote.id) as { id: number } | undefined;

    const existingByDirectId = !existingByRemote && existingLocalId ? this.db.prepare(
      'SELECT id FROM orders WHERE id = ?'
    ).get(existingLocalId) as { id: number } | undefined : null;

    const existing = existingByRemote || existingByDirectId;

    let localOrderId: number;

    if (existing) {
      // UPDATE local
      this.db.prepare(`UPDATE orders SET ${setClauses} WHERE id = ?`)
        .run(...params, existing.id);
      localOrderId = existing.id;
    } else {
      // INSERT nouvelle commande
      const insertKeys = updateFields;
      const insertParams = params;
      const result = this.db.prepare(`
        INSERT INTO orders (${insertKeys.map(k => `"${k}"`).join(', ')})
        VALUES (${insertParams.map(() => '?').join(', ')})
      `).run(...insertParams);
      localOrderId = Number(result.lastInsertRowid);
    }

    // Appliquer les items (Faille #10 résolue : diff intelligent)
    if (remote.order_items && Array.isArray(remote.order_items)) {
      this.applyRemoteOrderItems(remote.order_items, localOrderId, remote.created_at);
    }
  }

  /**
   * Faille #10 résolue : mise à jour intelligente des order_items.
   * Au lieu de DELETE tous les items puis réinsérer (perte de données),
   * on fait un diff: on ne supprime que les items qui n'existent plus,
   * on met à jour ceux qui existent, on insère les nouveaux.
   */
  private applyRemoteOrderItems(
    remoteItems: any[],
    localOrderId: number,
    defaultCreatedAt: string
  ) {
    // Récupérer les items locaux actuels
    const localItems = this.db.prepare(
      'SELECT id, product_id, quantity, unit_price FROM order_items WHERE order_id = ?'
    ).all(localOrderId) as { id: number; product_id: number; quantity: number; unit_price: number }[];

    // Indexer par product_id pour lookup rapide
    const localByProduct = new Map(localItems.map(item => [item.product_id, item]));

    // Ensemble des product_ids distants pour savoir quoi supprimer
    const remoteProductIds = new Set<number>();

    const itemStmt = this.db.prepare(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = this.db.prepare(`
      UPDATE order_items SET quantity = ?, unit_price = ?, total_price = ?, notes = ?
      WHERE id = ?
    `);

    for (const item of remoteItems) {
      const localProductId = this.getLocalId('products', item.product_id);
      if (!localProductId) {
        console.warn(`[Sync] Skipping order item for remote product ${item.product_id}: No local product found`);
        continue;
      }

      remoteProductIds.add(localProductId);
      const existingItem = localByProduct.get(localProductId);

      if (existingItem) {
        // Mise à jour de l'item existant
        updateStmt.run(
          item.quantity,
          item.unit_price,
          item.total_price,
          item.notes || null,
          existingItem.id
        );
      } else {
        // Insertion du nouvel item
        itemStmt.run(
          localOrderId,
          localProductId,
          item.quantity,
          item.unit_price,
          item.total_price,
          item.notes || null,
          item.created_at || defaultCreatedAt
        );
      }
    }

    // Supprimer les items locaux qui n'existent plus côté remote
    // (on ne supprime que si vraiment plus présents)
    this.db.prepare(`
      DELETE FROM order_items 
      WHERE order_id = ? AND product_id NOT IN (${Array.from(remoteProductIds).map(() => '?').join(',') || '0'})
    `).run(localOrderId, ...Array.from(remoteProductIds));
  }
}

