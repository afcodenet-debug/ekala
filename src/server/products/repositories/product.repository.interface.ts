import { ProductEntity } from '../types/product.types';

export interface IProductRepository {
  // businessId is now optional for single-tenant / public QR menu mode
  findById(id: string, businessId?: string): Promise<ProductEntity | null>;
  findAll(
    businessId?: string,
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
  }>;

  create(dto: any, businessId?: string, userId?: string): Promise<ProductEntity>;
  update(id: string, dto: any, businessId?: string): Promise<ProductEntity>;
  softDelete(id: string, businessId?: string): Promise<void>;
}
