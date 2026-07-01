# NOTIFICATION DOMAIN MODEL  
**Version :** 1.0  
**Date :** 29/06/2026  
**Scope :** Modèle de domaine complet du système de notifications  
**Règle :** Aucun code, uniquement modèles et spécifications

---

## 1. AGRÉGATS

### 1.1 Notification (Aggregate Root)

**Responsabilité :** Représente une notification individuelle destinée à un utilisateur.

**Invariants :**
- Une notification doit avoir exactement un destinataire
- Une notification doit avoir un type et une catégorie valides
- Une notification ne peut pas être modifiée après création (immutable)
- Le statut évolue selon une machine à états définie
- Une notification supprimée n'est jamais physiquement supprimée (soft delete)

**Entités enfants :**
- NotificationDelivery (0..*)
- NotificationPreference (0..1, référence)

**Événements émis :**
- NotificationCreated
- NotificationRead
- NotificationArchived
- NotificationDeleted

---

### 1.2 NotificationTemplate (Aggregate Root)

**Responsabilité :** Gère les templates de notifications avec variables dynamiques.

**Invariants :**
- Un template doit avoir un canal associé (email, sms, whatsapp, in_app)
- Les variables du template doivent être déclarées dans le schema
- Un template actif ne peut pas être supprimé, seulement archivé
- Le contenu doit passer la validation avant activation

**Entités enfants :**
- TemplateVariable (0..*)

**Événements émis :**
- TemplateCreated
- TemplateUpdated
- TemplateActivated
- TemplateArchived

---

### 1.3 NotificationPreference (Aggregate Root)

**Responsabilité :** Gère les préférences de notification par utilisateur et par catégorie.

**Invariants :**
- Un utilisateur a exactement une préférence par catégorie
- Les préférences sont héritées des rôles si non définies explicitement
- Les préférences système (security, billing) ne peuvent pas être désactivées

**Entités enfants :**
- PreferenceChannel (0..*)

**Événements émis :**
- PreferenceUpdated
- PreferenceReset

---

### 1.4 NotificationOutbox (Aggregate Root)

**Responsabilité :** Gère la file d'attente des notifications en attente d'envoi.

**Invariants :**
- Une notification ne peut être dans l'outbox qu'une seule fois
- Les notifications sont ordonnées par priorité puis par date de création
- Une notification en échec est réessayée selon une politique de backoff exponentiel
- L'outbox est vidée par lot (batch) pour optimiser les performances

**Entités enfants :**
- OutboxItem (0..*)

**Événements émis :**
- OutboxItemQueued
- OutboxItemProcessing
- OutboxItemSent
- OutboxItemFailed

---

## 2. ENTITÉS

### 2.1 NotificationDelivery

**Attributs :**
- id: UUID
- notificationId: UUID (référence à Notification)
- channel: ChannelType (email, sms, whatsapp, in_app, push)
- status: DeliveryStatus
- recipient: string (email, phone, userId)
- sentAt: DateTime?
- deliveredAt: DateTime?
- readAt: DateTime?
- error: string?
- retryCount: number
- createdAt: DateTime
- updatedAt: DateTime

**Invariants :**
- Une livraison ne peut pas être modifiée après être marquée comme delivered
- Le nombre de tentatives est limité à 3 par canal
- En cas d'échec, le canal suivant est tenté selon la politique de fallback

---

### 2.2 TemplateVariable

**Attributs :**
- name: string
- type: VariableType (string, number, date, boolean)
- required: boolean
- defaultValue: string?
- description: string

**Invariants :**
- Le nom doit être unique dans le template
- Les variables requises doivent être fournies lors de l'envoi

---

### 2.3 PreferenceChannel

**Attributs :**
- channel: ChannelType
- enabled: boolean
- frequency: Frequency (instant, daily_digest, weekly_digest)

**Invariants :**
- Les canaux système (security) ne peuvent pas être désactivés
- La fréquence ne s'applique qu'aux canaux asynchrones (email)

---

### 2.4 OutboxItem

**Attributs :**
- id: UUID
- notificationId: UUID
- priority: number (1-10, 10 = highest)
- attempts: number
- maxAttempts: number
- nextRetryAt: DateTime?
- error: string?
- payload: JSON
- createdAt: DateTime
- processedAt: DateTime?

**Invariants :**
- La priorité est calculée selon la catégorie et l'âge de la notification
- Le backoff est exponentiel : 1min, 5min, 15min
- Après maxAttempts, l'item est marqué comme dead-letter

---

## 3. VALUE OBJECTS

### 3.1 NotificationId

**Type :** UUID  
**Règles :**
- Généré par le système (ULID pour tri chronologique)
- Ne change jamais
- Unique globalement

---

### 3.2 NotificationType

**Type :** Enum  
**Valeurs :**
- INFO
- WARNING
- ERROR
- SUCCESS
- ALERT

**Règles :**
- Détermine la priorité et le canal par défaut
- Ne peut pas être modifié après création

---

### 3.3 NotificationCategory

**Type :** Enum  
**Valeurs :**
- SYSTEM (sécurité, maintenance)
- BUSINESS (ventes, inventaire)
- BILLING (factures, abonnements)
- PLATFORM (nouveautés, promotions)
- CUSTOM (défini par l'utilisateur)

**Règles :**
- Détermine les préférences applicables
- Les catégories SYSTEM ne peuvent être désactivées

---

### 3.4 ChannelType

**Type :** Enum  
**Valeurs :**
- EMAIL
- SMS
- WHATSAPP
- IN_APP
- PUSH

**Règles :**
- Chaque canal a un provider associé
- Les canaux sont essayés dans l'ordre de préférence de l'utilisateur

---

### 3.5 DeliveryStatus

**Type :** Enum  
**Valeurs :**
- PENDING
- QUEUED
- SENDING
- SENT
- DELIVERED
- READ
- FAILED
- CANCELLED

**Règles :**
- Machine à états avec transitions autorisées
- Une fois DELIVERED, pas de retour en arrière

---

### 3.6 Frequency

**Type :** Enum  
**Valeurs :**
- INSTANT
- DAILY_DIGEST
- WEEKLY_DIGEST

**Règles :**
- INSTANT : envoi immédiat
- DAILY_DIGEST : regroupement à 8h du matin
- WEEKLY_DIGEST : regroupement le lundi à 8h

---

### 3.7 VariableType

**Type :** Enum  
**Valeurs :**
- STRING
- NUMBER
- DATE
- BOOLEAN
- URL

**Règles :**
- Détermine le formatage de la variable dans le template
- La validation est effectuée selon le type

---

### 3.8 Recipient

**Type :** Value Object  
**Attributs :**
- userId: UUID
- email: Email?
- phone: Phone?
- channels: ChannelType[]

**Règles :**
- Au moins un canal de contact doit être fourni
- Les canaux sont triés par préférence utilisateur
- Le recipient est résolu au moment de la création de la notification

---

## 4. MACHINES À ÉTATS

### 4.1 Notification Lifecycle

```
┌─────────┐
│ CREATED │
└────┬────┘
     │
     ▼
┌─────────┐
│ QUEUED  │ ← Notification ajoutée à l'outbox
└────┬────┘
     │
     ▼
┌──────────┐
│ SENDING  │ ← Traitement par le dispatcher
└────┬─────┘
     │
     ├──────────────────┐
     │                  │
     ▼                  ▼
┌──────────┐    ┌──────────┐
│ SENT     │    │ FAILED   │ ← Réessai automatique (max 3x)
└────┬─────┘    └────┬─────┘
     │               │
     ▼               │
┌──────────┐         │
│DELIVERED │         │
└────┬─────┘         │
     │               │
     ├───────────────┘
     │
     ▼
┌──────────┐
│   READ   │ ← Utilisateur a lu la notification
└────┬─────┘
     │
     ▼
┌──────────┐
│ARCHIVED  │ ← Archivée par l'utilisateur ou automatiquement
└────┬─────┘
     │
     ▼
┌──────────┐
│ DELETED  │ ← Suppression logique (soft delete)
└──────────┘
```

**Transitions autorisées :**
- CREATED → QUEUED (automatique)
- QUEUED → SENDING (par le dispatcher)
- SENDING → SENT (succès d'envoi)
- SENDING → FAILED (erreur d'envoi)
- FAILED → SENDING (réessai, max 3 fois)
- SENT → DELIVERED (confirmation de livraison)
- DELIVERED → READ (utilisateur ouvre la notification)
- DELIVERED → ARCHIVED (auto après 30 jours)
- READ → ARCHIVED (utilisateur archive)
- ARCHIVED → DELETED (suppression définitive)
- Tout état → DELETED (suppression à tout moment)

---

### 4.2 NotificationDelivery Lifecycle

```
┌─────────┐
│ PENDING │
└────┬────┘
     │
     ▼
┌──────────┐
│ QUEUED   │ ← Ajoutée à la queue du canal
└────┬─────┘
     │
     ▼
┌──────────┐
│ SENDING  │ ← Envoi en cours
└────┬─────┘
     │
     ├──────────────────┐
     │                  │
     ▼                  ▼
┌──────────┐    ┌──────────┐
│  SENT    │    │  FAILED  │
└────┬─────┘    └────┬─────┘
     │               │
     ▼               │
┌──────────┐         │
│DELIVERED │         │
└────┬─────┘         │
     │               │
     ▼               │
┌──────────┐         │
│   READ   │         │
└──────────┘         │
                     │
                     ▼
              ┌──────────┐
              │ DEAD_LETTER │ ← Après 3 échecs
              └──────────┘
```

---

### 4.3 NotificationTemplate Lifecycle

```
┌─────────┐
│ DRAFT   │ ← Création/modification
└────┬────┘
     │
     ▼
┌──────────┐
│ PENDING  │ ← Soumis pour validation
└────┬─────┘
     │
     ├──────────────────┐
     │                  │
     ▼                  ▼
┌──────────┐    ┌──────────┐
│  ACTIVE  │    │ REJECTED │ ← Validation échouée
└────┬─────┘    └────┬─────┘
     │               │
     │               ▼
     │          ┌──────────┐
     │          │  DRAFT   │ ← Correction et resoumission
     │          └──────────┘
     │
     ▼
┌──────────┐
│ARCHIVED  │ ← Désactivation (conservé pour historique)
└──────────┘
```

---

## 5. REPOSITORIES

### 5.1 INotificationRepository

**Méthodes :**
- findById(id: NotificationId): Promise<Notification | null>
- findByRecipient(recipientId: UUID, limit: number, offset: number): Promise<Notification[]>
- findByStatus(status: DeliveryStatus): Promise<Notification[]>
- findByCategory(category: NotificationCategory): Promise<Notification[]>
- findUnreadByRecipient(recipientId: UUID): Promise<Notification[]>
- save(notification: Notification): Promise<void>
- delete(id: NotificationId): Promise<void> (soft delete)
- countUnread(recipientId: UUID): Promise<number>

---

### 5.2 INotificationTemplateRepository

**Méthodes :**
- findById(id: UUID): Promise<NotificationTemplate | null>
- findByChannel(channel: ChannelType): Promise<NotificationTemplate[]>
- findActiveByType(type: NotificationType): Promise<NotificationTemplate | null>
- findByEvent(event: string): Promise<NotificationTemplate | null>
- save(template: NotificationTemplate): Promise<void>
- archive(id: UUID): Promise<void>

---

### 5.3 INotificationPreferenceRepository

**Méthodes :**
- findByUserId(userId: UUID): Promise<NotificationPreference | null>
- findByUserIdAndCategory(userId: UUID, category: NotificationCategory): Promise<PreferenceChannel[]>
- save(preference: NotificationPreference): Promise<void>
- resetToDefaults(userId: UUID): Promise<void>

---

### 5.4 INotificationOutboxRepository

**Méthodes :**
- enqueue(item: OutboxItem): Promise<void>
- dequeue(limit: number): Promise<OutboxItem[]>
- markAsProcessed(id: UUID): Promise<void>
- markAsFailed(id: UUID, error: string): Promise<void>
- findDeadLetters(): Promise<OutboxItem[]>
- requeue(id: UUID): Promise<void>
- countPending(): Promise<number>

---

## 6. SERVICES

### 6.1 NotificationService (Application Service)

**Responsabilité :** Orchestre la création et la gestion des notifications.

**Méthodes :**
- create(event: DomainEvent, recipient: Recipient): Promise<Notification>
- markAsRead(id: NotificationId, userId: UUID): Promise<void>
- archive(id: NotificationId, userId: UUID): Promise<void>
- delete(id: NotificationId, userId: UUID): Promise<void>
- getUnreadCount(userId: UUID): Promise<number>
- getNotifications(userId: UUID, filters: NotificationFilters): Promise<PaginatedResult<Notification>>

---

### 6.2 NotificationDispatcher (Domain Service)

**Responsabilité :** Distribue les notifications aux canaux appropriés.

**Méthodes :**
- dispatch(notification: Notification): Promise<NotificationDelivery[]>
- selectChannels(notification: Notification, preferences: NotificationPreference): ChannelType[]
- applyFallbackStrategy(notification: Notification, failedDeliveries: NotificationDelivery[]): Promise<NotificationDelivery[]>

---

### 6.3 RecipientResolver (Domain Service)

**Responsabilité :** Résout le destinataire d'une notification à partir d'un événement.

**Méthodes :**
- resolve(event: DomainEvent): Promise<Recipient>
- resolveByUserId(userId: UUID): Promise<Recipient>
- resolveByRole(role: string): Promise<Recipient[]>
- resolveByTenant(tenantId: UUID): Promise<Recipient[]>

---

### 6.4 TemplateEngine (Domain Service)

**Responsabilité :** Applique les templates aux notifications.

**Méthodes :**
- render(template: NotificationTemplate, data: Record<string, any>): RenderedTemplate
- validate(template: NotificationTemplate, data: Record<string, any>): ValidationResult
- compile(template: NotificationTemplate): CompiledTemplate

---

### 6.5 PreferenceEngine (Domain Service)

**Responsabilité :** Applique les préférences utilisateur aux notifications.

**Méthodes :**
- shouldSend(notification: Notification, preferences: NotificationPreference): boolean
- getChannels(notification: Notification, preferences: NotificationPreference): ChannelType[]
- getFrequency(notification: Notification, preferences: NotificationPreference): Frequency

---

## 7. ÉVÉNEMENTS DOMAINE

### 7.1 NotificationCreated

**Payload :**
- notificationId: NotificationId
- type: NotificationType
- category: NotificationCategory
- recipientId: UUID
- title: string
- content: string
- data: JSON
- channels: ChannelType[]

---

### 7.2 NotificationRead

**Payload :**
- notificationId: NotificationId
- userId: UUID
- readAt: DateTime

---

### 7.3 NotificationArchived

**Payload :**
- notificationId: NotificationId
- userId: UUID
- archivedAt: DateTime

---

### 7.4 NotificationDeleted

**Payload :**
- notificationId: NotificationId
- userId: UUID
- deletedAt: DateTime

---

### 7.5 OutboxItemQueued

**Payload :**
- outboxItemId: UUID
- notificationId: NotificationId
- priority: number
- queuedAt: DateTime

---

### 7.6 OutboxItemSent

**Payload :**
- outboxItemId: UUID
- notificationId: NotificationId
- channel: ChannelType
- sentAt: DateTime

---

### 7.7 OutboxItemFailed

**Payload :**
- outboxItemId: UUID
- notificationId: NotificationId
- channel: ChannelType
- error: string
- attemptNumber: number
- failedAt: DateTime

---

## 8. POLITIQUES

### 8.1 Politique de priorité

**Règles :**
- ERROR/ALERT : priorité 10
- WARNING : priorité 7
- SUCCESS : priorité 5
- INFO : priorité 3

**Ajustements :**
- +2 si l'utilisateur est en ligne
- +1 si la notification est ancienne (> 1h)
- -3 si la catégorie est PLATFORM

---

### 8.2 Politique de fallback

**Règles :**
- Si EMAIL échoue → tenter IN_APP
- Si SMS échoue → tenter EMAIL
- Si WHATSAPP échoue → tenter SMS
- Si tous les canaux échouent → marquer comme FAILED et notifier l'admin

---

### 8.3 Politique de rétention

**Règles :**
- Notifications lues : 90 jours
- Notifications archivées : 30 jours
- Notifications non lues : illimité
- Notifications supprimées : 7 jours (corbeille)

---

## 9. CONTRATS D'INTERFACE

### 9.1 INotificationChannel (Provider Interface)

```typescript
interface INotificationChannel {
  readonly channelType: ChannelType;
  
  send(delivery: NotificationDelivery): Promise<DeliveryResult>;
  validate(recipient: Recipient): Promise<boolean>;
  getCapabilities(): ChannelCapabilities;
}

interface DeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  metadata?: JSON;
}

interface ChannelCapabilities {
  supportsAttachments: boolean;
  maxLength: number;
  supportsTracking: boolean;
  supportsScheduling: boolean;
}
```

---

### 9.2 INotificationEventBus

```typescript
interface INotificationEventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}
```

---

### 9.3 INotificationOutboxProcessor

```typescript
interface INotificationOutboxProcessor {
  start(): void;
  stop(): void;
  processBatch(batchSize: number): Promise<ProcessingResult>;
  getStats(): OutboxStats;
}

interface ProcessingResult {
  processed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}
```

---

## 10. EXEMPLES D'UTILISATION

### 10.1 Création d'une notification

```
1. EventBus publie "ProductCreated"
2. NotificationEventHandler reçoit l'événement
3. RecipientResolver résout le destinataire (owner du tenant)
4. NotificationService crée l'agrégat Notification
5. PreferenceEngine vérifie les préférences
6. NotificationDispatcher sélectionne les canaux
7. Pour chaque canal :
   - TemplateEngine rend le template
   - NotificationDelivery est créé
   - OutboxItem est ajouté à la queue
8. Notification est sauvegardée (status = QUEUED)
```

### 10.2 Traitement de l'outbox

```
1. OutboxProcessor démarre (batch toutes les 10s)
2. Récupère les items par priorité décroissante
3. Pour chaque item :
   - Marque comme PROCESSING
   - Appelle le channel provider
   - Si succès → marque comme SENT
   - Si échec → incrémente attempts
   - Si attempts < max → replanifie avec backoff
   - Si attempts == max → marque comme DEAD_LETTER
4. Publie OutboxItemSent ou OutboxItemFailed
```

### 10.3 Lecture par l'utilisateur

```
1. User ouvre le NotificationCenter
2. Frontend appelle GET /notifications?unread=true
3. API récupère les notifications non lues
4. User clique sur une notification
5. Frontend appelle POST /notifications/{id}/read
6. NotificationService.markAsRead()
7. Notification passe à READ
8. Event NotificationRead est publié
9. WebSocket notifie les autres onglets
```

---

## 11. RÈGLES MÉTIER

### 11.1 Règles de déduplication

- Une notification est considérée comme doublon si :
  - Même recipient + même type + même catégorie + même data hash
  - Créée dans les 5 dernières minutes
- Les doublons sont fusionnés (compteur +1)

### 11.2 Règles de throttling

- Maximum 10 notifications par minute par utilisateur
- Maximum 50 notifications par jour par utilisateur
- Les notifications SYSTEM ne sont pas limitées

### 11.3 Règles de confidentialité

- Les notifications ne peuvent pas contenir de données sensibles non chiffrées
- Le contenu des emails est stocké en clair (pour recherche)
- Le contenu des SMS/WhatsApp n'est pas stocké
- Les pièces jointes sont chiffrées au repos

---

## 12. QUESTIONS OUVERTES

1. **Faut-il implémenter un système de "snooze" pour les notifications ?**
   - Pro : Permet de reporter une notification
   - Con : Complexifie le modèle
   - Décision : À valider avec le produit

2. **Faut-il permettre les notifications récurrentes ?**
   - Pro : Utile pour les rappels
   - Con : Nécessite un scheduler dédié
   - Décision : Reporter en v2

3. **Faut-il implémenter un système de "réaction" aux notifications ?**
   - Pro : Engagement utilisateur
   - Con : Ajoute de la complexité
   - Décision : Non, se concentrer sur le core

4. **Faut-il stocker les templates dans la base de données ou dans des fichiers ?**
   - DB : Édition dynamique, pas de déploiement
   - Fichiers : Versioning Git, review par PR
   - Décision : DB pour les templates dynamiques, fichiers pour les templates système

---

*Fin du document*