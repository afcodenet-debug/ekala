import { create } from 'zustand';
import { api } from '../lib/api-client';

export interface Sale {
  id: number;
  invoice_number: string;
  order_id?: number;
  user_id: number;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  payment_method: 'cash' | 'card' | 'mobile_money';
  created_at: string;
  user_name?: string;
}

export interface CheckoutData {
  order_id: number;
  payment_method: string;
  discount?: number;
  tax?: number;
  customer_id?: number;
  items?: Array<{ productId: number; name: string; price: number; quantity: number; notes?: string }>;
}

interface SaleStore {
  sales: Sale[];
  currentSale: Partial<Sale> | null;
  loading: boolean;
  fetchSales: (filters?: { startDate?: string; endDate?: string }) => Promise<void>;
  processCheckout: (checkoutData: CheckoutData) => Promise<Sale | null>;
  generateReceipt: (saleId: number) => Promise<string>;
}

export const useSaleStore = create<SaleStore>((set, get) => ({
  sales: [],
  currentSale: null,
  loading: false,

  fetchSales: async (filters) => {
    set({ loading: true });
    try {
      const params: Record<string, string | number> = {};
      if (filters?.startDate) params.startDate = filters.startDate;
      if (filters?.endDate) params.endDate = filters.endDate;
      
      const sales = await api.sales.getAll(params.length ? params : undefined);
      set({ sales: Array.isArray(sales) ? sales : [] });
    } catch (err) {
      console.error('Failed to fetch sales', err);
    } finally {
      set({ loading: false });
    }
  },

  processCheckout: async (checkoutData) => {
    set({ loading: true });
    try {
      const sale = await api.sales.checkout(checkoutData);
      set({ currentSale: sale });
      get().fetchSales();
      return sale;
    } catch (err: any) {
      console.error('Checkout failed', err);
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  generateReceipt: async (saleId) => {
    try {
      const response = await fetch(`/api/sales/${saleId}/receipt`);
      if (response.ok) {
        return await response.text();
      }
      return 'Receipt generation failed';
    } catch (err) {
      console.error('Failed to generate receipt', err);
      return 'Error generating receipt';
    }
  }
}));