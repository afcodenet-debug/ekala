import { IProductRepository } from './product.repository.interface';
import { SupabaseProductRepository } from './supabase/supabase-product.repository';
import { env } from '../../config/env';

let legacyProductAdapter: any = null;

export function getProductRepository(): IProductRepository {
  if (env.USE_SUPABASE_PRODUCTS) {
    return new SupabaseProductRepository();
  }
  if (!legacyProductAdapter) {
    legacyProductAdapter = require('./legacy/legacy-sqlite-product.adapter').LegacySQLiteProductAdapter;
  }
  return new legacyProductAdapter();
}
