import { create } from 'zustand';
import { api } from '../../../lib/api-client';
import type { StockAdjustment, Supplier, PurchaseOrder } from '../../../types/database';
import type { Product } from '../types';

// ---------------------------------------------------------------------------
// Product / Inventory Store
// ---------------------------------------------------------------------------

export interface Category {
  id: number;
  name: string;
  description?: string;
}

export interface InventoryMovement {
  id: number;
  product_id: number;
  movement_type: string;
  quantity_before: number;
  quantity_changed: number;
  quantity_after: number;
  unit_cost: number;
  total_value: number;
  reference_type?: string;
  reference_id?: number;
  reason?: string;
  created_by?: number;
  approved_by?: number;
  created_at: string;
  product_name?: string;
  barcode?: string;
}

interface ProductStore {
  products:    Product[];
  categories:  Category[];
  movements:   InventoryMovement[];
  loading:     boolean;

  // Products
  fetchProducts:    () => Promise<void>;
  fetchCategories:  () => Promise<void>;
  createProduct:    (data: Partial<Product>, role?: string) => Promise<{ success: boolean; error?: string }>;
  updateProduct:    (id: number, data: Partial<Product>, role?: string) => Promise<{ success: boolean; error?: string }>;
  deleteProduct:    (id: number) => Promise<boolean>;

  // Stock
  adjustStock:      (productId: number, data: { quantity: number; type: string; reason: string }, role?: string) => Promise<boolean>;
  fetchMovements:   (productId?: number) => Promise<InventoryMovement[]>;

  // Analytics
  fetchAnalytics:   () => Promise<any>;

  // Stock Adjustments
  fetchStockAdjustments: () => Promise<StockAdjustment[]>;
  createStockAdjustment: (data: Partial<StockAdjustment>) => Promise<StockAdjustment | null>;
  approveStockAdjustment: (id: number, approvedBy: number) => Promise<boolean>;
  rejectStockAdjustment:  (id: number, rejectedBy: number, notes?: string) => Promise<boolean>;
  cancelStockAdjustment:  (id: number) => Promise<boolean>;
  addAdjustmentItem:      (adjustmentId: number, item: any) => Promise<boolean>;

  // Suppliers
  fetchSuppliers:   () => Promise<Supplier[]>;
  createSupplier:   (data: Partial<Supplier>, role?: string) => Promise<Supplier | null>;
  updateSupplier:   (id: number, data: Partial<Supplier>, role?: string) => Promise<boolean>;

  // Purchase Orders
  fetchPurchaseOrders: (supplierId?: number, status?: string) => Promise<PurchaseOrder[]>;
  fetchPurchaseOrder:  (id: number) => Promise<PurchaseOrder | null>;
  createPurchaseOrder: (data: any, role?: string) => Promise<PurchaseOrder | null>;
  receivePurchaseOrderItem: (poId: number, itemId: number, qtyReceived: number) => Promise<boolean>;
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products:    [],
  categories:  [],
  movements:   [],
  loading:     false,

  // ── Products ──────────────────────────────────────────────────────────────

  fetchProducts: async () => {
    set({ loading: true });
    try {
      const products = await api.products.getAll();
      set({ products: (Array.isArray(products) ? products : []) as Product[] });
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchCategories: async () => {
    try {
      const categories = await api.categories.getAll();
      set({ categories: (Array.isArray(categories) ? categories : []) as Category[] });
    } catch (err: any) {
      console.error('[useProductStore] fetchCategories FAILED — make sure src/server/routes/categories.ts is registered in server.ts:', err.message);
      set({ categories: [] });
    }
  },

  createProduct: async (data: Partial<Product>, role?: string) => {
    try {
      await api.products.create(data, role);
      get().fetchProducts();
      return { success: true };
    } catch (err: any) {
      console.error('Failed to create product', err);
      const errorMsg = err?.response?.data?.error || err?.data?.error || err?.message || '';
      return { success: false, error: errorMsg };
    }
  },

  updateProduct: async (id: number, data: Partial<Product>, role?: string) => {
    try {
      await api.products.update(id, data, role);
      get().fetchProducts();
      return { success: true };
    } catch (err: any) {
      console.error('Failed to update product', err);
      const errorMsg = err?.response?.data?.error || err?.data?.error || err?.message || '';
      return { success: false, error: errorMsg };
    }
  },

  deleteProduct: async (id: number) => {
    try {
      await api.products.delete(id);
      get().fetchProducts();
      return true;
    } catch (err) {
      console.error('Failed to delete product', err);
      return false;
    }
  },

  // ── Stock ─────────────────────────────────────────────────────────────────

  adjustStock: async (productId: number, data: { quantity: number; type: string; reason: string }, role?: string) => {
    try {
      await api.products.adjustStock(productId, data, role);
      get().fetchProducts();
      return true;
    } catch (err) {
      console.error('Failed to adjust stock', err);
      return false;
    }
  },

  fetchMovements: async (productId?: number) => {
    try {
      const data = await api.inventory.getMovements(productId ? { product_id: productId } : undefined);
      const arr  = Array.isArray(data) ? (data as InventoryMovement[]) : [];
      set({ movements: arr });
      return arr;
    } catch (err) {
      console.error('Failed to fetch movements', err);
      return [];
    }
  },

  // ── Analytics ─────────────────────────────────────────────────────────────

  fetchAnalytics: async () => {
    try {
      return await api.inventory.getAnalytics();
    } catch (err) {
      console.error('Failed to fetch analytics', err);
      throw err;
    }
  },

  // ── Stock Adjustments ─────────────────────────────────────────────────────

  fetchStockAdjustments: async (): Promise<StockAdjustment[]> => {
    try {
      return (await api.stockAdjustments.getAll()) as StockAdjustment[];
    } catch (err) {
      console.error('Failed to fetch stock adjustments', err);
      return [];
    }
  },

  createStockAdjustment: async (data: Partial<StockAdjustment>): Promise<StockAdjustment | null> => {
    try {
      const result = await api.stockAdjustments.create(data) as any;
      return result as StockAdjustment | null;
    } catch (err) {
      console.error('Failed to create stock adjustment', err);
      return null;
    }
  },

  approveStockAdjustment: async (id: number, approvedBy: number): Promise<boolean> => {
    try {
      await api.stockAdjustments.approve(id, { approved_by: approvedBy });
      return true;
    } catch (err) {
      console.error('Failed to approve stock adjustment', err);
      return false;
    }
  },

  rejectStockAdjustment: async (id: number, rejectedBy: number, notes?: string): Promise<boolean> => {
    try {
      await api.stockAdjustments.reject(id, { approved_by: rejectedBy, notes });
      return true;
    } catch (err) {
      console.error('Failed to reject stock adjustment', err);
      return false;
    }
  },

  cancelStockAdjustment: async (id: number): Promise<boolean> => {
    try {
      await api.stockAdjustments.cancel(id);
      return true;
    } catch (err) {
      console.error('Failed to cancel stock adjustment', err);
      return false;
    }
  },

  addAdjustmentItem: async (adjustmentId: number, item: any): Promise<boolean> => {
    try {
      await api.stockAdjustments.addItem(adjustmentId, item);
      return true;
    } catch (err) {
      console.error('Failed to add adjustment item', err);
      return false;
    }
  },

  // ── Suppliers ─────────────────────────────────────────────────────────────

  fetchSuppliers: async (): Promise<Supplier[]> => {
    try {
      return (await api.suppliers.getAll()) as Supplier[];
    } catch (err) {
      console.error('Failed to fetch suppliers', err);
      return [];
    }
  },

  createSupplier: async (data: Partial<Supplier>, role?: string): Promise<Supplier | null> => {
    try {
      const result = await api.suppliers.create(data, role) as any;
      return result as Supplier | null;
    } catch (err) {
      console.error('Failed to create supplier', err);
      return null;
    }
  },

  updateSupplier: async (id: number, data: Partial<Supplier>, role?: string): Promise<boolean> => {
    try {
      await api.suppliers.update(id, data, role);
      return true;
    } catch (err) {
      console.error('Failed to update supplier', err);
      return false;
    }
  },

  // ── Purchase Orders ───────────────────────────────────────────────────────

  fetchPurchaseOrders: async (supplierId?: number, status?: string): Promise<PurchaseOrder[]> => {
    try {
      const params: Record<string, string | number> = {};
      if (supplierId !== undefined) params.supplier_id = supplierId;
      if (status) params.status = status;
      return (await api.purchaseOrders.getAll(params)) as PurchaseOrder[];
    } catch (err) {
      console.error('Failed to fetch purchase orders', err);
      return [];
    }
  },

  fetchPurchaseOrder: async (id: number): Promise<PurchaseOrder | null> => {
    try {
      const result = await api.purchaseOrders.getById(id) as any;
      return result as PurchaseOrder | null;
    } catch (err) {
      console.error('Failed to fetch purchase order', err);
      return null;
    }
  },

  createPurchaseOrder: async (data: any, role?: string): Promise<PurchaseOrder | null> => {
    try {
      const result = await api.purchaseOrders.create(data, role) as any;
      return result as PurchaseOrder | null;
    } catch (err) {
      console.error('Failed to create purchase order', err);
      return null;
    }
  },

  receivePurchaseOrderItem: async (_poId: number, _itemId: number, _qtyReceived: number): Promise<boolean> => {
    try {
      // The trigger on purchase_order_items auto-creates inventory_movement
      // and adjusts stock_quantity when quantity_received is updated.
      // We call a dedicated endpoint once available; for now this is a stub.
      console.info('[store] receivePurchaseOrderItem called — implementation pending.');
      return true;
    } catch (err) {
      console.error('Failed to receive PO item', err);
      return false;
    }
  },
}));
