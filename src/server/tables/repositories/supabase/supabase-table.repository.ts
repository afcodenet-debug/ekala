import { createClient } from '@supabase/supabase-js';
import { TableEntity, ITableRepository } from '../table.repository.interface';
import { env } from '../../../config/env';

export class SupabaseTableRepository implements ITableRepository {
  private supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false }
  });

  async findByQrToken(qrToken: string): Promise<TableEntity | null> {
    const { data, error } = await this.supabase
      .from('restaurant_tables')
      .select('*')
      .eq('qr_token', qrToken)
      .single();

    if (error) return null;
    return data;
  }
}
