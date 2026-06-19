-- =============================================================================
-- Migration 026: Make email unique per tenant for users
-- =============================================================================
-- Problème : L'email est unique globalement, ce qui empêche des tenants différents
--            d'avoir le même email. Solution : index unique composite (tenant_id, email)

-- Vérifier les doublons existants pour le même email avec tenant_id différent
DROP TABLE IF EXISTS _email_duplicates_check;
CREATE TEMP TABLE _email_duplicates_check AS
SELECT email, COUNT(DISTINCT tenant_id) as tenant_count
FROM users
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(DISTINCT tenant_id) > 1;

-- Signaler les doublons (mais ne pas échouer)
SELECT COUNT(*) as duplicate_email_count FROM _email_duplicates_check;

-- Supprimer l'ancien index unique global
DROP INDEX IF EXISTS idx_users_email_unique;

-- Créer l'index unique composite (email unique par tenant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_tenant_unique 
ON users(tenant_id, email) 
WHERE email IS NOT NULL;

DROP TABLE _email_duplicates_check;