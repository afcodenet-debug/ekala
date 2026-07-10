/**
 * App Mode — Version serveur uniquement (Node.js)
 * 
 * Cette version N'utilise PAS import.meta, qui n'est pas disponible côté serveur.
 * 
 * LOCAL  : process.env.VITE_APP_MODE=local
 * CLOUD  : process.env.VITE_APP_MODE=cloud ou par défaut
 * HYBRID : process.env.VITE_APP_MODE=hybrid
 * 
 * Détection :
 * 1. VITE_APP_MODE explicite (priorité maximale)
 * 2. RENDER_CLOUD_MODE=true → CLOUD
 * 3. Fallback → CLOUD (sécurisé pour la production)
 */

export type AppMode = 'LOCAL' | 'CLOUD' | 'HYBRID';

const cachedMode: AppMode = (() => {
  // 1. Explicit mode via environment variable (highest priority)
  if (process.env.VITE_APP_MODE === 'local') return 'LOCAL';
  if (process.env.VITE_APP_MODE === 'cloud') return 'CLOUD';
  if (process.env.VITE_APP_MODE === 'hybrid') return 'HYBRID';

  // 2. Render cloud mode detection
  if (process.env.RENDER_CLOUD_MODE === 'true') return 'CLOUD';

  // 3. Render deployment detection
  if (process.env.RENDER === 'true') return 'CLOUD';

  // 4. Node environment
  if (process.env.NODE_ENV === 'production') return 'CLOUD';

  // 5. Fallback to LOCAL for development
  return 'LOCAL';
})();

export function getAppMode(): AppMode {
  return cachedMode;
}

export const isLocal = (): boolean => cachedMode === 'LOCAL';
export const isCloud = (): boolean => cachedMode === 'CLOUD';
export const isHybrid = (): boolean => cachedMode === 'HYBRID';