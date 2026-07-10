-- Fix sync_outbox table: add missing next_retry_at column
-- This migration fixes the error: "no such column: next_retry_at"

-- Add next_retry_at column if it doesn't exist
ALTER TABLE sync_outbox ADD COLUMN next_retry_at INTEGER DEFAULT 0;

-- Create index for performance (SQLite syntax)
CREATE INDEX IF NOT EXISTS idx_sync_outbox_next_retry ON sync_outbox(next_retry_at);

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM pragma_table_info('sync_outbox')
WHERE column_name = 'next_retry_at';