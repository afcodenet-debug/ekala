// =============================================================================
// Sync Diagnostic Routes — Monitoring santé synchronisation
// =============================================================================

import { Router, Request, Response } from 'express';
import { requirePlatformAuth } from '../platform/platform-auth.middleware';
import db from '../db/database';

const router = Router();

// GET /platform/sync/health — Santé globale de la synchronisation
router.get('/sync/health', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        sqlite: false,
        supabase: false,
        outbox: false,
        recent_sync: false,
      },
      metrics: {
        total_outbox_jobs: 0,
        pending_jobs: 0,
        failed_jobs: 0,
        last_sync_at: null as string | null,
      },
      issues: [] as string[],
    };

    // Check 1: SQLite accessible
    try {
      await db('tenants').count('id as count').first();
      health.checks.sqlite = true;
    } catch (e) {
      health.issues.push('SQLite inaccessible');
      health.status = 'degraded';
    }

    // Check 2: Supabase accessible (via outbox jobs)
    try {
      const recentJobs = await db('sync_outbox')
        .where('created_at', '>', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .count('id as count')
        .first();
      
      health.checks.supabase = true;
      health.metrics.total_outbox_jobs = parseInt((recentJobs as any)?.count as string || '0');
    } catch (e) {
      health.issues.push('Supabase sync outbox inaccessible');
      health.status = 'degraded';
    }

    // Check 3: Outbox has jobs
    try {
      const pending = await db('sync_outbox').where('status', 'pending').count('id as count').first();
      const failed = await db('sync_outbox').where('status', 'failed').count('id as count').first();
      
      health.checks.outbox = true;
      health.metrics.pending_jobs = parseInt((pending as any)?.count as string || '0');
      health.metrics.failed_jobs = parseInt((failed as any)?.count as string || '0');
    } catch (e) {
      health.issues.push('Outbox inaccessible');
      health.status = 'degraded';
    }

    // Check 4: Recent sync activity
    try {
      const lastJob = await db('sync_outbox')
        .orderBy('created_at', 'desc')
        .limit(1)
        .first();
      
      if (lastJob) {
        const lastSync = new Date(lastJob.created_at);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        if (lastSync > fiveMinutesAgo) {
          health.checks.recent_sync = true;
          health.metrics.last_sync_at = lastJob.created_at;
        } else {
          health.issues.push('Aucune synchronisation récente (> 5min)');
          if (health.status === 'healthy') health.status = 'warning';
        }
      } else {
        health.issues.push('Aucun job de synchronisation trouvé');
        if (health.status === 'healthy') health.status = 'warning';
      }
    } catch (e) {
      health.issues.push('Erreur vérification sync récente');
      health.status = 'degraded';
    }

    // Determine final status
    if (health.metrics.failed_jobs > 100) {
      health.status = 'critical';
      health.issues.push(`${health.metrics.failed_jobs} jobs échoués`);
    } else if (health.metrics.pending_jobs > 500) {
      health.status = 'warning';
      health.issues.push(`${health.metrics.pending_jobs} jobs en attente`);
    }

    res.json({
      success: true,
      health,
    });
  } catch (error) {
    console.error('[SyncDiagnostic] Error:', error);
    res.status(500).json({
      success: false,
      health: {
        status: 'error',
        timestamp: new Date().toISOString(),
        issues: ['Erreur lors du diagnostic'],
      },
    });
  }
});

// GET /platform/sync/stats — Statistiques détaillées
router.get('/sync/stats', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Jobs par statut
    const pending = await db('sync_outbox').where('status', 'pending').count('id as count').first();
    const processing = await db('sync_outbox').where('status', 'processing').count('id as count').first();
    const completed = await db('sync_outbox').where('status', 'completed').count('id as count').first();
    const failed = await db('sync_outbox').where('status', 'failed').count('id as count').first();

    // Jobs dernière heure
    const lastHour = await db('sync_outbox')
      .where('created_at', '>', oneHourAgo)
      .count('id as count')
      .first();

    // Jobs dernière journée
    const lastDay = await db('sync_outbox')
      .where('created_at', '>', oneDayAgo)
      .count('id as count')
      .first();

    // Jobs par entité (entity au lieu de table_name)
    const byEntity = await db('sync_outbox')
      .select('entity')
      .count('id as count')
      .groupBy('entity');

    // Taux de succès
    const totalProcessed = (parseInt((completed as any)?.count as string || '0') + 
                           parseInt((failed as any)?.count as string || '0'));
    const successRate = totalProcessed > 0 
      ? (parseInt((completed as any)?.count as string || '0') / totalProcessed * 100).toFixed(2)
      : 100;

    res.json({
      success: true,
      stats: {
        by_status: {
          pending: parseInt((pending as any)?.count as string || '0'),
          processing: parseInt((processing as any)?.count as string || '0'),
          completed: parseInt((completed as any)?.count as string || '0'),
          failed: parseInt((failed as any)?.count as string || '0'),
        },
        by_time: {
          last_hour: parseInt((lastHour as any)?.count as string || '0'),
          last_day: parseInt((lastDay as any)?.count as string || '0'),
        },
        by_entity: (byEntity as any[]).map((e: any) => ({
          entity: e.entity,
          count: parseInt(e.count as string || '0'),
        })),
        success_rate: `${successRate}%`,
        total_processed: totalProcessed,
      },
    });
  } catch (error) {
    console.error('[SyncDiagnostic] Error fetching stats:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la récupération des stats' });
  }
});

// GET /platform/sync/tables — Liste des tables synchronisées
router.get('/sync/tables', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    // Récupérer les entités uniques de l'outbox
    const entities = await db('sync_outbox')
      .select('entity')
      .distinct()
      .orderBy('entity');

    // Pour chaque entité, calculer les stats
    const entityStats = await Promise.all(
      (entities as any[]).map(async (e: any) => {
        const pending = await db('sync_outbox')
          .where('entity', e.entity)
          .where('status', 'pending')
          .count('id as count')
          .first();
      
        const failed = await db('sync_outbox')
          .where('entity', e.entity)
          .where('status', 'failed')
          .count('id as count')
          .first();

        return {
          entity: e.entity,
          pending: parseInt((pending as any)?.count as string || '0'),
          failed: parseInt((failed as any)?.count as string || '0'),
        };
      })
    );

    res.json({
      success: true,
      entities: entityStats,
    });
  } catch (error) {
    console.error('[SyncDiagnostic] Error fetching tables:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la récupération des tables' });
  }
});

// POST /platform/sync/retry-failed — Réessayer les jobs échoués
router.post('/sync/retry-failed', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const maxAttempts = parseInt(req.body.maxAttempts as string) || 5;
    
    // Réinitialiser les jobs échoués qui ont atteint le max de tentatives
    const result = await db('sync_outbox')
      .where('status', 'failed')
      .where('attempts', '<', maxAttempts)
      .update({
        status: 'pending',
        attempts: 0,
        last_error: null,
        updated_at: new Date().toISOString(),
      });

    res.json({
      success: true,
      message: `${result} jobs remis en attente`,
      retried: result,
    });
  } catch (error) {
    console.error('[SyncDiagnostic] Error retrying failed jobs:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la réinitialisation' });
  }
});

// POST /platform/sync/resync — Force full resync (reset all pull cursors + re-pull)
router.post('/sync/resync', requirePlatformAuth, async (_req: Request, res: Response) => {
  try {
    const { getOrchestratorV2 } = require('../../sync');
    const orchestrator = getOrchestratorV2();
    await orchestrator.forceFullResync();
    res.json({ success: true, message: 'Full resync completed — all pull cursors reset and re-pull triggered' });
  } catch (err: any) {
    console.error('[SyncDiagnostic] Error during full resync:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err?.message || 'Force resync failed' });
  }
});

// DELETE /platform/sync/cleanup — Nettoyer les vieux jobs complétés
router.delete('/sync/cleanup', requirePlatformAuth, async (req: Request, res: Response) => {
  try {
    const daysOld = parseInt(req.body.daysOld as string) || 7;
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

    const result = await db('sync_outbox')
      .where('status', 'completed')
      .where('created_at', '<', cutoffDate)
      .del();

    res.json({
      success: true,
      message: `${result} jobs nettoyés`,
      deleted: result,
    });
  } catch (error) {
    console.error('[SyncDiagnostic] Error cleaning up:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors du nettoyage' });
  }
});

export default router;