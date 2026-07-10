-- Migration 052: Add Supabase sync tracking columns to traces_events
-- Permet au Supabase Sync Worker de suivre les events non encore synchronisés.

ALTER TABLE traces_events ADD COLUMN synced_to_supabase INTEGER DEFAULT 0;
ALTER TABLE traces_events ADD COLUMN synced_at INTEGER;

-- Index for the sync worker query (un-synced events)
CREATE INDEX IF NOT EXISTS idx_traces_events_sync_status ON traces_events(synced_to_supabase, timestamp);