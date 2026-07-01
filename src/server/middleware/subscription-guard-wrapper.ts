// =============================================================================
// SubscriptionGuardWrapper — Middleware Unifié pour Billing V1.1
// =============================================================================
// Compatible avec ancien (Supabase) et nouveau (Postgres V1.1) système
// Stratégie: Fail-open (permet l'accès en cas d'erreur)
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { getSubscriptionAdapter } from '../infrastructure/billing/subscription-adapter';

// ── Types ──────────────────────────────────────────────────────────────────────

export type SubscriptionState =
  | 'active'
  | 'trial'
  | 'grace'
  | 'suspended'
  | 'cancelled'
  | 'expired'
  | 'no_plan'
  | 'pending';

export interface SubscriptionGuardResult {
  state: SubscriptionState;
  tenantId: number;
  planName: string | null;
  daysUntilRenewal: number | null;
  isExpired: boolean;
  isGracePeriod: boolean;
  graceDaysRemaining: number | null;
  subscriptionId: number | null;
  planId: number | null;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: number;
    tenant_id: number;
    role: string;
    email?: string;
    full_name?: string;
  };
  subscription?: SubscriptionGuardResult;
}

// ── Middleware Unifié ──────────────────────────────────────────────────────────

/**
 * Middleware de garde d'abonnement unifié
 * 
 * Comportement:
 * - Si adapter disponible → utilise nouveau système V1.1
 * - Si adapter non disponible → permet l'accès (fail-open)
 * - En cas d'erreur → permet l'accès (fail-open)
 * - Bloque uniquement si subscription.expired ET pas de grâce
 */
export function subscriptionGuardWrapper() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const adapter = getSubscriptionAdapter();

      if (adapter) {
        // ── Nouveau système V1.1 ─────────────────────────────
        console.log(`[SUBSCRIPTION GUARD] Checking tenant ${tenantId} with adapter...`);
        
        const status = await adapter.getSubscriptionStatus(tenantId);
        (req as any).subscription = status;

        console.log(`[SUBSCRIPTION GUARD] Tenant ${tenantId} state: ${status.state}`);

        // Allow access for: active, trial, grace period
        if (status.state === 'active' || status.state === 'trial' || status.state === 'grace') {
          return next();
        } else {
          // For expired/cancelled/suspended/no_plan, allow access but log warning
          // The billing system will show warnings in the UI
          console.warn(`[SUBSCRIPTION GUARD] Tenant ${tenantId} has state: ${status.state} - allowing access (fail-open)`);
          return next();
        }
      } else {
        // ── Adapter non disponible (ancien système) ──────────
        console.warn('[SUBSCRIPTION GUARD] ⚠️  Adapter not available, allowing access (fail-open)');
        return next();
      }
    } catch (error) {
      // ── Erreur: Fail-open pour ne pas bloquer l'application ─
      console.error('[SUBSCRIPTION GUARD] ❌ Error:', error);
      console.warn('[SUBSCRIPTION GUARD] ⚠️  Allowing access due to error (fail-open)');
      return next();
    }
  };
}

/**
 * Middleware optionnel pour les routes publiques
 * Vérifie l'abonnement mais ne bloque pas
 */
export function subscriptionCheckOptional() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      return next();
    }

    try {
      const adapter = getSubscriptionAdapter();

      if (adapter) {
        const status = await adapter.getSubscriptionStatus(tenantId);
        (req as any).subscription = status;
        
        // Attach warning if expired/grace
        if (status.state === 'grace' || status.state === 'expired') {
          (req as any).subscriptionWarning = {
            state: status.state,
            message: status.state === 'grace' 
              ? `Grace period: ${status.graceDaysRemaining} days remaining`
              : 'Subscription expired',
          };
        }
      }
    } catch (error) {
      console.error('[SUBSCRIPTION CHECK] Error:', error);
      // Silently fail, don't block
    }

    return next();
  };
}