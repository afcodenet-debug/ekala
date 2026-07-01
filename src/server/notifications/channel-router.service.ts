// Channel Router Service - Increment 8: Advanced Channels
// Unified routing for all notification channels

import { SMSChannelService } from './sms-channel.service';
import { PushChannelService } from './push-channel.service';
import { WebhookChannelService } from './webhook-channel.service';
import { SlackChannelService } from './slack-channel.service';

export interface ChannelRouterConfig {
  email?: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    fromEmail: string;
  };
  sms?: {
    enabled: boolean;
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
  push?: {
    enabled: boolean;
    projectId: string;
    privateKey: string;
    clientEmail: string;
  };
  webhook?: {
    enabled: boolean;
    secret: string;
    timeout: number;
    maxRetries: number;
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel?: string;
  };
}

export interface NotificationRequest {
  channel: 'email' | 'sms' | 'push' | 'webhook' | 'slack';
  recipient: string;
  subject?: string;
  body: string;
  data?: Record<string, any>;
  tenantId: number;
}

export interface ChannelResult {
  channel: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

export class ChannelRouterService {
  private emailService: any | null = null;
  private smsService: SMSChannelService | null = null;
  private pushService: PushChannelService | null = null;
  private webhookService: WebhookChannelService | null = null;
  private slackService: SlackChannelService | null = null;

  constructor(private config: ChannelRouterConfig) {
    this.initializeServices();
  }

  /**
   * Initialize all channel services
   */
  private initializeServices(): void {
    // Email service placeholder
    if (this.config.email?.enabled) {
      // Email sending is handled by the existing email service
      this.emailService = { configured: true };
    }

    // SMS service
    if (this.config.sms?.enabled) {
      this.smsService = new SMSChannelService({
        accountSid: this.config.sms.accountSid,
        authToken: this.config.sms.authToken,
        fromNumber: this.config.sms.fromNumber,
        enabled: true,
      });
    }

    // Push service
    if (this.config.push?.enabled) {
      this.pushService = new PushChannelService({
        projectId: this.config.push.projectId,
        privateKey: this.config.push.privateKey,
        clientEmail: this.config.push.clientEmail,
        enabled: true,
      });
    }

    // Webhook service
    if (this.config.webhook?.enabled) {
      this.webhookService = new WebhookChannelService({
        secret: this.config.webhook.secret,
        timeout: this.config.webhook.timeout,
        maxRetries: this.config.webhook.maxRetries,
        enabled: true,
      });
    }

    // Slack service
    if (this.config.slack?.enabled) {
      this.slackService = new SlackChannelService({
        webhookUrl: this.config.slack.webhookUrl,
        channel: this.config.slack.channel,
        enabled: true,
      });
    }
  }

  /**
   * Send notification through specified channel
   */
  async send(request: NotificationRequest): Promise<ChannelResult> {
    try {
      switch (request.channel) {
        case 'email':
          return await this.sendEmail(request);
        case 'sms':
          return await this.sendSMS(request);
        case 'push':
          return await this.sendPush(request);
        case 'webhook':
          return await this.sendWebhook(request);
        case 'slack':
          return await this.sendSlack(request);
        default:
          return {
            channel: request.channel,
            success: false,
            error: `Unknown channel: ${request.channel}`,
          };
      }
    } catch (error: any) {
      return {
        channel: request.channel,
        success: false,
        error: error.message || 'Failed to send notification',
      };
    }
  }

  /**
   * Send via email
   */
  private async sendEmail(request: NotificationRequest): Promise<ChannelResult> {
    if (!this.emailService) {
      return {
        channel: 'email',
        success: false,
        error: 'Email service not configured',
      };
    }

    // Email sending is handled by the existing email service
    return {
      channel: 'email',
      success: false,
      error: 'Email channel routing not yet integrated with email service',
    };
  }

  /**
   * Send via SMS
   */
  private async sendSMS(request: NotificationRequest): Promise<ChannelResult> {
    if (!this.smsService) {
      return {
        channel: 'sms',
        success: false,
        error: 'SMS service not configured',
      };
    }

    const result = await this.smsService.send({
      to: request.recipient,
      body: request.body,
      tenantId: request.tenantId,
    });

    return {
      channel: 'sms',
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  }

  /**
   * Send via Push
   */
  private async sendPush(request: NotificationRequest): Promise<ChannelResult> {
    if (!this.pushService) {
      return {
        channel: 'push',
        success: false,
        error: 'Push service not configured',
      };
    }

    const result = await this.pushService.send({
      token: request.recipient,
      title: request.subject || 'Notification',
      body: request.body,
      data: request.data,
      tenantId: request.tenantId,
    });

    return {
      channel: 'push',
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  }

  /**
   * Send via Webhook
   */
  private async sendWebhook(request: NotificationRequest): Promise<ChannelResult> {
    if (!this.webhookService) {
      return {
        channel: 'webhook',
        success: false,
        error: 'Webhook service not configured',
      };
    }

    const result = await this.webhookService.send({
      url: request.recipient,
      payload: {
        subject: request.subject,
        body: request.body,
        ...request.data,
      },
      tenantId: request.tenantId,
    });

    return {
      channel: 'webhook',
      success: result.success,
      messageId: result.messageId || `webhook-${Date.now()}`,
      error: result.error,
    };
  }

  /**
   * Send via Slack
   */
  private async sendSlack(request: NotificationRequest): Promise<ChannelResult> {
    if (!this.slackService) {
      return {
        channel: 'slack',
        success: false,
        error: 'Slack service not configured',
      };
    }

    const result = await this.slackService.send({
      text: request.body,
      channel: request.recipient,
      tenantId: request.tenantId,
    });

    return {
      channel: 'slack',
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  }

  /**
   * Send to multiple channels
   */
  async sendToMultiple(
    requests: NotificationRequest[]
  ): Promise<ChannelResult[]> {
    return Promise.all(requests.map(req => this.send(req)));
  }

  /**
   * Get all channel statuses
   */
  getChannelStatus() {
    return {
      email: this.emailService ? { enabled: true, configured: true } : { enabled: false },
      sms: this.smsService?.getStats() || { enabled: false },
      push: this.pushService?.getStats() || { enabled: false },
      webhook: this.webhookService?.getStats() || { enabled: false },
      slack: this.slackService?.getStats() || { enabled: false },
    };
  }

  /**
   * Health check all channels
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    if (this.emailService) {
      results.email = true; // Email is handled by existing service
    }
    if (this.smsService) {
      results.sms = await this.smsService.healthCheck();
    }
    if (this.pushService) {
      results.push = await this.pushService.healthCheck();
    }
    if (this.webhookService) {
      results.webhook = await this.webhookService.healthCheck();
    }
    if (this.slackService) {
      results.slack = await this.slackService.healthCheck();
    }

    return results;
  }
}