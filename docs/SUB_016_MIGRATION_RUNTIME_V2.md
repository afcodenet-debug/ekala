# Story SUB-016 : Migration Runtime V2.1 — Brancher ApplicationService

**ID :** SUB-016  
**Titre :** Brancher SubscriptionApplicationService dans les routes HTTP  
**Priorité :** P0  
**Estimation :** M (1 jour)  

**Phase :** Migration Runtime V2.1 — Phase 1

---

## Pourquoi cette Story existe

- Architecture V2.1 : les composants existent mais ne sont pas connectés au runtime
- Les routes HTTP utilisent encore la logique legacy directe
- SUB-001 à SUB-015 ont créé les abstractions, maintenant il faut les utiliser

**Objectif** : Remplacer progressivement la logique legacy par l'architecture V2.1.

---

## Règles strictes

1. ✅ Aucun nouveau pattern architectural
2. ✅ Aucune nouvelle abstraction
3. ✅ Pas de modification du design DDD existant
4. ✅ Connecter uniquement les composants EXISTANTS
5. ✅ Chaque changement vérifiable via flux HTTP réel
6. ✅ Legacy reste fonctionnel jusqu'à remplacement complet

---

## Dépendances

- SUB-001 à SUB-015 : Composants V2.1 créés
- SubscriptionApplicationService : Existe mais jamais importé
- admin.subscriptions.ts : Routes HTTP fonctionnelles

---

## Fichiers concernés

**Modifié** :
- `src/server/routes/admin.subscriptions.ts`

**Non modifié** :
- Tous les composants V2.1 existants (SubscriptionApplicationService, etc.)

---

## Modifications attendues

### Étape 1 : Importer SubscriptionApplicationService

**Ligne 1-17** : Ajouter l'import

```typescript
import { SubscriptionApplicationService } from '../application/subscription/SubscriptionApplicationService';
```

### Étape 2 : Instancier le service (singleton)

**Ligne 18-24** : Après les imports, créer l'instance

```typescript
// SubscriptionApplicationService — V2.1
const subscriptionAppService = new SubscriptionApplicationService();
```

### Étape 3 : Brancher dans POST /verify (ligne 207-239)

**Remplacer** la logique legacy dans `activateTenantSub` par un appel à ApplicationService.

**Approche** : Wrapper progressif. L'ApplicationService va progressivement remplacer la logique dans `activateTenantSub`.

**Modification** :

1. Dans `activateTenantSub`, ajouter un paramètre `useV2Logic: boolean = false`
2. Si `useV2Logic = true` : utiliser SubscriptionApplicationService
3. Si `useV2Logic = false` : garder l'ancien comportement

**Code** :

```typescript
async function activateTenantSub(
  tenantId: number, 
  planId: number, 
  _adminUserId: number | null, 
  nowISO: string,
  useV2Logic: boolean = false  // NOUVEAU PARAMÈTRE
): Promise<void> {
  const supabase = getSupabase();
  const localDb = db;
  
  if (useV2Logic && subscriptionAppService) {
    // NOUVEAU : Utiliser l'ApplicationService V2.1
    await subscriptionAppService.activateSubscription({
      tenantId,
      planId,
      activatedAt: nowISO,
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  } else if (localDb) {
    // ANCIEN : Logique legacy (conservée)
    withOutboxTransaction(localDb, String(tenantId), () => {
      // ... code existant ...
    });
  } else if (supabase) {
    // ... code existant ...
  }
  getSubscriptionStatus(tenantId);
}
```

### Étape 4 : Activer V2.1 dans POST /verify

**Ligne 232** : Modifier l'appel à `activateTenantSub`

```typescript
// AVANT
await activateTenantSub(requestRow.tenant_id, requestRow.plan_id, adminUserId, nowISO);

// APRÈS
await activateTenantSub(requestRow.tenant_id, requestRow.plan_id, adminUserId, nowISO, true); // true = V2.1
```

### Étape 5 : Même chose pour POST /reject

**Ligne 434-480** : Ajouter le même paramètre `useV2Logic`

```typescript
// Dans la route /reject, modifier l'appel à activateTenantSub si nécessaire
// Pour l'instant, garder false pour reject (pas d'activation)
```

---

## Tests à écrire

### Test 1 : Vérifier que SubscriptionApplicationService est instancié

```typescript
// Test manuel
console.log('SubscriptionApplicationService instance:', subscriptionAppService);
// Doit afficher l'instance, pas undefined
```

### Test 2 : Vérifier que POST /verify fonctionne avec V2.1

```bash
# 1. Démarrer le serveur
npm run server:fast

# 2. Créer une demande de voucher (status = pending)

# 3. POST /api/admin/vouchers/verify avec requestId
# Vérifier :
# - Status 200
# - Message "Demande vérifiée. Abonnement activé."
# - Tenant status = 'active' dans DB
# - Cache invalidé (vérifier via GET /auth/me)
```

### Test 3 : Vérifier que le legacy fonctionne toujours

```bash
# Même test mais avec useV2Logic = false
# Doit fonctionner identiquement
```

---

## Critères de validation (DoD)

- [ ] SubscriptionApplicationService importé dans admin.subscriptions.ts
- [ ] Instance créée (singleton)
- [ ] `activateTenantSub` accepte le paramètre `useV2Logic`
- [ ] POST /verify utilise `useV2Logic = true`
- [ ] POST /verify fonctionne (test HTTP réel)
- [ ] Legacy reste fonctionnel (test avec `useV2Logic = false`)
- [ ] Aucune régression sur les autres routes
- [ ] Cache invalidation fonctionne (SUB-001)

---

## Risques connus

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| ApplicationService ne gère pas tous les cas | Moyenne | Élevé | Tester tous les chemins (SQLite + Supabase) |
| Performance dégradée | Faible | Moyen | Mesurer latence avant/après |
| Regression sur verify | Faible | Élevé | Tests exhaustifs + rollback (useV2Logic = false) |

---

## Rollback

**En cas de problème** :

1. Changer `useV2Logic = true` → `useV2Logic = false` dans POST /verify
2. Le legacy reprend immédiatement
3. Aucune modification de schéma DB nécessaire

---

## Prochaines étapes après SUB-016

- **SUB-017** : Brancher ApplicationService dans POST /reject
- **SUB-018** : Remplacer complètement `activateTenantSub` par V2.1
- **SUB-019** : Supprimer la logique legacy de `activateTenantSub`

---

**Status** : À implémenter  
**Dernière mise à jour** : 27 Juin 2026