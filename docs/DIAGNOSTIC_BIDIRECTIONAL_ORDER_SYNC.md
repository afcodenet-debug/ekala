# DIAGNOSTIC : Synchronisation Bidirectionnelle des Commandes (Cloud ↔ Local)

**Date :** 11 Juillet 2026  
**Problème signalé :** Les commandes passées depuis le POS cloud n'apparaissent pas dans le mode local (Electron)

---

## 1. VUE D'ENSEMBLE DU FLUX DE DONNÉES

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MODE CLOUD (Web)                              │
│                                                                      │
│  POS Cloud ──créer commande──► Supabase (orders)                     │
│                                      │                               │
│                    ┌─────────────────┼─────────────────┐             │
│                    ▼                 ▼                  ▼            │
│              mirrorRemote        Pull Worker      GenericSync       │
│              OrderToLocal        (désactivé)      Pull (?)          │
│                    │                 │                  │            │
│                    ▼                 ▼                  ▼            │
│               SQLite local      NON ACTIF         DÉSACTIVÉ         │
│               (si même hôte)                                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        MODE LOCAL (Electron)                         │
│                                                                      │
│  POS Local ──créer commande──► SQLite (orders)                        │
│                                      │                               │
│                              Outbox → Supabase                       │
│                              (push activé)                            │
└─────────────────────────────────────────────────────────────────────┘
```

**Le problème est asymétrique :**
- ✅ **Local → Cloud** : Push fonctionne (via outbox → GenericSyncService.pushByEntity)
- ❌ **Cloud → Local** : Pull ne fonctionne PAS (3 mécanismes de pull tous défaillants)

---

## 2. ANALYSE DES 3 CHEMINS DE PULL (Supabase → SQLite)

### 2.1 Chemin #1 : mirrorRemoteOrderToLocal (Push immédiat)

**Fichier :** `src/server/services/order.service.ts` (lignes 476-483)

```typescript
// Mode cloud: après création dans Supabase, tentative de miroir vers SQLite
try {
  const mirrorRes = await mirrorRemoteOrderToLocal(tenantId, data, normalizedItems);
  if (!mirrorRes.applied) {
    console.log(`[OrderService] Order saved to Supabase only (local SQLite mirror skipped — 
      no local DB in this environment). The local app (mode LOCAL) will pull it via sync.`);
  }
} catch (mirrorErr: any) {
  console.warn('[OrderService] Cloud→SQLite mirror failed (non-critical):', mirrorErr?.message);
}
```

**Diagnostic :**
| Aspect | Analyse |
|--------|---------|
| ✅ Fonctionne si... | Le POS cloud et le POS local partagent la MÊME instance SQLite (même machine) |
| ❌ Échoue si... | Le POS cloud tourne sur Render (web) et le POS local sur Electron (poste différent) |
| ❌ Try/catch silencieux | L'échec est loggé comme "non-critical" — aucune alerte à l'utilisateur |
| **VERDICT** | ❌ **INOPÉRANT pour le cas d'usage multi-postes** |

### 2.2 Chemin #2 : SupabasePullSyncService (Worker QR dédié)

**Fichier :** `src/server/services/supabase-pull-sync.service.ts` (lignes 54-75)

```typescript
function getPullConfig(): PullConfig {
  // ...
  if (dataSource.isCloud()) enabled = false;   // ← Mode cloud : désactivé
  if (!dbAvailable) enabled = false;            // ← Pas de SQLite : désactivé
  if (dataSource.isLocal()) enabled = false;    // ← Mode local : DÉSACTIVÉ
  // ...
}
```

**Diagnostic :**
| État | Raison |
|------|--------|
| `dataSource.isCloud() === true` → désactivé | Considère qu'en mode cloud, Supabase EST la source de vérité |
| `dataSource.isLocal() === true` → désactivé | Ne devrait PAS être désactivé ! C'est EXACTEMENT pour ça que ce worker existe |
| **VERDICT** | ❌ **BLOQUÉ par sa propre configuration** — désactivé dans TOUS les modes |

### 2.3 Chemin #3 : GenericSyncService.pullByEntity (Pull périodique)

**Fichier :** `src/sync/core/generic-sync.service.ts` (lignes 908-1064)

```typescript
async pullByEntity(entity: string, tenantId: string): Promise<number> {
  // ... utilise un curseur persistant et tire depuis updated_at
  const since = this.cursor.getOrEpoch(cursorKey);
  let query = this.supabase.from(remoteTable).select('*').eq('tenant_id', tenantIdForQuery);
  if (hasUpdatedAt) query = query.gt('updated_at', since).order('updated_at', { ascending: true });
  // ...
}
```

**Diagnostic :**
| Problème | Détail |
|----------|--------|
| ⚠️ Pull dépend du scheduler | `SyncOrchestratorV2.startScheduler()` doit être appelé explicitement |
| ⚠️ Curseur persistant | Si le curseur n'est pas initialisé correctement, les commandes récentes sont manquées |
| ⚠️ `fullSyncForTenant` pull les commandes | Mais pas de garantie que ce cycle s'exécute en mode local |
| **VERDICT** | ⚠️ **Dépend de l'initialisation — pas fiable sans scheduler actif** |

---

## 3. DIAGNOSTIC DÉTAILLÉ DE LA RUPTURE

### 3.1 Arbre des causes racines

```
ROOT CAUSE : Aucun mécanisme de pull fiable Supabase → SQLite
│
├── Cause #1 (Critique) : SupabasePullSyncWorker désactivé en mode local
│   └── Fichier : supabase-pull-sync.service.ts ligne 68
│   └── Condition : dataSource.isLocal() → enabled = false
│   └── Impact : Le worker dédié au pull des commandes NE TOURNE PAS
│
├── Cause #2 (Critique) : mirrorRemoteOrderToLocal dépend du même host
│   └── Fichier : order.service.ts ligne 476
│   └── Condition : try/catch silencieux — échec = simple log
│   └── Impact : Si Render cloud ≠ Electron local, le miroir est vide
│
├── Cause #3 (Élevée) : GenericSync scheduler pas démarré en local
│   └── Condition : startScheduler() doit être appelé
│   └── Impact : Le pull périodique n'existe pas sans scheduler actif
│
└── Cause #4 (Moyenne) : Pas de mécanisme de notification en temps réel
    └── Condition : Aucun webhook ou subscription Realtime
    └── Impact : Les pulls sont polling-based, pas événementiels
```

### 3.2 Schéma du flux avec le problème

```
MODE CLOUD (Web/Render)
┌─────────────────────────────────┐
│         POS Cloud               │
│  OrderService.create()          │
│       │                        │
│       ▼                        │
│  Supabase.orders.insert()       │
│       │                        │
│       ├──► mirrorRemoteOrderToLocal()
│       │       └── ÉCHEC : pas de SQLite locale sur Render
│       │
│       └──► "The local app will pull it via sync"
└─────────────────────────────────┘

              ╔═══════════════╗
              ║    RUPTURE    ║
              ║   🔴 AUCUN    ║
              ║  MÉCANISME    ║
              ║  DE PULL !    ║
              ╚═══════════════╝

MODE LOCAL (Electron/Desktop)
┌─────────────────────────────────┐
│         POS Local               │
│  OrderService.getAll()          │
│       │                        │
│       ▼                        │
│  SQLite.orders.SELECT           │
│       │                        │
│       └── ❌ Commande absente  │
│           Pas de pull actif    │
└─────────────────────────────────┘
```

---

## 4. SOLUTIONS PROPOSÉES

### 4.1 Solution #1 : Activer le PullSync Worker en mode local (Recommandée - immédiate)

**Problème :** `supabase-pull-sync.service.ts` ligne 68 désactive le worker en mode local.

**Fix :** Modifier `getPullConfig()` pour permettre au worker de tourner en mode local :

```typescript
function getPullConfig(): PullConfig {
  // Activer si ENABLE_SUPABASE_PULL est explicitement 'true'
  let enabled = explicit === 'true' || explicit === '1';
  
  // Si Supabase est la source, le pull local→cloud n'a pas de sens
  if (dataSource.isCloud()) enabled = false;
  
  // Si le mode est LOCAL mais qu'on a explicitement demandé le pull → OK
  // Supprimer la ligne : if (dataSource.isLocal()) enabled = false;
  
  if (!dbAvailable) enabled = false;
  
  return { enabled, ... };
}
```

**Risque :** Faible. Le worker a déjà un intervalle configurable (8s par défaut) et ses propres gardes.

### 4.2 Solution #2 : Alternative au Pull Worker — Subscription Realtime Supabase (Moyen terme)

**Approche :** Utiliser les Realtime subscriptions de Supabase pour écouter les changements en temps réel.

```typescript
// Dans le service de sync côté local
const supabase = createClient(url, key);
const channel = supabase
  .channel('orders-changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
    (payload) => {
      // Nouvelle commande détectée → la matérialiser dans SQLite
      genericSync.mirrorRemoteRecordToLocal('order', tenantId, payload.new);
    }
  )
  .subscribe();
```

**Avantages :** Temps réel, pas de polling, pas de latence.
**Risque :** Nécessite Supabase Realtime activé (coût supplémentaire potentiel).

### 4.3 Solution #3 : Endpoint de Pull Forcé (Quick Win)

**Approche :** Ajouter un bouton/action "Synchroniser maintenant" dans le POS local qui force un pull immédiat.

```typescript
// Route existante ou nouvelle action
router.post('/sync/pull', async (req, res) => {
  const tenantId = getCurrentTenantId();
  const orchestrator = getOrchestratorV2();
  
  // Forcer le pull des commandes
  await orchestrator.getGenericSync().pullByEntity('order', String(tenantId));
  await orchestrator.getGenericSync().pullByEntity('order_item', String(tenantId));
  
  res.json({ success: true });
});
```

---

## 5. PLAN D'ACTION PRIORISÉ

| Priorité | Solution | Effort | Impact | Risque |
|----------|----------|--------|--------|--------|
| 🔴 P1 | Activer PullSyncWorker en mode local | 2h | ✅ Résout le problème | Faible |
| 🔴 P1 | Ajouter endpoint de pull forcé | 1h | ✅ Solution de contournement | Très faible |
| 🟠 P2 | Realtime Subscriptions Supabase | 2 jours | ✅ Temps réel + performance | Moyen |
| 🟠 P2 | Logger les tentatives de miroir échouées | 1h | 🟡 Améliore le diagnostic | Très faible |
| 🟡 P3 | Dashboard d'état de la sync | 3 jours | 🟡 Observabilité | Faible |

---

## 6. RECOMMANDATION IMMÉDIATE

Si vous voulez que les commandes cloud apparaissent dans le POS local **dès maintenant**, la solution la plus rapide est :

1. **Modifier** `supabase-pull-sync.service.ts` ligne 68 : supprimer `if (dataSource.isLocal()) enabled = false;`
2. **Configurer** `.env.local` : `ENABLE_SUPABASE_PULL=true` et `SUPABASE_PULL_INTERVAL_MS=5000`
3. **Redémarrer** l'application locale

Cela activera le worker de pull qui, **toutes les 5 secondes**, ira chercher les nouvelles commandes dans Supabase pour les matérialiser dans SQLite.

**Alternative plus rapide encore** : Ajouter un bouton "Rafraîchir" dans le POS qui appelle un endpoint de pull forcé. Temps de développement : ~30 minutes.

---

## 7. CONCLUSION

**La synchronisation est UNIDIRECTIONNELLE en pratique :**

| Direction | Fonctionne ? | Mécanisme |
|-----------|-------------|-----------|
| Local → Cloud | ✅ **OUI** | Outbox → GenericSyncService.pushByEntity |
| Cloud → Local | ❌ **NON** | Aucun mécanisme actif |

**Cause racine identifiée :** Le `SupabasePullSyncWorker` est explicitement désactivé en mode local (`dataSource.isLocal() → enabled = false`). Sans ce worker, les commandes créées dans le cloud (via le POS web, les QR menus, ou le dashboard) ne sont jamais tirées vers la base SQLite locale.

**Le problème est FACILE à corriger** : une ligne à modifier dans `supabase-pull-sync.service.ts` et une variable d'environnement à définir.