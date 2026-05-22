import { useCallback, useMemo, useState } from 'react';
import { Category, Product } from '../types';

export type InventoryStatusFilter = 'all' | 'low_stock' | 'out_of_stock' | 'in_stock' | 'inactive';
export type InventoryMarginFilter = 'all' | 'high_margin' | 'profitable';

export interface InventoryFiltersState {
  search: string;
  categoryId: number | null;
  status: InventoryStatusFilter;
  margin: InventoryMarginFilter;
}

export interface InventoryFiltersResult {
  filters: InventoryFiltersState;
  activeFiltersCount: number;
  filteredProducts: Product[];
  updateFilter: <K extends keyof InventoryFiltersState>(field: K, value: InventoryFiltersState[K]) => void;
  clearFilters: () => void;
}

const DEFAULT_FILTERS: InventoryFiltersState = {
  search: '',
  categoryId: null,
  status: 'all',
  margin: 'all',
};

const isProductVisible = (product: Product, filters: InventoryFiltersState) => {
  const normalizedSearch = filters.search.trim().toLowerCase();
  const matchesSearch = !normalizedSearch || [product.name, product.barcode ?? '', product.category_name]
    .some(value => value.toLowerCase().includes(normalizedSearch));

  const matchesCategory = filters.categoryId === null || product.category_id === filters.categoryId;

  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= product.minimum_stock;
  const isOutOfStock = product.stock_quantity <= 0;
  const isInStock = product.stock_quantity > product.minimum_stock;
  const isInactive = !product.is_available;

  const matchesStatus =
    filters.status === 'all'
      ? true
      : filters.status === 'low_stock'
        ? isLowStock
        : filters.status === 'out_of_stock'
          ? isOutOfStock
          : filters.status === 'in_stock'
            ? isInStock
            : isInactive;

  const marginPercentage = product.selling_price > 0
    ? ((product.selling_price - product.buying_price) / product.selling_price) * 100
    : 0;

  const matchesMargin =
    filters.margin === 'all'
      ? true
      : filters.margin === 'profitable'
        ? product.selling_price > product.buying_price
        : marginPercentage >= 25;

  return matchesSearch && matchesCategory && matchesStatus && matchesMargin;
};

export const useInventoryFilters = (products: Product[], categories: Category[]): InventoryFiltersResult => {
  const [filters, setFilters] = useState<InventoryFiltersState>(DEFAULT_FILTERS);

  const updateFilter = useCallback(<K extends keyof InventoryFiltersState>(field: K, value: InventoryFiltersState[K]) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const activeFiltersCount = useMemo(() => {
    return [
      filters.search.trim() ? 1 : 0,
      filters.categoryId !== null ? 1 : 0,
      filters.status !== 'all' ? 1 : 0,
      filters.margin !== 'all' ? 1 : 0,
    ].reduce((sum, value) => sum + value, 0);
  }, [filters]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => isProductVisible(product, filters));
  }, [products, filters]);

  return {
    filters,
    activeFiltersCount,
    filteredProducts,
    updateFilter,
    clearFilters,
  };
};
