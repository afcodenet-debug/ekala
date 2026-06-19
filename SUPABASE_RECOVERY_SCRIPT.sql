-- ============================================================================
-- SUPABASE RECOVERY SCRIPT - Rétablir l'intégrité tenant/users/tenant_users
-- ============================================================================
-- Ce script répare les problèmes de synchronisation entre les tables
-- tenants, users et tenant_users dopo une réinitialisation complète
-- ============================================================================
-- Author: Mistral Vibe
-- Date: 2026-06-12
-- ============================================================================

BEGIN;

-- ============================================================================
-- ÉTAPE 1: Vérifier et créer les colonnes manquantes
-- ============================================================================

-- Vérifier les colonnes essentielles sur tenants
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'owner_email') THEN
    ALTER TABLE tenants ADD COLUMN owner_email VARCHAR(255);
    RAISE NOTICE 'Ajout de la colonne owner_email à tenants';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'status') THEN
    ALTER TABLE tenants ADD COLUMN status VARCHAR(20) DEFAULT 'active';
    RAISE NOTICE 'Ajout de la colonne status à tenants';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'is_provisioned') THEN
    ALTER TABLE tenants ADD COLUMN is_provisioned BOOLEAN DEFAULT false;
    RAISE NOTICE 'Ajout de la colonne is_provisioned à tenants';
  END IF;
END
$$;

-- Vérifier les colonnes essentielles sur users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tenant_id') THEN
    ALTER TABLE users ADD COLUMN tenant_id BIGINT;
    RAISE NOTICE 'Ajout de la colonne tenant_id à users';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email') THEN
    ALTER TABLE users ADD COLUMN email VARCHAR(255);
    RAISE NOTICE 'Ajout de la colonne email à users';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE 'Ajout de la colonne is_active à users';
  END IF;
END
$$;

-- Vérifier les colonnes essentielles sur tenant_users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_users' AND column_name = 'role') THEN
    ALTER TABLE tenant_users ADD COLUMN role VARCHAR(20) DEFAULT 'staff';
    RAISE NOTICE 'Ajout de la colonne role à tenant_users';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_users' AND column_name = 'is_default') THEN
    ALTER TABLE tenant_users ADD COLUMN is_default BOOLEAN DEFAULT false;
    RAISE NOTICE 'Ajout de la colonne is_default à tenant_users';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_users' AND column_name = 'is_active') THEN
    ALTER TABLE tenant_users ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE 'Ajout de la colonne is_active à tenant_users';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_users' AND column_name = 'joined_at') THEN
    ALTER TABLE tenant_users ADD COLUMN joined_at TIMESTAMPTZ;
    RAISE NOTICE 'Ajout de la colonne joined_at à tenant_users';
  END IF;
END
$$;

-- ============================================================================
-- ÉTAPE 2: Créer les contraintes et index manquants
-- ============================================================================

-- Ajouter les contraintes de clé étrangère si elles n'existent pas
DO $$
BEGIN
  -- Contrainte sur users.tenant_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'users' AND constraint_name = 'fk_users_tenant'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT fk_users_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    RAISE NOTICE 'Ajout de la contrainte fk_users_tenant';
  END IF;
END
$$;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_tenants_owner_email ON tenants(owner_email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_user ON tenant_users(tenant_id, user_id);

-- ============================================================================
-- ÉTAPE 3: RÉCUPÉRATION PRINCIPALE - Identifier et réparer les incohérences
-- ============================================================================

-- 3.1: Identifier les tenants sans owner dans tenant_users
WITH tenants_without_owners AS (
    SELECT t.id as tenant_id, t.owner_email
    FROM tenants t
    LEFT JOIN tenant_users tu ON t.id = tu.tenant_id AND tu.role = 'owner'
    WHERE tu.id IS NULL AND t.owner_email IS NOT NULL
),
-- 3.2: Créer les utilisateurs manquants pour les owners
inserted_users AS (
    INSERT INTO users (email, full_name, username, role, is_active, tenant_id, created_at, updated_at)
    SELECT 
        two.owner_email,
        'Owner ' || t.name,
        'owner_' || COALESCE(t.slug, REPLACE(LOWER(t.name), ' ', '-')),
        'owner',
        true,
        t.id,
        NOW(),
        NOW()
    FROM tenants_without_owners two
    JOIN tenants t ON two.tenant_id = t.id
    WHERE NOT EXISTS (
        SELECT 1 FROM users u WHERE u.email = two.owner_email
    )
    ON CONFLICT (email) DO UPDATE 
        SET full_name = EXCLUDED.full_name,
            username = EXCLUDED.username,
            role = EXCLUDED.role,
            is_active = EXCLUDED.is_active,
            tenant_id = EXCLUDED.tenant_id,
            updated_at = NOW()
    RETURNING id, tenant_id, email
)
-- 3.3: Créer les relations tenant_users manquantes pour les owners
INSERT INTO tenant_users (tenant_id, user_id, role, is_default, is_active, joined_at, created_at, updated_at)
SELECT
    iu.tenant_id,
    u.id,
    'owner',
    true,
    true,
    NOW(),
    NOW(),
    NOW()
FROM inserted_users iu
JOIN users u ON iu.email = u.email AND iu.tenant_id = u.tenant_id
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_users tu 
    WHERE tu.tenant_id = iu.tenant_id AND tu.user_id = u.id
)
ON CONFLICT (tenant_id, user_id) DO UPDATE 
    SET role = EXCLUDED.role,
        is_default = EXCLUDED.is_default,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();

-- 3.4: Pour les tenants SANS owner_email, créer un utilisateur admin par défaut
WITH tenants_without_owner_email AS (
    SELECT t.id, t.name, t.slug
    FROM tenants t
    WHERE t.owner_email IS NULL OR t.owner_email = ''
    AND NOT EXISTS (
        SELECT 1 FROM tenant_users tu 
        WHERE tu.tenant_id = t.id
    )
),
inserted_default_users AS (
    INSERT INTO users (email, full_name, username, role, is_active, tenant_id, created_at, updated_at)
    SELECT
        'admin@' || REPLACE(LOWER(t.name), ' ', '-') || '-tenant-' || t.id || '.local',
        'Admin ' || t.name,
        'admin_' || COALESCE(t.slug, REPLACE(LOWER(t.name), ' ', '-')),
        'admin',
        true,
        t.id,
        NOW(),
        NOW()
    FROM tenants_without_owner_email t
    WHERE NOT EXISTS (
        SELECT 1 FROM users u WHERE u.tenant_id = t.id
    )
    RETURNING id, tenant_id
)
INSERT INTO tenant_users (tenant_id, user_id, role, is_default, is_active, joined_at, created_at, updated_at)
SELECT
    iu.tenant_id,
    u.id,
    'admin',
    true,
    true,
    NOW(),
    NOW(),
    NOW()
FROM inserted_default_users iu
JOIN users u ON iu.id = u.id AND iu.tenant_id = u.tenant_id
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_users tu 
    WHERE tu.tenant_id = iu.tenant_id AND tu.user_id = u.id
)
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- 3.5: S'assurer que TOUS les users d'un tenant ont une entrée tenant_users
WITH users_without_tenant_users AS (
    SELECT u.id as user_id, u.tenant_id
    FROM users u
    WHERE u.tenant_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM tenant_users tu 
        WHERE tu.user_id = u.id AND tu.tenant_id = u.tenant_id
    )
)
INSERT INTO tenant_users (tenant_id, user_id, role, is_default, is_active, joined_at, created_at, updated_at)
SELECT
    u.tenant_id,
    u.user_id,
    'staff',
    false,
    true,
    NOW(),
    NOW(),
    NOW()
FROM users_without_tenant_users u
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- ============================================================================
-- ÉTAPE 4: Mettre à jour les tenant_id manquants dans users
-- ============================================================================

-- 4.1: Pour les users sans tenant_id mais avec des tenant_users, le déduire
UPDATE users u
SET tenant_id = tu.tenant_id
FROM tenant_users tu
WHERE u.id = tu.user_id 
AND u.tenant_id IS NULL
AND tu.tenant_id IS NOT NULL;

-- 4.2: Pour les tenant_users sans role, définir 'staff' par défaut
UPDATE tenant_users 
SET role = 'staff'
WHERE role IS NULL OR role = '';

-- 4.3: Pour les tenant_users sans joined_at, définir maintenant
UPDATE tenant_users 
SET joined_at = NOW()
WHERE joined_at IS NULL;

-- 4.4: S'assurer que chaque tenant a au moins un user avec is_default=true
WITH tenants_without_default AS (
    SELECT t.id
    FROM tenants t
    WHERE NOT EXISTS (
        SELECT 1 FROM tenant_users tu 
        WHERE tu.tenant_id = t.id AND tu.is_default = true
    )
)
UPDATE tenant_users tu
SET is_default = true
WHERE tu.tenant_id IN (SELECT id FROM tenants_without_default)
AND tu.role IN ('owner', 'admin')
AND tu.is_active = true
ORDER BY tu.role DESC  -- Préférer 'owner' puis 'admin'
LIMIT 1;

-- ============================================================================
-- ÉTAPE 5: Nettoyage et correction des données orphelines
-- ============================================================================

-- 5.1: Supprimer les tenant_users avec des références invalides
DELETE FROM tenant_users tu
WHERE NOT EXISTS (
    SELECT 1 FROM tenants t WHERE t.id = tu.tenant_id
) OR NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = tu.user_id
);

-- 5.2: Supprimer les users avec des tenants invalides
DELETE FROM users u
WHERE u.tenant_id IS NOT NULL 
AND NOT EXISTS (
    SELECT 1 FROM tenants t WHERE t.id = u.tenant_id
);

-- ============================================================================
-- ÉTAPE 6: Vérification finale et rapport
-- ============================================================================

-- Créer une vue temporaire pour le rapport
CREATE OR REPLACE VIEW tenant_integrity_report AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.owner_email,
    COUNT(DISTINCT u.id) as user_count,
    COUNT(DISTINCT tu.id) as tenant_user_count,
    COUNT(DISTINCT CASE WHEN tu.role = 'owner' THEN tu.id END) as owner_count,
    COUNT(DISTINCT CASE WHEN tu.is_default = true THEN tu.id END) as default_count,
    bool_and(u.tenant_id = t.id OR u.tenant_id IS NULL) as users_tenant_consistent
FROM tenants t
LEFT JOIN users u ON t.id = u.tenant_id
LEFT JOIN tenant_users tu ON t.id = tu.tenant_id
GROUP BY t.id, t.name, t.owner_email
ORDER BY t.id;

-- Afficher le rapport
SELECT 
    tenant_id,
    tenant_name,
    owner_email,
    user_count,
    tenant_user_count,
    owner_count,
    default_count,
    users_tenant_consistent,
    CASE 
        WHEN tenant_user_count = 0 THEN '❌ CRITICAL: No tenant_users'
        WHEN owner_count = 0 THEN '⚠️  WARNING: No owner'
        WHEN default_count = 0 THEN '⚠️  WARNING: No default user'
        ELSE '✅ OK'
    END as status
FROM tenant_integrity_report
ORDER BY 
    CASE 
        WHEN tenant_user_count = 0 THEN 1
        WHEN owner_count = 0 THEN 2
        WHEN default_count = 0 THEN 3
        ELSE 4
    END,
    tenant_id;

-- ============================================================================
-- ÉTAPE 7: Création des déclencheurs pour maintenir l'intégrité
-- ============================================================================

-- Déclencleur : Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_users_updated_at ON tenant_users;
CREATE TRIGGER update_tenant_users_updated_at
    BEFORE UPDATE ON tenant_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Déclencleur : Vérification de l'intégrité des références
CREATE OR REPLACE FUNCTION check_tenant_user_integrity()
RETURNS TRIGGER AS $$
BEGIN
    -- Vérifier que le tenant existe
    IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = NEW.tenant_id) THEN
        RAISE EXCEPTION 'Tenant % does not exist', NEW.tenant_id;
    END IF;
    
    -- Vérifier que l'utilisateur existe
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id) THEN
        RAISE EXCEPTION 'User % does not exist', NEW.user_id;
    END IF;
    
    -- S'assurer qu'un tenant a au moins un owner
    IF NEW.role = 'owner' THEN
        -- Vérifier s'il y a déjà un owner pour ce tenant
        PERFORM 1 FROM tenant_users 
        WHERE tenant_id = NEW.tenant_id AND role = 'owner' AND id != NEW.id;
        
        -- Si c'est une mise à jour qui supprime le dernier owner, refuser
        IF NOT FOUND AND NEW.role != 'owner' THEN
            RAISE EXCEPTION 'Cannot remove the last owner from tenant %', NEW.tenant_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_users_insert_update ON tenant_users;
CREATE TRIGGER trg_tenant_users_insert_update
    BEFORE INSERT OR UPDATE ON tenant_users
    FOR EACH ROW EXECUTE FUNCTION check_tenant_user_integrity();

-- Déclencleur :_detecter la suppression du dernier owner
CREATE OR REPLACE FUNCTION prevent_last_owner_deletion()
RETURNS TRIGGER AS $$
DECLARE
    remaining_owners INTEGER;
BEGIN
    -- Vérifier combien d'owners restent pour ce tenant
    SELECT COUNT(*) INTO remaining_owners
    FROM tenant_users 
    WHERE tenant_id = OLD.tenant_id AND role = 'owner' AND id != OLD.id;
    
    -- Si c'est le dernier owner, refuser la suppression
    IF remaining_owners = 0 AND OLD.role = 'owner' THEN
        RAISE EXCEPTION 'Cannot delete the last owner of tenant %', OLD.tenant_id;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_users_delete ON tenant_users;
CREATE TRIGGER trg_tenant_users_delete
    BEFORE DELETE ON tenant_users
    FOR EACH ROW EXECUTE FUNCTION prevent_last_owner_deletion();

-- ============================================================================
-- ÉTAPE 8: Configuration des politiques RLS (Row Level Security)
-- ============================================================================

-- Activer RLS sur les tables sensibles
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- Politique :Seulement le service_role peut tout faire
CREATE POLICY "Allow service role full access to tenants"
    ON tenants FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Allow service role full access to users"
    ON users FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Allow service role full access to tenant_users"
    ON tenant_users FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Politique : Les utilisateurs peuvent voir leur propre tenant
CREATE POLICY "Users can view their tenant"
    ON tenants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tenant_users tu
            WHERE tu.tenant_id = tenants.id 
            AND tu.user_id = (auth.jwt() ->> 'sub')::BIGINT
        )
    );

-- Politique : Les utilisateurs peuvent voir leurs propres données
CREATE POLICY "Users can view their own data"
    ON users FOR SELECT
    USING (id = (auth.jwt() ->> 'sub')::BIGINT);

CREATE POLICY "Users can view their tenant users"
    ON tenant_users FOR SELECT
    USING (
        user_id = (auth.jwt() ->> 'sub')::BIGINT
    );

COMMIT;

-- ============================================================================
-- INSTRUCTIONS POUR L'UTILISATEUR
-- ============================================================================
-- 
-- 1. Exécutez ce script dans votre Supabase SQL Editor
-- 2. Vérifiez le rapport final pour confirmer que tous les tenants ont:
--    - Au moins un utilisateur
--    - Au moins un owner
--    - Au moins un utilisateur par défaut (is_default=true)
-- 
-- 3. Si des problèmes persistent, exécutez:
--    SELECT * FROM tenant_integrity_report WHERE status != '✅ OK';
-- 
-- 4. Pour nettoyer la vue temporaire après vérification:
--    DROP VIEW IF EXISTS tenant_integrity_report;
-- 
-- ============================================================================

-- stevenkabwee@gmail.com - Mistral Vibe - 2026-06-12
