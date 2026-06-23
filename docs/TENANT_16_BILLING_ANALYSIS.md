# Analyse du Tenant #16 — Page /billing

**Date:** 2026-06-23  
**Tenant ID:** 16  
**Page analysée:** http://localhost:5173/billing  

---

## Résumé Exécutif

Le tenant #16 voit le message **"Compte suspendu"** sur la page `/billing`. Cette analyse détermine si c'est correct et si le compte bénéficie d'une période de grâce.

---

## Architecture de la Page /billing

### Fichier: `src/pages/saas/BillingPageV2.tsx`

**Flux de détermination du statut:**

```
1. Chargement des données
   └── GET /api/tenants/16 (avec JWT auth + isolation)
       └── Retourne: tenant + subscriptions + payments

2. Analyse du statut (lignes 520-547)
   ├── subscription.status === 'active' → ACTIVE
   ├── subscription.status === 'trialing' || 'trial' → TRIAL
   ├── subscription.status === 'past_due'
   │   └── Vérification période de grâce (7 jours)
   │       ├── now < graceEnd → GRACE_PERIOD
   │       └── now >= graceEnd → SUSPENDED
   ├── tenant.status === 'suspended' → SUSPENDED
   ├── subscription.status === 'cancelled' → SUSPENDED
   └── Autre → SUSPENDED (par défaut)
```

---

## États Possibles

### 1. ACTIVE
**Condition:** `subscription.status === 'active'`  
**Affichage:** Plan actif avec quotas  
**Accès:** Complet

### 2. TRIAL
**Condition:** `subscription.status === 'trialing' || 'trial'`  
**Affichage:** Période d'essai avec jours restants  
**Accès:** Complet (essai gratuit)

### 3. GRACE_PERIOD
**Condition:** `subscription.status === 'past_due'` ET `now < graceEnd`  
**Calcul:** `graceEnd = current_period_end + 7 jours`  
**Affichage:** Accès lecture seule, jours restants  
**Accès:** Lecture seule

### 4. SUSPENDED
**Condition:** Tous les autres cas  
**Affichage:** "Compte suspendu" + sélection de forfait  
**Accès:** Aucun (bloqué)

---

## Diagnostic pour le Tenant #16

### Question 1: Le compte est-il suspendu ?

**Réponse:** OUI, si et seulement si:

```typescript
// Cas 1: Pas d'abonnement
subscription === undefined || subscription === null

// Cas 2: Abonnement avec statut non-actif
subscription.status !== 'active'
subscription.status !== 'trialing'
subscription.status !== 'trial'

// Cas 3: past_due hors période de grâce
subscription.status === 'past_due'
ET (current_period_end + 7 jours) < now

// Cas 4: Statut explicite
tenant.status === 'suspended'
subscription.status === 'suspended'
subscription.status === 'cancelled'
```

### Question 2: Bénéficie-t-il d'une période de grâce ?

**Réponse:** OUI, si et seulement si:

```typescript
subscription.status === 'past_due'
ET current_period_end existe
ET (current_period_end + 7 jours) > now

// Exemple concret:
current_period_end = 2026-06-20
now = 2026-06-23
graceEnd = 2026-06-27
now < graceEnd → GRACE_PERIOD ✅
```

---

## Vérification des Données

### Requête SQL pour vérifier le tenant #16

```sql
-- 1. Vérifier le tenant
SELECT id, name, status, created_at, updated_at
FROM tenants
WHERE id = 16;

-- 2. Vérifier les abonnements
SELECT 
  id, 
  tenant_id, 
  plan_id, 
  status, 
  current_period_start,
  current_period_end,
  created_at
FROM subscriptions
WHERE tenant_id = 16
ORDER BY current_period_start DESC
LIMIT 5;

-- 3. Vérifier les paiements
SELECT 
  id,
  tenant_id,
  amount_cents,
  status,
  payment_method,
  created_at
FROM payments
WHERE tenant_id = 16
ORDER BY created_at DESC
LIMIT 10;

-- 4. Calculer la période de grâce
SELECT 
  id,
  status,
  current_period_end,
  -- Date de fin de période de grâce (+7 jours)
  datetime(current_period_end, '+7 days') as grace_period_end,
  -- Date actuelle
  datetime('now') as now,
  -- Comparaison
  CASE 
    WHEN datetime('now') < datetime(current_period_end, '+7 days') 
    THEN 'GRACE_PERIOD'
    ELSE 'SUSPENDED'
  END as effective_status
FROM subscriptions
WHERE tenant_id = 16
  AND status = 'past_due';
```

---

## Logique de Période de Grâce

### Implémentation dans BillingPageV2.tsx (lignes 530-540)

```typescript
} else if (subscription?.status === 'past_due') {
  // Check if still in grace period (7 days after expiration)
  const now = new Date();
  const periodEnd = subscription.current_period_end 
    ? new Date(subscription.current_period_end) 
    : null;
  const graceEnd = periodEnd 
    ? new Date(periodEnd.getTime() + 7 * 24 * 60 * 60 * 1000) 
    : null;
  
  if (graceEnd && now < graceEnd) {
    setBillingState('GRACE_PERIOD');  // ✅ Accès lecture seule
  } else {
    setBillingState('SUSPENDED');     // ❌ Compte bloqué
  }
}
```

### Calcul de la période de grâce

```
current_period_end = Date de fin de l'abonnement
graceEnd = current_period_end + 7 jours

Si now < graceEnd:
  → GRACE_PERIOD (accès lecture seule)
  
Si now >= graceEnd:
  → SUSPENDED (compte bloqué)
```

---

## Scénarios Possibles pour le Tenant #16

### Scénario 1: Aucun abonnement
**Cause:** `subscriptions` vide pour tenant_id = 16  
**Résultat:** `SUSPENDED`  
**Correct:** OUI, il faut souscrire à un forfait

### Scénario 2: Abonnement 'active'
**Cause:** `subscription.status = 'active'`  
**Résultat:** `ACTIVE`  
**Message affiché:** "Forfait actif"  
**Correct:** OUI

### Scénario 3: Abonnement 'trialing'
**Cause:** `subscription.status = 'trialing'`  
**Résultat:** `TRIAL`  
**Message affiché:** "Période d'essai" + jours restants  
**Correct:** OUI

### Scénario 4: Abonnement 'past_due' dans la période de grâce
**Cause:** `subscription.status = 'past_due'` ET `now < graceEnd`  
**Résultat:** `GRACE_PERIOD`  
**Message affiché:** "Période de grâce" + jours restants  
**Correct:** OUI, l'utilisateur devrait voir ce message

### Scénario 5: Abonnement 'past_due' hors période de grâce
**Cause:** `subscription.status = 'past_due'` ET `now >= graceEnd`  
**Résultat:** `SUSPENDED`  
**Message affiché:** "Compte suspendu"  
**Correct:** OUI, la période de grâce est terminée

### Scénario 6: Abonnement 'suspended' ou 'cancelled'
**Cause:** `subscription.status = 'suspended'` ou `'cancelled'`  
**Résultat:** `SUSPENDED`  
**Message affiché:** "Compte suspendu"  
**Correct:** OUI

---

## Actions Requises

### Pour déterminer la cause exacte:

1. **Exécuter les requêtes SQL ci-dessus** sur la base de données
2. **Vérifier les valeurs de `subscription.status` et `current_period_end`**
3. **Calculer si la période de grâce est active**

### Si le compte est SUSPENDU à tort:

1. Vérifier la synchronisation des données (Supabase ↔ SQLite)
2. Vérifier le cron d'expiration (`src/server/saas/cron/expiration.cron.ts`)
3. Vérifier le middleware `subscription-guard.ts`

### Si le compte est SUSPENDU à raison:

1. L'utilisateur doit choisir un forfait
2. Générer un voucher de paiement
3. Effectuer le paiement
4. Attendre la validation admin

---

## Sécurité

### Isolation par tenant (CORRIGÉ)

```typescript
// src/server/saas/saas.routes.ts (ligne 140-143)
const requestingTenantId = (req as any).user?.tenant_id;
if (requestingTenantId !== id) {
  return res.status(403).json({ 
    error: 'FORBIDDEN', 
    message: 'Accès non autorisé à ce tenant' 
  });
}
```

**Garantie:** Le tenant #16 ne peut voir QUE ses propres données.

---

## Conclusion

Le message "Compte suspendu" est **correct** si et seulement si:

- ❌ Pas d'abonnement actif
- ❌ Abonnement expiré hors période de grâce
- ❌ Abonnement suspendu/annulé

Le message est **incorrect** si:

- ✅ Abonnement 'active' → devrait afficher "Forfait actif"
- ✅ Abonnement 'trialing' → devrait afficher "Période d'essai"
- ✅ Abonnement 'past_due' dans les 7 jours → devrait afficher "Période de grâce"

**Pour déterminer la cause exacte, exécuter les requêtes SQL ci-dessus.**