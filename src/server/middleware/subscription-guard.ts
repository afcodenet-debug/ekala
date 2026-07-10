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
import { runtime } from '../infrastructure/data-source-manager';
import { getCurrentTrace } from '../services/trace-manager.service';

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

// ── Core: resolve subscription state ───────────────────────────────────────────

async function checkSubscriptionStatus(tenantId: number): Promise<SubscriptionGuardResult> {
  const supabase = runtime.getSupabase();
  const fallback: SubscriptionGuardResult = {
    state: 'active', tenantId, planName: null, daysUntilRenewal: null,
    isExpired: false, isGracePeriod: false, graceDaysRemaining: null,
    subscriptionId: null, planId: null,
  };

  // Try SQLite first (local dev mode)
  try {
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = path.resolve(process.cwd(), 'data', 'database.db');
    const db = new Database(dbPath);
    
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
      
      db.close();
      return {
        ...fallback,
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
      db.close();
      return {
        ...fallback,
        state: sub.status as any,
        planName: sub.plan_name || sub.plan_code,
        subscriptionId: sub.id,
        planId: sub.plan_id,
      };
    }
    
    // No subscription found - check tenant status in SQLite
    const tenant = db.prepare(`
      SELECT status, created_at FROM tenants WHERE id = ?
    `).get(tenantId);
    
    if (tenant) {
      db.close();
      
      // If tenant is active, allow access (no subscription = free tier)
      if (tenant.status === 'active') {
        return {
          ...fallback,
          state: 'active',
          planName: 'Free',
          daysUntilRenewal: null,
          isExpired: false,
          isGracePeriod: false,
          graceDaysRemaining: null,
        };
      }
      
      // If tenant is trial, calculate trial end
      if (tenant.status === 'trial') {
        const created = new Date(tenant.created_at).getTime();
        const trialEnd = created + 7 * 86400000;
        const now = Date.now();
        const isExpired = now > trialEnd;
        
        return {
          ...fallback,
          state: isExpired ? 'expired' : 'trial',
          planName: 'Essai Gratuit',
          daysUntilRenewal: Math.ceil((trialEnd - now) / 86400000),
          isExpired,
          isGracePeriod: false,
          graceDaysRemaining: null,
        };
      }
      
      // Other tenant statuses (past_due, expired, etc.)
      return {
        ...fallback,
        state: tenant.status as any,
        planName: 'No Plan',
        daysUntilRenewal: null,
        isExpired: true,
        isGracePeriod: false,
        graceDaysRemaining: null,
      };
    }
    
    db.close();
  } catch (err) {
    // SQLite not available, continue to Supabase
  }

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
      
      // If tenant is active but has no subscription, allow access (free tier)
      if (tenant?.status === 'active') {
        return {
          ...fallback,
          state: 'active',
          planName: 'Free',
          daysUntilRenewal: null,
          isExpired: false,
          isGracePeriod: false,
          graceDaysRemaining: null,
        };
      }
      
      // Other tenant statuses (suspended, expired, etc.)
      return { 
        ...fallback, 
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

    // RÈGLE UNIQUE : Le champ status de la DB est autoritaire.
    // Si subscriptions.status = 'active', on le respecte même si period_end est dépassé.
    // Seuls les statuts 'trial' et 'past_due' peuvent être rétrogradés par date.
    if (sub.status === 'active') {
      // Active status from DB is authoritative. Don't override to 'suspended'.
      state = 'active';
    } else if (sub.status === 'cancelled') {
      state = 'cancelled';
    } else if (sub.status === 'trial' && isExpired) {
      state = 'expired';
    } else if (sub.status === 'past_due' && periodEnd) {
      const graceEnd = periodEnd + GRACE_PERIOD_DAYS * 86_400_000;
      state = now < graceEnd ? 'grace' : 'expired';
    } else if (sub.status === 'trial') {
      state = sub.status;
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
  const trace = getCurrentTrace();
  const requestId = (req as any).requestId || 'unknown';
  
  // FORENSIC TRACE — DECIDE step
  trace.enter('DECIDE', { 
    tenantId: req.user?.tenant_id, 
    path: req.path, 
    method: req.method 
  });
  
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
    console.log(JSON.stringify({
      middleware: 'requireActiveSubscription',
      file: 'src/server/middleware/subscription-guard.ts',
      line: 252,
      action: 'skip',
      requestId,
      method: req.method,
      path: req.path,
      reason: 'payment_flow'
    }));
    return next();
  }

  // Lectures publiques tenants
  if (req.path.startsWith('/tenants') && ['GET','HEAD','OPTIONS'].includes(req.method)) {
    console.log(JSON.stringify({
      middleware: 'requireActiveSubscription',
      file: 'src/server/middleware/subscription-guard.ts',
      line: 258,
      action: 'skip',
      requestId,
      reason: 'public_tenant_read'
    }));
    return next();
  }

  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    console.log(JSON.stringify({
      middleware: 'requireActiveSubscription',
      file: 'src/server/middleware/subscription-guard.ts',
      line: 263,
      status: 401,
      requestId,
      error: 'NO_TENANT_ID'
    }));
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentification requise.' });
  }

  let result = getCached(tenantId);
  if (!result) { result = await checkSubscriptionStatus(tenantId); setCache(tenantId, result); }
  req.subscription = result;

  // Only log blocked/warning states to reduce noise
  if (result.state !== 'active' && result.state !== 'trial') {
    console.log(JSON.stringify({
      middleware: 'requireActiveSubscription',
      file: 'src/server/middleware/subscription-guard.ts',
      line: 269,
      action: 'subscription_checked',
      requestId,
      tenantId,
      userId: req.user?.sub,
      state: result.state,
      planName: result.planName
    }));
  }

  const BLOCKED_STATES = ['pending', 'expired', 'suspended', 'cancelled', 'no_plan', 'past_due'];

  if (BLOCKED_STATES.includes(result.state)) {
    trace.fail('DECIDE', { state: result.state, reason: 'subscription_blocked' });
    
    console.log(JSON.stringify({
      middleware: 'requireActiveSubscription',
      file: 'src/server/middleware/subscription-guard.ts',
      line: 271,
      status: 403,
      requestId,
      tenantId,
      userId: req.user?.sub,
      state: result.state,
      method: req.method,
      path: req.path
    }));

    const readOnlyPaths = ['/billing', '/subscription', '/profile', '/vouchers', '/voucher-purchase'];
    const isReadOnly = readOnlyPaths.some(p => req.path.startsWith(p));

    if (isReadOnly) {
      console.log(JSON.stringify({
        middleware: 'requireActiveSubscription',
        file: 'src/server/middleware/subscription-guard.ts',
        line: 280,
        action: 'next',
        requestId,
        reason: 'read_only_path'
      }));
      return next();
    }

    console.log(JSON.stringify({
      middleware: 'requireActiveSubscription',
      file: 'src/server/middleware/subscription-guard.ts',
      line: 283,
      status: 403,
      requestId,
      body: {
        error: result.state === 'pending' ? 'SUBSCRIPTION_PENDING' : 'SUBSCRIPTION_REQUIRED',
        state: result.state,
        planName: result.planName
      }
    }));
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
  
  trace.exit('DECIDE', { state: result.state, planName: result.planName });
  
  console.log(JSON.stringify({
    middleware: 'requireActiveSubscription',
    file: 'src/server/middleware/subscription-guard.ts',
    line: 305,
    action: 'next',
    requestId,
    state: result.state
  }));
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