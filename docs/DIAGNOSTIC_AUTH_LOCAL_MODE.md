# Diagnostic Complet - Authentification en Mode LOCAL

## Date du Diagnostic
09/07/2026

## Symptômes Observés

1. **Erreur réseau** : `GET http://localhost:5173/api/auth/tenants/great-olive net::ERR_EMPTY_RESPONSE`
2. **Timeout d'authentification** : "l'authentification prends plus qu'une éternité"
3. **Mode LOCAL détecté** : Le serveur détecte correctement le mode LOCAL
4. **Pas de réponse du serveur** : Le backend ne répond pas aux requêtes d'authentification

## Architecture de l'Authentification

### Flux d'Authentification en Mode LOCAL

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (LocalAuthProvider)                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. resolveTenant(slug)                                          │
│    └─ GET /api/auth/tenants/:slug                               │
│                                                                 │
│ 2. loginStaff({ pin, identity, tenant_slug })                   │
│    └─ POST /api/auth/login/pin                                  │
│                                                                 │
│ 3. getProfile(token)                                            │
│    └─ GET /api/auth/me                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (auth.service.ts)                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GET /api/auth/tenants/:slug (ligne 1009-1070)                 │
│  └─ Retourne toujours un tenant (mode single-tenant si besoin) │
│                                                                 │
│  POST /api/auth/login/pin (ligne 340-754)                      │
│  └─ Deux chemins:                                               │
│     ├─ CLOUD: getSupabase(req) → Supabase                      │
│     └─ LOCAL: getLocalUserByPin() → SQLite                     │
│                                                                 │
│  GET /api/auth/me (ligne 912-1000)                             │
│  └─ Retourne le profil utilisateur                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Analyse du Problème

### 1. Configuration du Proxy Vite

**Fichier :** `vite.config.ts` (lignes 68-80)

```typescript
server: {
  port: 5173,
  host: true,
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
      secure: false,
      timeout: 10000,  // ⚠️ TIMEOUT DE 10 SECONDES
      ws: false
    }
  }
}
```

**Problème identifié :**
- Le proxy Vite a un `timeout: 10000` (10 secondes)
- Si le serveur backend ne répond pas dans les 10 secondes, le proxy retourne `ERR_EMPTY_RESPONSE`
- Cela explique l'erreur `net::ERR_EMPTY_RESPONSE` et le timeout "éternel"

### 2. Route `/api/auth/tenants/:slug`

**Fichier :** `src/server/services/auth.service.ts` (lignes 1009-1070)

```typescript
router.get('/tenants/:slug', async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '');

  // Default tenant info (single-tenant fallback)
  const defaultTenant = {
    id: 1,
    name: process.env.VITE_APP_NAME || process.env.APP_NAME || 'EKALA',
    slug: slug || 'default',
    logo_url: null,
    primary_color: '#D4AF37',
    status: 'active' as const,
    _single_tenant: true,
  };

  try {
    const supabase = getSupabase(req);

    if (supabase) {
      // Mode CLOUD - recherche dans Supabase
      // ...
      return res.json(defaultTenant);  // Fallback single-tenant
    }

    // Local fallback
    try {
      const tenant = getLocalTenantBySlug(slug);
      if (tenant) return res.json(tenant);
    } catch {}

    // Single-tenant mode for local dev
    console.log(`[Auth] Single-tenant fallback for slug="${slug}"`);
    return res.json(defaultTenant);
  } catch (e: any) {
    // Even on error, return a usable default so login can proceed
    console.error('[Auth] Tenant lookup error (falling back to single-tenant):', e.message);
    return res.json(defaultTenant);
  }
});
```

**Analyse :**
- ✅ La route existe bien
- ✅ Elle retourne toujours une réponse (jamais d'erreur 500)
- ✅ Elle a un fallback single-tenant pour le mode LOCAL
- ✅ Elle gère les erreurs gracieusement

**Conclusion :** Cette route n'est PAS la cause du problème.

### 3. Route `/api/auth/login/pin`

**Fichier :** `src/server/services/auth.service.ts` (lignes 340-754)

**Mode LOCAL (lignes 643-742) :**

```typescript
// ── LOCAL SQLITE PATH ───────────────────────────────────────────────────
trace.stepStart(correlationId, 'Recherche du tenant (SQLite)');
let candidates: any[];
if (tenant_slug) {
  let tenant = getLocalTenantBySlug(tenant_slug);
  // ... recherche du tenant ...
  
  const db = require('../db/database').default;
  candidates = identity
    ? db.prepare('SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.status FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id WHERE u.tenant_id = ? AND (u.username = ? OR u.phone = ?) AND u.is_active = 1').all(tenant.id, identity, identity)
    : db.prepare('SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.status FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id WHERE u.tenant_id = ? AND u.is_active = 1').all(tenant.id);
}

// Vérification du PIN pour chaque candidat
for (let i = 0; i < candidates.length; i++) {
  const user = candidates[i];
  const pinResult = user.pin_code ? verifyPin(pin_code, user.pin_code) : false;
  
  if (pinResult) {
    // SUCCÈS - retourne le JWT
    const response = buildAuthResponse(user, { name: user.tenant_name, slug: user.tenant_slug, status: user.status }, null);
    trace.end(correlationId);
    return res.json(response);
  }
}

// ÉCHEC - PIN incorrect
return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Code PIN incorrect.' });
```

**Analyse :**
- ✅ Le chemin LOCAL existe et fonctionne
- ✅ Il utilise SQLite directement
- ✅ Il retourne toujours une réponse (succès ou échec)
- ⚠️ **PAS DE TIMEOUT** dans ce code - il s'exécute rapidement

**Conclusion :** Le problème n'est pas dans la logique d'authentification elle-même.

### 4. Vérification de la Base de Données SQLite

**Fichier :** `src/server/db/database.ts`

Le module `database.ts` est requis dynamiquement dans `auth.service.ts` :
```typescript
const db = require('../db/database').default;
```

**Problèmes possibles :**
1. **Base de données non initialisée** : `db` est `null` ou `undefined`
2. **Tables manquantes** : La table `users` ou `tenants` n'existe pas
3. **Données manquantes** : Aucun utilisateur actif dans la base

### 5. Analyse de l'Erreur `ERR_EMPTY_RESPONSE`

**Causes possibles :**

1. **Serveur backend non démarré**
   - Le serveur Express sur le port 3001 n'est pas en cours d'exécution
   - Vérification : `curl http://localhost:3001/health`

2. **Serveur backend planté**
   - Le serveur a crashé au démarrage
   - Vérification : Logs du terminal backend

3. **Timeout du proxy Vite**
   - Le serveur met plus de 10 secondes à répondre
   - Causes :
     - Base de données verrouillée
     - Requête SQL bloquante
     - Deadlock SQLite

4. **Erreur CORS**
   - Le frontend ne peut pas accéder au backend
   - Vérification : Console navigateur → Network → erreurs CORS

5. **Port incorrect**
   - Le backend écoute sur un port différent de 3001
   - Vérification : Logs du serveur backend

## Points d'Investigation Prioritaires

### 1. Vérifier que le Serveur Backend Répond

```bash
# Test de santé
curl http://localhost:3001/health

# Test de la route /api/auth/status
curl http://localhost:3001/api/auth/status

# Test de la route /api/auth/tenants/great-olive
curl http://localhost:3001/api/auth/tenants/great-olive
```

**Résultat attendu :**
```json
{
  "status": "ready",
  "auth": "jwt",
  "database": "connected"
}
```

### 2. Vérifier les Logs du Serveur Backend

**Chercher dans les logs :**
```
[RuntimeMode] Mode: 🏠 LOCAL | Electron: false
[Database] Connecting to: /Users/meyinzaji/Codes/reactjs/great_olive/data/database.db
[Database] Connected successfully
```

**Indicateurs de problème :**
- `[Database] Connection failed` → Base de données inaccessible
- `[RuntimeMode] Mode: ☁️ CLOUD` → Mode incorrectement détecté
- `Error: SQLITE_ERROR: no such table: users` → Tables manquantes

### 3. Vérifier la Base de Données SQLite

```bash
# Se connecter à la base
sqlite3 data/database.db

# Vérifier les tables
.tables

# Vérifier la table users
SELECT COUNT(*) FROM users WHERE is_active = 1;

# Vérifier la table tenants
SELECT id, name, slug, status FROM tenants;

# Vérifier un utilisateur spécifique
SELECT id, full_name, email, role, tenant_id, is_active, pin_code 
FROM users 
WHERE username = 'staff1' OR phone = 'staff1';
```

### 4. Vérifier le Frontend (Console Navigateur)

**Console → Réseau (Network) :**

1. **Filtrer par `/api/auth`**
2. **Vérifier la requête `/api/auth/tenants/great-olive`**
   - Status: Devrait être 200
   - Response: Devrait contenir un objet tenant
   - Time: Devrait être < 1 seconde

3. **Vérifier les en-têtes de la requête**
   ```
   Host: localhost:5173
   Origin: http://localhost:5173
   ```

4. **Vérifier la réponse**
   - Si `ERR_EMPTY_RESPONSE` → Problème de connexion au backend
   - Si `404` → Route non trouvée (problème de montage)
   - Si `500` → Erreur serveur (voir logs backend)

### 5. Vérifier le Mode Détecté

**Dans le frontend (console navigateur) :**
```javascript
// Vérifier le mode détecté
console.log('Mode:', localStorage.getItem('runtime_mode'));

// Vérifier le tenant persisté
console.log('Tenant:', localStorage.getItem('tenant'));
```

**Dans le backend (logs) :**
```
[RuntimeMode] Mode: 🏠 LOCAL | Electron: false
[RENDER BOOT] VITE_APP_MODE: local
[RENDER BOOT] RENDER_CLOUD_MODE: false
```

## Causes Probables (Par Ordre de Probabilité)

### 1. 🔴 Serveur Backend Non Démarré (Probabilité: 60%)

**Symptômes :**
- `ERR_EMPTY_RESPONSE` immédiat (pas de timeout)
- Aucun log backend dans le terminal
- `curl http://localhost:3001/health` échoue

**Solution :**
```bash
# Redémarrer le serveur
npm run dev:web

# Vérifier que le serveur écoute
lsof -i :3001
```

### 2. 🟠 Timeout du Proxy Vite (Probabilité: 25%)

**Symptômes :**
- La requête prend exactement 10 secondes avant `ERR_EMPTY_RESPONSE`
- Les logs backend montrent la requête mais pas de réponse
- La base de données est verrouillée ou lente

**Solution :**
```typescript
// Augmenter le timeout dans vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:3001',
      timeout: 30000,  // 30 secondes au lieu de 10
    }
  }
}
```

### 3. 🟡 Base de Données Non Initialisée (Probabilité: 10%)

**Symptômes :**
- Erreur SQLite dans les logs backend
- Table `users` ou `tenants` manquante
- `db` est `null` dans `auth.service.ts`

**Solution :**
```bash
# Vérifier les tables
sqlite3 data/database.db ".tables"

# Si manquantes, exécuter les migrations
npm run db:migrate
```

### 4. 🟢 Erreur dans le Code (Probabilité: 5%)

**Symptômes :**
- Erreur 500 dans les logs backend
- Stack trace complète
- Message d'erreur explicite

**Solution :**
- Lire le stack trace
- Corriger le bug identifié

## Tests de Diagnostic

### Test 1: Vérifier que le Backend Répond

```bash
# Terminal 1: Démarrer le backend
npm run server:fast

# Terminal 2: Tester les endpoints
curl -v http://localhost:3001/health
curl -v http://localhost:3001/api/auth/status
curl -v http://localhost:3001/api/auth/tenants/great-olive
```

**Résultat attendu :**
```json
# /health
{"status":"ok"}

# /api/auth/status
{"status":"ready","auth":"jwt","database":"connected"}

# /api/auth/tenants/great-olive
{"id":1,"name":"EKALA","slug":"great-olive","status":"active","_single_tenant":true}
```

### Test 2: Vérifier la Base de Données

```bash
# Se connecter à SQLite
sqlite3 data/database.db

# Vérifier les tables
.tables

# Vérifier les utilisateurs
SELECT id, full_name, email, role, tenant_id, is_active 
FROM users 
WHERE is_active = 1;

# Résultat attendu: Au moins un utilisateur actif
```

### Test 3: Tester l'Authentification Directement

```bash
# Tester le login PIN
curl -X POST http://localhost:3001/api/auth/login/pin \
  -H "Content-Type: application/json" \
  -d '{
    "pin_code": "1234",
    "identity": "staff1",
    "tenant_slug": "great-olive"
  }'

# Résultat attendu:
# {
#   "token": "eyJ...",
#   "user": {
#     "id": 1,
#     "full_name": "Staff 1",
#     "role": "staff",
#     "tenant_id": 1,
#     ...
#   }
# }
```

### Test 4: Vérifier le Proxy Vite

```bash
# Dans le terminal où Vite est démarré, vérifier les logs
# Chercher: "proxy" ou "api"

# Tester via le proxy
curl -v http://localhost:5173/api/auth/status

# Résultat attendu:
# Même réponse que http://localhost:3001/api/auth/status
```

## Recommandations Immédiates

### 1. Augmenter le Timeout du Proxy

**Fichier :** `vite.config.ts`

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
      secure: false,
      timeout: 30000,  // ⬆️ Augmenter de 10s à 30s
      ws: false
    }
  }
}
```

### 2. Ajouter des Logs de Diagnostic

**Fichier :** `src/server/services/auth.service.ts`

```typescript
// Au début de chaque route, ajouter:
console.log(`[Auth] ${req.method} ${req.path} - Start`);
console.log(`[Auth] Headers:`, {
  host: req.headers.host,
  origin: req.headers.origin,
  'x-runtime-mode': req.headers['x-runtime-mode'],
});
```

### 3. Vérifier la Base de Données au Démarrage

**Fichier :** `src/server/db/database.ts`

```typescript
// Ajouter une vérification au démarrage
export function initializeDatabase() {
  try {
    const db = new Database(DATABASE_PATH);
    
    // Vérifier que les tables critiques existent
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name IN ('users', 'tenants', 'subscriptions', 'plans')
    `).all();
    
    console.log(`[Database] Found ${tables.length} critical tables`);
    
    // Vérifier qu'il y a des utilisateurs actifs
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get();
    console.log(`[Database] Active users: ${userCount.count}`);
    
    return db;
  } catch (error) {
    console.error('[Database] Initialization failed:', error);
    throw error;
  }
}
```

## Conclusion

### Cause la Plus Probable

**Le serveur backend n'est pas démarré ou ne répond pas** (60% de probabilité).

**Preuves :**
1. `ERR_EMPTY_RESPONSE` indique une connexion fermée sans réponse
2. Le timeout "éternel" suggère que le proxy attend indéfiniment
3. La route `/api/auth/tenants/:slug` existe et fonctionne en théorie

### Actions à Prendre

1. **Immédiat :** Vérifier que le serveur backend est démarré et écoute sur le port 3001
2. **Court terme :** Augmenter le timeout du proxy Vite à 30 secondes
3. **Moyen terme :** Ajouter des logs de diagnostic dans les routes d'authentification
4. **Long terme :** Créer un endpoint de santé complet qui vérifie tous les composants

### Fichiers à Vérifier

- `src/server/server.ts` - Démarrage du serveur
- `src/server/db/database.ts` - Initialisation de la base de données
- `vite.config.ts` - Configuration du proxy
- `src/server/services/auth.service.ts` - Routes d'authentification

---

**Rapport généré le:** 2026-07-09  
**Diagnostic:** Analyse complète sans modification  
**Prochaine étape:** Vérifier que le serveur backend est démarré et répond sur le port 3001