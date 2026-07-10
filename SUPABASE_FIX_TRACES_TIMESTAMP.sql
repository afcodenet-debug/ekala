-- =============================================================================
-- FIX: traces_events.timestamp out-of-range (integer → bigint)
-- =============================================================================
-- Symptom (Render CLOUD mode logs):
--   [TracePersistence] Supabase insert failed: value "1783714649155" is out of range for type integer
--
-- Cause: trace events store `timestamp` as JavaScript epoch milliseconds
-- (Date.now()), e.g. 1783714649155, which exceeds Postgres INT4 max (2147483647).
-- The Supabase `traces_events.timestamp` column was created as `integer`, so the
-- insert fails on every event in CLOUD mode.
--
-- Fix: widen the affected columns to BIGINT (int8). Safe / online-ish operation
-- on a small table; wrap in a transaction for atomicity.
-- =============================================================================

begin;

-- 1. Widen timestamp (epoch ms) to bigint
alter table if exists public.traces_events
  alter column timestamp type bigint using timestamp::bigint;

-- 2. Widen duration_ms (ms, can also overflow INT4) to bigint for safety
alter table if exists public.traces_events
  alter column duration_ms type bigint using duration_ms::bigint;

-- 3. Ensure the supporting columns exist even if the table was created elsewhere
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'traces_events'
      and column_name = 'synced_to_supabase'
  ) then
    alter table public.traces_events add column synced_to_supabase integer default 0;
  end if;
exception when undefined_table then
  -- Table does not exist yet; persistence is best-effort and will no-op until created.
  null;
end $$;

-- 4. Index for the SQLite→Supabase sweep (used by trace-flush-engine in non-cloud modes)
create index if not exists idx_traces_events_synced
  on public.traces_events (synced_to_supabase)
  where synced_to_supabase is null or synced_to_supabase = 0;

commit;
