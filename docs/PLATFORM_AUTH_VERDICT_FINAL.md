# VERDICT FINAL — EXPERTISE MÉDICO-LÉGALE

## Preuve 1 — Ligne 181 de 037_add_platform_roles.sql

**Fichier:** `backend/migrations/037_add_platform_roles.sql`  
**Ligne 181:**

```sql
INSERT OR IGNORE INTO billing_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, created_at)
VALUES (NULL, NULL, 'migration_037_applied', 'system', 0, '{"migration": "037_add_platform_roles", "roles_added": 4}', datetime('now'));
```

## Preuve 2 — Migration 040 contient la MÊME ligne problématique

**Fichier:** `backend/migrations/040_create_platform_audit_logs.sql`  
**Ligne 29-30:**

```sql
INSERT OR IGNORE INTO billing_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, created_at)
VALUES (NULL, NULL, 'migration_040_applied', 'system', 0, '{"migration": "040_create_platform_audit_logs"}', datetime('now'));
```

**Note:** La migration 040 crée `platform_audit_logs` (ligne 8-22) PUIS insère dans `billing_audit_logs` (ligne 29-30).

## Preuve 3 — Table `billing_audit_logs` n'existe PAS

**Commande:**
```bash
sqlite3 data/database.db "SELECT name FROM sqlite_master WHERE type='table' AND name='billing_audit_logs';"
```

**Résultat:** ❌ Aucune sortie. La table `billing_audit_logs` n'existe dans AUCUNE migration. Elle n'a jamais été créée.

## Preuve 4 — Mécanisme du runner

**Fichier:** `src/server/infra/migrations/runner.ts`  
**Lignes 59-88:**

```typescript
try {
  db.transaction(() => {
    db.exec(sql);                    // ligne 61 — exécute TOUT le SQL
    db.prepare('INSERT INTO _migrations ...').run(filename);  // ligne 62
  })();
} catch (err: any) {
  const isMissingTableError = /no such table:/i.test(message);  // ligne 70
  if (isMissingTableError) {
    db.prepare('INSERT INTO _migrations ...').run(filename);    // ligne 82 — MARQUAGE MÊME EN ÉCHEC
    return;
  }
}
```

## Preuve 5 — Chronologie d'exécution réelle

| Ordre | Fichier | Statut | Table `billing_audit_logs` existe ? |
|-------|---------|--------|--------------------------------------|
| 036 | `036_super_admin_roles.sql` | ✅ Exécutée | ❌ Non |
| 037 | `037_add_platform_roles.sql` | ⚠️ Marquée exécutée | ❌ Non → **ROLLBACK** |
| 038 | `038_add_is_platform_user.sql` | ✅ Exécutée | ❌ Non |
| 039 | `039_bootstrap_super_admin.sql` | ✅ Exécutée | ❌ Non |
| 040 | `040_create_platform_audit_logs.sql` | ⚠️ Marquée exécutée | ❌ Non → **ROLLBACK** |
| 041 | `041_hardened_rbac.sql` | ✅ Exécutée | ❌ Non |

## Preuve 6 — Simulation logique exacte

```
applyMigration('037_add_platform_roles.sql')       ← runner.ts:44
    ↓
db.transaction(() => {                              ← runner.ts:60
    db.exec(sql);                                   ← runner.ts:61
    ↓
    LIGNE 13: CREATE TABLE IF NOT EXISTS platform_roles → ✅
    LIGNE 25: INSERT OR IGNORE INTO platform_roles → ✅ (4 rôles)
    LIGNE 56: CREATE TABLE IF NOT EXISTS platform_permissions → ✅
    LIGNE 65: INSERT OR IGNORE INTO platform_permissions → ✅ (26 permissions)
    LIGNE 114: CREATE TABLE IF NOT EXISTS platform_role_permissions → ✅
    LIGNE 126: INSERT OR IGNORE INTO platform_role_permissions → ✅
    LIGNE 174: CREATE INDEX IF NOT EXISTS → ✅
    LIGNE 181: INSERT OR IGNORE INTO billing_audit_logs
              → ❌ SqliteError: no such table: billing_audit_logs
              → TRANSACTION ROLLBACK
              → Toutes les lignes 13-174 sont ANNULÉES
});
    ↓
catch (err)                                         ← runner.ts:65
    ↓
message = "no such table: billing_audit_logs"      ← runner.ts:66
    ↓
isMissingTableError = true                          ← runner.ts:70
    ↓
db.prepare('INSERT OR REPLACE INTO _migrations     ← runner.ts:82
           (filename) VALUES (?)').run('037_...')   ← MARQUAGE ABUSIF
    ↓
return;                                              ← runner.ts:83
```

## VERDICT

**VERDICT A :** La migration 037 est réellement cassée.

| Élément | Valeur |
|---------|--------|
| **Niveau de confiance** | **100%** |
| **Cause** | Ligne 181 de `037_add_platform_roles.sql`: `INSERT OR IGNORE INTO billing_audit_logs` |
| **Erreur** | `SqliteError: no such table: billing_audit_logs` |
| **Effet** | Rollback de TOUTE la transaction → tables `platform_roles`, `platform_permissions`, `platform_role_permissions` créées puis supprimées |
| **Effet secondaire** | Runner ligne 82 marque la migration comme appliquée malgré l'échec |
| **Fichier 1** | `backend/migrations/037_add_platform_roles.sql` ligne 181 |
| **Fichier 2** | `src/server/infra/migrations/runner.ts` ligne 82 (marquage abusif) |
| **Fichier 3** | `backend/migrations/040_create_platform_audit_logs.sql` ligne 29 (même bug) |

## Preuves supplémentaires

**La même erreur impacte aussi la migration 040.**

La migration `040_create_platform_audit_logs.sql` ligne 29-30 contient le même `INSERT OR IGNORE INTO billing_audit_logs`. Bien que 040 crée `platform_audit_logs` (ligne 8-22), cette création est aussi annulée par le rollback. La table `platform_audit_logs` est donc également absente.

## Chaîne causale complète

```
037_add_platform_roles.sql rollback
    ↓
Tables platform_roles, platform_permissions, platform_role_permissions absentes
    ↓
platform-auth.service.ts ligne 139-141: SELECT id FROM platform_roles
    ↓
SqliteError: no such table: platform_roles
    ↓
catch → 500 INTERNAL_ERROR
    ↓
Impossible d'obtenir un JWT
    ↓
Toutes les routes /api/platform/* retournent 401
```

## Impact

| Problème | Cause | Fichier | Ligne |
|----------|-------|---------|-------|
| 500 login | Table `platform_roles` absente | `platform-auth.service.ts` | 139-141 |
| 401 routes | Impossible d'obtenir un JWT | `platform-auth.middleware.ts` | 50-57 |
| Incohérence _migrations | Runner marque même en échec | `runner.ts` | 82 |
| Rollback 037 | `INSERT INTO billing_audit_logs` (table inexistante) | `037_add_platform_roles.sql` | 181 |
| Rollback 040 | `INSERT INTO billing_audit_logs` (table inexistante) | `040_create_platform_audit_logs.sql` | 29 |