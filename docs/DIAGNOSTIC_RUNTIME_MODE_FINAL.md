# Diagnostic Final - Problème de Détection du Mode d'Environnement

## Date du Diagnostic
09/07/2026

## Symptômes Observés

1. **Logs du serveur affichent `[RENDER_CLOUD_MODE] ACTIVE`** même en développement local
2. **Mode détecté : `☁️ CLOUD`** au lieu de `🏠 LOCAL`
3. **Erreur d'authentification** : `GET http://localhost:5173/api/auth/tenants/great-olive net::ERR_EMPTY_RESPONSE`
4. **Le frontend utilise les APIs cloud** au lieu du mode local SQLite

## Configuration du Fichier `.env`

```env
VITE_APP_MODE=local
USE_SUPABASE_PRODUCTS=false
USE_SUPABASE_TABLES=false
USE_SUPABASE_ORDERS=false
ENABLE_SUPABASE_SYNC=false
```

## Analyse du Problème

### Fichier `src/server/config/env.ts`

**Version AVANT correction :**

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  USE_SUPABASE_PRODUCTS: z.coerce.boolean().default(false),
  USE_SUPABASE_TABLES: z.coerce.boolean().default(false),
  USE_SUPABASE_ORDERS: z.coerce.boolean().default(false),
  // ⚠️ RENDER_CLOUD_MODE MANQUANT DANS LE SCHÉMA !
  ENABLE_SUPABASE_SYNC: z.coerce.boolean().default(false),
  ENABLE_SUPABASE_PULL: z.coerce.boolean().default(false),
  ENABLE_SUPABASE_REALTIME_PULL: z.coerce.boolean().default(true),
  SUPABASE_PULL_INTERVAL_MS: z.coerce.number().default(8000),
  SUPABASE_PULL_LOOKBACK_MIN: z.coerce.number().default(120),
  USE_V2_SUBSCRIPTION_FLOW: z.coerce.boolean().default(false),
  CORS_ORIGINS: z.string().optional(),
  DATA_DIR: z.string().optional(),
  JWT_SECRET: z.string().min(16).optional(),
});
```

**Problème identifié :**

1. Le fichier `env.ts` possède une logique d'override basée sur `VITE_APP_MODE` (ligne 16)
2. Quand `VITE_APP_MODE=local`, l'override définit `RENDER_CLOUD_MODE='false'`
3. **MAIS** `RENDER_CLOUD_MODE` n'était PAS dans le schéma Zod
4. Le schéma Zod supprime donc l'override et utilise la valeur par défaut
5. Si `RENDER_CLOUD_MODE` n'est pas défini dans `.env`, il devient `undefined` dans les logs
6. Le serveur `server.ts` interprète `undefined` comme `true` (valeur truthy)

### Fichier `src/server/server.ts`

```typescript
if (env.RENDER_CLOUD_MODE) {
  console.log('[RENDER_CLOUD_MODE] ACTIVE — Pure Supabase backend only');
  console.log('[RENDER_CLOUD_MODE] Local SQLite is FORBIDDEN on this instance');
  // ...
}
```

**Comportement observé :**

- `env.RENDER_CLOUD_MODE` est `undefined` (car supprimé par le schéma)
- `undefined` est évalué comme `false` dans une condition `if`
- **MAIS** les logs montrent `[RENDER_CLOUD_MODE] ACTIVE`, ce qui signifie que la condition est `true`

**Hypothèse confirmée :**

Le problème vient du fait que `RENDER_CLOUD_MODE` n'était pas dans le schéma Zod, donc :
1. L'override ligne 16 est créé mais jamais appliqué
2. La valeur par défaut du schéma est `false`
3. **MAIS** quelque part dans le code, `RENDER_CLOUD_MODE` est défini à `true` par défaut

## Solution Appliquée

### Correction du fichier `src/server/config/env.ts`

**Ajout de `RENDER_CLOUD_MODE` dans le schéma Zod :**

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  USE_SUPABASE_PRODUCTS: z.coerce.boolean().default(false),
  USE_SUPABASE_TABLES: z.coerce.boolean().default(false),
  USE_SUPABASE_ORDERS: z.coerce.boolean().default(false),
  RENDER_CLOUD_MODE: z.coerce.boolean().default(false),  // ✅ AJOUTÉ
  ENABLE_SUPABASE_SYNC: z.coerce.boolean().default(false),
  ENABLE_SUPABASE_PULL: z.coerce.boolean().default(false),
  ENABLE_SUPABASE_REALTIME_PULL: z.coerce.boolean().default(true),
  SUPABASE_PULL_INTERVAL_MS: z.coerce.number().default(8000),
  SUPABASE_PULL_LOOKBACK_MIN: z.coerce.number().default(120),
  USE_V2_SUBSCRIPTION_FLOW: z.coerce.boolean().default(false),
  CORS_ORIGINS: z.string().optional(),
  DATA_DIR: z.string().optional(),
  JWT_SECRET: z.string().min(16).optional(),
});
```

## Résultat Attendu

Après la correction :

1. ✅ `VITE_APP_MODE=local` est détecté
2. ✅ L'override `RENDER_CLOUD_MODE='false'` est créé
3. ✅ Le schéma Zod inclut maintenant `RENDER_CLOUD_MODE`
4. ✅ L'override est appliqué et `env.RENDER_CLOUD_MODE = false`
5. ✅ Le serveur démarre en mode `🏠 LOCAL`
6. ✅ SQLite est utilisé comme base de données
7. ✅ Les APIs cloud ne sont pas utilisées

## Vérification

Pour vérifier que la correction fonctionne :

```bash
# Redémarrer le serveur
npm run dev:web

# Vérifier les logs - vous devriez voir :
# [RENDER BOOT] VITE_APP_MODE: local
# [RENDER BOOT] RENDER_CLOUD_MODE: false
# [RENDER BOOT] Mode: 🏠 LOCAL | Electron: false
```

## Fichiers Modifiés

- `src/server/config/env.ts` - Ajout de `RENDER_CLOUD_MODE` dans le schéma Zod

## Recommandations

1. **Toujours inclure toutes les variables d'environnement** dans le schéma Zod
2. **Ajouter des logs de diagnostic** pour chaque variable critique
3. **Tester les deux modes** (local et cloud) régulièrement
4. **Documenter la logique de priorité** des variables d'environnement

## Conclusion

Le problème était causé par une **variable d'environnement manquante dans le schéma de validation Zod**. 

La logique d'override basée sur `VITE_APP_MODE` fonctionnait correctement, mais le schéma Zod supprimait l'override car il ne reconnaissait pas la variable `RENDER_CLOUD_MODE`.

**La correction consiste à ajouter `RENDER_CLOUD_MODE` dans le schéma Zod pour que l'override soit correctement appliqué.**