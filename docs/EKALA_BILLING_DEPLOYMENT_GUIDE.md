# Guide de Déploiement - Système d'Abonnement V1.1

## 🚀 Déploiement en 5 Minutes

### Prérequis
- ✅ Migration SQL exécutée
- ✅ Base de données PostgreSQL accessible
- ✅ Variables d'environnement configurées

---

## Étape 1: Migration Database (2 min)

### Option A: Via psql (Recommandé)
```bash
psql -U your_user -d your_database -f backend/migrations/048_subscription_voucher_system.sql
```

### Option B: Via Supabase Dashboard
1. Aller dans Supabase Dashboard → SQL Editor
2. Copier-coller le contenu de `backend/migrations/048_subscription_voucher_system.sql`
3. Cliquer sur "Run"

### Vérification
```sql
-- Vérifier que les tables existent
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('subscriptions', 'vouchers', 'idempotency_records', 'plans');

-- Résultat attendu: 4 tables
```

---

## Étape 2: Seed des Données (1 min)

```bash
# Exécuter le script de seed
node scripts/seed_billing_vouchers.js
```

**Résultat attendu:**
```
📦 Seeding plans...
  ✅ Plan "Basic" created/updated
  ✅ Plan "Standard" created/updated
  ✅ Plan "Premium" created/updated

🎫 Seeding vouchers...
  ✅ 23 vouchers created

👤 Seeding sample subscription...
  ✅ Sample subscription created

📊 Database Stats:
  Plans: 3
  Vouchers: 23 (23 active, 0 used)
  Subscriptions: 1 (1 active)
```

---

## Étape 3: Variables d'Environnement (1 min)

Ajouter dans `.env` ou variables d'environnement du serveur:

```bash
# Billing System (optionnel - valeurs par défaut)
BILLING_RATE_LIMIT_WINDOW_MS=60000
BILLING_RATE_LIMIT_MAX_ATTEMPTS=5
```

**Note:** Le système fonctionne sans ces variables (valeurs par défaut utilisées).

---

## Étape 4: Démarrage du Serveur (1 min)

```bash
# Installation des dépendances (si nécessaire)
npm install

# Démarrage
npm run dev
# ou
npm start
```

**Logs attendus:**
```
[RENDER BOOT] Database schema initialized/verified.
[RENDER BOOT] Notification service initialized
[RENDER BOOT] Platform bootstrap completed
[RENDER BOOT] Billing system initialized
[BILLING] ✅ Billing system V1.1 initialized successfully
[BILLING] Available endpoints:
[BILLING]   POST /api/v1/subscription/activate
[BILLING]   GET  /api/v1/subscription/status/:tenantId
[BILLING]   GET  /api/v1/subscription/rate-limit/:tenantId
```

---

## Étape 5: Tests de Validation (1 min)

### Test 1: Vérifier que le service est actif
```bash
curl http://localhost:3001/health
```

**Réponse attendue:**
```json
{
  "ok": true,
  "ts": "2026-06-30T12:00:00.000Z"
}
```

### Test 2: Activer un abonnement
```bash
curl -X POST http://localhost:3001/api/v1/subscription/activate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "BASIC-2026-001",
    "tenant_id": "test-tenant-001",
    "idempotency_key": "test-idem-001"
  }'
```

**Réponse attendue:**
```json
{
  "status": "SUCCESS",
  "subscription": {
    "tenant_id": "test-tenant-001",
    "plan": "basic",
    "status": "ACTIVE",
    "end_date": "2026-07-30T12:00:00.000Z",
    "activation_source": "voucher"
  }
}
```

### Test 3: Vérifier le statut
```bash
curl http://localhost:3001/api/v1/subscription/status/test-tenant-001
```

**Réponse attendue:**
```json
{
  "active": true,
  "plan": "basic",
  "expires_at": "2026-07-30T12:00:00.000Z"
}
```

### Test 4: Vérifier le rate limiting
```bash
curl http://localhost:3001/api/v1/subscription/rate-limit/test-tenant-001
```

**Réponse attendue:**
```json
{
  "remaining": 4,
  "reset_after": 58
}
```

---

## ✅ Checklist de Déploiement

### Avant le déploiement
- [ ] Migration SQL exécutée avec succès
- [ ] Tables créées (4 tables)
- [ ] Script de seed exécuté
- [ ] Plans créés (3 plans)
- [ ] Vouchers créés (23 vouchers)
- [ ] Variables d'environnement configurées
- [ ] Serveur démarre sans erreur
- [ ] Logs billing présents

### Tests de validation
- [ ] Health check OK
- [ ] Activation voucher fonctionne
- [ ] Statut subscription retourné
- [ ] Rate limiting actif
- [ ] Double redemption bloquée
- [ ] Idempotency fonctionne

### Monitoring
- [ ] Logs applicatifs consultables
- [ ] Erreurs remontées
- [ ] Métriques DB disponibles

---

## 🎯 Scénarios de Test

### Scénario 1: Activation Réussie
```bash
# 1. Activer avec voucher valide
curl -X POST http://localhost:3001/api/v1/subscription/activate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "STANDARD-2026-001",
    "tenant_id": "tenant-scenario-1",
    "idempotency_key": "scen-1-idem"
  }'

# 2. Vérifier le statut
curl http://localhost:3001/api/v1/subscription/status/tenant-scenario-1

# 3. Réessayer avec même idempotency_key (doit retourner snapshot)
curl -X POST http://localhost:3001/api/v1/subscription/activate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "STANDARD-2026-001",
    "tenant_id": "tenant-scenario-1",
    "idempotency_key": "scen-1-idem"
  }'
```

### Scénario 2: Double Redemption (Doit Échouer)
```bash
# 1. Activer avec voucher
curl -X POST http://localhost:3001/api/v1/subscription/activate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PREMIUM-2026-001",
    "tenant_id": "tenant-scenario-2",
    "idempotency_key": "scen-2-idem"
  }'

# 2. Réessayer avec même voucher (doit échouer)
curl -X POST http://localhost:3001/api/v1/subscription/activate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PREMIUM-2026-001",
    "tenant_id": "tenant-scenario-3",
    "idempotency_key": "scen-2b-idem"
  }'
# Résultat: INVALID_VOUCHER (déjà utilisé)
```

### Scénario 3: Voucher Expiré (Doit Échouer)
```bash
# Créer un voucher expiré manuellement
psql -U user -d db -c "
  INSERT INTO vouchers (code, plan, duration_days, status, expires_at, created_at)
  VALUES ('EXPIRED-TEST', 'basic', 30, 'ACTIVE', NOW() - INTERVAL '1 day', NOW())
  ON CONFLICT (code) DO NOTHING;
"

# Tenter d'activer
curl -X POST http://localhost:3001/api/v1/subscription/activate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "EXPIRED-TEST",
    "tenant_id": "tenant-scenario-4",
    "idempotency_key": "scen-4-idem"
  }'
# Résultat: INVALID_VOUCHER (expiré)
```

### Scénario 4: Rate Limiting
```bash
# Faire 5 requêtes rapides
for i in {1..5}; do
  curl -X POST http://localhost:3001/api/v1/subscription/activate \
    -H "Content-Type: application/json" \
    -d '{
      "code": "BASIC-2026-00'$i'",
      "tenant_id": "tenant-rate-limit",
      "idempotency_key": "rate-limit-'$i'"
    }'
done

# 6ème requête doit échouer
curl -X POST http://localhost:3001/api/v1/subscription/activate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "BASIC-2026-006",
    "tenant_id": "tenant-rate-limit",
    "idempotency_key": "rate-limit-6"
  }'
# Résultat: RATE_LIMIT_EXCEEDED
```

---

## 🔧 Troubleshooting

### Problème 1: Tables non trouvées
**Erreur:** `relation "subscriptions" does not exist`

**Solution:**
```bash
# Vérifier que la migration a été exécutée
psql -U user -d db -c "\dt subscriptions"

# Si la table n'existe pas, exécuter la migration
psql -U user -d db -f backend/migrations/048_subscription_voucher_system.sql
```

### Problème 2: Billing system ne s'initialise pas
**Erreur:** `[RENDER BOOT] Billing system initialization failed`

**Solution:**
1. Vérifier les logs pour l'erreur exacte
2. Vérifier que `db` est disponible
3. Vérifier les imports dans `bootstrap.ts`
4. Vérifier que les repositories sont correctement implémentés

### Problème 3: Voucher ne fonctionne pas
**Erreur:** `INVALID_VOUCHER`

**Solutions possibles:**
- Voucher n'existe pas → Vérifier le code
- Voucher déjà utilisé → Status = 'USED'
- Voucher expiré → `expires_at < NOW()`
- Voucher pas ACTIF → Status doit être 'ACTIVE'

**Debug:**
```sql
-- Vérifier le voucher
SELECT * FROM vouchers WHERE code = 'VOTRE_CODE';

-- Vérifier les subscriptions
SELECT * FROM subscriptions WHERE tenant_id = 'VOTRE_TENANT_ID';
```

### Problème 4: Rate limiting trop strict
**Symptom:** Bloqué après 5 tentatives

**Solution:** Augmenter la limite dans `.env`:
```bash
BILLING_RATE_LIMIT_MAX_ATTEMPTS=10
BILLING_RATE_LIMIT_WINDOW_MS=120000  # 2 minutes
```

---

## 📊 Monitoring Post-Déploiement

### Logs à Surveiller
```
[BILLING] ✅ Billing system V1.1 initialized successfully
[BILLING] POST /api/v1/subscription/activate
[BILLING] Voucher TEST123 redeemed by tenant test-tenant
[BILLING] Subscription activated: tenant=test-tenant, plan=basic
```

### Métriques Importantes
- Nombre d'activations par jour
- Taux de succès vs échec
- Vouchers utilisés vs disponibles
- Erreurs rate limiting
- Temps de réponse API

### Requêtes SQL Utiles
```sql
-- Vouchers actifs disponibles
SELECT COUNT(*) FROM vouchers WHERE status = 'ACTIVE' AND expires_at > NOW();

-- Vouchers utilisés aujourd'hui
SELECT COUNT(*) FROM vouchers 
WHERE status = 'USED' 
AND used_at >= CURRENT_DATE;

-- Subscriptions actives
SELECT COUNT(*) FROM subscriptions WHERE status = 'ACTIVE';

-- Taux de réussite activation
SELECT 
  DATE(created_at) as date,
  COUNT(*) as activations
FROM subscriptions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🎓 Formation Équipe

### Points Clés à Communiquer

1. **Comment créer un voucher:**
   ```sql
   INSERT INTO vouchers (code, plan, duration_days, status, expires_at, created_at)
   VALUES ('NEW-VOUCHER', 'basic', 30, 'ACTIVE', NOW() + INTERVAL '90 days', NOW());
   ```

2. **Comment vérifier un abonnement:**
   ```bash
   curl http://localhost:3001/api/v1/subscription/status/:tenantId
   ```

3. **Comment gérer les erreurs:**
   - `INVALID_VOUCHER`: Code inexistant, expiré ou déjà utilisé
   - `RATE_LIMIT_EXCEEDED`: Trop de tentatives, attendre 1 minute
   - `SUBSCRIPTION_ERROR`: Erreur système, vérifier les logs

4. **Bonnes pratiques:**
   - Toujours utiliser un `idempotency_key` unique
   - Ne jamais révéler les codes voucher non utilisés
   - Surveiller les logs d'activation
   - Renouveler les vouchers avant expiration

---

## 📞 Support et Escalade

### Niveau 1: Vérifications de Base
1. Consulter les logs serveur
2. Vérifier la base de données
3. Tester avec curl/Postman

### Niveau 2: Investigation
1. Consulter `docs/EKALA_BILLING_SUBSCRIPTION_SYSTEM.md`
2. Vérifier les invariants critiques
3. Examiner les transactions DB

### Niveau 3: Escalade
1. Consulter `docs/EKALA_BILLING_INTEGRATION_GUIDE.md`
2. Vérifier le code source
3. Contacter l'équipe technique

---

## ✅ Post-Déploiement

### Dans les 24h
- [ ] Vérifier les logs d'activation
- [ ] Confirmer que les vouchers sont créés
- [ ] Tester un activation end-to-end
- [ ] Vérifier le rate limiting

### Dans la semaine
- [ ] Former l'équipe support
- [ ] Documenter les procédures
- [ ] Mettre en place le monitoring
- [ ] Planifier la prochaine phase (Stripe integration)

---

## 🎉 Félicitations!

Le système d'abonnement V1.1 est maintenant **en production**.

**Prochaine étape:** Former l'équipe et surveiller les premiers activations.

**Support:** Consulter la documentation complète dans `docs/`.