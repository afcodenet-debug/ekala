# NOTIFICATION SYSTEM - ARCHITECTURE ANALYSIS & RECOMMENDATIONS

**Date:** 02/07/2026  
**Version:** 1.0  
**Statut:** Diagnostic Complet

---

## 1. DIAGNOSTIC DE L'EXISTANT

### 1.1 Architecture Actuelle

Le système de notifications actuel suit une architecture **hybride** avec les caractéristiques suivantes :

#### Stack Technique
- **Frontend:** React + TypeScript + Zustand (state management)
- **Backend:** Express.js + better-sqlite3 (local) / Supabase (cloud)
- **Pattern:** Event-Driven avec Event Bus interne
- **Base de données:** SQLite (local) avec schéma PostgreSQL pour Supabase

#### Composants Principaux

| Couche | Composant | Description |
|--------|-----------|-------------|
| **Frontend** | `useNotifications.ts` | Hook React avec polling (30s) |
| **Frontend** | `useNotificationStore.ts` | Store Zustand avec état local |
| **Frontend** | `NotificationBell.tsx` | Composant icône cloche |
| **Frontend** | `NotificationCenter.tsx` | Panel de notifications |
| **Backend** | `NotificationService.ts` | Orchestration notifications |
| **Backend** | `NotificationRepository.ts` | Accès données SQLite |
| **Backend** | `NotificationEventBus.ts` | Bus d'événements interne |
| **Backend** | `NotificationPolicyEngine.ts` | Moteur de règles |
| **Backend** | `notifications.routes.ts` | API REST (CQRS-like) |

### 1.2 Flux de Données Actuel

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Événement      │────▶│  Event Bus       │────▶│  Notification    │
│  (order.created)│     │  (InMemory)      │     │  Service         │
└─────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                             │
                                                             ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Policy Engine  │◀────│  Repository      │◀────│  DB (SQLite)     │
│  (Rules)        │     │  (CRUD)          │     │  ou Supabase     │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                                                             │
                                                             ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Frontend       │◀────│  API Routes      │◀────│  HTTP Response   │
│  (Polling)      │     │  (REST)          │     │  (JSON)          │
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

### 1.3 Points Forts Identifiés

1. **Architecture DDD documentée** - Le système possède une documentation d'architecture cible complète
2. **Multi-tenant** - Isolation par `tenant_id` sur toutes les tables
3. **Policy Engine** - Système de règles configurable avec rate limiting
4. **UI Premium** - Composants avec design system soigné
5. **Offline-First** - Documentation prévue pour le mode déconnecté
6. **Event Sourcing** - Documentation prévue pour la traçabilité

---

## 2. PROBLÈMES IDENTIFIÉS

### 2.1 Problèmes Critiques

| ID | Problème | Sévérité | Impact |
|----|----------|----------|--------|
| **P1** | **Polling inefficace** - 30s d'intervalle avec 2 requêtes simultanées (full + unread) | 🔴 CRITIQUE | Consommation réseau excessive, latence de notification |
| **P2** | **Pas de Realtime** - Aucun WebSocket/Supabase Realtime pour les notifications | 🔴 CRITIQUE | Notifications non instantanées |
| **P3** | **Event Bus isolé** - L'EventBus interne n'est pas connecté au système d'événements métier | 🔴 CRITIQUE | Les événements ne déclenchent pas automatiquement les notifications |
| **P4** | **Repository SQLite uniquement** - Pas de repository Supabase pour le cloud | 🔴 CRITIQUE | Fonctionne uniquement en local |
| **P5** | **Gestion d'erreurs basique** - Pas de circuit breaker, retry, dead letter queue | 🟠 ÉLEVÉ | Risque de perte de notifications |

### 2.2 Problèmes Majeurs

| ID | Problème | Sévérité | Impact |
|----|----------|----------|--------|
| **P6** | **Champ `createdAt` manquant** - Le store utilise `created_at` mais le composant utilise `createdAt` | 🟠 ÉLEVÉ | Bug d'affichage des dates |
| **P7** | **Champ `readAt` manquant** - Incohérence avec `read_at` | 🟠 ÉLEVÉ | Bug de marquage comme lu |
| **P8** | **Pas de traductions** - Textes hardcodés en français/anglais | 🟠 ÉLEVÉ | UX limitée |
| **P9** | **API routes incomplètes** - `/api/notifications` sans `/queries` ni `/commands` | 🟠 ÉLEVÉ | Routes non accessibles |
| **P10** | **Channels non implémentés** - Email, SMS, Push documentés mais non fonctionnels | 🟠 ÉLEVÉ | Fonctionnalités manquantes |

### 2.3 Problèmes Mineurs

| ID | Problème | Sévérité | Impact |
|----|----------|----------|--------|
| **P11** | **Pas de préférences utilisateur** - Table `notification_preferences` non utilisée | 🟡 MOYEN | Personnalisation impossible |
| **P12** | **Pas de digest** - Pas d'agrégation quotidienne/hebdo | 🟡 MOYEN | Spam possible |
| **P13** | **Audit limité** - Table `notification_audit` non remplie | 🟡 MOYEN | Traçabilité insuffisante |
| **P14** | **Fusion non implémentée** - `merge_key` dans policies mais pas de logique | 🟡 MOYEN | Notifications dupliquées |

---

## 3. AMÉLIORATIONS PROPOSÉES

### 3.1 Architecture Cible - Realtime First

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Événement      │────▶│  Event Bus       │────▶│  Notification    │
│  Métier         │     │  (Global)        │     │  Service         │
└─────────────────┘     └────────┬─────────┘     └────────┬─────────┘
                                   │                      │
                                   ▼                      ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Supabase       │     │  Policy Engine   │     │  Repository      │
│  Realtime       │     │  + Preferences   │     │  (Dual)          │
└─────────────────┘     └────────┬─────────┘     └────────┬─────────┘
                                   │                      │
                                   ▼                      ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  WebSocket      │     │  Delivery        │     │  Cache Layer     │
│  (Fallback)     │     │  Engine          │     │  (Redis)         │
└─────────────────┘     └────────┬─────────┘     └────────┬─────────┘
                                   │                      │
                                   ▼                      │
┌─────────────────┐     ┌──────────────────┐              │
│  Frontend       │◀────│  API Routes      │◀─────────────┘
│  (Realtime)     │     │  (REST + WS)     │
└─────────────────┘     └──────────────────┘
```

### 3.2 Nouveaux Patterns

#### 3.2.1 Event-Driven Architecture
```typescript
// Event Bus Global - Connexion aux événements métier
eventBus.subscribe('order.created', async (event) => {
  const notification = await notificationService.createFromEvent(event);
  await deliveryEngine.deliver(notification);
});

// Event Bus Platform - Pour les événements platform
platformEventBus.subscribe('platform.tenant.created', async (event) => {
  // Notification admin
});
```

#### 3.2.2 Repository Pattern Dual
```typescript
// Repository abstrait
interface INotificationRepository {
  create(data: CreateNotificationDto): Promise<Notification>;
  findMany(filters: NotificationFilters): Promise<{ notifications: Notification[], total: number }>;
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
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }
    // ...
  }
}
```

---

## 4. NOUVEAU WORKFLOW COMPLET

### 4.1 Flux de Création de Notification

```
1. Événement Métier
   ↓
2. Event Bus (global)
   ↓
3. Notification Service
   ↓
4. Policy Engine (règles + préférences)
   ↓
5. Routing Engine (destinataires)
   ↓
6. Fusion Engine (deduplication)
   ↓
7. Queue (priorité + batch)
   ↓
8. Delivery Engine (channels)
   ↓
9. Realtime Push (WebSocket/Supabase)
   ↓
10. Frontend (instantané)
```

### 4.2 Flux de Consommation Frontend

```
1. Connexion WebSocket
   ↓
2. Souscription canal tenant:user
   ↓
3. Réception notification
   ↓
4. Mise à jour store Zustand
   ↓
5. Badge animé + Toast
   ↓
6. Center mis à jour
```

### 4.3 Fallback Polling

```
WebSocket disconnect
   ↓
Polling 30s activé
   ↓
Sync incrémental (last_cursor)
   ↓
Reconnexion WS
   ↓
Polling désactivé
```

---

## 5. IMPACTS FRONTEND

### 5.1 Modifications Nécessaires

| Composant | Action | Priorité |
|-----------|--------|----------|
| `useNotifications.ts` | Remplacer polling par WebSocket + fallback | 🔴 |
| `useNotificationStore.ts` | Ajouter `createdAt` alias, `readAt` alias | 🔴 |
| `NotificationCenter.tsx` | Utiliser `created_at` au lieu de `createdAt` | 🔴 |
| `NotificationBell.tsx` | Ajouter animation sonore optionnelle | 🟡 |
| `i18n/locales/*.json` | Ajouter clés de traduction | 🟡 |

### 5.2 Nouveaux Hooks

```typescript
// useRealtimeNotifications.ts
export function useRealtimeNotifications() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const { addNotification } = useNotificationStore();
  
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/notifications/${tenantId}/${userId}`);
    
    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      addNotification(notification);
    };
    
    setSocket(ws);
    return () => ws.close();
  }, [tenantId, userId]);
}
```

### 5.3 Optimisations UX

- **Animation sonore** pour notifications critiques
- **Vibration** sur mobile pour notifications urgentes
- **Focus detection** - Ne pas afficher toast si l'onglet est actif
- **Grouping** - Regrouper les notifications similaires

---

## 6. IMPACTS BACKEND

### 6.1 Modifications Nécessaires

| Service | Action | Priorité |
|---------|--------|----------|
| `NotificationService.ts` | Connecter Event Bus global | 🔴 |
| `NotificationRepository.ts` | Créer version Supabase | 🔴 |
| `NotificationEventBus.ts` | Intégrer avec platform event bus | 🔴 |
| `notifications.routes.ts` | Corriger routes /queries /commands | 🔴 |
| `realtime-notification.service.ts` | Implémenter WebSocket server | 🔴 |

### 6.2 Nouveaux Services

```typescript
// src/server/notifications/delivery-engine.ts
export class DeliveryEngine {
  async deliver(notification: Notification): Promise<void> {
    const channels = notification.channels;
    
    if (channels.includes('toast')) {
      await this.pushToWebSocket(notification);
    }
    if (channels.includes('email')) {
      await this.sendEmail(notification);
    }
    if (channels.includes('push')) {
      await this.sendPush(notification);
    }
  }
}

// src/server/notifications/fusion-engine.ts
export class FusionEngine {
  async merge(notification: Notification): Promise<Notification | null> {
    // Chercher notification existante avec même merge_key
    // Incrémenter compteur au lieu de créer nouvelle
  }
}
```

---

## 7. IMPACTS SUR LE POLLING

### 7.1 Problèmes Actuels

```typescript
// useNotifications.ts - Ligne 66-95
// Deux intervalles indépendants:
// - POLL_INTERVAL = 30000 (30s) - charge complète
// - UNREAD_INTERVAL = 15000 (15s) - charge partielle
// Total: 45s de requêtes toutes les 15s = 3 requêtes/min
```

### 7.2 Solution Proposée

```typescript
// useNotifications.ts - Version optimisée
const useNotifications = () => {
  // Mode Realtime par défaut
  const [useRealtime, setUseRealtime] = useState(true);
  
  // Fallback polling seulement si WS échoue
  useEffect(() => {
    if (!useRealtime) {
      const interval = setInterval(() => {
        loadFromServer(tenantId, userId);
      }, 60000); // 60s en fallback
      return () => clearInterval(interval);
    }
  }, [useRealtime]);
  
  // Détection online/offline
  useEffect(() => {
    const handleOnline = () => setUseRealtime(true);
    const handleOffline = () => setUseRealtime(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }, []);
};
```

### 7.3 Réduction de Charge

| Scénario | Actuel | Cible | Réduction |
|----------|--------|-------|-----------|
| Online + WS | 4 requêtes/min | 0 requêtes/min | 100% |
| Offline | 4 requêtes/min | 1 requête/min | 75% |
| WS déconnecté | 4 requêtes/min | 1 requête/min | 75% |

---

## 8. IMPACTS SUR LES NOTIFICATIONS

### 8.1 Types de Notifications Supportés

| Type | Actuel | Cible | Canal |
|------|--------|-------|-------|
| Order Created | ✅ | ✅ | Toast + Badge + Center |
| Order Confirmed | ✅ | ✅ | Toast + Badge |
| Payment Received | ✅ | ✅ | Toast + Center + Email |
| Payment Failed | ✅ | ✅ | Toast + Badge + Center + Banner + Email |
| Low Stock | ✅ | ✅ | Badge + Center + Email (manager) |
| Out of Stock | ✅ | ✅ | Toast + Badge + Center + Banner + Email |
| Billing Expiring | ✅ | ✅ | Toast + Badge + Center + Banner + Email |
| Billing Expired | ✅ | ✅ | Banner + Email |
| System Maintenance | ✅ | ✅ | Banner |

### 8.2 Nouveaux Canaux

| Canal | Status Actuel | Status Cible |
|-------|---------------|--------------|
| Toast | ✅ UI | ✅ Realtime |
| Badge | ✅ UI | ✅ Realtime |
| Center | ✅ UI | ✅ Realtime |
| Banner | ✅ UI | ✅ Realtime |
| Email | ❌ | ✅ SMTP/SendGrid |
| Push | ❌ | ✅ FCM/APNS |
| SMS | ❌ | ✅ Twilio |
| Webhook | ❌ | ✅ HTTP POST |

---

## 9. IMPACTS SUR LES TRADUCTIONS

### 9.1 Textes Hardcodés à Extraire

```typescript
// NotificationCenter.tsx
"Notifications" → t('notifications.title')
"Toutes" → t('notifications.tabs.all')
"Non lues" → t('notifications.tabs.unread')
"Tout lire" → t('notifications.actions.markAllRead')
"Aucune notification" → t('notifications.empty.title')
"Données stockées localement" → t('notifications.footer.localData')

// NotificationBell.tsx
"non lue(s)" → t('notifications.unread', { count: unreadCount })
```

### 9.2 Fichier de Traductions à Ajouter

```json
// src/i18n/locales/fr.json
{
  "notifications": {
    "title": "Notifications",
    "unread": "{count} non lue | {count} non lues",
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
      "unread": "Aucune notification non lue"
    },
    "footer": {
      "localData": "Données stockées localement sur cet appareil"
    }
  }
}
```

---

## 10. IMPACTS SUR LES PERFORMANCES

### 10.1 Métriques Actuelles

| Métrique | Valeur | Cible |
|----------|--------|-------|
| Latence notification | 15-30s (polling) | < 1s (realtime) |
| Requêtes réseau/min | 4 | 0-1 |
| Taille payload | ~500ms | ~100ms |
| Cache hit rate | 0% | 80% |

### 10.2 Optimisations Proposées

1. **Index DB** - Ajout index sur `tenant_id, user_id, created_at`
2. **Cache Redis** - Pour les unread counts fréquents
3. **Batch delivery** - Regrouper les notifications non urgentes
4. **Compression WS** - Messages compressés en transit
5. **Lazy loading** - Pagination côté serveur

---

## 11. RISQUES ÉVENTUELS

### 11.1 Risques Techniques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Perte de notifications | Moyen | Élevé | Dead Letter Queue + Retry |
| WS overload serveur | Moyen | Élevé | Connection pooling + Rate limit |
| Incompatibilité Supabase | Élevé | Moyen | Feature flags + Fallback |
| Race conditions | Moyen | Moyen | Optimistic locking |
| Memory leaks WS | Moyen | Moyen | Cleanup + Heartbeat |

### 11.2 Risques Fonctionnels

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Notifications en double | Moyen | Moyen | Fusion engine + dedup |
| Préférences non respectées | Moyen | Moyen | Validation côté serveur |
| Offline data loss | Faible | Élevé | Queue locale + sync |
| Timezone incorrect | Faible | Moyen | Timezone detection |

---

## 12. PLAN D'IMPLÉMENTATION ÉTAPE PAR ÉTAPE

### Phase 1: Foundation (Semaine 1)
- [ ] Créer `SupabaseNotificationRepository`
- [ ] Corriger les champs `createdAt`/`readAt` dans le store
- [ ] Ajouter traductions i18n
- [ ] Fix routes API `/queries` et `/commands`

### Phase 2: Realtime (Semaine 2)
- [ ] Implémenter WebSocket server
- [ ] Connecter Event Bus global
- [ ] Modifier `useNotifications` hook
- [ ] Tester fallback polling

### Phase 3: Delivery (Semaine 3)
- [ ] Implémenter `DeliveryEngine`
- [ ] Ajouter Email channel (SMTP)
- [ ] Ajouter Push channel (FCM)
- [ ] Tests d'intégration

### Phase 4: Optimisation (Semaine 4)
- [ ] Fusion Engine
- [ ] Circuit Breaker
- [ ] Dead Letter Queue
- [ ] Monitoring & metrics

### Phase 5: Polish (Semaine 5)
- [ ] Préférences utilisateur
- [ ] Digest quotidien
- [ ] Tests E2E
- [ ] Documentation

---

## 13. RECOMMANDATIONS PRIORITAIRES

### 🔴 CRITIQUE - À faire IMMÉDIATEMENT
1. **Corriger les champs du store** - `createdAt` → `created_at`, `readAt` → `read_at`
2. **Connecter Event Bus** - Faire émettre les événements métier
3. **Implémenter repository Supabase** - Pour le mode cloud
4. **Corriger routes API** - Ajouter `/queries` et `/commands`

### 🟠 ÉLEVÉ - À faire dans les 2 semaines
1. **WebSocket server** - Pour le realtime
2. **Delivery Engine** - Pour les canaux multiples
3. **Gestion d'erreurs** - Circuit breaker + retry

### 🟡 MOYEN - À faire dans le mois
1. **Préférences utilisateur**
2. **Fusion/agrégation**
3. **Digest programmé**

---

## 14. CONCLUSION

Le système de notifications possède une **architecture solide** documentée mais souffre de **l'implémentation incomplète**. Les points critiques à résoudre sont :

1. **Realtime** - Remplacer le polling inefficace
2. **Event Bus** - Connecter les événements métier
3. **Repository** - Support du mode cloud
4. **Champs** - Corriger les incohérences

L'architecture cible est bien pensée et permettra une évolution progressive sans breaking changes majeurs.