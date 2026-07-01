# EKALA PLATFORM - IMPLEMENTATION BLUEPRINT V1
## Plan d'Exécution pour la Transformation SaaS

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Implementation Blueprint  
**Objectif:** Construire la plateforme sans dette fonctionnelle

**Comparables:** Shopify HQ, Stripe Dashboard, Lightspeed HQ, HubSpot Enterprise

---

## TABLE DES MATIÈRES

1. [Inventaire Complet](#1-inventaire-complet)
2. [Gap Analysis](#2-gap-analysis)
3. [Priorisation](#3-priorisation)
4. [Platform Dashboard Final](#4-platform-dashboard-final)
5. [Tenant Dashboard Final](#5-tenant-dashboard-final)
6. [Plan System Final](#6-plan-system-final)
7. [Implementation Order](#7-implementation-order)

---

## 1. INVENTAIRE COMPLET

### 1.1 Pages Existantes

**Platform Pages:**
- ✅ `src/pages/platform/PlatformDashboard.tsx` - Dashboard platform
- ✅ `src/pages/platform/TenantsPage.tsx` - Liste tenants
- ✅ `src/pages/platform/TenantEditPage.tsx` - Édition tenant
- ✅ `src/pages/platform/TenantDetailsPage.tsx` - Détails tenant
- ✅ `src/pages/platform/SubscriptionsPage.tsx` - Subscriptions
- ✅ `src/pages/platform/VouchersPage.tsx` - Vouchers
- ✅ `src/pages/platform/AuditLogsPage.tsx` - Audit logs
- ✅ `src/pages/platform/SyncCenterPage.tsx` - Sync center
- ✅ `src/pages/platform/SettingsPage.tsx` - Settings
- ✅ `src/pages/platform/PlatformLoginPage.tsx` - Login platform

**Tenant Pages:**
- ✅ `src/pages/Dashboard.tsx` - Dashboard tenant
- ✅ `src/pages/CustomersPage.tsx` - Customers
- ✅ `src/pages/BranchesPage.tsx` - Branches
- ✅ `src/pages/staff/StaffPage.tsx` - Staff
- ✅ `src/pages/users/UsersPage.tsx` - Users
- ✅ `src/pages/CategoriesPage.tsx` - Categories
- ✅ `src/pages/TablesPage.tsx` - Tables
- ✅ `src/pages/sales/SalesHistoryPage.tsx` - Sales
- ✅ `src/pages/saas/BillingPage.tsx` - Billing tenant
- ✅ `src/pages/saas/BillingPageV2.tsx` - Billing V2
- ✅ `src/pages/saas/SignupPage.tsx` - Signup
- ✅ `src/pages/saas/PricingPage.tsx` - Pricing
- ✅ `src/pages/SettingsPage.tsx` - Settings tenant
- ✅ `src/pages/settings/SettingsLayout.tsx` - Settings layout
- ✅ `src/pages/settings/SecurityPage.tsx` - Security
- ✅ `src/pages/settings/IntegrationsPage.tsx` - Integrations
- ✅ `src/pages/settings/SubscriptionPremiumPage.tsx` - Subscription premium

**Auth Pages:**
- ✅ `src/pages/auth/LoginPage.tsx` - Login

**Total:** 27 pages existantes

### 1.2 Routes Existantes

**Platform Routes:**
- ✅ `src/server/routes/platform.routes.ts` - Routes platform
  - GET /stats
  - GET /tenants
  - GET /tenants/:id
  - POST /tenants/:id/suspend
  - POST /tenants/:id/activate
  - GET /vouchers
  - POST /vouchers/:id/approve
  - POST /vouchers/:id/reject
  - GET /subscriptions
  - GET /sync/jobs
  - GET /sync/stats
  - GET /audit-logs

**Tenant Routes:**
- ✅ `src/server/routes/subscription.routes.ts` - Subscriptions
- ✅ `src/server/routes/billing.routes.ts` - Billing
- ✅ `src/server/routes/customers.ts` - Customers
- ✅ `src/server/routes/suppliers.ts` - Suppliers
- ✅ `src/server/routes/inventory.ts` - Inventory
- ✅ `src/server/routes/products.ts` - Products
- ✅ `src/server/routes/categories.ts` - Categories
- ✅ `src/server/routes/menu.ts` - Menu
- ✅ `src/server/routes/sales.ts` - Sales
- ✅ `src/server/routes/expenses.ts` - Expenses

**Platform Auth:**
- ✅ `src/server/platform/platform-auth.routes.ts` - Auth platform

**Total:** 30+ routes existantes

### 1.3 APIs Existantes

**Platform APIs:**
- ✅ GET /api/platform/stats
- ✅ GET /api/platform/tenants
- ✅ GET /api/platform/tenants/:id
- ✅ POST /api/platform/tenants/:id/suspend
- ✅ POST /api/platform/tenants/:id/activate
- ✅ GET /api/platform/vouchers
- ✅ POST /api/platform/vouchers/:id/approve
- ✅ POST /api/platform/vouchers/:id/reject
- ✅ GET /api/platform/subscriptions
- ✅ GET /api/platform/sync/jobs
- ✅ GET /api/platform/sync/stats
- ✅ GET /api/platform/audit-logs

**Tenant APIs:**
- ✅ Subscription APIs
- ✅ Billing APIs
- ✅ Customer APIs
- ✅ Product APIs
- ✅ Inventory APIs
- ✅ Sales APIs

**Total:** 50+ APIs existantes

### 1.4 Tables Existantes

**Platform Tables:**
- ✅ `platform.tenants`
- ✅ `platform.subscriptions`
- ✅ `platform.plans`
- ✅ `platform.voucher_requests` (ou `subscription_payment_requests`)
- ✅ `platform.platform_audit_logs`
- ✅ `platform.platform_admins`

**Tenant Tables:**
- ✅ `tenant_users`
- ✅ `users`
- ✅ `customers`
- ✅ `products`
- ✅ `inventory`
- ✅ `sales`
- ✅ `orders`
- ✅ `tables`
- ✅ `categories`
- ✅ `suppliers`
- ✅ `expenses`

**Total:** 20+ tables existantes

### 1.5 Composants Existants

**UI Components:**
- ✅ `src/components/Sidebar.tsx` - Sidebar
- ✅ `src/components/PlanBadge.tsx` - Plan badge
- ✅ `src/components/BusinessHealthCard.tsx` - Health card
- ✅ `src/components/SubscriptionStatus.tsx` - Subscription status
- ✅ `src/components/NotificationCenter.tsx` - Notifications
- ✅ `src/components/GlobalNotificationToast.tsx` - Toasts
- ✅ `src/components/ConfirmDialog.tsx` - Confirm dialog

**Stores:**
- ✅ `src/stores/useSettingsStore.ts` - Settings store
- ✅ `src/stores/useNotificationStore.ts` - Notifications store
- ✅ `src/stores/useTableStore.ts` - Table store

**Layouts:**
- ✅ `src/pages/platform/PlatformLayout.tsx` - Platform layout

**Total:** 10+ composants existants

---

## 2. GAP ANALYSIS

### 2.1 Existe Déjà (À Conserver)

**Backend:**
- ✅ Authentification platform (JWT)
- ✅ RBAC avec rôles prédéfinis
- ✅ Audit logging fonctionnel
- ✅ Sync center opérationnel
- ✅ Gestion tenants basique
- ✅ Subscriptions basiques
- ✅ Vouchers system
- ✅ Billing basique

**Frontend:**
- ✅ Design system complet (couleurs, typography, spacing)
- ✅ Glassmorphism cards
- ✅ Responsive mobile-first
- ✅ Dark theme
- ✅ Animations fluides
- ✅ Plan badges
- ✅ Business health card
- ✅ Notification system

### 2.2 À Refactoriser

**Backend:**
- 🔄 `platform.routes.ts` - Étendre avec nouveaux endpoints
- 🔄 `subscription.routes.ts` - Ajouter trials, upsell
- 🔄 `billing.routes.ts` - Ajouter Mobile Money, taxes
- 🔄 Database schema - Ajouter colonnes manquantes
- 🔄 RBAC - Affiner permissions par module

**Frontend:**
- 🔄 `PlatformDashboard.tsx` - Refondre complètement (Executive Center)
- 🔄 `TenantsPage.tsx` - Déplacer vers `/platform/ops/tenants`
- 🔄 `SubscriptionsPage.tsx` - Déplacer vers `/platform/commercial/subscriptions`
- 🔄 `VouchersPage.tsx` - Déplacer vers `/platform/commercial/promotions`
- 🔄 `AuditLogsPage.tsx` - Déplacer vers `/platform/governance/audit`
- 🔄 `SyncCenterPage.tsx` - Déplacer vers `/platform/ops/sync`
- 🔄 `SettingsPage.tsx` - Déplacer vers `/platform/governance/settings`
- 🔄 `Sidebar.tsx` - Refondre complètement (nouvelle navigation)
- 🔄 `PlatformLayout.tsx` - Adapter nouvelle structure

### 2.3 À Créer

**Backend:**
- ➕ `customer-success.routes.ts` - Customer success APIs
- ➕ `financial-reports.routes.ts` - Financial reports
- ➕ `predictions.routes.ts` - ML predictions
- ➕ `ai-insights.routes.ts` - AI insights
- ➕ `country-intelligence.routes.ts` - Country data
- ➕ `queue-monitor.routes.ts` - Queue monitoring
- ➕ `api-health.routes.ts` - API health metrics
- ➕ `backups.routes.ts` - Backups management

**Frontend:**
- ➕ `ExecutiveDashboard.tsx` - Executive center
- ➕ `CustomerSuccessDashboard.tsx` - CS dashboard
- ➕ `FinancialDashboard.tsx` - Finance dashboard
- ➕ `IntelligenceDashboard.tsx` - Intelligence dashboard
- ➕ `TenantHealthPage.tsx` - Tenant health
- ➕ `ChurnRiskPage.tsx` - Churn analysis
- ➕ `UpsellOpportunitiesPage.tsx` - Upsell
- ➕ `MobileMoneyPage.tsx` - Mobile Money
- ➕ `TaxesPage.tsx` - Taxes
- ➕ `QueueMonitorPage.tsx` - Queue monitor
- ➕ `ApiHealthPage.tsx` - API health
- ➕ `BackupsPage.tsx` - Backups
- ➕ `PredictionsPage.tsx` - Predictions
- ➕ `AiInsightsPage.tsx` - AI insights
- ➕ `CountryIntelligencePage.tsx` - Country intel
- ➕ `RevenueIntelligencePage.tsx` - Revenue intel
- ➕ `PlansPage.tsx` - Plans management
- ➕ `TrialsPage.tsx` - Trials management
- ➕ `SecurityCenterPage.tsx` - Security center
- ➕ `CompliancePage.tsx` - Compliance
- ➕ `RBACPage.tsx` - Roles & permissions

**Total:** 20+ nouveaux modules à créer

### 2.4 À Supprimer

**Aucun module à supprimer** - Tous les modules existants sont conservés et réorganisés.

**Note:** Certains composants peuvent être refactorisés mais pas supprimés.

---

## 3. PRIORISATION

### 3.1 PHASE 1 - Production Ready (Sprint 1-4)

**Objectif:** Lancer la plateforme avec les fonctionnalités core business

**Modules:**
1. **Executive Dashboard** - Vue stratégique
2. **Tenants** - Gestion tenants (déplacé)
3. **Plans** - Gestion plans (NOUVEAU)
4. **Subscriptions** - Abonnements (déplacé)
5. **Promotions** - Vouchers (déplacé + renommé)
6. **Revenue** - Revenue dashboard (étendu)
7. **Payments** - Paiements (NOUVEAU)
8. **Audit Logs** - Logs (déplacé)
9. **Security** - Security center (NOUVEAU)
10. **Settings** - Settings (déplacé)
11. **Sync Center** - Sync (déplacé)

**Livrables:**
- Navigation métier fonctionnelle
- Dashboard exécutif avec KPIs
- Gestion complète tenants/subscriptions
- Revenue tracking
- Audit et sécurité
- 100 tenants beta

### 3.2 PHASE 2 - Customer Success (Sprint 5-8)

**Objectif:** Ajouter les fonctionnalités de rétention et expansion

**Modules:**
1. **Customer Success** - NOUVEAU
   - Tenant Health
   - Adoption
   - Renewals
   - Churn Risk
   - Customer Journey

**Livrables:**
- Health scores automatisés
- NPS surveys
- Churn prediction basique
- Renewal management
- 500 tenants

### 3.3 PHASE 3 - Intelligence (Sprint 9-12)

**Objectif:** Ajouter analytics avancés et AI

**Modules:**
1. **Analytics** - Étendu
2. **AI Insights** - NOUVEAU
3. **Predictions** - NOUVEAU
4. **Country Intelligence** - NOUVEAU
5. **Revenue Intelligence** - NOUVEAU

**Livrables:**
- Analytics avancés
- ML predictions (churn, revenue)
- AI insights automatisés
- Country intelligence
- 2,000 tenants

---

## 4. PLATFORM DASHBOARD FINAL

### 4.1 Layout Complet

```
┌────────────────────────────────────────────────────────────────────┐
│ [☰] Ekala HQ                                    [🔔] [👤 Admin]   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Executive Dashboard                                               │
│  Vue d'ensemble de la plateforme                                   │
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
│  │   -5% ↓  │ │  FCFA    │                                      │
│  │          │ │  +18% ↑  │                                      │
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

### 4.2 KPI Cards (6 cartes)

**Carte 1: Total Tenants**
- Valeur: 123
- Trend: +12% (↑)
- Période: vs mois dernier
- Color: Blue (#3b82f6)

**Carte 2: Active Tenants**
- Valeur: 98
- Trend: +8% (↑)
- Période: vs mois dernier
- Color: Green (#10b981)

**Carte 3: MRR**
- Valeur: 45.2M FCFA
- Trend: +15% (↑)
- Période: vs mois dernier
- Color: Gold (#D4AF37)

**Carte 4: ARR**
- Valeur: 542M FCFA
- Trend: +22% (↑)
- Période: vs mois dernier
- Color: Gold (#D4AF37)

**Carte 5: Active Subscriptions**
- Valeur: 94
- Trend: 94% (↑)
- Période: taux d'activité
- Color: Purple (#a78bfa)

**Carte 6: Trial Tenants**
- Valeur: 23
- Trend: -5% (↓)
- Période: vs mois dernier
- Color: Amber (#f59e0b)

### 4.3 Graphiques

**Graphique 1: MRR Evolution**
- Type: Line chart
- Période: 30 jours
- Comparaison: N-1
- Color: Gold (#D4AF37)
- Fill: Gradient Gold 20% → transparent

**Graphique 2: Tenant Acquisition**
- Type: Bar chart
- Période: 30 jours
- Metrics: New, churned, net
- Colors: Green (new), Red (churned), Blue (net)

### 4.4 Widgets

**Widget 1: Tenants Récents**
- Type: List
- Count: 5 tenants
- Info: Nom, plan, status, pays, MRR
- Action: Voir détails

**Widget 2: Alertes & Actions**
- Type: Alert list + Quick actions
- Alerts: 3 max (critical, warning, info)
- Actions: 4 quick actions

**Widget 3: Santé Plateforme**
- Type: Metrics list
- Metrics: Uptime, API response, Error rate, Active users

**Widget 4: Accès Rapide**
- Type: Navigation grid
- Links: Tenants, Subscriptions, Vouchers, Support, Analytics

### 4.5 Alertes

**Critical (Red):**
- Platform downtime > 5min
- Payment success rate < 90%
- Churn rate > 5%

**Warning (Yellow):**
- 10+ tenants en grâce
- Payment failure rate > 2%
- MRR growth < 5%

**Info (Blue):**
- 45 inscriptions today
- MRR milestone reached

### 4.6 Actions Rapides

1. [+ Nouveau Tenant] - Créer un tenant
2. [💳 Gérer Plans] - Gérer les plans
3. [📄 Créer Voucher] - Créer un voucher
4. [⚙️ Paramètres] - Paramètres plateforme

---

## 5. TENANT DASHBOARD FINAL

### 5.1 Layout Complet

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

### 5.2 Plan Actif

**Affichage:**
- Plan badge: [BUSINESS] (Gold)
- Statut: ● Actif (Green)
- Renouvellement: 15 Fév 2026 (dans 23 jours)
- Action: [Voir mon abonnement →]

### 5.3 Limites du Plan

**BUSINESS Plan:**
- Utilisateurs: 12 / 25 (48% utilisé)
- Succursales: 3 / 10 (30% utilisé)
- Stockage: 85% utilisé
- Fonctionnalités: Toutes débloquées

**Indicateurs:**
- Progress bars pour chaque limite
- Color coding: Green (< 50%), Amber (50-80%), Red (> 80%)
- Alert si > 90%

### 5.4 Utilisation

**KPIs:**
- Ventes du jour: 1.2M FCFA
- Commandes: 45
- Clients: 123
- Produits: 85

**Graphiques:**
- Ventes du jour (line chart)
- Top produits (bar chart)
- Commandes récentes (table)

### 5.5 Recommandations de Montée en Gamme

**Upsell Opportunity:**
- Titre: "Passez à BUSINESS+"
- Raison: "Vous avez utilisé 48% de vos utilisateurs"
- Bénéfices:
  - 50 utilisateurs (au lieu de 25)
  - 20 succursales (au lieu de 10)
  - API access
  - Support prioritaire
- Action: [Voir les plans →]

**Condition d'affichage:**
- Si utilisation > 70% sur n'importe quelle limite
- Si trial actif
- Si plan pas ULTIMATE

---

## 6. PLAN SYSTEM FINAL

### 6.1 STARTER

**Prix:** 15,000 FCFA / mois  
**Idéal pour:** Petits restaurants, cafés

**Limites:**
- Utilisateurs: 5
- Succursales: 1
- Stockage: 5 GB
- API calls: 1,000 / jour

**Fonctionnalités:**
- ✅ Gestion commandes
- ✅ Gestion stock
- ✅ Gestion clients
- ✅ Rapports basiques
- ✅ Support email

**Non inclus:**
- ❌ API access
- ❌ Multi-succursales
- ❌ Support prioritaire
- ❌ Custom branding

### 6.2 BUSINESS

**Prix:** 45,000 FCFA / mois  
**Idéal pour:** Restaurants moyens, hôtels 3 étoiles

**Limites:**
- Utilisateurs: 25
- Succursales: 10
- Stockage: 50 GB
- API calls: 10,000 / jour

**Fonctionnalités:**
- ✅ Tout STARTER
- ✅ Multi-succursales
- ✅ API access
- ✅ Rapports avancés
- ✅ Support prioritaire
- ✅ Custom branding

**Non inclus:**
- ❌ White-label
- ❌ SLA garanti
- ❌ Account manager dédié

### 6.3 ENTERPRISE

**Prix:** 120,000 FCFA / mois  
**Idéal pour:** Chaînes, hôtels 4-5 étoiles

**Limites:**
- Utilisateurs: 100
- Succursales: 50
- Stockage: 200 GB
- API calls: 50,000 / jour

**Fonctionnalités:**
- ✅ Tout BUSINESS
- ✅ White-label
- ✅ SLA 99.9%
- ✅ Account manager dédié
- ✅ Custom integrations
- ✅ Advanced analytics

**Non inclus:**
- ❌ On-premise
- ❌ Custom development

### 6.4 ULTIMATE

**Prix:** 250,000 FCFA / mois  
**Idéal pour:** Grands groupes, chaînes nationales

**Limites:**
- Utilisateurs: Illimité
- Succursales: Illimité
- Stockage: 500 GB
- API calls: Illimité

**Fonctionnalités:**
- ✅ Tout ENTERPRISE
- ✅ On-premise option
- ✅ Custom development
- ✅ 24/7 support
- ✅ Training inclus
- ✅ SLA 99.99%

**Bénéfices exclusifs:**
- 🏆 Priority feature requests
- 🏆 Beta access
- 🏆 Executive reviews

### 6.5 Comparatif Plans

| Feature | STARTER | BUSINESS | ENTERPRISE | ULTIMATE |
|---------|---------|----------|------------|----------|
| Prix | 15k | 45k | 120k | 250k |
| Utilisateurs | 5 | 25 | 100 | ∞ |
| Succursales | 1 | 10 | 50 | ∞ |
| Stockage | 5 GB | 50 GB | 200 GB | 500 GB |
| API calls | 1k/jour | 10k/jour | 50k/jour | ∞ |
| Multi-succursales | ❌ | ✅ | ✅ | ✅ |
| API access | ❌ | ✅ | ✅ | ✅ |
| White-label | ❌ | ❌ | ✅ | ✅ |
| SLA | 99.5% | 99.5% | 99.9% | 99.99% |
| Support | Email | Prioritaire | Dédié | 24/7 |
| Account manager | ❌ | ❌ | ✅ | ✅ |

---

## 7. IMPLEMENTATION ORDER

### 7.1 SPRINT 1 - Foundation (Semaines 1-2)

**Objectif:** Mettre en place la nouvelle navigation et le dashboard exécutif

**Tâches:**

**Backend:**
1. Étendre `platform.routes.ts` avec nouveaux endpoints
2. Créer `executive.routes.ts` (dashboard, revenue, growth, countries)
3. Ajouter colonnes manquantes dans `platform.tenants` (health_score, churn_risk, country_code)
4. Créer API `/api/platform/executive/dashboard`
5. Créer API `/api/platform/executive/revenue`
6. Créer API `/api/platform/executive/growth`
7. Créer API `/api/platform/executive/countries`

**Frontend:**
1. Refondre `Sidebar.tsx` avec nouvelle structure (7 centres)
2. Créer `ExecutiveDashboard.tsx`
3. Refondre `PlatformDashboard.tsx` → `ExecutiveDashboard.tsx`
4. Créer composants KPI Cards (6 cartes)
5. Créer composants Charts (Line, Bar)
6. Créer composants Widgets (Tenants récents, Alertes, Santé plateforme)
7. Intégrer Design System V1

**Livrables:**
- ✅ Nouvelle navigation fonctionnelle
- ✅ Executive Dashboard opérationnel
- ✅ 6 KPI cards
- ✅ 2 graphiques
- ✅ 4 widgets

**Tests:**
- Tests unitaires composants
- Tests intégration APIs
- Tests responsive (Desktop, Tablet, Mobile)

---

### 7.2 SPRINT 2 - Core Operations (Semaines 3-4)

**Objectif:** Finaliser les opérations core (Tenants, Plans, Subscriptions, Promotions)

**Tâches:**

**Backend:**
1. Créer `plans.routes.ts` (CRUD plans)
2. Créer `promotions.routes.ts` (CRUD promotions)
3. Étendre `subscription.routes.ts` (trials, upsell)
4. Créer API `/api/platform/commercial/plans`
5. Créer API `/api/platform/commercial/promotions`
6. Créer API `/api/platform/commercial/trials`
7. Créer API `/api/platform/commercial/upsell-opportunities`
8. Déplacer routes Tenants vers `/platform/ops/tenants`
9. Déplacer routes Subscriptions vers `/platform/commercial/subscriptions`
10. Déplacer routes Vouchers vers `/platform/commercial/promotions`

**Frontend:**
1. Créer `PlansPage.tsx` (gestion plans)
2. Créer `TrialsPage.tsx` (gestion trials)
3. Créer `UpsellOpportunitiesPage.tsx` (opportunités upsell)
4. Déplacer `TenantsPage.tsx` → `/platform/ops/tenants`
5. Déplacer `SubscriptionsPage.tsx` → `/platform/commercial/subscriptions`
6. Déplacer `VouchersPage.tsx` → `/platform/commercial/promotions`
7. Créer composants Plan Form, Plan Card
8. Créer composants Trial Card, Upsell Card

**Livrables:**
- ✅ Plans management (CRUD)
- ✅ Trials management
- ✅ Upsell opportunities
- ✅ Tenants page déplacée
- ✅ Subscriptions page déplacée
- ✅ Promotions page déplacée

**Tests:**
- Tests CRUD plans
- Tests trials workflow
- Tests upsell detection

---

### 7.3 SPRINT 3 - Financial Operations (Semaines 5-6)

**Objectif:** Implémenter les opérations financières complètes

**Tâches:**

**Backend:**
1. Créer `invoices.routes.ts` (CRUD invoices)
2. Créer `payments.routes.ts` (payments, refunds)
3. Créer `mobile-money.routes.ts` (Mobile Money tracking)
4. Créer `taxes.routes.ts` (tax management)
5. Créer `financial-reports.routes.ts` (reports)
6. Créer tables: `platform.invoices`, `platform.payments`, `platform.mobile_money_transactions`, `platform.taxes`
7. Créer API `/api/platform/finance/revenue`
8. Créer API `/api/platform/finance/invoices`
9. Créer API `/api/platform/finance/payments`
10. Créer API `/api/platform/finance/mobile-money`
11. Créer API `/api/platform/finance/taxes`
12. Créer API `/api/platform/finance/reports`

**Frontend:**
1. Créer `FinancialDashboard.tsx`
2. Créer `InvoicesPage.tsx`
3. Créer `PaymentsPage.tsx`
4. Créer `MobileMoneyPage.tsx`
5. Créer `TaxesPage.tsx`
6. Créer `FinancialReportsPage.tsx`
7. Créer composants Invoice Card, Payment Card
8. Créer composants Mobile Money Chart, Tax Calculator

**Livrables:**
- ✅ Revenue dashboard
- ✅ Invoices management
- ✅ Payments tracking
- ✅ Mobile Money analytics
- ✅ Taxes management
- ✅ Financial reports

**Tests:**
- Tests invoices workflow
- Tests payments processing
- Tests Mobile Money integration
- Tests tax calculation

---

### 7.4 SPRINT 4 - Governance & Security (Semaines 7-8)

**Objectif:** Finaliser la gouvernance et la sécurité

**Tâches:**

**Backend:**
1. Créer `security.routes.ts` (security center)
2. Créer `rbac.routes.ts` (roles & permissions)
3. Créer `compliance.routes.ts` (compliance)
4. Créer tables: `platform.security_incidents`, `platform.failed_logins`, `platform.compliance_checks`
5. Déplacer routes Audit Logs vers `/platform/governance/audit`
6. Déplacer routes Settings vers `/platform/governance/settings`
7. Créer API `/api/platform/governance/security`
8. Créer API `/api/platform/governance/rbac`
9. Créer API `/api/platform/governance/compliance`

**Frontend:**
1. Créer `SecurityCenterPage.tsx`
2. Créer `RBACPage.tsx` (roles & permissions)
3. Créer `CompliancePage.tsx`
4. Déplacer `AuditLogsPage.tsx` → `/platform/governance/audit`
5. Déplacer `SettingsPage.tsx` → `/platform/governance/settings`
6. Créer composants Security Incident Card, RBAC Matrix
7. Créer composants Compliance Scorecard

**Livrables:**
- ✅ Security center
- ✅ RBAC management
- ✅ Compliance dashboard
- ✅ Audit logs déplacés
- ✅ Settings déplacés

**Tests:**
- Tests security incidents
- Tests RBAC permissions
- Tests compliance checks

---

### 7.5 PHASE 2 - Customer Success (Sprint 5-8)

**Objectif:** Ajouter les fonctionnalités de rétention et expansion

**Sprint 5 (Semaines 9-10):**
- Tenant Health scores
- Adoption tracking
- NPS surveys

**Sprint 6 (Semaines 11-12):**
- Renewals management
- Churn prediction basique
- Customer journey mapping

**Sprint 7 (Semaines 13-14):**
- Onboarding automation
- Health score automation
- Alerts intelligentes CS

**Sprint 8 (Semaines 15-16):**
- Win-back campaigns
- Expansion opportunities
- CS dashboard

### 7.6 PHASE 3 - Intelligence (Sprint 9-12)

**Objectif:** Ajouter analytics avancés et AI

**Sprint 9 (Semaines 17-18):**
- Analytics avancés
- Cohort analysis
- Funnel analysis

**Sprint 10 (Semaines 19-20):**
- Revenue intelligence
- Country intelligence
- Predictions basiques

**Sprint 11 (Semaines 21-22):**
- AI insights
- Anomaly detection
- Smart alerts

**Sprint 12 (Semaines 23-24):**
- ML models (churn, revenue)
- Revenue forecast
- Custom dashboards

---

## 8. CRITÈRES DE SUCCÈS

### 8.1 Phase 1 (Sprint 1-4)

**Technique:**
- ✅ Nouvelle navigation fonctionnelle
- ✅ Executive Dashboard opérationnel
- ✅ 100% des APIs core fonctionnelles
- ✅ 0 régression fonctionnelle
- ✅ Performance: < 200ms API response
- ✅ Uptime: 99.5%

**Business:**
- ✅ 100 tenants beta
- ✅ MRR tracking fonctionnel
- ✅ Revenue tracking fonctionnel
- ✅ Audit logs complets
- ✅ Security center opérationnel

### 8.2 Phase 2 (Sprint 5-8)

**Technique:**
- ✅ Customer Success APIs
- ✅ Health scores automatisés
- ✅ Churn prediction basique
- ✅ NPS surveys fonctionnels

**Business:**
- ✅ 500 tenants
- ✅ Churn rate < 5%
- ✅ NPS > 40
- ✅ Renewal rate > 80%

### 8.3 Phase 3 (Sprint 9-12)

**Technique:**
- ✅ Analytics avancés
- ✅ ML models déployés
- ✅ AI insights automatisés
- ✅ Predictions fonctionnelles

**Business:**
- ✅ 2,000 tenants
- ✅ MRR: 300M FCFA
- ✅ Churn < 3%
- ✅ NPS > 50
- ✅ Uptime: 99.9%

---

## 9. RISQUES & MITIGATION

### 9.1 Risques Techniques

**Risque 1: Dette technique**
- Impact: Élevé
- Mitigation: Refactoring continu, code reviews, tests automatisés

**Risque 2: Performance**
- Impact: Élevé
- Mitigation: Caching, CDN, database optimization, monitoring

**Risque 3: Sécurité**
- Impact: Critique
- Mitigation: RBAC, audit logs, security scans, penetration testing

### 9.2 Risques Business

**Risque 1: Adoption utilisateurs**
- Impact: Élevé
- Mitigation: UX testing, onboarding, support réactif

**Risque 2: Churn**
- Impact: Élevé
- Mitigation: Customer success, health scores, proactive outreach

**Risque 3: Concurrence**
- Impact: Moyen
- Mitigation: Innovation, différenciation, pricing compétitif

---

## 10. PROCHAINES ÉTAPES

### 10.1 Immédiat (Cette semaine)

1. ✅ Validation de ce blueprint
2. ✅ Assignation des équipes
3. ✅ Setup environnement de dev
4. ✅ Création des branches Git
5. ✅ Configuration CI/CD

### 10.2 Court terme (Sprint 1)

1. ✅ Kickoff meeting
2. ✅ Daily standups
3. ✅ Sprint planning
4. ✅ Développement Sprint 1
5. ✅ Sprint review & retrospective

### 10.3 Moyen terme (Sprint 1-4)

1. ✅ Développement Phase 1
2. ✅ Tests utilisateurs
3. ✅ Beta testing (100 tenants)
4. ✅ Corrections et améliorations
5. ✅ Launch Production

### 10.4 Long terme (Sprint 5-12)

1. ✅ Développement Phase 2 (CS)
2. ✅ Développement Phase 3 (Intelligence)
3. ✅ Scale à 2,000 tenants
4. ✅ Expansion régionale
5. ✅ Nouveaux marchés

---

## CONCLUSION

Ce blueprint définit le plan d'exécution concret pour transformer Ekala en une plateforme SaaS de niveau international.

**Points clés:**
- ✅ Inventaire complet de l'existant
- ✅ Gap analysis détaillé
- ✅ Priorisation en 3 phases
- ✅ Platform Dashboard final défini
- ✅ Tenant Dashboard final défini
- ✅ Plan System complet (4 plans)
- ✅ Implementation order sur 12 sprints
- ✅ Critères de succès mesurables
- ✅ Gestion des risques

**Prochaine étape:** Validation → Sprint 1 → Executive Dashboard

**Objectif:** Construire sans dette fonctionnelle, avec qualité et vitesse.

**Comparables:** Shopify HQ, Stripe Dashboard, Lightspeed HQ, HubSpot Enterprise