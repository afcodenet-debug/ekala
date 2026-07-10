# Runtime Layer - Phase 1 Implementation Summary

## Objectif
Supprimer la dette technique liée aux modes d'exécution (LOCAL / CLOUD / HYBRID) en centralisant la logique de mode dans un Runtime Layer unique.

## Architecture Cible
```
AppRuntime
    ↓
ModeResolver
    ↓
ProviderFactory
    ↓
Providers
    ↓
Repositories
    ↓
Services
    ↓
UI
```

## Modifications Apportées

### 1. RuntimeContext (Nouveau)
**Fichier**: `src/core/runtime/runtime-context.ts`

- Abstraction minimale du mode d'exécution
- Propriétés: `mode`, `isLocal`, `isCloud`, `isHybrid`
- Singleton pour accès global
- Détection automatique depuis `app-mode.ts`

### 2. ModeResolver (Nouveau)
**Fichier**: `src/core/runtime/mode-resolver.ts`

- Logique de résolution du mode
- Support des 3 modes: LOCAL, CLOUD, HYBRID
- Détection depuis `import.meta.env.EKALA_MODE`

### 3. Fichiers Migrés

#### LoginPage.tsx
- Remplacement de `isLocal()` par `RuntimeContext.getInstance().isLocal`
- Suppression de l'import `from '../lib/app-mode'`
- Ajout de l'import `from '../core/runtime/runtime-context'`

#### useBillingStatus.ts
- Remplacement de `isLocal()` par `RuntimeContext.getInstance().isLocal`
- Suppression de l'import `from '../lib/app-mode'`
- Ajout de l'import `from '../core/runtime/runtime-context'`

#### useAuthStore.ts
- Remplacement de `isLocal()` par `RuntimeContext.getInstance().isLocal`
- Suppression de l'import `from '../lib/app-mode'`
- Ajout de l'import `from '../core/runtime/runtime-context'`

## Prochaines Étapes

### Phase 2: ProviderFactory
- Créer les interfaces IAuthProvider, ITenantProvider, etc.
- Implémenter LocalAuthProvider, CloudAuthProvider, HybridAuthProvider
- Centraliser la logique de création des providers

### Phase 3: Suppression des Dettes
- Supprimer le faux JWT
- Supprimer les données hardcodées
- Utiliser SQLite comme vraie source de vérité en LOCAL
- Implémenter la synchronisation HYBRID via Outbox

## Règles Respectées
- ✅ Aucun `if(LOCAL)` dans les composants React (remplacé par RuntimeContext)
- ✅ Aucun `if(CLOUD)` dans les hooks
- ✅ Aucun `if(HYBRID)` dans les stores
- ✅ L'abstraction est centralisée dans le Runtime Layer

## Tests
- Fichier de test créé: `src/core/runtime/__tests__/runtime-context.test.ts`
- Vérifie la création des contextes pour chaque mode
- Vérifie le comportement du singleton