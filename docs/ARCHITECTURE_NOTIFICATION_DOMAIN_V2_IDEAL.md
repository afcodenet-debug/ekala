# ARCHITECTURE CIBLE — NOTIFICATION DOMAIN EKALA V2  
**Inspiration :** Stripe, Shopify, GitHub, Notion, Microsoft 365, AWS EventBridge  
**Niveau :** Architecture Design — DDD + Hexagonal + Event-Driven  
**Date :** 29/06/2026  
**Règle :** 0 code, 0 implémentation, uniquement modèles architecturaux

---

## PRINCIPES FONDAMENTAUX

### 1. Event-Driven Architecture
Toutes les notifications sont déclenchées par des **Domain Events**. Aucun appel direct depuis les routes ou services métier.

### 2. Hexagonal Architecture (Ports & Adapters)
Le cœur du domaine (Notification Domain) ne dépend d'aucune infrastructure. Toutes les dépendances sont injectées via des ports (interfaces).

### 3. CQRS (Command Query Responsibility Segregation)
- **Command Side** : Création, enrichment, dispatch des notifications
- **Query Side** : Inbox, read models, analytics, audit logs

### 4. Multi-Tenant by Design
Chaque aggregate, event, et read model est scoped par `tenant_id`. Aucune fuite possible.

### 5. Multi-Channel Native
Architecture pluggable pour ajouter des canaux (Email, SMS, Push, In-App, Webhook) sans modifier le domaine métier.

### 6. Observability First
Chaque notification est tracée, mesurée, auditée. Métriques, logs, traces, delivery receipts.

---

## 1. AGGREGATES

### 1.1 Notification (Aggregate Root)

**Responsabilité :** Représente une notification dans le système. Point d'entrée pour toutes les opérations.

**Identité :** `NotificationId` (UUID v7)

**État :**
- `Pending` : Créée, pas encore dispatchée
- `Dispatched` : Envoyée à tous les canaux
- `Delivered` : Confirmée livrée (au moins un canal)
- `Failed` : Échec définitif après retry
- `Expired` : Dépassée la durée de conservation

**Racine de cohérence :**
- NotificationId
- TenantId
- Recipients (liste)
- Channels (liste)
- Content (template + données)
- Priority
- Status
- CreatedAt
- ExpiresAt

**Règles métier :**
- Une notification ne peut pas être modifiée après création (immutable)
- Une notification peut être marquée "read" par un recipient
- Une notification expire après X jours (configurable par type)
- Une notification peut être envoyée sur plusieurs canaux

**Invariants :**
- `tenant_id` ne peut pas être null
- `priority` doit être dans [low, medium, high, critical]
- `expires_at` > `created_at`
- Au moins un recipient ou un channel

---

### 1.2 NotificationTemplate (Aggregate Root)

**Responsabilité :** Gère les templates de notification (email HTML, SMS text, push payload).

**Identité :** `TemplateId` (UUID)

**État :**
- `Draft`
- `Active`
- `Deprecated`

**Racine de cohérence :**
- TemplateId
- Name
- Channel (email, sms, push, inapp)
- Locale (fr, en, pt)
- Subject (pour email)
- Body (contenu)
- Variables (liste des variables attendues)
- Version
- CreatedAt
- UpdatedAt

**Règles métier :**
- Un template ne peut pas être supprimé s'il est utilisé (soft delete = deprecated)
- Chaque template a une version sémantique
- Les templates sont versionnés (historique conservé)

---

### 1.3 NotificationPreference (Aggregate Root)

**Responsabilité :** Gère les préférences de notification par utilisateur.

**Identité :** `PreferenceId` (UUID)

**Racine de cohérence :**
- PreferenceId
- UserId
- TenantId
- Channel (email, sms, push, inapp)
- EventType (ProductCreated, SaleCompleted, etc.)
- Enabled (booléen)
- Frequency (instant, daily_digest, weekly_digest)
- QuietHours (début, fin)
- CreatedAt
- UpdatedAt

**Règles métier :**
- Un utilisateur a une préférence par (channel × event_type)
- Si aucune préférence n'existe, default = enabled
- QuietHours : pas de notification hors de cette plage (sauf critical)

---

### 1.4 NotificationRule (Aggregate Root)

**Responsabilité :** Définit les règles de routage des notifications (qui reçoit quoi, via quel canal).

**Identité :** `RuleId` (UUID)

**Racine de cohérence :**
- RuleId
- TenantId
- Name
- EventType
- Priority (pour résoudre les conflits)
- Conditions (matchers)
- Actions (canaux + recipients)
- Enabled
- CreatedAt
- UpdatedAt

**Conditions (matchers) :**
- `role_in` : [admin, manager, cashier]
- `user_id_in` : [1, 2, 3]
- `tenant_id_eq` : 123
- `custom_attribute` : valeur

**Actions :**
- `send_email` : template + recipients
- `send_sms` : template + recipients
- `send_push` : template + recipients
- `send_inapp` : template + recipients
- `send_webhook` : URL + payload

**Règles métier :**
- Les règles sont évaluées dans l'ordre de priorité (priority DESC)
- La première règle qui match gagne (short-circuit)
- Si aucune règle ne match, fallback sur `role_notification_config` (legacy)

---

## 2. VALUE OBJECTS

### 2.1 NotificationId
- **Type :** UUID v7 (trié par timestamp)
- **Règles :** Ne peut pas être vide, unique globalement

### 2.2 TenantId
- **Type :** number (integer)
- **Règles :** > 0

### 2.3 UserId
- **Type :** number (integer)
- **Règles :** > 0

### 2.4 NotificationType
- **Type :** enum string
- **Valeurs :** `ProductCreated`, `SaleCompleted`, `StockLow`, `VoucherGenerated`, etc.
- **Règles :** Valeur normalisée (camelCase)

### 2.5 NotificationPriority
- **Type :** enum string
- **Valeurs :** `low`, `medium`, `high`, `critical`
- **Règles :** Valeur par défaut = `medium`

### 2.6 NotificationStatus
- **Type :** enum string
- **Valeurs :** `pending`, `dispatched`, `delivered`, `failed`, `expired`

### 2.7 ChannelType
- **Type :** enum string
- **Valeurs :** `email`, `sms`, `push`, `inapp`, `webhook`, `slack`, `teams`

### 2.8 DeliveryStatus
- **Type :** enum string
- **Valeurs :** `queued`, `sending`, `sent`, `delivered`, `bounced`, `failed`, `retrying`

### 2.9 Money
- **Type :** Value Object (montant + devise)
- **Propriétés :** `amount` (number), `currency` (string, ex: `USD`, `EUR`, `XAF`)
- **Règles :** amount >= 0, currency = 3 lettres (ISO 4217)

### 2.10 NotificationContent
- **Type :** Value Object
- **Propriétés :** `subject` (string), `body` (string), `html` (string?), `variables` (Map<string, any>)
- **Règles :** subject non vide, body non vide

### 2.11 Recipient
- **Type :** Value Object
- **Propriétés :** `userId` (number?), `email` (string), `phone` (string?), `role` (string)
- **Règles :** Au moins un des trois (userId, email, phone) doit être présent

### 2.12 QuietHours
- **Type :** Value Object
- **Propriétés :** `start` (time, ex: `22:00`), `end` (time, ex: `08:00`)
- **Règles :** start != end, format HH:mm

### 2.13 RetryPolicy
- **Type :** Value Object
- **Propriétés :** `maxAttempts` (number), `backoffStrategy` (enum: `linear`, `exponential`), `initialDelayMs` (number), `maxDelayMs` (number)
- **Règles :** maxAttempts > 0, initialDelayMs > 0

### 2.14 SLA
- **Type :** Value Object
- **Propriétés :** `deliveryTimeMs` (number), `retryTimeMs` (number), `expirationTimeMs` (number)
- **Règles :** Tous > 0

---

## 3. ENTITIES

### 3.1 Notification (Entity)

**Identité :** NotificationId

**Attributs :**
- NotificationId
- TenantId
- Type (NotificationType)
- Priority (NotificationPriority)
- Status (NotificationStatus)
- Content (NotificationContent)
- Recipients (List<Recipient>)
- Channels (List<ChannelType>)
- RuleId (NotificationRuleId?)
- CreatedAt
- UpdatedAt
- ExpiresAt
- Metadata (Map<string, any>)

**Comportements :**
- `markAsRead(userId)` → Status reste unchanged, ajoute read receipt
- `markAsDelivered(channel)` → Status = delivered
- `markAsFailed(channel, error)` → Status = failed
- `isExpired()` → booléen
- `canRetry()` → booléen

---

### 3.2 NotificationDelivery (Entity)

**Identité :** `DeliveryId` (UUID)

**Attributs :**
- DeliveryId
- NotificationId
- Channel (ChannelType)
- Recipient (Recipient)
- Status (DeliveryStatus)
- Attempts (number)
- LastError (string?)
- SentAt (timestamp?)
- DeliveredAt (timestamp?)
- CreatedAt
- UpdatedAt

**Comportements :**
- `incrementAttempt()` → attempts++
- `scheduleRetry(delayMs)` → status = retrying, updatedAt = now + delay
- `canRetry(maxAttempts)` → booléen

---

### 3.3 NotificationTemplate (Entity)

**Identité :** TemplateId

**Attributs :**
- TemplateId
- Name
- Channel
- Locale
- Subject
- Body
- Variables
- Version
- IsActive
- CreatedAt
- UpdatedAt

---

### 3.4 NotificationPreference (Entity)

**Identité :** PreferenceId

**Attributs :**
- PreferenceId
- UserId
- TenantId
- Channel
- EventType
- Enabled
- Frequency
- QuietHours (QuietHours?)
- CreatedAt
- UpdatedAt

---

### 3.5 NotificationRule (Entity)

**Identité :** RuleId

**Attributs :**
- RuleId
- TenantId
- Name
- EventType
- Priority
- Conditions (JSON)
- Actions (JSON)
- Enabled
- CreatedAt
- UpdatedAt

---

## 4. DOMAIN SERVICES

### 4.1 NotificationDispatcher

**Responsabilité :** Orchestre le dispatch des notifications vers les canaux appropriés.

**Méthodes :**
- `dispatch(notification: Notification)` → List<Delivery>
- `dispatchToChannel(notification, channel)` → Delivery
- `evaluateRules(notification)` → List<Rule>

**Dépendances :**
- INotificationRuleRepository
- INotificationPreferenceRepository
- IChannelProvider (pour chaque canal)

---

### 4.2 NotificationEnricher

**Responsabilité :** Enrichit les notifications avec les données métier (nom utilisateur, lien, etc.).

**Méthodes :**
- `enrich(notification: Notification, context: BusinessContext)` → Notification

**Logique :**
- Remplace les variables dans le template (ex: `{{userName}}` → "Jean Dupont")
- Ajoute les liens (ex: `/orders/123`)
- Ajoute les métadonnées (ex: `orderId: 123`)

---

### 4.3 NotificationRouter

**Responsabilité :** Détermine les destinataires d'une notification selon les règles RBAC.

**Méthodes :**
- `resolveRecipients(notification: Notification)` → List<Recipient>
- `applyRBAC(notification, roleConfig)` → List<Recipient>
- `applyRules(notification, rules)` → List<Recipient>

**Logique :**
- Lit `role_notification_config` (legacy)
- Évalue les `NotificationRule` (nouveau système)
- Fusionne les résultats (sans doublons)

---

### 4.4 NotificationScheduler

**Responsabilité :** Planifie les notifications différées (digest, rappels).

**Méthodes :**
- `schedule(notification: Notification, delay: Duration)` → ScheduledNotification
- `cancel(scheduledId: ScheduledNotificationId)` → void
- `getDueNotifications()` → List<Notification>

**Cas d'usage :**
- Digest quotidien (résumé des notifications)
- Rappel (ex: voucher expire dans 3 jours)
- Retry (après échec)

---

### 4.5 NotificationValidator

**Responsabilité :** Valide les notifications avant création.

**Méthodes :**
- `validate(notification: Notification)` → ValidationResult
- `validateRecipients(recipients)` → ValidationResult
- `validateContent(content)` → ValidationResult

**Règles :**
- Un recipient ne peut pas être notifié plus de 100x/jour (rate limit)
- Un template existe pour le canal et la locale
- Le contenu respecte les limites (ex: SMS = 160 caractères)

---

## 5. APPLICATION SERVICES

### 5.1 SendNotificationCommandHandler

**Responsabilité :** Gère la commande `SendNotificationCommand`.

**Flux :**
1. Valide la commande
2. Crée l'aggregate `Notification` (status = pending)
3. Enrichit la notification (NotificationEnricher)
4. Route vers les destinataires (NotificationRouter)
5. Persiste la notification
6. Publie `NotificationCreated` event
7. Retourne NotificationId

**Commande :** `SendNotificationCommand`
```json
{
  "tenantId": 123,
  "type": "ProductCreated",
  "priority": "medium",
  "content": {
    "subject": "Nouveau produit",
    "body": "Le produit {{productName}} a été créé",
    "variables": {"productName": "Pizza Margherita"}
  },
  "recipients": [{"role": "admin"}, {"userId": 1}],
  "channels": ["email", "inapp"],
  "ruleId": "rule-123" // optionnel
}
```

---

### 5.2 MarkAsReadCommandHandler

**Responsabilité :** Gère la commande `MarkAsReadCommand`.

**Flux :**
1. Charge la notification (NotificationRepository)
2. Vérifie que le user est un recipient
3. Crée un `ReadReceipt`
4. Met à jour le `InboxModel` (CQRS)
5. Publie `NotificationRead` event

---

### 5.3 UpdatePreferencesCommandHandler

**Responsabilité :** Gère la commande `UpdatePreferencesCommand`.

**Flux :**
1. Valide les préférences
2. Crée ou met à jour `NotificationPreference`
3. Publie `NotificationPreferenceUpdated` event

---

### 5.4 CreateRuleCommandHandler

**Responsabilité :** Gère la commande `CreateRuleCommand`.

**Flux :**
1. Valide la règle
2. Crée `NotificationRule`
3. Publie `NotificationRuleCreated` event

---

## 6. PORTS (INTERFACES)

### 6.1 INotificationRepository

```typescript
interface INotificationRepository {
  save(notification: Notification): Promise<void>
  findById(id: NotificationId): Promise<Notification | null>
  findByTenant(tenantId: TenantId, filters?: NotificationFilters): Promise<List<Notification>>
  markAsRead(notificationId: NotificationId, userId: UserId): Promise<void>
  delete(id: NotificationId): Promise<void>
  expire(oldNotifications: List<Notification>): Promise<void>
}
```

### 6.2 INotificationDeliveryRepository

```typescript
interface INotificationDeliveryRepository {
  save(delivery: NotificationDelivery): Promise<void>
  findById(id: DeliveryId): Promise<NotificationDelivery | null>
  findByNotification(notificationId: NotificationId): Promise<List<NotificationDelivery>>
  findRetryable(): Promise<List<NotificationDelivery>>
  markAsDelivered(id: DeliveryId): Promise<void>
  markAsFailed(id: DeliveryId, error: string): Promise<void>
}
```

### 6.3 INotificationTemplateRepository

```typescript
interface INotificationTemplateRepository {
  findById(id: TemplateId): Promise<NotificationTemplate | null>
  findByChannelAndLocale(channel: ChannelType, locale: string): Promise<List<NotificationTemplate>>
  findActiveByName(name: string): Promise<NotificationTemplate | null>
  save(template: NotificationTemplate): Promise<void>
}
```

### 6.4 INotificationPreferenceRepository

```typescript
interface INotificationPreferenceRepository {
  findByUserAndChannel(userId: UserId, channel: ChannelType): Promise<List<NotificationPreference>>
  findByUser(userId: UserId): Promise<List<NotificationPreference>>
  save(preference: NotificationPreference): Promise<void>
  delete(id: PreferenceId): Promise<void>
}
```

### 6.5 INotificationRuleRepository

```typescript
interface INotificationRuleRepository {
  findByTenant(tenantId: TenantId): Promise<List<NotificationRule>>
  findByEventType(tenantId: TenantId, eventType: NotificationType): Promise<List<NotificationRule>>
  save(rule: NotificationRule): Promise<void>
  delete(id: RuleId): Promise<void>
}
```

### 6.6 IChannelProvider (Interface pour chaque canal)

```typescript
interface IChannelProvider {
  channelType: ChannelType
  send(delivery: NotificationDelivery): Promise<DeliveryResult>
  validate(recipient: Recipient): Promise<boolean>
  getDeliveryStatus(deliveryId: DeliveryId): Promise<DeliveryStatus>
}
```

### 6.7 IDeliveryStrategy

```typescript
interface IDeliveryStrategy {
  deliver(notification: Notification, channel: ChannelType): Promise<List<Delivery>>
}
```

**Implémentations :**
- `BroadcastStrategy` : Envoie à tous les recipients
- `SingleRecipientStrategy` : Envoie à un seul recipient
- `RuleBasedStrategy` : Envoie selon les règles

### 6.8 IRetryPolicy

```typescript
interface IRetryPolicy {
  shouldRetry(delivery: NotificationDelivery, error: Error): boolean
  getNextRetryDelay(attempt: number): Duration
  getMaxAttempts(): number
}
```

### 6.9 ITemplateEngine

```typescript
interface ITemplateEngine {
  render(template: NotificationTemplate, variables: Map<string, any>): RenderedTemplate
  validate(template: NotificationTemplate): ValidationResult
}
```

### 6.10 IEventBus

```typescript
interface IEventBus {
  publish(event: DomainEvent): Promise<void>
  subscribe(eventType: string, handler: EventHandler): void
  unsubscribe(eventType: string, handler: EventHandler): void
}
```

### 6.11 IQueue

```typescript
interface IQueue {
  enqueue(job: Job): Promise<JobId>
  dequeue(): Promise<Job | null>
  acknowledge(jobId: JobId): Promise<void>
  reject(jobId: JobId, reason: string): Promise<void>
  getDeadLetterQueue(): Promise<List<Job>>
}
```

### 6.12 IReadModelUpdater

```typescript
interface IReadModelUpdater {
  updateInbox(userId: UserId, notification: Notification): Promise<void>
  updateUnreadCount(userId: UserId, tenantId: TenantId): Promise<void>
  updateAnalytics(event: DomainEvent): Promise<void>
}
```

---

## 7. ADAPTERS (IMPLÉMENTATIONS)

### 7.1 NotificationRepository (Adapter)

**Implémente :** INotificationRepository

**Infrastructure :**
- SQLite (local) : `notifications` table
- Supabase (cloud) : `notifications` table
- Cache : Redis (optionnel, pour les notifications récentes)

**Requêtes :**
- `findByTenant(tenantId, filters)` : SELECT avec index sur `tenant_id`, `created_at`, `read_at`
- `expire()` : DELETE WHERE `expires_at` < NOW()

---

### 7.2 NotificationDeliveryRepository (Adapter)

**Implémente :** INotificationDeliveryRepository

**Infrastructure :**
- SQLite : `notification_deliveries` table
- Supabase : `notification_deliveries` table

---

### 7.3 Channel Providers (Adapters)

#### 7.3.1 EmailChannelProvider

**Implémente :** IChannelProvider

**Channel :** `email`

**Dépendances :**
- Nodemailer (SMTP)
- Resend (API)
- AWS SES (optionnel)

**Logique :**
1. Récupère le template email
2. Render le template avec les variables
3. Envoie via le transport configuré
4. Attend le delivery receipt (webhook ou polling)
5. Met à jour le delivery status

**Métriques :**
- `emails_sent_total`
- `emails_delivered_total`
- `emails_bounced_total`
- `emails_failed_total`
- `email_delivery_time_ms` (histogram)

---

#### 7.3.2 SMSChannelProvider

**Implémente :** IChannelProvider

**Channel :** `sms`

**Dépendances :**
- Twilio (API)
- Africa's Talking (API)

**Logique :**
1. Récupère le template SMS
2. Render (texte brut, 160 caractères max)
3. Envoie via l'API SMS
4. Attend le delivery receipt (webhook)
5. Met à jour le delivery status

---

#### 7.3.3 PushChannelProvider

**Implémente :** IChannelProvider

**Channel :** `push`

**Dépendances :**
- Firebase Cloud Messaging (FCM)
- Expo Notifications (pour mobile)
- Web Push API (pour desktop)

**Logique :**
1. Récupère le device token du recipient
2. Récupère le template push
3. Render le payload (title, body, data)
4. Envoie via FCM/Expo
5. Attend le delivery receipt (FCM callback)
6. Met à jour le delivery status

---

#### 7.3.4 InAppChannelProvider

**Implémente :** IChannelProvider

**Channel :** `inapp`

**Dépendances :**
- Supabase Realtime (pour push)
- WebSocket (pour desktop)
- NotificationRepository (pour persistance)

**Logique :**
1. Crée la notification dans la table `notifications`
2. Publie via Supabase Realtime : `.from('notifications').insert(...)`
3. Le frontend écoute en temps réel : `.on('INSERT', callback)`
4. Met à jour le delivery status quand le frontend accuse réception

---

#### 7.3.5 WebhookChannelProvider

**Implémente :** IChannelProvider

**Channel :** `webhook`

**Dépendances :**
- HTTP client (node-fetch)
- Signature HMAC (pour sécurité)

**Logique :**
1. Récupère l'URL du webhook (depuis les préférences)
2. Construit le payload JSON
3. Signe le payload (HMAC-SHA256)
4. Envoie via POST
5. Attend le 200 OK
6. Retry si 5xx ou timeout
7. Met à jour le delivery status

---

### 7.4 Queue Adapters

#### 7.4.1 BullMQQueueAdapter

**Implémente :** IQueue

**Infrastructure :**
- Redis (stockage)
- BullMQ (library)

**Fonctionnalités :**
- Jobs prioritaires (critical > high > medium > low)
- Retry automatique avec backoff exponentiel
- Dead Letter Queue (après maxAttempts)
- Métriques intégrées (wait time, processing time)

---

#### 7.4.2 SQLiteOutboxQueueAdapter

**Implémente :** IQueue

**Infrastructure :**
- SQLite : `notification_outbox` table

**Fonctionnalités :**
- Outbox pattern (transaction locale)
- Worker qui lit l'outbox et envoie
- Dead Letter Queue : `notification_dlq` table

**Usage :** Mode local (sans Redis)

---

### 7.5 Event Bus Adapters

#### 7.5.1 RedisEventBusAdapter

**Implémente :** IEventBus

**Infrastructure :**
- Redis Pub/Sub

**Fonctionnalités :**
- Publish/Subscribe
- Topics par event type
- Persistance optionnelle (Redis Streams)

---

#### 7.5.2 InMemoryEventBusAdapter

**Implémente :** IEventBus

**Infrastructure :**
- Map en mémoire

**Fonctionnalités :**
- Synchronous (pas de latence)
- Pour tests et développement

---

### 7.6 Template Engine Adapters

#### 7.6.1 MJMLTemplateEngine

**Implémente :** ITemplateEngine

**Infrastructure :**
- MJML (library)
- Nodemailer (pour convertir MJML → HTML)

**Usage :** Templates email responsive

---

#### 7.6.2 HandlebarsTemplateEngine

**Implémente :** ITemplateEngine

**Infrastructure :**
- Handlebars (library)

**Usage :** Templates SMS, Push, Webhook (texte)

---

#### 7.6.3 ReactEmailTemplateEngine

**Implémente :** ITemplateEngine

**Infrastructure :**
- React Email (library)
- React (runtime)

**Usage :** Templates email complexes (composants React)

---

## 8. PROVIDERS

### 8.1 NotificationProvider (Factory)

**Responsabilité :** Fournit les instances des services et repositories.

**Méthodes :**
- `provideNotificationRepository()` → INotificationRepository
- `provideNotificationDeliveryRepository()` → INotificationDeliveryRepository
- `provideChannelProvider(channel)` → IChannelProvider
- `provideQueue()` → IQueue
- `provideEventBus()` → IEventBus
- `provideTemplateEngine()` → ITemplateEngine

**Implémentation :**
- Utilise un conteneur DI (ex: InversifyJS, tsyringe)
- Configuration via fichier YAML/JSON
- Support multi-environnement (dev, staging, prod)

---

### 8.2 SMTPProvider

**Responsabilité :** Fournit le transport email.

**Stratégies :**
- `GmailSMTPProvider` : smtp.gmail.com:587
- `EtherealSMTPProvider` : nodemailer.createTestAccount()
- `CustomSMTPProvider` : Configuration utilisateur
- `ResendProvider` : API Resend
- `SESProvider` : AWS SES

---

## 9. POLICIES

### 9.1 RateLimitPolicy

**Responsabilité :** Limite le nombre de notifications par utilisateur/tenant.

**Règles :**
- Max 100 notifications/heure/utilisateur
- Max 1000 notifications/jour/tenant
- Max 10 emails/minute (SMTP provider limit)

**Implémentation :**
- Redis (compteurs distribués)
- Sliding window algorithm

---

### 9.2 QuietHoursPolicy

**Responsabilité :** Bloque les notifications pendant les heures silencieuses.

**Règles :**
- Si `QuietHours` défini pour l'utilisateur : bloquer sauf `critical`
- Si `QuietHours` défini pour le tenant : bloquer sauf `critical`
- Par défaut : 22h-8h (configurable)

---

### 9.3 SubscriptionGuardPolicy

**Responsabilité :** Vérifie que le tenant a un abonnement actif avant d'envoyer.

**Règles :**
- Si subscription = expired/suspended/cancelled : bloquer sauf admin
- Si subscription = grace : autoriser mais logger
- Si subscription = active/trial : autoriser

**Dépendances :**
- SubscriptionGuard (existant dans Ekala)

---

### 9.4 RBACPolicy

**Responsabilité :** Vérifie que l'émetteur a le droit d'envoyer la notification.

**Règles :**
- Un `cashier` ne peut pas envoyer de notification `SubscriptionExpired`
- Un `waiter` ne peut pas envoyer de notification à `admin`
- Un `manager` peut envoyer à tous les rôles du tenant

**Dépendances :**
- Platform RBAC (existant dans Ekala)

---

## 10. DOMAIN EVENTS

### 10.1 NotificationCreated

**Payload :**
```json
{
  "notificationId": "uuid",
  "tenantId": 123,
  "type": "ProductCreated",
  "priority": "medium",
  "recipients": [{"userId": 1, "role": "admin"}],
  "channels": ["email", "inapp"],
  "createdAt": "2026-06-29T00:00:00Z"
}
```

**Abonnés :**
- NotificationDispatcher (pour dispatch)
- AnalyticsService (pour métriques)
- AuditLogService (pour traçabilité)

---

### 10.2 NotificationDispatched

**Payload :**
```json
{
  "notificationId": "uuid",
  "deliveryId": "uuid",
  "channel": "email",
  "recipient": {"userId": 1, "email": "user@example.com"},
  "dispatchedAt": "2026-06-29T00:00:01Z"
}
```

---

### 10.3 NotificationDelivered

**Payload :**
```json
{
  "notificationId": "uuid",
  "deliveryId": "uuid",
  "channel": "email",
  "deliveredAt": "2026-06-29T00:00:05Z"
}
```

---

### 10.4 NotificationFailed

**Payload :**
```json
{
  "notificationId": "uuid",
  "deliveryId": "uuid",
  "channel": "email",
  "error": "SMTP timeout",
  "attempt": 1,
  "failedAt": "2026-06-29T00:00:02Z"
}
```

**Abonnés :**
- RetryScheduler (pour retry)
- AlertingService (si critique)

---

### 10.5 NotificationRead

**Payload :**
```json
{
  "notificationId": "uuid",
  "userId": 1,
  "readAt": "2026-06-29T00:01:00Z"
}
```

**Abonnés :**
- InboxModelUpdater (pour mettre à jour unread count)
- AnalyticsService

---

### 10.6 NotificationPreferenceUpdated

**Payload :**
```json
{
  "preferenceId": "uuid",
  "userId": 1,
  "channel": "email",
  "eventType": "SaleCompleted",
  "enabled": false,
  "updatedAt": "2026-06-29T00:00:00Z"
}
```

---

### 10.7 NotificationRuleCreated / Updated / Deleted

**Payload :**
```json
{
  "ruleId": "uuid",
  "tenantId": 123,
  "eventType": "ProductCreated",
  "priority": 100,
  "action": "created" | "updated" | "deleted"
}
```

---

### 10.8 TemplateCreated / Updated / Deprecated

**Payload :**
```json
{
  "templateId": "uuid",
  "name": "ProductCreatedEmail",
  "channel": "email",
  "locale": "fr",
  "version": "1.2.0",
  "action": "created" | "updated" | "deprecated"
}
```

---

## 11. NOTIFICATION PREFERENCES

### 11.1 Modèle de préférences

**Par utilisateur :**
- Canaux activés (email, sms, push, inapp)
- Fréquence (instant, digest quotidien, digest hebdomadaire)
- Heures silencieuses (QuietHours)
- Filtres par type d'événement

**Par tenant (defaults) :**
- Canaux par défaut
- Fréquence par défaut
- Heures silencieuses par défaut
- `role_notification_config` (legacy, migré vers NotificationRule)

**Par rôle (RBAC) :**
- Quels types de notifications un rôle peut recevoir
- Quels canaux sont autorisés pour un rôle

---

### 11.2 Moteur de préférences

**Composants :**
- `PreferenceEngine` : Interroge les préférences utilisateur + tenant + rôle
- `PreferenceCache` : Cache Redis (TTL 5 min)
- `PreferenceFallback` : Si aucune préférence, utiliser les defaults

**Algorithme :**
```
1. Charger préférences utilisateur (userId + tenantId)
2. Charger préférences tenant (tenantId)
3. Charger préférences rôle (role)
4. Fusionner (user > tenant > role > global default)
5. Appliquer QuietHours
6. Retourner canaux autorisés + fréquence
```

---

## 12. NOTIFICATION RULES

### 12.1 Structure d'une règle

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
      "recipients": "dynamic" // résolu par les conditions
    },
    {
      "type": "send_inapp",
      "template": "LowStockAlertInApp"
    }
  ]
}
```

---

### 12.2 Moteur de règles

**Composants :**
- `RuleEngine` : Évalue les conditions
- `RuleMatcher` : Match les règles contre un événement
- `RuleExecutor` : Exécute les actions

**Algorithme :**
```
1. Récupérer toutes les règles actives pour (tenantId, eventType)
2. Trier par priority DESC
3. Pour chaque règle :
   a. Évaluer les conditions
   b. Si match : exécuter les actions (short-circuit)
   c. Si pas match : continuer
4. Si aucune règle ne match : fallback sur role_notification_config
```

---

## 13. CHANNEL PROVIDERS

### 13.1 Architecture

```
IChannelProvider (interface)
    │
    ├── EmailChannelProvider
    │   ├── SMTPTransport (nodemailer)
    │   ├── ResendTransport
    │   └── SESTransport
    │
    ├── SMSChannelProvider
    │   ├── TwilioAdapter
    │   └── AfricasTalkingAdapter
    │
    ├── PushChannelProvider
    │   ├── FCMAdapter
    │   ├── ExpoAdapter
    │   └── WebPushAdapter
    │
    ├── InAppChannelProvider
    │   ├── SupabaseRealtimeAdapter
    │   ├── WebSocketAdapter
    │   └── LocalStorageAdapter (offline)
    │
    └── WebhookChannelProvider
        ├── HTTPAdapter
        └── SlackAdapter
        └── TeamsAdapter
```

---

### 13.2 Interface commune

**Méthodes :**
- `send(delivery: NotificationDelivery): Promise<DeliveryResult>`
- `validate(recipient: Recipient): Promise<boolean>`
- `getDeliveryStatus(deliveryId: DeliveryId): Promise<DeliveryStatus>`
- `supports(recipient: Recipient): boolean`

**DeliveryResult :**
```typescript
{
  success: boolean
  deliveryId: DeliveryId
  status: DeliveryStatus
  error?: string
  metadata?: Map<string, any> // ex: messageId (email), messageSid (SMS)
}
```

---

## 14. DELIVERY STRATEGIES

### 14.1 BroadcastStrategy

**Responsabilité :** Envoie à tous les recipients.

**Logique :**
```
Pour chaque recipient :
  Créer un Delivery
  Envoyer via le channel provider
  Ajouter à la queue de retry si nécessaire
```

---

### 14.2 SingleRecipientStrategy

**Responsabilité :** Envoie à un seul recipient.

**Logique :**
```
Créer un Delivery pour le recipient
Envoyer via le channel provider
```

---

### 14.3 RuleBasedStrategy

**Responsabilité :** Envoie selon les règles de routage.

**Logique :**
```
1. Charger les règles pour (tenantId, eventType)
2. Évaluer les conditions
3. Pour chaque règle qui match :
   a. Exécuter les actions
   b. Créer les deliveries
```

---

### 14.4 DigestStrategy

**Responsabilité :** Agrège les notifications en un digest.

**Logique :**
```
1. Récupérer toutes les notifications pour (user, période)
2. Grouper par type d'événement
3. Render le template de digest
4. Envoyer un seul email/SMS
```

---

## 15. RETRY POLICIES

### 15.1 ExponentialBackoffRetryPolicy

**Paramètres :**
- `maxAttempts` : 3
- `initialDelayMs` : 1000 (1 seconde)
- `maxDelayMs` : 60000 (1 minute)
- `backoffMultiplier` : 2

**Algorithme :**
```
attempt 1 : delay = 1s
attempt 2 : delay = 2s
attempt 3 : delay = 4s
...
delay = min(initialDelayMs * (backoffMultiplier ^ (attempt - 1)), maxDelayMs)
```

---

### 15.2 LinearRetryPolicy

**Paramètres :**
- `maxAttempts` : 3
- `delayMs` : 5000 (5 secondes)

**Algorithme :**
```
attempt 1 : delay = 5s
attempt 2 : delay = 5s
attempt 3 : delay = 5s
```

---

### 15.3 NoRetryPolicy

**Responsabilité :** Aucun retry (pour les événements non critiques).

**Usage :** Notifications low priority (ex: rapport quotidien)

---

## 16. DEAD LETTER QUEUE (DLQ)

### 16.1 Architecture

```
Queue (BullMQ)
    │
    ├── Active Jobs
    ├── Delayed Jobs (retry)
    ├── Failed Jobs
    │   └── Dead Letter Queue (après maxAttempts)
    │
    └── Completed Jobs
```

---

### 16.2 DLQ Adapter

**Interface :**
```typescript
interface IDeadLetterQueue {
  enqueue(job: Job, error: Error): Promise<void>
  reprocess(jobId: JobId): Promise<void>
  discard(jobId: JobId): Promise<void>
  getJobs(): Promise<List<Job>>
}
```

**Implémentations :**
- `BullMQDeadLetterQueue` : Redis + BullMQ
- `SQLiteDeadLetterQueue` : Table `notification_dlq`

---

### 16.3 Gestion de la DLQ

**Workflow :**
1. Job échoue après maxAttempts
2. Job est déplacé vers DLQ
3. Alerte envoyée aux super_admins (si critical)
4. Interface admin pour :
   - Reprocesser (retry manuel)
   - Discarder (supprimer)
   - Inspecter (voir l'erreur)

---

## 17. DELIVERY RECEIPTS

### 17.1 Modèle

```typescript
{
  deliveryId: DeliveryId
  notificationId: NotificationId
  channel: ChannelType
  recipient: Recipient
  status: DeliveryStatus
  attempts: number
  sentAt: timestamp?
  deliveredAt: timestamp?
  openedAt: timestamp? // email uniquement
  clickedAt: timestamp? // email uniquement
  bouncedAt: timestamp? // email uniquement
  error: string?
  metadata: {
    messageId?: string // email
    messageSid?: string // SMS
    registrationId?: string // Push
  }
}
```

---

### 17.2 Collecte des receipts

**Email :**
- Webhook SMTP (Resend, SES)
- Polling IMAP (pour Gmail)
- Tracking pixel (pour open rate)

**SMS :**
- Webhook Twilio/AfricasTalking

**Push :**
- Callback FCM/Expo

**In-App :**
- Frontend accuse réception : `POST /api/notifications/:id/read`

---

## 18. NOTIFICATION TEMPLATES

### 18.1 Architecture

```
Templates/
  ├── email/
  │   ├── ProductCreated/
  │   │   ├── fr.mjml
  │   │   ├── en.mjml
  │   │   └── pt.mjml
  │   ├── SaleCompleted/
  │   │   ├── fr.mjml
  │   │   └── en.mjml
  │   └── LowStockAlert/
  │       └── fr.mjml
  ├── sms/
  │   ├── OrderAssigned/
  │   │   ├── fr.hbs
  │   │   └── en.hbs
  │   └── VoucherGenerated/
  │       └── fr.hbs
  ├── push/
  │   ├── QROrderReceived/
  │   │   └── fr.json
  │   └── StockLow/
  │       └── fr.json
  └── inapp/
      ├── ProductCreated/
      │   └── fr.json
      └── SaleCompleted/
          └── fr.json
```

---

### 18.2 Variables disponibles

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

## 19. READ MODELS (CQRS)

### 19.1 InboxModel

**Responsabilité :** Vue optimisée pour l'inbox utilisateur.

**Structure :**
```sql
CREATE TABLE inbox (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL,
  tenant_id INTEGER NOT NULL,
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
  
  INDEX idx_user_tenant (user_id, tenant_id),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_is_read (is_read)
);
```

**Requêtes :**
- `getInbox(userId, tenantId, filters, pagination)` → List<InboxItem>
- `getUnreadCount(userId, tenantId)` → number
- `markAsRead(notificationId, userId)` → void
- `markAllAsRead(userId, tenantId)` → void

---

### 19.2 UnreadCountModel

**Structure :**
```sql
CREATE TABLE unread_counts (
  user_id INTEGER NOT NULL,
  tenant_id INTEGER NOT NULL,
  unread_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (user_id, tenant_id)
);
```

**Mise à jour :**
- Trigger sur `inbox` (INSERT → +1, UPDATE read → -1)
- Ou via event bus (NotificationRead event)

---

### 19.3 NotificationStatsModel

**Structure :**
```sql
CREATE TABLE notification_stats (
  tenant_id INTEGER NOT NULL,
  date DATE NOT NULL,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  sent INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  opened INTEGER DEFAULT 0,
  clicked INTEGER DEFAULT 0,
  
  PRIMARY KEY (tenant_id, date, channel, event_type)
);
```

---

## 20. ANALYTICS

### 20.1 Métriques à collecter

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

### 20.2 Dashboard

**Vues :**
- **Real-time** : Notifications envoyées/délivrées/échouées (dernière heure)
- **Daily** : Volume par jour, par canal, par type
- **Weekly/Monthly** : Tendances
- **Per Tenant** : Top 10 tenants par volume
- **Per User** : Top 10 users par volume reçu
- **Delivery Performance** : Temps de livraison moyen par canal
- **Error Analysis** : Top 10 erreurs (SMTP timeout, invalid phone, etc.)

---

## 21. AUDIT LOGS

### 21.1 Structure

```sql
CREATE TABLE notification_audit_logs (
  id UUID PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER, // qui a déclenché (si action manuelle)
  action TEXT NOT NULL, // CREATE, SEND, READ, DELETE, UPDATE_PREFERENCE, CREATE_RULE
  entity_type TEXT NOT NULL, // Notification, Preference, Rule, Template
  entity_id UUID NOT NULL,
  changes JSONB, // avant/après (pour UPDATE)
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_tenant (tenant_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at DESC)
);
```

---

### 21.2 Events à logger

- `NotificationCreated` : Qui a créé, quels recipients, quel canal
- `NotificationSent` : Envoyé à qui, via quel canal
- `NotificationDelivered` : Livré à qui, quand
- `NotificationFailed` : Échec, erreur, tentative
- `NotificationRead` : Lu par qui, quand
- `NotificationDeleted` : Supprimé par qui, quand
- `PreferenceUpdated` : Qui a modifié, quels changements
- `RuleCreated/Updated/Deleted` : Qui a modifié, quels changements
- `TemplateCreated/Updated/Deprecated` : Qui a modifié, quels changements

---

## 22. SLA

### 22.1 Définitions

**Delivery Time (Délai de livraison) :**
- Critical : < 30 secondes
- High : < 2 minutes
- Medium : < 15 minutes
- Low : < 1 heure

**Availability (Disponibilité) :**
- Cible : 99.9% (43 minutes d'arrêt max/mois)
- Mesure : Uptime du service d'envoi

**Reliability (Fiabilité) :**
- Cible : 99.5% de delivery rate (hors bounce)
- Mesure : (delivered - bounced) / sent

**Retry Policy :**
- Critical : 5 tentatives, backoff exponentiel (1s, 2s, 4s, 8s, 16s)
- High : 3 tentatives, backoff exponentiel (1s, 2s, 4s)
- Medium : 2 tentatives, backoff linéaire (5s, 5s)
- Low : 1 tentative, pas de retry

---

### 22.2 Monitoring SLA

**Alertes :**
- Delivery time > SLA pendant 5 min → PagerDuty (critical)
- Delivery rate < 99% pendant 15 min → Slack #alerts
- DLQ > 100 jobs → Email aux super_admins
- Queue lag > 1000 jobs → Email aux super_admins

---

## 23. ARCHITECTURE GLOBALE

### 23.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOMAIN LAYER (CORE)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Aggregates                                                                 │
│  ├── Notification (Root)                                                    │
│  ├── NotificationTemplate                                                   │
│  ├── NotificationPreference                                                 │
│  └── NotificationRule                                                       │
│                                                                             │
│  Value Objects                                                               │
│  ├── NotificationId, TenantId, UserId                                       │
│  ├── NotificationType, Priority, Status                                     │
│  ├── ChannelType, DeliveryStatus                                             │
│  ├── Money, NotificationContent, Recipient                                   │
│  ├── QuietHours, RetryPolicy, SLA                                           │
│  └── ...                                                                    │
│                                                                             │
│  Domain Services                                                             │
│  ├── NotificationDispatcher                                                 │
│  ├── NotificationEnricher                                                   │
│  ├── NotificationRouter                                                     │
│  ├── NotificationScheduler                                                  │
│  └── NotificationValidator                                                  │
│                                                                             │
│  Domain Events                                                               │
│  ├── NotificationCreated, Dispatched, Delivered, Failed                     │
│  ├── NotificationRead                                                        │
│  ├── NotificationPreferenceUpdated                                          │
│  ├── NotificationRuleCreated/Updated/Deleted                                │
│  └── TemplateCreated/Updated/Deprecated                                     │
│                                                                             │
│  Ports (Interfaces)                                                          │
│  ├── INotificationRepository                                                 │
│  ├── INotificationDeliveryRepository                                        │
│  ├── INotificationTemplateRepository                                        │
│  ├── INotificationPreferenceRepository                                      │
│  ├── INotificationRuleRepository                                            │
│  ├── IChannelProvider                                                       │
│  ├── IDeliveryStrategy                                                      │
│  ├── IRetryPolicy                                                           │
│  ├── ITemplateEngine                                                        │
│  ├── IEventBus                                                              │
│  ├── IQueue                                                                 │
│  └── IReadModelUpdater                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ depends on (inversion)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER (ADAPTERS)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Repositories                                                               │
│  ├── NotificationRepository (SQLite + Supabase)                              │
│  ├── NotificationDeliveryRepository (SQLite + Supabase)                      │
│  ├── NotificationTemplateRepository (SQLite + Supabase)                      │
│  ├── NotificationPreferenceRepository (SQLite + Supabase)                    │
│  └── NotificationRuleRepository (SQLite + Supabase)                          │
│                                                                             │
│  Channel Providers                                                           │
│  ├── EmailChannelProvider (Nodemailer, Resend, SES)                          │
│  ├── SMSChannelProvider (Twilio, AfricasTalking)                             │
│  ├── PushChannelProvider (FCM, Expo, WebPush)                                │
│  ├── InAppChannelProvider (Supabase Realtime, WebSocket)                     │
│  └── WebhookChannelProvider (HTTP, Slack, Teams)                             │
│                                                                             │
│  Queue Adapters                                                              │
│  ├── BullMQQueueAdapter (Redis)                                              │
│  └── SQLiteOutboxQueueAdapter (SQLite)                                       │
│                                                                             │
│  Event Bus Adapters                                                          │
│  ├── RedisEventBusAdapter (Redis Pub/Sub)                                    │
│  └── InMemoryEventBusAdapter (Map)                                           │
│                                                                             │
│  Template Engine Adapters                                                    │
│  ├── MJMLTemplateEngine                                                      │
│  ├── HandlebarsTemplateEngine                                                │
│  └── ReactEmailTemplateEngine                                                │
│                                                                             │
│  Providers                                                                   │
│  ├── NotificationProvider (Factory)                                          │
│  ├── SMTPProvider (Gmail, Ethereal, Custom)                                  │
│  └── RetryPolicyProvider                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ uses
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Command Handlers                                                            │
│  ├── SendNotificationCommandHandler                                          │
│  ├── MarkAsReadCommandHandler                                                │
│  ├── UpdatePreferencesCommandHandler                                         │
│  ├── CreateRuleCommandHandler                                                │
│  ├── CreateTemplateCommandHandler                                            │
│  └── ...                                                                    │
│                                                                             │
│  Query Handlers                                                              │
│  ├── GetInboxQueryHandler                                                    │
│  ├── GetUnreadCountQueryHandler                                              │
│  ├── GetNotificationStatsQueryHandler                                        │
│  └── ...                                                                    │
│                                                                             │
│  Event Handlers                                                              │
│  ├── NotificationCreatedHandler → Dispatch                                   │
│  ├── NotificationReadHandler → UpdateReadModel                               │
│  ├── NotificationFailedHandler → Retry                                       │
│  └── ...                                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP / WebSocket / gRPC
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  REST API                                                                   │
│  ├── POST /api/notifications/send                                            │
│  ├── GET /api/notifications/inbox                                            │
│  ├── PATCH /api/notifications/:id/read                                       │
│  ├── GET /api/notifications/unread-count                                     │
│  ├── POST /api/notifications/preferences                                     │
│  ├── GET /api/notifications/rules                                            │
│  ├── POST /api/notifications/rules                                           │
│  └── ...                                                                    │
│                                                                             │
│  WebSocket                                                                  │
│  └── ws://api/notifications/realtime                                         │
│      └── Événements : INSERT, UPDATE, DELETE sur notifications               │
│                                                                             │
│  Frontend                                                                   │
│  ├── NotificationCenter (Drawer)                                             │
│  ├── GlobalNotificationToast                                                 │
│  ├── BellBadge (sidebar)                                                     │
│  ├── useNotificationQuery (TanStack Query)                                   │
│  └── useRealtimeNotifications (Supabase Realtime)                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 24. FLUX COMPLET (EXEMPLE)

### 24.1 ProductCreated → Email + In-App

```
1. Business Event : ProductCreated
   ↓
2. Domain Event publié : ProductCreated { productId, tenantId, productName }
   ↓
3. NotificationDispatcher écoute l'event
   ↓
4. Crée Notification aggregate :
   - type = ProductCreated
   - priority = medium
   - content = { subject: "Nouveau produit", body: "{{productName}}" }
   - recipients = [] (seront résolus par le router)
   - channels = [email, inapp]
   ↓
5. NotificationEnricher enrichit :
   - Remplace {{productName}} par "Pizza Margherita"
   - Ajoute link = "/products/123"
   ↓
6. NotificationRouter résout les recipients :
   - Évalue NotificationRule "Notify admins on product created"
   - Récupère tous les admin/manager du tenant
   ↓
7. Pour chaque recipient × channel :
   a. Crée NotificationDelivery
   b. Enrichit le contenu (template + variables)
   c. Enqueue dans BullMQ (priority = medium)
   ↓
8. BullMQ Worker traite le job :
   a. Récupère le template (ProductCreatedEmail, locale = fr)
   b. Render le template (MJML → HTML)
   c. Appelle EmailChannelProvider.send()
   d. Met à jour delivery status = sent
   e. Attend le webhook de delivery receipt
   f. Met à jour delivery status = delivered
   ↓
9. InAppChannelProvider :
   a. Insère dans table notifications
   b. Publie via Supabase Realtime
   c. Frontend reçoit l'event en temps réel
   d. Affiche dans NotificationCenter
   ↓
10. Read Model Updater :
    a. Met à jour inbox (INSERT)
    b. Met à jour unread_count (+1)
    c. Met à jour notification_stats
   ↓
11. Analytics :
    a. Compte +1 dans notifications_created_total
    b. Compte +1 dans notifications_sent_total (email)
    c. Compte +1 dans notifications_sent_total (inapp)
   ↓
12. Audit Log :
    a. Loggue NotificationCreated (qui, quand, quoi)
```

---

### 24.2 StockLow → SMS + Email (Critical)

```
1. Business Event : StockLow (détecté par polling 30s)
   ↓
2. NotificationDispatcher crée Notification :
   - type = StockLow
   - priority = high
   ↓
3. NotificationRouter résout les recipients :
   - Récupère admin + manager (role_notification_config)
   ↓
4. Pour chaque recipient :
   a. EmailChannelProvider.send() → enqueue BullMQ (priority = high)
   b. SMSChannelProvider.send() → enqueue BullMQ (priority = high)
   ↓
5. BullMQ Worker (high priority) :
   a. Tente SMS d'abord (canal préféré pour critical)
   b. Si SMS échoue → retry (3 fois, backoff exponentiel)
   c. Si SMS toujours échoue → DLQ + alerte admin
   d. Tente Email en parallèle
   ↓
6. Si les deux canaux échouent :
   a. Notification status = failed
   b. Alerte PagerDuty/Slack aux super_admins
   c. Crée ticket de support automatique
```

---

## 25. COMPARAISON AVEC LES STANDARDS

### 25.1 Stripe

| Concept Stripe | Ekala V2 |
|---|---|
| Events (stripe events) | Domain Events (NotificationCreated, etc.) |
| Webhook endpoints | Channel Providers (WebhookChannelProvider) |
| Idempotency keys | NotificationId (UUID v7, idempotent par nature) |
| Retry with backoff | Retry Policies (exponential, linear) |
| Dead Letter Queue | IDeadLetterQueue (BullMQ + SQLite) |
| Delivery receipts | DeliveryStatus + webhooks |
| Event bus | IEventBus (Redis Pub/Sub) |

---

### 25.2 Shopify

| Concept Shopify | Ekala V2 |
|---|---|
| Webhook engine | WebhookChannelProvider |
| GraphQL subscriptions | InAppChannelProvider (Supabase Realtime) |
| Multi-channel | Channel Providers (email, sms, push, inapp, webhook) |
| Template engine (Liquid) | ITemplateEngine (MJML, Handlebars, React Email) |
| Notification filters | NotificationRules + NotificationPreferences |

---

### 25.3 GitHub

| Concept GitHub | Ekala V2 |
|---|---|
| Notification inbox | InboxModel (CQRS) |
| Mark as read/unread | MarkAsReadCommandHandler |
| Notification groups | NotificationType (regroupement) |
| Email + Web + Mobile | Multi-channel (email, inapp, push) |
| Participation/Watching | NotificationPreferences (opt-in/opt-out) |

---

### 25.4 Notion

| Concept Notion | Ekala V2 |
|---|---|
| In-app notifications | InAppChannelProvider |
| Email digests | DigestStrategy |
| Real-time updates | Supabase Realtime + WebSocket |
| Notification settings | NotificationPreferences |

---

### 25.5 Microsoft 365

| Concept Microsoft | Ekala V2 |
|---|---|
| Message center | NotificationCenter (Drawer) |
| Email digests | DigestStrategy |
| Push notifications | PushChannelProvider (FCM, Expo) |
| Actionable messages | WebhookChannelProvider (boutons dans email) |

---

### 25.6 AWS EventBridge

| Concept EventBridge | Ekala V2 |
|---|---|
| Event bus | IEventBus (Redis Pub/Sub) |
| Rules / Targets | NotificationRules (conditions + actions) |
| Schema registry | NotificationType (enum) + Validation |
| Archive / Replay | NotificationRepository (historique) |
| Dead Letter Queue | IDeadLetterQueue |

---

## 26. PATTERNS ARCHITECTURAUX

### 26.1 Patterns utilisés

| Pattern | Usage |
|---|---|
| **Domain-Driven Design** | Aggregates, Value Objects, Domain Services, Ubiquitous Language |
| **Hexagonal Architecture** | Ports & Adapters (dépendances injectées) |
| **CQRS** | Séparation Command (écriture) / Query (lecture) |
| **Event Sourcing** (optionnel) | NotificationRepository peut stocker les events |
| **Event-Driven Architecture** | Domain Events + Event Bus |
| **Strategy Pattern** | Delivery Strategies (Broadcast, Single, RuleBased, Digest) |
| **Factory Pattern** | NotificationProvider (factory pour services) |
| **Repository Pattern** | INotificationRepository, etc. |
| **Unit of Work** | Transaction sur création notification + deliveries |
| **Outbox Pattern** | SQLiteOutboxQueueAdapter (garantit pas de perte) |
| **Circuit Breaker** | Sur les channel providers (SMTP, SMS, Push) |
| **Retry Pattern** | Retry Policies (exponential backoff) |
| **Dead Letter Queue** | Jobs échoués après maxAttempts |
| **Cache-Aside** | PreferenceCache (Redis) |
| **Publisher-Subscriber** | Event Bus (Redis Pub/Sub) |

---

### 26.2 Patterns à éviter

| Pattern | Raison |
|---|---|
| **God Service** | NotificationDispatcher est petit, responsabilité unique |
| **Anemic Domain Model** | Aggregates ont de la logique (invariants, comportements) |
| **Shared Kernel** | Notification Domain est isolé des autres bounded contexts |
| **Leaky Abstraction** | Ports cachent totalement l'infrastructure |
| **Callback Hell** | Async/await + Promise.all pour parallélisation |

---

## 27. EXTENSIBILITÉ

### 27.1 Ajouter un nouveau canal (ex: Telegram)

**Étapes :**
1. Créer `TelegramChannelProvider` (implémente `IChannelProvider`)
2. Ajouter `telegram` à l'enum `ChannelType`
3. Enregistrer le provider dans `NotificationProvider`
4. Ajouter le template Telegram dans `templates/telegram/`
5. Mettre à jour les préférences utilisateur (canal Telegram)

**Aucune modification du domaine métier.**

---

### 27.2 Ajouter un nouveau type d'événement (ex: UserLoggedIn)

**Étapes :**
1. Ajouter `UserLoggedIn` à l'enum `NotificationType`
2. Créer le template (email, inapp, etc.)
3. Créer une `NotificationRule` (qui est notifié, via quel canal)
4. Publier l'event `UserLoggedIn` depuis le Identity domain

**Aucune modification du Notification Domain.**

---

### 27.3 Ajouter une nouvelle métrique

**Étapes :**
1. Ajouter le compteur dans `AnalyticsService`
2. Incrémenter dans le `EventHandler` correspondant
3. Ajouter le graphique dans le dashboard

**Aucune modification du domaine métier.**

---

## 28. SÉCURITÉ

### 28.1 Multi-Tenant Isolation

**Règles :**
- Toutes les requêtes sont scoped par `tenant_id`
- Vérification à chaque couche (middleware → service → repository)
- Pas de requête cross-tenant possible

---

### 28.2 RBAC

**Règles :**
- Un utilisateur ne peut créer des notifications que pour son tenant
- Un utilisateur ne peut voir que ses propres notifications
- Un super_admin peut voir toutes les notifications (cross-tenant)
- Les règles de notification sont validées par `RBACPolicy`

---

### 28.3 Authentification

**Canaux sécurisés :**
- Email : SPF, DKIM, DMARC
- SMS : Numéros vérifiés
- Push : Device tokens signés
- Webhook : HMAC-SHA256 signature

---

## 29. OBSERVABILITÉ

### 29.1 Logs

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
- `trace_id` (pour corrélation)

---

### 29.2 Traces (Distributed Tracing)

**Outils :** OpenTelemetry, Jaeger, Zipkin

**Spans :**
- `notification.created`
- `notification.dispatched`
- `channel.send`
- `template.render`
- `queue.enqueue`
- `queue.dequeue`

---

### 29.3 Métriques (Prometheus)

**Compteurs :**
- `notifications_created_total`
- `notifications_sent_total`
- `notifications_delivered_total`
- `notifications_failed_total`

**Histogrammes :**
- `notification_dispatch_time_ms`
- `notification_delivery_time_ms`
- `queue_wait_time_ms`

**Jauges :**
- `queue_size`
- `dlq_size`
- `active_workers`

---

## 30. DÉPLOIEMENT

### 30.1 Architecture de déploiement

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (NGINX)                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼─────┐             ┌─────▼─────┐
        │  API Pod  │             │  API Pod  │
        │  (Node 1) │             │  (Node 2) │
        └─────┬─────┘             └─────┬─────┘
              │                         │
              └────────────┬────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼─────┐             ┌─────▼─────┐
        │  Redis    │             │  BullMQ   │
        │  (Queue)  │             │  Workers  │
        └───────────┘             └───────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼─────┐             ┌─────▼─────┐
        │  SQLite   │             │ Supabase  │
        │  (Local)  │             │  (Cloud)  │
        └───────────┘             └───────────┘
```

---

### 30.2 Scaling

**Horizontal :**
- API Pods : Auto-scaling basé sur CPU/RAM
- BullMQ Workers : Auto-scaling basé sur queue lag
- Redis : Cluster Redis (pour haute disponibilité)

**Vertical :**
- SQLite : Suffisant pour < 10k tenants
- Supabase : Gère automatiquement le scaling

---

## CONCLUSION

Cette architecture cible V2 pour le Notification Domain d'Ekala s'inspire des meilleurs patterns de l'industrie (Stripe, Shopify, GitHub, Notion, Microsoft 365, AWS EventBridge) tout en restant adaptée au contexte métier d'Ekala (restaurant POS, multi-tenant, SaaS).

**Points clés :**
1. **Event-Driven** : Toutes les notifications sont déclenchées par des Domain Events
2. **Hexagonal** : Le domaine est isolé de l'infrastructure
3. **Multi-Channel** : Architecture pluggable pour ajouter des canaux
4. **CQRS** : Séparation lecture/écriture pour la performance
5. **Observability** : Métriques, logs, traces, audit logs
6. **Resilience** : Retry, DLQ, Circuit Breaker, SLA
7. **Multi-Tenant** : Isolation par design
8. **Extensible** : Ajouter un canal/event sans modifier le domaine

**Prochaines étapes (non incluses dans ce document) :**
- Implémentation incrémentale (commencer par l'email, puis ajouter les canaux)
- Migration depuis l'ancien système (NotificationService monolithique)
- Tests (unitaires, intégration, charge)
- Documentation API (OpenAPI)
- Formation des équipes