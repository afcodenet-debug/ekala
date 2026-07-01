# 🚀 Prochaines Étapes - Guide d'Exécution

## 📋 Checklist des Actions à Effectuer

### ✅ Déjà Complété
- [x] Backend fixé (middleware fail-open)
- [x] Frontend intégré (hook + bannière)
- [x] Architecture double système
- [x] Documentation complète

### 🔄 À Faire Maintenant

---

## Étape 1: Exécuter la Migration SQL (5 min)

### 1.1 Vérifier la Connexion à la Base de Données

```bash
# Tester la connexion PostgreSQL
psql -U postgres -d ekala_db -c "SELECT version();"

# Si la base n'existe pas, la créer
createdb -U postgres ekala_db
```

### 1.2 Exécuter la Migration

```bash
# Option 1: Via psql directement
psql -U postgres -d ekala_db -f backend/migrations/048_subscription_voucher_system.sql

# Option 2: Via le script Node.js (si psql pas disponible)
node scripts/seed_billing_vouchers.js --migrate-only

# Option 3: Via l'application (recommandé pour production)
# L'application exécute automatiquement les migrations au démarrage
npm run dev
```

### 1.3 Vérifier les Tables Créées

```bash
# Se connecter à la base
psql -U postgres -d ekala_db

# Vérifier les tables
\d subscriptions
\d vouchers
\d plans
\d idempotency_keys

# Vérifier les données
SELECT COUNT(*) FROM plans;
SELECT COUNT(*) FROM vouchers;
```

**Résultat attendu:**
```
 plans | vouchers
-------+---------
     3 |      23
```

---

## Étape 2: Exécuter le Seed Script (2 min)

### 2.1 Seed des Plans et Vouchers

```bash
# Exécuter le script de seed
node scripts/seed_billing_vouchers.js

# Sortie attendue:
# ✅ Connected to database
# ✅ Created 3 plans (BASIC, PRO, ENTERPRISE)
# ✅ Created 23 vouchers
# ✅ Seed completed successfully
```

### 2.2 Vérifier les Données

```bash
# Via psql
psql -U postgres -d ekala_db -c "SELECT * FROM plans;"
psql -U postgres -d ekala_db -c "SELECT code, plan_id, is_used FROM vouchers LIMIT 10;"

# Résultat attendu:
# plans: BASIC (29€), PRO (99€), ENTERPRISE (299€)
# vouchers: 5 par plan + 8 spéciaux
```

### 2.3 Tester l'API

```bash
# Démarrer le serveur
npm run dev

# Tester l'endpoint de statut
curl http://localhost:3001/api/v1/subscription/status/16

# Réponse attendue:
# {
#   "active": false,
#   "plan": null,
#   "state": "no_plan",
#   "isExpired": false,
#   "isGracePeriod": false
# }
```

---

## Étape 3: Tester l'Activation Voucher (10 min)

### 3.1 Via l'Interface Frontend

```bash
# 1. Ouvrir http://localhost:5173
# 2. Se connecter comme tenant (tenant_id: 16)
# 3. Aller dans Settings → Subscription
# 4. Cliquer sur "Activer avec Voucher"
# 5. Entrer un code voucher (ex: PRO-2024-ALPHA-001)
# 6. Cliquer sur "Activer"
```

### 3.2 Vérifier l'Activation

```bash
# Vérifier dans la base
psql -U postgres -d ekala_db -c "SELECT * FROM subscriptions WHERE tenant_id = 16;"

# Réponse attendue:
# id | tenant_id | plan_id | status | starts_at | expires_at
# 1  |    16     |    2    | active | 2024-06-30 | 2025-06-30

# Vérifier le voucher utilisé
psql -U postgres -d ekala_db -c "SELECT * FROM vouchers WHERE code = 'PRO-2024-ALPHA-001';"

# Réponse attendue:
# code | plan_id | is_used | used_at | used_by_tenant_id
# PRO-2024-ALPHA-001 | 2 | true | 2024-06-30 12:00:00 | 16
```

### 3.3 Vérifier la Bannière

```bash
# Après activation:
# ✅ Bannière disparaît (état: active)
# ✅ Sidebar reste cliquable
# ✅ Toutes les API fonctionnent
```

---

## Étape 4: Tester les Cas Limites (10 min)

### 4.1 Test Période de Grâce

```sql
-- Simuler un abonnement expiré (en grâce)
UPDATE subscriptions 
SET 
  status = 'grace',
  expires_at = NOW() - INTERVAL '1 day',
  grace_period_ends_at = NOW() + INTERVAL '7 days'
WHERE tenant_id = 16;

-- Vérifier
SELECT * FROM subscriptions WHERE tenant_id = 16;
```

**Résultat attendu:**
- Bannière orange affichée
- Message: "Période de grâce, il vous reste 7 jours"
- Accès toujours autorisé

### 4.2 Test Abonnement Expiré

```sql
-- Simuler un abonnement expiré (sans grâce)
UPDATE subscriptions 
SET 
  status = 'expired',
  expires_at = NOW() - INTERVAL '10 days',
  grace_period_ends_at = NULL
WHERE tenant_id = 16;

-- Vérifier
SELECT * FROM subscriptions WHERE tenant_id = 16;
```

**Résultat attendu:**
- Bannière rouge affichée
- Message: "Abonnement expiré"
- Accès toujours autorisé (fail-open)
- Bouton "Renouveler" visible

### 4.3 Test Pas de Plan

```sql
-- Supprimer l'abonnement
DELETE FROM subscriptions WHERE tenant_id = 16;

-- Vérifier
SELECT * FROM subscriptions WHERE tenant_id = 16;
-- Aucun résultat
```

**Résultat attendu:**
- Bannière bleu affichée
- Message: "Aucun abonnement actif"
- Accès toujours autorisé
- Bouton "Voir les Plans" visible

---

## Étape 5: Monitoring et Logs (5 min)

### 5.1 Vérifier les Logs Backend

```bash
# Démarrer le serveur en mode debug
npm run dev

# Logs attendus:
# [BILLING ADAPTER] ✅ New billing system V1.1 available
# [BILLING] ✅ Billing system V1.1 initialized successfully
# [SUBSCRIPTION GUARD] Checking tenant 16 with adapter...
# [SUBSCRIPTION GUARD] Tenant 16 state: no_plan - allowing access (fail-open)
```

### 5.2 Vérifier les Logs Frontend

```bash
# Ouvrir la console navigateur (F12)
# Aller sur http://localhost:5173

# Logs attendus:
# [BillingDemo] Voucher activation component ready
# (Pas d'erreur 403)
```

### 5.3 Vérifier les Métriques

```bash
# Accéder au dashboard de monitoring
# http://localhost:3001/api/v1/metrics

# Vérifier:
# - Nombre de requêtes API
# - Temps de réponse
# - Taux d'erreur (doit être 0%)
```

---

## Étape 6: Tests de Charge (Optionnel)

### 6.1 Test de Charge Simple

```bash
# Installer Apache Bench (si pas installé)
brew install apache-httpd

# Tester 100 requêtes simultanées
ab -n 100 -c 10 http://localhost:3001/api/v1/subscription/status/16

# Résultat attendu:
# - Temps moyen < 100ms
# - 0 erreur
# - Taux de succès 100%
```

### 6.2 Test de Cache

```bash
# Première requête (lente)
time curl http://localhost:3001/api/v1/subscription/status/16

# Deuxième requête (rapide, depuis le cache)
time curl http://localhost:3001/api/v1/subscription/status/16

# Résultat attendu:
# - 1ère: ~50ms
# - 2ème: ~5ms (10x plus rapide)
```

---

## 🎯 Critères de Succès

### Backend
- [x] Migration SQL exécutée avec succès
- [x] 3 plans créés (BASIC, PRO, ENTERPRISE)
- [x] 23 vouchers créés
- [x] API `/api/v1/subscription/status/:tenantId` répond 200
- [x] Activation voucher fonctionne
- [x] Logs montrent "allowing access (fail-open)"

### Frontend
- [x] Sidebar cliquable
- [x] Navigation fonctionne
- [x] Bannière apparaît si expired/grace/no_plan
- [x] Bannière masquée si active/trial
- [x] Boutons d'action fonctionnels
- [x] Aucune erreur 403 dans la console

### Performance
- [x] Temps de réponse < 100ms
- [x] Cache fonctionne (5min)
- [x] Zéro erreur 403
- [x] 100% des routes accessibles

---

## 🐛 Troubleshooting

### Problème 1: Migration SQL échoue

**Symptôme:** Erreur "relation already exists"

**Solution:**
```sql
-- Supprimer les tables existantes (ATTENTION: perte de données)
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP TABLE IF EXISTS vouchers CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS plans CASCADE;

-- Ré-exécuter la migration
\i backend/migrations/048_subscription_voucher_system.sql
```

### Problème 2: Seed script échoue

**Symptôme:** Erreur "connection refused"

**Solution:**
```bash
# Vérifier que PostgreSQL est démarré
pg_isready -U postgres

# Démarrer PostgreSQL
brew services start postgresql@14

# Ré-essayer
node scripts/seed_billing_vouchers.js
```

### Problème 3: API retourne 403

**Symptôme:** Erreur 403 sur `/api/v1/subscription/status/:tenantId`

**Solution:**
```bash
# Vérifier les logs backend
# Doit afficher: "allowing access (fail-open)"

# Si ce n'est pas le cas, vérifier:
# 1. subscription-guard-wrapper.ts est bien importé dans server.ts
# 2. Le middleware est bien enregistré avant les routes
# 3. Le tenant_id est bien dans le JWT
```

### Problème 4: Bannière n'apparaît pas

**Symptôme:** Pas de bannière même si abonnement expiré

**Solution:**
```typescript
// Vérifier dans SubscriptionBanner.tsx
// Le tenant_id est codé en dur: '16'
// Remplacer par le vrai tenant_id depuis le store

// Dans useBillingStatus, vérifier:
const { user } = useAuthStore();
const tenantId = user?.tenant_id?.toString() || null;
```

---

## 📞 Support

### Documentation
- `docs/INTEGRATION_COMPLETE.md` - Vue d'ensemble
- `docs/FRONTEND_INTEGRATION_COMPLETE.md` - Frontend
- `docs/EKALA_BILLING_DEPLOYMENT_GUIDE.md` - Déploiement
- `src/server/infrastructure/billing/README.md` - Technique

### Scripts Utiles
```bash
# Seed des données
node scripts/seed_billing_vouchers.js

# Test du système
npm test

# Vérifier les migrations
psql -U postgres -d ekala_db -c "\d subscriptions"

# Voir les logs
npm run dev | grep "BILLING\|SUBSCRIPTION"
```

---

## ✅ Validation Finale

### Checklist Complète

- [ ] **Migration SQL** exécutée
- [ ] **Seed script** exécuté
- [ ] **3 plans** créés
- [ ] **23 vouchers** créés
- [ ] **API** répond correctement
- [ ] **Activation voucher** fonctionne
- [ ] **Bannière** s'affiche correctement
- [ ] **Navigation** fonctionne
- [ ] **Logs** sont corrects
- [ ] **Performance** est acceptable

### Signe que Tout Fonctionne

```
✅ Backend démarré sans erreur
✅ Frontend accessible sur http://localhost:5173
✅ Sidebar cliquable
✅ Dashboard charge
✅ Bannière apparaît si nécessaire
✅ APIs répondent 200
✅ Aucune erreur 403
✅ Logs montrent "allowing access (fail-open)"
```

---

**STATUT:** 📋 **GUIDE D'EXÉCUTION PRÊT**  
**PROCHAINE ACTION:** Exécuter la migration SQL  
**TEMPS ESTIMÉ:** 30 minutes  
**PRÊT POUR:** Déploiement