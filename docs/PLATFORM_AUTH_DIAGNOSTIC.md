# PLATFORM_AUTH_DIAGNOSTIC
**Date:** 2026-06-22  
**Contexte:** Session de débogage après re-connexion plateforme — pages non chargées, erreurs dans la console.

---

## 1. Route GET /api/auth/me — 500 interne

### Implémentation
**Fichier:** `src/server/services/auth.service.ts`  
**Ligne:** 698  
```ts
router.get('/me', requireJwtAuth, async (req: any, res: Response) => {
```

**Dépendances:**
- **Middleware:** `requireJwtAuth` (vérifie le JWT tenant, pas platform).
- **Accès:** `req.user.sub`, `req.user.tenant_id`, `req.user.role`.
- **Chemin normal (Supabase):** lignes 703-739.
- **Chemin local (SQLite):** lignes 742-782 — utilise `require('../db/database').default`.

### Requête SQL locale (ligne 746-757)
```sql
SELECT u.id, u.full_name, u.email, u.phone, u.username, u.role, u.tenant_id,
       t.name as tenant_name, t.slug as tenant_slug, t.status as tenant_status,
       s.status as sub_status, s.current_period_end, p.name as plan_name
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status IN (...)
LEFT JOIN plans p ON s.plan_id = p.id
WHERE u.id = ? AND u.tenant_id = ?
ORDER BY s.id DESC
LIMIT 1
```

### Causes probables du 500 (catch à la ligne 783)
1. **`req.user` ou `tenant_id` manquant:** `requireJwtAuth` valide le token, mais si `payload.tenant_id` est absent/undefined, la valeur passée à `?` est `undefined` → SQLite lève `TypeError` ou `SqliteError`.
2. **`require('../db/database').default` retourne le Proxy callableDb (une fonction):** Le Proxy expose bien `.prepare` (testé en node — OK), donc ce n'est pas la cause racine. Mais si l'une des colonnes SQL n'existe pas, ça crash.
3. **Colonne absente dans `users`:** la table `users` n'a pas de colonne `status`, mais la requête SQL locale ne la demande pas → OK.
4. **LEFT JOIN sur `subscriptions` sans ligne:** amène `NULL` partout → géré par le code (ligne 762: `user.sub_status || user.tenant_status || 'trial'`).

**Cause la plus probable:** requête `/api/auth/me` appelée par le navigateur avec un **token platform** (ou sans token) au lieu d'un token tenant. `requireJwtAuth` valide le format, mais `req.user.tenant_id` est absent (le JWT platform n'a pas `tenant_id`). La valeur `undefined` est passée au WHERE → erreur SQLite → 500.

`(0 , database_1.default) is not a function` ou similaire ne **se produit PAS** pour `/api/auth/me` (le Proxy fonctionne). Le 500 est bien une erreur SQL paramétrée.

### Stack trace attendue
```
[auth.service.ts:698] router.get('/me', ...)
  → requireJwtAuth(req, res, next) // OK
  → ligne 700: const { sub, tenant_id } = req.user;
    - Si tenant_id === undefined → SQL échoue à la ligne 754
    → catch ligne 783: console.error('[Auth] /me error:', e)
    → res.status(500).json({ error: 'PROFILE_FAILED' })
```

---

## 2. Plateforme — URLs API utilisées

### Tableau complet

| Fichier | URL par défaut | Variable override |
|---------|---------------|-------------------|
| `src/lib/api-client.ts:40` | `https://ekala-api.onrender.com/api` | `API_BASE_URL`, `VITE_API_BASE_URL` |
| `src/pages/saas/SignupPage.tsx:16` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/pages/saas/BillingPageV2.tsx:13` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/pages/saas/BillingPage.tsx:12` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/pages/saas/AdminPaymentsPage.tsx:16` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/pages/saas/PricingPage.tsx:495` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/pages/saas/SetupAccountPage.tsx:12` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/pages/platform/VouchersPage.tsx` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/pages/platform/TenantsPage.tsx` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/pages/platform/SyncCenterPage.tsx` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/pages/platform/SubscriptionsPage.tsx` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/pages/platform/SettingsPage.tsx` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/pages/platform/PlatformDashboard.tsx` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/pages/platform/AuditLogsPage.tsx` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/pages/admin/AdminVouchersPage.tsx` | `https://ekala-api.onrender.com/api` | `VITE_API_BASE_URL` |
| `src/server/routes/auth-setup.ts:49` | `https://ekala-api.onrender.com` | `VITE_API_BASE_URL` |
| **Exception — PublicMenuPage.tsx:39** | `http://localhost:3001` | Pas d'override |

**Résultat:** Toutes les pages plateforme ciblent l'URL de production Render en l'absence de variable `VITE_API_BASE_URL`. Le comportement en dev local dépend donc de cette variable d'environnement qui n'est pas définie dans `.env`.

---

## 3. Middleware Platform — conditions de 401

### requirePlatformAuth (`platform-auth.middleware.ts`)
Produit un **401** si:
- Header `Authorization` absent ou sans préfixe `Bearer `
- Token JWT invalide (signature, expiration)
- `payload.is_platform_user === false` → 403

Produit un **403** si:
- `db('users').where(...).first()` retourne `null` (utilisateur inactif)

### requireSuperAdmin (`middleware/super-admin.middleware.ts`)
Produit un **401** si:
- `req.user` absent

Produit un **403** si:
- `user.is_super_admin` falsy
- `user.tenant_id` truthy (super_admin ne peut pas avoir de tenant)
- `user.role !== 'super_admin'`

**Problème détecté:** le login plateforme (`platform-auth.service.ts`) insère et retourne un rôle `'owner'`, pas `'super_admin'`. Si une route plateforme utilise `requireSuperAdmin` avec `user.role === 'super_admin'`, le check échoue. Les routes plateforme ont maintenant été migrées vers `requirePlatformAuth` (correction en cours), mais certaines gardes pourraient rester.

### JWT verification (`jwt-auth.ts`)
Produit un **401** (`TOKEN_INVALID`) si:
- Format du token incorrect
- Signature invalide (secret mismatch)
- Token expiré

**Secret utilisé:** `ekala-dev-fallback-secret-change-in-production-2026`. Si le token a été généré avec un autre secret, la vérification échoue.

---

## 4. Authentification Platform — État réel du système

### Diagramme de flux

```
Frontend (PlatformLoginPage.tsx)
    ↓ POST /api/platform/auth/login {email, password}
    ↓
PlatformAuthService.login()
    ↓ bcrypt.compare() + SELECT users WHERE email=? AND is_platform_user=1
    ↓
signPlatformJwt({ sub, email, role, is_platform_user: true })
    ↓
Response { token, user: { id, email, full_name, role, is_platform_user } }
    ↓
LocalStorage: localStorage.setItem('platform_token', data.token)  ← clé = 'platform_token'
    ↓
Navigation vers /platform/*
    ↓
PlatformLayout.tsx: const token = localStorage.getItem('platform_token')  ← lit la bonne clé
    ↓
Requêtes API: header = Authorization: Bearer <platform_token>
    ↓
requirePlatformAuth middleware
    ↓ verifyPlatformJwt (même secret ou JWT_PLATFORM_SECRET)
    ↓ SQLite: SELECT * FROM users WHERE id=? AND is_platform_user=1 AND is_active=1
    ↓ req.platformUser = payload + (req as any).user = { ...payload, is_super_admin: true }
    ↓
Routes /api/platform/*
```

### Existence des endpoints

| Endpoint | Existe | Fichier | Note |
|----------|--------|---------|------|
| `POST /api/platform/auth/login` | OUI | `platform-auth.routes.ts:14` | Retourne `{ token, user }` |
| `POST /api/platform/auth/logout` | **NON** | `platform-auth.routes.ts` | Absent. Uniquement logout tenant |
| `GET /api/platform/auth/me` | OUI | `platform-auth.routes.ts:83` | Requiert `requirePlatformAuth` |
| `POST /api/platform/auth/refresh` | OUI | `platform-auth.routes.ts:111` | Rafraîchit le platform JWT |
| `POST /api/platform/auth/change-password` | OUI | `platform-auth.routes.ts:136` | Change le mot de passe |
| Génération JWT platform | OUI | `platform-auth.service.ts:56` (`signPlatformJwt`) | Secret: `JWT_PLATFORM_SECRET` ou `JWT_SECRET` |
| Stockage token frontend | Partiel | `PlatformLoginPage.tsx:238` | Clé: `'platform_token'` |
| Refresh session | OUI | `platform-auth.service.ts:153` (`refreshToken`) | Vérifie DB + is_active |

### Incohérences critiques identifiées

| Problème | Fichier | Ligne | Clé utilisée |
|----------|---------|-------|--------------|
| Login écrit `platform_token` | PlatformLoginPage.tsx | 238 | `localStorage.setItem('platform_token', ...)` |
| VouchersPage lit `token` | VouchersPage.tsx | 187, 210, 233 | `localStorage.getItem('token')` |
| TenantsPage lit `token` | TenantsPage.tsx | 276, 306, 330 | `localStorage.getItem('token')` |
| SubscriptionsPage lit `token` | SubscriptionsPage.tsx | 181 | `localStorage.getItem('token')` |
| SettingsPage lit `token` | SettingsPage.tsx | 155, 176 | `localStorage.getItem('token')` |
| PlatformDashboard lit `token` | PlatformDashboard.tsx | 186 | `localStorage.getItem('token')` |
| AuditLogsPage lit `token` | AuditLogsPage.tsx | 176 | `localStorage.getItem('token')` |
| SyncCenterPage lit `token` | SyncCenterPage.tsx | 224, 244, 262, 288, 314 | `localStorage.getItem('token')` |
| PlatformLayout lit `platform_token` | PlatformLayout.tsx | 191 | `localStorage.getItem('platform_token')` |

**Authentification réussie** → token stocké sous `'platform_token'`.  
**Toutes les requêtes API** lisent `'token'` → header `Bearer null` → **401 systématique**.

---

## 5. Rapport final

### Cause du 500 sur /api/auth/me
**Cause racine:** la route `/api/auth/me` est une route **tenant** (`requireJwtAuth`), pas une route plateforme. Si elle est appelée avec le token plateforme (qui n'a pas `tenant_id`) ou sans token, `req.user.tenant_id` est `undefined`. La requête SQL locale utilise `WHERE u.id = ? AND u.tenant_id = ?` avec `tenant_id = undefined`, SQLite lève une erreur, le catch retourne 500.

**Stack trace attendue:**
```
[auth.service.ts:698] router.get('/me', requireJwtAuth, ...)
  → ligne 700: const { sub, tenant_id } = req.user;  // tenant_id = undefined
  → ligne 746-757: db.prepare(...).get(sub, undefined)  // SQLite erreur
  → catch ligne 783: console.error('[Auth] /me error:', e)
  → res.status(500).json({ error: 'PROFILE_FAILED' })
```

### Cause des 401 Platform
**Deux causes combinées:**
1. **Incohérence de clé localStorage:** les pages plateforme envoient `Bearer ${localStorage.getItem('token')}` mais le login écrit sous `localStorage.setItem('platform_token', ...)`. Par conséquent, le header envoyé est `Bearer null` → 401 immédiat.
2. **Pas d'exemption middleware JWT pour `/platform` dans le serveur local compilé:** le middleware JWT global (`requireJwtAuth`) sur `/api` intercepte `/api/platform/*` avant que `requirePlatformAuth` ne soit atteint. Même avec un bon token, le JWT global échoue car le JWT platform n'est pas signé avec le même `sub`/`tenant_id` attendu par `requireJwtAuth`.

### Corrections nécessaires (à appliquer hors de ce diagnostic)

1. **localStorage — uniformiser la clé:**
   - Changer toutes les pages plateforme pour lire `localStorage.getItem('platform_token')` au lieu de `localStorage.getItem('token')`.
   - OU modifier `PlatformLoginPage.tsx` pour écrire sous la clé `'token'` (risqué car conflit avec le tenant auth).

2. **server.ts — exemption JWT pour `/platform`:**
   - Ajouter `p.startsWith('/platform')` dans les exemptions du middleware JWT global (ligne ~260 et ~275).
   - Laisser `requirePlatformAuth` gérer seul l'authentification des routes plateforme.

3. **GET /api/auth/me — ne pas appeler avec un token platform:**
   - Cette route est une route tenant. Les pages plateforme ne doivent pas l'appeler avec un token platform.

### Niveau de complétude du système Platform

| Module | État | Détail |
|--------|------|--------|
| Login plateforme | ✅ Fonctionnel | `POST /api/platform/auth/login` testé avec succès |
| JWT platform | ✅ Fonctionnel | Signature + vérification OK |
| Middleware plateforme | ⚠️ Partiellement | `requirePlatformAuth` OK, `requireSuperAdmin` inutilisable car attend `role='super_admin'` mais DB a `'owner'` |
| Stockage token frontend | ❌ Cassé | Incohérence `platform_token` vs `token` |
| Routes CRUD plateforme | ⚠️ Partiellement | `platform.routes.ts` fonctionne avec le callable DB, mais certaines routes utilisent encore `requireSuperAdmin` |
| RBAC plateforme | ❌ Non fonctionnel | Tables `platform_roles`, `platform_permissions`, `platform_role_permissions` n'existent pas |
| Billing/Stats | ✅ Opérationnel | `/api/platform/stats` testé avec succès |
| Tenants CRUD | ⚠️ Partiellement | `/api/platform/tenants` retourné, mais incohérence token |
| Sync jobs | ✅ Opérationnel | `/api/platform/sync/jobs` OK |
| Logs audit | ⚠️ Partiellement | Table `platform_audit_logs` absente, erreur loguée mais non bloquante |

**Complétude globale: ~55%**

---

*Diagnostic produit sans modification de code.*
