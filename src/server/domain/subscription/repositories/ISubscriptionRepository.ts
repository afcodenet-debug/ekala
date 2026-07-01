// =============================================================================
// ISubscriptionRepository — Interface
// =============================================================================
// Architecture V2.1 — Repository Pattern
// Abstraction de la persistance pour le domaine Subscription
// =============================================================================

import { SubscriptionStatus } from '../value-objects/SubscriptionStatus';
import { VoucherStatus } from '../value-objects/VoucherStatus';
import { PlanId } from '../value-objects/PlanId';

// =============================================================================
// Entités du domaine (interfaces)
// =============================================================================

/**
 * Subscription Data - données brutes d'un abonnement
 * Utilisé pour les opérations de persistance (Repository)
 */
export interface Subscription {
  id: number;
  tenantId: number;
  planId: number;
  status: SubscriptionStatus;
  entityVersion: number;
  originNode: string;
  logicalClock: number;
  startsAt: string;
  endsAt: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Interface Voucher - agrégat
 */
export interface Voucher {
  id: number;
  tenantId: number;
  planId: number;
  status: VoucherStatus;
  amount: number;
  paymentReference: string;
  paymentProof?: string;
  verifiedBy?: number;
  verifiedAt?: string;
  rejectedBy?: number;
  rejectedAt?: string;
  rejectionReason?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Interface Plan - agrégat
 */
export interface Plan {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  intervalCount: number;
  features: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Query Results (DTOs)
// =============================================================================

/**
 * Résumé d'abonnement pour les listes
 */
export interface SubscriptionSummary {
  id: number;
  tenantId: number;
  planName: string;
  status: SubscriptionStatus;
  startsAt: string;
  endsAt: string;
  daysRemaining: number;
  isActive: boolean;
}

/**
 * Résumé de voucher pour les listes
 */
export interface VoucherSummary {
  id: number;
  tenantId: number;
  tenantName: string;
  planName: string;
  status: VoucherStatus;
  amount: number;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
}

/**
 * Statistiques d'abonnement
 */
export interface SubscriptionStats {
  totalActive: number;
  totalTrialing: number;
  totalExpired: number;
  totalCancelled: number;
  totalRevenue: number;
  averageRevenuePerUser: number;
}

/**
 * Statistiques de voucher
 */
export interface VoucherStats {
  totalPending: number;
  totalVerified: number;
  totalRejected: number;
  totalExpired: number;
  totalRevenue: number;
  pendingAmount: number;
}

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * Interface Repository pour le domaine Subscription
 * 
 * Responsabilités :
 * - Abstraction de la persistance (SQLite, Supabase, etc.)
 * - Opérations CRUD de base
 * - Queries métier spécifiques
 * - Gestion de la concurrence (optimistic locking)
 * 
 * Principe : Aucune logique métier ici, seulement de l'accès aux données
 */
export interface ISubscriptionRepository {
  // =============================================================================
  // Subscription Operations
  // =============================================================================

  /**
   * Créer un nouvel abonnement
   * @param subscription Les données de l'abonnement
   * @returns L'abonnement créé avec son ID
   * @throws Error si la création échoue
   */
  createSubscription(subscription: {
    tenantId: number;
    planId: number;
    status: SubscriptionStatus;
    startsAt: string;
    endsAt: string;
    originNode: string;
  }): Promise<Subscription>;

  /**
   * Trouver un abonnement par ID
   * @param id L'ID de l'abonnement
   * @returns L'abonnement ou null si non trouvé
   */
  findSubscriptionById(id: number): Promise<Subscription | null>;

  /**
   * Trouver un abonnement par tenant ID
   * @param tenantId L'ID du tenant
   * @returns L'abonnement actif ou null
   */
  findActiveSubscriptionByTenantId(tenantId: number): Promise<Subscription | null>;

  /**
   * Trouver tous les abonnements d'un tenant
   * @param tenantId L'ID du tenant
   * @returns Liste des abonnements (triés par date décroissante)
   */
  findAllSubscriptionsByTenantId(tenantId: number): Promise<Subscription[]>;

  /**
   * Mettre à jour un abonnement
   * @param id L'ID de l'abonnement
   * @param updates Les champs à mettre à jour
   * @param expectedVersion Version attendue pour optimistic locking
   * @returns L'abonnement mis à jour
   * @throws Error si la version ne correspond pas (concurrent update)
   */
  updateSubscription(
    id: number,
    updates: {
      status?: SubscriptionStatus;
      endsAt?: string;
      cancelledAt?: string;
    },
    expectedVersion: number
  ): Promise<Subscription>;

  /**
   * Supprimer un abonnement (soft delete)
   * @param id L'ID de l'abonnement
   */
  deleteSubscription(id: number): Promise<void>;

  /**
   * Compter le nombre d'abonnements actifs
   * @returns Le nombre d'abonnements actifs
   */
  countActiveSubscriptions(): Promise<number>;

  // =============================================================================
  // Voucher Operations
  // =============================================================================

  /**
   * Créer une demande de voucher
   * @param voucher Les données du voucher
   * @returns Le voucher créé avec son ID
   * @throws Error si la création échoue
   */
  createVoucher(voucher: {
    tenantId: number;
    planId: number;
    amount: number;
    paymentReference: string;
    paymentProof?: string;
    expiresAt: string;
  }): Promise<Voucher>;

  /**
   * Trouver un voucher par ID
   * @param id L'ID du voucher
   * @returns Le voucher ou null si non trouvé
   */
  findVoucherById(id: number): Promise<Voucher | null>;

  /**
   * Trouver un voucher par payment reference
   * @param paymentReference La référence de paiement
   * @returns Le voucher ou null si non trouvé
   */
  findVoucherByPaymentReference(paymentReference: string): Promise<Voucher | null>;

  /**
   * Trouver tous les vouchers d'un tenant
   * @param tenantId L'ID du tenant
   * @returns Liste des vouchers (triés par date décroissante)
   */
  findAllVouchersByTenantId(tenantId: number): Promise<Voucher[]>;

  /**
   * Trouver tous les vouchers en attente
   * @returns Liste des vouchers en pending/payment_sent
   */
  findPendingVouchers(): Promise<Voucher[]>;

  /**
   * Mettre à jour un voucher
   * @param id L'ID du voucher
   * @param updates Les champs à mettre à jour
   * @returns Le voucher mis à jour
   * @throws Error si la mise à jour échoue
   */
  updateVoucher(
    id: number,
    updates: {
      status?: VoucherStatus;
      verifiedBy?: number;
      verifiedAt?: string;
      rejectedBy?: number;
      rejectedAt?: string;
      rejectionReason?: string;
    }
  ): Promise<Voucher>;

  /**
   * Compter les vouchers par statut
   * @param status Le statut à compter
   * @returns Le nombre de vouchers avec ce statut
   */
  countVouchersByStatus(status: VoucherStatus): Promise<number>;

  // =============================================================================
  // Plan Operations
  // =============================================================================

  /**
   * Trouver un plan par ID
   * @param id L'ID du plan
   * @returns Le plan ou null si non trouvé
   */
  findPlanById(id: number): Promise<Plan | null>;

  /**
   * Trouver tous les plans actifs
   * @returns Liste des plans actifs (triés par prix croissant)
   */
  findAllActivePlans(): Promise<Plan[]>;

  /**
   * Trouver tous les plans
   * @returns Liste de tous les plans
   */
  findAllPlans(): Promise<Plan[]>;

  // =============================================================================
  // Query Methods (Read Model)
  // =============================================================================

  /**
   * Obtenir les résumés d'abonnements avec pagination
   * @param offset Décalage pour pagination
   * @param limit Nombre d'éléments par page
   * @returns Liste des résumés
   */
  findSubscriptionSummaries(
    offset: number,
    limit: number
  ): Promise<SubscriptionSummary[]>;

  /**
   * Obtenir les résumés de vouchers avec pagination
   * @param offset Décalage pour pagination
   * @param limit Nombre d'éléments par page
   * @returns Liste des résumés
   */
  findVoucherSummaries(
    offset: number,
    limit: number
  ): Promise<VoucherSummary[]>;

  /**
   * Obtenir les statistiques d'abonnements
   * @returns Les statistiques
   */
  getSubscriptionStats(): Promise<SubscriptionStats>;

  /**
   * Obtenir les statistiques de vouchers
   * @returns Les statistiques
   */
  getVoucherStats(): Promise<VoucherStats>;

  // =============================================================================
  // Transaction Support
  // =============================================================================

  /**
   * Exécuter une opération dans une transaction
   * @param fn La fonction à exécuter dans la transaction
   * @returns Le résultat de la fonction
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

// =============================================================================
// Repository Factory
// =============================================================================

/**
 * Factory pour créer des instances de repository
 * Permet l'injection de dépendances et le mocking pour les tests
 */
export interface ISubscriptionRepositoryFactory {
  /**
   * Crée une instance du repository
   * @returns Une instance de ISubscriptionRepository
   */
  create(): ISubscriptionRepository;
}

// =============================================================================
// Repository Errors
// =============================================================================

/**
 * Erreur levée quand une entité n'est pas trouvée
 */
export class SubscriptionNotFoundError extends Error {
  constructor(id: number) {
    super(`Subscription with id ${id} not found`);
    this.name = 'SubscriptionNotFoundError';
  }
}

/**
 * Erreur levée quand un voucher n'est pas trouvé
 */
export class VoucherNotFoundError extends Error {
  constructor(id: number) {
    super(`Voucher with id ${id} not found`);
    this.name = 'VoucherNotFoundError';
  }
}

/**
 * Erreur levée lors d'un conflit de version (optimistic locking)
 */
export class ConcurrentUpdateError extends Error {
  constructor(expectedVersion: number, actualVersion: number) {
    super(
      `Concurrent update detected: expected version ${expectedVersion}, ` +
      `but got ${actualVersion}`
    );
    this.name = 'ConcurrentUpdateError';
  }
}

/**
 * Erreur levée lors d'une violation de contrainte métier
 */
export class BusinessRuleViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleViolationError';
  }
}