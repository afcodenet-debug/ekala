// =============================================================================
// SubscriptionStatus Value Object
// =============================================================================
// Architecture V2.1 — DDD Value Object
// Représente l'état d'un abonnement avec validation des transitions
// =============================================================================

/**
 * États possibles d'un abonnement
 */
export type SubscriptionStatusValue = 
  | 'active'
  | 'trial'
  | 'grace'
  | 'suspended'
  | 'cancelled'
  | 'expired'
  | 'no_plan'
  | 'pending';

/**
 * Classe Value Object pour le statut d'abonnement
 * 
 * Règles métier :
 * - active : abonnement actif, accès complet
 * - trial : période d'essai (7 jours)
 * - grace : période de grâce après expiration (7 jours)
 * - suspended : suspendu (paiement échoué)
 * - cancelled : annulé par l'utilisateur
 * - expired : expiré (période d'essai ou abonnement terminé)
 * - no_plan : aucun abonnement
 * - pending : en attente d'activation (voucher non vérifié)
 */
export class SubscriptionStatus {
  private constructor(private readonly value: SubscriptionStatusValue) {}

  // =============================================================================
  // Factory Methods
  // =============================================================================

  static active(): SubscriptionStatus {
    return new SubscriptionStatus('active');
  }

  static trial(): SubscriptionStatus {
    return new SubscriptionStatus('trial');
  }

  static grace(): SubscriptionStatus {
    return new SubscriptionStatus('grace');
  }

  static suspended(): SubscriptionStatus {
    return new SubscriptionStatus('suspended');
  }

  static cancelled(): SubscriptionStatus {
    return new SubscriptionStatus('cancelled');
  }

  static expired(): SubscriptionStatus {
    return new SubscriptionStatus('expired');
  }

  static noPlan(): SubscriptionStatus {
    return new SubscriptionStatus('no_plan');
  }

  static pending(): SubscriptionStatus {
    return new SubscriptionStatus('pending');
  }

  /**
   * Créer un SubscriptionStatus depuis une string
   * @throws Error si la valeur est invalide
   */
  static fromString(value: string): SubscriptionStatus {
    const validValues: SubscriptionStatusValue[] = [
      'active', 'trial', 'grace', 'suspended', 'cancelled', 'expired', 'no_plan', 'pending'
    ];
    
    if (!validValues.includes(value as SubscriptionStatusValue)) {
      throw new Error(`Invalid subscription status: ${value}`);
    }
    
    return new SubscriptionStatus(value as SubscriptionStatusValue);
  }

  // =============================================================================
  // Business Methods
  // =============================================================================

  /**
   * Vérifie si une transition vers un nouveau statut est autorisée
   */
  canTransitionTo(newStatus: SubscriptionStatus): boolean {
    const current = this.value;
    const target = newStatus.value;

    // Matrice de transitions autorisées
    const allowedTransitions: Record<SubscriptionStatusValue, SubscriptionStatusValue[]> = {
      'pending': ['active', 'cancelled', 'expired'],
      'active': ['suspended', 'cancelled', 'expired', 'grace'],
      'trial': ['active', 'cancelled', 'expired', 'grace'],
      'grace': ['active', 'suspended', 'cancelled', 'expired'],
      'suspended': ['active', 'cancelled'],
      'cancelled': ['active'], // Réactivation possible
      'expired': ['active', 'grace'],
      'no_plan': ['pending', 'trial', 'active'],
    };

    const allowed = allowedTransitions[current] || [];
    return allowed.includes(target);
  }

  /**
   * Vérifie si l'état permet l'accès complet
   */
  hasFullAccess(): boolean {
    return this.value === 'active' || this.value === 'trial';
  }

  /**
   * Vérifie si l'état est en lecture seule (grace period)
   */
  isReadOnly(): boolean {
    return this.value === 'grace';
  }

  /**
   * Vérifie si l'état bloque l'accès
   */
  isBlocked(): boolean {
    return ['suspended', 'cancelled', 'expired', 'no_plan', 'pending'].includes(this.value);
  }

  /**
   * Vérifie si l'abonnement est actif (active ou trial)
   */
  isActive(): boolean {
    return this.value === 'active' || this.value === 'trial';
  }

  /**
   * Vérifie si l'abonnement est en période d'essai
   */
  isTrial(): boolean {
    return this.value === 'trial';
  }

  /**
   * Vérifie si l'abonnement est en période de grâce
   */
  isGrace(): boolean {
    return this.value === 'grace';
  }

  // =============================================================================
  // Getters
  // =============================================================================

  toString(): SubscriptionStatusValue {
    return this.value;
  }

  toJSON(): SubscriptionStatusValue {
    return this.value;
  }

  equals(other: SubscriptionStatus): boolean {
    return this.value === other.value;
  }
}