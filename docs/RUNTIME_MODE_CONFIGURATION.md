# Configuration du Mode d'Exécution

## Vue d'ensemble

L'application Ekala supporte trois modes d'exécution :

- **LOCAL** : Développement avec SQLite (Vite dev server, Electron)
- **CLOUD** : Production avec Supabase (Render + Vercel)
- **HYBRID** : Frontend local + Backend cloud (Electron pointing to production API)

## Détection automatique

Le mode est détecté automatiquement au démarrage selon cette priorité :

### Côté Client (Frontend - Vercel)

1. **Variable d'environnement explicite** (priorité maximale)
   ```bash
   VITE_APP_MODE=local   # ou cloud, hybrid
   ```

2. **Détection Electron**
   ```bash
   ELECTRON=true
   # OU détecté via navigator.userAgent
   ```

3. **Vite dev server**
   ```bash
   # Automatiquement détecté via import.meta.env.DEV === true
   ```

4. **Localhost detection**
   ```bash
   # localhost ou 127.0.0.1 → LOCAL
   ```

5. **Fallback** : CLOUD (sécurisé pour la production)

### Côté Serveur (Backend - Render)

- **Toujours CLOUD** : Le serveur utilise systématiquement Supabase
- SQLite est désactivé en mode RENDER_CLOUD_MODE=true

## Configuration par environnement

### Développement Local (Vite)

**Fichier `.env.development`** :
```bash
# Mode d'exécution
VITE_APP_MODE=local

# API Backend (local)
VITE_API_URL=http://localhost:3001

# Supabase (optionnel en LOCAL, mais requis pour sync)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_PATH=./backend/database.sqlite
```

**Démarrage** :
```bash
npm run dev
```

### Electron (Desktop)

**Fichier `.env.electron`** :
```bash
# Mode d'exécution
VITE_APP_MODE=local
VITE_ELECTRON=true

# API Backend (peut être local ou cloud)
VITE_API_URL=http://localhost:3001

# Supabase (requis pour sync en mode HYBRID)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

**Démarrage** :
```bash
npm run electron:dev
```

### Production Cloud (Render + Vercel)

**Backend - Render (Environment Variables)** :
```bash
# Mode
NODE_ENV=production
RENDER_CLOUD_MODE=true

# Database - Supabase uniquement
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CORS
FRONTEND_BASE_URL=https://ekala.vercel.app
CORS_ORIGINS=https://ekala.vercel.app,https://ekala-admin.vercel.app

# Port
PORT=3001
```

**Frontend - Vercel (Environment Variables)** :
```bash
# Mode
VITE_APP_MODE=cloud

# API Backend
VITE_API_URL=https://ekala-backend.onrender.com

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Déploiement** :
```bash
# Backend - Render
git push origin main  # Auto-deploy sur Render

# Frontend - Vercel
vercel --prod
```

### Mode Hybride (Electron + Cloud Backend)

**Fichier `.env.hybrid`** :
```bash
# Mode d'exécution
VITE_APP_MODE=hybrid
VITE_ELECTRON=true

# API Backend (production)
VITE_API_URL=https://ekala-backend.onrender.com

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

**Démarrage** :
```bash
# Lancer l'application Electron pointant vers le backend cloud
npm run electron:dev
```

## Vérification de la configuration

### Endpoints de diagnostic

#### 1. Health check complet
```bash
GET /api/runtime/health
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "mode": "LOCAL",
    "database": "sqlite",
    "environment": "development",
    "timestamp": "2026-07-08T10:00:00.000Z",
    "runtimeContext": {
      "mode": "LOCAL",
      "isLocal": true,
      "isCloud": false,
      "isHybrid": false
    },
    "server": {
      "nodeEnv": "development",
      "render": "false",
      "vercel": "false"
    }
  }
}
```

#### 2. Mode simplifié
```bash
GET /api/runtime/mode
```

**Réponse** :
```json
{
  "mode": "LOCAL",
  "timestamp": "2026-07-08T10:00:00.000Z"
}
```

### Tests locaux

```bash
# Démarrer le serveur
npm run dev

# Vérifier le mode détecté
curl http://localhost:3001/api/runtime/mode

# Vérifier le health check complet
curl http://localhost:3001/api/runtime/health
```

### Tests de production

```bash
# Vérifier le backend Render
curl https://ekala-backend.onrender.com/api/runtime/health

# Vérifier le frontend Vercel
curl https://ekala.vercel.app/api/runtime/mode
```

## Règles de déploiement

### Backend (Render)

1. **Variables d'environnement obligatoires** :
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RENDER_CLOUD_MODE=true`

2. **Interdictions** :
   - ❌ Pas de SQLite en mode CLOUD
   - ❌ Pas de fichiers `.env` locaux
   - ❌ Pas de `dotenv` en production (sauf pour Render avec `npm ci --omit=dev`)

3. **Vérifications** :
   - ✅ Endpoint `/api/runtime/health` retourne `"mode": "CLOUD"`
   - ✅ Endpoint `/api/runtime/health` retourne `"database": "supabase"`
   - ✅ Logs au démarrage : `[RENDER_CLOUD_MODE] ACTIVE`

### Frontend (Vercel)

1. **Variables d'environnement obligatoires** :
   - `VITE_APP_MODE=cloud`
   - `VITE_API_URL=https://ekala-backend.onrender.com`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. **Interdictions** :
   - ❌ Pas de `VITE_APP_MODE=local` en production
   - ❌ Pas de `localhost` dans les URLs

3. **Vérifications** :
   - ✅ Console navigateur : `[app-mode] Mode detected: CLOUD`
   - ✅ Pas d'erreur 404 sur `/api/runtime/mode`

## Dépannage

### Problème : Le mode LOCAL est détecté en production

**Cause** : Variable `VITE_APP_MODE` mal configurée ou absente

**Solution** :
1. Vérifier les variables d'environnement Vercel
2. S'assurer que `VITE_APP_MODE=cloud` est défini
3. Redéployer le frontend

### Problème : Le backend utilise SQLite en mode CLOUD

**Cause** : `RENDER_CLOUD_MODE` n'est pas défini

**Solution** :
1. Vérifier les variables d'environnement Render
2. S'assurer que `RENDER_CLOUD_MODE=true` est défini
3. Redéployer le backend

### Problème : Erreur de détection du mode

**Cause** : Import de `app-mode.ts` côté serveur échoue

**Solution** :
1. Vérifier les logs du serveur
2. Chercher `[RuntimeContext] Impossible de détecter le mode`
3. Vérifier que `app-mode.ts` est accessible depuis le serveur

### Problème : ModeResolver n'est pas trouvé

**Cause** : Chemin d'import incorrect

**Solution** :
- `ModeResolver` est déprécié, utiliser `RuntimeContext.getInstance()` ou `getAppMode()` directement
- Si le chemin `../../lib/app-mode` ne fonctionne pas, utiliser `RuntimeContext` à la place

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vercel)                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │  app-mode.ts (détection côté client)              │  │
│  │  - VITE_APP_MODE                                 │  │
│  │  - Electron detection                             │  │
│  │  - Localhost detection                            │  │
│  │  - Fallback CLOUD                                 │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↓                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │  RuntimeContext (singleton)                       │  │
│  │  - mode: ExecutionMode                            │  │
│  │  - isLocal, isCloud, isHybrid                     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Backend (Render)                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │  app-mode.ts (côté serveur)                       │  │
│  │  - Toujours CLOUD (pas de window)                 │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↓                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │  RuntimeContext (singleton)                       │  │
│  │  - mode: CLOUD                                    │  │
│  │  - database: supabase                             │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Bonnes pratiques

1. **Toujours utiliser `RuntimeContext`** au lieu d'importer `app-mode.ts` directement
2. **Ne jamais hardcoder le mode** dans le code
3. **Tester les 3 modes** avant de déployer
4. **Vérifier les endpoints de diagnostic** après chaque déploiement
5. **Logger le mode détecté** au démarrage pour debugging

## Migration depuis l'ancien système

### Avant
```typescript
import { isLocal } from '../lib/app-mode';
if (isLocal()) { ... }
```

### Après
```typescript
import { RuntimeContext } from '../core/runtime/runtime-context';
const runtime = RuntimeContext.getInstance();
if (runtime.isLocal) { ... }
```

## Support

Pour toute question ou problème :
1. Consulter les logs du serveur (`[RuntimeContext]`, `[app-mode]`)
2. Vérifier les endpoints `/api/runtime/health` et `/api/runtime/mode`
3. Consulter ce document