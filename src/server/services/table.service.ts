import db from '../db/database';
import crypto from 'crypto';

export type TableStatus = 'available' | 'active' | 'reserved' | 'cleaning' | 'out_of_service';

export interface Table {
  id: number;
  table_number: number;
  capacity: number;
  status: TableStatus;
  assigned_waiter_id: number | null;
  qr_token?: string | null;
  created_at: string;
  updated_at: string;
}

export class TableService {
  static async getAll(params?: { waiter_id?: number; role?: string }): Promise<Table[]> {
    try {
      let query = `
        SELECT
          t.*,
          u.full_name as waiter_name
        FROM restaurant_tables t
        LEFT JOIN users u ON t.assigned_waiter_id = u.id
      `;

      const conditions: string[] = [];
      const values: any[] = [];

      // Role-based filtering
      if (params?.role === 'waiter' && params.waiter_id) {
        conditions.push('t.assigned_waiter_id = ?');
        values.push(params.waiter_id);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY t.table_number';

      const tables = db.prepare(query).all(...values) as Table[];
      return tables;
    } catch (error) {
      console.error('[TableService] Error fetching tables:', error);
      throw new Error('Failed to fetch tables');
    }
  }

  static async getById(id: number): Promise<Table | null> {
    try {
      const table = db.prepare(`
        SELECT
          t.*,
          u.full_name as waiter_name
        FROM restaurant_tables t
        LEFT JOIN users u ON t.assigned_waiter_id = u.id
        WHERE t.id = ?
      `).get(id) as Table | undefined;

      return table || null;
    } catch (error) {
      console.error('[TableService] Error fetching table by ID:', error);
      throw new Error('Failed to fetch table');
    }
  }

  static async create(tableData: Omit<Table, 'id' | 'created_at' | 'updated_at'>): Promise<Table> {
    try {
      // Check if table number already exists
      const existing = db.prepare('SELECT id FROM restaurant_tables WHERE table_number = ?').get(tableData.table_number);
      if (existing) {
        throw new Error(`Table number ${tableData.table_number} already exists`);
      }

      const now = new Date().toISOString();
      const qrToken = crypto.randomUUID().replace(/-/g, '');
      const result = db.prepare(`
        INSERT INTO restaurant_tables (table_number, capacity, status, assigned_waiter_id, qr_token, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(tableData.table_number), // Ensure it's stored as string
        tableData.capacity,
        tableData.status,
        tableData.assigned_waiter_id,
        qrToken,
        now,
        now
      );

      if (!result.lastInsertRowid) {
        throw new Error('Failed to create table');
      }

      const newTable = await this.getById(Number(result.lastInsertRowid));
      if (!newTable) {
        throw new Error('Failed to retrieve created table');
      }

      return newTable;
    } catch (error: any) {
      console.error('[TableService] Error creating table:', error);
      throw error;
    }
  }

  static async update(id: number, updates: Partial<Omit<Table, 'id' | 'created_at' | 'updated_at'>>): Promise<Table> {
    try {
      const table = await this.getById(id);
      if (!table) {
        throw new Error('Table not found');
      }

      // Check if table number conflict
      if (updates.table_number && updates.table_number !== table.table_number) {
        const existing = db.prepare('SELECT id FROM restaurant_tables WHERE table_number = ? AND id != ?')
          .get(updates.table_number, id);
        if (existing) {
          throw new Error(`Table number ${updates.table_number} already exists`);
        }
      }

      const updateFields: string[] = [];
      const values: any[] = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = ?`);
          values.push(value);
        }
      });

      if (updateFields.length === 0) {
        return table; // No changes
      }

      updateFields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);

      db.prepare(`
        UPDATE restaurant_tables
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `).run(...values);

      const updatedTable = await this.getById(id);
      if (!updatedTable) {
        throw new Error('Failed to retrieve updated table');
      }

      return updatedTable;
    } catch (error: any) {
      console.error('[TableService] Error updating table:', error);
      throw error;
    }
  }

  static async updateStatus(id: number, status: TableStatus): Promise<Table> {
    return this.update(id, { status });
  }

  static async openTable(tableId: number, waiterId: number): Promise<Table> {
    try {
      const table = await this.getById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      if (table.status !== 'available' && table.status !== 'reserved') {
        throw new Error('Table is not available for opening');
      }

      return this.update(tableId, {
        status: 'active',
        assigned_waiter_id: waiterId
      });
    } catch (error: any) {
      console.error('[TableService] Error opening table:', error);
      throw error;
    }
  }

  static async reserveTable(tableId: number): Promise<Table> {
    try {
      const table = await this.getById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      if (table.status !== 'available') {
        throw new Error('Table is not available for reservation');
      }

      return this.update(tableId, { status: 'reserved' });
    } catch (error: any) {
      console.error('[TableService] Error reserving table:', error);
      throw error;
    }
  }

  static async markCleaning(tableId: number): Promise<Table> {
    return this.update(tableId, { status: 'cleaning' });
  }

  static async setAvailable(tableId: number): Promise<Table> {
    return this.update(tableId, {
      status: 'available',
      assigned_waiter_id: null
    });
  }

  static async assignWaiter(tableId: number, waiterId: number | null): Promise<Table> {
    return this.update(tableId, { assigned_waiter_id: waiterId });
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const table = await this.getById(id);
      if (!table) {
        return false;
      }

      // Check if table has active orders
      const activeOrders = db.prepare(`
        SELECT COUNT(*) as count
        FROM orders
        WHERE table_id = ? AND status IN ('pending', 'confirmed', 'preparing', 'ready')
      `).get(id) as { count: number };

      if (activeOrders.count > 0) {
        throw new Error('Cannot delete table with active orders');
      }

      const result = db.prepare('DELETE FROM restaurant_tables WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (error: any) {
      console.error('[TableService] Error deleting table:', error);
      throw error;
    }
  }

  static async regenerateQrToken(id: number): Promise<Table> {
    const table = await this.getById(id);
    if (!table) {
      throw new Error('Table not found');
    }

    const newToken = crypto.randomUUID().replace(/-/g, '');
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE restaurant_tables
      SET qr_token = ?, updated_at = ?
      WHERE id = ?
    `).run(newToken, now, id);

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated table after regenerating QR token');
    }
    return updated;
  }
}