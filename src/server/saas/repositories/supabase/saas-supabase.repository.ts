// =============================================================================
// Supabase SaaS Repository Implementation
// =============================================================================
// This is the primary SaaS repository for the cloud backend (Render).
// It uses the Supabase service_role key to bypass RLS for SaaS admin operations.
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../../config/env';
import {
  IPlanRepository, ITenantRepository, ISubscriptionRepository,
  IPaymentRepository, ITenantUserRepository, IInvoiceRepository, ISaaSRepository,
} from '../saas.repository.interface';
import type {
  Plan, Tenant, Subscription, Payment, TenantUser, Invoice,
  CreateTenantDto, CreatePaymentDto, CreateSubscriptionDto, UpdateSubscriptionDto,
} from '../../types/saas.types';
import { PlanNotFoundError, TenantNotFoundError, SaaSError } from '../../types/saas.types';

let _supabase: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_supabase) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new SaaSError('Supabase not configured', 500, 'SUPABASE_NOT_CONFIGURED');
    }
    _supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }
  return _supabase;
}

const err = (e: any) => new SaaSError(e?.message || String(e), 500, 'SUPABASE_ERROR');

// =============================================================================
// Plan Repository
// =============================================================================
export class SupabasePlanRepository implements IPlanRepository {
  async listPublic(): Promise<Plan[]> {
    const { data, error } = await db().from('plans').select('*')
      .eq('is_active', true).eq('is_public', true).order('sort_order');
    if (error) throw err(error);
    return (data || []).map(this.fromRow);
  }
  async listAll(): Promise<Plan[]> {
    const { data, error } = await db().from('plans').select('*').order('sort_order');
    if (error) throw err(error);
    return (data || []).map(this.fromRow);
  }
  async findByCode(code: string): Promise<Plan | null> {
    const { data, error } = await db().from('plans').select('*').eq('code', code).maybeSingle();
    if (error) throw err(error);
    return data ? this.fromRow(data) : null;
  }
  async findById(id: number): Promise<Plan | null> {
    const { data, error } = await db().from('plans').select('*').eq('id', id).maybeSingle();
    if (error) throw err(error);
    return data ? this.fromRow(data) : null;
  }
  private fromRow(r: any): Plan {
    return {
      id: Number(r.id), code: r.code, name: r.name, description: r.description,
      price_cents: Number(r.price_cents), currency: r.currency, period: r.period,
      duration_days: r.duration_days, max_users: r.max_users, max_tables: r.max_tables,
      max_products: r.max_products, max_orders_per_month: r.max_orders_per_month,
      features: r.features || {}, is_active: r.is_active, is_public: r.is_public,
      trial_days: r.trial_days, sort_order: r.sort_order,
      created_at: r.created_at, updated_at: r.updated_at,
    };
  }
}

// =============================================================================
// Tenant Repository
// =============================================================================
export class SupabaseTenantRepository implements ITenantRepository {
  async create(dto: CreateTenantDto, plan: Plan, _subscription: Subscription, ownerUserId?: number): Promise<Tenant> {
    const slug = dto.slug || dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // 1) Create tenant
    const { data: row, error: tErr } = await db().from('tenants').insert([{
      slug, name: dto.name, owner_email: dto.owner_email, owner_phone: dto.owner_phone,
      country: dto.country || 'ZM', city: dto.city,
      status: plan.period === 'trial' ? 'trial' : 'active', is_provisioned: false,
    }]).select().single();
    if (tErr) throw new SaaSError(`Failed to create tenant: ${tErr.message}`, 500, 'TENANT_CREATE_FAILED');

    // 2) Create subscription
    const now = new Date();
    const periodEnd = new Date(now.getTime() + plan.duration_days * 86400000);
    const isTrial = plan.period === 'trial';
    const trialDays = plan.trial_days > 0 && plan.trial_days < plan.duration_days ? plan.trial_days : plan.duration_days;
    const trialEndsAt = new Date(now.getTime() + trialDays * 86400000);

    const { data: subRow, error: sErr } = await db().from('subscriptions').insert([{
      tenant_id: row.id, plan_id: plan.id,
      status: isTrial ? 'trial' : 'active',
      started_at: now.toISOString(), current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      trial_started_at: isTrial ? now.toISOString() : null,
      trial_ends_at: isTrial ? trialEndsAt.toISOString() : null,
      auto_renew: !isTrial, payment_method: dto.payment_method, payment_reference: dto.payment_reference,
    }]).select().single();
    if (sErr) {
      await db().from('tenants').delete().eq('id', row.id);
      throw new SaaSError(`Failed to create subscription: ${sErr.message}`, 500, 'SUBSCRIPTION_CREATE_FAILED');
    }

    // 3) Add owner as tenant_user
    if (ownerUserId) {
      await db().from('tenant_users').insert([{
        tenant_id: row.id, user_id: ownerUserId, role: 'owner', is_default: true,
        is_active: true, joined_at: now.toISOString(),
      }]);
    }

    await this.logAction(row.id, 'tenant.created', 'tenant', row.id, ownerUserId || null, {
      plan_code: plan.code, subscription_id: subRow.id,
    });

    return this.fromRow(row);
  }

  async findById(id: number): Promise<Tenant | null> {
    const { data, error } = await db().from('tenants').select('*').eq('id', id).maybeSingle();
    if (error) throw err(error);
    return data ? this.fromRow(data) : null;
  }
  async findBySlug(slug: string): Promise<Tenant | null> {
    const { data, error } = await db().from('tenants').select('*').eq('slug', slug).maybeSingle();
    if (error) throw err(error);
    return data ? this.fromRow(data) : null;
  }
  async findByOwnerEmail(email: string): Promise<Tenant[]> {
    const { data, error } = await db().from('tenants').select('*')
      .eq('owner_email', email.toLowerCase()).order('created_at', { ascending: false });
    if (error) throw err(error);
    return (data || []).map((r: any) => this.fromRow(r));
  }
  async listAll(): Promise<Tenant[]> {
    const { data, error } = await db().from('tenants').select('*').order('created_at', { ascending: false });
    if (error) throw err(error);
    return (data || []).map((r: any) => this.fromRow(r));
  }
  async update(id: number, updates: Partial<Tenant>): Promise<Tenant> {
    const allowed: any = {};
    const fields = ['name', 'legal_name', 'owner_email', 'owner_phone', 'contact_email', 'contact_phone',
      'country', 'city', 'address', 'logo_url', 'primary_color', 'default_currency', 'default_locale',
      'timezone', 'status', 'internal_notes'];
    for (const f of fields) {
      if ((updates as any)[f] !== undefined) allowed[f] = (updates as any)[f];
    }
    if (Object.keys(allowed).length === 0) {
      const t = await this.findById(id);
      if (!t) throw new TenantNotFoundError(id);
      return t;
    }
    const { data, error } = await db().from('tenants').update(allowed).eq('id', id).select().single();
    if (error) throw err(error);
    return this.fromRow(data);
  }
  async suspend(id: number, reason?: string): Promise<Tenant> {
    const { data, error } = await db().from('tenants').update({ status: 'suspended' }).eq('id', id).select().single();
    if (error) throw err(error);
    await this.logAction(id, 'tenant.suspended', 'tenant', id, null, { reason });
    return this.fromRow(data);
  }
  async cancel(id: number, reason?: string): Promise<Tenant> {
    const { data, error } = await db().from('tenants').update({ status: 'cancelled' }).eq('id', id).select().single();
    if (error) throw err(error);
    await this.logAction(id, 'tenant.cancelled', 'tenant', id, null, { reason });
    return this.fromRow(data);
  }
  async activate(id: number): Promise<Tenant> {
    const { data, error } = await db().from('tenants').update({ status: 'active' }).eq('id', id).select().single();
    if (error) throw err(error);
    await this.logAction(id, 'tenant.activated', 'tenant', id, null, {});
    return this.fromRow(data);
  }
  async markProvisioned(id: number): Promise<void> {
    await db().from('tenants').update({ is_provisioned: true, provisioned_at: new Date().toISOString() }).eq('id', id);
  }
  async logAction(tenantId: number, action: string, entityType: string | null, entityId: number | null, actorUserId: number | null, metadata: any = {}): Promise<void> {
    try {
      await db().from('tenant_audit_log').insert([{
        tenant_id: tenantId, actor_user_id: actorUserId, action,
        entity_type: entityType, entity_id: entityId, metadata,
      }]);
    } catch (e) {
      console.error('[SaaS] Failed to write audit log:', e);
    }
  }
  async getAuditLog(tenantId: number, limit: number = 100): Promise<any[]> {
    const { data, error } = await db().from('tenant_audit_log').select('*')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
    if (error) return [];
    return data || [];
  }
  private fromRow(r: any): Tenant {
    return {
      id: Number(r.id), slug: r.slug, name: r.name, legal_name: r.legal_name,
      owner_email: r.owner_email, owner_phone: r.owner_phone, contact_email: r.contact_email,
      contact_phone: r.contact_phone, country: r.country, city: r.city, address: r.address,
      logo_url: r.logo_url, primary_color: r.primary_color, default_currency: r.default_currency,
      default_locale: r.default_locale, timezone: r.timezone, status: r.status,
      is_provisioned: r.is_provisioned, provisioned_at: r.provisioned_at,
      internal_notes: r.internal_notes, created_at: r.created_at, updated_at: r.updated_at,
    };
  }
}
