import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  X, ImageIcon, Upload, Trash2,
  AlertTriangle, HelpCircle, CheckCircle,
} from 'lucide-react';
import { ProductSchema, Product, Category } from '../types';
import { api } from '../../../lib/api-client';
import { useAuthStore } from '../../../stores/useAuthStore';
import { EnterpriseTokens } from '../../../lib/design-system';
import { useSettingsStore } from '../../../stores/useSettingsStore';
import { useI18n } from '../../../lib/i18n';
import { formatPrice } from '../../../lib/i18n/currency';

const { colors, radius, shadows } = EnterpriseTokens;

// ─── Types ───────────────────────────────────────────────────────────

interface ProductFormData {
  name: string;
  barcode?: string | null;
  category_id: number;
  buying_price: number;
  selling_price: number;
  stock_quantity: number;
  minimum_stock: number;
  unit: string;
  description?: string;
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Product>) => Promise<void>;
  product?: Product | null;
  categories: Category[];
}

// ─── Component ───────────────────────────────────────────────────────

/**
 * Enterprise Product Form Modal
 *
 * Call chain when user clicks "Créer le produit":
 *
 *   <form onSubmit={...}>          → fires native submit event
 *     handleSubmit(onSubmit)        → RHF runs Zod validation (all fields valid)
 *       onSubmit(formData)          → merges imagePreview, calls prop onSave(data)
 *         handleProductSaved(data)  → ProductsPage.tsx
 *           createProduct(data, role) → useProductStore.ts
 *             api.products.create(data, role)  → X-User-Role header sent ✓
 *               POST /products     → 201 Created ← VERIFIED WITH CURL
 *           fetchProducts()         → list refreshes
 *           setShowModal(false)     → modal closes
 *
 * Every step logs to the console for debugging.
 */
export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen, onClose, onSave, product, categories,
}) => {
  const { user } = useAuthStore();
  const role = user?.role || '';
  const { currency, language: lang } = useSettingsStore();
  const { t } = useI18n();

  // ── RHF Form ──────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<Partial<ProductFormData>>({
    resolver: zodResolver(
      ProductSchema.omit({
        id: true, created_at: true, updated_at: true,
        image_url: true, is_available: true, category_name: true,
      })
    ) as any,
    defaultValues: product ? {
      name:      product.name,
      barcode:   product.barcode ?? undefined,
      category_id: product.category_id,
      buying_price:  product.buying_price,
      selling_price: product.selling_price,
      stock_quantity: product.stock_quantity,
      minimum_stock:  product.minimum_stock,
      unit:       product.unit,
      description: product.description ?? undefined,
    } : {
      name: '',
      barcode: undefined,
      category_id: undefined as any,
      buying_price: 0, selling_price: 0,
      stock_quantity: 0, minimum_stock: 5,
      unit: 'pcs', description: undefined,
    },
  });

  const buyingPrice  = watch('buying_price')  || 0;
  const sellingPrice = watch('selling_price') || 0;
  const margin       = sellingPrice - buyingPrice;
  const marginPct    = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;

  // ── Image State ───────────────────────────────────────────────────
  const [imagePreview, setImagePreview] = React.useState<string | null>(product?.image_url || null);
  const [isDragging,  setIsDragging]       = React.useState(false);
  const [isUploading,  setIsUploading]      = React.useState(false);
  const [uploadErr,    setUploadErr]        = React.useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileInputRef   = React.useRef<any>(null);
  const dragCounterRef = React.useRef(0);

  const pickFile = (file?: File | null) => {
    if (!file) return;
    const ext = '.' + file.name.split('.').pop()!.toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowed.includes(ext)) { setUploadErr('Format non supporté. JPG, PNG, GIF, WebP.'); return; }
    setUploadErr(null);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    pickFile(e.target.files?.[0] ?? null);
    e.target.value = '';
  };

  const handleDrop: React.DragEventHandler = async (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false); dragCounterRef.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    pickFile(file);
    if (product?.id) {
      setIsUploading(true);
      try { await api.products.uploadImage(product.id, file, role); }
      catch (err: any) { setUploadErr(err.message ?? 'Échec de l\'envoi'); }
      finally { setIsUploading(false); }
    }
  };

  const removeImage = () => { setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  // ── Reset on open ─────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isOpen) return;
    if (product) {
      reset({
        name: product.name,
        barcode: product.barcode ?? undefined,
        category_id: product.category_id,
        buying_price: product.buying_price,
        selling_price: product.selling_price,
        stock_quantity: product.stock_quantity,
        minimum_stock:  product.minimum_stock,
        unit: product.unit,
        description: product.description ?? undefined,
      } as any);
      setImagePreview(product.image_url || null);
    } else {
      reset({
        name: '', barcode: undefined,
        category_id: undefined as any,
        buying_price: 0, selling_price: 0,
        stock_quantity: 0, minimum_stock: 5,
        unit: 'pcs', description: undefined,
      } as any);
      setImagePreview(null);
    }
    setUploadErr(null);
  }, [isOpen, product, reset]);

  if (!isOpen) return null;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)',
        zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-labelledby="pm-title"
    >
      <div className="animate-slide" style={{
        background: colors.card, border: `1px solid ${colors.borderHi}`,
        borderRadius: radius.xxl, width: '100%', maxWidth: '920px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: shadows.hard,
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 40px', borderBottom: `1px solid ${colors.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: colors.card, zIndex: 10,
        }}>
          <div>
            <h2 id="pm-title" style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>
              {product ? t('products.editProduct') : t('products.newProduct')}
            </h2>
            <p style={{ fontSize: '12px', color: colors.text3, margin: '4px 0 0' }}>
              {product ? t('products.updateProduct') : t('products.createProduct')}
            </p>
          </div>
          <button
            onClick={onClose} aria-label="Fermer"
            style={{
              background: colors.surface, border: `1px solid ${colors.border}`,
              borderRadius: '12px', width: '42px', height: '42px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: colors.text3, cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form
          id="product-form"
          //eslint-disable-next-line @typescript-eslint/no-misused-promises
          onSubmit={handleSubmit(
            async (data) => {
              console.log('[ProductModal] FORM SUBMITTED ok —', data);
              const payload = { ...data, image_url: imagePreview ?? (data as any).image_url } as Partial<Product>;
              await onSave(payload);
            },
            (errs) => {
              console.error('[ProductModal] FORM VALIDATION FAILED:', errs);
              const msgs: string[] = [];
              Object.entries(errs).forEach(([k, v]: [string, any]) => msgs.push(`${k}: ${v.message}`));
              setUploadErr('Champs invalides : ' + msgs.join(' · '));
            }
          )}
          noValidate
          style={{ padding: '36px 40px 44px' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px', marginBottom: '28px' }}>

            {/* ── Image drop zone ── */}
            <div>
                <label className="enterprise-label" style={{ display: 'block', marginBottom: 10 }}>
                  <ImageIcon size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
                  {t('products.photo')}
                </label>

              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragEnter={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  dragCounterRef.current++;
                  if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  dragCounterRef.current = Math.max(dragCounterRef.current - 1, 0);
                  if (dragCounterRef.current === 0) setIsDragging(false);
                }}
                onDragEnd={() => { setIsDragging(false); dragCounterRef.current = 0; }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: 'relative', aspectRatio: '1 / 1',
                  borderRadius: radius.lg,
                  border: `2px dashed ${isDragging ? colors.accent.blue : colors.borderHi}`,
                  background: imagePreview ? 'transparent' : colors.surface,
                  cursor: 'pointer', overflow: 'hidden',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isDragging ? `0 0 28px ${colors.accent.blue}28` : 'none',
                }}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="aperçu" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div
                      style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.60)', display: 'flex',
                        flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', gap: '8px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                    >
                      <Upload size={22} color="#fff" />
                      <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>Remplacer</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeImage(); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '6px 14px', borderRadius: radius.sm,
                          background: colors.accent.red, border: 'none',
                          color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 16px', color: colors.text3 }}>
                    <div style={{
                      width: '54px', height: '54px', borderRadius: '16px',
                      background: colors.cardHi, border: `1px solid ${colors.border}`,
                      margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <ImageIcon size={26} />
                    </div>
                    <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: colors.text2 }}>{t('products.dragDropImage')}</p>
                    <p style={{ margin: 0, fontSize: '11px' }}>{t('products.clickToBrowse')}</p>
                    <p style={{ margin: '8px 0 0', fontSize: '10px', color: colors.text3 }}>{t('products.acceptedFormats')}</p>
                  </div>
                )}

                {isUploading && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.65)', display: 'flex',
                    flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: '8px',
                  }}>
                    <div className="spin" style={{
                      width: '28px', height: '28px',
                      border: '3px solid rgba(255,255,255,0.2)',
                      borderTopColor: colors.accent.blue, borderRadius: '50%',
                    }} />
                    <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>Envoi en cours…</span>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {uploadErr && (
                <p style={{ color: colors.accent.red, fontSize: '11px', fontWeight: 700, margin: '8px 0 0', textTransform: 'uppercase' }}>
                  {uploadErr}
                </p>
              )}

              {imagePreview && !isUploading && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle size={12} color={colors.accent.green} />
                  <span style={{ fontSize: '10px', color: colors.accent.green, fontWeight: 700 }}>Image sélectionnée ✓</span>
                </div>
              )}
            </div>

            {/* ── Form fields ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Name */}
              <div>
                <label className="enterprise-label">Nom du Produit *</label>
                <input
                  {...register('name', { required: 'Nom requis' })}
                  className={`enterprise-input ${errors.name ? 'error' : ''}`}
                  placeholder="Ex: Vin Rouge Bordeaux 75cl"
                />
                {errors.name && <p className="field-error">{String(errors.name.message)}</p>}
              </div>

              {/* Category — valueAsNumber: true + guard against NaN */}
              <div>
                <label className="enterprise-label">Catégorie *</label>
                <select
                  {...register('category_id', {
                    valueAsNumber: true,
                    required: 'Catégorie obligatoire',
                    validate: (v: any) => (!v || isNaN(v)) ? 'Catégorie obligatoire' : true as any,
                  })}
                  className={`enterprise-input ${errors.category_id ? 'error' : ''}`}
                >
                  <option value="">Sélectionner…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.category_id && <p className="field-error">{String(errors.category_id.message)}</p>}
              </div>

              {/* Barcode */}
              <div>
                <label className="enterprise-label">{t('products.barcode')}</label>
                <input {...register('barcode')} className="enterprise-input" placeholder="SKU / EAN" />
              </div>

              {/* Prices + margin row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'rgba(59,130,246,0.025)', padding: '16px', borderRadius: radius.lg, border: `1px solid ${colors.border}` }}>
                   <label className="enterprise-label" style={{ color: colors.accent.blue }}>{t('products.buyPrice')}</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: colors.accent.blue }}>$</span>
                    <input
                      type="number" step="0.01"
                      {...register('buying_price', { valueAsNumber: true })}
                      className="enterprise-input" style={{ paddingLeft: 32 }}
                    />
                  </div>
                </div>

                <div style={{ background: 'rgba(212,175,55,0.025)', padding: '16px', borderRadius: radius.lg, border: `1px solid ${colors.accent.gold}22` }}>
                   <label className="enterprise-label" style={{ color: colors.accent.gold }}>{t('products.sellPrice')}</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: colors.accent.gold }}>$</span>
                    <input
                      type="number" step="0.01"
                      {...register('selling_price', { valueAsNumber: true })}
                      className="enterprise-input" style={{ paddingLeft: 32, color: colors.accent.gold, fontWeight: 800 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 6px' }}>
                   <div style={{ fontSize: '10px', fontWeight: 800, color: colors.text3, textTransform: 'uppercase' }}>{t('products.grossMargin')}</div>
                  <div style={{
                    fontSize: '20px', fontWeight: 800,
                    color: margin >= 0 ? colors.accent.green : colors.accent.red,
                  }} className="mono">
                    {margin >= 0 ? '+' : ''}{formatPrice(margin, currency, lang)}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: marginPct > 20 ? colors.accent.green : marginPct > 10 ? colors.accent.amber : colors.accent.red }}>
                    {marginPct.toFixed(1)}% {marginPct < 15 && <AlertTriangle size={11} style={{ display: 'inline', marginLeft: 3 }} />}
                  </div>
                </div>
              </div>

              {/* Stock row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                   <label className="enterprise-label">{t('products.stock')}</label>
                  <input
                    type="number"
                    {...register('stock_quantity', { valueAsNumber: true })}
                    className="enterprise-input mono"
                  />
                </div>
                <div>
                   <label className="enterprise-label">{t('products.minStock')}</label>
                  <div style={{ position: 'relative' }}>
                    <AlertTriangle size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: colors.text3, pointerEvents: 'none' }} />
                    <input
                      type="number"
                      {...register('minimum_stock', { valueAsNumber: true })}
                      className="enterprise-input mono" style={{ paddingLeft: 40 }}
                    />
                  </div>
                </div>
                <div>
                  <label className="enterprise-label">Unité</label>
                  <select {...register('unit')} className="enterprise-input">
                    <option value="pcs">Pièces (Pcs)</option>
                    <option value="btl">Bouteilles (Btl)</option>
                    <option value="kg">Kilogrammes (Kg)</option>
                    <option value="l">Litres (L)</option>
                    <option value="g">Grammes (g)</option>
                    <option value="ml">Millilitres (ml)</option>
                    <option value="unit">Unité</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="enterprise-label">Description (optionnel)</label>
                <textarea
                  {...register('description')}
                  className="enterprise-input"
                  rows={2}
                  placeholder="Brève description du produit…"
                  style={{ resize: 'vertical', minHeight: '56px' }}
                />
              </div>
            </div>
          </div>

          {/* Audit notice */}
          <div style={{
            marginBottom: '28px', padding: '14px 20px',
            background: 'rgba(255,255,255,0.015)',
            borderRadius: radius.lg, border: `1px solid ${colors.border}`,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <HelpCircle size={15} color={colors.text3} />
            <span style={{ fontSize: '11px', color: colors.text3 }}>
              Toutes les modifications sont auditées. Les images sont stockées localement sur le serveur.
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '13px 30px', borderRadius: radius.md,
                background: 'transparent', border: `1px solid ${colors.border}`,
                color: colors.text2, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              form="product-form"
              disabled={isSubmitting}
              style={{
                padding: '13px 44px', borderRadius: radius.md,
                background: colors.accent.blue, border: 'none', color: '#fff',
                fontWeight: 900,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 24px rgba(59,130,246,0.25)',
                opacity: isSubmitting ? 0.65 : 1,
                transition: 'all 0.2s',
              }}
            >
              {isSubmitting
                ? 'ENREGISTREMENT…'
                : product ? 'METTRE À JOUR' : 'CRÉER LE PRODUIT'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .enterprise-label {
          display: block; font-size: 10px; font-weight: 800;
          color: ${colors.text3}; text-transform: uppercase;
          letter-spacing: 0.08em; margin-bottom: 8px;
        }
        .enterprise-input {
          width: 100%; background: ${colors.surface}; border: 1px solid ${colors.border};
          border-radius: ${radius.md}; padding: 11px 14px; color: ${colors.text1};
          font-size: 14px; outline: none; transition: border-color 0.2s, background 0.2s;
          box-sizing: border-box;
        }
        .enterprise-input:focus { border-color: ${colors.accent.blue}; background: ${colors.card}; }
        .enterprise-input.error { border-color: ${colors.accent.red}; }
        .field-error { color: ${colors.accent.red}; font-size: 11px; font-weight: 700; margin: 4px 0 0; text-transform: uppercase; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </div>
  );
};
