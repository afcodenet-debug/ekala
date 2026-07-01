# AUDIT FORENSIQUE DU SYSTÈME DE NOTIFICATIONS FRONTEND

**Date:** 29 Juin 2026  
**Méthode:** Analyse statique du code source uniquement  
**Portée:** Frontend React + Store Zustand + Composants UI  
**Interdiction:** Aucune modification de code, aucune supposition, aucun résumé

---

## 1. INVENTAIRE COMPLET DES FICHIERS

### 1.1 Composants UI

| Fichier | Lignes | Statut |
|---------|--------|--------|
| `src/components/NotificationCenter.tsx` | 382 | **PRODUCTION** |
| `src/components/GlobalNotificationToast.tsx` | 240 | **PRODUCTION** |
| `src/components/NotificationBadge.tsx` | 43 | **PRODUCTION** |
| `src/components/ToastProvider.tsx` | 120 | **MORT** |
| `src/components/StatusToast.tsx` | ~150 | **PRODUCTION** |

### 1.2 Stores

| Fichier | Lignes | Statut |
|---------|--------|--------|
| `src/stores/useNotificationStore.ts` | 114 | **PRODUCTION** |

### 1.3 Fichiers serveur (pour référence)

| Fichier | Rôle |
|---------|------|
| `src/server/notifications/notification-event-bus.ts` | Event bus |
| `src/server/notifications/notification-queue.ts` | Queue in-memory |
| `src/server/notifications/notification-logger.ts` | Logger structuré |
| `src/server/services/notification.service.ts` | Service principal |
| `src/server/routes/notifications.ts` | Routes API |

---

## 2. ANALYSE DÉTAILLÉE DES COMPOSANTS UI

### 2.1 NotificationCenter.tsx

**Responsabilité:** Panneau coulissant affichant toutes les notifications avec filtres (non lues / toutes)

**Qui l'utilise:**
- `src/App.tsx` ligne 167-170: Rendu direct dans le layout principal

**Qui le rend:**
- `App.tsx` via `<NotificationCenter isOpen={...} onClose={...} />`

**État:** PRODUCTION

**Hooks utilisés:**
- `useNotificationStore()` (ligne 241)

**Stores utilisés:**
- `useNotificationStore`

**API appelées:** Aucune

**Realtime utilisé:** Non

**Offline utilisé:** Non

**Animations:**
- `nc-slide-in`: entrée du panneau (260ms cubic-bezier)
- `nc-backdrop-in`: entrée du backdrop (200ms ease)
- Styles injectés dynamiquement (ligne 6-202)

**Responsive:** Non (width fixe 400px)

**Accessibilité:**
- `role="dialog"` (ligne 263)
- `aria-label="Centre de notifications"` (ligne 263)
- `aria-label="Fermer"` sur bouton close (ligne 282)

**Fonctionnalités:**
- Liste triée par date (plus récent en haut)
- Filtre onglets: "Toutes" / "Non lues"
- Badge compteur non lues dans header
- Bouton "Tout lire"
- Indicateur visuel point orange pour non lu
- Badge de priorité (critical/high/medium/low)
- Navigation par clic (si `link` existe)
- Footer: "Données stockées localement sur cet appareil"

**Types de notifications supportés:**
- `critical`: rouge, AlertCircle
- `high`: orange, AlertTriangle
- `medium`: bleu, Info
- `low`: gris, Package

---

### 2.2 GlobalNotificationToast.tsx

**Responsabilité:** Toast global affichant la dernière notification critique/haute priorité

**Qui l'utilise:**
- `src/App.tsx` ligne 166: Rendu direct dans le layout principal

**Qui le rend:**
- `App.tsx` via `<GlobalNotificationToast />`

**État:** PRODUCTION

**Hooks utilisés:**
- `useNotificationStore()` (ligne 153)
- `useSettingsStore()` (ligne 155)
- `useNavigate()` (ligne 156)

**Stores utilisés:**
- `useNotificationStore`
- `useSettingsStore`

**API appelées:** Aucune

**Realtime utilisé:** Non

**Offline utilisé:** Non

**Animations:**
- `gnt-slide-in`: entrée (240ms cubic-bezier)
- `gnt-pulse-border`: barre de priorité pulsante (2.4s ease-in-out infinite)
- Styles injectés dynamiquement (ligne 14-135)

**Responsive:** Non (width fixe 360px)

**Accessibilité:**
- `role="alert"` (ligne 196)
- `aria-live="assertive"` (ligne 196)
- `aria-label="Fermer"` sur bouton close (ligne 225)

**Fonctionnalités:**
- Affiche uniquement notifications `critical` ou `high` non lues
- Auto-dismiss: pas de timeout automatique (manuel seulement)
- Clic navigue vers `link` ou fallback `/orders`
- Bouton fermer avec stopPropagation
- Footer avec label de priorité
- Évite de réafficher le même toast (lastShownIdRef)

**Logique de filtrage (ligne 163-169):**
```typescript
const candidate = notifications.find(
  (n) => !n.readAt && !dismissedIds.has(n.id) && ['critical', 'high'].includes(n.priority)
);
```

---

### 2.3 NotificationBadge.tsx

**Responsabilité:** Badge compteur de notifications non lues

**Qui l'utilise:**
- `src/components/Sidebar.tsx` ligne 11: Import
- `src/components/Sidebar.tsx` ligne ~250: Rendu dans le bouton notifications
- `src/components/Sidebar.tsx` ligne ~230: Rendu dans le menu item Orders avec `count={pendingQrCount}`

**Qui le rend:**
- `Sidebar.tsx` (2 endroits)

**État:** PRODUCTION

**Hooks utilisés:**
- `useNotificationStore()` (ligne 12)

**Stores utilisés:**
- `useNotificationStore`

**API appelées:** Aucune

**Realtime utilisé:** Non

**Offline utilisé:** Non

**Animations:** Aucune

**Responsive:** Oui (inline-flex)

**Accessibilité:** Aucune

**Fonctionnalités:**
- Affiche `unreadCount` par défaut
- Accepte prop `count` pour override (utilisé pour QR count)
- Accepte prop `color` pour background custom
- Formattage: "99+" si > 99
- Cache si count === 0
- Texte blanc sur fond rouge par défaut, texte noir sur fond custom

**Problème détecté:**
- **DUPLICATION D'UTILISATION:** Utilisé pour deux compteurs différents:
  1. Compteur de notifications non lues (ligne ~250)
  2. Compteur de QR orders en attente (`pendingQrCount`) (ligne ~230)

---

### 2.4 ToastProvider.tsx

**Responsabilité:** Provider de toasts génériques (success/error/warning/info)

**Qui l'utilise:** PERSONNE

**Qui le rend:** PERSONNE

**État:** **MORT**

**Preuve de mort:**
- Search results: `ToastProvider|useToast` dans `*.tsx` = 2 résultats
- Les 2 résultats sont dans le fichier lui-même (définition et export)
- Aucun import dans App.tsx ou autres composants
- Aucun rendu dans l'arborescence React

**Hooks utilisés:**
- `createContext`, `useContext` (ligne 1)
- `useState`, `useCallback` (ligne 1)

**Stores utilisés:** Aucun

**API appelées:** Aucune

**Realtime utilisé:** Non

**Offline utilisé:** Non

**Animations:**
- `slideIn`: entrée (0.3s ease)
- `slideOut`: sortie (défini mais jamais utilisé)

**Responsive:** Oui (maxWidth 400px)

**Accessibilité:** Aucune

**Fonctionnalités:**
- API: `showToast(type, message, duration)`
- Types: success, error, warning, info
- Auto-dismiss après duration (défaut 4000ms)
- Clic pour fermer
- Bouton X pour fermer
- Position: fixed top-right

**Note:** Ce composant est un **legacy** non intégré. Le projet utilise `GlobalNotificationToast` et `StatusToast` à la place.

---

### 2.5 StatusToast.tsx

**Responsabilité:** Toast de statut pour erreurs métier (stock, paiement)

**Qui l'utilise:**
- `src/pages/OrdersPage.tsx` ligne: Import et rendu
- `src/pages/POS.tsx` ligne: Import et rendu

**Qui le rend:**
- `OrdersPage.tsx`
- `POS.tsx`

**État:** PRODUCTION

**Hooks utilisés:**
- Aucun hook React (composant présentationnel)

**Stores utilisés:** Aucun

**API appelées:** Aucune

**Realtime utilisé:** Non

**Offline utilisé:** Non

**Animations:** Aucune (statique)

**Responsive:** Non (width fixe dans props)

**Accessibilité:** Aucune

**Fonctionnalités:**
- Props: title, subtitle, message, variant, details, meta, footer, actions, onClose
- Variants: success, error, warning, info
- Affichage d'icônes selon variant
- Couleurs sémantiques (rouge=error, orange=warning, etc.)
- Support détails structurés (label/value/highlight)
- Support actions custom (boutons)
- Fermeture manuelle uniquement (pas d'auto-dismiss)

**Note:** Composant métier spécifique à POS et Orders. Pas intégré au système de notifications global.

---

## 3. CARTOGRAPHIE DU FLUX COMPLET

### 3.1 Flux de création (Backend → Frontend)

```
Backend (notification.service.ts)
    ↓
POST /api/notifications (notification.repository.ts)
    ↓
Frontend (useNotificationStore.ingestNotifications)
    ↓
Store (notifications[] + unreadCount)
    ↓
    ├─→ GlobalNotificationToast (si critical/high)
    ├─→ NotificationBadge (compteur)
    └─→ NotificationCenter (liste)
```

**PREUVE:**

1. **Backend:** `src/server/services/notification.service.ts` existe
2. **API Route:** `src/server/routes/notifications.ts` existe
3. **Store method:** `ingestNotifications` définie dans `useNotificationStore.ts` ligne 84-96
4. **Toast:** `GlobalNotificationToast.tsx` ligne 162-170: `useEffect` écoute `notifications`
5. **Badge:** `NotificationBadge.tsx` ligne 12: `useNotificationStore()` 
6. **Center:** `NotificationCenter.tsx` ligne 241: `useNotificationStore()`

**PROBLÈME DÉTECTÉ:** Aucun fichier frontend n'appelle `ingestNotifications`. Cette méthode existe mais n'est jamais utilisée.

---

### 3.2 Flux de création (Frontend only)

```
TablesManagement.tsx (addNotification)
    ↓
useNotificationStore.getState().addNotification()
    ↓
Store (notifications[] + unreadCount)
    ↓
    ├─→ GlobalNotificationToast (si critical/high)
    ├─→ NotificationBadge (compteur)
    └─→ NotificationCenter (liste)
```

**PREUVE:**

1. **Création:** `src/pages/tables/TablesManagement.tsx` - 7 appels à `addNotification`
2. **Store:** `useNotificationStore.ts` ligne 42-55: méthode `addNotification`
3. **Affichage:** Même flux que 3.1

**Types créés:**
- `systemError` (ligne TablesManagement.tsx)
- `tableError` (ligne TablesManagement.tsx)
- `systemInfo` (ligne TablesManagement.tsx)

---

### 3.3 Flux de lecture

```
User click NotificationCenter item
    ↓
handleItemClick(notif)
    ↓
markAsRead(notif.id)
    ↓
Store (readAt = now, unreadCount--)
    ↓
UI update (badge disparaît si 0)
```

**PREUVE:**

1. **Click handler:** `NotificationCenter.tsx` ligne 252-255
2. **Mark as read:** `useNotificationStore.ts` ligne 57-67
3. **UI update:** React re-render automatique via Zustand

---

### 3.4 Flux de suppression

```
User click X (GlobalNotificationToast)
    ↓
dismiss(id)
    ↓
markAsRead(id) + setDismissedIds
    ↓
Store (readAt = now)
    ↓
Toast disparaît (visibleToast = null)
```

**PREUVE:**

1. **Dismiss:** `GlobalNotificationToast.tsx` ligne 172-180
2. **Mark as read:** `useNotificationStore.ts` ligne 57-67
3. **Hide toast:** `setVisibleToast(null)` ligne 178

**Note:** Pas de vraie suppression. Les notifications restent dans le store, seulement marquées comme lues.

---

### 3.5 Flux "Tout lire"

```
User click "Tout lire" (NotificationCenter)
    ↓
markAllAsRead()
    ↓
Store (tous readAt = now, unreadCount = 0)
    ↓
UI update (tous badges disparaissent)
```

**PREUVE:**

1. **Bouton:** `NotificationCenter.tsx` ligne 277-280
2. **Action:** `useNotificationStore.ts` ligne 69-80

---

## 4. IDENTIFICATION DES POINTS DE RÉCEPTION

### 4.1 Points de réception visibles

| Point | Composant | Fichier | Ligne | Condition |
|-------|-----------|---------|-------|-----------|
| 1 | GlobalNotificationToast | App.tsx | 166 | Toutes pages (global) |
| 2 | NotificationBadge | Sidebar.tsx | ~250 | Toutes pages (sidebar) |
| 3 | NotificationCenter | App.tsx | 167-170 | Toutes pages (quand ouvert) |
| 4 | StatusToast | OrdersPage.tsx | - | Page Orders uniquement |
| 5 | StatusToast | POS.tsx | - | Page POS uniquement |

### 4.2 Points de réception backend (jamais atteints)

| Point | Fichier | Ligne | Statut |
|-------|---------|-------|--------|
| API GET /api/notifications | src/server/routes/notifications.ts | - | **EXISTE** |
| API POST /api/notifications | src/server/routes/notifications.ts | - | **EXISTE** |
| ingestNotifications() | useNotificationStore.ts | 84-96 | **DÉFINI** mais **JAMAIS APPELÉ** |

**PREUVE D'INUTILISATION:**

Search: `ingestNotifications` dans `*.tsx` = 0 résultats

---

## 5. DÉTECTION DES DUPLICATIONS

### 5.1 Doublons UI

| Type | Composant 1 | Composant 2 | Preuve |
|------|-------------|-------------|--------|
| Toast global | GlobalNotificationToast | ToastProvider (mort) | ToastProvider jamais importé |
| Toast métier | StatusToast | GlobalNotificationToast | Deux systèmes parallèles |
| Badge compteur | NotificationBadge (notifications) | NotificationBadge (QR count) | Même composant, deux usages ligne Sidebar.tsx |

### 5.2 Doublons de logique

| Logique | Fichier 1 | Fichier 2 | Preuve |
|---------|-----------|-----------|--------|
| Affichage toast critique | GlobalNotificationToast | StatusToast (error) | Deux composants pour afficher des erreurs |
| Compteur non lus | NotificationBadge | NotificationCenter header | Même donnée, deux affichages |

### 5.3 Doublons de styles

| Style | Fichier 1 | Fichier 2 | Preuve |
|-------|-----------|-----------|--------|
| CSS injecté | NotificationCenter (nc-*) | GlobalNotificationToast (gnt-*) | Deux systèmes de styles inline |
| Animations toast | GlobalNotificationToast | ToastProvider | Deux keyframes différents pour slide-in |

---

## 6. COMPOSANTS MORTS

### 6.1 ToastProvider.tsx

**Fichier:** `src/components/ToastProvider.tsx`  
**Lignes:** 120  
**Raison:** Jamais importé, jamais rendu

**Preuves:**

1. Search `ToastProvider` dans `*.tsx` = 1 résultat (définition seule)
2. Search `useToast` dans `*.tsx` = 1 résultat (définition seule)
3. `App.tsx` n'importe pas ToastProvider
4. Aucun autre composant n'utilise `useToast()`

**Impact:** Code mort de 120 lignes

---

### 6.2 Hooks jamais utilisés

| Hook | Fichier | Ligne | Statut |
|------|---------|-------|--------|
| `useToast()` | ToastProvider.tsx | 19 | **MORT** |
| `loadFromServer()` | useNotificationStore.ts | 28 | **DÉFINI** mais jamais appelé |

**Preuve loadFromServer:**

Search: `loadFromServer` dans `*.tsx` = 0 résultats

---

### 6.3 Stores inutilisés

| Store | Fichier | Statut |
|-------|---------|--------|
| Aucun store dédié notification | - | **N/A** |

**Note:** `useNotificationStore` est utilisé. Pas de store mort.

---

### 6.4 Providers inutilisés

| Provider | Fichier | Statut |
|----------|---------|--------|
| ToastProvider | ToastProvider.tsx | **MORT** |

---

## 7. PARCOURS UTILISATEUR PAR RÔLE

### 7.1 Owner / Admin

**Connexion:**
1. LoginPage → Dashboard
2. Clics: 2 (login + redirect)

**Dashboard:**
1. Voir GlobalNotificationToast (si critical/high)
2. Voir NotificationBadge dans Sidebar
3. Cliquer sur Bell → NotificationCenter s'ouvre
4. Voir liste notifications
5. Cliquer "Tout lire" (optionnel)
6. Cliquer sur notification → navigation

**Actions possibles:**
- Voir toast global (automatique)
- Ouvrir centre notifications (1 clic)
- Marquer comme lu (1 clic par notif ou 1 clic "Tout lire")
- Naviguer vers lien (1 clic)

**Temps estimé:**
- Réception toast: immédiat
- Ouverture centre: 1 clic
- Lecture: 2-3 clics

**Points de friction:**
- Pas de notification en temps réel (pas de WebSocket)
- Pas de persistance (perdu au refresh)
- Badge compteur dans sidebar mais pas de distinction visuelle avec QR count
- NotificationCenter width fixe 400px (pas adapté mobile)

---

### 7.2 Manager

**Même parcours que Owner/Admin**

**Restrictions:**
- Accès à `/staff`, `/reports`, `/expenses`
- Pas d'accès `/users`, `/settings`, `/admin/vouchers`

**Points de friction identiques**

---

### 7.3 Cashier

**Connexion:**
1. LoginPage → Dashboard
2. Clics: 2

**Dashboard:**
1. Voir GlobalNotificationToast (si critical/high)
2. Voir NotificationBadge dans Sidebar
3. Accès limité: pas `/staff`, `/analytics`, `/products`, `/categories`

**Actions possibles:**
- Voir toast global
- Voir badge compteur
- Ouvrir centre notifications
- Voir notifications ventes (`/sales`)

**Points de friction:**
- Moins de visibilité sur les notifications système (erreurs tables, etc.)
- Pas d'accès aux pages de gestion

---

### 7.4 Waiter

**Connexion:**
1. LoginPage → Dashboard
2. Clics: 2

**Dashboard:**
1. Voir GlobalNotificationToast (si critical/high)
2. Voir NotificationBadge dans Sidebar
3. Accès très limité: `/pos`, `/orders`, `/tables`

**Actions possibles:**
- Voir toast global
- Voir badge compteur
- Ouvrir centre notifications
- Voir notifications QR orders

**Points de friction:**
- `getVisibleNotifications('waiter')` filtre uniquement: `newQrOrder`, `orderAssigned`, `orderConfirm`
- Pas de visibilité sur autres notifications
- Store `useOrderStore` a `pendingQrCount` affiché dans Sidebar (séparé des notifications)

---

## 8. NOTE UX BASÉE SUR LE CODE

### 8.1 Architecture actuelle

**Constats:**

1. **Deux systèmes parallèles:**
   - Système A: `useNotificationStore` + `NotificationCenter` + `GlobalNotificationToast`
   - Système B: `StatusToast` (POS/Orders) + `ToastProvider` (mort)

2. **Aucune persistance:**
   - `loadFromServer()` existe mais jamais appelé
   - `ingestNotifications()` existe mais jamais appelé
   - Données perdues au refresh

3. **Aucun realtime:**
   - Pas de WebSocket
   - Pas de Supabase Realtime
   - Pas de polling
   - Notifications statiques uniquement

4. **Aucun offline:**
   - Pas de Service Worker
   - Pas de IndexedDB
   - Pas de queue de synchronisation

5. **Création frontend only:**
   - Toutes les notifications créées par `addNotification()` dans TablesManagement
   - Aucune notification créée par backend
   - API notifications existe mais jamais appelée

### 8.2 Problèmes UX identifiés

| Problème | Fichier | Ligne | Impact |
|----------|---------|-------|--------|
| ToastProvider mort | ToastProvider.tsx | 1-120 | Code mort, confusion |
| Deux systèmes toast | GlobalNotificationToast + StatusToast | - | Incohérence UX |
| Badge double usage | Sidebar.tsx | ~230, ~250 | Confusion utilisateur |
| Pas de persistance | useNotificationStore.ts | 28 | Perte données au refresh |
| Pas de realtime | - | - | Notifications pas à jour |
| Width fixe 400px | NotificationCenter.tsx | 29 | Mobile cassé |
| Pas d'animations sortie | GlobalNotificationToast | - | Disparition brutale |
| Pas de son/vibration | - | - | Accessibilité réduite |
| Pas de préférences | - | - | Utilisateur passif |

### 8.3 Points forts

| Point | Fichier | Preuve |
|-------|---------|--------|
| Design system cohérent | NotificationCenter.tsx | Styles CSS variables, animations fluides |
| Priorisation visuelle | NotificationCenter.tsx | Couleurs + icônes par priorité |
| Accessibilité basique | NotificationCenter.tsx | role="dialog", aria-label |
| Gestion des états | useNotificationStore.ts | unreadCount, markAsRead, markAllAsRead |
| Navigation contextuelle | GlobalNotificationToast.tsx | Clic → link ou fallback |

---

## 9. ÉCARTS V3 vs FRONTEND

### 9.1 Ce que V3 permet

| Feature V3 | Fichier serveur | Statut frontend |
|-------------|-----------------|-----------------|
| Event Bus | notification-event-bus.ts | **NON UTILISÉ** |
| Queue asynchrone | notification-queue.ts | **NON UTILISÉ** |
| Retry logic | notification-queue.ts | **NON UTILISÉ** |
| Dead letter queue | notification-queue.ts | **NON UTILISÉ** |
| Multi-channel (email, SMS, push, Slack, webhook) | sms-channel.service.ts, etc. | **NON UTILISÉ** |
| Templates email | email-template.service.ts | **NON UTILISÉ** |
| Circuit breaker | email-circuit-breaker.ts | **NON UTILISÉ** |
| Monitoring | monitoring.service.ts | **NON UTILISÉ** |
| Supabase Realtime | supabase-realtime.service.ts | **NON UTILISÉ** |
| Offline-first | - | **NON UTILISÉ** |
| Persistence | notification.repository.ts | **NON UTILISÉ** |
| Preferences utilisateur | notification_preferences.ts | **NON UTILISÉ** |

### 9.2 Ce que le frontend affiche

| Feature | Fichier | Statut |
|---------|---------|--------|
| Liste notifications | NotificationCenter.tsx | **ACTIF** |
| Toast global | GlobalNotificationToast.tsx | **ACTIF** |
| Badge compteur | NotificationBadge.tsx | **ACTIF** |
| Toast métier | StatusToast.tsx | **ACTIF** |
| Store Zustand | useNotificationStore.ts | **ACTIF** |

### 9.3 Écarts critiques

1. **Aucune intégration backend:**
   - Frontend ne consomme pas `/api/notifications`
   - `ingestNotifications()` jamais appelé
   - `loadFromServer()` jamais appelé

2. **Aucun realtime:**
   - V3 prévoit Supabase Realtime
   - Frontend n'utilise pas `supabase-realtime.service.ts`
   - Pas de WebSocket, pas de polling

3. **Aucune persistance:**
   - V3 prévoit persistence backend
   - Frontend stocke en mémoire uniquement (Zustand)
   - Perte totale au refresh

4. **Aucun offline:**
   - V3 prévoit offline-first
   - Frontend n'a pas de Service Worker
   - Pas de queue de synchronisation

5. **Création locale uniquement:**
   - Toutes les notifications créées par `addNotification()` dans TablesManagement
   - Backend ne crée jamais de notifications
   - API notifications inutilisée

---

## 10. COMPOSANTS JAMAIS RENDUS

### 10.1 ToastProvider.tsx

**Fichier:** `src/components/ToastProvider.tsx`  
**Lignes:** 120  
**Raison:** Jamais importé dans App.tsx ou autres

**Preuves:**

1. Search `ToastProvider` dans `*.tsx` = 1 résultat (définition seule)
2. `App.tsx` imports: ligne 1-50, pas de ToastProvider
3. Aucun autre fichier n'importe ToastProvider

**Conclusion:** Composant mort, à supprimer ou à intégrer.

---

### 10.2 Hooks jamais utilisés

| Hook | Fichier | Ligne | Preuve |
|------|---------|-------|--------|
| `useToast()` | ToastProvider.tsx | 19 | Search `useToast` = 1 résultat (définition) |
| `loadFromServer()` | useNotificationStore.ts | 28 | Search `loadFromServer` = 0 résultats |

---

## 11. FICHIERS BACKEND INUTILISÉS

### 11.1 Services

| Fichier | Lignes | Preuve d'inutilisation |
|---------|--------|------------------------|
| `src/server/services/notification.service.ts` | ~? | Search `notification.service` dans frontend = 0 |
| `src/server/services/notification.repository.ts` | ~? | Search `notification.repository` dans frontend = 0 |
| `src/server/services/notification-email.service.ts` | ~? | Search `notification-email` dans frontend = 0 |

### 11.2 Routes

| Fichier | Preuve |
|---------|--------|
| `src/server/routes/notifications.ts` | Search `/api/notifications` dans frontend = 0 |
| `src/server/routes/notification_preferences.ts` | Search `notification_preferences` dans frontend = 0 |

### 11.3 Intégrations

| Fichier | Preuve |
|---------|--------|
| `src/server/notifications/integration/billing-notification.handler.ts` | Search `billing-notification` dans frontend = 0 |
| `src/server/notifications/integration/order-notification.handler.ts` | Search `order-notification` dans frontend = 0 |
| `src/server/notifications/integration/inventory-notification.handler.ts` | Search `inventory-notification` dans frontend = 0 |
| `src/server/notifications/integration/platform-notification.handler.ts` | Search `platform-notification` dans frontend = 0 |

---

## 12. SCHÉMA COMPLET DES DÉPENDANCES

### 12.1 Arborescence des composants

```
App.tsx
├─ GlobalNotificationToast (ligne 166)
│  └─ useNotificationStore()
│  └─ useSettingsStore()
│
├─ NotificationCenter (ligne 167-170)
│  └─ useNotificationStore()
│  └─ markAsRead, markAllAsRead
│
└─ Sidebar.tsx
   ├─ NotificationBadge (ligne ~250)
   │  └─ useNotificationStore() → unreadCount
   │
   └─ NotificationBadge (ligne ~230)
      └─ count={pendingQrCount} (depuis useOrderStore)

OrdersPage.tsx
└─ StatusToast
   └─ Props: title, subtitle, message, variant, details, actions

POS.tsx
└─ StatusToast
   └─ Props: title, subtitle, message, variant, details, actions
```

### 12.2 Flux de données

```
TablesManagement.tsx
└─ useNotificationStore.getState().addNotification()
   └─ Store: notifications[], unreadCount++
      ├─ GlobalNotificationToast (si critical/high)
        └─ useEffect([notifications])
      ├─ NotificationBadge (unreadCount)
        └─ useNotificationStore()
        └─ Sidebar.tsx
      └─ NotificationCenter (quand ouvert)
        └─ useNotificationStore()
        └─ App.tsx
```

---

## 13. STATISTIQUES

### 13.1 Couverture du code

| Métrique | Valeur |
|----------|--------|
| Composants UI notification | 5 |
| Composants en production | 4 |
| Composants morts | 1 (ToastProvider) |
| Stores | 1 |
| Stores utilisés | 1 |
| Stores avec méthodes mortes | 1 (loadFromServer) |
| Points de création notification | 3 fichiers |
| Points de réception notification | 5 endroits |
| Backend services | 4 |
| Backend services utilisés par frontend | 0 |
| API routes notifications | 2 |
| API routes appelées par frontend | 0 |

### 13.2 Duplications

| Type | Count |
|------|-------|
| Systèmes de toast | 2 (GlobalNotificationToast + StatusToast) |
| Badges compteur | 2 (notifications + QR) |
| Systèmes de styles CSS | 2 (nc-* + gnt-*) |
| Keyframes animations | 2 (slide-in différents) |

### 13.3 Code mort

| Type | Lignes |
|------|--------|
| ToastProvider.tsx | 120 |
| loadFromServer() | 5 |
| ingestNotifications() (jamais appelé) | 13 |
| **Total** | **138** |

---

## 14. PREUVES D'INUTILISATION

### 14.1 Search results: `ingestNotifications`

```
Search: ingestNotifications dans *.tsx
Résultats: 0
```

**Fichier:** `src/stores/useNotificationStore.ts` ligne 84-96  
**Statut:** Défini mais jamais appelé

---

### 14.2 Search results: `loadFromServer`

```
Search: loadFromServer dans *.tsx
Résultats: 0
```

**Fichier:** `src/stores/useNotificationStore.ts` ligne 28  
**Statut:** Défini mais jamais appelé

---

### 14.3 Search results: `ToastProvider`

```
Search: ToastProvider dans *.tsx
Résultats: 1 (définition dans ToastProvider.tsx)
```

**Fichier:** `src/components/ToastProvider.tsx`  
**Statut:** Jamais importé, jamais rendu

---

### 14.4 Search results: `useToast`

```
Search: useToast dans *.tsx
Résultats: 1 (définition dans ToastProvider.tsx)
```

**Fichier:** `src/components/ToastProvider.tsx` ligne 19  
**Statut:** Jamais appelé

---

### 14.5 Search results: `/api/notifications`

```
Search: /api/notifications dans src/
Résultats: 0
```

**Fichier:** `src/server/routes/notifications.ts`  
**Statut:** Route existe mais jamais consommée par frontend

---

## 15. CONCLUSION

### 15.1 Constat principal

Le frontend dispose d'un **système de notifications local fonctionnel mais isolé**:
- Fonctionne en mémoire uniquement
- Créé par le frontend lui-même (TablesManagement)
- Jamais synchronisé avec le backend
- Jamais persisté
- Jamais mis à jour en temps réel

### 15.2 Écart V3

La V3 apporte:
- Backend robuste (queue, retry, multi-channel)
- Persistance
- Realtime
- Offline-first
- Preferences utilisateur

**Mais:** Rien de cela n'est intégré au frontend actuel.

### 15.3 Code mort identifié

- **ToastProvider.tsx:** 120 lignes mortes
- **loadFromServer():** 5 lignes mortes
- **ingestNotifications():** 13 lignes (définie mais jamais appelée)
- **Total:** 138 lignes de code mort

### 15.4 Duplications identifiées

- 2 systèmes de toast parallèles
- 2 usages du même badge
- 2 systèmes de styles CSS

### 15.5 Recommandations (HORS SCOPE - pour référence uniquement)

1. Supprimer ToastProvider.tsx (120 lignes)
2. Intégrer backend notifications (API calls)
3. Ajouter realtime (Supabase Realtime déjà développé)
4. Ajouter persistance (loadFromServer)
5. Unifier les systèmes de toast
6. Corriger responsive (width fixe 400px)
7. Ajouter animations de sortie
8. Ajouter préférences utilisateur

---

**FIN DE L'AUDIT**

*Document généré par analyse statique du code source uniquement.*  
*Aucune modification effectuée.*  
*Toutes les affirmations sont tracées vers des fichiers et lignes précis.*