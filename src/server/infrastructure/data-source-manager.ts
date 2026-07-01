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

export type EnvironmentMode = 'local' | 'cloud';

class DataSourceManager {
  private _mode: EnvironmentMode;

  constructor() {
    this._mode = this.detectMode();
  }

  /**
   * Détecte automatiquement l'environnement :
   * - RENDER_CLOUD_MODE=true → cloud (Supabase)
   * - USE_SUPABASE_PRODUCTS=true → cloud (Supabase)
   * - Sinon → local (SQLite)
   */
  private detectMode(): EnvironmentMode {
    if (env.RENDER_CLOUD_MODE || env.USE_SUPABASE_PRODUCTS) {
      return 'cloud';
    }
    return 'local';
  }

  /** Retourne le mode actuel */
  get mode(): EnvironmentMode {
    return this._mode;
  }

  /** Vrai si on est en mode cloud (Supabase) */
  isCloudMode(): boolean {
    return this._mode === 'cloud';
  }

  /** Vrai si on est en mode local (SQLite) */
  isLocalMode(): boolean {
    return this._mode === 'local';
  }

  /**
   * Vérifie si une table spécifique doit utiliser Supabase.
   * Permet un contrôle granulaire par table.
   */
  isTableCloud(tableName: string): boolean {
    if (this.isCloudMode()) return true;
    
    // Tables spécifiques qui peuvent être en mode Supabase même en local
    const tableOverrides: Record<string, boolean> = {
      products: env.USE_SUPABASE_PRODUCTS,
      tables: env.USE_SUPABASE_TABLES,
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
    console.log('══════════════════════════════════════════════');
  }
}

// Singleton exporté
export const dataSource = new DataSourceManager();