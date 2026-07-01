-- Migration pour corriger la contrainte d'unicité sur categories
-- Permettre à différents tenants d'avoir des catégories avec le même nom

-- 1. Supprimer l'ancienne contrainte sur name seul
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;

-- 2. Ajouter la nouvelle contrainte sur (tenant_id, name)
ALTER TABLE public.categories ADD CONSTRAINT categories_tenant_name_unique UNIQUE (tenant_id, name);

-- 3. Créer un index composite pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_categories_tenant_name ON public.categories USING btree (tenant_id, name);

-- 4. Vérification
-- Cette requête doit retourner 0 ligne (pas de doublons tenant_id + name)
-- SELECT tenant_id, name, COUNT(*) 
-- FROM categories 
-- GROUP BY tenant_id, name 
-- HAVING COUNT(*) > 1;