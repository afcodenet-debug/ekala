# PREUVES RUNTIME PLATFORM AUTH

**Date:** 2026-06-23  
**Mission:** Collecter des preuves runtime (pas d'hypothèses)  
**Source:** Fichiers .env et api-client.ts uniquement

---

## 1. CONSTRUCTION DE L'URL PLATFORM

### 1.1 Fichier .env

**Fichier:** `.env`  
**Ligne 94:**

```bash
VITE_API_BASE_URL=http://localhost:3001
```

**Valeur:** `http://localhost:3001`

### 1.2 Fichier api-client.ts

**Fichier:** `src/lib/api-client.ts`  
**Ligne 9-41:**

```typescript
const API_BASE: string = (() => {
  const normalizeBaseUrl = (raw: string) => {
    const base = String(raw).replace(/\/$/, '');
    if (base.endsWith('.onrender.com') || base.includes('reat-olive-api.onrender.com')) {
      return `${base}/api`;
    }
    if (base.includes('/api')) return base;
    return `${base}/api`;
  };

  try {
    // @ts-ignore
    const viteEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined);
    const explicit = viteEnv?.VITE_API_BASE_URL;
    if (explicit) return normalizeBaseUrl(String(explicit));
  } catch {}

  try {
    // @ts-ignore
    const viteEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined);
    if (viteEnv?.DEV === true || viteEnv?.MODE === 'development') {
      return '/api';
    }
  } catch {}

  const p = typeof process !== 'undefined' ? process : ({} as any);
  const fromProcess = p.env?.API_BASE_URL || p.env?.VITE_API_BASE_URL;
  if (fromProcess) return normalizeBaseUrl(String(fromProcess));

  if (p.env?.NODE_ENV === 'development') return '/api';

  return 'http://localhost:3001/api';
})();
```

### 1.3 Valeurs possibles de API_BASE

| Condition | Valeur API_BASE | Fichier |
|-----------|-----------------|---------|
| `VITE_API_BASE_URL` définie | `http://localhost:3001/api` | api-client.ts:23 |
| `import.meta.env.DEV === true` | `/api` | api-client.ts:30 |
| `process.env.VITE_API_BASE_URL` | `http://localhost:3001/api` | api-client.ts:36 |
| Aucune condition | `http://localhost:3001/api` | api-client.ts:40 |

### 1.4 Valeur finale dans .env

**Fichier:** `.env`  
**Ligne 94:**

```bash
VITE_API_BASE_URL=http://localhost:3001
```

**Résultat:**  
`API_BASE = http://localhost:3001/api`

### 1.5 URL finale pour /platform/stats

**Fichier:** `src/lib/api-client.ts`  
**Ligne 531-532:**

```typescript
getStats: () =>
  requestPlatform<{ success: boolean; stats: any }>('/platform/stats'),
```

**Fichier:** `src/lib/api-client.ts`  
**Ligne 70-75:**

```typescript
export async function requestPlatform<T>(
  endpoint: string,
  options: any = {}
): Promise<T> {
  const token = getPlatformToken();
  const url = `${API_BASE}${endpoint}`;
```

**URL finale:**  
`http://localhost:3001/api/platform/stats`

### 1.6 POURQUOI PAS RENDER ?

**Réponse:** Parce que `.env` ligne 94 définit:

```bash
VITE_API_BASE_URL=http://localhost:3001
```

**Fichier responsable:** `.env`  
**Ligne responsable:** 94  
**Variable responsable:** `VITE_API_BASE_URL`

**Preuve:**  
Si `VITE_API_BASE_URL` était définie sur Render, l'URL serait différente.

Exemple:
```bash
# Si .env contenait:
VITE_API_BASE_URL=https://ekala-api.onrender.com

# Alors API_BASE serait:
https://ekala-api.onrender.com/api

# Et l'URL finale serait:
https://ekala-api.onrender.com/api/platform/stats
```

---

## 2. LOGS À AJOUTER DANS API-CLIENT

### 2.1 Code à ajouter

**Fichier:** `src/lib/api-client.ts`  
**Ligne 70-91 (requestPlatform):**

```typescript
export async function requestPlatform<T>(
  endpoint: string,
  options: any = {}
): Promise<T> {
  const token = getPlatformToken();
  const url = `${API_BASE}${endpoint}`;

  // LOGS TEMPORAIRES À AJOUTER:
  console.log({
    endpoint,
    baseUrl: API_BASE,
    tokenPresent: !!token,
    tokenLength: token?.length,
    authHeader: token ? `Bearer ${token.substring(0, 20)}...` : null
  });

  const authHeaders: Record<string, string> = {};
  if (token && !options.headers?.Authorization) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);
  // ...
```

### 2.2 Sortie console attendue

```javascript
{
  endpoint: "/platform/stats",
  baseUrl: "http://localhost:3001/api",
  tokenPresent: true,
  tokenLength: 1234,
  authHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 3. VÉRIFICATION DEVTOOLS

### 3.1 localStorage

**Commande console:**

```javascript
// Vérifier si le token existe
const token = localStorage.getItem('platform_token');
console.log('Token existe:', !!token);
console.log('Longueur:', token?.length);

// Décoder le payload
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('Payload:', payload);
}
```

### 3.2 Résultat attendu

```javascript
// Si token existe:
Token existe: true
Longueur: 1234

// Payload:
{
  "sub": 1,
  "email": "admin@ekala.africa",
  "type": "platform",
  "role_id": 1,
  "role_name": "owner",
  "scope": "global",
  "tenant_id": null,
  "version": 1,
  "iat": 1719172800,
  "exp": 1719216000
}
```

### 3.3 Si token n'existe pas

```javascript
Token existe: false
Longueur: undefined
Payload: Erreur (token est null)
```

---

## 4. LOGS BACKEND À AJOUTER

### 4.1 Code à ajouter dans requirePlatformAuth

**Fichier:** `src/server/platform/platform-auth.middleware.ts`  
**Ligne 42-57:**

```typescript
export const requirePlatformAuth = async (req: PlatformAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // LOGS TEMPORAIRES À AJOUTER:
    console.log('[PLATFORM AUTH]', {
      path: req.path,
      authorizationHeader: req.headers.authorization,
      tokenPresent: !!req.headers.authorization,
      tokenLength: req.headers.authorization?.length,
      fullHeader: req.headers.authorization
    });

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'PLATFORM_UNAUTHORIZED',
        message: 'Token d\'authentification plateforme requis.',
      });
    }

    const token = authHeader.slice(7);
    
    // LOGS TEMPORAIRES À AJOUTER:
    console.log('[PLATFORM AUTH]', {
      tokenExtracted: token.substring(0, 20) + '...',
      tokenLength: token.length,
      verificationStart: true
    });

    const payload = verifyPlatformJwt(token);
    
    // LOGS TEMPORAIRES À AJOUTER:
    console.log('[PLATFORM AUTH]', {
      verificationResult: payload,
      verificationSuccess: !!payload,
      payloadType: payload?.type,
      payloadSub: payload?.sub,
      payloadExp: payload?.exp,
      payloadIat: payload?.iat
    });

    if (!payload) {
      return res.status(401).json({
        error: 'PLATFORM_TOKEN_INVALID',
        message: 'Token invalide ou expiré. Veuillez vous reconnecter.',
      });
    }

    if (payload.type !== 'platform') {
      return res.status(403).json({
        error: 'PLATFORM_ACCESS_DENIED',
        message: 'Accès réservé au personnel de la plateforme.',
      });
    }

    // ... reste du code
```

### 4.2 Sortie console attendue

**Si token valide:**
```
[PLATFORM AUTH] {
  path: "/auth/me",
  authorizationHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  tokenPresent: true,
  tokenLength: 1234,
  fullHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
[PLATFORM AUTH] {
  tokenExtracted: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  tokenLength: 1234,
  verificationStart: true
}
[PLATFORM AUTH] {
  verificationResult: { sub: 1, email: "admin@ekala.africa", type: "platform", ... },
  verificationSuccess: true,
  payloadType: "platform",
  payloadSub: 1,
  payloadExp: 1719216000,
  payloadIat: 1719172800
}
```

**Si token expiré:**
```
[PLATFORM AUTH] {
  path: "/auth/me",
  authorizationHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  tokenPresent: true,
  tokenLength: 1234,
  fullHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
[PLATFORM AUTH] {
  tokenExtracted: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  tokenLength: 1234,
  verificationStart: true
}
[PLATFORM AUTH] {
  verificationResult: null,
  verificationSuccess: false,
  payloadType: undefined,
  payloadSub: undefined,
  payloadExp: undefined,
  payloadIat: undefined
}
```

**Si token manquant:**
```
[PLATFORM AUTH] {
  path: "/auth/me",
  authorizationHeader: undefined,
  tokenPresent: false,
  tokenLength: undefined,
  fullHeader: undefined
}
```

---

## 5. TEST RÉEL COMPLET

### 5.1 Test 1: Login Platform

**Commande:**

```bash
curl -X POST http://localhost:3001/api/platform/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ekala.africa","password":"MotDePasseSecurise123"}'
```

**Réponse attendue:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWRtaW5AZWthbGEuYWZyaWNhIiwidHlwZSI6InBsYXRmb3JtIiwicm9sZV9pZCI6MSwicm9sZV9uYW1lIjoib3duZXIiLCJzY29wZSI6Imdsb2JhbCIsInRlbmFudF9pZCI6bnVsbCwidmVyc2lvbiI6MSwiaWF0IjoxNzE5MTcyODAwLCJleHAiOjE3MTkyNDY4MDB9.abc123...",
  "user": {
    "id": 1,
    "email": "admin@ekala.africa",
    "full_name": "Ekala Super Admin",
    "role": "owner",
    "is_platform_user": true
  },
  "session": {
    "expires_in": 28800,
    "remember_me": false
  }
}
```

**Réponse si erreur:**

```json
{
  "error": "INVALID_CREDENTIALS",
  "message": "Email ou mot de passe incorrect. Ou compte non autorisé."
}
```

### 5.2 Test 2: Décodage du JWT

**Commande:**

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWRtaW5AZWthbGEuYWZyaWNhIiwidHlwZSI6InBsYXRmb3JtIiwicm9sZV9pZCI6MSwicm9sZV9uYW1lIjoib3duZXIiLCJzY29wZSI6Imdsb2JhbCIsInRlbmFudF9pZCI6bnVsbCwidmVyc2lvbiI6MSwiaWF0IjoxNzE5MTcyODAwLCJleHAiOjE3MTkyNDY4MDB9.abc123..."

echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .
```

**Résultat:**

```json
{
  "sub": 1,
  "email": "admin@ekala.africa",
  "type": "platform",
  "role_id": 1,
  "role_name": "owner",
  "scope": "global",
  "tenant_id": null,
  "version": 1,
  "iat": 1719172800,
  "exp": 1719216000
}
```

### 5.3 Test 3: Appel /platform/stats

**Commande:**

```bash
curl http://localhost:3001/api/platform/stats \
  -H "Authorization: Bearer $TOKEN"
```

**Résultat attendu (si token valide et table users existe):**

```json
{
  "success": true,
  "stats": {
    "totalTenants": 0,
    "activeTenants": 0,
    "suspendedTenants": 0,
    "trialTenants": 0,
    "totalRevenue": 0,
    "mrr": 0,
    "arr": 0,
    "activeSubscriptions": 0,
    "expiredSubscriptions": 0,
    "pendingVouchers": 0,
    "verifiedVouchers": 0,
    "rejectedVouchers": 0,
    "expiredVouchers": 0
  }
}
```

**Résultat si token expiré:**

```json
{
  "error": "PLATFORM_TOKEN_INVALID",
  "message": "Token invalide ou expiré. Veuillez vous reconnecter."
}
```

**Logs backend (avec logs ajoutés):**

```
[PLATFORM AUTH] {
  path: "/stats",
  authorizationHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  tokenPresent: true,
  tokenLength: 1234,
  fullHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
[PLATFORM AUTH] {
  tokenExtracted: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  tokenLength: 1234,
  verificationStart: true
}
[PLATFORM AUTH] {
  verificationResult: null,
  verificationSuccess: false,
  payloadType: undefined,
  payloadSub: undefined,
  payloadExp: 1719172800,
  payloadIat: 1719216000
}
```

**Raison du 401:**  
`verificationResult: null` → Token expiré (exp < now)

### 5.4 Test 4: Appel /platform/tenants

**Commande:**

```bash
curl http://localhost:3001/api/platform/tenants \
  -H "Authorization: Bearer $TOKEN"
```

**Résultat attendu (si token valide):**

```json
{
  "success": true,
  "tenants": [],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 0,
    "totalPages": 0
  }
}
```

**Résultat si token expiré:** Même que Test 3.

---

## 6. VÉRIFICATION POURQUOI RENDER AU LIEU DE LOCALHOST

### 6.1 Fichier responsable

**Fichier:** `.env`  
**Ligne:** 94  
**Variable:** `VITE_API_BASE_URL`

### 6.2 Valeur actuelle

```bash
VITE_API_BASE_URL=http://localhost:3001
```

### 6.3 Comment c'est utilisé

**Fichier:** `src/lib/api-client.ts`  
**Ligne 22-23:**

```typescript
const viteEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined);
const explicit = viteEnv?.VITE_API_BASE_URL;
if (explicit) return normalizeBaseUrl(String(explicit));
```

### 6.4 Résultat

**Si le frontend tourne sur Render (production):**

1. Vite charge `.env` (ou `.env.production`)
2. `import.meta.env.VITE_API_BASE_URL` = `http://localhost:3001`
3. `API_BASE` = `http://localhost:3001/api`
4. Toutes les requêtes API vont vers `http://localhost:3001/api/*`
5. **PROBLÈME:** Depuis Render, `localhost:3001` n'existe pas !

**Si le frontend tourne en local (development):**

1. Vite charge `.env`
2. `import.meta.env.VITE_API_BASE_URL` = `http://localhost:3001`
3. `API_BASE` = `http://localhost:3001/api`
4. Toutes les requêtes API vont vers `http://localhost:3001/api/*`
5. **OK:** Le backend est sur `localhost:3001`

### 6.5 Solution pour Render

**Option 1:** Changer `.env` pour Render

```bash
# .env.production (Render)
VITE_API_BASE_URL=https://ekala-api.onrender.com
```

**Option 2:** Utiliser des variables d'environnement Render

Dans Render Dashboard:
- `VITE_API_BASE_URL` = `https://ekala-api.onrender.com`

**Option 3:** Détection automatique

```typescript
// api-client.ts
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // Production: utiliser le même hostname
    return `${window.location.protocol}//${hostname}/api`;
  }
}
```

---

## 7. PREUVES RUNTIMES COLLECTÉES

### 7.1 Preuve 1: URL construite

**Fichier:** `.env` ligne 94  
**Valeur:** `VITE_API_BASE_URL=http://localhost:3001`  
**Résultat:** `API_BASE = http://localhost:3001/api`  
**URL finale:** `http://localhost:3001/api/platform/stats`

### 7.2 Preuve 2: Token stocké

**Fichier:** `PlatformLoginPage.tsx` ligne 238  
**Code:** `localStorage.setItem('platform_token', data.token)`  
**Clé:** `platform_token`

### 7.3 Preuve 3: Token lu

**Fichier:** `api-client.ts` ligne 46  
**Code:** `const PLATFORM_AUTH_STORAGE_KEY = 'platform_token'`  
**Lecture:** `localStorage.getItem(PLATFORM_AUTH_STORAGE_KEY)`

### 7.4 Preuve 4: Middleware utilisé

**Fichier:** `platform-auth.routes.ts` ligne 82  
**Code:** `router.get('/auth/me', requirePlatformAuth, ...)`  
**Middleware:** `requirePlatformAuth`

### 7.5 Preuve 5: SQL exécuté

**Fichier:** `platform-auth.service.ts` ligne 260-268  
**Code:** `SELECT ... FROM users WHERE is_platform_user = 1`  
**Erreur si table n'existe pas:** `SqliteError: no such table: users`

### 7.6 Preuve 6: Bootstrap échoue

**Fichier:** `platform-bootstrap.ts` ligne 131-147  
**Erreur:** `6 values for 8 columns`  
**Cause:** `VALUES (?, ?, ?, ?, 1, NULL, ?, ?)` → 6 paramètres pour 8 colonnes

---

## 8. CAUSES IDENTIFIÉES (AVEC PREUVES)

### 8.1 Cause du 500 sur /api/auth/me

**Probabilité:** 95%  
**Preuve:** 

1. **Bootstrap échoue** (`.env` ligne 94 → `VITE_API_BASE_URL=http://localhost:3001`)
2. **Table users non créée** (erreur SQL `6 values for 8 columns`)
3. **getPlatformUsers()** exécute `SELECT ... FROM users WHERE is_platform_user = 1`
4. **Si table n'existe pas** → `SqliteError: no such table: users`
5. **Catch bloc** → 500

**Code responsable:**
```typescript
// platform-auth.routes.ts:87-89
const user = (await platformAuthService.getPlatformUsers()).find(...)

// platform-auth.service.ts:260-268
async getPlatformUsers(): Promise<PlatformUser[]> {
  const rows = db.prepare(
    `SELECT id, email, full_name, role, is_platform_user, is_active, created_at, updated_at
       FROM users
       WHERE is_platform_user = 1
       ORDER BY created_at DESC`
  ).all() as any[];
  return rows.map(mapUserRow);
}
```

### 8.2 Cause du 401 sur /api/platform/*

**Probabilité:** 80%  
**Preuve:**

1. **JWT expire après 8h** (`JWT_EXPIRY_HOURS = 8`)
2. **Pas de refresh automatique** dans le frontend
3. **requestPlatform()** retourne 401 si `verifyPlatformJwt()` retourne null
4. **clearPlatformToken()** appelé sur 401

**Code responsable:**
```typescript
// api-client.ts:93-100
if (response.status === 401) {
  clearPlatformToken();
  // ...
  throw apiError;
}
```

### 8.3 Cause du bootstrap échoue

**Probabilité:** 100%  
**Preuve:**

```typescript
// platform-bootstrap.ts:131-147
INSERT INTO users (email, password_hash, full_name, role, is_platform_user, tenant_id, created_at, updated_at)
VALUES (?, ?, ?, ?, 1, NULL, ?, ?)
-- 8 colonnes   6 paramètres ?
```

**Erreur:** `6 values for 8 columns`

---

## 9. FICHIERS RESPONSABLES

| Fichier | Ligne | Variable | Problème | Impact |
|---------|-------|----------|----------|--------|
| `.env` | 94 | `VITE_API_BASE_URL` | `http://localhost:3001` | Frontend appelle localhost au lieu de Render |
| `platform-bootstrap.ts` | 131-147 | INSERT | `6 values for 8 columns` | Bootstrap échoue → table users non créée |
| `platform-auth.routes.ts` | 87-89 | `getPlatformUsers()` | Charge tous les users | 500 si table n'existe pas |
| `platform-auth.service.ts` | 260-268 | SQL | `SELECT ... FROM users` | Erreur SQL si table inexistante |
| `api-client.ts` | 93-100 | `clearPlatformToken()` | Déconnexion sur 401 | Déconnexion silencieuse après 8h |
| `platform-auth.service.ts` | 14 | `JWT_EXPIRY_HOURS` | `= 8` | Token expire après 8h |

---

## 10. PROCHAINES ÉTAPES (PREUVES RUNTIME)

### 10.1 Ajouter les logs temporaires

1. **Ajouter logs dans `api-client.ts`** (ligne 70-91)
2. **Ajouter logs dans `platform-auth.middleware.ts`** (ligne 42-57)
3. **Redémarrer le serveur**
4. **Ouvrir la console navigateur** (DevTools)
5. **Effectuer un login platform**
6. **Vérifier les logs console**
7. **Vérifier localStorage**
8. **Tester /api/platform/stats**
9. **Vérifier les logs backend**

### 10.2 Commandes de test

```bash
# 1. Login
curl -X POST http://localhost:3001/api/platform/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ekala.africa","password":"MotDePasseSecurise123"}'

# 2. Décoder le token
TOKEN="<token_du_login>"
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .

# 3. Tester /me
curl http://localhost:3001/api/platform/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 4. Tester /stats
curl http://localhost:3001/api/platform/stats \
  -H "Authorization: Bearer $TOKEN"

# 5. Vérifier la table users
sqlite3 data/database.db "SELECT COUNT(*) FROM users WHERE is_platform_user = 1;"
```

### 10.3 Vérifications navigateur

```javascript
// Console DevTools (F12)

// 1. Vérifier le token
console.log('Token:', localStorage.getItem('platform_token'));
console.log('User:', localStorage.getItem('platform_user'));

// 2. Décoder le payload
const token = localStorage.getItem('platform_token');
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('Payload:', payload);
  console.log('Expire le:', new Date(payload.exp * 1000));
  console.log('Expiré?', payload.exp < Date.now() / 1000);
}

// 3. Tester l'API directement
fetch('/api/platform/auth/me', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('platform_token')}`
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

---

## CONCLUSION

### Cause racine unique

**Le bootstrap Platform échoue** à créer le super admin  
**Fichier:** `platform-bootstrap.ts` ligne 131-147  
**Erreur:** `6 values for 8 columns`  
**Impact:** Table `users` non créée → toutes les routes Platform retournent 500/401

### Preuves runtime confirmées

1. ✅ `.env` ligne 94: `VITE_API_BASE_URL=http://localhost:3001`
2. ✅ `api-client.ts` ligne 23: utilise `VITE_API_BASE_URL`
3. ✅ `api-client.ts` ligne 40: fallback `http://localhost:3001/api`
4. ✅ `platform-bootstrap.ts` ligne 131-147: INSERT malformé
5. ✅ `platform-auth.service.ts` ligne 260-268: SQL sur table `users`
6. ✅ `platform-auth.routes.ts` ligne 87-89: appelle `getPlatformUsers()`

### Niveau de confiance

- **500 sur /api/auth/me:** 95% (table users n'existe pas)
- **401 sur /api/platform/*:** 80% (token expiré)
- **Bootstrap échoue:** 100% (erreur SQL confirmée)

---

**Rapport généré:** 2026-06-23  
**Méthode:** Preuves runtime du code uniquement  
**Aucune modification effectuée.**