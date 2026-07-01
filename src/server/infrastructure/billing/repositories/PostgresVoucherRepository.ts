/**
 * Postgres Voucher Repository Implementation (V1.1)
 * 
 * Implements IVoucherRepository using PostgreSQL.
 * CRITICAL: Atomic claim prevents double-spend.
 */

import { IVoucherRepository } from '../../../domain/billing/repositories/IVoucherRepository';
import { Voucher } from '../../../domain/billing/voucher/Voucher';

export class PostgresVoucherRepository implements IVoucherRepository {
  constructor(private db: any) {}

  async findByCode(code: string, tx?: any): Promise<Voucher | null> {
    const query = tx || this.db;
    const result = await query.query(
      'SELECT * FROM vouchers WHERE code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToVoucher(result.rows[0]);
  }

  async claimVoucher(code: string, tenantId: string, tx: any): Promise<Voucher | null> {
    // CRITICAL: ATOMIC CLAIM
    // Updates voucher status to 'USED' ONLY if it's currently 'ACTIVE' and not expired
    // This prevents race conditions and double-spend
    const result = await tx.query(
      `UPDATE vouchers 
       SET status = 'USED', 
           tenant_id = $1, 
           used_at = NOW()
       WHERE code = $2 
         AND status = 'ACTIVE' 
         AND expires_at > NOW()
       RETURNING *`,
      [tenantId, code]
    );

    if (result.rows.length === 0) {
      return null; // Already used, expired, or doesn't exist
    }

    return this.mapRowToVoucher(result.rows[0]);
  }

  async save(voucher: Voucher, tx?: any): Promise<void> {
    const query = tx || this.db;
    
    await query.query(
      `INSERT INTO vouchers 
       (code, plan, duration_days, status, expires_at, tenant_id, used_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (code) DO NOTHING`,
      [
        voucher.code,
        voucher.plan,
        voucher.duration_days,
        voucher.status,
        voucher.expires_at,
        voucher.tenant_id,
        voucher.used_at,
        voucher.created_at
      ]
    );
  }

  private mapRowToVoucher(row: any): Voucher {
    return new Voucher(
      row.code,
      row.plan,
      row.duration_days,
      row.status,
      new Date(row.expires_at),
      row.tenant_id,
      row.used_at ? new Date(row.used_at) : undefined,
      new Date(row.created_at)
    );
  }
}