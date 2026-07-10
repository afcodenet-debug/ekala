-- Migration 053: Event Store (Event Sourcing Core)
-- SOURCE OF TRUTH for all system events.
-- APPEND-ONLY: no UPDATE, no DELETE.
-- STRICT SEQUENCE: UNIQUE(trace_id, sequence_number).

CREATE TABLE IF NOT EXISTS events_store (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,               -- Deterministic hash-based ID
    trace_id TEXT NOT NULL,                       -- Correlation ID
    aggregate_id TEXT NOT NULL,                   -- user_id | session_id | tenant_id
    aggregate_type TEXT NOT NULL DEFAULT 'system', -- user | session | tenant | system
    event_type TEXT NOT NULL,                      -- BEGIN | VALIDATION | DATASOURCE_RESOLVED | etc.
    event_version INTEGER NOT NULL DEFAULT 1,      -- Schema version
    sequence_number INTEGER NOT NULL,              -- Strictly increasing per trace_id
    payload TEXT NOT NULL DEFAULT '{}',             -- JSON blob
    timestamp INTEGER NOT NULL,                     -- Epoch ms
    created_at TEXT NOT NULL,                       -- ISO string
    created_at_db DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- STRICT ORDER guarantee: UNIQUE(trace_id, sequence_number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_store_trace_sequence 
    ON events_store(trace_id, sequence_number);

-- Fast lookup by event_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_store_event_id 
    ON events_store(event_id);

-- Aggregate queries (state rebuild)
CREATE INDEX IF NOT EXISTS idx_events_store_aggregate 
    ON events_store(aggregate_id, timestamp, sequence_number);

-- Timestamp-based queries (monitoring / dashboard)
CREATE INDEX IF NOT EXISTS idx_events_store_timestamp 
    ON events_store(timestamp);

-- Event type queries (analytics)
CREATE INDEX IF NOT EXISTS idx_events_store_event_type 
    ON events_store(event_type);