-- Script pour corriger le doublon de catégorie dans SQLite
-- Problème : id=24822 et id=24830 ont tous les deux remote_id=24822

-- 1. Vérifier les produits qui utilisent la catégorie doublon (id=24830)
SELECT p.id, p.name, p.category_id
FROM products p
WHERE p.category_id = 24830;

-- 2. Mettre à jour les produits pour qu'ils utilisent la bonne catégorie (id=24822)
UPDATE products 
SET category_id = 24822 
WHERE category_id = 24830;

-- 3. Supprimer le doublon (garder id=24822, supprimer id=24830)
DELETE FROM categories 
WHERE id = 24830;

-- 4. Vérification
SELECT id, remote_id, name, tenant_id 
FROM categories 
WHERE tenant_id = 16.0 
ORDER BY id;

-- Résultat attendu : 3 catégories (24822, 24828, 24829) au lieu de 4