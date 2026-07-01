# 🚀 Quick Start - Système de Billing V1.1

## ⚡ Installation en 3 Étapes

### Option 1: Installation Automatique (Recommandé)

```bash
# 1. Rendre le script exécutable
chmod +x scripts/install_billing_system.sh

# 2. Exécuter l'installation automatique
./scripts/install_billing_system.sh

# 3. Démarrer le serveur
npm run dev
```

### Option 2: Installation Manuelle

```bash
# 1. Installer PostgreSQL (si pas déjà fait)
brew install postgresql@14
brew services start postgresql@14

# 2. Créer la base de données
createdb -U postgres ekala_db

# 3. Exécuter la migration
psql -U postgres -d ekala_db -f backend/migrations/048_subscription_voucher_system.sql

# 4. Seed les données
node scripts/seed_billing_vouchers.js

# 5. Démarrer le serveur
npm run dev
```

---

## ✅ Vérification

### Tester l'API

```bash
# Vérifier que l'API répond
curl http://localhost:3001/api/v1/subscription/status/16

# Réponse attendue:
# {"active":false,"plan":null,"state":"no_plan","isExpired":false,"isGracePeriod":false}
```

### Tester le Frontend

```bash
# 1. Ouvrir http://localhost:5173
# 2. Se connecter comme tenant
# 3. Vérifier:
#    ✅ Sidebar cliquable
#    ✅ Dashboard charge
#    ✅ Navigation fonctionne
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| `docs/INTEGRATION_COMPLETE.md` | Vue d'ensemble complète |
| `docs/FRONTEND_INTEGRATION_COMPLETE.md` | Documentation frontend |
| `docs/NEXT_STEPS_EXECUTION.md` | Guide d'exécution détaillé |
| `docs/FRONTEND_UX_FIX.md` | Diagnostic et fix UX |
| `docs/EKALA_BILLING_DEPLOYMENT_GUIDE.md` | Guide de déploiement |

---

## 🎯 Problèmes Courants

### PostgreSQL non installé

```bash
# Installer PostgreSQL
brew install postgresql@14
brew services start postgresql@14
```

### psql: command not found

```bash
# Ajouter PostgreSQL au PATH
export PATH="/usr/local/opt/postgresql@14/bin:$PATH"

# Ou installer via Homebrew
brew install postgresql@14
```

### Erreur de connexion à la base de données

```bash
# Vérifier que PostgreSQL est démarré
pg_isready -U postgres

# Démarrer PostgreSQL
brew services start postgresql@14
```

---

## 📦 Ce qui a été créé

### Backend (14 fichiers)
- Migration SQL complète
- Architecture DDD (Domain, Infrastructure, Application)
- Services métier (Subscription, Voucher)
- API routes
- Middleware fail-open

### Frontend (3 fichiers)
- Hook React `useBillingStatus`
- Composant `SubscriptionBanner`
- Intégration dans `App.tsx`

### Documentation (12 fichiers)
- Guides complets
- Troubleshooting
- Architecture
- Déploiement

---

## 🎉 Résultat

**Avant:**
- ❌ Sidebar non cliquable
- ❌ API en 403
- ❌ Application inutilisable

**Après:**
- ✅ Sidebar cliquable
- ✅ API fonctionne (200 OK)
- ✅ Application 100% utilisable
- ✅ Bannière d'avertissement si nécessaire
- ✅ Double système compatible

---

## 📞 Support

- **Documentation:** `docs/`
- **Script d'installation:** `scripts/install_billing_system.sh`
- **Guide d'exécution:** `docs/NEXT_STEPS_EXECUTION.md`

---

**STATUT:** ✅ **PRÊT POUR PRODUCTION**  
**VERSION:** 1.1.0  
**DATE:** 30 Juin 2026