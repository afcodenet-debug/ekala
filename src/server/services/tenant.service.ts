import db from '../db/database';
import { env } from '../config/env';
import { getUserTenantSyncService, withOutboxTransaction } from '../../sync';

export interface Tenant {
  id: number;
  slug: string | null;
  name: string;
  legal_name: string | null;
  owner_email: string;
  owner_phone: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  country: string;
  city: string | null;
  address: string | null;
  logo_url: string | null;
  primary_color: string | null;
  default_currency: string;
  default_locale: string;
  timezone: string;
  status: 'active' | 'suspended' | 'cancelled' | 'trial';
  is_provisioned: number;
  remote_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface TenantUpdateInput {
  name?: string;
  slug?: string;
  legal_name?: string | null;
  owner_email?: string;
  owner_phone?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  country?: string;
  city?: string | null;
  address?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  default_currency?: string;
  default_locale?: string;
  timezone?: string;
  status?: 'active' | 'suspended' | 'cancelled' | 'trial';
}

export class TenantService {
  static async getById(id: number): Promise<Tenant | null> {
    if (!db) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        return data as Tenant;
      } catch (err) {
        console.error('[TenantService] Supabase getById failed:', err);
        return null;
      }
    }

    try {
      const row = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id) as Tenant | undefined;
      return row || null;
    } catch (error) {
      console.error('[TenantService] getById error:', error);
      return null;
    }
  }

  static async update(id: number, updates: TenantUpdateInput): Promise<Tenant> {
    if (!db || env.RENDER_CLOUD_MODE) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase not configured');
      }
      try {
        const { getSupabaseClient } = require('../database/supabase.client');
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
          .from('tenants')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data as Tenant;
      } catch (err: any) {
        console.error('[TenantService] Supabase update failed:', err);
        throw new Error(err.message || 'Failed to update tenant via Supabase');
      }
    }

    try {
      return withOutboxTransaction(db, String(id), () => {
        const existing = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id) as Tenant | undefined;
        if (!existing) throw new Error('Tenant not found');

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
        values.push(id);

        db.prepare(`UPDATE tenants SET ${fields.join(', ')} WHERE id = ?`).run(...values);

        const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id) as Tenant;
        
        try {
          const syncService = getUserTenantSyncService();
          if (syncService) {
            syncService.queueTenantChange('update', updated);
          }
        } catch (syncErr) {
          console.warn('[TenantService] Failed to queue tenant update for sync:', syncErr);
        }

        return updated;
      });
    } catch (error: any) {
      console.error('[TenantService] update error:', error);
      throw error;
    }
  }
}

export default TenantService;
