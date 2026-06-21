import React, { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Check, AlertTriangle, X, Tag, Layers
} from 'lucide-react';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/useAuthStore';
import { useI18n } from '../lib/i18n';
import { ConfirmDialog } from '../components/ConfirmDialog';

// ─── Inject styles once ───────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('cat-styles')) {
  const style = document.createElement('style');
  style.id = 'cat-styles';
  style.textContent = `
    @keyframes cat-fade-up {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes cat-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes cat-form-in {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .cat-page {
      padding: 40px 36px;
      max-width: 1100px;
      margin: 0 auto;
      animation: cat-fade-up 300ms cubic-bezier(0.16,1,0.3,1) both;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    }

    /* ── Header ── */
    .cat-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 36px;
      gap: 20px;
    }
    .cat-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 4px 10px 4px 8px;
      border-radius: 999px;
      background: rgba(245,158,11,0.09);
      border: 1px solid rgba(245,158,11,0.2);
      font-size: 10.5px;
      font-weight: 700;
      color: #f59e0b;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .cat-title {
      margin: 0 0 6px;
      font-size: 28px;
      font-weight: 800;
      color: #e8e8f2;
      letter-spacing: -0.03em;
      line-height: 1.1;
    }
    .cat-subtitle {
      margin: 0;
      font-size: 13.5px;
      color: #44445a;
      font-weight: 400;
      line-height: 1.5;
    }

    /* ── Add button ── */
    .cat-btn-add {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 11px 20px;
      border-radius: 10px;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      border: none;
      color: #fff;
      font-size: 13.5px;
      font-weight: 700;
      letter-spacing: -0.01em;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      box-shadow: 0 8px 24px rgba(59,130,246,0.28), 0 2px 6px rgba(59,130,246,0.18);
      transition: filter 140ms, transform 140ms, box-shadow 140ms;
    }
    .cat-btn-add:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
      box-shadow: 0 12px 28px rgba(59,130,246,0.35), 0 2px 8px rgba(59,130,246,0.2);
    }
    .cat-btn-add:active { transform: translateY(0); filter: brightness(0.97); }

    /* ── Toast messages ── */
    .cat-toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 20px;
      animation: cat-fade-up 200ms ease both;
    }
    .cat-toast-error {
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.2);
      color: #ef4444;
    }
    .cat-toast-success {
      background: rgba(34,197,94,0.08);
      border: 1px solid rgba(34,197,94,0.2);
      color: #22c55e;
    }

    /* ── Form panel ── */
    .cat-form-panel {
      background: #0f0f18;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 14px;
      margin-bottom: 28px;
      overflow: hidden;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 20px 50px rgba(0,0,0,0.4);
      animation: cat-form-in 220ms cubic-bezier(0.16,1,0.3,1) both;
    }
    .cat-form-strip {
      height: 3px;
      background: linear-gradient(90deg, transparent, #f59e0b 40%, #f59e0b88 100%);
    }
    .cat-form-inner { padding: 24px 26px 26px; }
    .cat-form-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 22px;
    }
    .cat-form-title {
      margin: 0;
      font-size: 15px;
      font-weight: 720;
      color: #e8e8f2;
      letter-spacing: -0.02em;
    }
    .cat-form-close {
      width: 28px; height: 28px;
      border-radius: 7px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      color: #3a3a52;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 140ms, color 140ms;
    }
    .cat-form-close:hover { background: rgba(255,255,255,0.09); color: #7a7a9a; }

    /* Inputs */
    .cat-label {
      display: block;
      font-size: 10.5px;
      font-weight: 700;
      color: #3a3a58;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .cat-input, .cat-textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 11px 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 9px;
      color: #e8e8f2;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      transition: border-color 150ms, box-shadow 150ms;
    }
    .cat-input::placeholder, .cat-textarea::placeholder { color: #2e2e48; }
    .cat-input:focus, .cat-textarea:focus {
      border-color: rgba(245,158,11,0.4);
      box-shadow: 0 0 0 3px rgba(245,158,11,0.07);
    }
    .cat-textarea { resize: vertical; min-height: 72px; }
    .cat-form-grid { display: grid; gap: 16px; }

    /* Form actions */
    .cat-form-actions { display: flex; gap: 10px; margin-top: 22px; }
    .cat-btn-cancel {
      flex: 1; padding: 11px;
      border-radius: 9px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      color: #4a4a6a;
      font-size: 13.5px; font-weight: 650; font-family: inherit;
      cursor: pointer;
      transition: background 140ms, color 140ms;
    }
    .cat-btn-cancel:hover { background: rgba(255,255,255,0.07); color: #8080a0; }
    .cat-btn-submit {
      flex: 1; padding: 11px;
      border-radius: 9px;
      border: none;
      font-size: 13.5px; font-weight: 700; font-family: inherit;
      letter-spacing: 0.01em;
      cursor: pointer;
      transition: filter 140ms, transform 140ms, opacity 140ms;
    }
    .cat-btn-submit:not(:disabled) {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #0d0d14;
      box-shadow: 0 6px 20px rgba(245,158,11,0.28);
    }
    .cat-btn-submit:not(:disabled):hover { filter: brightness(1.08); transform: translateY(-1px); }
    .cat-btn-submit:disabled {
      background: rgba(255,255,255,0.05);
      color: #2e2e48;
      cursor: not-allowed;
    }

    /* ── Grid ── */
    .cat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
      gap: 14px;
    }

    /* ── Category card ── */
    .cat-card {
      background: #0f0f18;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 20px;
      position: relative;
      overflow: hidden;
      transition: border-color 180ms, box-shadow 180ms, transform 180ms;
      cursor: default;
    }
    .cat-card:hover {
      border-color: rgba(255,255,255,0.11);
      box-shadow: 0 16px 40px rgba(0,0,0,0.35);
      transform: translateY(-2px);
    }
    /* Subtle top gradient on hover via pseudo would require JS — use static soft gradient */
    .cat-card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }
    .cat-card-icon {
      width: 36px; height: 36px;
      border-radius: 9px;
      background: rgba(245,158,11,0.09);
      border: 1px solid rgba(245,158,11,0.18);
      color: #f59e0b;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .cat-card-name {
      font-size: 15.5px;
      font-weight: 720;
      color: #e0e0f0;
      letter-spacing: -0.02em;
      line-height: 1.25;
      margin-bottom: 4px;
    }
    .cat-card-desc {
      font-size: 12.5px;
      color: #3e3e58;
      line-height: 1.6;
    }
    .cat-card-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }
    .cat-card-btn {
      width: 32px; height: 32px;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: background 140ms, color 140ms, border-color 140ms;
      flex-shrink: 0;
    }
    .cat-card-btn-edit {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      color: #4a4a68;
    }
    .cat-card-btn-edit:hover { background: rgba(255,255,255,0.09); color: #9090b0; border-color: rgba(255,255,255,0.12); }
    .cat-card-btn-delete {
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.18);
      color: #ef4444;
    }
    .cat-card-btn-delete:hover { background: rgba(239,68,68,0.16); }
    .cat-card-btn-delete:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Divider */
    .cat-card-divider {
      height: 1px;
      background: rgba(255,255,255,0.05);
      margin-bottom: 14px;
    }

    /* Footer meta */
    .cat-card-meta {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cat-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: rgba(59,130,246,0.1);
      border: 1px solid rgba(59,130,246,0.2);
      color: #3b82f6;
      letter-spacing: 0.01em;
    }
    .cat-date {
      font-size: 10.5px;
      color: #28283c;
      font-weight: 500;
    }

    /* ── Empty state ── */
    .cat-empty {
      background: #0f0f18;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 70px 32px;
      text-align: center;
    }
    .cat-empty-icon {
      width: 60px; height: 60px;
      border-radius: 16px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 18px;
      color: #28283c;
    }
    .cat-empty-title {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 720;
      color: #2a2a40;
      letter-spacing: -0.02em;
    }
    .cat-empty-sub {
      margin: 0;
      font-size: 13px;
      color: #20202e;
      line-height: 1.6;
    }

    /* ── Loader ── */
    .cat-loader {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 60vh;
    }
    .cat-spinner {
      width: 36px; height: 36px;
      border-radius: 50%;
      border: 2.5px solid rgba(255,255,255,0.06);
      border-top-color: #f59e0b;
      animation: cat-spin 0.8s linear infinite;
    }
  `;
  document.head.appendChild(style);
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Category {
  id: number;
  name: string;
  description?: string;
  product_count?: number;
  created_at?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const CategoriesPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const role = user?.role || '';
  const isAdminOrManager = ['owner', 'admin', 'manager'].includes(role);

  const [categories, setCategories]   = useState<Category[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showAdd, setShowAdd]         = useState(false);
  const [editing, setEditing]         = useState<{ id: number; name: string; description?: string } | null>(null);
  const [draftName, setDraftName]     = useState('');
  const [draftDesc, setDraftDesc]     = useState('');
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [deletingId, setDeletingId]   = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const fetchCategories = async () => {
    try {
      const data = await api.categories.getAll(role);
      setCategories(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const resetForm = () => {
    setDraftName(''); setDraftDesc('');
    setEditing(null); setShowAdd(false); setError('');
  };

  const handleCreate = async () => {
    if (!draftName.trim()) { setError(t('categories.nameRequired') || 'Name is required'); return; }
    setError('');
    try {
      await api.categories.create({ name: draftName.trim(), description: draftDesc.trim() || undefined }, role);
      setSuccess(t('categories.createdSuccess') || 'Category created');
      resetForm(); fetchCategories();
      setTimeout(() => setSuccess(''), 2500);
    } catch (e: any) { setError(e.message || 'Failed to create'); }
  };

  const handleUpdate = async () => {
    if (!editing || !draftName.trim()) return;
    setError('');
    try {
      await api.categories.update(editing.id, { name: draftName.trim(), description: draftDesc.trim() || null }, role);
      setSuccess(t('categories.updatedSuccess') || 'Category updated');
      resetForm(); fetchCategories();
      setTimeout(() => setSuccess(''), 2500);
    } catch (e: any) { setError(e.message || 'Failed to update'); }
  };

  const handleDeleteClick = (cat: Category) => setDeleteTarget(cat);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const cat = deleteTarget;
    setDeleteTarget(null);
    setDeletingId(cat.id);
    try {
      await api.categories.delete(cat.id, role);
      setSuccess(t('categories.deletedSuccess') || 'Category deleted');
      fetchCategories();
      setTimeout(() => setSuccess(''), 2500);
    } catch (e: any) { setError(e.message || 'Cannot delete this category'); }
    finally { setDeletingId(null); }
  };

  const startEdit = (cat: Category) => {
    setEditing({ id: cat.id, name: cat.name, description: cat.description });
    setDraftName(cat.name);
    setDraftDesc(cat.description || '');
    setShowAdd(true);
    setError('');
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="cat-loader">
        <div className="cat-spinner" />
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="cat-page">

      {/* ── Header ── */}
      <div className="cat-header">
        <div>
          <div className="cat-eyebrow">
            <Tag size={11} />
            {t('categories.management') || 'Gestion des catégories'}
          </div>
          <h1 className="cat-title">{t('categories.title') || 'Catégories'}</h1>
          <p className="cat-subtitle">
            {t('categories.subtitle') || 'Organisez vos produits en groupes cohérents'}
          </p>
        </div>

        {isAdminOrManager && (
          <button
            className="cat-btn-add"
            onClick={() => { setShowAdd(true); setEditing(null); setDraftName(''); setDraftDesc(''); }}
          >
            <Plus size={16} strokeWidth={2.5} />
            {t('categories.create') || 'Nouvelle catégorie'}
          </button>
        )}
      </div>

      {/* ── Toasts ── */}
      {error && (
        <div className="cat-toast cat-toast-error">
          <AlertTriangle size={15} strokeWidth={2.2} />
          {error}
        </div>
      )}
      {success && (
        <div className="cat-toast cat-toast-success">
          <Check size={15} strokeWidth={2.5} />
          {success}
        </div>
      )}

      {/* ── Form panel ── */}
      {showAdd && isAdminOrManager && (
        <div className="cat-form-panel">
          <div className="cat-form-strip" />
          <div className="cat-form-inner">
            <div className="cat-form-header">
              <h3 className="cat-form-title">
                {editing
                  ? (t('categories.renameCategory') || 'Renommer la catégorie')
                  : (t('categories.createCategory') || 'Créer une catégorie')}
              </h3>
              <button className="cat-form-close" onClick={resetForm} aria-label="Fermer">
                <X size={13} strokeWidth={2.5} />
              </button>
            </div>

            <div className="cat-form-grid">
              <div>
                <label className="cat-label">
                  {t('categories.name') || 'Nom de la catégorie'} *
                </label>
                <input
                  className="cat-input"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  placeholder="ex : Bières, Cocktails, Plats…"
                  autoFocus
                />
              </div>
              <div>
                <label className="cat-label">
                  {t('categories.description') || 'Description (facultatif)'}
                </label>
                <textarea
                  className="cat-textarea"
                  value={draftDesc}
                  onChange={e => setDraftDesc(e.target.value)}
                  placeholder="Courte description de cette catégorie"
                  rows={2}
                />
              </div>
            </div>

            <div className="cat-form-actions">
              <button className="cat-btn-cancel" onClick={resetForm}>
                {t('common.cancel') || 'Annuler'}
              </button>
              <button
                className="cat-btn-submit"
                onClick={editing ? handleUpdate : handleCreate}
                disabled={!draftName.trim()}
              >
                {editing
                  ? (t('categories.update') || 'Mettre à jour')
                  : (t('categories.create') || 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {categories.length === 0 ? (
        <div className="cat-empty">
          <div className="cat-empty-icon">
            <Layers size={26} />
          </div>
          <h3 className="cat-empty-title">
            {t('categories.noCategories') || 'Aucune catégorie'}
          </h3>
          <p className="cat-empty-sub">
            {t('categories.createFirst') || 'Créez votre première catégorie pour commencer à organiser vos produits.'}
          </p>
        </div>
      ) : (
        /* ── Grid ── */
        <div className="cat-grid">
          {categories.map((cat, i) => (
            <div
              key={cat.id}
              className="cat-card"
              style={{ animationDelay: `${i * 35}ms`, animation: 'cat-fade-up 280ms cubic-bezier(0.16,1,0.3,1) both' }}
            >
              {/* Top row */}
              <div className="cat-card-top">
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                  <div className="cat-card-icon">
                    <Tag size={15} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="cat-card-name">{cat.name}</div>
                    {cat.description && (
                      <div className="cat-card-desc">{cat.description}</div>
                    )}
                  </div>
                </div>

                {isAdminOrManager && (
                  <div className="cat-card-actions">
                    <button
                      className="cat-card-btn cat-card-btn-edit"
                      onClick={() => startEdit(cat)}
                      title="Modifier"
                    >
                      <Pencil size={13} strokeWidth={2.2} />
                    </button>
                    <button
                      className="cat-card-btn cat-card-btn-delete"
                      onClick={() => handleDeleteClick(cat)}
                      disabled={deletingId === cat.id}
                      title="Supprimer"
                    >
                      {deletingId === cat.id
                        ? <span style={{ fontSize: 11, fontWeight: 700 }}>…</span>
                        : <Trash2 size={13} strokeWidth={2.2} />
                      }
                    </button>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="cat-card-divider" />

              {/* Meta footer */}
              <div className="cat-card-meta">
                <div className="cat-badge">
                  <Layers size={10} strokeWidth={2.5} />
                  {cat.product_count ?? 0} {t('categories.products') || 'produits'}
                </div>
                {cat.created_at && (
                  <span className="cat-date">
                    {new Date(cat.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t('categories.deleteTitle') || 'Supprimer la catégorie'}
        message={
          t('categories.deleteConfirm', { name: deleteTarget?.name || '' }) ||
          `Supprimer "${deleteTarget?.name}" ? Les produits associés seront déplacés.`
        }
        confirmLabel={t('categories.delete') || 'Supprimer'}
        loading={deletingId !== null}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default CategoriesPage;