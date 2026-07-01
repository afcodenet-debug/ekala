# EKALA SAAS PLAN GOVERNANCE
## Gouvernance des Plans et Abonnements

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Governance Specification  
**Objectif:** Cadre de gouvernance pour les plans SaaS

---

## 1. PLAN HIERARCHY

### 1.1 Plan Tiers

```
STARTER (Entry Level)
    ↓
BUSINESS (Growth)
    ↓
ENTERPRISE (Scale)
    ↓
ULTIMATE (Enterprise)
```

### 1.2 Upgrade Path

**Règles:**
- ✅ Upgrade possible à tout moment
- ✅ Proration automatique
- ✅ Accès immédiat aux nouvelles fonctionnalités
- ✅ Pas de rétrogradation pendant la période

**Downgrade:**
- ⚠️ Possible uniquement à la fin de la période
- ⚠️ Perte d'accès aux fonctionnalités supérieures
- ⚠️ Conservation des données pendant 30 jours

---

## 2. PLAN DEFINITIONS

### 2.1 STARTER Plan

**Target:** Petits restaurants, cafés, food trucks

**Pricing:**
- Monthly: 15,000 FCFA
- Annual: 150,000 FCFA (économisez 30,000 FCFA)

**Limits:**
- Users: 5
- Branches: 1
- Storage: 5 GB
- API Calls: 1,000/day
- Support Tickets: 2/month

**Features:**
- ✅ Order Management
- ✅ Inventory Management
- ✅ Customer Management
- ✅ Basic Reports
- ✅ Email Support
- ✅ Mobile App (basic)

**Restrictions:**
- ❌ No API Access
- ❌ No Multi-branch
- ❌ No Custom Branding
- ❌ No Advanced Analytics
- ❌ No Priority Support

**Onboarding:**
- Self-service signup
- Email verification
- Basic tutorial (5 min)
- Email support only

---

### 2.2 BUSINESS Plan

**Target:** Restaurants moyens, hôtels 3 étoiles, chaînes locales

**Pricing:**
- Monthly: 45,000 FCFA
- Annual: 450,000 FCFA (économisez 90,000 FCFA)

**Limits:**
- Users: 25
- Branches: 10
- Storage: 50 GB
- API Calls: 10,000/day
- Support Tickets: 10/month

**Features:**
- ✅ All STARTER features
- ✅ Multi-branch Management
- ✅ API Access (REST)
- ✅ Advanced Reports
- ✅ Priority Support (4h response)
- ✅ Custom Branding (logo, colors)
- ✅ Mobile App (full)
- ✅ Integration: Mobile Money
- ✅ Integration: SMS

**Restrictions:**
- ❌ No White-label
- ❌ No SLA Guarantee
- ❌ No Dedicated Account Manager
- ❌ No Custom Integrations

**Onboarding:**
- Self-service signup
- Email verification
- Interactive tutorial (15 min)
- Priority email support
- 30-min onboarding call

---

### 2.3 ENTERPRISE Plan

**Target:** Chaînes, hôtels 4-5 étoiles, groupes régionaux

**Pricing:**
- Monthly: 120,000 FCFA
- Annual: 1,200,000 FCFA (économisez 240,000 FCFA)

**Limits:**
- Users: 100
- Branches: 50
- Storage: 200 GB
- API Calls: 50,000/day
- Support Tickets: Unlimited

**Features:**
- ✅ All BUSINESS features
- ✅ White-label (custom domain)
- ✅ SLA 99.9% Uptime
- ✅ Dedicated Account Manager
- ✅ Custom Integrations
- ✅ Advanced Analytics
- ✅ Custom Reports
- ✅ Training Sessions (monthly)
- ✅ Integration: Accounting (Sage, QuickBooks)
- ✅ Integration: Delivery (Glovo, Jumia)

**Restrictions:**
- ❌ No On-premise
- ❌ No Custom Development

**Onboarding:**
- Sales-assisted signup
- Contract signing
- 1-hour onboarding session
- Dedicated account manager
- Weekly check-ins (first month)

---

### 2.4 ULTIMATE Plan

**Target:** Grands groupes, chaînes nationales, multinationales

**Pricing:**
- Monthly: 250,000 FCFA
- Annual: 2,500,000 FCFA (économisez 500,000 FCFA)

**Limits:**
- Users: Unlimited
- Branches: Unlimited
- Storage: 500 GB
- API Calls: Unlimited
- Support Tickets: Unlimited

**Features:**
- ✅ All ENTERPRISE features
- ✅ On-premise Option
- ✅ Custom Development
- ✅ 24/7 Phone Support
- ✅ Training Included (on-site)
- ✅ SLA 99.99% Uptime
- ✅ Executive Reviews (quarterly)
- ✅ Beta Access
- ✅ Priority Feature Requests

**Exclusive Benefits:**
- 🏆 Priority feature requests
- 🏆 Beta access to new features
- 🏆 Executive business reviews
- 🏆 Custom SLA terms

**Onboarding:**
- Enterprise sales process
- Custom contract
- Multi-session onboarding (4+ hours)
- Dedicated success team
- Daily check-ins (first week)

---

## 3. PLAN GOVERNANCE RULES

### 3.1 Pricing Governance

**Price Changes:**
- Minimum 30 days notice
- Grandfathered pricing for existing customers
- Annual contracts locked at current price
- Monthly customers notified via email

**Discounts:**
- Maximum 20% discount (Super Admin approval required)
- Volume discounts: 10% (10+ tenants), 15% (25+ tenants), 20% (50+ tenants)
- Non-profit: 30% (requires documentation)
- Startup: 15% (requires < 2 years old)

**Refunds:**
- 30-day money-back guarantee
- Prorated refunds for annual plans
- No refunds after 30 days (except SLA breach)

### 3.2 Feature Governance

**Feature Flags:**
- All features behind feature flags
- Gradual rollout (10% → 50% → 100%)
- A/B testing for new features
- Beta access for ULTIMATE customers

**Feature Deprecation:**
- 90 days notice minimum
- Migration path provided
- Data export available
- Support for legacy features

### 3.3 Usage Governance

**Overage Policy:**
- 10% grace period (no charge)
- 10-20% overage: warning email
- 20-50% overage: charge at 2x rate
- 50%+ overage: account review

**Rate Limiting:**
- API calls: Sliding window (1 hour)
- Concurrent requests: 10 max
- File uploads: 10 MB max
- Database queries: 1000/hour

**Quota Enforcement:**
- Real-time monitoring
- Warning at 80%
- Hard limit at 100%
- Auto-upgrade prompt at 90%

---

## 4. SUBSCRIPTION LIFECYCLE

### 4.1 States

```
TRIAL → ACTIVE → PAST_DUE → SUSPENDED → CANCELLED
              ↓
         RENEWED (automatic)
```

**State Definitions:**

**TRIAL:**
- Duration: 14 days (default)
- Full feature access
- No billing
- Auto-convert to ACTIVE or CANCELLED

**ACTIVE:**
- Billing cycle active
- Full feature access
- Auto-renewal enabled
- Payment method valid

**PAST_DUE:**
- Payment failed
- Grace period: 7 days
- Limited feature access
- Retry payment daily

**SUSPENDED:**
- Grace period expired
- No feature access
- Data preserved (90 days)
- Reactivation possible

**CANCELLED:**
- Subscription ended
- Data export available (90 days)
- No re-activation (must signup new)

### 4.2 Transitions

**TRIAL → ACTIVE:**
- Trigger: Payment successful
- Action: Activate all features
- Notification: Welcome email

**TRIAL → CANCELLED:**
- Trigger: Trial expired, no payment
- Action: Downgrade to FREE (limited)
- Notification: Trial expired email

**ACTIVE → PAST_DUE:**
- Trigger: Payment failed
- Action: Send to dunning
- Notification: Payment failed email

**PAST_DUE → ACTIVE:**
- Trigger: Payment successful
- Action: Restore full access
- Notification: Payment successful email

**PAST_DUE → SUSPENDED:**
- Trigger: 7 days past due
- Action: Suspend account
- Notification: Account suspended email

**SUSPENDED → ACTIVE:**
- Trigger: Payment successful
- Action: Restore full access
- Notification: Account reactivated email

**ACTIVE → CANCELLED:**
- Trigger: User cancellation
- Action: End of period cancellation
- Notification: Cancellation confirmation email

---

## 5. BILLING GOVERNANCE

### 5.1 Billing Cycle

**Monthly:**
- Billing date: Same day each month
- Proration: Yes (upgrades/downgrades)
- Invoice: Sent via email
- Payment: Auto-charge

**Annual:**
- Billing date: Same day each year
- Discount: 20%
- Proration: Yes (mid-term changes)
- Invoice: Sent via email
- Payment: Auto-charge

### 5.2 Payment Methods

**Supported:**
- Mobile Money (Orange, M-Pesa, Moov)
- Credit/Debit Card (Visa, Mastercard)
- Bank Transfer
- PayPal (international)

**Payment Retry:**
- Retry 1: Immediately
- Retry 2: 24h later
- Retry 3: 48h later
- Retry 4: 72h later
- Account suspended after 4 failures

### 5.3 Invoicing

**Invoice Contents:**
- Invoice number (unique)
- Tenant information
- Plan details
- Billing period
- Amount (FCFA)
- Tax (if applicable)
- Payment method
- Payment date
- Due date

**Invoice Delivery:**
- Email (PDF)
- Platform download
- API access (ENTERPRISE+)

**Invoice Retention:**
- 7 years (legal requirement)
- Secure storage
- Audit trail

---

## 6. REVENUE RECOGNITION

### 6.1 Recognition Rules

**Monthly Plans:**
- Revenue recognized monthly
- At service delivery
- No deferred revenue

**Annual Plans:**
- Revenue recognized monthly
- Deferred revenue calculation
- Monthly recognition: Total / 12

### 6.2 Refund Accounting

**Full Refund:**
- Debit: Revenue
- Credit: Accounts Receivable

**Partial Refund:**
- Debit: Revenue (prorated)
- Credit: Accounts Receivable

---

## 7. COMPLIANCE

### 7.1 Legal Compliance

**Terms of Service:**
- Required for all plans
- Acceptance at signup
- Updates: 30 days notice

**Privacy Policy:**
- Required for all plans
- GDPR compliant
- Data processing agreement

**Service Level Agreement:**
- STARTER: Best effort
- BUSINESS: 99.5% uptime
- ENTERPRISE: 99.9% uptime
- ULTIMATE: 99.99% uptime

### 7.2 Financial Compliance

**Taxes:**
- VAT/GST collected where applicable
- Tax invoices provided
- Tax reports generated

**Audit Trail:**
- All billing events logged
- Immutable records
- 7 year retention

---

## 8. MONITORING & ALERTS

### 8.1 Key Metrics

**Revenue Metrics:**
- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- Churn Rate
- NRR (Net Revenue Retention)
- ARPU (Average Revenue Per User)

**Subscription Metrics:**
- Trial Conversion Rate
- Upgrade Rate
- Downgrade Rate
- Cancellation Rate
- Renewal Rate

**Payment Metrics:**
- Payment Success Rate
- Payment Failure Rate
- Average Days to Pay
- Outstanding AR

### 8.2 Alerts

**Critical:**
- Payment failure rate > 5%
- Churn rate > 5% (weekly)
- MRR drop > 10% (MoM)

**Warning:**
- Payment failure rate > 2%
- Trial conversion rate < 20%
- 10+ accounts past due

**Info:**
- New MRR milestone
- New customer milestone
- Plan upgrade completed

---

## 9. GOVERNANCE ROLES

### 9.1 Roles & Responsibilities

**Finance Manager:**
- Billing oversight
- Invoice management
- Refund approvals (< 100k FCFA)
- Revenue reporting

**Commercial Manager:**
- Discount approvals (< 20%)
- Contract negotiations
- Plan customizations
- Customer retention

**Super Admin:**
- Discount approvals (> 20%)
- Plan creation/modification
- Pricing changes
- Contract exceptions

### 9.2 Approval Matrix

| Action | Finance | Commercial | Super Admin |
|--------|---------|------------|-------------|
| Refund < 100k | ✅ | - | - |
| Refund > 100k | ✅ | ✅ | ✅ |
| Discount < 10% | - | ✅ | - |
| Discount 10-20% | - | ✅ | ✅ |
| Discount > 20% | - | - | ✅ |
| New Plan | ✅ | ✅ | ✅ |
| Price Change | ✅ | - | ✅ |
| Custom Contract | ✅ | ✅ | ✅ |

---

## 10. AUDIT & REPORTING

### 10.1 Audit Trail

**Events to Log:**
- Plan creation/modification
- Subscription changes
- Payment processing
- Refund processing
- Discount application
- Contract signing

**Retention:** 7 years

### 10.2 Reports

**Daily:**
- New subscriptions
- Cancellations
- Payments received
- Payment failures

**Weekly:**
- MRR/ARR report
- Churn analysis
- Trial conversion
- Revenue by plan

**Monthly:**
- Financial statements
- Revenue recognition
- Tax reports
- Customer acquisition cost

**Quarterly:**
- Business review
- Pricing analysis
- Competitive analysis
- Forecast vs actual

---

## CONCLUSION

Cette gouvernance assure un contrôle strict et professionnel des plans et abonnements Ekala.

**Points clés:**
- 4 plans clairement définis
- Pricing transparent
- Lifecycle géré
- Compliance assurée
- Monitoring en place

**Prochaine étape:** Implémentation du Plan System