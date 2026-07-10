-- Migration 051: Forensic Trace Events Table (TRACE SYSTEM v4)
-- Stores all structured trace events for request replay and anomaly detection.
-- Compatible with both SQLite and Supabase schemas.

CREATE TABLE IF NOT EXISTS traces_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT NOT NULL,
    step TEXT NOT NULL,
    phase TEXT NOT NULL,
    status TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    duration_ms INTEGER,          -- Null for ENTRY events
    datasource TEXT,              -- 'sqlite' | 'supabase' | null
    meta TEXT DEFAULT '{}',       -- JSON blob with step-specific metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast trace replay queries by trace_id
CREATE INDEX IF NOT EXISTS idx_traces_events_trace_id ON traces_events(trace_id);

-- Index for chronological queries (dashboard / monitoring)
CREATE INDEX IF NOT EXISTS idx_traces_events_timestamp ON traces_events(timestamp);