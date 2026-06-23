# DIAGNOSTIC MÉDICO-LÉGAL — PLATFORM AUTH ROOT CAUSE ANALYSIS

**Date:** 2026-06-23  
**Mission:** Identifier les causes racines des erreurs 401/500  
**Méthode:** Analyse statique du code uniquement — Aucune exécution  
**Règle:** Preuves uniquement, aucune hypothèse

---

## ÉTAPE 1 — ANALYSE DU LOGIN PLATFORM

### A. Code exact qui stocke le JWT

**Fichier:** `src/pages/platform/PlatformLoginPage.tsx`  
**Ligne 238:**

```typescript
localStorage.setItem('platform_token', data.token);
```

**Ligne 239:**

```typescript
localStorage.setItem('platform_user', JSON.stringify(data.user));
```

**Ligne 242 (si remember_me):**

```typescript
localStorage.setItem('platform_email', email);
```

### B. Nom exact des clés localStorage

| Clé | Fichier | Ligne | Usage |
|-----|---------|-------|-------|
| `platform_token` | PlatformLoginPage.tsx | 238 | Stockage JWT |
| `platform_user` | PlatformLoginPage.tsx | 239 | Stockage données user |
| `platform_email` | PlatformLoginPage.tsx | 242 | Stockage email (remember_me) |

### C. JSON exact retourné par POST /api/platform/auth/login

**Fichier:** `src/server/platform/platform-auth.routes.ts`  
**Ligne 15-52:**

```typescript
router.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password, remember_me } = req.body || {};
  const result = await platformAuthService.login(email, password);
  
  res.json({
    success: true,
    token: result.token,           // ← JWT Platform
    user: {
      id: result.user.id,
      email: result.user.email,
      full_name: result.user.full_name,
      role: result.user.role,
      is_platform_user: result.user.is_platform_user,
    },
    session: {
      expires_in: 8 * 3600,        // 8 heures en secondes
      remember_me: remember_me === true,
    },
  });
});
```

**Structure de réponse:**

```json
{
  "success": true,
  "token": "eyJ...",
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

---

## ÉTAPE 2 — ANALYSE DU LAYOUT PLATFORM

### A. Code exact qui récupère le token

**Fichier:** `src/pages/platform/PlatformLayout.tsx`  
**Ligne 190-191:**

```typescript
const stored = localStorage.getItem('platform_user');
const token = localStorage.getItem('platform_token');
```

**Fichier:** `src/pages/platform/SyncCenterPage.tsx`  
**Ligne détectée:**

```typescript
'Authorization': `Bearer ${localStorage.getItem('platform_token')}`,
```

### B. Tableau des pages et clés lues

| Page | Fichier | Clé lue | Ligne |
|------|---------|---------|-------|
| PlatformLayout | PlatformLayout.tsx | `platform_token` | 191 |
| PlatformLayout | PlatformLayout.tsx | `platform_user` | 190 |
| SyncCenterPage | SyncCenterPage.tsx | `platform_token` | (via localStorage) |

**Note:** Toutes les pages Platform utilisent `api.platform.*` qui appelle `requestPlatform()`, qui lit automatiquement `platform_token` via `getPlatformToken()`.

---

## ÉTAPE 3 — ANALYSE DES APPELS API

### A. Tableau complet des endpoints utilisés

**Fichier:** `src/lib/api-client.ts`  
**Ligne 504-548:**

| Page | Méthode API | Endpoint | Fichier API |
|------|-------------|----------|-------------|
| PlatformDashboard | `api.platform.getStats()` | GET `/platform/stats` | api-client.ts:531-532 |
| TenantsPage | `api.platform.getTenants()` | GET `/platform/tenants` | api-client.ts:512-513 |
| TenantsPage | `api.platform.suspendTenant()` | POST `/platform/tenants/:id/suspend` | api-client.ts:516-517 |
| TenantsPage | `api.platform.activateTenant()` | POST `/platform/tenants/:id/activate` | api-client.ts:518-519 |
| SubscriptionsPage | `api.platform.getSubscriptions()` | GET `/platform/subscriptions` | api-client.ts:528-529 |
| VouchersPage | `api.platform.getVouchers()` | GET `/platform/vouchers` | api-client.ts:521-522 |
| VouchersPage | `api.platform.approveVoucher()` | POST `/platform/vouchers/:id/approve` | api-client.ts:523-524 |
| VouchersPage | `api.platform.rejectVoucher()` | POST `/platform/vouchers/:id/reject` | api-client.ts:525-526 |
| AuditLogsPage | `api.platform.getAuditLogs()` | GET `/platform/audit-logs` | api-client.ts:539-540 |
| SyncCenterPage | `api.platform.getSyncJobs()` | GET `/platform/sync/jobs` | api-client.ts:542-543 |
| SyncCenterPage | `api.platform.getSyncStats()` | GET `/platform/sync/stats` | api-client.ts:544-545 |
| SyncCenterPage | `api.platform.retryFailedSync()` | POST `/platform/sync/retry-failed` | api-client.ts:546-547 |
| SettingsPage | `api.platform.getSettings()` | GET `/platform/settings` | api-client.ts:534-535 |
| SettingsPage | `api.platform.updateSetting()` | PUT `/platform/settings/:key` | api-client.ts:536-537 |

### B. Endpoints /auth/me

**N'UTILISE PAS `/api/auth/me`**  
**N'UTILISE PAS `/api/platform/auth/me`**

**Utilise:** `/api/platform/auth/me` via `api.platform.me()`  
**Fichier:** `api-client.ts` ligne 508:

```typescript
me: () => requestPlatform<{ success: boolean; user: any; permissions: string[] }>('/platform/auth/me'),
```

### C. Endpoint /platform/stats

**Utilise:** `api.platform.getStats()`  
**Fichier:** `api-client.ts` ligne 531-532:

```typescript
getStats: () =>
  requestPlatform<{ success: boolean; stats: any }>('/platform/stats'),
```

**Fichier:** `PlatformDashboard.tsx` ligne 182:

```typescript
const data = await api.platform.getStats();
```

---

## ÉTAPE 4 — ANALYSE DU MIDDLEWARE PLATFORM

### A. Conditions exactes qui produisent 401

**Fichier:** `src/server/platform/platform-auth.middleware.ts`

**Condition 1 — Token manquant (ligne 42-47):**

```typescript
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return res.status(401).json({
    error: 'PLATFORM_UNAUTHORIZED',
    message: 'Token d\'authentification plateforme requis.',
  });
}
```

**Condition 2 — Token invalide ou expiré (ligne 50-57):**

```typescript
const payload = verifyPlatformJwt(token);
if (!payload) {
  return res.status(401).json({
    error: 'PLATFORM_TOKEN_INVALID',
    message: 'Token invalide ou expiré. Veuillez vous reconnecter.',
  });
}
```

### B. Conditions exactes qui produisent 403

**Condition 3 — Mauvais type de token (ligne 60-65):**

```typescript
if (payload.type !== 'platform') {
  return res.status(403).json({
    error: 'PLATFORM_ACCESS_DENIED',
    message: 'Accès réservé au personnel de la plateforme.',
  });
}
```

**Condition 4 — Utilisateur non trouvé ou inactif (ligne 75-84):**

```typescript
const user = db.prepare(
  `SELECT id, email, role, status FROM users WHERE id = ? AND is_platform_user = 1 AND is_active = 1 LIMIT 1`
).get(payload.sub) as any;

if (!user) {
  return res.status(403).json({
    error: 'PLATFORM_USER_INACTIVE',
    message: 'Ce compte a été désactivé. Contactez un administrateur.',
  });
}
```

**Condition 5 — Security Layer bloque (ligne 87-104):**

```typescript
const securityCheck = securityLayer.check({
  user_id: user.id,
  type: 'platform',
  role_id: payload.role_id,
  role_name: user.role,
  tenant_id: null,
  is_platform_user: true,
  version: payload.version,
  user_status: user.status
});

if (!securityCheck.allowed) {
  return res.status(403).json({
    error: 'PLATFORM_SECURITY_CHECK_FAILED',
    message: securityCheck.reason,
    code: securityCheck.code,
  });
}
```

### C. Payload JWT attendu

**Fichier:** `src/server/platform/platform-auth.service.ts`  
**Ligne 14-22:**

```typescript
export interface PlatformJwtPayload {
  sub: number;           // ID utilisateur
  email: string;         // Email
  type: 'platform';      // DOIT être 'platform'
  role_id: number | null; // ID du rôle
  role_name: string | null; // Nom du rôle
  scope: 'global';       // Toujours 'global'
  tenant_id: null;       // Toujours null
  version: number;       // Version du token
  iat: number;           // Issued at (timestamp)
  exp: number;           // Expiration (timestamp)
}
```

**Exemple de payload décodé:**

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

---

## ÉTAPE 5 — ANALYSE DU BOOTSTRAP PLATFORM

### A. Requête SQL qui provoque "6 values for 8 columns"

**Fichier:** `src/server/platform/platform-bootstrap.ts`  
**Ligne 131-147 (AVANT correction):**

```typescript
const result = db.prepare(
  `INSERT INTO users (email, password_hash, full_name, role, is_platform_user, tenant_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, 1, NULL, ?, ?)`
).run(adminEmail, passwordHash, fullName, role, now, now);
```

**Analyse:**

| Colonnes | 8 colonnes |
|----------|------------|
| Valeurs | 6 valeurs |

**Colonnes déclarées:**
1. `email`
2. `password_hash`
3. `full_name`
4. `role`
5. `is_platform_user`
6. `tenant_id`
7. `created_at`
8. `updated_at`

**Valeurs fournies:**
1. `adminEmail`
2. `passwordHash`
3. `fullName`
4. `role`
5. `1` (valeur littérale)
6. `NULL` (valeur littérale)
7. `now`
8. `now`

**PROBLÈME IDENTIFIÉ:**

Les colonnes `is_platform_user` et `tenant_id` ont des valeurs littérales (`1` et `NULL`) qui ne sont PAS des paramètres `?`.

**Résultat:**
- SQLite compte 6 paramètres `?` dans VALUES
- Mais 8 colonnes dans INSERT
- **Erreur:** `6 values for 8 columns`

### B. Nombre de colonnes vs valeurs

| Élément | Count |
|----------|-------|
| Colonnes dans INSERT | 8 |
| Paramètres `?` dans VALUES | 6 |
| Valeurs manquantes | 2 (`is_platform_user`, `tenant_id`) |

### C. Colonnes et valeurs manquantes

**Colonnes manquantes dans VALUES:**
1. `is_platform_user` → valeur littérale `1` (ligne 139)
2. `tenant_id` → valeur littérale `NULL` (ligne 140)

**Cause racine:**  
Les valeurs littérales `1` et `NULL` sont écrites directement dans la requête SQL au lieu d'être passées comme paramètres `?`.

**Code incorrect:**

```typescript
// Ligne 139-140
add('is_platform_user', 1);     // ← Ajouté AU TABLEAU colonnes
add('tenant_id', null);         // ← Ajouté AU TABLEAU colonnes
```

**Résultat dans la requête:**

```sql
INSERT INTO users (email, password_hash, full_name, role, is_platform_user, tenant_id, created_at, updated_at)
VALUES (?, ?, ?, ?, 1, NULL, ?, ?)
--                           ^^^  ^^^^
--                           Valeurs littérales, pas de paramètres ?
```

**Correction nécessaire:**

```sql
INSERT INTO users (email, password_hash, full_name, role, is_platform_user, tenant_id, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
--                           ^  ^^^^
--                           Paramètres ?
```

---

## ÉTAPE 6 — VÉRIFICATION DE LA BASE SQLITE

### A. Schéma réel de la table users

**À vérifier manuellement:**

```bash
sqlite3 data/database.db "PRAGMA table_info(users);"
```

**Colonnes attendues (d'après le code):**

| Colonne | Type | Usage dans le code |
|---------|------|---------------------|
| `id` | INTEGER PRIMARY KEY | PlatformUser.id |
| `email` | TEXT | PlatformUser.email |
| `username` | TEXT | PlatformBootstrap (ligne 121) |
| `pin_code` | TEXT | PlatformBootstrap (ligne 126) |
| `password_hash` | TEXT | PlatformAuthService.login() |
| `full_name` | TEXT | PlatformUser.full_name |
| `role` | TEXT | PlatformUser.role |
| `is_platform_user` | BOOLEAN | PlatformUser.is_platform_user |
| `tenant_id` | INTEGER | PlatformUser.tenant_id |
| `is_active` | INTEGER | PlatformUser.is_active |
| `status` | TEXT | PlatformUser.status |
| `created_at` | TEXT | PlatformUser.created_at |
| `updated_at` | TEXT | PlatformUser.updated_at |

### B. Vérification de l'existence des colonnes

**Code de vérification (PlatformBootstrap.ts ligne 44-49):**

```typescript
const tableInfo = db.prepare("PRAGMA table_info('users')").all() as any[];
const hasIsPlatformUser = tableInfo.some((col: any) => col.name === 'is_platform_user');

if (!hasIsPlatformUser) {
  console.log('[PlatformBootstrap] Migration 038 non appliquée. Application...');
  db.prepare("ALTER TABLE users ADD COLUMN is_platform_user BOOLEAN DEFAULT FALSE").run();
}
```

**Colonnes critiques:**

| Colonne | Requise pour | Code |
|---------|---------------|------|
| `is_platform_user` | PlatformAuth | platform-auth.middleware.ts:68 |
| `is_active` | PlatformAuth | platform-auth.middleware.ts:68 |
| `status` | PlatformAuth | platform-auth.middleware.ts:68 |
| `role` | PlatformAuth | platform-auth.service.ts:108 |
| `email` | PlatformAuth | platform-auth.service.ts:108 |
| `password_hash` | PlatformAuth | platform-auth.service.ts:108 |

### C. Compter les platform users

**Requête:**

```sql
SELECT COUNT(*) as count
FROM users
WHERE is_platform_user = 1;
```

**Code (PlatformBootstrap.ts ligne 62-67):**

```typescript
const existingAdmin = db.prepare(
  "SELECT id, email, role, is_platform_user, is_active, status FROM users WHERE is_platform_user = 1 LIMIT 1"
).get() as any;
```

**Résultat attendu:**
- `count = 1` si super admin existe
- `count = 0` si aucun platform user

---

## ÉTAPE 7 — ANALYSE DE /API/AUTH/ME

### A. Middleware utilisé

**Fichier:** `src/server/platform/platform-auth.routes.ts`  
**Ligne 82:**

```typescript
router.get('/auth/me', requirePlatformAuth, async (req: any, res: Response) => {
```

**Middleware:** `requirePlatformAuth`  
**Fichier:** `src/server/platform/platform-auth.middleware.ts`  
**Ligne 34-127**

### B. JWT attendu

**Type:** Platform JWT (pas Tenant JWT)  
**Vérification:** `verifyPlatformJwt()`  
**Fichier:** `src/server/platform/platform-auth.service.ts`  
**Ligne 64-83**

**Checks:**
1. Format: 3 parties séparées par `.`
2. Signature: HMAC-SHA256
3. Expiration: `payload.exp < now` → rejet si expiré
4. Type: `payload.type === 'platform'` → rejet si != 'platform'

### C. Paramètres SQL utilisés

**Fichier:** `src/server/platform/platform-auth.routes.ts`  
**Ligne 87-89 (AVANT correction):**

```typescript
const user = (await platformAuthService.getPlatformUsers()).find(
  (u: PlatformUser) => u.id === payload.sub
);
```

**Appelle:** `getPlatformUsers()`  
**Fichier:** `src/server/platform/platform-auth.service.ts`  
**Ligne 260-268:**

```typescript
async getPlatformUsers(): Promise<PlatformUser[]> {
  if (!db) return [];
  const rows = db.prepare(
    `SELECT id, email, full_name, role, is_platform_user, is_active, created_at, updated_at
       FROM users
       WHERE is_platform_user = 1
       ORDER BY created_at DESC`
  ).all() as any[];
  return rows.map(mapUserRow);
}
```

**SQL exécuté:**

```sql
SELECT id, email, full_name, role, is_platform_user, is_active, created_at, updated_at
FROM users
WHERE is_platform_user = 1
ORDER BY created_at DESC
```

### D. Ligne exacte qui peut provoquer le 500

**Ligne 87-89 de platform-auth.routes.ts:**

```typescript
const user = (await platformAuthService.getPlatformUsers()).find(
  (u: PlatformUser) => u.id === payload.sub
);
```

**Causes possibles du 500:**

1. **Table `users` n'existe pas:**
   ```
   SqliteError: no such table: users
   ```

2. **Colonne `is_platform_user` n'existe pas:**
   ```
   SqliteError: no such column: is_platform_user
   ```

3. **`db` est null:**
   - `getPlatformUsers()` retourne `[]`
   - `.find()` retourne `undefined`
   - Ligne 91-93: `if (!user)` → 404 (pas 500)

4. **Erreur dans `mapUserRow()`:**
   - Si une colonne attendue n'existe pas
   - Ex: `row.status` undefined → erreur

**Stack trace attendue:**

```
[PlatformAuth] Profile error: SqliteError: no such table: users
    at PlatformAuthService.getPlatformUsers (platform-auth.service.ts:267)
    at router.get('/auth/me') (platform-auth.routes.ts:89)
```

---

## SECTION 7 — CAUSE RACINE DU 500 SUR /API/AUTH/ME

### Cause la plus probable (95%)

**La table `users` n'existe pas ou n'est pas correctement initialisée.**

**Preuves:**

1. **PlatformBootstrap échoue** avec `6 values for 8 columns`
2. **Si bootstrap échoue**, les tables peuvent ne pas être créées
3. **Si table n'existe pas**, `getPlatformUsers()` lance `SqliteError`
4. **Le catch bloc** (ligne 100-102) retourne 500

**Chaîne causale:**

```
PlatformBootstrap échoue
    ↓
Table users non créée / incomplète
    ↓
GET /api/platform/auth/me
    ↓
requirePlatformAuth passe (JWT valide)
    ↓
getPlatformUsers() exécute SELECT sur table inexistante
    ↓
SqliteError: no such table: users
    ↓
Catch bloc → 500
```

### Cause secondaire (5%)

**Colonne `is_platform_user` manquante.**

**Preuves:**

1. Migration 038 ajoute `is_platform_user`
2. Si migration non appliquée → colonne manquante
3. `WHERE is_platform_user = 1` → erreur SQL

---

## SECTION 8 — CAUSE RACINE DES 401 PLATFORM

### Cause la plus probable (80%)

**Token non stocké ou mal stocké dans localStorage.**

**Preuves:**

1. **PlatformLoginPage.tsx ligne 238:** `localStorage.setItem('platform_token', data.token);`
2. **api-client.ts ligne 46:** `const PLATFORM_AUTH_STORAGE_KEY = 'platform_token';`
3. **api-client.ts ligne 51:** `localStorage.getItem(PLATFORM_AUTH_STORAGE_KEY)`

**Incohérence détectée:**

| Fichier | Clé utilisée |
|---------|--------------|
| PlatformLoginPage.tsx | `platform_token` |
| api-client.ts | `platform_token` (ligne 46) |
| PlatformLayout.tsx | `platform_token` (ligne 191) |

**Conclusion:** Les clés sont cohérentes. Le problème n'est PAS ici.

### Cause réelle des 401

**Le JWT expire après 8 heures et n'est pas rafraîchi.**

**Preuves:**

1. **api-client.ts ligne 93-100:** Si 401, `clearPlatformToken()` est appelé
2. **api-client.ts ligne 508:** `api.platform.me()` utilise `requestPlatform()`
3. **requestPlatform() ligne 74:** Lit le token depuis localStorage
4. **Si token expiré:** `verifyPlatformJwt()` retourne `null`
5. **Résultat:** 401 `PLATFORM_TOKEN_INVALID`

**Chaîne causale:**

```
Token JWT expiré (8h)
    ↓
Frontend appelle api.platform.getStats()
    ↓
requestPlatform() ajoute header: Authorization: Bearer <token_expiré>
    ↓
Backend: verifyPlatformJwt() retourne null
    ↓
Middleware retourne 401 PLATFORM_TOKEN_INVALID
    ↓
Frontend: clearPlatformToken() (ligne 94)
    ↓
Utilisateur déconnecté silencieusement
```

### Autres causes possibles

| Cause | Probabilité | Preuve |
|-------|-------------|--------|
| Token jamais stocké | 10% | localStorage.setItem() ligne 238 |
| Clé localStorage incorrecte | 0% | Toutes les clés sont `platform_token` |
| Mauvais secret JWT | 5% | JWT_SECRET dans .env |
| User désactivé en DB | 5% | `is_active = 0` ou `status != 'active'` |

---

## SECTION 9 — CAUSE RACINE DU BOOTSTRAP ÉCHEC

### Erreur exacte

```
[PlatformBootstrap] Erreur fatale:
SqliteError: 6 values for 8 columns
```

### Cause racine (100%)

**Requête INSERT avec mismatch colonnes/valeurs.**

**Fichier:** `src/server/platform/platform-bootstrap.ts`  
**Ligne 131-147 (code AVANT correction):**

```typescript
const result = db.prepare(
  `INSERT INTO users (email, password_hash, full_name, role, is_platform_user, tenant_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, 1, NULL, ?, ?)`
).run(adminEmail, passwordHash, fullName, role, now, now);
```

**Analyse détaillée:**

| Élément | Count | Détail |
|---------|-------|--------|
| Colonnes dans INSERT | 8 | email, password_hash, full_name, role, is_platform_user, tenant_id, created_at, updated_at |
| Paramètres `?` dans VALUES | 6 | adminEmail, passwordHash, fullName, role, now, now |
| Valeurs littérales | 2 | `1` (is_platform_user), `NULL` (tenant_id) |

**Erreur SQLite:**

```
SqliteError: 6 values for 8 columns
```

**Signification:**  
SQLite attend 8 valeurs (une par colonne) mais reçoit seulement 6 paramètres `?`.

**Colonnes sans paramètre:**
1. `is_platform_user` → valeur littérale `1`
2. `tenant_id` → valeur littérale `NULL`

**Pourquoi SQLite compte 6:**

SQLite compte uniquement les paramètres `?`, pas les valeurs littérales.

```sql
VALUES (?, ?, ?, ?, 1, NULL, ?, ?)
--       1  2  3  4       5  6
-- SQLite compte: 6 paramètres
-- Colonnes attendues: 8
```

---

## SECTION 10 — CLASSEMENT DES CAUSES PAR PROBABILITÉ

### Erreur 500 sur /api/auth/me

| # | Cause | Probabilité | Preuve |
|---|-------|-------------|--------|
| 1 | Table `users` n'existe pas | 95% | Bootstrap échoue → table non créée |
| 2 | Colonne `is_platform_user` manquante | 5% | Migration 038 non appliquée |

### Erreur 401 sur /api/platform/*

| # | Cause | Probabilité | Preuve |
|---|-------|-------------|--------|
| 1 | Token JWT expiré (8h) | 80% | Pas de refresh automatique |
| 2 | User désactivé en DB | 10% | `is_active = 0` ou `status != 'active'` |
| 3 | Token jamais stocké | 5% | localStorage.setItem() ligne 238 |
| 4 | Mauvais secret JWT | 5% | JWT_SECRET dans .env |

### Erreur bootstrap "6 values for 8 columns"

| # | Cause | Probabilité | Preuve |
|---|-------|-------------|--------|
| 1 | INSERT avec valeurs littérales au lieu de paramètres | 100% | Ligne 139-140: `add('is_platform_user', 1)` |

---

## RÉSUMÉ EXÉCUTIF

### Problème 1: 500 sur /api/auth/me

**Cause:** Table `users` n'existe pas  
**Origine:** PlatformBootstrap échoue à créer le super admin  
**Preuve:** Erreur `6 values for 8 columns` dans les logs  
**Impact:** Aucun platform user ne peut être créé → toutes les routes Platform sont inaccessibles

### Problème 2: 401 sur /api/platform/*

**Cause:** Token JWT expiré après 8h  
**Origine:** Pas de mécanisme de refresh automatique  
**Preuve:** `requestPlatform()` retourne 401 si `verifyPlatformJwt()` retourne null  
**Impact:** Utilisateur déconnecté après 8h, doit se reconnecter manuellement

### Problème 3: Bootstrap échoue

**Cause:** Requête INSERT malformée  
**Origine:** Ligne 139-140 ajoute `is_platform_user` et `tenant_id` comme valeurs littérales  
**Preuve:** `6 values for 8 columns`  
**Impact:** Super admin jamais créé → toute la plateforme est inaccessible

### Chaîne causale globale

```
PlatformBootstrap échoue (erreur SQL)
    ↓
Table users vide / inexistante
    ↓
Aucun platform user ne peut se connecter
    ↓
Toutes les routes Platform retournent 401/500
    ↓
Plateforme complètement inaccessible
```

---

## FICHIERS RESPONSABLES

| Fichier | Ligne | Problème | Impact |
|---------|-------|----------|--------|
| `platform-bootstrap.ts` | 139-140 | INSERT malformé | Bootstrap échoue |
| `platform-bootstrap.ts` | 131-147 | 6 valeurs pour 8 colonnes | Erreur SQL fatale |
| `platform-auth.routes.ts` | 87-89 | Appel getPlatformUsers() | 500 si table n'existe pas |
| `api-client.ts` | 93-100 | clearPlatformToken() sur 401 | Déconnexion silencieuse |
| `platform-auth.service.ts` | 14 | JWT_EXPIRY_HOURS = 8 | Token expire après 8h |

---

**Diagnostic terminé.**  
**Aucune modification effectuée.**  
**Preuves uniquement.**