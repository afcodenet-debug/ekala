# EKALA PLATFORM - WIREFRAMES V1
## Wireframes Complets de la Plateforme

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Wireframes Specification  
**Format:** ASCII Pseudo-Layout

---

## TABLE DES MATIÈRES

1. [Executive Dashboard](#1-executive-dashboard)
2. [Tenants](#2-tenants)
3. [Tenant Details](#3-tenant-details)
4. [Subscriptions](#4-subscriptions)
5. [Billing & Revenue](#5-billing--revenue)
6. [Vouchers & Promotions](#6-vouchers--promotions)
7. [Customer Success](#7-customer-success)
8. [Support Center](#8-support-center)
9. [Analytics](#9-analytics)
10. [Audit & Compliance](#10-audit--compliance)
11. [Integrations](#11-integrations)
12. [Sync & Infrastructure](#12-sync--infrastructure)
13. [Platform Settings](#13-platform-settings)

---

## 1. EXECUTIVE DASHBOARD

### 1.1 Objectif Métier
Cockpit stratégique pour Super Admin et Account Managers. Vue 360° de la santé business de la plateforme.

### 1.2 Hiérarchie Visuelle
```
Level 1: Executive Dashboard (H1)
Level 2: KPI Cards (6 cards)
Level 3: Charts & Tables (2x2 grid)
Level 4: Alerts & Actions (sidebar)
```

### 1.3 Layout Desktop (>1024px)

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] Ekala Platform                                    [Avatar]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Executive Dashboard                                    [Actions]  │
│  Vue d'ensemble de la plateforme Ekala                            │
│                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Total    │ │ Active   │ │   MRR    │ │   ARR    │ │ Active │ │
│  │ Tenants  │ │ Tenants  │ │ 45.2M    │ │ 542M     │ │ Subs   │ │
│  │   123    │ │   98     │ │  FCFA    │ │  FCFA    │ │  94    │ │
│  │   +12% ↑ │ │   +8% ↑  │ │  +15% ↑  │ │  +22% ↑  │ │  94% ↑ │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│  ┌──────────┐ ┌──────────┐                                      │
│  │  Trial   │ │ Revenue  │                                      │
│  │ Tenants  │ │  Total   │                                      │
│  │   23     │ │  125M    │                                      │
│  │   23     │ │  FCFA    │                                      │
│  │   -5% ↓  │ │  +18% ↑  │                                      │
│  └──────────┘ └──────────┘                                      │
│                                                                    │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │        │
│  │ MRR Evolution      [30j]│ │ Tenant Acquisition        │        │
│  │                         │ │                           │        │
│  │     [LINE CHART]        │ │     [BAR CHART]           │        │
│  │                         │ │                           │        │
│  │                         │ │                           │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │        │
│  │ Tenants Récents  [Tout]│ │ Alertes & Actions         │        │
│  │                         │ │                           │        │
│  │ [Restaurant Le Palmier] │ │ ⚠️ 3 tenants en grâce     │        │
│  │ [Bar Le Calme]          │ │ ⚠️ Payment failure: 2.3%  │        │
│  │ [Hôtel Sarakawa]        │ │ ✓ 45 inscriptions today   │        │
│  │ [Fast Food King]        │ │                           │        │
│  │ [Night Club Vibe]       │ │ Actions Rapides:          │        │
│  │                         │ │ [+ Nouveau Tenant]        │        │
│  │                         │ │ [💳 Gérer Plans]          │        │
│  │                         │ │ [📄 Créer Voucher]        │        │
│  │                         │ │ [⚙️ Paramètres]           │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│                                                                    │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │        │
│  │ Santé Plateforme        │ │ Accès Rapide              │        │
│  │                         │ │                           │        │
│  │ Uptime:      99.98%     │ │ [🏢 Tenants]              │        │
│  │ API Response: 142ms     │ │ [💳 Abonnements]          │        │
│  │ Error Rate:   0.02%     │ │ [📄 Vouchers]             │        │
│  │ Active Users: 1,234     │ │ [🎧 Support]              │        │
│  │                         │ │ [📊 Analytics]            │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 1.4 Layout Tablet (768-1024px)

```
┌────────────────────────────────────────┐
│ [☰] Ekala Platform              [Avatar]│
├────────────────────────────────────────┤
│                                         │
│  Executive Dashboard         [Actions]  │
│  Vue d'ensemble                         │
│                                         │
│  ┌──────────┐ ┌──────────┐             │
│  │ Total    │ │ Active   │             │
│  │ Tenants  │ │ Tenants  │             │
│  │   123    │ │   98     │             │
│  └──────────┘ └──────────┘             │
│  ┌──────────┐ ┌──────────┐             │
│  │   MRR    │ │   ARR    │             │
│  │ 45.2M    │ │ 542M     │             │
│  └──────────┘ └──────────┘             │
│                                         │
│  ┌─────────────────────────┐            │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │            │
│  │ MRR Evolution           │            │
│  │                         │            │
│  │     [LINE CHART]        │            │
│  │                         │            │
│  └─────────────────────────┘            │
│  ┌─────────────────────────┐            │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │            │
│  │ Tenants Récents         │            │
│  │                         │            │
│  │ [Restaurant Le Palmier] │            │
│  │ [Bar Le Calme]          │            │
│  │ [Hôtel Sarakawa]        │            │
│  └─────────────────────────┘            │
│                                         │
└────────────────────────────────────────┘
```

### 1.5 Layout Mobile (<768px)

```
┌────────────────────────────┐
│ [☰] Ekala Platform         │
├────────────────────────────┤
│                             │
│ Executive Dashboard         │
│ Vue d'ensemble              │
│                             │
│ ┌───────────────────────┐  │
│ │ Total Tenants         │  │
│ │ 123                   │  │
│ │ +12% ↑                │  │
│ └───────────────────────┘  │
│ ┌───────────────────────┐  │
│ │ Active Tenants        │  │
│ │ 98                    │  │
│ │ +8% ↑                 │  │
│ └───────────────────────┘  │
│ ┌───────────────────────┐  │
│ │ MRR                   │  │
│ │ 45.2M FCFA            │  │
│ │ +15% ↑                │  │
│ └───────────────────────┘  │
│ ┌───────────────────────┐  │
│ │ ARR                   │  │
│ │ 542M FCFA             │  │
│ │ +22% ↑                │  │
│ └───────────────────────┘  │
│                             │
│ ┌───────────────────────┐  │
│ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │  │
│ │ MRR Evolution         │  │
│ │                       │  │
│ │   [LINE CHART]        │  │
│ │                       │  │
│ └───────────────────────┘  │
│                             │
│ ┌───────────────────────┐  │
│ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │  │
│ │ Tenants Récents       │  │
│ │                       │  │
│ │ [Restaurant Le Palmier]│ │
│ │ [Bar Le Calme]        │  │
│ │ [Hôtel Sarakawa]      │  │
│ └───────────────────────┘  │
│                             │
└────────────────────────────┘
```

### 1.6 États

**Vide:**
```
┌────────────────────────────────┐
│                                │
│     [📊 Icon 64x64]            │
│                                │
│   Aucune donnée disponible     │
│                                │
│   [Actualiser]                 │
│                                │
└────────────────────────────────┘
```

**Loading:**
```
┌────────────────────────────────┐
│                                │
│         [◌ Spinner]            │
│                                │
│      Chargement des données    │
│                                │
└────────────────────────────────┘
```

**Erreur:**
```
┌────────────────────────────────┐
│                                │
│     [⚠️ Icon 48x48]            │
│                                │
│   Erreur de chargement         │
│                                │
│   [Réessayer]                  │
│                                │
└────────────────────────────────┘
```

---

## 2. TENANTS

### 2.1 Objectif Métier
Gestion complète du cycle de vie des tenants (onboarding → expansion → churn).

### 2.2 Hiérarchie Visuelle
```
Level 1: Tenants (H1)
Level 2: Filters Bar
Level 3: Tenant Table
Level 4: Pagination
```

### 2.3 Layout Desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] Ekala Platform                                    [Avatar]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Tenants                                            [+ Nouveau]   │
│  Gestion de vos établissements                                    │
│                                                                    │
│  [Rechercher...              ] [Filtres ▾] [Export ▾]             │
│                                                                    │
│  Statut: [Tous ▾]  Plan: [Tous ▾]  Pays: [Tous ▾]               │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Nom           │ Plan    │ Statut  │ Pays  │ Utilisateurs │MRR│ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ Restaurant    │BUSINESS │● Active │  TG   │     12       │45k│ │
│  │ Le Palmier    │         │         │       │              │   │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ Bar Le Calme  │STARTER  │● Trial  │  BJ   │      3       │15k│ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ Hôtel         │ENTERPR. │● Active │  TG   │     45       │89k│ │
│  │ Sarakawa      │         │         │       │              │   │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ Fast Food     │BUSINESS │● Active │  CM   │      8       │32k│ │
│  │ King          │         │         │       │              │   │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ Night Club    │ULTIMATE │● Active │  TG   │     25       │120│ │
│  │ Vibe          │         │         │       │              │k  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  < Précédent    Page 1 sur 5   Suivant >                         │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.4 Layout Tablet

```
┌────────────────────────────────────────┐
│ [☰] Ekala Platform            [Avatar]  │
├────────────────────────────────────────┤
│                                         │
│  Tenants                      [+ New]  │
│  Gestion de vos établissements         │
│                                         │
│  [Rechercher...        ] [Filtres ▾]   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Restaurant Le Palmier  [BUSINESS]│   │
│  │ ● Active  TG  12 users  45k FCFA│   │
│  ├─────────────────────────────────┤   │
│  │ Bar Le Calme          [STARTER] │   │
│  │ ● Trial   BJ   3 users  15k FCFA│   │
│  ├─────────────────────────────────┤   │
│  │ Hôtel Sarakawa      [ENTERPR.] │   │
│  │ ● Active  TG  45 users  89k FCFA│   │
│  └─────────────────────────────────┘   │
│                                         │
│  < Précédent  Page 1/5  Suivant >      │
│                                         │
└────────────────────────────────────────┘
```

### 2.5 Layout Mobile

```
┌────────────────────────────┐
│ [☰] Ekala Platform         │
├────────────────────────────┤
│                             │
│ Tenants            [+ New]  │
│ Gestion de vos établissements│
│                             │
│ [🔍 Rechercher...]          │
│ [Filtres ▾]                 │
│                             │
│ ┌─────────────────────────┐│
│ │ Restaurant Le Palmier   ││
│ │ [BUSINESS]              ││
│ │ ● Active                ││
│ │ TG • 12 users • 45k     ││
│ │              [Voir →]   ││
│ └─────────────────────────┘│
│ ┌─────────────────────────┐│
│ │ Bar Le Calme            ││
│ │ [STARTER]               ││
│ │ ● Trial                 ││
│ │ BJ • 3 users • 15k      ││
│ │              [Voir →]   ││
│ └─────────────────────────┘│
│ ┌─────────────────────────┐│
│ │ Hôtel Sarakawa          ││
│ │ [ENTERPRISE]            ││
│ │ ● Active                ││
│ │ TG • 45 users • 89k     ││
│ │              [Voir →]   ││
│ └─────────────────────────┘│
│                             │
│ < Précédent  Page 1/5 >    │
│                             │
└────────────────────────────┘
```

### 2.6 États

**Vide:**
```
┌────────────────────────────────┐
│                                │
│     [🏢 Icon 64x64]            │
│                                │
│   Aucun tenant pour le moment  │
│                                │
│   Créez votre premier tenant   │
│                                │
│    [+ Créer un tenant]         │
│                                │
└────────────────────────────────┘
```

**Loading:**
```
┌────────────────────────────────┐
│  [Skeleton x5]                 │
│  ████████████████████          │
│  ████████████████████          │
│  ████████████████████          │
│  ████████████████████          │
│  ████████████████████          │
└────────────────────────────────┘
```

---

## 3. TENANT DETAILS

### 3.1 Objectif Métier
Vue détaillée d'un tenant avec toutes ses informations, métriques et actions possibles.

### 3.2 Hiérarchie Visuelle
```
Level 1: Tenant Name + Plan Badge (H1)
Level 2: Stats Cards (4 cards)
Level 3: Tabs (Overview, Users, Branches, Activity)
Level 4: Tab Content
```

### 3.3 Layout Desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] Ekala Platform                                    [Avatar]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ← Retour    Restaurant Le Palmier    [BUSINESS]  [Actions ▾]    │
│                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Statut   │ │Utilisate.│ │ Branches │ │   MRR    │            │
│  │ ● Active │ │   12     │ │    3     │ │  45k     │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                    │
│  [Aperçu] [Utilisateurs] [Branches] [Activité]                   │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Informations Générales                                      │ │
│  │                                                             │ │
│  │ Nom:          Restaurant Le Palmier                         │ │
│  │ Slug:         le-palmier                                    │ │
│  │ Email:        contact@lepalmier.tg                         │ │
│  │ Pays:         Togo (+228)                                   │ │
│  │ Ville:        Lomé                                          │ │
│  │ Plan:         BUSINESS                                      │ │
│  │ Inscrit le:   15 Jan 2026                                   │ │
│  │ Dernière      Il y a 2h                                    │ │
│  │ connexion:                                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Abonnement                                                   │ │
│  │                                                             │ │
│  │ Plan:        BUSINESS                                        │ │
│  │ Statut:      ● Active                                        │ │
│  │ Début:       15 Jan 2026                                     │ │
│  │ Fin:         15 Fév 2026                                     │ │
│  │ Renouvellement automatique: Oui                              │ │
│  │                                                             │ │
│  │ [Modifier l'abonnement]  [Annuler]                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Utilisateurs (12)                                            │ │
│  │                                                             │ │
│  │ [+ Ajouter]  [Importer]                                     │ │
│  │                                                             │ │
│  │ [Avatar] Jean Dupont    Owner    ● Actif  [Éditer] [Suppr.] │ │
│  │ [Avatar] Marie Martin   Admin    ● Actif  [Éditer] [Suppr.] │ │
│  │ [Avatar] Paul Bernard   Manager  ● Actif  [Éditer] [Suppr.] │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 3.4 Layout Tablet

```
┌────────────────────────────────────────┐
│ [←] Restaurant Le Palmier  [Actions]   │
├────────────────────────────────────────┤
│                                         │
│  [BUSINESS badge]                       │
│                                         │
│  ┌──────────┐ ┌──────────┐             │
│  │ Statut   │ │Utilisate.│             │
│  │ ● Active │ │   12     │             │
│  └──────────┘ └──────────┘             │
│  ┌──────────┐ ┌──────────┐             │
│  │ Branches │ │   MRR    │             │
│  │    3     │ │  45k     │             │
│  └──────────┘ └──────────┘             │
│                                         │
│  [Aperçu] [Utilisateurs] [Branches]    │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Informations Générales          │   │
│  │                                 │   │
│  │ Nom: Restaurant Le Palmier      │   │
│  │ Email: contact@lepalmier.tg     │   │
│  │ Pays: Togo                      │   │
│  │ Plan: BUSINESS                  │   │
│  └─────────────────────────────────┘   │
│                                         │
└────────────────────────────────────────┘
```

### 3.5 Layout Mobile

```
┌────────────────────────────┐
│ [←] Restaurant Le Palmier  │
├────────────────────────────┤
│                             │
│ [BUSINESS badge]            │
│ ● Active                    │
│                             │
│ ┌─────────────────────────┐│
│ │ Utilisateurs            ││
│ │ 12                      ││
│ └─────────────────────────┘│
│ ┌─────────────────────────┐│
│ │ Branches                ││
│ │ 3                       ││
│ └─────────────────────────┘│
│ ┌─────────────────────────┐│
│ │ MRR                     ││
│ │ 45k FCFA                ││
│ └─────────────────────────┘│
│                             │
│ [Aperçu] [Utilisateurs]    │
│ [Branches] [Activité]      │
│                             │
│ ┌─────────────────────────┐│
│ │ Informations            ││
│ │                         ││
│ │ Nom: Restaurant Le      ││
│ │ Palmier                 ││
│ │ Email: contact@...      ││
│ │ Pays: Togo              ││
│ │ Plan: BUSINESS          ││
│ └─────────────────────────┘│
│                             │
└────────────────────────────┘
```

---

## 4. SUBSCRIPTIONS

### 4.1 Objectif Métier
Gestion des abonnements, vue d'ensemble, upgrades/downgrades, renouvellements.

### 4.2 Layout Desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] Ekala Platform                                    [Avatar]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Subscriptions                                      [+ Nouveau]   │
│  Gestion des abonnements                                           │
│                                                                    │
│  [Rechercher...              ] [Statut ▾] [Plan ▾]                │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Tenant           │ Plan    │ Statut  │ Début    │ Fin        │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ Restaurant Le   │BUSINESS │● Active │ 15 Jan   │ 15 Fév    │ │
│  │ Palmier         │         │         │          │            │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ Bar Le Calme    │STARTER  │● Trial  │ 20 Jan   │ 19 Fév    │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ Hôtel Sarakawa  │ENTERPR. │● Active │ 01 Jan   │ 01 Jan    │ │
│  │                 │         │         │          │ 2027      │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ Fast Food King  │BUSINESS │● Active │ 10 Jan   │ 10 Fév    │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  < Précédent    Page 1 sur 3   Suivant >                         │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. BILLING & REVENUE

### 5.1 Objectif Métier
Dashboard financier avec MRR, ARR, paiements, factures, remboursements.

### 5.2 Layout Desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] Ekala Platform                                    [Avatar]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Billing & Revenue                                                │
│  Vue d'ensemble financière                                        │
│                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │   MRR    │ │   ARR    │ │ Revenue  │ │ Paiements│            │
│  │ 45.2M    │ │ 542M     │ │  Total   │ │  En      │            │
│  │  FCFA    │ │  FCFA    │ │  125M    │ │  Retard  │            │
│  │  +15% ↑  │ │  +22% ↑  │ │  FCFA    │ │  2.5M    │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                    │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │        │
│  │ Revenue par Plan        │ │ Revenue par Pays         │        │
│  │                         │ │                          │        │
│  │     [PIE CHART]         │ │     [BAR CHART]          │        │
│  │                         │ │                          │        │
│  │ STARTER  25%            │ │ TG  45%                  │        │
│  │ BUSINESS 45%            │ │ BJ  20%                  │        │
│  │ ENTERPR. 20%            │ │ SN  15%                  │        │
│  │ ULTIMATE 10%            │ │ CI  10%                  │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Dernières Factures                                           │ │
│  │                                                             │ │
│  │ [Télécharger]  [Envoyer]  [Marquer payé]                    │ │
│  │                                                             │ │
│  │ #INV-2026-001  Restaurant Le Palmier  45,000 FCFA  [✓ Payé] │ │
│  │ #INV-2026-002  Bar Le Calme           15,000 FCFA  [⏰ En att.]│ │
│  │ #INV-2026-003  Hôtel Sarakawa         89,000 FCFA  [✓ Payé] │ │
│  │ #INV-2026-004  Fast Food King         32,000 FCFA  [✗ Échoué]│ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. VOUCHERS & PROMOTIONS

### 6.1 Objectif Métier
Gestion des vouchers, codes promo, campagnes promotionnelles.

### 6.2 Layout Desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] Ekala Platform                                    [Avatar]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Vouchers & Promotions                                            │
│  Campagnes et codes promotionnels                                  │
│                                                                    │
│  [Rechercher...              ] [Statut ▾] [Type ▾]                │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Code         │ Type    │ Plan    │ Statut  │ Utilisations │Exp.│ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ WELCOME2026  │ -20%    │ALL      │● Actif  │ 45/100       │15j│ │
│  │ PROMO-Q1     │ 1 mois  │BUSINESS │● Actif  │ 12/50        │30j│ │
│  │ LAUNCH       │ -50%    │STARTER  │● Expiré │ 200/200      │ -  │ │
│  │ VIP2026      │ Upgrade │ENTERPR. │● Actif  │ 3/10         │60j│ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  [+ Créer un voucher]  [Campagnes ▾]  [Historique ▾]             │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 7. CUSTOMER SUCCESS

### 7.1 Objectif Métier
Maximiser la rétention et l'expansion via accompagnement proactif.

### 7.2 Layout Desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] Ekala Platform                                    [Avatar]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Customer Success                                                 │
│  Rétention et expansion des tenants                               │
│                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  NPS     │ │  Health  │ │Onboarding│ │Expansion │            │
│  │   42     │ │  Score   │ │  Rate    │ │Revenue   │            │
│  │  +5 ↑    │ │   78/100 │ │   85%    │ │  +12%    │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                    │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │        │
│  │ Tenants à Risque        │ │ NPS Trend                │        │
│  │                         │ │                          │        │
│  │ ⚠️ Restaurant X        │ │     [LINE CHART]         │        │
│  │     Health: 35/100      │ │                          │        │
│  │     Dernière connexion: │ │    42 (current)          │        │
│  │     il y a 14 jours     │ │    38 (last month)       │        │
│  │                         │ │                          │        │
│  │ ⚠️ Bar Y                │ │                          │        │
│  │     Health: 42/100      │ │                          │        │
│  │     Quota: 90%          │ │                          │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Opportunités d'Expansion                                     │ │
│  │                                                             │ │
│  │ [Restaurant Z] - Atteint 90% du quota utilisateurs          │ │
│  │ [Hôtel W] - Plan actuel: STARTER depuis 6 mois              │ │
│  │ [Bar V] - Usage intensif: 95% des features                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 8. SUPPORT CENTER

### 8.1 Objectif Métier
Gestion centralisée du support client multi-canal.

### 8.2 Layout Desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] Ekala Platform                                    [Avatar]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Support Center                                                    │
│  Gestion des tickets et support client                             │
│                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Tickets  │ │  SLA     │ │ Temps de │ │  CSAT    │            │
│  │  Ouverts │ │ Respect  │ │Résolution│ │  Score   │            │
│  │   12     │ │   94%    │ │  2.3h    │ │  4.6/5   │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                    │
│  [Tous ▾] [Priorité ▾] [Assigné ▾] [Rechercher...]               │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ #TK-1234  [Urgent]  Restaurant Le Palmier  [Jean Dupont] 2h  │ │
│  │ Problème de paiement - Carte bancaire non acceptée            │ │
│  │ Priorité: Haute  SLA: 2h restantes                            │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ #TK-1233  [Moyen]   Bar Le Calme        [Marie Martin] 5h    │ │
│  │ Question sur les vouchers                                      │ │
│  │ Priorité: Moyenne  SLA: 19h restantes                         │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ #TK-1232  [Bas]    Hôtel Sarakawa      [Paul Bernard] 1j     │ │
│  │ Demande d'ajout d'utilisateur                                  │ │
│  │ Priorité: Basse  SLA: 71h restantes                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  [+ Nouveau ticket]  [Base de connaissances ▾]                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 9. ANALYTICS

### 9.1 Objectif Métier
Business Intelligence pour la plateforme et les tenants.

### 9.2 Layout Desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] Ekala Platform                                    [Avatar]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Analytics                                                         │
│  Insights et métriques business                                    │
│                                                                    │
│  [Période ▾] [Comparer ▾]  [Exporter ▾]                          │
│                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  DAU     │ │  MAU     │ │ Feature  │ │Session   │            │
│  │   234    │ │  1,234   │ │Adoption  │ │ Duration │            │
│  │  +12% ↑  │ │  +8% ↑   │ │   67%    │ │  12min   │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                    │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │        │
│  │ Revenue Trend           │ │ Tenant Growth            │        │
│  │                         │ │                          │        │
│  │     [AREA CHART]        │ │     [BAR CHART]          │        │
│  │                         │ │                          │        │
│  │                         │ │                          │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │        │
│  │ Feature Adoption        │ │ Cohort Retention         │        │
│  │                         │ │                          │        │
│  │     [HEATMAP]           │ │     [TABLE]              │        │
│  │                         │ │                          │        │
│  │                         │ │  Week 1  Week 4  Week 12│        │
│  │                         │ │  Cohort A  85%    45%    20%│        │
│  │                         │ │  Cohort B  88%    52%    28%│        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 10. AUDIT & COMPLIANCE

### 10.1 Objectif Métier
Traçabilité complète, conformité réglementaire, sécurité.

### 10.2 Layout Desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] Ekala Platform                                    [Avatar]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Audit & Compliance                                                │
│  Logs et conformité                                                │
│                                                                    │
│  [Rechercher...              ] [Action ▾] [Date ▾] [Utilisateur ▾]│
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Timestamp           │ Utilisateur │ Action    │ Entité │Résult│ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ 24/06/2026 14:32   │ admin@ekala │ tenant.   │ #123   │✓ Succès│
│  │                     │             │ updated   │        │       │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ 24/06/2026 14:28   │ admin@ekala │ voucher.  │ #456   │✓ Succès│ │
│  │                     │             │ verified  │        │       │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ 24/06/2026 14:15   │ user@tenant │ login     │ -      │✓ Succès│ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ 24/06/2026 14:10   │ unknown     │ login     │ -      │✗ Échec │ │
│  │                     │             │           │        │       │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  [Exporter CSV]  [Exporter PDF]  [Filtrer ▾]                     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 11. INTEGRATIONS

### 11.1 Objectif Métier
Connecter Ekala à l'écosystème africain (paiement, livraison, comptabilité).

### 11.2 Layout Desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] Ekala Platform                                    [Avatar]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Integrations                                                      │
│  Connecteurs et API                                                │
│                                                                    │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │        │
│  │ Orange Money            │ │ M-Pesa                   │        │
│  │                         │ │                          │        │
│  │ ● Actif                 │ │ ● Actif                  │        │
│  │                         │ │                          │        │
│  │ Dernière sync: 2min     │ │ Dernière sync: 5min      │        │
│  │                         │ │                          │        │
│  │ [Configurer] [Logs]     │ │ [Configurer] [Logs]      │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │        │
│  │ Twilio (SMS)            │ │ SendGrid (Email)         │        │
│  │                         │ │                          │        │
│  │ ● Actif                 │ │ ● Actif                  │        │
│  │                         │ │                          │        │
│  │ Dernière sync: 1h      │ │ Dernière sync: 30min     │        │
│  │                         │ │                          │        │
│  │ [Configurer] [Logs]     │ │ [Configurer] [Logs]      │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │        │
│  │ Glovo (Livraison)       │ │ Sage (Comptabilité)      │        │
│  │                         │ │                          │        │
│  │ ○ Inactif               │ │ ○ Inactif                │        │
│  │                         │ │                          │        │
│  │ [Activer]               │ │ [Activer]                │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│                                                                    │
│  [+ Ajouter une intégration]                                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 12. SYNC & INFRASTRUCTURE

### 12.1 Objectif Métier
Garantir la fiabilité, la performance et la scalabilité.

### 12.2 Layout Desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] Ekala Platform                                    [Avatar]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Sync & Infrastructure                                             │
│  Monitoring et performance                                         │
│                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Uptime   │ │ API Resp │ │  Error   │ │  Sync    │            │
│  │ 99.98%   │ │  142ms   │ │  Rate    │ │  Status  │            │
│  │ ● Healthy│ │  p95     │ │  0.02%   │ │ ● Active │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                    │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │        │
│  │ API Response Time       │ │ Error Rate               │        │
│  │                         │ │                          │        │
│  │     [LINE CHART]        │ │     [LINE CHART]         │        │
│  │                         │ │                          │        │
│  │ p50: 85ms               │ │ 0.02% (current)          │        │
│  │ p95: 142ms              │ │ 0.05% (last hour)        │        │
│  │ p99: 230ms              │ │                          │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Sync Jobs Queue                                              │ │
│  │                                                             │ │
│  │ Total: 1,234  Pending: 12  Processing: 3  Failed: 0        │ │
│  │                                                             │ │
│  │ [Voir tous les jobs]  [Relancer les échecs]                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Backups                                                     │ │
│  │                                                             │ │
│  │ Dernier backup: 24/06/2026 03:00  [Télécharger]            │ │
│  │ Avant-dernier:  23/06/2026 03:00  [Télécharger]            │ │
│  │                                                             │ │
│  │ [Créer un backup]  [Restaurer]                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 13. PLATFORM SETTINGS

### 13.1 Objectif Métier
Configuration globale de la plateforme.

### 13.2 Layout Desktop

```
┌────────────────────────────────────────────────────────────────────┐
│ [Logo] Ekala Platform                                    [Avatar]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Settings                                                          │
│  Configuration de la plateforme                                    │
│                                                                    │
│  [Général] [Sécurité] [Email/SMS] [Paiements] [Légal]            │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Paramètres Généraux                                          │ │
│  │                                                             │ │
│  │ Nom de la plateforme:  [Ekala Platform          ]           │ │
│  │                                                             │ │
│  │ Logo:                    [Upload]  [Aperçu]                 │ │
│  │                                                             │ │
│  │ Langue par défaut:       [Français ▾]                       │ │
│  │                                                             │ │
│  │ Devise par défaut:       [FCFA ▾]                           │ │
│  │                                                             │ │
│  │ Fuseau horaire:          [Africa/Lagos ▾]                    │ │
│  │                                                             │ │
│  │ [Enregistrer]                                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Sécurité                                                     │ │
│  │                                                             │ │
│  │ Politique de mot de passe:                                  │ │
│  │   [✓] Minimum 8 caractères                                  │ │
│  │   [✓] 1 majuscule                                            │ │
│  │   [✓] 1 chiffre                                              │ │
│  │   [ ] 1 caractère spécial                                    │ │
│  │                                                             │ │
│  │ 2FA obligatoire:       [✓] Oui                              │ │
│  │                                                             │ │
│  │ Durée de session:      [24h ▾]                              │ │
│  │                                                             │ │
│  │ [Enregistrer]                                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## LÉGENDES

### Composants UI

```
┌─────────────────────────────┐
│  CARD                       │
│  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  │ ← Accent line (3px)
│                             │
│  [Icon] Title        [Link] │
│        Subtitle             │
│                             │
│  Content area               │
│                             │
└─────────────────────────────┘

┌─────────────────────────────┐
│  BUTTON                     │
│                             │
│  Primary: [████████████]    │ ← Gold background
│  Secondary: [░░░░░░░░░░]    │ ← Border only
│  Ghost:     [              ] │ ← No background
│                             │
└─────────────────────────────┘

┌─────────────────────────────┐
│  BADGE                      │
│  ┌─────────────────────┐    │
│  │  BADGE TEXT         │    │
│  └─────────────────────┘    │
│                             │
│  Variants:                  │
│  [Default] [Primary]        │
│  [Success] [Warning]        │
│  [Danger]  [Info]           │
└─────────────────────────────┘

┌─────────────────────────────┐
│  INPUT                      │
│                             │
│  [________________________]  │
│  Label above                │
│  Error message below        │
│                             │
└─────────────────────────────┘

┌─────────────────────────────┐
│  TABLE                      │
│  ┌─────┬─────┬─────┐        │
│  │ Hdr │ Hdr │ Hdr │        │
│  ├─────┼─────┼─────┤        │
│  │ Cell│ Cell│ Cell│        │
│  ├─────┼─────┼─────┤        │
│  │ Cell│ Cell│ Cell│        │
│  └─────┴─────┴─────┘        │
│                             │
└─────────────────────────────┘

┌─────────────────────────────┐
│  CHART                      │
│  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  │
│  Title              [Link]  │
│  Subtitle                    │
│                             │
│  ┌─────────────────────┐    │
│  │                     │    │
│  │   [CHART AREA]      │    │
│  │                     │    │
│  │                     │    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
```

### États

```
┌────────────────────────────────┐
│  LOADING                       │
│                                │
│         [◌ Spinner]            │
│                                │
│      Chargement...             │
│                                │
└────────────────────────────────┘

┌────────────────────────────────┐
│  EMPTY STATE                   │
│                                │
│     [📊 Icon 64x64]            │
│                                │
│   Aucune donnée disponible     │
│                                │
│    [Action Button]             │
│                                │
└────────────────────────────────┘

┌────────────────────────────────┐
│  ERROR STATE                   │
│                                │
│     [⚠️ Icon 48x48]            │
│                                │
│   Erreur de chargement         │
│                                │
│    [Réessayer]                 │
│                                │
└────────────────────────────────┘
```

---

## NOTES

1. **Tous les wireframes utilisent le Design System V1** (couleurs, typography, spacing)
2. **Responsive:** Chaque écran a 3 versions (Desktop, Tablet, Mobile)
3. **Composants réutilisables:** Cards, Tables, Buttons, Badges, Inputs
4. **États:** Chaque écran gère Loading, Empty, Error states
5. **Actions:** Boutons d'action contextuels à chaque écran
6. **Navigation:** Sidebar + Breadcrumb + Back buttons
7. **Filtres:** Barre de filtres sur les listes
8. **Pagination:** Pour toutes les listes paginées

**Prochaine étape:** Validation wireframes → Maquettes haute-fidélité → Implémentation React