/**
 * ModeResolver - DÉPRÉCIÉ: Utiliser RuntimeContext ou getAppMode() directement
 * 
 * Ce fichier est conservé pour la rétrocompatibilité mais ne doit plus être utilisé.
 * 
 * @deprecated Use RuntimeContext.getInstance() or getAppMode() from app-mode.ts instead
 */

import { RuntimeContext, ExecutionMode } from './runtime-context';

export interface IModeResolver {
  resolve(): ExecutionMode;
}

/**
 * @deprecated Use RuntimeContext.getInstance() instead
 */
export class ModeResolver implements IModeResolver {
  resolve(): ExecutionMode {
    return RuntimeContext.getInstance().mode;
  }

  createContext(): RuntimeContext {
    return RuntimeContext.create(this.resolve());
  }
}

// Alias pour rétrocompatibilité
export const modeResolver = new ModeResolver();
