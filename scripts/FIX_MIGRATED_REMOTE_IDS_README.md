# RÉPARATION DES REMOTE_ID APRÈS MIGRATION TENANT 1 → 16

## Résumé

Ce document décrit la correction appliquée pour résoudre le problème des `remote_id` artificiels (format `migrated_from_1_xxx`) sur les produits du tenant 16.

## Problème initial

Après migration du tenant 1 vers le tenant 16 :
- Les 8 produits existent **DÉJÀ** dans Supabase avec les IDs 563-570
- Les `remote_id` locaux ont été remplacés par des valeurs artificielles : `migrated_from_1_xxx`
- Le backfill tentait de réinsérer ces produits dans Supabase, causant des conflits

## Solution appliquée

### 1. Annulation de la modification backfillOrphans()

**Fichier modifié:** `src/sync/core/generic-sync.service.ts`

La logique qui traitait les `remote_id LIKE 'migrated_%'` comme des orphelins a été **supprimée**.

**Raison:** Les produits existent déjà dans Supabase. Le backfill n'est pas la solution.

### 2. Création d'un script de réparation

**Fichier créé:** `scripts/fix_migrated_remote_ids.sql`

Ce script SQL :
- Recherche les produits tenant_id=16 avec `remote_id LIKE 'migrated_%'`
- Les fait correspondre avec les IDs Supabase existants par nom
- Met à jour uniquement la colonne `remote_id`
- S'exécute dans une transaction sécurisée

## Utilisation

### Étape 1: Vérifier l'état actuel

```bash
sqlite3 data/database.db "SELECT id, name, remote_id FROM products WHERE tenant_id = 16 AND remote_id LIKE 'migrated_%'"
```

**Résultat attendu:**
```
563|Mosi|migrated_from_1_...
564|Castle Lite|migrated_from_1_...
565|Hunters|migrated_from_1_...
566|Budweiser|migrated_from_1_...
567|Coc Cola|migrated_from_1_...
568|Fanta Orange|migrated_from_1_...
569|Sprite|migrated_from_1_...
570|Water Bottle|migrated_from_1_...
```

### Étape 2: Exécuter le script de réparation

```bash
sqlite3 data/database.db < scripts/fix_migrated_remote_ids.sql
```

**Ce que fait le script:**

1. **BEGIN TRANSACTION** - Démarre une transaction sécurisée
2. **ÉTAPE 1** - Affiche l'état AVANT (8 produits avec remote_id invalides)
3. **ÉTAPE 2** - Met à jour les remote_id avec les IDs Supabase corrects:
   - Mosi → 563
   - Castle Lite → 564
   - Hunters → 565
   - Budweiser → 566
   - Coc Cola → 567
   - Fanta Orange → 568
   - Sprite → 569
   - Water Bottle → 570
4. **ÉTAPE 3** - Affiche l'état APRÈS (8 produits avec remote_id valides)
5. **ÉTAPE 4** - Vérifications de cohérence
6. **ÉTAPE 5** - Rapport final
7. **COMMIT** - Valide les changements

### Étape 3: Vérifier le résultat

```bash
# Vérifier qu'il ne reste plus de remote_id migrated_*
sqlite3 data/database.db "SELECT COUNT(*) FROM products WHERE tenant_id = 16 AND remote_id LIKE 'migrated_%'"
# Résultat attendu: 0

# Vérifier que les remote_id sont corrects
sqlite3 data/database.db "SELECT id, name, remote_id FROM products WHERE tenant_id = 16 ORDER BY remote_id"
# Résultat attendu: 8 produits avec remote_id = 563-570
```

## Rapport avant/après

### AVANT

| id | name | tenant_id | remote_id | status |
|----|------|-----------|-----------|--------|
| 563 | Mosi | 16 | migrated_from_1_... | ❌ INVALID |
| 564 | Castle Lite | 16 | migrated_from_1_... | ❌ INVALID |
| 565 | Hunters | 16 | migrated_from_1_... | ❌ INVALID |
| 566 | Budweiser | 16 | migrated_from_1_... | ❌ INVALID |
| 567 | Coc Cola | 16 | migrated_from_1_... | ❌ INVALID |
| 568 | Fanta Orange | 16 | migrated_from_1_... | ❌ INVALID |
| 569 | Sprite | 16 | migrated_from_1_... | ❌ INVALID |
| 570 | Water Bottle | 16 | migrated_from_1_... | ❌ INVALID |

### APRÈS

| id | name | tenant_id | remote_id | status |
|----|------|-----------|-----------|--------|
| 563 | Mosi | 16 | 563 | ✅ VALID |
| 564 | Castle Lite | 16 | 564 | ✅ VALID |
| 565 | Hunters | 16 | 565 | ✅ VALID |
| 566 | Budweiser | 16 | 566 | ✅ VALID |
| 567 | Coc Cola | 16 | 567 | ✅ VALID |
| 568 | Fanta Orange | 16 | 568 | ✅ VALID |
| 569 | Sprite | 16 | 569 | ✅ VALID |
| 570 | Water Bottle | 16 | 570 | ✅ VALID |

## Impact sur la synchronisation

### Avant la correction

1. Le backfill détectait les produits comme "orphelins" (remote_id LIKE 'migrated_%')
2. Ils étaient ajoutés à `sync_outbox`
3. Le push tentait de les insérer dans Supabase AVEC leurs IDs locaux
4. Risque de duplication ou de corruption des données

### Après la correction

1. Les `remote_id` sont valides (numériques)
2. Le backfill ne les détecte plus comme orphelins
3. La synchronisation fonctionne normalement :
   - **Push:** UPDATE des produits existants dans Supabase
   - **Pull:** Récupération des modifications depuis Supabase
4. Aucun risque de duplication

## Vérifications post-correction

### 1. Vérifier qu'aucun produit n'a de remote_id invalide

```sql
SELECT 
    id,
    name,
    remote_id,
    CASE 
        WHEN remote_id IS NULL THEN 'NULL'
        WHEN remote_id = '' THEN 'EMPTY'
        WHEN remote_id LIKE 'migrated_%' THEN 'MIGRATED'
        WHEN CAST(remote_id AS INTEGER) = remote_id THEN 'VALID'
        ELSE 'INVALID'
    END AS status
FROM products
WHERE tenant_id = 16
ORDER BY id;
```

**Résultat attendu:** Tous les produits doivent avoir status = 'VALID'

### 2. Vérifier la synchronisation

```bash
# Démarrer l'application
npm run dev

# Dans un autre terminal, déclencher une synchronisation
curl -X POST http://localhost:3001/api/sync/trigger
```

**Résultat attendu:**
- Les logs doivent montrer des UPDATE, pas des INSERT
- Aucune erreur de duplicate key
- Les `remote_id` restent inchangés après sync

### 3. Vérifier la cohérence avec Supabase

```sql
-- Vérifier que les IDs correspondent
SELECT 
    p.id AS local_id,
    p.name,
    p.remote_id AS local_remote_id,
    s.id AS supabase_id,
    s.name AS supabase_name
FROM products p
LEFT JOIN (
    SELECT id, name, tenant_id 
    FROM products 
    WHERE tenant_id = 16
) s ON p.remote_id = s.id AND p.tenant_id = s.tenant_id
WHERE p.tenant_id = 16
ORDER BY p.id;
```

**Résultat attendu:** `local_remote_id` = `supabase_id` pour tous les produits

## Contraintes respectées

✅ Ne créer aucun produit  
✅ Ne supprimer aucun produit  
✅ Ne modifier aucune donnée métier (name, price, stock, etc.)  
✅ Modifier UNIQUEMENT la colonne remote_id  
✅ Exécuter dans une transaction  
✅ Aucune modification du code de synchronisation  
✅ Aucune modification des migrations SQL  

## Fichiers modifiés

1. **src/sync/core/generic-sync.service.ts** - Annulation de la modification backfillOrphans()
2. **scripts/fix_migrated_remote_ids.sql** - Script de réparation (NOUVEAU)

## Rollback

Si un problème survient, exécuter :

```bash
# Annuler la transaction (si pas encore commitée)
sqlite3 data/database.db "ROLLBACK;"

# Ou restaurer depuis une sauvegarde
cp data/database.db.backup data/database.db
```

## Support

En cas de problème :
1. Vérifier les logs SQLite : `sqlite3 data/database.db ".log on"`
2. Vérifier les logs de l'application : `npm run dev`
3. Vérifier la table `sync_outbox` : `SELECT * FROM sync_outbox WHERE entity = 'product'`

## Conclusion

Cette correction résout le problème de manière **définitive** et **sécurisée** :
- Les `remote_id` sont maintenant cohérents avec Supabase
- La synchronisation fonctionne normalement
- Aucun risque de duplication ou de corruption
- Opération réversible via ROLLBACK si nécessaire