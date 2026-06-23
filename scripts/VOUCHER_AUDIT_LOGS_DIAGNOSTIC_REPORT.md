# DIAGNOSTIC: ERREUR COLONNE tenant_id MANQUANTE DANS voucher_audit_logs

## Résumé du problème

**Erreur observée:**
```
column voucher_audit_logs.tenant_id does not exist
```

## Schéma SQLite (local)

**Fichier:** `backend/migrations/035_voucher_first_tables.sql` (lignes 42-49)

```sql
CREATE TABLE IF NOT EXISTS voucher_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_request_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_id INTEGER,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Colonnes présentes:**
- `id` ✅
- `voucher_request_id` ✅
- `action` ✅
- `actor_id` ✅
- `notes` ✅
- `created_at` ✅

**Colonnes ABSENTES:**
- `tenant_id` ❌ **ABSENT**
- `updated_at` ❌ **ABSENT**
- `remote_id` ❌ **ABSENT**

## Définition dans entity-registry.ts

**Fichier:** `src/sync/core/entity-registry.ts` (lignes 344-353)

```typescript
{
  entity: 'voucher_audit_log',
  localTable: 'voucher_audit_logs',
  remoteTable: 'voucher_audit_logs',
  syncOrder: 98,
  allowedFields: ['id', 'created_at', 'voucher_request_id', 'action', 'actor_id', 'notes'],
  foreignKeys: { voucher_request_id: 'voucher_requests', actor_id: 'users' },
  hasUpdatedAt: false,
  hasTenantId: false,  // ✅ CORRECT: pas de tenant_id
}
```

**Analyse:**
- `hasTenantId: false` ✅ **CORRECT** - La table n'a pas de tenant_id
- `hasUpdatedAt: false` ✅ **CORRECT** - La table n'a pas de updated_at
- `allowedFields` ne contient pas `tenant_id` ✅ **CORRECT**

## Code de synchronisation (GenericSyncService)

**Fichier:** `src/sync/core/generic-sync.service.ts`

### Méthode pullByEntity (ligne ~700)

```typescript
async pullByEntity(entity: string, tenantId: string): Promise<number> {
  const def = getEntityDef(entity);
  if (!def) return 0;

  const { remoteTable, hasUpdatedAt } = def;
  const cursorKey = hasUpdatedAt ? entity : `${entity}_created`;
  const since = this.cursor.getOrEpoch(cursorKey);

  const tenantIdInt = Number.isFinite(Number(tenantId)) ? parseInt(tenantId, 10) : NaN;
  const tenantIdForQuery = Number.isNaN(tenantIdInt) ? tenantId : tenantIdInt;

  let query = this.supabase.from(remoteTable).select('*');

  if (entity === 'tenant') {
    // Cas spécial: tenant n'a pas de tenant_id
    query = query.gt('updated_at', since).order('updated_at', { ascending: true });
  } else {
    // ❌ PROBLÈME ICI: Toutes les autres entités ont un tenant_id
    query = query.eq('tenant_id', tenantIdForQuery);  // <-- LIGNE 722
    
    if (hasUpdatedAt) {
      query = query.gt('updated_at', since).order('updated_at', { ascending: true });
    } else {
      query = query.gt('created_at', since).order('created_at', { ascending: true });
    }
  }
  // ...
}
```

**Ligne problématique:** 722
```typescript
query = query.eq('tenant_id', tenantIdForQuery);
```

**Condition:** Ce code s'exécute pour toutes les entités SAUF `tenant`.

**Problème:** `voucher_audit_log` n'est pas `tenant`, donc le code ajoute `.eq('tenant_id', tenantId)`.

## Requête Supabase exacte générée

Pour `voucher_audit_log` avec `tenantId = 16`:

```typescript
// Étape 1: Sélection de la table
this.supabase.from('voucher_audit_logs').select('*')

// Étape 2: Ajout du filtre tenant_id (PROBLÈME!)
.eq('tenant_id', 16)

// Étape 3: Ajout du filtre created_at (car hasUpdatedAt = false)
.gt('created_at', '2024-01-01T00:00:00.000Z')
.order('created_at', { ascending: true })
```

**Résultat:** Supabase rejette la requête car la colonne `tenant_id` n'existe pas dans `voucher_audit_logs`.

## Schéma attendu par le code

### Ce que le code GenericSyncService attend:

| Champ | Présent dans SQLite | Présent dans entity-registry | Utilisé dans pullByEntity |
|-------|---------------------|------------------------------|---------------------------|
| `id` | ✅ | ✅ | ✅ |
| `created_at` | ✅ | ✅ | ✅ (cursor) |
| `updated_at` | ❌ | ❌ | ❌ (hasUpdatedAt: false) |
| `tenant_id` | ❌ | ❌ | ❌ (hasTenantId: false) |
| `remote_id` | ❌ | ❌ | ❌ |
| `voucher_request_id` | ✅ | ✅ | ✅ (allowedFields) |
| `action` | ✅ | ✅ | ✅ (allowedFields) |
| `actor_id` | ✅ | ✅ | ✅ (allowedFields) |
| `notes` | ✅ | ✅ | ✅ (allowedFields) |

### Ce que le code fait réellement:

```typescript
// Ligne 722: Ajout systématique de tenant_id pour toutes les entités sauf 'tenant'
if (entity !== 'tenant') {
  query = query.eq('tenant_id', tenantIdForQuery);  // ❌ ERREUR pour voucher_audit_log
}
```

**Bug:** Le code ne vérifie pas `hasTenantId` avant d'ajouter le filtre `tenant_id`.

## Impact métier

### 1. Synchronisation bloquée

**Opération:** Pull de `voucher_audit_logs` depuis Supabase

**Conséquence:**
- ❌ La synchronisation échoue complètement pour cette entité
- ❌ Aucun log d'audit de voucher n'est récupéré depuis Supabase
- ❌ Les logs restent uniquement en local (SQLite)

### 2. Perte de données

**Scénario:**
1. Un voucher est créé sur un tenant A
2. Le log d'audit est créé dans Supabase
3. Le tenant B essaie de se synchroniser
4. Le pull échoue car `tenant_id` n'existe pas

**Conséquence:**
- Les logs d'audit ne sont pas synchronisés entre tenants
- Pas de vue globale des audits de vouchers

### 3. Incohérence multi-tenant

**Problème:**
- SQLite: `voucher_audit_logs` n'a pas de `tenant_id`
- Supabase: `voucher_audit_logs` n'a pas de `tenant_id`
- Code: Essaie de filtrer par `tenant_id` quand même

**Résultat:**
- Les logs sont partagés entre tous les tenants (pas d'isolation)
- Pas de filtrage par tenant dans Supabase

## Solutions possibles

### Option 1: Corriger le code GenericSyncService (RECOMMANDÉ)

**Fichier:** `src/sync/core/generic-sync.service.ts` (ligne 722)

**Modification:**
```typescript
// AVANT (ligne 722)
if (entity !== 'tenant') {
  query = query.eq('tenant_id', tenantIdForQuery);
}

// APRÈS
if (entity !== 'tenant' && def.hasTenantId) {
  query = query.eq('tenant_id', tenantIdForQuery);
}
```

**Impact:**
- ✅ Corrige le bug pour toutes les entités sans tenant_id
- ✅ Respecte le schéma défini dans entity-registry
- ✅ Pas de modification de schéma nécessaire

### Option 2: Ajouter tenant_id à la table (NON RECOMMANDÉ)

**Migration SQL:**
```sql
ALTER TABLE voucher_audit_logs ADD COLUMN tenant_id INTEGER;
```

**Impact:**
- ⚠️ Modifie le schéma existant
- ⚠️ Nécessite une migration de données
- ⚠️ Change la sémantique (logs deviennent par tenant)

### Option 3: Ignorer la synchronisation de voucher_audit_logs

**Modification entity-registry:**
```typescript
{
  entity: 'voucher_audit_log',
  localTable: 'voucher_audit_logs',
  remoteTable: 'voucher_audit_logs',
  syncOrder: 98,
  allowedFields: ['id', 'created_at', 'voucher_request_id', 'action', 'actor_id', 'notes'],
  foreignKeys: { voucher_request_id: 'voucher_requests', actor_id: 'users' },
  hasUpdatedAt: false,
  hasTenantId: false,
  // Ajouter: skipSync: true (nécessite modification du code)
}
```

**Impact:**
- ⚠️ Les logs ne sont plus synchronisés du tout
- ⚠️ Perte de la fonctionnalité de sync

## Vérification du schéma Supabase

### Tables Supabase concernées

D'après les migrations SQL (035_voucher_first_tables.sql):
- `voucher_requests` ✅ a `tenant_id`
- `voucher_audit_logs` ❌ n'a PAS `tenant_id`

### Cohérence SQLite ↔ Supabase

| Table | SQLite a tenant_id | Supabase a tenant_id | Sync OK? |
|-------|-------------------|----------------------|----------|
| `voucher_requests` | ✅ | ✅ | ✅ OUI |
| `voucher_audit_logs` | ❌ | ❌ | ❌ NON (bug code) |

## Conclusion

**Le problème est dans le code, pas dans le schéma:**

1. **Schéma SQLite:** `voucher_audit_logs` n'a PAS de `tenant_id` ✅
2. **Schéma Supabase:** `voucher_audit_logs` n'a PAS de `tenant_id` ✅
3. **entity-registry:** `hasTenantId: false` ✅
4. **Code GenericSyncService:** Ajoute `.eq('tenant_id', ...)` quand même ❌

**Bug identifié:** Ligne 722 de `generic-sync.service.ts` ne vérifie pas `def.hasTenantId` avant d'ajouter le filtre `tenant_id`.

**Solution:** Ajouter la condition `&& def.hasTenantId` à la ligne 722.

**Impact:** Ce bug affecte toutes les entités qui ont `hasTenantId: false` mais ne sont pas `tenant`:
- `voucher_audit_log` (identifié)
- `tenant_user` (ligne 73: `hasTenantId: false`) - **POTENTIELLEMENT AFFECTÉ**
- Autres entités futures sans tenant_id

## Fichiers à modifier (si correction souhaitée)

**Fichier:** `src/sync/core/generic-sync.service.ts`

**Ligne:** 722

**Changement:**
```typescript
// Ligne 720-722
} else {
  query = query.eq('tenant_id', tenantIdForQuery);  // ❌ ACTUEL
}

// Devient:
} else if (def.hasTenantId) {
  query = query.eq('tenant_id', tenantIdForQuery);  // ✅ CORRIGÉ
}
```

**Aucune migration SQL nécessaire.** Le schéma est correct, seul le code est buggé.