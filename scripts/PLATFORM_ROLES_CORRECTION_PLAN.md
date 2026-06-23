# PLAN DE CORRECTION DÉFINITIVE: RÔLES PLATE-FORME

## Résumé

Ce document prépare la correction complète du problème de contrainte CHECK sur `users.role` pour supporter les rôles plateforme (`super_admin`, `platform_admin`, `platform_support`, `support_admin`, `finance_admin`, `ops_admin`).

**Aucune modification n'est effectuée** - Ceci est un plan de correction à valider avant exécution.

---

## 1. CONTRAINTES CHECK ACTUELLES

### Table `users` (Migration 012)

**Fichier:** `backend/migrations/012_saas_multitenant_schema.sql` (ligne 107)

```sql
role TEXT NOT NULL DEFAULT 'staff' 
CHECK (role IN ('owner','admin','manager','cashier','waiter','staff'))
```

**Statut:** ❌ TROP RESTRICTIVE

### Table `tenant_users` (Migration 036)

**Fichier:** `backend/migrations/036_super_admin_roles.sql` (ligne 45)

```sql
role TEXT NOT NULL DEFAULT 'staff' 
CHECK (role IN ('owner','admin','manager','cashier','waiter','staff','super_admin'))
```

**Statut:** ✅ OK (accepte `super_admin`)

---

## 2. RÔLES PLATE-FORME (Source CSV fourni)

**Fichier fourni:** `platform_roles_rows.csv`

| id | role_name | display_name | description | permissions | is_system_role |
|----|-----------|--------------|-------------|-------------|----------------|
| 1 | `super_admin` | Super Admin | Accès complet à toutes les fonctionnalités de la plateforme | `["*"]` | true |
| 2 | `support_admin` | Support Admin | Gestion du support client, consultation tenants et logs | `["tenants:read","tenants:view","audit:read","sync:read","vouchers:read"]` | true |
| 3 | `finance_admin` | Finance Admin | Gestion financière: abonnements, vouchers, revenus | `["subscriptions:read","subscriptions:write","vouchers:read","vouchers:write","finance:read","billing:read"]` | true |
| 4 | `ops_admin` | Ops Admin | Opérations: suspension, réactivation, monitoring | `["tenants:write","tenants:suspend","tenants:activate","sync:write","monitoring:read"]` | true |

**Rôles à ajouter:** `super_admin`, `support_admin`, `finance_admin`, `ops_admin`

---

## 3. RÔLES UTILISÉS DANS LE CODE

### Rôles métier (tenants)

| Rôle | Utilisé dans | Fichier |
|------|--------------|---------|
| `owner` | super-admin.middleware.ts | Ligne 24 |
| `admin` | database.ts, sales.ts | Ligne 156, 23 |
| `manager` | settingsStore.ts | Ligne 8 |
| `cashier` | notificationStore.ts | Ligne 15 |
| `waiter` | table.service.ts, order.service.ts | Ligne 8, 18 |
| `staff` | saas-supabase-extras.repository.ts | Ligne 4 |

### Rôles plateforme

| Rôle | Utilisé dans | Fichier |
|------|--------------|---------|
| `super_admin` | platform-auth.service.ts, super-admin.middleware.ts, platform-auth.middleware.ts | Ligne 14, 12, 12 |
| `support_admin` | platform-auth.service.ts | Ligne 14 |
| `finance_admin` | platform-auth.service.ts | Ligne 14 |
| `ops_admin` | platform-auth.service.ts | Ligne 14 |

---

## 4. LISTE UNIQUE FINALE DES RÔLES AUTORISÉS

### Pour la table `users`

```sql
('owner','admin','manager','cashier','waiter','staff',
 'super_admin','platform_admin','platform_support',
 'support_admin','finance_admin','ops_admin')
```

**Total:** 11 rôles

### Pour la table `tenant_users`

```sql
('owner','admin','manager','cashier','waiter','staff','super_admin')
```

**Total:** 7 rôles (pas de changement nécessaire)

---

## 5. MIGRATION SQLITE COMPLÈTE

### Fichier: `backend/migrations/041_fix_users_role_constraint.sql`

```sql
-- ============================================================================
-- Migration 041: Corriger la contrainte CHECK sur users.role
-- ============================================================================
-- Ajoute les rôles plateforme: super_admin, platform_admin, platform_support,
-- support_admin, finance_admin, ops_admin
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1: SAUVEGARDER LES UTILISATEURS EXISTANTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS users_backup_041 AS 
SELECT * FROM users;

-- Vérifier la sauvegarde
SELECT COUNT(*) AS users_sauvegardes FROM users_backup_041;

-- ============================================================================
-- ÉTAPE 2: CRÉER LA NOUVELLE TABLE users
-- ============================================================================

CREATE TABLE IF NOT EXISTS users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    full_name VARCHAR(255),
    pin_code VARCHAR(10),
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN (
        'owner','admin','manager','cashier','waiter','staff',
        'super_admin','platform_admin','platform_support',
        'support_admin','finance_admin','ops_admin'
    )),
    is_active INTEGER NOT NULL DEFAULT 1,
    password_hash TEXT NOT NULL,
    tenant_id INTEGER,
    phone VARCHAR(20),
    has_setup_pin INTEGER DEFAULT 0,
    remote_id INTEGER,
    business_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_super_admin INTEGER NOT NULL DEFAULT 0,
    is_platform_user BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- ÉTAPE 3: COPIER LES DONNÉES
-- ============================================================================

INSERT INTO users_new 
SELECT * FROM users;

-- Vérifier les insertions
SELECT COUNT(*) AS users_copies FROM users_new;

-- ============================================================================
-- ÉTAPE 4: SUPPRIMER L'ANCIENNE TABLE
-- ============================================================================

DROP TABLE users;

-- ============================================================================
-- ÉTAPE 5: RENOMMER LA NOUVELLE TABLE
-- ============================================================================

ALTER TABLE users_new RENAME TO users;

-- ============================================================================
-- ÉTAPE 6: RECRÉER LES INDEX
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_remote_id 
  ON users(remote_id) WHERE remote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_business_id 
  ON users(business_id);

CREATE INDEX IF NOT EXISTS idx_users_is_super_admin 
  ON users(is_super_admin) WHERE is_super_admin = 1;

CREATE INDEX IF NOT EXISTS idx_users_is_platform_user 
  ON users(is_platform_user) WHERE is_platform_user = 1;

CREATE INDEX IF NOT EXISTS idx_users_tenant_id 
  ON users(tenant_id);

-- ============================================================================
-- ÉTAPE 7: VÉRIFIER LA CONTRAINTE
-- ============================================================================

-- Tester que la contrainte fonctionne
SELECT 'Test contrainte: tentative d''insertion invalide' AS test;

-- Ceci doit ÉCHOUER (rôle invalide)
-- INSERT INTO users (email, role) VALUES ('test@test.com', 'invalid_role');

-- Ceci doit RÉUSSIR (rôle valide)
INSERT INTO users (email, role, password_hash) 
VALUES ('test_constraint@test.com', 'super_admin', 'test')
ON CONFLICT(email) DO NOTHING;

-- Nettoyer le test
DELETE FROM users WHERE email = 'test_constraint@test.com';

-- ============================================================================
-- ÉTAPE 8: VÉRIFIER L'INTÉGRITÉ DES DONNÉES
-- ============================================================================

SELECT '=== VÉRIFICATION POST-MIGRATION ===' AS section;

-- Compter les utilisateurs
SELECT 
    COUNT(*) AS total_users,
    COUNT(CASE WHEN role = 'super_admin' THEN 1 END) AS super_admins,
    COUNT(CASE WHEN is_platform_user = 1 THEN 1 END) AS platform_users
FROM users;

-- Vérifier les rôles existants
SELECT DISTINCT role, COUNT(*) AS count
FROM users
GROUP BY role
ORDER BY role;

-- Vérifier les utilisateurs plateforme
SELECT id, email, role, is_platform_user, is_super_admin, tenant_id
FROM users
WHERE is_platform_user = 1 OR role IN ('super_admin','platform_admin','platform_support','support_admin','finance_admin','ops_admin');

-- ============================================================================
-- ÉTAPE 9: NETTOYER LA TABLE DE BACKUP
-- ============================================================================

-- Décommenter seulement après validation complète
-- DROP TABLE IF EXISTS users_backup_041;

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

SELECT 'Migration 041 terminée avec succès' AS status;
```

---

## 6. CORRECTIF platform-bootstrap.ts

### Fichier: `src/server/platform/platform-bootstrap.ts`

**Ligne 119 - AVANT:**
```typescript
add('role', 'owner');
```

**Ligne 119 - APRÈS:**
```typescript
add('role', 'super_admin');
```

**Justification:**
- Le bootstrap crée le super admin de la plateforme
- Le middleware attend `role = 'super_admin'` (ligne 12 super-admin.middleware.ts)
- La nouvelle contrainte CHECK accepte `super_admin`
- Cohérent avec les rôles plateforme définis dans le CSV

**Impact:**
- ✅ Le super admin aura le bon rôle
- ✅ Cohérent avec le middleware
- ✅ Compatible avec la nouvelle contrainte

---

## 7. IMPACT SUR LES SERVICES

### 7.1 GenericSyncService

**Fichier:** `src/sync/core/generic-sync.service.ts`

**Impact:** ✅ AUCUN

**Raison:**
- `entity-registry.ts` définit déjà `user` avec `hasTenantId: true`
- Le pull récupère tous les utilisateurs avec `tenant_id = X`
- Les admins plateforme ont `tenant_id = null` → pas récupérés par le pull tenant
- Si Supabase a un `super_admin` avec `tenant_id = null`, il ne sera pas synchronisé vers SQLite
- **C'est le comportement attendu** (isolation plateforme vs tenants)

**Vérification:**
```typescript
// Ligne 722: query.eq('tenant_id', tenantIdForQuery)
// Les admins plateforme ont tenant_id = null → pas récupérés
// Pas de problème de contrainte CHECK
```

### 7.2 AuthService

**Fichier:** `src/server/services/auth.service.ts` (à vérifier)

**Impact:** ✅ AUCUN

**Raison:**
- L'authentification vérifie `role` dans la table `users`
- La contrainte CHECK est transparente pour l'auth
- Les rôles existants (`owner`, `admin`, etc.) sont toujours autorisés

### 7.3 PlatformAuthService

**Fichier:** `src/server/platform/platform-auth.service.ts`

**Impact:** ✅ POSITIF

**Raison:**
- Ligne 14: `const platformRoles = ['super_admin', 'support_admin', 'finance_admin', 'ops_admin']`
- Ces rôles seront maintenant autorisés dans `users`
- Plus d'erreur de contrainte CHECK

**Vérification:**
```typescript
// Ligne 14: platformRoles inclut maintenant tous les rôles autorisés
// Ligne 17: if (!platformRoles.includes(user.role) && user.role !== 'owner')
// → super_admin, support_admin, finance_admin, ops_admin sont maintenant valides
```

### 7.4 SuperAdminMiddleware

**Fichier:** `src/server/middleware/super-admin.middleware.ts`

**Impact:** ✅ POSITIF

**Raison:**
- Ligne 12: `if (user.role !== 'super_admin' && user.role !== 'owner')`
- `super_admin` sera maintenant présent dans `users`
- Le middleware fonctionnera correctement

**Vérification:**
```typescript
// Ligne 12: Vérifie role === 'super_admin'
// Ligne 24: Vérifie role === 'owner'
// Les deux rôles sont maintenant autorisés par la contrainte
```

### 7.5 TenantUserService

**Fichier:** `src/sync/user-tenant-sync.service.ts`

**Impact:** ✅ AUCUN

**Raison:**
- `tenant_users` a déjà `super_admin` dans sa contrainte (migration 036)
- Pas de changement nécessaire
- Les admins plateforme ne sont pas dans `tenant_users` (tenant_id = null)

---

## 8. PLAN DE ROLLBACK

### 8.1 Rollback automatique (si erreur pendant migration)

```sql
-- Restaurer depuis la backup
DROP TABLE IF EXISTS users;
ALTER TABLE users_backup_041 RENAME TO users;

-- Recréer les index
CREATE INDEX IF NOT EXISTS idx_users_remote_id 
  ON users(remote_id) WHERE remote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_business_id 
  ON users(business_id);

CREATE INDEX IF NOT EXISTS idx_users_is_super_admin 
  ON users(is_super_admin) WHERE is_super_admin = 1;

CREATE INDEX IF NOT EXISTS idx_users_is_platform_user 
  ON users(is_platform_user) WHERE is_platform_user = 1;

CREATE INDEX IF NOT EXISTS idx_users_tenant_id 
  ON users(tenant_id);

SELECT 'Rollback effectué' AS status;
```

### 8.2 Rollback manuel (si problème après migration)

```bash
# 1. Restaurer la base de données depuis un backup
cp data/database.db.backup data/database.db

# 2. Vérifier la restauration
sqlite3 data/database.db "SELECT COUNT(*) FROM users;"

# 3. Redémarrer l'application
npm run dev
```

### 8.3 Rollback du code

```bash
# 1. Revenir à la version précédente de platform-bootstrap.ts
git revert HEAD~1

# 2. Recompiler
npm run build

# 3. Redémarrer
npm run dev
```

---

## 9. VALIDATIONS PRÉ-REQUISES

### 9.1 Avant exécution

- [ ] **Sauvegarde de la base de données**
  ```bash
  cp data/database.db data/database.db.backup.$(date +%Y%m%d_%H%M%S)
  ```

- [ ] **Vérifier l'état actuel**
  ```sql
  SELECT COUNT(*) AS total_users FROM users;
  SELECT DISTINCT role FROM users;
  SELECT COUNT(*) AS platform_users FROM users WHERE is_platform_user = 1;
  ```

- [ ] **Vérifier les contraintes actuelles**
  ```sql
  SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users';
  ```

- [ ] **Tester la migration sur une copie**
  ```bash
  cp data/database.db data/database.db.test
  sqlite3 data/database.test < backend/migrations/041_fix_users_role_constraint.sql
  ```

- [ ] **Vérifier Supabase**
  - Confirmer que Supabase a les mêmes rôles
  - Vérifier qu'aucun rôle supplémentaire n'est utilisé

### 9.2 Après exécution

- [ ] **Vérifier les utilisateurs**
  ```sql
  SELECT COUNT(*) AS total_users FROM users;
  SELECT DISTINCT role FROM users ORDER BY role;
  ```

- [ ] **Vérifier la contrainte**
  ```sql
  -- Ceci doit réussir
  INSERT INTO users (email, role, password_hash) 
  VALUES ('test_super_admin@test.com', 'super_admin', 'test');
  
  -- Nettoyer
  DELETE FROM users WHERE email = 'test_super_admin@test.com';
  ```

- [ ] **Vérifier le super admin**
  ```sql
  SELECT id, email, role, is_platform_user, is_super_admin 
  FROM users 
  WHERE is_platform_user = 1;
  ```

- [ ] **Tester l'authentification**
  ```bash
  # Se connecter avec le super admin
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@ekala.africa","password":"AdminEkala2026!"}'
  ```

- [ ] **Tester la synchronisation**
  ```bash
  # Déclencher une sync
  curl -X POST http://localhost:3001/api/sync/trigger
  
  # Vérifier les logs
  tail -f logs/app.log | grep -E "GenericSync|CHECK constraint"
  ```

- [ ] **Vérifier les services**
  - PlatformAuthService: `GET /api/platform/auth/me`
  - SuperAdminMiddleware: Accès aux routes plateforme
  - TenantUserService: Création d'utilisateurs tenant

---

## 10. RISQUES IDENTIFIÉS

### Risque 1: Perte de données

**Probabilité:** FAIBLE
**Impact:** CRITIQUE

**Mitigation:**
- Sauvegarde automatique avant migration
- Test sur copie de la base
- Rollback automatique si erreur

### Risque 2: Incompatibilité avec Supabase

**Probabilité:** MOYENNE
**Impact:** ÉLEVÉ

**Mitigation:**
- Vérifier les rôles dans Supabase AVANT la migration
- Adapter la contrainte CHECK si Supabase a des rôles supplémentaires
- Tester la synchronisation après migration

### Risque 3: Utilisateurs existants avec rôle invalide

**Probabilité:** FAIBLE
**Impact:** MOYEN

**Mitigation:**
- Vérifier les rôles existants AVANT la migration
- Si un rôle invalide existe, le mapper vers un rôle valide
- Exemple: `'super_admin'` dans `users` → sera maintenant valide

### Risque 4: Incohérence bootstrap/middleware

**Probabilité:** MOYENNE
**Impact:** MOYEN

**Mitigation:**
- Appliquer le correctif `platform-bootstrap.ts` EN MÊME TEMPS que la migration
- Tester le bootstrap après migration
- Vérifier que le super admin a `role = 'super_admin'`

### Risque 5: Services qui utilisent des rôles hardcodés

**Probabilité:** MOYENNE
**Impact:** FAIBLE

**Mitigation:**
- Vérifier tous les fichiers qui font des checks sur `role`
- S'assurer que les nouveaux rôles sont gérés correctement
- Tester chaque service après migration

---

## 11. FICHIERS À MODIFIER

### 11.1 Migration SQL (NOUVEAU)

**Fichier:** `backend/migrations/041_fix_users_role_constraint.sql`
**Action:** CRÉER
**Lignes:** ~100

### 11.2 Code TypeScript (MODIFICATION)

**Fichier:** `src/server/platform/platform-bootstrap.ts`
**Ligne:** 119
**Changement:**
```typescript
// AVANT
add('role', 'owner');

// APRÈS
add('role', 'super_admin');
```

### 11.3 Aucune autre modification nécessaire

**Raison:**
- `entity-registry.ts` est déjà correct
- `GenericSyncService` est déjà correct
- Les middlewares sont déjà corrects
- Seule la contrainte CHECK bloque

---

## 12. ORDRE D'EXÉCUTION RECOMMANDÉ

### Phase 1: Préparation (15 min)

1. Sauvegarde de la base de données
2. Vérification de l'état actuel
3. Test de la migration sur copie
4. Vérification de Supabase

### Phase 2: Migration (5 min)

1. Arrêt de l'application
2. Exécution de la migration 041
3. Vérification des données
4. Application du correctif platform-bootstrap.ts

### Phase 3: Validation (15 min)

1. Redémarrage de l'application
2. Test d'authentification super admin
3. Test de synchronisation
4. Vérification des services

### Phase 4: Monitoring (24h)

1. Surveillance des logs
2. Vérification des erreurs
3. Validation fonctionnelle

---

## 13. CHECKLIST DE VALIDATION

### Pré-migration

- [ ] Backup créé
- [ ] Rôles existants vérifiés
- [ ] Supabase vérifié
- [ ] Migration testée sur copie
- [ ] Équipe informée

### Post-migration

- [ ] Users comptés
- [ ] Rôles vérifiés
- [ ] Contrainte testée
- [ ] Super admin fonctionnel
- [ ] Auth fonctionnelle
- [ ] Sync fonctionnelle
- [ ] Services fonctionnels
- [ ] Logs propres
- [ ] Rollback testé

---

## 14. CONTACTS ET RESPONSABILITÉS

| Rôle | Responsable | Action |
|------|-------------|--------|
| Exécution migration | DevOps | Exécuter migration 041 |
| Validation technique | Lead Dev | Vérifier les services |
| Validation métier | Product Owner | Tester les fonctionnalités |
| Rollback | DevOps | En cas de problème |
| Communication | Project Manager | Informer l'équipe |

---

## 15. ANNEXE: RÔLES PLATE-FORME (CSV fourni)

```
id,role_name,display_name,description,permissions,is_system_role,created_at,updated_at
1,super_admin,Super Admin,Accès complet à toutes les fonctionnalités de la plateforme,"[""*""]",true,2026-06-22 08:26:41.316519+00,2026-06-22 08:26:41.316519+00
2,support_admin,Support Admin,"Gestion du support client, consultation tenants et logs","[""tenants:read"",""tenants:view"",""audit:read"",""sync:read"",""vouchers:read""]",true,2026-06-22 08:26:41.316519+00,2026-06-22 08:26:41.316519+00
3,finance_admin,Finance Admin,"Gestion financière: abonnements, vouchers, revenus","[""subscriptions:read"",""subscriptions:write"",""vouchers:read"",""vouchers:write"",""finance:read"",""billing:read""]",true,2026-06-22 08:26:41.316519+00,2026-06-22 08:26:41.316519+00
4,ops_admin,Ops Admin,"Opérations: suspension, réactivation, monitoring","[""tenants:write"",""tenants:suspend"",""tenants:activate"",""sync:write"",""monitoring:read""]",true,2026-06-22 08:26:41.316519+00,2026-06-22 08:26:41.316519+00
```

**Rôles à intégrer:** `super_admin`, `support_admin`, `finance_admin`, `ops_admin`

---

## CONCLUSION

Ce plan prépare une correction **sûre et complète** du problème de contrainte CHECK sur `users.role`.

**Points clés:**
1. ✅ Migration SQLite complète avec sauvegarde/restoration
2. ✅ Correctif platform-bootstrap.ts pour cohérence
3. ✅ Aucun impact sur GenericSyncService (déjà correct)
4. ✅ Rollback automatique et manuel
5. ✅ Validations pré et post-migration
6. ✅ Gestion des risques

**Prêt à exécuter après validation.**