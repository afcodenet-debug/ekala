# DIAGNOSTIC : Les commandes cloud n'apparaissent pas en local

**Date :** 11 Juillet 2026  
**Problème :** Les commandes passées dans le POS cloud n'apparaissent pas dans le POS local (Electron)

---

## 1. ANALYSE DU PROBLÈME

### 1.1 Le curseur est trop avancé

Le PullSyncWorker utilise un curseur `last_supabase_pull` stocké dans `sync_metadata`. 
Ce curseur est mis à jour avec `MAX(orders.updated_at)` après chaque cycle.

**Problème :** Si le curseur est à `T`, le prochain cycle ne tire que les commandes avec `updated_at >= T`. 
Si une commande cloud a `updated_at < T` (même 1ms avant), elle n'est JAMAIS tirée.

### 1.2 Scénario de la rupture

```
T=10:00:00.000 : Cycle 1 tire les commandes, curseur = 10:00:00.000
T=10:00:00.500 : Commande cloud créée avec updated_at = 10:00:00.500
T=10:00:08.000 : Cycle 2, since = 10:00:00.000, updated_at >= 10:00:00.000 → OK
```

Mais si :
```
T=10:00:00.000 : Cycle 1 tire les commandes, curseur = 10:00:00.000
T=10:00:00.000 : Commande cloud créée avec updated_at = 10:00:00.000 (même timestamp)
T=10:00:08.000 : Cycle 2, since = 10:00:00.000, updated_at >= 10:00:00.000 → OK (gte inclus)
```

Le problème réel est que le `storedCursor` est mis à `MAX(updated_at)` APRÈS le pull. 
Si le pull tire 50 commandes, la dernière a `updated_at = T`. Le curseur devient T.
Au prochain pull, `since = T`. Les commandes avec `updated_at = T` sont re-tirées (UPDATE).
Les commandes avec `updated_at > T` sont tirées (INSERT).

**Ça devrait fonctionner.** Mais il y a un edge case : si la commande cloud a `updated_at` NULL ou invalide.

### 1.3 Cause racine identifiée

Le problème est que le `storedCursor` est initialisé à `new Date().toISOString()` quand `MAX(updated_at)` est NULL (première exécution). Ce qui signifie que les commandes créées AVANT le premier démarrage ne sont jamais tirées (sauf pendant le bootstrap de 60 minutes).

Mais le vrai problème est que le `storedCursor` est mis à jour avec `MAX(updated_at)` des commandes qui ont `remote_id IS NOT NULL`. Si une commande cloud a `updated_at` dans le futur (décalage horaire), le curseur devient ce timestamp futur, et toutes les commandes suivantes sont ignorées.

---

## 2. SOLUTION

### 2.1 Ajouter un décalage de sécurité au curseur

```typescript
// Au lieu de :
const nextCursor = row?.max_ts || new Date().toISOString();

// Faire :
const nextCursor = row?.max_ts 
  ? new Date(new Date(row.max_ts).getTime() - 1000).toISOString()  // -1 seconde
  : new Date(Date.now() - 60000).toISOString();  // -1 minute au premier démarrage
```

### 2.2 Logger le curseur à chaque cycle

```typescript
console.log(`[PullSync] Cursor: ${storedCursor} → ${nextCursor} (${ordersPulled} orders pulled)`);
```

### 2.3 Ajouter un diagnostic endpoint

```typescript
// GET /api/sync/pull-status
// Retourne l'état du PullSyncWorker + le curseur actuel
```

---

## 3. FICHIER À MODIFIER

| Fichier | Modification |
|---------|-------------|
| `src/server/services/supabase-pull-sync.service.ts` | Ajouter décalage de sécurité au curseur + logs |