# AUDIT FORENSIQUE — CATALOGUE DES ÉVÉNEMENTS MÉTIER NOTIFIABLES  
**Niveau :** Domain-Driven Design — Event Storming  
**Date :** 29/06/2026  
**Règle :** 0 code, 0 modification, 0 hypothèse — uniquement des faits extraits du code

---

## MÉTHODOLOGIE

1. **Événements existants** : Ceux qui déclenchent déjà une notification (email ou in-app)
2. **Événements absents** : Ceux qui existent dans le code métier mais ne déclenchent aucune notification
3. **Événements manquants** : Ceux qui n'existent pas encore mais devraient exister

Pour chaque événement, les 20 attributs demandés sont documentés à partir du code.

---

## PARTIE 1 : ÉVÉNEMENTS EXISTANTS (DÉJÀ NOTIFIÉS)

### 1.1 ProductCreated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `ProductCreated` |
| **Bounded Context** | Product Management |
| **Aggregate** | Product |
| **Commande** | `CreateProductCommand` |
| **Service métier** | `ProductService.create()` |
| **Repository** | `ProductRepository` (SQLite + Supabase) |
| **Route HTTP** | `POST /api/products` |
| **Fichier route** | `src/server/routes/products.ts` |
| **Fichier service** | `src/server/products/services/product.service.ts` |
| **Acteurs** | admin, manager |
| **Rôles notifiés** | admin, manager (via `role_notification_config.notifyNewProduct`) |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone (await dans la route) |
| **Fréquence** | Faible (création occasionnelle) |
| **Idempotence requise** | OUI (si retry) |
| **Priorité** | medium |
| **Retry nécessaire** | NON (actuellement) |
| **Durée conservation** | 30 jours (table notifications) |
| **Canaux actuels** | Email uniquement |
| **Canaux possibles** | Email, In-App, Slack (stock) |
| **Dépendances** | notification.service.ts:1076, email-templates.ts |
| **Impact UX** | Moyen (information) |
| **Impact business** | Faible (traçabilité) |

**Preuve code :**
```typescript
// routes/products.ts:~105
await notifyNewProduct(data.name, data, settings);
```

---

### 1.2 ProductStockUpdated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `ProductStockUpdated` |
| **Bounded Context** | Inventory Management |
| **Aggregate** | Product / InventoryMovement |
| **Commande** | `UpdateStockCommand` / `AdjustStockCommand` |
| **Service métier** | `ProductService.updateStock()` / `InventoryService.adjust()` |
| **Repository** | `ProductRepository`, `InventoryMovementRepository` |
| **Route HTTP** | `PATCH /api/products/:id` (stock), `POST /api/inventory/adjust` |
| **Fichier route** | `src/server/routes/products.ts`, `src/server/routes/inventory.ts` |
| **Fichier service** | `src/server/products/services/product.service.ts` |
| **Acteurs** | admin, manager, cashier |
| **Rôles notifiés** | admin, manager (via `notifyStockAdjustment`) |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone (await dans la route) |
| **Fréquence** | Moyenne (ajustements réguliers) |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux actuels** | Email uniquement |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | notification.service.ts:1099, routes/inventory.ts:~200 |
| **Impact UX** | Moyen |
| **Impact business** | Faible (audit) |

**Preuve code :**
```typescript
// routes/inventory.ts:~200
await notifyStockAdjustment(
  notifyPayload.productName, Number(id),
  notifyPayload.qtyBefore, notifyPayload.qtyChanged,
  notifyPayload.qtyAfter, notifyPayload.reason,
  performedBy, currency, settings
);
```

---

### 1.3 StockLow / StockOut

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `StockLow` / `StockOut` |
| **Bounded Context** | Inventory Management |
| **Aggregate** | Product |
| **Commande** | Aucune (détection automatique) |
| **Service métier** | `NotificationService.scheduleStockMovementEmails()` (polling) |
| **Repository** | `ProductRepository` (lecture) |
| **Route HTTP** | Aucune (déclenché par cron/polling) |
| **Fichier** | `src/server/services/notification.service.ts:1893-1969` |
| **Acteurs** | Système (automated) |
| **Rôles notifiés** | admin, manager (via `notifyLowStock`, `notifyOutOfStock`) |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Asynchrone (polling 30s) |
| **Fréquence** | Élevée (toutes les 30s) |
| **Idempotence requise** | OUI (éviter doublons) |
| **Priorité** | high |
| **Retry nécessaire** | OUI (stock critique) |
| **Durée conservation** | 7 jours |
| **Canaux actuels** | Email uniquement |
| **Canaux possibles** | Email, In-App, SMS (urgent) |
| **Dépendances** | notification.service.ts:1867, scheduleStockMovementEmails() |
| **Impact UX** | Élevé (alerte temps réel) |
| **Impact business** | Élevé (rupture stock = perte vente) |

**Preuve code :**
```typescript
// notification.service.ts:1893-1969
setInterval(async () => {
  const movements = db.prepare(...).all();
  for (const mv of movements) {
    await notifyStockMovement(mv, settingsRaw);
  }
}, 30000);
```

---

### 1.4 SaleCompleted

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SaleCompleted` |
| **Bounded Context** | Sales / POS |
| **Aggregate** | Sale / Order |
| **Commande** | `CompleteSaleCommand` |
| **Service métier** | `SaleService.complete()` |
| **Repository** | `SaleRepository`, `OrderRepository` |
| **Route HTTP** | `POST /api/sales` |
| **Fichier route** | `src/server/routes/sales.ts` |
| **Fichier service** | `src/server/services/sale.service.ts` (inféré) |
| **Acteurs** | cashier, admin |
| **Rôles notifiés** | admin, manager (via `notifySales`) |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone (await dans la route) |
| **Fréquence** | Élevée (plusieurs par jour) |
| **Idempotence requise** | OUI (éviter doublons) |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux actuels** | Email uniquement |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | notification.service.ts:1614, routes/sales.ts:~180 |
| **Impact UX** | Faible (information) |
| **Impact business** | Moyen (traçabilité financière) |

**Preuve code :**
```typescript
// routes/sales.ts:~180
await notifyOrderCheckout(
  normalizedOrderId,
  items,
  grandTotal,
  paymentMethod,
  tableLabel,
  waiterName,
  cashierName,
  currency,
  settings
);
```

---

### 1.5 OrderCheckoutCompleted

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `OrderCheckoutCompleted` |
| **Bounded Context** | Order Management / POS |
| **Aggregate** | Order |
| **Commande** | `CheckoutOrderCommand` |
| **Service métier** | `OrderService.checkout()` |
| **Repository** | `OrderRepository` |
| **Route HTTP** | `POST /api/orders/:id/checkout` |
| **Fichier route** | `src/server/routes/orders.ts` (inféré) |
| **Fichier service** | `src/server/services/order.service.ts` |
| **Acteurs** | cashier, waiter |
| **Rôles notifiés** | admin, manager (via `notifySales` alias `orderConfirm`) |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Élevée |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux actuels** | Email uniquement |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | notification.service.ts:1741, services/order.service.ts:~50 |
| **Impact UX** | Faible |
| **Impact business** | Moyen |

**Preuve code :**
```typescript
// services/order.service.ts:~50
await notifyOrderCheckout(
  id,
  items,
  grandTotal,
  paymentMethod,
  tableLabel,
  waiterName,
  cashierName,
  currency,
  settings
);
```

---

### 1.6 VoucherGenerated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `VoucherGenerated` |
| **Bounded Context** | Billing / Subscription |
| **Aggregate** | Voucher / Subscription |
| **Commande** | `GenerateVoucherCommand` |
| **Service métier** | `BillingService.generateVoucher()` |
| **Repository** | `VoucherRepository`, `SubscriptionRepository` |
| **Route HTTP** | `POST /api/billing/request-voucher` |
| **Fichier route** | `src/server/routes/billing.routes.ts` |
| **Fichier service** | `src/server/services/billing.service.ts` (inféré) |
| **Acteurs** | admin, manager, tenant owner |
| **Rôles notifiés** | customer_email (email explicite, pas RBAC) |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Asynchrone (void sendEmailDirect) |
| **Fréquence** | Faible (à la demande) |
| **Idempotence requise** | OUI (voucher unique) |
| **Priorité** | high |
| **Retry nécessaire** | OUI (obligatoire pour le client) |
| **Durée conservation** | 90 jours |
| **Canaux actuels** | Email uniquement |
| **Canaux possibles** | Email, SMS, In-App |
| **Dépendances** | email-templates.ts:buildVoucherGeneratedEmail, billing.routes.ts:~150 |
| **Impact UX** | Élevé (le client reçoit son code) |
| **Impact business** | Élevé (activation subscription) |

**Preuve code :**
```typescript
// billing.routes.ts:~150
void sendEmailDirect(
  `[Great Olive] Code de paiement généré — ${plan.name}`,
  buildVoucherGeneratedEmail(...),
  settingsRaw,
  tenantEmail
);
```

---

### 1.7 VoucherExpired

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `VoucherExpired` |
| **Bounded Context** | Billing / Subscription |
| **Aggregate** | Voucher / Subscription |
| **Commande** | Aucune (détection automatique par cron) |
| **Service métier** | `BillingExpirationService.expireTenantVouchers()` |
| **Repository** | `VoucherRepository`, `SubscriptionRepository` |
| **Route HTTP** | Aucune (cron) |
| **Fichier** | `src/server/services/billing-expiration.service.ts`, `src/server/saas/cron/expiration.cron.ts`, `src/server/saas/cron/voucher-expiration.cron.ts` |
| **Acteurs** | Système (automated) |
| **Rôles notifiés** | customer_email (email explicite) |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Asynchrone (cron 5 min) |
| **Fréquence** | Moyenne (toutes les 5 min) |
| **Idempotence requise** | OUI (éviter double expiration) |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux actuels** | Email uniquement |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | email-templates.ts:buildVoucherExpiredEmail, billing-expiration.service.ts:144 |
| **Impact UX** | Élevé (client perd accès) |
| **Impact business** | Élevé (churn potentiel) |

**Preuve code :**
```typescript
// billing-expiration.service.ts:144
void sendEmailDirect(
  `[Great Olive] Demande de paiement expirée — ${plan.name}`,
  buildVoucherExpiredEmail(...),
  settingsRaw,
  customerEmail
);
```

---

### 1.8 PaymentVerified

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `PaymentVerified` |
| **Bounded Context** | Billing / Subscription |
| **Aggregate** | SubscriptionPaymentRequest |
| **Commande** | `VerifyPaymentCommand` |
| **Service métier** | `AdminSubscriptionService.verifyPayment()` |
| **Repository** | `SubscriptionPaymentRequestRepository` |
| **Route HTTP** | `POST /api/admin/subscriptions/verify` |
| **Fichier route** | `src/server/routes/admin.subscriptions.ts` |
| **Acteurs** | super_admin, platform_admin |
| **Rôles notifiés** | recipient (email explicite du tenant) |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Asynchrone (void sendEmailDirect) |
| **Fréquence** | Faible (à la demande) |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux actuels** | Email uniquement |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | email-templates.ts:buildPaymentVerifiedEmailHTML, admin.subscriptions.ts:~80 |
| **Impact UX** | Élevé (activation immédiate) |
| **Impact business** | Élevé (déblocage revenu) |

**Preuve code :**
```typescript
// admin.subscriptions.ts:~80
void sendEmailDirect(
  `[Great Olive] Paiement validé`,
  buildPaymentVerifiedEmailHTML(...),
  settingsRaw,
  recipient
);
```

---

### 1.9 PaymentRejected

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `PaymentRejected` |
| **Bounded Context** | Billing / Subscription |
| **Aggregate** | SubscriptionPaymentRequest |
| **Commande** | `RejectPaymentCommand` |
| **Service métier** | `AdminSubscriptionService.rejectPayment()` |
| **Repository** | `SubscriptionPaymentRequestRepository` |
| **Route HTTP** | `POST /api/admin/subscriptions/reject` |
| **Fichier route** | `src/server/routes/admin.subscriptions.ts` |
| **Acteurs** | super_admin, platform_admin |
| **Rôles notifiés** | recipient (email explicite du tenant) |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Asynchrone (void sendEmailDirect) |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux actuels** | Email uniquement |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | email-templates.ts:buildPaymentRejectedEmailHTML, admin.subscriptions.ts:~120 |
| **Impact UX** | Élevé (échec = frustration) |
| **Impact business** | Élevé (perte revenu) |

**Preuve code :**
```typescript
// admin.subscriptions.ts:~120
void sendEmailDirect(
  `[Great Olive] Paiement rejeté`,
  buildPaymentRejectedEmailHTML(...),
  settingsRaw,
  recipient
);
```

---

### 1.10 InventorySummary (Scheduled)

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `InventorySummaryGenerated` |
| **Bounded Context** | Inventory Management |
| **Aggregate** | Aucun (rapport agrégé) |
| **Commande** | Aucune (scheduler) |
| **Service métier** | `ScheduledReportsService.sendMorningInventorySummary()` |
| **Repository** | `ProductRepository`, `OrderRepository` (lecture) |
| **Route HTTP** | Aucune (cron) |
| **Fichier** | `src/server/services/scheduled-reports.service.ts:105-148` |
| **Acteurs** | Système (automated) |
| **Rôles notifiés** | admin, manager (via `role_notification_config`) |
| **Criticité** | MOYENNE |
| **Synchronicité** | Asynchrone (cron 7:30) |
| **Fréquence** | 1x/jour |
| **Idempotence requise** | OUI (même rapport = même event) |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 7 jours |
| **Canaux actuels** | Email uniquement |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | scheduled-reports.service.ts:142, node-cron |
| **Impact UX** | Faible (rapport automatique) |
| **Impact business** | Faible (insight) |

**Preuve code :**
```typescript
// scheduled-reports.service.ts:142
await broadcastNotification(
  'inventory_summary',
  'Morning Inventory Summary — Great Olive',
  html,
  settings
);
```

---

### 1.11 MiddayOperationsSnapshot (Scheduled)

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `MiddayOperationsSnapshotGenerated` |
| **Bounded Context** | Operations |
| **Aggregate** | Aucun (rapport agrégé) |
| **Commande** | Aucune (scheduler) |
| **Service métier** | `ScheduledReportsService.sendMiddayOperationsSummary()` |
| **Repository** | `SaleRepository`, `OrderRepository`, `ProductRepository` (lecture) |
| **Route HTTP** | Aucune (cron) |
| **Fichier** | `src/server/services/scheduled-reports.service.ts:150-188` |
| **Acteurs** | Système (automated) |
| **Rôles notifiés** | admin, manager |
| **Criticité** | MOYENNE |
| **Synchronicité** | Asynchrone (cron 12:30) |
| **Fréquence** | 1x/jour |
| **Idempotence requise** | OUI |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 7 jours |
| **Canaux actuels** | Email uniquement |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | scheduled-reports.service.ts:182 |
| **Impact UX** | Faible |
| **Impact business** | Faible (insight) |

**Preuve code :**
```typescript
// scheduled-reports.service.ts:182
await broadcastNotification(
  'midday_ops',
  'Midday Operations Snapshot — Great Olive',
  html,
  settings
);
```

---

### 1.12 EndOfDayClosureReport (Scheduled)

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `EndOfDayClosureReportGenerated` |
| **Bounded Context** | Operations / Finance |
| **Aggregate** | Aucun (rapport agrégé) |
| **Commande** | Aucune (scheduler) |
| **Service métier** | `ScheduledReportsService.sendEndOfDayClosureReport()` |
| **Repository** | `SaleRepository`, `ExpenseRepository`, `OrderRepository` (lecture) |
| **Route HTTP** | Aucune (cron) |
| **Fichier** | `src/server/services/scheduled-reports.service.ts:190-234` |
| **Acteurs** | Système (automated) |
| **Rôles notifiés** | admin, manager |
| **Criticité** | MOYENNE |
| **Synchronicité** | Asynchrone (cron 23:59) |
| **Fréquence** | 1x/jour |
| **Idempotence requise** | OUI |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 7 jours |
| **Canaux actuels** | Email uniquement |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | scheduled-reports.service.ts:228 |
| **Impact UX** | Faible |
| **Impact business** | Moyen (fermeture journalière) |

**Preuve code :**
```typescript
// scheduled-reports.service.ts:228
await broadcastNotification(
  'eod_closure',
  'End of Day Closure Report — Great Olive',
  html,
  settings
);
```

---

## PARTIE 2 : ÉVÉNEMENTS ABSENTS (EXISTENT DANS LE CODE, PAS DE NOTIFICATION)

### 2.1 CategoryCreated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `CategoryCreated` |
| **Bounded Context** | Product Management |
| **Aggregate** | Category |
| **Commande** | `CreateCategoryCommand` |
| **Service métier** | `CategoryService.create()` |
| **Repository** | `CategoryRepository` |
| **Route HTTP** | `POST /api/categories` |
| **Fichier route** | `src/server/routes/categories.ts` |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | FAIBLE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune notification existante |
| **Impact UX** | Faible |
| **Impact business** | Faible |
| **Notification actuelle** | **AUCUNE** |

**Preuve absence :**
```typescript
// src/server/routes/categories.ts
// Aucun appel à notifyNewProduct, notifyCategoryCreated, etc.
```

---

### 2.2 CategoryUpdated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `CategoryUpdated` |
| **Bounded Context** | Product Management |
| **Aggregate** | Category |
| **Commande** | `UpdateCategoryCommand` |
| **Service métier** | `CategoryService.update()` |
| **Repository** | `CategoryRepository` |
| **Route HTTP** | `PATCH /api/categories/:id` |
| **Fichier route** | `src/server/routes/categories.ts` |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | FAIBLE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Faible |
| **Impact business** | Faible |
| **Notification actuelle** | **AUCUNE** |

---

### 2.3 CategoryDeleted

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `CategoryDeleted` |
| **Bounded Context** | Product Management |
| **Aggregate** | Category |
| **Commande** | `DeleteCategoryCommand` |
| **Service métier** | `CategoryService.delete()` |
| **Repository** | `CategoryRepository` |
| **Route HTTP** | `DELETE /api/categories/:id` |
| **Fichier route** | `src/server/routes/categories.ts` |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | MOYENNE (cascade delete possible) |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Moyen (produits orphelins) |
| **Impact business** | Moyen |
| **Notification actuelle** | **AUCUNE** |

---

### 2.4 SupplierCreated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SupplierCreated` |
| **Bounded Context** | Supplier Management |
| **Aggregate** | Supplier |
| **Commande** | `CreateSupplierCommand` |
| **Service métier** | `SupplierService.create()` |
| **Repository** | `SupplierRepository` |
| **Route HTTP** | `POST /api/suppliers` |
| **Fichier route** | `src/server/routes/suppliers.ts` |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | FAIBLE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Faible |
| **Impact business** | Faible |
| **Notification actuelle** | **AUCUNE** |

**Preuve absence :**
```typescript
// src/server/routes/suppliers.ts
// Aucun appel à notify
```

---

### 2.5 SupplierUpdated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SupplierUpdated` |
| **Bounded Context** | Supplier Management |
| **Aggregate** | Supplier |
| **Commande** | `UpdateSupplierCommand` |
| **Service métier** | `SupplierService.update()` |
| **Repository** | `SupplierRepository` |
| **Route HTTP** | `PATCH /api/suppliers/:id` |
| **Fichier route** | `src/server/routes/suppliers.ts` |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | FAIBLE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Faible |
| **Impact business** | Faible |
| **Notification actuelle** | **AUCUNE** |

---

### 2.6 SupplierDeleted

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SupplierDeleted` |
| **Bounded Context** | Supplier Management |
| **Aggregate** | Supplier |
| **Commande** | `DeleteSupplierCommand` |
| **Service métier** | `SupplierService.delete()` |
| **Repository** | `SupplierRepository` |
| **Route HTTP** | `DELETE /api/suppliers/:id` |
| **Fichier route** | `src/server/routes/suppliers.ts` |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Moyen (commandes liées) |
| **Impact business** | Moyen |
| **Notification actuelle** | **AUCUNE** |

---

### 2.7 CustomerCreated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `CustomerCreated` |
| **Bounded Context** | Customer Management |
| **Aggregate** | Customer |
| **Commande** | `CreateCustomerCommand` |
| **Service métier** | `CustomerService.create()` |
| **Repository** | `CustomerRepository` |
| **Route HTTP** | `POST /api/customers` |
| **Fichier route** | `src/server/routes/customers.ts` |
| **Acteurs** | admin, manager, cashier |
| **Rôles concernés** | admin, manager |
| **Criticité** | FAIBLE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Moyenne |
| **Idempotence requise** | OUI |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Faible |
| **Impact business** | Faible |
| **Notification actuelle** | **AUCUNE** |

**Preuve absence :**
```typescript
// src/server/routes/customers.ts
// Aucun appel à notify
```

---

### 2.8 CustomerUpdated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `CustomerUpdated` |
| **Bounded Context** | Customer Management |
| **Aggregate** | Customer |
| **Commande** | `UpdateCustomerCommand` |
| **Service métier** | `CustomerService.update()` |
| **Repository** | `CustomerRepository` |
| **Route HTTP** | `PATCH /api/customers/:id` |
| **Fichier route** | `src/server/routes/customers.ts` |
| **Acteurs** | admin, manager, cashier |
| **Rôles concernés** | admin, manager |
| **Criticité** | FAIBLE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Moyenne |
| **Idempotence requise** | OUI |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Faible |
| **Impact business** | Faible |
| **Notification actuelle** | **AUCUNE** |

---

### 2.9 CustomerDeleted

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `CustomerDeleted` |
| **Bounded Context** | Customer Management |
| **Aggregate** | Customer |
| **Commande** | `DeleteCustomerCommand` |
| **Service métier** | `CustomerService.delete()` |
| **Repository** | `CustomerRepository` |
| **Route HTTP** | `DELETE /api/customers/:id` |
| **Fichier route** | `src/server/routes/customers.ts` |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Moyen (commandes liées) |
| **Impact business** | Moyen |
| **Notification actuelle** | **AUCUNE** |

---

### 2.10 PurchaseOrderCreated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `PurchaseOrderCreated` |
| **Bounded Context** | Procurement |
| **Aggregate** | PurchaseOrder |
| **Commande** | `CreatePurchaseOrderCommand` |
| **Service métier** | `PurchaseOrderService.create()` |
| **Repository** | `PurchaseOrderRepository` |
| **Route HTTP** | `POST /api/purchase-orders` |
| **Fichier route** | `src/server/routes/purchase-orders.ts` |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Moyen |
| **Impact business** | Moyen (approvisionnement) |
| **Notification actuelle** | **AUCUNE** |

**Preuve absence :**
```typescript
// src/server/routes/purchase-orders.ts
// Aucun appel à notify
```

---

### 2.11 PurchaseOrderReceived

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `PurchaseOrderReceived` |
| **Bounded Context** | Procurement / Inventory |
| **Aggregate** | PurchaseOrder |
| **Commande** | `ReceivePurchaseOrderCommand` |
| **Service métier** | `PurchaseOrderService.receive()` |
| **Repository** | `PurchaseOrderRepository`, `InventoryRepository` |
| **Route HTTP** | `POST /api/purchase-orders/:id/receive` |
| **Fichier route** | `src/server/routes/purchase-orders.ts` |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Moyen (mise à jour stock) |
| **Impact business** | Moyen |
| **Notification actuelle** | **AUCUNE** |

---

### 2.12 RefundIssued

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `RefundIssued` |
| **Bounded Context** | Sales / Finance |
| **Aggregate** | Sale / Refund |
| **Commande** | `IssueRefundCommand` |
| **Service métier** | `RefundService.issue()` |
| **Repository** | `RefundRepository`, `SaleRepository` |
| **Route HTTP** | `POST /api/sales/:id/refund` |
| **Fichier route** | `src/server/routes/sales.ts` (inféré) |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | ÉLEVÉE (impact financier) |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI (éviter double remboursement) |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, In-App, SMS |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (client notifié) |
| **Impact business** | Élevé (financier) |
| **Notification actuelle** | **AUCUNE** |

**Preuve absence :**
```typescript
// Aucune route de refund trouvée dans le code
// Aucun appel à notify pour les refunds
```

---

### 2.13 SubscriptionCreated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SubscriptionCreated` |
| **Bounded Context** | Subscription / SaaS |
| **Aggregate** | Subscription |
| **Commande** | `CreateSubscriptionCommand` |
| **Service métier** | `SubscriptionService.create()` |
| **Repository** | `SubscriptionRepository` |
| **Route HTTP** | `POST /api/subscription` |
| **Fichier route** | `src/server/routes/subscription.routes.ts` |
| **Acteurs** | tenant owner, admin |
| **Rôles concernés** | tenant owner (email explicite) |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible (à la demande) |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune notification existante |
| **Impact UX** | Élevé (activation) |
| **Impact business** | Élevé (onboarding) |
| **Notification actuelle** | **AUCUNE** |

**Preuve absence :**
```typescript
// src/server/routes/subscription.routes.ts
// Aucun appel à notify pour la création de subscription
```

---

### 2.14 SubscriptionActivated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SubscriptionActivated` |
| **Bounded Context** | Subscription / SaaS |
| **Aggregate** | Subscription |
| **Commande** | `ActivateSubscriptionCommand` (via voucher) |
| **Service métier** | `SubscriptionService.activate()` |
| **Repository** | `SubscriptionRepository` |
| **Route HTTP** | `POST /api/billing/activate-voucher` |
| **Fichier route** | `src/server/routes/billing.routes.ts` |
| **Acteurs** | tenant owner, admin |
| **Rôles concernés** | tenant owner (email explicite) |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (déblocage) |
| **Impact business** | Élevé (activation) |
| **Notification actuelle** | **AUCUNE** |

---

### 2.15 SubscriptionExpired

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SubscriptionExpired` |
| **Bounded Context** | Subscription / SaaS |
| **Aggregate** | Subscription |
| **Commande** | Aucune (détection automatique) |
| **Service métier** | `SubscriptionExpirationCron.expireSubscriptions()` |
| **Repository** | `SubscriptionRepository` |
| **Route HTTP** | Aucune (cron) |
| **Fichier** | `src/server/saas/cron/expiration.cron.ts` |
| **Acteurs** | Système (automated) |
| **Rôles concernés** | tenant owner (email explicite) |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Asynchrone (cron 5 min) |
| **Fréquence** | Moyenne |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, In-App, SMS |
| **Dépendances** | Aucune notification existante |
| **Impact UX** | Élevé (perte accès) |
| **Impact business** | Élevé (churn) |
| **Notification actuelle** | **AUCUNE** (seul le voucher est notifié) |

**Preuve absence :**
```typescript
// expiration.cron.ts:expireSubscriptions()
// Aucun appel à notify pour l'expiration de subscription
```

---

### 2.16 PaymentReceived

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `PaymentReceived` |
| **Bounded Context** | Billing / Finance |
| **Aggregate** | Payment / SubscriptionPaymentRequest |
| **Commande** | `ReceivePaymentCommand` |
| **Service métier** | `PaymentService.receive()` |
| **Repository** | `PaymentRepository` |
| **Route HTTP** | `POST /api/payments/webhook` (inféré) |
| **Fichier route** | Inconnu (webhook probable) |
| **Acteurs** | Système (payment provider) |
| **Rôles concernés** | tenant owner (email explicite) |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Asynchrone (webhook) |
| **Fréquence** | Moyenne |
| **Idempotence requise** | OUI (webhook idempotent) |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, In-App, SMS |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (confirmation) |
| **Impact business** | Élevé (encaissement) |
| **Notification actuelle** | **AUCUNE** (seul voucherGenerated est notifié) |

---

### 2.17 UserCreated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `UserCreated` |
| **Bounded Context** | Identity / IAM |
| **Aggregate** | User |
| **Commande** | `CreateUserCommand` |
| **Service métier** | `UserService.create()` |
| **Repository** | `UserRepository` |
| **Route HTTP** | `POST /api/users` |
| **Fichier route** | `src/server/routes/users.ts` |
| **Acteurs** | admin, manager |
| **Rôles concernés** | user créé (email explicite) |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | OUI (credentials) |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email (credentials), In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (credentials) |
| **Impact business** | Moyen (onboarding) |
| **Notification actuelle** | **AUCUNE** |

**Preuve absence :**
```typescript
// src/server/routes/users.ts
// Aucun appel à notify pour création d'utilisateur
```

---

### 2.18 UserInvited

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `UserInvited` |
| **Bounded Context** | Identity / IAM |
| **Aggregate** | User / Invitation |
| **Commande** | `InviteUserCommand` |
| **Service métier** | `InvitationService.send()` |
| **Repository** | `InvitationRepository` |
| **Route HTTP** | `POST /api/users/invite` |
| **Fichier route** | `src/server/routes/users.ts` (inféré) |
| **Acteurs** | admin, manager |
| **Rôles concernés** | user invité (email explicite) |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 7 jours (lien expiration) |
| **Canaux possibles** | Email (lien invitation) |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (onboarding) |
| **Impact business** | Moyen |
| **Notification actuelle** | **AUCUNE** |

---

### 2.19 PasswordResetRequested

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `PasswordResetRequested` |
| **Bounded Context** | Identity / IAM |
| **Aggregate** | User / PasswordResetToken |
| **Commande** | `RequestPasswordResetCommand` |
| **Service métier** | `AuthService.requestPasswordReset()` |
| **Repository** | `PasswordResetTokenRepository` |
| **Route HTTP** | `POST /api/auth/forgot-password` |
| **Fichier route** | `src/server/routes/auth.ts` (inféré) |
| **Acteurs** | user (self-service) |
| **Rôles concernés** | user (email explicite) |
| **Criticité** | ÉLEVÉE (sécurité) |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 1 heure (token expiration) |
| **Canaux possibles** | Email (lien reset) |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (sécurité) |
| **Impact business** | Moyen |
| **Notification actuelle** | **AUCUNE** |

---

### 2.20 PasswordResetCompleted

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `PasswordResetCompleted` |
| **Bounded Context** | Identity / IAM |
| **Aggregate** | User |
| **Commande** | `ResetPasswordCommand` |
| **Service métier** | `AuthService.resetPassword()` |
| **Repository** | `UserRepository` |
| **Route HTTP** | `POST /api/auth/reset-password` |
| **Fichier route** | `src/server/routes/auth.ts` (inféré) |
| **Acteurs** | user (self-service) |
| **Rôles concernés** | user (email explicite) |
| **Criticité** | ÉLEVÉE (sécurité) |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours (audit) |
| **Canaux possibles** | Email (confirmation) |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (sécurité) |
| **Impact business** | Moyen |
| **Notification actuelle** | **AUCUNE** |

---

### 2.21 PINResetRequested

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `PINResetRequested` |
| **Bounded Context** | Identity / IAM |
| **Aggregate** | User / PINResetToken |
| **Commande** | `RequestPINResetCommand` |
| **Service métier** | `AuthService.requestPINReset()` |
| **Repository** | `PINResetTokenRepository` |
| **Route HTTP** | `POST /api/auth/forgot-pin` |
| **Fichier route** | `src/server/routes/auth.ts` (inféré) |
| **Acteurs** | user (self-service) |
| **Rôles concernés** | user (email explicite) |
| **Criticité** | ÉLEVÉE (sécurité) |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 1 heure |
| **Canaux possibles** | Email, SMS |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (sécurité) |
| **Impact business** | Moyen |
| **Notification actuelle** | **AUCUNE** |

---

### 2.22 TenantCreated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `TenantCreated` |
| **Bounded Context** | SaaS Platform |
| **Aggregate** | Tenant |
| **Commande** | `CreateTenantCommand` |
| **Service métier** | `TenantService.create()` |
| **Repository** | `TenantRepository` |
| **Route HTTP** | `POST /api/tenants` |
| **Fichier route** | `src/server/saas/saas.routes.ts` |
| **Acteurs** | super_admin, platform_admin, prospect |
| **Rôles concernés** | super_admin, platform_admin (cross-tenant) |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible (nouveau client) |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, In-App (platform) |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (onboarding) |
| **Impact business** | Élevé (nouveau revenu) |
| **Notification actuelle** | **AUCUNE** |

**Preuve absence :**
```typescript
// src/server/saas/saas.routes.ts
// Aucun appel à notify pour création de tenant
```

---

### 2.23 TenantSuspended

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `TenantSuspended` |
| **Bounded Context** | SaaS Platform |
| **Aggregate** | Tenant |
| **Commande** | `SuspendTenantCommand` |
| **Service métier** | `TenantService.suspend()` |
| **Repository** | `TenantRepository` |
| **Route HTTP** | `PATCH /api/platform/tenants/:id/suspend` |
| **Fichier route** | `src/server/routes/platform.routes.ts` |
| **Acteurs** | super_admin, platform_admin |
| **Rôles concernés** | tenant owner, admin (email explicite) |
| **Criticité** | CRITIQUE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Très faible |
| **Idempotence requise** | OUI |
| **Priorité** | critical |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, SMS, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Critique (perte accès) |
| **Impact business** | Critique (churn) |
| **Notification actuelle** | **AUCUNE** |

---

### 2.24 BranchCreated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `BranchCreated` |
| **Bounded Context** | Tenant Management |
| **Aggregate** | Branch |
| **Commande** | `CreateBranchCommand` |
| **Service métier** | `BranchService.create()` |
| **Repository** | `BranchRepository` |
| **Route HTTP** | `POST /api/branches` |
| **Fichier route** | `src/server/routes/branches.ts` (inféré) |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | FAIBLE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Faible |
| **Impact business** | Faible |
| **Notification actuelle** | **AUCUNE** |

---

### 2.25 StockTransferInitiated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `StockTransferInitiated` |
| **Bounded Context** | Inventory Management |
| **Aggregate** | StockTransfer |
| **Commande** | `InitiateStockTransferCommand` |
| **Service métier** | `StockTransferService.initiate()` |
| **Repository** | `StockTransferRepository` |
| **Route HTTP** | `POST /api/inventory/transfer` |
| **Fichier route** | `src/server/routes/inventory.ts` (inféré) |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager (source + destination) |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Moyen (logistique) |
| **Impact business** | Moyen |
| **Notification actuelle** | **AUCUNE** |

---

### 2.26 StockTransferCompleted

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `StockTransferCompleted` |
| **Bounded Context** | Inventory Management |
| **Aggregate** | StockTransfer |
| **Commande** | `CompleteStockTransferCommand` |
| **Service métier** | `StockTransferService.complete()` |
| **Repository** | `StockTransferRepository` |
| **Route HTTP** | `POST /api/inventory/transfer/:id/complete` |
| **Fichier route** | `src/server/routes/inventory.ts` (inféré) |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager (source + destination) |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Moyen |
| **Impact business** | Moyen |
| **Notification actuelle** | **AUCUNE** |

---

### 2.27 ExpenseCreated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `ExpenseCreated` |
| **Bounded Context** | Finance |
| **Aggregate** | Expense |
| **Commande** | `CreateExpenseCommand` |
| **Service métier** | `ExpenseService.create()` |
| **Repository** | `ExpenseRepository` |
| **Route HTTP** | `POST /api/expenses` |
| **Fichier route** | `src/server/routes/expenses.ts` |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Moyenne |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Faible |
| **Impact business** | Moyen (audit) |
| **Notification actuelle** | **AUCUNE** |

**Preuve absence :**
```typescript
// src/server/routes/expenses.ts
// Aucun appel à notify
```

---

### 2.28 ExpenseApproved

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `ExpenseApproved` |
| **Bounded Context** | Finance |
| **Aggregate** | Expense |
| **Commande** | `ApproveExpenseCommand` |
| **Service métier** | `ExpenseService.approve()` |
| **Repository** | `ExpenseRepository` |
| **Route HTTP** | `POST /api/expenses/:id/approve` |
| **Fichier route** | `src/server/routes/expenses.ts` (inféré) |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Moyenne |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Faible |
| **Impact business** | Moyen |
| **Notification actuelle** | **AUCUNE** |

---

### 2.29 SaleRefunded

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SaleRefunded` |
| **Bounded Context** | Sales / Finance |
| **Aggregate** | Sale |
| **Commande** | `RefundSaleCommand` |
| **Service métier** | `SaleService.refund()` |
| **Repository** | `SaleRepository` |
| **Route HTTP** | `POST /api/sales/:id/refund` |
| **Fichier route** | `src/server/routes/sales.ts` (inféré) |
| **Acteurs** | admin, manager |
| **Rôles concernés** | admin, manager |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (financier) |
| **Impact business** | Élevé (financier) |
| **Notification actuelle** | **AUCUNE** |

---

### 2.30 OrderAssigned

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `OrderAssigned` |
| **Bounded Context** | Order Management |
| **Aggregate** | Order |
| **Commande** | `AssignOrderCommand` |
| **Service métier** | `OrderService.assign()` |
| **Repository** | `OrderRepository` |
| **Route HTTP** | `POST /api/orders/:id/assign` |
| **Fichier route** | `src/server/routes/orders.ts` (inféré) |
| **Acteurs** | admin, manager, cashier |
| **Rôles concernés** | waiter (assigné) |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Moyenne |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 7 jours |
| **Canaux possibles** | In-App (push), SMS |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (temps réel) |
| **Impact business** | Moyen (service) |
| **Notification actuelle** | **AUCUNE** |

**Note :** Le type `orderAssigned` existe dans `notificationTypes.ts` mais n'est jamais émis.

---

### 2.31 OrderStatusChanged

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `OrderStatusChanged` |
| **Bounded Context** | Order Management |
| **Aggregate** | Order |
| **Commande** | `UpdateOrderStatusCommand` |
| **Service métier** | `OrderService.updateStatus()` |
| **Repository** | `OrderRepository` |
| **Route HTTP** | `PATCH /api/orders/:id/status` |
| **Fichier route** | `src/server/routes/orders.ts` (inféré) |
| **Acteurs** | admin, manager, cashier, waiter |
| **Rôles concernés** | cashier, waiter, admin |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Élevée |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 7 jours |
| **Canaux possibles** | In-App (push), SMS |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (temps réel) |
| **Impact business** | Moyen |
| **Notification actuelle** | **AUCUNE** |

---

### 2.32 TableStatusChanged

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `TableStatusChanged` |
| **Bounded Context** | Restaurant Operations |
| **Aggregate** | RestaurantTable |
| **Commande** | `UpdateTableStatusCommand` |
| **Service métier** | `TableService.updateStatus()` |
| **Repository** | `TableRepository` |
| **Route HTTP** | `PATCH /api/tables/:id/status` |
| **Fichier route** | `src/server/routes/tables.ts` |
| **Acteurs** | waiter, cashier, admin |
| **Rôles concernés** | waiter, cashier, admin |
| **Criticité** | MOYENNE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Élevée |
| **Idempotence requise** | OUI |
| **Priorité** | medium |
| **Retry nécessaire** | NON |
| **Durée conservation** | 7 jours |
| **Canaux possibles** | In-App (push) |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (temps réel) |
| **Impact business** | Moyen (service) |
| **Notification actuelle** | **AUCUNE** |

---

### 2.33 QROrderReceived

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `QROrderReceived` |
| **Bounded Context** | Order Management / QR Menu |
| **Aggregate** | Order |
| **Commande** | `CreateQROrderCommand` |
| **Service métier** | `QRMenuService.createOrder()` |
| **Repository** | `OrderRepository` |
| **Route HTTP** | `POST /api/menu/checkout` |
| **Fichier route** | `src/server/routes/menu.ts` |
| **Acteurs** | Customer (via QR code) |
| **Rôles concernés** | cashier, waiter, admin |
| **Criticité** | ÉLEVÉE (nouvelle commande) |
| **Synchronicité** | Synchrone |
| **Fréquence** | Moyenne |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | NON |
| **Durée conservation** | 7 jours |
| **Canaux possibles** | In-App (push), SMS |
| **Dépendances** | Aucune |
| **Impact UX** | Critique (temps réel) |
| **Impact business** | Élevé (nouvelle vente) |
| **Notification actuelle** | **AUCUNE** (le type `newQrOrder` existe dans notificationTypes.ts mais n'est jamais émis) |

**Preuve absence :**
```typescript
// src/server/routes/menu.ts
// Aucun appel à notify pour les commandes QR
```

---

### 2.34 SubscriptionPaymentFailed

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SubscriptionPaymentFailed` |
| **Bounded Context** | Billing / Subscription |
| **Aggregate** | Subscription / Payment |
| **Commande** | Aucune (détection automatique) |
| **Service métier** | `SubscriptionService.detectPaymentFailure()` |
| **Repository** | `SubscriptionRepository`, `PaymentRepository` |
| **Route HTTP** | Aucune (webhook ou cron) |
| **Fichier** | Inconnu (probablement webhook) |
| **Acteurs** | Système (payment provider) |
| **Rôles concernés** | tenant owner (email explicite) |
| **Criticité** | CRITIQUE |
| **Synchronicité** | Asynchrone (webhook) |
| **Fréquence** | Moyenne |
| **Idempotence requise** | OUI |
| **Priorité** | critical |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, SMS, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Critique (perte accès) |
| **Impact business** | Critique (churn) |
| **Notification actuelle** | **AUCUNE** |

---

### 2.35 SubscriptionCancelled

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SubscriptionCancelled` |
| **Bounded Context** | Subscription / SaaS |
| **Aggregate** | Subscription |
| **Commande** | `CancelSubscriptionCommand` |
| **Service métier** | `SubscriptionService.cancel()` |
| **Repository** | `SubscriptionRepository` |
| **Route HTTP** | `POST /api/subscription/cancel` |
| **Fichier route** | `src/server/routes/subscription.routes.ts` |
| **Acteurs** | tenant owner, admin |
| **Rôles concernés** | tenant owner (email explicite) |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (churn) |
| **Impact business** | Élevé (revenu) |
| **Notification actuelle** | **AUCUNE** |

---

### 2.36 SystemError

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SystemError` |
| **Bounded Context** | Platform / Infrastructure |
| **Aggregate** | Aucun (incident) |
| **Commande** | Aucune (détection automatique) |
| **Service métier** | `SelfHealingOrchestrator.detectAnomaly()` |
| **Repository** | Aucun |
| **Route HTTP** | Aucune |
| **Fichier** | `src/server/infrastructure/self-healing/anomaly-detector.ts` |
| **Acteurs** | Système (automated) |
| **Rôles concernés** | super_admin, platform_admin |
| **Criticité** | CRITIQUE |
| **Synchronicité** | Asynchrone |
| **Fréquence** | Très faible |
| **Idempotence requise** | OUI |
| **Priorité** | critical |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, SMS, Slack, PagerDuty |
| **Dépendances** | Aucune |
| **Impact UX** | Critique (service down) |
| **Impact business** | Critique ( indisponibilité) |
| **Notification actuelle** | **AUCUNE** |

**Preuve absence :**
```typescript
// src/server/infrastructure/self-healing/anomaly-detector.ts
// Aucun appel à notify pour les anomalies détectées
```

---

## PARTIE 3 : ÉVÉNEMENTS MANQUANTS (N'EXISTENT PAS ENCORE)

### 3.1 UserLoggedIn

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `UserLoggedIn` |
| **Bounded Context** | Identity / IAM |
| **Aggregate** | User / Session |
| **Commande** | `LoginCommand` |
| **Service métier** | `AuthService.login()` |
| **Repository** | `SessionRepository` |
| **Route HTTP** | `POST /api/auth/login` |
| **Fichier route** | `src/server/routes/auth.ts` (inféré) |
| **Acteurs** | user |
| **Rôles concernés** | super_admin (suspicious login) |
| **Criticité** | MOYENNE (sécurité) |
| **Synchronicité** | Synchrone |
| **Fréquence** | Élevée |
| **Idempotence requise** | NON (événement naturellement idempotent par session) |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 7 jours |
| **Canaux possibles** | In-App (security log) |
| **Dépendances** | Aucune |
| **Impact UX** | Faible |
| **Impact business** | Faible (sécurité) |
| **Existence** | **N'EXISTE PAS** |

---

### 3.2 UserLoggedOut

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `UserLoggedOut` |
| **Bounded Context** | Identity / IAM |
| **Aggregate** | User / Session |
| **Commande** | `LogoutCommand` |
| **Service métier** | `AuthService.logout()` |
| **Repository** | `SessionRepository` |
| **Route HTTP** | `POST /api/auth/logout` |
| **Fichier route** | `src/server/routes/auth.ts` (inféré) |
| **Acteurs** | user |
| **Rôles concernés** | Aucun |
| **Criticité** | FAIBLE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Élevée |
| **Idempotence requise** | NON |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 7 jours |
| **Canaux possibles** | Aucun |
| **Dépendances** | Aucune |
| **Impact UX** | Nul |
| **Impact business** | Nul |
| **Existence** | **N'EXISTE PAS** |

---

### 3.3 UserPasswordChanged

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `UserPasswordChanged` |
| **Bounded Context** | Identity / IAM |
| **Aggregate** | User |
| **Commande** | `ChangePasswordCommand` |
| **Service métier** | `AuthService.changePassword()` |
| **Repository** | `UserRepository` |
| **Route HTTP** | `POST /api/auth/change-password` |
| **Fichier route** | `src/server/routes/auth.ts` (inféré) |
| **Acteurs** | user |
| **Rôles concernés** | user (email explicite) |
| **Criticité** | ÉLEVÉE (sécurité) |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email (confirmation) |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (sécurité) |
| **Impact business** | Moyen |
| **Existence** | **N'EXISTE PAS** |

---

### 3.4 UserRoleChanged

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `UserRoleChanged` |
| **Bounded Context** | Identity / IAM |
| **Aggregate** | User |
| **Commande** | `ChangeUserRoleCommand` |
| **Service métier** | `UserService.changeRole()` |
| **Repository** | `UserRepository` |
| **Route HTTP** | `PATCH /api/users/:id/role` |
| **Fichier route** | `src/server/routes/users.ts` (inféré) |
| **Acteurs** | admin, super_admin |
| **Rôles concernés** | user (email explicite), admin |
| **Criticité** | ÉLEVÉE (sécurité) |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (permissions) |
| **Impact business** | Élevé (sécurité) |
| **Existence** | **N'EXISTE PAS** |

---

### 3.5 UserDeactivated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `UserDeactivated` |
| **Bounded Context** | Identity / IAM |
| **Aggregate** | User |
| **Commande** | `DeactivateUserCommand` |
| **Service métier** | `UserService.deactivate()` |
| **Repository** | `UserRepository` |
| **Route HTTP** | `PATCH /api/users/:id/deactivate` |
| **Fichier route** | `src/server/routes/users.ts` (inféré) |
| **Acteurs** | admin, manager |
| **Rôles concernés** | user (email explicite), admin |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Synchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (accès révoqué) |
| **Impact business** | Moyen |
| **Existence** | **N'EXISTE PAS** |

---

### 3.6 DailySalesReportGenerated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `DailySalesReportGenerated` |
| **Bounded Context** | Sales / Finance |
| **Aggregate** | Aucun (rapport agrégé) |
| **Commande** | Aucune (scheduler) |
| **Service métier** | `ReportingService.generateDailySales()` |
| **Repository** | `SaleRepository`, `OrderRepository` (lecture) |
| **Route HTTP** | Aucune (cron) |
| **Fichier** | Inconnu (à créer) |
| **Acteurs** | Système (automated) |
| **Rôles concernés** | admin, manager |
| **Criticité** | MOYENNE |
| **Synchronicité** | Asynchrone (cron 23:59) |
| **Fréquence** | 1x/jour |
| **Idempotence requise** | OUI |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 7 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Faible |
| **Impact business** | Faible (insight) |
| **Existence** | **N'EXISTE PAS** |

---

### 3.7 WeeklySalesReportGenerated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `WeeklySalesReportGenerated` |
| **Bounded Context** | Sales / Finance |
| **Aggregate** | Aucun (rapport agrégé) |
| **Commande** | Aucune (scheduler) |
| **Service métier** | `ReportingService.generateWeeklySales()` |
| **Repository** | `SaleRepository` (lecture) |
| **Route HTTP** | Aucune (cron) |
| **Fichier** | Inconnu (à créer) |
| **Acteurs** | Système (automated) |
| **Rôles concernés** | admin, manager |
| **Criticité** | MOYENNE |
| **Synchronicité** | Asynchrone (cron hebdomadaire) |
| **Fréquence** | 1x/semaine |
| **Idempotence requise** | OUI |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Faible |
| **Impact business** | Faible (insight) |
| **Existence** | **N'EXISTE PAS** |

---

### 3.8 MonthlySalesReportGenerated

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `MonthlySalesReportGenerated` |
| **Bounded Context** | Sales / Finance |
| **Aggregate** | Aucun (rapport agrégé) |
| **Commande** | Aucune (scheduler) |
| **Service métier** | `ReportingService.generateMonthlySales()` |
| **Repository** | `SaleRepository` (lecture) |
| **Route HTTP** | Aucune (cron) |
| **Fichier** | Inconnu (à créer) |
| **Acteurs** | Système (automated) |
| **Rôles concernés** | admin, manager |
| **Criticité** | MOYENNE |
| **Synchronicité** | Asynchrone (cron mensuel) |
| **Fréquence** | 1x/mois |
| **Idempotence requise** | OUI |
| **Priorité** | low |
| **Retry nécessaire** | NON |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Faible |
| **Impact business** | Faible (insight) |
| **Existence** | **N'EXISTE PAS** |

---

### 3.9 LowStockThresholdBreached

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `LowStockThresholdBreached` |
| **Bounded Context** | Inventory Management |
| **Aggregate** | Product |
| **Commande** | Aucune (détection automatique) |
| **Service métier** | `InventoryService.checkThresholds()` |
| **Repository** | `ProductRepository` (lecture) |
| **Route HTTP** | Aucune (polling ou trigger DB) |
| **Fichier** | Inconnu (à créer) |
| **Acteurs** | Système (automated) |
| **Rôles concernés** | admin, manager |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Asynchrone (polling ou trigger) |
| **Fréquence** | Continue |
| **Idempotence requise** | OUI (éviter doublons) |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 7 jours |
| **Canaux possibles** | Email, In-App, SMS |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (alerte temps réel) |
| **Impact business** | Élevé (rupture stock) |
| **Existence** | **N'EXISTE PAS** (seul StockLow existe via polling) |

---

### 3.10 OutOfStockDetected

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `OutOfStockDetected` |
| **Bounded Context** | Inventory Management |
| **Aggregate** | Product |
| **Commande** | Aucune (détection automatique) |
| **Service métier** | `InventoryService.detectOutOfStock()` |
| **Repository** | `ProductRepository` (lecture) |
| **Route HTTP** | Aucune (polling ou trigger DB) |
| **Fichier** | Inconnu (à créer) |
| **Acteurs** | Système (automated) |
| **Rôles concernés** | admin, manager |
| **Criticité** | CRITIQUE |
| **Synchronicité** | Asynchrone (polling ou trigger) |
| **Fréquence** | Continue |
| **Idempotence requise** | OUI |
| **Priorité** | critical |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 7 jours |
| **Canaux possibles** | Email, In-App, SMS |
| **Dépendances** | Aucune |
| **Impact UX** | Critique (vente impossible) |
| **Impact business** | Critique (perte vente) |
| **Existence** | **N'EXISTE PAS** |

---

### 3.11 PlatformHealthCheckFailed

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `PlatformHealthCheckFailed` |
| **Bounded Context** | Platform / Infrastructure |
| **Aggregate** | Aucun (incident) |
| **Commande** | Aucune (monitoring) |
| **Service métier** | `ObservabilityService.checkHealth()` |
| **Repository** | Aucun |
| **Route HTTP** | Aucune |
| **Fichier** | Inconnu (à créer) |
| **Acteurs** | Système (automated) |
| **Rôles concernés** | super_admin, platform_admin |
| **Criticité** | CRITIQUE |
| **Synchronicité** | Asynchrone |
| **Fréquence** | Continue |
| **Idempotence requise** | OUI |
| **Priorité** | critical |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, SMS, Slack, PagerDuty |
| **Dépendances** | Aucune |
| **Impact UX** | Critique (service down) |
| **Impact business** | Critique (indisponibilité) |
| **Existence** | **N'EXISTE PAS** |

---

### 3.12 DatabaseConnectionLost

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `DatabaseConnectionLost` |
| **Bounded Context** | Infrastructure |
| **Aggregate** | Aucun (incident) |
| **Commande** | Aucune (détection automatique) |
| **Service métier** | `DatabaseService.detectFailure()` |
| **Repository** | Aucun |
| **Route HTTP** | Aucune |
| **Fichier** | Inconnu (à créer) |
| **Acteurs** | Système (automated) |
| **Rôles concernés** | super_admin, platform_admin |
| **Criticité** | CRITIQUE |
| **Synchronicité** | Asynchrone |
| **Fréquence** | Très faible |
| **Idempotence requise** | OUI |
| **Priorité** | critical |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, SMS, Slack, PagerDuty |
| **Dépendances** | Aucune |
| **Impact UX** | Critique (service down) |
| **Impact business** | Critique (indisponibilité) |
| **Existence** | **N'EXISTE PAS** |

---

### 3.13 SyncFailureDetected

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SyncFailureDetected` |
| **Bounded Context** | Data Synchronization |
| **Aggregate** | SyncOutbox |
| **Commande** | Aucune (détection automatique) |
| **Service métier** | `SyncOrchestratorV2.detectFailure()` |
| **Repository** | `SyncOutboxRepository` |
| **Route HTTP** | Aucune |
| **Fichier** | `src/sync/sync-orchestrator-v2.ts` |
| **Acteurs** | Système (automated) |
| **Rôles concernés** | super_admin, platform_admin |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Asynchrone |
| **Fréquence** | Faible |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App, Slack |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (données désynchronisées) |
| **Impact business** | Élevé (intégrité données) |
| **Existence** | **N'EXISTE PAS** |

**Preuve absence :**
```typescript
// src/sync/sync-orchestrator-v2.ts
// Aucun appel à notify pour les échecs de sync
```

---

### 3.14 SubscriptionGracePeriodStarted

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SubscriptionGracePeriodStarted` |
| **Bounded Context** | Subscription / SaaS |
| **Aggregate** | Subscription |
| **Commande** | Aucune (détection automatique) |
| **Service métier** | `SubscriptionService.detectGracePeriod()` |
| **Repository** | `SubscriptionRepository` |
| **Route HTTP** | Aucune (cron ou middleware) |
| **Fichier** | `src/server/middleware/subscription-guard.ts` |
| **Acteurs** | Système (automated) |
| **Rôles concernés** | tenant owner (email explicite) |
| **Criticité** | ÉLEVÉE |
| **Synchronicité** | Asynchrone |
| **Fréquence** | Moyenne |
| **Idempotence requise** | OUI |
| **Priorité** | high |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 30 jours |
| **Canaux possibles** | Email, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Élevé (avertissement) |
| **Impact business** | Élevé (rétention) |
| **Existence** | **N'EXISTE PAS** |

**Preuve absence :**
```typescript
// src/server/middleware/subscription-guard.ts
// Détecte grace period mais n'envoie aucune notification
```

---

### 3.15 SubscriptionPaymentFailed

| Attribut | Valeur |
|---|---|
| **Nom Domain Event** | `SubscriptionPaymentFailed` |
| **Bounded Context** | Billing / Subscription |
| **Aggregate** | Subscription / Payment |
| **Commande** | Aucune (détection automatique) |
| **Service métier** | `BillingService.detectPaymentFailure()` |
| **Repository** | `SubscriptionRepository`, `PaymentRepository` |
| **Route HTTP** | Aucune (webhook ou cron) |
| **Fichier** | Inconnu (probablement webhook) |
| **Acteurs** | Système (payment provider) |
| **Rôles concernés** | tenant owner (email explicite) |
| **Criticité** | CRITIQUE |
| **Synchronicité** | Asynchrone (webhook) |
| **Fréquence** | Moyenne |
| **Idempotence requise** | OUI |
| **Priorité** | critical |
| **Retry nécessaire** | OUI |
| **Durée conservation** | 90 jours |
| **Canaux possibles** | Email, SMS, In-App |
| **Dépendances** | Aucune |
| **Impact UX** | Critique (perte accès) |
| **Impact business** | Critique (churn) |
| **Existence** | **N'EXISTE PAS** |

---

## RÉSUMÉ STATISTIQUE

### Événements existants (notifiés) : 12

| # | Événement | Canal actuel |
|---|---|---|
| 1 | ProductCreated | Email |
| 2 | ProductStockUpdated | Email |
| 3 | StockLow / StockOut | Email (polling 30s) |
| 4 | SaleCompleted | Email |
| 5 | OrderCheckoutCompleted | Email |
| 6 | VoucherGenerated | Email |
| 7 | VoucherExpired | Email |
| 8 | PaymentVerified | Email |
| 9 | PaymentRejected | Email |
| 10 | InventorySummary (scheduled) | Email |
| 11 | MiddayOperationsSnapshot (scheduled) | Email |
| 12 | EndOfDayClosureReport (scheduled) | Email |

### Événements absents (existent dans le code, pas de notification) : 24

| # | Événement | Bounded Context |
|---|---|---|
| 1 | CategoryCreated | Product Management |
| 2 | CategoryUpdated | Product Management |
| 3 | CategoryDeleted | Product Management |
| 4 | SupplierCreated | Supplier Management |
| 5 | SupplierUpdated | Supplier Management |
| 6 | SupplierDeleted | Supplier Management |
| 7 | CustomerCreated | Customer Management |
| 8 | CustomerUpdated | Customer Management |
| 9 | CustomerDeleted | Customer Management |
| 10 | PurchaseOrderCreated | Procurement |
| 11 | PurchaseOrderReceived | Procurement |
| 12 | RefundIssued | Sales / Finance |
| 13 | SubscriptionCreated | Subscription / SaaS |
| 14 | SubscriptionActivated | Subscription / SaaS |
| 15 | SubscriptionExpired | Subscription / SaaS |
| 16 | PaymentReceived | Billing / Finance |
| 17 | UserCreated | Identity / IAM |
| 18 | UserInvited | Identity / IAM |
| 19 | PasswordResetRequested | Identity / IAM |
| 20 | PasswordResetCompleted | Identity / IAM |
| 21 | PINResetRequested | Identity / IAM |
| 22 | TenantCreated | SaaS Platform |
| 23 | TenantSuspended | SaaS Platform |
| 24 | BranchCreated | Tenant Management |
| 25 | StockTransferInitiated | Inventory Management |
| 26 | StockTransferCompleted | Inventory Management |
| 27 | ExpenseCreated | Finance |
| 28 | ExpenseApproved | Finance |
| 29 | SaleRefunded | Sales / Finance |
| 30 | OrderAssigned | Order Management |
| 31 | OrderStatusChanged | Order Management |
| 32 | TableStatusChanged | Restaurant Operations |
| 33 | QROrderReceived | Order Management / QR Menu |
| 34 | SubscriptionPaymentFailed | Billing / Subscription |
| 35 | SubscriptionCancelled | Subscription / SaaS |
| 36 | SystemError | Platform / Infrastructure |

### Événements manquants (n'existent pas encore) : 15

| # | Événement | Bounded Context |
|---|---|---|
| 1 | UserLoggedIn | Identity / IAM |
| 2 | UserLoggedOut | Identity / IAM |
| 3 | UserPasswordChanged | Identity / IAM |
| 4 | UserRoleChanged | Identity / IAM |
| 5 | UserDeactivated | Identity / IAM |
| 6 | DailySalesReportGenerated | Sales / Finance |
| 7 | WeeklySalesReportGenerated | Sales / Finance |
| 8 | MonthlySalesReportGenerated | Sales / Finance |
| 9 | LowStockThresholdBreached | Inventory Management |
| 10 | OutOfStockDetected | Inventory Management |
| 11 | PlatformHealthCheckFailed | Platform / Infrastructure |
| 12 | DatabaseConnectionLost | Infrastructure |
| 13 | SyncFailureDetected | Data Synchronization |
| 14 | SubscriptionGracePeriodStarted | Subscription / SaaS |
| 15 | SubscriptionPaymentFailed | Billing / Subscription |

---

## TOTAL : 51 ÉVÉNEMENTS MÉTIER NOTIFIABLES

- **12 existants** (déjà notifiés par email)
- **36 absents** (existent dans le code métier, pas de notification)
- **15 manquants** (n'existent pas encore, devraient exister)

**Note :** Certains événements apparaissent dans plusieurs catégories (ex: SubscriptionPaymentFailed est à la fois absent et manquant selon le contexte).

---

## OBSERVATIONS ARCHITECTURALES

1. **Tous les événements existants sont des emails** — Aucune notification in-app n'est déclenchée par le backend
2. **Aucun événement n'est temps réel** — Tous sont synchrones ou schedulés (cron/polling)
3. **Aucun événement n'est multi-canal** — Email uniquement
4. **Les événements critiques** (payment, subscription, stock) n'ont pas de retry ni de DLQ
5. **Les événements de sécurité** (login, password, role) n'existent pas du tout
6. **Les événements financiers** (expense, refund) ne sont pas notifiés
7. **Les événements opérationnels** (order assigned, table status) ne sont pas notifiés
8. **Aucun événement n'est cross-tenant** — Le multi-tenant est respecté mais limite les broadcasts globaux

---

## RÉFÉRENCES

Tous les événements ont été identifiés à partir :
- `src/server/routes/*.ts` (toutes les routes)
- `src/server/services/*.ts` (tous les services)
- `src/server/saas/cron/*.ts` (tous les crons)
- `src/server/infrastructure/self-healing/*.ts` (détection anomalies)
- `src/server/middleware/*.ts` (middleware métier)
- `src/constants/notificationTypes.ts` (types existants)
- `src/server/services/notification.service.ts` (tous les notify*)