# NOTIFICATION FUNCTIONAL SPECIFICATION (NFS)  
**Version :** 1.0  
**Date :** 29/06/2026  
**Scope :** Vérité métier du système de notifications Ekala  
**Règle :** Aucun code, uniquement spécifications fonctionnelles

---

## 1. VUE D'ENSEMBLE

### 1.1 Objectif

Le système de notifications Ekala a pour objectif d'informer les acteurs d'un restaurant (ou d'une plateforme SaaS) des événements métier importants, via plusieurs canaux (email, SMS, push, in-app, WhatsApp, webhook), en respectant les préférences utilisateur, les règles RBAC, et les contraintes offline-first.

---

### 1.2 Principes métier

| Principe | Description |
|---|---|
| **Event-Driven** | Toutes les notifications sont déclenchées par des événements métier (Domain Events) |
| **Multi-tenant** | Isolation complète entre tenants (restaurants) |
| **Offline-First** | Fonctionne sans connexion, synchronise quand online |
| **Multi-canal** | Email, SMS, Push, WhatsApp, In-App, Webhook |
| **Respect des préférences** | Chaque utilisateur contrôle ses notifications |
| **SLA garanti** | Délais de livraison selon criticité |
| **Traçabilité** | Audit complet de toutes les notifications |

---

### 1.3 Acteurs

| Acteur | Description | Rôles |
|---|---|---|
| **Tenant Owner** | Propriétaire du restaurant | `admin` |
| **Manager** | Gérant du restaurant | `manager` |
| **Cashier** | Caissier | `cashier` |
| **Waiter** | Serveur | `waiter` |
| **Super Admin** | Administrateur plateforme | `super_admin` |
| **Platform Admin** | Admin plateforme | `platform_admin` |
| **Customer** | Client final (via QR code) | `customer` |

---

## 2. ÉVÉNEMENTS MÉTIER (DOMAIN EVENTS)

### 2.1 Inventaire complet

| # | Événement | Bounded Context | Catégorie | Fréquence | Criticité |
|---|---|---|---|---|---|
| 1 | `ProductCreated` | Product Management | Opérationnel | Faible | MOYENNE |
| 2 | `ProductUpdated` | Product Management | Opérationnel | Faible | MOYENNE |
| 3 | `ProductDeleted` | Product Management | Opérationnel | Faible | MOYENNE |
| 4 | `CategoryCreated` | Product Management | Opérationnel | Faible | FAIBLE |
| 5 | `CategoryUpdated` | Product Management | Opérationnel | Faible | FAIBLE |
| 6 | `CategoryDeleted` | Product Management | Opérationnel | Faible | MOYENNE |
| 7 | `StockLow` | Inventory Management | Opérationnel | Continue | ÉLEVÉE |
| 8 | `StockOut` | Inventory Management | Opérationnel | Continue | CRITIQUE |
| 9 | `StockAdjusted` | Inventory Management | Opérationnel | Moyenne | MOYENNE |
| 10 | `StockTransferInitiated` | Inventory Management | Opérationnel | Faible | MOYENNE |
| 11 | `StockTransferCompleted` | Inventory Management | Opérationnel | Faible | MOYENNE |
| 12 | `SaleCompleted` | Sales / POS | Financier | Élevée | MOYENNE |
| 13 | `SaleRefunded` | Sales / Finance | Financier | Faible | ÉLEVÉE |
| 14 | `OrderPlaced` | Order Management | Opérationnel | Élevée | MOYENNE |
| 15 | `OrderAssigned` | Order Management | Opérationnel | Moyenne | MOYENNE |
| 16 | `OrderStatusChanged` | Order Management | Opérationnel | Élevée | MOYENNE |
| 17 | `QROrderReceived` | Order Management / QR | Opérationnel | Moyenne | ÉLEVÉE |
| 18 | `CustomerCreated` | Customer Management | CRM | Moyenne | FAIBLE |
| 19 | `CustomerUpdated` | Customer Management | CRM | Moyenne | FAIBLE |
| 20 | `CustomerDeleted` | Customer Management | CRM | Faible | MOYENNE |
| 21 | `SupplierCreated` | Supplier Management | Approvisionnement | Faible | FAIBLE |
| 22 | `SupplierUpdated` | Supplier Management | Approvisionnement | Faible | FAIBLE |
| 23 | `SupplierDeleted` | Supplier Management | Approvisionnement | Faible | MOYENNE |
| 24 | `PurchaseOrderCreated` | Procurement | Approvisionnement | Faible | MOYENNE |
| 25 | `PurchaseOrderReceived` | Procurement | Approvisionnement | Faible | MOYENNE |
| 26 | `ExpenseCreated` | Finance | Financier | Moyenne | MOYENNE |
| 27 | `ExpenseApproved` | Finance | Financier | Moyenne | MOYENNE |
| 28 | `VoucherGenerated` | Billing / Subscription | SaaS | Faible | ÉLEVÉE |
| 29 | `VoucherExpired` | Billing / Subscription | SaaS | Moyenne | ÉLEVÉE |
| 30 | `PaymentVerified` | Billing / Subscription | SaaS | Faible | ÉLEVÉE |
| 31 | `PaymentRejected` | Billing / Subscription | SaaS | Faible | ÉLEVÉE |
| 32 | `PaymentReceived` | Billing / Finance | Financier | Moyenne | ÉLEVÉE |
| 33 | `SubscriptionCreated` | Subscription / SaaS | SaaS | Faible | ÉLEVÉE |
| 34 | `SubscriptionActivated` | Subscription / SaaS | SaaS | Faible | ÉLEVÉE |
| 35 | `SubscriptionExpired` | Subscription / SaaS | SaaS | Moyenne | ÉLEVÉE |
| 36 | `SubscriptionCancelled` | Subscription / SaaS | SaaS | Faible | ÉLEVÉE |
| 37 | `SubscriptionGracePeriodStarted` | Subscription / SaaS | SaaS | Moyenne | ÉLEVÉE |
| 38 | `SubscriptionPaymentFailed` | Billing / Subscription | SaaS | Moyenne | CRITIQUE |
| 39 | `TenantCreated` | SaaS Platform | Platform | Très faible | ÉLEVÉE |
| 40 | `TenantSuspended` | SaaS Platform | Platform | Très faible | CRITIQUE |
| 41 | `BranchCreated` | Tenant Management | Opérationnel | Faible | FAIBLE |
| 42 | `UserCreated` | Identity / IAM | Sécurité | Faible | MOYENNE |
| 43 | `UserInvited` | Identity / IAM | Sécurité | Faible | ÉLEVÉE |
| 44 | `UserRoleChanged` | Identity / IAM | Sécurité | Faible | ÉLEVÉE |
| 45 | `UserDeactivated` | Identity / IAM | Sécurité | Faible | ÉLEVÉE |
| 46 | `PasswordResetRequested` | Identity / IAM | Sécurité | Faible | ÉLEVÉE |
| 47 | `PasswordResetCompleted` | Identity / IAM | Sécurité | Faible | MOYENNE |
| 48 | `PINResetRequested` | Identity / IAM | Sécurité | Faible | ÉLEVÉE |
| 49 | `UserLoggedIn` | Identity / IAM | Sécurité | Élevée | FAIBLE |
| 50 | `UserLoggedOut` | Identity / IAM | Sécurité | Élevée | FAIBLE |
| 51 | `SystemError` | Platform / Infrastructure | Infrastructure | Très faible | CRITIQUE |
| 52 | `DatabaseConnectionLost` | Infrastructure | Infrastructure | Très faible | CRITIQUE |
| 53 | `SyncFailureDetected` | Data Synchronization | Infrastructure | Faible | ÉLEVÉE |
| 54 | `PlatformHealthCheckFailed` | Platform / Infrastructure | Infrastructure | Très faible | CRITIQUE |

---

### 2.2 Catégorisation

**Opérationnel (28 événements) :**
- Product, Category, Stock, Order, Customer, Supplier, Purchase Order, Expense, Branch

**Financier (5 événements) :**
- SaleCompleted, SaleRefunded, PaymentReceived, ExpenseCreated, ExpenseApproved

**SaaS / Billing (8 événements) :**
- VoucherGenerated, VoucherExpired, PaymentVerified, PaymentRejected, SubscriptionCreated, SubscriptionActivated, SubscriptionExpired, SubscriptionCancelled, SubscriptionGracePeriodStarted, SubscriptionPaymentFailed

**Sécurité (8 événements) :**
- UserCreated, UserInvited, UserRoleChanged, UserDeactivated, PasswordResetRequested, PasswordResetCompleted, PINResetRequested, UserLoggedIn, UserLoggedOut

**Infrastructure (4 événements) :**
- SystemError, DatabaseConnectionLost, SyncFailureDetected, PlatformHealthCheckFailed

**Platform (2 événements) :**
- TenantCreated, TenantSuspended

---

## 3. PRIORITÉS

### 3.1 Niveaux de priorité

| Priorité | Description | SLA Delivery | Retry | Canaux par défaut |
|---|---|---|---|---|
| **critical** | Impact business majeur, action requise immédiatement | < 30 secondes | 5 tentatives (backoff exponentiel) | Email + SMS + Push + In-App |
| **high** | Impact important, action requise dans l'heure | < 2 minutes | 3 tentatives (backoff exponentiel) | Email + In-App |
| **medium** | Information importante, action requise dans la journée | < 15 minutes | 2 tentatives (backoff linéaire) | Email + In-App |
| **low** | Information générale, pas d'action requise | < 1 heure | 1 tentative (pas de retry) | Email uniquement |

---

### 3.2 Matrice de priorité par événement

| Événement | Priorité | Justification |
|---|---|---|
| `StockOut` | critical | Vente impossible, perte de revenu |
| `SubscriptionPaymentFailed` | critical | Perte d'accès, churn |
| `TenantSuspended` | critical | Perte d'accès, churn |
| `SystemError` | critical | Service down |
| `DatabaseConnectionLost` | critical | Service down |
| `PlatformHealthCheckFailed` | critical | Service down |
| `StockLow` | high | Risque de rupture |
| `VoucherExpired` | high | Client perd accès |
| `PaymentVerified` | high | Activation immédiate |
| `PaymentRejected` | high | Échec = frustration |
| `SubscriptionExpired` | high | Perte d'accès |
| `SubscriptionGracePeriodStarted` | high | Avertissement |
| `SyncFailureDetected` | high | Données désynchronisées |
| `QROrderReceived` | high | Nouvelle vente |
| `SaleCompleted` | medium | Traçabilité |
| `OrderCheckoutCompleted` | medium | Traçabilité |
| `ProductCreated` | medium | Information |
| `ProductStockUpdated` | medium | Audit |
| `UserInvited` | high | Onboarding |
| `PasswordResetRequested` | high | Sécurité |
| `UserRoleChanged` | high | Sécurité |
| `UserDeactivated` | high | Sécurité |
| `TenantCreated` | high | Nouveau revenu |
| `SubscriptionCreated` | high | Onboarding |
| `SubscriptionActivated` | high | Déblocage |
| `VoucherGenerated` | high | Activation |
| `PaymentReceived` | high | Encaissement |
| `CategoryCreated` | low | Information |
| `SupplierCreated` | low | Information |
| `CustomerCreated` | low | Information |
| `BranchCreated` | low | Information |
| `UserLoggedIn` | low | Sécurité (audit) |
| `UserLoggedOut` | low | Sécurité (audit) |
| `DailySalesReportGenerated` | low | Insight |
| `WeeklySalesReportGenerated` | low | Insight |
| `MonthlySalesReportGenerated` | low | Insight |

---

## 4. DESTINATAIRES

### 4.1 Règles générales

**Principe :** Une notification est envoyée à un ou plusieurs destinataires selon :
1. Les **préférences utilisateur** (opt-in/opt-out par canal et événement)
2. Les **règles de notification** (RBAC, conditions, actions)
3. Le **rôle** de l'utilisateur (admin, manager, cashier, waiter)
4. Le **tenant** (isolation multi-tenant)
5. La **branche** (si applicable)

---

### 4.2 Destinataires par événement

#### 4.2.1 Événements Produit

| Événement | Destinataires principaux | Conditions |
|---|---|---|
| `ProductCreated` | admin, manager du tenant | Si `notifyNewProduct` activé dans préférences |
| `ProductUpdated` | admin, manager du tenant | Si `notifyProductUpdated` activé |
| `ProductDeleted` | admin, manager du tenant | Si `notifyProductDeleted` activé |
| `CategoryCreated` | admin, manager du tenant | Si `notifyCategoryCreated` activé |
| `CategoryUpdated` | admin, manager du tenant | Si `notifyCategoryUpdated` activé |
| `CategoryDeleted` | admin, manager du tenant | Si `notifyCategoryDeleted` activé |

---

#### 4.2.2 Événements Stock

| Événement | Destinataires principaux | Conditions |
|---|---|---|
| `StockLow` | admin, manager du tenant | Si `notifyLowStock` activé |
| `StockOut` | admin, manager du tenant | Si `notifyOutOfStock` activé |
| `StockAdjusted` | admin, manager du tenant | Si `notifyStockAdj` activé |
| `StockTransferInitiated` | admin, manager (source + destination) | Si `notifyStockTransfer` activé |
| `StockTransferCompleted` | admin, manager (source + destination) | Si `notifyStockTransfer` activé |

---

#### 4.2.3 Événements Vente

| Événement | Destinataires principaux | Conditions |
|---|---|---|
| `SaleCompleted` | admin, manager, cashier | Si `notifySales` activé |
| `SaleRefunded` | admin, manager | Si `notifyRefund` activé |

---

#### 4.2.4 Événements Commande

| Événement | Destinataires principaux | Conditions |
|---|---|---|
| `OrderPlaced` | cashier, waiter, admin | Si `notifyOrderPlaced` activé |
| `OrderAssigned` | waiter (assigné) | Si `notifyOrderAssigned` activé |
| `OrderStatusChanged` | cashier, waiter, admin | Si `notifyOrderStatus` activé |
| `QROrderReceived` | cashier, waiter, admin | Si `notifyQROrder` activé |

---

#### 4.2.5 Événements CRM

| Événement | Destinataires principaux | Conditions |
|---|---|---|
| `CustomerCreated` | admin, manager | Si `notifyCustomerCreated` activé |
| `CustomerUpdated` | admin, manager | Si `notifyCustomerUpdated` activé |
| `CustomerDeleted` | admin, manager | Si `notifyCustomerDeleted` activé |
| `SupplierCreated` | admin, manager | Si `notifySupplierCreated` activé |
| `SupplierUpdated` | admin, manager | Si `notifySupplierUpdated` activé |
| `SupplierDeleted` | admin, manager | Si `notifySupplierDeleted` activé |
| `PurchaseOrderCreated` | admin, manager | Si `notifyPurchaseOrder` activé |
| `PurchaseOrderReceived` | admin, manager | Si `notifyPurchaseOrder` activé |

---

#### 4.2.6 Événements Financiers

| Événement | Destinataires principaux | Conditions |
|---|---|---|
| `ExpenseCreated` | admin, manager | Si `notifyExpenseCreated` activé |
| `ExpenseApproved` | admin, manager | Si `notifyExpenseApproved` activé |
| `PaymentReceived` | admin, manager, tenant owner | Si `notifyPaymentReceived` activé |

---

#### 4.2.7 Événements SaaS / Billing

| Événement | Destinataires principaux | Conditions |
|---|---|---|
| `VoucherGenerated` | customer (email explicite) | Toujours envoyé (pas de préférence) |
| `VoucherExpired` | customer (email explicite) | Toujours envoyé (pas de préférence) |
| `PaymentVerified` | tenant owner (email explicite) | Toujours envoyé (pas de préférence) |
| `PaymentRejected` | tenant owner (email explicite) | Toujours envoyé (pas de préférence) |
| `SubscriptionCreated` | tenant owner (email explicite) | Si `notifySubscription` activé |
| `SubscriptionActivated` | tenant owner (email explicite) | Si `notifySubscription` activé |
| `SubscriptionExpired` | tenant owner (email explicite) | Si `notifySubscription` activé |
| `SubscriptionCancelled` | tenant owner (email explicite) | Si `notifySubscription` activé |
| `SubscriptionGracePeriodStarted` | tenant owner (email explicite) | Si `notifySubscription` activé |
| `SubscriptionPaymentFailed` | tenant owner (email explicite) | Si `notifySubscription` activé |

---

#### 4.2.8 Événements Platform

| Événement | Destinataires principaux | Conditions |
|---|---|---|
| `TenantCreated` | super_admin, platform_admin | Toujours envoyé |
| `TenantSuspended` | tenant owner (email explicite) + super_admin | Toujours envoyé |
| `BranchCreated` | admin, manager du tenant | Si `notifyBranchCreated` activé |

---

#### 4.2.9 Événements Identité

| Événement | Destinataires principaux | Conditions |
|---|---|---|
| `UserCreated` | user créé (email explicite) | Si `notifyUserCreated` activé |
| `UserInvited` | user invité (email explicite) | Toujours envoyé |
| `UserRoleChanged` | user (email explicite) + admin | Si `notifyUserRoleChanged` activé |
| `UserDeactivated` | user (email explicite) + admin | Si `notifyUserDeactivated` activé |
| `PasswordResetRequested` | user (email explicite) | Toujours envoyé |
| `PasswordResetCompleted` | user (email explicite) | Si `notifyPasswordReset` activé |
| `PINResetRequested` | user (email explicite) | Toujours envoyé |
| `UserLoggedIn` | super_admin (si suspicious) | Si `notifySuspiciousLogin` activé |
| `UserLoggedOut` | Aucun | Pas de notification |

---

#### 4.2.10 Événements Infrastructure

| Événement | Destinataires principaux | Conditions |
|---|---|---|
| `SystemError` | super_admin, platform_admin | Toujours envoyé |
| `DatabaseConnectionLost` | super_admin, platform_admin | Toujours envoyé |
| `SyncFailureDetected` | super_admin, platform_admin | Si `notifySyncFailure` activé |
| `PlatformHealthCheckFailed` | super_admin, platform_admin | Toujours envoyé |

---

## 5. RÈGLES DE NOTIFICATION

### 5.1 Règles par défaut (legacy)

**Format :** JSON stocké dans `settings.role_notification_config`

```json
{
  "admin": {
    "notifications": {
      "lowStock": true,
      "outOfStock": true,
      "sales": true,
      "newProduct": true,
      "stockAdj": true,
      "inventory": true,
      "orderConfirm": true,
      "refund": true,
      "expense": true,
      "subscription": true,
      "qrOrder": true
    }
  },
  "manager": {
    "notifications": {
      "lowStock": true,
      "outOfStock": true,
      "sales": true,
      "newProduct": true,
      "stockAdj": true,
      "inventory": true,
      "orderConfirm": true
    }
  },
  "cashier": {
    "notifications": {
      "sales": true,
      "orderConfirm": true,
      "qrOrder": true
    }
  },
  "waiter": {
    "notifications": {
      "orderConfirm": true,
      "orderAssigned": true,
      "qrOrder": true
    }
  }
}
```

---

### 5.2 Règles avancées (NotificationRule)

**Format :** JSON stocké dans `notification_rules` table

```json
{
  "ruleId": "uuid",
  "tenantId": 123,
  "name": "Notify admins on low stock",
  "eventType": "StockLow",
  "priority": 100,
  "enabled": true,
  "conditions": [
    {
      "type": "role_in",
      "values": ["admin", "manager"]
    },
    {
      "type": "tenant_id_eq",
      "value": 123
    }
  ],
  "actions": [
    {
      "type": "send_email",
      "template": "LowStockAlert",
      "recipients": "dynamic"
    },
    {
      "type": "send_inapp",
      "template": "LowStockAlertInApp"
    }
  ]
}
```

---

### 5.3 Moteur de règles

**Algorithme :**
```
1. Récupérer toutes les règles actives pour (tenantId, eventType)
2. Trier par priority DESC
3. Pour chaque règle :
   a. Évaluer les conditions
   b. Si match : exécuter les actions (short-circuit)
   c. Si pas match : continuer
4. Si aucune règle ne match : fallback sur role_notification_config (legacy)
```

---

## 6. SLA (SERVICE LEVEL AGREEMENT)

### 6.1 Délais de livraison

| Priorité | Délai cible | Délai maximum | Retry |
|---|---|---|---|
| **critical** | < 30 secondes | 1 minute | 5 tentatives (1s, 2s, 4s, 8s, 16s) |
| **high** | < 2 minutes | 5 minutes | 3 tentatives (1s, 2s, 4s) |
| **medium** | < 15 minutes | 30 minutes | 2 tentatives (5s, 5s) |
| **low** | < 1 heure | 2 heures | 1 tentative (pas de retry) |

---

### 6.2 Disponibilité

| Canal | Disponibilité cible | Justification |
|---|---|---|
| **In-App** | 99.9% | Dépend de Supabase Realtime |
| **Email** | 99.5% | Dépend de SMTP provider (Gmail, Resend, SES) |
| **SMS** | 99.0% | Dépend de Twilio/AfricasTalking |
| **Push** | 99.0% | Dépend de FCM/Expo |
| **WhatsApp** | 99.0% | Dépend de Twilio WhatsApp API |
| **Webhook** | 99.0% | Dépend du endpoint externe |

---

### 6.3 Fiabilité

| Métrique | Cible | Mesure |
|---|---|---|
| **Delivery Rate** | 99.5% | (delivered - bounced) / sent |
| **Retry Success Rate** | 80% | retry_success / retry_total |
| **DLQ Rate** | < 0.1% | dlq_jobs / sent_jobs |
| **Duplicate Rate** | < 0.01% | duplicates / sent |

---

### 6.4 Monitoring SLA

**Alertes :**
- Delivery time > SLA pendant 5 min → PagerDuty (critical)
- Delivery rate < 99% pendant 15 min → Slack #alerts
- DLQ > 100 jobs → Email aux super_admins
- Queue lag > 1000 jobs → Email aux super_admins

---

## 7. COMPORTEMENT OFFLINE

### 7.1 Stratégie offline

**Principe :** Le système fonctionne intégralement en local (SQLite) sans connexion.

**Règles :**
1. Toutes les écritures vont dans SQLite (outbox local)
2. Les lectures se font depuis SQLite
3. La sync vers Supabase est asynchrone (quand online)
4. Pas de blocage sur indisponibilité réseau
5. Cohérence éventuelle (eventual consistency)

---

### 7.2 Comportement par canal (offline)

| Canal | Comportement offline | Livraison |
|---|---|---|
| **In-App** | ✅ Fonctionne | Immédiate (SQLite local) |
| **Email** | ⏸️ Queue dans outbox | Quand online (BullMQ worker) |
| **SMS** | ⏸️ Queue dans outbox | Quand online (BullMQ worker) |
| **Push** | ⏸️ Queue dans outbox | Quand online (BullMQ worker) |
| **WhatsApp** | ⏸️ Queue dans outbox | Quand online (BullMQ worker) |
| **Webhook** | ⏸️ Queue dans outbox | Quand online (BullMQ worker) |

---

### 7.3 Outbox Pattern

**Table :** `notification_outbox`

```sql
CREATE TABLE notification_outbox (
  id UUID PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, synced, failed
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP,
  
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_created_at (created_at ASC)
);
```

**Workflow :**
1. Business event se produit
2. Notification créée dans `notifications` (SQLite)
3. Event inséré dans `notification_outbox` (même transaction)
4. Sync Engine lit l'outbox et sync vers Supabase (quand online)
5. Si sync échoue → retry (backoff exponentiel)
6. Si max retries atteint → Dead Letter Queue

---

### 7.4 Inbox Pattern

**Table :** `inbox`

```sql
CREATE TABLE inbox (
  id UUID PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  notification_id UUID NOT NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL,
  title TEXT,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  sync_status TEXT DEFAULT 'pending', -- pending, synced, conflict
  
  INDEX idx_user_tenant (user_id, tenant_id),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_is_read (is_read)
);
```

**Workflow :**
1. Notification créée → insérée dans `inbox` (SQLite)
2. Affichée immédiatement dans l'UI (pas besoin d'attendre le serveur)
3. Sync Engine synchronise vers Supabase (quand online)
4. Si conflit → Last-Write-Wins (Lamport clock)

---

## 8. PRÉFÉRENCES UTILISATEUR

### 8.1 Modèle de préférences

**Par utilisateur :**
- Canaux activés (email, sms, push, inapp, whatsapp)
- Fréquence (instant, daily_digest, weekly_digest)
- Heures silencieuses (QuietHours : début, fin)
- Filtres par type d'événement (opt-in/opt-out)

**Par tenant (defaults) :**
- Canaux par défaut
- Fréquence par défaut
- Heures silencieuses par défaut
- `role_notification_config` (legacy)

**Par rôle (RBAC) :**
- Quels types de notifications un rôle peut recevoir
- Quels canaux sont autorisés pour un rôle

---

### 8.2 Moteur de préférences

**Algorithme :**
```
1. Charger préférences utilisateur (userId + tenantId)
2. Charger préférences tenant (tenantId)
3. Charger préférences rôle (role)
4. Fusionner (user > tenant > role > global default)
5. Appliquer QuietHours (sauf critical)
6. Retourner canaux autorisés + fréquence
```

---

## 9. TEMPLATES

### 9.1 Canaux supportés

| Canal | Format | Taille limite | Exemple |
|---|---|---|---|
| **Email** | HTML (MJML) | Illimitée | Newsletter, alertes détaillées |
| **SMS** | Texte brut | 160 caractères | Alertes courtes |
| **Push** | JSON (title, body, data) | 200 caractères (title) | Notifications mobiles |
| **WhatsApp** | Texte + boutons | 4096 caractères | Support client |
| **In-App** | JSON (title, body, link) | Illimitée | NotificationCenter |
| **Webhook** | JSON | Illimitée | Intégrations externes |

---

### 9.2 Variables disponibles

**Globales :**
- `{{appName}}` : Nom de l'app (ex: "Ekala")
- `{{appUrl}}` : URL de l'app
- `{{tenantName}}` : Nom du tenant
- `{{userName}}` : Nom de l'utilisateur
- `{{userEmail}}` : Email de l'utilisateur
- `{{currentDate}}` : Date actuelle
- `{{currentTime}}` : Heure actuelle

**Spécifiques :**
- `{{productName}}` : Nom du produit
- `{{productPrice}}` : Prix du produit
- `{{orderId}}` : ID de la commande
- `{{saleAmount}}` : Montant de la vente
- `{{voucherCode}}` : Code voucher
- `{{voucherExpiryDate}}` : Date d'expiration

---

## 10. OBSERVABILITÉ

### 10.1 Logs

**Format :** JSON structuré

**Champs :**
- `timestamp`
- `level` (info, warn, error)
- `tenant_id`
- `notification_id`
- `delivery_id`
- `channel`
- `event_type`
- `user_id`
- `trace_id` (corrélation)
- `lamport_clock` (pour ordre)
- `origin_node` (pour debug)

---

### 10.2 Métriques

**Volume :**
- `notifications_created_total` (by tenant, channel, event_type)
- `notifications_sent_total` (by tenant, channel, event_type)
- `notifications_delivered_total` (by tenant, channel, event_type)
- `notifications_failed_total` (by tenant, channel, event_type)
- `notifications_read_total` (by tenant, event_type)

**Performance :**
- `notification_creation_time_ms` (histogram)
- `notification_dispatch_time_ms` (histogram)
- `notification_delivery_time_ms` (histogram)
- `queue_wait_time_ms` (histogram)
- `template_render_time_ms` (histogram)
- `sync_duration_ms` (local → cloud)

**Qualité :**
- `delivery_rate` (delivered / sent)
- `open_rate` (opened / delivered) — email uniquement
- `click_rate` (clicked / opened) — email uniquement
- `bounce_rate` (bounced / sent) — email uniquement
- `retry_rate` (retried / failed)
- `dlq_rate` (dlq / sent)

**Business :**
- `notifications_per_user` (moyenne)
- `notifications_per_tenant` (moyenne)
- `preferences_opt_out_rate` (by event_type)
- `channel_usage_distribution` (email vs sms vs push vs inapp)

---

### 10.3 Audit Logs

**Table :** `notification_audit_logs`

**Events à logger :**
- NotificationCreated, Sent, Delivered, Failed, Read, Deleted
- PreferenceUpdated, RuleCreated/Updated/Deleted
- TemplateCreated/Updated/Deprecated

---

## 11. SÉCURITÉ

### 11.1 Multi-Tenant Isolation

**Règles :**
- Toutes les requêtes sont scoped par `tenant_id`
- Vérification à chaque couche (middleware → service → repository)
- Pas de requête cross-tenant possible

---

### 11.2 RBAC

**Règles :**
- Un utilisateur ne peut créer des notifications que pour son tenant
- Un utilisateur ne peut voir que ses propres notifications
- Un super_admin peut voir toutes les notifications (cross-tenant)
- Les règles de notification sont validées par RBACPolicy

---

### 11.3 Authentification (Canaux)

| Canal | Sécurité |
|---|---|
| **Email** | SPF, DKIM, DMARC |
| **SMS** | Numéros vérifiés |
| **Push** | Device tokens signés |
| **Webhook** | HMAC-SHA256 signature |
| **WhatsApp** | WhatsApp Business API |

---

## 12. EXTENSIBILITÉ

### 12.1 Canaux futurs

| Canal | Statut | Priorité |
|---|---|---|
| **Email** | Actuel | ✅ |
| **In-App** | Actuel | ✅ |
| **SMS** | Futur | 🔄 |
| **Push** | Futur | 🔄 |
| **WhatsApp** | Futur | 🔄 |
| **Webhook** | Futur | 🔄 |
| **AI Agents** | Futur | 🔄 |

---

### 12.2 Ajouter un nouveau canal

**Étapes :**
1. Créer `XxxChannelProvider` (implémente `IChannelProvider`)
2. Ajouter `xxx` à l'enum `ChannelType`
3. Enregistrer le provider dans `NotificationProvider`
4. Ajouter le template dans `templates/xxx/`
5. Mettre à jour les préférences utilisateur

**Aucune modification du domaine métier.**

---

## 13. GLOSSAIRE

| Terme | Définition |
|---|---|
| **Domain Event** | Événement métier qui déclenche une notification |
| **Aggregate** | Objet métier avec invariants (Notification, Template, Preference, Rule) |
| **Channel** | Moyen de livraison (email, sms, push, inapp, whatsapp, webhook) |
| **Delivery** | Tentative d'envoi d'une notification via un canal |
| **Inbox** | Liste des notifications pour un utilisateur |
| **Outbox** | Queue locale des notifications à synchroniser |
| **RBAC** | Role-Based Access Control (contrôle d'accès par rôle) |
| **SLA** | Service Level Agreement (accord de niveau de service) |
| **DLQ** | Dead Letter Queue (file des jobs échoués) |
| **CQRS** | Command Query Responsibility Segregation (séparation écriture/lecture) |
| **DDD** | Domain-Driven Design (conception pilotée par le domaine) |
| **LWW** | Last-Write-Wins (dernière écriture gagne) |

---

## 14. RÉFÉRENCES

- `docs/AUDIT_NOTIFICATION_SYSTEM.md` — Audit initial
- `docs/AUDIT_NOTIFICATION_SYSTEM_V2_FORENSIC.md` — Audit forensique
- `docs/AUDIT_NOTIFICATION_DOMAIN_EVENTS.md` — Catalogue des événements
- `docs/ARCHITECTURE_NOTIFICATION_DOMAIN_V2_IDEAL.md` — Architecture cible V2
- `docs/ARCHITECTURE_NOTIFICATION_DOMAIN_V3_OFFLINE_FIRST.md` — Architecture cible V3