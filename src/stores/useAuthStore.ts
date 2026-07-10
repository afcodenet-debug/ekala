import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setAuthToken, clearAuthToken, getToken, getTokenClaims } from '../lib/api-client';
import { trace } from '../lib/runtime-tracer';
import { RuntimeContext } from '../core/runtime/runtime-context';

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
  loginTimestamp: number | null;

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
      loginTimestamp: null,

      checkServer: async () => {
        // LOCAL mode: no network call, always healthy
        if (RuntimeContext.getInstance().isLocal) {
          set({ isServerHealthy: true });
          return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        try {
          const response = await fetch('/api/auth/status', { signal: controller.signal });
          set({ isServerHealthy: response.ok });
        } catch {
          set({ isServerHealthy: false });
        } finally {
          clearTimeout(timeout);
        }
      },

      // ── Admin/Owner login (email + password → JWT) ─────────────────────────
      loginEmail: async (email, password) => {
        try {
          const resp = await api.auth.loginEmail(email, password);
          const { token, user } = resp;

          setAuthToken(token);
          set({ user, token, isAuthenticated: true, isInitialized: true, loginTimestamp: Date.now() });
          
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
          console.log('[FORENSIC] useAuthStore.loginPin - Appel API:', {
            pin_length: pin?.length,
            identity: identity || '(non fourni)',
            tenant_slug: tenant_slug || '(non fourni)',
            timestamp: new Date().toISOString(),
          });
          const resp = await api.auth.loginPin(pin, identity, tenant_slug);
          console.log('[FORENSIC] useAuthStore.loginPin - Réponse API brute:', {
            hasToken: !!resp?.token,
            token_prefix: resp?.token ? resp.token.substring(0, 20) + '...' : null,
            user: resp?.user ? {
              id: resp.user.id,
              full_name: resp.user.full_name,
              role: resp.user.role,
              tenant_id: resp.user.tenant_id,
              tenant_name: resp.user.tenant_name,
              tenant_slug: resp.user.tenant_slug,
            } : null,
            timestamp: new Date().toISOString(),
          });
          const { token, user } = resp;

          setAuthToken(token);
          set({ user, token, isAuthenticated: true, isInitialized: true, loginTimestamp: Date.now() });

          trace.setUser('loginPin', user);
          console.log(`[FORENSIC] useAuthStore.loginPin - SUCCÈS: user.tenant_name = "${user?.tenant_name}"`);
          console.log(`[FORENSIC] useAuthStore.loginPin - Le frontend affichera: "${user?.tenant_name || '(fallback vers APP_NAME)'}"`);
          return true;
        } catch (error: any) {
          console.warn('[FORENSIC] useAuthStore.loginPin - ÉCHEC:', {
            message: error.message,
            status: error.status,
            responseBody: error.responseBody,
            timestamp: new Date().toISOString(),
          });
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
        set({ user: null, token: null, isAuthenticated: false, loginTimestamp: null });
      },

      setUser: (user) => {
        trace.setUser('setUser', user);
        if (user) {
          // Re-read token from storage so the persisted state (partialize includes
          // `token`) keeps it instead of overwriting it with null on persist.
          const token = getToken();
          // Fallback: derive tenant identity from the JWT claims if the user
          // object is missing it (e.g. some login paths). The token always
          // carries the resolved tenant_name/tenant_slug.
          const claims = getTokenClaims();
          set({
            user: {
              ...user,
              tenant_name: user.tenant_name ?? claims?.tenant_name ?? undefined,
              tenant_slug: user.tenant_slug ?? claims?.tenant_slug ?? undefined,
            },
            token,
            isAuthenticated: true,
            isInitialized: true,
          });
        } else {
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      // ── Refresh user profile from server (using JWT) ──────────────────────
      refreshProfile: async () => {
        trace.refreshProfile('start');
        try {
          const user = await api.auth.me();
          trace.refreshProfile('response', user);
          const claims = getTokenClaims();
          set({
            user: {
              ...user,
              tenant_name: user.tenant_name ?? claims?.tenant_name ?? undefined,
              tenant_slug: user.tenant_slug ?? claims?.tenant_slug ?? undefined,
            },
          });
        } catch {
          trace.refreshProfile('error');
          // If /me fails with 401, the API client already clears the token
          // and dispatches 'auth:token-expired' event
        }
      },
    }),
    {
      name: 'ekala-auth',
      partialize: (state) => {
        trace.persistSave(state);
        return {
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
          loginTimestamp: state.loginTimestamp,
        };
      },
      onRehydrateStorage: () => (state) => {
        trace.persistHydrate(state);
      },
    }
  )
);

// ── Listen for token expiration events from the API client ─────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('auth:token-expired', () => {
    console.log('[AuthStore] Token expired — logging out');
    useAuthStore.getState().logout();
    
    // Show reconnect modal instead of immediate redirect
    // This allows for a graceful UX with the modal
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('auth:show-reconnect-modal'));
    }, 100);
  });
}
