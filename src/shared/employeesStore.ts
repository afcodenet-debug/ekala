import { create } from 'zustand';
import { api } from '../lib/api-client';

export interface Employee {
  id: number;
  full_name: string;
  role: 'admin' | 'manager' | 'waiter';
  username?: string;
  is_active: number;
  created_at: string;
}

interface EmployeesStore {
  employees: Employee[];
  fetchEmployees: () => Promise<void>;
}

export const useEmployeesStore = create<EmployeesStore>((set) => ({
  employees: [],

  fetchEmployees: async () => {
    try {
      const employees = await api.users.getAll();
      set({ employees });
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  }
}));