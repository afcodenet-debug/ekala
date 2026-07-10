// =============================================================================
// Recipient Resolver — Emails de notification d'abonnement
// -----------------------------------------------------------------------------
// Seuls les emails des rôles owner / admin / manager d'un tenant peuvent
// recevoir les notifications par email (demande de paiement, activation).
// =============================================================================

import { db } from '../db/database';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const NOTIFIABLE_ROLES = ['owner', 'admin', 'manager'];

function getSupabase(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });
}

/**
 * Retourne la liste dédupliquée (en minuscules) des emails recevant les
 * notifications d'abonnement pour un tenant : uniquement owner / admin / manager.
 */
export async function getTenantSubscriptionEmails(tenantId: number): Promise<string[]> {
  const seen = new Set<string>();
  const emails: string[] = [];
  const push = (email?: string | null) => {
    const e = (email || '').trim().toLowerCase();
    if (e && !seen.has(e)) {
      seen.add(e);
      emails.push(e);
    }
  };

  const localDb = db;
  if (localDb) {
    try {
      const rows = localDb
        .prepare(`SELECT email FROM users WHERE tenant_id = ? AND role IN (?, ?, ?) AND email IS NOT NULL`)
        .all(tenantId, ...NOTIFIABLE_ROLES) as { email?: string }[];
      rows.forEach((r) => push(r.email));
    } catch {
      /* table users indisponible */
    }
  } else {
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase
        .from('users')
        .select('email')
        .eq('tenant_id', tenantId)
        .in('role', NOTIFIABLE_ROLES)
        .not('email', 'is', null);
      (data || []).forEach((r: any) => push(r.email));
    }
  }

  return emails;
}
