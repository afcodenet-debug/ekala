import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api-client';

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'cashier' | 'waiter';

export interface User {
  id: number;
  full_name: string;
  email?: string;
  phone?: string;
  username: string;
  pin_code: string;
  role: UserRole;
  is_active?: boolean;
  // Phase 4 — SaaS multi-tenant
  tenant_id?: number;
  tenant_name?: string;
  tenant_slug?: string;
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isServerHealthy: boolean;
  login: (pin: string, identity?: string) => Promise<boolean>;
  logout: () => void;
  checkServer: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isServerHealthy: true,

      checkServer: async () => {
        try {
          const response = await fetch('/api/auth/status');
          set({ isServerHealthy: response.ok });
        } catch {
          set({ isServerHealthy: false });
        }
      },

      login: async (pin, identity) => {
        console.log(`[AuthStore] Attempting login with PIN: ${pin}, Identity: ${identity || 'none'}`);
        try {
          const user = await api.auth.login(pin, identity);
          console.log('[AuthStore] Login successful:', user);
          set({ user, isAuthenticated: true });
          return true;
        } catch (error: any) {
          console.warn('[AuthStore] Login failed:', error.message);
          return false;
        }
      },

      logout: () => {
        console.log('[AuthStore] Logging out');
        set({ user: null, isAuthenticated: false });
      },

      setUser: (user) => set({ user, isAuthenticated: !!user }),
    }),
    {
      name: 'olive-pos-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);