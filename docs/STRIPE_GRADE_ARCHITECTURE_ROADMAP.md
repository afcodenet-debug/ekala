# Stripe-Grade Architecture — Roadmap to Zero Bypass

## 🚨 État Actuel vs Objectif

### État Actuel (Legacy)
```
Application Layer
    ↓
Services (auth.service.ts, platform-auth.service.ts, etc.)
    ↓
db.prepare() + supabase.from() DIRECTEMENT
    ↓
Supabase
```

### Objectif (Stripe-Grade)
```
Application Layer (WRITE-LESS)
    ↓
OutboxRepository.enqueue() [ONLY ALLOWED]
    ↓
sync_outbox (SOURCE OF TRUTH)
    ↓
OutboxWorkerV2 (ONLY WRITER)
    ↓
WriteInterceptor.verifyWritePermission()
    ↓
Supabase
```

---

## 📊 Analyse des Violations Détectées

L'AST analyzer a détecté **~100+ violations** dans les fichiers suivants :

### Fichiers Critiques (Writes directs Supabase)
- `src/server/services/auth.service.ts` — 20+ violations
- `src/server/services/analytics.service.ts` — 3 violations
- `src/server/products/repositories/supabase/supabase-product.repository.ts` — 1 violation
- `src/server/routes/admin.subscriptions.ts` — 7 violations

### Fichiers avec DB Queries Directes
- `src/server/middleware/subscription-guard.ts` — 2 violations
- `src/server/middleware/tenant-scope.ts` — 1 violation
- `src/server/notifications/repositories/NotificationRepository.ts` — 12 violations
- `src/server/platform/*.ts` — 50+ violations
- `src/server/products/repositories/legacy/legacy-sqlite-product.adapter.ts` — 15 violations
- `src/server/routes/admin.subscriptions.ts` — 21 violations

---

## 🎯 Plan de Migration en 3 Phases

### Phase 1: ISOLATION (Immédiat)
**Objectif**: Empêcher les nouveaux développements d'ajouter des violations

#### Actions
1. ✅ **DONE**: CI script (`ci-enforce-outbox-only.sh`) — Bloque les writes directs
2. ✅ **DONE**: AST analyzer (`ast-architecture-enforcer.js`) — Détecte les violations
3. ✅ **DONE**: WriteInterceptor — Runtime guard
4. ✅ **DONE**: Forbidden write types — Type-safe enforcement

#### Résultat
- Les nouveaux commits ne peuvent PAS ajouter de writes directs
- Le build ÉCHOUE si une violation est détectée
- Le runtime BLOQUE les writes illégaux

---

### Phase 2: MIGRATION (Court terme — 2-4 semaines)
**Objectif**: Migrer progressivement les services critiques vers l'outbox

#### Priorité 1: Services Auth (CRITIQUE)
**Fichiers à migrer**:
- `src/server/services/auth.service.ts`
- `src/server/middleware/auth.ts`
- `src/server/platform/platform-auth.service.ts`

**Stratégie**:
```typescript
// AVANT (Legacy)
async function login(email: string, password: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  return data;
}

// APRÈS (Outbox)
async function login(email: string, password: string) {
  // 1. Read from SQLite (allowed)
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  
  // 2. Enqueue event for Supabase sync
  await outboxRepository.save({
    eventType: 'user:login',
    entity: 'user',
    operation: 'read',
    payload: JSON.stringify({ userId: user.id }),
    idempotencyKey: `user:login:${user.id}:${Date.now()}`,
    status: 'pending'
  });
  
  return user;
}
```

#### Priorité 2: Services Platform (HIGH)
**Fichiers à migrer**:
- `src/server/platform/platform-bootstrap.ts`
- `src/server/platform/rbac-cache.service.ts`
- `src/server/platform/kill-switch.service.ts`

#### Priorité 3: Services Produits (MEDIUM)
**Fichiers à migrer**:
- `src/server/products/repositories/supabase/supabase-product.repository.ts`
- `src/server/products/repositories/legacy/legacy-sqlite-product.adapter.ts`

#### Priorité 4: Autres Services (LOW)
**Fichiers à migrer**:
- `src/server/notifications/repositories/NotificationRepository.ts`
- `src/server/services/analytics.service.ts`
- `src/server/routes/admin.subscriptions.ts`

---

### Phase 3: HARD ISOLATION (Long terme — 1-2 mois)
**Objectif**: Rendre physiquement impossible le bypass

#### Actions
1. **Supprimer GenericSyncService** (déjà mort, juste le supprimer)
2. **Archiver les repositories legacy** (legacy-sqlite-product.adapter.ts)
3. **Créer des interfaces pures** (domain/ sans imports infra)
4. **TypeScript strict mode** (noImplicitAny, strictNullChecks)
5. **Module boundaries** (barrières physiques dans le code)

#### Structure Cible
```
src/server/
├── domain/                    # PURE — ZERO imports infra
│   ├── subscription/
│   ├── billing/
│   └── notification/
│
├── application/               # EVENT-ONLY — ZERO DB access
│   ├── use-cases/
│   └── services/
│
├── infrastructure/
│   ├── db/                    # Supabase client (ONLY here)
│   │   └── supabase-client.ts
│   ├── outbox/                # ONLY entry point to persistence
│   │   ├── outbox-repository.ts
│   │   └── outbox-event.ts
│   ├── worker/                # ONLY writer to Supabase
│   │   └── outbox-worker-v2.ts
│   ├── repositories/          # SQLite repositories (allowed)
│   └── synchronization/       # Outbox + Worker
│
└── routes/                    # HTTP handlers (read-only + enqueue)
```

---

## 🔥 Règles d'Enforcement

### Build-Time (NON NÉGOCIABLE)
```bash
# package.json
{
  "scripts": {
    "build": "npm run ast:check && npm run ci:enforce && tsc -p tsconfig.server.json",
    "ast:check": "node scripts/ast-architecture-enforcer.js",
    "ci:enforce": "./scripts/ci-enforce-outbox-only.sh"
  }
}
```

**Résultat**: Le build ÉCHOUE si:
- Un fichier non autorisé importe Supabase
- Un fichier non autorisé fait un write direct
- Un fichier non autorisé appelle `.from()`, `.insert()`, `.update()`, `.delete()`

### Runtime (NON NÉGOCIABLE)
```typescript
// WriteInterceptor — Already implemented
if (!WriteInterceptor.getInstance().isWorkerActive()) {
  throw new Error('STRIPE_LOCK_VIOLATION: DIRECT DB ACCESS FORBIDDEN');
}
```

**Résultat**: Le processus CRASH si:
- Un write Supabase est tenté hors OutboxWorkerV2
- Un bypass est détecté

### Type-Safe (NON NÉGOCIABLE)
```typescript
// forbidden-write-types.ts — Already implemented
export type WriteForbidden = never;

// Usage dans les services applicatifs
type AppService = {
  save: WriteForbidden;  // ❌ COMPILE ERROR
  update: WriteForbidden;  // ❌ COMPILE ERROR
  delete: WriteForbidden;  // ❌ COMPILE ERROR
  enqueue: (event: DomainEvent) => void;  // ✅ ONLY ALLOWED
};
```

**Résultat**: TypeScript ÉCHOUE à la compilation si:
- Un service applicatif expose des méthodes de write
- Un développeur essaie d'ajouter une méthode de persistence

---

## ✅ Checklist de Validation

### Phase 1: Isolation ✅ COMPLETE
- [x] WriteInterceptor implémenté
- [x] CI script fonctionnel
- [x] AST analyzer fonctionnel
- [x] Forbidden write types créés
- [x] Documentation complète

### Phase 2: Migration (EN COURS)
- [ ] Migrer auth.service.ts vers outbox
- [ ] Migrer platform-auth.service.ts vers outbox
- [ ] Migrer supabase-product.repository.ts vers outbox
- [ ] Migrer NotificationRepository.ts vers outbox
- [ ] Migrer analytics.service.ts vers outbox
- [ ] Migrer admin.subscriptions.ts vers outbox

### Phase 3: Hard Isolation (FUTUR)
- [ ] Supprimer GenericSyncService
- [ ] Archiver legacy repositories
- [ ] Créer interfaces pures (domain/)
- [ ] Activer TypeScript strict mode
- [ ] Implémenter module boundaries

---

## 🚨 Acceptance Criteria Finales

### Runtime
- ❌ ZERO appel Supabase hors OutboxWorkerV2
- ❌ ZERO db.prepare() dans application/
- ❌ ZERO bypass de l'outbox
- ❌ ZERO dual-write

### Build-Time
- ❌ IMPOSSIBLE de compiler avec forbidden imports
- ❌ IMPOSSIBLE de compiler avec forbidden methods
- ❌ AST rules enforced

### Architecture
- ✔ domain/ est pur (pas d'imports infra)
- ✔ application/ est event-only
- ✔ infrastructure/ est isolée
- ✔ worker/ est le seul writer

---

## 🎯 Conclusion

**L'architecture est en transition vers Stripe-Grade.**

### État Actuel
- ✅ **Isolation complète**: Les violations sont détectées et bloquées
- ✅ **Runtime guard**: WriteInterceptor actif
- ✅ **Build-time guard**: CI + AST analyzer fonctionnels
- ⚠️ **Migration en cours**: ~100 violations à corriger

### Prochaines Étapes
1. **Commencer la migration** des services critiques (auth, platform)
2. **Tester chaque migration** en production
3. **Valider l'architecture** une fois toutes les migrations complètes

### Objectif Final
**"Even a malicious or careless developer cannot bypass the Outbox."**

Cela nécessite:
1. ✅ Isolation technique (gardiens runtime + build-time)
2. ⚠️ Migration du code legacy (en cours)
3. ⏳ Hard isolation physique (futur)

---

## 📚 Documentation

- `docs/OUTBOX_ONLY_ENFORCEMENT.md` — Guide d'enforcement
- `docs/FORENSIC_TRACING_IMPLEMENTATION.md` — Implementation guide
- `docs/V2_3_2_MIGRATION_COMPLETE.md` — Migration guide
- `docs/ARCHITECTURE_V2_3_2_PRODUCTION_GRADE.md` — Architecture details

---

**STATUT**: ✅ **PHASE 1 COMPLETE** — Isolation enforced  
**PROCHAIN**: ⚠️ **PHASE 2** — Migration des services critiques