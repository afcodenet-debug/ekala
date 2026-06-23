# REFACTOR ARCHITECTURAL: SÉPARATION RÔLES MÉTIER / RÔLES PLATE-FORME

## Mission

Proposer une architecture cible propre et scalable qui sépare :
- **Rôles métier** (tenant/restaurant/bar) : owner, admin, manager, cashier, waiter, staff
- **Rôles plateforme** (SaaS administration) : super_admin, support_admin, finance_admin, ops_admin

**Contraintes:**
- ❌ NE PAS modifier de fichiers
- ❌ NE PAS proposer de migration SQL
- ❌ NE PAS simplifier à une seule table `role`
- ❌ DO NOT merge platform roles into `users.role`
- ✅ Audit logique uniquement
- ✅ Proposition d'architecture cible
- ✅ Plan de refactor sans breaking change

---

## 1. AUDIT LOGIQUE DE L'ARCHITECTURE ACTUELLE

### 1.1 Problème identifié

**Mélange des domaines dans `users.role`:**

```
users.role
├── Rôles MÉTIER (tenant)
│   ├── owner
│   ├── admin
│   ├── manager
│   ├── cashier
│   ├── waiter
│   └── staff
└── Rôles PLATEFORME (SaaS)
    ├── super_admin
    ├── support_admin
    ├── finance_admin
    └── ops_admin
```

**Conséquences:**
- ❌ Contrainte CHECK trop restrictive (doit inclure tous les rôles)
- ❌ Confusion entre authentification métier et plateforme
- ❌ Difficile d'ajouter de nouveaux rôles plateforme sans impacter les tenants
- ❌ Synchronisation complexe (faut filtrer par `is_platform_user`)
- ❌ Sécurité: risque de confusion entre rôles métier et plateforme

### 1.2 Où chaque type de rôle est utilisé

#### Rôles métier (owner, admin, manager, cashier, waiter, staff)

| Fichier | Ligne | Usage | Domaine |
|---------|-------|-------|---------|
| `super-admin.middleware.ts` | 24 | `if (user.role === 'owner')` | Auth plateforme (exception) |
| `database.ts` | 156 | `WHERE role = 'admin'` | Seed data |
| `sales.ts` | 23 | `WHERE role = "admin"` | Fallback user |
| `settingsStore.ts` | 8 | `role === 'admin' \|\| role === 'manager'` | Settings UI |
| `notificationStore.ts` | 15 | `role === 'cashier'` | Notifications |
| `table.service.ts` | 8 | `params?.role === 'waiter'` | Tables |
| `order.service.ts` | 18 | `role === 'waiter'` | Orders |

**Domaine principal:** Application métier (POS, QR Menu, Inventory)

#### Rôles plateforme (super_admin, support_admin, finance_admin, ops_admin)

| Fichier | Ligne | Usage | Domaine |
|---------|-------|-------|---------|
| `platform-auth.service.ts` | 106 | `platformRoles.includes(user.role)` | Auth plateforme |
| `platform-auth.service.ts` | 162 | `WHERE pr.role_name = ?` | RBAC permissions |
| `platform-auth.middleware.ts` | 12 | `payload.role === 'super_admin'` | Middleware plateforme |
| `super-admin.middleware.ts` | 12 | `user.role !== 'super_admin'` | Middleware plateforme |

**Domaine principal:** Administration SaaS (tenants, billing, monitoring)

### 1.3 Impacts du mélange actuel

#### Impact 1: Contrainte CHECK

**Problème:**
```sql
-- users.role doit accepter:
- owner, admin, manager, cashier, waiter, staff (métier)
- super_admin, support_admin, finance_admin, ops_admin (plateforme)
```

**Conséquence:**
- Migration complexe (recréer la table)
- Risque d'oublier un rôle
- Contrainte non sémantique

#### Impact 2: Synchronisation

**Problème:**
```typescript
// GenericSyncService.pullByEntity()
query = query.eq('tenant_id', tenantId);
// Les admins plateforme ont tenant_id = NULL
// → Pas synchronisés (comportement actuel)
```

**Conséquence:**
- Les admins plateforme ne sont pas synchronisés
- Si Supabase a un super_admin, il n'est pas répliqué en local
- Double gestion (locale + Supabase) nécessaire

#### Impact 3: Authentification

**Problème:**
```typescript
// platform-auth.service.ts:login()
SELECT FROM users WHERE email = ? AND is_platform_user = 1
// Puis vérification role
```

**Conséquence:**
- Même table pour deux systèmes d'authentification
- Risque de confusion
- JWT différents (platform JWT vs tenant JWT)

#### Impact 4: Sécurité

**Problème:**
```typescript
// super-admin.middleware.ts
if (user.role !== 'super_admin' && user.role !== 'owner')
```

**Conséquence:**
- `owner` (rôle métier) a accès aux routes plateforme
- Pas de séparation claire entre métier et plateforme
- Risque d'escalade de privilèges

---

## 2. ARCHITECTURE CIBLE PROPOSÉE

### 2.1 Principe de séparation

**Deux domaines distincts:**

```
┌─────────────────────────────────────────────────────────────┐
│                    DOMAINE MÉTIER (TENANT)                   │
├─────────────────────────────────────────────────────────────┤
│  users.role = rôles métier UNIQUEMENT                        │
│  ├── owner                                                   │
│  ├── admin                                                   │
│  ├── manager                                                 │
│  ├── cashier                                                 │
│  ├── waiter                                                  │
│  └── staff                                                   │
│                                                             │
│  Authentification: AuthService (JWT tenant)                  │
│  Authorization: RBAC métier (si nécessaire)                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  DOMAINE PLATEFORME (SaaS)                   │
├─────────────────────────────────────────────────────────────┤
│  platform_admins.user_id → FK vers users.id                 │
│  platform_admins.role → FK vers platform_roles.role_name    │
│                                                             │
│  platform_roles (référentiel)                               │
│  ├── super_admin                                             │
│  ├── support_admin                                           │
│  ├── finance_admin                                           │
│  └── ops_admin                                               │
│                                                             │
│  platform_permissions (catalogue)                            │
│  platform_role_permissions (mapping RBAC)                    │
│                                                             │
│  Authentification: PlatformAuthService (JWT plateforme)      │
│  Authorization: RBAC plateforme                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Schéma logique

#### Table `users` (partagée)

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    full_name VARCHAR(255),
    pin_code VARCHAR(10),
    
    -- RÔLE MÉTIER UNIQUEMENT
    role TEXT NOT NULL DEFAULT 'staff' 
        CHECK (role IN ('owner','admin','manager','cashier','waiter','staff')),
    
    is_active INTEGER NOT NULL DEFAULT 1,
    password_hash TEXT NOT NULL,
    
    -- IDENTIFICATION PLATEFORME
    tenant_id INTEGER,  -- NULL pour les admins plateforme
    is_platform_user BOOLEAN DEFAULT FALSE,
    is_super_admin INTEGER NOT NULL DEFAULT 0,
    
    phone VARCHAR(20),
    has_setup_pin INTEGER DEFAULT 0,
    remote_id INTEGER,
    business_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Changement:** `users.role` ne contient PLUS les rôles plateforme.

#### Table `platform_admins` (NOUVEAU RÔLE)

```sql
CREATE TABLE IF NOT EXISTS platform_admins (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    role_name TEXT NOT NULL 
        CHECK (role_name IN ('super_admin','support_admin','finance_admin','ops_admin'))
        REFERENCES platform_roles(role_name),
    permissions TEXT DEFAULT '[]',  -- JSON cache (optionnel)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by INTEGER REFERENCES users(id),
    notes TEXT
);
```

**Rôle:** Stocke le rôle plateforme de chaque utilisateur plateforme.

**Relation:** 1:1 avec `users` (un utilisateur plateforme = un rôle plateforme)

#### Tables RBAC (existantes)

```sql
-- Référentiel des rôles plateforme
platform_roles (id, role_name, display_name, description, permissions, is_system_role)

-- Catalogue des permissions
platform_permissions (id, permission_key, description, category)

-- Mapping rôle → permissions
platform_role_permissions (id, role_id, permission_id)
```

### 2.3 Flux d'authentification

#### Flux 1: Authentification métier (tenant)

```
1. User login (POS/QR Menu)
   ↓
2. AuthService.authenticate(email, password)
   ↓
3. SELECT FROM users 
   WHERE email = ? AND tenant_id = ? AND is_platform_user = 0
   ↓
4. Vérification password_hash
   ↓
5. Vérification role dans ('owner','admin','manager','cashier','waiter','staff')
   ↓
6. Création JWT tenant: { sub, email, role: 'admin', tenant_id: 16 }
   ↓
7. Retour token + user
```

#### Flux 2: Authentification plateforme

```
1. User login (Platform)
   ↓
2. PlatformAuthService.login(email, password)
   ↓
3. SELECT FROM users 
   WHERE email = ? AND is_platform_user = 1
   ↓
4. JOIN platform_admins 
   ON platform_admins.user_id = users.id
   ↓
5. Vérification password_hash
   ↓
6. Récupération rôle plateforme: platform_admins.role_name
   ↓
7. Création JWT plateforme: { sub, email, role: 'super_admin', is_platform_user: true }
   ↓
8. Retour token + user
```

### 2.4 Flux d'autorisation

#### Flux 1: Authorization métier

```
1. Requête tenant (ex: créer une commande)
   ↓
2. Middleware: verifyTenantToken(req)
   ↓
3. Extraction JWT: { role: 'waiter', tenant_id: 16 }
   ↓
4. Vérification role dans ('owner','admin','manager','cashier','waiter','staff')
   ↓
5. Vérification permissions métier (si nécessaire)
   ↓
6. Accès autorisé
```

#### Flux 2: Authorization plateforme

```
1. Requête plateforme (ex: gérer les tenants)
   ↓
2. Middleware: verifyPlatformToken(req)
   ↓
3. Extraction JWT: { role: 'super_admin', is_platform_user: true }
   ↓
4. Vérification role dans ('super_admin','support_admin','finance_admin','ops_admin')
   ↓
5. Récupération permissions depuis platform_role_permissions
   ↓
6. Vérification permission demandée
   ↓
7. Accès autorisé
```

### 2.5 Séparation des responsabilités

| Domaine | Authentification | Authorization | Données |
|---------|-----------------|---------------|---------|
| **Métier (tenant)** | AuthService | Rôle métier dans `users.role` | `users` avec `tenant_id` |
| **Plateforme (SaaS)** | PlatformAuthService | RBAC via `platform_role_permissions` | `users` avec `is_platform_user=1` + `platform_admins` |

---

## 3. RÉPONSES AUX QUESTIONS

### QUESTION 1: Où doivent vivre les rôles plateforme ?

# ✅ Dans `platform_admins.role_name` (FK vers `platform_roles.role_name`)

**Architecture:**

```
users (identité)
  ↓
platform_admins (rôle plateforme)
  ↓
platform_roles (référentiel)
  ↓
platform_role_permissions (RBAC)
```

**Pourquoi pas `users.role` ?**
- `users.role` est réservé aux rôles métier
- Séparation claire des domaines
- Pas de mélange dans une contrainte CHECK
- Scalabilité: ajout de rôles plateforme sans impacter les tenants

**Pourquoi `platform_admins` ?**
- Table existante (créée en migration 036)
- Prévue pour ce usage
- Relation 1:1 avec `users`
- Permet d'ajouter des colonnes spécifiques (permissions, notes, etc.)

### QUESTION 2: Comment doit être utilisé `users.role` ?

# ✅ `users.role` = UNIQUEMENT rôles métier

**Valeurs autorisées:**
```sql
CHECK (role IN ('owner','admin','manager','cashier','waiter','staff'))
```

**Utilisation:**
- Authentification métier (AuthService)
- Authorization métier (middlewares tenant)
- Synchronisation métier (GenericSyncService)
- Affichage UI (menu, permissions)

**Interdiction:**
- ❌ PAS de rôle plateforme dans `users.role`
- ❌ PAS de `super_admin`, `support_admin`, etc.

### QUESTION 3: Faut-il garder `platform_admins` ?

# ✅ OUI, et c'est la table de stockage des rôles plateforme

**Rôle de `platform_admins`:**

| Colonne | Type | Usage |
|---------|------|-------|
| `user_id` | PK, FK vers `users.id` | Identification de l'utilisateur |
| `role_name` | FK vers `platform_roles.role_name` | Rôle plateforme |
| `permissions` | JSON (cache) | Permissions calculées (optionnel) |
| `created_at` | Timestamp | Audit |
| `updated_at` | Timestamp | Audit |
| `created_by` | FK vers `users.id` | Qui a créé cet admin |
| `notes` | TEXT | Commentaires |

**Relation:**
```
users (1) ←→ (1) platform_admins
```

**Utilisation:**
- `PlatformAuthService.login()` → JOIN `platform_admins` pour récupérer le rôle
- `PlatformAuthService.getPermissions()` → Utilise `platform_admins.role_name`
- `PlatformAuthService.createPlatformUser()` → INSERT dans `users` + `platform_admins`

### QUESTION 4: Séparation authentication / authorization métier / authorization plateforme

# ✅ SÉPARATION CLAIRE EN 3 COUCHES

## Couche 1: Authentication (Qui êtes-vous ?)

### Authentification métier

**Service:** `AuthService`
**Table:** `users` (avec `tenant_id` et `is_platform_user = 0`)
**JWT:** `{ sub, email, role: 'admin', tenant_id: 16 }`
**Middleware:** `verifyTenantToken()`

### Authentification plateforme

**Service:** `PlatformAuthService`
**Table:** `users` (avec `is_platform_user = 1`) + `platform_admins`
**JWT:** `{ sub, email, role: 'super_admin', is_platform_user: true }`
**Middleware:** `verifyPlatformToken()`

**Séparation:**
- Deux services d'authentification distincts
- Deux JWT distincts (claims différents)
- Deux middlewares distincts
- Pas de confusion possible

## Couche 2: Authorization métier (Que pouvez-vous faire dans votre tenant ?)

**Mécanisme:** Rôle métier dans `users.role`

**Rôles:**
- `owner` → Tous les droits
- `admin` → Gestion complète sauf paramètres sensibles
- `manager` → Gestion opérationnelle
- `cashier` → Caisse, ventes
- `waiter` → Commandes, tables
- `staff` → Lecture seulement

**Vérification:**
```typescript
if (user.role === 'owner' || user.role === 'admin') {
  // Accès autorisé
}
```

**Scope:** Uniquement le tenant de l'utilisateur (`tenant_id`)

## Couche 3: Authorization plateforme (Que pouvez-vous faire sur la plateforme ?)

**Mécanisme:** RBAC avec `platform_roles` + `platform_permissions` + `platform_role_permissions`

**Rôles:**
- `super_admin` → Toutes les permissions (`["*"]`)
- `support_admin` → Lecture seulement (tenants, audit, sync, vouchers)
- `finance_admin` → Finances (subscriptions, vouchers, billing)
- `ops_admin` → Opérations (tenants, sync, monitoring)

**Permissions:**
- 32 permissions granulaires
- Catégories: Tenants, Subscriptions, Vouchers, Finance, Sync, Monitoring, Audit, Settings, Users

**Vérification:**
```typescript
// 1. Vérifier le rôle plateforme
if (user.role === 'super_admin') return true;  // Accès total

// 2. Vérifier les permissions
const permissions = await getPermissions(user.role);
if (permissions.includes('tenants:write')) {
  // Accès autorisé
}
```

**Scope:** Tous les tenants (vue globale)

---

## 4. ARCHITECTURE FINALE

### 4.1 Diagramme logique

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS (Table partagée)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              UTILISATEURS MÉTIER (Tenants)                │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  tenant_id = 16                                          │  │
│  │  is_platform_user = 0                                    │  │
│  │  role = 'owner' | 'admin' | 'manager' | ...             │  │
│  │                                                          │  │
│  │  Authentification: AuthService                           │  │
│  │  Authorization: Rôle métier (users.role)                 │  │
│  │  JWT: { sub, email, role, tenant_id }                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              UTILISATEURS PLATEFORME (SaaS)               │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  tenant_id = NULL                                        │  │
│  │  is_platform_user = 1                                    │  │
│  │  role = 'owner' (pour compatibilité)                     │  │
│  │                                                          │  │
│  │  Authentification: PlatformAuthService                   │  │
│  │  Authorization: RBAC plateforme                          │  │
│  │  JWT: { sub, email, role, is_platform_user }             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DOMAINE PLATEFORME                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  platform_admins                                                │
│  ├── user_id (FK → users.id)                                   │
│  ├── role_name (FK → platform_roles.role_name)                 │
│  │       ├── 'super_admin'                                     │
│  │       ├── 'support_admin'                                   │
│  │       ├── 'finance_admin'                                   │
│  │       └── 'ops_admin'                                       │
│  ├── permissions (JSON cache)                                  │
│  └── ...                                                       │
│                                                                 │
│  platform_roles (référentiel)                                  │
│  ├── role_name                                                 │
│  ├── display_name                                              │
│  ├── description                                               │
│  └── permissions (JSON par défaut)                             │
│                                                                 │
│  platform_permissions (catalogue)                              │
│  ├── tenants:read, tenants:write, ...                         │
│  └── (32 permissions total)                                    │
│                                                                 │
│  platform_role_permissions (mapping RBAC)                      │
│  ├── super_admin → toutes les permissions                     │
│  ├── support_admin → 6 permissions (lecture)                  │
│  ├── finance_admin → 12 permissions (finances)                │
│  └── ops_admin → 10 permissions (opérations)                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Flux d'authentification complet

#### Flux métier (tenant)

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Client  │─────▶│   POS   │─────▶│ AuthSvc  │─────▶│   users  │
│ (Frontend)│     │ (Backend)│     │          │      │ (SQLite) │
└──────────┘      └──────────┘      └──────────┘      └──────────┘
                         │                  │
                         │  1. Login        │
                         │─────────────────▶
                         │                  │
                         │  2. SELECT       │
                         │     WHERE        │
                         │     email=?      │
                         │     tenant_id=?  │
                         │     is_platform=0│
                         │◀─────────────────
                         │                  │
                         │  3. Verify pass  │
                         │                  │
                         │  4. Check role   │
                         │     ('owner',    │
                         │      'admin',...)│
                         │                  │
                         │  5. Create JWT   │
                         │     {            │
                         │       sub,       │
                         │       email,    │
                         │       role,     │
                         │       tenant_id │
                         │     }            │
                         │◀─────────────────
                         │                  │
                         │  6. Return token │
                         │─────────────────▶
                         │                  │
┌──────────┐      ┌──────────┐      ┌──────────┐
│  Client  │◀─────│   POS   │◀─────│ AuthSvc  │
│ (Frontend)│     │ (Backend)│     │          │
└──────────┘      └──────────┘      └──────────┘
```

#### Flux plateforme (SaaS)

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────────────┐
│  Admin  │─────▶│ Platform │─────▶│Platform  │─────▶│   users   │─────▶│ platform_admins  │
│(Frontend)│     │  (Backend)│     │AuthSvc   │      │ (SQLite)  │      │   (SQLite)       │
└──────────┘      └──────────┘      └──────────┘      └──────────┘      └──────────────────┘
                         │                  │                  │
                         │  1. Login        │                  │
                         │─────────────────▶│                  │
                         │                  │                  │
                         │  2. SELECT       │                  │
                         │     FROM users   │                  │
                         │     WHERE        │                  │
                         │     email=?      │                  │
                         │     is_platform=1│                  │
                         │◀─────────────────│                  │
                         │                  │                  │
                         │  3. JOIN         │──────────────────▶│
                         │     platform_admins                       │
                         │     ON user_id=id │                  │
                         │◀───────────────────────────────────────│
                         │                  │                  │
                         │  4. Verify pass  │                  │
                         │                  │                  │
                         │  5. Get role     │                  │
                         │     platform_admins.role_name            │
                         │     ('super_admin',                     │
                         │      'support_admin',...)               │
                         │                  │                  │
                         │  6. Get perms    │──────────────────▶│
                         │     FROM platform_role_permissions      │
                         │     WHERE role_name = ?                 │
                         │◀───────────────────────────────────────│
                         │                  │                  │
                         │  7. Create JWT   │                  │
                         │     {            │                  │
                         │       sub,       │                  │
                         │       email,    │                  │
                         │       role,     │                  │
                         │       is_platform_user               │
                         │     }            │                  │
                         │◀─────────────────│                  │
                         │                  │                  │
                         │  8. Return token │                  │
                         │─────────────────▶│                  │
                         │                  │                  │
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────────────┐
│  Admin  │◀─────│ Platform │◀─────│Platform  │◀─────│   users   │◀─────│ platform_admins  │
│(Frontend)│     │  (Backend)│     │AuthSvc   │      │ (SQLite)  │      │   (SQLite)       │
└──────────┘      └──────────┘      └──────────┘      └──────────┘      └──────────────────┘
```

### 4.3 Source of truth par domaine

| Donnée | Table | Source de vérité |
|--------|-------|-------------------|
| **Identité métier** | `users` | `users` (email, password_hash, role métier) |
| **Rôle métier** | `users.role` | `users.role` (owner, admin, manager, etc.) |
| **Appartenance tenant** | `users.tenant_id` | `users.tenant_id` |
| **Identité plateforme** | `users` + `platform_admins` | `users` (email, password_hash) + `platform_admins` (rôle) |
| **Rôle plateforme** | `platform_admins.role_name` | `platform_admins.role_name` (FK vers `platform_roles`) |
| **Permissions plateforme** | `platform_role_permissions` | `platform_role_permissions` (mapping RBAC) |
| **Métadonnées rôles** | `platform_roles` | `platform_roles` (display_name, description) |
| **Catalogue permissions** | `platform_permissions` | `platform_permissions` |

---

## 5. IMPACTS DU REFACTOR

### 5.1 Impacts positifs

✅ **Séparation claire des domaines**
- Rôles métier dans `users.role`
- Rôles plateforme dans `platform_admins.role_name`
- Pas de mélange

✅ **Scalabilité**
- Ajout de rôles plateforme sans impacter les tenants
- Contrainte CHECK sur `users.role` reste simple
- RBAC plateforme indépendant

✅ **Sécurité**
- Pas de confusion entre rôles métier et plateforme
- `owner` (métier) n'a pas accès aux routes plateforme
- Vérification explicite `is_platform_user`

✅ **Maintenabilité**
- Code plus clair
- Responsabilités séparées
- Tests plus faciles

### 5.2 Impacts négatifs (breaking changes)

❌ **Migration SQL complexe**
- Recréer `users` avec contrainte CHECK réduite
- Créer/modifier `platform_admins`
- Migrer les rôles plateforme existants

❌ **Modifications de code**
- `platform-auth.service.ts` → Lire rôle depuis `platform_admins`
- `platform-bootstrap.ts` → Créer dans `users` + `platform_admins`
- `super-admin.middleware.ts` → Vérifier `platform_admins` au lieu de `users.role`
- `GenericSyncService` → Gérer `platform_admins` (ou exclure de la sync)

❌ **Données existantes**
- Migrer les utilisateurs plateforme existants
- Créer les lignes `platform_admins` correspondantes
- Gérer les cas où `users.role = 'super_admin'`

---

## 6. PLAN DE REFACTOR (SANS BREAKING CHANGE)

### Phase 1: Préparation (sans modification)

1. **Audit complet** (ce document)
2. **Validation architecture** par l'équipe
3. **Backup complet** de la base de données
4. **Tests de non-régression** (capturer l'état actuel)

### Phase 2: Migration SQL (avec rollback)

1. **Sauvegarde** → `users_backup_YYYYMMDD`
2. **Créer `platform_admins`** (si n'existe pas)
3. **Migrer les rôles plateforme** de `users.role` vers `platform_admins`
4. **Recréer `users`** avec contrainte CHECK réduite
5. **Vérifications** post-migration
6. **Rollback** si problème

### Phase 3: Mise à jour du code

1. **PlatformAuthService** → Lire rôle depuis `platform_admins`
2. **PlatformBootstrap** → Créer dans `users` + `platform_admins`
3. **Middlewares** → Vérifier `platform_admins` pour plateforme
4. **GenericSyncService** → Exclure `platform_admins` de la sync (ou ajouter entité)
5. **Tests** complets

### Phase 4: Validation

1. **Tests unitaires** (auth, RBAC, middleware)
2. **Tests d'intégration** (login, sync, permissions)
3. **Tests de non-régression** (comparer avec Phase 1)
4. **Monitoring** en production (24h)

---

## 7. CONCLUSION

### Architecture recommandée

# ✅ SÉPARATION DOMAINES: Métier vs Plateforme

**Principe:**
- `users.role` = rôles métier UNIQUEMENT
- `platform_admins.role_name` = rôles plateforme
- `platform_roles/permissions/role_permissions` = RBAC plateforme

**Avantages:**
- ✅ Séparation claire des responsabilités
- ✅ Scalabilité (ajout de rôles plateforme sans impacter tenants)
- ✅ Sécurité (pas de confusion entre domaines)
- ✅ Maintenabilité (code plus clair)

**Inconvénients:**
- ❌ Migration SQL complexe
- ❌ Modifications de code nécessaires
- ❌ Risque de breaking change

**Recommandation:**
- ✅ Procéder au refactor
- ✅ Bien planifier (Phase 1-4)
- ✅ Tester exhaustivement
- ✅ Prévoir un rollback

**Architecture cible confirmée: Séparation Domaines Métier / Plateforme**