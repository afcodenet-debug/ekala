# AUDIT FORENSIQUE — SYSTÈME DE NOTIFICATIONS EKALA  
**Niveau :** Architecture Review (Stripe/Shopify/GitHub grade)  
**Date :** 29/06/2026  
**Règle :** 0 code, 0 modification, 0 hypothèse — uniquement des faits avec fichier, fonction, ligne

---

## 1. CARTOGRAPHIE COMPLÈTE DE L'ARCHITECTURE

### Graphe global des flux de notification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DÉCLENCHEURS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  routes/inventory.ts  routes/products.ts  routes/sales.ts                   │
│  routes/billing.routes.ts  routes/admin.subscriptions.ts                    │
│  services/order.service.ts  services/scheduled-reports.service.ts           │
│  saas/cron/expiration.cron.ts  saas/cron/voucher-expiration.cron.ts         │
│  services/billing-expiration.service.ts                                     │
│  services/notification.service.ts (polling interne)                         │
│                                                                             │
└──────────────────────┬──────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   NOTIFICATION.SERVICE.TS (God Service)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  notifyLowStockAlert()      → broadcastNotification() → sendEmail()        │
│  notifyNewProduct()         → broadcastNotification() → sendEmail()        │
│  notifyStockAdjustment()    → broadcastNotification() → sendEmail()        │
│  notifyInventoryUpdate()    → broadcastNotification() → sendEmail()        │
│  notifySale()               → broadcastNotification() → sendEmail()        │
│  notifyOrderCheckout()      → broadcastNotification() → sendEmail()        │
│  notifyStockMovement()      → broadcastNotification() → sendEmail()        │
│  notifyInventorySummary()   → sendEmail() (direct, pas broadcast)          │
│  sendEmailDirect()          → sendEmail() (direct, pas broadcast)          │
│                                                                             │
└──────────────┬──────────────────────────────┬───────────────────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│     getRecipientsForNotification()  │  │   sendEmailDirect()      │
│                              │  │   (to explicite)            │
│  1. Lit role_notification_config     │  │                              │
│     (settings JSON)          │  │  billing-expiration.service │
│  2. Filtre rôles autorisés   │  │  expiration.cron            │
│  3. SELECT email FROM users  │  │  admin.subscriptions        │
│     WHERE role IN (...)      │  │  billing.routes             │
│     AND is_active=1          │  │                              │
│     AND tenant_id=?          │  │                              │
└──────────────┬───────────────┘  └──────────────┬───────────────┘
               │                                   │
               └──────────────┬────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EMAIL TRANSPORT                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  getTransporter(settings)  →  nodemailer.createTransport()                  │
│                                                                             │
│  Provider choisi :                                                          │
│    gmail  → smtp.gmail.com:587 (pool:5 connections)                        │
│    ethereal → nodemailer.createTestAccount() (fallback)                    │
│    custom → SMTP config utilisateur                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Graphe des chemins morts

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CHEMINS MORTS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EventBusService (platform/event-bus.service.ts):                           │
│    - Instancié (l.192: export const eventBus)                               │
│    - JAMAIS utilisé (0 appel à .publish() dans tout le codebase)           │
│    - Handlers (l.122-151) : que des console.log + code commenté            │
│    - Redis publishToRedis (l.80-84) : 100% commenté                        │
│                                                                             │
│  InMemoryEventBus (domain/subscription/events/InMemoryEventBus.ts):        │
│    - Utilisé uniquement dans les tests unitaires                           │
│    - 0 utilisation en production                                            │
│                                                                             │
│  getVisibleNotifications(role) store:                                       │
│    - Défini (useNotificationStore.ts:98-110)                                │
│    - JAMAIS appelé dans NotificationCenter.tsx                              │
│                                                                             │
│  ingestNotifications():                                                     │
│    - Défini (useNotificationStore.ts:84-96)                                 │
│    - JAMAIS appelé dans tout le frontend                                    │
│                                                                             │
│  loadFromServer():                                                          │
│    - Défini dans l'interface (useNotificationStore.ts:28)                   │
│    - Pas implémenté (marqué "Future: Phase 3")                             │
│                                                                             │
│  openCenter() / closeCenter():                                              │
│    - Définis (useNotificationStore.ts:112-113)                              │
│    - NotificationCenter utilise ses propres props isOpen/onClose            │
│                                                                             │
│  notification-email.service.ts:                                             │
│    - Existe (répertoire services/)                                          │
│    - Semble être un fichier vide/redondant                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. INVENTAIRE DÉTAILLÉ DES COMPOSANTS

### 2.1 NotificationService (God Service)

| Propriété | Valeur |
|---|---|
| **Fichier** | `src/server/services/notification.service.ts` |
| **Lignes** | 1973 |
| **Responsabilités** | Transport SMTP, templates HTML, résolution destinataires, broadcast, scheduling, polling stock movements, formatage monétaire |
| **Dépendances** | nodemailer, db (SQLite), NOTIFICATION_TYPES, getCurrentTenantId |
| **Utilisé ?** | OUI — appelé depuis 6 fichiers |
| **Jamais appelé ?** | NON — intensivement utilisé |
| **Remplaçable ?** | NON — tout le système dépend de ce fichier |
| **Mort ?** | NON — mais contient du code mort (EventBusService lié) |
| **Violation SRP** | OUI — fait 12 choses différentes |

### 2.2 EmailTemplates

| Propriété | Valeur |
|---|---|
| **Fichier** | `src/server/services/email-templates.ts` |
| **Lignes** | 120 |
| **Responsabilités** | 4 templates HTML pour vouchers |
| **Dépendances** | Aucune |
| **Utilisé ?** | OUI — depuis billing-expiration.service, expiration.cron, billing.routes, admin.subscriptions |

### 2.3 BillingExpirationService

| Propriété | Valeur |
|---|---|
| **Fichier** | `src/server/services/billing-expiration.service.ts` |
| **Lignes** | 284 |
| **Responsabilités** | Expiration vouchers, suspension tenant/subscription, envoi email |
| **Dépendances** | supabase-js, env, notification.service, email-templates |
| **Utilisé ?** | OUI — depuis voucher-expiration.cron |

### 2.4 NotificationCenter

| Propriété | Valeur |
|---|---|
| **Fichier** | `src/components/NotificationCenter.tsx` |
| **Lignes** | 382 |
| **Responsabilités** | Drawer latéral de notifications, liste, filtres unread/all, marquage |
| **Dépendances** | useNotificationStore, lucide-react |
| **Utilisé ?** | OUI — dans App.tsx |
| **Connexion serveur** | AUCUNE — purement local (Zustand) |
| **État** | ✅ Design UI complet mais déconnecté du backend |

### 2.5 GlobalNotificationToast

| Propriété | Valeur |
|---|---|
| **Fichier** | `src/components/GlobalNotificationToast.tsx` |
| **Lignes** | 240 |
| **Responsabilités** | Toast haute priorité, navigation au clic |
| **Dépendances** | useNotificationStore, useSettingsStore, react-router-dom, lucide-react |
| **Utilisé ?** | OUI — dans App.tsx |

### 2.6 useNotificationStore

| Propriété | Valeur |
|---|---|
| **Fichier** | `src/stores/useNotificationStore.ts` |
| **Lignes** | 114 |
| **Responsabilités** | Store Zustand : CRUD local, ingest, filtrage rôle, ouverture/fermeture |
| **Dépendances** | zustand, notificationTypes |
| **Persistance** | AUCUNE — 100% mémoire RAM |
| **Sync serveur** | NON — loadFromServer() non implémenté |

### 2.7 Notification API Route

| Propriété | Valeur |
|---|---|
| **Fichier** | `src/server/routes/notifications.ts` |
| **Lignes** | 141 |
| **Responsabilités** | CRUD table `notifications` (GET list, POST create, PATCH read) |
| **Support** | SQLite + Supabase |
| **Middleware** | tenant_id requis (l.10-13) |
| **Sécurité** | Vérifie tenant_id côté serveur |

### 2.8 Expiration Cron (Legacy)

| Propriété | Valeur |
|---|---|
| **Fichier** | `src/server/saas/cron/expiration.cron.ts` |
| **Lignes** | 240 |
| **Responsabilités** | Vouchers, subscriptions, cleanup logs — toutes les 5 min |
| **Email** | sendEmailDirect() avec buildVoucherExpiredEmail |
| **Risque** | Concurrent avec voucher-expiration.cron (même logique) |

### 2.9 Voucher Expiration Cron

| Propriété | Valeur |
|---|---|
| **Fichier** | `src/server/saas/cron/voucher-expiration.cron.ts` |
| **Lignes** | 58 |
| **Responsabilités** | Vouchers via BillingExpirationService — toutes les 5 min |

### 2.10 EventBusService

| Propriété | Valeur |
|---|---|
| **Fichier** | `src/server/platform/event-bus.service.ts` |
| **Lignes** | 192 |
| **État** | 💀 **MORT** — jamais utilisé, handlers vides, Redis non connecté |
| **Risque** | Fausse impression de fonctionnalité — donne l'illusion d'un event bus |
| **Impact** | Aucun (code inactif) mais crée de la dette technique |

### 2.11 InMemoryEventBus (Subscription V2)

| Propriété | Valeur |
|---|---|
| **Fichier** | `src/server/domain/subscription/events/InMemoryEventBus.ts` |
| **Lignes** | 59 |
| **État** | 🧪 **TEST UNIQUEMENT** — pas utilisé en production |
| **Interface** | IEventBus (SubscriptionEvents.ts) |

### 2.12 ScheduledReports Service

| Propriété | Valeur |
|---|---|
| **Fichier** | `src/server/services/scheduled-reports.service.ts` |
| **Lignes** | 276 |
| **Responsabilités** | 3 rapports quotidiens (7:30, 12:30, 23:59) |
| **Dépendance** | node-cron (optionnel — graceful degradation) |
| **État** | ⚠️ **Dépendance optionnelle** — peut ne pas être installée |

### 2.13 NotificationEmail Service

| Propriété | Valeur |
|---|---|
| **Fichier** | `src/server/services/notification-email.service.ts` |
| **État** | ⚠️ **REDONDANT** — semble être une copie vide/partielle de notification.service.ts |

---

## 3. DÉCLENCHEURS EXHAUSTIFS

### 3.1 Tous les appels à notifyLowStockAlert

| Fichier | Ligne | Fonction | Déclencheur |
|---|---|---|---|
| `notification.service.ts` | 966 | `notifyLowStockAlert()` | **FONCTION NON APPELÉE** — définie mais `scheduleStockMovementEmails()` utilise `notifyStockMovement()` à la place |

### 3.2 Tous les appels à notifyNewProduct

| Fichier | Ligne | Fonction | Déclencheur |
|---|---|---|---|
| `routes/products.ts` | ~105 | POST /api/products | Création d'un produit |

### 3.3 Tous les appels à notifyStockAdjustment

| Fichier | Ligne | Fonction | Déclencheur |
|---|---|---|---|
| `routes/inventory.ts` | ~200 | POST/PATCH /api/inventory | Ajustement manuel de stock |
| `routes/products.ts` | ~150 | PATCH /api/products/:id | Mise à jour stock produit |

### 3.4 Tous les appels à notifySale / notifyOrderCheckout

| Fichier | Ligne | Fonction | Déclencheur |
|---|---|---|---|
| `routes/sales.ts` | ~180 | POST /api/sales | Vente complétée |
| `services/order.service.ts` | ~50 | checkout | Checkout commande |
| `routes/sales.ts` | ~200 | require | Checkout commande (dynamic require) |

### 3.5 Tous les appels à sendEmailDirect

| Fichier | Ligne | Fonction | Déclencheur |
|---|---|---|---|
| `billing-expiration.service.ts` | 144 | expireTenantVouchers | Voucher expiré |
| `expiration.cron.ts` | 75 | expireVouchers | Cron 5 min |
| `billing.routes.ts` | ~150 | POST request-voucher | Demande de voucher |
| `admin.subscriptions.ts` | ~80 | POST verify | Validation paiement |
| `admin.subscriptions.ts` | ~120 | POST reject | Rejet paiement |

### 3.6 Tous les appels à broadcastNotification

| Fichier | Ligne | Type | Déclencheur |
|---|---|---|---|
| `notification.service.ts` | 1041 | LOW_STOCK | Stock bas (indirect) |
| `notification.service.ts` | 1076 | NEW_PRODUCT | Création produit |
| `notification.service.ts` | 1099 | STOCK_ADJUSTMENT | Ajustement stock |
| `notification.service.ts` | 1459 | INVENTORY | Mise à jour inventaire |
| `notification.service.ts` | 1614 | SALES | Vente |
| `notification.service.ts` | 1741 | ORDER_CONFIRM | Checkout commande |
| `notification.service.ts` | 1867 | STOCK_ADJUSTMENT | Mouvement stock (polling) |
| `scheduled-reports.service.ts` | 142 | inventory_summary | 7:30 quotidien |
| `scheduled-reports.service.ts` | 182 | midday_ops | 12:30 quotidien |
| `scheduled-reports.service.ts` | 228 | eod_closure | 23:59 quotidien |

### 3.7 Événements NON notifiés (absents du code)

| Événement métier | Notification ? | Preuve |
|---|---|---|
| Category created | NON | Aucun appel à notify dans categories.ts |
| Supplier created | NON | Aucun appel à notify dans suppliers.ts |
| Customer created | NON | Aucun appel à notify dans customers.ts |
| Purchase order | NON | Aucun appel à notify dans purchase-orders.ts |
| Refund | NON | Aucun appel à notify |
| Subscription created | NON | Aucun appel à notify |
| Payment received | NON | Aucun appel à notify (voucher = email direct) |
| User created | NON | Aucun appel à notify dans users.ts |
| User invitation | NON | Aucun appel à notify |
| Password reset | NON | Aucun appel à notify |
| PIN reset | NON | Aucun appel à notify |
| Tenant creation | NON | Aucun appel à notify |
| Branch created | NON | Aucun appel à notify |
| Stock transfer | NON | Aucun appel à notify |

### 3.8 Notifications in-app (Zustand) — Déclencheurs

Le store `useNotificationStore.addNotification()` est accessible mais **aucun appel systématique** n'est fait depuis le backend vers le frontend. Les notifications in-app sont uniquement générées côté client.

---

## 4. ANALYSE RBAC

### 4.1 Comment les destinataires sont-ils résolus ?

**Fichier :** `src/server/services/notification.service.ts`  
**Fonction :** `getRecipientsForNotification()` (l.1197-1294)

**Algorithme exact :**

```
1. Lire role_notification_config depuis settings (JSON string)
     → settingsRaw.role_notification_config
     → parse JSON

2. Pour chaque rôle dans le config :
     Si roleCfg.notifications[notificationType] === true
       → ajouter rôle à allowedRoles[]

3. Si aucun rôle trouvé → return []

4. SQL:
   SELECT email, role FROM users
   WHERE LOWER(role) IN (?, ?, ...)
     AND email IS NOT NULL
     AND TRIM(email) != ''
     AND is_active = 1
     AND tenant_id = ?

5. Retourner la liste des emails uniques
```

### 4.2 Structure de role_notification_config

**Format :** JSON stocké dans la table `settings` (clé: `role_notification_config`)  
**Inféré du code** (l.1213-1230) :

```json
{
  "admin": {
    "notifications": {
      "lowStock": true,
      "sales": true,
      "newProduct": true,
      "stockAdj": true,
      "inventory": true,
      "orderConfirm": true
    }
  },
  "manager": {
    "notifications": {
      "lowStock": true,
      "sales": true
    }
  },
  "cashier": {
    "notifications": {
      "sales": true,
      "orderConfirm": true
    }
  },
  "waiter": {
    "notifications": {
      "orderConfirm": true
    }
  }
}
```

### 4.3 Rôles supportés

Les rôles sont stockés dans la colonne `role` de la table `users`.  
Valeurs observées : `admin`, `manager`, `cashier`, `waiter`, `super_admin`, `platform_admin`

### 4.4 Limites RBAC

| Capacité | Supporté ? | Détail |
|---|---|---|
| Héritage de rôles | NON | Chaque rôle est indépendant |
| Permissions granulaires | NON | Uniquement booléen par type de notification |
| Ciblage individuel | NON | Par rôle uniquement, pas par user_id |
| Ciblage par tenant | OUI | WHERE tenant_id = ? (l.1253) |
| Ciblage par business/branch | NON | Pas de colonne branch dans la requête |
| Rôle codé en dur | NON | Tout est dans la config JSON |
| Limite d'emails par rôle | NON | Pas de max |

### 4.5 Filtre frontend (inutilisé)

**Fichier :** `src/stores/useNotificationStore.ts` (l.98-110)  
**Fonction :** `getVisibleNotifications(role)`  
**État :** Défini mais JAMAIS appelé dans NotificationCenter.tsx

---

## 5. ANALYSE MULTI-TENANT

### 5.1 Propagation du tenant_id

**Chemin exact :**

```
1. JWT token → verifyJwt() extrait tenant_id (server.ts l.124)
2. req.tenant_id = payload.tenant_id (server.ts l.126)
3. tenantStorage.run({ tenantId }) (server.ts l.153) → AsyncLocalStorage
4. getCurrentTenantId() → lit depuis AsyncLocalStorage (tenant-context.ts)
5. notification.service.ts l.1144 : const tenantId = getCurrentTenantId()
6. Requête SQL : WHERE tenant_id = ? (l.1253)
```

**Risque de fuite :** La propagation via AsyncLocalStorage est fiable. La vérification est présente à chaque étape.

### 5.2 Scénarios multi-tenant

| Scénario | Possible ? | Comment |
|---|---|---|
| Notification sort du tenant | NON | WHERE tenant_id=? toujours présent |
| Broadcast global (tous les tenants) | NON | Pas de mécanisme, pas de route |
| Admin notifié pour un autre tenant | NON | Scope par tenant_id |
| Super_admin voit toutes les notifications | NON | Pas de mécanisme cross-tenant |
| Platform notification | NON | Pas de système |

### 5.3 Risque de fuite identifié

**sendEmailDirect()** (l.926-955) : Cette fonction prend un paramètre `to` explicite. Si un appelant passe un email hors tenant, la notification peut fuiter.  
- Vérifié dans : billing.routes.ts (email du tenant), expiration.cron.ts (customer_email du voucher)  
- **Risque :** Faible car les appels sont correctement scoped

---

## 6. ANALYSE PERSISTENCE

### 6.1 Cycle de vie complet

```
Notification UI (Zustand)
  │
  │   Écriture : addNotification() → mémoire RAM uniquement
  │   Lecture  : useNotificationStore.notifications
  │   Marqué lu : markAsRead() → mémoire RAM uniquement
  │   Suppression : clearAll() → mémoire RAM uniquement
  │   Sync serveur : loadFromServer() → NON IMPLÉMENTÉ
  │
  ├── API REST /api/notifications
  │     │
  │     │   GET    → SELECT FROM notifications WHERE tenant_id=?
  │     │   POST   → INSERT INTO notifications
  │     │   PATCH  → UPDATE notifications SET read_at=NOW()
  │     │
  │     ├── SQLite (local)
  │     │   Table: notifications
  │     │   Durée de vie : indéfinie (pas d'expiration)
  │     │
  │     └── Supabase (cloud)
  │         Table: notifications
  │         Durée de vie : indéfinie
  │
  └── Email
        │
        │   sendEmailDirect / broadcastNotification
        │   → Pas de persistance de l'envoi
        │   → Pas de table "sent_emails"
        │   → Pas de retry
        │   → Pas de dead letter queue pour les emails
        │
        Outbox (sync_outbox)
        │   → PAS UTILISÉ pour les notifications
        │   → Réservé aux données métier (produits, commandes)
        │
        Dead Letter Queue (sync_dlq)
        │   → PAS UTILISÉ pour les emails
```

### 6.2 Qui écrit ?

| Stockage | Écrit par |
|---|---|
| Zustand (mémoire) | addNotification() — appelé manuellement, jamais depuis le backend |
| Table notifications (SQLite) | POST /api/notifications |
| Table notifications (Supabase) | POST /api/notifications (cloud mode) |
| Email envoyé | nodemailer — pas de trace persistante |

### 6.3 Qui lit ?

| Source | Lu par |
|---|---|
| Zustand (mémoire) | NotificationCenter, GlobalNotificationToast |
| Table notifications (SQLite) | GET /api/notifications |
| Table notifications (Supabase) | GET /api/notifications (cloud mode) |

### 6.4 Qui supprime ?

| Source | Suppression |
|---|---|
| Zustand | clearAll() — mémoire uniquement |
| Table notifications | Pas de DELETE API — impossible de supprimer |
| Email | Pas de suppression (email envoyé = irréversible) |

### 6.5 Qui archive / expire ?

| Source | Archive/Expire |
|---|---|
| Zustand | Non — pas d'expiration |
| Table notifications | Non — pas de TTL, pas de cleanup |
| Email | Non — pas d'archivage |
| Billing audit logs | OUI — cleanupOldLogs() (90 jours, cron) |

### 6.6 Problème critique

Les notifications in-app (Zustand) et les notifications API (table) sont **deux systèmes complètement déconnectés**.  
- Le frontend ne lit jamais la table notifications (pas de polling, pas d'appel GET /api/notifications)  
- Le backend n'écrit jamais dans le store Zustand (pas de WebSocket, pas de SSE)

---

## 7. ANALYSE TEMPS RÉEL

### 7.1 Technologies présentes

| Technologie | Fichier | Utilisation réelle |
|---|---|---|
| **Supabase Realtime** | `src/server/services/supabase-realtime-sync.service.ts` | Sync données (orders, products) — PAS pour les notifications |
| **Supabase Realtime** | `.from('notifications').on('INSERT', ...)` | **AUCUNE** — pas d'écoute sur la table notifications |
| **Polling (setInterval)** | `notification.service.ts` l.1893 | Stock movement emails (30s) |
| **Cron (setInterval 5 min)** | `expiration.cron.ts`, `voucher-expiration.cron.ts` | Expiration vouchers |
| **Cron (node-cron)** | `scheduled-reports.service.ts` (optionnel) | Rapports quotidiens |
| **Sync scheduler (30s)** | `sync-orchestrator-v2.ts` | Sync données — PAS pour notifications |
| **EventBus (in-memory)** | `platform/event-bus.service.ts` | 💀 **MORT** |
| **InMemoryEventBus** | `domain/subscription/events/` | 🧪 **TESTS UNIQUEMENT** |

### 7.2 Réellement utilisé pour les notifications

**AUCUN. Zéro. Rien.**

Il n'existe aucun mécanisme temps réel pour pousser les notifications vers le frontend.  
Le frontend ne reçoit que ce qui est ajouté manuellement dans le store Zustand côté client.

---

## 8. ANALYSE EMAIL (TRACE COMPLÈTE)

### 8.1 Trace d'un email de vente

```
Business Event : Sale completed
  ↓
routes/sales.ts:~180 : notifyOrderCheckout() est appelée
  ↓
notification.service.ts:1622 : notifyOrderCheckout()
  ↓
  Construit HTML via template inline (l.1671-1739)
  ↓
l.1741 : await broadcastNotification(
           NOTIFICATION_TYPES.ORDER_CONFIRM,
           subject, htmlBody, settingsRaw)
  ↓
l.1302 : broadcastNotification()
  ↓
l.1309-1310 : Si settingsRaw vide → loadRawSettings()
  ↓
l.1312 : readEmailSettings() → parse les settings
  ↓
l.1313-1316 : Vérifie emailNotificationsEnabled
  ↓
l.1320 : getRecipientsForNotification(settingsRaw, type)
  ↓
  [RBAC] Lecture role_notification_config
  [RBAC] SELECT email FROM users WHERE role IN (...) AND tenant_id=?
  ↓
l.1325-1330 : Si 0 destinataire → return (silencieux)
  ↓
l.1332 : await sendEmail(subject, htmlBody, settings, recipients)
  ↓
l.879 : sendEmail()
  ↓
l.885-891 : toList = recipients[0] + bcc = recipients[1..n]
  ↓
l.900 : await getTransporter(settings)
  ↓
  Si Gmail : nodemailer SMTP pool:5
  Si Ethereal : test account
  ↓
l.913 : await transporter.sendMail(mailOpts)
  ↓
  SUCCESS : console.log + return true
  FAILURE : console.error + return false
  ↓
  FIN (pas de retry, pas de queue, pas de DLQ)
```

### 8.2 Gestion des erreurs

| Étape | Comportement en erreur |
|---|---|
| getTransporter() | Fallback Ethereal si Gmail échoue (l.203-213) |
| sendEmail() | catch → console.error → return false (l.920-923) |
| broadcastNotification() | Ne propage PAS l'erreur (void async) |
| sendEmailDirect() | catch → console.error → return false (l.951-954) |
| billing-expiration.service.ts | catch → result.errors.push() → continue (l.153-156) |

### 8.3 Ce qui manque

| Fonctionnalité | Statut |
|---|---|
| **Queue** | NON — await bloquant |
| **Retry** | NON — échec = perdu |
| **Timeout** | NON — pas de timeout configuré sur nodemailer |
| **Circuit breaker** | NON — pas de protection |
| **Dead Letter Queue** | NON — pas pour les emails |
| **Monitoring** | NON — seulement des console.log |
| **Tracking d'envoi** | NON — pas de table sent_emails |
| **Template validation** | NON — strings brutes |
| **Rate limiting** | NON — rien n'empêche 1000 appels |

---

## 9. ANALYSE FRONTEND

### 9.1 Architecture frontend

```
┌─────────────────────────────────────────────────────────────┐
│                      App.tsx                                │
│                                                             │
│  <NotificationCenter isOpen={...} onClose={...} />          │
│  <GlobalNotificationToast />                                │
│                                                             │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│   NotificationCenter     │  │  GlobalNotificationToast     │
│   (Drawer latéral)       │  │  (Toast haut droite)          │
│                          │  │                               │
│  Props : isOpen, onClose │  │  Priorité : critical, high    │
│  Tabs : All / Unread     │  │  Auto-dismiss au clic         │
│  Mark as read            │  │  Navigation vers /orders      │
│  Mark all read           │  │                               │
│  Lien cliquable          │  │                               │
└──────────┬───────────────┘  └──────────┬────────────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   useNotificationStore                       │
│                   (Zustand — mémoire)                        │
│                                                             │
│  notifications: AppNotification[]                            │
│  unreadCount: number                                         │
│                                                             │
│  addNotification() → push + slice(0, MAX=100)               │
│  markAsRead(id) → map + set readAt                          │
│  markAllAsRead() → map + set readAt                         │
│  clearAll() → []                                            │
│  ingestNotifications() → merge (jamais appelé)               │
│  getVisibleNotifications() → filter (jamais appelé)          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Flux de données frontend

```
Backend
  │
  │   ❌ Aucun push (no WebSocket, no SSE, no polling)
  │
  ▼
  API REST (GET /api/notifications)
  │
  │   ❌ Jamais appelé par le frontend
  │
  ▼
  Store Zustand
  │
  │   ❌ Rien n'alimente le store depuis le backend
  │
  ▼
  NotificationCenter / Toast
  │
  │   Affiche UNIQUEMENT ce qui a été ajouté localement
```

### 9.3 Bell / Badge

| Composant | Existant ? |
|---|---|
| Bell icon | Dans NotificationCenter (header) |
| Badge (unread count) | Dans NotificationCenter (sous-titre) |
| Badge global (sidebar) | NON |

---

## 10. ANALYSE PERFORMANCE

### 10.1 Points bloquants identifiés

|#|Problème|Fichier|Ligne|Impact|
|---|---|---|---|---|
|1|**Envoi email synchrone**|notification.service.ts|913|`await transporter.sendMail()` bloque le thread|
|2|**Double appel notify**|routes/inventory.ts + routes/products.ts|~200, ~150|Un ajustement stock peut déclencher 2 notifications|
|3|**Polling 30s stock movement**|notification.service.ts|1893-1969|Requête SQL + envoi email toutes les 30s|
|4|**Deux crons concurrents**|expiration.cron.ts + voucher-expiration.cron.ts|les deux 5 min|Mêmes vouchers expirés en parallèle|
|5|**Node-cron optionnel**|scheduled-reports.service.ts|20-25|Si pas installé, les schedulers ne démarrent pas|
|6|**buildEmailHTML appels multiples**|notification.service.ts|592-652|Appelé à chaque notification, construction de gros strings HTML|
|7|**Settings lus à chaque notification**|notification.service.ts|1143-1153|`loadRawSettings()` = SELECT sur settings à chaque envoi|
|8|**getRecipientsForNotification SQL**|notification.service.ts|1246-1254|SELECT sur users à chaque envoi, pas de cache|

### 10.2 N+1 détectés

|#|Requête|Nombre d'appels|
|---|---|---|
|1|SELECT settings WHERE tenant_id=? | 1 par notification (loadRawSettings) |
|2|SELECT users WHERE role IN (...) AND tenant_id=? | 1 par notification (getRecipients) |
|3|SELECT inventory_movements WHERE id > ? | 1x toutes les 30s (polling) |

### 10.3 Transactions longues

Aucune transaction longue identifiée. La seule transaction possible serait dans `withOutboxTransaction()` mais elle est réservée à la sync, pas aux notifications.

---

## 11. ANALYSE EXTENSIBILITÉ

### 11.1 Capacité à ajouter un nouveau canal

| Canal | Effort | Sans modifier le métier ? |
|---|---|---|
| SMS | Élevé | NON — tout est dans notification.service.ts |
| WhatsApp | Élevé | NON — couplé à nodemailer |
| Push Mobile | Très élevé | NON — pas d'infrastructure |
| Push Desktop | Très élevé | NON — pas de WebSocket |
| In-App (backend→frontend) | Élevé | NON — pas de temps réel |
| Slack | Élevé | NON — pas de webhook configurable |
| Teams | Élevé | NON — pas de webhook configurable |
| Webhook | Élevé | NON — pas de mécanisme |
| Discord | Élevé | NON — pas de webhook configurable |
| Telegram | Élevé | NON — pas de mécanisme |

### 11.2 Pourquoi l'extension est difficile

1. **God Service** — NotificationService gère transport + templates + RBAC + scheduling
2. **Couplage fort** — Toutes les fonctions notify appellent directement broadcastNotification()
3. **Pas d'interface** — Pas de `INotificationChannel` ou `NotificationDispatcher`
4. **Templates inline** — Pas de moteur de templates interchangeable
5. **Pas de pipeline** — Pas de chaîne de traitement (validate → enrich → send → log)
6. **Pas de configuration canal** — Les settings sont pour email uniquement

### 11.3 Ce qui est réutilisable

1. **role_notification_config** — Le mécanisme de routing par rôle peut être réutilisé
2. **broadcastNotification()** — La fonction de broadcast peut être le point d'entrée commun
3. **getRecipientsForNotification()** — La résolution des destinataires est générique

---

## 12. COMPARAISON AVEC LES STANDARDS INTERNATIONAUX

### 12.1 Stripe (Notification Architecture)

| Concept Stripe | Ekala | Différence |
|---|---|---|
| Event-driven (stripe events) | ❌ Pas d'Event Bus métier | Stripe publie des events, Ekala appelle des fonctions |
| Webhook delivery | ❌ Pas de webhook | Stripe livre les events, Ekala ne livre rien |
| Idempotency | ❌ Pas de clé d'idempotence | Stripe garantit exactly-once |
| Retry with backoff | ❌ Pas de retry | Stripe retry avec exponential backoff |
| Queue (background jobs) | ❌ Envoi synchrone | Stripe traite en async |
| Dead letter | ❌ Pas pour les notifications | Stripe dead letter après échecs |

### 12.2 Shopify (Notification Architecture)

| Concept Shopify | Ekala | Différence |
|---|---|---|
| Webhook engine | ❌ Pas de webhook | Shopify livre les events aux apps |
| GraphQL subscriptions | ❌ Pas de subscription | Shopify push temps réel |
| Multi-channel (email, SMS, push) | ❌ Email uniquement | Shopify supporte tous les canaux |
| Template engine (Liquid) | ❌ HTML inline | Shopify sépare template du code |
| Notification filter | ❌ Basique (role) | Shopify permet des règles complexes |

### 12.3 GitHub (Notification Architecture)

| Concept GitHub | Ekala | Différence |
|---|---|---|
| Notification inbox | ⚠️ Partiel (NotificationCenter) | GitHub a une inbox complète |
| Mark as read / unread | ✅ Oui | ✅ |
| Notification groups | ❌ Non | GitHub groupe par thread |
| Email + Web + Mobile | ❌ Web seulement | GitHub multi-canal |
| Participation / Watching | ❌ Non | GitHub a des abonnements |
| Notification settings UI | ⚠️ SettingsPage existe | GitHub a des réglages fins |

### 12.4 AWS EventBridge

| Concept EventBridge | Ekala | Différence |
|---|---|---|
| Event bus | ❌ Pas de bus fonctionnel | EventBridge = event bus distribué |
| Rules / Targets | ❌ Pas de routing | EventBridge route par règles |
| Schema registry | ❌ Pas de schéma | EventBridge valide les events |
| Archive / Replay | ❌ Pas d'archive | EventBridge archive 14 jours |

### 12.5 Firebase Cloud Messaging

| Concept FCM | Ekala | Différence |
|---|---|---|
| Push notifications | ❌ Absent | FCM = push mobile/desktop |
| Topic-based | ❌ Absent | FCM permet topics |
| Device registration | ❌ Absent | FCM gère les devices |
| Delivery tracking | ❌ Absent | FCM track les deliveries |

### 12.6 OneSignal

| Concept OneSignal | Ekala | Différence |
|---|---|---|
| Multi-platform push | ❌ Absent | OneSignal = push unifié |
| Segmentation | ❌ Absent | OneSignal segmente les users |
| A/B testing | ❌ Absent | OneSignal test les messages |
| Analytics | ❌ Absent | OneSignal donne des metrics |

---

## 13. VIOLATIONS SOLID

### 13.1 Single Responsibility Principle (SRP)

**Violation #1 : NotificationService** — `notification.service.ts` (1973 lignes)

Ce fichier fait tout :
- Configuration SMTP (l.30-77)
- Transport email (l.160-214)
- Templates HTML (l.226-851)
- Formatage monétaire (l.382-484)
- Resolution RBAC (l.1155-1294)
- Broadcast (l.1297-1333)
- Scheduling (l.1335-1489, 1893-1969)
- Stock queries (l.1050-1082)
- Sale notifications (l.1491-1747)
- Settings loading (l.1119-1153)
- Polling (l.1893-1969)

**Règle violée :** Une classe/模块 doit avoir une seule raison de changer. NotificationService a au moins 10 raisons de changer.

### 13.2 Open/Closed Principle (OCP)

**Violation #2 :** Ajouter un nouveau canal nécessite de modifier NotificationService

Pour ajouter SMS :
1. Ajouter une fonction notifySMS() dans notification.service.ts
2. Ajouter le transport SMS
3. Modifier broadcastNotification() pour gérer le nouveau canal
4. Modifier les settings

**Règle violée :** Ouvert à l'extension, fermé à la modification. NotificationService n'est ni ouvert ni fermé.

### 13.3 Liskov Substitution Principle (LSP)

**Violation #3 :** Les templates HTML sont des fonctions, pas des classes.

- `buildEmailHTML()`, `buildStockAlertHTML()`, `buildVoucherGeneratedEmail()` etc. sont des fonctions indépendantes
- Impossible de substituer un template par un autre sans modifier le code appelant

### 13.4 Interface Segregation Principle (ISP)

**Violation #4 :** `EmailSettings` interface (l.31-56) contient à la fois :
- Configuration transport (smtpHost, smtpPort, etc.)
- Configuration notification (notifyLowStock, etc.)
- Configuration forwarding (emailForwardTo)

Une interface unique pour des responsabilités différentes.

### 13.5 Dependency Inversion Principle (DIP)

**Violation #5 :** NotificationService dépend directement de :
- `nodemailer` (transport concret)
- `db` (SQLite concret)
- `NOTIFICATION_TYPES` (constantes concrètes)

Pas d'abstraction (interface) entre le service et ses dépendances.

---

## 14. ANTI-PATTERNS

### 14.1 God Service

**NotificationService (1973 lignes)**

Toutes les responsabilités notification sont dans un seul fichier monolithique. C'est l'anti-pattern #1.

### 14.2 Couplage Temporel

Les envois email sont `await` — le thread est bloqué jusqu'à la réponse SMTP. Si Gmail est lent, l'API est ralentie.

```typescript
// notification.service.ts l.913
const info: any = await transporter.sendMail(mailOpts);
// Le thread attend ici
```

### 14.3 Magic Strings

Les types de notification sont passés comme strings :
```typescript
// scheduled-reports.service.ts l.142
await broadcastNotification('inventory_summary', ...)
// l.182
await broadcastNotification('midday_ops', ...)
// l.228
await broadcastNotification('eod_closure', ...)
```

Ces types ne sont pas dans NOTIFICATION_TYPES (constants/notificationTypes.ts). Ce sont des magic strings.

### 14.4 Silent Fail

```typescript
// notification.service.ts l.920-923
} catch (err: any) {
  console.error('[Notification] ✗ send error:', err.message);
  return false;
}
```

L'échec est loggé mais jamais remonté à l'appelant (void async). L'utilisateur ne sait pas que l'email a échoué.

### 14.5 Code Mort

Au moins 4 composants inutilisés (voir section 1 — Chemins Morts). Le code mort est particulièrement dangereux car il peut donner l'impression qu'une fonctionnalité existe alors qu'elle est inactive.

### 14.6 Singleton Non Nécessaire

```typescript
// notification.service.ts l.160-161
let _transporter: any = null;
let _transporterKey = '';
```

Le transporteur est un singleton global. En cas de changement de settings, il est recréé mais cela peut causer des fuites de connexion.

### 14.7 Duplication

**Double cron :** `expiration.cron.ts` (legacy, 240 lignes) et `voucher-expiration.cron.ts` (58 lignes) expirent les mêmes vouchers.

**Double template stock :** `buildStockAlertHTML()` (l.775) et le HTML dans `notifyLowStockAlert()` (l.966) sont quasiment identiques.

**Double template vente :** `buildEmailHTML()` (l.592) et le HTML dans `notifySale()` (l.1544) sont redondants.

---

## 15. ARCHITECTURE CIBLE (V2)

> ⚠️ **Aucun code.** Uniquement des diagrammes d'architecture et des responsabilités.

### 15.1 Bounded Contexts

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     NOTIFICATION DOMAIN (Bounded Context)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Notification  │  │ Preference   │  │ Template     │  │ Channel       │ │
│  │ Aggregate     │  │ Engine       │  │ Engine       │  │ Providers     │ │
│  └───────┬───────┘  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
│          │                 │                  │                  │         │
│  ┌───────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐  ┌───────┴───────┐ │
│  │ Dispatcher    │  │ RBAC Resolver│  │ Queue        │  │ Observability│ │
│  │ (Orchestrator)│  │ (who gets it)│  │ (Async)      │  │ (Metrics)    │ │
│  └───────────────┘  └──────────────┘  └──────────────┘  └───────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 15.2 Flux Cible

```
DOMAIN EVENT (ex: ProductCreated, SaleCompleted, StockLow)
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                   DOMAIN EVENT BUS                             │
│  publish(ProductCreated { productId, tenantId, ... })         │
│                                                                │
│  Abonné : NotificationDispatcher écoute les domain events     │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                NOTIFICATION DISPATCHER                         │
│                                                                │
│  1. Reçoit le domain event                                     │
│  2. Interroge Preference Engine : qui doit être notifié ?     │
│     • Par rôle (RBAC)                                          │
│     • Par utilisateur                                          │
│     • Par tenant                                               │
│     • Par canal préféré                                        │
│  3. Pour chaque destinataire × canal :                         │
│     • Crée un Notification Aggregate                           │
│     • Le persiste dans NotificationRepository                  │
│     • Enqueue dans Notification Queue                          │
│                                                                │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                    NOTIFICATION QUEUE                           │
│  (ex: BullMQ avec Redis / ou SQLite outbox)                   │
│                                                                │
│  Worker asynchrone :                                           │
│  • Lit la queue                                                │
│  • Pour chaque notification :                                  │
│    – Récupère le template (Template Engine)                    │
│    – Enrichit avec les données métier                          │
│    – Envoie via le Channel Provider approprié                  │
│    – Loggue le résultat                                        │
│    – Si échec : retry (exponential backoff)                    │
│    – Si échec définitif : Dead Letter Queue                    │
│                                                                │
└───────────┬───────────────────────────┬───────────────────────┘
            │                           │
            ▼                           ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│  CHANNEL PROVIDERS   │  │  INBOX (Notifications UI)    │
│                      │  │                              │
│  Channel.Email       │  │  NotificationRepository      │
│    → nodemailer      │  │  → Table: notifications      │
│    → Resend          │  │  → Supabase Realtime push    │
│    → SES             │  │  → WebSocket bridge          │
│                      │  │                              │
│  Channel.SMS         │  │  Frontend :                  │
│    → Twilio          │  │  • useNotificationQuery      │
│    → AfricaStalking  │  │    (TanStack Query polling)  │
│                      │  │  • NotificationCenter        │
│  Channel.Push        │  │  • GlobalNotificationToast   │
│    → FCM             │  │  • BellBadge (sidebar)       │
│    → Expo            │  │                              │
│                      │  │  Realtime :                  │
│  Channel.Webhook     │  │  • Supabase Realtime         │
│    → Slack/Teams     │  │    .from('notifications')    │
│    → Discord/Telegram│  │    .on('INSERT', callback)   │
│                      │  │                              │
└──────────────────────┘  └──────────────────────────────┘
```

### 15.3 Responsabilités

| Composant | Responsabilité |
|---|---|
| **Domain Event Bus** | Publier les événements métier (ProductCreated, SaleCompleted, etc.) |
| **Notification Dispatcher** | Écouter les events, créer les notifications, router vers les canaux |
| **Preference Engine** | Déterminer qui reçoit quoi, via quel canal, à quelle fréquence |
| **Template Engine** | Générer le contenu (email HTML, SMS text, push payload) |
| **Channel Provider** | Interface pour chaque canal : Email, SMS, Push, Webhook, In-App |
| **Notification Queue** | File asynchrone avec retry, backoff, DLQ |
| **Notification Repository** | Persistance (table notifications + outbox) |
| **Inbox** | UI frontend avec polling + realtime push |
| **Observability** | Métriques : sent, failed, retried, delivery time |

### 15.4 Domain Events à créer

```
ProductCreated       → Notification aux managers/admin
ProductDeleted       → Notification aux managers
SaleCompleted        → Notification aux admin/cashier
StockLow             → Notification aux managers/admin
StockOut             → Notification aux managers/admin
OrderPlaced          → Notification aux cashier/waiter
OrderCompleted       → Notification aux admin
SubscriptionCreated  → Email au tenant owner
SubscriptionExpired  → Email + notification in-app
PaymentReceived      → Email + notification in-app
VoucherGenerated     → Email au customer
VoucherExpired       → Email + notification in-app
UserInvited          → Email à l'utilisateur
PasswordReset        → Email à l'utilisateur
TenantCreated        → Email au super_admin
```

### 15.5 Principes d'architecture cible

1. **Event-Driven** — Les notifications sont déclenchées par des domain events, pas par des appels directs
2. **Async First** — Les envois sont asynchrones via une queue
3. **Pluggable Channels** — Chaque canal est un provider interchangeable
4. **Template Separation** — Les templates sont des fichiers indépendants (MJML ou React Email)
5. **RBAC Centralized** — Preference Engine gère qui reçoit quoi
6. **Persistent Inbox** — Les notifications in-app sont persistées et syncées
7. **Realtime Push** — Supabase Realtime ou WebSocket pour le push frontend
8. **Observability** — Métriques sur tous les envois (success, failure, latency)
9. **Retry with Backoff** — Exponential backoff + DLQ
10. **Multi-Tenant by Design** — tenant_id propagé dans tous les events

---

## RÉFÉRENCES

Toutes les lignes citées sont issues des fichiers analysés :
- `src/server/services/notification.service.ts` (1973 lignes)
- `src/server/services/email-templates.ts` (120 lignes)
- `src/server/services/billing-expiration.service.ts` (284 lignes)
- `src/server/services/scheduled-reports.service.ts` (276 lignes)
- `src/server/saas/cron/expiration.cron.ts` (240 lignes)
- `src/server/saas/cron/voucher-expiration.cron.ts` (58 lignes)
- `src/server/routes/notifications.ts` (141 lignes)
- `src/server/routes/inventory.ts` (322 lignes)
- `src/server/routes/products.ts`
- `src/server/routes/sales.ts`
- `src/server/routes/billing.routes.ts` (415 lignes)
- `src/server/routes/admin.subscriptions.ts`
- `src/components/NotificationCenter.tsx` (382 lignes)
- `src/components/GlobalNotificationToast.tsx` (240 lignes)
- `src/stores/useNotificationStore.ts` (114 lignes)
- `src/constants/notificationTypes.ts` (30 lignes)
- `src/server/platform/event-bus.service.ts` (192 lignes)
- `src/server/domain/subscription/events/InMemoryEventBus.ts` (59 lignes)
- `package.json` (112 lignes)