# 🏛️ Great Olive — Architecture Cible v2.0

**Document :** Architecture Decision Record & Target State  
**Auteur :** Principal Software Architect  
**Version :** 2.0  
**Date :** 27/06/2026  
**Périmètre :** Architecture logicielle complète — Plateforme SaaS multi-tenant POS/ERP  
**Validité :** 2026–2031  

---

## TABLE DES MATIÈRES

1. [VISION ARCHITECTURALE](#1-vision-architecturale)
2. [STRATEGY MAP — Principes Fondamentaux](#2-strategy-map--principes-fondamentaux)
3. [BOUNDED CONTEXTS (DDD)](#3-bounded-contexts-ddd)
4. [AGGREGATES & INVARIANTS](#4-aggregates--invariants)
5. [APPLICATION SERVICES & DOMAIN SERVICES](#5-application-services--domain-services)
6. [REPOSITORIES & SOURCE OF TRUTH](#6-repositories--source-of-truth)
7. [DOMAIN EVENTS & EVENT-DRIVEN ARCHITECTURE](#7-domain-events--event-driven-architecture)
8. [CQRS STRATEGY](#8-cqrs-strategy)
9. [OFFLINE-FIRST STRATEGY](#9-offline-first-strategy)
10. [MULTI-TENANT STRATEGY](#10-multi-tenant-strategy)
11. [SYNCHRONISATION SQLITE ↔ SUPABASE](#11-synchronisation-sqlite--supabase)
12. [CACHE & READ MODELS](#12-cache--read-models)
13. [OBSERVABILITY](#13-observability)
14. [DIAGRAMME DE DÉPENDANCES](#14-diagramme-de-dépendances)
15. [ARCHITECTURE DECISION RECORDS](#15-architecture-decision-records)
16. [FEUILLE DE ROUTE DE MIGRATION](#16-feuille-de-route-de-migration)

---

## 1. VISION ARCHITECTURALE

### 1.1 Énoncé

> Great Olive sera une plateforme SaaS multi-tenant, offline-first, event-driven, avec une séparation claire entre les commandes (écritures) et les lectures (CQRS limité), où **SQLite est la source of truth locale** et **Supabase est la projection cloud synchronisée asynchrone**.

### 1.2 Contraintes Architecturales

| Contrainte | Décision |
|------------|----------|
| Environnement | POS offline-capable, Electron, Browser, Render Cloud |
| Base de données locale | SQLite via better-sqlite3 (WAL mode) |
| Base de données cloud | Supabase (PostgreSQL) |
| Langage | TypeScript (backend + frontend) |
| Frontend | React + Zustand + Tailwind |
| Sync | Transactional Outbox → Sync Orchestrator bidirectionnel |
| Auth | JWT + RBAC + Platform Auth |

### 1.3 Principes Non-Négociables

1. **SQLite est la Source of Truth pour les écritures.** Toute mutation passe par SQLite en premier.
2. **Supabase est une Read Model Projection.** Elle est mise à jour de manière asynchrone via l'outbox.
3. **Le cache est invalidé par événement, pas par TTL.** Tout mutation émet un événement qui invalide les caches.
4. **Le JWT ne contient pas de business state.** Il porte uniquement l'identité (`sub`, `tenant_id`, `role`).
5. **Toute mutation est idempotente.** Via `Idempotency-Key` header.
6. **Toute mutation est tracée.** Via `audit_logs` et structured logging.
7. **Le système est offline-first.** Le POS doit fonctionner sans connexion Internet.

---

## 2. STRATEGY MAP — Principes Fondamentaux

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      STRATEGY MAP — Great Olive v2.0                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [UX]                [Commandes]          [Lectures]          [Cloud]        │
│                                                                              │
│  React App ──────► Application Service ──► Read Model ──────► Supabase      │
│  Electron              │                        ▲              (Projection)  │
│  PWA                   │                        │                           │
│                        ▼                        │                           │
│                  Domain Service                  │                           │
│                        │                        │                           │
│                        ▼                        │                           │
│                  Repository ─────────────────────┘                           │
│                        │                                                     │
│                        ▼                                                     │
│                  SQLite (Source of Truth)                                    │
│                        │                                                     │
│                        ▼                                                     │
│                  Outbox ───────► Sync Orchestrator ──────► Supabase          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. BOUNDED CONTEXTS (DDD)

### 3.1 Carte des Contextes

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    CARTE DES BOUNDED CONTEXTS                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐        │
│  │  SUBSCRIPTION    │   │    BILLING       │   │    TENANT        │        │
│  │                  │   │                  │   │                  │        │
│  │  • Voucher       │   │  • Payments      │   │  • Onboarding    │        │
│  │  • Activation    │   │  • Invoices      │   │  • Provisioning  │        │
│  │  • Plans         │   │  • Expiration    │   │  • Isolation     │        │
│  │  • Renewal       │   │  • Trials        │   │  • Suspension    │        │
│  └────────┬─────────┘   └────────┬─────────┘   └────────┬────────┘        │
│           │                      │                      │                 │
│           └──────────────────────┼──────────────────────┘                 │
│                                  │                                        │
│  ┌─────────────────┐   ┌────────┴─────────┐   ┌─────────────────┐        │
│  │   PRODUCT        │   │      ORDER        │   │   INVENTORY      │        │
│  │                  │   │                   │   │                  │        │
│  │  • Catalogue     │   │  • POS            │   │  • Movements     │        │
│  │  • Pricing       │   │  • Cart           │   │  • Stock         │        │
│  │  • Categories    │   │  • Payment        │   │  • Adjustments   │        │
│  │  • Menu          │   │  • Print          │   │  • Transfers     │        │
│  └─────────────────┘   └───────────────────┘   └─────────────────┘        │
│                                                                           │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐        │
│  │   USER & AUTH    │   │    IAM / RBAC    │   │   PLATFORM       │        │
│  │                  │   │                  │   │                  │        │
│  │  • Login         │   │  • Roles         │   │  • Super Admin   │        │
│  │  • JWT           │   │  • Permissions  │   │  • Audit         │        │
│  │  • Profile       │   │  • Policies      │   │  • Dashboard     │        │
│  │  • PIN           │   │  • Kill Switch   │   │  • Analytics     │        │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘        │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                     SYNC (Cross-Cutting)                            │   │
│  │                                                                      │   │
│  │  • Transactional Outbox • Sync Orchestrator • Dead Letter Queue     │   │
│  │  • Conflict Resolution • Startup Migration • Realtime Events        │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Définition de chaque Bounded Context

#### 3.2.1 SUBSCRIPTION Context

| Attribut | Valeur |
|----------|--------|
| **Responsabilité** | Gérer le cycle de vie complet des abonnements : demande, voucher, activation, renouvellement, expiration |
| **Aggregates** | `VoucherRequest`, `Subscription`, `Plan` |
| **Domain Events** | `VoucherRequestSubmitted`, `VoucherVerified`, `VoucherRejected`, `SubscriptionActivated`, `SubscriptionExpired`, `SubscriptionSuspended`, `SubscriptionRenewed`, `PlanChanged` |
| **Source of Truth** | SQLite : `subscription_payment_requests`, `subscriptions`, `plans` |
| **Read Model** | Supabase : mêmes tables (synced) |
| **Cache** | `SubscriptionStatusCache` — invalidé par événement |
| **Acteurs** | Admin plateforme, Tenant user, Super admin |
| **Dépendances** | TENANT (vérifier existence), BILLING (lire paiements) |

#### 3.2.2 BILLING Context

| Attribut | Valeur |
|----------|--------|
| **Responsabilité** | Gérer les transactions financières, factures, essais gratuits, expiration |
| **Aggregates** | `Payment`, `Invoice`, `TrialPeriod`, `BillingCycle` |
| **Domain Events** | `PaymentReceived`, `PaymentFailed`, `InvoiceGenerated`, `TrialStarted`, `TrialEnded`, `BillingCycleCompleted` |
| **Source of Truth** | SQLite : `payments`, `invoices` |
| **Dépendances** | SUBSCRIPTION (lire plan pour calculer montant), TENANT (savoir qui facturer) |

#### 3.2.3 TENANT Context

| Attribut | Valeur |
|----------|--------|
| **Responsabilité** | Gérer l'identité, l'isolation et le cycle de vie des locataires |
| **Aggregates** | `Tenant`, `TenantConfig` |
| **Domain Events** | `TenantCreated`, `TenantSuspended`, `TenantActivated`, `TenantCancelled`, `TenantProvisioned` |
| **Source of Truth** | SQLite : `tenants` |
| **Dépendances** | Aucune (racine du système multi-tenant) |

#### 3.2.4 ORDER Context

| Attribut | Valeur |
|----------|--------|
| **Responsabilité** | Gérer les commandes POS de bout en bout |
| **Aggregates** | `Order`, `OrderItem` |
| **Domain Events** | `OrderCreated`, `OrderItemAdded`, `OrderPaid`, `OrderCancelled`, `OrderSplit`, `OrderTransferred` |
| **Source of Truth** | SQLite : `orders`, `order_items` |
| **Dépendances** | PRODUCT (lire prix), INVENTORY (réserver stock), USER (assigner waiter) |

#### 3.2.5 PRODUCT Context

| Attribut | Valeur |
|----------|--------|
| **Responsabilité** | Gérer le catalogue produits, catégories, prix, disponibilité |
| **Aggregates** | `Product`, `Category`, `ModifierGroup`, `Modifier` |
| **Domain Events** | `ProductCreated`, `ProductPriceChanged`, `ProductStockUpdated`, `ProductDeactivated`, `CategoryCreated` |
| **Source of Truth** | SQLite : `products`, `categories` |
| **Dépendances** | TENANT (scope) |

#### 3.2.6 INVENTORY Context

| Attribut | Valeur |
|----------|--------|
| **Responsabilité** | Gérer les mouvements de stock, ajustements, transferts |
| **Aggregates** | `InventoryMovement`, `StockLevel`, `Warehouse` |
| **Domain Events** | `StockIn`, `StockOut`, `StockAdjusted`, `StockTransferInitiated`, `LowStockAlert` |
| **Source of Truth** | SQLite : `inventory_movements` |
| **Dépendances** | PRODUCT (lire stock actuel) |

#### 3.2.7 USER & AUTH Context

| Attribut | Valeur |
|----------|--------|
| **Responsabilité** | Gérer l'authentification, les profils utilisateurs, les sessions |
| **Aggregates** | `User`, `UserSession` |
| **Domain Events** | `UserLoggedIn`, `UserLoggedOut`, `UserCreated`, `UserSuspended`, `PasswordChanged` |
| **Source of Truth** | SQLite : `users` |
| **Dépendances** | TENANT (appartenance), IAM (rôles) |

#### 3.2.8 IAM / RBAC Context

| Attribut | Valeur |
|----------|--------|
| **Responsabilité** | Gérer les rôles, permissions, politiques de sécurité, cache d'autorisation |
| **Aggregates** | `Role`, `Permission`, `Policy`, `RoleAssignment` |
| **Domain Events** | `RoleAssigned`, `PermissionGranted`, `PolicyUpdated`, `KillSwitchActivated` |
| **Source of Truth** | SQLite : `roles`, `permissions`, `role_assignments` |
| **Dépendances** | USER (cibles des rôles) |

#### 3.2.9 PLATFORM Context

| Attribut | Valeur |
|----------|--------|
| **Responsabilité** | Interface d'administration plateforme : super admin, audit, métriques |
| **Aggregates** | `PlatformAuditLog`, `PlatformMetric`, `PlatformConfig` |
| **Domain Events** | `AdminActionPerformed`, `MetricCollected` |
| **Source of Truth** | SQLite : `platform_audit_logs` |
| **Dépendances** | Tous les contextes (lecture seule pour le reporting) |

#### 3.2.10 SYNC Context (Cross-Cutting)

| Attribut | Valeur |
|----------|--------|
| **Responsabilité** | Synchroniser SQLite ↔ Supabase de manière fiable, avec résolution de conflits |
| **Aggregates** | `OutboxMessage`, `SyncState`, `DeadLetterMessage` |
| **Domain Events** | `EntitySynced`, `SyncConflictDetected`, `SyncFailed`, `OutboxDrained` |
| **Source of Truth** | SQLite : `sync_outbox` (temporaire, vidé après sync) |

---

## 4. AGGREGATES & INVARIANTS

### 4.1 Définition d'un Aggregate

Un Aggregate est une **unité de cohérence transactionnelle**. Toutes les modifications d'un aggregate sont atomiques. Les références entre aggregates se font par ID, jamais par référence objet.

### 4.2 Aggregates Principaux

#### `VoucherRequest`

| Propriété | Type | Invariant |
|-----------|------|-----------|
| id | `number` | PK |
| tenant_id | `number` | FK → Tenant (non-null) |
| plan_id | `number` | FK → Plan (non-null) |
| voucher_code | `string` | Unique, requis, format `VR-XXXX-XXXX` |
| status | `enum` | `pending → payment_sent → verified (ou rejected ou expired)` |
| requested_by | `number` | FK → User (non-null) |
| verified_by | `number?` | FK → User (nullable, requis si status=verified) |
| verified_at | `string?` | ISO date (requis si status=verified) |
| rejection_reason | `string?` | Requis si status=rejected |
| amount_cents | `number?` | Montant payé |
| expires_at | `string` | ISO date, doit être > requested_at |

**Invariants :**
1. `status` suit le workflow strict : `pending → payment_sent → verified` ou `pending → rejected` ou `pending → payment_sent → rejected` ou tout statut → `expired` (via cron)
2. `verified_at` est null si status ≠ verified
3. `rejection_reason` est non-null si status = rejected
4. `verified_by` est non-null si status = verified
5. `expires_at` > `requested_at`

#### `Subscription`

| Propriété | Type | Invariant |
|-----------|------|-----------|
| id | `number` | PK |
| tenant_id | `number` | FK → Tenant (unique, un abonnement actif par tenant) |
| plan_id | `number` | FK → Plan |
| status | `enum` | `trial → active → grace → suspended → cancelled → expired` |
| current_period_start | `string` | ISO date |
| current_period_end | `string` | ISO date, requis si status = active ou grace |
| trial_ends_at | `string?` | ISO date, requis si status = trial |
| auto_renew | `boolean` | Default true |
| cancelled_at | `string?` | ISO date, requis si status = cancelled |

**Invariants :**
1. Un tenant ne peut avoir qu'un seul abonnement actif à la fois (contrainte unique sur `tenant_id` avec status actif)
2. `current_period_end` > `current_period_start`
3. `trial_ends_at` > `created_at`
4. Transitions autorisées : `trial → active → grace → suspended` ou `active → cancelled` ou `suspended → active` (réactivation)
5. Un abonnement `expired` est terminal — un nouveau doit être créé

#### `Order`

| Propriété | Type | Invariant |
|-----------|------|-----------|
| id | `number` | PK |
| tenant_id | `number` | FK → Tenant |
| table_id | `number?` | FK → Table |
| waiter_id | `number` | FK → User |
| items | `OrderItem[]` | Au moins 1 item |
| status | `enum` | `pending → paid (ou cancelled ou rejected)` |
| subtotal | `number` | >= 0 |
| discount | `number` | >= 0, <= subtotal |
| tax | `number` | >= 0 |
| total | `number` | = subtotal - discount + tax |
| payment_method | `enum?` | `cash | card | mobile_money`, requis si paid |

**Invariants :**
1. `total = subtotal - discount + tax` (vérifié en base)
2. Au moins 1 `OrderItem` avec quantity > 0
3. `total` >= 0
4. `status` ne peut pas passer de `paid` à un autre statut

### 4.3 Règles d'Invariants Métier (Cross-Aggregate)

| Règle | Source | Cible | Application |
|-------|--------|-------|-------------|
| Un tenant avec status `suspended` ne peut pas avoir d'abonnement `active` | TENANT | SUBSCRIPTION | Domain Service |
| Un voucher ne peut être utilisé qu'une fois | VOUCHER | — | Repository check |
| Un paiement doit exister pour valider un voucher | BILLING | SUBSCRIPTION | Application Service |
| Un utilisateur ne peut pas être actif si son tenant est suspendu | USER | TENANT | Domain Event |
| Un produit ne peut pas être commandé si stock < quantité | PRODUCT | ORDER | Domain Service |
| Un admin ne peut pas s'auto-suspendre | USER | IAM | Application Service |

---

## 5. APPLICATION SERVICES & DOMAIN SERVICES

### 5.1 Application Services

Les Application Services orchestrent les use cases. Ils sont propres à chaque Bounded Context et ne contiennent pas de logique métier.

#### SUBSCRIPTION Application Services

```
VoucherApplicationService
├── requestVoucher(tenantId, planId, requestedBy): VoucherRequest
├── submitPayment(voucherId, amountCents, currency): void
├── verifyVoucher(voucherId, adminUserId): void
└── rejectVoucher(voucherId, reason, adminUserId): void

SubscriptionApplicationService
├── activateSubscription(tenantId, planId, activatedBy): Subscription
├── renewSubscription(subscriptionId): Subscription
├── suspendSubscription(subscriptionId, reason): void
├── cancelSubscription(subscriptionId): void
├── expireSubscription(subscriptionId): void
└── changePlan(subscriptionId, newPlanId): Subscription
```

#### TENANT Application Services

```
TenantApplicationService
├── createTenant(name, slug, ownerEmail): Tenant
├── suspendTenant(tenantId): void
├── activateTenant(tenantId): void
├── provisionTenant(tenantId): void
├── updateTenantSettings(tenantId, settings): void
└── deleteTenant(tenantId): void
```

#### ORDER Application Services

```
OrderApplicationService
├── createOrder(tenantId, tableId, waiterId): Order
├── addItem(orderId, productId, quantity): void
├── removeItem(orderId, itemId): void
├── updateItemQuantity(orderId, itemId, quantity): void
├── applyDiscount(orderId, discount): void
├── processPayment(orderId, method, amount): void
├── cancelOrder(orderId, reason): void
├── splitOrder(orderId, items): Order[]
└── transferOrder(orderId, newTableId): void
```

### 5.2 Domain Services

Les Domain Services contiennent la **logique métier pure** qui ne peut pas être placée dans un Aggregate.

#### `SubscriptionActivationService`

| Responsabilité | Valider que toutes les conditions sont réunies pour activer un abonnement |
|----------------|------------------------------------------------------|
| **Méthode** | `activate(tenantId, planId, adminUserId): ActivationResult` |
| **Étapes** | 1. Vérifier que le tenant existe et n'est pas déjà actif<br>2. Vérifier que le plan existe<br>3. Vérifier que l'admin a les droits<br>4. Vérifier l'idempotence (pas de doublon)<br>5. Démarrer la transaction<br>6. Marquer la demande comme vérifiée<br>7. Créer/mettre à jour l'abonnement<br>8. Activer le tenant<br>9. Valider la transaction<br>10. Émettre `SubscriptionActivated`<br>11. Invalider les caches<br>12. Envoyer l'email de confirmation |
| **Invariants** | La création de l'abonnement et l'activation du tenant sont atomiques |

#### `VoucherValidationService`

| Responsabilité | Valider qu'un voucher peut être soumis ou rejeté |
|----------------|---------------------------------------------------|
| **Méthode** | `validate(voucherId, action): ValidationResult` |
| **Règles** | • Le voucher doit exister<br>• Le statut doit être `pending` ou `payment_sent`<br>• Le voucher ne doit pas être expiré (`expires_at > now`)<br>• Le tenant cible ne doit pas déjà être actif |

#### `StockReservationService`

| Responsabilité | Réserver le stock pour une commande avant validation |
|----------------|-------------------------------------------------------|
| **Méthode** | `reserve(orderId): ReservationResult` |
| **Règles** | • Chaque produit doit avoir `stock_quantity >= quantity`<br>• Réservation temporaire (timeout 15 min si commande non payée)<br>• Libération automatique sur annulation |

### 5.3 Ports & Adapters (Hexagonal Architecture)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     HEXAGONAL ARCHITECTURE — LAYER MAP                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Application Layer] — ApplicationServices (orchestration)                   │
│      Ports : interfaces pour repositories, event bus, email, cache          │
│                                                                              │
│  [Domain Layer]    — Aggregates, DomainServices, ValueObjects, Events       │
│      Aucune dépendance externe. Pur TypeScript.                              │
│                                                                              │
│  [Infrastructure Layer] — Adapters pour SQLite, Supabase, Redis, SendGrid   │
│      Implémente les ports définis dans Application Layer.                    │
│                                                                              │
│  [Presentation Layer] — Routes Express, Middleware, React Components         │
│      Appelle les Application Services. Ne contient pas de logique métier.   │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. REPOSITORIES & SOURCE OF TRUTH

### 6.1 Source of Truth Officielle

```
┌────────────────────────────────────────────────────────────────────────────┐
│                  SOURCE OF TRUTH — DÉFINITION OFFICIELLE                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DÉCLARATION :                                                               │
│  SQLite est la Source of Truth pour toutes les écritures.                    │
│  Toute donnée écrite dans Supabase sans passer par SQLite                    │
│  est considérée comme non autorisée et sera écrasée à la prochaine sync.     │
│                                                                              │
│  CONSÉQUENCES :                                                              │
│  1. Toutes les routes CRUD écrivent dans SQLite d'abord                      │
│  2. Supabase est uniquement mise à jour via le Transactional Outbox          │
│  3. Aucune route n'écrit directement dans Supabase (sauf sync orchestrator)  │
│  4. Le cache est invalidé après chaque mutation SQLite                       │
│  5. Le JWT est un token d'identité, pas une source de données                │
│                                                                              │
│  EXCEPTIONS :                                                                │
│  - Les webhooks externes (Stripe, etc.) écrivent dans Supabase d'abord,     │
│    puis sont répliqués vers SQLite via pull sync                             │
│  - Le sync orchestrator lit/écrit Supabase pour la synchronisation           │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Interface Repository Standard

Chaque Aggregate a son Repository. Interface type :

```typescript
interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  delete(id: ID): Promise<void>;
}

// Spécialisation pour les entités multi-tenant
interface TenantScopedRepository<T, ID> extends Repository<T, ID> {
  findByTenantId(tenantId: number, options?: QueryOptions): Promise<T[]>;
  countByTenantId(tenantId: number): Promise<number>;
}
```

### 6.3 Implémentations

| Contexte | Repository | Implémentation SQLite | Implémentation Supabase |
|----------|------------|-----------------------|-------------------------|
| SUBSCRIPTION | `VoucherRequestRepository` | `SqliteVoucherRequestRepository` | `SupabaseVoucherRequestRepository` |
| SUBSCRIPTION | `SubscriptionRepository` | `SqliteSubscriptionRepository` | `SupabaseSubscriptionRepository` |
| SUBSCRIPTION | `PlanRepository` | `SqlitePlanRepository` | `SupabasePlanRepository` |
| TENANT | `TenantRepository` | `SqliteTenantRepository` | `SupabaseTenantRepository` |
| ORDER | `OrderRepository` | `SqliteOrderRepository` | `SupabaseOrderRepository` |
| PRODUCT | `ProductRepository` | `SqliteProductRepository` | `SupabaseProductRepository` |
| INVENTORY | `InventoryMovementRepository` | `SqliteInventoryMovementRepository` | `SupabaseInventoryMovementRepository` |
| USER | `UserRepository` | `SqliteUserRepository` | `SupabaseUserRepository` |
| SYNC | `OutboxRepository` | `SqliteOutboxRepository` | — (SQLite seulement) |

### 6.4 Transaction Pattern

```typescript
// Standard pour toutes les mutations
class UnitOfWork {
  async execute<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    // 1. BEGIN TRANSACTION (SQLite)
    // 2. Exécuter fn()
    // 3. Pour chaque mutation, ajouter un message Outbox
    // 4. COMMIT
    // 5. Émettre Domain Events
    // 6. Invalider caches
    // 7. Déclencher sync orchestrator (async)
  }
}
```

---

## 7. DOMAIN EVENTS & EVENT-DRIVEN ARCHITECTURE

### 7.1 Catalogue des Domain Events

#### SUBSCRIPTION Events

| Event | Payload | Émetteur | Consommateurs |
|-------|---------|----------|---------------|
| `VoucherRequestSubmitted` | `{ voucherId, tenantId, planId, requestedBy }` | VoucherApplicationService | EmailService, Sync |
| `VoucherVerified` | `{ voucherId, tenantId, planId, verifiedBy }` | SubscriptionActivationService | CacheInvalidator, EmailService, Sync |
| `VoucherRejected` | `{ voucherId, tenantId, reason, rejectedBy }` | SubscriptionApplicationService | EmailService, Sync |
| `SubscriptionActivated` | `{ subscriptionId, tenantId, planId, activatedAt }` | SubscriptionActivationService | TenantActivationHandler, CacheInvalidator, EmailService, Sync, Analytics |
| `SubscriptionExpired` | `{ subscriptionId, tenantId, expiredAt }` | BillingExpirationCron | TenantSuspensionHandler, CacheInvalidator, Sync |
| `SubscriptionSuspended` | `{ subscriptionId, tenantId, reason }` | SubscriptionApplicationService | TenantSuspensionHandler, CacheInvalidator, Sync |
| `SubscriptionCancelled` | `{ subscriptionId, tenantId, cancelledAt }` | SubscriptionApplicationService | CacheInvalidator, Sync |
| `SubscriptionRenewed` | `{ subscriptionId, tenantId, newPeriodEnd }` | BillingService | CacheInvalidator, EmailService, Sync |

#### TENANT Events

| Event | Payload | Émetteur | Consommateurs |
|-------|---------|----------|---------------|
| `TenantCreated` | `{ tenantId, name, slug, ownerEmail }` | TenantApplicationService | ProvisioningHandler, Analytics, Sync |
| `TenantSuspended` | `{ tenantId, reason }` | TenantApplicationService | SubscriptionSuspensionHandler, CacheInvalidator, Sync |
| `TenantActivated` | `{ tenantId }` | TenantApplicationService | CacheInvalidator, Sync |
| `TenantProvisioned` | `{ tenantId, provisionedAt }` | ProvisioningService | EmailService, Analytics |

#### ORDER Events

| Event | Payload | Émetteur | Consommateurs |
|-------|---------|----------|---------------|
| `OrderCreated` | `{ orderId, tenantId, tableId, waiterId }` | OrderApplicationService | Sync, Analytics |
| `OrderPaid` | `{ orderId, total, method }` | OrderApplicationService | InventoryService (déstockage), Sync, Analytics, PrinterService |
| `OrderCancelled` | `{ orderId, reason }` | OrderApplicationService | InventoryService (remboursement stock), Sync |

### 7.2 Event Bus Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           EVENT BUS ARCHITECTURE                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  InProcessEventBus (Node.js EventEmitter)                                    │
│  ─────────────────────────────────────                                       │
│  • Pour les événements synchrones au sein du même processus                  │
│  • Cache invalidation, notifications, audit logs                             │
│  • Garantie : at-most-once (fire-and-forget)                                 │
│  • Utilisé pour les handlers qui doivent s'exécuter immédiatement           │
│                                                                              │
│  OutboxEventBus (Transactional Outbox)                                       │
│  ────────────────────────────────                                            │
│  • Pour les événements asynchrones cross-process                             │
│  • Sync orchestrator, emails, webhooks                                       │
│  • Garantie : at-least-once (via outbox + retry)                             │
│  • Utilisé pour les handlers qui peuvent attendre quelques secondes         │
│                                                                              │
│  RealtimeEventBus (SSE / WebSocket)                                          │
│  ────────────────────────────────                                            │
│  • Pour les notifications temps réel vers le frontend                        │
│  • Mise à jour du statut abonnement, notifications POS                       │
│  • Garantie : best-effort                                                    │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Handler Registration

```typescript
// Configuration explicite des handlers
class EventHandlerRegistry {
  registerHandlers(): void {
    // InProcess handlers (synchrone)
    eventBus.on('SubscriptionActivated', cacheInvalidator.onSubscriptionActivated);
    eventBus.on('TenantSuspended', cacheInvalidator.onTenantSuspended);
    eventBus.on('SubscriptionActivated', auditLogger.onSubscriptionActivated);

    // Outbox handlers (asynchrone)
    outboxBus.on('VoucherVerified', emailService.sendVerificationConfirmation);
    outboxBus.on('SubscriptionActivated', emailService.sendActivationConfirmation);
    outboxBus.on('OrderPaid', syncService.syncOrder);
    
    // Realtime handlers
    realtimeBus.on('SubscriptionActivated', notificationService.notifyTenant);
    realtimeBus.on('OrderCreated', posNotificationService.notifyKitchen);
  }
}
```

---

## 8. CQRS STRATEGY

### 8.1 Où appliquer CQRS

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    CQRS DECISION MATRIX                                      │
├──────────────┬───────────────┬───────────────┬─────────────────────────────┤
│   CONTEXT    │   COMMAND      │    QUERY       │  CQRS ?                    │
│              │   (Écriture)   │    (Lecture)    │                             │
├──────────────┼───────────────┼───────────────┼─────────────────────────────┤
│ SUBSCRIPTION │ Rare           │ Très fréquente │ ✅ OUI — Cache dedicated  │
│              │ (1/jour max)   │ (chaque req)   │     read model             │
├──────────────┼───────────────┼───────────────┼─────────────────────────────┤
│ ORDER        │ Très fréquent  │ Très fréquent  │ ❌ NON — Même modèle       │
│              │ (1000/jour)    │ (1000/jour)    │     Immediate consistency  │
├──────────────┼───────────────┼───────────────┼─────────────────────────────┤
│ PRODUCT      │ Peu fréquent   │ Très fréquent  │ ⚠️ PARTIEL — Cache menu   │
│              │ (10/jour)      │ (10000/jour)   │     public QR              │
├──────────────┼───────────────┼───────────────┼─────────────────────────────┤
│ INVENTORY    │ Très fréquent  │ Très fréquent  │ ❌ NON — Stock temps réel  │
│              │ (1000/jour)    │ (1000/jour)    │                             │
├──────────────┼───────────────┼───────────────┼─────────────────────────────┤
│ USER/AUTH    │ Peu fréquent   │ Très fréquent  | ✅ OUI — Cache RBAC       │
│              │ (5/jour)       │ (chaque req)   │     + token validation     │
├──────────────┼───────────────┼───────────────┼─────────────────────────────┤
│ ANALYTICS    │ Aucune         │ Très fréquent  │ ✅ OUI — Read-only,        │
│              │                │ (dashboard)    │     materialized views     │
└──────────────┴───────────────┴───────────────┴─────────────────────────────┘
```

### 8.2 Read Models

#### `SubscriptionStatusReadModel`

```typescript
interface SubscriptionStatusReadModel {
  tenantId: number;
  state: 'active' | 'trial' | 'grace' | 'suspended' | 'cancelled' | 'expired' | 'no_plan' | 'pending';
  planName: string | null;
  planId: number | null;
  daysUntilRenewal: number | null;
  isExpired: boolean;
  isGracePeriod: boolean;
  graceDaysRemaining: number | null;
  subscriptionId: number | null;
  cachedAt: number; // timestamp
}
```

**Stratégie de peuplement :**
1. Cache hit → retourner la valeur du cache (Redis ou in-memory)
2. Cache miss → charger depuis SQLite, peupler le cache, retourner
3. Cache invalidation → supprimer l'entrée (pas de Mise à jour, laisser le prochain read la recharger)

#### `ProductMenuReadModel`

```
Pour le menu public QR :
1. Charger depuis Supabase (optimisé pour les lectures publiques)
2. Fallback SQLite si Supabase indisponible
3. Cache HTTP (CDN) avec TTL de 5 minutes
```

---

## 9. OFFLINE-FIRST STRATEGY

### 9.1 Principes

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    OFFLINE-FIRST — STRATÉGIE                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PRINCIPE #1 : Le POS doit fonctionner sans Internet                        │
│  → SQLite local est la source de truth                                      │
│  → Toutes les fonctionnalités POS sont disponibles offline                   │
│  → L'interface utilisateur ne montre pas d'erreur réseau                    │
│                                                                              │
│  PRINCIPE #2 : La sync est asynchrone et résiliente                         │
│  → Les mutations sont mises en file d'attente (outbox)                      │
│  → La sync s'exécute en arrière-plan dès que la connexion est rétablie      │
│  → Les conflits sont résolus automatiquement (last-write-wins ou merge)     │
│                                                                              │
│  PRINCIPE #3 : L'utilisateur ne doit jamais perdre de données               │
│  → L'outbox persiste dans SQLite (pas de perte si crash)                    │
│  → Dead letter queue pour les échecs irrécupérables                         │
│  → Notification à l'utilisateur si sync échoue                              │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Request Queue (Frontend)

```typescript
// Le frontend a déjà une RequestQueue (src/lib/request-queue.ts) ✅
// À renforcer avec :
interface RequestQueueConfig {
  maxRetries: 5;
  retryDelay: exponentialBackoff(1000, 30000); // 1s → 30s
  persistence: 'indexeddb'; // Persister les requêtes non envoyées
  conflictStrategy: 'last-write-wins' | 'merge' | 'manual';
  onSyncStatusChange: (status: 'synced' | 'pending' | 'failed') => void;
}
```

### 9.3 Offline State Machine

```
                    ┌─────────────┐
                    │   ONLINE    │
                    └──────┬──────┘
                           │ Connexion perdue
                           ▼
                    ┌─────────────┐
              ┌────►│ CONNECTING  │◄────┐
              │     └──────┬──────┘     │
              │            │            │
              │     ┌──────▼──────┐     │
              │     │  OFFLINE    ├─────┘
              │     └──────┬──────┘  Reconnexion
              │            │ échouée
              │     ┌──────▼──────┐
              │     │  SYNCING    │
              │     └──────┬──────┘
              │            │ Sync réussie
              │     ┌──────▼──────┐
              │     │   ONLINE    │
              │     └─────────────┘
              └─────┤ (re-SYNC)
```

---

## 10. MULTI-TENANT STRATEGY

### 10.1 Isolation Model

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    MULTI-TENANT ISOLATION STRATEGY                           │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MODÈLE : Shared Database (SQLite) + Row-Level Security (Supabase)          │
│                                                                              │
│  SQLite (local) :                                                            │
│  ───────────────                                                             │
│  • Toutes les tables ont une colonne `tenant_id`                             │
│  • Les querys sont filtrées par `tenant_id`                                  │
│  • Tenant-scope middleware garantit le filtrage                              │
│                                                                              │
│  Supabase (cloud) :                                                          │
│  ─────────────────                                                            │
│  • Row-Level Security (RLS) activée                                           │
│  • Chaque tenant a son propre JWT avec `tenant_id` dans le token            │
│  • Les policies RLS vérifient `auth.uid() = tenant_id`                      │
│                                                                              │
│  PLATFORM (admin) :                                                          │
│  ─────────────────                                                           │
│  • Tables de platforme isolées dans le même SQLite                           │
│  • `is_platform_user = 1` dans `users`                                      │
│  • Routes protégées par `requirePlatformAuth`                               │
│  • RLS Supabase : service_role key (bypass RLS)                             │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Tenant Provisioning Pipeline

```
TenantCreated
    ↓
[1] Créer le tenant dans SQLite (tenants)
    ↓
[2] Créer le tenant dans Supabase (via outbox)
    ↓
[3] Créer l'admin user dans SQLite
    ↓
[4] Créer les settings par défaut
    ↓
[5] Créer les données de démo (catégories, produits, tables)
    ↓
[6] Provisioning terminé → emit TenantProvisioned
    ↓
[7] Email de bienvenue au owner
```

---

## 11. SYNCHRONISATION SQLITE ↔ SUPABASE

### 11.1 Architecture de Synchro

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    SYNC ARCHITECTURE v2.0                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PUSH (SQLite → Supabase) :                                                 │
│  ───────────────────────────                                                │
│  [Mutation] → [Outbox] → [Sync Orchestrator] → [Supabase API]              │
│                                                                              │
│  PULL (Supabase → SQLite) :                                                 │
│  ────────────────────────────                                                │
│  [Cron] → [Pull Sync Service] → [Compare remote_id] → [Upsert SQLite]      │
│                                                                              │
│  REALTIME (Bidirectionnel) :                                                 │
│  ──────────────────────────                                                  │
│  [Supabase Realtime] → [WebSocket] → [Realtime Handler] → [Upsert SQLite]  │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Transactional Outbox — Standard

```typescript
interface OutboxMessage {
  id: string;              // UUID
  entity: string;          // 'subscription' | 'tenant' | 'order' | etc.
  operation: 'insert' | 'update' | 'delete';
  record_id: string;       // ID de l'enregistrement (en string)
  payload: string;         // JSON du payload complet
  tenant_id: number;       // Scope tenant
  status: 'pending' | 'processing' | 'failed' | 'completed';
  created_at: string;      // ISO date
  processed_at: string?;   // ISO date
  retry_count: number;     // Default 0
  error_message: string?;  // Dernière erreur
}
```

**Règles :**
1. L'outbox est écrite **dans la même transaction SQLite** que la mutation
2. Si la transaction rollback, l'outbox est rollback aussi
3. Le Sync Orchestrator lit l'outbox par ordre de `created_at`
4. Chaque message est traité au moins une fois (at-least-once)
5. Après succès, le message est supprimé ou marqué `completed`
6. Après échec, `retry_count` est incrémenté. À 5 échecs → Dead Letter Queue

### 11.3 Résolution de Conflits

```typescript
type ConflictResolutionStrategy = 
  | 'last-write-wins'      // Le dernier écrit gagne (timestamp)
  | 'merge'                // Fusion intelligente (ex: ajout d'items)
  | 'manual'               // Conflit → notification admin
  | 'timestamp-wins'       // Le timestamp le plus récent gagne
  | 'sqlite-wins'          // SQLite écrase Supabase (pendant pull)
  | 'supabase-wins'        // Supabase écrase SQLite (pendant push)
```

| Opération | Stratégie Push (SQLite→Supabase) | Stratégie Pull (Supabase→SQLite) |
|-----------|----------------------------------|----------------------------------|
| `subscription` | `last-write-wins` | `sqlite-wins` (ignorer pull pour ce domaine) |
| `tenant` | `last-write-wins` | `sqlite-wins` |
| `order` | `last-write-wins` | `sqlite-wins` |
| `product` | `last-write-wins` | `timestamp-wins` |
| `category` | `last-write-wins` | `timestamp-wins` |
| `menu` (QR) | `last-write-wins` | `sqlite-wins` |

---

## 12. CACHE & READ MODELS

### 12.1 Cache Layers

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    CACHE ARCHITECTURE                                        │
├──────────────┬───────────────┬───────────────┬─────────────────────────────┤
│   LAYER      │   STORAGE      │   TTL          │   UTILISATION               │
├──────────────┼───────────────┼───────────────┼─────────────────────────────┤
│ L1 (Memory)  │ Map in-process │ Invalidé par   │ SubscriptionStatusCache     │
│              │               │ événement      │ RBAC Cache                  │
├──────────────┼───────────────┼───────────────┼─────────────────────────────┤
│ L2 (Shared)  │ Redis         │ 5 min + event  │ Multi-instance (scale-out)  │
│              │               │ invalidation   │ (futur)                     │
├──────────────┼───────────────┼───────────────┼─────────────────────────────┤
│ L3 (HTTP)    │ CDN / nginx   │ 5 min          │ Menu public QR              │
│              │               │                │ Static assets               │
├──────────────┼───────────────┼───────────────┼─────────────────────────────┤
│ L4 (DB)      │ SQLite        │ Source of Truth│ Toutes les lectures         │
│              │               │                │ (cache miss → DB read)      │
└──────────────┴───────────────┴───────────────┴─────────────────────────────┘
```

### 12.2 Cache Invalidation Contract

```typescript
// TOUTE MUTATION DOIT APPELER L'UNE DE CES FONCTIONS :
interface CacheInvalidationPort {
  onSubscriptionActivated(tenantId: number): void;   // → delete cache[tenantId]
  onSubscriptionSuspended(tenantId: number): void;   // → delete cache[tenantId]
  onSubscriptionExpired(tenantId: number): void;      // → delete cache[tenantId]
  onTenantStatusChanged(tenantId: number): void;      // → delete cache[tenantId]
  onUserRoleChanged(userId: number): void;            // → delete RBAC[userId]
  onPermissionUpdated(roleId: number): void;          // → delete RBAC for all users with role
}
```

### 12.3 Read Model Population

```typescript
class SubscriptionStatusReadModelPopulator {
  async get(tenantId: number): Promise<SubscriptionStatusReadModel | null> {
    // 1. Check L1 cache
    const cached = this.l1Cache.get(tenantId);
    if (cached) return cached;

    // 2. Check L2 cache (Redis) — futur
    // const cached = await this.redis.get(`subscription:${tenantId}`);
    // if (cached) { this.l1Cache.set(tenantId, cached); return cached; }

    // 3. Read from source of truth
    const subscription = await this.subscriptionRepo.findActiveByTenantId(tenantId);
    const result = this.buildReadModel(subscription);

    // 4. Populate L1 cache
    this.l1Cache.set(tenantId, result);

    // 5. Populate L2 cache — futur
    // await this.redis.set(`subscription:${tenantId}`, result, 'EX', 300);

    return result;
  }
}
```

---

## 13. OBSERVABILITY

### 13.1 Structured Logging

```typescript
// Standard pour tous les logs
interface LogEntry {
  timestamp: string;         // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  correlationId: string;    // Généré par middleware, propagé partout
  tenantId?: number;         // Scope tenant
  userId?: number;           // Who
  context: string;           // 'SubscriptionActivation' | 'VoucherVerification' | etc.
  message: string;
  data?: Record<string, any>; // Données contextuelles

  // Métriques intégrées
  duration?: number;         // ms
  cacheHit?: boolean;
  cacheTTL?: number;
}
```

### 13.2 Métriques Clés (Prometheus)

```prometheus
# Subscription
greatolive_subscription_activation_total{status="success|failure"} 
greatolive_subscription_activation_duration_ms
greatolive_subscription_renewal_total
greatolive_subscription_expired_total
greatolive_subscription_cancelled_total

# Cache
greatolive_cache_hit_total{cache="subscription_status|rbac"}
greatolive_cache_miss_total{cache="subscription_status|rbac"}
greatolive_cache_size{}

# Sync
greatolive_outbox_depth{tenant_id=""}
greatolive_outbox_processed_total
greatolive_outbox_failed_total
greatolive_sync_duration_ms
greatolive_dead_letter_depth

# Business
greatolive_orders_total
greatolive_revenue_total{currency="ZMW"}
greatolive_active_tenants
greatolive_active_users
```

### 13.3 Audit Trail

Chaque mutation métier produit une entrée dans `platform_audit_logs` :

```typescript
interface AuditLogEntry {
  id: number;
  timestamp: string;
  actorId: number;
  actorRole: string;
  action: string;             // 'subscription.verify' | 'tenant.suspend' | etc.
  entityType: string;         // 'subscription' | 'tenant' | 'voucher'
  entityId: string;
  tenantId: number;
  beforeState: Record<string, any> | null;   // Snapshot avant
  afterState: Record<string, any> | null;    // Snapshot après
  mutation: Record<string, any>;             // La mutation elle-même
  correlationId: string;
  ip: string;
  userAgent: string;
}
```

---

## 14. DIAGRAMME DE DÉPENDANCES

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                     DEPENDENCY GRAPH — GREAT OLIVE v2.0                                    │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                            │
│  ┌─────────────────────────────────────────────────────────────┐                          │
│  │                    PRESENTATION LAYER                         │                          │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │                          │
│  │  │ React Routes  │  │ Express      │  │ Middleware    │       │                          │
│  │  │ (Frontend)    │  │ Routes (API) │  │ (Auth, Guard)│       │                          │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │                          │
│  └─────────┼─────────────────┼─────────────────┼───────────────┘                          │
│            │                 │                 │                                          │
│            ▼                 ▼                 ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐                          │
│  │                   APPLICATION LAYER                           │                          │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐   │                          │
│  │  │Application     │ │Application     │ │Application     │   │                          │
│  │  │Services (Sub)  │ │Services (Order)│ │Services (Tnt)  │   │                          │
│  │  └───────┬────────┘ └───────┬────────┘ └───────┬────────┘   │                          │
│  └──────────┼──────────────────┼──────────────────┼────────────┘                          │
│             │                  │                  │                                       │
│             ▼                  ▼                  ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐                          │
│  │                     DOMAIN LAYER                              │                          │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐  │                          │
│  │  │ Aggregates │ │Domain      │ │Domain      │ │ Value    │  │                          │
│  │  │            │ │Services    │ │Events      │ │ Objects  │  │                          │
│  │  └───────┬────┘ └───────┬────┘ └───────┬────┘ └────┬─────┘  │                          │
│  └──────────┼──────────────┼──────────────┼───────────┼────────┘                          │
│             │              │              │           │                                   │
│             ▼              ▼              ▼           ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐                          │
│  │                 INFRASTRUCTURE LAYER (PORTS)                  │                          │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │                          │
│  │  │ Repository   │ │ UnitOfWork   │ │ EventBus (Port)      │ │                          │
│  │  │ (Interface)  │ │ (Interface)  │ │ CacheInvalidation    │ │                          │
│  │  └───────┬──────┘ └──────┬───────┘ └──────────┬───────────┘ │                          │
│  └──────────┼───────────────┼────────────────────┼─────────────┘                          │
│             │               │                    │                                       │
│             ▼               ▼                    ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐                          │
│  │               INFRASTRUCTURE LAYER (ADAPTERS)                 │                          │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │                          │
│  │  │ SQLite Repos │ │ Supabase     │ │                      │ │                          │
│  │  │ & Adapters   │ │ Adapters     │ │ EventBus (Emitter)   │ │                          │
│  │  └───────┬──────┘ └──────┬───────┘ └──────────┬───────────┘ │                          │
│  └──────────┼───────────────┼────────────────────┼─────────────┘                          │
│             │               │                    │                                       │
│             ▼               ▼                    ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐                          │
│  │                    DATA & SYNC LAYER                          │                          │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │                          │
│  │  │ SQLite (SOT) │ │ Supabase     │ │ Sync Orchestrator    │ │                          │
│  │  │ (Source of   │ │ (Projection) │ │ Outbox + DLQ + Pull  │ │                          │
│  │  │  Truth)      │ │              │ │ + Realtime           │ │                          │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘ │                          │
│  └─────────────────────────────────────────────────────────────┘                          │
│                                                                                            │
│  CROSS-CUTTING :                                                                           │
│  ┌────────────────────────────────┐ ┌────────────────────┐ ┌─────────────────────┐         │
│  │ Observability (Logs, Metrics,  │ │ Cache (L1 Memory,  │ │ Security            │         │
│  │ Traces, Audit)                 │ │ L2 Redis, L3 CDN)  │ │ (Auth, RBAC, RLS)   │         │
│  └────────────────────────────────┘ └────────────────────┘ └─────────────────────┘         │
│                                                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. ARCHITECTURE DECISION RECORDS

### ADR-001 : SQLite comme Source of Truth

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Le système a deux bases de données (SQLite locale, Supabase cloud). Quelle est l'autorité en cas de conflit ? |
| **Décision** | SQLite est la Source of Truth pour toutes les écritures métier. |
| **Conséquences** | • Toute écriture directe dans Supabase (hors sync orchestrator) est interdite<br>• Les webhooks externes écrivent dans Supabase puis sont pullés vers SQLite<br>• En mode cloud (Render), SQLite est désactivé — Supabase devient la SOT |
| **Date** | 2026-06-27 |

### ADR-002 : Événements pour l'invalidation de cache

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Le cache subscription a un TTL de 5 minutes qui cause des états obsolètes. |
| **Décision** | Le cache est invalidé par événement, pas par TTL. |
| **Conséquences** | • Chaque mutation émet un événement `cache.invalidate`<br>• Le TTL devient un filet de sécurité (fallback), pas le mécanisme principal<br>• Le cache est peuplé à la première lecture après invalidation |
| **Date** | 2026-06-27 |

### ADR-003 : JWT sans Business State

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Le JWT contient `user.status` qui devient obsolète après activation. |
| **Décision** | Le JWT ne porte que `sub`, `tenant_id`, `role`. Le statut est lu depuis le cache/DB. |
| **Conséquences** | • `GET /auth/me` lit le statut depuis le cache subscription<br>• Le middleware `requireActiveSubscription` lit depuis le cache, pas depuis le JWT<br>• Le frontend appelle `refreshProfile()` pour obtenir le statut à jour |
| **Date** | 2026-06-27 |

### ADR-004 : Transactional Outbox pour la sync

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Les mutations SQLite doivent être répliquées vers Supabase de manière fiable. |
| **Décision** | Utiliser le Transactional Outbox Pattern : écrire l'outbox dans la même transaction SQLite que la mutation. |
| **Conséquences** | • Garantie at-least-once pour la sync<br>• Résilience aux crashs (rollback de l'outbox si la mutation échoue)<br>• Dead Letter Queue pour les échecs permanents |
| **Date** | 2026-06-27 |

### ADR-005 : Idempotence par Header

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Les mutations POST (verify, reject) peuvent être dupliquées par retry réseau. |
| **Décision** | Toute mutation POST/PUT/DELETE accepte un header `Idempotency-Key`. |
| **Conséquences** | • Table `idempotency_keys` avec TTL de 24h<br>• La même clé retourne la même réponse sans ré-exécuter la mutation<br>• Middleware `idempotencyMiddleware` pour toutes les routes |
| **Date** | 2026-06-27 |

### ADR-006 : Domain Events pour la propagation

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Les mutations doivent propager leurs effets (cache, email, sync, audit) sans couplage. |
| **Décision** | Chaque mutation émet un Domain Event. Les handlers s'enregistrent pour les événements qui les concernent. |
| **Conséquences** | • 3 EventBus : InProcess (synchrone), Outbox (asynchrone), Realtime (SSE)<br>• Découplage total entre la mutation et ses effets secondaires<br>• Testabilité : tester la mutation + ses handlers séparément |
| **Date** | 2026-06-27 |

### ADR-007 : CQRS limité aux lectures à haute fréquence

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Le statut d'abonnement est lu à chaque requête API (1000 req/s) mais écrit rarement (1/jour). |
| **Décision** | CQRS uniquement pour les lectures avec ratio read/write > 100:1 et sans besoin d'immédiate consistency. |
| **Conséquences** | • SUBSCRIPTION status : CQRS avec cache<br>• ORDER, PRODUCT, INVENTORY : pas de CQRS<br>• ANALYTICS : CQRS avec materialized views |
| **Date** | 2026-06-27 |

### ADR-008 : Route Handler minimal, Service riche

| Attribut | Valeur |
|----------|--------|
| **Contexte** | Les routes Express actuelles contiennent de la logique métier (ex: `activateTenantSub` dans `admin.subscriptions.ts`). |
| **Décision** | Les routes ne contiennent que : validation des entrées, appel à un Application Service, formatage de la réponse. |
| **Conséquences** | • Les routes sont des passe-plats (thin controllers)<br>• Toute la logique métier est dans les Services<br>• Meilleure testabilité (tester les services sans HTTP)<br>• Réutilisable (CLI, jobs, webhooks) |
| **Date** | 2026-06-27 |

---

## 16. FEUILLE DE ROUTE DE MIGRATION

### Phase 0 — Stabilisation Immédiate (Semaine 1)

**Objectif :** Corriger les P0 sans changer l'architecture

| Tâche | Effort | Dépendances |
|-------|--------|-------------|
| Ajouter `invalidateSubscriptionCache()` après chaque mutation | 1 jour | Aucune |
| Unifier les connexions SQLite (middleware utilise le singleton `db`) | 2 jours | Aucune |
| Ajouter l'idempotence sur les routes POST verify/reject | 3 jours | Aucune |
| Remplacer `getSubscriptionStatus()` non awaité par `invalidateSubscriptionCache()` | 1 heure | Aucune |

**Livrable :** Les P0 sont résolus. Le bug "SUBSCRIPTION_REQUIRED après activation" est corrigé.

### Phase 1 — Fondations (Semaines 2-3)

**Objectif :** Mettre en place la structure sans refactoriser tout le code

| Tâche | Effort | Dépendances |
|-------|--------|-------------|
| Créer le dossier `src/domain/` avec la structure des Bounded Contexts | 1 jour | Aucune |
| Définir les interfaces Repository (ports) dans chaque contexte | 2 jours | Phase 0 |
| Extraire `SubscriptionActivationService` | 3 jours | Phase 0 |
| Extraire `VoucherValidationService` | 2 jours | Phase 0 |
| Ajouter structured logging (pino/winston) | 2 jours | Aucune |
| Connecter l'EventBus (existant) aux mutations subscription | 2 jours | Phase 0 |

**Livrable :** Les services métier sont extractés et testables. L'EventBus propage les changements.

### Phase 2 — Synchronisation & Cache (Semaines 4-6)

**Objectif :** Rendre la sync et le cache fiables

| Tâche | Effort | Dépendances |
|-------|--------|-------------|
| Implémenter le Cache Invalidation Contract complet | 3 jours | Phase 1 |
| Ajouter les métriques Prometheus pour le cache et l'outbox | 2 jours | Phase 1 |
| Renforcer le Sync Orchestrator (retry with backoff, monitoring) | 5 jours | Phase 0 |
| Ajouter alerting sur Dead Letter Queue | 2 jours | Phase 1 |
| Implémenter le Read Model pour subscription status | 3 jours | Phase 1 |

**Livrable :** Le cache est invalidé par événement. La sync est monitorée. Les alertes existent.

### Phase 3 — Extraction des Routes (Semaines 7-10)

**Objectif :** Transformer les routes Express en thin controllers

| Tâche | Effort | Dépendances |
|-------|--------|-------------|
| Refactorer `admin.subscriptions.ts` vers ApplicationServices | 5 jours | Phase 1 |
| Refactorer `platform.routes.ts` (tenants CRUD) vers TenantApplicationService | 5 jours | Phase 1 |
| Refactorer `billing.routes.ts` vers BillingApplicationServices | 5 jours | Phase 1 |
| Refactorer `orders.ts` vers OrderApplicationService | 5 jours | Phase 2 |
| Ajouter middleware `idempotencyMiddleware` global | 3 jours | Phase 0 |

**Livrable :** Les routes sont des thin controllers. Les services sont réutilisables.

### Phase 4 — JWT & Auth (Semaines 11-12)

**Objectif :** Retirer le business state du JWT

| Tâche | Effort | Dépendances |
|-------|--------|-------------|
| Retirer `status` et `expires_at` du JWT | 3 jours | Phase 2 (cache fiable) |
| Modifier `GET /auth/me` pour lire le statut depuis le cache | 2 jours | Phase 2 |
| Modifier le frontend `SubscriptionStatus.tsx` pour utiliser `/me` à jour | 3 jours | Phase 2 |
| Ajouter polling ou SSE pour les mises à jour temps réel | 5 jours | Phase 3 |

**Livrable :** Le JWT ne contient que l'identité. Le statut est toujours frais.

### Phase 5 — Observabilité & Production (Semaines 13-16)

**Objectif :** Rendre la plateforme observable et prête pour la production

| Tâche | Effort | Dépendances |
|-------|--------|-------------|
| Ajouter corrélation ID à toutes les requêtes | 2 jours | Phase 1 |
| Exporter les métriques Prometheus | 3 jours | Phase 2 |
| Ajouter dashboard Grafana (cache, sync, business) | 3 jours | Phase 2 |
| Ajouter audit trail complet pour mutations subscription | 3 jours | Phase 3 |
| Load testing (k6) sur le workflow d'activation | 5 jours | Phase 3 |
| Documentation d'architecture (ce document + diagrams) | 3 jours | Toutes les phases |

**Livrable :** La plateforme est observable. Les métriques sont visibles. La documentation est à jour.

### Phase 6 — Scale & Optimisation (Mois 5-6)

**Objectif :** Préparer l'infrastructure pour 1000+ tenants

| Tâche | Effort | Dépendances |
|-------|--------|-------------|
| Remplacer le cache in-memory par Redis | 5 jours | Phase 2 |
| Horizontal scaling : sessions, cache, sync | 10 jours | Phase 5 |
| Migration vers Supabase comme SOT pour le cloud (Render) | 10 jours | Phase 3 |
| Optimisation SQLite (VACUUM, checkpoint, backup) | 5 jours | Phase 5 |
| Documentation ops (runbooks, alerts, DRP) | 5 jours | Phase 5 |

**Livrable :** La plateforme scale horizontalement. Redis est utilisé. Les runbooks existent.

---

## ANNEXE — GLOSSAIRE

| Terme | Définition |
|-------|------------|
| **Aggregate** | Unité de cohérence transactionnelle dans DDD. Groupe d'entités qui doivent être modifiées ensemble. |
| **Bounded Context** | Frontière explicite autour d'un modèle de domaine. Chaque contexte a son propre langage (Ubiquitous Language). |
| **CQRS** | Command Query Responsibility Segregation. Séparation des modèles de lecture et d'écriture. |
| **Domain Event** | Événement qui capture quelque chose qui s'est passé dans le domaine. |
| **Domain Service** | Service qui contient de la logique métier qui n'appartient à aucun Aggregate spécifique. |
| **Outbox** | Table dans SQLite qui stocke les messages à synchroniser vers Supabase. |
| **Port** | Interface définie dans la couche Application, implémentée par un Adapter dans la couche Infrastructure. |
| **Read Model** | Modèle optimisé pour la lecture, mis à jour de manière asynchrone. |
| **Source of Truth** | Système qui fait autorité pour une donnée. En cas de conflit, sa valeur gagne. |
| **Transactional Outbox** | Pattern qui garantit qu'une mutation DB et un message de synchronisation sont atomiques. |
| **Unit of Work** | Objet qui coordonne les transactions et l'émission d'événements. |

---

*Document généré le 27/06/2026. Valide jusqu'au 27/06/2031 ou jusqu'à la prochaine révision architecturale majeure.*