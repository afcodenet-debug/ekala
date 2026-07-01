# NOTIFICATION API SPECIFICATION — EKALA

**Version:** 1.0.0  
**Date:** 29 Juin 2026  
**Statut:** OFFICIEL  
**Niveau:** Enterprise

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble](#1-vue-densemble)
2. [Commands](#2-commands)
3. [Queries](#3-queries)
4. [Domain Events](#4-domain-events)
5. [Integration Events](#5-integration-events)
6. [WebSocket Events](#6-websocket-events)
7. [Push Events](#7-push-events)
8. [Webhooks](#8-webhooks)
9. [Pagination](#9-pagination)
10. [Filtering](#10-filtering)
11. [Sorting](#11-sorting)
12. [Idempotency](#12-idempotency)
13. [Correlation IDs](#13-correlation-ids)
14. [Error Model](#14-error-model)
15. [Versioning](#15-versioning)
16. [Compatibility Rules](#16-compatibility-rules)
17. [API Evolution Strategy](#17-api-evolution-strategy)

---

## 1. VUE D'ENSEMBLE

### 1.1 Philosophie

**Principes:**
- RESTful pour CRUD operations
- Event-Driven pour notifications
- WebSocket pour realtime
- Idempotent par défaut
- Versionné sémantiquement
- Backward compatible

### 1.2 Architecture API

```
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   REST API  │  │  WebSocket  │  │   Webhook   │        │
│  │   (HTTP)    │  │   (WS)      │  │   (HTTP)    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Commands   │  │   Queries   │  │   Events    │        │
│  │  Handlers   │  │  Handlers   │  │  Handlers   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Standards

**Protocols:**
- REST: HTTP/1.1 ou HTTP/2
- WebSocket: RFC 6455
- Webhooks: HTTP POST

**Formats:**
- Request: JSON
- Response: JSON
- Errors: JSON (RFC 7807)

**Authentication:**
- JWT Bearer Token
- API Key (service-to-service)

**Encoding:**
- UTF-8
- Base64 (pour binaires)

---

## 2. COMMANDS

### 2.1 Définition

**Commands:** Operations qui modifient l'état (CQRS Command)

**Pattern:** POST /api/notifications/commands/{commandType}

### 2.2 Commandes disponibles

**CreateNotification:**
```
POST /api/notifications/commands/create
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}
  X-Correlation-ID: {correlationId}
  Idempotency-Key: {key}

Body:
{
  "title": "string",
  "message": "string",
  "category": "string",
  "priority": "string",
  "severity": "string",
  "recipients": ["userId1", "userId2"],
  "actions": [...],
  "payload": {}
}

Response: 202 Accepted
{
  "notificationId": "uuid",
  "status": "queued",
  "createdAt": "ISO8601"
}
```

**MarkAsRead:**
```
POST /api/notifications/commands/mark-as-read
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}
  Idempotency-Key: {key}

Body:
{
  "notificationId": "uuid"
}

Response: 202 Accepted
{
  "notificationId": "uuid",
  "status": "read",
  "readAt": "ISO8601"
}
```

**MarkAllAsRead:**
```
POST /api/notifications/commands/mark-all-as-read
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}
  Idempotency-Key: {key}

Body:
{
  "category": "string" (optionnel)
}

Response: 202 Accepted
{
  "count": 10,
  "status": "read"
}
```

**Dismiss:**
```
POST /api/notifications/commands/dismiss
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}
  Idempotency-Key: {key}

Body:
{
  "notificationId": "uuid"
}

Response: 202 Accepted
{
  "notificationId": "uuid",
  "status": "dismissed"
}
```

**Archive:**
```
POST /api/notifications/commands/archive
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}
  Idempotency-Key: {key}

Body:
{
  "notificationId": "uuid"
}

Response: 202 Accepted
{
  "notificationId": "uuid",
  "status": "archived",
  "archivedAt": "ISO8601"
}
```

**ExecuteAction:**
```
POST /api/notifications/commands/execute-action
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}
  Idempotency-Key: {key}

Body:
{
  "notificationId": "uuid",
  "actionId": "uuid",
  "payload": {}
}

Response: 202 Accepted
{
  "notificationId": "uuid",
  "actionId": "uuid",
  "status": "processed"
}
```

**UpdatePreferences:**
```
POST /api/notifications/commands/update-preferences
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}
  Idempotency-Key: {key}

Body:
{
  "channels": {...},
  "categories": {...},
  "priorities": {...},
  "quietHours": {...},
  "digest": {...}
}

Response: 202 Accepted
{
  "preferenceId": "uuid",
  "updatedAt": "ISO8601"
}
```

### 2.3 Patterns

**Idempotency:**
- Header: Idempotency-Key: UUID
- Stocké pendant 24h
- Même requête → même réponse

**Correlation:**
- Header: X-Correlation-ID: UUID
- Traçabilité bout en bout

**Tenant Isolation:**
- Header: X-Tenant-ID: UUID
- Obligatoire pour toutes les requêtes

---

## 3. QUERIES

### 3.1 Définition

**Queries:** Operations qui lisent l'état (CQRS Query)

**Pattern:** GET /api/notifications/queries/{queryType}

### 3.2 Queries disponibles

**GetNotifications:**
```
GET /api/notifications/queries/list
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}

Query Parameters:
  category: string (optionnel)
  priority: string (optionnel)
  status: string (optionnel)
  read: boolean (optionnel)
  startDate: ISO8601 (optionnel)
  endDate: ISO8601 (optionnel)
  page: integer (défaut: 1)
  limit: integer (défaut: 20, max: 100)
  sortBy: string (défaut: createdAt)
  sortOrder: string (défaut: desc)

Response: 200 OK
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**GetNotification:**
```
GET /api/notifications/queries/{notificationId}
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}

Response: 200 OK
{
  "notificationId": "uuid",
  "title": "string",
  "message": "string",
  ...
}
```

**GetUnreadCount:**
```
GET /api/notifications/queries/unread-count
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}

Query Parameters:
  category: string (optionnel)

Response: 200 OK
{
  "count": 10
}
```

**GetPreferences:**
```
GET /api/notifications/queries/preferences
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}

Response: 200 OK
{
  "preferenceId": "uuid",
  "channels": {...},
  "categories": {...},
  ...
}
```

**GetDeliveryStatus:**
```
GET /api/notifications/queries/{notificationId}/delivery
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}

Response: 200 OK
{
  "deliveries": [
    {
      "channelId": "uuid",
      "status": "delivered",
      "deliveredAt": "ISO8601"
    }
  ]
}
```

### 3.3 Patterns

**Caching:**
- Cache-Control: max-age=60
- ETag pour conditional requests
- 304 Not Modified

**Filtering:**
- Par catégorie
- Par priorité
- Par statut
- Par date
- Par lecture

**Sorting:**
- Par date (défaut)
- Par priorité
- Par catégorie

---

## 4. DOMAIN EVENTS

### 4.1 Définition

**Domain Events:** Événements métier internes

**Pattern:** Pub/Sub via Event Bus

### 4.2 Events disponibles

**NotificationCreated:**
```json
{
  "eventId": "uuid",
  "eventType": "NotificationCreated",
  "eventVersion": "1.0",
  "timestamp": "ISO8601",
  "tenantId": "uuid",
  "userId": "uuid",
  "correlationId": "uuid",
  "causationId": "uuid",
  "payload": {
    "notificationId": "uuid",
    "title": "string",
    "message": "string",
    "category": "string",
    "priority": "string",
    "severity": "string"
  },
  "metadata": {
    "source": "string",
    "sourceId": "string",
    "eventType": "string"
  }
}
```

**NotificationQueued:**
```json
{
  "eventType": "NotificationQueued",
  "payload": {
    "notificationId": "uuid",
    "queueId": "uuid",
    "position": 1
  }
}
```

**NotificationDisplayed:**
```json
{
  "eventType": "NotificationDisplayed",
  "payload": {
    "notificationId": "uuid",
    "channel": "toast",
    "displayedAt": "ISO8601"
  }
}
```

**NotificationRead:**
```json
{
  "eventType": "NotificationRead",
  "payload": {
    "notificationId": "uuid",
    "readAt": "ISO8601"
  }
}
```

**NotificationProcessed:**
```json
{
  "eventType": "NotificationProcessed",
  "payload": {
    "notificationId": "uuid",
    "actionId": "uuid",
    "processedAt": "ISO8601"
  }
}
```

**NotificationArchived:**
```json
{
  "eventType": "NotificationArchived",
  "payload": {
    "notificationId": "uuid",
    "archivedAt": "ISO8601"
  }
}
```

**NotificationDeleted:**
```json
{
  "eventType": "NotificationDeleted",
  "payload": {
    "notificationId": "uuid",
    "deletedAt": "ISO8601"
  }
}
```

**NotificationExpired:**
```json
{
  "eventType": "NotificationExpired",
  "payload": {
    "notificationId": "uuid",
    "expiredAt": "ISO8601"
  }
}
```

**NotificationFailed:**
```json
{
  "eventType": "NotificationFailed",
  "payload": {
    "notificationId": "uuid",
    "errorCode": "string",
    "errorMessage": "string",
    "failedAt": "ISO8601"
  }
}
```

**NotificationRetrying:**
```json
{
  "eventType": "NotificationRetrying",
  "payload": {
    "notificationId": "uuid",
    "attempt": 2,
    "nextRetryAt": "ISO8601"
  }
}
```

### 4.3 Patterns

**Event Schema:**
- Versionné (eventVersion)
- Corrélé (correlationId, causationId)
- Traçable (timestamp, source)

**Event Routing:**
- Par tenantId
- Par eventType
- Par userId

---

## 5. INTEGRATION EVENTS

### 5.1 Définition

**Integration Events:** Événements métier externes

**Pattern:** REST Webhook ou Event Bus

### 5.2 Events disponibles

**OrderCreated:**
```json
{
  "eventType": "OrderCreated",
  "payload": {
    "orderId": "uuid",
    "tenantId": "uuid",
    "customerId": "uuid",
    "total": 100.00,
    "items": [...]
  }
}
```

**OrderReady:**
```json
{
  "eventType": "OrderReady",
  "payload": {
    "orderId": "uuid",
    "tenantId": "uuid",
    "tableId": "uuid"
  }
}
```

**PaymentFailed:**
```json
{
  "eventType": "PaymentFailed",
  "payload": {
    "paymentId": "uuid",
    "orderId": "uuid",
    "tenantId": "uuid",
    "errorCode": "string",
    "errorMessage": "string"
  }
}
```

**LowStock:**
```json
{
  "eventType": "LowStock",
  "payload": {
    "productId": "uuid",
    "tenantId": "uuid",
    "currentStock": 5,
    "minStock": 10
  }
}
```

**OutOfStock:**
```json
{
  "eventType": "OutOfStock",
  "payload": {
    "productId": "uuid",
    "tenantId": "uuid"
  }
}
```

### 5.3 Patterns

**Webhook:**
```
POST /api/notifications/integration/events
Headers:
  Content-Type: application/json
  X-Signature: {signature}

Body: Integration Event

Response: 202 Accepted
```

**Validation:**
- Schema validation
- Signature verification
- Rate limiting

---

## 6. WEBSOCKET EVENTS

### 6.1 Définition

**WebSocket Events:** Events temps réel

**Protocol:** WSS (WebSocket Secure)

### 6.2 Connection

```
WSS://api.ekala.com/ws/notifications
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}

Handshake:
Client → Server: { "type": "subscribe", "channel": "notifications" }
Server → Client: { "type": "subscribed", "channel": "notifications" }
```

### 6.3 Events disponibles

**notification:new:**
```json
{
  "type": "notification:new",
  "data": {
    "notificationId": "uuid",
    "title": "string",
    "message": "string",
    "priority": "string",
    "category": "string"
  }
}
```

**notification:updated:**
```json
{
  "type": "notification:updated",
  "data": {
    "notificationId": "uuid",
    "status": "read",
    "readAt": "ISO8601"
  }
}
```

**notification:deleted:**
```json
{
  "type": "notification:deleted",
  "data": {
    "notificationId": "uuid"
  }
}
```

**notification:merged:**
```json
{
  "type": "notification:merged",
  "data": {
    "primaryNotificationId": "uuid",
    "mergedNotificationIds": ["uuid1", "uuid2"],
    "count": 3
  }
}
```

### 6.4 Patterns

**Channels:**
- `notifications:{tenantId}:{userId}` - User notifications
- `notifications:{tenantId}:broadcast` - Tenant broadcast
- `notifications:system` - System notifications

**Heartbeat:**
- Interval: 30s
- Timeout: 10s
- Max missed: 3

**Reconnection:**
- Exponential backoff
- Max attempts: 10
- Auto-resubscribe

---

## 7. PUSH EVENTS

### 7.1 Définition

**Push Events:** Notifications push (APNS, FCM, Web Push)

### 7.2 Payload

**APNS (iOS):**
```json
{
  "aps": {
    "alert": {
      "title": "string",
      "body": "string"
    },
    "badge": 1,
    "sound": "default"
  },
  "data": {
    "notificationId": "uuid",
    "priority": "string",
    "category": "string"
  }
}
```

**FCM (Android):**
```json
{
  "notification": {
    "title": "string",
    "body": "string",
    "sound": "default"
  },
  "data": {
    "notificationId": "uuid",
    "priority": "string",
    "category": "string"
  }
}
```

**Web Push:**
```json
{
  "title": "string",
  "body": "string",
  "icon": "url",
  "badge": "url",
  "data": {
    "notificationId": "uuid",
    "priority": "string",
    "category": "string"
  }
}
```

### 7.3 Patterns

**Priority:**
- High: immediate delivery
- Medium: normal delivery
- Low: deferred delivery

**TTL:**
- Critical: 0s (immediate)
- High: 3600s
- Medium: 86400s
- Low: 604800s

---

## 8. WEBHOOKS

### 8.1 Définition

**Webhooks:** Callbacks HTTP pour événements

### 8.2 Configuration

**Register Webhook:**
```
POST /api/notifications/webhooks
Headers:
  Authorization: Bearer {token}
  X-Tenant-ID: {tenantId}

Body:
{
  "url": "https://example.com/webhook",
  "events": ["NotificationCreated", "NotificationRead"],
  "secret": "string",
  "active": true
}

Response: 201 Created
{
  "webhookId": "uuid",
  "url": "https://example.com/webhook",
  "events": [...],
  "createdAt": "ISO8601"
}
```

### 8.3 Payload

**Webhook Event:**
```json
{
  "eventId": "uuid",
  "eventType": "NotificationCreated",
  "timestamp": "ISO8601",
  "tenantId": "uuid",
  "data": {
    "notificationId": "uuid",
    "title": "string",
    "message": "string"
  },
  "signature": "HMAC-SHA256"
}
```

### 8.4 Patterns

**Retry:**
- 3 tentatives
- Backoff: 1s, 2s, 4s
- Timeout: 5s

**Security:**
- Signature: HMAC-SHA256
- HTTPS obligatoire
- IP whitelist (optionnel)

---

## 9. PAGINATION

### 9.1 Strategy

**Cursor-based (recommandé):**
```
GET /api/notifications/queries/list?cursor={cursor}&limit=20

Response:
{
  "data": [...],
  "pagination": {
    "cursor": "nextCursor",
    "hasMore": true
  }
}
```

**Offset-based (legacy):**
```
GET /api/notifications/queries/list?page=1&limit=20

Response:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 9.2 Limits

**Par défaut:**
- limit: 20
- max: 100

**Par type:**
- Notifications: 100 max
- Audit logs: 1000 max
- Analytics: unlimited

---

## 10. FILTERING

### 10.1 Filters disponibles

**Category:**
```
?category=Order&category=Inventory
```

**Priority:**
```
?priority=Critical&priority=High
```

**Status:**
```
?status=unread&status=read
```

**Date Range:**
```
?startDate=2026-01-01&endDate=2026-06-29
```

**Read Status:**
```
?read=true
?read=false
```

**Combined:**
```
?category=Order&priority=High&read=false&startDate=2026-01-01
```

### 10.2 Performance

**Indexes:**
- tenant_id, created_at
- tenant_id, category
- tenant_id, priority
- tenant_id, read

**Query Optimization:**
- Utiliser indexes
- Éviter full table scan
- Limiter résultats

---

## 11. SORTING

### 11.1 Fields

**Available:**
- createdAt (défaut)
- updatedAt
- priority
- category
- readAt

### 11.2 Order

**Syntax:**
```
?sortBy=createdAt&sortOrder=desc
?sortBy=priority&sortOrder=asc
```

**Defaults:**
- sortBy: createdAt
- sortOrder: desc

### 11.3 Multi-sort

```
?sortBy=priority,createdAt&sortOrder=desc,desc
```

---

## 12. IDEMPOTENCY

### 12.1 Strategy

**Header:** Idempotency-Key: UUID

**Storage:**
- Redis
- TTL: 24h
- Key: idempotency:{key}

### 12.2 Rules

**First Request:**
- Traité normalement
- Stocké dans Redis
- Response retournée

**Duplicate Request:**
- Même Idempotency-Key
- Même body
- Response précédente retournée

**Different Request:**
- Idempotency-Key différent
- Traité normalement

### 12.3 Implementation

```
Request 1:
POST /api/notifications/commands/create
Idempotency-Key: abc-123
Body: {title: "Test"}
Response: 202 Accepted {notificationId: "uuid"}

Request 2 (duplicate):
POST /api/notifications/commands/create
Idempotency-Key: abc-123
Body: {title: "Test"}
Response: 202 Accepted {notificationId: "uuid"} (cached)

Request 3 (different):
POST /api/notifications/commands/create
Idempotency-Key: def-456
Body: {title: "Test 2"}
Response: 202 Accepted {notificationId: "uuid2"}
```

---

## 13. CORRELATION IDs

### 13.1 Strategy

**Header:** X-Correlation-ID: UUID

**Generation:**
- Client: génère UUID
- Server: utilise ou génère UUID

### 13.2 Propagation

**Chain:**
```
Request 1: X-Correlation-ID: uuid-1
  → Event: correlationId: uuid-1
    → Request 2: X-Correlation-ID: uuid-1
      → Event: correlationId: uuid-1
```

### 13.3 Usage

**Logging:**
- Tous les logs contiennent correlationId
- Traçabilité bout en bout

**Debugging:**
- Rechercher par correlationId
- Voir tous les événements liés

---

## 14. ERROR MODEL

### 14.1 Structure

**RFC 7807 compliant:**
```json
{
  "type": "https://api.ekala.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "One or more validation errors occurred.",
  "instance": "/api/notifications/commands/create",
  "correlationId": "uuid",
  "timestamp": "ISO8601",
  "errors": [
    {
      "field": "title",
      "message": "Title is required",
      "code": "REQUIRED"
    }
  ]
}
```

### 14.2 Error Codes

**4xx Client Errors:**
- 400: VALIDATION_ERROR
- 401: UNAUTHORIZED
- 403: FORBIDDEN
- 404: NOT_FOUND
- 409: CONFLICT
- 429: RATE_LIMIT_EXCEEDED

**5xx Server Errors:**
- 500: INTERNAL_ERROR
- 502: BAD_GATEWAY
- 503: SERVICE_UNAVAILABLE
- 504: GATEWAY_TIMEOUT

### 14.3 Patterns

**Validation:**
```json
{
  "type": "validation-error",
  "status": 400,
  "errors": [...]
}
```

**Rate Limit:**
```json
{
  "type": "rate-limit-exceeded",
  "status": 429,
  "detail": "Rate limit exceeded. Retry after 60 seconds.",
  "retryAfter": 60
}
```

**Not Found:**
```json
{
  "type": "not-found",
  "status": 404,
  "detail": "Notification not found"
}
```

---

## 15. VERSIONING

### 15.1 Strategy

**URL Versioning:**
```
/api/v1/notifications
/api/v2/notifications
```

**Header Versioning:**
```
Accept: application/vnd.ekala.v1+json
Accept: application/vnd.ekala.v2+json
```

### 15.2 Version Lifecycle

**Stable:**
- v1, v2, v3
- Supportées pendant 12 mois
- Deprecation annoncée 6 mois avant

**Beta:**
- v1-beta, v2-beta
- Non stable
- Peut changer sans préavis

### 15.3 Deprecation

**Process:**
1. Annonce deprecation
2. Header: Sunset: date
3. Header: Deprecation: true
4. 6 mois de transition
5. Suppression

**Example:**
```
Sunset: Sat, 29 Dec 2027 23:59:59 GMT
Deprecation: true
Link: <https://api.ekala.com/v2/notifications>; rel="successor-version"
```

---

## 16. COMPATIBILITY RULES

### 16.1 Backward Compatibility

**Règles:**
- Ne jamais supprimer champ
- Ne jamais changer type d'un champ
- Ne jamais rendre requis un champ optionnel
- Ajouter nouveaux champs en option

**Example:**
```json
// v1
{
  "title": "string",
  "message": "string"
}

// v2 (backward compatible)
{
  "title": "string",
  "message": "string",
  "priority": "string" (nouveau, optionnel)
}
```

### 16.2 Forward Compatibility

**Règles:**
- Ignorer champs inconnus
- Ne pas échouer sur champs supplémentaires

### 16.3 Breaking Changes

**Définitions:**
- Supprimer champ
- Changer type
- Rendre requis champ optionnel
- Changer format

**Process:**
1. Nouvelle version (v2)
2. Support v1 pendant 6 mois
3. Migration guide
4. Suppression v1

---

## 17. API EVOLUTION STRATEGY

### 17.1 Principles

**Stable:**
- API stable pendant 12 mois
- Pas de breaking changes
- Deprecation progressive

**Flexible:**
- Nouvelles features en option
- Backward compatible
- Forward compatible

**Transparent:**
- Changelog public
- Migration guide
- Sunset headers

### 17.2 Process

**New Feature:**
1. Design
2. Review
3. Beta (v1-beta)
4. Stable (v1)
5. Documentation

**Breaking Change:**
1. Nouvelle version (v2)
2. Parallel run (v1 + v2)
3. Migration
4. Deprecation v1
5. Suppression v1

### 17.3 Governance

**API Review Board:**
- Review tous les changements
- Valide compatibilité
- Approuve versions

**Changelog:**
- Public
- Détailé
- Daté

**Communication:**
- Email aux développeurs
- Blog post
- Documentation

---

## CONCLUSION

Cette spécification définit les contrats API du système de notifications.

**Caractéristiques:**
- ✅ RESTful + Event-Driven
- ✅ Versionné
- ✅ Idempotent
- ✅ Corrélé
- ✅ Sécurisé
- ✅ Documenté

**Prochaine étape:**
Implémenter selon cette spécification.

---

**FIN DU DOCUMENT**

*Ce document fait partie du Notification Design System officiel d'Ekala.*