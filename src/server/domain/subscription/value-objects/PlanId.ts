// =============================================================================
// PlanId Value Object
// =============================================================================
// Architecture V2.1 — DDD Value Object
// Représente l'identifiant d'un plan d'abonnement
// =============================================================================

/**
 * Classe Value Object pour l'identifiant de plan
 * 
 * Règles métier :
 * - Doit être un nombre positif
 * - Ne peut pas être 0
 * - Est immuable
 */
export class PlanId {
  private constructor(private readonly value: number) {}

  // =============================================================================
  // Factory Methods
  // =============================================================================

  /**
   * Créer un PlanId depuis un nombre
   * @param value - L'identifiant du plan (doit être > 0)
   * @throws Error si la valeur est invalide
   */
  static create(value: number): PlanId {
    if (!Number.isInteger(value)) {
      throw new Error(`PlanId must be an integer, got: ${value}`);
    }
    
    if (value <= 0) {
      throw new Error(`PlanId must be positive, got: ${value}`);
    }
    
    return new PlanId(value);
  }

  /**
   * Créer un PlanId depuis une string
   * @param value - La string représentant l'identifiant
   * @throws Error si la conversion échoue
   */
  static fromString(value: string): PlanId {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Cannot convert "${value}" to PlanId`);
    }
    return PlanId.create(parsed);
  }

  // =============================================================================
  // Getters
  // =============================================================================

  /**
   * Obtenir la valeur brute
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Obtenir la valeur en string
   */
  toString(): string {
    return String(this.value);
  }

  /**
   * Obtenir la valeur en JSON
   */
  toJSON(): number {
    return this.value;
  }

  /**
   * Comparer deux PlanId
   */
  equals(other: PlanId): boolean {
    return this.value === other.value;
  }

  /**
   * Vérifier si c'est un plan gratuit (id = 1 généralement)
   */
  isFree(): boolean {
    return this.value === 1;
  }

  /**
   * Vérifier si c'est un plan premium (id > 1)
   */
  isPremium(): boolean {
    return this.value > 1;
  }
}