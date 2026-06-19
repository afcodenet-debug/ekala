import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setAuthToken, clearAuthToken } from '../lib/api-client';

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter';

export interface User {
  id: number;
  full_name: string;
  email?: string;
  phone?: string;
  username: string;
  pin_code?: string;  // No longer stored client-side
  role: UserRole;
  is_active?: boolean;
  tenant_id?: number;
  tenant_name?: string;
  tenant_slug?: string;
  status?: 'active' | 'suspended' | 'cancelled' | 'trial' | 'past_due' | 'expired';
  plan_name?: string;
  expires_at?: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isServerHealthy: boolean;
  isInitialized: boolean;

  // New JWT-based login methods
  loginEmail: (email: string, password: string) => Promise<boolean>;
  loginPin: (pin: string, identity?: string, tenant_slug?: string) => Promise<boolean>;
  
  // Legacy (backward compatibility)
  login: (pin: string, identity?: string) => Promise<boolean>;

  logout: () => void;
  checkServer: () => Promise<void>;
  setUser: (user: User | null) => void;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isServerHealthy: true,
      isInitialized: false,

      checkServer: async () => {
        try {
          const response = await fetch('/api/auth/status');
          set({ isServerHealthy: response.ok });
        } catch {
          set({ isServerHealthy: false });
        }
      },

      // ── Admin/Owner login (email + password → JWT) ─────────────────────────
      loginEmail: async (email, password) => {
        try {
          const resp = await api.auth.loginEmail(email, password);
          const { token, user } = resp;

          setAuthToken(token);
          set({ user, token, isAuthenticated: true, isInitialized: true });
          
          console.log(`[AuthStore] Email login success: ${user.full_name} (${user.role}) → tenant ${user.tenant_name}`);
          return true;
        } catch (error: any) {
          console.warn('[AuthStore] Email login failed:', error.message);
          return false;
        }
      },

      // ── Staff login (tenant_slug + PIN → JWT) ─────────────────────────────
      loginPin: async (pin, identity, tenant_slug) => {
        try {
          const resp = await api.auth.loginPin(pin, identity, tenant_slug);
          const { token, user } = resp;

          setAuthToken(token);
          set({ user, token, isAuthenticated: true, isInitialized: true });

          console.log(`[AuthStore] PIN login success: ${user.full_name} (${user.role}) → tenant ${user.tenant_name}`);
          return true;
        } catch (error: any) {
          console.warn('[AuthStore] PIN login failed:', error.message);
          return false;
        }
      },

      // ── Legacy login (backward compatibility — delegates to PIN) ───────────
      login: async (pin, identity) => {
        return get().loginPin(pin, identity);
      },

      // ── Logout ─────────────────────────────────────────────────────────────
      logout: () => {
        console.log('[AuthStore] Logging out');
        clearAuthToken();
        set({ user: null, token: null, isAuthenticated: false });
      },

      setUser: (user) => {
        if (user) {
          set({ user, isAuthenticated: true, isInitialized: true });
        } else {
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      // ── Refresh user profile from server (using JWT) ──────────────────────
      refreshProfile: async () => {
        try {
          const user = await api.auth.me();
          set({ user });
        } catch {
          // If /me fails with 401, the API client already clears the token
          // and dispatches 'auth:token-expired' event
        }
      },
    }),
    {
      name: 'ekala-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ── Listen for token expiration events from the API client ─────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('auth:token-expired', () => {
    console.log('[AuthStore] Token expired — logging out');
    useAuthStore.getState().logout();
    window.location.href = '/login';
  });
}