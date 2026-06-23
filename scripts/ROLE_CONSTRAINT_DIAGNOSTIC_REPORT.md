# DIAGNOSTIC: ERREUR CHECK CONSTRAINT SUR LA COLONNE role

## Résumé du problème

**Erreur observée:**
```
CHECK constraint failed:
role IN ('owner','admin','manager','cashier','waiter','staff')
```

## Tables avec contraintes CHECK sur role

### 1. Table `users`

**Fichier:** `backend/migrations/012_saas_multitenant_schema.sql` (ligne 107)

```sql
CREATE TABLE IF NOT EXISTS users (
    ...
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff')),
    ...
);
```

**Rôles autorisés:** `owner`, `admin`, `manager`, `cashier`, `waiter`, `staff`

### 2. Table `tenant_users` (version actuelle)

**Fichier:** `backend/migrations/036_super_admin_roles.sql` (ligne 45)

```sql
CREATE TABLE IF NOT EXISTS tenant_users_v2 (
    ...
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff','super_admin')),
    ...
);
```

**Rôles autorisés:** `owner`, `admin`, `manager`, `cashier`, `waiter`, `staff`, `super_admin`

### 3. Table `tenant_users` (ancienne version)

**Fichier:** `backend/migrations/012_saas_multitenant_schema.sql` (ligne 107)

```sql
CREATE TABLE IF NOT EXISTS tenant_users (
    ...
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff')),
    ...
);
```

**Rôles autorisés:** `owner`, `admin`, `manager`, `cashier`, `waiter`, `staff`

## Rôles trouvés dans le code backend

### Recherche dans les fichiers TypeScript

**Fichiers analysés:**
- `src/server/middleware/super-admin.middleware.ts`
- `src/server/platform/platform-auth.service.ts`
- `src/server/platform/platform-auth.middleware.ts`
- `src/server/services/user.service.ts`
- `src/sync/user-tenant-sync.service.ts`
- `src/server/db/database.ts`

### Rôles détectés dans le code

| Rôle | Fichier | Ligne | Contexte |
|------|---------|-------|----------|
| `super_admin` | platform-auth.service.ts | 14 | `const platformRoles = ['super_admin', 'support_admin', 'finance_admin', 'ops_admin'];` |
| `super_admin` | super-admin.middleware.ts | 12 | `if (user.role !== 'super_admin' && user.role !== 'owner')` |
| `super_admin` | platform-auth.middleware.ts | 12 | `if (payload.role === 'super_admin')` |
| `owner` | super-admin.middleware.ts | 24 | `if (user.role === 'owner')` |
| `owner` | user.service.ts | 45 | `if (input.role === 'owner' && requesterRole !== 'owner')` |
| `admin` | database.ts | 156 | `WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')` |
| `admin` | sales.ts | 23 | `SELECT id FROM users WHERE role = "admin"` |
| `manager` | settingsStore.ts | 8 | `if (role === 'admin' || role === 'manager')` |
| `cashier` | notificationStore.ts | 15 | `if (role === 'cashier')` |
| `waiter` | table.service.ts | 8 | `if (params?.role === 'waiter')` |
| `waiter` | order.service.ts | 18 | `if (role === 'waiter' && waiter_id)` |
| `staff` | saas-supabase-extras.repository.ts | 4 | `role: string = 'staff'` |
| `staff` | database.ts | 158 | `const roles = ['admin', 'manager', 'cashier', 'waiter'];` |

### Rôles SPÉCIAUX non présents dans les contraintes CHECK

| Rôle | Présent dans code | Présent dans users | Présent dans tenant_users | Problème |
|------|------------------|--------------------|---------------------------|----------|
| `super_admin` | ✅ OUI | ❌ NON | ✅ OUI | **PROBLÈME** |
| `platform_admin` | ✅ OUI | ❌ NON | ❌ NON | **PROBLÈME** |
| `platform_support` | ✅ OUI | ❌ NON | ❌ NON | **PROBLÈME** |
| `support_admin` | ✅ OUI | ❌ NON | ❌ NON | **PROBLÈME** |
| `finance_admin` | ✅ OUI | ❌ NON | ❌ NON | **PROBLÈME** |
| `ops_admin` | ✅ OUI | ❌ NON | ❌ NON | **PROBLÈME** |
| `support` | ❌ NON | ❌ NON | ❌ NON | - |

## Analyse du problème

### Cause racine

**La table `users` a une contrainte CHECK trop restrictive:**

```sql
CHECK (role IN ('owner','admin','manager','cashier','waiter','staff'))
```

**Mais le code utilise des rôles supplémentaires:**
- `super_admin` - pour les super administrateurs plateforme
- `platform_admin` - pour les administrateurs plateforme
- `platform_support` - pour le support plateforme
- `support_admin`, `finance_admin`, `ops_admin` - rôles spécialisés

### Scénarios d'échec

#### Scénario 1: Insertion d'un super_admin dans users

```sql
INSERT INTO users (name, email, role, ...) 
VALUES ('Super Admin', 'admin@ekala.africa', 'super_admin', ...);
-- ❌ ÉCHEC: CHECK constraint failed
```

#### Scénario 2: Synchronisation depuis Supabase

Si Supabase contient un utilisateur avec `role = 'super_admin'`, la synchronisation (pull) va tenter d'insérer/mettre à jour dans SQLite et échouer.

#### Scénario 3: Migration ou seed data

Si un script d'initialisation tente de créer un super_admin dans `users`, ça échoue.

## Rôles autorisés par table

### Table `users`
```
owner, admin, manager, cashier, waiter, staff
```
**Manque:** `super_admin`, `platform_admin`, `platform_support`, `support_admin`, `finance_admin`, `ops_admin`

### Table `tenant_users`
```
owner, admin, manager, cashier, waiter, staff, super_admin
```
**Manque:** `platform_admin`, `platform_support`, `support_admin`, `finance_admin`, `ops_admin`

## Impact

### Tables concernées par l'erreur

1. **`users`** - Contrainte trop restrictive
2. **`tenant_users`** - Contrainte OK pour `super_admin` mais manque d'autres rôles plateforme

### Opérations affectées

- ❌ INSERT d'utilisateur avec rôle `super_admin` dans `users`
- ❌ INSERT d'utilisateur avec rôle `platform_*` dans `users`
- ❌ Synchronisation depuis Supabase vers SQLite
- ❌ Migration de données
- ❌ Seed de données initiales

## Recommandations

### Option 1: Élargir la contrainte CHECK sur `users` (RECOMMANDÉ)

```sql
-- Ajouter les rôles plateforme à la contrainte users
ALTER TABLE users ADD COLUMN new_role TEXT;

UPDATE users SET new_role = role;

-- Recréer la table avec la nouvelle contrainte
CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ...
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN (
        'owner','admin','manager','cashier','waiter','staff',
        'super_admin','platform_admin','platform_support',
        'support_admin','finance_admin','ops_admin'
    )),
    ...
);

INSERT INTO users_new SELECT * FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
```

### Option 2: Supprimer la contrainte CHECK

```sql
-- Supprimer complètement la contrainte (moins sécurisé)
-- Recréer la table sans contrainte CHECK sur role
```

### Option 3: Créer une vue de compatibilité

```sql
-- Garder la contrainte mais créer un mapping
-- super_admin → owner (dans users)
-- platform_* → admin (dans users)
```

## Script de diagnostic

**Fichier:** `scripts/diagnostic_role_constraint.sql`

Ce script permet de:
1. Lister les tables avec contraintes CHECK sur role
2. Afficher tous les rôles distincts dans `users`
3. Afficher tous les rôles distincts dans `tenant_users`
4. Identifier les rôles problématiques
5. Rechercher les rôles spéciaux (super_admin, platform_*, etc.)
6. Afficher les contraintes actives
7. Produire un rapport de synthèse

## Comment exécuter le diagnostic

```bash
# Exécuter le script de diagnostic
sqlite3 data/database.db < scripts/diagnostic_role_constraint.sql

# Ou vérifier manuellement
sqlite3 data/database.db "SELECT DISTINCT role FROM users;"
sqlite3 data/database.db "SELECT DISTINCT role FROM tenant_users;"
sqlite3 data/database.db "SELECT * FROM users WHERE role NOT IN ('owner','admin','manager','cashier','waiter','staff');"
```

## Conclusion

**Le problème est clairement identifié:**

La table `users` a une contrainte CHECK qui n'inclut pas les rôles `super_admin` et `platform_*` utilisés par le code backend pour la gestion de la plateforme.

**Solution recommandée:** Élargir la contrainte CHECK sur `users` pour inclure tous les rôles utilisés dans le code.

**Rôles à ajouter à `users`:**
- `super_admin`
- `platform_admin`
- `platform_support`
- `support_admin`
- `finance_admin`
- `ops_admin`