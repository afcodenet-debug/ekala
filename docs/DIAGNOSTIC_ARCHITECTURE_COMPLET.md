# DIAGNOSTIC ARCHITECTURAL COMPLET - SYSTÈME DE NOTIFICATIONS
**Date:** 02/07/2026  
**Version:** 1.0  
**Statut:** Analyse Pré-Implémentation  
**Auteur:** Software Architect Senior

---

## SOMMAIRE EXÉCUTIF

Ce document présente un diagnostic complet de l'architecture du système de notifications EKALA POS, identifie les problèmes critiques, propose des améliorations et définit un plan d'implémentation détaillé.

**Verdict:** Architecture cible excellente, implémentation incomplète à 40%.

---

## 1. DIAGNOSTIC DE L'EXISTANT

### 1.1 Stack Technique Actuelle

| Couche | Technologie | Version | Status |
|--------|-------------|---------|--------|
| **Frontend** | React + TypeScript | 18.x | ✅ Stable |
| **State Management** | Zustand | 4.x | ✅ Stable |
| **Backend** | Express.js | 4.x | ✅ Stable |
| **Base de données** | SQLite (local) / Supabase (cloud) | - | ⚠️ Dual |
| **Real-time** | Aucun | - | ❌ Manquant |
| **Event Bus** | InMemory (interne) | Custom | ⚠️ Isolé |

### 1.2 Architecture Actuelle

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ useNotifications │  │ useNotification  │  │ Notification  │ │
│  │    (Hook)        │  │    Store         │  │   Center      │ │
│  │  Polling 30s+15s │  │   (Zustand)      │  │  (Component)  │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────────────┘ │
│           │                     │                              │
│           └─────────────────────┘                              │
│                    HTTP Polling                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                         BACKEND                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │   API Routes     │  │  Notification    │  │  Notification │ │
│  │  (REST CQRS)     │─▶│    Service       │─▶│  Repository   │ │
│  │ /commands/*      │  │  (Orchestrator)  │  │   (SQLite)    │ │
│  │ /queries/*       │  └────────┬─────────┘  └───────────────┘ │
│  └──────────────────┘           │                              │
│                                 ▼                              │
│                    ┌──────────────────┐                        │
│                    │  Event Bus       │                        │
│                    │  (InMemory)      │                        │
│                    └────────┬─────────┘                        │
│                             │                                   │
│                    ┌────────▼─────────┐                        │
│                    │  Policy Engine   │                        │
│                    │  (Rules)         │                        │
│                    └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   SQLite    │
                    │  (Local)    │
                    └─────────────┘
```

### 1.3 Points Forts Identifiés

1. ✅ **Architecture DDD documentée** - Documentation complète et détaillée
2. ✅ **Multi-tenant** - Isolation par `tenant_id` sur toutes les tables
3. ✅ **Policy Engine** - Système de règles configurable avec rate limiting
4. ✅ **UI Premium** - Composants avec design system soigné (NotificationCenter)
5. ✅ **CQRS** - Séparation claire commands/queries dans les routes
6. ✅ **TypeScript** - Typage fort sur les interfaces
7. ✅ **Zustand** - State management léger et performant

---

## 2. PROBLÈMES IDENTIFIÉS

### 2.1 Problèmes Critiques (🔴)

| ID | Problème | Sévérité | Impact | Fichier(s) |
|----|----------|----------|--------|------------|
| **P1** | **Double polling inefficace** - 2 intervalles simultanés (30s + 15s) = 4 requêtes/min | 🔴 CRITIQUE | Consommation réseau excessive, latence 15-30s | `useNotifications.ts:66-95` |
| **P2** | **Pas de WebSocket/Realtime** - Aucune connexion temps réel | 🔴 CRITIQUE | Notifications non instantanées | Toute l'architecture |
| **P3** | **Event Bus isolé** - L'EventBus interne n'est pas connecté au système d'événements métier global | 🔴 CRITIQUE | Les événements métier ne déclenchent pas les notifications | `notification.service.ts:36-138` |
| **P4** | **Repository SQLite uniquement** - Pas de repository Supabase pour le cloud | 🔴 CRITIQUE | Fonctionne uniquement en local | `NotificationRepository.ts` |
| **P5** | **Incohérence de champs** - `createdAt` vs `created_at`, `readAt` vs `read_at` | 🔴 CRITIQUE | Bug d'affichage des dates et marquage lu | `NotificationCenter.tsx:247-250` |

### 2.2 Problèmes Majeurs (🟠)

| ID | Problème | Sévérité | Impact | Fichier(s) |
|----|----------|----------|--------|------------|
| **P6** | **Routes API non montées** - `/queries/*` et `/commands/*` définies mais pas dans le routeur principal | 🟠 ÉLEVÉ | Endpoints inaccessibles | `notifications.routes.ts` |
| **P7** | **Pas de circuit breaker** - Aucune protection contre les pannes SMTP/API | 🟠 ÉLEVÉ | Risque de perte de notifications | Services email/SMS |
| **P8** | **Pas de retry policy** - Pas de stratégie de réessai | 🟠 ÉLEVÉ | Notifications perdues en cas d'erreur | Channels services |
| **P9** | **Pas de dead letter queue** - Pas de file d'attente pour les échecs | 🟠 ÉLEVÉ | Perte silencieuse | Architecture globale |
| **P10** | **Textes hardcodés** - Pas de traductions i18n | 🟠 ÉLEVÉ | UX limitée, non multilingue | `NotificationCenter.tsx` |

### 2.3 Problèmes Mineurs (🟡)

| ID | Problème | Sévérité | Impact | Fichier(s) |
|----|----------|----------|--------|------------|
| **P11** | **Pas de préférences utilisateur** - Table `notification_preferences` non utilisée | 🟡 MOYEN | Personnalisation impossible | BDD |
| **P12** | **Pas de digest** - Pas d'agrégation quotidienne/hebdo | 🟡 MOYEN | Spam possible | Architecture |
| **P13** | **Audit limité** - Table `notification_audit` non remplie | 🟡 MOYEN | Traçabilité insuffisante | BDD |
| **P14** | **Fusion non implémentée** - `merge_key` dans policies mais pas de logique | 🟡 MOYEN | Notifications dupliquées | `notification.service.ts` |
| **P15** | **Pas de pagination** - Chargement de toutes les notifications d'un coup | 🟡 MOYEN | Performance dégradée | `useNotificationStore.ts` |

---

## 3. AMÉLIORATIONS PROPOSÉES

### 3.1 Architecture Cible - Realtime First

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE CIBLE V2.0                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Événement      │────▶│  Global Event    │────▶│  Notification    │
│  Métier         │     │  Bus             │     │  Service         │
│  (order.created)│     │  (Platform-wide) │     │  (Orchestrator)  │
└─────────────────┘     └────────┬─────────┘     └────────┬─────────┘
                                    │                      │
                                    ▼                      ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Supabase       │     │  Policy Engine   │     │  Repository      │
│  Realtime       │     │  + Preferences   │     │  (Dual: SQLite + │
│  (WebSocket)    │     │  + Fusion        │     │   Supabase)      │
└─────────────────┘     └────────┬─────────┘     └────────┬─────────┘
                                    │                      │
                                    ▼                      ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  WebSocket      │     │  Delivery        │     │  Cache Layer     │
│  (Fallback)     │     │  Engine          │     │  (Redis/MMap)    │
│  WS Server      │     │  + Circuit Brkr  │     │                  │
└─────────────────┘     └────────┬─────────┘     └────────┬─────────┘
                                    │                      │
                                    ▼                      │
┌─────────────────┐     ┌──────────────────┐              │
│  Frontend       │◀────│  Queue Manager   │◀─────────────┘
│  (Realtime +    │     │  + DLQ           │
│   Fallback)     │     │                  │
└─────────────────┘     └──────────────────┘
```

### 3.2 Nouveaux Patterns

#### 3.2.1 Event-Driven Architecture (Global)

```typescript
// Connexion au système d'événements métier
platformEventBus.subscribe('order.created', async (event) => {
  await notificationService.createFromEvent(event);
});

// Event Bus local pour les notifications
notificationEventBus.subscribe('notification.created', async (event) => {
  await deliveryEngine.deliver(event.payload);
});
```

#### 3.2.2 Repository Pattern Dual

```typescript
interface INotificationRepository {
  create(data: CreateNotificationDto): Promise<Notification>;
  findMany(filters: NotificationFilters): Promise<PaginatedResult<Notification>>;
  markAsRead(id: string, tenantId: string, userId: string): Promise<void>;
  // ...
}

// Implémentations
class SqliteNotificationRepository implements INotificationRepository { }
class SupabaseNotificationRepository implements INotificationRepository { }
```

#### 3.2.3 Circuit Breaker Pattern

```typescript
class NotificationCircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime?: Date;
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime!.getTime() > 60000) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    // ...
  }
}
```

#### 3.2.4 Realtime avec Fallback

```typescript
class RealtimeManager {
  private ws: WebSocket | null = null;
  private fallbackInterval: NodeJS.Timeout | null = null;
  
  async connect() {
    try {
      this.ws = await this.createWebSocket();
      this.setupRealtimeHandlers();
    } catch (error) {
      this.enableFallbackPolling();
    }
  }
}
```

---

## 4. NOUVEAU WORKFLOW COMPLET

### 4.1 Flux de Création de Notification

```
1. Événement Métier (order.created)
   ↓
2. Global Event Bus (platform-wide)
   ↓
3. Notification Service (reçoit l'événement)
   ↓
4. Policy Engine (évalue règles + préférences utilisateur)
   ↓
5. Recipient Resolver (détermine destinataires)
   ↓
6. Fusion Engine (déduplication via merge_key)
   ↓
7. Repository (persistance SQLite + Supabase)
   ↓
8. Queue Manager (priorité + batch)
   ↓
9. Delivery Engine (canaux: toast, badge, email, push, SMS)
   ↓
10. Realtime Push (WebSocket/Supabase)
   ↓
11. Frontend (mise à jour instantanée)
```

### 4.2 Flux de Consommation Frontend

```
1. Connexion WebSocket (ou fallback polling 60s)
   ↓
2. Souscription canal tenant:{tenantId}:user:{userId}
   ↓
3. Réception notification (JSON)
   ↓
4. Mise à jour store Zustand (optimistic update)
   ↓
5. Badge animé + compteur incrémenté
   ↓
6. Toast (si priorité critical/high)
   ↓
7. Center mis à jour (si ouvert)
```

### 4.3 Fallback Strategy

```
WebSocket connecté
   ↓ (100% temps réel)
0 requêtes/min

WebSocket déconnecté
   ↓
Fallback polling 60s
   ↓ (1 requête/min)
75% réduction vs actuel

Offline mode
   ↓
Queue locale (IndexedDB)
   ↓
Sync au rechargement
```

---

## 5. IMPACTS FRONTEND

### 5.1 Modifications Nécessaires

| Composant | Action | Priorité | Lignes Affectées |
|-----------|--------|----------|------------------|
| `useNotifications.ts` | Remplacer double polling par WebSocket + fallback | 🔴 CRITIQUE | 66-95 |
| `useNotificationStore.ts` | Ajouter alias `createdAt`/`created_at`, `readAt`/`read_at` | 🔴 CRITIQUE | 33-34 |
| `NotificationCenter.tsx` | Corriger usage de `createdAt` → `created_at` | 🔴 CRITIQUE | 247-250 |
| `NotificationBell.tsx` | Ajouter animation sonore optionnelle | 🟡 MOYEN | - |
| `i18n/locales/fr.json` | Ajouter clés de traduction notifications | 🟠 ÉLEVÉ | - |
| `i18n/locales/en.json` | Ajouter clés de traduction notifications | 🟠 ÉLEVÉ | - |

### 5.2 Nouveaux Hooks

```typescript
// src/hooks/useRealtimeNotifications.ts
export function useRealtimeNotifications() {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const { addNotification, updateNotification } = useNotificationStore();
  
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/notifications/${tenantId}/${userId}`);
    
    ws.onopen = () => setConnectionStatus('connected');
    ws.onclose = () => setConnectionStatus('disconnected');
    ws.onerror = () => setConnectionStatus('disconnected');
    
    ws.onmessage = (event) => {
      const { type, payload } = JSON.parse(event.data);
      
      switch (type) {
        case 'notification.created':
          addNotification(payload.notification);
          break;
        case 'notification.updated':
          updateNotification(payload.notification);
          break;
        case 'notification.deleted':
          removeNotification(payload.notificationId);
          break;
      }
    };
    
    return () => ws.close();
  }, [tenantId, userId]);
}
```

### 5.3 Optimisations UX

- **Animation sonore** pour notifications critiques (configurable)
- **Vibration** sur mobile pour notifications urgentes
- **Focus detection** - Ne pas afficher toast si l'onglet est actif
- **Grouping** - Regrouper les notifications similaires (même `merge_key`)
- **Swipe actions** - Swipe pour marquer lu/supprimer

---

## 6. IMPACTS BACKEND

### 6.1 Modifications Nécessaires

| Service | Action | Priorité | Fichier |
|---------|--------|----------|---------|
| `NotificationService.ts` | Connecter Event Bus global | 🔴 CRITIQUE | 36-138 |
| `NotificationRepository.ts` | Créer version Supabase | 🔴 CRITIQUE | - |
| `NotificationEventBus.ts` | Intégrer avec platform event bus | 🔴 CRITIQUE | - |
| `notifications.routes.ts` | Monter routes dans `server.ts` | 🔴 CRITIQUE | - |
| `realtime-notification.service.ts` | Implémenter WebSocket server | 🔴 CRITIQUE | - |

### 6.2 Nouveaux Services

```typescript
// src/server/notifications/delivery-engine.ts
export class DeliveryEngine {
  async deliver(notification: Notification): Promise<DeliveryResult> {
    const channels = notification.channels;
    const results: DeliveryResult[] = [];
    
    // Delivery parallèle avec Promise.allSettled
    const deliveries = [
      channels.includes('toast') && this.pushToWebSocket(notification),
      channels.includes('email') && this.sendEmail(notification),
      channels.includes('push') && this.sendPush(notification),
      channels.includes('sms') && this.sendSMS(notification),
    ].filter(Boolean);
    
    const settled = await Promise.allSettled(deliveries);
    // ...
  }
}

// src/server/notifications/fusion-engine.ts
export class FusionEngine {
  async merge(notification: Notification): Promise<Notification | null> {
    if (!notification.merge_key) return notification;
    
    const existing = await this.repository.findByMergeKey(
      notification.tenant_id,
      notification.merge_key
    );
    
    if (existing) {
      // Incrémenter compteur au lieu de créer nouvelle
      await this.repository.incrementCounter(existing.id);
      return null; // Pas de nouvelle notification
    }
    
    return notification;
  }
}

// src/server/notifications/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailure?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  async execute<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure!.getTime() > 60000) {
        this.state = 'HALF_OPEN';
      } else {
        return fallback;
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      return fallback;
    }
  }
}
```

---

## 7. IMPACTS SUR LE POLLING

### 7.1 Analyse Actuelle

```typescript
// useNotifications.ts - Ligne 66-95
const POLL_INTERVAL = 30000;      // 30s - charge complète
const UNREAD_INTERVAL = 15000;    // 15s - charge partielle

// Deux intervalles indépendants:
// - Toutes les 30s: loadFromServer() → GET /notifications
// - Toutes les 15s: syncUnreadCount() → GET /notifications/unread-count
// Total: 3 requêtes/min en permanence
```

**Problèmes:**
- ❌ 2 requêtes simultanées possibles
- ❌ Pas de backoff en cas d'erreur
- ❌ Pas de détection online/offline
- ❌ Pas de réduction en mode idle

### 7.2 Solution Proposée

```typescript
// useNotifications.ts - Version optimisée
const useNotifications = () => {
  const [mode, setMode] = useState<'realtime' | 'polling' | 'offline'>('realtime');
  
  // WebSocket en priorité
  useEffect(() => {
    if (mode !== 'realtime') return;
    
    const ws = new WebSocket(`${WS_URL}/notifications/${tenantId}/${userId}`);
    ws.onclose = () => setMode('polling');
    
    return () => ws.close();
  }, [mode, tenantId, userId]);
  
  // Fallback polling seulement si WS échoue
  useEffect(() => {
    if (mode !== 'polling') return;
    
    const interval = setInterval(() => {
      loadFromServer(tenantId, userId);
    }, 60000); // 60s en fallback (vs 30s + 15s actuellement)
    
    return () => clearInterval(interval);
  }, [mode, tenantId, userId]);
  
  // Détection online/offline
  useEffect(() => {
    const handleOnline = () => setMode('realtime');
    const handleOffline = () => setMode('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }, []);
};
```

### 7.3 Réduction de Charge

| Scénario | Actuel | Cible | Réduction |
|----------|--------|-------|-----------|
| **Online + WS** | 4 req/min | 0 req/min | **100%** |
| **Offline** | 4 req/min | 0 req/min | **100%** |
| **WS déconnecté** | 4 req/min | 1 req/min | **75%** |
| **Moyenne** | 4 req/min | 0.5 req/min | **87.5%** |

---

## 8. IMPACTS SUR LES NOTIFICATIONS

### 8.1 Canaux Actuels vs Cibles

| Canal | Status Actuel | Status Cible | Priorité |
|-------|---------------|--------------|----------|
| **Toast** | ✅ UI | ✅ Realtime | 🔴 |
| **Badge** | ✅ UI | ✅ Realtime | 🔴 |
| **Center** | ✅ UI | ✅ Realtime | 🔴 |
| **Banner** | ✅ UI | ✅ Realtime | 🟠 |
| **Email** | ❌ Documenté | ✅ SMTP/SendGrid | 🟠 |
| **Push** | ❌ Documenté | ✅ FCM/APNS | 🟡 |
| **SMS** | ❌ Documenté | ✅ Twilio | 🟡 |
| **Webhook** | ❌ Documenté | ✅ HTTP POST | 🟡 |

### 8.2 Nouveaux Types de Notifications

```typescript
// notification.service.ts - Event Handlers
eventBus.subscribe('order.created', ...);
eventBus.subscribe('order.confirmed', ...);
eventBus.subscribe('payment.received', ...);
eventBus.subscribe('payment.failed', ...);
eventBus.subscribe('inventory.low_stock', ...);
eventBus.subscribe('inventory.out_of_stock', ...);
eventBus.subscribe('billing.expiring', ...);
eventBus.subscribe('billing.expired', ...);
// NOUVEAUX:
eventBus.subscribe('table.assigned', ...);        // Serveur assigné à table
eventBus.subscribe('order.ready', ...);           // Commande prête
eventBus.subscribe('staff.invited', ...);         // Invitation staff
eventBus.subscribe('system.maintenance', ...);    // Maintenance
eventBus.subscribe('platform.trial.ending', ...); // Essai se termine
```

---

## 9. IMPACTS SUR LES TRADUCTIONS

### 9.1 Textes Hardcodés à Extraire

```typescript
// NotificationCenter.tsx
"Notifications" → t('notifications.title')
"Toutes" → t('notifications.tabs.all')
"Non lues" → t('notifications.tabs.unread')
"Tout lire" → t('notifications.actions.markAllRead')
"Aucune notification" → t('notifications.empty.all')
"Aucune notification non lue" → t('notifications.empty.unread')
"Toutes vos notifications ont été lues." → t('notifications.empty.readSubtitle')
"Les nouvelles notifications apparaîtront ici en temps réel." → t('notifications.empty.allSubtitle')
"Données stockées localement sur cet appareil" → t('notifications.footer.localData')
"À l'instant" → t('notifications.time.justNow')
"Il y a {n} min" → t('notifications.time.minutesAgo')
"Il y a {n} h" → t('notifications.time.hoursAgo')

// NotificationBell.tsx
"{n} non lue" → t('notifications.unread.singular')
"{n} non lues" → t('notifications.unread.plural')

// PRIORITY_CONFIG
"Critique" → t('notifications.priority.critical')
"Priorité haute" → t('notifications.priority.high')
"Normale" → t('notifications.priority.medium')
"Basse" → t('notifications.priority.low')
```

### 9.2 Fichiers de Traductions à Ajouter

#### fr.json
```json
{
  "notifications": {
    "title": "Notifications",
    "unread": {
      "singular": "{count} non lue",
      "plural": "{count} non lues"
    },
    "tabs": {
      "all": "Toutes",
      "unread": "Non lues"
    },
    "actions": {
      "markAllRead": "Tout lire",
      "close": "Fermer"
    },
    "empty": {
      "all": "Aucune notification",
      "unread": "Aucune notification non lue",
      "readSubtitle": "Toutes vos notifications ont été lues.",
      "allSubtitle": "Les nouvelles notifications apparaîtront ici en temps réel."
    },
    "footer": {
      "localData": "Données stockées localement sur cet appareil"
    },
    "time": {
      "justNow": "À l'instant",
      "minutesAgo": "Il y a {count} min",
      "hoursAgo": "Il y a {count} h"
    },
    "priority": {
      "critical": "Critique",
      "high": "Priorité haute",
      "medium": "Normale",
      "low": "Basse"
    }
  }
}
```

#### en.json
```json
{
  "notifications": {
    "title": "Notifications",
    "unread": {
      "singular": "{count} unread",
      "plural": "{count} unread"
    },
    "tabs": {
      "all": "All",
      "unread": "Unread"
    },
    "actions": {
      "markAllRead": "Mark all as read",
      "close": "Close"
    },
    "empty": {
      "all": "No notifications",
      "unread": "No unread notifications",
      "readSubtitle": "All your notifications have been read.",
      "allSubtitle": "New notifications will appear here in real-time."
    },
    "footer": {
      "localData": "Data stored locally on this device"
    },
    "time": {
      "justNow": "Just now",
      "minutesAgo": "{count} min ago",
      "hoursAgo": "{count} h ago"
    },
    "priority": {
      "critical": "Critical",
      "high": "High priority",
      "medium": "Normal",
      "low": "Low"
    }
  }
}
```

---

## 10. IMPACTS SUR LES PERFORMANCES

### 10.1 Métriques Actuelles vs Cibles

| Métrique | Actuel | Cible | Amélioration |
|----------|--------|-------|--------------|
| **Latence notification** | 15-30s (polling) | < 1s (realtime) | **30x plus rapide** |
| **Requêtes réseau/min** | 4 | 0-1 | **75-100% réduction** |
| **Taille payload** | ~500ms | ~100ms | **80% réduction** |
| **Cache hit rate** | 0% | 80% | **+80%** |
| **Time to interactive** | N/A | < 100ms | **Nouveau** |

### 10.2 Optimisations Proposées

#### 10.2.1 Base de Données
```sql
-- Index pour requêtes rapides
CREATE INDEX idx_notifications_tenant_user_created 
  ON notifications(tenant_id, user_id, created_at DESC);

CREATE INDEX idx_notifications_unread 
  ON notifications(tenant_id, user_id, read_at) 
  WHERE read_at IS NULL;

-- Partitioning par mois (pour grosses volumétries)
CREATE TABLE notifications_2026_02 PARTITION OF notifications
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

#### 10.2.2 Cache Layer
```typescript
class NotificationCache {
  private cache = new Map<string, CachedNotification[]>();
  
  async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    const key = `unread:${tenantId}:${userId}`;
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < 5000) {
      return cached.count; // Cache hit (5s TTL)
    }
    
    const count = await this.repository.getUnreadCount(tenantId, userId);
    this.cache.set(key, { count, timestamp: Date.now() });
    return count;
  }
}
```

#### 10.2.3 Batch Delivery
```typescript
class BatchDeliveryOptimizer {
  async optimize(notifications: Notification[]): Promise<DeliveryBatch[]> {
    // Grouper par tenant + canal
    const groups = this.groupBy(notifications, ['tenant_id', 'channel']);
    
    // Créer batches de max 50 notifications
    return groups.flatMap(group => 
      this.chunk(group, 50).map(chunk => ({
        ...chunk,
        aggregated: chunk.length > 1
      }))
    );
  }
}
```

---

## 11. RISQUES ÉVENTUELS

### 11.1 Risques Techniques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Perte de notifications** | Moyen | Élevé | Dead Letter Queue + Retry + Persistance |
| **WS overload serveur** | Moyen | Élevé | Connection pooling + Rate limit + Backpressure |
| **Incompatibilité Supabase** | Élevé | Moyen | Feature flags + Fallback SQLite |
| **Race conditions** | Moyen | Moyen | Optimistic locking + Versioning |
| **Memory leaks WS** | Moyen | Moyen | Cleanup automatique + Heartbeat |
| **Cache invalidation** | Faible | Élevé | TTL + Invalidation events |

### 11.2 Risques Fonctionnels

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Notifications en double** | Moyen | Moyen | Fusion engine + idempotency key |
| **Préférences non respectées** | Moyen | Moyen | Validation côté serveur + Audit |
| **Offline data loss** | Faible | Élevé | Queue locale IndexedDB + Sync |
| **Timezone incorrect** | Faible | Moyen | UTC + Timezone detection |
| **Breaking changes** | Faible | Élevé | Feature flags + Migration progressive |

---

## 12. PLAN D'IMPLÉMENTATION ÉTAPE PAR ÉTAPE

### Phase 1: Foundation (Semaine 1) - CRITIQUE

**Objectif:** Corriger les bugs critiques et préparer l'architecture

#### Étape 1.1: Corrections Frontend (Jour 1-2)
- [ ] Corriger `createdAt` → `created_at` dans `NotificationCenter.tsx:247`
- [ ] Corriger `readAt` → `read_at` dans `NotificationCenter.tsx:250`
- [ ] Ajouter alias dans `useNotificationStore.ts` pour compatibilité
- [ ] Tests: Vérifier affichage dates et marquage lu

#### Étape 1.2: Routes API (Jour 2-3)
- [ ] Monter routes `/api/notifications/commands/*` dans `server.ts`
- [ ] Monter routes `/api/notifications/queries/*` dans `server.ts`
- [ ] Tests: Vérifier tous les endpoints avec Postman/Thunder Client

#### Étape 1.3: Repository Dual (Jour 3-4)
- [ ] Créer interface `INotificationRepository`
- [ ] Implémenter `SupabaseNotificationRepository`
- [ ] Implémenter `SqliteNotificationRepository`
- [ ] Créer factory pour sélectionner le bon repository
- [ ] Tests: Vérifier fonctionnement sur SQLite et Supabase

#### Étape 1.4: Traductions (Jour 4-5)
- [ ] Ajouter section `notifications` dans `fr.json`
- [ ] Ajouter section `notifications` dans `en.json`
- [ ] Extraire tous les textes hardcodés
- [ ] Tests: Vérifier affichage en FR et EN

**Livrable Phase 1:**
- ✅ Frontend fonctionnel sans bugs
- ✅ API complète et accessible
- ✅ Support SQLite + Supabase
- ✅ Interface multilingue

---

### Phase 2: Realtime (Semaine 2) - CRITIQUE

**Objectif:** Implémenter WebSocket et remplacer le polling

#### Étape 2.1: WebSocket Server (Jour 1-3)
- [ ] Créer `WebSocketServer` avec `ws` library
- [ ] Implémenter authentification JWT sur WS
- [ ] Gestion des connexions par tenant:user
- [ ] Heartbeat et ping/pong
- [ ] Cleanup automatique des connexions mortes
- [ ] Tests: Connexion, déconnexion, heartbeat

#### Étape 2.2: Realtime Service (Jour 3-4)
- [ ] Créer `RealtimeNotificationService`
- [ ] Publier notifications sur WS channel
- [ ] Gestion des rooms (tenant:{id}:user:{id})
- [ ] Tests: Envoi/réception notifications

#### Étape 2.3: Frontend Hook (Jour 4-5)
- [ ] Créer `useRealtimeNotifications.ts`
- [ ] Intégrer WebSocket dans `useNotifications.ts`
- [ ] Implémenter fallback polling (60s)
- [ ] Détection online/offline
- [ ] Tests: Connexion WS, fallback, reconnexion

**Livrable Phase 2:**
- ✅ WebSocket server opérationnel
- ✅ Notifications temps réel < 1s
- ✅ Fallback automatique en cas de déconnexion
- ✅ Réduction de 75% des requêtes réseau

---

### Phase 3: Delivery Engine (Semaine 3) - ÉLEVÉ

**Objectif:** Implémenter la livraison multi-canaux

#### Étape 3.1: Circuit Breaker (Jour 1-2)
- [ ] Créer `CircuitBreaker` class
- [ ] Implémenter states: CLOSED, OPEN, HALF_OPEN
- [ ] Configurer thresholds (failures, timeout)
- [ ] Tests: Ouverture/fermeture circuit

#### Étape 3.2: Retry Policy (Jour 2-3)
- [ ] Créer `RetryPolicy` avec exponential backoff
- [ ] Configurer max attempts (3)
- [ ] Configurer delays (1s, 2s, 4s)
- [ ] Tests: Retry automatique

#### Étape 3.3: Dead Letter Queue (Jour 3-4)
- [ ] Créer table `notification_dlq`
- [ ] Implémenter `DeadLetterQueue` service
- [ ] Ajouter retry manuel depuis DLQ
- [ ] Tests: Échecs → DLQ → Retry

#### Étape 3.4: Email Channel (Jour 4-5)
- [ ] Implémenter `EmailChannelService`
- [ ] Intégrer SMTP (nodemailer)
- [ ] Créer templates email
- [ ] Tests: Envoi email réussi/échoué

**Livrable Phase 3:**
- ✅ Circuit breaker opérationnel
- ✅ Retry automatique avec backoff
- ✅ Dead letter queue fonctionnelle
- ✅ Canal email opérationnel

---

### Phase 4: Optimisation (Semaine 4) - MOYEN

**Objectif:** Optimiser les performances et la fiabilité

#### Étape 4.1: Fusion Engine (Jour 1-2)
- [ ] Créer `FusionEngine` service
- [ ] Implémenter détection `merge_key`
- [ ] Implémenter agrégation compteurs
- [ ] Tests: Fusion notifications identiques

#### Étape 4.2: Cache Layer (Jour 2-3)
- [ ] Implémenter `NotificationCache` (en mémoire)
- [ ] Ajouter TTL (5s pour unread count)
- [ ] Invalidation sur modifications
- [ ] Tests: Cache hit/miss

#### Étape 4.3: Monitoring (Jour 3-4)
- [ ] Ajouter métriques: latence, throughput, erreurs
- [ ] Créer dashboard Grafana (optionnel)
- [ ] Alertes sur taux d'erreur > 5%
- [ ] Tests: Métriques collectées

#### Étape 4.4: Index DB (Jour 4-5)
- [ ] Créer index sur `(tenant_id, user_id, created_at)`
- [ ] Créer index sur `(tenant_id, read_at)` pour unread
- [ ] Analyser query plans
- [ ] Tests: Performance requêtes

**Livrable Phase 4:**
- ✅ Fusion engine fonctionnelle
- ✅ Cache avec 80% hit rate
- ✅ Monitoring opérationnel
- ✅ Requêtes optimisées < 50ms

---

### Phase 5: Polish (Semaine 5) - AMÉLIORATION

**Objectif:** Finaliser et optimiser l'UX

#### Étape 5.1: Préférences Utilisateur (Jour 1-2)
- [ ] Créer table `notification_preferences`
- [ ] Implémenter API preferences
- [ ] Ajouter UI preferences dans Settings
- [ ] Tests: Préférences respectées

#### Étape 5.2: Digest Quotidien (Jour 2-3)
- [ ] Créer `DigestService`
- [ ] Implémenter agrégation quotidienne
- [ ] Envoyer email digest (optionnel)
- [ ] Tests: Digest reçu

#### Étape 5.3: Tests E2E (Jour 3-4)
- [ ] Tests: Création → Delivery → Affichage
- [ ] Tests: Fallback WS → Polling
- [ ] Tests: Circuit breaker + Retry
- [ ] Tests: Multi-tenant isolation

#### Étape 5.4: Documentation (Jour 4-5)
- [ ] Mettre à jour README
- [ ] Créer guide d'utilisation
- [ ] Documenter API
- [ ] Créer runbooks opérationnels

**Livrable Phase 5:**
- ✅ Préférences utilisateur fonctionnelles
- ✅ Digest quotidien opérationnel
- ✅ Tests E2E passants
- ✅ Documentation complète

---

## 13. RECOMMANDATIONS PRIORITAIRES

### 13.1 Actions Immédiates (Cette Semaine)

#### 🔴 CRITIQUE - Jour 1-2
1. **Corriger les champs du store** - `createdAt` → `created_at`, `readAt` → `read_at`
   - **Fichier:** `NotificationCenter.tsx:247-250`
   - **Impact:** Bug d'affichage résolu
   - **Effort:** 30 min

2. **Monter les routes API** - Ajouter `/api/notifications` dans `server.ts`
   - **Fichier:** `server.ts` + `notifications.routes.ts`
   - **Impact:** Endpoints accessibles
   - **Effort:** 1h

3. **Créer repository Supabase** - Pour le mode cloud
   - **Fichier:** `SupabaseNotificationRepository.ts`
   - **Impact:** Support cloud fonctionnel
   - **Effort:** 4h

#### 🟠 ÉLEVÉ - Semaine 2
4. **Implémenter WebSocket server** - Pour le realtime
   - **Fichiers:** `WebSocketServer.ts`, `RealtimeNotificationService.ts`
   - **Impact:** Latence < 1s
   - **Effort:** 2 jours

5. **Connecter Event Bus global** - Faire émettre les événements métier
   - **Fichier:** `notification.service.ts:36-138`
   - **Impact:** Notifications automatiques
   - **Effort:** 1 jour

6. **Ajouter traductions i18n** - Extraire textes hardcodés
   - **Fichiers:** `fr.json`, `en.json`, composants
   - **Impact:** UX multilingue
   - **Effort:** 1 jour

### 13.2 Actions à Court Terme (2 Semaines)

7. **Delivery Engine** - Pour les canaux multiples
   - **Effort:** 3 jours
   - **Impact:** Email, Push, SMS fonctionnels

8. **Circuit Breaker + Retry** - Gestion d'erreurs
   - **Effort:** 2 jours
   - **Impact:** Fiabilité ++

9. **Fusion Engine** - Déduplication
   - **Effort:** 1 jour
   - **Impact:** Spam réduit

### 13.3 Actions à Moyen Terme (1 Mois)

10. **Préférences utilisateur** - Personnalisation
11. **Digest quotidien** - Agrégation
12. **Monitoring avancé** - Observabilité
13. **Tests E2E** - Couverture complète

---

## 14. CONCLUSION

### 14.1 Synthèse

Le système de notifications EKALA POS possède une **architecture cible excellente** et une **documentation complète**, mais souffre d'une **implémentation incomplète** (40% terminé).

**Points forts:**
- ✅ Architecture DDD bien pensée
- ✅ Documentation exhaustive
- ✅ UI Premium soignée
- ✅ Séparation des concerns (CQRS)

**Points faibles:**
- ❌ Pas de realtime (polling inefficace)
- ❌ Event Bus isolé
- ❌ Repository SQLite uniquement
- ❌ Bugs de compatibilité de champs

### 14.2 Verdict

**L'architecture est solide et évolutive.** Les améliorations proposées permettent de:

1. **Réduire la latence** de 30s à < 1s (30x)
2. **Réduire les requêtes réseau** de 75-100%
3. **Améliorer la fiabilité** avec circuit breaker + retry + DLQ
4. **Rendre multilingue** avec i18n
5. **Support cloud** avec repository dual

### 14.3 Prochaines Étapes

1. **Valider ce diagnostic** avec l'équipe
2. **Prioriser les actions** critiques (Phase 1)
3. **Commencer l'implémentation** par les corrections P1-P5
4. **Tester chaque phase** avant de passer à la suivante
5. **Monitorer en production** après déploiement

---

## ANNEXES

### A. Fichiers Modifiés par Phase

| Phase | Fichiers Modifiés | Fichiers Créés |
|-------|-------------------|----------------|
| **Phase 1** | `NotificationCenter.tsx`, `useNotificationStore.ts`, `server.ts`, `notifications.routes.ts` | `SupabaseNotificationRepository.ts` |
| **Phase 2** | `useNotifications.ts`, `notification.service.ts` | `WebSocketServer.ts`, `RealtimeNotificationService.ts`, `useRealtimeNotifications.ts` |
| **Phase 3** | `notification.service.ts`, channels services | `CircuitBreaker.ts`, `RetryPolicy.ts`, `DeadLetterQueue.ts`, `DeliveryEngine.ts` |
| **Phase 4** | `NotificationRepository.ts` | `FusionEngine.ts`, `NotificationCache.ts`, `BatchDeliveryOptimizer.ts` |
| **Phase 5** | Settings pages, `useNotifications.ts` | `NotificationPreferences.ts`, `DigestService.ts` |

### B. Estimation des Efforts

| Phase | Effort Total | Risque | ROI |
|-------|--------------|--------|-----|
| Phase 1 | 5 jours | Faible | Élevé (bugs critiques) |
| Phase 2 | 5 jours | Moyen | Élevé (UX) |
| Phase 3 | 5 jours | Moyen | Élevé (fiabilité) |
| Phase 4 | 5 jours | Faible | Moyen (performance) |
| Phase 5 | 5 jours | Faible | Moyen (UX) |
| **TOTAL** | **25 jours** | - | - |

### C. Tests de Validation

```typescript
// Tests critiques à passer
describe('Notification System', () => {
  test('P1: WebSocket delivers notification < 1s', async () => {
    // Créer notification
    // Mesurer temps de réception frontend
    // Assert: < 1000ms
  });
  
  test('P2: Fallback polling works when WS disconnected', async () => {
    // Déconnecter WS
    // Vérifier polling à 60s
    // Assert: Notifications reçues
  });
  
  test('P3: Circuit breaker opens after 5 failures', async () => {
    // Simuler 5 échecs SMTP
    // Assert: Circuit OPEN
    // Assert: Fallback utilisé
  });
  
  test('P4: Repository dual works (SQLite + Supabase)', async () => {
    // Créer notification sur SQLite
    // Vérifier sur Supabase
    // Assert: Sync
  });
  
  test('P5: Fields createdAt/created_at compatible', async () => {
    // Créer notification
    // Vérifier affichage dans Center
    // Assert: Date correcte
  });
});
```

---

**FIN DU DOCUMENT**