/**
 * EVENT STORE ROUTES — Event Sourcing replay and state reconstruction API
 * 
 * Endpoints :
 *   GET  /api/events/trace/:trace_id    → Replay déterministe d'une trace
 *   GET  /api/events/aggregate/:id      → État reconstruit d'un aggregate
 *   GET  /api/events/trace/:trace_id/sequence → Validation de séquence
 * 
 * Permet de :
 * - Reconstruire l'état exact d'une requête uniquement via les events
 * - Vérifier l'intégrité des séquences
 * - Debugger en production sans accès DB directe
 */

import { Router, Request, Response } from 'express';
import { eventStore } from '../services/event-store.service';

const router = Router();

// ── GET /api/events/trace/:trace_id — Replay déterministe complet ──────────────
router.get('/events/trace/:trace_id', (req: Request, res: Response) => {
  const trace_id = String(req.params.trace_id || '');

  if (!trace_id || trace_id.length < 8) {
    return res.status(400).json({ error: 'INVALID_TRACE_ID' });
  }

  try {
    const replay = eventStore.replay(trace_id);

    if (replay.events.length === 0) {
      return res.status(404).json({
        error: 'TRACE_NOT_FOUND',
        message: `Aucun event trouvé pour trace_id="${trace_id}". Les events sont écrits uniquement pour les requêtes auth.`,
      });
    }

    res.json({
      trace_id,
      valid: replay.valid,
      event_count: replay.events.length,
      total_duration_ms: replay.total_duration_ms,
      timeline: replay.timeline,
      final_state: replay.final_state,
      gaps: replay.gaps,
      anomalies: replay.anomalies,
    });
  } catch (err: any) {
    console.error('[EventStoreRoutes] Replay error:', err.message);
    res.status(500).json({ error: 'REPLAY_FAILED', message: err.message });
  }
});

// ── GET /api/events/aggregate/:aggregate_id — État reconstruit d'un aggregate ──
router.get('/events/aggregate/:aggregate_id', (req: Request, res: Response) => {
  const aggregate_id = String(req.params.aggregate_id || '');

  if (!aggregate_id) {
    return res.status(400).json({ error: 'INVALID_AGGREGATE_ID' });
  }

  try {
    const state = eventStore.rebuildState(aggregate_id);

    res.json({
      aggregate_id,
      aggregate_type: state.aggregate_type,
      event_count: state.events_count,
      last_event_type: state.last_event_type,
      last_event_at: state.last_event_at,
      state: state.state,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'STATE_REBUILD_FAILED', message: err.message });
  }
});

// ── GET /api/events/trace/:trace_id/sequence — Validation de séquence ──────────
router.get('/events/trace/:trace_id/sequence', (req: Request, res: Response) => {
  const trace_id = String(req.params.trace_id || '');

  try {
    const result = eventStore.validateSequence(trace_id);

    res.json({
      trace_id,
      valid: result.valid,
      event_count: result.count,
      gaps: result.gaps,
      duplicates: result.duplicates,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'SEQUENCE_CHECK_FAILED', message: err.message });
  }
});

export default router;