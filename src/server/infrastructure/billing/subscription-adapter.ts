// =============================================================================
// SubscriptionAdapter — Pont entre Ancien et Nouveau Système de Billing
// =============================================================================
// Architecture: Parallel Run avec migration progressive
// - Ancien: Supabase + subscription-guard middleware
// - Nouveau: PostgreSQL V1.1 (atomic, idempotent)
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../../application/billing/services/SubscriptionService';
import { db } from '../../db/database';

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

export interface SubscriptionStatus {
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

export interface ActivationResult {
  success: boolean;
  subscription?: {
    tenant_id: string;
    plan: string;
    status: string;
    end_date: string;
    activation_source: string;
  };
  error?: string;
}

// ── Configuration ──────────────────────────────────────────────────────────────

const GRACE_PERIOD_DAYS = 7;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const MAX_CACHE_SIZE = 1000;

// ── In-memory cache ────────────────────────────────────────────────────────────

interface CacheEntry {
  result: SubscriptionStatus;
  expiresAt: number;
}

const subscriptionCache = new Map<number, CacheEntry>();

function getCached(tenantId: number): SubscriptionStatus | null {
  const e = subscriptionCache.get(tenantId);
  if (!e || Date.now() > e.expiresAt) {
    subscriptionCache.delete(tenantId);
    return null;
  }
  return e.result;
}

function setCache(tenantId: number, result: SubscriptionStatus): void {
  if (subscriptionCache.size >= MAX_CACHE_SIZE) {
    const oldest = subscriptionCache.keys().next().value;
    if (oldest !== undefined) subscriptionCache.delete(oldest);
  }
  subscriptionCache.set(tenantId, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

function clearCache(tenantId: number): void {
  subscriptionCache.delete(tenantId);
}

// ── SubscriptionAdapter ────────────────────────────────────────────────────────

export class SubscriptionAdapter {
  private newBillingService: SubscriptionService;
  private initialized: boolean = false;

  constructor(newBillingService: SubscriptionService) {
    this.newBillingService = newBillingService;
  }

  /**
   * Initialize adapter (call once at startup)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Verify new billing system tables exist
      await db.query('SELECT COUNT(*) FROM subscriptions LIMIT 1');
      await db.query('SELECT COUNT(*) FROM vouchers LIMIT 1');
      await db.query('SELECT COUNT(*) FROM plans LIMIT 1');

      console.log('[BILLING ADAPTER] ✅ New billing system V1.1 available');
      this.initialized = true;
    } catch (error) {
      console.warn('[BILLING ADAPTER] ⚠️  New billing system not available, using fallback');
      this.initialized = false;
    }
  }

  /**
   * Check if tenant uses new billing system
   */
  private async checkTenantBillingSystem(tenantId: number): Promise<boolean> {
    try {
      // Check if tenant has subscription in new system
      const result = await db.query(
        'SELECT id FROM subscriptions WHERE tenant_id = $1 LIMIT 1',
        [tenantId.toString()]
      );

      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get subscription status from NEW system (Postgres V1.1)
   */
  private async getStatusFromNewSystem(tenantId: number): Promise<SubscriptionStatus> {
    try {
      const status = await this.newBillingService.getStatus(tenantId.toString());

      if (!status) {
        return {
          state: 'no_plan',
          tenantId,
          planName: null,
          daysUntilRenewal: null,
          isExpired: true,
          isGracePeriod: false,
          graceDaysRemaining: null,
          subscriptionId: null,
          planId: null,
        };
      }

      const now = new Date();
      const endDate = new Date(status.end_date);
      const daysUntilRenewal = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isExpired = daysUntilRenewal < 0;
      const isGracePeriod = daysUntilRenewal < 0 && daysUntilRenewal > -GRACE_PERIOD_DAYS;

      return {
        state: isExpired ? (isGracePeriod ? 'grace' : 'expired') : 'active',
        tenantId,
        planName: status.plan,
        daysUntilRenewal: Math.max(0, daysUntilRenewal),
        isExpired,
        isGracePeriod,
        graceDaysRemaining: isGracePeriod ? GRACE_PERIOD_DAYS + daysUntilRenewal : null,
        subscriptionId: null, // Not available in V1.1
        planId: null, // Not available in V1.1
      };
    } catch (error) {
      console.error(`[BILLING ADAPTER] Error getting status from new system:`, error);
      throw error;
    }
  }

  /**
   * Get subscription status from OLD system (Supabase)
   * This is a fallback for tenants not yet migrated
   */
  private async getStatusFromOldSystem(tenantId: number): Promise<SubscriptionStatus> {
    try {
      // Import Supabase client dynamically
      const { createClient } = await import('@supabase/supabase-js');
      const { env } = await import('../../config/env');

      const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
      });

      // Query Supabase subscriptions table
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*, plans(*)')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .single();

      if (error || !subscription) {
        return {
          state: 'no_plan',
          tenantId,
          planName: null,
          daysUntilRenewal: null,
          isExpired: true,
          isGracePeriod: false,
          graceDaysRemaining: null,
          subscriptionId: null,
          planId: null,
        };
      }

      const now = new Date();
      const endDate = new Date(subscription.end_date);
      const daysUntilRenewal = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isExpired = daysUntilRenewal < 0;
      const isGracePeriod = daysUntilRenewal < 0 && daysUntilRenewal > -GRACE_PERIOD_DAYS;

      return {
        state: isExpired ? (isGracePeriod ? 'grace' : 'expired') : 'active',
        tenantId,
        planName: subscription.plans?.name || null,
        daysUntilRenewal: Math.max(0, daysUntilRenewal),
        isExpired,
        isGracePeriod,
        graceDaysRemaining: isGracePeriod ? GRACE_PERIOD_DAYS + daysUntilRenewal : null,
        subscriptionId: subscription.id,
        planId: subscription.plan_id,
      };
    } catch (error) {
      console.error(`[BILLING ADAPTER] Error getting status from old system:`, error);
      // Fallback to active state if old system fails
      return {
        state: 'active',
        tenantId,
        planName: 'Unknown',
        daysUntilRenewal: 30,
        isExpired: false,
        isGracePeriod: false,
        graceDaysRemaining: null,
        subscriptionId: null,
        planId: null,
      };
    }
  }

  /**
   * Get subscription status (unified method)
   * Routes to appropriate system based on tenant
   */
  async getSubscriptionStatus(tenantId: number): Promise<SubscriptionStatus> {
    // Check cache first
    const cached = getCached(tenantId);
    if (cached) return cached;

    // Check if new system is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    // Determine which system to use
    const useNewSystem = await this.checkTenantBillingSystem(tenantId);

    let status: SubscriptionStatus;

    if (useNewSystem && this.initialized) {
      console.log(`[BILLING ADAPTER] Tenant ${tenantId} → NEW system (Postgres V1.1)`);
      status = await this.getStatusFromNewSystem(tenantId);
    } else {
      console.log(`[BILLING ADAPTER] Tenant ${tenantId} → OLD system (Supabase)`);
      status = await this.getStatusFromOldSystem(tenantId);
    }

    // Cache result
    setCache(tenantId, status);

    return status;
  }

  /**
   * Activate subscription with voucher (new system only)
   */
  async activateWithVoucher(
    code: string,
    tenantId: number,
    idempotencyKey: string
  ): Promise<ActivationResult> {
    try {
      // Ensure new system is initialized
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.initialized) {
        return {
          success: false,
          error: 'Billing system not available',
        };
      }

      // Activate via new system
      const result = await this.newBillingService.activateWithVoucher(
        code,
        tenantId.toString(),
        idempotencyKey
      );

      if (result) {
        // Clear cache for this tenant
        clearCache(tenantId);

        return {
          success: true,
          subscription: {
            tenant_id: result.tenant_id,
            plan: result.plan,
            status: result.status,
            end_date: result.end_date.toISOString(),
            activation_source: result.activation_source,
          },
        };
      } else {
        return {
          success: false,
          error: 'Activation failed',
        };
      }
    } catch (error: any) {
      console.error(`[BILLING ADAPTER] Activation error:`, error);
      return {
        success: false,
        error: error.message || 'Activation failed',
      };
    }
  }

  /**
   * Create unified middleware for protecting routes
   * Compatible with both old and new billing systems
   */
  createUnifiedGuard() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        const status = await this.getSubscriptionStatus(tenantId);

        // Attach subscription info to request
        (req as any).subscription = status;

        if (status.state === 'active' || status.state === 'trial') {
          return next();
        } else if (status.state === 'grace') {
          // Grace period: read-only access
          return next();
        } else {
          return res.status(403).json({
            error: 'SUBSCRIPTION_REQUIRED',
            message: 'Active subscription required',
            state: status.state,
            planName: status.planName,
            daysUntilRenewal: status.daysUntilRenewal,
          });
        }
      } catch (error) {
        console.error('[BILLING ADAPTER] Guard error:', error);
        return res.status(500).json({ error: 'SUBSCRIPTION_CHECK_FAILED' });
      }
    };
  }

  /**
   * Get billing system statistics
   */
  async getBillingStats(): Promise<{
    newSystem: { total: number; active: number };
    oldSystem: { total: number; active: number };
  }> {
    try {
      // Count tenants in new system
      const newSystemResult = await db.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active
         FROM subscriptions`
      );

      // For old system, we'd need to query Supabase
      // For now, return placeholder
      const newSystem = {
        total: parseInt(newSystemResult.rows[0].total),
        active: parseInt(newSystemResult.rows[0].active),
      };

      return {
        newSystem,
        oldSystem: { total: 0, active: 0 }, // TODO: Implement if needed
      };
    } catch (error) {
      console.error('[BILLING ADAPTER] Error getting stats:', error);
      return {
        newSystem: { total: 0, active: 0 },
        oldSystem: { total: 0, active: 0 },
      };
    }
  }
}

// ── Singleton Instance ─────────────────────────────────────────────────────────

let adapterInstance: SubscriptionAdapter | null = null;

export function getSubscriptionAdapter(): SubscriptionAdapter | null {
  return adapterInstance;
}

export function setSubscriptionAdapter(adapter: SubscriptionAdapter): void {
  adapterInstance = adapter;
}

export async function initializeSubscriptionAdapter(
  billingService: SubscriptionService
): Promise<SubscriptionAdapter> {
  const adapter = new SubscriptionAdapter(billingService);
  await adapter.initialize();
  setSubscriptionAdapter(adapter);
  return adapter;
}