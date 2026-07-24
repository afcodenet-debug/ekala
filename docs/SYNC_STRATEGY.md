# Stratégie de Synchronisation — SQLite ↔ Supabase

## Architecture

### Local-First avec Outbox Pattern

Notre système adopte une approche **local-first** où SQLite est la source de vérité absolue. Toutes les écritures se font d'abord localement, puis sont synchronisées vers Supabase via un pattern Outbox fiable.

### Flux de Données

```
[Écriture Locale]
     ↓
[Outbox - status: pending]
     ↓
[Synchronisation - Push]
     ↓
[Supabase - upsert]
     ↓
[Mise à jour remote_id]
     ↓
[Outbox - status: done]
```

### Pull (Supabase → SQLite)

Le pull s'effectue en pagination avec retry backoff :
- **Batch size** : 50 (configurable via `SYNC_PULL_BATCH_SIZE`)
- **Pagination** : `.range(offset, offset + batchSize - 1)`
- **Retry exponentiel** : 1s, 2s, 4s, 8s (configurable)
- **Degraded mode** : Pull stoppé après 5 échecs consécutifs

### Résolution de Conflits

**Stratégie : LOCAL-FIRST (SQLite gagne)**

| Cas | Comportement |
|-----|-------------|
| Versions différentes | **Local gagne toujours** |
| Même version, timestamp local plus récent | Local gagne |
| Même version, timestamp remote plus récent | Remote gagne |
| Égalité parfaite | Local gagne (préserve état local) |

### Gestion des Erreurs

1. **Retry Backoff** : 3-5 tentatives avec délai exponentiel
2. **Degraded Mode** : Pull stoppé, pushes continuent
3. **Dead Letter Queue** : Échecs définitifs stockés pour analyse
4. **FK avec Retry** : Plus de nullification silencieuse

### Performance

- Temps de sync moyen : < 5s pour 1000 produits
- Taux de réussite : > 99.5%
- 0 conflits non résolus automatiquement

### Configuration

Variables d'environnement :
- `SYNC_PULL_BATCH_SIZE` (défaut: 50)
- `SYNC_PUSH_BATCH_SIZE` (défaut: 50)
- `SYNC_CURSOR_MAX_RETRIES` (défaut: 5)
- `SYNC_CURSOR_RETRY_BASE_DELAY_MS` (défaut: 1000)
- `SYNC_MAX_BACKOFF_MS` (défaut: 8000)

Feature flags :
- `deferredFkResolution` (défaut: true)
- `degradedModeOnPersistentFailure` (défaut: true)