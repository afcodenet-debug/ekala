// =============================================================================
// PaymentStatus — Value Object
// Architecture V2.4 — Billing Domain
// =============================================================================

export type PaymentStatusValue =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export class PaymentStatus {
  private constructor(private readonly value: PaymentStatusValue) {}

  static pending(): PaymentStatus {
    return new PaymentStatus('pending');
  }
  static processing(): PaymentStatus {
    return new PaymentStatus('processing');
  }
  static completed(): PaymentStatus {
    return new PaymentStatus('completed');
  }
  static failed(): PaymentStatus {
    return new PaymentStatus('failed');
  }
  static refunded(): PaymentStatus {
    return new PaymentStatus('refunded');
  }
  static partiallyRefunded(): PaymentStatus {
    return new PaymentStatus('partially_refunded');
  }

  static fromString(value: string): PaymentStatus {
    const valid: PaymentStatusValue[] = [
      'pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'
    ];
    if (!valid.includes(value as PaymentStatusValue)) {
      throw new Error(`Invalid payment status: ${value}`);
    }
    return new PaymentStatus(value as PaymentStatusValue);
  }

  canTransitionTo(newStatus: PaymentStatus): boolean {
    const transitions: Record<PaymentStatusValue, PaymentStatusValue[]> = {
      'pending': ['processing', 'failed'],
      'processing': ['completed', 'failed'],
      'completed': ['refunded', 'partially_refunded'],
      'failed': ['pending'],
      'refunded': [],
      'partially_refunded': ['refunded'],
    };
    return (transitions[this.value] || []).includes(newStatus.value);
  }

  isPending(): boolean { return this.value === 'pending'; }
  isProcessing(): boolean { return this.value === 'processing'; }
  isCompleted(): boolean { return this.value === 'completed'; }
  isFailed(): boolean { return this.value === 'failed'; }
  isTerminal(): boolean { return ['completed', 'refunded'].includes(this.value); }
  canRetry(): boolean { return this.value === 'failed'; }

  toString(): PaymentStatusValue { return this.value; }
  toJSON(): PaymentStatusValue { return this.value; }
  equals(other: PaymentStatus): boolean { return this.value === other.value; }
}