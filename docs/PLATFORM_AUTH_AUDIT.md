# AUDIT AUTHENTIFICATION — PLATFORM AUTHENTICATION

**Date**: 2026-06-22  
**Mission**: Super Admin Platform Architecture  
**Phase**: 1 — Audit

---

## 1. ARCHITECTURE ACTUELLE

### 1.1 Tables existantes

#### `users`
```sql
- id (PK)
- email (UNIQUE)
- password_hash
- full_name
- role (ENUM: owner, admin, manager, cashier, waiter)
- status (ENUM: active, suspended, pending)
- tenant_id (FK → tenants.id)  ← CRITIQUE: toujours NOT NULL
- created_at
- updated_at
```

#### `tenant_users`
```sql
- id (PK)
- tenant_id (FK → tenants.id)
- user_id (FK → users.id)
- role (rôle spécifique au tenant)
- is_active (BOOLEAN)
- created_at
```

#### `tenants`
```sql
- id (PK)
- name
- slug (UNIQUE)
- owner_email
- status (active, suspended, trial, cancelled)
- plan_code
- is_provisioned
- created_at
```

### 1.2 Flux d'authentification actuel

```
1. User s'inscrit → POST /api/tenants
2. Création user + tenant
3. Login → POST /api/auth/login
4. Vérification credentials
5. Génération JWT avec tenant_id
6. Accès aux routes protégées
```

### 1.3 JWT Payload actuel

```typescript
interface JwtPayload {
  sub: number;          // user ID
  tenant_id: number;    // tenant ID (OBLIGATOIRE)
  role: string;         // owner, admin, manager, cashier, waiter
  email?: string;
  full_name?: string;
  iat: number;
  exp: number;
}
```

### 1.4 Middleware existant

**`jwt-auth.ts`**:
- `requireJwtAuth()` — Valide JWT, extrait user + tenant_id
- `requirePermission()` — Vérifie rôle utilisateur
- `requireAdmin()` — Admin ou super_admin
- `requireAdminOrManager()` — Admin, manager, super_admin

**`tenant-scope.ts`**:
- `requireTenantScope()` — Injecte tenant_id dans requête
- Isolation multi-tenant automatique

**`subscription-guard.ts`**:
- `requireActiveSubscription()` — Vérifie abonnement actif
- Bloque accès si suspended/expired

---

## 2. ANALYSE DES RISQUES

### 2.1 Risques identifiés

#### 🔴 CRITIQUE: Pas de séparation Platform/Tenant

**Problème**: 
- Un `owner` peut potentiellement accéder à des routes admin
- Pas de distinction claire entre équipe interne et clients
- `tenant_id` toujours présent dans JWT

**Impact**:
- Escalade de privilèges possible
- Accès croisés tenant/plateforme
- Violation de l'isolation

#### 🟡 MOYEN: Rôles limités

**Problème**:
- Seulement 5 rôles: owner, admin, manager, cashier, waiter
- Pas de granularité pour équipe interne
- Pas de permissions fines

**Impact**:
- Difficile de gérer équipe support/finance/ops
- Pas de séparation des responsabilités

#### 🟡 MOYEN: Pas d'audit platform

**Problème**:
- `billing_audit_logs` existe mais limité
- Pas de logs spécifiques pour actions platform
- Pas de traçabilité complète

**Impact**:
- Difficile de tracker actions super admin
- Pas de compliance

#### 🟢 FAIBLE: Pas de MFA

**Problème**:
- Authentification simple par mot de passe
- Pas de 2FA pour comptes sensibles

**Impact**:
- Risque sécurité pour comptes admin

---

## 3. DÉPENDANCES

### 3.1 Dépendances directes

- **JWT Service**: `src/server/middleware/jwt-auth.ts`
- **Auth Routes**: `src/server/routes/auth.ts` (à vérifier)
- **User Model**: `src/server/db/database.ts` (Knex schema)
- **Tenant Model**: Même fichier
- **Subscription Guard**: `src/server/middleware/subscription-guard.ts`

### 3.2 Dépendances indirectes

- **Sync System**: Toutes les routes sync utilisent JWT
- **Billing System**: Routes billing vérifient tenant_id
- **POS System**: Tables, orders, products dépendent de tenant scope
- **SaaS Routes**: `src/server/saas/saas.routes.ts`

### 3.3 Points d'impact

```
Authentification actuelle
    ├── Toutes les routes /api/* (100+ routes)
    ├── Sync V2 (26 tables)
    ├── Billing (vouchers, subscriptions)
    ├── POS (orders, tables, products)
    └── SaaS (tenants, plans, payments)
```

---

## 4. IMPACTS DES MODIFICATIONS

### 4.1 Impacts sans risque (rétrocompatibles)

✅ **Ajout nouveaux rôles**:
- Ajouter `super_admin`, `support_admin`, etc. à l'ENUM
- Anciens rôles conservés
- Aucun impact sur existant

✅ **Ajout colonne `is_platform_user`**:
- DEFAULT FALSE
- Users existants = tenant users
- Aucun impact

✅ **Nouvelle table `platform_users`**:
- Table séparée
- Pas de modification users/tenant_users
- Zéro impact

### 4.2 Impacts à valider

⚠️ **Modification JWT Payload**:
- Ajouter `is_platform_user` au payload
- Tous les middlewares doivent gérer les deux cas
- Tests requis

⚠️ **Nouvelles routes /platform/**:
- Doivent être AVANT tenant scope middleware
- Nécessite modification `server.ts`
- Impact: ordre des middlewares

⚠️ **Bootstrap super admin**:
- Migration idempotente
- Création user spécial
- Doit être executé une seule fois

### 4.3 Impacts critiques (à éviter)

🔴 **NE PAS TOUCHER**:
- Structure table `users` (ajout colonnes OK, pas suppression)
- Structure table `tenant_users`
- JWT secret/algorithm
- Middleware `requireJwtAuth` existant
- Routes tenant existantes

---

## 5. RECOMMANDATIONS

### 5.1 Séparation claire

```
AVANT (actuel):
┌─────────────────────────────────────┐
│         users (table unique)         │
│  ┌──────────────┬──────────────┐   │
│  │  Tenant User │ Platform User│   │
│  │  (tenant_id) │ (tenant_id)  │   │
│  │  ≠ NULL      │ = NULL       │   │
│  └──────────────┴──────────────┘   │
└─────────────────────────────────────┘

APRÈS (cible):
┌──────────────────┐  ┌──────────────────┐
│   tenant_users   │  │  platform_users  │
│  (lié à tenant)  │  │  (pas de tenant) │
└──────────────────┘  └──────────────────┘
```

### 5.2 Approche recommandée

1. **Phase 2-4**: Ajouter rôles + colonnes + bootstrap (non-breaking)
2. **Phase 5-7**: Créer PlatformAuthService + login + JWT (nouveaux fichiers)
3. **Phase 8-9**: Middleware + routes platform (isolation totale)
4. **Phase 10-11**: Layout + RBAC (frontend)
5. **Phase 12-13**: MFA prep + audit logs (sécurité)
6. **Phase 14-15**: Security review + livrable final

### 5.3 Points de vigilance

⚠️ **Ne jamais mélanger**:
- Platform users ne doivent PAS avoir tenant_id
- Tenant users ne doivent PAS accéder à /platform/*
- JWT différents pour les deux mondes (optionnel mais recommandé)

⚠️ **Tests obligatoires**:
- Login tenant user → /platform/* → 403
- Login platform user → /api/* (tenant routes) → 403
- Vérifier isolation totale

---

## 6. FICHIERS À CRÉER/MODIFIER

### 6.1 Backend (nouveaux)

```
src/server/
├── platform/
│   ├── auth/
│   │   ├── platform-auth.service.ts (nouveau)
│   │   ├── platform-auth.routes.ts (nouveau)
│   │   └── platform-jwt.middleware.ts (nouveau)
│   ├── middleware/
│   │   └── platform-permissions.middleware.ts (nouveau)
│   └── repositories/
│       └── platform-user.repository.ts (nouveau)
```

### 6.2 Backend (modifications)

```
src/server/
├── middleware/
│   └── jwt-auth.ts (ajouter is_platform_user)
├── routes/
│   └── platform.routes.ts (ajouter /auth)
└── server.ts (ajouter routes platform AVANT tenant scope)
```

### 6.3 Frontend (nouveaux)

```
src/
├── pages/
│   └── platform/
│       └── PlatformLoginPage.tsx (nouveau)
├── components/
│   └── platform/
│       └── PlatformLayout.tsx (déjà créé)
└── stores/
    └── usePlatformAuthStore.ts (nouveau)
```

### 6.4 Migrations

```
backend/migrations/
├── 037_add_platform_roles.sql
├── 038_add_is_platform_user.sql
├── 039_bootstrap_super_admin.sql
└── 040_create_platform_audit_logs.sql
```

---

## 7. CONCLUSION

### 7.1 Faisabilité

✅ **Architecture compatible**:
- Ajout de rôles = simple ENUM
- Séparation platform/tenant = nouvelle table
- JWT existant = extensible

✅ **Rétrocompatibilité**:
- Aucune modification breaking
- Colonnes avec DEFAULT
- Tables séparées

### 7.2 Complexité

🟡 **Moyenne**:
- 15 phases bien définies
- Chaque phase indépendante
- Tests requis à chaque étape

### 7.3 Prochaines étapes

**Phase 2** — Nouveaux rôles:
- Migration SQL
- Update types/enums
- Validation

**Phase 3** — Platform users:
- Ajout colonne is_platform_user
- Index
- Migration

**Phase 4** — Bootstrap super admin:
- Migration idempotente
- Variables d'environnement
- Création automatique

---

## 8. QUESTIONS OUVERTES

1. **JWT séparés?** — Un seul JWT avec `is_platform_user` ou deux secrets différents?
2. **MFA obligatoire?** — Pour quels rôles? (super_admin, finance_admin)
3. **Password policy?** — Exigences pour comptes platform?
4. **Session management?** — Durée de vie JWT platform vs tenant?
5. **Audit retention?** — Combien de temps garder les logs?

---

**Rapport généré le**: 2026-06-22  
**Statut**: Phase 1 complétée — Prêt pour Phase 2