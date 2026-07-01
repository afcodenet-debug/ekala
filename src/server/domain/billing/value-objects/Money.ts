// =============================================================================
// Money — Value Object
// Architecture V2.4 — Billing Domain
// Représente un montant monétaire avec sa devise
// =============================================================================

export class Money {
  private constructor(
    private readonly amountCents: number,
    private readonly currency: string
  ) {
    if (amountCents < 0) throw new Error('Money amount cannot be negative');
    if (!currency || currency.length !== 3) throw new Error('Currency must be a 3-letter ISO code');
  }

  static ZMW(amountCents: number): Money {
    return new Money(amountCents, 'ZMW');
  }

  static USD(amountCents: number): Money {
    return new Money(amountCents, 'USD');
  }

  static of(amountCents: number, currency: string): Money {
    return new Money(amountCents, currency.toUpperCase());
  }

  getAmountCents(): number { return this.amountCents; }
  getCurrency(): string { return this.currency; }
  getAmountDecimal(): number { return this.amountCents / 100; }

  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this.amountCents + other.amountCents, this.currency);
  }

  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    const result = this.amountCents - other.amountCents;
    if (result < 0) throw new Error('Insufficient funds');
    return new Money(result, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(Math.floor(this.amountCents * factor), this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.amountCents > other.amountCents;
  }

  isLessThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.amountCents < other.amountCents;
  }

  isZero(): boolean {
    return this.amountCents === 0;
  }

  private ensureSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }

  toString(): string {
    return `${(this.amountCents / 100).toFixed(2)} ${this.currency}`;
  }

  toJSON(): { amountCents: number; currency: string } {
    return { amountCents: this.amountCents, currency: this.currency };
  }

  equals(other: Money): boolean {
    return this.amountCents === other.amountCents && this.currency === other.currency;
  }
}