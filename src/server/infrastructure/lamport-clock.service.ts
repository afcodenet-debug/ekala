// =============================================================================
// LamportClock — Service d'horloge logique de Lamport
// =============================================================================
// Architecture V2.1 — Infrastructure
// Implémente l'horloge de Lamport pour l'ordre causal en réplication distribuée
// =============================================================================

/**
 * Interface pour Lamport Clock
 */
export interface ILamportClock {
  /**
   * Obtient le temps actuel
   */
  getTime(): number;

  /**
   * Incrémente et retourne le nouveau temps
   */
  increment(): number;

  /**
   * Met à jour l'horloge en observant un temps distant
   * @param remoteTime Le temps reçu d'un autre nœud
   */
  observe(remoteTime: number): void;

  /**
   * Réinitialise l'horloge
   */
  reset(): void;
}

/**
 * Clé pour la persistance dans settings
 */
const LAMPORT_CLOCK_KEY = 'lamport_clock';

/**
 * Service LamportClock
 * 
 * Principe de l'horloge de Lamport :
 * - Chaque nœud maintient un compteur
 * - À chaque événement local : compteur++
 * - À chaque réception d'événement distant : compteur = max(compteur, distant) + 1
 * - Garantit l'ordre causal des événements
 */
export class LamportClock implements ILamportClock {
  private time: number;

  constructor() {
    this.time = this.load();
  }

  /**
   * Obtient le temps actuel
   */
  getTime(): number {
    return this.time;
  }

  /**
   * Incrémente et retourne le nouveau temps
   */
  increment(): number {
    this.time++;
    this.persist();
    return this.time;
  }

  /**
   * Met à jour l'horloge en observant un temps distant
   * @param remoteTime Le temps reçu d'un autre nœud
   */
  observe(remoteTime: number): void {
    this.time = Math.max(this.time, remoteTime) + 1;
    this.persist();
  }

  /**
   * Réinitialise l'horloge
   */
  reset(): void {
    this.time = 0;
    this.persist();
  }

  // =============================================================================
  // Persistence (simplified - uses localStorage in browser, memory in Node)
  // =============================================================================

  /**
   * Charge le temps depuis le storage
   */
  private load(): number {
    try {
      // En environnement Node.js, on pourrait utiliser un fichier ou DB
      // Pour simplifier, on commence à 0
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(LAMPORT_CLOCK_KEY);
        return stored ? parseInt(stored, 10) : 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Persiste le temps dans le storage
   */
  private persist(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(LAMPORT_CLOCK_KEY, this.time.toString());
      }
      // En Node.js, on pourrait sauvegarder dans un fichier ou DB
    } catch {
      // Silently fail - la persistance n'est pas critique
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export class LamportClockFactory {
  private static instance: LamportClock | null = null;

  /**
   * Crée ou retourne l'instance singleton
   */
  static create(): ILamportClock {
    if (!LamportClockFactory.instance) {
      LamportClockFactory.instance = new LamportClock();
    }
    return LamportClockFactory.instance;
  }

  /**
   * Réinitialise l'instance (pour les tests)
   */
  static reset(): void {
    LamportClockFactory.instance = null;
  }
}