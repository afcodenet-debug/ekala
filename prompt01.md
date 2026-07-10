# PROMPT POUR DIAGNOSTIC DU PROBLÈME D'AUTH LOCAL

## Contexte
Application web multi-tenant (restauration) avec :
- Frontend : React + Vite (port 5173)
- Backend : Express/Node.js (port 3001)
- Base de données : SQLite (+ Supabase pour synchronisation cloud)
- Authentification : deux modes (LOCAL vs CLOUD)

## Symptôme Principal
L'application ne répond pas lorsque je saisis le slug du tenant sur la page de login.
Le `fetch()` vers `/api/auth/tenants/[slug]` reste bloqué sans réponse pendant 30+ secondes et finit en `ERR_EMPTY_RESPONSE` ou `Failed to fetch`.

L'application tourne complètement en local (localhost:5173) mais le comportement semble utilisé le mode cloud alors que je veux le mode LOCAL.

## Observations

### Logs Backend (terminal)
```
[RENDER BOOT] VITE_APP_MODE: local
[RENDER BOOT] NODE_ENV: development
[RENDER BOOT] RENDER_CLOUD_MODE: undefined
[RuntimeModeResolver] VITE_APP_MODE=local → forcing LOCAL mode
[RuntimeMode] Mode: 💻 LOCAL | Electron: false
...
[RENDER BOOT] Runtime mode: RuntimeContext(mode=LOCAL, isLocal=true, isCloud=false, isHybrid=false)
[RENDER BOOT] isLocal: true
[RENDER BOOT] isCloud: false
[RENDER BOOT] endpoints mounted: /health, /test, /api/auth, /api/menu, ...
[RENDER BOOT] Express listening on port 3001
...
```

**Note importante :** Malgré `isCloud: false`, on voit aussi :
```
[RENDER_CLOUD_MODE] ACTIVE — Pure Supabase backend only
[RENDER_CLOUD_MODE] Local SQLite is FORBIDDEN on this instance
```
CE message continue de s'afficher même après avoir corrigé `RENDER_CLOUD_MODE = false` dans `env.ts`

### Logs des requêtes reçues (backend reçoit bien)
```
[HTTP] GET /api/auth/tenants/great-olive
[Auth] GET /tenants/:slug - Start {slug: 'great-olive', headers: {host: '127.0.0.1:3001', origin: undefined, x-runtime-mode: undefined}}
[RuntimeMode] resolveFromRequest: host=127.0.0.1:3001 → LOCAL
...
meta: {status_code: 304}
```

Le backend REÇOIT la requête via le proxy (host=127.0.0.1:3001), logge le slug, mais retourne **status 304** (au lieu de 200 avec JSON). C'est un code HTTP 304 "Not Modified" qui n'a pas de body JSON, donc le `fetch()` côté frontend reçoit une réponse vide.

### Logs Console Frontend (navigateur)
```
[LocalAuthProvider] Fetching: /api/auth/tenants/great-olive
Object { method: "GET", hasBody: false }
```
Puis rien d'autre (pas de log de réponse car le fetch reste bloqué ou échoue silencieusement)

### Test direct en curl fonctionne
```bash
curl http://localhost:3001/api/auth/tenants/makutano
```
Retourne bien le JSON du tenant :
```json
{"id":16,"slug":"makutano","name":"MAKUTANO","status":"active",...}
```

### Autres erreurs visibles dans les logs
```
[TracePersistence] Supabase insert failed: value "1783337149760" is out of range for type integer
```
Cette erreur apparaît TOUTES LES 2 SECONDES (période de flush du traceur), même en mode LOCAL. Le `TracePersistence` essaie d'écrire dans Supabase alors que c'est désactivé.

```
[SupabaseRealtime] Subscription failed: channel error: transport failure
```
Le service Supabase Realtime essaie de se connecter et échoue, créant du bruit dans les logs.

## Fichier clés à examiner
- `vite.config.ts` → vérifier la configuration du proxy (redirige-t-il bien `/api` vers `localhost:3001` ?)
- `src/server/config/env.ts` → comment RENDER_CLOUD_MODE est-il déterminé ?
- `src/server/server.ts` → où est le bloc `if (env.RENDER_CLOUD_MODE) { console.log('[RENDER_CLOUD_MODE] ACTIVE...') }`
- `src/server/services/auth.service.ts` → route `GET /tenants/:slug` (lignes ~1009-1079)
- `src/core/auth/providers/LocalAuthProvider.ts` → appel `fetch('/api/auth/tenants/${slug}')`
- `src/server/services/trace-persistence.service.ts` et `trace-flush-engine.service.ts` → boucle d'écriture Supabase en LOCAL
- `src/server/services/supabase-realtime-sync.service.ts` → abonnement Realtime même en LOCAL
- `src/lib/api-client.ts` → comment le frontend construit-il l'URL de l'API ?
- `.env` → configuration actuelle (VITE_APP_MODE=local, ENABLE_SUPABASE_SYNC=false, etc.)

## Objectif
Je veux que l'application en mode LOCAL :
1. Détecte automatiquement qu'elle tourne en local (sans configuration manuelle compliquée)
2. Utilise UNIQUEMENT SQLite comme source de données
3. Ne tente AUCUNE connexion à Supabase
4. Les requêtes API `/api/auth/...` atteignent le backend Express et retournent un JSON valide (status 200)
5. Soit rapide et réactive (pas de timeouts)
6. Les services Supabase (TracePersistence, Realtime, PullSync) soient complètement désactivés/ignorés

## Problèmes spécifiques à investiguer
1. Pourquoi le proxy Vite retourne 304 au lieu de 200 malgré la configuration ?
2. Pourquoi `[RENDER_CLOUD_MODE] ACTIVE` s'affiche encore ?
3. Où se trouve le code qui affiche "ACTIVE - Pure Supabase backend only" (ce n'est pas dans `server.ts` d'après ce qu'on a vu, car `env.RENDER_CLOUD_MODE` est `false`)
4. Comment arrêter la boucle `TracePersistence` et `SupabaseRealtime` en mode LOCAL
5. Problème potentiel : le `status_code: 304` pourrait être tracé par le middleware de logging AVANT que la vraie réponse 200 ne soit envoyée ? Ou bien c'est vraiment la réponse finale ?