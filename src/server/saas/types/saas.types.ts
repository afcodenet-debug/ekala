// =============================================================================
// SaaS Multi-Tenant Types
// =============================================================================
// Shared TypeScript definitions for the SaaS layer.
// Backend-agnostic: works against either SQLite (local) or Supabase (cloud).
// =============================================================================

export type PlanPeriod = 'weekly' | 'monthly' | 'annual' | 'lifetime' | 'trial';
export type TenantStatus = 'active' | 'suspended' | 'cancelled' | 'trial';
export type SubscriptionStatus = 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'trial';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer' | 'card' | 'paystack' | 'stripe' | 'other';
export type TenantRole = 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter' | 'staff';
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface Plan {
  id: number;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  period: PlanPeriod;
  duration_days: number;
  max_users: number | null;
  max_tables: number | null;
  max_products: number | null;
  max_orders_per_month: number | null;
  features: Record<string, any>;
  is_active: boolean;
  is_public: boolean;
  trial_days: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: number;
  slug: string | null;
  name: string;
  legal_name: string | null;
  owner_email: string;
  owner_phone: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  country: string;
  city: string | null;
  address: string | null;
  logo_url: string | null;
  primary_color: string;
  default_currency: string;
  default_locale: string;
  timezone: string;
  status: TenantStatus;
  is_provisioned: boolean;
  provisioned_at: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: number;
  tenant_id: number;
  plan_id: number;
  status: SubscriptionStatus;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  auto_renew: boolean;
  payment_method: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: number;
  tenant_id: number;
  subscription_id: number | null;
  plan_id: number | null;
  amount_cents: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_provider: string | null;
  provider_reference: string | null;
  provider_status: string | null;
  status: PaymentStatus;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  paid_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantUser {
  id: number;
  tenant_id: number;
  user_id: number;
  role: TenantRole;
  is_default: boolean;
  is_active: boolean;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: number;
  tenant_id: number;
  payment_id: number | null;
  subscription_id: number | null;
  invoice_number: string;
  amount_cents: number;
  currency: string;
  status: InvoiceStatus;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Computed / view types
// =============================================================================

export interface TenantWithSubscription extends Tenant {
  subscription: Subscription | null;
  plan: Plan | null;
  days_until_renewal: number | null;
  is_expired: boolean;
  is_in_grace_period: boolean;
}

export interface SubscriptionWithPlan extends Subscription {
  plan: Plan;
  tenant: Tenant;
}

export interface UsageStats {
  users_count: number;
  tables_count: number;
  products_count: number;
  orders_this_month: number;
}

// =============================================================================
// DTOs (Data Transfer Objects) for API requests
// =============================================================================

export interface CreateTenantDto {
  name: string;
  owner_email: string;
  owner_phone?: string;
  slug?: string;
  country?: string;
  city?: string;
  plan_code: string;            // e.g. 'trial_7d', 'starter_monthly'
  payment_method?: PaymentMethod;
  payment_provider?: string;
  payment_reference?: string;
}

export interface CreatePaymentDto {
  tenant_id: number;
  subscription_id?: number;
  plan_id?: number;
  amount_cents: number;
  currency?: string;
  payment_method: PaymentMethod;
  payment_provider?: string;
  provider_reference?: string;
  status?: PaymentStatus;
  period_start?: string;
  period_end?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface CreateSubscriptionDto {
  tenant_id: number;
  plan_id: number;
  payment_method?: PaymentMethod;
  payment_reference?: string;
  auto_renew?: boolean;
}

export interface UpdateSubscriptionDto {
  status?: SubscriptionStatus;
  auto_renew?: boolean;
  cancel_reason?: string;
}

// =============================================================================
// Errors
// =============================================================================

export class SaaSError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = 'SAAS_ERROR') {
    super(message);
    this.name = 'SaaSError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class TenantNotFoundError extends SaaSError {
  constructor(tenantId: number | string) {
    super(`Tenant not found: ${tenantId}`, 404, 'TENANT_NOT_FOUND');
  }
}

export class SubscriptionExpiredError extends SaaSError {
  constructor(tenantId: number) {
    super(`Subscription expired for tenant ${tenantId}`, 402, 'SUBSCRIPTION_EXPIRED');
  }
}

export class PlanNotFoundError extends SaaSError {
  constructor(code: string) {
    super(`Plan not found: ${code}`, 404, 'PLAN_NOT_FOUND');
  }
}

export class QuotaExceededError extends SaaSError {
  constructor(quota: string, limit: number, current: number) {
    super(`Quota exceeded for ${quota}: ${current}/${limit}`, 402, 'QUOTA_EXCEEDED');
  }
}
