# EKALA ONBOARDING JOURNEY
## Parcours d'Onboarding des Tenants

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Journey Specification  
**Objectif:** Maximiser le time-to-first-value et la conversion trial → paid

---

## 1. JOURNEY OVERVIEW

### 1.1 Objectif
Guider les nouveaux tenants de l'inscription à la pleine adoption en minimisant les frictions.

### 1.2 Journey Map

```
SIGNUP → VERIFY → SETUP → ACTIVATE → ADOPT → EXPAND
   ↓       ↓        ↓        ↓         ↓        ↓
 2min    5min     15min    1 jour    7 jours  30 jours
```

### 1.3 Success Metrics
- Time to First Value: < 24h
- Trial Conversion Rate: > 25%
- Onboarding Completion: > 80%
- Feature Adoption (Day 7): > 60%

---

## 2. STAGE 1: SIGNUP (2 minutes)

### 2.1 Entry Point
- Landing page: "Commencer gratuitement"
- CTA: "Essai gratuit 14 jours"

### 2.2 Signup Form

**Fields:**
- Nom complet (required)
- Email professionnel (required)
- Téléphone (required)
- Mot de passe (required)
- Nom de l'établissement (required)
- Type d'établissement (dropdown)
  - Restaurant
  - Bar
  - Hôtel
  - Fast-food
  - Café
  - Night club
  - Resort
- Pays (dropdown)
- Ville (text)
- Acceptation CGU (checkbox)

**Validation:**
- Email: Format check + domain check
- Password: Min 8 chars, 1 uppercase, 1 number
- Phone: Format par pays
- Establishment name: Min 3 chars

### 2.3 Experience

**Desktop:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Créez votre compte Ekala                                  │
│                                                             │
│  Nom complet                                               │
│  [Jean Dupont                                    ]          │
│                                                             │
│  Email                                                     │
│  [contact@restaurant.com                      ]          │
│                                                             │
│  Téléphone                                                 │
│  [+228 90 00 00 00                            ]          │
│                                                             │
│  Mot de passe                                              │
│  [••••••••••••••••                            ]          │
│                                                             │
│  Nom de l'établissement                                    │
│  [Restaurant Le Palmier                        ]          │
│                                                             │
│  Type d'établissement                                      │
│  [Restaurant ▾]                                            │
│                                                             │
│  Pays                                                      │
│  [Togo ▾]                                                  │
│                                                             │
│  [✓] J'accepte les CGU et la Privacy Policy               │
│                                                             │
│  [Créer mon compte →]                                      │
│                                                             │
│  Déjà un compte? [Se connecter]                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Mobile:**
- Full-screen form
- Large touch targets
- Auto-advance on completion

### 2.4 Actions
- Submit form
- Create tenant account
- Send verification email
- Redirect to verification page

### 2.5 Success Criteria
- Form completion rate: > 70%
- Email delivery rate: > 95%
- Verification rate: > 60%

---

## 3. STAGE 2: VERIFY (5 minutes)

### 3.1 Email Verification

**Email Template:**
```
Subject: Vérifiez votre adresse email - Ekala

Bonjour Jean,

Merci de vous être inscrit sur Ekala!

Veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous:

[Vérifier mon email →]

Ce lien expire dans 24 heures.

Si vous n'avez pas créé de compte, ignorez cet email.

L'équipe Ekala
```

**Verification Page:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Vérifiez votre email                                      │
│                                                             │
│  Nous avons envoyé un lien de vérification à:               │
│  contact@restaurant.com                                     │
│                                                             │
│  [Renvoier l'email]  [Modifier l'email]                    │
│                                                             │
│  Vous n'avez pas reçu l'email?                             │
│  • Vérifiez vos spams                                       │
│  • Vérifiez que l'adresse est correcte                      │
│  • Contactez support@ekala.com                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Phone Verification (Optional)

**SMS Template:**
```
Ekala: Votre code de vérification est: 123456
Valide pendant 10 minutes.
```

**Verification Form:**
- 6-digit code input
- Auto-submit on completion
- Resend code option

### 3.3 Actions
- Verify email token
- Verify phone code
- Mark tenant as verified
- Redirect to setup

### 3.4 Success Criteria
- Email verification rate: > 60%
- Phone verification rate: > 40%

---

## 4. STAGE 3: SETUP (15 minutes)

### 4.1 Setup Wizard

**Progress Indicator:**
```
Étape 2/4: Configuration de votre établissement
```

### 4.2 Step 1: Informations de base

**Fields:**
- Nom de l'établissement (pre-filled)
- Adresse
- Ville
- Pays
- Téléphone de l'établissement
- Site web (optional)
- Logo (upload)

**Preview:**
```
┌─────────────────────────────────────────────────────────────┐
│  Aperçu de votre profil                                    │
│                                                             │
│  [Logo]                                                     │
│  Restaurant Le Palmier                                      │
│  Lomé, Togo                                                 │
│  +228 90 00 00 00                                          │
│  www.lepalmier.tg                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Step 2: Configuration initiale

**Options:**
- Nombre de tables (slider: 1-50)
- Nombre d'utilisateurs (slider: 1-5)
- Devise: FCFA
- Langue: Français

**Defaults:**
- Tables: 10
- Users: 2
- Currency: FCFA
- Language: French

### 4.4 Step 3: Import des données (Optional)

**Options:**
- Importer depuis Excel
- Importer depuis CSV
- Commencer avec des données de démo
- Commencer vide

**Demo Data:**
- 20 produits
- 10 clients
- 5 catégories
- 10 tables

### 4.5 Step 4: Inviter l'équipe

**Fields:**
- Email des membres (multiple)
- Rôle par membre
  - Admin
  - Manager
  - Caissier
  - Serveur

**Message:**
```
Bonjour,

Jean Dupont vous a invité à rejoindre Restaurant Le Palmier sur Ekala.

[Accepter l'invitation →]
```

### 4.6 Actions
- Save configuration
- Create default data
- Send invitations
- Mark setup complete
- Redirect to dashboard

### 4.7 Success Criteria
- Setup completion rate: > 80%
- Team invitation acceptance: > 60%

---

## 5. STAGE 4: ACTIVATE (1 day)

### 5.1 First Login Experience

**Welcome Modal:**
```
┌─────────────────────────────────────────────────────────────┐
│  Bienvenue sur Ekala, Jean!                                 │
│                                                             │
│  Votre établissement est prêt!                              │
│                                                             │
│  Voici ce que vous pouvez faire maintenant:                 │
│                                                             │
│  ✓ Créer votre première commande                            │
│  ✓ Ajouter vos produits                                     │
│  ✓ Configurer vos tables                                    │
│  ✓ Inviter votre équipe                                     │
│                                                             │
│  [Commencer →]                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Interactive Tutorial

**Tutorial Steps:**

**Step 1: Créer une commande** (2 min)
- Click "Nouvelle commande"
- Select table
- Add products
- Submit order

**Step 2: Gérer les produits** (2 min)
- Go to Products
- Add new product
- Set price
- Upload image

**Step 3: Configurer les tables** (2 min)
- Go to Tables
- Add tables
- Set capacity
- Assign QR codes

**Step 4: Inviter l'équipe** (2 min)
- Go to Team
- Send invitations
- Assign roles

### 5.3 Quick Wins

**First Order Celebration:**
```
┌─────────────────────────────────────────────────────────────┐
│  🎉 Félicitations!                                          │
│                                                             │
│  Vous avez créé votre première commande!                    │
│                                                             │
│  Continuez comme ça!                                        │
│                                                             │
│  [Voir la commande →]                                       │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Actions
- Track tutorial completion
- Celebrate first actions
- Send welcome email
- Schedule follow-up emails

### 5.5 Success Criteria
- Tutorial completion: > 70%
- First order created: < 24h
- First product added: < 24h

---

## 6. STAGE 5: ADOPT (7 days)

### 6.1 Daily Engagement

**Day 1:**
- Email: "Bienvenue! Voici comment démarrer"
- In-app: Highlight key features
- Push: "Créez votre première commande"

**Day 2:**
- Email: "Astuce: Gagnez du temps avec les commandes rapides"
- In-app: Show keyboard shortcuts
- Push: "Vous avez 3 commandes en attente"

**Day 3:**
- Email: "Découvrez les rapports"
- In-app: Highlight reports section
- Push: "Votre rapport journalier est prêt"

**Day 4:**
- Email: "Invitez votre équipe"
- In-app: Show team management
- Push: "2 membres de l'équipe en attente"

**Day 5:**
- Email: "Maîtrisez Ekala en 5 minutes"
- In-app: Show advanced features
- Push: "Vous avez utilisé 50% de votre stockage"

**Day 6:**
- Email: "Besoin d'aide? Nous sommes là"
- In-app: Show help center
- Push: "Webinaire: Optimisez votre gestion"

**Day 7:**
- Email: "Une semaine avec Ekala - Comment ça se passe?"
- In-app: Show usage stats
- Push: "7 jours d'essai restants"

### 6.2 Feature Adoption Tracking

**Core Features:**
1. Order Management
2. Product Management
3. Customer Management
4. Inventory Management
5. Reports

**Adoption Goals:**
- Day 1: Orders (100%)
- Day 3: Products (80%)
- Day 5: Customers (60%)
- Day 7: Inventory (50%)
- Day 7: Reports (40%)

### 6.3 Milestones

**Milestone 1: First Order**
- Badge: "Première Commande"
- Reward: 10% discount on first upgrade

**Milestone 2: 10 Orders**
- Badge: "10 Commandes"
- Reward: Free onboarding call

**Milestone 3: First Report**
- Badge: "Analyste"
- Reward: Extended trial (7 days)

**Milestone 4: Team of 3**
- Badge: "Team Player"
- Reward: Priority support

### 6.4 Success Criteria
- Feature adoption (Day 7): > 60%
- Daily active users: > 80%
- Session duration: > 15 min

---

## 7. STAGE 6: EXPAND (30 days)

### 7.1 Trial End Preparation

**Day 10:**
- Email: "Vous avez 4 jours d'essai restants"
- In-app: Show upgrade CTA
- Push: "Débloquez toutes les fonctionnalités"

**Day 12:**
- Email: "3 jours d'essai restants - Offre spéciale"
- In-app: Show plan comparison
- Push: "20% de réduction si vous upgradez aujourd'hui"

**Day 14:**
- Email: "Dernier jour d'essai"
- In-app: Urgency CTA
- Push: "Votre essai se termine dans 24h"

### 7.2 Upgrade Flow

**Plan Selection:**
```
┌─────────────────────────────────────────────────────────────┐
│  Choisissez votre plan                                      │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ STARTER  │ │ BUSINESS │ │ENTERPRISE│ │ ULTIMATE │     │
│  │  15k     │ │  45k     │ │  120k    │ │  250k    │     │
│  │          │ │  [Best]  │ │          │ │          │     │
│  │          │ │          │ │          │ │          │     │
│  │ [Choose] │ │ [Choose] │ │ [Choose] │ │ [Choose] │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                             │
│  [Comparer les plans →]                                     │
└─────────────────────────────────────────────────────────────┘
```

**Payment:**
- Select payment method
- Enter payment details
- Confirm subscription
- Send invoice

**Confirmation:**
```
┌─────────────────────────────────────────────────────────────┐
│  🎉 Félicitations!                                          │
│                                                             │
│  Vous êtes maintenant sur le plan BUSINESS!                 │
│                                                             │
│  Votre facture: #INV-2026-001                               │
│  Montant: 45,000 FCFA                                       │
│                                                             │
│  [Accéder à mon tableau de bord →]                          │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Post-Upgrade

**Welcome Email:**
```
Subject: Bienvenue sur le plan BUSINESS!

Bonjour Jean,

Félicitations! Vous avez rejoint le plan BUSINESS.

Voici ce que vous pouvez faire maintenant:
• Gérer jusqu'à 25 utilisateurs
• Ajouter jusqu'à 10 succursales
• Accéder à l'API
• Bénéficier du support prioritaire

[Commencer →]
```

**Onboarding Call:**
- Schedule 30-min call
- Show advanced features
- Answer questions
- Provide best practices

### 7.4 Success Criteria
- Trial conversion rate: > 25%
- Upgrade within 7 days: > 15%
- Annual plan adoption: > 30%

---

## 8. ONBOARDING AUTOMATION

### 8.1 Email Sequences

**Sequence 1: Welcome (7 emails)**
- Day 0: Welcome email
- Day 1: Getting started guide
- Day 2: Feature highlight
- Day 3: Tips & tricks
- Day 5: Success stories
- Day 7: Check-in
- Day 10: Upgrade reminder

**Sequence 2: Feature Adoption (5 emails)**
- Day 1: Orders
- Day 3: Products
- Day 5: Customers
- Day 7: Reports
- Day 10: Advanced features

**Sequence 3: Upgrade (3 emails)**
- Day 10: Trial ending soon
- Day 12: Special offer
- Day 14: Last chance

### 8.2 In-App Messages

**Tooltips:**
- Contextual help
- Feature highlights
- Best practices

**Walkthroughs:**
- Step-by-step guides
- Interactive tutorials
- Video tutorials

**Notifications:**
- Milestone celebrations
- Usage tips
- Upgrade prompts

### 8.3 Push Notifications

**Web Push:**
- Order updates
- Stock alerts
- Payment confirmations

**Mobile Push:**
- Same as web
- Offline sync

---

## 9. SUCCESS METRICS

### 9.1 Funnel Metrics

```
Signup:      1000 visitors
  ↓ 70%      700 signups
Verify:      700 emails sent
  ↓ 60%      420 verified
Setup:       420 started
  ↓ 80%      336 completed
Activate:    336 logged in
  ↓ 90%      302 active
Adopt:       302 Day 7
  ↓ 60%      181 adopted
Convert:     181 trial end
  ↓ 25%      45 converted
```

### 9.2 Time Metrics

- Time to Signup: 2 min
- Time to Verify: 5 min
- Time to Setup: 15 min
- Time to First Order: < 24h
- Time to First Value: < 24h
- Time to Upgrade: 14 days (avg)

### 9.3 Quality Metrics

- Onboarding completion: > 80%
- Feature adoption (Day 7): > 60%
- Trial conversion: > 25%
- NPS (Day 30): > 40
- CSAT: > 4.5/5

---

## 10. FAILURE MODES

### 10.1 Drop-off Points

**Signup Drop-off:**
- Cause: Form too long
- Mitigation: Reduce fields, social login

**Verify Drop-off:**
- Cause: Email not received
- Mitigation: SMS fallback, resend option

**Setup Drop-off:**
- Cause: Too complex
- Mitigation: Demo data, skip option

**Activate Drop-off:**
- Cause: Unclear value
- Mitigation: Quick wins, tutorials

**Convert Drop-off:**
- Cause: Price too high
- Mitigation: Discounts, flexible plans

### 10.2 Recovery Actions

**Email 1: Incomplete Signup**
- Subject: "Vous avez oublié de terminer?"
- Action: Complete signup
- Incentive: 10% discount

**Email 2: Not Verified**
- Subject: "Vérifiez votre email"
- Action: Verify email
- Incentive: Extended trial (7 days)

**Email 3: Setup Incomplete**
- Subject: "Finalisez votre configuration"
- Action: Complete setup
- Incentive: Free onboarding call

**Email 4: Not Active**
- Subject: "Besoin d'aide?"
- Action: Schedule call
- Incentive: 30-min free consultation

**Email 5: Trial Ending**
- Subject: "Dernière chance"
- Action: Upgrade now
- Incentive: 20% discount

---

## CONCLUSION

Ce parcours d'onboarding maximise la conversion et le time-to-first-value.

**Points clés:**
- 6 étapes claires
- 24h pour la première valeur
- 7 jours pour l'adoption
- 14 jours pour la conversion
- Automation complète
- Recovery actions

**Prochaine étape:** Implémentation du onboarding flow