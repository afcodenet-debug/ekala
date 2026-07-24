import { runtime } from '../infrastructure/data-source-manager';

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

const GRACE_PERIOD_DAYS = 7;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;

interface CacheEntry {
  result: SubscriptionGuardResult;
  expiresAt: number;
}

const subscriptionCache = new Map<number, CacheEntry>();

function getCached(tenantId: number): SubscriptionGuardResult | null {
  const e = subscriptionCache.get(tenantId);
  if (!e || Date.now() > e.expiresAt) {
    subscriptionCache.delete(tenantId);
    return null;
  }
  return e.result;
}

function setCache(tenantId: number, result: SubscriptionGuardResult): void {
  if (subscriptionCache.size >= MAX_CACHE_SIZE) {
    const oldest = subscriptionCache.keys().next().value;
    if (oldest !== undefined) subscriptionCache.delete(oldest);
  }
  subscriptionCache.set(tenantId, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

function buildFallback(tenantId: number): SubscriptionGuardResult {
  return {
    state: 'active',
    tenantId,
    planName: null,
    daysUntilRenewal: null,
    isExpired: false,
    isGracePeriod: false,
    graceDaysRemaining: null,
    subscriptionId: null,
    planId: null,
  };
}

async function resolveFromSupabase(tenantId: number): Promise<SubscriptionGuardResult> {
  const supabase = runtime.getSupabase();
  if (!supabase) return buildFallback(tenantId);

  try {
    const { data: sub, error } = await supabase
      .from('subscriptions')
      .select('id, status, plan_id, current_period_end, trial_ends_at, cancelled_at, plans!inner(name, code)')
      .eq('tenant_id', String(tenantId))
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[SubscriptionService] Supabase subscription query error:', error.message);
      return buildFallback(tenantId);
    }

    if (!sub) {
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
          ...buildFallback(tenantId),
          state: isExpired ? 'expired' : 'trial',
          planName: 'Essai Gratuit',
          daysUntilRenewal: Math.ceil((trialEnd - now) / 86400000),
          isExpired,
        };
      }

      if (tenant?.status === 'active') {
        return {
          ...buildFallback(tenantId),
          state: 'active',
          planName: 'Free',
          daysUntilRenewal: null,
          isExpired: false,
          isGracePeriod: false,
          graceDaysRemaining: null,
        };
      }

      return {
        ...buildFallback(tenantId),
        state: tenant?.status === 'suspended' ? 'suspended' : 'no_plan',
        planName: 'No Plan',
        daysUntilRenewal: null,
        isExpired: true,
        isGracePeriod: false,
        graceDaysRemaining: null,
      };
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

    if (sub.status === 'active') {
      state = 'active';
    } else if (sub.status === 'cancelled') {
      state = 'cancelled';
    } else if (sub.status === 'trial' && isExpired) {
      state = 'expired';
    } else if (sub.status === 'past_due' && periodEnd) {
      const graceEnd = periodEnd + GRACE_PERIOD_DAYS * 86_400_000;
      state = now < graceEnd ? 'grace' : 'expired';
    } else if (sub.status === 'trial') {
      state = 'trial';
    } else {
      state = 'no_plan';
    }

    let graceDaysRemaining: number | null = null;
    if (state === 'grace' && periodEnd) {
      const graceEnd = periodEnd + GRACE_PERIOD_DAYS * 86_400_000;
      graceDaysRemaining = Math.max(0, Math.ceil((graceEnd - now) / 86_400_000));
    }

    return {
      state,
      tenantId,
      planName,
      daysUntilRenewal,
      isExpired,
      isGracePeriod: state === 'grace',
      graceDaysRemaining,
      subscriptionId: sub.id,
      planId: sub.plan_id,
    };
  } catch (err: any) {
    console.error('[SubscriptionService] Unexpected Supabase error:', err.message);
    return buildFallback(tenantId);
  }
}

async function resolveFromLocalDb(tenantId: number): Promise<SubscriptionGuardResult> {
  try {
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = path.resolve(process.cwd(), 'data', 'database.db');
    const db = new Database(dbPath);

    try {
      const sub = db.prepare(`
        SELECT s.*, p.name as plan_name, p.code as plan_code
        FROM subscriptions s
        LEFT JOIN plans p ON p.id = s.plan_id
        WHERE s.tenant_id = ?
        ORDER BY s.created_at DESC
        LIMIT 1
      `).get(tenantId);

      if (sub && sub.status === 'active') {
        const now = Date.now();
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
        const trialEnd = sub.trial_end ? new Date(sub.trial_end).getTime() : null;
        const endDate = trialEnd || periodEnd;
        const daysUntilRenewal = endDate ? Math.ceil((endDate - now) / 86_400_000) : null;
        const isExpired = endDate ? endDate < now : false;

        return {
          ...buildFallback(tenantId),
          state: isExpired ? 'expired' : 'active',
          planName: sub.plan_name || sub.plan_code,
          daysUntilRenewal,
          isExpired,
          isGracePeriod: false,
          graceDaysRemaining: null,
          subscriptionId: sub.id,
          planId: sub.plan_id,
        };
      }

      if (sub && sub.status !== 'active') {
        return {
          ...buildFallback(tenantId),
          state: sub.status as any,
          planName: sub.plan_name || sub.plan_code,
          daysUntilRenewal: null,
          isExpired: true,
          isGracePeriod: false,
          graceDaysRemaining: null,
          subscriptionId: sub.id,
          planId: sub.plan_id,
        };
      }

      const tenant = db.prepare(`
        SELECT status, created_at FROM tenants WHERE id = ?
      `).get(tenantId);

      if (tenant) {
        if (tenant.status === 'active') {
          return {
            ...buildFallback(tenantId),
            state: 'active',
            planName: 'Free',
            daysUntilRenewal: null,
            isExpired: false,
            isGracePeriod: false,
            graceDaysRemaining: null,
          };
        }

        if (tenant.status === 'trial') {
          const created = new Date(tenant.created_at).getTime();
          const trialEnd = created + 7 * 86400000;
          const now = Date.now();
          const isExpired = now > trialEnd;

          return {
            ...buildFallback(tenantId),
            state: isExpired ? 'expired' : 'trial',
            planName: 'Essai Gratuit',
            daysUntilRenewal: Math.ceil((trialEnd - now) / 86400000),
            isExpired,
            isGracePeriod: false,
            graceDaysRemaining: null,
          };
        }

        return {
          ...buildFallback(tenantId),
          state: tenant.status as any,
          planName: 'No Plan',
          daysUntilRenewal: null,
          isExpired: true,
          isGracePeriod: false,
          graceDaysRemaining: null,
        };
      }

      return buildFallback(tenantId);
    } finally {
      try { db.close(); } catch {}
    }
  } catch (err) {
    console.error('[SubscriptionService] Local DB error:', err);
    return buildFallback(tenantId);
  }
}

export class SubscriptionService {
  async getStatus(tenantId: number): Promise<SubscriptionGuardResult> {
    const cached = getCached(tenantId);
    if (cached) {
      return cached;
    }

    const inCloud = runtime.isCloud();
    let result: SubscriptionGuardResult;

    if (!inCloud) {
      result = await resolveFromLocalDb(tenantId);
    } else {
      result = await resolveFromSupabase(tenantId);
    }

    setCache(tenantId, result);
    return result;
  }

  invalidateCache(tenantId: number): void {
    subscriptionCache.delete(tenantId);
  }

  clearCache(): void {
    subscriptionCache.clear();
  }
}

export const subscriptionService = new SubscriptionService();
