# AUDIT COMPLET DU SYSTÈME DE NOTIFICATIONS
**Version :** 1.0  
**Date :** 29/06/2026  
**Auteur :** AI Assistant  
**Scope :** Audit exhaustif de tous les composants du système de notifications

---

## RÉSUMÉ EXÉCUTIF

Le système de notifications de Great Olive est **fonctionnel mais présente des lacunes importantes** en termes d'architecture temps réel, de résilience et de traçabilité.

### Points forts
- ✅ Service d'email mature avec templates HTML professionnels
- ✅ Configuration SMTP flexible (Gmail, Ethereal, SMTP2GO, Custom)
- ✅ Résolution de destinataires basée sur les rôles (RBAC)
- ✅ Interface utilisateur complète (NotificationCenter + Toasts)
- ✅ Support multi-tenant avec isolation
- ✅ Double mode de stockage (Supabase/SQLite)

### Points critiques
- ❌ Aucune notification temps réel (pas de WebSocket/SSE)
- ❌ Aucune notification mobile (pas de FCM/APNS)
- ❌ Pas de queue persistante pour les emails (fire-and-forget)
- ❌ Pas de retry automatique en cas d'échec
- ❌ Event Bus dédié aux notifications inexistant
- ❌ Pas de dead-letter queue
- ❌ Logs de notification épars (pas de structured logging)
- ❌ Pas de métriques de délivrabilité

---

## 1. INVENTAIRE COMPLET DES FICHIERS

### 1.1 Backend - Services Core

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `src/server/services/notification.service.ts` | Service principal d'email | 1973 |
| `src/server/services/email-templates.ts` | Templates HTML pour emails | ~300 |
| `src/server/services/billing-expiration.service.ts` | Notifications expiration voucher | ~150 |
| `src/server/services/voucher-redemption.service.ts` | Intégration voucher | ~200 |

### 1.2 Backend - Routes API

| Fichier | Routes | Lignes |
|---------|--------|--------|
| `src/server/routes/notifications.ts` | CRUD notifications | 141 |
| `src/server/routes/notification_preferences.ts` | Préférences utilisateur | ~100 |
| `src/server/routes/settings.ts` | Configuration email | ~400 |

### 1.3 Backend - Event Bus & Queue

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `src/server/domain/subscription/events/InMemoryEventBus.ts` | EventBus pour abonnements | 59 |
| `src/server/platform/event-bus.service.ts` | EventBus RBAC (avec Redis optionnel) | ~200 |
| `src/server/platform/audit-queue.service.ts` | Queue d'audit avec retry | ~300 |

### 1.4 Frontend - Stores & Components

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `src/stores/useNotificationStore.ts` | Store Zustand notifications | 114 |
| `src/components/NotificationCenter.tsx` | Panneau coulissant notifications | 382 |
| `src/components/GlobalNotificationToast.tsx` | Toasts globaux | ~150 |

### 1.5 Frontend - Pages

| Fichier | Rôle |
|---------|------|
| `src/pages/SettingsPage.tsx` | Configuration notifications |
| `src/pages/settings/SettingsLayout.tsx` | Layout paramètres |

### 1.6 Documentation

| Fichier | Rôle |
|---------|------|
| `docs/NOTIFICATION_FUNCTIONAL_SPECIFICATION.md` | Spécification fonctionnelle |
| `docs/NOTIFICATION_RULE_MATRIX.md` | Matrice de règles |
| `docs/RECIPIENT_RESOLUTION_SPECIFICATION.md` | Résolution destinataires |
| `docs/NOTIFICATION_SEQUENCE_DIAGRAMS.md` | Diagrammes de séquence |
| `docs/NOTIFICATION_DOMAIN_MODEL.md` | Modèle de domaine |
| `docs/NOTIFICATION_STATE_MACHINES.md` | Machines à états |

---

## 2. FLUX COMPLET DES E-MAILS

### 2.1 Architecture du flux

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMAIL NOTIFICATION FLOW                       │
└─────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │  Event Source │  (Sale, Stock, Product, Voucher, etc.)
  └──────┬───────┘
         │
         ▼
  ┌──────────────────┐
  │  Route Handler   │  (sales.ts, products.ts, inventory.ts)
  └──────┬───────────┘
         │
         │ setImmediate() [fire-and-forget]
         ▼
  ┌──────────────────┐
  │  notifyXxx()     │  (notification.service.ts)
  └──────┬───────────┘
         │
         ▼
  ┌──────────────────┐
  │  broadcastNotification() │
  └──────┬───────────┘
         │
         ├─► loadRawSettings() ──► SQLite/Supabase
         │
         ├─► getRecipientsForNotification()
         │   └─► role_notification_config (JSON)
         │   └─► users table (email + role)
         │
         ▼
  ┌──────────────────┐
  │  sendEmail()     │  (nodemailer)
  └──────┬───────────┘
         │
         ├─► getTransporter()
         │   ├─► Gmail SMTP (production)
         │   ├─► Ethereal (fallback test)
         │   ├─► SMTP2GO
         │   └─► Custom SMTP
         │
         ▼
  ┌──────────────────┐
  │  SMTP Server     │  (Gmail, Ethereal, etc.)
  └──────┬───────────┘
         │
         ▼
  ┌──────────────────┐
  │  Recipient       │  (Admin, Manager, etc.)
  └──────────────────┘
```

### 2.2 Points d'émission d'emails

| Fonction | Déclencheur | Fichier source |
|-----------|--------------|-----------------|
| `notifySale()` | Checkout POS | `sales.ts` |
| `notifyOrderCheckout()` | Validation commande | `sales.ts` |
| `notifyStockAdjustment()` | Ajustement manuel stock | `products.ts`, `inventory.ts` |
| `notifyNewProduct()` | Création produit | `products.ts` |
| `notifyLowStockAlert()` | Stock bas/critique | `notification.service.ts` |
| `notifyInventoryUpdate()` | Mouvement inventaire | `notification.service.ts` |
| `notifyInventorySummary()` | Rapport 3x/jour | `notification.service.ts` |
| `notifyStockMovement()` | Mouvement stock confirmé | `notification.service.ts` |
| `sendEmailDirect()` | Voucher expiré | `billing-expiration.service.ts` |
| `sendApprovalEmail()` | Paiement vérifié | `admin.subscriptions.ts` |
| `sendRejectionEmail()` | Paiement rejeté | `admin.subscriptions.ts` |

### 2.3 Problèmes identifiés

#### ❌ PROBLÈME 1 : Pas de queue persistante
```typescript
// ACTUEL : fire-and-forget
setImmediate(async () => {
  try {
    await notifyStockAdjustment(...);
  } catch (err) {
    console.error('[Notification] email failed:', err);
  }
});
```
**Impact** : Si le serveur crash après `setImmediate` mais avant envoi SMTP, l'email est perdu.

#### ❌ PROBLÈME 2 : Pas de retry automatique
```typescript
// ACTUEL : pas de mécanisme de retry
try {
  await transporter.sendMail(mailOpts);
} catch (err) {
  console.error('[Notification] ✗ send error:', err.message);
  return false; // ← Email perdu
}
```
**Impact** : Un échec SMTP temporaire (réseau, timeout) = email définitivement perdu.

#### ❌ PROBLÈME 3 : Dead letter queue absente
Aucun mécanisme pour stocker les emails échoués et les réinjecter plus tard.

---

## 3. ÉVÉNEMENTS DÉCLENCHEURS D'E-MAILS

### 3.1 Événements métier

| Événement | Type notification | Email | In-App |
|-----------|-------------------|-------|--------|
| Sale/Checkout | `SALES` / `ORDER_CONFIRM` | ✅ | ❌ |
| Stock Adjustment | `STOCK_ADJUSTMENT` | ✅ | ❌ |
| Low Stock | `LOW_STOCK` | ✅ | ❌ |
| Out of Stock | `OUT_OF_STOCK` | ✅ | ❌ |
| New Product | `NEW_PRODUCT` | ✅ | ❌ |
| Product Deleted | `PRODUCT_DELETED` | ✅ | ❌ |
| Inventory Update | `INVENTORY` | ✅ | ❌ |
| Voucher Expired | Custom | ✅ | ❌ |
| Payment Verified | Custom | ✅ | ❌ |
| Payment Rejected | Custom | ✅ | ❌ |

### 3.2 Événements système (cron)

| Événement | Fréquence | Email |
|-----------|-----------|-------|
| Inventory Summary | 3x/jour (06:30, 09:30, 13:30) | ✅ |
| Stock Movement Poll | Toutes les 30s | ✅ |
| Voucher Expiration | Toutes les heures | ✅ |

### 3.3 Problèmes identifiés

#### ❌ PROBLÈME 4 : Pas d'Event Bus dédié pour les notifications
```typescript
// ACTUEL : Appel direct depuis les routes
import { notifyStockAdjustment } from '../services/notification.service';

router.post('/:id/adjust', async (req, res) => {
  // ... logique métier ...
  
  // Notification appelée directement
  await notifyStockAdjustment(...);
});
```
**Impact** : Couplage fort entre routes métier et notifications. Impossible de désactiver les notifications sans modifier le code métier.

#### ❌ PROBLÈME 5 : Pas de traçabilité des événements
Aucun log structuré pour :
- Quel événement a déclenché quelle notification
- Quels destinataires ont été notifiés
- Statut de délivrabilité (sent, delivered, bounced, etc.)

---

## 4. NOTIFICATIONSERVICE / EMAILSERVICE

### 4.1 Architecture actuelle

```
notification.service.ts (1973 lignes)
├── Configuration
│   ├── getDefaultEmailSettings()
│   ├── readEmailSettings()
│   └── loadRawSettings() / loadRawSettingsAsync()
│
├── Transport
│   ├── getTransporter() (singleton avec cache)
│   ├── sendEmail() (multi-recipients)
│   └── sendEmailDirect() (single recipient)
│
├── Templates (inline)
│   ├── buildHeader()
│   ├── buildFooter()
│   ├── buildLineItems()
│   ├── buildTotalSection()
│   ├── buildStaffSection()
│   ├── buildEmailHTML()
│   ├── buildInventorySummaryHTML()
│   ├── buildStockAlertHTML()
│   └── [CSS inline ~400 lignes]
│
├── Notifications métier
│   ├── notifyLowStockAlert()
│   ├── notifyNewProduct()
│   ├── notifyStockAdjustment()
│   ├── notifyInventoryUpdate()
│   ├── notifyInventorySummary()
│   ├── notifySale()
│   ├── notifyOrderCheckout()
│   └── notifyStockMovement()
│
├── Résolution destinataires
│   ├── getRecipientsForNotification()
│   ├── isNotificationEnabled()
│   └── normalizeNotificationTypeKey()
│
└── Schedulers
    ├── scheduleInventorySummaryEmails()
    └── scheduleStockMovementEmails()
```

### 4.2 Points forts

#### ✅ Configuration flexible
```typescript
interface EmailSettings {
  emailProvider: 'gmail' | 'ethereal' | 'smtp2go' | 'custom';
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  emailForwardTo: string;
  // ... flags par type
}
```

#### ✅ Templates HTML professionnels
- Design system cohérent (charcoal #1a1a1f, gold #c9a84c)
- Responsive (max-width: 480px)
- CSS inline pour compatibilité email clients
- Sections réutilisables (header, footer, line items)

#### ✅ Résolution RBAC des destinataires
```typescript
function getRecipientsForNotification(
  settingsRaw: SettingsReader,
  notificationType: string
): string[] {
  // 1. Lit role_notification_config (JSON)
  // 2. Filtre les rôles autorisés pour ce type
  // 3. Query users table pour emails
  // 4. Retourne liste unique d'emails
}
```

### 4.3 Problèmes identifiés

#### ❌ PROBLÈME 6 : Service monolithique (1973 lignes)
**Impact** : 
- Difficile à maintenir
- Tests unitaires complexes
- Responsabilités multiples (config, transport, templates, business logic)

#### ❌ PROBLÈME 7 : Templates inline dans le code
```typescript
const EMAIL_BASE_STYLE = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;
    background:#f0ede8;padding:32px 16px}
  // ... 400 lignes de CSS
`;
```
**Impact** :
- Pas de prévisualisation
- Difficile de modifier le design
- Pas de versioning des templates

#### ❌ PROBLÈME 8 : Singleton transporter avec cache faible
```typescript
let _transporter: any = null;
let _transporterKey = '';

async function getTransporter(settings: EmailSettings): Promise<any> {
  const key = `${settings.smtpHost}:${settings.smtpPort}:${settings.smtpUser}`;
  if (_transporter && key !== _transporterKey) {
    _transporter.close?.(); // ← Peut échouer silencieusement
    _transporter = null;
  }
  // ...
}
```
**Impact** : 
- Pas de gestion d'erreur sur `close()`
- Pas de limite de connexions SMTP
- Pas de health check

#### ❌ PROBLÈME 9 : Pas de validation des settings
```typescript
export function readEmailSettings(raw: SettingsReader): EmailSettings {
  // Pas de validation que smtpUser/smtpPass sont valides
  // Pas de test de connexion SMTP
}
```
**Impact** : Configuration invalide découverte seulement au premier envoi.

---

## 5. EVENT BUS

### 5.1 Architecture existante

#### InMemoryEventBus (Subscription Domain)
```typescript
export class InMemoryEventBus implements IEventBus {
  private handlers: Map<string, IEventHandler<any>> = new Map();

  async publish<T extends SubscriptionDomainEvent>(event: T): Promise<void> {
    const handler = this.handlers.get(event.type);
    if (handler) {
      try {
        await handler.handle(event);
      } catch (error) {
        console.error(`[InMemoryEventBus] Error handling event ${event.type}:`, error);
      }
    }
  }
}
```
**Usage** : Événements de abonnement uniquement (VoucherRequestSubmitted, SubscriptionActivated, etc.)

#### EventBusService (Platform/RBAC)
```typescript
export class EventBusService {
  private handlers: Map<string, EventHandler[]> = new Map();
  private eventQueue: RBACEvent[] = [];
  private redisSubscriber: RedisClient | null = null;

  async publish(event: RBACEvent): Promise<void> {
    this.eventQueue.push(event);
    // Traitement asynchrone
  }
}
```
**Usage** : Événements RBAC (role.updated, permission.updated, user.status.changed)

### 5.2 Problèmes identifiés

#### ❌ PROBLÈME 10 : Pas d'Event Bus pour les notifications
Les notifications sont déclenchées directement depuis les routes, pas via un Event Bus.

**Impact** :
- Impossible de désactiver les notifications sans modifier le code métier
- Pas de possibilité d'ajouter de nouveaux canaux (SMS, Push) sans toucher au code métier
- Pas de filtrage centralisé

#### ❌ PROBLÈME 11 : InMemoryEventBus non persistant
```typescript
// Les événements sont perdus si le serveur crash
async publish<T>(event: T): Promise<void> {
  const handler = this.handlers.get(event.type);
  if (handler) {
    await handler.handle(event); // ← Pas de persistence
  }
}
```
**Impact** : Aucune garantie de traitement des événements.

---

## 6. SYSTÈME DE QUEUE

### 6.1 État actuel

**Aucune queue persistante pour les emails.**

Les emails sont envoyés en mode fire-and-forget :
```typescript
setImmediate(async () => {
  try {
    await notifyStockAdjustment(...);
  } catch (err) {
    console.error('[Notification] email failed:', err);
  }
});
```

### 6.2 Queue existante (Audit uniquement)

`src/server/platform/audit-queue.service.ts` implémente une queue avec :
- Retry avec backoff exponentiel
- Dead letter queue après max retries
- Persistence en base de données
- Traitement par batch

**Ce modèle pourrait être réutilisé pour les notifications.**

### 6.3 Problèmes identifiés

#### ❌ PROBLÈME 12 : Pas de queue pour les emails
**Impact** :
- Emails perdus en cas de crash
- Pas de garantie de délivrabilité
- Pas de visibilité sur les emails en attente
- Pas de priorisation

#### ❌ PROBLÈME 13 : Pas de circuit breaker
Si le SMTP est indisponible, les tentatives d'envoi continuent sans limite.

---

## 7. SYSTÈME DE TEMPLATES

### 7.1 Templates existants

| Template | Fichier | Usage |
|-----------|---------|-------|
| Email générique | `notification.service.ts` (inline) | Ventes, inventaire |
| Stock Alert | `notification.service.ts` (inline) | Alertes stock |
| Inventory Summary | `notification.service.ts` (inline) | Rapport 3x/jour |
| Voucher Generated | `email-templates.ts` | Nouveau voucher |
| Voucher Expired | `email-templates.ts` | Expiration voucher |
| Payment Verified | `email-templates.ts` | Paiement accepté |
| Payment Rejected | `email-templates.ts` | Paiement refusé |

### 7.2 Design System

```css
/* Palette */
--charcoal: #1a1a1f;
--gold: #c9a84c;
--warm-white: #f7f4ef;
--red: #ef4444;
--amber: #d97706;

/* Structure */
.head { background: #1a1a1f; border-radius: 16px 16px 0 0; }
.body { background: #fff; padding: 28px; }
.foot { background: #f7f4ef; border-radius: 0 0 16px 16px; }
```

### 7.3 Problèmes identifiés

#### ❌ PROBLÈME 14 : Templates inline non versionnés
**Impact** :
- Impossible de savoir qui a modifié un template
- Pas de rollback possible
- Difficile de tester les modifications

#### ❌ PROBLÈME 15 : Pas de prévisualisation
**Impact** : Impossible de voir le rendu d'un template sans envoyer un email de test.

---

## 8. NOTIFICATIONS UI

### 8.1 Architecture

```
NotificationCenter.tsx (panneau coulissant)
├── Header (titre, compteur, boutons)
├── Tabs (Toutes / Non lues)
├── List (notifications triées par date)
│   └── NotificationItem
│       ├── Icon (priorité)
│       ├── Title + Message
│       ├── Time (relatif)
│       └── Priority Badge
└── Footer (note stockage local)

GlobalNotificationToast.tsx (toasts)
└── Affichage temporaire en haut à droite

useNotificationStore.ts (Zustand)
├── notifications: AppNotification[]
├── unreadCount: number
├── addNotification()
├── markAsRead() / markAllAsRead()
├── clearAll()
├── ingestNotifications() // ← Pour injection serveur
└── getVisibleNotifications(role)
```

### 8.2 Types de notifications UI

```typescript
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority; // 'critical' | 'high' | 'medium' | 'low'
  createdAt: string;
  readAt?: string;
  metadata?: Record<string, any>;
  link?: string; // e.g. '/orders?highlight=123'
}
```

### 8.3 Points forts

#### ✅ Interface utilisateur complète
- Panneau coulissant avec animations
- Tabs (Toutes / Non lues)
- Badges de priorité
- Marquage comme lu
- Filtrage par rôle (waiter, cashier)

#### ✅ Store Zustand bien structuré
- Limite à 100 notifications
- Dédupllication via `ingestNotifications()`
- Compteur de non lues

### 8.4 Problèmes identifiés

#### ❌ PROBLÈME 16 : Pas de synchronisation backend ↔ frontend
```typescript
// Frontend : notifications stockées localement
export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  // ...
  loadFromServer?: () => Promise<void>; // ← Non implémenté
}));
```
**Impact** :
- Les notifications serveur ne sont pas synchronisées avec le frontend
- `ingestNotifications()` existe mais n'est jamais appelé depuis le backend
- L'utilisateur ne voit pas ses notifications sur un autre appareil

#### ❌ PROBLÈME 17 : Pas de WebSocket/SSE
**Impact** :
- Les notifications apparaissent seulement après un refresh
- Pas de temps réel

---

## 9. NOTIFICATIONS TEMPS RÉEL

### 9.1 État actuel

**Aucune notification temps réel.**

Le seul mécanisme proche est Supabase Realtime, mais il n'est pas utilisé pour les notifications :
```typescript
// src/server/services/supabase-realtime-sync.service.ts
channel.on('postgres_changes', { event: '*', schema: 'public', table }, handlePayload);
```
Ce service est dédié à la synchronisation des données (products, orders), pas aux notifications.

### 9.2 Problèmes identifiés

#### ❌ PROBLÈME 18 : Pas de temps réel
**Impact** :
- L'utilisateur doit rafraîchir la page pour voir les nouvelles notifications
- Expérience utilisateur dégradée
- Impossible d'avoir des notifications instantanées

---

## 10. NOTIFICATIONS MOBILES

### 10.1 État actuel

**Aucune notification mobile.**

Pas d'intégration avec :
- Firebase Cloud Messaging (FCM)
- Apple Push Notification Service (APNS)
- OneSignal
- Push API Web

### 10.2 Problèmes identifiés

#### ❌ PROBLÈME 19 : Pas de notifications push
**Impact** :
- Les utilisateurs ne sont pas notifiés quand l'application est fermée
- Pas de notifications sur mobile
- Pas de badges sur l'icône de l'app

---

## 11. AUDIT RBAC

### 11.1 Configuration des rôles

```typescript
// src/stores/useSettingsStore.ts
const defaultRoleConfig: RoleNotificationConfig = {
  ADMIN: { 
    notifications: { 
      lowStock: true, inventory: true, stockAdj: true, 
      sales: true, newProduct: true, orderConfirm: true, 
      productDeleted: true, outOfStock: true 
    }, 
    emails: [] 
  },
  MANAGER: { 
    notifications: { 
      lowStock: true, inventory: true, stockAdj: true, 
      sales: true, orderConfirm: true, outOfStock: true 
    }, 
    emails: [] 
  },
  CASHIER: { 
    notifications: { 
      sales: true, orderConfirm: true, lowStock: true 
    }, 
    emails: [] 
  },
  SERVER: { 
    notifications: { 
      sales: true, orderConfirm: true 
    }, 
    emails: [] 
  },
  WAITER: { 
    notifications: { 
      sales: true, orderConfirm: true, lowStock: true 
    }, 
    emails: [] 
  }
};
```

### 11.2 Résolution des destinataires

```typescript
function getRecipientsForNotification(
  settingsRaw: SettingsReader,
  notificationType: string
): string[] {
  // 1. Parse role_notification_config (JSON)
  const config = typeof raw === 'string' ? JSON.parse(raw) : raw;
  
  // 2. Filtre les rôles autorisés
  const allowedRoles: string[] = [];
  Object.entries(config).forEach(([role, roleCfg]: any) => {
    const enabled = roleCfg?.notifications?.[notificationType] === true;
    if (enabled) allowedRoles.push(role.toLowerCase());
  });
  
  // 3. Query users table
  const users = db.prepare(`
    SELECT email, role
    FROM users
    WHERE LOWER(role) IN (${placeholders})
      AND email IS NOT NULL
      AND TRIM(email) != ''
      AND is_active = 1
      AND tenant_id = ?
  `).all(...allowedRoles, tenantId);
  
  // 4. Retourne emails uniques
  return [...new Set(users.map(u => normalizeEmail(u.email)))];
}
```

### 11.3 Points forts

#### ✅ RBAC fonctionnel
- Configuration par rôle dans `role_notification_config`
- Filtrage automatique des destinataires
- Normalisation des rôles (camelCase, snake_case, kebab-case)

### 11.4 Problèmes identifiés

#### ❌ PROBLÈME 20 : Pas de vérification de permissions avant envoi
```typescript
// ACTUEL : Pas de vérification que l'émetteur a le droit d'envoyer
await notifyStockAdjustment(
  productName, Number(id),
  qtyBefore, qtyChanged, qtyAfter,
  reason, performedBy, currency, settingsRaw
);
```
**Impact** : N'importe quel utilisateur peut déclencher une notification, même s'il n'a pas la permission.

#### ❌ PROBLÈME 21 : Pas d'audit des notifications envoyées
**Impact** :
- Impossible de savoir qui a été notifié
- Impossible de tracker les taux de lecture
- Pas de conformité RGPD

---

## 12. AUDIT MULTI-TENANT

### 12.1 Isolation

```typescript
// Toutes les requêtes sont filtrées par tenant_id
const tenantId = req.tenant_id;
const notifications = db.prepare(`
  SELECT * FROM notifications WHERE tenant_id = ?
`).all(tenantId);
```

### 12.2 Settings par tenant

```typescript
// Chaque tenant a ses propres settings
const settings = loadRawSettings(); // ← Filtre par tenant_id
```

### 12.3 Points forts

#### ✅ Isolation correcte
- Toutes les tables ont `tenant_id`
- Les settings sont par tenant
- Les destinataires sont filtrés par tenant

### 12.4 Problèmes identifiés

#### ❌ PROBLÈME 22 : Pas de limite de rate par tenant
**Impact** : Un tenant peut envoyer des milliers d'emails et bloquer le SMTP pour les autres.

---

## 13. AUDIT OFFLINE / SYNC

### 13.1 Double mode

```typescript
// Supabase (cloud)
if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase.from('notifications').select('*');
}

// SQLite (local)
const db = require('../db/database').db;
const notifications = db.prepare('SELECT * FROM notifications').all();
```

### 13.2 Problèmes identifiés

#### ❌ PROBLÈME 23 : Pas de synchronisation des notifications
**Impact** :
- Les notifications créées en mode local ne sont pas sync vers Supabase
- Les notifications créées en mode cloud ne sont pas sync vers SQLite
- L'utilisateur voit des notifications différentes selon le mode

---

## 14. AUDIT BASE DE DONNÉES

### 14.1 Tables

#### notifications
```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  notification_type TEXT,
  metadata TEXT, -- JSON
  link TEXT,
  user_id INTEGER,
  role TEXT,
  tenant_id INTEGER NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### notification_preferences
```sql
CREATE TABLE notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  role TEXT,
  email_enabled BOOLEAN DEFAULT 1,
  inapp_enabled BOOLEAN DEFAULT 1,
  qr_orders BOOLEAN DEFAULT 1,
  stock_alerts BOOLEAN DEFAULT 1,
  daily_reports BOOLEAN DEFAULT 1,
  inventory_summary BOOLEAN DEFAULT 1,
  payment_failed BOOLEAN DEFAULT 1,
  order_assigned BOOLEAN DEFAULT 1,
  system_errors BOOLEAN DEFAULT 1,
  tenant_id INTEGER NOT NULL
);
```

#### settings (pour config email)
```sql
-- Clés pertinentes
email_notifications_enabled
email_provider
smtp_host, smtp_port, smtp_secure
smtp_user, smtp_pass
email_forward_to
role_notification_config (JSON)
notify_stock_adjustment, notify_low_stock, etc.
```

### 14.2 Problèmes identifiés

#### ❌ PROBLÈME 24 : Pas d'index sur tenant_id + created_at
```sql
-- MANQUANT : Index pour performance
CREATE INDEX idx_notifications_tenant_created 
ON notifications(tenant_id, created_at DESC);
```
**Impact** : Requêtes lentes quand il y a beaucoup de notifications.

---

## 15. AUDIT API

### 15.1 Routes existantes

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/notifications` | Liste toutes les notifications |
| POST | `/api/notifications` | Crée une notification |
| PATCH | `/api/notifications/:id/read` | Marque comme lu |
| GET | `/api/notification_preferences` | Liste préférences |
| POST | `/api/notification_preferences` | Crée/met à jour préférences |

### 15.2 Problèmes identifiés

#### ❌ PROBLÈME 25 : Pas de pagination
```typescript
// ACTUEL : Limite hardcodée à 100
query.order('created_at', { ascending: false }).limit(100);
```
**Impact** : Impossible de récupérer les notifications au-delà des 100 dernières.

#### ❌ PROBLÈME 26 : Pas de filtres avancés
**Manquant** :
- Filtre par type
- Filtre par date
- Filtre par priorité
- Filtre par statut (lu/non lu)

#### ❌ PROBLÈME 27 : Pas de Webhook/WebSocket
**Impact** : Pas de notification en temps réel pour les clients.

---

## 16. AUDIT FRONTEND (HOOKS)

### 16.1 Store Zustand

```typescript
interface NotificationStore {
  notifications: AppNotification[];
  unreadCount: number;
  isCenterOpen?: boolean;
  
  // Actions
  addNotification: (payload) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  ingestNotifications: (incoming: AppNotification[]) => void;
  loadFromServer?: () => Promise<void>; // ← Non implémenté
  getVisibleNotifications: (role?: string) => AppNotification[];
  openCenter?: () => void;
  closeCenter?: () => void;
}
```

### 16.2 Problèmes identifiés

#### ❌ PROBLÈME 28 : loadFromServer() non implémenté
```typescript
// loadFromServer?: () => Promise<void>; // ← Optionnel, jamais appelé
```
**Impact** : Les notifications ne sont jamais chargées depuis le serveur.

#### ❌ PROBLÈME 29 : Pas de synchronisation automatique
**Impact** : L'utilisateur doit rafraîchir la page pour voir les nouvelles notifications.

---

## 17. AUDIT DES DÉPENDANCES

### 17.1 Backend

| Package | Version | Usage |
|---------|---------|-------|
| `nodemailer` | ^6.9.0 | Envoi d'emails |
| `@supabase/supabase-js` | ^2.39.0 | Base de données cloud |
| `better-sqlite3` | ^9.2.2 | Base de données locale |
| `zod` | ^3.22.0 | Validation (si utilisé) |

### 17.2 Frontend

| Package | Version | Usage |
|---------|---------|-------|
| `zustand` | ^4.4.0 | State management |
| `lucide-react` | ^0.294.0 | Icônes |

### 17.3 Problèmes identifiés

#### ⚠️ PROBLÈME 30 : Pas de bibliothèque de queue
**Manquant** :
- `bull` / `bullmq` (Redis-based queue)
- `pg-bull` (PostgreSQL queue)
- `aws-sqs` (SQS queue)

**Impact** : Pas de queue persistante pour les emails.

#### ⚠️ PROBLÈME 31 : Pas de bibliothèque de templating
**Manquant** :
- `handlebars` / `mustache` pour templates
- `mjml` pour emails responsifs

**Impact** : Templates inline difficiles à maintenir.

---

## 18. CONCLUSION

### 18.1 Score global

| Catégorie | Score | Commentaire |
|-----------|-------|-------------|
| **Fonctionnalité** | 7/10 | Emails fonctionnels, mais pas de temps réel/mobile |
| **Architecture** | 5/10 | Monolithique, couplage fort |
| **Résilience** | 3/10 | Pas de retry, pas de DLQ, pas de circuit breaker |
| **Traçabilité** | 4/10 | Logs basiques, pas de structured logging |
| **Performance** | 6/10 | Pas de pagination, pas d'index optimaux |
| **Maintenabilité** | 5/10 | Service de 1973 lignes, templates inline |
| **Évolutivité** | 4/10 | Pas d'Event Bus, pas de plugins |

**Score global : 4.9/10**

### 18.2 Recommandations prioritaires

#### P0 - CRITIQUE (à faire immédiatement)

1. **Implémenter une queue persistante pour les emails**
   - Utiliser `bullmq` avec Redis
   - Retry automatique avec backoff exponentiel
   - Dead letter queue après 3 échecs

2. **Ajouter un Event Bus pour les notifications**
   - Découpler émission et traitement
   - Permettre l'ajout de canaux (SMS, Push) sans modifier le code métier

3. **Implémenter loadFromServer()**
   - Synchroniser les notifications backend ↔ frontend
   - Polling toutes les 30s en fallback

#### P1 - IMPORTANT (à faire dans les 2 semaines)

4. **Ajouter WebSocket/SSE pour temps réel**
   - Socket.io ou Supabase Realtime
   - Notifications instantanées

5. **Structurer les logs**
   - Utiliser `pino` ou `winston`
   - Logs structurés (JSON)
   - Correlation IDs

6. **Ajouter des métriques**
   - Taux de délivrabilité
   - Temps d'envoi
   - Taux d'échec par canal

#### P2 - NICE TO HAVE (à faire dans le mois)

7. **Externaliser les templates**
   - Fichiers `.mjml` ou `.hbs`
   - Prévisualisation dans l'admin
   - Versioning

8. **Ajouter notifications mobiles**
   - Firebase Cloud Messaging (FCM)
   - Apple Push Notification Service (APNS)

9. **Refactoriser notification.service.ts**
   - Séparer en modules (transport, templates, business)
   - Tests unitaires complets

### 18.3 Architecture cible

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION SYSTEM V2                        │
└─────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │  Event Source │
  └──────┬───────┘
         │
         ▼
  ┌──────────────────┐
  │  Event Bus       │  (Nouveau : découplage)
  │  (Redis/InMemory)│
  └──────┬───────────┘
         │
         ▼
  ┌──────────────────┐
  │  Notification    │  (Nouveau : orchestrateur)
  │  Orchestrator    │
  └──────┬───────────┘
         │
         ├─► RBAC Filter ──► Vérifie permissions
         │
         ├─► Recipient Resolver ──► Qui notifier ?
         │
         ├─► Channel Router ──► Quel canal ?
         │   ├─► Email (nodemailer + queue)
         │   ├─► Push (FCM/APNS)
         │   ├─► SMS (Twilio)
         │   └─► In-App (WebSocket)
         │
         ▼
  ┌──────────────────┐
  │  Queue           │  (Nouveau : bullmq)
  │  (Redis)         │
  └──────┬───────────┘
         │
         ├─► Retry avec backoff
         ├─► Dead Letter Queue
         └─► Circuit Breaker
         │
         ▼
  ┌──────────────────┐
  │  SMTP / Push /   │
  │  SMS Providers   │
  └──────────────────┘
```

---

## ANNEXES

### A. Fichiers de configuration

- `.env` : Variables d'environnement SMTP
- `src/server/config/env.ts` : Configuration serveur
- `src/stores/useSettingsStore.ts` : Settings store (frontend)

### B. Variables d'environnement

```env
# SMTP
SMTP_USER=afcodenet@gmail.com
SMTP_PASS=mqiu vnjq ejmj cncs
SMTP_FORWARD_TO=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Mode
RENDER_CLOUD_MODE=false
USE_SUPABASE_TABLES=false
```

### C. Tests existants

Aucun test unitaire ou d'intégration pour le système de notifications.

**Recommandation** : Ajouter tests avec `jest` ou `vitest` :
- `notification.service.test.ts`
- `email-templates.test.ts`
- `notifications.routes.test.ts`