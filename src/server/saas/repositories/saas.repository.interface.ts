// =============================================================================
// SaaS Repository Interfaces
// =============================================================================
// Abstraction layer between the SaaS services and the underlying database.
// Two implementations:
//   - SaaSSqliteRepository   (used by the local POS, single-tenant-by-config)
//   - SaaSSupabaseRepository (used by the cloud backend, multi-tenant)
// =============================================================================

import type {
  Plan,
  Tenant,
  Subscription,
  Payment,
  TenantUser,
  Invoice,
  CreateTenantDto,
  CreatePaymentDto,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
} from '../types/saas.types';

export interface IPlanRepository {
  listPublic(): Promise<Plan[]>;
  listAll(): Promise<Plan[]>;
  findByCode(code: string): Promise<Plan | null>;
  findById(id: number): Promise<Plan | null>;
}

export interface ITenantRepository {
  create(dto: CreateTenantDto, plan: Plan, subscription: Subscription, ownerUserId?: number): Promise<Tenant>;
  findById(id: number): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  findByOwnerEmail(email: string): Promise<Tenant[]>;
  listAll(): Promise<Tenant[]>;
  update(id: number, updates: Partial<Tenant>): Promise<Tenant>;
  suspend(id: number, reason?: string): Promise<Tenant>;
  cancel(id: number, reason?: string): Promise<Tenant>;
  activate(id: number): Promise<Tenant>;
  markProvisioned(id: number): Promise<void>;
  // Audit
  logAction(tenantId: number, action: string, entityType: string | null, entityId: number | null, actorUserId: number | null, metadata?: any): Promise<void>;
  getAuditLog(tenantId: number, limit?: number): Promise<any[]>;
}

export interface ISubscriptionRepository {
  create(dto: CreateSubscriptionDto): Promise<Subscription>;
  findActive(tenantId: number): Promise<Subscription | null>;
  findById(id: number): Promise<Subscription | null>;
  listForTenant(tenantId: number): Promise<Subscription[]>;
  listExpiring(beforeDate: Date): Promise<Subscription[]>;
  listExpired(): Promise<Subscription[]>;
  update(id: number, updates: UpdateSubscriptionDto): Promise<Subscription>;
  cancel(id: number, reason?: string): Promise<Subscription>;
  renew(id: number, periodStart: Date, periodEnd: Date): Promise<Subscription>;
  markExpired(): Promise<number>; // returns number of subscriptions marked
}

export interface IPaymentRepository {
  create(dto: CreatePaymentDto): Promise<Payment>;
  findById(id: number): Promise<Payment | null>;
  listForTenant(tenantId: number, limit?: number): Promise<Payment[]>;
  listForSubscription(subscriptionId: number): Promise<Payment[]>;
  listPending(): Promise<Payment[]>;
  update(id: number, updates: Partial<Payment>): Promise<Payment>;
  markCompleted(id: number, providerReference?: string): Promise<Payment>;
  markFailed(id: number, reason: string): Promise<Payment>;
  totalRevenueForTenant(tenantId: number): Promise<number>;
  totalRevenue(startDate?: Date, endDate?: Date): Promise<number>;
}

export interface ITenantUserRepository {
  addUser(tenantId: number, userId: number, role?: string, isDefault?: boolean): Promise<TenantUser>;
  removeUser(tenantId: number, userId: number): Promise<void>;
  updateRole(tenantId: number, userId: number, role: string): Promise<TenantUser>;
  findUserTenants(userId: number): Promise<Tenant[]>;
  findTenantUsers(tenantId: number): Promise<TenantUser[]>;
  setDefaultTenant(userId: number, tenantId: number): Promise<void>;
  isUserInTenant(userId: number, tenantId: number): Promise<boolean>;
}

export interface IInvoiceRepository {
  create(tenantId: number, paymentId: number | null, subscriptionId: number | null, amountCents: number, currency: string, status?: string): Promise<Invoice>;
  findByNumber(invoiceNumber: string): Promise<Invoice | null>;
  findById(id: number): Promise<Invoice | null>;
  listForTenant(tenantId: number, limit?: number): Promise<Invoice[]>;
  markPaid(id: number): Promise<Invoice>;
  generateInvoiceNumber(): Promise<string>;
}

// =============================================================================
// Composite interface (the full SaaS repository bundle)
// =============================================================================

export interface ISaaSRepository {
  plans: IPlanRepository;
  tenants: ITenantRepository;
  subscriptions: ISubscriptionRepository;
  payments: IPaymentRepository;
  tenantUsers: ITenantUserRepository;
  invoices: IInvoiceRepository;
}
