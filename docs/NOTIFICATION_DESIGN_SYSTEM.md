# NOTIFICATION DESIGN SYSTEM — EKALA

**Version:** 1.0.0  
**Date:** 29 Juin 2026  
**Statut:** OFFICIEL  
**Inspirations:** Stripe, GitHub, Linear, Slack, Notion, Shopify, Microsoft Teams, Google Workspace

---

## TABLE DES MATIÈRES

1. [Philosophie](#1-philosophie)
2. [Notification Language](#2-notification-language)
3. [Design Tokens](#3-design-tokens)
4. [Component Catalog](#4-component-catalog)
5. [UX Patterns](#5-ux-patterns)
6. [Actions Library](#6-actions-library)
7. [Responsive Strategy](#7-responsive-strategy)
8. [Offline First](#8-offline-first)
9. [Accessibility](#9-accessibility)
10. [Inspirations & Choix](#10-inspirations--choix)
11. [Normalisation](#11-normalisation)
12. [Migration Guide](#12-migration-guide)

---

## 1. PHILOSOPHIE

### 1.1 Principes directeurs

**Clarté avant tout**
- Une notification = une information claire
- Pas de jargon technique
- Pas d'ambiguïté

**Respect de l'utilisateur**
- Pas de spam
- Pas de notifications inutiles
- L'utilisateur contrôle ce qu'il reçoit

**Cohérence**
- Même langage visuel partout
- Même comportement sur tous les devices
- Même expérience online/offline

**Performance**
- Affichage < 100ms
- Pas de jank
- Pas de layout shift

**Accessibilité**
- WCAG AA minimum
- Navigation clavier complète
- Screen reader friendly

### 1.2 Objectifs

1. **Réduire la charge cognitive** — L'utilisateur comprend en 2 secondes
2. **Augmenter l'efficacité** — L'utilisateur agit en 1 clic
3. **Améliorer la confiance** — L'utilisateur sait ce qui se passe
4. **Respecter le contexte** — La notification s'adapte au device et au rôle

### 1.3 Anti-patterns

❌ **NE JAMAIS:**
- Afficher plus de 3 toasts simultanés
- Utiliser des couleurs sans signification
- Créer des notifications sans action possible
- Spammer l'utilisateur
- Cacher des informations critiques
- Utiliser du jargon technique
- Forcer une action sans confirmation
- Ignorer les préférences utilisateur
- Oublier le mode offline
- Oublier l'accessibilité

---

## 2. NOTIFICATION LANGUAGE

### 2.1 Niveaux de priorité

| Priorité | Nom | Usage | Couleur | Icône | Urgence |
|----------|-----|-------|---------|-------|---------|
| P0 | **Critical** | Action immédiate requise | Rouge | AlertCircle | Immédiate |
| P1 | **High** | Action requise sous 1h | Orange | AlertTriangle | < 1h |
| P2 | **Medium** | Information importante | Bleu | Info | < 24h |
| P3 | **Low** | Information générale | Gris | Package | Aucune |

**Règles:**
- Critical: Toast + Badge + Son + Vibration
- High: Toast + Badge + Son
- Medium: Badge seulement
- Low: Centre de notifications seulement

### 2.2 Niveaux de sévérité

| Sévérité | Nom | Usage | Couleur | Exemple |
|----------|-----|-------|---------|---------|
| S0 | **Error** | Erreur bloquante | Rouge | Échec paiement |
| S1 | **Warning** | Attention requise | Orange | Stock faible |
| S2 | **Info** | Information | Bleu | Nouvelle commande |
| S3 | **Success** | Succès | Vert | Commande confirmée |

**Règles:**
- Error: Toast + Badge + Son
- Warning: Toast + Badge
- Info: Badge seulement
- Success: Badge seulement (pas de toast)

### 2.3 Catégories

| Catégorie | Code | Couleur | Usage |
|-----------|------|---------|-------|
| System | `system` | Gris | Erreurs système, maintenance |
| Order | `order` | Bleu | Commandes, paiements |
| Inventory | `inventory` | Orange | Stock, produits |
| Table | `table` | Violet | Tables, QR codes |
| Staff | `staff` | Cyan | Équipe, permissions |
| Billing | `billing` | Vert | Factures, abonnements |
| Platform | `platform` | Indigo | Notifications plateforme |

**Règles:**
- Chaque notification a UNE catégorie
- La catégorie détermine la couleur de l'icône
- La catégorie permet le filtrage

### 2.4 États

| État | Nom | Visuel | Signification |
|------|-----|--------|---------------|
| `unread` | Non lu | Point orange + fond légèrement coloré | Nouveau, pas consulté |
| `read` | Lu | Pas de point + fond gris | Consulté |
| `dismissed` | Rejeté | Barré + opacity 0.5 | Rejeté par l'utilisateur |
| `archived` | Archivé | Masqué par défaut | Archivé |
| `failed` | Échec | Bordure rouge + icône erreur | Échec d'envoi |
| `pending` | En attente | Spinner | En cours d'envoi |
| `delivered` | Livré | Checkmark | Livré avec succès |

### 2.5 Couleurs

**Palette officielle:**

```css
/* Priorités */
--notification-critical: #ef4444;
--notification-critical-bg: rgba(239, 68, 68, 0.12);
--notification-high: #f59e0b;
--notification-high-bg: rgba(245, 158, 11, 0.11);
--notification-medium: #3b82f6;
--notification-medium-bg: rgba(59, 130, 246, 0.1);
--notification-low: #6b7280;
--notification-low-bg: rgba(107, 114, 128, 0.1);

/* Sévérités */
--notification-error: #ef4444;
--notification-warning: #f59e0b;
--notification-info: #3b82f6;
--notification-success: #10b981;

/* Catégories */
--notification-system: #6b7280;
--notification-order: #3b82f6;
--notification-inventory: #f59e0b;
--notification-table: #8b5cf6;
--notification-staff: #06b6d4;
--notification-billing: #10b981;
--notification-platform: #6366f1;

/* États */
--notification-unread: #f59e0b;
--notification-read: #4a4a62;
--notification-dismissed: #2e2e42;
--notification-failed: #ef4444;
--notification-pending: #f59e0b;
--notification-delivered: #10b981;
```

**Règles:**
- TOUJOURS utiliser les tokens, JAMAIS de couleurs hardcodées
- Contraste minimum 4.5:1 (WCAG AA)
- Support mode sombre (variables CSS)

### 2.6 Icônes

**Bibliothèque officielle:** Lucide React

| Priorité | Icône | Usage |
|----------|-------|-------|
| Critical | `AlertCircle` | Erreur critique |
| High | `AlertTriangle` | Attention |
| Medium | `Info` | Information |
| Low | `Package` | Générique |

| Sévérité | Icône | Usage |
|----------|-------|-------|
| Error | `XCircle` | Erreur |
| Warning | `AlertTriangle` | Attention |
| Info | `Info` | Information |
| Success | `CheckCircle` | Succès |

| Catégorie | Icône | Usage |
|-----------|-------|-------|
| System | `Settings` | Système |
| Order | `ShoppingCart` | Commandes |
| Inventory | `Package` | Stock |
| Table | `Table` | Tables |
| Staff | `Users` | Équipe |
| Billing | `CreditCard` | Facturation |
| Platform | `Shield` | Plateforme |

**Règles:**
- Taille standard: 16px (desktop), 14px (mobile)
- Taille toast: 20px
- Stroke width: 2px
- Couleur: héritée du contexte

### 2.7 Tailles

| Composant | Desktop | Tablet | Mobile | POS |
|-----------|---------|--------|--------|-----|
| Toast | 360px | 320px | 100vw | 100vw |
| Badge | 18px min | 18px min | 18px min | 18px min |
| Drawer | 400px | 100vw | 100vw | 100vw |
| Card | 400px | 100% | 100% | 100% |
| Icon | 16px | 16px | 14px | 14px |
| Avatar | 32px | 32px | 28px | 28px |

### 2.8 Espacements

```css
--notification-space-xs: 4px;
--notification-space-sm: 8px;
--notification-space-md: 12px;
--notification-space-lg: 16px;
--notification-space-xl: 20px;
--notification-space-2xl: 24px;
```

**Règles:**
- Padding interne: 12-20px
- Gap entre éléments: 8-12px
- Margin externe: 12-20px

### 2.9 Rayons

```css
--notification-radius-sm: 6px;
--notification-radius-md: 8px;
--notification-radius-lg: 12px;
--notification-radius-xl: 14px;
--notification-radius-full: 9999px;
```

**Règles:**
- Badge: full (pill)
- Toast: 12-14px
- Card: 8-12px
- Button: 6-8px

### 2.10 Ombres

```css
--notification-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--notification-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--notification-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--notification-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
--notification-shadow-2xl: 0 25px 50px rgba(0, 0, 0, 0.25);
```

**Règles:**
- Toast: shadow-xl
- Drawer: shadow-2xl
- Card: shadow-md
- Badge: pas d'ombre

### 2.11 Typographies

```css
--notification-font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;

--notification-text-xs: 10.5px;
--notification-text-sm: 12px;
--notification-text-md: 13px;
--notification-text-lg: 14px;
--notification-text-xl: 15px;
--notification-text-2xl: 18px;

--notification-font-weight-normal: 400;
--notification-font-weight-medium: 500;
--notification-font-weight-semibold: 600;
--notification-font-weight-bold: 700;
```

**Règles:**
- Title: 13-15px, semibold
- Message: 12-13px, normal
- Meta: 10.5-11px, medium
- Time: 10.5px, medium

### 2.12 Animations

```css
/* Entrées */
--notification-enter-duration: 240ms;
--notification-enter-easing: cubic-bezier(0.16, 1, 0.3, 1);

/* Sorties */
--notification-exit-duration: 200ms;
--notification-exit-easing: ease-in;

/* Pulse */
--notification-pulse-duration: 2.4s;
--notification-pulse-easing: ease-in-out;
```

**Animations officielles:**

1. **slideIn** (toast)
   - De: translateX(100%) opacity(0)
   - Vers: translateX(0) opacity(1)
   - Durée: 240ms

2. **slideOut** (toast)
   - De: translateX(0) opacity(1)
   - Vers: translateX(100%) opacity(0)
   - Durée: 200ms

3. **fadeIn** (drawer)
   - De: opacity(0)
   - Vers: opacity(1)
   - Durée: 200ms

4. **slideInRight** (drawer)
   - De: translateX(20px)
   - Vers: translateX(0)
   - Durée: 260ms

5. **pulse** (badge)
   - Scale: 1 → 1.1 → 1
   - Durée: 2.4s
   - Infinite

### 2.13 Durées

| Type | Durée | Usage |
|------|-------|-------|
| Toast auto-dismiss | 4000ms | Par défaut |
| Toast critical | 0ms (jamais auto) | Critical seulement |
| Animation entrée | 240ms | Tous les toasts |
| Animation sortie | 200ms | Tous les toasts |
| Animation drawer | 260ms | NotificationCenter |
| Pulse badge | 2400ms | Badge non lu |
| Polling interval | 30000ms | Realtime fallback |

---

## 3. DESIGN TOKENS

### 3.1 NotificationColor

```typescript
export const NotificationColor = {
  // Priorities
  critical: '#ef4444',
  criticalBg: 'rgba(239, 68, 68, 0.12)',
  high: '#f59e0b',
  highBg: 'rgba(245, 158, 11, 0.11)',
  medium: '#3b82f6',
  mediumBg: 'rgba(59, 130, 246, 0.1)',
  low: '#6b7280',
  lowBg: 'rgba(107, 114, 128, 0.1)',
  
  // Severities
  error: '#ef4444',
  errorBg: 'rgba(239, 68, 68, 0.12)',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.11)',
  info: '#3b82f6',
  infoBg: 'rgba(59, 130, 246, 0.1)',
  success: '#10b981',
  successBg: 'rgba(16, 185, 129, 0.12)',
  
  // Categories
  system: '#6b7280',
  order: '#3b82f6',
  inventory: '#f59e0b',
  table: '#8b5cf6',
  staff: '#06b6d4',
  billing: '#10b981',
  platform: '#6366f1',
  
  // States
  unread: '#f59e0b',
  read: '#4a4a62',
  dismissed: '#2e2e42',
  failed: '#ef4444',
  pending: '#f59e0b',
  delivered: '#10b981',
  
  // Neutrals
  background: '#0f0f17',
  surface: '#16161f',
  border: 'rgba(255, 255, 255, 0.07)',
  textPrimary: '#e8e8f2',
  textSecondary: '#7b7b95',
  textTertiary: '#4a4a62',
} as const;
```

### 3.2 NotificationSeverity

```typescript
export type NotificationSeverity = 'error' | 'warning' | 'info' | 'success';

export const NotificationSeverityConfig: Record<NotificationSeverity, {
  color: string;
  bg: string;
  icon: React.ReactNode;
  label: string;
}> = {
  error: {
    color: NotificationColor.error,
    bg: NotificationColor.errorBg,
    icon: <XCircle size={16} />,
    label: 'Erreur',
  },
  warning: {
    color: NotificationColor.warning,
    bg: NotificationColor.warningBg,
    icon: <AlertTriangle size={16} />,
    label: 'Attention',
  },
  info: {
    color: NotificationColor.info,
    bg: NotificationColor.infoBg,
    icon: <Info size={16} />,
    label: 'Information',
  },
  success: {
    color: NotificationColor.success,
    bg: NotificationColor.successBg,
    icon: <CheckCircle size={16} />,
    label: 'Succès',
  },
};
```

### 3.3 NotificationPriority

```typescript
export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

export const NotificationPriorityConfig: Record<NotificationPriority, {
  color: string;
  bg: string;
  icon: React.ReactNode;
  label: string;
  urgency: string;
  toast: boolean;
  sound: boolean;
  vibration: boolean;
}> = {
  critical: {
    color: NotificationColor.critical,
    bg: NotificationColor.criticalBg,
    icon: <AlertCircle size={16} />,
    label: 'Critique',
    urgency: 'immédiate',
    toast: true,
    sound: true,
    vibration: true,
  },
  high: {
    color: NotificationColor.high,
    bg: NotificationColor.highBg,
    icon: <AlertTriangle size={16} />,
    label: 'Haute',
    urgency: '< 1h',
    toast: true,
    sound: true,
    vibration: false,
  },
  medium: {
    color: NotificationColor.medium,
    bg: NotificationColor.mediumBg,
    icon: <Info size={16} />,
    label: 'Normale',
    urgency: '< 24h',
    toast: false,
    sound: false,
    vibration: false,
  },
  low: {
    color: NotificationColor.low,
    bg: NotificationColor.lowBg,
    icon: <Package size={16} />,
    label: 'Basse',
    urgency: 'aucune',
    toast: false,
    sound: false,
    vibration: false,
  },
};
```

### 3.4 NotificationCategory

```typescript
export type NotificationCategory = 
  | 'system' 
  | 'order' 
  | 'inventory' 
  | 'table' 
  | 'staff' 
  | 'billing' 
  | 'platform';

export const NotificationCategoryConfig: Record<NotificationCategory, {
  color: string;
  icon: React.ReactNode;
  label: string;
}> = {
  system: {
    color: NotificationColor.system,
    icon: <Settings size={16} />,
    label: 'Système',
  },
  order: {
    color: NotificationColor.order,
    icon: <ShoppingCart size={16} />,
    label: 'Commandes',
  },
  inventory: {
    color: NotificationColor.inventory,
    icon: <Package size={16} />,
    label: 'Stock',
  },
  table: {
    color: NotificationColor.table,
    icon: <Table size={16} />,
    label: 'Tables',
  },
  staff: {
    color: NotificationColor.staff,
    icon: <Users size={16} />,
    label: 'Équipe',
  },
  billing: {
    color: NotificationColor.billing,
    icon: <CreditCard size={16} />,
    label: 'Facturation',
  },
  platform: {
    color: NotificationColor.platform,
    icon: <Shield size={16} />,
    label: 'Plateforme',
  },
};
```

### 3.5 NotificationSpacing

```typescript
export const NotificationSpacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
} as const;
```

### 3.6 NotificationRadius

```typescript
export const NotificationRadius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '14px',
  full: '9999px',
} as const;
```

### 3.7 NotificationShadow

```typescript
export const NotificationShadow = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
  '2xl': '0 25px 50px rgba(0, 0, 0, 0.25)',
} as const;
```

### 3.8 NotificationTypography

```typescript
export const NotificationTypography = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
  
  textXs: '10.5px',
  textSm: '12px',
  textMd: '13px',
  textLg: '14px',
  textXl: '15px',
  text2xl: '18px',
  
  fontWeightNormal: 400,
  fontWeightMedium: 500,
  fontWeightSemibold: 600,
  fontWeightBold: 700,
} as const;
```

### 3.9 NotificationElevation

```typescript
export const NotificationElevation = {
  base: 0,
  toast: 999999,
  drawer: 100000,
  badge: 100,
  modal: 100001,
} as const;
```

### 3.10 NotificationOpacity

```typescript
export const NotificationOpacity = {
  full: 1,
  high: 0.9,
  medium: 0.7,
  low: 0.5,
  disabled: 0.3,
} as const;
```

### 3.11 NotificationDuration

```typescript
export const NotificationDuration = {
  toastDefault: 4000,
  toastCritical: 0, // jamais auto
  enter: 240,
  exit: 200,
  drawer: 260,
  pulse: 2400,
  polling: 30000,
} as const;
```

### 3.12 NotificationBreakpoint

```typescript
export const NotificationBreakpoint = {
  mobile: 375,
  tablet: 768,
  desktop: 1920,
  pos: 800,
} as const;
```

### 3.13 NotificationZIndex

```typescript
export const NotificationZIndex = {
  base: 1,
  dropdown: 1000,
  drawer: 100000,
  modal: 100001,
  toast: 999999,
  tooltip: 100002,
} as const;
```

---

## 4. COMPONENT CATALOG

*Voir document séparé: `NOTIFICATION_COMPONENT_CATALOG.md`*

---

## 5. UX PATTERNS

*Voir document séparé: `NOTIFICATION_UX_GUIDELINES.md`*

---

## 6. ACTIONS LIBRARY

*Voir document séparé: `NOTIFICATION_UX_GUIDELINES.md`*

---

## 7. RESPONSIVE STRATEGY

*Voir document séparé: `NOTIFICATION_UX_GUIDELINES.md`*

---

## 8. OFFLINE FIRST

*Voir document séparé: `NOTIFICATION_UX_GUIDELINES.md`*

---

## 9. ACCESSIBILITY

*Voir document séparé: `NOTIFICATION_UX_GUIDELINES.md`*

---

## 10. INSPIRATIONS & CHOIX

*Voir document séparé: `NOTIFICATION_UX_GUIDELINES.md`*

---

## 11. NORMALISATION

*Voir document séparé: `NOTIFICATION_COMPONENT_MIGRATION.md`*

---

## 12. MIGRATION GUIDE

*Voir document séparé: `NOTIFICATION_COMPONENT_MIGRATION.md`*

---

## ANNEXES

### A. Glossaire

**Toast:** Notification temporaire qui apparaît et disparaît automatiquement  
**Badge:** Indicateur visuel circulaire avec compteur  
**Drawer:** Panneau coulissant depuis le bord  
**Card:** Conteneur de notification dans une liste  
**Banner:** Bandeau horizontal en haut de page  
**Timeline:** Liste chronologique de notifications  
**Inbox:** Collection de toutes les notifications  
**Feed:** Flux continu de notifications  
**Snackbar:** Toast avec action (Material Design)  
**Modal:** Fenêtre modale pour actions importantes  

### B. Références

- Stripe: https://stripe.com/docs/notifications
- GitHub: https://docs.github.com/en/notifications
- Linear: https://linear.app/docs/notifications
- Slack: https://slack.com/help/categories/200111606-notifications
- Notion: https://www.notion.so/notion/Notifications-289417b9f40b4a7aae6b3a1f2f4f6b8a
- Shopify: https://shopify.dev/docs/admin-api/notifications
- Microsoft Teams: https://docs.microsoft.com/en-us/microsoftteams/notifications
- Google Workspace: https://workspace.google.com/learn-more/notifications

### C. Changelog

**v1.0.0 (29 Juin 2026)**
- Création initiale du Design System
- Définition du Notification Language
- Création de tous les Design Tokens
- Documentation des composants
- Documentation des patterns UX
- Documentation des actions
- Documentation responsive
- Documentation offline-first
- Documentation accessibilité
- Documentation inspirations
- Documentation normalisation
- Documentation migration

---

**FIN DU DOCUMENT**

*Ce document est la référence officielle du Notification Design System d'Ekala.*  
*Toute implémentation doit respecter ces spécifications.*  
*Toute dérogation doit être validée par le Design System Architect.*