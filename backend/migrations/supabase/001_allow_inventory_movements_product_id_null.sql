-- ============================================================================
-- Migration Supabase: Allow product_id to be NULL in inventory_movements
-- ============================================================================
-- Cette migration corrige le problème de synchronisation des mouvements d'inventaire
-- quand le produit référencé n'est pas encore synchronisé.
--
-- Problème: Quand un mouvement d'inventaire est créé pour un produit qui n'est pas
-- encore synchronisé avec Supabase, la synchronisation échoue car product_id
-- a une contrainte NOT NULL.
--
-- Solution: Permettre product_id d'être NULL avec ON DELETE SET NULL.
-- Une fois le produit synchronisé, une migration de correction mettra à jour
-- les mouvements avec product_id NULL.
-- ============================================================================

-- 1. Modifier la contrainte NOT NULL sur product_id
ALTER TABLE inventory_movements ALTER COLUMN product_id DROP NOT NULL;

-- 2. Modifier la contrainte de clé étrangère pour utiliser ON DELETE SET NULL
-- (déjà présent dans le schéma original, mais on s'assure)
ALTER TABLE inventory_movements 
  DROP CONSTRAINT IF EXISTS inventory_movements_product_id_fkey,
  ADD CONSTRAINT inventory_movements_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- 3. Commentaire: Les mouvements existants avec product_id NULL seront corrigés
-- par une migration ultérieure ou par l'application lors de la synchronisation
-- des produits correspondants.
