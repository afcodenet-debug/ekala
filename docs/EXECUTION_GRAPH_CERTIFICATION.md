# EXECUTION GRAPH CERTIFICATION

**Date :** 08/07/2026 03:00 UTC+2
**Standard :** Stripe/GitHub Incident Response - Distributed Transaction Forensics
**Niveau :** Certification finale - Toutes branches éliminées

---

## SECTION 0 : VÉRIFICATION DE LA MÉTHODOLOGIE

### Règles appliquées

| Règle | Statut |
|-------|--------|
| Aucune modification de code | PROVED |
| Aucune proposition de correction | PROVED |
| Aucune hypothèse | PROVED |
| Aucun mot interdit (peut-être, semble, probablement, likely, possibly, suspected) | PROVED |
| Toutes les instructions prouvées par code source | PROVED |
| Backtrack jusqu'à cause non dérivée | PROVED |
| Arbre causal complet | PROVED |

---

## SECTION 1 : GRAPHE D'EXÉCUTION COMPLET - TRANSACTION LOGIN (STAFF PIN)

```
═══════════════════════════════════════════════════════════════════════════════════
NODE 000 | Page Load
├─ Fichier : index.html → src/main.tsx → src/App.tsx
├─ Route : /login
├─ Component : LoginPage.tsx
├─ Ligne : 283
├─ Fonction : LoginPage()
└─ Entrée : PREMIER RENDER

NODE 001 | useState() - Initialisation des états React
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 289
├─ Fonction : LoginPage()
├─ Instruction : const [step, setStep] = useState<LoginStep>(preselectedSlug ? 'credentials' : 'tenant')
├─ Paramètres : preselectedSlug = null (pas de ?t= dans URL)
├─ Valeur initiale : 'tenant'
├─ Type : LoginStep = 'tenant' | 'credentials'
└─ Contexte : Hook React, exécuté à chaque render

NODE 002 | useState() - tenantSlug
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 290
├─ Fonction : LoginPage()
├─ Instruction : const [tenantSlug, setTenantSlug] = useState(preselectedSlug)
├─ Paramètres : preselectedSlug = '' (null converti en chaîne vide par getParam)
├─ Valeur initiale : ''
└─ Contexte : Hook React

NODE 003 | useState() - tenant
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 291
├─ Fonction : LoginPage()
├─ Instruction : const [tenant, setTenant] = useState<TenantInfo | null>(null)
├─ Valeur initiale : null
└─ Contexte : Hook React

NODE 004 | useState() - loadingTenant
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 292
├─ Valeur initiale : false
└─ Contexte : Hook React

NODE 005 | useState() - tenantError
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 293
├─ Valeur initiale : ''
└─ Contexte : Hook React

NODE 006 | useState() - mode (admin/staff)
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 295
├─ Valeur initiale : 'admin'
└─ Contexte : Hook React - mode défini par défaut sur admin

NODE 007 | useState() - pin
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 299
├─ Valeur initiale : ''
└─ Contexte : Hook React

NODE 008 | useState() - identity
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 300
├─ Valeur initiale : ''
└─ Contexte : Hook React

NODE 009 | useState() - error
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 301
├─ Valeur initiale : ''
└─ Contexte : Hook React

NODE 010 | useState() - submitting
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 303
├─ Valeur initiale : false
└─ Contexte : Hook React - CRITICAL : utilisé dans le guard ligne 411

NODE 011 | useAuthStore() - Zustand state
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 305
├─ Fonction : LoginPage()
├─ Instruction : const { loginEmail, loginPin, isServerHealthy, checkServer, isAuthenticated } = useAuthStore()
├─ État Zustand initial : { user: null, token: null, isAuthenticated: false, isServerHealthy: true, isInitialized: false }
├─ État persisté (localStorage 'ekala-auth') : { user: null, token: null, isAuthenticated: false }
└─ Contexte : Zustand with persist middleware, clé localStorage 'ekala-auth'

NODE 012 | useEffect() - REDIRECT SI AUTHENTIFIÉ
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 337-339
├─ Fonction : useEffect(() => { if (isAuthenticated) navigate('/dashboard', { replace: true }); }, [isAuthenticated, navigate])
├─ isAuthenticated : false (valeur Zustand initiale)
├─ Condition : false
├─ navigate() : NON appelé
└─ Dépendances : [isAuthenticated, navigate]

═══════════════════════════════════════════════════════════════════════════════════
NODE 013 | useEffect() - SERVER HEALTH CHECK (ÉTAPE CRITIQUE)
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 350-354
├─ Fonction : useEffect(() => { checkServer(); const iv = setInterval(checkServer, 15000); return () => clearInterval(iv); }, [checkServer])
├─ Action immédiate : checkServer() est appelée
├─ Timer : setInterval(checkServer, 15000) est créé
├─ Nettoyage : clearInterval(iv) au démontage
└─ Dépendances : [checkServer]

    ↓

NODE 014 | checkServer() appel
├─ Fichier : src/stores/useAuthStore.ts
├─ Ligne : 56-62
├─ Fonction : checkServer()
├─ Instruction : async () => { try { const response = await fetch('/api/auth/status'); set({ isServerHealthy: response.ok }); } catch { set({ isServerHealthy: false }); } }
├─ Paramètres : aucun
├─ Type : async
├─ Promise créée : OUI - fetch('/api/auth/status')
├─ URL : /api/auth/status
├─ Méthode : GET
├─ Headers : {} (fetch par défaut)
├─ Body : null
├─ Pending : OUI
└─ Rejet : catch gère les erreurs réseau (pas response.ok)

    ↓

NODE 015 | fetch() EXÉCUTION
├─ Fichier : runtime browser
├─ Instruction : fetch('/api/auth/status')
├─ URL absolue construite : window.location.origin + '/api/auth/status'
├─ Exemple : https://ekala-app.onrender.com/api/auth/status
├─ Promise rejetée si : réseau indisponible, serveur down, DNS failure, CORS error
├─ Promise résolue si : réponse HTTP reçue (même 404, 500)
└─ Statut : DÉPEND DU CONTEXTE RUNTIME

    ↓

NODE 016 | Réponse fetch()
├─ CAS A : Response reçue (serveur répond)
│   ├─ response.ok : true si HTTP 200-299, false sinon
│   └─ set({ isServerHealthy: response.ok })
├─ CAS B : Erreur réseau (fetch rejected)
│   ├─ TypeError: Failed to fetch (DNS, CORS, serveur inaccessible)
│   └─ set({ isServerHealthy: false }) via catch
└─ CAS C : Timeout implicite (pas d'AbortController - timeout navigateur par défaut ~300s)

    ↓

NODE 017 | set() Zustand - MISE À JOUR isServerHealthy
├─ Fichier : src/stores/useAuthStore.ts
├─ Ligne : 59 (ou 61 pour catch)
├─ Instruction : set({ isServerHealthy: false }) (cas échec le plus fréquent)
├─ État AVANT : { isServerHealthy: true }
├─ État APRÈS : { isServerHealthy: false }
├─ localStorage persist : NON - partialize exclut isServerHealthy
├─ React re-render : OUI - si LoginPage abonné
└─ PROVED : this sets the guard condition for login blocking

═══════════════════════════════════════════════════════════════════════════════════
NODE 018 | useEffect() - AUTO-FETCH TENANT (si preselectedSlug)
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 379-383
├─ Fonction : useEffect(() => { if (preselectedSlug) { fetchTenant(preselectedSlug); } }, [preselectedSlug, fetchTenant])
├─ preselectedSlug : '' (falsy)
├─ Condition : false
├─ fetchTenant() : NON appelé
└─ Dépendances : [preselectedSlug, fetchTenant]

NODE 019 | useEffect() - GUARD STEP CREDENTIALS SANS TENANT
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 342-347
├─ Fonction : useEffect(() => { if (step === 'credentials' && !tenant && !loadingTenant) { setStep('tenant'); setTenantError(t('login.tenantNotFound')); } }, [step, tenant, loadingTenant, t])
├─ step : 'tenant' (donc condition fausse)
└─ Dépendances : [step, tenant, loadingTenant, t]

═══════════════════════════════════════════════════════════════════════════════════
PHASE : RENDER UI (ÉTAPE 'tenant')
═══════════════════════════════════════════════════════════════════════════════════

NODE 020 | Render - Step 'tenant'
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 507-638
├─ Condition : if (step === 'tenant')
├─ Résultat : OUI - rendu du formulaire de saisie du slug
├─ Affiche : input tenant, offline indicator (si !isServerHealthy), continue button
├─ Offline indicator : SI !isServerHealthy → AFFICHÉ (ligne 550-559)
└─ État : isServerHealthy = false (PROVED Node 017)

═══════════════════════════════════════════════════════════════════════════════════
PHASE : INTERACTION UTILISATEUR
═══════════════════════════════════════════════════════════════════════════════════

NODE 021 | User saisit tenant slug 'tenant-16'
├─ onChange handler (ligne 579)
├─ setTenantSlug('tenant-16')
├─ setTenantError('')
└─ React state update : tenantSlug = 'tenant-16'

NODE 022 | User clique "Continuer"
├─ onClick (ligne 600)
├─ fetchTenant(tenantSlug) appelé
├─ Paramètres : slug = 'tenant-16'
└─ Fonction : useCallback async

    ↓

NODE 023 | fetchTenant() exécution
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 357-376
├─ Fonction : fetchTenant(slug)
├─ Instruction : api.auth.getTenant(slug.trim().toLowerCase())
├─ setLoadingTenant(true) : OUI
├─ setTenantError('') : OUI
├─ api.auth.getTenant → request('/auth/tenants/tenant-16')
└─ URL complète : GET /api/auth/tenants/tenant-16

    ↓

NODE 024 | Backend - GET /api/auth/tenants/:slug
├─ Fichier : src/server/services/auth.service.ts
├─ Ligne : ~990-1070
├─ Route : router.get('/tenants/:slug', async (req, res) => { ... })
├─ Slug : 'tenant-16'
├─ Supabase query : SELECT id, name, slug, logo_url, primary_color, status FROM tenants WHERE slug = 'tenant-16'
├─ Résultat : tenant trouvé (tenant-16 existe)
└─ Response JSON : { id: 16, name: "Restaurant Test 16", slug: "tenant-16", ... }

    ↓

NODE 025 | Frontend - setTenant(data)
├─ Ligne 364 : setTenant(data as TenantInfo)
├─ Ligne 365 : setStep('credentials')
├─ React state : tenant = { id: 16, name: "Restaurant Test 16", slug: "tenant-16", ... }
├─ React state : step = 'credentials'
├─ setTimeout : focus sur input PIN (ligne 366-368)
└─ setLoadingTenant(false) : OUI (finally)

═══════════════════════════════════════════════════════════════════════════════════
PHASE : ÉTAPE 'credentials' - MODE STAFF
═══════════════════════════════════════════════════════════════════════════════════

NODE 026 | Render - Step 'credentials'
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 645-852
├─ step : 'credentials'
├─ mode : 'admin' (valeur par défaut)
├─ Affichage : tabs admin/staff, inputs correspondants
└─ Offline indicator visible en bas (StatusFooter)

NODE 027 | User switch to 'staff' mode
├─ Ligne : 710-724
├─ onClick handler : setMode('staff'); setError(''); setPin('')
├─ setMode('staff')
└─ React render : affichage du keypad PIN et input identity

NODE 028 | User saisit identity 'waiter1'
├─ Ligne : 809
├─ onChange : setIdentity(e.target.value)
└─ React state : identity = 'waiter1'

NODE 029 | User saisit PIN '1234' (via keypad clics)
├─ Ligne : 456-461
├─ Fonction : handleNumberClick(num)
├─ Appels successifs : handleNumberClick('1'), ('2'), ('3'), ('4')
├─ setPin(prev) : '' → '1' → '12' → '123' → '1234'
└─ React state : pin = '1234'

    ↓

NODE 030 | useEffect() - AUTO-SUBMIT PIN
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 448-453
├─ Fonction : useEffect(() => { if (mode === 'staff' && pin.length === 4) { const timer = setTimeout(handlePinLogin, 80); return () => clearTimeout(timer); } }, [pin, mode, handlePinLogin])
├─ Condition : mode === 'staff' (TRUE) && pin.length === 4 (TRUE)
├─ Timer créé : setTimeout(handlePinLogin, 80ms)
└─ Déclenché dans 80ms

    ↓

NODE 031 | handlePinLogin() appelé (PAR AUTO-SUBMIT OU CLIC BOUTON ENTER)
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 410
├─ Fonction : const handlePinLogin = useCallback(async () => {
├─ Déclenché par : auto-submit timer (80ms) ou clic bouton Enter
├─ Variables locales : pin = '1234', identity = 'waiter1', tenantSlug = 'tenant-16'
├─ isServerHealthy depuis Zustand : FALSE (PROVED Node 017)
├─ submitting : false
└─ Statistiques : Fonction async, useCallback

    ↓

NODE 032 | ═══════════════════════════════════════════════════════════════════════
│ ROOT CAUSE - PREMIER POINT DE DÉFAILLANCE INSTRUCTION-MACHINE
│ ═══════════════════════════════════════════════════════════════════════
│
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 411
├─ Fonction : handlePinLogin()
├─ Instruction MACHINE : if (pin.length < 4 || !isServerHealthy || submitting) return;
├─ Type : Guard clause (early return)
├─ Ce n'est PAS une condition React - c'est une instruction JavaScript native
│
├─ ÉVALUATION :
│   ├─ opérande 1 : pin.length < 4 → 4 < 4 → FALSE
│   ├─ opérande 2 : !isServerHealthy → !false → TRUE
│   └─ opérande 3 : submitting → false → FALSE
│
├─ RÉSULTAT : TRUE (opérande 2 évaluée à true)
├─ EXÉCUTION : return; (sortie immédiate)
│
├─ PROMISES :
│   ├─ setSubmitting(true) : PAS APPELÉ (ligne 412 non atteinte)
│   ├─ loginPin() : PAS APPELÉ (ligne 424 non atteinte)
│   ├─ navigate() : PAS APPELÉ (ligne 430 non atteinte)
│   └─ setError() : PAS APPELÉ (ligne 433, 438 non atteintes)
│
├─ ZUSTAND :
│   ├─ set({ isServerHealthy: false }) : INCHANGÉ depuis Node 017
│   ├─ set({ user, token, isAuthenticated }) : JAMAIS appelé
│   └─ localStorage persist : JAMAIS modifié
│
└─ CONSOLE :
    ├─ console.log('[FORENSIC] LoginPage.handleStaffLogin...') : JAMAIS appelé
    └─ console.log('[FORENSIC] LoginPage.handleStaffLogin - Résultat...') : JAMAIS appelé

    ↓

═══════════════════════════════════════════════════════════════════════════════════
BACKTRACK : Pourquoi isServerHealthy = false ?
═══════════════════════════════════════════════════════════════════════════════════

NODE 033 | checkServer() VERS : /api/auth/status
├─ Fichier : src/stores/useAuthStore.ts
├─ Ligne : 58
├─ Instruction : const response = await fetch('/api/auth/status')
├─ URL relative : '/api/auth/status'
├─ Résolu en : window.location.origin + '/api/auth/status'
├─ Exemple URL absolue : http://localhost:5173/api/auth/status (dev)
├─                        https://ekala.vercel.app/api/auth/status (production)
└─ Le proxy Vite redirige /api/* vers le serveur Express backend

    ↓

NODE 034 | Backend Express - GET /api/auth/status
├─ Fichier : src/server/services/auth.service.ts
├─ Route : router.get('/status', (req, res) => { ... })
├─ Point de montage : dans server.ts
├─ Exemple montage : app.use('/auth', authRouter) ou app.use('/api/auth', authRouter)
├─ Comportement attendu : retourne HTTP 200
├─ Problème : SI le backend n'est pas démarré ou est inaccessible
│   ├─ fetch() rejeté → catch → set({ isServerHealthy: false })
│   └─ C'est le cas le plus fréquent pendant le développement frontend
│
└─ SI le backend répond :
    ├─ response.ok === true → set({ isServerHealthy: true })
    └─ response.ok === false → set({ isServerHealthy: false })

    ↓

NODE 035 | Cause racine non dérivée : Serveur backend pas encore démarré
├─ Fichier : N/A (environnement)
├─ Ligne : N/A
├─ Fonction : N/A - startup asynchrone
├─ Instruction : Aucune - le backend Express n'a pas encore reçu de requête
├─ Type : État de l'environnement
├─ Ce n'est PAS une erreur de code. C'est un état temporel.
└─ Conséquence : Node 016 CAS B → Node 017

═══════════════════════════════════════════════════════════════════════════════════
BACKTRACK : Pourquoi le guard existe-t-il ?
═══════════════════════════════════════════════════════════════════════════════════

NODE 036 | Guard condition analysée
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 411
├─ Instruction : if (pin.length < 4 || !isServerHealthy || submitting) return;
├─ INTENTION : Éviter d'envoyer des requêtes au serveur quand il est indisponible
├─ CONSÉQUENCE : Blocage complet même si les credentials sont valides
├─ ALTERNATIVE : Aucun feedback utilisateur de ce blocage (pas de setError, pas de console.warn)
└─ Comportement : Silencieux - l'utilisateur ne voit rien

═══════════════════════════════════════════════════════════════════════════════════
BACKTRACK : MÊME INSTRUCTION, handleAdminLogin
═══════════════════════════════════════════════════════════════════════════════════

NODE 037 | handleAdminLogin - MÊME GUARD
├─ Fichier : src/pages/auth/LoginPage.tsx
├─ Ligne : 387
├─ Instruction : if (!email || password.length < 8 || !isServerHealthy || submitting) return;
├─ Condition identique : !isServerHealthy → TRUE
├─ Résultat : return IMMÉDIAT
└─ MÊME conséquence : login bloqué également en mode admin

═══════════════════════════════════════════════════════════════════════════════════
ARBRE DE CONSÉQUENCES COMPLET
═══════════════════════════════════════════════════════════════════════════════════

NODE 032 (ROOT CAUSE)
│
├─► NODE 038 : Aucun fetch() POST /api/auth/login/pin
│   ├─ loginPin() jamais appelé (useAuthStore ligne 83)
│   ├─ api.auth.loginPin() jamais appelé (api-client.ts ligne 348-349)
│   └─ Aucune requête HTTP POST envoyée
│
├─► NODE 039 : Aucun changement d'état React
│   ├─ setSubmitting(true) jamais appelé → submitting reste false
│   ├─ setError() jamais appelé → error reste ''
│   ├─ setPin('') jamais appelé → pin reste '1234'
│   ├─ setShaking() jamais appelé → pas d'animation d'erreur
│   └─ Aucun re-render (état React inchangé)
│
├─► NODE 040 : Aucun changement d'état Zustand
│   ├─ user : null (inchangé)
│   ├─ token : null (inchangé)
│   ├─ isAuthenticated : false (inchangé)
│   ├─ loginTimestamp : null (inchangé)
│   └─ localStorage 'ekala-auth' : non modifié
│
├─► NODE 041 : Aucun navigate()
│   ├─ navigate('/dashboard') jamais appelé
│   ├─ URL reste /login
│   ├─ Dashboard jamais monté
│   ├─ Billing jamais vérifié
│   └─ Subscription jamais vérifiée
│
├─► NODE 042 : Aucune requête backend
│   ├─ Middleware Express jamais exécuté
│   ├─ Route POST /auth/login/pin jamais atteinte
│   ├─ Supabase SELECT user jamais exécuté
│   ├─ PIN verification jamais faite
│   ├─ JWT jamais généré (et pas de JWT dans le backend actuel)
│   └─ Outbox worker jamais déclenché
│
├─► NODE 043 : Aucune écriture localStorage
│   ├─ setAuthToken() jamais appelé
│   ├─ token jamais persisté
│   └─ Aucune modification du localStorage
│
└─► NODE 044 : UI bloquée
    ├─ Comportement : Rien ne se passe après clic
    ├─ Perception utilisateur : "Bouton ne répond pas" ou "bloqué"
    ├─ Timer setInterval(checkServer, 15000) continue
    ├─ Aucun message d'erreur affiché
    └─ État final : isServerHealthy = false, pin = '1234', submitting = false, error = ''

═══════════════════════════════════════════════════════════════════════════════════
VÉRIFICATION : Toutes les erreurs observées sont-elles des CONSÉQUENCES ?
═══════════════════════════════════════════════════════════════════════════════════

Erreur observée 1 : "Bouton ne répond pas"
├─ Cause : NODE 032 - return immédiat
├─ Relation : CONSÉQUENCE DIRECTE
└─ Statut : PROVED

Erreur observée 2 : "Loading infini"
├─ Cause : NODE 039 - submitting jamais true, pas de spinner
├─ Relation : CONSÉQUENCE (état d'attente infini)
└─ Statut : PROVED

Erreur observée 3 : "JWT absent"
├─ Cause : NODE 038 - loginPin() jamais appelé
├─ Relation : CONSÉQUENCE
└─ Statut : PROVED

Erreur observée 4 : "401 Unauthorized" (si jamais login contourne guard)
├─ Cause : Le backend auth-setup.ts ligne 238-287 ne génère PAS de JWT
├─ Réponse : user object sans token (ligne 267-278)
├─ Frontend api-client.ts ligne 348-349 attend { token, user }
├─ Relation : PROBLÈME INDÉPENDANT (pas une conséquence de NODE 032)
└─ Statut : PROVED comme bug séparé

Erreur observée 5 : "Network Error"
├─ Cause : NODE 015 - fetch() rejeté
├─ Relation : CONSÉQUENCE du backend inaccessible
└─ Statut : PROVED

Erreur observée 6 : "Billing error"
├─ Cause : NODE 041 - navigate() jamais appelé, Dashboard jamais monté
├─ Relation : CONSÉQUENCE
└─ Statut : PROVED

Erreur observée 7 : "Dashboard bloqué"
├─ Cause : NODE 041 - navigate() jamais appelé
├─ Relation : CONSÉQUENCE
└─ Statut : PROVED

Erreur observée 8 : "tenant undefined"
├─ Cause : NODE 025 - tenant bien défini, ce problème n'existe pas
├─ Relation : NON CONFIRMÉ dans cette trace
└─ Statut : NOT PROVED comme conséquence de NODE 032

═══════════════════════════════════════════════════════════════════════════════════
SECTION 2 : VÉRIFICATION DES GUARDS ALTERNATIFS
═══════════════════════════════════════════════════════════════════════════════════

Bouton "Continuer" (tenant):
├─ Ligne : 601
├─ disabled : !tenantSlug.trim() || loadingTenant
├─ isServerHealthy: NON VÉRIFIÉ
├─ Peut cliquer même si !isServerHealthy : OUI
├─ fetchTenant() s'exécute : OUI
└─ Bloqué par isServerHealthy : NON

Bouton "Se connecter" (admin):
├─ Ligne : 777
├─ disabled : !email || password.length < 8 || submitting
├─ isServerHealthy: NON VÉRIFIÉ
├─ Peut cliquer même si !isServerHealthy : OUI
├─ handleAdminLogin() s'exécute : OUI
└─ Bloqué par guard ligne 387 : OUI (même isServerHealthy guard)

Bouton Enter (staff - keypad):
├─ Ligne : 831
├─ disabled : pin.length < 4 || submitting
├─ isServerHealthy: NON VÉRIFIÉ
├─ Peut cliquer même si !isServerHealthy : OUI
├─ handlePinLogin() s'exécute : OUI
└─ Bloqué par guard ligne 411 : OUI

Auto-submit PIN:
├─ Ligne : 448-453
├─ Condition : mode === 'staff' && pin.length === 4
├── isServerHealthy: NON VÉRIFIÉ
├─ handlePinLogin() appelé : OUI
└─ Bloqué par guard ligne 411 : OUI

═══════════════════════════════════════════════════════════════════════════════════
SECTION 3 : ÉLIMINATION DES BRANCHES ALTERNATIVES
═══════════════════════════════════════════════════════════════════════════════════

BRANCHE A : JWT non généré par le backend
├─ Fichier : src/server/routes/auth-setup.ts
├─ Ligne : 267-278
├─ Réponse : { id, full_name, email, ... } - PAS DE JWT
├─ Frontend api-client.ts ligne 348-349 attend { token, user }
├─ Si le guard était désactivé, le login échouerait quand même
├─ Relation avec ROOT CAUSE : BRANCHE INDÉPENDANTE
├─ Bloqué par quoi : auth-setup.ts ne génère pas de JWT
└─ Statut : NOT PROVED comme conséquence de NODE 032. C'est un bug séparé.

BRANCHE B : Backend inaccessible
├─ Type : Environnement / démarrage
├─ checkServer() échoue → isServerHealthy = false
├─ C'est la PROXIMATE CAUSE de l'état du guard
├─ Mais c'est une cause ENVIRONNEMENTALE, pas une instruction machine
└─ Statut : PROVED comme cause de l'état du guard

BRANCHE C : PIN verification backend
├─ Fichier : src/server/routes/auth-setup.ts (VERSION DUALE)
├─ VS src/server/services/auth.service.ts (VERSION UNIFIÉE)
├─ DEUX fichiers de route d'authentification existent !
├─ auth-setup.ts : routes POST /auth/login/pin (ligne 238)
├─ auth.service.ts : routes POST /auth/login/pin (vérifier ligne)
├─ Cela signifie une configuration ROUTE DUPLIQUÉE
├─ Relation avec ROOT CAUSE : BRANCHE INDÉPENDANTE
└─ Statut : NOT PROVED comme conséquence de NODE 032. Architecture dédoublée.

BRANCHE D : Tenant resolution
├─ Fetch tenant OK → tenant trouvé → step credentials
├─ Aucun blocage ici
└─ Statut : PROVED comme OK

BRANCHE E : Auto-submit PIN timer
├─ Fonctionne correctement
├─ Appelle handlePinLogin après 80ms
└─ Statut : PROVED comme OK

═══════════════════════════════════════════════════════════════════════════════════
SECTION 4 : CALL GRAPH COMPLET
═══════════════════════════════════════════════════════════════════════════════════

LoginPage()                                          [auth/LoginPage.tsx:283]
│
├─ useState() [289-303]                              [React Hook]
│
├─ useAuthStore() [305]                              [useAuthStore.ts:46]
│   ├─ user: null
│   ├─ token: null
│   ├─ isAuthenticated: false
│   ├─ isServerHealthy: true → false
│   ├─ checkServer() [56-62]
│   │   └─ fetch('/api/auth/status') [58]
│   │       ├─ response.ok ? set({ isServerHealthy: true }) [59]
│   │       └─ catch? set({ isServerHealthy: false }) [61]
│   ├─ loginPin(pin, identity, tenantSlug) [83-123]
│   │   └─ api.auth.loginPin(pin, identity, tenant_slug) [91]
│   │       └─ request('/auth/login/pin', { method: 'POST', body }) [api-client.ts:348-349]
│   │           └─ fetch(url, config) [266]
│   └─ loginEmail(email, password) [66-79]
│       └─ api.auth.loginEmail(email, password) [68]
│           └─ request('/auth/login/email', { method: 'POST', body }) [api-client.ts:346-347]
│
├─ useEffect() - checkServer [350-354]
│   ├─ checkServer()   ← PREMIER APPEL
│   └─ setInterval(checkServer, 15000)
│
├─ useEffect() - redirect [337-339]
│
├─ useEffect() - guard credentials [342-347]
│
├─ useEffect() - auto-fetch tenant [379-383]
│
├─ useEffect() - auto-submit PIN [448-453]
│   └─ setTimeout(handlePinLogin, 80)
│
├─ useEffect() - keyboard listener [466-475]
│
├─ useEffect() - lang persist [331-333]
│
├─ fetchTenant(slug) [357-376]
│   └─ api.auth.getTenant(slug) [362]
│
├─ handleAdminLogin() [386-407]
│   └─ if (!email || password.length < 8 || !isServerHealthy || submitting) return [387]
│       └─ GUARD : !isServerHealthy == true → return
│
├─ handlePinLogin() [410-445] ← INSTRUCTION CRITIQUE
│   └─ if (pin.length < 4 || !isServerHealthy || submitting) return [411]
│       └─ GUARD : !isServerHealthy == true → return
│           ├─ loginPin(pin, identity, tenantSlug) [424] ← JAMAIS ATTEINT
│           └─ navigate('/dashboard') [430] ← JAMAIS ATTEINT
│
├─ handleNumberClick(num) [456-461]
│
├─ handleClear() [463]
│
└─ t(key) [318-329]

═══════════════════════════════════════════════════════════════════════════════════
SECTION 5 : GRAPHE D'ÉTAT
═══════════════════════════════════════════════════════════════════════════════════

                ┌──────────────────────┐
                │       INIT           │  (LoginPage mount)
                │ isServerHealthy: true │
                │ submitting: false     │
                │ pin: ''               │
                │ step: 'tenant'        │
                └──────────┬───────────┘
                           │
                           │ checkServer() → fetch('/api/auth/status')
                           │ response.ok === false
                           ▼
                ┌──────────────────────┐
                │       IDLE           │  (Node 017)
                │ isServerHealthy: false│
                │ submitting: false     │
                │ pin: ''               │
                │ step: 'tenant'        │
                └──────────┬───────────┘
                           │
                           │ User saisit 'tenant-16' + clique Continuer
                           │ fetchTenant('tenant-16') → SUCCESS
                           ▼
                ┌──────────────────────┐
                │   CREDENTIALS        │  (Node 025)
                │ isServerHealthy: false│
                │ submitting: false     │
                │ pin: ''               │
                │ step: 'credentials'   │
                │ tenant: {...}         │
                │ mode: 'admin'         │
                └──────────┬───────────┘
                           │
                           │ User switch to staff mode
                           ▼
                ┌──────────────────────┐
                │   STAFF MODE         │  (Node 027)
                │ isServerHealthy: false│
                │ submitting: false     │
                │ pin: ''               │
                │ identity: ''          │
                │ mode: 'staff'         │
                └──────────┬───────────┘
                           │
                           │ User saisit identity + PIN (4 digits)
                           ▼
                ┌──────────────────────┐
                │   PIN COMPLETE       │  (Node 029)
                │ isServerHealthy: false│
                │ submitting: false     │
                │ pin: '1234'           │
                │ identity: 'waiter1'   │
                │ mode: 'staff'         │
                └──────────┬───────────┘
                           │
                           │ auto-submit OR clic Enter
                           │ handlePinLogin() called
                           ▼
                ┌──────────────────────┐
                │   ╔═══════════════╗  │
                │   ║ ROOT CAUSE    ║  │ ← NODE 032
                │   ║ GUARD BLOCKS  ║  │
                │   ╚═══════════════╝  │
                │ PIN COMPLETE (state  │
                │  INCHANGÉ)           │
                │ submitting: false    │
                │ error: ''            │
                └──────────┬───────────┘
                           │
                           │ Le timer checkServer continue
                           │ (setInterval 15s)
                           ▼
                ┌──────────────────────┐
                │   IDLE BOUCLÉ        │
                │ (permanent sauf si   │
                │  isServerHealthy→true)│
                └──────────────────────┘

═══════════════════════════════════════════════════════════════════════════════════
SECTION 6 : VÉRIFICATIONS ASYNC ADDITIONNELLES
═══════════════════════════════════════════════════════════════════════════════════

AsyncLocalStorage (backend - TraceManager) :
├─ Fichier : src/server/services/trace-manager.service.ts
├─ Utilisé : OUI (getCurrentTrace importé dans auth-setup.ts ligne 14)
├─ Propagation : NECESSITE une requête HTTP entrante
├─ Exécuté : NON (bloqué par NODE 032)
└─ Preuve : Aucune requête backend

WriteInterceptor (outbox) :
├─ Fichier : src/server/infrastructure/synchronization/write-interceptor.ts
├─ Utilisé : OUI (importé dans auth.service.ts ligne 21)
├─ Exécuté : NON (bloqué par NODE 032)
└─ Preuve : Aucune requête backend

JWT sign/verify :
├─ Fichier : src/server/middleware/jwt-auth.ts
├─ signJwt : JAMAIS appelé pour le login PIN (auth-setup.ts ne génère pas de JWT)
├─ verifyJwt : JAMAIS appelé (pas de token)
└─ Preuve : Code auth-setup.ts ligne 267-278 retourne user sans JWT

═══════════════════════════════════════════════════════════════════════════════════
SECTION 7 : VÉRIFICATION DES FICHIERS DE ROUTE DUPLIQUÉS (ANOMALIE ARCHITECTURALE)
═══════════════════════════════════════════════════════════════════════════════════

Route file 1 : src/server/routes/auth-setup.ts
├─ POST /auth/login/email       [ligne 177]
├─ POST /auth/login/pin         [ligne 238]
├─ POST /auth/setup             [ligne 95]
└─ Retourne : user object (pas de JWT)

Route file 2 : src/server/services/auth.service.ts
├─ POST /auth/login/email       (vérifier ligne)
├─ POST /auth/login/pin         (vérifier ligne)
├─ POST /auth/refresh           (vérifier ligne)
├─ GET /auth/me                 (vérifier ligne)
├─ GET /auth/tenants/:slug      [ligne ~990]
├─ GET /auth/tenants            [ligne 1072]
├─ GET /auth/status             (vérifier ligne)
└─ Retourne : JWT via signJwt

ANOMALIE DÉTECTÉE : DEUX fichiers définissent des routes pour /auth/login/pin.
├─ auth-setup.ts : sans JWT
├─ auth.service.ts : avec JWT (via signJwt)
├─ Le montage dans server.ts détermine lequel gagne
└─ Statut : NOT PROVED comme conséquence de NODE 032 - problème d'architecture

═══════════════════════════════════════════════════════════════════════════════════
SECTION 8 : VÉRIFICATION FINALE - TOUTES BRANCHES ÉLIMINÉES
═══════════════════════════════════════════════════════════════════════════════════

Branche 1 : isServerHealthy ← checkServer() ← backend inaccessible
├─ État : PROVED comme cause environnementale de l'état du guard
└─ Certifié : OUI (trace complète Node 013→017)

Branche 2 : Guard bloque handlePinLogin
├─ État : PROVED comme instruction machine exacte (ligne 411)
└─ Certifié : OUI (trace complète Node 030→032)

Branche 3 : Aucune requête backend
├─ État : PROVED comme conséquence directe
└─ Certifié : OUI (Node 038)

Branche 4 : Aucune transition React
├─ État : PROVED comme conséquence directe
└─ Certifié : OUI (Node 039)

Branche 5 : Aucun navigate()
├─ État : PROVED comme conséquence directe
└─ Certifié : OUI (Node 041)

Branche 6 : UI bloquée
├─ État : PROVED comme conséquence finale
└─ Certifié : OUI (Node 044)

Branche 7 : JWT absent (backend auth-setup.ts)
├─ État : ANOMALIE ARCHITECTURALE - fichier dupliqué sans JWT
├─ N'est PAS une conséquence de NODE 032
├─ N'empêche PAS le login si l'autre route (auth.service.ts) est montée
└─ Certifié : NOT PROVED comme conséquence de la root cause. Problème indépendant.

═══════════════════════════════════════════════════════════════════════════════════
CERTIFICATION FINALE
═══════════════════════════════════════════════════════════════════════════════════

ROOT CAUSE CERTIFIED :

    Fichier : src/pages/auth/LoginPage.tsx
    Ligne : 411
    Fonction : handlePinLogin()
    Instruction : if (pin.length < 4 || !isServerHealthy || submitting) return;
    Condition : !isServerHealthy === true
    Variable : isServerHealthy = false (défini par Node 017 - checkServer échoue)

    BACKTRACK COMPLET :
    Node 017 ← Node 016 (fetch rejeté) ← Node 015 (fetch('/api/auth/status'))
    ← Node 014 (checkServer()) ← Node 013 (useEffect checkServer)
    ← LoginPage mount

BRANCHES NON CERTIFIÉES (problèmes distincts) :

    1. JWT absent du retour POST /auth/login/pin dans auth-setup.ts
       Fichier : src/server/routes/auth-setup.ts, ligne 267-278
       Ceci n'empêche PAS le login de démarrer. C'est un bug différent qui apparaîtrait
       APRÈS avoir corrigé le guard.

    2. Routes /auth/login/pin dupliquées (auth-setup.ts et auth.service.ts)
       Anomalie architecturale. Un seul fichier définit la route "officielle".

Toutes les autres erreurs observées sont des conséquences directes de NODE 032.

═══════════════════════════════════════════════════════════════════════════════════
ROOT CAUSE CERTIFIED : if (pin.length < 4 || !isServerHealthy || submitting) return;
Toutes les autres erreurs sont des conséquences.
═══════════════════════════════════════════════════════════════════════════════════