import React, { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Check, AlertTriangle, X, Tag
} from 'lucide-react';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/useAuthStore';
import { useI18n } from '../lib/i18n';
import { EnterpriseTokens } from '../lib/design-system';
import { ConfirmDialog } from '../components/ConfirmDialog';

const { colors, radius, shadows } = EnterpriseTokens;

interface Category {
  id: number;
  name: string;
  description?: string;
  product_count?: number;
  created_at?: string;
}

export const CategoriesPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const role = user?.role || '';
  const isAdminOrManager = ['owner', 'admin', 'manager'].includes(role);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<{ id: number; name: string; description?: string } | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
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

  useEffect(() => {
    fetchCategories();
  }, []);

  const resetForm = () => {
    setDraftName('');
    setDraftDesc('');
    setEditing(null);
    setShowAdd(false);
    setError('');
  };

  const handleCreate = async () => {
    if (!draftName.trim()) {
      setError(t('categories.nameRequired') || 'Name is required');
      return;
    }
    setError('');
    try {
      await api.categories.create({ name: draftName.trim(), description: draftDesc.trim() || undefined }, role);
      setSuccess(t('categories.createdSuccess') || 'Category created');
      resetForm();
      fetchCategories();
      setTimeout(() => setSuccess(''), 2500);
    } catch (e: any) {
      setError(e.message || 'Failed to create');
    }
  };

  const handleUpdate = async () => {
    if (!editing || !draftName.trim()) return;
    setError('');
    try {
      await api.categories.update(editing.id, {
        name: draftName.trim(),
        description: draftDesc.trim() || null
      }, role);
      setSuccess(t('categories.updatedSuccess') || 'Category updated');
      resetForm();
      fetchCategories();
      setTimeout(() => setSuccess(''), 2500);
    } catch (e: any) {
      setError(e.message || 'Failed to update');
    }
  };

  const handleDeleteClick = async (cat: Category) => {
    setDeleteTarget(cat);
  };

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
    } catch (e: any) {
      setError(e.message || 'Cannot delete this category');
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (cat: Category) => {
    setEditing({ id: cat.id, name: cat.name, description: cat.description });
    setDraftName(cat.name);
    setDraftDesc(cat.description || '');
    setShowAdd(true);
    setError('');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${colors.border}`, borderTopColor: colors.accent.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1100, margin: '0 auto' }} className="animate-fade">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Tag size={20} color={colors.accent.gold} />
            <span style={{ fontSize: 12, fontWeight: 800, color: colors.accent.gold, letterSpacing: '0.08em' }}>
              {t('categories.management') || 'CATEGORY MANAGEMENT'}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: colors.text1 }}>
            {t('categories.title') || 'Categories'}
          </h1>
          <p style={{ margin: '6px 0 0', color: colors.text3, fontSize: 14 }}>
            {t('categories.subtitle') || 'Organize your products into meaningful groups'}
          </p>
        </div>

        {isAdminOrManager && (
          <button
            onClick={() => { setShowAdd(true); setEditing(null); setDraftName(''); setDraftDesc(''); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 22px', borderRadius: radius.md,
              background: colors.accent.blue, border: 'none',
              color: colors.bg, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(59,130,246,0.25)'
            }}
          >
            <Plus size={18} /> {t('categories.create') || 'New Category'}
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div style={{ background: colors.accent.redDim, border: `1px solid ${colors.accent.red}40`, color: colors.accent.red, padding: '12px 18px', borderRadius: radius.md, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {success && (
        <div style={{ background: colors.accent.greenDim, border: `1px solid ${colors.accent.green}40`, color: colors.accent.green, padding: '12px 18px', borderRadius: radius.md, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Check size={16} /> {success}
        </div>
      )}

      {/* Add/Edit Form */}
      {showAdd && isAdminOrManager && (
        <div style={{
          background: colors.card, border: `1px solid ${colors.borderHi}`,
          borderRadius: radius.xl, padding: '28px', marginBottom: 28,
          boxShadow: shadows.hard
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: colors.text1 }}>
              {editing ? (t('categories.renameCategory') || 'Rename Category') : (t('categories.createCategory') || 'Create New Category')}
            </h3>
            <button onClick={resetForm} style={{ background: 'transparent', border: 'none', color: colors.text3, cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: colors.text3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t('categories.name') || 'Category Name'} *
              </label>
              <input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder="e.g. Beers, Cocktails, Food"
                style={{
                  width: '100%', marginTop: 8, padding: '12px 16px',
                  background: colors.surface, border: `1px solid ${colors.border}`,
                  borderRadius: radius.md, color: colors.text1, fontSize: 15
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: colors.text3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t('categories.description') || 'Description (optional)'}
              </label>
              <textarea
                value={draftDesc}
                onChange={e => setDraftDesc(e.target.value)}
                placeholder="Short description of this category"
                rows={2}
                style={{
                  width: '100%', marginTop: 8, padding: '12px 16px',
                  background: colors.surface, border: `1px solid ${colors.border}`,
                  borderRadius: radius.md, color: colors.text1, fontSize: 14, resize: 'vertical'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={resetForm} style={{
              flex: 1, padding: '13px', borderRadius: radius.md,
              background: 'transparent', border: `1px solid ${colors.border}`,
              color: colors.text2, fontWeight: 700, cursor: 'pointer'
            }}>
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              onClick={editing ? handleUpdate : handleCreate}
              disabled={!draftName.trim()}
              style={{
                flex: 1, padding: '13px', borderRadius: radius.md,
                background: draftName.trim() ? colors.accent.gold : colors.surface,
                border: 'none', color: draftName.trim() ? colors.bg : colors.text3,
                fontWeight: 800, cursor: draftName.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              {editing ? (t('categories.update') || 'UPDATE') : (t('categories.create') || 'CREATE')}
            </button>
          </div>
        </div>
      )}

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <div style={{
          background: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: radius.xl, padding: '60px 24px', textAlign: 'center'
        }}>
          <Tag size={48} color={colors.text3} style={{ marginBottom: 16 }} />
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: colors.text1 }}>
            {t('categories.noCategories') || 'No categories yet'}
          </h3>
          <p style={{ color: colors.text3, marginTop: 8 }}>
            {t('categories.createFirst') || 'Create your first category to start organizing products.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {categories.map(cat => (
            <div key={cat.id} style={{
              background: colors.card, border: `1px solid ${colors.border}`,
              borderRadius: radius.xl, padding: '22px', position: 'relative',
              transition: 'all 0.2s'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: colors.text1, marginBottom: 4 }}>
                    {cat.name}
                  </div>
                  {cat.description && (
                    <div style={{ fontSize: 13, color: colors.text3, lineHeight: 1.5 }}>
                      {cat.description}
                    </div>
                  )}
                </div>

                {isAdminOrManager && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => startEdit(cat)}
                      style={{ width: 34, height: 34, borderRadius: radius.sm, background: colors.surface, border: `1px solid ${colors.border}`, color: colors.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(cat)}
                      disabled={deletingId === cat.id}
                      style={{ width: 34, height: 34, borderRadius: radius.sm, background: colors.accent.redDim, border: `1px solid ${colors.accent.red}30`, color: colors.accent.red, cursor: deletingId === cat.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: deletingId === cat.id ? 0.5 : 1 }}
                    >
                      {deletingId === cat.id ? '...' : <Trash2 size={15} />}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  background: colors.accent.blue + '15', color: colors.accent.blue,
                  fontSize: 12, fontWeight: 800, padding: '2px 10px', borderRadius: 999
                }}>
                  {cat.product_count ?? 0} {t('categories.products') || 'products'}
                </div>
                {cat.created_at && (
                  <div style={{ fontSize: 11, color: colors.text3 }}>
                    {new Date(cat.created_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Premium Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t('categories.deleteTitle') || 'Delete category'}
        message={
          t('categories.deleteConfirm', { name: deleteTarget?.name || '' }) ||
          `Delete "${deleteTarget?.name}"? Products will be moved to another category.`
        }
        confirmLabel={t('categories.delete') || 'Delete'}
        loading={deletingId !== null}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default CategoriesPage;
