-- ============================================================================
-- DIAGNOSTIC: Erreur CHECK constraint sur la colonne role
-- ============================================================================
--
-- Objectif:
-- Identifier précisément quel rôle provoque l'échec de la contrainte CHECK:
-- role IN ('owner','admin','manager','cashier','waiter','staff')
--
-- Usage:
-- sqlite3 data/database.db < scripts/diagnostic_role_constraint.sql
--
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1: IDENTIFIER LES TABLES CONCERNÉES
-- ============================================================================

SELECT '=== TABLES AVEC CONTRAINTE CHECK SUR role ===' AS section;

SELECT 
    name AS table_name,
    sql
FROM sqlite_master
WHERE type = 'table'
    AND sql LIKE '%CHECK (role IN%'
ORDER BY name;

-- ============================================================================
-- ÉTAPE 2: AFFICHER LES RÔLES DANS users
-- ============================================================================

SELECT '=== RÔLES DANS users ===' AS section;

SELECT DISTINCT 
    role,
    COUNT(*) AS count,
    GROUP_CONCAT(id) AS user_ids
FROM users
GROUP BY role
ORDER BY count DESC;

-- ============================================================================
-- ÉTAPE 3: AFFICHER LES RÔLES DANS tenant_users
-- ============================================================================

SELECT '=== RÔLES DANS tenant_users ===' AS section;

SELECT DISTINCT 
    role,
    COUNT(*) AS count,
    GROUP_CONCAT(id) AS tenant_user_ids
FROM tenant_users
GROUP BY role
ORDER BY count DESC;

-- ============================================================================
-- ÉTAPE 4: AFFICHER LES RÔLES AUTORISÉS PAR LES CONTRAINTES
-- ============================================================================

SELECT '=== RÔLES AUTORISÉS ===' AS section;

SELECT 
    'users' AS table_name,
    'owner, admin, manager, cashier, waiter, staff' AS roles_autorises
UNION ALL
SELECT 
    'tenant_users',
    'owner, admin, manager, cashier, waiter, staff, super_admin'
UNION ALL
SELECT 
    'tenant_users_v2 (ancienne)',
    'owner, admin, manager, cashier, waiter, staff, super_admin';

-- ============================================================================
-- ÉTAPE 5: IDENTIFIER LES RÔLES PROBLÉMATIQUES
-- ============================================================================

SELECT '=== RÔLES PROBLÉMATIQUES DANS users ===' AS section;

SELECT 
    id,
    name,
    email,
    role,
    tenant_id,
    created_at
FROM users
WHERE role NOT IN ('owner','admin','manager','cashier','waiter','staff')
ORDER BY role, id;

SELECT '=== RÔLES PROBLÉMATIQUES DANS tenant_users ===' AS section;

SELECT 
    tu.id,
    tu.tenant_id,
    tu.user_id,
    tu.role,
    u.name AS user_name,
    u.email AS user_email
FROM tenant_users tu
LEFT JOIN users u ON tu.user_id = u.id
WHERE tu.role NOT IN ('owner','admin','manager','cashier','waiter','staff','super_admin')
ORDER BY tu.role, tu.id;

-- ============================================================================
-- ÉTAPE 6: RECHERCHER LES RÔLES SPÉCIAUX
-- ============================================================================

SELECT '=== UTILISATEURS AVEC RÔLES SPÉCIAUX ===' AS section;

-- Rechercher super_admin
SELECT 
    'super_admin' AS role_recherche,
    COUNT(*) AS count
FROM users
WHERE role = 'super_admin'

UNION ALL

-- Rechercher platform_admin
SELECT 
    'platform_admin',
    COUNT(*)
FROM users
WHERE role = 'platform_admin'

UNION ALL

-- Rechercher platform_support
SELECT 
    'platform_support',
    COUNT(*)
FROM users
WHERE role = 'platform_support'

UNION ALL

-- Rechercher support
SELECT 
    'support',
    COUNT(*)
FROM users
WHERE role = 'support'

UNION ALL

-- Rechercher owner
SELECT 
    'owner',
    COUNT(*)
FROM users
WHERE role = 'owner'

UNION ALL

-- Rechercher admin
SELECT 
    'admin',
    COUNT(*)
FROM users
WHERE role = 'admin'

UNION ALL

-- Rechercher manager
SELECT 
    'manager',
    COUNT(*)
FROM users
WHERE role = 'manager'

UNION ALL

-- Rechercher cashier
SELECT 
    'cashier',
    COUNT(*)
FROM users
WHERE role = 'cashier'

UNION ALL

-- Rechercher waiter
SELECT 
    'waiter',
    COUNT(*)
FROM users
WHERE role = 'waiter'

UNION ALL

-- Rechercher staff
SELECT 
    'staff',
    COUNT(*)
FROM users
WHERE role = 'staff'

ORDER BY role_recherche;

-- ============================================================================
-- ÉTAPE 7: DÉTAIL DES UTILISATEURS AVEC RÔLES SPÉCIAUX
-- ============================================================================

SELECT '=== DÉTAIL UTILISATEURS AVEC RÔLES SPÉCIAUX ===' AS section;

SELECT 
    id,
    name,
    email,
    role,
    is_super_admin,
    tenant_id,
    created_at
FROM users
WHERE role IN ('super_admin', 'platform_admin', 'platform_support', 'support')
   OR (role = 'owner' AND is_super_admin = 1)
ORDER BY role, id;

-- ============================================================================
-- ÉTAPE 8: VÉRIFIER LES CONTRAINTES ACTIVES
-- ============================================================================

SELECT '=== CONTRAINTES ACTIVES SUR users ===' AS section;

SELECT 
    sql
FROM sqlite_master
WHERE type = 'table'
    AND name = 'users';

SELECT '=== CONTRAINTES ACTIVES SUR tenant_users ===' AS section;

SELECT 
    sql
FROM sqlite_master
WHERE type = 'table'
    AND name = 'tenant_users';

-- ============================================================================
-- ÉTAPE 9: RAPPORT DE SYNTHÈSE
-- ============================================================================

SELECT '=== RAPPORT DE SYNTHÈSE ===' AS section;

SELECT 
    'Total rôles distincts dans users' AS check_type,
    COUNT(DISTINCT role) AS count
FROM users

UNION ALL

SELECT 
    'Total rôles distincts dans tenant_users',
    COUNT(DISTINCT role)
FROM tenant_users

UNION ALL

SELECT 
    'Rôles invalides dans users',
    COUNT(*)
FROM users
WHERE role NOT IN ('owner','admin','manager','cashier','waiter','staff')

UNION ALL

SELECT 
    'Rôles invalides dans tenant_users',
    COUNT(*)
FROM tenant_users
WHERE role NOT IN ('owner','admin','manager','cashier','waiter','staff','super_admin');

-- ============================================================================
-- ÉTAPE 10: LISTER TOUS LES RÔLES DISTINCTS
-- ============================================================================

SELECT '=== TOUS LES RÔLES DISTINCTS (users + tenant_users) ===' AS section;

SELECT DISTINCT role FROM users
UNION
SELECT DISTINCT role FROM tenant_users
ORDER BY role;

-- ============================================================================
-- FIN DU DIAGNOSTIC
-- ============================================================================

SELECT '=== FIN DU DIAGNOSTIC ===' AS section;
SELECT 'Exécutez ce script et envoyez les résultats pour analyse.' AS instruction;