/**
 * TRACE ROUTES — Forensic trace replay, search, and anomaly detection API
 * 
 * Endpoints :
 *   GET  /api/traces/:trace_id    → Replay complet d'une trace
 *   GET  /api/traces/:trace_id/anomalies → Anomalies détectées
 *   GET  /api/traces/search?step=...&status=... → Recherche de traces
 *   GET  /api/traces/recent?limit=50 → Traces récentes
 * 
 * Usage (debug production Render) :
 *   curl https://ekala-api.onrender.com/api/traces/<trace_id>
 *   curl https://ekala-api.onrender.com/api/traces/<trace_id>/anomalies
 */

import { Router, Request, Response } from 'express';
import { TraceManager, EXPECTED_SEQUENCE } from '../services/trace-manager.service';
import { getTraceEventsFromSqlite, getTraceEventsFromSupabase } from '../services/trace-persistence.service';

const router = Router();

// ── GET /api/traces/:trace_id — Replay complet d'une trace ─────────────────────
router.get('/traces/:trace_id', async (req: Request, res: Response) => {
  const trace_id = String(req.params.trace_id || '');

  if (!trace_id || trace_id.length < 8) {
    return res.status(400).json({ error: 'INVALID_TRACE_ID', message: 'trace_id invalide (min 8 caractères).' });
  }

  try {
    // Try SQLite first (fastest)
    let events = getTraceEventsFromSqlite(trace_id);

    // Fallback to Supabase if not found in SQLite
    if (events.length === 0) {
      events = await getTraceEventsFromSupabase(trace_id);
    }

    if (events.length === 0) {
      return res.status(404).json({
        error: 'TRACE_NOT_FOUND',
        message: `Aucune trace trouvée pour trace_id="${trace_id}".`,
      });
    }

    // Reconstruct TraceManager from events for replay
    const trace = new TraceManager(trace_id);
    for (const event of events) {
      if (event.datasource) {
        trace.setDatasource(event.datasource);
      }
      // Re-populate steps map for duration calculation
      if (event.phase === 'ENTRY') {
        (trace as any).steps.set(event.step, { step: event.step, start: event.timestamp });
      }
    }

    const replay = trace.replay();

    res.json({
      trace_id,
      valid: replay.valid,
      total_duration_ms: replay.total_duration_ms,
      step_count: replay.steps.length,
      error_count: replay.errors.length,
      gap_count: replay.gaps.length,
      anomaly_count: replay.anomalies.length,
      timeline: replay.timeline,
      gaps: replay.gaps,
      errors: replay.errors.map(e => ({
        step: e.step,
        message: e.meta?.error_message || 'Unknown error',
        at: new Date(e.timestamp).toISOString(),
      })),
      anomalies: replay.anomalies,
      steps: replay.steps,
    });
  } catch (err: any) {
    console.error('[TraceRoutes] Replay error:', err.message);
    res.status(500).json({ error: 'REPLAY_FAILED', message: err.message });
  }
});

// ── GET /api/traces/:trace_id/anomalies — Anomalies détectées ──────────────────
router.get('/traces/:trace_id/anomalies', async (req: Request, res: Response) => {
  const trace_id = String(req.params.trace_id || '');

  try {
    let events = getTraceEventsFromSqlite(trace_id);
    if (events.length === 0) {
      events = await getTraceEventsFromSupabase(trace_id);
    }

    if (events.length === 0) {
      return res.status(404).json({ error: 'TRACE_NOT_FOUND' });
    }

    const trace = new TraceManager(trace_id);
    for (const event of events) {
      if (event.datasource) trace.setDatasource(event.datasource);
      if (event.phase === 'ENTRY') {
        (trace as any).steps.set(event.step, { step: event.step, start: event.timestamp });
      }
    }

    const anomalies = trace.detectAnomalies();

    res.json({
      trace_id,
      valid: anomalies.length === 0,
      anomaly_count: anomalies.length,
      anomalies,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'ANOMALY_CHECK_FAILED', message: err.message });
  }
});

// ── GET /api/traces/search — Recherche de traces ───────────────────────────────
router.get('/traces/search', (req: Request, res: Response) => {
  const step = req.query.step as string | undefined;
  const status = req.query.status as string | undefined;
  const datasource = req.query.datasource as string | undefined;
  const limitStr = req.query.limit as string | undefined;
  const limit = Math.min(parseInt(String(limitStr || '50'), 10) || 50, 200);

  try {
    const db = require('../db/database').default;
    if (!db) {
      return res.status(503).json({ error: 'DATABASE_NOT_AVAILABLE' });
    }

    let sql = 'SELECT DISTINCT trace_id, MIN(timestamp) as first_event, MAX(timestamp) as last_event FROM traces_events WHERE 1=1';
    const params: any[] = [];

    if (step) {
      sql += ' AND step = ?';
      params.push(step);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (datasource) {
      sql += ' AND datasource = ?';
      params.push(datasource);
    }

    sql += ' GROUP BY trace_id ORDER BY first_event DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as any[];

    res.json({
      count: rows.length,
      limit,
      traces: rows.map(r => ({
        trace_id: r.trace_id,
        first_event: r.first_event,
        last_event: r.last_event,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'SEARCH_FAILED', message: err.message });
  }
});

// ── GET /api/traces/recent — Traces récentes ───────────────────────────────────
router.get('/traces/recent', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);

  try {
    const db = require('../db/database').default;
    if (!db) {
      return res.status(503).json({ error: 'DATABASE_NOT_AVAILABLE' });
    }

    const rows = db.prepare(`
      SELECT trace_id, step, phase, status, timestamp, duration_ms, datasource
      FROM traces_events
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as any[];

    // Group by trace_id
    const traceMap = new Map<string, any[]>();
    for (const row of rows) {
      if (!traceMap.has(row.trace_id)) {
        traceMap.set(row.trace_id, []);
      }
      traceMap.get(row.trace_id)!.push(row);
    }

    const traces = Array.from(traceMap.entries()).map(([trace_id, events]) => ({
      trace_id,
      event_count: events.length,
      first_event: events[events.length - 1]?.timestamp,
      last_event: events[0]?.timestamp,
      status: events.find(e => e.step === 'END')?.status || 'incomplete',
      datasource: events.find(e => e.datasource)?.datasource || null,
    }));

    res.json({ count: traces.length, limit, traces });
  } catch (err: any) {
    res.status(500).json({ error: 'RECENT_FAILED', message: err.message });
  }
});

// ── GET /api/traces/expected-sequence — Séquence attendue ──────────────────────
router.get('/traces/expected-sequence', (_req: Request, res: Response) => {
  res.json({
    expected_sequence: EXPECTED_SEQUENCE,
    description: 'Ordre attendu des steps pour une requête auth complète',
  });
});

export default router;