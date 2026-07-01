import React, { useEffect } from 'react';
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
import { useBreakpoint } from '../../../lib/hooks/useBreakpoint';
import { spacing, touchTargets, safeArea } from '../../../lib/design-system/responsive';

const { colors, radius, shadows } = EnterpriseTokens;

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

/**
 * Enhanced responsive Product Modal
 * - Full screen on mobile
 * - Bottom sheet style on mobile
 * - Traditional modal on desktop
 */
export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen, onClose, onSave, product, categories,
}) => {
  const { user } = useAuthStore();
  const role = user?.role || '';
  const { currency, language: lang } = useSettingsStore();
  const { t } = useI18n();
  const bp = useBreakpoint();
  const { isMobile, isTablet } = bp;

  // Form state
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<Partial<ProductFormData>>({
    resolver: zodResolver(
      ProductSchema.omit({
        id: true, created_at: true, updated_at: true,
        image_url: true, is_available: true, category_name: true,
      })
    ) as any,
    defaultValues: product ? {
      name: product.name,
      barcode: product.barcode ?? undefined,
      category_id: product.category_id,
      buying_price: product.buying_price,
      selling_price: product.selling_price,
      stock_quantity: product.stock_quantity,
      minimum_stock: product.minimum_stock,
      unit: product.unit,
      description: product.description ?? undefined,
    } : {
      name: '',
      barcode: undefined,
      category_id: undefined as any,
      buying_price: 0,
      selling_price: 0,
      stock_quantity: 0,
      minimum_stock: 5,
      unit: 'pcs',
      description: undefined,
    },
  });

  const buyingPrice = watch('buying_price') || 0;
  const sellingPrice = watch('selling_price') || 0;
  const margin = sellingPrice - buyingPrice;
  const marginPct = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;
  const watchedName = watch('name');
  const watchedCategoryId = watch('category_id');

  // Auto-generate barcode when name or category changes
  useEffect(() => {
    if (!watchedName || !watchedCategoryId) return;
    
    const category = categories.find(c => c.id === watchedCategoryId);
    const categoryPrefix = category ? category.name.substring(0, 3).toUpperCase() : 'PRD';
    const namePart = watchedName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 4);
    const timestamp = Date.now().toString().slice(-4);
    const generatedBarcode = `${categoryPrefix}-${namePart}-${timestamp}`;
    
    setValue('barcode', generatedBarcode, { shouldValidate: false });
  }, [watchedName, watchedCategoryId, categories, setValue]);

  // Image state
  const [imagePreview, setImagePreview] = React.useState<string | null>(product?.image_url || null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadErr, setUploadErr] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dragCounterRef = React.useRef(0);

  // Pick file handler
  const pickFile = (file?: File | null) => {
    if (!file) return;
    const ext = '.' + file.name.split('.').pop()!.toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowed.includes(ext)) {
      setUploadErr('Format non supporté. JPG, PNG, GIF, WebP.');
      return;
    }
    setUploadErr(null);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    pickFile(e.target.files?.[0] ?? null);
    if (e.target) e.target.value = '';
  };

  const handleDrop: React.DragEventHandler = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    pickFile(file);
    if (product?.id) {
      setIsUploading(true);
      try {
        await api.products.uploadImage(product.id, file, role);
      } catch (err: any) {
        setUploadErr(err.message ?? 'Échec de l\'envoi');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Reset form on open/close
  useEffect(() => {
    if (!isOpen) return;
    if (product) {
      reset({
        name: product.name,
        barcode: product.barcode ?? undefined,
        category_id: product.category_id,
        buying_price: product.buying_price,
        selling_price: product.selling_price,
        stock_quantity: product.stock_quantity,
        minimum_stock: product.minimum_stock,
        unit: product.unit,
        description: product.description ?? undefined,
      } as any);
      setImagePreview(product.image_url || null);
    } else {
      reset({
        name: '',
        barcode: undefined,
        category_id: undefined as any,
        buying_price: 0,
        selling_price: 0,
        stock_quantity: 0,
        minimum_stock: 5,
        unit: 'pcs',
        description: undefined,
      } as any);
      setImagePreview(null);
    }
    setUploadErr(null);
  }, [isOpen, product, reset]);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Responsive values
  const maxWidth = isMobile ? '100%' : isTablet ? '700px' : '920px';
  const maxHeight = isMobile ? '95vh' : '90vh';
  const borderRadius = isMobile ? radius.xxl : radius.xxl;
  const padding = isMobile ? '20px 16px' : isTablet ? '28px 24px' : '36px 40px';
  const headerPadding = isMobile ? '20px 16px' : isTablet ? '24px 24px' : '24px 40px';
  const titleFontSize = isMobile ? '20px' : isTablet ? '22px' : '22px';
  const subtitleFontSize = isMobile ? '11px' : '12px';
  const formGridCols = isMobile ? '1fr' : '260px 1fr';
  const formGap = isMobile ? spacing.md : spacing['2xl'];
  const marginBottom = isMobile ? spacing.md : spacing['2xl'];

  return (
    <>
      {/* Modal overlay */}
      <div
        className="modal-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          background: isMobile ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.88)',
          backdropFilter: isMobile ? 'blur(20px)' : 'blur(16px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: isMobile ? 'flex-end' : 'center',
          justifyContent: 'center',
          padding: isMobile ? 0 : spacing['2xl'],
          paddingBottom: isMobile ? safeArea.bottom : spacing['2xl'],
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-title"
      >
        {/* Modal content - bottom sheet on mobile */}
        <div
          className="animate-slide"
          style={{
            background: colors.card,
            border: `1px solid ${isMobile ? 'transparent' : colors.borderHi}`,
            borderRadius: isMobile 
              ? `${borderRadius} ${borderRadius} 0 0`
              : borderRadius,
            width: isMobile ? '100%' : maxWidth,
            maxWidth,
            maxHeight,
            overflowY: 'auto',
            boxShadow: isMobile ? 'none' : shadows.hard,
            transform: isMobile ? 'translateY(0)' : 'translateY(0)',
            marginTop: isMobile ? 'auto' : '0',
            marginBottom: isMobile ? 0 : '0',
            // Safe area support
            paddingBottom: isMobile ? safeArea.bottom : undefined,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: headerPadding,
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: isMobile ? 'sticky' : 'sticky',
              top: 0,
              background: colors.card,
              zIndex: 10,
              marginBottom: marginBottom,
            }}
          >
            <div>
              <h2
                id="pm-title"
                style={{
                  fontSize: titleFontSize,
                  fontWeight: 800,
                  margin: 0,
                  color: colors.text1,
                  lineHeight: 1.2,
                }}
              >
                {product ? t('products.editProduct') : t('products.newProduct')}
              </h2>
              <p
                style={{
                  fontSize: subtitleFontSize,
                  color: colors.text3,
                  margin: '4px 0 0',
                  fontWeight: 500,
                }}
              >
                {product ? t('products.updateProduct') : t('products.createProduct')}
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                width: isMobile ? '40px' : '42px',
                height: isMobile ? '40px' : '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.text3,
                cursor: 'pointer',
                minHeight: touchTargets.min,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.accent.blue + '10';
                e.currentTarget.style.borderColor = colors.accent.blue + '40';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.surface;
                e.currentTarget.style.borderColor = colors.border;
              }}
            >
              <X size={isMobile ? 18 : 20} />
            </button>
          </div>

          {/* Form */}
          <form
            id="product-form"
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
            style={{
              padding: isMobile ? '16px' : padding,
              paddingTop: 0,
            }}
          >
            {/* Mobile: Single column, Desktop: 2-column layout */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: formGridCols,
                gap: formGap,
                marginBottom: marginBottom,
              }}
            >
              {/*** IMAGE SECTION ***/}
              <div>
                <label
                  className="enterprise-label"
                  style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontSize: isMobile ? '11px' : '10px',
                    fontWeight: 700,
                  }}
                >
                  <ImageIcon
                    size={isMobile ? 14 : 13}
                    style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }}
                  />
                  {t('products.photo')}
                </label>

                {/* Image drop zone */}
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
                    position: 'relative',
                    aspectRatio: '1 / 1',
                    borderRadius: radius.lg,
                    border: `2px dashed ${isDragging ? colors.accent.blue : colors.borderHi}`,
                    background: imagePreview ? 'transparent' : colors.surface,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isDragging ? `0 0 28px ${colors.accent.blue}28` : 'none',
                    minHeight: isMobile ? '120px' : '180px',
                  }}
                >
                  {imagePreview ? (
                    <>
                      <img
                        src={imagePreview}
                        alt="aperçu"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.60)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                      >
                        <Upload size={isMobile ? 20 : 22} color="#fff" />
                        <span style={{ color: '#fff', fontSize: isMobile ? '11px' : '12px', fontWeight: 700 }}>
                          Remplacer
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeImage(); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: isMobile ? '6px 12px' : '6px 14px',
                            borderRadius: radius.sm,
                            background: colors.accent.red,
                            border: 'none',
                            color: '#fff',
                            fontSize: isMobile ? '10px' : '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            minHeight: touchTargets.min,
                          }}
                        >
                          <Trash2 size={isMobile ? 12 : 12} />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: isMobile ? '16px' : '24px 16px',
                        color: colors.text3,
                      }}
                    >
                      <div
                        style={{
                          width: isMobile ? '44px' : '54px',
                          height: isMobile ? '44px' : '54px',
                          borderRadius: isMobile ? '12px' : '16px',
                          background: colors.cardHi,
                          border: `1px solid ${colors.border}`,
                          margin: '0 auto 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ImageIcon size={isMobile ? 22 : 26} />
                      </div>
                      <p
                        style={{
                          margin: '0 0 4px',
                          fontSize: isMobile ? '12px' : '13px',
                          fontWeight: 700,
                          color: colors.text2,
                        }}
                      >
                        {t('products.dragDropImage')}
                      </p>
                      <p style={{ margin: 0, fontSize: isMobile ? '10px' : '11px' }}>
                        {t('products.clickToBrowse')}
                      </p>
                      <p
                        style={{
                          margin: '8px 0 0',
                          fontSize: isMobile ? '9px' : '10px',
                          color: colors.text3,
                        }}
                      >
                        {t('products.acceptedFormats')}
                      </p>
                    </div>
                  )}

                  {isUploading && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.65)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      <div
                        className="spin"
                        style={{
                          width: '28px',
                          height: '28px',
                          border: '3px solid rgba(255,255,255,0.2)',
                          borderTopColor: colors.accent.blue,
                          borderRadius: '50%',
                        }}
                      />
                      <span
                        style={{
                          color: '#fff',
                          fontSize: isMobile ? '11px' : '12px',
                          fontWeight: 700,
                        }}
                      >
                        Envoi en cours…
                      </span>
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
                  <p
                    style={{
                      color: colors.accent.red,
                      fontSize: isMobile ? '11px' : '10px',
                      fontWeight: 700,
                      margin: '8px 0 0',
                      textTransform: 'uppercase',
                    }}
                  >
                    {uploadErr}
                  </p>
                )}

                {imagePreview && !isUploading && (
                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <CheckCircle size={isMobile ? 12 : 12} color={colors.accent.green} />
                    <span
                      style={{
                        fontSize: isMobile ? '10px' : '10px',
                        color: colors.accent.green,
                        fontWeight: 700,
                      }}
                    >
                      Image sélectionnée ✓
                    </span>
                  </div>
                )}
              </div>

              {/*** FORM FIELDS ***/}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isMobile ? spacing.md : spacing.lg,
                }}
              >
                {/* Name */}
                <div>
                  <label className="enterprise-label">Nom du Produit *</label>
                  <input
                    {...register('name', { required: 'Nom requis' })}
                    className={`enterprise-input ${errors.name ? 'error' : ''}`}
                    placeholder="Ex: Vin Rouge Bordeaux 75cl"
                    style={{ minHeight: touchTargets.min }}
                  />
                  {errors.name && (
                    <p className="field-error">{String(errors.name.message)}</p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="enterprise-label">Catégorie *</label>
                  <select
                    {...register('category_id', {
                      valueAsNumber: true,
                      required: 'Catégorie obligatoire',
                      validate: (v: any) => (!v || isNaN(v)) ? 'Catégorie obligatoire' : true as any,
                    })}
                    className={`enterprise-input ${errors.category_id ? 'error' : ''}`}
                    style={{ minHeight: touchTargets.min }}
                  >
                    <option value="">Sélectionner…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {errors.category_id && (
                    <p className="field-error">{String(errors.category_id.message)}</p>
                  )}
                </div>

                {/* Barcode - Auto-generated, read-only */}
                <div>
                  <label className="enterprise-label">{t('products.barcode')} (auto-généré)</label>
                  <input
                    {...register('barcode')}
                    className="enterprise-input"
                    placeholder="Généré automatiquement"
                    readOnly
                    style={{ 
                      minHeight: touchTargets.min,
                      background: colors.surface,
                      color: colors.text3,
                      cursor: 'not-allowed',
                      opacity: 0.8,
                    }}
                  />
                </div>

                {/* Prices + margin row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
                    gap: isMobile ? spacing.sm : spacing.md,
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(59,130,246,0.025)',
                      padding: isMobile ? spacing.sm : '16px',
                      borderRadius: radius.lg,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <label
                      className="enterprise-label"
                      style={{ color: colors.accent.blue }}
                    >
                      {t('products.buyPrice')}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: isMobile ? 10 : 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontWeight: 800,
                          color: colors.accent.blue,
                          fontSize: isMobile ? '14px' : 'inherit',
                        }}
                      >
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        {...register('buying_price', { valueAsNumber: true })}
                        className="enterprise-input"
                        style={{
                          paddingLeft: isMobile ? 30 : 32,
                          minHeight: touchTargets.min,
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'rgba(212,175,55,0.025)',
                      padding: isMobile ? spacing.sm : '16px',
                      borderRadius: radius.lg,
                      border: `1px solid ${colors.accent.gold}22`,
                    }}
                  >
                    <label
                      className="enterprise-label"
                      style={{ color: colors.accent.gold }}
                    >
                      {t('products.sellPrice')}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: isMobile ? 10 : 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontWeight: 800,
                          color: colors.accent.gold,
                          fontSize: isMobile ? '14px' : 'inherit',
                        }}
                      >
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        {...register('selling_price', { valueAsNumber: true })}
                        className="enterprise-input"
                        style={{
                          paddingLeft: isMobile ? 30 : 32,
                          color: colors.accent.gold,
                          fontWeight: 800,
                          minHeight: touchTargets.min,
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      padding: isMobile ? '0 10px' : '0 6px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: isMobile ? '10px' : '10px',
                        fontWeight: 800,
                        color: colors.text3,
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('products.grossMargin')}
                    </div>
                    <div
                      style={{
                        fontSize: isMobile ? '18px' : '20px',
                        fontWeight: 800,
                        color:
                          margin >= 0
                            ? colors.accent.green
                            : colors.accent.red,
                      }}
                      className="mono"
                    >
                      {margin >= 0 ? '+' : ''}
                      {formatPrice(margin, currency, lang)}
                    </div>
                    <div
                      style={{
                        fontSize: isMobile ? '10px' : '10px',
                        fontWeight: 700,
                        color:
                          marginPct > 20
                            ? colors.accent.green
                            : marginPct > 10
                            ? colors.accent.amber
                            : colors.accent.red,
                      }}
                    >
                      {marginPct.toFixed(1)}%
                      {marginPct < 15 && (
                        <AlertTriangle
                          size={isMobile ? 10 : 11}
                          style={{ display: 'inline', marginLeft: 3 }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Stock row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
                    gap: isMobile ? spacing.sm : spacing.md,
                  }}
                >
                  <div>
                    <label className="enterprise-label">
                      {t('products.stock')}
                    </label>
                    <input
                      type="number"
                      {...register('stock_quantity', { valueAsNumber: true })}
                      className="enterprise-input mono"
                      style={{ minHeight: touchTargets.min }}
                    />
                  </div>

                  <div>
                    <label className="enterprise-label">
                      {t('products.minStock')}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <AlertTriangle
                        size={isMobile ? 12 : 14}
                        style={{
                          position: 'absolute',
                          left: isMobile ? 10 : 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: colors.text3,
                          pointerEvents: 'none',
                        }}
                      />
                      <input
                        type="number"
                        {...register('minimum_stock', { valueAsNumber: true })}
                        className="enterprise-input mono"
                        style={{
                          paddingLeft: isMobile ? 36 : 40,
                          minHeight: touchTargets.min,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="enterprise-label">Unité</label>
                    <select
                      {...register('unit')}
                      className="enterprise-input"
                      style={{ minHeight: touchTargets.min }}
                    >
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
                  <label className="enterprise-label">
                    Description (optionnel)
                  </label>
                  <textarea
                    {...register('description')}
                    className="enterprise-input"
                    rows={isMobile ? 2 : 2}
                    placeholder="Brève description du produit…"
                    style={{
                      resize: 'vertical',
                      minHeight: isMobile ? touchTargets.min : '56px',
                    }}
                  />
                </div>
              </div>
            </div>

            {/*** AUDIT NOTICE ***/}
            <div
              style={{
                marginBottom: marginBottom,
                padding: isMobile ? '12px 14px' : '14px 20px',
                background: 'rgba(255,255,255,0.015)',
                borderRadius: radius.lg,
                border: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <HelpCircle
                size={isMobile ? 14 : 15}
                color={colors.text3}
              />
              <span
                style={{
                  fontSize: isMobile ? '10px' : '11px',
                  color: colors.text3,
                  lineHeight: 1.5,
                }}
              >
                Toutes les modifications sont auditées. Les images sont
                stockées localement sur le serveur.
              </span>
            </div>

            {/*** ACTIONS ***/}
            <div
              style={{
                display: 'flex',
                gap: spacing.sm,
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: isMobile ? '12px 24px' : '13px 30px',
                  borderRadius: radius.md,
                  background: 'transparent',
                  border: `1px solid ${colors.border}`,
                  color: colors.text2,
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: touchTargets.min,
                  fontSize: isMobile ? '13px' : '14px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.surface;
                  e.currentTarget.style.borderColor = colors.borderHi;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = colors.border;
                }}
              >
                Annuler
              </button>

              <button
                type="submit"
                form="product-form"
                disabled={isSubmitting}
                style={{
                  padding: isMobile ? '12px 24px' : '13px 44px',
                  borderRadius: radius.md,
                  background: colors.accent.blue,
                  border: 'none',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  minHeight: touchTargets.min,
                  boxShadow: '0 8px 24px rgba(59,130,246,0.25)',
                  opacity: isSubmitting ? 0.65 : 1,
                  fontSize: isMobile ? '13px' : '14px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.boxShadow =
                      '0 10px 32px rgba(59,130,246,0.35)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.boxShadow =
                      '0 8px 24px rgba(59,130,246,0.25)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                {isSubmitting
                  ? 'ENREGISTREMENT…'
                  : product
                  ? 'METTRE À JOUR'
                  : 'CRÉER LE PRODUIT'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/*** STYLES ***/}
      <style>{`
        .enterprise-label {
          display: block; 
          font-size: ${isMobile ? '11px' : '10px'}; 
          font-weight: 800;
          color: ${colors.text3}; 
          text-transform: uppercase; 
          letter-spacing: 0.08em; 
          margin-bottom: 8px;
        }
        .enterprise-input {
          width: 100%; 
          background: ${colors.surface}; 
          border: 1px solid ${colors.border};
          border-radius: ${radius.md}; 
          padding: ${isMobile ? '10px 12px' : '11px 14px'}; 
          color: ${colors.text1};
          font-size: ${isMobile ? '13px' : '14px'}; 
          outline: none; 
          transition: border-color 0.2s, background 0.2s;
          box-sizing: border-box;
          min-height: ${touchTargets.min};
        }
        .enterprise-input:focus { 
          border-color: ${colors.accent.blue}; 
          background: ${colors.card}; 
        }
        .enterprise-input.error { 
          border-color: ${colors.accent.red}; 
        }
        .field-error { 
          color: ${colors.accent.red}; 
          font-size: ${isMobile ? '11px' : '11px'}; 
          font-weight: 700; 
          margin: 4px 0 0; 
          text-transform: uppercase; 
        }
        .mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        
        /* Mobile bottom sheet animation */
        @-webkit-keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide {
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        
        /* Desktop backdrop blur */
        .modal-overlay {
          transition: opacity 0.2s ease, backdrop-filter 0.2s ease;
        }
        
        /* Touch feedback */
        @media (pointer: coarse) {
          button:active:not(:disabled) {
            transform: scale(0.98) !important;
          }
        }
      `}</style>
    </>
  );
};

export default ProductModal;
