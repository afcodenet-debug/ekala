import { IProductRepository } from './product.repository.interface';
import { SupabaseProductRepository } from './supabase/supabase-product.repository';
import { LegacySQLiteProductAdapter } from './legacy/legacy-sqlite-product.adapter';
import { env } from '../../config/env';

export function getProductRepository(): IProductRepository {
  return env.USE_SUPABASE_PRODUCTS
    ? new SupabaseProductRepository()
    : new LegacySQLiteProductAdapter();
}
