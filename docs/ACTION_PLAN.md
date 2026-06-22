# PLAN D'ACTION — SYSTÈME BILLING VOUCHER-FIRST

**Date**: 22 Juin 2026  
**Objectif**: Finaliser et déployer le système de billing  
**Durée estimée**: 3-4 semaines

---

## 🎯 ÉTAT ACTUEL

### ✅ COMPLÉTÉ (100%)
- [x] Audit complet du système existant
- [x] Interface client BillingPageV2 (5 états)
- [x] Routes API billing (request-voucher, payment-sent)
- [x] Routes API admin (verify, reject, list)
- [x] Service d'expiration automatique
- [x] Cron job expiration (toutes les 5min)
- [x] Templates emails (génération, expiration, validation, rejet)
- [x] Interface admin validation (AdminVouchersPage)
- [x] Documentation complète (5 rapports)

### ⏳ EN ATTENTE (0%)
- [ ] Intégration dans App.tsx
- [ ] Tests utilisateur
- [ ] Formation admins
- [ ] Déploiement production

---

## 📅 SEMAINE 1 — INTÉGRATION & TESTS (5 JOURS)

### Jour 1 — Intégration Frontend (2h)

**Objectif**: Intégrer BillingPageV2 et AdminVouchersPage

**Tâches**:
1. **Intégrer BillingPageV2** (30min)
   ```typescript
   // src/App.tsx
   import BillingPage from './pages/saas/BillingPageV2';
   <Route path="/billing" element={<BillingPage />} />
   ```

2. **Intégrer AdminVouchersPage** (30min)
   ```typescript
   // src/App.tsx
   import AdminVouchersPage from './pages/admin/AdminVouchersPage';
   <Route path="/admin/vouchers" element={<AdminVouchersPage />} />
   ```

3. **Ajouter lien dans Sidebar** (30min)
   ```typescript
   // src/components/Sidebar.tsx
   {user?.role === 'admin' && (
     <Link to="/admin/vouchers">
       <CreditCard size={18} />
       Validation paiements
     </Link>
   )}
   ```

4. **Tester navigation** (30min)
   - [ ] /billing accessible
   - [ ] /admin/vouchers accessible
   - [ ] Liens fonctionnent

**Validation**:
- ✅ Pages se chargent sans erreur
- ✅ Navigation fluide
- ✅ Responsive mobile/desktop

---

### Jour 2 — Tests Workflow Client (4h)

**Objectif**: Tester le workflow complet côté client

**Tâches**:
1. **Test État SUSPENDED** (1h)
   - [ ] Aller sur /billing?from=suspended
   - [ ] Vérifier alerte "Compte suspendu"
   - [ ] Vérifier grille de forfaits
   - [ ] Sélectionner un forfait
   - [ ] Vérifier badge de sélection

2. **Test Génération voucher** (1h)
   - [ ] Cliquer "Demander un code de paiement"
   - [ ] Vérifier code EKA-XXX généré
   - [ ] Tester bouton "Copier"
   - [ ] Vérifier informations (montant, dates)
   - [ ] Cliquer "J'ai effectué le paiement"

3. **Test ADMIN_VERIFICATION** (1h)
   - [ ] Vérifier countdown s'affiche
   - [ ] Vérifier countdown s'actualise (1s)
   - [ ] Vérifier auto-refresh (30s)
   - [ ] Tester bouton "Vérifier maintenant"

4. **Test État ACTIVE** (1h)
   - [ ] Admin valide le voucher
   - [ ] Vérifier transition vers ACTIVE
   - [ ] Vérifier quotas affichés
   - [ ] Vérifier message "Compte actif"

**Validation**:
- ✅ Workflow complet fonctionne
- ✅ Pas d'erreurs console
- ✅ UX fluide

---

### Jour 3 — Tests Workflow Admin (4h)

**Objectif**: Tester l'interface admin

**Tâches**:
1. **Test Liste demandes** (1h)
   - [ ] Aller sur /admin/vouchers
   - [ ] Vérifier filtre "Pending" par défaut
   - [ ] Vérifier compteurs
   - [ ] Tester chaque filtre (pending, payment_sent, verified, expired, rejected, all)
   - [ ] Vérifier cartes s'affichent

2. **Test Validation** (1h)
   - [ ] Cliquer "Valider" sur demande pending
   - [ ] Vérifier modale s'ouvre
   - [ ] Vérifier informations affichées
   - [ ] Confirmer validation
   - [ ] Vérifier succès
   - [ ] Vérifier status passe à "verified"
   - [ ] Vérifier email envoyé

3. **Test Rejet** (1h)
   - [ ] Cliquer "Rejeter" sur demande pending
   - [ ] Vérifier modale s'ouvre
   - [ ] Saisir raison du rejet
   - [ ] Confirmer rejet
   - [ ] Vérifier status passe à "rejected"
   - [ ] Vérifier email envoyé

4. **Test Synchronisation** (1h)
   - [ ] Valider un voucher
   - [ ] Vérifier SQLite mis à jour
   - [ ] Vérifier Supabase mis à jour
   - [ ] Vérifier tenant status = 'active'
   - [ ] Vérifier subscription créée

**Validation**:
- ✅ Interface admin fonctionnelle
- ✅ Actions valider/rejeter marchent
- ✅ Sync bidirectionnelle OK
- ✅ Emails envoyés

---

### Jour 4 — Tests Expiration (4h)

**Objectif**: Tester le système d'expiration automatique

**Tâches**:
1. **Test Expiration normale** (1h)
   - [ ] Créer un voucher
   - [ ] Modifier verification_deadline dans le passé
   - [ ] Attendre cron (5min max)
   - [ ] Vérifier status = 'expired'
   - [ ] Vérifier tenant = 'suspended'
   - [ ] Vérifier subscription = 'suspended'
   - [ ] Vérifier email envoyé

2. **Test Vérification avant expiration** (1h)
   - [ ] Créer un voucher
   - [ ] Admin valide avant expiration
   - [ ] Vérifier status = 'verified'
   - [ ] Vérifier cron ne l'expire pas

3. **Test Gestion d'erreurs** (1h)
   - [ ] Déconnecter Supabase
   - [ ] Lancer le cron
   - [ ] Vérifier erreur loggée
   - [ ] Vérifier serveur ne crash pas
   - [ ] Reconnecter Supabase
   - [ ] Vérifier retry fonctionne

4. **Test Compte à rebours** (1h)
   - [ ] Générer un voucher
   - [ ] Vérifier countdown s'affiche
   - [ ] Vérifier format HH:MM:SS
   - [ ] Attendre 1 minute
   - [ ] Vérifier countdown mis à jour

**Validation**:
- ✅ Expiration automatique fonctionne
- ✅ Emails d'expiration envoyés
- ✅ Gestion d'erreurs robuste
- ✅ Countdown précis

---

### Jour 5 — Tests E2E & Fix Bugs (4h)

**Objectif**: Tests end-to-end et corrections

**Tâches**:
1. **Scénario 1: Cas normal** (1h)
   - Tenant suspendu → demande code → admin valide → compte actif

2. **Scénario 2: Expiration** (1h)
   - Tenant suspendu → demande code → aucune validation → compte reste suspendu

3. **Scénario 3: Rejet** (1h)
   - Tenant suspendu → demande code → admin rejette → compte reste suspendu

4. **Scénario 4: Connexion coupée** (1h)
   - Déconnecter réseau → demande locale → reconnecter → sync fonctionne

**Validation**:
- ✅ Tous les scénarios passent
- ✅ Pas de bugs critiques
- ✅ Prêt pour déploiement

---

## 📅 SEMAINE 2 — NETTOYAGE & REFACTORING (5 JOURS)

### Jour 6 — Supprimer code hérité (4h)

**Objectif**: Éliminer les traces de l'ancien système

**Tâches**:
1. **Supprimer colonnes payment_method** (2h)
   ```sql
   -- SQLite
   ALTER TABLE subscriptions DROP COLUMN IF EXISTS payment_method;
   ALTER TABLE subscriptions DROP COLUMN IF EXISTS payment_reference;
   ALTER TABLE tenants DROP COLUMN IF EXISTS payment_method;
   ALTER TABLE tenants DROP COLUMN IF EXISTS payment_reference;
   
   -- Supabase (même chose)
   ```

2. **Mettre à jour code** (2h)
   - [ ] `saas.routes.ts` - Supprimer payment_method
   - [ ] `admin.subscriptions.ts` - Supprimer références
   - [ ] `BillingPage.tsx` - Supprimer historique payments

**Validation**:
- ✅ Colonnes supprimées
- ✅ Code mis à jour
- ✅ Pas de régression

---

### Jour 7 — Standardiser voucher_requests (4h)

**Objectif**: Utiliser uniquement voucher_requests

**Tâches**:
1. **Migrer données** (2h)
   ```sql
   INSERT INTO voucher_requests 
     (tenant_id, plan_id, voucher_code, customer_email, status, ...)
   SELECT 
     tenant_id, plan_id, voucher_code,
     (SELECT email FROM users WHERE id = requested_by),
     status, ...
   FROM subscription_payment_requests
   WHERE status NOT IN ('verified', 'rejected', 'expired');
   ```

2. **Supprimer fallback** (2h)
   - [ ] `billing.routes.ts` - Supprimer logique legacy
   - [ ] `entity-registry.ts` - Supprimer subscription_payment_request

**Validation**:
- ✅ Données migrées
- ✅ Fallback supprimé
- ✅ Une seule table

---

### Jour 8 — Repository pattern (4h)

**Objectif**: Éliminer duplication SQLite/Supabase

**Tâches**:
1. **Créer VoucherRequestRepository** (4h)
   ```typescript
   // src/server/repositories/voucher.repository.ts
   export class VoucherRequestRepository {
     async findById(id: number): Promise<VoucherRequest | null>
     async findByCode(code: string): Promise<VoucherRequest | null>
     async insert(data: CreateVoucherRequest): Promise<VoucherRequest>
     async updateStatus(id: number, status: string): Promise<void>
     async findPending(): Promise<VoucherRequest[]>
   }
   ```

2. **Refactorer routes** (2h)
   - [ ] billing.routes.ts
   - [ ] admin.subscriptions.ts
   - [ ] voucher-expiration.cron.ts

**Validation**:
- ✅ Repository fonctionnel
- ✅ Code dupliqué éliminé
- ✅ Tests passent

---

### Jour 9 — Variables d'environnement (2h)

**Objectif**: Externaliser la configuration

**Tâches**:
1. **Ajouter variables** (1h)
   ```bash
   # .env.example
   VOUCHER_CODE_PREFIX=EKA
   VOUCHER_VERIFICATION_DEADLINE_HOURS=24
   VOUCHER_EXPIRATION_HOURS=48
   VOUCHER_EXPIRATION_CRON_ENABLED=true
   ```

2. **Mettre à jour code** (1h)
   - [ ] billing.routes.ts
   - [ ] billing-expiration.service.ts

**Validation**:
- ✅ Variables fonctionnent
- ✅ Configuration externalisée

---

### Jour 10 — Tests & Documentation (4h)

**Objectif**: Tests automatisés et documentation

**Tâches**:
1. **Tests unitaires** (2h)
   - [ ] billing.routes.test.ts
   - [ ] admin.subscriptions.test.ts
   - [ ] billing-expiration.test.ts

2. **Documentation** (2h)
   - [ ] Guide utilisateur admin
   - [ ] Guide déploiement
   - [ ] Procédures de dépannage

**Validation**:
- ✅ Tests passent
- ✅ Documentation à jour

---

## 📅 SEMAINE 3 — AMÉLIORATIONS UX (5 JOURS)

### Jour 11-12 — i18n FR/EN (8h)

**Objectif**: Internationalisation

**Tâches**:
1. **Ajouter traductions** (4h)
   - [ ] fr.json - Traductions françaises
   - [ ] en.json - Traductions anglaises

2. **Remplacer textes hardcodés** (4h)
   - [ ] BillingPageV2.tsx
   - [ ] AdminVouchersPage.tsx

**Validation**:
- ✅ FR/EN fonctionnent
- ✅ Tous les textes traduits

---

### Jour 13-14 — Historique voucher_requests (8h)

**Objectif**: Afficher historique dans BillingPageV2

**Tâches**:
1. **Créer composant VoucherHistory** (4h)
   - [ ] Afficher 5 dernières demandes
   - [ ] Format: Date | Code | Montant | Statut
   - [ ] Couleurs par statut

2. **Intégrer dans BillingPageV2** (4h)
   - [ ] État ACTIVE: afficher historique
   - [ ] État SUSPENDED: afficher historique

**Validation**:
- ✅ Historique affiché
- ✅ Design cohérent

---

### Jour 15 — Notifications temps réel (4h)

**Objectif**: WebSocket/Realtime pour statut voucher

**Tâches**:
1. **Implémenter Supabase Realtime** (4h)
   ```typescript
   const channel = supabase
     .channel('voucher-updates')
     .on('postgres_changes', {
       event: 'UPDATE',
       table: 'voucher_requests',
       filter: `voucher_code=eq.${voucherCode}`
     }, (payload) => {
       if (payload.new.status === 'verified') {
         setBillingState('ACTIVE');
       }
     })
     .subscribe();
   ```

**Validation**:
- ✅ Notification temps réel
- ✅ Pas de polling nécessaire

---

## 📅 SEMAINE 4 — TESTS & DÉPLOIEMENT (5 JOURS)

### Jour 16-17 — Tests automatisés (8h)

**Objectif**: Couverture de tests

**Tâches**:
1. **Tests backend** (4h)
   - [ ] billing.routes.test.ts
   - [ ] admin.subscriptions.test.ts
   - [ ] billing-expiration.test.ts

2. **Tests frontend** (4h)
   - [ ] BillingPageV2.test.tsx
   - [ ] AdminVouchersPage.test.tsx

**Validation**:
- ✅ Coverage > 80%
- ✅ Tous les tests passent

---

### Jour 18 — Dashboard admin (4h)

**Objectif**: Statistiques et métriques

**Tâches**:
1. **Créer dashboard** (4h)
   - [ ] Graphique demandes par jour
   - [ ] Taux de validation
   - [ ] Délai moyen traitement
   - [ ] Top 10 tenants par CA

**Validation**:
- ✅ Dashboard fonctionnel
- ✅ Métriques à jour

---

### Jour 19 — Export/Reporting (4h)

**Objectif**: Export des données

**Tâches**:
1. **Export CSV** (2h)
   - [ ] Liste demandes
   - [ ] Filtres disponibles

2. **Rapport mensuel** (2h)
   - [ ] Email automatique
   - [ ] PDF généré

**Validation**:
- ✅ Export fonctionne
- ✅ Rapport envoyé

---

### Jour 20 — Déploiement production (4h)

**Objectif**: Mettre en production

**Tâches**:
1. **Backup** (30min)
   - [ ] Backup SQLite
   - [ ] Backup Supabase

2. **Migration** (1h)
   - [ ] Exécuter migrations SQLite
   - [ ] Exécuter migrations Supabase

3. **Déploiement** (1h)
   - [ ] Build frontend
   - [ ] Deploy backend
   - [ ] Vérifier variables d'environnement

4. **Tests production** (1h)
   - [ ] Tester workflow complet
   - [ ] Vérifier logs
   - [ ] Vérifier emails

5. **Monitoring** (30min)
   - [ ] Activer Sentry
   - [ ] Activer PostHog
   - [ ] Configurer alertes

**Validation**:
- ✅ Production fonctionnelle
- ✅ Monitoring actif
- ✅ Aucune erreur critique

---

## 📊 RÉSUMÉ PAR SEMAINE

### Semaine 1: Intégration & Tests
- **Durée**: 5 jours
- **Effort**: 18h
- **Priorité**: P0 (CRITIQUE)
- **Livrable**: Système fonctionnel et testé

### Semaine 2: Nettoyage & Refactoring
- **Durée**: 5 jours
- **Effort**: 16h
- **Priorité**: P1 (IMPORTANT)
- **Livrable**: Code propre et maintenable

### Semaine 3: Améliorations UX
- **Durée**: 5 jours
- **Effort**: 20h
- **Priorité**: P2 (AMÉLIORATION)
- **Livrable**: UX moderne et internationale

### Semaine 4: Tests & Déploiement
- **Durée**: 5 jours
- **Effort**: 20h
- **Priorité**: P0 (CRITIQUE)
- **Livrable**: Production-ready

---

## ✅ CHECKLIST GLOBALE

### Fonctionnalités
- [x] Workflow voucher-first
- [x] 5 états client (SUSPENDED → ACTIVE)
- [x] Interface admin validation
- [x] Expiration automatique
- [x] Emails automatiques
- [ ] i18n FR/EN
- [ ] Historique voucher_requests
- [ ] Notifications temps réel
- [ ] Dashboard statistiques
- [ ] Export CSV/PDF

### Technique
- [x] SQLite comme source de vérité
- [x] Sync bidirectionnelle
- [x] Offline-first
- [x] Multitenant isolation
- [x] Audit trail
- [ ] Repository pattern
- [ ] Tests automatisés
- [ ] Monitoring

### Documentation
- [x] Audit complet
- [x] Architecture backoffice
- [x] Système expiration
- [x] Interface V2
- [ ] Guide utilisateur
- [ ] Guide déploiement
- [ ] Procédures dépannage

---

## 🚀 COMMANDES UTILES

### Développement
```bash
# Démarrer serveur
npm run dev

# Tests
npm test

# Build
npm run build
```

### Base de données
```bash
# Migration SQLite
npm run migrate:sqlite

# Migration Supabase
npm run migrate:supabase

# Backup
npm run backup:sqlite
npm run backup:supabase
```

### Déploiement
```bash
# Build production
npm run build:production

# Deploy
npm run deploy:production

# Vérifier
npm run health:check
```

---

## 📞 SUPPORT

### Documentation
- `docs/BILLING_AUDIT_REPORT.md` — Audit initial
- `docs/BILLING_V2_IMPLEMENTATION_REPORT.md` — Interface client
- `docs/ADMIN_VOUCHER_VALIDATION_ARCHITECTURE.md` — Interface admin
- `docs/BILLING_EXPIRATION_SYSTEM.md` — Système expiration
- `docs/IMPLEMENTATION_ROADMAP.md` — Feuille de route
- `docs/NEXT_STEPS.md` — Actions immédiates
- `docs/ACTION_PLAN.md` — CE DOCUMENT

### Contacts
- **Tech Lead**: Pour questions techniques
- **DevOps**: Pour déploiement
- **Product**: Pour fonctionnalités

---

## 🎯 PROCHAINE ACTION IMMÉDIATE

**COMMENCER MAINTENANT**:

1. Ouvrir `src/App.tsx`
2. Ajouter route `/admin/vouchers`
3. Tester sur http://localhost:5173/admin/vouchers
4. Valider l'interface admin

**Temps**: 30 minutes  
**Impact**: Élevé  
**Effort**: Faible

---

**Plan d'action prêt à être exécuté** 🚀

**Durée totale**: 3-4 semaines  
**Effort total**: ~74 heures  
**Priorité**: P0 (CRITIQUE)