-- ============================================================================
-- Migration Supabase: Backfill inventory_movements product_id NULL values
-- ============================================================================
-- Cette migration corrige les mouvements d'inventaire qui ont product_id NULL
-- en les associant aux produits correspondants via barcode, sku ou name.
--
-- À exécuter après que tous les produits aient été synchronisés.
-- ============================================================================

-- Créer une fonction temporaire pour corriger les mouvements avec product_id NULL
CREATE OR REPLACE FUNCTION backfill_inventory_movement_product_ids(p_tenant_id INTEGER)
RETURNS VOID AS $$
DECLARE
  movement_record RECORD;
  matching_product RECORD;
BEGIN
  -- Trouver tous les mouvements avec product_id NULL pour ce tenant
  FOR movement_record IN 
    SELECT im.id, im.reason, im.movement_code, im.reference_id, im.reference_type
    FROM inventory_movements im
    WHERE im.product_id IS NULL 
      AND im.tenant_id = p_tenant_id
  LOOP
    -- Essayer de trouver le produit par référence (order_id, sale_id, etc.)
    IF movement_record.reference_type = 'sale' AND movement_record.reference_id IS NOT NULL THEN
      SELECT p.product_id INTO matching_product
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.id = movement_record.reference_id
        AND p.tenant_id = p_tenant_id
      LIMIT 1;
      
      IF matching_product IS NOT NULL THEN
        UPDATE inventory_movements 
        SET product_id = matching_product.product_id
        WHERE id = movement_record.id;
        RAISE NOTICE 'Corrected inventory_movement % with sale reference %', 
          movement_record.id, movement_record.reference_id;
        CONTINUE;
      END IF;
    END IF;
    
    -- Essayer de trouver par mouvement_code qui pourrait contenir le product_id
    IF movement_record.movement_code ~ '^[0-9]+$' THEN
      -- Vérifier si le mouvement_code est en fait un product_id
      SELECT id INTO matching_product
      FROM products 
      WHERE id = movement_record.movement_code::BIGINT
        AND tenant_id = p_tenant_id
      LIMIT 1;
      
      IF matching_product IS NOT NULL THEN
        UPDATE inventory_movements 
        SET product_id = matching_product.id
        WHERE id = movement_record.id;
        RAISE NOTICE 'Corrected inventory_movement % with product_id from movement_code', 
          movement_record.id;
        CONTINUE;
      END IF;
    END IF;
    
    -- Autres stratégies de correction peuvent être ajoutées ici
    -- Par exemple: utiliser les informations de la table locale synchronisée
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Exécuter la correction pour tous les tenants
-- DO $$
-- DECLARE
--   tenant RECORD;
-- BEGIN
--   FOR tenant IN SELECT id FROM tenants WHERE status = 'active' LOOP
--     PERFORM backfill_inventory_movement_product_ids(tenant.id);
--   END LOOP;
-- END $$;
