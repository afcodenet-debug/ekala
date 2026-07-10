/**
 * App Mode — single source of truth for runtime mode detection
 * 
 * LOCAL  : Vite dev server, or explicit VITE_APP_MODE=local
 * CLOUD  : Deployed on Render/Vercel with Supabase backend
 * HYBRID : Local frontend but cloud backend (e.g. Electron pointing to production API)
 * 
 * Detection order (priority):
 * 1. Explicit VITE_APP_MODE env var (highest priority)
 * 2. Electron detection
 * 3. Vite dev server detection
 * 4. Localhost detection
 * 5. Fallback to CLOUD (safest for production)
 */

export type AppMode = 'LOCAL' | 'CLOUD' | 'HYBRID';

const cachedMode: AppMode = (() => {
  // Server-side: always CLOUD (no import.meta available)
  if (typeof window === 'undefined') {
    return 'CLOUD';
  }

  // Client-side detection
  try {
    // @ts-ignore - import.meta is only available in Vite client build
    const viteEnv = import.meta?.env || {};

    // 1. Explicit mode via environment variable (highest priority)
    if (viteEnv.VITE_APP_MODE === 'local') return 'LOCAL';
    if (viteEnv.VITE_APP_MODE === 'cloud') return 'CLOUD';
    if (viteEnv.VITE_APP_MODE === 'hybrid') return 'HYBRID';

    // 2. Electron detection
    const isElectron = viteEnv.ELECTRON === 'true' || 
                       navigator.userAgent.includes('Electron') ||
                       (window && (window as any).electron);
    if (isElectron) return 'LOCAL';

    // 3. Vite dev server detection
    if (viteEnv.DEV === true) return 'LOCAL';

    // 4. Localhost detection
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'LOCAL';

    // 5. Fallback to CLOUD (safest for production)
    return 'CLOUD';
  } catch (error) {
    // If anything fails, default to CLOUD for safety
    console.warn('[app-mode] Detection failed, defaulting to CLOUD:', error);
    return 'CLOUD';
  }
})();

export function getAppMode(): AppMode {
  return cachedMode;
}

export const isLocal = (): boolean => cachedMode === 'LOCAL';
export const isCloud = (): boolean => cachedMode === 'CLOUD';
export const isHybrid = (): boolean => cachedMode === 'HYBRID';