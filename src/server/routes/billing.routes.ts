// =============================================================================
// Phase 2 — Billing Routes (Voucher-First)
// =============================================================================

import { Router } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { getSubscriptionStatus } from '../middleware/subscription-guard';
import { requireJwtAuth } from '../middleware/jwt-auth';

function getSupabase(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });
}

const router = Router();

// GET /api/billing/status — statut d'abonnement du tenant connecté
router.get('/status', requireJwtAuth, async (req: any, res: any) => {
  try {
    const tenantId = Number(req.user?.tenant_id);
    if (!tenantId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase non configuré.' });
    }

    const [{ data: tenant }, { data: subscription }] = await Promise.all([
      supabase.from('tenants').select('status, name, is_provisioned').eq('id', tenantId).maybeSingle(),
      supabase
        .from('subscriptions')
        .select('status, current_period_end, trial_ends_at, plan_id, started_at, last_voucher_code')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const tenantStatus = tenant?.status || 'unknown';
    const subState = await getSubscriptionStatus(tenantId);

    let expiresAt: string | null = null;
    if (subscription) {
      expiresAt = subscription.current_period_end || subscription.trial_ends_at || null;
    }

    const blockedStates = ['pending', 'expired', 'suspended', 'cancelled', 'no_plan', 'past_due'];
    const effectiveState = tenantStatus === 'pending' ? 'pending' : subState.state;
    const canActivateVoucher = blockedStates.includes(effectiveState);

    res.json({
      tenant_status: tenantStatus,
      subscription_status: subState.state,
      plan_code: subState.planName,
      plan_id: subscription?.plan_id || null,
      expires_at: expiresAt,
      grace_days_remaining: subState.isGracePeriod ? subState.graceDaysRemaining : 0,
      is_grace_period: subState.isGracePeriod,
      can_activate_voucher: canActivateVoucher,
      subscription_id: subState.subscriptionId,
      started_at: subscription?.started_at || null,
      last_voucher_code: subscription?.last_voucher_code || null,
    });
  } catch (e: any) {
    console.error('[Billing] status error:', e);
    res.status(500).json({ error: 'BILLING_STATUS_FAILED', message: e.message });
  }
});

export default router;
