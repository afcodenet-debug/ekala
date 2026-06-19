# Phase 6 — JWT Multi-Tenant Authentication

## Overview

This phase replaces the insecure mock authentication system with a professional **JWT-based multi-tenant authentication** system that follows SaaS industry best practices.

## Problems Solved

| Before (Phase 1-5) | After (Phase 6) |
|---|---|
| Auth via `x-user-role` header (spoofable) | JWT Bearer token on every request |
| No server-side session validation | HMAC-SHA256 signed JWT with expiry |
| PIN-only login (no tenant scoping) | Tenant slug + PIN → scoped JWT |
| User stored in localStorage only | JWT token + user profile with tenant context |
| No token refresh mechanism | Auto-refresh endpoint + expiry handling |
| Auth middleware always sets `user.id = 1` | Real user ID from JWT payload |

## Architecture

### Backend

```
┌─────────────────────────────────────────────────┐
│              POST /api/auth/login/email          │
│              (admin: email + password)           │
│                     ↓                            │
│            signJwt({sub, tenant_id, role})       │
│                     ↓                            │
│              { token, user } → response          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         POST /api/auth/login/pin                 │
│         (staff: tenant_slug + PIN)               │
│                     ↓                            │
│     verify tenant exists → scope by tenant_id    │
│                     ↓                            │
│            signJwt({sub, tenant_id, role})       │
│                     ↓                            │
│              { token, user } → response          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         All protected routes                     │
│         Authorization: Bearer <jwt>              │
│                     ↓                            │
│         requireJwtAuth middleware                 │
│                     ↓                            │
│         verifyJwt(token) → req.user              │
│         (includes tenant_id for data isolation)  │
└─────────────────────────────────────────────────┘
```

### Frontend

```
┌─────────────────────────────────────────────────┐
│         API Client (api-client.ts)               │
│                     ↓                            │
│         getToken() from localStorage            │
│                     ↓                            │
│         Auto-attach: Authorization: Bearer <jwt> │
│                     ↓                            │
│         On 401 → clear token → redirect /login   │
└─────────────────────────────────────────────────┘
```

## New Files

| File | Purpose |
|---|---|
| `src/server/middleware/jwt-auth.ts` | JWT sign/verify + auth middleware |
| `src/server/services/auth.service.ts` | Consolidated auth routes (email, PIN, setup, refresh, /me) |
| `backend/migrations/022_jwt_auth_config.sql` | App settings table for JWT config |

## Modified Files

| File | Changes |
|---|---|
| `src/server/config/env.ts` | Added `JWT_SECRET` env var |
| `src/server/server.ts` | Replaced old auth routes with `auth.service.ts` |
| `src/lib/api-client.ts` | Auto-Bearer token, 401 handling, new auth endpoints |
| `src/stores/useAuthStore.ts` | JWT token storage, `loginEmail()`, `loginPin()` methods |
| `src/pages/auth/LoginPage.tsx` | 2-step flow: tenant selection → credentials |
| `src/components/Sidebar.tsx` | Tenant badge in footer |
| `.env.example` | Added `JWT_SECRET` variable |

## Login Flow (Multi-Tenant)

### Step 1: Tenant Selection
1. User enters establishment slug (e.g., `mama-africa`)
2. Frontend calls `GET /api/auth/tenants/:slug`
3. Tenant info is loaded (name, logo, primary_color)
4. UI adapts to tenant branding

### Step 2: Credentials
- **Admin mode**: email + password → JWT
- **Staff mode**: optional identity (username/phone) + 4-digit PIN → JWT

### JWT Token Contents
```json
{
  "sub": 42,           // user ID
  "tenant_id": 5,      // tenant ID (for data isolation)
  "role": "manager",   // user role within the tenant
  "email": "admin@example.com",
  "full_name": "John Doe",
  "iat": 1728000000,
  "exp": 1728086400    // 24h expiry
}
```

## Security Features

1. **HMAC-SHA256 signing** — zero external dependencies for JWT
2. **Timing-safe comparison** — prevents timing attacks on signature verification
3. **Rate limiting** — 15 attempts per minute per IP per endpoint
4. **Auto token expiry** — 24h session lifetime
5. **401 auto-redirect** — expired tokens redirect to login
6. **Tenant scoping** — PIN login requires tenant_slug for isolation
7. **Password hashing** — PBKDF2 with random salt (100K iterations, SHA-512)

## Environment Variables

```bash
# JWT Secret (REQUIRED in production)
JWT_SECRET=your-random-secret-here-min-32-chars
```

Generate a secure secret:
```bash
openssl rand -hex 32
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login/email` | None | Admin login (email + password) |
| POST | `/api/auth/login/pin` | None | Staff login (tenant_slug + PIN) |
| POST | `/api/auth/setup` | None | Create admin account |
| POST | `/api/auth/refresh` | None | Refresh JWT token |
| GET | `/api/auth/me` | Bearer | Get current user profile |
| GET | `/api/auth/status` | None | Health check |
| GET | `/api/auth/tenants/:slug` | None | Get tenant info for login screen |

## Backward Compatibility

- The legacy `/api/auth/login` endpoint is still available as `api.auth.login()` in the API client
- The `x-user-role` header is still accepted by CORS configuration
- Existing localStorage key `olive-pos-auth` has been replaced by `ekala-auth`

## Deployment Notes

1. Set `JWT_SECRET` environment variable on Render/Vercel
2. Ensure Supabase `users` table has `password_hash` and `has_setup_pin` columns
3. Run migration `022_jwt_auth_config.sql` on Supabase
4. The old `auth.ts` and `auth-setup.ts` routes can be removed after verification