// =============================================================================
// useBillingStatus - Hook React pour le statut d'abonnement
// =============================================================================
// Intégré avec le système V1.1 (Postgres) + fallback ancien système (Supabase)
// Stratégie: Fail-open (permet l'accès même si erreur)
// =============================================================================

import { useState, useEffect } from 'react';
import { RuntimeContext } from '../core/runtime/runtime-context';
import { request } from '../lib/api-client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BillingStatus {
  active: boolean;
  plan: string | null;
  expiresAt: string | null;
  daysUntilRenewal: number | null;
  state: 'active' | 'trial' | 'grace' | 'expired' | 'no_plan' | 'pending';
  graceDaysRemaining: number | null;
  isExpired: boolean;
  isGracePeriod: boolean;
}

export interface UseBillingStatusResult {
  status: BillingStatus | null;
  loading: boolean;
  error: string | null;
  checkStatus: () => Promise<void>;
  isActive: boolean;
  isExpired: boolean;
  isGracePeriod: boolean;
  planName: string | null;
  daysUntilRenewal: number | null;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Hook pour vérifier le statut d'abonnement dans le frontend
 * 
 * Comportement:
 * - Essaie le nouveau système V1.1 d'abord
 * - Fallback vers ancien système si erreur
 * - Fail-open: permet l'accès même si erreur
 * - Cache le résultat pour éviter les requêtes répétées
 */
export function useBillingStatus(tenantId: string | null): UseBillingStatusResult {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // LOCAL mode: billing disabled, always active
    if (RuntimeContext.getInstance().isLocal) {
      setLoading(false);
      setStatus({
        active: true,
        plan: null,
        expiresAt: null,
        daysUntilRenewal: null,
        state: 'active',
        graceDaysRemaining: null,
        isExpired: false,
        isGracePeriod: false,
      });
      return;
    }

    if (!tenantId) {
      setLoading(false);
      setStatus({
        active: true,
        plan: null,
        expiresAt: null,
        daysUntilRenewal: null,
        state: 'active',
        graceDaysRemaining: null,
        isExpired: false,
        isGracePeriod: false,
      });
      return;
    }

    checkStatus();
  }, [tenantId]);

  const checkStatus = async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);

    try {
      // Token JWT is attached automatically by the shared `request` helper
      // (it reads ekala-auth from localStorage). The helper also handles
      // non-JSON responses gracefully (no raw JSON.parse SyntaxError), which
      // previously surfaced as "Failed to check billing status".

      // Essayer le nouveau système V1.1
      // Le backend renvoie { subscription_status, tenant_status, is_grace_period, plan_name, expires_at, ... }
      // (et non pas les champs `active`/`isExpired` attendus historiquement).
      const data = await request<{
        subscription_status?: string;
        tenant_status?: string;
        is_grace_period?: boolean;
        plan_name?: string | null;
        plan_code?: string | null;
        expires_at?: string | null;
        grace_days_remaining?: number | null;
      }>(`/v1/subscription/status/${tenantId}`);

      const subStatus = data.subscription_status || (data.tenant_status === 'active' ? 'active' : 'no_plan');
      // Une souscription active/trial/grace donne accès (grace = lecture seule mais accès).
      const active = subStatus === 'active' || subStatus === 'trial' || !!data.is_grace_period;

        setStatus({
          active,
          plan: data.plan_name || data.plan_code || null,
          expiresAt: data.expires_at ?? null,
          daysUntilRenewal: data.grace_days_remaining ?? null,
          state: (subStatus as any) || 'no_plan',
          graceDaysRemaining: data.grace_days_remaining ?? null,
          isExpired: subStatus === 'expired',
          isGracePeriod: !!data.is_grace_period,
        });
    } catch (err) {
      console.error('Failed to check billing status:', err);
      setError('Failed to check subscription status');
      
      // Fail-open: permettre l'accès même si erreur
      setStatus({
        active: true,
        plan: null,
        expiresAt: null,
        daysUntilRenewal: null,
        state: 'active',
        graceDaysRemaining: null,
        isExpired: false,
        isGracePeriod: false,
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    status,
    loading,
    error,
    checkStatus,
    isActive: status?.active ?? true,
    isExpired: status?.isExpired ?? false,
    isGracePeriod: status?.isGracePeriod ?? false,
    planName: status?.plan ?? null,
    daysUntilRenewal: status?.daysUntilRenewal ?? null,
  };
}

// ── Export par défaut ──────────────────────────────────────────────────────────

export default useBillingStatus;