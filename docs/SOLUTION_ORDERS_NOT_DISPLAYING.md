# SOLUTION : Commandes locales qui ne s'affichent pas dans /orders et /sales

**Date :** 11 Juillet 2026  
**Problème :** Les commandes créées en mode local n'apparaissent pas dans `http://localhost:5173/orders` ni dans `http://localhost:5173/sales`

---

## 1. CAUSE RACINE IDENTIFIÉE

### 1.1 Flux de synchronisation bloqué

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUX NORMAL (AVANT FIX)                      │
└─────────────────────────────────────────────────────────────────┘

1. Commande créée en mode local (SQLite)
   └── INSERT INTO orders (source='local', remote_id=NULL)
   
2. Tentative de push vers Supabase
   └── ❌ BLOQUÉ : ENABLE_SUPABASE_SYNC n'est pas activé
   
3. Pull sync (Supabase → SQLite)
   └── ❌ NE PEUT PAS RÉCUPÉRER : commande n'existe pas dans Supabase
   
4. Affichage dans /orders et /sales
   └── ❌ COMMANDE INVISIBLE


┌─────────────────────────────────────────────────────────────────┐
│              FLUX CORRIGÉ (APRÈS FIX)                           │
└─────────────────────────────────────────────────────────────────┘

1. Commande créée en mode local (SQLite)
   └── INSERT INTO orders (source='local', remote_id=NULL)
   
2. Push vers Supabase
   └── ✅ ACTIVÉ : ENABLE_SUPABASE_SYNC=true
   └── ✅ Commande créée dans Supabase avec remote_id
   
3. Pull sync (Supabase → SQLite)
   └── ✅ Récupère la commande depuis Supabase
   └── ✅ Met à jour la SQLite locale avec remote_id
   
4. Affichage dans /orders et /sales
   └── ✅ COMMANDE VISIBLE
```

### 1.2 Problèmes identifiés

#### Problème #1 : Synchronisation désactivée
- **Fichier :** `src/server/server.ts` (ligne 599-602)
- **Cause :** `ENABLE_SUPABASE_SYNC` n'était pas défini sur `'true'`
- **Impact :** Les commandes locales ne sont jamais poussées vers Supabase

#### Problème #2 : Curseur de synchronisation trop agressif
- **Fichier :** `src/server/services/supabase-pull-sync.service.ts` (ligne 174-178)
- **Cause :** Le curseur était mis à jour avec un décalage de seulement 2 secondes
- **Impact :** Risque de manquer des commandes créées avec le même timestamp

---

## 2. CORRECTIONS APPLIQUÉES

### 2.1 Correction du curseur de synchronisation

**Fichier modifié :** `src/server/services/supabase-pull-sync.service.ts`

**Changements :**
```typescript
// AVANT (ligne 175-177)
const nextCursor = orderRow?.max_ts 
  ? new Date(new Date(orderRow.max_ts).getTime() - 2000).toISOString()  // -2 secondes
  : new Date(Date.now() - 120000).toISOString();  // -2 minutes

// APRÈS (ligne 175-177)
const nextCursor = orderRow?.max_ts 
  ? new Date(new Date(orderRow.max_ts).getTime() - 5000).toISOString()  // -5 secondes
  : new Date(Date.now() - 300000).toISOString();  // -5 minutes
```

**Raison :** 
- Augmenter le décalage de 2s à 5s pour éviter les problèmes de timing
- Augmenter le lookback initial de 2min à 5min pour être plus sûr au premier démarrage

### 2.2 Amélioration des logs

**Fichier modifié :** `src/server/services/supabase-pull-sync.service.ts`

**Changements :**
```typescript
// AVANT (ligne 192)
console.log(`[PullSync] Cycle: cursor=${nextCursor.substring(0,19)} orders=${totalOrders} products=${lastPullStatus.productsPulled} emptyCycles=${consecutiveEmptyCycles}`);

// APRÈS (ligne 192)
console.log(`[PullSync] Cycle: cursor=${nextCursor.substring(0,19)} orders=${totalOrders} (inserted=${lastPullStatus.ordersInserted}, updated=${lastPullStatus.ordersUpdated}) products=${lastPullStatus.productsPulled} emptyCycles=${consecutiveEmptyCycles}`);
```

**Raison :** Ajouter des détails sur les insertions vs mises à jour pour mieux diagnostiquer les problèmes

### 2.3 Script de récupération des commandes manquantes

**Nouveau fichier :** `scripts/fix_missing_orders_sync.js`

**Usage :**
```bash
# Synchroniser toutes les commandes locales manquantes
node scripts/fix_missing_orders_sync.js

# Synchroniser pour un tenant spécifique
node scripts/fix_missing_orders_sync.js 123

# Mode automatique (sans confirmation)
YES=true node scripts/fix_missing_orders_sync.js
```

**Fonctionnalités :**
- Recherche toutes les commandes avec `source='local'` et `remote_id IS NULL`
- Les pousse vers Supabase
- Met à jour les `remote_id` locaux
- Synchronise les `order_items` associés
- Affiche un résumé détaillé

---

## 3. PROCÉDURE DE RÉCUPÉRATION

### Étape 1 : Vérifier les variables d'environnement

Ajoutez dans votre fichier `.env` :

```bash
# Synchronisation bidirectionnelle
ENABLE_SUPABASE_SYNC=true
ENABLE_SUPABASE_PULL=true

# Credentials Supabase (déjà présents)
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre-clé-service-role
```

### Étape 2 : Redémarrer le serveur

```bash
# Arrêter le serveur (Ctrl+C)
# Puis redémarrer
npm run dev
# ou
yarn dev
```

Vérifiez les logs au démarrage :
```
[SyncV2] Engine initialized (ALL 26 tables covered)
[Supabase] ✅ PullSyncWorker started (Supabase → SQLite order pull active)
```

### Étape 3 : Synchroniser les 3 commandes manquantes

```bash
node scripts/fix_missing_orders_sync.js
```

**Sortie attendue :**
```
🔍 Recherche des commandes locales non synchronisées...

📊 Trouvé 3 commande(s) locale(s) à synchroniser

📋 Commandes à synchroniser:
   - Order #1 | Table 5 | paid | 45.50€ | 2026-07-11T10:30:00.000Z
   - Order #2 | Table 3 | preparing | 23.00€ | 2026-07-11T11:15:00.000Z
   - Order #3 | N/A | pending | 12.50€ | 2026-07-11T12:00:00.000Z

⚠️  Voulez-vous synchroniser ces commandes vers Supabase? (oui/non): oui

🔄 Synchronisation commande #1...
   ✅ Insérée dans Supabase avec ID 101
   ✅ 2 item(s) inséré(s)
   ✅ Commande #1 synchronisée avec succès

🔄 Synchronisation commande #2...
   ✅ Insérée dans Supabase avec ID 102
   ✅ 1 item(s) inséré(s)
   ✅ Commande #2 synchronisée avec succès

🔄 Synchronisation commande #3...
   ✅ Insérée dans Supabase avec ID 103
   ✅ 3 item(s) inséré(s)
   ✅ Commande #3 synchronisée avec succès

═══════════════════════════════════════════════════════════════
📊 RÉSUMÉ DE LA SYNCHRONISATION
═══════════════════════════════════════════════════════════════
   Total commandes: 3
   ✅ Succès: 3
   ❌ Erreurs: 0
═══════════════════════════════════════════════════════════════

🎉 Les commandes sont maintenant disponibles dans Supabase!
   Le pull sync va les récupérer automatiquement dans quelques secondes.
   Vous pouvez rafraîchir http://localhost:5173/orders et http://localhost:5173/sales
```

### Étape 4 : Vérifier la synchronisation

Attendez 10-15 secondes que le pull sync se déclenche, puis vérifiez :

```bash
# Vérifier le statut du sync
curl http://localhost:3001/api/sync/status
```

Vous devriez voir :
```json
{
  "worker": { "running": true, "enabled": true },
  "counters": {
    "ordersPulled": 3,
    "ordersInserted": 3,
    "ordersUpdated": 0
  }
}
```

### Étape 5 : Vérifier l'affichage

Rafraîchissez les pages :
- `http://localhost:5173/orders` - Les 3 commandes doivent apparaître
- `http://localhost:5173/sales` - Les commandes payées doivent apparaître

---

## 4. PRÉVENTION FUTURE

### 4.1 Synchronisation automatique

Avec `ENABLE_SUPABASE_SYNC=true`, toutes les nouvelles commandes locales seront automatiquement :
1. Créées en SQLite
2. Poussées vers Supabase via le sync engine
3. Disponibles immédiatement en local et en cloud

### 4.2 Monitoring

Vérifiez régulièrement le statut du sync :

```bash
# Endpoint de diagnostic
GET http://localhost:3001/api/sync/status

# Logs serveur - cherchez
[PullSync] Cycle: cursor=... orders=X (inserted=Y, updated=Z)
```

### 4.3 Alertes

Si vous voyez `emptyCycles` augmenter dans les logs, cela signifie que le pull sync ne trouve pas de nouvelles commandes. Cela peut indiquer :
- Un problème de réseau
- Des commandes qui ne sont pas poussées vers Supabase
- Un curseur mal positionné

---

## 5. FICHIERS MODIFIÉS

| Fichier | Modification | Ligne |
|---------|-------------|-------|
| `src/server/services/supabase-pull-sync.service.ts` | Augmenté le décalage du curseur de 2s à 5s | 175-177 |
| `src/server/services/supabase-pull-sync.service.ts` | Augmenté le lookback initial de 2min à 5min | 175-177 |
| `src/server/services/supabase-pull-sync.service.ts` | Ajouté logs détaillés (inserted/updated) | 192 |
| `scripts/fix_missing_orders_sync.js` | **NOUVEAU** - Script de récupération | - |

---

## 6. VÉRIFICATION FINALE

### Checklist de vérification

- [ ] Variables d'environnement ajoutées dans `.env`
- [ ] Serveur redémarré
- [ ] Logs montrent `[SyncV2] Engine initialized`
- [ ] Logs montrent `[Supabase] ✅ PullSyncWorker started`
- [ ] Script `fix_missing_orders_sync.js` exécuté avec succès
- [ ] Les 3 commandes apparaissent dans `http://localhost:5173/orders`
- [ ] Les commandes payées apparaissent dans `http://localhost:5173/sales`
- [ ] Le statut sync montre `ordersPulled: 3, ordersInserted: 3`

### Test de non-régression

Créez une nouvelle commande en mode local et vérifiez :
1. Elle apparaît immédiatement dans `/orders`
2. Elle est poussée vers Supabase (vérifiez les logs)
3. Elle est récupérée par le pull sync
4. Elle reste visible après rafraîchissement

---

## 7. SUPPORT

Si le problème persiste :

1. **Vérifiez les logs serveur** pour les erreurs de sync
2. **Vérifiez le statut sync** : `curl http://localhost:3001/api/sync/status`
3. **Vérifiez Supabase** : Les commandes doivent apparaître dans la table `orders`
4. **Vérifiez la SQLite** : `SELECT * FROM orders WHERE remote_id IS NULL` doit retourner 0 ligne

Pour plus de détails, consultez :
- `docs/DIAGNOSTIC_ORDERS_NOT_SYNCING.md` - Diagnostic initial
- `docs/DIAGNOSTIC_PUSH_BROKEN.md` - Problèmes de push
- `docs/BIDIRECTIONAL_SYNC_COMPLETE.md` - Architecture de sync