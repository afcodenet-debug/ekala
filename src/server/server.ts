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
import authRoutes from './routes/auth';
import authSetupRoutes from './routes/auth-setup';
import settingsRoutes from './routes/settings';
import logsRoutes from './routes/logs';
import customersRoutes from './routes/customers';
import notificationsRoutes from './routes/notifications';
import notificationPreferencesRoutes from './routes/notification_preferences';
import scheduledReportsLogRoutes from './routes/scheduled_reports_log';
import db, { initializeDatabase } from './db/database';
import { startSupabasePullWorker, getPullSyncStatus } from './services/supabase-pull-sync.service';
import { startScheduledReports } from './services/scheduled-reports.service';
import { initializeProductSync, getOrderSyncService, SyncOrchestrator, UserTenantSyncService } from '../sync';
import { env } from './config/env';
import { createSaaSRouter } from './saas/saas.routes';
import { createSaaSPaymentRouter } from './saas/saas-payment.routes';
import { startSubscriptionExpirationCron } from './saas/cron/subscription-expiration.cron';

const app = express();

// Initialize the local database schema (Forward migrations + safety net columns + seeding)
// This is critical to ensure columns like remote_id exist before sync workers start.
if (db) {
  try {
    initializeDatabase();
    console.log('[RENDER BOOT] Database schema initialized/verified.');
  } catch (err: any) {
    console.error('[RENDER BOOT] CRITICAL: Database initialization failed:', err?.message || err);
  }
}

const PORT = process.env.PORT || 3001;

app.use(express.json());

// =============================================
// FORENSIC REQUEST LOGGING (before everything)
// =============================================
app.use((req, res, next) => {
  console.log('[HTTP]', req.method, req.originalUrl, 'origin=', req.headers.origin || 'none');
  next();
});

// =============================================
// CORS - reflechit les origines autorisées au lieu de "*"
// =============================================
const ALLOWED_ORIGINS = new Set<string | undefined>([
  process.env.FRONTEND_BASE_URL,
  process.env.VITE_FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.RENDER_EXTERNAL_URL,
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
    res.json({
      worker: {
        running: s.workerRunning,
        enabled: s.enabled,
        intervalMs: s.pullIntervalMs,
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

// Core API used by the admin/staff frontend (POS, Tables, Orders, Dashboard, Expenses)
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
app.use('/api/auth', authRoutes);
app.use('/api/auth', authSetupRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/notification_preferences', notificationPreferencesRoutes);
app.use('/api/scheduled_reports_log', scheduledReportsLogRoutes);

// =============================================================================
// SaaS Multi-Tenant Routes (Phase 1 + 3)
// =============================================================================
app.use('/api', createSaaSRouter());
app.use('/api', createSaaSPaymentRouter());
startSubscriptionExpirationCron();

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
  // Auto-enabled when SUPABASE_URL + SERVICE_ROLE_KEY are present (unless explicitly disabled with ENABLE_SUPABASE_PULL=false).
  // This is what makes customer orders from the public QR Menu appear in the staff POS.
  startSupabasePullWorker();

  // Scheduled email reports (Morning / Midday / EOD)
  // Only starts on local POS machines (not in pure cloud mode)
  if (!env.RENDER_CLOUD_MODE) {
    startScheduledReports();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Bidirectional product stock + inventory_movements sync (SQLite ↔ Supabase)
  // Uses the outbox engine. Runs in the SAME process that performs the writes
  // (sales.ts / products.ts), so queueChange calls actually create outbox rows.
  // ─────────────────────────────────────────────────────────────────────────────
  if (!env.RENDER_CLOUD_MODE && db) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const businessId = process.env.SYNC_BUSINESS_ID || 'default-business';

    if (supabaseUrl && supabaseKey) {
      try {
        const syncService = initializeProductSync(db, supabaseUrl, supabaseKey);
        const orderService = getOrderSyncService();
        const userTenantService = new UserTenantSyncService(db, supabaseUrl, supabaseKey);
        const orchestrator = new SyncOrchestrator(syncService, orderService, userTenantService, db, businessId);
        orchestrator.startScheduler(30000);           // PUSH + PULL every 30s
        orchestrator.triggerSync().catch(() => {});   // kick off immediately

        console.log(`[ProductSync] Bidirectional engine started (businessId=${businessId}, 30s interval)`);
        console.log('[ProductSync] Stock adjustments and QR checkout sales will now push to Supabase');
      } catch (err: any) {
        console.error('[ProductSync] Failed to initialize bidirectional sync:', err?.message || err);
      }
    } else {
      console.warn('[ProductSync] SUPABASE_URL or key missing — product sync disabled');
    }
  }
});
