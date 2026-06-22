# AUDIT COMPLET — SYSTÈME D'ABONNEMENT PAR VOUCHER

## PHASE 1 — AUDIT COMPLET

### 1.1 Tables existantes liées aux abonnements

#### SQLite (local)
- `tenants` - Informations des tenants
- `subscriptions` - Abonnements des tenants
- `users` - Utilisateurs
- `tenant_users` - Relations tenant-user

#### Supabase (cloud)
- `tenants` - Synchronisé depuis SQLite
- `subscriptions` - Synchronisé depuis SQLite
- `plans` - Forfaits disponibles (Supabase-only)
- `vouchers` - Codes de paiement (Supabase-only)
- `payments` - Historique des paiements (Supabase-only)
- `tenant_audit_log` - Journal d'audit (Supabase-only)

### 1.2 Routes existantes

#### Backend
- `GET /api/billing` - Page de facturation
- `POST /api/vouchers/validate` - Valider un voucher
- `POST /api/vouchers/activate` - Activer un voucher
- `GET /api/voucher-purchase/plans` - Liste des forfaits
- `POST /api/voucher-purchase/request-code` - **NOUVEAU** - Demander un code
- `POST /api/voucher-purchase/admin/verify-payment` - **NOUVEAU** - Vérifier paiement
- `GET /api/voucher-purchase/admin/pending-payments` - **NOUVEAU** - Liste attente
- `POST /api/voucher-purchase/cron/expire-pending` - **NOUVEAU** - Expiration auto

#### Frontend
- `/billing` - Page de facturation (existe)
- `/billing?from=suspended` - **À MODIFIER** - Flux de renouvellement

### 1.3 Middleware existant

- `subscription-guard.ts` - Vérifie le statut d'abonnement
- `subscription-audit-logger.ts` - Log des actions d'abonnement
- `tenant-validation.ts` - Validation des tenants

### 1.4 Cron jobs existants

- `subscription-expiration.cron.ts` - Vérifie les abonnements expirés toutes les heures

### 1.5 Types existants

```typescript
// src/server/saas/types/saas.types.ts
export type TenantStatus = 'pending' | 'active' | 'suspended' | 'cancelled' | 'trial';
export type SubscriptionStatus = 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'trial';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer' | 'card' | 'paystack' | 'stripe' | 'other' | 'voucher';
```

### 1.6 Schéma Supabase existant

#### Table `vouchers`
```sql
- id: UUID
- code: VARCHAR(50) UNIQUE
- plan_id: UUID
- plan_code: VARCHAR(50)
- duration_days: INTEGER
- price_cents: INTEGER
- currency: VARCHAR(10)
- status: VARCHAR(20)  -- UNUSED, PENDING_PAYMENT, PAYMENT_VERIFIED, USED, EXPIRED
- expires_at: TIMESTAMP
- tenant_id: UUID
- activated_by: UUID
- activated_at: TIMESTAMP
- verified_by: UUID
- verified_at: TIMESTAMP
- metadata: JSONB
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### Table `plans`
```sql
- id: UUID
- code: VARCHAR(50)
- name: VARCHAR(100)
- description: TEXT
- price_cents: INTEGER
- currency: VARCHAR(10)
- period: VARCHAR(20)
- duration_days: INTEGER
- max_users: INTEGER
- max_tables: INTEGER
- max_products: INTEGER
- max_orders_per_month: INTEGER
- features: JSONB
- is_active: BOOLEAN
- is_public: BOOLEAN
- trial_days: INTEGER
- sort_order: INTEGER
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### Table `subscriptions`
```sql
- id: UUID
- tenant_id: UUID
- plan_id: UUID
- plan_code: VARCHAR(50)
- status: VARCHAR(20)
- started_at: TIMESTAMP
- current_period_start: TIMESTAMP
- current_period_end: TIMESTAMP
- trial_started_at: TIMESTAMP
- trial_ends_at: TIMESTAMP
- cancelled_at: TIMESTAMP
- cancel_reason: TEXT
- auto_renew: BOOLEAN
- payment_method: VARCHAR(50)
- payment_reference: VARCHAR(100)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### 1.7 Problèmes identifiés

1. **Pas de table SQLite pour les vouchers** - Les vouchers sont Supabase-only
2. **Pas de synchronisation des vouchers vers SQLite** - Risque de perte de données en mode offline
3. **Pas de workflow de demande de voucher** - Seulement activation directe
4. **Pas de vérification administrative** - Pas d'étape de confirmation
5. **Pas de timeout 2h** - Les vouchers n'expirent pas automatiquement
6. **Page billing incomplète** - Pas d'interface pour demander un voucher

### 1.8 Architecture actuelle

```
Frontend (React)
  ↓
Backend (Express)
  ↓
Supabase (Cloud)
  ↓
SQLite (Local) - Sync bidirectionnel
```

### 1.9 Points forts du système existant

1. ✅ Architecture SaaS multitenant robuste
2. ✅ Synchronisation SQLite ↔ Supabase fonctionnelle
3. ✅ Système de guards et middleware pour les abonnements
4. ✅ Cron job pour l'expiration des abonnements
5. ✅ Audit log pour tracer les actions
6. ✅ Support des modes offline et online

### 1.10 Points à améliorer

1. ❌ Pas de table `subscription_payment_requests` dans SQLite
2. ❌ Pas de synchronisation des vouchers vers SQLite
3. ❌ Pas de workflow de demande avec email
4. ❌ Pas de vérification administrative
5. ❌ Pas de timeout automatique 2h
6. ❌ Interface billing incomplète

## RECOMMANDATIONS

### Priorité 1 (CRITIQUE)
1. Créer la table `subscription_payment_requests` dans SQLite
2. Ajouter la synchronisation pour cette table
3. Implémenter le workflow de demande de voucher

### Priorité 2 (IMPORTANT)
4. Créer la page billing complète
5. Implémenter la vérification administrative
6. Ajouter le système de timeout 2h

### Priorité 3 (AMÉLIORATION)
7. Intégrer un service d'email
8. Créer le backoffice admin
9. Ajouter les templates d'email

## FICHIERS À MODIFIER

### Backend
- `src/server/db/database.ts` - Ajouter table subscription_payment_requests
- `src/sync/core/entity-registry.ts` - Ajouter l'entité subscription_payment_request
- `src/sync/core/generic-sync.service.ts` - Support sync (déjà générique)
- `src/server/routes/voucher-purchase.ts` - **DÉJA FAIT**
- `src/server/routes/billing.routes.ts` - Intégrer nouveau workflow
- `src/server/server.ts` - Ajouter routes

### Frontend
- `src/pages/saas/BillingPage.tsx` - **À MODIFIER**
- `src/lib/api-client.ts` - Ajouter méthodes voucherPurchase
- `src/components/` - Créer composants UI

### Cron
- `src/server/saas/cron/subscription-expiration.cron.ts` - Ajouter vérification vouchers

## CONCLUSION

Le système existant est solide mais incomplet pour le workflow voucher-first. Les modifications nécessaires sont bien délimitées et ne casseront pas l'existant. La synchronisation bidirectionnelle est déjà en place et pourra être étendue facilement.

**Niveau de confiance**: 90%