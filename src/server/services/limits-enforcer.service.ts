/**
 * Limits Enforcer Service
 * Vérifie en temps réel les limites d'utilisation des plans
 * 
 * Fonctionnalités:
 * - Vérification max_users, max_tables, max_products, max_orders_per_month
 * - Alertes avant dépassement
 * - Blocage automatique si limite atteinte
 */

import { db } from '../db/database';

export interface PlanLimits {
  max_users: number | null;
  max_tables: number | null;
  max_products: number | null;
  max_orders_per_month: number | null;
  max_branches: number | null;
}

export interface UsageStats {
  users: number;
  tables: number;
  products: number;
  orders_this_month: number;
  branches: number;
}

export interface LimitCheckResult {
  allowed: boolean;
  limit: PlanLimits;
  usage: UsageStats;
  warnings: string[];
  violations: string[];
}

export class LimitsEnforcerService {
  private static instance: LimitsEnforcerService;
  private cache = new Map<string, { result: LimitCheckResult; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): LimitsEnforcerService {
    if (!LimitsEnforcerService.instance) {
      LimitsEnforcerService.instance = new LimitsEnforcerService();
    }
    return LimitsEnforcerService.instance;
  }

  /**
   * Vérifie toutes les limites pour un tenant
   */
  async checkLimits(tenantId: number): Promise<LimitCheckResult> {
    // Vérifier le cache
    const cacheKey = `limits_${tenantId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    try {
      // Récupérer le plan actif du tenant
      const planLimits = await this.getPlanLimits(tenantId);
      
      if (!planLimits) {
        return {
          allowed: false,
          limit: {
            max_users: 0,
            max_tables: 0,
            max_products: 0,
            max_orders_per_month: 0,
            max_branches: 0,
          },
          usage: { users: 0, tables: 0, products: 0, orders_this_month: 0, branches: 0 },
          warnings: ['Aucun plan actif'],
          violations: ['Aucun abonnement actif'],
        };
      }

      // Récupérer l'usage actuel
      const usage = await this.getUsageStats(tenantId);

      // Vérifier les limites
      const warnings: string[] = [];
      const violations: string[] = [];
      let allowed = true;

      // Vérifier max_users (à 80% et 100%)
      if (planLimits.max_users && planLimits.max_users > 0) {
        const usagePercent = (usage.users / planLimits.max_users) * 100;
        if (usagePercent >= 100) {
          violations.push(`Limite d'utilisateurs atteinte (${usage.users}/${planLimits.max_users})`);
          allowed = false;
        } else if (usagePercent >= 80) {
          warnings.push(`Attention: ${usagePercent.toFixed(0)}% de la limite utilisateurs atteinte (${usage.users}/${planLimits.max_users})`);
        }
      }

      // Vérifier max_tables
      if (planLimits.max_tables && planLimits.max_tables > 0) {
        const usagePercent = (usage.tables / planLimits.max_tables) * 100;
        if (usagePercent >= 100) {
          violations.push(`Limite de tables atteinte (${usage.tables}/${planLimits.max_tables})`);
          allowed = false;
        } else if (usagePercent >= 80) {
          warnings.push(`Attention: ${usagePercent.toFixed(0)}% de la limite tables atteinte (${usage.tables}/${planLimits.max_tables})`);
        }
      }

      // Vérifier max_products
      if (planLimits.max_products && planLimits.max_products > 0) {
        const usagePercent = (usage.products / planLimits.max_products) * 100;
        if (usagePercent >= 100) {
          violations.push(`Limite de produits atteinte (${usage.products}/${planLimits.max_products})`);
          allowed = false;
        } else if (usagePercent >= 80) {
          warnings.push(`Attention: ${usagePercent.toFixed(0)}% de la limite produits atteinte (${usage.products}/${planLimits.max_products})`);
        }
      }

      // Vérifier max_orders_per_month
      if (planLimits.max_orders_per_month && planLimits.max_orders_per_month > 0) {
        const usagePercent = (usage.orders_this_month / planLimits.max_orders_per_month) * 100;
        if (usagePercent >= 100) {
          violations.push(`Limite de commandes mensuelles atteinte (${usage.orders_this_month}/${planLimits.max_orders_per_month})`);
          allowed = false;
        } else if (usagePercent >= 80) {
          warnings.push(`Attention: ${usagePercent.toFixed(0)}% de la limite commandes mensuelles atteinte (${usage.orders_this_month}/${planLimits.max_orders_per_month})`);
        }
      }

      // Vérifier max_branches
      if (planLimits.max_branches && planLimits.max_branches > 0) {
        const usagePercent = (usage.branches / planLimits.max_branches) * 100;
        if (usagePercent >= 100) {
          violations.push(`Limite de succursales atteinte (${usage.branches}/${planLimits.max_branches})`);
          allowed = false;
        } else if (usagePercent >= 80) {
          warnings.push(`Attention: ${usagePercent.toFixed(0)}% de la limite succursales atteinte (${usage.branches}/${planLimits.max_branches})`);
        }
      }

      const result: LimitCheckResult = {
        allowed,
        limit: planLimits,
        usage,
        warnings,
        violations,
      };

      // Mettre en cache
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      console.error(`[LimitsEnforcer] Error checking limits for tenant ${tenantId}:`, error);
      
      // En cas d'erreur, on autorise mais on log
      return {
        allowed: true,
        limit: {
          max_users: null,
          max_tables: null,
          max_products: null,
          max_orders_per_month: null,
          max_branches: null,
        },
        usage: { users: 0, tables: 0, products: 0, orders_this_month: 0, branches: 0 },
        warnings: ['Erreur lors de la vérification des limites'],
        violations: [],
      };
    }
  }

  /**
   * Récupère les limites du plan actif d'un tenant
   */
  private async getPlanLimits(tenantId: number): Promise<PlanLimits | null> {
    try {
      const query = `
        SELECT 
          p.max_users,
          p.max_tables,
          p.max_products,
          p.max_orders_per_month,
          p.max_branches
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.tenant_id = ?
          AND s.status IN ('active', 'trial', 'grace')
        ORDER BY s.created_at DESC
        LIMIT 1
      `;

      const result = db.prepare(query).get(tenantId) as any;
      
      if (!result) {
        return null;
      }

      return {
        max_users: result.max_users,
        max_tables: result.max_tables,
        max_products: result.max_products,
        max_orders_per_month: result.max_orders_per_month,
        max_branches: result.max_branches || 1,
      };
    } catch (error) {
      console.error(`[LimitsEnforcer] Error getting plan limits for tenant ${tenantId}:`, error);
      return null;
    }
  }

  /**
   * Récupère les statistiques d'utilisation d'un tenant
   */
  private async getUsageStats(tenantId: number): Promise<UsageStats> {
    try {
      // Compter les utilisateurs actifs
      const usersCount = db.prepare(
        'SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND is_active = 1'
      ).get(tenantId) as any;

      // Compter les tables
      const tablesCount = db.prepare(
        'SELECT COUNT(*) as count FROM restaurant_tables WHERE tenant_id = ?'
      ).get(tenantId) as any;

      // Compter les produits
      const productsCount = db.prepare(
        'SELECT COUNT(*) as count FROM products WHERE tenant_id = ?'
      ).get(tenantId) as any;

      // Compter les commandes du mois en cours
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0, 0, 0, 0);
      
      const ordersCount = db.prepare(
        `SELECT COUNT(*) as count FROM orders 
         WHERE tenant_id = ? 
         AND created_at >= ?
         AND status != 'cancelled'`
      ).get(tenantId, firstDayOfMonth.toISOString()) as any;

      // Compter les succursales (si la table existe)
      let branchesCount = { count: 0 };
      try {
        branchesCount = db.prepare(
          'SELECT COUNT(*) as count FROM branches WHERE tenant_id = ?'
        ).get(tenantId) as any;
      } catch (error) {
        // Table branches n'existe pas encore
      }

      return {
        users: usersCount.count,
        tables: tablesCount.count,
        products: productsCount.count,
        orders_this_month: ordersCount.count,
        branches: branchesCount.count,
      };
    } catch (error) {
      console.error(`[LimitsEnforcer] Error getting usage stats for tenant ${tenantId}:`, error);
      return {
        users: 0,
        tables: 0,
        products: 0,
        orders_this_month: 0,
        branches: 0,
      };
    }
  }

  /**
   * Vérifie si une action spécifique est autorisée
   */
  async checkAction(tenantId: number, action: 'create_user' | 'create_table' | 'create_product' | 'create_order'): Promise<{ allowed: boolean; reason?: string }> {
    const result = await this.checkLimits(tenantId);

    if (!result.allowed) {
      return {
        allowed: false,
        reason: result.violations[0] || 'Limite atteinte',
      };
    }

    // Vérifications spécifiques par action
    switch (action) {
      case 'create_user':
        if (result.limit.max_users && result.usage.users >= result.limit.max_users) {
          return {
            allowed: false,
            reason: `Limite d'utilisateurs atteinte (${result.usage.users}/${result.limit.max_users})`,
          };
        }
        break;

      case 'create_table':
        if (result.limit.max_tables && result.usage.tables >= result.limit.max_tables) {
          return {
            allowed: false,
            reason: `Limite de tables atteinte (${result.usage.tables}/${result.limit.max_tables})`,
          };
        }
        break;

      case 'create_product':
        if (result.limit.max_products && result.usage.products >= result.limit.max_products) {
          return {
            allowed: false,
            reason: `Limite de produits atteinte (${result.usage.products}/${result.limit.max_products})`,
          };
        }
        break;

      case 'create_order':
        if (result.limit.max_orders_per_month && result.usage.orders_this_month >= result.limit.max_orders_per_month) {
          return {
            allowed: false,
            reason: `Limite de commandes mensuelles atteinte (${result.usage.orders_this_month}/${result.limit.max_orders_per_month})`,
          };
        }
        break;
    }

    return { allowed: true };
  }

  /**
   * Invalide le cache pour un tenant
   */
  invalidateCache(tenantId: number): void {
    const cacheKey = `limits_${tenantId}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Invalide tout le cache
   */
  invalidateAllCache(): void {
    this.cache.clear();
  }

  /**
   * Obtient un résumé des limites pour le frontend
   */
  async getLimitsSummary(tenantId: number): Promise<{
    limits: PlanLimits;
    usage: UsageStats;
    percentages: {
      users: number;
      tables: number;
      products: number;
      orders: number;
      branches: number;
    };
    warnings: string[];
    violations: string[];
  }> {
    const result = await this.checkLimits(tenantId);

    const percentages = {
      users: result.limit.max_users ? (result.usage.users / result.limit.max_users) * 100 : 0,
      tables: result.limit.max_tables ? (result.usage.tables / result.limit.max_tables) * 100 : 0,
      products: result.limit.max_products ? (result.usage.products / result.limit.max_products) * 100 : 0,
      orders: result.limit.max_orders_per_month ? (result.usage.orders_this_month / result.limit.max_orders_per_month) * 100 : 0,
      branches: result.limit.max_branches ? (result.usage.branches / result.limit.max_branches) * 100 : 0,
    };

    return {
      limits: result.limit,
      usage: result.usage,
      percentages,
      warnings: result.warnings,
      violations: result.violations,
    };
  }
}

// Export singleton
export const limitsEnforcer = LimitsEnforcerService.getInstance();