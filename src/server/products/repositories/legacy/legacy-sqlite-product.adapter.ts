import { db } from '../../../db/database';
import { IProductRepository } from '../product.repository.interface';
import { ProductEntity } from '../../types/product.types';

function forensicLog(label: string, err: any, sql?: string, params?: any[]) {
  console.error(`[PRODUCTS REPO FORENSIC ERROR] ${label}`, {
    message: err?.message,
    sqliteCode: err?.code || err?.errno || 'N/A',
    stack: err?.stack?.split('\n').slice(0, 6).join('\n'),
    sql: sql || 'N/A',
    params: params || [],
    dbIsNull: !db
  });
}

export class LegacySQLiteProductAdapter implements IProductRepository {
  async findById(id: string, businessId: string): Promise<ProductEntity | null> {
    // Legacy SQLite may not store business_id; keep parameter for interface compatibility.
    let row: any;
    try {
      const selectSql = `
      SELECT
        id,
        tenant_id,
        business_id,
        branch_id,
        category_id,
        name,
        description,
        sku,
        barcode,
        selling_price,
        buying_price,
        price,
        cost_price,
        stock_quantity,
        minimum_stock as low_stock_threshold,
        image_url,
        is_available,
        is_featured,
        sort_order,
        metadata,
        version,
        sync_status,
        created_at,
        updated_at,
        deleted_at
      FROM products
      WHERE id = ?
        AND (deleted_at IS NULL OR deleted_at = '')
      LIMIT 1
    `;
      row = db.prepare(selectSql).get(id) as any | undefined;
    } catch (err: any) {
      forensicLog('findById', err, 'SELECT ... FROM products WHERE id = ?', [id]);
      throw err;
    }

    if (!row) return null;

    return this.map(row);
  }

  async findAll(
    businessId: string,
    query?: {
      page?: number;
      limit?: number;
      search?: string;
      category_id?: string;
      is_available?: boolean;
      is_featured?: boolean;
      sort_by?: 'name' | 'price' | 'stock_quantity' | 'created_at' | 'sort_order';
      sort_order?: 'asc' | 'desc';
    }
  ): Promise<{
    data: ProductEntity[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 50;
    const offset = (page - 1) * limit;

    const where: string[] = [`(deleted_at IS NULL OR deleted_at = '')`];
    const params: any[] = [];

    // Support for both naming conventions
    where.push(`(business_id = ? OR tenant_id = ? OR business_id IS NULL OR tenant_id IS NULL)`);
    params.push(businessId, businessId);

    if (typeof query?.is_available === 'boolean') {
      where.push(`is_available = ?`);
      params.push(query.is_available ? 1 : 0);
    }
    if (typeof query?.is_featured === 'boolean') {
      where.push(`is_featured = ?`);
      params.push(query.is_featured ? 1 : 0);
    }
    if (query?.category_id) {
      where.push(`category_id = ?`);
      params.push(query.category_id);
    }
    if (query?.search) {
      where.push(`name LIKE ?`);
      params.push(`%${query.search}%`);
    }

    const sortBy = query?.sort_by ?? 'sort_order';
    const sortOrder = query?.sort_order ?? 'asc';
    const sortColumn =
      sortBy === 'name'
        ? 'name'
        : sortBy === 'price'
          ? 'selling_price'
          : sortBy === 'stock_quantity'
            ? 'stock_quantity'
            : sortBy === 'created_at'
              ? 'created_at'
              : 'sort_order';

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    let countRow: any;
    let rows: any[] = [];
    try {
      countRow = db
        .prepare(`SELECT COUNT(1) as total FROM products ${whereSql}`)
        .get(...params) as any;

      rows = db
        .prepare(
          `
        SELECT
          id,
          business_id,
          branch_id,
          category_id,
          name,
          description,
          sku,
          barcode,
          selling_price as price,
          cost_price,
          stock_quantity,
          minimum_stock as low_stock_threshold,
          image_url,
          is_available,
          is_featured,
          sort_order,
          metadata,
          version,
          sync_status,
          created_at,
          updated_at,
          deleted_at
        FROM products
        ${whereSql}
        ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}
        LIMIT ?
        OFFSET ?
      `
        )
        .all(...params, limit, offset) as any[];
    } catch (err: any) {
      forensicLog('findAll / listProducts', err, `SELECT ... FROM products ${whereSql}`, params);
      throw err;
    }

    const total = Number(countRow?.total ?? 0);

    return {
      data: (rows || []).map(r => this.map(r)),
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    };
  }

  async create(dto: any, businessId: string, userId?: string): Promise<ProductEntity> {
    const now = new Date().toISOString();

    // Normalize prices for legacy schema (Supabase expects selling_price/buying_price AND also price/cost_price)
    const sellingPrice = dto.price ?? dto.selling_price ?? 0;
    const buyingPrice = dto.cost_price ?? dto.buying_price ?? 0;

    // Generate SKU if missing: tenant.name + product.name + 4 digits => exact 8 chars
    const tenantName = (() => {
      try {
        return (db.prepare(`SELECT name FROM tenants WHERE id = ? OR business_id = ? LIMIT 1`).get(businessId, businessId) as any)?.name ?? '';
      } catch {
        return '';
      }
    })();

    const productName = String(dto.name ?? '').trim();

    const random4 = () => Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    const generateSku = () => {
      const rand4Str = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const tPart = tenantName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const pPart = productName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const base = (tPart + pPart);
      const prefix = (base || 'XXXX').substring(0, 4).padEnd(4, 'X');
      return (prefix + rand4Str).substring(0, 8);
    };

    const sku = dto.sku ?? generateSku();

    const stmt = db.prepare(
      `
      INSERT INTO products (
        business_id,
        tenant_id,
        branch_id,
        category_id,
        name,
        description,
        sku,
        barcode,
        selling_price,
        buying_price,
        price,
        cost_price,
        stock_quantity,
        minimum_stock,
        image_url,
        is_available,
        is_featured,
        sort_order,
        metadata,
        version,
        sync_status,
        created_at,
        updated_at,
        deleted_at,
        created_by,
        updated_by
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'pending',
        ?, ?, NULL, ?, ?
      )
    `
    );

    stmt.run(
      businessId,
      businessId,
      dto.branch_id ?? null,
      dto.category_id ?? null,
      dto.name,
      dto.description ?? null,
      sku ?? null,
      dto.barcode ?? null,
      sellingPrice,
      buyingPrice,
      dto.price ?? sellingPrice,
      dto.cost_price ?? buyingPrice,
      dto.stock_quantity ?? 0,
      dto.low_stock_threshold ?? 5,
      dto.image_url ?? null,
      dto.is_available ?? 1,
      dto.is_featured ?? 0,
      dto.sort_order ?? 0,
      dto.metadata ?? null,
      1,
      now,
      now,
      userId ?? null,
      userId ?? null
    );
    const row = db.prepare(`SELECT * FROM products WHERE rowid = last_insert_rowid()`).get() as any;
    if (!row) throw new Error('Failed to create product (legacy sqlite)');

    // Ensure sku/price/cost_price are populated on the returned row
    if (!row.sku) row.sku = sku ?? null;
    if (row.price == null) row.price = sellingPrice;
    if (row.cost_price == null) row.cost_price = buyingPrice;

    // Enregistrer immédiatement dans l'outbox pour synchronisation vers Supabase
    // IMPORTANT: Supabase products a created_by/updated_by => injecter depuis userId (quand disponible)
    try {
      const crypto = require('crypto');
        const outboxPayload = {
          ...row,
          created_by: userId ?? null,
          updated_by: userId ?? null,
          // alignement champs Supabase (payload peut être exploité par GenericSync)
          sku: row.sku ?? sku ?? null,
          price: row.price ?? row.selling_price ?? sellingPrice,
          cost_price: row.cost_price ?? row.buying_price ?? buyingPrice,
          selling_price: row.selling_price ?? sellingPrice,
          buying_price: row.buying_price ?? buyingPrice,
        };

      db.prepare(`
        INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id)
        VALUES (?, 'product', 'insert', ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        String(row.id),
        JSON.stringify(outboxPayload),
        row.business_id || businessId
      );
    } catch (err) {
      console.warn('[LegacyAdapter] Failed to queue sync insert:', err);
    }

    return this.map(row);
  }

  async update(id: string, dto: any, businessId: string): Promise<ProductEntity> {
    const now = new Date().toISOString();

    const patch: any = {
      category_id: dto.category_id ?? undefined,
      name: dto.name ?? undefined,
      description: dto.description ?? undefined,
      sku: dto.sku ?? undefined,
      barcode: dto.barcode ?? undefined,
      selling_price: dto.price ?? undefined,
      price: dto.price ?? undefined,
      buying_price: dto.cost_price ?? undefined,
      cost_price: dto.cost_price ?? undefined,
      stock_quantity: dto.stock_quantity ?? undefined,
      minimum_stock: dto.low_stock_threshold ?? undefined,
      image_url: dto.image_url ?? undefined,
      is_available: dto.is_available ?? undefined,
      is_featured: dto.is_featured ?? undefined,
      sort_order: dto.sort_order ?? undefined,
      metadata: dto.metadata ?? undefined,
      updated_at: now,
      sync_status: 'pending',
    };

    const keys = Object.keys(patch).filter(k => patch[k] !== undefined);
    if (keys.length === 0) {
      // fetch current
      const row = db.prepare(`SELECT * FROM products WHERE id = ? AND (business_id = ? OR tenant_id = ?)`).get(id, businessId, businessId) as any;
      if (!row) throw new Error('Product not found (legacy sqlite)');
      return this.map(row);
    }

    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const params = keys.map(k => patch[k]).concat([id, businessId, businessId]);

    db.prepare(`UPDATE products SET ${setSql} WHERE id = ? AND (business_id = ? OR tenant_id = ?)`).run(...params);

    const row = db.prepare(`SELECT * FROM products WHERE id = ? AND (business_id = ? OR tenant_id = ?)`).get(id, businessId, businessId) as any;
    if (!row) throw new Error('Product not found after update (legacy sqlite)');

    // Enregistrer immédiatement dans l'outbox pour synchronisation vers Supabase
    // IMPORTANT: created_by/updated_by injection pour Supabase
    try {
      const crypto = require('crypto');
      const outboxPayload = {
        ...row,
        updated_by: dto?.updated_by ?? dto?.user_id ?? null,
        // created_by seulement si présent, sinon garder existant si la DB legacy le stocke
        created_by: row.created_by ?? dto?.created_by ?? dto?.user_id ?? null,
        price: row.price ?? row.selling_price ?? row.price,
        cost_price: row.cost_price ?? row.buying_price ?? row.cost_price,
      };

      db.prepare(`
        INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id)
        VALUES (?, 'product', 'update', ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        String(id),
        JSON.stringify(outboxPayload),
        row.business_id || businessId
      );
    } catch (err) {
      console.warn('[LegacyAdapter] Failed to queue sync update:', err);
    }

    return this.map(row);
  }

  async softDelete(id: string, businessId: string): Promise<void> {
    const now = new Date().toISOString();
    
    // 1. Récupérer le remote_id AVANT le soft delete (pour le payload sync)
    const productRow = db.prepare(`SELECT id, remote_id, tenant_id, business_id FROM products WHERE id = ?`).get(id) as any;

    if (!productRow) {
      throw new Error(`Product #${id} not found`);
    }

    // Vérifier l'appartenance au tenant (comparaison robuste: nombre ou string)
    const rowTenantId = Number(productRow.tenant_id);
    const checkTenantId = Number(businessId);
    if (rowTenantId !== checkTenantId) {
      throw new Error(`Product #${id} does not belong to tenant ${businessId}`);
    }

    // 2. Soft delete local (is_available=0 pour cacher dans l'UI immédiatement)
    const result = db.prepare(`UPDATE products SET deleted_at = ?, is_available = 0, status = 'archived', sync_status = 'pending' WHERE id = ?`).run(
      now,
      id
    );

    if (result.changes === 0) {
      throw new Error(`Product #${id} not found or does not belong to tenant ${businessId}`);
    }

    // 3. Enregistrer dans l'outbox avec le remote_id pour le push vers Supabase
    // IMPORTANT: Utiliser 'delete' comme opération, PAS 'update'
    try {
      if (productRow) {
        const crypto = require('crypto');
        const payload = {
          id: Number(id),
          remote_id: productRow.remote_id || null,
          is_available: 0,
          tenant_id: productRow.tenant_id || businessId,
          updated_at: now,
        };
        db.prepare(`
          INSERT INTO sync_outbox (id, entity, operation, record_id, payload, tenant_id)
          VALUES (?, 'product', 'delete', ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          String(id),
          JSON.stringify(payload),
          productRow.tenant_id || businessId
        );
      }
    } catch (err) {
      console.warn('[LegacyAdapter] Failed to queue sync delete:', err);
    }
  }

  private map(row: any): ProductEntity {
    return {
      id: String(row.id),
      tenant_id: row.tenant_id ?? row.business_id ?? businessIdFallback(),
      branch_id: row.branch_id ?? null,
      category_id: row.category_id ?? null,
      name: row.name,
      description: row.description ?? null,
      sku: row.sku ?? null,
      barcode: row.barcode ?? null,
      price: String(row.price ?? row.selling_price ?? 0),
      cost_price: String(row.cost_price ?? row.buying_price ?? 0),
      stock_quantity: Number(row.stock_quantity ?? 0),
      low_stock_threshold: Number(row.low_stock_threshold ?? row.minimum_stock ?? 5),
      image_url: row.image_url ?? null,
      is_available: !!row.is_available,
      is_featured: !!row.is_featured,
      sort_order: Number(row.sort_order ?? 0),
      metadata: row.metadata ?? null,
      version: Number(row.version ?? 1),
      sync_status: row.sync_status ?? 'synced',
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at ?? null,
    };
  }
}

function businessIdFallback(): string {
  return 'default-business';
}
