# 📋 RAPPORT DE DIAGNOSTIC - DÉTECTION DU MODE D'EXÉCUTION

**Date:** 2026-07-09  
**Problème:** L'application détecte le mode CLOUD au lieu de LOCAL en développement  
**Statut:** ⚠️ PROBLÈME IDENTIFIÉ - EN ATTENTE DE CORRECTION

---

## 🎯 RÉSUMÉ EXÉCUTIF

L'application continue d'utiliser les APIs cloud (Supabase/Vercel) même en mode développement local, malgré la configuration `VITE_APP_MODE=local` dans le fichier `.env`.

**Preuve du problème:**
```
[RuntimeMode] Mode: ☁️ CLOUD | Electron: false
{"requestId":"unknown","timestamp":"2026-07-09T06:21:47.980Z","step":"ENTER getProductRepository","extra":{"isSupabaseMode":true}}
{"requestId":"unknown","timestamp":"2026-07-09T06:21:47.983Z","step":"CHOICE SupabaseRepository"}
```

**Erreur utilisateur:**
```
GET http://localhost:5173/api/auth/tenants/great-olive net::ERR_EMPTY_RESPONSE
LoginPage.tsx:375 [Login] Tenant fetch error: TypeError: Failed to fetch
```

---

## 🔍 ANALYSE DES FICHIERS

### 1. Configuration .env
**Fichier:** `.env` (ligne 8)
```env
VITE_APP_MODE=local
```
✅ **Correctement configuré**

### 2. RuntimeContext (Côté Serveur)
**Fichier:** `src/core/runtime/runtime-context.ts` (lignes 81-110)

```typescript
private static detectMode(): ExecutionMode {
  try {
    // Côté serveur (Node.js) : détection via process.env uniquement
    if (process.env.VITE_APP_MODE === 'local') return 'LOCAL';
    if (process.env.VITE_APP_MODE === 'cloud') return 'CLOUD';
    if (process.env.VITE_APP_MODE === 'hybrid') return 'HYBRID';
    if (process.env.RENDER_CLOUD_MODE === 'true') return 'CLOUD';
    if (process.env.RENDER === 'true') return 'CLOUD';
    if (process.env.NODE_ENV === 'production') return 'CLOUD';
    
    // Fallback serveur
    return 'LOCAL';
  } catch (error) {
    console.warn('[RuntimeContext] Impossible de détecter le mode, fallback sur CLOUD:', error);
    return 'CLOUD';
  }
}
```

**Logique de détection:**
1. ✅ Vérifie `VITE_APP_MODE === 'local'` → Devrait retourner `LOCAL`
2. ⚠️ Fallback sur `CLOUD` en cas d'erreur

**Problème potentiel:** Si `process.env.VITE_APP_MODE` n'est pas accessible, le fallback retourne `CLOUD`.

### 3. App Mode Server
**Fichier:** `src/lib/app-mode.server.ts` (lignes 18-35)

```typescript
const cachedMode: AppMode = (() => {
  // 1. Explicit mode via environment variable (highest priority)
  if (process.env.VITE_APP_MODE === 'local') return 'LOCAL';
  if (process.env.VITE_APP_MODE === 'cloud') return 'CLOUD';
  if (process.env.VITE_APP_MODE === 'hybrid') return 'HYBRID';

  // 2. Render cloud mode detection
  if (process.env.RENDER_CLOUD_MODE === 'true') return 'CLOUD';

  // 3. Render deployment detection
  if (process.env.RENDER === 'true') return 'CLOUD';

  // 4. Node environment
  if (process.env.NODE_ENV === 'production') return 'CLOUD';

  // 5. Fallback to LOCAL for development
  return 'LOCAL';
})();
```

✅ **Logique identique à RuntimeContext**  
✅ **Fallback sécurisé sur LOCAL en développement**

### 4. Server.ts - Initialisation
**Fichier:** `src/server/server.ts` (lignes 1-10, 539-561)

```typescript
// === Environment loading ===
// Load .env file in all modes (local, Render, production)
// This ensures Supabase credentials are always available
try {
  // @ts-ignore - dotenv may not be installed in production builds
  require('dotenv/config');
} catch {
  // dotenv not present — this is expected on Render with npm ci --omit=dev
  // In that case, environment variables must be set in the hosting platform
}
```

**Chargement du .env:** ✅ Présent au début du fichier

**Sync Engine (ligne 539-561):**
```typescript
if (!env.RENDER_CLOUD_MODE && db) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const { initializeSyncV2 } = require('../sync/index');
      // ... initialisation du sync
      console.log(`[SyncV2] Engine initialized (ALL ${26} tables covered)`);
    } catch (err: any) {
      console.error('[SyncV2] Failed to initialize sync engine:', err?.message || err);
    }
  } else {
    console.warn('[SyncV2] SUPABASE_URL or key missing — sync disabled');
  }
}
```

⚠️ **PROBLÈME IDENTIFIÉ:** Le sync engine s'initialise si `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont présents dans le .env, **sans vérifier le mode d'exécution**.

### 5. AuthService - Sélection du Provider
**Fichier:** `src/core/auth/AuthService.ts` (lignes 20-30)

```typescript
private constructor() {
  const runtime = RuntimeContext.getInstance();
  
  if (runtime.isLocal) {
    this.provider = new LocalAuthProvider();
  } else if (runtime.isCloud) {
    this.provider = new CloudAuthProvider();
  } else {
    this.provider = new HybridAuthProvider();
  }
}
```

✅ **Sélection correcte du provider selon le mode**

### 6. LocalAuthProvider
**Fichier:** `src/core/auth/providers/LocalAuthProvider.ts` (lignes 42-67)

```typescript
export class LocalAuthProvider implements IAuthProvider {
  private apiBase = '/api/auth';

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.apiBase}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LocalAuthProvider: ${res.status} ${body}`);
    }
    return res.json();
  }

  async resolveTenant(slug: string): Promise<TenantInfo> {
    const tenant = await this.request<SqliteTenant>(`/tenants/${slug}`);
    // ...
  }
}
```

✅ **Provider LOCAL correctement implémenté**  
✅ **Appelle l'API backend locale `/api/auth/tenants/:slug`**

### 7. Vite Config - Proxy
**Fichier:** `vite.config.ts` (lignes 68-80)

```typescript
server: {
  port: 5173,
  host: true,
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
      secure: false,
      timeout: 10000,
      ws: false
    }
  }
}
```

✅ **Proxy Vite correctement configuré**  
✅ **Redirige `/api` vers le backend Express sur port 3001**

---

## 🐛 PROBLÈMES IDENTIFIÉS

### Problème #1: Initialisation du Sync Engine en Mode LOCAL

**Localisation:** `src/server/server.ts` (ligne 539)

**Symptôme:** Le sync engine Supabase s'initialise même en mode LOCAL si les credentials sont présents.

**Code problématique:**
```typescript
if (!env.RENDER_CLOUD_MODE && db) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    // ❌ Problème: Pas de vérification du mode d'exécution
    const { initializeSyncV2 } = require('../sync/index');
    syncOrchestratorV2 = initializeSyncV2(db, supabaseUrl, supabaseKey);
    console.log(`[SyncV2] Engine initialized (ALL ${26} tables covered)`);
  }
}
```

**Impact:** 
- Le sync engine démarre en mode LOCAL
- Les requêtes Supabase sont envoyées même en développement
- Confusion sur le mode d'exécution

**Solution recommandée:**
```typescript
if (!env.RENDER_CLOUD_MODE && db && getAppMode() === 'LOCAL') {
  // Ou mieux: utiliser RuntimeContext
  const runtime = RuntimeContext.getInstance();
  if (runtime.isLocal) {
    // Initialiser le sync seulement si nécessaire
  }
}
```

### Problème #2: Logs Montrant le Mode CLOUD

**Symptôme:** Le log `[RuntimeMode] Mode: ☁️ CLOUD` apparaît malgré `VITE_APP_MODE=local`

**Causes possibles:**
1. **Chargement tardif du .env** - Le fichier `.env` n'est pas chargé avant l'instanciation de RuntimeContext
2. **Singleton déjà initialisé** - RuntimeContext est créé avant le chargement de dotenv
3. **Process.env non propagé** - Les variables d'environnement ne sont pas disponibles au moment de la détection

**Investigation nécessaire:**
- Vérifier l'ordre d'initialisation des modules
- Vérifier si dotenv est bien installé et chargé
- Vérifier si `process.env.VITE_APP_MODE` est accessible au moment de la détection

### Problème #3: Requête Tenant qui Échoue

**Erreur:**
```
GET http://localhost:5173/api/auth/tenants/great-olive net::ERR_EMPTY_RESPONSE
```

**Analyse:**
1. ✅ Le `LocalAuthProvider` appelle correctement `/api/auth/tenants/great-olive`
2. ✅ Le proxy Vite devrait rediriger vers `http://127.0.0.1:3001/api/auth/tenants/great-olive`
3. ❌ La réponse est vide (`ERR_EMPTY_RESPONSE`)

**Causes possibles:**
1. **Backend Express ne répond pas** - Le serveur sur port 3001 n'est pas démarré ou crash
2. **Route non trouvée** - La route `/api/auth/tenants/:slug` n'existe pas
3. **Erreur serveur silencieuse** - Le backend crash sans retourner de réponse
4. **Timeout** - La requête timeout après 10s (config Vite)

**Investigation nécessaire:**
- Vérifier les logs du serveur Express
- Vérifier que la route `/api/auth/tenants/:slug` est bien montée
- Tester la route directement avec curl/Postman

---

## 📊 LOGS D'EXÉCUTION

### Logs Serveur (Backend)
```
[Database] Connecting to: /Users/meyinzaji/Codes/reactjs/great_olive/data/database.db
[RuntimeMode] Mode: ☁️ CLOUD | Electron: false  ❌ DEVRAIT ÊTRE: ☁️ CLOUD → 🏠 LOCAL
{"requestId":"unknown","timestamp":"2026-07-09T06:21:47.980Z","step":"ENTER getProductRepository","extra":{"isSupabaseMode":true}} ❌
{"requestId":"unknown","timestamp":"2026-07-09T06:21:47.983Z","step":"CHOICE SupabaseRepository"} ❌
```

### Logs Frontend (Navigateur)
```
[TENANT][NO_CID][T+15480ms]   tenant_name persisté = "(undefined)"
api/auth/tenants/great-olive:1  Failed to load resource: net::ERR_EMPTY_RESPONSE
LoginPage.tsx:375 [Login] Tenant fetch error: TypeError: Failed to fetch
    at LocalAuthProvider.request (LocalAuthProvider.ts:46:23)
    at LocalAuthProvider.resolveTenant (LocalAuthProvider.ts:58:31)
    at AuthService.resolveTenant (AuthService.ts:44:26)
    at LoginPage.tsx:367:44
```

---

## 🔧 RECOMMANDATIONS DE CORRECTION

### 1. Corriger l'Initialisation du Sync Engine

**Fichier:** `src/server/server.ts` (ligne 539)

**Modification recommandée:**
```typescript
// AVANT
if (!env.RENDER_CLOUD_MODE && db) {

// APRÈS
import { RuntimeContext } from '../core/runtime/runtime-context';

// ... dans le code ...
const runtime = RuntimeContext.getInstance();
if (!env.RENDER_CLOUD_MODE && db && runtime.isLocal) {
  // Le sync engine ne s'initialise que si nécessaire
  // Par exemple, seulement si ENABLE_SUPABASE_SYNC est true
  if (env.ENABLE_SUPABASE_SYNC) {
    // ... initialisation
  }
}
```

### 2. Ajouter un Log de Diagnostic au Démarrage

**Fichier:** `src/server/server.ts` (après ligne 68)

**Ajouter:**
```typescript
import { RuntimeContext } from './core/runtime/runtime-context';

// ... après initializeDatabase()
const runtime = RuntimeContext.getInstance();
console.log('[RENDER BOOT] Runtime mode:', runtime.toString());
console.log('[RENDER BOOT] VITE_APP_MODE:', process.env.VITE_APP_MODE);
console.log('[RENDER BOOT] NODE_ENV:', process.env.NODE_ENV);
console.log('[RENDER BOOT] RENDER_CLOUD_MODE:', process.env.RENDER_CLOUD_MODE);
```

### 3. Vérifier le Chargement de dotenv

**Fichier:** `src/server/server.ts` (ligne 4)

**Ajouter une vérification:**
```typescript
try {
  require('dotenv/config');
  console.log('[RENDER BOOT] dotenv loaded successfully');
  console.log('[RENDER BOOT] VITE_APP_MODE:', process.env.VITE_APP_MODE);
} catch (err) {
  console.warn('[RENDER BOOT] dotenv not loaded:', err);
}
```

### 4. Corriger la Route Tenants (si manquante)

**Vérifier:** `src/server/routes/auth-setup.ts` ou `src/server/services/auth.service.ts`

**La route suivante doit exister:**
```typescript
// GET /api/auth/tenants/:slug
router.get('/tenants/:slug', async (req, res) => {
  const { slug } = req.params;
  // ... récupérer le tenant depuis SQLite
});
```

---

## 📋 CHECKLIST DE VÉRIFICATION

- [ ] Vérifier que `dotenv` est bien installé (`npm list dotenv`)
- [ ] Vérifier que le fichier `.env` est à la racine du projet
- [ ] Vérifier les permissions du fichier `.env` (doit être lisible)
- [ ] Vérifier que `VITE_APP_MODE=local` est bien présent dans `.env`
- [ ] Vérifier que le backend Express démarre correctement sur le port 3001
- [ ] Vérifier que la route `/api/auth/tenants/:slug` existe et répond
- [ ] Vérifier les logs du backend pour des erreurs silencieuses
- [ ] Tester la route directement: `curl http://localhost:3001/api/auth/tenants/great-olive`
- [ ] Vérifier que `RuntimeContext` est instancié APRÈS le chargement de dotenv
- [ ] Ajouter des logs de debug pour tracer la détection du mode

---

## 🎯 CONCLUSION

**Problème principal:** Le mode d'exécution est détecté comme `CLOUD` au lieu de `LOCAL`, mais la cause racine n'est pas claire.

**Hypothèses:**
1. **Hypothèse #1 (70%):** `process.env.VITE_APP_MODE` n'est pas accessible au moment de la détection
   - Chargement tardif de dotenv
   - Singleton RuntimeContext créé avant le chargement des variables
   
2. **Hypothèse #2 (20%):** Le backend Express ne répond pas sur `/api/auth/tenants/:slug`
   - Route manquante
   - Erreur serveur silencieuse
   - Base de données non initialisée

3. **Hypothèse #3 (10%):** Conflit entre plusieurs systèmes de détection
   - RuntimeContext vs app-mode.server.ts vs env.ts
   - Initialisation dans le mauvais ordre

**Prochaine étape:** Ajouter des logs de diagnostic pour confirmer la cause racine.

---

## 📝 NOTES

- Le fichier `.env` contient bien `VITE_APP_MODE=local` (ligne 8)
- La logique de détection dans `RuntimeContext` et `app-mode.server.ts` est correcte
- Le fallback sur `CLOUD` en cas d'erreur peut masquer le vrai problème
- Le sync engine s'initialise sans vérifier le mode d'exécution
- La requête tenant échoue avec `ERR_EMPTY_RESPONSE` (backend ne répond pas)

**Diagnostic généré le:** 2026-07-09  
**Fichier:** `docs/DIAGNOSTIC_RUNTIME_MODE.md`