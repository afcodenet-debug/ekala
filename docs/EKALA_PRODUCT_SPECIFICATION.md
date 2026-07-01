# EKALA PLATFORM - SPECIFICATION PRODUIT
## SaaS Multi-Tenant de Niveau International

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Product Specification  
**Target:** Restaurants, Bars, Hôtels, Fast-foods, Night clubs, Cafés, Resorts (Afrique)

**Comparables:** Shopify HQ, Stripe Dashboard, Lightspeed HQ, Toast Enterprise

---

## TABLE DES MATIÈRES

1. [Vision Globale](#1-vision-globale)
2. [Personas Utilisateurs](#2-personas-utilisateurs)
3. [Executive Dashboard](#3-executive-dashboard)
4. [Tenants Management](#4-tenants-management)
5. [Subscriptions & Billing](#5-subscriptions--billing)
6. [Vouchers & Promotions](#6-vouchers--promotions)
7. [Customer Success](#7-customer-success)
8. [Support Center](#8-support-center)
9. [Audit & Compliance](#9-audit--compliance)
10. [Integrations](#10-integrations)
11. [Sync & Infrastructure](#11-sync--infrastructure)
12. [Analytics](#12-analytics)
13. [Platform Settings](#13-platform-settings)
14. [Structure Sidebar](#14-structure-sidebar)
15. [Métriques SaaS Internationales](#15-métriques-saas-internationales)
16. [Métriques Spécifiques Afrique](#16-métriques-spécifiques-afrique)
17. [Roadmap](#17-roadmap)

---

## 1. VISION GLOBALE

### 1.1 Mission
Démocratiser l'accès à des outils de gestion professionnels pour les entreprises africaines du secteur HORECA (Hotellerie-Restauration) en proposant une plateforme SaaS unifiée, moderne et accessible.

### 1.2 Vision
Devenir la plateforme de référence pour la gestion des établissements HORECA en Afrique, comparable à Shopify pour l'e-commerce ou Toast pour la restauration occidentale.

### 1.3 Valeurs
- **Excellence opérationnelle:** Outils professionnels, fiables et performants
- **Accessibilité:** Prix adaptés au marché africain, support local
- **Innovation:** Technologies modernes (cloud, mobile, AI)
- **Écosystème:** Intégrations locales (Mobile Money, paiements, livraison)
- **Scalabilité:** Grandir avec nos clients

### 1.4 Marché Cible
- **Secteurs:** Restaurants, Bars, Hôtels, Fast-foods, Night clubs, Cafés, Resorts
- **Géographie:** Togo, Bénin, Sénégal, Côte d'Ivoire, Cameroun, Mali, Burkina Faso, Niger
- **Taille:** TPE (1-10 employés), PME (11-50 employés), ETI (51-250 employés)
- **CA cible:** 10M FCFA à 500M FCFA par an

---

## 2. PERSONAS UTILISATEURS

### 2.1 Super Admin (Platform Owner)
**Profil:** Fondateur/CEO de Ekala  
**Objectifs:** 
- Piloter la croissance de la plateforme
- Maximiser le MRR et réduire le churn
- Assurer la stabilité et la sécurité
- Prendre des décisions stratégiques

**Besoins:**
- Vue 360° de la plateforme
- Alertes en temps réel
- Accès à toutes les données
- Outils de décision (analytics, forecasts)

**Frustrations actuelles:**
- Pas de visibilité sur la santé globale
- Difficulté à identifier les tenants à risque
- Pas de metrics SaaS standardisés

### 2.2 Account Manager
**Profil:** Responsable de compte chez Ekala  
**Objectifs:**
- Accompagner les tenants dans leur succès
- Maximiser l'adoption et la rétention
- Identifier les opportunités d'upgrade
- Résoudre les problèmes rapidement

**Besoins:**
- Liste de ses tenants assignés
- Health score par tenant
- Historique des interactions
- Playbooks d'engagement

**Frustrations actuelles:**
- Pas de vue centralisée sur ses tenants
- Difficulté à prioriser les actions
- Pas de suivi des engagements

### 2.3 Finance Manager
**Profil:** Responsable financier  
**Objectifs:**
- Suivre le MRR, ARR, churn
- Gérer les factures et paiements
- Identifier les retards de paiement
- Prévoir les revenus

**Besoins:**
- Dashboard financier en temps réel
- Liste des paiements en retard
- Rapports de revenue
- Gestion des remboursements

**Frustrations actuelles:**
- Données dispersées
- Pas de vue consolidée
- Processus manuel pour les remboursements

### 2.4 Support Agent
**Profil:** Agent de support client  
**Objectifs:**
- Répondre aux tickets rapidement
- Résoudre les problèmes des tenants
- Maintenir un haut niveau de satisfaction
- Documenter les solutions

**Besoins:**
- Queue de tickets assignés
- Base de connaissances
- Templates de réponse
- SLA tracking

**Frustrations actuelles:**
- Tickets mal assignés
- Pas de vue d'ensemble
- Difficulté à trouver les infos

### 2.5 Tenant Admin
**Profil:** Propriétaire/gérant d'établissement  
**Objectifs:**
- Gérer son établissement efficacement
- Suivre ses ventes et clients
- Optimiser ses opérations
- Résoudre ses problèmes rapidement

**Besoins:**
- Interface intuitive
- Support réactif
- Fonctionnalités adaptées à son secteur
- Prix transparents

**Frustrations actuelles:**
- Complexité de certains outils
- Support lent
- Manque de fonctionnalités spécifiques

---

## 3. EXECUTIVE DASHBOARD

### 3.1 Vision Métier
Le cockpit stratégique de la plateforme Ekala. Il offre une vue consolidée en temps réel de la santé business, permettant des décisions éclairées basées sur des données fiables.

### 3.2 Objectifs Business
- **Pilotage stratégique:** Vue 360° de la plateforme en un coup d'œil
- **Détection proactive:** Identifier les risques et opportunités avant qu'ils ne deviennent critiques
- **Alignement équipe:** Partager une vision commune des KPIs
- **Reporting automatisé:** Gagner du temps sur les reportings

### 3.3 Fonctionnalités MVP
- KPIs principaux (MRR, ARR, Total Tenants, Active Tenants)
- Graphique d'évolution MRR (30 jours)
- Liste des 10 derniers tenants
- Alertes critiques (downtime, payment failures)
- Actions rapides (nouveau tenant, créer voucher, gérer plans)

### 3.4 Fonctionnalités Growth
- Cohort analysis
- Revenue forecast (AI-powered)
- Geographic heatmap (Afrique)
- Tenant acquisition funnel
- NPS trend
- Churn prediction

### 3.5 Fonctionnalités Enterprise
- Custom dashboards (drag & drop)
- Advanced analytics (ML insights)
- Real-time collaboration (comments, annotations)
- Automated reports (email, Slack)
- Benchmarking (comparaison sectorielle)

### 3.6 KPIs à Afficher

**KPIs Principaux (Cards):**
1. **Total Tenants** - Nombre total de tenants inscrits
2. **Active Tenants** - Tenants avec statut "active"
3. **MRR** - Monthly Recurring Revenue (FCFA)
4. **ARR** - Annual Recurring Revenue (FCFA)
5. **Active Subscriptions** - Nombre d'abonnements actifs
6. **Trial Tenants** - Tenants en période d'essai

**KPIs Secondaires (Charts):**
- MRR Evolution (line chart, 30 jours)
- Tenant Acquisition (bar chart, 7 jours)
- Revenue by Plan (pie chart)
- Churn Rate (gauge, 0-100%)

### 3.7 Cartes Dashboard

**Carte 1: MRR Gauge**
- Indicateur circulaire MRR/ARR
- Target: 50M FCFA MRR
- Progress: 78%
- Color: Gold (#D4AF37)

**Carte 2: Revenue Chart**
- Graphique area chart
- Période: 30 jours
- Comparaison N-1
- Color: Blue (#3b82f6)

**Carte 3: Tenant Funnel**
- Funnel: Signup → Trial → Paid → Active
- Conversion rates par étape
- Drop-off analysis

**Carte 4: Health Score**
- Score global plateforme (0-100)
- Basé sur: uptime, payment success, churn, support tickets
- Color-coded: Red (<50), Yellow (50-80), Green (>80)

**Carte 5: Churn Alert**
- Liste des 5 tenants à risque
- Health score, days until expiry, last login
- Action: "Contacter"

**Carte 6: Payment Success**
- Taux de succès des paiements (24h)
- Par méthode: Mobile Money, Carte, Virement
- Alertes si < 95%

**Carte 7: Support Load**
- Tickets ouverts vs résolus (7 jours)
- Temps de résolution moyen
- Charge par agent

**Carte 8: Geographic Map**
- Carte Afrique avec heatmap
- Tenants par pays
- Revenue par pays

**Carte 9: Top Performers**
- Top 10 tenants par revenue
- Top 10 par croissance
- Top 10 par engagement

**Carte 10: Real-time Activity**
- Live feed des transactions
- Nouveaux signups
- Paiements complétés

### 3.8 Widgets

**Widget 1: Quick Stats**
- 4 mini KPIs en ligne
- Total Tenants, MRR, Active Now, Alerts

**Widget 2: Revenue Breakdown**
- Revenue par plan (STARTER, BUSINESS, ENTERPRISE, ULTIMATE)
- Revenue par pays (TG, BJ, SN, CI, CM)
- Revenue par devise (FCFA, EUR, USD)

**Widget 3: Subscription Metrics**
- New subscriptions (7j, 30j)
- Cancellations (7j, 30j)
- Upgrades vs Downgrades
- Trial conversion rate

**Widget 4: Tenant Health**
- Distribution: Healthy (70-100), At Risk (40-69), Critical (0-39)
- Actions recommandées par segment

**Widget 5: Payment Analytics**
- Success rate par méthode
- Average transaction value
- Payment failures analysis
- Refund rate

**Widget 6: Support Metrics**
- Ticket volume (24h, 7j, 30j)
- First response time
- Resolution time
- CSAT score

**Widget 7: System Health**
- Uptime (99.9% target)
- API response time (p95: <200ms)
- Database query time (p95: <50ms)
- Error rate (<0.1%)

**Widget 8: Growth Metrics**
- DAU/MAU ratio
- Feature adoption rate
- Session duration
- Tenant growth rate

### 3.9 Alertes Intelligentes

**Alertes Critiques (Red):**
- Platform downtime > 5min
- Payment success rate < 90%
- Churn rate > 5% (weekly)
- Database connection pool exhausted
- Disk space > 85%

**Alertes Warnings (Yellow):**
- 10+ tenants en période de grâce
- Payment failure rate > 2%
- Support tickets backlog > 50
- API latency > 500ms (p95)
- 3+ failed login attempts (same IP)

**Alertes Info (Blue):**
- Nouveau record d'inscriptions
- MRR milestone atteint
- Nouveau tenant Enterprise
- Feature adoption spike

**Smart Alerts (AI-powered):**
- "Tenant X likely to churn in 7 days" (based on usage pattern)
- "Revenue forecast: +15% next month" (based on pipeline)
- "Optimal time to contact Tenant Y" (based on engagement)

### 3.10 Permissions RBAC
- **Super Admin:** Accès total
- **Account Manager:** Vue de ses tenants uniquement
- **Finance:** Vue financière uniquement
- **Support:** Vue tickets uniquement

### 3.11 APIs Nécessaires
```
GET    /api/platform/dashboard/kpis
GET    /api/platform/dashboard/revenue-trend
GET    /api/platform/dashboard/tenant-acquisition
GET    /api/platform/dashboard/geographic-distribution
GET    /api/platform/dashboard/cohort-analysis
GET    /api/platform/dashboard/health-score
GET    /api/platform/dashboard/alerts
POST   /api/platform/dashboard/forecast
GET    /api/platform/dashboard/top-performers
GET    /api/platform/dashboard/real-time-activity
```

### 3.12 Tables SQLite/Supabase

**platform.tenants**
- id, name, slug, owner_email, country, city, status, is_provisioned, created_at, updated_at

**platform.subscriptions**
- id, tenant_id, plan_id, status, started_at, current_period_start, current_period_end, auto_renew, created_at, updated_at

**platform.plans**
- id, code, name, price_monthly, price_annual, features, quotas, created_at, updated_at

**platform.payments**
- id, tenant_id, subscription_id, amount, currency, method, status, paid_at, created_at

**platform.voucher_requests**
- id, tenant_id, plan_id, code, discount_type, discount_value, status, verified_by, verified_at, created_at

**platform.platform_audit_logs**
- id, admin_id, admin_email, admin_role, action, entity_type, entity_id, metadata, ip_address, user_agent, success, created_at

### 3.13 Événements d'Audit
- `dashboard.view` - Consultation du dashboard
- `stats.refresh` - Rafraîchissement des stats
- `alert.acknowledged` - Alerte acquittée
- `report.exported` - Export de rapport

### 3.14 Éléments UI Nécessaires
- Header: "Executive Dashboard" + breadcrumb
- KPI Cards Grid (6 cards, responsive)
- Charts Section (2x2 grid)
- Recent Tenants Table (5 rows)
- Alerts Panel (3 alerts max)
- Quick Actions (4 buttons)
- Platform Health Card
- Quick Links Card
- Loading skeletons
- Error states
- Empty states

---

## 4. TENANTS MANAGEMENT

### 4.1 Vision Métier
Gestion complète du cycle de vie des tenants (onboarding → expansion → churn) avec une approche data-driven pour maximiser la rétention et la croissance.

### 4.2 Objectifs Business
- **Onboarding fluide:** Réduire le time-to-first-value à < 24h
- **Rétention proactive:** Détecter les risques de churn avant qu'ils ne se concrétisent
- **Expansion:** Identifier les opportunités d'upgrade
- **Scalabilité:** Gérer 10,000+ tenants sans friction

### 4.3 Personas
- **Super Admin:** Vue globale, actions en masse
- **Account Manager:** Ses tenants, suivi personnalisé
- **Support:** Lecture seule + tickets
- **Finance:** Données financières uniquement

### 4.4 Fonctionnalités MVP
- Liste tenants (tableau avec filtres)
- Fiche tenant détaillée
- Gestion branches/succursales
- Gestion utilisateurs (RBAC)
- Quotas et limites par plan
- Status management (active, suspended, trial)

### 4.5 Fonctionnalités Growth
- Health score par tenant
- Usage analytics (features, API calls)
- Performance metrics (page load, API latency)
- Feature flags par tenant
- Impersonation (debug)
- Bulk actions (suspend, upgrade, send email)

### 4.6 Fonctionnalités Enterprise
- Custom fields
- Advanced segmentation
- Automated workflows
- Tenant journey mapping
- Predictive analytics (churn risk)
- White-label options

### 4.7 KPIs
- Total Tenants
- Active Tenants (%)
- Trial Conversion Rate (%)
- Time to First Value (TTFV) - jours
- Tenant Health Score
- Feature Adoption Rate (%)
- API Calls per Tenant
- Storage Used per Tenant
- Branches per Tenant (avg)
- Users per Tenant (avg)

### 4.8 Cartes Dashboard
- Tenant Card: Nom, plan, status, health score, MRR
- Usage Chart: API calls, storage, users over time
- Branches Map: Visualisation géographique
- Activity Timeline: Dernières actions
- Health Indicator: Score couleur
- Quick Actions: Upgrade, suspend, delete, impersonate
- Billing Info: MRR, next invoice date
- Support Tickets: Tickets ouverts

### 4.9 Widgets
- Tenant Search (avec filtres avancés)
- Status Distribution (pie chart)
- Plan Distribution (bar chart)
- Country Distribution (map)
- Growth Chart (new tenants per month)
- Churn Chart (churned tenants per month)

### 4.10 Alertes Intelligentes
- "Tenant X n'a pas connecté depuis 7 jours"
- "Tenant Y a atteint 90% de son quota utilisateurs"
- "Tenant Z en période de grâce dans 3 jours"
- "3 nouveaux tenants signés aujourd'hui"
- "Tenant A a downgradé de BUSINESS à STARTER"

### 4.11 Permissions RBAC
- **Super Admin:** CRUD complet
- **Account Manager:** Lecture/édition de ses tenants
- **Support:** Lecture seule + tickets
- **Finance:** Lecture données financières

### 4.12 APIs Nécessaires
```
GET    /api/platform/tenants
GET    /api/platform/tenants/:id
POST   /api/platform/tenants
PUT    /api/platform/tenants/:id
DELETE /api/platform/tenants/:id
GET    /api/platform/tenants/:id/health
GET    /api/platform/tenants/:id/usage
GET    /api/platform/tenants/:id/branches
POST   /api/platform/tenants/:id/branches
GET    /api/platform/tenants/:id/users
POST   /api/platform/tenants/:id/users
GET    /api/platform/tenants/:id/activity
POST   /api/platform/tenants/:id/impersonate
GET    /api/platform/tenants/search
POST   /api/platform/tenants/:id/upgrade
POST   /api/platform/tenants/:id/downgrade
```

### 4.13 Tables SQLite/Supabase
```
platform.tenants
platform.branches
platform.tenant_users
platform.tenant_roles
platform.tenant_settings
platform.tenant_quotas
platform.tenant_activity_logs
```

### 4.14 Événements d'Audit
- `tenant.created` - Nouveau tenant créé
- `tenant.updated` - Informations modifiées
- `tenant.suspended` - Tenant suspendu
- `tenant.activated` - Tenant réactivé
- `tenant.deleted` - Tenant supprimé
- `tenant.upgraded` - Plan modifié (upgrade)
- `tenant.downgraded` - Plan modifié (downgrade)
- `branch.created` - Nouvelle succursale
- `user.added` - Utilisateur ajouté
- `user.removed` - Utilisateur supprimé

### 4.15 Éléments UI Nécessaires
- Sidebar: "Tenants" (avec badge count)
- Page: `/platform/tenants` (liste)
- Page: `/platform/tenants/:id` (détails)
- Page: `/platform/tenants/:id/edit` (édition)
- Page: `/platform/tenants/:id/branches` (branches)
- Page: `/platform/tenants/:id/users` (utilisateurs)
- Page: `/platform/tenants/:id/activity` (activity log)
- Page: `/platform/tenants/onboarding` (wizard)
- Components: TenantCard, TenantTable, TenantFilters, TenantDetails, BranchManager, UserManager

---

## 5. SUBSCRIPTIONS & BILLING

### 5.1 Vision Métier
Gestion intelligente des abonnements et facturation pour maximiser le revenu récurrent et minimiser le churn.

### 5.2 Objectifs Business
- **Revenue optimization:** Maximiser le MRR et l'ARR
- **Churn reduction:** Identifier et prévenir les annulations
- **Payment success:** Optimiser le taux de succès des paiements
- **Transparency:** Factures claires et détaillées

### 5.3 Personas
- **Super Admin:** Vue globale, gestion plans
- **Finance:** Factures, paiements, remboursements
- **Account Manager:** Vue de ses tenants
- **Tenant Admin:** Son abonnement, upgrade/downgrade

### 5.4 Fonctionnalités MVP
- Plans management (CRUD)
- Subscription lifecycle (trial → paid → cancelled)
- Upgrade/Downgrade
- Proration automatique
- Invoices (PDF)
- Payment retries
- Dunning management

### 5.5 Fonctionnalités Growth
- Revenue recognition (par plan, pays, canal)
- Churn prediction (ML)
- Win-back campaigns
- Automated dunning (emails, SMS)
- Payment method optimization
- Subscription analytics

### 5.6 Fonctionnalités Enterprise
- Custom pricing (negotiated contracts)
- Volume discounts
- Multi-year contracts
- Advanced invoicing (custom templates)
- Revenue recognition (GAAP compliant)
- Financial reporting (P&L, balance sheet)

### 5.7 KPIs
- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- ARPU (Average Revenue Per User)
- Churn Rate (%)
- NRR (Net Revenue Retention)
- Trial Conversion Rate (%)
- Payment Success Rate (%)
- Average Days to Pay
- Outstanding AR (Accounts Receivable)
- Revenue by Plan (%)
- Revenue by Country (%)

### 5.8 Cartes Dashboard
- MRR Chart: Évolution mensuelle
- Revenue by Plan: Pie chart
- Churn Analysis: Taux par cohorte
- Payment Success: Taux de succès
- Outstanding AR: Montant impayé
- Trial Conversion: Taux conversion
- Top Plans: Plans les plus vendus
- Revenue Forecast: Prévisionnel AI

### 5.9 Widgets
- MRR Gauge (avec target)
- ARR Trend (line chart)
- Churn by Cohort (heatmap)
- Payment Methods (donut chart)
- Invoices Table (dernières factures)
- Upcoming Renewals (liste)
- Failed Payments (liste avec actions)

### 5.10 Alertes Intelligentes
- "Payment failed for Tenant X (3 retries)"
- "Tenant Y subscription expires in 3 days"
- "Trial conversion rate dropped 10% this week"
- "Outstanding AR: 2.5M FCFA (>30 days)"
- "Churn risk: 5 tenants likely to cancel this month"

### 5.11 Permissions RBAC
- **Super Admin:** CRUD complet
- **Finance:** Lecture + remboursements
- **Account Manager:** Lecture ses tenants
- **Tenant Admin:** Lecture son abonnement + upgrade

### 5.12 APIs Nécessaires
```
GET    /api/platform/subscriptions
GET    /api/platform/subscriptions/:id
PUT    /api/platform/subscriptions/:id
POST   /api/platform/subscriptions/:id/cancel
POST   /api/platform/subscriptions/:id/pause
POST   /api/platform/subscriptions/:id/resume
POST   /api/platform/subscriptions/:id/upgrade
POST   /api/platform/subscriptions/:id/downgrade
GET    /api/platform/subscriptions/:id/invoices
GET    /api/platform/subscriptions/:id/payments
POST   /api/platform/subscriptions/:id/refund
GET    /api/platform/billing/revenue
GET    /api/platform/billing/mrr
GET    /api/platform/billing/arr
GET    /api/platform/billing/churn
GET    /api/platform/plans
POST   /api/platform/plans
PUT    /api/platform/plans/:id
GET    /api/platform/coupons
POST   /api/platform/coupons
```

### 5.13 Tables SQLite/Supabase
```
platform.plans
platform.subscriptions
platform.invoices
platform.invoice_items
platform.payments
platform.payment_retries
platform.coupons
platform.coupon_usage
platform.dunning_campaigns
```

### 5.14 Événements d'Audit
- `subscription.created` - Nouvel abonnement
- `subscription.updated` - Abonnement modifié
- `subscription.cancelled` - Abonnement annulé
- `subscription.renewed` - Abonnement renouvelé
- `subscription.upgraded` - Upgrade effectué
- `subscription.downgraded` - Downgrade effectué
- `payment.completed` - Paiement réussi
- `payment.failed` - Paiement échoué
- `invoice.generated` - Facture générée
- `refund.processed` - Remboursement effectué

### 5.15 Éléments UI Nécessaires
- Sidebar: "Subscriptions" + "Billing"
- Page: `/platform/subscriptions` (liste)
- Page: `/platform/subscriptions/:id` (détails)
- Page: `/platform/billing` (revenue dashboard)
- Page: `/platform/billing/invoices` (gestion factures)
- Page: `/platform/billing/refunds` (remboursements)
- Page: `/platform/plans` (gestion plans)
- Page: `/platform/coupons` (gestion coupons)
- Components: SubscriptionTable, InvoiceTable, PaymentTable, PlanForm, CouponForm

---

## 6. VOUCHERS & PROMOTIONS

### 6.1 Vision Métier
Système de promotions et vouchers pour acquérir de nouveaux tenants et fidéliser les existants.

### 6.2 Objectifs Business
- **Acquisition:** Réduire le CAC via des promotions ciblées
- **Rétention:** Fidéliser les tenants à risque
- **Expansion:** Encourager les upgrades
- **ROI measurement:** Mesurer l'impact des campagnes

### 6.3 Personas
- **Marketing:** Création et gestion des campagnes
- **Finance:** Budget, ROI, coûts
- **Super Admin:** Validation des gros vouchers
- **Tenant Admin:** Utilisation des vouchers

### 6.4 Fonctionnalités MVP
- Création vouchers (batch ou unique)
- Codes promo personnalisés
- Limites d'usage (par tenant, global)
- Date d'expiration
- Validation en temps réel
- Historique redemption

### 6.5 Fonctionnalités Growth
- Campagnes promotionnelles
- A/B testing
- Attribution tracking
- ROI measurement
- Fraud detection
- Auto-application

### 6.6 Fonctionnalités Enterprise
- Advanced targeting (par segment, pays, plan)
- Dynamic pricing (AI-optimized)
- Partner programs
- Reseller management
- Advanced analytics (LTV impact)

### 6.7 KPIs
- Total Vouchers Created
- Redemption Rate (%)
- Revenue Impact (FCFA)
- Cost per Acquisition (CPA)
- ROI by Campaign
- Fraud Rate (%)
- Average Discount Value
- Voucher LTV Impact

### 6.8 Cartes Dashboard
- Voucher Performance: Taux de redemption
- Revenue Impact: Impact financier
- Top Campaigns: Meilleures campagnes
- Fraud Alerts: Alertes fraude
- Redemption Timeline: Timeline des redemptions
- Cost Analysis: Coût par acquisition

### 6.9 Widgets
- Voucher Stats (created, redeemed, expired)
- Campaign Performance (table)
- Redemption Chart (line chart)
- Fraud Detection (alerts)
- ROI Calculator (widget interactif)

### 6.10 Alertes Intelligentes
- "Voucher code X used 100 times (possible fraud)"
- "Campaign Y redemption rate < 10%"
- "Voucher Z expires in 24h"
- "Fraud detected: 5 redemptions from same IP"

### 6.11 Permissions RBAC
- **Super Admin:** CRUD complet
- **Marketing:** Création/édition campagnes
- **Finance:** Vue financière
- **Tenant Admin:** Utilisation vouchers

### 6.12 APIs Nécessaires
```
GET    /api/platform/vouchers
POST   /api/platform/vouchers
GET    /api/platform/vouchers/:id
PUT    /api/platform/vouchers/:id
DELETE /api/platform/vouchers/:id
POST   /api/platform/vouchers/:id/redeem
GET    /api/platform/vouchers/:id/redemptions
GET    /api/platform/vouchers/validate/:code
GET    /api/platform/campaigns
POST   /api/platform/campaigns
GET    /api/platform/campaigns/:id/analytics
```

### 6.13 Tables SQLite/Supabase
```
platform.vouchers
platform.voucher_redemptions
platform.campaigns
platform.campaign_analytics
platform.fraud_detection_logs
```

### 6.14 Événements d'Audit
- `voucher.created` - Voucher créé
- `voucher.redeemed` - Voucher utilisé
- `voucher.expired` - Voucher expiré
- `campaign.created` - Campagne créée
- `campaign.launched` - Campagne lancée
- `campaign.paused` - Campagne mise en pause
- `fraud.detected` - Fraude détectée

### 6.15 Éléments UI Nécessaires
- Sidebar: "Vouchers"
- Page: `/platform/vouchers` (liste)
- Page: `/platform/vouchers/:id` (détails)
- Page: `/platform/vouchers/create` (création)
- Page: `/platform/vouchers/redemptions` (historique)
- Page: `/platform/campaigns` (campagnes)
- Page: `/platform/campaigns/:id` (détails)
- Page: `/platform/campaigns/:id/analytics` (analytics)
- Components: VoucherTable, CampaignCard, RedemptionChart, FraudAlert

---

## 7. CUSTOMER SUCCESS

### 7.1 Vision Métier
Maximiser la rétention et l'expansion des tenants via un accompagnement proactif et personnalisé.

### 7.2 Objectifs Business
- **Rétention:** Réduire le churn de 20% en 6 mois
- **Expansion:** Augmenter le NRR de 15%
- **Engagement:** Améliorer le NPS de 20 points
- **Time to Value:** Réduire le TTFV à < 24h

### 7.3 Personas
- **Customer Success Manager (CSM):** Accompagnement personnalisé
- **Tenant Admin:** Bénéficiaire de l'accompagnement
- **Super Admin:** Vue globale, stratégie

### 7.4 Fonctionnalités MVP
- Health score par tenant
- NPS surveys automatisées
- Onboarding completion tracking
- Automated check-ins (email)
- Tenant segmentation

### 7.5 Fonctionnalités Growth
- Churn prediction (ML)
- Win-back workflows
- Expansion opportunities detection
- Usage-based triggers
- Playbooks automation
- Training completion tracking

### 7.6 Fonctionnalités Enterprise
- Dedicated CSM assignment
- Custom onboarding journeys
- Advanced segmentation (AI-powered)
- Predictive analytics (LTV, churn)
- Customer journey mapping
- Voice of customer (VoC) program

### 7.7 KPIs
- NPS (Net Promoter Score)
- CSAT (Customer Satisfaction)
- Health Score (0-100)
- Onboarding Completion Rate (%)
- Feature Adoption Rate (%)
- Time to First Value (days)
- Expansion Revenue (%)
- Churn Rate (%)

### 7.8 Cartes Dashboard
- Health Score Distribution: Répartition scores santé
- NPS Trend: Évolution NPS
- At-Risk Tenants: Liste tenants à risque
- Onboarding Funnel: Funnel onboarding
- Feature Adoption: Adoption features
- Expansion Opportunities: Opportunités upgrade

### 7.9 Widgets
- NPS Gauge (score + trend)
- Health Score Distribution (histogram)
- At-Risk Tenants List (avec actions)
- Onboarding Completion (progress bar)
- Feature Adoption Heatmap
- Expansion Pipeline (funnel)

### 7.10 Alertes Intelligentes
- "Tenant X health score dropped below 40"
- "Tenant Y hasn't logged in for 14 days"
- "Tenant Z reached 80% of quota (upgrade opportunity)"
- "NPS dropped 10 points this month"
- "Onboarding completion rate < 60%"

### 7.11 Permissions RBAC
- **Customer Success Manager:** Ses tenants uniquement
- **Super Admin:** Vue globale
- **Tenant Admin:** Ses propres données

### 7.12 APIs Nécessaires
```
GET    /api/platform/customer-success/health-score
GET    /api/platform/customer-success/tenants-at-risk
GET    /api/platform/customer-success/nps
POST   /api/platform/customer-success/surveys
GET    /api/platform/customer-success/engagement
GET    /api/platform/customer-success/expansion-opportunities
POST   /api/platform/customer-success/playbooks
```

### 7.13 Tables SQLite/Supabase
```
platform.tenant_health_scores
platform.nps_surveys
platform.nps_responses
platform.onboarding_tracking
platform.feature_adoption
platform.customer_success_playbooks
platform.expansion_opportunities
```

### 7.14 Événements d'Audit
- `health_score.calculated` - Score calculé
- `nps.survey_sent` - Survey envoyée
- `nps.response_received` - Réponse reçue
- `onboarding.step_completed` - Étape onboarding complétée
- `playbook.executed` - Playbook exécuté
- `expansion.identified` - Opportunité identifiée

### 7.15 Éléments UI Nécessaires
- Sidebar: "Customer Success"
- Page: `/platform/customer-success` (dashboard)
- Page: `/platform/customer-success/tenants-at-risk` (liste)
- Page: `/platform/customer-success/nps` (NPS dashboard)
- Page: `/platform/customer-success/engagement` (engagement metrics)
- Page: `/platform/customer-success/playbooks` (playbooks)
- Components: HealthScoreGauge, NPSChart, AtRiskTable, OnboardingTracker

---

## 8. SUPPORT CENTER

### 8.1 Vision Métier
Gestion centralisée du support client multi-canal pour garantir une expérience exceptionnelle.

### 8.2 Objectifs Business
- **SLA respect:** 95% des tickets résolus en < 4h
- **Customer Satisfaction:** CSAT > 4.5/5
- **Efficiency:** Réduire le temps de résolution de 30%
- **Self-service:** 40% des tickets résolus via KB

### 8.3 Personas
- **Support Agent:** Traite les tickets
- **Support Manager:** Supervise, assigne, reporting
- **Tenant Admin:** Crée des tickets, consulte la KB
- **Super Admin:** Vue globale, configuration

### 8.4 Fonctionnalités MVP
- Ticket management (création, assignation, résolution)
- SLA tracking
- Internal notes
- Resolution tracking
- Basic knowledge base

### 8.5 Fonctionnalités Growth
- Multi-canal (email, chat, phone)
- Automated assignment (round-robin, skill-based)
- Escalation workflows
- Canned responses
- File sharing
- Advanced KB (search, categories)

### 8.6 Fonctionnalités Enterprise
- AI chatbot (Tier 1 support)
- Human handoff
- Video calls
- Screen sharing
- Community forum
- Feature requests tracking

### 8.7 KPIs
- Total Tickets
- Open Tickets
- Average Resolution Time (hrs)
- First Response Time (min)
- SLA Compliance (%)
- Customer Satisfaction (CSAT)
- Ticket Volume by Channel
- Ticket Volume by Issue Type
- Agent Performance
- Self-Service Rate (%)

### 8.8 Cartes Dashboard
- Ticket Volume: Volume tickets (24h, 7j, 30j)
- SLA Compliance: Respect SLA (%)
- Resolution Time: Temps résolution moyen
- Open Tickets by Priority: Répartition par priorité
- Agent Performance: Performance agents
- Channel Distribution: Répartition par canal

### 8.9 Widgets
- Ticket Queue (avec filtres)
- SLA Timer (countdown par ticket)
- Agent Workload (bar chart)
- Top Issues (bar chart)
- CSAT Trend (line chart)
- Knowledge Base Search

### 8.10 Alertes Intelligentes
- "Ticket #1234 SLA expires in 30min"
- "Agent X workload > 20 tickets"
- "CSAT dropped below 4.0 this week"
- "Top issue: 'Payment failed' (15 tickets)"
- "SLA compliance < 90% today"

### 8.11 Permissions RBAC
- **Super Admin:** Accès total
- **Support Agent:** Ses tickets assignés
- **Support Manager:** Tous tickets + rapports
- **Tenant Admin:** Tickets de son tenant uniquement

### 8.12 APIs Nécessaires
```
GET    /api/platform/support/tickets
POST   /api/platform/support/tickets
GET    /api/platform/support/tickets/:id
PUT    /api/platform/support/tickets/:id
POST   /api/platform/support/tickets/:id/assign
POST   /api/platform/support/tickets/:id/close
GET    /api/platform/support/tickets/:id/messages
POST   /api/platform/support/tickets/:id/messages
GET    /api/platform/support/knowledge-base
POST   /api/platform/support/knowledge-base
GET    /api/platform/support/analytics
```

### 8.13 Tables SQLite/Supabase
```
platform.support_tickets
platform.ticket_messages
platform.ticket_tags
platform.knowledge_base_articles
platform.knowledge_base_categories
platform.support_agents
platform.sla_policies
```

### 8.14 Événements d'Audit
- `ticket.created` - Ticket créé
- `ticket.assigned` - Ticket assigné
- `ticket.updated` - Ticket modifié
- `ticket.closed` - Ticket fermé
- `ticket.reopened` - Ticket rouvert
- `message.sent` - Message envoyé
- `kb.article_created` - Article KB créé
- `kb.article_updated` - Article KB modifié

### 8.15 Éléments UI Nécessaires
- Sidebar: "Support"
- Page: `/platform/support` (dashboard)
- Page: `/platform/support/tickets` (liste)
- Page: `/platform/support/tickets/:id` (détails)
- Page: `/platform/support/knowledge-base` (KB)
- Page: `/platform/support/analytics` (analytics)
- Page: `/platform/support/agents` (gestion agents)
- Components: TicketTable, TicketDetail, MessageThread, KBArticle, SLAIndicator

---

## 9. AUDIT & COMPLIANCE

### 9.1 Vision Métier
Traçabilité complète, conformité réglementaire, sécurité renforcée.

### 9.2 Objectifs Business
- **Compliance:** Respecter les réglementations (GDPR, PCI DSS)
- **Security:** Détecter et prévenir les incidents
- **Traceability:** Piste d'audit complète
- **Accountability:** Responsabiliser les actions

### 9.3 Personas
- **Compliance Officer:** Rapports, audits
- **Security Team:** Monitoring, alertes
- **Super Admin:** Accès total
- **Tenant Admin:** Logs de son tenant uniquement

### 9.4 Fonctionnalités MVP
- Audit logs (CRUD actions)
- User activity tracking
- API call logging
- Search logs
- Export logs (CSV, PDF)

### 9.5 Fonctionnalités Growth
- Data retention policies
- Right to be forgotten (GDPR)
- Data export (tenant)
- Audit reports (automated)
- Compliance dashboard

### 9.6 Fonctionnalités Enterprise
- Advanced security (SIEM integration)
- Incident response workflows
- Penetration testing reports
- SOC 2 compliance
- ISO 27001 certification

### 9.7 KPIs
- Total Audit Events
- Security Incidents
- Failed Login Attempts
- Compliance Score (%)
- Data Export Requests
- Average Time to Detect (incidents)
- Average Time to Resolve (incidents)

### 9.8 Cartes Dashboard
- Audit Timeline: Timeline événements
- Security Incidents: Incidents sécurité
- Failed Logins: Tentatives échouées
- Compliance Score: Score conformité
- Top Actions: Actions les plus fréquentes
- User Activity: Activité utilisateurs

### 9.9 Widgets
- Audit Log Table (avec filtres)
- Security Incidents List
- Failed Login Attempts (chart)
- Compliance Checklist
- Data Access Logs
- User Activity Heatmap

### 9.10 Alertes Intelligentes
- "5 failed login attempts from IP X"
- "Suspicious activity: Tenant Y accessed 1000 records in 1min"
- "Compliance score dropped below 80%"
- "Data export request from Tenant Z"
- "Incident detected: SQL injection attempt"

### 9.11 Permissions RBAC
- **Super Admin:** Accès total
- **Compliance Officer:** Lecture + rapports
- **Security:** Lecture + alertes
- **Tenant Admin:** Logs de son tenant uniquement

### 9.12 APIs Nécessaires
```
GET    /api/platform/audit/logs
GET    /api/platform/audit/logs/:id
GET    /api/platform/audit/logs/search
GET    /api/platform/audit/tenant/:tenantId
GET    /api/platform/audit/user/:userId
GET    /api/platform/compliance/reports
POST   /api/platform/compliance/export
GET    /api/platform/security/incidents
GET    /api/platform/security/failed-logins
```

### 9.13 Tables SQLite/Supabase
```
platform.audit_logs
platform.security_incidents
platform.failed_logins
platform.data_exports
platform.compliance_checks
platform.incident_response_plans
```

### 9.14 Événements d'Audit
- `user.login` - Connexion utilisateur
- `user.logout` - Déconnexion
- `user.created` - Utilisateur créé
- `user.updated` - Utilisateur modifié
- `user.deleted` - Utilisateur supprimé
- `tenant.created` - Tenant créé
- `tenant.updated` - Tenant modifié
- `tenant.suspended` - Tenant suspendu
- `subscription.created` - Abonnement créé
- `payment.processed` - Paiement traité
- `voucher.redeemed` - Voucher utilisé
- `data.exported` - Données exportées

### 9.15 Éléments UI Nécessaires
- Sidebar: "Audit & Compliance"
- Page: `/platform/audit-logs` (logs)
- Page: `/platform/audit-logs/search` (recherche)
- Page: `/platform/compliance` (dashboard)
- Page: `/platform/compliance/reports` (rapports)
- Page: `/platform/security` (dashboard)
- Page: `/platform/security/incidents` (incidents)
- Components: AuditLogTable, ComplianceScorecard, IncidentTimeline, SearchFilters

---

## 10. INTEGRATIONS

### 10.1 Vision Métier
Connecter Ekala à l'écosystème africain (paiement, livraison, comptabilité, RH) pour offrir une expérience complète.

### 10.2 Objectifs Business
- **Écosystème:** Intégrations natives avec les services locaux
- **Revenue:** Générer des revenus additionnels (referral fees)
- **Retention:** Augmenter la dépendance (stickiness)
- **Differentiation:** Se différencier de la concurrence

### 10.3 Personas
- **Super Admin:** Configuration globale
- **Tenant Admin:** Activation/désactivation intégrations
- **Developer:** API keys management
- **Partner:** Intégration de leurs services

### 10.4 Fonctionnalités MVP
- Payment gateways (Mobile Money, Carte)
- SMS provider (Twilio)
- Email provider (SendGrid)
- Basic webhooks

### 10.5 Fonctionnalités Growth
- Delivery platforms (Glovo, Jumia Food)
- Accounting (Sage, QuickBooks)
- HR & Payroll
- Advanced webhooks (custom events)
- Integration marketplace

### 10.6 Fonctionnalités Enterprise
- Custom integrations (API-first)
- White-label integrations
- Advanced monitoring (APM)
- SLA guarantees
- Dedicated support

### 10.7 KPIs
- Total Integrations Active
- API Calls per Integration
- Success Rate (%)
- Average Latency (ms)
- Error Rate (%)
- Revenue per Integration

### 10.8 Cartes Dashboard
- Integration Health: Santé intégrations
- API Calls: Volume appels API
- Error Rate: Taux d'erreur
- Latency: Latence moyenne
- Top Integrations: Intégrations les plus utilisées
- Revenue Impact: Impact revenue par intégration

### 10.9 Widgets
- Integration Status Grid (green/yellow/red)
- API Calls Chart (line chart)
- Error Rate Gauge
- Latency Distribution (histogram)
- Top Integrations Table
- Revenue by Integration (bar chart)

### 10.10 Alertes Intelligentes
- "Mobile Money API latency > 2s"
- "SMS delivery rate < 95%"
- "Integration X error rate > 5%"
- "New integration available: Glovo"
- "Integration Y revenue: +20% this month"

### 10.11 Permissions RBAC
- **Super Admin:** Configuration globale
- **Tenant Admin:** Activation/désactivation intégrations
- **Developer:** API keys management

### 10.12 APIs Nécessaires
```
GET    /api/platform/integrations
POST   /api/platform/integrations
GET    /api/platform/integrations/:id
PUT    /api/platform/integrations/:id
DELETE /api/platform/integrations/:id
POST   /api/platform/integrations/:id/test
GET    /api/platform/integrations/:id/logs
GET    /api/platform/integrations/:id/metrics
```

### 10.13 Tables SQLite/Supabase
```
platform.integrations
platform.integration_configs
platform.integration_logs
platform.integration_metrics
platform.webhooks
platform.webhook_deliveries
```

### 10.14 Événements d'Audit
- `integration.activated` - Intégration activée
- `integration.deactivated` - Intégration désactivée
- `integration.configured` - Intégration configurée
- `webhook.created` - Webhook créé
- `webhook.delivered` - Webhook délivré
- `webhook.failed` - Webhook échoué

### 10.15 Éléments UI Nécessaires
- Sidebar: "Integrations"
- Page: `/platform/integrations` (marketplace)
- Page: `/platform/integrations/:id` (configuration)
- Page: `/platform/integrations/:id/logs` (logs)
- Page: `/platform/integrations/:id/metrics` (métriques)
- Components: IntegrationCard, IntegrationGrid, ConfigForm, LogTable, MetricsChart

---

## 11. SYNC & INFRASTRUCTURE

### 11.1 Vision Métier
Garantir la fiabilité, la performance et la scalabilité de la plateforme.

### 11.2 Objectifs Business
- **Reliability:** 99.9% uptime
- **Performance:** < 200ms API response time
- **Scalability:** Support 10,000+ tenants
- **Resilience:** Recovery time < 1h

### 11.3 Personas
- **DevOps Engineer:** Monitoring, incidents
- **Super Admin:** Alertes, vue d'ensemble
- **Tenant Admin:** Aucun accès

### 11.4 Fonctionnalités MVP
- Application Performance Monitoring (APM)
- Infrastructure monitoring
- Database performance
- Error tracking (Sentry)
- Automated backups

### 11.5 Fonctionnalités Growth
- Multi-region sync
- Offline-first architecture
- Conflict resolution
- Delta sync
- CDN (CloudFront/Cloudflare)

### 11.6 Fonctionnalités Enterprise
- Auto-scaling
- Load balancing
- Database sharding (par tenant)
- Disaster recovery plan
- 24/7 on-call support

### 11.7 KPIs
- Platform Uptime (%)
- API Response Time (ms)
- Database Query Time (ms)
- Error Rate (%)
- Sync Success Rate (%)
- Backup Success Rate (%)
- Recovery Time Objective (RTO)
- Recovery Point Objective (RPO)

### 11.8 Cartes Dashboard
- Uptime Gauge: Disponibilité plateforme
- Response Time: Temps réponse API
- Error Rate: Taux d'erreur
- Sync Status: État synchronisation
- Database Performance: Performance DB
- Backup Status: État backups

### 11.9 Widgets
- Uptime Chart (30 jours)
- Response Time Distribution (histogram)
- Error Rate Trend (line chart)
- Sync Jobs Queue (bar chart)
- Database Metrics (CPU, memory, connections)
- Backup Status (table)

### 11.10 Alertes Intelligentes
- "Platform downtime > 5min"
- "API response time > 500ms (p95)"
- "Database connections > 80%"
- "Sync job failed: 10 retries"
- "Backup failed: disk full"

### 11.11 Permissions RBAC
- **DevOps:** Accès total
- **Super Admin:** Vue + alertes
- **Tenant Admin:** Aucun accès

### 11.12 APIs Nécessaires
```
GET    /api/platform/infrastructure/health
GET    /api/platform/infrastructure/metrics
GET    /api/platform/infrastructure/logs
POST   /api/platform/infrastructure/backup
GET    /api/platform/infrastructure/backups
POST   /api/platform/infrastructure/restore
GET    /api/platform/sync/status
POST   /api/platform/sync/trigger
```

### 11.13 Tables SQLite/Supabase
```
platform.infrastructure_metrics
platform.sync_jobs
platform.backups
platform.incidents
platform.maintenance_windows
```

### 11.14 Événements d'Audit
- `backup.created` - Backup créé
- `backup.restored` - Backup restauré
- `sync.triggered` - Sync déclenchée
- `incident.created` - Incident créé
- `incident.resolved` - Incident résolu
- `maintenance.started` - Maintenance démarrée
- `maintenance.completed` - Maintenance terminée

### 11.15 Éléments UI Nécessaires
- Sidebar: "Sync & Infrastructure"
- Page: `/platform/sync` (sync dashboard)
- Page: `/platform/sync/logs` (logs)
- Page: `/platform/infrastructure` (monitoring)
- Page: `/platform/infrastructure/backups` (backups)
- Components: HealthGauge, MetricsChart, LogTable, BackupCard, IncidentTimeline

---

## 12. ANALYTICS

### 12.1 Vision Métier
Business Intelligence pour le platform et les tenants, avec des insights actionnables.

### 12.2 Objectifs Business
- **Data-driven decisions:** Baser les décisions sur des données
- **Tenant insights:** Comprendre le comportement des tenants
- **Revenue insights:** Optimiser les revenus
- **Product insights:** Améliorer le produit

### 12.3 Personas
- **Super Admin:** Analytics plateforme
- **Account Manager:** Analytics de ses tenants
- **Tenant Admin:** Ses propres analytics
- **Data Analyst:** Rapports avancés

### 12.4 Fonctionnalités MVP
- Revenue analytics
- Tenant growth analytics
- Feature usage analytics
- Cohort analysis
- Export (CSV, PDF)

### 12.5 Fonctionnalités Growth
- Funnel analysis
- Custom reports
- Scheduled reports
- Sharing (email, Slack)
- Advanced filters

### 12.6 Fonctionnalités Enterprise
- Custom dashboards (drag & drop)
- ML-powered insights
- Predictive analytics
- Benchmarking (sectoriel)
- API access (data export)

### 12.7 KPIs
- DAU/MAU (Daily/Monthly Active Users)
- Feature Adoption Rate (%)
- Session Duration (min)
- Conversion Rate (%)
- Revenue per Feature
- Tenant Growth Rate (%)

### 12.8 Cartes Dashboard
- Revenue Trend: Tendance revenue
- Tenant Growth: Croissance tenants
- Feature Adoption: Adoption features
- Cohort Heatmap: Heatmap cohortes
- Funnel Analysis: Analyse funnel
- Top Features: Features les plus utilisées

### 12.9 Widgets
- Revenue Chart (line/area)
- Tenant Growth Chart (bar)
- Feature Adoption Heatmap
- Cohort Retention Chart
- Funnel Chart (conversion)
- Top Features Table

### 12.10 Alertes Intelligentes
- "Feature X adoption dropped 20%"
- "Tenant Y session duration decreased 50%"
- "Conversion rate improved 15% this week"
- "Cohort Z retention at 30 days: 40%"

### 12.11 Permissions RBAC
- **Super Admin:** Accès total platform analytics
- **Tenant Admin:** Ses propres analytics
- **Account Manager:** Analytics de ses tenants

### 12.12 APIs Nécessaires
```
GET    /api/platform/analytics/revenue
GET    /api/platform/analytics/tenants
GET    /api/platform/analytics/features
GET    /api/platform/analytics/cohorts
GET    /api/platform/analytics/funnels
GET    /api/tenants/:id/analytics/sales
GET    /api/tenants/:id/analytics/customers
GET    /api/tenants/:id/analytics/products
POST   /api/tenants/:id/analytics/reports
```

### 12.13 Tables SQLite/Supabase
```
platform.analytics_events
platform.feature_usage
platform.cohorts
platform.funnels
platform.reports
platform.report_schedules
```

### 12.14 Événements d'Audit
- `report.generated` - Rapport généré
- `report.scheduled` - Rapport planifié
- `report.exported` - Rapport exporté
- `dashboard.created` - Dashboard créé
- `dashboard.shared` - Dashboard partagé

### 12.15 Éléments UI Nécessaires
- Sidebar: "Analytics"
- Page: `/platform/analytics` (dashboard)
- Page: `/platform/analytics/revenue` (revenue)
- Page: `/platform/analytics/tenants` (tenants)
- Page: `/platform/analytics/features` (features)
- Page: `/platform/analytics/cohorts` (cohorts)
- Components: RevenueChart, TenantGrowthChart, FeatureHeatmap, CohortTable, FunnelChart

---

## 13. PLATFORM SETTINGS

### 13.1 Vision Métier
Configuration globale de la plateforme pour les admins.

### 13.2 Objectifs Business
- **Flexibility:** Adapter la plateforme aux besoins
- **Security:** Protéger la plateforme
- **Compliance:** Respecter les réglementations
- **Automation:** Automatiser les processus

### 13.3 Personas
- **Super Admin:** Configuration complète
- **DevOps:** Infrastructure settings
- **Finance:** Payment settings

### 13.4 Fonctionnalités MVP
- General settings (name, logo, language)
- Security settings (password policy, 2FA)
- Email/SMS settings (SMTP, templates)
- Payment settings (gateways, currency)

### 13.5 Fonctionnalités Growth
- Advanced security (IP whitelisting, rate limiting)
- Custom email templates
- Multi-language support
- Timezone configuration

### 13.6 Fonctionnalités Enterprise
- SSO (SAML, OAuth2)
- Advanced RBAC (custom roles)
- Audit logs export
- SLA configuration
- White-label options

### 13.7 KPIs
- Configuration changes
- Security incidents
- Email delivery rate (%)
- SMS delivery rate (%)

### 13.8 Cartes Dashboard
Aucune (page de configuration)

### 13.9 Widgets
Aucun

### 13.10 Alertes Intelligentes
- "Security incident detected"
- "Email delivery rate < 95%"
- "Configuration changed by Admin X"

### 13.11 Permissions RBAC
- **Super Admin:** Accès total
- **DevOps:** Infrastructure settings
- **Finance:** Payment settings

### 13.12 APIs Nécessaires
```
GET    /api/platform/settings
PUT    /api/platform/settings
GET    /api/platform/settings/security
PUT    /api/platform/settings/security
GET    /api/platform/settings/email
PUT    /api/platform/settings/email
GET    /api/platform/settings/payment
PUT    /api/platform/settings/payment
```

### 13.13 Tables SQLite/Supabase
```
platform.settings
platform.security_settings
platform.email_templates
platform.sms_templates
platform.payment_gateways
```

### 13.14 Événements d'Audit
- `settings.updated` - Paramètres modifiés
- `security.updated` - Sécurité modifiée
- `email.template.updated` - Template email modifié
- `payment.gateway.updated` - Gateway modifiée

### 13.15 Éléments UI Nécessaires
- Sidebar: "Settings"
- Page: `/platform/settings` (général)
- Page: `/platform/settings/security` (sécurité)
- Page: `/platform/settings/email` (email/SMS)
- Page: `/platform/settings/payment` (paiements)
- Page: `/platform/settings/legal` (légal)
- Components: SettingsForm, SecurityForm, EmailTemplateEditor, PaymentGatewayForm

---

## 14. STRUCTURE SIDEBAR

### 14.1 Architecture

```
PLATFORM SIDEBAR
├── Logo + Brand
├── User Profile (Super Admin)
│
├── EXECUTIVE
│   └── Executive Dashboard (/platform)
│
├── GROWTH
│   ├── Tenants (/platform/tenants)
│   ├── Subscriptions (/platform/subscriptions)
│   └── Vouchers (/platform/vouchers)
│
├── OPERATIONS
│   ├── Customer Success (/platform/customer-success)
│   ├── Support Center (/platform/support)
│   └── Integrations (/platform/integrations)
│
├── INTELLIGENCE
│   ├── Analytics (/platform/analytics)
│   └── Audit & Compliance (/platform/audit-logs)
│
├── INFRASTRUCTURE
│   ├── Sync & Infrastructure (/platform/sync)
│   └── Settings (/platform/settings)
│
└── Footer
    ├── Help Center
    └── Logout
```

### 14.2 Design
- **Width:** 260px (collapsed: 0px)
- **Background:** Dark (#0a0a0f)
- **Border:** 1px solid rgba(255,255,255,0.08)
- **Hover:** rgba(255,255,255,0.03)
- **Active:** Gold accent (#D4AF37)
- **Icons:** Lucide React (20px)
- **Font:** Inter, 13px, weight 500

### 14.3 Sections

**EXECUTIVE:**
- Executive Dashboard (icon: LayoutDashboard)

**GROWTH:**
- Tenants (icon: Building2, badge: count)
- Subscriptions (icon: CreditCard, badge: MRR)
- Vouchers (icon: FileText, badge: pending count)

**OPERATIONS:**
- Customer Success (icon: Users)
- Support Center (icon: HelpCircle, badge: open tickets)
- Integrations (icon: Puzzle)

**INTELLIGENCE:**
- Analytics (icon: BarChart3)
- Audit & Compliance (icon: Shield)

**INFRASTRUCTURE:**
- Sync & Infrastructure (icon: Activity)
- Settings (icon: Settings)

### 14.4 Responsive
- **Desktop (>1024px):** Sidebar fixe, collapsible
- **Tablet (768-1024px):** Sidebar overlay, bouton close
- **Mobile (<768px):** Sidebar full-width, swipe to close

---

## 15. MÉTRIQUES SaaS INTERNATIONALES

### 15.1 MRR (Monthly Recurring Revenue)
**Définition:** Revenue récurrent mensuel  
**Formule:** Σ(prix plan × nombre abonnements actifs)  
**Cible:** 50M FCFA (Phase 1), 200M FCFA (Phase 2), 1B FCFA (Phase 3)  
**Affichage:** Card + Gauge + Trend (vs mois précédent)

### 15.2 ARR (Annual Recurring Revenue)
**Définition:** Revenue récurrent annuel  
**Formule:** MRR × 12  
**Cible:** 600M FCFA (Phase 1), 2.4B FCFA (Phase 2), 12B FCFA (Phase 3)  
**Affichage:** Card + Line chart (évolution)

### 15.3 Churn Rate
**Définition:** Pourcentage de clients qui annulent  
**Formule:** (Clients perdus / Clients début mois) × 100  
**Cible:** < 3% (excellent), < 5% (bon), < 7% (acceptable)  
**Affichage:** Gauge + Trend + Breakdown (par plan, pays)

### 15.4 NRR (Net Revenue Retention)
**Définition:** Revenue conservé après churn + expansion  
**Formule:** ((Revenue début + Expansion - Churn) / Revenue début) × 100  
**Cible:** > 110% (excellent), > 100% (bon)  
**Affichage:** Card + Waterfall chart

### 15.5 ARPU (Average Revenue Per User)
**Définition:** Revenue moyen par utilisateur  
**Formule:** MRR / Nombre d'utilisateurs actifs  
**Cible:** 15,000 FCFA (Phase 1), 25,000 FCFA (Phase 2)  
**Affichage:** Card + Trend

### 15.6 LTV (Lifetime Value)
**Définition:** Revenue total généré par un client  
**Formule:** ARPU × (1 / Churn Rate)  
**Cible:** 180,000 FCFA (Phase 1), 300,000 FCFA (Phase 2)  
**Affichage:** Card + Distribution (histogram)

### 15.7 CAC (Customer Acquisition Cost)
**Définition:** Coût d'acquisition d'un client  
**Formule:** Dépenses marketing / Nouveaux clients  
**Cible:** < 50,000 FCFA (Phase 1), < 30,000 FCFA (Phase 2)  
**Affichage:** Card + Trend + Breakdown (par canal)

### 15.8 Trial Conversion Rate
**Définition:** Pourcentage d'essais qui deviennent payants  
**Formule:** (Essais convertis / Essais démarrés) × 100  
**Cible:** > 25% (excellent), > 20% (bon), > 15% (acceptable)  
**Affichage:** Funnel + Trend

### 15.9 Dashboard Cards
- **MRR Card:** Valeur, trend, target, gauge
- **ARR Card:** Valeur, trend, projection annuelle
- **Churn Card:** Taux, trend, breakdown
- **NRR Card:** Valeur, waterfall chart
- **ARPU Card:** Valeur, trend, par plan
- **LTV Card:** Valeur, distribution
- **CAC Card:** Valeur, trend, par canal
- **Trial Conversion Card:** Taux, funnel, trend

---

## 16. MÉTRIQUES SPÉCIFIQUES AFRIQUE

### 16.1 Mobile Money Revenue
**Définition:** Revenue généré par les paiements Mobile Money  
**Formule:** Σ(paiements Mobile Money complétés)  
**Cible:** 60% du revenue total (Phase 1)  
**Affichage:** Card + Pie chart (par méthode) + Trend

### 16.2 Revenue par Pays
**Définition:** Revenue généré par pays  
**Pays cibles:** Togo, Bénin, Sénégal, Côte d'Ivoire, Cameroun, Mali, Burkina Faso, Niger  
**Affichage:** Map + Bar chart + Table

### 16.3 Revenue par Devise
**Définition:** Revenue par devise (FCFA, EUR, USD)  
**Formule:** Σ(paiements par devise)  
**Affichage:** Pie chart + Trend

### 16.4 Performance Réseau par Pays
**Définition:** Latence API par pays  
**Métriques:** Response time (p50, p95, p99), Error rate  
**Affichage:** Map + Heatmap + Table

### 16.5 Croissance Régionale
**Définition:** Croissance des tenants par région  
**Métriques:** New tenants, churn, MRR growth  
**Affichage:** Map + Bar chart + Trend

### 16.6 Dashboard Cards
- **Mobile Money Revenue Card:** % du total, trend, top providers
- **Revenue by Country Card:** Map + top 5 countries
- **Revenue by Currency Card:** FCFA, EUR, USD breakdown
- **Network Performance Card:** Latency par pays, error rate
- **Regional Growth Card:** Croissance par région

### 16.7 Widgets
- Mobile Money Adoption (donut chart)
- Country Revenue Breakdown (bar chart)
- Currency Distribution (pie chart)
- Network Latency Heatmap (map)
- Regional Growth Chart (line chart)

### 16.8 Alertes Intelligentes
- "Mobile Money API latency > 2s in Togo"
- "Payment success rate < 90% in Benin"
- "New milestone: 100 tenants in Senegal"
- "Revenue growth: +30% in Côte d'Ivoire"

---

## 17. ROADMAP

### Phase 1 (Q3 2026) - Foundation
**Durée:** 3 mois  
**Objectif:** Lancer la plateforme avec les fonctionnalités core

**Executive Dashboard:**
- KPIs de base (MRR, ARR, Tenants)
- Revenue chart (30 jours)
- Recent tenants list
- Basic alerts

**Tenants:**
- CRUD tenants
- Liste avec filtres
- Fiche détaillée
- Gestion branches/utilisateurs

**Subscriptions:**
- Plans management
- Subscription lifecycle
- Upgrade/Downgrade
- Invoices (PDF)

**Billing:**
- Payment gateways (Mobile Money, Carte)
- Payment retries
- Dunning management
- Refunds

**Vouchers:**
- Création vouchers
- Validation
- Historique redemptions

**Support Center:**
- Ticket management
- Basic KB
- Email support

**Audit & Compliance:**
- Audit logs
- Search logs
- Export logs

**Integrations:**
- Mobile Money (Orange Money, M-Pesa)
- SMS (Twilio)
- Email (SendGrid)

**Analytics:**
- Revenue analytics
- Tenant growth
- Basic reports

**Platform Settings:**
- General settings
- Security settings
- Email/SMS settings

**Livrables:**
- Plateforme fonctionnelle
- 100 tenants beta
- 99.5% uptime
- CSAT > 4.0/5

---

### Phase 2 (Q4 2026) - Growth
**Durée:** 3 mois  
**Objectif:** Accélérer la croissance et améliorer la rétention

**Executive Dashboard:**
- Cohort analysis
- Geographic heatmap
- NPS trend
- Churn prediction

**Tenants:**
- Health score
- Usage analytics
- Feature flags
- Bulk actions
- Impersonation

**Subscriptions:**
- Revenue recognition
- Churn prediction
- Win-back campaigns
- Automated dunning

**Vouchers:**
- Campagnes promotionnelles
- A/B testing
- Attribution tracking
- Fraud detection

**Customer Success:**
- NPS surveys
- Onboarding tracking
- Health monitoring
- Playbooks automation

**Support Center:**
- Multi-canal (chat, phone)
- Automated assignment
- Escalation workflows
- Canned responses

**Analytics:**
- Funnel analysis
- Custom reports
- Scheduled reports
- Sharing

**Integrations:**
- Delivery platforms (Glovo, Jumia Food)
- Accounting (Sage, QuickBooks)
- Advanced webhooks

**Livrables:**
- 500 tenants
- MRR: 100M FCFA
- Churn < 5%
- NPS > 40
- CSAT > 4.5/5

---

### Phase 3 (Q1 2027) - Scale
**Durée:** 3 mois  
**Objectif:** Devenir le leader africain du SaaS HORECA

**Executive Dashboard:**
- AI-powered insights
- Revenue forecast
- Custom dashboards
- Real-time collaboration

**Tenants:**
- Advanced segmentation
- Automated workflows
- Tenant journey mapping
- Predictive analytics

**Subscriptions:**
- Custom pricing
- Volume discounts
- Multi-year contracts
- Advanced invoicing

**Vouchers:**
- Dynamic pricing (AI)
- Partner programs
- Reseller management
- Advanced analytics

**Customer Success:**
- Dedicated CSM
- Custom onboarding
- Advanced segmentation
- VoC program

**Support Center:**
- AI chatbot (Tier 1)
- Video calls
- Screen sharing
- Community forum

**Analytics:**
- ML-powered insights
- Predictive analytics
- Benchmarking
- API access

**Integrations:**
- HR & Payroll
- Advanced monitoring (APM)
- SLA guarantees

**Infrastructure:**
- Multi-region deployment
- Auto-scaling
- Database sharding
- CDN

**Livrables:**
- 2,000 tenants
- MRR: 300M FCFA
- Churn < 3%
- NPS > 50
- 99.9% uptime

---

### Phase 4 (Q2 2027) - Expansion
**Durée:** 3 mois  
**Objectif:** Expansion régionale et internationale

**Executive Dashboard:**
- Multi-entity consolidation
- Advanced benchmarking
- Strategic planning tools

**Tenants:**
- Multi-brand management
- Franchise support
- Advanced RBAC
- White-label options

**Subscriptions:**
- Enterprise contracts
- Custom SLAs
- Revenue recognition (GAAP)
- Financial reporting

**Vouchers:**
- Global campaigns
- Partner ecosystem
- Advanced targeting

**Customer Success:**
- Customer advisory board
- User conferences
- Certification program

**Support Center:**
- 24/7 support
- Dedicated account managers
- Premium SLA

**Analytics:**
- Industry benchmarks
- Competitive analysis
- Market insights

**Integrations:**
- 50+ integrations
- Partner marketplace
- API ecosystem

**Infrastructure:**
- Multi-cloud (AWS, GCP, Azure)
- Advanced security (SOC 2, ISO 27001)
- Disaster recovery (RTO < 30min)

**Livrables:**
- 5,000 tenants
- MRR: 600M FCFA
- Présence dans 10 pays
- Partenaire #1 HORECA Afrique

---

## CONCLUSION

Cette spécification produit définit la vision, les objectifs, les fonctionnalités et la roadmap pour transformer Ekala en une plateforme SaaS de niveau international.

**Points clés:**
- Architecture modulaire et scalable
- Focus sur l'expérience utilisateur (UX premium)
- Métriques SaaS standardisées + métriques Afrique
- Roadmap réaliste sur 4 phases
- Comparables: Shopify HQ, Stripe Dashboard, Lightspeed HQ, Toast Enterprise

**Prochaine étape:** Validation de cette spécification → Design UI/UX → Développement MVP