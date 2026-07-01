# EKALA PLATFORM - ARCHITECTURE CIBLE
## SaaS Multi-Tenant de Niveau International

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Architecture Document  
**Target:** Restaurants, Bars, Hôtels, Fast-foods, Night clubs, Cafés, Resorts (Afrique)

---

## VISION GLOBALE

Ekala est une plateforme SaaS multi-tenant unifiée pour le secteur HORECA (Hotellerie-Restauration) en Afrique. Elle combine:
- **POS (Point of Sale)** - Caisse tactile avec QR Menu
- **ERP Léger** - Gestion complète de l'établissement
- **Business Intelligence** - Analytics et reporting en temps réel
- **Multi-sites** - Gestion centralisée de succursales
- **Écosystème** - Intégrations paiement, livraison, comptabilité

**Comparables:** Shopify Admin, Toast HQ, Stripe Dashboard, Lightspeed HQ, Odoo SaaS

---

## 1. EXECUTIVE DASHBOARD

### 1.1 Objectif Métier
Vue consolidée en temps réel pour le Super Admin et les Account Managers. Pilotage stratégique de la plateforme.

### 1.2 Fonctionnalités
- KPIs globaux (MRR, ARR, churn rate, NRR)
- Revenue par pays, par segment, par plan
- Tenant acquisition funnel
- Health score de la plateforme
- Alertes critiques (downtime, payment failures, churn risk)
- Revenue forecast (AI-powered)
- Cohort analysis
- Geographic heatmap (Afrique)

### 1.3 Permissions RBAC
- **Super Admin:** Accès total
- **Account Manager:** Ses tenants uniquement
- **Finance:** Vue financière uniquement
- **Support:** Vue tickets uniquement

### 1.4 KPIs
- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- Churn Rate (%)
- NRR (Net Revenue Retention)
- CAC (Customer Acquisition Cost)
- LTV (Lifetime Value)
- Tenant Health Score
- Platform Uptime (%)
- Payment Success Rate (%)
- Support Ticket Resolution Time (hrs)

### 1.5 APIs Requises
```
GET    /api/platform/dashboard/kpis
GET    /api/platform/dashboard/revenue-trend
GET    /api/platform/dashboard/tenant-acquisition
GET    /api/platform/dashboard/geographic-distribution
GET    /api/platform/dashboard/cohort-analysis
GET    /api/platform/dashboard/health-score
GET    /api/platform/dashboard/alerts
POST   /api/platform/dashboard/forecast
```

### 1.6 Pages UI
- `/platform` - Executive Dashboard (main)
- `/platform/analytics/revenue` - Revenue Analytics
- `/platform/analytics/tenants` - Tenant Analytics
- `/platform/analytics/geographic` - Geographic Analytics

### 1.7 Widgets Dashboard
1. **MRR Gauge** - Indicateur circulaire MRR/ARR
2. **Revenue Chart** - Graphique évolution revenue (line/area)
3. **Tenant Funnel** - Funnel acquisition (Signup → Trial → Paid)
4. **Health Score** - Score global plateforme (0-100)
5. **Churn Alert** - Liste tenants à risque
6. **Payment Success** - Taux de succès paiements
7. **Support Load** - Tickets ouverts vs résolus
8. **Geographic Map** - Carte Afrique avec heatmap
9. **Top Performers** - Top 10 tenants par revenue
10. **Real-time Activity** - Live feed transactions

---

## 2. TENANTS MANAGEMENT

### 2.1 Objectif Métier
Gestion complète du cycle de vie des tenants (onboarding → expansion → churn).

### 2.2 Fonctionnalités
- **Onboarding**
  - Inscription self-service
  - Vérification identité (KYC)
  - Configuration initiale guidée
  - Import données existantes
  - Formation automatisée (guided tour)

- **Gestion**
  - Fiche tenant détaillée
  - Gestion des branches/succursales
  - Gestion des utilisateurs (RBAC)
  - Gestion des rôles personnalisés
  - Quotas et limites par plan
  - Feature flags par tenant

- **Monitoring**
  - Health score par tenant
  - Usage analytics (features, API calls)
  - Performance metrics (page load, API latency)
  - Error tracking
  - Subscription status

- **Expansion**
  - Upgrade/downgrade plan
  - Achat modules additionnels
  - Ajout de branches
  - Ajout d'utilisateurs

- **Churn Management**
  - Détection early warning
  - Win-back campaigns
  - Exit surveys
  - Data export (GDPR compliance)

### 2.3 Permissions RBAC
- **Super Admin:** CRUD complet
- **Account Manager:** Lecture/édition de ses tenants
- **Support:** Lecture seule + tickets
- **Finance:** Lecture données financières

### 2.4 KPIs
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

### 2.5 APIs Requises
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

### 2.6 Pages UI
- `/platform/tenants` - Liste tenants (tableau avec filtres)
- `/platform/tenants/:id` - Détails tenant
- `/platform/tenants/:id/edit` - Édition tenant
- `/platform/tenants/:id/branches` - Gestion branches
- `/platform/tenants/:id/users` - Gestion utilisateurs
- `/platform/tenants/:id/activity` - Activity log
- `/platform/tenants/:id/impersonate` - Impersonation (debug)
- `/platform/tenants/onboarding` - Wizard onboarding
- `/platform/tenants/import` - Import données

### 2.7 Widgets Dashboard
1. **Tenant Card** - Fiche résumée tenant (plan, status, health)
2. **Usage Chart** - Graphique usage over time
3. **Branches Map** - Visualisation géographique branches
4. **Activity Timeline** - Timeline événements récents
5. **Health Indicator** - Score santé (color-coded)
6. **Quick Actions** - Actions rapides (upgrade, suspend, delete)
7. **Billing Info** - Infos facturation (MRR, next invoice)
8. **Support Tickets** - Tickets ouverts

---

## 3. SUBSCRIPTIONS & BILLING

### 3.1 Objectif Métier
Gestion des abonnements, facturation, paiements et revenus.

### 3.2 Fonctionnalités
- **Plans Management**
  - Création/modification plans
  - Pricing dynamique par pays
  - Feature sets par plan
  - Quotas (users, branches, storage, API calls)
  - Promotions et coupons

- **Subscription Lifecycle**
  - Trial → Paid conversion
  - Upgrade/Downgrade
  - Proration automatique
  - Renewal management
  - Cancellation (immédiate ou fin de période)
  - Pause/Resume
  - Grace period management

- **Billing**
  - Facturation automatique (recurring)
  - Paiements récurrents (Mobile Money, Carte, Virement)
  - Invoices (PDF)
  - Payment retries
  - Dunning management
  - Refunds

- **Revenue Recognition**
  - Revenue par plan
  - Revenue par pays
  - Revenue par canal
  - MRR/ARR tracking
  - Churn revenue impact

### 3.3 Permissions RBAC
- **Super Admin:** CRUD complet
- **Finance:** Lecture + remboursements
- **Account Manager:** Lecture ses tenants
- **Tenant Admin:** Lecture son abonnement + upgrade

### 3.4 KPIs
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

### 3.5 APIs Requises
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

### 3.6 Pages UI
- `/platform/subscriptions` - Liste abonnements
- `/platform/subscriptions/:id` - Détails abonnement
- `/platform/subscriptions/:id/invoices` - Factures
- `/platform/subscriptions/:id/payments` - Paiements
- `/platform/billing` - Revenue dashboard
- `/platform/billing/invoices` - Gestion factures
- `/platform/billing/refunds` - Remboursements
- `/platform/plans` - Gestion plans
- `/platform/coupons` - Gestion coupons/promos

### 3.7 Widgets Dashboard
1. **MRR Chart** - Évolution MRR mensuel
2. **Revenue by Plan** - Pie chart répartition
3. **Churn Analysis** - Taux churn par cohorte
4. **Payment Success** - Taux succès paiements
5. **Outstanding AR** - Montant impayé
6. **Trial Conversion** - Taux conversion essai → payant
7. **Top Plans** - Plans les plus vendus
8. **Revenue Forecast** - Prévisionnel AI

---

## 4. VOUCHERS & PROMOTIONS

### 4.1 Objectif Métier
Système de promotions, réductions et vouchers pour acquisition et rétention.

### 4.2 Fonctionnalités
- **Voucher Types**
  - Discount (% ou montant fixe)
  - Free trial extension
  - Free months
  - Feature unlock
  - Upgrade discount

- **Voucher Management**
  - Création vouchers (batch ou unique)
  - Codes promo personnalisés
  - Limites d'usage (par tenant, global)
  - Date d'expiration
  - Conditions d'utilisation

- **Campaigns**
  - Campagnes promotionnelles
  - A/B testing
  - Attribution tracking
  - ROI measurement

- **Redemption**
  - Validation en temps réel
  - Historique redemption
  - Fraud detection
  - Auto-application

### 4.3 Permissions RBAC
- **Super Admin:** CRUD complet
- **Marketing:** Création/édition campagnes
- **Finance:** Vue financière
- **Tenant Admin:** Utilisation vouchers

### 4.4 KPIs
- Total Vouchers Created
- Redemption Rate (%)
- Revenue Impact (€)
- Cost per Acquisition (CPA)
- ROI by Campaign
- Fraud Rate (%)
- Average Discount Value
- Voucher LTV Impact

### 4.5 APIs Requises
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

### 4.6 Pages UI
- `/platform/vouchers` - Liste vouchers
- `/platform/vouchers/:id` - Détails voucher
- `/platform/vouchers/create` - Création voucher
- `/platform/vouchers/redemptions` - Historique redemptions
- `/platform/campaigns` - Campagnes
- `/platform/campaigns/:id` - Détails campagne
- `/platform/campaigns/:id/analytics` - Analytics campagne

### 4.7 Widgets Dashboard
1. **Voucher Performance** - Taux redemption
2. **Revenue Impact** - Impact financier
3. **Top Campaigns** - Meilleures campagnes
4. **Fraud Alerts** - Alertes fraude
5. **Redemption Timeline** - Timeline redemptions
6. **Cost Analysis** - Coût par acquisition

---

## 5. CUSTOMER SUCCESS

### 5.1 Objectif Métier
Maximiser la rétention et l'expansion des tenants via un accompagnement proactif.

### 5.2 Fonctionnalités
- **Health Monitoring**
  - Health score par tenant
  - Usage patterns
  - Feature adoption tracking
  - Early warning system

- **Engagement**
  - Automated check-ins
  - NPS surveys
  - Onboarding completion tracking
  - Training completion

- **Expansion**
  - Upgrade opportunities detection
  - Cross-sell recommendations
  - Usage-based triggers

- **Retention**
  - Churn prediction (ML)
  - Win-back workflows
  - Retention campaigns

### 5.3 Permissions RBAC
- **Customer Success Manager:** Ses tenants uniquement
- **Super Admin:** Vue globale
- **Tenant Admin:** Ses propres données

### 5.4 KPIs
- NPS (Net Promoter Score)
- CSAT (Customer Satisfaction)
- Health Score (0-100)
- Onboarding Completion Rate (%)
- Feature Adoption Rate (%)
- Time to First Value (days)
- Expansion Revenue (%)
- Churn Rate (%)

### 5.5 APIs Requises
```
GET    /api/platform/customer-success/health-score
GET    /api/platform/customer-success/tenants-at-risk
GET    /api/platform/customer-success/nps
POST   /api/platform/customer-success/surveys
GET    /api/platform/customer-success/engagement
GET    /api/platform/customer-success/expansion-opportunities
POST   /api/platform/customer-success/playbooks
```

### 5.6 Pages UI
- `/platform/customer-success` - Dashboard CS
- `/platform/customer-success/tenants-at-risk` - Tenants à risque
- `/platform/customer-success/nps` - NPS dashboard
- `/platform/customer-success/engagement` - Engagement metrics
- `/platform/customer-success/playbooks` - Playbooks automation

### 5.7 Widgets Dashboard
1. **Health Score Distribution** - Répartition scores santé
2. **NPS Trend** - Évolution NPS
3. **At-Risk Tenants** - Liste tenants à risque
4. **Onboarding Funnel** - Funnel onboarding
5. **Feature Adoption** - Adoption features
6. **Expansion Opportunities** - Opportunités upgrade

---

## 6. SUPPORT CENTER

### 6.1 Objectif Métier
Gestion centralisée du support client multi-canal.

### 6.2 Fonctionnalités
- **Ticket Management**
  - Création tickets (multi-canal: email, chat, phone)
  - Assignment automatique (round-robin, skill-based)
  - SLA tracking
  - Escalation workflows
  - Internal notes
  - Resolution tracking

- **Knowledge Base**
  - Articles FAQ
  - Video tutorials
  - Troubleshooting guides
  - Search engine

- **Live Chat**
  - Chatbot (AI-powered)
  - Human handoff
  - Canned responses
  - File sharing

- **Community**
  - Forum
  - Feature requests
  - User feedback

### 6.3 Permissions RBAC
- **Super Admin:** Accès total
- **Support Agent:** Ses tickets assignés
- **Support Manager:** Tous tickets + rapports
- **Tenant Admin:** Tickets de son tenant uniquement

### 6.4 KPIs
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

### 6.5 APIs Requises
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

### 6.6 Pages UI
- `/platform/support` - Dashboard support
- `/platform/support/tickets` - Liste tickets
- `/platform/support/tickets/:id` - Détails ticket
- `/platform/support/knowledge-base` - Base de connaissances
- `/platform/support/analytics` - Analytics support
- `/platform/support/agents` - Gestion agents

### 6.7 Widgets Dashboard
1. **Ticket Volume** - Volume tickets (24h, 7j, 30j)
2. **SLA Compliance** - Respect SLA (%)
3. **Resolution Time** - Temps résolution moyen
4. **Open Tickets by Priority** - Répartition par priorité
5. **Agent Performance** - Performance agents
6. **Channel Distribution** - Répartition par canal
7. **Top Issues** - Problèmes récurrents
8. **CSAT Score** - Satisfaction client

---

## 7. AUDIT & COMPLIANCE

### 7.1 Objectif Métier
Traçabilité complète, conformité réglementaire, sécurité.

### 7.2 Fonctionnalités
- **Audit Logs**
  - Action logging (CRUD)
  - User activity tracking
  - API call logging
  - Data access logs
  - Change history

- **Compliance**
  - GDPR compliance
  - Data retention policies
  - Right to be forgotten
  - Data export (tenant)
  - Audit reports

- **Security**
  - Failed login attempts
  - Suspicious activity detection
  - IP whitelisting
  - 2FA enforcement
  - Session management

### 7.3 Permissions RBAC
- **Super Admin:** Accès total
- **Compliance Officer:** Lecture + rapports
- **Security:** Lecture + alertes
- **Tenant Admin:** Logs de son tenant uniquement

### 7.4 KPIs
- Total Audit Events
- Security Incidents
- Failed Login Attempts
- Compliance Score (%)
- Data Export Requests
- Average Time to Detect (incidents)
- Average Time to Resolve (incidents)

### 7.5 APIs Requises
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

### 7.6 Pages UI
- `/platform/audit-logs` - Logs d'audit
- `/platform/audit-logs/search` - Recherche avancée
- `/platform/audit-logs/tenant/:id` - Logs par tenant
- `/platform/compliance` - Dashboard conformité
- `/platform/compliance/reports` - Rapports conformité
- `/platform/security` - Dashboard sécurité
- `/platform/security/incidents` - Incidents sécurité

### 7.7 Widgets Dashboard
1. **Audit Timeline** - Timeline événements
2. **Security Incidents** - Incidents sécurité
3. **Failed Logins** - Tentatives échouées
4. **Compliance Score** - Score conformité
5. **Top Actions** - Actions les plus fréquentes
6. **User Activity** - Activité utilisateurs
7. **Data Access** - Accès données sensibles

---

## 8. INTEGRATIONS

### 8.1 Objectif Métier
Connecter Ekala à l'écosystème africain (paiement, livraison, comptabilité, RH).

### 8.2 Fonctionnalités
- **Payment Gateways**
  - Mobile Money (Orange Money, M-Pesa, Moov Money)
  - Cartes bancaires (Visa, Mastercard)
  - Virements bancaires
  - Paiement à la livraison

- **Delivery Platforms**
  - Glovo
  - Jumia Food
  - Livraison locale

- **Accounting**
  - Sage
  - QuickBooks
  - Xero
  - Comptabilité locale

- **HR & Payroll**
  - Gestion paie
  - Congés
  - Planning

- **Communication**
  - SMS (Twilio, local providers)
  - Email (SendGrid, Mailgun)
  - WhatsApp Business
  - Push notifications

- **Analytics**
  - Google Analytics
  - Mixpanel
  - Amplitude

### 8.3 Permissions RBAC
- **Super Admin:** Configuration globale
- **Tenant Admin:** Activation/désactivation intégrations
- **Developer:** API keys management

### 8.4 KPIs
- Total Integrations Active
- API Calls per Integration
- Success Rate (%)
- Average Latency (ms)
- Error Rate (%)
- Revenue per Integration

### 8.5 APIs Requises
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

### 8.6 Pages UI
- `/platform/integrations` - Marketplace intégrations
- `/platform/integrations/:id` - Configuration intégration
- `/platform/integrations/:id/logs` - Logs API
- `/platform/integrations/:id/metrics` - Métriques

### 8.7 Widgets Dashboard
1. **Integration Health** - Santé intégrations
2. **API Calls** - Volume appels API
3. **Error Rate** - Taux d'erreur
4. **Latency** - Latence moyenne
5. **Top Integrations** - Intégrations les plus utilisées
6. **Revenue Impact** - Impact revenue par intégration

---

## 9. SYNC & INFRASTRUCTURE

### 9.1 Objectif Métier
Garantir la fiabilité, la performance et la scalabilité de la plateforme.

### 9.2 Fonctionnalités
- **Data Sync**
  - Multi-region sync
  - Offline-first architecture
  - Conflict resolution
  - Delta sync

- **Monitoring**
  - Application Performance Monitoring (APM)
  - Infrastructure monitoring
  - Database performance
  - CDN performance
  - Error tracking (Sentry)

- **Scalability**
  - Auto-scaling
  - Load balancing
  - Database sharding (par tenant)
  - CDN (CloudFront/Cloudflare)

- **Backup & Recovery**
  - Automated backups
  - Point-in-time recovery
  - Disaster recovery plan

### 9.3 Permissions RBAC
- **DevOps:** Accès total
- **Super Admin:** Vue + alertes
- **Tenant Admin:** Aucun accès

### 9.4 KPIs
- Platform Uptime (%)
- API Response Time (ms)
- Database Query Time (ms)
- Error Rate (%)
- Sync Success Rate (%)
- Backup Success Rate (%)
- Recovery Time Objective (RTO)
- Recovery Point Objective (RPO)

### 9.5 APIs Requises
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

### 9.6 Pages UI
- `/platform/sync` - Sync dashboard
- `/platform/sync/logs` - Logs synchronisation
- `/platform/infrastructure` - Infrastructure monitoring
- `/platform/infrastructure/backups` - Gestion backups

### 9.7 Widgets Dashboard
1. **Uptime Gauge** - Disponibilité plateforme
2. **Response Time** - Temps réponse API
3. **Error Rate** - Taux d'erreur
4. **Sync Status** - État synchronisation
5. **Database Performance** - Performance DB
6. **Backup Status** - État backups

---

## 10. ANALYTICS

### 10.1 Objectif Métier
Business Intelligence pour le platform et les tenants.

### 10.2 Fonctionnalités
- **Platform Analytics**
  - Revenue analytics
  - Tenant growth analytics
  - Feature usage analytics
  - Cohort analysis
  - Funnel analysis

- **Tenant Analytics** (white-label)
  - Sales analytics
  - Customer analytics
  - Product analytics
  - Staff performance
  - Table turnover

- **Custom Reports**
  - Report builder
  - Scheduled reports
  - Export (PDF, CSV, Excel)
  - Sharing

### 10.3 Permissions RBAC
- **Super Admin:** Accès total platform analytics
- **Tenant Admin:** Ses propres analytics
- **Account Manager:** Analytics de ses tenants

### 10.4 KPIs
- DAU/MAU (Daily/Monthly Active Users)
- Feature Adoption Rate (%)
- Session Duration (min)
- Conversion Rate (%)
- Revenue per Feature
- Tenant Growth Rate (%)

### 10.5 APIs Requises
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

### 10.6 Pages UI
- `/platform/analytics` - Analytics dashboard
- `/platform/analytics/revenue` - Revenue analytics
- `/platform/analytics/tenants` - Tenant analytics
- `/platform/analytics/features` - Feature usage
- `/platform/analytics/cohorts` - Cohort analysis

### 10.7 Widgets Dashboard
1. **Revenue Trend** - Tendance revenue
2. **Tenant Growth** - Croissance tenants
3. **Feature Adoption** - Adoption features
4. **Cohort Heatmap** - Heatmap cohortes
5. **Funnel Analysis** - Analyse funnel
6. **Top Features** - Features les plus utilisées

---

## 11. PLATFORM SETTINGS

### 11.1 Objectif Métier
Configuration globale de la plateforme.

### 11.2 Fonctionnalités
- **General Settings**
  - Platform name, logo
  - Default language, currency
  - Timezone configuration
  - Email templates

- **Security Settings**
  - Password policy
  - 2FA enforcement
  - IP whitelisting
  - Session timeout
  - Rate limiting

- **Email/SMS Settings**
  - SMTP configuration
  - SMS provider
  - Templates
  - Sender signatures

- **Payment Settings**
  - Default payment gateways
  - Currency settings
  - Tax configuration
  - Invoice numbering

- **Legal**
  - Terms of Service
  - Privacy Policy
  - GDPR compliance
  - Data processing agreements

### 11.3 Permissions RBAC
- **Super Admin:** Accès total
- **DevOps:** Infrastructure settings
- **Finance:** Payment settings

### 11.4 KPIs
- Configuration changes
- Security incidents
- Email delivery rate (%)
- SMS delivery rate (%)

### 11.5 APIs Requises
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

### 11.6 Pages UI
- `/platform/settings` - Settings général
- `/platform/settings/security` - Sécurité
- `/platform/settings/email` - Email/SMS
- `/platform/settings/payment` - Paiements
- `/platform/settings/legal` - Légal

### 11.7 Widgets Dashboard
Aucun widget spécifique (page de configuration)

---

## 12. ARCHITECTURE TECHNIQUE

### 12.1 Stack Technique

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- React Router v6
- TanStack Query (data fetching)
- Zustand (state management)
- Tailwind CSS (styling)
- shadcn/ui (components)
- Recharts (charts)
- Lucide React (icons)

**Backend:**
- Node.js + Express
- TypeScript
- PostgreSQL (primary DB)
- Supabase (auth, realtime, storage)
- Redis (cache, sessions, queues)
- BullMQ (job queues)

**Infrastructure:**
- AWS / GCP / Azure
- Docker + Kubernetes
- Nginx (reverse proxy)
- CloudFlare (CDN, DDoS protection)
- Sentry (error tracking)
- Datadog (monitoring)

**Integrations:**
- Stripe (payments international)
- Mobile Money APIs (Orange, M-Pesa, Moov)
- Twilio (SMS)
- SendGrid (email)
- Cloudinary (images)

### 12.2 Architecture Multi-Tenant

**Isolation Strategy:**
- **Row-Level Security (RLS)** - PostgreSQL RLS par tenant_id
- **Schema per Tenant** - Optionnel pour isolation forte
- **Shared Database** - Coûts optimisés
- **Tenant Context** - Middleware injection tenant_id

**Data Model:**
```
platform
├── tenants (id, name, plan_id, status, ...)
├── branches (id, tenant_id, name, address, ...)
├── users (id, tenant_id, email, role, ...)
├── subscriptions (id, tenant_id, plan_id, status, ...)
├── vouchers (id, tenant_id, code, discount, ...)
└── ...

tenant_XXXXX
├── products
├── orders
├── customers
├── inventory
└── ...
```

### 12.3 Scalability

**Horizontal Scaling:**
- Stateless API servers (auto-scaling)
- Database read replicas
- Redis cluster (cache)
- CDN (static assets)

**Performance Targets:**
- API Response Time: < 200ms (p95)
- Page Load Time: < 2s
- Database Query Time: < 50ms
- Uptime: 99.9%

### 12.4 Security

**Authentication:**
- JWT (access + refresh tokens)
- 2FA (TOTP)
- OAuth2 (Google, Microsoft)

**Authorization:**
- RBAC (Role-Based Access Control)
- ABAC (Attribute-Based Access Control) - optionnel
- Tenant isolation (RLS)

**Data Protection:**
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- PII masking
- GDPR compliance

---

## 13. ROADMAP

### Phase 1 (Q3 2026) - Foundation
- Executive Dashboard
- Tenant Management (CRUD)
- Subscription & Billing (basic)
- Vouchers (basic)
- Support Center (basic)

### Phase 2 (Q4 2026) - Growth
- Customer Success module
- Advanced Analytics
- Integration marketplace (Mobile Money, SMS)
- Multi-language support

### Phase 3 (Q1 2027) - Scale
- Advanced features (AI-powered insights)
- Marketplace (third-party apps)
- White-label solutions
- Advanced security (SOC 2)

### Phase 4 (Q2 2027) - Expansion
- Multi-region deployment
- Advanced compliance (PCI DSS, GDPR)
- Partner ecosystem
- API marketplace

---

## 14. CONCLUSION

Cette architecture positionne Ekala comme une plateforme SaaS de niveau mondial, capable de:
- Gérer des milliers de tenants africains
- Offrir une expérience utilisateur premium (Shopify-like)
- Assurer la scalabilité et la fiabilité
- Respecter les normes de sécurité et conformité
- S'adapter aux spécificités du marché africain (Mobile Money, multi-pays, multi-devises)

**Prochaine étape:** Validation architecture → Detailed design → Implementation