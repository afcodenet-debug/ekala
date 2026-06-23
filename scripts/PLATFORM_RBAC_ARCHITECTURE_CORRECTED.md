# ARCHITECTURE RBAC PLATE-FORME CORRIGÉE

## Mission

Corriger le modèle RBAC plateforme pour une architecture propre, scalable et inspirée de Stripe/AWS IAM.

**Corrections apportées:**
1. ✅ `platform_roles` = source de vérité des rôles
2. ✅ `platform_role_permissions` = seule source des permissions
3. ✅ `platform_admins` = table d'assignation UNIQUEMENT (user ↔ role)
4. ✅ Suppression du cache permissions dans `platform_admins`
5. ✅ Gestion du multi-contexte (tenant user + platform admin)

**Contraintes:**
- ❌ NE PAS proposer de migration SQL
- ❌ NE PAS modifier de code
- ✅ Architecture pure et correcte uniquement

---

## 1. PROBLÈMES DU DESIGN PRÉCÉDENT

### 1.1 Problème 1: `platform_admins` comme source de vérité

**❌ INCORRECT:**
```
platform_admins
├── user_id
├── role_name  ← Source de vérité (INCORRECT)
└── permissions (cache)  ← Redondant
```

**Pourquoi c'est incorrect:**
- `platform_admins` est une table d'assignation, pas de référence
- Le rôle existe dans `platform_roles`, pas dans `platform_admins`
- Cache inutile (dérive possible)
- Violation du principe de single source of truth

### 1.2 Problème 2: Mélange des responsabilités

**❌ INCORRECT:**
```
platform_admins
├── user_id (FK)
├── role_name (FK)  ← Référence au rôle
├── permissions (JSON)  ← Cache des permissions (REDONDANT)
└── ...
```

**Problème:**
- `platform_admins` stocke à la fois l'assignation ET les permissions
- Les permissions sont déjà dans `platform_role_permissions`
- Double source de vérité

### 1.3 Problème 3: Pas de gestion du multi-contexte

**❌ MANQUANT:**
- Un user peut être à la fois tenant user ET platform admin
- Comment savoir dans quel contexte il opère ?
- Comment gérer les JWT différents ?

---

## 2. ARCHITECTURE RBAC CORRIGÉE

### 2.1 Principe de base

**Inspiration:** Stripe IAM / AWS IAM

**Principe:**
```
Users (identité)
  ↓
Assignments (qui a quel rôle)
  ↓
Roles (définition des rôles)
  ↓
Permissions (permissions individuelles)
  ↓
Role-Permissions (mapping rôle → permissions)
```

**Source of truth:**
- `platform_roles` = source de vérité des rôles
- `platform_permissions` = source de vérité des permissions
- `platform_role_permissions` = source de vérité du mapping
- `platform_admins` = table d'assignation UNIQUEMENT

### 2.2 Schéma logique corrigé

#### Table `platform_roles` (SOURCE DE VÉRITÉ DES RÔLES)

```sql
CREATE TABLE IF NOT EXISTS platform_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_name TEXT UNIQUE NOT NULL,  -- 'super_admin', 'support_admin', etc.
  display_name TEXT NOT NULL,
  description TEXT,
  permissions TEXT,  -- JSON: permissions par défaut (référentiel)
  is_system_role BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**Rôle:** Source de vérité des rôles plateforme

**Contenu:**
- `super_admin` → `["*"]`
- `support_admin` → `["tenants:read", "tenants:view", ...]`
- `finance_admin` → `["subscriptions:read", ...]`
- `ops_admin` → `["tenants:write", ...]`

**Utilisation:**
- Référentiel pour créer/valider les rôles
- Métadonnées (display_name, description)
- Permissions par défaut (pour information)

---

#### Table `platform_permissions` (SOURCE DE VÉRITÉ DES PERMISSIONS)

```sql
CREATE TABLE IF NOT EXISTS platform_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  permission_key TEXT UNIQUE NOT NULL,  -- 'tenants:read', 'subscriptions:write', etc.
  description TEXT,
  category TEXT,  -- 'Tenants', 'Subscriptions', 'Vouchers', etc.
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Rôle:** Catalogue des permissions disponibles

**Contenu:** 32 permissions granulaires

**Utilisation:**
- Référentiel des permissions
- Validation des permissions
- Documentation

---

#### Table `platform_role_permissions` (SOURCE DE VÉRITÉ DU MAPPING)

```sql
CREATE TABLE IF NOT EXISTS platform_role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL REFERENCES platform_roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES platform_permissions(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(role_id, permission_id)
);
```

**Rôle:** Mapping rôle → permissions (RBAC)

**Contenu:**
- super_admin → 32 permissions (toutes)
- support_admin → 6 permissions (lecture)
- finance_admin → 12 permissions (finances)
- ops_admin → 10 permissions (opérations)

**Utilisation:**
- Vérification des permissions à l'exécution
- RBAC (Role-Based Access Control)

---

#### Table `platform_admins` (TABLE D'ASSIGNATION UNIQUEMENT)

```sql
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL REFERENCES platform_roles(role_name),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  notes TEXT
);
```

**Rôle:** Table d'assignation user ↔ rôle plateforme

**Responsabilité UNIQUE:** 
- Qui est platform admin ?
- Quel est son rôle ?

**INTERDICTION:**
- ❌ PAS de colonne `permissions` (cache)
- ❌ PAS de logique métier
- ❌ PAS de source de vérité

**Utilisation:**
- `PlatformAuthService.login()` → JOIN pour récupérer le rôle
- `PlatformAuthService.getPermissions()` → Utilise `role_name` pour requêter `platform_role_permissions`

---

## 3. SOURCE OF TRUTH PAR TABLE

| Donnée | Table | Source de vérité | Raison |
|--------|-------|-------------------|--------|
| **Identité** | `users` | ✅ OUI | email, password_hash, etc. |
| **Rôle métier** | `users.role` | ✅ OUI | owner, admin, manager, etc. |
| **Rôle plateforme** | `platform_roles.role_name` | ✅ OUI | Définition du rôle |
| **Assignation** | `platform_admins` | ❌ NON | Table de liaison user ↔ role |
| **Permissions** | `platform_permissions.permission_key` | ✅ OUI | Catalogue des permissions |
| **Mapping RBAC** | `platform_role_permissions` | ✅ OUI | Rôle → Permissions |

---

## 4. FLUX D'AUTORISATION RUNTIME

### 4.1 Principe: Single Source of Truth

**Règle d'or:**
```
Toujours dériver les permissions depuis platform_role_permissions
JAMAIS depuis un cache ou une table d'assignation
```

**Flux correct:**
```
1. User login
   ↓
2. Récupérer user depuis `users`
   ↓
3. Vérifier is_platform_user = 1
   ↓
4. JOIN platform_admins pour récupérer role_name
   ↓
5. Utiliser role_name pour requêter platform_role_permissions
   ↓
6. Récupérer les permissions depuis platform_permissions
   ↓
7. Créer JWT avec role_name
   ↓
8. À chaque requête:
   - Extraire role_name du JWT
   - Vérifier permissions dans platform_role_permissions
```

### 4.2 Flux d'autorisation détaillé

#### Étape 1: Authentification

```typescript
// PlatformAuthService.login()
const user = db.prepare(`
  SELECT u.id, u.email, u.password_hash, u.is_active,
         pa.role_name
  FROM users u
  LEFT JOIN platform_admins pa ON pa.user_id = u.id
  WHERE u.email = ? AND u.is_platform_user = 1
  LIMIT 1
`).get(email);

if (!user) return null;
if (!await verifyPassword(password, user.password_hash)) return null;
if (user.is_active === 0) return null;

// Rôle récupéré depuis platform_admins
const roleName = user.role_name;  // 'super_admin', 'support_admin', etc.

// Créer JWT
const token = signPlatformJwt({
  sub: user.id,
  email: user.email,
  role: roleName,
  is_platform_user: true
});
```

**Source de vérité:** `platform_admins.role_name` (qui référence `platform_roles.role_name`)

#### Étape 2: Vérification de permissions

```typescript
// PlatformAuthService.hasPermission()
const user = db.prepare(`
  SELECT pa.role_name
  FROM users u
  JOIN platform_admins pa ON pa.user_id = u.id
  WHERE u.id = ? AND u.is_platform_user = 1
  LIMIT 1
`).get(userId);

if (!user) return false;

// Super admin: toutes les permissions
if (user.role_name === 'super_admin') return true;

// Récupérer les permissions depuis platform_role_permissions
const permissions = db.prepare(`
  SELECT p.permission_key
  FROM platform_role_permissions prp
  JOIN platform_permissions p ON prp.permission_id = p.id
  JOIN platform_roles pr ON prp.role_id = pr.id
  WHERE pr.role_name = ?
`).all(user.role_name);

return permissions.some(p => p.permission_key === requestedPermission);
```

**Source de vérité:** `platform_role_permissions` + `platform_permissions`

#### Étape 3: Middleware d'autorisation

```typescript
// platform-auth.middleware.ts
const payload = verifyPlatformJwt(token);
if (!payload) return unauthorized();

// Vérifier que c'est un platform user
if (!payload.is_platform_user) return unauthorized();

// Vérifier les permissions
const hasPermission = await platformAuthService.hasPermission(
  payload.sub,
  requiredPermission
);

if (!hasPermission) return forbidden();
```

---

## 5. GESTION DU MULTI-CONTEXTE

### 5.1 Problème

**Un utilisateur peut être:**
- Tenant user (avec `tenant_id` et `role` métier)
- Platform admin (avec `is_platform_user = 1` et `platform_admins.role_name`)

**Exemple:**
```
users
├── id: 1
├── email: jean@restaurant.com
├── tenant_id: 16
├── role: 'admin'  (métier)
└── is_platform_user: 0

users
├── id: 2
├── email: admin@ekala.africa
├── tenant_id: NULL
├── role: 'owner'  (pour compatibilité)
└── is_platform_user: 1
    ↓
platform_admins
├── user_id: 2
└── role_name: 'super_admin'
```

### 5.2 Solution: Contexte explicite

**Principe:** Le contexte est déterminé par le JWT

#### JWT Métier (tenant)

```json
{
  "sub": 1,
  "email": "jean@restaurant.com",
  "role": "admin",
  "tenant_id": 16,
  "is_platform_user": false
}
```

**Middleware:** `verifyTenantToken()`
**Scope:** Tenant uniquement

#### JWT Plateforme (SaaS)

```json
{
  "sub": 2,
  "email": "admin@ekala.africa",
  "role": "super_admin",
  "is_platform_user": true
}
```

**Middleware:** `verifyPlatformToken()`
**Scope:** Tous les tenants (vue globale)

### 5.3 Sélection du contexte

**Règle:**
- Si `is_platform_user = true` → Contexte plateforme
- Si `is_platform_user = false` → Contexte métier

**Implémentation:**
```typescript
// Middleware de routage
function routeContext(req, res, next) {
  const token = req.headers.authorization;
  
  // Essayer platform JWT d'abord
  let payload = verifyPlatformJwt(token);
  if (payload && payload.is_platform_user) {
    req.context = 'platform';
    req.user = payload;
    return next();
  }
  
  // Essayer tenant JWT
  payload = verifyTenantJwt(token);
  if (payload && !payload.is_platform_user) {
    req.context = 'tenant';
    req.user = payload;
    return next();
  }
  
  return unauthorized();
}
```

---

## 6. ARCHITECTURE FINALE CORRIGÉE

### 6.1 Diagramme logique

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USERS (Identité)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    UTILISATEURS MÉTIER                       │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  tenant_id = 16                                              │  │
│  │  is_platform_user = 0                                        │  │
│  │  role = 'owner' | 'admin' | 'manager' | ...                 │  │
│  │                                                              │  │
│  │  Source de vérité: users.role                                │  │
│  │  Authentification: AuthService                               │  │
│  │  Authorization: Rôle métier                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   UTILISATEURS PLATEFORME                    │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  tenant_id = NULL                                            │  │
│  │  is_platform_user = 1                                        │  │
│  │                                                              │  │
│  │  Source de vérité: platform_admins (assignation)            │  │
│  │  Authentification: PlatformAuthService                       │  │
│  │  Authorization: RBAC plateforme                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    DOMAINE PLATEFORME (RBAC)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  platform_admins (ASSIGNATION UNIQUEMENT)                           │
│  ├── user_id (FK → users.id)                                       │
│  ├── role_name (FK → platform_roles.role_name)                     │
│  │       └── 'super_admin' | 'support_admin' | ...                │  │
│  ├── created_at                                                    │
│  ├── updated_at                                                    │
│  ├── created_by (FK → users.id)                                    │
│  └── notes                                                         │
│                                                                     │
│  ❌ PAS de colonne permissions                                     │
│  ❌ PAS de cache                                                    │
│  ❌ PAS de logique métier                                           │
│                                                                     │
│  ───────────────────────────────────────────────────────────────  │
│                                                                     │
│  platform_roles (SOURCE DE VÉRITÉ DES RÔLES)                       │
│  ├── role_name (PK)                                                │
│  ├── display_name                                                  │
│  ├── description                                                   │
│  ├── permissions (JSON: référentiel)                               │
│  └── is_system_role                                                │
│                                                                     │
│  ───────────────────────────────────────────────────────────────  │
│                                                                     │
│  platform_permissions (SOURCE DE VÉRITÉ DES PERMISSIONS)           │
│  ├── permission_key (PK)                                           │
│  ├── description                                                   │
│  └── category                                                      │
│                                                                     │
│  ───────────────────────────────────────────────────────────────  │
│                                                                     │
│  platform_role_permissions (SOURCE DE VÉRITÉ DU MAPPING)           │
│  ├── role_id (FK → platform_roles)                                 │
│  ├── permission_id (FK → platform_permissions)                     │
│  └── UNIQUE(role_id, permission_id)                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Flux d'autorisation runtime

```
┌─────────────┐
│   Requête   │
│  API call   │
└──────┬──────┘
       │
       ▼
┌────────────────────────────────────────┐
│  Middleware: routeContext()             │
│  1. Extraire JWT                       │
│  2. Vérifier is_platform_user          │
│  3. Déterminer contexte                │
└──────┬─────────────────────────────────┘
       │
       ├─────────────────┬────────────────────┐
       │                 │                    │
       ▼                 ▼                    ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Contexte    │  │  Contexte    │  │  Contexte        │
│  PLATEFORME  │  │  MÉTIER      │  │  INVALIDE        │
└──────┬───────┘  └──────┬───────┘  └────────┬─────────┘
       │                 │                     │
       ▼                 ▼                     ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Vérifier    │  │  Vérifier    │  │  Rejeter         │
│  permissions │  │  rôle métier │  │  403 Forbidden   │
│  plateforme  │  │  dans users  │  │                  │
└──────┬───────┘  └──────┬───────┘  └──────────────────┘
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  Query       │  │  Query       │
│  platform_   │  │  users       │
│  role_       │  │  WHERE       │
│  permissions │  │  role IN (...)│
└──────┬───────┘  └──────┬───────┘
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  Accès       │  │  Accès       │
│  autorisé    │  │  autorisé    │
│  (RBAC)      │  │  (rôle)      │
└──────────────┘  └──────────────┘
```

### 6.3 Source of truth par opération

| Opération | Table source | Requête |
|-----------|--------------|---------|
| **Login plateforme** | `users` + `platform_admins` | `SELECT FROM users JOIN platform_admins WHERE email=? AND is_platform_user=1` |
| **Récupération rôle** | `platform_admins.role_name` | `SELECT role_name FROM platform_admins WHERE user_id=?` |
| **Récupération permissions** | `platform_role_permissions` + `platform_permissions` | `SELECT p.permission_key FROM platform_role_permissions prp JOIN platform_permissions p ON prp.permission_id=p.id JOIN platform_roles pr ON prp.role_id=pr.id WHERE pr.role_name=?` |
| **Vérification permission** | `platform_role_permissions` | `SELECT COUNT(*) FROM platform_role_permissions WHERE role_id=(SELECT id FROM platform_roles WHERE role_name=?) AND permission_id=(SELECT id FROM platform_permissions WHERE permission_key=?)` |
| **Assignation rôle** | `platform_admins` | `INSERT INTO platform_admins (user_id, role_name) VALUES (?, ?)` |
| **Création rôle** | `platform_roles` | `INSERT INTO platform_roles (role_name, ...) VALUES (?, ...)` |
| **Ajout permission** | `platform_permissions` | `INSERT INTO platform_permissions (permission_key, ...) VALUES (?, ...)` |
| **Mapping rôle→permission** | `platform_role_permissions` | `INSERT INTO platform_role_permissions (role_id, permission_id) VALUES (?, ?)` |

---

## 7. RÈGLES D'OR

### Règle 1: Single Source of Truth

**✅ CORRECT:**
```
platform_roles = source de vérité des rôles
platform_permissions = source de vérité des permissions
platform_role_permissions = source de vérité du mapping
```

**❌ INCORRECT:**
```
platform_admins.permissions = cache (interdit)
users.role = rôles plateforme (interdit)
```

### Règle 2: Pas de cache

**✅ CORRECT:**
```typescript
// Toujours requêter platform_role_permissions
const permissions = await getPermissions(roleName);
```

**❌ INCORRECT:**
```typescript
// Jamais de cache dans platform_admins
platform_admins.permissions = JSON.stringify([...])  // INTERDIT
```

### Règle 3: Assignation uniquement

**✅ CORRECT:**
```sql
platform_admins
├── user_id (qui)
└── role_name (quel rôle)
```

**❌ INCORRECT:**
```sql
platform_admins
├── user_id
├── role_name
└── permissions  // INTERDIT
```

### Règle 4: Contexte explicite

**✅ CORRECT:**
```json
// JWT plateforme
{ "is_platform_user": true, "role": "super_admin" }

// JWT métier
{ "is_platform_user": false, "role": "admin", "tenant_id": 16 }
```

**❌ INCORRECT:**
```json
// JWT ambigu
{ "role": "super_admin" }  // On ne sait pas si c'est métier ou plateforme
```

---

## 8. COMPARAISON AVEC STRIPE/AWS IAM

### Stripe IAM

```
Users
  ↓
Roles (admin, developer, viewer)
  ↓
Permissions (charges:read, customers:write, etc.)
  ↓
Role-Permissions (mapping)
```

**Équivalence Ekala:**
```
users
  ↓
platform_roles (super_admin, support_admin, etc.)
  ↓
platform_permissions (tenants:read, subscriptions:write, etc.)
  ↓
platform_role_permissions (mapping)
```

### AWS IAM

```
Users
  ↓
Groups (Admin, Developer, Auditor)
  ↓
Policies (JSON: actions sur ressources)
  ↓
Attachments (user → group, group → policy)
```

**Équivalence Ekala:**
```
users
  ↓
platform_roles (groupes)
  ↓
platform_permissions (actions)
  ↓
platform_role_permissions (attachments)
```

---

## 9. AVANTAGES DE CETTE ARCHITECTURE

### 9.1 Scalabilité

✅ **Ajout de rôle plateforme:**
```sql
INSERT INTO platform_roles (role_name, display_name, ...) 
VALUES ('new_role', 'New Role', ...);

INSERT INTO platform_role_permissions (role_id, permission_id)
SELECT (SELECT id FROM platform_roles WHERE role_name='new_role'), id
FROM platform_permissions
WHERE permission_key IN (...);
```

✅ **Ajout de permission:**
```sql
INSERT INTO platform_permissions (permission_key, description, category)
VALUES ('new:permission', 'Description', 'Category');

-- Assigner aux rôles existants
INSERT INTO platform_role_permissions (role_id, permission_id)
SELECT role_id, (SELECT id FROM platform_permissions WHERE permission_key='new:permission')
FROM platform_roles;
```

### 9.2 Maintenabilité

✅ **Responsabilités séparées:**
- `platform_roles` = définition des rôles
- `platform_permissions` = catalogue des permissions
- `platform_role_permissions` = mapping RBAC
- `platform_admins` = assignation user ↔ rôle

✅ **Pas de duplication:**
- Pas de cache
- Pas de redondance
- Single source of truth

### 9.3 Sécurité

✅ **Pas de confusion:**
- Rôles métier dans `users.role`
- Rôles plateforme dans `platform_roles`
- Séparation claire

✅ **Pas de dérive:**
- Pas de cache qui peut devenir obsolète
- Toujours requêter les sources de vérité

### 9.4 Évolutivité

✅ **Nouveaux rôles:**
- Ajouter dans `platform_roles`
- Assigner permissions dans `platform_role_permissions`
- Aucune modification de code

✅ **Nouvelles permissions:**
- Ajouter dans `platform_permissions`
- Assigner aux rôles dans `platform_role_permissions`
- Aucune modification de code

---

## 10. CONCLUSION

### Architecture RBAC corrigée

# ✅ ARCHITECTURE STRIPE/AWS IAM SIMPLIFIÉE

**Principe:**
```
platform_roles = SOURCE DE VÉRITÉ DES RÔLES
platform_permissions = SOURCE DE VÉRITÉ DES PERMISSIONS
platform_role_permissions = SOURCE DE VÉRITÉ DU MAPPING RBAC
platform_admins = TABLE D'ASSIGNATION UNIQUEMENT (user ↔ role)
```

**Règles:**
1. ✅ Single source of truth par table
2. ✅ Pas de cache
3. ✅ Pas de logique métier dans les tables
4. ✅ Contexte explicite (JWT avec `is_platform_user`)

**Avantages:**
- ✅ Scalable
- ✅ Maintenable
- ✅ Sécurisé
- ✅ Évolutif

**Comparaison:**
- Équivalent à Stripe IAM
- Équivalent à AWS IAM (simplifié)
- Architecture éprouvée et robuste

**Architecture cible confirmée: RBAC avec séparation des responsabilités**