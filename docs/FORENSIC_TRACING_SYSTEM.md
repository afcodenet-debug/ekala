# Système de Tracing Forensic — Documentation

## Vue d'ensemble

Le système de tracing forensic permet de reconstruire exactement le déroulement de chaque requête HTTP pour identifier le premier point de rupture réel en production.

## Architecture

### TraceManager (src/server/services/trace-manager.service.ts)

Service central qui gère le cycle de vie complet d'une trace :

```typescript
import { getCurrentTrace } from './services/trace-manager.service';

const trace = getCurrentTrace();
```

### Méthodes disponibles

#### `trace.enter(step, meta?)`
Démarre une nouvelle étape de trace. **Obligatoire** pour chaque étape critique.

```typescript
trace.enter('BEGIN', { path: req.path, method: req.method });
trace.enter('VALIDATION', { hasPinCode: !!pin_code });
trace.enter('DATASRC', {});
trace.enter('TENANT', { tenantId, userId });
trace.enter('USER', { identity, candidatesCount: 5 });
trace.enter('PIN', { candidatesCount: 3 });
trace.enter('DECIDE', { state: 'active', planName: 'Premium' });
trace.enter('RESPONSE', { status: 200, hasToken: true });
```

#### `trace.exit(step, meta?)`
Marque la fin réussie d'une étape. **Obligatoire** avant chaque `return` ou `next()`.

```typescript
trace.exit('VALIDATION', { pin_length: pin_code?.length });
trace.exit('DATASRC', { datasource: 'supabase', mode: 'cloud' });
trace.exit('USER', { candidatesCount: 3 });
trace.exit('DECIDE', { state: 'active', planName: 'Premium' });
trace.exit('RESPONSE', { status: 200 });
```

#### `trace.fail(step, meta?)`
Marque un échec dans une étape. Utilisé dans les blocs `catch` et conditions d'erreur.

```typescript
trace.fail('VALIDATION', { reason: 'pin_too_short' });
trace.fail('USER', { reason: 'no_candidates_found' });
trace.fail('DECIDE', { reason: 'subscription_blocked' });
```

#### `trace.error(step, error, meta?)`
Log une exception avec stack trace complète.

```typescript
try {
  // ...
} catch (e) {
  trace.error('DATASRC', e, { datasource: 'supabase' });
  throw e;
}
```

#### `trace.setDatasource(source, isError)`
Définit la source de données pour la trace (bonus métier).

```typescript
trace.setDatasource('supabase', false);
trace.setDatasource('sqlite', false);
```

#### `trace.flush()`
Persiste la trace de manière asynchrone. **Obligatoire** dans un `finally` global.

```typescript
try {
  // ... logique métier
} catch (e) {
  trace.error('STEP', e);
  throw e;
} finally {
  trace.flush(); // Garantit la persistence même en cas d'erreur non catchée
}
```

## Étapes de trace obligatoires

### 1. BEGIN
**Quand** : Au début de chaque requête HTTP  
**Pourquoi** : Marque le début de la trace avec le contexte de la requête

```typescript
trace.enter('BEGIN', {
  path: req.path,
  method: req.method,
  ip: req.ip,
  hasBody: !!req.body,
});
```

### 2. VALIDATION
**Quand** : Après extraction des paramètres de la requête  
**Pourquoi** : Vérifie que les paramètres requis sont présents et valides

```typescript
trace.enter('VALIDATION', {
  hasPinCode: !!pin_code,
  pinLength: pin_code?.length,
  hasIdentity: !!identity,
  hasTenantSlug: !!tenant_slug,
});
// Si validation échoue :
trace.fail('VALIDATION', { reason: 'pin_too_short' });
// Si validation réussit :
trace.exit('VALIDATION', { pin_length: pin_code?.length });
```

### 3. DATASRC
**Quand** : Détection du mode (cloud/local) et source de données  
**Pourquoi** : Identifie la source de données utilisée (Supabase vs SQLite)

```typescript
trace.enter('DATASRC', {});
const supabase = getSupabase(req);
const datasource = supabase ? 'supabase' : 'sqlite';
trace.setDatasource(datasource, false);
trace.exit('DATASRC', { datasource, mode: detectedMode });
```

### 4. TENANT
**Quand** : Résolution du tenant à partir du JWT  
**Pourquoi** : Trace le contexte multi-tenant

```typescript
trace.enter('TENANT', {
  userId: user?.sub,
  userRole: user?.role,
  isPlatform: user?.type === 'platform',
});
// Si platform admin :
trace.exit('TENANT', { reason: 'platform_admin' });
// Si tenant user :
trace.exit('TENANT', { tenantId, userId });
```

### 5. USER
**Quand** : Recherche des utilisateurs candidats  
**Pourquoi** : Trace le processus de recherche d'utilisateur

```typescript
trace.enter('USER', { identity, tenantFilter });
// ... recherche utilisateurs ...
if (!candidates || candidates.length === 0) {
  trace.fail('USER', { reason: 'no_candidates_found' });
  // ... return erreur ...
}
trace.exit('USER', { candidatesCount: candidates.length });
```

### 6. PIN
**Quand** : Vérification du PIN pour chaque candidat  
**Pourquoi** : Trace le processus de vérification de PIN

```typescript
trace.enter('PIN', { candidatesCount: candidates.length });
for (let i = 0; i < candidates.length; i++) {
  const pinResult = verifyPin(pin_code, user.pin_code);
  // ... logique de vérification ...
  if (pinResult) {
    // ... succès ...
  }
}
// Si aucun PIN valide :
trace.fail('PIN', { reason: 'no_valid_pin' });
```

### 7. DECIDE
**Quand** : Vérification de l'état d'abonnement (subscription guard)  
**Pourquoi** : Trace la décision d'accès (allow/deny)

```typescript
trace.enter('DECIDE', { tenantId, path: req.path });
const sub = await checkSubscriptionStatus(tenantId);
if (BLOCKED_STATES.includes(result.state)) {
  trace.fail('DECIDE', { state: result.state, reason: 'subscription_blocked' });
  // ... return 403 ...
}
trace.exit('DECIDE', { state: result.state, planName: result.planName });
```

### 8. RESPONSE
**Quand** : Avant d'envoyer la réponse HTTP  
**Pourquoi** : Marque la fin réussie du flux

```typescript
trace.enter('RESPONSE', { status: 200, hasToken: !!response.token });
trace.exit('RESPONSE', { status: 200 });
trace.flush();
return res.json(response);
```

## Format des logs

Tous les logs sont au format JSON structuré :

```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "step": "USER",
  "phase": "EXIT",
  "status": "SUCCESS",
  "timestamp": 1717724400000,
  "meta": {
    "candidatesCount": 3,
    "datasource": "supabase"
  }
}
```

### Champs obligatoires

- `trace_id` : UUID unique par requête (généré automatiquement)
- `step` : Nom de l'étape (BEGIN, VALIDATION, DATASRC, TENANT, USER, PIN, DECIDE, RESPONSE)
- `phase` : ENTRY, EXIT, ou ERROR
- `status` : STARTED, SUCCESS, FAIL, ou ERROR
- `timestamp` : Date.now() au moment du log
- `meta` : Objet métier libre (dépend de l'étape)

## Propagation du trace_id

Le `trace_id` est propagé automatiquement via `AsyncLocalStorage` :

```typescript
import { getCurrentTrace } from './services/trace-manager.service';

// N'importe où dans le call stack d'une requête :
const trace = getCurrentTrace();
trace.enter('MY_STEP', { ... });
```

## Intégration dans les middlewares

### JWT Auth Middleware (src/server/middleware/jwt-auth.ts)

```typescript
export const requireJwtAuth = (req, res, next) => {
  const trace = getCurrentTrace();
  
  trace.enter('JWT', { path: req.path, method: req.method, hasAuthHeader: !!authHeader });
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    trace.fail('JWT', { reason: 'missing_bearer_token' });
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  
  const payload = verifyJwt(token);
  if (!payload) {
    trace.fail('JWT', { reason: 'invalid_or_expired_token' });
    return res.status(401).json({ error: 'TOKEN_INVALID' });
  }
  
  req.user = payload;
  trace.exit('JWT', { userId: payload.sub, tenantId: payload.tenant_id });
  next();
};
```

### Tenant Scope Middleware (src/server/middleware/tenant-scope.ts)

```typescript
export function requireTenantScope(req, res, next) {
  const trace = getCurrentTrace();
  
  trace.enter('TENANT', {
    userId: user?.sub,
    userRole: user?.role,
    isPlatform: user?.type === 'platform',
  });
  
  if (user?.type === 'platform' || user?.is_platform_user) {
    trace.exit('TENANT', { reason: 'platform_admin' });
    return next();
  }
  
  const tenantId = getTenantId(req);
  req.tenant_id = tenantId;
  trace.exit('TENANT', { tenantId, userId });
  
  tenantStorage.run({ tenantId, userId }, () => {
    next();
  });
}
```

### Subscription Guard Middleware (src/server/middleware/subscription-guard.ts)

```typescript
export const requireActiveSubscription = async (req, res, next) => {
  const trace = getCurrentTrace();
  
  trace.enter('DECIDE', { 
    tenantId: req.user?.tenant_id, 
    path: req.path, 
    method: req.method 
  });
  
  const result = await checkSubscriptionStatus(tenantId);
  req.subscription = result;
  
  if (BLOCKED_STATES.includes(result.state)) {
    trace.fail('DECIDE', { state: result.state, reason: 'subscription_blocked' });
    // ... return 403 ...
  }
  
  trace.exit('DECIDE', { state: result.state, planName: result.planName });
  next();
};
```

## Intégration dans les routes

### Exemple complet : POST /api/auth/login/pin

```typescript
router.post('/login/pin', authRateLimit, async (req, res) => {
  const trace = getCurrentTrace();
  
  // 1. BEGIN
  trace.enter('BEGIN', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    hasBody: !!req.body,
  });
  
  try {
    const { pin_code, identity, tenant_slug } = req.body || {};
    
    // 2. VALIDATION
    trace.enter('VALIDATION', {
      hasPinCode: !!pin_code,
      pinLength: pin_code?.length,
      hasIdentity: !!identity,
      hasTenantSlug: !!tenant_slug,
    });
    
    if (!pin_code || pin_code.length < 4) {
      trace.fail('VALIDATION', { reason: 'pin_too_short' });
      trace.flush();
      return res.status(400).json({ error: 'INVALID_PIN' });
    }
    trace.exit('VALIDATION', { pin_length: pin_code?.length });
    
    // 3. DATASRC
    trace.enter('DATASRC', {});
    const supabase = getSupabase(req);
    const datasource = supabase ? 'supabase' : 'sqlite';
    trace.setDatasource(datasource, false);
    trace.exit('DATASRC', { datasource, mode: detectedMode });
    
    // 4. TENANT (déjà fait par middleware, mais on peut tracer ici aussi)
    // ... logique métier ...
    
    // 5. USER
    trace.enter('USER', { identity, tenantFilter });
    const candidates = await searchUsers(identity, tenantFilter);
    if (!candidates || candidates.length === 0) {
      trace.fail('USER', { reason: 'no_candidates_found' });
      trace.flush();
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
    trace.exit('USER', { candidatesCount: candidates.length });
    
    // 6. PIN
    trace.enter('PIN', { candidatesCount: candidates.length });
    for (const user of candidates) {
      const pinResult = verifyPin(pin_code, user.pin_code);
      if (pinResult) {
        // 7. DECIDE
        trace.enter('DECIDE', { userId: user.id, tenantId: user.tenant_id });
        const subscription = await getTenantSubscription(user.tenant_id);
        // ... logique ...
        trace.exit('DECIDE', { state: 'active', planName: 'Premium' });
        
        // 8. RESPONSE
        trace.enter('RESPONSE', { status: 200, hasToken: true });
        trace.exit('RESPONSE', { status: 200 });
        trace.flush();
        return res.json(response);
      }
    }
    trace.fail('PIN', { reason: 'no_valid_pin' });
    trace.flush();
    return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    
  } catch (e) {
    trace.error('UNKNOWN', e);
    trace.flush();
    return res.status(500).json({ error: 'LOGIN_FAILED' });
  }
});
```

## Règles strictes

### ✅ À FAIRE

1. **Toujours** appeler `trace.enter()` au début de chaque étape
2. **Toujours** appeler `trace.exit()` avant chaque `return` ou `next()` si l'étape réussit
3. **Toujours** appeler `trace.fail()` si l'étape échoue
4. **Toujours** appeler `trace.error()` dans les blocs `catch`
5. **Toujours** appeler `trace.flush()` dans un `finally` global
6. **Ajouter** du contexte métier dans `meta` (tenantId, userId, state, etc.)

### ❌ À NE PAS FAIRE

1. **NE PAS** modifier la logique métier existante
2. **NE PAS** changer les conditions ou flux décisionnels
3. **NE PAS** supprimer de code existant
4. **NE PAS** ajouter de logs qui dépendent de conditions métier (les logs doivent être inconditionnels)

## Vérification en production Render

### Filtrage des logs

Dans Render Dashboard → Logs :

```bash
# Filtrer par trace_id
grep "trace_id:abc-123" /var/log/app.log

# Filtrer par étape
grep '"step":"USER"' /var/log/app.log

# Filtrer par statut d'erreur
grep '"status":"FAIL"' /var/log/app.log
```

### Reconstruction d'une requête

Pour reconstruire une requête complète :

```bash
# 1. Récupérer le trace_id depuis les logs
grep '"step":"BEGIN"' app.log | jq -r 'select(.meta.path=="/api/auth/login/pin") | .trace_id' | tail -1

# 2. Récupérer tous les événements de cette trace
TRACE_ID="abc-123"
grep "$TRACE_ID" app.log | jq -s 'sort_by(.timestamp)'

# 3. Identifier le premier FAIL
grep "$TRACE_ID" app.log | jq -s 'map(select(.status=="FAIL")) | first'
```

### Détection d'anomalies

Le `TraceManager` détecte automatiquement les anomalies :

```typescript
const trace = getCurrentTrace();
const anomalies = trace.detectAnomalies();

console.log(anomalies);
// [
//   { type: 'MISSING_STEP', description: 'Step manquant: PIN', step: 'PIN' },
//   { type: 'EARLY_TERMINATION', description: 'Requête terminée sans flush()' }
// ]
```

## Performance

- **Overhead minimal** : Les logs sont bufferisés et persistés de manière asynchrone
- **Pas de blocage** : `trace.flush()` ne bloque jamais le thread principal
- **Fail-safe** : Si la persistence échoue, la requête continue normalement

## Tests

Pour tester le système de tracing :

```bash
# Lancer les tests unitaires
npm test -- src/server/services/trace-manager.service.test.ts

# Tester manuellement avec une requête
curl -X POST http://localhost:3001/api/auth/login/pin \
  -H "Content-Type: application/json" \
  -d '{"pin_code":"1234","identity":"admin","tenant_slug":"my-tenant"}'

# Vérifier les logs
tail -f logs/app.log | grep '"step":"BEGIN"'
```

## Troubleshooting

### Les logs n'apparaissent pas

1. Vérifier que `getCurrentTrace()` est appelé dans le bon contexte AsyncLocalStorage
2. Vérifier que `trace.flush()` est bien appelé dans un `finally`
3. Vérifier les permissions d'écriture du répertoire de logs

### Les trace_id ne se propagent pas

1. Vérifier que le middleware `createTrace()` est bien appelé au début de la requête
2. Vérifier que `AsyncLocalStorage` est correctement configuré
3. Vérifier qu'aucun `Promise` ne casse le contexte async

### Performance dégradée

1. Vérifier que `trace.flush()` est bien asynchrone (ne pas utiliser `await` dans le chemin critique)
2. Vérifier que le buffer de logs n'est pas trop volumineux
3. Vérifier que la persistence (SQLite/Supabase) fonctionne correctement

## Conclusion

Le système de tracing forensic permet de diagnostiquer en production le premier point d'échec réel d'une requête uniquement via les logs, sans aucune hypothèse statique.

**Bénéfices clés** :
- ✅ Reconstruction étape par étape de chaque requête
- ✅ Identification du premier point de rupture
- ✅ Contexte métier enrichi (tenant, user, datasource)
- ✅ Détection automatique d'anomalies
- ✅ Performance optimale (async, non-blocking)
- ✅ Aucun changement de logique métier