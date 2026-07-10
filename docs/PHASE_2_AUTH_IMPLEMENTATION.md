# Phase 2 - AUTH UNIQUEMENT

## 1. Fichiers créés/modifiés

### Fichiers créés:
- `src/core/auth/IAuthProvider.ts` - Interface d'authentification multi-mode (existant)
- `src/core/auth/providers/LocalAuthProvider.ts` - Provider LOCAL (existant)
- `src/core/auth/providers/CloudAuthProvider.ts` - Provider CLOUD (nouveau)
- `src/core/auth/providers/HybridAuthProvider.ts` - Provider HYBRID (nouveau)
- `src/core/auth/AuthService.ts` - Service d'orchestration (nouveau)

### Fichiers modifiés:
- Aucun (contrainte: ne pas toucher l'ancien code avant validation)

## 2. Flux login complet par mode

### Architecture:
```
LoginPage
    ↓
AuthService (singleton)
    ↓
IAuthProvider (interface)
    ↓
┌─────────────────┬─────────────────┬─────────────────┐
│  LocalAuthProvider │ CloudAuthProvider │ HybridAuthProvider │
└─────────────────┴─────────────────┴─────────────────┘
```

### Mode LOCAL:
1. LoginPage → AuthService.getInstance()
2. AuthService détecte `runtime.isLocal = true`
3. AuthService utilise LocalAuthProvider
4. LocalAuthProvider fait des appels API vers `/api/auth/*`
5. Le backend Express sert les données depuis SQLite
6. JWT est généré côté serveur (pas côté frontend)
7. Token retourné au frontend et stocké

### Mode CLOUD:
1. LoginPage → AuthService.getInstance()
2. AuthService détecte `runtime.isCloud = true`
3. AuthService utilise CloudAuthProvider
4. CloudAuthProvider fait des appels API vers `/api/auth/*`
5. Le backend sert les données depuis Supabase
6. JWT est généré côté serveur
7. Token retourné au frontend et stocké

### Mode HYBRID:
1. LoginPage → AuthService.getInstance()
2. AuthService détecte `runtime.isHybrid = true`
3. AuthService utilise HybridAuthProvider
4. HybridAuthProvider délègue à LocalAuthProvider
5. Fallback vers Cloud si nécessaire

## 3. Contraintes respectées

- ✅ LocalAuthProvider utilise SQLite comme source de vérité
- ✅ Pas de données hardcodées
- ✅ Pas de JWT fabriqué côté frontend
- ✅ Le frontend ne connaît jamais le mode
- ✅ RuntimeContext reste responsable du runtime uniquement
- ✅ Aucun accès database/auth/provider dans RuntimeContext

## 4. Tests réalisés

- Build serveur: ✅ PASSÉ
- Build renderer: ❌ Erreur pré-existante dans useTableStore.ts (hors scope)

## 5. Erreurs restantes

### Erreur de build (pré-existante):
```
Could not resolve '../../server/db/database' in src/stores/useTableStore.ts:113
```
Cette erreur n'est pas liée à l'implémentation d'authentification.

## 6. Prochaine étape

Après validation, il faudra:
1. Modifier LoginPage pour utiliser AuthService au lieu de la logique inline
2. Supprimer le code de simulation JWT local dans LoginPage
3. Faire migrer useAuthStore vers AuthService
