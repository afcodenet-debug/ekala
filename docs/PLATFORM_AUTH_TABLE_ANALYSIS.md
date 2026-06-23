# ANALYSE DES TABLES PLATFORM — PREUVES RUNTIME

## 1. RÉFÉRENCES À `platform_roles` DANS LE CODE

### Référence 1 — platform-auth.service.ts (ligne 139-141)

**Fichier:** `src/server/platform/platform-auth.service.ts`
**SQL:**
```sql
SELECT id FROM platform_roles WHERE role_name = ? LIMIT 1
```
**Usage métier:** Résoudre l'ID du rôle pour l'injecter dans le JWT token (`role_id`).

### Référence 2 — platform-auth.service.ts (ligne 250)

**SQL:**
```sql
...FROM platform_role_permissions prp
JOIN platform_roles pr ON prp.role_id = pr.id
JOIN platform_permissions p ON prp.permission_id = p.id
```
**Usage métier:** Charger les permissions d'un rôle.

### Référence 3 — rbac-cache.service.ts

**SQL:**
```sql
JOIN platform_roles pr ON pr.role_name = pa.role_name
```
**Usage métier:** Mettre en cache les permissions par rôle.

### Référence 4 — kill-switch.service.ts

**SQL:**
```sql
SELECT role_name FROM platform_roles WHERE id = ?
SELECT id FROM platform_roles WHERE id = ?
```
**Usage métier:** Vérifier si un rôle existe avant de le "kill".

---

## 2. VÉRIFICATION RUNTIME — TABLES EXISTANTES

| Table | Existe dans SQLite ? |
|-------|---------------------|
| `platform_roles` | ❌ NON |
| `platform_permissions` | ❌ NON |
| `platform_role_permissions` | ❌ NON |
| `platform_admins` | ❌ NON |
| `platform_config` | ✅ OUI |

**Preuve:**
```bash
sqlite3 data/database.db ".tables" | grep -i "platform_roles\|platform_permissions\|platform_role_permissions"
# Aucune sortie — tables absentes
```

---

## 3. MIGRATION RESPONSABLE

**Fichier:** `backend/migrations/037_add_platform_roles.sql`
**Ligne 13-22:** Crée `platform_roles`
**Ligne 56-62:** Crée `platform_permissions`
**Ligne 114-122:** Crée `platform_role_permissions`

**Tables créées par cette migration:**

| Table | Ligne dans 037_add_platform_roles.sql |
|-------|---------------------------------------|
| `platform_roles` | 13 |
| `platform_permissions` | 56 |
| `platform_role_permissions` | 114 |

**Données insérées par cette migration:**
- 4 rôles: super_admin, support_admin, finance_admin, ops_admin (ligne 25-53)
- 26 permissions (ligne 65-111)
- Liaisons rôle-permission (ligne 126-171)

---

## 4. VÉRIFICATION — MIGRATION EXÉCUTÉE ?

```bash
sqlite3 data/database.db "SELECT name FROM sqlite_master WHERE type='table' AND name='platform_roles';"
```

**Résultat:** ❌ Aucune sortie. La table n'existe pas.

**Conclusion:** La migration 037 N'A JAMAIS ÉTÉ EXÉCUTÉE dans cette base SQLite.

---

## 5. TABLEAU RÉCAPITULATIF

| Table | Existe | Migration responsable | Utilisée par login |
|-------|--------|----------------------|--------------------|
| `users` | ✅ OUI | Migrations antérieures | ✅ OUI (SELECT user) |
| `platform_roles` | ❌ NON | 037_add_platform_roles.sql | ✅ OUI (ligne 139-141) |
| `platform_permissions` | ❌ NON | 037_add_platform_roles.sql | ❌ INDIRECT |
| `platform_role_permissions` | ❌ NON | 037_add_platform_roles.sql | ❌ INDIRECT |
| `platform_admins` | ❌ NON | Non trouvée | ❌ NON |
| `platform_config` | ✅ OUI | Autre | ❌ NON |
| `platform_audit_logs` | ❌ NON | 040_create_platform_audit_logs.sql | ❌ NON |
| `rbac_audit_log` | ❌ NON | 041_hardened_rbac.sql | ❌ NON |

---

## 6. CONCLUSION

### A. Faut-il exécuter une migration manquante ?

**OUI.** La migration `backend/migrations/037_add_platform_roles.sql` doit être exécutée pour créer les 3 tables manquantes et insérer les 4 rôles + 26 permissions.

### B. Le code de login est-il incorrect ?

**NON.** Le code de login utilise correctement `platform_roles` pour résoudre l'ID du rôle. C'est une dépendance légitime.

**Preuve:** Le login exécute cette séquence:
1. ✅ Cherche l'user dans `users` (existe)
2. ✅ Vérifie le mot de passe (valide)
3. ✅ Vérifie `is_active` (actif)
4. ✅ Vérifie le rôle (`owner` est autorisé ligne 136)
5. ❌ **SELECT id FROM platform_roles** (table manquante)
6. ❌ Erreur → catch → 500

### C. Flux causal complet

```
Login request
    ↓
platformAuthService.login(email, password)  ← platform-auth.service.ts:100
    ↓
SELECT ... FROM users WHERE email=?         ← ligne 106
    ↓
✅ User trouvé (id=41, owner, active)
    ↓
verifyPassword(password, hash)               ← ligne 113
    ↓
✅ Password valide
    ↓
SELECT id FROM platform_roles WHERE role_name='owner' ← ligne 139-141
    ↓
❌ SqliteError: no such table: platform_roles
    ↓
catch → 500 INTERNAL_ERROR                   ← platform-auth.routes.ts:56-58
```

### D. Correction minimale

**Exécuter la migration** `backend/migrations/037_add_platform_roles.sql` dans la base SQLite locale.

**Commande:**
```bash
sqlite3 data/database.db < backend/migrations/037_add_platform_roles.sql
```

**Après migration:** Re-lancer le login → devrait fonctionner.