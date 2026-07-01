// =============================================================================
// OriginNode — Service d'identifiant de nœud
// =============================================================================
// Architecture V2.1 — Infrastructure
// Gère l'identifiant unique du nœud pour la réplication distribuée
// =============================================================================

/**
 * Interface pour Origin Node
 */
export interface IOriginNode {
  /**
   * Obtient l'identifiant du nœud
   */
  getNodeId(): string;

  /**
   * Vérifie si ce nœud est l'initiateur d'un événement
   * @param originNodeId L'identifiant du nœud origine de l'événement
   */
  isOrigin(originNodeId: string): boolean;
}

/**
 * Clé pour la persistance dans settings
 */
const ORIGIN_NODE_KEY = 'origin_node_id';

/**
 * Service OriginNode
 * 
 * Principe :
 * - Chaque nœud a un UUID unique
 * - L'UUID est persistant (survive aux redémarrages)
 * - Utilisé pour prévenir les boucles de réplication
 * - Permet d'identifier l'origine d'un événement
 */
export class OriginNode implements IOriginNode {
  private nodeId: string;

  constructor() {
    this.nodeId = this.loadOrGenerate();
  }

  /**
   * Obtient l'identifiant du nœud
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * Vérifie si ce nœud est l'initiateur d'un événement
   * @param originNodeId L'identifiant du nœud origine de l'événement
   */
  isOrigin(originNodeId: string): boolean {
    return this.nodeId === originNodeId;
  }

  // =============================================================================
  // Persistence
  // =============================================================================

  /**
   * Charge ou génère un nodeId
   */
  private loadOrGenerate(): string {
    try {
      // Essayer de charger depuis le storage
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(ORIGIN_NODE_KEY);
        if (stored) {
          return stored;
        }
      }

      // Générer un nouveau UUID
      const newId = this.generateUUID();
      
      // Persister
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(ORIGIN_NODE_KEY, newId);
      }

      return newId;
    } catch {
      // En cas d'erreur, générer un ID temporaire
      return this.generateUUID();
    }
  }

  /**
   * Génère un UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// =============================================================================
// Factory
// =============================================================================

export class OriginNodeFactory {
  private static instance: OriginNode | null = null;

  /**
   * Crée ou retourne l'instance singleton
   */
  static create(): IOriginNode {
    if (!OriginNodeFactory.instance) {
      OriginNodeFactory.instance = new OriginNode();
    }
    return OriginNodeFactory.instance;
  }

  /**
   * Réinitialise l'instance (pour les tests)
   */
  static reset(): void {
    OriginNodeFactory.instance = null;
  }
}