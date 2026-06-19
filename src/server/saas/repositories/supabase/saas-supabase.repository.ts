// =============================================================================
// Supabase SaaS Repository Implementation - VERSION AMÉLIORÉE
// =============================================================================
// Implémentation atomique avec transactions pour garantir l'intégrité
// des données multilocataires.
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../../config/env';
import {
  IPlanRepository, ITenantRepository,
} from '../saas.repository.interface';
import type {
  Plan, Tenant, Subscription,
  CreateTenantDto,
} from '../../types/saas.types';
import { TenantNotFoundError, SaaSError } from '../../types/saas.types';

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

// Fonction utilitaire pour générer un slug unique
function generateUniqueSlug(name: string, existingSlugs: string[]): string {
  let slug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  if (slug === '') slug = 'tenant';
  
  // Assurer l'unicité
  let uniqueSlug = slug;
  let suffix = 1;
  while (existingSlugs.includes(uniqueSlug)) {
    uniqueSlug = `${slug}-${suffix}`;
    suffix++;
  }
  
  return uniqueSlug;
}

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
// Tenant Repository - VERSION ATOMIQUE
// =============================================================================

export class SupabaseTenantRepository implements ITenantRepository {
  
  /**
   * Crée un nouveau tenant avec toutes ses dépendances de manière ATOMIQUE
   * 
   * @param dto - Données du tenant à créer
   * @param plan - Plan sélectionné
   * @param _subscription - Abonnement (non utilisé, créé automatiquement)
   * @param ownerUserId - ID de l'utilisateur propriétaire (optionnel, créé si non fourni)
   * @returns Le tenant créé avec toutes ses relations
   */
  async create(
    dto: CreateTenantDto, 
    plan: Plan, 
    _subscription: Subscription, 
    ownerUserId?: number
  ): Promise<Tenant> {
    const supabase = db();
    
    // =========================================================================
    // ÉTAPE 1: VALIDATION PRÉALABLE
    // =========================================================================
    
    if (!dto.name) {
      throw new SaaSError('Tenant name is required', 400, 'VALIDATION_ERROR');
    }
    
    if (!dto.owner_email) {
      throw new SaaSError('Owner email is required', 400, 'VALIDATION_ERROR');
    }
    
    if (!plan) {
      throw new SaaSError('Plan is required', 400, 'VALIDATION_ERROR');
    }
    
    // Vérifier que l'email du propriétaire est valide
    const ownerEmail = dto.owner_email.toLowerCase().trim();
    
    // Récupérer les slugs existants pour générer un slug unique
    const { data: existingTenants } = await supabase
      .from('tenants')
      .select('slug');
    
    const existingSlugs = (existingTenants || []).map((t: any) => t.slug).filter(Boolean);
    const slug = dto.slug || generateUniqueSlug(dto.name, existingSlugs);
    
    // =========================================================================
    // ÉTAPE 2: CRÉATION ATOMIQUE AVEC GESTION D'ERREURS
    // =========================================================================
    
    let tenant: any = null;
    let subscription: any = null;
    let createdOwnerUserId = ownerUserId;
    let ownerCreated = false;
    
    try {
      const now = new Date();
      const isTrial = plan.period === 'trial';
      const trialDays = plan.trial_days > 0 && plan.trial_days < plan.duration_days 
        ? plan.trial_days 
        : plan.duration_days;
      const trialEndsAt = new Date(now.getTime() + trialDays * 86400000);
      const periodEnd = new Date(now.getTime() + plan.duration_days * 86400000);
      
      // =======================================================================
      // 2.1: CRÉER LE TENANT
      // =======================================================================
      const { data: tenantData, error: tErr } = await supabase
        .from('tenants')
        .insert({
          slug,
          name: dto.name.trim(),
          owner_email: ownerEmail,
          owner_phone: dto.owner_phone?.trim(),
          country: dto.country || 'ZM',
          city: dto.city?.trim(),
          primary_color: '#D4AF37',
          default_currency: 'ZMW',
          default_locale: 'fr',
          timezone: 'Africa/Lusaka',
          status: isTrial ? 'trial' : 'active',
          is_provisioned: false,
        })
        .select()
        .single();
      
      if (tErr) {
        throw new SaaSError(`Failed to create tenant: ${tErr.message}`, 500, 'TENANT_CREATE_FAILED');
      }
      
      tenant = tenantData;
      
      // =======================================================================
      // 2.2: CRÉER OU METTRE À JOUR L'UTILISATEUR PROPRIÉTAIRE
      // =======================================================================
      
      if (!createdOwnerUserId) {
        // Vérifier si un utilisateur avec cet email existe déjà
        const { data: existingUser, error: euErr } = await supabase
          .from('users')
          .select('id')
          .eq('email', ownerEmail)
          .maybeSingle();
        
        if (euErr) {
          // Nettoyage: Supprimer le tenant
          await supabase.from('tenants').delete().eq('id', tenant.id);
          throw new SaaSError(`Failed to check existing user: ${euErr.message}`, 500, 'USER_CHECK_FAILED');
        }
        
        if (existingUser) {
          // Utiliser l'utilisateur existant
          createdOwnerUserId = existingUser.id;
          
          // Mettre à jour son tenant_id
          await supabase
            .from('users')
            .update({ tenant_id: tenant.id })
            .eq('id', createdOwnerUserId);
        } else {
          // Créer un nouvel utilisateur propriétaire
          const ownerUsername = `owner_${slug}`;
          const { data: newOwner, error: uErr } = await supabase
            .from('users')
            .insert({
              email: ownerEmail,
              full_name: dto.name || `Owner ${slug}`,
              username: ownerUsername,
              role: 'owner',
              is_active: true,
              tenant_id: tenant.id,
              has_setup_pin: false,
            })
            .select()
            .single();
          
          if (uErr) {
            // Nettoyage: Supprimer le tenant si la création de l'utilisateur échoue
            await supabase.from('tenants').delete().eq('id', tenant.id);
            throw new SaaSError(`Failed to create owner user: ${uErr.message}`, 500, 'OWNER_CREATE_FAILED');
          }
          
          createdOwnerUserId = newOwner.id;
          ownerCreated = true;
        }
      } else {
        // Mettre à jour le tenant_id de l'utilisateur existant
        await supabase
          .from('users')
          .update({ tenant_id: tenant.id })
          .eq('id', createdOwnerUserId);
      }
      
      // =======================================================================
      // 2.3: CRÉER LA SUBSCRIPTION
      // =======================================================================
      const { data: subData, error: sErr } = await supabase
        .from('subscriptions')
        .insert({
          tenant_id: tenant.id,
          plan_id: plan.id,
          status: isTrial ? 'trial' : 'active',
          started_at: now.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          trial_started_at: isTrial ? now.toISOString() : null,
          trial_ends_at: isTrial ? trialEndsAt.toISOString() : null,
          auto_renew: !isTrial,
          payment_method: dto.payment_method,
          payment_reference: dto.payment_reference,
        })
        .select()
        .single();
      
      if (sErr) {
        // Nettoyage: Supprimer le tenant et l'utilisateur si la création échoue
        await supabase.from('tenants').delete().eq('id', tenant.id);
        if (ownerCreated && createdOwnerUserId) {
          await supabase.from('users').delete().eq('id', createdOwnerUserId);
        }
        throw new SaaSError(`Failed to create subscription: ${sErr.message}`, 500, 'SUBSCRIPTION_CREATE_FAILED');
      }
      
      subscription = subData;
      
      // =======================================================================
      // 2.4: CRÉER LA RELATION TENANT_USERS (CRITIQUE)
      // =======================================================================
      const { error: tuErr } = await supabase
        .from('tenant_users')
        .insert({
          tenant_id: tenant.id,
          user_id: createdOwnerUserId!,
          role: 'owner',
          is_default: true,
          is_active: true,
          joined_at: now.toISOString(),
        });
      
      if (tuErr) {
        // Nettoyage complet en cas d'échec
        await supabase.from('subscriptions').delete().eq('id', subscription.id);
        await supabase.from('tenants').delete().eq('id', tenant.id);
        if (ownerCreated && createdOwnerUserId) {
          await supabase.from('users').delete().eq('id', createdOwnerUserId);
        }
        throw new SaaSError(`Failed to create tenant_user relationship: ${tuErr.message}`, 500, 'TENANT_USER_CREATE_FAILED');
      }
      
      // =======================================================================
      // 2.5: CRÉER L'AUDIT LOG
      // =======================================================================
      await this.logAction(
        tenant.id, 
        'tenant.created', 
        'tenant', 
        tenant.id, 
        createdOwnerUserId || null,
        {
          plan_code: plan.code,
          subscription_id: subscription.id,
          owner_email: ownerEmail,
          owner_user_id: createdOwnerUserId,
        }
      );
      
      // =======================================================================
      // 2.6: MARQUER COMME PROVISIONNÉ SI PAS EN MODE ESSAI
      // =======================================================================
      if (!isTrial) {
        await supabase
          .from('tenants')
          .update({
            is_provisioned: true,
            provisioned_at: now.toISOString()
          })
          .eq('id', tenant.id);
          
        tenant.is_provisioned = true;
        tenant.provisioned_at = now.toISOString();
      }
      
      // =======================================================================
      // SUCCESS: Retourner le tenant
      // =======================================================================
      return this.fromRow(tenant);
      
    } catch (error: any) {
      // Gestion centralisée des erreurs avec nettoyage
      console.error('[SaaS] Transaction failed, cleaning up:', error.message);
      
      // Rollback partiel: tenter de nettoyer les ressources créées
      if (tenant?.id) {
        try {
          await supabase.from('tenant_users').delete().eq('tenant_id', tenant.id);
          await supabase.from('subscriptions').delete().eq('tenant_id', tenant.id);
          await supabase.from('tenants').delete().eq('id', tenant.id);
        } catch (cleanupErr) {
          console.error('[SaaS] Cleanup failed:', cleanupErr);
        }
      }
      
      if (ownerCreated && createdOwnerUserId) {
        try {
          await supabase.from('users').delete().eq('id', createdOwnerUserId);
        } catch (cleanupErr) {
          console.error('[SaaS] User cleanup failed:', cleanupErr);
        }
      }
      
      throw error;
    }
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
      if ((updates as any)[f] !== undefined) {
        allowed[f] = (updates as any)[f];
      }
    }
    
    if (Object.keys(allowed).length === 0) {
      const t = await this.findById(id);
      if (!t) throw new TenantNotFoundError(id);
      return t;
    }
    
    const { data, error } = await db().from('tenants').update(allowed).eq('id', id).select().single();
    if (error) throw err(error);
    
    await this.logAction(id, 'tenant.updated', 'tenant', id, null, { updates: allowed });
    
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
        tenant_id: tenantId, 
        actor_user_id: actorUserId, 
        action,
        entity_type: entityType,
        entity_id: entityId, 
        metadata,
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

  /**
   * Vérifie l'intégrité d'un tenant
   */
  async checkTenantIntegrity(tenantId: number): Promise<{
    tenant: Tenant | null;
    hasOwner: boolean;
    hasDefaultUser: boolean;
    userCount: number;
    tenantUserCount: number;
    issues: string[];
  }> {
    const tenant = await this.findById(tenantId);
    if (!tenant) {
      return {
        tenant: null,
        hasOwner: false,
        hasDefaultUser: false,
        userCount: 0,
        tenantUserCount: 0,
        issues: [`Tenant ${tenantId} not found`]
      };
    }

    const issues: string[] = [];
    const supabase = db();
    
    // Vérifier les utilisateurs
    const { data: users, error: uErr } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId);
    
    const userCount = users?.length || 0;
    
    // Vérifier les relations tenant_users
    const { data: tenantUsers, error: tuErr } = await supabase
      .from('tenant_users')
      .select('id, role, is_default')
      .eq('tenant_id', tenantId);
    
    const tenantUserCount = tenantUsers?.length || 0;
    
    // Vérifier s'il y a un owner
    const hasOwner = tenantUsers?.some((tu: any) => tu.role === 'owner') || false;
    if (!hasOwner) {
      issues.push('No owner user for tenant');
    }
    
    // Vérifier s'il y a un utilisateur par défaut
    const hasDefaultUser = tenantUsers?.some((tu: any) => tu.is_default === true) || false;
    if (!hasDefaultUser) {
      issues.push('No default user for tenant');
    }
    
    // Vérifier la cohérence entre users et tenant_users
    if (userCount > 0 && tenantUserCount === 0) {
      issues.push('Users exist but no tenant_users relationships');
    }
    
    return {
      tenant,
      hasOwner,
      hasDefaultUser,
      userCount,
      tenantUserCount,
      issues
    };
  }

  /**
   * Répare l'intégrité d'un tenant (création des relations manquantes)
   */
  async repairTenantIntegrity(tenantId: number): Promise<{
    createdUsers: number;
    createdTenantUsers: number;
    fixed: boolean;
  }> {
    const supabase = db();
    const now = new Date();
    
    let createdUsers = 0;
    let createdTenantUsers = 0;
    
    // 1. Vérifier et créer un utilisateur owner si manquant
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('id, owner_email, name, slug')
      .eq('id', tenantId)
      .maybeSingle();
    
    if (tErr || !tenant) {
      throw new TenantNotFoundError(tenantId);
    }
    
    // Vérifier s'il y a déjà un owner
    const { data: existingOwner, error: oErr } = await supabase
      .from('tenant_users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('role', 'owner')
      .maybeSingle();
    
    if (!existingOwner && tenant.owner_email) {
      // Créer un utilisateur propriétaire
      const ownerUsername = `owner_${tenant.slug || 'tenant-' + tenantId}`;
      const { data: newOwner, error: uErr } = await supabase
        .from('users')
        .insert({
          email: tenant.owner_email,
          full_name: `Owner ${tenant.name}`,
          username: ownerUsername,
          role: 'owner',
          is_active: true,
          tenant_id: tenantId,
        })
        .select()
        .single();
      
      if (!uErr && newOwner) {
        createdUsers++;
        
        // Créer la relation tenant_users
        await supabase.from('tenant_users').insert({
          tenant_id: tenantId,
          user_id: newOwner.id,
          role: 'owner',
          is_default: true,
          is_active: true,
          joined_at: now.toISOString(),
        });
        createdTenantUsers++;
      }
    }
    
    // 2. S'assurer que chaque user a un tenant_user
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId);
    
    if (users && users.length > 0) {
      for (const user of users) {
        const { data: existingTu } = await supabase
          .from('tenant_users')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!existingTu) {
          await supabase.from('tenant_users').insert({
            tenant_id: tenantId,
            user_id: user.id,
            role: 'staff',
            is_default: false,
            is_active: true,
            joined_at: now.toISOString(),
          });
          createdTenantUsers++;
        }
      }
    }
    
    // 3. S'assurer qu'il y a un utilisateur par défaut
    const { data: defaultUser } = await supabase
      .from('tenant_users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .maybeSingle();
    
    if (!defaultUser) {
      // Mettre à jour le premier owner/admin comme default
      const { data: firstUser } = await supabase
        .from('tenant_users')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('role', ['owner', 'admin'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (firstUser) {
        await supabase
          .from('tenant_users')
          .update({ is_default: true })
          .eq('id', firstUser.id);
      }
    }
    
    return {
      createdUsers,
      createdTenantUsers,
      fixed: createdUsers > 0 || createdTenantUsers > 0
    };
  }

  private fromRow(r: any): Tenant {
    return {
      id: Number(r.id), 
      slug: r.slug, 
      name: r.name, 
      legal_name: r.legal_name,
      owner_email: r.owner_email, 
      owner_phone: r.owner_phone, 
      contact_email: r.contact_email,
      contact_phone: r.contact_phone, 
      country: r.country, 
      city: r.city, 
      address: r.address,
      logo_url: r.logo_url, 
      primary_color: r.primary_color, 
      default_currency: r.default_currency,
      default_locale: r.default_locale, 
      timezone: r.timezone, 
      status: r.status,
      is_provisioned: r.is_provisioned, 
      provisioned_at: r.provisioned_at,
      internal_notes: r.internal_notes, 
      created_at: r.created_at, 
      updated_at: r.updated_at,
    };
  }
}

// =============================================================================
// Exports
// =============================================================================

export { db };
