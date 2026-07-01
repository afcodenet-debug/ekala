# 🔧 Troubleshooting - Problèmes Courants

## 📋 Problèmes Identifiés et Solutions

---

## ❌ Problème 1: PostgreSQL ne démarre pas

### Symptôme
```bash
pg_isready -U postgres
/tmp:5432 - no response

psql -U postgres -d ekala_db
psql: error: connection to server on socket "/tmp/.s.PGSQL.5432" failed
```

### Cause
PostgreSQL n'est pas démarré sur votre Mac.

### Solution

#### Option 1: Démarrer PostgreSQL (Recommandé)
```bash
# Démarrer PostgreSQL
brew services start postgresql@14

# Vérifier qu'il est démarré
pg_isready -U postgres

# Résultat attendu:
# /usr/local/var/postgresql@14:5432 - accepting connections
```

#### Option 2: Si PostgreSQL n'est pas installé
```bash
# Installer PostgreSQL
brew install postgresql@14

# Démarrer le service
brew services start postgresql@14

# Initialiser la base de données (première fois seulement)
initdb /usr/local/var/postgresql@14
```

#### Option 3: Démarrer manuellement (pour tests)
```bash
# Démarrer PostgreSQL en arrière-plan
pg_ctl -D /usr/local/var/postgresql@14 start

# Ou démarrer en mode console (voir les logs)
pg_ctl -D /usr/local/var/postgresql@14 -l logfile start
```

### Vérification
```bash
# Vérifier que PostgreSQL est démarré
pg_isready -U postgres

# Doit afficher:
# /usr/local/var/postgresql@14:5432 - accepting connections
```

---

## ❌ Problème 2: Script seed_dev_subscription.js non trouvé

### Symptôme
```bash
node scripts/seed_dev_subscription.js
node:internal/modules/cjs/loader:1459
  throw err;
  ^

Error: Cannot find module '/Users/meyinzaji/scripts/seed_dev_subscription.js'
```

### Cause
Vous avez exécuté la commande depuis le mauvais répertoire (`~` au lieu du projet).

### Solution

#### Option 1: Se déplacer dans le répertoire du projet
```bash
# Se déplacer dans le répertoire du projet
cd /Users/meyinzaji/Codes/reactjs/great_olive

# Exécuter le script
node scripts/seed_dev_subscription.js
```

#### Option 2: Utiliser le chemin complet
```bash
# Depuis n'importe où
node /Users/meyinzaji/Codes/reactjs/great_olive/scripts/seed_dev_subscription.js
```

#### Option 3: Utiliser le script d'installation automatique
```bash
# Se déplacer dans le projet
cd /Users/meyinzaji/Codes/reactjs/great_olive

# Rendre le script exécutable
chmod +x scripts/install_billing_system.sh

# Exécuter l'installation complète
./scripts/install_billing_system.sh
```

### Vérification
```bash
# Vérifier que le script existe
ls -la scripts/seed_dev_subscription.js

# Doit afficher:
# -rw-r--r--  1 meyinzaji  staff  1234 Jun 30 13:00 scripts/seed_dev_subscription.js
```

---

## ❌ Problème 3: Erreur UNAUTHORIZED sur les APIs

### Symptôme
```bash
curl http://localhost:3001/api/v1/subscription/status/16
{"error":"UNAUTHORIZED","message":"Token d'authentification requis. Veuillez vous connecter."}

curl http://localhost:5173/api/tables
{"error":"UNAUTHORIZED","message":"Token d'authentification requis. Veuillez vous connecter."}
```

### Cause
Les APIs nécessitent un token JWT valide. C'est un comportement NORMAL.

### Solution

#### Pour tester sans authentification (développement uniquement)

**Option 1: Tester avec un token valide**
```bash
# 1. Se connecter via le frontend pour obtenir un token
# 2. Copier le token depuis les cookies/localStorage
# 3. Tester avec le token

curl http://localhost:3001/api/v1/subscription/status/16 \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

**Option 2: Tester via le frontend (Recommandé)**
```bash
# 1. Démarrer le backend
npm run dev

# 2. Démarrer le frontend (dans un autre terminal)
npm run dev:frontend

# 3. Ouvrir http://localhost:5173
# 4. Se connecter avec un compte tenant
# 5. Les APIs fonctionneront automatiquement
```

**Option 3: Créer un token de test (DEV ONLY)**
```bash
# Générer un token JWT de test (pour développement uniquement)
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { 
    user_id: 16, 
    tenant_id: 16, 
    role: 'admin',
    email: 'dev@test.com'
  },
  'votre_secret_key',
  { expiresIn: '24h' }
);
console.log('Token:', token);
"
```

### Vérification
```bash
# Tester avec un token valide
curl http://localhost:3001/api/v1/subscription/status/16 \
  -H "Authorization: Bearer VOTRE_TOKEN"

# Résultat attendu (sans subscription):
# {"active":false,"plan":null,"state":"no_plan","isExpired":false,"isGracePeriod":false}

# Résultat attendu (avec subscription ACTIVE):
# {"active":true,"plan":"basic","state":"active","isExpired":false,"isGracePeriod":false}
```

---

## ✅ Procédure Complète de Test

### Étape 1: Démarrer PostgreSQL
```bash
# Démarrer PostgreSQL
brew services start postgresql@14

# Vérifier
pg_isready -U postgres
```

### Étape 2: Créer la base de données et exécuter les migrations
```bash
# Se déplacer dans le projet
cd /Users/meyinzaji/Codes/reactjs/great_olive

# Créer la base de données
createdb -U postgres ekala_db

# Exécuter la migration
psql -U postgres -d ekala_db -f backend/migrations/048_subscription_voucher_system.sql
```

### Étape 3: Seed les données
```bash
# Depuis le répertoire du projet
node scripts/seed_billing_vouchers.js

# Puis créer la subscription DEV
node scripts/seed_dev_subscription.js
```

### Étape 4: Démarrer l'application
```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
npm run dev:frontend
```

### Étape 5: Tester
```bash
# 1. Ouvrir http://localhost:5173
# 2. Se connecter comme tenant 16
# 3. Vérifier:
#    ✅ Sidebar cliquable
#    ✅ Dashboard charge
#    ✅ Navigation fonctionne
#    ✅ Pas d'erreur SUBSCRIPTION_REQUIRED
```

---

## 🎯 Commandes de Vérification Rapide

```bash
# 1. Vérifier PostgreSQL
pg_isready -U postgres

# 2. Vérifier la base de données
psql -U postgres -d ekala_db -c "SELECT COUNT(*) FROM plans;"
# Doit retourner: 3

# 3. Vérifier les vouchers
psql -U postgres -d ekala_db -c "SELECT COUNT(*) FROM vouchers;"
# Doit retourner: 23

# 4. Vérifier la subscription tenant 16
psql -U postgres -d ekala_db -c "SELECT * FROM subscriptions WHERE tenant_id = 16;"
# Doit retourner: 1 ligne avec status = 'ACTIVE'

# 5. Tester le backend (avec token)
curl http://localhost:3001/api/v1/subscription/status/16 \
  -H "Authorization: Bearer VOTRE_TOKEN"

# 6. Tester le proxy Vite (avec token)
curl http://localhost:5173/api/tables \
  -H "Authorization: Bearer VOTRE_TOKEN"
```

---

## 🐛 Autres Problèmes Courants

### Problème: Port 3001 déjà utilisé
```bash
# Trouver le processus
lsof -ti:3001

# Tuer le processus
kill -9 $(lsof -ti:3001)

# Ou changer le port dans .env
PORT=3002
```

### Problème: Port 5173 déjà utilisé
```bash
# Trouver le processus
lsof -ti:5173

# Tuer le processus
kill -9 $(lsof -ti:5173)

# Ou changer le port dans vite.config.ts
server: {
  port: 5174
}
```

### Problème: Module not found
```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Problème: Erreur de compilation TypeScript
```bash
# Nettoyer le cache
npm run clean

# Recompiler
npm run build
```

---

## 📞 Support

### Documentation
- `docs/QUICK_START.md` - Guide de démarrage rapide
- `docs/CRITICAL_FIXES.md` - Analyse des problèmes
- `docs/FINAL_SUMMARY.md` - Vue d'ensemble

### Scripts Utiles
```bash
# Installation automatique
./scripts/install_billing_system.sh

# Seed subscription DEV
node scripts/seed_dev_subscription.js

# Seed plans + vouchers
node scripts/seed_billing_vouchers.js
```

---

## ✅ Checklist de Démarrage

- [ ] PostgreSQL installé (`brew install postgresql@14`)
- [ ] PostgreSQL démarré (`brew services start postgresql@14`)
- [ ] Base de données créée (`createdb -U postgres ekala_db`)
- [ ] Migration SQL exécutée
- [ ] Script `seed_billing_vouchers.js` exécuté
- [ ] Script `seed_dev_subscription.js` exécuté
- [ ] Backend démarré (`npm run dev`)
- [ ] Frontend démarré (`npm run dev:frontend`)
- [ ] Application accessible sur http://localhost:5173
- [ ] Connexion réussie comme tenant 16
- [ ] Sidebar cliquable
- [ ] Dashboard charge

---

**STATUT:** 📋 **GUIDE DE TROUBLESHOOTING COMPLET**  
**PROBLÈMES COURANTS:** 3 problèmes + solutions  
**DATE:** 30 Juin 2026