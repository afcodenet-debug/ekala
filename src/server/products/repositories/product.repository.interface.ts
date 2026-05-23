export interface ProductEntity {
  id: string | number;
  business_id?: string;
  name: string;
  description?: string | null;
  price: number;
  category_id?: number | string | null;
  image_url?: string | null;
  is_available: boolean;
  stock_quantity?: number;
  unit?: string | null;
  low_stock_threshold?: number;
}

export interface IProductRepository {
  findAvailableForMenu(businessId: string): Promise<ProductEntity[]>;
}
