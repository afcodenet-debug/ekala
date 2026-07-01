/**
 * Subscription Domain Model (V1.1)
 * 
 * Represents a tenant's current subscription state.
 * This is a simple DB row representation - mutable, not immutable.
 */

export class Subscription {
  constructor(
    public tenant_id: string,
    public plan: string, // 'basic' | 'standard' | 'premium'
    public status: string, // 'ACTIVE' | 'EXPIRED'
    public start_date: Date,
    public end_date: Date,
    public activation_source: string, // 'voucher' | 'stripe' | 'mobile_money'
    public activation_reference: string,
    public activated_at: Date,
    public created_at: Date,
    public updated_at: Date
  ) {}

  /**
   * Check if subscription is currently active
   * @returns true if status is ACTIVE and end_date is in the future
   */
  isActive(): boolean {
    return this.status === 'ACTIVE' && new Date() < this.end_date;
  }

  /**
   * Check if subscription is expired
   * @returns true if status is EXPIRED or end_date is in the past
   */
  isExpired(): boolean {
    return this.status === 'EXPIRED' || new Date() >= this.end_date;
  }

  /**
   * Get days remaining until expiration
   * @returns number of days (can be negative if expired)
   */
  getDaysRemaining(): number {
    const now = new Date();
    const diff = this.end_date.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Convert to plain object (for JSON serialization)
   */
  toJSON() {
    return {
      tenant_id: this.tenant_id,
      plan: this.plan,
      status: this.status,
      start_date: this.start_date.toISOString(),
      end_date: this.end_date.toISOString(),
      activation_source: this.activation_source,
      activation_reference: this.activation_reference,
      activated_at: this.activated_at.toISOString(),
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString(),
    };
  }

  /**
   * Create from plain object (for DB hydration)
   */
  static fromJSON(data: any): Subscription {
    return new Subscription(
      data.tenant_id,
      data.plan,
      data.status,
      new Date(data.start_date),
      new Date(data.end_date),
      data.activation_source,
      data.activation_reference,
      new Date(data.activated_at),
      new Date(data.created_at),
      new Date(data.updated_at)
    );
  }
}