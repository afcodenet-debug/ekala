# AUDIT ARCHITECTURAL: UTILISATEURS PLATE-FORME

## Mission

Vérifier si les rôles plateforme (`super_admin`, `platform_admin`, `platform_support`, etc.) doivent être stockés dans la table `users` ou dans une table dédiée.

## Tables contenant des utilisateurs

### 1. Table `users` (SQLite locale)

**Fichier:** `backend/migrations/012_saas_multitenant_schema.sql` (ligne 107)

```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    full_name VARCHAR(255),
    pin_code VARCHAR(10),
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff')),
    is_active INTEGER NOT NULL DEFAULT 1,
    password_hash TEXT NOT NULL,
    tenant_id INTEGER,
    phone VARCHAR(20),
    has_setup_pin INTEGER DEFAULT 0,
    remote_id INTEGER,
    business_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Colonnes ajoutées par migration 036:**
```sql
ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0;
```

**Colonnes ajoutées par migration 038:**
```sql
ALTER TABLE users ADD COLUMN is_platform_user BOOLEAN DEFAULT FALSE;
```

**Rôle fonctionnel:** Utilisateurs du système (tenants + plateforme)

**Contraintes:**
- `role` CHECK: `('owner','admin','manager','cashier','waiter','staff')`
- `email` UNIQUE
- `username` UNIQUE

**Source de synchronisation:** 
- ✅ Synchronisée avec Supabase (`remoteTable: 'users'`)
- ✅ `hasTenantId: true` dans entity-registry
- ✅ Ordre de sync: 5

### 2. Table `tenant_users` (SQLite locale)

**Fichier:** `backend/migrations/036_super_admin_roles.sql` (ligne 45)

```sql
CREATE TABLE IF NOT EXISTS tenant_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff','super_admin')),
    is_default INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    invited_at TEXT,
    joined_at TEXT,
    remote_id INTEGER,
    business_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, user_id)
);
```

**Rôle fonctionnel:** Association utilisateur ↔ tenant avec rôle spécifique

**Contraintes:**
- `role` CHECK: `('owner','admin','manager','cashier','waiter','staff','super_admin')`
- `UNIQUE(tenant_id, user_id)`

**Source de synchronisation:**
- ✅ Synchronisée avec Supabase (`remoteTable: 'tenant_users'`)
- ✅ `hasTenantId: false` dans entity-registry (ligne 73)
- ✅ Ordre de sync: 8

### 3. Table `platform_admins` (SQLite locale)

**Fichier:** `backend/migrations/036_super_admin_roles.sql` (ligne 22)

```sql
CREATE TABLE IF NOT EXISTS platform_admins (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    permissions TEXT DEFAULT '["*"]', -- JSON array: ["*"] = tous les droits
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by INTEGER REFERENCES users(id),
    notes TEXT
);
```

**Rôle fonctionnel:** Stockage des permissions spécifiques des admins plateforme

**Contraintes:**
- Aucune contrainte CHECK sur role
- `user_id` PRIMARY KEY (référence vers `users`)

**Source de synchronisation:**
- ❌ **PAS synchronisée** avec Supabase
- ❌ Absente de `entity-registry.ts`
- ❌ Pas d'`hasTenantId` défini

### 4. Table `platform_users` (N'EXISTE PAS)

**Résultat de recherche:** Aucune table `platform_users` trouvée dans les migrations SQL.

## Où est créé le super admin ?

**Fichier:** `src/server/platform/platform-bootstrap.ts`

**Fonction:** `bootstrapPlatform()` (ligne 16)

**Code clé (ligne 119):**
```typescript
add('role', 'owner');  // ❌ Utilise 'owner', PAS 'super_admin'
add('is_platform_user', 1);
add('tenant_id', null);
```

**Analyse:**
- Le super admin est créé avec `role = 'owner'` (pas `super_admin`)
- Le caractère "plateforme" est identifié via `is_platform_user = 1`
- `tenant_id = null` (pas de tenant associé)
- Stocké dans la table `users`

**Conséquence:**
- Le super admin passe la contrainte CHECK car `'owner'` est autorisé
- Mais le code backend s'attend à `role = 'super_admin'` (voir middleware)

## Flux de synchronisation

### Flux complet pour un utilisateur plateforme

```
Supabase (users table)
    ↓
pullByEntity('user', tenantId)
    ↓
GenericSyncService.pullByEntity()
    ↓
Requête Supabase: .from('users').select('*').eq('tenant_id', tenantId)
    ↓
Résultat: { id: 1, email: 'admin@ekala.africa', role: 'super_admin', ... }
    ↓
buildPullFields() → { role: 'super_admin', ... }
    ↓
applyPullRow() → INSERT/UPDATE dans SQLite users
    ↓
SQLite: CHECK constraint failed ❌
```

### Code responsable

**Fichier:** `src/sync/core/generic-sync.service.ts` (ligne ~700)

```typescript
async pullByEntity(entity: string, tenantId: string): Promise<number> {
  const def = getEntityDef(entity);
  
  // ...
  
  let query = this.supabase.from(remoteTable).select('*');

  if (entity === 'tenant') {
    query = query.gt('updated_at', since).order('updated_at', { ascending: true });
  } else {
    // ❌ PROBLÈME: Filtre par tenant_id pour TOUTES les entités sauf 'tenant'
    query = query.eq('tenant_id', tenantIdForQuery);  // Ligne 722
    
    if (hasUpdatedAt) {
      query = query.gt('updated_at', since).order('updated_at', { ascending: true });
    } else {
      query = query.gt('created_at', since).order('created_at', { ascending: true });
    }
  }
}
```

**Problème identifié:**
1. Le pull récupère tous les utilisateurs avec `tenant_id = X`
2. Si Supabase contient un `super_admin` (qui n'a pas de tenant_id ou a `tenant_id = null`), il n'est pas récupéré
3. Si Supabase contient un utilisateur plateforme avec `tenant_id = 0` ou autre valeur, il est récupéré
4. L'utilisateur est inséré dans SQLite avec `role = 'super_admin'`
5. La contrainte CHECK échoue

## Réponses aux questions

### QUESTION A: Les rôles plateforme doivent-ils être stockés dans `users` ?

**RÉPONSE: OUI, MAIS AVEC DES RÔLES VALIDES**

**Preuves:**
1. **platform-bootstrap.ts ligne 119:** `add('role', 'owner')` → Le super admin est stocké dans `users`
2. **entity-registry.ts ligne 55-63:** L'entité `user` est synchronisée avec la table `users`
3. **super-admin.middleware.ts:** Vérifie `user.role === 'super_admin'` dans la table `users`
4. **platform-auth.service.ts ligne 14:** `const platformRoles = ['super_admin', ...]` → Ces rôles sont attendus dans `users`

**Conclusion:** Oui, les utilisateurs plateforme DOIVENT être dans `users`, mais leur `role` doit être autorisé par la contrainte CHECK.

### QUESTION B: Les rôles plateforme doivent-ils être stockés dans `tenant_users` ?

**RÉPONSE: NON, SAUF CAS SPÉCIFIQUE**

**Preuves:**
1. **tenant_users** est une table d'association `user ↔ tenant`
2. **tenant_users** a `hasTenantId: false` (ligne 73 entity-registry)
3. **tenant_users** a déjà `super_admin` dans sa contrainte CHECK (ligne 45 migration 036)
4. **platform-bootstrap.ts:** Le super admin a `tenant_id = null` → pas de ligne dans `tenant_users`

**Exception:** Si un utilisateur plateforme doit être assigné à un tenant spécifique, alors oui, il peut avoir une ligne dans `tenant_users` avec `role = 'super_admin'`.

**Conclusion:** Non, les rôles plateforme ne sont PAS stockés dans `tenant_users` par défaut. Ils sont dans `users` avec `tenant_id = null`.

### QUESTION C: Existe-t-il une table dédiée qui devrait recevoir ces utilisateurs ?

**RÉPONSE: OUI, `platform_admins` EXISTE MAIS N'EST PAS UTILISÉE**

**Preuves:**
1. **Migration 036 (ligne 22-28):** Crée la table `platform_admins`
   ```sql
   CREATE TABLE IF NOT EXISTS platform_admins (
       user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
       permissions TEXT DEFAULT '["*"]',
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       created_by INTEGER REFERENCES users(id),
       notes TEXT
   );
   ```

2. **platform-bootstrap.ts:** N'insère PAS dans `platform_admins`

3. **entity-registry.ts:** `platform_admins` n'est PAS dans la liste des entités synchronisées

4. **Usage dans le code:** Aucune référence à `platform_admins` trouvée dans le code backend

**Conclusion:** La table `platform_admins` existe mais n'est jamais utilisée. Elle pourrait servir à stocker les permissions des admins plateforme, mais actuellement :
- Les utilisateurs plateforme sont dans `users`
- Leurs permissions sont gérées par `is_platform_user` et `is_super_admin`
- `platform_admins` est une table morte

### QUESTION D: Le vrai bug est-il une contrainte trop restrictive OU une synchronisation vers la mauvaise table ?

**RÉPONSE: LES DEUX, MAIS LA CAUSE RACINE EST LA CONTRAINTE TROP RESTRICTIVE**

**Analyse:**

#### Bug #1: Contrainte trop restrictive (CAUSE RACINE)

**Fichier:** `backend/migrations/012_saas_multitenant_schema.sql` (ligne 107)

```sql
role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff'))
```

**Problème:** N'inclut pas `super_admin`, `platform_admin`, `platform_support`, etc.

**Impact:** 
- ❌ Impossible d'insérer un utilisateur avec `role = 'super_admin'` dans `users`
- ❌ La synchronisation depuis Supabase échoue si Supabase a un `super_admin`

#### Bug #2: Incohérence entre bootstrap et middleware

**Fichier:** `src/server/platform/platform-bootstrap.ts` (ligne 119)

```typescript
add('role', 'owner');  // Bootstrap utilise 'owner'
```

**Fichier:** `src/server/middleware/super-admin.middleware.ts` (ligne 12)

```typescript
if (user.role !== 'super_admin' && user.role !== 'owner')  // Middleware attend 'super_admin'
```

**Problème:** 
- Bootstrap crée un user avec `role = 'owner'`
- Middleware vérifie `role === 'super_admin'`
- Le super admin créé par bootstrap ne sera jamais reconnu comme `super_admin` par le middleware

#### Bug #3: Synchronisation vers la bonne table mais avec mauvais rôle

**Fichier:** `src/sync/core/entity-registry.ts` (ligne 55-63)

```typescript
{
  entity: 'user',
  localTable: 'users',      // ✅ Correct
  remoteTable: 'users',     // ✅ Correct
  hasTenantId: true,        // ✅ Correct
  // ...
}
```

**Analyse:**
- ✅ La synchronisation va bien vers `users` (pas vers `tenant_users`)
- ✅ `hasTenantId: true` est correct pour `users`
- ❌ Mais si Supabase a un `super_admin`, la contrainte CHECK échoue

**Conclusion:**

| Bug | Gravité | Cause racine |
|-----|---------|--------------|
| Contrainte CHECK trop restrictive | 🔴 CRITIQUE | Migration 012 |
| Incohérence bootstrap/middleware | 🟡 MOYENNE | platform-bootstrap.ts |
| Sync vers la bonne table | ✅ OK | Pas un bug |

**Le vrai bug est la contrainte trop restrictive dans `users`.**

La synchronisation va vers la bonne table (`users`), mais cette table n'accepte pas les rôles plateforme.

## Architecture cible

### Option 1: Élargir la contrainte CHECK (RECOMMANDÉ)

**Modification:** `backend/migrations/012_saas_multitenant_schema.sql`

```sql
-- AVANT
role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff'))

-- APRÈS
role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN (
    'owner','admin','manager','cashier','waiter','staff',
    'super_admin','platform_admin','platform_support',
    'support_admin','finance_admin','ops_admin'
))
```

**Avantages:**
- ✅ Respecte l'architecture existante
- ✅ Pas de modification de schéma lourd
- ✅ Les utilisateurs plateforme restent dans `users`
- ✅ Cohérent avec `tenant_users` qui accepte déjà `super_admin`

**Inconvénients:**
- ⚠️ Nécessite de recréer la table `users` (SQLite ne supporte pas DROP CONSTRAINT)

### Option 2: Créer une table `platform_users` dédiée

**Nouvelle table:**
```sql
CREATE TABLE IF NOT EXISTS platform_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    full_name VARCHAR(255),
    role TEXT NOT NULL CHECK (role IN ('super_admin','platform_admin','platform_support','support_admin','finance_admin','ops_admin')),
    permissions TEXT DEFAULT '["*"]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Avantages:**
- ✅ Isolation complète des utilisateurs plateforme
- ✅ Pas de conflit avec les contraintes existantes

**Inconvénients:**
- ❌ Nécessite de modifier tout le code d'authentification
- ❌ Nécessite une nouvelle entité de synchronisation
- ❌ Double les tables d'utilisateurs
- ❌ Complexifie les jointures (ex: `actor_id` dans `voucher_audit_logs`)

### Option 3: Utiliser `platform_admins` (EXISTANT)

**Modification:** Utiliser la table existante `platform_admins`

**Avantages:**
- ✅ Table déjà créée
- ✅ Pas de nouvelle migration

**Inconvénients:**
- ❌ `platform_admins` n'a pas de colonne `role`
- ❌ Nécessite de modifier tout le code d'authentification
- ❌ Pas de synchronisation prévue

## Recommandation finale

**OPTION 1: Élargir la contrainte CHECK sur `users`**

**Raison:**
1. L'architecture actuelle prévoit que les utilisateurs plateforme sont dans `users` (preuve: `platform-bootstrap.ts`)
2. La table `tenant_users` accepte déjà `super_admin` (cohérence)
3. La table `platform_admins` existe mais n'est pas utilisée (preuve qu'elle n'était pas la solution retenue)
4. Moins de changements que de créer une nouvelle table

**Actions requises:**
1. Recréer la table `users` avec la contrainte élargie
2. Corriger `platform-bootstrap.ts` pour utiliser `role = 'super_admin'` au lieu de `'owner'`
3. Vérifier que Supabase a la même contrainte

## Preuves supplémentaires

### Preuve 1: Le super admin est dans `users`

**Fichier:** `src/server/platform/platform-bootstrap.ts` (ligne 130-132)
```typescript
const result = db.prepare(
  `INSERT INTO users (${insertColumns.join(', ')}) VALUES (${placeholders})`
).run(...insertValues);
```

### Preuve 2: Le middleware cherche `super_admin` dans `users`

**Fichier:** `src/server/middleware/super-admin.middleware.ts` (ligne 12)
```typescript
if (user.role !== 'super_admin' && user.role !== 'owner') {
```

### Preuve 3: `tenant_users` accepte déjà `super_admin`

**Fichier:** `backend/migrations/036_super_admin_roles.sql` (ligne 45)
```sql
role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff','super_admin'))
```

### Preuve 4: `platform_admins` n'est jamais utilisée

**Recherche:** Aucune référence à `platform_admins` dans le code TypeScript.

## Conclusion

**Réponses synthétiques:**

**A) Les rôles plateforme doivent-ils être stockés dans `users` ?**
→ OUI. L'architecture actuelle le prévoit (bootstrap, middleware, sync).

**B) Les rôles plateforme doivent-ils être stockés dans `tenant_users` ?**
→ NON (sauf cas exceptionnel d'assignation à un tenant). Le super admin a `tenant_id = null`.

**C) Existe-t-il une table dédiée ?**
→ OUI, `platform_admins` existe mais n'est PAS utilisée. Elle n'est pas la solution retenue par l'architecture.

**D) Le vrai bug est-il une contrainte trop restrictive ou une synchronisation vers la mauvaise table ?**
→ **Contrainte trop restrictive.** La synchronisation va vers la bonne table (`users`), mais cette table n'accepte pas les rôles plateforme.

**Cause racine:** La contrainte CHECK sur `users.role` n'inclut pas `super_admin` et les rôles `platform_*`, alors que :
1. Le code backend utilise ces rôles
2. La table `tenant_users` les accepte déjà
3. L'architecture prévoit de stocker les utilisateurs plateforme dans `users`