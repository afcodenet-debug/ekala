/**
 * Voucher Domain Model (V1.1)
 * 
 * Represents a voucher activation token.
 * Can be used ONLY ONCE (atomic claim).
 */

export class Voucher {
  constructor(
    public code: string,
    public plan: string, // 'basic' | 'standard' | 'premium'
    public duration_days: number,
    public status: string, // 'ACTIVE' | 'USED'
    public expires_at: Date,
    public tenant_id?: string,
    public used_at?: Date,
    public created_at: Date = new Date()
  ) {}

  /**
   * Check if voucher is valid for use
   * @returns true if status is ACTIVE and not expired
   */
  isValid(): boolean {
    return this.status === 'ACTIVE' && new Date() < this.expires_at;
  }

  /**
   * Check if voucher is expired
   * @returns true if expires_at is in the past
   */
  isExpired(): boolean {
    return new Date() >= this.expires_at;
  }

  /**
   * Check if voucher has been used
   * @returns true if status is USED
   */
  isUsed(): boolean {
    return this.status === 'USED';
  }

  /**
   * Mark voucher as used
   * @param tenantId - Tenant who used the voucher
   */
  markAsUsed(tenantId: string): void {
    if (!this.isValid()) {
      throw new Error('Cannot use invalid or expired voucher');
    }
    
    this.status = 'USED';
    this.tenant_id = tenantId;
    this.used_at = new Date();
  }

  /**
   * Convert to plain object (for JSON serialization)
   */
  toJSON() {
    return {
      code: this.code,
      plan: this.plan,
      duration_days: this.duration_days,
      status: this.status,
      expires_at: this.expires_at.toISOString(),
      tenant_id: this.tenant_id,
      used_at: this.used_at?.toISOString(),
      created_at: this.created_at.toISOString(),
    };
  }

  /**
   * Create from plain object (for DB hydration)
   */
  static fromJSON(data: any): Voucher {
    return new Voucher(
      data.code,
      data.plan,
      data.duration_days,
      data.status,
      new Date(data.expires_at),
      data.tenant_id,
      data.used_at ? new Date(data.used_at) : undefined,
      new Date(data.created_at)
    );
  }
}