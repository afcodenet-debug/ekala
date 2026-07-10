# PHASE 1 — PLAN D'IMPLÉMENTATION DÉTAILLÉ
## Domain Layer + Runtime Layer

**Date** : 2026-01-07  
**Auteur** : Architecte Logiciel Senior  
**Statut** : PLAN D'IMPLÉMENTATION  
**Version** : 1.0.0  
**Durée Estimée** : 5 jours

---

# SOMMAIRE

1. [Principes Architecturaux Non Négociables](#1-principes-architecturaux-non-négociables)
2. [Objectifs de la Phase 1](#2-objectifs-de-la-phase-1)
3. [Structure des Dossiers](#3-structure-des-dossiers)
4. [Plan d'Implémentation Détaillé](#4-plan-dimplémentation-détaillé)
5. [Fichiers Impactés](#5-fichiers-impactés)
6. [Rôle de Chaque Modification](#6-rôle-de-chaque-modification)
7. [Risques et Mitigations](#7-risques-et-mitigations)
8. [Plan de Migration](#8-plan-de-migration)
9. [Tests et Validation](#9-tests-et-validation)
10. [Checklist de Validation](#10-checklist-de-validation)

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
// BON - Résolution centralisée
const provider = ProviderFactory.getAuthProvider();
const result = await provider.login(email, password);
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

1. **Runtime Layer** : Créer `ModeResolver` et `ProviderFactory`
2. **Domain Layer** : Créer les entités et interfaces du domaine
3. **Repository Interfaces** : Définir les contrats pour tous les repositories
4. **Services Métier** : Créer les services découplés de l'infrastructure
5. **Tests** : Écrire les tests unitaires pour toutes les nouvelles classes

## 2.3 Livrables

- ✅ `ModeResolver` fonctionnel et testé
- ✅ `ProviderFactory` fonctionnel et testé
- ✅ 10 interfaces de providers définies
- ✅ 10 interfaces de repositories définies
- ✅ 5 services métier créés (Auth, Tenant, Billing, Order, Inventory)
- ✅ Tests unitaires (couverture > 95%)
- ✅ Documentation complète

## 2.4 Non-Objectifs de la Phase 1

- ❌ Implémenter les providers concrets (LOCAL, CLOUD, HYBRID)
- ❌ Modifier le code existant
- ❌ Migrer les composants React
- ❌ Migrer les stores
- ❌ Supprimer `app-mode.ts` ou `data-source-manager.ts`

**Principe** : Phase 1 = fondations uniquement, code parallèle, aucune modification de l'existant.

---

# 3. STRUCTURE DES DOSSIERS

## 3.1 Arborescence Complète

```
src/server/
├── infrastructure/
│   ├── data-source-manager.ts              # [EXISTANT] Conservé pour rétrocompatibilité
│   │
│   ├── runtime/                            # [NOUVEAU] Runtime Layer
│   │   ├── index.ts                        # Export public
│   │   ├── mode-resolver.ts                # ModeResolver - Résout le mode d'exécution
│   │   └── provider-factory.ts             # ProviderFactory - Crée les providers
│   │
│   ├── providers/                          # [NOUVEAU] Providers (interfaces uniquement)
│   │   ├── index.ts                        # Export public
│   │   ├── auth/
│   │   │   └── IAuthProvider.ts            # Interface
│   │   ├── billing/
│   │   │   └── IBillingProvider.ts
│   │   ├── tenant/
│   │   │   └── ITenantProvider.ts
│   │   ├── order/
│   │   │   └── IOrderProvider.ts
│   │   ├── inventory/
│   │   │   └── IInventoryProvider.ts
│   │   ├── sync/
│   │   │   └── ISyncProvider.ts
│   │   ├── user/
│   │   │   └── IUserProvider.ts
│   │   ├── printer/
│   │   │   └── IPrinterProvider.ts
│   │   ├── settings/
│   │   │   └── ISettingsProvider.ts
│   │   └── notification/
│   │       └── INotificationProvider.ts
│   │
│   ├── repositories/                       # [NOUVEAU] Repository Interfaces
│   │   ├── ITenantRepository.ts
│   │   ├── IUserRepository.ts
│   │   ├── IOrderRepository.ts
│   │   ├── IProductRepository.ts
│   │   ├── ICategoryRepository.ts
│   │   ├── ISupplierRepository.ts
│   │   ├── IInventoryRepository.ts
│   │   ├── IExpenseRepository.ts
│   │   ├── ISubscriptionRepository.ts      # Déjà existe
│   │   ├── IVoucherRepository.ts           # Déjà existe
│   │   └── ...
│   │
│   └── domain/                             # [NOUVEAU] Domain Layer
│       ├── entities/
│       │   ├── Tenant.ts
│       │   ├── User.ts
│       │   ├── Order.ts
│       │   ├── Product.ts
│       │   ├── Category.ts
│       │   └── ...
│       ├── value-objects/
│       │   ├── TenantId.ts
│       │   ├── UserId.ts
│       │   ├── OrderId.ts
│       │   ├── Money.ts
│       │   └── ...
│       └── events/
│           ├── DomainEvent.ts
│           ├── TenantCreatedEvent.ts
│           ├── OrderCreatedEvent.ts
│           └── ...
│
├── application/                            # [EXISTANT] À modifier progressivement
│   └── services/
│       ├── auth.service.ts                 # [À CRÉER] Service métier auth
│       ├── tenant.service.ts               # [À CRÉER] Service métier tenant
│       ├── billing.service.ts              # [EXISTANT] À adapter
│       ├── order.service.ts                # [EXISTANT] À adapter
│       └── ...
│
└── routes/                                 # [EXISTANT] À modifier progressivement
    ├── auth.routes.ts
    ├── tenants.routes.ts
    └── ...
```

## 3.2 Principe d'Organisation

```
Couche Domaine (Domain Layer)
  ↓ (dépend de)
Couche Application (Application Services)
  ↓ (dépend de)
Couche Infrastructure (Providers + Repositories)
  ↓ (dépend de)
Couche Présentation (Routes + Controllers)
```

**Règle** : Les dépendances vont TOUJOURS de la couche supérieure vers la couche inférieure.

---

# 4. PLAN D'IMPLÉMENTATION DÉTAILLÉ

## Jour 1 : Runtime Layer (ModeResolver + ProviderFactory)

### 4.1.1 ModeResolver

**Fichier** : `src/server/infrastructure/runtime/mode-resolver.ts`

**Responsabilité** : Déterminer le mode d'exécution (LOCAL, CLOUD, HYBRID)

**Implémentation** :

```typescript
/**
 * ModeResolver - UNIQUE source de vérité pour le mode d'exécution
 * 
 * Principes :
 * - Electron → LOCAL
 * - VITE_APP_MODE=local → LOCAL
 * - VITE_APP_MODE=cloud → CLOUD
 * - VITE_APP_MODE=hybrid → HYBRID
 * - localhost → LOCAL
 * - Par défaut → CLOUD
 * 
 * Cette classe est le SEUL endroit où le mode est déterminé.
 * Aucun autre fichier ne doit détecter le mode.
 */
export type ExecutionMode = 'LOCAL' 'CLOUD' | 'HYBRID';

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

  /**
   * Résout le mode à partir d'une requête HTTP
   * Vérifie X-Runtime-Mode header en priorité
   */
  public resolveFromRequest(req: { headers?: Record<string, any> }): ExecutionMode {
    const runtimeHeader = req?.headers?.['x-runtime-mode'];
    if (runtimeHeader === 'local' || runtimeHeader === 'cloud' || runtimeHeader === 'hybrid') {
      return runtimeHeader.toUpperCase() as ExecutionMode;
    }

    // En Electron, on reste en local quoi qu'il arrive
    if (this.isLocal()) return 'LOCAL';

    const host = req?.headers?.host || req?.headers?.origin || req?.headers?.referer;
    if (host) {
      return this.resolveFromHost(String(host));
    }

    return this.cachedMode;
  }

  private resolveFromHost(host: string): ExecutionMode {
    // Logique de résolution depuis un host
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return 'LOCAL';
    }
    return 'CLOUD';
  }
}
```

**Tests** : `src/server/infrastructure/runtime/__tests__/mode-resolver.test.ts`

```typescript
describe('ModeResolver', () => {
  beforeEach(() => {
    // Reset singleton
    (ModeResolver as any).instance = null;
  });

  it('should detect LOCAL mode in development', () => {
    // Mock import.meta.env.DEV = true
    const resolver = ModeResolver.getInstance();
    expect(resolver.isLocal()).toBe(true);
  });

  it('should detect CLOUD mode in production', () => {
    // Mock import.meta.env.DEV = undefined
    const resolver = ModeResolver.getInstance();
    expect(resolver.isCloud()).toBe(true);
  });

  it('should resolve mode from request header', () => {
    const resolver = ModeResolver.getInstance();
    const mode = resolver.resolveFromRequest({
      headers: { 'x-runtime-mode': 'local' }
    });
    expect(mode).toBe('LOCAL');
  });
});
```

### 4.1.2 ProviderFactory

**Fichier** : `src/server/infrastructure/runtime/provider-factory.ts`

**Responsabilité** : Créer les providers selon le mode d'exécution

**Implémentation** :

```typescript
/**
 * ProviderFactory - UNIQUE point de création des providers
 * 
 * La factory connaît le mode d'exécution et choisit l'implémentation.
 * Le reste de l'application ne sait pas quel mode est actif.
 * 
 * Principe :
 * - Les providers sont créés UNE SEULE fois (cache)
 * - Le mode est résolu UNE SEULE fois (ModeResolver)
 * - Aucune condition if (isLocal) dans les consumers
 */
import { ModeResolver, ExecutionMode } from './mode-resolver';
import { IAuthProvider } from '../providers/auth/IAuthProvider';
import { IBillingProvider } from '../providers/billing/IBillingProvider';
import { ITenantProvider } from '../providers/tenant/ITenantProvider';
import { IOrderProvider } from '../providers/order/IOrderProvider';
import { IInventoryProvider } from '../providers/inventory/IInventoryProvider';
import { ISyncProvider } from '../providers/sync/ISyncProvider';
import { IUserProvider } from '../providers/user/IUserProvider';
import { IPrinterProvider } from '../providers/printer/IPrinterProvider';
import { ISettingsProvider } from '../providers/settings/ISettingsProvider';
import { INotificationProvider } from '../providers/notification/INotificationProvider';

export class ProviderFactory {
  private static modeResolver = ModeResolver.getInstance();
  private static providers: Map<string, any> = new Map();
  private static initialized = false;

  /**
   * Initialise tous les providers (appelé une fois au démarrage)
   */
  public static initialize(): void {
    if (ProviderFactory.initialized) return;
    
    const mode = ProviderFactory.modeResolver.resolve();
    console.log(`[ProviderFactory] Initializing providers for mode: ${mode}`);
    
    // Pré-charger tous les providers
    ProviderFactory.getAuthProvider();
    ProviderFactory.getBillingProvider();
    ProviderFactory.getTenantProvider();
    ProviderFactory.getOrderProvider();
    ProviderFactory.getInventoryProvider();
    ProviderFactory.getSyncProvider();
    ProviderFactory.getUserProvider();
    ProviderFactory.getPrinterProvider();
    ProviderFactory.getSettingsProvider();
    ProviderFactory.getNotificationProvider();
    
    ProviderFactory.initialized = true;
    console.log(`[ProviderFactory] All providers initialized for mode: ${mode}`);
  }

  /**
   * Retourne le provider d'authentification selon le mode
   */
  public static getAuthProvider(): IAuthProvider {
    const cacheKey = 'auth-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      const mode = ProviderFactory.modeResolver.resolve();
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createAuthProvider(mode));
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  /**
   * Retourne le provider de billing selon le mode
   */
  public static getBillingProvider(): IBillingProvider {
    const cacheKey = 'billing-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      const mode = ProviderFactory.modeResolver.resolve();
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createBillingProvider(mode));
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  /**
   * Retourne le provider de tenant selon le mode
   */
  public static getTenantProvider(): ITenantProvider {
    const cacheKey = 'tenant-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      const mode = ProviderFactory.modeResolver.resolve();
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createTenantProvider(mode));
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  /**
   * Retourne le provider de commandes selon le mode
   */
  public static getOrderProvider(): IOrderProvider {
    const cacheKey = 'order-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      const mode = ProviderFactory.modeResolver.resolve();
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createOrderProvider(mode));
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  /**
   * Retourne le provider d'inventaire selon le mode
   */
  public static getInventoryProvider(): IInventoryProvider {
    const cacheKey = 'inventory-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      const mode = ProviderFactory.modeResolver.resolve();
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createInventoryProvider(mode));
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  /**
   * Retourne le provider de synchronisation selon le mode
   */
  public static getSyncProvider(): ISyncProvider {
    const cacheKey = 'sync-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      const mode = ProviderFactory.modeResolver.resolve();
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createSyncProvider(mode));
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  /**
   * Retourne le provider d'utilisateurs selon le mode
   */
  public static getUserProvider(): IUserProvider {
    const cacheKey = 'user-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      const mode = ProviderFactory.modeResolver.resolve();
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createUserProvider(mode));
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  /**
   * Retourne le provider d'imprimantes selon le mode
   */
  public static getPrinterProvider(): IPrinterProvider {
    const cacheKey = 'printer-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      const mode = ProviderFactory.modeResolver.resolve();
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createPrinterProvider(mode));
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  /**
   * Retourne le provider de paramètres selon le mode
   */
  public static getSettingsProvider(): ISettingsProvider {
    const cacheKey = 'settings-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      const mode = ProviderFactory.modeResolver.resolve();
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createSettingsProvider(mode));
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  /**
   * Retourne le provider de notifications selon le mode
   */
  public static getNotificationProvider(): INotificationProvider {
    const cacheKey = 'notification-provider';
    if (!ProviderFactory.providers.has(cacheKey)) {
      const mode = ProviderFactory.modeResolver.resolve();
      ProviderFactory.providers.set(cacheKey, ProviderFactory.createNotificationProvider(mode));
    }
    return ProviderFactory.providers.get(cacheKey);
  }

  // ============================================================================
  // MÉTHODES DE CRÉATION (privées)
  // ============================================================================

  private static createAuthProvider(mode: ExecutionMode): IAuthProvider {
    // TODO Phase 2: Implémenter les providers concrets
    // Pour Phase 1, on retourne un stub
    throw new Error(`AuthProvider not implemented yet for mode: ${mode}`);
  }

  private static createBillingProvider(mode: ExecutionMode): IBillingProvider {
    throw new Error(`BillingProvider not implemented yet for mode: ${mode}`);
  }

  private static createTenantProvider(mode: ExecutionMode): ITenantProvider {
    throw new Error(`TenantProvider not implemented yet for mode: ${mode}`);
  }

  private static createOrderProvider(mode: ExecutionMode): IOrderProvider {
    throw new Error(`OrderProvider not implemented yet for mode: ${mode}`);
  }

  private static createInventoryProvider(mode: ExecutionMode): IInventoryProvider {
    throw new Error(`InventoryProvider not implemented yet for mode: ${mode}`);
  }

  private static createSyncProvider(mode: ExecutionMode): ISyncProvider {
    throw new Error(`SyncProvider not implemented yet for mode: ${mode}`);
  }

  private static createUserProvider(mode: ExecutionMode): IUserProvider {
    throw new Error(`UserProvider not implemented yet for mode: ${mode}`);
  }

  private static createPrinterProvider(mode: ExecutionMode): IPrinterProvider {
    throw new Error(`PrinterProvider not implemented yet for mode: ${mode}`);
  }

  private static createSettingsProvider(mode: ExecutionMode): ISettingsProvider {
    throw new Error(`SettingsProvider not implemented yet for mode: ${mode}`);
  }

  private static createNotificationProvider(mode: ExecutionMode): INotificationProvider {
    throw new Error(`NotificationProvider not implemented yet for mode: ${mode}`);
  }

  /**
   * Reset tous les providers (utile pour les tests)
   */
  public static reset(): void {
    ProviderFactory.providers.clear();
    ProviderFactory.initialized = false;
  }

  /**
   * Retourne le mode actuel (pour debug)
   */
  public static getCurrentMode(): ExecutionMode {
    return ProviderFactory.modeResolver.resolve();
  }
}
```

**Tests** : `src/server/infrastructure/runtime/__tests__/provider-factory.test.ts`

```typescript
describe('ProviderFactory', () => {
  beforeEach(() => {
    ProviderFactory.reset();
  });

  it('should initialize all providers', () => {
    // Mock ModeResolver to return LOCAL
    // Mock all providers to return stubs
    
    ProviderFactory.initialize();
    
    // Vérifier que tous les providers sont créés
    const authProvider = ProviderFactory.getAuthProvider();
    const billingProvider = ProviderFactory.getBillingProvider();
    const tenantProvider = ProviderFactory.getTenantProvider();
    
    expect(authProvider).toBeDefined();
    expect(billingProvider).toBeDefined();
    expect(tenantProvider).toBeDefined();
  });

  it('should cache providers', () => {
    ProviderFactory.initialize();
    
    const authProvider1 = ProviderFactory.getAuthProvider();
    const authProvider2 = ProviderFactory.getAuthProvider();
    
    expect(authProvider1).toBe(authProvider2); // Same instance
  });

  it('should reset all providers', () => {
    ProviderFactory.initialize();
    ProviderFactory.reset();
    
    // Après reset, les providers doivent être recréés
    const authProvider1 = ProviderFactory.getAuthProvider();
    const authProvider2 = ProviderFactory.getAuthProvider();
    
    expect(authProvider1).toBe(authProvider2);
  });
});
```

## Jour 2 : Repository Interfaces

### 2.1 ITenantRepository

**Fichier** : `src/server/infrastructure/repositories/ITenantRepository.ts`

```typescript
/**
 * Interface pour tous les repositories de Tenant
 * SQLite, Supabase et Hybride doivent implémenter cette interface
 */
export interface ITenantRepository {
  /**
   * Trouve un tenant par son slug
   * @param slug - Le slug du tenant (ex: "makutano")
   * @returns Promise<Tenant | null>
   */
  findBySlug(slug: string): Promise<Tenant | null>;

  /**
   * Trouve un tenant par son ID
   * @param id - L'ID du tenant
   * @returns Promise<Tenant | null>
   */
  findById(id: number): Promise<Tenant | null>;

  /**
   * Crée un nouveau tenant
   * @param data - Données du tenant
   * @returns Promise<Tenant>
   */
  create(data: CreateTenantDTO): Promise<Tenant>;

  /**
   * Met à jour un tenant
   * @param id - ID du tenant
   * @param data - Données à mettre à jour
   * @returns Promise<Tenant>
   */
  update(id: number, data: UpdateTenantDTO): Promise<Tenant>;

  /**
   * Supprime un tenant
   * @param id - ID du tenant
   * @returns Promise<void>
   */
  delete(id: number): Promise<void>;

  /**
   * Liste tous les tenants
   * @param filters - Filtres optionnels
   * @returns Promise<Tenant[]>
   */
  findAll(filters?: TenantFilters): Promise<Tenant[]>;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
  status: 'active' | 'suspended' | 'cancelled' | 'trial' | 'past_due' | 'expired';
  plan_id?: number;
  owner_id?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTenantDTO {
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
  owner_id?: number;
  plan_id?: number;
}

export interface UpdateTenantDTO {
  name?: string;
  slug?: string;
  logo_url?: string;
  primary_color?: string;
  status?: Tenant['status'];
  plan_id?: number;
}

export interface TenantFilters {
  status?: Tenant['status'];
  plan_id?: number;
  owner_id?: number;
  search?: string;
  page?: number;
  limit?: number;
}
```

### 2.2 IUserRepository

**Fichier** : `src/server/infrastructure/repositories/IUserRepository.ts`

```typescript
/**
 * Interface pour tous les repositories d'utilisateurs
 */
export interface IUserRepository {
  /**
   * Trouve un utilisateur par son email
   */
  findByEmail(email: string, tenantId: number): Promise<User | null>;

  /**
   * Trouve un utilisateur par son ID
   */
  findById(id: number, tenantId: number): Promise<User | null>;

  /**
   * Trouve un utilisateur par son username
   */
  findByUsername(username: string, tenantId: number): Promise<User | null>;

  /**
   * Trouve un utilisateur par son PIN
   */
  findByPin(pinCode: string, tenantId: number): Promise<User | null>;

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
  tenant_id: number;
  full_name: string;
  email?: string;
  phone?: string;
  username: string;
  pin_code?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter';

export interface CreateUserDTO {
  tenant_id: number;
  full_name: string;
  email?: string;
  phone?: string;
  username: string;
  pin_code?: string;
  password?: string;
  role: UserRole;
}

export interface UpdateUserDTO {
  full_name?: string;
  email?: string;
  phone?: string;
  pin_code?: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface UserFilters {
  role?: UserRole;
  is_active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}
```

### 2.3 Autres Repositories

**Fichiers à créer** (même pattern) :

- `IOrderRepository.ts` - Gestion des commandes
- `IProductRepository.ts` - Gestion des produits
- `ICategoryRepository.ts` - Gestion des catégories
- `ISupplierRepository.ts` - Gestion des fournisseurs
- `IInventoryRepository.ts` - Gestion de l'inventaire
- `IExpenseRepository.ts` - Gestion des dépenses

**Total** : 8 repositories interfaces

## Jour 3 : Domain Layer

### 3.1 Entités

**Fichier** : `src/server/infrastructure/domain/entities/Tenant.ts`

```typescript
/**
 * Entité Tenant -reprÃ©sente un tenant dans le domaine
 * 
 * Cette entité est INDÉPENDANTE de toute infrastructure
 * (SQLite, Supabase, etc.)
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

  /**
   * Vérifie si le tenant est actif
   */
  isActive(): boolean {
    return this.status === 'active';
  }

  /**
   * Vérifie si le tenant est en essai
   */
  isTrial(): boolean {
    return this.status === 'trial';
  }

  /**
   * Vérifie si le tenant est suspendu
   */
  isSuspended(): boolean {
    return this.status === 'suspended';
  }

  /**
   * Met à jour le statut
   */
  updateStatus(newStatus: TenantStatus): void {
    this.status = newStatus;
    this.updatedAt = new Date();
  }

  /**
   * Met à jour le plan
   */
  updatePlan(planId: number): void {
    this.planId = planId;
    this.updatedAt = new Date();
  }
}

export type TenantStatus = 'active' | 'suspended' | 'cancelled' | 'trial' | 'past_due' | 'expired';
```

**Fichier** : `src/server/infrastructure/domain/entities/User.ts`

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

  /**
   * Vérifie si l'utilisateur est actif
   */
  isActiveUser(): boolean {
    return this.isActive;
  }

  /**
   * Vérifie si l'utilisateur a un rôle admin
   */
  isAdmin(): boolean {
    return ['super_admin', 'owner', 'admin'].includes(this.role);
  }

  /**
   * Vérifie si l'utilisateur peut gérer les utilisateurs
   */
  canManageUsers(): boolean {
    return ['super_admin', 'owner', 'admin', 'manager'].includes(this.role);
  }

  /**
   * Met à jour le nom
   */
  updateName(newName: string): void {
    this.fullName = newName;
    this.updatedAt = new Date();
  }

  /**
   * Met à jour le rôle
   */
  updateRole(newRole: UserRole): void {
    this.role = newRole;
    this.updatedAt = new Date();
  }

  /**
   * Active/désactive l'utilisateur
   */
  setActive(active: boolean): void {
    this.isActive = active;
    this.updatedAt = new Date();
  }
}

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter';
```

### 3.2 Value Objects

**Fichier** : `src/server/infrastructure/domain/value-objects/TenantId.ts`

```typescript
/**
 * Value Object TenantId - identifiant unique d'un tenant
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

**Fichier** : `src/server/infrastructure/domain/value-objects/UserId.ts`

```typescript
/**
 * Value Object UserId - identifiant unique d'un utilisateur
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

### 3.3 Domain Events

**Fichier** : `src/server/infrastructure/domain/events/DomainEvent.ts`

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

**Fichier** : `src/server/infrastructure/domain/events/TenantCreatedEvent.ts`

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

## Jour 4 : Services Métier

### 4.1 AuthService

**Fichier** : `src/server/application/services/auth.service.ts`

```typescript
/**
 * AuthService - Service métier pour l'authentification
 * 
 * Ce service NE CONNAÎT PAS le mode d'exécution.
 * Il utilise les providers via ProviderFactory.
 * 
 * Responsabilités :
 * - Authentifier un utilisateur (email + password)
 * - Authentifier un membre du staff (PIN)
 * - Déconnecter un utilisateur
 * - Rafraîchir le token
 * - Récupérer les informations de l'utilisateur connecté
 */
import { ProviderFactory } from '../../infrastructure/runtime/provider-factory';
import { IAuthProvider } from '../../infrastructure/providers/auth/IAuthProvider';

export class AuthService {
  private authProvider: IAuthProvider;

  constructor() {
    // Récupère le provider via la factory (pas de new directement)
    this.authProvider = ProviderFactory.getAuthProvider();
  }

  /**
   * Authentifie un utilisateur avec email et mot de passe
   * @returns Promise<AuthResult>
   * @throws Error si credentials invalides
   */
  async loginEmail(email: string, password: string): Promise<AuthResult> {
    // Validation
    if (!email || !email.includes('@')) {
      throw new Error('Email invalide');
    }
    if (!password || password.length < 8) {
      throw new Error('Mot de passe trop court (minimum 8 caractères)');
    }

    // Délégation au provider (qui choisit la stratégie selon le mode)
    return this.authProvider.login(email, password);
  }

  /**
   * Authentifie un membre du staff avec PIN
   * @returns Promise<AuthResult>
   * @throws Error si PIN invalide
   */
  async loginPin(pinCode: string, identity?: string, tenantSlug?: string): Promise<AuthResult> {
    // Validation
    if (!pinCode || pinCode.length < 4) {
      throw new Error('PIN invalide (minimum 4 chiffres)');
    }

    // Délégation au provider
    return this.authProvider.loginPin(pinCode, identity, tenantSlug);
  }

  /**
   * Déconnecte l'utilisateur
   */
  async logout(): Promise<void> {
    return this.authProvider.logout();
  }

  /**
   * Rafraîchit le token JWT
   * @returns Promise<AuthResult> avec nouveau token
   */
  async refresh(): Promise<AuthResult> {
    return this.authProvider.refresh();
  }

  /**
   * Récupère les informations de l'utilisateur connecté
   * @returns Promise<User>
   */
  async me(): Promise<User> {
    return this.authProvider.me();
  }

  /**
   * Vérifie si le serveur est accessible
   * @returns Promise<boolean>
   */
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

**Tests** : `src/server/application/services/__tests__/auth.service.test.ts`

```typescript
describe('AuthService', () => {
  let authService: AuthService;
  let mockAuthProvider: jest.Mocked<IAuthProvider>;

  beforeEach(() => {
    // Créer un mock du provider
    mockAuthProvider = {
      login: jest.fn(),
      loginPin: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
      me: jest.fn(),
      checkHealth: jest.fn(),
    } as any;

    // Mock ProviderFactory
    jest.spyOn(ProviderFactory, 'getAuthProvider').mockReturnValue(mockAuthProvider);
    
    authService = new AuthService();
  });

  describe('loginEmail', () => {
    it('should authenticate with valid credentials', async () => {
      // Arrange
      const mockUser = { id: 1, email: 'test@example.com', role: 'admin' } as any;
      mockAuthProvider.login.mockResolvedValue({
        token: 'fake-jwt-token',
        user: mockUser
      });

      // Act
      const result = await authService.loginEmail('test@example.com', 'password123');

      // Assert
      expect(result.token).toBe('fake-jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(mockAuthProvider.login).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('should reject invalid email', async () => {
      // Act & Assert
      await expect(authService.loginEmail('invalid-email', 'password123'))
        .rejects.toThrow('Email invalide');
      expect(mockAuthProvider.login).not.toHaveBeenCalled();
    });

    it('should reject short password', async () => {
      // Act & Assert
      await expect(authService.loginEmail('test@example.com', 'short'))
        .rejects.toThrow('Mot de passe trop court');
      expect(mockAuthProvider.login).not.toHaveBeenCalled();
    });
  });

  describe('loginPin', () => {
    it('should authenticate with valid PIN', async () => {
      // Arrange
      const mockUser = { id: 2, username: 'staff', role: 'cashier' } as any;
      mockAuthProvider.loginPin.mockResolvedValue({
        token: 'fake-jwt-token',
        user: mockUser
      });

      // Act
      const result = await authService.loginPin('1234', 'john', 'makutano');

      // Assert
      expect(result.token).toBe('fake-jwt-token');
      expect(mockAuthProvider.loginPin).toHaveBeenCalledWith('1234', 'john', 'makutano');
    });

    it('should reject invalid PIN', async () => {
      // Act & Assert
      await expect(authService.loginPin('12', 'john'))
        .rejects.toThrow('PIN invalide');
      expect(mockAuthProvider.loginPin).not.toHaveBeenCalled();
    });
  });
});
```

### 4.2 TenantService

**Fichier** : `src/server/application/services/tenant.service.ts`

```typescript
/**
 * TenantService - Service métier pour la gestion des tenants
 * 
 * Ce service NE CONNAÎT PAS le mode d'exécution.
 * Il utilise les providers via ProviderFactory.
 */
import { ProviderFactory } from '../../infrastructure/runtime/provider-factory';
import { ITenantProvider } from '../../infrastructure/providers/tenant/ITenantProvider';

export class TenantService {
  private tenantProvider: ITenantProvider;

  constructor() {
    this.tenantProvider = ProviderFactory.getTenantProvider();
  }

  /**
   * Récupère un tenant par son slug
   */
  async getTenantBySlug(slug: string): Promise<Tenant> {
    if (!slug || slug.trim().length === 0) {
      throw new Error('Slug requis');
    }

    const tenant = await this.tenantProvider.findBySlug(slug.toLowerCase().trim());
    
    if (!tenant) {
      throw new Error(`Tenant "${slug}" introuvable`);
    }

    return tenant;
  }

  /**
   * Récupère un tenant par son ID
   */
  async getTenantById(id: number): Promise<Tenant> {
    if (!id || id <= 0) {
      throw new Error('ID invalide');
    }

    const tenant = await this.tenantProvider.findById(id);
    
    if (!tenant) {
      throw new Error(`Tenant #${id} introuvable`);
    }

    return tenant;
  }

  /**
   * Crée un nouveau tenant
   */
  async createTenant(data: CreateTenantDTO): Promise<Tenant> {
    // Validation
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Nom du tenant requis');
    }
    if (!data.slug || data.slug.trim().length === 0) {
      throw new Error('Slug du tenant requis');
    }

    // Vérifier que le slug n'existe pas déjà
    const existing = await this.tenantProvider.findBySlug(data.slug.toLowerCase().trim());
    if (existing) {
      throw new Error(`Un tenant avec le slug "${data.slug}" existe déjà`);
    }

    return this.tenantProvider.create(data);
  }

  /**
   * Met à jour un tenant
   */
  async updateTenant(id: number, data: UpdateTenantDTO): Promise<Tenant> {
    if (!id || id <= 0) {
      throw new Error('ID invalide');
    }

    // Vérifier que le tenant existe
    const existing = await this.tenantProvider.findById(id);
    if (!existing) {
      throw new Error(`Tenant #${id} introuvable`);
    }

    return this.tenantProvider.update(id, data);
  }

  /**
   * Supprime un tenant
   */
  async deleteTenant(id: number): Promise<void> {
    if (!id || id <= 0) {
      throw new Error('ID invalide');
    }

    // Vérifier que le tenant existe
    const existing = await this.tenantProvider.findById(id);
    if (!existing) {
      throw new Error(`Tenant #${id} introuvable`);
    }

    return this.tenantProvider.delete(id);
  }

  /**
   * Liste tous les tenants
   */
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

### 4.3 Autres Services

**Fichiers à créer** (même pattern) :

- `order.service.ts` - Service métier pour les commandes
- `product.service.ts` - Service métier pour les produits
- `inventory.service.ts` - Service métier pour l'inventaire
- `billing.service.ts` - Service métier pour le billing (déjà existe, à adapter)

**Total** : 5 services métier

## Jour 5 : Tests et Documentation

### 5.1 Tests Unitaires

**Objectif** : Couverture > 95%

**Tests à écrire** :

1. **ModeResolver**
   - Détection du mode en développement
   - Détection du mode en production
   - Résolution depuis requête HTTP
   - Gestion des erreurs

2. **ProviderFactory**
   - Initialisation des providers
   - Cache des providers
   - Reset des providers
   - Gestion des modes

3. **Repository Interfaces**
   - Validation des contrats
   - Tests de conformité

4. **Services Métier**
   - AuthService (login, logout, refresh, me)
   - TenantService (CRUD)
   - OrderService (CRUD)
   - ProductService (CRUD)
   - InventoryService (CRUD)

### 5.2 Documentation

**Fichier** : `docs/PHASE_1_ARCHITECTURE.md`

**Contenu** :
- Description de l'architecture
- Diagrammes
- Exemples d'utilisation
- Guide de migration Phase 2

---

# 5. FICHIERS IMPACTÉS

## 5.1 Nouveaux Fichiers (à créer)

### Runtime Layer (3 fichiers)
```
src/server/infrastructure/runtime/
├── index.ts                        # Export public
├── mode-resolver.ts                # ModeResolver
└── provider-factory.ts             # ProviderFactory
```

### Repository Interfaces (10 fichiers)
```
src/server/infrastructure/repositories/
├── ITenantRepository.ts
├── IUserRepository.ts
├── IOrderRepository.ts
├── IProductRepository.ts
├── ICategoryRepository.ts
├── ISupplierRepository.ts
├── IInventoryRepository.ts
├── IExpenseRepository.ts
├── ISubscriptionRepository.ts      # Déjà existe
└── IVoucherRepository.ts           # Déjà existe
```

### Provider Interfaces (10 fichiers)
```
src/server/infrastructure/providers/
├── index.ts
├── auth/IAuthProvider.ts
├── billing/IBillingProvider.ts
├── tenant/ITenantProvider.ts
├── order/IOrderProvider.ts
├── inventory/IInventoryProvider.ts
├── sync/ISyncProvider.ts
├── user/IUserProvider.ts
├── printer/IPrinterProvider.ts
├── settings/ISettingsProvider.ts
└── notification/INotificationProvider.ts
```

### Domain Layer (15+ fichiers)
```
src/server/infrastructure/domain/
├── entities/
│   ├── Tenant.ts
│   ├── User.ts
│   ├── Order.ts
│   ├── Product.ts
│   ├── Category.ts
│   └── ...
├── value-objects/
│   ├── TenantId.ts
│   ├── UserId.ts
│   ├── OrderId.ts
│   ├── Money.ts
│   └── ...
└── events/
    ├── DomainEvent.ts
    ├── TenantCreatedEvent.ts
    ├── OrderCreatedEvent.ts
    └── ...
```

### Services Métier (5 fichiers)
```
src/server/application/services/
├── auth.service.ts                 # [NOUVEAU]
├── tenant.service.ts               # [NOUVEAU]
├── order.service.ts                # [NOUVEAU]
├── product.service.ts              # [NOUVEAU]
└── inventory.service.ts            # [NOUVEAU]
```

### Tests (20+ fichiers)
```
src/server/infrastructure/runtime/__tests__/
├── mode-resolver.test.ts
└── provider-factory.test.ts

src/server/infrastructure/repositories/__tests__/
├── ITenantRepository.test.ts
├── IUserRepository.test.ts
└── ...

src/server/application/services/__tests__/
├── auth.service.test.ts
├── tenant.service.test.ts
└── ...
```

**Total** : ~60 nouveaux fichiers

## 5.2 Fichiers Existants (à modifier)

### Aucune modification de l'existant en Phase 1

**Principe** : Phase 1 = code parallèle uniquement, aucune modification de l'existant.

**Raison** :
- ✅ Aucun risque de régression
- ✅ Migration progressive possible
- ✅ Rollback facile si problème
- ✅ Tests comparatifs possibles

---

# 6. RÔLE DE CHAQUE MODIFICATION

## 6.1 Runtime Layer

### ModeResolver
**Rôle** : Déterminer le mode d'exécution (LOCAL, CLOUD, HYBRID)

**Responsabilités** :
- Détecter le mode au démarrage
- Mettre en cache le mode (singleton)
- Résoudre le mode depuis une requête HTTP
- Fournir des méthodes `isLocal()`, `isCloud()`, `isHybrid()`

**Pourquoi** : Centraliser la détection du mode dans UN SEUL endroit.

**Impact** : Aucun (nouveau fichier)

### ProviderFactory
**Rôle** : Créer les providers selon le mode

**Responsabilités** :
- Choisir l'implémentation du provider selon le mode
- Mettre en cache les providers (singleton)
- Initialiser tous les providers au démarrage
- Fournir une méthode `reset()` pour les tests

**Pourquoi** : Masquer la complexité de la création des providers.

**Impact** : Aucun (nouveau fichier)

## 6.2 Repository Interfaces

**Rôle** : Définir les contrats d'accès aux données

**Responsabilités** :
- Définir les méthodes CRUD pour chaque entité
- Définir les méthodes de recherche
- Définir les DTOs (Data Transfer Objects)
- Définir les filtres

**Pourquoi** : Abstraire l'accès aux données (SQLite vs Supabase)

**Impact** : Aucun (nouveaux fichiers)

## 6.3 Domain Layer

**Rôle** : Représenter les concepts métier

**Responsabilités** :
- Définir les entités (Tenant, User, Order, etc.)
- Définir les value objects (TenantId, UserId, Money, etc.)
- Définir les événements de domaine
- Encapsuler la logique métier dans les entités

**Pourquoi** : Avoir une couche métier indépendante de l'infrastructure.

**Impact** : Aucun (nouveaux fichiers)

## 6.4 Services Métier

**Rôle** : Orchestrer la logique métier

**Responsabilités** :
- Valider les entrées
- Appeler les providers via ProviderFactory
- Orchestrer les appels aux repositories
- Gérer les transactions (si nécessaire)

**Pourquoi** : Découpler la logique métier de l'infrastructure.

**Impact** : Aucun (nouveaux fichiers)

---

# 7. RISQUES ET MITIGATIONS

## 7.1 Risques Identifiés

### Risque 1 : Complexité d'Implémentation

**Probabilité** : Moyenne  
**Impact** : Moyen  
**Description** : La création de 60+ fichiers peut être complexe et sujette à erreurs.

**Mitigation** :
- ✅ Plan détaillé jour par jour
- ✅ Templates de code réutilisables
- ✅ Tests unitaires pour chaque composant
- ✅ Code review systématique
- ✅ Validation après chaque journée

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

## 7.2 Matrice de Risques

| Risque | Probabilité | Impact | Mitigation | Résiduel |
|--------|-------------|--------|------------|----------|
| Complexité | Moyenne | Moyen | Plan détaillé | Faible |
| Oublis interfaces | Faible | Élevé | Review + tests | Faible |
| Incompatibilité | Faible | Élevé | Code parallèle | Très faible |
| Performance | Faible | Faible | Cache + lazy loading | Très faible |
| Tests incomplets | Moyenne | Moyen | Couverture 95% | Faible |

**Risque résiduel global** : FAIBLE

---

# 8. PLAN DE MIGRATION

## 8.1 Stratégie de Migration

### Approche : Code Parallèle

**Principe** : Créer le nouveau code À CÔTÉ de l'ancien, sans le modifier.

**Avantages** :
- ✅ Aucun risque de régression
- ✅ Migration progressive
- ✅ Rollback facile
- ✅ Tests comparatifs possibles

**Inconvénients** :
- ⚠️ Duplication temporaire du code
- ⚠️ Maintenance de deux versions

**Mitigation** : La duplication est temporaire (7 semaines seulement).

## 8.2 Étapes de Migration

### Étape 1 : Création des Fondations (Jours 1-2)

**Actions** :
1. Créer `runtime/mode-resolver.ts`
2. Créer `runtime/provider-factory.ts`
3. Écrire les tests
4. Valider le fonctionnement

**Validation** :
- ✅ ModeResolver détecte correctement le mode
- ✅ ProviderFactory crée les providers
- ✅ Tests passent

### Étape 2 : Création des Interfaces (Jours 2-3)

**Actions** :
1. Créer toutes les repository interfaces
2. Créer toutes les provider interfaces
3. Écrire les tests de conformité
4. Valider les contrats

**Validation** :
- ✅ Toutes les interfaces sont définies
- ✅ TypeScript compile sans erreur
- ✅ Tests passent

### Étape 3 : Création du Domain Layer (Jour 3)

**Actions** :
1. Créer les entités
2. Créer les value objects
3. Créer les domain events
4. Écrire les tests

**Validation** :
- ✅ Entités encapsulent la logique métier
- ✅ Value objects sont immutables
- ✅ Tests passent

### Étape 4 : Création des Services (Jour 4)

**Actions** :
1. Créer AuthService
2. Créer TenantService
3. Créer OrderService
4. Créer ProductService
5. Créer InventoryService
6. Écrire les tests

**Validation** :
- ✅ Services utilisent ProviderFactory
- ✅ Services ne connaissent pas le mode
- ✅ Tests passent avec mock providers

### Étape 5 : Tests et Documentation (Jour 5)

**Actions** :
1. Écrire tous les tests
2. Vérifier la couverture (> 95%)
3. Écrire la documentation
4. Valider l'ensemble

**Validation** :
- ✅ Couverture > 95%
- ✅ Tous les tests passent
- ✅ Documentation complète

## 8.3 Points de Contrôle

### Checkpoint 1 : Fin Jour 1
- [ ] ModeResolver implémenté
- [ ] Tests ModeResolver passent
- [ ] ProviderFactory squelette créé

### Checkpoint 2 : Fin Jour 2
- [ ] ProviderFactory fonctionnel
- [ ] Tests ProviderFactory passent
- [ ] Repository interfaces créées

### Checkpoint 3 : Fin Jour 3
- [ ] Domain Layer complet
- [ ] Tests Domain Layer passent
- [ ] Provider interfaces créées

### Checkpoint 4 : Fin Jour 4
- [ ] Services métier créés
- [ ] Tests services passent
- [ ] Intégration ModeResolver + ProviderFactory + Services

### Checkpoint 5 : Fin Jour 5
- [ ] Couverture > 95%
- [ ] Documentation complète
- [ ] Validation finale

---

# 9. TESTS ET VALIDATION

## 9.1 Stratégie de Test

### Tests Unitaires (95% de la couverture)

**Cibles** :
- ModeResolver
- ProviderFactory
- Repository interfaces
- Domain entities
- Services métier

**Outils** :
- Jest (déjà configuré)
- ts-jest pour TypeScript
- @types/jest pour les types

### Tests d'Intégration

**Cibles** :
- ProviderFactory + ModeResolver
- Services + ProviderFactory (avec mock providers)

### Tests de Non-Régression

**Cibles** :
- Aucun (pas de modification de l'existant)

## 9.2 Exemples de Tests

### Test ModeResolver

```typescript
describe('ModeResolver', () => {
  beforeEach(() => {
    (ModeResolver as any).instance = null;
  });

  it('should detect LOCAL mode in development', () => {
    // Mock import.meta.env
    const originalEnv = (import.meta as any).env;
    (import.meta as any).env = { DEV: true };
    
    const resolver = ModeResolver.getInstance();
    expect(resolver.isLocal()).toBe(true);
    
    (import.meta as any).env = originalEnv;
  });

  it('should detect CLOUD mode in production', () => {
    const originalEnv = (import.meta as any).env;
    (import.meta as any).env = { DEV: undefined };
    
    const resolver = ModeResolver.getInstance();
    expect(resolver.isCloud()).toBe(true);
    
    (import.meta as any).env = originalEnv;
  });

  it('should resolve mode from request header', () => {
    const resolver = ModeResolver.getInstance();
    const mode = resolver.resolveFromRequest({
      headers: { 'x-runtime-mode': 'hybrid' }
    });
    expect(mode).toBe('HYBRID');
  });
});
```

### Test ProviderFactory

```typescript
describe('ProviderFactory', () => {
  beforeEach(() => {
    ProviderFactory.reset();
  });

  it('should initialize all providers', () => {
    // Mock ModeResolver
    const mockModeResolver = {
      resolve: () => 'LOCAL' as ExecutionMode
    };
    jest.spyOn(ModeResolver, 'getInstance').mockReturnValue(mockModeResolver as any);

    // Mock providers
    const mockAuthProvider = {};
    const mockBillingProvider = {};
    // ... autres mocks

    ProviderFactory.initialize();
    
    const authProvider = ProviderFactory.getAuthProvider();
    expect(authProvider).toBeDefined();
  });

  it('should cache providers', () => {
    ProviderFactory.initialize();
    
    const authProvider1 = ProviderFactory.getAuthProvider();
    const authProvider2 = ProviderFactory.getAuthProvider();
    
    expect(authProvider1).toBe(authProvider2);
  });
});
```

### Test AuthService

```typescript
describe('AuthService', () => {
  let authService: AuthService;
  let mockAuthProvider: jest.Mocked<IAuthProvider>;

  beforeEach(() => {
    mockAuthProvider = {
      login: jest.fn(),
      loginPin: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
      me: jest.fn(),
      checkHealth: jest.fn(),
    } as any;

    jest.spyOn(ProviderFactory, 'getAuthProvider').mockReturnValue(mockAuthProvider);
    authService = new AuthService();
  });

  describe('loginEmail', () => {
    it('should authenticate with valid credentials', async () => {
      const mockUser = { id: 1, email: 'test@example.com', role: 'admin' } as any;
      mockAuthProvider.login.mockResolvedValue({
        token: 'token',
        user: mockUser
      });

      const result = await authService.loginEmail('test@example.com', 'password123');
      
      expect(result.token).toBe('token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should reject invalid email', async () => {
      await expect(authService.loginEmail('invalid', 'password123'))
        .rejects.toThrow('Email invalide');
      expect(mockAuthProvider.login).not.toHaveBeenCalled();
    });

    it('should reject short password', async () => {
      await expect(authService.loginEmail('test@example.com', 'short'))
        .rejects.toThrow('Mot de passe trop court');
      expect(mockAuthProvider.login).not.toHaveBeenCalled();
    });
  });
});
```

## 9.3 Couverture Cible

| Module | Couverture Cible | Couverture Actuelle |
|--------|------------------|---------------------|
| ModeResolver | 100% | 0% |
| ProviderFactory | 100% | 0% |
| Repository Interfaces | 100% | 0% |
| Domain Entities | 95% | 0% |
| Services Métier | 95% | 0% |
| **Moyenne** | **97%** | **0%** |

## 9.4 Commandes de Test

```bash
# Lancer tous les tests
npm test

# Lancer les tests avec couverture
npm test -- --coverage

# Lancer les tests en mode watch
npm test -- --watch

# Lancer un test spécifique
npm test -- mode-resolver.test.ts
```

---

# 10. CHECKLIST DE VALIDATION

## 10.1 Checklist Technique

### Runtime Layer
- [ ] ModeResolver détecte correctement le mode en LOCAL
- [ ] ModeResolver détecte correctement le mode en CLOUD
- [ ] ModeResolver détecte correctement le mode en HYBRID
- [ ] ModeResolver résout le mode depuis une requête HTTP
- [ ] ProviderFactory crée tous les providers
- [ ] ProviderFactory cache les providers
- [ ] ProviderFactory reset fonctionne

### Repository Interfaces
- [ ] ITenantRepository définie
- [ ] IUserRepository définie
- [ ] IOrderRepository définie
- [ ] IProductRepository définie
- [ ] ICategoryRepository définie
- [ ] ISupplierRepository définie
- [ ] IInventoryRepository définie
- [ ] IExpenseRepository définie

### Provider Interfaces
- [ ] IAuthProvider définie
- [ ] IBillingProvider définie
- [ ] ITenantProvider définie
- [ ] IOrderProvider définie
- [ ] IInventoryProvider définie
- [ ] ISyncProvider définie
- [ ] IUserProvider définie
- [ ] IPrinterProvider définie
- [ ] ISettingsProvider définie
- [ ] INotificationProvider définie

### Domain Layer
- [ ] Entité Tenant créée
- [ ] Entité User créée
- [ ] Entité Order créée
- [ ] Entité Product créée
- [ ] Value Objects créés
- [ ] Domain Events créés

### Services Métier
- [ ] AuthService créé
- [ ] TenantService créé
- [ ] OrderService créé
- [ ] ProductService créé
- [ ] InventoryService créé

### Tests
- [ ] Tests ModeResolver passent
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

## 10.2 Checklist de Non-Régression

- [ ] Aucun fichier existant modifié
- [ ] Aucune dépendance ajoutée
- [ ] Aucune configuration modifiée
- [ ] Tests existants passent toujours
- [ ] Application démarre sans erreur
- [ ] Performance identique

## 10.3 Checklist de Validation Finale

- [ ] Tous les tests passent
- [ ] Couverture > 95%
- [ ] Documentation complète
- [ ] Code review approuvé
- [ ] Validation architecturale
- [ ] Prêt pour Phase 2

---

# 11. PROCHAINES ÉTAPES

## 11.1 Après Phase 1

### Phase 2 : Backend Providers (2 semaines)

**Objectif** : Implémenter les providers concrets (LOCAL, CLOUD, HYBRID)

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

## Résumé de la Phase 1

**Objectif** : Créer les fondations de la nouvelle architecture

**Durée** : 5 jours

**Livrables** :
- ✅ Runtime Layer (ModeResolver + ProviderFactory)
- ✅ Repository Interfaces (10 interfaces)
- ✅ Provider Interfaces (10 interfaces)
- ✅ Domain Layer (entités, value objects, events)
- ✅ Services Métier (5 services)
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

1. **Valider** ce plan d'implémentation
2. **Démarrer** Jour 1 : Runtime Layer
3. **Exécuter** les 5 jours selon le plan
4. **Valider** chaque checkpoint
5. **Passer** à Phase 2

---

**Fin du Plan d'Implémentation Phase 1**

*Document généré par l'Architecte Logiciel Senior*  
*Date : 2026-01-07*