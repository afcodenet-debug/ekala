# Phase 2 — Frontend SaaS UI : Documentation

## Vue d'ensemble

Ajout du **frontend public et protégé** pour la gestion des abonnements SaaS multi-tenant.  
Flow complet : Pricing → Signup → Login → Dashboard protégé avec banner d'expiration.

## Fichiers créés / modifiés

| Fichier | Statut | Rôle |
|---------|--------|------|
| `src/pages/saas/PricingPage.tsx` | Modifié (routé) | Page `/pricing` — affichage des 6 plans |
| `src/pages/saas/SignupPage.tsx` | **Créé** | Page `/signup` — formulaire d'inscription 2 étapes |
| `src/pages/saas/BillingPage.tsx` | **Créé** | Page `/billing` — gestion abonnement + historique paiements |
| `src/components/SubscriptionExpirationBanner.tsx` | **Créé** | Banner flottant d'avertissement (≤7 jours) |
| `src/App.tsx` | Modifié | Ajout des routes + import des composants |
| `docs/saas-multitenant-phase2.md` | **Créé** | Cette documentation |

## Routes ajoutées dans `App.tsx`

| Route | Composant | Auth ? | Description |
|-------|-----------|--------|-------------|
| `/pricing` | `PricingPage` | Non | Page publique de sélection des plans |
| `/signup?plan=<code>` | `SignupPage` | Non | Inscription self-service |
| `/billing` | `BillingPage` | Oui (tous rôles) | Dashboard abonnement du tenant |

## Flow d'inscription (SignupPage)

### Étape 1 : Infos restaurant
- Nom de l'établissement
- Email du propriétaire
- Numéro de téléphone

### Étape 2 : Plan + Paiement
- Sélection du plan (chargé via `GET /api/plans`)
- Méthode de paiement (Mobile Money / Carte bancaire)
- Fournisseur (MTN Zambia, Airtel, Stripe, etc.)
- Récapitulatif

### Étape 3 : Succès
- Message de confirmation
- Lien vers `/login`

### Appel API
```json
POST /api/tenants
{
  "name": "Chez Mama Africa",
  "owner_email": "owner@mama.africa",
  "owner_phone": "+260971234567",
  "plan_code": "starter_monthly",
  "payment_method": "mobile_money",
  "payment_provider": "mtn_zm"
}
```

## Page Billing (BillingPage)

- Affiche le plan actuel avec statut (Actif / Essai / Expiré)
- Jours restants avec indicateur de couleur (orange si ≤ 7j)
- Quotas : users, tables, produits
- Bouton "Changer de plan" → `/pricing`
- Bouton "Annuler l'abonnement"
- Historique des paiements

**Note technique** : Nécessite un `tenant_id` dans le store d'authentification (`useAuthStore`).

## Banner d'expiration (SubscriptionExpirationBanner)

- Composant flottant fixé en bas de l'écran
- S'affiche automatiquement quand l'abonnement expire dans ≤ 7 jours ou est expiré
- Couleur orange pour les avertissements, rouge pour les expirations
- Bouton "Gérer mon abonnement" → `/billing`
- Bouton fermer (dismissible)
- Rendu uniquement dans la zone protégée (après `ProtectedRoute`)

## Notes pour Phase 3 (Paiement)

- Les méthodes de paiement (Mobile Money, Carte) sont actuellement des sélections UI uniquement
- L'intégration réelle de la passerelle de paiement (Stripe / Paystack / MTN MoMo) sera en Phase 3
- Les webhooks et le cron d'expiration seront aussi en Phase 3