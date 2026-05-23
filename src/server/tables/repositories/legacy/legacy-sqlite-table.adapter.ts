import { db } from '../../../db/database';
import { TableEntity, ITableRepository } from '../table.repository.interface';

export class LegacySQLiteTableAdapter implements ITableRepository {
  async findByQrToken(qrToken: string, _businessId?: string): Promise<TableEntity | null> {
    return db.prepare(`
      SELECT id, table_number, capacity, status, assigned_waiter_id, qr_token
      FROM restaurant_tables
      WHERE qr_token = ?
      LIMIT 1
    `).get(qrToken) as TableEntity | null;
  }
}
