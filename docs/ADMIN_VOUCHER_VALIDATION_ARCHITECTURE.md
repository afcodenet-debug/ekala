# BACKOFFICE VALIDATION PAIEMENTS — RAPPORT D'ARCHITECTURE

**Date**: 22 Juin 2026  
**Version**: 1.0  
**Statut**: AVANT CODAGE

---

## 📋 SOMMAIRE

Ce document présente l'architecture complète pour l'interface d'administration de validation des vouchers. Il couvre le backend, le frontend, la sécurité, la synchronisation et le plan d'implémentation.

---

## 🎯 OBJECTIFS

### Fonctionnalités
1. **Liste des demandes** avec filtres (pending, verified, expired, rejected)
2. **Actions**: Valider / Rejeter avec confirmation
3. **Détails**: Tenant, email, plan, montant, voucher, date
4. **Audit**: Historique complet des actions
5. **Sync**: SQLite ↔ Supabase bidirectionnel

### Contraintes
- ✅ Multitenant isolation
- ✅ Offline-first
- ✅ Sync bidirectionnelle
- ✅ Audit trail complet
- ✅ Pas de suppression d'historique
- ✅ Responsive mobile/desktop

---

## 🏗️ ARCHITECTURE GLOBALE

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKOFFICE ADMIN                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │   Frontend   │      │    Backend   │                   │
│  │              │      │              │                   │
│  │ AdminVouchers│─────▶│  Routes API  │                   │
│  │   Page.tsx   │      │  /admin/*    │                   │
│  │              │◀─────│              │                   │
│  └──────────────┘      └──────┬───────┘                   │
│                               │                             │
│                    ┌──────────┴──────────┐                │
│                    │                     │                │
│            ┌───────▼──────┐      ┌──────▼───────┐        │
│            │   Supabase   │      │    SQLite    │        │
│            │   (Cloud)    │◄────►│   (Local)    │        │
│            └──────────────┘      └──────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 STRUCTURE DES FICHIERS

### Backend

```
src/server/
├── routes/
│   └── admin.subscriptions.ts          ✅ EXISTANT (à étendre)
│       ├── GET /api/admin/vouchers/pending
│       ├── GET /api/admin/vouchers/verified
│       ├── GET /api/admin/vouchers/expired
│       ├── GET /api/admin/vouchers/rejected
│       ├── POST /api/admin/subscriptions/verify
│       └── POST /api/admin/subscriptions/reject
│
├── services/
│   ├── billing-expiration.service.ts   ✅ EXISTANT
│   ├── email-templates.ts              ✅ EXISTANT
│   └── notification.service.ts         ✅ EXISTANT
│
└── middleware/
    ├── admin-auth.ts                   ✅ EXISTANT
    └── subscription-audit-logger.ts    ✅ EXISTANT
```

### Frontend

```
src/pages/
└── admin/
    └── AdminVouchersPage.tsx           🆕 À CRÉER
        ├── Filtres (pending, verified, expired, rejected)
        ├── Liste des demandes
        ├── Carte demande (VoucherRequestCard)
        ├── Modale validation (VerifyModal)
        └── Modale rejet (RejectModal)

src/components/
└── admin/
    ├── VoucherRequestCard.tsx          🆕 À CRÉER
    ├── VoucherFilters.tsx              🆕 À CRÉER
    ├── VerifyModal.tsx                 🆕 À CRÉER
    └── RejectModal.tsx                 🆕 À CRÉER
```

---

## 🔌 BACKEND — ROUTES API

### Routes existantes (déjà implémentées)

**Fichier**: `src/server/routes/admin.subscriptions.ts`

```typescript
// GET /api/admin/vouchers/pending
// GET /api/admin/vouchers/verified
// GET /api/admin/vouchers/expired
// GET /api/admin/vouchers/rejected

// POST /api/admin/subscriptions/verify
// POST /api/admin/subscriptions/reject
```

**Statut**: ✅ Routes déjà créées et fonctionnelles

### Logique de validation (POST /api/admin/subscriptions/verify)

```typescript
// 1. Vérifier la demande
const voucher = await findVoucher(requestId);

// 2. Vérifier le statut
if (voucher.status !== 'pending' && voucher.status !== 'payment_sent') {
  return res.status(400).json({ error: 'Statut invalide' });
}

// 3. Transaction atomique
await db.transaction(async (trx) => {
  // 3a. Marquer voucher comme vérifié
  await trx('voucher_requests')
    .update({
      status: 'verified',
      verified_by: adminId,
      verified_at: new Date().toISOString()
    })
    .where('id', requestId);

  // 3b. Créer/mettre à jour l'abonnement
  await trx('subscriptions')
    .insert({
      tenant_id: voucher.tenant_id,
      plan_id: voucher.plan_id,
      status: 'active',
      started_at: new Date().toISOString(),
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + plan.duration_days * 86400000),
      auto_renew: true
    });

  // 3c. Réactiver le tenant
  await trx('tenants')
    .update({
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .where('id', voucher.tenant_id);

  // 3d. Réactiver les utilisateurs
  await trx('users')
    .update({ is_active: true })
    .where('tenant_id', voucher.tenant_id);
});

// 4. Synchroniser (SQLite → Supabase)
await queueSyncChange('voucher_request', 'update', voucher);
await queueSyncChange('subscription', 'insert', subscription);
await queueSyncChange('tenant', 'update', tenant);

// 5. Envoyer email de confirmation
await sendEmailDirect(
  '[Great Olive] Paiement validé',
  buildVoucherVerifiedEmail(voucher, plan),
  settings,
  voucher.customer_email
);

// 6. Logger l'audit
await logSubscriptionEvent({
  event: 'VOUCHER_VERIFIED',
  tenantId: voucher.tenant_id,
  userId: adminId,
  metadata: { voucherCode: voucher.voucher_code, planId: voucher.plan_id }
});
```

### Logique de rejet (POST /api/admin/subscriptions/reject)

```typescript
// 1. Vérifier la demande
const voucher = await findVoucher(requestId);

// 2. Vérifier le statut
if (!['pending', 'payment_sent'].includes(voucher.status)) {
  return res.status(400).json({ error: 'Statut invalide' });
}

// 3. Marquer comme rejeté
await db('voucher_requests')
  .update({
    status: 'rejected',
    rejection_reason: req.body.reason,
    verified_by: adminId,
    verified_at: new Date().toISOString()
  })
  .where('id', requestId);

// 4. Synchroniser
await queueSyncChange('voucher_request', 'update', voucher);

// 5. Envoyer email
await sendEmailDirect(
  '[Great Olive] Paiement rejeté',
  buildVoucherRejectedEmail(voucher, req.body.reason),
  settings,
  voucher.customer_email
);

// 6. Logger
await logSubscriptionEvent({
  event: 'VOUCHER_REJECTED',
  tenantId: voucher.tenant_id,
  userId: adminId,
  metadata: { voucherCode: voucher.voucher_code, reason: req.body.reason }
});
```

---

## 🎨 FRONTEND — ARCHITECTURE

### Composants principaux

#### 1. AdminVouchersPage (Page principale)

**Responsabilités**:
- Charger la liste des demandes
- Gérer les filtres
- Afficher les cartes
- Gérer les modales

**State**:
```typescript
const [vouchers, setVouchers] = useState<VoucherRequest[]>([]);
const [filter, setFilter] = useState<'pending' | 'verified' | 'expired' | 'rejected'>('pending');
const [loading, setLoading] = useState(false);
const [selectedVoucher, setSelectedVoucher] = useState<VoucherRequest | null>(null);
const [showVerifyModal, setShowVerifyModal] = useState(false);
const [showRejectModal, setShowRejectModal] = useState(false);
```

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Backoffice — Validation des paiements                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Filtres: Pending | Verified | Expired | Rejected]        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ VoucherRequestCard #1                                 │  │
│  │ Tenant: Restaurant ABC                                 │  │
│  │ Email: owner@restaurant.com                            │  │
│  │ Plan: Basic - 500 ZMW/mois                             │  │
│  │ Voucher: EKA-1-ABC                                     │  │
│  │ Date: 22 Jun 2026 14:30                                │  │
│  │                                                        │  │
│  │ [Valider]  [Rejeter]                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ VoucherRequestCard #2                                 │  │
│  │ ...                                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2. VoucherRequestCard (Carte demande)

**Props**:
```typescript
interface VoucherRequestCardProps {
  voucher: VoucherRequest;
  onVerify: (id: number) => void;
  onReject: (id: number) => void;
}
```

**Affichage**:
```
┌─────────────────────────────────────────────────────────────┐
│ Tenant: Restaurant ABC                    Date: 22 Jun 2026 │
│ Email: owner@restaurant.com                                 │
│ Plan: Basic (500 ZMW/mois)                                  │
│ Voucher: EKA-1-ABC                                          │
│ Montant: 500,00 ZMW                                         │
│                                                             │
│ [Valider]  [Rejeter]                                        │
└─────────────────────────────────────────────────────────────┘
```

#### 3. VoucherFilters (Filtres)

**Props**:
```typescript
interface VoucherFiltersProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: Record<FilterType, number>;
}
```

**Affichage**:
```
[Pending (5)] [Verified (12)] [Expired (3)] [Rejected (2)]
```

#### 4. VerifyModal (Modale validation)

**Props**:
```typescript
interface VerifyModalProps {
  isOpen: boolean;
  voucher: VoucherRequest | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}
```

**Contenu**:
```
┌─────────────────────────────────────────────────────────────┐
│  Confirmer la validation                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tenant: Restaurant ABC                                     │
│  Plan: Basic - 500 ZMW/mois                                 │
│  Voucher: EKA-1-ABC                                         │
│                                                             │
│  Cette action va:                                           │
│  ✓ Créer l'abonnement                                       │
│  ✓ Activer le tenant                                        │
│  ✓ Envoyer un email de confirmation                         │
│  ✓ Synchroniser SQLite ↔ Supabase                           │
│                                                             │
│  [Annuler]  [Confirmer la validation]                       │
└─────────────────────────────────────────────────────────────┘
```

#### 5. RejectModal (Modale rejet)

**Props**:
```typescript
interface RejectModalProps {
  isOpen: boolean;
  voucher: VoucherRequest | null;
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}
```

**Contenu**:
```
┌─────────────────────────────────────────────────────────────┐
│  Rejeter la demande                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tenant: Restaurant ABC                                     │
│  Voucher: EKA-1-ABC                                         │
│                                                             │
│  Raison du rejet:                                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [Annuler]  [Confirmer le rejet]                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 SÉCURITÉ

### Authentification

```typescript
// Middleware admin-auth.ts
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  
  // Vérifier que l'utilisateur est admin
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }
  
  next();
}
```

### Autorisation

```typescript
// Vérifier les permissions
const canValidate = user.permissions.includes('vouchers.validate');
const canReject = user.permissions.includes('vouchers.reject');

if (!canValidate) {
  return res.status(403).json({ error: 'INSUFFICIENT_PERMISSIONS' });
}
```

### Audit trail

```typescript
// Logger toutes les actions
await logSubscriptionEvent({
  event: 'VOUCHER_VERIFIED',
  tenantId: voucher.tenant_id,
  userId: req.user.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  metadata: {
    voucherCode: voucher.voucher_code,
    planId: voucher.plan_id,
    amount: voucher.amount_cents
  }
});
```

---

## 🔄 SYNCHRONISATION

### Flux de synchronisation

```
Admin valide voucher
    ↓
1. UPDATE voucher_requests (status = 'verified')
2. INSERT subscription (nouvel abonnement)
3. UPDATE tenants (status = 'active')
4. UPDATE users (is_active = true)
    ↓
Queue Sync Outbox
    ↓
SyncV2 Engine
    ↓
┌───────────────┐      ┌───────────────┐
│    SQLite     │◄────►│   Supabase    │
│   (Local)     │      │   (Cloud)     │
└───────────────┘      └───────────────┘
    ↓                        ↓
Realtime Pull            Pull Sync
    ↓                        ↓
Tous les clients          Tous les clients
mis à jour                mis à jour
```

### Gestion des conflits

```typescript
// Stratégie: Last-Write-Wins avec timestamp
const syncPayload = {
  ...voucher,
  _sync_timestamp: new Date().toISOString(),
  _sync_source: 'admin_validation'
};

// Si conflit détecté
if (conflict) {
  // Comparer les timestamps
  if (localTimestamp > remoteTimestamp) {
    // Garder local
  } else {
    // Accepter remote
  }
}
```

### Reprise après coupure réseau

```typescript
// Outbox garantit aucune perte
queueSyncChange('voucher_request', 'update', payload);

// Si Supabase down:
// 1. Stocker dans outbox
// 2. Continuer l'opération
// 3. Retry automatique quand Supabase revient
```

---

## 📊 MODÈLE DE DONNÉES

### voucher_requests

```sql
CREATE TABLE voucher_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  voucher_code TEXT UNIQUE NOT NULL,
  customer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, payment_sent, verified, expired, rejected
  requested_at TEXT NOT NULL,
  verification_deadline TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  verified_by INTEGER,
  verified_at TEXT,
  rejection_reason TEXT,
  notes TEXT,
  remote_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

### subscriptions (créé lors de validation)

```sql
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, trial, expired, suspended, cancelled
  started_at TEXT NOT NULL,
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  trial_started_at TEXT,
  trial_ends_at TEXT,
  cancelled_at TEXT,
  cancel_reason TEXT,
  auto_renew BOOLEAN DEFAULT 1,
  last_voucher_code TEXT,
  remote_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### tenants (mis à jour lors de validation)

```sql
CREATE TABLE tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, suspended, cancelled
  plan_code TEXT,
  is_provisioned BOOLEAN DEFAULT 0,
  provisioned_at TEXT,
  remote_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 🎯 WORKFLOW DE VALIDATION

### Côté Admin

```
1. Admin se connecte
   ↓
2. Accède à /admin/vouchers
   ↓
3. Voit la liste des demandes (filtre: pending par défaut)
   ↓
4. Clique sur "Valider" pour une demande
   ↓
5. Modale de confirmation s'affiche
   ↓
6. Admin confirme
   ↓
7. Backend:
   - Vérifie la demande
   - Crée l'abonnement
   - Active le tenant
   - Envoie email
   - Synchronise
   - Log l'audit
   ↓
8. Frontend:
   - Affiche succès
   - Rafraîchit la liste
   - Passe au statut "verified"
```

### Côté Client

```
1. Client génère un voucher
   ↓
2. Voit le code EKA-XXX
   ↓
3. Effectue le paiement
   ↓
4. Clique "J'ai effectué le paiement"
   ↓
5. Voit countdown (24h)
   ↓
6. Admin valide
   ↓
7. Reçoit email de confirmation
   ↓
8. Compte activé automatiquement
   ↓
9. Peut se connecter et utiliser l'application
```

---

## 🧪 TESTS

### Tests unitaires (backend)

```typescript
describe('POST /api/admin/subscriptions/verify', () => {
  it('should validate voucher and create subscription', async () => {
    const res = await request(app)
      .post('/api/admin/subscriptions/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ requestId: 1 });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject if already verified', async () => {
    // Voucher déjà vérifié
    const res = await request(app)
      .post('/api/admin/subscriptions/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ requestId: 999 });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('STATUS_INVALID');
  });
});
```

### Tests d'intégration

```typescript
describe('Validation flow', () => {
  it('should create subscription and activate tenant', async () => {
    // 1. Créer un voucher
    const voucher = await createVoucher();
    
    // 2. Valider
    await validateVoucher(voucher.id);
    
    // 3. Vérifier abonnement créé
    const subscription = await getSubscription(voucher.tenant_id);
    expect(subscription.status).toBe('active');
    
    // 4. Vérifier tenant activé
    const tenant = await getTenant(voucher.tenant_id);
    expect(tenant.status).toBe('active');
    
    // 5. Vérifier sync
    await waitForSync();
    const remoteVoucher = await getRemoteVoucher(voucher.id);
    expect(remoteVoucher.status).toBe('verified');
  });
});
```

### Tests E2E (frontend)

```typescript
describe('AdminVouchersPage', () => {
  it('should display pending vouchers', async () => {
    render(<AdminVouchersPage />);
    
    await waitFor(() => {
      expect(screen.getByText('EKA-1-TEST')).toBeInTheDocument();
    });
  });

  it('should validate voucher on button click', async () => {
    render(<AdminVouchersPage />);
    
    const validateButton = screen.getAllByText('Valider')[0];
    await userEvent.click(validateButton);
    
    const confirmButton = screen.getByText('Confirmer la validation');
    await userEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(screen.getByText('Vérifié')).toBeInTheDocument();
    });
  });
});
```

---

## 🚀 PLAN D'IMPLÉMENTATION

### Phase 1: Backend (1 jour)

**Jour 1**:
- [ ] Vérifier routes API existantes
- [ ] Tester validation manuellement
- [ ] Vérifier synchronisation
- [ ] Tester emails

### Phase 2: Frontend (2 jours)

**Jour 2**:
- [ ] Créer `AdminVouchersPage.tsx`
- [ ] Créer `VoucherRequestCard.tsx`
- [ ] Créer `VoucherFilters.tsx`
- [ ] Implémenter chargement liste

**Jour 3**:
- [ ] Créer `VerifyModal.tsx`
- [ ] Créer `RejectModal.tsx`
- [ ] Implémenter actions valider/rejeter
- [ ] Gestion des erreurs

### Phase 3: Tests (1 jour)

**Jour 4**:
- [ ] Tests unitaires backend
- [ ] Tests d'intégration
- [ ] Tests E2E frontend
- [ ] Tests de sync

### Phase 4: Documentation (0.5 jour)

**Jour 4**:
- [ ] Guide utilisateur admin
- [ ] Documentation API
- [ ] Procédures de dépannage

---

## 📋 CHECKLIST PRÉ-CODAGE

### Backend
- [x] Routes API créées (`admin.subscriptions.ts`)
- [x] Service d'expiration créé (`billing-expiration.service.ts`)
- [x] Templates d'emails créés (`email-templates.ts`)
- [x] Middleware admin-auth existant
- [x] Audit logger existant
- [ ] **À VÉRIFIER**: Transaction atomique dans verify
- [ ] **À VÉRIFIER**: Synchronisation après validation
- [ ] **À VÉRIFIER**: Gestion des erreurs

### Frontend
- [ ] **À CRÉER**: `AdminVouchersPage.tsx`
- [ ] **À CRÉER**: `VoucherRequestCard.tsx`
- [ ] **À CRÉER**: `VoucherFilters.tsx`
- [ ] **À CRÉER**: `VerifyModal.tsx`
- [ ] **À CRÉER**: `RejectModal.tsx`
- [ ] **À CRÉER**: Route `/admin/vouchers`
- [ ] **À VÉRIFIER**: Authentification admin

### Base de données
- [x] Table `voucher_requests` existe
- [x] Table `subscriptions` existe
- [x] Table `tenants` existe
- [ ] **À VÉRIFIER**: Colonnes manquantes
- [ ] **À VÉRIFIER**: Indexes performance

### Synchronisation
- [x] SyncV2 engine existant
- [x] Outbox queue existante
- [ ] **À VÉRIFIER**: Entity registry pour voucher_requests
- [ ] **À VÉRIFIER**: Realtime pull pour vouchers

---

## ⚠️ RISQUES IDENTIFIÉS

### Risque 1: Synchronisation lente
**Impact**: Moyen  
**Mitigation**: 
- Queue outbox avec retry
- Monitoring temps de sync
- Alertes si > 5min

### Risque 2: Conflits de validation
**Impact**: Élevé  
**Mitigation**:
- Transaction atomique
- Lock sur la ligne
- Vérification de statut avant update

### Risque 3: Emails non envoyés
**Impact**: Faible  
**Mitigation**:
- Best-effort (ne bloque pas la validation)
- Retry automatique
- Logging des échecs

### Risque 4: Performance (beaucoup de vouchers)
**Impact**: Moyen  
**Mitigation**:
- Pagination (20 par page)
- Index sur `status` et `created_at`
- Cache des filtres

---

## 📈 MONITORING

### Métriques à tracker

```typescript
{
  // Performance
  validationLatency: number,      // Temps de validation (ms)
  syncLatency: number,            // Temps de sync (ms)
  
  // Business
  vouchersValidated: number,      // Validations par heure
  vouchersRejected: number,       // Rejets par heure
  validationRate: number,         // % validés vs total
  
  // Erreurs
  validationErrors: number,       // Erreurs de validation
  syncErrors: number,             // Erreurs de sync
  emailErrors: number             // Erreurs d'email
}
```

### Alertes

```typescript
// Si > 10 validations en attente depuis > 1h
if (pendingCount > 10 && waitingTime > 3600) {
  sendAlert('⚠️ 10+ validations en attente');
}

// Si taux d'erreur > 10%
if (errorRate > 0.1) {
  sendAlert('❌ Taux d\'erreur élevé');
}
```

---

## 🎯 DÉCISIONS D'ARCHITECTURE

### ADR-001: Transaction atomique
**Décision**: Utiliser des transactions SQLite pour la validation  
**Raison**: Garantir la cohérence des données  
**Conséquence**: Si une étape échoue, tout est rollback

### ADR-002: Best-effort pour emails
**Décision**: Ne pas bloquer la validation si l'email échoue  
**Raison**: La validation est plus importante que l'email  
**Conséquence**: Les emails échoués sont loggés pour retry

### ADR-003: Last-Write-Wins pour sync
**Décision**: Utiliser timestamp pour résoudre les conflits  
**Raison**: Simplicité et performance  
**Conséquence**: En cas de conflit, la version la plus récente gagne

### ADR-004: Historique immuable
**Décision**: Ne jamais supprimer de vouchers  
**Raison**: Audit trail et conformité  
**Conséquence**: Table peut grossir, prévoir archivage

---

## 📝 PROCHAINES ÉTAPES

### Immédiat (cette semaine)
1. ✅ Rapport d'architecture (CE DOCUMENT)
2. ⏳ Vérifier routes API existantes
3. ⏳ Créer AdminVouchersPage.tsx
4. ⏳ Créer composants UI
5. ⏳ Tester workflow complet

### Court terme (semaine prochaine)
1. Tests unitaires
2. Tests d'intégration
3. Documentation utilisateur
4. Formation admins

### Moyen terme (mois 1)
1. Dashboard statistiques
2. Export CSV
3. Webhooks
4. Mobile app admin

---

## 📚 RÉFÉRENCES

- `docs/BILLING_AUDIT_REPORT.md` — Audit initial
- `docs/BILLING_V2_IMPLEMENTATION_REPORT.md` — Interface client
- `docs/BILLING_EXPIRATION_SYSTEM.md` — Système d'expiration
- `docs/IMPLEMENTATION_ROADMAP.md` — Feuille de route
- `src/server/routes/admin.subscriptions.ts` — Routes API
- `src/server/services/billing-expiration.service.ts` — Service expiration

---

**Rapport d'architecture terminé** ✅

**Prêt pour implémentation** 🚀