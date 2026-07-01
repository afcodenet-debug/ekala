# Stratégie d'Intégration du Système de Billing V1.1

## 📊 Analyse de l'Architecture Existante

### Système Actuel
- **TENANT (POS):** Application principale pour restaurants/commerces
- **PLATFORM:** Interface super admin pour gérer les tenants
- **Ancien système:** Utilise Supabase + subscription-guard middleware
- **Nouveau système:** PostgreSQL + architecture Clean (V1.1)

### Défi
Intégrer le nouveau système V1.1 **sans casser** l'ancien système, avec une migration progressive.

---

## 🎯 Stratégie d'Intégration

### Phase 1: Parallel Run (Semaine 1-2)
**Objectif:** Les deux systèmes cohabitent sans conflit

```
┌─────────────────────────────────────────┐
│         ANCIEN SYSTÈME (Supabase)        │
│  - subscription-guard.ts                │
│  - Supabase subscription tables         │
│  - Cache in-memory (5 min)              │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         NOUVEAU SYSTÈME (Postgres)       │
│  - billing V1.1 (subscriptions, vouchers)│
│  - Atomic transactions                  │
│  - Idempotency + Rate limiting          │
└─────────────────────────────────────────┘
```

**Actions:**
1. Nouveau système opérationnel en parallèle
2. Ancien système continue de fonctionner
3. Aucune modification du code existant
4. Tests comparatifs

### Phase 2: Migration des Tenants (Semaine 3-4)
**Objectif:** Migrer les tenants un par un

```
Pour chaque tenant:
1. Lire subscription depuis Supabase (ancien)
2. Créer subscription dans Postgres (nouveau)
3. Activer flag: use_new_billing_system = true
4. Tester pendant 24h
5. Si OK → garder nouveau
6. Si KO → rollback vers ancien
```

### Phase 3: Désactivation Ancien (Semaine 5-6)
**Objectif:** Décommissionner l'ancien système

```
1. Tous les tenants migrés
2. subscription-guard.ts lit depuis nouveau système
3. Supabase tables en lecture seule
4. Suppression après 30 jours de validation
```

---

## 🔧 Architecture d'Intégration

### 1. Subscription Adapter (Nouveau)

**Fichier:** `src/server/infrastructure/billing/subscription-adapter.ts`

```typescript
/**
 * SubscriptionAdapter - Pont entre ancien et nouveau système
 * 
 * Stratégie:
 * - Si tenant a flag use_new_billing_system → utiliser nouveau système
 * - Sinon → utiliser ancien système (Supabase)
 * - Migration automatique lors de l'activation par voucher
 */

import { SubscriptionService } from '../application/billing/services/SubscriptionService';
import { checkSubscriptionStatus } from '../middleware/subscription-guard';

export class SubscriptionAdapter {
  constructor(
    private newBillingService: SubscriptionService,
    private supabaseCheck: typeof checkSubscriptionStatus
  ) {}

  /**
   * Vérifie le statut d'abonnement d'un tenant
   * Route automatiquement vers le bon système
   */
  async getSubscriptionStatus(tenantId: number): Promise<SubscriptionStatus> {
    // 1. Vérifier si le tenant utilise le nouveau système
    const useNewSystem = await this.checkTenantBillingSystem(tenantId);
    
    if (useNewSystem) {
      // Nouveau système (Postgres)
      return await this.getStatusFromNewSystem(tenantId);
    } else {
      // Ancien système (Supabase)
      return await this.getStatusFromOldSystem(tenantId);
    }
  }

  /**
   * Active un abonnement (uniquement nouveau système)
   */
  async activateWithVoucher(
    code: string,
    tenantId: number,
    idempotencyKey: string
  ): Promise<ActivationResult> {
    // Activer via nouveau système
    const result = await this.newBillingService.activateWithVoucher(
      code,
      tenantId.toString(),
      idempotencyKey
    );

    // Marquer le tenant comme utilisant le nouveau système
    if (result) {
      await this.markTenantUsingNewSystem(tenantId);
    }

    return result;
  }

  /**
   * Middleware unifié pour protéger les routes
   * Compatible avec les deux systèmes
   */
  createUnifiedGuard() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const tenantId = req.user?.tenant_id;
      
      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        const status = await this.getSubscriptionStatus(tenantId);
        
        if (status.active) {
          req.subscription = status;
          return next();
        } else {
          return res.status(403).json({ 
            error: 'SUBSCRIPTION_REQUIRED',
            message: 'Active subscription required',
            state: status.state
          });
        }
      } catch (error) {
        console.error('Subscription guard error:', error);
        return res.status(500).json({ error: 'SUBSCRIPTION_CHECK_FAILED' });
      }
    };
  }
}
```

### 2. Migration Script

**Fichier:** `scripts/migrate_tenants_to_billing_v1.1.js`

```javascript
/**
 * Migration Script: Ancien → Nouveau Système
 * 
 * Migre les tenants de Supabase vers Postgres V1.1
 * Stratégie: Migration à la demande + batch migration
 */

const { db } = require('../src/server/db/database');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateTenant(tenantId) {
  console.log(`Migrating tenant ${tenantId}...`);

  try {
    // 1. Lire l'ancien abonnement depuis Supabase
    const { data: oldSubscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !oldSubscription) {
      console.log(`  No subscription found for tenant ${tenantId}`);
      return;
    }

    // 2. Créer le nouvel abonnement dans Postgres
    const newSubscription = {
      tenant_id: tenantId.toString(),
      plan: mapPlanId(oldSubscription.plan_id),
      status: mapStatus(oldSubscription.status),
      start_date: oldSubscription.start_date,
      end_date: oldSubscription.end_date,
      activation_source: 'migration',
      activation_reference: `MIGRATION-${Date.now()}`,
      activated_at: oldSubscription.activated_at,
      created_at: oldSubscription.created_at,
      updated_at: new Date().toISOString()
    };

    await db.query(
      `INSERT INTO subscriptions (...)
       VALUES (...)
       ON CONFLICT (tenant_id) DO UPDATE SET ...`,
      [...]
    );

    // 3. Marquer le tenant comme migré
    await db.query(
      `UPDATE tenants SET use_new_billing_system = true WHERE id = $1`,
      [tenantId]
    );

    console.log(`  ✅ Tenant ${tenantId} migrated successfully`);
  } catch (error) {
    console.error(`  ❌ Failed to migrate tenant ${tenantId}:`, error);
  }
}

async function migrateAllTenants() {
  console.log('Starting migration of all tenants...\n');

  // Récupérer tous les tenants actifs
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('is_active', true);

  for (const tenant of tenants) {
    await migrateTenant(tenant.id);
  }

  console.log('\n✅ Migration completed');
}

migrateAllTenants();
```

### 3. Mise à Jour du Middleware

**Fichier:** `src/server/middleware/subscription-guard.ts` (modifié)

```typescript
// Ajouter en tête du fichier
import { SubscriptionAdapter } from '../infrastructure/billing/subscription-adapter';

// Créer une instance globale
const subscriptionAdapter = new SubscriptionAdapter(
  billingService, // Nouveau service V1.1
  checkSubscriptionStatus // Ancienne fonction Supabase
);

// Remplacer checkSubscriptionStatus par:
export async function checkSubscriptionStatus(tenantId: number): Promise<SubscriptionGuardResult> {
  return await subscriptionAdapter.getSubscriptionStatus(tenantId);
}
```

---

## 🎨 Intégration Frontend

### 1. Context Unifié

**Fichier:** `src/contexts/UnifiedSubscriptionContext.tsx` (nouveau)

```typescript
/**
 * UnifiedSubscriptionContext - Combine ancien et nouveau système
 * 
 * Fournit une interface unifiée pour le frontend,
 * quel que soit le système de billing utilisé en backend.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { billingAPI } from '../lib/billing-api'; // Nouveau système
import { useSubscriptionStore } from '../stores/useSubscriptionStore'; // Ancien système

interface UnifiedSubscriptionContextType {
  status: SubscriptionStatus | null;
  loading: boolean;
  error: string | null;
  activateWithVoucher: (code: string) => Promise<void>;
  checkStatus: () => Promise<void>;
}

export const UnifiedSubscriptionContext = createContext<UnifiedSubscriptionContextType | null>(null);

export function UnifiedSubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useNewSystem, setUseNewSystem] = useState(false);

  // Détecter quel système est utilisé
  useEffect(() => {
    checkBillingSystem();
  }, []);

  const checkBillingSystem = async () => {
    try {
      // Vérifier si le tenant utilise le nouveau système
      const tenantId = getCurrentTenantId();
      const result = await fetch(`/api/v1/subscription/status/${tenantId}`);
      
      if (result.ok) {
        setUseNewSystem(true);
      } else {
        setUseNewSystem(false);
      }
    } catch (error) {
      setUseNewSystem(false);
    }
  };

  const activateWithVoucher = async (code: string) => {
    setLoading(true);
    setError(null);

    try {
      if (useNewSystem) {
        // Nouveau système V1.1
        const result = await billingAPI.activateSubscription({
          code,
          tenant_id: getCurrentTenantId().toString(),
          idempotency_key: crypto.randomUUID()
        });
        
        if (result.status === 'SUCCESS') {
          setStatus({
            active: true,
            plan: result.subscription?.plan,
            expires_at: result.subscription?.end_date
          });
        }
      } else {
        // Ancien système (Supabase)
        // ... logique existante
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <UnifiedSubscriptionContext.Provider value={{
      status,
      loading,
      error,
      activateWithVoucher,
      checkStatus: checkBillingSystem
    }}>
      {children}
    </UnifiedSubscriptionContext.Provider>
  );
}

export const useUnifiedSubscription = () => {
  const context = useContext(UnifiedSubscriptionContext);
  if (!context) {
    throw new Error('useUnifiedSubscription must be used within UnifiedSubscriptionProvider');
  }
  return context;
};
```

### 2. Mise à Jour des Composants

**Fichier:** `src/pages/settings/SubscriptionPremiumPage.tsx` (modifié)

```typescript
// Remplacer l'ancien système par le nouveau
import { useUnifiedSubscription, BillingDemo } from '../contexts/UnifiedSubscriptionContext';

function SubscriptionPremiumPage() {
  const { status, activateWithVoucher, loading, error } = useUnifiedSubscription();

  return (
    <div>
      <h1>Gestion d'Abonnement</h1>
      
      {/* Afficher le statut */}
      {status && (
        <div>
          <p>Plan: {status.plan}</p>
          <p>Expire le: {status.expires_at}</p>
        </div>
      )}

      {/* Activer avec voucher */}
      <BillingDemo />

      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

---

## 📋 Plan d'Exécution Détaillé

### Étape 1: Créer l'Adapter (Jour 1)
- [ ] Créer `subscription-adapter.ts`
- [ ] Implémenter routing automatique
- [ ] Tester avec tenants existants

### Étape 2: Script de Migration (Jour 2)
- [ ] Créer `migrate_tenants_to_billing_v1.1.js`
- [ ] Tester sur 1 tenant
- [ ] Valider les données migrées

### Étape 3: Frontend Unifié (Jour 3-4)
- [ ] Créer `UnifiedSubscriptionContext`
- [ ] Mettre à jour `SubscriptionPremiumPage`
- [ ] Tester les deux systèmes

### Étape 4: Tests d'Intégration (Jour 5)
- [ ] Tests comparatifs ancien vs nouveau
- [ ] Tests de basculement
- [ ] Tests de rollback

### Étape 5: Migration Progressive (Semaine 2-4)
- [ ] Migrer 10% des tenants
- [ ] Monitoring 24h
- [ ] Si OK → continuer
- [ ] Si KO → rollback

### Étape 6: Finalisation (Semaine 5-6)
- [ ] Migrer 100% des tenants
- [ ] Désactiver ancien système
- [ ] Nettoyer le code

---

## 🛡️ Sécurité et Rollback

### Rollback Automatique
```typescript
async function activateWithVoucher(code: string, tenantId: number) {
  try {
    // Essayer le nouveau système
    const result = await newSystem.activate(code, tenantId);
    
    // Marquer comme migré
    await markAsMigrated(tenantId);
    
    return result;
  } catch (error) {
    console.error('New system failed, rolling back to old system');
    
    // Rollback automatique vers ancien système
    await markAsNotMigrated(tenantId);
    
    // Réessayer avec ancien système si applicable
    // ...
    
    throw error;
  }
}
```

### Monitoring
```typescript
// Logger chaque appel
console.log(`[BILLING] Tenant ${tenantId} using ${useNewSystem ? 'NEW' : 'OLD'} system`);

// Métriques
- Nombre de tenants sur nouveau système
- Taux de succès nouveau vs ancien
- Temps de réponse
- Erreurs
```

---

## ✅ Checklist d'Intégration

### Backend
- [ ] SubscriptionAdapter créé
- [ ] Migration script créé et testé
- [ ] subscription-guard.ts modifié
- [ ] Routes API unifiées
- [ ] Tests d'intégration passés

### Frontend
- [ ] UnifiedSubscriptionContext créé
- [ ] Composants mis à jour
- [ ] BillingDemo intégré
- [ ] Tests E2E passés

### Migration
- [ ] Script de migration testé
- [ ] Procédure de rollback définie
- [ ] Monitoring en place
- [ ] Documentation à jour

### Production
- [ ] 10% tenants migrés (test)
- [ ] 50% tenants migrés (validation)
- [ ] 100% tenants migrés (production)
- [ ] Ancien système désactivé

---

## 🎯 Prochaines Actions Immédiates

1. **Créer subscription-adapter.ts** (pont entre systèmes)
2. **Créer migrate_tenants_to_billing_v1.1.js** (script de migration)
3. **Mettre à jour subscription-guard.ts** (utiliser l'adapter)
4. **Créer UnifiedSubscriptionContext** (frontend unifié)
5. **Tester sur 1 tenant** (validation)

---

**STATUT:** 📋 Plan d'intégration professionnel défini  
**APPROCHE:** Migration progressive avec rollback automatique  
**RISQUE:** Minimal (systèmes en parallèle)  
**DURÉE:** 5-6 semaines  
**PRÊT POUR:** Implémentation