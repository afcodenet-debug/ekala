import { createClient } from '@supabase/supabase-js';
import { ProductEntity, IProductRepository } from '../product.repository.interface';
import { env } from '../../../config/env';

export class SupabaseProductRepository implements IProductRepository {
  private supabase = createClient(
    env.SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  async findAvailableForMenu(businessId: string): Promise<ProductEntity[]> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('is_available', true)
      .is('deleted_at', null);

    if (error) throw error;
    return (data || []).map(this.map);
  }

  private map(row: any): ProductEntity {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price,
      category_id: row.category_id,
      image_url: row.image_url,
      is_available: row.is_available,
      stock_quantity: row.stock_quantity,
      unit: row.unit,
      low_stock_threshold: row.low_stock_threshold,
    };
  }
}
