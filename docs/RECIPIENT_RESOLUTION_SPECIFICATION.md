# RECIPIENT RESOLUTION SPECIFICATION  
**Version :** 1.0  
**Date :** 29/06/2026  
**Scope :** Moteur de résolution des destinataires de notifications Ekala  
**Règle :** Aucun code, uniquement spécifications

---

## 1. VUE D'ENSEMBLE

### 1.1 Objectif

Le moteur de résolution des destinataires détermine **qui doit recevoir chaque notification** à partir :
- D'un **événement métier** (Domain Event)
- Du **contexte** (tenant, branche, rôle, utilisateur)
- Des **préférences utilisateur** (opt-in/opt-out)
- Des **règles de notification** (RBAC, conditions, actions)

---

### 1.2 Principes

| Principe | Description |
|---|---|
| **Déterminisme** | Même événement + même contexte = mêmes destinataires |
| **Respect des préférences** | Les préférences utilisateur sont prioritaires |
| **RBAC** | Les règles de rôle sont appliquées avant les préférences |
| **Performance** | Résolution en < 10ms (cache Redis) |
| **Extensibilité** | Ajouter des conditions sans modifier le moteur |

---

### 1.3 Sources de données

```
┌─────────────────────────────────────────────────────────────┐
│                    SOURCES DE DONNÉES                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Domain Event                                            │
│     - eventType                                             │
│     - tenantId                                              │
│     - payload (données métier)                              │
│                                                             │
│  2. Contexte                                                │
│     - tenantId                                              │
│     - branchId (si applicable)                              │
│     - userId (émetteur)                                     │
│     - userRole (émetteur)                                   │
│                                                             │
│  3. Préférences utilisateur                                 │
│     - notification_preferences (par user × channel × event) │
│     - role_notification_config (par rôle)                   │
│     - tenant_notification_config (par tenant)               │
│                                                             │
│  4. Règles de notification                                  │
│     - notification_rules (NotificationRule)                 │
│     - Conditions (role_in, user_id_in, etc.)                │
│     - Actions (send_email, send_inapp, etc.)                │
│                                                             │
│  5. Base utilisateurs                                       │
│     - users (userId, email, phone, role, tenantId)          │
│     - user_roles (role, permissions)                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. ALGORITHME DE RÉSOLUTION

### 2.1 Vue d'ensemble

```
Event + Contexte
  ↓
1. Charger les règles de notification (NotificationRule)
  ↓
2. Évaluer les règles (par priority DESC)
  ↓
3. Si règle match → utiliser les destinataires de la règle
  ↓
4. Si aucune règle → fallback sur role_notification_config (legacy)
  ↓
5. Résoudre les destinataires (userId → email/phone)
  ↓
6. Appliquer les préférences utilisateur (opt-in/opt-out)
  ↓
7. Filtrer par canaux (préférences + règles)
  ↓
8. Retourner la liste des destinataires
```

---

### 2.2 Algorithme détaillé

**Entrée :**
- `event` : DomainEvent (eventType, tenantId, payload)
- `context` : ResolutionContext (tenantId, branchId?, userId, userRole)

**Sortie :**
- `List<Recipient>` : Destinataires avec canaux autorisés

**Étapes :**

```
FUNCTION resolveRecipients(event, context):

  // Étape 1 : Vérifier si l'événement a un email explicite
  explicitRecipients = getExplicitRecipients(event)
  IF explicitRecipients EXISTS:
    RETURN explicitRecipients

  // Étape 2 : Charger les règles de notification
  rules = notificationRuleRepository.findByTenantAndEvent(
    context.tenantId,
    event.eventType
  )

  // Étape 3 : Évaluer les règles (par priority DESC)
  matchedRules = []
  FOR EACH rule IN rules SORTED BY priority DESC:
    IF evaluateConditions(rule.conditions, event, context):
      matchedRules.append(rule)
      BREAK  // Short-circuit : première règle qui match

  // Étape 4 : Si règle match, utiliser les destinataires de la règle
  IF matchedRules NOT EMPTY:
    rule = matchedRules[0]
    recipients = executeActions(rule.actions, event, context)
    RETURN recipients

  // Étape 5 : Fallback sur role_notification_config (legacy)
  legacyRecipients = resolveLegacyRecipients(event, context)
  IF legacyRecipients NOT EMPTY:
    RETURN legacyRecipients

  // Étape 6 : Aucun destinataire trouvé
  RETURN EMPTY LIST
```

---

### 2.3 Évaluation des conditions

**Fonction :** `evaluateConditions(conditions, event, context)`

**Types de conditions :**

| Type | Description | Exemple |
|---|---|---|
| `role_in` | L'utilisateur a un des rôles | `["admin", "manager"]` |
| `role_not_in` | L'utilisateur n'a pas les rôles | `["cashier", "waiter"]` |
| `user_id_in` | L'utilisateur est dans la liste | `[1, 2, 3]` |
| `user_id_not_in` | L'utilisateur n'est pas dans la liste | `[4, 5]` |
| `tenant_id_eq` | Le tenant est égal | `123` |
| `branch_id_eq` | La branche est égale | `456` |
| `branch_id_in` | La branche est dans la liste | `[456, 789]` |
| `custom_attribute` | Attribut personnalisé | `{"key": "department", "value": "kitchen"}` |

**Algorithme :**
```
FUNCTION evaluateConditions(conditions, event, context):
  FOR EACH condition IN conditions:
    result = evaluateCondition(condition, event, context)
    IF result == FALSE:
      RETURN FALSE
  RETURN TRUE

FUNCTION evaluateCondition(condition, event, context):
  SWITCH condition.type:
    CASE "role_in":
      RETURN context.userRole IN condition.values
    
    CASE "role_not_in":
      RETURN context.userRole NOT IN condition.values
    
    CASE "user_id_in":
      RETURN context.userId IN condition.values
    
    CASE "user_id_not_in":
      RETURN context.userId NOT IN condition.values
    
    CASE "tenant_id_eq":
      RETURN context.tenantId == condition.value
    
    CASE "branch_id_eq":
      RETURN context.branchId == condition.value
    
    CASE "branch_id_in":
      RETURN context.branchId IN condition.values
    
    CASE "custom_attribute":
      RETURN getCustomAttribute(context.userId, condition.key) == condition.value
```

---

### 2.4 Exécution des actions

**Fonction :** `executeActions(actions, event, context)`

**Types d'actions :**

| Type | Description | Destinataires |
|---|---|---|
| `send_email` | Envoyer un email | Résolu dynamiquement |
| `send_sms` | Envoyer un SMS | Résolu dynamiquement |
| `send_push` | Envoyer un push | Résolu dynamiquement |
| `send_inapp` | Envoyer in-app | Résolu dynamiquement |
| `send_whatsapp` | Envoyer WhatsApp | Résolu dynamiquement |
| `send_webhook` | Envoyer un webhook | URL explicite |

**Algorithme :**
```
FUNCTION executeActions(actions, event, context):
  recipients = []

  FOR EACH action IN actions:
    SWITCH action.type:
      CASE "send_email":
        users = resolveUsersByRole(context.tenantId, action.roles)
        FOR EACH user IN users:
          recipients.append({
            userId: user.id,
            email: user.email,
            channel: "email",
            template: action.template
          })
      
      CASE "send_sms":
        users = resolveUsersByRole(context.tenantId, action.roles)
        FOR EACH user IN users:
          IF user.phone EXISTS:
            recipients.append({
              userId: user.id,
              phone: user.phone,
              channel: "sms",
              template: action.template
            })
      
      CASE "send_push":
        users = resolveUsersByRole(context.tenantId, action.roles)
        FOR EACH user IN users:
          IF user.pushToken EXISTS:
            recipients.append({
              userId: user.id,
              pushToken: user.pushToken,
              channel: "push",
              template: action.template
            })
      
      CASE "send_inapp":
        users = resolveUsersByRole(context.tenantId, action.roles)
        FOR EACH user IN users:
          recipients.append({
            userId: user.id,
            channel: "inapp",
            template: action.template
          })
      
      CASE "send_webhook":
        recipients.append({
          url: action.url,
          channel: "webhook",
          template: action.template
        })

  RETURN recipients
```

---

### 2.5 Résolution legacy (role_notification_config)

**Fonction :** `resolveLegacyRecipients(event, context)`

**Algorithme :**
```
FUNCTION resolveLegacyRecipients(event, context):
  // Charger la config legacy
  config = settings.role_notification_config

  // Mapping event → config key
  eventKey = mapEventToConfigKey(event.eventType)
  IF eventKey == NULL:
    RETURN EMPTY LIST

  // Trouver les rôles autorisés
  authorizedRoles = []
  FOR EACH role, config IN config.roles:
    IF config.notifications[eventKey] == true:
      IF role IN context.userRoles OR context.userRole IN role:
        authorizedRoles.append(role)

  // Résoudre les utilisateurs
  recipients = []
  FOR EACH role IN authorizedRoles:
    users = userRepository.findByTenantAndRole(context.tenantId, role)
    FOR EACH user IN users:
      recipients.append({
        userId: user.id,
        email: user.email,
        channel: "email",  // Legacy = email uniquement
        template: getDefaultTemplate(event.eventType)
      })

  RETURN recipients
```

---

## 3. SOURCES DE DONNÉES DÉTAILLÉES

### 3.1 Domain Event

**Structure :**
```typescript
interface DomainEvent {
  eventId: UUID
  eventType: string  // ex: "ProductCreated"
  tenantId: TenantId
  aggregateId: UUID
  aggregateType: string
  payload: {
    // Données métier spécifiques à l'événement
    productId?: UUID
    productName?: string
    stockQuantity?: number
    saleAmount?: Money
    // ...
  }
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

### 3.2 Contexte de résolution

**Structure :**
```typescript
interface ResolutionContext {
  tenantId: TenantId
  branchId?: TenantId  // Optionnel (si événement lié à une branche)
  userId: UserId  // Émetteur de l'événement
  userRole: string  // Rôle de l'émetteur (admin, manager, etc.)
  userEmail?: string  // Email de l'émetteur
  userPhone?: string  // Téléphone de l'émetteur
}
```

---

### 3.3 Préférences utilisateur

**Structure :**
```typescript
interface NotificationPreference {
  preferenceId: UUID
  userId: UserId
  tenantId: TenantId
  channel: ChannelType  // email, sms, push, inapp, whatsapp
  eventType: string  // ex: "ProductCreated"
  enabled: boolean
  frequency: "instant" | "daily_digest" | "weekly_digest"
  quietHours?: {
    start: string  // "22:00"
    end: string  // "08:00"
  }
}
```

**Algorithme de fusion des préférences :**
```
1. Charger préférences utilisateur (userId + tenantId + eventType)
2. Charger préférences tenant (tenantId + eventType)
3. Charger préférences rôle (userRole + eventType)
4. Fusionner (user > tenant > role > global default)
5. Appliquer QuietHours (sauf critical)
6. Retourner canaux autorisés + fréquence
```

---

### 3.4 Règles de notification

**Structure :**
```typescript
interface NotificationRule {
  ruleId: UUID
  tenantId: TenantId
  name: string
  eventType: string
  priority: number  // Plus élevé = plus prioritaire
  enabled: boolean
  conditions: Array<{
    type: "role_in" | "role_not_in" | "user_id_in" | "user_id_not_in" | 
          "tenant_id_eq" | "branch_id_eq" | "branch_id_in" | "custom_attribute"
    values?: Array<any>
    value?: any
    key?: string  // Pour custom_attribute
  }>
  actions: Array<{
    type: "send_email" | "send_sms" | "send_push" | "send_inapp" | 
          "send_whatsapp" | "send_webhook"
    template: string
    roles?: Array<string>  // Pour résoudre les destinataires
    url?: string  // Pour send_webhook
  }>
}
```

---

### 3.5 Base utilisateurs

**Structure :**
```typescript
interface User {
  userId: UserId
  tenantId: TenantId
  branchId?: TenantId
  email: string
  phone?: string
  role: string  // admin, manager, cashier, waiter
  pushToken?: string  // Pour push notifications
  isActive: boolean
  createdAt: Timestamp
}
```

---

## 4. RÉSOLUTION PAR TYPE D'ÉVÉNEMENT

### 4.1 Événements avec email explicite

Certains événements ont un **email explicite** (pas de résolution RBAC) :

| Événement | Email explicite | Source |
|---|---|---|
| `VoucherGenerated` | `customer_email` | Depuis le voucher |
| `VoucherExpired` | `customer_email` | Depuis le voucher |
| `PaymentVerified` | `tenant_owner_email` | Depuis le tenant |
| `PaymentRejected` | `tenant_owner_email` | Depuis le tenant |
| `SubscriptionCreated` | `tenant_owner_email` | Depuis le tenant |
| `SubscriptionActivated` | `tenant_owner_email` | Depuis le tenant |
| `SubscriptionExpired` | `tenant_owner_email` | Depuis le tenant |
| `SubscriptionCancelled` | `tenant_owner_email` | Depuis le tenant |
| `SubscriptionGracePeriodStarted` | `tenant_owner_email` | Depuis le tenant |
| `SubscriptionPaymentFailed` | `tenant_owner_email` | Depuis le tenant |
| `TenantSuspended` | `tenant_owner_email` + super_admin | Depuis le tenant |
| `UserCreated` | `user_email` | Depuis l'utilisateur créé |
| `UserInvited` | `invited_email` | Depuis l'invitation |
| `UserRoleChanged` | `user_email` | Depuis l'utilisateur |
| `UserDeactivated` | `user_email` | Depuis l'utilisateur |
| `PasswordResetRequested` | `user_email` | Depuis l'utilisateur |
| `PasswordResetCompleted` | `user_email` | Depuis l'utilisateur |
| `PINResetRequested` | `user_email` | Depuis l'utilisateur |

**Algorithme :**
```
FUNCTION getExplicitRecipients(event):
  SWITCH event.eventType:
    CASE "VoucherGenerated":
      RETURN [{
        userId: NULL,
        email: event.payload.customerEmail,
        channel: "email",
        template: "VoucherGeneratedEmail"
      }]
    
    CASE "PaymentVerified":
      RETURN [{
        userId: NULL,
        email: getTenantOwnerEmail(event.tenantId),
        channel: "email",
        template: "PaymentVerifiedEmail"
      }]
    
    // ... autres cas
    
    DEFAULT:
      RETURN NULL  // Pas d'email explicite
```

---

### 4.2 Événements avec résolution RBAC

La plupart des événements utilisent la résolution RBAC :

| Événement | Rôles autorisés | Canaux |
|---|---|---|
| `ProductCreated` | admin, manager | Email, In-App |
| `StockLow` | admin, manager | Email, In-App |
| `StockOut` | admin, manager | Email, SMS, Push, In-App |
| `SaleCompleted` | admin, manager, cashier | Email, In-App |
| `OrderPlaced` | cashier, waiter, admin | Email, In-App |
| `QROrderReceived` | cashier, waiter, admin | Push, Email, In-App |

**Algorithme :**
```
FUNCTION resolveRecipientsByRBAC(event, context):
  // Charger les règles
  rules = notificationRuleRepository.findByTenantAndEvent(
    context.tenantId,
    event.eventType
  )

  // Évaluer les règles
  FOR EACH rule IN rules SORTED BY priority DESC:
    IF evaluateConditions(rule.conditions, event, context):
      return executeActions(rule.actions, event, context)

  // Fallback legacy
  return resolveLegacyRecipients(event, context)
```

---

### 4.3 Événements cross-tenant

Seuls les événements Platform sont cross-tenant :

| Événement | Scope | Destinataires |
|---|---|---|
| `TenantCreated` | Cross-tenant | super_admin, platform_admin |
| `TenantSuspended` | Cross-tenant | tenant owner + super_admin |
| `SystemError` | Cross-tenant | super_admin, platform_admin |
| `DatabaseConnectionLost` | Cross-tenant | super_admin, platform_admin |
| `PlatformHealthCheckFailed` | Cross-tenant | super_admin, platform_admin |

**Algorithme :**
```
FUNCTION resolveCrossTenantRecipients(event):
  users = []

  SWITCH event.eventType:
    CASE "TenantCreated":
      users = userRepository.findByRole("super_admin")
      users += userRepository.findByRole("platform_admin")
    
    CASE "TenantSuspended":
      users = userRepository.findByRole("super_admin")
      users += getTenantOwner(event.tenantId)
    
    CASE "SystemError":
    CASE "DatabaseConnectionLost":
    CASE "PlatformHealthCheckFailed":
      users = userRepository.findByRole("super_admin")
      users += userRepository.findByRole("platform_admin")

  RETURN users
```

---

## 5. FILTRAGE PAR PRÉFÉRENCES

### 5.1 Application des préférences

**Principe :** Les préférences utilisateur sont appliquées APRÈS la résolution des destinataires.

**Algorithme :**
```
FUNCTION applyPreferences(recipients, event, context):
  filteredRecipients = []

  FOR EACH recipient IN recipients:
    // Charger les préférences de l'utilisateur
    preferences = preferenceEngine.getPreferences(
      recipient.userId,
      context.tenantId,
      event.eventType
    )

    // Vérifier si l'utilisateur a opt-out pour ce canal
    IF preferences.enabled == false:
      CONTINUE  // Skip cet utilisateur

    // Vérifier si le canal est autorisé
    IF recipient.channel NOT IN preferences.allowedChannels:
      CONTINUE  // Skip cet utilisateur

    // Vérifier QuietHours (sauf critical)
    IF event.priority != "critical":
      quietHours = preferences.quietHours
      IF quietHours EXISTS AND isInQuietHours(quietHours):
        CONTINUE  // Skip cet utilisateur

    // Ajouter le destinataire
    filteredRecipients.append(recipient)

  RETURN filteredRecipients
```

---

### 5.2 Moteur de préférences

**Interface :**
```typescript
interface IPreferenceEngine {
  getPreferences(
    userId: UserId,
    tenantId: TenantId,
    eventType: string
  ): Promise<NotificationPreferences>
  
  shouldSend(
    userId: UserId,
    tenantId: TenantId,
    eventType: string,
    channel: ChannelType
  ): Promise<boolean>
  
  getQuietHours(
    userId: UserId,
    tenantId: TenantId
  ): Promise<QuietHours | null>
}
```

**Algorithme de fusion :**
```
FUNCTION getPreferences(userId, tenantId, eventType):
  // 1. Charger préférences utilisateur
  userPrefs = preferenceRepository.findByUserAndEvent(userId, eventType)
  
  // 2. Charger préférences tenant
  tenantPrefs = tenantNotificationConfigRepository.findByTenant(tenantId)
  
  // 3. Charger préférences rôle
  user = userRepository.findById(userId)
  rolePrefs = roleNotificationConfigRepository.findByRole(user.role)
  
  // 4. Fusionner (user > tenant > role > global default)
  merged = {
    enabled: userPrefs?.enabled ?? tenantPrefs?.enabled ?? rolePrefs?.enabled ?? true,
    channels: userPrefs?.channels ?? tenantPrefs?.channels ?? rolePrefs?.channels ?? ["email", "inapp"],
    frequency: userPrefs?.frequency ?? tenantPrefs?.frequency ?? rolePrefs?.frequency ?? "instant",
    quietHours: userPrefs?.quietHours ?? tenantPrefs?.quietHours ?? rolePrefs?.quietHours ?? NULL
  }
  
  // 5. Retourner
  RETURN merged
```

---

## 6. EXEMPLES DE RÉSOLUTION

### 6.1 Exemple 1 : ProductCreated (admin)

**Contexte :**
- Event: `ProductCreated`
- TenantId: 123
- UserId: 1 (admin)
- UserRole: `admin`

**Résolution :**
```
1. Vérifier email explicite → NULL
2. Charger les règles pour (123, "ProductCreated")
   → Règle: "Notify admins on product created"
   → Conditions: role_in ["admin", "manager"]
   → Match: OUI (userRole = admin)
3. Exécuter les actions:
   - send_email: admin, manager
   - send_inapp: admin, manager
4. Résoudre les utilisateurs:
   - admin: userId=1, email=admin@restaurant.com
   - manager: userId=2, email=manager@restaurant.com
5. Appliquer les préférences:
   - admin: notifyNewProduct = true → ✅
   - manager: notifyNewProduct = true → ✅
6. Retourner:
   [
     { userId: 1, email: "admin@restaurant.com", channel: "email" },
     { userId: 1, channel: "inapp" },
     { userId: 2, email: "manager@restaurant.com", channel: "email" },
     { userId: 2, channel: "inapp" }
   ]
```

---

### 6.2 Exemple 2 : StockOut (critical)

**Contexte :**
- Event: `StockOut`
- TenantId: 123
- UserId: 3 (cashier)
- UserRole: `cashier`

**Résolution :**
```
1. Vérifier email explicite → NULL
2. Charger les règles pour (123, "StockOut")
   → Règle: "Critical alert for stock out"
   → Conditions: role_in ["admin", "manager"]
   → Match: NON (userRole = cashier)
3. Fallback legacy:
   - role_notification_config.admin.notifications.outOfStock = true
   - role_notification_config.manager.notifications.outOfStock = true
   - role_notification_config.cashier.notifications.outOfStock = false
4. Résoudre les utilisateurs:
   - admin: userId=1, email=admin@restaurant.com, phone=+33612345678
   - manager: userId=2, email=manager@restaurant.com, phone=+33687654321
5. Appliquer les préférences:
   - admin: notifyOutOfStock = true → ✅
   - manager: notifyOutOfStock = true → ✅
6. Retourner:
   [
     { userId: 1, email: "admin@restaurant.com", phone: "+33612345678", channel: "email" },
     { userId: 1, phone: "+33612345678", channel: "sms" },
     { userId: 1, channel: "push" },
     { userId: 1, channel: "inapp" },
     { userId: 2, email: "manager@restaurant.com", phone: "+33687654321", channel: "email" },
     { userId: 2, phone: "+33687654321", channel: "sms" },
     { userId: 2, channel: "push" },
     { userId: 2, channel: "inapp" }
   ]
```

---

### 6.3 Exemple 3 : VoucherGenerated (email explicite)

**Contexte :**
- Event: `VoucherGenerated`
- TenantId: 123
- Payload: { customerEmail: "customer@example.com", voucherCode: "ABC123" }

**Résolution :**
```
1. Vérifier email explicite:
   - customer_email = "customer@example.com"
   → MATCH
2. Retourner immédiatement:
   [
     {
       userId: NULL,
       email: "customer@example.com",
       channel: "email",
       template: "VoucherGeneratedEmail"
     }
   ]
3. Pas de résolution RBAC, pas de préférences
```

---

### 6.4 Exemple 4 : TenantSuspended (cross-tenant)

**Contexte :**
- Event: `TenantSuspended`
- TenantId: 456
- Payload: { tenantOwnerEmail: "owner@restaurant.com" }

**Résolution :**
```
1. Vérifier email explicite:
   - tenant_owner_email = "owner@restaurant.com"
   - super_admin emails = ["super@ekala.com", "admin@ekala.com"]
   → MATCH
2. Retourner:
   [
     {
       userId: NULL,
       email: "owner@restaurant.com",
       channel: "email",
       template: "TenantSuspendedEmail"
     },
     {
       userId: NULL,
       email: "super@ekala.com",
       channel: "email",
       template: "TenantSuspendedEmail"
     },
     {
       userId: NULL,
       email: "admin@ekala.com",
       channel: "email",
       template: "TenantSuspendedEmail"
     }
   ]
```

---

### 6.5 Exemple 5 : OrderAssigned (waiter spécifique)

**Contexte :**
- Event: `OrderAssigned`
- TenantId: 123
- Payload: { orderId: 789, waiterId: 5 }

**Résolution :**
```
1. Vérifier email explicite → NULL
2. Charger les règles pour (123, "OrderAssigned")
   → Règle: "Notify assigned waiter"
   → Conditions: user_id_in [5]
   → Match: OUI (waiterId = 5)
3. Exécuter les actions:
   - send_push: waiter assigné
   - send_inapp: waiter assigné
4. Résoudre l'utilisateur:
   - waiter: userId=5, pushToken="fcm_token_xxx"
5. Appliquer les préférences:
   - waiter: notifyOrderAssigned = true → ✅
6. Retourner:
   [
     {
       userId: 5,
       pushToken: "fcm_token_xxx",
       channel: "push",
       template: "OrderAssignedPush"
     },
     {
       userId: 5,
       channel: "inapp",
       template: "OrderAssignedInApp"
     }
   ]
```

---

## 7. CAS PARTICULIERS

### 7.1 Utilisateur sans préférence

**Règle :** Si aucun préférence n'existe, utiliser les defaults :
- `enabled` = true
- `channels` = ["email", "inapp"]
- `frequency` = "instant"

---

### 7.2 Utilisateur désactivé

**Règle :** Si `user.isActive = false`, ne pas envoyer de notification (sauf événements critiques).

---

### 7.3 Branche spécifique

**Règle :** Si l'événement est lié à une branche, ne notifier que les utilisateurs de cette branche.

**Exemple :**
```
Event: StockLow
  Payload: { branchId: 456 }
  ↓
Résolution:
  - admin de la branche 456
  - manager de la branche 456
  - PAS les admins des autres branches
```

---

### 7.4 Multi-tenant isolation

**Règle :** Un utilisateur ne reçoit que les notifications de son tenant.

**Vérification :**
```
IF recipient.tenantId != context.tenantId:
  SKIP  // Ne pas envoyer
```

---

### 7.5 Rate limiting

**Règle :** Un utilisateur ne peut pas recevoir plus de 100 notifications/heure.

**Algorithme :**
```
FUNCTION checkRateLimit(userId, tenantId):
  count = redis.get("notifications:rate_limit:{userId}:{tenantId}")
  IF count >= 100:
    RETURN false  // Rate limit atteint
  ELSE:
    redis.incr("notifications:rate_limit:{userId}:{tenantId}", 1)
    redis.expire("notifications:rate_limit:{userId}:{tenantId}", 3600)
    RETURN true
```

---

## 8. PERFORMANCE

### 8.1 Cache

**Stratégie :**
- Cache Redis des préférences utilisateur (TTL 5 min)
- Cache Redis des règles de notification (TTL 5 min)
- Cache Redis des rôles utilisateur (TTL 5 min)

**Clés Redis :**
```
notification:preferences:{userId}:{tenantId}:{eventType}
notification:rules:{tenantId}:{eventType}
notification:user_roles:{userId}
```

---

### 8.2 Optimisations

| Optimisation | Description |
|---|---|
| **Cache des règles** | Charger les règles une fois par tenant/event |
| **Cache des préférences** | Charger les préférences une fois par user/event |
| **Batch resolution** | Résoudre tous les destinataires d'un coup |
| **Early exit** | Arrêter la résolution si email explicite trouvé |
| **Short-circuit** | Arrêter l'évaluation des règles après première match |

---

### 8.3 Métriques

**Latence :**
- `recipient_resolution_time_ms` (histogram)
- Target: < 10ms (p95)

**Cache hit rate :**
- `preference_cache_hit_rate`
- `rules_cache_hit_rate`
- Target: > 90%

---

## 9. TESTS

### 9.1 Tests unitaires

| Cas | Entrée | Sortie attendue |
|---|---|---|
| Email explicite | VoucherGenerated | [customer_email] |
| RBAC match | StockOut, admin | [admin, manager] |
| RBAC no match | StockOut, cashier | [] |
| Legacy fallback | ProductCreated, pas de règle | [admin, manager] |
| Préférences opt-out | ProductCreated, user pref = false | [] |
| QuietHours | ProductCreated, 23h, quiet = 22h-8h | [] |
| Cross-tenant | TenantCreated | [super_admin, platform_admin] |
| Rate limit | 101e notification/heure | [] |

---

### 9.2 Tests d'intégration

| Scénario | Description |
|---|---|
| **E2E ProductCreated** | Event → Résolution → Préférences → Destinataires |
| **E2E StockOut** | Event → Règle → RBAC → Destinataires |
| **E2E VoucherGenerated** | Event → Email explicite → Destinataires |
| **E2E TenantSuspended** | Event → Cross-tenant → Destinataires |
| **Offline** | Event → SQLite → Outbox → Sync → Destinataires |

---

## 10. MONITORING

### 10.1 Logs

**Champs :**
- `event_type`
- `tenant_id`
- `recipients_count`
- `resolution_time_ms`
- `rules_evaluated`
- `preferences_applied`
- `cache_hit`

---

### 10.2 Métriques

**Volume :**
- `recipients_resolved_total` (by event_type, tenant_id)
- `recipients_filtered_total` (by reason: preferences, rate_limit, etc.)

**Performance :**
- `recipient_resolution_time_ms` (histogram)
- `rules_evaluation_time_ms` (histogram)
- `preferences_lookup_time_ms` (histogram)

**Qualité :**
- `rules_match_rate` (match / total)
- `legacy_fallback_rate` (legacy / total)
- `explicit_recipient_rate` (explicit / total)
- `preference_opt_out_rate` (opt_out / total)

---

## 11. SÉCURITÉ

### 11.1 Vérifications

| Vérification | Description |
|---|---|
| **Tenant isolation** | Un utilisateur ne reçoit que les notifications de son tenant |
| **RBAC** | Un utilisateur ne peut pas recevoir de notifications pour lesquelles il n'est pas autorisé |
| **Email validation** | Vérifier que l'email est valide avant d'envoyer |
| **Phone validation** | Vérifier que le téléphone est valide avant d'envoyer |
| **Rate limiting** | Limiter le nombre de notifications par utilisateur |

---

### 11.2 Audit

**Logger :**
- Toutes les résolutions de destinataires
- Tous les filtrages (préférences, rate limit, etc.)
- Toutes les erreurs

---

## 12. RÉFÉRENCES

- `docs/NOTIFICATION_FUNCTIONAL_SPECIFICATION.md` — Spécification fonctionnelle
- `docs/NOTIFICATION_RULE_MATRIX.md` — Matrice des règles
- `docs/ARCHITECTURE_NOTIFICATION_DOMAIN_V3_OFFLINE_FIRST.md` — Architecture V3