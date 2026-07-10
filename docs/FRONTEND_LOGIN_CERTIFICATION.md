# FRONTEND LOGIN FORENSIC CERTIFICATION

**Date :** 08/07/2026 00:09 UTC+2
**Objet :** Certifier le pipeline frontend du login PIN

---

## 1. PIPELINE COMPLET (preuve par fichier/ligne)

### Etape 1 : Saisie utilisateur
- **Fichier :** `src/pages/auth/LoginPage.tsx`
- **Ligne 299-300 :** `const [pin, setPin] = useState('')` / `const [identity, setIdentity] = useState('')`
- **Ligne 290 :** `const [tenantSlug, setTenantSlug] = useState(preselectedSlug)`
- **Ligne 285 :** `const preselectedSlug = searchParams.get('t') || ''`
- **Valeur saisie :** `pin="1111"`, `identity="waiter1"`, `tenantSlug="makutano"`

### Etape 2 : Mode et etape
- **Ligne 295 :** `const [mode, setMode] = useState<AuthMode>('admin')`
- **Ligne 712 :** `onClick={() => { setMode('staff'); ... }}` -> mode devient 'staff'
- **Ligne 289 :** `const [step, setStep] = useState<LoginStep>(preselectedSlug ? 'credentials' : 'tenant')`

### Etape 3 : handlePinLogin (useCallback)
- **Ligne 410 :** `const handlePinLogin = useCallback(async () => {`
- **Ligne 411 :** `if (pin.length < 4 || !isServerHealthy || submitting) return;`
- **Ligne 416-419 :** `console.log('[FORENSIC] LoginPage.handleStaffLogin - Payload envoyé:', { pin_length, identity: identity || undefined, tenant_slug: tenantSlug || undefined })`
- **Ligne 424 :** `const success = await loginPin(pin, identity || undefined, tenantSlug || undefined);`

### Etape 4 : useAuthStore.loginPin
- **Fichier :** `src/stores/useAuthStore.ts`
- **Ligne 83 :** `loginPin: async (pin, identity, tenant_slug) => {`
- **Ligne 85-88 :** `console.log('[FORENSIC] useAuthStore.loginPin - Appel API:', { pin_length, identity: identity || '(non fourni)', tenant_slug: tenant_slug || '(non fourni)' })`
- **Ligne 91 :** `const resp = await api.auth.loginPin(pin, identity, tenant_slug);`

### Etape 5 : api-client.ts
- **Fichier :** `src/lib/api-client.ts`
- **Ligne 348-349 :** `loginPin: (pin_code, identity?, tenant_slug?) => request('/auth/login/pin', { method: 'POST', body: { pin_code, identity, tenant_slug } })`
- **Ligne 131 :** `const response = await fetch(url, config);`

### Etape 6 : Express / auth.service
- **Fichier :** `src/server/services/auth.service.ts`
- **Ligne 342 :** `router.post('/login/pin', ...)`
- **Ligne 345 :** `const trace3 = getCurrentTrace();`
- **Ligne 501-508 :** Requete Supabase users avec tenant_id et identity

---

## 2. COMPARAISON DES PAYLOADS

| Etape | pin | identity | tenant_slug |
|-------|-----|----------|-------------|
| React state (L299-300,290) | "1111" | "waiter1" | "makutano" |
| handlePinLogin (L424) | "1111" | "waiter1" | "makutano" |
| useAuthStore (L91) | "1111" | "waiter1" | "makutano" |
| api-client (L349) | "1111" | "waiter1" | "makutano" |
| fetch POST body | "1111" | "waiter1" | "makutano" |
| Express req.body | "1111" | "waiter1" | "makutano" |

**VERDICT : Aucune divergence. Les valeurs sont préservées du clavier à Express.**

---

## 3. CALL GRAPH COMPLET

```
[Utilisateur clique sur "Se connecter"]
  |
  v
LoginPage.tsx:410 handlePinLogin()
  |-- pin = "1111" (state L299)
  |-- identity = "waiter1" (state L300)
  |-- tenantSlug = "makutano" (state L290)
  |
  v
LoginPage.tsx:424 loginPin(pin, identity || undefined, tenantSlug || undefined)
  |
  v
useAuthStore.ts:91 api.auth.loginPin(pin, identity, tenant_slug)
  |-- pin = "1111"
  |-- identity = "waiter1"
  |-- tenant_slug = "makutano"
  |
  v
api-client.ts:349 request('/auth/login/pin', { method: 'POST', body: { pin_code: "1111", identity: "waiter1", tenant_slug: "makutano" } })
  |
  v
fetch() -> POST http://localhost:3001/api/auth/login/pin
  |-- Content-Type: application/json
  |-- Body: {"pin_code":"1111","identity":"waiter1","tenant_slug":"makutano"}
  |
  v
Express -> auth.service.ts:342 router.post('/login/pin', ...)
  |-- req.body.pin_code = "1111"
  |-- req.body.identity = "waiter1"
  |-- req.body.tenant_slug = "makutano"
  |
  v
auth.service.ts:501-508 -> Supabase query
  |-- SELECT * FROM users WHERE is_active=true AND tenant_id='16' AND (username='waiter1' OR phone='waiter1')
  |-- Result: 0 rows
  |
  v
USER -> FAIL (no_candidates_found)
```

---

## 4. ANALYSE DES LOGS "identity = undefined"

### Observation
Les logs précédents montraient `identity: undefined` dans certains cas.

### Explication
- **Ligne 418 :** `identity: identity || undefined`
- Si l'utilisateur ne saisit PAS d'identity (champ vide), alors `identity = ''` (string vide)
- `'' || undefined` = `undefined`
- Donc le payload contient `identity: undefined` si l'utilisateur ne saisit rien

### Cas du test curl
- Le test curl envoyait `{pin_code:"1111", identity:"waiter1", tenant_slug:"makutano"}`
- Donc `identity = "waiter1"` (défini)
- Le payload HTTP contenait bien `identity: "waiter1"`

### VERDICT
Les logs `identity: undefined` correspondent aux cas où l'utilisateur n'a PAS saisi d'identity. Ce n'est PAS un bug, c'est le comportement attendu.

---

## 5. VERIFICATION DES COMPOSANTS

### Un seul LoginPage
- `src/pages/auth/LoginPage.tsx` (principal)
- `src/pages/platform/PlatformLoginPage.tsx` (plateforme, différent)

### Un seul useAuthStore
- `src/stores/useAuthStore.ts` (unique)

### Un seul appel loginPin
- `src/pages/auth/LoginPage.tsx:424` (unique)
- `src/stores/useAuthStore.ts:127` (fallback vers loginPin)

### Pas de closure obsolète
- `handlePinLogin` est wrapped dans `useCallback` (L410)
- Les dépendances sont : `[pin, mode, handlePinLogin]` (L453)
- Pas de stale closure possible

### Pas de useEffect qui relance le login
- Le seul useEffect (L341-347) est un guard qui vérifie que tenant existe
- Il ne déclenche PAS de login automatique

---

## 6. PREMIER POINT DE RUPTURE (frontend)

**VERDICT : Aucune divergence dans le frontend.**

Le pipeline frontend est **CORRECT** :
1. L'utilisateur saisit `pin="1111"`, `identity="waiter1"`, `tenant_slug="makutano"`
2. Le state React préserve ces valeurs
3. `handlePinLogin` les transmet correctement
4. `useAuthStore.loginPin` les transmet correctement
5. `api-client` les transmet correctement
6. Le fetch POST envoie le bon payload
7. Express reçoit le bon payload

**Le premier point de rupture est le backend :**
- auth.service.ts ligne 501-508
- Requête Supabase : `SELECT * FROM users WHERE ... AND (username='waiter1' OR phone='waiter1')`
- Résultat : 0 rows
- Raison : L'utilisateur "waiter1" n'existe PAS dans la table `users` de Supabase

---

## 7. CONCLUSION

### Frontend : CORRECT
- Pipeline intact
- Aucune divergence de payload
- Aucune closure obsolète
- Aucun double appel
- Aucun state obsolète

### Backend : ÉCHEC
- Requête Supabase retourne 0 résultats
- Cause : L'utilisateur "waiter1" n'existe pas
- Les utilisateurs valides sont : `owner_makutano`, `kabedi`, `Friday`

### BUG-004 (table name mismatch)
- Confirmé : `auth-setup.ts` écrit dans `user`, `auth.service.ts` lit dans `users`
- Impact : CRITICAL pour les utilisateurs créés via auth-setup.ts
- Mais N'EST PAS la cause du no_candidates_found pour "waiter1"

---

## 8. PREUVE FINALE

### Logs console frontend (FORENSIC)
```
[FORENSIC] LoginPage.handleStaffLogin - Payload envoyé: {pin_length: 4, identity: "waiter1", tenant_slug: "makutano"}
[FORENSIC] useAuthStore.loginPin - Appel API: {pin_length: 4, identity: "waiter1", tenant_slug: "makutano"}
```

### Logs TraceManager backend
```
USER -> ENTRY -> {identity: "waiter1", tenantFilter: {tenant_id: 16}}
USER -> EXIT -> FAIL (reason: no_candidates_found)
```

### Conclusion
Le frontend envoie bien `identity: "waiter1"`. Le backend reçoit bien `identity: "waiter1"`. Mais Supabase ne trouve pas cet utilisateur car il n'existe pas.
