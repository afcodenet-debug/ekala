// =============================================================================
// Subscription Domain Events — Interfaces
// =============================================================================
// Architecture V2.1 — Domain Events pour découplage event-driven
// Ces interfaces définissent le contrat des events métier
// =============================================================================

/**
 * Métadonnées communes à tous les domain events
 * Garantit la traçabilité et l'observabilité
 */
export interface EventMetadata {
  /** Timestamp ISO 8601 de l'event */
  timestamp: string;
  
  /** Identifiant du noeud d'origine (pour multi-instance) */
  originNode: string;
  
  /** Horloge logique Lamport pour ordre cohérent */
  logicalClock: number;
  
  /** ID de corrélation pour tracer le workflow complet */
  correlationId: string;
}

/**
 * Base interface pour tous les subscription events
 * Permet le pattern matching et le routing
 */
export interface SubscriptionEvent {
  /** Type de l'event pour routing */
  type: string;
  
  /** Métadonnées de traçabilité */
  metadata: EventMetadata;
}

// =============================================================================
// Voucher Events
// =============================================================================

/**
 * Event émis quand une demande de voucher est soumise
 */
export interface VoucherRequestSubmitted {
  type: 'VoucherRequestSubmitted';
  payload: {
    /** ID du voucher */
    voucherId: number;
    /** ID du tenant */
    tenantId: number;
    /** ID du plan demandé */
    planId: number;
    /** Montant payé */
    amount: number;
    /** Preuve de paiement (référence) */
    paymentReference: string;
    /** Date de soumission */
    submittedAt: string;
  };
  metadata: EventMetadata;
}

/**
 * Event émis quand un voucher est vérifié et approuvé
 */
export interface VoucherVerified {
  type: 'VoucherVerified';
  payload: {
    /** ID du voucher */
    voucherId: number;
    /** ID du tenant */
    tenantId: number;
    /** ID du plan */
    planId: number;
    /** ID de l'admin qui a vérifié */
    verifiedBy: number;
    /** Date de vérification */
    verifiedAt: string;
  };
  metadata: EventMetadata;
}

/**
 * Event émis quand un voucher est rejeté
 */
export interface VoucherRejected {
  type: 'VoucherRejected';
  payload: {
    /** ID du voucher */
    voucherId: number;
    /** ID du tenant */
    tenantId: number;
    /** Raison du rejet */
    reason: string;
    /** ID de l'admin qui a rejeté */
    rejectedBy: number;
    /** Date de rejet */
    rejectedAt: string;
  };
  metadata: EventMetadata;
}

// =============================================================================
// Subscription Lifecycle Events
// =============================================================================

/**
 * Event émis quand un abonnement est activé
 */
export interface SubscriptionActivated {
  type: 'SubscriptionActivated';
  payload: {
    /** ID de l'abonnement */
    subscriptionId: number;
    /** ID du tenant */
    tenantId: number;
    /** ID du plan */
    planId: number;
    /** Date de début */
    startsAt: string;
    /** Date de fin */
    endsAt: string;
    /** Date d'activation */
    activatedAt: string;
  };
  metadata: EventMetadata;
}

/**
 * Event émis quand un abonnement est suspendu
 */
export interface SubscriptionSuspended {
  type: 'SubscriptionSuspended';
  payload: {
    /** ID de l'abonnement */
    subscriptionId: number;
    /** ID du tenant */
    tenantId: number;
    /** Raison de la suspension */
    reason: 'payment_failed' | 'manual' | 'other';
    /** Date de suspension */
    suspendedAt: string;
  };
  metadata: EventMetadata;
}

/**
 * Event émis quand un abonnement est annulé
 */
export interface SubscriptionCancelled {
  type: 'SubscriptionCancelled';
  payload: {
    /** ID de l'abonnement */
    subscriptionId: number;
    /** ID du tenant */
    tenantId: number;
    /** Raison de l'annulation */
    reason?: string;
    /** Date d'annulation */
    cancelledAt: string;
    /** Date de fin effective */
    endsAt: string;
  };
  metadata: EventMetadata;
}

/**
 * Event émis quand un abonnement expire
 */
export interface SubscriptionExpired {
  type: 'SubscriptionExpired';
  payload: {
    /** ID de l'abonnement */
    subscriptionId: number;
    /** ID du tenant */
    tenantId: number;
    /** Date d'expiration */
    expiredAt: string;
  };
  metadata: EventMetadata;
}

/**
 * Event émis quand un abonnement est renouvelé
 */
export interface SubscriptionRenewed {
  type: 'SubscriptionRenewed';
  payload: {
    /** ID de l'abonnement */
    subscriptionId: number;
    /** ID du tenant */
    tenantId: number;
    /** Nouveau plan (si changement) */
    newPlanId?: number;
    /** Date de début du nouveau cycle */
    startsAt: string;
    /** Date de fin du nouveau cycle */
    endsAt: string;
    /** Date de renouvellement */
    renewedAt: string;
  };
  metadata: EventMetadata;
}

// =============================================================================
// Union Type pour tous les events
// =============================================================================

/**
 * Union de tous les domain events Subscription
 * Permet le pattern matching exhaustif
 */
export type SubscriptionDomainEvent = 
  | VoucherRequestSubmitted
  | VoucherVerified
  | VoucherRejected
  | SubscriptionActivated
  | SubscriptionSuspended
  | SubscriptionCancelled
  | SubscriptionExpired
  | SubscriptionRenewed;

// =============================================================================
// Event Handler Interface
// =============================================================================

/**
 * Interface pour les handlers d'events
 * Permet l'enregistrement dynamique des handlers
 */
export interface IEventHandler<T extends SubscriptionDomainEvent> {
  /** Type d'event géré */
  readonly eventType: T['type'];
  
  /**
   * Traite l'event
   * @param event L'event à traiter
   */
  handle(event: T): Promise<void> | void;
}

/**
 * Interface pour le bus d'events
 * Permet l'abstraction de l'implémentation (Redis, in-memory, etc.)
 */
export interface IEventBus {
  /**
   * Publie un event
   * @param event L'event à publier
   */
  publish<T extends SubscriptionDomainEvent>(event: T): Promise<void>;
  
  /**
   * Enregistre un handler pour un type d'event
   * @param handler Le handler à enregistrer
   */
  subscribe<T extends SubscriptionDomainEvent>(
    eventType: T['type'],
    handler: IEventHandler<T>
  ): void;
  
  /**
   * Désenregistre un handler
   * @param eventType Le type d'event
   * @param handler Le handler à désenregistrer
   */
  unsubscribe<T extends SubscriptionDomainEvent>(
    eventType: T['type'],
    handler: IEventHandler<T>
  ): void;
}

// =============================================================================
// Event Factory Functions
// =============================================================================

/**
 * Factory pour créer des events avec métadonnées auto-générées
 */
export class SubscriptionEventFactory {
  /**
   * Crée un event VoucherRequestSubmitted
   */
  static createVoucherRequestSubmitted(
    voucherId: number,
    tenantId: number,
    planId: number,
    amount: number,
    paymentReference: string,
    originNode: string,
    logicalClock: number,
    correlationId: string
  ): VoucherRequestSubmitted {
    return {
      type: 'VoucherRequestSubmitted',
      payload: {
        voucherId,
        tenantId,
        planId,
        amount,
        paymentReference,
        submittedAt: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        originNode,
        logicalClock,
        correlationId,
      },
    };
  }

  /**
   * Crée un event VoucherVerified
   */
  static createVoucherVerified(
    voucherId: number,
    tenantId: number,
    planId: number,
    verifiedBy: number,
    originNode: string,
    logicalClock: number,
    correlationId: string
  ): VoucherVerified {
    return {
      type: 'VoucherVerified',
      payload: {
        voucherId,
        tenantId,
        planId,
        verifiedBy,
        verifiedAt: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        originNode,
        logicalClock,
        correlationId,
      },
    };
  }

  /**
   * Crée un event VoucherRejected
   */
  static createVoucherRejected(
    voucherId: number,
    tenantId: number,
    reason: string,
    rejectedBy: number,
    originNode: string,
    logicalClock: number,
    correlationId: string
  ): VoucherRejected {
    return {
      type: 'VoucherRejected',
      payload: {
        voucherId,
        tenantId,
        reason,
        rejectedBy,
        rejectedAt: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        originNode,
        logicalClock,
        correlationId,
      },
    };
  }

  /**
   * Crée un event SubscriptionActivated
   */
  static createSubscriptionActivated(
    subscriptionId: number,
    tenantId: number,
    planId: number,
    startsAt: string,
    endsAt: string,
    originNode: string,
    logicalClock: number,
    correlationId: string
  ): SubscriptionActivated {
    return {
      type: 'SubscriptionActivated',
      payload: {
        subscriptionId,
        tenantId,
        planId,
        startsAt,
        endsAt,
        activatedAt: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        originNode,
        logicalClock,
        correlationId,
      },
    };
  }

  /**
   * Crée un event SubscriptionSuspended
   */
  static createSubscriptionSuspended(
    subscriptionId: number,
    tenantId: number,
    reason: 'payment_failed' | 'manual' | 'other',
    originNode: string,
    logicalClock: number,
    correlationId: string
  ): SubscriptionSuspended {
    return {
      type: 'SubscriptionSuspended',
      payload: {
        subscriptionId,
        tenantId,
        reason,
        suspendedAt: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        originNode,
        logicalClock,
        correlationId,
      },
    };
  }

  /**
   * Crée un event SubscriptionCancelled
   */
  static createSubscriptionCancelled(
    subscriptionId: number,
    tenantId: number,
    endsAt: string,
    reason?: string,
    originNode: string = 'unknown',
    logicalClock: number = 0,
    correlationId: string = 'unknown'
  ): SubscriptionCancelled {
    return {
      type: 'SubscriptionCancelled',
      payload: {
        subscriptionId,
        tenantId,
        reason,
        cancelledAt: new Date().toISOString(),
        endsAt,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        originNode,
        logicalClock,
        correlationId,
      },
    };
  }

  /**
   * Crée un event SubscriptionExpired
   */
  static createSubscriptionExpired(
    subscriptionId: number,
    tenantId: number,
    originNode: string,
    logicalClock: number,
    correlationId: string
  ): SubscriptionExpired {
    return {
      type: 'SubscriptionExpired',
      payload: {
        subscriptionId,
        tenantId,
        expiredAt: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        originNode,
        logicalClock,
        correlationId,
      },
    };
  }

  /**
   * Crée un event SubscriptionRenewed
   */
  static createSubscriptionRenewed(
    subscriptionId: number,
    tenantId: number,
    startsAt: string,
    endsAt: string,
    newPlanId?: number,
    originNode: string = 'unknown',
    logicalClock: number = 0,
    correlationId: string = 'unknown'
  ): SubscriptionRenewed {
    return {
      type: 'SubscriptionRenewed',
      payload: {
        subscriptionId,
        tenantId,
        newPlanId,
        startsAt,
        endsAt,
        renewedAt: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        originNode,
        logicalClock,
        correlationId,
      },
    };
  }
}

// =============================================================================
// Event Type Guards
// =============================================================================

/**
 * Type guard pour VoucherRequestSubmitted
 */
export function isVoucherRequestSubmitted(
  event: SubscriptionDomainEvent
): event is VoucherRequestSubmitted {
  return event.type === 'VoucherRequestSubmitted';
}

/**
 * Type guard pour VoucherVerified
 */
export function isVoucherVerified(
  event: SubscriptionDomainEvent
): event is VoucherVerified {
  return event.type === 'VoucherVerified';
}

/**
 * Type guard pour VoucherRejected
 */
export function isVoucherRejected(
  event: SubscriptionDomainEvent
): event is VoucherRejected {
  return event.type === 'VoucherRejected';
}

/**
 * Type guard pour SubscriptionActivated
 */
export function isSubscriptionActivated(
  event: SubscriptionDomainEvent
): event is SubscriptionActivated {
  return event.type === 'SubscriptionActivated';
}

/**
 * Type guard pour SubscriptionSuspended
 */
export function isSubscriptionSuspended(
  event: SubscriptionDomainEvent
): event is SubscriptionSuspended {
  return event.type === 'SubscriptionSuspended';
}

/**
 * Type guard pour SubscriptionCancelled
 */
export function isSubscriptionCancelled(
  event: SubscriptionDomainEvent
): event is SubscriptionCancelled {
  return event.type === 'SubscriptionCancelled';
}

/**
 * Type guard pour SubscriptionExpired
 */
export function isSubscriptionExpired(
  event: SubscriptionDomainEvent
): event is SubscriptionExpired {
  return event.type === 'SubscriptionExpired';
}

/**
 * Type guard pour SubscriptionRenewed
 */
export function isSubscriptionRenewed(
  event: SubscriptionDomainEvent
): event is SubscriptionRenewed {
  return event.type === 'SubscriptionRenewed';
}