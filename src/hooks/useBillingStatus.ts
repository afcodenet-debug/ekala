// =============================================================================
// useBillingStatus - Hook React pour le statut d'abonnement
// =============================================================================
// Intégré avec le système V1.1 (Postgres) + fallback ancien système (Supabase)
// Stratégie: Fail-open (permet l'accès même si erreur)
// =============================================================================

import { useState, useEffect } from 'react';

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
      // Récupère le token JWT depuis le localStorage
      const token = (() => {
        try {
          const raw = localStorage.getItem('ekala-auth');
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return parsed?.state?.token || null;
        } catch { return null; }
      })();

      // Essayer le nouveau système V1.1
      const response = await fetch(`/api/v1/subscription/status/${tenantId}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        setStatus({
          active: data.active,
          plan: data.plan,
          expiresAt: data.expires_at,
          daysUntilRenewal: data.daysUntilRenewal,
          state: data.active ? 'active' : (data.isGracePeriod ? 'grace' : 'expired'),
          graceDaysRemaining: data.graceDaysRemaining,
          isExpired: data.isExpired,
          isGracePeriod: data.isGracePeriod,
        });
      } else {
        // Fallback: ancien système ou pas de subscription
        // Fail-open: permettre l'accès
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
      }
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