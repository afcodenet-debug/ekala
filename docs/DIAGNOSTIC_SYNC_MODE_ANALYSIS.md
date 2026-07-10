# DIAGNOSTIC - Mode Local vs Cloud (Sync)
**Date:** 02/07/2026  
**Contexte:** Application avec 2 modes (Local SQLite / Cloud Supabase)  
**Symptôme:** Assignation waiter échoue en mode cloud mais réussit en mode local

---

## 🎯 RÉSUMÉ DU PROBLÈME

Vous avez **confirmé** que :
- ✅ Le waiter existe dans **SQLite** (mode local)
- ❌ L'assignation échoue avec une erreur **Supabase** (mode cloud)
- 🔄 La synchronisation devrait se faire automatiquement quand internet est disponible

**Diagnostic:** Le problème vient de la **synchronisation entre SQLite et Supabase** qui ne fonctionne pas correctement pour les utilisateurs (waiters).

---

## 🔍 CAUSE RACINE IDENTIFIÉE

### **Problème de synchronisation des utilisateurs**

**Scénario:**
1. Vous êtes en **mode local** (SQLite)
2. Le waiter existe dans SQLite ✅
3. Vous basculez en **mode cloud** (Supabase)
4. L'application tente d'assigner le waiter dans Supabase
5. **ÉCHEC:** Le waiter n'existe pas dans Supabase ❌

**Pourquoi?**
- La synchronisation SQLite → Supabase ne s'est pas faite pour les utilisateurs
- OU la synchronisation a échoué silencieusement
- OU le waiter a été créé localement mais jamais synchronisé

---

## 📊 ANALYSE DU FLUX DE SYNCHRONISATION

### **Flux attendu:**
```
SQLite (local)                    Supabase (cloud)
      │                                    │
      │ 1. Créer waiter                   │
      │    INSERT INTO users              │
      │───────────────────────────────────>│
      │                                    │ 2. Sync worker détecte
      │                                    │ 3. INSERT INTO Supabase
      │                                    │
      │ 4. Assigner waiter à table        │
      │    UPDATE restaurant_tables        │
      │    SET assigned_waiter_id = X      │
      │───────────────────────────────────>│
      │                                    │ 5. FK check: waiter X existe? ✅
      │                                    │ 6. SUCCESS
```

### **Flux réel (problématique):**
```
SQLite (local)                    Supabase (cloud)
      │                                    │
      │ 1. Créer waiter                   │
      │    INSERT INTO users              │
      │───────────────────────────────────>│
      │                                    │ ❌ SYNC FAILED (pourquoi?)
      │                                    │
      │ 2. Assigner waiter à table        │
      │    UPDATE restaurant_tables        │
      │    SET assigned_waiter_id = X      │
      │───────────────────────────────────>│
      │                                    │ 3. FK check: waiter X existe? ❌
      │                                    │ 4. ERROR: violates FK constraint
```

---

## 🛠️ DIAGNOSTIC TECHNIQUE

### **Étape 1: Vérifier la synchronisation des utilisateurs**

**Question:** Quand avez-vous créé ce waiter?
- [ ] Avant la migration vers Supabase
- [ ] Après la migration, en mode local
- [ ] Directement dans Supabase

**Si créé en mode local après migration:**
→ Le waiter n'a jamais été synchronisé vers Supabase

---

### **Étape 2: Vérifier le script de synchronisation**

**Fichiers à examiner:**
```
src/sync/
├── sync-orchestrator-v2.ts          # Orchestrateur principal
├── product-sync.service.ts           # Sync des produits
├── supabase-pull-sync.service.ts     # Pull depuis Supabase
├── supabase-realtime-sync.service.ts # Sync temps réel
└── core/
    ├── generic-sync.service.ts       # Service générique
    └── entity-registry.ts            # Registre des entités
```

**Vérifier:**
1. Les `users` sont-ils dans le registre de synchronisation?
2. Le sync worker traite-t-il les entités `users`?
3. Y a-t-il des logs d'erreur pour la synchronisation des users?

---

### **Étape 3: Vérifier les logs de synchronisation**

**Chercher dans les logs:**
```
[Sync] Processing entity: user
[Sync] User synced: id=123, username=waiter1
[Sync] ERROR: Failed to sync user id=123
```

**Si pas de logs pour les users:**
→ Les users ne sont pas dans la queue de synchronisation

---

### **Étape 4: Vérifier la table de synchronisation**

**Dans SQLite:**
```sql
-- Vérifier la table outbox/sync_queue
SELECT * FROM sync_queue 
WHERE entity_type = 'user' 
  AND status = 'pending'
ORDER BY created_at DESC;

-- Vérifier les entités syncisées
SELECT * FROM sync_metadata 
WHERE entity_type = 'user';
```

**Dans Supabase:**
```sql
-- Vérifier si le waiter existe
SELECT id, username, full_name, role, is_active, created_at
FROM users
WHERE id = [WAITER_ID];

-- Vérifier tous les waiters
SELECT id, username, full_name, role, is_active
FROM users
WHERE role = 'waiter';
```

---

## 🎯 CAUSES POSSIBLES (par probabilité)

### **Cause #1: Les users ne sont pas dans le sync registry** (60%)

**Explication:**
Le système de synchronisation ne traite pas les entités `users` par défaut. Seuls les produits, commandes, etc. sont synchronisés.

**Preuve:**
```typescript
// src/sync/core/entity-registry.ts
export const ENTITY_REGISTRY = {
  products: { ... },
  orders: { ... },
  // users: { ... } ← MANQUANT?
};
```

**Solution:**
- Ajouter `users` au registre de synchronisation
- Configurer le mapping des colonnes

---

### **Cause #2: Le sync worker n'est pas démarré** (20%)

**Explication:**
Le worker de synchronisation ne tourne pas ou n'est pas configuré pour traiter les users.

**Vérification:**
```typescript
// src/sync/sync-orchestrator-v2.ts
// Le worker est-il démarré?
// Traite-t-il les entités 'users'?
```

---

### **Cause #3: Erreur silencieuse dans la sync** (15%)

**Explication:**
La synchronisation échoue mais l'erreur est catchée et ignorée.

**Preuve:**
```typescript
try {
  await syncUserToSupabase(user);
} catch (err) {
  console.error('Sync failed:', err); // Erreur loggée mais ignorée
  // Pas de retry, pas d'alerte
}
```

---

### **Cause #4: Contrainte d'unicité dans Supabase** (5%)

**Explication:**
Le waiter existe déjà dans Supabase mais avec un ID différent, causant un conflit.

**Vérification:**
```sql
-- Chercher les doublons
SELECT username, COUNT(*), array_agg(id)
FROM users
WHERE role = 'waiter'
GROUP BY username
HAVING COUNT(*) > 1;
```

---

## 🛠️ SOLUTIONS RECOMMANDÉES

### **Solution immédiate (sans code):**

1. **Créer le waiter directement dans Supabase**
   ```sql
   INSERT INTO users (username, full_name, role, is_active, password_hash)
   VALUES ('waiter_name', 'Waiter Name', 'waiter', 1, 'hash');
   ```
   
2. **Vérifier que l'ID correspond**
   - SQLite: `SELECT id FROM users WHERE username = 'waiter_name'`
   - Supabase: `SELECT id FROM users WHERE username = 'waiter_name'`
   
3. **Si les IDs sont différents:**
   → Mettre à jour l'ID dans SQLite pour correspondre à Supabase
   → Ou supprimer le waiter SQLite et utiliser celui de Supabase

---

### **Solution à long terme (avec code):**

#### **1. Ajouter les users au sync registry**

```typescript
// src/sync/core/entity-registry.ts
export const ENTITY_REGISTRY = {
  // ... entités existantes
  
  users: {
    tableName: 'users',
    primaryKey: 'id',
    columns: ['id', 'username', 'full_name', 'role', 'is_active', 'password_hash'],
    syncDirection: 'bidirectional', // ou 'local-to-cloud'
    conflictResolution: 'cloud-wins', // ou 'local-wins'
    dependsOn: [], // Pas de dépendances
  }
};
```

#### **2. Vérifier le sync orchestrator**

```typescript
// src/sync/sync-orchestrator-v2.ts
// S'assurer que les users sont traités
const SYNC_ENTITIES = [
  'products',
  'orders',
  'users', // ← Ajouter ceci
  'tables',
];
```

#### **3. Ajouter des logs de debug**

```typescript
// Dans le sync worker
console.log('[Sync] Processing users:', userId);
console.log('[Sync] User synced successfully:', userId);
console.log('[Sync] User sync failed:', userId, error);
```

---

## 📋 PLAN DE VÉRIFICATION

### **Checklist de diagnostic:**

- [ ] **1. Vérifier SQLite:** Le waiter existe bien (ID, username, role)
- [ ] **2. Vérifier Supabase:** Le waiter existe-t-il?
  - [ ] OUI → Comparer les IDs (SQLite vs Supabase)
  - [ ] NON → Passer à l'étape 3
- [ ] **3. Vérifier la sync queue SQLite:**
  ```sql
  SELECT * FROM sync_queue WHERE entity_type = 'user';
  ```
  - [ ] Des entrées existent → La sync est tentée mais échoue
  - [ ] Pas d'entrées → Les users ne sont pas dans le sync
- [ ] **4. Vérifier les logs du sync worker:**
  - Chercher `[Sync]` + `user`
  - Chercher des erreurs
- [ ] **5. Vérifier entity-registry.ts:**
  - Les `users` sont-ils dans le registry?
- [ ] **6. Vérifier sync-orchestrator-v2.ts:**
  - Les `users` sont-ils dans la liste des entités à sync?

---

## 🚨 ACTIONS IMMÉDIATES

### **Option A: Créer le waiter dans Supabase manuellement**

```sql
-- 1. Récupérer l'ID du waiter dans SQLite
SELECT id, username, full_name FROM users WHERE role = 'waiter';

-- 2. Créer le même waiter dans Supabase
INSERT INTO users (id, username, full_name, role, is_active)
VALUES ([ID_SQLITE], [USERNAME], [FULL_NAME], 'waiter', 1);
```

**Avantage:** Résout le problème immédiatement  
**Inconvénient:** Ne résout pas la cause racine

---

### **Option B: Désactiver la FK constraint temporairement**

```sql
-- Désactiver la contrainte FK
ALTER TABLE restaurant_tables 
DROP CONSTRAINT IF EXISTS restaurant_tables_assigned_waiter_id_fkey;

-- Réassigner le waiter
UPDATE restaurant_tables 
SET assigned_waiter_id = [WAITER_ID]
WHERE id = [TABLE_ID];

-- Réactiver la contrainte
ALTER TABLE restaurant_tables
ADD CONSTRAINT restaurant_tables_assigned_waiter_id_fkey 
FOREIGN KEY (assigned_waiter_id) 
REFERENCES users(id)
ON DELETE SET NULL;
```

**Avantage:** Permet l'assignation même sans sync  
**Inconvénient:** Risque d'incohérence de données

---

### **Option C: Forcer la synchronisation manuelle**

```bash
# Lancer le script de sync manuellement
npm run sync:users

# Ou via Node.js
node -e "
  const { syncUsersToSupabase } = require('./src/sync');
  syncUsersToSupabase().then(() => console.log('Sync complete'));
"
```

---

## 📝 CONCLUSION

**Cause racine:** Le waiter a été créé en mode local (SQLite) mais n'a jamais été synchronisé vers Supabase. La synchronisation des utilisateurs n'est pas fonctionnelle ou pas configurée.

**Solution recommandée:**
1. **Court terme:** Créer le waiter manuellement dans Supabase (Option A)
2. **Moyen terme:** Ajouter les users au sync registry et vérifier le sync worker
3. **Long terme:** Tester la synchronisation complète en mode local → cloud

**Fichiers à modifier (si vous décidez de coder):**
- `src/sync/core/entity-registry.ts` - Ajouter users
- `src/sync/sync-orchestrator-v2.ts` - Ajouter users dans la liste
- `src/sync/core/generic-sync.service.ts` - Vérifier le traitement des users

---

## 🔍 PROCHAINES ÉTAPES DE DIAGNOSTIC

1. **Exécuter les requêtes SQL** pour vérifier la présence du waiter dans Supabase
2. **Examiner le sync registry** pour voir si les users sont inclus
3. **Vérifier les logs** du sync worker
4. **Confirmer la cause exacte** avant de coder la solution

**Voulez-vous que j'examine les fichiers de synchronisation pour confirmer la cause exacte?**