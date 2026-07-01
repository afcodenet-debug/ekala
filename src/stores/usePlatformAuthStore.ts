import { create } from 'zustand';
import { setPlatformToken, clearPlatformToken } from '../lib/api-client';
import { AuthStatus, setPlatformAuthStatus } from '../lib/auth-router';

export interface PlatformUser {
  id: number;
  email: string;
  full_name: string;
  role: 'super_admin' | 'platform_admin';
  permissions: string[];
}

interface PlatformAuthStore {
  user: PlatformUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  status: AuthStatus;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: PlatformUser | null) => void;
  validateToken: () => Promise<boolean>;
  setStatus: (status: AuthStatus) => void;
  initialize: () => void;
}

// Helper to get token from localStorage
function getStoredToken(): string | null {
  try {
    return localStorage.getItem('platform_token');
  } catch {
    return null;
  }
}

export const usePlatformAuthStore = create<PlatformAuthStore>((set, get) => ({
  user: null,
  token: getStoredToken(), // Restore token from localStorage
  isAuthenticated: false, // Will be set to true after token validation
  isInitialized: false,
  status: 'hydrating' as AuthStatus,

  initialize: () => {
    const token = getStoredToken();
    console.log('[PlatformAuth] Initializing, token found:', !!token);
    
    if (token) {
      set({ 
        token,
        status: 'ready',
        isAuthenticated: true,
        isInitialized: true
      });
      setPlatformAuthStatus('ready');
      console.log('[PlatformAuth] Token restored from localStorage');
    } else {
      set({
        token: null,
        isAuthenticated: false,
        isInitialized: true,
        status: 'unauthenticated'
      });
      setPlatformAuthStatus('unauthenticated');
      console.log('[PlatformAuth] No token found');
    }
  },

  login: async (email, password) => {
    try {
      const resp = await fetch('/api/platform/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!resp.ok) {
        const error = await resp.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(error.message || 'Login failed');
      }

      const data = await resp.json();
      const { token, user } = data;

      setPlatformToken(token);
      set({ user, token, isAuthenticated: true, isInitialized: true, status: 'ready' });
      setPlatformAuthStatus('ready');
      console.log(`[PlatformAuth] Login success: ${user.full_name} (${user.role})`);
      return true;
    } catch (error: any) {
      console.warn('[PlatformAuth] Login failed:', error.message);
      return false;
    }
  },

  logout: () => {
    console.log('[PlatformAuth] Logging out');
    clearPlatformToken();
    set({ user: null, token: null, isAuthenticated: false, status: 'unauthenticated' });
    setPlatformAuthStatus('unauthenticated');
  },

  setUser: (user) => {
    if (user) {
      const newStatus: AuthStatus = 'ready';
      set({ user, isAuthenticated: true, isInitialized: true, status: newStatus });
      setPlatformAuthStatus(newStatus);
    } else {
      const newStatus: AuthStatus = 'unauthenticated';
      set({ user: null, token: null, isAuthenticated: false, status: newStatus });
      setPlatformAuthStatus(newStatus);
    }
  },

  validateToken: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ status: 'unauthenticated', isAuthenticated: false, isInitialized: true });
      setPlatformAuthStatus('unauthenticated');
      return false;
    }

    set({ status: 'validating' });
    setPlatformAuthStatus('validating');
    try {
      const resp = await fetch('/api/platform/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!resp.ok) {
        throw new Error('Token validation failed');
      }

      const data = await resp.json();
      const { user } = data;

      set({ user, isAuthenticated: true, status: 'ready', isInitialized: true });
      setPlatformAuthStatus('ready');
      return true;
    } catch (error: any) {
      console.warn('[PlatformAuth] Token validation failed:', error.message);
      clearPlatformToken();
      set({ user: null, token: null, isAuthenticated: false, status: 'unauthenticated', isInitialized: true });
      setPlatformAuthStatus('unauthenticated');
      return false;
    }
  },

  setStatus: (status: AuthStatus) => {
    console.log('[PlatformAuth] Status changed:', status);
    set({ status });
    setPlatformAuthStatus(status);
  },
}));

// Listen for platform token expiration
// IMPORTANT: ONLY react to events explicitly marked as platform errors
if (typeof window !== 'undefined') {
  window.addEventListener('auth:token-expired', (event: any) => {
    const detail = event?.detail;
    
    if (!detail || !detail.isPlatformError) {
      console.log('[PlatformAuth] Ignored non-platform token expired event');
      return;
    }

    console.log('[PlatformAuth] Platform token expired, redirecting to login');
    usePlatformAuthStore.getState().logout();
    window.location.href = '/platform/login';
  });
}

// Auto-initialize on load
if (typeof window !== 'undefined') {
  // Use setTimeout to ensure the store is created first
  setTimeout(() => {
    usePlatformAuthStore.getState().initialize();
  }, 0);
}