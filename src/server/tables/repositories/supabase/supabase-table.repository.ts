import { createClient } from '@supabase/supabase-js';
import { TableEntity, ITableRepository } from '../table.repository.interface';
import { env } from '../../../config/env';

export class SupabaseTableRepository implements ITableRepository {
  private supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false }
  });

  constructor() {
    console.log('[SupabaseTableRepository] Initialized', {
      hasUrl: !!env.SUPABASE_URL,
      hasServiceKey: !!env.SUPABASE_SERVICE_ROLE_KEY,
      urlHost: env.SUPABASE_URL ? new URL(env.SUPABASE_URL).host : null,
      USE_SUPABASE_TABLES: env.USE_SUPABASE_TABLES,
    });
  }

  async findByQrToken(qrToken: string, businessId?: string): Promise<TableEntity | null> {
    const tokenPreview = qrToken ? qrToken.slice(0, 8) + '...' + qrToken.slice(-4) : null;

    console.log('[SupabaseTableRepository] findByQrToken start', {
      qrToken: tokenPreview,
      businessId: businessId ?? null,
      USE_SUPABASE_TABLES: env.USE_SUPABASE_TABLES,
    });

    // 1) Exact lookup
    const { data, error } = await this.supabase
      .from('restaurant_tables')
      .select('*')
      .eq('qr_token', qrToken)
      .maybeSingle();

    console.log('[SupabaseTableRepository] findByQrToken response', {
      hasData: !!data,
      dataId: data?.id ?? null,
      errorCode: error?.code ?? null,
      errorMessage: error?.message ?? null,
      errorDetails: error?.details ?? null,
    });

    if (data) {
      return data as TableEntity;
    }

    // 2) Direct count for diagnostics (even if no row matched)
    const { count, error: countError } = await this.supabase
      .from('restaurant_tables')
      .select('*', { count: 'exact', head: true })
      .eq('qr_token', qrToken);

    console.log('[SupabaseTableRepository] findByQrToken COUNT (direct)', {
      matchingRowCount: count ?? 0,
      countError: countError?.message ?? null,
    });

    return null;
  }
}
