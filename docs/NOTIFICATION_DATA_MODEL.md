# NOTIFICATION DATA MODEL — EKALA

**Version:** 1.0.0  
**Date:** 29 Juin 2026  
**Statut:** OFFICIEL  
**Niveau:** Enterprise  
**Pattern:** Domain-Driven Design, Event Sourcing

---

## TABLE DES MATIÈRES

1. [Notification](#1-notification)
2. [NotificationRecipient](#2-notificationrecipient)
3. [NotificationChannel](#3-notificationchannel)
4. [NotificationPreference](#4-notificationpreference)
5. [NotificationDelivery](#5-notificationdelivery)
6. [NotificationAudit](#6-notificationaudit)
7. [NotificationAction](#7-notificationaction)
8. [NotificationAttachment](#8-notificationattachment)
9. [NotificationThread](#9-notificationthread)
10. [NotificationGroup](#10-notificationgroup)
11. [NotificationDigest](#11-notificationdigest)
12. [NotificationQueue](#12-notificationqueue)
13. [NotificationTemplate](#13-notificationtemplate)
14. [NotificationPolicy](#14-notificationpolicy)
15. [NotificationCorrelation](#15-notificationcorrelation)

---

## 1. NOTIFICATION

### 1.1 Responsabilité

**Aggregate Root** - Représente une notification complète avec toutes ses métadonnées.

### 1.2 Attributs conceptuels

**Identité:**
- notificationId: UUID (unique, immutable)
- tenantId: UUID (multi-tenant)
- correlationId: UUID (traçabilité)
- causationId: UUID (lien causal)

**Contenu:**
- title: String (100 chars max)
- message: String (500 chars max)
- body: String (2000 chars max, optionnel)
- category: Enum (System, Order, Inventory, Table, Staff, Billing, Platform)
- priority: Enum (Critical, High, Medium, Low)
- severity: Enum (Error, Warning, Info, Success)
- type: Enum (Alert, Info, Reminder, Update)

**Métadonnées:**
- source: String (service source)
- sourceId: String (ID dans service source)
- eventType: String (type d'événement métier)
- eventVersion: String (version de l'événement)
- payload: JSON (données supplémentaires)
- metadata: JSON (métadonnées système)

**Temporalité:**
- createdAt: DateTime (création)
- updatedAt: DateTime (dernière modification)
- scheduledAt: DateTime (planification, optionnel)
- expiresAt: DateTime (expiration)
- readAt: DateTime (lecture, optionnel)
- processedAt: DateTime (traitement, optionnel)
- archivedAt: DateTime (archivage, optionnel)
- deletedAt: DateTime (suppression, optionnel)

**État:**
- status: Enum (Created, Queued, Displayed, Read, Processed, Archived, Deleted, Expired, Failed, Retrying)
- read: Boolean (lu ou non)
- dismissed: Boolean (dismissed ou non)
- archived: Boolean (archivé ou non)
- deleted: Boolean (supprimé ou non)

**Comportement:**
- actionable: Boolean (actions disponibles)
- actions: Array<NotificationAction> (actions possibles)
- requiresResponse: Boolean (réponse requise)
- responseDeadline: DateTime (deadline réponse, optionnel)

**Affichage:**
- toast: Boolean (afficher en toast)
- badge: Boolean (afficher en badge)
- banner: Boolean (afficher en banner)
- center: Boolean (afficher dans center)
- push: Boolean (envoyer push)
- email: Boolean (envoyer email)
- sms: Boolean (envoyer SMS)

**Fusion:**
- merged: Boolean (fusionné ou non)
- mergedInto: UUID (ID notification parent, optionnel)
- mergedFrom: Array<UUID> (IDs notifications enfants, optionnel)
- mergeCount: Integer (nombre de notifications fusionnées)

**Localisation:**
- language: String (langue, défaut: fr)
- timezone: String (fuseau horaire)
- locale: String (locale complète)

**Sécurité:**
- sensitivity: Enum (Public, Internal, Confidential, Restricted)
- encryption: Boolean (chiffré ou non)
- audit: Boolean (audité ou non)

### 1.3 Relations

**One-to-Many:**
- Notification → NotificationRecipient (1:N)
- Notification → NotificationDelivery (1:N)
- Notification → NotificationAction (1:N)
- Notification → NotificationAttachment (1:N)
- Notification → NotificationAudit (1:N)

**Many-to-One:**
- Notification → NotificationThread (N:1, optionnel)
- Notification → NotificationGroup (N:1, optionnel)
- Notification → NotificationCorrelation (N:1)

### 1.4 Contraintes

**Unicité:**
- notificationId: unique
- (source, sourceId, tenantId): unique

**Intégrité:**
- createdAt <= updatedAt
- Si read = true → readAt != null
- Si archived = true → archivedAt != null
- Si deleted = true → deletedAt != null
- expiresAt > createdAt

**Validation:**
- title: requis, 1-100 chars
- message: requis, 1-500 chars
- category: requis, enum valide
- priority: requis, enum valide
- severity: requis, enum valide
- tenantId: requis, UUID valide

### 1.5 Cycle de vie

```
CREATED → QUEUED → DISPLAYED → READ → PROCESSED → ARCHIVED → DELETED
                ↓           ↓         ↓
              FAILED ← RETRYING ← DISMISSED
                ↓
              EXPIRED
```

**Transitions:**
- CREATED → QUEUED: Limite toasts atteinte
- CREATED → DISPLAYED: Affichage immédiat
- QUEUED → DISPLAYED: Place disponible
- DISPLAYED → READ: Clic utilisateur
- DISPLAYED → EXPIRED: Timeout
- DISPLAYED → DISMISSED: Clic X / Swipe
- READ → PROCESSED: Action utilisateur
- READ → ARCHIVED: Auto (30 jours) ou manuel
- PROCESSED → ARCHIVED: Auto
- ARCHIVED → DELETED: Auto (90 jours) ou manuel
- FAILED → RETRYING: Retry automatique
- RETRYING → DISPLAYED: Succès
- RETRYING → FAILED: Échec (3 tentatives)

---

## 2. NOTIFICATIONRECIPIENT

### 2.1 Responsabilité

**Entity** - Représente un destinataire d'une notification.

### 2.2 Attributs conceptuels

**Identité:**
- recipientId: UUID (unique)
- notificationId: UUID (FK vers Notification)
- userId: UUID (destinataire)
- tenantId: UUID (multi-tenant)

**Destinataire:**
- recipientType: Enum (User, Role, Group, Tenant)
- recipientRole: String (rôle, si recipientType = Role)
- recipientGroup: String (groupe, si recipientType = Group)

**Statut:**
- status: Enum (Pending, Delivered, Read, Failed)
- deliveredAt: DateTime (livraison, optionnel)
- readAt: DateTime (lecture, optionnel)
- failedAt: DateTime (échec, optionnel)
- failureReason: String (raison échec, optionnel)

**Préférences:**
- channels: JSON (canaux autorisés)
- quietHours: JSON (heures silence)
- digest: JSON (préférences digest)

**Métadonnées:**
- metadata: JSON (métadonnées)
- createdAt: DateTime
- updatedAt: DateTime

### 2.3 Relations

**Many-to-One:**
- NotificationRecipient → Notification (N:1)

### 2.4 Contraintes

**Unicité:**
- recipientId: unique
- (notificationId, userId): unique

**Intégrité:**
- createdAt <= updatedAt
- Si status = Delivered → deliveredAt != null
- Si status = Read → readAt != null
- Si status = Failed → failedAt != null

---

## 3. NOTIFICATIONCHANNEL

### 3.1 Responsabilité

**Entity** - Représente un canal de livraison.

### 3.2 Attributs conceptuels

**Identité:**
- channelId: UUID (unique)
- channelType: Enum (Toast, Badge, Push, Email, SMS, Webhook, Banner, Center)
- name: String (nom du canal)
- description: String (description)

**Configuration:**
- enabled: Boolean (activé ou non)
- priority: Integer (priorité, 1-10)
- config: JSON (configuration spécifique)
- credentials: JSON (credentials, chiffré)

**Capacités:**
- maxLength: Integer (longueur max)
- supportsRichText: Boolean (rich text)
- supportsImages: Boolean (images)
- supportsActions: Boolean (actions)
- supportsDeepLink: Boolean (deep link)

**Limites:**
- rateLimit: Integer (limite par heure)
- batchSize: Integer (taille batch)
- retryCount: Integer (nombre retry)
- retryDelay: Integer (délai retry en ms)

**Métadonnées:**
- metadata: JSON (métadonnées)
- createdAt: DateTime
- updatedAt: DateTime

### 3.3 Relations

**One-to-Many:**
- NotificationChannel → NotificationDelivery (1:N)

### 3.4 Contraintes

**Unicité:**
- channelId: unique
- channelType: unique

**Intégrité:**
- priority >= 1
- priority <= 10
- rateLimit >= 0
- batchSize >= 1
- retryCount >= 0
- retryDelay >= 0

---

## 4. NOTIFICATIONPREFERENCE

### 4.1 Responsabilité

**Entity** - Représente les préférences de notification d'un utilisateur.

### 4.2 Attributs conceptuels

**Identité:**
- preferenceId: UUID (unique)
- userId: UUID (utilisateur)
- tenantId: UUID (multi-tenant)

**Canaux:**
- channels: JSON
  - toast: Boolean
  - badge: Boolean
  - push: Boolean
  - email: Boolean
  - sms: Boolean
  - webhook: Boolean

**Catégories:**
- categories: JSON
  - system: Boolean
  - order: Boolean
  - inventory: Boolean
  - table: Boolean
  - staff: Boolean
  - billing: Boolean
  - platform: Boolean

**Priorités:**
- priorities: JSON
  - critical: Boolean
  - high: Boolean
  - medium: Boolean
  - low: Boolean

**Quiet Hours:**
- quietHours: JSON
  - enabled: Boolean
  - start: Time
  - end: Time
  - timezone: String
  - exceptions: Array<String> (eventTypes autorisés)

**Digest:**
- digest: JSON
  - enabled: Boolean
  - frequency: Enum (None, Daily, Weekly, Monthly)
  - time: Time
  - timezone: String
  - email: String (email destinataire)

**Localisation:**
- language: String (langue préférée)
- timezone: String (fuseau horaire)

**Héritage:**
- inheritedFrom: Enum (User, Role, Tenant, Global)
- overrides: JSON (overrides)

**Métadonnées:**
- metadata: JSON
- createdAt: DateTime
- updatedAt: DateTime

### 4.3 Relations

**Many-to-One:**
- NotificationPreference → User (N:1)
- NotificationPreference → Tenant (N:1)

### 4.4 Contraintes

**Unicité:**
- preferenceId: unique
- (userId, tenantId): unique

**Intégrité:**
- Si quietHours.enabled = true → start != null && end != null
- Si digest.enabled = true → frequency != null && time != null

---

## 5. NOTIFICATIONDELIVERY

### 5.1 Responsabilité

**Entity** - Représente une tentative de livraison.

### 5.2 Attributs conceptuels

**Identité:**
- deliveryId: UUID (unique)
- notificationId: UUID (FK vers Notification)
- recipientId: UUID (FK vers NotificationRecipient)
- channelId: UUID (FK vers NotificationChannel)

**Livraison:**
- status: Enum (Pending, Delivered, Failed, Retrying, Cancelled)
- attempt: Integer (numéro de tentative)
- maxAttempts: Integer (max tentatives)
- deliveredAt: DateTime (livraison, optionnel)
- failedAt: DateTime (échec, optionnel)

**Erreur:**
- errorCode: String (code erreur, optionnel)
- errorMessage: String (message erreur, optionnel)
- errorDetails: JSON (détails erreur, optionnel)

**Retry:**
- retryCount: Integer (nombre retry)
- retryDelay: Integer (délai retry en ms)
- nextRetryAt: DateTime (prochain retry, optionnel)
- retryStrategy: Enum (Linear, Exponential, Fixed)

**Métadonnées:**
- metadata: JSON (métadonnées)
- createdAt: DateTime
- updatedAt: DateTime

### 5.3 Relations

**Many-to-One:**
- NotificationDelivery → Notification (N:1)
- NotificationDelivery → NotificationRecipient (N:1)
- NotificationDelivery → NotificationChannel (N:1)

### 5.4 Contraintes

**Unicité:**
- deliveryId: unique

**Intégrité:**
- attempt >= 1
- attempt <= maxAttempts
- retryCount >= 0
- retryCount < maxAttempts
- Si status = Delivered → deliveredAt != null
- Si status = Failed → failedAt != null

---

## 6. NOTIFICATIONAUDIT

### 6.1 Responsabilité

**Entity** - Représente une entrée d'audit pour traçabilité.

### 6.2 Attributs conceptuels

**Identité:**
- auditId: UUID (unique)
- notificationId: UUID (FK vers Notification)
- userId: UUID (utilisateur)
- tenantId: UUID (multi-tenant)

**Action:**
- action: Enum (Created, Read, Updated, Deleted, Delivered, Failed, Action)
- actionAt: DateTime (date action)
- actionBy: String (qui a effectué l'action)
- actionDetails: JSON (détails action)

**Contexte:**
- ipAddress: String (IP, optionnel)
- userAgent: String (user agent, optionnel)
- device: String (device, optionnel)
- location: String (localisation, optionnel)

**Métadonnées:**
- metadata: JSON (métadonnées)
- createdAt: DateTime

### 6.3 Relations

**Many-to-One:**
- NotificationAudit → Notification (N:1)

### 6.4 Contraintes

**Unicité:**
- auditId: unique

**Intégrité:**
- action: enum valide
- actionAt != null

---

## 7. NOTIFICATIONACTION

### 7.1 Responsabilité

**Entity** - Représente une action disponible sur une notification.

### 7.2 Attributs conceptuels

**Identité:**
- actionId: UUID (unique)
- notificationId: UUID (FK vers Notification)

**Action:**
- type: Enum (Primary, Secondary, Destructive)
- label: String (label, 50 chars max)
- icon: String (icône, optionnel)
- description: String (description, optionnel)

**Comportement:**
- action: String (action à exécuter)
- payload: JSON (données action)
- confirmation: Boolean (confirmation requise)
- confirmationMessage: String (message confirmation, optionnel)

**Affichage:**
- order: Integer (ordre affichage)
- visible: Boolean (visible ou non)
- enabled: Boolean (activé ou non)

**Métadonnées:**
- metadata: JSON
- createdAt: DateTime

### 7.3 Relations

**Many-to-One:**
- NotificationAction → Notification (N:1)

### 7.4 Contraintes

**Unicité:**
- actionId: unique

**Intégrité:**
- type: enum valide
- label: requis, 1-50 chars
- action: requis
- order >= 0

---

## 8. NOTIFICATIONATTACHMENT

### 8.1 Responsabilité

**Entity** - Représente une pièce jointe à une notification.

### 8.2 Attributs conceptuels

**Identité:**
- attachmentId: UUID (unique)
- notificationId: UUID (FK vers Notification)

**Fichier:**
- filename: String (nom fichier)
- mimeType: String (type MIME)
- size: Integer (taille en bytes)
- url: String (URL fichier)
- thumbnailUrl: String (URL thumbnail, optionnel)

**Métadonnées:**
- metadata: JSON
- createdAt: DateTime

### 8.3 Relations

**Many-to-One:**
- NotificationAttachment → Notification (N:1)

### 8.4 Contraintes

**Unicité:**
- attachmentId: unique

**Intégrité:**
- filename: requis
- mimeType: requis
- size > 0
- url: requis

---

## 9. NOTIFICATIONTHREAD

### 9.1 Responsabilité

**Aggregate** - Représente un fil de discussion de notifications.

### 9.2 Attributs conceptuels

**Identité:**
- threadId: UUID (unique)
- tenantId: UUID (multi-tenant)
- subject: String (sujet, 200 chars max)

**Participants:**
- participants: Array<UUID> (user IDs)
- createdBy: UUID (créateur)

**État:**
- status: Enum (Active, Closed, Archived)
- lastMessageAt: DateTime (dernier message)
- messageCount: Integer (nombre messages)

**Métadonnées:**
- metadata: JSON
- createdAt: DateTime
- updatedAt: DateTime
- archivedAt: DateTime (optionnel)

### 9.3 Relations

**One-to-Many:**
- NotificationThread → Notification (1:N)

### 9.4 Contraintes

**Unicité:**
- threadId: unique

**Intégrité:**
- subject: requis, 1-200 chars
- participants: non vide
- messageCount >= 0

---

## 10. NOTIFICATIONGROUP

### 10.1 Responsabilité

**Aggregate** - Représente un groupe de notifications fusionnées.

### 10.2 Attributs conceptuels

**Identité:**
- groupId: UUID (unique)
- tenantId: UUID (multi-tenant)

**Groupe:**
- title: String (titre groupe)
- category: Enum (catégorie)
- priority: Enum (priorité)
- notifications: Array<UUID> (IDs notifications)
- count: Integer (nombre notifications)

**Fusion:**
- mergedAt: DateTime (date fusion)
- mergedBy: String (qui a fusionné: System/User)
- mergeReason: String (raison fusion)

**Métadonnées:**
- metadata: JSON
- createdAt: DateTime
- updatedAt: DateTime

### 10.3 Relations

**One-to-Many:**
- NotificationGroup → Notification (1:N)

### 10.4 Contraintes

**Unicité:**
- groupId: unique

**Intégrité:**
- title: requis
- count > 0
- notifications: non vide

---

## 11. NOTIFICATIONDIGEST

### 11.1 Responsabilité

**Aggregate** - Représente un digest de notifications.

### 11.2 Attributs conceptuels

**Identité:**
- digestId: UUID (unique)
- tenantId: UUID (multi-tenant)
- userId: UUID (destinataire)

**Digest:**
- type: Enum (Daily, Weekly, Monthly)
- period: String (période: "2026-06-29")
- notifications: Array<UUID> (IDs notifications)
- count: Integer (nombre notifications)

**Génération:**
- generatedAt: DateTime (génération)
- sentAt: DateTime (envoi, optionnel)
- generatedBy: String (générateur: System/Scheduled)

**Contenu:**
- summary: String (résumé)
- categories: JSON (par catégorie)
- priorities: JSON (par priorité)

**Métadonnées:**
- metadata: JSON
- createdAt: DateTime

### 11.3 Relations

**One-to-Many:**
- NotificationDigest → Notification (1:N)

### 11.4 Contraintes

**Unicité:**
- digestId: unique

**Intégrité:**
- type: enum valide
- period: requis
- count >= 0

---

## 12. NOTIFICATIONQUEUE

### 12.1 Responsabilité

**Entity** - Représente une file d'attente de notifications.

### 12.2 Attributs conceptuels

**Identité:**
- queueId: UUID (unique)
- tenantId: UUID (multi-tenant)
- name: String (nom queue)

**File:**
- notifications: Array<UUID> (IDs notifications en queue)
- position: Integer (position dans queue)
- priority: Enum (Critical, High, Medium, Low)
- status: Enum (Pending, Processing, Completed, Failed)

**Traitement:**
- scheduledAt: DateTime (planification)
- startedAt: DateTime (début traitement, optionnel)
- completedAt: DateTime (fin traitement, optionnel)
- failedAt: DateTime (échec, optionnel)

**Erreur:**
- errorCode: String (code erreur, optionnel)
- errorMessage: String (message erreur, optionnel)

**Métadonnées:**
- metadata: JSON
- createdAt: DateTime
- updatedAt: DateTime

### 12.3 Relations

**One-to-Many:**
- NotificationQueue → Notification (1:N)

### 12.4 Contraintes

**Unicité:**
- queueId: unique

**Intégrité:**
- name: requis
- position >= 0
- priority: enum valide
- status: enum valide

---

## 13. NOTIFICATIONTEMPLATE

### 13.1 Responsabilité

**Entity** - Représente un template de notification.

### 13.2 Attributs conceptuels

**Identité:**
- templateId: UUID (unique)
- tenantId: UUID (multi-tenant)
- name: String (nom template)
- description: String (description)

**Template:**
- eventType: String (type d'événement)
- category: Enum (catégorie)
- priority: Enum (priorité)
- severity: Enum (sévérité)

**Contenu:**
- titleTemplate: String (template titre)
- messageTemplate: String (template message)
- bodyTemplate: String (template body, optionnel)
- variables: Array<String> (variables disponibles)

**Canaux:**
- channels: JSON (canaux autorisés)
- channelTemplates: JSON (templates par canal)

**Actions:**
- actions: JSON (actions par défaut)

**Localisation:**
- language: String (langue)
- translations: JSON (traductions)

**Métadonnées:**
- metadata: JSON
- createdAt: DateTime
- updatedAt: DateTime

### 13.3 Relations

**One-to-Many:**
- NotificationTemplate → Notification (1:N)

### 13.4 Contraintes

**Unicité:**
- templateId: unique
- (tenantId, eventType, language): unique

**Intégrité:**
- name: requis
- eventType: requis
- titleTemplate: requis
- messageTemplate: requis

---

## 14. NOTIFICATIONPOLICY

### 14.1 Responsabilité

**Entity** - Représente une politique de notification.

### 14.2 Attributs conceptuels

**Identité:**
- policyId: UUID (unique)
- tenantId: UUID (multi-tenant)
- name: String (nom politique)
- description: String (description)

**Politique:**
- type: Enum (Role, Preference, AntiSpam, Business, Delivery)
- priority: Integer (priorité, 1-100)
- enabled: Boolean (activé ou non)

**Règles:**
- conditions: JSON (conditions)
- actions: JSON (actions)
- transformations: JSON (transformations)

**Contexte:**
- roles: Array<String> (rôles concernés)
- categories: Array<String> (catégories concernées)
- priorities: Array<String> (priorités concernées)
- eventTypes: Array<String> (types d'événements)

**Ordonnancement:**
- order: Integer (ordre d'évaluation)
- stopOnMatch: Boolean (arrêter si match)

**Métadonnées:**
- metadata: JSON
- createdAt: DateTime
- updatedAt: DateTime
- version: String (version)

### 14.3 Relations

**One-to-Many:**
- NotificationPolicy → Notification (1:N)

### 14.4 Contraintes

**Unicité:**
- policyId: unique

**Intégrité:**
- name: requis
- type: enum valide
- priority >= 1
- priority <= 100
- order >= 0

---

## 15. NOTIFICATIONCORRELATION

### 15.1 Responsabilité

**Entity** - Représente une corrélation entre notifications.

### 15.2 Attributs conceptuels

**Identité:**
- correlationId: UUID (unique)
- tenantId: UUID (multi-tenant)

**Corrélation:**
- type: Enum (Merge, Duplicate, Related, Escalation)
- notifications: Array<UUID> (IDs notifications)
- primaryNotificationId: UUID (notification principale, optionnel)

**Métadonnées:**
- reason: String (raison corrélation)
- confidence: Float (confiance, 0-1)
- metadata: JSON
- createdAt: DateTime

### 15.3 Relations

**One-to-Many:**
- NotificationCorrelation → Notification (1:N)

### 15.4 Contraintes

**Unicité:**
- correlationId: unique

**Intégrité:**
- type: enum valide
- notifications: non vide
- confidence >= 0
- confidence <= 1

---

## CONCLUSION

Ce Data Model définit tous les concepts du système de notifications.

**Caractéristiques:**
- ✅ Conceptuel (pas de code)
- ✅ Framework agnostic
- ✅ DDD compliant
- ✅ Event Sourcing ready
- ✅ Multi-tenant
- ✅ Auditabilité

**Prochaine étape:**
Créer le plan d'implémentation.

---

**FIN DU DOCUMENT**

*Ce document fait partie du Notification Design System officiel d'Ekala.*