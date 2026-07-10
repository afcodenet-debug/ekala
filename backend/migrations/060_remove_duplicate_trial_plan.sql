-- 060_remove_duplicate_trial_plan.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup: a stray uppercase duplicate of the trial plan (`TRIAL_7D`) was
-- created alongside the canonical lowercase `trial_7d` (id 1). Because the
-- platform plan routes normalize codes to UPPERCASE on write, editing the
-- lowercase trial plan collided case-insensitively with this duplicate and
-- returned HTTP 409 (CODE_EXISTS).
--
-- This migration:
--   1. Re-maps any subscription still pointing at the uppercase duplicate to
--      the canonical lowercase `trial_7d` plan.
--   2. Removes the uppercase duplicate plan.
--
-- IDEMPOTENT: all steps are guarded by existence checks, so re-running is safe
-- and a no-op when the duplicate no longer exists.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Re-map subscriptions referencing the uppercase duplicate (guarded).
UPDATE subscriptions
SET plan_id = (SELECT id FROM plans WHERE code = 'trial_7d')
WHERE plan_id = (SELECT id FROM plans WHERE code = 'TRIAL_7D')
  AND EXISTS (SELECT 1 FROM plans WHERE code = 'trial_7d')
  AND EXISTS (SELECT 1 FROM plans WHERE code = 'TRIAL_7D');

-- 2. Remove the uppercase duplicate plan, only when the canonical lowercase
--    trial plan still exists (so we never delete the last trial plan).
DELETE FROM plans
WHERE code = 'TRIAL_7D'
  AND EXISTS (SELECT 1 FROM plans WHERE code = 'trial_7d');
