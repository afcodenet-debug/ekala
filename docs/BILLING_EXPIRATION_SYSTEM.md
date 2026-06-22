# SYSTÈME D'EXPIRATION AUTOMATIQUE DES VOUCHERS

**Date**: 22 Juin 2026  
**Version**: 1.0  
**Statut**: OPÉRATIONNEL

---

## 📋 SOMMAIRE

Ce document décrit le système d'expiration automatique des vouchers pour Ekala. Le système garantit qu'aucun voucher n'est laissé en attente indéfiniment et que les comptes sont automatiquement suspendus après expiration.

---

## 🎯 FONCTIONNEMENT

### Compte à rebours

```
Génération voucher
    ↓
status = pending
    ↓
Compte à rebours: 2 heures
    ↓
┌─────────────────────────────────────┐
│  Admin valide ?                     │
│  - OUI → status = verified          │
│  - NON → continue                   │
└─────────────────────────────────────┘
    ↓
verification_deadline dépassée
    ↓
status = expired
    ↓
Tenant suspendu
Abonnement suspendu
Email envoyé
Historique conservé
```

### États d'un voucher

| Status | Description | Actions possibles |
|--------|-------------|-------------------|
| `pending` | Voucher généré, en attente de paiement | Admin peut vérifier |
| `payment_sent` | Paiement déclaré par l'utilisateur | Admin peut vérifier |
| `verified` | Voucher validé par admin | Aucune |
| `expired` | Délai dépassé (2h) | Aucune |
| `rejected` | Rejeté par admin | Aucune |

---

## 🏗️ ARCHITECTURE

### Composants

#### 1. BillingExpirationService
**Fichier**: `src/server/services/billing-expiration.service.ts`

**Responsabilités**:
- Rechercher les vouchers expirés
- Mettre à jour les statuts
- Suspendre tenants/abonnements
- Envoyer emails de notification
- Logger les événements

**Méthodes principales**:
```typescript
class BillingExpirationService {
  // Traite l'expiration pour un tenant spécifique
  async expireTenantVouchers(tenantId: number): Promise<ExpirationResult>
  
  // Traite l'expiration pour tous les tenants (cron)
  async expireAllVouchers(): Promise<ExpirationResult>
  
  // Vérifie si un voucher est expiré
  async isVoucherExpired(voucherCode: string, tenantId: number): Promise<boolean>
  
  // Calcule le temps restant
  calculateTimeRemaining(verificationDeadline: string): TimeRemaining
}
```

#### 2. VoucherExpirationCron
**Fichier**: `src/server/saas/cron/voucher-expiration.cron.ts`

**Responsabilités**:
- Exécuter le traitement toutes les 5 minutes
- Démarrer au boot du serveur
- Logger les résultats

**Configuration**:
```bash
VOUCHER_EXPIRATION_CRON_ENABLED=true  # Activer/désactiver
```

#### 3. Email Templates
**Fichier**: `src/server/services/email-templates.ts`

**Template**: `buildVoucherExpiredEmail()`

**Contenu**:
- Code voucher
- Date d'expiration
- Message d'explication
- Call-to-action (renouveler)

---

## 🔄 WORKFLOW DÉTAILLÉ

### Étape 1: Génération du voucher

```typescript
// billing.routes.ts - POST /api/billing/request-voucher

const verificationDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h
const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48h

INSERT INTO voucher_requests (
  tenant_id, plan_id, voucher_code,
  verification_deadline, expires_at,
  status = 'pending'
)
```

**Note**: 
- `verification_deadline` = délai de validation admin (24h)
- `expires_at` = délai d'utilisation du code (48h)

### Étape 2: Compte à rebours

**Frontend** (BillingPageV2.tsx):
```typescript
useEffect(() => {
  const updateCountdown = () => {
    const now = new Date().getTime();
    const deadline = new Date(voucher.verification_deadline).getTime();
    const distance = deadline - now;
    
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    
    setTimeRemaining(`${hours}:${minutes}:${seconds}`);
  };
  
  const interval = setInterval(updateCountdown, 1000);
  return () => clearInterval(interval);
}, [voucher?.verification_deadline]);
```

### Étape 3: Vérification admin

```typescript
// admin.subscriptions.ts - POST /api/admin/subscriptions/verify

UPDATE voucher_requests
SET status = 'verified',
    verified_by = <admin_id>,
    verified_at = NOW()
WHERE id = <request_id>
```

### Étape 4: Expiration automatique

```typescript
// billing-expiration.service.ts

// 1. Rechercher les vouchers expirés
SELECT * FROM voucher_requests
WHERE status IN ('pending', 'payment_sent')
  AND verification_deadline < NOW()
  AND tenant_id = <tenant_id>

// 2. Mettre à jour le statut
UPDATE voucher_requests
SET status = 'expired',
    updated_at = NOW()
WHERE id = <voucher_id>

// 3. Suspendre le tenant
UPDATE tenants
SET status = 'suspended',
    updated_at = NOW()
WHERE id = <tenant_id>

// 4. Suspendre l'abonnement
UPDATE subscriptions
SET status = 'suspended',
    updated_at = NOW()
WHERE tenant_id = <tenant_id>
  AND status IN ('active', 'trial', 'pending')

// 5. Envoyer email (best-effort)
sendEmailDirect(
  '[Great Olive] Demande de paiement expirée',
  buildVoucherExpiredEmail(voucher_code, plan, now),
  settings,
  customer_email
)

// 6. Logger
console.log(`[BillingExpiration] Voucher #${id} expiré pour tenant #${tenantId}`)
```

### Étape 5: Cron job

```typescript
// voucher-expiration.cron.ts

// Exécution immédiate au démarrage
run();

// Puis toutes les 5 minutes
_timer = setInterval(run, 5 * 60 * 1000);

// Arrêt propre
export function stopVoucherExpirationCron(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}
```

---

## 📊 LOGS ET MONITORING

### Logs console

**Démarrage**:
```
[VoucherExpirationCron] Started (every 5 minutes)
```

**Exécution normale**:
```
[VoucherExpirationCron] {
  "expired": 3,
  "notificationsSent": 3,
  "errors": []
}
```

**Avec erreurs**:
```
[VoucherExpirationCron] {
  "expired": 2,
  "notificationsSent": 1,
  "errors": [
    "Voucher #45: Database connection timeout",
    "Tenant #123: Email service unavailable"
  ]
}
```

### Métriques à tracker

```typescript
{
  expired: number,           // Nombre de vouchers expirés
  notificationsSent: number, // Emails envoyés
  errors: string[]          // Erreurs rencontrées
}
```

---

## 🧪 TESTS MANUELS

### Test 1: Expiration normale

**Prérequis**:
- Voucher avec `verification_deadline` dans le passé
- Status: `pending` ou `payment_sent`

**Procédure**:
1. Créer un voucher
2. Attendre 2 heures (ou modifier la date en BDD)
3. Attendre le cron (5 min max)
4. Vérifier:
   - ✅ Status = `expired`
   - ✅ Tenant status = `suspended`
   - ✅ Subscription status = `suspended`
   - ✅ Email envoyé

### Test 2: Voucher non expiré

**Prérequis**:
- Voucher avec `verification_deadline` dans le futur

**Procédure**:
1. Lancer le cron manuellement
2. Vérifier:
   - ✅ Status inchangé
   - ✅ Tenant non suspendu

### Test 3: Vérification avant expiration

**Prérequis**:
- Voucher avec `verification_deadline` dans 1 heure

**Procédure**:
1. Admin valide le voucher
2. Vérifier:
   - ✅ Status = `verified`
   - ✅ Cron ne l'expire pas

### Test 4: Gestion d'erreurs

**Prérequis**:
- Supabase déconnecté

**Procédure**:
1. Lancer le cron
2. Vérifier:
   - ✅ Erreur loggée
   - ✅ Serveur ne crash pas
   - ✅ Retry au prochain cycle

---

## 🔧 CONFIGURATION

### Variables d'environnement

```bash
# .env

# Activer/désactiver le cron
VOUCHER_EXPIRATION_CRON_ENABLED=true

# Délai de validation admin (heures)
VOUCHER_VERIFICATION_DEADLINE_HOURS=24

# Délai d'expiration (heures)
VOUCHER_EXPIRATION_HOURS=48

# Intervalle du cron (minutes)
VOUCHER_EXPIRATION_CRON_INTERVAL_MINUTES=5
```

### Modification des délais

**Dans le code**:
```typescript
// billing.routes.ts

const verificationDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h
const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48h
```

**Pour modifier**:
```typescript
const verificationDeadlineHours = parseInt(process.env.VOUCHER_VERIFICATION_DEADLINE_HOURS || '24');
const expiresAtHours = parseInt(process.env.VOUCHER_EXPIRATION_HOURS || '48');

const verificationDeadline = new Date(now.getTime() + verificationDeadlineHours * 60 * 60 * 1000);
const expiresAt = new Date(now.getTime() + expiresAtHours * 60 * 60 * 1000);
```

---

## 🚨 GESTION D'ERREURS

### Erreurs gérées

1. **Supabase non configuré**
   - Log: `Supabase non configuré`
   - Action: Retourner erreur, ne pas crasher

2. **Erreur de sélection**
   - Log: `Erreur sélection: <message>`
   - Action: Continuer, logger l'erreur

3. **Erreur de mise à jour**
   - Log: `Voucher #<id>: <message>`
   - Action: Continuer avec les autres vouchers

4. **Erreur d'email**
   - Log: `Email error for voucher #<id>: <message>`
   - Action: Ne pas bloquer l'expiration

### Stratégie de résilience

```typescript
// Best-effort pour les emails
try {
  await sendEmail(...);
} catch (mailErr) {
  console.error('Email error:', mailErr);
  // Ne pas bloquer l'expiration
}

// Continue malgré les erreurs
for (const voucher of expiredVouchers) {
  try {
    await expireVoucher(voucher);
  } catch (err) {
    result.errors.push(`Voucher #${voucher.id}: ${err.message}`);
    // Continuer avec le suivant
  }
}
```

---

## 📈 MONITORING

### Métriques à surveiller

1. **Taux d'expiration**
   ```
   (vouchers expirés / vouchers générés) × 100
   ```
   - Cible: < 20%
   - Alerte: > 30%

2. **Délai moyen de validation**
   ```
   Temps entre génération et vérification
   ```
   - Cible: < 12h
   - Alerte: > 24h

3. **Taux de notification**
   ```
   (emails envoyés / vouchers expirés) × 100
   ```
   - Cible: 100%
   - Alerte: < 90%

4. **Erreurs cron**
   ```
   Nombre d'erreurs par exécution
   ```
   - Cible: 0
   - Alerte: > 0

### Alertes recommandées

```typescript
// Si > 10 vouchers expirés en une exécution
if (result.expired > 10) {
  sendAlertToAdmin(`⚠️ ${result.expired} vouchers expirés`);
}

// Si taux d'erreur > 50%
if (result.errors.length > result.expired / 2) {
  sendAlertToAdmin(`❌ Taux d'erreur élevé: ${result.errors.length} erreurs`);
}

// Si email échoue
if (result.notificationsSent < result.expired) {
  sendAlertToAdmin(`⚠️ ${result.expired - result.notificationsSent} emails non envoyés`);
}
```

---

## 🔒 SÉCURITÉ

### Historique immuable

**Règle**: Ne jamais supprimer les vouchers expirés

```sql
-- INTERDIT
DELETE FROM voucher_requests WHERE status = 'expired';

-- CORRECT
UPDATE voucher_requests SET status = 'expired' WHERE id = ?;
```

### Audit trail

```typescript
// Logger toutes les expirations
console.log(`[BillingExpiration]`, {
  voucherId: voucher.id,
  voucherCode: voucher.voucher_code,
  tenantId: tenantId,
  expiredAt: now,
  planId: voucher.plan_id,
});
```

### Accès

- Seul le cron peut expirer des vouchers
- Les admins ne peuvent pas modifier un voucher expiré
- Les utilisateurs ne peuvent pas réactiver un voucher expiré

---

## 🚀 DÉPLOIEMENT

### Checklist

- [ ] Variable `VOUCHER_EXPIRATION_CRON_ENABLED=true` définie
- [ ] Table `voucher_requests` existe
- [ ] Colonnes `verification_deadline` et `expires_at` présentes
- [ ] Email template `buildVoucherExpiredEmail` fonctionnel
- [ ] Cron démarré au boot du serveur
- [ ] Logs activés

### Vérification

```bash
# 1. Vérifier que le cron est démarré
grep "VoucherExpirationCron] Started" logs/server.log

# 2. Tester manuellement
curl -X POST http://localhost:3001/api/admin/billing/expire-now

# 3. Vérifier les logs
grep "VoucherExpiration" logs/server.log

# 4. Vérifier les emails
grep "Demande de paiement expirée" logs/email.log
```

---

## 📝 NOTES IMPORTANTES

1. **Compte à rebours**: 2 heures (configurable)
2. **Fréquence cron**: Toutes les 5 minutes
3. **Historique**: Jamais supprimé
4. **Emails**: Best-effort (ne bloque pas l'expiration)
5. **Erreurs**: Loggées mais ne crashent pas le serveur
6. **Rollback**: Impossible (action irréversible)
7. **Notification**: Email envoyé à chaque expiration

---

## 🎯 PROCHAINES ÉTAPES

### Court terme
- [ ] Ajouter alertes admin si > 10 expirations
- [ ] Créer endpoint manuel `/api/admin/billing/expire-now`
- [ ] Ajouter métriques dans dashboard admin

### Moyen terme
- [ ] Implémenter retry pour emails échoués
- [ ] Ajouter webhook `voucher.expired`
- [ ] Créer rapport quotidien d'expiration

### Long terme
- [ ] Machine learning pour prédire les expirations
- [ ] Système de relance avant expiration (1h avant)
- [ ] Analytics: taux de conversion par délai

---

**Système opérationnel et documenté** ✅

**Dernière mise à jour**: 22 Juin 2026