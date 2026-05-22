import { create } from 'zustand';
import { api } from '../lib/api-client';

export interface RestaurantTable {
  id: number;
  table_number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  assigned_waiter_id?: number;
  current_order_id?: number;
}

interface TablesStore {
  tables: RestaurantTable[];
  fetchTables: () => Promise<void>;
  updateTableStatus: (id: number, status: RestaurantTable['status'], waiterId?: number) => Promise<void>;
  assignWaiter: (tableId: number, waiterId: number) => Promise<void>;
}

export const useTablesStore = create<TablesStore>((set, get) => ({
  tables: [],

  fetchTables: async () => {
    try {
      const tables = await api.tables.getAll();
      set({ tables });
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    }
  },

  updateTableStatus: async (id, status, waiterId) => {
    try {
      await api.tables.update(id, { status, assigned_waiter_id: waiterId });
      const { tables } = get();
      set({
        tables: tables.map(table =>
          table.id === id ? { ...table, status, assigned_waiter_id: waiterId } : table
        )
      });
    } catch (error) {
      console.error('Failed to update table status:', error);
    }
  },

  assignWaiter: async (tableId, waiterId) => {
    await get().updateTableStatus(tableId, 'available', waiterId);
  }
}));