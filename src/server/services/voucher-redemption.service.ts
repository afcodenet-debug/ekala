import { db } from '../db/database';
import { invalidateSubscriptionCache } from '../middleware/subscription-guard';
import { SqliteSubscriptionRepository } from '../infrastructure/repositories/sqlite/SqliteSubscriptionRepository';
import { SubscriptionStatusReadModelService } from '../domain/subscription/read-models/SubscriptionStatusReadModel';

export interface VoucherRedemptionResult {
  success: boolean;
  error_code?: string;
  message: string;
  httpStatus: number;
  subscription_status?: string;
  voucher_status?: string;
}

export class VoucherRedemptionService {
  private requestId: string;

  constructor() {
    this.requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Normalize voucher code: trim, uppercase, remove internal spaces
   */
  normalizeCode(code: string): string {
    return code.trim().toUpperCase().replace(/\s+/g, '');
  }

  /**
   * Ensure last_voucher_code column exists in subscriptions table
   */
  ensureColumnExists(): void {
    try {
      const subCols = db.prepare("PRAGMA table_info(subscriptions)").all() as Array<{ name: string }>;
      const hasLastVoucherCode = subCols.some(c => c.name === 'last_voucher_code');
      if (!hasLastVoucherCode) {
        console.log('[VoucherRedemption] Adding last_voucher_code column to subscriptions');
        db.exec(`ALTER TABLE subscriptions ADD COLUMN last_voucher_code TEXT`);
      }
    } catch (e: any) {
      console.error('[VoucherRedemption] Failed to ensure last_voucher_code column:', e?.message || e);
    }
  }

  /**
   * Execute the full voucher redemption flow within a transaction
   */
  redeem(tenantId: number, code: string): VoucherRedemptionResult {
    const normalizedCode = this.normalizeCode(code);

    console.log(`[${this.requestId}][VoucherRedemption] Starting redemption`, {
      step: 'INPUT_NORMALIZATION',
      voucherCode: normalizedCode,
      tenantId
    });

    // BEGIN TRANSACTION
    console.log(`[${this.requestId}][VoucherRedemption] Transaction BEGIN`);
    db.exec('BEGIN TRANSACTION');

    try {
      // Step 1: Atomic lock - prevent concurrent redeem
      const lockResult = this.acquireLock(normalizedCode, tenantId);

      // Step 2: Fetch locked voucher details
      const voucher = this.fetchLockedVoucher(normalizedCode, tenantId);

      // Step 3: Validate expiration
      this.validateExpiration(voucher);

      // Step 4: Apply subscription update (CRITICAL - verify success, throw on failure)
      console.log('[STEP CHECK] BEFORE subscription update');
      const subUpdateResult = this.applySubscriptionUpdate(tenantId, voucher, normalizedCode);
      console.log('[STEP CHECK] AFTER subscription update');

      console.log(`[${this.requestId}][VoucherRedemption] SUBSCRIPTION_UPDATE CONFIRMED`, {
        subscriptionId: subUpdateResult.subscriptionId,
        status: subUpdateResult.status,
        tenantId
      });

      // Step 5: Activate voucher (only reached if subscription update succeeded)
      this.activateVoucher(voucher.id);

      // COMMIT
      db.exec('COMMIT');
      console.log(`[${this.requestId}][VoucherRedemption] Transaction COMMIT`);

      // Invalidate ALL caches after commit
      invalidateSubscriptionCache(tenantId);
      
      // CRITICAL: Also invalidate V2.1 ReadModel cache
      try {
        const readModelRepo = new SqliteSubscriptionRepository();
        const readModelService = new SubscriptionStatusReadModelService(readModelRepo);
        readModelService.invalidateCache(tenantId);
        console.log(`[${this.requestId}][VoucherRedemption] V2.1 ReadModel cache invalidated`);
      } catch (e: any) {
        console.warn(`[${this.requestId}][VoucherRedemption] Failed to invalidate V2.1 cache:`, e.message);
      }

      console.log(`[${this.requestId}][VoucherRedemption] Success`, {
        step: 'COMPLETE',
        voucherId: voucher.id,
        tenantId
      });

      return {
        success: true,
        message: 'Code voucher activé avec succès',
        httpStatus: 200,
        subscription_status: 'active',
        voucher_status: 'activated'
      };

    } catch (error: any) {
      // ROLLBACK on any error
      db.exec('ROLLBACK');
      console.log(`[${this.requestId}][VoucherRedemption] Transaction ROLLBACK`);

      return this.handleError(error);
    }
  }

  /**
   * Step 1: Atomic UPDATE to lock voucher (prevents double-click / concurrent redeem)
   */
  private acquireLock(normalizedCode: string, tenantId: number): { changes: number } {
    const lockResult = db.prepare(`
      UPDATE voucher_requests
      SET status = 'activating'
      WHERE voucher_code = ? AND tenant_id = ? AND status = 'verified'
    `).run(normalizedCode, tenantId);

    console.log(`[${this.requestId}][VoucherRedemption] Step 1: Atomic lock attempt`, {
      step: 'ATOMIC_LOCK',
      voucherCode: normalizedCode,
      tenantId,
      changes: lockResult.changes
    });

    if (lockResult.changes === 0) {
      this.handleLockFailure(normalizedCode, tenantId);
    }

    console.log(`[${this.requestId}][VoucherRedemption] Step 2: Lock acquired`, {
      step: 'LOCK_ACQUIRED',
      voucherCode: normalizedCode,
      tenantId,
      changes: lockResult.changes
    });

    return lockResult;
  }

  /**
   * Handle lock failure - determine why lock was not acquired
   */
  private handleLockFailure(normalizedCode: string, tenantId: number): never {
    console.warn(`[${this.requestId}][VoucherRedemption] Lock failed - checking voucher state`, {
      step: 'LOCK_FAILED',
      voucherCode: normalizedCode,
      tenantId
    });

    const existingVoucher = db.prepare(`
      SELECT id, status FROM voucher_requests
      WHERE voucher_code = ? AND tenant_id = ?
    `).get(normalizedCode, tenantId) as any;

    if (!existingVoucher) {
      throw new Error('VOUCHER_NOT_FOUND');
    } else if (existingVoucher.status === 'activated' || existingVoucher.status === 'activating') {
      console.warn(`[${this.requestId}][VoucherRedemption] Already used`, {
        step: 'ALREADY_USED',
        voucherId: existingVoucher.id,
        voucherCode: normalizedCode,
        status: existingVoucher.status,
        tenantId
      });
      throw new Error('VOUCHER_ALREADY_USED');
    } else {
      console.warn(`[${this.requestId}][VoucherRedemption] Invalid status`, {
        step: 'INVALID_STATUS',
        voucherId: existingVoucher.id,
        voucherCode: normalizedCode,
        status: existingVoucher.status,
        tenantId
      });
      throw new Error('VOUCHER_INVALID_STATUS');
    }
  }

  /**
   * Step 2: Fetch voucher details after lock acquired
   */
  private fetchLockedVoucher(normalizedCode: string, tenantId: number): any {
    const voucher = db.prepare(`
      SELECT vr.*, p.id as plan_id, p.code as plan_code
      FROM voucher_requests vr
      LEFT JOIN plans p ON vr.plan_id = p.id
      WHERE vr.voucher_code = ? AND vr.tenant_id = ? AND vr.status = 'activating'
    `).get(normalizedCode, tenantId) as any;

    if (!voucher) {
      throw new Error('VOUCHER_NOT_FOUND');
    }

    return voucher;
  }

  /**
   * Step 3: Validate voucher expiration
   */
  private validateExpiration(voucher: any): void {
    const currentDate = new Date();
    const expiresAt = new Date(voucher.expires_at);

    if (expiresAt < currentDate) {
      console.warn(`[${this.requestId}][VoucherRedemption] Voucher expired`, {
        step: 'EXPIRATION_CHECK',
        voucherId: voucher.id,
        voucherCode: voucher.voucher_code,
        expiresAt: voucher.expires_at,
        tenantId: voucher.tenant_id
      });

      throw new Error('VOUCHER_EXPIRED');
    }

    console.log(`[${this.requestId}][VoucherRedemption] Step 4: Expiration validated`, {
      step: 'EXPIRATION_CHECK',
      voucherId: voucher.id,
      expiresAt: voucher.expires_at,
      tenantId: voucher.tenant_id
    });
  }

  /**
   * Step 4: Update or create subscription (CRITICAL - MUST succeed before voucher activation)
   */
  private applySubscriptionUpdate(tenantId: number, voucher: any, normalizedCode: string): { subscriptionId: number; status: string } {
    const existingSubscription = db.prepare(`
      SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(tenantId) as any;

    const now = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    if (existingSubscription) {
      console.log(`[${this.requestId}][VoucherRedemption] Updating subscription ${existingSubscription.id} to active`, {
        step: 'SUBSCRIPTION_UPDATE',
        subscriptionId: existingSubscription.id,
        oldStatus: existingSubscription.status,
        newStatus: 'active',
        planId: voucher.plan_id
      });

      const updateResult = db.prepare(`
        UPDATE subscriptions
        SET plan_id = ?, status = 'active', current_period_start = ?, current_period_end = ?, last_voucher_code = ?, updated_at = ?
        WHERE id = ?
      `).run(voucher.plan_id, now, periodEnd, normalizedCode, now, existingSubscription.id);

      console.log(`[${this.requestId}][VoucherRedemption] SUBSCRIPTION_UPDATE result:`, {
        changes: updateResult.changes,
        lastInsertRowid: updateResult.lastInsertRowid
      });

      // CRITICAL: Verify the update actually affected a row
      if (updateResult.changes === 0) {
        console.error(`[${this.requestId}][VoucherRedemption] SUBSCRIPTION_UPDATE_FAILED - no rows affected`, {
          subscriptionId: existingSubscription.id,
          tenantId
        });
        throw new Error('SUBSCRIPTION_UPDATE_FAILED');
      }

      return { subscriptionId: existingSubscription.id, status: 'active' };
    } else {
      console.log(`[${this.requestId}][VoucherRedemption] Creating new subscription for tenant ${tenantId}`, {
        step: 'SUBSCRIPTION_CREATE',
        tenantId,
        planId: voucher.plan_id
      });

      const insertResult = db.prepare(`
        INSERT INTO subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end, last_voucher_code, created_at, updated_at)
        VALUES (?, ?, 'active', ?, ?, ?, ?, ?)
      `).run(tenantId, voucher.plan_id, now, periodEnd, normalizedCode, now, now);

      console.log(`[${this.requestId}][VoucherRedemption] SUBSCRIPTION_INSERT result:`, {
        changes: insertResult.changes,
        lastInsertRowid: insertResult.lastInsertRowid
      });

      // CRITICAL: Verify the insert actually created a row
      if (insertResult.changes === 0) {
        console.error(`[${this.requestId}][VoucherRedemption] SUBSCRIPTION_CREATE_FAILED - no rows inserted`, {
          tenantId
        });
        throw new Error('SUBSCRIPTION_UPDATE_FAILED');
      }

      return { subscriptionId: insertResult.lastInsertRowid as number, status: 'active' };
    }
  }

  /**
   * Step 5: Mark voucher as activated
   */
  private activateVoucher(voucherId: number): void {
    db.prepare(`
      UPDATE voucher_requests SET status = 'activated' WHERE id = ?
    `).run(voucherId);

    console.log(`[${this.requestId}][VoucherRedemption] Step 6: Voucher activated`, {
      step: 'VOUCHER_ACTIVATE',
      voucherId
    });
  }

  /**
   * Handle errors and return appropriate result
   */
  private handleError(error: any): VoucherRedemptionResult {
    const errorMessage = error.message || 'Unknown error';

    if (errorMessage === 'VOUCHER_NOT_FOUND') {
      return {
        success: false,
        error_code: 'NOT_FOUND',
        message: 'Code voucher introuvable ou invalide',
        httpStatus: 404
      };
    }

    if (errorMessage === 'VOUCHER_ALREADY_USED') {
      return {
        success: false,
        error_code: 'ALREADY_USED',
        message: 'Ce voucher a déjà été utilisé',
        httpStatus: 409,
        subscription_status: 'active',
        voucher_status: 'activated'
      };
    }

    if (errorMessage === 'SUBSCRIPTION_UPDATE_FAILED') {
      return {
        success: false,
        error_code: 'SUBSCRIPTION_UPDATE_FAILED',
        message: 'Erreur critique: impossible de mettre à jour l\'abonnement',
        httpStatus: 500
      };
    }

    if (errorMessage === 'VOUCHER_EXPIRED') {
      return {
        success: false,
        error_code: 'EXPIRED',
        message: 'Code voucher expiré',
        httpStatus: 400
      };
    }

    if (errorMessage === 'VOUCHER_INVALID_STATUS') {
      return {
        success: false,
        error_code: 'INVALID_STATUS',
        message: 'Voucher non validé',
        httpStatus: 400
      };
    }

    // Unexpected error
    console.error(`[${this.requestId}][VoucherRedemption] Transaction error`, {
      step: 'ERROR',
      error: errorMessage,
      stack: error.stack
    });

    return {
      success: false,
      error_code: 'INTERNAL_ERROR',
      message: 'Erreur lors de l\'activation',
      httpStatus: 500
    };
  }
}