import { db } from '../../../db/database';
import { IProductRepository } from '../product.repository.interface';
import { getRequestId, logTrace } from '../../../utils/trace-utils';
import { ProductEntity } from '../../types/product.types';

export class LegacySQLiteProductAdapter implements IProductRepository {
  async findById(id: string, tenantId: string): Promise<ProductEntity | null> {
    const requestId = getRequestId();
    logTrace('ENTER LegacySQLiteProductAdapter.findById', { id, tenantId });
    // Legacy SQLite may not store business_id; keep parameter for interface compatibility.
    let row: any;
    try {
      const selectSql = `
      SELECT
        id,
        tenant_id,
        business_id,
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
      logTrace('ENTER db.prepare SELECT findById');
      const stmt = db.prepare(selectSql);
      row = stmt.get(id) as any | undefined;
      logTrace('EXIT db.prepare SELECT findById', { rowFound: !!row });
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'legacy-sqlite-product.adapter.ts',
        function: 'findById',
        line: 44,
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack,
        sql: 'SELECT ... FROM products WHERE id = ?',
        params: [id]
      }));
      throw error;
    }

    if (!row) return null;

    return this.map(row);
  }

  async findAll(
    tenantId: string,
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

    where.push(`tenant_id = ?`);
    params.push(tenantId);

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

    const requestId = getRequestId();
    logTrace('ENTER LegacySQLiteProductAdapter.findAll', { tenantId, query, whereSql, params });
    let countRow: any;
    let rows: any[] = [];
    try {
      logTrace('ENTER db.prepare SELECT COUNT findAll');
      const countStmt = db.prepare(`SELECT COUNT(1) as total FROM products ${whereSql}`);
      countRow = countStmt.get(...params) as any;
      logTrace('EXIT db.prepare SELECT COUNT findAll', { total: countRow?.total });

      logTrace('ENTER db.prepare SELECT findAll');
      const selectStmt = db.prepare(
        `
        SELECT
          id,
          business_id,
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
        );
      rows = selectStmt.all(...params, limit, offset) as any[];
      logTrace('EXIT db.prepare SELECT findAll', { count: rows.length });
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'legacy-sqlite-product.adapter.ts',
        function: 'findAll',
        line: 119,
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack,
        sql: `SELECT ... FROM products ${whereSql}`,
        params
      }));
      throw error;
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

  async create(dto: any, tenantId: string, userId?: string): Promise<ProductEntity> {
    const requestId = getRequestId();
    logTrace('ENTER LegacySQLiteProductAdapter.create', { dto: { ...dto, name: dto.name }, tenantId, userId });
    
    const now = new Date().toISOString();

    // Normalize prices for legacy schema (Supabase expects selling_price/buying_price AND also price/cost_price)
    const sellingPrice = dto.price ?? dto.selling_price ?? 0;
    const buyingPrice = dto.cost_price ?? dto.buying_price ?? 0;

    // Generate SKU if missing: tenant.name + product.name + 4 digits => exact 8 chars
    const tenantName = (() => {
      try {
        logTrace('ENTER db.prepare SELECT tenant for SKU');
        const tenant = db.prepare(`SELECT name FROM tenants WHERE id = ? LIMIT 1`).get(tenantId) as any;
        logTrace('EXIT db.prepare SELECT tenant for SKU', { tenantName: tenant?.name });
        return tenant?.name ?? '';
      } catch (error: any) {
        console.error(JSON.stringify({
          requestId,
          file: 'legacy-sqlite-product.adapter.ts',
          function: 'create',
          line: 186,
          errorType: error?.constructor?.name,
          errorCode: error?.code,
          errorMessage: error?.message,
          errorStack: error?.stack,
          sql: 'SELECT name FROM tenants WHERE id = ? LIMIT 1',
          params: [tenantId]
        }));
        return '';
      }
    })();

    const productName = String(dto.name ?? '').trim();

    const random4 = () => Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    // Générer un SKU unique avec timestamp pour éviter les collisions
    const generateSku = () => {
      const tPart = tenantName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const pPart = productName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const base = (tPart + pPart);
      const prefix = (base || 'XXXX').substring(0, 4).padEnd(4, 'X');
      // Utiliser les 2 derniers chiffres de l'année + 4 chiffres aléatoires
      const year2 = new Date().getFullYear().toString().slice(-2);
      const random4 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return (prefix + year2 + random4).substring(0, 8);
    };

    const sku = dto.sku ?? generateSku();

    // Vérifier si le produit existe déjà pour CE tenant (par nom ou SKU)
    // Multi-tenant: le même nom/SKU peut exister pour un autre tenant
    logTrace('ENTER db.prepare SELECT check duplicate');
    let existing: any;
    try {
      const existingSql = `
        SELECT id, name, sku FROM products 
        WHERE tenant_id = ? 
          AND (name = ? OR sku = ?)
          AND (deleted_at IS NULL OR deleted_at = '')
        LIMIT 1
      `;
      existing = db.prepare(existingSql).get(tenantId, productName, sku) as any;
      logTrace('EXIT db.prepare SELECT check duplicate', { existing: !!existing, foundId: existing?.id, foundName: existing?.name, foundSku: existing?.sku });
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'legacy-sqlite-product.adapter.ts',
        function: 'create',
        line: 250,
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack,
        sql: 'SELECT id FROM products WHERE tenant_id = ? AND (name = ? OR sku = ?)',
        params: [tenantId, productName, sku]
      }));
      // Continue malgré l'erreur de vérification
    }

    if (existing) {
      const field = existing.name === productName ? 'nom' : 'SKU';
      console.error(JSON.stringify({
        requestId,
        file: 'legacy-sqlite-product.adapter.ts',
        function: 'create',
        error: 'DUPLICATE_FOUND',
        message: `Cette entrée existe déjà dans la base de données (${field}: ${existing.name || existing.sku}). Veuillez actualiser la page et réessayer.`,
        existingId: existing.id,
        existingName: existing.name,
        existingSku: existing.sku,
        newProductName: productName,
        newSku: sku,
        tenantId
      }));
      throw new Error(`Cette entrée existe déjà dans la base de données (${field}: ${existing.name || existing.sku}). Veuillez actualiser la page et réessayer.`);
    }

    logTrace('ENTER db.prepare INSERT products');
    const stmt = db.prepare(
      `
      INSERT INTO products (
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

    logTrace('ENTER stmt.run INSERT products');
    let result: any;
    try {
      result = stmt.run(
        tenantId,
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
      logTrace('EXIT stmt.run INSERT products', { lastInsertRowid: result?.lastInsertRowid, changes: result?.changes });
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'legacy-sqlite-product.adapter.ts',
        function: 'create',
        line: 246,
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack,
        sql: 'INSERT INTO products ...',
        params: [tenantId, dto.branch_id ?? null, dto.category_id ?? null, dto.name, dto.description ?? null, sku ?? null, dto.barcode ?? null, sellingPrice, buyingPrice, dto.price ?? sellingPrice, dto.cost_price ?? buyingPrice, dto.stock_quantity ?? 0, dto.low_stock_threshold ?? 5, dto.image_url ?? null, dto.is_available ?? 1, dto.is_featured ?? 0, dto.sort_order ?? 0, dto.metadata ?? null, 1, now, now, userId ?? null, userId ?? null]
      }));
      throw error;
    }
    
    logTrace('ENTER db.prepare SELECT last_insert_rowid');
    let row: any;
    try {
      row = db.prepare(`SELECT * FROM products WHERE rowid = last_insert_rowid()`).get() as any;
      logTrace('EXIT db.prepare SELECT last_insert_rowid', { rowFound: !!row });
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'legacy-sqlite-product.adapter.ts',
        function: 'create',
        line: 275,
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack,
        sql: 'SELECT * FROM products WHERE rowid = last_insert_rowid()'
      }));
      throw error;
    }
    if (!row) throw new Error('Failed to create product (legacy sqlite)');

    // Ensure sku/price/cost_price are populated on the returned row
    if (!row.sku) row.sku = sku ?? null;
    if (row.price == null) row.price = sellingPrice;
    if (row.cost_price == null) row.cost_price = buyingPrice;

    // Enregistrer immédiatement dans l'outbox pour synchronisation vers Supabase
    logTrace('ENTER db.prepare INSERT sync_outbox');
    try {
      const crypto = require('crypto');
        const outboxPayload = {
          ...row,
          created_by: userId ?? null,
          updated_by: userId ?? null,
          sku: row.sku ?? sku ?? null,
          price: row.price ?? row.selling_price ?? sellingPrice,
          cost_price: row.cost_price ?? row.buying_price ?? buyingPrice,
          selling_price: row.selling_price ?? sellingPrice,
          buying_price: row.buying_price ?? buyingPrice,
        };

        logTrace('ENTER stmt.run INSERT sync_outbox');
        const outboxStmt = db.prepare(`
          INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
          VALUES (?, 'product', 'insert', ?, ?, ?, ?)
        `);
        const outboxResult = outboxStmt.run(
          crypto.randomUUID(),
          String(row.id),
          JSON.stringify(outboxPayload),
          1,
          row.tenant_id || tenantId
        );
        logTrace('EXIT stmt.run INSERT sync_outbox', { result: outboxResult });
    } catch (err: any) {
      console.warn(JSON.stringify({ requestId, outboxError: err?.message, stack: err?.stack }));
    }

    return this.map(row);
  }

  async update(id: string, dto: any, tenantId: string): Promise<ProductEntity> {
    const requestId = getRequestId();
    logTrace('ENTER LegacySQLiteProductAdapter.update', { id, tenantId, dto });
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
      logTrace('ENTER db.prepare SELECT update (no changes)');
      const row = db.prepare(`SELECT * FROM products WHERE id = ? AND tenant_id = ?`).get(id, tenantId) as any;
      logTrace('EXIT db.prepare SELECT update (no changes)', { rowFound: !!row });
      if (!row) throw new Error('Product not found (legacy sqlite)');
      return this.map(row);
    }

    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const params = keys.map(k => patch[k]).concat([id, tenantId]);

    logTrace('ENTER db.prepare UPDATE products');
    try {
      const updateStmt = db.prepare(`UPDATE products SET ${setSql} WHERE id = ? AND tenant_id = ?`);
      const updateResult = updateStmt.run(...params);
      logTrace('EXIT db.prepare UPDATE products', { changes: updateResult?.changes });
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'legacy-sqlite-product.adapter.ts',
        function: 'update',
        line: 352,
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack,
        sql: `UPDATE products SET ${setSql} WHERE id = ? AND (business_id = ? OR tenant_id = ?)`,
        params
      }));
      throw error;
    }

    logTrace('ENTER db.prepare SELECT after update');
    let row: any;
    try {
      row = db.prepare(`SELECT * FROM products WHERE id = ? AND tenant_id = ?`).get(id, tenantId) as any;
      logTrace('EXIT db.prepare SELECT after update', { rowFound: !!row });
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'legacy-sqlite-product.adapter.ts',
        function: 'update',
        line: 354,
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack,
        sql: 'SELECT * FROM products WHERE id = ? AND tenant_id = ?',
        params: [id, tenantId]
      }));
      throw error;
    }
    if (!row) throw new Error('Product not found after update (legacy sqlite)');

    // Enregistrer immédiatement dans l'outbox pour synchronisation vers Supabase
    // IMPORTANT: created_by/updated_by injection pour Supabase
    logTrace('ENTER db.prepare INSERT sync_outbox (update)');
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

      const outboxStmt = db.prepare(`
        INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
        VALUES (?, 'product', 'update', ?, ?, ?, ?)
      `);
      const outboxResult = outboxStmt.run(
        crypto.randomUUID(),
        String(id),
        JSON.stringify(outboxPayload),
        1,  // version
        row.tenant_id || tenantId
      );
      logTrace('EXIT db.prepare INSERT sync_outbox (update)', { result: outboxResult });
    } catch (err: any) {
      console.warn('[LegacyAdapter] Failed to queue sync update:', err);
    }

    return this.map(row);
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    const requestId = getRequestId();
    logTrace('ENTER LegacySQLiteProductAdapter.softDelete', { id, tenantId });
    const now = new Date().toISOString();
    
    // 1. Récupérer le remote_id AVANT le soft delete (pour le payload sync)
    logTrace('ENTER db.prepare SELECT softDelete');
    let productRow: any;
    try {
      productRow = db.prepare(`SELECT id, remote_id, tenant_id, business_id FROM products WHERE id = ?`).get(id) as any;
      logTrace('EXIT db.prepare SELECT softDelete', { productFound: !!productRow });
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'legacy-sqlite-product.adapter.ts',
        function: 'softDelete',
        line: 391,
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack,
        sql: 'SELECT id, remote_id, tenant_id, business_id FROM products WHERE id = ?',
        params: [id]
      }));
      throw error;
    }

    if (!productRow) {
      throw new Error(`Product #${id} not found`);
    }

    // Vérifier l'appartenance au tenant (comparaison robuste: nombre ou string)
    const rowTenantId = Number(productRow.tenant_id);
    const checkTenantId = Number(tenantId);
    if (rowTenantId !== checkTenantId) {
      throw new Error(`Product #${id} does not belong to tenant ${tenantId}`);
    }

    // 2. Soft delete local (is_available=0 pour cacher dans l'UI immédiatement)
    logTrace('ENTER db.prepare UPDATE softDelete');
    let result: any;
    try {
      const deleteStmt = db.prepare(`UPDATE products SET deleted_at = ?, is_available = 0, status = 'archived', sync_status = 'pending' WHERE id = ?`);
      result = deleteStmt.run(now, id);
      logTrace('EXIT db.prepare UPDATE softDelete', { changes: result?.changes });
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'legacy-sqlite-product.adapter.ts',
        function: 'softDelete',
        line: 405,
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack,
        sql: 'UPDATE products SET deleted_at = ?, is_available = 0, status = \'archived\', sync_status = \'pending\' WHERE id = ?',
        params: [now, id]
      }));
      throw error;
    }

    if (result.changes === 0) {
      throw new Error(`Product #${id} not found or does not belong to tenant ${tenantId}`);
    }

    // 3. Enregistrer dans l'outbox avec le remote_id pour le push vers Supabase
    // IMPORTANT: Utiliser 'delete' comme opération, PAS 'update'
    logTrace('ENTER db.prepare INSERT sync_outbox (delete)');
    try {
      if (productRow) {
        const crypto = require('crypto');
        const payload = {
          id: Number(id),
          remote_id: productRow.remote_id || null,
          is_available: 0,
          tenant_id: productRow.tenant_id || tenantId,
          updated_at: now,
        };
        const outboxStmt = db.prepare(`
          INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, tenant_id)
          VALUES (?, 'product', 'delete', ?, ?, ?, ?)
        `);
        const outboxResult = outboxStmt.run(
          crypto.randomUUID(),
          String(id),
          JSON.stringify(payload),
          1,  // version
          productRow.tenant_id || tenantId
        );
        logTrace('EXIT db.prepare INSERT sync_outbox (delete)', { result: outboxResult });
      }
    } catch (err: any) {
      console.warn('[LegacyAdapter] Failed to queue sync delete:', err);
    }
  }

  private map(row: any): ProductEntity {
    return {
      id: String(row.id),
      tenant_id: row.tenant_id ?? row.business_id ?? 'default-tenant',
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
