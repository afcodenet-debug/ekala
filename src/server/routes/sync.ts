/**
 * src/server/routes/sync.ts
 *
 * Endpoints de pilotage et de supervision de la synchronisation locale ↔ Supabase.
 *
 * En mode LOCAL (Electron), SQLite reste la source de vérité : ces routes
 * permettent de (1) consulter l'état de l'outbox / de la connectivité et
 * (2) forcer un cycle de synchronisation à la demande (push + pull).
 */

import express from 'express';
import db from '../db/database';
import { requireRole } from '../middleware/auth';
import { getOrchestratorV2, isSyncEnabled } from '../../sync';

const router = express.Router();

/**
 * GET /api/sync/status
 * Renvoie un état synthétique de la synchronisation (sans effet de bord).
 */
router.get('/status', async (_req: any, res: any) => {
  try {
    const enabled = isSyncEnabled();
    let reachable = false;
    let pendingByEntity: Record<string, number> = {};
    let totalPending = 0;

    try {
      const rows = db.prepare(`
        SELECT entity, COUNT(*) AS count
        FROM sync_outbox
        WHERE status = 'pending' OR status = 'in_progress'
        GROUP BY entity
      `).all() as Array<{ entity: string; count: number }>;
      for (const r of rows) {
        pendingByEntity[r.entity] = r.count;
        totalPending += r.count;
      }
    } catch {
      // sync_outbox peut ne pas exister si jamais initialisé
    }

    try {
      const orch = getOrchestratorV2();
      reachable = await orch.isSupabaseReachable();
    } catch {
      reachable = false;
    }

    res.json({
      enabled,
      online: reachable,
      totalPending,
      pendingByEntity,
      productsPending: pendingByEntity['product'] || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read sync status' });
  }
});

/**
 * POST /api/sync/trigger
 * Déclenche immédiatement un cycle de synchronisation (push + pull) si
 * Supabase est joignable. Silencieux si hors-ligne.
 */
router.post('/trigger', requireRole(['admin', 'manager']), async (_req: any, res: any) => {
  try {
    let orch;
    try {
      orch = getOrchestratorV2();
    } catch {
      return res.status(503).json({ error: 'SYNC_DISABLED', message: 'Sync engine not enabled' });
    }

    const reachable = await orch.isSupabaseReachable();
    if (!reachable) {
      return res.status(200).json({ triggered: false, online: false, message: 'Supabase not reachable — sync skipped' });
    }

    // Fire-and-forget : on ne bloque pas la réponse sur le cycle complet.
    orch.triggerSync().catch((e: any) => console.error('[Sync] Manual trigger failed:', e?.message));

    res.status(202).json({ triggered: true, online: true, message: 'Sync cycle started' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to trigger sync' });
  }
});

export default router;
