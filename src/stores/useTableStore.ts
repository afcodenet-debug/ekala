import { create } from 'zustand';
import { api } from '../lib/api-client';

export type TableStatus = 'available' | 'active' | 'reserved' | 'cleaning' | 'out_of_service';

export interface Table {
  id: number;
  table_number: string | number;
  capacity: number;
  status: TableStatus;
  assigned_waiter_id: number | null;
  waiter_name?: string;
  qr_token?: string | null;
  created_at: string;
  updated_at: string;
}

interface TableStore {
  tables: Table[];
  isLoading: boolean;
  error: string | null;
  userId?: number;
  role?: string;

  // Actions
  setUserContext: (userId: number, role: string) => void;
  fetchTables: (silent?: boolean) => Promise<void>;
  createTable: (tableData: Omit<Table, 'id' | 'created_at' | 'updated_at'>) => Promise<Table | null>;
  updateTable: (id: number, updates: Partial<Table>) => Promise<void>;
  deleteTable: (id: number) => Promise<boolean>;
  openTable: (tableId: number, waiterId: number) => Promise<boolean>;
  closeTable: (tableId: number) => Promise<boolean>;
  assignWaiter: (tableId: number, waiterId: number | null) => Promise<void>;
  updateTableStatus: (tableId: number, status: TableStatus) => Promise<void>;
  reserveTable: (tableId: number) => Promise<void>;
  markCleaning: (tableId: number) => Promise<void>;
  setAvailable: (tableId: number) => Promise<void>;
  setOutOfService: (tableId: number) => Promise<void>;
}

export const useTableStore = create<TableStore>((set, get) => ({
  tables: [],
  isLoading: false,
  error: null,
  userId: undefined,
  role: undefined,

  setUserContext: (userId, role) => set({ userId, role }),

  fetchTables: async (silent = false) => {
    const { userId, role } = get();
    if (!userId || !role) return;

    if (!silent) set({ isLoading: true, error: null });
    try {
      const params: Record<string, string | number> = { role };
      if (role === 'waiter') {
        params.waiter_id = userId;
      }
      const tables = await api.tables.getAll(params, get().role);
      set({ tables: Array.isArray(tables) ? tables : [], isLoading: false });
    } catch (err: any) {
      console.error('Failed to fetch tables', err);
      set({ error: err.message || 'Failed to fetch tables', isLoading: false });
    }
  },

  createTable: async (tableData) => {
    try {
      const newTable = await api.tables.create(tableData, get().role);
      if (newTable) {
        set({ tables: [...get().tables, newTable] });
        return newTable;
      }
      return null;
    } catch (err: any) {
      console.error('Failed to create table', err);
      set({ error: err.message });
      throw err;
    }
  },

  updateTable: async (id, updates) => {
    try {
      await api.tables.update(id, updates, get().role);
      const tables = get().tables.map(table =>
        table.id === id ? { ...table, ...updates } : table
      );
      set({ tables });
    } catch (err: any) {
      console.error('Failed to update table', err);
      set({ error: err.message });
    }
  },

  deleteTable: async (id) => {
    try {
      await api.tables.delete(id, get().role);
      set({ tables: get().tables.filter(table => table.id !== id) });
      return true;
    } catch (err: any) {
      console.error('Failed to delete table', err);
      set({ error: err.message });
      return false;
    }
  },

  openTable: async (tableId, waiterId) => {
    try {
      await api.tables.open(tableId, waiterId);
      // Re-fetch to get the waiter_name and updated status correctly
      await get().fetchTables(true);
      return true;
    } catch (err: any) {
      console.error('Failed to open table', err);
      set({ error: err.message });
      return false;
    }
  },

  closeTable: async (tableId) => {
    try {
      // This would need a new API endpoint
      const tables = get().tables.map(table =>
        table.id === tableId ? { ...table, status: 'available' as TableStatus } : table
      );
      set({ tables });
      return true;
    } catch (err: any) {
      console.error('Failed to close table', err);
      set({ error: err.message });
      return false;
    }
  },

  assignWaiter: async (tableId, waiterId) => {
    try {
      await api.tables.update(tableId, { assigned_waiter_id: waiterId }, get().role);
      // Re-fetch to get the waiter_name joined from the users table
      await get().fetchTables(true);
    } catch (err: any) {
      console.error('Failed to assign waiter', err);
      set({ error: err.message });
    }
  },

  updateTableStatus: async (tableId, status) => {
    try {
      await api.tables.update(tableId, { status }, get().role);
      const tables = get().tables.map(table =>
        table.id === tableId ? { ...table, status } : table
      );
      set({ tables });
    } catch (err: any) {
      console.error('Failed to update table status', err);
      set({ error: err.message });
    }
  },

  reserveTable: async (tableId) => {
    try {
      await api.tables.reserve(tableId);
      const tables = get().tables.map(table =>
        table.id === tableId ? { ...table, status: 'reserved' as TableStatus } : table
      );
      set({ tables });
    } catch (err: any) {
      console.error('Failed to reserve table', err);
      set({ error: err.message });
    }
  },

  markCleaning: async (tableId) => {
    try {
      await api.tables.markCleaning(tableId);
      const tables = get().tables.map(table =>
        table.id === tableId ? { ...table, status: 'cleaning' as TableStatus } : table
      );
      set({ tables });
    } catch (err: any) {
      console.error('Failed to mark table for cleaning', err);
      set({ error: err.message });
    }
  },

  setAvailable: async (tableId) => {
    try {
      await api.tables.setAvailable(tableId);
      const tables = get().tables.map(table =>
        table.id === tableId ? { ...table, status: 'available' as TableStatus, assigned_waiter_id: null } : table
      );
      set({ tables });
    } catch (err: any) {
      console.error('Failed to set table available', err);
      set({ error: err.message });
    }
  },

  setOutOfService: async (tableId) => {
    try {
      await api.tables.setOutOfService(tableId);
      const tables = get().tables.map(table =>
        table.id === tableId ? { ...table, status: 'out_of_service' as TableStatus } : table
      );
      set({ tables });
    } catch (err: any) {
      console.error('Failed to set table out of service', err);
      set({ error: err.message });
    }
  }
}));