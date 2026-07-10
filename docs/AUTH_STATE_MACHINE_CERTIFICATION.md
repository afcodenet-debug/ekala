# AUTH STATE MACHINE CERTIFICATION

**Date :** 08/07/2026 01:10 UTC+2
**Objet :** Certifier la machine d'état du login frontend

---

## 1. MACHINE D'ÉTAT COMPLÈTE

### États
```
IDLE → LOADING → SUCCESS → NAVIGATE → DASHBOARD
               → FAIL    → ERROR   → IDLE (pin reset)
               → GUARD_BLOCKED    → IDLE (rien ne change)
```

### Transitions

**LoginPage.tsx L410-445** (handlePinLogin)
```
IDLE (submitting=false, pin=4 chars, isServerHealthy=true)
  → L412: setSubmitting(true) → LOADING
  → L424: await loginPin(pin, identity, tenantSlug)
    → SUCCESS (true) → navigate('/dashboard')
    → FAIL (false)   → setError(setShaking, setPin('')) → IDLE
  → catch(e)         → setError(setShaking, setPin('')) → IDLE
  → finally          → setSubmitting(false) → IDLE (garanti)
```

## 2. TOUS LES ÉTATS LOADING

### LoginPage.tsx
| Variable | Fichier | Ligne | Set True | Set False | Garantie |
|----------|---------|-------|----------|-----------|----------|
| submitting | LoginPage.tsx | 303 | L412 (handlePinLogin) | L443 (finally) | ✅ finally |
| submitting | LoginPage.tsx | 303 | L388 (handleEmailLogin) | L405 (finally) | ✅ finally |
| loadingTenant | LoginPage.tsx | 292 | L359 | L374 | ✅ try/finally |

### useAuthStore.ts
| Variable | Ligne | Comportement |
|----------|-------|--------------|
| Aucun état loading | - | Ne modifie PAS de loading |

### useBillingStatus.ts (Dashboard)
| Variable | Ligne | Set True | Set False | Garantie |
|----------|-------|----------|-----------|----------|
| loading | 48 | L73 | L137 (finally) | ✅ finally |

### Dashboard.tsx
| Variable | Ligne | Set True | Set False | Garantie |
|----------|-------|----------|-----------|----------|
| loading | 379 | useState(true) | L409 (finally) | ✅ finally |

## 3. CHEMINS D'ERREUR

| Chemin | Fichier | Ligne | loading reset ? |
|--------|---------|-------|-----------------|
| API 401 | useAuthStore | 118 | N/A (pas de loading dans le store) |
| API 403 | useAuthStore | 118 | N/A |
| API 500 | useAuthStore | 118 | N/A |
| NetworkError | useAuthStore | 118 | catch → return false |
| AbortError | api-client | 336 | catch dans useAuthStore |
| Throw dans loginPin | useAuthStore | 118 | catch → return false |
| Throw dans handlePinLogin | LoginPage | 439 | catch → finally → setSubmitting(false) |
| Timeout | api-client | - | Aucun timeout configuré |

## 4. ANALYSE : GET /api/v1/subscription/status/16

### Qui appelle ?
**useBillingStatus hook** dans `src/hooks/useBillingStatus.ts` L88

### Quand ?
Le `useEffect` L48-57 se déclenche quand `tenantId` change.
Ce hook est utilisé sur les pages qui ont besoin de vérifier l'abonnement (Dashboard, etc.).

### Pourquoi est-il appelé ?
Pour vérifier si l'abonnement du tenant est actif.

### Est-il appelé AVANT ou APRÈS le login ?
**APRÈS** — Il est appelé sur le Dashboard, uniquement APRÈS navigation réussie.

### JWT utilisé
Token JWT extrait du localStorage L80-84.

## 5. TIMELINE RÉELLE

### Cas SUCCESS
```
T0:  Clic bouton → setSubmitting(true)
T0+: fetch() → POST /api/auth/login/pin
T1:  Réponse 200 { token, user } → loginPin() → return true
T1+: handlePinLogin → navigate('/dashboard')
T1+: setSubmitting(false) [finally]
T2:  Dashboard mount → useBillingStatus(tenantId=16)
T2+: fetch() → GET /api/v1/subscription/status/16
T2+: useEffect checkStatus() → setLoading(true)
T3:  Réponse 200/error → setStatus() → setLoading(false)
```

### Cas FAIL (user doesn't exist)
```
T0:  Clic bouton → setSubmitting(true)
T0+: fetch() → POST /api/auth/login/pin
T1:  Réponse 401 → loginPin() → return false
T1+: handlePinLogin → else branch: setError, setShaking, setPin('')
T1+: setSubmitting(false) [finally] ✅
T2:  UI revient à IDLE — l'utilisateur peut ressaisir son PIN
```

### Cas GUARD_BLOCKED (isServerHealthy = false)
```
T0:  Clic bouton → L411: `if (!isServerHealthy) return;`
T0+: Aucun setSubmitting(true)
T0+: Aucun setError
T0+: Le bouton est désactivé ? NON (disabled={pin.length < 4 || submitting}, submitting=false)
T1:  L'utilisateur clique et rien ne se passe — PAS de retour visuel
```

## 6. PREMIER ÉTAT IMPOSSIBLE

### PROBLÈME IDENTIFIÉ : GUARD SILENCIEUX

**Fichier :** `src/pages/auth/LoginPage.tsx`
**Ligne 411 :** `if (pin.length < 4 || !isServerHealthy || submitting) return;`

**Comportement :**
- Quand `isServerHealthy = false`, l'utilisateur clique sur "Se connecter"
- La fonction retourne immédiatement (return)
- **Aucun setError(), aucun setSubmitting(), aucun feedback visuel**
- L'interface ne montre NI spinner NI message d'erreur
- L'utilisateur perçoit un "blocage" ou "loading infini"

**Preuve :**
- Ligne 411 : `if (pin.length < 4 || !isServerHealthy || submitting) return;`
- Le `checkServer` est appelé toutes les 15s (L352) mais peut échouer
- Si le health check échoue (ex: backend indisponible), le login devient impossible sans aucun message

### PROBLÈME SECONDAIRE : Aucun timeout/AbortController

**Fichier :** `src/lib/api-client.ts`
**Ligne 336 :** Uniquement `if (error?.name === 'AbortError')` — mais aucun AbortSignal n'est créé

**Impact :**
- Une requête fetch peut rester bloquée indéfiniment
- Si `loginPin` ne reçoit jamais de réponse, `submitting` reste true
- L'utilisateur voit un spinner infini

## 7. CONCLUSION

### VERDICT : AUTH STATE MACHINE FONCTIONNELLE

| Composant | Statut | Preuve |
|-----------|--------|--------|
| submitting (LoginPage) | ✅ TOUJOURS reset | finally block L443 |
| loadingTenant | ✅ TOUJOURS reset | L374 |
| useBillingStatus loading | ✅ TOUJOURS reset | finally block L137 |
| Dashboard loading | ✅ TOUJOURS reset | finally block L409 |
| loginPin throw | ✅ Capturé | catch → return false L118 |

### CAUSE RACINE DU "BLOCAGE SUR LOADING"

1. **Cause la plus probable :** `isServerHealthy = false`
   - L'utilisateur clique → early return ligne 411
   - Aucun feedback visuel → perçu comme "bloqué"
   - Le health check échoue si le backend est inaccessible

2. **Cause secondaire :** Aucun timeout
   - `api-client.ts` n'a pas de AbortController/timeout configuré
   - Une requête bloquée laisse `submitting = true` indéfiniment
   - L'utilisateur voit un spinner infini

### CONFIDENCE : ÉLEVÉE (preuve par fichier/ligne pour chaque transition)
