/**
 * Voucher Redemption Service (V1.1)
 * 
 * Wraps SubscriptionService with rate limiting and validation.
 * This is the public API for voucher activation.
 */

import { Subscription } from '../../../domain/billing/subscription/Subscription';
import { SubscriptionService } from './SubscriptionService';

export class VoucherRedemptionService {
  private rateLimits: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly RATE_LIMIT_MAX = 5; // 5 attempts
  private readonly RATE_LIMIT_WINDOW = 60000; // per minute

  constructor(
    private subscriptionService: SubscriptionService
  ) {}

  /**
   * Redeem voucher code for subscription activation
   * Includes rate limiting to prevent abuse
   * 
   * @param code - Voucher code
   * @param tenantId - Tenant UUID
   * @param idempotencyKey - Unique idempotency key from client
   * @returns Subscription activation result
   * @throws Error if rate limit exceeded or voucher invalid
   */
  async redeem(
    code: string,
    tenantId: string,
    idempotencyKey: string
  ): Promise<{ subscription: any }> {
    // 1. Rate limit check (5 attempts per minute per tenant)
    const rateLimitKey = `voucher:${tenantId}`;
    const isAllowed = this.checkRateLimit(rateLimitKey);
    
    if (!isAllowed) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }

    // 2. Validate input
    this.validateInput(code, tenantId, idempotencyKey);

    // 3. Redeem voucher
    const subscription = await this.subscriptionService.activateWithVoucher(
      code,
      tenantId,
      idempotencyKey
    );

    return {
      subscription: {
        tenant_id: subscription.tenant_id,
        plan: subscription.plan,
        status: subscription.status,
        end_date: subscription.end_date,
        activation_source: subscription.activation_source
      }
    };
  }

  /**
   * Check rate limit for tenant
   * @returns true if allowed, false if rate limit exceeded
   */
  private checkRateLimit(key: string): boolean {
    const now = Date.now();
    const limit = this.rateLimits.get(key);

    if (!limit || now > limit.resetAt) {
      // First attempt or window expired - reset
      this.rateLimits.set(key, {
        count: 1,
        resetAt: now + this.RATE_LIMIT_WINDOW
      });
      return true;
    }

    if (limit.count >= this.RATE_LIMIT_MAX) {
      // Rate limit exceeded
      return false;
    }

    // Increment counter
    limit.count++;
    return true;
  }

  /**
   * Validate input parameters
   * @throws Error if validation fails
   */
  private validateInput(code: string, tenantId: string, idempotencyKey: string): void {
    if (!code || code.trim().length === 0) {
      throw new Error('INVALID_CODE');
    }

    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error('INVALID_TENANT_ID');
    }

    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new Error('INVALID_IDEMPOTENCY_KEY');
    }

    if (code.length > 50) {
      throw new Error('CODE_TOO_LONG');
    }
  }

  /**
   * Get remaining rate limit attempts for tenant
   * @param tenantId - Tenant UUID
   * @returns Number of remaining attempts
   */
  getRemainingAttempts(tenantId: string): number {
    const key = `voucher:${tenantId}`;
    const limit = this.rateLimits.get(key);
    
    if (!limit || Date.now() > limit.resetAt) {
      return this.RATE_LIMIT_MAX;
    }

    return Math.max(0, this.RATE_LIMIT_MAX - limit.count);
  }

  /**
   * Get time until rate limit resets (in seconds)
   * @param tenantId - Tenant UUID
   * @returns Seconds until reset, 0 if no limit active
   */
  getRateLimitReset(tenantId: string): number {
    const key = `voucher:${tenantId}`;
    const limit = this.rateLimits.get(key);
    
    if (!limit || Date.now() > limit.resetAt) {
      return 0;
    }

    return Math.ceil((limit.resetAt - Date.now()) / 1000);
  }
}