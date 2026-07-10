/**
 * RuntimeContext - Abstraction minimale du mode d'exécution
 * 
 * PHASE 1 : Remplace progressivement les accès directs à app-mode.ts
 * 
 * Cette couche permet de :
 * - Centraliser la détection du mode
 * - Faciliter les tests (mock du contexte)
 * - Préparer l'ajout de nouveaux modes sans casser l'existant
 */

export type ExecutionMode = 'LOCAL' | 'CLOUD' | 'HYBRID';

export interface RuntimeContextInterface {
  readonly mode: ExecutionMode;
  readonly isLocal: boolean;
  readonly isCloud: boolean;
  readonly isHybrid: boolean;
}

/**
 * RuntimeContext - Version immuable et minimaliste
 * 
 * Remplace progressivement les imports directs de app-mode.ts
 * 
 * @example
 * // AVANT
 * import { isLocal } from '../lib/app-mode';
 * if (isLocal()) { ... }
 * 
 * // APRÈS
 * const runtime = RuntimeContext.getInstance();
 * if (runtime.isLocal) { ... }
 */
export class RuntimeContext implements RuntimeContextInterface {
  private static instance: RuntimeContext;
  
  readonly mode: ExecutionMode;
  readonly isLocal: boolean;
  readonly isCloud: boolean;
  readonly isHybrid: boolean;

  private constructor(mode: ExecutionMode) {
    this.mode = mode;
    this.isLocal = mode === 'LOCAL';
    this.isCloud = mode === 'CLOUD';
    this.isHybrid = mode === 'HYBRID';
  }

  /**
   * Singleton - Retourne l'instance unique du RuntimeContext
   */
  static getInstance(): RuntimeContext {
    if (!RuntimeContext.instance) {
      // Import dynamique pour éviter la dépendance circulaire
      // et permettre à app-mode.ts de continuer à exister
      RuntimeContext.instance = RuntimeContext.create();
    }
    return RuntimeContext.instance;
  }

  /**
   * Crée une nouvelle instance (pour tests)
   */
  static create(mode?: ExecutionMode): RuntimeContext {
    const resolvedMode = mode || RuntimeContext.detectMode();
    return new RuntimeContext(resolvedMode);
  }

  /**
   * Réinitialise le singleton (pour tests)
   */
  static reset(): void {
    RuntimeContext.instance = undefined as any;
  }

  /**
   * Détecte le mode d'exécution
   * Délègue à app-mode.ts pour la rétrocompatibilité
   */
  private static detectMode(): ExecutionMode {
    try {
      // Côté client (navigateur) : détection via window.location
      if (typeof window !== 'undefined') {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
          return 'LOCAL';
        }
        
        // Par défaut en production web : CLOUD
        return 'CLOUD';
      }
      
      // Côté serveur (Node.js) : détection via process.env uniquement
      // NOTE: On n'importe PAS app-mode.ts car il utilise import.meta (Vite only)
      if (process.env.VITE_APP_MODE === 'local') return 'LOCAL';
      if (process.env.VITE_APP_MODE === 'cloud') return 'CLOUD';
      if (process.env.VITE_APP_MODE === 'hybrid') return 'HYBRID';
      if (process.env.RENDER_CLOUD_MODE === 'true') return 'CLOUD';
      if (process.env.RENDER === 'true') return 'CLOUD';
      if (process.env.NODE_ENV === 'production') return 'CLOUD';
      
      // Fallback serveur
      return 'LOCAL';
    } catch (error) {
      // Fallback sécurisé en cas d'erreur
      console.warn('[RuntimeContext] Impossible de détecter le mode, fallback sur CLOUD:', error);
      return 'CLOUD';
    }
  }

  /**
   * toString pour debugging
   */
  toString(): string {
    return `RuntimeContext(mode=${this.mode}, isLocal=${this.isLocal}, isCloud=${this.isCloud}, isHybrid=${this.isHybrid})`;
  }
}