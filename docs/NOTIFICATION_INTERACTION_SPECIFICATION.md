# NOTIFICATION INTERACTION SPECIFICATION — EKALA

**Version:** 1.0.0  
**Date:** 29 Juin 2026  
**Statut:** OFFICIEL  
**Niveau:** Stripe, GitHub, Linear, Slack, Notion, Microsoft Teams  
**Framework:** Agnostic (React, Vue, Flutter, React Native, Electron)

---

## TABLE DES MATIÈRES

1. [Cycle de vie complet](#1-cycle-de-vie-complet)
2. [États visuels officiels](#2-états-visuels-officiels)
3. [Comportement des Toasts](#3-comportement-des-toasts)
4. [Comportement du Notification Center](#4-comportement-du-notification-center)
5. [Badge Behavior](#5-badge-behavior)
6. [Quick Actions](#6-quick-actions)
7. [Fusion intelligente](#7-fusion-intelligente)
8. [Anti-spam](#8-anti-spam)
9. [Offline UX](#9-offline-ux)
10. [Real Time UX](#10-real-time-ux)
11. [Mobile UX](#11-mobile-ux)
12. [Desktop UX](#12-desktop-ux)
13. [Accessibility](#13-accessibility)
14. [Notification Timing](#14-notification-timing)
15. [Interaction Matrix](#15-interaction-matrix)
16. [Error UX](#16-error-ux)
17. [User Journey](#17-user-journey)
18. [Micro-interactions](#18-micro-interactions)
19. [UX Metrics](#19-ux-metrics)
20. [Checklists QA](#20-checklists-qa)

---

## 1. CYCLE DE VIE COMPLET

### 1.1 États du cycle

```
┌─────────────┐
│   CREATED   │ ← Notification créée par système/utilisateur
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   QUEUED    │ ← En attente d'affichage (si limite atteinte)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  DISPLAYED  │ ← Affichée à l'utilisateur (toast/badge/center)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    READ     │ ← Consultée par l'utilisateur
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  PROCESSED  │ ← Action effectuée (approve, reject, etc.)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  ARCHIVED   │ ← Archivée (auto ou manuel)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  DELETED    │ ← Supprimée définitivement
└─────────────┘

États alternatifs:
┌─────────────┐
│  EXPIRED    │ ← Expirée (timeout automatique)
└─────────────┘

┌─────────────┐
│   FAILED    │ ← Échec d'envoi/affichage
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  RETRYING   │ ← Nouvelle tentative
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  FAILED     │ ← Échec définitif (après 3 tentatives)
└─────────────┘
```

### 1.2 Transitions

| De | Vers | Déclencheur | Automatique? |
|-----|------|-------------|--------------|
| CREATED | QUEUED | Limite de toasts atteinte | Oui |
| CREATED | DISPLAYED | Affichage immédiat | Oui |
| QUEUED | DISPLAYED | Place disponible | Oui |
| DISPLAYED | READ | Clic utilisateur | Non |
| DISPLAYED | EXPIRED | Timeout (si auto-dismiss) | Oui |
| DISPLAYED | DISMISSED | Clic X / Swipe | Non |
| READ | PROCESSED | Action utilisateur | Non |
| READ | ARCHIVED | Auto (après X jours) | Oui |
| PROCESSED | ARCHIVED | Auto | Oui |
| ARCHIVED | DELETED | Auto (après X jours) | Oui |
| ARCHIVED | DELETED | Manuel | Non |
| FAILED | RETRYING | Retry automatique | Oui |
| RETRYING | DISPLAYED | Succès | Oui |
| RETRYING | FAILED | Échec (3 tentatives) | Oui |

### 1.3 Règles de transition

**CREATED → DISPLAYED:**
- Si priority = critical/high → Toast immédiat
- Si priority = medium → Badge seulement
- Si priority = low → Center seulement
- Si limite toasts atteinte → Queue

**DISPLAYED → READ:**
- Clic sur notification
- Clic sur "Tout lire"
- Ouverture NotificationCenter

**READ → ARCHIVED:**
- Auto après 30 jours
- Manuel via menu

**ARCHIVED → DELETED:**
- Auto après 90 jours
- Manuel via menu

---

## 2. ÉTATS VISUELS OFFICIELS

### 2.1 États visuels

| État | Nom | Couleur fond | Couleur bordure | Couleur texte | Icône | Animation |
|------|-----|--------------|-----------------|---------------|-------|-----------|
| `unread` | Non lu | Légèrement coloré (priority bg) | Priorité | Primaire | Point orange (3px) | Pulse |
| `read` | Lu | Gris foncé (#16161f) | Aucune | Secondaire | Aucune | Aucune |
| `actionable` | Action possible | Surface (#16161f) | Priorité | Primaire | Icône action | Hover |
| `processing` | En traitement | Surface + spinner | Priorité (animée) | Primaire | Spinner | Rotation |
| `completed` | Terminé | Vert bg (#10b981 0.12) | Vert (#10b981) | Primaire | CheckCircle | Aucune |
| `failed` | Échec | Rouge bg (#ef4444 0.12) | Rouge (#ef4444) | Primaire | XCircle | Shake |
| `snoozed` | Repoussé | Gris bg (#6b7280 0.1) | Gris (#6b7280) | Tertiaire | Clock | Aucune |
| `muted` | Muet | Surface (#16161f) | Aucune | Tertiaire | VolumeX | Aucune |
| `archived` | Archivé | Masqué par défaut | Aucune | Aucune | Archive | Aucune |

### 2.2 Indicateurs visuels par état

**Unread:**
- Point orange (3px) en haut à gauche
- Fond légèrement coloré (priority bg)
- Bordure gauche 3px (priority color)

**Read:**
- Pas de point
- Fond gris (#16161f)
- Opacity 0.7
- Texte secondaire

**Actionable:**
- Background hover (#1e1e2a)
- Curseur pointer
- Bordure priorité au hover

**Processing:**
- Spinner animé (rotation 1s infinite)
- Bordure priorité pulsante
- Opacity 0.8

**Completed:**
- Checkmark vert
- Background vert bg
- Pas d'action disponible

**Failed:**
- XCircle rouge
- Background rouge bg
- Animation shake (0.5s)
- Bouton "Retry" disponible

**Snoozed:**
- Clock icône
- Background gris
- Texte "Repoussé à [date]"
- Bouton "Annuler" disponible

**Muted:**
- VolumeX icône
- Background gris
- Texte "Notifications muettes"
- Bouton "Réactiver" disponible

**Archived:**
- Masqué par défaut
- Visible via filtre "Archivées"
- Icône Archive

### 2.3 Transitions d'état

**Unread → Read:**
- Animation: fadeOut point (200ms)
- Animation: background transition (200ms)

**Read → Unread (nouvelle notification):**
- Animation: fadeIn point (200ms)
- Animation: background transition (200ms)

**Actionable → Processing:**
- Animation: spinner appear (200ms)
- Animation: border pulse (infinite)

**Processing → Completed:**
- Animation: spinner → checkmark (300ms)
- Animation: background vert (300ms)

**Processing → Failed:**
- Animation: shake (500ms)
- Animation: background rouge (300ms)

---

## 3. COMPORTEMENT DES TOASTS

### 3.1 Apparition

**Déclencheurs:**
- Nouvelle notification critical/high
- Erreur système
- Action importante

**Animation:**
```
Timeline: 0ms → 240ms
De: translateX(100%) + opacity(0)
Vers: translateX(0) + opacity(1)
Easing: cubic-bezier(0.16, 1, 0.3, 1)
```

**Position:**
- Desktop: top-right, 20px margin
- Tablet: top-right, 16px margin
- Mobile: top, 12px margin, full width
- POS: top, 12px margin, full width

**Z-index:** 999999 (au-dessus de tout)

**Stack:**
- Max 3 toasts simultanés
- Nouveau toast en haut
- Anciens toasts décalent vers le bas

### 3.2 Durée selon priorité

| Priorité | Durée auto-dismiss | Comportement |
|----------|-------------------|--------------|
| Critical | 0ms (jamais) | Reste jusqu'à action utilisateur |
| High | 8000ms | Auto-dismiss après 8s |
| Medium | 4000ms | Auto-dismiss après 4s |
| Low | 0ms (jamais) | Pas de toast, badge seulement |

**Exceptions:**
- Toast avec action: +2000ms
- Toast avec détails: +2000ms
- Toast en erreur: 6000ms

### 3.3 Pile maximum

**Règle:** Max 3 toasts simultanés

**Comportement:**
- 4ème toast → 1er toast disparaît (fadeOut 200ms)
- 5ème toast → 2ème toast disparaît
- etc.

**Priorité:**
- Critical remplace toujours
- High remplace medium/low
- Medium remplace low

**Animation de remplacement:**
```
Toast existant: slideOut (200ms)
Nouveau toast: slideIn (240ms)
Délai: 100ms entre sortie et entrée
```

### 3.4 Remplacement

**Quand remplacer:**
- Même type de notification (ex: 2x "Stock faible")
- Même priorité
- Même catégorie

**Comment:**
- Ancien toast: fadeOut (200ms)
- Nouveau toast: slideIn (240ms)
- Mise à jour du compteur

**Quand ne pas remplacer:**
- Priorité différente
- Catégorie différente
- Action en cours sur ancien toast

### 3.5 Fusion

**Règles de fusion:**

| Condition | Action |
|-----------|--------|
| Même titre + même catégorie + < 5min | Fusionner |
| Même titre + même catégorie + > 5min | Séparer |
| Priorité différente | Séparer |
| Action en cours | Séparer |

**Exemple de fusion:**
```
Avant:
- "3 nouvelles commandes" (order, medium, 10:00)
- "2 nouvelles commandes" (order, medium, 10:02)

Après:
- "5 nouvelles commandes" (order, medium, 10:00)
  Message: "5 commandes en attente"
  Counter: 5
```

**Comportement:**
- Toast existant: update message (fade 200ms)
- Badge: increment count
- Center: merge notifications

### 3.6 Fermeture

**Méthodes de fermeture:**

| Méthode | Platform | Animation | Durée |
|---------|----------|-----------|-------|
| Clic X | Tous | slideOut | 200ms |
| Swipe right | Mobile | slideOut | 200ms |
| Escape | Desktop | slideOut | 200ms |
| Auto-dismiss | Tous | slideOut | 200ms |
| Clic notification | Tous | slideOut | 200ms |

**Comportement:**
- Animation sortie: slideOut (200ms)
- Puis suppression du DOM
- Puis markAsRead (si non lu)

### 3.7 Pause au hover

**Déclencheur:** Hover sur toast

**Comportement:**
- Pause auto-dismiss
- Pause progress bar
- Affichage tooltip "Cliquer pour ouvrir"

**Durée:** Tant que hover

**Reprise:**
- Mouse leave → resume auto-dismiss
- Clic → dismiss immédiat

### 3.8 Pause au focus

**Déclencheur:** Focus sur toast (keyboard)

**Comportement:**
- Pause auto-dismiss
- Pause progress bar
- Affichage outline focus

**Durée:** Tant que focus

**Reprise:**
- Blur → resume auto-dismiss
- Enter → dismiss immédiat
- Escape → dismiss immédiat

---

## 4. COMPORTEMENT DU NOTIFICATION CENTER

### 4.1 Groupement

**Par défaut:** Par date

**Groupes:**
- "Aujourd'hui"
- "Hier"
- "Cette semaine"
- "Mois précédent"
- "Plus ancien"

**Règles:**
- Groupe "Aujourd'hui": notifications créées aujourd'hui
- Groupe "Hier": notifications créées hier
- Groupe "Cette semaine": notifications créées cette semaine (hier exclus)
- Groupe "Mois précédent": notifications créées le mois dernier
- Groupe "Plus ancien": tout le reste

**Affichage:**
```
┌─────────────────────────────┐
│ Aujourd'hui                 │
│  ┌─────────────────────┐    │
│  │ Notification 1      │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ Notification 2      │    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│ Hier                        │
│  ┌─────────────────────┐    │
│  │ Notification 3      │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

### 4.2 Tri

**Par défaut:** Date décroissante (plus récent en haut)

**Options de tri:**
- Date (défaut)
- Priorité (critical → low)
- Catégorie (alphabétique)
- Sévérité (error → success)

**Règles:**
- Tri stable (même ordre pour éléments égaux)
- Date: timestamp.createdAt
- Priorité: critical > high > medium > low
- Catégorie: ordre alphabétique
- Sévérité: error > warning > info > success

### 4.3 Sections

**Sections fixes:**

**Header:**
- Titre "Notifications"
- Badge compteur non lues
- Bouton fermer (X)
- Bouton "Tout lire"

**Search:**
- Barre de recherche
- Placeholder "Rechercher..."
- Filtre temps réel (300ms debounce)

**Filters:**
- Chips de filtre
- Catégories: System, Order, Inventory, Table, Staff, Billing, Platform
- Priorités: Critical, High, Medium, Low
- États: Unread, Read, Archived

**Tabs:**
- "Toutes" (défaut)
- "Non lues" (unread seulement)

**List:**
- Notifications groupées par date
- Scrollable
- Lazy loading (infinite scroll)

**Footer:**
- "X notifications non lues"
- "Données stockées localement"
- Dernière sync: "Il y a X min"

### 4.4 Pagination

**Type:** Infinite scroll

**Règles:**
- Load 20 notifications à la fois
- Trigger: scroll à 80% de la hauteur
- Loading indicator pendant fetch
- Fin de liste: "Toutes les notifications chargées"

**Performance:**
- Virtualisation si > 100 notifications
- Lazy loading des images/avatars
- Cache des pages chargées

### 4.5 Lazy loading

**Déclencheur:** Scroll à 80% de hauteur

**Comportement:**
- Affichage skeleton (3 items)
- Fetch notifications suivantes
- Remplacement skeleton par contenu
- Animation: fadeIn (200ms)

**Cache:**
- Mise en cache des pages chargées
- Réutilisation si retour en arrière
- Invalidation après 5min

### 4.6 Scroll restoration

**Règle:** Restaurer position après fermeture/réouverture

**Comportement:**
- Sauvegarde position avant fermeture
- Restauration après réouverture
- Si nouvelle notification → scroll en haut

**Exceptions:**
- Si filtre changé → scroll en haut
- Si recherche → scroll en haut
- Si > 5min écoulées → scroll en haut

### 4.7 Unread separator

**Position:** Entre notifications lues et non lues

**Apparence:**
```
┌─────────────────────────────┐
│ ▸ Non lues                  │  ← Séparateur (sticky)
├─────────────────────────────┤
│ Notification non lue 1      │
│ Notification non lue 2      │
├─────────────────────────────┤
│ ▸ Lues                      │  ← Séparateur (sticky)
├─────────────────────────────┤
│ Notification lue 1          │
│ Notification lue 2          │
└─────────────────────────────┘
```

**Comportement:**
- Sticky au scroll
- Collapse si section vide
- Animation: fadeIn (200ms)

### 4.8 Keyboard navigation

**Raccourcis:**

| Raccourci | Action |
|-----------|--------|
| `N` | Ouvrir/fermer NotificationCenter |
| `M` | Marquer tout comme lu |
| `Escape` | Fermer NotificationCenter |
| `Arrow Up` | Notification précédente |
| `Arrow Down` | Notification suivante |
| `Enter` | Ouvrir notification |
| `Space` | Marquer comme lu |
| `Delete` | Archiver notification |
| `A` | Archiver |
| `R` | Marquer comme lu |

**Navigation:**
- Tab: Navigation entre éléments
- Shift + Tab: Navigation inverse
- Arrow keys: Navigation dans liste
- Home: Première notification
- End: Dernière notification

**Focus:**
- Focus trap dans NotificationCenter
- Focus sur premier élément à l'ouverture
- Focus sur bouton fermer à la fermeture

---

## 5. BADGE BEHAVIOR

### 5.1 Animation

**Animation pulse:**

```
Timeline: 0ms → 2400ms (loop)
De: scale(1)
Via: scale(1.1) @ 1200ms
Vers: scale(1) @ 2400ms
Easing: ease-in-out
```

**Déclencheur:** count > 0

**Arrêt:** count === 0

**Performance:**
- GPU accelerated (transform)
- Pas de layout shift
- Pause si tab inactive

### 5.2 Seuils

| Count | Affichage | Animation |
|-------|-----------|-----------|
| 0 | Caché | Aucune |
| 1-9 | Nombre | Pulse |
| 10-99 | Nombre | Pulse |
| 100+ | "99+" | Pulse |
| 1000+ | "999+" | Pulse |

**Règles:**
- Max affiché: 999
- Au-delà: "999+"
- Si count === 0: cacher badge

### 5.3 Changement de couleur

**Couleur par défaut:** Rouge (#ef4444)

**Couleur custom:**
- QR count: Orange (#f59e0b)
- Autre: Selon contexte

**Transition:**
- Animation: background 200ms
- Pas de flash

### 5.4 Compteur

**Format:**
- 0: Caché
- 1-999: Nombre exact
- 1000+: "999+"

**Mise à jour:**
- Instantanée (pas d'animation)
- Smooth transition (opacity 100ms)

### 5.5 Overflow

**Comportement:**
- Max width: 24px
- Max height: 24px
- Text overflow: ellipsis
- Padding: 0 4px

**Exemples:**
- "9" → 18px badge
- "99" → 22px badge
- "999+" → 24px badge

### 5.6 Disparition

**Animation:**
```
Timeline: 0ms → 200ms
De: opacity(1) + scale(1)
Vers: opacity(0) + scale(0.8)
Easing: ease-in
```

**Déclencheur:** count === 0

**Comportement:**
- Animation sortie (200ms)
- Puis display: none
- Pas de layout shift

---

## 6. QUICK ACTIONS

### 6.1 Actions par type d'événement

#### Order Events

**Nouvelle commande (newOrder)**
- Primary: "Voir commande" (Eye)
- Secondary: "Assigner" (UserPlus)
- Dismiss: "Ignorer" (X)

**Commande prête (orderReady)**
- Primary: "Voir commande" (Eye)
- Secondary: "Assigner serveur" (UserPlus)
- Dismiss: "Ignorer" (X)

**Paiement échoué (paymentFailed)**
- Primary: "Réessayer" (RefreshCw)
- Secondary: "Voir détails" (Eye)
- Dismiss: "Ignorer" (X)

#### Inventory Events

**Stock faible (lowStock)**
- Primary: "Commander" (ShoppingCart)
- Secondary: "Voir détails" (Eye)
- Dismiss: "Ignorer" (X)

**Rupture stock (outOfStock)**
- Primary: "Commander maintenant" (ShoppingCart)
- Secondary: "Voir alternatives" (Eye)
- Dismiss: "Ignorer" (X)

#### Table Events

**Nouvelle réservation (newReservation)**
- Primary: "Voir détails" (Eye)
- Secondary: "Assigner table" (Table)
- Dismiss: "Ignorer" (X)

**QR code scanné (qrScanned)**
- Primary: "Voir commande" (Eye)
- Secondary: "Assigner serveur" (UserPlus)
- Dismiss: "Ignorer" (X)

#### Staff Events

**Nouveau membre (newStaff)**
- Primary: "Voir profil" (Eye)
- Secondary: "Assigner rôle" (UserPlus)
- Dismiss: "Ignorer" (X)

**Congé demandé (leaveRequest)**
- Primary: "Approuver" (CheckCircle)
- Secondary: "Rejeter" (XCircle)
- Dismiss: "Ignorer" (X)

#### Billing Events

**Facture payée (invoicePaid)**
- Primary: "Voir facture" (Eye)
- Secondary: "Télécharger" (Download)
- Dismiss: "Ignorer" (X)

**Paiement échoué (paymentFailed)**
- Primary: "Réessayer" (RefreshCw)
- Secondary: "Voir détails" (Eye)
- Dismiss: "Ignorer" (X)

#### System Events

**Maintenance (maintenance)**
- Primary: "Voir détails" (Eye)
- Secondary: "Planifier" (Calendar)
- Dismiss: "Ignorer" (X)

**Erreur système (systemError)**
- Primary: "Réessayer" (RefreshCw)
- Secondary: "Voir logs" (FileText)
- Dismiss: "Ignorer" (X)

### 6.2 Règles des actions

**Primary Action:**
- Action la plus importante
- Couleur: Primary (bleu)
- Position: Droite (LTR) / Gauche (RTL)
- Max 1 par notification

**Secondary Actions:**
- Actions complémentaires
- Couleur: Secondary (gris)
- Position: Après primary
- Max 2 par notification

**Destructive Actions:**
- Actions irréversibles
- Couleur: Destructive (rouge)
- Position: Toujours en dernier
- Confirmation requise

**Confirmation:**
- Actions destructives: TOUJOURS
- Actions irréversibles: TOUJOURS
- Actions avec impact > 1h: OUI
- Autres: NON

**Labels:**
- Court: 1-2 mots
- Clair: pas de jargon
- Action-oriented: verbe infinitif

---

## 7. FUSION INTELLIGENTE

### 7.1 Quand fusionner

**Règles de fusion:**

| Condition | Fusion? | Raison |
|-----------|---------|--------|
| Même titre + même catégorie + < 5min | OUI | Éviter spam |
| Même titre + même catégorie + 5-15min | OUI | Éviter spam |
| Même titre + même catégorie + > 15min | NON | Trop ancien |
| Même catégorie + même type + < 5min | OUI | Regrouper |
| Priorité différente | NON | Changer priorité |
| Action en cours sur ancien | NON | Conflit |

**Exemples de fusion:**

**Exemple 1: Commandes**
```
10:00 - "3 nouvelles commandes" (order, medium)
10:02 - "2 nouvelles commandes" (order, medium)
10:04 - "1 nouvelle commande" (order, medium)

Fusionné:
10:00 - "6 nouvelles commandes" (order, medium)
Message: "6 commandes en attente de traitement"
Counter: 6
```

**Exemple 2: Stock**
```
10:00 - "Stock faible: Produit A" (inventory, high)
10:05 - "Stock faible: Produit B" (inventory, high)
10:10 - "Stock faible: Produit C" (inventory, high)

Fusionné:
10:00 - "3 produits en stock faible" (inventory, high)
Message: "Produits A, B, C nécessitent un réapprovisionnement"
Counter: 3
```

**Exemple 3: Pas de fusion**
```
10:00 - "Paiement échoué" (billing, critical)
10:02 - "Stock faible" (inventory, high)

Pas fusionné: catégories différentes
```

### 7.2 Quand ne pas fusionner

**Ne pas fusionner si:**
- Priorité différente
- Catégorie différente
- Type d'événement différent
- Action en cours sur ancienne notification
- > 15min d'écart
- Notification déjà lue

### 7.3 Évolution du compteur

**Règles:**
- Fusion: somme des counts
- Séparation: compteur par notification
- Dismiss: décrément compteur
- Read: pas de changement compteur

**Exemple:**
```
Avant fusion:
- Notif 1: count = 3
- Notif 2: count = 2

Après fusion:
- Notif fusionnée: count = 5
```

### 7.4 Évolution des messages

**Règles:**
- 1-2 items: liste complète
- 3-5 items: liste partielle + "et X autres"
- 6+ items: "X éléments"

**Exemples:**
```
1 item: "Nouvelle commande #1234"
2 items: "Nouvelles commandes #1234, #1235"
3 items: "Nouvelles commandes #1234, #1235, #1236"
5 items: "5 nouvelles commandes (#1234, #1235, #1236, #1237, #1238)"
10 items: "10 nouvelles commandes (+5 autres)"
```

---

## 8. ANTI-SPAM

### 8.1 Cooldown

**Définition:** Délai minimum entre deux notifications identiques

**Règles:**
- Même type + même catégorie: 5min cooldown
- Même type + catégorie différente: pas de cooldown
- Critical: pas de cooldown
- High: 2min cooldown
- Medium: 5min cooldown
- Low: 15min cooldown

**Exemple:**
```
10:00 - "Stock faible: Produit A" (envoyé)
10:02 - "Stock faible: Produit A" (cooldown 5min → bloqué)
10:05 - "Stock faible: Produit A" (cooldown terminé → envoyé)
```

### 8.2 Debounce

**Définition:** Regrouper notifications similaires en une seule

**Règles:**
- Fenêtre: 5min
- Même type + même catégorie: regrouper
- Mise à jour du message
- Mise à jour du compteur

**Exemple:**
```
10:00 - Event 1 (newOrder)
10:01 - Event 2 (newOrder)
10:02 - Event 3 (newOrder)
10:03 - Event 4 (newOrder)
10:04 - Event 5 (newOrder)

Résultat après 5min:
- 1 notification: "5 nouvelles commandes"
- Count: 5
```

### 8.3 Batch

**Définition:** Envoyer notifications par batch

**Règles:**
- Batch size: 10 notifications max
- Interval: 30s entre batches
- Priorité: critical/high immédiat, medium/low batch

**Exemple:**
```
10:00 - 15 notifications créées
10:00 - Batch 1: 10 notifications (immédiat)
10:00 - Batch 2: 5 notifications (30s plus tard)
```

### 8.4 Digest

**Définition:** Résumé périodique de notifications

**Règles:**
- Fréquence: toutes les heures
- Si > 10 notifications: envoyer digest
- Format: "X nouvelles notifications: [liste]"

**Exemple:**
```
10:00 - Digest: "12 nouvelles notifications:
- 5 commandes
- 3 alertes stock
- 2 demandes congé
- 2 erreurs système"
```

### 8.5 Rate limiting

**Règles:**
- Max 10 notifications/heure/utilisateur
- Max 3 toasts simultanés
- Max 50 notifications/jour/utilisateur

**Comportement:**
- Dépassement: queue + retard
- Critical: bypass rate limit
- High: bypass si < 5min depuis dernière

### 8.6 Priority override

**Règles:**
- Critical: bypass tous les filtres
- High: bypass cooldown
- Medium: respecte cooldown
- Low: respecte cooldown + batch

**Exemple:**
```
10:00 - Notification medium (cooldown 5min)
10:01 - Notification critical (bypass → immédiat)
10:02 - Notification medium (cooldown toujours actif → bloqué)
10:05 - Notification medium (cooldown terminé → envoyé)
```

---

## 9. OFFLINE UX

### 9.1 Notifications créées offline

**Comportement:**
- Affichage immédiat (local)
- Icône "hors-ligne" dans toast
- Queue pour sync
- Pas d'auto-dismiss

**Indicateur:**
```
┌─────────────────────────────┐
│ ⚠️ Hors-ligne               │
│ Notification créée localement│
└─────────────────────────────┘
```

**Sync:**
- Au retour online: sync automatique
- Indicateur "Synchronisation..."
- Succès: "Synchronisé"
- Échec: "Échec sync, nouvelle tentative..."

### 9.2 Notifications reçues offline

**Comportement:**
- Stockage en queue
- Affichage au retour online
- Ordre chronologique
- Pas de perte

**Indicateur:**
```
Badge: "3" (avec icône hors-ligne)
Toast: "3 notifications reçues hors-ligne"
```

### 9.3 Sync

**Process:**
1. Détection retour online
2. Fetch notifications (API)
3. Merge avec cache local
4. Envoi actions en queue
5. Mise à jour UI
6. Indicateur "Synchronisé"

**Durée:** < 2s

**Conflits:**
- Last write wins (par défaut)
- Merge si possible
- Notification conflit (rare)

### 9.4 Conflits

**Détection:**
- Même notification, versions différentes
- Timestamp différent
- Contenu différent

**Résolution:**
- Last write wins (timestamp serveur)
- Merge des champs non conflictuels
- Notification conflit si impossible

**Exemple:**
```
Local: Notification lue à 10:00
Serveur: Notification lue à 10:05
Résolution: Serveur gagne (10:05)
```

### 9.5 Pending state

**Affichage:**
- Badge: compteur avec icône "pending"
- Toast: "X actions en attente"
- Center: section "Actions en attente"

**Comportement:**
- Actions en queue
- Retry automatique
- Indicateur progression

### 9.6 Failed sync

**Affichage:**
- Toast: "Échec de synchronisation"
- Badge: icône erreur
- Center: section "Échecs"

**Comportement:**
- Retry automatique (3 fois)
- Backoff: 1s, 2s, 4s
- Dead letter queue après 3 échecs
- Bouton "Réessayer" manuel

### 9.7 Replay

**Déclencheur:** Retour online après offline prolongé (> 1h)

**Comportement:**
1. Fetch toutes notifications manquées
2. Trier par date
3. Afficher progressivement (1 par 500ms)
4. Animation: slideIn pour chaque
5. Max 10 toasts, reste dans center

**Exemple:**
```
Offline: 2h
Retour online:
- Fetch 50 notifications manquées
- Afficher 10 toasts (1 par 500ms)
- Ajouter 40 au center
- Badge: "50" (avec animation)
```

---

## 10. REAL TIME UX

### 10.1 Animation d'arrivée

**Nouvelle notification (Realtime):**

```
Timeline: 0ms → 240ms
De: translateY(-20px) + opacity(0)
Vers: translateY(0) + opacity(1)
Easing: cubic-bezier(0.16, 1, 0.3, 1)
```

**Position:**
- Toast: En haut de la pile
- Center: En haut de la liste
- Badge: Animation pulse

**Son:**
- Critical: bip urgent
- High: bip moyen
- Medium: pas de son
- Low: pas de son

### 10.2 Ordre

**Règles:**
- Par date décroissante (plus récent en haut)
- Si même timestamp: par priorité
- Si même priorité: par ID

**Affichage:**
- Toast: nouveau en haut de pile
- Center: nouveau en haut de liste
- Badge: increment immédiat

### 10.3 Collision

**Définition:** Deux notifications arrivent en même temps

**Règles:**
- Priorité la plus haute gagne
- Si même priorité: première créée gagne
- Seconde: queue + affichage après 500ms

**Exemple:**
```
10:00:00 - Notification A (high)
10:00:00 - Notification B (high)
Résultat:
- A affichée immédiatement
- B affichée après 500ms
```

### 10.4 Double notification

**Détection:**
- Même ID
- Même titre
- Même catégorie
- < 5min d'écart

**Comportement:**
- Fusion automatique
- Update message
- Increment count

**Exemple:**
```
10:00 - "Nouvelle commande" (ID: 123)
10:02 - "Nouvelle commande" (ID: 123) ← Double
Résultat: Fusionné en "2 nouvelles commandes"
```

### 10.5 Latence

**Objectifs:**
- Toast: < 500ms
- Badge: < 200ms
- Center: < 1000ms
- Realtime: < 1000ms

**Mesure:**
- Time to visible (TTV)
- Time to interactive (TTI)
- Time to action (TTA)

**Optimisation:**
- Optimistic UI
- Cache local
- Lazy loading

### 10.6 Optimistic UI

**Principe:** Afficher avant confirmation serveur

**Règles:**
- Action utilisateur → affichage immédiat
- Background sync avec serveur
- Rollback si erreur

**Exemple:**
```
User: Clic "Marquer comme lu"
UI: Immédiat (optimistic)
Backend: Sync (500ms)
Succès: Confirmé
Échec: Rollback + toast erreur
```

---

## 11. MOBILE UX

### 11.1 Swipe

**Swipe right (toast):**
- Déclencheur: swipe > 50% width
- Action: dismiss
- Animation: slideOut (200ms)
- Feedback: haptique (si activé)

**Swipe down (center):**
- Déclencheur: swipe > 30% height
- Action: fermer center
- Animation: slideDown (260ms)
- Feedback: haptique (si activé)

**Swipe left (card):**
- Déclencheur: swipe > 30% width
- Action: afficher actions rapides
- Actions: Archive, Delete, Mute

### 11.2 Vibration

**Règles:**
- Critical: vibration longue (500ms)
- High: vibration moyenne (300ms)
- Medium: vibration courte (100ms)
- Low: pas de vibration

**Patterns:**
- Critical: `[100, 50, 100, 50, 100]`
- High: `[200, 100, 200]`
- Medium: `[100]`

**Respecter préférences:**
- Si utilisateur désactivé: pas de vibration
- Si device ne supporte pas: pas d'erreur

### 11.3 Push

**Types:**
- APNS (iOS)
- FCM (Android)
- Web Push (PWA)

**Permissions:**
- Demande au premier lancement
- Rappel si refusé
- Instructions si bloqué

**Payload:**
- Title: 50 chars max
- Body: 150 chars max
- Data: ID, priority, category

**Comportement:**
- Foreground: toast in-app
- Background: notification système
- Killed: notification système

### 11.4 Deep link

**Format:**
```
ekala://notification/{id}
ekala://order/{orderId}
ekala://table/{tableId}
```

**Comportement:**
- Clic notification → deep link
- App ouverte → navigation
- App fermée → ouverture + navigation

**Fallback:**
- Si deep link échoue → page par défaut
- Si ressource inexistante → center

### 11.5 Foreground

**Comportement:**
- Toast in-app
- Badge update
- Center update
- Pas de notification système

**Animation:**
- Toast: slideIn (240ms)
- Badge: pulse (2400ms)
- Center: fadeIn (200ms)

### 11.6 Background

**Comportement:**
- Notification système
- Badge update
- Center update (au retour)

**Notification système:**
- Title + body
- Icône app
- Actions rapides (si supporté)

### 11.7 Killed app

**Comportement:**
- Notification système
- Badge update
- Center update (au redémarrage)

**Récupération:**
- Au lancement: fetch notifications
- Sync avec serveur
- Affichage toasts manqués

---

## 12. DESKTOP UX

### 12.1 Hover

**Sur badge:**
- Tooltip: "X notifications non lues"
- Animation: scale(1.1) (150ms)
- Cursor: pointer

**Sur toast:**
- Background: plus clair (#1e1e2a)
- Shadow: plus prononcée
- Cursor: pointer
- Pause auto-dismiss

**Sur card:**
- Background: plus clair (#1e1e2a)
- Bordure: priorité
- Cursor: pointer
- Actions apparaissent

### 12.2 Focus

**Sur badge:**
- Outline: 2px solid #f59e0b
- Offset: 2px

**Sur toast:**
- Outline: 2px solid #f59e0b
- Offset: 2px
- Pause auto-dismiss

**Sur card:**
- Outline: 2px solid #f59e0b
- Offset: 2px
- Background: plus clair

**Sur button:**
- Outline: 2px solid #f59e0b
- Offset: 2px
- Background: hover

### 12.3 Keyboard

**Raccourcis globaux:**
- `N`: Ouvrir/fermer center
- `M`: Marquer tout comme lu
- `Escape`: Fermer center/toast

**Navigation center:**
- `Tab`: Élément suivant
- `Shift + Tab`: Élément précédent
- `Arrow Up/Down`: Navigation liste
- `Enter`: Ouvrir notification
- `Space`: Marquer comme lu
- `Delete`: Archiver

### 12.4 Multi-window

**Comportement:**
- Badge: partagé entre fenêtres
- Toast: affiché sur fenêtre active
- Center: indépendant par fenêtre

**Sync:**
- BroadcastChannel API
- Mise à jour temps réel
- Pas de duplication

---

## 13. ACCESSIBILITY

### 13.1 ARIA

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

### 13.2 Screen reader

**Annonces:**
- Nouvelle notification: "Nouvelle notification: [titre]"
- Notification lue: "Notification marquée comme lue"
- Notification supprimée: "Notification supprimée"
- Toast fermé: "Toast fermé"

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

### 13.3 Keyboard only

**Navigation:**
- Tab: Élément suivant
- Shift + Tab: Élément précédent
- Enter: Activer
- Escape: Fermer
- Space: Toggle
- Arrow keys: Navigation listes

**Raccourcis:**
- `N`: Ouvrir center
- `M`: Marquer tout lu
- `Escape`: Fermer
- `Arrow Up/Down`: Navigation liste

**Focus trap:**
- Center: Oui
- Toast: Non (dismiss auto)
- Banner: Non

### 13.4 Reduced motion

**Respecter préférences:**
```css
@media (prefers-reduced-motion: reduce) {
  .notification-toast {
    animation: none;
    transition: none;
  }
  
  .notification-badge {
    animation: none;
  }
  
  .notification-card {
    transition: none;
  }
}
```

**Alternative:**
- Pas d'animation
- Transition instantanée
- Feedback visuel statique

### 13.5 High contrast

**Support:**
```css
@media (prefers-contrast: high) {
  .notification-toast {
    border: 2px solid;
  }
  
  .notification-badge {
    border: 2px solid;
  }
}
```

**Règles:**
- Contraste: 7:1 minimum
- Bordures: 2px minimum
- Pas de transparence

---

## 14. NOTIFICATION TIMING

### 14.1 Durées officielles

| Type | Durée | Usage |
|------|-------|-------|
| Toast auto-dismiss | 4000ms | Par défaut |
| Toast critical | 0ms (jamais) | Critical seulement |
| Toast high | 8000ms | High |
| Toast medium | 4000ms | Medium |
| Toast error | 6000ms | Erreur |
| Toast warning | 5000ms | Warning |
| Animation entrée toast | 240ms | Tous toasts |
| Animation sortie toast | 200ms | Tous toasts |
| Animation drawer | 260ms | Center |
| Animation banner | 200ms | Banner |
| Pulse badge | 2400ms | Badge non lu |
| Polling interval | 30000ms | Realtime fallback |
| Cooldown medium | 300000ms (5min) | Anti-spam |
| Cooldown high | 120000ms (2min) | Anti-spam |
| Cooldown low | 900000ms (15min) | Anti-spam |
| Debounce | 300ms | Search |
| Hover delay | 0ms | Instant |
| Tooltip delay | 500ms | Tooltip |
| Retry delay | 1000ms | 1ère tentative |
| Retry delay | 2000ms | 2ème tentative |
| Retry delay | 4000ms | 3ème tentative |
| Auto-archive | 2592000000ms (30 jours) | Auto |
| Auto-delete | 7776000000ms (90 jours) | Auto |

### 14.2 Timings par contexte

**Toast:**
- Apparition: 0ms (immédiat)
- Auto-dismiss: 4000ms (défaut)
- Fermeture: 200ms
- Total: 4200ms (défaut)

**Badge:**
- Update: 0ms (immédiat)
- Animation: 2400ms (loop)

**Center:**
- Ouverture: 260ms
- Fermeture: 260ms
- Load: 1000ms (max)

**Realtime:**
- Latence: < 1000ms
- Retry: 1000ms, 2000ms, 4000ms

---

## 15. INTERACTION MATRIX

### 15.1 Matrice complète

| Événement | Priorité | Composant | Comportement | Durée | Animation | Action principale | Action secondaire |
|-----------|----------|-----------|--------------|-------|-----------|-------------------|-------------------|
| newOrder | critical | Toast + Badge | Affichage immédiat | 0ms | slideIn 240ms | Voir commande | Assigner |
| newOrder | high | Toast + Badge | Affichage immédiat | 8000ms | slideIn 240ms | Voir commande | Assigner |
| newOrder | medium | Badge | Update compteur | - | pulse 2400ms | - | - |
| newOrder | low | Center | Ajouter liste | - | fadeIn 200ms | - | - |
| paymentFailed | critical | Toast + Badge | Affichage immédiat | 0ms | slideIn 240ms | Réessayer | Voir détails |
| paymentFailed | high | Toast + Badge | Affichage immédiat | 8000ms | slideIn 240ms | Réessayer | Voir détails |
| lowStock | high | Toast + Badge | Affichage immédiat | 8000ms | slideIn 240ms | Commander | Voir détails |
| lowStock | medium | Badge | Update compteur | - | pulse 2400ms | - | - |
| systemError | critical | Toast + Badge | Affichage immédiat | 0ms | slideIn 240ms | Réessayer | Voir logs |
| systemError | high | Toast + Badge | Affichage immédiat | 8000ms | slideIn 240ms | Réessayer | Voir logs |
| maintenance | medium | Banner | Affichage sticky | - | slideDown 200ms | Voir détails | - |
| maintenance | low | Center | Ajouter liste | - | fadeIn 200ms | - | - |

### 15.2 Règles de la matrice

**Priorité → Composant:**
- Critical: Toast + Badge + Son + Vibration
- High: Toast + Badge + Son
- Medium: Badge seulement
- Low: Center seulement

**Priorité → Durée:**
- Critical: 0ms (jamais auto)
- High: 8000ms
- Medium: 4000ms
- Low: 0ms (pas de toast)

**Priorité → Animation:**
- Critical: slideIn 240ms + pulse
- High: slideIn 240ms
- Medium: pulse 2400ms
- Low: fadeIn 200ms

---

## 16. ERROR UX

### 16.1 Notification impossible

**Causes:**
- Quota dépassé
- Service down
- Erreur réseau

**Comportement:**
- Toast erreur: "Impossible d'afficher la notification"
- Retry automatique (3 fois)
- Fallback: affichage dans center

**Message:**
```
"Impossible d'afficher cette notification.
Nouvelle tentative dans 5s..."
```

### 16.2 Channel failure

**Canaux:**
- Toast (in-app)
- Badge (in-app)
- Push (APNS/FCM)
- Email
- SMS
- Webhook

**Comportement:**
- Toast: toujours fonctionnel
- Badge: toujours fonctionnel
- Push: fallback sur toast
- Email: queue + retry
- SMS: queue + retry
- Webhook: queue + retry

**Fallback:**
- Push échoue → toast in-app
- Email échoue → retry 3x puis dead letter
- SMS échoue → retry 3x puis dead letter

### 16.3 Retry

**Stratégie:**
- Max 3 tentatives
- Backoff: 1s, 2s, 4s
- Exponential backoff

**Affichage:**
- Toast: "Nouvelle tentative dans Xs..."
- Badge: icône retry
- Center: statut "En attente"

**Succès:**
- Toast: "Notification envoyée"
- Badge: update normal
- Center: statut "Envoyé"

**Échec:**
- Toast: "Échec de l'envoi"
- Badge: icône erreur
- Center: statut "Échec"

### 16.4 Fallback

**Hiérarchie:**
1. Toast (in-app)
2. Badge (in-app)
3. Push (système)
4. Email
5. SMS

**Comportement:**
- Si toast échoue → badge
- Si badge échoue → push
- Si push échoue → email
- Si email échoue → SMS

### 16.5 Queue full

**Limite:** 100 notifications en queue

**Comportement:**
- Rejet nouvelle notification
- Toast: "Trop de notifications. Réessayez plus tard."
- Log: erreur queue pleine

**Priorité:**
- Critical: bypass queue
- High: bypass si < 10 en queue
- Medium: respecte limite
- Low: respecte limite

### 16.6 Offline

**Comportement:**
- Queue des notifications
- Affichage cache
- Indicateur hors-ligne

**Indicateur:**
```
┌─────────────────────────────┐
│ ⚠️ Mode hors-ligne          │
│ Les notifications seront     │
│ synchronisées au retour.     │
└─────────────────────────────┘
```

### 16.7 Error states

**Network error:**
- Toast: "Erreur réseau. Vérifiez votre connexion."
- Retry automatique
- Fallback: cache

**Server error:**
- Toast: "Erreur serveur. Réessayez dans quelques minutes."
- Retry automatique
- Fallback: cache

**Timeout:**
- Toast: "Délai dépassé. Réessayez."
- Retry automatique
- Fallback: cache

---

## 17. USER JOURNEY

### 17.1 Owner

**Connexion:**
1. Login → Dashboard
2. Voir toast (si critical/high)
3. Voir badge dans sidebar

**Actions typiques:**
- Ouvrir center (clic Bell)
- Voir toutes notifications
- Filtrer par catégorie
- Marquer comme lu
- Actions rapides (approve, reject, etc.)

**Parcours:**
```
Login → Dashboard
  → Toast critique (si existe)
  → Badge (si non lues)
  → Clic Bell → Center
    → Voir notifications
    → Filtrer
    → Marquer lu
    → Actions
  → Navigation
```

### 17.2 Admin

**Même parcours que Owner**

**Actions supplémentaires:**
- Gérer utilisateurs
- Configurer système
- Voir logs

### 17.3 Manager

**Connexion:**
1. Login → Dashboard
2. Voir toast (si critical/high)
3. Voir badge

**Actions typiques:**
- Voir notifications équipe
- Approuver demandes
- Gérer stock

**Restrictions:**
- Pas d'accès platform
- Pas de paramètres système

### 17.4 Cashier

**Connexion:**
1. Login → Dashboard
2. Voir toast (si critical/high)
3. Voir badge

**Actions typiques:**
- Voir notifications ventes
- Paiements
- Commandes

**Restrictions:**
- Pas de gestion stock
- Pas de gestion équipe
- Pas de paramètres

### 17.5 Waiter

**Connexion:**
1. Login → Dashboard
2. Voir toast (si critical/high)
3. Voir badge

**Actions typiques:**
- Voir notifications commandes
- QR codes
- Assignation tables

**Restrictions:**
- Accès limité (POS, Orders, Tables)
- Pas de ventes
- Pas de stock

---

## 18. MICRO-INTERACTIONS

### 18.1 Animations

**Toast slideIn:**
```
Timeline: 0ms → 240ms
De: translateX(100%) + opacity(0)
Vers: translateX(0) + opacity(1)
Easing: cubic-bezier(0.16, 1, 0.3, 1)
```

**Toast slideOut:**
```
Timeline: 0ms → 200ms
De: translateX(0) + opacity(1)
Vers: translateX(100%) + opacity(0)
Easing: ease-in
```

**Badge pulse:**
```
Timeline: 0ms → 2400ms (loop)
De: scale(1)
Via: scale(1.1) @ 1200ms
Vers: scale(1) @ 2400ms
Easing: ease-in-out
```

**Card hover:**
```
Timeline: 0ms → 130ms
De: background(#16161f)
Vers: background(#1e1e2a)
Easing: ease-out
```

**Button hover:**
```
Timeline: 0ms → 150ms
De: background(transparent)
Vers: background(#1e1e2a)
Easing: ease-out
```

**Progress bar:**
```
Timeline: 0ms → 4000ms
De: width(100%)
Vers: width(0%)
Easing: linear
```

### 18.2 Transitions

**Background:**
- Durée: 130ms
- Easing: ease-out

**Opacity:**
- Durée: 200ms
- Easing: ease-in-out

**Transform:**
- Durée: 240ms
- Easing: cubic-bezier(0.16, 1, 0.3, 1)

**Border:**
- Durée: 200ms
- Easing: ease-out

### 18.3 Feedback

**Hover:**
- Background change
- Cursor change
- Shadow change

**Active:**
- Scale(0.98)
- Shadow réduit
- Durée: 100ms

**Focus:**
- Outline: 2px solid #f59e0b
- Offset: 2px
- Durée: 0ms (immédiat)

**Loading:**
- Spinner rotation (1s infinite)
- Opacity 0.7
- Cursor: wait

**Success:**
- Checkmark appear (300ms)
- Background vert (300ms)
- Son (si activé)

**Error:**
- Shake (500ms)
- Background rouge (300ms)
- Son (si activé)

---

## 19. UX METRICS

### 19.1 Métriques officielles

**Performance:**
- Time to Visible (TTV): < 500ms
- Time to Interactive (TTI): < 1000ms
- Time to Action (TTA): < 2000ms
- Animation FPS: 60fps

**Engagement:**
- Notification open rate: > 60%
- Notification click rate: > 40%
- Notification dismiss rate: < 20%
- Notification action rate: > 30%

**Satisfaction:**
- User satisfaction: > 4/5
- Notification spam score: < 2/10
- User control score: > 4/5

**Technical:**
- Error rate: < 1%
- Offline sync rate: > 99%
- Realtime latency: < 1000ms
- Bundle size: < 50KB

### 19.2 Mesures

**TTV (Time to Visible):**
- Début: création notification
- Fin: affichage toast/badge
- Objectif: < 500ms

**TTI (Time to Interactive):**
- Début: affichage
- Fin: utilisateur peut interagir
- Objectif: < 1000ms

**TTA (Time to Action):**
- Début: affichage
- Fin: action utilisateur
- Objectif: < 2000ms

**FPS:**
- Mesure: animations par seconde
- Objectif: 60fps constant
- Minimum: 30fps

### 19.3 Seuils

**Critiques:**
- TTV > 1000ms: CRITIQUE
- TTI > 2000ms: CRITIQUE
- TTA > 5000ms: CRITIQUE
- FPS < 30: CRITIQUE

**Warnings:**
- TTV > 500ms: WARNING
- TTI > 1000ms: WARNING
- TTA > 2000ms: WARNING
- FPS < 50: WARNING

---

## 20. CHECKLISTS QA

### 20.1 Checklist UX

**Avant de créer une notification:**
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

### 20.2 Checklist fonctionnelle

**Toast:**
- [ ] Apparaît correctement
- [ ] Animation entrée fluide
- [ ] Auto-dismiss fonctionne
- [ ] Fermeture manuelle fonctionne
- [ ] Pause au hover fonctionne
- [ ] Pause au focus fonctionne
- [ ] Max 3 toasts simultanés
- [ ] Stack correct
- [ ] Fusion fonctionne
- [ ] Actions fonctionnent

**Badge:**
- [ ] Compteur correct
- [ ] Animation pulse fonctionne
- [ ] Couleur correcte
- [ ] Disparition à 0
- [ ] Tooltip fonctionne

**Center:**
- [ ] Ouverture/fermeture fonctionne
- [ ] Groupement par date fonctionne
- [ ] Tri fonctionne
- [ ] Filtres fonctionnent
- [ ] Search fonctionne
- [ ] Pagination fonctionne
- [ ] Lazy loading fonctionne
- [ ] Scroll restoration fonctionne
- [ ] Keyboard navigation fonctionne

### 20.3 Checklist responsive

**Desktop (> 768px):**
- [ ] Toast: 360px, top-right
- [ ] Center: drawer 400px
- [ ] Badge: 18px min
- [ ] Hover fonctionne
- [ ] Focus fonctionne
- [ ] Keyboard fonctionne

**Tablet (768px - 1920px):**
- [ ] Toast: 320px, top-right
- [ ] Center: drawer 100vw
- [ ] Badge: 18px min
- [ ] Swipe down fonctionne
- [ ] Tap outside fonctionne

**Mobile (< 768px):**
- [ ] Toast: 100vw, top
- [ ] Center: fullscreen
- [ ] Badge: 18px min
- [ ] Swipe right fonctionne
- [ ] Swipe down fonctionne
- [ ] Pull to refresh fonctionne
- [ ] Long press fonctionne

**POS (800px):**
- [ ] Toast: 100vw, top
- [ ] Center: fullscreen
- [ ] Badge: 18px min
- [ ] Tactile fonctionne
- [ ] Gros boutons (44px min)
- [ ] Contraste élevé
- [ ] Feedback haptique

### 20.4 Checklist accessibilité

**WCAG AA:**
- [ ] Contraste 4.5:1 minimum
- [ ] Focus visible
- [ ] Navigation clavier complète
- [ ] Screen reader testé
- [ ] Reduced motion respecté

**ARIA:**
- [ ] Roles corrects
- [ ] Labels présents
- [ ] States corrects
- [ ] Live regions correctes

**Tests:**
- [ ] axe DevTools: 0 erreur
- [ ] WAVE: 0 erreur
- [ ] Lighthouse: > 90
- [ ] NVDA: testé
- [ ] VoiceOver: testé

### 20.5 Checklist offline

**Online:**
- [ ] Toutes fonctionnalités
- [ ] Realtime actif
- [ ] Sync automatique

**Offline:**
- [ ] Lecture seulement
- [ ] Affichage cache
- [ ] Queue actions
- [ ] Indicateur offline

**Reconnecting:**
- [ ] Indicateur reconnexion
- [ ] Queue actions
- [ ] Retry automatique
- [ ] Backoff exponentiel

**Sync:**
- [ ] Sync au retour online
- [ ] Merge correct
- [ ] Indicateur "Synchronisé"
- [ ] Gestion conflits

### 20.6 Checklist performance

**Objectifs:**
- [ ] TTV < 500ms
- [ ] TTI < 1000ms
- [ ] TTA < 2000ms
- [ ] FPS 60 constant
- [ ] Bundle < 50KB
- [ ] Mémoire < 50MB

**Tests:**
- [ ] 100 notifications: < 100ms
- [ ] 1000 notifications: < 500ms
- [ ] Scroll 60fps
- [ ] Pas de memory leak
- [ ] Pas de layout shift

---

## CONCLUSION

Cette spécification définit le comportement UX officiel des notifications Ekala.

**Règles:**
- ✅ Suivre ces spécifications
- ✅ Respecter ces comportements
- ✅ Tester sur tous les devices
- ❌ Ne pas inventer de nouveaux comportements
- ❌ Ne pas ignorer l'accessibilité

**Portée:**
- Framework agnostic
- Device agnostic
- Language agnostic

**Utilisation:**
- Développeurs: implémentation
- Designers: validation UX
- QA: tests et vérification
- Product: spécification produit

**Prochaine étape:**
Implémenter selon ces spécifications.

---

**FIN DU DOCUMENT**

*Ce document est la référence définitive pour le comportement UX des notifications Ekala.*  
*Toute implémentation, quel que soit le framework, doit respecter ces spécifications.*  
*Toute dérogation doit être validée par le Product Designer et le Design System Architect.*