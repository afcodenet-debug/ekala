# PRODUCTION READINESS REPORT — SUPER ADMIN PLATFORM

**Date**: 2026-06-22  
**Audit Type**: Technical Review  
**Scope**: Super Admin Platform (backend + frontend)  
**Score**: 64/100  

---

## EXECUTIVE SUMMARY

La Super Admin Platform est **fonctionnelle** mais comporte **11 Critical** et **8 High** issues qui doivent être résolues avant mise en production avec 1 000+ tenants.

| Severité | Count |
|----------|-------|
| 🔴 Critical | 11 |
| 🟠 High | 8 |
| 🟡 Medium | 5 |
| 🟢 Low | 6 |
| **Total** | **30** |

---

## 1. 🔴 CRITICAL ISSUES (11)

### C1 — JWT_SECRET hardcodé en fallback
**Fichier**: `src/server/middleware/jwt-auth.ts` (line 16)
**Problème**: `const JWT_SECRET = process.env.JWT_SECRET || 'ekala-dev-fallback-secret-change-in-production-2026';`
**Risque**: En production, si la variable d'env JWT_SECRET n'est pas définie, le secret par défaut est utilisé. Ce secret est lisible dans le code source (Git).
**Impact**: Un attaquant peut forger des JWT valides pour n'importe quel utilisateur/tentant.

### C2 — Absence de rate limiting sur /api/platform/auth/login
**Fichier**: `src/server/platform/platform-auth.routes.ts`
**Problème**: Aucune limitation du nombre de tentatives de connexion.
**Risque**: Brute-force attack sur le login platform. Un attaquant peut essayer des millions de mots de passe.
**Impact**: Compromission du compte super admin.

### C3 — Pas de validation email coté serveur
**Fichier**: `src/server/platform/platform-auth.service.ts` (line 67-69)
**Problème**: Aucune validation du format email (regex, MX lookup, etc.).
**Risque**: Accepte des emails invalides (`admin@`, `@x`, etc.) pour la création de comptes.
**Impact**: Création de comptes avec des emails non délivrables.

### C4 — Pas de gestion des sessions concurrentes
**Fichier**: `src/server/platform/platform-auth.service.ts`
**Problème**: Aucune vérification si un admin est déjà connecté ailleurs. Même JWT reste valide après changement de mot de passe.
**Risque**: Un admin démissionnaire conserve un accès jusqu'à expiration du JWT (8h).
**Impact**: Fuite de données sensibles.

### C5 — Aucune transaction SQL sur les opérations sensibles
**Fichier**: `src/server/routes/platform.routes.ts`
**Problème**: Les endpoints `suspend`, `activate`, `approve`, `reject` modifient plusieurs tables (tenants, subscriptions, tenant_users, audit_logs) **sans transaction**.
**Risque**: Crash à mi-opération = état incohérent (tenant suspendu mais subscription active).
**Impact**: Corruption de la cohérence des données.

### C6 — Absence de soft delete sur les entités critiques
**Fichier**: `backend/migrations/040_create_platform_audit_logs.sql`, `src/server/routes/platform.routes.ts`
**Problème**: Les logs d'audit utilisent DELETE (suppression physique). Aucune entité platform n'a de `deleted_at`.
**Risque**: Impossible de récupérer des données supprimées accidentellement.
**Impact**: Perte définitive de données d'audit.

### C7 — Requêtes N+1 dans le cron d'expiration
**Fichier**: `src/server/saas/cron/expiration.cron.ts` (lines 37-48)
**Problème**: Pour chaque voucher expiré, une requête SELECT individuelle est faite pour charger tenant + plan, puis un email send.
**Risque**: Avec 1 000 vouchers expirés, ce sont 2 000+ requêtes SQL + 1 000 appels email.
**Impact**: Timeout, blocage du cron, accumulation.

### C8 — Cron jobs concurrents sans verrouillage
**Fichier**: `src/server/saas/cron/expiration.cron.ts` (line 90)
**Problème**: 3 cron jobs séparés (`SubscriptionCron`, `VoucherExpirationCron`, `ExpirationCron`) s'exécutent en parallèle et modifient les mêmes enregistrements.
**Risque**: Race condition — deux crons tentent d'expirer le même abonnement simultanément.
**Impact**: Données corrompues.

### C9 — Aucune validation de tenant_id sur les routes platform
**Fichier**: `src/server/routes/platform.routes.ts`
**Problème**: Les endpoints `/api/platform/tenants/:id/suspend`, `activate`, etc. ne vérifient **pas** que l'ID passé est un tenant valide avant de modifier les données.
**Risque**: Un ID négatif ou inexistant peut causer des comportements inattendus.
**Impact**: Erreurs silencieuses.

### C10 — Aucune limitation de taille des payloads API
**Fichier**: `src/server/server.ts` (line 60-61)
**Problème**: `app.use(express.json({ limit: '50mb' }))` — limite de 50MB.
**Risque**: Un attaquant peut envoyer 50MB de JSON pour saturer le serveur.
**Impact**: Denial of Service (DoS).

### C11 — Aucune pagination sur le cron de nettoyage
**Fichier**: `src/server/saas/cron/expiration.cron.ts` (line 107-113)
**Problème**: `DELETE FROM billing_audit_logs WHERE created_at < ?` sans LIMIT. Avec 1M+ logs, cette requête peut locker la table pendant plusieurs secondes.
**Risque**: Blocage de toute la base de données pendant le cleanup.
**Impact**: Indisponibilité de la plateforme.

---

## 2. 🟠 HIGH ISSUES (8)

### H1 — Aucun refresh token (JWT rotation)
**Fichier**: `src/server/platform/platform-auth.service.ts`
**Problème**: Le refresh token ne fait que resigner un nouveau JWT avec le même payload. Pas de rotation de refresh, pas d'invalidation.
**Risque**: Un token volé reste valide jusqu'à expiration.

### H2 — Pas de vérification du rôle pendant refresh token
**Fichier**: `src/server/platform/platform-auth.service.ts` (lines 122-131)
**Problème**: `refreshToken` vérifie que l'utilisateur existe et est actif, mais **ne vérifie pas** que son rôle platform est toujours valide.
**Risque**: Un admin rétrogradé garde son ancien rôle via refresh.

### H3 — Aucune gestion du rate limiting sur le refresh token
**Fichier**: `src/server/platform/platform-auth.routes.ts`
**Problème**: Le endpoint `/api/platform/auth/refresh` est public (pas de middleware) et peut être appelé sans limite.
**Risque**: Brute-force du refresh token endpoint.

### H4 — Aucune validation de l'unicité des permissions par rôle
**Fichier**: `backend/migrations/037_add_platform_roles.sql`
**Problème**: La table `platform_role_permissions` a UNIQUE(role_id, permission_id) mais pas de vérification des permissions en doublon.
**Risque**: Permissions assignées plusieurs fois (sans conséquence mais désordre).

### H5 — Aucune vérification des CORS pour les tokens platform
**Fichier**: `src/server/server.ts` (lines 110-127)
**Problème**: Les CORS vérifient les origines autorisées mais ne font pas de distinction entre les tokens platform et tenant.
**Risque**: Un tenant malicieux peut faire une requête XSS vers les endpoints platform.

### H6 — Aucune vérification des permissions en frontend (backend only)
**Fichier**: `src/pages/platform/PlatformLayout.tsx`
**Problème**: Le RBAC frontend n'est qu'un filtre d'affichage. Les routes sont protégées côté backend, mais un admin pourrait voir des éléments UI qui déclenchent des appels API non autorisés.
**Risque**: Mauvaise UX, erreurs 403 non gérées.

### H7 — Aucune journalisation des changements de mot de passe
**Fichier**: `src/server/platform/platform-auth.routes.ts`
**Problème**: Le endpoint `/change-password` ne logge pas l'action dans l'audit.
**Risque**: Impossible de tracer un changement de mot de passe suspect.

### H8 — Aucune vérification du tenant_id sur les routes billing
**Fichier**: `src/server/routes/billing.routes.ts`
**Problème**: `POST /api/billing/request-voucher` ne vérifie pas que le tenant de l'utilisateur JWT correspond bien au plan demandé.
**Risque**: Un user pourrait demander un voucher pour un plan d'un autre tenant.

---

## 3. 🟡 MEDIUM ISSUES (5)

### M1 — Passwords stockés en clair dans les logs de migration
**Fichier**: `backend/migrations/039_bootstrap_super_admin.sql`
**Problème**: Les commentaires mentionnent "généré aléatoirement" mais le mot de passe par défaut `AdminEkala2026!` est lisible dans le code.
**Risque**: Information de connexion exposée dans Git history.

### M2 — Aucune expérience mobile pour le platform login
**Fichier**: `src/pages/platform/PlatformLoginPage.tsx`
**Problème**: Le design est responsive (CSS moderne) mais pas testé sur mobile.
**Risque**: Mauvaise UX pour les admins sur mobile.

### M3 — Aucune gestion des erreurs HTTP 500 globales
**Fichier**: `src/server/server.ts`
**Problème**: Pas de middleware global `(err, req, res, next)` pour capturer les erreurs non gérées.
**Risque**: Stack traces exposées en production.

### M4 — Pas de health check spécifique platform
**Fichier**: `src/server/server.ts`
**Problème`: Le endpoint `/health` ne vérifie que l'uptime, pas l'état des services platform (DB, Supabase, etc.).
**Risque**: Monitoring incomplet.

### M5 — Aucun index sur les colonnes filtrantes des logs
**Fichier**: `backend/migrations/040_create_platform_audit_logs.sql`
**Problème**: `platform_audit_logs` a un index sur `created_at` mais pas sur `admin_id + action` ou `entity_type + entity_id`.
**Risque**: Requêtes lentes sur les logs filtrés (cas d'usage principal).

---

## 4. 🟢 LOW ISSUES (6)

### L1 — `console.log()` dans les routes production
**Fichier**: `src/server/routes/platform.routes.ts`
**Problème**: `console.error(...)` est utilisé partout. En production, ces logs devraient être structurés (JSON) et envoyés à un service externe.
**Risque**: Logs non exploitables.

### L2 — Aucune limite de pagination maximum
**Fichier**: `src/server/routes/platform.routes.ts`
**Problème**: `const limit = parseInt((req.query.limit as string) || '50');` — pas de `Math.min(limit, 100)`.
**Risque**: Un appel avec `limit=1000000` peut saturer le serveur.

### L3 — Aucune gestion des en-têtes de sécurité HTTP
**Fichier**: `src/server/server.ts`
**Problème**: Pas de `helmet()` ou `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`.
**Risque**: Vulnérabilités XSS et clickjacking.

### L4 — Tous les roles ont accès au dashboard
**Fichier**: `src/pages/platform/PlatformLayout.tsx` (line 81)
**Problème**: `dashboard` est dans TOUS les profils RBAC. Cela inclut support_admin qui pourrait voir des KPIs sensibles.
**Risque**: Fuite d'informations financières.

### L5 — Pas de versioning API dans les routes
**Fichier**: `src/server/routes/platform.routes.ts`
**Problème**: Routes en `/api/platform/*` sans version (`/api/v1/platform/*`).
**Risque**: Breaking changes impossibles sans casser les clients existants.

### L6 — Aucune validation des entrées pour les settings
**Fichier**: `src/server/routes/platform.routes.ts`
**Problème**: `PUT /api/platform/settings/:key` accepte n'importe quelle valeur sans validation.
**Risque**: Un admin peut sauvegarder des valeurs invalides.

---

## 5. SCORE GLOBAL

| Catégorie | Max | Score | Ratio |
|-----------|-----|-------|-------|
| Authentification & JWT | 20 | 12 | 60% |
| Autorisation & RBAC | 15 | 11 | 73% |
| Sécurité des données | 15 | 8 | 53% |
| Performances & Scale | 15 | 7 | 47% |
| Fiabilité & Transactions | 15 | 9 | 60% |
| Monitoring & Logs | 10 | 8 | 80% |
| Frontend & UX | 10 | 9 | 90% |
| **TOTAL** | **100** | **64** | **64%** |

---

## 6. PLAN DE CORRECTION PRIORITAIRE

### 🔴 Critical (à corriger avant production)
```
C1 — JWT_SECRET: Ajouter validation au démarrage (exit si fallback utilisé)
C2 — Rate limiting: Implémenter express-rate-limit sur /platform/auth/login
C5 — Transactions: Wrapper toutes les opérations multi-tables dans db.transaction()
C6 — Soft delete: Ajouter deleted_at sur platform_audit_logs
C7 — N+1: Remplacer les SELECT individuelles par JOIN dans le cron
C8 — Locking: Implémenter mutex/cron lock (ex: advisory lock SQLite)
C9 — Validation: Vérifier l'existence du tenant avant chaque opération
C10 — Payload: Réduire la limite à 1MB pour les routes normales, 10MB pour les uploads
C11 — Pagination: Ajouter LIMIT dans le DELETE du cron
```

### 🟠 High (à corriger en sprint 2)
```
H1 — Refresh rotation: Implémenter refresh token avec rotation + invalidation
H2 — Role check: Ajouter vérification du rôle dans refreshToken()
H6 — Frontend permissions: Gérer les 403 avec messages explicites
H7 — Audit password change: Logger dans platform_audit_logs
H8 — Tenant validation: Vérifier que le plan appartient au tenant
```

### 🟡 Medium (sprint 3+)
```
M3 — Global error handler: Ajouter middleware express (err, req, res, next)
M5 — Index: Ajouter index composite (admin_id, action) sur audit logs
```

---

## 7. CAPACITÉ 1 000 TENANTS

### Estimation des ressources

| Ressource | Par tenant | 1 000 tenants | Limite |
|-----------|-----------|---------------|--------|
| Requêtes sync/min | ~50 | 50 000 | ✅ Géré par batch |
| Lignes sync_outbox | ~100/jour | 100 000/jour | ✅ Indexé |
| Lignes audit logs | ~20/jour | 20 000/jour | ⚠️ Nécessite pagination |
| Connexions DB simultanées | 1 | 1 | ✅ SQLite gère 1 write |
| Mémoire serveur | ~50MB | ~200MB | ✅ (estimation haute) |

### Points bloquants pour 1 000 tenants

1. **SQLite monolithique** — 1 fichier DB pour 1 000 tenants. À 50 requêtes/sec, peut saturer.
   - ✅ Solution: WAL mode déjà actif
   - ⚠️ À 1 000 tenants, envisager PostgreSQL

2. **Sync V2 séquentiel** — Les tenants sont synchronisés un par un.
   - Avec 3 tenants: ~25 secondes
   - Avec 1 000 tenants: ~2 heures par cycle
   - ❌ **BLOCKING**: Paralléliser le sync par tenant

3. **Cron expiration séquentiel** — Boucle `for` sur chaque tenant.
   - ❌ **BLOCKING**: Ajouter batch processing

### Seuils

```
📊 < 100 tenants: ✅ Architecture actuelle suffisante
📊 100-500 tenants: ⚠️ Nécessite optimisation N+1 + indexes
📊 500-1 000 tenants: ❌ Nécessite parallélisation sync + SQLite→PostgreSQL
📊 1 000+ tenants: ❌ Migration PostgreSQL obligatoire
```

---

## 8. VULNÉRABILITÉS OWASP TOP 10

| # | Catégorie | Statut | Commentaire |
|---|-----------|--------|-------------|
| A1 | Broken Access Control | ✅ Partiel | RBAC backend OK, mais vérif tenant manquante |
| A2 | Cryptographic Failures | ❌ | JWT_SECRET fallback, pas de chiffrement DB |
| A3 | Injection | ✅ | SQL paramétré partout (Knex) |
| A4 | Insecure Design | ❌ | Pas de rate limiting, transactions manquantes |
| A5 | Security Misconfiguration | ❌ | CORS large, pas de helmet, pas de HSTS |
| A6 | Vulnerable Components | ⚠️ | À vérifier (npm audit) |
| A7 | Auth Failures | ❌ | Pas de MFA, pas de rate limiting |
| A8 | Data Integrity Failures | ❌ | Transactions manquantes |
| A9 | Logging Failures | ✅ | Audit logs OK |
| A10 | SSRF | ✅ | Pas d'appels externes non contrôlés |

**OWASP Score**: 5/10

---

## 9. RECOMMANDATIONS FINALES

### Prérequis production (4 jours)

1. **Jour 1**: Corriger C1, C2, C5 (JWT, rate limit, transactions)
2. **Jour 2**: Corriger C6, C7, C8, C9 (soft delete, N+1, locking, validation)
3. **Jour 3**: Corriger C10, C11, H1, H2 (payload, pagination, refresh, role check)
4. **Jour 4**: Tests de charge 1 000 tenants simulés

### Score cible pour production

```
🔴 Critical: 0/11 → Score: +22 points
🟠 High: 0/8 → Score: +10 points
🟡 Medium: 2/5 → Score: +3 points
Score final cible: 64 + 35 = 99/100 ✅
```

---

**Rapport généré le**: 2026-06-22  
**Auditeur**: Cline AI  
**Status**: ⚠️ NON PRÊT POUR PRODUCTION (score: 64/100)

> ⚠️ **Ce rapport n'est pas une critique du travail effectué.** L'architecture est solide mais nécessite les corrections ci-dessus pour supporter 1 000+ tenants en production.