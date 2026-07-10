# AUDIT ARCHITECTURAL — Gestion des Modes d'Exécution (LOCAL/CLOUD/HYBRID)

**Date** : 2026-01-07  
**Auteur** : Architecte Logiciel Senior  
**Statut** : AUDIT COMPLET  
**Version** : 1.0.0

---

# SOMMAIRE

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Contexte et Problématique](#2-contexte-et-problématique)
3. [Audit de l'Architecture Actuelle](#3-audit-de-larchitecture-actuelle)
4. [Identification des Points Chauds](#4-identification-des-points-chauds)
5. [Cartographie des Dépendances](#5-cartographie-des-dépendances)
6. [Analyse des Risques et Dette Technique](#6-analyse-des-risques-et-dette-technique)
7. [Architecture Cible](#7-architecture-cible)
8. [Diagrammes d'Architecture](#8-diagrammes-darchitecture)
9. [Arborescence des Nouveaux Dossiers](#9-arborescence-des-nouveaux-dossiers)
10. [Plan de Migration](#10-plan-de-migration)
11. [Impact sur les Tests](#11-impact-sur-les-tests)
12. [Impact sur SQLite](#12-impact-sur-sqlite)
13. [Impact sur Supabase](#13-impact-sur-supabase)
14. [Impact sur le Moteur de Synchronisation](#14-impact-sur-le-moteur-de-synchronisation)
15. [Analyse des Risques Détaillée](#15-analyse-des-risques-détaillée)
16. [Recommandations](#16-recommandations)

---

# 1. RÉSUMÉ EXÉCUTIF

## Constat Principal

L'architecture actuelle présente une **dette technique critique** liée à la gestion des modes d'exécution (LOCAL/CLOUD/HYBRID). Le mode est testé directement dans :

- **4 fichiers frontend** (LoginPage, useAuthStore, useBillingStatus, api-client)
- **1 fichier backend** (data-source-manager)
- **10+ occurrences** de `if (isLocal())` dispersées dans le code

## Problèmes Identifiés

| Problème | Sévérité | Impact |
|----------|----------|--------|
| Données hardcodées dans LoginPage | 🔴 Critique | Faux JWT, utilisateurs factices |
| localStorage utilisé comme base de données | 🔴 Critique | Pas de persistance réelle en LOCAL |
| Composants React dépendants du mode | 🔴 Critique | Violation de Clean Architecture |
| Stores avec logique métier conditionnelle | 🟠 Élevé | Couplage fort |
| api-client avec comportements différents | 🟠 Élevé | Incohérence des données |
| Pas d'abstraction des providers | 🔴 Critique | Impossible de changer de mode sans modifier le code métier |

## Objectif

Atteindre une architecture où **99% du code ignore complètement le mode d'exécution**, grâce à :

1. Un **Runtime Layer** unique et centralisé
2. Des **interfaces** abstraites pour tous les providers
3. Une **ProviderFactory** qui masque la complexité
4. Une **injection de dépendances** propre

---

# 2. CONTEXTE ET PROBLÉMATIQUE

## 2.1 Modes d'Exécution

### LOCAL
- **Frontend** : React + Vite (localhost:5173)
- **Backend** : Node.js + Express (localhost:3001)
- **Base de données** : SQLite uniquement
- **Authentification** : JWT simulé (faux token)
- **Données** : Hardcodées ou localStorage

### CLOUD
- **Frontend** : React déployé (Vercel/Render)
- **Backend** : Node.js + Express (Render)
- **Base de données** : Supabase (PostgreSQL)
- **Authentification** : JWT réel signé
- **Données** : Supabase uniquement

### HYBRIDE
- **Frontend** : React (localhost ou déployé)
- **Backend** : Node.js + Express
- **Base de données** : SQLite + Supabase
- **Synchronisation** : Outbox + Replication Engine
- **Authentification** : JWT réel

## 2.2 Architecture Actuelle (Problématique)

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND                                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  LoginPage.tsx                                        │  │
│  │  ├─ if (isLocal()) → Faux JWT + données hardcodées   │  │
│  │  └─ else → Vrai JWT                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  useAuthStore.ts                                       │  │
│  │  ├─ if (isLocal()) → isServerHealthy = true           │  │
│  │  └─ else → fetch('/api/auth/status')                  │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  useBillingStatus.ts                                   │  │
│  │  ├─ if (isLocal()) → always active                     │  │
│  │  └─ else → fetch subscription status                   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  api-client.ts                                         │  │
│  │  ├─ if (isLocal()) → read from localStorage            │  │
│  │  └─ else → HTTP request                                │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│  BACKEND                                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  data-source-manager.ts                                │  │
│  │  ├─ isCloud() → Supabase                               │  │
│  │  └─ isLocal() → SQLite                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Services métier                                        │  │
│  │  ├─ if (runtime.isCloud()) → Supabase repo            │  │
│  │  └─ else → SQLite repo                                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 2.3 Problèmes Critiques

### ❌ Problème 1 : Données Hardcodées dans LoginPage

```typescript
// LoginPage.tsx - LIGNES 364-378
if (isLocal()) {
  const localTenant: TenantInfo = {
    id: 1,
    name: 'Makutano',
    slug: 'makutano',
    status: 'active',
  };
  setTenant(localTenant);
  // ...
}
```

**Impact** : 
- Tenant hardcodé
- Pas de vérification réelle
- Données fictives

### ❌ Problème 2 : Faux JWT

```typescript
// LoginPage.tsx - LIGNES 417-444
if (isLocal()) {
  const localUser = {
    id: 1,
    full_name: 'Admin Local',
    email: email,
    // ...
  };
  
  // Simulate JWT token for local mode
  const localToken = 'local-jwt-' + Date.now();
  
  const { setAuthToken } = await import('../../lib/api-client');
  setAuthToken(localToken);
  
  useAuthStore.getState().setUser(localUser as any);
  navigate('/dashboard');
  return;
}
```

**Impact** :
- JWT généré côté client (faux)
- Pas de signature
- Pas de vérification
- Faille de sécurité

### ❌ Problème 3 : localStorage comme Base de Données

```typescript
// api-client.ts - LIGNES 383-398
if (isLocal()) {
  try {
    const raw = localStorage.getItem('ekala-tenants');
    if (raw) {
      const tenants = JSON.parse(raw);
      const tenant = tenants.find((t: any) => t.slug === slug);
      if (tenant) {
        return Promise.resolve(tenant);
      }
    }
  } catch {}
  return Promise.reject(new Error(`Tenant "${slug}" not found locally`));
}
```

**Impact** :
- Pas de persistance réelle
- Données perdues si localStorage effacé
- Pas de requêtes complexes possibles
- Pas de transactions

### ❌ Problème 4 : Composants React avec Logique Métier

```typescript
// LoginPage.tsx - LIGNES 410-462
const handleAdminLogin = useCallback(async () => {
  if (!email || password.length < 8 || !isServerHealthy || submitting) return;
  
  try {
    // LOCAL mode: simulate successful login without network call
    if (isLocal()) {
      // ... logique métier dans le composant
    }
    
    const success = await loginEmail(email, password);
    // ...
  }
}, [email, password, isServerHealthy, submitting, isLocal, navigate, t]);
```

**Impact** :
- Composant connaît le mode d'exécution
- Violation de séparation des responsabilités
- Impossible de tester sans connaître le mode
- Duplication de logique

---

# 3. AUDIT DE L'ARCHITECTURE ACTUELLE

## 3.1 Fichiers Impactés

### Frontend

| Fichier | Lignes Impactées | Type de Problème | Sévérité |
|---------|------------------|------------------|----------|
| `src/pages/auth/LoginPage.tsx` | 364-378, 389-395, 417-444, 472-500 | Données hardcodées, faux JWT | 🔴 Critique |
| `src/stores/useAuthStore.ts` | 58-62 | Comportement conditionnel | 🟠 Élevé |
| `src/hooks/useBillingStatus.ts` | 53-67 | Données hardcodées | 🟠 Élevé |
| `src/lib/api-client.ts` | 383-398 | localStorage comme BDD | 🔴 Critique |
| `src/lib/app-mode.ts` | 1-44 | Source de vérité du mode | 🟡 Moyen |

### Backend

| Fichier | Lignes Impactées | Type de Problème | Sévérité |
|---------|------------------|------------------|----------|
| `src/server/infrastructure/data-source-manager.ts` | 1-176 | Singleton avec logique conditionnelle | 🟠 Élevé |

## 3.2 Occurrences de `isLocal()` / `isCloud()` / `isHybrid()`

### Dans les fichiers `.ts` (backend)

```
src/stores/useAuthStore.ts:58
src/lib/api-client.ts:384
src/hooks/useBillingStatus.ts:54
src/server/infrastructure/data-source-manager.ts:100,107,151
```

### Dans les fichiers `.tsx` (frontend)

```
src/pages/auth/LoginPage.tsx:365,389,417,472
```

**Total** : 10 occurrences dans 5 fichiers

## 3.3 Dépendances entre Fichiers

```
LoginPage.tsx
├── useAuthStore (store)
│   └── api-client (API)
│       └── app-mode (détection du mode)
├── api-client (direct)
│   └── app-mode (détection du mode)
└── isLocal() (direct)
    └── app-mode

useBillingStatus.ts
├── isLocal()
│   └── app-mode
└── fetch() (direct)

data-source-manager.ts
├── resolveRuntimeMode()
│   └── shared/runtime-mode
└── env (configuration)
```

---

# 4. IDENTIFICATION DES POINTS CHAUDS

## 4.1 LoginPage.tsx — CRITIQUE

**Localisation** : `src/pages/auth/LoginPage.tsx`

**Problèmes** :
1. **Lignes 364-378** : Tenant hardcodé en LOCAL
2. **Lignes 389-395** : Message d'erreur hardcodé
3. **Lignes 417-444** : Admin login avec faux JWT
4. **Lignes 472-500** : Staff login avec faux JWT
5. **Ligne 17** : Import de `isLocal()`

**Couplages** :
- Dépend directement de `app-mode.ts`
- Accède à `localStorage` directement
- Modifie `api-client` (`setAuthToken`)
- Modifie `useAuthStore` directement

**Risques** :
- ❌ Faille de sécurité (JWT factice)
- ❌ Données incohérentes
- ❌ Impossible de tester proprement
- ❌ Violation de SRP (Single Responsibility Principle)

## 4.2 useAuthStore.ts — ÉLEVÉ

**Localisation** : `src/stores/useAuthStore.ts`

**Problèmes** :
1. **Lignes 58-62** : `checkServer()` retourne `true` en LOCAL
2. **Ligne 5** : Import de `isLocal()`

**Couplages** :
- Dépend de `app-mode.ts`
- Logique métier dans un store (devrait être dans un service)

**Risques** :
- ⚠️ Comportement différent selon le mode
- ⚠️ Tests complexes

## 4.3 useBillingStatus.ts — ÉLEVÉ

**Localisation** : `src/hooks/useBillingStatus.ts`

**Problèmes** :
1. **Lignes 53-67** : Retourne `active: true` en LOCAL
2. **Ligne 9** : Import de `isLocal()`

**Couplages** :
- Dépend de `app-mode.ts`
- Accède à `localStorage` directement (ligne 97)

**Risques** :
- ⚠️ Billing désactivé en LOCAL
- ⚠️ Accès autorisé sans vérification

## 4.4 api-client.ts — CRITIQUE

**Localisation** : `src/lib/api-client.ts`

**Problèmes** :
1. **Lignes 383-398** : `getTenant()` lit depuis localStorage en LOCAL
2. **Ligne 6** : Import de `isLocal()`

**Couplages** :
- Dépend de `app-mode.ts`
- Mélange responsabilités réseau et locale

**Risques** :
- ❌ localStorage comme BDD
- ❌ Incohérence de données
- ❌ Pas de validation

## 4.5 data-source-manager.ts — MOYEN

**Localisation** : `src/server/infrastructure/data-source-manager.ts`

**Problèmes** :
1. **Singleton** avec logique de détection
2. **Méthodes** `isCloud()`, `isLocal()` exposées
3. **Accès direct** à Supabase et SQLite

**Couplages** :
- Utilisé par les services backend
- Connaît les deux types de bases de données

**Risques** :
- ⚠️ Couplage fort
- ⚠️ Difficile à tester

---

# 5. CARTOGRAPHIE DES DÉPENDANCES

## 5.1 Graphe de Dépendances Frontend

```
┌──────────────────────────────────────────────────────────────┐
│  app-mode.ts                                                  │
│  (Source de vérité du mode)                                   │
└──────────────┬───────────────────────────────────────────────┘
               │
       ┌───────┴───────────────────────────────┐
       │                                       │
       ▼                                       ▼
┌──────────────┐                      ┌──────────────────┐
│ LoginPage.tsx│                      │ useAuthStore.ts  │
│ (CRITIQUE)   │                      │ (ÉLEVÉ)          │
└──────┬───────┘                      └────────┬─────────┘
       │                                       │
       │                                       ▼
       │                              ┌──────────────────┐
       │                              │ api-client.ts    │
       │                              │ (CRITIQUE)       │
       │                              └────────┬─────────┘
       │                                       │
       │                                       ▼
       │                              ┌──────────────────┐
       │                              │ app-mode.ts      │
       │                              │ (REDÉPENDANCE)   │
       │                              └──────────────────┘
       │
       ▼
┌──────────────────┐
│ useBillingStatus │
│ (ÉLEVÉ)          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ app-mode.ts      │
│ (REDÉPENDANCE)   │
└──────────────────┘
```

## 5.2 Graphe de Dépendances Backend

```
┌──────────────────────────────────────┐
│ data-source-manager.ts               │
│ (Singleton)                          │
│                                      │
│  ├─ getSupabase()                    │
│  ├─ getSQLite()                      │
│  ├─ isCloud()                        │
│  └─ isLocal()                        │
└──────────────┬───────────────────────┘
               │
       ┌───────┴────────────────┐
       │                        │
       ▼                        ▼
┌──────────────┐      ┌──────────────────┐
│ Services     │      │ Repositories     │
│ Backend      │      │                  │
│              │      │ ├─ SQLiteRepo    │
│ ├─ Order     │      │ └─ SupabaseRepo  │
│ ├─ Product   │      └──────────────────┘
│ ├─ Customer  │
│ └─ ...       │
└──────────────┘
```

## 5.3 Couplages Existants

### Couplages Forts (à éliminer)

| Source | Cible | Type | Impact |
|--------|-------|------|--------|
| LoginPage.tsx | app-mode.ts | Import direct | 🔴 Critique |
| LoginPage.tsx | localStorage | Accès direct | 🔴 Critique |
| LoginPage.tsx | api-client (setAuthToken) | Modification directe | 🔴 Critique |
| useAuthStore.ts | app-mode.ts | Import direct | 🟠 Élevé |
| useBillingStatus.ts | app-mode.ts | Import direct | 🟠 Élevé |
| api-client.ts | app-mode.ts | Import direct | 🔴 Critique |
| api-client.ts | localStorage | Accès direct | 🔴 Critique |
| Services backend | data-source-manager.ts | Singleton | 🟠 Élevé |

### Couplages Acceptables (à conserver)

| Source | Cible | Type | Justification |
|--------|-------|------|---------------|
| Services backend | Repositories | Injection de dépendances | ✅ Pattern Repository |
| Composants React | Stores (Zustand) | State management | ✅ Pattern standard |
| api-client | Backend API | HTTP requests | ✅ Normal |

---

# 6. ANALYSE DES RISQUES ET DETTE TECHNIQUE

## 6.1 Dette Technique Identifiée

### Dette Critique (à résoudre immédiatement)

| # | Dette | Localisation | Impact | Effort |
|---|-------|--------------|--------|--------|
| 1 | Faux JWT généré côté client | LoginPage.tsx:433 | 🔴 Sécurité | 2 jours |
| 2 | Données hardcodées (tenant, user) | LoginPage.tsx:366-430 | 🔴 Fonctionnel | 1 jour |
| 3 | localStorage comme BDD | api-client.ts:383-398 | 🔴 Architecture | 3 jours |
| 4 | Composants React avec logique métier | LoginPage.tsx:410-531 | 🔴 Architecture | 2 jours |

### Dette Élevée (à résoudre dans la phase 1)

| # | Dette | Localisation | Impact | Effort |
|---|-------|--------------|--------|--------|
| 5 | Stores avec comportement conditionnel | useAuthStore.ts:58-62 | 🟠 Testabilité | 1 jour |
| 6 | Hooks avec logique métier | useBillingStatus.ts:53-67 | 🟠 Testabilité | 1 jour |
| 7 | Singleton data-source-manager | data-source-manager.ts | 🟠 Testabilité | 2 jours |

### Dette Moyenne (à résoudre dans la phase 2)

| # | Dette | Localisation | Impact | Effort |
|---|-------|--------------|--------|--------|
| 8 | Duplication de détection de mode | app-mode.ts + data-source-manager.ts | 🟡 Maintenance | 1 jour |
| 9 | Absence d'interfaces pour providers | Tous les services | 🟡 Évolutivité | 2 jours |
| 10 | Pas de ProviderFactory | Tous les services | 🟡 Évolutivité | 1 jour |

**Total effort estimé** : 14 jours

## 6.2 Risques Identifiés

### Risques Critiques

| Risque | Probabilité | Impact | Mitigation |
|---------|-------------|--------|------------|
| Faille de sécurité (JWT factice) | Élevée | 🔴 Critique | Implémenter auth réelle en LOCAL |
| Perte de données (localStorage) | Élevée | 🔴 Critique | Utiliser SQLite en LOCAL |
| Incohérence des données | Moyenne | 🟠 Élevé | Centraliser la logique dans les providers |

### Risques Élevés

| Risque | Probabilité | Impact | Mitigation |
|---------|-------------|--------|------------|
| Régression fonctionnelle | Moyenne | 🟠 Élevé | Tests complets avant/après |
| Complexité de migration | Élevée | 🟠 Élevé | Plan de migration par étapes |
| Performance dégradée | Faible | 🟡 Moyen | Benchmarking |

---

# 7. ARCHITECTURE CIBLE

## 7.1 Principes Architecturaux

### 1. **Runtime Layer Unique**
- Une seule source de vérité pour le mode d'exécution
- Aucun composant React ne connaît le mode
- Aucun store ne connaît le mode
- Aucun hook ne connaît le mode

### 2. **Inversion de Dépendances**
- Les services dépendent d'interfaces, pas d'implémentations
- Les providers sont injectés, pas créés directement

### 3. **Strategy Pattern**
- Chaque provider implémente une interface commune
- Le comportement change selon le mode, mais l'interface reste identique

### 4. **Factory Pattern**
- ProviderFactory masque la création des providers
- Le reste de l'application ne sait pas quel mode est actif

### 5. **Repository Pattern**
- Tous les accès aux données passent par des repositories
- Les repositories sont implémentés par mode (SQLite, Supabase, Hybride)

## 7.2 Architecture Cible

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (React)                                               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  LoginPage.tsx                                            │ │
│  │  └─ authProvider.login(email, password)                   │ │
│  │     (NE CONNAÎT PAS LE MODE)                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  useAuthStore.ts                                           │ │
│  │  └─ authService.login(email, password)                    │ │
│  │     (NE CONNAÎT PAS LE MODE)                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  useBillingStatus.ts                                       │ │
│  │  └─ billingService.getStatus(tenantId)                     │ │
│  │     (NE CONNAÎT PAS LE MODE)                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  api-client.ts                                             │ │
│  │  └─ httpClient.request(endpoint, data)                     │ │
│  │     (NE CONNAÎT PAS LE MODE)                              │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Injection de dépendances
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  RUNTIME LAYER                                                   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ModeResolver (UNIQUE)                                     │ │
│  │  └─ resolve() → 'LOCAL' | 'CLOUD' | 'HYBRID'              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                         │                                        │
│                         ▼                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ProviderFactory (UNIQUE)                                  │ │
│  │                                                             │ │
│  │  getAuthProvider() → IAuthProvider                         │ │
│  │  getBillingProvider() → IBillingProvider                   │ │
│  │  getOrderProvider() → IOrderProvider                       │ │
│  │  getInventoryProvider() → IInventoryProvider               │ │
│  │  getTenantProvider() → ITenantProvider                     │ │
│  │  getSyncProvider() → ISyncProvider                         │ │
│  │  getPrinterProvider() → IPrinterProvider                   │ │
│  │  getSettingsProvider() → ISettingsProvider                 │ │
│  │  getNotificationProvider() → INotificationProvider         │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Factory choisit l'implémentation
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  PROVIDERS (Interfaces + Implémentations)                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  IAuthProvider (interface)                                  │ │
│  │  ├─ login(email, password) → Promise<AuthResult>           │ │
│  │  ├─ logout() → Promise<void>                               │ │
│  │  ├─ refresh() → Promise<AuthResult>                        │ │
│  │  └─ me() → Promise<User>                                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                         │                                        │
│         ┌───────────────┼───────────────┐                       │
│         ▼               ▼               ▼                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ LocalAuth    │ │ CloudAuth    │ │ HybridAuth   │           │
│  │ Provider     │ │ Provider     │ │ Provider     │           │
│  │              │ │              │ │              │           │
│  │ - SQLite     │ │ - Supabase   │ │ - SQLite     │           │
│  │ - JWT simulé │ │ - JWT réel   │ │ - Outbox     │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                 │
│  (Même principe pour tous les providers)                        │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Providers utilisent les repositories
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  REPOSITORIES                                                   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ITenantRepository (interface)                              │ │
│  │  ├─ findBySlug(slug) → Promise<Tenant>                     │ │
│  │  ├─ findById(id) → Promise<Tenant>                         │ │
│  │  └─ create(data) → Promise<Tenant>                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                         │                                        │
│         ┌───────────────┼───────────────┐                       │
│         ▼               ▼               ▼                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ SQLiteTenant │ │ Supabase     │ │ HybrideTenant│           │
│  │ Repository   │ │ TenantRepo   │ │ Repository   │           │
│  │              │ │              │ │              │           │
│  │ - SQLite     │ │ - Supabase   │ │ - SQLite     │           │
│  │   queries    │ │   queries    │ │   + Outbox   │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Repositories accèdent aux données
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  DATA SOURCES                                                   │
│                                                                 │
│  ┌──────────────┐              ┌──────────────┐               │
│  │   SQLite     │              │   Supabase   │               │
│  │              │              │              │               │
│  │ - tenants    │              │ - tenants    │               │
│  │ - users      │              │ - users      │               │
│  │ - orders     │              │ - orders     │               │
│  │ - products   │              │ - products   │               │
│  │ - ...        │              │ - ...        │               │
│  └──────────────┘              └──────────────┘               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Outbox (pour HYBRID)                                      │ │
│  │  - Queue des modifications                                │ │
│  │  - Replication Engine                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 7.3 Flux d'Exécution

### 7.3.1 Flux LOCAL

```
LoginPage
  └─ authProvider.login(email, password)
      └─ LocalAuthProvider.login()
          └─ SQLiteTenantRepository.findBySlug(slug)
              └─ SQLite query
          └─ SQLiteUserRepository.findByEmail(email)
              └─ SQLite query
          └─ Génère JWT (signé par backend)
          └─ Retourne { token, user }
```

### 7.3.2 Flux CLOUD

```
LoginPage
  └─ authProvider.login(email, password)
      └─ CloudAuthProvider.login()
          └─ SupabaseTenantRepository.findBySlug(slug)
              └─ Supabase query
          └─ SupabaseUserRepository.findByEmail(email)
              └─ Supabase query
          └─ Vérifie mot de passe (Supabase Auth)
          └─ Retourne { token, user }
```

### 7.3.3 Flux HYBRIDE

```
LoginPage
  └─ authProvider.login(email, password)
      └─ HybridAuthProvider.login()
          └─ SQLiteTenantRepository.findBySlug(slug)
              └─ SQLite query (source de vérité)
          └─ SQLiteUserRepository.findByEmail(email)
              └─ SQLite query
          └─ Vérifie mot de passe
          └─ Génère JWT
          └─ Ajoute événement à l'Outbox
          └─ Retourne { token, user }
```

---

# 8. DIAGRAMMES D'ARCHITECTURE

## 8.1 Diagramme de Classes (UML Simplifié)

```
┌─────────────────────────────────────────────────────────────────┐
│                         IAuthProvider                            │
│  (Interface)                                                     │
├─────────────────────────────────────────────────────────────────┤
│ + login(email: string, password: string): Promise<AuthResult>   │
│ + loginPin(pin: string, identity?: string): Promise<AuthResult> │
│ + logout(): Promise<void>                                        │
│ + refresh(): Promise<AuthResult>                                 │
│ + me(): Promise<User>                                            │
└─────────────────────────────────────────────────────────────────┘
         △
         │ implements
         │
    ┌────┴────────────────────────────────────────────┐
    │                                                 │
    ▼                                                 ▼
┌──────────────────┐                      ┌──────────────────┐
│ LocalAuthProvider│                      │ CloudAuthProvider│
│ (Implémentation) │                      │ (Implémentation) │
├──────────────────┤                      ├──────────────────┤
│ - sqliteRepo     │                      │ - supabaseRepo   │
│ - jwtService     │                      │ - supabaseAuth   │
│ - cacheService   │                      │ - jwtService     │
├──────────────────┤                      ├──────────────────┤
│ + login()        │                      │ + login()        │
│ + loginPin()     │                      │ + loginPin()     │
│ + logout()       │                      │ + logout()       │
│ + refresh()      │                      │ + refresh()      │
│ + me()           │                      │ + me()           │
└──────────────────┘                      └──────────────────┘
         △                                                 △
         │                                                 │
         └────────────────────┬────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ HybridAuthProvider│
                    │ (Implémentation)  │
                    ├──────────────────┤
                    │ - sqliteRepo      │
                    │ - supabaseRepo    │
                    │ - outboxService   │
                    │ - jwtService      │
                    ├──────────────────┤
                    │ + login()         │
                    │ + loginPin()      │
                    │ + logout()        │
                    │ + refresh()       │
                    │ + me()            │
                    └──────────────────┘
```

## 8.2 Diagramme de Séquence — Login

```
┌──────┐ ┌──────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Login │ │Store │ │Provider  │ │Repository│ │  SQLite  │ │ Supabase │
│Page  │ │      │ │Factory   │ │Interface  │ │          │ │          │
└──┬───┘ └──┬───┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
   │        │          │            │             │            │
   │ 1. login(email, password)        │            │            │
   │────────────────────────────────>│            │            │
   │        │          │            │             │            │
   │        │  2. getAuthProvider()    │            │            │
   │        │───────────────────────>│            │            │
   │        │          │            │             │            │
   │        │          │ 3. Retourne LocalAuthProvider / CloudAuthProvider / HybridAuthProvider
   │        │<───────────────────────│            │            │
   │        │          │            │             │            │
   │        │  4. authProvider.login(email, password)            │
   │        │─────────────────────────────────────────>│        │
   │        │          │            │             │            │
   │        │          │            │ 5. findBySlug(slug)         │
   │        │          │            │────────────────────────────>│
   │        │          │            │             │            │
   │        │          │            │ 6. Retourne tenant          │
   │        │          │            │<────────────────────────────│
   │        │          │            │             │            │
   │        │          │            │ 7. findByEmail(email)       │
   │        │          │            │────────────────────────────>│
   │        │          │            │             │            │
   │        │          │            │ 8. Retourne user            │
   │        │          │            │<────────────────────────────│
   │        │          │            │             │            │
   │        │          │            │ 9. Vérifie password         │
   │        │          │            │             │            │
   │        │          │            │ 10. Génère JWT              │
   │        │          │            │             │            │
   │        │          │            │ 11. Retourne {token, user}  │
   │        │          │            │<────────────────────────────│
   │        │          │            │             │            │
   │ 12. Retourne {token, user}       │            │            │
   │<─────────────────────────────────────────────────────────│   │
   │        │          │            │             │            │
   │ 13. Stocke token et user         │            │            │
   │<─────────────────────────────────────────────────────────│   │
   │        │          │            │             │            │
```

## 8.3 Diagramme de Composants

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ LoginPage    │  │ Dashboard    │  │ POS          │         │
│  │              │  │              │  │              │         │
│  │ - UI only    │  │ - UI only    │  │ - UI only    │         │
│  │ - No mode    │  │ - No mode    │  │ - No mode    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            │                                    │
│                            ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Services Layer (Frontend)                      │ │
│  │  - AuthService                                              │ │
│  │  - BillingService                                           │ │
│  │  - OrderService                                             │ │
│  │  - InventoryService                                         │ │
│  │  (NE CONNAISSENT PAS LE MODE)                              │ │
│  └───────────────────────────┬───────────────────────────────┘ │
└──────────────────────────────┼─────────────────────────────────┘
                               │
                               │ HTTP / WebSocket
                               │
┌──────────────────────────────┼─────────────────────────────────┐
│                    BACKEND LAYER                               │
│                               │                                │
│                               ▼                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Controllers / Routes                          │ │
│  │  - AuthController                                          │ │
│  │  - BillingController                                       │ │
│  │  - OrderController                                         │ │
│  │  (NE CONNAISSENT PAS LE MODE)                             │ │
│  └───────────────────────────┬───────────────────────────────┘ │
│                              │                                 │
│                              ▼                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Application Services                           │ │
│  │  - AuthService                                             │ │
│  │  - BillingService                                          │ │
│  │  - OrderService                                            │ │
│  │  (NE CONNAISSENT PAS LE MODE)                             │ │
│  └───────────────────────────┬───────────────────────────────┘ │
│                              │                                 │
│                              ▼                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              ProviderFactory (UNIQUE)                       │ │
│  │  + getAuthProvider(): IAuthProvider                        │ │
│  │  + getBillingProvider(): IBillingProvider                  │ │
│  │  + getOrderProvider(): IOrderProvider                      │ │
│  │  (CHOISIT L'IMPLÉMENTATION SELON LE MODE)                 │ │
│  └───────────────────────────┬───────────────────────────────┘ │
│                              │                                 │
│         ┌────────────────────┼────────────────────┐           │
│         │                    │                    │           │
│         ▼                    ▼                    ▼           │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐      │
│  │ LOCAL        │   │ CLOUD        │   │ HYBRID       │      │
│  │ Providers    │   │ Providers    │   │ Providers    │      │
│  │              │   │              │   │              │      │
│  │ - SQLite     │   │ - Supabase   │   │ - SQLite     │      │
│  │ - JWT local  │   │ - JWT cloud  │   │ - Outbox     │      │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘      │
│         │                    │                    │           │
│         └────────────────────┼────────────────────┘           │
│                              │                                │
│                              ▼                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Repositories                                  │ │
│  │  - ITenantRepository                                       │ │
│  │  - IUserRepository                                         │ │
│  │  - IOrderRepository                                        │ │
│  │  (INTERFACES UNIFIÉES)                                    │ │
│  └───────────────────────────┬───────────────────────────────┘ │
│                              │                                 │
│         ┌────────────────────┼────────────────────┐           │
│         │                    │                    │           │
│         ▼                    ▼                    ▼           │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐      │
│  │ SQLite       │   │ Supabase     │   │ Hybride      │      │
│  │ Repositories │   │ Repositories │   │ Repositories │      │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘      │
│         │                    │                    │           │
└─────────┼────────────────────┼────────────────────┼───────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │   SQLite     │   │   Supabase   │   │   Outbox     │
   │              │   │              │   │              │
   │ - tenants    │   │ - tenants    │   │ - Queue      │
   │ - users      │   │ - users      │   │ - Replication│
   │ - orders     │   │ - orders     │   │   Engine     │
   └──────────────┘   └──────────────┘   └──────────────┘
```

---

# 9. ARBORESCENCE DES NOUVEAUX DOSSIERS

## 9.1 Structure Frontend

```
src/
├── lib/
│   ├── app-mode.ts                          # [DEPRECATED] À supprimer après migration
│   ├── runtime/
│   │   ├── index.ts                         # Export public
│   │   ├── mode-resolver.ts                 # ModeResolver (remplace app-mode)
│   │   └── provider-factory.ts              # ProviderFactory
│   │
│   ├── providers/
│   │   ├── index.ts                         # Export public
│   │   ├── auth/
│   │   │   ├── IAuthProvider.ts             # Interface
│   │   │   ├── LocalAuthProvider.ts         # Implémentation LOCAL
│   │   │   ├── CloudAuthProvider.ts         # Implémentation CLOUD
│   │   │   └── HybridAuthProvider.ts        # Implémentation HYBRID
│   │   ├── billing/
│   │   │   ├── IBillingProvider.ts
│   │   │   ├── LocalBillingProvider.ts
│   │   │   ├── CloudBillingProvider.ts
│   │   │   └── HybridBillingProvider.ts
│   │   ├── tenant/
│   │   │   ├── ITenantProvider.ts
│   │   │   ├── LocalTenantProvider.ts
│   │   │   ├── CloudTenantProvider.ts
│   │   │   └── HybridTenantProvider.ts
│   │   ├── order/
│   │   │   ├── IOrderProvider.ts
│   │   │   ├── LocalOrderProvider.ts
│   │   │   ├── CloudOrderProvider.ts
│   │   │   └── HybridOrderProvider.ts
│   │   ├── inventory/
│   │   │   ├── IInventoryProvider.ts
│   │   │   ├── LocalInventoryProvider.ts
│   │   │   ├── CloudInventoryProvider.ts
│   │   │   └── HybridInventoryProvider.ts
│   │   ├── sync/
│   │   │   ├── ISyncProvider.ts
│   │   │   ├── LocalSyncProvider.ts
│   │   │   ├── CloudSyncProvider.ts
│   │   │   └── HybridSyncProvider.ts
│   │   └── ...
│   │
│   ├── services/
│   │   ├── auth.service.ts                  # Service métier (sans logique de mode)
│   │   ├── billing.service.ts
│   │   ├── tenant.service.ts
│   │   └── ...
│   │
│   └── api-client.ts                        # Simplifié, sans isLocal()
│
├── stores/
│   ├── useAuthStore.ts                      # Simplifié, sans isLocal()
│   ├── useBillingStore.ts                   # Simplifié
│   └── ...
│
├── hooks/
│   ├── useBillingStatus.ts                  # Simplifié, sans isLocal()
│   └── ...
│
└── pages/
    └── auth/
        └── LoginPage.tsx                    # Simplifié, sans isLocal()
```

## 9.2 Structure Backend

```
src/server/
├── infrastructure/
│   ├── data-source-manager.ts              # [DEPRECATED] À supprimer après migration
│   ├── runtime/
│   │   ├── index.ts                        # Export public
│   │   ├── mode-resolver.ts                # ModeResolver (remplace data-source-manager)
│   │   └── provider-factory.ts             # ProviderFactory
│   │
│   ├── providers/
│   │   ├── index.ts                        # Export public
│   │   ├── auth/
│   │   │   ├── IAuthProvider.ts            # Interface
│   │   │   ├── LocalAuthProvider.ts        # Implémentation LOCAL
│   │   │   ├── CloudAuthProvider.ts        # Implémentation CLOUD
│   │   │   └── HybridAuthProvider.ts       # Implémentation HYBRID
│   │   ├── billing/
│   │   │   ├── IBillingProvider.ts
│   │   │   ├── LocalBillingProvider.ts
│   │   │   ├── CloudBillingProvider.ts
│   │   │   └── HybridBillingProvider.ts
│   │   └── ...
│   │
│   ├── repositories/
│   │   ├── ITenantRepository.ts            # Interface
│   │   ├── IUserRepository.ts
│   │   ├── IOrderRepository.ts
│   │   ├── SQLiteTenantRepository.ts       # Implémentation SQLite
│   │   ├── SupabaseTenantRepository.ts     # Implémentation Supabase
│   │   ├── HybrideTenantRepository.ts      # Implémentation Hybride
│   │   └── ...
│   │
│   └── synchronization/
│       ├── outbox/
│       │   ├── OutboxQueue.ts
│       │   ├── OutboxWorker.ts
│       │   └── ReplicationEngine.ts
│       └── ...
│
├── application/
│   ├── services/
│   │   ├── auth.service.ts                 # Service métier (sans logique de mode)
│   │   ├── billing.service.ts
│   │   └── ...
│   └── ...
│
└── routes/
    ├── auth.routes.ts                      # Simplifié
    ├── billing.routes.ts
    └── ...
```

## 9.3 Structure des Fichiers

### Interface Exemple : `IAuthProvider.ts`

```typescript
/**
 * Interface pour tous les providers d'authentification
 * Les implémentations (Local, Cloud, Hybride) doivent respecter cette signature
 */
export interface IAuthProvider {
  /**
   * Authentifie un utilisateur avec email et mot de passe
   * @returns Promise<AuthResult> avec token et user
   */
  login(email: string, password: string): Promise<AuthResult>;

  /**
   * Authentifie un membre du staff avec PIN
   * @returns Promise<AuthResult> avec token et user
   */
  loginPin(pin: string, identity?: string, tenantSlug?: string): Promise<AuthResult>;

  /**
   * Déconnecte l'utilisateur
   */
  logout(): Promise<void>;

  /**
   * Rafraîchit le token JWT
   * @returns Promise<AuthResult> avec nouveau token
   */
  refresh(): Promise<AuthResult>;

  /**
   * Récupère les informations de l'utilisateur connecté
   * @returns Promise<User>
   */
  me(): Promise<User>;

  /**
   * Vérifie si le serveur est accessible
   * @returns Promise<boolean>
   */
  checkHealth(): Promise<boolean>;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface User {
  id: number;
  full_name: string;
  email?: string;
  username: string;
  role: 'super_admin' | 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter';
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  status: 'active' | 'suspended' | 'cancelled' | 'trial' | 'past_due' | 'expired';
  plan_name?: string;
  expires_at?: string;
}
```

### ProviderFactory Exemple : `provider-factory.ts`

```typescript
/**
 * ProviderFactory - UNIQUE point de création des providers
 * 
 * La factory connaît le mode d'exécution et choisit l'implémentation.
 * Le reste de l'application ne sait pas quel mode est actif.
 */
import { ModeResolver } from './mode-resolver';
import { IAuthProvider } from '../providers/auth/IAuthProvider';
import { LocalAuthProvider } from '../providers/auth/LocalAuthProvider';
import { CloudAuthProvider } from '../providers/auth/CloudAuthProvider';
import { HybridAuthProvider } from '../providers/auth/HybridAuthProvider';
import { IBillingProvider } from '../providers/billing/IBillingProvider';
import { LocalBillingProvider } from '../providers/billing/LocalBillingProvider';
import { CloudBillingProvider } from '../providers/billing/CloudBillingProvider';
import { HybridBillingProvider } from '../providers/billing/HybridBillingProvider';
// ... autres providers

export class ProviderFactory {
  private static modeResolver = new ModeResolver();
  private static providers: Map<string, any> = new Map();

  /**
   * Retourne le provider d'authentification selon le mode
   */
  static getAuthProvider(): IAuthProvider {
    const cacheKey = 'auth-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      const mode = ProviderFactory.modeResolver.resolve();
      
      switch (mode) {
        case 'LOCAL':
          ProviderFactory.providers.set(cacheKey, new LocalAuthProvider());
          break;
        case 'CLOUD':
          ProviderFactory.providers.set(cacheKey, new CloudAuthProvider());
          break;
        case 'HYBRID':
          ProviderFactory.providers.set(cacheKey, new HybridAuthProvider());
          break;
        default:
          throw new Error(`Mode d'exécution inconnu: ${mode}`);
      }
    }
    
    return ProviderFactory.providers.get(cacheKey);
  }

  /**
   * Retourne le provider de billing selon le mode
   */
  static getBillingProvider(): IBillingProvider {
    const cacheKey = 'billing-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      const mode = ProviderFactory.modeResolver.resolve();
      
      switch (mode) {
        case 'LOCAL':
          ProviderFactory.providers.set(cacheKey, new LocalBillingProvider());
          break;
        case 'CLOUD':
          ProviderFactory.providers.set(cacheKey, new CloudBillingProvider());
          break;
        case 'HYBRID':
          ProviderFactory.providers.set(cacheKey, new HybridBillingProvider());
          break;
        default:
          throw new Error(`Mode d'exécution inconnu: ${mode}`);
      }
    }
    
    return ProviderFactory.providers.get(cacheKey);
  }

  // ... autres méthodes get*Provider()

  /**
   * Reset tous les providers (utile pour les tests)
   */
  static reset(): void {
    ProviderFactory.providers.clear();
  }
}
```

### ModeResolver Exemple : `mode-resolver.ts`

```typescript
/**
 * ModeResolver - UNIQUE source de vérité pour le mode d'exécution
 * 
 * Règles :
 * - Electron → LOCAL
 * - VITE_APP_MODE=local → LOCAL
 * - VITE_APP_MODE=cloud → CLOUD
 * - VITE_APP_MODE=hybrid → HYBRID
 * - localhost → LOCAL
 * - Par défaut → CLOUD
 */
export type ExecutionMode = 'LOCAL' | 'CLOUD' | 'HYBRID';

export class ModeResolver {
  private static instance: ModeResolver;
  private cachedMode: ExecutionMode;

  private constructor() {
    this.cachedMode = this.detectMode();
  }

  public static getInstance(): ModeResolver {
    if (!ModeResolver.instance) {
      ModeResolver.instance = new ModeResolver();
    }
    return ModeResolver.instance;
  }

  private detectMode(): ExecutionMode {
    // Server-side: toujours CLOUD
    if (typeof window === 'undefined') {
      return 'CLOUD';
    }

    // Client-side: check Vite env vars
    try {
      const viteEnv = (import.meta as any)?.env || {};
      if (viteEnv.VITE_APP_MODE === 'local') return 'LOCAL';
      if (viteEnv.VITE_APP_MODE === 'cloud') return 'CLOUD';
      if (viteEnv.VITE_APP_MODE === 'hybrid') return 'HYBRID';

      // Vite dev server → LOCAL
      if (viteEnv.DEV === true) return 'LOCAL';
    } catch {}

    // Check if we are running on localhost (client-side only)
    try {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') return 'LOCAL';
    } catch {}

    return 'CLOUD';
  }

  public resolve(): ExecutionMode {
    return this.cachedMode;
  }

  public isLocal(): boolean {
    return this.cachedMode === 'LOCAL';
  }

  public isCloud(): boolean {
    return this.cachedMode === 'CLOUD';
  }

  public isHybrid(): boolean {
    return this.cachedMode === 'HYBRID';
  }
}
```

---

# 10. PLAN DE MIGRATION

## 10.1 Phases de Migration

### Phase 0 : Préparation (1 semaine)

**Objectif** : Mettre en place l'infrastructure sans casser l'existant

**Tâches** :
1. Créer les dossiers `runtime/` et `providers/`
2. Créer les interfaces (`IAuthProvider`, `IBillingProvider`, etc.)
3. Créer `ModeResolver` (remplace `app-mode.ts`)
4. Créer `ProviderFactory` (vide pour l'instant)
5. Écrire les tests pour les interfaces

**Livrables** :
- ✅ Interfaces définies
- ✅ ModeResolver fonctionnel
- ✅ ProviderFactory fonctionnel
- ✅ Tests unitaires

**Risques** : Faible (pas de modification du code existant)

---

### Phase 1 : Backend Providers (2 semaines)

**Objectif** : Implémenter les providers backend

**Tâches** :

#### Semaine 1 : Providers Critiques
1. **AuthProvider**
   - `LocalAuthProvider` (SQLite + JWT local)
   - `CloudAuthProvider` (Supabase Auth)
   - `HybridAuthProvider` (SQLite + Outbox)
   
2. **TenantProvider**
   - `LocalTenantProvider` (SQLite)
   - `CloudTenantProvider` (Supabase)
   - `HybridTenantProvider` (SQLite + Outbox)

3. **Tests**
   - Tests unitaires pour chaque provider
   - Tests d'intégration

#### Semaine 2 : Autres Providers
1. **BillingProvider**
2. **OrderProvider**
3. **InventoryProvider**
4. **UserProvider**
5. **Tests**

**Livrables** :
- ✅ 10 providers implémentés (3 modes chacun)
- ✅ Tests unitaires (couverture > 90%)
- ✅ Tests d'intégration

**Risques** : Moyen (modification du backend)

---

### Phase 2 : Frontend Services (1 semaine)

**Objectif** : Créer les services frontend qui utilisent les providers

**Tâches** :
1. Créer `AuthService` (utilise `ProviderFactory.getAuthProvider()`)
2. Créer `BillingService` (utilise `ProviderFactory.getBillingProvider()`)
3. Créer `TenantService` (utilise `ProviderFactory.getTenantProvider()`)
4. Créer les autres services
5. Écrire les tests

**Livrables** :
- ✅ Services frontend fonctionnels
- ✅ Tests unitaires

**Risques** : Faible (code parallèle)

---

### Phase 3 : Migration des Stores (1 semaine)

**Objectif** : Migrer les stores vers les nouveaux services

**Tâches** :
1. **useAuthStore**
   - Remplacer `loginEmail()` par `authService.loginEmail()`
   - Remplacer `loginPin()` par `authService.loginPin()`
   - Supprimer `isLocal()` check
   
2. **useBillingStore** (si existe)
3. **Tests**

**Livrables** :
- ✅ Stores migrés
- ✅ Tests passent

**Risques** : Moyen (code utilisé partout)

---

### Phase 4 : Migration des Hooks (3 jours)

**Objectif** : Migrer les hooks vers les nouveaux services

**Tâches** :
1. **useBillingStatus**
   - Remplacer la logique par `billingService.getStatus()`
   - Supprimer `isLocal()` check
   
2. **Autres hooks**
3. **Tests**

**Livrables** :
- ✅ Hooks migrés
- ✅ Tests passent

**Risques** : Faible

---

### Phase 5 : Migration de api-client (2 jours)

**Objectif** : Simplifier api-client

**Tâches** :
1. Supprimer `isLocal()` check dans `getTenant()`
2. Supprimer lecture localStorage
3. Utiliser `tenantService.getTenant()` à la place
4. **Tests**

**Livrables** :
- ✅ api-client simplifié
- ✅ Tests passent

**Risques** : Faible

---

### Phase 6 : Migration de LoginPage (3 jours)

**Objectif** : Simplifier LoginPage

**Tâches** :
1. Supprimer tous les `if (isLocal())`
2. Supprimer données hardcodées
3. Supprimer faux JWT
4. Utiliser `authService.loginEmail()` et `authService.loginPin()`
5. **Tests**

**Livrables** :
- ✅ LoginPage simplifié
- ✅ Tests passent
- ✅ Plus de données hardcodées
- ✅ Plus de faux JWT

**Risques** : Élevé (composant critique)

---

### Phase 7 : Nettoyage (1 semaine)

**Objectif** : Supprimer l'ancien code

**Tâches** :
1. Supprimer `app-mode.ts` (remplacé par `ModeResolver`)
2. Supprimer `data-source-manager.ts` (remplacé par `ProviderFactory`)
3. Supprimer tous les imports de `isLocal()`, `isCloud()`, `isHybrid()`
4. Vérifier qu'aucun `if (LOCAL)` ne subsiste
5. **Tests complets**

**Livrables** :
- ✅ Code propre
- ✅ 0 occurrence de `isLocal()` dans les composants React
- ✅ 0 occurrence de `isLocal()` dans les stores
- ✅ 0 occurrence de `isLocal()` dans les hooks
- ✅ 0 donnée hardcodée
- ✅ 0 faux JWT

**Risques** : Faible (code déjà migré)

---

## 10.2 Timeline Globale

```
Semaine 1: Phase 0 (Préparation)
Semaine 2-3: Phase 1 (Backend Providers)
Semaine 4: Phase 2 (Frontend Services)
Semaine 5: Phase 3 (Migration Stores)
Semaine 6: Phase 4 (Migration Hooks) + Phase 5 (api-client)
Semaine 7: Phase 6 (LoginPage) + Phase 7 (Nettoyage)

TOTAL: 7 semaines
```

## 10.3 Stratégie de Rollback

### Feature Flags

```typescript
// src/lib/feature-flags.ts
export const USE_NEW_AUTH = true; // Passer à false pour rollback
export const USE_NEW_BILLING = true;
```

### Rollback Plan

1. **Si Phase 1 échoue** : Revenir au code précédent (git revert)
2. **Si Phase 2 échoue** : Désactiver les nouveaux services (feature flags)
3. **Si Phase 3+ échoue** : Garder l'ancien code en parallèle, migrer progressivement

---

# 11. IMPACT SUR LES TESTS

## 11.1 Tests Existants

### Tests à Mettre à Jour

| Test | Fichier | Impact | Action |
|------|---------|--------|--------|
| Login tests | `*.test.tsx` | 🔴 Élevé | Réécrire complètement |
| Auth store tests | `useAuthStore.test.ts` | 🟠 Moyen | Adapter aux nouveaux services |
| Billing tests | `useBillingStatus.test.ts` | 🟠 Moyen | Adapter aux nouveaux services |
| API client tests | `api-client.test.ts` | 🟡 Faible | Mettre à jour les mocks |

### Nouveaux Tests à Créer

| Test | Fichier | Description |
|------|---------|-------------|
| ModeResolver tests | `mode-resolver.test.ts` | Tester la détection du mode |
| ProviderFactory tests | `provider-factory.test.ts` | Tester la création des providers |
| IAuthProvider tests | `IAuthProvider.test.ts` | Tests d'interface |
| LocalAuthProvider tests | `LocalAuthProvider.test.ts` | Tests implémentation LOCAL |
| CloudAuthProvider tests | `CloudAuthProvider.test.ts` | Tests implémentation CLOUD |
| HybridAuthProvider tests | `HybridAuthProvider.test.ts` | Tests implémentation HYBRID |
| Repository tests | `*Repository.test.ts` | Tests de chaque repository |

## 11.2 Stratégie de Test

### Tests Unitaires

```typescript
// Exemple: LocalAuthProvider.test.ts
describe('LocalAuthProvider', () => {
  let provider: LocalAuthProvider;
  let mockSqliteRepo: jest.Mocked<ISqliteUserRepository>;

  beforeEach(() => {
    mockSqliteRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    } as any;
    
    provider = new LocalAuthProvider(mockSqliteRepo);
  });

  describe('login', () => {
    it('should authenticate user with correct credentials', async () => {
      // Arrange
      const mockUser = { id: 1, email: 'test@example.com', password: 'hashed' };
      mockSqliteRepo.findByEmail.mockResolvedValue(mockUser as any);
      
      // Act
      const result = await provider.login('test@example.com', 'password123');
      
      // Assert
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
    });

    it('should reject invalid credentials', async () => {
      // Arrange
      mockSqliteRepo.findByEmail.mockResolvedValue(null);
      
      // Act & Assert
      await expect(provider.login('wrong@example.com', 'password'))
        .rejects.toThrow('Invalid credentials');
    });
  });
});
```

### Tests d'Intégration

```typescript
// Exemple: auth.integration.test.ts
describe('Auth Flow Integration', () => {
  let provider: IAuthProvider;

  beforeEach(() => {
    ProviderFactory.reset();
    provider = ProviderFactory.getAuthProvider();
  });

  it('should complete full login flow in LOCAL mode', async () => {
    // Setup: Créer un tenant et un user en LOCAL
    // Act: Login
    // Assert: Token valide, user connecté
  });

  it('should complete full login flow in CLOUD mode', async () => {
    // Setup: Créer un tenant et un user en CLOUD
    // Act: Login
    // Assert: Token valide, user connecté
  });
});
```

### Tests E2E

```typescript
// Exemple: login.e2e.test.ts
describe('LoginPage E2E', () => {
  it('should login successfully in LOCAL mode', () => {
    // Arrange: Set mode to LOCAL
    // Act: Fill form, submit
    // Assert: Redirect to dashboard
  });

  it('should login successfully in CLOUD mode', () => {
    // Arrange: Set mode to CLOUD
    // Act: Fill form, submit
    // Assert: Redirect to dashboard
  });
});
```

## 11.3 Couverture de Tests Cible

| Module | Couverture Actuelle | Couverture Cible |
|--------|---------------------|------------------|
| ModeResolver | 0% | 100% |
| ProviderFactory | 0% | 100% |
| IAuthProvider | 0% | 100% |
| LocalAuthProvider | 0% | 95% |
| CloudAuthProvider | 0% | 95% |
| HybridAuthProvider | 0% | 95% |
| Repositories | ~60% | 90% |
| Services | ~40% | 85% |
| Stores | ~30% | 80% |
| Components | ~20% | 70% |

---

# 12. IMPACT SUR SQLITE

## 12.1 Utilisation Actuelle

### En LOCAL
- Base de données **unique**
- Toutes les tables sont utilisées
- Pas de synchronisation

### En CLOUD
- SQLite **non utilisé**
- Tout passe par Supabase

### En HYBRID
- SQLite = **source de vérité**
- Synchronisation vers Supabase via Outbox

## 12.2 Impact de la Migration

### Changements

| Aspect | Avant | Après |
|--------|-------|-------|
| Accès | Direct via `require('../db/database')` | Via `SQLiteTenantRepository` |
| Requêtes | SQL direct dans les services | Méthodes du repository |
| Transactions | Gérées manuellement | Gérées par le repository |
| Migrations | Exécutées au démarrage | Via `ensure-sync-tables.ts` |

### Avantages

1. **Abstraction** : Le code métier ne sait pas que c'est SQLite
2. **Testabilité** : Facile de mocker le repository
3. **Évolutivité** : Possibilité de changer de base de données locale
4. **Cohérence** : Même interface que Supabase

### Aucune Régression

- Les schémas SQLite restent identiques
- Les requêtes SQL restent identiques
- Les performances sont identiques

---

# 13. IMPACT SUR SUPABASE

## 13.1 Utilisation Actuelle

### En CLOUD
- Base de données **unique**
- Toutes les tables sont utilisées
- Authentification via Supabase Auth

### En LOCAL
- Supabase **non utilisé**

### En HYBRID
- Supabase = **réplica**
- Synchronisation depuis SQLite via Outbox

## 13.2 Impact de la Migration

### Changements

| Aspect | Avant | Après |
|--------|-------|-------|
| Accès | Direct via `createClient()` | Via `SupabaseTenantRepository` |
| Requêtes | Appels directs à Supabase | Méthodes du repository |
| Authentification | `supabase.auth.signIn()` | Via `CloudAuthProvider` |
| Realtime | Abonnements directs | Via `CloudSyncProvider` |

### Avantages

1. **Abstraction** : Le code métier ne sait pas que c'est Supabase
2. **Testabilité** : Facile de mocker le repository
3. **Évolutivité** : Possibilité de changer de fournisseur cloud
4. **Cohérence** : Même interface que SQLite

### Aucune Régression

- Les requêtes Supabase restent identiques
- Les performances sont identiques
- La sécurité est préservée

---

# 14. IMPACT SUR LE MOTEUR DE SYNCHRONISATION

## 14.1 Architecture Actuelle

```
SQLite (source de vérité)
  ↓
Outbox (queue d'événements)
  ↓
Replication Engine
  ↓
Supabase (réplica)
```

## 14.2 Impact de la Migration

### Changements

| Aspect | Avant | Après |
|--------|-------|-------|
| Déclenchement | Automatique dans les services | Via `HybridSyncProvider` |
| Outbox | Utilisé directement | Encapsulé dans le provider |
| Replication | Appelée directement | Appelée par le provider |

### Avantages

1. **Centralisation** : Toute la logique de sync dans un provider
2. **Testabilité** : Facile de mocker la synchronisation
3. **Configuration** : Possibilité de configurer la sync par entité

### Aucune Régression

- Le moteur de synchronisation reste identique
- Les performances sont identiques
- La fiabilité est préservée

---

# 15. ANALYSE DES RISQUES DÉTAILLÉE

## 15.1 Risques Techniques

### Risque 1 : Régression Fonctionnelle

**Probabilité** : Moyenne  
**Impact** : Élevé  
**Mitigation** :
- Tests complets avant/après
- Migration par étapes
- Feature flags pour rollback rapide
- Tests E2E automatisés

### Risque 2 : Performance Dégradée

**Probabilité** : Faible  
**Impact** : Moyen  
**Mitigation** :
- Benchmarking avant/après
- Cache des providers (singleton)
- Optimisation des requêtes

### Risque 3 : Complexité de Migration

**Probabilité** : Élevée  
**Impact** : Moyen  
**Mitigation** :
- Plan de migration détaillé
- Migration par phases
- Code parallèle pendant la transition
- Documentation complète

### Risque 4 : Bugs dans les Nouveaux Providers

**Probabilité** : Moyenne  
**Impact** : Élevé  
**Mitigation** :
- Tests unitaires complets (> 90% couverture)
- Tests d'intégration
- Code review systématique
- Tests en environnement de staging

## 15.2 Risques Organisationnels

### Risque 5 : Résistance au Changement

**Probabilité** : Moyenne  
**Impact** : Faible  
**Mitigation** :
- Documentation complète
- Formation de l'équipe
- Exemples de code
- Support pendant la migration

### Risque 6 : Délais

**Probabilité** : Moyenne  
**Impact** : Moyen  
**Mitigation** :
- Estimation réaliste (7 semaines)
- Buffer de 20%
- Priorisation des tâches critiques
- Livraison incrémentale

## 15.3 Risques Métier

### Risque 7 : Perte de Données

**Probabilité** : Faible  
**Impact** : Critique  
**Mitigation** :
- Backups avant migration
- Tests de non-régression
- Validation manuelle
- Rollback plan

### Risque 8 : Faille de Sécurité

**Probabilité** : Faible  
**Impact** : Critique  
**Mitigation** :
- Audit de sécurité
- Tests de pénétration
- Revue de code
- Validation par un expert

---

# 16. RECOMMANDATIONS

## 16.1 Actions Prioritaires (Critiques)

### 1. Supprimer le Faux JWT (LoginPage.tsx)

**Action** : Remplacer par un vrai JWT généré par le backend

**Effort** : 2 jours  
**Priorité** : 🔴 Critique  
**Justification** : Faille de sécurité majeure

### 2. Supprimer les Données Hardcodées (LoginPage.tsx)

**Action** : Lire depuis SQLite (LOCAL) ou Supabase (CLOUD)

**Effort** : 1 jour  
**Priorité** : 🔴 Critique  
**Justification** : Données incohérentes

### 3. Supprimer localStorage comme BDD (api-client.ts)

**Action** : Utiliser SQLiteRepository en LOCAL

**Effort** : 3 jours  
**Priorité** : 🔴 Critique  
**Justification** : Architecture incorrecte

## 16.2 Actions Importantes (Élevées)

### 4. Créer les Interfaces des Providers

**Action** : Définir `IAuthProvider`, `IBillingProvider`, etc.

**Effort** : 2 jours  
**Priorité** : 🟠 Élevé  
**Justification** : Base de la nouvelle architecture

### 5. Créer ProviderFactory

**Action** : Implémenter la factory qui choisit le provider selon le mode

**Effort** : 1 jour  
**Priorité** : 🟠 Élevé  
**Justification** : Centralisation de la logique de mode

### 6. Migrer les Stores

**Action** : Remplacer `isLocal()` par appels aux services

**Effort** : 1 semaine  
**Priorité** : 🟠 Élevé  
**Justification** : Réduction de la dette technique

## 16.3 Actions Souhaitables (Moyennes)

### 7. Créer ModeResolver

**Action** : Remplacer `app-mode.ts` par une classe propre

**Effort** : 1 jour  
**Priorité** : 🟡 Moyen  
**Justification** : Code plus propre

### 8. Migrer les Hooks

**Action** : Remplacer `isLocal()` par appels aux services

**Effort** : 3 jours  
**Priorité** : 🟡 Moyen  
**Justification** : Cohérence architecturale

## 16.4 Ordre d'Exécution Recommandé

```
Semaine 1:
  - Jour 1-2: Créer interfaces + ModeResolver + ProviderFactory
  - Jour 3-5: Implémenter LocalAuthProvider + CloudAuthProvider + HybridAuthProvider

Semaine 2-3:
  - Implémenter tous les autres providers
  - Écrire les tests

Semaine 4:
  - Créer les services frontend
  - Migrer les stores

Semaine 5:
  - Migrer les hooks
  - Migrer api-client

Semaine 6:
  - Migrer LoginPage
  - Tests complets

Semaine 7:
  - Nettoyage
  - Documentation
  - Validation
```

## 16.5 Métriques de Succès

### Métriques Quantitatives

| Métrique | Avant | Après |
|----------|-------|-------|
| Occurrences de `isLocal()` dans composants React | 4 | 0 |
| Occurrences de `isLocal()` dans stores | 1 | 0 |
| Occurrences de `isLocal()` dans hooks | 1 | 0 |
| Données hardcodées | 3 | 0 |
| Faux JWT | 1 | 0 |
| Couverture de tests | ~40% | > 85% |
| Couplage frontend ↔ mode | Fort | Aucun |

### Métriques Qualitatives

- ✅ 99% du code ignore le mode d'exécution
- ✅ Composants React sans logique métier
- ✅ Stores sans logique de mode
- ✅ Hooks sans logique de mode
- ✅ Architecture évolutive (ajout de mode facile)
- ✅ Testabilité maximale
- ✅ Aucune régression fonctionnelle

---

# CONCLUSION

## Résumé

L'architecture actuelle présente une **dette technique critique** avec :

- ❌ 10 occurrences de `isLocal()` dans 5 fichiers
- ❌ Données hardcodées dans LoginPage
- ❌ Faux JWT généré côté client
- ❌ localStorage utilisé comme base de données
- ❌ Composants React avec logique métier

## Solution Proposée

Mettre en place une **architecture propre** avec :

1. ✅ **Runtime Layer** unique (ModeResolver + ProviderFactory)
2. ✅ **Interfaces** pour tous les providers
3. ✅ **3 implémentations** par provider (LOCAL, CLOUD, HYBRID)
4. ✅ **Injection de dépendances** propre
5. ✅ **Repository Pattern** pour l'accès aux données
6. ✅ **0 dépendance** au mode dans les composants React

## Bénéfices

- ✅ **Sécurité** : Faux JWT supprimé
- ✅ **Maintenabilité** : Code propre et testable
- ✅ **Évolutivité** : Ajout de mode facile (DEMO, TEST, etc.)
- ✅ **Performance** : Aucune régression
- ✅ **Testabilité** : Couverture > 85%

## Prochaines Étapes

1. **Valider** ce document d'audit
2. **Approuver** le plan de migration
3. **Démarrer** Phase 0 (Préparation)
4. **Exécuter** les 7 phases sur 7 semaines
5. **Valider** la migration avec tests complets

---

**Fin de l'Audit**

*Document généré par l'Architecte Logiciel Senior*  
*Date : 2026-01-07*