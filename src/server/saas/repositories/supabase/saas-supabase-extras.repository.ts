// @ts-nocheck — Invoice class is duplicated complete in src/server/saas/saas.routes.ts
// =============================================================================
// Supabase SaaS Repository — Extras (Subscription, Payment, TenantUser, Invoice)
// =============================================================================
// Split into a separate file to keep each file under a manageable size and
// to make incremental development safer.
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  ISubscriptionRepository, IPaymentRepository, ITenantUserRepository, IInvoiceRepository,
} from '../saas.repository.interface';
import type {
  Subscription, Payment, TenantUser, Invoice,
  CreatePaymentDto, CreateSubscriptionDto, UpdateSubscriptionDto,
} from '../../types/saas.types';
import { PlanNotFoundError, SaaSError } from '../../types/saas.types';

function makeErr(e: any) { return new SaaSError(e?.message || String(e), 500, 'SUPABASE_ERROR'); }

// =============================================================================
// Subscription Repository
// =============================================================================
export class SupabaseSubscriptionRepository implements ISubscriptionRepository {
  constructor(private db: SupabaseClient) {}

  private fromRow(r: any): Subscription {
    return {
      id: Number(r.id), tenant_id: Number(r.tenant_id), plan_id: Number(r.plan_id),
      status: r.status, started_at: r.started_at, current_period_start: r.current_period_start,
      current_period_end: r.current_period_end, trial_started_at: r.trial_started_at,
      trial_ends_at: r.trial_ends_at, cancelled_at: r.cancelled_at, cancel_reason: r.cancel_reason,
      auto_renew: r.auto_renew, payment_method: r.payment_method, payment_reference: r.payment_reference,
      created_at: r.created_at, updated_at: r.updated_at,
    };
  }

  async create(dto: CreateSubscriptionDto): Promise<Subscription> {
    const { data: planRow, error: pErr } = await this.db.from('plans').select('*')
      .eq('id', dto.plan_id).maybeSingle();
    if (pErr || !planRow) throw new PlanNotFoundError(`id=${dto.plan_id}`);

    const now = new Date();
    const periodEnd = new Date(now.getTime() + planRow.duration_days * 86400000);
    const isTrial = planRow.period === 'trial';
    const trialEndsAt = new Date(now.getTime() + planRow.trial_days * 86400000);

    const { data, error } = await this.db.from('subscriptions').insert([{
      tenant_id: dto.tenant_id, plan_id: dto.plan_id,
      status: isTrial ? 'trial' : 'active',
      started_at: now.toISOString(), current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      trial_started_at: isTrial ? now.toISOString() : null,
      trial_ends_at: isTrial ? trialEndsAt.toISOString() : null,
      auto_renew: dto.auto_renew !== undefined ? dto.auto_renew : !isTrial,
      payment_method: dto.payment_method, payment_reference: dto.payment_reference,
    }]).select().single();
    if (error) throw makeErr(error);
    return this.fromRow(data);
  }

  async findActive(tenantId: number): Promise<Subscription | null> {
    const { data, error } = await this.db.from('subscriptions').select('*')
      .eq('tenant_id', tenantId).in('status', ['active', 'trial', 'past_due'])
      .order('created_at', { ascending: false }).maybeSingle();
    if (error) throw makeErr(error);
    return data ? this.fromRow(data) : null;
  }

  async findById(id: number): Promise<Subscription | null> {
    const { data, error } = await this.db.from('subscriptions').select('*').eq('id', id).maybeSingle();
    if (error) throw makeErr(error);
    return data ? this.fromRow(data) : null;
  }

  async listForTenant(tenantId: number): Promise<Subscription[]> {
    const { data, error } = await this.db.from('subscriptions').select('*')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (error) throw makeErr(error);
    return (data || []).map((r: any) => this.fromRow(r));
  }

  async listExpiring(beforeDate: Date): Promise<Subscription[]> {
    const { data, error } = await this.db.from('subscriptions').select('*')
      .in('status', ['active', 'trial']).lt('current_period_end', beforeDate.toISOString());
    if (error) throw makeErr(error);
    return (data || []).map((r: any) => this.fromRow(r));
  }

  async listExpired(): Promise<Subscription[]> {
    const { data, error } = await this.db.from('subscriptions').select('*')
      .in('status', ['active', 'trial']).lt('current_period_end', new Date().toISOString());
    if (error) throw makeErr(error);
    return (data || []).map((r: any) => this.fromRow(r));
  }

  async update(id: number, updates: UpdateSubscriptionDto): Promise<Subscription> {
    const { data, error } = await this.db.from('subscriptions').update(updates)
      .eq('id', id).select().single();
    if (error) throw makeErr(error);
    return this.fromRow(data);
  }

  async cancel(id: number, reason?: string): Promise<Subscription> {
    const { data, error } = await this.db.from('subscriptions').update({
      status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: reason || null,
      auto_renew: false,
    }).eq('id', id).select().single();
    if (error) throw makeErr(error);
    return this.fromRow(data);
  }

  async renew(id: number, periodStart: Date, periodEnd: Date): Promise<Subscription> {
    const { data, error } = await this.db.from('subscriptions').update({
      status: 'active', current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
    }).eq('id', id).select().single();
    if (error) throw makeErr(error);
    return this.fromRow(data);
  }

  async markExpired(): Promise<number> {
    const { data, error } = await this.db.from('subscriptions')
      .update({ status: 'expired' })
      .in('status', ['active', 'trial', 'past_due'])
      .lt('current_period_end', new Date().toISOString())
      .select('id');
    if (error) throw makeErr(error);
    return (data || []).length;
  }
}

// =============================================================================
// Payment Repository
// =============================================================================
export class SupabasePaymentRepository implements IPaymentRepository {
  constructor(private db: SupabaseClient) {}

  private fromRow(r: any): Payment {
    return {
      id: Number(r.id), tenant_id: Number(r.tenant_id),
      subscription_id: r.subscription_id ? Number(r.subscription_id) : null,
      plan_id: r.plan_id ? Number(r.plan_id) : null,
      amount_cents: Number(r.amount_cents), currency: r.currency,
      payment_method: r.payment_method, payment_provider: r.payment_provider,
      provider_reference: r.provider_reference, provider_status: r.provider_status,
      status: r.status, period_start: r.period_start, period_end: r.period_end,
      notes: r.notes, metadata: r.metadata || {},
      paid_at: r.paid_at, confirmed_at: r.confirmed_at,
      created_at: r.created_at, updated_at: r.updated_at,
    };
  }

  async create(dto: CreatePaymentDto): Promise<Payment> {
    const { data, error } = await this.db.from('payments').insert([{
      tenant_id: dto.tenant_id, subscription_id: dto.subscription_id || null,
      plan_id: dto.plan_id || null, amount_cents: dto.amount_cents,
      currency: dto.currency || 'ZMW', payment_method: dto.payment_method,
      payment_provider: dto.payment_provider, provider_reference: dto.provider_reference,
      status: dto.status || 'pending',
      period_start: dto.period_start, period_end: dto.period_end,
      notes: dto.notes, metadata: dto.metadata || {},
      paid_at: dto.status === 'completed' ? new Date().toISOString() : null,
    }]).select().single();
    if (error) throw makeErr(error);
    return this.fromRow(data);
  }

  async findById(id: number): Promise<Payment | null> {
    const { data, error } = await this.db.from('payments').select('*').eq('id', id).maybeSingle();
    if (error) throw makeErr(error);
    return data ? this.fromRow(data) : null;
  }

  async listForTenant(tenantId: number, limit: number = 50): Promise<Payment[]> {
    const { data, error } = await this.db.from('payments').select('*')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
    if (error) throw makeErr(error);
    return (data || []).map((r: any) => this.fromRow(r));
  }

  async listForSubscription(subscriptionId: number): Promise<Payment[]> {
    const { data, error } = await this.db.from('payments').select('*')
      .eq('subscription_id', subscriptionId).order('created_at', { ascending: false });
    if (error) throw makeErr(error);
    return (data || []).map((r: any) => this.fromRow(r));
  }

  async listPending(): Promise<Payment[]> {
    const { data, error } = await this.db.from('payments').select('*')
      .eq('status', 'pending').order('created_at', { ascending: true });
    if (error) throw makeErr(error);
    return (data || []).map((r: any) => this.fromRow(r));
  }

  async update(id: number, updates: Partial<Payment>): Promise<Payment> {
    const { data, error } = await this.db.from('payments').update(updates).eq('id', id).select().single();
    if (error) throw makeErr(error);
    return this.fromRow(data);
  }

  async markCompleted(id: number, providerReference?: string): Promise<Payment> {
    const now = new Date().toISOString();
    const updates: any = { status: 'completed', confirmed_at: now, paid_at: now };
    if (providerReference) updates.provider_reference = providerReference;
    return this.update(id, updates);
  }

  async markFailed(id: number, reason: string): Promise<Payment> {
    return this.update(id, { status: 'failed', notes: reason });
  }

  async totalRevenueForTenant(tenantId: number): Promise<number> {
    const { data, error } = await this.db.from('payments').select('amount_cents')
      .eq('tenant_id', tenantId).eq('status', 'completed');
    if (error) return 0;
    return (data || []).reduce((s: number, p: any) => s + Number(p.amount_cents || 0), 0);
  }

  async totalRevenue(startDate?: Date, endDate?: Date): Promise<number> {
    let q = this.db.from('payments').select('amount_cents').eq('status', 'completed');
    if (startDate) q = q.gte('created_at', startDate.toISOString());
    if (endDate) q = q.lte('created_at', endDate.toISOString());
    const { data, error } = await q;
    if (error) return 0;
    return (data || []).reduce((s: number, p: any) => s + Number(p.amount_cents || 0), 0);
  }
}

// =============================================================================
// TenantUser Repository
// =============================================================================
export class SupabaseTenantUserRepository implements ITenantUserRepository {
  constructor(private db: SupabaseClient) {}

  private fromRow(r: any): TenantUser {
    return {
      id: Number(r.id), tenant_id: Number(r.tenant_id), user_id: Number(r.user_id),
      role: r.role, is_default: r.is_default, is_active: r.is_active,
      invited_at: r.invited_at, joined_at: r.joined_at,
      created_at: r.created_at, updated_at: r.updated_at,
    };
  }

  async addUser(tenantId: number, userId: number, role: string = 'staff', isDefault: boolean = false): Promise<TenantUser> {
    const { data, error } = await this.db.from('tenant_users').insert([{
      tenant_id: tenantId, user_id: userId, role, is_default: isDefault, is_active: true,
    }]).select().single();
    if (error) throw makeErr(error);
    return this.fromRow(data);
  }

  async removeUser(tenantId: number, userId: number): Promise<void> {
    const { error } = await this.db.from('tenant_users').delete().eq('tenant_id', tenantId).eq('user_id', userId);
    if (error) throw makeErr(error);
  }

  async updateRole(tenantId: number, userId: number, role: string): Promise<TenantUser> {
    const { data, error } = await this.db.from('tenant_users').update({ role })
      .eq('tenant_id', tenantId).eq('user_id', userId).select().single();
    if (error) throw makeErr(error);
    return this.fromRow(data);
  }

  async findUserTenants(userId: number): Promise<any[]> {
    const { data, error } = await this.db.from('tenant_users')
      .select('tenant_id, role, is_default, tenants(*)')
      .eq('user_id', userId).eq('is_active', true);
    if (error) return [];
    return (data || []).map((r: any) => r.tenants).filter(Boolean);
  }

  async findTenantUsers(tenantId: number): Promise<TenantUser[]> {
    const { data, error } = await this.db.from('tenant_users').select('*')
      .eq('tenant_id', tenantId).order('created_at');
    if (error) throw makeErr(error);
    return (data || []).map((r: any) => this.fromRow(r));
  }

  async setDefaultTenant(userId: number, tenantId: number): Promise<void> {
    // unset all defaults for this user, then set the new one
    await this.db.from('tenant_users').update({ is_default: false }).eq('user_id', userId);
    await this.db.from('tenant_users').update({ is_default: true })
      .eq('user_id', userId).eq('tenant_id', tenantId);
  }

  async isUserInTenant(userId: number, tenantId: number): Promise<boolean> {
    const { data, error } = await this.db.from('tenant_users').select('id')
      .eq('user_id', userId).eq('tenant_id', tenantId).eq('is_active', true).maybeSingle();
    if (error) return false;
    return !!data;
  }
}

// =============================================================================
// Invoice Repository
// =============================================================================
export class SupabaseInvoiceRepository implements IInvoiceRepository {
  constructor(private db: SupabaseClient) {}

  private fromRow(r: any): Invoice {
    return {
      id: Number(r.id), tenant_id: Number(r.tenant_id),
      payment_id: r.payment_id ? Number(r.payment_id) : null,
      subscription_id: r.subscription_id ? Number(r.subscription_id) : null,
      invoice_number: r.invoice_number, amount_cents: Number(r.amount_cents),
      currency: r.currency, status: r.status, issued_at: r.issued_at,
      due_at: r.due_at, paid_at: r.paid_at, notes: r.notes,
      metadata: r.metadata || {}, created_at: r.created_at, updated_at: r.updated_at,
    };
  }

  async create(tenantId: number, paymentId: number | null, subscriptionId: number | null, amountCents: number, currency: string, status: string = 'draft'): Promise<Invoice> {
    const number = await this.generateInvoiceNumber();
    const { data, error } = await this.db.from('invoices').insert([{
      tenant_id: tenantId, payment_id: paymentId, subscription_id: subscriptionId,
      invoice_number: number, amount_cents: amountCents, currency, status,
    }]).select().single();
    if (error) throw makeErr(error);
    return this.fromRow(data);
  }

  async findByNumber(invoiceNumber: string): Promise<Invoice |