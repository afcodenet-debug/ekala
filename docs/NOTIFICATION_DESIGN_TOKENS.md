# NOTIFICATION DESIGN TOKENS — EKALA

**Version:** 1.0.0  
**Date:** 29 Juin 2026  
**Statut:** OFFICIEL

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble](#1-vue-densemble)
2. [NotificationColor](#2-notificationcolor)
3. [NotificationSeverity](#3-notificationseverity)
4. [NotificationPriority](#4-notificationpriority)
5. [NotificationCategory](#5-notificationcategory)
6. [NotificationSpacing](#6-notificationspacing)
7. [NotificationRadius](#7-notificationradius)
8. [NotificationShadow](#8-notificationshadow)
9. [NotificationTypography](#9-notificationtypography)
10. [NotificationElevation](#10-notificationelevation)
11. [NotificationOpacity](#11-notificationopacity)
12. [NotificationDuration](#12-notificationduration)
13. [NotificationBreakpoint](#13-notificationbreakpoint)
14. [NotificationZIndex](#14-notificationzindex)
15. [Utilisation](#15-utilisation)

---

## 1. VUE D'ENSEMBLE

### 1.1 Qu'est-ce qu'un Design Token?

Un Design Token est une valeur atomique qui définit un aspect du design:
- Couleurs
- Espacements
- Tailles
- Typographies
- Ombres
- Animations
- Durées
- Z-index

### 1.2 Pourquoi des tokens?

**Cohérence:**
- Même valeur partout
- Pas de duplication
- Pas de magic numbers

**Maintenabilité:**
- Changement centralisé
- Impact immédiat
- Pas de recherche/remplacement

**Évolutivité:**
- Ajout facile
- Versioning possible
- Documentation automatique

### 1.3 Structure

```typescript
// Pattern
export const NotificationXxx = {
  key: value,
  // ...
} as const;

// Usage
const style = {
  color: NotificationColor.critical,
  background: NotificationColor.criticalBg,
};
```

---

## 2. NOTIFICATIONCOLOR

### 2.1 Définition complète

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
  systemBg: 'rgba(107, 114, 128, 0.1)',
  order: '#3b82f6',
  orderBg: 'rgba(59, 130, 246, 0.1)',
  inventory: '#f59e0b',
  inventoryBg: 'rgba(245, 158, 11, 0.11)',
  table: '#8b5cf6',
  tableBg: 'rgba(139, 92, 246, 0.1)',
  staff: '#06b6d4',
  staffBg: 'rgba(6, 182, 212, 0.1)',
  billing: '#10b981',
  billingBg: 'rgba(16, 185, 129, 0.12)',
  platform: '#6366f1',
  platformBg: 'rgba(99, 102, 241, 0.1)',
  
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
  borderLight: 'rgba(255, 255, 255, 0.04)',
  textPrimary: '#e8e8f2',
  textSecondary: '#7b7b95',
  textTertiary: '#4a4a62',
  textDisabled: '#2e2e42',
} as const;
```

### 2.2 Utilisation

```tsx
// Background avec opacité
<div style={{ background: NotificationColor.criticalBg }} />

// Texte
<span style={{ color: NotificationColor.critical }} />

// Bordure
<div style={{ borderColor: NotificationColor.border }} />

// Complet
<div style={{
  background: NotificationColor.criticalBg,
  color: NotificationColor.critical,
  border: `1px solid ${NotificationColor.critical}28`,
}} />
```

### 2.3 Règles

- ✅ TOUJOURS utiliser les tokens
- ❌ JAMAIS hardcoder les couleurs
- ✅ TOUJOURS utiliser les versions `Bg` pour backgrounds
- ✅ TOUJOURS vérifier le contraste (4.5:1 minimum)

---

## 3. NOTIFICATIONSEVERITY

### 3.1 Type

```typescript
export type NotificationSeverity = 'error' | 'warning' | 'info' | 'success';
```

### 3.2 Configuration

```typescript
export const NotificationSeverityConfig: Record<NotificationSeverity, {
  color: string;
  bg: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}> = {
  error: {
    color: NotificationColor.error,
    bg: NotificationColor.errorBg,
    icon: <XCircle size={16} />,
    label: 'Erreur',
    description: 'Erreur bloquante nécessitant une action',
  },
  warning: {
    color: NotificationColor.warning,
    bg: NotificationColor.warningBg,
    icon: <AlertTriangle size={16} />,
    label: 'Attention',
    description: 'Attention requise',
  },
  info: {
    color: NotificationColor.info,
    bg: NotificationColor.infoBg,
    icon: <Info size={16} />,
    label: 'Information',
    description: 'Information générale',
  },
  success: {
    color: NotificationColor.success,
    bg: NotificationColor.successBg,
    icon: <CheckCircle size={16} />,
    label: 'Succès',
    description: 'Opération réussie',
  },
};
```

### 3.3 Utilisation

```tsx
const severity = 'error';
const config = NotificationSeverityConfig[severity];

<div style={{ color: config.color, background: config.bg }}>
  {config.icon}
  <span>{config.label}</span>
</div>
```

---

## 4. NOTIFICATIONPRIORITY

### 4.1 Type

```typescript
export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';
```

### 4.2 Configuration

```typescript
export const NotificationPriorityConfig: Record<NotificationPriority, {
  color: string;
  bg: string;
  icon: React.ReactNode;
  label: string;
  urgency: string;
  toast: boolean;
  sound: boolean;
  vibration: boolean;
  badge: boolean;
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
    badge: true,
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
    badge: true,
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
    badge: true,
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
    badge: false,
  },
};
```

### 4.3 Utilisation

```tsx
const priority = 'high';
const config = NotificationPriorityConfig[priority];

// Afficher toast?
if (config.toast) {
  <NotificationToast {...config} />;
}

// Afficher badge?
if (config.badge) {
  <NotificationBadge color={config.color} />;
}

// Jouer son?
if (config.sound) {
  playNotificationSound(priority);
}
```

---

## 5. NOTIFICATIONCATEGORY

### 5.1 Type

```typescript
export type NotificationCategory = 
  | 'system' 
  | 'order' 
  | 'inventory' 
  | 'table' 
  | 'staff' 
  | 'billing' 
  | 'platform';
```

### 5.2 Configuration

```typescript
export const NotificationCategoryConfig: Record<NotificationCategory, {
  color: string;
  bg: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}> = {
  system: {
    color: NotificationColor.system,
    bg: NotificationColor.systemBg,
    icon: <Settings size={16} />,
    label: 'Système',
    description: 'Erreurs système, maintenance',
  },
  order: {
    color: NotificationColor.order,
    bg: NotificationColor.orderBg,
    icon: <ShoppingCart size={16} />,
    label: 'Commandes',
    description: 'Commandes, paiements',
  },
  inventory: {
    color: NotificationColor.inventory,
    bg: NotificationColor.inventoryBg,
    icon: <Package size={16} />,
    label: 'Stock',
    description: 'Stock, produits',
  },
  table: {
    color: NotificationColor.table,
    bg: NotificationColor.tableBg,
    icon: <Table size={16} />,
    label: 'Tables',
    description: 'Tables, QR codes',
  },
  staff: {
    color: NotificationColor.staff,
    bg: NotificationColor.staffBg,
    icon: <Users size={16} />,
    label: 'Équipe',
    description: 'Équipe, permissions',
  },
  billing: {
    color: NotificationColor.billing,
    bg: NotificationColor.billingBg,
    icon: <CreditCard size={16} />,
    label: 'Facturation',
    description: 'Factures, abonnements',
  },
  platform: {
    color: NotificationColor.platform,
    bg: NotificationColor.platformBg,
    icon: <Shield size={16} />,
    label: 'Plateforme',
    description: 'Notifications plateforme',
  },
};
```

### 5.3 Utilisation

```tsx
const category = 'order';
const config = NotificationCategoryConfig[category];

<div style={{ color: config.color }}>
  {config.icon}
  <span>{config.label}</span>
</div>
```

---

## 6. NOTIFICATIONSPACING

### 6.1 Définition

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

### 6.2 Utilisation

```tsx
// Padding interne
<div style={{ padding: NotificationSpacing.md }} />

// Gap entre éléments
<div style={{ gap: NotificationSpacing.sm }} />

// Margin externe
<div style={{ margin: NotificationSpacing.lg }} />
```

### 6.3 Règles

- Padding interne: 12-20px (md à xl)
- Gap entre éléments: 8-12px (sm à md)
- Margin externe: 12-20px (md à xl)

---

## 7. NOTIFICATIONRADIUS

### 7.1 Définition

```typescript
export const NotificationRadius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '14px',
  full: '9999px',
} as const;
```

### 7.2 Utilisation

```tsx
// Badge (pill)
<div style={{ borderRadius: NotificationRadius.full }} />

// Toast
<div style={{ borderRadius: NotificationRadius.xl }} />

// Card
<div style={{ borderRadius: NotificationRadius.lg }} />

// Button
<button style={{ borderRadius: NotificationRadius.md }} />
```

### 7.3 Règles

- Badge: full (pill)
- Toast: 12-14px (lg à xl)
- Card: 8-12px (lg)
- Button: 6-8px (sm à md)

---

## 8. NOTIFICATIONSHADOW

### 8.1 Définition

```typescript
export const NotificationShadow = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
  '2xl': '0 25px 50px rgba(0, 0, 0, 0.25)',
} as const;
```

### 8.2 Utilisation

```tsx
// Toast
<div style={{ boxShadow: NotificationShadow.xl }} />

// Drawer
<div style={{ boxShadow: NotificationShadow['2xl'] }} />

// Card
<div style={{ boxShadow: NotificationShadow.md }} />

// Badge (pas d'ombre)
<div style={{ boxShadow: 'none' }} />
```

### 8.3 Règles

- Toast: shadow-xl
- Drawer: shadow-2xl
- Card: shadow-md
- Badge: pas d'ombre

---

## 9. NOTIFICATIONTYPOGRAPHY

### 9.1 Définition

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

### 9.2 Utilisation

```tsx
// Title
<h3 style={{
  fontFamily: NotificationTypography.fontFamily,
  fontSize: NotificationTypography.textMd,
  fontWeight: NotificationTypography.fontWeightSemibold,
}}>
  {title}
</h3>

// Message
<p style={{
  fontFamily: NotificationTypography.fontFamily,
  fontSize: NotificationTypography.textSm,
  fontWeight: NotificationTypography.fontWeightNormal,
}}>
  {message}
</p>

// Meta
<span style={{
  fontFamily: NotificationTypography.fontFamily,
  fontSize: NotificationTypography.textXs,
  fontWeight: NotificationTypography.fontWeightMedium,
}}>
  {meta}
</span>
```

### 9.3 Règles

- Title: 13-15px, semibold
- Message: 12-13px, normal
- Meta: 10.5-11px, medium
- Time: 10.5px, medium

---

## 10. NOTIFICATIONELEVATION

### 10.1 Définition

```typescript
export const NotificationElevation = {
  base: 0,
  badge: 100,
  dropdown: 1000,
  drawer: 100000,
  modal: 100001,
  toast: 999999,
  tooltip: 100002,
} as const;
```

### 10.2 Utilisation

```tsx
// Toast (au-dessus de tout)
<div style={{ zIndex: NotificationElevation.toast }} />

// Drawer
<div style={{ zIndex: NotificationElevation.drawer }} />

// Badge
<div style={{ zIndex: NotificationElevation.badge }} />
```

### 10.3 Règles

- Toast: 999999 (toujours visible)
- Drawer: 100000
- Modal: 100001
- Badge: 100

---

## 11. NOTIFICATIONOPACITY

### 11.1 Définition

```typescript
export const NotificationOpacity = {
  full: 1,
  high: 0.9,
  medium: 0.7,
  low: 0.5,
  disabled: 0.3,
} as const;
```

### 11.2 Utilisation

```tsx
// Notification normale
<div style={{ opacity: NotificationOpacity.full }} />

// Notification en chargement
<div style={{ opacity: NotificationOpacity.medium }} />

// Notification désactivée
<div style={{ opacity: NotificationOpacity.disabled }} />
```

### 11.3 Règles

- Normal: 1
- Hover: 0.9
- Loading: 0.7
- Disabled: 0.3

---

## 12. NOTIFICATIONDURATION

### 12.1 Définition

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

### 12.2 Utilisation

```tsx
// Auto-dismiss après 4s
const duration = NotificationDuration.toastDefault;

// Animation entrée
const animationDuration = NotificationDuration.enter;

// Polling
setInterval(fetchNotifications, NotificationDuration.polling);
```

### 12.3 Règles

- Toast auto-dismiss: 4000ms
- Toast critical: 0ms (jamais auto)
- Animation entrée: 240ms
- Animation sortie: 200ms
- Animation drawer: 260ms
- Pulse badge: 2400ms
- Polling: 30000ms

---

## 13. NOTIFICATIONBREAKPOINT

### 13.1 Définition

```typescript
export const NotificationBreakpoint = {
  mobile: 375,
  tablet: 768,
  desktop: 1920,
  pos: 800,
} as const;
```

### 13.2 Utilisation

```tsx
// Responsive
const isMobile = window.innerWidth < NotificationBreakpoint.tablet;
const isTablet = window.innerWidth >= NotificationBreakpoint.tablet 
  && window.innerWidth < NotificationBreakpoint.desktop;

// Adaptations
if (isMobile) {
  return <NotificationCenter fullscreen />;
} else {
  return <NotificationCenter drawer />;
}
```

### 13.3 Règles

- Mobile: < 768px
- Tablet: 768px - 1920px
- Desktop: > 1920px
- POS: 800px (spécifique)

---

## 14. NOTIFICATIONZINDEX

### 14.1 Définition

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

### 14.2 Utilisation

```tsx
// Toast (toujours visible)
<div style={{ zIndex: NotificationZIndex.toast }} />

// Drawer
<div style={{ zIndex: NotificationZIndex.drawer }} />

// Modal
<div style={{ zIndex: NotificationZIndex.modal }} />
```

### 14.3 Règles

- Toast: 999999 (au-dessus de tout)
- Modal: 100001
- Drawer: 100000
- Tooltip: 100002
- Dropdown: 1000

---

## 15. UTILISATION

### 15.1 Import

```typescript
import {
  NotificationColor,
  NotificationSeverityConfig,
  NotificationPriorityConfig,
  NotificationCategoryConfig,
  NotificationSpacing,
  NotificationRadius,
  NotificationShadow,
  NotificationTypography,
  NotificationElevation,
  NotificationOpacity,
  NotificationDuration,
  NotificationBreakpoint,
  NotificationZIndex,
} from '@/design-tokens/notification';
```

### 15.2 Exemple complet

```tsx
const NotificationToast: React.FC<NotificationToastProps> = ({
  priority,
  severity,
  category,
  title,
  message,
  onClose,
}) => {
  const priorityConfig = NotificationPriorityConfig[priority];
  const categoryConfig = NotificationCategoryConfig[category];
  
  return (
    <div
      style={{
        position: 'fixed',
        top: NotificationSpacing.lg,
        right: NotificationSpacing.lg,
        width: '360px',
        background: NotificationColor.background,
        border: `1px solid ${NotificationColor.border}`,
        borderRadius: NotificationRadius.xl,
        boxShadow: NotificationShadow.xl,
        zIndex: NotificationElevation.toast,
        padding: NotificationSpacing.lg,
        animation: `slideIn ${NotificationDuration.enter}ms cubic-bezier(0.16, 1, 0.3, 1)`,
      }}
    >
      <div style={{ display: 'flex', gap: NotificationSpacing.md }}>
        <div style={{ 
          color: priorityConfig.color,
          background: priorityConfig.bg,
          borderRadius: NotificationRadius.md,
          padding: NotificationSpacing.sm,
        }}>
          {priorityConfig.icon}
        </div>
        
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontFamily: NotificationTypography.fontFamily,
            fontSize: NotificationTypography.textMd,
            fontWeight: NotificationTypography.fontWeightSemibold,
            color: NotificationColor.textPrimary,
            margin: 0,
          }}>
            {title}
          </h3>
          
          <p style={{
            fontFamily: NotificationTypography.fontFamily,
            fontSize: NotificationTypography.textSm,
            color: NotificationColor.textSecondary,
            margin: `${NotificationSpacing.xs}px 0 0 0`,
          }}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};
```

### 15.3 Règles d'or

1. **TOUJOURS** utiliser les tokens
2. **JAMAIS** hardcoder les valeurs
3. **TOUJOURS** utiliser les versions `Bg` pour backgrounds
4. **TOUJOURS** vérifier le contraste
5. **TOUJOURS** respecter les espacements
6. **TOUJOURS** utiliser les typographies définies
7. **TOUJOURS** respecter les z-index
8. **TOUJOURS** utiliser les durées définies

---

## CONCLUSION

Ces tokens sont la source de vérité pour tout le système de notifications.

**Toute modification doit:**
- Être validée par le Design System Architect
- Être documentée
- Être propagée dans tous les composants

**Toute dérogation doit:**
- Être justifiée
- Être temporaire
- Être trackée dans une issue

---

**FIN DU DOCUMENT**

*Ce document fait partie du Notification Design System officiel d'Ekala.*