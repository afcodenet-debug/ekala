// =============================================================================
// Subscription Aggregate
// =============================================================================
// Architecture V2.1 — DDD Aggregate Root
// Encapsule la logique métier et les invariants d'un abonnement
// =============================================================================

import { SubscriptionStatus } from '../value-objects/SubscriptionStatus';
import { PlanId } from '../value-objects/PlanId';
import { SubscriptionEventFactory, isSubscriptionActivated, isSubscriptionCancelled, isSubscriptionExpired, isSubscriptionSuspended } from '../events/SubscriptionEvents';

// =============================================================================
// Result Pattern (simplifié)
// =============================================================================

export type Result<T> = 
  | { isSuccess: true; value: T; error: null }
  | { isSuccess: false; value: null; error: string };

export namespace Result {
  export function ok<T>(value: T): Result<T> {
    return { isSuccess: true, value, error: null };
  }

  export function fail<T>(error: string): Result<T> {
    return { isSuccess: false, value: null, error };
  }
}

// =============================================================================
// Subscription Aggregate
// =============================================================================

export interface SubscriptionProps {
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

export class Subscription {
  private constructor(private props: SubscriptionProps) {}

  // =============================================================================
  // Getters (immutabilité)
  // =============================================================================

  get id(): number {
    return this.props.id;
  }

  get tenantId(): number {
    return this.props.tenantId;
  }

  get planId(): number {
    return this.props.planId;
  }

  get status(): SubscriptionStatus {
    return this.props.status;
  }

  get entityVersion(): number {
    return this.props.entityVersion;
  }

  get originNode(): string {
    return this.props.originNode;
  }

  get logicalClock(): number {
    return this.props.logicalClock;
  }

  get startsAt(): string {
    return this.props.startsAt;
  }

  get endsAt(): string {
    return this.props.endsAt;
  }

  get cancelledAt(): string | undefined {
    return this.props.cancelledAt;
  }

  get createdAt(): string {
    return this.props.createdAt;
  }

  get updatedAt(): string {
    return this.props.updatedAt;
  }

  // =============================================================================
  // Factory Methods
  // =============================================================================

  /**
   * Créer un nouvel abonnement (factory)
   */
  static create(props: {
    tenantId: number;
    planId: number;
    status: SubscriptionStatus;
    startsAt: string;
    endsAt: string;
    originNode: string;
    logicalClock: number;
  }): Subscription {
    const now = new Date().toISOString();
    
    const subscription = new Subscription({
      id: 0, // Sera assigné par le repository
      tenantId: props.tenantId,
      planId: props.planId,
      status: props.status,
      entityVersion: 1,
      originNode: props.originNode,
      logicalClock: props.logicalClock,
      startsAt: props.startsAt,
      endsAt: props.endsAt,
      createdAt: now,
      updatedAt: now,
    });

    // Valider les invariants
    subscription.validateInvariants();

    return subscription;
  }

  /**
   * Reconstituer un abonnement depuis la DB (reconstitution)
   */
  static reconstitute(props: SubscriptionProps): Subscription {
    return new Subscription(props);
  }

  // =============================================================================
  // Business Methods (invariants + transitions)
  // =============================================================================

  /**
   * Activer l'abonnement
   * @returns Result<Subscription> avec le nouvel état
   */
  activate(): Result<Subscription> {
    // Vérifier la transition
    if (!this.props.status.canTransitionTo(SubscriptionStatus.active())) {
      return Result.fail(`Cannot activate subscription from ${this.props.status.toString()} state`);
    }

    // Vérifier l'invariant : pas déjà actif
    if (this.props.status.isActive()) {
      return Result.fail('Subscription is already active');
    }

    // Mettre à jour
    const updated = this.updateState({
      status: SubscriptionStatus.active(),
      entityVersion: this.props.entityVersion + 1,
      logicalClock: this.props.logicalClock + 1,
    });

    return Result.ok(updated);
  }

  /**
   * Suspendre l'abonnement
   * @param reason La raison de la suspension
   * @returns Result<Subscription> avec le nouvel état
   */
  suspend(reason: 'payment_failed' | 'manual' | 'other'): Result<Subscription> {
    // Vérifier la transition
    if (!this.props.status.canTransitionTo(SubscriptionStatus.suspended())) {
      return Result.fail(`Cannot suspend subscription from ${this.props.status.toString()} state`);
    }

    // Vérifier l'invariant : ne peut pas suspendre un abonnement expiré
    if (this.props.status.toString() === 'expired') {
      return Result.fail('Cannot suspend an expired subscription');
    }

    // Mettre à jour
    const updated = this.updateState({
      status: SubscriptionStatus.suspended(),
      entityVersion: this.props.entityVersion + 1,
      logicalClock: this.props.logicalClock + 1,
    });

    return Result.ok(updated);
  }

  /**
   * Annuler l'abonnement
   * @param reason La raison de l'annulation (optionnelle)
   * @returns Result<Subscription> avec le nouvel état
   */
  cancel(reason?: string): Result<Subscription> {
    // Vérifier la transition
    if (!this.props.status.canTransitionTo(SubscriptionStatus.cancelled())) {
      return Result.fail(`Cannot cancel subscription from ${this.props.status.toString()} state`);
    }

    // Vérifier l'invariant : ne peut pas annuler un abonnement déjà terminé
    if (this.props.status.toString() === 'expired') {
      return Result.fail('Cannot cancel an expired subscription');
    }

    const now = new Date().toISOString();

    // Mettre à jour
    const updated = this.updateState({
      status: SubscriptionStatus.cancelled(),
      cancelledAt: now,
      entityVersion: this.props.entityVersion + 1,
      logicalClock: this.props.logicalClock + 1,
    });

    return Result.ok(updated);
  }

  /**
   * Renouveler l'abonnement
   * @param newEndAt La nouvelle date de fin
   * @returns Result<Subscription> avec le nouvel état
   */
  renew(newEndAt: string): Result<Subscription> {
    // Vérifier la transition
    if (!this.props.status.canTransitionTo(SubscriptionStatus.active())) {
      return Result.fail(`Cannot renew subscription from ${this.props.status.toString()} state`);
    }

    // Vérifier l'invariant : la nouvelle date doit être dans le futur
    const newDate = new Date(newEndAt);
    const now = new Date();
    if (newDate <= now) {
      return Result.fail('Renewal end date must be in the future');
    }

    // Mettre à jour
    const updated = this.updateState({
      endsAt: newEndAt,
      status: SubscriptionStatus.active(),
      entityVersion: this.props.entityVersion + 1,
      logicalClock: this.props.logicalClock + 1,
    });

    return Result.ok(updated);
  }

  /**
   * Marquer l'abonnement comme expiré
   * @returns Result<Subscription> avec le nouvel état
   */
  markAsExpired(): Result<Subscription> {
    // Vérifier la transition
    if (!this.props.status.canTransitionTo(SubscriptionStatus.expired())) {
      return Result.fail(`Cannot expire subscription from ${this.props.status.toString()} state`);
    }

    // Mettre à jour
    const updated = this.updateState({
      status: SubscriptionStatus.expired(),
      entityVersion: this.props.entityVersion + 1,
      logicalClock: this.props.logicalClock + 1,
    });

    return Result.ok(updated);
  }

  // =============================================================================
  // Query Methods
  // =============================================================================

  /**
   * Vérifie si l'abonnement est actif
   */
  isActive(): boolean {
    return this.props.status.isActive();
  }

  /**
   * Vérifie si l'abonnement est bloqué
   */
  isBlocked(): boolean {
    return this.props.status.isBlocked();
  }

  /**
   * Vérifie si l'abonnement a un accès complet
   */
  hasFullAccess(): boolean {
    return this.props.status.hasFullAccess();
  }

  /**
   * Vérifie si l'abonnement est en période de grâce
   */
  isInGracePeriod(): boolean {
    return this.props.status.isGrace();
  }

  /**
   * Calcule le nombre de jours jusqu'au renouvellement
   * @returns Le nombre de jours, ou null si non applicable
   */
  getDaysUntilRenewal(): number | null {
    const now = new Date();
    const endDate = new Date(this.props.endsAt);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  /**
   * Vérifie si l'abonnement expire bientôt (dans les 7 jours)
   */
  isExpiringSoon(): boolean {
    const daysRemaining = this.getDaysUntilRenewal();
    return daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0;
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Mettre à jour l'état de l'agrégat (immutable)
   */
  private updateState(partial: Partial<SubscriptionProps>): Subscription {
    return new Subscription({
      ...this.props,
      ...partial,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Valider les invariants métier
   * @throws Error si un invariant est violé
   */
  private validateInvariants(): void {
    // Invariant 1 : Un abonnement actif ne peut pas avoir de cancelledAt
    if (this.props.status.isActive() && this.props.cancelledAt) {
      throw new Error('Active subscription cannot have cancelledAt');
    }

    // Invariant 2 : Un abonnement annulé doit avoir cancelledAt
    if (this.props.status.toString() === 'cancelled' && !this.props.cancelledAt) {
      throw new Error('Cancelled subscription must have cancelledAt');
    }

    // Invariant 3 : entityVersion >= 1
    if (this.props.entityVersion < 1) {
      throw new Error('Entity version must be >= 1');
    }

    // Invariant 4 : logicalClock >= 0
    if (this.props.logicalClock < 0) {
      throw new Error('Logical clock must be >= 0');
    }

    // Invariant 5 : Les dates doivent être valides
    if (new Date(this.props.startsAt) > new Date(this.props.endsAt)) {
      throw new Error('Start date must be before end date');
    }
  }

  // =============================================================================
  // Serialization
  // =============================================================================

  toJSON() {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      planId: this.props.planId,
      status: this.props.status.toString(),
      entityVersion: this.props.entityVersion,
      originNode: this.props.originNode,
      logicalClock: this.props.logicalClock,
      startsAt: this.props.startsAt,
      endsAt: this.props.endsAt,
      cancelledAt: this.props.cancelledAt,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}