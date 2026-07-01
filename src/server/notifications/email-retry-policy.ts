// Email Retry Policy - Increment 2: Fiabilisation
// Retry logic with exponential backoff for SMTP failures

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number[];
  retryableErrors?: string[];
}

export class EmailRetryPolicy {
  private config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      backoffMs: config?.backoffMs ?? [1000, 5000, 15000], // 1s, 5s, 15s
      retryableErrors: config?.retryableErrors ?? [
        'ECONNECTION',
        'ETIMEDOUT',
        'ESOCKET',
        'ECONNRESET',
        'ENOTFOUND',
        'EAI_AGAIN',
        'timeout',
        'network',
      ],
    };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (!this.isRetryable(lastError)) {
          console.error(`[EmailRetryPolicy] Non-retryable error:`, lastError.message);
          throw lastError;
        }

        // Don't sleep after last attempt
        if (attempt < this.config.maxRetries - 1) {
          const delay = this.config.backoffMs[attempt];
          console.warn(
            `[EmailRetryPolicy] ${context || 'Operation'} failed (attempt ${attempt + 1}/${this.config.maxRetries}), ` +
            `retrying in ${delay}ms...`
          );
          
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    const finalError = lastError || new Error('Max retries exceeded');
    console.error(
      `[EmailRetryPolicy] ${context || 'Operation'} failed after ${this.config.maxRetries} attempts:`,
      finalError.message
    );

    throw finalError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    
    // Check against retryable error patterns
    return this.config.retryableErrors!.some(pattern => 
      errorMessage.includes(pattern.toLowerCase())
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Update retry configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// Singleton instance
let retryPolicyInstance: EmailRetryPolicy | null = null;

export function getEmailRetryPolicy(): EmailRetryPolicy {
  if (!retryPolicyInstance) {
    retryPolicyInstance = new EmailRetryPolicy();
  }
  return retryPolicyInstance;
}