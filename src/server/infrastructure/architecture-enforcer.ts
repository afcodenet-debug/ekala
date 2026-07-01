// =============================================================================
// Architecture Enforcer — SUB-026
// =============================================================================
// Guard runtime qui empêche toute réintroduction du legacy dans le flux
// subscription. En DEV : throw error. En PROD : log CRITICAL.
// =============================================================================

import { env } from '../config/env';

export type LegacyFlowType =
  | 'activate_tenant_sub'
  | 'legacy_reject_logic'
  | 'direct_db_mutation_subscription'
  | 'legacy_cache_invalidation'
  | 'legacy_email_subscription_trigger';

export interface LegacyFlowAttempt {
  flow: LegacyFlowType;
  route: string;
  timestamp: string;
  stackTrace?: string;
}

export class ArchitectureEnforcer {
  private attempts: LegacyFlowAttempt[] = [];
  private maxAttempts: number = 1000;

  /**
   * Vérifie qu'un appel legacy est autorisé.
   * En DEV : throw Error si legacy bypass détecté
   * En PROD : log CRITICAL
   */
  enforce(flow: LegacyFlowType, route: string, context?: Record<string, unknown>): void {
    const attempt: LegacyFlowAttempt = {
      flow,
      route,
      timestamp: new Date().toISOString(),
      stackTrace: new Error().stack,
    };

    this.attempts.push(attempt);
    if (this.attempts.length > this.maxAttempts) {
      this.attempts = this.attempts.slice(-this.maxAttempts);
    }

    const logPayload = {
      type: 'LEGACY_FLOW_ALERT',
      severity: 'CRITICAL',
      flow,
      route,
      ...context,
      timestamp: attempt.timestamp,
    };

    if (env.NODE_ENV === 'development') {
      console.error(`[ARCH-ENFORCER] ❌ BLOCKED - Legacy flow ${flow} detected at ${route}`);
      console.error(`[ARCH-ENFORCER] Context:`, JSON.stringify(context));
      throw new Error(
        `[ARCHITECTURE_ENFORCER] Legacy flow '${flow}' a été détecté à '${route}'. ` +
        `Utilisez SubscriptionApplicationService (V2.1) obligatoirement.`
      );
    } else {
      console.error(`[ARCH-ENFORCER] 🚨 CRITICAL - Legacy flow ${flow} detected at ${route}`, logPayload);
      // En PROD, on log CRITICAL mais on ne bloque pas (graceful fallback)
    }
  }

  /**
   * Vérifie qu'un objet est bien une instance de SubscriptionApplicationService
   */
  static assertValidService(service: unknown, callerRoute: string): void {
    if (!service) {
      const msg = `[ARCH-ENFORCER] SubscriptionApplicationService non disponible à ${callerRoute}`;
      if (env.NODE_ENV === 'development') {
        throw new Error(msg);
      } else {
        console.error(`[ARCH-ENFORCER] 🚨 ${msg}`);
      }
    }
  }

  /**
   * Retourne tous les tentatives legacy bloquées
   */
  getAttempts(): LegacyFlowAttempt[] {
    return [...this.attempts];
  }

  /**
   * Réinitialise le compteur
   */
  reset(): void {
    this.attempts = [];
  }
}

export const architectureEnforcer = new ArchitectureEnforcer();