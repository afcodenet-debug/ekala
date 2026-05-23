import { ITableRepository } from './table.repository.interface';
import { SupabaseTableRepository } from './supabase/supabase-table.repository';
import { LegacySQLiteTableAdapter } from './legacy/legacy-sqlite-table.adapter';
import { env } from '../../config/env';

export function getTableRepository(): ITableRepository {
  return env.USE_SUPABASE_TABLES
    ? new SupabaseTableRepository()
    : new LegacySQLiteTableAdapter();
}
