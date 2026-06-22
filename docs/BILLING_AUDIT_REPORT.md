# AUDIT COMPLET — SYSTÈME DE BILLING VOUCHER-FIRST

**Date**: 22 Juin 2026  
**Version**: 1.0  
**Statut**: AUDIT UNIQUEMENT — Aucune modification de code

---

## 📋 EXECUTIVE SUMMARY

Le système de billing Ekala a été partiellement migré vers un modèle **Voucher-First**, mais conserve encore des traces importantes de l'ancien système **Checkout/Card Payment**. Cette audit identifie:

- **Code hérité** de l'ancien système de paiement
- **Écrans/APIs devenues inutiles**
- **Incohérences** avec le modèle Voucher-First
- **Fonctionnalités manquantes**
- **Dettes techniques** et risques

**Recommandation principale**: Finaliser la migration vers Voucher-First en éliminant progressivement le code hérité.

---

## 1. ARCHITECTURE ACTUELLE

### 1.1 Frontend

#### Pages
- **`src/pages/saas/BillingPage.tsx`** ✅
  - Écran principal de facturation
  - Gère `/billing?from=suspended`
  - Affiche plans, statut abonnement, historique paiements
  - **État**: Compatible Voucher-First

- **`src/pages/saas/PricingPage.tsx`** ⚠️
  - Page de sélection de plans
  - Redirige vers `/billing` ou `/checkout`
  - **État**: Partiellement compatible

#### Composants
- **`src/components/SubscriptionGate.tsx`** ✅
  - Guard d'accès basé sur statut abonnement
  - **État**: Compatible Voucher-First

#### Stores/Hooks
- Aucun store billing dédié identifié
- Utilisation de `useAuthStore` pour contexte utilisateur

### 1.2 Backend

#### Routes API

**Routes Voucher-First (NOUVELLES)** ✅
```
POST /api/billing/request-voucher       → Demande code voucher
POST /api/billing/payment-sent          → Déclarer paiement
GET  /api/billing/status                → Statut abonnement
GET  /api/vouchers/status/:code         → Status public voucher
POST /api/vouchers/request              → Alias public (sans auth)

POST /api/admin/subscriptions/verify    → Validation admin
POST /api/admin/subscriptions/reject    → Rejet admin
GET  /api/admin/subscriptions/pending   → Liste demandes
GET  /api/admin/vouchers/pending        → Filtres par statut
GET  /api/admin/vouchers/verified
GET  /api/admin/vouchers/expired
GET  /api/admin/vouchers/rejected
```

**Routes SaaS (ANCIENNES)** ⚠️
```
POST /api/tenants                        → Création tenant (avec payment_method)
PATCH /api/tenants/:id/subscription      → Changement plan (avec payment_method)
POST /api/tenants/:id/cancel-subscription → Annulation
GET  /api/plans                          → Liste plans
```

**Routes à investiguer** ❓
```
/api/checkout                            → Possibly legacy
/api/payments                            → Possibly legacy
/api/webhooks                            → Possibly legacy
```

#### Services
- **`src/server/services/notification.service.ts`** ✅
  - Service d'email générique
  - Utilisé pour notifications voucher
  - **État**: Compatible

- **`src/server/services/email-templates.ts`** ✅ (NOUVEAU)
  - Templates emails voucher
  - **État**: Compatible Voucher-First

#### Cron Jobs
- **`src/server/saas/cron/voucher-expiration.cron.ts`** ✅
  - Expiration automatique demandes voucher
  - Exécution: toutes les 5 minutes
  - **État**: Opérationnel

- **`src/server/saas/cron/subscription-expiration.cron.ts`** ⚠️
  - Expiration abonnements
  - **État**: À vérifier compatibilité

#### Middlewares
- **`src/middleware/subscription-guard.ts`** ✅
  - Vérifie statut abonnement
  - Gère read-only paths pour billing
  - **État**: Compatible

- **`src/middleware/subscription-audit-logger.ts`** ✅
  - Log des actions abonnement
  - **État**: Compatible

### 1.3 Base de Données SQLite

#### Tables existantes

**Tables Voucher-First (NOUVELLES)** ✅
```sql
subscription_payment_requests (034)
  - id, tenant_id, plan_id, voucher_code
  - requested_by, amount_cents, currency
  - requested_at, verification_deadline, expires_at
  - status, verified_by, verified_at
  - rejection_reason, notes
  - remote_id, created_at, updated_at

voucher_requests (035)
  - Structure similaire mais plus propre
  - Sans amount_cents/currency (héritage)
  - customer_email au lieu de requested_by

voucher_audit_logs (035)
  - id, voucher_request_id, action, actor_id, notes
  - created_at
```

**Tables existantes (ANCIENNES)** ⚠️
```sql
subscriptions
  - id, tenant_id, plan_id, status
  - started_at, current_period_start, current_period_end
  - trial_started_at, trial_ends_at
  - cancelled_at, cancel_reason
  - auto_renew, payment_method, payment_reference
  - created_at, updated_at

tenants
  - id, status, payment_method, payment_reference
  - is_provisioned, provisioned_at

plans
  - id, code, name, price_cents, currency
  - period, duration_days, features
```

**Tables de paiement (ANCIENNES)** ❓
```sql
payments
  - id, tenant_id, amount_cents, currency
  - status, payment_method, paid_at
  - payment_intent_id, provider
  - created_at, updated_at
```

### 1.4 Base de Données Supabase

#### Tables identifiées (via entity-registry.ts)

**Tables synchronisées** ✅
```
tenants, users, tenant_users
products, categories, restaurant_tables
customers, orders, order_items
sales, sale_items
expenses, suppliers, purchase_orders, purchase_order_items
inventory_movements, inventory_sessions
stock_adjustments, stock_adjustment_items
menu_categories, menu_items
settings
subscription_payment_requests (syncOrder 97)
voucher_requests (syncOrder 97)
voucher_audit_logs (syncOrder 98)
```

**Tables Supabase-only (non synchronisées)** ⚠️
```
plans
payments
vouchers (ancien système)
tenant_audit_log
```

---

## 2. CODE HÉRITÉ DE L'ANCIEN SYSTÈME CHECKOUT

### 2.1 Routes et APIs

#### A. Routes SaaS avec payment_method ❌ CRITIQUE

**Fichier**: `src/server/saas/saas.routes.ts`

**Lignes problématiques**:
- Ligne 65: `payment_method, payment_reference` dans POST /api/tenants
- Ligne 79-80: Stockage payment_method dans placeholderSub
- Ligne 83: Envoi payment_method à tenant.create()
- Ligne 168: `payment_method, payment_reference` dans PATCH subscription
- Ligne 205: Mise à jour payment_method dans subscriptions

**Impact**: 
- Ces champs sont hérités du système card payment
- Devraient être retirés ou ignorés dans Voucher-First
- Crée de la confusion dans le modèle de données

#### B. Endpoints webhooks/checkout ❌ À INVESTIGUER

**Fichier**: `src/server/server.ts`

**Lignes 255-258**:
```typescript
if (p === '/plans' || p.startsWith('/plans') || 
    p === '/tenants' || p.startsWith('/tenants/') ||
    p.startsWith('/payments') || p.startsWith('/webhooks')) {
  return next();
}
```

**Impact**:
- Routes `/payments/*` et `/webhooks/*` sont publiques
- Probablement liées à Stripe/Checkout
- À supprimer ou désactiver

### 2.2 Base de données

#### A. Table payments ❌ À SUPPRIMER

**Localisation**: Supabase uniquement

**Problèmes**:
- Table liée à l'ancien système de paiement
- Colonnes: `payment_intent_id`, `provider`, `paid_at`
- Plus utilisée dans le workflow Voucher-First
- Crée de la confusion

#### B. Colonnes héritées dans subscriptions ❌ CRITIQUE

**Table**: `subscriptions`

**Colonnes à supprimer**:
- `payment_method` → Remplacé par workflow voucher
- `payment_reference` → Remplacé par voucher_code
- `last_voucher_code` → Déjà présent, mais ambigu

**Impact**:
- Mélange ancien et nouveau modèle
- Risque d'utilisation incorrecte

#### C. Colonnes héritées dans tenants ❌ CRITIQUE

**Table**: `tenants`

**Colonnes à supprimer**:
- `payment_method` → Inutile dans Voucher-First
- `payment_reference` → Inutile dans Voucher-First

### 2.3 Frontend

#### A. BillingPage.tsx - Références checkout ⚠️

**Fichier**: `src/pages/saas/BillingPage.tsx`

**Éléments à investiguer**:
- Ligne 14: `CreditCard` icon → OK (générique)
- Historique paiements → Devrait afficher voucher_requests
- Bouton "Renouveler" → Ligne 14 dans subscription card
  ```typescript
  navigate(`/checkout?tenant_id=${currentTenantId}...`)
  ```
  **CRITIQUE**: Redirige vers `/checkout` qui n'existe plus

#### B. PricingPage.tsx ⚠️

**Fichier**: `src/pages/saas/PricingPage.tsx`

**À vérifier**:
- Boutons "Choisir ce plan"
- Redirections vers `/checkout` ou `/billing`
- Cohérence avec Voucher-First

### 2.4 Services

#### A. email-templates.ts ✅

**Fichier**: `src/server/services/email-templates.ts`

**Statut**: Compatible Voucher-First
- Templates voucher générés
- Pas de référence à Stripe/card payment

---

## 3. ÉCRANS/APIs DEVENUS INUTILES

### 3.1 APIs inutiles

#### A. GET /api/plans ⚠️

**Utilisation**: 
- Chargement plans pour PricingPage
- Toujours nécessaire pour afficher les plans

**Recommandation**: Garder, mais vérifier qu'il ne retourne pas de données checkout

#### B. PATCH /api/tenants/:id/subscription ❌

**Problème**:
- Changement de plan avec payment_method
- Dans Voucher-First, le changement se fait via nouveau voucher
- Double workflow possible

**Recommandation**: 
- Supprimer ou
- Adapter pour workflow voucher uniquement

#### C. POST /api/tenants/:id/cancel-subscription ⚠️

**Statut**: 
- Fonctionnalité toujours utile
- Mais vérifier intégration avec Voucher-First

### 3.2 Écrans inutiles

#### A. Page Checkout ❌ À SUPPRIMER

**Fichier**: Non identifié dans les tabs ouverts

**Recherche nécessaire**:
- Chercher routes `/checkout`
- Chercher composants `CheckoutPage`
- Supprimer si existe

#### B. Écrans de paiement card ❌ À SUPPRIMER

**Recherche nécessaire**:
- Chercher "card", "stripe", "payment_intent"
- Supprimer composants associés

---

## 4. INCOHÉRENCES AVEC LE MODÈLE VOUCHER-FIRST

### 4.1 Double système de stockage

#### A. Deux tables pour voucher_requests ❌ CRITIQUE

**Tables**:
1. `subscription_payment_requests` (legacy)
2. `voucher_requests` (clean)

**Problème**:
- Fallback complexe dans billing.routes.ts (lignes 125-172)
- Risque d'incohérence
- Code dupliqué

**Recommandation**:
- Standardiser sur `voucher_requests`
- Supprimer `subscription_payment_requests` après migration

### 4.2 Workflow hybride

#### A. Création tenant avec payment_method ❌

**Fichier**: `src/server/saas/saas.routes.ts:65`

**Problème**:
```typescript
const { name, owner_email, owner_phone, plan_code, payment_method, payment_reference, country, city } = req.body || {};
```

**Incohérence**:
- Accepte payment_method dans création tenant
- Mais workflow Voucher-First ne l'utilise pas
- Champ ignoré mais présent

### 4.3 Redirections obsolètes

#### A. BillingPage.tsx → /checkout ❌ CRITIQUE

**Fichier**: `src/pages/saas/BillingPage.tsx`

**Ligne approximative** (dans subscription card):
```typescript
navigate(`/checkout?tenant_id=${currentTenantId}&plan_code=${subscription.plan.code}&from=expired`);
```

**Problème**:
- Redirige vers `/checkout` qui n'existe plus
- Cas: abonnement expiré
- Utilisateur bloqué

### 4.4 Statuts de paiement

#### A. Payment status dans subscriptions ⚠️

**Table**: `subscriptions`

**Champ**: `status`

**Valeurs possibles**:
- `pending` → OK (attente validation voucher)
- `active` → OK
- `trial` → OK
- `past_due` → ❌ (hérité card payment)
- `cancelled` → OK
- `expired` → OK

**Problème**:
- `past_due` n'a pas de sens dans Voucher-First
- Pas de délai de grâce, juste expiration

---

## 5. FONCTIONNALITÉS MANQUANTES

### 5.1 Critiques (Bloquantes)

#### A. Interface admin pour validation vouchers ❌

**Manque**:
- Page web pour valider/rejeter vouchers
- Actuellement: routes API seulement
- Admin doit utiliser Postman/curl

**Recommandation**:
- Créer `/admin/vouchers` page
- Liste demandes avec filtres
- Boutons Valider/Rejeter

#### B. Historique voucher_requests dans BillingPage ❌

**Manque**:
- BillingPage affiche `payments` (ancien système)
- Devrait afficher `voucher_requests`

**Impact**:
- Utilisateur ne voit pas ses demandes de voucher
- Confusion sur l'historique

### 5.2 Importantes

#### C. Notifications temps réel ❌

**Manque**:
- WebSocket/Realtime pour statut voucher
- Admin notifié quand nouvelle demande
- Client notifié quand validé

**Recommandation**:
- Utiliser Supabase Realtime
- Ou polling côté frontend

#### D. Retry automatique sync ❌

**Manque**:
- Pas de mécanisme de retry pour sync échouée
- voucher_requests avec plan_id NULL restent en erreur

**Impact**:
- Perte de données potentielle
- Nécessite intervention manuelle

### 5.3 Mineures

#### E. Statistiques admin ❌

**Manque**:
- Dashboard admin avec métriques
- Taux de validation
- Délai moyen traitement
- Taux d'expiration

#### F. Export/Reporting ❌

**Manque**:
- Export CSV des demandes
- Reporting financier
- Historique complet

---

## 6. DETTES TECHNIQUES

### 6.1 Code dupliqué

#### A. Double logique SQLite/Supabase ❌ CRITIQUE

**Fichiers**:
- `billing.routes.ts`: 395 lignes
- `admin.subscriptions.ts`: 392 lignes

**Problème**:
- Chaque route duplique logique SQLite + Supabase
- ~50% du code est dupliqué
- Difficile à maintenir

**Exemple**:
```typescript
// SQLite
if (localDb) {
  row = localDb.prepare('SELECT ...').get(...) as any;
}
// Supabase
else if (supabase) {
  const { data, error } = await supabase.from('...').select('...');
  row = data;
}
```

**Recommandation**:
- Créer repository pattern
- `VoucherRequestRepository` avec méthodes:
  - `findById(id)`
  - `findByCode(code)`
  - `updateStatus(id, status)`
  - `insert(data)`

### 6.2 Gestion d'erreurs

#### A. Try/catch imbriqués ⚠️

**Fichier**: `billing.routes.ts:153-184`

**Problème**:
```typescript
try {
  while (attempts < 8 && !created) {
    try {
      try {
        localId = insertIntoVoucherRequests(...);
      } catch (e: any) {
        if (e?.message?.includes('no such table')) {
          // fallback
        } else {
          throw e;
        }
      }
      created = true;
    } catch (e: any) {
      // retry logic
    }
  }
}
```

**Impact**:
- Difficile à lire/maintenir
- Gestion d'erreurs dispersée

### 6.3 Configuration

#### A. Variables d'environnement manquantes ❌

**Manque**:
```bash
# Email
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# Voucher
VOUCHER_CODE_PREFIX=EKA
VOUCHER_VERIFICATION_DEADLINE_HOURS=24
VOUCHER_EXPIRATION_HOURS=48
VOUCHER_EXPIRATION_CRON_ENABLED=true
```

**Impact**:
- Hardcodé dans le code
- Difficile à changer sans redéploiement

---

## 7. RISQUES IDENTIFIÉS

### 7.1 Critiques

#### A. Perte de données voucher_requests ❌

**Risque**: Élevé

**Cause**:
- Sync échoue si plan_id ne peut être résolu
- Pas de retry automatique
- Dead letter queue pour erreurs 23502

**Impact**:
- Demandes de voucher perdues
- Clients déçus

**Mitigation**:
- Améliorer résolution FK
- Ajouter retry avec backoff
- Monitoring alertes

#### B. Redirection vers /checkout cassée ❌

**Risque**: Élevé

**Cause**:
- BillingPage redirige vers `/checkout` pour abonnements expirés
- Route n'existe plus

**Impact**:
- Utilisateur bloqué sur page 404
- Impossible de renouveler

**Mitigation**:
- Corriger redirection vers `/billing?from=expired`

### 7.2 Moyens

#### C. Code dupliqué SQLite/Supabase ⚠️

**Risque**: Moyen

**Cause**:
- Double logique dans chaque route
- Risque d'incohérence lors de modifications

**Impact**:
- Bugs difficiles à détecter
- Maintenance coûteuse

#### D. Absence interface admin ❌

**Risque**: Moyen

**Cause**:
- Pas d'UI pour valider vouchers
- Admin utilise API directement

**Impact**:
- Frein à l'adoption
- Erreurs humaines possibles

### 7.3 Faibles

#### E. Pas de tests automatisés ⚠️

**Risque**: Faible

**Cause**:
- Aucun test unitaire/intégration identifié
- Tests manuels seulement

**Impact**:
- Régressions possibles
- Dette technique

---

## 8. PRIORISATION DES ACTIONS

### 8.1 Priorité CRITIQUE (Blocant)

| # | Action | Fichier | Impact | Effort |
|---|--------|---------|--------|--------|
| 1 | Corriger redirection `/checkout` → `/billing` | BillingPage.tsx | Élevé | 1h |
| 2 | Standardiser sur `voucher_requests` uniquement | billing.routes.ts | Élevé | 4h |
| 3 | Ajouter retry automatique sync voucher_requests | generic-sync.service.ts | Élevé | 4h |
| 4 | Créer interface admin validation vouchers | Nouveau composant | Élevé | 8h |

### 8.2 Priorité MOYENNE (Important)

| # | Action | Fichier | Impact | Effort |
|---|--------|---------|--------|--------|
| 5 | Supprimer colonnes payment_method/ref | SQLite + Supabase | Moyen | 4h |
| 6 | Créer repository pattern pour vouchers | Nouveau service | Moyen | 8h |
| 7 | Afficher voucher_requests dans BillingPage | BillingPage.tsx | Moyen | 4h |
| 8 | Ajouter variables d'environnement | .env.example | Moyen | 2h |
| 9 | Implémenter notifications temps réel | WebSocket/Realtime | Moyen | 8h |

### 8.3 Priorité FAIBLE (Amélioration)

| # | Action | Fichier | Impact | Effort |
|---|--------|---------|--------|--------|
| 10 | Ajouter tests automatisés | Nouveaux fichiers | Faible | 16h |
| 11 | Créer dashboard admin statistiques | Nouveau composant | Faible | 12h |
| 12 | Export/Reporting | Nouveau service | Faible | 8h |
| 13 | Supprimer table payments Supabase | Migration | Faible | 2h |

---

## 9. RECOMMANDATIONS

### 9.1 Court terme (1-2 semaines)

1. **Corriger les bugs critiques**
   - Redirection `/checkout` cassée
   - Sync voucher_requests avec retry

2. **Finaliser migration Voucher-First**
   - Supprimer colonnes héritées
   - Standardiser sur `voucher_requests`

3. **Créer interface admin minimale**
   - Liste demandes
   - Boutons Valider/Rejeter

### 9.2 Moyen terme (1-2 mois)

1. **Refactoring technique**
   - Repository pattern
   - Éliminer duplication SQLite/Supabase

2. **Améliorer UX**
   - Historique voucher_requests dans BillingPage
   - Notifications temps réel

3. **Monitoring**
   - Alertes sync échouée
   - Métriques voucher

### 9.3 Long terme (3-6 mois)

1. **Tests automatisés**
   - Unit tests routes
   - Intégration tests sync
   - E2E tests workflow

2. **Features avancées**
   - Dashboard admin
   - Export/Reporting
   - Analytics

---

## 10. CONCLUSION

### Points forts ✅
- Architecture Voucher-First bien conçue
- Synchronisation bidirectionnelle robuste
- Templates d'emails professionnels
- Cron d'expiration automatique

### Points faibles ❌
- Code hérité encore présent
- Duplication SQLite/Supabase
- Pas d'interface admin
- Bugs critiques (redirection checkout)

### Verdict

Le système est **fonctionnel mais immature**. Il nécessite:

1. **Nettoyage** du code hérité (2-3 jours)
2. **Corrections** bugs critiques (1 jour)
3. **Interface admin** (1 semaine)
4. **Refactoring** technique (2 semaines)

**Estimation totale**: 4-6 semaines pour un système production-ready.

---

## ANNEXES

### A. Fichiers analysés

**Backend**:
- ✅ src/server/routes/billing.routes.ts
- ✅ src/server/routes/admin.subscriptions.ts
- ✅ src/server/saas/saas.routes.ts
- ✅ src/server/saas/cron/voucher-expiration.cron.ts
- ✅ src/server/services/email-templates.ts
- ✅ src/server/middleware/subscription-guard.ts
- ✅ src/sync/core/generic-sync.service.ts
- ✅ src/sync/core/entity-registry.ts

**Frontend**:
- ✅ src/pages/saas/BillingPage.tsx
- ⚠️ src/pages/saas/PricingPage.tsx (à investiguer)
- ⚠️ src/components/SubscriptionGate.tsx

**Base de données**:
- ✅ backend/migrations/034_subscription_payment_requests.sql
- ✅ backend/migrations/035_voucher_first_tables.sql
- ⚠️ Tables Supabase (à vérifier schéma complet)

### B. Recherches supplémentaires nécessaires

1. **Routes checkout/checkout**: `grep -r "checkout" src/server/routes/`
2. **Composants checkout**: `grep -r "checkout" src/pages/ src/components/`
3. **Table payments Supabase**: Vérifier si utilisée
4. **Tests existants**: `find . -name "*.test.ts" -o -name "*.spec.ts"`

---

**Fin du rapport**