// =============================================================================
// Circuit Breaker Service - Fallback Strategy pour résilience
// Architecture RBAC Production-Hardened - IAM Grade
// =============================================================================
//
// ⚠️  RÈGLES:
// - Gérer les pannes (Redis down, DB lag, cache corrupted)
// - Stratégies: fail-safe deny, fail-open (optionnel), degraded mode
// - Circuit breaker pattern pour protéger les dépendances
// =============================================================================

export enum CircuitState {
  CLOSED = 'CLOSED',      // Normal - tout fonctionne
  OPEN = 'OPEN',          // Défaut - service en panne
  HALF_OPEN = 'HALF_OPEN' // Test - tentative de récupération
}

export enum ServiceType {
  REDIS = 'redis',
  DATABASE = 'database',
  CACHE = 'cache'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Nombre d'échecs avant OPEN
  resetTimeout: number;          // Temps avant tentative HALF_OPEN (ms)
  halfOpenMaxCalls: number;      // Nombre de calls en HALF_OPEN
  monitoringPeriod: number;      // Période de monitoring (ms)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  nextAttempt: number | null;
}

export class CircuitBreakerService {
  private breakers: Map<ServiceType, {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number | null;
    nextAttempt: number | null;
    halfOpenCalls: number;
    config: CircuitBreakerConfig;
  }> = new Map();

  private defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,           // 5 échecs → OPEN
    resetTimeout: 30000,           // 30s avant HALF_OPEN
    halfOpenMaxCalls: 3,           // 3 calls en test
    monitoringPeriod: 60000        // 1 minute
  };

  constructor() {
    // Initialiser les circuit breakers pour chaque service
    this.initializeBreakers();
  }

  /**
   * Initialiser les circuit breakers
   */
  private initializeBreakers(): void {
    const services = [ServiceType.REDIS, ServiceType.DATABASE, ServiceType.CACHE];

    for (const service of services) {
      this.breakers.set(service, {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastFailureTime: null,
        nextAttempt: null,
        halfOpenCalls: 0,
        config: this.defaultConfig
      });
    }
  }

  /**
   * Exécuter une fonction avec circuit breaker
   * @param service - Type de service
   * @param fn - Fonction à exécuter
   * @param fallback - Fallback si circuit OPEN
   */
  async execute<T>(
    service: ServiceType,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const breaker = this.breakers.get(service);
    if (!breaker) {
      return await fn();
    }

    // Vérifier l'état du circuit
    if (breaker.state === CircuitState.OPEN) {
      // Vérifier si on peut passer en HALF_OPEN
      if (this.canAttemptReset(breaker)) {
        breaker.state = CircuitState.HALF_OPEN;
        breaker.halfOpenCalls = 0;
        console.log(`[CircuitBreaker] ${service} → HALF_OPEN (attempting reset)`);
      } else {
        // Circuit OPEN - utiliser fallback ou throw
        console.warn(`[CircuitBreaker] ${service} is OPEN - using fallback`);
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Service ${service} is unavailable (circuit OPEN)`);
      }
    }

    // Exécuter la fonction
    try {
      const result = await fn();
      this.onSuccess(breaker);
      return result;
    } catch (error) {
      this.onFailure(breaker);
      
      // Si HALF_OPEN et échec, retourner à OPEN
      if (breaker.state === CircuitState.HALF_OPEN) {
        breaker.state = CircuitState.OPEN;
        breaker.lastFailureTime = Date.now();
        breaker.nextAttempt = Date.now() + breaker.config.resetTimeout;
        console.error(`[CircuitBreaker] ${service} → OPEN (half-open test failed)`);
      }

      // Utiliser fallback si disponible
      if (fallback) {
        console.warn(`[CircuitBreaker] ${service} failed - using fallback`);
        return await fallback();
      }

      throw error;
    }
  }

  /**
   * Vérifier si on peut tenter un reset
   */
  private canAttemptReset(breaker: any): boolean {
    if (!breaker.nextAttempt) return true;
    return Date.now() >= breaker.nextAttempt;
  }

  /**
   * Gérer un succès
   */
  private onSuccess(breaker: any): void {
    breaker.successes++;
    breaker.failures = 0;

    if (breaker.state === CircuitState.HALF_OPEN) {
      breaker.halfOpenCalls++;
      
      // Si assez de succès en HALF_OPEN, fermer le circuit
      if (breaker.halfOpenCalls >= breaker.config.halfOpenMaxCalls) {
        breaker.state = CircuitState.CLOSED;
        breaker.halfOpenCalls = 0;
        breaker.nextAttempt = null;
        console.log(`[CircuitBreaker] ${breaker} → CLOSED (recovered)`);
      }
    }
  }

  /**
   * Gérer un échec
   */
  private onFailure(breaker: any): void {
    breaker.failures++;

    if (breaker.state === CircuitState.CLOSED) {
      // Vérifier si on doit ouvrir le circuit
      if (breaker.failures >= breaker.config.failureThreshold) {
        breaker.state = CircuitState.OPEN;
        breaker.lastFailureTime = Date.now();
        breaker.nextAttempt = Date.now() + breaker.config.resetTimeout;
        console.error(`[CircuitBreaker] ${breaker} → OPEN (${breaker.failures} failures)`);
      }
    }
  }

  /**
   * Obtenir les statistiques d'un service
   */
  getStats(service: ServiceType): CircuitBreakerStats | null {
    const breaker = this.breakers.get(service);
    if (!breaker) return null;

    return {
      state: breaker.state,
      failures: breaker.failures,
      successes: breaker.successes,
      lastFailureTime: breaker.lastFailureTime,
      nextAttempt: breaker.nextAttempt
    };
  }

  /**
   * Obtenir les statistiques de tous les services
   */
  getAllStats(): Map<ServiceType, CircuitBreakerStats> {
    const stats = new Map<ServiceType, CircuitBreakerStats>();
    
    for (const [service, breaker] of this.breakers.entries()) {
      stats.set(service, {
        state: breaker.state,
        failures: breaker.failures,
        successes: breaker.successes,
        lastFailureTime: breaker.lastFailureTime,
        nextAttempt: breaker.nextAttempt
      });
    }

    return stats;
  }

  /**
   * Réinitialiser un circuit breaker (pour tests ou admin)
   */
  reset(service: ServiceType): void {
    const breaker = this.breakers.get(service);
    if (breaker) {
      breaker.state = CircuitState.CLOSED;
      breaker.failures = 0;
      breaker.successes = 0;
      breaker.lastFailureTime = null;
      breaker.nextAttempt = null;
      breaker.halfOpenCalls = 0;
      console.log(`[CircuitBreaker] ${service} reset to CLOSED`);
    }
  }

  /**
   * Réinitialiser tous les circuit breakers
   */
  resetAll(): void {
    for (const service of this.breakers.keys()) {
      this.reset(service);
    }
  }

  /**
   * Vérifier si un service est disponible
   */
  isAvailable(service: ServiceType): boolean {
    const breaker = this.breakers.get(service);
    if (!breaker) return true;
    return breaker.state !== CircuitState.OPEN;
  }

  /**
   * Configurer un circuit breaker
   */
  configure(service: ServiceType, config: Partial<CircuitBreakerConfig>): void {
    const breaker = this.breakers.get(service);
    if (breaker) {
      breaker.config = { ...breaker.config, ...config };
      console.log(`[CircuitBreaker] ${service} configured:`, breaker.config);
    }
  }
}

// Export singleton instance
export const circuitBreaker = new CircuitBreakerService();