// ⭐ CRITICAL: Load dotenv FIRST, before ANY other imports that might use process.env
// This ensures VITE_APP_MODE and other env vars are available when modules are loaded
try {
  // @ts-ignore - dotenv may not be installed in production builds
  require('dotenv/config');
  console.log('[RENDER BOOT] ✅ dotenv loaded FIRST (before any imports)');
  console.log('[RENDER BOOT] VITE_APP_MODE:', process.env.VITE_APP_MODE);
  console.log('[RENDER BOOT] NODE_ENV:', process.env.NODE_ENV);
  console.log('[RENDER BOOT] RENDER_CLOUD_MODE:', process.env.RENDER_CLOUD_MODE);
} catch (err) {
  // dotenv not present — this is expected on Render with npm ci --omit=dev
  console.warn('[RENDER BOOT] ⚠️ dotenv not loaded:', err);
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
import billingRoutes from './routes/billing.routes';
import billingDebugRoutes from './routes/billing-debug.routes';
import subscriptionRoutes from './routes/subscription.routes';
import { db, initializeDatabase } from './db/database';
import { startSupabasePullWorker, getPullSyncStatus } from './services/supabase-pull-sync.service';
import { startSupabaseRealtimePull, getSupabaseRealtimeStatus } from './services/supabase-realtime-sync.service';
import { startScheduledReports } from './services/scheduled-reports.service';
// Note: Direct sync imports not needed here - sync is initialized via require() inside listen() callback
// to ensure db is ready. The sync engine uses the V2 orchestrator for all tables.
import { SyncOrchestratorV2 } from '../sync';
import { env } from './config/env';
import { dataSource } from './infrastructure/data-source-manager';
import { createSaaSRouter } from './saas/saas.routes';
import { createSaaSPaymentRouter } from './saas/saas-payment.routes';
import { startSubscriptionExpirationCron } from './saas/cron/subscription-expiration.cron';
import { startVoucherExpirationCron } from './saas/cron/voucher-expiration.cron';
import { startExpirationCron } from './saas/cron/expiration.cron';
import { adminSubscriptionsRouter, adminVouchersRouter } from './routes/admin.subscriptions';
import platformRoutes from './routes/platform.routes';
import syncDiagnosticRoutes from './routes/sync-diagnostic.routes';
import platformAuthRoutes from './platform/platform-auth.routes';
import platformPlansRouter from './routes/platform.plans.routes';
import { bootstrapPlatform } from './platform/platform-bootstrap';
import diagnosticRoutes from './routes/diagnostic-build.routes';
import syncRoutes from './routes/sync';
import traceRoutes from './routes/trace.routes';
import eventStoreRoutes from './routes/event-store.routes';
import { OutboxWorker } from './infrastructure/synchronization/outbox-worker';
import runtimeHealthRoutes from './runtime/runtime-health.routes';

const app = express();

let bootError: any = null;

// Initialize the local database schema (Forward migrations + safety net columns + seeding)
// This is critical to ensure columns like remote_id exist before sync workers start.
// IMPORTANT: Must be called BEFORE any other module imports db or uses database functions.
try {
  initializeDatabase();
  console.log('[RENDER BOOT] Database schema initialized/verified.');

  // LOCAL mode: trace_events is a debug-only table used to sync to Supabase.
  // In LOCAL there is no Supabase, so it just accumulates stale rows (can reach
  // hundreds of thousands) and bloat the DB. Clear it once at startup.
  if (dataSource.isLocal()) {
    try {
      const db = require('./db/database').default;
      const before = db.prepare('SELECT COUNT(*) AS c FROM traces_events').get().c;
      if (before > 0) {
        db.prepare('DELETE FROM traces_events').run();
        console.log(`[TraceV5] LOCAL mode: cleared ${before} stale trace events`);
      }
    } catch { /* best-effort */ }
  }
} catch (err: any) {
  bootError = err;
  console.error('[RENDER BOOT] initializeDatabase failed:', err);
}

// ⭐ DIAGNOSTIC: Log runtime mode detection
import { RuntimeContext } from '../core/runtime/runtime-context';
const runtime = RuntimeContext.getInstance();
console.log('[RENDER BOOT] Runtime mode:', runtime.toString());
console.log('[RENDER BOOT] isLocal:', runtime.isLocal);
console.log('[RENDER BOOT] isCloud:', runtime.isCloud);
console.log('[RENDER BOOT] isHybrid:', runtime.isHybrid);
console.log('[RENDER BOOT] VITE_APP_MODE from process.env:', process.env.VITE_APP_MODE);

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
  bootError = err;
  console.error('[RENDER BOOT] Startup migrations failed:', err);
  // Don't throw — allow server to start
}

const PORT = process.env.PORT || 3001;

// Increase JSON body size limit to handle large payloads (e.g., base64 images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Runtime health check routes (no auth required)
app.use('/', runtimeHealthRoutes);

// =============================================
// CORS - reflechit les origines autorisées au lieu de "*"
// =============================================
// ⭐ CRITICAL: CORS must be BEFORE all routes to ensure headers are set on every response
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
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-role, x-runtime-mode');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// =============================================
// FORENSIC REQUEST LOGGING + TENANT CONTEXT
// =============================================
import { tenantStorage } from './db/tenant-context';
import { verifyJwt } from './middleware/jwt-auth';
import { TraceManager, traceStorage } from './services/trace-manager.service';

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
// FORENSIC TRACE v3 — BEGIN/END per HTTP request
// =============================================
// Wraps every request in a TraceManager with guaranteed flush() in finally.
// This is the outermost layer — it captures BEGIN and END for every request.
app.use((req, res, next) => {
  // Skip health checks to reduce noise
  if (req.path === '/health' || req.path === '/test') {
    return next();
  }

  const trace = new TraceManager();
  trace.enter('BEGIN', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    user_agent: req.headers['user-agent']?.substring(0, 100),
  });

  // Store trace in AsyncLocalStorage for downstream propagation
  traceStorage.run(trace, () => {
    // Intercept res.end to capture response status code
    const originalEnd = res.end.bind(res);
    res.end = function (this: any, ...args: any[]) {
      try {
        trace.response(res.statusCode, {
          content_length: res.getHeader('content-length') || undefined,
        });
      } catch {
        // Never throw in end interceptor
      }
      return originalEnd(...args);
    } as any;

    try {
      next();
    } catch (err) {
      trace.error('BEGIN', err, { phase: 'middleware_unhandled' });
      throw err;
    } finally {
      trace.flush();
    }
  });
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
  // Use originalUrl to catch all /api/auth/* routes regardless of mount point
  if (req.originalUrl.startsWith('/api/auth')) {
    return next();
  }

  // Public QR Menu endpoints (no JWT required - customers access via QR code)
  // GET /api/menu/table/:qr_token
  // POST /api/menu/register-customer
  // POST /api/menu/checkout
  // GET /api/menu/order-status/:qr_token/:orderId
  if (p.startsWith('/menu')) {
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
  // Platform auth (login) is public
  // POST /api/platform/auth/login
  // Platform auth endpoints (plateforme) - gérés par requirePlatformAuth
  // Legacy subscription status (public, for login page)
  // GET /api/v1/subscription/status/:tenantId
  if (p.startsWith('/diagnostic') ||
      p.startsWith('/platform') ||
      p === '/plans' || p.startsWith('/plans') ||
      p === '/tenants' || p.startsWith('/tenants/') ||
      p.startsWith('/payments') || p.startsWith('/webhooks') ||
      p.startsWith('/v1/subscription/status')) {
    return next();
  }

  requireJwtAuth(req, res, next);
});

// Strict Tenant Scoping for ALL other /api routes
app.use('/api', (req, res, next) => {
  const p = req.path;

  if (p === '/health') return next();

  // Auth endpoints are public and already handled by their own route guards
  if (p.startsWith('/auth')) return next();

  // SaaS endpoints are public and do not rely on tenant scope from JWT
  // Public QR Menu endpoints
  // Legacy public subscription status (used by the login page to check a
  // tenant's plan BEFORE authentication) is also public — it takes tenantId
  // from the URL, not the JWT. Skipping here avoids a spurious 401 that would
  // otherwise trigger a global logout on the login screen.
  if (p.startsWith('/menu') ||
      p.startsWith('/diagnostic') ||
      p.startsWith('/platform') ||
      p === '/plans' || p === '/tenants' || p.startsWith('/tenants/') ||
      p.startsWith('/payments') || p.startsWith('/webhooks') ||
      p.startsWith('/v1/subscription/status')) {
    return next();
  }

  requireTenantScope(req, res, next);
});

// Subscription Guard — intercepts all protected API requests
// Place AFTER tenant scope (which injects tenant_id) and BEFORE routes
app.use('/api', async (req, res, next) => {
  // Skip subscription check for health, sync status, and SaaS / subscription flows
  const isPaymentOrVoucherFlow =
    req.path.startsWith('/checkout') ||
    req.path.startsWith('/payments/') ||
    req.path.startsWith('/webhooks') ||
    req.path.startsWith('/billing') ||
    req.path.startsWith('/vouchers') ||
    req.path.startsWith('/admin/subscriptions') ||
    req.path.startsWith('/admin/vouchers');

  if (
    req.path === '/health' ||
    req.path === '/sync/status' ||
    req.path.startsWith('/saas') ||
    req.path.startsWith('/subscription') ||
    isPaymentOrVoucherFlow ||
    req.path.startsWith('/plans') ||
    (req.path.startsWith('/tenants') && ['GET','HEAD','OPTIONS'].includes(req.method))
  ) {
    console.log('[SubGuard:SKIP]', { method: req.method, path: req.path, paymentFlow: isPaymentOrVoucherFlow });
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
      res.setHeader('X-Subscription-Warning', 'grace_period');
      res.setHeader('X-Subscription-Grace-Days', String(sub.graceDaysRemaining || 0));
      return next();
    }

    // expired | suspended | cancelled | no_plan | pending
    console.log('[403:SUBSCRIPTION_BLOCKED]', {
      tenantId, userId: (req as any).user?.sub, state: sub.state, method: req.method, path: req.originalUrl
    });

    const readOnlyPaths = ['/billing', '/subscription', '/profile', '/vouchers', '/admin/subscriptions', '/admin/vouchers'];
    const isReadOnlyPath = readOnlyPaths.some(p => req.path.startsWith(p));

    if (isReadOnlyPath) return next();

    return res.status(403).json({
      error: sub.state === 'pending' ? 'SUBSCRIPTION_PENDING' : 'SUBSCRIPTION_REQUIRED',
      message: sub.state === 'pending'
        ? 'Compte en attente d\'activation. Veuillez saisir un code voucher.'
        : sub.state === 'no_plan'
          ? 'Aucun abonnement actif. Choisissez un plan pour continuer.'
          : sub.state === 'cancelled'
            ? 'Abonnement annulé. Souscrivez à un nouveau plan.'
            : 'Abonnement expiré. Activez un voucher pour continuer.',
      state: sub.state,
      planName: sub.planName,
      daysUntilRenewal: sub.daysUntilRenewal,
      renewalUrl: '/billing',
      pricingUrl: '/pricing',
    });
  } catch (err: any) {
    console.error('[SubGuard] Middleware error:', err.message);
    console.error('[SubGuard] Stack:', err?.stack);
    // Propager l'erreur à l'error handler global pour qu'elle soit rendue en JSON
    // plutôt que de laisser Express produire du HTML
    return next(err);
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
app.use('/api/billing', billingRoutes);

// Legacy route: /api/v1/subscription/status/:tenantId → billing router handler.
// The billing router is mounted at /api/billing and its routes are defined
// relative to that mount (e.g. /v1/subscription/status/:tenantId). When we
// forward by calling the router directly we must use the path relative to the
// router (i.e. /v1/...), NOT the full /api/billing/v1/... path, otherwise no
// route matches and the request 404s.
app.get('/api/v1/subscription/status/:tenantId', (req, res) => {
  const billingRouter = require('./routes/billing.routes').default;
  req.url = `/v1/subscription/status/${req.params.tenantId}`;
  billingRouter(req, res, () => {
    res.status(404).json({ error: 'NOT_FOUND' });
  });
});
app.use('/api/billing', billingDebugRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin/subscriptions', adminSubscriptionsRouter);
app.use('/api/admin/vouchers', adminVouchersRouter);

// =============================================================================
// Platform Auth Routes — MUST BE FIRST (no tenant scope required)
// =============================================================================
app.use('/api/platform', platformAuthRoutes);

// =============================================================================
// Platform Routes (Super Admin) — MUST BE BEFORE tenant scope middleware
// =============================================================================
app.use('/api/platform', platformRoutes);
app.use('/api/platform', platformPlansRouter);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api/sync', syncRoutes);

// =============================================================================
// Sync Diagnostic Routes
// =============================================================================
app.use('/api/platform', syncDiagnosticRoutes);

// =============================================================================
// Forensic Trace Routes — Replay, search, anomaly detection
// =============================================================================
// Public diagnostic endpoints — no auth required for trace debugging
app.use('/api', traceRoutes);
app.use('/api', eventStoreRoutes);

// =============================================================================
// GLOBAL ERROR HANDLER — Convertit TOUTES les erreurs en JSON
// =============================================================================
// SANS CE MIDDLEWARE, Express retourne des pages HTML <pre>Internal Server Error</pre>
// qui cassent les clients attendus du JSON (frontend React, API consumers).
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[FATAL] Unhandled error:', err?.message || err);
  console.error('[FATAL] Stack:', err?.stack);
  res.status(err?.status || 500).json({
    error: err?.code || 'INTERNAL_SERVER_ERROR',
    message: err?.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' ? { stack: err?.stack } : {}),
  });
});

// =============================================================================
// SaaS Multi-Tenant Routes (Phase 1 + 3)
// =============================================================================
app.use('/api', createSaaSRouter());
app.use('/api', createSaaSPaymentRouter());
startSubscriptionExpirationCron();
startVoucherExpirationCron();
startExpirationCron();

// ─── SYNC ENGINE INITIALIZATION (SYNCHRONOUS - MUST BE BEFORE app.listen) ───
// CRITICAL: This MUST run before app.listen() so that getProductSyncService()
// works immediately when routes are called (e.g. TableService.create/delete).
let syncOrchestratorV2: any = null;
let supabaseClient: any = null;

// ⭐ LOCAL-FIRST SYNC: Enable the sync engine when:
//   - we are in CLOUD mode, OR
//   - it is explicitly requested via ENABLE_SUPABASE_SYNC, OR
//   - we are in LOCAL mode (Electron: SQLite is the source of truth) AND Supabase
//     credentials are present. In that last case the engine stays idle while the
//     app is offline and automatically pushes/pulls the moment it has an internet
//     connection (the scheduler is connectivity-gated). This makes the local
//     `products` (and other tables) sync with the Supabase `products` table
//     whenever the network is available.
const supabaseCredsPresent = Boolean(
  process.env.SUPABASE_URL &&
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
);
const shouldEnableSync =
  runtime.isCloud ||
  process.env.ENABLE_SUPABASE_SYNC === 'true' ||
  (runtime.mode === 'LOCAL' && supabaseCredsPresent && !env.RENDER_CLOUD_MODE);

// ─── Always bind the server DB to the sync module ───────────────────────────
// Even in LOCAL mode (sync engine disabled), routes call getProductSyncService()
// to queue local writes to the outbox. Without this binding those calls throw
// "ProductSyncService not initialized". This keeps writes working offline.
try {
  const { setSyncDatabase } = require('../sync/index');
  setSyncDatabase(db);
  console.log('[Sync] Server database bound to sync module (offline queueing ready)');
} catch (err: any) {
  console.warn('[Sync] Could not bind database to sync module:', err?.message);
}

if (shouldEnableSync && !env.RENDER_CLOUD_MODE && db) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const { initializeSyncV2 } = require('../sync/index');
      
      // Initialize helper DB for routes outbox  
      const { setOutboxDatabase: setOutboxDb } = require('../sync/sync-helper');
      setOutboxDb(db);
      
      syncOrchestratorV2 = initializeSyncV2(db, supabaseUrl, supabaseKey);
      supabaseClient = syncOrchestratorV2.getSupabaseClient?.() || null;
      
      console.log(`[SyncV2] Engine initialized (ALL ${26} tables covered)`);
      console.log(`[SyncV2] Mode: ${runtime.mode} | ENABLE_SUPABASE_SYNC: ${process.env.ENABLE_SUPABASE_SYNC}`);
    } catch (err: any) {
      console.error('[SyncV2] Failed to initialize sync engine:', err?.message || err);
    }
  } else {
    console.warn('[SyncV2] SUPABASE_URL or key missing — sync disabled');
  }
} else {
  if (!shouldEnableSync) {
    console.log(`[SyncV2] Sync engine disabled in ${runtime.mode} mode (set ENABLE_SUPABASE_SYNC=true to enable)`);
  } else if (env.RENDER_CLOUD_MODE) {
    console.log('[SyncV2] Sync engine disabled in RENDER_CLOUD_MODE');
  } else if (!db) {
    console.log('[SyncV2] Sync engine disabled - database not available');
  }
}

app.listen(PORT, async () => {
  console.log(`[RENDER BOOT] Express listening on port ${PORT}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACE SYSTEM v5 — ZERO LOSS INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  // 1. Crash Recovery — recover unprocessed events from disk queue
  try {
    const { recoverFromCrash, startFlushScheduler } = await import('./services/trace-flush-engine.service');
    const recovered = await recoverFromCrash();
    if (recovered > 0) {
      console.log(`[TraceV5] Crash recovery: ${recovered} events recovered from disk queue.`);
    }
    
    // 2. Start periodic flush scheduler (disk → SQLite → Supabase)
    startFlushScheduler();
  } catch (err: any) {
    console.warn('[TraceV5] Initialization warning:', err.message);
  }

  // 3. Register process hooks for crash-safe shutdown
  try {
    const { registerProcessHooks } = await import('./services/trace-process-hooks.service');
    registerProcessHooks();
  } catch (err: any) {
    console.warn('[TraceV5] Process hooks registration warning:', err.message);
  }

  // Bootstrap Super Admin Platform
  try {
    await bootstrapPlatform();
  } catch (err) {
    console.error('[RENDER BOOT] Platform bootstrap failed:', err);
  }

  if (env.RENDER_CLOUD_MODE) {
    console.log('══════════════════════════════════════════════════════════════');
    console.log('[RENDER_CLOUD_MODE] ACTIVE — Pure Supabase backend only');
    console.log('[RENDER_CLOUD_MODE] Local SQLite is FORBIDDEN on this instance');
    console.log('[RENDER_CLOUD_MODE] All data must come from Supabase (tables + products + categories)');
    console.log('══════════════════════════════════════════════════════════════');
  }

  dataSource.logStatus();
  console.log('[RENDER BOOT] endpoints mounted: /health, /test, /api/auth, /api/menu, /api/tables, /api/products, /api/categories, /api/orders, /api/sales, /api/expenses, /api/dashboard, /api/users, /api/settings, /api/logs, /api/inventory, /api/reports, /api/suppliers, /api/purchase-orders, /api/stock-adjustments');

  // Lightweight Supabase → SQLite pull worker (QR orders visibility)
  // ONLY meaningful when a real local SQLite exists (Electron / LOCAL mode).
  // In CLOUD mode there is no local SQLite (RENDER_CLOUD_MODE forbids it), so
  // these workers would crash every cycle on `db.prepare is not a function`.
  // The cloud frontend reads directly from Supabase, so no pull is needed.
  if (dataSource.isLocal() && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    startSupabasePullWorker();
    startSupabaseRealtimePull();
    console.log('[Supabase] Local SQLite detected — started pull workers (QR orders → SQLite)');
  } else if (dataSource.isCloud()) {
    console.log('[Supabase] CLOUD mode — skipping pull workers (no local SQLite, reads from Supabase directly)');
  } else if (dataSource.isLocal()) {
    console.log('[Supabase] Local mode — skipping pull workers (credentials not configured)');
  } else {
    console.log('[Supabase] Credentials not configured — skipping pull workers');
  }

  // Scheduled email reports
  if (!env.RENDER_CLOUD_MODE) {
    startScheduledReports();
  }

  // Démarrer le scheduler périodique du sync V2 (après le démarrage du serveur)
  if (syncOrchestratorV2) {
    syncOrchestratorV2.startScheduler(30000);
    console.log(`[SyncV2] Scheduler started (30s interval)`);
    
    // Premier sync immédiat (uniquement si Supabase est joignable)
    setImmediate(() => {
      syncOrchestratorV2.triggerSyncIfOnline().catch((err: any) => {
        console.error('[SyncV2] Initial sync failed:', err);
      });
    });
  }

  // Start OutboxWorkerV2 for V2.3.2 Event-Driven Architecture
  try {
    const { OutboxWorkerV2 } = require('./infrastructure/synchronization/outbox-worker-v2');
    const outboxWorkerV2 = OutboxWorkerV2.getInstance();
    
    // Set Supabase client
    if (supabaseClient) {
      outboxWorkerV2.setSupabaseClient(supabaseClient);
      outboxWorkerV2.start();
      console.log('[Server] ✓ OutboxWorkerV2 started (Event-Driven V2.3.2)');
    } else {
      console.warn('[Server] OutboxWorkerV2 not started: Supabase client not available');
    }
  } catch (err: any) {
    console.warn('[Server] OutboxWorkerV2 not started:', err?.message || err);
  }
});