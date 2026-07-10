# 📋 GUIDE DE VÉRIFICATION - CORRECTIONS MODE D'EXÉCUTION

**Date:** 2026-07-09  
**Statut:** ✅ CORRECTIONS APPLIQUÉES - EN ATTENTE DE TEST

---

## 🎯 OBJECTIF

Vérifier que l'application détecte correctement le mode **LOCAL** en développement et n'initialise pas le sync engine Supabase automatiquement.

---

## 🔧 CORRECTIONS APPLIQUÉES

### 1. ✅ Ajout de Logs de Diagnostic

**Fichier:** `src/server/server.ts` (lignes 1-10, 76-84)

**Modification:**
```typescript
// Chargement de dotenv avec logs
console.log('[RENDER BOOT] dotenv loaded successfully');
console.log('[RENDER BOOT] VITE_APP_MODE:', process.env.VITE_APP_MODE);
console.log('[RENDER BOOT] NODE_ENV:', process.env.NODE_ENV);
console.log('[RENDER BOOT] RENDER_CLOUD_MODE:', process.env.RENDER_CLOUD_MODE);

// Diagnostic du mode d'exécution
console.log('[RENDER BOOT] Runtime mode:', runtime.toString());
console.log('[RENDER BOOT] isLocal:', runtime.isLocal);
console.log('[RENDER BOOT] isCloud:', runtime.isCloud);
console.log('[RENDER BOOT] isHybrid:', runtime.isHybrid);
console.log('[RENDER BOOT] VITE_APP_MODE from process.env:', process.env.VITE_APP_MODE);
```

**Résultat attendu:**
```
[RENDER BOOT] dotenv loaded successfully
[RENDER BOOT] VITE_APP_MODE: local
[RENDER BOOT] NODE_ENV: development
[RENDER BOOT] RENDER_CLOUD_MODE: undefined
[RENDER BOOT] Runtime mode: RuntimeContext(mode=LOCAL, isLocal=true, isCloud=false, isHybrid=false)
[RENDER BOOT] isLocal: true
[RENDER BOOT] isCloud: false
[RENDER BOOT] isHybrid: false
```

### 2. ✅ Correction de l'Initialisation du Sync Engine

**Fichier:** `src/server/server.ts` (lignes 555-585)

**Modification:**
```typescript
// AVANT
if (!env.RENDER_CLOUD_MODE && db) {
  // ❌ Le sync engine s'initialise automatiquement si les credentials sont présents
}

// APRÈS
const shouldEnableSync = runtime.isCloud || process.env.ENABLE_SUPABASE_SYNC === 'true';

if (shouldEnableSync && !env.RENDER_CLOUD_MODE && db) {
  // ✅ Le sync engine ne s'initialise que si:
  // - Mode CLOUD, OU
  // - ENABLE_SUPABASE_SYNC=true explicitement
} else {
  if (!shouldEnableSync) {
    console.log(`[SyncV2] Sync engine disabled in ${runtime.mode} mode (set ENABLE_SUPABASE_SYNC=true to enable)`);
  }
}
```

**Résultat attendu en mode LOCAL:**
```
[SyncV2] Sync engine disabled in LOCAL mode (set ENABLE_SUPABASE_SYNC=true to enable)
```

### 3. ✅ Ajout de ENABLE_SUPABASE_SYNC au Schéma

**Fichier:** `src/server/config/env.ts` (ligne 11)

**Modification:**
```typescript
ENABLE_SUPABASE_SYNC: z.coerce.boolean().default(false),
```

**Résultat attendu:**
- La variable est maintenant reconnue par le schéma Zod
- Valeur par défaut: `false`

---

## 🧪 TESTS À EFFECTUER

### Test #1: Vérifier le Mode d'Exécution

**Démarrage du serveur:**
```bash
npm run dev:web
```

**Vérifier les logs:**
```bash
# Chercher ces lignes dans les logs:
[RENDER BOOT] dotenv loaded successfully
[RENDER BOOT] VITE_APP_MODE: local
[RENDER BOOT] Runtime mode: RuntimeContext(mode=LOCAL, isLocal=true, isCloud=false, isHybrid=false)
```

**✅ Succès si:**
- `VITE_APP_MODE: local` est affiché
- `Runtime mode` montre `mode=LOCAL`
- `isLocal: true`

**❌ Échec si:**
- `VITE_APP_MODE` est `undefined`
- `Runtime mode` montre `mode=CLOUD`

### Test #2: Vérifier que le Sync Engine est Désactivé

**Vérifier les logs:**
```bash
# Chercher cette ligne:
[SyncV2] Sync engine disabled in LOCAL mode (set ENABLE_SUPABASE_SYNC=true to enable)
```

**✅ Succès si:**
- Le message indique que le sync engine est désactivé en mode LOCAL
- Aucun log `[SyncV2] Engine initialized` n'apparaît

**❌ Échec si:**
- Le sync engine s'initialise malgré le mode LOCAL

### Test #3: Vérifier l'Authentification Locale

**Action:**
1. Aller sur `http://localhost:5173`
2. Entrer un tenant slug (ex: `great-olive`)
3. Cliquer sur "Se connecter"

**Vérifier:**
- La requête `/api/auth/tenants/great-olive` devrait réussir
- Le backend Express sur port 3001 doit répondre

**✅ Succès si:**
- Le tenant est résolu correctement
- Pas d'erreur `ERR_EMPTY_RESPONSE`

**❌ Échec si:**
- `GET http://localhost:5173/api/auth/tenants/great-olive net::ERR_EMPTY_RESPONSE`

### Test #4: Vérifier les Routes du Backend

**Tester directement avec curl:**
```bash
curl http://localhost:3001/api/auth/tenants/great-olive
```

**Résultat attendu:**
```json
{
  "id": 1,
  "name": "Great Olive",
  "slug": "great-olive",
  "status": "active",
  ...
}
```

**✅ Succès si:**
- La route répond avec un JSON valide
- Le tenant est trouvé dans la base SQLite

**❌ Échec si:**
- `curl: (7) Failed to connect` → Backend non démarré
- `404 Not Found` → Route manquante
- `500 Internal Server Error` → Erreur serveur

### Test #5: Vérifier le Frontend

**Ouvrir la console du navigateur (F12):**

**Vérifier:**
1. Pas d'erreurs `Failed to fetch`
2. Pas d'erreurs `net::ERR_EMPTY_RESPONSE`
3. Le tenant name s'affiche correctement

**✅ Succès si:**
- La page de login affiche le nom du tenant
- Aucune erreur réseau dans la console

**❌ Échec si:**
- `tenant_name persisté = "(undefined)"`
- Erreurs de fetch

---

## 📊 CHECKLIST DE VÉRIFICATION

### Côté Serveur (Backend)
- [ ] dotenv se charge correctement
- [ ] `VITE_APP_MODE: local` est affiché dans les logs
- [ ] `Runtime mode: LOCAL` est affiché
- [ ] `isLocal: true` est affiché
- [ ] Le sync engine est désactivé en mode LOCAL
- [ ] La route `/api/auth/tenants/:slug` répond correctement
- [ ] La base de données SQLite est accessible

### Côté Client (Frontend)
- [ ] L'application se charge sur `http://localhost:5173`
- [ ] Le tenant slug est résolu correctement
- [ ] Le nom du tenant s'affiche
- [ ] Aucune erreur `ERR_EMPTY_RESPONSE`
- [ ] Aucune erreur `Failed to fetch`
- [ ] Le login fonctionne (si test complet)

---

## 🐛 DÉPANNAGE

### Problème: VITE_APP_MODE est undefined

**Cause:** dotenv n'est pas chargé correctement

**Solution:**
```bash
# Vérifier que dotenv est installé
npm list dotenv

# Si non installé:
npm install dotenv --save-dev

# Vérifier que le fichier .env est à la racine
ls -la .env
```

### Problème: Runtime mode est CLOUD

**Cause:** `process.env.VITE_APP_MODE` n'est pas accessible

**Solution:**
```bash
# Vérifier le contenu de .env
cat .env | grep VITE_APP_MODE

# Doit afficher:
# VITE_APP_MODE=local

# Redémarrer le serveur après modification
npm run dev:web
```

### Problème: Sync engine s'initialise quand même

**Cause:** `ENABLE_SUPABASE_SYNC` est à `true` dans le .env

**Solution:**
```bash
# Vérifier le .env
cat .env | grep ENABLE_SUPABASE_SYNC

# Si présent, commenter ou supprimer:
# ENABLE_SUPABASE_SYNC=false

# Ou forcer à false:
echo "ENABLE_SUPABASE_SYNC=false" >> .env
```

### Problème: Route /api/auth/tenants/:slug ne répond pas

**Cause:** Backend Express non démarré ou crash

**Solution:**
```bash
# Vérifier que le backend est démarré
curl http://localhost:3001/health

# Doit répondre:
# {"ok":true,"ts":"..."}

# Si pas de réponse, vérifier les logs du serveur
# Chercher des erreurs FATAL ou des crashes

# Redémarrer le serveur
npm run dev:web
```

### Problème: ERR_EMPTY_RESPONSE

**Cause:** Backend crash silencieusement

**Solution:**
```bash
# Vérifier les logs du backend
# Chercher:
# - [FATAL] Unhandled error
# - [SubGuard] Middleware error
# - Erreurs de syntaxe

# Tester la route directement
curl -v http://localhost:3001/api/auth/tenants/great-olive

# Si timeout ou erreur, vérifier:
# 1. La base de données SQLite existe
# 2. Les migrations sont appliquées
# 3. Le tenant "great-olive" existe dans la DB
```

---

## 📝 NOTES IMPORTANTES

### 1. Mode LOCAL vs CLOUD

**Mode LOCAL (développement):**
- `VITE_APP_MODE=local`
- Utilise SQLite comme source de vérité
- Sync engine désactivé par défaut
- Authentification via API locale

**Mode CLOUD (production):**
- `VITE_APP_MODE=cloud` ou `NODE_ENV=production`
- Utilise Supabase comme source de vérité
- Sync engine activé automatiquement
- Authentification via Supabase

### 2. Variable ENABLE_SUPABASE_SYNC

**Utilité:**
- Permet d'activer le sync engine en mode LOCAL
- Utile pour tester la synchronisation
- Valeur par défaut: `false`

**Utilisation:**
```bash
# Dans .env pour activer le sync en mode LOCAL:
ENABLE_SUPABASE_SYNC=true
```

### 3. Logs de Diagnostic

**Les logs suivants ont été ajoutés:**
```
[RENDER BOOT] dotenv loaded successfully
[RENDER BOOT] VITE_APP_MODE: <value>
[RENDER BOOT] NODE_ENV: <value>
[RENDER BOOT] RENDER_CLOUD_MODE: <value>
[RENDER BOOT] Runtime mode: <mode>
[RENDER BOOT] isLocal: <boolean>
[RENDER BOOT] isCloud: <boolean>
[RENDER BOOT] isHybrid: <boolean>
[SyncV2] Sync engine disabled in <mode> mode
```

**Utilité:**
- Tracer la détection du mode d'exécution
- Identifier les problèmes de chargement des variables d'environnement
- Confirmer que le sync engine est correctement géré

---

## 🎯 CRITÈRES DE SUCCÈS

### Succès #1: Mode LOCAL Détecté
- ✅ `VITE_APP_MODE=local` dans .env
- ✅ Logs affichent `Runtime mode: LOCAL`
- ✅ `isLocal: true`

### Succès #2: Sync Engine Désactivé
- ✅ Log: `[SyncV2] Sync engine disabled in LOCAL mode`
- ✅ Aucun log `[SyncV2] Engine initialized`

### Succès #3: Authentification Fonctionne
- ✅ Route `/api/auth/tenants/:slug` répond
- ✅ Tenant name s'affiche dans le frontend
- ✅ Pas d'erreur `ERR_EMPTY_RESPONSE`

### Succès #4: Application Utilise SQLite
- ✅ Logs montrent `[Database] Connecting to: .../data/database.db`
- ✅ Pas de logs `isSupabaseMode: true`
- ✅ Pas de logs `CHOICE SupabaseRepository`

---

## 🚀 PROCHAINES ÉTAPES

1. **Tester les corrections:**
   ```bash
   npm run dev:web
   ```

2. **Vérifier les logs du serveur:**
   - Chercher les logs de diagnostic
   - Confirmer le mode LOCAL
   - Confirmer que le sync engine est désactivé

3. **Tester l'authentification:**
   - Aller sur `http://localhost:5173`
   - Entrer un tenant slug
   - Vérifier que le tenant se résout

4. **Si problème persiste:**
   - Consulter le rapport `DIAGNOSTIC_RUNTIME_MODE.md`
   - Vérifier les logs détaillés
   - Tester les routes avec curl

---

**Guide de vérification généré le:** 2026-07-09  
**Fichier:** `docs/VERIFICATION_GUIDE.md`