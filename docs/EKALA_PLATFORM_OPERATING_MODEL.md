# EKALA PLATFORM - OPERATING MODEL V1
## Architecture Opérationnelle et Navigation

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Operating Model Specification  
**Target:** Transformation vers une plateforme orientée métier

**Comparables:** Shopify HQ, Stripe Dashboard, Lightspeed HQ, HubSpot Enterprise

---

## TABLE DES MATIÈRES

1. [Audit Navigation Actuelle](#1-audit-navigation-actuelle)
2. [Nouvelle Architecture de Navigation](#2-nouvelle-architecture-de-navigation)
3. [Cartographie de Migration](#3-cartographie-de-migration)
4. [Modules Réutilisables](#4-modules-réutilisables)
5. [Nouveaux Écrans](#5-nouveaux-écrans)
6. [KPIs par Module](#6-kpis-par-module)
7. [Widgets Dashboard](#7-widgets-dashboard)
8. [Permissions RBAC](#8-permissions-rbac)
9. [APIs Nécessaires](#9-apis-nécessaires)
10. [Tables SQLite/Supabase](#10-tables-sqlitesupabase)
11. [Alertes Intelligentes](#11-alertes-intelligentes)

---

## 1. AUDIT NAVIGATION ACTUELLE

### 1.1 Structure Actuelle (Technique)

```
PLATFORM ACTUELLE
├── Dashboard (/platform)
├── Tenants (/platform/tenants)
├── Subscriptions (/platform/subscriptions)
├── Billing (/platform/billing)
├── Vouchers (/platform/vouchers)
├── Audit Logs (/platform/audit-logs)
├── Sync Center (/platform/sync)
└── Settings (/platform/settings)
```

### 1.2 Problèmes Identifiés

**❌ Orientation Technique:**
- Navigation basée sur des entités techniques (tenants, subscriptions)
- Pas de vision métier (revenue, growth, customer success)
- Manque de contexte business

**❌ Manque de Hiérarchie:**
- Tous les modules au même niveau
- Pas de distinction Executive / Operations / Intelligence
- Pas de priorisation des actions

**❌ Gap Analytics:**
- Pas de module Analytics dédié
- Pas de Revenue Intelligence
- Pas de Country Intelligence
- Pas de Predictions / AI Insights

**❌ Customer Success Absent:**
- Pas de vue sur la santé des tenants
- Pas de suivi NPS, adoption, churn
- Pas d'opportunités d'expansion

**❌ Financial Operations Faible:**
- Billing basique
- Pas de Mobile Money tracking
- Pas de Taxes management
- Pas de Financial Reports avancés

### 1.3 Forces à Conserver

**✅ Points Positifs:**
- RBAC déjà en place
- Audit logs fonctionnels
- Sync Center opérationnel
- Infrastructure monitoring existant
- Base de données solide

---

## 2. NOUVELLE ARCHITECTURE DE NAVIGATION

### 2.1 Structure Cible (Métier)

```
EKALA HQ - PLATFORM
│
├── EXECUTIVE CENTER
│   ├── Dashboard (/platform/executive)
│   ├── Revenue (/platform/executive/revenue)
│   ├── Growth (/platform/executive/growth)
│   ├── Countries (/platform/executive/countries)
│   └── Executive Reports (/platform/executive/reports)
│
├── CUSTOMER SUCCESS
│   ├── Tenant Health (/platform/cs/health)
│   ├── Adoption (/platform/cs/adoption)
│   ├── Renewals (/platform/cs/renewals)
│   ├── Churn Risk (/platform/cs/churn)
│   └── Customer Journey (/platform/cs/journey)
│
├── COMMERCIAL OPERATIONS
│   ├── Plans (/platform/commercial/plans)
│   ├── Subscriptions (/platform/commercial/subscriptions)
│   ├── Promotions (/platform/commercial/promotions)
│   ├── Trials (/platform/commercial/trials)
│   └── Upsell Opportunities (/platform/commercial/upsell)
│
├── FINANCIAL OPERATIONS
│   ├── Revenue (/platform/finance/revenue)
│   ├── Invoices (/platform/finance/invoices)
│   ├── Payments (/platform/finance/payments)
│   ├── Mobile Money (/platform/finance/mobile-money)
│   ├── Taxes (/platform/finance/taxes)
│   └── Financial Reports (/platform/finance/reports)
│
├── PLATFORM OPERATIONS
│   ├── Tenants (/platform/ops/tenants)
│   ├── Infrastructure (/platform/ops/infrastructure)
│   ├── Sync Center (/platform/ops/sync)
│   ├── Queue Monitor (/platform/ops/queue)
│   ├── API Health (/platform/ops/api-health)
│   └── Backups (/platform/ops/backups)
│
├── INTELLIGENCE CENTER
│   ├── Analytics (/platform/intelligence/analytics)
│   ├── Predictions (/platform/intelligence/predictions)
│   ├── AI Insights (/platform/intelligence/ai-insights)
│   ├── Country Intelligence (/platform/intelligence/countries)
│   └── Revenue Intelligence (/platform/intelligence/revenue)
│
└── GOVERNANCE
    ├── Audit Logs (/platform/governance/audit)
    ├── Security Center (/platform/governance/security)
    ├── Roles & Permissions (/platform/governance/rbac)
    ├── Compliance (/platform/governance/compliance)
    └── Platform Settings (/platform/governance/settings)
```

### 2.2 Principes d'Organisation

**Executive Center:**
- Vue stratégique pour C-level
- KPIs business haut niveau
- Revenue, Growth, Countries
- Executive Reports

**Customer Success:**
- Rétention et expansion
- Health scores, adoption, churn
- Customer journey mapping

**Commercial Operations:**
- Gestion commerciale
- Plans, subscriptions, promotions
- Trials, upsell opportunities

**Financial Operations:**
- Gestion financière complète
- Revenue, invoices, payments
- Mobile Money, taxes, reports

**Platform Operations:**
- Opérations techniques
- Tenants, infrastructure, sync
- Queue, API health, backups

**Intelligence Center:**
- BI et analytics avancés
- Predictions, AI insights
- Country & Revenue intelligence

**Governance:**
- Sécurité et conformité
- Audit, RBAC, compliance
- Platform settings

---

## 3. CARTOGRAPHIE DE MIGRATION

### 3.1 Matrice de Migration Écran → Écran

| Écran Actuel | Écran Cible | Changement | Raison |
|--------------|-------------|------------|--------|
| `/platform` (Dashboard) | `/platform/executive` | **Renommé + enrichi** | Orientation métier |
| `/platform/tenants` | `/platform/ops/tenants` | **Déplacé** | Regroupement ops |
| `/platform/subscriptions` | `/platform/commercial/subscriptions` | **Déplacé** | Orientation commerciale |
| `/platform/billing` | `/platform/finance/revenue` | **Étendu** | Vue financière complète |
| `/platform/vouchers` | `/platform/commercial/promotions` | **Renommé** | Vocabulaire métier |
| `/platform/audit-logs` | `/platform/governance/audit` | **Déplacé** | Regroupement governance |
| `/platform/sync` | `/platform/ops/sync` | **Déplacé** | Regroupement ops |
| `/platform/settings` | `/platform/governance/settings` | **Déplacé** | Regroupement governance |

### 3.2 Nouveaux Écrans à Créer

**Executive Center:**
- `/platform/executive/revenue` - Revenue dashboard
- `/platform/executive/growth` - Growth metrics
- `/platform/executive/countries` - Country performance
- `/platform/executive/reports` - Executive reports

**Customer Success:**
- `/platform/cs/health` - Tenant health scores
- `/platform/cs/adoption` - Feature adoption
- `/platform/cs/renewals` - Renewal management
- `/platform/cs/churn` - Churn risk analysis
- `/platform/cs/journey` - Customer journey mapping

**Commercial Operations:**
- `/platform/commercial/plans` - Plans management
- `/platform/commercial/subscriptions` - Subscriptions (existant)
- `/platform/commercial/promotions` - Promotions (existant)
- `/platform/commercial/trials` - Trial management
- `/platform/commercial/upsell` - Upsell opportunities

**Financial Operations:**
- `/platform/finance/revenue` - Revenue dashboard (existant étendu)
- `/platform/finance/invoices` - Invoices management
- `/platform/finance/payments` - Payments tracking
- `/platform/finance/mobile-money` - Mobile Money analytics
- `/platform/finance/taxes` - Tax management
- `/platform/finance/reports` - Financial reports

**Platform Operations:**
- `/platform/ops/tenants` - Tenants management (existant)
- `/platform/ops/infrastructure` - Infrastructure monitoring
- `/platform/ops/sync` - Sync center (existant)
- `/platform/ops/queue` - Queue monitor
- `/platform/ops/api-health` - API health dashboard
- `/platform/ops/backups` - Backups management

**Intelligence Center:**
- `/platform/intelligence/analytics` - Analytics (existant étendu)
- `/platform/intelligence/predictions` - ML predictions
- `/platform/intelligence/ai-insights` - AI-powered insights
- `/platform/intelligence/countries` - Country intelligence
- `/platform/intelligence/revenue` - Revenue intelligence

**Governance:**
- `/platform/governance/audit` - Audit logs (existant)
- `/platform/governance/security` - Security center
- `/platform/governance/rbac` - Roles & permissions
- `/platform/governance/compliance` - Compliance dashboard
- `/platform/governance/settings` - Platform settings (existant)

### 3.3 Écrans Supprimés

**Aucun écran supprimé** - Tous les écrans existants sont conservés et réorganisés.

---

## 4. MODULES RÉUTILISABLES

### 4.1 Modules Existant à Conserver

**Backend:**
- ✅ `platform.routes.ts` - Routes platform (à étendre)
- ✅ `platform-auth.middleware.ts` - Authentification
- ✅ `rbac-cache.service.ts` - RBAC cache
- ✅ `policy-engine.ts` - Policy engine
- ✅ `security-layer.ts` - Security layer
- ✅ `audit-queue.service.ts` - Audit logging
- ✅ `event-bus.service.ts` - Event bus
- ✅ `circuit-breaker.service.ts` - Circuit breaker

**Frontend:**
- ✅ `PlatformLayout.tsx` - Layout platform
- ✅ `PlatformDashboard.tsx` - Dashboard (à enrichir)
- ✅ `TenantsPage.tsx` - Tenants (à déplacer)
- ✅ `SubscriptionsPage.tsx` - Subscriptions (à déplacer)
- ✅ `VouchersPage.tsx` - Vouchers (à déplacer)
- ✅ `AuditLogsPage.tsx` - Audit logs (à déplacer)
- ✅ `SyncCenterPage.tsx` - Sync center (à déplacer)
- ✅ `SettingsPage.tsx` - Settings (à déplacer)

**Design System:**
- ✅ `EKALA_DESIGN_SYSTEM_V1.md` - Design system complet
- ✅ `EKALA_PLATFORM_WIREFRAMES_V1.md` - Wireframes

### 4.2 Modules à Étendre

**Backend:**
- 🔄 `platform.routes.ts` - Ajouter nouveaux endpoints
- 🔄 `subscription.routes.ts` - Étendre pour trials, upsell
- 🔄 `billing.routes.ts` - Ajouter Mobile Money, taxes
- 🔄 Database schema - Ajouter tables manquantes

**Frontend:**
- 🔄 `PlatformDashboard.tsx` - Ajouter sections Executive
- 🔄 `TenantsPage.tsx` - Ajouter health scores, adoption
- 🔄 `SubscriptionsPage.tsx` - Ajouter trials, upsell
- 🔄 `Sidebar.tsx` - Nouvelle structure de navigation

### 4.3 Modules à Créer

**Backend:**
- ➕ `customer-success.routes.ts` - Customer success APIs
- ➕ `financial-reports.routes.ts` - Financial reports
- ➕ `predictions.routes.ts` - ML predictions
- ➕ `ai-insights.routes.ts` - AI insights
- ➕ `country-intelligence.routes.ts` - Country data

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

---

## 5. NOUVEAUX ÉCRANS

### 5.1 Executive Center (4 nouveaux écrans)

**5.1.1 Revenue Dashboard** (`/platform/executive/revenue`)
- MRR, ARR, NRR, ARPU
- Revenue by plan, country, currency
- Revenue forecast
- Revenue trends (30j, 90j, 1an)

**5.1.2 Growth Dashboard** (`/platform/executive/growth`)
- Tenant growth (new, churned, net)
- Trial conversion rate
- Feature adoption rate
- DAU/MAU ratio

**5.1.3 Countries Dashboard** (`/platform/executive/countries`)
- Revenue by country
- Tenants by country
- Mobile Money adoption by country
- Network performance by country

**5.1.4 Executive Reports** (`/platform/executive/reports`)
- Monthly executive summary
- Board reports
- Investor reports
- Custom reports builder

### 5.2 Customer Success (5 nouveaux écrans)

**5.2.1 Tenant Health** (`/platform/cs/health`)
- Health scores (0-100)
- Health distribution
- At-risk tenants
- Health trends

**5.2.2 Adoption** (`/platform/cs/adoption`)
- Feature adoption rate
- Feature usage heatmap
- Adoption by tenant segment
- Adoption trends

**5.2.3 Renewals** (`/platform/cs/renewals`)
- Upcoming renewals (30j, 90j)
- Renewal rate
- Renewal trends
- Renewal actions

**5.2.4 Churn Risk** (`/platform/cs/churn`)
- Churn prediction scores
- At-risk tenants list
- Churn reasons analysis
- Win-back campaigns

**5.2.5 Customer Journey** (`/platform/cs/journey`)
- Onboarding funnel
- Milestone tracking
- Engagement timeline
- Journey mapping

### 5.3 Commercial Operations (2 nouveaux écrans)

**5.3.1 Plans** (`/platform/commercial/plans`)
- Plans management (CRUD)
- Plan features
- Plan quotas
- Plan pricing

**5.3.2 Trials** (`/platform/commercial/trials`)
- Trial tenants list
- Trial conversion funnel
- Trial duration management
- Trial extensions

**5.3.3 Upsell Opportunities** (`/platform/commercial/upsell`)
- Upgrade opportunities
- Expansion revenue potential
- Usage-based triggers
- Recommended upgrades

### 5.4 Financial Operations (3 nouveaux écrans)

**5.4.1 Invoices** (`/platform/finance/invoices`)
- Invoice list
- Invoice details
- Invoice generation
- Invoice templates

**5.4.2 Payments** (`/platform/finance/payments`)
- Payment history
- Payment methods breakdown
- Payment failures
- Refunds management

**5.4.3 Mobile Money** (`/platform/finance/mobile-money`)
- Mobile Money revenue
- Mobile Money providers (Orange, M-Pesa, Moov)
- Success rate by provider
- Transaction volume

**5.4.4 Taxes** (`/platform/finance/taxes`)
- Tax configuration
- Tax by country
- Tax reports
- VAT/GST management

**5.4.5 Financial Reports** (`/platform/finance/reports`)
- P&L reports
- Balance sheet
- Cash flow
- Revenue recognition

### 5.5 Platform Operations (2 nouveaux écrans)

**5.5.1 Queue Monitor** (`/platform/ops/queue`)
- Queue depth
- Queue throughput
- Failed jobs
- Queue performance

**5.5.2 API Health** (`/platform/ops/api-health`)
- API response time (p50, p95, p99)
- API error rate
- API endpoints status
- API latency by endpoint

**5.5.3 Backups** (`/platform/ops/backups`)
- Backup history
- Backup status
- Backup restoration
- Backup scheduling

### 5.6 Intelligence Center (5 nouveaux écrans)

**5.6.1 Analytics** (`/platform/intelligence/analytics`)
- Revenue analytics
- Tenant analytics
- Feature analytics
- Cohort analysis

**5.6.2 Predictions** (`/platform/intelligence/predictions`)
- Churn prediction
- Revenue forecast
- Tenant growth forecast
- Feature adoption forecast

**5.6.3 AI Insights** (`/platform/intelligence/ai-insights`)
- Automated insights
- Anomaly detection
- Recommendations
- Smart alerts

**5.6.4 Country Intelligence** (`/platform/intelligence/countries`)
- Market analysis by country
- Competitive landscape
- Growth opportunities
- Regional trends

**5.6.5 Revenue Intelligence** (`/platform/intelligence/revenue`)
- Revenue drivers
- Revenue optimization
- Pricing insights
- Revenue forecasting

### 5.7 Governance (1 nouvel écran)

**5.7.1 Security Center** (`/platform/governance/security`)
- Security incidents
- Failed login attempts
- IP whitelisting
- Security metrics

---

## 6. KPIs PAR MODULE

### 6.1 Executive Center

**Revenue:**
- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- NRR (Net Revenue Retention)
- ARPU (Average Revenue Per User)
- Revenue growth (MoM, YoY)

**Growth:**
- New tenants (7j, 30j, 90j)
- Churned tenants (7j, 30j, 90j)
- Net tenant growth
- Trial conversion rate
- Feature adoption rate

**Countries:**
- Revenue by country
- Tenants by country
- Market penetration
- Growth by country

### 6.2 Customer Success

**Tenant Health:**
- Health score (0-100)
- Healthy tenants (%)
- At-risk tenants (%)
- Critical tenants (%)

**Adoption:**
- Feature adoption rate (%)
- DAU/MAU ratio
- Session duration
- Feature usage depth

**Renewals:**
- Renewal rate (%)
- Upcoming renewals (30j, 90j)
- Renewal value
- Renewal trends

**Churn:**
- Churn rate (%)
- Churn prediction accuracy
- At-risk tenants count
- Win-back rate (%)

### 6.3 Commercial Operations

**Plans:**
- Plans count
- Plan distribution
- Plan revenue contribution
- Plan upgrades

**Subscriptions:**
- Active subscriptions
- Trial subscriptions
- Cancelled subscriptions
- Subscription growth

**Promotions:**
- Active promotions
- Redemption rate (%)
- Revenue impact
- ROI by promotion

**Trials:**
- Active trials
- Trial conversion rate (%)
- Trial duration (avg)
- Trial to paid conversion

**Upsell:**
- Upsell opportunities count
- Upsell potential revenue
- Upsell conversion rate (%)
- Expansion revenue (%)

### 6.4 Financial Operations

**Revenue:**
- Total revenue
- Revenue by plan
- Revenue by country
- Revenue by currency

**Invoices:**
- Invoices generated
- Invoices paid
- Invoices pending
- Invoices overdue

**Payments:**
- Payment success rate (%)
- Payment volume
- Payment methods breakdown
- Average transaction value

**Mobile Money:**
- Mobile Money revenue
- Mobile Money transactions
- Success rate by provider
- Provider market share

**Taxes:**
- Tax collected
- Tax by country
- Tax compliance rate (%)
- Tax reports filed

### 6.5 Platform Operations

**Tenants:**
- Total tenants
- Active tenants
- Suspended tenants
- Trial tenants

**Infrastructure:**
- Uptime (%)
- API response time (ms)
- Error rate (%)
- Database performance

**Sync:**
- Sync jobs total
- Sync success rate (%)
- Sync failures
- Sync latency

**Queue:**
- Queue depth
- Queue throughput
- Failed jobs
- Queue processing time

**API Health:**
- API calls (24h, 7j, 30j)
- API success rate (%)
- API latency (p50, p95, p99)
- API errors

**Backups:**
- Backup success rate (%)
- Last backup time
- Backup size
- Backup retention

### 6.6 Intelligence Center

**Analytics:**
- DAU (Daily Active Users)
- MAU (Monthly Active Users)
- Feature adoption rate (%)
- Session duration (min)

**Predictions:**
- Churn prediction accuracy (%)
- Revenue forecast accuracy (%)
- Prediction confidence
- Model performance

**AI Insights:**
- Insights generated
- Insights acted upon
- Insight impact
- Insight accuracy

**Country Intelligence:**
- Market size by country
- Growth rate by country
- Competitive position
- Market share

**Revenue Intelligence:**
- Revenue drivers
- Revenue optimization opportunities
- Pricing elasticity
- Revenue concentration

### 6.7 Governance

**Audit:**
- Audit events (24h, 7j, 30j)
- Audit events by type
- Audit events by user
- Audit compliance (%)

**Security:**
- Security incidents
- Failed login attempts
- Suspicious activities
- Security score (%)

**RBAC:**
- Roles count
- Permissions count
- Users by role
- Permission changes

**Compliance:**
- Compliance score (%)
- Compliance checks passed
- Compliance checks failed
- Compliance reports

---

## 7. WIDGETS DASHBOARD

### 7.1 Executive Center Widgets

**Widget 1: MRR Gauge**
- Type: Gauge chart
- Value: MRR actuel
- Target: Target MRR
- Trend: MoM change

**Widget 2: Revenue Trend**
- Type: Area chart
- Période: 30 jours
- Comparaison: N-1
- Breakdown: By plan, country

**Widget 3: Tenant Growth**
- Type: Bar chart
- Période: 30 jours
- Metrics: New, churned, net
- Breakdown: By country

**Widget 4: Country Performance**
- Type: Map + Table
- Metrics: Revenue, tenants, growth
- Top 5 countries
- Heatmap

**Widget 5: Key Metrics**
- Type: KPI cards (4 cards)
- Metrics: MRR, ARR, NRR, ARPU
- Trend indicators

### 7.2 Customer Success Widgets

**Widget 6: Health Score Distribution**
- Type: Histogram
- Ranges: 0-39, 40-69, 70-100
- Count by range
- Trend

**Widget 7: At-Risk Tenants**
- Type: List
- Count: Top 10
- Metrics: Health score, days since login
- Actions: Contact, intervene

**Widget 8: Adoption Heatmap**
- Type: Heatmap
- Features: Rows
- Tenants: Columns
- Usage intensity: Color

**Widget 9: Renewal Pipeline**
- Type: Funnel
- Stages: Upcoming, contacted, confirmed, renewed
- Value by stage
- Conversion rate

**Widget 10: Churn Prediction**
- Type: Scatter plot
- X: Churn probability
- Y: Revenue impact
- Size: Tenant size
- Color: Risk level

### 7.3 Commercial Operations Widgets

**Widget 11: Subscription Metrics**
- Type: KPI cards
- Metrics: Active, trial, cancelled
- Trends: MoM

**Widget 12: Trial Conversion Funnel**
- Type: Funnel
- Stages: Started, active, converted, churned
- Conversion rate by stage

**Widget 13: Upsell Opportunities**
- Type: List
- Count: Top 10
- Metrics: Current plan, recommended plan, potential revenue
- Actions: Contact, propose upgrade

**Widget 14: Promotion Performance**
- Type: Table
- Metrics: Code, type, redemptions, revenue impact
- Sort by: Redemption rate, revenue impact

### 7.4 Financial Operations Widgets

**Widget 15: Revenue Breakdown**
- Type: Pie chart
- Breakdown: By plan, country, currency
- Top contributors

**Widget 16: Payment Methods**
- Type: Donut chart
- Methods: Mobile Money, Card, Bank
- Success rate by method
- Volume by method

**Widget 17: Mobile Money Performance**
- Type: Bar chart
- Providers: Orange, M-Pesa, Moov
- Metrics: Volume, success rate, avg transaction
- Trends

**Widget 18: Invoice Status**
- Type: KPI cards
- Metrics: Paid, pending, overdue
- Amounts
- Trends

**Widget 19: Financial Health**
- Type: Gauge
- Metrics: Revenue, expenses, profit
- Target vs actual
- Trend

### 7.5 Platform Operations Widgets

**Widget 20: Platform Uptime**
- Type: Gauge
- Value: Uptime %
- Target: 99.9%
- Trend: 30 days

**Widget 21: API Performance**
- Type: Line chart
- Metrics: Response time (p50, p95, p99)
- Period: 24h
- Thresholds: Warning, critical

**Widget 22: Sync Status**
- Type: Status cards
- Metrics: Total, pending, processing, failed
- Last sync time
- Actions: Retry failed

**Widget 23: Queue Depth**
- Type: Line chart
- Metric: Queue depth
- Period: 24h
- Thresholds: Warning, critical

**Widget 24: Backup Status**
- Type: Table
- Metrics: Date, size, status, duration
- Last 10 backups
- Actions: Download, restore

### 7.6 Intelligence Center Widgets

**Widget 25: Revenue Forecast**
- Type: Area chart
- Actual: Past 90 days
- Forecast: Next 90 days
- Confidence interval

**Widget 26: Churn Prediction**
- Type: Scatter plot
- X: Churn probability
- Y: Revenue
- Color: Risk level
- Size: Tenant size

**Widget 27: Feature Adoption**
- Type: Bar chart
- Features: Top 10
- Adoption rate (%)
- Trend: 30 days

**Widget 28: Cohort Retention**
- Type: Heatmap
- Cohorts: Rows
- Weeks: Columns
- Retention rate: Color

**Widget 29: AI Insights**
- Type: List
- Count: Top 5
- Metrics: Insight type, impact, confidence
- Actions: View details, act on insight

### 7.7 Governance Widgets

**Widget 30: Security Score**
- Type: Gauge
- Value: Security score (0-100)
- Factors: Incidents, failed logins, compliance
- Trend

**Widget 31: Audit Activity**
- Type: Line chart
- Metric: Audit events
- Period: 30 days
- Breakdown: By type, by user

**Widget 32: RBAC Overview**
- Type: KPI cards
- Metrics: Roles, permissions, users
- Distribution: By role
- Recent changes

---

## 8. PERMISSIONS RBAC

### 8.1 Rôles Définis

**Super Admin:**
- Accès total à tous les modules
- Gestion des utilisateurs et rôles
- Configuration plateforme
- Vues financières complètes

**Executive:**
- Executive Center (vue seule)
- Revenue, Growth, Countries
- Executive Reports
- Pas de modification

**Customer Success Manager:**
- Customer Success (lecture/écriture)
- Tenant Health, Adoption, Renewals, Churn
- Customer Journey
- Ses tenants uniquement

**Commercial Manager:**
- Commercial Operations (lecture/écriture)
- Plans, Subscriptions, Promotions
- Trials, Upsell Opportunities
- Tous les tenants

**Finance Manager:**
- Financial Operations (lecture/écriture)
- Revenue, Invoices, Payments
- Mobile Money, Taxes, Reports
- Vue financière complète

**Operations Manager:**
- Platform Operations (lecture/écriture)
- Tenants, Infrastructure, Sync
- Queue, API Health, Backups
- Vue opérationnelle complète

**Data Analyst:**
- Intelligence Center (lecture seule)
- Analytics, Predictions, AI Insights
- Country Intelligence, Revenue Intelligence
- Export de données

**Compliance Officer:**
- Governance (lecture/écriture)
- Audit Logs, Security Center
- Compliance
- Export de rapports

**Support Agent:**
- Vue limitée sur Tenants
- Support Center (si existe)
- Lecture seule sur la plupart des modules

### 8.2 Matrice de Permissions

| Module | Super Admin | Executive | CS Manager | Commercial | Finance | Ops Manager | Data Analyst | Compliance | Support |
|--------|-------------|-----------|------------|------------|---------|-------------|--------------|------------|---------|
| Executive Center | Full | Read | - | - | Read | - | Read | - | - |
| Customer Success | Full | Read | Full | - | - | - | Read | - | - |
| Commercial Ops | Full | - | - | Full | Read | - | Read | - | - |
| Financial Ops | Full | Read | - | Read | Full | - | Read | Read | - |
| Platform Ops | Full | - | - | - | - | Full | Read | - | Read |
| Intelligence | Full | Read | Read | Read | Read | Read | Full | Read | - |
| Governance | Full | - | - | - | Read | - | Read | Full | - |

**Légende:**
- Full: Accès complet (lecture/écriture/suppression)
- Read: Lecture seule
- -: Pas d'accès

---

## 9. APIS NÉCESSAIRES

### 9.1 Executive Center APIs

```
GET    /api/platform/executive/dashboard
GET    /api/platform/executive/revenue
GET    /api/platform/executive/revenue/trend
GET    /api/platform/executive/growth
GET    /api/platform/executive/growth/trend
GET    /api/platform/executive/countries
GET    /api/platform/executive/countries/:id
GET    /api/platform/executive/reports
POST   /api/platform/executive/reports/generate
GET    /api/platform/executive/reports/:id
```

### 9.2 Customer Success APIs

```
GET    /api/platform/cs/health-scores
GET    /api/platform/cs/health-scores/:tenantId
GET    /api/platform/cs/adoption
GET    /api/platform/cs/adoption/:tenantId
GET    /api/platform/cs/renewals
GET    /api/platform/cs/renewals/upcoming
POST   /api/platform/cs/renewals/:id/contact
GET    /api/platform/cs/churn-risk
GET    /api/platform/cs/churn-risk/:tenantId
POST   /api/platform/cs/churn-risk/:id/intervene
GET    /api/platform/cs/journey/:tenantId
POST   /api/platform/cs/journey/:id/milestone
```

### 9.3 Commercial Operations APIs

```
GET    /api/platform/commercial/plans
POST   /api/platform/commercial/plans
GET    /api/platform/commercial/plans/:id
PUT    /api/platform/commercial/plans/:id
DELETE /api/platform/commercial/plans/:id
GET    /api/platform/commercial/subscriptions
GET    /api/platform/commercial/subscriptions/:id
POST   /api/platform/commercial/subscriptions/:id/upgrade
POST   /api/platform/commercial/subscriptions/:id/downgrade
GET    /api/platform/commercial/promotions
POST   /api/platform/commercial/promotions
GET    /api/platform/commercial/promotions/:id
PUT    /api/platform/commercial/promotions/:id
DELETE /api/platform/commercial/promotions/:id
GET    /api/platform/commercial/trials
POST   /api/platform/commercial/trials/:id/extend
GET    /api/platform/commercial/upsell-opportunities
POST   /api/platform/commercial/upsell-opportunities/:id/propose
```

### 9.4 Financial Operations APIs

```
GET    /api/platform/finance/revenue
GET    /api/platform/finance/revenue/trend
GET    /api/platform/finance/revenue/breakdown
GET    /api/platform/finance/invoices
GET    /api/platform/finance/invoices/:id
POST   /api/platform/finance/invoices/:id/send
POST   /api/platform/finance/invoices/:id/mark-paid
GET    /api/platform/finance/payments
GET    /api/platform/finance/payments/:id
POST   /api/platform/finance/payments/:id/refund
GET    /api/platform/finance/mobile-money
GET    /api/platform/finance/mobile-money/transactions
GET    /api/platform/finance/mobile-money/providers
GET    /api/platform/finance/taxes
POST   /api/platform/finance/taxes/calculate
GET    /api/platform/finance/reports
POST   /api/platform/finance/reports/generate
GET    /api/platform/finance/reports/:id
```

### 9.5 Platform Operations APIs

```
GET    /api/platform/ops/tenants
GET    /api/platform/ops/tenants/:id
POST   /api/platform/ops/tenants
PUT    /api/platform/ops/tenants/:id
DELETE /api/platform/ops/tenants/:id
GET    /api/platform/ops/infrastructure/health
GET    /api/platform/ops/infrastructure/metrics
GET    /api/platform/ops/sync/jobs
GET    /api/platform/ops/sync/jobs/:id
POST   /api/platform/ops/sync/jobs/:id/retry
GET    /api/platform/ops/queue/stats
GET    /api/platform/ops/queue/jobs
POST   /api/platform/ops/queue/jobs/:id/retry
GET    /api/platform/ops/api-health
GET    /api/platform/ops/api-health/endpoints
GET    /api/platform/ops/backups
POST   /api/platform/ops/backups
POST   /api/platform/ops/backups/:id/restore
```

### 9.6 Intelligence Center APIs

```
GET    /api/platform/intelligence/analytics
GET    /api/platform/intelligence/analytics/revenue
GET    /api/platform/intelligence/analytics/tenants
GET    /api/platform/intelligence/analytics/features
GET    /api/platform/intelligence/analytics/cohorts
GET    /api/platform/intelligence/predictions
GET    /api/platform/intelligence/predictions/churn
GET    /api/platform/intelligence/predictions/revenue
GET    /api/platform/intelligence/ai-insights
GET    /api/platform/intelligence/ai-insights/:id
POST   /api/platform/intelligence/ai-insights/:id/act
GET    /api/platform/intelligence/countries
GET    /api/platform/intelligence/countries/:id
GET    /api/platform/intelligence/revenue
GET    /api/platform/intelligence/revenue/drivers
GET    /api/platform/intelligence/revenue/forecast
```

### 9.7 Governance APIs

```
GET    /api/platform/governance/audit/logs
GET    /api/platform/governance/audit/logs/:id
GET    /api/platform/governance/audit/logs/search
POST   /api/platform/governance/audit/logs/export
GET    /api/platform/governance/security/incidents
GET    /api/platform/governance/security/failed-logins
POST   /api/platform/governance/security/ip-whitelist
GET    /api/platform/governance/rbac/roles
POST   /api/platform/governance/rbac/roles
GET    /api/platform/governance/rbac/roles/:id
PUT    /api/platform/governance/rbac/roles/:id
DELETE /api/platform/governance/rbac/roles/:id
GET    /api/platform/governance/compliance
GET    /api/platform/governance/compliance/checks
POST   /api/platform/governance/compliance/checks/:id/run
GET    /api/platform/governance/settings
PUT    /api/platform/governance/settings
```

---

## 10. TABLES SQLITE/SUPABASE

### 10.1 Nouvelles Tables

**Customer Success:**
```sql
CREATE TABLE platform.tenant_health_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  score INTEGER NOT NULL, -- 0-100
  factors JSON, -- {login_frequency, feature_usage, support_tickets, payment_status}
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE platform.nps_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER,
  score INTEGER, -- 0-10
  feedback TEXT,
  sent_at TIMESTAMP,
  responded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE platform.onboarding_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  step INTEGER NOT NULL,
  step_name VARCHAR(255),
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE platform.churn_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  churn_probability FLOAT NOT NULL, -- 0-1
  risk_level VARCHAR(50), -- low, medium, high, critical
  factors JSON,
  predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

**Financial Operations:**
```sql
CREATE TABLE platform.invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  amount INTEGER NOT NULL, -- en centimes
  currency VARCHAR(10) DEFAULT 'FCFA',
  status VARCHAR(50), -- pending, paid, overdue, cancelled
  due_date TIMESTAMP,
  paid_at TIMESTAMP,
  pdf_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE platform.payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  invoice_id INTEGER,
  amount INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'FCFA',
  method VARCHAR(50), -- mobile_money, card, bank
  provider VARCHAR(50), -- orange, mpesa, moov, stripe
  status VARCHAR(50), -- pending, completed, failed, refunded
  transaction_id VARCHAR(255),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE TABLE platform.mobile_money_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL,
  provider VARCHAR(50) NOT NULL, -- orange, mpesa, moov
  phone_number VARCHAR(20),
  amount INTEGER NOT NULL,
  status VARCHAR(50),
  fee INTEGER,
  net_amount INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id)
);

CREATE TABLE platform.taxes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code VARCHAR(10) NOT NULL,
  tax_name VARCHAR(255) NOT NULL,
  tax_rate FLOAT NOT NULL,
  applicable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Intelligence Center:**
```sql
CREATE TABLE platform.predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  prediction_type VARCHAR(100) NOT NULL, -- churn, revenue, growth
  prediction_value FLOAT NOT NULL,
  confidence FLOAT, -- 0-1
  model_version VARCHAR(50),
  factors JSON,
  predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE platform.ai_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  insight_type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  impact VARCHAR(50), -- low, medium, high
  confidence FLOAT,
  data JSON,
  acted_upon BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE platform.cohorts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_name VARCHAR(255) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  tenant_count INTEGER,
  retention_data JSON, -- {week1: 85, week4: 45, week12: 20}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Platform Operations:**
```sql
CREATE TABLE platform.queue_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INTEGER,
  payload JSON,
  status VARCHAR(50), -- pending, processing, completed, failed
  priority INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE platform.api_health_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10),
  response_time INTEGER, -- en ms
  status_code INTEGER,
  success BOOLEAN,
  error_message TEXT,
  measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE platform.backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_type VARCHAR(50), -- full, incremental
  size INTEGER, -- en bytes
  status VARCHAR(50), -- pending, completed, failed
  storage_location VARCHAR(500),
  downloaded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 10.2 Tables à Étendre

**platform.tenants:**
```sql
ALTER TABLE platform.tenants ADD COLUMN health_score INTEGER DEFAULT 0;
ALTER TABLE platform.tenants ADD COLUMN churn_risk VARCHAR(50); -- low, medium, high, critical
ALTER TABLE platform.tenants ADD COLUMN upsell_potential BOOLEAN DEFAULT FALSE;
ALTER TABLE platform.tenants ADD COLUMN country_code VARCHAR(10);
ALTER TABLE platform.tenants ADD COLUMN currency VARCHAR(10) DEFAULT 'FCFA';
```

**platform.subscriptions:**
```sql
ALTER TABLE platform.subscriptions ADD COLUMN trial_end_date TIMESTAMP;
ALTER TABLE platform.subscriptions ADD COLUMN renewal_reminder_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE platform.subscriptions ADD COLUMN churn_risk VARCHAR(50);
```

---

## 11. ALERTES INTELLIGENTES

### 11.1 Executive Center Alerts

**Critical:**
- MRR drop > 10% (MoM)
- Churn rate > 5% (weekly)
- Payment success rate < 90%
- Platform downtime > 5min

**Warning:**
- MRR growth < 5% (MoM)
- Trial conversion rate < 20%
- 10+ tenants in grace period
- Revenue forecast miss > 15%

**Info:**
- New MRR milestone reached
- New tenant milestone (100, 500, 1000)
- Country milestone (10 tenants in new country)

### 11.2 Customer Success Alerts

**Critical:**
- Tenant health score < 40
- Tenant not logged in > 14 days
- Churn probability > 80%
- NPS dropped > 10 points

**Warning:**
- Tenant health score 40-69
- Feature adoption < 30%
- Renewal in 7 days, not contacted
- Support ticket unresolved > 48h

**Info:**
- Tenant reached 80% quota
- Tenant completed onboarding
- Feature adoption milestone

### 11.3 Commercial Operations Alerts

**Critical:**
- Trial expiring in 24h, not converted
- Subscription payment failed 3x
- Plan pricing outdated > 6 months

**Warning:**
- Trial expiring in 7 days
- Upsell opportunity identified
- Promotion redemption rate < 10%

**Info:**
- New trial started
- Upgrade completed
- Promotion created

### 11.4 Financial Operations Alerts

**Critical:**
- Payment failure rate > 5%
- Invoice overdue > 30 days
- Mobile Money API down
- Tax compliance issue

**Warning:**
- Payment failure rate > 2%
- Invoice overdue > 15 days
- Mobile Money latency > 2s
- Cash flow negative

**Info:**
- Revenue milestone reached
- Invoice paid on time
- Mobile Money volume spike

### 11.5 Platform Operations Alerts

**Critical:**
- Platform downtime > 5min
- Database connection pool exhausted
- Disk space > 90%
- Backup failed

**Warning:**
- API response time > 500ms (p95)
- Queue depth > 1000
- Sync job failed 3x
- Error rate > 1%

**Info:**
- Backup completed
- New tenant onboarded
- Sync job completed

### 11.6 Intelligence Center Alerts

**Critical:**
- Churn prediction model accuracy < 70%
- Revenue forecast error > 20%
- Data pipeline broken

**Warning:**
- Feature adoption dropped > 20%
- Cohort retention < 30% (week 12)
- Anomaly detected

**Info:**
- New AI insight generated
- Prediction model updated
- Report generated

### 11.7 Governance Alerts

**Critical:**
- Security incident detected
- Failed login attempts > 10 (same IP)
- Compliance score < 60%

**Warning:**
- Failed login attempts > 5
- Audit log export requested
- RBAC permission changed

**Info:**
- Audit log generated
- Compliance check passed
- Security scan completed

---

## CONCLUSION

Ce document définit l'architecture opérationnelle cible pour Ekala Platform.

**Points clés:**
- Transformation orientée métier (non technique)
- 7 centres opérationnels clairs
- Navigation intuitive et hiérarchique
- KPIs business pour chaque module
- Widgets dashboard actionnables
- RBAC granulaire et sécurisée
- APIs complètes et cohérentes
- Alertes intelligentes contextuelles

**Prochaine étape:** Validation → Maquettes UX → Implémentation React

**Comparables:** Shopify HQ, Stripe Dashboard, Lightspeed HQ, HubSpot Enterprise