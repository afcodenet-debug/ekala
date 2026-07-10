# 🔍 DIAGNOSTIC COMPLET - Problème de Login (Nom Tenant + PIN)

## Date : 03/07/2026
## Auteur : Audit Architecture

---

## 🎯 Résumé du Problème

**Deux symptômes distincts mais liés :**

1. **Nom du tenant incorrect** : L'application affiche "EKALA" (nom de la plateforme) au lieu du nom de l'établissement du tenant
2. **PIN invalides** : Les codes PIN des utilisateurs ne fonctionnent plus

---

## 📊 Architecture du Système d'Authentification

### Les 3 Routes d'Authentification Existantes

| Fichier | Route | Statut | Description |
|---------|-------|--------|-------------|
| `src/server/routes/auth.ts` | `POST /api/auth/login` | ⚠️ NON monté | Route legacy, compare PIN en clair |
| `src/server/services/auth.service.ts` | `POST /api/auth/login/pin` | ✅ MONTÉ | Route moderne avec hash bcrypt + tenant_slug |
| `src/server/routes/auth-setup.ts` | `POST /api/auth/login/pin` | ❌ NON monté | Route setup, jamais utilisée |

### Montage dans server.ts (ligne 225)
```typescript
app.use('/api/auth', authService); // authService = auth.service.ts
```

---

## 🔬 Problème #1 : Nom du Tenant "EKALA" au lieu du vrai nom

### Flux d'exécution (auth.service.ts lignes 358-550)

```
Frontend envoie: POST /api/auth/login/pin
  Body: { pin_code, identity, tenant_slug }
```

### Étape 1 - Détection du mode (ligne 369)
```typescript
const supabase = getSupabase(req);
```

**Problème :** `getSupabase(req)` utilise `dataSource.resolveFromRequest(req)` qui vérifie :
1. Header `X-Runtime-Mode` → pas envoyé par le frontend
2. Host/Origin/Referer → dépend de l'environnement
3. Variables d'env `RENDER_CLOUD_MODE`, `USE_SUPABASE_*` → **TOUTES à `false` dans `.env`**

**Résultat :** En local, `getSupabase()` retourne `null` → on tombe dans le chemin SQLite

### Étape 2 - Recherche du tenant (lignes 376-435)
```typescript
if (tenant_slug) {
  // 4 tentatives de recherche :
  // 1. slug exact (case-sensitive)
  // 2. slug lowercase
  // 3. business_id
  // 4. name ILIKE
}
```

**Problème :** Si le tenant_slug fourni par le frontend ne correspond à AUCUN tenant dans Supabase, la recherche échoue silencieusement (ligne 430 : `console.warn` seulement).

### Étape 3 - Recherche des users (lignes 439-498)
```typescript
const applyFilters = (q: any, useLegacy = false) => {
  const filterId = useLegacy && tenantFilter.legacy_tenant_id 
    ? tenantFilter.legacy_tenant_id 
    : tenantFilter.tenant_id;
  if (filterId) {
    q = q.eq('tenant_id', String(filterId));
  }
  // ...
};
```

**Problème CRITIQUE :** Si `tenantFilter.tenant_id` est `undefined` (tenant non trouvé), le filtre `tenant_id` n'est PAS appliqué. La requête cherche TOUS les users actifs sans restriction de tenant.

### Étape 4 - Vérification PIN (lignes 500-550)
```typescript
for (const user of candidates) {
  if (user.pin_code && verifyPin(pin_code, user.pin_code)) {
    const tenant = user.tenants || {};
    return res.json({
      // ...
      tenant_name: tenant?.name || null,  // ← ICI le problème
    });
  }
}
```

**Problème :** 
- Si la requête Supabase utilise `tenants!inner(name, slug)` et que le tenant n'existe pas → `candidates` est vide
- Si la requête est SANS join (fallback) → `user.tenants` est `undefined`
- `tenant?.name || null` → retourne `null`
- Le frontend affiche "EKALA" comme fallback quand `tenant_name` est `null`

### Cause Racine #1

```
Frontend envoie tenant_slug = "mon-restaurant"
  → Supabase ne trouve pas ce slug dans la table 'tenants'
  → tenantFilter.tenant_id = undefined
  → Aucun filtre tenant_id appliqué à la requête users
  → User trouvé mais sans tenant_name
  → Frontend affiche "EKALA" (fallback)
```

---

## 🔬 Problème #2 : Codes PIN qui ne fonctionnent plus

### Analyse du hash PIN

**Dans auth.service.ts (lignes 86-118) :**
```typescript
function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);  // Hash bcrypt
}

function verifyPin(pin: string, stored: string): boolean {
  if (stored.startsWith('$2')) {
    return bcrypt.compareSync(pin, stored);  // Vérification bcrypt
  }
  if (stored.includes(':')) {
    // Legacy salt:hash format
  }
  return pin === stored;  // Fallback plain text !
}
```

**Dans auth.ts (lignes 25-36) - Route legacy NON montée :**
```typescript
let query = supabase
  .from('users')
  .select('...')
  .eq('pin_code', pin_code);  // ← Compare PIN en CLAIR dans Supabase !
```

### Le Problème

Il y a **DEUX approches différentes** pour vérifier le PIN :

1. **Route legacy (`auth.ts`)** : `.eq('pin_code', pin_code)` → compare le PIN en clair dans la requête SQL
   - ⚠️ Ne fonctionne PAS si le PIN est hashé avec bcrypt dans la base
   - ⚠️ Cette route N'EST PAS montée dans server.ts

2. **Route moderne (`auth.service.ts`)** : `verifyPin(pin_code, user.pin_code)` → vérifie avec bcrypt
   - ✅ Fonctionne avec les PINs hashés
   - ✅ C'est la route utilisée

### Cause Racine #2

```
Les PINs sont stockés hashés avec bcrypt dans Supabase
  → La requête SQL avec .eq('pin_code', pin_code) échoue (PIN clair ≠ hash)
  → Mais cette route (auth.ts) n'est pas utilisée
  → La route auth.service.ts utilise verifyPin() qui gère bcrypt
  → SI le mode est 'local' (SQLite), getSupabase() retourne null
  → On tombe sur le chemin SQLite (lignes 550+)
  → La fonction getLocalUserByPin() cherche dans SQLite
  → Si l'user n'existe pas dans SQLite → échec
```

---

## 🔗 Problème #3 : Dualité Local/Cloud

### Le DataSourceManager (data-source-manager.ts)

```typescript
private detectMode(value?: string | null): EnvironmentMode {
  // 1. X-Runtime-Mode header
  if (value === 'local' || value === 'cloud') return value;
  
  // 2. Environment variables
  if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS || ...) return 'cloud';
  
  // 3. URL-based detection
  if (value) return resolveRuntimeMode(value);
  
  // 4. NODE_ENV fallback
  if (env.NODE_ENV === 'development') return 'local';
  
  // 5. Default to cloud
  return 'cloud';
}
```

**Problème :** 
- En local (development), `NODE_ENV=development` → mode 'local' → SQLite
- Les users dans SQLite ont des PINs en clair (non hashés)
- Les users dans Supabase ont des PINs hashés avec bcrypt
- Si le mode passe en 'cloud' (par exemple via header), le système cherche dans Supabase avec des PINs hashés

### Le Piège du Fallback Plain Text

```typescript
// auth.service.ts ligne 117
return pin === stored;  // Fallback: Plain text comparison
```

Ce fallback permet aux PINs en clair de fonctionner, mais crée une **faille de sécurité** et masque le vrai problème.

---

## 📋 Synthèse des Causes Racines

### Cause #1 : Nom du tenant "EKALA"
```
Frontend → tenant_slug inconnu dans Supabase
  → tenantFilter.tenant_id = undefined
  → Aucun scope tenant appliqué
  → user.tenants = undefined
  → tenant_name = null
  → Frontend affiche "EKALA" (fallback)
```

### Cause #2 : PIN invalides
```
Mode local (SQLite) :
  → getSupabase() retourne null
  → getLocalUserByPin() cherche dans SQLite
  → Si l'user n'existe pas dans SQLite → échec
  → Si le PIN est hashé dans SQLite mais vérifié en clair → échec

Mode cloud (Supabase) :
  → getSupabase() retourne un client
  → Recherche dans Supabase avec tenant_slug
  → Si tenant_slug inconnu → pas de filtre tenant_id
  → User trouvé mais PIN ne correspond pas (hash mismatch)
```

### Cause #3 : Confusion entre les routes
```
Deux fichiers avec des routes similaires :
  - auth.ts (legacy, non monté) : compare PIN en clair
  - auth.service.ts (monté) : vérifie avec bcrypt
  
Mais le frontend pourrait appeler l'ancienne route si l'URL est mal configurée
```

---

## 💡 Recommandations (sans modification de code)

### 1. Vérifier la configuration du tenant dans Supabase
```sql
-- Vérifier que le tenant existe avec le bon slug
SELECT id, name, slug FROM tenants WHERE slug = 'nom-du-tenant';

-- Vérifier que les users ont le bon tenant_id
SELECT id, username, tenant_id, pin_code FROM users WHERE tenant_id = [id];
```

### 2. Vérifier le mode d'exécution
```bash
# Vérifier les variables d'environnement
echo $NODE_ENV
echo $RENDER_CLOUD_MODE
echo $USE_SUPABASE_PRODUCTS
```

### 3. Vérifier les logs du serveur
```bash
# Chercher les logs d'authentification
grep -i "\[Auth\]" /var/log/app.log
# Chercher les erreurs de tenant
grep -i "tenant" /var/log/app.log
```

### 4. Tester manuellement l'API
```bash
# Test direct du login PIN
curl -X POST http://localhost:3001/api/auth/login/pin \
  -H "Content-Type: application/json" \
  -d '{"pin_code": "1234", "identity": "waiter1", "tenant_slug": "mon-restaurant"}'
```

### 5. Vérifier la cohérence des données
```bash
# Lister les users dans SQLite
sqlite3 backend/database.sqlite "SELECT id, username, role, tenant_id, pin_code FROM users;"

# Lister les tenants dans SQLite
sqlite3 backend/database.sqlite "SELECT id, name, slug FROM tenants;"
```

---

## 📊 Matrice d'Impact

| Scénario | Mode | Source | PIN | Nom Tenant |
|----------|------|--------|-----|------------|
| Dev local | Local | SQLite | ✅ En clair | ✅ Jointure SQL |
| Dev avec header cloud | Cloud | Supabase | ❌ Hash mismatch | ❌ Slug inconnu |
| Production (Render) | Cloud | Supabase | ❌ Hash mismatch | ❌ Slug inconnu |
| Production (Vercel) | Cloud | Supabase | ❌ Hash mismatch | ❌ Slug inconnu |

---

## 🎯 Conclusion

Le problème est **multifactoriel** :

1. **Les données ne sont pas synchronisées** entre SQLite et Supabase (tenants, users, PINs)
2. **La détection de mode** est instable (dépend du header, de l'URL, des variables d'env)
3. **Deux routes d'auth** coexistent avec des logiques différentes (l'une montée, l'autre pas)
4. **Le fallback "EKALA"** masque l'absence de données tenant correctes
5. **Les PINs hashés** en Supabase ne correspondent pas aux PINs en clair en SQLite

**Solution recommandée :**
1. Synchroniser les tenants SQLite → Supabase
2. Uniformiser le hash des PINs (bcrypt partout)
3. Nettoyer les routes d'auth redondantes
4. Ajouter un header `X-Runtime-Mode` explicite dans le frontend
5. Logger le mode détecté à chaque tentative de login

---

*Document créé le 03/07/2026 - Diagnostic sans modification de code*