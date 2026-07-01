// Notification Policy Engine V3
// Routes notifications to the right channels based on rules

import { db } from '../db/database';

export type NotificationEvent = 
  | 'order.created'
  | 'order.confirmed'
  | 'order.completed'
  | 'order.cancelled'
  | 'payment.received'
  | 'payment.failed'
  | 'inventory.low_stock'
  | 'inventory.out_of_stock'
  | 'inventory.stock_adjusted'
  | 'table.status_changed'
  | 'staff.assigned'
  | 'billing.expiring'
  | 'billing.expired'
  | 'billing.renewed'
  | 'billing.payment_failed'
  | 'system.maintenance'
  | 'system.update'
  | 'platform.user_invited'
  | 'platform.tenant_created';

interface PolicyRule {
  id: string;
  event: NotificationEvent;
  channels: string[];
  priority: string;
  severity: string;
  templates: Record<string, { title: string; message: string }>;
  conditions?: Record<string, any>;
  roles?: string[];
  rate_limit?: number;
  merge_key?: string;
  stop_on_match?: boolean;
}

// Default policy rules
const DEFAULT_POLICIES: PolicyRule[] = [
  // ── Orders ──────────────────────────────────────────────
  {
    id: 'order-created',
    event: 'order.created',
    channels: ['toast', 'badge', 'center'],
    priority: 'medium',
    severity: 'info',
    templates: {
      fr: { title: 'Nouvelle commande', message: 'Une nouvelle commande a été créée' },
      en: { title: 'New order', message: 'A new order has been created' },
    },
    roles: ['waiter', 'cashier', 'manager', 'admin'],
  },
  {
    id: 'order-confirmed',
    event: 'order.confirmed',
    channels: ['toast', 'badge'],
    priority: 'medium',
    severity: 'info',
    templates: {
      fr: { title: 'Commande confirmée', message: 'La commande a été confirmée' },
      en: { title: 'Order confirmed', message: 'The order has been confirmed' },
    },
  },
  {
    id: 'order-completed',
    event: 'order.completed',
    channels: ['toast'],
    priority: 'low',
    severity: 'success',
    templates: {
      fr: { title: 'Commande terminée', message: 'La commande a été complétée avec succès' },
      en: { title: 'Order completed', message: 'Order completed successfully' },
    },
  },

  // ── Payments ────────────────────────────────────────────
  {
    id: 'payment-received',
    event: 'payment.received',
    channels: ['toast', 'center'],
    priority: 'high',
    severity: 'success',
    templates: {
      fr: { title: 'Paiement reçu', message: 'Le paiement a été reçu avec succès' },
      en: { title: 'Payment received', message: 'Payment received successfully' },
    },
    merge_key: 'payment',
  },
  {
    id: 'payment-failed',
    event: 'payment.failed',
    channels: ['toast', 'badge', 'center', 'banner'],
    priority: 'critical',
    severity: 'error',
    templates: {
      fr: { title: 'Échec de paiement', message: 'Le paiement a échoué. Veuillez réessayer.' },
      en: { title: 'Payment failed', message: 'Payment failed. Please try again.' },
    },
  },

  // ── Inventory ───────────────────────────────────────────
  {
    id: 'low-stock',
    event: 'inventory.low_stock',
    channels: ['badge', 'center'],
    priority: 'high',
    severity: 'warning',
    templates: {
      fr: { title: 'Stock faible', message: 'Un produit atteint le seuil minimum de stock' },
      en: { title: 'Low stock', message: 'A product has reached minimum stock level' },
    },
    roles: ['manager', 'admin'],
    rate_limit: 3600000, // 1 hour
    merge_key: 'inventory',
  },
  {
    id: 'out-of-stock',
    event: 'inventory.out_of_stock',
    channels: ['toast', 'badge', 'center', 'banner'],
    priority: 'critical',
    severity: 'error',
    templates: {
      fr: { title: 'Rupture de stock', message: 'Un produit est en rupture de stock' },
      en: { title: 'Out of stock', message: 'A product is out of stock' },
    },
    roles: ['manager', 'admin'],
    merge_key: 'inventory',
  },

  // ── Billing ─────────────────────────────────────────────
  {
    id: 'billing-expiring',
    event: 'billing.expiring',
    channels: ['toast', 'badge', 'center', 'banner', 'email'],
    priority: 'high',
    severity: 'warning',
    templates: {
      fr: { title: 'Abonnement expire bientôt', message: 'Votre abonnement expire dans {days} jours' },
      en: { title: 'Subscription expiring', message: 'Your subscription expires in {days} days' },
    },
    roles: ['owner', 'admin'],
    rate_limit: 86400000, // 24 hours
  },
  {
    id: 'billing-expired',
    event: 'billing.expired',
    channels: ['banner', 'email'],
    priority: 'critical',
    severity: 'error',
    templates: {
      fr: { title: 'Abonnement expiré', message: 'Votre abonnement a expiré. Renouvelez-le pour continuer.' },
      en: { title: 'Subscription expired', message: 'Your subscription has expired. Renew to continue.' },
    },
    roles: ['owner', 'admin'],
  },

  // ── System ──────────────────────────────────────────────
  {
    id: 'system-maintenance',
    event: 'system.maintenance',
    channels: ['banner'],
    priority: 'low',
    severity: 'info',
    templates: {
      fr: { title: 'Maintenance planifiée', message: 'Le système sera en maintenance le {date}' },
      en: { title: 'Scheduled maintenance', message: 'System maintenance scheduled for {date}' },
    },
    roles: ['owner', 'admin', 'manager'],
  },
];

export class NotificationPolicyEngine {
  private policies: PolicyRule[] = DEFAULT_POLICIES;
  private rateLimitMap: Map<string, number> = new Map();

  constructor() {
    this.loadPoliciesFromDb();
  }

  private loadPoliciesFromDb() {
    try {
      if (!db) return;
      const rows = db.prepare(
        'SELECT * FROM notification_policies WHERE enabled = 1 ORDER BY "order" ASC'
      ).all() as any[];

      if (rows && rows.length > 0) {
        this.policies = rows.map((row: any) => ({
          id: row.policy_id,
          event: row.event_types ? JSON.parse(row.event_types)[0] : 'system.update',
          channels: row.actions ? JSON.parse(row.actions).channels || ['toast'] : ['toast'],
          priority: row.priorities ? JSON.parse(row.priorities)[0] || 'medium' : 'medium',
          severity: 'info',
          templates: {
            fr: { title: 'Notification', message: 'You have a new notification' },
          },
          roles: row.roles ? JSON.parse(row.roles) : undefined,
          conditions: row.conditions ? JSON.parse(row.conditions) : undefined,
        }));
      }
    } catch (error) {
      console.warn('[PolicyEngine] Failed to load policies from DB, using defaults');
    }
  }

  evaluate(
    event: NotificationEvent,
    data: any = {},
    context: { tenant_id: string; user_id?: string; role?: string; language?: string } = { tenant_id: 'default', language: 'fr' }
  ): Array<{ channels: string[]; title: string; message: string; priority: string; severity: string }> {
    const results: Array<{ channels: string[]; title: string; message: string; priority: string; severity: string }> = [];

    for (const policy of this.policies) {
      // Check event match
      if (policy.event !== event) continue;

      // Check rate limit
      if (policy.rate_limit) {
        const key = `${policy.id}:${context.tenant_id}`;
        const lastSent = this.rateLimitMap.get(key) || 0;
        if (Date.now() - lastSent < policy.rate_limit) continue;
        this.rateLimitMap.set(key, Date.now());
      }

      // Check role
      if (policy.roles && context.role && !policy.roles.includes(context.role)) continue;

      // Check conditions
      if (policy.conditions) {
        if (!this.evaluateConditions(policy.conditions, data)) continue;
      }

      // Get template
      const lang = context.language || 'fr';
      const templates = policy.templates[lang] || policy.templates['fr'] || { title: 'Notification', message: '' };
      
      // Apply template variables
      const title = this.applyTemplate(templates.title, data);
      const message = this.applyTemplate(templates.message, data);

      results.push({
        channels: policy.channels,
        title,
        message,
        priority: policy.priority,
        severity: policy.severity,
      });

      // Stop on match if configured
      if (policy.stop_on_match) break;
    }

    return results;
  }

  private evaluateConditions(conditions: Record<string, any>, data: any): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      const actualValue = this.getNestedValue(data, key);
      
      if (typeof value === 'object' && value !== null) {
        if (value.gt !== undefined && !(actualValue > value.gt)) return false;
        if (value.lt !== undefined && !(actualValue < value.lt)) return false;
        if (value.gte !== undefined && !(actualValue >= value.gte)) return false;
        if (value.lte !== undefined && !(actualValue <= value.lte)) return false;
        if (value.in !== undefined && !value.in.includes(actualValue)) return false;
        if (value.not_in !== undefined && value.not_in.includes(actualValue)) return false;
        if (value.exists !== undefined && (value.exists ? actualValue === undefined : actualValue !== undefined)) return false;
      } else {
        if (actualValue !== value) return false;
      }
    }
    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private applyTemplate(template: string, data: any): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      const value = this.getNestedValue(data, key);
      return value !== undefined ? String(value) : `{${key}}`;
    });
  }

  addPolicy(policy: PolicyRule) {
    this.policies.unshift(policy);
  }

  clearCache() {
    this.rateLimitMap.clear();
  }
}

// Singleton
let policyEngineInstance: NotificationPolicyEngine | null = null;

export function getNotificationPolicyEngine(): NotificationPolicyEngine {
  if (!policyEngineInstance) {
    policyEngineInstance = new NotificationPolicyEngine();
  }
  return policyEngineInstance;
}