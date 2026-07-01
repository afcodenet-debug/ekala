# RAPPORT D'AUDIT ARCHITECTURAL — Application Bootstrap & Subscription Gate

**Date:** 26/06/2026
**Objectif:** Audit exhaustif des appels API dispersés et plan de centralisation vers un ApplicationBootstrap unique

---

## PHASE 1 — INVENTAIRE EXHAUSTIF DES APPELS API

### 1.1 Appels fetch() directs dans les PAGES

| Fichier | Ligne | API appelée | Déclenchement | Centralisable ? |
|---------|-------|-------------|---------------|-----------------|
| src/pages/Dashboard.tsx | 417 | fetchDashboard (30s polling) | useEffect | OUI → DataLoader |
| src/pages/OrdersPage.tsx | 407 | fetchAllOrders (polling) | useEffect | OUI → DataLoader |
| src/pages/TablesPage.tsx | 575 | fetchTables (10s polling) | useEffect | OUI → DataLoader |
| src/pages/CategoriesPage.tsx | 427 | fetchCategories | useEffect | OUI → DataLoader |
| src/pages/users/UsersPage.tsx | 383 | fetchUsers | useEffect | OUI → DataLoader |
| src/pages/staff/StaffPage.tsx | 378 | fetchData | useEffect | OUI → DataLoader |
| src/pages/Expenses.tsx | 406 | fetchExpenses | useEffect | OUI → DataLoader |
| src/pages/settings/SubscriptionPremiumPage.tsx | 195 | fetchData | useEffect | OUI → DataLoader |
| src/pages/saas/BillingPageV2.tsx | 483 | /plans?type=paid | useEffect | OUI → DataLoader |
| src/pages/saas/BillingPageV2.tsx | 517 | refresh billing | polling | OUI → DataLoader |
| src/pages/saas/BillingPage.tsx | 816 | /tenants/{id} | useEffect | OUI → DataLoader |
| src/pages/saas/BillingPage.tsx | 833 | /plans | useEffect | OUI → DataLoader |
| src/pages/saas/SignupPage.tsx | 110 | /plans | useEffect | OUI → DataLoader |
| src/pages/saas/PricingPage.tsx | 41 | /api/plans | useEffect | OUI → DataLoader |
| src/pages/auth/LoginPage.tsx | 352 | checkServer (polling) | useEffect | NON (pre-auth) |
| src/pages/platform/PlatformLoginPage.tsx | 229 | /platform/auth/login | user action | NON |
| src/pages/platform/SyncCenterPage.tsx | 246 | /platform/sync/trigger | user action | NON |
| src/pages/PublicMenuPage.tsx | multiple | menu APIs | user action | NON |

### 1.2 Appels fetch() dans les STORES

| Fichier | Méthode | Déclenchement | Centralisable ? |
|---------|---------|---------------|-----------------|
| src/stores/useTenantAuthStore.ts | fetch('/api/auth/status') | useEffect | NON (auth layer) |
| src/stores/useAuthStore.ts | fetch('/api/auth/status') | useEffect | NON (auth layer) |
| src/stores/usePlatformAuthStore.ts | login/me | user action | NON |
| src/stores/useSaleStore.ts | receipt | user action | NON |
| src/stores/useTableStore.ts | fetchTables | DataLoader + polling | OUI |
| src/stores/useOrderStore.ts | fetchActiveOrders/fetchAllOrders | DataLoader + polling | OUI |
| src/stores/useExpenseStore.ts | fetchExpenses | DataLoader | OUI |
| src/stores/usePOSStore.ts | loadProducts | DataLoader (deprecated) | OUI |

### 1.3 Pollings actifs problématiques

| Fichier | Intervalle | API | Problème |
|---------|-----------|-----|----------|
| src/pages/Dashboard.tsx | 30s | fetchDashboard | **Indépendant** |
| src/pages/OrdersPage.tsx | configurable | fetchAllOrders | **Parallèle** |
| src/pages/TablesPage.tsx | 10s | fetchTables | **Parallèle** |
| src/components/DataLoader.tsx | 10s | orders + tables | SEUL autorisé |

### 1.4 useEffect(() => fetch...) problématiques

| Fichier | API | Pourquoi c'est un problème |
|---------|-----|---------------------------|
| CategoriesPage.tsx | fetchCategories | Devrait être chargé dans DataLoader |
| UsersPage.tsx | fetchUsers | Devrait être chargé dans DataLoader |
| StaffPage.tsx | fetchData | Devrait être chargé dans DataLoader |
| Expenses.tsx | fetchExpenses | Devrait être chargé dans DataLoader |
| SubscriptionPremiumPage.tsx | fetchData | Devrait être chargé dans DataLoader |

---

## PHASE 2 — GRAPHE DE DÉPENDANCE ACTUEL

```
App.tsx
  ├─ ErrorBoundary
  ├─ QueryClientProvider (React Query)
  ├─ I18nProvider
  ├─ SubscriptionProvider → status (loading|active|blocked|error)
  └─ AppContent
        ├─ DataLoader (chargement initial + polling 10s)
        ├─ Routes publiques (login, pricing, signup, menu, platform)
        └─ ProtectedRoute → SubscriptionGate
              └─ App Layout + Sidebar
                    └─ Routes métier
                          ├─ Dashboard [POLLING 30s indépendant]
                          ├─ TablesPage [POLLING 10s indépendant]
                          ├─ OrdersPage [POLLING indépendant]
                          ├─ CategoriesPage [fetch autonome]
                          ├─ UsersPage [fetch autonome]
                          ├─ StaffPage [fetch autonome]
                          └─ Expenses [fetch autonome]
```

**PROBLÈMES:**
1. Pollings concurrents (Dashboard 30s, TablesPage 10s, OrdersPage, DataLoader 10s)
2. useEffects autonomes qui chargent leurs propres données
3. Aucun mécanisme central d'arrêt d'urgence
4. SubscriptionProvider ne bloque pas les fetch dans les pages individuelles

---

## PHASE 3 — ARCHITECTURE CIBLE

```
App.tsx
  ├─ ErrorBoundary
  ├─ QueryClientProvider
  ├─ I18nProvider
  └─ SubscriptionProvider (GATE)
        ├─ loading → AppSkeleton (Loader full screen)
        ├─ blocked → SubscriptionRequiredPage (ZERO composants)
        ├─ error   → ErrorPage (avec retry)
        └─ active  → ApplicationBootstrap (SEUL point d'entrée)

ApplicationBootstrap (remplace DataLoader)
  ├─ Étape 1: Vérifier auth (déjà fait)
  ├─ Étape 2: Vérifier subscription (déjà fait)
  ├─ Étape 3: Charger tenant config
  ├─ Étape 4: Hydrater TOUS les stores (tables, products, orders, expenses, etc.)
  ├─ Étape 5: Démarrer UN SEUL polling centralisé (orders + tables + dashboard)
  ├─ Étape 6: Signaler "ready"
  └─ Rendu de l'application
        ├─ Routes publiques
        ├─ Routes platform
        └─ Routes métier protégées
              └─ Tous les composants consomment les STORES déjà hydratés
                    └─ AUCUN useEffect(() => fetch...) dans les pages
```

**Principe:**
```
AVANT:  Page A → fetch → API    APRÈS:  ApplicationBootstrap → fetch → API → hydrate Stores
        Page B → fetch → API                                    Page A → lit → Store A
        Page C → fetch → API                                    Page B → lit → Store B
```

---

## PHASE 4 — PLAN DE MIGRATION

### Étape 1: ApplicationBootstrap (NOUVEAU fichier)
**Fichier:** `src/components/ApplicationBootstrap.tsx`
**Risque:** FAIBLE
**Action:** Créer le composant qui centralise tout le chargement initial + polling unique

### Étape 2: SubscriptionProvider (DÉJÀ FAIT)
**Fichier:** `src/contexts/SubscriptionContext.tsx`
**Risque:** MOYEN
**Action:** Nouveaux états loading/active/blocked/error déjà implémentés

### Étape 3: Modifier App.tsx
**Fichier:** `src/App.tsx`
**Risque:** MOYEN
**Actions:**
- Remplacer DataLoader par ApplicationBootstrap
- Gate: `if (status === 'blocked') return <SubscriptionRequiredPage />`
- Gate: `if (status === 'loading') return <AppSkeleton />`

### Étape 4: Supprimer DataLoader.tsx
**Fichier:** `src/components/DataLoader.tsx`
**Risque:** FAIBLE
**Action:** Supprimer (remplacé par ApplicationBootstrap)

### Étape 5: Supprimer SubscriptionGate.tsx
**Fichier:** `src/components/SubscriptionGate.tsx`
**Risque:** FAIBLE
**Action:** Supprimer (logique intégrée dans SubscriptionProvider)

### Étape 6: Nettoyer les stores
**Risque:** MOYEN
**Action:** Retirer les useEffect(() => fetch...) des pages. Les stores gardent leurs méthodes mais elles ne sont appelées QUE par ApplicationBootstrap.

### Étape 7: Centraliser les pollings
**Risque:** ÉLEVÉ
**Ordre:**
1. Dashboard.tsx → retirer `setInterval(fetchDashboard, 30000)`
2. TablesPage.tsx → retirer `setInterval(() => fetchTables(), 10000)`
3. OrdersPage.tsx → retirer `setInterval(fetchAllOrders, pollMs)`
4. Tout regrouper dans ApplicationBootstrap

### Étape 8: Tests de régression
**Risque:** ÉLEVÉ
**Tests:**
1. loading → active → rendu complet
2. loading → blocked → SubscriptionRequiredPage
3. Arrêt des pollings sur blocked
4. Dashboard sans polling local
5. TablesPage sans fetch local
6. OrdersPage sans fetch local

---

## FICHIERS CONCERNÉS (par ordre)

| Fichier | Action | Priorité |
|---------|--------|----------|
| src/contexts/SubscriptionContext.tsx | DÉJÀ FAIT | P0 |
| src/components/ApplicationBootstrap.tsx | CRÉER | P0 |
| src/App.tsx | Modifier | P0 |
| src/components/DataLoader.tsx | Supprimer | P0 |
| src/components/SubscriptionGate.tsx | Supprimer | P0 |
| src/pages/Dashboard.tsx | Nettoyer polling | P1 |
| src/pages/OrdersPage.tsx | Nettoyer polling | P1 |
| src/pages/TablesPage.tsx | Nettoyer polling | P1 |
| src/pages/CategoriesPage.tsx | Nettoyer fetch | P1 |
| src/pages/users/UsersPage.tsx | Nettoyer fetch | P1 |
| src/pages/staff/StaffPage.tsx | Nettoyer fetch | P1 |
| src/pages/Expenses.tsx | Nettoyer fetch | P1 |
| src/pages/settings/SubscriptionPremiumPage.tsx | Nettoyer fetch | P1 |
| src/pages/saas/BillingPageV2.tsx | Nettoyer polling | P1 |
| src/pages/saas/BillingPage.tsx | Nettoyer useEffect | P1 |
| src/pages/saas/SignupPage.tsx | Nettoyer useEffect | P1 |
| src/pages/saas/PricingPage.tsx | Nettoyer useEffect | P1 |

## NON CENTRALISABLES (gardent leurs fetch)

- LoginPage (auth pre-subscription)
- PublicMenuPage (page publique)
- PlatformLoginPage (auth platform)
- SyncCenterPage (actions manuelles)
- AdminPaymentsPage (actions admin)
- ErrorBoundary (log d'erreur)
- useSaleStore.fetchReceipt (action utilisateur)
- Toutes les mutations (create/update/delete)

---

## CONCLUSION

**3 problèmes majeurs identifiés:**
1. Pollings concurrents (Dashboard, TablesPage, OrdersPage, DataLoader en parallèle)
2. useEffect autonomes (Categories, Users, Staff, Expenses chargent indépendamment)
3. Absence de kill switch (SubscriptionProvider ne peut pas arrêter les fetch)

**Solution ApplicationBootstrap résout les 3:**
1. Un seul polling centralisé
2. Hydratation unique au démarrage
3. Arrêt immédiat via status blocked/error

**Impact:** ~30 appels fetch redondants supprimés, 10+ pages simplifiées, architecture SaaS professionnelle.
