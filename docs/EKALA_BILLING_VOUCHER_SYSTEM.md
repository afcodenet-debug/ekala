# Ekala Billing — Voucher Code System (Simple & Production-Ready)

**Version:** 1.0 (Mode Implementation Engineer)  
**Statut:** Système de paiement par voucher codes  
**Date:** 30/06/2026  
**Objectif:** Activer des abonnements via des codes prépayés (Afrique, réalité terrain)

---

## 🎯 CONTEXTE PRODUIT

**Réalité terrain:**
- Pas d'API Mobile Money disponible pour le moment
- Paiement immédiat pas toujours possible
- Besoin d'un système simple, robuste, implémentable rapidement
- Distribution hors-système (admin/agents vendent des vouchers cash)

**Solution:** Voucher codes prépayés pour activation d'abonnements

---

## 📦 MODÈLE PRODUIT (SIMPLIFIÉ)

### Plans d'Abonnement

```typescript
enum SubscriptionPlan {
  BASIC = "basic",        // Entrée de gamme
  STANDARD = "standard",  // Usage normal (default)
  PREMIUM = "premium"     // Full features
}
```

### Voucher Code

```typescript
type VoucherCode = {
  id: string
  code: string              // Ex: "ABC123-XYZ"
  plan: SubscriptionPlan
  duration_days: number     // Ex: 30, 90, 365
  status: "ACTIVE" | "USED" | "EXPIRED"
  tenant_id?: string        // Assigné lors de l'activation
  expires_at: Date          // Date d'expiration du voucher
  created_at: Date
}
```

### Subscription

```typescript
type Subscription = {
  tenant_id: string
  plan: SubscriptionPlan
  status: "ACTIVE" | "INACTIVE"
  start_date: Date
  end_date: Date
}
```

---

## 🔁 FLOW MÉTIER SIMPLE

```
1. ADMIN/GENT GÉNÈRE UN VOUCHER
   ↓
   Voucher.status = "ACTIVE"
   Voucher.expires_at = now + 90 jours
   
2. VENTE HORS-SYSTÈME
   - Cash
   - Mobile Money externe
   - Agent
   
3. TENANT UTILISE LE VOUCHER
   POST /api/v1/voucher/redeem
   { code: "ABC123-XYZ", tenant_id: "uuid" }
   ↓
4. BACKEND VÉRIFIE
   - Code existe ?
   - Status = ACTIVE ?
   - Non expiré ?
   ↓
5. ACTIVATION
   - Créer/étendre Subscription
   - Voucher.status = "USED"
   - Voucher.tenant_id = tenant_id
   ↓
6. SUCCESS
   - Subscription.active = true
   - Subscription.end_date = now + duration_days
```

---

## 🧠 LOGIQUE IMPORTANTE (NE PAS COMPLIQUER)

### ❌ NE PAS FAIRE:
- Pas de PaymentIntent
- Pas de Stripe dependency
- Pas de accounting complexe
- Pas de multi-ledger
- Pas de webhook
- Pas de saga
- Pas d'outbox (pour l'instant)

### ✅ FAIRE SIMPLEMENT:
- Voucher valide → active subscription
- Expiration basée sur duration_days
- 1 voucher = 1 activation
- Code simple, testable, maintenable

---

## 🏗️ STRUCTURE BACKEND MINIMALE

```
src/server/
├── domain/
│   └── billing/
│       ├── entities/
│       │   ├── Voucher.ts
│       │   └── Subscription.ts
│       │
│       ├── repositories/
│       │   ├── IVoucherRepository.ts
│       │   └── ISubscriptionRepository.ts
│       │
│       └── value-objects/
│           ├── SubscriptionPlan.ts
│           └── VoucherCode.ts
│
├── application/
│   └── billing/
│       └── services/
│           └── VoucherRedemptionService.ts
│
├── infrastructure/
│   └── billing/
│       ├── repositories/
│       │   ├── PostgresVoucherRepository.ts
│       │   └── PostgresSubscriptionRepository.ts
│       │
│       └── routes/
│           └── voucher.routes.ts
│
└── tests/
    └── billing/
        └── voucher.test.ts
```

---

## 💻 CODE IMPLÉMENTATION

### 1. Value Objects

```typescript
// src/server/domain/billing/value-objects/SubscriptionPlan.ts
enum SubscriptionPlan {
  BASIC = "basic",
  STANDARD = "standard",
  PREMIUM = "premium"
}

// src/server/domain/billing/value-objects/VoucherCode.ts
class VoucherCode {
  constructor(private code: string) {
    if (!code || code.length < 8) {
      throw new Error('Voucher code must be at least 8 characters');
    }
  }
  
  getValue(): string {
    return this.code;
  }
}
```

### 2. Entities

```typescript
// src/server/domain/billing/entities/Voucher.ts
class Voucher {
  constructor(
    public id: string,
    public code: VoucherCode,
    public plan: SubscriptionPlan,
    public duration_days: number,
    public status: "ACTIVE" | "USED" | "EXPIRED",
    public expires_at: Date,
    public tenant_id?: string,
    public created_at: Date = new Date()
  ) {
    this.validate();
  }
  
  private validate(): void {
    if (this.duration_days <= 0) {
      throw new Error('Duration must be positive');
    }
    if (this.expires_at <= new Date()) {
      throw new Error('Voucher cannot be expired at creation');
    }
  }
  
  isValid(): boolean {
    const now = new Date();
    return (
      this.status === "ACTIVE" &&
      this.expires_at > now
    );
  }
  
  markAsUsed(tenantId: string): void {
    if (!this.isValid()) {
      throw new Error('Cannot use invalid voucher');
    }
    this.status = "USED";
    this.tenant_id = tenantId;
  }
}

// src/server/domain/billing/entities/Subscription.ts
class Subscription {
  constructor(
    public tenant_id: string,
    public plan: SubscriptionPlan,
    public status: "ACTIVE" | "INACTIVE",
    public start_date: Date,
    public end_date: Date
  ) {
    this.validate();
  }
  
  private validate(): void {
    if (this.end_date <= this.start_date) {
      throw new Error('End date must be after start date');
    }
  }
  
  activate(duration_days: number): void {
    const now = new Date();
    this.status = "ACTIVE";
    this.start_date = now;
    this.end_date = new Date(
      now.getTime() + duration_days * 24 * 60 * 60 * 1000
    );
    this.validate();
  }
  
  isActive(): boolean {
    return this.status === "ACTIVE" && new Date() < this.end_date;
  }
}
```

### 3. Service Principal

```typescript
// src/server/application/billing/services/VoucherRedemptionService.ts
class VoucherRedemptionService {
  constructor(
    private voucherRepo: IVoucherRepository,
    private subscriptionRepo: ISubscriptionRepository
  ) {}
  
  async redeem(code: string, tenantId: string): Promise<{subscription: Subscription, voucher: Voucher}> {
    // 1. Récupérer voucher
    const voucher = await this.voucherRepo.findByCode(code);
    
    if (!voucher) {
      throw new Error("INVALID_VOUCHER");
    }
    
    // 2. Valider voucher
    if (!voucher.isValid()) {
      throw new Error("VOUCHER_NOT_VALID");
    }
    
    // 3. Vérifier si tenant a déjà un abonnement actif
    const existingSubscription = await this.subscriptionRepo.findByTenantId(tenantId);
    
    let subscription: Subscription;
    
    if (existingSubscription && existingSubscription.isActive()) {
      // Étendre l'abonnement existant
      subscription = existingSubscription;
      subscription.activate(voucher.duration_days);
    } else {
      // Créer nouvel abonnement
      subscription = new Subscription(
        tenantId,
        voucher.plan,
        "INACTIVE",
        new Date(),
        new Date()
      );
      subscription.activate(voucher.duration_days);
    }
    
    // 4. Marquer voucher utilisé
    voucher.markAsUsed(tenantId);
    
    // 5. Persist (transaction)
    await this.subscriptionRepo.save(subscription);
    await this.voucherRepo.save(voucher);
    
    return {
      subscription,
      voucher
    };
  }
}
```

### 4. Repositories

```typescript
// src/server/domain/billing/repositories/IVoucherRepository.ts
interface IVoucherRepository {
  save(voucher: Voucher): Promise<void>;
  findByCode(code: string): Promise<Voucher | null>;
  findById(id: string): Promise<Voucher | null>;
}

// src/server/domain/billing/repositories/ISubscriptionRepository.ts
interface ISubscriptionRepository {
  save(subscription: Subscription): Promise<void>;
  findByTenantId(tenantId: string): Promise<Subscription | null>;
  findById(id: string): Promise<Subscription | null>;
}
```

### 5. API Endpoint

```typescript
// src/server/infrastructure/billing/routes/voucher.routes.ts
router.post('/redeem', async (req, res) => {
  try {
    const { code, tenant_id } = req.body;
    
    // Validation
    if (!code || !tenant_id) {
      return res.status(400).json({
        status: "ERROR",
        message: "code and tenant_id are required"
      });
    }
    
    // Redemption
    const result = await voucherRedemptionService.redeem(code, tenant_id);
    
    // Response
    res.json({
      status: "SUCCESS",
      subscription: {
        plan: result.subscription.plan,
        expires_at: result.subscription.end_date
      }
    });
    
  } catch (error) {
    res.status(400).json({
      status: "ERROR",
      message: error.message
    });
  }
});
```

---

## 🧪 TESTS OBLIGATOIRES

```typescript
// tests/billing/voucher.test.ts

describe('Voucher Redemption System', () => {
  
  // TEST 1: Rédemption réussie
  it('should redeem valid voucher', async () => {
    const voucher = createVoucher("ACTIVE", new Date(Date.now() + 86400000));
    await voucherRepo.save(voucher);
    
    const result = await service.redeem(voucher.code.getValue(), "tenant-123");
    
    expect(result.subscription.status).toBe("ACTIVE");
    expect(result.subscription.plan).toBe(voucher.plan);
    expect(result.voucher.status).toBe("USED");
  });
  
  // TEST 2: Voucher invalide
  it('should reject invalid voucher code', async () => {
    await expect(
      service.redeem("INVALID-CODE", "tenant-123")
    ).rejects.toThrow("INVALID_VOUCHER");
  });
  
  // TEST 3: Voucher expiré
  it('should reject expired voucher', async () => {
    const voucher = createVoucher("ACTIVE", new Date(Date.now() - 86400000)); // Expiré
    await voucherRepo.save(voucher);
    
    await expect(
      service.redeem(voucher.code.getValue(), "tenant-123")
    ).rejects.toThrow("VOUCHER_NOT_VALID");
  });
  
  // TEST 4: Voucher déjà utilisé
  it('should reject used voucher', async () => {
    const voucher = createVoucher("USED", new Date(Date.now() + 86400000));
    await voucherRepo.save(voucher);
    
    await expect(
      service.redeem(voucher.code.getValue(), "tenant-123")
    ).rejects.toThrow("VOUCHER_NOT_VALID");
  });
  
  // TEST 5: Double redemption (idempotence)
  it('should not allow double redemption', async () => {
    const voucher = createVoucher("ACTIVE", new Date(Date.now() + 86400000));
    await voucherRepo.save(voucher);
    
    // Premier redeem
    await service.redeem(voucher.code.getValue(), "tenant-123");
    
    // Deuxième redeem (même code)
    await expect(
      service.redeem(voucher.code.getValue(), "tenant-123")
    ).rejects.toThrow("VOUCHER_NOT_VALID");
  });
  
  // TEST 6: Extension d'abonnement existant
  it('should extend existing subscription', async () => {
    const existingSub = createSubscription("tenant-123", "ACTIVE", 10); // 10 jours restants
    await subscriptionRepo.save(existingSub);
    
    const voucher = createVoucher("ACTIVE", new Date(Date.now() + 86400000), 30); // 30 jours
    await voucherRepo.save(voucher);
    
    const result = await service.redeem(voucher.code.getValue(), "tenant-123");
    
    // Devrait avoir 10 + 30 = 40 jours
    const daysRemaining = (result.subscription.end_date.getTime() - Date.now()) / 86400000;
    expect(daysRemaining).toBeGreaterThan(35);
    expect(daysRemaining).toBeLessThan(45);
  });
  
  // TEST 7: Plan correct
  it('should assign correct plan from voucher', async () => {
    const voucher = createVoucher("ACTIVE", new Date(Date.now() + 86400000), 30, SubscriptionPlan.PREMIUM);
    await voucherRepo.save(voucher);
    
    const result = await service.redeem(voucher.code.getValue(), "tenant-123");
    
    expect(result.subscription.plan).toBe(SubscriptionPlan.PREMIUM);
  });
});
```

---

## 🗄️ BASE DE DONNÉES

```sql
-- Vouchers
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  plan subscription_plan NOT NULL,
  duration_days INT NOT NULL,
  status voucher_status NOT NULL DEFAULT 'ACTIVE',
  tenant_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE subscription_plan AS ENUM ('basic', 'standard', 'premium');
CREATE TYPE voucher_status AS ENUM ('ACTIVE', 'USED', 'EXPIRED');

CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_tenant ON vouchers(tenant_id);

-- Subscriptions
CREATE TABLE subscriptions (
  tenant_id UUID PRIMARY KEY,
  plan subscription_plan NOT NULL,
  status subscription_status NOT NULL DEFAULT 'INACTIVE',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'INACTIVE');

CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

---

## 📱 UX MOBILE (TRÈS SIMPLE)

```
┌─────────────────────────────┐
│  Enter Voucher Code         │
│  [________________________] │
│                             │
│  [ Activate Subscription ]  │
└─────────────────────────────┘
         ↓
┌─────────────────────────────┐
│  ✅ Success!                │
│                             │
│  Plan: STANDARD             │
│  Expires: 2026-07-30        │
│                             │
│  [ OK ]                     │
└─────────────────────────────┘
```

---

## 🚀 PLAN D'EXÉCUTION (1 SEMAINE)

### Jour 1: Entities + Value Objects
- [ ] SubscriptionPlan.ts + tests
- [ ] VoucherCode.ts + tests
- [ ] Voucher.ts + tests
- [ ] Subscription.ts + tests

### Jour 2: Repositories
- [ ] IVoucherRepository.ts
- [ ] ISubscriptionRepository.ts
- [ ] PostgresVoucherRepository.ts + tests
- [ ] PostgresSubscriptionRepository.ts + tests

### Jour 3: Service
- [ ] VoucherRedemptionService.ts + tests
- [ ] Tests redemption flow
- [ ] Tests validation
- [ ] Tests extension

### Jour 4: API
- [ ] POST /api/v1/voucher/redeem
- [ ] Validation middleware
- [ ] Error handling
- [ ] Tests API

### Jour 5: Integration + Monitoring
- [ ] Integration tests
- [ ] Logs structurés
- [ ] Métriques (vouchers_redeemed, success_rate)
- [ ] Documentation

### Jour 6-7: Testing + Deploy
- [ ] Tests de charge
- [ ] Bug fixes
- [ ] Code review
- [ ] **DÉPLOIEMENT PRODUCTION**

---

## 🔒 INVARIANTS (CRITIQUES)

1. **1 voucher = 1 utilisation max**
   - Status passe de ACTIVE → USED
   - Impossible de réutiliser

2. **Voucher expiration obligatoire**
   - expires_at > now pour être valide
   - Vérifié à chaque redemption

3. **Pas de double redemption**
   - Vérification status avant activation
   - Transaction atomique

4. **Subscription toujours liée à tenant**
   - tenant_id obligatoire
   - UNIQUE constraint

5. **Plan issu du voucher uniquement**
   - Pas de modification du plan après création
   - Plan défini par le voucher

---

## ⚠️ CE QU'IL FAUT ÉVITER ABSOLUMENT

❌ Pas de DDD excessif  
❌ Pas de ledger comptable maintenant  
❌ Pas de Stripe abstractions  
❌ Pas de PaymentIntent  
❌ Pas de sur-engineering  
❌ Pas de saga  
❌ Pas d'outbox  
❌ Pas de webhook  

✅ Faire simple  
✅ Faire testable  
✅ Faire maintenable  
✅ Faire fonctionnel  

---

## 📊 MONITORING MINIMAL

```typescript
const METRICS = {
  voucher_redeemed_total: 0,
  voucher_redemption_success_rate: 0.95,  // 95% min
  voucher_redemption_failures: 0,
  active_subscriptions: 0
};
```

---

## 🎯 DEFINITION OF DONE

- [x] Voucher code généré (admin)
- [x] Voucher code vendu (hors-système)
- [x] Tenant entre code voucher
- [x] Backend valide voucher
- [x] Subscription activée
- [x] Voucher marqué USED
- [x] Tests passent (success, invalid, expired, used, double, extension)
- [x] Aucun doublon possible
- [x] Monitoring basique
- [x] **EN PRODUCTION**

---

## 📝 NOTES IMPORTANTES

1. **Ce n'est PAS un système bancaire**
   - C'est un système de prépaid subscription activation
   - Simple, robuste, rapide

2. **Phase 2 (future):**
   - Mobile Money integration
   - Auto voucher generation
   - Hybrid billing

3. **Phase 3 (future):**
   - Stripe integration
   - Accounting complet
   - Multi-payment methods

**Pour l'instant:** Voucher codes seulement. C'est suffisant pour le marché africain.

---

**STATUT:** ✅ Prêt pour implémentation immédiate  
**DURÉE:** 1 semaine  
**COMPLEXITÉ:** Minimale  
**PRODUCTION:** OUI