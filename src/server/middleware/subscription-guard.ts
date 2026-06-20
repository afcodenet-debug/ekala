// =============================================================================
// Subscription Guard Middleware — Multi-Tenant SaaS
// =============================================================================
// Intercepts protected API requests and verifies that the tenant has an
// active subscription. Implements a tiered access model:
//
//   active / trial  → full access
//   grace           → read-only access (7-day grace period after expiry)
//   suspended / cancelled / expired / no_plan → no access (403)
//
// Place AFTER requireJwtAuth and BEFORE requireTenantScope.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

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

// ── Configuration ──────────────────────────────────────────────────────────────

const GRACE_PERIOD_DAYS = 7;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const MAX_CACHE_SIZE = 1000;

// ── In-memory per-tenant cache ─────────────────────────────────────────────────

interface CacheEntry {
  result: SubscriptionGuardResult;
  expiresAt: number;
}

const subscriptionCache = new Map<number, CacheEntry>();

function getCached(tenantId: number): SubscriptionGuardResult | null {
  const e = subscriptionCache.get(tenantId);
  if (!e || Date.now() > e.expiresAt) { subscriptionCache.delete(tenantId); return null; }
  return e.result;
}

function setCache(tenantId: number, result: SubscriptionGuardResult): void {
  if (subscriptionCache.size >= MAX_CACHE_SIZE) {
    const oldest = subscriptionCache.keys().next().value;
    if (oldest !== undefined) subscriptionCache.delete(oldest);
  }
  subscriptionCache.set(tenantId, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Supabase helper ────────────────────────────────────────────────────────────

function getSupabase(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'public' },
  });
}

// ── Core: resolve subscription state ───────────────────────────────────────────

async function checkSubscriptionStatus(tenantId: number): Promise<SubscriptionGuardResult> {
  const supabase = getSupabase();
  const fallback: SubscriptionGuardResult = {
    state: 'active', tenantId, planName: null, daysUntilRenewal: null,
    isExpired: false, isGracePeriod: false, graceDaysRemaining: null,
    subscriptionId: null, planId: null,
  };

  if (!supabase) return fallback; // local dev → allow all

  try {
    const { data: sub, error } = await supabase
      .from('subscriptions')
      .select('id, status, plan_id, current_period_end, trial_ends_at, cancelled_at, plans!inner(name, code)')
      .eq('tenant_id', String(tenantId))
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) { console.error('[SubGuard] Query error:', error.message); return fallback; }

    if (!sub) {
      // Fallback to tenants table
      const { data: tenant } = await supabase
        .from('tenants')
        .select('status, created_at')
        .eq('id', tenantId)
        .maybeSingle();
      
      if (tenant?.status === 'trial') {
        const created = new Date(tenant.created_at).getTime();
        const trialEnd = created + 7 * 86400000;
        const now = Date.now();
        const isExpired = now > trialEnd;
        return {
          ...fallback,
          state: isExpired ? 'expired' : 'trial',
          planName: 'Essai Gratuit',
          daysUntilRenewal: Math.ceil((trialEnd - now) / 86400000),
          isExpired
        };
      }
      return { ...fallback, state: 'no_plan' };
    }

    const plans = (sub as any)?.plans;
    const plan = Array.isArray(plans) ? plans[0] : plans;
    const planName = plan?.name || plan?.code || null;
    const now = Date.now();
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
    const trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : null;
    const endDate = trialEnd || periodEnd;
    const daysUntilRenewal = endDate ? Math.ceil((endDate - now) / 86_400_000) : null;
    const isExpired = endDate ? endDate < now : false;

    let state: SubscriptionState;

    if (sub.status === 'cancelled') {
      state = 'cancelled';
    } else if (isExpired && (sub.status === 'trial' || (sub.status === 'active' && trialEnd && !periodEnd))) {
      state = 'expired';
    } else if (isExpired && periodEnd) {
      const graceEnd = periodEnd + GRACE_PERIOD_DAYS * 86_400_000;
      state = now < graceEnd ? 'grace' : 'suspended';
    } else if (sub.status === 'past_due') {
      state = 'grace';
    } else if (sub.status === 'active' || sub.status === 'trial') {
      state = isExpired ? 'suspended' : sub.status;
    } else {
      state = 'no_plan';
    }

    let graceDaysRemaining: number | null = null;
    if (state === 'grace' && periodEnd) {
      const graceEnd = periodEnd + GRACE_PERIOD_DAYS * 86_400_000;
      graceDaysRemaining = Math.max(0, Math.ceil((graceEnd - now) / 86_400_000));
    }

    return {
      state, tenantId, planName, daysUntilRenewal, isExpired,
      isGracePeriod: state === 'grace', graceDaysRemaining,
      subscriptionId: sub.id, planId: sub.plan_id,
    };
  } catch (err: any) {
    console.error('[SubGuard] Unexpected:', err.message);
    return fallback; // fail-open for availability
  }
}

// ── Middleware: full subscription check ────────────────────────────────────────

export const requireActiveSubscription = async (
  req: AuthenticatedRequest, res: Response, next: NextFunction
) => {
  // Skip garanti pour les flows de paiement / voucher / billing
  const PAYMENT_FLOW =
    req.path.startsWith('/checkout') ||
    req.path.startsWith('/payments') ||
    req.path.startsWith('/webhooks') ||
    req.path.startsWith('/vouchers') ||
    req.path.startsWith('/voucher-purchase') ||
    req.path.startsWith('/billing') ||
    req.path.startsWith('/plans');

  if (PAYMENT_FLOW) {
    console.log('[SubGuard:SKIP]', { method: req.method, path: req.path, flow: true });
    return next();
  }

  // Lectures publiques tenants
  if (req.path.startsWith('/tenants') && ['GET','HEAD','OPTIONS'].includes(req.method)) {
    return next();
  }

  const tenantId = req.user?.tenant_id;
  if (!tenantId) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' });

  let result = getCached(tenantId);
  if (!result) { result = await checkSubscriptionStatus(tenantId); setCache(tenantId, result); }
  req.subscription = result;

  const BLOCKED_STATES = ['pending', 'expired', 'suspended', 'cancelled', 'no_plan', 'past_due'];

  if (BLOCKED_STATES.includes(result.state)) {
    console.log('[403:SUBSCRIPTION_BLOCKED]', {
      tenantId, userId: req.user?.sub, state: result.state, method: req.method, path: req.path
    });

    const readOnlyPaths = ['/billing', '/subscription', '/profile', '/vouchers', '/voucher-purchase'];
    const isReadOnly = readOnlyPaths.some(p => req.path.startsWith(p));

    if (isReadOnly) {
      return next();
    }

    return res.status(403).json({
      error: result.state === 'pending' ? 'SUBSCRIPTION_PENDING' : 'SUBSCRIPTION_REQUIRED',
      message: result.state === 'pending'
        ? 'Compte en attente d\'activation. Veuillez saisir un code voucher.'
        : result.state === 'no_plan'
          ? 'Aucun abonnement actif. Choisissez un plan pour continuer.'
          : result.state === 'cancelled'
            ? 'Abonnement annulé. Souscrivez à un nouveau plan.'
            : 'Abonnement expiré. Activez un voucher pour continuer.',
      state: result.state,
      planName: result.planName,
      daysUntilRenewal: result.daysUntilRenewal,
      renewalUrl: '/billing',
      pricingUrl: '/pricing',
    });
  }

  // active / trial / grace
  if (result.state === 'grace') {
    res.setHeader('X-Subscription-Warning', 'grace_period');
    res.setHeader('X-Subscription-Grace-Days', String(result.graceDaysRemaining || 0));
  }
  return next();
};

// ── Middleware: lenient (reads OK, writes blocked) ─────────────────────────────

export const requireSubscriptionForWrites = async (
  req: AuthenticatedRequest, res: Response, next: NextFunction
) => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' });

  let result = getCached(tenantId);
  if (!result) { result = await checkSubscriptionStatus(tenantId); setCache(tenantId, result); }
  req.subscription = result;

  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (result.state === 'no_plan') return res.status(403).json({ error: 'SUBSCRIPTION_REQUIRED', pricingUrl: '/pricing' });
    return next();
  }

  if (result.state === 'active' || result.state === 'trial') return next();

  return res.status(403).json({
    error: 'SUBSCRIPTION_WRITE_BLOCKED',
    message: 'Votre abonnement ne permet pas les opérations d\'écriture.',
    state: result.state, planName: result.planName, renewalUrl: '/billing',
  });
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export async function getSubscriptionStatus(tenantId: number): Promise<SubscriptionGuardResult> {
  let r = getCached(tenantId);
  if (!r) { r = await checkSubscriptionStatus(tenantId); setCache(tenantId, r); }
  return r;
}

export function invalidateSubscriptionCache(tenantId: number): void { subscriptionCache.delete(tenantId); }
export function invalidateAllSubscriptionCache(): void { subscriptionCache.clear(); }
export { checkSubscriptionStatus, GRACE_PERIOD_DAYS };