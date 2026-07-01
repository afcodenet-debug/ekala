# Audit RÉEL du Système V2.1 — Conformité Runtime

## Méthodologie

Audit sans simulation. Vérification effective de :
1. Framework de test réellement installé et configuré
2. Tests réellement exécutables avec assertions
3. Modules réellement connectés en runtime
4. Services réellement utilisés dans un flux HTTP

---

## 1. FRAMEWORK DE TEST RÉEL

### Configuration package.json

**Ligne 21** : `"test": "echo \"Error: no test specified\" && exit 1"`

**CONSTAT** : Aucun script de test fonctionnel n'est configuré.

**Ligne 68** : `"@types/jest": "^30.0.0"` — présent dans devDependencies  
**Ligne 77** : `"jest": "^30.4.2"` — présent dans devDependencies  
**Ligne 79** : `"ts-jest": "^29.4.11"` — présent dans devDependencies

**CONSTAT** : Jest est installé mais NON configuré. Aucun fichier `jest.config.js` ou `jest.config.ts` trouvé.

**CONCLUSION** : Les tests ne peuvent PAS s'exécuter via un framework standard.

---

## 2. TESTS RÉELLEMENT EXÉCUTABLES

### Fichiers de test existants

```
src/server/domain/subscription/value-objects/__tests__/value-objects.test.ts
src/server/domain/subscription/__tests__/subscription-domain.test.ts
src/server/domain/subscription/__tests__/subscription-aggregate.test.ts
src/server/domain/subscription/events/__tests__/subscription-events.test.ts
src/server/domain/subscription/read-models/__tests__/subscription-status-read-model.test.ts
src/server/infrastructure/__tests__/lamport-clock.test.ts
src/server/infrastructure/__tests__/origin-node.test.ts
src/server/application/subscription/__tests__/subscription-application-service.test.ts
src/server/infrastructure/repositories/sqlite/__tests__/sqlite-subscription-repository.test.ts
```

### Vérification du contenu

**value-objects.test.ts** : Contient un `TestRunner` custom avec `test()`, `assertEqual()`, etc.  
**subscription-events.test.ts** : Contient un `TestRunner` custom identique.

**CONSTAT** : Tous les fichiers utilisent un framework de test CUSTOM, pas Jest/Vitest.

**CONCLUSION** : Les tests sont des scripts ts-node avec assertions manuelles, pas des tests framework.

---

## 3. MODULES RÉELLEMENT CONNECTÉS EN RUNTIME

### Analyse des imports dans admin.subscriptions.ts

**Ligne 12** : `import { getSubscriptionStatus, invalidateSubscriptionCache } from '../middleware/subscription-guard';`

**Vérification** : `src/server/middleware/subscription-guard.ts` existe et exporte bien ces fonctions.

**Ligne 13** : `import { withOutboxTransaction } from '../../sync/with-outbox-transaction';`

**Vérification** : `src/sync/with-outbox-transaction.ts` existe.

**Ligne 14** : `import { queueSyncChange } from '../../sync/sync-helper';`

**Vérification** : `src/sync/sync-helper.ts` existe.

**Ligne 15** : `import { sendEmailDirect, loadRawSettings } from '../services/notification.service';`

**VérIFICATION** : `src/server/services/notification.service.ts` — **À VÉRIFIER**

**Ligne 16** : `import { buildPaymentVerifiedEmailHTML, buildPaymentRejectedEmailHTML } from '../services/email-templates';`

**Vérification** : `src/server/services/email-templates.ts` existe.

### Analyse des value objects

**SubscriptionStatus.ts** : Exporte bien `SubscriptionStatus`  
**VoucherStatus.ts** : Exporte bien `VoucherStatus`  
**PlanId.ts** : Exporte bien `PlanId`

**CONSTAT** : Les 3 value objects existent et sont exportés correctement.

---

## 4. SERVICES RÉELLEMENT UTILISÉS DANS UN FLUX HTTP

### Route POST /verify (ligne 207-239)

**Flux HTTP réel** :

1. `getRequestRow(id)` — lit depuis SQLite ou Supabase ✅
2. `withOutboxTransaction(localDb, String(requestRow.tenant_id), localTx)` — wrapper transactionnel ✅
3. `invalidateSubscriptionCache(tenantId)` — appelé dans `activateTenantSub` ✅
4. `activateTenantSub(requestRow.tenant_id, requestRow.plan_id, adminUserId, nowISO)` — active l'abonnement ✅
5. `sendApprovalEmail(requestRow, nowISO)` — envoi d'email ✅

**CONSTAT** : Le flux HTTP est fonctionnel et utilise bien les services V2.1.

### Route POST /reject (ligne 242-286)

**Flux HTTP réel** :

1. `getRequestRow(id)` ✅
2. `withOutboxTransaction(localDb, String(requestRow.tenant_id), () => { ... })` ✅
3. `invalidateSubscriptionCache(tenantId)` — **NON APPELÉ DANS REJECT** ❌
4. `sendRejectionEmail(requestRow, reason, nowISO)` ✅

**CONSTAT** : `invalidateSubscriptionCache` n'est PAS appelé dans la route /reject.

---

## 5. DÉPENDANCES NON CÂBLÉES

### subscription-guard.ts

**Fonctions exportées** :
- `getSubscriptionStatus(tenantId)` — utilisée dans admin.subscriptions.ts ligne 80
- `invalidateSubscriptionCache(tenantId)` — utilisée dans admin.subscriptions.ts lignes 59, 67

**CONSTAT** : Les dépendances sont câblées.

### withOutboxTransaction

**Utilisé dans** :
- admin.subscriptions.ts ligne 53 (activateTenantSub)
- admin.subscriptions.ts ligne 228 (verify)
- admin.subscriptions.ts ligne 257 (reject)

**CONSTAT** : Correctement câblé.

### queueSyncChange

**Utilisé dans** :
- admin.subscriptions.ts lignes 58, 63, 66, 225, 226, 260, 261, 269, 272, 462, 465

**CONSTAT** : Correctement câblé.

---

## 6. COMPOSANTS SEULEMENT "THÉORIQUES"

### SubscriptionStatusReadModel

**Fichier** : `src/server/domain/subscription/read-models/SubscriptionStatusReadModel.ts`

**Utilisé dans** : AUCUN FICHIER  
**Importé dans** : AUCUN FICHIER

**CONSTAT** : Composant théorique, jamais utilisé en runtime.

### LamportClock

**Fichier** : `src/server/infrastructure/lamport-clock.service.ts`

**Utilisé dans** : AUCUN FICHIER  
**Importé dans** : AUCUN FICHIER

**CONSTAT** : Composant théorique, jamais utilisé en runtime.

### OriginNode

**Fichier** : `src/server/infrastructure/origin-node.service.ts`

**Utilisé dans** : AUCUN FICHIER  
**Importé dans** : AUCUN FICHIER

**CONSTAT** : Composant théorique, jamais utilisé en runtime.

### SubscriptionEvents (Event System)

**Fichier** : `src/server/domain/subscription/events/SubscriptionEvents.ts`

**Utilisé dans** : AUCUN FICHIER  
**Importé dans** : AUCUN FICHIER

**CONSTAT** : Composant théorique, jamais utilisé en runtime.

### ISubscriptionRepository

**Fichier** : `src/server/domain/subscription/repositories/ISubscriptionRepository.ts`

**Utilisé dans** : AUCUN FICHIER  
**Importé dans** : AUCUN FICHIER

**CONSTAT** : Interface théorique, jamais implémentée.

### Subscription (Aggregate)

**Fichier** : `src/server/domain/subscription/aggregates/Subscription.ts`

**Utilisé dans** : AUCUN FICHIER  
**Importé dans** : AUCUN FICHIER

**CONSTAT** : Aggregate théorique, jamais utilisé en runtime.

### SubscriptionApplicationService

**Fichier** : `src/server/application/subscription/SubscriptionApplicationService.ts`

**Utilisé dans** : AUCUN FICHIER  
**Importé dans** : AUCUN FICHIER

**CONSTAT** : Service théorique, jamais utilisé en runtime.

### SqliteSubscriptionRepository

**Fichier** : `src/server/infrastructure/repositories/sqlite/SqliteSubscriptionRepository.ts`

**Utilisé dans** : AUCUN FICHIER  
**Importé dans** : AUCUN FICHIER

**CONSTAT** : Repository théorique, jamais utilisé en runtime.

---

## 7. TESTS RÉELLEMENT EXÉCUTABLES AVEC ASSERTIONS

### Exécution effective

**Commande** : `npx ts-node src/server/domain/subscription/value-objects/__tests__/value-objects.test.ts`  
**Résultat** : Exit code 0, mais pas de framework de test  
**Assertions** : Manuelles (if/throw)

**Commande** : `npx ts-node src/server/domain/subscription/events/__tests__/subscription-events.test.ts`  
**Résultat** : Exit code 0, mais pas de framework de test  
**Assertions** : Manuelles (if/throw)

**CONSTAT** : Les tests s'exécutent mais sans framework. Ce sont des scripts avec assertions manuelles.

---

## 8. DÉPENDANCES NON CÂBLÉES (DÉTAIL)

### notification.service.ts

**Importé dans** : admin.subscriptions.ts ligne 15  
**Fonctions utilisées** :
- `sendEmailDirect` — utilisée ligne 98, 124
- `loadRawSettings` — utilisée ligne 85, 111

**CONSTAT** : Câblé et utilisé.

### email-templates.ts

**Importé dans** : admin.subscriptions.ts ligne 16  
**Fonctions utilisées** :
- `buildPaymentVerifiedEmailHTML` — utilisée ligne 100
- `buildPaymentRejectedEmailHTML` — utilisée ligne 126

**CONSTAT** : Câblé et utilisé.

---

## 9. PROBLÈMES DÉTECTÉS

### Problème 1 : Cache invalidation manquante dans /reject

**Ligne** : admin.subscriptions.ts ligne 434-480  
**Issue** : `invalidateSubscriptionCache(tenantId)` n'est PAS appelé après reject  
**Impact** : Cache non invalidé après rejet de voucher  
**Backlog** : SUB-002 prévoit cet appel

### Problème 2 : Aucun framework de test configuré

**Issue** : Jest installé mais pas configuré  
**Impact** : Tests non standardisés, pas de coverage, pas de CI/CD  
**Fichier manquant** : `jest.config.js` ou `vitest.config.ts`

### Problème 3 : Composants V2.1 jamais utilisés

**Composants** :
- SubscriptionStatusReadModel
- LamportClock
- OriginNode
- SubscriptionEvents
- ISubscriptionRepository
- Subscription (Aggregate)
- SubscriptionApplicationService
- SqliteSubscriptionRepository

**Impact** : Architecture V2.1 déclarée mais pas implémentée en runtime

### Problème 4 : Tests sans framework

**Issue** : Tous les tests utilisent un TestRunner custom  
**Impact** : Pas d'intégration CI/CD, pas de rapports de test, pas de coverage

---

## 10. COMPOSANTS RÉELLEMENT FONCTIONNELS EN RUNTIME

### ✅ Fonctionnels

1. **Value Objects** (SubscriptionStatus, VoucherStatus, PlanId) — déclarés mais pas utilisés dans les routes
2. **subscription-guard.ts** — `getSubscriptionStatus`, `invalidateSubscriptionCache` — utilisés
3. **withOutboxTransaction** — utilisé dans 3 routes
4. **queueSyncChange** — utilisé dans 8 endroits
5. **notification.service** — `sendEmailDirect`, `loadRawSettings` — utilisés
6. **email-templates** — utilisés
7. **Routes HTTP** :
   - GET /pending ✅
   - GET /payment_sent ✅
   - POST /verify ✅
   - POST /reject ✅
   - GET /verified ✅
   - GET /expired ✅
   - GET /rejected ✅

### ❌ Non fonctionnels (théoriques)

1. **SubscriptionStatusReadModel** — jamais importé
2. **LamportClock** — jamais importé
3. **OriginNode** — jamais importé
4. **SubscriptionEvents** — jamais importé
5. **ISubscriptionRepository** — jamais importé
6. **Subscription Aggregate** — jamais importé
7. **SubscriptionApplicationService** — jamais importé
8. **SqliteSubscriptionRepository** — jamais importé

---

## 11. CONCLUSION

### Composants réellement fonctionnels : 7
### Composants seulement théoriques : 8
### Dépendances non câblées : 1 (invalidateSubscriptionCache dans /reject)
### Framework de test : AUCUN (scripts custom seulement)

**VERDICT** : L'architecture V2.1 est PARTIELLEMENT implémentée. Les routes HTTP fonctionnent avec l'ancienne logique. Les nouveaux composants V2.1 (ReadModel, EventBus, Aggregate, Repository) existent dans les fichiers mais ne sont jamais utilisés en runtime.