-- 059_seed_subscription_plans.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Canonical subscription plan catalog:
--   Basic / Standard / Premium  ×  Weekly / Monthly / Annual  +  7-day Trial
--
-- The previous catalog used "Starter/Pro" naming. This migration introduces the
-- requested Basic/Standard/Premium tiers (each available per billing period) and
-- cleanly retires the legacy Starter/Pro plans while preserving referential
-- integrity: any existing subscription still pointing at a legacy plan is
-- re-mapped to the equivalent new tier before the legacy rows are removed.
--
-- IDEMPOTENT: INSERT OR IGNORE by `code`; re-mapping and deletes are guarded by
-- existence checks, so re-running is safe.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Insert the new catalog (no-op if the code already exists).
--    Note: the existing `trial_7d` plan is kept as-is (it already serves as the
--    free trial), so we only add the three paid tiers × three billing periods.
INSERT OR IGNORE INTO plans (code, name, description, price_cents, currency, period, duration_days,
  max_users, max_branches, max_products, max_orders_per_month, features, is_active, is_public,
  trial_days, sort_order, created_at, updated_at)
VALUES
  ('BASIC_WEEKLY',     'Basic Hebdomadaire',   'Idéal pour démarrer — fonctionnalités essentielles',          50000,  'ZMW', 'weekly',  7,   3,  1, 200,  1000, '{"qr_menu":true,"pos":true,"inventory":true,"reports":false,"multi_branch":false,"api_access":false,"priority_support":false}', 1, 1, 0, 11, datetime('now'), datetime('now')),
  ('BASIC_MONTHLY',    'Basic Mensuel',        'Idéal pour démarrer — fonctionnalités essentielles',          200000, 'ZMW', 'monthly', 30,  3,  1, 200,  1000, '{"qr_menu":true,"pos":true,"inventory":true,"reports":false,"multi_branch":false,"api_access":false,"priority_support":false}', 1, 1, 0, 12, datetime('now'), datetime('now')),
  ('BASIC_ANNUAL',     'Basic Annuel',         'Idéal pour démarrer — fonctionnalités essentielles',          2000000,'ZMW', 'annual', 365, 3,  1, 200,  1000, '{"qr_menu":true,"pos":true,"inventory":true,"reports":false,"multi_branch":false,"api_access":false,"priority_support":false}', 1, 1, 0, 13, datetime('now'), datetime('now')),

  ('STANDARD_WEEKLY',  'Standard Hebdomadaire','Pour les restaurants en croissance — rapports et plus',       100000, 'ZMW', 'weekly',  7,   10, 1, 1000, 5000, '{"qr_menu":true,"pos":true,"inventory":true,"reports":true,"multi_branch":false,"api_access":false,"priority_support":false}', 1, 1, 0, 21, datetime('now'), datetime('now')),
  ('STANDARD_MONTHLY', 'Standard Mensuel',     'Pour les restaurants en croissance — rapports et plus',        400000, 'ZMW', 'monthly', 30,  10, 1, 1000, 5000, '{"qr_menu":true,"pos":true,"inventory":true,"reports":true,"multi_branch":false,"api_access":false,"priority_support":false}', 1, 1, 0, 22, datetime('now'), datetime('now')),
  ('STANDARD_ANNUAL',  'Standard Annuel',      'Pour les restaurants en croissance — rapports et plus',        4000000,'ZMW', 'annual', 365, 10, 1, 1000, 5000, '{"qr_menu":true,"pos":true,"inventory":true,"reports":true,"multi_branch":false,"api_access":false,"priority_support":false}', 1, 1, 0, 23, datetime('now'), datetime('now')),

  ('PREMIUM_WEEKLY',   'Premium Hebdomadaire', 'Solution complète — multi-succursales et support prioritaire', 200000, 'ZMW', 'weekly',  7,   50, 5, 5000, 50000,'{"qr_menu":true,"pos":true,"inventory":true,"reports":true,"multi_branch":true,"api_access":true,"priority_support":true}', 1, 1, 0, 31, datetime('now'), datetime('now')),
  ('PREMIUM_MONTHLY',  'Premium Mensuel',      'Solution complète — multi-succursales et support prioritaire', 800000, 'ZMW', 'monthly', 30,  50, 5, 5000, 50000,'{"qr_menu":true,"pos":true,"inventory":true,"reports":true,"multi_branch":true,"api_access":true,"priority_support":true}', 1, 1, 0, 32, datetime('now'), datetime('now')),
  ('PREMIUM_ANNUAL',   'Premium Annuel',       'Solution complète — multi-succursales et support prioritaire', 8000000,'ZMW', 'annual', 365, 50, 5, 5000, 50000,'{"qr_menu":true,"pos":true,"inventory":true,"reports":true,"multi_branch":true,"api_access":true,"priority_support":true}', 1, 1, 0, 33, datetime('now'), datetime('now'));

-- 2. Re-map existing subscriptions from legacy plans to the equivalent new tier
--    (guarded so it is safe to re-run; only runs when both codes exist)
UPDATE subscriptions
SET plan_id = (SELECT id FROM plans WHERE code = 'BASIC_WEEKLY')
WHERE plan_id = (SELECT id FROM plans WHERE code = 'STARTER_WEEKLY')
  AND EXISTS (SELECT 1 FROM plans WHERE code = 'BASIC_WEEKLY')
  AND EXISTS (SELECT 1 FROM plans WHERE code = 'STARTER_WEEKLY');

UPDATE subscriptions
SET plan_id = (SELECT id FROM plans WHERE code = 'BASIC_MONTHLY')
WHERE plan_id = (SELECT id FROM plans WHERE code = 'STARTER_MONTHLY')
  AND EXISTS (SELECT 1 FROM plans WHERE code = 'BASIC_MONTHLY')
  AND EXISTS (SELECT 1 FROM plans WHERE code = 'STARTER_MONTHLY');

UPDATE subscriptions
SET plan_id = (SELECT id FROM plans WHERE code = 'PREMIUM_MONTHLY')
WHERE plan_id = (SELECT id FROM plans WHERE code = 'PRO_MONTHLY')
  AND EXISTS (SELECT 1 FROM plans WHERE code = 'PREMIUM_MONTHLY')
  AND EXISTS (SELECT 1 FROM plans WHERE code = 'PRO_MONTHLY');

UPDATE subscriptions
SET plan_id = (SELECT id FROM plans WHERE code = 'BASIC_ANNUAL')
WHERE plan_id = (SELECT id FROM plans WHERE code = 'STARTER_ANNUAL')
  AND EXISTS (SELECT 1 FROM plans WHERE code = 'BASIC_ANNUAL')
  AND EXISTS (SELECT 1 FROM plans WHERE code = 'STARTER_ANNUAL');

UPDATE subscriptions
SET plan_id = (SELECT id FROM plans WHERE code = 'PREMIUM_ANNUAL')
WHERE plan_id = (SELECT id FROM plans WHERE code = 'PRO_ANNUAL')
  AND EXISTS (SELECT 1 FROM plans WHERE code = 'PREMIUM_ANNUAL')
  AND EXISTS (SELECT 1 FROM plans WHERE code = 'PRO_ANNUAL');

-- 3. Retire legacy Starter/Pro plans now that nothing references them
DELETE FROM plans WHERE code IN (
  'STARTER_WEEKLY', 'STARTER_MONTHLY', 'STARTER_ANNUAL',
  'PRO_MONTHLY', 'PRO_ANNUAL'
);
