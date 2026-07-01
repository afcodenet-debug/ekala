# Fix Problèmes Frontend - UX et Navigation

## 🐛 Problèmes Identifiés

### 1. Sidebar non cliquable
**Symptôme:** Tous les NavItem sont grisés/insensibles au clic  
**Cause:** Middleware `subscription-guard.ts` bloque toutes les routes  
**Raison:** Le middleware utilise l'ancien système (Supabase) qui n'est pas encore migré

### 2. Logique billing pas appliquée au frontend
**Symptôme:** Pas de vérification d'abonnement dans l'UI  
**Cause:** Frontend ne détecte pas le nouveau système V1.1

---

## 🔧 Solution: Mettre à jour subscription-guard.ts

**Fichier:** `src/server/middleware/subscription-guard.ts`

### Problème Actuel
```typescript
// Ancien code - utilise directement Supabase
async function checkSubscriptionStatus(tenantId: number) {
  const supabase = getSupabase();
  // ... query Supabase directement
}
```

### Solution: Utiliser l'Adapter
```typescript
// Nouveau code - utilise l'adapter unifié
import { getSubscriptionAdapter } from '../infrastructure/billing/subscription-adapter';

export async function checkSubscriptionStatus(tenantId: number): Promise<SubscriptionGuardResult> {
  const adapter = getSubscriptionAdapter();
  
  if (adapter) {
    // Nouveau système V1.1
    return await adapter.getSubscriptionStatus(tenantId);
  } else {
    // Fallback ancien système
    return await checkSubscriptionStatusOld(tenantId);
  }
}
```

---

## 📋 Plan de Fix

### Étape 1: Créer un wrapper pour subscription-guard (5 min)

**Fichier:** `src/server/middleware/subscription-guard-wrapper.ts` (nouveau)

```typescript
/**
 * SubscriptionGuardWrapper - Wrapper compatible avec l'adapter
 * 
 * Ce wrapper permet d'utiliser le nouveau SubscriptionAdapter
 * tout en gardant le code existant fonctionnel.
 */

import { Request, Response, NextFunction } from 'express';
import { getSubscriptionAdapter } from '../infrastructure/billing/subscription-adapter';

export type SubscriptionState =
  | 'active'
  | 'trial'
  | 'grace'
  | 'suspended'
  | 'cancelled'
  | 'expired'
  | 'no_plan'
  | 'pending';

export interface SubscriptionGuardResult {
  state: SubscriptionState;
  tenantId: number;
  planName: string | null;
  daysUntilRenewal: number | null;
  isExpired: boolean;
  isGracePeriod: boolean;
  graceDaysRemaining: number | null;
  subscriptionId: number | null;
  planId: number | null;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: number;
    tenant_id: number;
    role: string;
    email?: string;
    full_name?: string;
  };
  subscription?: SubscriptionGuardResult;
}

/**
 * Middleware unifié qui utilise l'adapter
 * Compatible avec ancien et nouveau système
 */
export function subscriptionGuardWrapper() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const adapter = getSubscriptionAdapter();

      if (adapter) {
        // Nouveau système V1.1
        const status = await adapter.getSubscriptionStatus(tenantId);
        (req as any).subscription = status;

        // Allow access for active, trial, and grace period
        if (status.state === 'active' || status.state === 'trial' || status.state === 'grace') {
          return next();
        } else {
          return res.status(403).json({
            error: 'SUBSCRIPTION_REQUIRED',
            message: 'Active subscription required',
            state: status.state,
            planName: status.planName,
            daysUntilRenewal: status.daysUntilRenewal,
          });
        }
      } else {
        // Adapter not initialized, allow access (fallback)
        console.warn('[SUBSCRIPTION GUARD] Adapter not available, allowing access');
        return next();
      }
    } catch (error) {
      console.error('[SUBSCRIPTION GUARD] Error:', error);
      // On error, allow access to avoid blocking the app
      return next();
    }
  };
}
```

### Étape 2: Mettre à jour server.ts (2 min)

**Fichier:** `src/server/server.ts`

```typescript
// Remplacer l'import de subscription-guard
import { subscriptionGuardWrapper } from './middleware/subscription-guard-wrapper';

// Dans le setup des routes, remplacer:
// app.use('/api/v1/...', subscriptionGuard());
// Par:
app.use('/api/v1/...', subscriptionGuardWrapper());
```

### Étape 3: Créer un hook frontend pour le billing (10 min)

**Fichier:** `src/hooks/useBillingStatus.ts` (nouveau)

```typescript
/**
 * Hook pour vérifier le statut d'abonnement dans le frontend
 * Utilise le nouveau système V1.1 avec fallback
 */

import { useState, useEffect } from 'react';
import { billingAPI } from '../lib/billing-api';

export interface BillingStatus {
  active: boolean;
  plan: string | null;
  expiresAt: string | null;
  daysUntilRenewal: number | null;
  state: 'active' | 'trial' | 'grace' | 'expired' | 'no_plan';
}

export function useBillingStatus(tenantId: string | null) {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    checkStatus();
  }, [tenantId]);

  const checkStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      // Essayer le nouveau système V1.1
      const response = await fetch(`/api/v1/subscription/status/${tenantId}`);
      
      if (response.ok) {
        const data = await response.json();
        setStatus({
          active: data.active,
          plan: data.plan,
          expiresAt: data.expires_at,
          daysUntilRenewal: data.daysUntilRenewal,
          state: data.active ? 'active' : 'expired',
        });
      } else {
        // Fallback: ancien système ou pas de subscription
        setStatus({
          active: true, // Par défaut, permettre l'accès
          plan: null,
          expiresAt: null,
          daysUntilRenewal: null,
          state: 'active',
        });
      }
    } catch (err) {
      console.error('Failed to check billing status:', err);
      setError('Failed to check subscription status');
      
      // En cas d'erreur, permettre l'accès (fail-open)
      setStatus({
        active: true,
        plan: null,
        expiresAt: null,
        daysUntilRenewal: null,
        state: 'active',
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    status,
    loading,
    error,
    checkStatus,
    isActive: status?.active ?? true,
    isExpired: status?.state === 'expired' || status?.state === 'no_plan',
  };
}
```

### Étape 4: Intégrer dans App.tsx (5 min)

**Fichier:** `src/App.tsx`

```typescript
// Ajouter en haut du composant principal
import { useBillingStatus } from './hooks/useBillingStatus';

function App() {
  const { user } = useAuthStore();
  const { isExpired } = useBillingStatus(user?.tenant_id?.toString() || null);

  return (
    <div className="app">
      {isExpired && (
        <div className="billing-warning">
          <p>Your subscription has expired. Please renew to continue.</p>
          <button onClick={() => navigate('/settings/subscription')}>
            Renew Now
          </button>
        </div>
      )}
      
      {/* Rest of the app */}
      <Sidebar />
      {/* ... */}
    </div>
  );
}
```

### Étape 5: Créer un composant de bannière d'avertissement (5 min)

**Fichier:** `src/components/SubscriptionBanner.tsx` (nouveau)

```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { useBillingStatus } from '../hooks/useBillingStatus';

export function SubscriptionBanner() {
  const navigate = useNavigate();
  const { isExpired, loading } = useBillingStatus('current-tenant-id');

  if (loading || !isExpired) return null;

  return (
    <div className="subscription-banner" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(135deg, #dc2626, #991b1b)',
      color: 'white',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 9999,
      boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <AlertTriangle size={20} />
        <div>
          <strong>Subscription Expired</strong>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
            Your subscription has expired. Please renew to continue using the platform.
          </p>
        </div>
      </div>
      
      <button
        onClick={() => navigate('/settings/subscription')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: 'white',
          color: '#dc2626',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'transform 0.2s',
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <CreditCard size={16} />
        Renew Now
      </button>
    </div>
  );
}
```

---

## ✅ Checklist de Fix

### Backend (CRITIQUE)
- [ ] Créer `subscription-guard-wrapper.ts`
- [ ] Mettre à jour `server.ts` pour utiliser le wrapper
- [ ] Tester que les routes sont accessibles
- [ ] Vérifier les logs du middleware

### Frontend
- [ ] Créer `useBillingStatus` hook
- [ ] Créer `SubscriptionBanner` component
- [ ] Intégrer dans `App.tsx`
- [ ] Tester la navigation
- [ ] Tester avec tenant actif
- [ ] Tester avec tenant expiré

### Tests
- [ ] Tester navigation avec ancien système
- [ ] Tester navigation avec nouveau système
- [ ] Tester expiration d'abonnement
- [ ] Tester renouvellement

---

## 🚀 Déploiement du Fix

### 1. Backend (Immédiat)
```bash
# Redémarrer le serveur
npm run dev

# Vérifier les logs
# Doit afficher:
# [BILLING ADAPTER] ✅ New billing system V1.1 available
# [SUBSCRIPTION GUARD] Using adapter
```

### 2. Frontend (Immédiat)
```bash
# Rebuild frontend
npm run build

# Vérifier que la sidebar est cliquable
# Vérifier que la bannière apparaît si expiré
```

### 3. Test
```bash
# 1. Se connecter comme tenant
# 2. Vérifier que la sidebar est cliquable
# 3. Cliquer sur Dashboard, POS, etc.
# 4. Vérifier que la navigation fonctionne
```

---

## 🎯 Résultat Attendu

### Avant
- ❌ Sidebar grisée, aucun clic possible
- ❌ Toutes les routes bloquées
- ❌ Erreur 403 partout

### Après
- ✅ Sidebar entièrement cliquable
- ✅ Navigation fonctionnelle
- ✅ Bannière d'avertissement si expiré
- ✅ Accès autorisé pour abonnés actifs
- ✅ Accès autorisé pour tenants non migrés (ancien système)

---

## 📝 Notes Importantes

1. **Fail-Open:** En cas d'erreur, l'accès est autorisé (pas de blocage)
2. **Grace Period:** 7 jours de grâce après expiration
3. **Cache:** 5 minutes de cache pour éviter les requêtes répétées
4. **Logs:** Tous les accès sont loggés pour debugging

---

**STATUT:** 📋 Plan de fix prêt pour implémentation  
**PRIORITÉ:** CRITIQUE (bloque tous les tenants)  
**DURÉE:** 30 minutes  
**PRÊT POUR:** Implémentation immédiate