# NOTIFICATION COMPONENT CATALOG — EKALA

**Version:** 1.0.0  
**Date:** 29 Juin 2026  
**Statut:** OFFICIEL

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble](#1-vue-densemble)
2. [Composants Core](#2-composants-core)
3. [Composants Display](#3-composants-display)
4. [Composants Feedback](#4-composants-feedback)
5. [Composants Container](#5-composants-container)
6. [Composants Utility](#6-composants-utility)
7. [Arborescence des composants](#7-arborescence-des-composants)
8. [Matrice d'utilisation](#8-matrice-dutilisation)

---

## 1. VUE D'ENSEMBLE

### 1.1 Philosophie des composants

**Atomic Design:**
- Atoms: Badge, Icon, Avatar, Chip
- Molecules: Toast, Card, Indicator
- Organisms: Center, Timeline, Drawer
- Templates: NotificationPage, NotificationPanel
- Pages: Inbox, Settings

**Principe de composition:**
- Chaque composant fait UNE chose
- Les composants sont composables
- Pas de logique métier dans les composants UI
- Props explicites et typées

### 1.2 Nommage

**Convention:**
- `Notification` prefix pour tous les composants
- `Notification` + Type (Badge, Toast, Card, etc.)
- Pas d'abréviation
- PascalCase

**Exemples:**
- ✅ `NotificationBadge`
- ✅ `NotificationToast`
- ✅ `NotificationCenter`
- ❌ `NotifBadge`
- ❌ `NToast`

---

## 2. COMPOSANTS CORE

### 2.1 NotificationBadge

**Responsabilité:** Afficher un compteur de notifications non lues

**Quand l'utiliser:**
- Dans la sidebar pour indiquer les notifications
- Dans le header pour indiquer les messages
- Sur les icons de navigation
- Pour afficher des compteurs (QR orders, etc.)

**Quand ne jamais l'utiliser:**
- Pour afficher du texte (utiliser NotificationChip)
- Pour afficher une icône sans compteur (utiliser NotificationIndicator)
- Dans une liste de notifications (utiliser NotificationCard)

**Variantes:**
- `default`: Rouge, compteur notifications
- `custom`: Couleur custom, compteur custom
- `dot`: Point sans compteur (si count = 1)

**Props:**
```typescript
interface NotificationBadgeProps {
  count?: number;        // Nombre à afficher (défaut: unreadCount)
  color?: string;        // Couleur custom (défaut: rouge)
  max?: number;          // Max avant "99+" (défaut: 99)
  showDot?: boolean;     // Afficher dot si count = 1
  size?: 'sm' | 'md';   // Taille (défaut: md)
}
```

**États:**
- `default`: Fond rouge, texte blanc
- `custom`: Fond custom, texte adapté
- `hidden`: count === 0

**Responsive:** Oui (inline-flex)

**Accessibilité:**
- `role="status"`
- `aria-label="X notifications non lues"`
- `aria-live="polite"`

**Animations:** Pulse si count > 0

**Comportement offline:** Affiche le count en cache

**Comportement realtime:** Se met à jour automatiquement

**Interaction clavier:** Aucune (indicatif seulement)

**Interaction tactile:** Aucune (indicatif seulement)

**Inspiration:**
- GitHub: Badge simple, rouge
- Linear: Badge avec animation pulse
- Slack: Badge avec count

**Choix Ekala:**
- Badge rouge par défaut (comme GitHub)
- Animation pulse pour attirer l'attention (comme Linear)
- Support custom color pour cas spécifiques (QR count)

---

### 2.2 NotificationIndicator

**Responsabilité:** Indicateur visuel sans compteur (point, icône)

**Quand l'utiliser:**
- Pour indiquer une nouveauté sans compteur
- Pour marquer un élément comme "nouveau"
- Pour indiquer un statut (online, offline, etc.)

**Quand ne jamais l'utiliser:**
- Pour afficher un compteur (utiliser NotificationBadge)
- Pour afficher du texte (utiliser NotificationChip)

**Variantes:**
- `dot`: Point coloré
- `icon`: Icône avec background
- `status`: Indicateur de statut (online/offline)

**Props:**
```typescript
interface NotificationIndicatorProps {
  variant?: 'dot' | 'icon' | 'status';
  color?: string;
  icon?: React.ReactNode;
  status?: 'online' | 'offline' | 'pending';
  size?: 'sm' | 'md';
}
```

**États:**
- `default`: Couleur normale
- `active`: Animation pulse
- `inactive`: Gris

**Responsive:** Oui

**Accessibilité:**
- `role="status"`
- `aria-label` dynamique

**Animations:** Pulse si active

**Inspiration:**
- Slack: Dot indicator
- Microsoft Teams: Status indicator
- Google Workspace: Online/offline dot

---

### 2.3 NotificationChip

**Responsabilité:** Afficher un label court avec couleur

**Quand l'utiliser:**
- Pour afficher une catégorie
- Pour afficher une priorité
- Pour afficher un tag
- Dans les filtres

**Quand ne jamais l'utiliser:**
- Pour afficher un compteur (utiliser NotificationBadge)
- Pour afficher une notification complète (utiliser NotificationCard)

**Variantes:**
- `priority`: Critical, High, Medium, Low
- `category`: System, Order, Inventory, etc.
- `severity`: Error, Warning, Info, Success

**Props:**
```typescript
interface NotificationChipProps {
  variant?: 'priority' | 'category' | 'severity';
  value: string;
  size?: 'sm' | 'md';
  onRemove?: () => void;
}
```

**États:**
- `default`: Couleur normale
- `selected`: Pour filtres actifs
- `disabled`: Grisé

**Responsive:** Oui (inline-flex)

**Accessibilité:**
- `role="status"`
- `aria-label` dynamique

**Animations:** Aucune

**Inspiration:**
- Linear: Chips de filtre
- Notion: Tags de catégorie
- GitHub: Labels

---

## 3. COMPOSANTS DISPLAY

### 3.1 NotificationToast

**Responsabilité:** Afficher une notification temporaire en overlay

**Quand l'utiliser:**
- Pour notifications critiques/high
- Pour erreurs bloquantes
- Pour actions urgentes
- Pour feedback immédiat

**Quand ne jamais l'utiliser:**
- Pour informations générales (utiliser NotificationCard)
- Pour notifications persistantes (utiliser NotificationBanner)
- Pour listes (utiliser NotificationCenter)

**Variantes:**
- `default`: Toast standard
- `critical`: Rouge, avec vibration
- `high`: Orange, avec son
- `success`: Vert, sans son
- `error`: Rouge, avec son
- `warning`: Orange, sans son

**Props:**
```typescript
interface NotificationToastProps {
  id: string;
  title: string;
  message?: string;
  priority?: NotificationPriority;
  severity?: NotificationSeverity;
  category?: NotificationCategory;
  icon?: React.ReactNode;
  actions?: NotificationAction[];
  link?: string;
  onClose: () => void;
  duration?: number;
  showProgress?: boolean;
}
```

**États:**
- `entering`: Animation slideIn
- `visible`: Affiché
- `exiting`: Animation slideOut
- `dismissed`: Fermé

**Responsive:** 
- Desktop: 360px
- Tablet: 320px
- Mobile: 100vw
- POS: 100vw

**Accessibilité:**
- `role="alert"`
- `aria-live="assertive"`
- `aria-label` dynamique
- Focus trap

**Animations:**
- Entrée: slideIn (240ms)
- Sortie: slideOut (200ms)
- Progress bar (si duration > 0)

**Comportement offline:** 
- Affiche si notification en cache
- Pas de progression si offline

**Comportement realtime:**
- Apparaît automatiquement
- Se ferme après duration
- Clic → navigate

**Interaction clavier:**
- Tab: Focus sur actions
- Escape: Fermer
- Enter: Action par défaut

**Interaction tactile:**
- Swipe right: Fermer
- Tap: Ouvrir link
- Long press: Options

**Inspiration:**
- Stripe: Toast élégant avec progression
- Linear: Toast minimaliste
- Slack: Toast avec actions
- Shopify: Toast avec undo

**Choix Ekala:**
- Toast avec barre de priorité pulsante (unique)
- Progress bar optionnelle
- Support swipe to dismiss (mobile)
- Footer avec label priorité

---

### 3.2 NotificationBanner

**Responsabilité:** Afficher une notification persistante en haut de page

**Quand l'utiliser:**
- Pour maintenance système
- Pour alertes globales
- Pour informations importantes persistantes
- Pour bannières de promotion

**Quand ne jamais l'utiliser:**
- Pour notifications temporaires (utiliser NotificationToast)
- Pour listes (utiliser NotificationCenter)
- Pour erreurs critiques (utiliser NotificationToast)

**Variantes:**
- `info`: Bleu, information
- `warning`: Orange, attention
- `error`: Rouge, erreur
- `success`: Vert, succès
- `dismissible`: Avec bouton fermer

**Props:**
```typescript
interface NotificationBannerProps {
  id: string;
  title: string;
  message?: string;
  severity?: NotificationSeverity;
  icon?: React.ReactNode;
  actions?: NotificationAction[];
  dismissible?: boolean;
  onDismiss?: () => void;
  sticky?: boolean;  // Reste en haut au scroll
}
```

**États:**
- `visible`: Affiché
- `dismissed`: Fermé avec animation
- `minimized`: Réduit (optionnel)

**Responsive:**
- Desktop: Pleine largeur
- Mobile: Pleine largeur
- POS: Pleine largeur

**Accessibilité:**
- `role="banner"`
- `aria-label` dynamique
- `aria-live="polite"`

**Animations:**
- Entrée: slideDown (200ms)
- Sortie: slideUp (200ms)

**Comportement offline:** Toujours visible si sticky

**Comportement realtime:** Peut apparaître dynamiquement

**Interaction clavier:**
- Tab: Focus sur actions
- Escape: Fermer (si dismissible)

**Interaction tactile:**
- Swipe down: Fermer (mobile)
- Tap: Action par défaut

**Inspiration:**
- GitHub: Banner de maintenance
- Linear: Banner d'annonce
- Notion: Banner d'information

---

### 3.3 NotificationCard

**Responsabilité:** Afficher une notification dans une liste

**Quand l'utiliser:**
- Dans NotificationCenter
- Dans NotificationTimeline
- Dans une liste de notifications
- Pour historique

**Quand ne jamais l'utiliser:**
- Pour notifications temporaires (utiliser NotificationToast)
- Pour alertes persistantes (utiliser NotificationBanner)
- Pour indicateurs simples (utiliser NotificationBadge)

**Variantes:**
- `default`: Carte standard
- `compact`: Version compacte
- `expanded`: Avec détails
- `interactive`: Cliquable

**Props:**
```typescript
interface NotificationCardProps {
  id: string;
  title: string;
  message?: string;
  timestamp: string;
  priority?: NotificationPriority;
  severity?: NotificationSeverity;
  category?: NotificationCategory;
  icon?: React.ReactNode;
  readAt?: string;
  link?: string;
  actions?: NotificationAction[];
  details?: NotificationDetail[];
  onClick?: () => void;
  onMarkAsRead?: () => void;
}
```

**États:**
- `unread`: Point orange, fond coloré
- `read`: Pas de point, fond gris
- `hover`: Background plus clair
- `selected`: Bordure colorée

**Responsive:**
- Desktop: 400px
- Tablet: 100%
- Mobile: 100%
- POS: 100%

**Accessibilité:**
- `role="article"`
- `aria-label` dynamique
- `aria-readonly` si read
- Tab index si cliquable

**Animations:**
- Hover: background transition (130ms)
- Click: feedback visuel

**Comportement offline:** Affiche depuis cache

**Comportement realtime:** Se met à jour automatiquement

**Interaction clavier:**
- Tab: Focus
- Enter: Ouvrir link
- Space: Marquer comme lu

**Interaction tactile:**
- Tap: Ouvrir link
- Long press: Menu actions
- Swipe: Actions rapides

**Inspiration:**
- Linear: Card minimaliste
- Slack: Card avec hover
- GitHub: Card avec metadata
- Notion: Card avec preview

**Choix Ekala:**
- Indicateur visuel unread (point orange)
- Badge de priorité pour high/critical
- Footer avec timestamp
- Support détails structurés

---

### 3.4 NotificationTimeline

**Responsabilité:** Afficher les notifications en ordre chronologique

**Quand l'utiliser:**
- Pour historique des notifications
- Pour activité récente
- Pour audit trail
- Pour timeline d'événements

**Quand ne jamais l'utiliser:**
- Pour inbox (utiliser NotificationCenter)
- Pour notifications urgentes (utiliser NotificationToast)
- Pour filtres (utiliser NotificationCenter)

**Variantes:**
- `default`: Timeline standard
- `compact`: Version compacte
- `grouped`: Par date
- `detailed`: Avec détails étendus

**Props:**
```typescript
interface NotificationTimelineProps {
  notifications: AppNotification[];
  groupByDate?: boolean;
  showDateSeparator?: boolean;
  maxHeight?: number;
  onItemClick: (id: string) => void;
  onLoadMore?: () => void;
}
```

**États:**
- `loading`: Skeleton
- `empty`: Empty state
- `error`: Erreur de chargement
- `loaded`: Notifications affichées

**Responsive:**
- Desktop: 600px max
- Tablet: 100%
- Mobile: 100%
- POS: 100%

**Accessibilité:**
- `role="list"`
- `aria-label="Timeline des notifications"`
- `aria-busy` si loading

**Animations:**
- Entrée: fadeIn + slideIn (staggered)
- Scroll: infinite scroll

**Comportement offline:** Affiche cache

**Comportement realtime:** Ajoute nouvelles notifications

**Interaction clavier:**
- Tab: Navigation entre items
- Enter: Ouvrir notification
- Arrow keys: Navigation

**Inspiration:**
- GitHub: Activity timeline
- Linear: Timeline minimaliste
- Notion: Timeline avec groupes

---

## 4. COMPOSANTS FEEDBACK

### 4.1 NotificationToast (déjà défini en 3.1)

### 4.2 NotificationBanner (déjà défini en 3.2)

### 4.3 NotificationSkeleton

**Responsabilité:** Afficher un placeholder pendant le chargement

**Quand l'utiliser:**
- Pendant le chargement des notifications
- Pendant le fetch API
- Pendant la synchronisation

**Quand ne jamais l'utiliser:**
- Pour notifications chargées
- Pour empty state
- Pour erreurs

**Variantes:**
- `card`: Skeleton de card
- `toast`: Skeleton de toast
- `banner`: Skeleton de banner
- `list`: Skeleton de liste

**Props:**
```typescript
interface NotificationSkeletonProps {
  variant: 'card' | 'toast' | 'banner' | 'list';
  count?: number;
  animated?: boolean;
}
```

**États:**
- `loading`: Animation shimmer
- `loaded`: Remplacé par contenu

**Responsive:** Oui

**Accessibilité:**
- `role="status"`
- `aria-label="Chargement des notifications"`

**Animations:** Shimmer effect (1.5s infinite)

**Inspiration:**
- Linear: Skeleton minimaliste
- GitHub: Skeleton avec shimmer
- Shopify: Skeleton animé

---

### 4.4 NotificationEmptyState

**Responsabilité:** Afficher un état vide quand il n'y a pas de notifications

**Quand l'utiliser:**
- Aucune notification
- Aucun résultat de recherche
- Aucune notification après filtre

**Quand ne jamais l'utiliser:**
- Pour erreurs (utiliser NotificationBanner error)
- Pour loading (utiliser NotificationSkeleton)

**Variantes:**
- `default`: Empty state standard
- `search`: Aucun résultat de recherche
- `filter`: Aucun résultat après filtre
- `offline`: Mode hors-ligne

**Props:**
```typescript
interface NotificationEmptyStateProps {
  variant?: 'default' | 'search' | 'filter' | 'offline';
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

**États:**
- `default`: Icône + texte
- `withAction`: Icône + texte + bouton

**Responsive:** Oui

**Accessibilité:**
- `role="status"`
- `aria-label` dynamique

**Animations:** Aucune

**Inspiration:**
- Linear: Empty state élégant
- Notion: Empty state avec illustration
- Slack: Empty state avec action

---

## 5. COMPOSANTS CONTAINER

### 5.1 NotificationCenter

**Responsabilité:** Panneau coulissant affichant toutes les notifications

**Quand l'utiliser:**
- Pour afficher toutes les notifications
- Pour consulter l'historique
- Pour filtrer et rechercher
- Pour marquer comme lu

**Quand ne jamais l'utiliser:**
- Pour notifications temporaires (utiliser NotificationToast)
- Pour alertes persistantes (utiliser NotificationBanner)
- Pour indicateurs simples (utiliser NotificationBadge)

**Variantes:**
- `default`: Center standard
- `compact`: Version compacte
- `fullscreen`: Plein écran (mobile)

**Props:**
```typescript
interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  maxHeight?: number;
  showFilters?: boolean;
  showSearch?: boolean;
}
```

**États:**
- `closed`: Masqué
- `opening`: Animation entrée
- `open`: Affiché
- `closing`: Animation sortie

**Responsive:**
- Desktop: 400px drawer
- Tablet: 100vw drawer
- Mobile: 100vw fullscreen
- POS: 100vw drawer

**Accessibilité:**
- `role="dialog"`
- `aria-label="Centre de notifications"`
- Focus trap
- Escape pour fermer

**Animations:**
- Backdrop: fadeIn (200ms)
- Panel: slideInRight (260ms)

**Comportement offline:** Affiche cache

**Comportement realtime:** Ajoute nouvelles notifications

**Interaction clavier:**
- Escape: Fermer
- Tab: Navigation interne
- Arrow keys: Navigation entre items

**Interaction tactile:**
- Swipe down: Fermer (mobile)
- Tap outside: Fermer
- Pull to refresh

**Inspiration:**
- Linear: Center minimaliste
- Slack: Center avec filtres
- GitHub: Center avec timeline
- Notion: Center avec groupes

**Choix Ekala:**
- Drawer depuis droite
- Tabs: Toutes / Non lues
- Bouton "Tout lire"
- Footer avec info stockage local

---

### 5.2 NotificationDrawer

**Responsabilité:** Panneau coulissant générique pour notifications

**Quand l'utiliser:**
- Pour remplacer NotificationCenter
- Pour affichage custom
- Pour intégration dans layout

**Quand ne jamais l'utiliser:**
- Pour toasts (utiliser NotificationToast)
- Pour bannières (utiliser NotificationBanner)

**Variantes:**
- `right`: Depuis droite (défaut)
- `left`: Depuis gauche
- `bottom`: Depuis bas (mobile)

**Props:**
```typescript
interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  position?: 'right' | 'left' | 'bottom';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}
```

**États:**
- `closed`: Masqué
- `opening`: Animation
- `open`: Affiché
- `closing`: Animation

**Responsive:** Adapte position et taille

**Accessibilité:**
- `role="dialog"`
- Focus trap
- Escape pour fermer

**Animations:**
- Backdrop: fadeIn
- Panel: slideIn (position dépend)

**Inspiration:**
- Material Design: Bottom sheet
- iOS: Modal sheet
- Linear: Drawer

---

## 6. COMPOSANTS UTILITY

### 6.1 NotificationAvatar

**Responsabilité:** Afficher l'avatar de l'émetteur

**Quand l'utiliser:**
- Dans NotificationCard
- Dans NotificationTimeline
- Pour notifications de staff

**Quand ne jamais l'utiliser:**
- Pour notifications système (pas d'avatar)
- Pour badges (utiliser NotificationBadge)

**Variantes:**
- `image`: Photo de profil
- `initials`: Initiales
- `icon`: Icône générique
- `category`: Icône de catégorie

**Props:**
```typescript
interface NotificationAvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}
```

**États:**
- `default`: Normal
- `loading`: Skeleton
- `error`: Fallback initials

**Responsive:** Oui

**Accessibilité:**
- `role="img"`
- `aria-label` avec nom

**Animations:** Aucune

**Inspiration:**
- GitHub: Avatar avec fallback
- Slack: Avatar avec status
- Linear: Avatar minimaliste

---

### 6.2 NotificationAction

**Responsabilité:** Bouton d'action dans une notification

**Quand l'utiliser:**
- Dans NotificationToast
- Dans NotificationCard
- Dans NotificationBanner

**Quand ne jamais l'utiliser:**
- Pour navigation (utiliser link)
- Pour indicateurs (utiliser NotificationBadge)

**Variantes:**
- `primary`: Action principale
- `secondary`: Action secondaire
- `destructive`: Action destructive
- `ghost`: Action discrète

**Props:**
```typescript
interface NotificationActionProps {
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  confirmation?: {
    title: string;
    message: string;
  };
}
```

**États:**
- `default`: Normal
- `hover`: Hover state
- `loading`: Spinner
- `disabled`: Grisé

**Responsive:** Oui

**Accessibilité:**
- `role="button"`
- `aria-label` dynamique
- Focus visible

**Animations:**
- Hover: background transition (150ms)
- Loading: spinner

**Inspiration:**
- Linear: Actions minimalistes
- Slack: Actions avec icons
- GitHub: Actions contextuelles

---

### 6.3 NotificationMenu

**Responsabilité:** Menu d'actions pour une notification

**Quand l'utiliser:**
- Sur long press (mobile)
- Sur click droit (desktop)
- Sur bouton "..." dans card

**Quand ne jamais l'utiliser:**
- Pour actions principales (utiliser NotificationAction)
- Pour filtres (utiliser NotificationFilterBar)

**Variantes:**
- `default`: Menu standard
- `compact`: Version compacte

**Props:**
```typescript
interface NotificationMenuProps {
  items: NotificationMenuItem[];
  trigger?: React.ReactNode;
  align?: 'left' | 'right';
}
```

**États:**
- `closed`: Masqué
- `open`: Affiché
- `loading`: Chargement

**Responsive:** Oui

**Accessibilité:**
- `role="menu"`
- `aria-label` dynamique
- Navigation clavier

**Animations:**
- Entrée: fadeIn + scaleIn (150ms)
- Sortie: fadeOut (100ms)

**Inspiration:**
- Linear: Menu minimaliste
- GitHub: Menu contextuel
- Notion: Menu avec icons

---

### 6.4 NotificationFilterBar

**Responsabilité:** Barre de filtres pour les notifications

**Quand l'utiliser:**
- Dans NotificationCenter
- Dans NotificationTimeline
- Pour filtrer les notifications

**Quand ne jamais l'utiliser:**
- Pour actions (utiliser NotificationAction)
- Pour recherche (utiliser NotificationSearch)

**Variantes:**
- `default`: Filtres standards
- `compact`: Version compacte
- `inline`: En ligne

**Props:**
```typescript
interface NotificationFilterBarProps {
  filters: NotificationFilter[];
  activeFilters: string[];
  onFilterChange: (filters: string[]) => void;
  variant?: 'default' | 'compact' | 'inline';
}
```

**États:**
- `default`: Filtres inactifs
- `active`: Filtres actifs
- `loading`: Chargement

**Responsive:** Oui (scroll horizontal sur mobile)

**Accessibilité:**
- `role="group"`
- `aria-label="Filtres"`
- Navigation clavier

**Animations:** Aucune

**Inspiration:**
- Linear: Filtres chips
- GitHub: Filtres dropdown
- Notion: Filtres inline

---

### 6.5 NotificationDateSeparator

**Responsabilité:** Séparateur de date dans une timeline

**Quand l'utiliser:**
- Dans NotificationTimeline
- Dans NotificationCenter (si groupByDate)
- Pour séparer les notifications par jour

**Quand ne jamais l'utiliser:**
- Dans NotificationToast
- Dans NotificationBanner

**Variantes:**
- `default`: "Aujourd'hui", "Hier", "12 Juin 2026"
- `relative`: "Il y a 2h", "Il y a 3 jours"

**Props:**
```typescript
interface NotificationDateSeparatorProps {
  date: Date;
  variant?: 'default' | 'relative';
}
```

**États:**
- `default`: Texte normal
- `sticky`: sticky au scroll (optionnel)

**Responsive:** Oui

**Accessibilité:**
- `role="separator"`
- `aria-label` avec date

**Animations:** Aucune

**Inspiration:**
- Linear: Séparateur minimaliste
- Slack: Séparateur avec ligne
- GitHub: Séparateur avec date

---

## 7. ARBORESCENCE DES COMPOSANTS

```
NotificationRoot (Provider)
├─ NotificationToast
│  ├─ NotificationAvatar
│  ├─ NotificationIcon
│  ├─ NotificationAction
│  └─ NotificationProgress
│
├─ NotificationBanner
│  ├─ NotificationIcon
│  └─ NotificationAction
│
├─ NotificationCenter (Drawer)
│  ├─ NotificationHeader
│  │  ├─ NotificationBadge
│  │  └─ NotificationButton
│  │
│  ├─ NotificationFilterBar
│  │  └─ NotificationChip
│  │
│  ├─ NotificationSearch
│  │
│  ├─ NotificationList
│  │  ├─ NotificationDateSeparator
│  │  ├─ NotificationCard
│  │  │  ├─ NotificationAvatar
│  │  │  ├─ NotificationIcon
│  │  │  ├─ NotificationChip
│  │  │  ├─ NotificationAction
│  │  │  └─ NotificationMenu
│  │  │
│  │  └─ NotificationEmptyState
│  │
│  └─ NotificationFooter
│
├─ NotificationTimeline
│  ├─ NotificationDateSeparator
│  └─ NotificationCard
│
├─ NotificationBadge
├─ NotificationIndicator
├─ NotificationChip
├─ NotificationSkeleton
└─ NotificationEmptyState
```

---

## 8. MATRICE D'UTILISATION

### 8.1 Par contexte

| Contexte | Composant principal | Composants secondaires |
|----------|---------------------|------------------------|
| Notification temporaire critique | NotificationToast | NotificationBadge, NotificationAction |
| Notification persistante | NotificationBanner | NotificationAction |
| Inbox complète | NotificationCenter | NotificationCard, NotificationFilterBar, NotificationBadge |
| Timeline historique | NotificationTimeline | NotificationCard, NotificationDateSeparator |
| Indicateur simple | NotificationBadge | - |
| Indicateur statut | NotificationIndicator | - |
| Filtre | NotificationChip | NotificationFilterBar |
| Loading | NotificationSkeleton | - |
| Empty | NotificationEmptyState | - |

### 8.2 Par device

| Device | Composants principaux | Adaptations |
|--------|----------------------|-------------|
| Desktop | NotificationToast, NotificationCenter | Drawer 400px |
| Tablet | NotificationToast, NotificationCenter | Drawer 100vw |
| Mobile | NotificationToast, NotificationCenter | Fullscreen, swipe |
| POS | NotificationToast, NotificationCenter | Fullscreen, tactile |

### 8.3 Par rôle

| Rôle | Composants | Priorités affichées |
|------|-----------|---------------------|
| Owner | Tous | Toutes (critical → low) |
| Admin | Tous | Toutes (critical → low) |
| Manager | Tous sauf platform | Critical → low |
| Cashier | Toast + Badge + Center | Critical → medium |
| Waiter | Toast + Badge + Center | Critical → medium (filtré) |

### 8.4 Par état réseau

| État | Composants | Comportement |
|------|-----------|--------------|
| Online | Tous | Temps réel |
| Offline | Toast, Badge, Center (cache) | Lecture seulement |
| Reconnecting | Toast (indicateur) | Queue des actions |
| Error | Banner | Message d'erreur |

---

## 9. COMPOSANTS À SUPPRIMER (V1)

### 9.1 ToastProvider.tsx

**Raison:** Jamais utilisé, remplacé par NotificationToast

**Impact:** 120 lignes supprimées

**Remplacement:** NotificationToast + NotificationProviderV3

---

### 9.2 StatusToast.tsx

**Raison:** Spécifique POS/Orders, à fusionner dans NotificationToast

**Impact:** ~150 lignes fusionnées

**Remplacement:** NotificationToast avec variant="warning" ou "error"

---

## 10. COMPOSANTS À CONSERVER (V1)

### 10.1 NotificationCenter.tsx

**Raison:** Fonctionnel, bien conçu

**Améliorations:**
- Ajouter responsive
- Ajouter animations sortie
- Intégrer V3 en parallèle

---

### 10.2 GlobalNotificationToast.tsx

**Raison:** Fonctionnel, bien conçu

**Améliorations:**
- Ajouter animations sortie
- Ajouter timestamp
- Intégrer V3 en parallèle

---

### 10.3 NotificationBadge.tsx

**Raison:** Fonctionnel, bien conçu

**Améliorations:**
- Ajouter accessibilité ARIA
- Intégrer V3 en parallèle

---

## 11. COMPOSANTS À CRÉER (V3)

### 11.1 Nouveaux composants

| Composant | Priorité | Raison |
|-----------|----------|--------|
| NotificationProvider | P1 | Wrapper pour V3 |
| NotificationService | P1 | API client |
| NotificationSkeleton | P1 | Loading state |
| NotificationEmptyState | P1 | Empty state |
| NotificationChip | P2 | Filtres et tags |
| NotificationIndicator | P2 | Indicateur simple |
| NotificationAvatar | P2 | Avatar émetteur |
| NotificationAction | P2 | Actions standardisées |
| NotificationMenu | P2 | Menu contextuel |
| NotificationFilterBar | P2 | Filtres avancés |
| NotificationDateSeparator | P2 | Séparateur timeline |
| NotificationBanner | P2 | Bannière persistante |
| NotificationTimeline | P3 | Timeline historique |
| NotificationDrawer | P3 | Drawer générique |

---

## 12. NORMALISATION

### 12.1 Règles d'or

1. **TOUJOURS** utiliser les composants du Design System
2. **JAMAIS** inventer de nouvelles couleurs
3. **JAMAIS** créer de composants sans spécification
4. **TOUJOURS** typer les props
5. **TOUJOURS** documenter l'accessibilité
6. **TOUJOURS** tester sur mobile
7. **TOUJOURS** respecter les tokens

### 12.2 Checklist avant création

- [ ] Le composant n'existe pas déjà?
- [ ] Le composant est dans le catalog?
- [ ] Les props sont définies?
- [ ] Les variantes sont définies?
- [ ] L'accessibilité est documentée?
- [ ] Le responsive est défini?
- [ ] Les animations sont définies?
- [ ] Le comportement offline est défini?
- [ ] Le comportement realtime est défini?

### 12.3 Processus d'ajout

1. Proposer le composant dans une issue
2. Valider avec Design System Architect
3. Ajouter au catalog
4. Créer les tokens si nécessaire
5. Implémenter avec tests
6. Documenter dans Storybook (optionnel)
7. Former l'équipe

---

## CONCLUSION

Ce catalog définit TOUS les composants de notifications officiels d'Ekala.

**Règles:**
- ✅ Utiliser ces composants
- ✅ Respecter les spécifications
- ✅ Contribuer au catalog pour nouveaux composants
- ❌ Ne pas créer de composants hors catalog
- ❌ Ne pas modifier les composants existants sans validation

**Prochaine étape:**
Implémenter les composants P0 et P1 selon les spécifications.

---

**FIN DU DOCUMENT**

*Ce document fait partie du Notification Design System officiel d'Ekala.*