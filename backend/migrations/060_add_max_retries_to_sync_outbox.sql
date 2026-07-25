-- Migration: 060_add_max_retries_to_sync_outbox.sql
-- Adds the max_retries column to the sync_outbox table.
-- This column controls how many retry attempts are made before an item
-- is moved to the dead-letter queue (DLQ).
-- Default value of 5 matches the retry logic in GenericSyncService.pushByEntity().

ALTER TABLE sync_outbox ADD COLUMN max_retries INTEGER DEFAULT 5;
