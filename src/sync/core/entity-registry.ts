/**
 * src/sync/core/entity-registry.ts
 * Registre central de toutes les entités synchronisables.
 * Définit les métadonnées de sync pour chaque table : nom local, nom Supabase,
 * colonnes autorisées, mapping FK, mapping de statuts, ordre de sync.
 */
export interface SyncEntityDefinition {
  /** Nom de l'entité (utilisé dans l'outbox) */
  entity: string;
  /** Nom de la table SQLite locale */
  localTable: string;
  /** Nom de la table Supabase */
  remoteTable: string;
  /** Ordre de synchronisation (croissant) */
  syncOrder: number;
  /** Colonnes autorisées pour la sync */
  allowedFields: string[];
  /** Mapping des clés étrangères: champ_local → table_cible */
  foreignKeys?: Record<string, string>;
  /** Mapping de statuts: local → remote */
  statusMapping?: Record<string, string>;
  /** Mapping inverse: remote → local */
  reverseStatusMapping?: Record<string, string>;
  /** Champs spéciaux à mapper */
  fieldMappings?: Record<string, string>;
  /** Colonnes booléennes */
  booleanFields?: string[];
  /** Colonnes JSON */
  jsonFields?: string[];
  /** Colonne de version */
  versionField?: string;
  /** A une colonne updated_at */
  hasUpdatedAt?: boolean;
  /** Colonne tenant_id */
  hasTenantId?: boolean;
}

const ALLOWED_BASE = ['created_at', 'updated_at', 'tenant_id', 'version'];
const ALLOWED_BASE_NO_VERSION = ['created_at', 'updated_at', 'tenant_id'];

export const SYNC_ENTITIES: SyncEntityDefinition[] = [
  // ─── Tenant / Users (ordre 0-10) ───
  {
    entity: 'tenant',
    localTable: 'tenants',
    remoteTable: 'tenants',
    syncOrder: 0,
    allowedFields: ['created_at', 'updated_at', 'remote_id', 'slug', 'name', 'legal_name', 'owner_email', 'owner_phone',
      'contact_email', 'contact_phone', 'country', 'city', 'address', 'logo_url', 'primary_color',
      'default_currency', 'default_locale', 'timezone', 'status', 'is_provisioned', 'provisioned_at', 'internal_notes'],
    hasUpdatedAt: true,
    hasTenantId: false,
  },
  {
    entity: 'user',
    localTable: 'users',
    remoteTable: 'users',
    syncOrder: 5,
    allowedFields: [...ALLOWED_BASE, 'full_name', 'username', 'pin_code', 'role', 'is_active', 'email', 'tenant_id', 'phone', 'password_hash', 'has_setup_pin'],
    booleanFields: ['is_active', 'has_setup_pin'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },
  {
    entity: 'tenant_user',
    localTable: 'tenant_users',
    remoteTable: 'tenant_users',
    syncOrder: 8,
    allowedFields: [...ALLOWED_BASE, 'tenant_id', 'user_id', 'role', 'is_default', 'is_active', 'invited_at', 'joined_at'],
    foreignKeys: { tenant_id: 'tenants', user_id: 'users' },
    booleanFields: ['is_default', 'is_active'],
    hasUpdatedAt: true,
    hasTenantId: false,
  },

  // ─── Catalogue (ordre 10-20) ───
  {
    entity: 'category',
    localTable: 'categories',
    remoteTable: 'categories',
    syncOrder: 10,
    allowedFields: ['created_at', 'updated_at', 'tenant_id', 'name', 'description', 'remote_id'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },
  {
    entity: 'product',
    localTable: 'products',
    remoteTable: 'products',
    syncOrder: 15,
    allowedFields: [...ALLOWED_BASE, 'name', 'stock_quantity', 'selling_price', 'buying_price', 'is_available',
      'category_id', 'barcode', 'description', 'unit', 'image_url', 'sku', 'status',
      'cost_method', 'archived_at', 'deleted_at',
      'price', 'cost_price', 'minimum_stock',
      'created_by', 'updated_by',
      'sort_order', 'is_featured', 'metadata'],
    foreignKeys: { category_id: 'categories', created_by: 'users', updated_by: 'users' },
    // Supabase products utilise déjà `minimum_stock` (pas `low_stock_threshold`)
    // Donc aucun mapping nécessaire pour la taille du seuil minimum.
    fieldMappings: undefined,
    booleanFields: ['is_available'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ─── Tables (ordre 20) ───
  {
    entity: 'restaurant_table',
    localTable: 'restaurant_tables',
    remoteTable: 'restaurant_tables',
    syncOrder: 20,
    allowedFields: ['created_at', 'updated_at', 'tenant_id', 'table_number', 'capacity', 'status', 'assigned_waiter_id', 'qr_token', 'remote_id'],
    foreignKeys: { assigned_waiter_id: 'users' },
    statusMapping: { active: 'occupied', out_of_service: 'available', cleaning: 'cleaning', reserved: 'reserved' },
    reverseStatusMapping: { occupied: 'active', available: 'available', cleaning: 'cleaning', reserved: 'reserved' },
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ─── Clients (ordre 25) ───
  {
    entity: 'customer',
    localTable: 'customers',
    remoteTable: 'customers',
    syncOrder: 25,
    allowedFields: [...ALLOWED_BASE, 'name', 'phone_number', 'pin_code', 'email'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ─── Commandes (ordre 30-35) ───
  {
    entity: 'order',
    localTable: 'orders',
    remoteTable: 'orders',
    syncOrder: 30,
    allowedFields: [...ALLOWED_BASE, 'table_id', 'waiter_id', 'customer_id', 'status', 'total', 'items', 'source', 'notes', 'customer_phone'],
    foreignKeys: { table_id: 'restaurant_tables', waiter_id: 'users', customer_id: 'customers' },
    jsonFields: ['items'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },
  {
    entity: 'order_item',
    localTable: 'order_items',
    remoteTable: 'order_items',
    syncOrder: 35,
    allowedFields: [...ALLOWED_BASE_NO_VERSION, 'order_id', 'product_id', 'quantity', 'unit_price', 'total_price', 'notes'],
    foreignKeys: { order_id: 'orders', product_id: 'products' },
    hasUpdatedAt: false,
    hasTenantId: true,
  },

  // ─── Ventes (ordre 40-45) ───
  {
    entity: 'sale',
    localTable: 'sales',
    remoteTable: 'sales',
    syncOrder: 40,
    allowedFields: [...ALLOWED_BASE, 'invoice_number', 'order_id', 'user_id', 'customer_id', 'subtotal', 'discount', 'tax', 'total_amount', 'payment_method'],
    foreignKeys: { order_id: 'orders', user_id: 'users', customer_id: 'customers' },
    hasUpdatedAt: true,
    hasTenantId: true,
  },
  {
    entity: 'sale_item',
    localTable: 'sale_items',
    remoteTable: 'sale_items',
    syncOrder: 45,
    allowedFields: [...ALLOWED_BASE_NO_VERSION, 'sale_id', 'product_id', 'quantity', 'unit_price', 'total_price'],
    foreignKeys: { sale_id: 'sales', product_id: 'products' },
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ─── Dépenses (ordre 50) ───
  {
    entity: 'expense',
    localTable: 'expenses',
    remoteTable: 'expenses',
    syncOrder: 50,
    allowedFields: [...ALLOWED_BASE_NO_VERSION, 'category', 'amount', 'description', 'user_id', 'date'],
    foreignKeys: { user_id: 'users' },
    hasUpdatedAt: false,
    hasTenantId: true,
  },

  // ─── Inventaire (ordre 55-60) ───
  {
    entity: 'inventory_movement',
    localTable: 'inventory_movements',
    remoteTable: 'inventory_movements',
    syncOrder: 55,
    allowedFields: [...ALLOWED_BASE_NO_VERSION, 'product_id', 'movement_type', 'quantity_before', 'quantity_changed',
      'quantity_after', 'reference_id', 'reference_type', 'status', 'notes', 'unit_cost', 'total_value',
      'created_by', 'reason', 'movement_code', 'inventory_session_id', 'approved_by'],
    foreignKeys: { product_id: 'products', created_by: 'users', approved_by: 'users', inventory_session_id: 'inventory_sessions' },
    // Logs: Supabase missing inventory_movements.updated_at -> avoid querying updated_at
    hasUpdatedAt: false,
    hasTenantId: true,
  },
  {
    entity: 'inventory_session',
    localTable: 'inventory_sessions',
    remoteTable: 'inventory_sessions',
    syncOrder: 56,
    allowedFields: [...ALLOWED_BASE, 'session_code', 'name', 'type', 'status', 'started_at', 'closed_at', 'created_by', 'notes'],
    foreignKeys: { created_by: 'users' },
    // Logs: Supabase missing inventory_sessions.created_at -> use updated_at instead
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ─── Fournisseurs & Achats (ordre 60-70) ───
  {
    entity: 'supplier',
    localTable: 'suppliers',
    remoteTable: 'suppliers',
    syncOrder: 60,
    allowedFields: [...ALLOWED_BASE, 'name', 'contact_name', 'email', 'phone', 'address', 'tax_number', 'payment_terms', 'is_active'],
    booleanFields: ['is_active'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },
  {
    entity: 'purchase_order',
    localTable: 'purchase_orders',
    remoteTable: 'purchase_orders',
    syncOrder: 65,
    allowedFields: [...ALLOWED_BASE, 'po_number', 'supplier_id', 'status', 'subtotal', 'tax', 'total', 'received_at', 'notes', 'created_by'],
    foreignKeys: { supplier_id: 'suppliers', created_by: 'users' },
    hasUpdatedAt: true,
    hasTenantId: true,
  },
  {
    entity: 'purchase_order_item',
    localTable: 'purchase_order_items',
    remoteTable: 'purchase_order_items',
    syncOrder: 70,
    allowedFields: [...ALLOWED_BASE_NO_VERSION, 'purchase_order_id', 'product_id', 'quantity_ordered', 'quantity_received', 'unit_cost', 'total_cost'],
    foreignKeys: { purchase_order_id: 'purchase_orders', product_id: 'products' },
    // Logs: Supabase missing purchase_order_items.updated_at -> use created_at
    hasUpdatedAt: false,
    hasTenantId: true,
  },

  // ─── Ajustements de stock (ordre 75-80) ───
  {
    entity: 'stock_adjustment',
    localTable: 'stock_adjustments',
    remoteTable: 'stock_adjustments',
    syncOrder: 75,
    allowedFields: [...ALLOWED_BASE_NO_VERSION, 'adjustment_code', 'adjustment_type', 'status', 'total_value', 'reason', 'notes', 'created_by', 'approved_by'],
    foreignKeys: { created_by: 'users', approved_by: 'users' },
    hasUpdatedAt: false,
    hasTenantId: true,
  },
  {
    entity: 'stock_adjustment_item',
    localTable: 'stock_adjustment_items',
    remoteTable: 'stock_adjustment_items',
    syncOrder: 80,
    allowedFields: [...ALLOWED_BASE_NO_VERSION, 'adjustment_id', 'product_id', 'quantity_before', 'quantity_change', 'quantity_after', 'unit_cost', 'total_value', 'reason'],
    foreignKeys: { adjustment_id: 'stock_adjustments', product_id: 'products' },
    // Logs: Supabase missing stock_adjustment_items.updated_at -> use created_at
    hasUpdatedAt: false,
    hasTenantId: true,
  },

  // ─── Menus QR (ordre 85-90) ───
  {
    entity: 'menu_category',
    localTable: 'menu_categories',
    remoteTable: 'menu_categories',
    syncOrder: 85,
    allowedFields: [...ALLOWED_BASE, 'name', 'description', 'display_order', 'is_active'],
    booleanFields: ['is_active'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },
  {
    entity: 'menu_item',
    localTable: 'menu_items',
    remoteTable: 'menu_items',
    syncOrder: 90,
    allowedFields: [...ALLOWED_BASE, 'category_id', 'name', 'description', 'price', 'currency', 'unit', 'image_url', 'is_available', 'display_order'],
    foreignKeys: { category_id: 'menu_categories' },
    booleanFields: ['is_available'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ─── Paramètres (ordre 95) ───
  {
    entity: 'setting',
    localTable: 'settings',
    remoteTable: 'settings',
    syncOrder: 95,
    allowedFields: ['key', 'value', 'updated_at', 'tenant_id'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ─── Demandes de paiement par voucher (ordre 97) ───
  {
    entity: 'subscription_payment_request',
    localTable: 'subscription_payment_requests',
    remoteTable: 'subscription_payment_requests',
    syncOrder: 97,
    allowedFields: [
      'id', 'created_at', 'updated_at', 'tenant_id', 'remote_id',
      'plan_id', 'voucher_code', 'requested_by', 'amount_cents', 'currency',
      'requested_at', 'verification_deadline', 'expires_at', 'status',
      'verified_by', 'verified_at', 'rejection_reason', 'notes',
    ],
    foreignKeys: {
      tenant_id: 'tenants',
      plan_id: 'plans',
      requested_by: 'users',
      verified_by: 'users',
    },
    hasUpdatedAt: true,
    hasTenantId: true,
  },
  {
    entity: 'voucher_request',
    localTable: 'voucher_requests',
    remoteTable: 'voucher_requests',
    syncOrder: 97,
    allowedFields: [
      'id', 'created_at', 'updated_at', 'tenant_id', 'remote_id',
      'plan_id', 'voucher_code', 'customer_email', 'status',
      'requested_at', 'verification_deadline', 'expires_at',
      'verified_at', 'verified_by',
    ],
    foreignKeys: {
      tenant_id: 'tenants',
      plan_id: 'plans',
      verified_by: 'users',
    },
    hasUpdatedAt: true,
    hasTenantId: true,
  },
  {
    entity: 'voucher_audit_log',
    localTable: 'voucher_audit_logs',
    remoteTable: 'voucher_audit_logs',
    syncOrder: 98,
    allowedFields: ['id', 'created_at', 'voucher_request_id', 'action', 'actor_id', 'notes'],
    foreignKeys: { voucher_request_id: 'voucher_requests', actor_id: 'users' },
    hasUpdatedAt: false,
    hasTenantId: false,
  },
];

/** Toutes les entités triées par ordre de sync */
export function getEntitiesBySyncOrder(): SyncEntityDefinition[] {
  return [...SYNC_ENTITIES].sort((a, b) => a.syncOrder - b.syncOrder);
}

/** Trouve une définition d'entité par son nom */
export function getEntityDef(entity: string): SyncEntityDefinition | undefined {
  return SYNC_ENTITIES.find(e => e.entity === entity);
}

/** Résout le nom de table Supabase pour une entité */
export function getRemoteTable(entity: string): string | undefined {
  return getEntityDef(entity)?.remoteTable;
}

/** Résout le nom de table locale pour une entité */
export function getLocalTable(entity: string): string | undefined {
  return getEntityDef(entity)?.localTable;
}

/** Résout le mapping FK local → remote */
export function resolveForeignKey(
  entityDef: SyncEntityDefinition,
  field: string,
  localId: any,
  getRemoteIdFn: (table: string, localId: any) => number | null
): any {
  const targetTable = entityDef.foreignKeys?.[field];
  if (!targetTable || !localId) return localId;
  return getRemoteIdFn(targetTable, localId) || localId;
}

/** Résout le reverse mapping remote → local */
export function resolveInverseForeignKey(
  entityDef: SyncEntityDefinition,
  field: string,
  remoteId: any,
  getLocalIdFn: (table: string, remoteId: any) => number | null
): any {
  const targetTable = entityDef.foreignKeys?.[field];
  if (!targetTable || !remoteId) return remoteId;
  return getLocalIdFn(targetTable, remoteId) || remoteId;
}