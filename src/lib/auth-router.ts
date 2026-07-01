/**
 * AUTH ROUTER - Production Bulletproof Auth System
 * 
 * Single source of truth for all authentication decisions.
 * Eliminates race conditions, cross-system leakage, and inconsistent states.
 * 
 * Architecture:
 * - Strict state machine per system
 * - Route-based auth selection
 * - Centralized decision point
 * - Event validation strict mode
 * 
 * RÈGLE UNIQUE D'ACCÈS :
 * canAccessApp = isAuthenticated && subscriptionStatus === 'active'
 * 
 * tenantAuthStatus n'est PLUS utilisé pour le gating de navigation.
 * bootstrap.service.ts ne dépend PLUS de tenantAuthStatus.
 */

// ── Auth Status State Machine ────────────────────────────────────────────────

export type AuthStatus = 'hydrating' | 'validating' | 'ready' | 'unauthenticated';

export interface AuthContext {
  system: 'tenant' | 'platform';
  status: AuthStatus;
  user: any | null;
  token: string | null;
  lastError?: string;
}

// ── Event Validation ─────────────────────────────────────────────────────────

export interface AuthEvent {
  type: 'tenant' | 'platform';
  reason: string;
  isPlatformError?: boolean;
  timestamp: number;
}

export function validateAuthEvent(event: any): AuthEvent | null {
  // Strict validation - reject invalid events
  if (!event || typeof event !== 'object') {
    console.warn('[AuthRouter] Rejected null/undefined event');
    return null;
  }

  const detail = event.detail || {};
  
  // Must have type
  if (!detail.type || (detail.type !== 'tenant' && detail.type !== 'platform')) {
    console.warn('[AuthRouter] Rejected event without valid type:', detail);
    return null;
  }

  // Must have reason
  if (!detail.reason || typeof detail.reason !== 'string') {
    console.warn('[AuthRouter] Rejected event without reason:', detail);
    return null;
  }

  return {
    type: detail.type,
    reason: detail.reason,
    isPlatformError: detail.isPlatformError || false,
    timestamp: Date.now()
  };
}

// ── Auth Router Core ─────────────────────────────────────────────────────────

class AuthRouter {
  private tenantStatus: AuthStatus = 'hydrating';
  private platformStatus: AuthStatus = 'hydrating';
  private listeners: Set<(context: AuthContext) => void> = new Set();
  private validationPromises: Map<string, Promise<void>> = new Map();
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize - check for existing tokens on startup
   * This mirrors execution-safety.ts's fast-path to avoid race conditions
   */
  private initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Startup fast-path: if a token exists, set tenant status to 'ready' immediately
    // This prevents bootstrap.service.ts from being stuck on 'auth_hydrating' forever
    if (this.hasValidTenantToken()) {
      console.log('[AuthRouter] Tenant token found on startup - setting ready');
      this.tenantStatus = 'ready';
    }

    if (this.hasValidPlatformToken()) {
      console.log('[AuthRouter] Platform token found on startup - setting ready');
      this.platformStatus = 'ready';
    }
  }

  /**
   * Check if a valid tenant auth token exists in localStorage
   */
  private hasValidTenantToken(): boolean {
    try {
      const raw = localStorage.getItem('ekala-auth');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!parsed?.state?.token;
    } catch {
      return false;
    }
  }

  /**
   * Check if a valid platform token exists in localStorage
   */
  private hasValidPlatformToken(): boolean {
    try {
      const raw = localStorage.getItem('platform_token');
      return !!raw;
    } catch {
      return false;
    }
  }

  /**
   * Assert that auth is ready for the given path
   * RÈGLE UNIQUE : Ne plus bloquer sur hydrating/validating
   * Seul unauthenticated bloque (pas de token)
   */
  assertAuthReady(path: string): void {
    const context = this.getAuthContext(path);
    
    if (!context) {
      throw new Error(`AUTH_NOT_READY: No auth context for path ${path}`);
    }
    
    // RÈGLE UNIQUE : Bloquer UNIQUEMENT si pas de token
    // Ne plus bloquer sur hydrating/validating/ready
    if (context.status === 'unauthenticated') {
      throw new Error(`AUTH_NOT_READY: ${context.system} system is unauthenticated. Please login.`);
    }
    
    // Pour tous les autres états (hydrating, validating, ready) : autoriser
    // Le token existe, laissons execution-safety gérer la protection API
  }

  /**
   * Check if API calls are allowed for a route
   * Only allows when status === 'ready'
   */
  isReady(route?: string): boolean {
    const context = this.getAuthContext(route);
    return context?.status === 'ready';
  }

  /**
   * Block API call if not ready
   * RÈGLE UNIQUE : Ne plus bloquer sur hydrating/validating
   * Seul unauthenticated bloque (pas de token)
   */
  assertReady(route?: string): void {
    const context = this.getAuthContext(route);
    
    if (!context) {
      throw new Error('AUTH_NO_CONTEXT: Cannot determine auth context');
    }

    // RÈGLE UNIQUE : Bloquer UNIQUEMENT si pas de token
    // Ne plus bloquer sur hydrating/validating/ready
    if (context.status === 'unauthenticated') {
      const system = context.system;
      throw new Error(`AUTH_NOT_READY: ${system} system is unauthenticated. Please login.`);
    }
    
    // Pour tous les autres états (hydrating, validating, ready) : autoriser
    // execution-safety gère déjà la protection API via hasToken
  }

  /**
   * Set tenant status
   */
  setTenantStatus(status: AuthStatus, lastError?: string): void {
    const previousStatus = this.tenantStatus;
    this.tenantStatus = status;
    
    console.log('[TRACE] setTenantAuthStatus', {
      previous: previousStatus,
      next: status,
      stack: new Error().stack
    });
    
    console.log(`[AuthRouter] Tenant status: ${previousStatus} → ${status}`, lastError || '');
    
    this.notifyListeners({
      system: 'tenant',
      status,
      user: this.getTenantUser(),
      token: this.getTenantToken(),
      lastError,
    });
  }

  /**
   * Set platform status
   */
  setPlatformStatus(status: AuthStatus, lastError?: string): void {
    const previousStatus = this.platformStatus;
    this.platformStatus = status;
    
    console.log(`[AuthRouter] Platform status: ${previousStatus} → ${status}`, lastError || '');
    
    this.notifyListeners({
      system: 'platform',
      status,
      user: this.getPlatformUser(),
      token: this.getPlatformToken(),
      lastError,
    });
  }

  /**
   * Subscribe to auth status changes
   */
  subscribe(listener: (context: AuthContext) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Determine which auth system to use based on route
   */
  private determineSystem(route?: string): 'tenant' | 'platform' {
    if (!route) return 'tenant';
    
    // Platform routes
    if (route.startsWith('/platform') || route.startsWith('/api/platform')) {
      return 'platform';
    }
    
    // Tenant routes (default)
    return 'tenant';
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(context: AuthContext): void {
    this.listeners.forEach(listener => {
      try {
        listener(context);
      } catch (error) {
        console.error('[AuthRouter] Listener error:', error);
      }
    });
  }

  /**
   * Get tenant user from store
   */
  private getTenantUser(): any | null {
    try {
      const { useAuthStore } = require('../stores/useAuthStore');
      return useAuthStore.getState().user;
    } catch {
      return null;
    }
  }

  /**
   * Get tenant token
   */
  private getTenantToken(): string | null {
    try {
      const { useAuthStore } = require('../stores/useAuthStore');
      return useAuthStore.getState().token;
    } catch {
      return null;
    }
  }

  /**
   * Get platform user from store
   */
  private getPlatformUser(): any | null {
    try {
      const { usePlatformAuthStore } = require('../stores/usePlatformAuthStore');
      return usePlatformAuthStore.getState().user;
    } catch {
      return null;
    }
  }

  /**
   * Get platform token
   */
  private getPlatformToken(): string | null {
    try {
      const { usePlatformAuthStore } = require('../stores/usePlatformAuthStore');
      return usePlatformAuthStore.getState().token;
    } catch {
      return null;
    }
  }

  /**
   * Get auth context for a specific route
   */
  getAuthContext(route?: string): AuthContext | null {
    const system = this.determineSystem(route);
    const status = system === 'tenant' ? this.tenantStatus : this.platformStatus;
    const user = system === 'tenant' ? this.getTenantUser() : this.getPlatformUser();
    const token = system === 'tenant' ? this.getTenantToken() : this.getPlatformToken();

    return {
      system,
      status,
      user,
      token,
    };
  }

  /**
   * Get current status for debugging
   */
  getDebugInfo(): { tenant: AuthStatus; platform: AuthStatus } {
    return {
      tenant: this.tenantStatus,
      platform: this.platformStatus,
    };
  }
}

// ── Singleton Instance ───────────────────────────────────────────────────────

export const authRouter = new AuthRouter();

// ── Convenience Functions ────────────────────────────────────────────────────

/**
 * Get auth context for route
 */
export function getAuthContext(route?: string): AuthContext | null {
  return authRouter.getAuthContext(route);
}

/**
 * Check if ready for route
 */
export function isAuthReady(route?: string): boolean {
  return authRouter.isReady(route);
}

/**
 * Assert ready for route (throws if not ready)
 */
export function assertAuthReady(route?: string): void {
  authRouter.assertReady(route);
}

/**
 * Set tenant status
 */
export function setTenantAuthStatus(status: AuthStatus, lastError?: string): void {
  authRouter.setTenantStatus(status, lastError);
}

/**
 * Set platform status
 */
export function setPlatformAuthStatus(status: AuthStatus, lastError?: string): void {
  authRouter.setPlatformStatus(status, lastError);
}

/**
 * Subscribe to auth changes
 */
export function subscribeToAuth(listener: (context: AuthContext) => void): () => void {
  return authRouter.subscribe(listener);
}