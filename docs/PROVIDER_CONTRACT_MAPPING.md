# PROVIDER CONTRACT MAPPING
## Mapping des Contrats Providers pour la Migration

**Date** : 2026-01-07  
**Auteur** : Architecte Logiciel Senior  
**Statut** : CONTRACT MAPPING  
**Version** : 1.0.0  
**Phase** : 0.5 - Contract Discovery

---

# SOMMAIRE

1. [Résumé](#1-résumé)
2. [IAuthProvider](#2-iauthprovider)
3. [ITenantProvider](#3-itenantprovider)
4. [IUserProvider](#4-iuserprovider)
5. [ISyncProvider](#5-isyncprovider)
6. [IOrderProvider](#6-iorderprovider)
7. [IProductProvider](#7-iproductprovider)
8. [IInventoryProvider](#8-iinventoryprovider)
9. [IBillingProvider](#9-ibillingprovider)
10. [IPrinterProvider](#10-iprinterprovider)
11. [ISettingsProvider](#11-isettingsprovider)
12. [INotificationProvider](#12-inotificationprovider)
13. [Matrice de Migration](#13-matrice-de-migration)
14. [Priorisation](#14-priorisation)

---

# 1. RÉSUMÉ

## 1.1 Objectif

Ce document mapping des contrats providers a pour objectif de :

1. **Cartographier** toutes les méthodes existantes nécessaires
2. **Définir** les interfaces futures
3. **Planifier** la migration pour chaque provider
4. **Identifier** les gaps et les dépendances

## 1.2 Méthodologie

Pour chaque provider :

1. Analyser le code existant (backend + frontend)
2. Extraire les méthodes utilisées
3. Définir l'interface cible
4. Planifier la migration

## 1.3 Priorisation

**Phase 1** (Critique) :

- IAuthProvider
- ITenantProvider
- IUserProvider
- ISyncProvider

**Phase 2** (Important) :

- IOrderProvider
- IProductProvider
- IInventoryProvider

**Phase 3** (Souhaitable) :

- IBillingProvider
- IPrinterProvider
- ISettingsProvider
- INotificationProvider

---

# 2. IAUTHPROVIDER

## 2.1 Interface Future

```typescript
/**
 * IAuthProvider - Interface pour tous les providers d'authentification
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

## 2.2 Méthodes Existantes Nécessaires

### Backend

**Fichier** : `src/server/routes/auth-setup.ts`

```
POST /auth/setup
```

**Fichier** : `src/server/services/auth.service.ts`

```typescript
// Méthodes existantes
loginEmail(email: string, password: string): Promise<AuthResult>
loginPin(pinCode: string, identity?: string, tenantSlug?: string): Promise<AuthResult>
logout(): Promise<void>
refresh(token: string): Promise<AuthResult>
me(): Promise<User>
checkHealth(): Promise<boolean>
```

### Frontend

**Fichier** : `src/stores/useAuthStore.ts`

```typescript
// Actions du store
loginEmail(email: string, password: string): Promise<void>
loginPin(pinCode: string, identity?: string, tenantSlug?: string): Promise<void>
logout(): Promise<void>
refresh(): Promise<void>
checkServer(): Promise<boolean>
```

**Fichier** : `src/pages/auth/LoginPage.tsx`

```typescript
// Composants
<LoginForm />
<PinLoginForm />
```

## 2.3 Migration Prévue

### Étape 1 : Créer l'interface

```typescript
// src/server/infrastructure/providers/auth/IAuthProvider.ts
export interface IAuthProvider { ... }
```

### Étape 2 : Implémenter LocalAuthProvider

```typescript
// src/server/infrastructure/providers/auth/local-auth.provider.ts
export class LocalAuthProvider implements IAuthProvider {
  async login(email: string, password: string): Promise<AuthResult> {
    // Utiliser SQLite
    // Générer JWT local signé
  }

  async loginPin(pinCode: string, identity?: string, tenantSlug?: string): Promise<AuthResult> {
    // Utiliser SQLite
    // Vérifier PIN
  }

  // ... autres méthodes
}
```

### Étape 3 : Implémenter CloudAuthProvider

```typescript
// src/server/infrastructure/providers/auth/cloud-auth.provider.ts
export class CloudAuthProvider implements IAuthProvider {
  async login(email: string, password: string): Promise<AuthResult> {
    // Utiliser Supabase Auth
  }

  // ... autres méthodes
}
```

### Étape 4 : Implémenter HybridAuthProvider

```typescript
// src/server/infrastructure/providers/auth/hybrid-auth.provider.ts
export class HybridAuthProvider implements IAuthProvider {
  private localProvider: LocalAuthProvider;
  private cloudProvider: CloudAuthProvider;

  async login(email: string, password: string): Promise<AuthResult> {
    // Essayer local d'abord
    // Sync avec cloud
  }

  // ... autres méthodes
}
```

### Étape 5 : Migrer useAuthStore

```typescript
// src/stores/useAuthStore.ts
import { ProviderFactory } from '../server/infrastructure/runtime/provider-factory';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  
  loginEmail: async (email, password) => {
    const provider = ProviderFactory.getAuthProvider();
    const result = await provider.login(email, password);
    set({ user: result.user, token: result.token });
  },
  
  // ... autres actions
}));
```

### Étape 6 : Migrer LoginPage

```typescript
// src/pages/auth/LoginPage.tsx
// Plus de isLocal()
// Plus de données hardcodées
// Utiliser le store mis à jour
```

## 2.4 Gaps Identifiés

### Gap 1 : Faux JWT en LOCAL

**Localisation** : `src/pages/auth/LoginPage.tsx`

**Description** : JWT généré côté client sans signature

**Impact** : 🔴 Critique

**Solution** : Backend local signe le JWT

### Gap 2 : Données Hardcodées

**Localisation** : `src/pages/auth/LoginPage.tsx`

**Description** : Tenant et user hardcodés

**Impact** : 🔴 Critique

**Solution** : Utiliser SQLite en LOCAL

---

# 3. ITENANTPROVIDER

## 3.1 Interface Future

```typescript
/**
 * ITenantProvider - Interface pour tous les providers de Tenant
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

## 3.2 Méthodes Existantes Nécessaires

### Backend

**Fichier** : `src/server/routes/tenants.ts` (à vérifier)

```typescript
// Routes
GET /tenants
GET /tenants/:id
POST /tenants
PATCH /tenants/:id
DELETE /tenants/:id
```

**Fichier** : `src/server/middleware/tenant-scope.ts`

```typescript
// Résolution de tenant
resolveTenant(slug: string): Promise<Tenant>
```

### Frontend

**Fichier** : `src/lib/api-client.ts`

```typescript
// Tenant resolution
getTenantBySlug(slug: string): Promise<Tenant>
```

## 3.3 Migration Prévue

### Étape 1 : Créer l'interface

```typescript
// src/server/infrastructure/providers/tenant/ITenantProvider.ts
export interface ITenantProvider { ... }
```

### Étape 2 : Implémenter les providers

```typescript
// LocalTenantProvider (SQLite)
// CloudTenantProvider (Supabase)
// HybridTenantProvider (SQLite + Sync)
```

### Étape 3 : Migrer tenant-scope middleware

```typescript
// src/server/middleware/tenant-scope.ts
const tenantProvider = ProviderFactory.getTenantProvider();
const tenant = await tenantProvider.findBySlug(slug);
```

## 3.4 Gaps Identifiés

### Gap 1 : localStorage comme BDD

**Localisation** : `src/lib/api-client.ts` (lignes 383-398)

**Description** : Lecture de tenants depuis localStorage

**Impact** : 🔴 Critique

**Solution** : Utiliser SQLite en LOCAL

---

# 4. IUSERPROVIDER

## 4.1 Interface Future

```typescript
/**
 * IUserProvider - Interface pour tous les providers d'utilisateurs
 */
export interface IUserProvider {
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

## 4.2 Méthodes Existantes Nécessaires

### Backend

**Fichier** : `src/server/routes/users.ts` (à vérifier)

```typescript
// Routes
GET /users
GET /users/:id
POST /users
PATCH /users/:id
DELETE /users/:id
```

**Fichier** : `src/server/services/auth.service.ts`

```typescript
// Méthodes
verifyCredentials(email: string, password: string, tenantId: number): Promise<User | null>
verifyPin(pinCode: string, tenantId: number): Promise<User | null>
```

### Frontend

**Fichier** : `src/stores/useAuthStore.ts`

```typescript
// Pas de méthodes directes, mais utilise les données utilisateur
```

**Fichier** : `src/pages/users/UsersPage.tsx`

```typescript
// CRUD utilisateurs
```

## 4.3 Migration Prévue

### Étape 1 : Créer l'interface

```typescript
// src/server/infrastructure/providers/user/IUserProvider.ts
export interface IUserProvider { ... }
```

### Étape 2 : Implémenter les providers

```typescript
// LocalUserProvider (SQLite)
// CloudUserProvider (Supabase)
// HybridUserProvider (SQLite + Sync)
```

### Étape 3 : Migrer les routes

```typescript
// src/server/routes/users.ts
const userProvider = ProviderFactory.getUserProvider();
```

## 4.4 Gaps Identifiés

### Gap 1 : RBAC dispersé

**Localisation** : Multiple

**Description** : Logique RBAC dans plusieurs fichiers

**Impact** : 🟠 Élevé

**Solution** : Centraliser dans UserProvider

---

# 5. ISYNCPROVIDER

## 5.1 Interface Future

```typescript
/**
 * ISyncProvider - Interface pour tous les providers de synchronisation
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

## 5.2 Méthodes Existantes Nécessaires

### Backend

**Fichier** : `src/sync/sync-orchestrator-v2.ts`

```typescript
// Méthodes existantes
start(): Promise<void>
stop(): Promise<void>
syncEntity(entityType: string, entityId: string): Promise<void>
syncAll(): Promise<void>
getStatus(): SyncStatus
```

**Fichier** : `src/server/infrastructure/synchronization/outbox-worker.ts`

```typescript
// Traitement des événements
processEvents(): Promise<void>
```

**Fichier** : `src/server/infrastructure/synchronization/reconciliation-job.ts`

```typescript
// Réconciliation
reconcile(): Promise<void>
```

### Frontend

**Fichier** : `src/sync/index.ts`

```typescript
// Sync orchestrator
export const syncOrchestrator = new SyncOrchestratorV2();
```

## 5.3 Migration Prévue

### Étape 1 : Créer l'interface

```typescript
// src/server/infrastructure/providers/sync/ISyncProvider.ts
export interface ISyncProvider { ... }
```

### Étape 2 : Implémenter HybridSyncProvider

```typescript
// src/server/infrastructure/providers/sync/hybrid-sync.provider.ts
export class HybridSyncProvider implements ISyncProvider {
  private syncEngine: SyncOrchestratorV2;
  private outboxWorker: OutboxWorker;

  async start(): Promise<void> {
    // Démarrer le moteur de sync existant
    await this.syncEngine.start();
    await this.outboxWorker.start();
  }

  async syncEntity(entityType: string, entityId: string): Promise<void> {
    // Utiliser le moteur existant
    await this.syncEngine.syncEntity(entityType, entityId);
  }

  // ... autres méthodes
}
```

### Étape 3 : Implémenter NoOpSyncProvider

```typescript
// src/server/infrastructure/providers/sync/noop-sync.provider.ts
export class NoOpSyncProvider implements ISyncProvider {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async syncEntity(): Promise<void> {}
  async syncAll(): Promise<void> {}
  isSyncing(): boolean { return false; }
  getStatus(): SyncStatus { return { isRunning: false, pendingChanges: 0, errors: [] }; }
}
```

## 5.4 Gaps Identifiés

### Gap 1 : Moteur de sync complexe

**Localisation** : `src/sync/sync-orchestrator-v2.ts`

**Description** : Moteur de sync existant à préserver

**Impact** : 🟡 Moyen

**Solution** : Encapsuler dans HybridSyncProvider

---

# 6. IORDERPROVIDER

## 6.1 Interface Future

```typescript
/**
 * IOrderProvider - Interface pour tous les providers de commandes
 */
export interface IOrderProvider {
  findById(id: number, tenantId: number): Promise<Order | null>;
  findByTableId(tableId: number, tenantId: number): Promise<Order | null>;
  create(data: CreateOrderDTO): Promise<Order>;
  update(id: number, data: UpdateOrderDTO, tenantId: number): Promise<Order>;
  delete(id: number, tenantId: number): Promise<void>;
  findAllByTenant(tenantId: number, filters?: OrderFilters): Promise<Order[]>;
  changeStatus(id: number, status: OrderStatus, tenantId: number): Promise<Order>;
  addItem(orderId: number, item: OrderItem, tenantId: number): Promise<Order>;
  removeItem(orderId: number, itemId: number, tenantId: number): Promise<Order>;
}

export interface Order {
  id: number;
  tenantId: number;
  tableId?: number;
  waiterId?: number;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus = 'pending' | 'in_progress' | 'ready' | 'completed' | 'cancelled';

export interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  price: number;
  notes?: string;
}

export interface CreateOrderDTO {
  tenantId: number;
  tableId?: number;
  items: OrderItem[];
}

export interface OrderFilters {
  status?: OrderStatus;
  tableId?: number;
  waiterId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}
```

## 6.2 Méthodes Existantes Nécessaires

### Backend

**Fichier** : `src/server/routes/orders.ts`

```typescript
// Routes
GET /orders/active
GET /orders
GET /orders/:id
POST /orders
PATCH /orders/:id
PATCH /orders/:id/items
PATCH /orders/:id/status
DELETE /orders/:id
```

**Fichier** : `src/server/services/order.service.ts`

```typescript
// Méthodes
createOrder(data: CreateOrderDTO): Promise<Order>
updateOrder(id: number, data: UpdateOrderDTO): Promise<Order>
changeStatus(id: number, status: OrderStatus): Promise<Order>
addItem(orderId: number, item: OrderItem): Promise<Order>
removeItem(orderId: number, itemId: number): Promise<Order>
```

### Frontend

**Fichier** : `src/stores/useOrderStore.ts`

```typescript
// Actions
fetchOrders(): Promise<void>
createOrder(data: CreateOrderDTO): Promise<void>
updateOrder(id: number, data: UpdateOrderDTO): Promise<void>
changeStatus(id: number, status: OrderStatus): Promise<void>
```

**Fichier** : `src/pages/POS.tsx`

```typescript
// Interface POS
<OrderSummary />
<OrderItems />
```

## 6.3 Migration Prévue

### Étape 1 : Créer l'interface

```typescript
// src/server/infrastructure/providers/order/IOrderProvider.ts
export interface IOrderProvider { ... }
```

### Étape 2 : Implémenter les providers

```typescript
// LocalOrderProvider (SQLite)
// CloudOrderProvider (Supabase)
// HybridOrderProvider (SQLite + Sync)
```

### Étape 3 : Migrer useOrderStore

```typescript
// src/stores/useOrderStore.ts
const orderProvider = ProviderFactory.getOrderProvider();
```

## 6.4 Gaps Identifiés

### Gap 1 : Logique métier dans le store

**Localisation** : `src/stores/useOrderStore.ts`

**Description** : Calculs de totaux dans le store

**Impact** : 🟠 Élevé

**Solution** : Déplacer dans OrderService

---

# 7. IPRODUCTPROVIDER

## 7.1 Interface Future

```typescript
/**
 * IProductProvider - Interface pour tous les providers de produits
 */
export interface IProductProvider {
  findById(id: number, tenantId: number): Promise<Product | null>;
  findByCategory(categoryId: number, tenantId: number): Promise<Product[]>;
  create(data: CreateProductDTO): Promise<Product>;
  update(id: number, data: UpdateProductDTO, tenantId: number): Promise<Product>;
  delete(id: number, tenantId: number): Promise<void>;
  findAllByTenant(tenantId: number, filters?: ProductFilters): Promise<Product[]>;
  getLowStock(tenantId: number): Promise<Product[]>;
  adjustStock(id: number, adjustment: number, tenantId: number): Promise<Product>;
  uploadImage(id: number, image: Buffer, tenantId: number): Promise<string>;
}

export interface Product {
  id: number;
  tenantId: number;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  categoryId: number;
  stock: number;
  lowStockThreshold: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductDTO {
  tenantId: number;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  categoryId: number;
  stock: number;
  lowStockThreshold: number;
  imageUrl?: string;
}

export interface ProductFilters {
  categoryId?: number;
  isActive?: boolean;
  lowStock?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}
```

## 7.2 Méthodes Existantes Nécessaires

### Backend

**Fichier** : `src/server/routes/products.ts`

```typescript
// Routes
GET /products
GET /products/:id
POST /products
PATCH /products/:id
DELETE /products/:id
GET /products/low-stock
POST /products/:id/adjust-stock
POST /products/:id/upload-image
GET /products/:id/history
```

**Fichier** : `src/server/products/services/product.service.ts`

```typescript
// Méthodes
createProduct(data: CreateProductDTO): Promise<Product>
updateProduct(id: number, data: UpdateProductDTO): Promise<Product>
deleteProduct(id: number): Promise<void>
adjustStock(id: number, adjustment: number): Promise<Product>
uploadImage(id: number, file: ExpressFile): Promise<string>
```

### Frontend

**Fichier** : `src/features/products/hooks/useProductStore.ts`

```typescript
// Actions
fetchProducts(): Promise<void>
createProduct(data: CreateProductDTO): Promise<void>
updateProduct(id: number, data: UpdateProductDTO): Promise<void>
deleteProduct(id: number): Promise<void>
adjustStock(id: number, adjustment: number): Promise<void>
```

## 7.3 Migration Prévue

### Étape 1 : Créer l'interface

```typescript
// src/server/infrastructure/providers/product/IProductProvider.ts
export interface IProductProvider { ... }
```

### Étape 2 : Implémenter les providers

```typescript
// LocalProductProvider (SQLite)
// CloudProductProvider (Supabase)
// HybridProductProvider (SQLite + Sync)
```

## 7.4 Gaps Identifiés

### Gap 1 : Upload d'images

**Localisation** : `src/server/routes/products.ts`

**Description** : Gestion des uploads d'images

**Impact** : 🟡 Moyen

**Solution** : Gérer dans le provider

---

# 8. IINVENTORYPROVIDER

## 8.1 Interface Future

```typescript
/**
 * IInventoryProvider - Interface pour tous les providers d'inventaire
 */
export interface IInventoryProvider {
  recordMovement(data: CreateInventoryMovementDTO): Promise<InventoryMovement>;
  getMovements(tenantId: number, filters?: InventoryMovementFilters): Promise<InventoryMovement[]>;
  getCurrentStock(tenantId: number, productId: number): Promise<number>;
  getStockHistory(tenantId: number, productId: number): Promise<InventoryMovement[]>;
  adjustStock(productId: number, quantity: number, reason: string, tenantId: number): Promise<void>;
}

export interface InventoryMovement {
  id: number;
  tenantId: number;
  productId: number;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  userId: number;
  createdAt: Date;
}

export interface CreateInventoryMovementDTO {
  tenantId: number;
  productId: number;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  userId: number;
}

export interface InventoryMovementFilters {
  productId?: number;
  type?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}
```

## 8.2 Méthodes Existantes Nécessaires

### Backend

**Fichier** : `src/server/routes/inventory.ts`

```typescript
// Routes
GET /inventory/movements
POST /inventory/movements
GET /inventory/stock/:productId
```

**Fichier** : `src/server/services/inventory.service.ts` (à vérifier)

```typescript
// Méthodes
recordMovement(data: CreateInventoryMovementDTO): Promise<InventoryMovement>
getMovements(tenantId: number): Promise<InventoryMovement[]>
adjustStock(productId: number, quantity: number): Promise<void>
```

## 8.3 Migration Prévue

### Étape 1 : Créer l'interface

```typescript
// src/server/infrastructure/providers/inventory/IInventoryProvider.ts
export interface IInventoryProvider { ... }
```

### Étape 2 : Implémenter les providers

```typescript
// LocalInventoryProvider (SQLite)
// CloudInventoryProvider (Supabase)
// HybridInventoryProvider (SQLite + Sync)
```

## 8.4 Gaps Identifiés

### Gap 1 : Pas de service dédié

**Localisation** : À vérifier

**Description** : Pas de service inventory.service.ts

**Impact** : 🟡 Moyen

**Solution** : Créer le service

---

# 9. IBILLINGPROVIDER

## 9.1 Interface Future

```typescript
/**
 * IBillingProvider - Interface pour tous les providers de billing
 */
export interface IBillingProvider {
  // Subscription
  getSubscription(tenantId: number): Promise<Subscription | null>;
  createSubscription(data: CreateSubscriptionDTO): Promise<Subscription>;
  updateSubscription(id: number, data: UpdateSubscriptionDTO): Promise<Subscription>;
  cancelSubscription(id: number): Promise<void>;
  
  // Voucher
  requestVoucher(data: RequestVoucherDTO): Promise<Voucher>;
  getVoucherStatus(code: string): Promise<Voucher | null>;
  approveVoucher(id: number): Promise<Voucher>;
  rejectVoucher(id: number, reason: string): Promise<Voucher>;
  
  // Payment
  processPayment(data: ProcessPaymentDTO): Promise<PaymentResult>;
  getPaymentHistory(tenantId: number): Promise<Payment[]>;
}

export interface Subscription {
  id: number;
  tenantId: number;
  planId: number;
  status: SubscriptionStatus;
  startsAt: Date;
  endsAt: Date;
  cancelledAt?: Date;
}

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due';

export interface Voucher {
  id: number;
  tenantId: number;
  code: string;
  status: VoucherStatus;
  amount: number;
  reason: string;
  createdAt: Date;
  processedAt?: Date;
}

export type VoucherStatus = 'pending' | 'approved' | 'rejected';
```

## 9.2 Méthodes Existantes Nécessaires

### Backend

**Fichier** : `src/server/routes/billing.routes.ts`

```typescript
// Routes
POST /billing/request-voucher
POST /billing/payment-sent
GET /vouchers/status/:code
```

**Fichier** : `src/server/domain/billing/repositories/ISubscriptionRepository.ts`

```typescript
// Repository existant
findById(id: number): Promise<Subscription | null>;
findByTenantId(tenantId: number): Promise<Subscription | null>;
create(data: CreateSubscriptionDTO): Promise<Subscription>;
update(id: number, data: UpdateSubscriptionDTO): Promise<Subscription>;
cancel(id: number): Promise<void>;
```

**Fichier** : `src/server/domain/billing/repositories/IVoucherRepository.ts`

```typescript
// Repository existant
findById(id: number): Promise<Voucher | null>;
findByCode(code: string): Promise<Voucher | null>;
create(data: CreateVoucherDTO): Promise<Voucher>;
approve(id: number): Promise<Voucher>;
reject(id: number, reason: string): Promise<Voucher>;
```

## 9.3 Migration Prévue

### Étape 1 : Créer l'interface

```typescript
// src/server/infrastructure/providers/billing/IBillingProvider.ts
export interface IBillingProvider { ... }
```

### Étape 2 : Implémenter les providers

```typescript
// LocalBillingProvider (SQLite)
// CloudBillingProvider (Supabase Postgres)
// HybridBillingProvider (SQLite + Sync)
```

### Étape 3 : Migrer les services existants

```typescript
// src/server/application/billing/services/SubscriptionService.ts
// Utiliser IBillingProvider au lieu de ISubscriptionRepository
```

## 9.4 Gaps Identifiés

### Gap 1 : Architecture billing complexe

**Localisation** : `src/server/domain/billing/`

**Description** : Architecture billing déjà bien structurée

**Impact** : 🟢 Faible

**Solution** : Adapter l'existant

---

# 10. IPRINTERPROVIDER

## 10.1 Interface Future

```typescript
/**
 * IPrinterProvider - Interface pour tous les providers d'impression
 */
export interface IPrinterProvider {
  printOrder(order: Order): Promise<void>;
  printReceipt(receipt: Receipt): Promise<void>;
  printKitchenTicket(ticket: KitchenTicket): Promise<void>;
  getPrinters(): Promise<Printer[]>;
  addPrinter(data: CreatePrinterDTO): Promise<Printer>;
  updatePrinter(id: number, data: UpdatePrinterDTO): Promise<Printer>;
  deletePrinter(id: number): Promise<void>;
}

export interface Printer {
  id: number;
  tenantId: number;
  name: string;
  type: 'kitchen' | 'receipt' | 'bar';
  ipAddress?: string;
  port?: number;
  isActive: boolean;
}

export interface Receipt {
  order: Order;
  tenant: Tenant;
  printedAt: Date;
}

export interface KitchenTicket {
  order: Order;
  items: OrderItem[];
  printedAt: Date;
}
```

## 10.2 Méthodes Existantes Nécessaires

### Backend

**Fichier** : `src/server/routes/printers.ts` (à vérifier)

```typescript
// Routes
GET /printers
POST /printers
PATCH /printers/:id
DELETE /printers/:id
POST /printers/:id/print
```

### Frontend

**Fichier** : `src/components/PrintButton.tsx` (à vérifier)

```typescript
// Composants d'impression
```

## 10.3 Migration Prévue

### Étape 1 : Créer l'interface

```typescript
// src/server/infrastructure/providers/printer/IPrinterProvider.ts
export interface IPrinterProvider { ... }
```

### Étape 2 : Implémenter les providers

```typescript
// LocalPrinterProvider (impression locale)
// CloudPrinterProvider (impression cloud)
// HybridPrinterProvider (les deux)
```

## 10.4 Gaps Identifiés

### Gap 1 : Système d'impression

**Localisation** : À vérifier

**Description** : Pas de système d'impression identifié

**Impact** : 🟡 Moyen

**Solution** : À créer

---

# 11. ISETTINGSPROVIDER

## 11.1 Interface Future

```typescript
/**
 * ISettingsProvider - Interface pour tous les providers de paramètres
 */
export interface ISettingsProvider {
  get<T>(key: string, defaultValue?: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  getAll(tenantId: number): Promise<Record<string, any>>;
  setMany(tenantId: number, settings: Record<string, any>): Promise<void>;
}

export interface Settings {
  tenantId: number;
  data: Record<string, any>;
  updatedAt: Date;
}
```

## 11.2 Méthodes Existantes Nécessaires

### Backend

**Fichier** : `src/server/routes/settings.ts` (à vérifier)

```typescript
// Routes
GET /settings
PUT /settings/:key
```

**Fichier** : `src/server/platform/routes/settings.routes.ts` (à vérifier)

```typescript
// Routes plateforme
GET /platform/settings
PUT /platform/settings/:key
```

### Frontend

**Fichier** : `src/stores/useSettingsStore.ts`

```typescript
// Actions
fetchSettings(): Promise<void>
updateSetting(key: string, value: any): Promise<void>
```

## 11.3 Migration Prévue

### Étape 1 : Créer l'interface

```typescript
// src/server/infrastructure/providers/settings/ISettingsProvider.ts
export interface ISettingsProvider { ... }
```

### Étape 2 : Implémenter les providers

```typescript
// LocalSettingsProvider (SQLite)
// CloudSettingsProvider (Supabase)
// HybridSettingsProvider (SQLite + Sync)
```

## 11.4 Gaps Identifiés

### Gap 1 : Pas de système de settings

**Localisation** : À vérifier

**Description** : Pas de système de settings identifié

**Impact** : 🟡 Moyen

**Solution** : À créer

---

# 12. INOTIFICATIONPROVIDER

## 12.1 Interface Future

```typescript
/**
 * INotificationProvider - Interface pour tous les providers de notifications
 */
export interface INotificationProvider {
  create(data: CreateNotificationDTO): Promise<Notification>;
  findById(id: number, userId: number): Promise<Notification | null>;
  findByUserId(userId: number, filters?: NotificationFilters): Promise<Notification[]>;
  markAsRead(id: number, userId: number): Promise<void>;
  markAllAsRead(userId: number): Promise<void>;
  delete(id: number, userId: number): Promise<void>;
  getUnreadCount(userId: number): Promise<number>;
}

export interface Notification {
  id: number;
  userId: number;
  tenantId: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
}

export type NotificationType = 'order' | 'billing' | 'system' | 'inventory' | 'sync';

export interface NotificationFilters {
  type?: NotificationType;
  isRead?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}
```

## 12.2 Méthodes Existantes Nécessaires

### Backend

**Fichier** : `src/server/routes/notifications.routes.ts`

```typescript
// Routes
GET /notifications
POST /notifications/:id/read
POST /notifications/read-all
```

**Fichier** : `src/server/notifications/repositories/NotificationRepository.ts`

```typescript
// Repository existant
findByUserId(userId: number): Promise<Notification[]>;
markAsRead(id: number): Promise<void>;
markAllAsRead(userId: number): Promise<void>;
```

### Frontend

**Fichier** : `src/stores/useNotificationStore.ts`

```typescript
// Actions
fetchNotifications(): Promise<void>
markAsRead(id: number): Promise<void>
markAllAsRead(): Promise<void>
```

**Fichier** : `src/components/NotificationBell.tsx`

```typescript
// Composant UI
```

## 12.3 Migration Prévue

### Étape 1 : Créer l'interface

```typescript
// src/server/infrastructure/providers/notification/INotificationProvider.ts
export interface INotificationProvider { ... }
```

### Étape 2 : Implémenter les providers

```typescript
// LocalNotificationProvider (SQLite)
// CloudNotificationProvider (Supabase)
// HybridNotificationProvider (SQLite + Sync)
```

### Étape 3 : Migrer useNotificationStore

```typescript
// src/stores/useNotificationStore.ts
const notificationProvider = ProviderFactory.getNotificationProvider();
```

## 12.4 Gaps Identifiés

### Gap 1 : Système de notifications existant

**Localisation** : `src/server/notifications/`

**Description** : Système de notifications déjà bien structuré

**Impact** : 🟢 Faible

**Solution** : Adapter l'existant

---

# 13. MATRICE DE MIGRATION

## 13.1 Vue d'Ensemble

| Provider | Phase | Priorité | Complexité | Risque | Efforts |
|----------|-------|----------|------------|--------|---------|
| IAuthProvider | 1 | 🔴 Critique | Moyen | Élevé | 2 jours |
| ITenantProvider | 1 | 🔴 Critique | Faible | Moyen | 1 jour |
| IUserProvider | 1 | 🔴 Critique | Moyen | Élevé | 2 jours |
| ISyncProvider | 1 | 🔴 Critique | Élevé | Moyen | 2 jours |
| IOrderProvider | 2 | 🟠 Important | Élevé | Moyen | 3 jours |
| IProductProvider | 2 | 🟠 Important | Moyen | Faible | 2 jours |
| IInventoryProvider | 2 | 🟠 Important | Moyen | Faible | 2 jours |
| IBillingProvider | 3 | 🟡 Souhaitable | Faible | Faible | 1 jour |
| IPrinterProvider | 3 | 🟡 Souhaitable | Faible | Faible | 1 jour |
| ISettingsProvider | 3 | 🟡 Souhaitable | Faible | Faible | 1 jour |
| INotificationProvider | 3 | 🟡 Souhaitable | Faible | Faible | 1 jour |

**Total** : 11 providers, ~16 jours de développement

## 13.2 Dépendances

```
IAuthProvider (aucune dépendance)
    ↓
ITenantProvider (dépend de IAuthProvider)
    ↓
IUserProvider (dépend de ITenantProvider, IAuthProvider)
    ↓
ISyncProvider (dépend de tous les providers)
    ↓
IOrderProvider (dépend de IUserProvider, IProductProvider)
    ↓
IProductProvider (dépend de ITenantProvider)
    ↓
IInventoryProvider (dépend de IProductProvider)
    ↓
IBillingProvider (dépend de ITenantProvider)
    ↓
IPrinterProvider (dépend de IOrderProvider)
    ↓
ISettingsProvider (aucune dépendance)
    ↓
INotificationProvider (dépend de tous les providers)
```

---

# 14. PRIORISATION

## 14.1 Phase 1 : Providers Critiques (5 jours)

**Objectif** : Créer les providers critiques pour le fonctionnement de base

**Providers** :

1. IAuthProvider (2 jours)
2. ITenantProvider (1 jour)
3. IUserProvider (2 jours)

**Livrables** :

- Interfaces créées
- Implémentations LOCAL, CLOUD, HYBRID
- Tests unitaires
- Migration des stores

## 14.2 Phase 2 : Providers Métier (7 jours)

**Objectif** : Créer les providers pour les fonctionnalités métier

**Providers** :

1. ISyncProvider (2 jours)
2. IProductProvider (2 jours)
3. IOrderProvider (3 jours)
4. IInventoryProvider (2 jours)

**Livrables** :

- Interfaces créées
- Implémentations LOCAL, CLOUD, HYBRID
- Tests unitaires
- Migration des composants

## 14.3 Phase 3 : Providers Complémentaires (4 jours)

**Objectif** : Créer les providers pour les fonctionnalités complémentaires

**Providers** :

1. IBillingProvider (1 jour)
2. IPrinterProvider (1 jour)
3. ISettingsProvider (1 jour)
4. INotificationProvider (1 jour)

**Livrables** :

- Interfaces créées
- Implémentations LOCAL, CLOUD, HYBRID
- Tests unitaires
- Migration des composants

---

# CONCLUSION

## Résumé du Mapping

**Providers documentés** : 11

**Interfaces définies** : 11

**Méthodes existantes cartographiées** : 100+

**Gaps identifiés** : 8

**Phases de migration** : 3

## Prochaines Étapes

1. **Valider** ce document
2. **Démarrer** Phase 1 : IAuthProvider, ITenantProvider, IUserProvider
3. **Implémenter** les interfaces
4. **Implémenter** les providers concrets
5. **Migrer** les stores et composants

---

**Fin du Provider Contract Mapping**

*Document généré par l'Architecte Logiciel Senior*  
*Date : 2026-01-07*