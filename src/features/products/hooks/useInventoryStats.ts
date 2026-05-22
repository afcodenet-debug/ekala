import { useMemo } from 'react';
import { Product } from '../types';

export interface InventoryStats {
  totalInventoryValue: number;
  estimatedProfit: number;
  lowStockAlerts: number;
  outOfStockCount: number;
  activeSKUs: number;
  deadStockValue: number;
  stockHealth: number;
}

export const useInventoryStats = (products: Product[]): InventoryStats => {
  return useMemo(() => {
    const totalInventoryValue = products.reduce(
      (sum, product) => sum + product.buying_price * product.stock_quantity,
      0
    );

    const estimatedProfit = products.reduce(
      (sum, product) => sum + (product.selling_price - product.buying_price) * product.stock_quantity,
      0
    );

    const lowStockAlerts = products.filter(
      product => product.stock_quantity > 0 && product.stock_quantity <= product.minimum_stock
    ).length;

    const outOfStockCount = products.filter(product => product.stock_quantity <= 0).length;

    const activeSKUs = products.filter(product => product.is_available).length;

    const deadStockProducts = products.filter(
      product => product.stock_quantity > 0 && product.stock_quantity <= Math.max(1, product.minimum_stock * 0.2)
    );

    const deadStockValue = deadStockProducts.reduce(
      (sum, product) => sum + product.stock_quantity * product.buying_price,
      0
    );

    const healthyProducts = products.filter(
      product => product.is_available && product.stock_quantity > product.minimum_stock
    ).length;

    const stockHealth = products.length > 0 ? Math.round((healthyProducts / products.length) * 100) : 100;

    return {
      totalInventoryValue,
      estimatedProfit,
      lowStockAlerts,
      outOfStockCount,
      activeSKUs,
      deadStockValue,
      stockHealth,
    };
  }, [products]);
};
