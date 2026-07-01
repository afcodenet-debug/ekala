/**
 * Subscription Service (V1.1) - CORE LOGIC
 * 
 * Orchestrates subscription activation with atomic operations.
 * This is the heart of the billing system.
 */

import { Subscription } from '../../../domain/billing/subscription/Subscription';
import { ISubscriptionRepository } from '../../../domain/billing/repositories/ISubscriptionRepository';
import { IVoucherRepository } from '../../../domain/billing/repositories/IVoucherRepository';
import { IIdempotencyRepository, IdempotencyRecord } from '../../../domain/billing/repositories/IIdempotencyRepository';
import { calculateNewEndDate, decideActivationMode } from '../helpers/calculateNewEndDate';

export class SubscriptionService {
  constructor(
    private subscriptionRepo: ISubscriptionRepository,
    private voucherRepo: IVoucherRepository,
    private idempotencyRepo: IIdempotencyRepository,
    private db: any // For transaction management
  ) {}

  /**
   * Activate subscription with voucher code
   * CRITICAL: Atomic transaction with idempotency
   * 
   * @param code - Voucher code
   * @param tenantId - Tenant UUID
   * @param idempotencyKey - Unique idempotency key from client
   * @returns Activated subscription
   * @throws Error if voucher invalid or activation fails
   */
  async activateWithVoucher(
    code: string,
    tenantId: string,
    idempotencyKey: string
  ): Promise<Subscription> {
    // 0. Check idempotency (SEULEMENT si status === "SUCCESS")
    const existingIdempotency = await this.idempotencyRepo.findByIdempotencyKey(idempotencyKey);
    if (existingIdempotency && existingIdempotency.status === "SUCCESS") {
      // Return snapshot directly (no re-fetch needed)
      return this.hydrateFromSnapshot(existingIdempotency.subscription_snapshot);
    }

    // 1. Execute in transaction
    return await this.withTransaction(async (tx) => {
      // 2. ATOMIC VOUCHER CLAIM (with expires_at check)
      const voucher = await this.voucherRepo.claimVoucher(code, tenantId, tx);
      
      if (!voucher) {
        throw new Error('INVALID_VOUCHER');
      }

      // 3. LOCK SUBSCRIPTION (FOR UPDATE)
      const existingSubscription = await this.subscriptionRepo.findByTenantIdForUpdate(tenantId, tx);

      // 4. Decide activation mode (pure function)
      const mode = decideActivationMode(existingSubscription);

      // 5. Calculate new end date (pure function)
      const existingEndDate = existingSubscription?.end_date || null;
      const isActive = existingSubscription?.isActive() || false;
      const newEndDate = calculateNewEndDate(existingEndDate, voucher.duration_days, isActive);

      // 6. Prepare subscription data
      const now = new Date();
      const subscriptionData = {
        tenant_id: tenantId,
        plan: voucher.plan,
        status: 'ACTIVE',
        start_date: mode === 'activate_new' ? now : (existingSubscription?.start_date || now),
        end_date: newEndDate,
        activation_source: 'voucher',
        activation_reference: voucher.code,
        activated_at: now,
        updated_at: now
      };

      // 7. UPSERT SUBSCRIPTION (CRITICAL)
      await this.subscriptionRepo.upsert(subscriptionData, tx);

      // 8. Retrieve final subscription (should exist after UPSERT)
      const subscription = await this.subscriptionRepo.findByTenantId(tenantId, tx);
      
      if (!subscription) {
        throw new Error('SUBSCRIPTION_NOT_FOUND_AFTER_UPSERT');
      }

      // 9. Save idempotency (with minimal snapshot + SUCCESS status)
      await this.idempotencyRepo.save({
        idempotency_key: idempotencyKey,
        tenant_id: tenantId,
        status: "SUCCESS",
        subscription_snapshot: {
          tenant_id: subscription.tenant_id,
          plan: subscription.plan,
          status: subscription.status,
          end_date: subscription.end_date,
          activation_source: subscription.activation_source
        },
        created_at: now
      }, tx);

      return subscription;
    });
  }

  /**
   * Get subscription status for tenant
   * @param tenantId - Tenant UUID
   * @returns Subscription or null
   */
  async getStatus(tenantId: string): Promise<Subscription | null> {
    return await this.subscriptionRepo.findByTenantId(tenantId);
  }

  /**
   * Transaction helper
   * CRITICAL: Ensures atomic operations
   */
  private async withTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      const tx = {
        query: (sql: string, params?: any[]) => client.query(sql, params)
      };
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Hydrate Subscription from minimal snapshot
   * Used for idempotency returns
   */
  private hydrateFromSnapshot(snapshot: any): Subscription {
    return new Subscription(
      snapshot.tenant_id,
      snapshot.plan,
      snapshot.status,
      new Date(), // start_date not in snapshot
      snapshot.end_date,
      snapshot.activation_source,
      '', // activation_reference not in snapshot
      new Date(), // activated_at not in snapshot
      new Date(), // created_at not in snapshot
      new Date()  // updated_at not in snapshot
    );
  }
}