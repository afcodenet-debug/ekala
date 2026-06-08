# Phase 3 — Intégration Paiement : Documentation

## Vue d'ensemble

Phase 3 ajoute l'intégration complète des paiements (Stripe + Mobile Money) avec :
- **Mode MOCK par défaut** : aucun secret API requis, paiement simulé pour le dev/test
- **Mode LIVE** : Stripe + Paystack + MTN MoMo + Airtel Money (Zambie) + Zamtel Kwacha
- **Webhooks** : Stripe + Mobile Money (MTN/Airtel)
- **Cron d'expiration** : toutes les heures, marque les abonnements expirés + suspend les tenants
- **Factures auto-générées** : numéro unique `INV-YYYY-NNNNN`
- **Page de checkout frontend** : instructions USSD/redirect + confirmation

## Architecture

```
src/server/saas/
├── payments/
│   ├── payment.types.ts          # Interfaces PaymentProvider, CheckoutInput, etc.
│   ├── mock.provider.ts          # MockPaymentProvider (mode dev)
│   ├── stripe.provider.ts        # StripePaymentProvider (cartes)
│   ├── mobile-money.provider.ts  # MobileMoneyPaymentProvider (MTN/Airtel/Zamtel)
│   └── payment.service.ts        # Factory qui sélectionne le bon provider
├── cron/
│   └── subscription-expiration.cron.ts  # Cron horaire
├── services/
│   └── invoice.service.ts        # Génération de factures
└── saas-payment.routes.ts        # Routes /api/payments/* + webhooks

src/pages/saas/
├── PricingPage.tsx     # (Phase 2)
├── SignupPage.tsx     # (Phase 2 + redirige vers /checkout)
├── BillingPage.tsx    # (Phase 2)
└── CheckoutPage.tsx   # (Phase 3) — Instructions de paiement
```

## Routes API ajoutées

| Méthode | URL | Description |
|---------|-----|-------------|
| `GET`  | `/api/payments/status` | État des providers configurés |
| `POST` | `/api/tenants/:id/checkout` | Initie un paiement, retourne URL/USS + reference |
| `GET`  | `/api/payments/:providerRef/status` | Vérifie le statut (mock ou live) |
| `POST` | `/api/payments/:providerRef/confirm` | Confirme manuellement (MOCK) |
| `POST` | `/api/webhooks/stripe` | Reçoit les webhooks Stripe |
| `POST` | `/api/webhooks/mobile-money` | Reçoit les webhooks MTN/Airtel |

## Variables d'environnement

Voir `.env.example` :

```bash
# Mode paiement : 'mock' (par défaut) | 'live'
PAYMENT_MODE=mock

# Active le cron d'expiration (toutes les heures)
SAAS_CRON_ENABLED=true

# URL du frontend (pour les redirects de paiement)
FRONTEND_BASE_URL=https://ekala.vercel.app

# --- Stripe (LIVE) ---
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# --- Paystack (LIVE) ---
PAYSTACK_SECRET_KEY=

# --- Mobile Money Zambia (LIVE) ---
MTN_MOMO_API_KEY=
MTN_MOMO_SUBSCRIPTION_KEY=
AIRTEL_MOMO_CLIENT_ID=
AIRTEL_MOMO_CLIENT_SECRET=
ZAMTEL_MOMO_API_KEY=
```

## Flow utilisateur (Mode MOCK — par défaut)

1. **Inscription** : `/signup` → remplit nom + email + sélectionne un plan payant
2. **Création tenant** : `POST /api/tenants` → tenant créé
3. **Redirection checkout** : `SignupPage` redirige vers `/checkout?tenant_id=X&plan_code=Y&method=mobile_money&provider=mtn_zm`
4. **Initiation paiement** : `CheckoutPage` appelle `POST /api/tenants/:id/checkout` → reçoit USSD code `*165#` + instructions
5. **Confirmation manuelle** : utilisateur clique "J'ai effectué le paiement" → `POST /api/payments/:ref/confirm` → statut `completed`
6. **Facture + activation** : `InvoiceService.create()` + subscription `status=active`
7. **Redirection** : `CheckoutPage` redirige vers `/login?payment=success`

## Flow utilisateur (Mode LIVE — Stripe)

1. Même chose jusqu'à l'étape 4
2. Stripe Checkout Session créée via `stripe.checkout.sessions.create()`
3. **Redirect URL** retournée → utilisateur redirigé vers Stripe
4. Après paiement, Stripe envoie un webhook à `POST /api/webhooks/stripe`
5. Le webhook handler vérifie la signature, met à jour le statut du paiement
6. `current_period_end` est mis à jour, facture créée

## Cron d'expiration

Démarré automatiquement dans `server.ts` au boot (sauf si `SAAS_CRON_ENABLED=false`).

Toutes les heures, le cron :
1. Met `status=expired` pour les abonnements `active` dont `current_period_end < now`
2. Met `status=expired` pour les abonnements `trial` dont `trial_ends_at < now`
3. Suspend les tenants qui n'ont **aucun** abonnement actif (`active` ou `trial`)

Pour tester manuellement :
```bash
curl -X POST http://localhost:3001/api/admin/run-expiration-check \
  -H "Content-Type: application/json" -d '{}'
```

## Notes pour passer en LIVE

1. **Stripe** :
   - Créer un compte sur https://dashboard.stripe.com
   - Récupérer `STRIPE_SECRET_KEY` (sk_live_...) et `STRIPE_WEBHOOK_SECRET` (whsec_...)
   - Installer le package : `npm install stripe`
   - Implémenter `checkout()` dans `stripe.provider.ts` (actuellement throws en LIVE)
   - Configurer l'URL webhook : `https://your-api.com/api/webhooks/stripe`

2. **MTN MoMo** :
   - S'inscrire sur https://momodeveloper.mtn.com/
   - Récupérer `API Key` (UUID) et `Subscription Key`
   - Implémenter `checkout()` dans `mobile-money.provider.ts` (API call)
   - URL : https://momodeveloper.mtn.com/api-documentation/api-description/

3. **Airtel Money** :
   - S'inscrire sur https://developers.airtel.africa/
   - Récupérer `Client ID` et `Client Secret`

## Limitations connues

- **Stripe LIVE** : `checkout()` throws en mode LIVE (à implémenter avec le SDK `stripe`)
- **Mobile Money LIVE** : `checkout()` retourne des instructions USSD statiques (à implémenter avec l'API réelle)
- **Facture PDF** : pas de génération PDF pour l'instant (juste numéro + montant)
- **Emails** : pas d'envoi d'email automatique après paiement (Phase 4)
- **Multi-tenant payment portal** : pas encore de page d'admin pour gérer les paiements (Phase 4)

## Tests rapides

```bash
# 1. Vérifier l'état des providers
curl http://localhost:3001/api/payments/status

# 2. Tester un checkout (mock)
curl -X POST http://localhost:3001/api/tenants/1/checkout \
  -H "Content-Type: application/json" \
  -d '{"plan_code":"starter_monthly","payment_method":"mobile_money","payment_provider":"mtn_zm"}'

# 3. Confirmer un paiement (mock)
curl -X POST http://localhost:3001/api/payments/mock_xxx/confirm
```

## Fichiers livrés

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `src/server/saas/payments/payment.types.ts` | ~80 | Interfaces PaymentProvider |
| `src/server/saas/payments/mock.provider.ts` | ~90 | Provider mock |
| `src/server/saas/payments/stripe.provider.ts` | ~110 | Provider Stripe |
| `src/server/saas/payments/mobile-money.provider.ts` | ~140 | Provider MoMo Zambia |
| `src/server/saas/payments/payment.service.ts` | ~120 | Factory |
| `src/server/saas/cron/subscription-expiration.cron.ts` | ~140 | Cron horaire |
| `src/server/saas/services/invoice.service.ts` | ~95 | Génération factures |
| `src/server/saas/saas-payment.routes.ts` | ~210 | Routes paiement + webhooks |
| `src/pages/saas/CheckoutPage.tsx` | ~210 | Page frontend checkout |
| `docs/saas-multitenant-phase3.md` | — | Cette doc |