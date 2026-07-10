# PHASE 1 — PLAN D'IMPLÉMENTATION V3 FINALE
## RuntimeContext + Contract Discovery + Domain Layer Minimal

**Date** : 2026-01-07  
**Auteur** : Architecte Logiciel Senior  
**Statut** : PLAN D'IMPLÉMENTATION V3  
**Version** : 3.0.0  
**Durée Estimée** : 6 jours (incluant Phase 0.5)

---

# SOMMAIRE

1. [Principes Architecturaux Non Négociables](#1-principes-architecturaux-non-négociables)
2. [Objectifs de la Phase 1](#2-objectifs-de-la-phase-1)
3. [Nouvelle Structure des Dossiers](#3-nouvelle-structure-des-dossiers)
4. [RuntimeContext Architecture](#4-runtimecontext-architecture)
5. [Plan d'Implémentation Détaillé](#5-plan-dimplémentation-détaillé)
6. [Fichiers Créés](#6-fichiers-créés)
7. [Responsabilités](#7-responsabilités)
8. [Dépendances](#8-dépendances)
9. [Stratégie de Migration Orientée Risque](#9-stratégie-de-migration-orientée-risque)
10. [Risques et Mitigations](#10-risques-et-mitigations)
11. [Checklist de Validation](#11-checklist-de-validation)

---

# 1. PRINCIPES ARCHITECTURAUX NON NÉGOCIABLES

## 1.1 Support des 3 Modes d'Exécution

### LOCAL
- ✅ Fonctionnement complet **sans connexion backend**
- ✅ SQLite comme **source opérationnelle**
- ✅ Electron Desktop App
- ✅ Authentification locale (JWT signé par backend local)
- ✅ Aucune dépendance à Supabase

### CLOUD
- ✅ Supabase comme **source de vérité distante**
- ✅ Web Application (Vercel/Render)
- ✅ Authentification via Supabase Auth
- ✅ Aucune dépendance à SQLite

### HYBRIDE
- ✅ SQLite local comme **source de vérité** (LOCAL_FIRST)
- ✅ Synchronisation vers Supabase via **moteur de réplication existant**
- ✅ Electron Desktop App + Sync Engine
- ✅ Outbox + Replication Engine + Conflict Resolver + DLQ
- ✅ Fonctionnement offline-first

## 1.2 Interdiction de Conditions Dispersées

### ❌ INTERDIT
```typescript
if (isLocal()) { ... }
if (isCloud()) { ... }
if (isHybrid()) { ... }
```

### ✅ OBLIGATOIRE
```typescript
const runtime = RuntimeContext.getInstance();
const provider = ProviderFactory.getAuthProvider();
await provider.login(email, password);
```

## 1.3 RuntimeContext n'est pas un God Object

**Règle** : RuntimeContext expose le contexte final, mais utilise des resolvers séparés :

```
RuntimeContext
├── RuntimeDetector
├── StorageStrategyResolver
├── AuthStrategyResolver
└── DataAuthorityResolver
```

## 1.4 Résolution du Mode d'Exécution

**Ordre de résolution** :

1. **EKALA_MODE explicite** (env var)
   - `EKALA_MODE=LOCAL`
   - `EKALA_MODE=CLOUD`
   - `EKALA_MODE=HYBRID`

2. **Détection Electron** (user agent + process.versions.electron)

3. **Request metadata/header** (X-Runtime-Mode)

4. **Fallback CLOUD**

**Interdiction** : Ne jamais utiliser `typeof window === undefined` => CLOUD

## 1.5 Data Authority pour HYBRIDE

**DataAuthority** :

- `LOCAL_FIRST` : SQLite source de vérité, Supabase réplica
- `CLOUD_FIRST` : Supabase source de vérité, SQLite cache
- `CONFLICT_RESOLUTION` : Résolution automatique des conflits

**RuntimeContext expose** :

```typescript
dataAuthority: 'LOCAL_FIRST' | 'CLOUD_FIRST' | 'CONFLICT_RESOLUTION'
```

## 1.6 Electron Runtime Adapters

**RuntimeAdapter** :

- `BrowserRuntimeAdapter` : Web (CLOUD)
- `ElectronRuntimeAdapter` : Desktop (LOCAL/HYBRID)
- `ServerRuntimeAdapter` : Node.js (CLOUD)

**Objectif** : Support explicite des 3 environnements d'exécution.

## 1.7 Domain Layer Minimal

**Phase initiale uniquement** :

```
domain/
├── identity/
│   ├── User.ts
│   ├── Role.ts
│   └── Permission.ts
├── tenant/
│   └── Tenant.ts
├── sync/
│   └── SyncEvent.ts
└── billing/
    ├── Subscription.ts
    └── Voucher.ts
```

**Les autres domaines** (Product, Category, Order, etc.) seront ajoutés après migration.

## 1.8 Stratégie de Tests Réaliste

**Phase 1** :

- Tests unitaires RuntimeContext
- Tests unitaires Resolvers
- Tests unitaires ProviderFactory
- Tests de contrat (contrats respectés)

**Après implémentation réelle** :

- Integration tests
- E2E tests

**Ne pas viser 95% immédiatement** : Viser 80% sur les composants critiques.

---

# 2. OBJECTIFS DE LA PHASE 1

## 2.1 Objectif Principal

Créer les **fondations** de la nouvelle architecture sans casser l'existant.

## 2.2 Phase 0.5 : Contract Discovery & Existing System Audit

**Objectif** : Analyser le système existant SANS modifier.

**Durée** : 1 jour

**Livrables** :

- `docs/PHASE_0_5_CONTRACT_AUDIT.md` : Audit complet du système existant
- `docs/PROVIDER_CONTRACT_MAPPING.md` : Mapping des contrats providers

## 2.3 Phase 1 : Runtime Layer + Domain Layer Minimal

**Objectif** : Créer les fondations de la nouvelle architecture.

**Durée** : 5 jours

**Livrables** :

- ✅ RuntimeContext + Resolvers séparés
- ✅ RuntimeAdapters (Browser, Electron, Server)
- ✅ ProviderFactory
- ✅ 4 Provider Interfaces (Auth, Tenant, User, Sync)
- ✅ 5 Repository Interfaces critiques
- ✅ Domain Layer minimal (identity, tenant, sync, billing)
- ✅ 2 Services métier (AuthService, TenantService)
- ✅ Tests unitaires (couverture > 80%)
- ✅ Documentation complète

## 2.4 Non-Objectifs

- ❌ Implémenter les providers concrets (LOCAL, CLOUD, HYBRIDE)
- ❌ Modifier le code existant
- ❌ Migrer les composants React
- ❌ Migrer les stores
- ❌ Supprimer `app-mode.ts` ou `data-source-manager.ts`

---

# 3. NOUVELLE STRUCTURE DES DOSSIERS

## 3.1 Arborescence Complète

```
src/server/
├── domain/                                    # [NOUVEAU] Domain Layer (indépendant)
│   ├── identity/
│   │   ├── User.ts
│   │   ├── Role.ts
│   │   └── Permission.ts
│   ├── tenant/
│   │   └── Tenant.ts
│   ├── sync/
│   │   └── SyncEvent.ts
│   └── billing/
│       ├── Subscription.ts
│       └── Voucher.ts
│
├── application/                               # [EXISTANT] À étendre
│   ├── services/
│   │   ├── auth.service.ts
│   │   └── tenant.service.ts
│   └── use-cases/
│       ├── LoginUseCase.ts
│       └── CreateTenantUseCase.ts
│
└── infrastructure/                            # [EXISTANT] À étendre
    ├── data-source-manager.ts                # [EXISTANT] Conservé
    │
    ├── runtime/                              # [NOUVEAU] Runtime Layer
    │   ├── index.ts
    │   ├── runtime-context.ts                # RuntimeContext (expose le contexte)
    │   ├── resolvers/
    │   │   ├── RuntimeDetector.ts            # Détecte le mode d'exécution
    │   │   ├── StorageStrategyResolver.ts    # Résout le stockage
    │   │   ├── AuthStrategyResolver.ts       # Résout la stratégie d'auth
    │   │   └── DataAuthorityResolver.ts      # Résout l'autorité des données
    │   ├── adapters/
    │   │   ├── RuntimeAdapter.ts             # Interface
    │   │   ├── BrowserRuntimeAdapter.ts      # Web
    │   │   ├── ElectronRuntimeAdapter.ts     # Electron
    │   │   └── ServerRuntimeAdapter.ts       # Node.js
    │   └── provider-factory.ts               # ProviderFactory
    │
    ├── providers/                            # [NOUVEAU] Provider Interfaces (4)
    │   ├── index.ts
    │   ├── auth/IAuthProvider.ts
    │   ├── tenant/ITenantProvider.ts
    │   ├── user/IUserProvider.ts
    │   └── sync/ISyncProvider.ts
    │
    ├── repositories/                         # [NOUVEAU] Repository Interfaces (5)
    │   ├── ITenantRepository.ts
    │   ├── IUserRepository.ts
    │   ├── IRoleRepository.ts
    │   ├── IPermissionRepository.ts
    │   └── ISyncRepository.ts
    │
    ├── sqlite/                               # [EXISTANT]
    │   └── ...
    │
    ├── supabase/                             # [EXISTANT]
    │   └── ...
    │
    └── sync/                                 # [EXISTANT]
        └── ...
```

---

# 4. RUNTIMECONTEXT ARCHITECTURE

## 4.1 Architecture Séparée

**RuntimeContext** expose le contexte final, mais utilise des resolvers séparés :

```typescript
/**
 * RuntimeContext - UNIQUE source de vérité pour la configuration d'exécution
 * 
 * Architecture :
 * - RuntimeContext : Expose le contexte final (immutable)
 * - RuntimeDetector : Détecte le mode d'exécution
 * - StorageStrategyResolver : Résout la stratégie de stockage
 * - AuthStrategyResolver : Résout la stratégie d'authentification
 * - DataAuthorityResolver : Résout l'autorité des données
 * 
 * Cette classe est le SEUL endroit où la configuration d'exécution est déterminée.
 */
export class RuntimeContext {
  private static instance: RuntimeContext;
  
  // Contexte final (immutable)
  public readonly executionMode: ExecutionMode;
  public readonly runtimeType: RuntimeType;
  public readonly primaryStorage: StorageType;
  public readonly secondaryStorage: StorageType;
  public readonly syncEnabled: boolean;
  public readonly authStrategy: AuthStrategy;
  public readonly dataAuthority: DataAuthority;
  
  private constructor(context: RuntimeContextConfig) {
    this.executionMode = context.executionMode;
    this.runtimeType = context.runtimeType;
    this.primaryStorage = context.primaryStorage;
    this.secondaryStorage = context.secondaryStorage;
    this.syncEnabled = context.syncEnabled;
    this.authStrategy = context.authStrategy;
    this.dataAuthority = context.dataAuthority;
  }

  public static getInstance(): RuntimeContext {
    if (!RuntimeContext.instance) {
      RuntimeContext.instance = RuntimeContextBuilder.build();
    }
    return RuntimeContext.instance;
  }

  public isLocal(): boolean {
    return this.executionMode === 'LOCAL';
  }

  public isCloud(): boolean {
    return this.executionMode === 'CLOUD';
  }

  public isHybrid(): boolean {
    return this.executionMode === 'HYBRID';
  }

  public usesSQLite(): boolean {
    return this.primaryStorage === 'SQLITE' || this.secondaryStorage === 'SQLITE';
  }

  public usesSupabase(): boolean {
    return this.primaryStorage === 'SUPABASE' || this.secondaryStorage === 'SUPABASE';
  }

  public shouldSync(): boolean {
    return this.syncEnabled;
  }

  public static reset(): void {
    RuntimeContext.instance = null;
  }
}

export type ExecutionMode = 'LOCAL' | 'CLOUD' | 'HYBRID';
export type RuntimeType = 'DESKTOP' | 'SERVER' | 'MOBILE';
export type StorageType = 'SQLITE' | 'SUPABASE' | 'NONE';
export type AuthStrategy = 'LOCAL_JWT' | 'SUPABASE_AUTH' | 'LOCAL_JWT_WITH_SYNC';
export type DataAuthority = 'LOCAL_FIRST' | 'CLOUD_FIRST' | 'CONFLICT_RESOLUTION';

interface RuntimeContextConfig {
  executionMode: ExecutionMode;
  runtimeType: RuntimeType;
  primaryStorage: StorageType;
  secondaryStorage: StorageType;
  syncEnabled: boolean;
  authStrategy: AuthStrategy;
  dataAuthority: DataAuthority;
}
```

## 4.2 RuntimeDetector

**Fichier** : `src/server/infrastructure/runtime/resolvers/runtime-detector.ts`

```typescript
/**
 * RuntimeDetector - Détecte le mode d'exécution
 * 
 * Ordre de résolution :
 * 1. EKALA_MODE explicite (env var)
 * 2. Détection Electron
 * 3. Request metadata/header
 * 4. Fallback CLOUD
 */
export class RuntimeDetector {
  /**
   * Détecte le mode d'exécution
   */
  public static detect(): ExecutionMode {
    // 1. EKALA_MODE explicite
    const explicitMode = this.detectFromEnvVar();
    if (explicitMode) return explicitMode;

    // 2. Détection Electron
    const electronMode = this.detectFromElectron();
    if (electronMode) return electronMode;

    // 3. Request metadata (si disponible)
    const requestMode = this.detectFromRequest();
    if (requestMode) return requestMode;

    // 4. Fallback CLOUD
    return 'CLOUD';
  }

  private static detectFromEnvVar(): ExecutionMode | null {
    try {
      const mode = process.env.EKALA_MODE?.toUpperCase();
      if (mode === 'LOCAL' || mode === 'CLOUD' || mode === 'HYBRID') {
        return mode;
      }
    } catch {}
    return null;
  }

  private static detectFromElectron(): ExecutionMode | null {
    try {
      // Client-side
      if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Electron')) {
        return 'LOCAL';
      }
      // Server-side
      if (typeof process !== 'undefined' && process.versions?.electron) {
        return 'LOCAL';
      }
    } catch {}
    return null;
  }

  private static detectFromRequest(): ExecutionMode | null {
    // Sera implémenté avec HttpContext
    return null;
  }
}
```

## 4.3 StorageStrategyResolver

**Fichier** : `src/server/infrastructure/runtime/resolvers/storage-strategy-resolver.ts`

```typescript
/**
 * StorageStrategyResolver - Résout la stratégie de stockage
 */
export class StorageStrategyResolver {
  public static resolve(executionMode: ExecutionMode): {
    primary: StorageType;
    secondary: StorageType;
  } {
    switch (executionMode) {
      case 'LOCAL':
        return {
          primary: 'SQLITE',
          secondary: 'NONE'
        };
      
      case 'CLOUD':
        return {
          primary: 'SUPABASE',
          secondary: 'NONE'
        };
      
      case 'HYBRID':
        return {
          primary: 'SQLITE',
          secondary: 'SUPABASE'
        };
      
      default:
        return {
          primary: 'SUPABASE',
          secondary: 'NONE'
        };
    }
  }
}
```

## 4.4 AuthStrategyResolver

**Fichier** : `src/server/infrastructure/runtime/resolvers/auth-strategy-resolver.ts`

```typescript
/**
 * AuthStrategyResolver - Résout la stratégie d'authentification
 */
export class AuthStrategyResolver {
  public static resolve(executionMode: ExecutionMode): AuthStrategy {
    switch (executionMode) {
      case 'LOCAL':
        return 'LOCAL_JWT';
      
      case 'CLOUD':
        return 'SUPABASE_AUTH';
      
      case 'HYBRID':
        return 'LOCAL_JWT_WITH_SYNC';
      
      default:
        return 'SUPABASE_AUTH';
    }
  }
}
```

## 4.5 DataAuthorityResolver

**Fichier** : `src/server/infrastructure/runtime/resolvers/data-authority-resolver.ts`

```typescript
/**
 * DataAuthorityResolver - Résout l'autorité des données
 * 
 * DataAuthority détermine quelle source de données fait autorité
 * en cas de conflit (HYBRID uniquement).
 */
export class DataAuthorityResolver {
  public static resolve(executionMode: ExecutionMode): DataAuthority {
    switch (executionMode) {
      case 'LOCAL':
        return 'LOCAL_FIRST';
      
      case 'CLOUD':
        return 'CLOUD_FIRST';
      
      case 'HYBRID':
        // HYBRIDE : LOCAL_FIRST par défaut
        // Peut être configuré via env var
        try {
          const authority = process.env.EKALA_DATA_AUTHORITY?.toUpperCase();
          if (authority === 'CLOUD_FIRST' || authority === 'CONFLICT_RESOLUTION') {
            return authority;
          }
        } catch {}
        return 'LOCAL_FIRST';
      
      default:
        return 'CLOUD_FIRST';
    }
  }
}
```

## 4.6 RuntimeContextBuilder

**Fichier** : `src/server/infrastructure/runtime/runtime-context-builder.ts`

```typescript
/**
 * RuntimeContextBuilder - Construit le RuntimeContext
 * 
 * Utilise les resolvers séparés pour construire le contexte.
 */
export class RuntimeContextBuilder {
  public static build(): RuntimeContext {
    // 1. Détecter le mode d'exécution
    const executionMode = RuntimeDetector.detect();
    
    // 2. Détecter le type de runtime
    const runtimeType = this.detectRuntimeType();
    
    // 3. Résoudre le stockage
    const storage = StorageStrategyResolver.resolve(executionMode);
    
    // 4. Résoudre la stratégie d'authentification
    const authStrategy = AuthStrategyResolver.resolve(executionMode);
    
    // 5. Résoudre l'autorité des données
    const dataAuthority = DataAuthorityResolver.resolve(executionMode);
    
    // 6. Déterminer si sync activée
    const syncEnabled = executionMode === 'HYBRID';
    
    // 7. Créer le contexte
    const config: RuntimeContextConfig = {
      executionMode,
      runtimeType,
      primaryStorage: storage.primary,
      secondaryStorage: storage.secondary,
      syncEnabled,
      authStrategy,
      dataAuthority
    };
    
    return new RuntimeContext(config);
  }

  private static detectRuntimeType(): RuntimeType {
    // Electron
    if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Electron')) {
      return 'DESKTOP';
    }
    if (typeof process !== 'undefined' && process.versions?.electron) {
      return 'DESKTOP';
    }

    // Server
    if (typeof window === 'undefined') {
      return 'SERVER';
    }

    // Mobile
    if (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return 'MOBILE';
    }

    // Web par défaut
    return 'SERVER';
  }
}
```

## 4.7 RuntimeAdapters

### 4.7.1 RuntimeAdapter (Interface)

**Fichier** : `src/server/infrastructure/runtime/adapters/runtime-adapter.ts`

```typescript
/**
 * RuntimeAdapter - Interface pour les adapters de runtime
 */
export interface RuntimeAdapter {
  readonly type: RuntimeType;
  
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  
  getStoragePath(): string;
  getConfigPath(): string;
  
  isOnline(): boolean;
  getNetworkInfo(): NetworkInfo;
}

export interface NetworkInfo {
  online: boolean;
  connectionType?: string;
  effectiveType?: string;
}
```

### 4.7.2 BrowserRuntimeAdapter

**Fichier** : `src/server/infrastructure/runtime/adapters/browser-runtime-adapter.ts`

```typescript
/**
 * BrowserRuntimeAdapter - Adapter pour navigateur Web
 */
export class BrowserRuntimeAdapter implements RuntimeAdapter {
  readonly type: RuntimeType = 'SERVER';

  async initialize(): Promise<void> {
    // Initialisation navigateur
  }

  async shutdown(): Promise<void> {
    // Nettoyage
  }

  getStoragePath(): string {
    // Retourne le chemin de stockage (IndexedDB, etc.)
    return '/browser-storage';
  }

  getConfigPath(): string {
    return '/browser-config';
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  getNetworkInfo(): NetworkInfo {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    return {
      online: navigator.onLine,
      connectionType: connection?.type,
      effectiveType: connection?.effectiveType
    };
  }
}
```

### 4.7.3 ElectronRuntimeAdapter

**Fichier** : `src/server/infrastructure/runtime/adapters/electron-runtime-adapter.ts`

```typescript
/**
 * ElectronRuntimeAdapter - Adapter pour Electron Desktop
 */
export class ElectronRuntimeAdapter implements RuntimeAdapter {
  readonly type: RuntimeType = 'DESKTOP';

  async initialize(): Promise<void> {
    // Initialisation Electron
    // - Accès au système de fichiers
    // - Accès à SQLite
    // - Menu native
  }

  async shutdown(): Promise<void> {
    // Nettoyage
  }

  getStoragePath(): string {
    // Retourne le chemin vers la base SQLite
    return require('electron').app.getPath('userData');
  }

  getConfigPath(): string {
    return require('electron').app.getPath('userData');
  }

  isOnline(): boolean {
    // Utiliser le module net d'Electron
    return true; // TODO: Implémenter
  }

  getNetworkInfo(): NetworkInfo {
    return {
      online: true
    };
  }
}
```

### 4.7.4 ServerRuntimeAdapter

**Fichier** : `src/server/infrastructure/runtime/adapters/server-runtime-adapter.ts`

```typescript
/**
 * ServerRuntimeAdapter - Adapter pour Node.js Server
 */
export class ServerRuntimeAdapter implements RuntimeAdapter {
  readonly type: RuntimeType = 'SERVER';

  async initialize(): Promise<void> {
    // Initialisation serveur
  }

  async shutdown(): Promise<void> {
    // Nettoyage
  }

  getStoragePath(): string {
    return process.env.DATA_PATH || './data';
  }

  getConfigPath(): string {
    return process.env.CONFIG_PATH || './config';
  }

  isOnline(): boolean {
    return true; // Server is always online
  }

  getNetworkInfo(): NetworkInfo {
    return {
      online: true
    };
  }
}
```

---

# 5. PLAN D'IMPLÉMENTATION DÉTAILLÉ

## Phase 0.5 : Contract Discovery & Existing System Audit (Jour 0)

### 5.0.1 Objectif

Analyser le système existant SANS modifier.

### 5.0.2 Livrables

**Document 1** : `docs/PHASE_0_5_CONTRACT_AUDIT.md`

**Contenu** :

1. **Backend Routes & Controllers**
   - Liste des routes
   - Méthodes HTTP
   - Middleware utilisés
   - Authentification requise

2. **Services Actuels**
   - auth.service.ts
   - tenant.service.ts
   - order.service.ts
   - product.service.ts
   - etc.

3. **Stores Frontend**
   - useAuthStore
   - useOrderStore
   - useTableStore
   - etc.

4. **Système Auth Actuel**
   - Login email
   - Login PIN
   - JWT generation
   - Token refresh

5. **RBAC Actuel**
   - Rôles
   - Permissions
   - Guards

6. **Tenant Resolver Actuel**
   - Comment le tenant est résolu
   - Slug matching
   - Header parsing

7. **Billing/Voucher System**
   - Subscription
   - Voucher
   - Payment

8. **Sync Engine Existant**
   - Outbox
   - Replication
   - Conflict Resolver
   - DLQ

9. **SQLite Repositories**
   - Liste des repositories
   - Méthodes disponibles

10. **Supabase Repositories**
    - Liste des repositories
    - Méthodes disponibles

11. **Electron Runtime**
    - Main process
    - Renderer process
    - IPC communication

**Document 2** : `docs/PROVIDER_CONTRACT_MAPPING.md`

**Contenu** :

Pour chaque provider futur :

```
# IAuthProvider

## Méthodes existantes nécessaires

### Backend
- POST /auth/login/email
- POST /auth/login/pin
- POST /auth/logout
- POST /auth/refresh
- GET /auth/me
- GET /auth/status

### Frontend
- loginEmail(email, password)
- loginPin(pin, identity, tenantSlug)
- logout()
- refresh()
- me()
- checkHealth()

## Migration prévue

1. Créer IAuthProvider interface
2. Implémenter LocalAuthProvider (SQLite)
3. Implémenter CloudAuthProvider (Supabase)
4. Implémenter HybridAuthProvider (SQLite + Sync)
5. Migrer useAuthStore vers IAuthProvider
6. Migrer LoginPage vers IAuthProvider
```

**Durée** : 1 jour

---

## Priorité 1 : RuntimeContext + Resolvers (Jour 1)

### 5.1.1 Fichiers à Créer

```
src/server/infrastructure/runtime/
├── index.ts
├── runtime-context.ts                    # RuntimeContext (expose le contexte)
├── runtime-context-builder.ts            # RuntimeContextBuilder
├── resolvers/
│   ├── runtime-detector.ts               # Détecte le mode
│   ├── storage-strategy-resolver.ts      # Résout le stockage
│   ├── auth-strategy-resolver.ts         # Résout l'auth
│   └── data-authority-resolver.ts        # Résout l'autorité
├── adapters/
│   ├── runtime-adapter.ts                # Interface
│   ├── browser-runtime-adapter.ts        # Web
│   ├── electron-runtime-adapter.ts       # Electron
│   └── server-runtime-adapter.ts         # Node.js
└── provider-factory.ts                   # ProviderFactory
```

### 5.1.2 Tests

**Fichier** : `src/server/infrastructure/runtime/__tests__/runtime-context.test.ts`

```typescript
describe('RuntimeContext', () => {
  beforeEach(() => {
    RuntimeContext.reset();
  });

  it('should detect LOCAL mode from EKALA_MODE', () => {
    const originalEnv = process.env.EKALA_MODE;
    process.env.EKALA_MODE = 'LOCAL';
    
    const ctx = RuntimeContext.getInstance();
    expect(ctx.isLocal()).toBe(true);
    expect(ctx.usesSQLite()).toBe(true);
    
    process.env.EKALA_MODE = originalEnv;
  });

  it('should detect CLOUD mode by default', () => {
    const ctx = RuntimeContext.getInstance();
    expect(ctx.isCloud()).toBe(true);
    expect(ctx.usesSupabase()).toBe(true);
  });

  it('should detect HYBRID mode', () => {
    const originalEnv = process.env.EKALA_MODE;
    process.env.EKALA_MODE = 'HYBRID';
    
    const ctx = RuntimeContext.getInstance();
    expect(ctx.isHybrid()).toBe(true);
    expect(ctx.usesSQLite()).toBe(true);
    expect(ctx.usesSupabase()).toBe(true);
    expect(ctx.shouldSync()).toBe(true);
    expect(ctx.dataAuthority).toBe('LOCAL_FIRST');
    
    process.env.EKALA_MODE = originalEnv;
  });
});
```

---

## Priorité 2 : ProviderFactory (Jour 1)

### 5.2.1 ProviderFactory

**Fichier** : `src/server/infrastructure/runtime/provider-factory.ts`

```typescript
/**
 * ProviderFactory - UNIQUE point de création des providers
 */
export class ProviderFactory {
  private static runtimeContext = RuntimeContext.getInstance();
  private static providers: Map<string, any> = new Map();
  private static initialized = false;

  public static initialize(): void {
    if (ProviderFactory.initialized) return;
    
    const ctx = ProviderFactory.runtimeContext;
    console.log(`[ProviderFactory] Initializing for mode: ${ctx.executionMode}`);
    
    // Pré-charger les providers critiques
    ProviderFactory.getAuthProvider();
    ProviderFactory.getTenantProvider();
    ProviderFactory.getUserProvider();
    ProviderFactory.getSyncProvider();
    
    ProviderFactory.initialized = true;
  }

  public static getAuthProvider(): IAuthProvider {
    const cacheKey = 'auth-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createAuthProvider());
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  public static getTenantProvider(): ITenantProvider {
    const cacheKey = 'tenant-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createTenantProvider());
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  public static getUserProvider(): IUserProvider {
    const cacheKey = 'user-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createUserProvider());
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  public static getSyncProvider(): ISyncProvider {
    const cacheKey = 'sync-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createSyncProvider());
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  private static createAuthProvider(): IAuthProvider {
    throw new Error('AuthProvider not implemented yet');
  }

  private static createTenantProvider(): ITenantProvider {
    throw new Error('TenantProvider not implemented yet');
  }

  private static createUserProvider(): IUserProvider {
    throw new Error('UserProvider not implemented yet');
  }

  private static createSyncProvider(): ISyncProvider {
    throw new Error('SyncProvider not implemented yet');
  }

  public static reset(): void {
    ProviderFactory.providers.clear();
    ProviderFactory.initialized = false;
  }
}
```

---

## Priorité 3 : Provider Interfaces (Jour 2)

### 5.3.1 IAuthProvider

**Fichier** : `src/server/infrastructure/providers/auth/IAuthProvider.ts`

```typescript
export interface IAuthProvider {
  login(email: string, password: string): Promise<AuthResult>;
  loginPin(pinCode: string, identity?: string, tenantSlug?: string): Promise<AuthResult>;
  logout(): Promise<void>;
  refresh(): Promise<AuthResult>;
  me(): Promise<User>;
  checkHealth(): Promise<boolean>;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface User {
  id: number;
  fullName: string;
  email?: string;
  username: string;
  role: UserRole;
  tenantId: number;
  tenantName: string;
  tenantSlug: string;
  status: UserStatus;
}

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter';
export type UserStatus = 'active' | 'suspended' | 'cancelled' | 'trial' | 'past_due' | 'expired';
```

### 5.3.2 ITenantProvider

**Fichier** : `src/server/infrastructure/providers/tenant/ITenantProvider.ts`

```typescript
export interface ITenantProvider {
  findBySlug(slug: string): Promise<Tenant | null>;
  findById(id: number): Promise<Tenant | null>;
  create(data: CreateTenantDTO): Promise<Tenant>;
  update(id: number, data: UpdateTenantDTO): Promise<Tenant>;
  delete(id: number): Promise<void>;
  findAll(filters?: TenantFilters): Promise<Tenant[]>;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  status: TenantStatus;
  planId?: number;
  ownerId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantStatus = 'active' | 'suspended' | 'cancelled' | 'trial' | 'past_due' | 'expired';

export interface CreateTenantDTO {
  name: string;
  slug: string;
  ownerId?: number;
  planId?: number;
}

export interface UpdateTenantDTO {
  name?: string;
  slug?: string;
  status?: TenantStatus;
  planId?: number;
}

export interface TenantFilters {
  status?: TenantStatus;
  planId?: number;
  search?: string;
  page?: number;
  limit?: number;
}
```

### 5.3.3 IUserProvider

**Fichier** : `src/server/infrastructure/providers/user/IUserProvider.ts`

```typescript
export interface IUserProvider {
  findById(id: number, tenantId: number): Promise<User | null>;
  findByEmail(email: string, tenantId: number): Promise<User | null>;
  create(data: CreateUserDTO): Promise<User>;
  update(id: number, data: UpdateUserDTO, tenantId: number): Promise<User>;
  delete(id: number, tenantId: number): Promise<void>;
  findAllByTenant(tenantId: number, filters?: UserFilters): Promise<User[]>;
  verifyCredentials(email: string, password: string, tenantId: number): Promise<User | null>;
  verifyPin(pinCode: string, tenantId: number): Promise<User | null>;
}

export interface User {
  id: number;
  tenantId: number;
  fullName: string;
  email?: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter';

export interface CreateUserDTO {
  tenantId: number;
  fullName: string;
  email?: string;
  username: string;
  password?: string;
  pinCode?: string;
  role: UserRole;
}

export interface UpdateUserDTO {
  fullName?: string;
  email?: string;
  password?: string;
  pinCode?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}
```

### 5.3.4 ISyncProvider

**Fichier** : `src/server/infrastructure/providers/sync/ISyncProvider.ts`

```typescript
export interface ISyncProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  syncEntity(entityType: string, entityId: string): Promise<void>;
  syncAll(): Promise<void>;
  isSyncing(): boolean;
  getStatus(): SyncStatus;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSyncAt?: Date;
  pendingChanges: number;
  errors: SyncError[];
}

export interface SyncError {
  entityType: string;
  entityId: string;
  error: string;
  timestamp: Date;
}
```

---

## Priorité 4 : Repository Interfaces (Jour 2-3)

### 5.4.1 ITenantRepository

**Fichier** : `src/server/infrastructure/repositories/ITenantRepository.ts`

```typescript
export interface ITenantRepository {
  findBySlug(slug: string): Promise<Tenant | null>;
  findById(id: number): Promise<Tenant | null>;
  create(data: CreateTenantDTO): Promise<Tenant>;
  update(id: number, data: UpdateTenantDTO): Promise<Tenant>;
  delete(id: number): Promise<void>;
  findAll(filters?: TenantFilters): Promise<Tenant[]>;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  status: TenantStatus;
  planId?: number;
  ownerId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantStatus = 'active' | 'suspended' | 'cancelled' | 'trial' | 'past_due' | 'expired';

export interface CreateTenantDTO {
  name: string;
  slug: string;
  ownerId?: number;
  planId?: number;
}

export interface UpdateTenantDTO {
  name?: string;
  slug?: string;
  status?: TenantStatus;
  planId?: number;
}

export interface TenantFilters {
  status?: TenantStatus;
  planId?: number;
  search?: string;
  page?: number;
  limit?: number;
}
```

### 5.4.2 IUserRepository

**Fichier** : `src/server/infrastructure/repositories/IUserRepository.ts`

```typescript
export interface IUserRepository {
  findById(id: number, tenantId: number): Promise<User | null>;
  findByEmail(email: string, tenantId: number): Promise<User | null>;
  create(data: CreateUserDTO): Promise<User>;
  update(id: number, data: UpdateUserDTO, tenantId: number): Promise<User>;
  delete(id: number, tenantId: number): Promise<void>;
  findAllByTenant(tenantId: number, filters?: UserFilters): Promise<User[]>;
  verifyCredentials(email: string, password: string, tenantId: number): Promise<User | null>;
  verifyPin(pinCode: string, tenantId: number): Promise<User | null>;
}

export interface User {
  id: number;
  tenantId: number;
  fullName: string;
  email?: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter';

export interface CreateUserDTO {
  tenantId: number;
  fullName: string;
  email?: string;
  username: string;
  password?: string;
  pinCode?: string;
  role: UserRole;
}

export interface UpdateUserDTO {
  fullName?: string;
  email?: string;
  password?: string;
  pinCode?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}
```

### 5.4.3 Autres Repositories

- `IRoleRepository.ts`
- `IPermissionRepository.ts`
- `ISyncRepository.ts`

---

## Priorité 5 : Domain Layer Minimal (Jour 3)

### 5.5.1 Identity Domain

**Fichier** : `src/server/domain/identity/User.ts`

```typescript
export class User {
  constructor(
    public readonly id: number,
    public readonly tenantId: number,
    public fullName: string,
    public email?: string,
    public readonly username: string,
    public role: UserRole,
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  isAdmin(): boolean {
    return ['super_admin', 'owner', 'admin'].includes(this.role);
  }

  canManageUsers(): boolean {
    return ['super_admin', 'owner', 'admin', 'manager'].includes(this.role);
  }
}

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter';
```

**Fichier** : `src/server/domain/identity/Role.ts`

```typescript
export class Role {
  constructor(
    public readonly id: number,
    public readonly tenantId: number,
    public name: string,
    public permissions: Permission[],
    public createdAt: Date
  ) {}

  hasPermission(permission: string): boolean {
    return this.permissions.some(p => p.name === permission);
  }
}

export interface Permission {
  id: number;
  name: string;
  description?: string;
}
```

### 5.5.2 Tenant Domain

**Fichier** : `src/server/domain/tenant/Tenant.ts`

```typescript
export class Tenant {
  constructor(
    public readonly id: number,
    public name: string,
    public slug: string,
    public status: TenantStatus,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public readonly planId?: number,
    public readonly ownerId?: number
  ) {}

  isActive(): boolean {
    return this.status === 'active';
  }
}

export type TenantStatus = 'active' | 'suspended' | 'cancelled' | 'trial' | 'past_due' | 'expired';
```

### 5.5.3 Sync Domain

**Fichier** : `src/server/domain/sync/SyncEvent.ts`

```typescript
export class SyncEvent {
  constructor(
    public readonly id: string,
    public readonly tenantId: number,
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly operation: 'CREATE' | 'UPDATE' | 'DELETE',
    public readonly data: Record<string, any>,
    public status: SyncEventStatus,
    public readonly createdAt: Date,
    public syncedAt?: Date
  ) {}
}

export type SyncEventStatus = 'pending' | 'synced' | 'failed';
```

### 5.5.4 Billing Domain

**Fichiers existants** à déplacer :

- `src/server/domain/billing/subscription/Subscription.ts` → `src/server/domain/billing/Subscription.ts`
- `src/server/domain/billing/voucher/Voucher.ts` → `src/server/domain/billing/Voucher.ts`

---

## Priorité 6 : Services Métier (Jour 4)

### 5.6.1 AuthService

**Fichier** : `src/server/application/services/auth.service.ts`

```typescript
export class AuthService {
  private authProvider: IAuthProvider;

  constructor() {
    this.authProvider = ProviderFactory.getAuthProvider();
  }

  async loginEmail(email: string, password: string): Promise<AuthResult> {
    if (!email || !email.includes('@')) {
      throw new Error('Email invalide');
    }
    if (!password || password.length < 8) {
      throw new Error('Mot de passe trop court');
    }
    return this.authProvider.login(email, password);
  }

  async loginPin(pinCode: string, identity?: string, tenantSlug?: string): Promise<AuthResult> {
    if (!pinCode || pinCode.length < 4) {
      throw new Error('PIN invalide');
    }
    return this.authProvider.loginPin(pinCode, identity, tenantSlug);
  }

  async logout(): Promise<void> {
    return this.authProvider.logout();
  }

  async refresh(): Promise<AuthResult> {
    return this.authProvider.refresh();
  }

  async me(): Promise<User> {
    return this.authProvider.me();
  }
}
```

### 5.6.2 TenantService

**Fichier** : `src/server/application/services/tenant.service.ts`

```typescript
export class TenantService {
  private tenantProvider: ITenantProvider;

  constructor() {
    this.tenantProvider = ProviderFactory.getTenantProvider();
  }

  async getTenantBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantProvider.findBySlug(slug);
    if (!tenant) {
      throw new Error(`Tenant "${slug}" not found`);
    }
    return tenant;
  }

  async createTenant(data: CreateTenantDTO): Promise<Tenant> {
    return this.tenantProvider.create(data);
  }
}
```

---

## Priorité 7 : Tests et Documentation (Jour 5)

### 5.7.1 Tests

**Objectif** : Couverture > 80% sur les composants critiques

**Tests à écrire** :

1. **RuntimeContext** (100%)
   - Détection du mode
   - Résolution depuis EKALA_MODE
   - Résolution depuis Electron

2. **Resolvers** (100%)
   - RuntimeDetector
   - StorageStrategyResolver
   - AuthStrategyResolver
   - DataAuthorityResolver

3. **ProviderFactory** (100%)
   - Initialisation
   - Cache
   - Reset

4. **Services Métier** (80%)
   - AuthService
   - TenantService

### 5.7.2 Documentation

**Fichier** : `docs/PHASE_1_ARCHITECTURE_V3.md`

---

# 6. FICHIERS CRÉÉS

## 6.1 Runtime Layer (10 fichiers)

```
src/server/infrastructure/runtime/
├── index.ts
├── runtime-context.ts
├── runtime-context-builder.ts
├── resolvers/
│   ├── runtime-detector.ts
│   ├── storage-strategy-resolver.ts
│   ├── auth-strategy-resolver.ts
│   └── data-authority-resolver.ts
├── adapters/
│   ├── runtime-adapter.ts
│   ├── browser-runtime-adapter.ts
│   ├── electron-runtime-adapter.ts
│   └── server-runtime-adapter.ts
└── provider-factory.ts
```

## 6.2 Provider Interfaces (4 fichiers)

```
src/server/infrastructure/providers/
├── auth/IAuthProvider.ts
├── tenant/ITenantProvider.ts
├── user/IUserProvider.ts
└── sync/ISyncProvider.ts
```

## 6.3 Repository Interfaces (5 fichiers)

```
src/server/infrastructure/repositories/
├── ITenantRepository.ts
├── IUserRepository.ts
├── IRoleRepository.ts
├── IPermissionRepository.ts
└── ISyncRepository.ts
```

## 6.4 Domain Layer Minimal (8 fichiers)

```
src/server/domain/
├── identity/
│   ├── User.ts
│   ├── Role.ts
│   └── Permission.ts
├── tenant/
│   └── Tenant.ts
├── sync/
│   └── SyncEvent.ts
└── billing/
    ├── Subscription.ts (déjà existe)
    └── Voucher.ts (déjà existe)
```

## 6.5 Services Métier (2 fichiers)

```
src/server/application/services/
├── auth.service.ts
└── tenant.service.ts
```

## 6.6 Tests (10+ fichiers)

```
src/server/infrastructure/runtime/__tests__/
├── runtime-context.test.ts
├── runtime-detector.test.ts
├── storage-strategy-resolver.test.ts
├── auth-strategy-resolver.test.ts
├── data-authority-resolver.test.ts
└── provider-factory.test.ts

src/server/domain/__tests__/
├── identity/User.test.ts
├── tenant/Tenant.test.ts
└── sync/SyncEvent.test.ts

src/server/application/services/__tests__/
├── auth.service.test.ts
└── tenant.service.test.ts
```

**Total** : ~35 nouveaux fichiers

---

# 7. RESPONSABILITÉS

## 7.1 RuntimeContext

**Responsabilité** : Exposer le contexte d'exécution (immutable)

**Méthodes** :

- `getInstance()` : Singleton
- `isLocal()`, `isCloud()`, `isHybrid()` : Vérifier le mode
- `usesSQLite()`, `usesSupabase()` : Vérifier le stockage
- `shouldSync()` : Vérifier si sync activée

**Pourquoi** : Centraliser TOUTE la configuration d'exécution dans un seul objet immutable.

## 7.2 RuntimeDetector

**Responsabilité** : Détecter le mode d'exécution

**Méthodes** :

- `detect()` : Détecte le mode selon l'ordre :
  1. EKALA_MODE env var
  2. Electron detection
  3. Request metadata
  4. Fallback CLOUD

**Pourquoi** : Séparer la détection du contexte.

## 7.3 StorageStrategyResolver

**Responsabilité** : Résoudre la stratégie de stockage

**Méthodes** :

- `resolve(executionMode)` : Retourne primary/secondary storage

**Pourquoi** : Séparer la logique de stockage.

## 7.4 AuthStrategyResolver

**Responsabilité** : Résoudre la stratégie d'authentification

**Méthodes** :

- `resolve(executionMode)` : Retourne LOCAL_JWT, SUPABASE_AUTH, ou LOCAL_JWT_WITH_SYNC

**Pourquoi** : Séparer la logique d'authentification.

## 7.5 DataAuthorityResolver

**Responsabilité** : Résoudre l'autorité des données

**Méthodes** :

- `resolve(executionMode)` : Retourne LOCAL_FIRST, CLOUD_FIRST, ou CONFLICT_RESOLUTION

**Pourquoi** : Préparer la résolution des conflits HYBRIDE.

## 7.6 RuntimeAdapters

**Responsabilité** : Adapter le runtime selon l'environnement

**Implémentations** :

- `BrowserRuntimeAdapter` : Web
- `ElectronRuntimeAdapter` : Desktop
- `ServerRuntimeAdapter` : Node.js

**Pourquoi** : Support explicite des 3 environnements.

## 7.7 ProviderFactory

**Responsabilité** : Créer les providers selon RuntimeContext

**Méthodes** :

- `initialize()` : Initialiser tous les providers
- `getAuthProvider()`, `getTenantProvider()`, etc.
- `reset()` : Reset pour les tests

**Pourquoi** : Masquer la complexité de la création des providers.

---

# 8. DÉPENDANCES

## 8.1 Dépendances entre Couches

```
Domain Layer (identité, tenant, sync, billing)
  ↓ (aucune dépendance)
  
Application Layer (services, use-cases)
  ↓ (dépend de)
  
Infrastructure Layer (runtime, providers, repositories)
  ↓ (dépend de)
  
Presentation Layer (routes, controllers)
```

## 8.2 Dépendances Internes

### RuntimeContext
- **Dépend de** : RuntimeDetector, StorageStrategyResolver, AuthStrategyResolver, DataAuthorityResolver
- **Utilisé par** : ProviderFactory

### ProviderFactory
- **Dépend de** : RuntimeContext, Provider Interfaces
- **Utilisé par** : Services métier

### Provider Interfaces
- **Dépend de** : Aucune
- **Utilisé par** : ProviderFactory, Services métier

### Repository Interfaces
- **Dépend de** : Domain Layer
- **Utilisé par** : Providers (futur)

### Services Métier
- **Dépend de** : ProviderFactory, Provider Interfaces
- **Utilisé par** : Controllers/Routes (futur)

---

# 9. STRATÉGIE DE MIGRATION ORIENTÉE RISQUE

## 9.1 Phase 0.5 : Contract Discovery (1 jour)

**Objectif** : Analyser le système existant

**Livrables** :

- `docs/PHASE_0_5_CONTRACT_AUDIT.md`
- `docs/PROVIDER_CONTRACT_MAPPING.md`

**Risque** : Faible (lecture seule)

## 9.2 Phase 1 : Runtime Layer + Domain Minimal (5 jours)

### Jour 1 : RuntimeContext + Resolvers

**Livrables** :

- RuntimeContext
- RuntimeDetector
- StorageStrategyResolver
- AuthStrategyResolver
- DataAuthorityResolver
- RuntimeContextBuilder

**Tests** : RuntimeContext tests

### Jour 1-2 : ProviderFactory + RuntimeAdapters

**Livrables** :

- ProviderFactory
- BrowserRuntimeAdapter
- ElectronRuntimeAdapter
- ServerRuntimeAdapter

**Tests** : ProviderFactory tests

### Jour 2-3 : Provider Interfaces

**Livrables** :

- IAuthProvider
- ITenantProvider
- IUserProvider
- ISyncProvider

**Tests** : Contract tests

### Jour 3-4 : Repository Interfaces

**Livrables** :

- ITenantRepository
- IUserRepository
- IRoleRepository
- IPermissionRepository
- ISyncRepository

**Tests** : Contract tests

### Jour 3-4 : Domain Layer Minimal

**Livrables** :

- identity/User, Role, Permission
- tenant/Tenant
- sync/SyncEvent
- billing/Subscription, Voucher

**Tests** : Domain tests

### Jour 4-5 : Services Métier

**Livrables** :

- AuthService
- TenantService

**Tests** : Service tests

### Jour 5 : Tests + Documentation

**Livrables** :

- Tests (couverture > 80%)
- Documentation

---

# 10. RISQUES ET MITIGATIONS

## 10.1 Risques Identifiés

### Risque 1 : RuntimeContext trop complexe

**Probabilité** : Faible  
**Impact** : Moyen  
**Mitigation** : Architecture séparée avec resolvers

### Risque 2 : Oublis dans les Interfaces

**Probabilité** : Faible  
**Impact** : Élevé  
**Mitigation** : Phase 0.5 + PROVIDER_CONTRACT_MAPPING

### Risque 3 : Incompatibilité

**Probabilité** : Faible  
**Impact** : Élevé  
**Mitigation** : Code parallèle, aucune modification de l'existant

### Risque 4 : Tests incomplets

**Probabilité** : Moyenne  
**Impact** : Moyen  
**Mitigation** : Couverture 80% sur composants critiques

## 10.2 Matrice de Risques

| Risque | Probabilité | Impact | Mitigation | Résiduel |
|--------|-------------|--------|------------|----------|
| RuntimeContext complexe | Faible | Moyen | Resolvers séparés | Faible |
| Oublis interfaces | Faible | Élevé | Phase 0.5 | Faible |
| Incompatibilité | Faible | Élevé | Code parallèle | Très faible |
| Tests incomplets | Moyenne | Moyen | Couverture 80% | Faible |

**Risque résiduel global** : FAIBLE

---

# 11. CHECKLIST DE VALIDATION

## 11.1 Phase 0.5

- [ ] PHASE_0_5_CONTRACT_AUDIT.md créé
- [ ] PROVIDER_CONTRACT_MAPPING.md créé
- [ ] Audit complet du système existant
- [ ] Mapping des contrats providers

## 11.2 Phase 1 Technique

### RuntimeContext
- [ ] RuntimeContext détecte LOCAL via EKALA_MODE
- [ ] RuntimeContext détecte CLOUD par défaut
- [ ] RuntimeContext détecte HYBRID
- [ ] RuntimeContext détecte Electron
- [ ] RuntimeContext résout dataAuthority
- [ ] RuntimeContextBuilder fonctionne

### Resolvers
- [ ] RuntimeDetector fonctionne
- [ ] StorageStrategyResolver fonctionne
- [ ] AuthStrategyResolver fonctionne
- [ ] DataAuthorityResolver fonctionne

### RuntimeAdapters
- [ ] BrowserRuntimeAdapter créé
- [ ] ElectronRuntimeAdapter créé
- [ ] ServerRuntimeAdapter créé

### ProviderFactory
- [ ] ProviderFactory crée les providers
- [ ] ProviderFactory cache les providers
- [ ] ProviderFactory reset fonctionne

### Provider Interfaces
- [ ] IAuthProvider définie
- [ ] ITenantProvider définie
- [ ] IUserProvider définie
- [ ] ISyncProvider définie

### Repository Interfaces
- [ ] ITenantRepository définie
- [ ] IUserRepository définie
- [ ] IRoleRepository définie
- [ ] IPermissionRepository définie
- [ ] ISyncRepository définie

### Domain Layer
- [ ] identity/User créé
- [ ] identity/Role créé
- [ ] tenant/Tenant créé
- [ ] sync/SyncEvent créé
- [ ] billing/Subscription créé
- [ ] billing/Voucher créé

### Services Métier
- [ ] AuthService créé
- [ ] TenantService créé

### Tests
- [ ] Tests RuntimeContext passent
- [ ] Tests Resolvers passent
- [ ] Tests ProviderFactory passent
- [ ] Tests Services passent
- [ ] Couverture > 80%

### Documentation
- [ ] Architecture documentée
- [ ] Interfaces documentées
- [ ] Services documentés

## 11.3 Non-Régression

- [ ] Aucun fichier existant modifié
- [ ] Tests existants passent
- [ ] Application démarre

---

# 12. PROCHAINES ÉTAPES

## 12.1 Après Phase 1

### Phase 2 : Backend Providers (2 semaines)

**Objectif** : Implémenter les providers concrets

**Livrables** :

- LocalAuthProvider, CloudAuthProvider, HybridAuthProvider
- LocalTenantProvider, CloudTenantProvider, HybridTenantProvider
- Tests pour chaque provider

### Phase 3 : Frontend Services (1 semaine)

**Objectif** : Créer les services frontend

### Phase 4 : Migration des Stores (1 semaine)

**Objectif** : Migrer les stores

### Phase 5 : Migration des Composants (2 semaines)

**Objectif** : Migrer LoginPage et autres composants

### Phase 6 : Nettoyage (1 semaine)

**Objectif** : Supprimer l'ancien code

---

# CONCLUSION

## Résumé de la Phase 1 V3

**Objectif** : Créer les fondations de la nouvelle architecture

**Durée** : 6 jours (1 jour Phase 0.5 + 5 jours Phase 1)

**Livrables** :

- ✅ Phase 0.5 : Audit complet + Contract Mapping
- ✅ RuntimeContext + Resolvers séparés
- ✅ RuntimeAdapters (Browser, Electron, Server)
- ✅ ProviderFactory
- ✅ 4 Provider Interfaces
- ✅ 5 Repository Interfaces
- ✅ Domain Layer minimal (identity, tenant, sync, billing)
- ✅ 2 Services métier
- ✅ Tests (couverture > 80%)

**Risques** : Faible (code parallèle)

**Impact** : Aucune régression

## Bénéfices

- ✅ Architecture propre et évolutive
- ✅ 0 dépendance au mode dans les services
- ✅ Testabilité maximale
- ✅ Évolutivité (ajout de mode facile)
- ✅ Maintenabilité améliorée

## Prochaines Étapes

1. **Valider** ce plan V3
2. **Démarrer** Phase 0.5 : Contract Discovery
3. **Exécuter** Phase 1 selon le plan
4. **Valider** chaque checkpoint
5. **Passer** à Phase 2

---

**Fin du Plan d'Implémentation Phase 1 V3**

*Document généré par l'Architecte Logiciel Senior*  
*Date : 2026-01-07*