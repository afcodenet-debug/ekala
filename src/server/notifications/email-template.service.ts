// Email Template Service - Increment 4: Templates
// Système de templates d'emails avec variables dynamiques

import { getNotificationLogger } from './notification-logger';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  category: string;
  variables?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateRenderOptions {
  variables: Record<string, any>;
  recipientName?: string;
  recipientEmail?: string;
  senderName?: string;
  senderEmail?: string;
}

export interface TemplateRenderResult {
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export class EmailTemplateService {
  private templates: Map<string, EmailTemplate> = new Map();
  private logger = getNotificationLogger();

  constructor() {
    this.loadDefaultTemplates();
  }

  /**
   * Load default templates
   */
  private loadDefaultTemplates(): void {
    // Stock Adjustment Template
    this.registerTemplate({
      id: 'stock_adjustment',
      name: 'Stock Adjustment Notification',
      subject: 'Stock Adjustment - {{productName}}',
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
    .content { padding: 20px 0; }
    .details { background: #f9f9f9; padding: 15px; border-left: 4px solid #007bff; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Stock Adjustment Notification</h2>
    </div>
    <div class="content">
      <p>Hello {{recipientName}},</p>
      <p>A stock adjustment has been made for the following product:</p>
      
      <div class="details">
        <p><strong>Product:</strong> {{productName}}</p>
        <p><strong>SKU:</strong> {{sku}}</p>
        <p><strong>Quantity Before:</strong> {{qtyBefore}}</p>
        <p><strong>Quantity After:</strong> {{qtyAfter}}</p>
        <p><strong>Adjustment:</strong> {{adjustment}}</p>
        <p><strong>Reason:</strong> {{reason}}</p>
        <p><strong>Date:</strong> {{date}}</p>
      </div>
      
      <p>Please review this adjustment in your dashboard.</p>
    </div>
    <div class="footer">
      <p>Sent by {{senderName}} | {{timestamp}}</p>
    </div>
  </div>
</body>
</html>
      `,
      textBody: `
Stock Adjustment Notification

Hello {{recipientName}},

A stock adjustment has been made for the following product:

Product: {{productName}}
SKU: {{sku}}
Quantity Before: {{qtyBefore}}
Quantity After: {{qtyAfter}}
Adjustment: {{adjustment}}
Reason: {{reason}}
Date: {{date}}

Please review this adjustment in your dashboard.

Sent by {{senderName}} | {{timestamp}}
      `,
      category: 'inventory',
      variables: [
        'recipientName',
        'productName',
        'sku',
        'qtyBefore',
        'qtyAfter',
        'adjustment',
        'reason',
        'date',
        'senderName',
        'timestamp',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Low Stock Alert Template
    this.registerTemplate({
      id: 'low_stock_alert',
      name: 'Low Stock Alert',
      subject: '⚠️ Low Stock Alert - {{productName}}',
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #fff3cd; padding: 20px; border-radius: 5px; border-left: 4px solid #ffc107; }
    .content { padding: 20px 0; }
    .details { background: #f9f9f9; padding: 15px; border-left: 4px solid #ffc107; }
    .action { background: #d1ecf1; padding: 15px; border-radius: 5px; margin-top: 15px; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>⚠️ Low Stock Alert</h2>
    </div>
    <div class="content">
      <p>Hello {{recipientName}},</p>
      <p>The following product is running low on stock:</p>
      
      <div class="details">
        <p><strong>Product:</strong> {{productName}}</p>
        <p><strong>SKU:</strong> {{sku}}</p>
        <p><strong>Current Stock:</strong> {{currentStock}}</p>
        <p><strong>Minimum Threshold:</strong> {{minThreshold}}</p>
        <p><strong>Location:</strong> {{location}}</p>
      </div>
      
      <div class="action">
        <p><strong>Recommended Action:</strong></p>
        <p>Please reorder this product soon to avoid stockouts.</p>
      </div>
    </div>
    <div class="footer">
      <p>Sent by {{senderName}} | {{timestamp}}</p>
    </div>
  </div>
</body>
</html>
      `,
      textBody: `
Low Stock Alert

Hello {{recipientName}},

The following product is running low on stock:

Product: {{productName}}
SKU: {{sku}}
Current Stock: {{currentStock}}
Minimum Threshold: {{minThreshold}}
Location: {{location}}

Recommended Action:
Please reorder this product soon to avoid stockouts.

Sent by {{senderName}} | {{timestamp}}
      `,
      category: 'inventory',
      variables: [
        'recipientName',
        'productName',
        'sku',
        'currentStock',
        'minThreshold',
        'location',
        'senderName',
        'timestamp',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Subscription Expiring Template
    this.registerTemplate({
      id: 'subscription_expiring',
      name: 'Subscription Expiring Soon',
      subject: 'Your subscription expires in {{daysRemaining}} days',
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #d1ecf1; padding: 20px; border-radius: 5px; border-left: 4px solid #0dcaf0; }
    .content { padding: 20px 0; }
    .details { background: #f9f9f9; padding: 15px; border-left: 4px solid #0dcaf0; }
    .cta { background: #0dcaf0; color: white; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Subscription Expiring Soon</h2>
    </div>
    <div class="content">
      <p>Hello {{recipientName}},</p>
      <p>Your subscription will expire in <strong>{{daysRemaining}} days</strong>.</p>
      
      <div class="details">
        <p><strong>Plan:</strong> {{planName}}</p>
        <p><strong>Expiration Date:</strong> {{expirationDate}}</p>
        <p><strong>Current Status:</strong> {{status}}</p>
      </div>
      
      <div class="cta">
        <p><strong>Renew Now</strong></p>
        <p>Click here to renew your subscription and continue enjoying our services.</p>
      </div>
      
      <p>If you have any questions, please contact our support team.</p>
    </div>
    <div class="footer">
      <p>Sent by {{senderName}} | {{timestamp}}</p>
    </div>
  </div>
</body>
</html>
      `,
      textBody: `
Subscription Expiring Soon

Hello {{recipientName}},

Your subscription will expire in {{daysRemaining}} days.

Plan: {{planName}}
Expiration Date: {{expirationDate}}
Current Status: {{status}}

Renew Now:
Click here to renew your subscription and continue enjoying our services.

If you have any questions, please contact our support team.

Sent by {{senderName}} | {{timestamp}}
      `,
      category: 'subscription',
      variables: [
        'recipientName',
        'daysRemaining',
        'planName',
        'expirationDate',
        'status',
        'senderName',
        'timestamp',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Payment Success Template
    this.registerTemplate({
      id: 'payment_success',
      name: 'Payment Successful',
      subject: 'Payment Confirmation - {{invoiceNumber}}',
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #d4edda; padding: 20px; border-radius: 5px; border-left: 4px solid #28a745; }
    .content { padding: 20px 0; }
    .details { background: #f9f9f9; padding: 15px; border-left: 4px solid #28a745; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>✅ Payment Successful</h2>
    </div>
    <div class="content">
      <p>Hello {{recipientName}},</p>
      <p>Thank you for your payment. Here are the details:</p>
      
      <div class="details">
        <p><strong>Invoice Number:</strong> {{invoiceNumber}}</p>
        <p><strong>Amount:</strong> {{amount}}</p>
        <p><strong>Payment Method:</strong> {{paymentMethod}}</p>
        <p><strong>Payment Date:</strong> {{paymentDate}}</p>
        <p><strong>Plan:</strong> {{planName}}</p>
        <p><strong>Next Billing Date:</strong> {{nextBillingDate}}</p>
      </div>
      
      <p>Your subscription has been renewed successfully.</p>
    </div>
    <div class="footer">
      <p>Sent by {{senderName}} | {{timestamp}}</p>
    </div>
  </div>
</body>
</html>
      `,
      textBody: `
Payment Successful

Hello {{recipientName}},

Thank you for your payment. Here are the details:

Invoice Number: {{invoiceNumber}}
Amount: {{amount}}
Payment Method: {{paymentMethod}}
Payment Date: {{paymentDate}}
Plan: {{planName}}
Next Billing Date: {{nextBillingDate}}

Your subscription has been renewed successfully.

Sent by {{senderName}} | {{timestamp}}
      `,
      category: 'billing',
      variables: [
        'recipientName',
        'invoiceNumber',
        'amount',
        'paymentMethod',
        'paymentDate',
        'planName',
        'nextBillingDate',
        'senderName',
        'timestamp',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`[EmailTemplateService] Loaded ${this.templates.size} default templates`);
  }

  /**
   * Register a new template
   */
  registerTemplate(template: EmailTemplate): void {
    this.templates.set(template.id, template);
    
    this.logger.log({
      eventType: 'template_registered',
      level: 'info',
      category: 'template',
      message: `Template registered: ${template.id}`,
      data: {
        templateId: template.id,
        name: template.name,
        category: template.category,
      },
    });
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): EmailTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): EmailTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): EmailTemplate[] {
    return this.getAllTemplates().filter(t => t.category === category);
  }

  /**
   * Render template with variables
   */
  render(templateId: string, options: TemplateRenderOptions): TemplateRenderResult {
    const template = this.templates.get(templateId);
    
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Build variables map
    const variables: Record<string, any> = {
      recipientName: options.recipientName || 'User',
      recipientEmail: options.recipientEmail || '',
      senderName: options.senderName || 'Ekala',
      senderEmail: options.senderEmail || 'noreply@ekala.com',
      timestamp: new Date().toLocaleString('fr-FR'),
      ...options.variables,
    };

    // Render subject
    let subject = this.renderString(template.subject, variables);

    // Render HTML body
    let htmlBody = this.renderString(template.htmlBody, variables);

    // Render text body (if exists)
    let textBody = template.textBody 
      ? this.renderString(template.textBody, variables)
      : undefined;

    this.logger.log({
      eventType: 'template_rendered',
      level: 'info',
      category: 'template',
      message: `Template rendered: ${templateId}`,
      data: {
        templateId,
        variables: Object.keys(options.variables),
      },
    });

    return {
      subject,
      htmlBody,
      textBody,
    };
  }

  /**
   * Render string with variable substitution
   */
  private renderString(template: string, variables: Record<string, any>): string {
    let result = template;

    // Replace {{variable}} with value
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const valueStr = value !== undefined && value !== null ? String(value) : '';
      result = result.replace(new RegExp(placeholder, 'g'), valueStr);
    }

    // Replace any remaining {{variable}} with empty string
    result = result.replace(/\{\{.*?\}\}/g, '');

    return result;
  }

  /**
   * Validate template variables
   */
  validateTemplate(templateId: string, variables: Record<string, any>): {
    valid: boolean;
    missingVariables: string[];
  } {
    const template = this.templates.get(templateId);
    
    if (!template) {
      return {
        valid: false,
        missingVariables: [`Template not found: ${templateId}`],
      };
    }

    const missingVariables: string[] = [];

    if (template.variables) {
      for (const variable of template.variables) {
        if (!(variable in variables)) {
          missingVariables.push(variable);
        }
      }
    }

    return {
      valid: missingVariables.length === 0,
      missingVariables,
    };
  }

  /**
   * Update template
   */
  updateTemplate(templateId: string, updates: Partial<EmailTemplate>): EmailTemplate | undefined {
    const template = this.templates.get(templateId);
    
    if (!template) {
      return undefined;
    }

    const updatedTemplate: EmailTemplate = {
      ...template,
      ...updates,
      id: template.id, // Prevent ID change
      createdAt: template.createdAt,
      updatedAt: new Date(),
    };

    this.templates.set(templateId, updatedTemplate);

    this.logger.log({
      eventType: 'template_updated',
      level: 'info',
      category: 'template',
      message: `Template updated: ${templateId}`,
      data: {
        templateId,
        updates: Object.keys(updates),
      },
    });

    return updatedTemplate;
  }

  /**
   * Delete template
   */
  deleteTemplate(templateId: string): boolean {
    const existed = this.templates.has(templateId);
    
    if (existed) {
      this.templates.delete(templateId);
      
      this.logger.log({
        eventType: 'template_deleted',
        level: 'info',
        category: 'template',
        message: `Template deleted: ${templateId}`,
        data: { templateId },
      });
    }

    return existed;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTemplates: number;
    byCategory: Record<string, number>;
    templates: Array<{ id: string; name: string; category: string }>;
  } {
    const byCategory: Record<string, number> = {};
    const templates: Array<{ id: string; name: string; category: string }> = [];

    this.templates.forEach((template) => {
      byCategory[template.category] = (byCategory[template.category] || 0) + 1;
      templates.push({
        id: template.id,
        name: template.name,
        category: template.category,
      });
    });

    return {
      totalTemplates: this.templates.size,
      byCategory,
      templates,
    };
  }

  /**
   * Clear all templates (for testing)
   */
  clear(): void {
    this.templates.clear();
    console.log('[EmailTemplateService] All templates cleared');
  }
}

// Singleton instance
let templateInstance: EmailTemplateService | null = null;

/**
 * Create email template service instance
 */
export function createEmailTemplateService(): EmailTemplateService {
  if (!templateInstance) {
    templateInstance = new EmailTemplateService();
  }
  return templateInstance;
}

/**
 * Get existing email template service instance
 */
export function getEmailTemplateService(): EmailTemplateService | null {
  return templateInstance;
}