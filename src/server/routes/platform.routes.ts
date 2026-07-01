import { Router, Request, Response } from 'express';
import { requirePlatformAuth } from '../platform/platform-auth.middleware';
import db from '../db/database';

const router = Router();

// =============================================================================
// Statistiques Dashboard
// =============================================================================

router.get('/stats', requirePlatformAuth, async (_req: Request, res: Response) => {
  try {
    const getCount = (sql: string, ...params: any[]) => {
      const row = db.prepare(sql).get(...params) as any;
      return parseInt(row?.count || '0');
    };

    const stats = {
      totalTenants: getCount('SELECT COUNT(*) as count FROM tenants'),
      activeTenants: getCount("SELECT COUNT(*) as count FROM tenants WHERE status = 'active'"),
      suspendedTenants: getCount("SELECT COUNT(*) as count FROM tenants WHERE status = 'suspended'"),
      trialTenants: getCount("SELECT COUNT(*) as count FROM tenants WHERE status = 'trial'"),
      totalRevenue: 0,
      mrr: 0,
      arr: 0,
      activeSubscriptions: getCount("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'"),
      expiredSubscriptions: getCount("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'expired'"),
      pendingVouchers: getCount("SELECT COUNT(*) as count FROM voucher_requests WHERE status = 'pending'"),
      verifiedVouchers: getCount("SELECT COUNT(*) as count FROM voucher_requests WHERE status = 'verified'"),
      rejectedVouchers: getCount("SELECT COUNT(*) as count FROM voucher_requests WHERE status = 'rejected'"),
      expiredVouchers: getCount("SELECT COUNT(*) as count FROM voucher_requests WHERE status = 'expired'"),
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('[Platform] Error fetching stats:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur statistiques' });
  }
});

// =============================================================================
// Tenants
// =============================================================================

router.get('/tenants', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const search = (req.query.search as string) || '';
    const statusFilter = (req.query.status as string) || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    if (search) {
      whereClause = 'WHERE (t.name LIKE ? OR t.owner_email LIKE ? OR t.slug LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (statusFilter) {
      whereClause = whereClause ? `${whereClause} AND t.status = ?` : 'WHERE t.status = ?';
      params.push(statusFilter);
    }

    const tenants = db.prepare(`
      SELECT t.id, t.name, t.slug, t.owner_email, t.country, t.city, t.status,
             t.is_provisioned, t.created_at, t.updated_at,
             p.code as plan_code, s.status as subscription_status,
             s.current_period_end as subscription_ends_at,
             (SELECT COUNT(*) FROM tenant_users tu WHERE tu.tenant_id = t.id) as users_count
      FROM tenants t
      LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.id = (SELECT id FROM subscriptions WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1)
      LEFT JOIN plans p ON p.id = s.plan_id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const totalRow = db.prepare(`
      SELECT COUNT(*) as count FROM tenants t ${whereClause}
    `).get(...params) as any;

    const totalCount = totalRow?.count || 0;

    res.json({
      success: true,
      tenants,
      pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    console.error('[Platform] Error fetching tenants:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur récupération tenants' });
  }
});

// =============================================================================
// Détails d'un tenant
// =============================================================================

router.get('/tenants/:id', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.id as string);
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;
    if (!tenant) return res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant introuvable' });

    const subscription = db.prepare(`
      SELECT s.*, p.code as plan_code, p.name as plan_name
      FROM subscriptions s LEFT JOIN plans p ON s.plan_id = p.id
      WHERE s.tenant_id = ? ORDER BY s.created_at DESC LIMIT 1
    `).get(tenantId);

    const users = db.prepare(`
      SELECT u.id, u.email, u.full_name, u.role, u.status, tu.role as tenant_role, tu.is_active
      FROM tenant_users tu JOIN users u ON tu.user_id = u.id
      WHERE tu.tenant_id = ?
    `).all(tenantId);

    res.json({ success: true, tenant, subscription, users });
  } catch (error) {
    console.error('[Platform] Error fetching tenant details:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur détails tenant' });
  }
});

// =============================================================================
// Suspendre un tenant
// =============================================================================

router.post('/tenants/:id/suspend', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.id as string);
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;
    if (!tenant) return res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant introuvable' });
    if (tenant.status === 'suspended') return res.status(400).json({ error: 'ALREADY_SUSPENDED', message: 'Déjà suspendu' });

    db.prepare("UPDATE tenants SET status = 'suspended', updated_at = datetime('now') WHERE id = ?").run(tenantId);
    res.json({ success: true, message: 'Tenant suspendu' });
  } catch (error) {
    console.error('[Platform] Error suspending tenant:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur suspension' });
  }
});

// =============================================================================
// Réactiver un tenant
// =============================================================================

router.post('/tenants/:id/activate', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.id as string);
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;
    if (!tenant) return res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant introuvable' });
    if (tenant.status !== 'suspended') return res.status(400).json({ error: 'NOT_SUSPENDED', message: 'Pas suspendu' });

    db.prepare("UPDATE tenants SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(tenantId);
    res.json({ success: true, message: 'Tenant réactivé' });
  } catch (error) {
    console.error('[Platform] Error activating tenant:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur réactivation' });
  }
});

// =============================================================================
// Vouchers
// =============================================================================

// Récupérer les demandes de vouchers
router.get('/vouchers', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const statusFilter = (req.query.status as string) || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    if (statusFilter) {
      whereClause = 'WHERE vr.status = ?';
      params.push(statusFilter);
    }

    const vouchers = db.prepare(`
      SELECT vr.*, t.name as tenant_name, t.id as tenant_id, pl.name as plan_name, pl.code as plan_code
      FROM voucher_requests vr
      JOIN tenants t ON vr.tenant_id = t.id
      JOIN plans pl ON vr.plan_id = pl.id
      ${whereClause}
      ORDER BY vr.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const totalRow = db.prepare(`
      SELECT COUNT(*) as count FROM voucher_requests vr
      JOIN tenants t ON vr.tenant_id = t.id ${whereClause}
    `).get(...params) as any;

    res.json({
      success: true, vouchers,
      pagination: { page, limit, total: totalRow?.count || 0, pages: Math.ceil((totalRow?.count || 0) / limit) },
    });
  } catch (error) {
    console.error('[Platform] Error fetching vouchers:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur récupération vouchers' });
  }
});

// Approuver une demande de voucher
router.post('/vouchers/:id/approve', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const voucherRequestId = parseInt(req.params.id as string);
    const adminUser = (req as any).user;

    // Récupérer la demande de voucher
    const voucherRequest = db.prepare('SELECT * FROM voucher_requests WHERE id = ?').get(voucherRequestId) as any;
    if (!voucherRequest) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Demande de voucher introuvable' });
    }
    if (voucherRequest.status !== 'pending' && voucherRequest.status !== 'payment_sent') {
      return res.status(400).json({ error: 'INVALID_STATUS', message: `Impossible d\'approuver une demande avec le statut "${voucherRequest.status}"` });
    }

    // Vérifier que le plan existe
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(voucherRequest.plan_id) as any;
    if (!plan) {
      return res.status(404).json({ error: 'PLAN_NOT_FOUND', message: 'Plan associé introuvable' });
    }

    // Vérifier s'il existe un voucher disponible dans la table vouchers
    const availableVoucher = db.prepare(`
      SELECT * FROM vouchers 
      WHERE plan_id = ? AND is_active = 1 AND used_count < max_uses
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      LIMIT 1
    `).get(voucherRequest.plan_id) as any;

    let voucherCode: string;

    if (availableVoucher) {
      // Utiliser un voucher existant
      voucherCode = availableVoucher.code;
      
      // Incrémenter le compteur d'utilisation
      db.prepare(`
        UPDATE vouchers SET used_count = used_count + 1, updated_at = datetime('now')
        WHERE id = ?
      `).run(availableVoucher.id);

      // Enregistrer la redemption
      db.prepare(`
        INSERT INTO voucher_redemptions (voucher_id, tenant_id, user_id, redeemed_at, amount_cents, currency, status)
        VALUES (?, ?, ?, datetime('now'), ?, ?, 'completed')
      `).run(availableVoucher.id, voucherRequest.tenant_id, voucherRequest.user_id, plan.price_cents, plan.currency);
    } else {
      // Pas de voucher disponible, générer un code unique
      voucherCode = `VCH-${voucherRequest.tenant_id}-${Date.now().toString(36).toUpperCase()}`;
    }

    // Mettre à jour la demande comme approuvée
    db.prepare(`
      UPDATE voucher_requests 
      SET status = 'verified', approved_at = datetime('now'), approved_by = ?, code = ?
      WHERE id = ?
    `).run(adminUser?.id || 0, voucherCode, voucherRequestId);

    // Créer ou mettre à jour la subscription du tenant
    const existingSub = db.prepare(`
      SELECT id FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(voucherRequest.tenant_id) as any;

    if (existingSub) {
      // Mettre à jour la subscription existante
      db.prepare(`
        UPDATE subscriptions 
        SET plan_id = ?, status = 'active', 
            current_period_start = datetime('now'),
            current_period_end = datetime('now', '+' || ? || ' days'),
            last_voucher_code = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(voucherRequest.plan_id, plan.duration_days || 30, voucherCode, existingSub.id);
    } else {
      // Créer une nouvelle subscription
      db.prepare(`
        INSERT INTO subscriptions (tenant_id, plan_id, status, started_at, current_period_start, current_period_end, last_voucher_code, created_at, updated_at)
        VALUES (?, ?, 'active', datetime('now'), datetime('now'), datetime('now', '+' || ? || ' days'), ?, datetime('now'), datetime('now'))
      `).run(voucherRequest.tenant_id, voucherRequest.plan_id, plan.duration_days || 30, voucherCode);
    }

    // Mettre à jour le statut du tenant
    db.prepare("UPDATE tenants SET status = 'active', updated_at = datetime('now') WHERE id = ?")
      .run(voucherRequest.tenant_id);

    // Audit log
    db.prepare(`
      INSERT INTO platform_audit_logs (admin_id, admin_email, admin_role, action, entity_type, entity_id, metadata, success, created_at)
      VALUES (?, ?, ?, 'VOUCHER_APPROVED', 'voucher_request', ?, ?, 1, datetime('now'))
    `).run(
      adminUser?.id || 0,
      adminUser?.email || 'unknown',
      adminUser?.role || 'admin',
      voucherRequestId,
      JSON.stringify({ code: voucherCode, plan_id: voucherRequest.plan_id, tenant_id: voucherRequest.tenant_id })
    );

    console.log(`[Platform] Voucher ${voucherRequestId} approved: code=${voucherCode}, tenant=${voucherRequest.tenant_id}`);
    
    res.json({
      success: true,
      message: 'Voucher approuvé avec succès',
      data: {
        code: voucherCode,
        tenantId: voucherRequest.tenant_id,
        planId: voucherRequest.plan_id,
        planName: plan.name,
      }
    });
  } catch (error) {
    console.error('[Platform] Error approving voucher:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur approbation voucher' });
  }
});

// Rejeter une demande de voucher
router.post('/vouchers/:id/reject', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const voucherRequestId = parseInt(req.params.id as string);
    const { reason } = req.body;
    const adminUser = (req as any).user;

    const voucherRequest = db.prepare('SELECT * FROM voucher_requests WHERE id = ?').get(voucherRequestId) as any;
    if (!voucherRequest) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Demande de voucher introuvable' });
    }
    if (voucherRequest.status !== 'pending' && voucherRequest.status !== 'payment_sent') {
      return res.status(400).json({ error: 'INVALID_STATUS', message: `Impossible de rejeter une demande avec le statut "${voucherRequest.status}"` });
    }

    // Mettre à jour la demande comme rejetée
    db.prepare(`
      UPDATE voucher_requests 
      SET status = 'rejected', approved_at = datetime('now'), approved_by = ?, code = ?
      WHERE id = ?
    `).run(adminUser?.id || 0, reason || 'Rejeté par l\'administrateur', voucherRequestId);

    // Audit log
    db.prepare(`
      INSERT INTO platform_audit_logs (admin_id, admin_email, admin_role, action, entity_type, entity_id, metadata, success, created_at)
      VALUES (?, ?, ?, 'VOUCHER_REJECTED', 'voucher_request', ?, ?, 1, datetime('now'))
    `).run(
      adminUser?.id || 0,
      adminUser?.email || 'unknown',
      adminUser?.role || 'admin',
      voucherRequestId,
      JSON.stringify({ reason, tenant_id: voucherRequest.tenant_id })
    );

    console.log(`[Platform] Voucher ${voucherRequestId} rejected: reason=${reason}`);
    
    res.json({
      success: true,
      message: 'Demande de voucher rejetée',
    });
  } catch (error) {
    console.error('[Platform] Error rejecting voucher:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur rejet voucher' });
  }
});

// =============================================================================
// Subscriptions
// =============================================================================

router.get('/subscriptions', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const statusFilter = (req.query.status as string) || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    if (statusFilter) {
      whereClause = 'WHERE s.status = ?';
      params.push(statusFilter);
    }

    const subscriptions = db.prepare(`
      SELECT s.*, t.name as tenant_name, p.code as plan_code, p.name as plan_name
      FROM subscriptions s
      JOIN tenants t ON s.tenant_id = t.id
      JOIN plans p ON s.plan_id = p.id
      ${whereClause}
      ORDER BY s.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const totalRow = db.prepare(`
      SELECT COUNT(*) as count FROM subscriptions s
      JOIN tenants t ON s.tenant_id = t.id ${whereClause}
    `).get(...params) as any;

    res.json({
      success: true, subscriptions,
      pagination: { page, limit, total: totalRow?.count || 0, pages: Math.ceil((totalRow?.count || 0) / limit) },
    });
  } catch (error) {
    console.error('[Platform] Error fetching subscriptions:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur récupération abonnements' });
  }
});

// =============================================================================
// Sync Jobs
// =============================================================================

router.get('/sync/jobs', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const statusFilter = (req.query.status as string) || '';
    const tenantId = req.query.tenant_id ? parseInt(req.query.tenant_id as string) : null;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    if (statusFilter) {
      whereClause = 'WHERE so.status = ?';
      params.push(statusFilter);
    }
    if (tenantId) {
      whereClause = whereClause ? `${whereClause} AND so.tenant_id = ?` : 'WHERE so.tenant_id = ?';
      params.push(tenantId);
    }

    const jobs = db.prepare(`
      SELECT so.id, so.entity, so.operation, so.record_id, so.payload, so.version,
             so.status, so.retry_count, so.last_error, so.tenant_id,
             so.created_at, so.updated_at,
             t.name as tenant_name
      FROM sync_outbox so
      LEFT JOIN tenants t ON so.tenant_id = t.id
      ${whereClause}
      ORDER BY so.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const totalRow = db.prepare(`
      SELECT COUNT(*) as count FROM sync_outbox so ${whereClause}
    `).get(...params) as any;

    res.json({
      success: true,
      jobs,
      pagination: { page, limit, total: totalRow?.count || 0, pages: Math.ceil((totalRow?.count || 0) / limit) },
    });
  } catch (error) {
    console.error('[Platform] Error fetching sync jobs:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur récupération jobs sync' });
  }
});

// =============================================================================
// Sync Stats
// =============================================================================

router.get('/sync/stats', requirePlatformAuth, async (_req: Request, res: Response) => {
  try {
    const getCount = (sql: string, ...params: any[]) => {
      const row = db.prepare(sql).get(...params) as any;
      return parseInt(row?.count || '0');
    };

    const stats = {
      totalJobs: getCount('SELECT COUNT(*) as count FROM sync_outbox'),
      pendingJobs: getCount("SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'pending'"),
      processingJobs: getCount("SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'processing'"),
      doneJobs: getCount("SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'done'"),
      failedJobs: getCount("SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'failed'"),
      totalTenants: getCount('SELECT COUNT(*) as count FROM tenants'),
      activeTenants: getCount("SELECT COUNT(*) as count FROM tenants WHERE status = 'active'"),
      lastSync: null,
    };

    // Get last sync time
    const lastSyncRow = db.prepare(`
      SELECT MAX(updated_at) as last_sync FROM sync_outbox
    `).get() as any;
    stats.lastSync = lastSyncRow?.last_sync || null;

    res.json({ success: true, stats });
  } catch (error) {
    console.error('[Platform] Error fetching sync stats:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur statistiques sync' });
  }
});

// =============================================================================
// Audit Logs
// =============================================================================

router.get('/audit-logs', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const action = (req.query.action as string) || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    if (action) {
      whereClause = 'WHERE al.action = ?';
      params.push(action);
    }

    const logs = db.prepare(`
      SELECT al.id, al.admin_id, al.admin_email, al.admin_role, al.action, al.entity_type, al.entity_id,
             al.metadata, al.ip_address, al.user_agent, al.success, al.created_at
      FROM platform_audit_logs al
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const totalRow = db.prepare(`
      SELECT COUNT(*) as count FROM platform_audit_logs al ${whereClause}
    `).get(...params) as any;

    res.json({
      success: true,
      logs,
      pagination: { page, limit, total: totalRow?.count || 0, pages: Math.ceil((totalRow?.count || 0) / limit) },
    });
  } catch (error) {
    console.error('[Platform] Error fetching audit logs:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur récupération logs' });
  }
});

// =============================================================================
// CRUD Utilisateurs d'un tenant
// =============================================================================

// Lister les utilisateurs d'un tenant
router.get('/tenants/:id/users', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.id as string);
    const tenant = db.prepare('SELECT id FROM tenants WHERE id = ?').get(tenantId) as any;
    if (!tenant) return res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant introuvable' });

    const users = db.prepare(`
      SELECT u.id, u.email, u.full_name, u.phone, u.username, u.role, u.is_active, u.created_at,
             tu.role as tenant_role, tu.is_active as tenant_active
      FROM tenant_users tu
      JOIN users u ON tu.user_id = u.id
      WHERE tu.tenant_id = ?
      ORDER BY u.created_at DESC
    `).all(tenantId);

    res.json({ success: true, users });
  } catch (error) {
    console.error('[Platform] Error fetching tenant users:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur récupération utilisateurs' });
  }
});

// Créer un utilisateur pour un tenant
router.post('/tenants/:id/users', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.id as string);
    const { email, full_name, phone, username, password, pin_code, role, tenant_role } = req.body;

    if (!email || !full_name || !password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'email, full_name et password requis' });
    }

    const tenant = db.prepare('SELECT id FROM tenants WHERE id = ?').get(tenantId) as any;
    if (!tenant) return res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant introuvable' });

    // Vérifier si l'email existe déjà
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
    if (existing) {
      return res.status(400).json({ error: 'EMAIL_EXISTS', message: 'Cet email existe déjà' });
    }

    // Hasher le mot de passe et le PIN code
    const bcrypt = require('bcryptjs');
    const password_hash = bcrypt.hashSync(password, 10);
    const pin_code_hash = bcrypt.hashSync(pin_code || '0000', 10);

    // Créer l'utilisateur (username obligatoire, utiliser email comme fallback)
    const finalUsername = username || email.split('@')[0];
    const result = db.prepare(`
      INSERT INTO users (email, full_name, phone, username, password_hash, pin_code, role, tenant_id, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(email, full_name, phone || null, finalUsername, password_hash, pin_code_hash, role || 'waiter', tenantId);

    // Lier au tenant via tenant_users
    db.prepare(`
      INSERT INTO tenant_users (tenant_id, user_id, role, is_active, created_at)
      VALUES (?, ?, ?, 1, datetime('now'))
    `).run(tenantId, result.lastInsertRowid, tenant_role || 'manager');

    res.json({ success: true, message: 'Utilisateur créé', userId: result.lastInsertRowid });
  } catch (error) {
    console.error('[Platform] Error creating tenant user:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur création utilisateur' });
  }
});

// Modifier un utilisateur d'un tenant
router.put('/tenants/:id/users/:userId', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.id as string);
    const userId = parseInt(req.params.userId as string);

    const tenant = db.prepare('SELECT id FROM tenants WHERE id = ?').get(tenantId) as any;
    if (!tenant) return res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant introuvable' });

    const user = db.prepare('SELECT id FROM users WHERE id = ? AND tenant_id = ?').get(userId, tenantId) as any;
    if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'Utilisateur introuvable' });

    const { email, full_name, phone, username, role, is_active, tenant_role } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (full_name !== undefined) { updates.push('full_name = ?'); params.push(full_name); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (username !== undefined) { updates.push('username = ?'); params.push(username); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    updates.push("updated_at = datetime('now')");
    params.push(userId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Mettre à jour tenant_users si nécessaire
    if (tenant_role !== undefined) {
      db.prepare(`UPDATE tenant_users SET role = ? WHERE tenant_id = ? AND user_id = ?`).run(tenant_role, tenantId, userId);
    }

    res.json({ success: true, message: 'Utilisateur modifié' });
  } catch (error) {
    console.error('[Platform] Error updating tenant user:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur modification utilisateur' });
  }
});

// Supprimer un utilisateur d'un tenant
router.delete('/tenants/:id/users/:userId', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.id as string);
    const userId = parseInt(req.params.userId as string);

    const tenant = db.prepare('SELECT id FROM tenants WHERE id = ?').get(tenantId) as any;
    if (!tenant) return res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant introuvable' });

    const user = db.prepare('SELECT id FROM users WHERE id = ? AND tenant_id = ?').get(userId, tenantId) as any;
    if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'Utilisateur introuvable' });

    // Supprimer la liaison tenant_users
    db.prepare('DELETE FROM tenant_users WHERE tenant_id = ? AND user_id = ?').run(tenantId, userId);

    // Optionnel : supprimer l'utilisateur de la table users
    // db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ success: true, message: 'Utilisateur supprimé du tenant' });
  } catch (error) {
    console.error('[Platform] Error deleting tenant user:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur suppression utilisateur' });
  }
});

// =============================================================================
// CRUD Tenants (création/modification)
// =============================================================================

// Créer un tenant
router.post('/tenants', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const { name, slug, owner_email, phone, country, city, plan_id } = req.body;

    if (!name || !slug || !owner_email) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'name, slug et owner_email requis' });
    }

    // Vérifier que le slug n'existe pas
    const existing = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug) as any;
    if (existing) {
      return res.status(400).json({ error: 'SLUG_EXISTS', message: 'Ce slug existe déjà' });
    }

    const result = db.prepare(`
      INSERT INTO tenants (name, slug, owner_email, owner_phone, country, city, status, is_provisioned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', 0, datetime('now'), datetime('now'))
    `).run(name, slug, owner_email, phone || null, country || null, city || null);

    const tenantId = result.lastInsertRowid;

    // Créer l'utilisateur owner si plan_id fourni
    if (plan_id) {
      const bcrypt = require('bcryptjs');
      const defaultPassword = bcrypt.hashSync('changeme123', 10);

      const userResult = db.prepare(`
        INSERT INTO users (email, full_name, phone, username, password_hash, pin_code, role, tenant_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'owner', ?, 1, datetime('now'), datetime('now'))
      `).run(owner_email, name, phone || null, slug, defaultPassword, '0000', tenantId);

      db.prepare(`
        INSERT INTO tenant_users (tenant_id, user_id, role, is_active, created_at)
        VALUES (?, ?, 'owner', 1, datetime('now'))
      `).run(tenantId, userResult.lastInsertRowid);
    }

    res.json({ success: true, message: 'Tenant créé', tenantId });
  } catch (error) {
    console.error('[Platform] Error creating tenant:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur création tenant' });
  }
});

// Modifier un tenant
router.put('/tenants/:id', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.id as string);
    const { name, slug, owner_email, owner_name, phone, country, city, status } = req.body;

    const tenant = db.prepare('SELECT id FROM tenants WHERE id = ?').get(tenantId) as any;
    if (!tenant) return res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant introuvable' });

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (slug !== undefined) { updates.push('slug = ?'); params.push(slug); }
    if (owner_email !== undefined) { updates.push('owner_email = ?'); params.push(owner_email); }
    if (owner_name !== undefined) { updates.push('owner_name = ?'); params.push(owner_name); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (country !== undefined) { updates.push('country = ?'); params.push(country); }
    if (city !== undefined) { updates.push('city = ?'); params.push(city); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }

    updates.push("updated_at = datetime('now')");
    params.push(tenantId);

    db.prepare(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    res.json({ success: true, message: 'Tenant modifié' });
  } catch (error) {
    console.error('[Platform] Error updating tenant:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur modification tenant' });
  }
});

export default router;
