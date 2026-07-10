import React, { useEffect, useState, useCallback } from 'react';
import { requestPlatform } from '../../lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Plan {
  id: number;
  code: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  period: 'monthly' | 'annual' | 'weekly' | 'trial';
  duration_days: number;
  max_users: number;
  max_branches: number;
  max_products: number;
  max_orders_per_month: number;
  features: string;
  is_active: number;
  is_public: number;
  trial_days: number;
  sort_order: number;
}

interface PlanFormData {
  code: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  period: string;
  duration_days: number;
  max_users: number;
  max_branches: number;
  max_products: number;
  max_orders_per_month: number;
  features: string;
  is_active: number;
  is_public: number;
  trial_days: number;
  sort_order: number;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "DM Sans", sans-serif',
    color: '#eeeef5', padding: '32px 24px 60px', maxWidth: 1400, margin: '0 auto'
  },
  card: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18, overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  },
  cardBody: { padding: 28 },
  input: {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.03)', color: '#eeeef5',
    fontSize: 13, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box' as const,
  },
  label: {
    fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'block'
  },
  btn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none',
    fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
    transition: 'all 0.2s', textDecoration: 'none'
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #D4AF37, #b8860b)', color: '#1a1306',
    boxShadow: '0 4px 16px rgba(212,175,55,0.25)'
  },
  btnDanger: {
    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#ef4444'
  },
};

const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PlanFormData>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Premium toast + confirmation (replaces native browser dialogs) ──
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  };

  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  function defaultForm(data?: Partial<PlanFormData>): PlanFormData {
    return {
      code: data?.code || '',
      name: data?.name || '',
      description: data?.description || '',
      price_cents: data?.price_cents ?? 0,
      currency: data?.currency || 'ZMW',
      period: data?.period || 'monthly',
      duration_days: data?.duration_days || 30,
      max_users: data?.max_users ?? 5,
      max_branches: data?.max_branches ?? 1,
      max_products: data?.max_products ?? 500,
      max_orders_per_month: data?.max_orders_per_month ?? 3000,
      features: data?.features || '{}',
      is_active: data?.is_active ?? 1,
      is_public: data?.is_public ?? 1,
      trial_days: data?.trial_days ?? 0,
      sort_order: data?.sort_order ?? 0,
    };
  }

  const loadPlans = useCallback(async () => {
    try {
      const data = await requestPlatform<any>('/platform/plans');
      if (data.success) setPlans(data.plans || []);
    } catch (e) {
      console.error('[PlansPage] Error loading:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const openCreate = () => {
    setForm(defaultForm());
    setEditing(false);
    setShowForm(true);
    setError('');
  };

  const openEdit = (plan: Plan) => {
    setForm(defaultForm({
      code: plan.code,
      name: plan.name,
      description: plan.description,
      price_cents: plan.price_cents,
      currency: plan.currency,
      period: plan.period,
      duration_days: plan.duration_days,
      max_users: plan.max_users,
      max_branches: plan.max_branches,
      max_products: plan.max_products,
      max_orders_per_month: plan.max_orders_per_month,
      features: plan.features,
      is_active: plan.is_active,
      is_public: plan.is_public,
      trial_days: plan.trial_days,
      sort_order: plan.sort_order,
    }));
    setEditing(true);
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      setError('Code et nom requis');
      return;
    }
    setSaving(true);
    setError('');

    try {
      if (editing) {
        await requestPlatform<any>(`/platform/plans/${(plans.find(p => p.code === form.code)?.id)}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      } else {
        await requestPlatform<any>('/platform/plans', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }
      await loadPlans();
      setShowForm(false);
      showToast('success', editing ? 'Plan modifié avec succès' : 'Plan créé avec succès');
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la sauvegarde');
      showToast('error', e.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (planId: number, planName: string) => {
    setConfirmDelete({ id: planId, name: planName });
  };

  const confirmDeletePlan = async () => {
    if (!confirmDelete) return;
    try {
      await requestPlatform<any>(`/platform/plans/${confirmDelete.id}`, { method: 'DELETE' });
      await loadPlans();
      showToast('success', `Plan « ${confirmDelete.name} » supprimé`);
    } catch (e: any) {
      showToast('error', e.message || 'Erreur lors de la suppression');
    } finally {
      setConfirmDelete(null);
    }
  };

  const getPlanColor = (code: string) => {
    const prefix = code.split('_')[0];
    const tierColors: Record<string, { primary: string; bg: string; border: string }> = {
      BASIC: { primary: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' },
      STANDARD: { primary: '#D4AF37', bg: 'rgba(212,175,55,0.12)', border: 'rgba(212,175,55,0.25)' },
      PREMIUM: { primary: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)' },
      TRIAL: { primary: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.25)' },
    };
    return tierColors[prefix] || { primary: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.25)' };
  };

  const formatAmount = (cents: number, currency = 'ZMW') =>
    `${currency} ${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const parseFeatures = (features: string) => {
    try { return JSON.parse(features); } catch { return {}; }
  };

  const periodLabel = (period: string) => {
    const map: Record<string, string> = { monthly: '/mois', annual: '/an', weekly: '/sem', trial: 'Essai' };
    return map[period] || `/${period}`;
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, ...S.root }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#D4AF37', animation: 'sp-spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={S.root}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 300, color: '#eeeef5', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Gestion des Plans
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            {plans.length} plan(s) configuré(s) • Gérez vos offres d'abonnement
          </p>
        </div>
        <button style={{ ...S.btn, ...S.btnPrimary }} onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nouveau Plan
        </button>
      </div>

      {/* Plan Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {plans.map((plan, i) => {
          const colors = getPlanColor(plan.code);
          const features = parseFeatures(plan.features);
          const featureEntries = Object.entries(features);
          const usagePercent = plan.max_orders_per_month > 0
            ? Math.min(100, Math.round((plan.max_orders_per_month / plan.max_orders_per_month) * 100))
            : 0;

          return (
            <div key={plan.id} style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
              backdropFilter: 'blur(16px)', border: `1px solid ${plan.is_active ? colors.border : 'rgba(255,255,255,0.04)'}`,
              borderRadius: 18, padding: '24px', position: 'relative', overflow: 'hidden',
              opacity: plan.is_active ? 1 : 0.5,
              transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            }}>
              {/* Accent */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${colors.primary}60, ${colors.primary}10)` }} />

              {/* Actions */}
              <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(plan)} style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
                 <button onClick={() => requestDelete(plan.id, plan.name)} style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.1)',
                  color: '#ef4444', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>

              {/* Status dot */}
              <div style={{
                position: 'absolute', top: 20, left: 20,
                width: 8, height: 8, borderRadius: '50%',
                background: plan.is_active ? '#10b981' : '#6b7280',
                boxShadow: plan.is_active ? '0 0 8px rgba(16,185,129,0.5)' : 'none',
              }} />

              <div style={{ paddingTop: 20 }}>
                <span style={{
                  display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  background: colors.bg, border: `1px solid ${colors.border}`, color: colors.primary, marginBottom: 10
                }}>
                  {plan.code}
                </span>

                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#eeeef5', margin: '0 0 4px' }}>{plan.name}</h3>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 16px', lineHeight: 1.5 }}>{plan.description}</p>

                {/* Pricing */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#eeeef5', letterSpacing: '-0.02em' }}>
                    {formatAmount(plan.price_cents, plan.currency)}
                    <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>{periodLabel(plan.period)}</span>
                  </div>
                </div>

                {/* Limits */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                  padding: '14px 16px', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, marginBottom: 16
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#eeeef5' }}>{plan.max_users}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Utilisateurs</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#eeeef5' }}>{plan.max_branches}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Branches</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#eeeef5' }}>{plan.max_products}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Produits</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#eeeef5' }}>{plan.max_orders_per_month || '∞'}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Commandes/mois</div>
                  </div>
                </div>

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {featureEntries.slice(0, 5).map(([key, val]: [string, any]) => {
                    const label: Record<string, string> = {
                      qr_menu: 'Menu QR', pos: 'Point de Vente', reports: 'Rapports',
                      inventory: 'Inventaire', multi_branch: 'Multi-succursales',
                      api_access: 'API', priority_support: 'Support prioritaire'
                    };
                    const display = typeof val === 'string' ? val : val ? 'Oui' : 'Non';
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        {label[key] || key}: {display}
                      </div>
                    );
                  })}
                </div>

                {/* Trial badge */}
                {plan.trial_days > 0 && (
                  <div style={{ marginTop: 12, padding: '6px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                    Essai gratuit de {plan.trial_days} jours
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {plans.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 16 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Aucun plan</div>
          <div style={{ fontSize: 13 }}>Créez votre premier plan d'abonnement</div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 24,
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30,30,35,0.98), rgba(20,20,25,0.98))',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18,
            padding: '32px 28px', maxWidth: 640, width: '100%',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eeeef5', margin: 0 }}>
                {editing ? 'Modifier le Plan' : 'Nouveau Plan'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 12.5, color: '#ef4444', fontWeight: 600, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Code */}
              <div>
                <label style={S.label}>Code</label>
                <input style={S.input} value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} placeholder="PRO_MONTHLY" disabled={editing} />
              </div>
              {/* Name */}
              <div>
                <label style={S.label}>Nom</label>
                <input style={S.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Pro Mensuel" />
              </div>
            </div>

            {/* Description */}
            <div style={{ marginTop: 16 }}>
              <label style={S.label}>Description</label>
              <textarea style={{ ...S.input, resize: 'vertical', minHeight: 60 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description du plan..." rows={2} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
              {/* Price */}
              <div>
                <label style={S.label}>Prix (cents)</label>
                <input style={S.input} type="number" value={form.price_cents} onChange={e => setForm({ ...form, price_cents: parseInt(e.target.value) || 0 })} placeholder="34900" />
              </div>
              {/* Currency */}
              <div>
                <label style={S.label}>Devise</label>
                <select style={S.input} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                  <option value="ZMW">ZMW</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              {/* Period */}
              <div>
                <label style={S.label}>Période</label>
                <select style={S.input} value={form.period} onChange={e => setForm({ ...form, period: e.target.value, duration_days: e.target.value === 'monthly' ? 30 : e.target.value === 'annual' ? 365 : e.target.value === 'weekly' ? 7 : 0 })}>
                  <option value="monthly">Mensuel</option>
                  <option value="annual">Annuel</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="trial">Essai</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginTop: 16 }}>
              <div>
                <label style={S.label}>Max Users</label>
                <input style={S.input} type="number" value={form.max_users} onChange={e => setForm({ ...form, max_users: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={S.label}>Branches</label>
                <input style={S.input} type="number" value={form.max_branches} onChange={e => setForm({ ...form, max_branches: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={S.label}>Produits</label>
                <input style={S.input} type="number" value={form.max_products} onChange={e => setForm({ ...form, max_products: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={S.label}>Cmd/mois</label>
                <input style={S.input} type="number" value={form.max_orders_per_month} onChange={e => setForm({ ...form, max_orders_per_month: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            {/* Features as JSON */}
            <div style={{ marginTop: 16 }}>
              <label style={S.label}>Features (JSON)</label>
              <textarea style={{ ...S.input, fontFamily: 'monospace', resize: 'vertical', minHeight: 100 }} value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} placeholder='{"qr_menu":true,"pos":true,"reports":"advanced","inventory":true}' rows={4} />
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Format JSON. Clés: qr_menu, pos, reports, inventory, multi_branch, api_access, priority_support</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
              <div>
                <label style={S.label}>Jours d'essai</label>
                <input style={S.input} type="number" value={form.trial_days} onChange={e => setForm({ ...form, trial_days: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={S.label}>Durée (jours)</label>
                <input style={S.input} type="number" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={S.label}>Ordre</label>
                <input style={S.input} type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            {/* Toggle switches */}
            <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#eeeef5', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active === 1} onChange={e => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })} />
                Actif
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#eeeef5', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_public === 1} onChange={e => setForm({ ...form, is_public: e.target.checked ? 1 : 0 })} />
                Public
              </label>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, padding: '12px 20px' }} onClick={handleSave} disabled={saving}>
                {saving ? '...' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>}
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
              <button style={{ ...S.btn, ...S.btnDanger, flex: 1, padding: '12px 20px' }} onClick={() => setShowForm(false)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Premium confirmation modal (replaces native window.confirm) ── */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100, padding: 24,
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30,30,35,0.98), rgba(20,20,25,0.98))',
            border: '1px solid rgba(239,68,68,0.25)', borderRadius: 18,
            padding: '28px 28px 24px', maxWidth: 420, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#eeeef5', margin: 0 }}>Supprimer le plan</h2>
            </div>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: '0 0 24px' }}>
              Êtes-vous sûr de vouloir supprimer le plan <strong style={{ color: '#eeeef5' }}>« {confirmDelete.name} »</strong> ? Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ ...S.btn, flex: 1, padding: '12px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#eeeef5' }}
              >
                Annuler
              </button>
              <button
                onClick={confirmDeletePlan}
                style={{ ...S.btn, ...S.btnDanger, flex: 1, padding: '12px 20px' }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Premium toast (replaces native browser alerts) ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
          display: 'flex', alignItems: 'center', gap: 12,
          minWidth: 300, maxWidth: 400, padding: '14px 16px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(30,30,35,0.98), rgba(20,20,25,0.98))',
          border: `1px solid ${toast.type === 'success' ? 'rgba(212,175,55,0.35)' : toast.type === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.12)'}`,
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          color: '#eeeef5', fontSize: 13.5, fontWeight: 500,
          animation: 'plans-toast-in 0.35s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: toast.type === 'success' ? 'rgba(212,175,55,0.15)' : toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(96,165,250,0.15)',
            color: toast.type === 'success' ? '#D4AF37' : toast.type === 'error' ? '#ef4444' : '#60a5fa',
          }}>
            {toast.type === 'success'
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              : toast.type === 'error'
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>}
          </div>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2, display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      <style>{`
        @keyframes sp-spin { to { transform: rotate(360deg); } }
        @keyframes plans-toast-in {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default PlansPage;