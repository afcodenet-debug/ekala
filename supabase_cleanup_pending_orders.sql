-- ============================================
-- SUPABASE CLEANUP SCRIPT: Remove stale pending QR orders
-- ============================================
-- 
-- PROBLEM: When ENABLE_SUPABASE_PULL was disabled, QR orders accumulated in Supabase
-- without being synchronized to SQLite. This caused the frontend to show 7 pending
-- orders instead of 1.
--
-- SOLUTION: Clean up old pending orders that should have been processed already.
--
-- HOW TO USE:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Run this script
-- 3. Verify the results before committing
--
-- SAFETY: This script only affects orders that:
--   - Have status = 'pending'
--   - Are older than 1 hour (adjust as needed)
--   - Are from source = 'qr' (QR menu orders)
--
-- ============================================

-- First, let's see how many pending QR orders exist and how old they are
SELECT 
    id,
    table_id,
    status,
    source,
    created_at,
    updated_at,
    total,
    array_length(items, 1) as item_count
FROM orders 
WHERE status = 'pending' 
    AND source = 'qr'
ORDER BY created_at ASC;

-- If the above query shows orders that should be cleaned up, run this:
-- Note: First test with a DRY RUN (commented out UPDATE below)

-- DRY RUN: See which orders would be affected
SELECT 
    id as order_id_to_be_updated,
    table_id,
    created_at,
    age(now(), created_at) as age
FROM orders 
WHERE status = 'pending' 
    AND source = 'qr'
    AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at ASC;

-- After verifying the dry run results, uncomment and run this to actually clean up:
-- 
-- UPDATE orders 
-- SET status = 'paid',
--     updated_at = NOW(),
--     notes = CONCAT(COALESCE(notes, ''), ' [Auto-cleaned: stale pending QR order]')
-- WHERE status = 'pending' 
--     AND source = 'qr'
--     AND created_at < NOW() - INTERVAL '1 hour';
--
-- Then verify the cleanup:
-- SELECT COUNT(*) as remaining_pending_qr FROM orders WHERE status = 'pending' AND source = 'qr';

-- ============================================
-- For more conservative cleanup (only orders older than 24 hours):
-- ============================================

-- DRY RUN for 24h cutoff:
SELECT 
    id as order_id_to_be_updated,
    table_id,
    created_at,
    age(now(), created_at) as age
FROM orders 
WHERE status = 'pending' 
    AND source = 'qr'
    AND created_at < NOW() - INTERVAL '24 hours'
ORDER BY created_at ASC;

-- Actual cleanup for 24h cutoff:
-- UPDATE orders 
-- SET status = 'cancelled',
--     updated_at = NOW(),
--     notes = CONCAT(COALESCE(notes, ''), ' [Auto-cleaned: stale pending QR order >24h]')
-- WHERE status = 'pending' 
--     AND source = 'qr'
--     AND created_at < NOW() - INTERVAL '24 hours';

-- ============================================
-- ALTERNATIVE: If you want to keep the orders but just mark them differently
-- ============================================

-- Mark old pending QR orders as 'rejected' instead of 'paid':
-- UPDATE orders 
-- SET status = 'rejected',
--     updated_at = NOW()
-- WHERE status = 'pending' 
--     AND source = 'qr'
--     AND created_at < NOW() - INTERVAL '1 hour';
