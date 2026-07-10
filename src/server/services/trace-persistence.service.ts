/**
 * TRACE PERSISTENCE SERVICE — Dual storage (SQLite + Supabase) for trace events
 * 
 * Persiste les events de trace dans :
 *   A) SQLite (local / fallback — table traces_events)
 *   B) Supabase (cloud — table traces_events)
 * 
 * Garantie : ne jamais throw — les échecs de persistence sont silencieux.
 * La persistence est best-effort pour ne jamais impacter les requêtes.
 */

import type { TraceLogEntry } from './trace-manager.service';
import { dataSource } from '../infrastructure/data-source-manager';

// ── SQLite Persistence ─────────────────────────────────────────────────────────

function persistToSqlite(events: TraceLogEntry[]): void {
  // LOCAL mode: SQLite is the source of truth and there is NO Supabase to sync
  // trace events to. Persisting hundreds of thousands of debug rows bloats the
  // DB and triggers a full table scan in the (now skipped) Supabase sync timer.
  if (dataSource.isLocal()) return;

  // CLOUD mode: there is no local SQLite at all (RENDER_CLOUD_MODE forbids it),
  // so there is nothing to persist here. The disk→Supabase path handles cloud.
  if (dataSource.isCloud()) return;

  try {
    // Dynamic require to avoid crash if better-sqlite3 is not available
    const db = require('../db/database').default;
    if (!db) return;

    const insert = db.prepare(`
      INSERT OR IGNORE INTO traces_events 
        (trace_id, step, phase, status, timestamp, duration_ms, datasource, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows: TraceLogEntry[]) => {
      for (const row of rows) {
        insert.run(
          row.trace_id,
          row.step,
          row.phase,
          row.status,
          row.timestamp,
          row.duration_ms,
          row.datasource,
          JSON.stringify(row.meta),
        );
      }
    });

    insertMany(events);
  } catch {
    // Silently fail — persistence is best-effort
  }
}

// ── Supabase Persistence ───────────────────────────────────────────────────────

async function persistToSupabase(events: TraceLogEntry[]): Promise<void> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      db: { schema: 'public' },
    });

    const rows = events.map(e => ({
      trace_id: e.trace_id,
      step: e.step,
      phase: e.phase,
      status: e.status,
      timestamp: e.timestamp,
      duration_ms: e.duration_ms,
      datasource: e.datasource,
      meta: JSON.stringify(e.meta),
    }));

    const { error } = await supabase.from('traces_events').insert(rows);
    if (error) {
      // Log warning but don't throw
      console.warn('[TracePersistence] Supabase insert failed:', error.message);
    }
  } catch {
    // Silently fail
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Persiste les events de trace dans SQLite ET Supabase (dual write).
 * Ne jamais throw — les échecs sont silencieux.
 */
export async function persistTraceEvents(events: TraceLogEntry[]): Promise<void> {
  if (!events || events.length === 0) return;

  persistToSqlite(events);

  if (dataSource.isCloud() && process.env.SUPABASE_URL) {
    await persistToSupabase(events);
  }
}

/**
 * Récupère les events de trace depuis SQLite.
 */
export function getTraceEventsFromSqlite(trace_id: string): TraceLogEntry[] {
  try {
    const db = require('../db/database').default;
    if (!db) return [];

    const rows = db.prepare(
      'SELECT * FROM traces_events WHERE trace_id = ? ORDER BY timestamp ASC'
    ).all(trace_id) as any[];

    return rows.map(r => ({
      trace_id: r.trace_id,
      step: r.step,
      phase: r.phase,
      status: r.status,
      timestamp: r.timestamp,
      duration_ms: r.duration_ms,
      datasource: r.datasource,
      meta: typeof r.meta === 'string' ? JSON.parse(r.meta) : (r.meta || {}),
    }));
  } catch {
    return [];
  }
}

/**
 * Récupère les events de trace depuis Supabase.
 */
export async function getTraceEventsFromSupabase(trace_id: string): Promise<TraceLogEntry[]> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) return [];

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      db: { schema: 'public' },
    });

    const { data, error } = await supabase
      .from('traces_events')
      .select('*')
      .eq('trace_id', trace_id)
      .order('timestamp', { ascending: true });

    if (error || !data) return [];

    return data.map(r => ({
      trace_id: r.trace_id,
      step: r.step,
      phase: r.phase,
      status: r.status,
      timestamp: r.timestamp,
      duration_ms: r.duration_ms,
      datasource: r.datasource,
      meta: typeof r.meta === 'string' ? JSON.parse(r.meta) : (r.meta || {}),
    }));
  } catch {
    return [];
  }
}