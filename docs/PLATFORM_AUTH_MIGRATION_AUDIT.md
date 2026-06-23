# AUDIT MIGRATION 037 — PREUVES RUNTIME

## 1. MÉCANISME DE TRACKING

**Table de tracking:** `_migrations`  
**Fichier créateur:** `src/server/db/database.ts` ligne 18  
**Structure:**
```sql
CREATE TABLE IF NOT EXISTS _migrations (
  filename TEXT PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Colonne | Type | PK | Default |
|---------|------|----|---------|
| `filename` | TEXT | ✅ | - |
| `applied_at` | DATETIME | ❌ | CURRENT_TIMESTAMP |

## 2. STATUT DE LA MIGRATION 037

**Requête:**
```sql
SELECT filename, applied_at FROM _migrations WHERE filename LIKE '%037%' OR filename LIKE '%platform_roles%';
```

**Résultat:**
```
037_add_platform_roles.sql|2026-06-22 09:14:30
```

**Conclusion:** ✅ La migration 037 EST enregistrée comme **exécutée** le 2026-06-22 à 09:14:30.

## 3. STATUT DES TABLES ATTENDUES

**Requête:**
```sql
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('platform_roles','platform_permissions','platform_role_permissions');
```

**Résultat:** ❌ Aucune sortie. **Aucune des 3 tables n'existe.**

**Vérification individuelle:**

| Table | Requête | Résultat |
|-------|---------|----------|
| `platform_roles` | `SELECT name FROM sqlite_master WHERE name='platform_roles'` | ❌ Absente |
| `platform_permissions` | `SELECT name FROM sqlite_master WHERE name='platform_permissions'` | ❌ Absente |
| `platform_role_permissions` | `SELECT name FROM sqlite_master WHERE name='platform_role_permissions'` | ❌ Absente |

## 4. TABLEAU RÉCAPITULATIF

| Élément | Existe | Observations |
|---------|--------|--------------|
| Table `_migrations` | ✅ OUI | Table de tracking des migrations |
| Migration 037 enregistrée | ✅ OUI | `037_add_platform_roles.sql` le 2026-06-22 |
| Table `platform_roles` | **❌ NON** | Devrait être créée par migration 037 |
| Table `platform_permissions` | **❌ NON** | Devrait être créée par migration 037 |
| Table `platform_role_permissions` | **❌ NON** | Devrait être créée par migration 037 |

## 5. CONDITION IDENTIFIÉE

**CAS B — Migration 037 marquée exécutée mais tables absentes.**

### Cause probable

La migration 037 contient des instructions `CREATE TABLE IF NOT EXISTS` et `INSERT OR IGNORE`. Le fait qu'elle soit marquée comme exécutée mais que les tables soient absentes indique un problème dans le moteur de migration runner (`backend/migrations/run.ts` ou `src/server/infra/migrations/runner.ts`).

**Scénarios possibles:**
1. L'exécution de la migration a échoué silencieusement (catch sans rollback du marquage)
2. La migration a été exécutée sur une autre base de données et les enregistrements copiés
3. Le fichier SQL a été modifié après exécution (requêtes devenues invalides)
4. Les tables ont été supprimées manuellement après la migration

## 6. ANALYSE DU MOTEUR DE MIGRATION

**Fichier principal:** `src/server/infra/migrations/runner.ts`  
**Fichier secondaire:** `backend/migrations/run.ts`

Le moteur:
1. Crée la table `_migrations` si elle n'existe pas
2. Lit les fichiers SQL de `backend/migrations/`
3. Vérifie si chaque fichier est déjà dans `_migrations`
4. Si non, exécute le SQL et enregistre le filename
5. Si déjà dans `_migrations`, **saute** l'exécution

**Problème:** Une fois le filename enregistré, le fichier n'est **jamais réexécuté**, même si les tables sont absentes.

## 7. CORRECTION NÉCESSAIRE

**Étape 1 — Supprimer l'enregistrement de la migration 037:**
```sql
DELETE FROM _migrations WHERE filename = '037_add_platform_roles.sql';
```

**Étape 2 — Redémarrer le serveur** pour que le runner exécute la migration au prochain démarrage.

**Alternative:** Exécuter manuellement le SQL:
```bash
sqlite3 data/database.db < backend/migrations/037_add_platform_roles.sql
```

## 8. CONCLUSION

```
Migration 037 marquée exécutée  🠊  Tables inexistantes
          ✅                            ❌
                ↓
    Problème: runner enregistre le filename
    même si l'exécution SQL échoue
                ↓
    Solution: DELETE FROM _migrations WHERE filename='037_add_platform_roles.sql'
              puis redémarrer le serveur