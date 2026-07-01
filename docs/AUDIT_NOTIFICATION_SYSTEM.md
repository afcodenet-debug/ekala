# AUDIT D'ARCHITECTURE — SYSTÈME DE NOTIFICATIONS EKALA

**Date :** 28/06/2026  
**Objectif :** Audit complet du système de notifications existant  
**Règle :** Aucune modification, aucune proposition, uniquement des faits issus du code

---

## 1. INVENTAIRE COMPLET DES FICHIERS

### Fichiers serveur (email / notification)

| Fichier | Rôle | Dépendances |
|---|---|---|
| `src/server/services/notification.service.ts` (1973 lignes) | Service central d'envoi d'emails. Contient : transport SMTP, builders HTML, broadcast, scheduling, stock movement polling | nodemailer, db (SQLite), NOTIFICATION_TYPES, tenant-context |
| `src/server/services/email-templates.ts` (120 lignes) | Templates HTML pour les emails liés aux vouchers (généré, expiré, validé, rejeté) | Aucune dépendance externe |
| `src/server/services/billing-expiration.service.ts` (284 lignes) | Expiration automatique des vouchers + suspension tenant/subscription + envoi email | @supabase/supabase-js, env, notification.service, email-templates |
| `src/server/saas/cron/expiration.cron.ts` (240 lignes) | Cron job legacy : expire vouchers + subscriptions + nettoie logs. Envoie emails via sendEmailDirect | db, notification.service, email-templates |
| `src/server/saas/cron/voucher-expiration.cron.ts` (58 lignes) | Cron job dédié : expire vouchers toutes les 5 min via BillingExpirationService | billing-expiration.service |

### Fichiers serveur (routes notifications)

| Fichier | Rôle | Dépendances |
|---|---|---|
| `src/server/routes/notifications.ts` (141 lignes) | CRUD API pour la table `notifications` (GET, POST, PATCH read) | express, @supabase/supabase-js, env |
| `src/server/routes/notification_preferences.ts` | Routes pour les préférences de notification | express |

### Fichiers serveur (Event Bus)

| Fichier | Rôle | Dépendances |
|---|---|---|
| `src/server/platform/event-bus.service.ts` (192 lignes) | Event Bus pour RBAC (role.updated, permission.updated, user.status.changed, tenant.status.changed). In-memory + Redis fallback (non connecté) | Aucune (standalone) |
| `src/server/domain/subscription/events/InMemoryEventBus.ts` (59 lignes) | Event Bus pour le domaine subscription (V2). Implémente IEventBus | SubscriptionEvents |
| `src/server/domain/subscription/events/SubscriptionEvents.ts` | Définit les interfaces IEventBus, IEventHandler, SubscriptionDomainEvent | Aucune |

### Fichiers serveur (Queue / Audit)

| Fichier | Rôle | Dépendances |
|---|---|---|
| `src/server/platform/audit-queue.service.ts` | Queue d'audit pour les événements platform | Aucune |
| `src/server/platform/circuit-breaker.service.ts` | Circuit breaker pour la plateforme | Aucune |

### Fichiers frontend (UI Notifications)

| Fichier | Rôle | Dépendances |
|---|---|---|
| `src/components/NotificationCenter.tsx` (382 lignes) | Panneau latéral de notifications (drawer). Affiche la liste, filtres unread/all, marquage lu | useNotificationStore, lucide-react |
| `src/components/GlobalNotificationToast.tsx` (240 lignes) | Toast global pour les notifications haute priorité. S'affiche en haut à droite | useNotificationStore, useSettingsStore, react-router-dom, lucide-react |
| `src/stores/useNotificationStore.ts` (114 lignes) | Store Zustand pour les notifications in-app. Gère add, markAsRead, markAllAsRead, ingestNotifications, getVisibleNotifications | zustand, notificationTypes |
| `src/constants/notificationTypes.ts` (30 lignes) | Constantes des types de notification (LOW_STOCK, INVENTORY, SALES, NEW_QR_ORDER, etc.) | Aucune |

### Fichiers sync (Outbox / Queue)

| Fichier | Rôle |
|---|---|
| `src/sync/core/generic-sync.service.ts` | Service générique de sync. Queue les changements dans `sync_outbox` |
| `src/sync/product-sync.service.ts` | Sync produits. Queue dans `sync_outbox` |
| `src/sync/order-sync.service.ts` | Sync commandes. Queue dans `sync_outbox` |
| `src/sync/sale-sync.service.ts` | Sync ventes. Queue dans `sync_outbox` |
| `src/sync/sync-helper.ts` | Helper `queueSyncChange()` pour ajouter l'outbox dans les routes |
| `src/sync/core/ensure-sync-tables.ts` | Crée/valide la table `sync_outbox` |
| `src/sync/core/dead-letter-queue.ts` | Dead letter queue pour les échecs de sync |
| `src/sync/with-outbox-transaction.ts` | Wrapper transactionnel pour outbox |
| `src/sync/sync-orchestrator-v2.ts` | Orchestrateur V2. Contient un scheduler (setInterval 30s) |

---

## 2. FLUX COMPLET DES E-MAILS

### Flux général (notification.service.ts)

```
Appel métier (ex: notifySale, notifyLowStockAlert, notifyNewProduct, etc.)
  ↓
broadcastNotification(type, subject, htmlBody, settingsRaw)
  ↓
getRecipientsForNotification(settingsRaw, type)
  ↓
  Lit role_notification_config depuis settings (JSON)
  ↓
  Trouve les rôles autorisés pour ce type de notification
  ↓
  SELECT email FROM users WHERE LOWER(role) IN (rôles) AND is_active=1 AND tenant_id=?
  ↓
sendEmail(subject, htmlBody, settings, recipients[])
  ↓
getTransporter(settings)
  ↓
  Si gmail → nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, auth: { user, pass } })
  Si ethereal → nodemailer.createTestAccount() + createTransport
  Si custom → SMTP config
  ↓
transporter.sendMail({ from, to, subject, html, bcc })
  ↓
Email envoyé ✓
```

### Flux alternatif (sendEmailDirect)

```
Appel (ex: BillingExpirationService, ExpirationCron)
  ↓
sendEmailDirect(subject, body, settingsRaw, to, bcc?)
  ↓
getTransporter(settings)
  ↓
transporter.sendMail({ from, to, subject, html, bcc })
```

### Templates HTML utilisés

- `buildEmailHTML()` — Template principal avec header/footer, line items, total, staff section
- `buildStockAlertHTML()` — Template pour alertes stock (out of stock + low stock)
- `buildInventorySummaryHTML()` — Template pour le rapport d'inventaire (KPI grid, top risk items)
- `buildVoucherGeneratedEmail()` — Template voucher généré (code, montant, dates)
- `buildVoucherExpiredEmail()` — Template voucher expiré
- `buildPaymentVerifiedEmailHTML()` — Template paiement validé
- `buildPaymentRejectedEmailHTML()` — Template paiement rejeté

---

## 3. ÉVÉNEMENTS DÉCLENCHEURS D'E-MAILS

### Fonctions exportées de notification.service.ts

| Fonction | Déclencheur | Type notification |
|---|---|---|
| `notifyLowStockAlert(products, settingsRaw)` | Stock bas / rupture | `LOW_STOCK` |
| `notifyNewProduct(productName, productData, settingsRaw)` | Création produit | `NEW_PRODUCT` |
| `notifyStockAdjustment(productName, productId, qtyBefore, qtyChanged, qtyAfter, reason, performedBy, currency, settingsRaw)` | Ajustement manuel de stock | `STOCK_ADJUSTMENT` |
| `notifyInventoryUpdate(eventName, items, note, currency, settingsRaw)` | Mise à jour inventaire | `INVENTORY` |
| `notifySale(invoiceNumber, items, grandTotal, paymentMethod, tableLabel, waiterName, cashierName, currency, settingsRaw)` | Vente / checkout | `SALES` |
| `notifyOrderCheckout(orderId, items, grandTotal, paymentMethod, tableLabel, waiterName, cashierName, currency, settingsRaw)` | Commande checkout | `ORDER_CONFIRM` |
| `notifyStockMovement(movement, settingsRaw)` | Mouvement de stock (via polling scheduler) | `STOCK_ADJUSTMENT` |
| `notifyInventorySummary(settingsRaw)` | Rapport programmé (6:30, 9:30, 13:30) | N/A (sendEmail direct) |

### Fonctions de billing-expiration.service.ts

| Fonction | Déclencheur |
|---|---|
| `expireTenantVouchers(tenantId)` | Voucher expiré (verification_deadline dépassée) |
| `expireAllVouchers()` | Cron toutes les 5 min |

### Fonctions de expiration.cron.ts

| Fonction | Déclencheur |
|---|---|
| `expireVouchers()` | Cron toutes les 5 min (legacy) |
| `expireSubscriptions()` | Cron toutes les 5 min |
| `cleanupOldLogs()` | Cron toutes les 5 min |

### Fonctions de voucher-expiration.cron.ts

| Fonction | Déclencheur |
|---|---|
| `runExpiration()` | Cron toutes les 5 min (via BillingExpirationService) |

---

## 4. NOTIFICATIONSERVICE / EMAILSERVICE

### Existe-t-il un NotificationService ?

**OUI** — `src/server/services/notification.service.ts`

**Responsabilités :**
- Envoi d'emails transactionnels (stock, ventes, inventaire, produits)
- Gestion du transport SMTP (Gmail, Ethereal, custom)
- Résolution des destinataires basée sur les rôles (role_notification_config)
- Templates HTML intégrés (buildEmailHTML, buildStockAlertHTML, etc.)
- Scheduling : inventaire 3x/jour, stock movements par polling
- Broadcast pattern via `broadcastNotification()`

**API publique :**
- `sendEmailDirect(subject, body, settingsRaw, to, bcc?)` → envoi direct à un email
- `broadcastNotification(type, subject, htmlBody, settingsRaw)` → envoi à tous les destinataires configurés
- `notifyLowStockAlert(products, settingsRaw)`
- `notifyNewProduct(productName, productData, settingsRaw)`
- `notifyStockAdjustment(...)`
- `notifyInventoryUpdate(eventName, items, note, currency, settingsRaw)`
- `notifySale(...)`
- `notifyOrderCheckout(...)`
- `notifyStockMovement(movement, settingsRaw)`
- `loadRawSettings()` / `loadRawSettingsAsync()`
- `readEmailSettings(raw)` → transforme les settings bruts en EmailSettings
- `scheduleInventorySummaryEmails()` → démarre le scheduler 3x/jour
- `scheduleStockMovementEmails()` → démarre le polling des mouvements de stock

**Dépendances :**
- nodemailer (npm)
- db (SQLite)
- NOTIFICATION_TYPES (constants)
- getCurrentTenantId (tenant-context)

### Existe-t-il un EmailService dédié ?

**NON** — Tout est dans `notification.service.ts`. Pas de classe `EmailService` ou `MailerService` séparée.

---

## 5. EVENT BUS

### Existe-t-il un Event Bus ?

**OUI, deux implémentations distinctes :**

#### 1. EventBusService (platform) — `src/server/platform/event-bus.service.ts`

- **Événements supportés :** `role.updated`, `permission.updated`, `user.status.changed`, `tenant.status.changed`
- **Type :** In-memory avec fallback Redis (non connecté)
- **Handlers enregistrés :** 4 handlers par défaut (invalidation de cache — mais tous commentés)
- **Utilisation réelle :** Aucune. Les handlers sont des `console.log` vides. Le service est instancié mais jamais appelé dans le code métier.

#### 2. InMemoryEventBus (subscription V2) — `src/server/domain/subscription/events/InMemoryEventBus.ts`

- **Type :** In-memory, implémente `IEventBus`
- **Événements :** Définis dans `SubscriptionEvents.ts` (SubscriptionDomainEvent)
- **Utilisation :** Utilisé dans l'architecture V2 subscription (tests unitaires)
- **Pas utilisé en production** pour les notifications

### Événements publiés / consommés

| Event Bus | Événements publiés | Événements consommés |
|---|---|---|
| EventBusService (platform) | Aucun (code mort) | Aucun (handlers vides) |
| InMemoryEventBus (subscription) | SubscriptionDomainEvent (tests) | Tests uniquement |

---

## 6. SYSTÈME DE QUEUE

### Existe-t-il un système de Queue ?

**OUI, mais uniquement pour la synchronisation des données (sync_outbox), PAS pour les notifications.**

#### sync_outbox (SQLite)

- **Table :** `sync_outbox` (id, entity, operation, record_id, payload, version, status, retry_count, last_error, tenant_id, created_at, updated_at)
- **Mécanisme :** Outbox pattern — les changements sont écrits dans sync_outbox, puis un worker push vers Supabase
- **Utilisé par :** GenericSyncService, ProductSyncService, OrderSyncService, SaleSyncService
- **Scheduler :** SyncOrchestratorV2.startScheduler(30000) — toutes les 30 secondes
- **Dead letter queue :** `sync_dlq` pour les échecs définitifs

#### Audit Queue (platform)

- **Fichier :** `src/server/platform/audit-queue.service.ts`
- **Rôle :** Queue d'audit pour les événements platform
- **Utilisation réelle :** Non déterminée (probablement inutilisée)

#### Request Queue (frontend)

- **Fichier :** `src/lib/request-queue.ts`
- **Rôle :** Queue de requêtes pour le mode offline frontend

### Conclusion : Pas de queue pour les notifications email. Les envois sont synchrones (await sendEmail).

---

## 7. SYSTÈME DE TEMPLATES

### Existe-t-il un système de Templates ?

**OUI, mais artisanal (pas de moteur de templates externe).**

**Type :** Templates HTML inline dans le code TypeScript

**Fichiers :**
- `src/server/services/notification.service.ts` — Contient :
  - `buildEmailHTML()` — Template principal (header, line items, total, staff)
  - `buildStockAlertHTML()` — Template alertes stock
  - `buildInventorySummaryHTML()` — Template rapport inventaire
  - `buildHeader()`, `buildFooter()`, `buildLineItems()`, `buildTotalSection()`, `buildStaffSection()` — Sous-composants réutilisables
- `src/server/services/email-templates.ts` — Contient :
  - `buildVoucherGeneratedEmail()`
  - `buildVoucherExpiredEmail()`
  - `buildPaymentVerifiedEmailHTML()`
  - `buildPaymentRejectedEmailHTML()`

**Design system :** Palette cohérente (Charcoal #1a1a1f, Gold #c9a84c, Warm white #f7f4ef)

**Absence de :** MJML, Handlebars, React Email, EJS, Mustache

---

## 8. NOTIFICATIONS UI

### Composants existants

| Composant | Fichier | Type | Description |
|---|---|---|---|
| `NotificationCenter` | `src/components/NotificationCenter.tsx` | Drawer latéral | Panneau de notifications avec liste, filtres, marquage lu |
| `GlobalNotificationToast` | `src/components/GlobalNotificationToast.tsx` | Toast | Toast global pour notifications haute priorité |
| `Alert` | `src/components/Alert.tsx` | Composant UI | Composant d'alerte générique (non lié aux notifications) |

### Store

| Store | Fichier | Description |
|---|---|---|
| `useNotificationStore` | `src/stores/useNotificationStore.ts` | Store Zustand : notifications[], unreadCount, addNotification, markAsRead, markAllAsRead, clearAll, ingestNotifications, getVisibleNotifications |

### Types de notifications in-app (constants/notificationTypes.ts)

- `lowStock`, `inventory`, `stockAdj`, `sales`, `outOfStock`, `productDeleted`, `newProduct`, `orderConfirm`
- `newQrOrder`, `orderAssigned`, `stockLow`, `paymentFailed`, `dailyClosure`, `systemError`, `pendingTooLong`
- `tableDuplicate`, `tableError`, `systemInfo`

### Priorités : `low`, `medium`, `high`, `critical`

### État actuel
- Les notifications in-app sont stockées UNIQUEMENT en mémoire (Zustand)
- Pas de persistance locale (sauf mention "Données stockées localement sur cet appareil" dans le footer)
- La fonction `loadFromServer()` est définie dans l'interface mais marquée "Future: Phase 3"
- `ingestNotifications()` permet d'injecter des notifications depuis le serveur mais n'est jamais appelée
- `getVisibleNotifications(role)` filtre par rôle (waiter, cashier) mais n'est pas utilisé dans NotificationCenter

---

## 9. NOTIFICATIONS TEMPS RÉEL

### Existe-t-il un système temps réel ?

**NON** — Aucun système de notifications temps réel n'est implémenté.

### Ce qui existe :

| Technologie | Statut |
|---|---|
| WebSocket | Absent |
| Socket.io | Absent |
| Supabase Realtime | Utilisé UNIQUEMENT pour la sync des données (supabase-realtime-sync.service.ts), PAS pour les notifications |
| SSE | Absent |
| Polling | Utilisé pour les emails de stock movement (setInterval 30s) et les crons (5 min) |
| Firebase | Absent |
| Pusher | Absent |
| Ably | Absent |

### Supabase Realtime existant :
- `src/server/services/supabase-realtime-sync.service.ts` — Utilisé pour la synchronisation bidirectionnelle des données (orders, products)
- Pas utilisé pour pousser des notifications vers le frontend

---

## 10. NOTIFICATIONS MOBILES

### Existe-t-il un système de notifications mobiles ?

**NON** — Aucun.

| Technologie | Statut |
|---|---|
| Expo Notifications | Absent |
| Firebase Cloud Messaging | Absent |
| APNs | Absent |
| OneSignal | Absent |
| Push Notifications | Absent |

---

## 11. AUDIT RBAC

### Comment les notifications sont-elles ciblées ?

**Mécanisme existant :** `role_notification_config` (JSON stocké dans la table `settings`)

**Fonctionnement (notification.service.ts, lignes 1197-1294) :**
1. Lecture de `role_notification_config` depuis les settings
2. Pour chaque rôle, vérification si le type de notification est activé
3. Requête SQL : `SELECT email FROM users WHERE LOWER(role) IN (rôles autorisés) AND is_active=1 AND tenant_id=?`
4. Envoi aux emails trouvés

**Structure de role_notification_config (inférée du code) :**
```json
{
  "admin": {
    "notifications": {
      "lowStock": true,
      "sales": true,
      "newProduct": true
    }
  },
  "manager": {
    "notifications": {
      "lowStock": true,
      "sales": false
    }
  }
}
```

**Rôles supportés (table users) :** admin, manager, cashier, waiter, super_admin, platform_admin

**Limites :**
- Pas de ciblage par utilisateur individuel (uniquement par rôle)
- Pas de ciblage par tenant (déjà scope par tenant_id)
- Pas de ciblage par business/branch
- Le filtre `getVisibleNotifications(role)` dans le store frontend est défini mais pas utilisé

---

## 12. AUDIT MULTI-TENANT

### Le système permet-il de notifier...

| Scénario | Supporté ? | Détail |
|---|---|---|
| Un seul utilisateur | Partiellement | sendEmailDirect() permet d'envoyer à un email spécifique |
| Tous les admins d'un tenant | Oui | Via role_notification_config + requête par tenant_id |
| Tous les managers | Oui | Via role_notification_config |
| Tout le restaurant | Oui | En activant tous les rôles dans la config |
| Toute la plateforme | Non | Pas de mécanisme de broadcast cross-tenant |
| Plusieurs tenants | Non | Chaque envoi est scope par tenant_id |

**Mécanisme :** Le tenant_id est injecté via `getCurrentTenantId()` et utilisé dans la requête SQL pour filtrer les utilisateurs.

---

## 13. AUDIT OFFLINE / SYNC

### Le système de synchronisation peut-il transporter des notifications ?

**NON** — Le système de sync (outbox) est conçu pour les données métier (produits, commandes, etc.), pas pour les notifications.

**Ce qui existe :**
- `sync_outbox` table — Queue les changements pour sync vers Supabase
- `GenericSyncService` — Push/Pull pour toutes les entités
- `SyncOrchestratorV2` — Orchestrateur avec scheduler 30s

**Ce qui manque :**
- Pas de table `notifications` dans l'outbox
- Pas de mécanisme de sync pour les notifications in-app
- Les notifications in-app sont uniquement en mémoire (Zustand)

---

## 14. AUDIT BASE DE DONNÉES

### Tables liées aux notifications

#### Table `notifications` (SQLite + Supabase)

**Schéma (inféré du code) :**
```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  title TEXT,
  message TEXT,
  priority TEXT DEFAULT 'medium',
  notification_type TEXT,
  metadata TEXT,  -- JSON
  link TEXT,
  user_id INTEGER,
  role TEXT,
  tenant_id INTEGER NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Utilisation :**
- CRUD via `/api/notifications` (GET, POST, PATCH)
- Supporte SQLite (local) et Supabase (cloud)
- Routes : `src/server/routes/notifications.ts`

#### Table `sync_outbox` (SQLite uniquement)

```sql
CREATE TABLE sync_outbox (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id TEXT,
  payload TEXT,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  tenant_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Table `sync_dlq` (Dead Letter Queue)

```sql
CREATE TABLE sync_dlq (
  id TEXT PRIMARY KEY,
  entity TEXT,
  operation TEXT,
  record_id TEXT,
  payload TEXT,
  error TEXT,
  tenant_id TEXT,
  failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Table `settings` (contient la config notification)

```sql
-- Clés pertinentes :
-- email_notifications_enabled
-- email_provider, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass
-- email_forward_to
-- notify_stock_adjustment, notify_inventory_update, notify_low_stock, notify_out_of_stock
-- notify_new_product, notify_product_deleted, notify_sales
-- role_notification_config (JSON)
-- last_stock_movement_email_id
-- app_currency, app_name
```

#### Autres tables liées (vouchers)

- `voucher_requests` — Contient `customer_email` pour les notifications de voucher
- `subscription_payment_requests` — Legacy

---

## 15. AUDIT API

### Routes existantes

| Route | Méthode | Description | Fichier |
|---|---|---|---|
| `/api/notifications` | GET | Liste des notifications (filtre: role, unread_only) | `src/server/routes/notifications.ts` |
| `/api/notifications` | POST | Créer une notification | `src/server/routes/notifications.ts` |
| `/api/notifications/:id/read` | PATCH | Marquer comme lue | `src/server/routes/notifications.ts` |
| `/api/notification_preferences` | GET/POST | Préférences de notification | `src/server/routes/notification_preferences.ts` |
| `/api/scheduled_reports_log` | GET/POST | Logs des rapports programmés | `src/server/routes/scheduled_reports_log.ts` |

### Routes absentes

- `/api/notifications/read-all` (mark all as read côté serveur)
- `/api/notifications/:id` DELETE
- `/api/notifications/broadcast`
- `/api/websocket` ou `/api/realtime`

---

## 16. AUDIT FRONTEND (HOOKS)

### Hooks existants

| Hook | Fichier | Description |
|---|---|---|
| `useNotificationStore` | `src/stores/useNotificationStore.ts` | Store Zustand (pas un hook React standard, mais utilisé via `useNotificationStore()`) |
| `useSettingsStore` | `src/stores/useSettingsStore.ts` | Store des settings (utilisé par GlobalNotificationToast pour la langue) |

### Hooks absents

- `useNotifications` — Pas de hook dédié
- `useAlerts` — Pas de hook
- `useEvents` — Pas de hook
- `useInbox` — Pas de hook
- `useMessages` — Pas de hook
- `useRealtime` — Pas de hook

### Utilisation dans App.tsx

Les composants `NotificationCenter` et `GlobalNotificationToast` sont importés et utilisés dans `App.tsx` (visible dans les tabs ouverts).

---

## 17. AUDIT DES DÉPENDANCES

### Dépendances npm liées aux notifications

| Bibliothèque | Version | Utilisation |
|---|---|---|
| `nodemailer` | ^8.0.7 | Transport SMTP pour l'envoi d'emails |
| `@supabase/supabase-js` | ^2.106.1 | Client Supabase (utilisé pour les notifications en cloud mode + sync) |
| `zustand` | ^5.0.13 | Store des notifications in-app |
| `lucide-react` | ^1.14.0 | Icônes (Bell, AlertCircle, etc.) |
| `@tanstack/react-query` | ^5.100.10 | Présent mais PAS utilisé pour les notifications |

### Bibliothèques absentes

| Bibliothèque | Statut |
|---|---|
| Socket.io | Absent |
| BullMQ / Bull | Absent |
| RabbitMQ | Absent |
| Redis | Absent (présent dans event-bus.service.ts mais non connecté) |
| Firebase Admin | Absent |
| Expo Notifications | Absent |
| OneSignal | Absent |
| MJML | Absent |
| Handlebars | Absent |
| React Email | Absent |
| EJS | Absent |

---

## 18. CONCLUSION

### Ce qui existe déjà

1. **Système d'email fonctionnel** — Envoi d'emails transactionnels via nodemailer (Gmail SMTP / Ethereal)
2. **Templates HTML professionnels** — Design system cohérent (dark restaurant aesthetic)
3. **Broadcast pattern** — `broadcastNotification()` avec résolution des destinataires par rôle
4. **Scheduling** — Inventory summary 3x/jour, stock movement polling, expiration crons (5 min)
5. **Notifications in-app (UI)** — NotificationCenter (drawer) + GlobalNotificationToast
6. **Store Zustand** — useNotificationStore avec add, markAsRead, markAllAsRead
7. **Types de notifications** — 18 types définis dans notificationTypes.ts
8. **API REST** — CRUD pour la table notifications (SQLite + Supabase)
9. **RBAC basique** — role_notification_config pour le filtrage par rôle
10. **Multi-tenant** — Scope par tenant_id via getCurrentTenantId()
11. **Event Bus (RBAC)** — EventBusService pour les événements RBAC (mais handlers vides)
12. **Event Bus (Subscription V2)** — InMemoryEventBus pour le domaine subscription
13. **Outbox pattern** — sync_outbox pour la sync des données (réutilisable)
14. **Dead letter queue** — sync_dlq pour les échecs

### Ce qui est déjà professionnel

1. **Design des templates email** — Palette cohérente, responsive, premium
2. **Gestion des erreurs** — try/catch partout, best-effort pour les emails
3. **Résolution des destinataires** — Basée sur les rôles + base de données (pas de hardcode)
4. **Support multi-stockage** — SQLite (local) + Supabase (cloud) pour la table notifications
5. **Sécurité** — SMTP avec App Password, pas de stockage de mots de passe en clair dans le code
6. **Normalisation des types** — Gestion des variantes camelCase, snake_case, kebab-case

### Ce qui manque

1. **Notifications temps réel** — Aucun système (WebSocket, SSE, Supabase Realtime pour notifications)
2. **Notifications push mobiles** — Aucun (FCM, APNs, Expo)
3. **Queue de notifications** — Les envois email sont synchrones (pas de queue)
4. **Persistance des notifications in-app** — Uniquement en mémoire (Zustand), pas de loadFromServer()
5. **NotificationService unifié** — Pas de service central qui gère tous les canaux (email + in-app + push)
6. **Event Bus pour notifications métier** — Les Event Bus existants sont pour RBAC et subscription, pas pour les notifications
7. **Ciblage avancé** — Pas de ciblage par utilisateur individuel, par business, par branche
8. **Cross-tenant broadcast** — Pas de mécanisme pour notifier tous les tenants
9. **Hooks React dédiés** — Pas de useNotifications, useAlerts, useRealtime
10. **Moteur de templates** — Templates HTML inline (pas de MJML, Handlebars, React Email)
11. **Historique des notifications** — Pas de pagination, pas de recherche, pas de filtres avancés
12. **Notifications offline** — Pas de mécanisme pour recevoir les notifications en mode offline

### Points réutilisables

1. **role_notification_config** — Le mécanisme de configuration par rôle est solide et peut être étendu
2. **broadcastNotification()** — Le pattern de broadcast est prêt pour ajouter d'autres canaux
3. **useNotificationStore** — Le store Zustand peut être étendu pour la persistance et la sync
4. **NotificationCenter** — Le composant UI est complet (drawer, filtres, marquage)
5. **GlobalNotificationToast** — Le toast est prêt pour les notifications temps réel
6. **sync_outbox** — L'outbox pattern peut être réutilisé pour une notification queue
7. **InMemoryEventBus** — L'interface IEventBus peut être utilisée pour un event bus notifications
8. **Templates HTML** — Le design system peut être réutilisé pour de nouveaux templates

### Composants inutilisés

1. **EventBusService (platform)** — Instancié mais jamais utilisé (handlers vides, pas d'appel à publish)
2. **InMemoryEventBus (subscription)** — Utilisé uniquement dans les tests
3. **getVisibleNotifications(role)** — Défini dans le store mais pas utilisé dans NotificationCenter
4. **ingestNotifications()** — Défini dans le store mais jamais appelé
5. **loadFromServer()** — Défini dans l'interface mais pas implémenté
6. **openCenter() / closeCenter()** — Définis dans le store mais pas utilisés (la gestion d'ouverture est dans NotificationCenter props)

### Duplications

1. **Deux crons d'expiration** — `expiration.cron.ts` (legacy) et `voucher-expiration.cron.ts` (via BillingExpirationService) font la même chose
2. **Deux Event Bus** — EventBusService (platform) et InMemoryEventBus (subscription) avec des interfaces différentes
3. **Templates email dupliqués** — `buildStockAlertHTML()` dans notification.service.ts (lignes 775-851) et le même pattern dans `notifyLowStockAlert()` (lignes 966-1047)
4. **buildEmailHTML() et notifySale()/notifyOrderCheckout()** — Les templates de vente sont dupliqués entre buildEmailHTML et les fonctions notify

### Dépendances

1. **nodemailer** ^8.0.7 — Seule dépendance pour l'envoi d'emails
2. **@supabase/supabase-js** ^2.106.1 — Pour le stockage cloud des notifications
3. **zustand** ^5.0.13 — Pour le store frontend
4. **lucide-react** ^1.14.0 — Pour les icônes

### Risques

1. **Envoi synchrone** — Les emails sont envoyés avec `await`, ce qui bloque le thread. Pas de queue asynchrone.
2. **Pas de retry** — Si l'envoi échoue, la notification est perdue (pas de mécanisme de retry pour les emails)
3. **Pas de monitoring** — Aucune métrique sur les envois (taux de succès, temps d'envoi, etc.)
4. **Pas de template validation** — Les templates HTML sont des strings, pas de validation à la compilation
5. **Configuration SMTP en dur** — Les defaults Gmail sont codés en dur (afcodenet@gmail.com, App Password)
6. **Deux crons concurrents** — `expiration.cron.ts` et `voucher-expiration.cron.ts` peuvent expirer les mêmes vouchers en parallèle
7. **Notifications in-app volatiles** — Perdues au refresh de la page (pas de persistance)
8. **Pas de rate limiting** — Rien n'empêche d'envoyer 1000 emails en 1 seconde
9. **Pas de template i18n** — Les templates sont en français/anglais hardcodés
10. **Code mort** — EventBusService, getVisibleNotifications, ingestNotifications, loadFromServer sont définis mais inutilisés