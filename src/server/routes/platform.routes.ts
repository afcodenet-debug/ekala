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

export default router;
