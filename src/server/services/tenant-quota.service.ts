import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

let _supabase: SupabaseClient | null = null;

function db(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!_supabase) {
    _supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      db: { schema: 'public' },
    });
  }
  return _supabase;
}

export type QuotaResource = 'users' | 'tables' | 'products' | 'orders';

export async function enforceTenantQuota(tenantId: number, resource: QuotaResource): Promise<{ allowed: boolean; limit: number | null; current: number; message?: string }> {
  const supabase = db();
  if (!supabase) {
    return { allowed: true, limit: null, current: 0 };
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan_id, status')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'trial'])
    .order('current_period_start', { ascending: false })
    .maybeSingle();

  if (!sub) {
    return { allowed: true, limit: null, current: 0 };
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('features, max_users, max_tables, max_products, max_orders_per_month')
    .eq('id', sub.plan_id)
    .maybeSingle();

  if (!plan) {
    return { allowed: true, limit: null, current: 0 };
  }

  const features: Record<string, any> = (plan as any).features || {};
  const quotaField = `max_${resource}` as keyof typeof plan;
  const limit = (plan as any)[quotaField] ?? null;

  if (limit === null || limit === undefined) {
    return { allowed: true, limit: null, current: 0 };
  }

  let current = 0;

  if (resource === 'users') {
    const { count } = await supabase
      .from('tenant_users')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    current = count || 0;
  } else if (resource === 'tables') {
    const { count } = await supabase
      .from('tables')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    current = count || 0;
  } else if (resource === 'products') {
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    current = count || 0;
  } else if (resource === 'orders') {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfMonth.toISOString());
    current = count || 0;
  }

  const allowed = current < limit;

  return {
    allowed,
    limit,
    current,
    message: allowed ? undefined : `Quota dépassé pour ${resource} : ${current}/${limit}`,
  };
}
