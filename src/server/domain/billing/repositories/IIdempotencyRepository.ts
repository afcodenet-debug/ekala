/**
 * Idempotency Repository Interface (V1.1)
 * 
 * Handles idempotency records for safe API retries.
 * CRITICAL: Gates on status === "SUCCESS" only.
 */

export interface IdempotencyRecord {
  idempotency_key: string;
  tenant_id: string;
  status: 'SUCCESS' | 'FAILED';
  subscription_snapshot: {
    tenant_id: string;
    plan: string;
    status: string;
    end_date: Date;
    activation_source: string;
  };
  created_at: Date;
}

export interface IIdempotencyRepository {
  /**
   * Find idempotency record by key
   * @param key - Idempotency key
   * @returns IdempotencyRecord or null if not found
   */
  findByIdempotencyKey(key: string): Promise<IdempotencyRecord | null>;

  /**
   * Save idempotency record
   * CRITICAL: Must be saved in transaction with subscription
   * @param record - Idempotency record to save
   * @param tx - Transaction context (required)
   */
  save(record: IdempotencyRecord, tx: any): Promise<void>;
}