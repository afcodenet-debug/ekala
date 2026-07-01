# NOTIFICATION UX GUIDELINES — EKALA

**Version:** 1.0.0  
**Date:** 29 Juin 2026  
**Statut:** OFFICIEL

---

## TABLE DES MATIÈRES

1. [UX Patterns](#1-ux-patterns)
2. [Actions Library](#2-actions-library)
3. [Responsive Strategy](#3-responsive-strategy)
4. [Offline First](#4-offline-first)
5. [Accessibility](#5-accessibility)
6. [Inspirations & Choix](#6-inspirations--choix)

---

## 1. UX PATTERNS

### 1.1 Toast Pattern

**Définition:** Notification temporaire qui apparaît en overlay et disparaît automatiquement.

**Quand l'utiliser:**
- Notifications critiques/high nécessitant une action immédiate
- Erreurs bloquantes
- Confirmations d'actions importantes
- Feedback immédiat

**Quand ne jamais l'utiliser:**
- Informations générales (utiliser Banner)
- Notifications persistantes (utiliser Center)
- Historique (utiliser Timeline)

**Variantes:**
- `default`: Toast standard avec auto-dismiss
- `critical`: Rouge, pas d'auto-dismiss, vibration
- `high`: Orange, auto-dismiss 8s, son
- `success`: Vert, auto-dismiss 4s, pas de son
- `error`: Rouge, auto-dismiss 6s, son
- `warning`: Orange, auto-dismiss 5s, pas de son

**Comportement:**
- Apparaît en haut à droite (desktop) ou en haut (mobile)
- Se ferme automatiquement après duration (sauf critical)
- Clic → navigate vers link
- Swipe right (mobile) → dismiss
- Escape → dismiss
- Max 3 toasts simultanés
- Stack: nouveau toast en haut

**Inspiration:**
- Stripe: Toast élégant avec progression
- Linear: Toast minimaliste
- Shopify: Toast avec undo action

**Choix Ekala:**
- Barre de priorité pulsante (unique)
- Progress bar optionnelle
- Footer avec label priorité
- Support swipe to dismiss

---

### 1.2 Banner Pattern

**Définition:** Bandeau horizontal persistant en haut de page.

**Quand l'utiliser:**
- Maintenance système planifiée
- Alertes globales (ex: "Mode maintenance dans 2h")
- Informations importantes persistantes
- Promotions temporaires

**Quand ne jamais l'utiliser:**
- Notifications temporaires (utiliser Toast)
- Notifications individuelles (utiliser Center)
- Erreurs critiques (utiliser Toast)

**Variantes:**
- `info`: Bleu, information
- `warning`: Orange, attention
- `error`: Rouge, erreur
- `success`: Vert, succès
- `dismissible`: Avec bouton fermer
- `sticky`: Reste en haut au scroll

**Comportement:**
- Pleine largeur
- En haut de page
- Peut être dismissible
- Peut être sticky
- Animation: slideDown (entrée), slideUp (sortie)

**Inspiration:**
- GitHub: Banner de maintenance
- Linear: Banner d'annonce
- Notion: Banner d'information

---

### 1.3 Drawer Pattern

**Définition:** Panneau coulissant depuis le bord de l'écran.

**Quand l'utiliser:**
- Centre de notifications complet
- Inbox
- Historique
- Filtres avancés

**Quand ne jamais l'utiliser:**
- Notifications temporaires (utiliser Toast)
- Alertes persistantes (utiliser Banner)

**Variantes:**
- `right`: Depuis droite (défaut)
- `left`: Depuis gauche
- `bottom`: Depuis bas (mobile)
- `fullscreen`: Plein écran (mobile)

**Comportement:**
- Backdrop semi-transparent
- Swipe down (mobile) → fermer
- Tap outside → fermer
- Escape → fermer
- Focus trap
- Scroll interne

**Inspiration:**
- Linear: Drawer minimaliste
- Slack: Drawer avec filtres
- GitHub: Drawer avec timeline

**Choix Ekala:**
- Drawer depuis droite (400px desktop)
- Tabs: Toutes / Non lues
- Bouton "Tout lire"
- Footer avec info stockage local

---

### 1.4 Inbox Pattern

**Définition:** Collection de toutes les notifications avec filtres et recherche.

**Quand l'utiliser:**
- Consultation de l'historique
- Filtrage par catégorie/priorité
- Recherche
- Marquage comme lu

**Quand ne jamais l'utiliser:**
- Notifications urgentes (utiliser Toast)
- Alertes persistantes (utiliser Banner)

**Structure:**
```
┌─────────────────────────────┐
│ Header (Badge + Title)      │
├─────────────────────────────┤
│ Search Bar                  │
├─────────────────────────────┤
│ Filter Chips                │
├─────────────────────────────┤
│ Tabs: Toutes | Non lues     │
├─────────────────────────────┤
│ Notification List           │
│  - Card 1                   │
│  - Card 2                   │
│  - Card 3                   │
│  - ...                      │
├─────────────────────────────┤
│ Footer (Mark all as read)   │
└─────────────────────────────┘
```

**Inspiration:**
- Slack: Inbox avec filtres
- GitHub: Inbox avec timeline
- Linear: Inbox minimaliste

---

### 1.5 Timeline Pattern

**Définition:** Liste chronologique de notifications groupées par date.

**Quand l'utiliser:**
- Historique des notifications
- Activité récente
- Audit trail
- Timeline d'événements

**Quand ne jamais l'utiliser:**
- Inbox (utiliser NotificationCenter)
- Notifications urgentes (utiliser Toast)

**Structure:**
```
┌─────────────────────────────┐
│ Aujourd'hui                 │
│  ┌─────────────────────┐    │
│  │ Notification Card 1 │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ Notification Card 2 │    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│ Hier                        │
│  ┌─────────────────────┐    │
│  │ Notification Card 3 │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

**Inspiration:**
- GitHub: Activity timeline
- Linear: Timeline minimaliste
- Notion: Timeline avec groupes

---

### 1.6 Feed Pattern

**Définition:** Flux continu de notifications en temps réel.

**Quand l'utiliser:**
- Notifications en temps réel
- Flux d'activité
- Live updates

**Quand ne jamais l'utiliser:**
- Historique (utiliser Timeline)
- Inbox (utiliser Center)

**Comportement:**
- Nouvelles notifications apparaissent en haut
- Animation: slideIn
- Infinite scroll
- Pull to refresh

**Inspiration:**
- Twitter: Feed timeline
- Slack: Channel feed
- Discord: Message feed

---

### 1.7 Snackbar Pattern

**Définition:** Toast avec action intégrée (Material Design).

**Quand l'utiliser:**
- Actions rapides (undo, retry, etc.)
- Feedback avec possibilité d'action
- Confirmations

**Quand ne jamais l'utiliser:**
- Informations simples (utiliser Toast)
- Erreurs critiques (utiliser Toast)

**Structure:**
```
┌─────────────────────────────┐
│ Message text        [Action]│
└─────────────────────────────┘
```

**Inspiration:**
- Material Design: Snackbar
- Shopify: Toast avec undo

---

### 1.8 Inline Alert Pattern

**Définition:** Alerte intégrée dans le contenu de la page.

**Quand l'utiliser:**
- Erreurs de formulaire
- Avertissements contextuels
- Informations liées à une section

**Quand ne jamais l'utiliser:**
- Notifications globales (utiliser Banner)
- Notifications temporaires (utiliser Toast)

**Variantes:**
- `inline`: Dans le flux
- `card`: Dans une card
- `banner`: En haut de section

**Inspiration:**
- GitHub: Inline alert dans forms
- Linear: Inline alert dans settings

---

## 2. ACTIONS LIBRARY

### 2.1 Actions standard

| Action | Icône | Couleur | Usage | Confirmation |
|--------|-------|---------|-------|--------------|
| Open | ExternalLink | Primary | Ouvrir ressource | Non |
| View Details | Eye | Primary | Voir détails | Non |
| Approve | CheckCircle | Success | Approuver | Oui |
| Reject | XCircle | Error | Rejeter | Oui |
| Retry | RefreshCw | Warning | Réessayer | Non |
| Renew | RotateCcw | Info | Renouveler | Oui |
| Assign | UserPlus | Primary | Assigner | Non |
| Escalate | ArrowUp | Warning | Escalader | Oui |
| Archive | Archive | Secondary | Archiver | Non |
| Dismiss | X | Secondary | Rejeter | Non |
| Mute | VolumeX | Secondary | Muet | Non |
| Snooze | Clock | Secondary | Reporter | Non |
| Mark as Read | Check | Secondary | Marquer lu | Non |
| Mark all as Read | CheckCheck | Secondary | Tout marquer lu | Non |
| Delete | Trash2 | Destructive | Supprimer | Oui |
| Edit | Edit2 | Primary | Modifier | Non |

### 2.2 Règles des actions

**Couleurs:**
- Primary: Action principale (bleu)
- Success: Action positive (vert)
- Warning: Action attention (orange)
- Error: Action destructive (rouge)
- Secondary: Action neutre (gris)
- Destructive: Action irréversible (rouge foncé)

**Confirmation:**
- Actions destructives: TOUJOURS confirmer
- Actions irréversibles: TOUJOURS confirmer
- Actions avec impact: confirmer si impact > 1h de travail

**Position:**
- Primary action: droite (LTR) / gauche (RTL)
- Destructive action: toujours en dernier
- Max 3 actions par notification

**Labels:**
- Court: 1-2 mots
- Clair: pas de jargon
- Action-oriented: verbe à l'infinitif

**Inspiration:**
- Linear: Actions minimalistes
- GitHub: Actions contextuelles
- Slack: Actions avec icons

---

## 3. RESPONSIVE STRATEGY

### 3.1 Desktop (> 768px)

**Composants:**
- NotificationToast: 360px, top-right
- NotificationCenter: Drawer 400px, droite
- NotificationBadge: 18px min
- NotificationBanner: Pleine largeur

**Layout:**
```
┌────────────────────────────────────┐
│                                    │
│  [Toast]                    [Badge]│
│                                    │
│         [Center Drawer 400px]      │
│                                    │
└────────────────────────────────────┘
```

**Interactions:**
- Souris: hover, click
- Clavier: Tab, Enter, Escape
- Pas de swipe

---

### 3.2 Tablet (768px - 1920px)

**Composants:**
- NotificationToast: 320px, top-right
- NotificationCenter: Drawer 100vw
- NotificationBadge: 18px min
- NotificationBanner: Pleine largeur

**Layout:**
```
┌────────────────────────────────────┐
│                                    │
│  [Toast]                    [Badge]│
│                                    │
│      [Center Drawer 100vw]         │
│                                    │
└────────────────────────────────────┘
```

**Interactions:**
- Tactile + souris
- Swipe down pour fermer center
- Tap outside pour fermer

---

### 3.3 Mobile (< 768px)

**Composants:**
- NotificationToast: 100vw, top
- NotificationCenter: Fullscreen
- NotificationBadge: 18px min
- NotificationBanner: Pleine largeur

**Layout:**
```
┌────────────────────────────────────┐
│ [Toast]                      [Badge]│
│                                    │
│      [Center Fullscreen]           │
│                                    │
│      - Search                      │
│      - Filters                     │
│      - List                        │
│                                    │
└────────────────────────────────────┘
```

**Interactions:**
- Tactile uniquement
- Swipe right: dismiss toast
- Swipe down: fermer center
- Pull to refresh
- Long press: menu actions

---

### 3.4 POS (800px)

**Composants:**
- NotificationToast: 100vw, top
- NotificationCenter: Fullscreen
- NotificationBadge: 18px min
- NotificationBanner: Pleine largeur

**Spécificités:**
- Tactile uniquement
- Gros boutons (min 44px)
- Contraste élevé
- Feedback haptique

**Layout:**
```
┌────────────────────────────────────┐
│ [Toast]                      [Badge]│
│                                    │
│      [Center Fullscreen]           │
│                                    │
│      - Gros boutons                │
│      - Feedback tactile            │
│                                    │
└────────────────────────────────────┘
```

---

## 4. OFFLINE FIRST

### 4.1 États réseau

**Online:**
- Toutes les fonctionnalités
- Realtime actif
- Sync automatique

**Offline:**
- Lecture seulement
- Affichage cache
- Queue des actions
- Indicateur offline

**Reconnecting:**
- Indicateur de reconnexion
- Queue des actions
- Retry automatique
- Backoff exponentiel

**Error:**
- Message d'erreur
- Retry manuel
- Fallback

### 4.2 Expérience offline

**Toast:**
- Affiche si notification en cache
- Pas de progression
- Indicateur "hors-ligne"

**Badge:**
- Affiche count en cache
- Pas de mise à jour

**Center:**
- Affiche cache
- Message "Mode hors-ligne"
- Pas de fetch

**Actions:**
- Queue des actions (mark as read, etc.)
- Retry au retour online
- Indicateur "X actions en attente"

### 4.3 Synchronisation

**Au retour online:**
1. Sync des notifications (fetch API)
2. Envoi des actions en queue
3. Mise à jour UI
4. Indicateur "Synchronisé"

**Conflits:**
- Last write wins (par défaut)
- Merge si possible
- Notification de conflit (rare)

**Queue:**
- Max 100 actions en queue
- Retry 3 fois
- Backoff: 1s, 2s, 4s
- Dead letter queue après 3 échecs

**Inspiration:**
- Linear: Offline indicator
- Notion: Sync status
- Slack: Reconnecting indicator

---

## 5. ACCESSIBILITY

### 5.1 WCAG AA

**Contraste:**
- Texte normal: 4.5:1 minimum
- Texte large: 3:1 minimum
- Composants UI: 3:1 minimum

**Vérification:**
```css
/* Exemples de couleurs conformes */
--notification-textPrimary: #e8e8f2; /* 15.8:1 sur #0f0f17 */
--notification-textSecondary: #7b7b95; /* 5.2:1 sur #0f0f17 */
--notification-critical: #ef4444; /* 4.6:1 sur blanc */
```

**Focus:**
- Focus visible sur tous les éléments interactifs
- Focus ring: 2px solid #f59e0b
- Focus trap dans modals/drawers

**Navigation:**
- Tab order logique
- Skip links (optionnel)
- Arrow keys pour listes

### 5.2 ARIA

**Roles:**
- Toast: `role="alert"`, `aria-live="assertive"`
- Banner: `role="banner"`, `aria-live="polite"`
- Center: `role="dialog"`, `aria-label="Centre de notifications"`
- Badge: `role="status"`, `aria-live="polite"`
- Card: `role="article"`, `aria-label` dynamique
- Button: `role="button"`, `aria-label` dynamique

**Labels:**
```typescript
// Badge
aria-label={`${count} notifications non lues`}

// Toast
aria-label={`Notification ${priority}: ${title}`}

// Card
aria-label={`Notification du ${date}: ${title}. ${readAt ? 'Lue' : 'Non lue'}`}

// Button
aria-label={`Marquer comme lu: ${title}`}
```

**States:**
- `aria-readonly="true"` si notification lue
- `aria-expanded` pour menus
- `aria-selected` pour filtres
- `aria-busy="true"` pendant chargement

### 5.3 Screen Reader

**Annonces:**
- Nouvelle notification: "Nouvelle notification: [titre]"
- Notification lue: "Notification marquée comme lue"
- Notification supprimée: "Notification supprimée"

**Descriptions:**
```typescript
// Card
aria-description={`${priority} - ${category} - ${timestamp}`}

// Toast
aria-description={`Priorité ${priority}. ${message}`}
```

**Live regions:**
- Toast: `aria-live="assertive"` (interrompt)
- Badge: `aria-live="polite"` (attend)
- Center: `aria-live="polite"` (attend)

### 5.4 Clavier

**Navigation:**
- Tab: Élément suivant
- Shift + Tab: Élément précédent
- Enter: Activer
- Escape: Fermer
- Space: Toggle
- Arrow keys: Navigation dans listes

**Raccourcis:**
- `N`: Ouvrir centre notifications
- `M`: Marquer tout comme lu
- `Escape`: Fermer
- `Arrow Up/Down`: Navigation dans liste

**Focus trap:**
- Toast: Non (dismiss automatique)
- Center: Oui (focus reste dans drawer)
- Banner: Non

### 5.5 Reduced Motion

**Respecter préférences:**
```css
@media (prefers-reduced-motion: reduce) {
  .notification-toast {
    animation: none;
  }
  
  .notification-badge {
    animation: none;
  }
}
```

**Alternative:**
- Pas d'animation
- Transition instantanée
- Feedback visuel statique

### 5.6 Tests

**Outils:**
- axe DevTools
- WAVE
- Lighthouse
- NVDA / VoiceOver

**Checklist:**
- [ ] Contraste vérifié
- [ ] Focus visible
- [ ] Navigation clavier complète
- [ ] Screen reader testé
- [ ] Reduced motion respecté
- [ ] Labels ARIA présents
- [ ] Roles ARIA corrects

---

## 6. INSPIRATIONS & CHOIX

### 6.1 Stripe

**Ce qui est inspiré:**
- Toast élégant avec progression
- Couleurs cohérentes
- Animations fluides

**Ce qui est différent:**
- Ekala: Barre de priorité pulsante
- Ekala: Support offline
- Ekala: Multi-catégories

**Pourquoi:**
- Stripe: B2B, professionnel
- Ekala: B2B + B2C, chaleureux
- Choix: Plus accessible, plus clair

---

### 6.2 GitHub

**Ce qui est inspiré:**
- Badge simple, rouge
- Timeline d'activité
- Inbox avec filtres

**Ce qui est différent:**
- Ekala: Badge avec animation pulse
- Ekala: Toast global
- Ekala: Support mobile first

**Pourquoi:**
- GitHub: Desktop first
- Ekala: Mobile first (POS, waiter)
- Choix: Plus adaptatif

---

### 6.3 Linear

**Ce qui est inspiré:**
- Minimalisme
- Chips de filtre
- Empty state élégant

**Ce qui est différent:**
- Ekala: Plus de couleurs (7 catégories)
- Ekala: Plus d'icônes
- Ekala: Support offline

**Pourquoi:**
- Linear: Tech-savvy users
- Ekala: Tous niveaux
- Choix: Plus accessible

---

### 6.4 Slack

**Ce qui est inspiré:**
- Dot indicator
- Menu contextuel
- Inbox avec recherche

**Ce qui est différent:**
- Ekala: Badge avec compteur
- Ekala: Toast global
- Ekala: Support POS

**Pourquoi:**
- Slack: Communication
- Ekala: Business + Communication
- Choix: Plus métier

---

### 6.5 Notion

**Ce qui est inspiré:**
- Empty state avec illustration
- Tags de catégorie
- Timeline avec groupes

**Ce qui est différent:**
- Ekala: Plus de couleurs
- Ekala: Animations plus fluides
- Ekala: Support temps réel

**Pourquoi:**
- Notion: Productivité
- Ekala: Productivité + Transactionnel
- Choix: Plus dynamique

---

### 6.6 Shopify

**Ce qui est inspiré:**
- Toast avec undo
- Actions rapides
- Feedback immédiat

**Ce qui est différent:**
- Ekala: Plus de priorité
- Ekala: Plus de catégories
- Ekala: Support multi-rôles

**Pourquoi:**
- Shopify: E-commerce
- Ekala: Restaurant + SaaS
- Choix: Plus riche

---

### 6.7 Microsoft Teams

**Ce qui est inspiré:**
- Status indicator (online/offline)
- Badge avec count
- Banner d'information

**Ce qui est différent:**
- Ekala: Plus minimaliste
- Ekala: Plus de couleurs
- Ekala: Support mobile

**Pourquoi:**
- Teams: Enterprise
- Ekala: SMB + Enterprise
- Choix: Plus léger

---

### 6.8 Google Workspace

**Ce qui est inspiré:**
- Toast simple
- Badge discret
- Animations subtiles

**Ce qui est différent:**
- Ekala: Plus expressif
- Ekala: Plus de fonctionnalités
- Ekala: Support offline

**Pourquoi:**
- Google: Grand public
- Ekala: Business spécifique
- Choix: Plus métier

---

## 7. PATTERNS ANTI-PATTERNS

### 7.1 À faire (DO)

✅ **TOUJOURS:**
- Afficher max 3 toasts simultanés
- Utiliser les couleurs du Design System
- Donner une action possible
- Respecter les préférences utilisateur
- Tester sur mobile
- Respecter l'accessibilité
- Utiliser les tokens
- Documenter les composants

### 7.2 À ne pas faire (DON'T)

❌ **JAMAIS:**
- Afficher plus de 3 toasts
- Utiliser des couleurs sans signification
- Créer des notifications sans action
- Spammer l'utilisateur
- Cacher des informations critiques
- Utiliser du jargon
- Forcer une action sans confirmation
- Ignorer les préférences
- Oublier le mode offline
- Oublier l'accessibilité

---

## 8. CHECKLIST UX

### 8.1 Avant de créer une notification

- [ ] La notification est-elle nécessaire?
- [ ] La priorité est-elle correcte?
- [ ] La catégorie est-elle correcte?
- [ ] L'utilisateur peut-il agir?
- [ ] L'action est-elle claire?
- [ ] Le message est-il compréhensible?
- [ ] La notification est-elle accessible?
- [ ] La notification fonctionne offline?
- [ ] La notification est testée sur mobile?
- [ ] La notification respecte les préférences?

### 8.2 Avant de déployer

- [ ] Tests unitaires passent
- [ ] Tests d'intégration passent
- [ ] Tests accessibilité passent
- [ ] Tests mobile passent
- [ ] Tests offline passent
- [ ] Tests realtime passent
- [ ] Performance < 100ms
- [ ] Pas de régression V1
- [ ] Documentation à jour
- [ ] Équipe formée

---

## CONCLUSION

Ces guidelines définissent l'expérience utilisateur officielle des notifications Ekala.

**Règles:**
- ✅ Suivre ces patterns
- ✅ Respecter ces guidelines
- ✅ Tester sur tous les devices
- ❌ Ne pas inventer de nouveaux patterns
- ❌ Ne pas ignorer l'accessibilité

**Prochaine étape:**
Implémenter selon ces guidelines.

---

**FIN DU DOCUMENT**

*Ce document fait partie du Notification Design System officiel d'Ekala.*