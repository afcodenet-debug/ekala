# NOTIFICATION COMPONENT MIGRATION — EKALA

**Version:** 1.0.0  
**Date:** 29 Juin 2026  
**Statut:** OFFICIEL

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble](#1-vue-densemble)
2. [Normalisation](#2-normalisation)
3. [Migration V1 → V3](#3-migration-v1--v3)
4. [Composants à supprimer](#4-composants-à-supprimer)
5. [Composants à conserver](#5-composants-à-conserver)
6. [Composants à créer](#6-composants-à-créer)
7. [Guide de migration par composant](#7-guide-de-migration-par-composant)
8. [Checklist de migration](#8-checklist-de-migration)
9. [Rollback](#9-rollback)

---

## 1. VUE D'ENSEMBLE

### 1.1 État actuel (V1)

**Composants existants:**
- `NotificationCenter.tsx` (382 lignes) - ✅ Production
- `GlobalNotificationToast.tsx` (240 lignes) - ✅ Production
- `NotificationBadge.tsx` (43 lignes) - ✅ Production
- `ToastProvider.tsx` (120 lignes) - ❌ Mort (jamais utilisé)
- `StatusToast.tsx` (~150 lignes) - ⚠️ Production (POS/Orders)

**Store:**
- `useNotificationStore.ts` (114 lignes) - ✅ Production

**Problèmes:**
- ToastProvider jamais importé
- Deux systèmes de toast parallèles
- Pas d'intégration backend
- Pas de persistance
- Pas de realtime

### 1.2 État cible (V3)

**Architecture:**
```
V1 (EXISTANT - PAS TOUCHER)
├─ NotificationCenter
├─ GlobalNotificationToast
├─ NotificationBadge
└─ useNotificationStore (local only)

V3 (NOUVEAU - À INTÉGRER)
├─ NotificationProvider (wrapper)
├─ NotificationService (API)
├─ NotificationStoreV3 (persisted + realtime)
├─ NotificationToast (unifié)
├─ NotificationBanner
├─ NotificationSkeleton
├─ NotificationEmptyState
└─ Autres composants V3
```

**Principe:**
- V1 et V3 coexistent
- Migration progressive
- Feature flags
- Rollback possible

---

## 2. NORMALISATION

### 2.1 Règles d'or

1. **TOUJOURS** utiliser les composants du Design System
2. **JAMAIS** inventer de nouvelles couleurs
3. **JAMAIS** créer de composants sans spécification
4. **TOUJOURS** typer les props
5. **TOUJOURS** documenter l'accessibilité
6. **TOUJOURS** tester sur mobile
7. **TOUJOURS** respecter les tokens

### 2.2 Convention de nommage

**Pattern:**
- `Notification` + Type (Badge, Toast, Card, etc.)
- PascalCase
- Pas d'abréviation

**Exemples:**
- ✅ `NotificationBadge`
- ✅ `NotificationToast`
- ✅ `NotificationCenter`
- ❌ `NotifBadge`
- ❌ `NToast`

### 2.3 Structure des composants

**Atomic Design:**
- Atoms: Badge, Icon, Avatar, Chip
- Molecules: Toast, Card, Indicator
- Organisms: Center, Timeline, Drawer
- Templates: NotificationPage, NotificationPanel
- Pages: Inbox, Settings

---

## 3. MIGRATION V1 → V3

### 3.1 Stratégie: "Strangler Fig Pattern"

**Principe:**
1. Garder V1 intact et fonctionnel
2. Ajouter V3 en parallèle
3. Migrer progressivement les appels
4. Supprimer V1 seulement quand V3 est confirmé

**Avantages:**
- Zéro régression
- Rollback immédiat
- Tests progressifs
- A/B testing possible

### 3.2 Feature flags

**Configuration:**
```typescript
// .env
VITE_USE_V3_NOTIFICATIONS=false
VITE_USE_V3_TOAST=false
VITE_USE_V3_CENTER=false
```

**Usage:**
```tsx
const USE_V3 = import.meta.env.VITE_USE_V3_NOTIFICATIONS === 'true';

return USE_V3 ? (
  <NotificationProviderV3>
    <NotificationToastV3 {...props} />
  </NotificationProviderV3>
) : (
  <NotificationToast {...props} />
);
```

### 3.3 Phases de migration

**P0 (Semaine 1):** Quick wins
- Supprimer ToastProvider
- Corriger responsive
- Ajouter animations sortie
- Améliorer accessibilité

**P1 (Semaines 2-3):** Intégration backend
- Créer NotificationService
- Créer NotificationStoreV3
- Intégrer Supabase Realtime
- Ajouter persistance

**P2 (Semaines 4-5):** Améliorations UX
- Unifier les toasts
- Ajouter préférences
- Ajouter son/vibration
- Améliorer badge

**P3 (Semaine 6):** Optimisations
- Virtualisation
- Lazy loading
- Analytics

---

## 4. COMPOSANTS À SUPPRIMER (V1)

### 4.1 ToastProvider.tsx

**Fichier:** `src/components/ToastProvider.tsx`  
**Lignes:** 120  
**Raison:** Jamais utilisé, remplacé par NotificationToast

**Impact:**
- Réduction de code mort
- Simplification de l'arborescence

**Remplacement:**
- `NotificationToast` (V3)
- `NotificationProviderV3` (V3)

**Migration:**
```bash
# 1. Vérifier qu'aucun import n'existe
grep -r "ToastProvider" src/ --include="*.tsx"

# 2. Supprimer le fichier
rm src/components/ToastProvider.tsx

# 3. Tester la compilation
npm run build

# 4. Tester les notifications
npm run dev
```

**Rollback:**
```bash
git restore src/components/ToastProvider.tsx
```

---

### 4.2 StatusToast.tsx (Fusionner)

**Fichier:** `src/components/StatusToast.tsx`  
**Lignes:** ~150  
**Raison:** Spécifique POS/Orders, à fusionner dans NotificationToast

**Impact:**
- Unification des toasts
- Réduction de duplication

**Remplacement:**
- `NotificationToast` avec variant="warning" ou "error"

**Migration:**
```tsx
// AVANT (V1)
<StatusToast
  title={t('pos.stockIssueTitle')}
  subtitle={t('pos.stockIssueSubtitle')}
  message={message}
  variant="warning"
  details={details}
  footer={t('pos.stockIssueFooter')}
  onClose={clearErrors}
/>

// APRÈS (V3)
<NotificationToast
  id="stock-issue"
  title={t('pos.stockIssueTitle')}
  message={message}
  priority="high"
  severity="warning"
  category="inventory"
  details={details}
  footer={t('pos.stockIssueFooter')}
  onClose={clearErrors}
/>
```

**Rollback:**
```bash
git restore src/components/StatusToast.tsx
```

---

## 5. COMPOSANTS À CONSERVER (V1)

### 5.1 NotificationCenter.tsx

**Fichier:** `src/components/NotificationCenter.tsx`  
**Lignes:** 382  
**Raison:** Fonctionnel, bien conçu

**Améliorations à apporter:**
- Corriger responsive (400px → min(400px, 100vw))
- Ajouter animations de sortie
- Ajouter accessibilité ARIA
- Intégrer V3 en parallèle

**Migration:**
```tsx
// V1 (EXISTANT)
<NotificationCenter isOpen={isOpen} onClose={onClose} />

// V3 (PARALLÈLE)
<NotificationCenterV3 isOpen={isOpen} onClose={onClose} />
```

**Feature flag:**
```tsx
const USE_V3_CENTER = import.meta.env.VITE_USE_V3_CENTER === 'true';

return USE_V3_CENTER ? (
  <NotificationCenterV3 {...props} />
) : (
  <NotificationCenter {...props} />
);
```

---

### 5.2 GlobalNotificationToast.tsx

**Fichier:** `src/components/GlobalNotificationToast.tsx`  
**Lignes:** 240  
**Raison:** Fonctionnel, bien conçu

**Améliorations à apporter:**
- Ajouter animations de sortie
- Ajouter timestamp
- Intégrer V3 en parallèle

**Migration:**
```tsx
// V1 (EXISTANT)
<GlobalNotificationToast />

// V3 (PARALLÈLE)
<NotificationToastV3 />
```

**Feature flag:**
```tsx
const USE_V3_TOAST = import.meta.env.VITE_USE_V3_TOAST === 'true';

return USE_V3_TOAST ? (
  <NotificationToastV3 />
) : (
  <GlobalNotificationToast />
);
```

---

### 5.3 NotificationBadge.tsx

**Fichier:** `src/components/NotificationBadge.tsx`  
**Lignes:** 43  
**Raison:** Fonctionnel, bien conçu

**Améliorations à apporter:**
- Ajouter accessibilité ARIA
- Intégrer V3 en parallèle

**Migration:**
```tsx
// V1 (EXISTANT)
<NotificationBadge />

// V3 (PARALLÈLE)
<NotificationBadgeV3 />
```

**Feature flag:**
```tsx
const USE_V3_BADGE = import.meta.env.VITE_USE_V3_BADGE === 'true';

return USE_V3_BADGE ? (
  <NotificationBadgeV3 />
) : (
  <NotificationBadge />
);
```

---

## 6. COMPOSANTS À CRÉER (V3)

### 6.1 Nouveaux composants

| Composant | Priorité | Fichier | Lignes estimées |
|-----------|----------|---------|----------------|
| NotificationProvider | P1 | `src/components/NotificationProviderV3.tsx` | 100 |
| NotificationService | P1 | `src/services/notification-v3.service.ts` | 150 |
| NotificationStoreV3 | P1 | `src/stores/useNotificationStoreV3.ts` | 150 |
| NotificationSkeleton | P1 | `src/components/NotificationSkeleton.tsx` | 80 |
| NotificationEmptyState | P1 | `src/components/NotificationEmptyState.tsx` | 60 |
| NotificationChip | P2 | `src/components/NotificationChip.tsx` | 50 |
| NotificationIndicator | P2 | `src/components/NotificationIndicator.tsx` | 40 |
| NotificationAvatar | P2 | `src/components/NotificationAvatar.tsx` | 60 |
| NotificationAction | P2 | `src/components/NotificationAction.tsx` | 70 |
| NotificationMenu | P2 | `src/components/NotificationMenu.tsx` | 80 |
| NotificationFilterBar | P2 | `src/components/NotificationFilterBar.tsx` | 100 |
| NotificationDateSeparator | P2 | `src/components/NotificationDateSeparator.tsx` | 30 |
| NotificationBanner | P2 | `src/components/NotificationBanner.tsx` | 120 |
| NotificationTimeline | P3 | `src/components/NotificationTimeline.tsx` | 150 |
| NotificationDrawer | P3 | `src/components/NotificationDrawer.tsx` | 100 |

**Total estimé:** ~1,340 lignes

### 6.2 Ordre de création

**P1 (Semaines 2-3):**
1. NotificationService (API client)
2. NotificationStoreV3 (store avec persistance)
3. NotificationProvider (wrapper)
4. NotificationSkeleton (loading)
5. NotificationEmptyState (empty)

**P2 (Semaines 4-5):**
6. NotificationChip (filtres)
7. NotificationIndicator (indicateur)
8. NotificationAvatar (avatar)
9. NotificationAction (actions)
10. NotificationMenu (menu)
11. NotificationFilterBar (filtres)
12. NotificationDateSeparator (séparateur)
13. NotificationBanner (bannière)

**P3 (Semaine 6):**
14. NotificationTimeline (timeline)
15. NotificationDrawer (drawer générique)

---

## 7. GUIDE DE MIGRATION PAR COMPOSANT

### 7.1 NotificationCenter

**V1 → V3:**

```tsx
// V1 (EXISTANT)
// src/components/NotificationCenter.tsx
export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
}) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  
  // ... 382 lignes
};

// V3 (NOUVEAU)
// src/components/NotificationCenterV3.tsx
export const NotificationCenterV3: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
}) => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead,
    isLoading 
  } = useNotificationStoreV3();
  
  // Utiliser NotificationService pour fetch
  // Utiliser Supabase Realtime pour updates
  // Utiliser localStorage pour persistance
  
  return (
    <NotificationDrawer isOpen={isOpen} onClose={onClose}>
      <NotificationFilterBar />
      <NotificationList>
        {notifications.map(notif => (
          <NotificationCard key={notif.id} {...notif} />
        ))}
      </NotificationList>
    </NotificationDrawer>
  );
};
```

**Migration dans App.tsx:**
```tsx
// AVANT
<NotificationCenter isOpen={isOpen} onClose={onClose} />

// APRÈS
const USE_V3 = import.meta.env.VITE_USE_V3_CENTER === 'true';

return USE_V3 ? (
  <NotificationCenterV3 isOpen={isOpen} onClose={onClose} />
) : (
  <NotificationCenter isOpen={isOpen} onClose={onClose} />
);
```

---

### 7.2 GlobalNotificationToast

**V1 → V3:**

```tsx
// V1 (EXISTANT)
// src/components/GlobalNotificationToast.tsx
export const GlobalNotificationToast: React.FC = () => {
  const { notifications, markAsRead } = useNotificationStore();
  const [visibleToast, setVisibleToast] = useState<AppNotification | null>(null);
  
  // ... 240 lignes
};

// V3 (NOUVEAU)
// src/components/NotificationToastV3.tsx
export const NotificationToastV3: React.FC = () => {
  const { notifications, markAsRead, dismiss } = useNotificationStoreV3();
  const [visibleToast, setVisibleToast] = useState<AppNotification | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  
  // Ajouter animations de sortie
  // Ajouter timestamp
  // Ajouter son/vibration
  // Utiliser Supabase Realtime
  
  return (
    <>
      {visibleToast && (
        <div className="notification-toast" style={...}>
          <NotificationIcon priority={visibleToast.priority} />
          <div>
            <h3>{visibleToast.title}</h3>
            <p>{visibleToast.message}</p>
            <span>{formatTime(visibleToast.createdAt)}</span>
          </div>
          <button onClick={() => handleDismiss(visibleToast.id)}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
};
```

**Migration dans App.tsx:**
```tsx
// AVANT
<GlobalNotificationToast />

// APRÈS
const USE_V3_TOAST = import.meta.env.VITE_USE_V3_TOAST === 'true';

return USE_V3_TOAST ? (
  <NotificationToastV3 />
) : (
  <GlobalNotificationToast />
);
```

---

### 7.3 NotificationBadge

**V1 → V3:**

```tsx
// V1 (EXISTANT)
// src/components/NotificationBadge.tsx
export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  color,
  max = 99,
}) => {
  const { unreadCount } = useNotificationStore();
  const displayCount = count ?? unreadCount;
  
  // ... 43 lignes
};

// V3 (NOUVEAU)
// src/components/NotificationBadgeV3.tsx
export const NotificationBadgeV3: React.FC<NotificationBadgeProps> = ({
  count,
  color,
  max = 99,
}) => {
  const { unreadCount } = useNotificationStoreV3();
  const displayCount = count ?? unreadCount;
  
  // Ajouter accessibilité ARIA
  // Ajouter animation pulse
  // Utiliser NotificationPriorityConfig pour couleur
  
  return (
    <div
      role="status"
      aria-label={`${displayCount} notifications non lues`}
      aria-live="polite"
      style={{
        background: color || NotificationColor.critical,
        borderRadius: NotificationRadius.full,
        animation: displayCount > 0 ? `pulse ${NotificationDuration.pulse}ms` : 'none',
      }}
    >
      {displayCount > max ? `${max}+` : displayCount}
    </div>
  );
};
```

**Migration dans Sidebar.tsx:**
```tsx
// AVANT
<NotificationBadge />

// APRÈS
const USE_V3_BADGE = import.meta.env.VITE_USE_V3_BADGE === 'true';

return USE_V3_BADGE ? (
  <NotificationBadgeV3 />
) : (
  <NotificationBadge />
);
```

---

### 7.4 useNotificationStore

**V1 → V3:**

```tsx
// V1 (EXISTANT)
// src/stores/useNotificationStore.ts
export const useNotificationStore = create<NotificationStore>()(
  devtools(
    persist(
      (set, get) => ({
        notifications: [],
        unreadCount: 0,
        
        addNotification: (notif) => { ... },
        markAsRead: (id) => { ... },
        markAllAsRead: () => { ... },
        loadFromServer: async () => { ... }, // JAMAIS APPELÉ
        ingestNotifications: (notifs) => { ... }, // JAMAIS APPELÉ
      }),
      { name: 'notification-storage' }
    )
  )
);

// V3 (NOUVEAU)
// src/stores/useNotificationStoreV3.ts
export const useNotificationStoreV3 = create<NotificationStoreV3>()(
  devtools(
    persist(
      (set, get) => ({
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        lastSync: null,
        
        // V1 methods (garde pour compatibilité)
        addNotification: (notif) => { ... },
        markAsRead: (id) => { ... },
        markAllAsRead: () => { ... },
        
        // V3 methods (nouveaux)
        loadFromServer: async () => {
          set({ isLoading: true });
          try {
            const notifs = await NotificationService.fetchNotifications();
            set({ 
              notifications: notifs,
              lastSync: new Date(),
            });
          } catch (error) {
            console.error('Failed to load notifications:', error);
          } finally {
            set({ isLoading: false });
          }
        },
        
        ingestNotifications: (notifs) => {
          const existing = get().notifications;
          const merged = mergeNotifications(existing, notifs);
          set({ notifications: merged });
        },
        
        // Realtime
        subscribeToRealtime: () => {
          const channel = supabase
            .channel(`notifications:${tenantId}:${userId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public' }, (payload) => {
              get().ingestNotifications([payload.new]);
            })
            .subscribe();
        },
      }),
      { name: 'notification-storage-v3' }
    )
  )
);
```

**Migration dans App.tsx:**
```tsx
// AVANT
<GlobalNotificationToast />
<NotificationCenter isOpen={isOpen} onClose={onClose} />

// APRÈS
<NotificationProviderV3>
  <NotificationToastV3 />
  <NotificationCenterV3 isOpen={isOpen} onClose={onClose} />
</NotificationProviderV3>
```

---

## 8. CHECKLIST DE MIGRATION

### 8.1 Avant de migrer

- [ ] Audit complet effectué (voir `NOTIFICATION_FRONTEND_FORENSIC.md`)
- [ ] Plan de migration validé (voir `NOTIFICATION_MIGRATION_PLAN.md`)
- [ ] Design System documenté (voir `NOTIFICATION_DESIGN_SYSTEM.md`)
- [ ] Feature flags en place
- [ ] Tests unitaires en place
- [ ] Tests d'intégration en place
- [ ] Rollback planifié

### 8.2 P0 (Quick Wins)

- [ ] ToastProvider.tsx supprimé
- [ ] Responsive corrigé (400px → min(400px, 100vw))
- [ ] Animations de sortie ajoutées
- [ ] Appels addNotification unifiés
- [ ] Accessibilité ARIA ajoutée
- [ ] Timestamps ajoutés
- [ ] Tests passent
- [ ] Documentation à jour

### 8.3 P1 (Intégration backend)

- [ ] NotificationService créé
- [ ] NotificationStoreV3 créé
- [ ] Supabase Realtime intégré
- [ ] NotificationProviderV3 créé
- [ ] Persistance localStorage ajoutée
- [ ] API /api/notifications consommée
- [ ] Tests unitaires passent (>80% coverage)
- [ ] Tests d'intégration passent
- [ ] 0 erreur console
- [ ] Documentation à jour

### 8.4 P2 (Améliorations UX)

- [ ] Systèmes de toast unifiés
- [ ] Préférences utilisateur ajoutées
- [ ] Son et vibration ajoutés
- [ ] Badge amélioré (pulse, couleurs)
- [ ] Filtres ajoutés
- [ ] Tests utilisateur validés
- [ ] Documentation à jour

### 8.5 P3 (Optimisations)

- [ ] Virtualisation implémentée
- [ ] Lazy loading implémenté
- [ ] Analytics implémenté
- [ ] Performance < 100ms (1000 notifs)
- [ ] Bundle -10%
- [ ] Documentation à jour

---

## 9. ROLLBACK

### 9.1 Rollback immédiat (P0)

```bash
# Revenir au commit précédent
git revert HEAD

# Ou restaurer un fichier spécifique
git restore src/components/ToastProvider.tsx
```

### 9.2 Rollback par feature flag

```bash
# Désactiver le flag
# .env
VITE_USE_V3_NOTIFICATIONS=false
VITE_USE_V3_TOAST=false
VITE_USE_V3_CENTER=false

# Redémarrer l'application
npm run dev
```

### 9.3 Rollback par fichier

```bash
# Supprimer les fichiers V3
git rm src/components/NotificationProviderV3.tsx
git rm src/components/NotificationToastV3.tsx
git rm src/components/NotificationCenterV3.tsx
git rm src/components/NotificationBadgeV3.tsx
git rm src/stores/useNotificationStoreV3.ts
git rm src/services/notification-v3.service.ts

# Commit
git commit -m "Rollback: Remove V3 notification components"
```

### 9.4 Rollback complet

```bash
# Revenir au commit avant migration
git revert <commit-hash>

# Ou reset hard (DANGEREUX)
git reset --hard <commit-hash>
```

---

## 10. EXEMPLES DE CODE

### 10.1 Exemple complet: NotificationToast V3

```tsx
// src/components/NotificationToastV3.tsx
import React, { useEffect, useState } from 'react';
import { useNotificationStoreV3 } from '@/stores/useNotificationStoreV3';
import { NotificationPriorityConfig, NotificationDuration, NotificationSpacing, NotificationRadius, NotificationShadow, NotificationElevation, NotificationTypography, NotificationColor } from '@/design-tokens/notification';
import { X, AlertCircle, AlertTriangle, Info, Package } from 'lucide-react';

export const NotificationToastV3: React.FC = () => {
  const { notifications, markAsRead, dismiss } = useNotificationStoreV3();
  const [visibleToast, setVisibleToast] = useState<AppNotification | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  
  // Trouver le toast à afficher (critical/high non lu)
  useEffect(() => {
    const candidate = notifications.find(
      (n) => !n.readAt && ['critical', 'high'].includes(n.priority)
    );
    
    if (candidate && candidate.id !== visibleToast?.id) {
      setVisibleToast(candidate);
      setProgress(100);
    }
  }, [notifications]);
  
  // Auto-dismiss
  useEffect(() => {
    if (!visibleToast) return;
    
    const priorityConfig = NotificationPriorityConfig[visibleToast.priority];
    const duration = priorityConfig.toast 
      ? NotificationDuration.toastDefault 
      : NotificationDuration.toastCritical;
    
    if (duration === 0) return; // Jamais auto
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          handleDismiss();
          return 0;
        }
        return prev - (100 / (duration / 100));
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [visibleToast]);
  
  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      if (visibleToast) {
        dismiss(visibleToast.id);
      }
      setVisibleToast(null);
      setIsExiting(false);
    }, NotificationDuration.exit);
  };
  
  if (!visibleToast) return null;
  
  const priorityConfig = NotificationPriorityConfig[visibleToast.priority];
  
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-label={`Notification ${visibleToast.priority}: ${visibleToast.title}`}
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
        animation: isExiting 
          ? `slideOut ${NotificationDuration.exit}ms ease-in`
          : `slideIn ${NotificationDuration.enter}ms cubic-bezier(0.16, 1, 0.3, 1)`,
      }}
    >
      {/* Barre de priorité pulsante */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: priorityConfig.color,
          borderRadius: `${NotificationRadius.xl}px ${NotificationRadius.xl}px 0 0`,
          animation: `pulse ${NotificationDuration.pulse}ms ease-in-out infinite`,
        }}
      />
      
      {/* Contenu */}
      <div style={{ display: 'flex', gap: NotificationSpacing.md }}>
        {/* Icône */}
        <div
          style={{
            color: priorityConfig.color,
            background: priorityConfig.bg,
            borderRadius: NotificationRadius.md,
            padding: NotificationSpacing.sm,
            flexShrink: 0,
          }}
        >
          {priorityConfig.icon}
        </div>
        
        {/* Texte */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontFamily: NotificationTypography.fontFamily,
              fontSize: NotificationTypography.textMd,
              fontWeight: NotificationTypography.fontWeightSemibold,
              color: NotificationColor.textPrimary,
              margin: 0,
            }}
          >
            {visibleToast.title}
          </h3>
          
          {visibleToast.message && (
            <p
              style={{
                fontFamily: NotificationTypography.fontFamily,
                fontSize: NotificationTypography.textSm,
                color: NotificationColor.textSecondary,
                margin: `${NotificationSpacing.xs}px 0 0 0`,
              }}
            >
              {visibleToast.message}
            </p>
          )}
          
          {/* Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: NotificationSpacing.sm,
            }}
          >
            <span
              style={{
                fontFamily: NotificationTypography.fontFamily,
                fontSize: NotificationTypography.textXs,
                color: NotificationColor.textTertiary,
              }}
            >
              {priorityConfig.label} • Il y a 2 min
            </span>
            
            {/* Progress bar */}
            {priorityConfig.toast && (
              <div
                style={{
                  width: '60px',
                  height: '2px',
                  background: NotificationColor.border,
                  borderRadius: NotificationRadius.full,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: priorityConfig.color,
                    transition: 'width 100ms linear',
                  }}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Bouton fermer */}
        <button
          onClick={handleDismiss}
          aria-label="Fermer"
          style={{
            background: 'transparent',
            border: 'none',
            color: NotificationColor.textSecondary,
            cursor: 'pointer',
            padding: NotificationSpacing.xs,
            borderRadius: NotificationRadius.sm,
            flexShrink: 0,
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
```

---

## CONCLUSION

Ce guide définit la stratégie de migration V1 → V3.

**Règles:**
- ✅ Suivre les phases P0 → P1 → P2 → P3
- ✅ Utiliser les feature flags
- ✅ Tester à chaque étape
- ✅ Documenter les changements
- ❌ Ne pas casser V1
- ❌ Ne pas supprimer V1 avant confirmation

**Prochaine étape:**
Commencer par P0-1: Supprimer ToastProvider (30 min, risque zéro).

---

**FIN DU DOCUMENT**

*Ce document fait partie du Notification Design System officiel d'Ekala.*