# NOTIFICATION POLICY ENGINE — EKALA

**Version:** 1.0.0  
**Date:** 29 Juin 2026  
**Statut:** OFFICIEL  
**Niveau:** Enterprise

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble](#1-vue-densemble)
2. [Matrice rôle → événement](#2-matrice-rôle--événement)
3. [Matrice événement → canal](#3-matrice-événement--canal)
4. [Préférences utilisateur](#4-préférences-utilisateur)
5. [Quiet Hours](#5-quiet-hours)
6. [Digest](#6-digest)
7. [Rate Limiting](#7-rate-limiting)
8. [Cooldown](#8-cooldown)
9. [Batching](#9-batching)
10. [Escalade](#10-escalade)
11. [SLA](#11-sla)
12. [Fallback](#12-fallback)
13. [Héritage des préférences](#13-héritage-des-préférences)
14. [Résolution des conflits](#14-résolution-des-conflits)
15. [Règles multi-tenant](#15-règles-multi-tenant)
16. [Règles offline](#16-règles-offline)
17. [Règles realtime](#17-règles-realtime)
18. [Gouvernance](#18-gouvernance)

---

## 1. VUE D'ENSEMBLE

### 1.1 Philosophie

**Principe:** Centraliser toutes les règles de décision dans un moteur de politique unique.

**Objectifs:**
- Cohérence des décisions
- Maintenabilité
- Flexibilité
- Auditabilité

### 1.2 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Policy Engine                             │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Input     │→│   Context   │→│   Rules     │        │
│  │  (Event)    │  │  (User/Role)│  │  (Policies) │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Output    │←│   Decision  │←│   Engine    │        │
│  │ (Action)    │  │  (Allow/Deny)│  │  (Evaluator)│        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Composants

**Policy Repository:**
- Stocke toutes les politiques
- Versioning des politiques
- Cache des politiques actives

**Context Resolver:**
- Résout le contexte utilisateur
- Résout le contexte tenant
- Résout le contexte device

**Decision Engine:**
- Évalue les politiques
- Applique les règles
- Retourne la décision

**Policy Executor:**
- Exécute la décision
- Applique les transformations
- Log les décisions

---

## 2. MATRICE RÔLE → ÉVÉNEMENT

### 2.1 Matrice complète

| Événement | Owner | Admin | Manager | Cashier | Waiter | Customer |
|-----------|-------|-------|---------|---------|--------|----------|
| OrderCreated | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| OrderReady | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| OrderPaid | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| OrderCancelled | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| PaymentFailed | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| OrderReceived | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| OrderPrepared | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| KitchenAlert | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| TableAssigned | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| TableReady | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| TableCleaned | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| NewReservation | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| ReservationConfirmed | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ReservationCancelled | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| LowStock | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| OutOfStock | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| StockReceived | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| SupplierOrderPlaced | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| SupplierDeliveryDelayed | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| InvoiceGenerated | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| PaymentReceived | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| SubscriptionExpiring | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| SubscriptionCreated | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| SubscriptionCancelled | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| NewStaffMember | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| LeaveRequest | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ShiftAssigned | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| NewCustomer | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| CustomerFeedback | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| SystemMaintenance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SystemUpdate | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| NewFeature | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SecurityAlert | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| LoginAttempt | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| QRScanned | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| QROrderPlaced | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| DailyReport | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| WeeklyReport | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| SyncCompleted | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SyncFailed | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| OfflineMode | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OnlineRestored | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ScheduledMaintenance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MaintenanceCompleted | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Légende:**
- ✅: Reçoit la notification
- ❌: Ne reçoit pas

---

## 3. MATRICE ÉVÉNEMENT → CANAL

### 3.1 Matrice complète

| Événement | Toast | Badge | Push | Email | SMS | Center | Banner |
|-----------|-------|-------|------|-------|-----|--------|--------|
| OrderCreated | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| OrderReady | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| OrderPaid | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| OrderCancelled | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| PaymentFailed | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| OrderReceived | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| OrderPrepared | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| KitchenAlert | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| TableAssigned | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| TableReady | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| TableCleaned | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| NewReservation | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| ReservationConfirmed | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| ReservationCancelled | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| LowStock | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| OutOfStock | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| StockReceived | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| SupplierOrderPlaced | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| SupplierDeliveryDelayed | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| InvoiceGenerated | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| PaymentReceived | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| SubscriptionExpiring | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| SubscriptionCreated | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| SubscriptionCancelled | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| NewStaffMember | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| LeaveRequest | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| ShiftAssigned | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| NewCustomer | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| CustomerFeedback | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| SystemMaintenance | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| SystemUpdate | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| NewFeature | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| SecurityAlert | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| LoginAttempt | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| QRScanned | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| QROrderPlaced | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| DailyReport | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| WeeklyReport | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| SyncCompleted | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| SyncFailed | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| OfflineMode | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| OnlineRestored | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| ScheduledMaintenance | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| MaintenanceCompleted | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |

**Légende:**
- ✅: Canal autorisé
- ❌: Canal non autorisé

---

## 4. PRÉFÉRENCES UTILISATEUR

### 4.1 Structure des préférences

**NotificationPreference:**
```yaml
userId: uuid
tenantId: uuid
preferences:
  channels:
    toast: boolean
    badge: boolean
    push: boolean
    email: boolean
    sms: boolean
    webhook: boolean
  categories:
    system: boolean
    order: boolean
    inventory: boolean
    table: boolean
    staff: boolean
    billing: boolean
    platform: boolean
  priorities:
    critical: boolean
    high: boolean
    medium: boolean
    low: boolean
  quietHours:
    enabled: boolean
    start: "22:00"
    end: "08:00"
    timezone: "Africa/Lusaka"
  digest:
    enabled: boolean
    frequency: "daily" | "weekly" | "monthly"
    time: "09:00"
  language: "fr" | "en" | "pt"
  timezone: "Africa/Lusaka"
```

### 4.2 Règles de préférences

**Par défaut:**
- Toast: true
- Badge: true
- Push: true
- Email: false
- SMS: false
- Webhook: false

**Par rôle:**
- Owner: tous canaux
- Admin: tous canaux
- Manager: toast, badge, push, email
- Cashier: toast, badge, push
- Waiter: toast, badge, push
- Customer: push, email

**Par catégorie:**
- System: tous
- Order: tous sauf customer
- Inventory: manager, kitchen
- Table: waiter, host
- Staff: manager, admin
- Billing: customer, manager, accounting
- Platform: admin, owner

---

## 5. QUIET HOURS

### 5.1 Définition

**Période de silence:** Pas de notification sauf critical

**Configuration:**
- Par utilisateur
- Par tenant (override)
- Par rôle (override)

### 5.2 Règles

**Quiet hours actives:**
- Critical: toujours autorisé
- High: autorisé si urgent
- Medium: bloqué
- Low: bloqué

**Exceptions:**
- SecurityAlert: toujours autorisé
- SystemMaintenance: toujours autorisé
- PaymentFailed: toujours autorisé

**Exemple:**
```
Quiet hours: 22:00 - 08:00
23:00 - LowStock → BLOQUÉ
23:00 - SecurityAlert → AUTORISÉ
23:00 - PaymentFailed → AUTORISÉ
```

---

## 6. DIGEST

### 6.1 Types de digest

**Daily Digest:**
- Fréquence: quotidien
- Heure: 09:00
- Contenu: notifications du jour précédent
- Format: email

**Weekly Digest:**
- Fréquence: hebdomadaire
- Heure: lundi 09:00
- Contenu: notifications de la semaine
- Format: email

**Monthly Digest:**
- Fréquence: mensuel
- Heure: 1er du mois 09:00
- Contenu: notifications du mois
- Format: email

### 6.2 Règles

**Critères d'envoi:**
- Si > 10 notifications: envoyer digest
- Si < 10 notifications: envoyer individuellement

**Format:**
```
Résumé des notifications du [date]
- X nouvelles commandes
- Y alertes stock
- Z demandes congé
- W erreurs système
```

---

## 7. RATE LIMITING

### 7.1 Limites

**Par utilisateur:**
- Max 10 notifications/heure
- Max 50 notifications/jour
- Max 3 toasts simultanés

**Par tenant:**
- Max 1000 notifications/heure
- Max 10000 notifications/jour

**Par événement:**
- Max 5 notifications/minute/eventType

### 7.2 Règles

**Dépassement:**
- Queue + retard
- Critical: bypass
- High: bypass si < 5min depuis dernière

**Exemple:**
```
10:00 - Notification 1 (ok)
10:05 - Notification 2 (ok)
10:10 - Notification 3 (ok)
10:15 - Notification 4 (ok)
10:20 - Notification 5 (ok)
10:25 - Notification 6 (ok)
10:30 - Notification 7 (ok)
10:35 - Notification 8 (ok)
10:40 - Notification 9 (ok)
10:45 - Notification 10 (ok)
10:50 - Notification 11 (RATE LIMITED → queue)
11:50 - Notification 11 (envoyé)
```

---

## 8. COOLDOWN

### 8.1 Définition

**Délai minimum** entre deux notifications identiques

### 8.2 Règles

**Par priorité:**
- Critical: 0min (pas de cooldown)
- High: 2min
- Medium: 5min
- Low: 15min

**Par type:**
- Même type + même catégorie: cooldown
- Même type + catégorie différente: pas de cooldown

**Exemple:**
```
10:00 - "Stock faible: Produit A" (envoyé)
10:02 - "Stock faible: Produit A" (cooldown 5min → BLOQUÉ)
10:05 - "Stock faible: Produit A" (cooldown terminé → envoyé)
```

---

## 9. BATCHING

### 9.1 Définition

**Regrouper** notifications similaires en batch

### 9.2 Règles

**Batch size:**
- Critical: 1 (pas de batch)
- High: 5 max
- Medium: 10 max
- Low: 20 max

**Interval:**
- Critical: immédiat
- High: 10s
- Medium: 30s
- Low: 60s

**Exemple:**
```
10:00 - 15 notifications medium créées
10:00 - Batch 1: 10 notifications (immédiat)
10:30 - Batch 2: 5 notifications (30s plus tard)
```

---

## 10. ESCALADE

### 10.1 Définition

**Augmenter la priorité** si pas de réponse

### 10.2 Règles

**Par événement:**
- PaymentFailed: après 2 échecs → Critical
- LowStock: après 2h sans action → Critical
- LeaveRequest: après 48h sans réponse → Critical
- KitchenAlert: après 5min → Critical

**Escalade chain:**
```
Medium → High → Critical
```

**Notification d'escalade:**
```
"ESCALADE: [événement] toujours en attente"
```

---

## 11. SLA

### 11.1 Définitions

**SLA (Service Level Agreement):**
- Délai maximum de traitement
- Déclencheur d'escalade

### 11.2 SLAs par événement

| Événement | SLA | Escalade |
|-----------|-----|----------|
| PaymentFailed | 5min | Oui |
| OutOfStock | 10min | Oui |
| KitchenAlert | 5min | Oui |
| SecurityAlert | 1min | Oui |
| OrderReady | 30min | Oui |
| LowStock | 2h | Oui |
| LeaveRequest | 48h | Oui |

---

## 12. FALLBACK

### 12.1 Définition

**Stratégie de repli** si canal échoue

### 12.2 Chaîne de fallback

**Par priorité:**

**Critical:**
```
Toast → Badge → Push → Email → SMS
```

**High:**
```
Toast → Badge → Push → Email
```

**Medium:**
```
Badge → Email → Center
```

**Low:**
```
Center
```

### 12.3 Règles

**Si canal échoue:**
- Tenter canal suivant
- Log l'échec
- Retry 3x par canal

**Si tous canaux échouent:**
- Dead letter queue
- Alerte admin
- Retry manuel

---

## 13. HÉRITAGE DES PRÉFÉRENCES

### 13.1 Définition

**Propagation** des préférences dans la hiérarchie

### 13.2 Règles d'héritage

**Niveau 1: Utilisateur**
- Préférences explicites
- Priorité maximale

**Niveau 2: Rôle**
- Préférences par défaut du rôle
- S'applique si non défini Niveau 1

**Niveau 3: Tenant**
- Préférences par défaut du tenant
- S'applique si non défini Niveau 1-2

**Niveau 4: Global**
- Préférences globales
- S'applique si non défini Niveau 1-3

### 13.3 Exemple

```
Tenant: email désactivé par défaut
Rôle Manager: email activé
Utilisateur: email non défini

Résultat: email activé (hérité du rôle)
```

---

## 14. RÉSOLUTION DES CONFLITS

### 14.1 Types de conflits

**Conflit de préférences:**
- Utilisateur vs Rôle
- Rôle vs Tenant
- Tenant vs Global

**Conflit de canaux:**
- Plusieurs canaux disponibles
- Priorité différente

**Conflit de timing:**
- Quiet hours vs Critical
- Cooldown vs Escalade

### 14.2 Règles de résolution

**Préférences:**
- Utilisateur > Rôle > Tenant > Global

**Canaux:**
- Priorité: Toast > Badge > Push > Email > SMS

**Timing:**
- Critical > Quiet hours
- Escalade > Cooldown

---

## 15. RÈGLES MULTI-TENANT

### 15.1 Isolation

**Par tenant:**
- Préférences isolées
- Canaux isolés
- Quotas isolés

**Partage:**
- Platform events: partagés
- System events: partagés

### 15.2 Règles

**Quota par tenant:**
- Max 1000 notifications/heure
- Max 10000 notifications/jour

**Canaux par tenant:**
- Configuration par tenant
- Override utilisateur autorisé

**Politiques par tenant:**
- Custom policies
- Override global autorisé

---

## 16. RÈGLES OFFLINE

### 16.1 Mode offline

**Comportement:**
- Lecture seulement
- Queue des actions
- Pas de notification temps réel

**Préférences offline:**
- Utiliser préférences en cache
- Pas de mise à jour
- Sync au retour online

### 16.2 Sync

**Au retour online:**
1. Fetch notifications manquées
2. Appliquer préférences à jour
3. Envoyer actions en queue
4. Mettre à jour UI

**Conflits:**
- Last write wins
- Merge si possible

---

## 17. RÈGLES REALTIME

### 17.1 Connexion

**État connecté:**
- Notifications temps réel
- Pas de cooldown
- Pas de batch

**État déconnecté:**
- Queue des notifications
- Mode offline
- Retry automatique

### 17.2 Règles

**Realtime actif:**
- Notification immédiate
- Pas de cooldown
- Pas de batch

**Realtime inactif:**
- Fallback sur polling
- Cooldown activé
- Batch activé

---

## 18. GOUVERNANCE

### 18.1 Rôles

**Policy Administrator:**
- Créer/modifier politiques
- Valider politiques
- Déployer politiques

**Policy Auditor:**
- Auditer politiques
- Vérifier conformité
- Reporter violations

**Policy Viewer:**
- Voir politiques
- Voir décisions
- Voir logs

### 18.2 Versioning

**Politiques versionnées:**
- Version sémantique
- Rollback possible
- Audit trail

**Déploiement:**
- Blue/Green deployment
- Feature flags
- Rollback automatique

### 18.3 Audit

**Logs:**
- Toutes les décisions
- Toutes les évaluations
- Toutes les violations

**Rétention:**
- 7 ans
- Searchable
- Exportable

---

## CONCLUSION

Ce Policy Engine définit toutes les règles de décision du système de notifications.

**Caractéristiques:**
- ✅ Centralisé
- ✅ Flexible
- ✅ Auditabilité
- ✅ Multi-tenant
- ✅ Offline-aware
- ✅ Realtime-aware

**Prochaine étape:**
Implémenter le Data Model selon ces politiques.

---

**FIN DU DOCUMENT**

*Ce document fait partie du Notification Design System officiel d'Ekala.*