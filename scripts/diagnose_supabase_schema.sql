-- =============================================================================
-- Supabase Schema Diagnostic
-- =============================================================================
-- Exécuter ce script dans Supabase SQL Editor
-- Vérifie que les tables nécessaires existent avec les bonnes colonnes
-- =============================================================================

-- 1. Vérifier la table sales
SELECT 
  column_name, 
  is_nullable, 
  data_type,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'sales'
ORDER BY ordinal_position;

-- 2. Vérifier la table sale_items
SELECT 
  column_name, 
  is_nullable, 
  data_type,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'sale_items'
ORDER BY ordinal_position;

-- 3. Vérifier les contraintes sur sales (NOT NULL, unique, foreign keys)
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'sales';

-- 4. Vérifier si des tables de billing/abonnement existent
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name IN (
    'subscriptions', 'voucher_requests', 'subscription_payment_requests',
    'plans', 'tenants', 'sales', 'sale_items', 'orders'
  )
ORDER BY table_name;

-- 5. Voir les 10 dernières erreurs de checkout côté base
-- (Si la table sync_outbox existe)
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%outbox%' 
  OR table_name LIKE '%sync%log%'
ORDER BY table_name;

-- 6. Vérifier la structure de la table voucher_requests si elle existe
SELECT 
  column_name, 
  is_nullable, 
  data_type
FROM information_schema.columns 
WHERE table_name = 'voucher_requests'
ORDER BY ordinal_position;