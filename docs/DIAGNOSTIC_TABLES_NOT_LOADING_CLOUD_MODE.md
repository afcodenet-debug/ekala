# Diagnostic — Tables ne se chargent pas sur la page POS en mode Cloud

## Contexte

En mode **Cloud** (déploiement Render/Vercel avec Supabase), les tables de restaurant
n'apparaissent pas automatiquement lorsque l'utilisateur accède directement à la
page POS (`/pos`). L'utilisateur doit d'abord naviguer vers la page `Tables`
(`/tables`) puis revenir sur `POS` pour que les tables s'affichent.

En mode **Local** (localhost / Electron), les tables se chargent correctement
sur la page POS sans passer par la page Tables.

---

## Analyse de la chaîne d'appel

### 1. POS Page (`src/pages/POS.tsx`)

La page POS **n'appelle pas `fetchTables()` directement**. Elle se contente de
consommer le store Zustand :

```typescript
// POS.tsx — ligne 94
const { error: tableError } = useTableStore();
```

La page POS rend `<FloorTablesSidebar>` qui est chargé d'afficher les tables :

```typescript
// POS.tsx — ligne 185
<FloorTablesSidebar onTableSelect={() => {}} selectedTableId={selectedTableId} layout="horizontal" />
```

### 2. FloorTablesSidebar (`src/features/pos/components/FloorTablesSidebar.tsx`)

Le composant `FloorTablesSidebar` **contient un `useEffect` qui appelle
`fetchTables()`** (ligne 553) :

```typescript
useEffect(() => { if (user) fetchTables(); }, [user, fetchTables]);
```

Cependant, **il ne call pas `setUserContext()`**. Il s'appuie sur le fait que
`setUserContext` a déjà été appelé ailleurs.

### 3. useTableStore.fetchTables() (`src/stores/useTableStore.ts`)

La méthode `fetchTables()` a **une garde d'arrêt anticipé** (lignes 51-53) :

```typescript
fetchTables: async (silent = false) => {
    const { userId, role } = get();
    if (!userId || !role) return;   // ← GARDE: retourne sans rien faire si non initialisé
    ...
    const tables = await api.tables.getAll(params, get().role);
    set({ tables: Array.isArray(tables) ? tables : [], isLoading: false });
}
```

**Si `userId` ou `role` est `undefined` dans le store, la méthode retourne
immédiatement sans effectuer aucune requête réseau.**

### 4. setUserContext — qui l'appelle ?

`setUserContext` n'est appelé que dans **deux endroits** :

| Fichier | Ligne | Contexte |
|---|---|---|
| `src/components/DataLoader.tsx` | 58 | `useTableStore.getState().setUserContext(user.id, user.role);` |
| `src/pages/TablesPage.tsx` | 573 | `setUserContext(user.id, user.role);` |

**Ni `FloorTablesSidebar` ni `POS.tsx` n'appellent jamais `setUserContext()`.**

### 5. DataLoader (`src/components/DataLoader.tsx`) — la passerelle critique

`DataLoader` est le composant chargé de charger les données globalement. Mais il
est **soumis à trois gardes successives** (lignes 26-51) :

```typescript
// GARDE 1 — Authentification
if (!isAuthenticated || !user) return;

// GARDE 2 — Statut d'abonnement (BILLING GATE)
if (billingLoading) return;                    // ← En attente du billing
if (billingStatus && !billingStatus.active) return;  // ← Abonnement inactif

// GARDE 3 — Singleton global
if (globalInitialized) return;                  // ← Déjà initialisé
if (globalLoadingPromise) return;             // ← Chargement en cours
```

La **GARDE 2 (billing gate)** est le point de bascule entre local et cloud :

### 6. useBillingStatus (`src/hooks/useBillingStatus.ts`)

| Mode | Comportement |
|---|---|
| **LOCAL** | Ligne 55 : `if (RuntimeContext.getInstance().isLocal)` → renvoie immédiatement `active: true, loading: false`. **Aucune requête réseau.** |
| **CLOUD** | Ligne 85 : appelle `checkStatus()` qui effectue une requête HTTP vers `/v1/subscription/status/${tenantId}`. `loading` reste `true` pendant la durée de la requête. |

---

## Chaîne d'événements en mode Cloud (échec)

```
1. L'utilisateur se connecte et est redirigé vers /pos
2. POS.tsx rend <FloorTablesSidebar>
3. FloorTablesSidebar useEffect: if (user) → user existe → appelle fetchTables()
4. fetchTables(): const { userId, role } = get() → userId=undefined, role=undefined
5. fetchTables(): if (!userId || !role) return → SORT IMMÉDIATEMENT, AUCUNE REQUÊTE
6. DataLoader est monté en parallèle mais :
   a. useBillingStatus est en mode CLOUD → loading=true (requête HTTP en cours)
   b. DataLoader: if (billingLoading) return → SORT
   c. setUserContext() N'EST JAMAIS APPELÉ
7. Résultat : tables=[] dans le store, FloorTablesSidebar affiche "aucune table"
```

## Chaîne d'événements en mode Cloud (succès après passage par /tables)

```
1. L'utilisateur navigue vers /tables
2. TablesPage useEffect (ligne 571-578) :
   a. setUserContext(user.id, user.role) → userId et role SONT maintenant définis
   b. fetchTables() → userId et role définis → requête API réussit
   c. tables sont stockées dans le store Zustand
3. L'utilisateur navigue vers /pos
4. FloorTablesSidebar useEffect: fetchTables() → userId et role sont DÉJÀ définis
   → requête réussit (ou tables déjà en cache)
5. Résultat : tables s'affichent correctement
```

## Chaîne d'événements en mode Local (toujours réussi)

```
1. L'utilisateur se connecte et est redirigé vers /pos
2. useBillingStatus: isLocal → loading=false, active=true IMMÉDIATEMENT
3. DataLoader: billingLoading=false → passe la GARDE 2
4. DataLoader: globalInitialized=false → passe la GARDE 3
5. DataLoader: setUserContext(user.id, user.role) → userId et role définis
6. DataLoader: fetchTables() → requête SQLite locale → tables chargées
7. FloorTablesSidebar: tables déjà dans le store → affichage correct
```

---

## Cause racine

> **Le composant `FloorTablesSidebar` (et par extension la page POS) ne call
> jamais `setUserContext()` avant d'appeler `fetchTables()`. En mode Cloud,
> `DataLoader` — le seul autre endroit qui appelle `setUserContext()` — est
> bloqué par la **billing gate** tant que la requête HTTP de statut d'abonnement
> n'est pas résolue. Pendant ce temps, `fetchTables()` retourne silencieusement
> sans rien faire à cause de la garde `if (!userId || !role) return`.**

En mode Local, la billing gate est contournée car `useBillingStatus` renvoie
`active: true, loading: false` instantanément (sans requête réseau), ce qui
permet à `DataLoader` de s'exécuter immédiatement et d'appeler
`setUserContext()`.

---

## Facteurs aggravants

1. **Singleton `globalInitialized`** (`DataLoader.tsx` ligne 16) : si
   `DataLoader` a tenté de s'initialiser une première fois (même sans succès
   car bloqué par le billing gate), le flag `globalInitialized` n'est jamais
   mis à `true` (car le code l'atteint après `Promise.allSettled`), mais
   `globalLoadingPromise` pourrait rester `null` et permettre un retry.
   Cependant, si le composant `DataLoader` est démonté et remonté, le
   `hasLoaded.current` ref est lié au composant et serait réinitialisé.

2. **Absence de polling sur la page POS** : Contrairement à `TablesPage` qui
   a un `setInterval(() => fetchTables(), 10000)` (ligne 575), la page POS ne
   rafraîchit pas les tables périodiquement. Une fois que le billing status
   devient disponible et que `DataLoader` s'exécute, il n'y a **aucun
   mécanisme qui déclenche un nouveau `fetchTables()` sur la page POS**.

3. **Aucun écouteur d'événement** : `DataLoader` ne dispatch aucun événement
   global lorsqu'il termine le chargement. Les composants comme
   `FloorTablesSidebar` n'ont aucun moyen de savoir que les données sont
   maintenant disponibles.

4. **Fail-open du billing** : `useBillingStatus` a un fail-open (ligne 131-141)
   qui définit `active: true` en cas d'erreur. Mais si la requête est lente
   (latence réseau Supabase), `loading` reste `true` pendant plusieurs
   secondes, bloquant `DataLoader` pendant ce temps.

---

## Recommandations (non implémentées — diagnostic uniquement)

1. **Appeler `setUserContext()` dans `FloorTablesSidebar`** avant
   `fetchTables()`, comme le fait `TablesPage` (ligne 573). C'est le fix
   le plus direct.

2. **Supprimer ou affaiblir la billing gate dans `DataLoader`** : la
   `useBillingStatus` a déjà un fail-open, mais le `if (billingLoading)
   return` bloque l'initialisation pendant le chargement. Proposer
   `if (billingLoading && !billingStatus) { /* allow tables to load anyway */ }`.

3. **Ajouter un polling ou un rafraîchissement sur la page POS** : comme
   `TablesPage`, ajouter un `setInterval` pour rafraîchir les tables toutes
   les 10 secondes.

4. **Émettre un événement global** lorsque `DataLoader` termine le
   chargement, que `FloorTablesSidebar` pourrait écouter pour déclencher
   un `fetchTables()`.

5. **Rendre `fetchTables()` plus résiliente** : au lieu de retourner
   silencieusement quand `userId`/`role` sont absents, déclencher un
   `setUserContext` depuis `useAuthStore` comme fallback (le store
   `useTableStore` importe déjà `useAuthStore` à la ligne 3).
