// src/server/database/supabase.client.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import type { Database } from '../types/database.types'; // sera généré plus tard

let supabaseClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    // Debug logging for Render deployment issues
    console.log(`[SupabaseClient] SUPABASE_URL from env: ${env.SUPABASE_URL ? '***defined***' : 'UNDEFINED'}`);
    console.log(`[SupabaseClient] SUPABASE_SERVICE_ROLE_KEY from env: ${env.SUPABASE_SERVICE_ROLE_KEY ? '***defined***' : 'UNDEFINED'}`);
    console.log(`[SupabaseClient] process.env.SUPABASE_URL: ${process.env.SUPABASE_URL ? '***defined***' : 'UNDEFINED'}`);
    console.log(`[SupabaseClient] process.env.SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '***defined***' : 'UNDEFINED'}`);
    console.log(`[SupabaseClient] RENDER_CLOUD_MODE: ${process.env.RENDER_CLOUD_MODE}`);
    console.log(`[SupabaseClient] USE_SUPABASE_TABLES: ${process.env.USE_SUPABASE_TABLES}`);
    
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[SupabaseClient] SUPABASE_URL:', env.SUPABASE_URL);
      console.error('[SupabaseClient] SUPABASE_SERVICE_ROLE_KEY:', env.SUPABASE_SERVICE_ROLE_KEY ? '***defined***' : 'UNDEFINED');
      throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis');
    }

    supabaseClient = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        db: {
          schema: 'public',
        },
      }
    );
  }

  return supabaseClient;
}
