# Guide d'Intégration du Système de Notifications V3

## 📋 Vue d'ensemble

Ce guide explique comment intégrer le système de notifications V3 avec les services métier d'Ekala.

## 🎯 Services à Intégrer

### 1. Billing & Subscriptions
- **BillingExpirationService** - Notifications d'expiration
- **SubscriptionApplicationService** - Changements de statut
- **VoucherRedemptionService** - Confirmations de redemption

### 2. Orders & Sales
- **Sales/Orders** - Confirmations de commande
- **Inventory** - Alertes de stock
- **Tables** - Notifications de restaurant

### 3. Platform & SaaS
- **Tenant Management** - Onboarding, expiration
- **User Management** - Invitations, reset password
- **Platform Events** - Maintenance, incidents

## 🔌 Intégration avec NotificationEventBus

### Exemple 1: Billing Expiration

```typescript
// src/server/services/billing-expiration.service.ts

import { NotificationEventBus } from '../notifications/notification-event-bus';
import { NotificationEvent } from '../notifications/notification-event-bus';

export class BillingExpirationService {
  private eventBus: NotificationEventBus;

  constructor() {
    this.eventBus = new NotificationEventBus();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Subscribe to billing events
    this.eventBus.subscribe('BILLING_EXPIRATION_WARNING', async (event) => {
      await this.sendExpirationWarning(event);
    });

    this.eventBus.subscribe('BILLING_EXPIRED', async (event) => {
      await this.sendExpirationNotice(event);
    });
  }

  private async sendExpirationWarning(event: NotificationEvent): Promise<void> {
    const { tenantId, payload } = event;
    
    // Get tenant email
    const tenant = await this.getTenant(tenantId);
    
    // Publish notification event
    await this.eventBus.publish({
      type: 'SEND_EMAIL',
      payload: {
        notificationType: 'billing_warning',
        data: {
          to: tenant.email,
          subject: 'Votre abonnement expire bientôt',
          template: 'billing-expiration-warning',
          variables: {
            tenantName: tenant.name,
            expirationDate: payload.expirationDate,
            daysRemaining: payload.daysRemaining,
          },
        },
        tenantId,
      },
      timestamp: new Date(),
    });
  }

  private async sendExpirationNotice(event: NotificationEvent): Promise<void> {
    // Similar implementation
  }

  private async getTenant(tenantId: number): Promise<any> {
    // Fetch tenant from database
    return { email: 'tenant@example.com', name: 'Tenant Name' };
  }
}
```

### Exemple 2: Order Confirmation

```typescript
// src/server/features/orders/order.service.ts

import { NotificationEventBus } from '../../notifications/notification-event-bus';

export class OrderService {
  private eventBus: NotificationEventBus;

  constructor() {
    this.eventBus = new NotificationEventBus();
  }

  async createOrder(orderData: any): Promise<Order> {
    // Create order
    const order = await this.saveOrder(orderData);
    
    // Send notification
    await this.eventBus.publish({
      type: 'ORDER_CREATED',
      payload: {
        notificationType: 'order_confirmation',
        data: {
          orderId: order.id,
          customerEmail: order.customer.email,
          customerPhone: order.customer.phone,
          items: order.items,
          total: order.total,
          estimatedTime: '30 min',
        },
        tenantId: order.tenantId,
        triggeredBy: 'order-service',
      },
      timestamp: new Date(),
    });

    return order;
  }
}
```

### Exemple 3: Inventory Alert

```typescript
// src/server/products/services/product.service.ts

import { NotificationEventBus } from '../../notifications/notification-event-bus';

export class ProductService {
  private eventBus: NotificationEventBus;

  constructor() {
    this.eventBus = new NotificationEventBus();
  }

  async updateStock(productId: number, quantity: number): Promise<void> {
    const product = await this.getProduct(productId);
    
    if (quantity <= product.minimumStock) {
      // Low stock alert
      await this.eventBus.publish({
        type: 'INVENTORY_LOW_STOCK',
        payload: {
          notificationType: 'inventory_alert',
          data: {
            productName: product.name,
            currentStock: quantity,
            minimumStock: product.minimumStock,
            unit: product.unit,
          },
          tenantId: product.tenantId,
          triggeredBy: 'product-service',
        },
        timestamp: new Date(),
      });
    }
  }
}
```

## 📧 Templates d'E-mails Métier

### Template: Billing Expiration Warning

```typescript
// Déjà créé dans email-template.service.ts
// Template: 'billing-expiration-warning'

const template = {
  subject: 'Votre abonnement expire dans {{daysRemaining}} jours',
  html: `
    <h1>Attention: Expiration prochaine</h1>
    <p>Bonjour {{tenantName}},</p>
    <p>Votre abonnement expire le {{expirationDate}}.</p>
    <p>Il vous reste <strong>{{daysRemaining}} jours</strong> pour renouveler.</p>
    <a href="{{renewalUrl}}">Renouveler maintenant</a>
  `,
};
```

### Template: Order Confirmation

```typescript
// Ajouter au EmailTemplateService

const orderConfirmationTemplate = {
  subject: 'Commande #{{orderId}} confirmée',
  html: `
    <h1>Commande confirmée!</h1>
    <p>Bonjour,</p>
    <p>Votre commande #{{orderId}} a été confirmée.</p>
    <h2>Détails:</h2>
    <ul>
      {{#each items}}
      <li>{{this.name}} x{{this.quantity}} - {{this.price}}€</li>
      {{/each}}
    </ul>
    <p><strong>Total: {{total}}€</strong></p>
    <p>Temps estimé: {{estimatedTime}}</p>
  `,
};
```

## 🔔 Event Handlers Configuration

### Configuration des Handlers

```typescript
// src/server/notifications/notification-handlers.ts

import { NotificationEventBus } from './notification-event-bus';
import { EmailChannelService } from './email-channel.service';
import { SMSChannelService } from './sms-channel.service';
import { SlackChannelService } './slack-channel.service';

export class NotificationHandlers {
  constructor(
    private eventBus: NotificationEventBus,
    private emailService: EmailChannelService,
    private smsService: SMSChannelService,
    private slackService: SlackChannelService
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Email handlers
    this.eventBus.subscribe('SEND_EMAIL', this.handleSendEmail.bind(this));
    
    // SMS handlers
    this.eventBus.subscribe('SEND_SMS', this.handleSendSMS.bind(this));
    
    // Slack handlers
    this.eventBus.subscribe('SEND_SLACK', this.handleSendSlack.bind(this));
    
    // Business event handlers
    this.eventBus.subscribe('ORDER_CREATED', this.handleOrderCreated.bind(this));
    this.eventBus.subscribe('BILLING_EXPIRED', this.handleBillingExpired.bind(this));
    this.eventBus.subscribe('INVENTORY_LOW_STOCK', this.handleLowStock.bind(this));
  }

  private async handleSendEmail(event: any): Promise<void> {
    const { payload } = event;
    await this.emailService.sendEmail({
      to: payload.data.to,
      subject: payload.data.subject,
      html: this.renderTemplate(payload.data.template, payload.data.variables),
      tenantId: payload.tenantId,
    });
  }

  private async handleOrderCreated(event: any): Promise<void> {
    const { payload } = event;
    
    // Send email confirmation
    await this.eventBus.publish({
      type: 'SEND_EMAIL',
      payload: {
        notificationType: 'order_confirmation',
        data: {
          to: payload.data.customerEmail,
          subject: `Commande #${payload.data.orderId} confirmée`,
          template: 'order-confirmation',
          variables: payload.data,
        },
        tenantId: payload.tenantId,
      },
      timestamp: new Date(),
    });

    // Send SMS if phone provided
    if (payload.data.customerPhone) {
      await this.eventBus.publish({
        type: 'SEND_SMS',
        payload: {
          notificationType: 'order_confirmation_sms',
          data: {
            to: payload.data.customerPhone,
            body: `Commande #${payload.data.orderId} confirmée. Temps estimé: ${payload.data.estimatedTime}`,
          },
          tenantId: payload.tenantId,
        },
        timestamp: new Date(),
      });
    }

    // Notify kitchen via Slack
    await this.eventBus.publish({
      type: 'SEND_SLACK',
      payload: {
        notificationType: 'new_order',
        data: {
          channel: '#orders',
          text: `Nouvelle commande #${payload.data.orderId}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Nouvelle commande* #${payload.data.orderId}\nTotal: ${payload.data.total}€`,
              },
            },
          ],
        },
        tenantId: payload.tenantId,
      },
      timestamp: new Date(),
    });
  }

  private async handleBillingExpired(event: any): Promise<void> {
    // Send email to tenant admin
    // Send SMS if configured
    // Notify platform team via Slack
  }

  private async handleLowStock(event: any): Promise<void> {
    // Send alert to inventory manager
    // Notify procurement team
  }

  private renderTemplate(templateName: string, variables: any): string {
    // Template rendering logic
    return `Template: ${templateName}`;
  }
}
```

## 🚀 Initialisation dans le Serveur

```typescript
// src/server/server.ts

import { NotificationEventBus } from './notifications/notification-event-bus';
import { NotificationQueue } from './notifications/notification-queue';
import { EmailChannelService } from './notifications/email-channel.service';
import { SMSChannelService } from './notifications/sms-channel.service';
import { SlackChannelService } from './notifications/slack-channel.service';
import { ChannelRouterService } from './notifications/channel-router.service';
import { NotificationHandlers } from './notifications/notification-handlers';

async function startServer() {
  // Initialize notification services
  const eventBus = new NotificationEventBus();
  const queue = new NotificationQueue({
    maxSize: 10000,
    maxRetries: 3,
    retryDelay: 1000,
  });

  // Initialize channel services
  const emailService = new EmailChannelService({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    fromEmail: process.env.FROM_EMAIL,
  });

  const smsService = new SMSChannelService({
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
    enabled: !!process.env.TWILIO_ACCOUNT_SID,
  });

  const slackService = new SlackChannelService({
    webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    enabled: !!process.env.SLACK_WEBHOOK_URL,
  });

  const channelRouter = new ChannelRouterService({
    email: {
      enabled: true,
      smtpHost: process.env.SMTP_HOST || '',
      smtpPort: parseInt(process.env.SMTP_PORT || '587'),
      smtpUser: process.env.SMTP_USER || '',
      smtpPass: process.env.SMTP_PASS || '',
      fromEmail: process.env.FROM_EMAIL || '',
    },
    sms: {
      enabled: !!process.env.TWILIO_ACCOUNT_SID,
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    },
    slack: {
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    },
  });

  // Register event handlers
  const handlers = new NotificationHandlers(
    eventBus,
    emailService,
    smsService,
    slackService
  );

  // Start queue processor
  queue.startProcessing();

  // Make services available globally or via dependency injection
  (global as any).notificationServices = {
    eventBus,
    queue,
    emailService,
    smsService,
    slackService,
    channelRouter,
    handlers,
  };

  console.log('✅ Notification system initialized');
}
```

## 🔧 Configuration des Variables d'Environnement

### Fichier .env

```bash
# ===========================================
# NOTIFICATION SYSTEM V3 CONFIGURATION
# ===========================================

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@ekala.com

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890

# Push (Firebase)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# Webhook
WEBHOOK_SECRET=your_webhook_secret

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Notification Queue
NOTIFICATION_QUEUE_MAX_SIZE=10000
NOTIFICATION_QUEUE_MAX_RETRIES=3
NOTIFICATION_QUEUE_RETRY_DELAY=1000
```

## 📊 Monitoring et Observabilité

### Métriques à Surveiller

```typescript
// Métriques clés
- notification.queue.size: Taille de la queue
- notification.queue.processing_time: Temps de traitement
- notification.channel.email.success_rate: Taux de succès email
- notification.channel.sms.success_rate: Taux de succès SMS
- notification.channel.slack.success_rate: Taux de succès Slack
- notification.circuit_breaker.state: État du circuit breaker
- notification.dlq.size: Taille de la Dead Letter Queue
```

### Alertes à Configurer

```typescript
// Alertes critiques
- Queue size > 5000: ⚠️ Queue saturée
- DLQ size > 100: 🚨 Messages en erreur critique
- Circuit breaker ouvert: 🚨 Service email down
- SMTP health check échoue: ⚠️ Problème SMTP
- Processing time > 5s: ⚠️ Performance dégradée
```

## 🧪 Tests d'Intégration

### Test 1: Order Flow

```typescript
// Test complet: Order → Notification

async function testOrderNotification() {
  const order = await orderService.createOrder({
    customer: {
      email: 'test@example.com',
      phone: '+33612345678',
    },
    items: [...],
    total: 150,
  });

  // Wait for async processing
  await sleep(2000);

  // Verify email sent
  const emails = await emailService.getSentEmails();
  expect(emails).toContainEqual(
    expect.objectContaining({
      to: 'test@example.com',
      subject: expect.stringContaining('confirmée'),
    })
  );

  // Verify SMS sent
  const sms = await smsService.getSentSMS();
  expect(sms).toContainEqual(
    expect.objectContaining({
      to: '+33612345678',
      body: expect.stringContaining('confirmée'),
    })
  );
}
```

### Test 2: Billing Expiration

```typescript
async function testBillingExpiration() {
  // Simulate expiration warning
  await eventBus.publish({
    type: 'BILLING_EXPIRATION_WARNING',
    payload: {
      tenantId: 1,
      expirationDate: '2026-07-15',
      daysRemaining: 7,
    },
    timestamp: new Date(),
  });

  await sleep(2000);

  // Verify notification sent
  const emails = await emailService.getSentEmails();
  expect(emails.length).toBeGreaterThan(0);
}
```

## 📦 Déploiement

### Checklist de Déploiement

- [ ] Installer les dépendances: `npm install twilio @firebase-admin/messaging`
- [ ] Configurer les variables d'environnement
- [ ] Tester SMTP: `npm run test:email`
- [ ] Tester Twilio: `npm run test:sms`
- [ ] Tester Slack: `npm run test:slack`
- [ ] Vérifier les health checks: `GET /api/notifications/health`
- [ ] Monitorer la queue: `GET /api/notifications/queue/stats`
- [ ] Configurer les alertes monitoring
- [ ] Documenter les runbooks

### Commandes Utiles

```bash
# Tester le système de notifications
npm run test:notifications

# Vérifier la santé des canaux
curl http://localhost:3000/api/notifications/health

# Voir les statistiques
curl http://localhost:3000/api/notifications/stats

# Vider la Dead Letter Queue (si nécessaire)
npm run notifications:clear-dlq

# Rejouer les messages en erreur
npm run notifications:replay-dlq
```

## 🎓 Prochaines Étapes

1. **Intégration Services Métier** (ce guide)
2. **Tests d'intégration complets**
3. **Documentation API** (endpoints REST)
4. **Dashboard de monitoring**
5. **Tests de charge**
6. **Déploiement production**

## ✅ Statut

- [x] Architecture complète
- [x] 8 incréments implémentés
- [x] 5 canaux opérationnels
- [x] Documentation technique
- [ ] Intégration services métier
- [ ] Tests d'intégration
- [ ] Déploiement production

**Système prêt pour intégration!** 🚀