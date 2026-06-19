/**
 * Application configuration
 * Single source of truth for display names, etc.
 * Values come from Vite environment variables (.env)
 */

export const APP_NAME = (import.meta as any).env?.VITE_APP_NAME || 'QBITE';
export const APP_NAME_SHORT = 'QBITE'; // for compact displays if needed
