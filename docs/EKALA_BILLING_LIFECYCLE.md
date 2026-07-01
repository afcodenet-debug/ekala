# EKALA BILLING LIFECYCLE
## Cycle de Vie Complet de la Facturation

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Billing Specification  
**Objectif:** Gestion complète du cycle de facturation

---

## 1. BILLING LIFECYCLE OVERVIEW

### 1.1 Objectif
Gérer l'ensemble du cycle de facturation de la création à la clôture.

### 1.2 Lifecycle Map

```
CREATE → SEND → VIEW → PAY → CONFIRM → RECONCILE → REPORT
   ↓       ↓       ↓      ↓        ↓          ↓         ↓
 1min    1min    5min   1-7j     1min       1j        1mois
```

### 1.3 Success Metrics
- Invoice generation time: < 1 min
- Payment success rate: > 95%
- Days sales outstanding: < 30 days
- Reconciliation accuracy: 100%

---

## 2. STAGE 1: CREATE (1 minute)

### 2.1 Invoice Generation Triggers

**Automatic Triggers:**
- Subscription renewal (monthly/annual)
- Usage-based billing (overages)
- One-time charges (setup fees, add-ons)
- Trial conversion

**Manual Triggers:**
- Custom invoice (Super Admin)
- Credit note
- Refund invoice

### 2.2 Invoice Data Model

```typescript
interface Invoice {
  id: string;
  invoiceNumber: string; // INV-2026-001
  tenantId: number;
  subscriptionId: number;
  
  // Billing Period
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  
  // Amounts
  subtotal: number; // en centimes
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string; // FCFA
  
  // Line Items
  lineItems: LineItem[];
  
  // Status
  status: InvoiceStatus;
  
  // Payment
  paymentMethod: string;
  paymentTerms: string; // Net 30, Due on receipt
  
  // Dates
  issueDate: Date;
  dueDate: Date;
  paidAt: Date;
  
  // Metadata
  pdfUrl: string;
  notes: string;
  metadata: Record<string, any>;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate: number;
  taxAmount: number;
}
```

### 2.3 Invoice Numbering

**Format:** INV-YYYY-NNNN
- INV: Prefix
- YYYY: Year
- NNNN: Sequential number (4 digits)

**Example:** INV-2026-0042

**Reset:** Annual reset (January 1st)

### 2.4 Invoice Templates

**Template 1: Subscription Invoice**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  EKALA - Facture                                            │
│                                                             │
│  Facture #: INV-2026-0042                                   │
│  Date: 15 Janvier 2026                                      │
│  Échéance: 15 Février 2026                                 │
│                                                             │
│  Facturé à:                                                │
│  Restaurant Le Palmier                                      │
│  Jean Dupont                                                │
│  contact@restaurant.com                                     │
│  Lomé, Togo                                                 │
│                                                             │
│  ───────────────────────────────────────────────────────   │
│                                                             │
│  Description              Qté    Prix     Total            │
│  ───────────────────────────────────────────────────────   │
│  Plan BUSINESS Mensuel     1    45,000    45,000           │
│  Utilisateurs supplémentaires 2    5,000    10,000          │
│  ───────────────────────────────────────────────────────   │
│  Sous-total:                                   55,000 FCFA  │
│  Tax (18%):                                     9,900 FCFA  │
│  ───────────────────────────────────────────────────────   │
│  TOTAL:                                        64,900 FCFA  │
│                                                             │
│  Mode de paiement: Mobile Money (Orange)                   │
│                                                             │
│  Merci pour votre confiance!                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Template 2: Usage Invoice**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  EKALA - Facture d'Usage                                    │
│                                                             │
│  Facture #: INV-2026-0043                                   │
│  Période: 1-31 Janvier 2026                                │
│                                                             │
│  Facturé à: Restaurant Le Palmier                          │
│                                                             │
│  ───────────────────────────────────────────────────────   │
│                                                             │
│  Description              Qté    Prix     Total            │
│  ───────────────────────────────────────────────────────   │
│  API Calls (dépassement)  5,000    1 FCFA    5,000         │
│  Stockage supplémentaire  10 GB    1,000    10,000          │
│  ───────────────────────────────────────────────────────   │
│  TOTAL:                                        15,000 FCFA  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.5 Actions
- Generate invoice
- Calculate taxes
- Apply discounts
- Create PDF
- Save to database
- Queue for sending

### 2.6 Success Criteria
- Generation time: < 1 min
- Accuracy: 100%
- PDF generation: 100% success

---

## 3. STAGE 2: SEND (1 minute)

### 3.1 Delivery Channels

**Email (Primary):**
- To: billing@tenant.com
- CC: finance@tenant.com (if exists)
- From: billing@ekala.com
- Subject: "Facture Ekala #INV-2026-0042"

**Platform (Secondary):**
- Notification in app
- Download from Settings > Billing

**API (ENTERPRISE+):**
- Webhook notification
- API endpoint access

### 3.2 Email Template

**Subject:** Facture Ekala #INV-2026-0042 - Restaurant Le Palmier

**Body:**
```
Bonjour Jean,

Votre facture Ekala est prête.

Facture #: INV-2026-0042
Montant: 64,900 FCFA
Échéance: 15 Février 2026

[Télécharger la facture PDF →]

Payer maintenant:
[Mobile Money] [Carte Bancaire] [Virement]

Questions? Contactez billing@ekala.com

L'équipe Ekala
```

### 3.3 Delivery Tracking

**Status:**
- Pending: Queued for sending
- Sent: Delivered to email server
- Delivered: Confirmed delivery
- Opened: Email opened (tracking pixel)
- Clicked: Link clicked

**Retry Logic:**
- Retry 1: Immediately
- Retry 2: 1 hour later
- Retry 3: 24 hours later
- Mark as failed after 3 retries

### 3.4 Actions
- Send email
- Create notification
- Track delivery
- Schedule reminders

### 3.5 Success Criteria
- Delivery rate: > 98%
- Open rate: > 60%
- Click rate: > 30%

---

## 4. STAGE 3: VIEW (5 minutes)

### 4.1 Invoice Portal

**Access:**
- URL: https://app.ekala.com/billing/invoices
- Direct link from email
- From Settings > Billing

### 4.2 Invoice List View

```
┌─────────────────────────────────────────────────────────────┐
│  Mes Factures                                               │
│                                                             │
│  [Toutes] [Payées] [En attente] [En retard]               │
│                                                             │
│  #Facture    Date       Montant    Statut    Action        │
│  ───────────────────────────────────────────────────────   │
│  INV-0042    15 Jan     64,900     Payée     [PDF]         │
│  INV-0041    15 Déc     45,000     Payée     [PDF]         │
│  INV-0040    15 Nov     45,000     Payée     [PDF]         │
│  INV-0039    15 Oct     45,000     En attente [PDF] [Pay]  │
│  INV-0038    15 Sep     45,000     Payée     [PDF]         │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Invoice Detail View

```
┌─────────────────────────────────────────────────────────────┐
│  Facture #INV-2026-0042                                     │
│                                                             │
│  [Télécharger PDF] [Imprimer] [Envoyer]                    │
│                                                             │
│  Statut: ● Payée                                           │
│  Date d'émission: 15 Janvier 2026                          │
│  Date d'échéance: 15 Février 2026                          │
│  Date de paiement: 15 Janvier 2026                         │
│                                                             │
│  Facturé à:                                                │
│  Restaurant Le Palmier                                      │
│  Jean Dupont                                                │
│  contact@restaurant.com                                     │
│                                                             │
│  Détails:                                                  │
│  Plan BUSINESS Mensuel     45,000 FCFA                     │
│  Utilisateurs supp.       10,000 FCFA                     │
│  Sous-total               55,000 FCFA                     │
│  Tax (18%)                 9,900 FCFA                     │
│  ───────────────────────────────────────────────────────   │
│  TOTAL                    64,900 FCFA                     │
│                                                             │
│  Paiement:                                                 │
│  Méthode: Mobile Money (Orange)                            │
│  Transaction: TXN-123456789                                │
│  Date: 15 Janvier 2026                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Actions
- View invoice
- Download PDF
- Print invoice
- Resend invoice
- Pay now (if unpaid)

### 4.5 Success Criteria
- Load time: < 2s
- PDF download: < 3s
- Mobile friendly: 100%

---

## 5. STAGE 4: PAY (1-7 days)

### 5.1 Payment Methods

**Mobile Money (Primary - Africa):**
- Orange Money
- M-Pesa
- Moov Money
- Wave

**Credit/Debit Card:**
- Visa
- Mastercard
- American Express

**Bank Transfer:**
- Local banks
- International wires

**PayPal:**
- International customers

### 5.2 Payment Flow

**Step 1: Select Method**
```
┌─────────────────────────────────────────────────────────────┐
│  Payer la facture #INV-2026-0042                           │
│                                                             │
│  Montant: 64,900 FCFA                                      │
│                                                             │
│  Mode de paiement:                                         │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 📱 Mobile Money (Orange)                             │ │
│  │ 💳 Carte Bancaire                                    │ │
│  │ 🏦 Virement Bancaire                                 │ │
│  │ 💰 PayPal                                            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Step 2: Enter Details**

**Mobile Money:**
```
┌─────────────────────────────────────────────────────────────┐
│  Payer avec Mobile Money                                    │
│                                                             │
│  Numéro de téléphone:                                      │
│  [+228 90 00 00 00                            ]          │
│                                                             │
│  Vous recevrez un code de confirmation par SMS.            │
│                                                             │
│  [Payer 64,900 FCFA →]                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Card:**
```
┌─────────────────────────────────────────────────────────────┐
│  Payer par carte                                            │
│                                                             │
│  Numéro de carte:                                          │
│  [•••• •••• •••• ••••                          ]          │
│                                                             │
│  Expiration: [MM] / [YY]                                    │
│  CVV: [•••]                                                 │
│                                                             │
│  Nom sur la carte:                                         │
│  [JEAN DUPONT                              ]          │
│                                                             │
│  [Payer 64,900 FCFA →]                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Step 3: Confirm**

**Mobile Money:**
- Send payment request to provider
- User confirms on phone
- Wait for confirmation

**Card:**
- Process payment
- 3D Secure if required
- Immediate confirmation

### 5.3 Payment Processing

**States:**
```
PENDING → PROCESSING → COMPLETED
              ↓
           FAILED
```

**Processing Time:**
- Mobile Money: 30s - 2min
- Card: 5-30s
- Bank Transfer: 1-3 days

### 5.4 Payment Retry

**Automatic Retries:**
- Retry 1: Immediately
- Retry 2: 24h later
- Retry 3: 48h later
- Retry 4: 72h later

**Dunning Process:**
- Day 1: Payment failed email
- Day 2: Reminder email
- Day 4: Urgent reminder
- Day 7: Account suspension warning
- Day 8: Account suspended

### 5.5 Actions
- Process payment
- Update invoice status
- Send confirmation
- Update subscription status
- Trigger dunning if failed

### 5.6 Success Criteria
- Payment success rate: > 95%
- Processing time: < 2min
- Retry success rate: > 60%

---

## 6. STAGE 5: CONFIRM (1 minute)

### 6.1 Confirmation Email

**Subject:** Paiement confirmé - Facture #INV-2026-0042

**Body:**
```
Bonjour Jean,

Votre paiement a été confirmé!

Facture #: INV-2026-0042
Montant: 64,900 FCFA
Méthode: Mobile Money (Orange)
Transaction: TXN-123456789
Date: 15 Janvier 2026

[Télécharger le reçu →]

Merci pour votre confiance!

L'équipe Ekala
```

### 6.2 In-App Notification

```
┌─────────────────────────────────────────────────────────────┐
│  ✓ Paiement confirmé                                        │
│                                                             │
│  Facture #INV-2026-0042                                    │
│  64,900 FCFA payés avec succès                             │
│                                                             │
│  [Voir la facture →]                                        │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Receipt Generation

**Receipt Contents:**
- Receipt number
- Invoice number
- Payment details
- Amount paid
- Payment method
- Date
- Tenant information

**Delivery:**
- Email (PDF)
- Platform download
- SMS (optional)

### 6.4 Actions
- Send confirmation email
- Create receipt
- Update invoice status
- Update subscription status
- Trigger next billing

### 6.5 Success Criteria
- Confirmation time: < 1 min
- Delivery rate: > 98%
- Receipt generation: 100%

---

## 7. STAGE 6: RECONCILE (1 day)

### 7.1 Reconciliation Process

**Daily Reconciliation:**
```
1. Fetch all payments from payment providers
2. Match with internal invoices
3. Identify discrepancies
4. Resolve mismatches
5. Update accounting records
6. Generate reconciliation report
```

### 7.2 Matching Rules

**Exact Match:**
- Transaction ID matches
- Amount matches
- Date matches

**Fuzzy Match:**
- Amount matches (±1%)
- Date matches (±1 day)
- Tenant matches

**Manual Match:**
- Admin intervention
- Link payment to invoice

### 7.3 Discrepancy Handling

**Types:**
- Missing payment (paid but not recorded)
- Duplicate payment (recorded twice)
- Amount mismatch (different amounts)
- Wrong tenant (payment from wrong account)

**Resolution:**
- Auto-resolve: Exact matches
- Flag for review: Fuzzy matches
- Manual review: Discrepancies

### 7.4 Accounting Entries

**Payment Received:**
```
Debit: Bank Account (Mobile Money)
Credit: Accounts Receivable
```

**Revenue Recognition:**
```
Debit: Deferred Revenue
Credit: Revenue
```

### 7.5 Actions
- Fetch payments
- Match invoices
- Resolve discrepancies
- Update accounting
- Generate report

### 7.6 Success Criteria
- Reconciliation accuracy: 100%
- Discrepancy rate: < 0.1%
- Processing time: < 24h

---

## 8. STAGE 7: REPORT (1 month)

### 8.1 Financial Reports

**Daily Reports:**
- Payments received
- Payment failures
- Refunds processed
- Outstanding invoices

**Weekly Reports:**
- Revenue summary
- Payment method breakdown
- Aging report
- Cash flow forecast

**Monthly Reports:**
- Financial statements
- Revenue recognition
- Tax reports
- Customer acquisition cost

**Quarterly Reports:**
- Business review
- Pricing analysis
- Churn analysis
- LTV/CAC ratio

### 8.2 Report Templates

**Revenue Report:**
```
┌─────────────────────────────────────────────────────────────┐
│  Revenue Report - Janvier 2026                              │
│                                                             │
│  Total Revenue:          1,250,000 FCFA                    │
│  New Revenue:              125,000 FCFA                    │
│  Recurring Revenue:      1,125,000 FCFA                    │
│                                                             │
│  By Plan:                                                  │
│  - STARTER:   125,000 FCFA (10%)                          │
│  - BUSINESS:  625,000 FCFA (50%)                          │
│  - ENTERPRISE: 375,000 FCFA (30%)                        │
│  - ULTIMATE:  125,000 FCFA (10%)                          │
│                                                             │
│  By Country:                                               │
│  - Togo:      500,000 FCFA (40%)                          │
│  - Sénégal:   375,000 FCFA (30%)                          │
│  - Côte d'Ivoire: 250,000 FCFA (20%)                     │
│  - Others:    125,000 FCFA (10%)                          │
│                                                             │
│  Growth: +15% MoM                                          │
│  Churn: 2.5%                                               │
│  NRR: 115%                                                 │
└─────────────────────────────────────────────────────────────┘
```

**Aging Report:**
```
┌─────────────────────────────────────────────────────────────┐
│  Accounts Receivable Aging - 31 Janvier 2026               │
│                                                             │
│  Current (0-30 days):    850,000 FCFA (85%)               │
│  31-60 days:              95,000 FCFA (10%)               │
│  61-90 days:              35,000 FCFA (3%)                │
│  90+ days:                20,000 FCFA (2%)                │
│                                                             │
│  Total AR:            1,000,000 FCFA                      │
│  Average DSO:         28 days                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Report Distribution

**Automated:**
- Daily: Finance team
- Weekly: Management
- Monthly: Board
- Quarterly: Investors

**On-Demand:**
- Self-service portal
- API access (ENTERPRISE+)
- Custom reports

### 8.4 Actions
- Generate reports
- Distribute to stakeholders
- Archive for compliance
- Export to accounting software

### 8.5 Success Criteria
- Report accuracy: 100%
- Generation time: < 5 min
- Distribution rate: 100%

---

## 9. BILLING AUTOMATION

### 9.1 Automated Workflows

**Invoice Generation:**
- Trigger: Subscription renewal
- Action: Generate invoice
- Schedule: 1 day before billing

**Payment Processing:**
- Trigger: Invoice created
- Action: Auto-charge
- Schedule: On due date

**Reminders:**
- Trigger: Invoice due
- Action: Send reminder
- Schedule: 3, 7, 14 days after due

**Dunning:**
- Trigger: Payment failed
- Action: Retry + notify
- Schedule: Daily for 7 days

**Suspension:**
- Trigger: 7 days past due
- Action: Suspend account
- Schedule: Automatic

### 9.2 Cron Jobs

**Daily (00:00 UTC):**
- Generate daily invoices
- Process retries
- Send reminders
- Update aging

**Weekly (Monday 00:00 UTC):**
- Generate weekly reports
- Reconcile payments
- Update metrics

**Monthly (1st 00:00 UTC):**
- Generate monthly invoices
- Generate financial reports
- Archive old invoices

### 9.3 Monitoring

**Metrics:**
- Invoice generation success rate
- Payment success rate
- Average payment time
- Discrepancy rate
- Report generation time

**Alerts:**
- Payment failure rate > 5%
- Invoice generation failure
- Reconciliation discrepancy
- Report generation failure

---

## 10. TAX MANAGEMENT

### 10.1 Tax Calculation

**Tax Rates by Country:**
```json
{
  "TG": { "name": "TVA", "rate": 18 },
  "SN": { "name": "TVA", "rate": 18 },
  "CI": { "name": "TVA", "rate": 18 },
  "ML": { "name": "TVA", "rate": 18 },
  "BF": { "name": "TVA", "rate": 18 }
}
```

**Tax Calculation:**
```
Subtotal: 55,000 FCFA
Tax Rate: 18%
Tax Amount: 55,000 × 0.18 = 9,900 FCFA
Total: 55,000 + 9,900 = 64,900 FCFA
```

### 10.2 Tax Invoices

**Requirements:**
- Tax identification number
- Tax amount
- Tax rate
- Legal mention

**Template:**
```
TVA: 18%
NIF: 0123456789
Registre de commerce: RCCM-XXX-2026-A-001
```

### 10.3 Tax Reports

**Monthly Tax Report:**
- Total sales
- Total tax collected
- Tax by rate
- Tax by country

**Annual Tax Report:**
- Yearly summary
- Tax paid by country
- Deductible taxes

---

## 11. REFUND MANAGEMENT

### 11.1 Refund Policy

**Eligibility:**
- 30-day money-back guarantee
- SLA breach compensation
- Billing errors
- Service cancellation (prorated)

**Non-Eligible:**
- After 30 days (except SLA)
- Abuse detected
- Terms violation

### 11.2 Refund Process

**Step 1: Request**
- Customer request
- Admin review
- Approval required

**Step 2: Process**
- Full refund: Full amount
- Partial refund: Prorated amount
- Credit note: Future credit

**Step 3: Execute**
- Refund to original method
- Update invoice status
- Send confirmation

### 11.3 Refund Limits

**Auto-Approval:**
- < 100,000 FCFA: Finance Manager
- < 500,000 FCFA: Commercial Manager
- > 500,000 FCFA: Super Admin

**Time Limits:**
- Full refund: 30 days
- Partial refund: 90 days
- SLA breach: Unlimited

---

## 12. COMPLIANCE

### 12.1 Legal Requirements

**Invoicing:**
- Sequential numbering
- Legal mentions
- Tax identification
- Retention: 7 years

**Payment:**
- PCI DSS compliance (cards)
- Data encryption
- Secure storage

**Privacy:**
- GDPR compliance
- Data processing agreement
- Right to erasure

### 12.2 Audit Trail

**Events to Log:**
- Invoice creation
- Invoice sending
- Payment processing
- Refund processing
- Discount application
- Tax calculation

**Retention:** 7 years

---

## CONCLUSION

Ce cycle de facturation complet assure une gestion professionnelle et conforme.

**Points clés:**
- 7 étapes claires
- Automation complète
- Multi-méthodes de paiement
- Gestion fiscale
- Conformité assurée

**Prochaine étape:** Implémentation du billing system