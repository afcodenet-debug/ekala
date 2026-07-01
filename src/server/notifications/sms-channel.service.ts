// SMS Channel Service - Increment 8: Advanced Channels
// Twilio integration for SMS notifications

import twilio from 'twilio';

export interface SMSChannelConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  enabled: boolean;
}

export interface SMSMessage {
  to: string;
  body: string;
  tenantId: number;
}

export interface SMSChannelResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SMSChannelService {
  private client: twilio.Twilio | null = null;
  private config: SMSChannelConfig;
  private enabled: boolean;

  constructor(config: SMSChannelConfig) {
    this.config = config;
    this.enabled = config.enabled;

    if (this.enabled && config.accountSid && config.authToken) {
      this.client = twilio(config.accountSid, config.authToken);
    }
  }

  /**
   * Send SMS message
   */
  async send(message: SMSMessage): Promise<SMSChannelResult> {
    if (!this.enabled || !this.client) {
      return {
        success: false,
        error: 'SMS channel is not enabled or not configured',
      };
    }

    try {
      const result = await this.client.messages.create({
        body: message.body,
        from: this.config.fromNumber,
        to: message.to,
      });

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send SMS',
      };
    }
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulk(messages: SMSMessage[]): Promise<SMSChannelResult[]> {
    return Promise.all(messages.map(msg => this.send(msg)));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled || !this.client) {
      return false;
    }

    try {
      // Try to fetch account info as health check
      await this.client.api.accounts(this.config.accountSid).fetch();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get SMS statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      configured: !!this.client,
      fromNumber: this.config.fromNumber,
    };
  }
}