// =============================================================================
// SqliteSubscriptionRepository — Implémentation SQLite
// =============================================================================
// Architecture V2.1 — Repository Pattern
// Implémentation concrète de ISubscriptionRepository pour SQLite
// =============================================================================

import { db } from '../../../db/database';
import {
  ISubscriptionRepository,
  Subscription,
  Voucher,
  Plan,
  SubscriptionSummary,
  VoucherSummary,
  SubscriptionStats,
  VoucherStats,
  SubscriptionNotFoundError,
  VoucherNotFoundError,
  ConcurrentUpdateError,
  BusinessRuleViolationError,
} from '../../../domain/subscription/repositories/ISubscriptionRepository';
import { SubscriptionStatus } from '../../../domain/subscription/value-objects/SubscriptionStatus';
import { VoucherStatus } from '../../../domain/subscription/value-objects/VoucherStatus';

// =============================================================================
// Mappers : SQLite rows → Domain entities
// =============================================================================

/**
 * Mappe une ligne SQLite vers Subscription
 */
function mapRowToSubscription(row: any): Subscription {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planId: row.plan_id,
    status: SubscriptionStatus.fromString(row.status),
    entityVersion: row.entity_version,
    originNode: row.origin_node,
    logicalClock: row.logical_clock,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    cancelledAt: row.cancelled_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Mappe une ligne SQLite vers Voucher
 */
function mapRowToVoucher(row: any): Voucher {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planId: row.plan_id,
    status: VoucherStatus.fromString(row.status),
    amount: row.amount,
    paymentReference: row.payment_reference,
    paymentProof: row.payment_proof || undefined,
    verifiedBy: row.verified_by || undefined,
    verifiedAt: row.verified_at || undefined,
    rejectedBy: row.rejected_by || undefined,
    rejectedAt: row.rejected_at || undefined,
    rejectionReason: row.rejection_reason || undefined,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Mappe une ligne SQLite vers Plan
 */
function mapRowToPlan(row: any): Plan {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    price: row.price,
    currency: row.currency,
    interval: row.interval,
    intervalCount: row.interval_count,
    features: JSON.parse(row.features || '[]'),
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// =============================================================================
// SqliteSubscriptionRepository
// =============================================================================

export class SqliteSubscriptionRepository implements ISubscriptionRepository {
  // =============================================================================
  // Subscription Operations
  // =============================================================================

  async createSubscription(subscription: {
    tenantId: number;
    planId: number;
    status: SubscriptionStatus;
    startsAt: string;
    endsAt: string;
    originNode: string;
  }): Promise<Subscription> {
    const result = await db.execute(
      `INSERT INTO subscriptions (
        tenant_id, plan_id, status, entity_version, origin_node, logical_clock,
        starts_at, ends_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subscription.tenantId,
        subscription.planId,
        subscription.status.toString(),
        1, // entity_version
        subscription.originNode,
        0, // logical_clock
        subscription.startsAt,
        subscription.endsAt,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    const id = result.lastInsertRowId as number;
    const row = await db.queryOne('SELECT * FROM subscriptions WHERE id = ?', [id]);
    
    if (!row) {
      throw new Error('Failed to retrieve created subscription');
    }

    return mapRowToSubscription(row);
  }

  async findSubscriptionById(id: number): Promise<Subscription | null> {
    const row = await db.queryOne('SELECT * FROM subscriptions WHERE id = ?', [id]);
    return row ? mapRowToSubscription(row) : null;
  }

  async findActiveSubscriptionByTenantId(tenantId: number): Promise<Subscription | null> {
    const row = await db.queryOne(
      `SELECT * FROM subscriptions 
       WHERE tenant_id = ? 
       AND status IN ('active', 'trial', 'grace')
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId]
    );
    return row ? mapRowToSubscription(row) : null;
  }

  async findAllSubscriptionsByTenantId(tenantId: number): Promise<Subscription[]> {
    const rows = await db.query(
      'SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId]
    );
    return rows.map(mapRowToSubscription);
  }

  async updateSubscription(
    id: number,
    updates: {
      status?: SubscriptionStatus;
      endsAt?: string;
      cancelledAt?: string;
    },
    expectedVersion: number
  ): Promise<Subscription> {
    // Vérifier que l'abonnement existe
    const existing = await this.findSubscriptionById(id);
    if (!existing) {
      throw new SubscriptionNotFoundError(id);
    }

    // Optimistic locking
    if (existing.entityVersion !== expectedVersion) {
      throw new ConcurrentUpdateError(expectedVersion, existing.entityVersion);
    }

    // Construire la requête UPDATE dynamiquement
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.status) {
      setClauses.push('status = ?');
      values.push(updates.status.toString());
    }
    if (updates.endsAt) {
      setClauses.push('ends_at = ?');
      values.push(updates.endsAt);
    }
    if (updates.cancelledAt) {
      setClauses.push('cancelled_at = ?');
      values.push(updates.cancelledAt);
    }

    // Toujours mettre à jour updated_at et entity_version
    setClauses.push('updated_at = ?');
    setClauses.push('entity_version = ?');
    values.push(new Date().toISOString(), expectedVersion + 1);

    values.push(id);

    await db.execute(
      `UPDATE subscriptions SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await this.findSubscriptionById(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated subscription');
    }

    return updated;
  }

  async deleteSubscription(id: number): Promise<void> {
    const existing = await this.findSubscriptionById(id);
    if (!existing) {
      throw new SubscriptionNotFoundError(id);
    }

    await db.execute('DELETE FROM subscriptions WHERE id = ?', [id]);
  }

  async countActiveSubscriptions(): Promise<number> {
    const row = await db.queryOne(
      `SELECT COUNT(*) as count FROM subscriptions 
       WHERE status IN ('active', 'trial', 'grace')`,
      []
    );
    return row?.count || 0;
  }

  // =============================================================================
  // Voucher Operations
  // =============================================================================

  async createVoucher(voucher: {
    tenantId: number;
    planId: number;
    amount: number;
    paymentReference: string;
    paymentProof?: string;
    expiresAt: string;
  }): Promise<Voucher> {
    const result = await db.execute(
      `INSERT INTO vouchers (
        tenant_id, plan_id, status, amount, payment_reference, payment_proof,
        expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        voucher.tenantId,
        voucher.planId,
        VoucherStatus.pending().toString(),
        voucher.amount,
        voucher.paymentReference,
        voucher.paymentProof || null,
        voucher.expiresAt,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    const id = result.lastInsertRowId as number;
    const row = await db.queryOne('SELECT * FROM vouchers WHERE id = ?', [id]);
    
    if (!row) {
      throw new Error('Failed to retrieve created voucher');
    }

    return mapRowToVoucher(row);
  }

  async findVoucherById(id: number): Promise<Voucher | null> {
    const row = await db.queryOne('SELECT * FROM vouchers WHERE id = ?', [id]);
    return row ? mapRowToVoucher(row) : null;
  }

  async findVoucherByPaymentReference(paymentReference: string): Promise<Voucher | null> {
    const row = await db.queryOne(
      'SELECT * FROM vouchers WHERE payment_reference = ?',
      [paymentReference]
    );
    return row ? mapRowToVoucher(row) : null;
  }

  async findAllVouchersByTenantId(tenantId: number): Promise<Voucher[]> {
    const rows = await db.query(
      'SELECT * FROM vouchers WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId]
    );
    return rows.map(mapRowToVoucher);
  }

  async findPendingVouchers(): Promise<Voucher[]> {
    const rows = await db.query(
      `SELECT * FROM vouchers 
       WHERE status IN ('pending', 'payment_sent')
       ORDER BY created_at ASC`,
      []
    );
    return rows.map(mapRowToVoucher);
  }

  async updateVoucher(
    id: number,
    updates: {
      status?: VoucherStatus;
      verifiedBy?: number;
      verifiedAt?: string;
      rejectedBy?: number;
      rejectedAt?: string;
      rejectionReason?: string;
    }
  ): Promise<Voucher> {
    const existing = await this.findVoucherById(id);
    if (!existing) {
      throw new VoucherNotFoundError(id);
    }

    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.status) {
      setClauses.push('status = ?');
      values.push(updates.status.toString());
    }
    if (updates.verifiedBy) {
      setClauses.push('verified_by = ?');
      values.push(updates.verifiedBy);
    }
    if (updates.verifiedAt) {
      setClauses.push('verified_at = ?');
      values.push(updates.verifiedAt);
    }
    if (updates.rejectedBy) {
      setClauses.push('rejected_by = ?');
      values.push(updates.rejectedBy);
    }
    if (updates.rejectedAt) {
      setClauses.push('rejected_at = ?');
      values.push(updates.rejectedAt);
    }
    if (updates.rejectionReason) {
      setClauses.push('rejection_reason = ?');
      values.push(updates.rejectionReason);
    }

    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await db.execute(
      `UPDATE vouchers SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await this.findVoucherById(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated voucher');
    }

    return updated;
  }

  async countVouchersByStatus(status: VoucherStatus): Promise<number> {
    const row = await db.queryOne(
      'SELECT COUNT(*) as count FROM vouchers WHERE status = ?',
      [status.toString()]
    );
    return row?.count || 0;
  }

  // =============================================================================
  // Plan Operations
  // =============================================================================

  async findPlanById(id: number): Promise<Plan | null> {
    const row = await db.queryOne('SELECT * FROM plans WHERE id = ?', [id]);
    return row ? mapRowToPlan(row) : null;
  }

  async findAllActivePlans(): Promise<Plan[]> {
    const rows = await db.query(
      'SELECT * FROM plans WHERE is_active = 1 ORDER BY price ASC',
      []
    );
    return rows.map(mapRowToPlan);
  }

  async findAllPlans(): Promise<Plan[]> {
    const rows = await db.query('SELECT * FROM plans ORDER BY price ASC', []);
    return rows.map(mapRowToPlan);
  }

  // =============================================================================
  // Query Methods (Read Model)
  // =============================================================================

  async findSubscriptionSummaries(
    offset: number,
    limit: number
  ): Promise<SubscriptionSummary[]> {
    const rows = await db.query(
      `SELECT 
        s.id, s.tenant_id as tenantId, p.name as planName, s.status,
        s.starts_at as startsAt, s.ends_at as endsAt,
        CAST((julianday(s.ends_at) - julianday('now')) AS INTEGER) as daysRemaining,
        s.status IN ('active', 'trial', 'grace') as isActive
       FROM subscriptions s
       LEFT JOIN plans p ON s.plan_id = p.id
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    ) as any[];

    return rows.map(row => ({
      id: row.id,
      tenantId: row.tenantId,
      planName: row.planName,
      status: SubscriptionStatus.fromString(row.status),
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      daysRemaining: row.daysRemaining,
      isActive: row.isActive === 1,
    }));
  }

  async findVoucherSummaries(
    offset: number,
    limit: number
  ): Promise<VoucherSummary[]> {
    const rows = await db.query(
      `SELECT 
        v.id, v.tenant_id as tenantId, t.name as tenantName, p.name as planName,
        v.status, v.amount, v.created_at as createdAt, v.expires_at as expiresAt,
        julianday(v.expires_at) < julianday('now') as isExpired
       FROM vouchers v
       LEFT JOIN tenants t ON v.tenant_id = t.id
       LEFT JOIN plans p ON v.plan_id = p.id
       ORDER BY v.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    ) as any[];

    return rows.map(row => ({
      id: row.id,
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      planName: row.planName,
      status: VoucherStatus.fromString(row.status),
      amount: row.amount,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      isExpired: row.isExpired === 1,
    }));
  }

  async getSubscriptionStats(): Promise<SubscriptionStats> {
    const stats = await db.queryOne(
      `SELECT 
        COUNT(CASE WHEN status = 'active' THEN 1 END) as totalActive,
        COUNT(CASE WHEN status = 'trial' THEN 1 END) as totalTrialing,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as totalExpired,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as totalCancelled
       FROM subscriptions`,
      []
    );

    // Calculer le revenu total (somme des plans actifs)
    const revenue = await db.queryOne(
      `SELECT SUM(p.price) as totalRevenue
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.status IN ('active', 'trial', 'grace')`,
      []
    );

    const totalRevenue = revenue?.totalRevenue || 0;
    const totalActive = stats?.totalActive || 0;
    const totalTrialing = stats?.totalTrialing || 0;

    return {
      totalActive,
      totalTrialing,
      totalExpired: stats?.totalExpired || 0,
      totalCancelled: stats?.totalCancelled || 0,
      totalRevenue,
      averageRevenuePerUser: (totalActive + totalTrialing) > 0 
        ? totalRevenue / (totalActive + totalTrialing) 
        : 0,
    };
  }

  async getVoucherStats(): Promise<VoucherStats> {
    const stats = await db.queryOne(
      `SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as totalPending,
        COUNT(CASE WHEN status = 'verified' THEN 1 END) as totalVerified,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as totalRejected,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as totalExpired
       FROM vouchers`,
      []
    );

    // Calculer les montants
    const amounts = await db.queryOne(
      `SELECT 
        SUM(CASE WHEN status = 'pending' OR status = 'payment_sent' THEN amount ELSE 0 END) as pendingAmount,
        SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END) as totalRevenue
       FROM vouchers`,
      []
    );

    return {
      totalPending: stats?.totalPending || 0,
      totalVerified: stats?.totalVerified || 0,
      totalRejected: stats?.totalRejected || 0,
      totalExpired: stats?.totalExpired || 0,
      totalRevenue: amounts?.totalRevenue || 0,
      pendingAmount: amounts?.pendingAmount || 0,
    };
  }

  // =============================================================================
  // Transaction Support
  // =============================================================================

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return db.transaction(fn);
  }
}

// =============================================================================
// Factory
// =============================================================================

export class SqliteSubscriptionRepositoryFactory {
  static create(): ISubscriptionRepository {
    return new SqliteSubscriptionRepository();
  }
}