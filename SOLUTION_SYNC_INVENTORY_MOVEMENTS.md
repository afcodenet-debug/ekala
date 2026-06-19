# Solution de Synchronisation des Mouvements d'Inventaire

## 📋 Résumé du Problème

**Problème identifié** : Les données de la table `inventory_movements` existent dans la base de données SQLite locale mais sont absentes de l'instance Supabase distante, indiquant une défaillance dans la logique de synchronisation.

### Cause Racine Principale

Le bug critique était situé dans `/src/sync/core/generic-sync.service.ts` à la **ligne 352** :

```typescript
if (targetTable === 'products') {
  if (def.entity === 'inventory_movement') return;  // ❌ CECI ÉTAIT LE BUG
  delete safeUpdate[field];
  continue;
}
```

**Explication** : 
- Quand un mouvement d'inventaire (`inventory_movement`) était synchronisé
- Et qu'il contenait un champ `product_id` (clé étrangère vers `products`)
- Le code vérifiait les clés étrangères
- Si la table cible était `products` ET l'entité était `inventory_movement`
- **Il exécutait un `return` immédiat**, abandonnant TOUTE la synchronisation
- Résultat : Le mouvement d'inventaire n'était JAMAIS synchronisé vers Supabase

### Causes Secondaires

1. **Schéma Supabase incomplet** : La table `inventory_movements` dans Supabase manquait de :
   - La colonne `tenant_id` (nécessaire pour le multi-tenancy)
   - La possibilité d'avoir `product_id` NULL (pour gérer les produits pas encore synchronisés)

2. **Mapping des champs incomplet** : Dans `entity-registry.ts`, la définition de `inventory_movement` ne contenait pas tous les champs nécessaires :
   - `movement_code`
   - `inventory_session_id`
   - `approved_by`

3. **Pas de mécanisme de correction** : Aucun processus pour corriger les mouvements synchronisés avec `product_id` NULL une fois les produits disponibles dans Supabase.

---

## ✅ Solution Implémentée

### 1. Correction du Bug Critique

**Fichier** : `/src/sync/core/generic-sync.service.ts`

**Changement** : Remplacement de la logique défectueuse par une résolution intelligente du `product_id` :

```typescript
if (targetTable === 'products') {
  if (def.entity === 'inventory_movement' && safeUpdate[field] !== undefined) {
    let resolvedProductId = this.getRemoteId(targetTable, safeUpdate[field]);
    
    // Si pas résolu, essayer de récupérer le remote_id depuis la table produits locale
    if (!resolvedProductId) {
      try {
        const localProduct = this.db.prepare(
          `SELECT remote_id FROM products WHERE id = ?`
        ).get(safeUpdate[field]) as any;
        resolvedProductId = localProduct?.remote_id;
      } catch (err) {
        console.warn(`[GenericSync] Could not fetch product remote_id for inventory_movement:`, err);
      }
    }
    
    if (resolvedProductId) {
      safeUpdate[field] = resolvedProductId;
      continue;
    } else {
      // Produit pas encore synchronisé dans Supabase.
      // Maintenant que le schéma Supabase permet product_id NULL,
      // on peut synchroniser le mouvement avec product_id NULL.
      console.warn(`[GenericSync] Product not synced yet, setting product_id to NULL for inventory_movement #${recordId}`);
      delete safeUpdate[field]; // Supprime product_id pour éviter NOT NULL violation
      continue;
    }
  }
  
  delete safeUpdate[field];
  continue;
}
```

### 2. Mise à Jour du Schéma Supabase

**Fichier** : `/supabase_migration.sql`

**Changements** :
- Modifié `product_id BIGINT NOT NULL` → `product_id BIGINT` (permet NULL)
- Changé `ON DELETE CASCADE` → `ON DELETE SET NULL`
- Ajouté `tenant_id INTEGER DEFAULT 1`

```sql
CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,  -- ⭐ Changé
    -- ... autres champs ...
    movement_code TEXT,
    inventory_session_id BIGINT REFERENCES inventory_sessions(id) ON DELETE SET NULL,
    tenant_id INTEGER DEFAULT 1  -- ⭐ Ajouté
);
```

### 3. Mise à Jour du Mapping des Entités

**Fichier** : `/src/sync/core/entity-registry.ts`

**Changements** : Ajout des champs manquants dans la définition de `inventory_movement` :

```typescript
{
  entity: 'inventory_movement',
  localTable: 'inventory_movements',
  remoteTable: 'inventory_movements',
  syncOrder: 55,
  allowedFields: [...ALLOWED_BASE_NO_VERSION, 'product_id', 'movement_type', 
    'quantity_before', 'quantity_changed', 'quantity_after', 'reference_id', 
    'reference_type', 'status', 'notes', 'unit_cost', 'total_value',
    'created_by', 'reason', 'movement_code', 'inventory_session_id', 'approved_by'],  // ⭐ Ajoutés
  foreignKeys: { 
    product_id: 'products', 
    created_by: 'users', 
    approved_by: 'users',  // ⭐ Ajouté
    inventory_session_id: 'inventory_sessions'  // ⭐ Ajouté
  },
  hasUpdatedAt: false,
  hasTenantId: true,
}
```

### 4. Ajout d'un Mécanisme de Correction

**Fichier** : `/src/sync/core/generic-sync.service.ts`

**Nouvelle méthode** : `fixInventoryMovementsProductIds(tenantId: string)`

Cette méthode corrige automatiquement les mouvements d'inventaire qui ont été synchronisés avec `product_id` NULL une fois que les produits correspondants sont disponibles dans Supabase.

**Intégration dans l'orchestrateur** :
```typescript
// Phase 2c: Correction des mouvements d'inventaire avec product_id NULL
try {
  const fixedMovements = await this.genericSync.fixInventoryMovementsProductIds(tenantId);
  if (fixedMovements > 0) console.log(`[SyncV2] Fixed ${fixedMovements} inventory movements with product_id`);
} catch (fixErr: any) {
  console.warn('[SyncV2] Inventory movement product_id fix partial failure:', fixErr?.message);
}
```

### 5. Migration pour les Bases Locales

**Fichier** : `/backend/migrations/022_ensure_inventory_movements_schema.sql`

Garantit que toutes les colonnes nécessaires existent dans la base SQLite locale :
- `tenant_id`
- `movement_code`
- `inventory_session_id`
- `approved_by`
- `remote_id`

---

## 📦 Fichiers Modifiés

| Fichier | Type de Modification | Priorité |
|--------|---------------------|----------|
| `/src/sync/core/generic-sync.service.ts` | Correction du bug critique + logique de résolution | ⭐ CRITIQUE |
| `/supabase_migration.sql` | Schéma Supabase mis à jour | ⭐ CRITIQUE |
| `/src/sync/core/entity-registry.ts` | Mapping des champs complété | ⭐ HAUTE |
| `/src/sync/sync-orchestrator-v2.ts` | Intégration de la correction automatique | ⭐ HAUTE |
| `/backend/migrations/022_ensure_inventory_movements_schema.sql` | Migration SQLite | ⭐ MOYENNE |

### Fichiers Créés

| Fichier | Description |
|--------|-------------|
| `/backend/migrations/supabase/001_allow_inventory_movements_product_id_null.sql` | Migration Supabase pour permettre NULL |
| `/backend/migrations/supabase/002_backfill_inventory_movements_product_ids.sql` | Migration de correction (optionnelle) |

---

## 🚀 Plan de Déploiement

### Phase 1 : Préparation (À faire AVANT le déploiement)

1. **Appliquer la migration Supabase** :
   ```bash
   # Exécuter dans Supabase Dashboard ou via CLI
   psql -h votre-supabase-url -U postgres -d postgres -f supabase_migration.sql
   
   # OU appliquer uniquement les changements nécessaires :
   psql -h votre-supabase-url -U postgres -d postgres -f backend/migrations/supabase/001_allow_inventory_movements_product_id_null.sql
   ```

2. **Vérifier les données existantes** :
   ```sql
   -- Compter les mouvements existants
   SELECT COUNT(*) FROM inventory_movements;
   
   -- Vérifier les mouvements avec product_id NULL (après modification du schéma)
   SELECT COUNT(*) FROM inventory_movements WHERE product_id IS NULL;
   ```

### Phase 2 : Déploiement de l'Application

1. **Arrêter l'application** (si en cours d'exécution)
2. **Sauvegarder la base SQLite locale** :
   ```bash
   cp database.db database.db.backup-$(date +%Y%m%d-%H%M%S).sqlite
   ```
3. **Appliquer la migration locale** :
   ```bash
   # Si vous utilisez le système de migrations automatique, il sera appliqué au démarrage
   # Sinon, exécuter manuellement :
   sqlite3 database.db < backend/migrations/022_ensure_inventory_movements_schema.sql
   ```
4. **Redémarrer l'application**

### Phase 3 : Vérification Post-Déploiement

1. **Vérifier que les mouvements sont synchronisés** :
   ```sql
   -- Dans Supabase
   SELECT COUNT(*) FROM inventory_movements WHERE tenant_id = 5;
   
   -- En local
   SELECT COUNT(*) FROM inventory_movements WHERE tenant_id = 5;
   ```

2. **Vérifier les logs de synchronisation** :
   ```
   # Rechercher dans les logs de l'application :
   grep -i "inventory_movement" /var/log/votre-application.log
   grep -i "Product not synced yet" /var/log/votre-application.log
   grep -i "Fixed inventory_movement" /var/log/votre-application.log
   ```

3. **Vérifier la file de synchronisation** :
   ```sql
   -- Dans SQLite locale
   SELECT COUNT(*) FROM sync_outbox WHERE entity = 'inventory_movement' AND status = 'failed';
   SELECT COUNT(*) FROM sync_outbox WHERE entity = 'inventory_movement' AND status = 'done';
   ```

### Phase 4 : Correction des Données Existantes (Optionnel)

Si vous avez des mouvements d'inventaire existants qui n'ont pas été synchronisés :

1. **Forcer une synchronisation complète** :
   ```typescript
   // Dans le code ou via un endpoint admin
   await orchestrator.forceFullBackfill();
   await orchestrator.triggerSync();
   ```

2. **Vérifier l'intégrité** :
   ```typescript
   // Vérifier les mouvements non synchronisés
   const pending = db.prepare(`
     SELECT COUNT(*) as count FROM sync_outbox 
     WHERE entity = 'inventory_movement' AND status IN ('pending', 'failed')
   `).get() as { count: number };
   ```

---

## 🛡️ Gestion des Cas Limites

### 1. Interruptions Réseau

La solution implémente déjà :
- **File d'attente persistante** (`sync_outbox`) avec statut `pending`/`in_progress`/`failed`
- **Mécanisme de réessai** : 5 tentatives avant archivage dans la DLQ
- **Récupération automatique** : Les éléments `in_progress` sont remis à `pending` au démarrage

### 2. Écritures Partielles

La solution gère :
- **Atomicité** : Les synchronisations sont faites dans des transactions
- **Vérification d'intégrité** : `ensureIntegrity()` vérifie et corrige les incohérences
- **Dead Letter Queue** : Les éléments qui échouent après 5 tentatives sont archivés pour analyse

### 3. Conflits de Synchronisation

Le système inclut :
- **Résolution de conflits** via `ConflictResolver`
- **Curseurs persistants** pour éviter les doublons
- **Mapping des IDs** via la colonne `remote_id`

---

## 📊 Métriques de Succès

| Métrique | Objectif | Méthode de Vérification |
|---------|---------|----------------------|
| Tous les mouvements locaux sont dans Supabase | 100% | Comparer les comptes SQLite ↔ Supabase |
| Aucun mouvement avec `product_id` NULL (après correction) | 0 | `SELECT COUNT(*) FROM inventory_movements WHERE product_id IS NULL` |
| Aucun élément en échec dans `sync_outbox` | 0 | `SELECT COUNT(*) FROM sync_outbox WHERE entity = 'inventory_movement' AND status = 'failed'` |
| Latence de synchronisation | < 30 secondes | Mesurer le temps entre création locale et apparition dans Supabase |

---

## 🔧 Dépannage

### Problème : Les mouvements ne sont toujours pas synchronisés

**Diagnostic** :
1. Vérifier les logs pour les erreurs :
   ```
   grep -i "inventory_movement" /var/log/votre-app.log
   ```

2. Vérifier la file de synchronisation :
   ```sql
   SELECT * FROM sync_outbox 
   WHERE entity = 'inventory_movement' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

3. Vérifier les erreurs spécifiques :
   ```sql
   SELECT last_error FROM sync_outbox 
   WHERE entity = 'inventory_movement' AND status = 'failed' 
   LIMIT 10;
   ```

**Solutions possibles** :
- Redémarrer l'application pour relancer la synchronisation
- Forcer une synchronisation manuelle via l'endpoint admin
- Vérifier que la colonne `tenant_id` est correctement remplie dans les mouvements locaux

### Problème : Les mouvements ont `product_id` NULL dans Supabase

**Diagnostic** :
```sql
SELECT COUNT(*) FROM inventory_movements WHERE product_id IS NULL;
```

**Solution** :
1. Attendre que la correction automatique (Phase 2c) s'exécute
2. Forcer manuellement la correction :
   ```typescript
   await genericSyncService.fixInventoryMovementsProductIds('5');
   ```

---

## ✨ Bonnes Pratiques Implémentées

✅ **Atomicité** : Utilisation de transactions pour les opérations critiques  
✅ **Résilience** : Mécanismes de réessai et file d'attente persistante  
✅ **Idempotence** : Les opérations de synchronisation peuvent être relancées sans effets secondaires  
✅ **Observabilité** : Logs détaillés pour le suivi et le dépannage  
✅ **Gestion des erreurs** : Dead Letter Queue pour les échecs persistants  
✅ **Ordre de synchronisation** : Respect des dépendances entre entités (produits avant mouvements)  
✅ **Multi-tenancy** : Support complet du `tenant_id` pour l'isolation des données  
✅ **Migration progressive** : Schéma compatible avec les versions précédentes  

---

## 📝 Historique des Modifications

| Date | Version | Modification | Auteur |
|------|---------|-------------|--------|
| 2026-06-19 | 1.0 | Audit initial et identification du bug | Mistral Vibe |
| 2026-06-19 | 1.1 | Correction du bug critique (ligne 352) | Mistral Vibe |
| 2026-06-19 | 1.2 | Mise à jour du schéma Supabase | Mistral Vibe |
| 2026-06-19 | 1.3 | Mise à jour du mapping des entités | Mistral Vibe |
| 2026-06-19 | 1.4 | Ajout du mécanisme de correction | Mistral Vibe |
| 2026-06-19 | 1.5 | Intégration dans l'orchestrateur | Mistral Vibe |

---

## 🎯 Prochaines Étapes Recommandées

1. **Tester en environnement de staging** avec une copie des données de production
2. **Monitorer les logs** pendant 24-48 heures après le déploiement
3. **Vérifier les métriques** de synchronisation régulièrement
4. **Planifier une migration** pour corriger les données historiques si nécessaire
5. **Documenter** le processus de synchronisation pour les nouveaux développeurs

---

## 📞 Support

Pour toute question ou problème concernant cette solution, contactez l'équipe technique avec :
- Les logs d'erreur pertinents
- Le résultat des requêtes de diagnostic
- Les étapes de reproduction (si applicable)

---

*Document généré par Mistral Vibe - Solution professionnelle de synchronisation distribuée*
