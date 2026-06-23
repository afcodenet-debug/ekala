# AUDIT ARCHITECTURAL FINAL: SOURCE DE VÉRITÉ DES RÔLES PLATE-FORME

## Mission

Déterminer l'architecture cible réelle pour les rôles plateforme :
- `super_admin`
- `support_admin`
- `finance_admin`
- `ops_admin`

---

## 1. AUDIT DES TABLES PLATE-FORME

### 1.1 Table `users` (SQLite)

**Fichier:** `backend/migrations/012_saas_multitenant_schema.sql` (ligne 107)

**Statut:** ✅ **UTILISÉE - SOURCE DE VÉRITÉ**

**Preuves d'utilisation:**

| Fichier | Ligne | Code | Usage |
|---------|-------|------|-------|
| `platform-bootstrap.ts` | 130 | `INSERT INTO users (...)` | Création super admin |
| `platform-auth.service.ts` | 94-99 | `SELECT FROM users WHERE is_platform_user = 1` | Login plateforme |
| `platform-auth.service.ts` | 186-193 | `SELECT FROM users WHERE is_platform_user = 1` | Liste users plateforme |
| `platform-auth.service.ts` | 214-216 | `INSERT INTO users (...)` | Création user plateforme |
| `super-admin.middleware.ts` | 12 | `user.role !== 'super_admin'` | Vérification rôle |
| `entity-registry.ts` | 55-63 | `localTable: 'users'` | Synchronisation |

**Colonnes pertinentes:**
- `role` → Stocke le rôle (owner/admin/super_admin/etc.)
- `is_platform_user` → Identifie les admins plateforme (migration 038)
- `is_super_admin` → Identifie les super admins (migration 036)
- `tenant_id` → NULL pour les admins plateforme

**Contrainte CHECK:**
```sql
role TEXT NOT NULL DEFAULT 'staff' 
CHECK (role IN ('owner','admin','manager','cashier','waiter','staff'))
```
**Statut:** ❌ TROP RESTRICTIVE (bloque les rôles plateforme)

---

### 1.2 Table `platform_admins` (SQLite)

**Fichier:** `backend/migrations/036_super_admin_roles.sql` (ligne 22-28)

**Statut:** ❌ **MORTE - JAMAIS UTILISÉE**

**Preuves:**

| Recherche | Résultat |
|-----------|----------|
| `grep -r "platform_admins" src/` | 0 résultats |
| Référence dans entity-registry.ts | ❌ NON |
| Référence dans platform-auth.service.ts | ❌ NON |
| Référence dans platform-bootstrap.ts | ❌ NON |

**Schéma:**
```sql
CREATE TABLE IF NOT EXISTS platform_admins (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    permissions TEXT DEFAULT '["*"]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by INTEGER REFERENCES users(id),
    notes TEXT
);
```

**Conclusion:** Table créée par précaution mais jamais adoptée par le code.

---

### 1.3 Table `platform_roles` (SQLite)

**Fichier:** `backend/migrations/037_add_platform_roles.sql` (ligne 13-22)

**Statut:** ✅ **UTILISÉE - RÉFÉRENTIEL DES RÔLES**

**Preuves d'utilisation:**

| Fichier | Ligne | Code | Usage |
|---------|-------|------|-------|
| `platform-auth.service.ts` | 162-168 | `JOIN platform_roles pr ON prp.role_id = pr.id` | Récupération permissions |

**Schéma:**
```sql
CREATE TABLE IF NOT EXISTS platform_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  permissions TEXT, -- JSON array
  is_system_role BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**Données:**
- `super_admin` → `["*"]`
- `support_admin` → `["tenants:read", "tenants:view", ...]`
- `finance_admin` → `["subscriptions:read", ...]`
- `ops_admin` → `["tenants:write", ...]`

**Rôle fonctionnel:** Stocke les métadonnées des rôles (nom, description, permissions par défaut)

**Conclusion:** Table de référence pour l'UI et la documentation, mais le code utilise directement `users.role`.

---

### 1.4 Table `platform_permissions` (SQLite)

**Fichier:** `backend/migrations/037_add_platform_roles.sql` (ligne 56-62)

**Statut:** ✅ **UTILISÉE - RÉFÉRENTIEL DES PERMISSIONS**

**Preuves d'utilisation:**

| Fichier | Ligne | Code | Usage |
|---------|-------|------|-------|
| `platform-auth.service.ts` | 162-168 | `JOIN platform_permissions p ON prp.permission_id = p.id` | Récupération permissions |

**Schéma:**
```sql
CREATE TABLE IF NOT EXISTS platform_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  permission_key TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Données:** 32 permissions (tenants, subscriptions, vouchers, finance, sync, monitoring, audit, settings, users)

**Rôle fonctionnel:** Catalogue des permissions disponibles

**Conclusion:** Table de référence pour les permissions granulaires.

---

### 1.5 Table `platform_role_permissions` (SQLite)

**Fichier:** `backend/migrations/037_add_platform_roles.sql` (ligne 114-122)

**Statut:** ✅ **UTILISÉE - MAPPING RÔLE → PERMISSIONS**

**Preuves d'utilisation:**

| Fichier | Ligne | Code | Usage |
|---------|-------|------|-------|
| `platform-auth.service.ts` | 162-168 | `FROM platform_role_permissions prp` | Récupération permissions |

**Schéma:**
```sql
CREATE TABLE IF NOT EXISTS platform_role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (role_id) REFERENCES platform_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES platform_permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);
```

**Données:**
- super_admin → toutes les permissions (32)
- support_admin → 6 permissions (lecture seule)
- finance_admin → 12 permissions (finances)
- ops_admin → 10 permissions (opérations)

**Rôle fonctionnel:** Table de liaison entre rôles et permissions

**Conclusion:** Table active utilisée par `getPermissions()`.

---

## 2. ANALYSE DU CODE

### 2.1 platform-auth.service.ts

**Fichier:** `src/server/platform/platform-auth.service.ts`

**Architecture détectée:**

```typescript
// Ligne 94-99: LOGIN
SELECT FROM users WHERE email = ? AND is_platform_user = 1

// Ligne 106-107: VÉRIFICATION RÔLE
const platformRoles = ['super_admin', 'support_admin', 'finance_admin', 'ops_admin'];
if (!platformRoles.includes(user.role) && user.role !== 'owner') return null;

// Ligne 157-172: RÉCUPÉRATION PERMISSIONS
SELECT p.permission_key
FROM platform_role_permissions prp
JOIN platform_roles pr ON prp.role_id = pr.id
JOIN platform_permissions p ON prp.permission_id = p.id
WHERE pr.role_name = ?

// Ligne 175-184: VÉRIFICATION PERMISSION
if (user.role === 'super_admin') return true;  // Super admin a toutes les permissions
const permissions = await this.getPermissions(user.role);
return permissions.includes(permission);

// Ligne 205-208: CRÉATION USER
const platformRoles = ['super_admin', 'support_admin', 'finance_admin', 'ops_admin'];
if (!platformRoles.includes(data.role)) {
  throw new Error(`Invalid platform role: ${data.role}`);
}

// Ligne 214-216: INSERT
INSERT INTO users (email, password_hash, full_name, role, is_platform_user, ...)
```

**Architecture effective:**
1. **Identité:** `users` (email, password_hash, role, is_platform_user)
2. **Rôle:** `users.role` (super_admin/support_admin/finance_admin/ops_admin)
3. **Permissions:** `platform_role_permissions` + `platform_permissions` (RBAC)

**Source de vérité du rôle:** `users.role`

---

### 2.2 super-admin.middleware.ts

**Fichier:** `src/server/middleware/super-admin.middleware.ts`

**Code:**
```typescript
// Ligne 12
if (user.role !== 'super_admin' && user.role !== 'owner') {
  return res.status(403).json({...});
}

// Ligne 24
if (user.role === 'owner') {
  req.isSuperAdmin = false;
}

// Ligne 35
if (user.is_super_admin && user.role === 'super_admin') {
  req.superAdmin = {...};
}
```

**Architecture effective:**
- Lit `user.role` depuis `users`
- Vérifie `role === 'super_admin'` ou `role === 'owner'`
- Pas de référence à `platform_roles` ou `platform_permissions`

**Source de vérité du rôle:** `users.role`

---

### 2.3 platform-auth.middleware.ts

**Fichier:** `src/server/platform/platform-auth.middleware.ts`

**Code:**
```typescript
// Ligne 12
if (payload.role === 'super_admin') {
  return next();
}
```

**Architecture effective:**
- Lit `payload.role` depuis le JWT
- Le JWT est créé par `signPlatformJwt()` qui lit `user.role` depuis `users`
- Pas de référence à `platform_roles`

**Source de vérité du rôle:** `users.role` (via JWT)

---

### 2.4 platform-bootstrap.ts

**Fichier:** `src/server/platform/platform-bootstrap.ts`

**Code:**
```typescript
// Ligne 119
add('role', 'owner');  // ❌ Devrait être 'super_admin'

// Ligne 130-132
INSERT INTO users (...)
```

**Architecture effective:**
- Crée le super admin dans `users`
- Utilise `role = 'owner'` (incohérent avec le reste du code)
- Pas de référence à `platform_roles`

**Source de vérité du rôle:** `users.role`

---

## 3. IDENTIFICATION DES TABLES

### Table 1: `users` (PRINCIPALE)

**Statut:** ✅ **SOURCE DE VÉRITÉ**

**Rôle:** Stocke tous les utilisateurs (tenants + plateforme)

**Colonnes clés:**
- `role` → Rôle de l'utilisateur
- `is_platform_user` → Identifie les admins plateforme
- `is_super_admin` → Identifie les super admins
- `tenant_id` → NULL pour les admins plateforme

**Utilisation:**
- Authentification (login)
- Autorisation (middlewares)
- Synchronisation (entity-registry)
- Audit (actor_id dans les logs)

---

### Table 2: `platform_roles` (RÉFÉRENTIEL)

**Statut:** ✅ **UTILISÉE - RÉFÉRENTIEL**

**Rôle:** Stocke les métadonnées des rôles plateforme

**Utilisation:**
- `platform-auth.service.ts:162-168` → Récupération des permissions
- UI pour afficher les rôles disponibles
- Documentation des rôles

**Source de vérité:** Non, c'est un référentiel. Le code utilise `users.role`.

---

### Table 3: `platform_permissions` (RÉFÉRENTIEL)

**Statut:** ✅ **UTILISÉE - RÉFÉRENTIEL**

**Rôle:** Catalogue des permissions disponibles

**Utilisation:**
- `platform-auth.service.ts:162-168` → Récupération des permissions
- UI pour afficher les permissions
- Documentation

**Source de vérité:** Non, c'est un catalogue.

---

### Table 4: `platform_role_permissions` (MAPPING)

**Statut:** ✅ **UTILISÉE - MAPPING**

**Rôle:** Table de liaison rôle → permissions

**Utilisation:**
- `platform-auth.service.ts:162-168` → Récupération des permissions d'un rôle
- RBAC (Role-Based Access Control)

**Source de vérité:** Non, c'est un mapping.

---

### Table 5: `platform_admins` (MORTE)

**Statut:** ❌ **MORTE - JAMAIS UTILISÉE**

**Rôle:** Prévue pour stocker les permissions des admins plateforme

**Utilisation:** Aucune (0 références dans le code)

**Conclusion:** Table créée par précaution mais jamais adoptée.

---

## 4. RÉPONSES AUX QUESTIONS

### QUESTION 1: Les rôles plateforme doivent-ils vivre dans `users.role` ?

# ✅ OUI - DÉFINITIVEMENT

**Preuves:**

1. **Architecture actuelle**
   - `platform-auth.service.ts:214` → `INSERT INTO users (..., role, ...)`
   - `platform-bootstrap.ts:130` → `INSERT INTO users (...)`
   - Tous les services lisent `users.role`

2. **Source de vérité effective**
   - Le JWT contient `role` lu depuis `users.role`
   - Les middlewares vérifient `user.role` depuis `users`
   - La synchronisation sync `users.role`

3. **Pas d'alternative**
   - `platform_roles` est un référentiel, pas une source de vérité
   - `platform_admins` est morte
   - Aucune table dédiée aux rôles plateforme n'est utilisée comme source

**Conclusion:** `users.role` EST la source de vérité des rôles plateforme.

---

### QUESTION 2: Les rôles plateforme doivent-ils vivre dans `platform_admins` ?

# ❌ NON - DÉFINITIVEMENT

**Preuves:**

1. **Table morte**
   - 0 références dans le code TypeScript
   - Pas dans `entity-registry.ts`
   - Pas de synchronisation
   - Jamais utilisée depuis sa création (migration 036)

2. **Architecture actuelle**
   - `platform-auth.service.ts` insère dans `users`, pas dans `platform_admins`
   - `platform-bootstrap.ts` insère dans `users`, pas dans `platform_admins`

3. **Double stockage**
   - `users` contient déjà email, password_hash, role
   - `platform_admins` contient seulement permissions
   - Redondance inutile

**Conclusion:** `platform_admins` ne doit PAS stocker les rôles. C'est une table morte.

---

### QUESTION 3: `platform_roles` et `platform_permissions` sont-ils prévus pour remplacer `users.role` ?

# ❌ NON - CE SONT DES RÉFÉRENTIELS, PAS DES SOURCES DE VÉRITÉ

**Preuves:**

1. **`platform_roles` est un référentiel**
   - Stocke les métadonnées des rôles (display_name, description, permissions par défaut)
   - Utilisé UNIQUEMENT pour récupérer les permissions via JOIN
   - Le code vérifie `users.role`, pas `platform_roles.role_name`

2. **`platform_permissions` est un catalogue**
   - Liste toutes les permissions disponibles
   - Utilisé UNIQUEMENT pour valider les permissions
   - Ne stocke pas les rôles

3. **`platform_role_permissions` est un mapping**
   - Table de liaison rôle → permissions
   - Utilisé pour le RBAC
   - Ne stocke pas les rôles eux-mêmes

4. **Le flux réel**
   ```
   users.role = 'super_admin'
       ↓
   platform-auth.service.ts:162
       ↓
   SELECT FROM platform_role_permissions WHERE role_id = (SELECT id FROM platform_roles WHERE role_name = 'super_admin')
       ↓
   Récupère les permissions
   ```

**Conclusion:** `platform_roles` et `platform_permissions` sont des tables de référence pour les permissions, pas des sources de vérité pour les rôles. La source de vérité reste `users.role`.

---

### QUESTION 4: Architecture cible - A ou B ?

# ✅ ARCHITECTURE A: Simple Role Field

## Architecture A: Simple Role Field

```
users
├── role = 'super_admin' | 'support_admin' | 'finance_admin' | 'ops_admin'
├── is_platform_user = 1 (pour les admins plateforme)
└── is_super_admin = 1 (pour les super admins)

platform_roles (référentiel)
└── Stocke les métadonnées (display_name, description, permissions par défaut)

platform_permissions (catalogue)
└── Liste des permissions disponibles

platform_role_permissions (mapping)
└── Lie les rôles aux permissions pour le RBAC
```

**Caractéristiques:**
- ✅ `users.role` = source de vérité
- ✅ `is_platform_user` = identifie les admins plateforme
- ✅ RBAC via `platform_role_permissions`
- ✅ Simple et efficace

---

## Architecture B: RBAC Plateforme (REJETÉE)

```
users
└── role = 'owner' | 'admin' | 'manager' | ... (rôles métier uniquement)

platform_admins
├── user_id (FK vers users)
└── permissions (JSON)

platform_roles
└── Métadonnées des rôles plateforme

platform_permissions
└── Catalogue des permissions

platform_role_permissions
└── Mapping rôle → permissions
```

**Caractéristiques:**
- ❌ Double stockage (users + platform_admins)
- ❌ Authentification fragmentée
- ❌ Refactoring massif nécessaire
- ❌ Foreign keys complexes
- ❌ `platform_admins` est morte

**Pourquoi rejetée:**
- L'architecture actuelle utilise `users.role`
- `platform_admins` n'est jamais utilisée
- Tous les middlewares lisent `users.role`
- La synchronisation sync `users.role`

---

## 5. RECOMMANDATION FINALE

### Architecture actuelle

**Source de vérité:** `users.role`

**Tables utilisées:**
- ✅ `users` - Stocke les utilisateurs et leurs rôles
- ✅ `platform_roles` - Référentiel des rôles (métadonnées)
- ✅ `platform_permissions` - Catalogue des permissions
- ✅ `platform_role_permissions` - Mapping RBAC
- ❌ `platform_admins` - Morte, jamais utilisée

**Flux:**
```
1. Authentification: users.role
2. Autorisation: users.role + platform_role_permissions
3. Synchronisation: users.role
4. Audit: users.role (via actor_id)
```

---

### Architecture prévue

**D'après les migrations et le code:**

L'architecture prévue est **AUSSI** `users.role` comme source de vérité.

**Preuves:**
1. Migration 037 crée `platform_roles/permissions/role_permissions` pour le RBAC
2. Migration 036 ajoute `is_platform_user` et `is_super_admin` à `users`
3. Migration 038 ajoute `is_platform_user` à `users`
4. Le code utilise `users.role` partout
5. `platform-auth.service.ts` fait du RBAC avec `platform_role_permissions`

**Architecture prévue:**
```
users.role = source de vérité
platform_roles/permissions/role_permissions = RBAC
```

---

### Architecture recommandée

# ✅ ARCHITECTURE A: Simple Role Field + RBAC

**Principe:**
- `users.role` = source de vérité du rôle
- `platform_roles` = référentiel (métadonnées, UI)
- `platform_permissions` = catalogue des permissions
- `platform_role_permissions` = mapping RBAC

**Corrections à apporter:**

1. **Migration SQLite** (041_fix_users_role_constraint.sql)
   - Élargir la contrainte CHECK sur `users.role`
   - Ajouter: `super_admin`, `platform_admin`, `platform_support`, `support_admin`, `finance_admin`, `ops_admin`

2. **Correctif platform-bootstrap.ts** (ligne 119)
   - Changer `role = 'owner'` en `role = 'super_admin'`

3. **Aucune autre modification**
   - Le code est déjà correct
   - La synchronisation est déjà correcte
   - Les middlewares sont déjà corrects

**Résultat:**
- ✅ `users.role` accepte tous les rôles plateforme
- ✅ RBAC fonctionnel via `platform_role_permissions`
- ✅ Synchronisation fonctionnelle
- ✅ Authentification fonctionnelle
- ✅ Architecture simple et maintenable

---

## 6. TABLEAU RÉCAPITULATIF

| Table | Statut | Rôle | Source de vérité |
|-------|--------|------|------------------|
| `users` | ✅ UTILISÉE | Stockage identité + rôle | **OUI** |
| `platform_roles` | ✅ UTILISÉE | Référentiel rôles | NON |
| `platform_permissions` | ✅ UTILISÉE | Catalogue permissions | NON |
| `platform_role_permissions` | ✅ UTILISÉE | Mapping RBAC | NON |
| `platform_admins` | ❌ MORTE | Jamais utilisée | NON |

---

## 7. FLUX COMPLET

### Authentification

```
1. User login: platform-auth.service.ts:login()
   ↓
2. SELECT FROM users WHERE email = ? AND is_platform_user = 1
   ↓
3. Vérification password_hash
   ↓
4. Vérification role dans ['super_admin', 'support_admin', 'finance_admin', 'ops_admin', 'owner']
   ↓
5. Création JWT avec { role: user.role, is_platform_user: true }
   ↓
6. Retour token + user
```

### Autorisation (RBAC)

```
1. Middleware: super-admin.middleware.ts
   ↓
2. Vérification user.role === 'super_admin' || user.role === 'owner'
   ↓
3. Si super_admin → accès total
   ↓
4. Sinon → platform-auth.service.ts:hasPermission()
   ↓
5. Récupération permissions depuis platform_role_permissions
   ↓
6. Vérification permission demandée
```

### Synchronisation

```
1. GenericSyncService.pullByEntity('user', tenantId)
   ↓
2. SELECT FROM users WHERE tenant_id = ?
   ↓
3. Les admins plateforme ont tenant_id = NULL → pas récupérés
   ↓
4. Si Supabase a un super_admin avec tenant_id = NULL → pas synchronisé
   ↓
5. C'est le comportement attendu (isolation plateforme)
```

---

## 8. CONCLUSION

### Réponses synthétiques

**Q1: Les rôles plateforme doivent-ils vivre dans `users.role` ?**
→ **OUI, DÉFINITIVEMENT.** C'est la source de vérité effective aujourd'hui.

**Q2: Les rôles plateforme doivent-ils vivre dans `platform_admins` ?**
→ **NON, DÉFINITIVEMENT.** Cette table est morte, jamais utilisée.

**Q3: `platform_roles` et `platform_permissions` remplacent-ils `users.role` ?**
→ **NON.** Ce sont des référentiels pour le RBAC, pas des sources de vérité.

**Q4: Architecture cible - A ou B ?**
→ **ARCHITECTURE A: Simple Role Field**
- `users.role` = source de vérité
- `platform_roles/permissions/role_permissions` = RBAC
- Simple, efficace, déjà implémenté

---

### Architecture cible confirmée

```
┌─────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE CIBLE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  users.role = SOURCE DE VÉRITÉ                             │
│  ├── 'owner' (tenant owner)                                │
│  ├── 'admin' (tenant admin)                                │
│  ├── 'manager' (tenant manager)                            │
│  ├── 'cashier' (tenant cashier)                            │
│  ├── 'waiter' (tenant waiter)                              │
│  ├── 'staff' (tenant staff)                                │
│  ├── 'super_admin' (plateforme)                            │
│  ├── 'support_admin' (plateforme)                          │
│  ├── 'finance_admin' (plateforme)                          │
│  └── 'ops_admin' (plateforme)                              │
│                                                             │
│  platform_roles = RÉFÉRENTIEL (métadonnées, UI)            │
│  platform_permissions = CATALOGUE (permissions disponibles) │
│  platform_role_permissions = MAPPING RBAC                   │
│                                                             │
│  is_platform_user = identifie les admins plateforme        │
│  is_super_admin = identifie les super admins               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Correction requise

**UNIQUEMENT 2 modifications:**

1. **Migration SQL** → Élargir contrainte CHECK sur `users.role`
2. **Code** → Corriger `platform-bootstrap.ts` ligne 119: `role = 'super_admin'`

**Tout le reste est déjà correct.**