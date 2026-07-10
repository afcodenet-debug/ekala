# DIAGNOSTIC - Erreur Assignation Waiter
**Date:** 02/07/2026  
**Symptôme:** Impossible d'assigner un waiter à une table  
**Erreur:** `violates foreign key constraint "restaurant_tables_assigned_waiter_id_fkey"`

---

## 📋 RÉSUMÉ DU PROBLÈME

L'assignation d'un waiter à une table échoue avec une **violation de contrainte de clé étrangère** (foreign key constraint) sur la colonne `assigned_waiter_id` de la table `restaurant_tables`.

---

## 🔍 CAUSES IDENTIFIÉES

### **Cause #1: Waiter inexistant dans la table `users` (PLUS PROBABLE)**

**Explication:**
La contrainte FK `restaurant_tables_assigned_waiter_id_fkey` vérifie que la valeur de `assigned_waiter_id` existe dans la table `users` (ou la table référencée par cette FK).

**Scénarios possibles:**
1. **Waiter supprimé:** Le waiter sélectionné a été supprimé de la table `users` entre temps
2. **Données désynchronisées:** Le frontend affiche des waiters qui n'existent plus en DB
3. **Problème de permissions RLS:** La policy Supabase bloque l'accès au waiter

**Preuve:**
```
Erreur Supabase: insert or update on table "restaurant_tables" 
violates foreign key constraint "restaurant_tables_assigned_waiter_id_fkey"
```

---

### **Cause #2: Waiter ID invalide (NULL ou 0)**

**Explication:**
Si `waiterId` est `null`, la contrainte FK peut être violée si la colonne est définie comme `NOT NULL` dans Supabase.

**Code concerné:**
```typescript
// AssignWaiterModal.tsx ligne 67
const waiterId = selectedWaiterId ? Number(selectedWaiterId) : null;
await assignWaiter(tableId, waiterId);
```

**Problème potentiel:**
- Si `selectedWaiterId` est une chaîne vide `""`, `Number("")` retourne `0`
- `0` n'existe pas dans la table `users` → violation FK

---

### **Cause #3: Contrainte FK mal configurée**

**Explication:**
La contrainte FK dans Supabase pourrait être mal configurée:
- Référence vers la mauvaise table
- Colonne référencée incorrecte
- `ON DELETE` action mal définie

**Vérification nécessaire:**
```sql
-- Vérifier la contrainte FK
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'restaurant_tables'
  AND kcu.column_name = 'assigned_waiter_id';
```

---

### **Cause #4: Problème de synchronisation Supabase**

**Explication:**
Si l'application utilise à la fois SQLite local et Supabase, il peut y avoir une désynchronisation:
- Le waiter existe en local mais pas sur Supabase
- Le waiter a été créé localement mais pas synchronisé

**Contexte du projet:**
Le projet semble avoir une architecture hybride SQLite + Supabase avec synchronisation bidirectionnelle.

---

## 🛠️ DIAGNOSTIC RECOMMANDÉ

### **Étape 1: Vérifier le waiter ID dans la console**

Ajouter temporairement dans `AssignWaiterModal.tsx` (ligne 66):

```typescript
console.log('[DEBUG] Assigning waiter:', {
  tableId,
  waiterId,
  selectedWaiterId,
  isValid: waiterId && waiterId > 0
});
```

**Vérifier:**
- `waiterId` est bien un nombre valide (> 0)
- `selectedWaiterId` n'est pas une chaîne vide

---

### **Étape 2: Vérifier l'existence du waiter dans Supabase**

Exécuter cette requête SQL dans Supabase:

```sql
-- Vérifier si le waiter existe
SELECT id, username, full_name, role, is_active
FROM users
WHERE id = [WAITER_ID]; -- Remplacer par le waiterId de la console

-- Vérifier tous les waiters actifs
SELECT id, username, full_name, role, is_active
FROM users
WHERE role = 'waiter' 
  AND is_active != 0;
```

**Résultat attendu:**
- Le waiter doit exister dans la table `users`
- `is_active` doit être différent de 0

---

### **Étape 3: Vérifier la contrainte FK**

```sql
-- Vérifier la définition de la contrainte
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'restaurant_tables'
  AND c.conname LIKE '%assigned_waiter_id%';
```

**Vérifier:**
- La contrainte référence bien `users(id)`
- `ON DELETE` action est `SET NULL` ou `RESTRICT`
- La colonne `assigned_waiter_id` accepte `NULL`

---

### **Étape 4: Vérifier les policies RLS Supabase**

```sql
-- Vérifier les policies sur restaurant_tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'restaurant_tables';

-- Vérifier les policies sur users
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users';
```

**Vérifier:**
- La policy permet l'UPDATE sur `restaurant_tables`
- La policy permet la lecture des `users` avec `role = 'waiter'`

---

### **Étape 5: Tester l'assignation directement dans Supabase**

```sql
-- Test manuel de l'assignation
UPDATE restaurant_tables 
SET assigned_waiter_id = [WAITER_ID]
WHERE id = [TABLE_ID];

-- Si ça échoue, vérifier les données
SELECT * FROM restaurant_tables WHERE id = [TABLE_ID];
SELECT * FROM users WHERE id = [WAITER_ID];
```

---

## 🎯 SOLUTIONS SELON LA CAUSE

### **Si Cause #1 (Waiter inexistant):**

**Solution temporaire (frontend):**
```typescript
// AssignWaiterModal.tsx - Ajouter une validation
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!tableId) return;

  const waiterId = selectedWaiterId ? Number(selectedWaiterId) : null;
  
  // Validation: vérifier que le waiter existe toujours
  if (waiterId) {
    const waiterExists = waiters.some(w => w.id === waiterId);
    if (!waiterExists) {
      setError('Ce waiter n\'existe plus. Veuillez recharger la liste.');
      await fetchWaiters(); // Re-fetch les waiters
      return;
    }
  }

  setIsLoading(true);
  setError(null);

  try {
    await assignWaiter(tableId, waiterId);
    onSuccess();
  } catch (err: any) {
    setError(err.message || t('tables.failedAssignWaiter'));
  } finally {
    setIsLoading(false);
  }
};
```

**Solution permanente (backend):**
- Ajouter un trigger de vérification avant UPDATE
- Ou modifier la contrainte FK avec `ON DELETE SET NULL`

---

### **Si Cause #2 (Waiter ID invalide):**

**Solution:**
```typescript
// AssignWaiterModal.tsx ligne 67
const waiterId = selectedWaiterId ? Number(selectedWaiterId) : null;

// Ajouter cette validation
if (selectedWaiterId && (!waiterId || waiterId <= 0)) {
  setError('ID de waiter invalide');
  return;
}
```

---

### **Si Cause #3 (Contrainte FK mal configurée):**

**Solution SQL:**
```sql
-- Supprimer et recréer la contrainte
ALTER TABLE restaurant_tables 
DROP CONSTRAINT IF EXISTS restaurant_tables_assigned_waiter_id_fkey;

ALTER TABLE restaurant_tables
ADD CONSTRAINT restaurant_tables_assigned_waiter_id_fkey 
FOREIGN KEY (assigned_waiter_id) 
REFERENCES users(id)
ON DELETE SET NULL;
```

---

### **Si Cause #4 (Désynchronisation):**

**Solution:**
- Vérifier le script de synchronisation
- Ajouter un mécanisme de vérification avant assignation
- Synchroniser les waiters avant d'ouvrir le modal

---

## 📊 TESTS DE VALIDATION

### **Test 1: Assignation avec waiter valide**
1. Ouvrir le modal d'assignation
2. Sélectionner un waiter existant
3. Confirmer l'assignation
4. **Résultat attendu:** Succès

### **Test 2: Assignation avec waiter supprimé**
1. Supprimer un waiter dans Supabase
2. Ouvrir le modal d'assignation
3. Sélectionner ce waiter (s'il apparaît encore)
4. Confirmer l'assignation
5. **Résultat attendu:** Erreur "Ce waiter n'existe plus"

### **Test 3: Assignation sans waiter (désassignation)**
1. Ouvrir le modal d'assignation
2. Sélectionner "Non assigné"
3. Confirmer
4. **Résultat attendu:** Succès (assigned_waiter_id = NULL)

---

## 🚨 ACTIONS IMMÉDIATES RECOMMANDÉES

1. **Ajouter des logs de debug** dans `AssignWaiterModal.tsx` pour voir le `waiterId` envoyé
2. **Vérifier dans Supabase** que le waiter existe toujours
3. **Vérifier la contrainte FK** dans Supabase
4. **Ajouter une validation** côté frontend avant l'assignation

---

## 📝 CONCLUSION

**Cause la plus probable:** Le waiter sélectionné n'existe pas dans la table `users` de Supabase (supprimé, désactivé, ou jamais synchronisé).

**Solution rapide:** Ajouter une validation frontend pour vérifier l'existence du waiter avant l'assignation, et re-fetch la liste des waiters si nécessaire.

**Solution durable:** Corriger la contrainte FK avec `ON DELETE SET NULL` pour éviter ce type d'erreur à l'avenir.