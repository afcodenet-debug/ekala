// =============================================================================
// InvoiceStatus — Value Object
// Architecture V2.4 — Billing Domain
// =============================================================================

export type InvoiceStatusValue =
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'refunded'
  | 'void';

/**
 * InvoiceStatus Value Object
 *
 * Règles métier :
 * - pending : facture générée, en attente de paiement
 * - paid : facture payée (totalement — remainingBalanceCents === 0)
 * - overdue : date d'échéance dépassée avec solde > 0
 * - cancelled : annulée avant paiement
 * - refunded : remboursée totalement
 * - void : annulée pour erreur interne
 *
 * PARTIALLY_PAID n'est PAS un statut.
 * C'est un état dérivé : status === 'pending' && paidCents > 0
 */
export class InvoiceStatus {
  private constructor(private readonly value: InvoiceStatusValue) {}

  static pending(): InvoiceStatus {
    return new InvoiceStatus('pending');
  }

  static paid(): InvoiceStatus {
    return new InvoiceStatus('paid');
  }

  static overdue(): InvoiceStatus {
    return new InvoiceStatus('overdue');
  }

  static cancelled(): InvoiceStatus {
    return new InvoiceStatus('cancelled');
  }

  static refunded(): InvoiceStatus {
    return new InvoiceStatus('refunded');
  }

  static void(): InvoiceStatus {
    return new InvoiceStatus('void');
  }

  static fromString(value: string): InvoiceStatus {
    const validValues: InvoiceStatusValue[] = [
      'pending', 'paid', 'overdue', 'cancelled', 'refunded', 'void'
    ];
    if (!validValues.includes(value as InvoiceStatusValue)) {
      throw new Error(`Invalid invoice status: ${value}`);
    }
    return new InvoiceStatus(value as InvoiceStatusValue);
  }

  /**
   * Matrice de transitions autorisées
   * pending → paid | overdue | cancelled | void
   * paid → refunded
   * overdue → paid | cancelled
   * cancelled → (terminal)
   * refunded → (terminal)
   * void → (terminal)
   */
  canTransitionTo(newStatus: InvoiceStatus): boolean {
    const current = this.value;
    const target = newStatus.value;

    const allowedTransitions: Record<InvoiceStatusValue, InvoiceStatusValue[]> = {
      'pending': ['paid', 'overdue', 'cancelled', 'void'],
      'paid': ['refunded'],
      'overdue': ['paid', 'cancelled'],
      'cancelled': [],
      'refunded': [],
      'void': [],
    };

    return (allowedTransitions[current] || []).includes(target);
  }

  isPending(): boolean {
    return this.value === 'pending';
  }

  isPaid(): boolean {
    return this.value === 'paid';
  }

  isOverdue(): boolean {
    return this.value === 'overdue';
  }

  isTerminal(): boolean {
    return ['cancelled', 'refunded', 'void'].includes(this.value);
  }

  isPartiallyPaid(paidCents: number, totalCents: number): boolean {
    return this.value === 'pending' && paidCents > 0 && paidCents < totalCents;
  }

  toString(): InvoiceStatusValue {
    return this.value;
  }

  toJSON(): InvoiceStatusValue {
    return this.value;
  }

  equals(other: InvoiceStatus): boolean {
    return this.value === other.value;
  }
}