# Audit Professionnel du Système d'Abonnement EKALA

**Date** : 29 Juin 2026  
**Version** : 1.0  
**Auteur** : AI Assistant  
**Statut** : Production Ready avec améliorations recommandées

---

## Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture Base de Données](#architecture-base-de-données)
3. [Services Métier](#services-métier)
4. [API Routes](#api-routes)
5. [Flux Métier](#flux-métier)
6. [Points Forts](#points-forts)
7. [Points Faibles & Risques](#points-faibles--risques)
8. [Recommandations](#recommandations)
9. [Plan d'Action](#plan-daction)

---

## Vue d'ensemble

### Stack Technique
- **Backend** : Node.js + Express + TypeScript
- **Base de données** : SQLite (local) + Supabase (cloud)
- **Frontend** : React + Vite + Zustand
- **Architecture** : Multi-tenant SaaS avec isolation par tenant_id

### Composants Principaux
- **Plans** : Catalogue des offres d'abonnement
- **Subscriptions** : Abonnements actifs des tenants
- **Vouchers** : Codes promotionnels pour activation
- **Subscription Guard** : Middleware de contrôle d'accès
- **Billing System** : Gestion des paiements et facturation

---

## Architecture Base de Données

### Tables Identifiées

#### 1. `plans` (Catalogue des offres)
```sql
- id, code, name, description
- price_cents, currency, period, duration_days
- max_users, max_tables, max_products, max_orders_per_month
- features (JSON), is_active, is_public
- trial_days, sort_order
- remote_id, version (pour sync)
```

**Données actuelles** : 6 plans
- `trial_7d` : Essai gratuit 7 jours (0 ZMW)
- `STARTER_WEEKLY` : 700 ZMW/semaine
- `STARTER_MONTHLY` : 2,800 ZMW/mois
- `PRO_MONTHLY` : 33,600 ZMW/mois
- `STARTER_ANNUAL` : 31,600 ZMW/an
- `PRO_ANNUAL` : 42,600 ZMW/an

#### 2. `subscriptions` (Abonnements locaux)
```sql
- id, tenant_id, plan_id, status
- started_at, current_period_start, current_period_end
- trial_started_at, trial_ends_at
- cancelled_at, cancel_reason
- auto_renew, payment_method, payment_reference
- remote_id, version, last_voucher_code
```

**Statuts possibles** : `pending`, `active`, `past_due`, `cancelled`, `expired`, `trial`

#### 3. `tenant_subscriptions` (Legacy/Complément)
```sql
- id, tenant_id, plan_id, status
- current_period_start, current_period_end
- trial_start, trial_end
- voucher_code
```

**Note** : Table en doublon avec `subscriptions` - à fusionner

#### 4. `vouchers` (Codes promotionnels)
```sql
- id, code (UNIQUE), plan_id
- amount_cents, currency
- max_uses, used_count
- expires_at, is_active
```

#### 5. `voucher_redemptions` (Utilisation des vouchers)
```sql
- id, voucher_id, tenant_id, user_id
- redeemed_at, amount_cents, currency
- payment_reference, status
```

#### 6. `voucher_requests` (Demandes de vouchers)
```sql
- id, tenant_id, user_id, plan_id
- code, status, requested_at
- approved_at, approved_by
- expires_at, used_at
```

#### 7. `voucher_audit_logs` (Traçabilité)
```sql
- id, voucher_id, action, actor_id
- actor_type, metadata, created_at
```

#### 8. `subscription_payment_requests` (Paiements)
```sql
- id, subscription_id, tenant_id
- amount_cents, currency, status
- payment_method, payment_reference
- requested_at, completed_at
```

---

## Services Métier

### 1. Subscription Guard Middleware
**Fichier** : `src/server/middleware/subscription-guard.ts`

**Responsabilités** :
- Vérification du statut d'abonnement avant chaque requête
- Gestion du cache (5 min TTL)
- Fallback SQLite → Supabase
- Application des règles d'accès (active/trial/grace/blocked)

**Logique actuelle** :
```typescript
// États autorisés
ALLOWED = ['active', 'trial', 'grace']

// États bloqués
BLOCKED = ['pending', 'expired', 'suspended', 'cancelled', 'no_plan', 'past_due']

// Fallback si pas de subscription
if (!subscription) {
  if (tenant.status === 'active') return 'active' // Mode Free
  if (tenant.status === 'trial') return 'trial'
  return 'no_plan'
}
```

### 2. Voucher Redemption Service
**Fichier** : `src/server/services/voucher-redemption.service.ts`

**Responsabilités** :
- Validation des codes vouchers
- Application des vouchers aux subscriptions
- Gestion des limites d'utilisation
- Audit trail

### 3. Billing Expiration Service
**Fichier** : `src/server/services/billing-expiration.service.ts`

**Responsabilités** :
- Détection des abonnements expirés
- Calcul des périodes de grâce
- Notifications d'expiration
- Cron jobs d'expiration

### 4. Subscription Application Service
**Fichier** : `src/server/application/subscription/SubscriptionApplicationService.ts`

**Responsabilités** :
- Cas d'usage métier des abonnements
- Coordination entre repositories
- Gestion des événements de domaine

---

## API Routes

### Routes Publiques
```
GET  /api/plans                    # Catalogue des plans
GET  /api/tenants/:id              # Détails d'un tenant
POST /api/tenants                  # Création de tenant
```

### Routes Protégées (JWT + Tenant Scope)
```
GET    /api/subscription/status    # Statut abonnement courant
POST   /api/subscription/select    # Sélectionner un plan
POST   /api/subscription/cancel    # Annuler abonnement
GET    /api/billing                # Page de facturation
POST   /api/vouchers/redeem        # Utiliser un voucher
GET    /api/vouchers/requests      # Mes demandes de vouchers
POST   /api/vouchers/request       # Demander un voucher
```

### Routes Admin
```
GET    /api/admin/subscriptions    # Toutes les subscriptions
POST   /api/admin/vouchers         # Créer un voucher
GET    /api/admin/vouchers         # Lister les vouchers
POST   /api/admin/vouchers/approve # Approuver une demande
```

---

## Flux Métier

### Flux 1 : Inscription avec Essai Gratuit
```
1. User s'inscrit → Création tenant (status = 'trial')
2. Système crée subscription automatique (plan = trial_7d)
3. User accède à toutes les fonctionnalités pendant 7 jours
4. J-7 : Notification de fin d'essai
5. Jour 8 : Passage en 'no_plan' → Accès restreint
```

### Flux 2 : Souscription à un Plan Payant
```
1. User consulte /pricing
2. User sélectionne un plan
3. Système crée subscription (status = 'pending')
4. User paie via Mobile Money (MTN/Airtel)
5. Admin valide le paiement
6. Subscription passe en 'active'
7. Accès complet autorisé
```

### Flux 3 : Utilisation de Voucher
```
1. Admin crée un voucher (code, plan_id, max_uses)
2. User demande un voucher sur /billing
3. User reçoit le code (email/SMS)
4. User saisit le code dans l'app
5. Système valide et applique le voucher
6. Subscription passe en 'active'
7. Voucher marqué comme utilisé
```

### Flux 4 : Renouvellement Automatique
```
1. J-3 avant expiration : Notification
2. User peut :
   a. Laisser auto_renew = true → Paiement automatique
   b. Changer de plan
   c. Annuler
3. Si paiement échoue → 'past_due' → période de grâce 7 jours
4. Si toujours pas payé → 'expired' → accès bloqué
```

---

## Points Forts

### ✅ Architecture
- Multi-tenant avec isolation forte (tenant_id)
- Double source de données (SQLite + Supabase)
- Cache intelligent pour les performances
- Système de fallback robuste

### ✅ Sécurité
- JWT authentication
- Subscription guard middleware
- Validation des inputs
- Audit logs complets

### ✅ Flexibilité
- Support de multiples périodes (weekly/monthly/annual)
- Système de vouchers flexible
- Période de grâce pour les retards de paiement
- Plans paramétrables (features JSON)

### ✅ Traçabilité
- Audit logs pour toutes les actions critiques
- Historique des paiements
- Logs de redemption de vouchers
- Métriques et monitoring

---

## Points Faibles & Risques

### ❌ Problèmes Critiques

#### 1. Doublon de Tables
- `subscriptions` ET `tenant_subscriptions` font la même chose
- Risque d'incohérence des données
- Complexité de maintenance

#### 2. Pas de Vérification de Cohérence
- Un tenant peut avoir `status = 'active'` dans `tenants` mais pas de subscription
- Le middleware actuel permet l'accès dans ce cas (mode Free)
- Risque d'évasion de paiement

#### 3. Workflow de Paiement Manuel
- Pas d'intégration avec un PSP (Payment Service Provider)
- Validation manuelle par admin
- Pas de notification automatique au paiement
- Délai d'activation de l'abonnement

#### 4. Pas de Système de Facturation
- Pas de génération de factures PDF
- Pas d'historique des paiements détaillé
- Pas de relance automatique par email

#### 5. Gestion des Limites
- Les limites (max_users, max_tables, etc.) ne sont pas vérifiées en temps réel
- Pas d'alerte avant dépassement
- Pas de blocage automatique

### ⚠️ Problèmes Moyens

#### 6. Pas de Prise en Charge Multi-Devises
- Devise hardcodée en ZMW
- Pas de conversion automatique

#### 7. Pas de Support pour les Paiements Récurrents
- auto_renew existe mais pas implémenté
- Pas d'intégration avec les APIs de Mobile Money

#### 8. Notifications Limitées
- Pas de notification SMS pour les vouchers
- Pas de rappel avant expiration
- Pas de confirmation de paiement

#### 9. Pas de Self-Service pour les Vouchers
- User ne peut pas générer ses propres vouchers
- Dépend de l'admin pour chaque activation

#### 10. Pas de Gestion des Avoirs
- Pas de remboursement
- Pas de crédit pour les services non utilisés

---

## Recommandations

### Priorité 1 (Critique - 1-2 semaines)

#### 1.1 Fusionner les Tables de Subscriptions
```sql
-- Supprimer tenant_subscriptions
-- Garder uniquement subscriptions
-- Ajouter colonne voucher_code si nécessaire
```

#### 1.2 Implémenter un Vérificateur de Limites
```typescript
// Middleware ou service qui vérifie :
// - max_users
// - max_tables
// - max_products
// - max_orders_per_month
```

#### 1.3 Créer un Workflow de Paiement Automatique
```
Intégration Mobile Money :
- MTN Mobile Money API
- Airtel Money API
- Stripe (fallback international)
```

### Priorité 2 (Importante - 2-4 semaines)

#### 2.1 Système de Facturation Automatique
```
- Génération PDF (pdfmake ou puppeteer)
- Envoi par email (nodemailer + templates)
- Historique des factures
- Téléchargement depuis /billing
```

#### 2.2 Notifications Multi-Canaux
```
- SMS (Twilio ou local provider)
- Email (SendGrid/Mailgun)
- Push notifications (Firebase)
- In-app notifications (déjà fait)
```

#### 2.3 Self-Service Voucher
```
- Page /billing/vouchers
- Génération de demande automatique
- Paiement en ligne pour obtenir un voucher
- Activation instantanée
```

### Priorité 3 (Amélioration - 1-2 mois)

#### 3.1 Dashboard Métier
```
- MRR (Monthly Recurring Revenue)
- Churn rate
- Conversion rate
- LTV (Lifetime Value)
- Cohort analysis
```

#### 3.2 Système de Parrainage
```
- Code de parrainage
- Réduction pour le parrain et le filleul
- Tracking des conversions
```

#### 3.3 Support Multi-Devises
```
- Taux de change en temps réel
- Affichage dans devise locale
- Conversion automatique
```

---

## Plan d'Action

### Phase 1 : Stabilisation (Semaine 1-2)
- [ ] Fusionner `tenant_subscriptions` dans `subscriptions`
- [ ] Corriger le middleware pour utiliser uniquement `subscriptions`
- [ ] Ajouter vérification des limites en temps réel
- [ ] Tester tous les scénarios d'abonnement

### Phase 2 : Automatisation (Semaine 3-4)
- [ ] Intégrer MTN Mobile Money API
- [ ] Intégrer Airtel Money API
- [ ] Implémenter webhooks de confirmation de paiement
- [ ] Créer système de facturation PDF
- [ ] Ajouter notifications email/SMS

### Phase 3 : Self-Service (Semaine 5-6)
- [ ] Page de gestion d'abonnement complète
- [ ] Upgrade/Downgrade en un clic
- [ ] Génération automatique de vouchers
- [ ] Portail de facturation client

### Phase 4 : Analytics (Semaine 7-8)
- [ ] Dashboard métier pour admins
- [ ] Métriques de conversion
- [ ] Rapports automatiques
- [ ] Alertes intelligentes

---

## Architecture Cible

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Pricing Page │  │ Billing Page │  │ Admin Panel  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              API GATEWAY (Express)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Auth Middle  │  │ Sub Guard    │  │ Rate Limit   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌──────────────┐
│ Plans Service   │ │ Subscription│ │ Voucher Svc  │
│ - CRUD plans    │ │ - Lifecycle │ │ - Generate   │
│ - Pricing       │ │ - Renewal   │ │ - Redeem      │
│ - Features      │ │ - Upgrade    │ │ - Validate    │
└─────────────────┘ └─────────────┘ └──────────────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│              DATA LAYER                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    SQLite    │  │   Supabase   │  │    Redis     │  │
│  │   (Local)    │  │   (Cloud)    │  │    (Cache)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌──────────────┐
│ Payment Gateway │ │   Email     │ │     SMS      │
│ - MTN Money     │ │  SendGrid   │ │   Twilio     │
│ - Airtel Money  │ │  Templates  │ │  Templates   │
│ - Stripe        │ │             │ │              │
└─────────────────┘ └─────────────┘ └──────────────┘
```

---

## Conclusion

Le système d'abonnement actuel est **fonctionnel mais basique**. Il nécessite des améliorations critiques pour être opérationnel à grande échelle en Afrique :

### Points d'Attention Majeurs
1. **Doublon de tables** : À fusionner immédiatement
2. **Pas de paiement automatique** : Bloquant pour le scaling
3. **Pas de facturation** : Non conforme pour une entreprise
4. **Limites non vérifiées** : Risque financier

### Recommandation Finale
**Approche progressive** :
1. Stabiliser l'existant (semaines 1-2)
2. Automatiser les paiements (semaines 3-4)
3. Ajouter le self-service (semaines 5-6)
4. Monitorer et optimiser (continu)

### Budget Estimé
- Développement : 4-6 semaines × 1 dev senior
- Intégrations PSP : 1-2 semaines
- Tests & QA : 1 semaine
- **Total** : 6-9 semaines

---

## Annexes

### A. Liste des Fichiers Critiques
```
src/server/middleware/subscription-guard.ts
src/server/services/voucher-redemption.service.ts
src/server/services/billing-expiration.service.ts
src/server/routes/subscription.routes.ts
src/server/routes/billing.routes.ts
src/stores/useSubscriptionStore.ts
src/pages/saas/BillingPage.tsx
src/pages/settings/SubscriptionPremiumPage.tsx
```

### B. Variables d'Environnement Requises
```env
# Payment Gateways
MTN_MONEY_API_KEY=
MTN_MONEY_API_URL=
AIRTEL_MONEY_API_KEY=
AIRTEL_MONEY_API_URL=
STRIPE_SECRET_KEY=

# Email
SENDGRID_API_KEY=
EMAIL_FROM=

# SMS
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Billing
INVOICE_PREFIX=INV-
CURRENCY=ZMW
TAX_RATE=0.16
```

### C. Tests à Implémenter
- [ ] Test création subscription
- [ ] Test renouvellement automatique
- [ ] Test expiration + période de grâce
- [ ] Test redemption voucher
- [ ] Test limites (max_users, max_orders)
- [ ] Test workflow de paiement complet
- [ ] Test notifications multi-canaux
- [ ] Test génération facture PDF

---

**Fin de l'audit**