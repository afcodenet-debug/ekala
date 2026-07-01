import { create } from 'zustand';

interface AuthReadyStore {
  isReady: boolean;
  setReady: (ready: boolean) => void;
}

export const useAuthReadyStore = create<AuthReadyStore>((set) => ({
  isReady: false,
  setReady: (ready) => {
    console.log('[AUTH READY] Auth ready state changed:', ready);
    set({ isReady: ready });
  },
}));

// Export a direct accessor for non-React contexts (event listeners, etc.)
export const getAuthReadyState = () => useAuthReadyStore.getState().isReady;
