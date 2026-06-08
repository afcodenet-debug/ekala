// =============================================================================
// Phase 3 — Invoice Service
// =============================================================================
// Génère des factures avec numéro unique (INV-YYYY-NNNNN).
// Sauvegarde dans la table `invoices`.
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env';
import { SaaSError } from '../types/saas.types';

let _supabase: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!_supabase) {
    _supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }
  return _supabase;
}

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `INV-${year}-${rand}`;
}

export interface InvoiceInput {
  tenant_id: number;
  payment_id?: number | null;
  subscription_id?: number | null;
  amount_cents: number;
  currency: string;
  notes?: string | null;
  metadata?: Record<string, any>;
}

export interface InvoiceRecord {
  id: number;
  tenant_id: number;
  payment_id: number | null;
  subscription_id: number | null;
  invoice_number: string;
  amount_cents: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export class InvoiceService {
  /** Crée une facture après un paiement réussi. */
  static async create(input: InvoiceInput): Promise<InvoiceRecord | null> {
    const supabase = db();
    if (!supabase) {
      console.warn('[InvoiceService] Supabase not configured — invoice not persisted');
      return null;
    }
    const invoice_number = generateInvoiceNumber();
    const issued_at = new Date().toISOString();
    const { data, error } = await supabase.from('invoices').insert([{
      tenant_id: input.tenant_id,
      payment_id: input.payment_id ?? null,
      subscription_id: input.subscription_id ?? null,
      invoice_number,
      amount_cents: input.amount_cents,
      currency: input.currency,
      status: 'paid',
      issued_at,
      paid_at: issued_at,
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
    }]).select().single();
    if (error) {
      throw new SaaSError(`Failed to create invoice: ${error.message}`, 500, 'INVOICE_CREATE_FAILED');
    }
    return data as InvoiceRecord;
  }

  /** Liste les factures d'un tenant. */
  static async listForTenant(tenantId: number, limit = 50): Promise<InvoiceRecord[]> {
    const supabase = db();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('issued_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data || []) as InvoiceRecord[];
  }
}