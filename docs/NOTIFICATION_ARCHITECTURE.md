# NOTIFICATION ARCHITECTURE — EKALA

**Version:** 1.0.0  
**Date:** 29 Juin 2026  
**Statut:** OFFICIEL  
**Niveau:** Enterprise  
**Patterns:** DDD, Event-Driven, CQRS, Event Sourcing, Offline-First, Multi-tenant

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble](#1-vue-densemble)
2. [Bounded Contexts](#2-bounded-contexts)
3. [Event Flow](#3-event-flow)
4. [Notification Pipeline](#4-notification-pipeline)
5. [Policy Engine](#5-policy-engine)
6. [Routing Engine](#6-routing-engine)
7. [Delivery Engine](#7-delivery-engine)
8. [Presentation Layer](#8-presentation-layer)
9. [Offline Pipeline](#9-offline-pipeline)
10. [Realtime Pipeline](#10-realtime-pipeline)
11. [Failure Handling](#11-failure-handling)
12. [Multi-tenant Isolation](#12-multi-tenant-isolation)
13. [Security Model](#13-security-model)
14. [Sequence Diagrams](#14-sequence-diagrams)
15. [State Diagrams](#15-state-diagrams)
16. [Architecture Decision Records](#16-architecture-decision-records)

---

## 1. VUE D'ENSEMBLE

### 1.1 Philosophie architecturale

**Principles:**
- **Domain-Driven Design:** Bounded contexts explicites
- **Event-Driven:** Communication asynchrone par événements
- **CQRS:** Séparation Command/Query
- **Event Sourcing:** Traçabilité complète
- **Offline-First:** Fonctionnement sans réseau
- **Multi-tenant:** Isolation complète par tenant
- **Security by Design:** Sécurité à chaque couche

### 1.2 Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Web App    │  │  Mobile App  │  │  Desktop App │         │
│  │  (React)     │  │ (React Native)│  │   (Electron) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Authentication │  Rate Limiting │  Routing │  Monitoring │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Notification Application Service              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │
│  │  │   Commands  │  │   Queries   │  │   Handlers  │      │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DOMAIN LAYER                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Notification Domain                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │
│  │  │ Aggregates  │  │   Events    │  │  Policies   │      │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │
│  │  │   Services  │  │   Rules     │  │   States    │      │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     INFRASTRUCTURE LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Event Bus  │  │   Message    │  │     Cache    │        │
│  │   (Kafka)    │  │   Queue      │  │   (Redis)    │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Realtime   │  │   Storage    │  │   Monitoring │        │
│  │  (Supabase)  │  │ (PostgreSQL) │  │  (Prometheus)│        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Principes architecturaux

**Separation of Concerns:**
- Presentation: UI/UX uniquement
- Application: Orchestration
- Domain: Logique métier
- Infrastructure: Techniques

**Dependency Rule:**
- Domain ne dépend de rien
- Application dépend de Domain
- Infrastructure dépend de Domain
- Presentation dépend de Application

**Async-First:**
- Toute communication inter-service est asynchrone
- Events comme source de vérité
- CQRS pour lectures optimisées

**Offline-First:**
- Fonctionnement sans réseau
- Sync automatique
- Conflict resolution

---

## 2. BOUNDED CONTEXTS

### 2.1 Notification Context

**Responsabilité:** Gestion complète du cycle de vie des notifications

**Aggregates:**
- Notification (racine)
- NotificationThread
- NotificationGroup
- NotificationDigest

**Entities:**
- NotificationRecipient
- NotificationChannel
- NotificationDelivery
- NotificationAction
- NotificationAttachment

**Value Objects:**
- NotificationId
- NotificationPriority
- NotificationSeverity
- NotificationCategory
- NotificationStatus
- NotificationTemplate

**Services:**
- NotificationService (application)
- PolicyEngine
- RoutingEngine
- DeliveryEngine
- FusionEngine
- AntiSpamEngine

**Repositories:**
- NotificationRepository
- NotificationDeliveryRepository
- NotificationAuditRepository

### 2.2 Event Context

**Responsabilité:** Gestion des événements métier

**Aggregates:**
- Event (racine)
- EventStream

**Entities:**
- EventHandler
- EventSubscription

**Services:**
- EventBus
- EventStore
- EventReplay

### 2.3 Preference Context

**Responsabilité:** Gestion des préférences utilisateur

**Aggregates:**
- UserPreferences (racine)

**Entities:**
- NotificationPreference
- QuietHours
- DigestSchedule

**Services:**
- PreferenceResolver
- PreferenceInheritance

### 2.4 Delivery Context

**Responsabilité:** Livraison multi-canal

**Aggregates:**
- Delivery (racine)

**Entities:**
- DeliveryAttempt
- DeliveryChannel
- DeliveryStatus

**Services:**
- ChannelRouter
- DeliveryExecutor
- RetryManager
- FallbackManager

### 2.5 Analytics Context

**Responsabilité:** Métriques et analytics

**Aggregates:**
- AnalyticsEvent (racine)

**Entities:**
- NotificationMetric
- UserEngagement
- DeliveryMetric

**Services:**
- MetricsCollector
- AnalyticsEngine
- DashboardService

---

## 3. EVENT FLOW

### 3.1 Event-Driven Architecture

**Pattern:** Event Sourcing + CQRS

**Event Store:** Source de vérité unique

**Event Flow:**
```
Business Event
    ↓
Event Bus (Kafka)
    ↓
Event Handler
    ↓
Policy Engine
    ↓
Routing Engine
    ↓
Delivery Engine
    ↓
Presentation Layer
```

### 3.2 Event Types

**Domain Events:**
- NotificationCreated
- NotificationQueued
- NotificationDisplayed
- NotificationRead
- NotificationProcessed
- NotificationArchived
- NotificationDeleted
- NotificationExpired
- NotificationFailed
- NotificationRetrying

**Integration Events:**
- OrderCreated
- OrderReady
- PaymentFailed
- LowStock
- OutOfStock
- NewReservation
- QRScanned
- NewStaff
- LeaveRequest
- InvoicePaid
- Maintenance
- SystemError

**System Events:**
- UserConnected
- UserDisconnected
- DeviceOnline
- DeviceOffline
- SyncCompleted
- SyncFailed

### 3.3 Event Schema

**Standard Event Structure:**
```json
{
  "eventId": "uuid",
  "eventType": "string",
  "eventVersion": "1.0",
  "timestamp": "ISO8601",
  "tenantId": "uuid",
  "userId": "uuid",
  "correlationId": "uuid",
  "causationId": "uuid",
  "payload": {},
  "metadata": {}
}
```

### 3.4 Event Routing

**Routing Rules:**
- Par tenantId (multi-tenant)
- Par userId (personalisation)
- Par eventType (handler)
- Par priority (urgence)

---

## 4. NOTIFICATION PIPELINE

### 4.1 Pipeline Overview

```
┌─────────────┐
│   Trigger   │ ← Business event / User action / System
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Ingress   │ ← Validation, normalization, enrichment
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Policy    │ ← Rules engine, preferences, anti-spam
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Routing   │ ← Channel selection, recipient resolution
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Fusion    │ ← Intelligent merging, deduplication
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Queue     │ ← Priority queue, batching, scheduling
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Delivery   │ ← Multi-channel delivery, retry, fallback
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Tracking   │ ← Analytics, audit, metrics
└─────────────┘
```

### 4.2 Pipeline Stages

**Stage 1: Ingress**
- Validation (schema, permissions)
- Normalization (format, encoding)
- Enrichment (user context, device info)
- Deduplication (detect duplicates)

**Stage 2: Policy**
- Role-based filtering
- Preference matching
- Quiet hours check
- Anti-spam rules
- Rate limiting
- Cooldown check

**Stage 3: Routing**
- Recipient resolution
- Channel selection
- Priority calculation
- Template selection
- Personalization

**Stage 4: Fusion**
- Duplicate detection
- Intelligent merging
- Counter aggregation
- Message evolution

**Stage 5: Queue**
- Priority queue (critical > high > medium > low)
- Batching (medium/low)
- Scheduling (digest, quiet hours)
- Throttling

**Stage 6: Delivery**
- Channel execution
- Retry logic
- Fallback chain
- Error handling
- Confirmation

**Stage 7: Tracking**
- Delivery confirmation
- Open tracking
- Click tracking
- Action tracking
- Analytics events

---

## 5. POLICY ENGINE

### 5.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Policy Engine                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Rules     │  │   Context   │  │   Decision  │        │
│  │  Repository │  │  Resolver   │  │   Engine    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Policy    │  │   Policy    │  │   Policy    │        │
│  │   Matcher   │  │   Evaluator │  │   Executor  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Policy Types

**Role-Based Policies:**
- Owner: toutes notifications
- Admin: toutes notifications
- Manager: sauf platform
- Cashier: critical + high + medium
- Waiter: critical + high (filtré)

**Preference Policies:**
- Enable/disable par canal
- Enable/disable par catégorie
- Enable/disable par priorité
- Quiet hours
- Digest schedule

**Anti-Spam Policies:**
- Cooldown
- Rate limiting
- Batching
- Deduplication

**Business Policies:**
- SLA
- Escalation
- Fallback
- Retention

### 5.3 Policy Evaluation

**Evaluation Order:**
1. Role-based (filter)
2. Preference (filter)
3. Anti-spam (filter)
4. Business (transform)
5. Delivery (route)

**Decision Tree:**
```
Event
  ↓
Role check → DENY?
  ↓ NO
Preference check → DENY?
  ↓ NO
Anti-spam check → QUEUE?
  ↓ NO
Business rules → TRANSFORM?
  ↓
Delivery rules → ROUTE
```

---

## 6. ROUTING ENGINE

### 6.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Routing Engine                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Recipient  │  │   Channel   │  │   Priority  │        │
│  │  Resolver   │  │  Selector   │  │  Calculator │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Template   │  │   Personal  │  │   Fallback  │        │
│  │  Selector   │  │  Resolver   │  │   Handler   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Recipient Resolution

**Resolution Chain:**
1. Direct recipient (userId)
2. Role-based (all managers)
3. Group-based (all staff)
4. Tenant-based (all users)
5. Fallback (admin)

**Multi-Recipient:**
- Fan-out: send to all
- Fan-in: aggregate responses
- Hybrid: send to primary, CC others

### 6.3 Channel Selection

**Channel Priority:**
1. Toast (in-app) - always
2. Badge (in-app) - always
3. Push (APNS/FCM) - if enabled
4. Email - if enabled
5. SMS - if enabled
6. Webhook - if enabled

**Channel Rules:**
- Critical: all channels
- High: toast + badge + push
- Medium: badge + email
- Low: center only

### 6.4 Fallback Strategy

**Fallback Chain:**
```
Primary Channel
  ↓ FAIL
Secondary Channel
  ↓ FAIL
Tertiary Channel
  ↓ FAIL
Queue for retry
  ↓ MAX RETRIES
Dead letter queue
```

---

## 7. DELIVERY ENGINE

### 7.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Delivery Engine                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Channel   │  │    Retry    │  │   Fallback  │        │
│  │  Executor   │  │   Manager   │  │   Handler   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Queue     │  │   Scheduler │  │   Monitor   │        │
│  │  Manager    │  │            │  │            │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Delivery Channels

**In-App Channels:**
- Toast: ephemeral overlay
- Badge: persistent indicator
- Center: persistent inbox
- Banner: page-level alert

**Push Channels:**
- APNS (iOS)
- FCM (Android)
- Web Push (PWA)

**Email Channels:**
- SMTP
- SendGrid
- AWS SES

**SMS Channels:**
- Twilio
- AWS SNS

**Webhook Channels:**
- HTTP POST
- Retry with backoff
- Signature verification

### 7.3 Retry Strategy

**Exponential Backoff:**
- Attempt 1: immediate
- Attempt 2: 1s
- Attempt 3: 2s
- Attempt 4: 4s
- Max: 3 attempts

**Retry Conditions:**
- Network error: retry
- Timeout: retry
- 5xx error: retry
- 4xx error: no retry
- 429 error: retry after Retry-After

### 7.4 Fallback Strategy

**Fallback Rules:**
- Push fails → Toast
- Email fails → Queue + retry
- SMS fails → Queue + retry
- Webhook fails → Dead letter

---

## 8. PRESENTATION LAYER

### 8.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Presentation Layer                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    State Management                     │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │ │
│  │  │   Local     │  │   Remote    │  │   Sync      │   │ │
│  │  │   Store     │  │   Store     │  │  Manager    │   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    UI Components                        │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │ │
│  │  │   Toast     │  │   Badge     │  │   Center    │   │ │
│  │  │ Component   │  │ Component   │  │ Component   │   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Controllers                          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │ │
│  │  │   Toast     │  │   Badge     │  │   Center    │   │ │
│  │  │ Controller  │  │ Controller  │  │ Controller  │   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 State Management

**Local State:**
- UI state (open/closed, selected)
- Transient state (animations)
- Form state

**Remote State:**
- Notifications list
- User preferences
- Delivery status

**Sync Strategy:**
- Optimistic updates
- Background sync
- Conflict resolution

### 8.3 Component Hierarchy

**Atomic Components:**
- NotificationBadge
- NotificationIcon
- NotificationAvatar
- NotificationChip

**Molecular Components:**
- NotificationToast
- NotificationCard
- NotificationBanner
- NotificationIndicator

**Organism Components:**
- NotificationCenter
- NotificationTimeline
- NotificationDrawer

**Template Components:**
- NotificationPage
- NotificationPanel

---

## 9. OFFLINE PIPELINE

### 9.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Offline Pipeline                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Local     │  │    Queue    │  │    Sync     │        │
│  │  Storage    │  │  Manager    │  │  Manager    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Conflict   │  │   Replay    │  │  Detection  │        │
│  │  Resolver   │  │  Engine     │  │   Engine    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Offline Strategies

**Read-Only Mode:**
- Display cached notifications
- No mutations allowed
- Queue actions for later

**Read-Write Mode:**
- Local mutations
- Queue for sync
- Conflict resolution

### 9.3 Sync Strategy

**Sync Triggers:**
- Network restored
- App foreground
- Periodic (30s)
- Manual refresh

**Sync Process:**
1. Fetch remote changes
2. Merge with local
3. Resolve conflicts
4. Push local changes
5. Update UI

### 9.4 Conflict Resolution

**Strategies:**
- Last write wins (default)
- Merge (if possible)
- Manual resolution (rare)

**Conflict Detection:**
- Same entity, different versions
- Timestamp comparison
- Content comparison

---

## 10. REALTIME PIPELINE

### 10.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Realtime Pipeline                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  WebSocket  │  │   Event     │  │   State     │        │
│  │  Connection │  │  Listener   │  │  Updater    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Presence  │  │   Heartbeat │  │   Reconnect │        │
│  │  Detector   │  │   Manager   │  │   Manager   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Realtime Channels

**Channel Structure:**
- `notifications:{tenantId}:{userId}` - User notifications
- `notifications:{tenantId}:broadcast` - Tenant broadcast
- `notifications:system` - System notifications

**Subscription Model:**
- Join on login
- Leave on logout
- Rejoin on reconnect

### 10.3 Realtime Events

**Event Types:**
- INSERT: New notification
- UPDATE: Notification updated
- DELETE: Notification deleted

**Payload:**
- Full notification object
- Delta (changed fields only)
- Metadata (timestamp, source)

### 10.4 Connection Management

**Heartbeat:**
- Interval: 30s
- Timeout: 10s
- Max missed: 3

**Reconnection:**
- Exponential backoff
- Max attempts: 10
- Reset on success

---

## 11. FAILURE HANDLING

### 11.1 Failure Types

**Transient Failures:**
- Network timeout
- Service unavailable
- Rate limit

**Permanent Failures:**
- Invalid recipient
- Invalid channel
- Quota exceeded

**System Failures:**
- Database down
- Message queue down
- Realtime service down

### 11.2 Retry Strategy

**Retry Policies:**
- Transient: 3 retries, exponential backoff
- Permanent: 0 retry
- System: infinite retry, alert

**Backoff Strategy:**
- Base: 1s
- Multiplier: 2
- Max: 60s
- Jitter: ±20%

### 11.3 Circuit Breaker

**States:**
- CLOSED: normal operation
- OPEN: failing, reject requests
- HALF_OPEN: testing recovery

**Thresholds:**
- Failure threshold: 50%
- Success threshold: 80%
- Timeout: 60s

### 11.4 Dead Letter Queue

**Purpose:** Capture failed notifications

**Processing:**
- Manual review
- Automatic retry (scheduled)
- Alert on threshold

**Retention:** 30 days

---

## 12. MULTI-TENANT ISOLATION

### 12.1 Isolation Strategy

**Database Level:**
- Shared database
- Shared schema
- tenant_id on every table

**Application Level:**
- Tenant context in every request
- Tenant-scoped queries
- Tenant-scoped caches

**Infrastructure Level:**
- Tenant-isolated queues
- Tenant-isolated caches
- Tenant-isolated realtime channels

### 12.2 Tenant Context

**Context Propagation:**
- HTTP header: X-Tenant-ID
- JWT claim: tenant_id
- Thread-local storage

**Validation:**
- On every request
- On every event
- On every query

### 12.3 Data Isolation

**Query Pattern:**
```sql
SELECT * FROM notifications
WHERE tenant_id = :tenantId
  AND user_id = :userId
```

**Cache Pattern:**
```
Key: notification:{tenantId}:{userId}:{notificationId}
```

**Queue Pattern:**
```
Queue: notifications-{tenantId}
```

---

## 13. SECURITY MODEL

### 13.1 Authentication

**Methods:**
- JWT (primary)
- Session (fallback)
- API Key (service-to-service)

**Token Structure:**
- userId
- tenantId
- roles[]
- permissions[]
- expiresAt

### 13.2 Authorization

**Model:** RBAC (Role-Based Access Control)

**Roles:**
- Owner: full access
- Admin: full access except platform
- Manager: limited access
- Cashier: minimal access
- Waiter: POS only

**Permissions:**
- notification:read
- notification:write
- notification:delete
- notification:admin

### 13.3 Data Security

**Encryption:**
- At rest: AES-256
- In transit: TLS 1.3
- Fields: PII encryption

**Access Control:**
- Row-level security
- Column-level security (PII)
- Audit logging

### 13.4 Audit Trail

**Audit Events:**
- Notification created
- Notification read
- Notification updated
- Notification deleted
- Preferences changed
- Access granted/denied

**Audit Storage:**
- Immutable log
- 7 years retention
- Searchable

---

## 14. SEQUENCE DIAGRAMS

### 14.1 Notification Creation

```
User → API Gateway → Application Service → Domain Service
  ↓
Domain Service → Event Bus → Policy Engine → Routing Engine
  ↓
Routing Engine → Queue → Delivery Engine → Channel
  ↓
Channel → User (Toast/Badge/Push)
```

### 14.2 Notification Read

```
User → UI → State Manager → API
  ↓
API → Application Service → Domain Service
  ↓
Domain Service → Event Bus → Analytics
  ↓
Analytics → Metrics Database
```

### 14.3 Offline Sync

```
App (offline) → Local Storage → Queue
  ↓
Network Restored → Sync Manager
  ↓
Sync Manager → API → Remote Storage
  ↓
Remote Storage → Conflict Resolver
  ↓
Conflict Resolver → Local Storage
  ↓
Local Storage → UI Update
```

### 14.4 Realtime Notification

```
Backend → Event Bus → Realtime Service
  ↓
Realtime Service → WebSocket → App
  ↓
App → State Manager → UI
  ↓
UI → Toast/Badge Animation
```

---

## 15. STATE DIAGRAMS

### 15.1 Notification State Machine

```
                    ┌─────────────┐
                    │   CREATED   │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  DISPLAYED  │ │   QUEUED    │ │   FAILED    │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           │               │               ▼
           │               │       ┌─────────────┐
           │               │       │  RETRYING   │
           │               │       └──────┬──────┘
           │               │               │
           │               │               ▼
           │               │       ┌─────────────┐
           │               │       │  DISPLAYED  │
           │               │       └─────────────┘
           │               │
           │               ▼
           │       ┌─────────────┐
           │       │  DISPLAYED  │
           │       └──────┬──────┘
           │               │
           ▼               ▼
    ┌─────────────┐ ┌─────────────┐
    │    READ     │ │  DISMISSED  │
    └──────┬──────┘ └─────────────┘
           │
           ▼
    ┌─────────────┐
    │  PROCESSED  │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  ARCHIVED   │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  DELETED    │
    └─────────────┘
```

### 15.2 Delivery State Machine

```
                    ┌─────────────┐
                    │   PENDING   │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  DELIVERED  │ │   FAILED    │ │   RETRYING  │
    └─────────────┘ └──────┬──────┘ └──────┬──────┘
                             │               │
                             │               ▼
                             │       ┌─────────────┐
                             │       │  DELIVERED  │
                             │       └─────────────┘
                             │
                             ▼
                       ┌─────────────┐
                       │  DEAD_LETTER │
                       └─────────────┘
```

---

## 16. ARCHITECTURE DECISION RECORDS

### ADR-001: Event-Driven Architecture

**Decision:** Use Event-Driven Architecture with Kafka

**Rationale:**
- Loose coupling between services
- Scalability
- Resilience
- Audit trail

**Consequences:**
- Increased complexity
- Eventual consistency
- Need for event schema management

### ADR-002: CQRS Pattern

**Decision:** Separate read and write models

**Rationale:**
- Optimized queries
- Scalability
- Flexibility

**Consequences:**
- Code duplication
- Eventual consistency
- Learning curve

### ADR-003: Event Sourcing

**Decision:** Store all state changes as events

**Rationale:**
- Complete audit trail
- Time travel
- Debugging

**Consequences:**
- Storage overhead
- Complexity
- Performance considerations

### ADR-004: Offline-First

**Decision:** Support offline operation with sync

**Rationale:**
- Mobile users
- Poor connectivity
- Better UX

**Consequences:**
- Conflict resolution
- Sync logic
- Storage management

### ADR-005: Multi-Tenant Isolation

**Decision:** Shared database with tenant_id

**Rationale:**
- Cost efficiency
- Simplicity
- Scalability

**Consequences:**
- Query complexity
- Indexing strategy
- Backup/restore

### ADR-006: Policy Engine

**Decision:** Centralized policy engine

**Rationale:**
- Consistency
- Maintainability
- Flexibility

**Consequences:**
- Performance overhead
- Complexity
- Testing challenges

### ADR-007: Multi-Channel Delivery

**Decision:** Support multiple delivery channels

**Rationale:**
- User preferences
- Redundancy
- Reach

**Consequences:**
- Integration complexity
- Cost
- Maintenance

---

## CONCLUSION

Cette architecture définit le système de notifications Ekala au niveau enterprise.

**Caractéristiques:**
- ✅ DDD compliant
- ✅ Event-Driven
- ✅ CQRS + Event Sourcing
- ✅ Offline-First
- ✅ Multi-tenant
- ✅ Secure by Design
- ✅ Scalable
- ✅ Resilient

**Portée:**
- Framework agnostic
- Platform agnostic
- Cloud agnostic

**Prochaine étape:**
Implémenter selon cette architecture.

---

**FIN DU DOCUMENT**

*Ce document est l'architecture de référence du système de notifications Ekala.*