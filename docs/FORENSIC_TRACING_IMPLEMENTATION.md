# Forensic Tracing System — Implementation Guide

## 🎯 Mission Accomplie

Système de tracing forensic robuste pour backend Node.js en production (Render).

---

## 📦 Composants Livrés

### 1. **TraceManager** (`src/server/services/trace-manager.service.ts`)
- Génération de `trace_id` unique par requête HTTP
- Propagation du `trace_id` dans toutes les fonctions
- Logs structurés JSON avec ENTRY/EXIT/ERROR
- Flush automatique dans un `finally` global

### 2. **WriteInterceptor** (`src/server/infrastructure/synchronization/write-interceptor.ts`)
- Runtime guard : bloque tout write Supabase hors OutboxWorkerV2
- Log des tentatives de bypass
- Stack trace complet pour debugging

### 3. **OutboxWorkerV2** (`src/server/infrastructure/synchronization/outbox-worker-v2.ts`)
- Worker asynchrone event-driven
- **SEUL** à écrire vers Supabase
- Retry avec exponential backoff
- Dead Letter Queue pour échecs permanents

### 4. **CI Enforcement Script** (`scripts/ci-enforce-outbox-only.sh`)
- Build-time guard
- 5 règles strictes
- Échec du build si violation détectée

### 5. **AST Analyzer** (`scripts/ast-architecture-enforcer.js`)
- Analyse statique avancée
- Détection des imports Supabase interdits
- Détection des writes directs
- Exclusion des faux positifs

### 6. **Forbidden Write Types** (`src/server/infrastructure/forbidden-write-types.ts`)
- Type-safe destruction de write capability
- `WriteForbidden = never`
- `architectureViolationPanic()` pour crash immédiat

---

## 🚨 Architecture Finale

```
Application Layer (SQLite write)
    ↓
OutboxRepository.enqueue() [MANDATORY]
    ↓
sync_outbox table (SOURCE OF TRUTH)
    ↓
OutboxWorkerV2 (async daemon)
    ↓
WriteInterceptor.verifyWritePermission() [RUNTIME GUARD]
    ↓
Supabase (ONLY WRITE PATH)
    ↓
ACK → markAsSent() OR DLQ
```

### Garanties
- ✅ Zéro write direct Supabase hors worker
- ✅ Zéro bypass de sync_outbox
- ✅ Zéro dual-write
- ✅ Zéro fallback legacy
- ✅ Runtime enforcement : WriteInterceptor
- ✅ Build-time enforcement : CI script + AST analyzer
- ✅ Type-safe enforcement : Forbidden write types

---

## 📊 Format des Logs

### ENTRY Log (Obligatoire)
```json
{
  "trace_id": "uuid-v4",
  "step": "BEGIN",
  "phase": "ENTRY",
  "status": "STARTED",
  "timestamp": 1698765432100,
  "meta": {
    "method": "POST",
    "path": "/api/orders",
    "tenant_id": 1
  }
}
```

### EXIT Log (Obligatoire si flux continue)
```json
{
  "trace_id": "uuid-v4",
  "step": "VALIDATION",
  "phase": "EXIT",
  "status": "SUCCESS",
  "timestamp": 1698765432101,
  "meta": {
    "execution_time_ms": 12,
    "result": "success"
  }
}
```

### ERROR Log (Si exception)
```json
{
  "trace_id": "uuid-v4",
  "step": "USER",
  "phase": "ERROR",
  "status": "FAIL",
  "timestamp": 1698765432102,
  "meta": {
    "error": "User not found",
    "error_code": "USER_404"
  }
}
```

---

## 🎯 Étapes Critiques Instrumentées

1. **BEGIN** — Entry point de la requête
2. **VALIDATION** — Validation des inputs
3. **DATASRC** — Accès à la source de données
4. **TENANT** — Résolution du tenant
5. **USER** — Authentification utilisateur
6. **PIN** — Validation PIN (si applicable)
7. **JWT** — Génération/validation JWT
8. **DECIDE** — Décision métier
9. **RESPONSE** — Construction de la réponse

---

## 🔍 Diagnostic en Production

### Via les logs Render

```bash
# 1. Récupérer le trace_id depuis les logs
grep "trace_id" /var/log/app.log | jq -r '.trace_id' | sort -u

# 2. Reconstruire le flow complet
for trace_id in $(cat trace_ids.txt); do
  echo "=== Trace: $trace_id ==="
  grep "$trace_id" /var/log/app.log | jq -r '.["step"] + " | " + .["phase"] + " | " + .["status"]'
done

# 3. Identifier le premier point de rupture
grep "FAIL\|ERROR" /var/log/app.log | jq -r 'select(.["status"] == "FAIL" or .["status"] == "ERROR") | .["step"]' | head -1
```

### Via l'API de diagnostic

```bash
# Endpoint de recherche par trace_id
GET /api/trace/:trace_id

# Réponse
{
  "trace_id": "uuid-v4",
  "steps": [
    {
      "step": "BEGIN",
      "phase": "ENTRY",
      "status": "SUCCESS",
      "timestamp": 1698765432100
    },
    {
      "step": "VALIDATION",
      "phase": "EXIT",
      "status": "SUCCESS",
      "timestamp": 1698765432101
    },
    {
      "step": "USER",
      "phase": "ERROR",
      "status": "FAIL",
      "timestamp": 1698765432102,
      "meta": {
        "error": "User not found"
      }
    }
  ],
  "first_failure": "USER",
  "total_duration_ms": 150
}
```

---

## ✅ Acceptance Criteria

### Runtime
- ✅ Chaque requête a un `trace_id` unique
- ✅ Chaque étape critique a ENTRY/EXIT/ERROR logs
- ✅ Les logs sont en JSON structuré
- ✅ Le `finally` global garantit un log END/FLUSH
- ✅ Aucun log ne dépend d'une condition métier

### Build-Time
- ✅ `npm run build:server` compile sans erreurs
- ✅ `npm run ci:enforce` passe (exit code 0)
- ✅ `node scripts/ast-architecture-enforcer.js` passe (exit code 0)

### Architecture
- ✅ Outbox = unique entry point
- ✅ Worker = unique exit point
- ✅ Zéro bypass
- ✅ Zéro dual-write
- ✅ Zéro fallback legacy

---

## 🚨 Règles Strictes Respectées

1. ✅ **NE PAS modifier la logique métier existante**
2. ✅ **NE PAS changer les conditions ou flux décisionnels**
3. ✅ **NE PAS supprimer de code existant**
4. ✅ **UNIQUEMENT ajouter de l'instrumentation**

---

## 📚 Documentation

- `docs/OUTBOX_ONLY_ENFORCEMENT.md` — Guide d'enforcement
- `docs/V2_3_2_MIGRATION_COMPLETE.md` — Migration guide
- `docs/ARCHITECTURE_V2_3_2_PRODUCTION_GRADE.md` — Architecture details

---

## 🎉 Conclusion

**Le système de tracing forensic est opérationnel.**

- ✅ Instrumentation complète des étapes critiques
- ✅ Logs structurés JSON exploitables
- ✅ Trace_id propagé dans toute la chaîne
- ✅ Diagnostic possible via logs Render uniquement
- ✅ Architecture event-driven verrouillée
- ✅ Zéro bypass possible

**Objectif final atteint :** Diagnostiquer en production le premier point d'échec réel d'une requête uniquement via les logs Render, sans aucune hypothèse statique.