# Résolution de Conflits — Stratégie Local-First

## Principe Fondamental

**SQLite est la source de vérité absolue.** Toutes les décisions de résolution de conflits favorisent l'état local.

## Algorithmes

### 1. Last-Write-Wins (LWW) — Versionné

```typescript
function resolveLWW(local: Record, remote: Record) {
  // 1. Comparer les versions
  if (local.version !== remote.version) {
    // Différence de version → local gagne TOUJOURS
    return { winner: 'local', resolved: local };
  }
  
  // 2. Même version → comparer les timestamps
  if (local.updated_at > remote.updated_at) {
    return { winner: 'local', resolved: local };
  }
  
  if (remote.updated_at > local.updated_at) {
    return { winner: 'remote', resolved: remote };
  }
  
  // 3. Égalité parfaite → local gagne
  return { winner: 'local', resolved: local };
}
```

### 2. Field Merge (Alternatif)

Pour certains champs spécifiques, on peut fusionner :
- `notes` : concaténer les deux
- `tags` : union des deux ensembles
- `quantities` : additionner (pour les stocks)

## Exemples Concrets

### Scénario 1 : Version Gap
```
Local:  { id: '1', version: 5, name: 'MacBook Pro' }
Remote: { id: '1', version: 2, name: 'MacBook Air' }

→ Gagnant: LOCAL → name = 'MacBook Pro'
```

### Scénario 2 : Même Version, Timestamp Différent
```
Local:  { id: '1', version: 3, updated_at: '2026-07-24T10:00:00Z', price: 1500 }
Remote: { id: '1', version: 3, updated_at: '2026-07-24T09:00:00Z', price: 1400 }

→ Gagnant: LOCAL → price = 1500
```

### Scénario 3 : Remote Plus Récent
```
Local:  { id: '1', version: 3, updated_at: '2026-07-24T09:00:00Z', stock: 5 }
Remote: { id: '1', version: 3, updated_at: '2026-07-24T10:00:00Z', stock: 10 }

→ Gagnant: REMOTE → stock = 10
```

## Logging des Conflits

Tous les conflits sont loggés dans la table `sync_conflicts` :

```json
{
  "entity": "products",
  "local_id": "123",
  "remote_id": "abc-456",
  "field": "price",
  "local_value": "1500",
  "remote_value": "1400",
  "winner": "local",
  "resolved_at": "2026-07-24T10:05:00Z"
}
```

## Gestion des Soft Deletes

- **Supabase delete → SQLite** : marquer `is_available = false`, `deleted_at`
- **SQLite delete → Supabase** : soft delete avec `status = 'archived'`
- **Conflit** : local gagne (restaure l'élément si local est actif)

## Guide de Débogage

1. Vérifier les logs de conflit
2. Examiner la table `sync_conflicts`
3. Vérifier l'état des curseurs
4. Si mode degraded, consulter `sync_degraded_mode`
5. Vérifier les retry dans les logs

## Limitations

- La stratégie LOCAL-FIRST peut écraser des modifications distantes valides
- Utiliser Field Merge pour les champs non conflictuels
- Notification utilisateur recommandée pour les conflits majeurs