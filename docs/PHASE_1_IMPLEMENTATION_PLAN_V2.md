# PHASE 1 — PLAN D'IMPLÉMENTATION V2 CORRIGÉE
## Runtime Context + Domain Layer + Providers Critiques

**Date** : 2026-01-07  
**Auteur** : Architecte Logiciel Senior  
**Statut** : PLAN D'IMPLÉMENTATION V2  
**Version** : 2.0.0  
**Durée Estimée** : 5 jours

---

# SOMMAIRE

1. [Principes Architecturaux Non Négociables](#1-principes-architecturaux-non-négociables)
2. [Objectifs de la Phase 1](#2-objectifs-de-la-phase-1)
3. [Nouvelle Structure des Dossiers](#3-nouvelle-structure-des-dossiers)
4. [RuntimeContext - Remplace ModeResolver](#4-runtimecontext---remplace-moderesolver)
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
- ✅ Authentification locale (JWT signé par backend local)
- ✅ Aucune dépendance à Supabase
- ✅ Aucune dépendance réseau (sauf optionnel)

### CLOUD
- ✅ Supabase comme **source de vérité distante**
- ✅ Authentification via Supabase Auth
- ✅ Aucune dépendance à SQLite
- ✅ Fonctionnement 100% cloud

### HYBRIDE
- ✅ SQLite local comme **source de vérité**
- ✅ Synchronisation vers Supabase via **moteur de réplication existant**
- ✅ Outbox + Replication Engine + Conflict Resolver + DLQ
- ✅ Fonctionnement offline-first
- ✅ Synchronisation automatique quand online

## 1.2 Interdiction de Conditions Dispersées

### ❌ INTERDIT
```typescript
// MAUVAIS - Conditions dispersées
if (isLocal()) { ... }
if (isCloud()) { ... }
if (isHybrid()) { ... }
if (offline) { ... }
if (navigator.onLine) { ... }
```

### ✅ OBLIGATOIRE
```typescript
// BON - Résolution centralisée via RuntimeContext
const runtime = RuntimeContext.getInstance();
const authProvider = ProviderFactory.getAuthProvider();
const result = await authProvider.login(email, password);
// Le provider décide de la stratégie, pas le composant
```

## 1.3 Couche Runtime Dédiée

**Règle** : Toute la logique de résolution de mode DOIT être dans `src/server/infrastructure/runtime/`

**Interdiction** : Aucun composant React, store, hook, ou service métier ne doit importer `app-mode.ts` ou `data-source-manager.ts`

## 1.4 Abstraction des Sources de Données

**Règle** : SQLite et Supabase sont des **implémentations** d'une même abstraction

**Interdiction** : Aucun chemin métier différent selon la source de données

**Exemple** :
```typescript
// BON - Même interface, implémentation différente
interface ITenantRepository {
  findBySlug(slug: string): Promise<Tenant>;
  findById(id: number): Promise<Tenant>;
  create(data: CreateTenantDTO): Promise<Tenant>;
}

// SQLite implémente ITenantRepository
// Supabase implémente ITenantRepository
// Hybride implémente ITenantRepository
```

## 1.5 Préservation du Moteur de Synchronisation

**Règle** : Le moteur existant (Outbox, Replication Engine, Conflict Resolver, DLQ) DOIT être préservé

**Intégration** : Il sera encapsulé dans `HybridSyncProvider` sans modification de sa logique interne

---

# 2. OBJECTIFS DE LA PHASE 1

## 2.1 Objectif Principal

Créer les **fondations** de la nouvelle architecture sans casser l'existant.

## 2.2 Objectifs Spécifiques

1. **RuntimeContext** : Créer le contexte d'exécution enrichi
2. **Domain Layer** : Créer les entités et interfaces du domaine
3. **Repository Interfaces** : Définir les contrats pour les repositories critiques
4. **Provider Interfaces** : Définir 4 providers critiques (Auth, Tenant, User, Sync)
5. **ProviderFactory** : Créer la factory adaptée à RuntimeContext
6. **Tests** : Écrire les tests unitaires pour toutes les nouvelles classes

## 2.3 Livrables

- ✅ `RuntimeContext` fonctionnel et testé
- ✅ `ProviderFactory` adaptée à RuntimeContext
- ✅ 4 interfaces de providers (Auth, Tenant, User, Sync)
- ✅ 5 interfaces de repositories critiques
- ✅ Domain Layer (entités, value objects, events, errors)
- ✅ Tests unitaires (couverture > 95%)
- ✅ Documentation complète

## 2.4 Non-Objectifs de la Phase 1

- ❌ Implémenter les providers concrets (LOCAL, CLOUD, HYBRIDE)
- ❌ Modifier le code existant
- ❌ Migrer les composants React
- ❌ Migrer les stores
- ❌ Supprimer `app-mode.ts` ou `data-source-manager.ts`

**Principe** : Phase 1 = fondations uniquement, code parallèle, aucune modification de l'existant.

---

# 3. NOUVELLE STRUCTURE DES DOSSIERS

## 3.1 Arborescence Complète

```
src/server/
├── domain/                                    # [NOUVEAU] Domain Layer (indépendant)
│   ├── entities/
│   │   ├── Tenant.ts
│   │   ├── User.ts
│   │   ├── Order.ts
│   │   ├── Product.ts
│   │   └── Category.ts
│   ├── value-objects/
│   │   ├── TenantId.ts
│   │   ├── UserId.ts
│   │   ├── OrderId.ts
│   │   ├── Money.ts
│   │   └── Email.ts
│   ├── events/
│   │   ├── DomainEvent.ts
│   │   ├── TenantCreatedEvent.ts
│   │   ├── UserCreatedEvent.ts
│   │   └── OrderCreatedEvent.ts
│   └── errors/
│       ├── DomainError.ts
│       ├── TenantNotFoundError.ts
│       └── InvalidCredentialsError.ts
│
├── application/                               # [EXISTANT] À étendre
│   ├── services/
│   │   ├── auth.service.ts                    # [À CRÉER]
│   │   ├── tenant.service.ts                  # [À CRÉER]
│   │   └── ...
│   ├── use-cases/
│   │   ├── LoginUseCase.ts                    # [À CRÉER]
│   │   ├── CreateTenantUseCase.ts             # [À CRÉER]
│   │   └── ...
│   └── dto/
│       ├── LoginRequest.ts
│       ├── CreateTenantRequest.ts
│       └── ...
│
└── infrastructure/                            # [EXISTANT] À étendre
    ├── data-source-manager.ts                # [EXISTANT] Conservé pour rétrocompatibilité
    │
    ├── runtime/                              # [NOUVEAU] Runtime Layer
    │   ├── index.ts
    │   ├── runtime-context.ts                # RuntimeContext (remplace ModeResolver)
    │   └── provider-factory.ts               # ProviderFactory adaptée
    │
    ├── providers/                            # [NOUVEAU] Provider Interfaces (4 seulement)
    │   ├── index.ts
    │   ├── auth/
    │   │   └── IAuthProvider.ts
    │   ├── tenant/
    │   │   └── ITenantProvider.ts
    │   ├── user/
    │   │   └── IUserProvider.ts
    │   └── sync/
    │       └── ISyncProvider.ts
    │
    ├── repositories/                         # [NOUVEAU] Repository Interfaces (5 seulement)
    │   ├── ITenantRepository.ts
    │   ├── IUserRepository.ts
    │   ├── IRoleRepository.ts
    │   ├── IPermissionRepository.ts
    │   └── ISyncRepository.ts
    │
    ├── sqlite/                               # [EXISTANT] Implémentations SQLite
    │   └── ...
    │
    ├── supabase/                             # [EXISTANT] Implémentations Supabase
    │   └── ...
    │
    └── sync/                                 # [EXISTANT] Moteur de synchronisation
        ├── outbox/
        ├── replication-engine/
        └── ...
```

## 3.2 Principe d'Organisation

```
Couche Domaine (Domain Layer)
  ↓ (dépend de)
Couche Application (Use Cases + Services)
  ↓ (dépend de)
Couche Infrastructure (Providers + Repositories)
  ↓ (dépend de)
Couche Présentation (Routes + Controllers)
```

**Règle** : Les dépendances vont TOUJOURS de la couche supérieure vers la couche inférieure.

---

# 4. RUNTIMECONTEXT - REMPLACE MODERESOLVER

## 4.1 Concept

**RuntimeContext** est un objet enrichi qui capture TOUTE la configuration d'exécution, pas juste le mode.

## 4.2 Structure

```typescript
/**
 * RuntimeContext - UNIQUE source de vérité pour la configuration d'exécution
 * 
 * Remplace ModeResolver simple par un contexte enrichi qui capture :
 * - Le mode d'exécution (LOCAL, CLOUD, HYBRID)
 * - Le type de runtime (DESKTOP, SERVER, MOBILE)
 * - Les sources de données (primaryStorage, secondaryStorage)
 * - La synchronisation (syncEnabled)
 * - La stratégie d'authentification
 * 
 * Cette classe est le SEUL endroit où la configuration d'exécution est déterminée.
 */
export class RuntimeContext {
  private static instance: RuntimeContext;
  
  // Mode d'exécution
  public readonly executionMode: ExecutionMode;
  
  // Type de runtime
  public readonly runtimeType: RuntimeType;
  
  // Stockage
  public readonly primaryStorage: StorageType;
  public readonly secondaryStorage: StorageType;
  
  // Synchronisation
  public readonly syncEnabled: boolean;
  
  // Authentification
  public readonly authStrategy: AuthStrategy;
  
  // Contexte HTTP (si applicable)
  private httpContext: HttpContext | null = null;

  private constructor() {
    this.executionMode = this.detectExecutionMode();
    this.runtimeType = this.detectRuntimeType();
    this.primaryStorage = this.detectPrimaryStorage();
    this.secondaryStorage = this.detectSecondaryStorage();
    this.syncEnabled = this.detectSyncEnabled();
    this.authStrategy = this.detectAuthStrategy();
  }

  public static getInstance(): RuntimeContext {
    if (!RuntimeContext.instance) {
      RuntimeContext.instance = new RuntimeContext();
    }
    return RuntimeContext.instance;
  }

  // ============================================================================
  // DÉTECTION DU MODE D'EXÉCUTION
  // ============================================================================

  private detectExecutionMode(): ExecutionMode {
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

  // ============================================================================
  // DÉTECTION DU TYPE DE RUNTIME
  // ============================================================================

  private detectRuntimeType(): RuntimeType {
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

    // Mobile (détection basique)
    if (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return 'MOBILE';
    }

    // Web par défaut
    return 'SERVER';
  }

  // ============================================================================
  // DÉTECTION DU STOCKAGE
  // ============================================================================

  private detectPrimaryStorage(): StorageType {
    // LOCAL et HYBRIDE → SQLite
    if (this.executionMode === 'LOCAL' || this.executionMode === 'HYBRID') {
      return 'SQLITE';
    }
    
    // CLOUD → Supabase
    return 'SUPABASE';
  }

  private detectSecondaryStorage(): StorageType {
    // HYBRIDE → Supabase (pour sync)
    if (this.executionMode === 'HYBRIDE') {
      return 'SUPABASE';
    }
    
    // LOCAL et CLOUD → pas de stockage secondaire
    return 'NONE';
  }

  // ============================================================================
  // DÉTECTION DE LA SYNCHRONISATION
  // ============================================================================

  private detectSyncEnabled(): boolean {
    // HYBRIDE uniquement
    return this.executionMode === 'HYBRID';
  }

  // ============================================================================
  // DÉTECTION DE LA STRATÉGIE D'AUTHENTIFICATION
  // ============================================================================

  private detectAuthStrategy(): AuthStrategy {
    // LOCAL → JWT local signé par backend local
    if (this.executionMode === 'LOCAL') {
      return 'LOCAL_JWT';
    }
    
    // CLOUD → Supabase Auth
    if (this.executionMode === 'CLOUD') {
      return 'SUPABASE_AUTH';
    }
    
    // HYBRIDE → JWT local + sync
    return 'LOCAL_JWT_WITH_SYNC';
  }

  // ============================================================================
  // MÉTHODES PUBLIQUES
  // ============================================================================

  public isLocal(): boolean {
    return this.executionMode === 'LOCAL';
  }

  public isCloud(): boolean {
    return this.executionMode === 'CLOUD';
  }

  public isHybrid(): boolean {
    return this.executionMode === 'HYBRID';
  }

  public isDesktop(): boolean {
    return this.runtimeType === 'DESKTOP';
  }

  public isServer(): boolean {
    return this.runtimeType === 'SERVER';
  }

  public isMobile(): boolean {
    return this.runtimeType === 'MOBILE';
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

  /**
   * Résout le contexte depuis une requête HTTP
   */
  public resolveFromRequest(req: { headers?: Record<string, any> }): RuntimeContext {
    const runtimeHeader = req?.headers?.['x-runtime-mode'];
    if (runtimeHeader === 'local' || runtimeHeader === 'cloud' || runtimeHeader === 'hybrid') {
      // Créer un nouveau contexte avec le mode de la requête
      return RuntimeContext.createFromMode(runtimeHeader.toUpperCase() as ExecutionMode);
    }

    return this;
  }

  /**
   * Crée un contexte depuis un mode d'exécution
   */
  private static createFromMode(mode: ExecutionMode): RuntimeContext {
    const ctx = new RuntimeContext();
    (ctx as any).executionMode = mode;
    (ctx as any).runtimeType = mode === 'LOCAL' ? 'DESKTOP' : 'SERVER';
    (ctx as any).primaryStorage = mode === 'LOCAL' ? 'SQLITE' : 'SUPABASE';
    (ctx as any).secondaryStorage = mode === 'HYBRID' ? 'SUPABASE' : 'NONE';
    (ctx as any).syncEnabled = mode === 'HYBRID';
    (ctx as any).authStrategy = mode === 'LOCAL' ? 'LOCAL_JWT' : mode === 'HYBRID' ? 'LOCAL_JWT_WITH_SYNC' : 'SUPABASE_AUTH';
    return ctx;
  }

  /**
   * Reset le singleton (pour les tests)
   */
  public static reset(): void {
    RuntimeContext.instance = null;
  }

  /**
   * Log le contexte (pour debug)
   */
  public log(): void {
    console.log('[RuntimeContext]', {
      executionMode: this.executionMode,
      runtimeType: this.runtimeType,
      primaryStorage: this.primaryStorage,
      secondaryStorage: this.secondaryStorage,
      syncEnabled: this.syncEnabled,
      authStrategy: this.authStrategy,
    });
  }
}

// ============================================================================
// TYPES
// ============================================================================

export type ExecutionMode = 'LOCAL' | 'CLOUD' | 'HYBRID';
export type RuntimeType = 'DESKTOP' | 'SERVER' | 'MOBILE';
export type StorageType = 'SQLITE' | 'SUPABASE' | 'NONE';
export type AuthStrategy = 'LOCAL_JWT' | 'SUPABASE_AUTH' | 'LOCAL_JWT_WITH_SYNC';

export interface HttpContext {
  headers: Record<string, any>;
  method: string;
  url: string;
}
```

## 4.3 Tests RuntimeContext

```typescript
describe('RuntimeContext', () => {
  beforeEach(() => {
    RuntimeContext.reset();
  });

  it('should detect LOCAL mode in development', () => {
    const originalEnv = (import.meta as any).env;
    (import.meta as any).env = { DEV: true };
    
    const ctx = RuntimeContext.getInstance();
    expect(ctx.isLocal()).toBe(true);
    expect(ctx.usesSQLite()).toBe(true);
    expect(ctx.usesSupabase()).toBe(false);
    
    (import.meta as any).env = originalEnv;
  });

  it('should detect CLOUD mode in production', () => {
    const originalEnv = (import.meta as any).env;
    (import.meta as any).env = { DEV: undefined };
    
    const ctx = RuntimeContext.getInstance();
    expect(ctx.isCloud()).toBe(true);
    expect(ctx.usesSupabase()).toBe(true);
    expect(ctx.usesSQLite()).toBe(false);
    
    (import.meta as any).env = originalEnv;
  });

  it('should detect HYBRID mode', () => {
    const originalEnv = (import.meta as any).env;
    (import.meta as any).env = { VITE_APP_MODE: 'hybrid' };
    
    const ctx = RuntimeContext.getInstance();
    expect(ctx.isHybrid()).toBe(true);
    expect(ctx.usesSQLite()).toBe(true);
    expect(ctx.usesSupabase()).toBe(true);
    expect(ctx.shouldSync()).toBe(true);
    
    (import.meta as any).env = originalEnv;
  });

  it('should resolve mode from request header', () => {
    const ctx = RuntimeContext.getInstance();
    const reqContext = ctx.resolveFromRequest({
      headers: { 'x-runtime-mode': 'local' }
    });
    
    expect(reqContext.isLocal()).toBe(true);
  });
});
```

---

# 5. PLAN D'IMPLÉMENTATION DÉTAILLÉ

## Priorité 1 : RuntimeContext (Jour 1)

### 5.1.1 RuntimeContext

**Fichier** : `src/server/infrastructure/runtime/runtime-context.ts`

**Responsabilité** : Capturer toute la configuration d'exécution

**Implémentation** : Voir section 4 ci-dessus

**Tests** : `src/server/infrastructure/runtime/__tests__/runtime-context.test.ts`

### 5.1.2 ProviderFactory (adaptée)

**Fichier** : `src/server/infrastructure/runtime/provider-factory.ts`

**Responsabilité** : Créer les providers selon RuntimeContext

**Implémentation** :

```typescript
/**
 * ProviderFactory - UNIQUE point de création des providers
 * 
 * Adaptée pour utiliser RuntimeContext au lieu d'un simple enum.
 */
import { RuntimeContext } from './runtime-context';
import { IAuthProvider } from '../providers/auth/IAuthProvider';
import { ITenantProvider } from '../providers/tenant/ITenantProvider';
import { IUserProvider } from '../providers/user/IUserProvider';
import { ISyncProvider } from '../providers/sync/ISyncProvider';

export class ProviderFactory {
  private static runtimeContext = RuntimeContext.getInstance();
  private static providers: Map<string, any> = new Map();
  private static initialized = false;

  public static initialize(): void {
    if (ProviderFactory.initialized) return;
    
    const ctx = ProviderFactory.runtimeContext;
    console.log(`[ProviderFactory] Initializing providers for mode: ${ctx.executionMode}`);
    
    // Pré-charger les providers critiques
    ProviderFactory.getAuthProvider();
    ProviderFactory.getTenantProvider();
    ProviderFactory.getUserProvider();
    ProviderFactory.getSyncProvider();
    
    ProviderFactory.initialized = true;
    console.log(`[ProviderFactory] All providers initialized`);
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

  // ============================================================================
  // MÉTHODES DE CRÉATION (privées)
  // ============================================================================

  private static createAuthProvider(): IAuthProvider {
    const ctx = ProviderFactory.runtimeContext;
    
    if (ctx.isLocal()) {
      // return new LocalAuthProvider();
      throw new Error('LocalAuthProvider not implemented yet');
    }
    if (ctx.isCloud()) {
      // return new CloudAuthProvider();
      throw new Error('CloudAuthProvider not implemented yet');
    }
    if (ctx.isHybrid()) {
      // return new HybridAuthProvider();
      throw new Error('HybridAuthProvider not implemented yet');
    }
    
    throw new Error(`Unknown execution mode: ${ctx.executionMode}`);
  }

  private static createTenantProvider(): ITenantProvider {
    const ctx = ProviderFactory.runtimeContext;
    
    if (ctx.isLocal()) {
      // return new LocalTenantProvider();
      throw new Error('LocalTenantProvider not implemented yet');
    }
    if (ctx.isCloud()) {
      // return new CloudTenantProvider();
      throw new Error('CloudTenantProvider not implemented yet');
    }
    if (ctx.isHybrid()) {
      // return new HybridTenantProvider();
      throw new Error('HybridTenantProvider not implemented yet');
    }
    
    throw new Error(`Unknown execution mode: ${ctx.executionMode}`);
  }

  private static createUserProvider(): IUserProvider {
    const ctx = ProviderFactory.runtimeContext;
    
    if (ctx.isLocal()) {
      // return new LocalUserProvider();
      throw new Error('LocalUserProvider not implemented yet');
    }
    if (ctx.isCloud()) {
      // return new CloudUserProvider();
      throw new Error('CloudUserProvider not implemented yet');
    }
    if (ctx.isHybrid()) {
      // return new HybridUserProvider();
      throw new Error('HybridUserProvider not implemented yet');
    }
    
    throw new Error(`Unknown execution mode: ${ctx.executionMode}`);
  }

  private static createSyncProvider(): ISyncProvider {
    const ctx = ProviderFactory.runtimeContext;
    
    if (!ctx.shouldSync()) {
      // return new NoOpSyncProvider();
      throw new Error('NoOpSyncProvider not implemented yet');
    }
    
    // HYBRID uniquement
    // return new HybridSyncProvider();
    throw new Error('HybridSyncProvider not implemented yet');
  }

  /**
   * Reset tous les providers (utile pour les tests)
   */
  public static reset(): void {
    ProviderFactory.providers.clear();
    ProviderFactory.initialized = false;
  }

  /**
   * Retourne le contexte actuel (pour debug)
   */
  public static getRuntimeContext(): RuntimeContext {
    return ProviderFactory.runtimeContext;
  }
}
```

**Tests** : `src/server/infrastructure/runtime/__tests__/provider-factory.test.ts`

## Priorité 2 : Auth (Jour 1-2)

### 5.2.1 IAuthProvider

**Fichier** : `src/server/infrastructure/providers/auth/IAuthProvider.ts`

```typescript
/**
 * Interface pour tous les providers d'authentification
 */
export interface IAuthProvider {
  /**
   * Authentifie un utilisateur avec email et mot de passe
   */
  login(email: string, password: string): Promise<AuthResult>;

  /**
   * Authentifie un membre du staff avec PIN
   */
  loginPin(pinCode: string, identity?: string, tenantSlug?: string): Promise<AuthResult>;

  /**
   * Déconnecte l'utilisateur
   */
  logout(): Promise<void>;

  /**
   * Rafraîchit le token JWT
   */
  refresh(): Promise<AuthResult>;

  /**
   * Récupère les informations de l'utilisateur connecté
   */
  me(): Promise<User>;

  /**
   * Vérifie si le serveur est accessible
   */
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
  planName?: string;
  expiresAt?: string;
}

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter';
export type UserStatus = 'active' | 'suspended' | 'cancelled' | 'trial' | 'past_due' | 'expired';
```

### 5.2.2 ITenantProvider

**Fichier** : `src/server/infrastructure/providers/tenant/ITenantProvider.ts`

```typescript
/**
 * Interface pour tous les providers de Tenant
 */
export interface ITenantProvider {
  /**
   * Trouve un tenant par son slug
   */
  findBySlug(slug: string): Promise<Tenant | null>;

  /**
   * Trouve un tenant par son ID
   */
  findById(id: number): Promise<Tenant | null>;

  /**
   * Crée un nouveau tenant
   */
  create(data: CreateTenantDTO): Promise<Tenant>;

  /**
   * Met à jour un tenant
   */
  update(id: number, data: UpdateTenantDTO): Promise<Tenant>;

  /**
   * Supprime un tenant
   */
  delete(id: number): Promise<void>;

  /**
   * Liste tous les tenants
   */
  findAll(filters?: TenantFilters): Promise<Tenant[]>;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
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
  logoUrl?: string;
  primaryColor?: string;
  ownerId?: number;
  planId?: number;
}

export interface UpdateTenantDTO {
  name?: string;
  slug?: string;
  logoUrl?: string;
  primaryColor?: string;
  status?: TenantStatus;
  planId?: number;
}

export interface TenantFilters {
  status?: TenantStatus;
  planId?: number;
  ownerId?: number;
  search?: string;
  page?: number;
  limit?: number;
}
```

### 5.2.3 IUserProvider

**Fichier** : `src/server/infrastructure/providers/user/IUserProvider.ts`

```typescript
/**
 * Interface pour tous les providers d'utilisateurs
 */
export interface IUserProvider {
  /**
   * Trouve un utilisateur par son ID
   */
  findById(id: number, tenantId: number): Promise<User | null>;

  /**
   * Trouve un utilisateur par son email
   */
  findByEmail(email: string, tenantId: number): Promise<User | null>;

  /**
   * Trouve un utilisateur par son username
   */
  findByUsername(username: string, tenantId: number): Promise<User | null>;

  /**
   * Crée un utilisateur
   */
  create(data: CreateUserDTO): Promise<User>;

  /**
   * Met à jour un utilisateur
   */
  update(id: number, data: UpdateUserDTO, tenantId: number): Promise<User>;

  /**
   * Supprime un utilisateur
   */
  delete(id: number, tenantId: number): Promise<void>;

  /**
   * Liste tous les utilisateurs d'un tenant
   */
  findAllByTenant(tenantId: number, filters?: UserFilters): Promise<User[]>;

  /**
   * Vérifie les credentials (email + password)
   */
  verifyCredentials(email: string, password: string, tenantId: number): Promise<User | null>;

  /**
   * Vérifie les credentials (PIN)
   */
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
  phone?: string;
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

### 5.2.4 ISyncProvider

**Fichier** : `src/server/infrastructure/providers/sync/ISyncProvider.ts`

```typescript
/**
 * Interface pour tous les providers de synchronisation
 */
export interface ISyncProvider {
  /**
   * Démarre la synchronisation
   */
  start(): Promise<void>;

  /**
   * Arrête la synchronisation
   */
  stop(): Promise<void>;

  /**
   * Synchronise une entité
   */
  syncEntity(entityType: string, entityId: string): Promise<void>;

  /**
   * Synchronise toutes les entités
   */
  syncAll(): Promise<void>;

  /**
   * Vérifie si la synchronisation est en cours
   */
  isSyncing(): boolean;

  /**
   * Récupère le statut de synchronisation
   */
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

## Priorité 3 : Tenant/User/RBAC (Jour 2-3)

### 5.3.1 Repository Interfaces

**Fichier** : `src/server/infrastructure/repositories/ITenantRepository.ts`

```typescript
/**
 * Interface pour tous les repositories de Tenant
 */
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
  logoUrl?: string;
  primaryColor?: string;
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
  logoUrl?: string;
  primaryColor?: string;
  ownerId?: number;
  planId?: number;
}

export interface UpdateTenantDTO {
  name?: string;
  slug?: string;
  logoUrl?: string;
  primaryColor?: string;
  status?: TenantStatus;
  planId?: number;
}

export interface TenantFilters {
  status?: TenantStatus;
  planId?: number;
  ownerId?: number;
  search?: string;
  page?: number;
  limit?: number;
}
```

**Fichier** : `src/server/infrastructure/repositories/IUserRepository.ts`

```typescript
/**
 * Interface pour tous les repositories d'utilisateurs
 */
export interface IUserRepository {
  findById(id: number, tenantId: number): Promise<User | null>;
  findByEmail(email: string, tenantId: number): Promise<User | null>;
  findByUsername(username: string, tenantId: number): Promise<User | null>;
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
  phone?: string;
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

**Fichiers supplémentaires** :
- `IRoleRepository.ts` - Gestion des rôles
- `IPermissionRepository.ts` - Gestion des permissions

## Priorité 4 : Synchronisation (Jour 3-4)

### 5.4.1 ISyncRepository

**Fichier** : `src/server/infrastructure/repositories/ISyncRepository.ts`

```typescript
/**
 * Interface pour les repositories de synchronisation
 */
export interface ISyncRepository {
  /**
   * Crée un événement de synchronisation
   */
  createSyncEvent(event: SyncEventDTO): Promise<SyncEvent>;

  /**
   * Récupère les événements en attente
   */
  getPendingEvents(tenantId: number): Promise<SyncEvent[]>;

  /**
   * Marque un événement comme synchronisé
   */
  markAsSynced(eventId: string): Promise<void>;

  /**
   * Marque un événement comme échoué
   */
  markAsFailed(eventId: string, error: string): Promise<void>;

  /**
   * Nettoie les événements anciens
   */
  cleanupOldEvents(olderThan: Date): Promise<number>;
}

export interface SyncEvent {
  id: string;
  tenantId: number;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data: Record<string, any>;
  status: 'pending' | 'synced' | 'failed';
  createdAt: Date;
  syncedAt?: Date;
  error?: string;
}

export interface SyncEventDTO {
  tenantId: number;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data: Record<string, any>;
}
```

## Priorité 5 : Domain Layer (Jour 3-4)

### 5.5.1 Entités

**Fichier** : `src/server/domain/entities/Tenant.ts`

```typescript
/**
 * Entité Tenant - représente un tenant dans le domaine
 * INDÉPENDANTE de toute infrastructure
 */
export class Tenant {
  constructor(
    public readonly id: number,
    public name: string,
    public slug: string,
    public status: TenantStatus,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public readonly logoUrl?: string,
    public readonly primaryColor?: string,
    public readonly planId?: number,
    public readonly ownerId?: number
  ) {}

  isActive(): boolean {
    return this.status === 'active';
  }

  isTrial(): boolean {
    return this.status === 'trial';
  }

  isSuspended(): boolean {
    return this.status === 'suspended';
  }

  updateStatus(newStatus: TenantStatus): void {
    this.status = newStatus;
    this.updatedAt = new Date();
  }

  updatePlan(planId: number): void {
    this.planId = planId;
    this.updatedAt = new Date();
  }
}

export type TenantStatus = 'active' | 'suspended' | 'cancelled' | 'trial' | 'past_due' | 'expired';
```

**Fichier** : `src/server/domain/entities/User.ts`

```typescript
/**
 * Entité User - représente un utilisateur dans le domaine
 */
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
    public updatedAt: Date,
    public readonly phone?: string
  ) {}

  isActiveUser(): boolean {
    return this.isActive;
  }

  isAdmin(): boolean {
    return ['super_admin', 'owner', 'admin'].includes(this.role);
  }

  canManageUsers(): boolean {
    return ['super_admin', 'owner', 'admin', 'manager'].includes(this.role);
  }

  updateName(newName: string): void {
    this.fullName = newName;
    this.updatedAt = new Date();
  }

  updateRole(newRole: UserRole): void {
    this.role = newRole;
    this.updatedAt = new Date();
  }

  setActive(active: boolean): void {
    this.isActive = active;
    this.updatedAt = new Date();
  }
}

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter';
```

### 5.5.2 Value Objects

**Fichier** : `src/server/domain/value-objects/TenantId.ts`

```typescript
/**
 * Value Object TenantId
 */
export class TenantId {
  constructor(private readonly value: number) {
    if (value <= 0) {
      throw new Error('TenantId must be a positive number');
    }
  }

  getValue(): number {
    return this.value;
  }

  equals(other: TenantId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
```

**Fichier** : `src/server/domain/value-objects/UserId.ts`

```typescript
/**
 * Value Object UserId
 */
export class UserId {
  constructor(private readonly value: number) {
    if (value <= 0) {
      throw new Error('UserId must be a positive number');
    }
  }

  getValue(): number {
    return this.value;
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
```

**Fichier** : `src/server/domain/value-objects/Email.ts`

```typescript
/**
 * Value Object Email
 */
export class Email {
  constructor(private readonly value: string) {
    if (!value || !value.includes('@')) {
      throw new Error('Invalid email address');
    }
    this.value = value.toLowerCase().trim();
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
```

### 5.5.3 Domain Events

**Fichier** : `src/server/domain/events/DomainEvent.ts`

```typescript
/**
 * Interface de base pour tous les événements de domaine
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly eventData: Record<string, any>;
}

/**
 * Event Bus - interface pour publier/abonner aux événements
 */
export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
  unsubscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}
```

**Fichier** : `src/server/domain/events/TenantCreatedEvent.ts`

```typescript
import { DomainEvent } from './DomainEvent';

export class TenantCreatedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredAt: Date;
  public readonly eventType = 'tenant.created';
  public readonly aggregateId: string;
  public readonly aggregateType = 'Tenant';
  
  constructor(
    public readonly tenantId: number,
    public readonly tenantName: string,
    public readonly tenantSlug: string
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
    this.aggregateId = String(tenantId);
    this.eventData = {
      tenantId,
      tenantName,
      tenantSlug
    };
  }

  public readonly eventData: Record<string, any>;
}
```

### 5.5.4 Domain Errors

**Fichier** : `src/server/domain/errors/DomainError.ts`

```typescript
/**
 * Erreur de base pour le domaine
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Erreur levée quand un tenant n'est pas trouvé
 */
export class TenantNotFoundError extends DomainError {
  constructor(slug: string) {
    super(`Tenant "${slug}" not found`);
    this.name = 'TenantNotFoundError';
  }
}

/**
 * Erreur levée quand les credentials sont invalides
 */
export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * Erreur levée quand un utilisateur n'est pas trouvé
 */
export class UserNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`User "${identifier}" not found`);
    this.name = 'UserNotFoundError';
  }
}
```

## Priorité 6 : Services Métier (Jour 4-5)

### 5.6.1 AuthService

**Fichier** : `src/server/application/services/auth.service.ts`

```typescript
/**
 * AuthService - Service métier pour l'authentification
 * 
 * Ce service NE CONNAÎT PAS le mode d'exécution.
 * Il utilise les providers via ProviderFactory.
 */
import { ProviderFactory } from '../../infrastructure/runtime/provider-factory';
import { IAuthProvider } from '../../infrastructure/providers/auth/IAuthProvider';

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
      throw new Error('Mot de passe trop court (minimum 8 caractères)');
    }

    return this.authProvider.login(email, password);
  }

  async loginPin(pinCode: string, identity?: string, tenantSlug?: string): Promise<AuthResult> {
    if (!pinCode || pinCode.length < 4) {
      throw new Error('PIN invalide (minimum 4 chiffres)');
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

  async checkHealth(): Promise<boolean> {
    return this.authProvider.checkHealth();
  }
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
  planName?: string;
  expiresAt?: string;
}

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter';
export type UserStatus = 'active' | 'suspended' | 'cancelled' | 'trial' | 'past_due' | 'expired';
```

### 5.6.2 TenantService

**Fichier** : `src/server/application/services/tenant.service.ts`

```typescript
/**
 * TenantService - Service métier pour la gestion des tenants
 */
import { ProviderFactory } from '../../infrastructure/runtime/provider-factory';
import { ITenantProvider } from '../../infrastructure/providers/tenant/ITenantProvider';
import { TenantNotFoundError } from '../../domain/errors/DomainError';

export class TenantService {
  private tenantProvider: ITenantProvider;

  constructor() {
    this.tenantProvider = ProviderFactory.getTenantProvider();
  }

  async getTenantBySlug(slug: string): Promise<Tenant> {
    if (!slug || slug.trim().length === 0) {
      throw new Error('Slug requis');
    }

    const tenant = await this.tenantProvider.findBySlug(slug.toLowerCase().trim());
    
    if (!tenant) {
      throw new TenantNotFoundError(slug);
    }

    return tenant;
  }

  async getTenantById(id: number): Promise<Tenant> {
    if (!id || id <= 0) {
      throw new Error('ID invalide');
    }

    const tenant = await this.tenantProvider.findById(id);
    
    if (!tenant) {
      throw new TenantNotFoundError(String(id));
    }

    return tenant;
  }

  async createTenant(data: CreateTenantDTO): Promise<Tenant> {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Nom du tenant requis');
    }
    if (!data.slug || data.slug.trim().length === 0) {
      throw new Error('Slug du tenant requis');
    }

    const existing = await this.tenantProvider.findBySlug(data.slug.toLowerCase().trim());
    if (existing) {
      throw new Error(`Un tenant avec le slug "${data.slug}" existe déjà`);
    }

    return this.tenantProvider.create(data);
  }

  async updateTenant(id: number, data: UpdateTenantDTO): Promise<Tenant> {
    if (!id || id <= 0) {
      throw new Error('ID invalide');
    }

    const existing = await this.tenantProvider.findById(id);
    if (!existing) {
      throw new TenantNotFoundError(String(id));
    }

    return this.tenantProvider.update(id, data);
  }

  async deleteTenant(id: number): Promise<void> {
    if (!id || id <= 0) {
      throw new Error('ID invalide');
    }

    const existing = await this.tenantProvider.findById(id);
    if (!existing) {
      throw new TenantNotFoundError(String(id));
    }

    return this.tenantProvider.delete(id);
  }

  async listTenants(filters?: TenantFilters): Promise<Tenant[]> {
    return this.tenantProvider.findAll(filters);
  }
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
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
  logoUrl?: string;
  primaryColor?: string;
  ownerId?: number;
  planId?: number;
}

export interface UpdateTenantDTO {
  name?: string;
  slug?: string;
  logoUrl?: string;
  primaryColor?: string;
  status?: TenantStatus;
  planId?: number;
}

export interface TenantFilters {
  status?: TenantStatus;
  planId?: number;
  ownerId?: number;
  search?: string;
  page?: number;
  limit?: number;
}
```

## Priorité 7 : Tests et Documentation (Jour 5)

### 5.7.1 Tests

**Objectif** : Couverture > 95%

**Tests à écrire** :

1. **RuntimeContext** (100%)
   - Détection du mode
   - Détection du runtime type
   - Détection du stockage
   - Résolution depuis requête HTTP

2. **ProviderFactory** (100%)
   - Initialisation
   - Cache
   - Reset

3. **Repository Interfaces** (100%)
   - Validation des contrats

4. **Services Métier** (95%)
   - AuthService
   - TenantService

### 5.7.2 Documentation

**Fichier** : `docs/PHASE_1_ARCHITECTURE_V2.md`

**Contenu** :
- Description de l'architecture
- Diagrammes
- Exemples d'utilisation
- Guide de migration Phase 2

---

# 6. FICHIERS CRÉÉS

## 6.1 Runtime Layer (3 fichiers)

```
src/server/infrastructure/runtime/
├── index.ts                        # Export public
├── runtime-context.ts              # RuntimeContext
└── provider-factory.ts             # ProviderFactory adaptée
```

## 6.2 Provider Interfaces (4 fichiers)

```
src/server/infrastructure/providers/
├── index.ts                        # Export public
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

## 6.4 Domain Layer (15+ fichiers)

```
src/server/domain/
├── entities/
│   ├── Tenant.ts
│   ├── User.ts
│   ├── Order.ts
│   ├── Product.ts
│   └── Category.ts
├── value-objects/
│   ├── TenantId.ts
│   ├── UserId.ts
│   ├── Email.ts
│   └── Money.ts
├── events/
│   ├── DomainEvent.ts
│   ├── TenantCreatedEvent.ts
│   ├── UserCreatedEvent.ts
│   └── OrderCreatedEvent.ts
└── errors/
    ├── DomainError.ts
    ├── TenantNotFoundError.ts
    ├── UserNotFoundError.ts
    └── InvalidCredentialsError.ts
```

## 6.5 Services Métier (2 fichiers)

```
src/server/application/services/
├── auth.service.ts
└── tenant.service.ts
```

## 6.6 Tests (15+ fichiers)

```
src/server/infrastructure/runtime/__tests__/
├── runtime-context.test.ts
└── provider-factory.test.ts

src/server/infrastructure/providers/__tests__/
├── IAuthProvider.test.ts
├── ITenantProvider.test.ts
├── IUserProvider.test.ts
└── ISyncProvider.test.ts

src/server/infrastructure/repositories/__tests__/
├── ITenantRepository.test.ts
├── IUserRepository.test.ts
└── ...

src/server/domain/__tests__/
├── entities/Tenant.test.ts
├── entities/User.test.ts
└── ...

src/server/application/services/__tests__/
├── auth.service.test.ts
└── tenant.service.test.ts
```

**Total** : ~45 nouveaux fichiers

---

# 7. RESPONSABILITÉS

## 7.1 RuntimeContext

**Responsabilité** : Capturer toute la configuration d'exécution

**Méthodes** :
- `getInstance()` : Singleton
- `isLocal()`, `isCloud()`, `isHybrid()` : Vérifier le mode
- `isDesktop()`, `isServer()`, `isMobile()` : Vérifier le type
- `usesSQLite()`, `usesSupabase()` : Vérifier le stockage
- `shouldSync()` : Vérifier si sync activée
- `resolveFromRequest()` : Résoudre depuis requête HTTP

**Pourquoi** : Centraliser TOUTE la configuration d'exécution dans un seul objet.

## 7.2 ProviderFactory

**Responsabilité** : Créer les providers selon RuntimeContext

**Méthodes** :
- `initialize()` : Initialiser tous les providers
- `getAuthProvider()` : Récupérer le provider d'auth
- `getTenantProvider()` : Récupérer le provider de tenant
- `getUserProvider()` : Récupérer le provider d'user
- `getSyncProvider()` : Récupérer le provider de sync
- `reset()` : Reset pour les tests

**Pourquoi** : Masquer la complexité de la création des providers.

## 7.3 Repository Interfaces

**Responsabilité** : Définir les contrats d'accès aux données

**Méthodes** : CRUD + recherche + filtres

**Pourquoi** : Abstraire l'accès aux données (SQLite vs Supabase)

## 7.4 Provider Interfaces

**Responsabilité** : Définir les contrats des providers

**Méthodes** : Spécifiques à chaque domaine (auth, tenant, user, sync)

**Pourquoi** : Découpler la logique métier de l'implémentation

## 7.5 Domain Layer

**Responsabilité** : Représenter les concepts métier

**Éléments** :
- Entités : Tenant, User, Order, Product, Category
- Value Objects : TenantId, UserId, Email, Money
- Events : TenantCreatedEvent, UserCreatedEvent
- Errors : TenantNotFoundError, InvalidCredentialsError

**Pourquoi** : Avoir une couche métier indépendante de l'infrastructure

## 7.6 Services Métier

**Responsabilité** : Orchestrer la logique métier

**Méthodes** :
- AuthService : login, logout, refresh, me
- TenantService : CRUD tenants

**Pourquoi** : Découpler la logique métier de l'infrastructure

---

# 8. DÉPENDANCES

## 8.1 Dépendances entre Couches

```
Domain Layer
  ↓ (aucune dépendance)
  
Application Layer
  ↓ (dépend de)
  
Infrastructure Layer
  ↓ (dépend de)
  
Presentation Layer
```

## 8.2 Dépendances Internes

### RuntimeContext
- **Dépend de** : Aucune (niveau le plus bas)
- **Utilisé par** : ProviderFactory

### ProviderFactory
- **Dépend de** : RuntimeContext, Provider Interfaces
- **Utilisé par** : Services métier

### Repository Interfaces
- **Dépend de** : Domain Layer (entités, DTOs)
- **Utilisé par** : Providers (futur)

### Provider Interfaces
- **Dépend de** : Aucune
- **Utilisé par** : ProviderFactory, Services métier

### Domain Layer
- **Dépend de** : Aucune (niveau le plus bas)
- **Utilisé par** : Repository Interfaces, Services métier

### Services Métier
- **Dépend de** : ProviderFactory, Provider Interfaces
- **Utilisé par** : Controllers/Routes (futur)

---

# 9. STRATÉGIE DE MIGRATION ORIENTÉE RISQUE

## 9.1 Priorisation par Risque

### Priorité 1 : RuntimeContext (CRITIQUE)

**Risque** : Élevé (bloque tout le reste)  
**Impact** : Critique (fondation de l'architecture)  
**Effort** : 1 jour

**Pourquoi en premier** :
- ✅ Bloque la création de ProviderFactory
- ✅ Bloque la création des providers
- ✅ Aucun risque (nouveau fichier)

### Priorité 2 : Auth (CRITIQUE)

**Risque** : Élevé (sécurité)  
**Impact** : Critique (fonctionnalité critique)  
**Effort** : 1-2 jours

**Pourquoi en deuxième** :
- ✅ Fonctionnalité critique (login)
- ✅ Bloque les autres fonctionnalités
- ✅ Impact utilisateur direct

### Priorité 3 : Tenant/User/RBAC (ÉLEVÉ)

**Risque** : Élevé (core business)  
**Impact** : Élevé (multi-tenancy)  
**Effort** : 1-2 jours

**Pourquoi en troisième** :
- ✅ Core business (multi-tenancy)
- ✅ RBAC critique pour la sécurité
- ✅ Bloque les autres fonctionnalités

### Priorité 4 : Synchronisation (MOYEN)

**Risque** : Moyen (complexité)  
**Impact** : Moyen (HYBRID uniquement)  
**Effort** : 1 jour

**Pourquoi en quatrième** :
- ✅ Uniquement pour HYBRID
- ✅ Moteur existant à préserver
- ✅ Moins critique que Auth/Tenant

### Priorité 5 : POS Core (MOYEN)

**Risque** : Moyen (complexité)  
**Impact** : Élevé (fonctionnalités métier)  
**Effort** : 2-3 jours

**Pourquoi en cinquième** :
- ✅ Dépend de Auth + Tenant
- ✅ Fonctionnalités métier (orders, products, inventory)
- ✅ Peut être migré progressivement

### Priorité 6 : Nettoyage (FAIBLE)

**Risque** : Faible (suppression)  
**Impact** : Faible (code mort)  
**Effort** : 1 jour

**Pourquoi en dernier** :
- ✅ Suppression de l'ancien code
- ✅ Aucun risque (code déjà migré)
- ✅ Nettoyage final

## 9.2 Timeline par Priorité

```
Jour 1 :
  - RuntimeContext (Priorité 1)
  - ProviderFactory (Priorité 1)

Jour 1-2 :
  - IAuthProvider (Priorité 2)
  - AuthService (Priorité 2)

Jour 2-3 :
  - ITenantProvider (Priorité 3)
  - IUserProvider (Priorité 3)
  - TenantService (Priorité 3)

Jour 3-4 :
  - ISyncProvider (Priorité 4)
  - ISyncRepository (Priorité 4)

Jour 4-5 :
  - Tests + Documentation
  - Validation

Total : 5 jours
```

---

# 10. RISQUES ET MITIGATIONS

## 10.1 Risques Identifiés

### Risque 1 : RuntimeContext trop complexe

**Probabilité** : Faible  
**Impact** : Moyen  
**Description** : RuntimeContext peut devenir trop complexe avec trop de responsabilités.

**Mitigation** :
- ✅ Responsabilités clairement définies
- ✅ Tests unitaires pour chaque méthode
- ✅ Documentation complète
- ✅ Review architecturale

### Risque 2 : Oublis dans les Interfaces

**Probabilité** : Faible  
**Impact** : Élevé  
**Description** : Une interface incomplète peut bloquer la Phase 2.

**Mitigation** :
- ✅ Analyser le code existant pour identifier toutes les méthodes
- ✅ Review par un architecte
- ✅ Tests de compilation (TypeScript)
- ✅ Documentation complète des interfaces

### Risque 3 : Incompatibilité avec le Code Existant

**Probabilité** : Faible  
**Impact** : Élevé  
**Description** : Les nouvelles interfaces peuvent être incompatibles avec le code existant.

**Mitigation** :
- ✅ Phase 1 = code parallèle (pas de modification de l'existant)
- ✅ Tests de non-régression
- ✅ Validation manuelle
- ✅ Rollback facile (supprimer les nouveaux fichiers)

### Risque 4 : Performance

**Probabilité** : Faible  
**Impact** : Faible  
**Description** : Le cache des providers peut causer des problèmes de mémoire.

**Mitigation** :
- ✅ Singleton pattern (une seule instance)
- ✅ Lazy loading (création à la demande)
- ✅ Tests de performance
- ✅ Monitoring

### Risque 5 : Tests Incomplets

**Probabilité** : Moyenne  
**Impact** : Moyen  
**Description** : Les tests peuvent ne pas couvrir tous les cas.

**Mitigation** :
- ✅ Couverture cible : 95%
- ✅ Tests unitaires pour chaque méthode
- ✅ Tests d'intégration pour chaque service
- ✅ CI/CD avec vérification de couverture

## 10.2 Matrice de Risques

| Risque | Probabilité | Impact | Mitigation | Résiduel |
|--------|-------------|--------|------------|----------|
| RuntimeContext complexe | Faible | Moyen | Tests + review | Faible |
| Oublis interfaces | Faible | Élevé | Review + tests | Faible |
| Incompatibilité | Faible | Élevé | Code parallèle | Très faible |
| Performance | Faible | Faible | Cache + lazy loading | Très faible |
| Tests incomplets | Moyenne | Moyen | Couverture 95% | Faible |

**Risque résiduel global** : FAIBLE

---

# 11. CHECKLIST DE VALIDATION

## 11.1 Checklist Technique

### RuntimeContext
- [ ] RuntimeContext détecte correctement le mode LOCAL
- [ ] RuntimeContext détecte correctement le mode CLOUD
- [ ] RuntimeContext détecte correctement le mode HYBRID
- [ ] RuntimeContext détecte le type de runtime (DESKTOP, SERVER, MOBILE)
- [ ] RuntimeContext détecte le stockage (primary, secondary)
- [ ] RuntimeContext détecte syncEnabled
- [ ] RuntimeContext résout le mode depuis une requête HTTP

### ProviderFactory
- [ ] ProviderFactory crée les providers selon RuntimeContext
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
- [ ] Entité Tenant créée
- [ ] Entité User créée
- [ ] Value Objects créés
- [ ] Domain Events créés
- [ ] Domain Errors créés

### Services Métier
- [ ] AuthService créé
- [ ] TenantService créé

### Tests
- [ ] Tests RuntimeContext passent
- [ ] Tests ProviderFactory passent
- [ ] Tests Repository interfaces passent
- [ ] Tests Domain Layer passent
- [ ] Tests Services métier passent
- [ ] Couverture > 95%

### Documentation
- [ ] Architecture documentée
- [ ] Interfaces documentées
- [ ] Services documentés
- [ ] Exemples d'utilisation fournis

## 11.2 Checklist de Non-Régression

- [ ] Aucun fichier existant modifié
- [ ] Aucune dépendance ajoutée
- [ ] Aucune configuration modifiée
- [ ] Tests existants passent toujours
- [ ] Application démarre sans erreur
- [ ] Performance identique

## 11.3 Checklist de Validation Finale

- [ ] Tous les tests passent
- [ ] Couverture > 95%
- [ ] Documentation complète
- [ ] Code review approuvé
- [ ] Validation architecturale
- [ ] Prêt pour Phase 2

---

# 12. PROCHAINES ÉTAPES

## 12.1 Après Phase 1

### Phase 2 : Backend Providers (2 semaines)

**Objectif** : Implémenter les providers concrets (LOCAL, CLOUD, HYBRIDE)

**Livrables** :
- LocalAuthProvider, CloudAuthProvider, HybridAuthProvider
- LocalTenantProvider, CloudTenantProvider, HybridTenantProvider
- Tests pour chaque provider

### Phase 3 : Frontend Services (1 semaine)

**Objectif** : Créer les services frontend

**Livrables** :
- AuthService frontend
- TenantService frontend
- Tests

### Phase 4 : Migration des Stores (1 semaine)

**Objectif** : Migrer les stores vers les nouveaux services

**Livrables** :
- useAuthStore migré
- Tests passent

### Phase 5 : Migration des Composants (2 semaines)

**Objectif** : Migrer LoginPage et autres composants

**Livrables** :
- LoginPage simplifié
- Plus de isLocal()
- Plus de données hardcodées

### Phase 6 : Nettoyage (1 semaine)

**Objectif** : Supprimer l'ancien code

**Livrables** :
- app-mode.ts supprimé
- data-source-manager.ts supprimé
- Code propre

---

# CONCLUSION

## Résumé de la Phase 1 V2

**Objectif** : Créer les fondations de la nouvelle architecture

**Durée** : 5 jours

**Livrables** :
- ✅ RuntimeContext (remplace ModeResolver)
- ✅ ProviderFactory adaptée
- ✅ 4 Provider Interfaces (Auth, Tenant, User, Sync)
- ✅ 5 Repository Interfaces
- ✅ Domain Layer (entités, value objects, events, errors)
- ✅ 2 Services métier (Auth, Tenant)
- ✅ Tests (couverture > 95%)

**Risques** : Faible (code parallèle, aucune modification de l'existant)

**Impact** : Aucune régression (code parallèle uniquement)

## Bénéfices Attendus

- ✅ Architecture propre et évolutive
- ✅ 0 dépendance au mode dans les services métier
- ✅ Testabilité maximale
- ✅ Évolutivité (ajout de mode facile)
- ✅ Maintenabilité améliorée

## Prochaines Étapes

1. **Valider** ce plan d'implémentation V2
2. **Démarrer** Jour 1 : RuntimeContext
3. **Exécuter** les 5 jours selon le plan
4. **Valider** chaque checkpoint
5. **Passer** à Phase 2

---

**Fin du Plan d'Implémentation Phase 1 V2**

*Document généré par l'Architecte Logiciel Senior*  
*Date : 2026-01-07*