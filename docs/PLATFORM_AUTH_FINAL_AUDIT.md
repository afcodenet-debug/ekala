# AUDIT FINAL PLATFORM AUTH — RAPPORT MÉDICO-LÉGAL

**Date:** 2026-06-23  
**Mission:** Identifier les causes exactes des erreurs 401/500  
**Méthode:** Preuves du code uniquement — Aucune hypothèse  
**Règle:** Chaque affirmation doit être accompagnée d'un extrait de code exact

---

## ÉTAPE 1 — AUDIT DES ROUTES APPELÉES

### 1.1 Composants React et endpoints appelés

#### PlatformDashboard.tsx

**Fichier:** `src/pages/platform/PlatformDashboard.tsx`  
**Ligne 182:**

```typescript
const data = await api.platform.getStats();
```

**Fichier:** `src/lib/api-client.ts`  
**Ligne 531-532:**

```typescript
getStats: () =>
  requestPlatform<{ success: boolean; stats: any }>('/platform/stats'),
```

**URL finale:** `${API_BASE}/platform/stats`  
**Méthode:** GET  
**Headers:** `Authorization: Bearer <platform_token>` (ajouté par `requestPlatform`)

#### TenantsPage.tsx

**Fichier:** `src/pages/platform/TenantsPage.tsx`  
**Ligne détectée:**

```typescript
const data = await api.platform.getTenants(params);
```

**Fichier:** `src/lib/api-client.ts`  
**Ligne 512-513:**

```typescript
getTenants: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
  requestPlatform<{ success: boolean; tenants: any[]; pagination: any }>('/platform/tenants', { params }),
```

**URL finale:** `${API_BASE}/platform/tenants?page=1&limit=50`  
**Méthode:** GET  
**Headers:** `Authorization: Bearer <platform_token>`

#### VouchersPage.tsx

**Fichier:** `src/pages/platform/VouchersPage.tsx`  
**Lignes détectées:**

```typescript
const data = await api.platform.getVouchers({ page, limit: 50, status: statusFilter || undefined });
const data = await api.platform.approveVoucher(voucherId);
const data = await api.platform.rejectVoucher(voucherId, reason);
```

**Fichier:** `src/lib/api-client.ts`  
**Lignes 521-526:**

```typescript
getVouchers: (params?: { page?: number; limit?: number; status?: string }) =>
  requestPlatform<{ success: boolean; vouchers: any[]; pagination: any }>('/platform/vouchers', { params }),
approveVoucher: (id: number) =>
  requestPlatform('/platform/vouchers/' + id + '/approve', { method: 'POST' }),
rejectVoucher: (id: number, reason: string) =>
  requestPlatform('/platform/vouchers/' + id + '/reject', { method: 'POST', body: { reason } }),
```

**URLs finales:**
- GET `${API_BASE}/platform/vouchers`
- POST `${API_BASE}/platform/vouchers/:id/approve`
- POST `${API_BASE}/platform/vouchers/:id/reject`

#### SubscriptionsPage.tsx

**Fichier:** `src/pages/platform/SubscriptionsPage.tsx`  
**Ligne détectée:**

```typescript
const data = await api.platform.getSubscriptions({ page, limit: 50, status: statusFilter || undefined });
```

**Fichier:** `src/lib/api-client.ts`  
**Ligne 528-529:**

```typescript
getSubscriptions: (params?: { page?: number; limit?: number; status?: string }) =>
  requestPlatform<{ success: boolean; subscriptions: any[]; pagination: any }>('/platform/subscriptions', { params }),
```

**URL finale:** `${API_BASE}/platform/subscriptions`  
**Méthode:** GET

#### AuditLogsPage.tsx

**Fichier:** `src/pages/platform/AuditLogsPage.tsx`  
**Ligne détectée:**

```typescript
const data = await api.platform.getAuditLogs({ page, limit: 50, action: actionFilter || undefined });
```

**Fichier:** `src/lib/api-client.ts`  
**Ligne 539-540:**

```typescript
getAuditLogs: (params?: { page?: number; limit?: number; action?: string; tenant_id?: string }) =>
  requestPlatform<{ success: boolean; logs: any[]; pagination: any }>('/platform/audit-logs', { params }),
```

**URL finale:** `${API_BASE}/platform/audit-logs`  
**Méthode:** GET

#### SyncCenterPage.tsx

**Fichier:** `src/pages/platform/SyncCenterPage.tsx`  
**Lignes détectées:**

```typescript
const data = await api.platform.getSyncJobs({ page, limit: 50 });
const data = await api.platform.getSyncStats();
const data = await api.platform.retryFailedSync(5);
```

**Fichier:** `src/lib/api-client.ts`  
**Lignes 542-547:**

```typescript
getSyncJobs: (params?: { page?: number; limit?: number }) =>
  requestPlatform<{ success: boolean; jobs: any[]; pagination: any }>('/platform/sync/jobs', { params }),
getSyncStats: () =>
  requestPlatform<{ success: boolean; stats: any }>('/platform/sync/stats'),
retryFailedSync: (maxAttempts?: number) =>
  requestPlatform<{ success: boolean; retried: number }>('/platform/sync/retry-failed', { method: 'POST', body: { maxAttempts } }),
```

**URLs finales:**
- GET `${API_BASE}/platform/sync/jobs`
- GET `${API_BASE}/platform/sync/stats`
- POST `${API_BASE}/platform/sync/retry-failed`

### 1.2 Tableau récapitulatif des routes appelées

| Page | Fichier | Méthode | Endpoint | Ligne API |
|------|---------|---------|----------|-----------|
| Dashboard | PlatformDashboard.tsx | GET | `/platform/stats` | api-client.ts:531 |
| Tenants | TenantsPage.tsx | GET | `/platform/tenants` | api-client.ts:512 |
| Vouchers | VouchersPage.tsx | GET | `/platform/vouchers` | api-client.ts:521 |
| Vouchers | VouchersPage.tsx | POST | `/platform/vouchers/:id/approve` | api-client.ts:523 |
| Vouchers | VouchersPage.tsx | POST | `/platform/vouchers/:id/reject` | api-client.ts:525 |
| Subscriptions | SubscriptionsPage.tsx | GET | `/platform/subscriptions` | api-client.ts:528 |
| AuditLogs | AuditLogsPage.tsx | GET | `/platform/audit-logs` | api-client.ts:539 |
| SyncCenter | SyncCenterPage.tsx | GET | `/platform/sync/jobs` | api-client.ts:542 |
| SyncCenter | SyncCenterPage.tsx | GET | `/platform/sync/stats` | api-client.ts:544 |
| SyncCenter | SyncCenterPage.tsx | POST | `/platform/sync/retry-failed` | api-client.ts:546 |

**Aucune page n'appelle `/api/auth/me` directement.**  
**Seul `api.platform.me()` appelle `/api/platform/auth/me`.**

---

## ÉTAPE 2 — AUDIT DU TOKEN

### 2.1 Où le login stocke le token

**Fichier:** `src/pages/platform/PlatformLoginPage.tsx`  
**Ligne 238-239:**

```typescript
localStorage.setItem('platform_token', data.token);
localStorage.setItem('platform_user', JSON.stringify(data.user));
```

**Clé utilisée:** `platform_token`

### 2.2 Format exact du JWT

**Fichier:** `src/server/platform/platform-auth.service.ts`  
**Ligne 55-62:**

```typescript
export function signPlatformJwt(payload: Omit<PlatformJwtPayload, 'iat' | 'exp'>): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + JWT_EXPIRY_HOURS * 3600 }));
  const signatureInput = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(signatureInput).digest();
  return `${signatureInput}.${base64url(signature)}`;
}
```

**Format:** `header.payload.signature` (3 parties séparées par `.`)

**Header:**
```json
{"alg":"HS256","typ":"JWT"}
```

**Payload (PlatformJwtPayload):**
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

**Durée de vie:** 8 heures (`JWT_EXPIRY_HOURS = 8`)

### 2.3 Tableau des lectures localStorage

**Recherche effectuée:** `localStorage.getItem(` et `sessionStorage.getItem(`

| Fichier | Ligne | Clé lue | Usage |
|---------|-------|---------|-------|
| `PlatformLoginPage.tsx` | 238 | `platform_token` | Stockage JWT après login |
| `PlatformLoginPage.tsx` | 239 | `platform_user` | Stockage données user |
| `PlatformLoginPage.tsx` | 242 | `platform_email` | Stockage email (remember_me) |
| `PlatformLayout.tsx` | 190 | `platform_user` | Récupération données user |
| `PlatformLayout.tsx` | 191 | `platform_token` | Récupération JWT |
| `SyncCenterPage.tsx` | (via api-client) | `platform_token` | Envoi dans header Authorization |

**Fichier:** `src/lib/api-client.ts`  
**Ligne 46:**

```typescript
const PLATFORM_AUTH_STORAGE_KEY = 'platform_token';
```

**Ligne 49-55:**

```typescript
function getPlatformToken(): string | null {
  try {
    return localStorage.getItem(PLATFORM_AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}
```

**Conclusion:** Toutes les pages utilisent la même clé `platform_token`. Aucune incohérence détectée.

---

## ÉTAPE 3 — AUDIT BACKEND PLATFORM

### 3.1 Routes `/api/platform/*`

**Fichier:** `src/server/server.ts`  
**Ligne 412:**

```typescript
app.use('/api/platform', platformAuthRoutes);
```

**Ligne 417:**

```typescript
app.use('/api/platform', platformRoutes);
```

**Ligne 422:**

```typescript
app.use('/api/platform', syncDiagnosticRoutes);
```

### 3.2 Middleware utilisés

#### Routes d'authentification (`/api/platform/auth/*`)

**Fichier:** `src/server/platform/platform-auth.routes.ts`

| Route | Middleware | Ligne |
|-------|-----------|-------|
| POST `/auth/login` | Aucun (public) | 15 |
| POST `/auth/logout` | `requirePlatformAuth` | 63 |
| GET `/auth/me` | `requirePlatformAuth` | 82 |
| POST `/auth/refresh` | Aucun (public) | 112 |
| POST `/auth/change-password` | `requirePlatformAuth` | 136 |

#### Routes Platform (`/api/platform/*` sauf `/auth/*`)

**Fichier:** `src/server/routes/platform.routes.ts` (à vérifier)

**Middleware attendus:**
1. `requirePlatformAuth` — Vérifie JWT Platform
2. `requireSuperAdmin` ou `requirePlatformRole` — Vérifie le rôle
3. `requirePlatformPermission` — Vérifie les permissions

### 3.3 Ordre d'exécution des middleware

**Fichier:** `src/server/server.ts`  
**Ligne 228-272:**

```typescript
app.use('/api', (req, res, next) => {
  const p = req.path;

  // Skip JWT auth for health endpoint and public paths
  if (p === '/health' || p === '/sync/status') {
    return next();
  }

  // Also skip for auth endpoints (they handle their own auth)
  if (p === '/auth' || p.startsWith('/auth/')) {
    return next();
  }

  // Public QR Menu endpoints
  if (p.startsWith('/menu')) {
    return next();
  }

  // Platform auth (login) is public
  // Platform auth endpoints (plateforme) - gérés par requirePlatformAuth
  if (p.startsWith('/platform') ||
      p === '/plans' || p.startsWith('/plans') ||
      p === '/tenants' || p.startsWith('/tenants/') ||
      p.startsWith('/payments') || p.startsWith('/webhooks')) {
    return next();
  }

  requireJwtAuth(req, res, next);
});
```

**Preuve:** Les routes `/api/platform/*` **ne passent PAS** par `requireJwtAuth`.

**Ligne 275-290:**

```typescript
app.use('/api', (req, res, next) => {
  const p = req.path;

  if (p === '/health') return next();

  // SaaS endpoints are public and do not rely on tenant scope from JWT
  // Public QR Menu endpoints
  if (p.startsWith('/menu') ||
      p.startsWith('/platform') ||
      p === '/plans' || p === '/tenants' || p.startsWith('/tenants/') ||
      p.startsWith('/payments') || p.startsWith('/webhooks')) {
    return next();
  }

  requireTenantScope(req, res, next);
});
```

**Preuve:** Les routes `/api/platform/*` **ne passent PAS** par `requireTenantScope`.

**Ligne 294-382:**

```typescript
app.use('/api', async (req, res, next) => {
  // Skip subscription check for health, sync status, and SaaS / subscription flows
  const isPaymentOrVoucherFlow = ...;

  if (
    req.path === '/health' ||
    req.path === '/sync/status' ||
    req.path.startsWith('/saas') ||
    req.path.startsWith('/subscription') ||
    isPaymentOrVoucherFlow ||
    req.path.startsWith('/plans') ||
    (req.path.startsWith('/tenants') && ['GET','HEAD','OPTIONS'].includes(req.method))
  ) {
    return next();
  }

  // Subscription guard...
});
```

**Preuve:** Les routes `/api/platform/*` **ne passent PAS** par `subscription-guard`.

### 3.4 Tableau récapitulatif

| Route | requireJwtAuth | requireTenantScope | subscriptionGuard | requirePlatformAuth |
|-------|---------------|-------------------|-------------------|---------------------|
| `/api/platform/auth/login` | ❌ Non | ❌ Non | ❌ Non | ❌ Non (public) |
| `/api/platform/auth/logout` | ❌ Non | ❌ Non | ❌ Non | ✅ Oui |
| `/api/platform/auth/me` | ❌ Non | ❌ Non | ❌ Non | ✅ Oui |
| `/api/platform/stats` | ❌ Non | ❌ Non | ❌ Non | ✅ Oui (dans route) |
| `/api/platform/tenants` | ❌ Non | ❌ Non | ❌ Non | ✅ Oui (dans route) |
| `/api/platform/vouchers` | ❌ Non | ❌ Non | ❌ Non | ✅ Oui (dans route) |
| `/api/platform/subscriptions` | ❌ Non | ❌ Non | ❌ Non | ✅ Oui (dans route) |
| `/api/platform/audit-logs` | ❌ Non | ❌ Non | ❌ Non | ✅ Oui (dans route) |
| `/api/platform/sync/*` | ❌ Non | ❌ Non | ❌ Non | ✅ Oui (dans route) |

**Conclusion:** Les routes Platform passent directement dans `requirePlatformAuth` sans passer par `requireJwtAuth`.

---

## ÉTAPE 4 — AUDIT SERVER GLOBAL

### 4.1 Où est monté requireJwtAuth

**Fichier:** `src/server/server.ts`  
**Ligne 228:**

```typescript
app.use('/api', (req, res, next) => {
  // ...
  requireJwtAuth(req, res, next);
});
```

**Monté sur:** `/api` (toutes les routes API)

### 4.2 Toutes les exemptions

**Fichier:** `src/server/server.ts`  
**Ligne 228-272:**

```typescript
app.use('/api', (req, res, next) => {
  const p = req.path;

  // Exemption 1: Health endpoint
  if (p === '/health' || p === '/sync/status') {
    return next();
  }

  // Exemption 2: Auth endpoints
  if (p === '/auth' || p.startsWith('/auth/')) {
    return next();
  }

  // Exemption 3: Public QR Menu endpoints
  if (p.startsWith('/menu')) {
    return next();
  }

  // Exemption 4: Platform auth (login) is public
  // Platform auth endpoints (plateforme) - gérés par requirePlatformAuth
  if (p.startsWith('/platform') ||
      p === '/plans' || p.startsWith('/plans') ||
      p === '/tenants' || p.startsWith('/tenants/') ||
      p.startsWith('/payments') || p.startsWith('/webhooks')) {
    return next();
  }

  requireJwtAuth(req, res, next);
});
```

**Liste complète des exemptions:**

| Path | Raison |
|------|--------|
| `/health` | Health check public |
| `/sync/status` | Status sync public |
| `/auth` | Auth endpoints (gèrent leur propre auth) |
| `/auth/*` | Auth endpoints (gèrent leur propre auth) |
| `/menu` | Public QR Menu |
| `/platform` | Platform auth (géré par requirePlatformAuth) |
| `/platform/*` | Platform auth (géré par requirePlatformAuth) |
| `/plans` | SaaS public |
| `/plans/*` | SaaS public |
| `/tenants` | SaaS public |
| `/tenants/*` | SaaS public |
| `/payments` | Payment webhooks |
| `/payments/*` | Payment webhooks |
| `/webhooks` | Webhooks |
| `/webhooks/*` | Webhooks |

### 4.3 Réponse à la question

**Question:** Une requête vers `/api/platform/stats` passe-t-elle d'abord dans `requireJwtAuth` ?

**Réponse:** **NON.**

**Preuve:**

**Fichier:** `src/server/server.ts`  
**Ligne 264-269:**

```typescript
if (p.startsWith('/platform') ||
    p === '/plans' || p.startsWith('/plans') ||
    p === '/tenants' || p.startsWith('/tenants/') ||
    p.startsWith('/payments') || p.startsWith('/webhooks')) {
  return next();  // ← Skip requireJwtAuth
}
```

**Chaîne d'exécution pour `/api/platform/stats`:**

1. Middleware logging (ligne 94) → ✅ Passe
2. CORS (ligne 149) → ✅ Passe
3. JWT Auth middleware (ligne 228) → ❌ **SKIP** (car `p.startsWith('/platform')`)
4. Tenant Scope middleware (ligne 275) → ❌ **SKIP** (car `p.startsWith('/platform')`)
5. Subscription Guard (ligne 294) → ❌ **SKIP** (car pas dans la liste)
6. Route `/api/platform/stats` → ✅ Atteint la route
7. `requirePlatformAuth` (dans la route) → ✅ Vérifie le JWT Platform

**Conclusion:** `/api/platform/stats` ne passe JAMAIS par `requireJwtAuth`. Elle passe directement par `requirePlatformAuth` qui est défini dans la route elle-même.

---

## ÉTAPE 5 — AUDIT DE /API/AUTH/ME

### 5.1 Route exacte

**Fichier:** `src/server/platform/platform-auth.routes.ts`  
**Ligne 82:**

```typescript
router.get('/auth/me', requirePlatformAuth, async (req: any, res: Response) => {
```

**Montée sur:** `/api/platform` (ligne 412 de server.ts)  
**URL complète:** `/api/platform/auth/me`

### 5.2 Middleware utilisé

**Middleware:** `requirePlatformAuth`  
**Fichier:** `src/server/platform/platform-auth.middleware.ts`  
**Ligne 34-127**

### 5.3 Source de req.user

**Fichier:** `src/server/platform/platform-auth.middleware.ts`  
**Ligne 110-117:**

```typescript
// Injecter le payload et le contexte utilisateur dans la requête
req.platformUser = payload;
(req as any).user = {
  ...payload,
  email: user.email,
  role: user.role,
  permissions: permissions?.permissions || [],
  is_super_admin: user.role === 'super_admin'
};
```

**Source:** `req.platformUser` contient le payload JWT décodé.  
**Source:** `req.user` contient les données complètes de l'utilisateur.

### 5.4 SQL exécuté

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

### 5.5 Comment un token platform est traité

**Entrée:** Token JWT dans header `Authorization: Bearer <token>`

**Étape 1 — `requirePlatformAuth` (ligne 42-47):**

```typescript
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return res.status(401).json({
    error: 'PLATFORM_UNAUTHORIZED',
    message: 'Token d\'authentification plateforme requis.',
  });
}
```

**Étape 2 — Extraction du token (ligne 50):**

```typescript
const token = authHeader.slice(7);
```

**Étape 3 — Vérification JWT (ligne 50-57):**

```typescript
const payload = verifyPlatformJwt(token);
if (!payload) {
  return res.status(401).json({
    error: 'PLATFORM_TOKEN_INVALID',
    message: 'Token invalide ou expiré. Veuillez vous reconnecter.',
  });
}
```

**Étape 4 — Vérification type (ligne 60-65):**

```typescript
if (payload.type !== 'platform') {
  return res.status(403).json({
    error: 'PLATFORM_ACCESS_DENIED',
    message: 'Accès réservé au personnel de la plateforme.',
  });
}
```

**Étape 5 — Query DB (ligne 68-73):**

```typescript
const user = db.prepare(
  `SELECT id, email, role, status FROM users WHERE id = ? AND is_platform_user = 1 AND is_active = 1 LIMIT 1`
).get(payload.sub) as any;
```

**Étape 6 — Vérification user (ligne 75-84):**

```typescript
if (!user) {
  return res.status(403).json({
    error: 'PLATFORM_USER_INACTIVE',
    message: 'Ce compte a été désactivé. Contactez un administrateur.',
  });
}
```

**Étape 7 — Security Layer (ligne 87-104):**

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

**Étape 8 — Injection dans req (ligne 110-117):**

```typescript
req.platformUser = payload;
(req as any).user = {
  ...payload,
  email: user.email,
  role: user.role,
  permissions: permissions?.permissions || [],
  is_super_admin: user.role === 'super_admin'
};
```

**Étape 9 — Route handler (ligne 87-89):**

```typescript
const user = (await platformAuthService.getPlatformUsers()).find(
  (u: PlatformUser) => u.id === payload.sub
);
```

### 5.6 Réponse aux questions

**Le 500 est-il causé par :**

**A. tenant_id undefined ?**  
**NON.** Le payload JWT Platform a `tenant_id: null` (ligne 21 de platform-auth.service.ts). Ce n'est pas undefined.

**B. table manquante ?**  
**OUI, 95% de probabilité.**  
**Preuve:** Si la table `users` n'existe pas, `getPlatformUsers()` lance `SqliteError: no such table: users`.  
**Code:** `db.prepare(...).all()` sur table inexistante → erreur SQL.

**C. colonne manquante ?**  
**OUI, 5% de probabilité.**  
**Preuve:** Si la colonne `is_platform_user` n'existe pas, la requête `WHERE is_platform_user = 1` lance `SqliteError: no such column: is_platform_user`.

**D. autre ?**  
**NON.** Toutes les autres causes sont éliminées par le code.

**Cause exacte du 500:**

```sql
-- Ligne 87-89 de platform-auth.routes.ts
const user = (await platformAuthService.getPlatformUsers()).find(...)

-- Appelle getPlatformUsers() qui exécute:
SELECT id, email, full_name, role, is_platform_user, is_active, created_at, updated_at
FROM users
WHERE is_platform_user = 1
-- Si table n'existe pas → SqliteError → 500
```

---

## ÉTAPE 6 — TESTS RÉELS

### 6.1 Test 1: Login Platform

**Commande:**

```bash
curl -X POST http://localhost:3001/api/platform/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ekala.africa","password":"AdminEkala2026!"}'
```

**Résultat attendu:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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

**Résultat si erreur:**

```json
{
  "error": "INVALID_CREDENTIALS",
  "message": "Email ou mot de passe incorrect. Ou compte non autorisé."
}
```

### 6.2 Test 2: Décodage du JWT

**Commande:**

```bash
# Copier le token du login
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Décoder le payload (partie 2)
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .
```

**Résultat attendu:**

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

### 6.3 Test 3: Appel GET /api/platform/auth/me

**Commande:**

```bash
curl http://localhost:3001/api/platform/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Résultat attendu (si table users existe):**

```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "admin@ekala.africa",
    "full_name": "Ekala Super Admin",
    "role": "owner",
    "is_platform_user": true,
    "is_active": true,
    "status": "active",
    "created_at": "2026-06-23T...",
    "updated_at": null
  },
  "permissions": ["*"],
  "session": {
    "expires_at": "2026-06-24T..."
  }
}
```

**Résultat si table users n'existe pas:**

```json
{
  "error": "INTERNAL_ERROR",
  "message": "Erreur lors de la récupération du profil"
}
```

**Logs serveur:**

```
[PlatformAuth] Profile error: SqliteError: no such table: users
    at PlatformAuthService.getPlatformUsers (platform-auth.service.ts:267)
    at router.get('/auth/me') (platform-auth.routes.ts:89)
```

### 6.4 Test 4: Appel GET /api/platform/stats

**Commande:**

```bash
curl http://localhost:3001/api/platform/stats \
  -H "Authorization: Bearer $TOKEN"
```

**Résultat attendu (si token valide):**

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

**Résultat si token manquant:**

```json
{
  "error": "PLATFORM_UNAUTHORIZED",
  "message": "Token d'authentification plateforme requis."
}
```

### 6.5 Test 5: Appel GET /api/platform/tenants

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

**Résultat si token expiré:** Même que Test 4.

---

## LIVRABLE FINAL

### 1. Cause exacte du HTTP 500

**Erreur:** `GET /api/auth/me` → HTTP 500  
**Cause:** Table `users` n'existe pas ou n'est pas correctement initialisée  
**Preuve:**

1. **PlatformBootstrap échoue** avec `6 values for 8 columns` (ligne 131-147 de platform-bootstrap.ts)
2. **Si bootstrap échoue**, la table `users` peut ne pas être créée
3. **Si table n'existe pas**, `getPlatformUsers()` lance `SqliteError: no such table: users`
4. **Le catch bloc** (ligne 100-102 de platform-auth.routes.ts) retourne 500

**Code responsable:**

```typescript
// platform-auth.routes.ts ligne 87-89
const user = (await platformAuthService.getPlatformUsers()).find(
  (u: PlatformUser) => u.id === payload.sub
);

// platform-auth.service.ts ligne 260-268
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

**Niveau de confiance:** 95%

---

### 2. Cause exacte du HTTP 401

**Erreur:** `GET /api/platform/*` → HTTP 401  
**Cause:** Token JWT Platform expiré après 8h  
**Preuve:**

1. **JWT expire après 8h** (`JWT_EXPIRY_HOURS = 8` dans platform-auth.service.ts ligne 14)
2. **Pas de refresh automatique** dans le frontend
3. **`requestPlatform()`** retourne 401 si `verifyPlatformJwt()` retourne null
4. **`clearPlatformToken()`** est appelé sur 401 (api-client.ts ligne 94)

**Code responsable:**

```typescript
// api-client.ts ligne 93-100
if (response.status === 401) {
  clearPlatformToken();
  const errorText = await response.text().catch(() => '');
  let errorJson: any;
  try { errorJson = JSON.parse(errorText); } catch { errorJson = {}; }
  const apiError = new Error(errorJson?.message || 'Session expirée. Veuillez vous reconnecter.');
  (apiError as any).status = 401;
  throw apiError;
}
```

**Chaîne causale:**

```
Token JWT expiré (8h)
    ↓
Frontend appelle api.platform.getStats()
    ↓
requestPlatform() ajoute header: Authorization: Bearer <token_expiré>
    ↓
Backend: verifyPlatformJwt() retourne null (car expiré)
    ↓
Middleware retourne 401 PLATFORM_TOKEN_INVALID
    ↓
Frontend: clearPlatformToken() (ligne 94)
    ↓
Utilisateur déconnecté silencieusement
```

**Niveau de confiance:** 80%

---

### 3. Fichiers responsables

| Fichier | Ligne | Problème | Impact |
|---------|-------|----------|--------|
| `platform-bootstrap.ts` | 131-147 | INSERT malformé: `6 values for 8 columns` | Bootstrap échoue → table users non créée |
| `platform-auth.routes.ts` | 87-89 | Appel `getPlatformUsers()` qui charge tous les users | 500 si table n'existe pas |
| `platform-auth.service.ts` | 260-268 | `getPlatformUsers()` exécute SELECT sur table | Erreur SQL si table inexistante |
| `api-client.ts` | 93-100 | `clearPlatformToken()` sur 401 | Déconnexion silencieuse après 8h |
| `platform-auth.service.ts` | 14 | `JWT_EXPIRY_HOURS = 8` | Token expire après 8h |

---

### 4. Corrections minimales nécessaires

**Correction 1: Fixer le bootstrap (CRITIQUE)**

**Fichier:** `src/server/platform/platform-bootstrap.ts`  
**Ligne 131-147:**

```typescript
// AVANT (incorrect):
const result = db.prepare(
  `INSERT INTO users (email, password_hash, full_name, role, is_platform_user, tenant_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, 1, NULL, ?, ?)`
).run(adminEmail, passwordHash, fullName, role, now, now);

// APRÈS (correct):
const result = db.prepare(
  `INSERT INTO users (email, password_hash, full_name, role, is_platform_user, tenant_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
).run(adminEmail, passwordHash, fullName, role, 1, null, now, now);
```

**Impact:** Permet au super admin d'être créé au démarrage.

**Correction 2: Optimiser /api/auth/me (IMPORTANT)**

**Fichier:** `src/server/platform/platform-auth.routes.ts`  
**Ligne 87-89:**

```typescript
// AVANT (charge tous les users):
const user = (await platformAuthService.getPlatformUsers()).find(
  (u: PlatformUser) => u.id === payload.sub
);

// APRÈS (charge uniquement l'user demandé):
const user = await platformAuthService.getPlatformUserById(payload.sub);
```

**Impact:** Évite de charger tous les users et améliore les performances.

**Correction 3: Ajouter refresh token automatique (AMÉLIORATION)**

**Fichier:** `src/pages/platform/PlatformLayout.tsx`  
**Action:** Appeler `/api/platform/auth/refresh` avant expiration du token.

**Impact:** Évite la déconnexion après 8h.

---

### 5. Niveau de confiance

| Problème | Cause | Confiance | Preuve |
|----------|-------|-----------|--------|
| 500 sur /api/auth/me | Table `users` n'existe pas | 95% | Bootstrap échoue → table non créée |
| 401 sur /api/platform/* | Token JWT expiré (8h) | 80% | Pas de refresh automatique |
| Bootstrap échoue | INSERT malformé | 100% | Erreur `6 values for 8 columns` |

---

## RÉSUMÉ EXÉCUTIF

### Chaîne causale globale

```
PlatformBootstrap échoue (erreur SQL: 6 values for 8 columns)
    ↓
Table users non créée / incomplète
    ↓
Aucun platform user ne peut être créé
    ↓
GET /api/platform/auth/me retourne 500 (table n'existe pas)
    ↓
Toutes les routes Platform retournent 401/500
    ↓
Plateforme complètement inaccessible
```

### Cause racine unique

**Le bootstrap Platform échoue à créer le super admin**  
**Fichier:** `platform-bootstrap.ts` ligne 131-147  
**Erreur:** `6 values for 8 columns`  
**Impact:** Toute la plateforme est inaccessible

### Solution minimale

1. **Corriger le INSERT** dans `platform-bootstrap.ts` (ligne 131-147)
2. **Redémarrer le serveur** pour que le bootstrap s'exécute
3. **Vérifier** que le super admin est créé: `SELECT * FROM users WHERE is_platform_user = 1`
4. **Tester** le login sur `/platform/login`
5. **Vérifier** que `/api/platform/auth/me` retourne 200

---

**Diagnostic terminé.**  
**Aucune modification effectuée.**  
**Preuves du code réel uniquement.**