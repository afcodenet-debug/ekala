# AUDIT SUPER ADMIN PLATFORM — PHASE 1

**Date**: 22 Juin 2026  
**Version**: 1.0  
**Statut**: AUDIT COMPLET — AVANT CODAGE

---

## 📋 SOMMAIRE

Ce document présente l'audit complet du système existant avant l'implémentation du Super Admin Platform. Il couvre :

- Schéma actuel des tables
- Rôles et permissions existants
- Architecture de synchronisation
- Risques identifiés
- Dépendances
- Impacts potentiels

**AUCUNE MODIFICATION DE CODE** — Rapport d'analyse uniquement.

---

## 🏗️ SCHÉMA ACTUEL

### Tables Principales

#### 1. users
```sql
CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    email               TEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    full_name           TEXT NOT NULL,
    phone               TEXT,
    role                TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff')),
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','invited','deleted')),
    email_verified      INTEGER NOT NULL DEFAULT 0,
    last_login_at       TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    remote_id           INTEGER,
    business_id         TEXT
);
```

**Colonnes clés**:
- `role`: owner, admin, manager, cashier, waiter, staff
- `status`: active, suspended, invited, deleted
- `remote_id`: ID Supabase pour sync
- `business_id`: ID métier

**Index**:
- `idx_users_remote_id` sur remote_id
- `idx_users_business_id` sur business_id

**Risques**:
- ⚠️ Pas de colonne `tenant_id` directe (relation via tenant_users)
- ⚠️ Pas de rôle `super_admin`
- ⚠️ Pas de flag `is_platform_admin`

---

#### 2. tenants
```sql
CREATE TABLE IF NOT EXISTS tenants (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    slug                TEXT UNIQUE,
    name                TEXT NOT NULL,
    legal_name          TEXT,
    owner_email         TEXT NOT NULL,
    owner_phone         TEXT,
    contact_email       TEXT,
    contact_phone       TEXT,
    country             TEXT NOT NULL DEFAULT 'ZM',
    city                TEXT,
    address             TEXT,
    logo_url            TEXT,
    primary_color       TEXT DEFAULT '#D4AF37',
    default_currency    TEXT NOT NULL DEFAULT 'ZMW',
    default_locale      TEXT NOT NULL DEFAULT 'fr',
    timezone            TEXT NOT NULL DEFAULT 'Africa/Lusaka',
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled','trial')),
    is_provisioned      INTEGER NOT NULL DEFAULT 0,
    provisioned_at      TEXT,
    internal_notes      TEXT,
    remote_id           INTEGER,
    business_id         TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Colonnes clés**:
- `status`: active, suspended, cancelled, trial
- `is_provisioned`: 0 ou 1
- `remote_id`: ID Supabase
- `business_id`: ID métier

**Risques**:
- ⚠️ Pas de colonne `super_admin_id` pour traçabilité
- ⚠️ Pas de colonne `suspended_at` pour historique
- ⚠️ Pas de colonne `suspension_reason` pour audit

---

#### 3. tenant_users
```sql
CREATE TABLE IF NOT EXISTS tenant_users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff')),
    is_default          INTEGER NOT NULL DEFAULT 0,
    is_active           INTEGER NOT NULL DEFAULT 1,
    invited_at          TEXT,
    joined_at           TEXT,
    remote_id           INTEGER,
    business_id         TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, user_id)
);
```

**Colonnes clés**:
- `role`: owner, admin, manager, cashier, waiter, staff
- `is_default`: utilisateur par défaut du tenant
- `is_active`: 0 ou 1

**Risques**:
- ⚠️ Pas de support pour super_admin (pas de tenant_id NULL)
- ⚠️ Pas de colonne `permissions` pour droits fins
- ⚠️ Pas de colonne `last_platform_access` pour super_admin

---

#### 4. subscriptions
```sql
CREATE TABLE IF NOT EXISTS subscriptions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id             INTEGER NOT NULL REFERENCES plans(id),
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','past_due','cancelled','expired','trial')),
    started_at          TEXT NOT NULL DEFAULT (datetime('now')),
    current_period_start TEXT NOT NULL DEFAULT (datetime('now')),
    current_period_end  TEXT NOT NULL DEFAULT (datetime('now','+30 days')),
    trial_started_at    TEXT,
    trial_ends_at       TEXT,
    cancelled_at        TEXT,
    cancel_reason       TEXT,
    auto_renew          INTEGER NOT NULL DEFAULT 1,
    payment_method      TEXT,
    payment_reference   TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Colonnes clés**:
- `status`: pending, active, past_due, cancelled, expired, trial
- `auto_renew`: 0 ou 1
- `payment_method`: mobile_money, card, cash
- `payment_reference`: référence externe

**Risques**:
- ⚠️ Pas de colonne `super_admin_notes` pour modifications manuelles
- ⚠️ Pas de colonne `last_modified_by` pour audit
- ⚠️ Pas de colonne `cancelled_by` pour traçabilité

---

#### 5. voucher_requests
```sql
CREATE TABLE IF NOT EXISTS voucher_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    voucher_code VARCHAR(50) UNIQUE NOT NULL,
    customer_email VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verification_deadline DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    verified_by INTEGER,
    verified_at DATETIME,
    remote_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Colonnes clés**:
- `status`: pending, payment_sent, verified, rejected, expired
- `voucher_code`: unique (EKA-{tenantId}-{random})
- `verification_deadline`: délai validation admin
- `expires_at`: délai expiration

**Risques**:
- ⚠️ Pas de colonne `rejection_reason` pour rejets
- ⚠️ Pas de colonne `notes` pour commentaires admin
- ⚠️ Pas de colonne `amount_cents` (montant manquant)

---

#### 6. voucher_audit_logs
```sql
CREATE TABLE IF NOT EXISTS voucher_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_request_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_id INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Actions possibles**:
- created
- payment_sent
- verified
- rejected
- expired

**Risques**:
- ⚠️ Pas de lien vers tenant_id directement
- ⚠️ Pas de metadata JSON pour détails
- ⚠️ Pas d'IP address pour audit

---

#### 7. sync_outbox (inféré du code)
```sql
-- Structure inférée depuis src/sync/core/dead-letter-queue.ts
CREATE TABLE IF NOT EXISTS sync_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    record_id INTEGER NOT NULL,
    payload TEXT NOT NULL, -- JSON
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed'))
);
```

**Risques**:
- ⚠️ Pas de colonne `tenant_id` pour filtrage
- ⚠️ Pas de colonne `priority` pour traitement urgent
- ⚠️ Pas de colonne `source` pour debugging

---

#### 8. sync_metadata (inféré)
```sql
-- Structure inférée depuis src/sync/sync-orchestrator-v2.ts
CREATE TABLE IF NOT EXISTS sync_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    last_sync_at TEXT NOT NULL,
    last_sync_status TEXT NOT NULL,
    records_synced INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(table_name)
);
```

**Risques**:
- ⚠️ Pas de colonne `tenant_id` pour sync par tenant
- ⚠️ Pas de colonne `direction` (push/pull)
- ⚠️ Pas de colonne `duration_ms` pour performance

---

#### 9. tenant_audit_log
```sql
CREATE TABLE IF NOT EXISTS tenant_audit_log (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    actor_user_id       INTEGER REFERENCES users(id),
    action              TEXT NOT NULL,
    entity_type         TEXT,
    entity_id           INTEGER,
    metadata            TEXT DEFAULT '{}',
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Actions possibles**:
- tenant_created
- tenant_updated
- tenant_suspended
- tenant_activated
- subscription_created
- subscription_cancelled
- voucher_verified
- voucher_rejected

**Risques**:
- ⚠️ Pas de colonne `ip_address` pour sécurité
- ⚠️ Pas de colonne `user_agent` pour debugging
- ⚠️ Pas d'index sur `created_at` pour requêtes temporelles

---

## 🔴 RÔLES EXISTANTS

### Hiérarchie Actuelle

```
owner (tenant-specific)
  └── admin (tenant-specific)
       └── manager (tenant-specific)
            └── cashier (tenant-specific)
                 └── waiter (tenant-specific)
                      └── staff (tenant-specific)
```

### Permissions par Rôle

| Rôle | Tenants | Billing | Users | Settings | POS |
|------|---------|---------|-------|----------|-----|
| owner | Son tenant | ✅ | ✅ | ✅ | ✅ |
| admin | Son tenant | ✅ | ✅ | ✅ | ✅ |
| manager | Son tenant | ❌ | ❌ | ❌ | ✅ |
| cashier | Son tenant | ❌ | ❌ | ❌ | ✅ |
| waiter | Son tenant | ❌ | ❌ | ❌ | ✅ |
| staff | Son tenant | ❌ | ❌ | ❌ | ✅ |

**Manque**:
- ❌ Pas de rôle `super_admin`
- ❌ Pas de permissions granulaires
- ❌ Pas de support pour accès multi-tenant

---

## ⚠️ RISQUES IDENTIFIÉS

### Risque 1: Isolement des tenants (CRITIQUE)

**Problème**:
```typescript
// Actuellement
const tenantId = req.user.tenant_id; // Depuis tenant_users
const tenants = await db('tenants').where('id', tenantId);
// Si super_admin: tenant_id = NULL → erreur
```

**Impact**:
- Super admin ne peut pas accéder aux tenants
- Filtre tenant_id NULL retourne rien

**Mitigation**:
- Ajouter flag `is_super_admin` dans users
- Skip filtre tenant_id si is_super_admin = true

---

### Risque 2: Synchronisation Super Admin (CRITIQUE)

**Problème**:
```
Super Admin valide un voucher
  ↓
SQLite: voucher.status = 'verified'
  ↓
Sync vers Supabase
  ↓
Supabase: voucher.status = 'verified'
  ↓
Pull Sync vers SQLite (tous les tenants)
  ↓
Tous les tenants voient le changement
```

**Impact**:
- Données sensibles exposées à tous les tenants
- Violation de l'isolation multi-tenant

**Mitigation**:
- Super Admin opère UNIQUEMENT sur Supabase
- Pas de sync vers SQLite des tenants
- Tables super_admin séparées dans Supabase

---

### Risque 3: Conflit de rôles (MOYEN)

**Problème**:
```
User A: owner du tenant 1
User B: owner du tenant 2
Les 2 tentent de devenir super_admin
```

**Impact**:
- Conflit de permissions
- Accès non autorisé

**Mitigation**:
- super_admin attribué manuellement (pas d'auto-promotion)
- Vérification explicite dans middleware

---

### Risque 4: Performance (MOYEN)

**Problème**:
```
Super Admin consulte /platform/tenants
  ↓
SELECT * FROM tenants (1000 tenants)
  ↓
SELECT * FROM subscriptions (1000 subscriptions)
  ↓
SELECT * FROM voucher_requests (5000 vouchers)
  ↓
Temps de réponse: 10s
```

**Impact**:
- UX dégradée
- Timeout possible

**Mitigation**:
- Pagination obligatoire
- Index sur status, created_at
- Cache Redis pour KPIs
- Requêtes optimisées

---

### Risque 5: Audit incomplet (FAIBLE)

**Problème**:
```
Super Admin suspend un tenant
  ↓
tenant_audit_log: action = 'tenant_suspended'
  ↓
Mais pas de:
  - IP address
  - User agent
  - Durée de la suspension
  - Raison détaillée
```

**Impact**:
- Audit incomplet
- Difficulté de debugging

**Mitigation**:
- Ajouter colonnes manquantes
- Logger toutes les actions critiques

---

## 📊 DÉPENDANCES

### Dépendances Externes

| Dépendance | Utilisation | Impact si cassé |
|------------|-------------|-----------------|
| SQLite | Source de vérité POS | ❌ CRITIQUE |
| Supabase | Sync cloud + Super Admin | ❌ CRITIQUE |
| SyncV2 | Synchronisation | ⚠️ MOYEN (retry) |
| Outbox Queue | Changements en attente | ⚠️ MOYEN (retry) |
| Email Service | Notifications | ✅ FAIBLE (best-effort) |

### Dépendances Internes

| Module | Dépend de | Impact |
|--------|-----------|--------|
| Super Admin Platform | SQLite + Supabase | CRITIQUE |
| Tenant Dashboard | SQLite uniquement | CRITIQUE |
| SyncV2 | SQLite + Supabase | CRITIQUE |
| Billing System | SQLite + Supabase | CRITIQUE |
| POS System | SQLite uniquement | CRITIQUE |

---

## 🎯 IMPACTS POTENTIELS

### Impact 1: Architecture

**Avant**:
```
┌─────────────────────────────────────┐
│         Tenant Dashboard             │
│  ┌───────────────────────────────┐  │
│  │  SQLite (Local)               │  │
│  │  Supabase (Cloud)             │  │
│  │  Sync Bidirectionnelle        │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Après**:
```
┌──────────────────────────────────────────────────────────┐
│                    Ekala Platform                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────┐    ┌────────────────────────┐  │
│  │  Super Admin Portal │    │   Tenant Dashboards    │  │
│  │  /platform/*        │    │   /dashboard/*         │  │
│  │                     │    │                        │  │
│  │  - Supabase only    │    │  - SQLite + Supabase   │  │
│  │  - No sync to SQLite│    │  - Bidirectional sync  │  │
│  │  - Global view      │    │  - Tenant isolation    │  │
│  └─────────────────────┘    └────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Supabase (Cloud)                                   │  │
│  │  - Super Admin tables                               │  │
│  │  - All tenants data                                 │  │
│  │  - Global audit logs                                │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  SQLite (Local per tenant)                          │  │
│  │  - POS data                                         │  │
│  │  - Inventory                                        │  │
│  │  - Sales                                            │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Impact**: Élevé (nouvelle couche architecturale)

---

### Impact 2: Sécurité

**Avant**:
```
User → Tenant Dashboard → SQLite
      ↓
      Supabase (sync)
```

**Après**:
```
Super Admin → /platform/* → Supabase (UNIQUEMENT)
Tenant User → /dashboard/* → SQLite + Supabase
```

**Impact**: Critique (isolation renforcée)

---

### Impact 3: Performance

**Ajouts**:
- Super Admin: Requêtes globales (1000+ tenants)
- Tenant Dashboard: Requêtes isolées (1 tenant)

**Impact**: Moyen (nécessite optimisation)

---

### Impact 4: Maintenance

**Ajouts**:
- 2 dashboards à maintenir
- 2 systèmes de sync (Super Admin vs Tenant)
- 2 jeux de tests

**Impact**: Élevé (complexité accrue)

---

## 📋 RECOMMANDATIONS

### Phase 2 — Rôles

1. **Ajouter colonne `is_super_admin` dans users**
   ```sql
   ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0;
   CREATE INDEX idx_users_is_super_admin ON users(is_super_admin) WHERE is_super_admin = 1;
   ```

2. **Créer table `platform_admins`**
   ```sql
   CREATE TABLE IF NOT EXISTS platform_admins (
       user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
       permissions TEXT DEFAULT '["*"]', -- JSON array
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       created_by INTEGER REFERENCES users(id)
   );
   ```

### Phase 3 — Authorization

1. **Créer middleware `requireSuperAdmin()`**
   - Vérifier JWT
   - Vérifier `is_super_admin = 1`
   - Bloquer accès aux routes tenant

2. **Séparer routes**
   ```
   /platform/* → requireSuperAdmin()
   /dashboard/* → requireTenantAuth()
   /api/* → requireAuth()
   ```

### Phase 4 — Platform Dashboard

1. **Créer layout dédié**
   - Sidebar fixe
   - Design moderne (Stripe-like)
   - Responsive

2. **Créer pages**
   - /platform/dashboard
   - /platform/tenants
   - /platform/subscriptions
   - /platform/vouchers
   - /platform/sync
   - /platform/audit-logs
   - /platform/settings

### Phase 5-9 — Fonctionnalités

1. **Tenant Management**
   - Liste, recherche, filtres
   - Actions: suspend, activate, view details
   - Pagination: 50 par page

2. **Voucher Validation**
   - Liste par statut
   - Actions: approve, reject
   - Audit log automatique

3. **Subscription Center**
   - KPIs: MRR, ARR, Active Tenants
   - Graphiques
   - Export CSV

4. **Sync Center**
   - Statut par tenant
   - Relance manuelle
   - Diagnostics

5. **Audit Logs**
   - Table `billing_audit_logs`
   - Filtres: action, date, tenant
   - Export CSV

---

## 📊 MATRICE D'IMPACT

| Composant | Impact Super Admin | Impact Tenant | Risque |
|-----------|-------------------|---------------|--------|
| users | Ajout colonne is_super_admin | Aucun | Faible |
| tenants | Ajout colonnes audit | Aucun | Faible |
| subscriptions | Lecture seule | Aucun | Faible |
| voucher_requests | Lecture/Écriture | Aucun | Moyen |
| sync_outbox | Ignorer pour Super Admin | Aucun | MOYEN |
| tenant_audit_log | Ajout actions super_admin | Aucun | Faible |

---

## ✅ CHECKLIST PRÉ-CODAGE

### Base de données
- [ ] Ajouter colonne `is_super_admin` dans users
- [ ] Créer table `platform_admins`
- [ ] Ajouter colonnes audit dans tenants
- [ ] Créer table `billing_audit_logs`
- [ ] Ajouter index sur `is_super_admin`

### Backend
- [ ] Créer middleware `requireSuperAdmin()`
- [ ] Créer routes `/platform/*`
- [ ] Créer services Super Admin
- [ ] Séparer sync Super Admin vs Tenant

### Frontend
- [ ] Créer layout `/platform/*`
- [ ] Créer pages Super Admin
- [ ] Design moderne (Stripe-like)
- [ ] Responsive

### Tests
- [ ] Tests unitaires middleware
- [ ] Tests intégration Super Admin
- [ ] Tests isolation tenants
- [ ] Tests performance

### Documentation
- [ ] Guide Super Admin
- [ ] Architecture Super Admin
- [ ] Procédures d'urgence

---

## 🚀 PLAN D'IMPLÉMENTATION

### Semaine 1: Foundation
- Jour 1-2: Migrations SQL
- Jour 3-4: Middleware + Routes
- Jour 5: Tests base

### Semaine 2: Dashboard
- Jour 1-2: Layout + Design
- Jour 3-4: Pages principales
- Jour 5: Tests UI

### Semaine 3: Fonctionnalités
- Jour 1-2: Tenant Management
- Jour 3-4: Voucher + Subscription
- Jour 5: Sync + Audit

### Semaine 4: Polish
- Jour 1-2: Tests intégration
- Jour 3-4: Documentation
- Jour 5: Déploiement

---

## 📚 RÉFÉRENCES

- `backend/migrations/012_saas_multitenant_schema.sql` — Schéma SaaS
- `backend/migrations/035_voucher_first_tables.sql` — Tables voucher
- `src/sync/sync-orchestrator-v2.ts` — Moteur sync
- `src/sync/core/generic-sync.service.ts` — Service sync
- `src/server/routes/admin.subscriptions.ts` — Routes admin existantes

---

**Audit Super Admin Platform terminé** ✅

**Aucune modification de code effectuée**  
**Prêt pour Phase 2 — Rôles**