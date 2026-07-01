# SUB-020 : Rapport de Dépendances Legacy

**Date** : 2026-06-27  
**Fichier analysé** : `src/server/routes/admin.subscriptions.ts`  
**Objectif** : Identifier et classifier les dépendances legacy pour planifier leur suppression progressive

---

## 1. Résumé Exécutif

Le fichier `admin.subscriptions.ts` contient **deux flux parallèles** :
- **Flux Legacy** : accès direct à la base de données (SQLite/Supabase)
- **Flux V2.1** : via `SubscriptionApplicationService`

**Constats** :
- ✅ Routes `/verify` et `/reject` utilisent maintenant V2.1 en priorité (SUB-016, SUB-017)
- ⚠️ Fonctions helper legacy toujours présentes (non utilisées dans les routes principales)
- ⚠️ Dual-run validator en place pour validation (SUB-018)
- ❌ Aucune suppression effectuée (conformément aux consignes)

---

## 2. Inventaire des Fonctions Legacy

### 2.1 Fonctions Helper Legacy

| Fonction | Lignes | Utilisation | Classement |
|----------|--------|--------------|------------|
| `getRequestRow(id)` | 55-67 | **CRITIQUE** - Utilisée par toutes les routes | À conserver temporairement |
| `activateTenantSub(tenantId, planId, adminUserId, nowISO, useV2Logic)` | 69-108 | **REMPLAÇABLE** - Logique dupliquée | Candidate à suppression |
| `sendApprovalEmail(requestRow, verifiedAt)` | 110-134 | **NON CRITIQUE** - Notification email | À conserver (hors scope V2.1) |
| `sendRejectionEmail(requestRow, reason, rejectedAt)` | 136-160 | **NON CRITIQUE** - Notification email | À conserver (hors scope V2.1) |

### 2.2 Routes Legacy

| Route | Méthode | Lignes | Utilisation | Classement |
|-------|---------|--------|--------------|------------|
| `/payment_sent` | GET | 163-195 | **REMPLAÇABLE** - Lecture voucher_requests | Candidate à suppression |
| `/pending` | GET | 198-231 | **REMPLAÇABLE** - Lecture subscription_payment_requests | Candidate à suppression |
| `/verified` | GET | (voir section 3) | **REMPLAÇABLE** | Candidate à suppression |
| `/expired` | GET | (voir section 3) | **REMPLAÇABLE** | Candidate à suppression |
| `/rejected` | GET | (voir section 3) | **REMPLAÇABLE** | Candidate à suppression |

### 2.3 Routes avec Double Flux (Legacy + V2.1)

| Route | Méthode | Lignes | Flux Legacy | Flux V2.1 | Classement |
|-------|---------|--------|-------------|-----------|------------|
| `/verify` | POST | 234-310 | ✅ Présent | ✅ Actif (SUB-016) | Legacy à supprimer après validation |
| `/reject` | POST | 313-410 | ✅ Présent | ✅ Actif (SUB-017) | Legacy à supprimer après validation |

---

## 3. Analyse Détaillée par Fonction

### 3.1 `getRequestRow(id)` - **CRITIQUE - À conserver temporairement**

**Raison** :  
- Utilisée par toutes les routes pour récupérer les demandes
- Abstraction nécessaire pour supporter SQLite ET Supabase
- **Action** : Conserver jusqu'à ce que V2.1 fournisse un repository dédié

**Dépendances** :
- `db` (SQLite)
- `getSupabase()` (Supabase client)

**Plan de migration** :
1. Créer `VoucherRequestRepository` dans V2.1
2. Migrer `getRequestRow` vers le repository
3. Supprimer la fonction helper

---

### 3.2 `activateTenantSub()` - **REMPLAÇABLE - Candidate à suppression**

**Raison** :  
- Contient la logique métier legacy d'activation
- **Déjà remplacée** par `subscriptionAppService.activateSubscription()` dans `/verify`
- Code dupliqué et non utilisé dans le flux principal

**Code mort** :
```typescript
// Lignes 79-95 : Legacy SQLite (jamais exécuté si useV2Logic=true)
// Lignes 96-108 : Legacy Supabase (jamais exécuté si useV2Logic=true)
```

**Action** :  
- ✅ Marquer comme `@deprecated`
- ✅ Ajouter un commentaire "Legacy - à supprimer après validation V2.1"
- ❌ Ne pas supprimer (risque de régression)

---

### 3.3 `sendApprovalEmail()` / `sendRejectionEmail()` - **NON CRITIQUE - À conserver**

**Raison** :  
- Fonctions de notification (hors scope domaine V2.1)
- Utilisent `sendEmailDirect()` et templates HTML
- **Action** : Conserver (responsabilité infrastructure)

**Note** :  
Ces fonctions pourraient être déplacées vers un `NotificationService` dédié plus tard.

---

### 3.4 Routes GET Legacy - **REMPLAÇABLES - Candidates à suppression**

**Routes concernées** :
- `GET /payment_sent` (lignes 163-195)
- `GET /pending` (lignes 198-231)
- `GET /verified` (lignes ~450-500)
- `GET /expired` (lignes ~500-550)
- `GET /rejected` (lignes ~550-593)

**Raison** :  
- Retournent des données brutes depuis `voucher_requests` / `subscription_payment_requests`
- **Doublon** avec les routes V2.1 qui utilisent le repository
- Tables en fallback legacy (`subscription_payment_requests`)

**Action** :  
1. Vérifier que les routes V2.1 retournent les mêmes données
2. Marquer les routes legacy comme `@deprecated`
3. Supprimer après validation (Phase 8)

---

## 4. Dépendances Externes Legacy

### 4.1 Imports Legacy

```typescript
// Ligne 8 : Supabase client (legacy)
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Ligne 11 : Base de données SQLite (legacy)
import { db } from '../db/database';

// Ligne 13 : withOutboxTransaction (legacy sync)
import { withOutboxTransaction } from '../../sync/with-outbox-transaction';

// Ligne 14 : queueSyncChange (legacy sync)
import { queueSyncChange } from '../../sync/sync-helper';

// Ligne 15-16 : Email service (legacy)
import { sendEmailDirect, loadRawSettings } from '../services/notification.service';
import { buildPaymentVerifiedEmailHTML, buildPaymentRejectedEmailHTML } from '../services/email-templates';
```

**Classement** :

| Import | Remplaçable par V2.1 | Action |
|--------|----------------------|--------|
| `SupabaseClient` | ❌ Non (infrastructure) | Conserver |
| `db` (SQLite) | ❌ Non (infrastructure) | Conserver |
| `withOutboxTransaction` | ⚠️ Partiellement (sync V2.1 existe) | Évaluer en Phase 8 |
| `queueSyncChange` | ⚠️ Partiellement (sync V2.1 existe) | Évaluer en Phase 8 |
| `sendEmailDirect` | ❌ Non (notification) | Conserver |
| `buildPaymentVerifiedEmailHTML` | ❌ Non (template) | Conserver |

---

## 5. Plan de Suppression Progressif

### Phase 7 (Actuelle) : Validation
- [x] SUB-016 : Brancher V2.1 dans `/verify`
- [x] SUB-017 : Brancher V2.1 dans `/reject`
- [x] SUB-018 : Dual-run validator en place
- [x] SUB-019 : Value Objects utilisés dans ApplicationService
- [ ] **SUB-020** : Marquer les fonctions legacy comme dépréciées (CE DOCUMENT)

### Phase 8 (Future) : Migration Complète

**Étape 1** : Marquer le code legacy (sans supprimer)
```typescript
/** @deprecated Legacy code - à supprimer après validation V2.1 (SUB-020) */
async function activateTenantSub(...) { ... }
```

**Étape 2** : Créer les repositories V2.1 manquants
- `VoucherRequestRepository`
- `SubscriptionPaymentRequestRepository`

**Étape 3** : Migrer les routes GET vers V2.1
- Implémenter les queries dans `SubscriptionApplicationService`
- Tester en dual-run (SUB-018)

**Étape 4** : Supprimer le code legacy (après validation)
- Supprimer `activateTenantSub()`
- Supprimer les routes GET legacy
- Supprimer `getRequestRow()` (remplacé par repository)

**Étape 5** : Nettoyer les imports
- Supprimer les imports Supabase/SQLite inutilisés
- Supprimer `withOutboxTransaction` et `queueSyncChange` si sync V2.1 est stable

---

## 6. Matrice de Risque

| Fonction | Risque de Suppression | Impact si supprimé prématurément | Mitigation |
|----------|----------------------|----------------------------------|------------|
| `getRequestRow()` | 🔴 ÉLEVÉ | Toutes les routes cassées | Attendre repository V2.1 |
| `activateTenantSub()` | 🟢 FAIBLE | Aucun (déjà remplacé) | Supprimer en Phase 8 |
| `sendApprovalEmail()` | 🟡 MOYEN | Notifications cassées | Conserver (hors scope) |
| `sendRejectionEmail()` | 🟡 MOYEN | Notifications cassées | Conserver (hors scope) |
| Routes GET legacy | 🟢 FAIBLE | Fonctionnalité lecture perdue | Attendre validation V2.1 |

---

## 7. Recommandations

### Court Terme (Phase 7)
1. ✅ **Ne rien supprimer** (conformément aux consignes)
2. ✅ **Ajouter des commentaires `@deprecated`** sur les fonctions candidates
3. ✅ **Activer le dual-run validator** (SUB-018) pour collecter des données
4. ✅ **Monitorer le match rate** entre legacy et V2.1

### Moyen Terme (Phase 8)
1. Créer les repositories V2.1 manquants
2. Migrer progressivement les routes GET vers V2.1
3. Supprimer `activateTenantSub()` (déjà remplacé)
4. Supprimer les routes GET legacy une fois V2.1 validé

### Long Terme (Phase 9+)
1. Évaluer la suppression de `withOutboxTransaction` et `queueSyncChange`
2. Déplacer les notifications email vers un service dédié
3. Supprimer `getRequestRow()` après migration complète

---

## 8. Conclusion

**État actuel** :  
- Flux principal (`/verify`, `/reject`) : ✅ V2.1 actif
- Fonctions helper legacy : ⚠️ Présentes mais marquées comme candidates
- Aucune régression fonctionnelle

**Prochaines étapes** :  
1. Valider V2.1 en production avec dual-run (SUB-018)
2. Collecter des statistiques de concordance
3. Supprimer progressivement le code legacy (Phase 8)

**Aucune suppression effectuée** - Ce rapport sert de référence pour la Phase 8.

---

*Généré par SUB-020 - Audit des dépendances legacy*