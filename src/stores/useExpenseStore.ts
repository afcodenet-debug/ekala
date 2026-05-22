import { create } from 'zustand';
import { api } from '../lib/api-client';

export interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  user_id: number;
  created_at: string;
  user_name?: string;
}

interface ExpenseStore {
  expenses: Expense[];
  loading: boolean;
  fetchExpenses: () => Promise<void>;
  createExpense: (expense: Omit<Expense, 'id' | 'created_at'>) => Promise<Expense | null>;
  deleteExpense: (id: number) => Promise<boolean>;
}

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
  expenses: [],
  loading: false,

  fetchExpenses: async () => {
    set({ loading: true });
    try {
      const expenses = await api.expenses.getAll();
      set({ expenses: Array.isArray(expenses) ? expenses : [] });
    } catch (err) {
      console.error('Failed to fetch expenses', err);
    } finally {
      set({ loading: false });
    }
  },

  createExpense: async (expenseData) => {
    set({ loading: true });
    try {
      const newExpense = await api.expenses.create(expenseData);
      if (newExpense) {
        set({ expenses: [...get().expenses, { ...expenseData, ...newExpense }] });
        return { ...expenseData, ...newExpense };
      }
      return null;
    } catch (err) {
      console.error('Failed to create expense', err);
      return null;
    } finally {
      set({ loading: false });
    }
  },

  deleteExpense: async (id) => {
    try {
      const success = await api.expenses.delete(id);
      if (success) {
        set({ expenses: get().expenses.filter(e => e.id !== id) });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete expense', err);
      return false;
    }
  }
}));