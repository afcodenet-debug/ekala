import db from './db/database';
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

interface SyncRecord {
  id: number;
  table_name: string;
  operation: string;
  record_id: number | null;
  data: string;
  version: number;
  created_at: string;
}

export class SyncService {
  private isOnline = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startPeriodicSync();
  }

  private async checkConnectivity(): Promise<boolean> {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: { 'apikey': SUPABASE_ANON_KEY },
        timeout: 5000
      });
      this.isOnline = response.ok;
      return this.isOnline;
    } catch {
      this.isOnline = false;
      return false;
    }
  }

  private startPeriodicSync() {
    this.syncInterval = setInterval(async () => {
      if (await this.checkConnectivity()) {
        await this.performSync();
      }
    }, 30000);
  }

  async performSync(): Promise<void> {
    if (!this.isOnline || !SUPABASE_URL) return;

    const unsyncedRecords = db.prepare(`
      SELECT * FROM sync_queue
      WHERE sync_status != 'synced' AND retry_count < 5
      ORDER BY created_at ASC
    `).all() as SyncRecord[];

    for (const record of unsyncedRecords) {
      try {
        await this.syncRecord(record);
        db.prepare("UPDATE sync_queue SET sync_status = 'synced', synced_at = CURRENT_TIMESTAMP WHERE id = ?").run(record.id);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        db.prepare("UPDATE sync_queue SET retry_count = retry_count + 1, error_message = ? WHERE id = ?").run(msg, record.id);
      }
    }
  }

  private async syncRecord(record: SyncRecord): Promise<void> {
    const url = `${SUPABASE_URL}/rest/v1/${record.table_name}`;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation'
    };

    const payload = JSON.parse(record.data);
    let response;

    switch (record.operation) {
      case 'INSERT':
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...payload, version: record.version, device_id: this.getDeviceId() })
        });
        break;
      case 'UPDATE':
        response = await fetch(`${url}?id=eq.${record.record_id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ ...payload, version: record.version })
        });
        break;
      case 'DELETE':
        response = await fetch(`${url}?id=eq.${record.record_id}`, {
          method: 'DELETE',
          headers
        });
        break;
    }

    if (!response || !response.ok) {
      throw new Error(`Sync failed with status ${response?.status}`);
    }
  }

  private getDeviceId(): string {
    const result = db.prepare("SELECT value FROM sync_metadata WHERE key = 'device_id'").get() as { value: string };
    return result?.value || 'unknown_device';
  }

  queueChange(tableName: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', recordId: number | null, data: any): void {
    db.prepare(`
      INSERT INTO sync_queue (table_name, operation, record_id, data, version)
      VALUES (?, ?, ?, ?, ?)
    `).run(tableName, operation, recordId, JSON.stringify(data), data.version || 1);
  }

  stopSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);
  }
}

export const syncService = new SyncService();
