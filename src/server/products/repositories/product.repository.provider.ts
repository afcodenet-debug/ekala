import { IProductRepository } from './product.repository.interface';
import { SupabaseProductRepository } from './supabase/supabase-product.repository';
import { dataSource } from '../../infrastructure/data-source-manager';
import { getRequestId, logTrace } from '../../utils/trace-utils';

let legacyProductAdapter: any = null;

export function getProductRepository(): IProductRepository {
  const requestId = getRequestId();
  const isSupabaseMode = dataSource.isCloud();
  logTrace('ENTER getProductRepository', { isSupabaseMode });
  
  if (isSupabaseMode) {
    logTrace('CHOICE SupabaseRepository');
    return new SupabaseProductRepository();
  }
  
  logTrace('CHOICE LegacySQLiteAdapter');
  if (!legacyProductAdapter) {
    legacyProductAdapter = require('./legacy/legacy-sqlite-product.adapter').LegacySQLiteProductAdapter;
  }
  return new legacyProductAdapter();
}
