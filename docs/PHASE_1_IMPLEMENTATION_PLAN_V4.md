# PHASE 1 — PLAN D'IMPLÉMENTATION V4 FINALE
## Shared Runtime Layer + Domain Layer Minimal + Migration Progressive

**Date** : 2026-01-07  
**Auteur** : Architecte Logiciel Senior  
**Statut** : PLAN D'IMPLÉMENTATION V4  
**Version** : 4.0.0  
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
- ✅ JWT local signé par backend local
- ✅ Synchronisation **metadata** vers Supabase
- ✅ Electron Desktop App + Sync Engine
- ✅ Outbox + Replication Engine + Conflict Resolver + DLQ
- ✅ Fonctionnement offline-first

**RÈGLE ABSOLUE** : HYBRIDE = SQLite identity + JWT local + sync metadata. Ne jamais mélanger SQLite Auth et Supabase Auth comme deux sources concurrentes.

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

## 1.3 RuntimeContext Partagé (Cross-Platform)

**Règle** : RuntimeContext doit être partagé entre tous les environnements :

- Backend Node.js
- Frontend React
- Electron Main Process
- Electron Renderer Process

**Localisation** : `src/core/runtime/` (couche partagée)

**Interdiction** : Aucune dépendance frontend → backend pour le runtime.

## 1.4 RuntimeContext n'est pas un God Object

**Règle** : RuntimeContext expose le contexte final, mais utilise des resolvers séparés :

```
RuntimeContext
├── RuntimeDetector (interface)
│   ├── BrowserRuntimeDetector
│   ├── ElectronRuntimeDetector
│   └── ServerRuntimeDetector
├── StorageStrategyResolver
├── AuthStrategyResolver
└── DataAuthorityResolver
```

## 1.5 RuntimeType

**Types** :

- `DESKTOP` : Electron Desktop App
- `SERVER` : Node.js Backend
- `WEB` : Browser Web App
- `MOBILE` : Mobile Browser

**Règle** : BrowserRuntimeAdapter retourne `WEB`, pas `SERVER`.

## 1.6 Résolution du Mode d'Exécution

**Ordre de résolution** :

1. **EKALA_MODE explicite** (env var)
   - `EKALA_MODE=LOCAL`
   - `EKALA_MODE=CLOUD`
   - `EKALA_MODE=HYBRID`

2. **Détection spécifique** (par detector)
   - BrowserRuntimeDetector
   - ElectronRuntimeDetector
   - ServerRuntimeDetector

3. **Request metadata/header** (X-Runtime-Mode)

4. **Fallback CLOUD**

**Interdiction** : Ne jamais utiliser `typeof window === undefined` => CLOUD

## 1.7 Data Authority pour HYBRIDE

**DataAuthority** :

- `LOCAL_FIRST` : SQLite source de vérité, Supabase réplica (DEFAULT HYBRID)
- `CLOUD_FIRST` : Supabase source de vérité, SQLite cache
- `CONFLICT_RESOLUTION` : Résolution automatique des conflits

**RuntimeContext expose** :

```typescript
dataAuthority: 'LOCAL_FIRST' | 'CLOUD_FIRST' | 'CONFLICT_RESOLUTION'
```

**Architecture future par domaine** (à préparer, pas à implémenter) :

```
Orders => LOCAL_FIRST
Inventory => LOCAL_FIRST
Subscription => CLOUD_FIRST
Billing => CLOUD_FIRST
```

## 1.8 ProviderFactory avec PendingProviders

**Règle** : Ne pas utiliser `throw new Error('Provider not implemented yet')`

**Solution** : Créer des PendingProviders temporaires :

```typescript
class PendingAuthProvider implements IAuthProvider {
  async login() { return mockResult; }
  // ... autres méthodes
}
```

**Objectif** : L'application peut démarrer pendant la migration.

## 1.9 Domain Layer Minimal

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

**Règle** : Le Domain Layer est la référence métier. Les repositories et providers doivent mapper vers le domaine.

## 1.10 Stratégie de Tests Réaliste

**Phase 1** :

- Tests unitaires RuntimeContext
- Tests unitaires Resolvers
- Tests unitaires ProviderFactory
- Tests de contrat (contrats respectés)

**Après implémentation réelle** :

- Integration tests
- E2E tests

**Ne pas viser 95% immédiatement** : Viser 80% sur les composants critiques.

## 1.11 Phase 0.5 Obligatoire

**Règle** : Ne commencer aucune migration de code existant avant d'avoir produit :

1. `docs/PHASE_0_5_CONTRACT_AUDIT.md`
2. `docs/PROVIDER_CONTRACT_MAPPING.md`

**Interdictions pendant Phase 0.5** :

- ❌ Aucun fichier existant modifié
- ❌ Aucun refactoring
- ❌ Aucun nouveau provider concret
- ❌ Aucun changement de base de données
- ❌ Aucun changement de comportement utilisateur

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

- ✅ RuntimeContext partagé dans `src/core/runtime/`
- ✅ RuntimeDetector avec détecteurs séparés
- ✅ RuntimeAdapters (Browser, Electron, Server)
- ✅ ProviderFactory avec PendingProviders
- ✅ 4 Provider Interfaces (Auth, Tenant, User, Sync)
- ✅ 5 Repository Interfaces critiques
- ✅ Domain Layer minimal (identity, tenant, sync, billing)
- ✅ 2 Services métier (AuthService, TenantService)
- ✅ Tests unitaires (couverture > 80%)
- ✅ Documentation complète

## 2.4 Non-Objectifs

- ❌ Implémenter les providers concrets (LOCAL, CLOUD, HYBRID)
- ❌ Modifier le code existant
- ❌ Migrer les composants React
- ❌ Migrer les stores
- ❌ Supprimer `app-mode.ts` ou `data-source-manager.ts`

---

# 3. NOUVELLE STRUCTURE DES DOSSIERS

## 3.1 Arborescence Complète

```
src/
├── core/                                    # [NOUVEAU] Couche partagée (cross-platform)
│   ├── runtime/                             # [NOUVEAU] Runtime Layer (partagé)
│   │   ├── index.ts
│   │   ├── runtime-context.ts               # RuntimeContext (expose le contexte)
│   │   ├── runtime-context-builder.ts       # RuntimeContextBuilder
│   │   ├── resolvers/
│   │   │   ├── runtime-detector.ts          # Interface
│   │   │   ├── browser-runtime-detector.ts  # Browser
│   │   │   ├── electron-runtime-detector.ts # Electron
│   │   │   ├── server-runtime-detector.ts   # Node.js
│   │   │   ├── storage-strategy-resolver.ts
│   │   │   ├── auth-strategy-resolver.ts
│   │   │   └── data-authority-resolver.ts
│   │   └── adapters/
│   │       ├── runtime-adapter.ts           # Interface
│   │       ├── browser-runtime-adapter.ts   # WEB
│   │       ├── electron-runtime-adapter.ts  # DESKTOP
│   │       └── server-runtime-adapter.ts    # SERVER
│   │
│   └── domain/                              # [NOUVEAU] Domain Layer (partagé)
│       ├── identity/
│       │   ├── User.ts
│       │   ├── Role.ts
│       │   └── Permission.ts
│       ├── tenant/
│       │   └── Tenant.ts
│       ├── sync/
│       │   └── SyncEvent.ts
│       └── billing/
│           ├── Subscription.ts
│           └── Voucher.ts
│
├── server/                                  # [EXISTANT] Backend
│   ├── infrastructure/
│   │   ├── runtime/                         # [NOUVEAU] RuntimeContextBuilder (server-side)
│   │   │   └── provider-factory.ts          # ProviderFactory
│   │   ├── providers/                       # [NOUVEAU] Provider Interfaces
│   │   │   ├── auth/IAuthProvider.ts
│   │   │   ├── tenant/ITenantProvider.ts
│   │   │   ├── user/IUserProvider.ts
│   │   │   └── sync/ISyncProvider.ts
│   │   ├── repositories/                    # [NOUVEAU] Repository Interfaces
│   │   │   ├── ITenantRepository.ts
│   │   │   ├── IUserRepository.ts
│   │   │   ├── IRoleRepository.ts
│   │   │   ├── IPermissionRepository.ts
│   │   │   └── ISyncRepository.ts
│   │   ├── sqlite/                          # [EXISTANT]
│   │   ├── supabase/                        # [EXISTANT]
│   │   └── sync/                            # [EXISTANT]
│   │
│   └── application/                         # [EXISTANT] À étendre
│       └── services/
│           ├── auth.service.ts
│           └── tenant.service.ts
│
└── frontend/                                # [EXISTANT] Frontend React
    └── src/
        └── stores/                          # [EXISTANT] À migrer
            ├── useAuthStore.ts
            └── ...
```

---

# 4. RUNTIMECONTEXT ARCHITECTURE

## 4.1 Architecture Partagée

**RuntimeContext** est dans `src/core/runtime/` pour être partagé entre :

- Backend Node.js
- Frontend React
- Electron Main
- Electron Renderer

## 4.2 RuntimeContext

**Fichier** : `src/core/runtime/runtime-context.ts`

```typescript
/**
 * RuntimeContext - UNIQUE source de vérité pour la configuration d'exécution
 * 
 * Architecture :
 * - RuntimeContext : Expose le contexte final (immutable)
 * - RuntimeDetector : Interface pour la détection
 *   - BrowserRuntimeDetector
 *   - ElectronRuntimeDetector
 *   - ServerRuntimeDetector
 * - StorageStrategyResolver : Résout le stockage
 * - AuthStrategyResolver : Résout l'auth
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
export type RuntimeType = 'DESKTOP' | 'SERVER' | 'WEB' | 'MOBILE';
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

## 4.3 RuntimeDetector (Interface + Implémentations)

**Fichier** : `src/core/runtime/resolvers/runtime-detector.ts`

```typescript
/**
 * RuntimeDetector - Interface pour la détection du mode d'exécution
 */
export interface RuntimeDetector {
  detect(): ExecutionMode | null;
}

/**
 * BrowserRuntimeDetector - Détection pour navigateur Web
 */
export class BrowserRuntimeDetector implements RuntimeDetector {
  detect(): ExecutionMode | null {
    try {
      // Check EKALA_MODE
      const explicitMode = this.detectFromEnvVar();
      if (explicitMode) return explicitMode;

      // Check Vite env
      const viteEnv = (import.meta as any)?.env || {};
      if (viteEnv.VITE_APP_MODE === 'local') return 'LOCAL';
      if (viteEnv.VITE_APP_MODE === 'cloud') return 'CLOUD';
      if (viteEnv.VITE_APP_MODE === 'hybrid') return 'HYBRID';

      // Vite dev server → LOCAL
      if (viteEnv.DEV === true) return 'LOCAL';

      // Check hostname
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') return 'LOCAL';
    } catch {}
    return null;
  }

  private detectFromEnvVar(): ExecutionMode | null {
    try {
      const mode = import.meta.env.VITE_APP_MODE?.toUpperCase();
      if (mode === 'LOCAL' || mode === 'CLOUD' || mode === 'HYBRID') {
        return mode;
      }
    } catch {}
    return null;
  }
}

/**
 * ElectronRuntimeDetector - Détection pour Electron Desktop
 */
export class ElectronRuntimeDetector implements RuntimeDetector {
  detect(): ExecutionMode | null {
    try {
      // Check EKALA_MODE
      const explicitMode = this.detectFromEnvVar();
      if (explicitMode) return explicitMode;

      // Check Electron
      if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Electron')) {
        return 'LOCAL';
      }
      if (typeof process !== 'undefined' && process.versions?.electron) {
        return 'LOCAL';
      }
    } catch {}
    return null;
  }

  private detectFromEnvVar(): ExecutionMode | null {
    try {
      const mode = process.env.EKALA_MODE?.toUpperCase();
      if (mode === 'LOCAL' || mode === 'CLOUD' || mode === 'HYBRID') {
        return mode;
      }
    } catch {}
    return null;
  }
}

/**
 * ServerRuntimeDetector - Détection pour Node.js Server
 */
export class ServerRuntimeDetector implements RuntimeDetector {
  detect(): ExecutionMode | null {
    try {
      // Check EKALA_MODE
      const explicitMode = this.detectFromEnvVar();
      if (explicitMode) return explicitMode;

      // Server is always CLOUD
      return 'CLOUD';
    } catch {}
    return null;
  }

  private detectFromEnvVar(): ExecutionMode | null {
    try {
      const mode = process.env.EKALA_MODE?.toUpperCase();
      if (mode === 'LOCAL' || mode === 'CLOUD' || mode === 'HYBRID') {
        return mode;
      }
    } catch {}
    return null;
  }
}
```

## 4.4 StorageStrategyResolver

**Fichier** : `src/core/runtime/resolvers/storage-strategy-resolver.ts`

```typescript
export class StorageStrategyResolver {
  public static resolve(executionMode: ExecutionMode): {
    primary: StorageType;
    secondary: StorageType;
  } {
    switch (executionMode) {
      case 'LOCAL':
        return { primary: 'SQLITE', secondary: 'NONE' };
      case 'CLOUD':
        return { primary: 'SUPABASE', secondary: 'NONE' };
      case 'HYBRID':
        return { primary: 'SQLITE', secondary: 'SUPABASE' };
      default:
        return { primary: 'SUPABASE', secondary: 'NONE' };
    }
  }
}
```

## 4.5 AuthStrategyResolver

**Fichier** : `src/core/runtime/resolvers/auth-strategy-resolver.ts`

```typescript
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

## 4.6 DataAuthorityResolver

**Fichier** : `src/core/runtime/resolvers/data-authority-resolver.ts`

```typescript
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

## 4.7 RuntimeContextBuilder

**Fichier** : `src/core/runtime/runtime-context-builder.ts`

```typescript
export class RuntimeContextBuilder {
  public static build(): RuntimeContext {
    // 1. Détecter le mode d'exécution
    const executionMode = RuntimeDetectorFactory.detect();
    
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
    return 'WEB';
  }
}
```

## 4.8 RuntimeDetectorFactory

**Fichier** : `src/core/runtime/resolvers/runtime-detector-factory.ts`

```typescript
export class RuntimeDetectorFactory {
  public static detect(): ExecutionMode {
    // Browser
    if (typeof window !== 'undefined') {
      const detector = new BrowserRuntimeDetector();
      const mode = detector.detect();
      if (mode) return mode;
    }

    // Electron
    if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Electron')) {
      const detector = new ElectronRuntimeDetector();
      const mode = detector.detect();
      if (mode) return mode;
    }

    // Server (Node.js)
    if (typeof process !== 'undefined' && process.versions?.node) {
      const detector = new ServerRuntimeDetector();
      const mode = detector.detect();
      if (mode) return mode;
    }

    // Fallback
    return 'CLOUD';
  }
}
```

## 4.9 RuntimeAdapters

### 4.9.1 RuntimeAdapter (Interface)

**Fichier** : `src/core/runtime/adapters/runtime-adapter.ts`

```typescript
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

### 4.9.2 BrowserRuntimeAdapter (WEB)

**Fichier** : `src/core/runtime/adapters/browser-runtime-adapter.ts`

```typescript
export class BrowserRuntimeAdapter implements RuntimeAdapter {
  readonly type: RuntimeType = 'WEB';

  async initialize(): Promise<void> {}
  async shutdown(): Promise<void> {}

  getStoragePath(): string {
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

### 4.9.3 ElectronRuntimeAdapter (DESKTOP)

**Fichier** : `src/core/runtime/adapters/electron-runtime-adapter.ts`

```typescript
export class ElectronRuntimeAdapter implements RuntimeAdapter {
  readonly type: RuntimeType = 'DESKTOP';

  async initialize(): Promise<void> {
    // Initialisation Electron
  }

  async shutdown(): Promise<void> {
    // Nettoyage
  }

  getStoragePath(): string {
    return require('electron').app.getPath('userData');
  }

  getConfigPath(): string {
    return require('electron').app.getPath('userData');
  }

  isOnline(): boolean {
    return true; // TODO: Implémenter
  }

  getNetworkInfo(): NetworkInfo {
    return { online: true };
  }
}
```

### 4.9.4 ServerRuntimeAdapter (SERVER)

**Fichier** : `src/core/runtime/adapters/server-runtime-adapter.ts`

```typescript
export class ServerRuntimeAdapter implements RuntimeAdapter {
  readonly type: RuntimeType = 'SERVER';

  async initialize(): Promise<void> {}
  async shutdown(): Promise<void> {}

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
    return { online: true };
  }
}
```

---

# 5. PLAN D'IMPLÉMENTATION DÉTAILLÉ

## Phase 0.5 : Contract Discovery & Existing System Audit (Jour 0)

### 5.0.1 Objectif

Analyser le système existant SANS modifier.

### 5.0.2 Livrables

**Document 1** : `docs/PHASE_0_5_CONTRACT_AUDIT.md` (déjà créé)

**Document 2** : `docs/PROVIDER_CONTRACT_MAPPING.md` (déjà créé)

### 5.0.3 Actions

1. Analyser toutes les routes backend
2. Analyser tous les services
3. Analyser tous les stores frontend
4. Analyser le système auth
5. Analyser le RBAC
6. Analyser le tenant resolver
7. Analyser le billing/voucher
8. Analyser le sync engine
9. Analyser les repositories SQLite
10. Analyser les repositories Supabase
11. Analyser l'Electron runtime

### 5.0.4 Règles

- ❌ Aucun fichier existant modifié
- ❌ Aucun refactoring
- ❌ Aucun nouveau provider concret
- ❌ Aucun changement de base de données
- ❌ Aucun changement de comportement utilisateur

---

## Priorité 1 : RuntimeContext Partagé (Jour 1)

### 5.1.1 Fichiers à Créer dans src/core/runtime/

```
src/core/runtime/
├── index.ts
├── runtime-context.ts
├── runtime-context-builder.ts
├── resolvers/
│   ├── runtime-detector.ts                  # Interface
│   ├── browser-runtime-detector.ts          # Browser
│   ├── electron-runtime-detector.ts         # Electron
│   ├── server-runtime-detector.ts           # Server
│   ├── runtime-detector-factory.ts          # Factory
│   ├── storage-strategy-resolver.ts
│   ├── auth-strategy-resolver.ts
│   └── data-authority-resolver.ts
└── adapters/
    ├── runtime-adapter.ts
    ├── browser-runtime-adapter.ts            # WEB
    ├── electron-runtime-adapter.ts           # DESKTOP
    └── server-runtime-adapter.ts             # SERVER
```

### 5.1.2 Tests

**Fichier** : `src/core/runtime/__tests__/runtime-context.test.ts`

```typescript
describe('RuntimeContext', () => {
  beforeEach(() => {
    RuntimeContext.reset();
  });

  it('should detect LOCAL mode from EKALA_MODE', () => {
    // Mock EKALA_MODE
    const result = RuntimeContext.getInstance();
    expect(result.isLocal()).toBe(true);
  });

  it('should detect CLOUD mode by default', () => {
    const result = RuntimeContext.getInstance();
    expect(result.isCloud()).toBe(true);
  });

  it('should detect HYBRID mode', () => {
    const result = RuntimeContext.getInstance();
    expect(result.isHybrid()).toBe(true);
    expect(result.dataAuthority).toBe('LOCAL_FIRST');
  });
});
```

---

## Priorité 2 : ProviderFactory avec PendingProviders (Jour 1-2)

### 5.2.1 PendingProviders

**Fichier** : `src/server/infrastructure/providers/pending-providers.ts`

```typescript
/**
 * PendingAuthProvider - Provider temporaire pour permettre le démarrage
 */
export class PendingAuthProvider implements IAuthProvider {
  async login(email: string, password: string): Promise<AuthResult> {
    throw new Error('AuthProvider not implemented yet');
  }

  async loginPin(pinCode: string, identity?: string, tenantSlug?: string): Promise<AuthResult> {
    throw new Error('AuthProvider not implemented yet');
  }

  async logout(): Promise<void> {
    throw new Error('AuthProvider not implemented yet');
  }

  async refresh(): Promise<AuthResult> {
    throw new Error('AuthProvider not implemented yet');
  }

  async me(): Promise<User> {
    throw new Error('AuthProvider not implemented yet');
  }

  async checkHealth(): Promise<boolean> {
    return false;
  }
}

// Autres PendingProviders...
export class PendingTenantProvider implements ITenantProvider { ... }
export class PendingUserProvider implements IUserProvider { ... }
export class PendingSyncProvider implements ISyncProvider { ... }
```

### 5.2.2 ProviderFactory

**Fichier** : `src/server/infrastructure/runtime/provider-factory.ts`

```typescript
export class ProviderFactory {
  private static providers: Map<string, any> = new Map();
  private static initialized = false;

  public static initialize(): void {
    if (ProviderFactory.initialized) return;
    
    // Créer les PendingProviders
    ProviderFactory.getAuthProvider();
    ProviderFactory.getTenantProvider();
    ProviderFactory.getUserProvider();
    ProviderFactory.getSyncProvider();
    
    ProviderFactory.initialized = true;
  }

  public static getAuthProvider(): IAuthProvider {
    const cacheKey = 'auth-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      ProviderFactory.providers.set(cacheKey, new PendingAuthProvider());
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  // ... autres providers

  public static reset(): void {
    ProviderFactory.providers.clear();
    ProviderFactory.initialized = false;
  }
}
```

---

## Priorité 3 : Provider Interfaces (Jour 2)

### 5.3.1 Interfaces

**Fichiers** :

- `src/server/infrastructure/providers/auth/IAuthProvider.ts`
- `src/server/infrastructure/providers/tenant/ITenantProvider.ts`
- `src/server/infrastructure/providers/user/IUserProvider.ts`
- `src/server/infrastructure/providers/sync/ISyncProvider.ts`

**Contenu** : Voir PROVIDER_CONTRACT_MAPPING.md

---

## Priorité 4 : Repository Interfaces (Jour 2-3)

### 5.4.1 Interfaces

**Fichiers** :

- `src/server/infrastructure/repositories/ITenantRepository.ts`
- `src/server/infrastructure/repositories/IUserRepository.ts`
- `src/server/infrastructure/repositories/IRoleRepository.ts`
- `src/server/infrastructure/repositories/IPermissionRepository.ts`
- `src/server/infrastructure/repositories/ISyncRepository.ts`

**Contenu** : Voir PROVIDER_CONTRACT_MAPPING.md

---

## Priorité 5 : Domain Layer Minimal (Jour 3)

### 5.5.1 Domain Models

**Fichiers** :

- `src/core/domain/identity/User.ts`
- `src/core/domain/identity/Role.ts`
- `src/core/domain/identity/Permission.ts`
- `src/core/domain/tenant/Tenant.ts`
- `src/core/domain/sync/SyncEvent.ts`
- `src/core/domain/billing/Subscription.ts` (déjà existe)
- `src/core/domain/billing/Voucher.ts` (déjà existe)

**Règle** : Le Domain Layer est la référence métier. Les repositories et providers doivent mapper vers le domaine.

---

## Priorité 6 : Services Métier (Jour 4)

### 5.6.1 Services

**Fichiers** :

- `src/server/application/services/auth.service.ts`
- `src/server/application/services/tenant.service.ts`

**Contenu** : Voir Phase 1 V3

---

## Priorité 7 : Tests et Documentation (Jour 5)

### 5.7.1 Tests

**Objectif** : Couverture > 80% sur les composants critiques

### 5.7.2 Documentation

**Fichier** : `docs/PHASE_1_ARCHITECTURE_V4.md`

---

# 6. FICHIERS CRÉÉS

## 6.1 Runtime Layer Partagé (12 fichiers)

```
src/core/runtime/
├── index.ts
├── runtime-context.ts
├── runtime-context-builder.ts
├── resolvers/
│   ├── runtime-detector.ts                  # Interface
│   ├── browser-runtime-detector.ts
│   ├── electron-runtime-detector.ts
│   ├── server-runtime-detector.ts
│   ├── runtime-detector-factory.ts
│   ├── storage-strategy-resolver.ts
│   ├── auth-strategy-resolver.ts
│   └── data-authority-resolver.ts
└── adapters/
    ├── runtime-adapter.ts
    ├── browser-runtime-adapter.ts            # WEB
    ├── electron-runtime-adapter.ts           # DESKTOP
    └── server-runtime-adapter.ts             # SERVER
```

## 6.2 Domain Layer Partagé (7 fichiers)

```
src/core/domain/
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

## 6.3 Server Infrastructure (9 fichiers)

```
src/server/infrastructure/
├── runtime/
│   └── provider-factory.ts
├── providers/
│   ├── auth/IAuthProvider.ts
│   ├── tenant/ITenantProvider.ts
│   ├── user/IUserProvider.ts
│   ├── sync/ISyncProvider.ts
│   └── pending-providers.ts
├── repositories/
│   ├── ITenantRepository.ts
│   ├── IUserRepository.ts
│   ├── IRoleRepository.ts
│   ├── IPermissionRepository.ts
│   └── ISyncRepository.ts
```

## 6.4 Services Métier (2 fichiers)

```
src/server/application/services/
├── auth.service.ts
└── tenant.service.ts
```

## 6.5 Tests (15+ fichiers)

```
src/core/runtime/__tests__/
├── runtime-context.test.ts
├── browser-runtime-detector.test.ts
├── electron-runtime-detector.test.ts
├── server-runtime-detector.test.ts
├── storage-strategy-resolver.test.ts
├── auth-strategy-resolver.test.ts
├── data-authority-resolver.test.ts
└── provider-factory.test.ts

src/core/domain/__tests__/
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

## 7.1 RuntimeContext (src/core/runtime/)

**Responsabilité** : Exposer le contexte d'exécution (immutable)

**Méthodes** :

- `getInstance()` : Singleton
- `isLocal()`, `isCloud()`, `isHybrid()` : Vérifier le mode
- `usesSQLite()`, `usesSupabase()` : Vérifier le stockage
- `shouldSync()` : Vérifier si sync activée

**Pourquoi** : Centraliser TOUTE la configuration d'exécution dans un seul objet immutable, partagé entre tous les environnements.

## 7.2 RuntimeDetector (Interface + Implémentations)

**Responsabilité** : Détecter le mode d'exécution selon l'environnement

**Implémentations** :

- `BrowserRuntimeDetector` : Web
- `ElectronRuntimeDetector` : Desktop
- `ServerRuntimeDetector` : Node.js

**Pourquoi** : Séparer la détection par environnement pour éviter les erreurs.

## 7.3 RuntimeAdapters

**Responsabilité** : Adapter le runtime selon l'environnement

**Implémentations** :

- `BrowserRuntimeAdapter` : WEB
- `ElectronRuntimeAdapter` : DESKTOP
- `ServerRuntimeAdapter` : SERVER

**Pourquoi** : Support explicite des 3 environnements d'exécution.

## 7.4 ProviderFactory

**Responsabilité** : Créer les providers selon RuntimeContext

**Méthodes** :

- `initialize()` : Initialiser tous les providers
- `getAuthProvider()`, `getTenantProvider()`, etc.
- `reset()` : Reset pour les tests

**Pourquoi** : Masquer la complexité de la création des providers. Utiliser PendingProviders pour permettre le démarrage.

## 7.5 Domain Layer (src/core/domain/)

**Responsabilité** : Représenter les concepts métier (référence unique)

**Éléments** :

- identity/User, Role, Permission
- tenant/Tenant
- sync/SyncEvent
- billing/Subscription, Voucher

**Pourquoi** : Avoir une couche métier indépendante de l'infrastructure, partagée entre tous les environnements.

---

# 8. DÉPENDANCES

## 8.1 Dépendances entre Couches

```
src/core/ (partagé)
├── runtime/ (aucune dépendance)
└── domain/ (aucune dépendance)

src/server/ (backend)
├── infrastructure/ (dépend de core/)
└── application/ (dépend de infrastructure/)

src/frontend/ (frontend)
└── stores/ (dépend de core/)
```

## 8.2 Règles de Dépendance

**Frontend** :

- ❌ Ne dépend PAS de `src/server/`
- ✅ Dépend de `src/core/runtime/`
- ✅ Dépend de `src/core/domain/`

**Backend** :

- ✅ Dépend de `src/core/runtime/`
- ✅ Dépend de `src/core/domain/`
- ✅ Dépend de `src/server/infrastructure/`

**Electron** :

- ✅ Main Process : dépend de `src/core/runtime/`
- ✅ Renderer Process : dépend de `src/core/runtime/`

---

# 9. STRATÉGIE DE MIGRATION ORIENTÉE RISQUE

## 9.1 Phase 0.5 : Contract Discovery (1 jour)

**Objectif** : Analyser le système existant

**Livrables** :

- `docs/PHASE_0_5_CONTRACT_AUDIT.md`
- `docs/PROVIDER_CONTRACT_MAPPING.md`

**Risque** : Faible (lecture seule)

## 9.2 Phase 1 : Runtime Layer + Domain Minimal (5 jours)

### Jour 1 : RuntimeContext Partagé

**Livrables** :

- src/core/runtime/ (12 fichiers)
- Tests RuntimeContext

### Jour 1-2 : ProviderFactory + PendingProviders

**Livrables** :

- ProviderFactory
- PendingProviders
- Tests ProviderFactory

### Jour 2-3 : Provider Interfaces

**Livrables** :

- IAuthProvider
- ITenantProvider
- IUserProvider
- ISyncProvider

### Jour 3-4 : Repository Interfaces + Domain Layer

**Livrables** :

- 5 Repository Interfaces
- Domain Layer minimal (7 fichiers)

### Jour 4-5 : Services Métier

**Livrables** :

- AuthService
- TenantService

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
**Mitigation** : Architecture séparée avec resolvers + detectors séparés

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
| RuntimeContext complexe | Faible | Moyen | Resolvers + Detectors séparés | Faible |
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

### RuntimeContext (src/core/runtime/)
- [ ] RuntimeContext détecte LOCAL via EKALA_MODE
- [ ] RuntimeContext détecte CLOUD par défaut
- [ ] RuntimeContext détecte HYBRID
- [ ] RuntimeContext résout dataAuthority
- [ ] RuntimeContextBuilder fonctionne
- [ ] BrowserRuntimeDetector fonctionne
- [ ] ElectronRuntimeDetector fonctionne
- [ ] ServerRuntimeDetector fonctionne
- [ ] BrowserRuntimeAdapter retourne WEB
- [ ] ElectronRuntimeAdapter retourne DESKTOP
- [ ] ServerRuntimeAdapter retourne SERVER

### ProviderFactory
- [ ] ProviderFactory crée les PendingProviders
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

### Domain Layer (src/core/domain/)
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

## Résumé de la Phase 1 V4

**Objectif** : Créer les fondations de la nouvelle architecture

**Durée** : 6 jours (1 jour Phase 0.5 + 5 jours Phase 1)

**Livrables** :

- ✅ Phase 0.5 : Audit complet + Contract Mapping
- ✅ RuntimeContext partagé (src/core/runtime/)
- ✅ RuntimeDetector avec détecteurs séparés
- ✅ RuntimeAdapters (Browser=WEB, Electron=DESKTOP, Server=SERVER)
- ✅ ProviderFactory avec PendingProviders
- ✅ 4 Provider Interfaces
- ✅ 5 Repository Interfaces
- ✅ Domain Layer minimal (src/core/domain/)
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
- ✅ Partagé entre tous les environnements

## Prochaines Étapes

1. **Valider** ce plan V4
2. **Démarrer** Phase 0.5 : Contract Discovery
3. **Exécuter** Phase 1 selon le plan
4. **Valider** chaque checkpoint
5. **Passer** à Phase 2

---

**Fin du Plan d'Implémentation Phase 1 V4**

*Document généré par l'Architecte Logiciel Senior*  
*Date : 2026-01-07*