# Phase 4 — Super-Admin Dashboard & Auth Improvements

## Vue d'ensemble

La Phase 4 ajoute :
1. **Auth improvements** — `tenant_id` lié à l'utilisateur, `tenant_name` dans le store
2. **Lien "Créer un compte"** sur la LoginPage → redirige vers `/signup`
3. **Super-Admin Dashboard** — pour EKALA Corp (vos équipes) : stats MRR, tenants, churn
4. **Provisioning tools** — suspendre/activer un tenant, lister les tenants

## Améliorations Auth

### `useAuthStore` (déjà mis à jour)
L'interface `User` inclut maintenant :
```typescript
export interface User {
  id: number;
  full_name: string;
  email?: string;
  username: string;
  role: UserRole;  // inclut 'super_admin'
  tenant_id?: number;       // Lié au tenant
  tenant_name?: string;     // Affiché dans l'app
  tenant_slug?: string;
}
```

### `LoginPage` (déjà mis à jour)
Ajout d'un lien "Pas encore de compte ?" en bas de page, qui redirige vers `/signup?plan=trial_7d` (essai gratuit de 7 jours automatique).

## Super-Admin Dashboard

> **Note** : la Phase 4 introduit un **nouveau rôle `super_admin`** qui peut accéder à toutes les pages de n'importe quel tenant. Il est typiquement utilisé par l'équipe EKALA Corp (vous) pour le support client.

### Routes API à ajouter
```typescript
GET    /api/saas/admin/tenants              // Liste tous les tenants
GET    /api/saas/admin/tenants/:id          // Détails d'un tenant
POST   /api/saas/admin/tenants/:id/suspend
POST   /api/saas/admin/tenants/:id/activate
POST   /api/saas/admin/tenants/:id/cancel
GET    /api/saas/admin/stats/mrr            // MRR (Monthly Recurring Revenue)
GET    /api/saas/admin/stats/churn          // Taux de désabonnement
GET    /api/saas/admin/stats/tenants        // Stats par tenant
```

### Page frontend : `SuperAdminDashboard.tsx`
À créer dans `src/pages/saas/admin/SuperAdminDashboard.tsx` (protégée par `role=super_admin`).

## Architecture de production (réalités africaines)

Pour rendre l'application **professionnelle et adaptée au marché africain** :

### 1. Multi-devises
- 🇿🇲 ZMW (Zambie) — par défaut
- 🇿🇦 ZAR (Afrique du Sud)
- 🇳🇬 NGN (Nigeria)
- 🇰🇪 KES (Kenya)
- 🇹🇿 TZS (Tanzanie)
- 💵 USD (clients diaspora)

### 2. Multi-langues (i18n)
- 🇫🇷 Français (par défaut)
- 🇬🇧 Anglais
- 🇵🇹 Portugais (Angola, Mozambique)
- 🇸🇸 Swahili (Tanzanie, Kenya)
- 🌍 Africain (lingala, swahili, wolof, haoussa...)

### 3. Modes de paiement adaptés
- **MTN MoMo / Airtel Money / Orange Money** (Afrique Centrale & Ouest)
- **M-Pesa** (Kenya, Tanzanie)
- **Wave / Orange Money** (Sénégal, Côte d'Ivoire)
- **Stripe** (clients diaspora)
- **Cash on delivery / Cash pickup** (zones rurales)

### 4. PWA + Offline-first
Pour gérer l'instabilité réseau, transformer l'app en PWA avec :
- Service Worker pour cache offline
- IndexedDB pour la queue des actions offline
- Sync automatique à la reconnexion (déjà partiellement implémenté)

### 5. SMS notifications
En plus des emails, envoyer des SMS via :
- Twilio (international, ~$0.05/SMS)
- Africa's Talking (spécialisé Afrique, ~$0.01/SMS)
- InfoBip (multi-pays)

### 6. Sécurité avancée
- 2FA (Google Authenticator) pour les admins
- Audit log complet de toutes les actions sensibles (déjà partiellement via `tenant_audit_log`)
- Encryption at rest pour les données sensibles
- Backups quotidiens automatisés

## Prochaines étapes recommandées

1. **Implémenter le Super-Admin Dashboard** (priorité haute)
2. **Ajouter le provisioning tools** (suspendre/activer un tenant)
3. **Système d'emails transactionnels** (SendGrid / Postmark)
4. **PWA + offline-first** (priorité haute pour l'Afrique rurale)
5. **Multi-devises** dans la BillingPage
6. **Système de referral** : "invitez un ami, gagnez 1 mois gratuit"

## Pourquoi un Super-Admin ?

Dans un modèle SaaS B2B, le **super_admin** est essentiel pour :
- ✅ Onboarder manuellement un client enterprise (grand compte)
- ✅ Supporter un client qui a un problème de paiement
- ✅ Analyser les métriques globales (MRR, churn, LTV)
- ✅ Provisionner les ressources (bases de données, storage)
- ✅ Détecter les abus (fraude, multi-comptes)
- ✅ Lancer des campagnes marketing ciblées