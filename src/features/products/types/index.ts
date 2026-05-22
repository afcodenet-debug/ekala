import { z } from 'zod';

/**
 * STRICT TYPES & SCHEMAS
 * Unified source of truth for Product entities.
 * Futures: multi-branch / multi-tenant ready by always keeping branch_id fields available
 */

export const ProductUnitSchema = z.enum(['pcs', 'btl', 'kg', 'l', 'g', 'ml', 'unit']);
export type ProductUnit = z.infer<typeof ProductUnitSchema>;

export const ProductStatusSchema = z.enum(['available', 'out_of_stock', 'low_stock', 'discontinued']);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

// ── Movement Types ───────────────────────────────────────────────────
export const MovementTypeSchema = z.enum([
  'purchase', 'sale', 'adjustment', 'transfer',
  'waste', 'damaged', 'return', 'inventory_count',
]);
export type MovementType = z.infer<typeof MovementTypeSchema>;

// ── Inventory Movement (aligns with DB schema) ───────────────────────
export const InventoryMovementSchema = z.object({
  id:            z.number().int().positive(),
  product_id:    z.number().int().positive(),
  type:          MovementTypeSchema,
  movement_type: MovementTypeSchema.optional(),
  quantity_before: z.number().nullable(),
  quantity_changed: z.number().nullable(),
  quantity_after: z.number().nullable(),
  unit_cost:     z.number().nullable(),
  total_value:   z.number().nullable(),
  reference_type: z.string().nullable(),
  reference_id:  z.number().nullable(),
  reason:        z.string().nullable(),
  created_by:    z.number().nullable(),
  approved_by:   z.number().nullable(),
  created_at:    z.string().datetime().nullable(),
  product_name:  z.string().nullable().optional(),
  barcode:       z.string().nullable().optional(),
});
export type InventoryMovement = z.infer<typeof InventoryMovementSchema>;

// ── Product (aligns with DB schema) ──────────────────────────────────
export const ProductSchema = z.object({
  id:            z.number().int().positive(),
  name:          z.string().min(2, "Name must contain at least 2 characters"),
  barcode:       z.string().optional().nullable(),
  category_id:   z.number().int().positive("Category is required"),
  category_name: z.string(),
  buying_price:  z.number().min(0, "Buying price cannot be negative"),
  selling_price: z.number().min(0, "Selling price cannot be negative"),
  stock_quantity: z.number().default(0),
  minimum_stock: z.number().min(0).default(5),
  unit:          ProductUnitSchema.default('pcs'),
  is_available:  z.boolean().default(true),
  image_url:     z.string().optional().nullable(),
  description:   z.string().max(500).optional().nullable(),
  created_at:    z.string().datetime().optional(),
  updated_at:    z.string().datetime().optional(),
});

export type Product = z.infer<typeof ProductSchema>;

// ── Product History Summary ───────────────────────────────────────────
export interface ProductHistoryEntry {
  movement: InventoryMovement;
  sale?: {
    id: number;
    invoice_number: string;
    quantity: number;
    total_price: number;
    created_at: string;
  };
}

// ── Category ─────────────────────────────────────────────────────────
export interface Category {
  id: number;
  name: string;
  description?: string;
  product_count?: number;
}

// ── Stats ─────────────────────────────────────────────────────────────
export interface ProductStats {
  total_inventory_value: number;
  potential_gross_profit: number;
  low_stock_alerts: number;
  out_of_stock_count: number;
  active_skus: number;
}

// ── Analytics ─────────────────────────────────────────────────────────
export interface InventoryAnalytics {
  total_inventory_value:       number;
  potential_gross_profit:      number;
  actual_gross_profit:         number;  // realised margin from sales
  stock_turnover:              number;  // ratio turns/period
  dead_stock_count:            number;
  dead_stock_value:            number;
  top_selling_products:        Array<{
    product_id:    number;
    product_name:  string;
    category_name: string;
    units_sold:    number;
    revenue:       number;
    estimated_cost: number;
  }>;
  low_stock_alerts:            Array<{
    product_id:   number;
    product_name: string;
    stock:        number;
    minimum_stock: number;
    urgency:      'critical' | 'warning';
  }>;
  fast_moving_items:           Array<{
    product_id:    number;
    product_name:  string;
    category_name: string;
    turnover_days: number;
  }>;
  waste_analytics:             Array<{
    reason:      string;
    occurrences: number;
    total_qty:   number;
    total_cost:  number;
  }>;
}

// ── Adjust Stock Request ─────────────────────────────────────────────
export interface AdjustStockRequest {
  quantity:        number;
  type:            MovementType | 'addition' | 'subtraction';
  reason:          string;
  user_id?:        number;
  reference_type?: string;
  reference_id?:   number;
}

// ── Stock Count Session ──────────────────────────────────────────────
export interface InventoryCountSession {
  id:             number;
  product_id:     number;
  counted_quantity: number;
  system_quantity: number;
  variance:       number;
  reason:         string;
  counted_by:     number;
  created_at:     string;
  product_name?:  string;
  barcode?:       string;
}

// ── Stock Transfer ───────────────────────────────────────────────────
export interface StockTransfer {
  product_id:     number;
  quantity:       number;
  from_location?: string;
  to_location:    string;
  reason:         string;
  reference_type: 'transfer';
  reference_id?:  number;
}

// ── Transfer to Database ─────────────────────────────────────────────
export interface StockTransferRecord extends StockTransfer {
  id:          number;
  created_by:  number;
  created_at:  string;
}

// ── Permissions ──────────────────────────────────────────────────────
export type ProductPermission =
  | 'product.view'
  | 'product.create'
  | 'product.edit'
  | 'product.delete'
  | 'inventory.adjust'
  | 'inventory.view_value'
  | 'inventory.export';
