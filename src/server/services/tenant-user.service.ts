import db from '../db/database';
import { env } from '../config/env';
import { getUserTenantSyncService, withOutboxTransaction } from '../../sync';

export type TenantUserRole = 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter' | 'staff';

export interface TenantUser {
  id: number;
  tenant_id: number;
  user_id: number;
  role: TenantUserRole;
  is_default: number;
  is_active: number;
  invited_at?: string | null;
  joined_at?: string | null;
  remote_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface TenantUserCreateInput {
  tenant_id: number;
  user_id: number;
  role: TenantUserRole;
  is_default?: number;
  is_active?: number;
  invited_at?: string | null;
  joined_at?: string | null;
}

export interface TenantUserUpdateInput {
  role?: TenantUserRole;
  is_default?: number;
  is_active?: number;
  joined_at?: string | null;
}

export class TenantUserService {
  static async getByTenantAndUser(tenantId: number, userId: number): Promise<TenantUser | null> {
    if (!db) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('tenant_users')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw error;
        return data as TenantUser;
      } catch (err) {
        console.error('[TenantUserService] Supabase getByTenantAndUser failed:', err);
        return null;
      }
    }

    try {
      const row = db.prepare('SELECT * FROM tenant_users WHERE tenant_id = ? AND user_id = ?').get(tenantId, userId) as TenantUser | undefined;
      return row || null;
    } catch (error) {
      console.error('[TenantUserService] getByTenantAndUser error:', error);
      return null;
    }
  }

  static async addMember(input: TenantUserCreateInput): Promise<TenantUser> {
    if (!db || env.RENDER_CLOUD_MODE) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase not configured');
      }
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('tenant_users')
          .insert([{
            tenant_id: input.tenant_id,
            user_id: input.user_id,
            role: input.role,
            is_default: input.is_default ?? 0,
            is_active: input.is_active ?? 1,
            invited_at: input.invited_at ?? null,
            joined_at: input.joined_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;
        return data as TenantUser;
      } catch (err: any) {
        console.error('[TenantUserService] Supabase addMember failed:', err);
        throw new Error(err.message || 'Failed to add member via Supabase');
      }
    }

    try {
      return withOutboxTransaction(db, String(input.tenant_id), () => {
        const now = new Date().toISOString();
        const result = db.prepare(`
          INSERT INTO tenant_users (
            tenant_id, user_id, role, is_default, is_active, 
            invited_at, joined_at, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          input.tenant_id,
          input.user_id,
          input.role,
          input.is_default ?? 0,
          input.is_active ?? 1,
          input.invited_at ?? null,
          input.joined_at ?? now,
          now,
          now
        );

        const created = db.prepare('SELECT * FROM tenant_users WHERE id = ?').get(result.lastInsertRowid) as TenantUser;

        try {
          const syncService = getUserTenantSyncService();
          if (syncService) {
            syncService.queueTenantUserChange('insert', created);
          }
        } catch (syncErr) {
          console.warn('[TenantUserService] Failed to queue tenant_user insert for sync:', syncErr);
        }

        return created;
      });
    } catch (error: any) {
      console.error('[TenantUserService] addMember error:', error);
      throw error;
    }
  }

  static async updateMember(tenantId: number, userId: number, updates: TenantUserUpdateInput): Promise<TenantUser> {
    if (!db || env.RENDER_CLOUD_MODE) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase not configured');
      }
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('tenant_users')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;
        return data as TenantUser;
      } catch (err: any) {
        console.error('[TenantUserService] Supabase updateMember failed:', err);
        throw new Error(err.message || 'Failed to update member via Supabase');
      }
    }

    try {
      return withOutboxTransaction(db, String(tenantId), () => {
        const existing = db.prepare('SELECT * FROM tenant_users WHERE tenant_id = ? AND user_id = ?').get(tenantId, userId) as TenantUser | undefined;
        if (!existing) throw new Error('TenantUser relation not found');

        const fields: string[] = [];
        const values: any[] = [];

        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) {
            fields.push(`${key} = ?`);
            values.push(value);
          }
        }

        if (fields.length === 0) return existing;

        const now = new Date().toISOString();
        fields.push('updated_at = ?');
        values.push(now);
        values.push(tenantId, userId);

        db.prepare(`UPDATE tenant_users SET ${fields.join(', ')} WHERE tenant_id = ? AND user_id = ?`).run(...values);

        const updated = db.prepare('SELECT * FROM tenant_users WHERE tenant_id = ? AND user_id = ?').get(tenantId, userId) as TenantUser;

        try {
          const syncService = getUserTenantSyncService();
          if (syncService) {
            syncService.queueTenantUserChange('update', updated);
          }
        } catch (syncErr) {
          console.warn('[TenantUserService] Failed to queue tenant_user update for sync:', syncErr);
        }

        return updated;
      });
    } catch (error: any) {
      console.error('[TenantUserService] updateMember error:', error);
      throw error;
    }
  }

  static async removeMember(tenantId: number, userId: number): Promise<boolean> {
    if (!db || env.RENDER_CLOUD_MODE) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase not configured');
      }
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        const { error } = await supabase
          .from('tenant_users')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('user_id', userId);

        if (error) throw error;
        return true;
      } catch (err: any) {
        console.error('[TenantUserService] Supabase removeMember failed:', err);
        throw new Error(err.message || 'Failed to remove member via Supabase');
      }
    }

    try {
      return withOutboxTransaction(db, String(tenantId), () => {
        const existing = db.prepare('SELECT id, remote_id FROM tenant_users WHERE tenant_id = ? AND user_id = ?').get(tenantId, userId) as { id: number, remote_id: number | null } | undefined;
        if (!existing) return false;

        const result = db.prepare('DELETE FROM tenant_users WHERE tenant_id = ? AND user_id = ?').run(tenantId, userId);

        if (result.changes > 0) {
          try {
            const syncService = getUserTenantSyncService();
            if (syncService) {
              syncService.queueTenantUserChange('delete', { id: existing.id, remote_id: existing.remote_id });
            }
          } catch (syncErr) {
            console.warn('[TenantUserService] Failed to queue tenant_user deletion for sync:', syncErr);
          }
        }

        return result.changes > 0;
      });
    } catch (error: any) {
      console.error('[TenantUserService] removeMember error:', error);
      throw error;
    }
  }
}

export default TenantUserService;
