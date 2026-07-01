/**
 * Billing System Bootstrap (V1.1)
 * 
 * Initializes all billing services and injects dependencies.
 * This file is called from server.ts during startup.
 * 
 * Architecture: Parallel Run avec migration progressive
 * - Ancien: Supabase + subscription-guard middleware
 * - Nouveau: PostgreSQL V1.1 (atomic, idempotent)
 */

import { db } from '../../db/database';
import { PostgresSubscriptionRepository } from './repositories/PostgresSubscriptionRepository';
import { PostgresVoucherRepository } from './repositories/PostgresVoucherRepository';
import { PostgresIdempotencyRepository } from './repositories/PostgresIdempotencyRepository';
import { SubscriptionService } from '../../application/billing/services/SubscriptionService';
import { VoucherRedemptionService } from '../../application/billing/services/VoucherRedemptionService';
import { SubscriptionAdapter, initializeSubscriptionAdapter } from './subscription-adapter';
import { createSubscriptionRoutes } from './routes/subscription.routes';

export interface BillingServices {
  subscriptionRoutes: ReturnType<typeof createSubscriptionRoutes>;
  voucherRedemptionService: VoucherRedemptionService;
  subscriptionService: SubscriptionService;
  subscriptionAdapter: SubscriptionAdapter;
}

/**
 * Initialize billing system
 * CRITICAL: Must be called AFTER db.connect()
 * 
 * @returns Billing services instance
 */
export async function initializeBillingSystem(): Promise<BillingServices> {
  console.log('[BILLING] Initializing billing system V1.1...');

  try {
    // 1. Initialize repositories
    const subscriptionRepo = new PostgresSubscriptionRepository(db);
    const voucherRepo = new PostgresVoucherRepository(db);
    const idempotencyRepo = new PostgresIdempotencyRepository(db);

    console.log('[BILLING] Repositories initialized');

    // 2. Initialize core service
    const subscriptionService = new SubscriptionService(
      subscriptionRepo,
      voucherRepo,
      idempotencyRepo,
      db
    );

    console.log('[BILLING] SubscriptionService initialized');

    // 3. Initialize public API service (with rate limiting)
    const voucherRedemptionService = new VoucherRedemptionService(
      subscriptionService
    );

    console.log('[BILLING] VoucherRedemptionService initialized');

    // 4. Initialize subscription adapter (bridge between old and new system)
    const subscriptionAdapter = await initializeSubscriptionAdapter(subscriptionService);

    console.log('[BILLING ADAPTER] ✅ Subscription adapter initialized (parallel run mode)');
    console.log('[BILLING ADAPTER]   - Old system: Supabase (fallback)');
    console.log('[BILLING ADAPTER]   - New system: PostgreSQL V1.1 (primary)');

    // 5. Create routes
    const subscriptionRoutes = createSubscriptionRoutes(db, voucherRedemptionService);

    console.log('[BILLING] Routes initialized');

    // 6. Log success
    console.log('[BILLING] ✅ Billing system V1.1 initialized successfully');
    console.log('[BILLING] Available endpoints:');
    console.log('[BILLING]   POST /api/v1/subscription/activate');
    console.log('[BILLING]   GET  /api/v1/subscription/status/:tenantId');
    console.log('[BILLING]   GET  /api/v1/subscription/rate-limit/:tenantId');

    return {
      subscriptionRoutes,
      voucherRedemptionService,
      subscriptionService,
      subscriptionAdapter,
    };

  } catch (error: any) {
    console.error('[BILLING] ❌ Failed to initialize billing system:', error);
    console.error('[BILLING] Stack:', error.stack);
    throw error;
  }
}

/**
 * Health check for billing system
 * @returns true if system is operational
 */
export function checkBillingHealth(): boolean {
  try {
    // Simple health check - verify db is available
    if (!db) {
      console.error('[BILLING] Health check failed: db not available');
      return false;
    }

    console.log('[BILLING] ✅ Health check passed');
    return true;
  } catch (error: any) {
    console.error('[BILLING] ❌ Health check failed:', error.message);
    return false;
  }
}