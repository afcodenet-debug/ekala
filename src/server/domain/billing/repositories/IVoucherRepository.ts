/**
 * Voucher Repository Interface (V1.1)
 * 
 * Handles persistence operations for Voucher aggregate.
 * CRITICAL: Vouchers can only be used once (atomic claim).
 */

import { Voucher } from '../voucher/Voucher';

export interface IVoucherRepository {
  /**
   * Find voucher by code
   * @param code - Voucher code
   * @param tx - Optional transaction context
   * @returns Voucher or null if not found
   */
  findByCode(code: string, tx?: any): Promise<Voucher | null>;

  /**
   * ATOMIC CLAIM: Mark voucher as used and return it
   * CRITICAL: This is the ONLY way to use a voucher
   * Uses UPDATE ... WHERE status = 'ACTIVE' AND expires_at > NOW()
   * to prevent race conditions and double-spend
   * 
   * @param code - Voucher code
   * @param tenantId - Tenant who is using the voucher
   * @param tx - Transaction context (required)
   * @returns Voucher if successfully claimed, null if already used/expired
   */
  claimVoucher(code: string, tenantId: string, tx: any): Promise<Voucher | null>;

  /**
   * Save voucher (for admin creation)
   * @param voucher - Voucher to save
   * @param tx - Optional transaction context
   */
  save(voucher: Voucher, tx?: any): Promise<void>;
}