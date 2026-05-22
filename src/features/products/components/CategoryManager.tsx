import React, { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, AlertTriangle } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { useAuthStore } from '../../../stores/useAuthStore';
import { EnterpriseTokens } from '../../../lib/design-system';

const { colors, radius } = EnterpriseTokens;

interface Category {
  id: number;
  name: string;
  description?: string;
  product_count?: number;
}

interface CategoryManagerProps {
  categories: Category[];
  onChanged: () => void;
}

type EditState = { id: number; name: string } | null;

export const CategoryManager: React.FC<CategoryManagerProps> = ({ categories, onChanged }) => {
  const { user } = useAuthStore();
  const role = user?.role || '';
  const isAdminOrManager = ['admin', 'manager'].includes(role);

  const [showAdd, setShowAdd]     = useState(false);
  const [editing, setEditing]     = useState<EditState>(null);
  const [draft, setDraft]         = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState<string | null>(null);

  const refresh = useCallback(async () => { await onChanged(); }, [onChanged]);

  const doCreate = async () => {
    if (!draft.trim()) return;
    setBusy(true); setErr(null);
    try {
      await api.categories.create({ name: draft.trim(), description: draftDesc.trim() || undefined }, role);
      setDraft(''); setDraftDesc(''); setShowAdd(false);
      await refresh();
    } catch (e: any) {
      setErr(e.message || 'Erreur lors de la création');
    } finally { setBusy(false); }
  };

  const doUpdate = async (id: number) => {
    if (!draft.trim()) return;
    setBusy(true); setErr(null);
    try {
      await api.categories.update(id, {
        name: draft.trim(),
        description: draftDesc.trim() || null,
      }, role);
      setEditing(null); setDraft(''); setDraftDesc('');
      await refresh();
    } catch (e: any) {
      setErr(e.message || 'Erreur lors de la mise à jour');
    } finally { setBusy(false); }
  };

  const doDelete = async (id: number) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    if (!window.confirm(`Supprimer la catégorie "${cat.name}" ?\nLes produits qu'elle contient seront déplacés vers une autre catégorie.`)) return;
    setBusy(true); setErr(null);
    try {
      await api.categories.delete(id, role);
      await refresh();
    } catch (e: any) {
      setErr(e.message || 'Erreur lors de la suppression');
    } finally { setBusy(false); }
  };

  const startEdit = (cat: Category) => {
    setEditing({ id: cat.id, name: cat.name });
    setDraft(cat.name);
    setDraftDesc(cat.description || '');
    setErr(null);
  };

  const cancelEdit = () => { setEditing(null); setDraft(''); setDraftDesc(''); setErr(null); };
  const cancelAdd  = () => { setShowAdd(false); setDraft(''); setDraftDesc(''); setErr(null); };

  return (
    <div style={{
      background: colors.card, border: `1px solid ${colors.border}`,
      borderRadius: radius.lg, overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '16px 20px', borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: colors.surface,
      }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: colors.text2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Catégories ({categories.length})
        </span>
        {isAdminOrManager && !showAdd && !editing && (
          <button
            onClick={() => { setShowAdd(true); setDraft(''); setDraftDesc(''); setErr(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: radius.sm,
              background: colors.accent.blue + '18',
              border: `1px solid ${colors.accent.blue}44`,
              color: colors.accent.blue, fontSize: '11px', fontWeight: 800,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <Plus size={13} /> NOUVELLE
          </button>
        )}
      </div>

      {/* Add new category inline */}
      {showAdd && (
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${colors.border}`,
          display: 'flex', flexDirection: 'column', gap: '10px',
          background: 'rgba(59,130,246,0.02)',
        }}>
          {err && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', borderRadius: radius.sm,
              background: colors.accent.redDim, border: `1px solid ${colors.accent.red}44`,
              color: colors.accent.red, fontSize: '11px', fontWeight: 700,
            }}>
              <AlertTriangle size={13} /> {err}
            </div>
          )}
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Nom de la catégorie (ex: Boissons)"
            onKeyDown={e => { if (e.key === 'Enter') doCreate(); if (e.key === 'Escape') cancelAdd(); }}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: radius.sm,
              background: colors.surface, border: `1px solid ${colors.border}`,
              color: colors.text1, fontSize: '13px', outline: 'none',
            }}
            onFocus={e => e.currentTarget.style.borderColor = colors.accent.blue}
            onBlur={e => e.currentTarget.style.borderColor = colors.border}
          />
          <input
            value={draftDesc}
            onChange={e => setDraftDesc(e.target.value)}
            placeholder="Description (optionnelle)"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: radius.sm,
              background: colors.surface, border: `1px solid ${colors.border}`,
              color: colors.text1, fontSize: '12px', outline: 'none',
            }}
            onFocus={e => e.currentTarget.style.borderColor = colors.accent.blue}
            onBlur={e => e.currentTarget.style.borderColor = colors.border}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={cancelAdd} style={{ padding: '8px 16px', borderRadius: radius.sm, background: 'transparent', border: `1px solid ${colors.border}`, color: colors.text2, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
            <button onClick={doCreate} disabled={busy || !draft.trim()} style={{ padding: '8px 20px', borderRadius: radius.sm, background: colors.accent.blue, border: 'none', color: '#fff', fontSize: '11px', fontWeight: 900, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.65 : 1 }}>
              {busy ? 'CRÉATION…' : 'CRÉER'}
            </button>
          </div>
        </div>
      )}

      {/* Category list */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {categories.map(cat => {
          const isEditingThis = editing?.id === cat.id;
          const count = cat.product_count ?? 0;

          return (
            <div key={cat.id} style={{
              display: 'flex', alignItems: 'center',
              padding: '11px 20px',
              borderBottom: `1px solid ${colors.border}`,
              gap: '12px',
              transition: 'background 0.15s',
              background: isEditingThis ? 'rgba(59,130,246,0.04)' : 'transparent',
            }}>
              {isEditingThis ? (
                /* ── Edit inline ── */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {err && (
                    <div style={{ color: colors.accent.red, fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <AlertTriangle size={12} /> {err}
                    </div>
                  )}
                  <input
                    autoFocus
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') doUpdate(cat.id); if (e.key === 'Escape') cancelEdit(); }}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: radius.sm,
                      background: colors.surface, border: `1px solid ${colors.accent.blue}`,
                      color: colors.text1, fontSize: '13px', outline: 'none',
                    }}
                  />
                  <input
                    value={draftDesc}
                    onChange={e => setDraftDesc(e.target.value)}
                    placeholder="Description (optionnelle)"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: radius.sm,
                      background: colors.surface, border: `1px solid ${colors.border}`,
                      color: colors.text1, fontSize: '12px', outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button onClick={cancelEdit} style={{ padding: '5px 12px', borderRadius: radius.sm, background: 'transparent', border: `1px solid ${colors.border}`, color: colors.text2, fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
                    <button onClick={() => doUpdate(cat.id)} disabled={busy || !draft.trim()} style={{ padding: '5px 14px', borderRadius: radius.sm, background: colors.accent.blue, border: 'none', color: '#fff', fontSize: '10px', fontWeight: 900, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.65 : 1 }}>
                      {busy ? '…' : <><Check size={11} style={{ display: 'inline', marginRight: '3px' }} /> OK</>}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cat.name}
                    </div>
                    {cat.description && (
                      <div style={{ fontSize: '11px', color: colors.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                        {cat.description}
                      </div>
                    )}
                  </div>

                  <div style={{
                    fontSize: '10px', fontWeight: 800, color: colors.text3,
                    background: colors.surface, border: `1px solid ${colors.border}`,
                    borderRadius: '6px', padding: '2px 8px', whiteSpace: 'nowrap',
                  }}>
                    {count} produit{count !== 1 ? 's' : ''}
                  </div>

                  {isAdminOrManager && (
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button
                        onClick={() => startEdit(cat)}
                        style={{
                          width: '28px', height: '28px', borderRadius: radius.sm,
                          background: 'transparent', border: `1px solid ${colors.border}`,
                          color: colors.text3, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        title="Renommer"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => doDelete(cat.id)}
                        disabled={busy}
                        style={{
                          width: '28px', height: '28px', borderRadius: radius.sm,
                          background: 'transparent', border: `1px solid ${colors.accent.red}44`,
                          color: colors.accent.red, cursor: busy ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: busy ? 0.5 : 1,
                        }}
                        title="Supprimer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {categories.length === 0 && !showAdd && (
        <div style={{ padding: '36px 20px', textAlign: 'center', color: colors.text3 }}>
          <p style={{ fontSize: '12px', fontWeight: 700 }}>Aucune catégorie</p>
          <p style={{ fontSize: '11px', marginTop: '4px' }}>Créez-en une pour classer vos produits.</p>
        </div>
      )}
    </div>
  );
};
