// =============================================================================
// VoucherStatus Value Object
// =============================================================================
// Architecture V2.1 — DDD Value Object
// Représente l'état d'une demande de voucher
// =============================================================================

/**
 * États possibles d'une demande de voucher
 */
export type VoucherStatusValue = 
  | 'pending'
  | 'payment_sent'
  | 'verified'
  | 'rejected'
  | 'expired';

/**
 * Classe Value Object pour le statut de voucher
 * 
 * Règles métier :
 * - pending : demande créée, en attente de paiement
 * - payment_sent : paiement envoyé, en attente de vérification
 * - verified : paiement vérifié, abonnement activé
 * - rejected : demande rejetée
 * - expired : demande expirée (non payée dans les délais)
 */
export class VoucherStatus {
  private constructor(private readonly value: VoucherStatusValue) {}

  // =============================================================================
  // Factory Methods
  // =============================================================================

  static pending(): VoucherStatus {
    return new VoucherStatus('pending');
  }

  static paymentSent(): VoucherStatus {
    return new VoucherStatus('payment_sent');
  }

  static verified(): VoucherStatus {
    return new VoucherStatus('verified');
  }

  static rejected(): VoucherStatus {
    return new VoucherStatus('rejected');
  }

  static expired(): VoucherStatus {
    return new VoucherStatus('expired');
  }

  /**
   * Créer un VoucherStatus depuis une string
   * @throws Error si la valeur est invalide
   */
  static fromString(value: string): VoucherStatus {
    const validValues: VoucherStatusValue[] = [
      'pending', 'payment_sent', 'verified', 'rejected', 'expired'
    ];
    
    if (!validValues.includes(value as VoucherStatusValue)) {
      throw new Error(`Invalid voucher status: ${value}`);
    }
    
    return new VoucherStatus(value as VoucherStatusValue);
  }

  // =============================================================================
  // Business Methods
  // =============================================================================

  /**
   * Vérifie si une transition vers un nouveau statut est autorisée
   */
  canTransitionTo(newStatus: VoucherStatus): boolean {
    const current = this.value;
    const target = newStatus.value;

    // Matrice de transitions autorisées
    const allowedTransitions: Record<VoucherStatusValue, VoucherStatusValue[]> = {
      'pending': ['payment_sent', 'rejected', 'expired'],
      'payment_sent': ['verified', 'rejected', 'expired'],
      'verified': [], // Terminal state
      'rejected': [], // Terminal state
      'expired': [], // Terminal state
    };

    const allowed = allowedTransitions[current] || [];
    return allowed.includes(target);
  }

  /**
   * Vérifie si la demande est en attente de traitement
   */
  isPending(): boolean {
    return this.value === 'pending' || this.value === 'payment_sent';
  }

  /**
   * Vérifie si la demande est terminée (vérifiée, rejetée ou expirée)
   */
  isTerminal(): boolean {
    return ['verified', 'rejected', 'expired'].includes(this.value);
  }

  /**
   * Vérifie si la demande a été vérifiée
   */
  isVerified(): boolean {
    return this.value === 'verified';
  }

  /**
   * Vérifie si la demande a été rejetée
   */
  isRejected(): boolean {
    return this.value === 'rejected';
  }

  // =============================================================================
  // Getters
  // =============================================================================

  toString(): VoucherStatusValue {
    return this.value;
  }

  toJSON(): VoucherStatusValue {
    return this.value;
  }

  equals(other: VoucherStatus): boolean {
    return this.value === other.value;
  }
}