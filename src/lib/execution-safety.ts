/**
 * EXECUTION SAFETY LAYER - Global API Call Protection
 * 
 * Prevents ALL API calls during auth transitions:
 * - hydrating → blocked
 * - validating → blocked  
 * - ready → allowed
 * - unauthenticated → blocked
 * 
 * Single source of truth for execution safety across the entire app.
 */

// ── Execution State ──────────────────────────────────────────────────────────

export type ExecutionState = 'blocked' | 'validating' | 'ready' | 'offline';

interface ExecutionContext {
  state: ExecutionState;
  lastStateChange: number;
  blockedCalls: number;
}

// ── Singleton Instance ───────────────────────────────────────────────────────

class ExecutionSafetyLayer {
  private context: ExecutionContext = {
    state: 'blocked',
    lastStateChange: Date.now(),
    blockedCalls: 0,
  };

  private listeners: Set<(context: ExecutionContext) => void> = new Set();
  private isInitialized = false;
  private hasSetupAuthListener = false;

  constructor() {
    this.initialize();
  }

  /**
   * Check if a valid auth token exists in localStorage
   */
  private hasValidToken(): boolean {
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
   * Initialize - listen to auth router state changes
   */
  private initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // ── Startup fast-path: if a token exists, go directly to ready ──────
    // This avoids a race condition where Zustand's persist middleware has
    // rehydrated isAuthenticated=true but execution-safety's async import
    // of auth-router hasn't completed yet.
    if (this.hasValidToken()) {
      console.log('[ExecutionSafety] Token found on startup - setting ready');
      this.context.state = 'ready';
      this.context.lastStateChange = Date.now();
    }

    // Dynamic import to avoid circular dependency
    this.setupAuthListener();
  }

  /**
   * Setup listener for auth state changes
   */
  private async setupAuthListener(): Promise<void> {
    if (this.hasSetupAuthListener) return;
    this.hasSetupAuthListener = true;
    
    try {
      const { subscribeToAuth } = await import('./auth-router');
      
      subscribeToAuth((authContext) => {
        this.updateStateFromAuth(authContext);
      });

      // Initial state check
      const { getAuthContext } = await import('./auth-router');
      const tenantContext = getAuthContext('/');
      const platformContext = getAuthContext('/platform');
      
      if (tenantContext) this.updateStateFromAuth(tenantContext);
      if (platformContext) this.updateStateFromAuth(platformContext);
    } catch (error) {
      console.error('[ExecutionSafety] Failed to setup auth listener:', error);
    }
  }

  /**
   * Update execution state based on auth context
   * RÈGLE UNIQUE : API_ACCESS = hasToken
   * SUPPRIMÉ : tenantAuthStatus comme condition de blocage
   */
  private updateStateFromAuth(authContext: any): void {
    // RÈGLE UNIQUE : Accès API autorisé si token existe
    // Ne plus dépendre de tenantStatus/platformStatus/ready/hydrating/etc.
    const hasToken = this.hasValidToken();
    const newState: ExecutionState = hasToken ? 'ready' : 'blocked';

    const previousState = this.context.state;
    this.context.state = newState;
    this.context.lastStateChange = Date.now();

    if (previousState !== newState) {
      console.log(`[ExecutionSafety] State changed: ${previousState} → ${newState} (hasToken: ${hasToken})`);
      this.notifyListeners();
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.context });
      } catch (error) {
        console.error('[ExecutionSafety] Listener error:', error);
      }
    });
  }

  /**
   * Get current execution state
   */
  getExecutionState(): ExecutionState {
    return this.context.state;
  }

  /**
   * Get full context
   */
  getContext(): ExecutionContext {
    return { ...this.context };
  }

  /**
   * Check if execution is allowed
   */
  isExecutionAllowed(): boolean {
    return this.context.state === 'ready';
  }

  /**
   * Ensure execution is allowed (throws if not)
   */
  ensureExecutionAllowed(context?: string): void {
    if (!this.isExecutionAllowed()) {
      this.context.blockedCalls++;
      const error = `EXECUTION_BLOCKED: ${context || 'unknown'} (state: ${this.context.state})`;
      console.warn(`[ExecutionSafety] ${error}`);
      throw new Error(error);
    }
  }

  /**
   * Wrap async function with execution guard and smart queue
   * If execution is blocked, enqueue the request for later execution
   */
  async withExecutionGuard<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    if (this.isExecutionAllowed()) {
      return await fn();
    }

    // Execution blocked - enqueue request
    console.log(`[ExecutionSafety] Execution blocked, enqueuing: ${context}`);
    
    // Dynamic import to avoid circular dependency
    const { enqueueRequest } = await import('./request-queue');
    return await enqueueRequest(context || 'unknown', fn);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (context: ExecutionContext) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get debug info
   */
  getDebugInfo() {
    return {
      state: this.context.state,
      blockedCalls: this.context.blockedCalls,
      uptime: Date.now() - this.context.lastStateChange,
    };
  }
}

// ── Singleton Instance ───────────────────────────────────────────────────────

export const executionSafety = new ExecutionSafetyLayer();

// ── Convenience Functions ────────────────────────────────────────────────────

/**
 * Get current execution state
 */
export function getExecutionState(): ExecutionState {
  return executionSafety.getExecutionState();
}

/**
 * Check if execution is allowed
 */
export function isExecutionAllowed(): boolean {
  return executionSafety.isExecutionAllowed();
}

/**
 * Ensure execution is allowed (throws if not)
 */
export function ensureExecutionAllowed(context?: string): void {
  executionSafety.ensureExecutionAllowed(context);
}

/**
 * Wrap async function with execution guard
 */
export function withExecutionGuard<T>(fn: () => Promise<T>, context?: string): Promise<T> {
  return executionSafety.withExecutionGuard(fn, context);
}

/**
 * Subscribe to execution state changes
 */
export function subscribeToExecution(listener: (context: ExecutionContext) => void): () => void {
  return executionSafety.subscribe(listener);
}