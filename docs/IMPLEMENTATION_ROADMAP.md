# FEUILLE DE ROUTE — IMPLÉMENTATION BILLING VOUCHER-FIRST

**Date**: 22 Juin 2026  
**Version**: 1.0  
**Statut**: PRÊT POUR EXÉCUTION

---

## 📋 PHASE 1: INTÉGRATION IMMÉDIATE (1-2 JOURS)

### 1.1 Intégrer BillingPageV2 dans l'application

**Fichier**: `src/App.tsx`

**Action**:
```typescript
// Remplacer l'import existant
import BillingPage from './pages/saas/BillingPage';
// Par
import BillingPage from './pages/saas/BillingPageV2';

// OU créer une route séparée pour test A/B
<Route path="/billing-v2" element={<BillingPageV2 />} />
```

**Validation**:
- [ ] Page se charge sans erreur
- [ ] États s'affichent correctement
- [ ] API calls fonctionnent
- [ ] Responsive mobile OK

**Temps estimé**: 30 minutes

---

### 1.2 Corriger redirection `/checkout` cassée

**Fichier**: `src/pages/saas/BillingPage.tsx` (ancienne version)

**Recherche**:
```bash
grep -n "checkout" src/pages/saas/BillingPage.tsx
```

**Action**:
```typescript
// AVANT
navigate(`/checkout?tenant_id=${currentTenantId}&plan_code=${subscription.plan.code}&from=expired`);

// APRÈS
navigate(`/billing?from=expired`);
```

**Validation**:
- [ ] Plus de redirection vers 404
- [ ] URL correcte dans la barre d'adresse
- [ ] État SUSPENDED s'affiche

**Temps estimé**: 15 minutes

---

### 1.3 Tester les 5 états du workflow

**Checklist de test**:

**État SUSPENDED**:
- [ ] Alerte "Compte suspendu" visible
- [ ] Grille de forfaits chargée
- [ ] Sélection plan fonctionne
- [ ] Bouton "Demander un code" apparaît

**État VOUCHER_GENERATED**:
- [ ] Code voucher affiché (format EKA-XXX)
- [ ] Bouton "Copier" fonctionne
- [ ] Informations complètes (montant, dates)
- [ ] Bouton "J'ai effectué le paiement" présent

**État ADMIN_VERIFICATION**:
- [ ] Spinner animé visible
- [ ] Countdown s'actualise chaque seconde
- [ ] Auto-refresh toutes les 30s
- [ ] Bouton "Vérifier maintenant" fonctionne

**État ACTIVE**:
- [ ] Badge vert "Forfait actif"
- [ ] Quotas affichés (users, tables, produits)
- [ ] Message de confirmation visible

**Temps estimé**: 2 heures

---

## 📋 PHASE 2: NETTOYAGE CODE HÉRITÉ (2-3 JOURS)

### 2.1 Supprimer colonnes payment_method/ref

**Tables concernées**:
- `subscriptions` (SQLite + Supabase)
- `tenants` (SQLite + Supabase)

**Migration SQLite**:
```sql
-- backend/migrations/036_remove_payment_methods.sql

-- Supprimer colonnes dans subscriptions
ALTER TABLE subscriptions DROP COLUMN IF EXISTS payment_method;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS payment_reference;

-- Supprimer colonnes dans tenants
ALTER TABLE tenants DROP COLUMN IF EXISTS payment_method;
ALTER TABLE tenants DROP COLUMN IF EXISTS payment_reference;
```

**Migration Supabase**:
```sql
-- Exécuter dans Supabase SQL Editor

ALTER TABLE subscriptions 
  DROP COLUMN IF EXISTS payment_method,
  DROP COLUMN IF EXISTS payment_reference;

ALTER TABLE tenants 
  DROP COLUMN IF EXISTS payment_method,
  DROP COLUMN IF EXISTS payment_reference;
```

**Mise à jour code**:
- [ ] `src/server/saas/saas.routes.ts` - Supprimer payment_method de POST /api/tenants
- [ ] `src/server/saas/saas.routes.ts` - Supprimer payment_method de PATCH subscription
- [ ] `src/server/routes/admin.subscriptions.ts` - Supprimer références

**Temps estimé**: 4 heures

---

### 2.2 Standardiser sur voucher_requests uniquement

**Fichier**: `src/server/routes/billing.routes.ts`

**Action**:
```typescript
// SUPPRIMER le fallback vers subscription_payment_requests
// Garder UNIQUEMENT voucher_requests

// AVANT (lignes 125-172)
const insertIntoVoucherRequests = ...;
const insertIntoLegacy = ...; // À SUPPRIMER

// APRÈS
const insertIntoVoucherRequests = ...;
// Supprimer toute la logique de fallback
```

**Mise à jour entity-registry.ts**:
```typescript
// Supprimer subscription_payment_request du registre
// Garder uniquement voucher_request
```

**Migration données**:
```sql
-- Copier les données de subscription_payment_requests vers voucher_requests
INSERT INTO voucher_requests 
  (tenant_id, plan_id, voucher_code, customer_email, status, requested_at, verification_deadline, expires_at, created_at, updated_at)
SELECT 
  tenant_id, plan_id, voucher_code, 
  (SELECT email FROM users WHERE id = requested_by),
  status, requested_at, verification_deadline, expires_at, created_at, updated_at
FROM subscription_payment_requests
WHERE status NOT IN ('verified', 'rejected', 'expired');
```

**Temps estimé**: 6 heures

---

### 2.3 Supprimer table payments Supabase

**Migration Supabase**:
```sql
-- ATTENTION: Faire un backup avant!
-- Supprimer la table payments (ancien système)
DROP TABLE IF EXISTS payments CASCADE;
```

**Mise à jour code**:
- [ ] `src/server/saas/saas.routes.ts` - Supprimer requête payments (ligne 146-152)
- [ ] `src/pages/saas/BillingPage.tsx` - Supprimer affichage historique payments

**Temps estimé**: 2 heures

---

## 📋 PHASE 3: REFACTORING TECHNIQUE (1 SEMAINE)

### 3.1 Créer repository pattern pour vouchers

**Nouveau fichier**: `src/server/repositories/voucher.repository.ts`

```typescript
export class VoucherRequestRepository {
  constructor(private db: Database.Database, private supabase: SupabaseClient) {}

  async findById(id: number): Promise<VoucherRequest | null> {
    // Logique SQLite + Supabase unifiée
  }

  async findByCode(code: string): Promise<VoucherRequest | null> {
    // Recherche par voucher_code
  }

  async insert(data: CreateVoucherRequest): Promise<VoucherRequest> {
    // Insertion avec queue sync
  }

  async updateStatus(id: number, status: string): Promise<void> {
    // Update status + queue sync
  }

  async findPending(): Promise<VoucherRequest[]> {
    // Liste demandes en attente
  }
}
```

**Bénéfices**:
- Élimine duplication SQLite/Supabase
- Code plus maintenable
- Tests unitaires possibles

**Temps estimé**: 8 heures

---

### 3.2 Créer interface admin validation

**Nouveau fichier**: `src/pages/admin/AdminVouchersPage.tsx`

**Fonctionnalités**:
- Liste des demandes avec filtres (pending, verified, expired, rejected)
- Boutons Valider/Rejeter
- Modal de confirmation
- Affichage détails demande (tenant, plan, montant, code)
- Refresh automatique

**Route**: `/admin/vouchers`

**Composants nécessaires**:
- `AdminVouchersPage.tsx` - Page principale
- `VoucherRequestCard.tsx` - Carte demande
- `VoucherFilters.tsx` - Filtres par statut
- `VerifyModal.tsx` - Modal validation
- `RejectModal.tsx` - Modal rejet

**Temps estimé**: 16 heures (2 jours)

---

### 3.3 Ajouter variables d'environnement

**Fichier**: `.env.example`

```bash
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Voucher Configuration
VOUCHER_CODE_PREFIX=EKA
VOUCHER_VERIFICATION_DEADLINE_HOURS=24
VOUCHER_EXPIRATION_HOURS=48
VOUCHER_EXPIRATION_CRON_ENABLED=true

# Supabase (déjà présent)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
```

**Mise à jour code**:
```typescript
// src/server/config/env.ts
export const env = {
  // ... existing
  VOUCHER_CODE_PREFIX: process.env.VOUCHER_CODE_PREFIX || 'EKA',
  VOUCHER_VERIFICATION_DEADLINE_HOURS: parseInt(process.env.VOUCHER_VERIFICATION_DEADLINE_HOURS || '24'),
  VOUCHER_EXPIRATION_HOURS: parseInt(process.env.VOUCHER_EXPIRATION_HOURS || '48'),
};
```

**Temps estimé**: 2 heures

---

## 📋 PHASE 4: AMÉLIORATIONS UX (1 SEMAINE)

### 4.1 Afficher voucher_requests dans BillingPage

**Fichier**: `src/pages/saas/BillingPageV2.tsx`

**Ajouter**:
```typescript
// État ACTIVE: Afficher historique des demandes
const renderVoucherHistory = () => {
  // Charger les 5 dernières demandes
  // Afficher avec statut (pending, verified, expired, rejected)
  // Format: Date | Code | Montant | Statut
};
```

**Design**:
```
┌─────────────────────────────────────┐
│  Historique de vos demandes         │
├─────────────────────────────────────┤
│  22 Jun 2026 | EKA-6-FOPT | 500 ZMW│
│  [✓ Vérifié]                        │
│                                     │
│  20 Jun 2026 | EKA-6-XXXX | 500 ZMW│
│  [✗ Rejeté]                         │
└─────────────────────────────────────┘
```

**Temps estimé**: 4 heures

---

### 4.2 Ajouter i18n (FR/EN)

**Fichiers à créer/modifier**:
- `src/i18n/locales/fr.json` - Ajouter traductions billing
- `src/i18n/locales/en.json` - Ajouter traductions billing
- `src/pages/saas/BillingPageV2.tsx` - Remplacer textes hardcodés

**Exemple**:
```json
// fr.json
{
  "billing": {
    "suspended": {
      "title": "Compte suspendu",
      "message": "Votre abonnement a expiré. Choisissez un forfait pour réactiver votre compte.",
      "selectPlan": "Choisissez votre forfait",
      "requestVoucher": "Demander un code de paiement"
    },
    "voucherGenerated": {
      "title": "Code de paiement généré",
      "copy": "Copier",
      "copied": "Copié !",
      "important": "Effectuez votre paiement dans les 48 heures.",
      "paymentSent": "J'ai effectué le paiement"
    }
  }
}
```

**Temps estimé**: 6 heures

---

### 4.3 Implémenter notifications temps réel

**Option A: Supabase Realtime** (Recommandé)

**Fichier**: `src/pages/saas/BillingPageV2.tsx`

```typescript
useEffect(() => {
  if (billingState !== 'ADMIN_VERIFICATION') return;

  const channel = supabase
    .channel('voucher-updates')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'voucher_requests',
      filter: `voucher_code=eq.${voucher?.voucher_code}`
    }, (payload) => {
      if (payload.new.status === 'verified') {
        setBillingState('ACTIVE');
      }
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [billingState, voucher?.voucher_code]);
```

**Option B: Polling** (Plus simple)

**Déjà implémenté**: Auto-refresh toutes les 30 secondes

**Temps estimé**: 4 heures

---

## 📋 PHASE 5: MONITORING & TESTS (1 SEMAINE)

### 5.1 Ajouter monitoring

**Métriques à tracker**:
```typescript
// Nombre de demandes par jour
// Taux de conversion (génération → vérification)
// Délai moyen de validation
// Taux d'expiration
// Taux d'erreur sync
```

**Outils**:
- Sentry (erreurs)
- PostHog (analytics)
- Custom dashboard (métriques business)

**Temps estimé**: 8 heures

---

### 5.2 Créer tests automatisés

**Structure**:
```
src/__tests__/
  ├── billing/
  │   ├── billing.routes.test.ts
  │   ├── admin.subscriptions.test.ts
  │   └── voucher-expiration.cron.test.ts
  └── pages/
      └── BillingPageV2.test.tsx
```

**Exemple test**:
```typescript
describe('POST /api/billing/request-voucher', () => {
  it('should generate voucher code', async () => {
    const res = await request(app)
      .post('/api/billing/request-voucher')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: 1 });
    
    expect(res.status).toBe(200);
    expect(res.body.voucherCode).toMatch(/^EKA-\d+-[A-Z0-9]+$/);
  });
});
```

**Temps estimé**: 16 heures (2 jours)

---

## 📋 PHASE 6: FEATURES AVANCÉES (1 MOIS)

### 6.1 Dashboard admin statistiques

**Route**: `/admin/dashboard`

**Métriques affichées**:
- Nombre de demandes par jour (graphique)
- Taux de validation (%)
- Délai moyen de traitement (graphique)
- Top 10 tenants par CA
- Taux d'expiration

**Technologies**:
- Recharts (graphiques)
- Date-fns (dates)

**Temps estimé**: 12 heures (1.5 jours)

---

### 6.2 Export/Reporting

**Fonctionnalités**:
- Export CSV des demandes
- Export PDF des factures
- Rapport mensuel automatique par email

**Fichier**: `src/server/services/reporting.service.ts`

**Temps estimé**: 8 heures (1 jour)

---

### 6.3 Webhooks

**Événements**:
- `voucher.generated` - Nouveau voucher créé
- `voucher.payment_sent` - Paiement déclaré
- `voucher.verified` - Voucher validé
- `voucher.rejected` - Voucher rejeté
- `voucher.expired` - Voucher expiré

**Endpoint**: `POST /api/webhooks/voucher`

**Temps estimé**: 8 heures (1 jour)

---

## 📊 PLANNING GLOBAL

### ✅ Sprint 1 (Semaine 1) - CRITIQUE - **COMPLÉTÉ**
- [x] Intégration BillingPageV2 (1h)
- [x] Tests 5 états (2h)
- [x] Corriger redirection checkout (15min)
- [x] Créer interface admin validation (16h) - Routes API + emails

**Total**: ~20 heures (2.5 jours) - **TERMINÉ**

### 🔄 Sprint 2 (Semaine 2) - IMPORTANT - **EN COURS**
- [ ] Supprimer colonnes payment_method (4h)
- [ ] Standardiser voucher_requests (6h)
- [ ] Créer repository pattern (8h)
- [ ] Ajouter variables d'environnement (2h)

**Total**: ~20 heures (2.5 jours) - **À DÉMARRER**

### Sprint 3 (Semaine 3-4) - AMÉLIORATION
- [ ] Afficher historique voucher_requests (4h)
- [ ] Ajouter i18n FR/EN (6h)
- [ ] Notifications temps réel (4h)
- [ ] Tests automatisés (16h)

**Total**: ~30 heures (3.75 jours)

### Sprint 4 (Mois 2) - AVANCÉ
- [ ] Dashboard admin statistiques (12h)
- [ ] Export/Reporting (8h)
- [ ] Webhooks (8h)
- [ ] Monitoring (8h)

**Total**: ~36 heures (4.5 jours)

---

## 🎯 PRIORISATION

### ✅ P0 - CRITIQUE (COMPLÉTÉ)
1. ✅ Intégrer BillingPageV2 - **FAIT**
2. ✅ Tester les 5 états - **FAIT**
3. ✅ Créer interface admin validation - **FAIT** (routes API prêtes)

### 🔄 P1 - IMPORTANT (Semaine prochaine)
4. ⏳ Supprimer colonnes payment_method - **EN ATTENTE**
5. ⏳ Standardiser voucher_requests - **EN ATTENTE**
6. ⏳ Créer repository pattern - **EN ATTENTE**

### 📅 P2 - AMÉLIORATION (Mois 1)
7. 📋 Historique voucher_requests - **PLANIFIÉ**
8. 📋 i18n FR/EN - **PLANIFIÉ**
9. 📋 Tests automatisés - **PLANIFIÉ**

### 🚀 P3 - AVANCÉ (Mois 2)
10. 📋 Dashboard statistiques - **PLANIFIÉ**
11. 📋 Export/Reporting - **PLANIFIÉ**
12. 📋 Webhooks - **PLANIFIÉ**

---

## ✅ CHECKLIST DE DÉPLOIEMENT

### Pré-déploiement
- [ ] Tests unitaires passent
- [ ] Tests d'intégration passent
- [ ] Tests E2E passent
- [ ] Code review effectué
- [ ] Documentation à jour

### Déploiement
- [ ] Backup base de données
- [ ] Migration SQLite exécutée
- [ ] Migration Supabase exécutée
- [ ] Code déployé
- [ ] Variables d'environnement configurées

### Post-déploiement
- [ ] Monitoring actif
- [ ] Logs vérifiés
- [ ] Tests utilisateurs effectués
- [ ] Feedback collecté
- [ ] Hotfixes appliqués si nécessaire

---

## 🚀 COMMANDES UTILES

### Tests
```bash
# Tests unitaires
npm test

# Tests d'intégration
npm run test:integration

# Tests E2E
npm run test:e2e
```

### Migrations
```bash
# SQLite
npm run migrate:sqlite

# Supabase
npm run migrate:supabase
```

### Déploiement
```bash
# Build
npm run build

# Deploy
npm run deploy:production

# Vérifier
npm run health:check
```

---

## 📞 SUPPORT

Pour toute question:
- Documentation: `docs/`
- Audit: `docs/BILLING_AUDIT_REPORT.md`
- Implémentation: `docs/BILLING_V2_IMPLEMENTATION_REPORT.md`
- Roadmap: `docs/IMPLEMENTATION_ROADMAP.md` (ce fichier)

---

## 📝 NOTES IMPORTANTES

1. **Migration progressive**: Possibilité de garder les deux versions (ancienne + V2) pendant la transition
2. **Rollback**: Garder BillingPage.tsx original en backup
3. **Feature flags**: Utiliser pour activer/désactiver V2 progressivement
4. **Monitoring**: Activer les logs détaillés pendant la migration
5. **Communication**: Informer les utilisateurs des changements

---

**Feuille de route prête à être exécutée** 🚀

**Prochaine étape**: Commencer par la Phase 1 (Intégration immédiate)