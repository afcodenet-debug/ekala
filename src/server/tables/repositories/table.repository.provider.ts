import { ITableRepository } from './table.repository.interface';
import { SupabaseTableRepository } from './supabase/supabase-table.repository';
import { env } from '../../config/env';

let legacyTableAdapter: any = null;

export function getTableRepository(): ITableRepository {
  if (env.USE_SUPABASE_TABLES) {
    return new SupabaseTableRepository();
  }
  if (!legacyTableAdapter) {
    legacyTableAdapter = require('./legacy/legacy-sqlite-table.adapter').LegacySQLiteTableAdapter;
  }
  return new legacyTableAdapter();
}
