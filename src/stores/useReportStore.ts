import { create } from 'zustand';
import { api } from '../lib/api-client';

export interface SalesReport {
  date: string;
  total_sales: number;
  total_amount: number;
  transaction_count: number;
}

export interface ProductReport {
  product_id: number;
  product_name: string;
  quantity_sold: number;
  revenue: number;
}

interface ReportStore {
  dailySales: SalesReport[];
  weeklySales: SalesReport[];
  monthlySales: SalesReport[];
  topProducts: ProductReport[];
  lowStock: { id: number; name: string; stock_quantity: number; minimum_stock: number }[];
  loading: boolean;
  fetchDailySales: (date: string) => Promise<void>;
  fetchWeeklySales: (startDate: string, endDate: string) => Promise<void>;
  fetchMonthlySales: (month: string, year: string) => Promise<void>;
  fetchTopProducts: (limit?: number) => Promise<void>;
  fetchLowStock: () => Promise<void>;
}

export const useReportStore = create<ReportStore>((set) => ({
  dailySales: [],
  weeklySales: [],
  monthlySales: [],
  topProducts: [],
  lowStock: [],
  loading: false,

  fetchDailySales: async (date) => {
    set({ loading: true });
    try {
      const data = await api.reports.dailySales(date);
      set({ dailySales: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error('Failed to fetch daily sales', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchWeeklySales: async (startDate, endDate) => {
    set({ loading: true });
    try {
      const data = await api.reports.weeklySales(startDate, endDate);
      set({ weeklySales: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error('Failed to fetch weekly sales', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchMonthlySales: async (month, year) => {
    set({ loading: true });
    try {
      const data = await api.reports.monthlySales(month, year);
      set({ monthlySales: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error('Failed to fetch monthly sales', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchTopProducts: async (limit = 10) => {
    set({ loading: true });
    try {
      const data = await api.reports.topProducts(limit);
      set({ topProducts: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error('Failed to fetch top products', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchLowStock: async () => {
    set({ loading: true });
    try {
      const data = await api.reports.lowStock();
      set({ lowStock: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error('Failed to fetch low stock', err);
    } finally {
      set({ loading: false });
    }
  }
}));