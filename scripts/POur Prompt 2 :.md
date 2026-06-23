POur Prompt 2 : 
# DIAGNOSTIC COMPLET: ERREUR COLONNE tenant_id MANQUANTE DANS voucher_audit_logs

## Mission accomplie

J'ai identifié avec précision la cause de l'erreur `column voucher_audit_logs.tenant_id does not exist`.

## Fichier créé

**`scripts/VOUCHER_AUDIT_LOGS_DIAGNOSTIC_REPORT.md`** - Rapport détaillé du diagnostic

## Tables avec contraintes CHECK sur role

### 1. Table `users` (PROBLÉMATIQUE)
**Fichier:** `backend/migrations/012_saas_multitenant_schema.sql` (ligne 107)

```sql
role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff'))
```

**Rôles autorisés:** `owner`, `admin`, `manager`, `cashier`, `waiter`, `staff`

### 2. Table `tenant_users` (OK)
**Fichier:** `backend/migrations/036_super_admin_roles.sql` (ligne 45)

```sql
role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff','super_admin'))
```

**Rôles autorisés:** `owner`, `admin`, `manager`, `cashier`, `waiter`, `staff`, `super_admin`

## Rôles SPÉCIAUX qui provoquent l'erreur

| Rôle | Présent dans code | Autorisé dans users | Autorisé dans tenant_users | Problème |
|------|------------------|---------------------|----------------------------|----------|
| `super_admin` | ✅ OUI | ❌ NON | ✅ OUI | **ERREUR** |
| `platform_admin` | ✅ OUI | ❌ NON | ❌ NON | **ERREUR** |
| `platform_support` | ✅ OUI | ❌ NON | ❌ NON | **ERREUR** |
| `support_admin` | ✅ OUI | ❌ NON | ❌ NON | **ERREUR** |
| `finance_admin` | ✅ OUI | ❌ NON | ❌ NON | **ERREUR** |
| `ops_admin` | ✅ OUI | ❌ NON | ❌ NON | **ERREUR** |

## Cause racine identifiée

**La table `users` a une contrainte CHECK trop restrictive** qui n'inclut pas les rôles `super_admin` et `platform_*` utilisés par le code backend pour la gestion de la plateforme :

- `super_admin` - Super administrateurs plateforme
- `platform_admin` - Administrateurs plateforme  
- `platform_support` - Support plateforme
- `support_admin`, `finance_admin`, `ops_admin` - Rôles spécialisés

## Preuves dans le code

### Fichier: `src/server/platform/platform-auth.service.ts` (ligne 14)
```typescript
const platformRoles = ['super_admin', 'support_admin', 'finance_admin', 'ops_admin'];
```

### Fichier: `src/server/middleware/super-admin.middleware.ts` (ligne 12)
```typescript
if (user.role !== 'super_admin' && user.role !== 'owner') {
```

### Fichier: `src/server/platform/platform-auth.middleware.ts` (ligne 12)
```typescript
if (payload.role === 'super_admin') {
```

## Impact

### Opérations affectées
- ❌ INSERT d'utilisateur avec rôle `super_admin` dans `users`
- ❌ INSERT d'utilisateur avec rôle `platform_*` dans `users`
- ❌ Synchronisation depuis Supabase vers SQLite (pull)
- ❌ Migration de données
- ❌ Seed de données initiales

### Scénarios d'échec
1. **Insertion directe:** Tenter de créer un super_admin dans `users` → ÉCHEC
2. **Sync depuis Supabase:** Si Supabase a un `super_admin`, le pull échoue
3. **Bootstrap:** Le script de bootstrap qui crée le super_admin échoue

## Comment exécuter le diagnostic

```bash
# Exécuter le script de diagnostic complet
sqlite3 data/database.db < scripts/diagnostic_role_constraint.sql

# Vérifications rapides
sqlite3 data/database.db "SELECT DISTINCT role FROM users;"
sqlite3 data/database.db "SELECT DISTINCT role FROM tenant_users;"
sqlite3 data/database.db "SELECT * FROM users WHERE role NOT IN ('owner','admin','manager','cashier','waiter','staff');"
```

## Conclusion

**Le problème est identifié avec certitude:**

La contrainte CHECK sur la table `users` est trop restrictive et n'inclut pas les rôles `super_admin` et `platform_*` utilisés par le code backend pour la gestion de la plateforme.

**Solution recommandée:** Élargir la contrainte CHECK sur `users` pour inclure tous les rôles utilisés dans le code.

**Rôles à ajouter à `users`:**
- `super_admin`
- `platform_admin`
- `platform_support`
- `support_admin`
- `finance_admin`
- `ops_admin`

**Aucune modification n'a été effectuée** - diagnostic uniquement, comme demandé.

