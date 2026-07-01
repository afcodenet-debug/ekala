/**
 * useAuthReady - Global Auth Ready Guard Hook
 * 
 * Prevents API calls before auth is fully hydrated.
 * Handles both tenant and platform auth systems.
 * 
 * Usage:
 * ```tsx
 * const { isReady, status, system } = useAuthReady('/platform');
 * if (!isReady) return <Loading />;
 * ```
 */
import { useState, useEffect } from 'react';
import { authRouter, subscribeToAuth } from './auth-router';
import type { AuthStatus } from './auth-router';

export type AuthSystem = 'tenant' | 'platform' | 'auto';

interface AuthReadyState {
  isReady: boolean;
  status: AuthStatus;
  system: string;
}

/**
 * Hook that blocks rendering until the auth system is ready.
 * 
 * @param routeOrSystem - Route path to detect system, or explicit system name
 * @returns AuthReadyState with isReady, status, and system info
 */
export function useAuthReady(routeOrSystem?: string): AuthReadyState {
  const [state, setState] = useState<AuthReadyState>(() => {
    const context = authRouter.getAuthContext(routeOrSystem);
    return {
      isReady: context?.status === 'ready',
      status: context?.status || 'hydrating',
      system: context?.system || 'unknown',
    };
  });

  useEffect(() => {
    const unsubscribe = subscribeToAuth(() => {
      const context = authRouter.getAuthContext(routeOrSystem);
      setState({
        isReady: context?.status === 'ready',
        status: context?.status || 'hydrating',
        system: context?.system || 'unknown',
      });
    });

    // Re-check immediately in case auth is already ready
    const context = authRouter.getAuthContext(routeOrSystem);
    if (context?.status === 'ready' && !state.isReady) {
      setState({
        isReady: true,
        status: 'ready',
        system: context.system,
      });
    }

    return () => unsubscribe();
  }, [routeOrSystem]);

  return state;
}

/**
 * Hook that waits for a specific auth system to be ready.
 * 
 * @param system - 'tenant' | 'platform'
 * @returns isReady boolean
 */
export function useSystemReady(system: 'tenant' | 'platform'): boolean {
  const [isReady, setIsReady] = useState(() => {
    const context = authRouter.getAuthContext(system === 'platform' ? '/platform' : '/');
    return context?.status === 'ready';
  });

  useEffect(() => {
    const unsubscribe = subscribeToAuth(() => {
      const context = authRouter.getAuthContext(system === 'platform' ? '/platform' : '/');
      setIsReady(context?.status === 'ready');
    });

    // Re-check immediately
    const context = authRouter.getAuthContext(system === 'platform' ? '/platform' : '/');
    setIsReady(context?.status === 'ready');

    return () => unsubscribe();
  }, [system]);

  return isReady;
}

export default useAuthReady;