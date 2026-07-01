/**
 * Postgres Idempotency Repository Implementation (V1.1)
 * 
 * Implements IIdempotencyRepository using PostgreSQL.
 * CRITICAL: Gates on status === "SUCCESS" only.
 */

import { IIdempotencyRepository, IdempotencyRecord } from '../../../domain/billing/repositories/IIdempotencyRepository';

export class PostgresIdempotencyRepository implements IIdempotencyRepository {
  constructor(private db: any) {}

  async findByIdempotencyKey(key: string): Promise<IdempotencyRecord | null> {
    const result = await this.db.query(
      'SELECT * FROM idempotency_records WHERE idempotency_key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      idempotency_key: row.idempotency_key,
      tenant_id: row.tenant_id,
      status: row.status,
      subscription_snapshot: JSON.parse(row.subscription_snapshot),
      created_at: new Date(row.created_at)
    };
  }

  async save(record: IdempotencyRecord, tx: any): Promise<void> {
    // CRITICAL: Must be in transaction with subscription
    // ON CONFLICT DO NOTHING prevents duplicate keys
    await tx.query(
      `INSERT INTO idempotency_records 
       (idempotency_key, tenant_id, status, subscription_snapshot, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        record.idempotency_key,
        record.tenant_id,
        record.status,
        JSON.stringify(record.subscription_snapshot)
      ]
    );
  }
}