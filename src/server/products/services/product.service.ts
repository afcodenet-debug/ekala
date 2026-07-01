// src/server/products/services/product.service.ts
import { IProductRepository } from '../repositories/product.repository.interface';
import { getProductRepository } from '../repositories/product.repository.provider';
import {
  ProductResponseDTO,
  ProductListItemDTO,
  CreateProductDTO,
  UpdateProductDTO,
  ProductListQuery,
} from '../dtos/product.dto';
import { ProductEntity } from '../types/product.types';
import { NotFoundError } from '../../utils/error';
import { getRequestId, logTrace } from '../../utils/trace-utils';

/**
 * Product Service - Pure business logic.
 * Depends only on the IProductRepository interface.
 * Does NOT know whether we are using Supabase or the legacy SQLite adapter.
 *
 * IMPORTANT:
 * Sync logic must live exclusively under src/sync/.
 */
export class ProductService {
  constructor(private readonly productRepository: IProductRepository = getProductRepository()) {}

  async getProductById(id: string, businessId?: string): Promise<ProductResponseDTO> {
    const requestId = getRequestId();
    logTrace('ENTER ProductService.getProductById', { id, businessId });
    try {
      const product = await this.productRepository.findById(id, businessId);
      logTrace('EXIT ProductService.getProductById', { found: !!product });

      if (!product) {
        throw new NotFoundError('Product');
      }

      return this.toResponseDTO(product);
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'product.service.ts',
        function: 'getProductById',
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack
      }));
      throw error;
    }
  }

  async listProducts(businessId: string | undefined, query: ProductListQuery): Promise<{
    items: ProductListItemDTO[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const requestId = getRequestId();
    logTrace('ENTER ProductService.listProducts', { businessId, query });
    try {
      const result = await this.productRepository.findAll(businessId, query);
      logTrace('EXIT ProductService.listProducts', { count: result.data.length, total: result.total });

      return {
        items: result.data.map((p: ProductEntity) => this.toListItemDTO(p)),
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: result.hasMore,
      };
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'product.service.ts',
        function: 'listProducts',
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack
      }));
      throw error;
    }
  }

  async createProduct(dto: CreateProductDTO, businessId?: string, userId?: string): Promise<ProductResponseDTO> {
    const requestId = getRequestId();
    logTrace('ENTER ProductService.createProduct', { dto: { ...dto, name: dto.name }, businessId, userId });
    try {
      const created = await this.productRepository.create(dto, businessId, userId);
      logTrace('EXIT ProductService.createProduct', { createdId: created.id });
      return this.toResponseDTO(created);
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'product.service.ts',
        function: 'createProduct',
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack,
        dto: { ...dto, name: dto.name },
        businessId,
        userId
      }));
      throw error;
    }
  }

  async updateProduct(id: string, dto: UpdateProductDTO, businessId?: string): Promise<ProductResponseDTO> {
    const requestId = getRequestId();
    logTrace('ENTER ProductService.updateProduct', { id, businessId, dto });
    try {
      const updated = await this.productRepository.update(id, dto, businessId);
      logTrace('EXIT ProductService.updateProduct', { updatedId: updated.id });
      return this.toResponseDTO(updated);
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'product.service.ts',
        function: 'updateProduct',
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack,
        id,
        businessId,
        dto
      }));
      throw error;
    }
  }

  async deleteProduct(id: string, businessId?: string): Promise<void> {
    const requestId = getRequestId();
    logTrace('ENTER ProductService.deleteProduct', { id, businessId });
    try {
      await this.productRepository.softDelete(id, businessId);
      logTrace('EXIT ProductService.deleteProduct', { id });
    } catch (error: any) {
      console.error(JSON.stringify({
        requestId,
        file: 'product.service.ts',
        function: 'deleteProduct',
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorStack: error?.stack,
        id,
        businessId
      }));
      throw error;
    }
  }

  // === Mapping methods (private) ===

  private toResponseDTO(entity: ProductEntity): ProductResponseDTO {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      sku: entity.sku,
      barcode: entity.barcode,
      price: entity.price,
      cost_price: entity.cost_price,
      stock_quantity: entity.stock_quantity,
      low_stock_threshold: entity.low_stock_threshold,
      image_url: entity.image_url,
      is_available: entity.is_available,
      is_featured: entity.is_featured,
      category_id: entity.category_id,
      sort_order: entity.sort_order,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  private toListItemDTO(entity: ProductEntity): ProductListItemDTO {
    return {
      id: entity.id,
      name: entity.name,
      price: entity.price,
      stock_quantity: entity.stock_quantity,
      is_available: entity.is_available,
      image_url: entity.image_url,
      is_featured: entity.is_featured,
      category_id: entity.category_id,
    };
  }
}

// Singleton for now (will be replaced by proper DI container later)
export const productService = new ProductService();
