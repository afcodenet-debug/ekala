# Fix du Système d'Abonnement SaaS

## Problème Identifié

Le tenant #16 (MAKUTANO) avait un abonnement **ACTIF** dans SQLite mais le middleware d'abonnement cherchait les données dans **Supabase** au lieu de SQLite en mode développement.

### Erreurs dans la console navigateur
```
Failed to fetch products Error: SUBSCRIPTION_REQUIRED
Failed to fetch tables Error: SUBSCRIPTION_REQUIRED
Failed to fetch active orders Error: SUBSCRIPTION_REQUIRED
```

## Solution Appliquée

### 1. Diagnostic
- ✅ Tables `plans` et `tenant_subscriptions` existent déjà dans SQLite
- ✅ 6 plans disponibles (Essai Gratuit, Starter, Pro, etc.)
- ✅ Tenant #16 a un abonnement actif "Essai Gratuit" (trial_7d)

### 2. Modification du Middleware

**Fichier modifié:** `src/server/middleware/subscription-guard.ts`

**Changement:** Ajout d'une vérification SQLite **avant** la vérification Supabase

```typescript
// Try SQLite first (local dev mode)
try {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  
  const sub = db.prepare(`
    SELECT ts.*, p.name as plan_name, p.code as plan_code
    FROM tenant_subscriptions ts
    LEFT JOIN plans p ON p.id = ts.plan_id
    WHERE ts.tenant_id = ?
    ORDER BY ts.created_at DESC
    LIMIT 1
  `).get(tenantId);
  
  if (sub && sub.status === 'active') {
    // Retourne un état 'active' pour ce tenant
    return { ...fallback, state: 'active', planName: sub.plan_name };
  }
} catch (err) {
  // SQLite not available, continue to Supabase
}
```

### 3. Recompilation
```bash
npm run build:server
npm run server:fast
```

## Test Manuel

### Étape 1: Vérifier que le serveur est accessible
```bash
curl http://localhost:3001/health
# Doit retourner: OK
```

### Étape 2: Se connecter via l'interface
1. Ouvrir http://localhost:5173/pos
2. Se connecter avec:
   - Email: `admin@ekala.africa`
   - Mot de passe: `admin123`

### Étape 3: Vérifier les fonctionnalités
- ✅ Page Products doit charger sans erreur
- ✅ Page Categories doit charger sans erreur
- ✅ Page Tables doit charger sans erreur
- ✅ Dashboard doit afficher les statistiques
- ✅ Commandes actives doivent s'afficher

## Scripts de Diagnostic Créés

1. **`scripts/fix_subscription_system.js`** - Vérifie et corrige les abonnements
2. **`scripts/test_with_auth.js`** - Test automatisé avec authentification
3. **`scripts/diagnose_product_sync.js`** - Diagnostic de la sync des produits

## Architecture du Système d'Abonnement

```
Requête entrante
    ↓
Middleware JWT Auth (vérifie le token)
    ↓
Middleware Subscription Guard (NOUVEAU: vérifie SQLite d'abord)
    ↓
    ├─ SQLite (local dev)
    │   └─ tenant_subscriptions + plans
    ↓
    └─ Supabase (production)
        └─ subscriptions + plans
    ↓
Route handler
```

## États d'Abonnement

| État | Accès | Description |
|------|-------|-------------|
| `active` | ✅ Complet | Abonnement payant actif |
| `trial` | ✅ Complet | Période d'essai (7 jours) |
| `grace` | ⚠️ Lecture seule | 7 jours après expiration |
| `expired` | ❌ Bloqué | Abonnement expiré |
| `suspended` | ❌ Bloqué | Suspendu pour non-paiement |
| `cancelled` | ❌ Bloqué | Annulé par l'utilisateur |
| `no_plan` | ❌ Bloqué | Aucun abonnement |
| `pending` | ❌ Bloqué | En attente d'activation voucher |

## Vérification SQLite

```bash
# Voir l'abonnement du tenant #16
sqlite3 data/database.db "SELECT ts.*, p.name, p.code 
  FROM tenant_subscriptions ts 
  LEFT JOIN plans p ON p.id = ts.plan_id 
  WHERE ts.tenant_id = 16;"

# Voir tous les plans
sqlite3 data/database.db "SELECT * FROM plans;"
```

## Prochaines Étapes

1. **Tester manuellement** l'interface POS
2. **Vérifier** qu'aucune erreur SUBSCRIPTION_REQUIRED n'apparaît
3. **Ajouter un nouveau produit** pour tester la sync
4. **Vérifier** que le produit apparaît dans Supabase

## En Cas de Problème

### Cache du middleware
```bash
# Le cache est en mémoire (5 min TTL)
# Redémarrer le serveur pour vider le cache
npm run server:fast
```

### Vérifier les logs
```bash
tail -f /tmp/server.log | grep -E "SubGuard|SUBSCRIPTION"
```

### Forcer la re-vérification
```bash
node scripts/fix_subscription_system.js
```

## Résultat Attendu

Après le fix, le tenant #16 devrait avoir:
- ✅ Accès complet à toutes les fonctionnalités
- ✅ Pas d'erreur SUBSCRIPTION_REQUIRED
- ✅ Synchronisation des produits vers Supabase fonctionnelle
- ✅ Plan: Essai Gratuit (trial_7d)
- ✅ Statut: active