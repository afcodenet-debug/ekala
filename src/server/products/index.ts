// src/server/products/index.ts
// Barrel export for the Products domain module

export type { IProductRepository } from './repositories/product.repository.interface';
export { productService } from './services/product.service';
export { productController } from './controllers/product.controller';
export { default as productsRoutes } from './routes/products.routes';
