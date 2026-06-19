// === Environment loading (local only) ===
// Render + production builds do NOT have dotenv installed (npm ci --omit=dev).
// We use require + ts-ignore to avoid TypeScript complaining about the missing module.
if (process.env.NODE_ENV !== 'production' && !process.env.RENDER_CLOUD_MODE) {
  try {
    // @ts-ignore - dotenv may not be installed in production builds
    require('dotenv/config');
  } catch {
    // dotenv not present — this is expected on Render
  }
}

import express from 'express';
import menuRoutes from './routes/menu';
import tablesRoutes from './routes/tables';
import productsRoutes from './routes/products';
import ordersRoutes from './routes/orders';
import expensesRoutes from './routes/expenses';
import dashboardRoutes from './routes/dashboard';
import categoriesRoutes from './routes/categories';
import usersRoutes from './routes/users';
import salesRoutes from './routes/sales';
import suppliersRoutes from './routes/suppliers';
import purchaseOrdersRoutes from './routes/purchase-orders';
import stockAdjustmentsRoutes from './routes/stock-adjustments';
import inventoryRoutes from './routes/inventory';
import reportsRoutes from './routes/reports';
import authService from './services/auth.service';
import settingsRoutes from './routes/settings';
import logsRoutes from './routes/logs';
import customersRoutes from './routes/customers';
import notificationsRoutes from './routes/notifications';
import notificationPreferencesRoutes from './routes/notification_preferences';
import scheduledReportsLogRoutes from './routes/scheduled_reports_log';
import vouchersRoutes from './routes/vouchers';
import voucherPurchaseRoutes from './routes/voucher-purchase';
import db, { initializeDatabase } from './db/database';
import { startSupabasePullWorker, getPullSyncStatus } from './services/supabase-pull-sync.service';
import { startSupabaseRealtimePull, getSupabaseRealtimeStatus } from './services/supabase-realtime-sync.service';
import { startScheduledReports } from './services/scheduled-reports.service';
// Note: Direct sync imports not needed here - sync is initialized via require() inside listen() callback
// to ensure db is ready. The sync engine uses the V2 orchestrator for all tables.
import { SyncOrchestratorV2 } from '../sync';
import { env } from './config/env';
import { createSaaSRouter } from './saas/saas.routes';
import { createSaaSPaymentRouter } from './saas/saas-payment.routes';
import { startSubscriptionExpirationCron } from './saas/cron/subscription-expiration.cron';

const app = express();

// Initialize the local database schema (Forward migrations + safety net columns + seeding)
// This is critical to ensure columns like remote_id exist before sync workers start.
// IMPORTANT: Must be called BEFORE any other module imports db or uses database functions.
initializeDatabase();
console.log('[RENDER BOOT] Database schema initialized/verified.');

// ⭐ FIX: Run startup migrations to ensure all critical columns exist
// This prevents "no such column: tenant_id" errors during sync
try {
  const renderCloud = env.RENDER_CLOUD_MODE === true || String(env.RENDER_CLOUD_MODE) === 'true';
  if (renderCloud) {
    console.log('[RENDER BOOT] Cloud mode detected — skipping SQLite startup migrations (Supabase-only).');
  } else if (!db) {
    console.log('[RENDER BOOT] SQLite db not available — skipping startup migrations.');
  } else {
    const { runStartupMigrations } = require('../sync/startup-migration');
    runStartupMigrations(db);
    console.log('[RENDER BOOT] Startup migrations completed successfully');
  }
} catch (err: any) {
  console.error('[RENDER BOOT] Startup migrations failed:', err);
  // Don't throw — allow server to start
}

const PORT = process.env.PORT || 3001;

// Increase JSON body size limit to handle large payloads (e.g., base64 images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// =============================================
// FORENSIC REQUEST LOGGING + TENANT CONTEXT
// =============================================
import { tenantStorage } from './db/tenant-context';
import { verifyJwt } from './middleware/jwt-auth';

app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log('[HTTP]', req.method, req.originalUrl);
  }
  
  let tenantId: number | undefined;
  let userId: number | undefined;

  // Inject tenant_id from JWT into req for multi-tenant isolation
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = verifyJwt(token);
      
      if (payload) {
        tenantId = payload.tenant_id;
        userId = payload.sub;
        (req as any).tenant_id = tenantId;
        (req as any).user_id = userId;
        (req as any).user = payload;
      } else {
        // Log explicitly why token failed if it's not a public route
        if (!req.path.startsWith('/api/auth') && !req.path.startsWith('/menu')) {
          console.warn(`[Auth] Invalid token provided for protected route: ${req.originalUrl}`);
        }
      }
    }
  } catch (err) {
    console.error('[Auth] Context injection error:', err);
  }
  
  if (tenantId) {
    tenantStorage.run({ tenantId, userId }, () => {
      next();
    });
  } else {
    next();
  }
});

// =============================================
// CORS - reflechit les origines autorisées au lieu de "*"
// =============================================
const ALLOWED_ORIGINS = new Set<string | undefined>([
  process.env.FRONTEND_BASE_URL,
  process.env.VITE_FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://ekala.vercel.app',
  process.env.RENDER_EXTERNAL_URL,
  ...(env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map(o => o.trim()) : [])
].filter(Boolean));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : undefined;

  res.setHeader('Vary', 'Origin');
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-role');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// --- Render boot diagnostics (safe, low impact) ---
app.get('/test', (_req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

// Operational pull sync status (QR orders Supabase → local SQLite)
app.get('/api/sync/status', (_req, res) => {
  try {
    const s = getPullSyncStatus();
    const realtime = getSupabaseRealtimeStatus();
    res.json({
      worker: {
        running: s.workerRunning,
        enabled: s.enabled,
        intervalMs: s.pullIntervalMs,
      },
      realtime: {
        enabled: realtime.enabled,
        subscribed: realtime.subscribed,
        tables: realtime.tables,
        lastEventAt: realtime.lastEventAt,
        lastError: realtime.lastError,
        eventsApplied: realtime.eventsApplied,
      },
      lastPullAt: s.lastPullAt,
      lastSuccessfulPullAt: s.lastSuccessfulPullAt,
      lastCursor: s.lastCursor,
      counters: {
        ordersPulled: s.ordersPulled,
        ordersInserted: s.ordersInserted,
        ordersUpdated: s.ordersUpdated,
        itemsPulled: s.itemsPulled,
      },
      lastError: s.lastError,
      errors: s.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

console.log('[RENDER START] booting express server...');
console.log('[RENDER START] PORT=', PORT);

app.use('/api/menu', menuRoutes);
app.use('/menu', menuRoutes);   // clean public URLs for QR codes (e.g. /menu/table/<token>)

import { requireTenantScope } from './middleware/tenant-scope';
import { requireActiveSubscription, requireSubscriptionForWrites, getSubscriptionStatus, invalidateSubscriptionCache } from './middleware/subscription-guard';
import { logSubscriptionEvent } from './middleware/subscription-audit-logger';

app.use('/api/auth', authService); // Public

// JWT Authentication - extracts user from Bearer token and sets req.user
import { requireJwtAuth } from './middleware/jwt-auth';
app.use('/api', (req, res, next) => {
  const p = req.path;

  // Skip JWT auth for health endpoint and public paths
  if (p === '/health' || p === '/sync/status') {
    return next();
  }

  // Also skip for auth endpoints (they handle their own auth)
  if (p.startsWith('/auth')) {
    return next();
  }

  // SaaS public endpoints (MVP) - no JWT required
  // GET /api/plans
  // POST /api/tenants
  // GET /api/tenants/:id
  // GET /api/tenants/check-email
  // Payment endpoints (public webhooks)
  // GET /api/payments/status
  // GET /api/payments/:providerRef/status
  // POST /api/payments/:providerRef/confirm
  // POST /api/webhooks/*
  if (p === '/plans' || p.startsWith('/plans') || 
      p === '/tenants' || p.startsWith('/tenants/') ||
      p.startsWith('/payments') || p.startsWith('/webhooks')) {
    return next();
  }

  requireJwtAuth(req, res, next);
});

// Strict Tenant Scoping for ALL other /api routes
app.use('/api', (req, res, next) => {
  const p = req.path;

  if (p === '/health') return next();

  // SaaS endpoints are public and do not rely on tenant scope from JWT
  if (p === '/plans' || p === '/tenants' || p.startsWith('/tenants/') ||
      p.startsWith('/payments') || p.startsWith('/webhooks')) {
    return next();
  }

  requireTenantScope(req, res, next);
});

// Subscription Guard — intercepts all protected API requests
// Place AFTER tenant scope (which injects tenant_id) and BEFORE routes
app.use('/api', async (req, res, next) => {
  // Skip subscription check for health, sync status, and SaaS routes
  if (req.path === '/health' || req.path === '/sync/status' || req.path.startsWith('/saas') || req.path.startsWith('/voucher-purchase')) {
    return next();
  }

  try {
    const tenantId = (req as any).tenant_id;
    if (!tenantId) return next(); // No tenant context → skip

    const sub = await getSubscriptionStatus(tenantId);
    (req as any).subscription = sub;

    // Log the event
    const event = sub.state === 'active' || sub.state === 'trial'
      ? 'ACCESS_GRANTED'
      : sub.state === 'grace'
        ? (['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? 'ACCESS_READ_ONLY' : 'ACCESS_DENIED_WRITE')
        : 'ACCESS_BLOCKED';

    logSubscriptionEvent({
      event,
      tenantId,
      userId: (req as any).user?.sub,
      subscription: sub,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Enforce access control
    if (sub.state === 'active' || sub.state === 'trial') {
      return next();
    } else if (sub.state === 'grace') {
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        res.setHeader('X-Subscription-Warning', 'grace_period');
        res.setHeader('X-Subscription-Grace-Days', String(sub.graceDaysRemaining || 0));
        return next();
      }
      return res.status(403).json({
        error: 'SUBSCRIPTION_GRACE_PERIOD',
        message: 'Abonnement expiré — accès en lecture seule pendant la période de grâce.',
        graceDaysRemaining: sub.graceDaysRemaining,
        planName: sub.planName,
        renewalUrl: '/billing',
      });
    } else {
      return res.status(403).json({
        error: 'SUBSCRIPTION_REQUIRED',
        message: sub.state === 'no_plan'
          ? 'Aucun abonnement actif. Choisissez un plan pour continuer.'
          : sub.state === 'cancelled'
            ? 'Abonnement annulé. Souscrivez à un nouveau plan.'
            : 'Abonnement expiré. Renouvelez pour continuer.',
        state: sub.state,
        planName: sub.planName,
        daysUntilRenewal: sub.daysUntilRenewal,
        renewalUrl: '/billing',
        pricingUrl: '/pricing',
      });
    }
  } catch (err: any) {
    console.error('[SubGuard] Middleware error:', err.message);
    // Fail-open: allow request on error
    return next();
  }
});

// Routes now receive req.tenant_id guaranteed
app.use('/api/tables', tablesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);
app.use('/api/stock-adjustments', stockAdjustmentsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/notification_preferences', notificationPreferencesRoutes);
app.use('/api/scheduled_reports_log', scheduledReportsLogRoutes);
app.use('/api/vouchers', vouchersRoutes);
app.use('/api/voucher-purchase', voucherPurchaseRoutes);

// =============================================================================
// SaaS Multi-Tenant Routes (Phase 1 + 3)
// =============================================================================
app.use('/api', createSaaSRouter());
app.use('/api', createSaaSPaymentRouter());
startSubscriptionExpirationCron();

// ─── SYNC ENGINE INITIALIZATION (SYNCHRONOUS - MUST BE BEFORE app.listen) ───
// CRITICAL: This MUST run before app.listen() so that getProductSyncService()
// works immediately when routes are called (e.g. TableService.create/delete).
let syncOrchestratorV2: any = null;

if (!env.RENDER_CLOUD_MODE && db) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const { initializeSyncV2 } = require('../sync/index');
      
      // Initialize helper DB for routes outbox  
      const { setOutboxDatabase: setOutboxDb } = require('../sync/sync-helper');
      setOutboxDb(db);
      
      syncOrchestratorV2 = initializeSyncV2(db, supabaseUrl, supabaseKey);
      
      console.log(`[SyncV2] Engine initialized (ALL ${26} tables covered)`);
    } catch (err: any) {
      console.error('[SyncV2] Failed to initialize sync engine:', err?.message || err);
    }
  } else {
    console.warn('[SyncV2] SUPABASE_URL or key missing — sync disabled');
  }
}

app.listen(PORT, () => {
  console.log(`[RENDER BOOT] Express listening on port ${PORT}`);

  if (env.RENDER_CLOUD_MODE) {
    console.log('══════════════════════════════════════════════════════════════');
    console.log('[RENDER_CLOUD_MODE] ACTIVE — Pure Supabase backend only');
    console.log('[RENDER_CLOUD_MODE] Local SQLite is FORBIDDEN on this instance');
    console.log('[RENDER_CLOUD_MODE] All data must come from Supabase (tables + products + categories)');
    console.log('══════════════════════════════════════════════════════════════');
  }

  console.log(
    `Supabase mode → PRODUCTS=${env.USE_SUPABASE_PRODUCTS}, TABLES=${env.USE_SUPABASE_TABLES}, RENDER_CLOUD_MODE=${env.RENDER_CLOUD_MODE}`
  );
  console.log('[RENDER BOOT] endpoints mounted: /health, /test, /api/auth, /api/menu, /api/tables, /api/products, /api/categories, /api/orders, /api/sales, /api/expenses, /api/dashboard, /api/users, /api/settings, /api/logs, /api/inventory, /api/reports, /api/suppliers, /api/purchase-orders, /api/stock-adjustments');

  // Lightweight Supabase → SQLite pull worker (QR orders visibility)
  startSupabasePullWorker();

  // Realtime Supabase → SQLite pull bridge for full bidirectional parity
  startSupabaseRealtimePull();

  // Scheduled email reports
  if (!env.RENDER_CLOUD_MODE) {
    startScheduledReports();
  }

  // Démarrer le scheduler périodique du sync V2 (après le démarrage du serveur)
  if (syncOrchestratorV2) {
    syncOrchestratorV2.startScheduler(30000);
    console.log(`[SyncV2] Scheduler started (30s interval)`);
    
    // Premier sync immédiat
    setImmediate(() => {
      syncOrchestratorV2.triggerSync().catch((err: any) => {
        console.error('[SyncV2] Initial sync failed:', err);
      });
    });
  }
});
