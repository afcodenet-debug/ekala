# Supabase Cleanup Instructions for Pending QR Orders

## Problem

When `ENABLE_SUPABASE_PULL` was disabled, QR orders created via the public menu (stored directly in Supabase) were not synchronized to the local SQLite database on Render. This caused:

- Accumulation of **stale pending orders** in Supabase
- Frontend showing **7 pending orders** instead of the actual **1 new order**
- **Double-counting** issue when the backend fell back to Supabase queries

## Solution Implemented

The fix has been deployed with the following changes:

1. **render.yaml**: Activated `ENABLE_SUPABASE_PULL=true` with proper credentials
2. **order.service.ts**: Added protection against misconfiguration
3. **useOrderStore.ts**: Improved notification deduplication with sessionStorage
4. **GlobalQrOrderNotifier.tsx**: Added double-tracking of notified orders

However, **existing stale orders in Supabase need to be cleaned up** to prevent them from appearing again after the pull sync is activated.

---

## Cleanup Steps

### Step 1: Run the Dry Run Query

Connect to your Supabase dashboard and go to **SQL Editor**:

```sql
-- See all pending QR orders (verify these are the stale ones)
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
```

**Expected**: You should see multiple old orders that should have been processed already.

### Step 2: Identify Which Orders to Clean Up

Decide on a cutoff time. We recommend:
- **Conservative**: Clean up orders older than **24 hours**
- **Aggressive**: Clean up orders older than **1 hour**

Run the appropriate dry-run query:

```sql
-- For 24-hour cutoff (recommended)
SELECT 
    id as order_id_to_clean,
    table_id,
    created_at,
    age(now(), created_at) as age
FROM orders 
WHERE status = 'pending' 
    AND source = 'qr'
    AND created_at < NOW() - INTERVAL '24 hours'
ORDER BY created_at ASC;

-- For 1-hour cutoff (more aggressive)
SELECT 
    id as order_id_to_clean,
    table_id,
    created_at,
    age(now(), created_at) as age
FROM orders 
WHERE status = 'pending' 
    AND source = 'qr'
    AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at ASC;
```

### Step 3: Execute the Cleanup

After verifying the dry-run results, execute the cleanup:

#### Option A: Mark as 'cancelled' (Recommended)
```sql
-- For 24-hour cutoff
UPDATE orders 
SET status = 'cancelled',
    updated_at = NOW(),
    notes = CONCAT(COALESCE(notes, ''), ' [Cleaned: stale pending QR order]')
WHERE status = 'pending' 
    AND source = 'qr'
    AND created_at < NOW() - INTERVAL '24 hours';
```

#### Option B: Mark as 'paid' (If orders should be considered completed)
```sql
-- For 24-hour cutoff
UPDATE orders 
SET status = 'paid',
    updated_at = NOW()
WHERE status = 'pending' 
    AND source = 'qr'
    AND created_at < NOW() - INTERVAL '24 hours';
```

### Step 4: Verify Cleanup

```sql
-- Should return 0 or very few results
SELECT COUNT(*) as remaining_pending_qr 
FROM orders 
WHERE status = 'pending' AND source = 'qr';

-- See details of remaining pending orders
SELECT id, table_id, created_at 
FROM orders 
WHERE status = 'pending' AND source = 'qr'
ORDER BY created_at DESC;
```

### Step 5: Deploy the Fix

The code changes have already been committed and pushed. To complete the fix:

1. **Deploy to Render**: 
   - The new `render.yaml` configuration will be automatically applied
   - This enables `ENABLE_SUPABASE_PULL=true` on your Render service

2. **Wait for Pull Sync to Start**:
   - After deployment, the pull sync worker starts automatically
   - It runs every 8 seconds (`SUPABASE_PULL_INTERVAL_MS=8000`)
   - First pull happens after 5 seconds, then every 8 seconds

3. **Verify Sync is Working**:
   - Check Render logs for: `[PullSync] Worker started`
   - Look for: `[PullSync] ORDER RECEIVED FROM SUPABASE`
   - The bootstrap lookback will pull orders from the last 2 hours

---

## Expected Results After Fix

✅ **Local Development**: No changes, continues to work as before
✅ **Production**: 
- Pull sync runs every 8 seconds
- New QR orders are pulled from Supabase to SQLite within seconds
- Notifications show exactly **1 new order** (not 7)
- SQLite remains the **source of truth**
- No more double-counting or stale data

---

## Rollback Plan

If anything goes wrong, you can:

1. **Revert the commit**:
   ```bash
   git revert 1e94200
   git push origin render-supabase-fallback
   ```

2. **Disable Pull Sync on Render**:
   - Add `ENABLE_SUPABASE_PULL: "false"` to Render environment variables
   - This will restore the previous behavior

---

## Monitoring

After deployment, monitor these key metrics:

1. **Pull Sync Status**:
   - Endpoint: `GET /api/sync/status`
   - Should show: `workerRunning: true, enabled: true`

2. **Order Counts**:
   ```sql
   -- In SQLite (via Render logs or local check)
   SELECT COUNT(*) FROM orders WHERE status = 'pending';
   ```

3. **Supabase Orders**:
   ```sql
   -- In Supabase SQL Editor
   SELECT COUNT(*) FROM orders WHERE status = 'pending' AND source = 'qr';
   ```
   This should decrease to 0 or 1 as orders are pulled and processed.

---

## Files Changed

- `render.yaml` - Added Supabase pull sync configuration
- `src/server/services/order.service.ts` - Added misconfiguration protection
- `src/server/services/supabase-pull-sync.service.ts` - Minor improvements
- `src/stores/useOrderStore.ts` - Enhanced notification deduplication
- `src/components/GlobalQrOrderNotifier.tsx` - Prevent duplicate toasts
- `.env.example` - Added PULL SYNC configuration documentation
- `supabase_cleanup_pending_orders.sql` - Cleanup script (this file)

---

## Support

If you need assistance:
1. First, check the logs in Render dashboard
2. Look for `[PullSync]` messages to verify sync is working
3. If sync is working but orders still appear in Supabase, re-run the cleanup script
4. If issues persist, the pull sync may need debugging

**Note**: The pull sync is designed to be **idempotent**. Running it multiple times on the same data will not create duplicates.
