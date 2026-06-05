/**
 * Application configuration
 * Single source of truth for display names, etc.
 * Values come from Vite environment variables (.env)
 */

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'EKALA';
export const APP_NAME_SHORT = 'EKALA'; // for compact displays if needed
