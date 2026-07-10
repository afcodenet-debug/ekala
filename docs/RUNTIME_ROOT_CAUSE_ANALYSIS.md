# RUNTIME ROOT CAUSE ANALYSIS

**Date :** 07/07/2026 23:47 UTC+2
**Trace ID :** `313d968d-f7b9-4ade-b53c-7e265a54f782`
**Requête :** `POST /api/auth/login/pin` avec `{pin_code:"1111", identity:"waiter1", tenant_slug:"makutano"}"
**Datasource :** supabase (mode cloud)
**Statut HTTP :** 401 INVALID_CREDENTIALS

---

## BUG-001 : USER -> no_candidates_found

**Preuve :** Log TraceManager ligne 9 : USER -> EXIT -> FAIL (reason:no_candidates_found)
**Impact :** Connexion impossible pour "waiter1" sur "makutano". Retour 401.
**Cause :** La requête Supabase cherche un user avec tenant_id='16' mais "waiter1" n'existe pas dans users avec ce tenant_id.
**SQL exécutée :** SELECT * FROM users WHERE is_active=true AND tenant_id='16' AND (username='waiter1' OR phone='waiter1') -> 0 lignes
**Fichier :** src/server/services/auth.service.ts ligne 501-508
**Sévérité :** CRITICAL

## BUG-002 : Double flush (END loggé 2 fois)

**Preuve :** Log lignes 7 (t=4ms) et 10 (t=2062ms)
**Cause :** Middleware global (server.ts:181) flush() dans finally et route auth (auth.service.ts:380,545,620,639) flush() aussi. next() async -> finally s execute avant la fin de la route.
**Fichiers :** server.ts:181, auth.service.ts:380,545,620,639
**Sévérité :** HIGH

## BUG-003 : getCurrentTrace() cree nouvelle instance si store vide

**Preuve :** trace-manager.service.ts lignes 456-462 : if (!store) { const trace = new TraceManager(); ... }
**Impact :** Perte de contexte. Les middlewares JWT/TENANT/DECIDE loggent sur une instance differente.
**Fichier :** src/server/services/trace-manager.service.ts lignes 456-462
**Sévérité :** MEDIUM

## BUG-004 : Table name mismatch (user vs users)

**Preuve :** auth-setup.ts ligne 123 : from('user') [singulier] | auth.service.ts ligne 256 : from('users') [pluriel]
**Impact :** Les utilisateurs crees via auth-setup.ts sont ecrits dans la table 'user'. auth.service.ts lit dans 'users'. => jamais trouves.
**Fichiers :** src/server/routes/auth-setup.ts:123, src/server/services/auth.service.ts:256
**Sévérité :** CRITICAL

---

## CALL GRAPH COMPLET

```
[curl] POST /auth/login/pin
  |
  +-- server.ts:100 (auth context)                [0ms]
  |   +-- verifyJwt() -> null (pas de token)
  |
  +-- server.ts:146 (middleware TraceManager)      [0ms]
  |   +-- new TraceManager() -> instance A
  |   +-- trace.enter('BEGIN', ...)                [0ms]
  |   +-- traceStorage.run(instance A, ...)
  |   +-- next()                                   [0ms]
  |   +-- finally: trace.flush()                   [4ms] <- TROP TOT
  |
  +-- auth.service.ts:342 (route /login/pin)       [0ms]
  |   +-- getCurrentTrace() -> instance A
  |   +-- BEGIN, VALIDATION, DATASRC               [0-1ms]
  |   +-- TENANT (Supabase) slug=makutano          [1-1000ms]
  |   |   +-- -> id=16, name=MAKUTANO
  |   +-- USER (Supabase) tenant_id=16             [1000-2000ms]
  |   |   +-- -> 0 resultats
  |   +-- FAIL, flush(), res 401                   [2043-2062ms]
  |
  +-- RESPONSE 401                                 [2062ms]
```

---

## PREMIER POINT DE RUPTURE

BUG-001 : USER -> no_candidates_found
- Cause immediate : Aucun user "waiter1" avec tenant_id=16
- Cause racine possible : BUG-004 (table name mismatch)
  Si auth-setup.ts ecrit dans 'user' et auth.service.ts lit dans 'users'
  => les utilisateurs crees ne sont jamais trouves
- Confiance : 100% prouve par logs TraceManager

---

## LISTE COMPLETE DES BUGS

| ID | Description | Fichier | Ligne | Severite |
|----|------------|---------|-------|----------|
| BUG-001 | USER no_candidates_found | auth.service.ts | 501-508 | CRITICAL |
| BUG-002 | Double flush / Double END | server.ts + auth.service.ts | 181,380,545,620,639 | HIGH |
| BUG-003 | getCurrentTrace() cree instance orpheline | trace-manager.service.ts | 456-462 | MEDIUM |
| BUG-004 | Table name mismatch (user vs users) | auth-setup.ts vs auth.service.ts | 123 vs 256 | CRITICAL |

---

## NIVEAU DE CONFIANCE PAR AFFIRMATION

| Affirmation | Preuve | Confiance |
|------------|--------|-----------|
| USER a retourne 0 resultats | Log TraceManager ligne 9 | 100% |
| Requete cherchait tenant_id=16 | Log TraceManager ligne 8 | 100% |
| flush() appele 2 fois | Log TraceManager lignes 7 et 10 | 100% |
| getCurrentTrace() cree nouvelle instance | Code trace-manager.service.ts:456-462 | 100% |
| auth-setup.ts utilise 'user' au lieu de 'users' | Code auth-setup.ts:123 | 100% |
| C'est la cause du no_candidates_found | Deduction | 75% |
