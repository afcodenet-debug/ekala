/**
 * BOOTSTRAP SERVICE - Deterministic Application Initialization
 * 
 * Coordinates initialization phases for DataLoader technical readiness.
 * 
 * RÈGLE UNIQUE D'ACCÈS :
 * canAccessApp = isAuthenticated && subscriptionStatus === 'active'
 * 
 * bootstrap NE DOIT PLUS être utilisé pour bloquer la navigation.
 * bootstrap est utilisé UNIQUEMENT pour l'initialisation technique du DataLoader.
 * 
 * tenantAuthStatus a été SUPPRIMÉ de la phase de calcul.
 * Seuls executionSafety et subscriptionReady sont trackés.
 */

import { executionSafety } from '../lib/execution-safety';

export type BootstrapPhase = 
  | 'initializing'    // App just started
  | 'execution_ready' // ExecutionSafety is ready
  | 'subscription_loading' // SubscriptionContext is fetching
  | 'ready'           // ALL systems ready
  | 'unauthenticated'; // No user logged in (legacy, informational only)

export interface BootstrapState {
  phase: BootstrapPhase;
  executionState: string;
  subscriptionReady: boolean;
  timestamp: number;
}

class BootstrapService {
  private state: BootstrapState = {
    phase: 'initializing',
    executionState: 'blocked',
    subscriptionReady: false,
    timestamp: Date.now(),
  };

  private listeners: Set<(state: BootstrapState) => void> = new Set();
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize - listen to execution state changes
   */
  private initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('[Bootstrap] Initializing...');

    // Listen to ExecutionSafety changes
    try {
      executionSafety.subscribe((execContext) => {
        this.updateFromExecution(execContext);
      });
    } catch (error) {
      console.warn('[Bootstrap] Failed to subscribe to execution:', error);
    }

    // Initial state check
    this.checkInitialState();
  }

  /**
   * Check initial state of all systems
   */
  private checkInitialState(): void {
    const execState = executionSafety.getExecutionState();
    this.state.executionState = execState;
    this.recalculatePhase();
  }

  /**
   * Update from ExecutionSafety context
   */
  private updateFromExecution(execContext: any): void {
    this.state.executionState = execContext.state;
    this.recalculatePhase();
  }

  /**
   * Set subscription ready state (called by SubscriptionContext)
   */
  setSubscriptionReady(ready: boolean): void {
    const previous = this.state.subscriptionReady;
    this.state.subscriptionReady = ready;
    this.state.timestamp = Date.now();

    if (previous !== ready) {
      console.log(`[Bootstrap] Subscription ready: ${previous} → ${ready}`);
      this.recalculatePhase();
    }
  }

  /**
   * Recalculate current bootstrap phase
   * 
   * tenantAuthStatus SUPPRIMÉ : ne bloque plus le bootstrap
   * Bootstrap ne tracke QUE executionSafety + subscriptionReady
   */
  private recalculatePhase(): void {
    const previousPhase = this.state.phase;
    
    const execReady = this.state.executionState === 'ready';
    const subReady = this.state.subscriptionReady;

    let newPhase: BootstrapPhase;

    if (!execReady) {
      newPhase = 'execution_ready';
    } else if (!subReady) {
      newPhase = 'subscription_loading';
    } else {
      newPhase = 'ready';
    }

    if (previousPhase !== newPhase) {
      this.state.phase = newPhase;
      this.state.timestamp = Date.now();
      console.log(`[Bootstrap] Phase: ${previousPhase} → ${newPhase}`, {
        execution: this.state.executionState,
        subscription: this.state.subscriptionReady
      });
      this.notifyListeners();
    }
  }

  /**
   * Check if ALL systems are ready for data loading
   */
  isReadyForDataLoad(): boolean {
    return this.state.phase === 'ready';
  }

  /**
   * Get current bootstrap state
   */
  getState(): BootstrapState {
    return { ...this.state };
  }

  /**
   * Get current phase
   */
  getPhase(): BootstrapPhase {
    return this.state.phase;
  }

  /**
   * Subscribe to bootstrap state changes
   */
  subscribe(listener: (state: BootstrapState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.state });
      } catch (error) {
        console.error('[Bootstrap] Listener error:', error);
      }
    });
  }

  /**
   * Get debug info
   */
  getDebugInfo() {
    return {
      phase: this.state.phase,
      executionState: this.state.executionState,
      subscriptionReady: this.state.subscriptionReady,
      uptime: Date.now() - this.state.timestamp,
    };
  }
}

// ── Singleton Instance ───────────────────────────────────────────────────────

export const bootstrapService = new BootstrapService();

// ── Convenience Functions ────────────────────────────────────────────────────

export function isBootstrapReady(): boolean {
  return bootstrapService.isReadyForDataLoad();
}

export function getBootstrapPhase(): BootstrapPhase {
  return bootstrapService.getPhase();
}

export function getBootstrapState(): BootstrapState {
  return bootstrapService.getState();
}

export function subscribeToBootstrap(listener: (state: BootstrapState) => void): () => void {
  return bootstrapService.subscribe(listener);
}

export function setSubscriptionReady(ready: boolean): void {
  bootstrapService.setSubscriptionReady(ready);
}