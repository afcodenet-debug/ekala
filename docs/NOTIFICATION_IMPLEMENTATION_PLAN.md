# PLAN D'IMPLÉMENTATION DU SYSTÈME DE NOTIFICATIONS
**Version :** 1.0  
**Date :** 29/06/2026  
**Philosophie :** Vision V3, livraison par incréments, réutilisation du existant

---

## PRINCIPE DIRECTEUR

> **"Conserver la vision V3, mais livrer par incréments. Le premier incrément doit réutiliser au maximum les composants déjà présents (notamment GenericSyncService, l'outbox SQLite et l'infrastructure Offline First) afin d'éviter une sur-ingénierie tout en préparant naturellement l'arrivée des canaux avancés (SMS, WhatsApp, Push, Webhooks, IA) lorsque le produit en aura réellement besoin."**

---

## STRATÉGIE D'IMPLÉMENTATION

### Approche : "Strangler Fig Pattern"
Au lieu de remplacer le système existant d'un coup, nous allons :
1. **Envelopper** le système actuel avec une couche d'abstraction
2. **Incrémenter** les améliorations une par une
3. **Déprécier** progressivement les anciens patterns

### Bénéfices
- ✅ Risque minimal (rollback facile)
- ✅ Valeur ajoutée immédiate à chaque incrément
- ✅ Pas de big bang
- ✅ Réutilisation du code existant
- ✅ Tests progressifs

---

## INCÉMENT 1 : FONDATIONS (Semaine 1-2)

**Objectif :** Ajouter résilience et traçabilité sans casser l'existant

### 1.1 Créer NotificationEventBus (abstraction)

**Fichier :** `src/server/notifications/notification-event-bus.ts`

```typescript
// Abstraction qui wrap les appels existants
export class NotificationEventBus {
  async publish(event: NotificationEvent): Promise<void> {
    // Pour l'instant : appel direct (comme avant)
    // Mais via une interface uniforme
    await this.handleEvent(event);
  }
  
  private async handleEvent(event: NotificationEvent): Promise<void> {
    // Phase 1 : comportement actuel
    // Phase 2 : ajout de queue
    // Phase 3 : ajout de filtres
  }
}
```

**Réutilisation :** 
- Utilise `InMemoryEventBus` comme base
- Ajoute persistence SQLite (comme `audit-queue.service.ts`)

**Critères de succès :**
- [ ] Tous les `notifyXxx()` existants sont migrés vers `eventBus.publish()`
- [ ] Aucun changement de comportement observable
- [ ] Tests de non-régression passent

### 1.2 Créer NotificationQueue (persistance)

**Fichier :** `src/server/notifications/notification-queue.ts`

```typescript
// Basé sur audit-queue.service.ts
export class NotificationQueue {
  async enqueue(notification: EmailJob): Promise<void> {
    // INSERT INTO notification_queue (payload, retry_count, status)
  }
  
  async process(): Promise<void> {
    // Traitement avec retry + backoff
  }
}
```

**Réutilisation :**
- Copie la logique de `audit-queue.service.ts`
- Adapte pour les emails au lieu des audits

**Critères de succès :**
- [ ] Les emails sont persistés avant envoi
- [ ] Retry automatique après crash serveur
- [ ] Dead letter queue après 3 échecs

### 1.3 Ajouter structured logging

**Fichier :** `src/server/notifications/notification-logger.ts`

```typescript
export class NotificationLogger {
  logSend(notificationId: string, recipients: string[], channel: string) {
    logger.info({
      event: 'notification.send',
      notificationId,
      recipients,
      channel,
      timestamp: new Date().toISOString()
    });
  }
  
  logDelivery(notificationId: string, status: 'sent' | 'delivered' | 'bounced') {
    // ...
  }
}
```

**Réutilisation :**
- Utilise `logging-standard.ts` existant
- Format JSON pour observabilité

**Critères de succès :**
- [ ] Tous les envois sont loggés
- [ ] Logs disponibles dans dashboard observability

---

## INCÉMENT 2 : FIABILISATION (Semaine 3-4)

**Objectif :** Ajouter retry, circuit breaker, et health checks

### 2.1 Implémenter EmailRetryPolicy

**Fichier :** `src/server/notifications/email-retry-policy.ts`

```typescript
export class EmailRetryPolicy {
  private maxRetries = 3;
  private backoffMs = [1000, 5000, 15000]; // 1s, 5s, 15s
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === this.maxRetries - 1) throw error;
        await this.sleep(this.backoffMs[attempt]);
      }
    }
    throw new Error('Unreachable');
  }
}
```

**Réutilisation :**
- Inspire de `circuit-breaker.service.ts`
- Adapté pour SMTP

### 2.2 Ajouter SMTP Health Check

**Fichier :** `src/server/notifications/smtp-health-check.ts`

```typescript
export class SMTPHealthCheck {
  async check(): Promise<HealthStatus> {
    try {
      await transporter.verify();
      return { healthy: true, latency: 120 };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}
```

**Critères de succès :**
- [ ] Health check toutes les 60s
- [ ] Dashboard affiche statut SMTP
- [ ] Alerting si SMTP down > 5min

### 2.3 Ajouter Circuit Breaker

**Fichier :** `src/server/notifications/email-circuit-breaker.ts`

```typescript
// Basé sur circuit-breaker.service.ts
export class EmailCircuitBreaker {
  private failures = 0;
  private threshold = 5;
  private timeout = 30000; // 30s
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker open');
    }
    try {
      return await fn();
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}
```

**Critères de succès :**
- [ ] Circuit s'ouvre après 5 échecs consécutifs
- [ ] Se referme après 30s de timeout
- [ ] Pas de spam SMTP en cas de panne

---

## INCÉMENT 3 : TEMPS RÉEL (Semaine 5-6)

**Objectif :** Synchronisation backend ↔ frontend + notifications instantanées

### 3.1 Implémenter loadFromServer()

**Fichier :** `src/stores/useNotificationStore.ts` (modification)

```typescript
// Ajouter polling comme fallback
loadFromServer: async () => {
  const response = await api.get('/notifications?unread_only=true');
  ingestNotifications(response.data);
}
```

**Critères de succès :**
- [ ] Polling toutes les 30s
- [ ] Pas de doublons (grâce à ingestNotifications)
- [ ] Badge se met à jour automatiquement

### 3.2 Ajouter Supabase Realtime pour notifications

**Fichier :** `src/server/notifications/realtime-notification.service.ts`

```typescript
// Réutilise supabase-realtime-sync.service.ts
export class RealtimeNotificationService {
  startListening(userId: string) {
    this.channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        this.broadcastToUser(userId, payload.new);
      });
  }
}
```

**Critères de succès :**
- [ ] Notification apparaît instantanément
- [ ] Fonctionne en mode cloud (Supabase)
- [ ] Fallback polling en mode local

### 3.3 Créer NotificationWebSocket (optionnel)

**Fichier :** `src/server/notifications/websocket-notification.service.ts`

```typescript
// Alternative si Supabase Realtime insuffisant
import { Server as SocketIOServer } from 'socket.io';

export class WebSocketNotificationService {
  constructor(private io: SocketIOServer) {}
  
  sendToUser(userId: string, notification: AppNotification) {
    this.io.to(`user:${userId}`).emit('notification', notification);
  }
}
```

**Critères de succès :**
- [ ] Socket.io connecté
- [ ] Rooms par utilisateur
- [ ] Reconnexion automatique

---

## INCÉMENT 4 : TEMPLATES PROFESSIONNELS (Semaine 7-8)

**Objectif :** Externaliser et versionner les templates

### 4.1 Migrer vers MJML

**Structure :**
```
src/server/notifications/templates/
├── base.mjml              # Template de base
├── sale-confirmation.mjml
├── stock-alert.mjml
├── inventory-summary.mjml
├── voucher-expired.mjml
└── ...
```

**Fichier :** `src/server/notifications/template-engine.ts`

```typescript
import mjml2html from 'mjml';

export class TemplateEngine {
  async render(templateName: string, data: any): Promise<string> {
    const mjml = await fs.readFile(`templates/${templateName}.mjml`, 'utf-8');
    const { html } = mjml2html(mjml, { minify: true });
    return html;
  }
}
```

**Réutilisation :**
- Garde le design system existant (charcoal #1a1a1f, gold #c9a84c)
- Convertit les templates inline existants en MJML

**Critères de succès :**
- [ ] Tous les templates externalisés
- [ ] Preview dans l'admin
- [ ] Tests visuels (captures d'écran)

### 4.2 Ajouter versioning des templates

**Table :** `notification_templates`
```sql
CREATE TABLE notification_templates (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  version INTEGER,
  content TEXT, -- MJML
  changelog TEXT,
  updated_at TIMESTAMP
);
```

**Critères de succès :**
- [ ] Historique des modifications
- [ ] Rollback possible
- [ ] A/B testing (version A vs B)

---

## INCÉMENT 5 : MONITORING & MÉTRIQUES (Semaine 9-10)

**Objectif :** Visibilité complète sur la délivrabilité

### 5.1 Créer NotificationMetrics

**Fichier :** `src/server/notifications/notification-metrics.ts`

```typescript
export class NotificationMetrics {
  incrementSent(channel: string) {
    metrics.increment('notification.sent', 1, { channel });
  }
  
  incrementDelivered(channel: string) {
    metrics.increment('notification.delivered', 1, { channel });
  }
  
  incrementBounced(channel: string, reason: string) {
    metrics.increment('notification.bounced', 1, { channel, reason });
  }
  
  recordLatency(channel: string, ms: number) {
    metrics.histogram('notification.latency', ms, { channel });
  }
}
```

**Réutilisation :**
- Utilise `metrics-collector.ts` existant
- Intègre au dashboard observability

**Critères de succès :**
- [ ] Taux de délivrabilité par canal
- [ ] Temps d'envoi moyen
- [ ] Taux d'échec par template

### 5.2 Créer NotificationDashboard

**Page :** `src/pages/admin/NotificationDashboard.tsx`

```typescript
// Métriques affichées
- Emails envoyés (24h, 7j, 30j)
- Taux de délivrabilité
- Top 10 des notifications
- Taux d'échec par canal
- Dead letter queue count
```

**Critères de succès :**
- [ ] Dashboard accessible aux admins
- [ ] Rafraîchi toutes les 60s
- [ ] Export CSV possible

---

## INCÉMENT 6 : OPTIMISATIONS (Semaine 11-12)

**Objectif :** Performance et scalabilité

### 6.1 Ajouter pagination API

**Fichier :** `src/server/routes/notifications.ts` (modification)

```typescript
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, type, priority, read } = req.query;
  
  const offset = (Number(page) - 1) * Number(limit);
  
  // Ajouter WHERE clauses dynamiques
  if (type) query = query.eq('type', type);
  if (priority) query = query.eq('priority', priority);
  if (read === 'true') query = query.not('read_at', 'is', null);
  
  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit));
    
  res.json({ data, total: count, page, limit });
});
```

**Critères de succès :**
- [ ] Pagination fonctionne
- [ ] Filtres par type/priorité/statut
- [ ] Performance < 200ms pour 10k notifications

### 6.2 Ajouter index base de données

**Fichier :** `backend/migrations/045_notification_indexes.sql`

```sql
CREATE INDEX idx_notifications_tenant_created 
ON notifications(tenant_id, created_at DESC);

CREATE INDEX idx_notifications_user_unread 
ON notifications(user_id, read_at) 
WHERE read_at IS NULL;

CREATE INDEX idx_notifications_queue_status 
ON notification_queue(status, created_at);
```

**Critères de succès :**
- [ ] Requêtes < 50ms avec 100k notifications
- [ ] Explain plan montre utilisation des index

### 6.3 Optimiser requêtes N+1

**Avant :**
```typescript
const notifications = await getNotifications();
for (const n of notifications) {
  const user = await getUser(n.user_id); // N+1 !
}
```

**Après :**
```typescript
const notifications = await getNotifications();
const userIds = notifications.map(n => n.user_id);
const users = await getUsersByIds(userIds); // 1 requête
const userMap = new Map(users.map(u => [u.id, u]));
```

**Critères de succès :**
- [ ] Plus de requêtes N+1
- [ ] Batch loading systématique

---

## INCÉMENT 7 : TESTS (Semaine 13-14)

**Objectif :** Couverture de tests complète

### 7.1 Tests unitaires

**Fichiers :**
```
src/server/notifications/__tests__/
├── notification-event-bus.test.ts
├── notification-queue.test.ts
├── email-retry-policy.test.ts
├── smtp-health-check.test.ts
├── template-engine.test.ts
└── notification-metrics.test.ts
```

**Critères de succès :**
- [ ] 80% de couverture minimum
- [ ] Tests de retry
- [ ] Tests de circuit breaker
- [ ] Tests de queue (enqueue, process, DLQ)

### 7.2 Tests d'intégration

**Fichier :** `src/server/notifications/__tests__/notification-flow.test.ts`

```typescript
describe('Notification Flow', () => {
  it('should send email with retry on SMTP failure', async () => {
    // Mock SMTP qui échoue 2 fois puis réussit
    // Vérifie que l'email est envoyé au 3ème essai
  });
  
  it('should move to DLQ after max retries', async () => {
    // Mock SMTP qui échoue toujours
    // Vérifie que l'email est en DLQ après 3 essais
  });
  
  it('should persist notification before sending', async () => {
    // Créer notification
    // Vérifier qu'elle est en queue
    // Crasher le serveur (simulé)
    // Redémarrer
    // Vérifier que l'email est envoyé
  });
});
```

**Critères de succès :**
- [ ] Tests E2E passent
- [ ] Tests de crash recovery
- [ ] Tests de charge (1000 emails)

---

## INCÉMENT 8 : CANAUX AVANCÉS (Post-MVP)

**Objectif :** Préparer l'arrivée de SMS, Push, WhatsApp

### 8.1 Créer Channel abstraction

**Fichier :** `src/server/notifications/channels/notification-channel.ts`

```typescript
export interface NotificationChannel {
  name: string;
  send(recipient: string, content: NotificationContent): Promise<SendResult>;
  isHealthy(): Promise<boolean>;
}

export class EmailChannel implements NotificationChannel {
  name = 'email';
  async send(recipient, content) { /* ... */ }
}

export class SMSChannel implements NotificationChannel {
  name = 'sms';
  async send(recipient, content) { /* ... */ }
}

export class PushChannel implements NotificationChannel {
  name = 'push';
  async send(recipient, content) { /* ... */ }
}
```

**Critères de succès :**
- [ ] Interface uniforme pour tous les canaux
- [ ] Ajout d'un canal = nouvelle classe
- [ ] Pas de modification du code métier

### 8.2 Créer ChannelRouter

**Fichier :** `src/server/notifications/channel-router.ts`

```typescript
export class ChannelRouter {
  constructor(private channels: NotificationChannel[]) {}
  
  async route(notification: Notification, recipients: Recipient[]): Promise<void> {
    const channel = this.selectChannel(recipients);
    await channel.send(recipients, notification);
  }
  
  private selectChannel(recipients: Recipient[]): NotificationChannel {
    // Logique de sélection :
    // - Si recipient.email → EmailChannel
    // - Si recipient.phone → SMSChannel
    // - Si recipient.pushToken → PushChannel
  }
}
```

**Critères de succès :**
- [ ] Routage automatique par canal
- [ ] Fallback si canal indisponible
- [ ] Priorisation des canaux

---

## PLANNING GLOBAL

```
Semaine 1-2   : Incrément 1 - Fondations (EventBus + Queue + Logging)
Semaine 3-4   : Incrément 2 - Fiabilisation (Retry + Circuit Breaker + Health Check)
Semaine 5-6   : Incrément 3 - Temps réel (loadFromServer + Realtime + WebSocket)
Semaine 7-8   : Incrément 4 - Templates (MJML + Versioning)
Semaine 9-10  : Incrément 5 - Monitoring (Métriques + Dashboard)
Semaine 11-12 : Incrément 6 - Optimisations (Pagination + Index + N+1)
Semaine 13-14 : Incrément 7 - Tests (Unitaires + Intégration + E2E)
Post-MVP     : Incrément 8 - Canaux avancés (SMS + Push + WhatsApp)
```

**Durée totale :** 14 semaines (3.5 mois)  
**Effort :** 1 développeur fullstack senior

---

## DÉPENDANCES

### Techniques
- ✅ GenericSyncService (existant)
- ✅ Outbox SQLite (existant)
- ✅ Audit Queue (existant - à réutiliser)
- ✅ Circuit Breaker (existant - à réutiliser)
- ✅ Logging Standard (existant - à réutiliser)
- ✅ Metrics Collector (existant - à réutiliser)

### Packages à ajouter
```json
{
  "bullmq": "^4.15.0",        // Queue Redis (optionnel, peut utiliser SQLite d'abord)
  "mjml": "^4.14.0",           // Templates email
  "socket.io": "^4.6.0",       // WebSocket (optionnel)
  "pino": "^8.17.0",           // Logging structuré (optionnel)
  "zod": "^3.22.0"             // Validation (si pas déjà installé)
}
```

---

## CRITÈRES DE SUCCÈS GLOBAUX

### Fonctionnels
- [ ] 100% des emails existants sont toujours envoyés
- [ ] Aucune perte d'email en cas de crash
- [ ] Retry automatique sur échec SMTP
- [ ] Notifications apparaissent en temps réel
- [ ] Badge de notifications se met à jour automatiquement

### Non-fonctionnels
- [ ] Temps d'envoi < 2s (P95)
- [ ] Disponibilité > 99.5%
- [ ] Pas de perte de données
- [ ] Logs disponibles pour debugging
- [ ] Métriques de délivrabilité accessibles

### Architecture
- [ ] Code modulaire (séparation des responsabilités)
- [ ] Tests unitaires > 80%
- [ ] Documentation à jour
- [ ] Pas de dette technique ajoutée

---

## RISQUES & MITIGATION

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| SMTP provider bloque (rate limit) | Élevé | Moyen | Circuit breaker + queue + throttle |
| Redis indisponible (si utilisé) | Moyen | Faible | Fallback SQLite |
| Templates MJML cassent le design | Moyen | Faible | Tests visuels automatisés |
| Performance dégradée | Moyen | Faible | Index + pagination + cache |
| Complexité sous-estimée | Élevé | Moyen | Incréments petits + reviews fréquentes |

---

## ALTERNATIVES & DECISIONS

### Décision 1 : Queue SQLite vs Redis
**Choix :** SQLite d'abord, Redis plus tard  
**Raison :** 
- Réutilise l'infrastructure existante
- Pas de dépendance externe
- Suffisant pour < 1000 emails/jour
- Migration vers Redis possible si besoin

### Décision 2 : Supabase Realtime vs Socket.io
**Choix :** Supabase Realtime d'abord  
**Raison :**
- Déjà en place pour d'autres features
- Pas de serveur WebSocket à maintenir
- Fallback polling si besoin

### Décision 3 : MJML vs Handlebars
**Choix :** MJML  
**Raison :**
- Meilleur pour emails responsifs
- Composants réutilisables
- Preview intégrée

---

## PROCHAINES ÉTAPES IMMÉDIATES

1. **Valider ce plan** avec l'équipe
2. **Créer la branche** `feature/notification-v3-increment-1`
3. **Commencer Incrément 1** : NotificationEventBus
4. **Setup CI/CD** : Tests automatiques sur chaque PR
5. **Review hebdomadaire** : Démo des progrès chaque vendredi

---

## CONTACTS & RESPONSABILITÉS

| Rôle | Responsabilité |
|------|----------------|
| Tech Lead | Architecture, reviews, décisions |
| Backend Dev | EventBus, Queue, SMTP, Templates |
| Frontend Dev | UI temps réel, Dashboard |
| DevOps | Monitoring, Alerting, CI/CD |
| QA | Tests, Validation |

---

## RÉFÉRENCES

- `docs/AUDIT_NOTIFICATION_SYSTEM_COMPLETE.md` : Audit détaillé
- `docs/ARCHITECTURE_NOTIFICATION_DOMAIN_V3_OFFLINE_FIRST.md` : Architecture cible
- `src/server/platform/audit-queue.service.ts` : Modèle de queue
- `src/server/platform/circuit-breaker.service.ts` : Modèle de circuit breaker
- `src/sync/core/generic-sync.service.ts` : Infrastructure Offline First