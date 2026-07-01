// =============================================================================
// Observability Routes — SUB-031
// =============================================================================
// Endpoints pour le dashboard de monitoring V2.1
// =============================================================================

import { Router } from 'express';
import { requirePlatformAuth, requirePlatformRole } from '../platform/platform-auth.middleware';
import { dashboardService } from '../infrastructure/observability/dashboard-service';
import { alertingEngine } from '../infrastructure/observability/alerting-engine';
import { metricsCollector } from '../infrastructure/observability/metrics-collector';
import { v2StructuredLogger } from '../infrastructure/observability/logging-standard';

const router = Router();

// Toutes les routes nécessitent un rôle super_admin ou ops_admin
router.use(requirePlatformAuth, requirePlatformRole(['super_admin', 'ops_admin']));

/**
 * GET /api/admin/observability/dashboard
 * Dashboard complet avec 4 sections
 */
router.get('/dashboard', async (_req: any, res: any) => {
  try {
    const dashboard = dashboardService.generate();
    res.json(dashboard);
  } catch (err: any) {
    console.error('[Observability] Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/observability/metrics
 * Métriques brutes (Business, System, Architecture)
 */
router.get('/metrics', async (_req: any, res: any) => {
  try {
    const metrics = metricsCollector.collect();
    res.json(metrics);
  } catch (err: any) {
    console.error('[Observability] Metrics error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/observability/alerts
 * Alertes actives et historique
 */
router.get('/alerts', async (req: any, res: any) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const activeOnly = req.query.active === 'true';

    const alerts = activeOnly
      ? alertingEngine.getActiveAlerts()
      : alertingEngine.getHistory(limit);

    res.json({
      count: alerts.length,
      alerts,
    });
  } catch (err: any) {
    console.error('[Observability] Alerts error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/observability/alerts/:ruleId/acknowledge
 * Acquitter une alerte
 */
router.post('/alerts/:ruleId/acknowledge', async (req: any, res: any) => {
  try {
    const { ruleId } = req.params;
    alertingEngine.acknowledge(ruleId);
    res.json({ success: true, message: `Alert ${ruleId} acknowledged` });
  } catch (err: any) {
    console.error('[Observability] Acknowledge error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/observability/alerts/:ruleId/resolve
 * Résoudre une alerte
 */
router.post('/alerts/:ruleId/resolve', async (req: any, res: any) => {
  try {
    const { ruleId } = req.params;
    alertingEngine.resolve(ruleId);
    res.json({ success: true, message: `Alert ${ruleId} resolved` });
  } catch (err: any) {
    console.error('[Observability] Resolve error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/observability/logs
 * Logs structurés V2.1 avec filtres
 */
router.get('/logs', async (req: any, res: any) => {
  try {
    const { tenantId, correlationId, eventType, level, limit = 100 } = req.query;

    let logs = v2StructuredLogger.getRecent(parseInt(limit as string));

    if (tenantId) {
      logs = logs.filter(l => l.tenantId === parseInt(tenantId as string));
    }
    if (correlationId) {
      logs = logs.filter(l => l.correlationId === correlationId);
    }
    if (eventType) {
      logs = logs.filter(l => l.eventType === eventType);
    }
    if (level) {
      logs = logs.filter(l => l.level === level);
    }

    res.json({
      count: logs.length,
      logs,
    });
  } catch (err: any) {
    console.error('[Observability] Logs error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/observability/logs/trace/:correlationId
 * Tracing end-to-end par correlationId
 */
router.get('/logs/trace/:correlationId', async (req: any, res: any) => {
  try {
    const { correlationId } = req.params;
    const logs = v2StructuredLogger.getByCorrelationId(correlationId);

    res.json({
      correlationId,
      count: logs.length,
      logs,
    });
  } catch (err: any) {
    console.error('[Observability] Trace error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/observability/health
 * Health check rapide
 */
router.get('/health', async (_req: any, res: any) => {
  try {
    const dashboard = dashboardService.generate();
    res.json({
      status: dashboard.systemHealth.globalStatus,
      healthScore: dashboard.systemHealth.healthScore,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Observability] Health error:', err);
    res.status(500).json({ error: err.message });
  }
});

export { router as observabilityRouter };