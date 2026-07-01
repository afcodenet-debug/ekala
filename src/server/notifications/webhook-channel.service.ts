// Webhook Channel Service - Increment 8: Advanced Channels
// HTTP webhook notifications with HMAC signature verification

import crypto from 'crypto';

export interface WebhookChannelConfig {
  secret: string;
  timeout: number;
  maxRetries: number;
  enabled: boolean;
}

export interface WebhookMessage {
  url: string;
  payload: Record<string, any>;
  headers?: Record<string, string>;
  tenantId: number;
}

export interface WebhookChannelResult {
  success: boolean;
  messageId?: string;
  statusCode?: number;
  response?: any;
  error?: string;
}

export class WebhookChannelService {
  private config: WebhookChannelConfig;
  private enabled: boolean;

  constructor(config: WebhookChannelConfig) {
    this.config = config;
    this.enabled = config.enabled;
  }

  /**
   * Send webhook notification
   */
  async send(message: WebhookMessage): Promise<WebhookChannelResult> {
    if (!this.enabled) {
      return {
        success: false,
        error: 'Webhook channel is not enabled',
      };
    }

    try {
      // Generate HMAC signature
      const payloadString = JSON.stringify(message.payload);
      const signature = this.generateSignature(payloadString);

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Tenant-Id': message.tenantId.toString(),
        ...message.headers,
      };

      // Send HTTP request with retries
      let lastError: any;
      for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
        try {
          const response = await fetch(message.url, {
            method: 'POST',
            headers,
            body: payloadString,
            signal: AbortSignal.timeout(this.config.timeout),
          });

          if (response.ok) {
            return {
              success: true,
              statusCode: response.status,
              response: await response.json(),
            };
          }

          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        } catch (error: any) {
          lastError = error;
          if (attempt < this.config.maxRetries - 1) {
            // Wait before retry (exponential backoff)
            await this.delay(Math.pow(2, attempt) * 1000);
          }
        }
      }

      return {
        success: false,
        error: lastError?.message || 'Failed to send webhook after retries',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send webhook',
      };
    }
  }

  /**
   * Send bulk webhook notifications
   */
  async sendBulk(messages: WebhookMessage[]): Promise<WebhookChannelResult[]> {
    return Promise.all(messages.map(msg => this.send(msg)));
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    const expectedSignature = this.generateSignature(payload);
    return signature === expectedSignature;
  }

  /**
   * Generate HMAC signature
   */
  private generateSignature(payload: string): string {
    return crypto
      .createHmac('sha256', this.config.secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    // Webhook health check would require a test endpoint
    // For now, just return enabled status
    return this.enabled;
  }

  /**
   * Get webhook statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      configured: !!this.config.secret,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}