// =============================================================================
// Platform Routes — Super Admin API
// =============================================================================
// Routes pour le portail Super Admin /platform/*
// Complètement séparé des routes tenant
// =============================================================================

import { Router, Request, Response } from 'express';
import { requirePlatformAuth } from '../platform/platform-auth.middleware';
import db from '../db/database';

const router = Router();

// =============================================================================
// TYPES
// =============================================================================

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  trialTenants: number;
  totalRevenue: number;
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  activeSubscriptions: number;
  expiredSubscriptions: number;
  pendingVouchers: number;
  verifiedVouchers: number;
  rejectedVouchers: number;
  expiredVouchers: number;
}

interface _TenantListItem {
  id: number;
  name: string;
  slug: string | null;
  owner_email: string;
  country: string;
  city: string | null;
  status: string;
  plan_code: string | null;
  is_provisioned: boolean;
  created_at: string;
  updated_at: string;
  subscription_status: string | null;
  subscription_ends_at: string | null;
  users_count: number;
}

// =============================================================================
// PLATFORM DASHBOARD — Statistiques globales
// =============================================================================

router.get('/stats', requirePlatformAuth, async (_req: Request, res: Response) => {
  try {
    // Total tenants
    const totalTenants = await db('tenants').count('id as count').first();
    
    // Tenants par statut
    const activeTenants = await db('tenants').where('status', 'active').count('id as count').first();
    const suspendedTenants = await db('tenants').where('status', 'suspended').count('id as count').first();
    const trialTenants = await db('tenants').where('status', 'trial').count('id as count').first();
    
    // Abonnements actifs
    const activeSubscriptions = await db('subscriptions').where('status', 'active').count('id as count').first();
    const expiredSubscriptions = await db('subscriptions').where('status', 'expired').count('id as count').first();
    
    // Vouchers par statut
    const pendingVouchers = await db('voucher_requests').where('status', 'pending').count('id as count').first();
    const verifiedVouchers = await db('voucher_requests').where('status', 'verified').count('id as count').first();
    const rejectedVouchers = await db('voucher_requests').where('status', 'rejected').count('id as count').first();
    const expiredVouchers = await db('voucher_requests').where('status', 'expired').count('id as count').first();
    
    // Revenue calculations
    const activePlans = await db('subscriptions')
      .join('plans', 'subscriptions.plan_id', 'plans.id')
      .where('subscriptions.status', 'active')
      .select('plans.price_cents', 'plans.period')
      .all();
    
    let mrr = 0;
    let arr = 0;
    
    activePlans.forEach((plan: any) => {
      const monthlyPrice = plan.period === 'annual' ? plan.price_cents / 12 : 
                          plan.period === 'weekly' ? plan.price_cents * 4 : 
                          plan.price_cents;
      mrr += monthlyPrice;
      arr += monthlyPrice * 12;
    });
    
    const stats: PlatformStats = {
      totalTenants: parseInt(totalTenants?.count as string || '0'),
      activeTenants: parseInt(activeTenants?.count as string || '0'),
      suspendedTenants: parseInt(suspendedTenants?.count as string || '0'),
      trialTenants: parseInt(trialTenants?.count as string || '0'),
      totalRevenue: mrr,
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      activeSubscriptions: parseInt(activeSubscriptions?.count as string || '0'),
      expiredSubscriptions: parseInt(expiredSubscriptions?.count as string || '0'),
      pendingVouchers: parseInt(pendingVouchers?.count as string || '0'),
      verifiedVouchers: parseInt(verifiedVouchers?.count as string || '0'),
      rejectedVouchers: parseInt(rejectedVouchers?.count as string || '0'),
      expiredVouchers: parseInt(expiredVouchers?.count as string || '0'),
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('[Platform] Error fetching stats:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la récupération des statistiques' });
  }
});

// =============================================================================
// TENANTS — Liste avec pagination
// =============================================================================

router.get('/tenants', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    
    const offset = (page - 1) * limit;
    
    // Build query
    let query = db('tenants')
      .leftJoin('subscriptions', 'tenants.id', 'subscriptions.tenant_id')
      .leftJoin('plans', 'subscriptions.plan_id', 'plans.id')
      .leftJoin(
        db('tenant_users').count('id as users_count').whereRaw('tenant_users.tenant_id = tenants.id').as('users_count_query'),
        'users_count'
      )
      .select(
        'tenants.id',
        'tenants.name',
        'tenants.slug',
        'tenants.owner_email',
        'tenants.country',
        'tenants.city',
        'tenants.status',
        'plans.code as plan_code',
        'tenants.is_provisioned',
        'tenants.created_at',
        'tenants.updated_at',
        'subscriptions.status as subscription_status',
        'subscriptions.current_period_end as subscription_ends_at'
      )
      .groupBy('tenants.id');
    
    // Search filter
    if (search) {
      query = query.where((builder: any) => {
        builder
          .where('tenants.name', 'like', `%${search}%`)
          .orWhere('tenants.owner_email', 'like', `%${search}%`)
          .orWhere('tenants.slug', 'like', `%${search}%`);
      });
    }
    
    // Status filter
    if (status) {
      query = query.where('tenants.status', status);
    }
    
    // Order by created_at desc
    query = query.orderBy('tenants.created_at', 'desc');
    
    // Execute with pagination
    const tenants = await query.clone().limit(limit).offset(offset);
    const total = await query.clone().count('id as count').first();
    
    res.json({
      success: true,
      tenants,
      pagination: {
        page,
        limit,
        total: parseInt((total as any)?.count as string || '0'),
        pages: Math.ceil(parseInt((total as any)?.count as string || '0') / limit),
      },
    });
  } catch (error) {
    console.error('[Platform] Error fetching tenants:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la récupération des tenants' });
  }
});

// =============================================================================
// TENANTS — Détails d'un tenant
// =============================================================================

router.get('/tenants/:id', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    
    // Tenant details
    const tenant = await db('tenants').where('id', tenantId).first();
    
    if (!tenant) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant introuvable' });
      return;
    }
    
    // Subscription
    const subscription = await db('subscriptions')
      .join('plans', 'subscriptions.plan_id', 'plans.id')
      .where('subscriptions.tenant_id', tenantId)
      .orderBy('subscriptions.created_at', 'desc')
      .first();
    
    // Users
    const users = await db('tenant_users')
      .join('users', 'tenant_users.user_id', 'users.id')
      .where('tenant_users.tenant_id', tenantId)
      .select(
        'users.id',
        'users.email',
        'users.full_name',
        'users.role',
        'users.status',
        'tenant_users.role as tenant_role',
        'tenant_users.is_active'
      );
    
    // Recent vouchers
    const recentVouchers = await db('voucher_requests')
      .where('tenant_id', tenantId)
      .orderBy('created_at', 'desc')
      .limit(10);
    
    res.json({
      success: true,
      tenant,
      subscription,
      users,
      recentVouchers,
    });
  } catch (error) {
    console.error('[Platform] Error fetching tenant details:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la récupération des détails' });
  }
});

// =============================================================================
// TENANTS — Suspendre un tenant
// =============================================================================

router.post('/tenants/:id/suspend', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const { reason } = req.body;
    const adminId = req.superAdmin?.id;
    
    // Vérifier que le tenant existe
    const tenant = await db('tenants').where('id', tenantId).first();
    
    if (!tenant) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant introuvable' });
      return;
    }
    
    // Vérifier que le tenant n'est pas déjà suspendu
    if (tenant.status === 'suspended') {
      res.status(400).json({ error: 'ALREADY_SUSPENDED', message: 'Ce tenant est déjà suspendu' });
      return;
    }
    
    // Suspendre le tenant
    await db('tenants')
      .where('id', tenantId)
      .update({
        status: 'suspended',
        suspended_at: new Date().toISOString(),
        suspension_reason: reason || 'Aucune raison fournie',
        suspended_by: adminId,
        updated_at: new Date().toISOString(),
      });
    
    // Suspendre l'abonnement
    await db('subscriptions')
      .where('tenant_id', tenantId)
      .whereIn('status', ['active', 'trial', 'pending'])
      .update({
        status: 'suspended',
        updated_at: new Date().toISOString(),
      });
    
    // Désactiver les utilisateurs
    await db('tenant_users')
      .where('tenant_id', tenantId)
      .update({
        is_active: 0,
        updated_at: new Date().toISOString(),
      });
    
    // Logger l'action
    await db('tenant_audit_log').insert({
      tenant_id: tenantId,
      actor_user_id: adminId,
      action: 'tenant_suspended',
      entity_type: 'tenant',
      entity_id: tenantId,
      metadata: JSON.stringify({ reason, suspended_at: new Date().toISOString() }),
      created_at: new Date().toISOString(),
    });
    
    res.json({ success: true, message: 'Tenant suspendu avec succès' });
  } catch (error) {
    console.error('[Platform] Error suspending tenant:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la suspension du tenant' });
  }
});

// =============================================================================
// TENANTS — Réactiver un tenant
// =============================================================================

router.post('/tenants/:id/activate', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const adminId = req.superAdmin?.id;
    
    // Vérifier que le tenant existe
    const tenant = await db('tenants').where('id', tenantId).first();
    
    if (!tenant) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant introuvable' });
      return;
    }
    
    // Vérifier que le tenant est suspendu
    if (tenant.status !== 'suspended') {
      res.status(400).json({ error: 'NOT_SUSPENDED', message: 'Ce tenant n\'est pas suspendu' });
      return;
    }
    
    // Réactiver le tenant
    await db('tenants')
      .where('id', tenantId)
      .update({
        status: 'active',
        last_reactivated_at: new Date().toISOString(),
        last_reactivated_by: adminId,
        updated_at: new Date().toISOString(),
      });
    
    // Réactiver l'abonnement
    await db('subscriptions')
      .where('tenant_id', tenantId)
      .where('status', 'suspended')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      });
    
    // Réactiver les utilisateurs
    await db('tenant_users')
      .where('tenant_id', tenantId)
      .update({
        is_active: 1,
        updated_at: new Date().toISOString(),
      });
    
    // Logger l'action
    await db('tenant_audit_log').insert({
      tenant_id: tenantId,
      actor_user_id: adminId,
      action: 'tenant_activated',
      entity_type: 'tenant',
      entity_id: tenantId,
      metadata: JSON.stringify({ reactivated_at: new Date().toISOString() }),
      created_at: new Date().toISOString(),
    });
    
    res.json({ success: true, message: 'Tenant réactivé avec succès' });
  } catch (error) {
    console.error('[Platform] Error activating tenant:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la réactivation du tenant' });
  }
});

// =============================================================================
// VOUCHERS — Liste globale
// =============================================================================

router.get('/vouchers', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const status = (req.query.status as string) || '';
    const offset = (page - 1) * limit;
    
    let query = db('voucher_requests')
      .join('tenants', 'voucher_requests.tenant_id', 'tenants.id')
      .join('plans', 'voucher_requests.plan_id', 'plans.id')
      .select(
        'voucher_requests.id',
        'voucher_requests.voucher_code',
        'voucher_requests.customer_email',
        'voucher_requests.status',
        'voucher_requests.requested_at',
        'voucher_requests.verification_deadline',
        'voucher_requests.expires_at',
        'voucher_requests.verified_at',
        'voucher_requests.amount_cents',
        'voucher_requests.currency',
        'tenants.name as tenant_name',
        'tenants.id as tenant_id',
        'plans.name as plan_name',
        'plans.code as plan_code'
      );
    
    if (status) {
      query = query.where('voucher_requests.status', status);
    }
    
    query = query.orderBy('voucher_requests.created_at', 'desc');
    
    const vouchers = await query.clone().limit(limit).offset(offset);
    const total = await query.clone().count('id as count').first();
    
    res.json({
      success: true,
      vouchers,
      pagination: {
        page,
        limit,
        total: parseInt((total as any)?.count as string || '0'),
        pages: Math.ceil(parseInt((total as any)?.count as string || '0') / limit),
      },
    });
  } catch (error) {
    console.error('[Platform] Error fetching vouchers:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la récupération des vouchers' });
  }
});

// =============================================================================
// VOUCHERS — Approuver un voucher
// =============================================================================

router.post('/vouchers/:id/approve', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const voucherId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const adminId = req.superAdmin?.id;
    
    // Récupérer le voucher
    const voucher = await db('voucher_requests').where('id', voucherId).first();
    
    if (!voucher) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Voucher introuvable' });
      return;
    }
    
    // Vérifier le statut
    if (voucher.status !== 'pending' && voucher.status !== 'payment_sent') {
      res.status(400).json({ error: 'INVALID_STATUS', message: 'Ce voucher ne peut pas être approuvé' });
      return;
    }
    
    // Transaction
    await db.transaction(async (trx: any) => {
      // Mettre à jour le voucher
      await trx('voucher_requests')
        .where('id', voucherId)
        .update({
          status: 'verified',
          verified_by: adminId,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      
      // Créer/mettre à jour l'abonnement
      const subscription = await trx('subscriptions')
        .where('tenant_id', voucher.tenant_id)
        .where('status', '!=', 'cancelled')
        .first();
      
      if (subscription) {
        await trx('subscriptions')
          .where('id', subscription.id)
          .update({
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          });
      } else {
        await trx('subscriptions').insert({
          tenant_id: voucher.tenant_id,
          plan_id: voucher.plan_id,
          status: 'active',
          started_at: new Date().toISOString(),
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          auto_renew: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      
      // Activer le tenant
      await trx('tenants')
        .where('id', voucher.tenant_id)
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        });
      
      // Activer les utilisateurs
      await trx('tenant_users')
        .where('tenant_id', voucher.tenant_id)
        .update({
          is_active: 1,
          updated_at: new Date().toISOString(),
        });
    });
    
    // Logger l'action
    await db('billing_audit_logs').insert({
      tenant_id: voucher.tenant_id,
      user_id: adminId,
      action: 'voucher_approved',
      entity_type: 'voucher',
      entity_id: voucherId,
      metadata: JSON.stringify({
        voucher_code: voucher.voucher_code,
        plan_id: voucher.plan_id,
        amount_cents: voucher.amount_cents,
      }),
      created_at: new Date().toISOString(),
    });
    
    res.json({ success: true, message: 'Voucher approuvé avec succès' });
  } catch (error) {
    console.error('[Platform] Error approving voucher:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de l\'approbation du voucher' });
  }
});

// =============================================================================
// VOUCHERS — Rejeter un voucher
// =============================================================================

router.post('/vouchers/:id/reject', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const voucherId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const { reason } = req.body;
    const adminId = req.superAdmin?.id;
    
    // Récupérer le voucher
    const voucher = await db('voucher_requests').where('id', voucherId).first();
    
    if (!voucher) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Voucher introuvable' });
      return;
    }
    
    // Vérifier le statut
    if (voucher.status !== 'pending' && voucher.status !== 'payment_sent') {
      res.status(400).json({ error: 'INVALID_STATUS', message: 'Ce voucher ne peut pas être rejeté' });
      return;
    }
    
    // Rejeter le voucher
    await db('voucher_requests')
      .where('id', voucherId)
      .update({
        status: 'rejected',
        rejection_reason: reason || 'Aucune raison fournie',
        verified_by: adminId,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    
    // Logger l'action
    await db('billing_audit_logs').insert({
      tenant_id: voucher.tenant_id,
      user_id: adminId,
      action: 'voucher_rejected',
      entity_type: 'voucher',
      entity_id: voucherId,
      metadata: JSON.stringify({
        voucher_code: voucher.voucher_code,
        reason: reason || 'Aucune raison fournie',
      }),
      created_at: new Date().toISOString(),
    });
    
    res.json({ success: true, message: 'Voucher rejeté avec succès' });
  } catch (error) {
    console.error('[Platform] Error rejecting voucher:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors du rejet du voucher' });
  }
});

// =============================================================================
// SUBSCRIPTIONS — Liste globale
// =============================================================================

router.get('/subscriptions', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const status = (req.query.status as string) || '';
    const offset = (page - 1) * limit;
    
    let query = db('subscriptions')
      .join('tenants', 'subscriptions.tenant_id', 'tenants.id')
      .join('plans', 'subscriptions.plan_id', 'plans.id')
      .select(
        'subscriptions.id',
        'subscriptions.tenant_id',
        'tenants.name as tenant_name',
        'plans.code as plan_code',
        'plans.name as plan_name',
        'subscriptions.status',
        'subscriptions.started_at',
        'subscriptions.current_period_start',
        'subscriptions.current_period_end',
        'subscriptions.trial_started_at',
        'subscriptions.trial_ends_at',
        'subscriptions.auto_renew',
        'subscriptions.created_at'
      );
    
    if (status) {
      query = query.where('subscriptions.status', status);
    }
    
    query = query.orderBy('subscriptions.created_at', 'desc');
    
    const subscriptions = await query.clone().limit(limit).offset(offset);
    const total = await query.clone().count('id as count').first();
    
    res.json({
      success: true,
      subscriptions,
      pagination: {
        page,
        limit,
        total: parseInt((total as any)?.count as string || '0'),
        pages: Math.ceil(parseInt((total as any)?.count as string || '0') / limit),
      },
    });
  } catch (error) {
    console.error('[Platform] Error fetching subscriptions:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la récupération des abonnements' });
  }
});

// =============================================================================
// SYNC CENTER — Monitoring synchronisation
// =============================================================================

// GET /platform/sync/jobs — Liste des jobs de synchronisation
router.get('/sync/jobs', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const offset = (page - 1) * limit;
    
    const jobs = await db('sync_outbox')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);
    
    const total = await db('sync_outbox').count('id as count').first();
    
    res.json({
      success: true,
      jobs,
      pagination: {
        page,
        limit,
        total: parseInt((total as any)?.count as string || '0'),
        pages: Math.ceil(parseInt((total as any)?.count as string || '0') / limit),
      },
    });
  } catch (error) {
    console.error('[Platform] Error fetching sync jobs:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la récupération des jobs' });
  }
});

// GET /platform/sync/stats — Statistiques de synchronisation
router.get('/sync/stats', requirePlatformAuth, async (_req: Request, res: Response) => {
  try {
    const pending = await db('sync_outbox').where('status', 'pending').count('id as count').first();
    const processing = await db('sync_outbox').where('status', 'processing').count('id as count').first();
    const completed = await db('sync_outbox').where('status', 'completed').count('id as count').first();
    const failed = await db('sync_outbox').where('status', 'failed').count('id as count').first();
    
    res.json({
      success: true,
      stats: {
        pending: parseInt((pending as any)?.count as string || '0'),
        processing: parseInt((processing as any)?.count as string || '0'),
        completed: parseInt((completed as any)?.count as string || '0'),
        failed: parseInt((failed as any)?.count as string || '0'),
      },
    });
  } catch (error) {
    console.error('[Platform] Error fetching sync stats:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la récupération des stats' });
  }
});

// POST /platform/sync/trigger — Déclencher une synchronisation manuelle
router.post('/sync/trigger', requirePlatformAuth, async (_req: Request, res: Response) => {
  try {
    // Marquer les jobs pending comme à retraiter
    await db('sync_outbox')
      .where('status', 'pending')
      .update({
        status: 'pending',
        attempts: 0,
        last_error: null,
        updated_at: new Date().toISOString(),
      });
    
    // Note: Le worker de sync tourne déjà en background (30s interval)
    // Cette endpoint permet juste de réinitialiser les jobs bloqués
    
    res.json({ success: true, message: 'Synchronisation déclenchée' });
  } catch (error) {
    console.error('[Platform] Error triggering sync:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors du déclenchement' });
  }
});

// =============================================================================
// AUDIT LOGS — Consulter les logs
// =============================================================================

router.get('/audit-logs', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const action = (req.query.action as string) || '';
    const tenantId = (req.query.tenant_id as string) || '';
    const offset = (page - 1) * limit;
    
    let query = db('billing_audit_logs')
      .leftJoin('users', 'billing_audit_logs.user_id', 'users.id')
      .leftJoin('tenants', 'billing_audit_logs.tenant_id', 'tenants.id')
      .select(
        'billing_audit_logs.*',
        'users.email as user_email',
        'users.full_name as user_name',
        'tenants.name as tenant_name'
      );
    
    if (action) {
      query = query.where('billing_audit_logs.action', action);
    }
    
    if (tenantId) {
      query = query.where('billing_audit_logs.tenant_id', parseInt(tenantId));
    }
    
    query = query.orderBy('billing_audit_logs.created_at', 'desc');
    
    const logs = await query.clone().limit(limit).offset(offset);
    const total = await query.clone().count('id as count').first();
    
    res.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total: parseInt((total as any)?.count as string || '0'),
        pages: Math.ceil(parseInt((total as any)?.count as string || '0') / limit),
      },
    });
  } catch (error) {
    console.error('[Platform] Error fetching audit logs:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la récupération des logs' });
  }
});

// =============================================================================
// SETTINGS — Lire/Écrire configuration
// =============================================================================

router.get('/settings', requirePlatformAuth, async (_req: Request, res: Response) => {
  try {
    const settings = await db('platform_settings').select('*');
    
    const settingsMap: Record<string, string> = {};
    settings.forEach((s: any) => {
      settingsMap[s.key] = s.value;
    });
    
    res.json({ success: true, settings: settingsMap });
  } catch (error) {
    console.error('[Platform] Error fetching settings:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la récupération des paramètres' });
  }
});

router.put('/settings/:key', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const adminId = req.superAdmin?.id;
    
    await db('platform_settings')
      .where('key', key)
      .update({
        value,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      });
    
    res.json({ success: true, message: 'Paramètre mis à jour' });
  } catch (error) {
    console.error('[Platform] Error updating setting:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la mise à jour du paramètre' });
  }
});

export default router;