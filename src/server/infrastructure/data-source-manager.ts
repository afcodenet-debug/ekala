/**
 * RuntimeModeResolver - UNIQUE source de vérité pour le mode d'exécution.
 *
 * Architecture :
 * - Electron : SQLite est TOUJOURS la source de vérité. Supabase = sync uniquement.
 * - Web (Vercel/Render) : Supabase est la source de vérité.
 *
 * TOUTE décision concernant le mode d'exécution doit passer par ce resolver.
 * Aucun service ne peut créer directement un client Supabase.
 *
 * Usage :
 *   import { runtime } from '../infrastructure/data-source-manager';
 *   if (runtime.isCloud()) { ... Supabase ... }
 *   else { ... SQLite ... }
 *
 *   const supabase = runtime.getSupabase(req);  // Retourne null si mode local
 *   const db = runtime.getSQLite();              // Retourne null si mode cloud
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { resolveRuntimeMode } from '../../shared/runtime-mode';

export type EnvironmentMode = 'LOCAL' | 'CLOUD';

class RuntimeModeResolver {
  private _mode: EnvironmentMode;
  private _supabaseClient: SupabaseClient | null = null;
  private _sqliteClient: any = null;

  constructor() {
    this._mode = this.detectModeInternal();
    console.log(`[RuntimeMode] Mode: ${this._mode === 'CLOUD' ? '☁️ CLOUD' : '💻 LOCAL'} | Electron: ${this.isElectron()}`);
  }

  /**
   * Détecte l'environnement actuel (n'appelle PAS les consumers)
   * Electron → toujours local. Web → détection automatique.
   */
  private detectModeInternal(): EnvironmentMode {
    // Étape 0 : VITE_APP_MODE a la priorité absolue (défini par l'utilisateur dans .env)
    const viteAppMode = process.env.VITE_APP_MODE;
    if (viteAppMode === 'local') {
      console.log('[RuntimeModeResolver] VITE_APP_MODE=local → forcing LOCAL mode');
      return 'LOCAL';
    }
    if (viteAppMode === 'cloud') {
      console.log('[RuntimeModeResolver] VITE_APP_MODE=cloud → forcing CLOUD mode');
      return 'CLOUD';
    }
    if (viteAppMode === 'hybrid') {
      console.log('[RuntimeModeResolver] VITE_APP_MODE=hybrid → forcing HYBRID mode');
      return 'CLOUD'; // HYBRID not supported yet, fallback to CLOUD
    }

    // Étape 1 : Electron détecté → TOUJOURS local
    if (this.isElectron()) {
      console.log('[RuntimeModeResolver] Electron detected → LOCAL mode');
      return 'LOCAL';
    }

    // Étape 2 : Variables d'environnement (avec logs de diagnostic)
    const renderCloudMode = env.RENDER_CLOUD_MODE;
    const useSupabaseProducts = env.USE_SUPABASE_PRODUCTS;
    const useSupabaseTables = env.USE_SUPABASE_TABLES;
    const useSupabaseOrders = env.USE_SUPABASE_ORDERS;
    
    console.log('[RuntimeModeResolver] Diagnostic:', {
      RENDER_CLOUD_MODE: renderCloudMode,
      USE_SUPABASE_PRODUCTS: useSupabaseProducts,
      USE_SUPABASE_TABLES: useSupabaseTables,
      USE_SUPABASE_ORDERS: useSupabaseOrders,
      NODE_ENV: env.NODE_ENV,
      VITE_APP_MODE: viteAppMode
    });

    if (renderCloudMode || useSupabaseProducts || useSupabaseTables || useSupabaseOrders) {
      console.log('[RuntimeModeResolver] Cloud mode detected via env vars → CLOUD mode');
      return 'CLOUD';
    }

    // Étape 3 : NODE_ENV
    if (env.NODE_ENV === 'development') {
      console.log('[RuntimeModeResolver] NODE_ENV=development → LOCAL mode');
      return 'LOCAL';
    }

    // Étape 4 : Défaut → cloud (Render/Vercel)
    console.log('[RuntimeModeResolver] No specific mode detected → default CLOUD mode');
    return 'CLOUD';
  }

  /**
   * Détecte si l'application tourne dans Electron
   */
  private isElectron(): boolean {
    if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Electron')) {
      return true;
    }
    if (typeof process !== 'undefined' && process.versions?.electron) {
      return true;
    }
    return false;
  }

  /**
   * Résout le mode à partir d'une requête HTTP.
   * Vérifie X-Runtime-Mode header en priorité.
   */
  resolveFromRequest(req: { headers?: Record<string, any> }): EnvironmentMode {
    const runtimeHeader = req?.headers?.['x-runtime-mode'];
    if (runtimeHeader === 'LOCAL' || runtimeHeader === 'CLOUD') {
      console.log(`[RuntimeMode] resolveFromRequest: X-Runtime-Mode header = ${runtimeHeader}`);
      return runtimeHeader;
    }

    // ⭐ CRITICAL: Re-detect mode from request origin (for dynamic detection)
    const host = req?.headers?.host || req?.headers?.origin || req?.headers?.referer;
    if (host) {
      const detectedMode = resolveRuntimeMode(String(host));
      console.log(`[RuntimeMode] resolveFromRequest: host=${host} → ${detectedMode}`);
      return detectedMode;
    }

    // Fallback to static mode
    console.log(`[RuntimeMode] resolveFromRequest: no host detected, using static mode = ${this._mode}`);
    return this._mode;
  }

  /** Retourne le mode actuel */
  get mode(): EnvironmentMode {
    return this._mode;
  }

  /** Vrai si on est en mode cloud (Supabase source de vérité) */
  isCloud(value?: string | null): boolean {
    if (this._mode === 'LOCAL') return false;
    if (value === 'LOCAL' || value === 'CLOUD') return value === 'CLOUD';
    return this._mode === 'CLOUD';
  }

  /** Vrai si on est en mode local (SQLite source de vérité) */
  isLocal(value?: string | null): boolean {
    return !this.isCloud(value);
  }

  /**
   * Retourne le client Supabase SI on est en mode cloud.
   * Retourne null en mode local (Electron).
   * TOUS les consumers doivent passer par cette méthode.
   */
  getSupabase(req?: { headers?: Record<string, any> }): SupabaseClient | null {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;

    const mode = req ? this.resolveFromRequest(req) : this._mode;
    if (mode !== 'CLOUD') return null;

    if (!this._supabaseClient) {
      this._supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
        db: { schema: 'public' },
      });
    }
    return this._supabaseClient;
  }

  /**
   * Retourne la base SQLite locale.
   * Retourne null si SQLite n'est pas disponible (mode cloud web).
   */
  getSQLite(): any {
    if (this._mode === 'CLOUD') return null;
    if (this._sqliteClient) return this._sqliteClient;
    try {
      this._sqliteClient = require('../db/database').default;
    } catch {
      this._sqliteClient = null;
    }
    return this._sqliteClient;
  }

  // ── Alias de rétrocompatibilité ──────────────────────────────────────────────
  /** @deprecated Utiliser isCloud() */
  isCloudMode(value?: string | null): boolean { return this.isCloud(value); }
  /** @deprecated Utiliser isLocal() */
  isLocalMode(value?: string | null): boolean { return this.isLocal(value); }
  /** @deprecated Utiliser directement le constructeur */
  logStatus(): void { console.log(`[RuntimeMode] Mode: ${this._mode}`); }
  /** @deprecated Utiliser getSupabase() */
  getSupabaseClient(req?: { headers?: Record<string, any> }): SupabaseClient | null { return this.getSupabase(req); }
}

// Singleton exporté (rétrocompatibilité : dataSource alias vers runtime)
export const runtime = new RuntimeModeResolver();
export const dataSource = runtime;
