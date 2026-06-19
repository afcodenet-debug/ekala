-- Migration: Unique constraint on product name and SKU per tenant
-- Date: 2026-06-18
-- Description: Empêche les doublons de nom et SKU pour un même locataire

-- D'abord, nettoyer les doublons existants (garder le plus ancien)
DELETE FROM products 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM products 
  WHERE deleted_at IS NULL 
  GROUP BY tenant_id, name
)
AND deleted_at IS NULL;

-- Supprimer les doublons de SKU (garder le plus ancien)
DELETE FROM products 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM products 
  WHERE sku IS NOT NULL 
    AND sku != '' 
    AND deleted_at IS NULL 
  GROUP BY tenant_id, sku
)
AND sku IS NOT NULL 
  AND sku != '' 
  AND deleted_at IS NULL;

-- Supprimer les anciens index s'ils existent
DROP INDEX IF EXISTS idx_products_tenant_name;
DROP INDEX IF EXISTS idx_products_tenant_sku;

-- Ajouter la contrainte UNIQUE sur (tenant_id, name)
CREATE UNIQUE INDEX idx_products_tenant_name 
ON products(tenant_id, name) 
WHERE deleted_at IS NULL;

-- Ajouter la contrainte UNIQUE sur (tenant_id, sku) pour les SKU non vides
CREATE UNIQUE INDEX idx_products_tenant_sku 
ON products(tenant_id, sku) 
WHERE sku IS NOT NULL AND sku != '' AND deleted_at IS NULL;

-- Message de confirmation
SELECT 'Migration 031: Contraintes d''unicité sur products (name, sku) par tenant appliquées avec succès' AS status;