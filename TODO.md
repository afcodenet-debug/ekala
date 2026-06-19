# Plan de Synchronisation Bidirectionnelle Complète

## Problèmes Identifiés

1. **3 systèmes de sync concurrents** (src/sync/ moderne, supabase-sync.service legacy, supabase-pull-sync.service)
2. **Tables manquantes** dans le moteur moderne : customers, expenses, inventory_movements, suppliers, purchase_orders, stock_adjustments
3. **Pas d'outbox** pour les tables opérationnelles (expenses, inventory, etc.)
4. **Pas de pull orchestré** pour toutes les tables
5. **Schéma sync_outbox** ne contient pas tenant_id dans la DDL
6. **Pas de queue dans les stores** pour les tables non-couvertes

## Plan d'Action

### Phase 1: GenericSyncService (service générique pour toutes les tables)
- [x] Créer un service générique pour synchroniser n'importe quelle table
- [x] Ajouter toutes les tables manquantes au sync engine
- [x] Ajouter le pull orchestré pour toutes les tables

### Phase 2: Fixer les dépendances FK
- [ ] Ajouter le mapping FK pour toutes les relations
- [ ] Gérer l'ordre de sync (tenants → users → products → orders → sales)

### Phase 3: Intégrer dans l'orchestrateur
- [ ] Ajouter toutes les tables dans SYNC_ENTITIES
- [ ] Ajouter les méthodes push/pull pour chaque entité manquante

### Phase 4: Outbox dans les stores/services
- [ ] Ajouter sync_outbox dans les stores pour customers, expenses, inventory_movements
- [ ] Ajouter sync_outbox dans les services pour suppliers, purchase_orders, stock_adjustments

### Phase 5: Consolider les sync mechanisms
- [ ] Désactiver/remplacer le legacy sync quand le moderne est actif

### Phase 6: Tests et validation
- [ ] Vérifier que toutes les tables sont bien synchronisées
- [ ] Vérifier les statuts mapping
- [ ] Vérifier les conflits résolus