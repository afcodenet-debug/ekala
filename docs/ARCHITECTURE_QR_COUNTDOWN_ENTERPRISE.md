# ARCHITECTURE ENTERPRISE - COMPTE À REBOURS QR MENU
**Niveau:** Staff Software Engineer (Uber Eats, Toast POS, Square, Deliveroo, Shopify, Stripe)  
**Date:** 02/07/2026  
**Version:** 1.0  
**Statut:** Document d'Architecture - Pré-Implémentation  
**Classification:** Confidentiel - Équipe Technique

---

## SOMMAIRE

1. [Diagnostic de l'Existant](#1-diagnostic-de-lexistant)
2. [Problèmes Identifiés](#2-problèmes-identifiés)
3. [Architecture Cible](#3-architecture-cible)
4. [Machine à États Complète](#4-machine-à-états-complète)
5. [Diagramme du Flux Métier](#5-diagramme-du-flux-métier)
6. [Design System Premium](#6-design-system-premium)
7. [Gestion du Temps](#7-gestion-du-temps)
8. [Gestion des Notifications](#8-gestion-des-notifications)
9. [Persistance](#9-persistance)
10. [Internationalisation](#10-internationalisation)
11. [Cas Limites](#11-cas-limites)
12. [Plan d'Implémentation Détaillé](#12-plan-dimplémentation-détaillé)
13. [Analyse des Risques](#13-analyse-des-risques)
14. [Validation Finale](#14-validation-finale)

---

## 1. DIAGNOSTIC DE L'EXISTANT

### 1.1 Stack Technique Actuelle

| Couche | Technologie | Version | Maturité |
|--------|-------------|---------|----------|
| **Frontend** | React 18 + TypeScript | Strict mode | ✅ Production-ready |
| **State Management** | Zustand 4.x | - | ✅ Léger, performant |
| **Backend** | Express.js 4.x | - | ✅ Stable |
| **Base de données** | SQLite (local) + Supabase (cloud) | - | ⚠️ Dual-mode |
| **Real-time** | Polling HTTP | 30s + 15s | ❌ Archaïque |
| **Event Bus** | InMemory (local) | Custom | ⚠️ Isolé |
| **QR Menu** | PublicMenuPage.tsx | - | ⚠️ Pas de countdown |

### 1.2 Architecture Actuelle du QR Menu

```
┌─────────────────────────────────────────────────────────────┐
│                    PublicMenuPage.tsx                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Affichage statique du menu                             ││
│  │  - Catégories                                           ││
│  │  - Produits                                             ││
│  │  - Prix                                                 ││
│  │  - Disponibilité                                        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ❌ PAS DE COMPTE À REBOURS                                 │
│  ❌ PAS DE SUivi DE COMMANDE                                │
│  ❌ PAS DE NOTIFICATIONS INTELLIGENTES                      │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Points Forts

1. ✅ **Architecture DDD** - Documentation exhaustive
2. ✅ **Multi-tenant** - Isolation stricte par `tenant_id`
3. ✅ **TypeScript strict** - Typage fort
4. ✅ **Zustand** - State management performant
5. ✅ **Supabase Realtime** - Infrastructure disponible

### 1.4 Points Faibles Critiques

1. ❌ **Pas de compte à rebours** - Fonctionnalité absente
2. ❌ **Pas de suivi de commande** - Workflow incomplet
3. ❌ **Polling inefficace** - 4 requêtes/min
4. ❌ **Pas de WebSocket** - Temps réel impossible
5. ❌ **Event Bus isolé** - Pas de événements métier
6. ❌ **Pas de résilience** - Sensible aux perturbations réseau
7. ❌ **Pas de design system** - UI incohérente
8. ❌ **Pas d'i18n** - Textes hardcodés

---

## 2. PROBLÈMES IDENTIFIÉS

### 2.1 Problèmes Critiques (🔴)

| ID | Problème | Impact | Sévérité |
|----|----------|--------|----------|
| **P1** | **Source de vérité temps client** - `Date.now()` côté client uniquement | Dérive du timer, incohérences multi-appareils | 🔴 CRITIQUE |
| **P2** | **Timer couplé au polling** - Réinitialisation possible à chaque fetch | UX confuse, timers erratiques | 🔴 CRITIQUE |
| **P3** | **Pas de machine à états** - Workflow de commande flou | États incohérents, bugs métier | 🔴 CRITIQUE |
| **P4** | **Pas de notifications intelligentes** - Spam potentiel | Surcharge utilisateur, désengagement | 🔴 CRITIQUE |
| **P5** | **Pas de résilience** - Pas de survie aux perturbations | Perte de données, UX dégradée | 🔴 CRITIQUE |

### 2.2 Problèmes Majeurs (🟠)

| ID | Problème | Impact | Sévérité |
|----|----------|--------|----------|
| **P6** | **Pas de design system** - UI incohérente | Image de marque dégradée | 🟠 ÉLEVÉ |
| **P7** | **Pas d'i18n** - Textes hardcodés | Marché international limité | 🟠 ÉLEVÉ |
| **P8** | **Pas de persistance** - État perdu au refresh | Perte de données, frustration | 🟠 ÉLEVÉ |
| **P9** | **Backend limité** - Pas de timestamps serveur | Impossibilité de tracker précisément | 🟠 ÉLEVÉ |
| **P10** | **Pas d'accessibilité** - Contrastes, ARIA | Exclusion utilisateurs handicapés | 🟠 ÉLEVÉ |

### 2.3 Problèmes Mineurs (🟡)

| ID | Problème | Impact | Sévérité |
|----|----------|--------|----------|
| **P11** | **Pas de responsive** - Mobile non optimisé | UX mobile dégradée | 🟡 MOYEN |
| **P12** | **Pas de dark mode** - Uniquement light | Fatigue visuelle | 🟡 MOYEN |
| **P13** | **Animations basiques** - Pas de micro-interactions | Sentiment "premium" absent | 🟡 MOYEN |
| **P14** | **Pas de tests E2E** - Couverture insuffisante | Régressions non détectées | 🟡 MOYEN |

---

## 3. ARCHITECTURE CIBLE

### 3.1 Vision Globale

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE ENTERPRISE V2.0                     │
│                  (Uber Eats / Toast POS / Square)                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Client QR      │     │  Global Event    │     │  Order Service   │
│  Menu (Public)  │────▶│  Bus             │────▶│  (Domain)        │
│                 │     │  (Platform-wide) │     │                  │
└─────────────────┘     └────────┬─────────┘     └────────┬─────────┘
                                     │                      │
                                     ▼                      ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Supabase       │     │  Countdown       │     │  Order           │
│  Realtime       │     │  Calculator      │     │  Repository      │
│  (WebSocket)    │     │  (Server-side)   │     │  (Dual-mode)     │
└─────────────────┘     └────────┬─────────┘     └────────┬─────────┘
                                     │                      │
                                     ▼                      ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  WebSocket      │     │  Notification    │     │  Persistence     │
│  (Fallback)     │     │  Manager         │     │  Layer           │
│  WS Server      │     │  (Smart)         │     │  (IndexedDB +    │
│                 │     │                  │     │   Supabase)      │
└─────────────────┘     └────────┬─────────┘     └────────┬─────────┘
                                     │                      │
                                     ▼                      │
┌─────────────────┐     ┌──────────────────┐              │
│  Frontend       │◀────│  State Manager   │◀─────────────┘
│  (Reactive UI)  │     │  (Zustand +      │
│                 │     │   Persistence)   │
└─────────────────┘     └──────────────────┘
```

### 3.2 Principes Architecturaux

#### 3.2.1 Source de Vérité Unique (SSOT - Single Source of Truth)

**Règle d'or:** Le serveur est la source de vérité pour tous les timestamps.

```typescript
// ❌ INTERDIT - Client comme source de vérité
const startTime = Date.now(); // Dépend de l'horloge client
const elapsed = Date.now() - startTime;

// ✅ CORRECT - Serveur comme source de vérité
const serverNow = await getServerTime(); // Timestamp serveur
const elapsed = serverNow - order.confirmed_at; // Toujours précis
```

**Justification:**
- Horloge client peut dériver (NTP non synchronisé)
- Changement d'heure système (DST, timezone)
- Manipulation malveillante du temps
- Multi-appareils avec horloges différentes
- Refresh/reconnexion doivent donner le même résultat

#### 3.2.2 Timer Autonome et Découplé

**Principe:** Le timer est calculé, jamais réinitialisé par le polling.

```typescript
// Le timer est une fonction pure du timestamp serveur
const getRemainingTime = (confirmedAt: string, estimatedMinutes: number): number => {
  const serverNow = getServerTime(); // Source de vérité
  const confirmedAtMs = new Date(confirmedAt).getTime();
  const elapsedMs = serverNow - confirmedAtMs;
  const estimatedMs = estimatedMinutes * 60 * 1000;
  return Math.max(0, estimatedMs - elapsedMs);
};

// Le polling ne fait que mettre à jour serverNow
// Le timer continue naturellement
```

**Avantages:**
- Pas de réinitialisation intempestive
- Cohérence entre tous les clients
- Survie aux refresh/reconnexions
- Pas de dépendance au réseau

#### 3.2.3 Architecture Réactive

```typescript
// Pattern: Server Push + Client Cache
const useOrderCountdown = (orderId: string) => {
  // 1. Initialisation depuis le cache (instantané)
  const cached = getCachedOrder(orderId);
  
  // 2. Subscription au realtime (mise à jour)
  useEffect(() => {
    const channel = supabase
      .channel(`order:${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, 
        (payload) => updateCache(payload.new))
      .subscribe();
    
    return () => supabase.removeChannel(channel);
  }, [orderId]);
  
  // 3. Fallback polling (si realtime échoue)
  useEffect(() => {
    if (!isRealtimeConnected) {
      const interval = setInterval(() => fetchOrderStatus(orderId), 30000);
      return () => clearInterval(interval);
    }
  }, [orderId, isRealtimeConnected]);
  
  return cached;
};
```

---

## 4. MACHINE À ÉTATS COMPLÈTE

### 4.1 Diagramme d'États

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MACHINE À ÉTATS - ORDER LIFECYCLE                │
└─────────────────────────────────────────────────────────────────────┘

                    ┌──────────┐
                    │  pending │
                    └────┬─────┘
                         │
                         │ customer confirms order
                         │ (payment received)
                         ▼
                    ┌──────────┐
                    │ confirmed│
                    └────┬─────┘
                         │
                         │ kitchen starts preparing
                         ▼
                    ┌──────────┐
                    │preparing │
                    └────┬─────┘
                         │
                         │ kitchen finishes
                         ▼
                    ┌──────────┐
                    │  ready   │
                    └────┬─────┘
                         │
                         │ waiter serves
                         ▼
                    ┌──────────┐
                    │  served  │
                    └────┬─────┘
                         │
                         │ payment completed
                         ▼
                    ┌──────────┐
                    │   paid   │
                    └──────────┘

 États terminaux: paid, cancelled
 États intermédiaires: pending → confirmed → preparing → ready → served → paid
```

### 4.2 États Détaillés

#### 4.2.1 `pending`
**Définition:** Commande créée, en attente de confirmation/paiement

| Attribut | Valeur | Description |
|----------|--------|-------------|
| **Timer** | N/A | Pas de timer actif |
| **Couleur** | Gris | `#6b7280` |
| **Icône** | Clock | `⏱️` |
| **Message** | "En attente de confirmation" | i18n: `order.status.pending` |
| **Actions** | Aucune | État passif |
| **Notifications** | Aucune | - |

**Transitions:**
- `pending` → `confirmed` (paiement reçu)
- `pending` → `cancelled` (annulation)

#### 4.2.2 `confirmed`
**Définition:** Commande confirmée, cuisine notifiée, timer démarré

| Attribut | Valeur | Description |
|----------|--------|-------------|
| **Timer** | ✅ Actif | Démarre à `estimated_preparation_time` minutes |
| **Couleur** | Bleu | `#3b82f6` |
| **Icône** | CheckCircle | `✓` |
| **Message** | "Commande confirmée" | i18n: `order.status.confirmed` |
| **Actions** | Aucune | Surveillance passive |
| **Notifications** | Toast + Badge | "Votre commande a été confirmée" |

**Transitions:**
- `confirmed` → `preparing` (cuisine commence)
- `confirmed` → `cancelled` (annulation possible)

**Comportement du Timer:**
```
confirmed_at = 2026-02-07T22:00:00Z (serveur)
estimated_preparation_time = 15 minutes

Timer démarre:
- 22:00:00 → 15:00 restantes
- 22:05:00 → 10:00 restantes
- 22:10:00 → 05:00 restantes (jaune)
- 22:12:00 → 03:00 restantes (rouge clignotant)
- 22:15:00 → 00:00 (expiré)
```

#### 4.2.3 `preparing`
**Définition:** Cuisine en cours de préparation, timer continue

| Attribut | Valeur | Description |
|----------|--------|-------------|
| **Timer** | ✅ Actif | Continue depuis `confirmed_at` |
| **Couleur** | Orange | `#f59e0b` |
| **Icône** | ChefHat | `👨‍🍳` |
| **Message** | "En préparation" | i18n: `order.status.preparing` |
| **Actions** | Aucune | Surveillance passive |
| **Notifications** | Aucune | Pas de spam |

**Transitions:**
- `preparing` → `ready` (prêt)
- `preparing` → `cancelled` (annulation rare)

**Comportement du Timer:**
```
Même timer que confirmed
Pas de réinitialisation
Couleur change: Bleu → Orange
Message change: "En préparation"
```

#### 4.2.4 `ready`
**Définition:** Commande prête, servie au client

| Attribut | Valeur | Description |
|----------|--------|-------------|
| **Timer** | ✅ Actif | Continue (ou arrêté selon UX) |
| **Couleur** | Vert | `#10b981` |
| **Icône** | CheckCircle | `✅` |
| **Message** | "Votre commande est prête!" | i18n: `order.status.ready` |
| **Actions** | Aucune | Notification visuelle forte |
| **Notifications** | Toast + Badge + Animation | "Votre commande est prête!" |

**Transitions:**
- `ready` → `served` (servi)
- `ready` → `paid` (payé directement)

**Comportement du Timer:**
```
Option A: Timer continue (montre le temps total)
Option B: Timer arrêté (montre "Prêt depuis X min")
Recommandé: Option B pour éviter la confusion
```

#### 4.2.5 `served`
**Définition:** Commande servie au client

| Attribut | Valeur | Description |
|----------|--------|-------------|
| **Timer** | ❌ Arrêté | Affichage "Servi" |
| **Couleur** | Vert foncé | `#059669` |
| **Icône** | UserCheck | `🙋` |
| **Message** | "Commandé servi" | i18n: `order.status.served` |
| **Actions** | Aucune | État final intermédiaire |
| **Notifications** | Aucune | - |

**Transitions:**
- `served` → `paid` (paiement)

#### 4.2.6 `paid`
**Définition:** Commande payée, workflow terminé

| Attribut | Valeur | Description |
|----------|--------|-------------|
| **Timer** | ❌ Masqué | Disparition définitive |
| **Couleur** | Vert émeraude | `#10b981` |
| **Icône** | CheckCircle | `✅` |
| **Message** | "Merci pour votre commande!" | i18n: `order.status.paid` |
| **Actions** | Aucune | Fin de workflow |
| **Notifications** | Aucune | - |

**Transitions:**
- État terminal (aucune transition)

#### 4.2.7 `cancelled`
**Définition:** Commande annulée

| Attribut | Valeur | Description |
|----------|--------|-------------|
| **Timer** | ❌ Masqué | Affichage "Annulé" |
| **Couleur** | Rouge | `#ef4444` |
| **Icône** | XCircle | `❌` |
| **Message** | "Commande annulée" | i18n: `order.status.cancelled` |
| **Actions** | Aucune | État terminal |
| **Notifications** | Toast | "Votre commande a été annulée" |

**Transitions:**
- État terminal (aucune transition)

### 4.3 Matrice de Transitions

| From | To | Trigger | Notification |
|------|----|---------|--------------|
| `pending` | `confirmed` | Payment received | ✅ Toast + Badge |
| `pending` | `cancelled` | Customer/Staff cancel | ✅ Toast |
| `confirmed` | `preparing` | Kitchen starts | ❌ Pas de notification |
| `preparing` | `ready` | Kitchen finishes | ✅ Toast + Badge + Animation |
| `preparing` | `cancelled` | Kitchen cancels | ✅ Toast |
| `ready` | `served` | Waiter serves | ❌ Pas de notification |
| `ready` | `paid` | Payment completed | ❌ Pas de notification |
| `served` | `paid` | Payment completed | ❌ Pas de notification |

---

## 5. DIAGRAMME DU FLUX MÉTIER

### 5.1 Flux Complet

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUX MÉTIER COMPLET                          │
└─────────────────────────────────────────────────────────────────────┘

1. CLIENT SCANNE QR CODE
   │
   ▼
2. PUBLIC MENU PAGE S'OUVRE
   │
   ▼
3. CLIENT SÉLECTIONNE PRODUITS
   │
   ▼
4. CLIENT CONFIRME COMMANDE
   │
   ▼
5. PAIEMENT (Mobile Money / Card / Cash)
   │
   ▼
6. ORDER SERVICE CRÉE LA COMMANDE
   │
   ├─► status = 'pending'
   ├─► confirmed_at = null
   ├─► estimated_preparation_time = 15 (min)
   │
   ▼
7. PAIEMENT CONFIRMÉ
   │
   ▼
8. ORDER SERVICE MET À JOUR
   │
   ├─► status = 'confirmed'
   ├─► confirmed_at = NOW() (serveur)
   ├─► ready_at = null
   ├─► served_at = null
   ├─► paid_at = null
   │
   ▼
9. EVENT BUS PUBLIE 'order.confirmed'
   │
   ▼
10. NOTIFICATION MANAGER ENVOIE
    │
    ├─► Toast: "Commande confirmée"
    ├─► Badge: +1
    └─► WebSocket: push notification
    │
    ▼
11. FRONTEND REÇOIT NOTIFICATION
    │
    ├─► CountdownCalculator calcule:
    │   ├─► serverNow = getServerTime()
    │   ├─► elapsed = serverNow - confirmed_at
    │   ├─► remaining = estimated_time - elapsed
    │   └─► progress = elapsed / estimated_time
    │
    ├─► CountdownRing affiche:
    │   ├─► Timer: 15:00 → 14:55 → ... → 00:00
    │   ├─► Couleur: Bleu → Orange → Rouge
    │   └─► Animation: SVG circle stroke-dashoffset
    │
    └─► CountdownStatus affiche:
        ├─► Message: "En préparation"
        └─► Icône: ChefHat
    │
    ▼
12. CUISINE PREND LA COMMANDE
    │
    ▼
13. ORDER SERVICE MET À JOUR
    │
    ├─► status = 'preparing'
    ├─► started_at = NOW() (serveur)
    │
    ▼
14. EVENT BUS PUBLIE 'order.preparing'
    │
    ▼
15. FRONTEND REÇOIT MISE À JOUR
    │
    ├─► CountdownStatus change:
    │   └─► Message: "En préparation"
    │   └─► Couleur: Orange
    │
    └─► Timer CONTINUE (pas de réinitialisation)
    │
    ▼
16. CUISINE TERMINE LA PRÉPARATION
    │
    ▼
17. ORDER SERVICE MET À JOUR
    │
    ├─► status = 'ready'
    ├─► ready_at = NOW() (serveur)
    │
    ▼
18. EVENT BUS PUBLIE 'order.ready'
    │
    ▼
19. NOTIFICATION MANAGER ENVOIE
    │
    ├─► Toast: "Votre commande est prête!"
    ├─► Badge: +1
    ├─► Animation: Pulse + Son
    └─► WebSocket: push notification
    │
    ▼
20. FRONTEND REÇOIT MISE À JOUR
    │
    ├─► CountdownRing:
    │   ├─► Couleur: Vert
    │   └─► Animation: Checkmark
    │
    ├─► CountdownStatus:
    │   ├─► Message: "Votre commande est prête!"
    │   └─► Icône: CheckCircle
    │
    └─► CountdownActions:
        └─► Affichage: "Votre commande vous attend"
    │
    ▼
21. SERVEUR APPORTE LA COMMANDE
    │
    ▼
22. ORDER SERVICE MET À JOUR
    │
    ├─► status = 'served'
    ├─► served_at = NOW() (serveur)
    │
    ▼
23. FRONTEND REÇOIT MISE À JOUR
    │
    ├─► CountdownRing: Masqué ou arrêté
    ├─► CountdownStatus:
    │   └─► Message: "Commandé servi"
    │
    └─► CountdownActions: Masqué
    │
    ▼
24. CLIENT PAYE (si pas déjà fait)
    │
    ▼
25. ORDER SERVICE MET À JOUR
    │
    ├─► status = 'paid'
    ├─► paid_at = NOW() (serveur)
    │
    ▼
26. FRONTEND REÇOIT MISE À JOUR
    │
    ├─► CountdownRing: Disparition définitive
    ├─► CountdownStatus:
    │   └─► Message: "Merci pour votre commande!"
    │
    └─► CountdownActions: Masqué
    │
    ▼
27. FIN DU WORKFLOW
```

### 5.2 Flux de Données

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUX DE DONNÉES - TIMER                          │
└─────────────────────────────────────────────────────────────────────┘

1. SERVEUR (Source de vérité)
   │
   ├─► confirmed_at = "2026-02-07T22:00:00Z"
   ├─► estimated_preparation_time = 15 (minutes)
   │
   ▼
2. API ENDPOINT
   │
   ├─► GET /api/menu/order-status/:orderId
   ├─► Response:
   │   {
   │     "status": "preparing",
   │     "confirmed_at": "2026-02-07T22:00:00Z",
   │     "estimated_preparation_time": 15,
   │     "server_now": "2026-02-07T22:07:30Z" // ← Source de vérité
   │   }
   │
   ▼
3. FRONTEND - CountdownCalculator
   │
   ├─► serverNow = 2026-02-07T22:07:30Z
   ├─► confirmedAt = 2026-02-07T22:00:00Z
   ├─► elapsed = 7 min 30 sec
   ├─► remaining = 15 - 7.5 = 7 min 30 sec
   ├─► progress = 7.5 / 15 = 50%
   │
   ▼
4. FRONTEND - CountdownRing
   │
   ├─► Affiche: 07:30
   ├─► Couleur: Orange (50% < 75%)
   ├─► Animation: stroke-dashoffset = 50%
   │
   ▼
5. POLLING (toutes les 30s)
   │
   ├─► GET /api/menu/order-status/:orderId
   ├─► serverNow = 2026-02-07T22:08:00Z (nouvelle valeur)
   ├─► elapsed = 8 min
   ├─► remaining = 7 min
   │
   ✅ Timer continue naturellement
   ✅ Pas de réinitialisation
   ✅ Cohérence garantie
```

---

## 6. DESIGN SYSTEM PREMIUM

### 6.1 Principes de Design

**Inspiration:** Uber Eats, Toast POS, Square, Deliveroo, Stripe

**Valeurs:**
- **Clarity:** Information claire et lisible
- **Efficiency:** Accès rapide à l'information critique
- **Delight:** Micro-interactions agréables
- **Trust:** Transparence et fiabilité

### 6.2 Tokens de Design

#### 6.2.1 Spacing

```typescript
export const spacing = {
  // Base unit: 4px
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
  
  // Specific
  countdownRing: {
    thickness: '0.5rem',      // 8px
    gap: '0.25rem',           // 4px
  },
  card: {
    padding: '1.5rem',        // 24px
    borderRadius: '1rem',     // 16px
  }
} as const;
```

#### 6.2.2 Border Radius

```typescript
export const borderRadius = {
  none: '0',
  sm: '0.25rem',    // 4px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',
  
  // Specific
  countdownRing: '50%',      // Circle
  card: '1rem',              // 16px
  button: '0.5rem',          // 8px
  badge: '9999px',           // Pill
} as const;
```

#### 6.2.3 Elevation (Ombres)

```typescript
export const elevation = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  
  // Specific
  countdownCard: '0 10px 40px -10px rgba(0, 0, 0, 0.15)',
  toast: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  badge: '0 2px 8px rgba(0, 0, 0, 0.15)',
} as const;
```

#### 6.2.4 Palette de Couleurs

```typescript
export const colors = {
  // Primary
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',  // Main
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  
  // Success (Ready)
  success: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',  // Main
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
  },
  
  // Warning (Preparing)
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',  // Main
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  
  // Danger (Expired/Cancelled)
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',  // Main
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  
  // Neutral
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  
  // Semantic
  confirmed: '#3b82f6',   // Blue
  preparing: '#f59e0b',   // Orange
  ready: '#10b981',       // Green
  served: '#059669',      // Dark Green
  paid: '#10b981',        // Green
  cancelled: '#ef4444',   // Red
  expired: '#dc2626',     // Dark Red
} as const;
```

#### 6.2.5 Typographie

```typescript
export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Monaco, Consolas, monospace',
  },
  
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
  },
  
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
  
  // Specific
  countdown: {
    timer: {
      fontSize: '3rem',      // 48px
      fontWeight: '700',
      lineHeight: '1',
      letterSpacing: '-0.02em',
    },
    message: {
      fontSize: '1.125rem',  // 18px
      fontWeight: '600',
      lineHeight: '1.5',
    },
    status: {
      fontSize: '0.875rem',  // 14px
      fontWeight: '500',
      lineHeight: '1.5',
    }
  }
} as const;
```

#### 6.2.6 Animations

```typescript
export const animations = {
  duration: {
    instant: '100ms',
    fast: '200ms',
    normal: '300ms',
    slow: '500ms',
    slower: '700ms',
  },
  
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Bounce
    smooth: 'cubic-bezier(0.16, 1, 0.3, 1)', // Premium feel
  },
  
  // Specific animations
  countdown: {
    ring: {
      duration: '300ms',
      easing: 'easeInOut',
    },
    pulse: {
      duration: '2000ms',
      easing: 'easeInOut',
      iterationCount: 'infinite',
    },
    slideIn: {
      duration: '300ms',
      easing: 'smooth',
    },
    fadeIn: {
      duration: '200ms',
      easing: 'easeOut',
    },
  }
} as const;
```

### 6.3 Composants du Design System

#### 6.3.1 CountdownCard

```tsx
// Structure
<CountdownCard>
  <CountdownRing />        // Timer circulaire SVG
  <CountdownStatus />      // Message + Icône
  <CountdownActions />     // Actions (si applicable)
</CountdownCard>
```

**Spécifications:**
- Background: `neutral.50` (light) / `neutral.900` (dark)
- Border radius: `1rem` (16px)
- Padding: `1.5rem` (24px)
- Shadow: `elevation.countdownCard`
- Max width: `400px`
- Centered: `mx-auto`

#### 6.3.2 CountdownRing

```tsx
// Structure
<CountdownRing>
  <svg>
    <circle /> {/* Background */}
    <circle /> {/* Progress */}
  </svg>
  <CountdownTimer /> {/* Texte central */}
</CountdownRing>
```

**Spécifications:**
- Size: `200px` × `200px`
- Stroke width: `8px`
- Colors:
  - Confirmed: `colors.confirmed` (Blue)
  - Preparing: `colors.preparing` (Orange)
  - Ready: `colors.ready` (Green)
  - Served: `colors.served` (Dark Green)
  - Expired: `colors.expired` (Red)
- Animation: `stroke-dashoffset` transition `300ms ease-in-out`
- Pulse: `2s infinite` when ready/expired

#### 6.3.3 CountdownStatus

```tsx
// Structure
<CountdownStatus>
  <Icon />        {/* Lucide icon */}
  <Message />     {/* i18n text */}
  <Submessage />  {/* Optional */}
</CountdownStatus>
```

**Spécifications:**
- Icon size: `48px`
- Icon color: Same as ring
- Message: `typography.countdown.message`
- Submessage: `typography.countdown.status`
- Alignment: `text-center`
- Margin top: `1rem`

#### 6.3.4 CountdownActions

```tsx
// Structure
<CountdownActions>
  <Button />      {/* Primary action */}
  <Button />      {/* Secondary action */}
</CountdownActions>
```

**Spécifications:**
- Display: `flex` `gap: 0.5rem`
- Direction: `column` (mobile) / `row` (desktop)
- Button primary: `primary.500` background
- Button secondary: `neutral.200` background

### 6.4 Responsive Design

```typescript
export const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
} as const;

// CountdownCard responsive
const countdownCardStyles = {
  width: '100%',
  maxWidth: '400px',
  padding: {
    default: '1.5rem',      // Mobile
    md: '2rem',             // Tablet+
  },
  countdownRing: {
    size: {
      default: '180px',     // Mobile
      sm: '200px',          // Landscape
      md: '220px',           // Tablet+
    }
  }
};
```

### 6.5 Dark Mode

```typescript
export const darkMode = {
  background: {
    card: '#0f0f14',        // Dark background
    page: '#000000',        // Pure black
  },
  text: {
    primary: '#ffffff',
    secondary: '#a1a1aa',
    muted: '#71717a',
  },
  border: {
    color: 'rgba(255, 255, 255, 0.1)',
  },
  shadow: {
    countdownCard: '0 10px 40px -10px rgba(0, 0, 0, 0.5)',
  }
};
```

### 6.6 Accessibilité

```typescript
export const accessibility = {
  // Contrast ratios (WCAG AA)
  contrast: {
    minimum: 4.5,           // Normal text
    large: 3.0,             // Large text (18px+)
    enhanced: 7.0,          // AAA
  },
  
  // Focus indicators
  focus: {
    ring: '2px solid #3b82f6',
    offset: '2px',
  },
  
  // ARIA labels
  aria: {
    countdown: 'Temps restant: {minutes} minutes {seconds} secondes',
    status: 'Statut de la commande: {status}',
    ready: 'Votre commande est prête!',
    expired: 'Le temps estimé est écoulé. Votre commande arrive bientôt.',
  },
  
  // Screen reader only
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: '0',
  }
};
```

### 6.7 Micro-interactions

```typescript
export const microInteractions = {
  // Hover effects
  hover: {
    scale: '1.02',
    shadow: 'elevation.lg',
    transition: 'all 200ms ease-out',
  },
  
  // Press effects
  press: {
    scale: '0.98',
    transition: 'all 100ms ease-in',
  },
  
  // Loading skeleton
  skeleton: {
    shimmer: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    animation: 'shimmer 1.5s infinite',
  },
  
  // Success checkmark
  checkmark: {
    animation: 'scaleIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  
  // Pulse for ready state
  pulse: {
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  }
};
```

---

## 7. GESTION DU TEMPS

### 7.1 Source de Vérité: Timestamp Serveur

**Règle absolue:** Le serveur est la seule source de vérité pour le temps.

```typescript
// Backend: Order Entity
interface Order {
  id: string;
  tenant_id: string;
  status: OrderStatus;
  
  // Timestamps serveur (source de vérité)
  confirmed_at: string | null;      // ISO 8601
  started_at: string | null;        // ISO 8601
  ready_at: string | null;          // ISO 8601
  served_at: string | null;         // ISO 8601
  paid_at: string | null;           // ISO 8601
  
  // Configuration
  estimated_preparation_time: number; // minutes
  
  // Métadonnées
  created_at: string;               // ISO 8601
  updated_at: string;               // ISO 8601
}
```

### 7.2 Calcul du Timer Côté Client

```typescript
// CountdownCalculator.ts
export class CountdownCalculator {
  /**
   * Calcule le temps restant à partir de la source de vérité serveur
   * 
   * @param order - La commande avec ses timestamps
   * @param serverNow - Timestamp actuel du serveur (source de vérité)
   * @returns Temps restant en secondes
   */
  static calculateRemainingTime(
    order: Order,
    serverNow: Date
  ): number {
    // Cas 1: Commande pas encore confirmée
    if (!order.confirmed_at || order.status === 'pending') {
      return 0;
    }
    
    // Cas 2: Commande déjà payée
    if (order.status === 'paid') {
      return 0;
    }
    
    // Cas 3: Calcul du temps écoulé
    const confirmedAt = new Date(order.confirmed_at);
    const elapsedMs = serverNow.getTime() - confirmedAt.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    
    // Cas 4: Estimation dépassée
    const estimatedSeconds = order.estimated_preparation_time * 60;
    const remaining = estimatedSeconds - elapsedSeconds;
    
    return Math.max(0, remaining);
  }
  
  /**
   * Calcule le progrès (0-100%)
   */
  static calculateProgress(order: Order, serverNow: Date): number {
    if (!order.confirmed_at || order.status === 'pending') {
      return 0;
    }
    
    const confirmedAt = new Date(order.confirmed_at);
    const elapsedMs = serverNow.getTime() - confirmedAt.getTime();
    const estimatedMs = order.estimated_preparation_time * 60 * 1000;
    
    const progress = (elapsedMs / estimatedMs) * 100;
    return Math.min(100, Math.max(0, progress));
  }
  
  /**
   * Détermine l'état visuel du timer
   */
  static getTimerState(order: Order, serverNow: Date): TimerState {
    const remaining = this.calculateRemainingTime(order, serverNow);
    const progress = this.calculateProgress(order, serverNow);
    
    if (order.status === 'ready' || order.status === 'served' || order.status === 'paid') {
      return 'completed';
    }
    
    if (remaining === 0) {
      return 'expired';
    }
    
    if (progress >= 75) {
      return 'critical';
    }
    
    if (progress >= 50) {
      return 'warning';
    }
    
    return 'normal';
  }
}
```

### 7.3 Récupération du Timestamp Serveur

```typescript
// api-client.ts
export const api = {
  /**
   * Récupère le timestamp serveur (source de vérité)
   * Utilisé pour calculer les timers
   */
  async getServerTime(): Promise<Date> {
    const response = await fetch('/api/server-time');
    const { timestamp } = await response.json();
    return new Date(timestamp);
  },
  
  /**
   * Récupère le statut d'une commande avec timestamp serveur
   */
  async getOrderStatus(orderId: string): Promise<OrderStatusResponse> {
    const response = await fetch(`/api/menu/order-status/${orderId}`);
    return response.json();
  }
};

// Response format
interface OrderStatusResponse {
  order: Order;
  server_now: string;  // ISO 8601 - Source de vérité
}
```

### 7.4 Synchronisation Périodique

```typescript
// useServerTime.ts
export function useServerTime(syncInterval: number = 30000) {
  const [serverNow, setServerNow] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Synchronisation périodique avec le serveur
  useEffect(() => {
    const sync = async () => {
      try {
        setIsSyncing(true);
        const time = await api.getServerTime();
        setServerNow(time);
      } catch (error) {
        console.error('[ServerTime] Sync failed:', error);
        // Fallback: utiliser Date.now() avec avertissement
        console.warn('[ServerTime] Using client time as fallback');
      } finally {
        setIsSyncing(false);
      }
    };
    
    // Sync initiale
    sync();
    
    // Sync périodique (toutes les 30s)
    const interval = setInterval(sync, syncInterval);
    
    return () => clearInterval(interval);
  }, [syncInterval]);
  
  // Calcul du drift (dérive) pour logging
  const getDrift = useCallback(() => {
    const clientNow = new Date();
    const driftMs = clientNow.getTime() - serverNow.getTime();
    return driftMs;
  }, [serverNow]);
  
  return { serverNow, isSyncing, getDrift };
}
```

### 7.5 Gestion des Cas Limites

#### 7.5.1 Changement d'Heure Système (DST)

```typescript
// ❌ PROBLÈME
const elapsed = Date.now() - confirmed_at; // Décalage si changement d'heure

// ✅ SOLUTION
const elapsed = serverNow - confirmed_at; // Toujours correct
```

**Justification:**
- Le serveur utilise UTC (pas de DST)
- `serverNow` est toujours en UTC
- Pas de dérive lors des changements d'heure

#### 7.5.2 Perte de Connexion Réseau

```typescript
// Stratégie: Continuer avec le dernier serverNow connu
const useCountdownWithOfflineSupport = (order: Order) => {
  const { serverNow, isSyncing } = useServerTime();
  const [lastKnownServerNow, setLastKnownServerNow] = useState<Date>(serverNow);
  
  useEffect(() => {
    if (!isSyncing) {
      setLastKnownServerNow(serverNow);
    }
  }, [serverNow, isSyncing]);
  
  // Utiliser lastKnownServerNow si offline
  const effectiveServerNow = isSyncing ? lastKnownServerNow : serverNow;
  
  const remaining = CountdownCalculator.calculateRemainingTime(order, effectiveServerNow);
  
  return { remaining, isOffline: isSyncing };
};
```

#### 7.5.3 Reconnexion Après Perte Réseau

```typescript
// Au rechargement/reconnexion:
// 1. Récupérer serverNow frais
// 2. Recalculer le timer
// 3. Afficher la valeur correcte

useEffect(() => {
  const handleOnline = async () => {
    console.log('[Countdown] Back online - syncing');
    const time = await api.getServerTime();
    setServerNow(time);
  };
  
  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}, []);
```

#### 7.5.4 Multi-Appareils

```typescript
// Client A: iPhone
// - confirmed_at = 22:00:00
// - serverNow = 22:05:00
// - remaining = 10 min

// Client B: Android (même commande)
// - confirmed_at = 22:00:00 (même valeur)
// - serverNow = 22:05:00 (même valeur)
// - remaining = 10 min (cohérent!)

// ✅ Cohérence garantie par la source de vérité serveur
```

---

## 8. GESTION DES NOTIFICATIONS INTELLIGENTES

### 8.1 Stratégie de Notification

**Principe:** Notifier au bon moment, pas trop souvent, avec le bon canal.

```
┌─────────────────────────────────────────────────────────────────────┐
│              STRATÉGIE DE NOTIFICATION INTELLIGENTE                  │
└─────────────────────────────────────────────────────────────────────┘

Objectif: Informer sans spammer

Règles:
1. Une notification par transition d'état (max 5 par commande)
2. Délais minimum entre notifications
3. Agrégation si plusieurs commandes
4. Respect des préférences utilisateur
5. Canal adapté au contexte
```

### 8.2 Matrice de Notification

| État | Notification | Canal | Priorité | Délai Min |
|------|--------------|-------|----------|-----------|
| `confirmed` | ✅ Toast + Badge | In-app | high | 0 min |
| `preparing` | ❌ Pas de notification | - | - | - |
| `ready` | ✅ Toast + Badge + Animation | In-app + Son | critical | 0 min |
| `served` | ❌ Pas de notification | - | - | - |
| `paid` | ❌ Pas de notification | - | - | - |
| `cancelled` | ✅ Toast | In-app | high | 0 min |

### 8.3 Notification Intelligente: Countdown

```typescript
// NotificationStrategy.ts
export class CountdownNotificationStrategy {
  private lastNotificationTime: Map<string, number> = new Map();
  
  /**
   * Détermine si une notification doit être envoyée
   * 
   * Règles:
   * - 0 min: Notification à confirmed
   * - 5 min avant expiration: Rappel
   * - 1 min avant expiration: Alerte
   * - 0 min (expiré): Notification d'expiration
   * - Puis toutes les 30 min: Rappel
   */
  shouldNotify(order: Order, serverNow: Date): NotificationDecision {
    const orderId = order.id;
    const lastNotif = this.lastNotificationTime.get(orderId) || 0;
    const timeSinceLastNotif = serverNow.getTime() - lastNotif;
    
    // Cas 1: Commande confirmée
    if (order.status === 'confirmed' && !order.notified_confirmed) {
      return {
        shouldNotify: true,
        reason: 'order_confirmed',
        delay: 0,
      };
    }
    
    // Cas 2: Commande prête
    if (order.status === 'ready' && !order.notified_ready) {
      return {
        shouldNotify: true,
        reason: 'order_ready',
        delay: 0,
        priority: 'critical',
      };
    }
    
    // Cas 3: Countdown notifications
    if (['confirmed', 'preparing'].includes(order.status)) {
      const remaining = CountdownCalculator.calculateRemainingTime(order, serverNow);
      const remainingMinutes = Math.floor(remaining / 60);
      
      // 5 minutes avant expiration
      if (remainingMinutes === 5 && remainingSeconds < 60) {
        const minDelay = 5 * 60 * 1000; // 5 minutes minimum entre notifs
        if (timeSinceLastNotif > minDelay) {
          return {
            shouldNotify: true,
            reason: 'countdown_5min',
            delay: 0,
            priority: 'medium',
          };
        }
      }
      
      // 1 minute avant expiration
      if (remainingMinutes === 1 && remainingSeconds < 60) {
        const minDelay = 1 * 60 * 1000; // 1 minute minimum
        if (timeSinceLastNotif > minDelay) {
          return {
            shouldNotify: true,
            reason: 'countdown_1min',
            delay: 0,
            priority: 'high',
          };
        }
      }
      
      // Expiré
      if (remaining === 0 && !order.notified_expired) {
        return {
          shouldNotify: true,
          reason: 'countdown_expired',
          delay: 0,
          priority: 'high',
        };
      }
      
      // Rappel toutes les 30 minutes après expiration
      if (remaining === 0 && timeSinceLastNotif > 30 * 60 * 1000) {
        return {
          shouldNotify: true,
          reason: 'countdown_reminder',
          delay: 0,
          priority: 'low',
        };
      }
    }
    
    return { shouldNotify: false };
  }
}
```

### 8.4 Agrégation de Notifications

```typescript
// NotificationAggregator.ts
export class NotificationAggregator {
  /**
   * Agrège les notifications pour éviter le spam
   * 
   * Exemple:
   * - 3 commandes prêtes → 1 notification: "3 commandes sont prêtes"
   * - 2 commandes en retard → 1 notification: "2 commandes sont en retard"
   */
  aggregate(notifications: Notification[]): AggregatedNotification[] {
    const groups = this.groupBy(notifications, [
      'reason',
      'priority',
    ]);
    
    return groups.map(([key, notifs]) => {
      const [reason, priority] = key;
      const count = notifs.length;
      
      return {
        reason,
        priority,
        count,
        message: this.formatAggregatedMessage(reason, count),
        orders: notifs.map(n => n.order_id),
      };
    });
  }
  
  private formatAggregatedMessage(reason: string, count: number): string {
    switch (reason) {
      case 'order_ready':
        return count === 1
          ? 'Votre commande est prête!'
          : `${count} commandes sont prêtes!`;
      
      case 'countdown_expired':
        return count === 1
          ? 'Votre commande prend du retard'
          : `${count} commandes prennent du retard`;
      
      default:
        return `${count} notification(s)`;
    }
  }
}
```

### 8.5 Respect des Préférences Utilisateur

```typescript
// NotificationPreferences.ts
interface NotificationPreferences {
  user_id: string;
  tenant_id: string;
  
  // Canaux
  channels: {
    toast: boolean;
    badge: boolean;
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  
  // Types
  types: {
    order_confirmed: boolean;
    order_ready: boolean;
    order_cancelled: boolean;
    countdown_reminders: boolean;
  };
  
  // Horaires (ne pas déranger)
  quiet_hours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
    timezone: string;
  };
  
  // Agrégation
  aggregation: {
    enabled: boolean;
    max_notifications_per_hour: number;
  };
}
```

---

## 9. PERSISTANCE

### 9.1 Architecture de Persistance

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE DE PERSISTANCE                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  IndexedDB      │     │  Zustand Store   │     │  Supabase        │
│  (Local)        │     │  (Mémoire)       │     │  (Cloud)         │
│                 │     │                  │     │                  │
│ - Orders cache  │◄───│ - orders         │◄───│ - orders table   │
│ - Notifications │     │ - notifications  │     │ - notifications  │
│ - Preferences   │     │ - preferences    │     │ - preferences    │
│                 │     │                  │     │                  │
│ TTL: 24h       │     │ TTL: Session     │     │ TTL: Permanent   │
└─────────────────┘     └──────────────────┘     └──────────────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Sync Manager          │
                    │   (Bidirectional)       │
                    └────────────────────────┘
```

### 9.2 IndexedDB Schema

```typescript
// db/schema.ts
export const DB_SCHEMA = {
  name: 'ekala-pos-db',
  version: 1,
  stores: {
    orders: {
      keyPath: 'id',
      indexes: ['tenant_id', 'status', 'created_at'],
    },
    notifications: {
      keyPath: 'id',
      indexes: ['order_id', 'read', 'created_at'],
    },
    preferences: {
      keyPath: 'user_id',
    },
  },
};

// Order record
interface OrderRecord {
  id: string;
  tenant_id: string;
  status: OrderStatus;
  confirmed_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  paid_at: string | null;
  estimated_preparation_time: number;
  items: OrderItem[];
  cached_at: string; // ISO 8601
}
```

### 9.3 Sync Strategy

```typescript
// SyncManager.ts
export class SyncManager {
  private db: IDBDatabase;
  private supabase: SupabaseClient;
  
  /**
   * Synchronisation bidirectionnelle
   * 
   * 1. Push: Envoyer les modifications locales au serveur
   * 2. Pull: Récupérer les modifications serveur
   * 3. Resolve: Résoudre les conflits (last-write-wins)
   */
  async sync(): Promise<SyncResult> {
    // 1. Push local changes
    const localChanges = await this.getLocalChanges();
    await this.pushToServer(localChanges);
    
    // 2. Pull server changes
    const serverChanges = await this.pullFromServer();
    
    // 3. Merge (last-write-wins)
    await this.merge(serverChanges);
    
    // 4. Update cache
    await this.updateCache();
    
    return { success: true, syncedAt: new Date() };
  }
  
  /**
   * Survie aux perturbations:
   * - Offline: Queue les modifications
   * - Reconnect: Sync automatique
   * - Conflict: Last-write-wins (timestamp serveur)
   */
}
```

### 9.4 Cache Invalidation

```typescript
// CacheStrategy.ts
export class CacheStrategy {
  /**
   * Stratège d'invalidation de cache
   * 
   * Règles:
   * 1. TTL: 5 minutes pour les commandes actives
   * 2. Invalidation: Sur changement de statut
   * 3. Stale-while-revalidate: Afficher cache + revalidate
   */
  
  static getTTL(order: Order): number {
    // Commandes actives: 5 minutes
    if (['confirmed', 'preparing', 'ready'].includes(order.status)) {
      return 5 * 60 * 1000;
    }
    
    // Commandes terminées: 24 heures
    if (['served', 'paid', 'cancelled'].includes(order.status)) {
      return 24 * 60 * 60 * 1000;
    }
    
    // Par défaut: 1 heure
    return 60 * 60 * 1000;
  }
  
  static isStale(order: Order): boolean {
    const cachedAt = new Date(order.cached_at);
    const now = new Date();
    const ttl = this.getTTL(order);
    
    return now.getTime() - cachedAt.getTime() > ttl;
  }
}
```

---

## 10. INTERNATIONALISATION

### 10.1 Structure i18n

```typescript
// i18n/notifications.ts
export const notificationsTranslations = {
  fr: {
    notifications: {
      title: 'Notifications',
      unread: {
        singular: '{count} non lue',
        plural: '{count} non lues',
      },
      actions: {
        markAllRead: 'Tout lire',
        close: 'Fermer',
      },
      empty: {
        all: 'Aucune notification',
        unread: 'Aucune notification non lue',
      },
    },
  },
  
  en: {
    notifications: {
      title: 'Notifications',
      unread: {
        singular: '{count} unread',
        plural: '{count} unread',
      },
      actions: {
        markAllRead: 'Mark all as read',
        close: 'Close',
      },
      empty: {
        all: 'No notifications',
        unread: 'No unread notifications',
      },
    },
  },
  
  pt: {
    notifications: {
      title: 'Notificações',
      unread: {
        singular: '{count} não lida',
        plural: '{count} não lidas',
      },
      actions: {
        markAllRead: 'Marcar todas como lidas',
        close: 'Fechar',
      },
      empty: {
        all: 'Nenhuma notificação',
        unread: 'Nenhuma notificação não lida',
      },
    },
  },
} as const;
```

### 10.2 Traductions du Compte à Rebours

```typescript
// i18n/countdown.ts
export const countdownTranslations = {
  fr: {
    countdown: {
      // États
      pending: 'En attente de confirmation',
      confirmed: 'Commande confirmée',
      preparing: 'En préparation',
      ready: 'Votre commande est prête!',
      served: 'Commandé servi',
      paid: 'Merci pour votre commande!',
      cancelled: 'Commande annulée',
      expired: 'Le temps estimé est écoulé',
      
      // Messages
      estimatedTime: 'Temps estimé: {minutes} min',
      remainingTime: 'Temps restant: {minutes} min {seconds} sec',
      readySince: 'Prêt depuis {minutes} min',
      
      // Notifications
      notifications: {
        confirmed: 'Votre commande a été confirmée',
        ready: 'Votre commande est prête!',
        cancelled: 'Votre commande a été annulée',
        expired: 'Votre commande prend du retard',
      },
      
      // Accessibilité
      aria: {
        countdown: 'Temps restant: {minutes} minutes {seconds} secondes',
        status: 'Statut: {status}',
        progress: 'Progression: {progress}%',
      },
    },
  },
  
  en: {
    countdown: {
      // États
      pending: 'Waiting for confirmation',
      confirmed: 'Order confirmed',
      preparing: 'Being prepared',
      ready: 'Your order is ready!',
      served: 'Order served',
      paid: 'Thank you for your order!',
      cancelled: 'Order cancelled',
      expired: 'Estimated time has elapsed',
      
      // Messages
      estimatedTime: 'Estimated time: {minutes} min',
      remainingTime: 'Remaining: {minutes} min {seconds} sec',
      readySince: 'Ready for {minutes} min',
      
      // Notifications
      notifications: {
        confirmed: 'Your order has been confirmed',
        ready: 'Your order is ready!',
        cancelled: 'Your order has been cancelled',
        expired: 'Your order is taking longer than expected',
      },
      
      // Accessibilité
      aria: {
        countdown: 'Time remaining: {minutes} minutes {seconds} seconds',
        status: 'Status: {status}',
        progress: 'Progress: {progress}%',
      },
    },
  },
  
  pt: {
    countdown: {
      // États
      pending: 'Aguardando confirmação',
      confirmed: 'Pedido confirmado',
      preparing: 'Em preparação',
      ready: 'Seu pedido está pronto!',
      served: 'Pedido servido',
      paid: 'Obrigado pelo seu pedido!',
      cancelled: 'Pedido cancelado',
      expired: 'Tempo estimado esgotado',
      
      // Messages
      estimatedTime: 'Tempo estimado: {minutes} min',
      remainingTime: 'Tempo restante: {minutes} min {seconds} seg',
      readySince: 'Pronto há {minutes} min',
      
      // Notifications
      notifications: {
        confirmed: 'Seu pedido foi confirmado',
        ready: 'Seu pedido está pronto!',
        cancelled: 'Seu pedido foi cancelado',
        expired: 'Seu pedido está demorando mais que o esperado',
      },
      
      // Accessibilité
      aria: {
        countdown: 'Tempo restante: {minutes} minutos {seconds} segundos',
        status: 'Status: {status}',
        progress: 'Progresso: {progress}%',
      },
    },
  },
} as const;
```

### 10.3 Utilisation dans les Composants

```tsx
// CountdownStatus.tsx
import { useTranslation } from 'react-i18next';

export const CountdownStatus: React.FC<{ order: Order }> = ({ order }) => {
  const { t } = useTranslation();
  
  const getMessage = () => {
    switch (order.status) {
      case 'pending':
        return t('countdown.pending');
      case 'confirmed':
        return t('countdown.confirmed');
      case 'preparing':
        return t('countdown.preparing');
      case 'ready':
        return t('countdown.ready');
      case 'served':
        return t('countdown.served');
      case 'paid':
        return t('countdown.paid');
      case 'cancelled':
        return t('countdown.cancelled');
      default:
        return '';
    }
  };
  
  return (
    <div className="countdown-status">
      <Icon name={getIcon(order.status)} />
      <p>{getMessage()}</p>
    </div>
  );
};
```

---

## 11. CAS LIMITES

### 11.1 Scénarios de Test

#### 11.1.1 Refresh de Page

```
Scénario: Utilisateur rafraîchit la page pendant le countdown

1. Order confirmed à 22:00:00
2. User rafraîchit à 22:05:00
3. Frontend charge depuis IndexedDB
4. Frontend fetch order status + server_now
5. CountdownCalculator calcule:
   - serverNow = 22:05:00
   - confirmedAt = 22:00:00
   - remaining = 10 min
6. Affichage: 10:00 (correct!)

✅ Survie au refresh
```

#### 11.1.2 Perte de Connexion

```
Scénario: Connexion perdue pendant 2 minutes

1. Order confirmed à 22:00:00
2. Connexion perdue à 22:05:00
3. Frontend continue avec lastKnownServerNow = 22:05:00
4. Client utilise Date.now() en fallback (avec avertissement)
5. Connexion rétablie à 22:07:00
6. Frontend sync avec serveur
7. serverNow = 22:07:00
8. remaining = 8 min (correct!)

✅ Survie à la perte de connexion
```

#### 11.1.3 Changement d'Appareil

```
Scénario: Même commande, 2 appareils différents

Appareil A (iPhone):
- confirmed_at = 22:00:00
- serverNow = 22:05:00
- remaining = 10 min

Appareil B (Android):
- confirmed_at = 22:00:00 (même valeur)
- serverNow = 22:05:00 (même valeur)
- remaining = 10 min (cohérent!)

✅ Cohérence multi-appareils
```

#### 11.1.4 Changement d'Heure Système (DST)

```
Scénario: Changement d'heure (été/hiver) pendant le countdown

1. Order confirmed à 21:30:00 (UTC)
2. Changement d'heure à 22:00:00 (local)
3. Serveur utilise UTC (pas de changement)
4. serverNow = 22:00:00 UTC
5. confirmedAt = 21:30:00 UTC
6. elapsed = 30 min (correct!)

✅ Pas de dérive DST
```

#### 11.1.5 Reconnexion Après Perte Réseau

```
Scénario: Perte réseau 5 minutes, puis reconnexion

1. Order confirmed à 22:00:00
2. Réseau perdu à 22:03:00
3. Frontend continue avec lastKnownServerNow = 22:03:00
4. Réseau rétabli à 22:08:00
5. Frontend fetch server_now frais
6. serverNow = 22:08:00
7. remaining = 7 min (correct!)

✅ Survie à la reconnexion
```

#### 11.1.6 Synchronisation Supabase

```
Scénario: Sync Supabase en temps réel

1. Order confirmed à 22:00:00
2. Supabase Realtime push update à 22:05:00
3. Frontend reçoit: { status: 'preparing', started_at: '22:05:00' }
4. CountdownCalculator recalcule:
   - serverNow = 22:05:00
   - confirmedAt = 22:00:00
   - remaining = 10 min
5. UI update: Message change → "En préparation"
6. Timer continue (pas de réinitialisation)

✅ Sync temps réel
```

#### 11.1.7 Changement de Rôle Utilisateur

```
Scénario: Utilisateur change de rôle (client → staff)

1. Client voit countdown
2. Utilisateur se reconnecte en tant que staff
3. Frontend détecte changement de rôle
4. Countdown masqué (staff n'a pas besoin de countdown)
5. Interface staff affichée

✅ Adaptation au rôle
```

### 11.2 Table de Récupération

| Scénario | Solution | Résultat |
|----------|----------|----------|
| Refresh page | IndexedDB + API fetch | ✅ Timer correct |
| Perte réseau | lastKnownServerNow + fallback | ✅ Timer continue |
| Changement appareil | Source de vérité serveur | ✅ Cohérence |
| Changement heure (DST) | UTC serveur | ✅ Pas de dérive |
| Reconnexion | Sync automatique | ✅ Timer correct |
| Sync Supabase | Realtime push | ✅ UI à jour |
| Changement rôle | Détection + masquage | ✅ Adaptation |

---

## 12. PLAN D'IMPLÉMENTATION DÉTAILLÉ

### 12.1 Phases de Développement

#### Phase 1: Foundation (Semaine 1-2) - CRITIQUE

**Objectif:** Corriger les bugs critiques et préparer l'architecture

##### Étape 1.1: Backend - Timestamps Serveur (Jour 1-3)

- [ ] Ajouter colonnes `confirmed_at`, `ready_at`, `served_at`, `paid_at` à la table `orders`
- [ ] Créer migration SQL
- [ ] Mettre à jour l'entité `Order` (TypeScript)
- [ ] Mettre à jour le repository pour peupler les nouveaux champs
- [ ] Créer endpoint `GET /api/server-time` (retourne timestamp serveur)
- [ ] Créer endpoint `GET /api/menu/order-status/:orderId` (avec `server_now`)
- [ ] Tests: Vérifier timestamps corrects

**Livrable:**
- ✅ Backend retourne timestamps serveur
- ✅ Endpoint `server-time` fonctionnel
- ✅ Endpoint `order-status` enrichi

##### Étape 1.2: Frontend - CountdownCalculator (Jour 3-5)

- [ ] Créer `CountdownCalculator.ts` (logique pure)
- [ ] Créer `useServerTime.ts` (hook pour récupérer temps serveur)
- [ ] Créer `useOrderStatus.ts` (hook pour récupérer statut commande)
- [ ] Tests unitaires: `CountdownCalculator.test.ts`
- [ ] Tests: Vérifier calculs corrects dans tous les cas

**Livrable:**
- ✅ CountdownCalculator fonctionnel
- ✅ useServerTime opérationnel
- ✅ Tests passants

##### Étape 1.3: Frontend - Design System (Jour 5-7)

- [ ] Créer `design-system/tokens.ts` (couleurs, spacing, typography)
- [ ] Créer `design-system/animations.ts`
- [ ] Créer `design-system/accessibility.ts`
- [ ] Créer `CountdownCard.tsx` (structure)
- [ ] Créer `CountdownRing.tsx` (SVG ring)
- [ ] Créer `CountdownStatus.tsx` (message + icône)
- [ ] Créer `CountdownActions.tsx` (actions)
- [ ] Tests visuels: Storybook (optionnel)

**Livrable:**
- ✅ Design system complet
- ✅ Composants countdown créés
- ✅ UI premium

##### Étape 1.4: Frontend - i18n (Jour 7-10)

- [ ] Ajouter section `countdown` dans `fr.json`
- [ ] Ajouter section `countdown` dans `en.json`
- [ ] Ajouter section `countdown` dans `pt.json`
- [ ] Créer hook `useCountdownTranslations.ts`
- [ ] Intégrer i18n dans tous les composants
- [ ] Tests: Vérifier affichage en FR, EN, PT

**Livrable:**
- ✅ Traductions complètes
- ✅ i18n fonctionnel
- ✅ Tests passants

**Total Phase 1: 10 jours**

---

#### Phase 2: Realtime & State Management (Semaine 3-4) - CRITIQUE

**Objectif:** Implémenter WebSocket et state management robuste

##### Étape 2.1: Backend - WebSocket Server (Jour 1-3)

- [ ] Installer `ws` library
- [ ] Créer `WebSocketServer.ts`
- [ ] Implémenter authentification JWT
- [ ] Gestion des rooms par `tenant:order:{orderId}`
- [ ] Heartbeat (ping/pong)
- [ ] Cleanup connexions mortes
- [ ] Tests: Connexion, auth, rooms

**Livrable:**
- ✅ WebSocket server opérationnel
- ✅ Authentification fonctionnelle

##### Étape 2.2: Backend - Event Bus Integration (Jour 3-5)

- [ ] Connecter `NotificationEventBus` au platform event bus
- [ ] Publier événements: `order.confirmed`, `order.preparing`, `order.ready`, etc.
- [ ] Créer `RealtimeNotificationService`
- [ ] Push notifications via WebSocket
- [ ] Tests: Événements publiés, notifications reçues

**Livrable:**
- ✅ Event Bus connecté
- ✅ Notifications temps réel

##### Étape 2.3: Frontend - State Management (Jour 5-7)

- [ ] Créer `useOrderStore.ts` (Zustand)
- [ ] Implémenter persistance IndexedDB
- [ ] Créer `useRealtimeOrder.ts` (WebSocket hook)
- [ ] Créer `useOrderSync.ts` (sync manager)
- [ ] Tests: State management, persistance, sync

**Livrable:**
- ✅ State management robuste
- ✅ Persistance IndexedDB
- ✅ Sync automatique

##### Étape 2.4: Frontend - Countdown Component (Jour 7-10)

- [ ] Intégrer CountdownRing + CountdownStatus + CountdownActions
- [ ] Connecter à useOrderStore
- [ ] Implémenter animations (transitions d'état)
- [ ] Implémenter accessibilité (ARIA)
- [ ] Tests: Affichage, animations, accessibilité

**Livrable:**
- ✅ Countdown component fonctionnel
- ✅ Animations fluides
- ✅ Accessible

**Total Phase 2: 10 jours**

---

#### Phase 3: Notifications & Résilience (Semaine 5-6) - ÉLEVÉ

**Objectif:** Implémenter notifications intelligentes et résilience

##### Étape 3.1: Notification Manager (Jour 1-3)

- [ ] Créer `NotificationManager.ts`
- [ ] Implémenter `CountdownNotificationStrategy`
- [ ] Implémenter `NotificationAggregator`
- [ ] Implémenter préférences utilisateur
- [ ] Tests: Stratégie, agrégation, préférences

**Livrable:**
- ✅ Notifications intelligentes
- ✅ Pas de spam

##### Étape 3.2: Circuit Breaker & Retry (Jour 3-5)

- [ ] Créer `CircuitBreaker.ts`
- [ ] Créer `RetryPolicy.ts` (exponential backoff)
- [ ] Créer `DeadLetterQueue.ts`
- [ ] Intégrer dans NotificationManager
- [ ] Tests: Circuit breaker, retry, DLQ

**Livrable:**
- ✅ Circuit breaker opérationnel
- ✅ Retry automatique
- ✅ DLQ fonctionnelle

##### Étape 3.3: Fallback Polling (Jour 5-7)

- [ ] Implémenter fallback polling (60s)
- [ ] Détection online/offline
- [ ] Reconnexion automatique WebSocket
- [ ] Tests: Fallback, reconnexion

**Livrable:**
- ✅ Fallback robuste
- ✅ Survie aux perturbations

##### Étape 3.4: Tests E2E (Jour 7-10)

- [ ] Tests: Workflow complet (pending → paid)
- [ ] Tests: Scénarios de cas limites
- [ ] Tests: Performance (latence, throughput)
- [ ] Tests: Résilience (offline, reconnexion)
- [ ] Tests: Multi-tenant isolation

**Livrable:**
- ✅ Tests E2E passants
- ✅ Couverture > 80%

**Total Phase 3: 10 jours**

---

#### Phase 4: Polish & Production (Semaine 7-8) - MOYEN

**Objectif:** Finaliser et optimiser pour la production

##### Étape 4.1: Performance (Jour 1-3)

- [ ] Optimiser requêtes DB (index)
- [ ] Implémenter cache Redis (optionnel)
- [ ] Optimiser bundle size (code splitting)
- [ ] Tests: Performance, Lighthouse

**Livrable:**
- ✅ Performance optimisée
- ✅ Lighthouse score > 90

##### Étape 4.2: Monitoring (Jour 3-5)

- [ ] Ajouter métriques: latence, throughput, erreurs
- [ ] Créer dashboard Grafana
- [ ] Alertes: taux d'erreur > 5%
- [ ] Logs structurés

**Livrable:**
- ✅ Monitoring opérationnel
- ✅ Alertes configurées

##### Étape 4.3: Documentation (Jour 5-7)

- [ ] Mettre à jour README
- [ ] Créer guide d'utilisation
- [ ] Documenter API
- [ ] Créer runbooks opérationnels

**Livrable:**
- ✅ Documentation complète

##### Étape 4.4: Déploiement (Jour 7-10)

- [ ] Feature flags
- [ ] Migration progressive
- [ ] Rollback plan
- [ ] Tests de charge

**Livrable:**
- ✅ Déploiement production
- ✅ Rollback plan

**Total Phase 4: 10 jours**

---

### 12.2 Estimation Globale

| Phase | Durée | Risque | ROI |
|-------|-------|--------|-----|
| Phase 1 | 10 jours | Faible | Élevé (fondations) |
| Phase 2 | 10 jours | Moyen | Élevé (UX) |
| Phase 3 | 10 jours | Moyen | Élevé (fiabilité) |
| Phase 4 | 10 jours | Faible | Moyen (production) |
| **TOTAL** | **40 jours** | - | - |

---

## 13. ANALYSE DES RISQUES

### 13.1 Risques Techniques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Perte de synchronisation temps** | Faible | Élevé | Source de vérité serveur + sync périodique |
| **WebSocket overload** | Moyen | Élevé | Connection pooling + Rate limit + Backpressure |
| **IndexedDB corruption** | Faible | Moyen | Backup + Validation + Fallback mémoire |
| **Race conditions** | Moyen | Moyen | Optimistic locking + Versioning |
| **Memory leaks** | Moyen | Moyen | Cleanup + Heartbeat + Monitoring |
| **Cache invalidation** | Faible | Élevé | TTL + Invalidation events |

### 13.2 Risques Fonctionnels

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Timer incorrect** | Faible | Élevé | Source de vérité serveur + Tests |
| **Notifications en double** | Moyen | Moyen | Idempotency key + Agrégation |
| **Spam notifications** | Moyen | Élevé | Stratégie intelligente + Préférences |
| **Perte de données offline** | Faible | Élevé | IndexedDB + Sync automatique |
| **Breaking changes** | Faible | Élevé | Feature flags + Migration progressive |

### 13.3 Risques UX

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Confusion timer** | Moyen | Moyen | Design clair + Animations + Accessibilité |
| **Performance dégradée** | Faible | Élevé | Tests de performance + Optimisations |
| **Incompatibilité navigateurs** | Faible | Moyen | Tests cross-browser + Polyfills |

---

## 14. VALIDATION FINALE

### 14.1 Checklist de Validation

#### Architecture
- [x] Source de vérité serveur pour le temps
- [x] Timer découplé du polling
- [x] Machine à états complète
- [x] Notifications intelligentes
- [x] Design system premium
- [x] Architecture modulaire
- [x] i18n complet
- [x] Backend adapté
- [x] Résilience aux perturbations

#### Code Quality
- [ ] TypeScript strict mode
- [ ] Tests unitaires > 80% coverage
- [ ] Tests E2E passants
- [ ] Linting (ESLint)
- [ ] Formatting (Prettier)
- [ ] Documentation JSDoc

#### Performance
- [ ] Latence < 100ms
- [ ] Bundle size < 200KB
- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1s
- [ ] Time to Interactive < 2s

#### Security
- [ ] Authentification JWT
- [ ] Authorization (tenant isolation)
- [ ] Input validation
- [ ] XSS protection
- [ ] CSRF protection

#### Accessibility
- [ ] WCAG AA compliant
- [ ] Contrast ratio > 4.5:1
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] ARIA labels

### 14.2 Sign-off

| Rôle | Nom | Validation | Date |
|------|-----|------------|------|
| **Staff Software Engineer** | [À compléter] | ⬜ | - |
| **Tech Lead** | [À compléter] | ⬜ | - |
| **Product Manager** | [À compléter] | ⬜ | - |
| **Design Lead** | [À compléter] | ⬜ | - |
| **QA Lead** | [À compléter] | ⬜ | - |

### 14.3 Prochaines Étapes

1. **Valider ce document** avec l'équipe
2. **Prioriser les phases** (recommandé: Phase 1 → Phase 2 → Phase 3 → Phase 4)
3. **Assigner les ressources** (2-3 ingénieurs fullstack)
4. **Commencer l'implémentation** par Phase 1
5. **Review hebdomadaire** du progrès
6. **Tests continus** après chaque phase
7. **Déploiement progressif** avec feature flags

---

## ANNEXES

### A. Références

- [Uber Eats Design System](https://www.uber.com/design/)
- [Toast POS Documentation](https://docs.toasttab.com/)
- [Square Developer](https://developer.squareup.com/)
- [Deliveroo Engineering](https://deliveroo.engineering/)
- [Shopify Polaris](https://polaris.shopify.com/)
- [Stripe Design](https://stripe.com/design)

### B. Glossaire

- **SSOT:** Single Source of Truth
- **DST:** Daylight Saving Time
- **WCAG:** Web Content Accessibility Guidelines
- **ARIA:** Accessible Rich Internet Applications
- **TTL:** Time To Live
- **DLQ:** Dead Letter Queue
- **NTP:** Network Time Protocol

### C. Changelog

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | 2026-02-07 | Staff Software Engineer | Création initiale |

---

**FIN DU DOCUMENT D'ARCHITECTURE**

**Ce document doit être validé par l'ensemble de l'équipe avant le début de l'implémentation.**

**Niveau de qualité visé:** Uber Eats / Toast POS / Square / Deliveroo / Shopify / Stripe