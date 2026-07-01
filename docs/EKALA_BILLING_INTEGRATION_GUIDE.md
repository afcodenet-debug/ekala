# Guide d'Intégration - Système d'Abonnement V1.1

## 📦 Fichiers Créés

### Database
- `backend/migrations/048_subscription_voucher_system.sql` - Migration SQL

### Domain Layer
- `src/server/domain/billing/subscription/Subscription.ts` - Modèle Subscription
- `src/server/domain/billing/voucher/Voucher.ts` - Modèle Voucher
- `src/server/domain/billing/repositories/ISubscriptionRepository.ts` - Interface
- `src/server/domain/billing/repositories/IVoucherRepository.ts` - Interface
- `src/server/domain/billing/repositories/IIdempotencyRepository.ts` - Interface + Type

### Infrastructure Layer
- `src/server/infrastructure/billing/repositories/PostgresSubscriptionRepository.ts`
- `src/server/infrastructure/billing/repositories/PostgresVoucherRepository.ts`
- `src/server/infrastructure/billing/repositories/PostgresIdempotencyRepository.ts`
- `src/server/infrastructure/billing/routes/subscription.routes.ts`

### Application Layer
- `src/server/application/billing/helpers/calculateNewEndDate.ts` - Helper functions
- `src/server/application/billing/services/SubscriptionService.ts` - Core logic
- `src/server/application/billing/services/VoucherRedemptionService.ts` - Public API

### Documentation
- `docs/EKALA_BILLING_SUBSCRIPTION_SYSTEM.md` - Spécification complète

---

## 🔧 Intégration dans server.ts

### 1. Importer les modules

```typescript
import { createSubscriptionRoutes } from './infrastructure/billing/routes/subscription.routes';
import { PostgresSubscriptionRepository } from './infrastructure/billing/repositories/PostgresSubscriptionRepository';
import { PostgresVoucherRepository } from './infrastructure/billing/repositories/PostgresVoucherRepository';
import { PostgresIdempotencyRepository } from './infrastructure/billing/repositories/PostgresIdempotencyRepository';
import { SubscriptionService } from './application/billing/services/SubscriptionService';
import { VoucherRedemptionService } from './application/billing/services/VoucherRedemptionService';
```

### 2. Initialiser les services (après la connexion DB)

```typescript
// Dans la fonction setupServer() ou après db.connect()

// Repositories
const subscriptionRepo = new PostgresSubscriptionRepository(db);
const voucherRepo = new PostgresVoucherRepository(db);
const idempotencyRepo = new PostgresIdempotencyRepository(db);

// Services
const subscriptionService = new SubscriptionService(
  subscriptionRepo,
  voucherRepo,
  idempotencyRepo,
  db
);

const voucherRedemptionService = new VoucherRedemptionService(
  subscriptionService
);

// Routes
const subscriptionRoutes = createSubscriptionRoutes(db, voucherRedemptionService);

// Enregistrer les routes
app.use('/api/v1/subscription', subscriptionRoutes);
```

### 3. Exemple complet dans server.ts

```typescript
// src/server/server.ts

import { createSubscriptionRoutes } from './infrastructure/billing/routes/subscription.routes';
import { PostgresSubscriptionRepository } from './infrastructure/billing/repositories/PostgresSubscriptionRepository';
import { PostgresVoucherRepository } from './infrastructure/billing/repositories/PostgresVoucherRepository';
import { PostgresIdempotencyRepository } from './infrastructure/billing/repositories/PostgresIdempotencyRepository';
import { SubscriptionService } from './application/billing/services/SubscriptionService';
import { VoucherRedemptionService } from './application/billing/services/VoucherRedemptionService';

async function setupServer() {
  // ... existing code ...
  
  // Connect to database
  await db.connect();
  
  // ============================================
  // BILLING SYSTEM INITIALIZATION (V1.1)
  // ============================================
  
  // Initialize repositories
  const subscriptionRepo = new PostgresSubscriptionRepository(db);
  const voucherRepo = new PostgresVoucherRepository(db);
  const idempotencyRepo = new PostgresIdempotencyRepository(db);
  
  // Initialize services
  const subscriptionService = new SubscriptionService(
    subscriptionRepo,
    voucherRepo,
    idempotencyRepo,
    db
  );
  
  const voucherRedemptionService = new VoucherRedemptionService(
    subscriptionService
  );
  
  // Register routes
  const subscriptionRoutes = createSubscriptionRoutes(db, voucherRedemptionService);
  app.use('/api/v1/subscription', subscriptionRoutes);
  
  // ============================================
  // END BILLING SYSTEM INITIALIZATION
  // ============================================
  
  // ... rest of existing code ...
}
```

---

## 🗄️ Migration de la Base de Données

### Exécuter la migration

```bash
# Option 1: Via psql
psql -U your_user -d your_database -f backend/migrations/048_subscription_voucher_system.sql

# Option 2: Via le runner de migration (si existant)
npm run migrate
```

### Vérifier les tables créées

```sql
-- Vérifier subscriptions
SELECT * FROM subscriptions LIMIT 1;

-- Vérifier vouchers
SELECT * FROM vouchers LIMIT 1;

-- Vérifier idempotency_records
SELECT * FROM idempotency_records LIMIT 1;
```

---

## 🧪 Tests

### Tests Unitaires (à créer)

```typescript
// src/server/application/billing/helpers/__tests__/calculateNewEndDate.test.ts

import { calculateNewEndDate, decideActivationMode } from '../calculateNewEndDate';
import { Subscription } from '../../../domain/billing/subscription/Subscription';

describe('calculateNewEndDate', () => {
  it('should extend active subscription from end_date', () => {
    const now = new Date();
    const endDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
    
    const result = calculateNewEndDate(endDate, 30, true);
    
    const expected = new Date(endDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(result.getTime()).toBe(expected.getTime());
  });

  it('should restart expired subscription from now', () => {
    const pastDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    
    const result = calculateNewEndDate(pastDate, 30, false);
    
    const now = new Date();
    const expected = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Allow 1 second tolerance
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000);
  });
});

describe('decideActivationMode', () => {
  it('should return extend_existing for active subscription', () => {
    const subscription = new Subscription(
      'tenant-123',
      'basic',
      'ACTIVE',
      new Date(),
      new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      'voucher',
      'ABC123',
      new Date(),
      new Date(),
      new Date()
    );
    
    expect(decideActivationMode(subscription)).toBe('extend_existing');
  });

  it('should return activate_new for null subscription', () => {
    expect(decideActivationMode(null)).toBe('activate_new');
  });
});
```

### Tests d'Intégration (à créer)

```typescript
// src/server/application/billing/__tests__/subscription-service.test.ts

describe('SubscriptionService Integration', () => {
  let service: SubscriptionService;
  let db: any;

  beforeEach(async () => {
    // Setup test database
    db = await createTestDatabase();
    
    const subscriptionRepo = new PostgresSubscriptionRepository(db);
    const voucherRepo = new PostgresVoucherRepository(db);
    const idempotencyRepo = new PostgresIdempotencyRepository(db);
    
    service = new SubscriptionService(
      subscriptionRepo,
      voucherRepo,
      idempotencyRepo,
      db
    );
  });

  it('should activate subscription with valid voucher', async () => {
    // Create voucher
    const voucher = new Voucher(
      'TEST123',
      'basic',
      30,
      'ACTIVE',
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days from now
    );
    await voucherRepo.save(voucher);

    // Activate
    const result = await service.activateWithVoucher(
      'TEST123',
      'tenant-123',
      'idem-key-1'
    );

    expect(result.status).toBe('ACTIVE');
    expect(result.plan).toBe('basic');
    expect(result.activation_source).toBe('voucher');
  });

  it('should prevent double redemption (race condition)', async () => {
    // Create voucher
    const voucher = new Voucher(
      'TEST456',
      'premium',
      30,
      'ACTIVE',
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    );
    await voucherRepo.save(voucher);

    // Try to redeem twice simultaneously
    await Promise.all([
      service.activateWithVoucher('TEST456', 'tenant-1', 'idem-1'),
      service.activateWithVoucher('TEST456', 'tenant-2', 'idem-2')
    ]);

    // Check only one succeeded
    const count = await db.query('SELECT COUNT(*) FROM subscriptions WHERE activation_reference = $1', ['TEST456']);
    expect(count.rows[0].count).toBe('1');
  });
});
```

---

## 🚀 API Endpoints

### POST /api/v1/subscription/activate

Active un abonnement avec un code voucher.

**Request:**
```json
{
  "code": "ABC123",
  "tenant_id": "uuid-tenant",
  "idempotency_key": "uuid-v4"
}
```

**Success Response (200):**
```json
{
  "status": "SUCCESS",
  "subscription": {
    "tenant_id": "uuid-tenant",
    "plan": "basic",
    "status": "ACTIVE",
    "end_date": "2026-07-30T10:00:00Z",
    "activation_source": "voucher"
  }
}
```

**Error Response (400):**
```json
{
  "status": "ERROR",
  "message": "Invalid or expired voucher code"
}
```

**Rate Limit Response (429):**
```json
{
  "status": "ERROR",
  "message": "Too many attempts. Please try again later.",
  "retry_after": 45
}
```

### GET /api/v1/subscription/status/:tenantId

Récupère le statut d'abonnement d'un tenant.

**Success Response (200):**
```json
{
  "active": true,
  "plan": "basic",
  "expires_at": "2026-07-30T10:00:00Z"
}
```

### GET /api/v1/subscription/rate-limit/:tenantId

Récupère les informations de rate limiting.

**Success Response (200):**
```json
{
  "remaining": 3,
  "reset_after": 45
}
```

---

## 🔒 Invariants Critiques (V1.1)

### ❌ NEVER
1. **SELECT FOR UPDATE on vouchers** (jamais)
2. **Store full domain object in snapshot** (minimal DTO only)
3. **Trust JS Date for expiration** (DB NOW() only)
4. **Allow multiple subscriptions per tenant** (UPSERT obligatoire)
5. **Return idempotency without status check** (SUCCESS only)

### ✅ ALWAYS
1. **DB NOW() for time validation** (pas JS Date)
2. **Atomic UPDATE for voucher** (WHERE status = 'ACTIVE' AND expires_at > NOW())
3. **UPSERT subscription** (ON CONFLICT tenant_id)
4. **Snapshot minimal DTO only** (tenant_id, plan, status, end_date, activation_source)
5. **Idempotency gated by SUCCESS** (status === "SUCCESS")

---

## 📝 Notes d'Implémentation

### Performance
- Atomic voucher claim: 1 UPDATE, 0 rows = fail
- SELECT FOR UPDATE on subscription only (lock léger)
- UPSERT garanti (1 subscription par tenant)
- Idempotency snapshot (retry safe)
- Rate limiting en mémoire (5/min/tenant)

### Sécurité
- Transaction simple (READ COMMITTED)
- Idempotency status-gated (SUCCESS only)
- Snapshot minimal DTO only
- DB NOW() pour toutes les opérations temporelles
- Validation des inputs

### Extensibilité
- Architecture prête pour Phase 2/3
- Ajout de nouveaux canaux d'activation (stripe, mobile_money)
- Ajout de plans personnalisés
- Ajout de métriques et monitoring

---

## ✅ Checklist de Déploiement

- [ ] Migration SQL exécutée
- [ ] Tables créées (subscriptions, vouchers, idempotency_records)
- [ ] Services initialisés dans server.ts
- [ ] Routes enregistrées
- [ ] Tests unitaires passent
- [ ] Tests d'intégration passent
- [ ] Tests de charge passent
- [ ] Monitoring en place
- [ ] Documentation à jour
- [ ] **EN PRODUCTION**

---

## 🎯 Prochaines Étapes

1. **Tests**: Créer les tests unitaires et d'intégration
2. **Monitoring**: Ajouter des métriques (Prometheus, etc.)
3. **Admin UI**: Interface pour créer/gérer les vouchers
4. **Phase 2**: Intégration Stripe/Mobile Money
5. **Phase 3**: Event sourcing (si nécessaire)

---

**STATUT:** ✅ Architecture V1.1 implémentée, prête pour tests et déploiement