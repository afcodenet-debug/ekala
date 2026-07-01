/**
 * DataSourceManager - Centralise la détection d'environnement et le routage
 * des opérations CRUD entre SQLite (local) et Supabase (production).
 *
 * Architecture :
 * - Local (development) : SQLite est la source de vérité
 * - Production (Render) : Supabase est la source de vérité
 * - La synchronisation SQLite → Supabase se fait via l'outbox pattern
 *
 * Usage :
 *   import { dataSource } from '../infrastructure/data-source-manager';
 *   if (dataSource.isCloudMode()) { ... Supabase ... }
 *   else { ... SQLite ... }
 */

import { env } from '../config/env';
import { resolveRuntimeMode } from '../../shared/runtime-mode';

export type EnvironmentMode = 'local' | 'cloud';

class DataSourceManager {
  private _mode: EnvironmentMode;

  constructor() {
    this._mode = this.detectMode();
  }

  /**
   * Détecte automatiquement l'environnement :
   * - X-Runtime-Mode header (from frontend) → prioritaire
   * - RENDER_CLOUD_MODE=true → cloud (Supabase)
   * - usage de Supabase explicite via variables d'env → cloud
   * - origine localhost/127.0.0.1/localhost.* → local (SQLite)
   * - sinon → cloud par défaut pour les déploiements Vercel/Render
   */
  private detectMode(value?: string | null): EnvironmentMode {
    // 1. X-Runtime-Mode header is the most authoritative if present
    if (value === 'local' || value === 'cloud') {
      return value;
    }

    // 2. Environment variables override
    if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS || env.USE_SUPABASE_TABLES || env.USE_SUPABASE_ORDERS) {
      return 'cloud';
    }

    // 3. URL-based detection (origin, host, referer)
    if (value) {
      return resolveRuntimeMode(value);
    }

    // 4. NODE_ENV fallback
    if (env.NODE_ENV === 'development') {
      return 'local';
    }

    // 5. Default to cloud for production
    return 'cloud';
  }

  /**
   * Résout le mode d'exécution à partir d'une requête Express.
   * Vérifie d'abord l'en-tête X-Runtime-Mode, puis les en-têtes standard.
   */
  resolveFromRequest(req: { headers?: Record<string, any> }): EnvironmentMode {
    const runtimeHeader = req?.headers?.['x-runtime-mode'];
    if (runtimeHeader === 'local' || runtimeHeader === 'cloud') {
      return runtimeHeader;
    }

    const host = req?.headers?.host || req?.headers?.origin || req?.headers?.referer;
    return this.detectMode(host ? String(host) : null);
  }

  /** Retourne le mode actuel */
  get mode(): EnvironmentMode {
    return this._mode;
  }

  /** Vrai si on est en mode cloud (Supabase) */
  isCloudMode(value?: string | null): boolean {
    return this.detectMode(value) === 'cloud';
  }

  /** Vrai si on est en mode local (SQLite) */
  isLocalMode(value?: string | null): boolean {
    return this.detectMode(value) === 'local';
  }

  /**
   * Vérifie si une table spécifique doit utiliser Supabase.
   * Permet un contrôle granulaire par table.
   */
  isTableCloud(tableName: string, value?: string | null): boolean {
    if (this.isCloudMode(value)) return true;
    
    // Tables spécifiques qui peuvent être en mode Supabase même en local
    const tableOverrides: Record<string, boolean> = {
      products: env.USE_SUPABASE_PRODUCTS,
      tables: env.USE_SUPABASE_TABLES,
      orders: env.USE_SUPABASE_ORDERS,
      restaurant_tables: env.USE_SUPABASE_TABLES,
    };
    
    return tableOverrides[tableName] === true;
  }

  /**
   * Retourne le nom de la table SQLite pour une entité donnée
   */
  getSQLiteTable(entity: string): string {
    const tableMap: Record<string, string> = {
      product: 'products',
      category: 'categories',
      customer: 'customers',
      supplier: 'suppliers',
      table: 'tables',
      expense: 'expenses',
      sale: 'sales',
      inventory_movement: 'inventory_movements',
      user: 'users',
      order: 'orders',
      order_item: 'order_items',
    };
    return tableMap[entity] || entity;
  }

  /**
   * Retourne le nom de la table Supabase pour une entité donnée
   */
  getSupabaseTable(entity: string): string {
    const tableMap: Record<string, string> = {
      product: 'products',
      category: 'categories',
      customer: 'customers',
      supplier: 'suppliers',
      table: 'tables',
      expense: 'expenses',
      sale: 'sales',
      inventory_movement: 'inventory_movements',
      user: 'users',
      order: 'orders',
      order_item: 'order_items',
    };
    return tableMap[entity] || entity;
  }

  /**
   * Log le mode actuel (utile au démarrage)
   */
  logStatus(): void {
    console.log('══════════════════════════════════════════════');
    console.log(`📊 DataSourceManager: ${this._mode === 'cloud' ? '☁️ CLOUD (Supabase)' : '💻 LOCAL (SQLite)'}`);
    console.log(`   RENDER_CLOUD_MODE: ${env.RENDER_CLOUD_MODE}`);
    console.log(`   USE_SUPABASE_PRODUCTS: ${env.USE_SUPABASE_PRODUCTS}`);
    console.log(`   USE_SUPABASE_TABLES: ${env.USE_SUPABASE_TABLES}`);
    console.log(`   USE_SUPABASE_ORDERS: ${env.USE_SUPABASE_ORDERS}`);
    console.log('══════════════════════════════════════════════');
  }
}

// Singleton exporté
export const dataSource = new DataSourceManager();