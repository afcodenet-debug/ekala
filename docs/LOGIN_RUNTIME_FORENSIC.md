# RAPPORT FORENSIC RUNTIME — Connexion PIN tenant "makutano"
**Date :** 07/07/2026 23:16 UTC+2
**Trace ID :** `313d968d-f7b9-4ade-b53c-7e265a54f782`
**Requête :** `POST /api/auth/login/pin` avec `{pin_code:"1111", identity:"waiter1", tenant_slug:"makutano"}`
**Datasource :** supabase (mode cloud)
**Statut HTTP :** 401 INVALID_CREDENTIALS

## TIMELINE COMPLÈTE
| # | Step | Phase | Status | Durée | Détail |
|---|------|-------|--------|-------|--------|
| 1 | BEGIN | ENTRY | STARTED | - | method:POST, path:/api/auth/login/pin |
| 2 | BEGIN | ENTRY | STARTED | - | path:/login/pin, hasBody:true |
| 3 | VALIDATION | ENTRY | STARTED | - | pinLength:4, hasIdentity:true, hasTenantSlug:true |
| 4 | VALIDATION | EXIT | ✅ SUCCESS | 1ms | pin_length:4 |
| 5 | DATASRC | ENTRY | STARTED | - | {} |
| 6 | DATASRC | EXIT | ✅ SUCCESS | 1ms | datasource:supabase, mode:cloud |
| 7 | **END** | EXIT | ✅ SUCCESS | 4ms | ⚠️ FLUSH PRÉMATURÉ |
| 8 | **USER** | ENTRY | STARTED | - | identity:waiter1, tenant_id:16 |
| 9 | **USER** | EXIT | ❌ FAIL | 1043ms | reason:no_candidates_found |
| 10 | END | EXIT | ❌ FAIL | 2062ms | total_duration_ms:2062 |
| 11 | RESPONSE | EXIT | ❌ FAIL | - | status_code:401 |

## ÉTAPES MANQUANTES
- **PIN** ❌ ABSENT (USER a échoué)
- **DECIDE** ❌ ABSENT (PIN jamais atteint)
- **JWT** ❌ ABSENT (DECIDE jamais atteint)

## ANOMALIES DÉTECTÉES
1. **FLUSH PRÉMATURÉ (ligne 7)** : END loggé à t=4ms, puis requête continue jusqu'à t=2062ms.
2. **DOUBLE END** : END loggé 2 fois (t=4ms + t=2062ms).
3. **CHAÎNE BRISÉE** : USER→FAIL sans PIN/DECIDE/JWT.

## PREMIER POINT DE RUPTURE
```
ÉTAPE 8-9 : USER → FAIL (no_candidates_found)
Durée : 1043ms (timeout Supabase potentiel)
Cause : SELECT * FROM users WHERE is_active=true AND tenant_id='16' 
        AND (username='waiter1' OR phone='waiter1') → 0 résultats
```
**Diagnostic :** Aucun utilisateur "waiter1" trouvé dans tenant 16 (makutano) sur Supabase.

## RECONSTRUCTION DU FLUX
```
Client → POST /auth/login/pin
  ├── Middleware: BEGIN ✓
  ├── BEGIN ✓
  ├── VALIDATION ✓ (pin 4ch, identity, slug)
  ├── DATASRC ✓ (supabase)
  ├── TENANT ✓ (id=16, name=MAKUTANO)
  ├── USER ❌ FAIL ← PREMIER POINT DE RUPTURE
  │     └── PIN ⛔ JAMAIS ATTEINT
  │           └── DECIDE ⛔ JAMAIS ATTEINT
  │                 └── JWT ⛔ JAMAIS ATTEINT
  ├── RESPONSE 401
  └── END FAIL
```

## RECOMMANDATIONS
1. **Corriger double flush** : Ajouter flag `trace.flushed` pour éviter double END.
2. **Vérifier utilisateur** : Confirmer que "waiter1" existe dans users avec tenant_id=16.
3. **Ajouter TENANT log** explicite dans TraceManager entre DATASRC et USER.
4. **Timeout 1043ms** : Cache Redis ou timeout plus court pour requêtes Supabase.
