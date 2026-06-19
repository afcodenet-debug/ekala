-- ============================================================================
-- Migration Supabase 003: Fix inventory_movements reference_id type
-- ============================================================================
-- 
-- Problème: Le champ reference_id est défini comme BIGINT dans Supabase
-- mais les données locales SQLite l'envoient comme TEXT (ex: "3.0", "2.0")
-- Cela cause des erreurs de synchronisation: "invalid input syntax for type bigint: "3.0""
--
-- Solution: Changer reference_id de BIGINT à TEXT pour permettre la synchronisation
-- des valeurs existantes. Les références peuvent être des IDs numériques ou des codes.
--
-- Note: Cette migration doit être exécutée AVANT de relancer la synchronisation
-- ============================================================================

-- 1. Vérifier si des données existent déjà avec reference_id non-numérique
-- (optionnel, pour audit)
DO $$
BEGIN
  PERFORM COUNT(*) FROM inventory_movements 
  WHERE reference_id IS NOT NULL 
    AND (reference_id::TEXT !~ '^[0-9]+$' OR reference_id::TEXT ~ '\.');
  
  IF FOUND THEN
    RAISE NOTICE 'Attention: Il existe des reference_id non-entiers dans inventory_movements';
  END IF;
END $$;

-- 2. Modifier le type de reference_id de BIGINT à TEXT
-- Utiliser ALTER TABLE avec USING pour convertir les valeurs existantes
ALTER TABLE inventory_movements 
  ALTER COLUMN reference_id TYPE TEXT 
  USING (reference_id::TEXT);

-- 3. Mettre à jour le commentaire de la colonne
COMMENT ON COLUMN inventory_movements.reference_id IS 
  'Reference to the source entity (sale_id, order_id, etc.). Can be numeric or string.';

-- 4. Vérification post-migration
DO $$
BEGIN
  PERFORM COUNT(*) FROM inventory_movements WHERE reference_id IS NOT NULL;
  RAISE NOTICE 'Migration complète: reference_id est maintenant de type TEXT';
END $$;
