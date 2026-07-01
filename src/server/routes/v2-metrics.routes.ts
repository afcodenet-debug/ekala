// =============================================================================
// V2 Metrics Route — SUB-025
// =============================================================================
// Endpoint de monitoring pour les métriques de migration V2.1
// =============================================================================

import { Router } from 'express';
import { v2EventLogger } from '../infrastructure/monitoring/v2-event-logger';
import { dualRunValidator } from '../infrastructure/validation/dual-run-validator';
import { requirePlatformAuth, requirePlatformRole } from '../platform/platform-auth.middleware';

const router = Router();

// Toutes les routes nécessitent un rôle super_admin ou ops_admin
router.use(requirePlatformAuth, requirePlatformRole(['super_admin', 'ops_admin']));

/**
 * GET /api/admin/v2-metrics
 * Retourne les métriques agrégées de la migration V2.1
 */
router.get('/', async (_req: any, res: any) => {
  try {
    const flowMetrics = v2EventLogger.getAggregatedMetrics();
    const dualRunStats = dualRunValidator.getStats();
    const recentEvents = v2EventLogger.getRecent(20);

    res.json({
      timestamp: new Date().toISOString(),
      flow: flowMetrics,
      dualRun: {
        totalRuns: dualRunStats.totalRuns,
        matches: dualRunStats.matches,
        mismatches: dualRunStats.mismatches,
        matchRate: dualRunStats.matchRate.toFixed(2) + '%',
        legacyFailures: dualRunStats.legacyFailures,
        v2Failures: dualRunStats.v2Failures,
      },
      recentEvents: recentEvents.map(e => ({
        traceId: e.traceId,
        flow: e.flow,
        path: e.path,
        result: e.result,
        latency: e.latency + 'ms',
        mismatch: e.mismatch,
        tenantId: e.tenantId,
        error: e.error,
      })),
    });
  } catch (err: any) {
    console.error('[V2Metrics] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/v2-metrics/report
 * Retourne le rapport de validation dual-run
 */
router.get('/report', async (_req: any, res: any) => {
  try {
    const report = dualRunValidator.generateReport();
    res.type('text/plain').send(report);
  } catch (err: any) {
    console.error('[V2Metrics] Report error:', err);
    res.status(500).json({ error: err.message });
  }
});

export { router as v2MetricsRouter };