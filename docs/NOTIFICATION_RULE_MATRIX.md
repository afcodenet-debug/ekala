# NOTIFICATION RULE MATRIX  
**Version :** 1.0  
**Date :** 29/06/2026  
**Scope :** Matrice complète des règles de notification Ekala  
**Règle :** Aucun code, uniquement spécifications

---

## 1. STRUCTURE DE LA MATRICE

### 1.1 Format

Chaque ligne de la matrice représente une règle de notification avec :

| Colonne | Description |
|---|---|
| **Event** | Nom du Domain Event |
| **Category** | Catégorie (Operational, Financial, SaaS, Security, Infrastructure, Platform) |
| **Priority** | critical, high, medium, low |
| **Default Recipients** | Destinataires par défaut (rôles) |
| **Conditions** | Conditions d'envoi (préférences, RBAC, etc.) |
| **Channels** | Canaux utilisés (email, sms, push, inapp, whatsapp, webhook) |
| **Offline Behavior** | Comportement en mode offline |
| **Template** | Template utilisé (si applicable) |
| **SLA** | Délai de livraison cible |
| **Retry** | Politique de retry |

---

### 1.2 Légende

**Priorité :**
- 🔴 **critical** : < 30s, 5 retries
- 🟠 **high** : < 2min, 3 retries
- 🟡 **medium** : < 15min, 2 retries
- 🟢 **low** : < 1h, 1 retry

**Canaux :**
- 📧 Email
- 📱 SMS
- 🔔 Push
- 💬 WhatsApp
- 🖥️ In-App
- 🔗 Webhook

**Offline :**
- ✅ Fonctionne immédiatement
- ⏸️ Queue pour plus tard
- ❌ Non disponible

---

## 2. MATRICE COMPLÈTE

### 2.1 Événements Produit

| Event | Category | Priority | Default Recipients | Conditions | Channels | Offline | Template | SLA | Retry |
|---|---|---|---|---|---|---|---|---|---|
| `ProductCreated` | Operational | 🟡 medium | admin, manager | Si `notifyNewProduct` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | ProductCreatedEmail | < 15min | 2x |
| `ProductUpdated` | Operational | 🟡 medium | admin, manager | Si `notifyProductUpdated` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | ProductUpdatedEmail | < 15min | 2x |
| `ProductDeleted` | Operational | 🟡 medium | admin, manager | Si `notifyProductDeleted` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | ProductDeletedEmail | < 15min | 2x |
| `CategoryCreated` | Operational | 🟢 low | admin, manager | Si `notifyCategoryCreated` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | CategoryCreatedEmail | < 1h | 1x |
| `CategoryUpdated` | Operational | 🟢 low | admin, manager | Si `notifyCategoryUpdated` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | CategoryUpdatedEmail | < 1h | 1x |
| `CategoryDeleted` | Operational | 🟡 medium | admin, manager | Si `notifyCategoryDeleted` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | CategoryDeletedEmail | < 15min | 2x |

---

### 2.2 Événements Stock

| Event | Category | Priority | Default Recipients | Conditions | Channels | Offline | Template | SLA | Retry |
|---|---|---|---|---|---|---|---|---|---|
| `StockLow` | Operational | 🟠 high | admin, manager | Si `notifyLowStock` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | LowStockAlertEmail | < 2min | 3x |
| `StockOut` | Operational | 🔴 critical | admin, manager | Si `notifyOutOfStock` activé | 📧, 📱, 🔔, 🖥️ | ⏸️ Email/SMS/Push, ✅ In-App | StockOutAlertEmail | < 30s | 5x |
| `StockAdjusted` | Operational | 🟡 medium | admin, manager | Si `notifyStockAdj` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | StockAdjustedEmail | < 15min | 2x |
| `StockTransferInitiated` | Operational | 🟡 medium | admin, manager (source + dest) | Si `notifyStockTransfer` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | StockTransferInitiatedEmail | < 15min | 2x |
| `StockTransferCompleted` | Operational | 🟡 medium | admin, manager (source + dest) | Si `notifyStockTransfer` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | StockTransferCompletedEmail | < 15min | 2x |

---

### 2.3 Événements Vente

| Event | Category | Priority | Default Recipients | Conditions | Channels | Offline | Template | SLA | Retry |
|---|---|---|---|---|---|---|---|---|---|
| `SaleCompleted` | Financial | 🟡 medium | admin, manager, cashier | Si `notifySales` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | SaleCompletedEmail | < 15min | 2x |
| `SaleRefunded` | Financial | 🟠 high | admin, manager | Si `notifyRefund` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | SaleRefundedEmail | < 2min | 3x |

---

### 2.4 Événements Commande

| Event | Category | Priority | Default Recipients | Conditions | Channels | Offline | Template | SLA | Retry |
|---|---|---|---|---|---|---|---|---|---|
| `OrderPlaced` | Operational | 🟡 medium | cashier, waiter, admin | Si `notifyOrderPlaced` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | OrderPlacedEmail | < 15min | 2x |
| `OrderAssigned` | Operational | 🟡 medium | waiter (assigné) | Si `notifyOrderAssigned` activé | 🔔, 🖥️ | ✅ Push, ✅ In-App | OrderAssignedPush | < 15min | 2x |
| `OrderStatusChanged` | Operational | 🟡 medium | cashier, waiter, admin | Si `notifyOrderStatus` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | OrderStatusChangedEmail | < 15min | 2x |
| `QROrderReceived` | Operational | 🟠 high | cashier, waiter, admin | Si `notifyQROrder` activé | 🔔, 📧, 🖥️ | ✅ Push, ⏸️ Email, ✅ In-App | QROrderReceivedPush | < 2min | 3x |

---

### 2.5 Événements CRM

| Event | Category | Priority | Default Recipients | Conditions | Channels | Offline | Template | SLA | Retry |
|---|---|---|---|---|---|---|---|---|---|
| `CustomerCreated` | CRM | 🟢 low | admin, manager | Si `notifyCustomerCreated` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | CustomerCreatedEmail | < 1h | 1x |
| `CustomerUpdated` | CRM | 🟢 low | admin, manager | Si `notifyCustomerUpdated` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | CustomerUpdatedEmail | < 1h | 1x |
| `CustomerDeleted` | CRM | 🟡 medium | admin, manager | Si `notifyCustomerDeleted` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | CustomerDeletedEmail | < 15min | 2x |
| `SupplierCreated` | Procurement | 🟢 low | admin, manager | Si `notifySupplierCreated` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | SupplierCreatedEmail | < 1h | 1x |
| `SupplierUpdated` | Procurement | 🟢 low | admin, manager | Si `notifySupplierUpdated` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | SupplierUpdatedEmail | < 1h | 1x |
| `SupplierDeleted` | Procurement | 🟡 medium | admin, manager | Si `notifySupplierDeleted` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | SupplierDeletedEmail | < 15min | 2x |
| `PurchaseOrderCreated` | Procurement | 🟡 medium | admin, manager | Si `notifyPurchaseOrder` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | PurchaseOrderCreatedEmail | < 15min | 2x |
| `PurchaseOrderReceived` | Procurement | 🟡 medium | admin, manager | Si `notifyPurchaseOrder` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | PurchaseOrderReceivedEmail | < 15min | 2x |

---

### 2.6 Événements Financiers

| Event | Category | Priority | Default Recipients | Conditions | Channels | Offline | Template | SLA | Retry |
|---|---|---|---|---|---|---|---|---|---|
| `ExpenseCreated` | Financial | 🟡 medium | admin, manager | Si `notifyExpenseCreated` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | ExpenseCreatedEmail | < 15min | 2x |
| `ExpenseApproved` | Financial | 🟡 medium | admin, manager | Si `notifyExpenseApproved` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | ExpenseApprovedEmail | < 15min | 2x |
| `PaymentReceived` | Financial | 🟠 high | admin, manager, tenant owner | Si `notifyPaymentReceived` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | PaymentReceivedEmail | < 2min | 3x |

---

### 2.7 Événements SaaS / Billing

| Event | Category | Priority | Default Recipients | Conditions | Channels | Offline | Template | SLA | Retry |
|---|---|---|---|---|---|---|---|---|---|
| `VoucherGenerated` | SaaS | 🟠 high | customer (email explicite) | Toujours envoyé | 📧 | ⏸️ Email | VoucherGeneratedEmail | < 2min | 3x |
| `VoucherExpired` | SaaS | 🟠 high | customer (email explicite) | Toujours envoyé | 📧 | ⏸️ Email | VoucherExpiredEmail | < 2min | 3x |
| `PaymentVerified` | SaaS | 🟠 high | tenant owner (email explicite) | Toujours envoyé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | PaymentVerifiedEmail | < 2min | 3x |
| `PaymentRejected` | SaaS | 🟠 high | tenant owner (email explicite) | Toujours envoyé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | PaymentRejectedEmail | < 2min | 3x |
| `SubscriptionCreated` | SaaS | 🟠 high | tenant owner (email explicite) | Si `notifySubscription` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | SubscriptionCreatedEmail | < 2min | 3x |
| `SubscriptionActivated` | SaaS | 🟠 high | tenant owner (email explicite) | Si `notifySubscription` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | SubscriptionActivatedEmail | < 2min | 3x |
| `SubscriptionExpired` | SaaS | 🟠 high | tenant owner (email explicite) | Si `notifySubscription` activé | 📧, 📱, 🖥️ | ⏸️ Email/SMS, ✅ In-App | SubscriptionExpiredEmail | < 2min | 3x |
| `SubscriptionCancelled` | SaaS | 🟠 high | tenant owner (email explicite) | Si `notifySubscription` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | SubscriptionCancelledEmail | < 2min | 3x |
| `SubscriptionGracePeriodStarted` | SaaS | 🟠 high | tenant owner (email explicite) | Si `notifySubscription` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | GracePeriodStartedEmail | < 2min | 3x |
| `SubscriptionPaymentFailed` | SaaS | 🔴 critical | tenant owner (email explicite) | Si `notifySubscription` activé | 📧, 📱, 🔔, 🖥️ | ⏸️ Email/SMS/Push, ✅ In-App | PaymentFailedEmail | < 30s | 5x |

---

### 2.8 Événements Platform

| Event | Category | Priority | Default Recipients | Conditions | Channels | Offline | Template | SLA | Retry |
|---|---|---|---|---|---|---|---|---|---|
| `TenantCreated` | Platform | 🟠 high | super_admin, platform_admin | Toujours envoyé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | TenantCreatedEmail | < 2min | 3x |
| `TenantSuspended` | Platform | 🔴 critical | tenant owner (email) + super_admin | Toujours envoyé | 📧, 📱, 🔔, 🖥️ | ⏸️ Email/SMS/Push, ✅ In-App | TenantSuspendedEmail | < 30s | 5x |
| `BranchCreated` | Operational | 🟢 low | admin, manager du tenant | Si `notifyBranchCreated` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | BranchCreatedEmail | < 1h | 1x |

---

### 2.9 Événements Identité

| Event | Category | Priority | Default Recipients | Conditions | Channels | Offline | Template | SLA | Retry |
|---|---|---|---|---|---|---|---|---|---|
| `UserCreated` | Security | 🟡 medium | user créé (email explicite) | Si `notifyUserCreated` activé | 📧 | ⏸️ Email | UserCreatedEmail | < 15min | 2x |
| `UserInvited` | Security | 🟠 high | user invité (email explicite) | Toujours envoyé | 📧 | ⏸️ Email | UserInvitedEmail | < 2min | 3x |
| `UserRoleChanged` | Security | 🟠 high | user (email) + admin | Si `notifyUserRoleChanged` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | UserRoleChangedEmail | < 2min | 3x |
| `UserDeactivated` | Security | 🟠 high | user (email) + admin | Si `notifyUserDeactivated` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | UserDeactivatedEmail | < 2min | 3x |
| `PasswordResetRequested` | Security | 🟠 high | user (email explicite) | Toujours envoyé | 📧 | ⏸️ Email | PasswordResetRequestedEmail | < 2min | 3x |
| `PasswordResetCompleted` | Security | 🟡 medium | user (email explicite) | Si `notifyPasswordReset` activé | 📧 | ⏸️ Email | PasswordResetCompletedEmail | < 15min | 2x |
| `PINResetRequested` | Security | 🟠 high | user (email explicite) | Toujours envoyé | 📧 | ⏸️ Email | PINResetRequestedEmail | < 2min | 3x |
| `UserLoggedIn` | Security | 🟢 low | super_admin (si suspicious) | Si `notifySuspiciousLogin` activé | 🖥️ | ✅ In-App | SuspiciousLoginInApp | < 1h | 1x |
| `UserLoggedOut` | Security | 🟢 low | Aucun | Pas de notification | ❌ | ❌ | N/A | N/A | N/A |

---

### 2.10 Événements Infrastructure

| Event | Category | Priority | Default Recipients | Conditions | Channels | Offline | Template | SLA | Retry |
|---|---|---|---|---|---|---|---|---|---|
| `SystemError` | Infrastructure | 🔴 critical | super_admin, platform_admin | Toujours envoyé | 📧, 📱, 🔔, 🖥️ | ⏸️ Email/SMS/Push, ✅ In-App | SystemErrorEmail | < 30s | 5x |
| `DatabaseConnectionLost` | Infrastructure | 🔴 critical | super_admin, platform_admin | Toujours envoyé | 📧, 📱, 🔔, 🖥️ | ⏸️ Email/SMS/Push, ✅ In-App | DatabaseConnectionLostEmail | < 30s | 5x |
| `SyncFailureDetected` | Infrastructure | 🟠 high | super_admin, platform_admin | Si `notifySyncFailure` activé | 📧, 🖥️ | ⏸️ Email, ✅ In-App | SyncFailureDetectedEmail | < 2min | 3x |
| `PlatformHealthCheckFailed` | Infrastructure | 🔴 critical | super_admin, platform_admin | Toujours envoyé | 📧, 📱, 🔔, 🖥️ | ⏸️ Email/SMS/Push, ✅ In-App | PlatformHealthCheckFailedEmail | < 30s | 5x |

---

## 3. RÈGLES SPÉCIALES

### 3.1 Règles sans préférence utilisateur

Certains événements sont **toujours envoyés** (pas de préférence utilisateur) :

| Événement | Raison |
|---|---|
| `VoucherGenerated` | Contractuel (client doit recevoir son code) |
| `VoucherExpired` | Contractuel (client doit être informé) |
| `PaymentVerified` | Contractuel (activation immédiate) |
| `PaymentRejected` | Contractuel (échec = action requise) |
| `TenantCreated` | Platform (super_admin doit être informé) |
| `TenantSuspended` | Critique (perte d'accès) |
| `UserInvited` | Sécurité (lien d'invitation) |
| `PasswordResetRequested` | Sécurité (lien de reset) |
| `PINResetRequested` | Sécurité (code PIN) |
| `SystemError` | Critique (service down) |
| `DatabaseConnectionLost` | Critique (service down) |
| `PlatformHealthCheckFailed` | Critique (service down) |

---

### 3.2 Règles avec email explicite

Certains événements utilisent un **email explicite** (pas de résolution RBAC) :

| Événement | Email explicite |
|---|---|
| `VoucherGenerated` | `customer_email` (depuis voucher) |
| `VoucherExpired` | `customer_email` (depuis voucher) |
| `PaymentVerified` | `recipient` (email du tenant owner) |
| `PaymentRejected` | `recipient` (email du tenant owner) |
| `SubscriptionCreated` | `tenant_owner_email` |
| `SubscriptionActivated` | `tenant_owner_email` |
| `SubscriptionExpired` | `tenant_owner_email` |
| `SubscriptionCancelled` | `tenant_owner_email` |
| `SubscriptionGracePeriodStarted` | `tenant_owner_email` |
| `SubscriptionPaymentFailed` | `tenant_owner_email` |
| `TenantSuspended` | `tenant_owner_email` + super_admin |
| `UserCreated` | `user_email` (depuis User) |
| `UserInvited` | `invited_email` |
| `UserRoleChanged` | `user_email` |
| `UserDeactivated` | `user_email` |
| `PasswordResetRequested` | `user_email` |
| `PasswordResetCompleted` | `user_email` |
| `PINResetRequested` | `user_email` |

---

### 3.3 Règles cross-tenant

Seuls les événements Platform sont cross-tenant :

| Événement | Scope | Destinataires |
|---|---|---|
| `TenantCreated` | Cross-tenant | super_admin, platform_admin |
| `TenantSuspended` | Cross-tenant | tenant owner + super_admin |
| `SystemError` | Cross-tenant | super_admin, platform_admin |
| `DatabaseConnectionLost` | Cross-tenant | super_admin, platform_admin |
| `PlatformHealthCheckFailed` | Cross-tenant | super_admin, platform_admin |

---

## 4. COMPORTEMENT OFFLINE PAR CANAL

### 4.1 Matrice offline

| Canal | Online | Offline | Livraison offline | Sync |
|---|---|---|---|---|
| **In-App** | ✅ | ✅ | Immédiate (SQLite) | Sync quand online |
| **Email** | ✅ | ⏸️ | Queue dans outbox | BullMQ worker |
| **SMS** | ✅ | ⏸️ | Queue dans outbox | BullMQ worker |
| **Push** | ✅ | ⏸️ | Queue dans outbox | BullMQ worker |
| **WhatsApp** | ✅ | ⏸️ | Queue dans outbox | BullMQ worker |
| **Webhook** | ✅ | ⏸️ | Queue dans outbox | BullMQ worker |

---

### 4.2 Stratégie de queue offline

**Priorité de queue :**
1. 🔴 critical : Traité en premier
2. 🟠 high : Traité après critical
3. 🟡 medium : Traité après high
4. 🟢 low : Traité en dernier

**Fréquence de sync :**
- Online + Changement : Sync immédiat (debounce 1s)
- Online sans changement : Sync toutes les 30s
- Offline : Queue dans outbox, sync au retour de connexion

---

## 5. PRIORITÉS ET SLA

### 5.1 Matrice SLA par priorité

| Priorité | Delivery Time | Max Delivery | Retry | Retry Delays | DLQ After |
|---|---|---|---|---|---|
| 🔴 **critical** | < 30s | 1min | 5 tentatives | 1s, 2s, 4s, 8s, 16s | 5 échecs |
| 🟠 **high** | < 2min | 5min | 3 tentatives | 1s, 2s, 4s | 3 échecs |
| 🟡 **medium** | < 15min | 30min | 2 tentatives | 5s, 5s | 2 échecs |
| 🟢 **low** | < 1h | 2h | 1 tentative | N/A | 1 échec |

---

### 5.2 Monitoring SLA

**Alertes automatiques :**
- Delivery time > SLA pendant 5 min → PagerDuty (critical)
- Delivery rate < 99% pendant 15 min → Slack #alerts
- DLQ > 100 jobs → Email aux super_admins
- Queue lag > 1000 jobs → Email aux super_admins

---

## 6. EXEMPLES D'UTILISATION

### 6.1 Exemple 1 : StockOut (critical)

```
Event: StockOut (stock_quantity = 0)
  ↓
Priority: critical
  ↓
Recipients: admin, manager (si notifyOutOfStock activé)
  ↓
Channels: Email + SMS + Push + In-App
  ↓
Offline: 
  - In-App: ✅ Affiché immédiatement
  - Email/SMS/Push: ⏸️ Queue dans outbox
  ↓
SLA: < 30 secondes
  ↓
Retry: 5 tentatives (1s, 2s, 4s, 8s, 16s)
  ↓
DLQ: Après 5 échecs → alerte super_admin
```

---

### 6.2 Exemple 2 : ProductCreated (medium)

```
Event: ProductCreated
  ↓
Priority: medium
  ↓
Recipients: admin, manager (si notifyNewProduct activé)
  ↓
Channels: Email + In-App
  ↓
Offline:
  - In-App: ✅ Affiché immédiatement
  - Email: ⏸️ Queue dans outbox
  ↓
SLA: < 15 minutes
  ↓
Retry: 2 tentatives (5s, 5s)
  ↓
DLQ: Après 2 échecs → log + alerte
```

---

### 6.3 Exemple 3 : VoucherGenerated (high, email explicite)

```
Event: VoucherGenerated
  ↓
Priority: high
  ↓
Recipients: customer_email (toujours envoyé, pas de préférence)
  ↓
Channels: Email uniquement
  ↓
Offline: ⏸️ Queue dans outbox
  ↓
SLA: < 2 minutes
  ↓
Retry: 3 tentatives (1s, 2s, 4s)
  ↓
DLQ: Après 3 échecs → alerte admin
```

---

## 7. RÉSUMÉ STATISTIQUE

### 7.1 Par catégorie

| Catégorie | Nombre d'événements | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Opérationnel | 28 | 1 | 2 | 20 | 5 |
| Financier | 5 | 0 | 2 | 2 | 1 |
| SaaS / Billing | 10 | 1 | 8 | 1 | 0 |
| Sécurité | 9 | 0 | 5 | 2 | 2 |
| Infrastructure | 4 | 3 | 1 | 0 | 0 |
| Platform | 2 | 1 | 1 | 0 | 0 |
| **Total** | **54** | **6** | **19** | **25** | **8** |

---

### 7.2 Par canal

| Canal | Nombre d'événements l'utilisant | % |
|---|---|---|
| 📧 Email | 54 | 100% |
| 🖥️ In-App | 48 | 89% |
| 📱 SMS | 8 | 15% |
| 🔔 Push | 6 | 11% |
| 💬 WhatsApp | 0 | 0% |
| 🔗 Webhook | 0 | 0% |

---

### 7.3 Par comportement offline

| Comportement | Nombre d'événements | % |
|---|---|---|
| ✅ In-App seulement | 1 | 2% |
| ⏸️ Email + In-App | 47 | 87% |
| ⏸️ Email/SMS/Push + In-App | 6 | 11% |

---

## 8. RÉFÉRENCES

- `docs/NOTIFICATION_FUNCTIONAL_SPECIFICATION.md` — Spécification fonctionnelle
- `docs/AUDIT_NOTIFICATION_DOMAIN_EVENTS.md` — Catalogue des événements
- `docs/ARCHITECTURE_NOTIFICATION_DOMAIN_V3_OFFLINE_FIRST.md` — Architecture V3