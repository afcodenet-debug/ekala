/**
 * Postgres Subscription Repository Implementation (V1.1)
 * 
 * Implements ISubscriptionRepository using PostgreSQL.
 * Uses transactions for atomic operations.
 */

import { ISubscriptionRepository } from '../../../domain/billing/repositories/ISubscriptionRepository';
import { Subscription } from '../../../domain/billing/subscription/Subscription';

export class PostgresSubscriptionRepository implements ISubscriptionRepository {
  constructor(private db: any) {}

  async findByTenantId(tenantId: string, tx?: any): Promise<Subscription | null> {
    const query = tx || this.db;
    const result = await query.query(
      'SELECT * FROM subscriptions WHERE tenant_id = $1',
      [tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSubscription(result.rows[0]);
  }

  async findByTenantIdForUpdate(tenantId: string, tx: any): Promise<Subscription | null> {
    // CRITICAL: SELECT ... FOR UPDATE to lock the row
    const result = await tx.query(
      'SELECT * FROM subscriptions WHERE tenant_id = $1 FOR UPDATE',
      [tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSubscription(result.rows[0]);
  }

  async upsert(data: Partial<Subscription>, tx: any): Promise<void> {
    // CRITICAL: UPSERT guarantees 1 subscription per tenant
    await tx.query(
      `INSERT INTO subscriptions 
       (tenant_id, plan, status, start_date, end_date, activation_source, activation_reference, activated_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (tenant_id) 
       DO UPDATE SET
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         activation_source = EXCLUDED.activation_source,
         activation_reference = EXCLUDED.activation_reference,
         activated_at = EXCLUDED.activated_at,
         updated_at = NOW()`,
      [
        data.tenant_id,
        data.plan,
        data.status,
        data.start_date,
        data.end_date,
        data.activation_source,
        data.activation_reference,
        data.activated_at
      ]
    );
  }

  async save(subscription: Subscription, tx?: any): Promise<void> {
    const query = tx || this.db;
    
    await query.query(
      `INSERT INTO subscriptions 
       (tenant_id, plan, status, start_date, end_date, activation_source, activation_reference, activated_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (tenant_id) 
       DO UPDATE SET
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         activation_source = EXCLUDED.activation_source,
         activation_reference = EXCLUDED.activation_reference,
         activated_at = EXCLUDED.activated_at,
         updated_at = NOW()`,
      [
        subscription.tenant_id,
        subscription.plan,
        subscription.status,
        subscription.start_date,
        subscription.end_date,
        subscription.activation_source,
        subscription.activation_reference,
        subscription.activated_at,
        subscription.created_at,
        subscription.updated_at
      ]
    );
  }

  private mapRowToSubscription(row: any): Subscription {
    return new Subscription(
      row.tenant_id,
      row.plan,
      row.status,
      new Date(row.start_date),
      new Date(row.end_date),
      row.activation_source,
      row.activation_reference,
      new Date(row.activated_at),
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }
}