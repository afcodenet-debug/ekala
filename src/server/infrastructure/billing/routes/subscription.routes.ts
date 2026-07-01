/**
 * Subscription API Routes (V1.1)
 * 
 * Exposes subscription activation and status endpoints.
 */

import { Router } from 'express';
import { VoucherRedemptionService } from '../../../application/billing/services/VoucherRedemptionService';
import { SubscriptionService } from '../../../application/billing/services/SubscriptionService';
import { PostgresSubscriptionRepository } from '../../../infrastructure/billing/repositories/PostgresSubscriptionRepository';
import { PostgresVoucherRepository } from '../../../infrastructure/billing/repositories/PostgresVoucherRepository';
import { PostgresIdempotencyRepository } from '../../../infrastructure/billing/repositories/PostgresIdempotencyRepository';

export function createSubscriptionRoutes(
  db: any,
  voucherRedemptionService: VoucherRedemptionService
): Router {
  const router = Router();

  /**
   * POST /api/v1/subscription/activate
   * Activate subscription with voucher code
   */
  router.post('/activate', async (req, res) => {
    try {
      const { code, tenant_id, idempotency_key } = req.body;

      // Validate required fields
      if (!code || !tenant_id || !idempotency_key) {
        return res.status(400).json({
          status: "ERROR",
          message: "code, tenant_id, and idempotency_key are required"
        });
      }

      // Redeem voucher
      const result = await voucherRedemptionService.redeem(
        code,
        tenant_id,
        idempotency_key
      );

      res.json({
        status: "SUCCESS",
        subscription: result.subscription
      });

    } catch (error: any) {
      console.error('Subscription activation error:', error.message);
      
      // Handle specific errors
      if (error.message === 'INVALID_VOUCHER') {
        return res.status(400).json({
          status: "ERROR",
          message: "Invalid or expired voucher code"
        });
      }
      
      if (error.message === 'RATE_LIMIT_EXCEEDED') {
        return res.status(429).json({
          status: "ERROR",
          message: "Too many attempts. Please try again later.",
          retry_after: voucherRedemptionService.getRateLimitReset(req.body.tenant_id)
        });
      }

      // Generic error
      res.status(400).json({
        status: "ERROR",
        message: error.message || "Activation failed"
      });
    }
  });

  /**
   * GET /api/v1/subscription/status/:tenantId
   * Get subscription status for tenant
   */
  router.get('/status/:tenantId', async (req, res) => {
    try {
      const { tenantId } = req.params;

      // Create repository on-demand (or inject via DI)
      const subscriptionRepo = new PostgresSubscriptionRepository(db);
      const subscription = await subscriptionRepo.findByTenantId(tenantId);

      if (!subscription) {
        return res.json({
          active: false,
          plan: null,
          expires_at: null
        });
      }

      res.json({
        active: subscription.isActive(),
        plan: subscription.plan,
        expires_at: subscription.end_date
      });

    } catch (error: any) {
      console.error('Subscription status error:', error.message);
      res.status(500).json({
        status: "ERROR",
        message: "Failed to get subscription status"
      });
    }
  });

  /**
   * GET /api/v1/subscription/rate-limit/:tenantId
   * Get rate limit info for tenant
   */
  router.get('/rate-limit/:tenantId', (req, res) => {
    try {
      const { tenantId } = req.params;

      const remaining = voucherRedemptionService.getRemainingAttempts(tenantId);
      const reset = voucherRedemptionService.getRateLimitReset(tenantId);

      res.json({
        remaining,
        reset_after: reset
      });

    } catch (error: any) {
      console.error('Rate limit error:', error.message);
      res.status(500).json({
        status: "ERROR",
        message: "Failed to get rate limit info"
      });
    }
  });

  return router;
}