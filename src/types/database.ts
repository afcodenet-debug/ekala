/**
 * Business Entity Types — src/types/database.ts
 *
 * Centralised TypeScript types for every new and existing business entity.
 * These types are used by the transaction scripts in scripts/ and should be kept
 * in sync with the SQL schema in backend/migrations/.
 *
 * Detection
 * ─────────────────────────────────────────────────────────────────────────────
 * These are plain TypeScript interfaces / type aliases.  They are NOT Zod
 * schemas.  Run `tsc --noEmit` on scripts/transactionScript.ts to validate.
 * ───────────────────────────────────────────────────────────────────────────
 */

import type { ProductUnit, InventoryMovement, Product, Category } from '../../features/products/types';

// ---------------------------------------------------------------------------
// 1. Inventory Movement (already defined in features/products/types/index.ts)
// ---------------------------------------------------------------------------

// Re-export so callers can import from a single source of truth.
export type { InventoryMovement };

// ---------------------------------------------------------------------------
// 2. Order Item
// ---------------------------------------------------------------------------
export interface OrderItem {
  /** stable row ID */
  id: number;
  /** FK → orders.id */
  order_id: number;
  /** FK → products.id  (NULLABLE for deleted products) */
  product_id: number | null;
  /** units / volume for this line (cannot be 0 — CHECK in schema) */
  quantity: number;
  /** price per unit at sale time */
  unit_price: number;
  readonly total_price: number;
  notes: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 3. Order (extended from the existing in-memory type)
// ---------------------------------------------------------------------------
export interface Order {
  id: number;
  /** FK → restaurant_tables.id  (NULLABLE for takeaway / counter sales) */
  table_id: number | null;
  table_number?: string | null;
  /** FK → users.id */
  waiter_id: number;
  waiter_name?: string | null;
   order_status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled' | 'rejected';
  readonly total: number;
  discount: number;
  tax: number;
  created_at: string;
  updated_at: string;
  /** populated by the service layer from order_items */
  items: OrderItem[];
}

// ---------------------------------------------------------------------------
// 4. Supplier
// ---------------------------------------------------------------------------
export interface Supplier {
  id: number;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_number: string | null;
  payment_terms: 'net_0' | 'net_15' | 'net_30' | 'net_60' | 'cod';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// 5. Purchase Order
// ---------------------------------------------------------------------------
export interface PurchaseOrder {
  id: number;
  /** vendor-assigned PO number — must be globally UNIQUE */
  po_number: string;
  /** FK → suppliers.id */
  supplier_id: number;
  supplier_name?: string;
  /** status lifecycle */
  status: 'draft' | 'ordered' | 'received' | 'partial' | 'cancelled';
  readonly subtotal: number;
  readonly tax: number;
  readonly total: number;
  received_at: string | null;
  notes: string | null;
  /** FK → users.id (the manager / dispatcher who created the PO) */
  created_by: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// 6. Purchase Order Item
// ---------------------------------------------------------------------------
export interface PurchaseOrderItem {
  id: number;
  /** FK → purchase_orders.id */
  purchase_order_id: number;
  /** FK → products.id */
  product_id: number;
  product_name?: string;
  quantity_ordered: number;
  quantity_received: number;
  readonly unit_cost: number;
  readonly total_cost: number;
}

// ---------------------------------------------------------------------------
// 7. Stock Adjustment Document
// ---------------------------------------------------------------------------
export type StockAdjustmentStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type AdjustmentType =
  | 'breakage'
  | 'loss'
  | 'inventory_count'
  | 'admin_correction'
  | 'supplier_return'
  | 'waste'
  | 'manual';

export interface StockAdjustment {
  id: number;
  /** human- and machine-readable code: e.g. SA-000001 */
  adjustment_code: string;
  /** single-word reason category */
  adjustment_type: AdjustmentType;
  /** document lifecycle */
  status: StockAdjustmentStatus;
  readonly total_value: number;
  /** free-text — required for compliance */
  reason: string;
  notes: string | null;
  /** FK → users.id */
  created_by: number;
  created_by_name?: string;
  /** FK → users.id  (NULL until approved) */
  approved_by: number | null;
  approved_by_name?: string;
  created_at: string;
  approved_at: string | null;
  /** FK → inventory_sessions.id (optional link to physical count session) */
  inventory_session_id: number | null;
  /** denormalised line-item array populated in the service layer */
  items?: Array<{
    product_id: number;
    product_name?: string;
    quantity_before: number;
    quantity_change: number;
    quantity_after: number;
    unit_cost: number;
    total_value: number;
    reason: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// 8. Stock Adjustment Item (line row)
// ---------------------------------------------------------------------------
export interface StockAdjustmentItem {
  id: number;
  adjustment_id: number;
  product_id: number;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  unit_cost: number;
  total_value: number;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// 9. Inventory Count Session
// ---------------------------------------------------------------------------
export type InventorySessionType = 'full_count' | 'partial_count' | 'cycle_count';
export type InventorySessionStatus = 'open' | 'in_progress' | 'closed' | 'approved';

export interface InventorySession {
  id: number;
  /** auto-generated: SSN-YYYYMMDD-###### */
  session_code: string;
  name: string;
  type: InventorySessionType;
  status: InventorySessionStatus;
  started_at: string;
  closed_at: string | null;
  /** FK → users.id */
  created_by: number;
  created_by_name?: string;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// 10. Product Status (already partially defined in features/products/types)
// ---------------------------------------------------------------------------
export type ProductStatus =
  | 'active'    // selling normally
  | 'inactive'  // out of stock, not archived
  | 'draft'     // not yet launched
  | 'archived'; // removed from catalogue, keep for history

// Re-export commonly used types from the features layer so internal modules
// can import from a single barrel file.
export type { Product, ProductUnit, Category } from '../../features/products/types';
