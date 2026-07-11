import { createClient } from '@supabase/supabase-js';
import { env } from '../../../config/env';
import { IProductRepository } from '../product.repository.interface';
import { ProductEntity } from '../../types/product.types';
import { getRequestId, logTrace } from '../../../utils/trace-utils';
import { WriteInterceptor } from '../../../infrastructure/synchronization/write-interceptor';
import { mirrorRemoteRecord, deleteMirroredRecord } from '../../../services/remote-mirror';

export class SupabaseProductRepository implements IProductRepository {
  private supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  async findById(id: string, tenantId?: string): Promise<ProductEntity | null> {
    const requestId = getRequestId();
    logTrace('ENTER SupabaseProductRepository.findById', { id, tenantId });
    let qb = this.supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null);

    if (tenantId) {
      qb = qb.eq('tenant_id', tenantId);
    }

    const { data, error } = await qb.maybeSingle();
    logTrace('EXIT SupabaseProductRepository.findById', { found: !!data, error: error?.message });

    if (error) throw error;
    return data ? this.map(data) : null;
  }

  async findAll(
    tenantId?: string,
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
    const requestId = getRequestId();
    logTrace('ENTER SupabaseProductRepository.findAll', { tenantId, query });
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 50;
    const from = (page - 1) * limit;

    let qb = this.supabase
      .from('products')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    if (tenantId) {
      qb = qb.eq('tenant_id', tenantId);
    }

    if (query?.search) {
      qb = qb.ilike('name', `%${query.search}%`);
    }
    if (query?.category_id) {
      qb = qb.eq('category_id', query.category_id);
    }
    if (typeof query?.is_available === 'boolean') {
      qb = qb.eq('is_available', query.is_available);
    }
    if (typeof query?.is_featured === 'boolean') {
      qb = qb.eq('is_featured', query.is_featured);
    }

    const sortBy = query?.sort_by ?? 'sort_order';
    const sortOrder = query?.sort_order ?? 'asc';
    qb = qb.order(sortBy as any, { ascending: sortOrder === 'asc' });

    qb = qb.range(from, from + limit - 1);

    const { data, error, count } = await qb;
    logTrace('EXIT SupabaseProductRepository.findAll', { count: data?.length, total: count, error: error?.message });
    if (error) throw error;

    const total = count ?? 0;
    const hasMore = from + limit < total;

    return {
      data: (data || []).map(this.map),
      total,
      page,
      limit,
      hasMore,
    };
  }

  async create(dto: any, tenantId?: string, userId?: string): Promise<ProductEntity> {
    const requestId = getRequestId();
    logTrace('ENTER SupabaseProductRepository.create', { dto: { ...dto, name: dto.name }, tenantId, userId });
    
    const payload: any = {
      ...dto,
      ...(tenantId ? { tenant_id: tenantId } : {}),
      ...(userId ? { created_by: userId, updated_by: userId } : {}),
    };

    logTrace('ENTER Supabase INSERT products');
    const writeInterceptor = WriteInterceptor.getInstance();
    writeInterceptor.verifyWritePermission({
      operation: 'insert',
      table: 'products',
      caller: 'supabase-product.repository.ts/create'
    });
    
    let data: any, error: any;
    try {
      const result = await this.supabase.from('products').insert(payload).select('*').single();
      data = result.data;
      error = result.error;
      logTrace('EXIT Supabase INSERT products', { data, error: error?.message });
    } catch (err: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'supabase-product.repository.ts',
        function: 'create',
        errorType: err?.constructor?.name,
        errorCode: err?.code,
        errorMessage: err?.message,
        errorStack: err?.stack,
        payload
      }));
      throw err;
    }
    if (error) throw error;

    // Miroir bidirectionnel : le produit cloud est aussi matérialisé dans SQLite
    try {
      mirrorRemoteRecord(Number(tenantId) || Number(data.tenant_id), 'product', data);
    } catch (mirrorErr: any) {
      console.warn('[ProductRepo] Cloud→SQLite mirror failed (non-critical):', mirrorErr?.message);
    }

    return this.map(data);
  }

  async update(id: string, dto: any, tenantId?: string): Promise<ProductEntity> {
    const requestId = getRequestId();
    logTrace('ENTER SupabaseProductRepository.update', { id, tenantId, dto });
    const payload = { ...dto };

    let qb = this.supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .is('deleted_at', null);

    if (tenantId) {
      qb = qb.eq('tenant_id', tenantId);
    }

    let data: any, error: any;
    try {
      const result = await qb.select('*').single();
      data = result.data;
      error = result.error;
      logTrace('EXIT SupabaseProductRepository.update', { data, error: error?.message });
    } catch (err: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'supabase-product.repository.ts',
        function: 'update',
        errorType: err?.constructor?.name,
        errorCode: err?.code,
        errorMessage: err?.message,
        errorStack: err?.stack,
        id,
        tenantId,
        payload
      }));
      throw err;
    }
    if (error) throw error;

    // Miroir bidirectionnel : reflète la mise à jour dans SQLite
    try {
      mirrorRemoteRecord(Number(tenantId) || Number(data.tenant_id), 'product', data);
    } catch (mirrorErr: any) {
      console.warn('[ProductRepo] Cloud→SQLite mirror failed (non-critical):', mirrorErr?.message);
    }

    return this.map(data);
  }

  async softDelete(id: string, tenantId?: string): Promise<void> {
    const requestId = getRequestId();
    logTrace('ENTER SupabaseProductRepository.softDelete', { id, tenantId });
    let qb = this.supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (tenantId) {
      qb = qb.eq('tenant_id', tenantId);
    }

    let error: any;
    try {
      const result = await qb;
      error = result.error;
      logTrace('EXIT SupabaseProductRepository.softDelete', { error: error?.message });
    } catch (err: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'supabase-product.repository.ts',
        function: 'softDelete',
        errorType: err?.constructor?.name,
        errorCode: err?.code,
        errorMessage: err?.message,
        errorStack: err?.stack,
        id,
        tenantId
      }));
      throw err;
    }
    if (error) throw error;

    // Miroir bidirectionnel : supprime aussi le produit de la SQLite locale
    try {
      deleteMirroredRecord(Number(tenantId) || 0, 'product', Number(id));
    } catch (mirrorErr: any) {
      console.warn('[ProductRepo] Cloud→SQLite mirror delete failed (non-critical):', mirrorErr?.message);
    }
  }

  private map(row: any): ProductEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id ?? null,
      branch_id: row.branch_id ?? null,
      category_id: row.category_id,
      name: row.name,
      description: row.description ?? null,
      sku: row.sku ?? null,
      barcode: row.barcode ?? null,
      // The current Supabase products table uses legacy columns (selling_price / buying_price).
      // We map them to the new model fields so the rest of the app can consume them uniformly.
      price: row.price ?? row.selling_price ?? null,
      cost_price: row.cost_price ?? row.buying_price ?? null,
      stock_quantity: row.stock_quantity ?? 0,
      low_stock_threshold: row.low_stock_threshold ?? 0,
      image_url: row.image_url ?? null,
      is_available: !!row.is_available,
      is_featured: !!row.is_featured,
      sort_order: row.sort_order ?? 0,
      metadata: row.metadata ?? null,
      version: row.version ?? 0,
      sync_status: row.sync_status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at ?? null,
    };
  }
}
