# DÉCISION ARCHITECTURALE: OÙ STOCKER LES RÔLES PLATE-FORME ?

## Question

**Les rôles plateforme (`super_admin`, `support_admin`, `finance_admin`, `ops_admin`) doivent-ils être stockés dans :**

- **Option A:** `users.role` (avec contrainte CHECK élargie)
- **Option B:** `platform_admins` (table dédiée existante)
- **Option C:** `platform_roles` (nouvelle table dédiée)

---

## ANALYSE COMPARATIVE

### Option A: Stocker dans `users.role`

#### ✅ Avantages

1. **Architecture actuelle**
   - `platform-bootstrap.ts` ligne 130: INSERT INTO `users`
   - `entity-registry.ts` ligne 55: `localTable: 'users'`
   - Synchronisation déjà configurée vers `users`

2. ** Cohérence avec `tenant_users`**
   - `tenant_users` accepte déjà `super_admin` (migration 036)
   - Pourquoi `users` n'accepterait pas les rôles plateforme ?

3. **Simplicité du code**
   - Un seul utilisateur = une ligne dans `users`
   - Pas de JOIN nécessaire pour vérifier le rôle
   - `SELECT * FROM users WHERE id = ?` suffit

4. **Authentification unifiée**
   - Même table pour tous les utilisateurs (tenants + plateforme)
   - Même système d'authentification
   - Même entité de synchronisation

5. **Permissions déjà gérées**
   - `is_platform_user` (migration 038) identifie les admins plateforme
   - `is_super_admin` (migration 036) identifie les super admins
   - Pas besoin de table supplémentaire

#### ❌ Inconvénients

1. **Contrainte CHECK à modifier**
   - Nécessite une migration pour recréer la table
   - SQLite ne supporte pas ALTER TABLE DROP CONSTRAINT

2. **Mélange des concerns**
   - Users métier (tenants) et users plateforme dans la même table
   - Risque de confusion

3. **Sécurité**
   - Si un tenant devine un rôle plateforme, il pourrait l'utiliser
   - Nécessite une vérification supplémentaire (`is_platform_user`)

---

### Option B: Stocker dans `platform_admins`

#### ✅ Avantages

1. **Table existante**
   - Déjà créée par migration 036
   - Pas de nouvelle migration nécessaire

2. **Isolation**
   - Séparation claire entre users métier et plateforme
   - Pas de conflit de contrainte CHECK

3. **Sécurité**
   - Les tenants ne peuvent pas accéder à `platform_admins`
   - Vraie isolation des privilèges

#### ❌ Inconvénients

1. **Table inutilisée**
   - Aucune référence dans le code TypeScript
   - Pas dans `entity-registry.ts`
   - Pas de synchronisation prévue

2. **Double stockage**
   - `users` contient déjà les infos de base (email, password_hash)
   - `platform_admins` contient seulement `permissions`
   - Redondance et complexité

3. **Authentification fragmentée**
   - Login dans `users`
   - Rôle dans `platform_admins`
   - Nécessite un JOIN systématique

4. **Foreign keys**
   - `voucher_audit_logs.actor_id` référence `users.id`
   - Si un admin plateforme crée un log, il faut une ligne dans `users` ET `platform_admins`

5. **Refactoring massif**
   - Tous les middlewares doivent être modifiés
   - Tous les services doivent être modifiés
   - Toutes les requêtes doivent être modifiées

---

### Option C: Créer `platform_roles` (nouvelle table)

#### ✅ Avantages

1. **Design propre**
   - Table dédiée aux rôles plateforme
   - Schéma optimisé pour les permissions

2. **Flexibilité**
   - Facile d'ajouter de nouveaux rôles
   - Pas de contrainte CHECK restrictive

#### ❌ Inconvénients

1. **Nouvelle table**
   - Migration supplémentaire nécessaire
   - Pas de table existante à réutiliser

2. **Mêmes problèmes que Option B**
   - Double stockage
   - Authentification fragmentée
   - Refactoring massif
   - Foreign keys complexes

3. **Surcharge architecturale**
   - Pour 4 rôles seulement
   - Complexité disproportionnée

---

## ARGUMENTS DÉCISIFS

### Argument 1: L'architecture ACTUELLE prévoit `users`

**Preuve 1:** `platform-bootstrap.ts` ligne 130
```typescript
INSERT INTO users (...)
```

**Preuve 2:** `entity-registry.ts` ligne 55
```typescript
{
  entity: 'user',
  localTable: 'users',
  remoteTable: 'users',
  hasTenantId: true
}
```

**Preuve 3:** `super-admin.middleware.ts` ligne 12
```typescript
if (user.role !== 'super_admin' && user.role !== 'owner')
```

**Conclusion:** Toute l'architecture est construite autour de `users`. Changer nécessite un refactoring massif.

### Argument 2: `tenant_users` accepte déjà `super_admin`

**Preuve:** `backend/migrations/036_super_admin_roles.sql` ligne 45
```sql
role TEXT NOT NULL DEFAULT 'staff' 
CHECK (role IN ('owner','admin','manager','cashier','waiter','staff','super_admin'))
```

**Conclusion:** Si `tenant_users` accepte `super_admin`, pourquoi pas `users` ? Cohérence.

### Argument 3: `platform_admins` n'est JAMAIS utilisée

**Preuve:** Recherche dans le code = 0 résultats

**Conclusion:** Cette table a été créée par précaution mais jamais adoptée. L'architecture a choisi `users`.

### Argument 4: Les permissions sont déjà dans `users`

**Colonnes existantes:**
- `is_platform_user` (migration 038)
- `is_super_admin` (migration 036)

**Conclusion:** Les informations "plateforme" sont déjà dans `users`. Pas besoin de table supplémentaire.

### Argument 5: La synchronisation est déjà configurée

**Preuve:** `entity-registry.ts` ligne 55-63
```typescript
{
  entity: 'user',
  localTable: 'users',
  remoteTable: 'users',
  hasTenantId: true,
  allowedFields: [...]
}
```

**Conclusion:** La sync vers `users` fonctionne. Changer de table nécessite une nouvelle entité de sync.

---

## DÉCISION RECOMMANDÉE

# ✅ OPTION A: Stocker dans `users.role`

## Justification

### 1. Principe de moindre changement

**Changement requis:**
- ✅ Élargir la contrainte CHECK (1 migration)
- ✅ Corriger `platform-bootstrap.ts` (1 ligne)

**Changements requis pour Option B/C:**
- ❌ Créer/modifier `platform_admins` ou `platform_roles`
- ❌ Modifier `entity-registry.ts` (nouvelle entité)
- ❌ Modifier `GenericSyncService` (nouvelle logique)
- ❌ Modifier tous les middlewares
- ❌ Modifier tous les services d'authentification
- ❌ Gérer les foreign keys (`actor_id`, etc.)
- ❌ Tester l'ensemble du système

### 2. Cohérence architecturale

**État actuel:**
- `users` contient tous les utilisateurs (tenants + plateforme)
- `tenant_users` fait le lien user ↔ tenant
- `platform_admins` existe mais n'est pas utilisé

**Décision:** Continuer avec `users` car c'est l'architecture choisie.

### 3. Pragmatisme

**Réalité:**
- Le code FONCTIONNE avec `users`
- Seule la contrainte CHECK bloque
- Élargir la contrainte = 1 heure de travail
- Créer une nouvelle table = 1 semaine de travail

### 4. Évolutivité

**Avec `users.role`:**
- ✅ Facile d'ajouter de nouveaux rôles (juste la contrainte)
- ✅ Les permissions sont gérées par `is_platform_user` + `is_super_admin`
- ✅ La table `platform_roles` (CSV) peut être utilisée pour l'UI uniquement

**Avec table dédiée:**
- ❌ Complexité pour ajouter un rôle
- ❌ Nécessite de modifier plusieurs tables

---

## MISE EN ŒUVRE

### Étape 1: Migration SQLite

**Fichier:** `backend/migrations/041_fix_users_role_constraint.sql`

**Action:** Élargir la contrainte CHECK sur `users.role`

```sql
CHECK (role IN (
    'owner','admin','manager','cashier','waiter','staff',
    'super_admin','platform_admin','platform_support',
    'support_admin','finance_admin','ops_admin'
))
```

### Étape 2: Correctif bootstrap

**Fichier:** `src/server/platform/platform-bootstrap.ts` ligne 119

```typescript
add('role', 'super_admin');  // Au lieu de 'owner'
```

### Étape 3: Vérifications

- [ ] Tester la contrainte
- [ ] Vérifier le super admin
- [ ] Tester l'authentification
- [ ] Tester la synchronisation

---

## RÉPONSE À LA QUESTION

# ❌ NON, les rôles plateforme ne doivent PAS être dans `platform_admins` ou `platform_roles`

# ✅ OUI, les rôles plateforme doivent être dans `users.role`

## Raisons synthétiques

1. **Architecture existante:** Tout le code est construit autour de `users`
2. **Cohérence:** `tenant_users` accepte déjà `super_admin`
3. **Pragmatisme:** 1 heure vs 1 semaine de travail
4. **Synchronisation:** Déjà configurée vers `users`
5. **Permissions:** Gérées par `is_platform_user` et `is_super_admin`
6. **Table morte:** `platform_admins` existe mais n'est jamais utilisée

## Preuves irréfutables

### Preuve 1: Le bootstrap utilise `users`

```typescript
// platform-bootstrap.ts:130
INSERT INTO users (...)
```

### Preuve 2: La sync utilise `users`

```typescript
// entity-registry.ts:55
localTable: 'users',
remoteTable: 'users'
```

### Preuve 3: Le middleware lit dans `users`

```typescript
// super-admin.middleware.ts:12
if (user.role !== 'super_admin')
```

### Preuve 4: `platform_admins` est une table morte

```
Recherche dans le code: 0 résultats
```

---

## CONCLUSION

**La bonne architecture est de stocker les rôles plateforme dans `users.role`.**

La table `platform_admins` a été créée par précaution mais n'a jamais été adoptée par le code. L'architecture retenue est `users` avec `is_platform_user` pour identifier les admins plateforme.

**La correction consiste à élargir la contrainte CHECK, pas à créer une nouvelle table.**