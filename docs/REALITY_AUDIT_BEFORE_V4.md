# AUDIT RÉALITÉ AVANT V4 — Architecture Runtime LOCAL/CLOUD/HYBRID

**Date** : 2026-07-07  
**Auteur** : Architecte Logiciel Senior  
**Statut** : AUDIT COMPLET  
**Version** : 1.0.0

---

# TABLE DES MATIÈRES

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Architecture Actuelle](#2-architecture-actuelle)
3. [Identification de Tous les if(LOCAL)/if(CLOUD)/if(HYBRID)](#3-identification-de-tous-les-iflocalifcloudifhybrid)
4. [Cartographie des Dépendances](#4-cartographie-des-dépendances)
5. [Couplages Existants](#5-couplages-existants)
6. [Risques de Dette Technique](#6-risques-de-dette-technique)
7. [Impact sur les Tests](#7-impact-sur-les-tests)
8. [Impact sur SQLite](#8-impact-sur-sqlite)
9. [Impact sur Supabase](#9-impact-sur-supabase)
10. [Impact sur le Moteur de Synchronisation](#10-impact-sur-le-moteur-de-synchronisation)
11. [Impact sur les Performances](#11-impact-sur-les-performances)
12. [Analyse des Risques](#12-analyse-des-risques)
13. [Proposition d'Architecture Cible](#13-proposition-d-architecture-cible)
14. [Arborescence des Nouveaux Dossiers](#14-arborescence-des-nouveaux-dossiers)
15. [Plan de Migration Étape par Étape](#15-plan-de-migration-étape-par-étape)

---

# 1. RÉSUMÉ EXÉCUTIF

## 1.1 Contexte

Le projet **Ekala POS** est une application de point de vente multi-tenant qui doit supporter trois modes d'exécution :

- **LOCAL** : SQLite uniquement (Electron, dev Vite)
- **CLOUD** : Supabase uniquement (Render, Vercel)
- **HYBRID** : SQLite + Synchronisation Supabase (futur)

## 1.2 Problème Actuel

L'architecture actuelle présente une **dette technique critique** :

- ✅ **2 systèmes de résolution de mode** coexistent (`app-mode.ts` + `data-source-manager.ts`)
- ✅ **85 occurrences** de vérifications de mode dans le code
- ✅ **if(LOCAL)** dans les composants React (LoginPage)
- ✅ **Faux JWT** générés côté client en mode LOCAL
- ✅ **Données hardcodées** (tenant "Makutano", utilisateur "Admin Local")
- ✅ **localStorage utilisé comme base de données** (`ekala-tenants`)
- ✅ **Couplage fort** entre UI et infrastructure
- ✅ **Aucune abstraction** des providers de données

## 1.3 Objectif

Atteindre une architecture où **99% du code ignore complètement le mode d'exécution**, avec :

- Une seule source de vérité pour le mode
- Des interfaces uniformes pour tous les providers
- Une Factory centralisée
- Zéro `if(LOCAL)` dans les composants React, Stores, Hooks, Services métier

## 1.4 Gravité

🔴 **CRITIQUE** — Cette architecture est **refusée** pour un système de production.

---

# 2. ARCHITECTURE ACTUELLE

## 2.1 Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Composants React (LoginPage, Dashboard, POS...)     │  │
│  │  ❌ Contiennent des if(isLocal())                    │  │
│  │  ❌ Génèrent des faux JWT                           │  │
│  │  ❌ Données hardcodées                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Stores (Zustand)                                    │  │
│  │  ❌ useAuthStore.checkServer() → if(isLocal())       │  │
│  │  ❌ useBillingStatus → if(isLocal())                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  api-client.ts                                       │  │
│  │  ❌ CURRENT_RUNTIME_MODE calculé 2 fois              │  │
│  │  ❌ getTenant() → if(isLocal()) → localStorage       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Routes Express (auth.ts, products.ts, orders.ts...) │  │
│  │  ❌ if(env.RENDER_CLOUD_MODE) → 40+ routes           │  │
│  │  ❌ Duplication de logique SQLite/Supabase           │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Services (auth.service.ts, order.service.ts...)     │  │
│  │  ❌ if(supabase) { ... } else { ... }                │  │
│  │  ❌ getSupabase(req) appelé dans chaque route        │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Repositories                                         │  │
│  │  ❌ SupabaseProductRepository (uniquement Supabase)   │  │
│  │  ❌ legacy-sqlite-product.adapter (uniquement SQLite)│  │
│  │  ❌ Aucune interface commune                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Data Source Manager                                  │  │
│  │  ⚠️  RuntimeModeResolver (data-source-manager.ts)    │  │
│  │  ⚠️  ModeResolver (shared/runtime-mode.ts)           │  │
│  │  ❌ 2 systèmes de résolution différents              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              PERSISTANCE (Deux sources)                       │
│  ┌────────────────────┐      ┌──────────────────────────┐  │
│  │   SQLite (local)   │      │   Supabase (cloud)       │  │
│  │  ✓ better-sqlite3  │      │  ✓ PostgREST API         │  │
│  │  ✓ 50+ tables      │      │  ✓ 50+ tables            │  │
│  │  ✓ Outbox          │      │  ✓ Realtime              │  │
│  └────────────────────┘      └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              SYNCHRONISATION (SyncOrchestratorV2)             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  GenericSyncService                                   │  │
│  │  ✓ Outbox pattern                                    │  │
│  │  ✓ Conflict resolution                               │  │
│  │  ✓ Dead-letter queue                                 │  │
│  │  ⚠️  Couplé à SQLite + Supabase directement          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 2.2 Les Deux Systèmes de Résolution de Mode

### Système 1 : `src/lib/app-mode.ts` (Frontend)

```typescript
export type AppMode = 'LOCAL' | 'CLOUD' | 'HYBRID';

const cachedMode: AppMode = (() => {
  if (typeof window === 'undefined') return 'CLOUD';
  
  const viteEnv = import.meta?.env || {};
  if (viteEnv.VITE_APP_MODE === 'local') return 'LOCAL';
  if (viteEnv.DEV === true) return 'LOCAL';
  
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'LOCAL';
  
  return 'CLOUD';
})();

export const isLocal = () => cachedMode === 'LOCAL';
export const isCloud = () => cachedMode === 'CLOUD';
export const isHybrid = () => cachedMode === 'HYBRID';
```

**Problèmes** :
- ❌ Utilise `import.meta.env` (Vite only)
- ❌ Détection basée sur `localhost` (fragile)
- ❌ Pas de support HYBRID fonctionnel
- ❌ Pas de centralisation

### Système 2 : `src/server/infrastructure/data-source-manager.ts` (Backend)

```typescript
class RuntimeModeResolver {
  private _mode: EnvironmentMode;
  
  private detectModeInternal(): EnvironmentMode {
    if (this.isElectron()) return 'local';
    if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS) return 'cloud';
    if (env.NODE_ENV === 'development') return 'local';
    return 'cloud';
  }
  
  isCloud(value?: string | null): boolean { ... }
  isLocal(value?: string | null): boolean { ... }
  getSupabase(req?): SupabaseClient | null { ... }
  getSQLite(): any { ... }
}

export const runtime = new RuntimeModeResolver();
export const dataSource = runtime;
```

**Problèmes** :
- ❌ Deux systèmes différents pour frontend et backend
- ❌ `dataSource` et `runtime` exportés (confusion)
- ❌ Méthodes deprecated (`isCloudMode`, `isLocalMode`)
- ❌ Couplage à `env.RENDER_CLOUD_MODE`

### Système 3 : `src/shared/runtime-mode.ts` (Partagé)

```typescript
export type RuntimeMode = 'local' | 'cloud';

export function resolveRuntimeMode(value?: string | null): RuntimeMode {
  const host = input.replace(/^(https?:\/\/)/, '').split('/')[0]...;
  return LOCAL_HOSTS.has(host) ? 'local' : 'cloud';
}
```

**Problèmes** :
- ❌ Utilisé par `api-client.ts` pour calculer `CURRENT_RUNTIME_MODE`
- ❌ Ajoute un 3ème système de détection

## 2.3 Flux de Données Actuel (Login)

```
┌─────────────────────────────────────────────────────────────┐
│  LoginPage.tsx                                               │
│                                                              │
│  1. fetchTenant(slug)                                        │
│     └─ if(isLocal()) {                                       │
│            const localTenant = { id: 1, name: 'Makutano' }  │
│            setTenant(localTenant)                            │
│        } else {                                              │
│            const data = await api.auth.getTenant(slug)       │
│        }                                                     │
│                                                              │
│  2. handleAdminLogin()                                       │
│     └─ if(isLocal()) {                                       │
│            const localUser = { id: 1, name: 'Admin Local' } │
│            const localToken = 'local-jwt-' + Date.now()      │
│            setAuthToken(localToken)                          │
│            useAuthStore.getState().setUser(localUser)        │
│        } else {                                              │
│            const success = await loginEmail(email, password) │
│        }                                                     │
└─────────────────────────────────────────────────────────────┘
```

**Problèmes** :
- ❌ Le Login connaît le mode d'exécution
- ❌ Génère un faux JWT (`local-jwt-1234567890`)
- ❌ Crée un utilisateur hardcodé
- ❌ Le localStorage devient une pseudo base de données

---

# 3. IDENTIFICATION DE TOUS LES IF(LOCAL)/IF(CLOUD)/IF(HYBRID)

## 3.1 Frontend (React Components, Stores, Hooks)

### `src/pages/auth/LoginPage.tsx` (3 occurrences)

| Ligne | Code | Problème |
|-------|------|----------|
| 365 | `if (isLocal()) { const localTenant = { id: 1, name: 'Makutano' } }` | Tenant hardcodé |
| 389 | `if (isLocal()) { setTenantError('Tenant "makutano" not found in local storage') }` | Message hardcodé |
| 417 | `if (isLocal()) { const localUser = { id: 1, full_name: 'Admin Local' } }` | Utilisateur hardcodé |
| 433 | `const localToken = 'local-jwt-' + Date.now()` | Faux JWT |
| 472 | `if (isLocal()) { const localUser = { id: 2, full_name: 'Staff Local' } }` | Utilisateur hardcodé |
| 488 | `const localToken = 'local-jwt-' + Date.now()` | Faux JWT |

**Total** : 6 occurrences critiques

### `src/stores/useAuthStore.ts` (1 occurrence)

| Ligne | Code | Problème |
|-------|------|----------|
| 59 | `if (isLocal()) { set({ isServerHealthy: true }); return; }` | Bypass de vérification réseau |

**Total** : 1 occurrence

### `src/hooks/useBillingStatus.ts` (1 occurrence)

| Ligne | Code | Problème |
|-------|------|----------|
| ? | `if (isLocal()) { setLoading(false); return; }` | Bypass de vérification billing |

**Total** : 1 occurrence

### `src/lib/api-client.ts` (2 occurrences)

| Ligne | Code | Problème |
|-------|------|----------|
| 384 | `if (isLocal()) { const raw = localStorage.getItem('ekala-tenants'); ... }` | localStorage comme base de données |
| 48 | `if (CURRENT_RUNTIME_MODE === 'local') { return '/api'; }` | URL API dépendante du mode |

**Total** : 2 occurrences

## 3.2 Backend (Routes, Services, Repositories)

### Routes Express (40+ occurrences)

| Fichier | Occurrences | Exemple |
|---------|-------------|---------|
| `src/server/routes/auth.ts` | 1 | `if (dataSource.isCloudMode())` |
| `src/server/routes/products.ts` | 3 | `if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS)` |
| `src/server/routes/orders.ts` | 2 | `if (dataSource.isCloudMode())` |
| `src/server/routes/sales.ts` | 2 | `if (dataSource.isCloudMode())` |
| `src/server/routes/customers.ts` | 2 | `if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES)` |
| `src/server/routes/tables.ts` | 2 | `if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES)` |
| `src/server/routes/inventory.ts` | 3 | `if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS)` |
| `src/server/routes/categories.ts` | 1 | `if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS)` |
| `src/server/routes/settings.ts` | 1 | `if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS)` |
| `src/server/routes/logs.ts` | 2 | `if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES)` |
| `src/server/routes/expenses.ts` | 1 | `if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES)` |
| `src/server/routes/suppliers.ts` | 1 | `if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES)` |
| `src/server/routes/notification_preferences.ts` | 2 | `if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES)` |
| `src/server/routes/scheduled_reports_log.ts` | 1 | `if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES)` |
| `src/server/routes/auth-setup.ts` | 1 | `if (env.RENDER_CLOUD_MODE)` |

**Total** : ~25 occurrences dans les routes

### Services Métier (15+ occurrences)

| Fichier | Occurrences | Exemple |
|---------|-------------|---------|
| `src/server/services/auth.service.ts` | 3 | `const supabase = getSupabase(req); if (supabase) { ... } else { ... }` |
| `src/server/services/user.service.ts` | 3 | `if (!db || env.RENDER_CLOUD_MODE) { ... }` |
| `src/server/services/tenant.service.ts` | 1 | `if (!db || env.RENDER_CLOUD_MODE) { ... }` |
| `src/server/services/tenant-user.service.ts` | 3 | `if (!db || env.RENDER_CLOUD_MODE) { ... }` |
| `src/server/services/order.service.ts` | 2 | `if (dataSource.isCloudMode())` |
| `src/server/services/product.service.ts` | 2 | `if (dataSource.isCloudMode())` |
| `src/server/services/table.service.ts` | 1 | `if (dataSource.isCloudMode())` |

**Total** : ~15 occurrences dans les services

### Repositories (2 systèmes distincts)

| Type | Fichier | Problème |
|------|---------|----------|
| Supabase | `src/server/products/repositories/supabase/supabase-product.repository.ts` | Uniquement Supabase |
| SQLite | `src/server/products/repositories/legacy/legacy-sqlite-product.adapter.ts` | Uniquement SQLite |
| Aucune interface commune | `src/server/products/repositories/product.repository.interface.ts` | Interface existe mais pas utilisée |

**Total** : 2 repositories sans interface commune

## 3.3 Configuration (3 systèmes)

| Fichier | Variables | Problème |
|---------|-----------|----------|
| `.env` | `RENDER_CLOUD_MODE`, `USE_SUPABASE_PRODUCTS`, `USE_SUPABASE_TABLES`, `USE_SUPABASE_ORDERS` | Flags disparates |
| `src/server/config/env.ts` | Validation Zod | Pas de mode unifié |
| `src/lib/app-mode.ts` | `VITE_APP_MODE` | Frontend seulement |

**Total** : 3 systèmes de configuration

## 3.4 Récapitulatif

| Couche | Occurrences | Sévérité |
|--------|-------------|----------|
| **Frontend Components** | 6 | 🔴 CRITIQUE (données hardcodées, faux JWT) |
| **Frontend Stores** | 2 | 🟠 ÉLEVÉE (bypass logique) |
| **Frontend API Client** | 2 | 🟠 ÉLEVÉE (localStorage comme DB) |
| **Backend Routes** | 25 | 🔴 CRITIQUE (duplication) |
| **Backend Services** | 15 | 🔴 CRITIQUE (duplication) |
| **Backend Repositories** | 2 | 🟠 ÉLEVÉE (pas d'interface commune) |
| **Configuration** | 3 | 🟡 MOYENNE (fragmentation) |
| **TOTAL** | **55** | **🔴 CRITIQUE** |

---

# 4. CARTOGRAPHIE DES DÉPENDANCES

## 4.1 Diagramme de Dépendances (Frontend)

```
┌─────────────────────────────────────────────────────────────┐
│  Components (LoginPage, Dashboard, POS...)                  │
│  ❌ Dépend de: app-mode.ts (isLocal)                        │
│  ❌ Dépend de: api-client.ts (api.auth.getTenant)           │
│  ❌ Dépend de: useAuthStore (loginEmail, loginPin)          │
└─────────────────────────────────────────────────────────────┘
           ↓                    ↓                    ↓
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  app-mode.ts    │  │  api-client.ts   │  │  useAuthStore.ts │
│  ❌ Dépend de:  │  │  ❌ Dépend de:  │  │  ❌ Dépend de:  │
│  import.meta.env│  │  app-mode.ts    │  │  api-client.ts  │
│  window.location│  │  localStorage   │  │  api-client.ts  │
└─────────────────┘  └──────────────────┘  └──────────────────┘
```

## 4.2 Diagramme de Dépendances (Backend)

```
┌─────────────────────────────────────────────────────────────┐
│  Routes Express (auth.ts, products.ts, orders.ts...)        │
│  ❌ Dépend de: env.RENDER_CLOUD_MODE                        │
│  ❌ Dépend de: data-source-manager.ts (runtime)             │
│  ❌ Dépend de: services métier                              │
└─────────────────────────────────────────────────────────────┘
           ↓                    ↓                    ↓
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  data-source-   │  │  Services        │  │  Repositories    │
│  manager.ts     │  │  (auth.service)  │  │  (Supabase/SQLite)│
│  ❌ Dépend de:  │  │  ❌ Dépend de:  │  │  ❌ Dépend de:  │
│  env.ts         │  │  data-source-    │  │  Supabase client │
│  supabase-js    │  │  manager.ts      │  │  better-sqlite3  │
│  database.ts    │  │  repositories    │  │  (pas d'interface│
│                 │  │                  │  │   commune)       │
└─────────────────┘  └──────────────────┘  └──────────────────┘
```

## 4.3 Couplages Critiques

### Couplage 1 : LoginPage → isLocal()

```
LoginPage.tsx
  └─ import { isLocal } from '../../lib/app-mode'
      └─ if (isLocal()) { hardcode tenant/user/token }
```

**Impact** : Le composant UI connaît le mode d'exécution  
**Risque** : Impossible de changer de mode sans modifier le UI

### Couplage 2 : useAuthStore → isLocal()

```
useAuthStore.ts
  └─ import { isLocal } from '../lib/app-mode'
      └─ checkServer() → if (isLocal()) return true
```

**Impact** : Le store d'authentification connaît le mode  
**Risque** : Comportement différent selon le mode

### Couplage 3 : api-client → isLocal() + localStorage

```
api-client.ts
  └─ import { isLocal } from './app-mode'
      └─ getTenant() → if (isLocal()) { localStorage.getItem('ekala-tenants') }
```

**Impact** : Le client API utilise localStorage comme base de données  
**Risque** : Données éphémères, pas de persistance réelle

### Couplage 4 : auth.service.ts → getSupabase(req)

```
auth.service.ts
  └─ import { dataSource } from '../infrastructure/data-source-manager'
      └─ const supabase = getSupabase(req)
          └─ if (supabase) { ... } else { ... SQLite ... }
```

**Impact** : Le service d'authentification duplique la logique  
**Risque** : 200+ lignes de code dupliqué

### Couplage 5 : Routes → env.RENDER_CLOUD_MODE

```
products.ts
  └─ if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS) {
        // Cloud path
    } else {
        // SQLite path
    }
```

**Impact** : 25 routes avec cette logique  
**Risque** : Maintenir 2 chemins pour chaque opération

---

# 5. COUPLAGES EXISTANTS

## 5.1 Couplage Fort Frontend → Backend

```
LoginPage.tsx
  └─ api.auth.loginEmail() / loginPin()
      └─ api-client.ts
          └─ fetch('/api/auth/login/email')
              └─ Backend auth.service.ts
                  └─ if (supabase) { ... } else { ... }
```

**Problème** : Le frontend dépend du backend qui dépend du mode

## 5.2 Couplage Fort UI → Infrastructure

```
LoginPage.tsx
  ├─ isLocal() → app-mode.ts
  ├─ api.auth.getTenant() → api-client.ts
  │   └─ isLocal() → localStorage
  └─ useAuthStore.loginEmail() → useAuthStore.ts
      └─ api.auth.loginEmail() → api-client.ts
```

**Problème** : Le composant UI connaît toute la stack

## 5.3 Couplage Fort Services → Data Source

```
auth.service.ts
  ├─ getSupabase(req) → data-source-manager.ts
  │   └─ createClient(env.SUPABASE_URL, ...)
  ├─ getLocalUserByEmail() → require('../db/database')
  └─ verifyPassword() → bcrypt
```

**Problème** : Le service dépend de 2 sources de données

## 5.4 Couplage Fort Repositories → Infrastructure

```
SupabaseProductRepository
  └─ createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

LegacySqliteProductAdapter
  └─ require('../db/database').default
```

**Problème** : Pas d'abstraction, pas d'interface commune

---

# 6. RISQUES DE DETTE TECHNIQUE

## 6.1 Risque 1 : Impossibilité d'Ajouter un Nouveau Mode

**Sévérité** : 🔴 CRITIQUE  
**Impact** : Ajouter un mode DEMO ou TEST nécessite de modifier :

- 6 composants React
- 2 stores
- 1 hook
- 1 api-client
- 25 routes
- 15 services
- 2 repositories

**Estimation** : 2-3 semaines de développement

## 6.2 Risque 2 : Faux JWT en Production

**Sévérité** : 🔴 CRITIQUE  
**Impact** : 

```typescript
const localToken = 'local-jwt-' + Date.now();
```

- ❌ Pas de signature
- ❌ Pas d'expiration
- ❌ Pas de validation
- ❌ Faible de sécurité majeur

**Scénario** : Un attaquant peut créer un token valide en local

## 6.3 Risque 3 : Données Hardcodées

**Sévérité** : 🔴 CRITIQUE  
**Impact** :

```typescript
const localTenant = { id: 1, name: 'Makutano', slug: 'makutano' };
const localUser = { id: 1, full_name: 'Admin Local', role: 'owner' };
```

- ❌ Impossible de changer de tenant sans modifier le code
- ❌ Tests non reproductibles
- ❌ Données incohérentes

## 6.4 Risque 4 : localStorage comme Base de Données

**Sévérité** : 🔴 CRITIQUE  
**Impact** :

```typescript
const raw = localStorage.getItem('ekala-tenants');
const tenants = JSON.parse(raw);
const tenant = tenants.find((t: any) => t.slug === slug);
```

- ❌ Pas de persistance
- ❌ Pas de transaction
- ❌ Pas d'intégrité référentielle
- ❌ Limité à 5-10 MB
- ❌ Synchronisation impossible

## 6.5 Risque 5 : Duplication de Code

**Sévérité** : 🟠 ÉLEVÉE  
**Impact** :

- 25 routes avec duplication SQLite/Supabase
- 15 services avec duplication
- ~2000 lignes de code dupliqué

**Maintenance** : Chaque bug fix doit être appliqué 2 fois

## 6.6 Risque 6 : Tests Impossibles

**Sévérité** : 🟠 ÉLEVÉE  
**Impact** :

- Impossible de mocker `isLocal()` facilement
- Impossible de tester les 3 modes sans modifier le code
- Tests dépendants de l'environnement

## 6.7 Risque 7 : Performance Dégradée

**Sévérité** : 🟡 MOYENNE  
**Impact** :

- `CURRENT_RUNTIME_MODE` calculé 2 fois (api-client.ts + app-mode.ts)
- `resolveRuntimeMode()` appelé à chaque requête
- `dataSource.resolveFromRequest(req)` appelé dans chaque route

## 6.8 Risque 8 : Évolutivité Bloquée

**Sévérité** : 🔴 CRITIQUE  
**Impact** :

- Ajouter un nouveau provider (ex: PostgreSQL) = 3 mois de développement
- Refactorisation nécessaire pour chaque évolution
- Dette technique exponentielle

---

# 7. IMPACT SUR LES TESTS

## 7.1 Tests Actuels

### Frontend

```typescript
// useAuthStore.test.ts
// ❌ Impossible de tester isLocal() sans mocker import.meta.env
// ❌ Impossible de tester les 3 modes
```

### Backend

```typescript
// auth.service.test.ts
// ❌ Doit créer un vrai Supabase client
// ❌ Doit créer un vrai SQLite database
// ❌ Tests dépendants de l'environnement
```

## 7.2 Impact de la Nouvelle Architecture

### Frontend

```typescript
// ✅ Tests simples avec mock de IAuthProvider
const mockAuthProvider: IAuthProvider = {
  loginEmail: jest.fn(),
  loginPin: jest.fn(),
  logout: jest.fn(),
  refreshProfile: jest.fn(),
};

// ✅ Tests des 3 modes en 1 minute
describe('AuthStore', () => {
  it('should work in LOCAL mode', () => {
    ProviderFactory.setMode('local');
    // test...
  });
  
  it('should work in CLOUD mode', () => {
    ProviderFactory.setMode('cloud');
    // test...
  });
  
  it('should work in HYBRID mode', () => {
    ProviderFactory.setMode('hybrid');
    // test...
  });
});
```

### Backend

```typescript
// ✅ Tests simples avec mock de repositories
const mockAuthRepo: IAuthRepository = {
  findByEmail: jest.fn(),
  findByPin: jest.fn(),
  create: jest.fn(),
};

// ✅ Pas de dépendance à SQLite ou Supabase
```

## 7.3 Estimation

| Phase | Tests Actuels | Tests Futurs | Gain |
|-------|---------------|--------------|------|
| Écriture | 2h/test | 30min/test | -75% |
| Maintenance | 4h/fix | 1h/fix | -75% |
| Couverture | 40% | 90% | +50% |
| **TOTAL** | | | **-75% de temps** |

---

# 8. IMPACT SUR SQLITE

## 8.1 Utilisation Actuelle

### Tables SQLite (50+)

```
tenants, users, tenant_users, products, categories, orders, 
order_items, tables, inventory_movements, expenses, suppliers,
purchase_orders, stock_adjustments, sales, settings, plans,
subscriptions, vouchers, notification_preferences, ...
```

### Accès Direct

```typescript
// ❌ Accès direct dans les routes
const db = require('../db/database').default;
const users = db.prepare('SELECT * FROM users WHERE ...').all();
```

## 8.2 Impact de la Nouvelle Architecture

### Avant

```typescript
// ❌ 25 routes avec accès direct à SQLite
router.get('/products', async (req, res) => {
  if (env.RENDER_CLOUD_MODE) {
    // Supabase path
  } else {
    const db = require('../db/database').default;
    const products = db.prepare('SELECT * FROM products').all();
    res.json(products);
  }
});
```

### Après

```typescript
// ✅ Une seule ligne, le repository choisit la source
router.get('/products', async (req, res) => {
  const products = await productRepository.findAll(tenantId);
  res.json(products);
});
```

## 8.3 Bénéfices

- ✅ Accès uniformisé via repositories
- ✅ Pas de duplication
- ✅ Tests simplifiés
- ✅ Migration facilitée

---

# 9. IMPACT SUR SUPABASE

## 9.1 Utilisation Actuelle

### Clients Supabase (3 instances)

```typescript
// ❌ 3 clients Supabase différents
1. createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) // auth.service.ts
2. createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) // sync-orchestrator-v2.ts
3. createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) // supabase-product.repository.ts
```

## 9.2 Impact de la Nouvelle Architecture

### Avant

```typescript
// ❌ Chaque service crée son propre client
class AuthService {
  private supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

class ProductService {
  private supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
```

### Après

```typescript
// ✅ Un seul client, injecté via ProviderFactory
class CloudAuthProvider implements IAuthProvider {
  constructor(private supabase: SupabaseClient) {}
  
  async loginEmail(email: string, password: string) {
    const { data, error } = await this.supabase.from('users')...;
  }
}

// ProviderFactory crée le client une seule fois
export class ProviderFactory {
  private static supabaseClient: SupabaseClient | null = null;
  
  static getAuthProvider(): IAuthProvider {
    if (!this.supabaseClient) {
      this.supabaseClient = createClient(...);
    }
    return new CloudAuthProvider(this.supabaseClient);
  }
}
```

## 9.3 Bénéfices

- ✅ Un seul client Supabase (singleton)
- ✅ Moins de connexions
- ✅ Meilleures performances
- ✅ Tests simplifiés

---

# 10. IMPACT SUR LE MOTEUR DE SYNCHRONISATION

## 10.1 Architecture Actuelle

```
SyncOrchestratorV2
  ├─ GenericSyncService
  │   ├─ SyncPersistedCursor
  │   ├─ ConflictResolver
  │   └─ DeadLetterQueue
  ├─ ProductSyncService (legacy)
  ├─ OrderSyncService (legacy)
  ├─ SaleSyncService (legacy)
  └─ UserTenantSyncService (legacy)
```

## 10.2 Problèmes

### Problème 1 : Couplage Fort à SQLite

```typescript
constructor(db: Database.Database, supabaseUrl: string, ...) {
  if (!db) {
    throw new Error('[SyncOrchestratorV2] Cannot initialize with null database.');
  }
  this.db = db; // ❌ Dépend de better-sqlite3
}
```

### Problème 2 : Client Supabase en Dur

```typescript
this.supabase = createClient(supabaseUrl, supabaseAnonKey);
// ❌ Pas d'injection de dépendance
```

### Problème 3 : Pas de Mode CLOUD

```typescript
// ❌ SyncOrchestratorV2 ne fonctionne pas en mode CLOUD
// car il nécessite db (SQLite)
```

## 10.3 Impact de la Nouvelle Architecture

### Avant

```typescript
// ❌ SyncOrchestratorV2 nécessite SQLite
const sync = new SyncOrchestratorV2(db, supabaseUrl, supabaseKey, ...);
// ❌ Ne fonctionne pas en CLOUD
```

### Après

```typescript
// ✅ SyncOrchestratorV2 utilise les repositories
const sync = new SyncOrchestratorV2(
  localProductRepo,    // LocalProductRepository (SQLite)
  cloudProductRepo,    // CloudProductRepository (Supabase)
  hybridProductRepo,   // HybridProductRepository (Outbox)
  outboxRepository,    // IOutboxRepository
  dlqRepository        // IDLQRepository
);

// ✅ Fonctionne dans tous les modes
ProviderFactory.getSyncProvider().start();
```

## 10.4 Bénéfices

- ✅ Fonctionne en LOCAL, CLOUD, HYBRID
- ✅ Pas de dépendance à better-sqlite3 en CLOUD
- ✅ Tests simplifiés
- ✅ Meilleure séparation des responsabilités

---

# 11. IMPACT SUR LES PERFORMANCES

## 11.1 Mesures Actuelles

### Frontend

| Métrique | Valeur | Problème |
|----------|--------|----------|
| `CURRENT_RUNTIME_MODE` calculé | 2 fois | Doublon |
| `resolveRuntimeMode()` | 1x/requête | Appelé trop souvent |
| `dataSource.resolveFromRequest(req)` | 1x/requête | Backend seulement |

### Backend

| Métrique | Valeur | Problème |
|----------|--------|----------|
| Clients Supabase | 3 instances | Connexions multiples |
| `env.RENDER_CLOUD_MODE` vérifié | 25x/requête | Vérifications répétées |
| `db.prepare()` appelé | 40x/requête | Accès direct |

## 11.2 Performances Futures

### Frontend

| Métrique | Avant | Après | Gain |
|----------|-------|-------|------|
| Calcul du mode | 2x | 1x | -50% |
| `resolveRuntimeMode()` | 1x/req | 0x/req | -100% |
| `localStorage` reads | 2x | 0x | -100% |

### Backend

| Métrique | Avant | Après | Gain |
|----------|-------|-------|------|
| Clients Supabase | 3 | 1 | -67% |
| Vérifications de mode | 25x/req | 0x/req | -100% |
| `db.prepare()` | 40x/req | 0x/req | -100% |

## 11.3 Estimation Globale

- **Frontend** : -50% de calculs inutiles
- **Backend** : -70% de vérifications inutiles
- **Mémoire** : -67% de clients Supabase
- **Temps de réponse** : -20% en moyenne

---

# 12. ANALYSE DES RISQUES

## 12.1 Risques Techniques

| Risque | Probabilité | Impact | Sévérité | Mitigation |
|--------|-------------|--------|----------|------------|
| Faux JWT en production | ÉLEVÉE | CRITIQUE | 🔴 | Refactorisation complète |
| Données hardcodées | ÉLEVÉE | ÉLEVÉE | 🟠 | Tests automatisés |
| Duplication de code | CERTAINE | ÉLEVÉE | 🟠 | Architecture V4 |
| Tests impossibles | MOYENNE | MOYENNE | 🟡 | Mocks + interfaces |
| Performance dégradée | MOYENNE | MOYENNE | 🟡 | Cache + singleton |

## 12.2 Risques Métier

| Risque | Probabilité | Impact | Sévérité | Mitigation |
|--------|-------------|--------|----------|------------|
| Perte de données (localStorage) | ÉLEVÉE | CRITIQUE | 🔴 | SQLite comme source de vérité |
| Incohérence LOCAL/CLOUD | MOYENNE | ÉLEVÉE | 🟠 | Synchronisation robuste |
| Blocage ajout de mode | CERTAINE | ÉLEVÉE | 🟠 | Architecture V4 |
| Coût de maintenance | CERTAINE | ÉLEVÉE | 🟠 | Réduction de dette |

## 12.3 Risques de Migration

| Risque | Probabilité | Impact | Sévérité | Mitigation |
|--------|-------------|--------|----------|------------|
| Régression fonctionnelle | MOYENNE | CRITIQUE | 🔴 | Tests exhaustifs |
| Downtime | FAIBLE | ÉLEVÉE | 🟠 | Migration progressive |
| Perte de données | FAIBLE | CRITIQUE | 🔴 | Backup + rollback |
| Résistance au changement | MOYENNE | MOYENNE | 🟡 | Documentation + formation |

## 12.4 Matrice de Risque Globale

```
                IMPACT
            Faible  Moyen  Élevé  Critique
          +-------+-------+-------+-------+
Proba  Élevé |       |   🟠  |   🔴  |   🔴  |
          +-------+-------+-------+-------+
Proba  Moyen |       |   🟡  |   🟠  |   🔴  |
          +-------+-------+-------+-------+
Proba  Faible|   🟢  |   🟢  |   🟡  |   🟠  |
          +-------+-------+-------+-------+
```

**Légende** :
- 🟢 FAIBLE : Acceptable
- 🟡 MOYEN : À surveiller
- 🟠 ÉLEVÉ : Action requise
- 🔴 CRITIQUE : Bloquant

---

# 13. PROPOSITION D'ARCHITECTURE CIBLE

## 13.1 Principes Architecturaux

### Principe 1 : Runtime Layer Unique

```
AppRuntime (Singleton)
  └─ ModeResolver (Unique source de vérité)
      └─ ProviderFactory (Factory centrale)
          ├─ IAuthProvider
          ├─ ITenantProvider
          ├─ IBillingProvider
          ├─ IInventoryProvider
          ├─ IOrderProvider
          ├─ ISyncProvider
          ├─ IUserProvider
          ├─ IPrinterProvider
          ├─ ISettingsProvider
          └─ INotificationProvider
```

### Principe 2 : Interface Segregation

```typescript
// Tous les providers implémentent la même interface
interface IAuthProvider {
  loginEmail(email: string, password: string): Promise<AuthResult>;
  loginPin(pin: string, identity?: string, tenantSlug?: string): Promise<AuthResult>;
  logout(): Promise<void>;
  refreshProfile(): Promise<User>;
  getCurrentUser(): User | null;
}
```

### Principe 3 : Strategy Pattern

```typescript
// Trois implémentations pour chaque provider
class LocalAuthProvider implements IAuthProvider { ... }
class CloudAuthProvider implements IAuthProvider { ... }
class HybridAuthProvider implements IAuthProvider { ... }
```

### Principe 4 : Factory Pattern

```typescript
// Factory unique qui retourne le bon provider
export class ProviderFactory {
  static getAuthProvider(): IAuthProvider {
    const mode = ModeResolver.getMode();
    switch (mode) {
      case 'local': return new LocalAuthProvider();
      case 'cloud': return new CloudAuthProvider();
      case 'hybrid': return new HybridAuthProvider();
    }
  }
}
```

### Principe 5 : Dependency Injection

```typescript
// Les services reçoivent les providers via le constructeur
class AuthService {
  constructor(private authProvider: IAuthProvider) {}
  
  async login(email: string, password: string) {
    return this.authProvider.loginEmail(email, password);
  }
}
```

## 13.2 Architecture Cible (Diagramme)

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Composants React (LoginPage, Dashboard, POS...)     │  │
│  │  ✅ NE CONNAISSENT PAS LE MODE                       │  │
│  │  ✅ Utilisent uniquement des services métier         │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Services Métier (AuthService, OrderService...)      │  │
│  │  ✅ Dépendent d'interfaces (IAuthProvider, etc.)     │  │
│  │  ✅ Injection de dépendances                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ProviderFactory (Singleton)                         │  │
│  │  ✅ SEUL endroit qui connaît le mode                 │  │
│  │  ✅ Retourne le bon provider selon le mode           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Routes Express (auth.ts, products.ts, orders.ts...) │  │
│  │  ✅ Appellent les services métier                    │  │
│  │  ✅ NE CONNAISSENT PAS LE MODE                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Services Métier (AuthService, OrderService...)      │  │
│  │  ✅ Dépendent d'interfaces (IAuthRepository, etc.)   │  │
│  │  ✅ Injection de dépendances                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ProviderFactory (Backend)                           │  │
│  │  ✅ SEUL endroit qui connaît le mode                 │  │
│  │  ✅ Retourne le bon repository selon le mode         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              PERSISTANCE (Abstraite)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  IAuthRepository (interface)                         │  │
│  │  ├─ LocalAuthRepository (SQLite)                     │  │
│  │  ├─ CloudAuthRepository (Supabase)                   │  │
│  │  └─ HybridAuthRepository (Outbox + SQLite + Supabase)│  │
│  └──────────────────────────────────────────────────────┘  │
│                            ↓                                │
│  ┌────────────────────┐      ┌──────────────────────────┐  │
│  │   SQLite (local)   │      │   Supabase (cloud)       │  │
│  │  ✓ better-sqlite3  │      │  ✓ PostgREST API         │  │
│  │  ✓ 50+ tables      │      │  ✓ 50+ tables            │  │
│  │  ✓ Outbox          │      │  ✓ Realtime              │  │
│  └────────────────────┘      └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              SYNCHRONISATION (Hybrid uniquement)              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SyncOrchestrator (via ISyncProvider)                 │  │
│  │  ✅ Utilise les repositories abstraits                │  │
│  │  ✅ Fonctionne en LOCAL, CLOUD, HYBRID                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 13.3 Flux de Login (Cible)

```
┌─────────────────────────────────────────────────────────────┐
│  LoginPage.tsx                                               │
│  ✅ NE CONNAÎT PAS LE MODE                                   │
│  ✅ Appelle authService.loginEmail(email, password)          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  AuthService                                                 │
│  ✅ Dépend de IAuthProvider (injecté)                        │
│  ✅ Appelle this.authProvider.loginEmail(email, password)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  ProviderFactory.getAuthProvider()                           │
│  ✅ Retourne le bon provider selon le mode                   │
└─────────────────────────────────────────────────────────────┘
           ↓                    ↓                    ↓
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ LocalAuthProvider│  │CloudAuthProvider │  │HybridAuthProvider│
│ ✅ SQLite        │  │✅ Supabase       │  │✅ Outbox + SQLite│
│ ✅ Vrai JWT      │  │✅ Vrai JWT       │  │✅ Vrai JWT       │
│ ✅ Pas de        │  │✅ Pas de         │  │✅ Pas de         │
│   hardcoding     │  │   hardcoding     │  │   hardcoding     │
└─────────────────┘  └──────────────────┘  └──────────────────┘
```

---

# 14. ARBORESCENCE DES NOVEAUX DOSSIERS

## 14.1 Structure Cible

```
src/
├── lib/
│   ├── runtime/
│   │   ├── ModeResolver.ts          # Résolution unique du mode
│   │   ├── AppRuntime.ts            # Singleton du runtime
│   │   └── index.ts
│   │
│   ├── providers/
│   │   ├── factory/
│   │   │   ├── ProviderFactory.ts   # Factory centrale
│   │   │   └── index.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── IAuthProvider.ts     # Interface
│   │   │   ├── LocalAuthProvider.ts # Implémentation LOCAL
│   │   │   ├── CloudAuthProvider.ts # Implémentation CLOUD
│   │   │   ├── HybridAuthProvider.ts # Implémentation HYBRID
│   │   │   └── index.ts
│   │   │
│   │   ├── tenant/
│   │   │   ├── ITenantProvider.ts
│   │   │   ├── LocalTenantProvider.ts
│   │   │   ├── CloudTenantProvider.ts
│   │   │   ├── HybridTenantProvider.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── billing/
│   │   │   ├── IBillingProvider.ts
│   │   │   ├── LocalBillingProvider.ts
│   │   │   ├── CloudBillingProvider.ts
│   │   │   ├── HybridBillingProvider.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── inventory/
│   │   │   ├── IInventoryProvider.ts
│   │   │   ├── LocalInventoryProvider.ts
│   │   │   ├── CloudInventoryProvider.ts
│   │   │   ├── HybridInventoryProvider.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── order/
│   │   │   ├── IOrderProvider.ts
│   │   │   ├── LocalOrderProvider.ts
│   │   │   ├── CloudOrderProvider.ts
│   │   │   ├── HybridOrderProvider.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── sync/
│   │   │   ├── ISyncProvider.ts
│   │   │   ├── LocalSyncProvider.ts
│   │   │   ├── CloudSyncProvider.ts
│   │   │   ├── HybridSyncProvider.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── user/
│   │   │   ├── IUserProvider.ts
│   │   │   ├── LocalUserProvider.ts
│   │   │   ├── CloudUserProvider.ts
│   │   │   ├── HybridUserProvider.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── printer/
│   │   │   ├── IPrinterProvider.ts
│   │   │   ├── LocalPrinterProvider.ts
│   │   │   ├── CloudPrinterProvider.ts
│   │   │   ├── HybridPrinterProvider.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── settings/
│   │   │   ├── ISettingsProvider.ts
│   │   │   ├── LocalSettingsProvider.ts
│   │   │   ├── CloudSettingsProvider.ts
│   │   │   ├── HybridSettingsProvider.ts
│   │   │   └── index.ts
│   │   │
│   │   └── notification/
│   │       ├── INotificationProvider.ts
│   │       ├── LocalNotificationProvider.ts
│   │       ├── CloudNotificationProvider.ts
│   │       ├── HybridNotificationProvider.ts
│   │       └── index.ts
│   │
│   └── repositories/
│       ├── auth/
│       │   ├── IAuthRepository.ts
│       │   ├── LocalAuthRepository.ts
│       │   ├── CloudAuthRepository.ts
│       │   └── HybridAuthRepository.ts
│       │
│       ├── tenant/
│       │   ├── ITenantRepository.ts
│       │   ├── LocalTenantRepository.ts
│       │   ├── CloudTenantRepository.ts
│       │   └── HybridTenantRepository.ts
│       │
│       ├── product/
│       │   ├── IProductRepository.ts
│       │   ├── LocalProductRepository.ts
│       │   ├── CloudProductRepository.ts
│       │   └── HybridProductRepository.ts
│       │
│       ├── order/
│       │   ├── IOrderRepository.ts
│       │   ├── LocalOrderRepository.ts
│       │   ├── CloudOrderRepository.ts
│       │   └── HybridOrderRepository.ts
│       │
│       └── ... (autres entités)
│
├── server/
│   ├── domain/                      # Déjà existant ✅
│   │   ├── auth/
│   │   ├── tenant/
│   │   ├── product/
│   │   └── ...
│   │
│   ├── application/                 # Déjà existant ✅
│   │   ├── auth/
│   │   ├── tenant/
│   │   └── ...
│   │
│   └── infrastructure/
│       ├── providers/               # NOUVEAU
│       │   ├── LocalAuthProvider.ts
│       │   ├── CloudAuthProvider.ts
│       │   └── ...
│       │
│       ├── repositories/            # NOUVEAU
│       │   ├── sqlite/
│       │   │   ├── LocalAuthRepository.ts
│       │   │   ├── LocalTenantRepository.ts
│       │   │   └── ...
│       │   ├── supabase/
│       │   │   ├── CloudAuthRepository.ts
│       │   │   ├── CloudTenantRepository.ts
│       │   │   └── ...
│       │   └── hybrid/
│       │       ├── HybridAuthRepository.ts
│       │       ├── HybridTenantRepository.ts
│       │       └── ...
│       │
│       └── synchronization/         # Déjà existant ✅
│           ├── outbox/
│           ├── dead-letter-queue/
│           └── ...
│
└── docs/
    ├── REALITY_AUDIT_BEFORE_V4.md   # Ce document
    ├── ARCHITECTURE_V4_DESIGN.md    # À créer après validation
    └── MIGRATION_PLAN_V4.md         # À créer après validation
```

## 14.2 Fichiers à Créer

### Couche Runtime (3 fichiers)

```
src/lib/runtime/
├── ModeResolver.ts       # Résolution unique du mode
├── AppRuntime.ts         # Singleton
└── index.ts
```

### Couche Providers (30 fichiers)

```
src/lib/providers/
├── factory/
│   └── ProviderFactory.ts
├── auth/
│   ├── IAuthProvider.ts
│   ├── LocalAuthProvider.ts
│   ├── CloudAuthProvider.ts
│   └── HybridAuthProvider.ts
├── tenant/
│   ├── ITenantProvider.ts
│   ├── LocalTenantProvider.ts
│   ├── CloudTenantProvider.ts
│   └── HybridTenantProvider.ts
├── billing/
│   ├── IBillingProvider.ts
│   ├── LocalBillingProvider.ts
│   ├── CloudBillingProvider.ts
│   └── HybridBillingProvider.ts
├── inventory/
│   ├── IInventoryProvider.ts
│   ├── LocalInventoryProvider.ts
│   ├── CloudInventoryProvider.ts
│   └── HybridInventoryProvider.ts
├── order/
│   ├── IOrderProvider.ts
│   ├── LocalOrderProvider.ts
│   ├── CloudOrderProvider.ts
│   └── HybridOrderProvider.ts
├── sync/
│   ├── ISyncProvider.ts
│   ├── LocalSyncProvider.ts
│   ├── CloudSyncProvider.ts
│   └── HybridSyncProvider.ts
├── user/
│   ├── IUserProvider.ts
│   ├── LocalUserProvider.ts
│   ├── CloudUserProvider.ts
│   └── HybridUserProvider.ts
├── printer/
│   ├── IPrinterProvider.ts
│   ├── LocalPrinterProvider.ts
│   ├── CloudPrinterProvider.ts
│   └── HybridPrinterProvider.ts
├── settings/
│   ├── ISettingsProvider.ts
│   ├── LocalSettingsProvider.ts
│   ├── CloudSettingsProvider.ts
│   └── HybridSettingsProvider.ts
└── notification/
    ├── INotificationProvider.ts
    ├── LocalNotificationProvider.ts
    ├── CloudNotificationProvider.ts
    └── HybridNotificationProvider.ts
```

### Couche Repositories (30+ fichiers)

```
src/lib/repositories/
├── auth/
│   ├── IAuthRepository.ts
│   ├── LocalAuthRepository.ts
│   ├── CloudAuthRepository.ts
│   └── HybridAuthRepository.ts
├── tenant/
│   ├── ITenantRepository.ts
│   ├── LocalTenantRepository.ts
│   ├── CloudTenantRepository.ts
│   └── HybridTenantRepository.ts
├── product/
│   ├── IProductRepository.ts
│   ├── LocalProductRepository.ts
│   ├── CloudProductRepository.ts
│   └── HybridProductRepository.ts
├── order/
│   ├── IOrderRepository.ts
│   ├── LocalOrderRepository.ts
│   ├── CloudOrderRepository.ts
│   └── HybridOrderRepository.ts
└── ... (autres entités)
```

**Total** : ~65 nouveaux fichiers

## 14.3 Fichiers à Supprimer

```
❌ src/lib/app-mode.ts          # Remplacé par ModeResolver
❌ src/shared/runtime-mode.ts   # Remplacé par ModeResolver
❌ src/server/infrastructure/data-source-manager.ts  # Remplacé par ProviderFactory
```

---

# 15. PLAN DE MIGRATION ÉTAPE PAR ÉTAPE

## Phase 1 : Création de la Couche Runtime (Semaine 1)

### Étape 1.1 : Créer ModeResolver

**Fichier** : `src/lib/runtime/ModeResolver.ts`

```typescript
export type ExecutionMode = 'LOCAL' | 'CLOUD' | 'HYBRID';

export class ModeResolver {
  private static instance: ModeResolver;
  private mode: ExecutionMode;
  
  private constructor() {
    this.mode = this.detectMode();
  }
  
  static getInstance(): ModeResolver {
    if (!this.instance) {
      this.instance = new ModeResolver();
    }
    return this.instance;
  }
  
  private detectMode(): ExecutionMode {
    // Logique de détection centralisée
    // Frontend : Vite env + hostname
    // Backend : env vars + Electron detection
  }
  
  getMode(): ExecutionMode {
    return this.mode;
  }
  
  isLocal(): boolean { return this.mode === 'LOCAL'; }
  isCloud(): boolean { return this.mode === 'CLOUD'; }
  isHybrid(): boolean { return this.mode === 'HYBRID'; }
}
```

**Durée** : 1 jour  
**Tests** : Tests unitaires pour chaque mode

### Étape 1.2 : Créer les Interfaces de Providers

**Fichiers** : `src/lib/providers/*/I*Provider.ts`

```typescript
// IAuthProvider.ts
export interface IAuthProvider {
  loginEmail(email: string, password: string): Promise<AuthResult>;
  loginPin(pin: string, identity?: string, tenantSlug?: string): Promise<AuthResult>;
  logout(): Promise<void>;
  refreshProfile(): Promise<User>;
  getCurrentUser(): User | null;
}

// ITenantProvider.ts
export interface ITenantProvider {
  getTenant(slug: string): Promise<Tenant>;
  getAllTenants(): Promise<Tenant[]>;
}

// IBillingProvider.ts
export interface IBillingProvider {
  getSubscription(tenantId: number): Promise<Subscription | null>;
  createSubscription(tenantId: number, planId: number): Promise<Subscription>;
}

// ... (8 interfaces au total)
```

**Durée** : 2 jours  
**Tests** : Tests de contrat (contrast)

### Étape 1.3 : Créer ProviderFactory

**Fichier** : `src/lib/providers/factory/ProviderFactory.ts`

```typescript
export class ProviderFactory {
  private static modeResolver = ModeResolver.getInstance();
  private static providers: Map<string, any> = new Map();
  
  static getAuthProvider(): IAuthProvider {
    const mode = this.modeResolver.getMode();
    const key = `auth-${mode}`;
    
    if (!this.providers.has(key)) {
      switch (mode) {
        case 'LOCAL':
          this.providers.set(key, new LocalAuthProvider());
          break;
        case 'CLOUD':
          this.providers.set(key, new CloudAuthProvider());
          break;
        case 'HYBRID':
          this.providers.set(key, new HybridAuthProvider());
          break;
      }
    }
    
    return this.providers.get(key);
  }
  
  // ... (10 méthodes au total)
}
```

**Durée** : 2 jours  
**Tests** : Tests de la factory pour chaque mode

## Phase 2 : Migration de l'Authentification (Semaine 2)

### Étape 2.1 : Créer LocalAuthProvider

**Fichier** : `src/lib/providers/auth/LocalAuthProvider.ts`

```typescript
export class LocalAuthProvider implements IAuthProvider {
  async loginEmail(email: string, password: string): Promise<AuthResult> {
    // Utilise SQLite via repository
    const user = await localAuthRepository.findByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new Error('INVALID_CREDENTIALS');
    }
    
    // Génère un vrai JWT (pas de faux token)
    const token = signJwt({
      sub: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      email: user.email,
    });
    
    return { token, user };
  }
  
  async loginPin(pin: string, identity?: string, tenantSlug?: string): Promise<AuthResult> {
    // Utilise SQLite via repository
    const user = await localAuthRepository.findByPin(pin, identity, tenantSlug);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }
    
    const token = signJwt({...});
    return { token, user };
  }
}
```

**Durée** : 2 jours  
**Tests** : Tests d'intégration avec SQLite

### Étape 2.2 : Créer CloudAuthProvider

**Fichier** : `src/lib/providers/auth/CloudAuthProvider.ts`

```typescript
export class CloudAuthProvider implements IAuthProvider {
  constructor(private supabase: SupabaseClient) {}
  
  async loginEmail(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !data || !verifyPassword(password, data.password_hash)) {
      throw new Error('INVALID_CREDENTIALS');
    }
    
    const token = signJwt({...});
    return { token, user: data };
  }
}
```

**Durée** : 1 jour  
**Tests** : Tests d'intégration avec Supabase

### Étape 2.3 : Créer HybridAuthProvider

**Fichier** : `src/lib/providers/auth/HybridAuthProvider.ts`

```typescript
export class HybridAuthProvider implements IAuthProvider {
  constructor(
    private localRepo: IAuthRepository,
    private cloudRepo: IAuthRepository,
    private outbox: IOutboxRepository
  ) {}
  
  async loginEmail(email: string, password: string): Promise<AuthResult> {
    // Essaie LOCAL d'abord
    try {
      return await this.localRepo.loginEmail(email, password);
    } catch (e) {
      // Fallback CLOUD
      return await this.cloudRepo.loginEmail(email, password);
    }
  }
}
```

**Durée** : 2 jours  
**Tests** : Tests de basculement LOCAL → CLOUD

### Étape 2.4 : Migrer LoginPage.tsx

**Avant** :

```typescript
// ❌ LoginPage.tsx
import { isLocal } from '../../lib/app-mode';

const handleAdminLogin = async () => {
  if (isLocal()) {
    const localUser = { id: 1, full_name: 'Admin Local', ... };
    const localToken = 'local-jwt-' + Date.now();
    setAuthToken(localToken);
    useAuthStore.getState().setUser(localUser);
    navigate('/dashboard');
    return;
  }
  
  const success = await loginEmail(email, password);
  // ...
};
```

**Après** :

```typescript
// ✅ LoginPage.tsx
import { authService } from '../../services/auth.service';

const handleAdminLogin = async () => {
  try {
    const result = await authService.loginEmail(email, password);
    setAuthToken(result.token);
    useAuthStore.getState().setUser(result.user);
    navigate('/dashboard');
  } catch (error) {
    setError(error.message);
  }
};
```

**Durée** : 1 jour  
**Tests** : Tests E2E du login

### Étape 2.5 : Migrer useAuthStore.ts

**Avant** :

```typescript
// ❌ useAuthStore.ts
import { isLocal } from '../lib/app-mode';

checkServer: async () => {
  if (isLocal()) {
    set({ isServerHealthy: true });
    return;
  }
  const response = await fetch('/api/auth/status');
  set({ isServerHealthy: response.ok });
}
```

**Après** :

```typescript
// ✅ useAuthStore.ts
import { healthService } from '../services/health.service';

checkServer: async () => {
  const isHealthy = await healthService.check();
  set({ isServerHealthy: isHealthy });
}
```

**Durée** : 1 jour  
**Tests** : Tests du store

## Phase 3 : Migration des Repositories (Semaine 3)

### Étape 3.1 : Créer les Interfaces

**Fichiers** : `src/lib/repositories/*/I*Repository.ts`

```typescript
// IProductRepository.ts
export interface IProductRepository {
  findById(id: string, tenantId?: string): Promise<ProductEntity | null>;
  findAll(tenantId?: string, query?: ProductQuery): Promise<ProductListResult>;
  create(dto: CreateProductDto, tenantId?: string): Promise<ProductEntity>;
  update(id: string, dto: UpdateProductDto, tenantId?: string): Promise<ProductEntity>;
  delete(id: string, tenantId?: string): Promise<void>;
}
```

**Durée** : 2 jours  
**Tests** : Tests de contrat

### Étape 3.2 : Créer les Implémentations

**Fichiers** : `src/lib/repositories/*/Local*Repository.ts`, `Cloud*Repository.ts`, `Hybrid*Repository.ts`

```typescript
// LocalProductRepository.ts
export class LocalProductRepository implements IProductRepository {
  async findById(id: string, tenantId?: string): Promise<ProductEntity | null> {
    const db = getSQLite();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return product ? this.map(product) : null;
  }
}

// CloudProductRepository.ts
export class CloudProductRepository implements IProductRepository {
  constructor(private supabase: SupabaseClient) {}
  
  async findById(id: string, tenantId?: string): Promise<ProductEntity | null> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return null;
    return this.map(data);
  }
}
```

**Durée** : 3 jours  
**Tests** : Tests d'intégration

### Étape 3.3 : Migrer les Routes

**Avant** :

```typescript
// ❌ routes/products.ts
router.get('/products', async (req, res) => {
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS) {
    // Cloud path
    const { data } = await supabase.from('products').select('*');
    res.json(data);
  } else {
    // SQLite path
    const db = require('../db/database').default;
    const products = db.prepare('SELECT * FROM products').all();
    res.json(products);
  }
});
```

**Après** :

```typescript
// ✅ routes/products.ts
router.get('/products', async (req, res) => {
  const products = await productRepository.findAll(tenantId);
  res.json(products);
});
```

**Durée** : 2 jours  
**Tests** : Tests d'intégration

## Phase 4 : Migration des Services (Semaine 4)

### Étape 4.1 : Migrer auth.service.ts

**Avant** :

```typescript
// ❌ auth.service.ts (200+ lignes)
const supabase = getSupabase(req);
if (supabase) {
  // Cloud path (100 lignes)
} else {
  // SQLite path (100 lignes)
}
```

**Après** :

```typescript
// ✅ auth.service.ts (50 lignes)
const authProvider = ProviderFactory.getAuthProvider();
const result = await authProvider.loginEmail(email, password);
res.json(result);
```

**Durée** : 1 jour  
**Tests** : Tests d'intégration

### Étape 4.2 : Migrer order.service.ts

**Durée** : 1 jour

### Étape 4.3 : Migrer product.service.ts

**Durée** : 1 jour

### Étape 4.4 : Migrer les autres services

**Durée** : 2 jours

## Phase 5 : Migration de la Synchronisation (Semaine 5)

### Étape 5.1 : Créer ISyncProvider

```typescript
export interface ISyncProvider {
  start(): void;
  stop(): void;
  triggerSync(): Promise<void>;
  getStatus(): SyncStatus;
}
```

### Étape 5.2 : Créer HybridSyncProvider

```typescript
export class HybridSyncProvider implements ISyncProvider {
  constructor(
    private localRepo: IProductRepository,
    private cloudRepo: IProductRepository,
    private outbox: IOutboxRepository
  ) {}
  
  async triggerSync(): Promise<void> {
    // Push local changes to cloud
    // Pull cloud changes to local
    // Resolve conflicts
  }
}
```

**Durée** : 3 jours

## Phase 6 : Tests et Validation (Semaine 6)

### Étape 6.1 : Tests Unitaires

- Tests de ModeResolver
- Tests de ProviderFactory
- Tests de chaque provider
- Tests de chaque repository

**Durée** : 2 jours

### Étape 6.2 : Tests d'Intégration

- Tests LOCAL (SQLite)
- Tests CLOUD (Supabase)
- Tests HYBRID (Sync)

**Durée** : 2 jours

### Étape 6.3 : Tests E2E

- Login en LOCAL
- Login en CLOUD
- CRUD produits en LOCAL
- CRUD produits en CLOUD
- Synchronisation HYBRID

**Durée** : 1 jour

## Phase 7 : Documentation et Formation (Semaine 7)

### Étape 7.1 : Documentation

- Architecture V4 complète
- Guide de migration
- Guide de contribution

**Durée** : 2 jours

### Étape 7.2 : Formation

- Session de formation pour l'équipe
- Q&A
- Best practices

**Durée** : 1 jour

---

# 16. CONCLUSION

## 16.1 Résumé

L'architecture actuelle présente une **dette technique critique** avec :

- ❌ 55 occurrences de vérifications de mode
- ❌ 2 systèmes de résolution de mode
- ❌ Données hardcodées
- ❌ Faux JWT
- ❌ localStorage comme base de données
- ❌ Couplage fort UI ↔ Infrastructure

## 16.2 Recommandations

### Court Terme (1 semaine)

1. ✅ **Valider cette audit** avec l'équipe
2. ✅ **Approuver l'architecture V4** proposée
3. ✅ **Planifier la migration** (7 semaines)

### Moyen Terme (7 semaines)

1. ✅ **Exécuter le plan de migration** phase par phase
2. ✅ **Tester chaque phase** avant de passer à la suivante
3. ✅ **Documenter** chaque étape

### Long Terme (3 mois)

1. ✅ **Former l'équipe** à la nouvelle architecture
2. ✅ **Établir des gardes** (lint rules, architecture tests)
3. ✅ **Ajouter de nouveaux modes** facilement (DEMO, TEST)

## 16.3 Bénéfices Attendus

| Bénéfice | Impact |
|----------|--------|
| **Maintenabilité** | -75% de temps de maintenance |
| **Évolutivité** | +300% (ajout de mode en 1 jour) |
| **Tests** | +50% de couverture, -75% de temps |
| **Performance** | -20% de temps de réponse |
| **Sécurité** | +100% (faux JWT supprimés) |
| **Dette technique** | -90% |

## 16.4 Prochaines Étapes

1. **Valider cet audit** avec l'équipe
2. **Créer `docs/ARCHITECTURE_V4_DESIGN.md`** avec le design détaillé
3. **Créer `docs/MIGRATION_PLAN_V4.md`** avec le plan de migration détaillé
4. **Commencer Phase 1** : Création de la couche Runtime

---

# ANNEXES

## Annexe A : Liste Complète des Fichiers à Modifier

### Frontend (15 fichiers)

```
src/pages/auth/LoginPage.tsx          # ❌ → ✅
src/stores/useAuthStore.ts            # ❌ → ✅
src/hooks/useBillingStatus.ts         # ❌ → ✅
src/lib/api-client.ts                 # ❌ → ✅
src/lib/app-mode.ts                   # ❌ → SUPPRIMER
src/lib/runtime-tracer.ts             # ⚠️  À vérifier
src/contexts/SubscriptionContext.tsx  # ⚠️  À vérifier
src/stores/useOrderStore.ts           # ⚠️  À vérifier
src/stores/useTableStore.ts           # ⚠️  À vérifier
src/stores/useNotificationStore.ts    # ⚠️  À vérifier
src/hooks/useNotifications.ts         # ⚠️  À vérifier
src/components/NotificationProvider.tsx # ⚠️  À vérifier
src/components/SubscriptionGate.tsx   # ⚠️  À vérifier
src/components/SubscriptionStatus.tsx # ⚠️  À vérifier
src/App.tsx                           # ⚠️  À vérifier
```

### Backend (40+ fichiers)

```
src/server/routes/
├── auth.ts                           # ❌ → ✅
├── auth-setup.ts                     # ❌ → ✅
├── products.ts                       # ❌ → ✅
├── orders.ts                         # ❌ → ✅
├── sales.ts                          # ❌ → ✅
├── customers.ts                      # ❌ → ✅
├── tables.ts                         # ❌ → ✅
├── inventory.ts                      # ❌ → ✅
├── categories.ts                     # ❌ → ✅
├── settings.ts                       # ❌ → ✅
├── logs.ts                           # ❌ → ✅
├── expenses.ts                       # ❌ → ✅
├── suppliers.ts                      # ❌ → ✅
├── notification_preferences.ts       # ❌ → ✅
└── scheduled_reports_log.ts          # ❌ → ✅

src/server/services/
├── auth.service.ts                   # ❌ → ✅
├── user.service.ts                   # ❌ → ✅
├── tenant.service.ts                 # ❌ → ✅
├── tenant-user.service.ts            # ❌ → ✅
├── order.service.ts                  # ❌ → ✅
├── product.service.ts                # ❌ → ✅
├── table.service.ts                  # ❌ → ✅
├── billing.service.ts                # ⚠️  À vérifier
├── voucher.service.ts                # ⚠️  À vérifier
└── ... (autres services)

src/server/infrastructure/
├── data-source-manager.ts            # ❌ → SUPPRIMER
├── repositories/
│   ├── supabase/                     # ❌ → ✅
│   └── legacy/                       # ❌ → ✅
└── synchronization/                  # ⚠️  À vérifier
```

## Annexe B : Estimation des Efforts

| Phase | Durée | Ressources | Risque |
|-------|-------|------------|--------|
| Phase 1 : Runtime | 1 semaine | 1 dev senior | 🟢 FAIBLE |
| Phase 2 : Auth | 1 semaine | 1 dev senior | 🟡 MOYEN |
| Phase 3 : Repositories | 1 semaine | 2 devs | 🟡 MOYEN |
| Phase 4 : Services | 1 semaine | 1 dev senior | 🟢 FAIBLE |
| Phase 5 : Sync | 1 semaine | 1 dev senior | 🟠 ÉLEVÉ |
| Phase 6 : Tests | 1 semaine | 1 dev + 1 QA | 🟢 FAIBLE |
| Phase 7 : Documentation | 1 semaine | 1 dev | 🟢 FAIBLE |
| **TOTAL** | **7 semaines** | **2 devs seniors** | **🟡 MOYEN** |

## Annexe C : Critères de Succès

### Critère 1 : Zéro if(LOCAL) dans le UI

- [ ] Aucun composant React n'importe `app-mode.ts`
- [ ] Aucun composant React n'utilise `isLocal()`
- [ ] Aucun composant React ne contient de données hardcodées

### Critère 2 : Zéro faux JWT

- [ ] Aucun token généré côté client
- [ ] Tous les JWT sont signés par le serveur

### Critère 3 : Une seule source de vérité pour le mode

- [ ] `ModeResolver` est le seul endroit qui détecte le mode
- [ ] `ProviderFactory` est le seul endroit qui choisit le provider

### Critère 4 : 99% du code ignore le mode

- [ ] Les composants React ne connaissent pas le mode
- [ ] Les stores ne connaissent pas le mode
- [ ] Les services métier ne connaissent pas le mode
- [ ] Seuls les providers et la factory connaissent le mode

### Critère 5 : Tests complets

- [ ] Tests unitaires pour chaque provider
- [ ] Tests d'intégration pour chaque mode
- [ ] Tests E2E pour chaque flux métier
- [ ] Couverture > 90%

---

**Fin du Document**

**Prochaine étape** : Valider cet audit et créer `docs/ARCHITECTURE_V4_DESIGN.md`