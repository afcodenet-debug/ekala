# AUDIT MOTEUR DE MIGRATION — PREUVES RUNTIME

## 1. MOTEUR DE MIGRATION TROUVÉ

**Fichier:** `src/server/infra/migrations/runner.ts`  
**Fonction:** `applyMigration` (ligne 44-89)  
**Appelé depuis:** `src/server/db/database.ts` ligne 3: `import { applyAll as runMigrations } from '../infra/migrations/runner';`

## 2. FLUX EXACT D'EXÉCUTION

```
applyAll()  ← ligne 91
    ↓
ensureBookkeeping()  ← ligne 93 (crée _migrations si absent)
    ↓
fs.readdirSync('backend/migrations/')  ← ligne 94
    ↓
Filtre *.sql et tri alphabétique  ← ligne 95-96
    ↓
Pour chaque fichier:
    applyMigration(filename, sqlPath)  ← ligne 99
```

## 3. FONCTION applyMigration — CODE EXACT

**Fichier:** `src/server/infra/migrations/runner.ts`  
**Lignes 44-89:**

```typescript
export function applyMigration(filename: string, sqlPath: string): void {
  // ÉTAPE 1: Vérifier si déjà appliquée
  const applied = getAppliedMigrations();           // ligne 45
  if (applied.has(filename)) {                       // ligne 46
    console.log(`[Migrations] Already applied — skipping: ${filename}`);  // ligne 47
    return;                                          // ligne 48
  }                                                  // ligne 49

  // ÉTAPE 2: Vérifier si le fichier existe
  if (!fs.existsSync(sqlPath)) {                     // ligne 51
    console.warn(`[Migrations] File not found, skipping: ${filename}`);  // ligne 52
    return;                                          // ligne 53
  }                                                  // ligne 54

  // ÉTAPE 3: Lire le SQL
  console.log(`[Migrations] Applying → ${filename}`);  // ligne 56
  const sql = fs.readFileSync(sqlPath, 'utf8');        // ligne 57

  // ÉTAPE 4: Exécuter dans une transaction
  try {
    db.transaction(() => {                             // ligne 60
      db.exec(sql);                                    // ligne 61 ← EXÉCUTION SQL
      db.prepare('INSERT OR REPLACE INTO _migrations (filename) VALUES (?)').run(filename);  // ligne 62 ← MARQUAGE
    })();                                              // ligne 63
    console.log(`[Migrations] ✓ Applied: ${filename}`);  // ligne 64
  } catch (err: any) {                                 // ligne 65
    const message = String(err?.message || err);       // ligne 66

    // CAS A: Erreur "duplicate column/table/index"
    if (isDuplicateColumnError || isDuplicateTableError || isDuplicateIndexError) {  // ligne 73
      console.warn(`[Migrations] Skipping duplicate schema element for ${filename}:`, message);  // ligne 74
      db.prepare('INSERT OR REPLACE INTO _migrations (filename) VALUES (?)').run(filename);  // ligne 75 ← MARQUAGE MÊME EN ERREUR
      return;                                          // ligne 76
    }

    // CAS B: Erreur "missing table/column"
    if (isMissingTableError || isMissingColumnError) {  // ligne 80
      console.warn(`[Migrations] Skipping missing column/table error in ${filename} (schema may be handled elsewhere):`, message);  // ligne 81
      db.prepare('INSERT OR REPLACE INTO _migrations (filename) VALUES (?)').run(filename);  // ligne 82 ← MARQUAGE MÊME EN ERREUR
      return;                                          // ligne 83
    }

    // CAS C: Autre erreur → throw
    console.error(`[Migrations] ✗ Failed to apply ${filename}:`, message);  // ligne 86
    throw err;                                       // ligne 87
  }
}
```

## 4. MOMENT DU MARQUAGE DANS _migrations

**L'insertion dans `_migrations` se fait-elle après succès ou même en cas d'échec ?**

| Cas | Ligne | Moment | Résultat |
|-----|-------|--------|----------|
| ✅ Succès | 62 | Après `db.exec(sql)` | ✅ Correct |
| ❌ Erreur "duplicate" | 75 | **Même en cas d'échec** | ⚠️ Faux positif |
| ❌ Erreur "missing table/column" | 82 | **Même en cas d'échec** | ⚠️ Faux positif |
| ❌ Autre erreur | 87 | Ne marque pas (throw) | ✅ Correct |

**Conclusion:** L'insertion dans `_migrations` se fait **même en cas d'échec** pour les erreurs "duplicate" et "missing table/column".

## 5. ANALYSE DE LA MIGRATION 037

**Fichier:** `backend/migrations/037_add_platform_roles.sql`

**Instructions SQL:**

| Ligne | Instruction | Problème potentiel |
|-------|-------------|-------------------|
| 13 | `CREATE TABLE IF NOT EXISTS platform_roles (...)` | ✅ Safe |
| 25 | `INSERT OR IGNORE INTO platform_roles (...)` | ✅ Safe |
| 56 | `CREATE TABLE IF NOT EXISTS platform_permissions (...)` | ✅ Safe |
| 65 | `INSERT OR IGNORE INTO platform_permissions (...)` | ✅ Safe |
| 114 | `CREATE TABLE IF NOT EXISTS platform_role_permissions (...)` | ✅ Safe |
| 126 | `INSERT OR IGNORE INTO platform_role_permissions (...)` | ✅ Safe |
| 174 | `CREATE INDEX IF NOT EXISTS ...` | ✅ Safe |
| **181** | **`INSERT OR IGNORE INTO billing_audit_logs (...)`** | **❌ Table `billing_audit_logs` n'existe pas** |

**Problème identifié:** Ligne 181 de `037_add_platform_roles.sql`:

```sql
INSERT OR IGNORE INTO billing_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, created_at)
VALUES (NULL, NULL, 'migration_037_applied', 'system', 0, '{"migration": "037_add_platform_roles", "roles_added": 4}', datetime('now'));
```

**Erreur produite:** `SqliteError: no such table: billing_audit_logs`

## 6. CHAÎNE CAUSALE COMPLÈTE

```
applyMigration('037_add_platform_roles.sql')
    ↓
db.transaction(() => {
  db.exec(sql);  ← Ligne 61
    ↓
  Ligne 13: CREATE TABLE IF NOT EXISTS platform_roles → ✅ OK
  Ligne 25: INSERT OR IGNORE INTO platform_roles → ✅ OK
  Ligne 56: CREATE TABLE IF NOT EXISTS platform_permissions → ✅ OK
  Ligne 65: INSERT OR IGNORE INTO platform_permissions → ✅ OK
  Ligne 114: CREATE TABLE IF NOT EXISTS platform_role_permissions → ✅ OK
  Ligne 126: INSERT OR IGNORE INTO platform_role_permissions → ✅ OK
  Ligne 174: CREATE INDEX IF NOT EXISTS → ✅ OK
  Ligne 181: INSERT OR IGNORE INTO billing_audit_logs → ❌ ERREUR
    ↓
  LA TRANSACTION ROLLBACK
    ↓
  Toutes les instructions précédentes sont ANNULÉES
    ↓
  Les tables platform_roles, platform_permissions, platform_role_permissions
  sont CRÉÉES PUIS SUPPRIMÉES par le rollback
});
    ↓
catch (err)  ← Ligne 65
    ↓
message = "no such table: billing_audit_logs"
    ↓
isMissingTableError = true  ← Ligne 70
    ↓
CAS B: db.prepare('INSERT OR REPLACE INTO _migrations ...').run(filename)  ← Ligne 82
    ↓
Migration 037 marquée comme appliquée MAIS tables inexistantes
```

## 7. CAUSE EXACTE DE L'INCOHÉRENCE

| Élément | Valeur |
|---------|--------|
| **Cause racine** | Ligne 181 de `037_add_platform_roles.sql` insère dans `billing_audit_logs` (table inexistante) |
| **Erreur SQL** | `SqliteError: no such table: billing_audit_logs` |
| **Transaction rollback** | Toutes les instructions précédentes (CREATE TABLE) sont annulées |
| **Marquage abusif** | Ligne 82 de `runner.ts` marque la migration comme appliquée malgré l'échec |
| **Résultat** | Migration 037 dans `_migrations` mais tables absentes |

## 8. RAPPORT FINAL

| Vérification | Résultat |
|-------------|----------|
| Moteur de migration trouvé | ✅ `src/server/infra/migrations/runner.ts` |
| Écriture `_migrations` après succès | ✅ Oui (ligne 62) |
| Écriture `_migrations` même en échec | ✅ Oui (lignes 75, 82) — **BUG** |
| Erreur détectée dans migration 037 | ✅ `no such table: billing_audit_logs` (ligne 181) |
| Cause exacte de l'incohérence | Transaction rollback + marquage abusif dans catch |

## 9. CORRECTION NÉCESSAIRE

**Deux corrections sont nécessaires:**

### Correction 1: Supprimer la ligne 181 de `037_add_platform_roles.sql`
```sql
-- Supprimer cette ligne:
INSERT OR IGNORE INTO billing_audit_logs (...)
```
Car la table `billing_audit_logs` n'existe pas et n'est pas créée par cette migration.

### Correction 2: Forcer la réexécution de la migration 037
```bash
sqlite3 data/database.db "DELETE FROM _migrations WHERE filename = '037_add_platform_roles.sql';"
```
Puis redémarrer le serveur.