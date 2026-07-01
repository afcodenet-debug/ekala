// Email Circuit Breaker - Increment 2: Fiabilisation
// Prevents SMTP spam during outages

export enum CircuitState {
  CLOSED = 'closed',       // Normal operation
  OPEN = 'open',           // Failing, reject requests
  HALF_OPEN = 'half_open', // Testing if recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;  // Failures before opening
  timeout: number;           // Time in ms before trying half-open
  monitoringPeriod: number;  // Time window for failure counting
}

export class EmailCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: Date | null = null;
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      timeout: config?.timeout ?? 30000, // 30 seconds
      monitoringPeriod: config?.monitoringPeriod ?? 60000, // 1 minute
    };
  }

  /**
   * Execute function through circuit breaker
   */
  async execute<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      // Check if timeout has elapsed
      if (this.lastFailureTime && 
          Date.now() - this.lastFailureTime.getTime() >= this.config.timeout) {
        console.log('[CircuitBreaker] ⏱️  Timeout elapsed, trying half-open state');
        this.state = CircuitState.HALF_OPEN;
      } else {
        const waitTime = this.lastFailureTime 
          ? Math.max(0, this.config.timeout - (Date.now() - this.lastFailureTime.getTime()))
          : this.config.timeout;
        
        throw new Error(
          `Circuit breaker is OPEN. SMTP is unavailable. ` +
          `Will retry in ${Math.ceil(waitTime / 1000)}s. ` +
          `Context: ${context || 'unknown'}`
        );
      }
    }

    try {
      const result = await fn();
      
      // Success - reset circuit
      if (this.state === CircuitState.HALF_OPEN) {
        console.log('[CircuitBreaker] ✅ SMTP recovered, closing circuit');
      }
      
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure - increment counter
      this.onFailure(context);
      throw error;
    }
  }

  /**
   * Handle success
   */
  private onSuccess(): void {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
    this.lastFailureTime = null;
  }

  /**
   * Handle failure
   */
  private onFailure(context?: string): void {
    this.failures++;
    this.lastFailureTime = new Date();

    console.warn(
      `[CircuitBreaker] ⚠️  Failure ${this.failures}/${this.config.failureThreshold} ` +
      `(${context || 'unknown'})`
    );

    // Open circuit if threshold reached
    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.error(
        `[CircuitBreaker] ❌ Circuit OPENED after ${this.failures} failures. ` +
        `SMTP is now blocked for ${this.config.timeout}ms. ` +
        `Context: ${context || 'unknown'}`
      );
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failures;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    console.log('[CircuitBreaker] 🔄 Circuit breaker reset');
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = null;
  }

  /**
   * Get statistics
   */
  getStats(): {
    state: CircuitState;
    failures: number;
    failureThreshold: number;
    lastFailureTime: Date | null;
    isBlocked: boolean;
  } {
    return {
      state: this.state,
      failures: this.failures,
      failureThreshold: this.config.failureThreshold,
      lastFailureTime: this.lastFailureTime,
      isBlocked: this.state === CircuitState.OPEN,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    console.log('[CircuitBreaker] ⚙️  Config updated:', this.config);
  }
}

// Singleton instance
let circuitBreakerInstance: EmailCircuitBreaker | null = null;

/**
 * Create circuit breaker instance
 */
export function createEmailCircuitBreaker(config?: Partial<CircuitBreakerConfig>): EmailCircuitBreaker {
  if (!circuitBreakerInstance) {
    circuitBreakerInstance = new EmailCircuitBreaker(config);
  }
  return circuitBreakerInstance;
}

/**
 * Get existing circuit breaker instance
 */
export function getEmailCircuitBreaker(): EmailCircuitBreaker | null {
  return circuitBreakerInstance;
}