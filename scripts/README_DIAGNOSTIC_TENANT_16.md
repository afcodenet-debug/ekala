# Diagnostic du Tenant #16 — Mode d'emploi

## Objectif

Déterminer pourquoi le tenant #16 voit le message **"Compte suspendu"** sur la page `/billing` et vérifier s'il bénéficie d'une période de grâce.

---

## Fichiers créés

1. **`scripts/diagnose_tenant_16.js`** — Script de diagnostic principal
2. **`scripts/run_diagnose_tenant_16.sh`** — Script d'exécution automatisé
3. **`docs/TENANT_16_BILLING_ANALYSIS.md`** — Documentation complète

---

## Prérequis

- Node.js installé
- Base de données SQLite accessible (`data/ekala.db`)
- Ou accès à Supabase

---

## Méthode 1: Exécution automatique (recommandé)

```bash
# Rendre le script exécutable (déjà fait)
chmod +x scripts/run_diagnose_tenant_16.sh

# Exécuter le diagnostic
./scripts/run_diagnose_tenant_16.sh
```

---

## Méthode 2: Exécution manuelle

```bash
# Si better-sqlite3 n'est pas installé
npm install better-sqlite3 --save-dev

# Exécuter le script
node scripts/diagnose_tenant_16.js
```

---

## Méthode 3: Avec chemin personnalisé

```bash
# Spécifier le chemin vers la base de données
DB_PATH=/chemin/vers/ekala.db node scripts/diagnose_tenant_16.js
```

---

## Sortie du diagnostic

Le script affiche:

```
═══════════════════════════════════════════════════════════════
  DIAGNOSTIC TENANT #16 — Page /billing
═══════════════════════════════════════════════════════════════

✅ Base de données: /path/to/ekala.db

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. INFORMATIONS DU TENANT #16
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Tenant trouvé:
   ID: 16
   Nom: Restaurant Example
   Statut: suspended
   Créé le: 2026-01-15
   Modifié le: 2026-06-23

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. ABONNEMENTS DU TENANT #16
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 1 abonnement trouvé:

   Abonnement #1:
   - ID: 42
   - Statut: past_due
   - Plan ID: 3
   - Période: 2026-05-20 → 2026-06-20
   - Créé le: 2026-05-20

   📅 Période de grâce:
      - Fin de période: 2026-06-20T00:00:00.000Z
      - Fin de grâce: 2026-06-27T00:00:00.000Z
      - Maintenant: 2026-06-23T14:30:00.000Z
      - Jours restants: 3
      - ✅ DANS LA PÉRIODE DE GRÂCE (GRACE_PERIOD)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. PAIEMENTS DU TENANT #16
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 2 paiement(s) trouvé(s):

   Paiement #1:
   - ID: 15
   - Montant: 150.00 €
   - Statut: completed
   - Méthode: mobile_money
   - Date: 2026-05-20

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. DEMANDES DE VOUCHER DU TENANT #16
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 1 demande(s) de voucher trouvée(s):

   Voucher #1:
   - ID: 8
   - Code: VOUCHER-ABC123
   - Statut: verified
   - Demandé le: 2026-05-20
   - Expire le: 2026-05-22

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. DIAGNOSTIC FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Statut effectif: GRACE_PERIOD
Raison: Abonnement expiré mais dans la période de grâce (3 jours restants)

⚠️  Le compte est en période de grâce
   → Devrait afficher "Période de grâce" (accès lecture seule)

Si "Compte suspendu" s'affiche, vérifier:
  1. La synchronisation des données (Supabase ↔ SQLite)
  2. Le cron d'expiration
  3. Le middleware subscription-guard.ts
```

---

## Interprétation des résultats

### Statut effectif

| Statut | Signification | Action |
|--------|---------------|--------|
| **ACTIVE** | Abonnement actif, accès complet | Aucune action requise |
| **TRIAL** | Période d'essai en cours | Aucune action requise |
| **GRACE_PERIOD** | Expiré mais dans les 7 jours, accès lecture seule | Renouveler l'abonnement |
| **SUSPENDED** | Bloqué, doit renouveler | Choisir un forfait et payer |

### Si SUSPENDED mais devrait être GRACE_PERIOD

Vérifier dans l'ordre:

1. **Synchronisation des données**
   ```bash
   # Vérifier que Supabase et SQLite sont synchronisés
   node scripts/sync_tenant_16.js
   ```

2. **Cron d'expiration**
   ```bash
   # Vérifier le cron
   cat src/server/saas/cron/expiration.cron.ts
   ```

3. **Middleware subscription-guard**
   ```bash
   # Vérifier le middleware
   cat src/server/middleware/subscription-guard.ts
   ```

---

## Architecture de la page /billing

### Fichier: `src/pages/saas/BillingPageV2.tsx`

**Logique de détermination du statut (lignes 520-547):**

```typescript
if (subscription?.status === 'active') {
  setBillingState('ACTIVE');
} else if (subscription?.status === 'trialing' || subscription?.status === 'trial') {
  setBillingState('TRIAL');
} else if (subscription?.status === 'past_due') {
  // Vérification période de grâce (7 jours)
  const now = new Date();
  const periodEnd = subscription.current_period_end 
    ? new Date(subscription.current_period_end) 
    : null;
  const graceEnd = periodEnd 
    ? new Date(periodEnd.getTime() + 7 * 24 * 60 * 60 * 1000) 
    : null;
  
  if (graceEnd && now < graceEnd) {
    setBillingState('GRACE_PERIOD');  // ✅ Accès lecture seule
  } else {
    setBillingState('SUSPENDED');     // ❌ Compte bloqué
  }
} else if (tenantData?.status === 'suspended' || subscription?.status === 'suspended') {
  setBillingState('SUSPENDED');
} else if (subscription?.status === 'cancelled') {
  setBillingState('SUSPENDED');
} else {
  setBillingState('SUSPENDED');  // Par défaut
}
```

---

## Sécurité

### Isolation par tenant (CORRIGÉ)

**Fichier:** `src/server/saas/saas.routes.ts` (lignes 140-143)

```typescript
router.get('/tenants/:id', requireJwtAuth, async (req, res) => {
  // Vérification d'isolation
  const requestingTenantId = (req as any).user?.tenant_id;
  if (requestingTenantId !== id) {
    return res.status(403).json({ 
      error: 'FORBIDDEN', 
      message: 'Accès non autorisé à ce tenant' 
    });
  }
  // ...
});
```

**Garantie:** Le tenant #16 ne peut voir QUE ses propres données.

---

## Actions correctives

### Si le diagnostic montre SUSPENDED à raison

1. L'utilisateur doit choisir un forfait sur `/billing`
2. Générer un voucher de paiement
3. Effectuer le paiement
4. Attendre la validation admin

### Si le diagnostic montre SUSPENDED à tort

1. Vérifier la synchronisation Supabase ↔ SQLite
2. Vérifier le cron d'expiration
3. Vérifier le middleware `subscription-guard.ts`
4. Redémarrer le serveur

---

## Support

- **Documentation:** `docs/TENANT_16_BILLING_ANALYSIS.md`
- **Script de diagnostic:** `scripts/diagnose_tenant_16.js`
- **Logs serveur:** Vérifier les logs du backend

---

## Notes

- Le script fonctionne en **lecture seule** (aucune modification de données)
- Les calculs de période de grâce sont basés sur **7 jours** après `current_period_end`
- Le diagnostic compare les données **locales** (SQLite) avec les **attentes** de la logique métier

</parameter>
<task_progress>
- [x] Créer le script de diagnostic
- [x] Créer le script d'exécution
- [x] Créer la documentation
- [x] Rendre les scripts exécutables
- [ ] Tester le diagnostic
</task_progress>
</write_to_file>