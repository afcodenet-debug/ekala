-- ============================================================================
-- SCRIPT DE RÉPARATION DES REMOTE_ID APRÈS MIGRATION TENANT 1 → 16
-- ============================================================================
-- 
-- Contexte:
-- Après migration tenant_id=1 → tenant_id=16, les produits ont des remote_id 
-- artificiels (migrated_from_1_xxx) alors que les IDs Supabase réels existent.
--
-- Objectif:
-- Remplacer les remote_id 'migrated_*' par les IDs Supabase correspondants
-- en matchant par nom + tenant_id.
--
-- Contraintes:
-- - Ne créer aucun produit
-- - Ne supprimer aucun produit
-- - Ne modifier aucune donnée métier
-- - Modifier UNIQUEMENT la colonne remote_id
-- - Exécuter dans une transaction
--
-- Usage:
-- sqlite3 data/database.db < scripts/fix_migrated_remote_ids.sql
--
-- ============================================================================

-- Désactiver l'autocommit pour garantir une transaction
BEGIN TRANSACTION;

-- ============================================================================
-- ÉTAPE 1: AFFICHER L'ÉTAT AVANT
-- ============================================================================

SELECT '=== AVANT RÉPARATION ===' AS section;

SELECT 
    id,
    name,
    tenant_id,
    remote_id AS remote_id_avant,
    created_at
FROM products
WHERE tenant_id = 16
    AND (remote_id LIKE 'migrated_%' OR remote_id IS NULL OR remote_id = '')
ORDER BY id;

-- Compter le nombre de produits à réparer
SELECT 
    COUNT(*) AS produits_a_reparer
FROM products
WHERE tenant_id = 16
    AND (remote_id LIKE 'migrated_%' OR remote_id IS NULL OR remote_id = '');

-- ============================================================================
-- ÉTAPE 2: METTRE À JOUR LES REMOTE_ID
-- ============================================================================

-- SQLite ne supporte pas UPDATE ... FROM, donc on utilise CASE
UPDATE products
SET 
    remote_id = CASE name
        WHEN 'Mosi' THEN 563
        WHEN 'Castle Lite' THEN 564
        WHEN 'Hunters' THEN 565
        WHEN 'Budweiser' THEN 566
        WHEN 'Coc Cola' THEN 567
        WHEN 'Fanta Orange' THEN 568
        WHEN 'Sprite' THEN 569
        WHEN 'Water Bottle' THEN 570
    END,
    updated_at = datetime('now')
WHERE tenant_id = 16
    AND name IN (
        'Mosi', 'Castle Lite', 'Hunters', 'Budweiser', 
        'Coc Cola', 'Fanta Orange', 'Sprite', 'Water Bottle'
    )
    AND (remote_id LIKE 'migrated_%' 
         OR remote_id IS NULL 
         OR remote_id = '');

-- ============================================================================
-- ÉTAPE 3: AFFICHER L'ÉTAT APRÈS
-- ============================================================================

SELECT '=== APRÈS RÉPARATION ===' AS section;

SELECT 
    id,
    name,
    tenant_id,
    remote_id AS remote_id_apres,
    created_at
FROM products
WHERE tenant_id = 16
    AND id IN (563, 564, 565, 566, 567, 568, 569, 570)
ORDER BY id;

-- ============================================================================
-- ÉTAPE 4: VÉRIFIER LES RÉSULTATS
-- ============================================================================

-- Compter le nombre de produits réparés
SELECT 
    COUNT(*) AS produits_reparés
FROM products
WHERE tenant_id = 16
    AND remote_id IN (563, 564, 565, 566, 567, 568, 569, 570);

-- Vérifier qu'il ne reste plus de remote_id migrated_*
SELECT 
    COUNT(*) AS produits_avec_remote_id_invalide_restants
FROM products
WHERE tenant_id = 16
    AND (remote_id LIKE 'migrated_%' OR remote_id IS NULL OR remote_id = '');

-- Vérifier la cohérence: tous les produits doivent avoir un remote_id numérique
SELECT 
    id,
    name,
    remote_id,
    CASE 
        WHEN remote_id IS NULL THEN 'NULL'
        WHEN remote_id = '' THEN 'EMPTY'
        WHEN remote_id LIKE 'migrated_%' THEN 'MIGRATED'
        WHEN CAST(remote_id AS INTEGER) = remote_id THEN 'VALID'
        ELSE 'INVALID'
    END AS remote_id_status
FROM products
WHERE tenant_id = 16
ORDER BY id;

-- ============================================================================
-- ÉTAPE 5: RAPPORT FINAL
-- ============================================================================

SELECT '=== RAPPORT DE RÉPARATION ===' AS section;

SELECT 
    'Produits avant réparation' AS etape,
    COUNT(*) AS count
FROM products
WHERE tenant_id = 16
    AND (remote_id LIKE 'migrated_%' OR remote_id IS NULL OR remote_id = '')

UNION ALL

SELECT 
    'Produits réparés',
    COUNT(*)
FROM products
WHERE tenant_id = 16
    AND remote_id IN (563, 564, 565, 566, 567, 568, 569, 570)

UNION ALL

SELECT 
    'Produits avec remote_id invalide restants',
    COUNT(*)
FROM products
WHERE tenant_id = 16
    AND (remote_id LIKE 'migrated_%' OR remote_id IS NULL OR remote_id = '');

-- ============================================================================
-- VALIDER LA TRANSACTION
-- ============================================================================

-- Si tout est correct, valider la transaction
-- Si un problème est détecté, exécuter: ROLLBACK;
COMMIT;

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================