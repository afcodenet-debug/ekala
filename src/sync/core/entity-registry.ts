/**
 * src/sync/core/entity-registry.ts
 * Registre central de toutes les entités synchronisables.
 * Définit les métadonnées de sync pour chaque table : nom local, nom Supabase,
 * colonnes autorisées, mapping FK, mapping de statuts, ordre de sync.
 *
 * V3 COMPLETE: Aligné sur le schéma Supabase réel (60 tables analysées).
 * Tous les noms de colonnes correspondent exactement au schéma source.
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
  /** Champs spéciaux à mapper (remoteField → localField) */
  fieldMappings?: Record<string, string>;
  /** Colonnes booléennes (numbers 0/1 en local, boolean en remote) */
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
  // ═══════════════════════════════════════════════════════════════════
  // Tenant / Users (ordre 0-10) — dépendances critiques
  // ═══════════════════════════════════════════════════════════════════
  {
    entity: 'tenant',
    localTable: 'tenants',
    remoteTable: 'tenants',
    syncOrder: 0,
    allowedFields: [
      'remote_id', 'slug', 'name', 'legal_name', 'owner_email', 'owner_phone',
      'contact_email', 'contact_phone', 'country', 'city', 'address', 'logo_url', 'primary_color',
      'default_currency', 'default_locale', 'timezone', 'status', 'is_provisioned', 'provisioned_at',
      'internal_notes', 'tenant_id', 'suspended_at', 'suspension_reason', 'suspended_by',
      'last_reactivated_at', 'last_reactivated_by', 'disabled_at', 'disabled_by',
      'created_at', 'updated_at',
    ],
    foreignKeys: { suspended_by: 'users', last_reactivated_by: 'users', disabled_by: 'users' },
    hasUpdatedAt: true,
    hasTenantId: false,
  },
  {
    entity: 'user',
    localTable: 'users',
    remoteTable: 'users',
    syncOrder: 5,
    allowedFields: [...ALLOWED_BASE, 'full_name', 'username', 'pin_code', 'role', 'is_active', 'email',
      'tenant_id', 'phone', 'password_hash', 'has_setup_pin', 'is_super_admin', 'is_platform_user',
      'status', 'revoked_at', 'revoked_by', 'locked_until'],
    booleanFields: ['is_active', 'has_setup_pin', 'is_platform_user'],
    foreignKeys: { tenant_id: 'tenants', revoked_by: 'users' },
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

  // ═══════════════════════════════════════════════════════════════════
  // Catalogue (ordre 10-20)
  // ═══════════════════════════════════════════════════════════════════
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
      'price', 'cost_price', 'minimum_stock', 'low_stock_threshold',
      'created_by', 'updated_by',
      'sort_order', 'is_featured', 'metadata'],
    foreignKeys: { category_id: 'categories', created_by: 'users', updated_by: 'users' },
    booleanFields: ['is_available', 'is_featured'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ═══════════════════════════════════════════════════════════════════
  // Tables de restaurant (ordre 20)
  // ═══════════════════════════════════════════════════════════════════
  {
    entity: 'restaurant_table',
    localTable: 'restaurant_tables',
    remoteTable: 'restaurant_tables',
    syncOrder: 20,
    allowedFields: ['created_at', 'updated_at', 'tenant_id', 'table_number', 'capacity', 'status',
      'assigned_waiter_id', 'qr_token', 'remote_id'],
    foreignKeys: { assigned_waiter_id: 'users' },
    statusMapping: { active: 'occupied', out_of_service: 'available', cleaning: 'cleaning', reserved: 'reserved' },
    reverseStatusMapping: { occupied: 'active', available: 'out_of_service', cleaning: 'cleaning', reserved: 'reserved' },
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ═══════════════════════════════════════════════════════════════════
  // Clients (ordre 25)
  // ═══════════════════════════════════════════════════════════════════
  {
    entity: 'customer',
    localTable: 'customers',
    remoteTable: 'customers',
    syncOrder: 25,
    allowedFields: [...ALLOWED_BASE, 'name', 'phone_number', 'pin_code', 'email'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ═══════════════════════════════════════════════════════════════════
  // Commandes (ordre 30-35)
  // ═══════════════════════════════════════════════════════════════════
  {
    entity: 'order',
    localTable: 'orders',
    remoteTable: 'orders',
    syncOrder: 30,
    allowedFields: [...ALLOWED_BASE, 'table_id', 'waiter_id', 'customer_id', 'customer_phone', 'status', 'total', 'items', 'source', 'notes',
      'confirmed_at', 'started_at', 'ready_at', 'served_at', 'paid_at'],
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
    allowedFields: [...ALLOWED_BASE_NO_VERSION, 'order_id', 'product_id', 'quantity', 'unit_price', 'total_price', 'notes', 'remote_id'],
    foreignKeys: { order_id: 'orders', product_id: 'products' },
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ═══════════════════════════════════════════════════════════════════
  // Ventes (ordre 40-45)
  // ═══════════════════════════════════════════════════════════════════
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
    allowedFields: [...ALLOWED_BASE_NO_VERSION, 'sale_id', 'product_id', 'quantity', 'unit_price', 'total_price', 'remote_id'],
    foreignKeys: { sale_id: 'sales', product_id: 'products' },
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ═══════════════════════════════════════════════════════════════════
  // Dépenses (ordre 50)
  // ═══════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════
  // Inventaire (ordre 55-60)
  // ═══════════════════════════════════════════════════════════════════
  {
    entity: 'inventory_movement',
    localTable: 'inventory_movements',
    remoteTable: 'inventory_movements',
    syncOrder: 55,
    allowedFields: [...ALLOWED_BASE_NO_VERSION, 'product_id', 'movement_type', 'quantity_before', 'quantity_changed',
      'quantity_after', 'reference_id', 'reference_type', 'status', 'notes', 'unit_cost', 'total_value',
      'created_by', 'reason', 'movement_code', 'inventory_session_id', 'approved_by', 'remote_id'],
    foreignKeys: { product_id: 'products', created_by: 'users', approved_by: 'users', inventory_session_id: 'inventory_sessions' },
    hasUpdatedAt: true, // Supabase a bien updated_at sur inventory_movements
    hasTenantId: true,
  },
  {
    entity: 'inventory_session',
    localTable: 'inventory_sessions',
    remoteTable: 'inventory_sessions',
    syncOrder: 56,
    allowedFields: [...ALLOWED_BASE, 'session_code', 'name', 'type', 'status', 'started_at', 'closed_at', 'created_by', 'notes'],
    foreignKeys: { created_by: 'users' },
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ═══════════════════════════════════════════════════════════════════
  // Fournisseurs & Achats (ordre 60-70)
  // ═══════════════════════════════════════════════════════════════════
  // NOTE: Supabase a `contact_person`, local a `contact_name` — mapping fieldMappings
  {
    entity: 'supplier',
    localTable: 'suppliers',
    remoteTable: 'suppliers',
    syncOrder: 60,
    allowedFields: [...ALLOWED_BASE, 'name', 'contact_name', 'contact_person', 'email', 'phone', 'address', 'tax_number', 'payment_terms', 'is_active'],
    // contact_name → contact_person mapping
    fieldMappings: { contact_person: 'contact_name' },
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
    hasUpdatedAt: true, // Supabase a updated_at
    hasTenantId: true,
  },

  // ═══════════════════════════════════════════════════════════════════
  // Ajustements de stock (ordre 75-80)
  // ALIGNÉ sur le schéma Supabase: session_id, product_id, expected_qty, counted_qty, variance
  // ═══════════════════════════════════════════════════════════════════
  {
    entity: 'stock_adjustment',
    localTable: 'stock_adjustments',
    remoteTable: 'stock_adjustments',
    syncOrder: 75,
    allowedFields: [...ALLOWED_BASE_NO_VERSION, 'session_id', 'product_id', 'expected_qty', 'counted_qty', 'variance', 'reason', 'created_at'],
    foreignKeys: { session_id: 'inventory_sessions', product_id: 'products' },
    hasUpdatedAt: false,
    hasTenantId: true,
  },
  {
    entity: 'stock_adjustment_item',
    localTable: 'stock_adjustment_items',
    remoteTable: 'stock_adjustment_items',
    syncOrder: 80,
    allowedFields: [...ALLOWED_BASE_NO_VERSION, 'adjustment_id', 'product_id', 'expected', 'counted', 'variance'],
    foreignKeys: { adjustment_id: 'stock_adjustments', product_id: 'products' },
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ═══════════════════════════════════════════════════════════════════
  // Menus QR (ordre 85-90)
  // ═══════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════
  // Paramètres (ordre 95)
  // ═══════════════════════════════════════════════════════════════════
  {
    entity: 'setting',
    localTable: 'settings',
    remoteTable: 'settings',
    syncOrder: 95,
    allowedFields: ['key', 'value', 'updated_at', 'tenant_id'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ═══════════════════════════════════════════════════════════════════
  // Vouchers & Paiements (ordre 97-99)
  // ═══════════════════════════════════════════════════════════════════
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
    foreignKeys: { tenant_id: 'tenants', plan_id: 'plans', requested_by: 'users', verified_by: 'users' },
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
      'verified_at', 'verified_by', 'rejection_reason', 'notes',
      'amount_cents', 'currency',
    ],
    foreignKeys: { tenant_id: 'tenants', plan_id: 'plans', verified_by: 'users' },
    hasUpdatedAt: true,
    hasTenantId: true,
  },
  {
    entity: 'voucher_audit_log',
    localTable: 'voucher_audit_logs',
    remoteTable: 'voucher_audit_logs',
    syncOrder: 98,
    allowedFields: ['id', 'created_at', 'voucher_request_id', 'action', 'actor_id', 'notes', 'tenant_id'],
    foreignKeys: { voucher_request_id: 'voucher_requests', actor_id: 'users' },
    hasUpdatedAt: false,
    hasTenantId: true, // La table Supabase a tenant_id
  },
  {
    entity: 'voucher',
    localTable: 'vouchers',
    remoteTable: 'vouchers',
    syncOrder: 99,
    allowedFields: ['id', 'code', 'plan_id', 'amount_cents', 'currency', 'max_uses', 'used_count',
      'expires_at', 'is_active', 'created_at', 'updated_at', 'tenant_id', 'status',
      'plan_code', 'duration_days', 'activated_by', 'activated_at', 'created_by',
      'revoked_at', 'revoke_reason', 'metadata', 'used_at'],
    foreignKeys: { plan_id: 'plans', activated_by: 'users', created_by: 'users' },
    booleanFields: ['is_active'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },
  {
    entity: 'voucher_redemption',
    localTable: 'voucher_redemptions',
    remoteTable: 'voucher_redemptions',
    syncOrder: 99,
    allowedFields: ['id', 'voucher_id', 'tenant_id', 'subscription_id', 'redeemed_at'],
    foreignKeys: { voucher_id: 'vouchers', tenant_id: 'tenants', subscription_id: 'subscriptions' },
    hasUpdatedAt: false,
    hasTenantId: true,
  },

  // ═══════════════════════════════════════════════════════════════════
  // Plans & Abonnements (ordre 100-102) — lecture seule depuis Supabase
  // ═══════════════════════════════════════════════════════════════════
  {
    entity: 'plan',
    localTable: 'plans',
    remoteTable: 'plans',
    syncOrder: 100,
    allowedFields: ['id', 'code', 'name', 'description', 'price_cents', 'currency', 'period', 'duration_days',
      'max_users', 'max_tables', 'max_products', 'max_orders_per_month',
      'features', 'is_active', 'is_public', 'trial_days', 'sort_order',
      'created_at', 'updated_at'],
    booleanFields: ['is_active', 'is_public'],
    hasUpdatedAt: true,
    hasTenantId: false,
  },
  {
    entity: 'subscription',
    localTable: 'subscriptions',
    remoteTable: 'subscriptions',
    syncOrder: 101,
    allowedFields: ['id', 'tenant_id', 'plan_id', 'status', 'started_at', 'current_period_start',
      'current_period_end', 'trial_started_at', 'trial_ends_at', 'cancelled_at',
      'cancel_reason', 'auto_renew', 'payment_method', 'payment_reference',
      'created_at', 'updated_at', 'plan_code', 'next_billing_date',
      'grace_period_end', 'activation_source', 'activation_reference',
      'start_date', 'end_date'],
    foreignKeys: { tenant_id: 'tenants', plan_id: 'plans' },
    booleanFields: ['auto_renew'],
    hasUpdatedAt: true,
    hasTenantId: true,
  },
  {
    entity: 'payment',
    localTable: 'payments',
    remoteTable: 'payments',
    syncOrder: 102,
    allowedFields: ['id', 'tenant_id', 'subscription_id', 'plan_id', 'amount_cents', 'currency',
      'payment_method', 'payment_provider', 'provider_reference', 'provider_status',
      'status', 'period_start', 'period_end', 'notes', 'metadata',
      'paid_at', 'confirmed_at', 'created_at', 'updated_at'],
    foreignKeys: { tenant_id: 'tenants', subscription_id: 'subscriptions', plan_id: 'plans' },
    hasUpdatedAt: true,
    hasTenantId: true,
  },

  // ═══════════════════════════════════════════════════════════════════
  // Audit & Logs (ordre 110) — push seulement
  // ═══════════════════════════════════════════════════════════════════
  {
    entity: 'audit_trail',
    localTable: 'audit_trail',
    remoteTable: 'audit_trail',
    syncOrder: 110,
    allowedFields: ['id', 'table_name', 'record_id', 'operation', 'old_values', 'new_values',
      'changed_by', 'changed_at', 'ip_address', 'user_agent'],
    foreignKeys: { changed_by: 'users' },
    hasUpdatedAt: false,
    hasTenantId: false,
  },
  {
    entity: 'tenant_audit_log',
    localTable: 'tenant_audit_logs',
    remoteTable: 'tenant_audit_log',
    syncOrder: 110,
    allowedFields: ['id', 'tenant_id', 'actor_user_id', 'action', 'entity_type', 'entity_id',
      'metadata', 'ip_address', 'user_agent', 'created_at'],
    foreignKeys: { tenant_id: 'tenants', actor_user_id: 'users' },
    hasUpdatedAt: false,
    hasTenantId: true,
  },
  {
    entity: 'app_log',
    localTable: 'app_logs',
    remoteTable: 'app_logs',
    syncOrder: 110,
    allowedFields: ['id', 'level', 'message', 'user_id', 'created_at'],
    foreignKeys: { user_id: 'users' },
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
