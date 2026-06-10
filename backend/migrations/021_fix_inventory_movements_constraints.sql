-- Migration 021: Fix inventory_movements CHECK constraint (add 'sale' type)
-- SQLite doesn't support ALTER TABLE for constraints, so we recreate the table.

PRAGMA foreign_keys = OFF;

-- 1. Create the new table with the updated CHECK constraint
CREATE TABLE inventory_movements_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer', 'sale', 'return')),
    quantity_before REAL NOT NULL,
    quantity_changed REAL NOT NULL,
    quantity_after REAL NOT NULL,
    reference_id TEXT,
    reference_type TEXT,
    status TEXT DEFAULT 'confirmed',
    notes TEXT,
    unit_cost REAL DEFAULT 0,
    total_value REAL DEFAULT 0,
    created_by INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 2. Copy data from the old table
INSERT INTO inventory_movements_new (
    id, product_id, movement_type, quantity_before, quantity_changed, 
    quantity_after, reference_id, reference_type, status, notes, 
    unit_cost, total_value, created_by, reason, created_at
)
SELECT 
    id, product_id, movement_type, quantity_before, quantity_changed, 
    quantity_after, reference_id, reference_type, status, notes, 
    COALESCE(unit_cost, 0), COALESCE(total_value, 0), created_by, reason, created_at
FROM inventory_movements;

-- 3. Swap tables
DROP TABLE inventory_movements;
ALTER TABLE inventory_movements_new RENAME TO inventory_movements;

-- 4. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at DESC);

PRAGMA foreign_keys = ON;
