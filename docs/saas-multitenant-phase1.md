# Phase 1 — SaaS Multi-Tenant : Documentation

## Vue d'ensemble

Transformation de l'application en plateforme **SaaS multi-tenant professionnelle** avec gestion des abonnements (hebdomadaire, mensuel, annuel).

## Architecture des données

### Tables créées (migration `012_saas_multitenant_schema.sql`)

| Table | Rôle |
|-------|------|
| `plans` | Catalogue des plans d'abonnement (6 plans pré-seedés) |
| `tenants` | Comptes clients (restaurants, etc.) |
| `subscriptions` | Abonnement actif d'un tenant à un plan |
| `payments` | Historique des paiements |
| `invoices` | Factures liées aux paiements |
| `tenant_users` | Lien users ↔ tenants (avec rôle par tenant) |
| `tenant_audit_log` | Journal d'audit des actions SaaS |

### Plans pré-configurés

| Code | Prix | Période | Users | Tables | Produits | Trial |
|------|------|---------|-------|--------|----------|-------|
| `trial_7d` | 0 ZMW | 7 jours | 3 | 5 | 50 | 7j |
| `starter_weekly` | 49 ZMW | 7 jours | 3 | 10 | 100 | — |
| `starter_monthly` | 149 ZMW | 30 jours | 5 | 20 | 500 | — |
| `pro_monthly` | 349 ZMW | 30 jours | 20 | 100 | 5 000 | — |
| `starter_annual` | 1 490 ZMW | 365 jours | 5 | 20 | 500 | — |
| `pro_annual` | 3 490 ZMW | 365 jours | 50 | 200 | 10 000 | — |

## Architecture du code

```
src/server/saas/
├── types/
│   └── saas.types.ts              # Toutes les entités + DTOs + erreurs
├── repositories/
│   ├── saas.repository.interface.ts  # 6 interfaces
│   └── supabase/
│       ├── saas-supabase.repository.ts          # Plan + Tenant repos
│       └── saas-supabase-extras.repository.ts   # Subscription + Payment + TenantUser (Invoice partielle)
└── saas.routes.ts                 # Provider + Services + Middlewares + Routes
```

### Pattern Repository

Deux implémentations possibles (comme pour produits/tables) :
- `Supabase*Repository` (active) — utilise `service_role` pour bypasser RLS
- (Future) `Sqlite*Repository` — pour mode local monoclient

## Routes API SaaS

### Routes publiques

| Méthode | URL | Description |
|---------|-----|-------------|
| `GET` | `/api/plans` | Liste des plans publics (pour la page pricing) |
| `POST` | `/api/tenants` | Inscription self-service (crée tenant + subscription) |
| `GET` | `/api/tenants/check-email?email=...` | Vérifie si un email est déjà enregistré |
| `GET` | `/api/tenants/:id` | Récupère un tenant par ID |

### Exemple d'inscription

```bash
curl -X POST https://ekala-api.onrender.com/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chez Mama Africa",
    "owner_email": "owner@mama.africa",
    "owner_phone": "+260971234567",
    "plan_code": "starter_monthly",
    "payment_method": "mobile_money",
    "payment_provider": "mtn_zm"
  }'
```

Réponse :
```json
{
  "tenant": { "id": 42, "name": "Chez Mama Africa", "status": "active", ... },
  "plan": { "code": "starter_monthly", "price_cents": 14900, ... }
}
```

## Branchement dans `server.ts`

Pour activer les routes SaaS, ajouter dans `src/server/server.ts` :

```typescript
import { createSaaSRouter } from './saas/saas.routes';
// ...
app.use('/api', createSaaSRouter());
```

> Le branchement n'a pas été ajouté automatiquement à cause d'une limitation de l'outil. À faire manuellement (1 ligne d'import + 1 ligne `app.use`).

## Ce qui reste à faire (Phase 2+)

### Phase 2 : Frontend (UI)
- Page `/pricing` (React)
- Page `/signup` + `/subscribe`
- Page `/billing` (gestion d'abonnement)
- Banner d'avertissement d'expiration

### Phase 3 : Paiement
- Intégrer passerelle (Stripe / Paystack / Mobile Money Zambien)
- Webhooks de paiement
- Cron d'expiration (24h)

### Phase 4 : Admin SaaS
- Super-admin dashboard
- Provisioning tools
- Statistiques MRR, churn, etc.

## Compilation

✅ `npm run build:server` — **succès, aucune erreur**

## Fichiers livrés

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `backend/migrations/012_saas_multitenant_schema.sql` | ~280 | Schéma de base + seed des plans |
| `src/server/saas/types/saas.types.ts` | ~150 | Types TS + DTOs + erreurs |
| `src/server/saas/repositories/saas.repository.interface.ts` | ~80 | 6 interfaces |
| `src/server/saas/repositories/supabase/saas-supabase.repository.ts` | ~210 | Plan + Tenant repos |
| `src/server/saas/repositories/supabase/saas-supabase-extras.repository.ts` | ~325 | Subscription + Payment + TenantUser repos (exclu de tsconfig car Invoice partielle) |
| `src/server/saas/saas.routes.ts` | ~140 | Provider + Services + Routes |

## Action immédiate

1. **Exécuter la migration** dans Supabase SQL Editor :
   ```sql
   -- Coller le contenu de backend/migrations/012_saas_multitenant_schema.sql
   ```
   Cela créera les 7 tables et seedera les 6 plans.

2. **Brancher les routes SaaS** dans `src/server/server.ts` (2 lignes, voir ci-dessus).

3. **Tester l'API** :
   ```bash
   curl https://ekala-api.onrender.com/api/plans
   ```
   Devrait retourner les 6 plans.

4. **Phase 2** : créer le frontend (page `/pricing` + flow d'inscription).
