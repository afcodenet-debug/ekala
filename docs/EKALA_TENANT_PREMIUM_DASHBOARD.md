# EKALA TENANT PREMIUM DASHBOARD
## Dashboard Premium pour Tenants

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Dashboard Specification  
**Objectif:** Expérience utilisateur premium pour les tenants

---

## 1. DASHBOARD OVERVIEW

### 1.1 Objectif
Fournir une vue en temps réel de la performance de l'établissement avec des insights actionnables.

### 1.2 Hiérarchie Visuelle
```
Level 1: Greeting + Plan Status
Level 2: KPI Cards (4 cartes)
Level 3: Charts (2 charts)
Level 4: Lists & Recommendations
```

---

## 2. LAYOUT COMPLET

### 2.1 Desktop (>1024px)

```
┌────────────────────────────────────────────────────────────────────┐
│ [☰] Ekala                                    [🔔] [👤 Le Palmier] │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Bonjour, Jean Dupont                                              │
│  Voici ce qui se passe avec Restaurant Le Palmier                 │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │
│  │                                                             │ │
│  │  Plan Actif: [BUSINESS]  Statut: ● Actif                   │ │
│  │                                                             │ │
│  │  Renouvellement: 15 Fév 2026 (dans 23 jours)               │ │
│  │                                                             │ │
│  │  [Voir mon abonnement →]                                    │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Utilisate.│ │ Branches │ │  Stock   │ │  Ventes  │            │
│  │  12/25   │ │  3/10    │ │  85%     │ │  1.2M    │            │
│  │  used    │ │  used    │ │  used    │ │  FCFA    │            │
│  │          │ │          │ │          │ │  today   │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                    │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │        │
│  │ Ventes du Jour         │ │ Produits Populaires       │        │
│  │                         │ │                          │        │
│  │  [LINE CHART]          │ │  1. Poulet Braisé  45     │        │
│  │                         │ │  2. Attiéké Poisson 38    │        │
│  │                         │ │  3. Jus de Bissap 32     │        │
│  │                         │ │  4. Riz Gras 28          │        │
│  │                         │ │  5. Salade Mixte 25      │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│                                                                    │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │        │
│  │ Commandes Récentes     │ │ Recommandations           │        │
│  │                         │ │                          │        │
│  │ #CMD-1234  12,500 FCFA  │ │ ⭐ Passez à BUSINESS+     │        │
│  │ #CMD-1233   8,200 FCFA  │ │    pour débloquer:       │        │
│  │ #CMD-1232  15,000 FCFA  │ │    • 50 utilisateurs     │        │
│  │                         │ │    • 20 succursales      │        │
│  │                         │ │    • API access          │        │
│  │                         │ │                          │        │
│  │                         │ │ [Voir les plans →]       │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 Tablet (768-1024px)

```
┌────────────────────────────────────────┐
│ [☰] Ekala                      [👤]    │
├────────────────────────────────────────┤
│                                         │
│  Bonjour, Jean Dupont                   │
│  Restaurant Le Palmier                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Plan: [BUSINESS] ● Actif        │   │
│  │ Renouvellement: 15 Fév 2026     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌──────────┐ ┌──────────┐             │
│  │Utilisate.│ │ Branches │             │
│  │  12/25   │ │  3/10    │             │
│  └──────────┘ └──────────┘             │
│  ┌──────────┐ ┌──────────┐             │
│  │  Stock   │ │  Ventes  │             │
│  │  85%     │ │  1.2M    │             │
│  └──────────┘ └──────────┘             │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Ventes du Jour                  │   │
│  │                                 │   │
│  │   [LINE CHART]                  │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Produits Populaires             │   │
│  │                                 │   │
│  │  1. Poulet Braisé  45           │   │
│  │  2. Attiéké Poisson 38          │   │
│  │  3. Jus de Bissap 32            │   │
│  └─────────────────────────────────┘   │
│                                         │
└────────────────────────────────────────┘
```

### 2.3 Mobile (<768px)

```
┌────────────────────────────┐
│ [☰] Ekala         [👤]    │
├────────────────────────────┤
│                             │
│ Bonjour, Jean              │
│ Restaurant Le Palmier      │
│                             │
│ ┌─────────────────────────┐│
│ │ [BUSINESS] ● Actif      ││
│ │ Renouvellement: 23j     ││
│ └─────────────────────────┘│
│                             │
│ ┌─────────────────────────┐│
│ │ Utilisateurs            ││
│ │ 12 / 25                 ││
│ │ ▰▰▰▰▰▰▰▰▰▰▰▰ 48%       ││
│ └─────────────────────────┘│
│ ┌─────────────────────────┐│
│ │ Branches                ││
│ │ 3 / 10                  ││
│ │ ▰▰▰▰▰▰▰▰▰▰▰▰ 30%       ││
│ └─────────────────────────┘│
│ ┌─────────────────────────┐│
│ │ Stock                   ││
│ │ 85%                     ││
│ │ ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰ 85%  ││
│ └─────────────────────────┘│
│                             │
│ ┌─────────────────────────┐│
│ │ Ventes du Jour          ││
│ │ 1.2M FCFA               ││
│ │   [LINE CHART]          ││
│ └─────────────────────────┘│
│                             │
│ ┌─────────────────────────┐│
│ │ Top Produits            ││
│ │ 1. Poulet Braisé  45    ││
│ │ 2. Attiéké Poisson 38   ││
│ │ 3. Jus de Bissap 32     ││
│ └─────────────────────────┘│
│                             │
└────────────────────────────┘
```

---

## 3. KPI CARDS

### 3.1 Card Structure

```
┌────────────────────────────────┐
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  │
│                        [Icon]  │
│                        [Trend] │
│                                │
│ LABEL                           │
│ 123 / 250                       │
│ ▰▰▰▰▰▰▰▰▰▰▰▰ 48%              │
│                                │
└────────────────────────────────┘
```

### 3.2 Card 1: Utilisateurs

**Label:** Utilisateurs  
**Value:** 12 / 25  
**Progress:** 48%  
**Trend:** +2 ce mois  
**Color:** Blue (#3b82f6)  
**Icon:** Users

### 3.3 Card 2: Branches

**Label:** Branches  
**Value:** 3 / 10  
**Progress:** 30%  
**Trend:** Stable  
**Color:** Green (#10b981)  
**Icon:** Building2

### 3.4 Card 3: Stockage

**Label:** Stockage  
**Value:** 4.2 / 5 GB  
**Progress:** 85%  
**Trend:** +500MB cette semaine  
**Color:** Amber (#f59e0b)  
**Icon:** HardDrive

### 3.5 Card 4: Ventes du Jour

**Label:** Ventes Aujourd'hui  
**Value:** 1.2M FCFA  
**Progress:** N/A  
**Trend:** +15% vs hier  
**Color:** Gold (#D4AF37)  
**Icon:** TrendingUp

---

## 4. PLAN STATUS CARD

### 4.1 Structure

```
┌─────────────────────────────────────────────────────────────┐
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │
│                                                             │
│  Plan Actif: [BUSINESS]  Statut: ● Actif                   │
│                                                             │
│  Renouvellement: 15 Fév 2026 (dans 23 jours)               │
│                                                             │
│  [Voir mon abonnement →]                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Elements

**Plan Badge:**
- [BUSINESS] - Gold color
- Icon: TrendingUp

**Status:**
- ● Actif - Green dot
- Text: Green

**Renewal Date:**
- 15 Fév 2026
- Countdown: "dans 23 jours"
- Color: Text secondary

**Action:**
- Link: "Voir mon abonnement →"
- Color: Gold (#D4AF37)

---

## 5. CHARTS

### 5.1 Ventes du Jour (Line Chart)

**Type:** Line chart  
**Période:** Aujourd'hui (heure par heure)  
**Metrics:** Ventes (FCFA)  
**Color:** Gold (#D4AF37)  
**Fill:** Gradient Gold 20% → transparent

**Data Points:**
- 00:00 - 50,000 FCFA
- 06:00 - 120,000 FCFA
- 12:00 - 450,000 FCFA
- 18:00 - 580,000 FCFA
- Now: 1.2M FCFA

### 5.2 Top Produits (Bar Chart)

**Type:** Horizontal bar chart  
**Metrics:** Quantité vendue  
**Color:** Blue (#3b82f6)

**Top 5:**
1. Poulet Braisé - 45
2. Attiéké Poisson - 38
3. Jus de Bissap - 32
4. Riz Gras - 28
5. Salade Mixte - 25

---

## 6. COMMANDES RÉCENTES

### 6.1 Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Commandes Récentes                                          │
│                                                             │
│ #CMD-1234  12,500 FCFA  14:32  [En préparation]            │
│ #CMD-1233   8,200 FCFA  14:28  [Prête]                     │
│ #CMD-1232  15,000 FCFA  14:15  [Servie]                    │
│ #CMD-1231   6,800 FCFA  14:10  [Payée]                     │
│ #CMD-1230   9,400 FCFA  14:05  [Annulée]                   │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Columns

- Commande: #CMD-1234
- Montant: 12,500 FCFA
- Heure: 14:32
- Statut: Badge coloré

### 6.3 Status Colors

- En préparation: Amber
- Prête: Blue
- Servie: Green
- Payée: Purple
- Annulée: Red

---

## 7. RECOMMANDATIONS

### 7.1 Upsell Card

```
┌─────────────────────────────────────────────────────────────┐
│ ⭐ Passez à BUSINESS+                                        │
│                                                             │
│ Vous avez utilisé 48% de vos utilisateurs                   │
│                                                             │
│ Débloquez:                                                  │
│ • 50 utilisateurs (au lieu de 25)                           │
│ • 20 succursales (au lieu de 10)                            │
│ • API access                                                │
│ • Support prioritaire                                       │
│                                                             │
│ [Voir les plans →]                                          │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Trigger Conditions

**Affichage si:**
- Utilisation > 70% sur au moins 1 limite
- Plan actif ≠ ULTIMATE
- Pas de downgrade en cours

**Priorité:**
- Critical: > 90% utilisation
- Warning: > 70% utilisation
- Info: > 50% utilisation

---

## 8. QUICK ACTIONS

### 8.1 Actions Disponibles

**Nouvelle Commande:**
- Icon: Plus
- Action: Créer commande
- Shortcut: Ctrl+N

**Nouveau Produit:**
- Icon: Package
- Action: Ajouter produit
- Shortcut: Ctrl+P

**Nouveau Client:**
- Icon: UserPlus
- Action: Ajouter client
- Shortcut: Ctrl+C

**Rapports:**
- Icon: BarChart3
- Action: Voir rapports
- Shortcut: Ctrl+R

### 8.2 FAB (Floating Action Button)

**Position:** Bottom-right  
**Size:** 56x56px  
**Color:** Gold (#D4AF37)  
**Icon:** Plus  
**Action:** Menu rapide

---

## 9. NOTIFICATIONS

### 9.1 Notification Center

**Position:** Top-right  
**Icon:** Bell  
**Badge:** Count unread

**Notifications:**
- Nouvelle commande
- Stock bas
- Paiement reçu
- Nouveau client

### 9.2 Toast Notifications

**Position:** Bottom-right  
**Duration:** 5s  
**Types:** Success, Error, Warning, Info

---

## 10. MOBILE FEATURES

### 10.1 Bottom Navigation

```
┌────────────────────────────┐
│ [🏠 Home] [📊 Stats]      │
│ [📦 Products] [👥 Clients]│
│ [⚙️ Settings]              │
└────────────────────────────┘
```

### 10.2 Pull to Refresh

- Refresh data
- Loading indicator
- Success feedback

### 10.3 Swipe Actions

- Swipe left: Actions (Edit, Delete)
- Swipe right: Quick view

---

## 11. PERFORMANCE

### 11.1 Loading Strategy

**Initial Load:**
- Skeleton screens
- Progressive loading
- Lazy loading charts

**Data Refresh:**
- Real-time (WebSocket)
- Fallback: 30s polling
- Manual refresh

### 11.2 Caching

- Dashboard data: 5 min cache
- Charts: 15 min cache
- Lists: Real-time

---

## 12. ACCESSIBILITY

### 12.1 WCAG Compliance

- Contrast ratio: 4.5:1 minimum
- Focus indicators: Gold outline
- Keyboard navigation: Full support
- Screen reader: ARIA labels

### 12.2 Keyboard Shortcuts

- Ctrl+N: Nouvelle commande
- Ctrl+P: Nouveau produit
- Ctrl+C: Nouveau client
- Ctrl+R: Rapports
- Ctrl+/: Aide

---

## CONCLUSION

Ce dashboard premium offre une expérience utilisateur exceptionnelle avec:

- Vue en temps réel
- Insights actionnables
- Design moderne
- Performance optimale
- Mobile-first
- Accessible

**Prochaine étape:** Implémentation React