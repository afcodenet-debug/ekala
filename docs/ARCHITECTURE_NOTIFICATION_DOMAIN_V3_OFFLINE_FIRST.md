# ARCHITECTURE NOTIFICATION V3 — EKALA  
**Contraintes :** Offline First, Multi-tenant, SQLite + Supabase, Event Driven, CQRS, Sync Compatible, RBAC, DDD, SOLID, Open/Closed, Observability Native  
**Futur :** Mobile Apps, WhatsApp, SMS, Push, Webhooks, Email, AI Agents  
**Niveau :** Architecture Design — Aucun code, uniquement modèles  
**Date :** 29/06/2026

---

## 1. PRINCIPES FONDAMENTAUX

### 1.1 Offline First

**Principe :** Le système fonctionne intégralement en local (SQLite) sans connexion. La synchronisation avec Supabase est asynchrone et best-effort.

**Implications :**
- Toutes les écritures vont d'abord dans SQLite (outbox local)
- Les lectures se font depuis SQLite (source de vérité locale)
- La sync avec Supabase se fait en arrière-plan (quand connecté)
- Pas de blocage sur la disponibilité réseau
- Cohérence éventuelle (eventual consistency) entre local et cloud

---

### 1.2 Multi-Tenant by Design

**Principe :** Chaque donnée est scoped par `tenant_id`. Isolation forte entre tenants.

**Implications :**
- Toutes les tables ont un `tenant_id` (indexé)
- Toutes les requêtes filtrent par `tenant_id`
- Pas de requête cross-tenant possible
- Un tenant ne voit que ses propres notifications

---

### 1.3 Dual Persistence (SQLite + Supabase)

**Principe :** SQLite est la source de vérité locale. Supabase est la source de vérité cloud (pour multi-device, platform admin).

**Architecture :**
```
┌─────────────┐
│   SQLite    │ ← Source de vérité LOCALE (offline-first)
│  (Local)    │
└──────┬──────┘
       │
       │ Sync (quand online)
       ▼
┌─────────────┐
│  Supabase   │ ← Source de vérité CLOUD (multi-device)
│  (Cloud)    │
└─────────────┘
```

**Règles :**
- Écriture : SQLite d'abord, puis sync vers Supabase
- Lecture : SQLite d'abord (pour performance), fallback Supabase
- Conflit : Last-Write-Wins (LWW) avec Lamport clock (comme le reste d'Ekala)

---

### 1.4 Event Driven + Sync Compatible

**Principe :** Les notifications sont déclenchées par des Domain Events. Le système de sync existant (GenericSyncService) transporte aussi les notifications.

**Intégration :**
- Les Domain Events sont stockés dans l'outbox locale (SQLite)
- Le GenericSyncService synchronise l'outbox vers Supabase
- Les events sont aussi publiés sur l'Event Bus local (pour traitement immédiat)

---

### 1.5 CQRS (Command Query Responsibility Segregation)

**Principe :** Séparation stricte entre écriture (Command) et lecture (Query).

**Côté Command :**
- Création de notifications
- Envoi (dispatch)
- Marquer comme lu
- Mise à jour préférences

**Côté Query :**
- Inbox (liste des notifications)
- Unread count
- Statistiques
- Analytics

**Bénéfice :** Optimisation indépendante des modèles de lecture (index, cache, materialized views).

---

### 1.6 DDD + SOLID + Open/Closed

**Principe :**
- **DDD** : Aggregates, Value Objects, Domain Services, Ubiquitous Language
- **SOLID** : Responsabilité unique, injection de dépendances, interfaces
- **Open/Closed** : Ajouter un canal/event sans modifier le domaine

---

### 1.7 Observability Native

**Principe :** Chaque notification est tracée, mesurée, auditée dès la création.

**Implémentation :**
- Logs structurés (JSON)
- Métriques Prometheus
- Traces distribuées (OpenTelemetry)
- Audit logs (qui a fait quoi, quand)
- Delivery receipts (suivi de livraison)

---

### 1.8 Future-Proof (Extensibilité)

**Principe :** L'architecture doit supporter l'ajout de canaux et fonctionnalités sans refactoring majeur.

**Canaux futurs :**
- Email (actuel)
- SMS (futur)
- Push (futur : FCM, Expo, APNs)
- WhatsApp (futur)
- Webhooks (futur)
- In-App (actuel)
- AI Agents (futur : chatbots, assistants)

**Mécanisme :** Plugin architecture avec interfaces (ports) pour chaque canal.

---

## 2. ARCHITECTURE GLOBALE

### 2.1 Vue d'ensemble (C4 Container)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EKALA PLATFORM                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    NOTIFICATION DOMAIN (Bounded Context)              │  │
│  │                                                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │   Domain     │  │ Application  │  │Infrastructure│              │  │
│  │  │    Layer     │  │    Layer     │  │    Layer     │              │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    SYNC LAYER (Existant Ekala)                        │  │
│  │  GenericSyncService → SyncOutbox → Supabase Replication              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    SQLite    │  │   Supabase   │  │    Redis     │  │   BullMQ     │  │
│  │   (Local)    │  │   (Cloud)    │  │   (Queue)    │  │  (Workers)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Architecture Hexagonale (Ports & Adapters)

```
                    ┌─────────────────────────────┐
                    │   Application Layer         │
                    │  (Command/Query Handlers)   │
                    └──────────────┬──────────────┘
                                   │
                                   │ uses
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                        DOMAIN LAYER (CORE)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Aggregates                                                 │ │
│  │  ├── Notification (Root)                                    │ │
│  │  ├── NotificationTemplate                                   │ │
│  │  ├── NotificationPreference                                 │ │
│  │  └── NotificationRule                                       │ │
│  │                                                             │ │
│  │  Domain Services                                            │ │
│  │  ├── NotificationDispatcher                                 │ │
│  │  ├── NotificationEnricher                                   │ │
│  │  ├── NotificationRouter                                     │ │
│  │  └── NotificationValidator                                  │ │
│  │                                                             │ │
│  │  Domain Events                                              │ │
│  │  ├── NotificationCreated                                    │ │
│  │  ├── NotificationDispatched                                 │ │
│  │  ├── NotificationDelivered                                  │ │
│  │  ├── NotificationFailed                                     │ │
│  │  └── NotificationRead                                       │ │
│  │                                                             │ │
│  │  Ports (Interfaces)                                         │ │
│  │  ├── INotificationRepository                                │ │
│  │  ├── INotificationDeliveryRepository                        │ │
│  │  ├── IChannelProvider                                       │ │
│  │  ├── IQueue                                                 │ │
│  │  ├── IEventBus                                              │ │
│  │  ├── ITemplateEngine                                        │ │
│  │  ├── ISyncProvider                                          │ │
│  │  └── ...                                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            │ implements
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Adapters                                                   │ │
│  │  ├── NotificationRepository                                 │ │
│  │  │   ├── SQLiteNotificationRepository                       │ │
│  │  │   └── SupabaseNotificationRepository                      │ │
│  │  ├── NotificationDeliveryRepository                         │ │
│  │  ├── Channel Providers                                      │ │
│  │  │   ├── EmailChannelProvider                               │ │
│  │  │   ├── SMSChannelProvider                                 │ │
│  │  │   ├── PushChannelProvider                                │ │
│  │  │   ├── WhatsAppChannelProvider                            │ │
│  │  │   ├── InAppChannelProvider                               │ │
│  │  │   └── WebhookChannelProvider                             │ │
│  │  ├── Queue Adapters                                         │ │
│  │  │   ├── BullMQQueueAdapter                                 │ │
│  │  │   └── SQLiteOutboxQueueAdapter                            │ │
│  │  ├── Event Bus Adapters                                     │ │
│  │  │   ├── RedisEventBusAdapter                               │ │
│  │  │   └── InMemoryEventBusAdapter                            │ │
│  │  ├── Template Engine Adapters                               │ │
│  │  │   ├── MJMLTemplateEngine                                 │ │
│  │  │   ├── HandlebarsTemplateEngine                           │ │
│  │  │   └── AIAgentTemplateEngine                              │ │
│  │  └── Sync Adapters                                          │ │
│  │      ├── GenericSyncAdapter (réutilise Ekala)                │ │
│  │      └── SupabaseRealtimeAdapter                             │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. OFFLINE-FIRST STRATEGY

### 3.1 Architecture Offline

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT (POS / Mobile / Web)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   SQLite     │  │   Outbox     │  │   Event Bus  │         │
│  │  (Local DB)  │  │   (Queue)    │  │  (In-Memory) │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                  │
│         └─────────────────┴──────────────────┘                  │
│                           │                                      │
│                           ▼                                      │
│                  ┌────────────────┐                             │
│                  │  Sync Engine   │                             │
│                  │  (Background)  │                             │
│                  └───────┬────────┘                             │
│                          │                                       │
│                    ┌─────▼─────┐                                │
│                    │  Network  │ (quand disponible)             │
│                    └─────┬─────┘                                │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           │ HTTPS / WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER (Ekala Backend)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   SQLite     │  │   Supabase   │  │   BullMQ     │         │
│  │  (Local)     │  │   (Cloud)    │  │   (Queue)    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                  │
│         └─────────────────┴──────────────────┘                  │
│                           │                                      │
│                           ▼                                      │
│                  ┌────────────────┐                             │
│                  │  Sync Service  │                             │
│                  │  (GenericSync) │                             │
│                  └───────┬────────┘                             │
│                          │                                       │
│                    ┌─────▼─────┐                                │
│                    │ Supabase  │ (réplication)                   │
│                    └───────────┘                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Outbox Pattern (Local)

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
1. Business event se produit (ex: ProductCreated)
2. Notification est créée dans `notifications` (SQLite)
3. Event est inséré dans `notification_outbox` (même transaction)
4. Sync Engine (GenericSyncService) lit l'outbox et sync vers Supabase
5. Si sync échoue → retry (backoff exponentiel)
6. Si max retries atteint → Dead Letter Queue

---

### 3.3 Inbox Pattern (Local)

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
4. Si conflit (même notification modifiée localement et cloud) → Last-Write-Wins

---

### 3.4 Sync Strategy

**Direction :** Bidirectionnelle (local → cloud, cloud → local)

**Fréquence :**
- Online : Sync toutes les 30s (comme GenericSyncService)
- Online + Changement : Sync immédiat (debounce 1s)
- Offline : Queue dans outbox, sync au retour de connexion

**Conflit :**
- Last-Write-Wins (LWW) avec Lamport clock
- Si conflit détecté → log + alerte (ne jamais perdre de données)

**Intégration avec GenericSyncService :**
- Réutilise le mécanisme existant d'Ekala
- Ajoute `notifications` et `inbox` aux tables synchronisées
- Utilise `sync_outbox` et `sync_dlq` existants

---

## 4. MULTI-TENANT & DUAL PERSISTENCE

### 4.1 Tenant Isolation

**Principe :** Toutes les données sont scoped par `tenant_id`.

**Implémentation :**
- SQLite : `tenant_id` dans toutes les tables (indexé)
- Supabase : `tenant_id` dans toutes les tables (indexé)
- Middleware : Vérification `tenant_id` à chaque requête
- Event Bus : Events incluent `tenant_id`

---

### 4.2 Dual Persistence Strategy

**SQLite (Local) :**
- Source de vérité pour le POS (lecture/écriture)
- Fonctionne offline
- Rapide (pas de réseau)
- Synchronisé vers Supabase

**Supabase (Cloud) :**
- Source de vérité pour multi-device (web, mobile)
- Fonctionne comme backup
- Permet le platform admin (super_admin voit tous les tenants)
- Synchronisé depuis SQLite

**Règles :**
- Écriture : SQLite d'abord, puis async vers Supabase
- Lecture : SQLite d'abord (pour le POS), Supabase en fallback
- Si Supabase indisponible → continue en local (pas de blocage)

---

### 4.3 Sync Adapter

**Interface :** `ISyncProvider`

```typescript
interface ISyncProvider {
  // Push local → cloud
  pushToCloud(tenantId: TenantId, entity: SyncEntity): Promise<SyncResult>
  
  // Pull cloud → local
  pullFromCloud(tenantId: TenantId, since: Timestamp): Promise<List<SyncEntity>>
  
  // Get last sync timestamp
  getLastSyncTimestamp(tenantId: TenantId): Promise<Timestamp>
  
  // Mark as synced
  markAsSynced(entityId: EntityId): Promise<void>
  
  // Handle conflict
  resolveConflict(local: Entity, cloud: Entity): Promise<Entity>
}
```

**Implémentations :**
- `GenericSyncAdapter` : Réutilise le GenericSyncService d'Ekala
- `SupabaseRealtimeAdapter` : Utilise Supabase Realtime pour push instantané
- `ManualSyncAdapter` : Pour debug/manual sync

---

## 5. EVENT-DRIVEN ARCHITECTURE

### 5.1 Domain Events (Core)

**Principe :** Toutes les notifications sont déclenchées par des Domain Events.

**Events :**
- `NotificationCreated` : Une notification a été créée
- `NotificationDispatched` : Une notification a été envoyée à un canal
- `NotificationDelivered` : Une notification a été livrée
- `NotificationFailed` : Une notification a échoué
- `NotificationRead` : Une notification a été lue
- `NotificationPreferenceUpdated` : Préférence modifiée
- `NotificationRuleCreated/Updated/Deleted` : Règle modifiée

**Structure :**
```typescript
interface DomainEvent {
  eventId: UUID
  eventType: string
  tenantId: TenantId
  aggregateId: UUID
  aggregateType: string
  payload: any
  metadata: {
    userId?: UserId
    correlationId?: UUID
    causationId?: UUID
    lamportClock: number
    originNode: string
  }
  occurredAt: Timestamp
}
```

---

### 5.2 Event Bus (Local + Cloud)

**Local Event Bus (In-Memory) :**
- Pour traitement immédiat (même process)
- Synchronous (pas de latence)
- Utilisé par le NotificationDispatcher

**Cloud Event Bus (Redis Pub/Sub) :**
- Pour communication inter-services
- Asynchronous
- Supporte les subscribers multiples

**Event Flow :**
```
Business Event (ex: ProductCreated)
  ↓
Domain Event (ProductCreated)
  ↓
Local Event Bus (publish)
  ↓
  ├── NotificationDispatcher (traite immédiatement)
  ├── Sync Engine (stocke dans outbox)
  └── Analytics (met à jour les métriques)
  ↓
Cloud Event Bus (Redis Pub/Sub, quand online)
  ↓
  ├── BullMQ Workers (envoi emails, SMS, etc.)
  ├── Analytics Service (métriques globales)
  └── Audit Log Service (traçabilité)
```

---

### 5.3 Integration avec Sync Existante

**Réutilisation de GenericSyncService :**
- Les Domain Events sont stockés dans `sync_outbox` (table existante)
- GenericSyncService les synchronise vers Supabase
- Pas de duplication de logique

**Ajout :**
- Ajouter `notifications` et `inbox` aux tables synchronisées
- Configurer les mappings dans `entity-registry.ts`

---

## 6. AGGREGATES (DDD)

### 6.1 Notification (Aggregate Root)

**Identité :** `NotificationId` (UUID v7)

**État :**
- `Pending` : Créée, pas encore dispatchée
- `Dispatched` : Envoyée à tous les canaux
- `Delivered` : Confirmée livrée
- `Failed` : Échec définitif après retry
- `Expired` : Dépassée la durée de conservation

**Racine de cohérence :**
- NotificationId
- TenantId
- Type (NotificationType)
- Priority (NotificationPriority)
- Status (NotificationStatus)
- Content (NotificationContent)
- Recipients (List<Recipient>)
- Channels (List<ChannelType>)
- CreatedAt
- ExpiresAt
- Metadata

**Règles métier :**
- Immutable après création (pas de modification)
- Expire après X jours (configurable)
- Peut être envoyée sur plusieurs canaux
- `tenant_id` ne peut pas être null

**Invariants :**
- `priority` ∈ {low, medium, high, critical}
- `expires_at` > `created_at`
- Au moins un recipient ou un channel

---

### 6.2 NotificationTemplate (Aggregate Root)

**Identité :** `TemplateId` (UUID)

**État :**
- `Draft`
- `Active`
- `Deprecated`

**Racine de cohérence :**
- TemplateId
- Name
- Channel (email, sms, push, inapp, whatsapp)
- Locale (fr, en, pt)
- Subject
- Body
- Variables
- Version
- IsActive

**Règles métier :**
- Soft delete (deprecated, pas deleted)
- Version sémantique
- Historique conservé

---

### 6.3 NotificationPreference (Aggregate Root)

**Identité :** `PreferenceId` (UUID)

**Racine de cohérence :**
- PreferenceId
- UserId
- TenantId
- Channel
- EventType
- Enabled
- Frequency (instant, daily_digest, weekly_digest)
- QuietHours (début, fin)

**Règles métier :**
- Une préférence par (user × channel × event_type)
- Default = enabled si aucune préférence
- QuietHours : bloquer sauf critical

---

### 6.4 NotificationRule (Aggregate Root)

**Identité :** `RuleId` (UUID)

**Racine de cohérence :**
- RuleId
- TenantId
- Name
- EventType
- Priority (pour résoudre conflits)
- Conditions (matchers)
- Actions (canaux + recipients)
- Enabled

**Règles métier :**
- Évaluées par priority DESC
- Short-circuit (première règle qui match gagne)
- Fallback sur `role_notification_config` (legacy)

---

## 7. VALUE OBJECTS

### 7.1 Identité

- **NotificationId** : UUID v7 (trié par timestamp)
- **TemplateId** : UUID
- **PreferenceId** : UUID
- **RuleId** : UUID
- **DeliveryId** : UUID
- **TenantId** : number (integer, > 0)
- **UserId** : number (integer, > 0)

---

### 7.2 Types

- **NotificationType** : enum (ProductCreated, SaleCompleted, StockLow, etc.)
- **NotificationPriority** : enum (low, medium, high, critical)
- **NotificationStatus** : enum (pending, dispatched, delivered, failed, expired)
- **ChannelType** : enum (email, sms, push, inapp, whatsapp, webhook)
- **DeliveryStatus** : enum (queued, sending, sent, delivered, bounced, failed, retrying)

---

### 7.3 Contenu

- **NotificationContent** : { subject, body, html?, variables }
- **Recipient** : { userId?, email, phone?, role }
- **Money** : { amount, currency }
- **QuietHours** : { start: time, end: time }

---

### 7.4 Politiques

- **RetryPolicy** : { maxAttempts, backoffStrategy, initialDelayMs, maxDelayMs }
- **SLA** : { deliveryTimeMs, retryTimeMs, expirationTimeMs }
- **RateLimit** : { maxPerUserPerHour, maxPerTenantPerDay }

---

## 8. ENTITIES

### 8.1 Notification

**Identité :** NotificationId

**Attributs :**
- NotificationId, TenantId, Type, Priority, Status
- Content, Recipients, Channels
- RuleId?, CreatedAt, UpdatedAt, ExpiresAt
- Metadata (Map)

**Comportements :**
- `markAsRead(userId)` → Ajoute read receipt
- `markAsDelivered(channel)` → Status = delivered
- `markAsFailed(channel, error)` → Status = failed
- `isExpired()` → booléen
- `canRetry()` → booléen

---

### 8.2 NotificationDelivery

**Identité :** DeliveryId

**Attributs :**
- DeliveryId, NotificationId, Channel, Recipient
- Status, Attempts, LastError
- SentAt, DeliveredAt, CreatedAt, UpdatedAt

**Comportements :**
- `incrementAttempt()` → attempts++
- `scheduleRetry(delayMs)` → status = retrying
- `canRetry(maxAttempts)` → booléen

---

### 8.3 NotificationTemplate

**Identité :** TemplateId

**Attributs :**
- TemplateId, Name, Channel, Locale
- Subject, Body, Variables, Version
- IsActive, CreatedAt, UpdatedAt

---

### 8.4 NotificationPreference

**Identité :** PreferenceId

**Attributs :**
- PreferenceId, UserId, TenantId
- Channel, EventType, Enabled
- Frequency, QuietHours?, CreatedAt, UpdatedAt

---

### 8.5 NotificationRule

**Identité :** RuleId

**Attributs :**
- RuleId, TenantId, Name, EventType
- Priority, Conditions (JSON), Actions (JSON)
- Enabled, CreatedAt, UpdatedAt

---

## 9. DOMAIN SERVICES

### 9.1 NotificationDispatcher

**Responsabilité :** Orchestre le dispatch des notifications vers les canaux.

**Méthodes :**
- `dispatch(notification: Notification)` → List<Delivery>
- `dispatchToChannel(notification, channel)` → Delivery
- `evaluateRules(notification)` → List<Rule>

**Dépendances :**
- INotificationRuleRepository
- INotificationPreferenceRepository
- IChannelProvider (pour chaque canal)

---

### 9.2 NotificationEnricher

**Responsabilité :** Enrichit les notifications avec les données métier.

**Méthodes :**
- `enrich(notification: Notification, context: BusinessContext)` → Notification

**Logique :**
- Remplace les variables (ex: `{{userName}}` → "Jean Dupont")
- Ajoute les liens (ex: `/orders/123`)
- Ajoute les métadonnées

---

### 9.3 NotificationRouter

**Responsabilité :** Détermine les destinataires selon les règles RBAC.

**Méthodes :**
- `resolveRecipients(notification: Notification)` → List<Recipient>
- `applyRBAC(notification, roleConfig)` → List<Recipient>
- `applyRules(notification, rules)` → List<Recipient>

**Logique :**
- Lit `role_notification_config` (legacy)
- Évalue les `NotificationRule` (nouveau système)
- Fusionne les résultats (sans doublons)

---

### 9.4 NotificationValidator

**Responsabilité :** Valide les notifications avant création.

**Méthodes :**
- `validate(notification: Notification)` → ValidationResult
- `validateRecipients(recipients)` → ValidationResult
- `validateContent(content)` → ValidationResult

**Règles :**
- Rate limit (max 100/heure/utilisateur)
- Template existe pour le canal et la locale
- Limites (ex: SMS = 160 caractères)

---

## 10. APPLICATION SERVICES

### 10.1 SendNotificationCommandHandler

**Responsabilité :** Gère la commande `SendNotificationCommand`.

**Flux :**
1. Valide la commande
2. Crée l'aggregate `Notification` (status = pending)
3. Enrichit la notification (NotificationEnricher)
4. Route vers les destinataires (NotificationRouter)
5. Persiste dans SQLite + outbox
6. Publie `NotificationCreated` event (local + cloud)
7. Retourne NotificationId

---

### 10.2 MarkAsReadCommandHandler

**Responsabilité :** Gère la commande `MarkAsReadCommand`.

**Flux :**
1. Charge la notification (SQLite)
2. Vérifie que le user est un recipient
3. Crée un `ReadReceipt`
4. Met à jour le `InboxModel` (CQRS)
5. Publie `NotificationRead` event
6. Sync vers Supabase

---

### 10.3 UpdatePreferencesCommandHandler

**Responsabilité :** Gère la commande `UpdatePreferencesCommand`.

**Flux :**
1. Valide les préférences
2. Crée ou met à jour `NotificationPreference`
3. Publie `NotificationPreferenceUpdated` event
4. Sync vers Supabase

---

### 10.4 CreateRuleCommandHandler

**Responsabilité :** Gère la commande `CreateRuleCommand`.

**Flux :**
1. Valide la règle
2. Crée `NotificationRule`
3. Publie `NotificationRuleCreated` event
4. Sync vers Supabase

---

## 11. PORTS (INTERFACES)

### 11.1 INotificationRepository

```typescript
interface INotificationRepository {
  save(notification: Notification): Promise<void>
  findById(id: NotificationId): Promise<Notification | null>
  findByTenant(tenantId: TenantId, filters?: NotificationFilters): Promise<List<Notification>>
  findInbox(userId: UserId, tenantId: TenantId, filters?: InboxFilters): Promise<List<InboxItem>>
  getUnreadCount(userId: UserId, tenantId: TenantId): Promise<number>
  markAsRead(notificationId: NotificationId, userId: UserId): Promise<void>
  markAllAsRead(userId: UserId, tenantId: TenantId): Promise<void>
  delete(id: NotificationId): Promise<void>
  expire(oldNotifications: List<Notification>): Promise<void>
}
```

---

### 11.2 INotificationDeliveryRepository

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

---

### 11.3 IChannelProvider

```typescript
interface IChannelProvider {
  channelType: ChannelType
  send(delivery: NotificationDelivery): Promise<DeliveryResult>
  validate(recipient: Recipient): Promise<boolean>
  getDeliveryStatus(deliveryId: DeliveryId): Promise<DeliveryStatus>
  supports(recipient: Recipient): boolean
}
```

---

### 11.4 IQueue

```typescript
interface IQueue {
  enqueue(job: Job, priority?: Priority): Promise<JobId>
  dequeue(): Promise<Job | null>
  acknowledge(jobId: JobId): Promise<void>
  reject(jobId: JobId, reason: string): Promise<void>
  scheduleRetry(jobId: JobId, delayMs: number): Promise<void>
  getDeadLetterQueue(): Promise<List<Job>>
  getQueueStats(): Promise<QueueStats>
}
```

---

### 11.5 IEventBus

```typescript
interface IEventBus {
  publish(event: DomainEvent): Promise<void>
  subscribe(eventType: string, handler: EventHandler): void
  unsubscribe(eventType: string, handler: EventHandler): void
}
```

---

### 11.6 ITemplateEngine

```typescript
interface ITemplateEngine {
  render(template: NotificationTemplate, variables: Map<string, any>): RenderedTemplate
  validate(template: NotificationTemplate): ValidationResult
  supports(channel: ChannelType): boolean
}
```

---

### 11.7 ISyncProvider

```typescript
interface ISyncProvider {
  pushToCloud(tenantId: TenantId, entity: SyncEntity): Promise<SyncResult>
  pullFromCloud(tenantId: TenantId, since: Timestamp): Promise<List<SyncEntity>>
  getLastSyncTimestamp(tenantId: TenantId): Promise<Timestamp>
  markAsSynced(entityId: EntityId): Promise<void>
  resolveConflict(local: Entity, cloud: Entity): Promise<Entity>
}
```

---

### 11.8 IRetryPolicy

```typescript
interface IRetryPolicy {
  shouldRetry(delivery: NotificationDelivery, error: Error): boolean
  getNextRetryDelay(attempt: number): Duration
  getMaxAttempts(): number
}
```

---

### 11.9 IDeliveryStrategy

```typescript
interface IDeliveryStrategy {
  deliver(notification: Notification, channel: ChannelType): Promise<List<Delivery>>
}
```

---

### 11.10 IReadModelUpdater

```typescript
interface IReadModelUpdater {
  updateInbox(userId: UserId, notification: Notification): Promise<void>
  updateUnreadCount(userId: UserId, tenantId: TenantId): Promise<void>
  updateAnalytics(event: DomainEvent): Promise<void>
}
```

---

### 11.11 IPreferenceEngine

```typescript
interface IPreferenceEngine {
  getPreferences(userId: UserId, tenantId: TenantId, eventType: NotificationType): Promise<NotificationPreferences>
  shouldSend(userId: UserId, tenantId: TenantId, eventType: NotificationType, channel: ChannelType): Promise<boolean>
  getQuietHours(userId: UserId, tenantId: TenantId): Promise<QuietHours | null>
}
```

---

### 11.12 IRuleEngine

```typescript
interface IRuleEngine {
  evaluate(tenantId: TenantId, eventType: NotificationType, context: BusinessContext): Promise<List<RuleMatch>>
}
```

---

## 12. ADAPTERS (IMPLÉMENTATIONS)

### 12.1 Repositories

#### 12.1.1 SQLiteNotificationRepository

**Implémente :** INotificationRepository

**Infrastructure :**
- SQLite : `notifications` table
- SQLite : `inbox` table
- SQLite : `notification_deliveries` table

**Requêtes :**
- `findByTenant()` : SELECT avec index sur `tenant_id`, `created_at`
- `findInbox()` : SELECT avec index sur `user_id`, `tenant_id`, `created_at DESC`
- `getUnreadCount()` : SELECT COUNT(*) WHERE `is_read` = false

---

#### 12.1.2 SupabaseNotificationRepository

**Implémente :** INotificationRepository

**Infrastructure :**
- Supabase : `notifications` table
- Supabase : `inbox` table
- Supabase : `notification_deliveries` table

**Usage :**
- Fallback si SQLite indisponible
- Multi-device (web, mobile)
- Platform admin (super_admin)

---

### 12.2 Channel Providers

#### 12.2.1 EmailChannelProvider

**Implémente :** IChannelProvider

**Channel :** `email`

**Dépendances :**
- Nodemailer (SMTP)
- Resend (API)
- AWS SES (optionnel)

**Logique :**
1. Récupère le template email
2. Render (MJML → HTML)
3. Envoie via transport configuré
4. Attend delivery receipt (webhook/polling)
5. Met à jour delivery status

**Métriques :**
- `emails_sent_total`
- `emails_delivered_total`
- `emails_bounced_total`
- `emails_failed_total`
- `email_delivery_time_ms`

---

#### 12.2.2 SMSChannelProvider

**Implémente :** IChannelProvider

**Channel :** `sms`

**Dépendances :**
- Twilio (API)
- Africa's Talking (API)

**Logique :**
1. Récupère le template SMS
2. Render (texte, 160 caractères max)
3. Envoie via API
4. Attend delivery receipt (webhook)
5. Met à jour delivery status

---

#### 12.2.3 PushChannelProvider

**Implémente :** IChannelProvider

**Channel :** `push`

**Dépendances :**
- Firebase Cloud Messaging (FCM)
- Expo Notifications (mobile)
- Web Push API (desktop)

**Logique :**
1. Récupère le device token
2. Récupère le template push
3. Render payload (title, body, data)
4. Envoie via FCM/Expo
5. Attend delivery receipt (callback)
6. Met à jour delivery status

---

#### 12.2.4 WhatsAppChannelProvider

**Implémente :** IChannelProvider

**Channel :** `whatsapp`

**Dépendances :**
- Twilio WhatsApp API
- WhatsApp Business API

**Logique :**
1. Récupère le template WhatsApp
2. Render (texte, image, boutons)
3. Envoie via API
4. Attend delivery receipt (webhook)
5. Met à jour delivery status

---

#### 12.2.5 InAppChannelProvider

**Implémente :** IChannelProvider

**Channel :** `inapp`

**Dépendances :**
- Supabase Realtime (pour push)
- WebSocket (pour desktop)
- NotificationRepository (pour persistance)

**Logique :**
1. Insère dans `inbox` (SQLite)
2. Publie via Supabase Realtime (si online)
3. Frontend écoute en temps réel
4. Met à jour delivery status quand frontend accuse réception

**Offline :**
- Stocke dans SQLite
- Pas de push temps réel (sera délivré au prochain online)

---

#### 12.2.6 WebhookChannelProvider

**Implémente :** IChannelProvider

**Channel :** `webhook`

**Dépendances :**
- HTTP client (node-fetch)
- Signature HMAC-SHA256

**Logique :**
1. Récupère l'URL du webhook
2. Construit le payload JSON
3. Signe le payload (HMAC)
4. Envoie via POST
5. Attend 200 OK
6. Retry si 5xx/timeout
7. Met à jour delivery status

---

### 12.3 Queue Adapters

#### 12.3.1 BullMQQueueAdapter

**Implémente :** IQueue

**Infrastructure :**
- Redis (stockage)
- BullMQ (library)

**Fonctionnalités :**
- Jobs prioritaires (critical > high > medium > low)
- Retry automatique avec backoff exponentiel
- Dead Letter Queue (après maxAttempts)
- Métriques intégrées

**Usage :** Mode cloud (avec Redis)

---

#### 12.3.2 SQLiteOutboxQueueAdapter

**Implémente :** IQueue

**Infrastructure :**
- SQLite : `notification_outbox` table

**Fonctionnalités :**
- Outbox pattern (transaction locale)
- Worker qui lit l'outbox et envoie
- Dead Letter Queue : `notification_dlq` table

**Usage :** Mode local (sans Redis, offline-first)

---

### 12.4 Event Bus Adapters

#### 12.4.1 RedisEventBusAdapter

**Implémente :** IEventBus

**Infrastructure :**
- Redis Pub/Sub

**Fonctionnalités :**
- Publish/Subscribe
- Topics par event type
- Persistance optionnelle (Redis Streams)

**Usage :** Mode cloud (multi-services)

---

#### 12.4.2 InMemoryEventBusAdapter

**Implémente :** IEventBus

**Infrastructure :**
- Map en mémoire

**Fonctionnalités :**
- Synchronous (pas de latence)
- Pour traitement immédiat (même process)

**Usage :** Mode local (offline)

---

### 12.5 Template Engine Adapters

#### 12.5.1 MJMLTemplateEngine

**Implémente :** ITemplateEngine

**Infrastructure :**
- MJML (library)
- Nodemailer (MJML → HTML)

**Usage :** Templates email responsive

---

#### 12.5.2 HandlebarsTemplateEngine

**Implémente :** ITemplateEngine

**Infrastructure :**
- Handlebars (library)

**Usage :** Templates SMS, Push, WhatsApp (texte)

---

#### 12.5.3 AIAgentTemplateEngine

**Implémente :** ITemplateEngine

**Infrastructure :**
- LLM API (OpenAI, Anthropic)
- Prompt templates

**Usage :** Génération dynamique de contenu (futur AI Agents)

**Exemple :**
```
Input: "Notify the admin that stock is low for {{productName}}"
Output: "⚠️ Stock Alert: {{productName}} is running low. Please reorder soon."
```

---

### 12.6 Sync Adapters

#### 12.6.1 GenericSyncAdapter

**Implémente :** ISyncProvider

**Infrastructure :**
- GenericSyncService (existant Ekala)
- SyncOutbox (existant)
- Supabase Replication

**Usage :** Synchronisation locale → cloud (réutilise l'existant)

---

#### 12.6.2 SupabaseRealtimeAdapter

**Implémente :** ISyncProvider

**Infrastructure :**
- Supabase Realtime (WebSocket)

**Usage :** Push instantané cloud → local (quand online)

---

## 13. CHANNEL PROVIDERS (FUTURE-PROOF)

### 13.1 Architecture Pluggable

```
IChannelProvider (interface)
    │
    ├── EmailChannelProvider (actuel)
    │   ├── SMTPTransport
    │   ├── ResendTransport
    │   └── SESTransport
    │
    ├── SMSChannelProvider (futur)
    │   ├── TwilioAdapter
    │   └── AfricasTalkingAdapter
    │
    ├── PushChannelProvider (futur)
    │   ├── FCMAdapter
    │   ├── ExpoAdapter
    │   └── WebPushAdapter
    │
    ├── WhatsAppChannelProvider (futur)
    │   └── TwilioWhatsAppAdapter
    │
    ├── InAppChannelProvider (actuel)
    │   ├── SupabaseRealtimeAdapter
    │   ├── WebSocketAdapter
    │   └── LocalStorageAdapter (offline)
    │
    └── WebhookChannelProvider (futur)
        ├── HTTPAdapter
        ├── SlackAdapter
        └── TeamsAdapter
```

---

### 13.2 Interface Commune

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
  metadata?: {
    messageId?: string // email
    messageSid?: string // SMS
    registrationId?: string // Push
    waMessageId?: string // WhatsApp
  }
}
```

---

## 14. AI AGENTS (FUTUR)

### 14.1 AI Agent Channel Provider

**Implémente :** IChannelProvider

**Channel :** `ai_agent`

**Dépendances :**
- LLM API (OpenAI GPT-4, Anthropic Claude)
- RAG (Retrieval-Augmented Generation)
- Vector DB (pour contexte)

**Usage :**
- Réponse intelligente aux notifications
- Résumé de notifications
- Actions automatiques (ex: "Reorder product X")
- Chatbot intégré

**Exemple :**
```
User: "Why did I get this notification?"
AI Agent: "You received this notification because product 'Pizza Margherita' 
           is running low on stock (5 units remaining, minimum 10). 
           Would you like me to create a purchase order?"
```

---

### 14.2 AI Agent Integration

**Architecture :**
```
Notification Created
  ↓
AI Agent Channel Provider
  ↓
1. Récupère le contexte (notification + historique + préférences)
  ↓
2. Génère une réponse intelligente (LLM)
  ↓
3. Propose des actions (create_order, send_email, etc.)
  ↓
4. Envoie la réponse via InAppChannelProvider
  ↓
5. User voit la suggestion dans NotificationCenter
```

---

## 15. CQRS READ MODELS

### 15.1 InboxModel (Local + Cloud)

**SQLite (Local) :**
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
  sync_status TEXT DEFAULT 'pending',
  
  INDEX idx_user_tenant (user_id, tenant_id),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_is_read (is_read)
);
```

**Supabase (Cloud) :**
- Même structure
- Synchronisé depuis SQLite
- Utilisé pour multi-device (web, mobile)

---

### 15.2 UnreadCountModel

**SQLite (Local) :**
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

### 15.3 NotificationStatsModel

**SQLite (Local) :**
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

**Supabase (Cloud) :**
- Agrégation globale (tous les tenants)
- Utilisé pour platform analytics

---

## 16. OBSERVABILITY

### 16.1 Logs (JSON structuré)

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

### 16.2 Métriques (Prometheus)

**Compteurs :**
- `notifications_created_total` (by tenant, channel, event_type)
- `notifications_sent_total` (by tenant, channel, event_type)
- `notifications_delivered_total` (by tenant, channel, event_type)
- `notifications_failed_total` (by tenant, channel, event_type)
- `notifications_read_total` (by tenant, event_type)

**Histogrammes :**
- `notification_creation_time_ms`
- `notification_dispatch_time_ms`
- `notification_delivery_time_ms`
- `queue_wait_time_ms`
- `template_render_time_ms`
- `sync_duration_ms` (local → cloud)

**Jauges :**
- `queue_size` (BullMQ)
- `dlq_size` (Dead Letter Queue)
- `outbox_size` (notification_outbox)
- `active_workers`
- `offline_tenants_count`

---

### 16.3 Traces (OpenTelemetry)

**Spans :**
- `notification.created`
- `notification.dispatched`
- `channel.send`
- `template.render`
- `queue.enqueue`
- `queue.dequeue`
- `sync.pushToCloud`
- `sync.pullFromCloud`

---

### 16.4 Audit Logs

**Table :** `notification_audit_logs`

```sql
CREATE TABLE notification_audit_logs (
  id UUID PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  lamport_clock INTEGER,
  origin_node TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_tenant (tenant_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at DESC)
);
```

**Events à logger :**
- NotificationCreated, Sent, Delivered, Failed, Read, Deleted
- PreferenceUpdated, RuleCreated/Updated/Deleted
- TemplateCreated/Updated/Deprecated

---

## 17. RBAC (Role-Based Access Control)

### 17.1 Intégration RBAC

**Principe :** Le système de notification s'intègre avec le RBAC existant d'Ekala.

**Règles :**
- Un utilisateur ne peut créer des notifications que pour son tenant
- Un utilisateur ne peut voir que ses propres notifications
- Un super_admin peut voir toutes les notifications (cross-tenant)
- Les règles de notification sont validées par RBACPolicy

---

### 17.2 Notification Rules (RBAC)

**Conditions :**
- `role_in` : [admin, manager, cashier, waiter]
- `user_id_in` : [1, 2, 3]
- `tenant_id_eq` : 123

**Actions :**
- `send_email` : template + recipients
- `send_sms` : template + recipients
- `send_push` : template + recipients
- `send_inapp` : template + recipients
- `send_whatsapp` : template + recipients

---

## 18. FLUX COMPLETS

### 18.1 Flux Online (ProductCreated → Email + In-App)

```
1. Business Event : ProductCreated
   ↓
2. Domain Event : ProductCreated { productId, tenantId, productName }
   ↓
3. Local Event Bus (publish)
   ↓
4. NotificationDispatcher écoute
   ↓
5. Crée Notification aggregate (status = pending)
   ↓
6. NotificationEnricher enrichit (remplace variables)
   ↓
7. NotificationRouter résout recipients (règles RBAC)
   ↓
8. Pour chaque recipient × channel :
   a. Crée NotificationDelivery
   b. Enrichit contenu (template + variables)
   c. Enqueue dans BullMQ (priority = medium)
   ↓
9. BullMQ Worker traite le job :
   a. Récupère template (ProductCreatedEmail, locale = fr)
   b. Render (MJML → HTML)
   c. EmailChannelProvider.send()
   d. Met à jour delivery status = sent
   e. Attend webhook de delivery receipt
   f. Met à jour delivery status = delivered
   ↓
10. InAppChannelProvider :
    a. Insère dans inbox (SQLite)
    b. Publie via Supabase Realtime
    c. Frontend reçoit en temps réel
    d. Affiche dans NotificationCenter
   ↓
11. Read Model Updater :
    a. Met à jour inbox (INSERT)
    b. Met à jour unread_count (+1)
    c. Met à jour notification_stats
   ↓
12. Sync Engine :
    a. Stocke dans notification_outbox
    b. Sync vers Supabase (quand online)
   ↓
13. Analytics : Compte +1 dans métriques
   ↓
14. Audit Log : Loggue NotificationCreated
```

---

### 18.2 Flux Offline (ProductCreated → Email + In-App)

```
1. Business Event : ProductCreated (POS offline)
   ↓
2. Domain Event : ProductCreated { productId, tenantId, productName }
   ↓
3. Local Event Bus (publish)
   ↓
4. NotificationDispatcher écoute (in-memory)
   ↓
5. Crée Notification aggregate (status = pending)
   ↓
6. NotificationEnricher enrichit
   ↓
7. NotificationRouter résout recipients
   ↓
8. Pour chaque recipient × channel :
   a. Crée NotificationDelivery
   b. Enrichit contenu
   c. Enqueue dans SQLiteOutboxQueueAdapter (notification_outbox)
   ↓
9. InAppChannelProvider :
   a. Insère dans inbox (SQLite)
   b. Affiche immédiatement dans NotificationCenter (UI)
   ↓
10. Read Model Updater :
    a. Met à jour inbox (SQLite)
    b. Met à jour unread_count (SQLite)
   ↓
11. Sync Engine :
    a. Stocke dans notification_outbox (même transaction)
    b. Pas de sync (offline)
   ↓
12. [Quand online] Sync Engine :
    a. Lit notification_outbox
    b. Sync vers Supabase
    c. BullMQ Workers traitent les emails
   ↓
13. [Quand online] Analytics + Audit Log
```

---

### 18.3 Flux Cloud → Local (Multi-Device)

```
1. User crée une notification sur Web (Supabase)
   ↓
2. Notification insérée dans Supabase
   ↓
3. Supabase Realtime publie l'event
   ↓
4. POS (local) écoute via SupabaseRealtimeAdapter
   ↓
5. Sync Engine reçoit l'event
   ↓
6. Insère dans SQLite (inbox)
   ↓
7. Affiche dans NotificationCenter (UI)
   ↓
8. Conflit ? (même notification modifiée localement et cloud)
   → Last-Write-Wins (Lamport clock)
   → Log + alerte si conflit détecté
```

---

## 19. MIGRATION PATH (DEPUIS V1/V2)

### 19.1 Stratégie

**Principe :** Migration incrémentale, sans breaking change.

**Phase 1 :** Ajouter les tables V3 (sans supprimer V1)
- `notifications_v3`
- `inbox_v3`
- `notification_outbox_v3`

**Phase 2 :** Double écriture (V1 + V3)
- NotificationService écrit dans V1 ET V3
- Progressivement migrer les appels

**Phase 3 :** Lecture depuis V3
- API lit depuis V3
- Frontend lit depuis V3

**Phase 4 :** Suppression V1
- Supprimer les tables V1
- Supprimer NotificationService (monolithique)

---

## 20. EXTENSIBILITÉ

### 20.1 Ajouter un nouveau canal (ex: Telegram)

**Étapes :**
1. Créer `TelegramChannelProvider` (implémente `IChannelProvider`)
2. Ajouter `telegram` à l'enum `ChannelType`
3. Enregistrer le provider dans `NotificationProvider`
4. Ajouter le template Telegram dans `templates/telegram/`
5. Mettre à jour les préférences utilisateur

**Aucune modification du domaine métier.**

---

### 20.2 Ajouter un AI Agent

**Étapes :**
1. Créer `AIAgentChannelProvider` (implémente `IChannelProvider`)
2. Ajouter `ai_agent` à l'enum `ChannelType`
3. Configurer le LLM (OpenAI, Anthropic)
4. Définir les prompts templates
5. Enregistrer le provider

**Aucune modification du domaine métier.**

---

## 21. SÉCURITÉ

### 21.1 Multi-Tenant Isolation

**Règles :**
- Toutes les requêtes sont scoped par `tenant_id`
- Vérification à chaque couche
- Pas de requête cross-tenant possible

---

### 21.2 RBAC

**Règles :**
- Un utilisateur ne peut créer des notifications que pour son tenant
- Un utilisateur ne peut voir que ses propres notifications
- Un super_admin peut voir toutes les notifications

---

### 21.3 Authentification (Canaux)

**Email :** SPF, DKIM, DMARC  
**SMS :** Numéros vérifiés  
**Push :** Device tokens signés  
**Webhook :** HMAC-SHA256 signature  
**WhatsApp :** WhatsApp Business API

---

## 22. DÉPLOIEMENT

### 22.1 Architecture

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

### 22.2 Scaling

**Horizontal :**
- API Pods : Auto-scaling (CPU/RAM)
- BullMQ Workers : Auto-scaling (queue lag)
- Redis : Cluster Redis (HA)

**Vertical :**
- SQLite : Suffisant pour < 10k tenants
- Supabase : Scaling automatique

---

## 23. COMPARAISON AVEC V2

### 23.1 Nouveautés V3

| Feature | V2 | V3 |
|---|---|---|
| Offline First | ❌ | ✅ |
| SQLite prioritaire | ❌ | ✅ |
| Sync intégré | ❌ | ✅ (réutilise GenericSyncService) |
| Outbox pattern | ❌ | ✅ |
| AI Agents | ❌ | ✅ |
| WhatsApp | ❌ | ✅ |
| Future-proof | ⚠️ | ✅ (plugin architecture) |

---

### 23.2 Comparaison avec standards

| Concept | Stripe | Shopify | GitHub | Ekala V3 |
|---|---|---|---|---|
| Event-Driven | ✅ | ✅ | ✅ | ✅ |
| Offline First | ❌ | ❌ | ❌ | ✅ |
| Multi-tenant | ✅ | ✅ | ❌ | ✅ |
| Dual Persistence | ❌ | ❌ | ❌ | ✅ (SQLite + Supabase) |
| Sync | ❌ | ❌ | ❌ | ✅ |
| AI Agents | ❌ | ❌ | ❌ | ✅ |
| Multi-channel | ✅ | ✅ | ⚠️ | ✅ |
| CQRS | ✅ | ✅ | ✅ | ✅ |
| DDD | ✅ | ✅ | ⚠️ | ✅ |

---

## 24. PRINCIPES CLÉS

### 24.1 Offline First

- SQLite est la source de vérité locale
- Fonctionne sans connexion
- Sync asynchrone vers Supabase
- Cohérence éventuelle

---

### 24.2 Event-Driven

- Toutes les notifications par Domain Events
- Event Bus local (in-memory) + cloud (Redis)
- Intégré avec GenericSyncService

---

### 24.3 CQRS

- Séparation Command (écriture) / Query (lecture)
- Read models optimisés (inbox, unread_count, stats)
- Sync des read models vers Supabase

---

### 24.4 DDD

- Aggregates avec invariants
- Value Objects immutables
- Domain Services (logique métier)
- Ubiquitous Language

---

### 24.5 SOLID + Open/Closed

- Responsabilité unique (chaque service fait une chose)
- Injection de dépendances (ports)
- Ajouter un canal = nouvelle classe (pas de modification)

---

### 24.6 Observability

- Logs structurés (JSON)
- Métriques Prometheus
- Traces OpenTelemetry
- Audit logs
- Delivery receipts

---

### 24.7 Future-Proof

- Plugin architecture (canaux)
- AI Agents intégrés
- WhatsApp, SMS, Push, Webhooks
- Mobile Apps (iOS, Android)
- Extensible sans refactoring

---

## CONCLUSION

L'architecture V3 du Notification Domain pour Ekala est :

1. **Offline First** : Fonctionne sans connexion, SQLite prioritaire
2. **Multi-tenant** : Isolation forte par `tenant_id`
3. **Dual Persistence** : SQLite (local) + Supabase (cloud)
4. **Event-Driven** : Domain Events + Event Bus
5. **CQRS** : Séparation écriture/lecture
6. **Sync Compatible** : Intégré avec GenericSyncService
7. **RBAC** : Règles de routage + préférences
8. **DDD** : Aggregates, Value Objects, Domain Services
9. **SOLID** : Injection de dépendances, responsabilité unique
10. **Open/Closed** : Ajouter canaux/events sans modifier le domaine
11. **Observability** : Logs, métriques, traces, audit
12. **Future-proof** : Mobile, WhatsApp, SMS, Push, Webhooks, AI Agents

**Inspirations :**
- Offline First : Firebase (local-first sync)
- Multi-tenant : Stripe (isolation)
- Event-Driven : AWS EventBridge (event bus, rules)
- CQRS : GitHub (inbox, read models)
- AI Agents : Microsoft Copilot (intégration LLM)
- Sync : Ekala GenericSyncService (réutilisé)

**Prochaines étapes (non incluses) :**
- Implémentation incrémentale
- Migration depuis V1/V2
- Tests (unitaires, intégration, charge)
- Documentation API
- Formation équipes