import React, { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, AlertTriangle } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useI18n } from '../../../lib/i18n';
import { EnterpriseTokens } from '../../../lib/design-system';
import { useBreakpoint } from '../../../lib/hooks/useBreakpoint';
import { spacing, touchTargets } from '../../../lib/design-system/responsive';

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
  const { t } = useI18n();
  const { user } = useAuthStore();
  const role = user?.role || '';
  const isAdminOrManager = ['owner', 'admin', 'manager'].includes(role);
  const bp = useBreakpoint();
  const { isMobile, isTablet } = bp;

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<EditState>(null);
  const [draft, setDraft] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    await onChanged();
  }, [onChanged]);

  const doCreate = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await api.categories.create(
        { name: draft.trim(), description: draftDesc.trim() || undefined },
        role
      );
      setDraft('');
      setDraftDesc('');
      setShowAdd(false);
      await refresh();
    } catch (e: any) {
      setErr(e.message || 'Erreur lors de la création');
    } finally {
      setBusy(false);
    }
  };

  const doUpdate = async (id: number) => {
    if (!draft.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await api.categories.update(
        id,
        {
          name: draft.trim(),
          description: draftDesc.trim() || null,
        },
        role
      );
      setEditing(null);
      setDraft('');
      setDraftDesc('');
      await refresh();
    } catch (e: any) {
      setErr(e.message || 'Erreur lors de la mise à jour');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (id: number) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    const message = isMobile
      ? `Supprimer "${cat.name}"?`
      : `Supprimer la catégorie "${cat.name}"?\nLes produits qu'elle contient seront déplacés vers une autre catégorie.`;

    if (!window.confirm(message)) return;

    setBusy(true);
    setErr(null);
    try {
      await api.categories.delete(id, role);
      await refresh();
    } catch (e: any) {
      setErr(e.message || 'Erreur lors de la suppression');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (cat: Category) => {
    setEditing({ id: cat.id, name: cat.name });
    setDraft(cat.name);
    setDraftDesc(cat.description || '');
    setErr(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft('');
    setDraftDesc('');
    setErr(null);
  };

  const cancelAdd = () => {
    setShowAdd(false);
    setDraft('');
    setDraftDesc('');
    setErr(null);
  };

  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: isMobile ? '14px 16px' : isTablet ? '16px 20px' : '16px 20px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: colors.surface,
          flexWrap: 'wrap',
          gap: spacing.sm,
        }}
      >
        <span
          style={{
            fontSize: isMobile ? '11px' : '12px',
            fontWeight: 800,
            color: colors.text2,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {t('products.categories') || 'Catégories'} ({categories.length})
        </span>

        {isAdminOrManager && !showAdd && !editing && (
          <button
            onClick={() => {
              setShowAdd(true);
              setDraft('');
              setDraftDesc('');
              setErr(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: isMobile ? '8px 12px' : '6px 14px',
              borderRadius: radius.sm,
              background: colors.accent.blue + '18',
              border: `1px solid ${colors.accent.blue}44`,
              color: colors.accent.blue,
              fontSize: isMobile ? '11px' : '11px',
              fontWeight: 800,
              cursor: 'pointer',
              minHeight: touchTargets.min,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.accent.blue + '22';
              e.currentTarget.style.borderColor = colors.accent.blue + '60';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.accent.blue + '18';
              e.currentTarget.style.borderColor = colors.accent.blue + '44';
            }}
          >
            <Plus size={isMobile ? 14 : 13} />
            {!isMobile && 'NOUVELLE'}
          </button>
        )}
      </div>

      {/* Add new category inline */}
      {showAdd && (
        <div
          style={{
            padding: isMobile ? '14px 16px' : '16px 20px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.sm,
            background: 'rgba(59,130,246,0.02)',
          }}
        >
          {err && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                padding: isMobile ? '8px 12px' : '10px 14px',
                borderRadius: radius.sm,
                background: colors.accent.redDim,
                border: `1px solid ${colors.accent.red}44`,
                color: colors.accent.red,
                fontSize: isMobile ? '11px' : '11px',
                fontWeight: 700,
              }}
            >
              <AlertTriangle size={isMobile ? 14 : 13} />
              {err}
            </div>
          )}

          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('products.categoryNamePlaceholder') || "Nom de la catégorie (ex: Boissons)"}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doCreate();
              if (e.key === 'Escape') cancelAdd();
            }}
            style={{
              width: '100%',
              padding: isMobile ? '10px 12px' : '10px 14px',
              borderRadius: radius.sm,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              color: colors.text1,
              fontSize: isMobile ? '13px' : '13px',
              outline: 'none',
              minHeight: touchTargets.min,
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.accent.blue;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.border;
            }}
          />

          <input
            value={draftDesc}
            onChange={(e) => setDraftDesc(e.target.value)}
            placeholder={t('products.categoryDescriptionPlaceholder') || "Description (optionnelle)"}
            style={{
              width: '100%',
              padding: isMobile ? '10px 12px' : '10px 14px',
              borderRadius: radius.sm,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              color: colors.text1,
              fontSize: isMobile ? '12px' : '12px',
              outline: 'none',
              minHeight: touchTargets.min,
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.accent.blue;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.border;
            }}
          />

          <div
            style={{
              display: 'flex',
              gap: spacing.xs,
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={cancelAdd}
              disabled={busy}
              style={{
                padding: isMobile ? '8px 14px' : '8px 16px',
                borderRadius: radius.sm,
                background: 'transparent',
                border: `1px solid ${colors.border}`,
                color: colors.text2,
                fontSize: isMobile ? '11px' : '11px',
                fontWeight: 700,
                cursor: busy ? 'not-allowed' : 'pointer',
                minHeight: touchTargets.min,
                opacity: busy ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!busy) {
                  e.currentTarget.style.background = colors.surface;
                  e.currentTarget.style.borderColor = colors.borderHi;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = colors.border;
              }}
            >
              {t('common.cancel')}
            </button>

            <button
              onClick={doCreate}
              disabled={busy || !draft.trim()}
              style={{
                padding: isMobile ? '8px 16px' : '8px 20px',
                borderRadius: radius.sm,
                background: colors.accent.blue,
                border: 'none',
                color: '#fff',
                fontSize: isMobile ? '11px' : '11px',
                fontWeight: 900,
                cursor: busy || !draft.trim() ? 'not-allowed' : 'pointer',
                minHeight: touchTargets.min,
                opacity: busy || !draft.trim() ? 0.65 : 1,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!busy && draft.trim()) {
                  e.currentTarget.style.filter = 'brightness(1.1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'brightness(1)';
              }}
            >
              {busy ? 'CRÉATION…' : t('products.create')}
            </button>
          </div>
        </div>
      )}

      {/* Category list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {categories.map((cat) => {
          const isEditingThis = editing?.id === cat.id;
          const count = cat.product_count ?? 0;

          return (
            <div
              key={cat.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: isMobile ? '10px 16px' : '11px 20px',
                borderBottom: `1px solid ${colors.border}`,
                gap: isMobile ? spacing.sm : spacing.md,
                transition: 'background 0.15s',
                background: isEditingThis ? 'rgba(59,130,246,0.04)' : 'transparent',
              }}
            >
              {isEditingThis ? (
                /* Edit inline */
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: spacing.xs,
                  }}
                >
                  {err && (
                    <div
                      style={{
                        color: colors.accent.red,
                        fontSize: isMobile ? '10px' : '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.xs,
                      }}
                    >
                      <AlertTriangle size={isMobile ? 12 : 12} />
                      {err}
                    </div>
                  )}

                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') doUpdate(cat.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    style={{
                      width: '100%',
                      padding: isMobile ? '8px 12px' : '8px 12px',
                      borderRadius: radius.sm,
                      background: colors.surface,
                      border: `1px solid ${colors.accent.blue}`,
                      color: colors.text1,
                      fontSize: isMobile ? '13px' : '13px',
                      outline: 'none',
                      minHeight: touchTargets.min,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = colors.accent.blue;
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accent.blue}15`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = colors.accent.blue;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />

                  <input
                    value={draftDesc}
                    onChange={(e) => setDraftDesc(e.target.value)}
                    placeholder={t('products.categoryDescriptionPlaceholder') || "Description (optionnelle)"}
                    style={{
                      width: '100%',
                      padding: isMobile ? '8px 12px' : '8px 12px',
                      borderRadius: radius.sm,
                      background: colors.surface,
                      border: `1px solid ${colors.border}`,
                      color: colors.text1,
                      fontSize: isMobile ? '12px' : '12px',
                      outline: 'none',
                    }}
                  />

                  <div
                    style={{
                      display: 'flex',
                      gap: spacing.xs,
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      onClick={cancelEdit}
                      style={{
                        padding: isMobile ? '5px 10px' : '5px 12px',
                        borderRadius: radius.sm,
                        background: 'transparent',
                        border: `1px solid ${colors.border}`,
                        color: colors.text2,
                        fontSize: isMobile ? '10px' : '10px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        minHeight: touchTargets.min,
                      }}
                    >
                      {t('common.cancel')}
                    </button>

                    <button
                      onClick={() => doUpdate(cat.id)}
                      disabled={busy || !draft.trim()}
                      style={{
                        padding: isMobile ? '5px 12px' : '5px 14px',
                        borderRadius: radius.sm,
                        background: colors.accent.blue,
                        border: 'none',
                        color: '#fff',
                        fontSize: isMobile ? '10px' : '10px',
                        fontWeight: 900,
                        cursor: busy || !draft.trim() ? 'not-allowed' : 'pointer',
                        minHeight: touchTargets.min,
                        opacity: busy || !draft.trim() ? 0.65 : 1,
                      }}
                    >
                      {busy ? '…' : 'OK'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Category info */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: isMobile ? '13px' : '13px',
                        fontWeight: 700,
                        color: colors.text1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {cat.name}
                    </div>
                    {cat.description && (
                      <div
                        style={{
                          fontSize: isMobile ? '11px' : '11px',
                          color: colors.text3,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '2px',
                        }}
                      >
                        {cat.description}
                      </div>
                    )}
                  </div>

                  {/* Product count badge */}
                  <div
                    style={{
                      fontSize: isMobile ? '10px' : '10px',
                      fontWeight: 800,
                      color: colors.text3,
                      background: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      padding: '2px 8px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {count} produit{count !== 1 ? 's' : ''}
                  </div>

                  {/* Action buttons */}
                  {isAdminOrManager && (
                    <div
                      style={{
                        display: 'flex',
                        gap: spacing.xs,
                        flexShrink: 0,
                      }}
                    >
                      <button
                        onClick={() => startEdit(cat)}
                        disabled={busy}
                        style={{
                          width: isMobile ? '32px' : '28px',
                          height: isMobile ? '32px' : '28px',
                          borderRadius: radius.sm,
                          background: 'transparent',
                          border: `1px solid ${colors.border}`,
                          color: colors.text3,
                          cursor: busy ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: touchTargets.min,
                          opacity: busy ? 0.5 : 1,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          if (!busy) {
                            e.currentTarget.style.background = colors.accent.blue + '10';
                            e.currentTarget.style.borderColor = colors.accent.blue + '40';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = colors.border;
                        }}
                        title={t('common.edit')}
                      >
                        <Pencil size={isMobile ? 14 : 12} />
                      </button>

                      <button
                        onClick={() => doDelete(cat.id)}
                        disabled={busy}
                        style={{
                          width: isMobile ? '32px' : '28px',
                          height: isMobile ? '32px' : '28px',
                          borderRadius: radius.sm,
                          background: 'transparent',
                          border: `1px solid ${colors.accent.red}44`,
                          color: colors.accent.red,
                          cursor: busy ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: touchTargets.min,
                          opacity: busy ? 0.5 : 1,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          if (!busy) {
                            e.currentTarget.style.background = colors.accent.red + '10';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        title={t('common.delete')}
                      >
                        <Trash2 size={isMobile ? 14 : 12} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {categories.length === 0 && !showAdd && (
        <div
          style={{
            padding: isMobile ? '24px 16px' : '36px 20px',
            textAlign: 'center',
            color: colors.text3,
          }}
        >
          <p
            style={{
              fontSize: isMobile ? '12px' : '12px',
              fontWeight: 700,
            }}
          >
            {t('products.noCategories') || 'Aucune catégorie'}
          </p>
          <p
            style={{
              fontSize: isMobile ? '11px' : '11px',
              marginTop: '4px',
            }}
          >
            {t('products.createCategoryHint') || 'Créez-en une pour classer vos produits.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default CategoryManager;
