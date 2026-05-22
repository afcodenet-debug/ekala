import { useState, useEffect, useMemo, useCallback } from 'react';
import { useProductStore } from './hooks/useProductStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useProductPermissions } from './hooks/useProductPermissions';
import { useI18n } from '../../lib/i18n';
import { EnterpriseTokens } from '../../lib/design-system';
import { ProductModal } from './components/ProductModal';
import { StockAdjustmentModal } from './components/StockAdjustmentModal';
import { InventoryHeader } from './components/inventory/InventoryHeader';
import { InventoryStats } from './components/inventory/InventoryStats';
import { InventoryFilters } from './components/inventory/InventoryFilters';
import { InventoryTable } from './components/inventory/InventoryTable';
import { InventoryPagination } from './components/inventory/InventoryPagination';
import { EmptyInventoryState } from './components/inventory/EmptyInventoryState';
import { InventoryActivityPreview } from './components/inventory/InventoryActivityPreview';
import { InventoryAnalyticsPage as InventoryAnalytics } from './components/InventoryAnalytics';
import { CategoryManager } from './components/CategoryManager';
import { InventoryMovementTable } from './components/InventoryMovementTable';
import { useInventoryFilters } from './hooks/useInventoryFilters';
import { useInventoryStats } from './hooks/useInventoryStats';
import { useInventoryPagination } from './hooks/useInventoryPagination';
import { useInventoryMovements } from './hooks/useInventoryMovements';
import { Product } from './types';
import { useLocation } from 'react-router-dom';

const { colors, shadows, radius } = EnterpriseTokens;

const ProductsPage = () => {
  const { t } = useI18n();
  const location = useLocation();
  const highlightProductId = location.state?.highlightProductId;
  const { can } = useProductPermissions();
  const {
    products,
    categories,
    fetchProducts,
    fetchCategories,
    deleteProduct,
    adjustStock,
    createProduct,
    updateProduct,
  } = useProductStore();

  // Professional tab system for enterprise inventory management
  type InventoryTab = 'overview' | 'analytics' | 'movements' | 'categories';
  const [activeTab, setActiveTab] = useState<InventoryTab>('overview');

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortField, setSortField] = useState<'name' | 'stock_quantity' | 'selling_price'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const { movements, loading: movementsLoading } = useInventoryMovements(6);
  // Full movements for the Movements tab (professional audit view)
  const { movements: fullMovements, loading: fullMovementsLoading } = useInventoryMovements(500);
  const filteredProductsResult = useInventoryFilters(products, categories);
  const stats = useInventoryStats(products);

  const sortedProducts = useMemo(() => {
    const copy = [...filteredProductsResult.filteredProducts];
    const direction = sortDirection === 'asc' ? 1 : -1;

    return copy.sort((a, b) => {
      if (sortField === 'name') {
        return direction * a.name.localeCompare(b.name);
      }
      return direction * ((a[sortField] ?? 0) - (b[sortField] ?? 0));
    });
  }, [filteredProductsResult.filteredProducts, sortField, sortDirection]);

  const pagination = useInventoryPagination(sortedProducts, 20);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field as 'name' | 'stock_quantity' | 'selling_price');
    setSortDirection('asc');
  }, [sortField]);

  const handleSelectRow = useCallback((id: number, selected: boolean) => {
    setSelectedIds(prev => selected ? [...prev, id] : prev.filter(item => item !== id));
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    setSelectedIds(selected ? pagination.pageItems.map(product => product.id) : []);
  }, [pagination.pageItems]);

  const handleEdit = useCallback((product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  }, []);

  const handleAdjust = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowStockModal(true);
  }, []);

  const handleViewDetails = useCallback((product: Product) => {
    // Professional navigation using React Router
    window.location.href = `/products/${product.id}`;
  }, []);

  // Professional bulk actions for enterprise workflow
  const handleBulkAdjust = useCallback(() => {
    if (selectedIds.length === 0) return;
    // For bulk, open modal with first selected product and note bulk mode
    const firstProduct = products.find(p => p.id === selectedIds[0]);
    if (firstProduct) {
      setSelectedProduct(firstProduct);
      setShowStockModal(true);
    }
  }, [selectedIds, products]);

  const handleBulkArchive = useCallback(async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(t('products.bulkArchiveConfirm', { count: selectedIds.length }))) return;

    const role = useAuthStore.getState().user?.role;
    let successCount = 0;

    for (const id of selectedIds) {
      const ok = await updateProduct(id, { is_available: false }, role);
      if (ok) successCount++;
    }

    setToast({
      type: successCount === selectedIds.length ? 'success' : 'error',
      msg: t('products.bulkArchiveResult', { success: successCount, total: selectedIds.length })
    });
    setSelectedIds([]);
    fetchProducts();
  }, [selectedIds, updateProduct, fetchProducts, t]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(t('products.bulkDeleteConfirm', { count: selectedIds.length }))) return;

    let successCount = 0;
    for (const id of selectedIds) {
      const ok = await deleteProduct(id);
      if (ok) successCount++;
    }

    setToast({
      type: successCount === selectedIds.length ? 'success' : 'error',
      msg: t('products.bulkDeleteResult', { success: successCount, total: selectedIds.length })
    });
    setSelectedIds([]);
    fetchProducts();
  }, [selectedIds, deleteProduct, fetchProducts, t]);

  const handleDuplicate = useCallback(async (product: Product) => {
    const role = useAuthStore.getState().user?.role;
    const duplicate: Partial<Product> = {
      name: `${product.name} Copy`,
      barcode: null,
      category_id: product.category_id,
      buying_price: product.buying_price,
      selling_price: product.selling_price,
      stock_quantity: 0,
      minimum_stock: product.minimum_stock,
      unit: product.unit,
      is_available: true,
      description: product.description,
    };

    const ok = await createProduct(duplicate, role);
    if (ok) {
      setToast({ type: 'success', msg: t('products.createdSuccess', { name: (duplicate.name ?? 'Copy') }) });
      fetchProducts();
    } else {
      setToast({ type: 'error', msg: t('products.failedToCreate') });
    }
  }, [createProduct, fetchProducts, t]);

  const handleArchive = useCallback(async (product: Product) => {
    const role = useAuthStore.getState().user?.role;
    const ok = await updateProduct(product.id, { is_available: false }, role);
    if (ok) {
      setToast({ type: 'success', msg: t('products.deletedSuccess') });
      fetchProducts();
    } else {
      setToast({ type: 'error', msg: t('products.failedToSave') });
    }
  }, [fetchProducts, t, updateProduct]);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm(t('products.deleteConfirm'))) return;
    const ok = await deleteProduct(id);
    if (!ok) setToast({ type: 'error', msg: t('products.failedToDelete') });
    else setToast({ type: 'success', msg: t('products.deletedSuccess') });
    fetchCategories();
    fetchProducts();
  }, [deleteProduct, fetchCategories, fetchProducts, t]);

  const handleStockConfirm = async (qty: number, type: 'addition' | 'subtraction', reason: string) => {
    if (!selectedProduct) return;
    const finalQty = type === 'addition' ? qty : -qty;
    const role = useAuthStore.getState().user?.role;
    const ok = await adjustStock(selectedProduct.id, { quantity: finalQty, type, reason }, role);
    if (!ok) {
      setToast({ type: 'error', msg: t('products.failedToSave') });
    } else {
      setToast({ type: 'success', msg: t('products.savedSuccess', { name: selectedProduct.name }) });
      fetchProducts();
    }
    setShowStockModal(false);
    setSelectedProduct(null);
  };

  const handleExport = useCallback(() => {
    if (sortedProducts.length === 0) return;

    const headers = [
      'SKU / Barcode',
      t('products.productName'),
      t('products.category'),
      t('products.buyPrice'),
      t('products.sellPrice'),
      'Margin %',
      t('products.stock'),
      t('products.unit'),
      'Status',
    ];

    const rows = sortedProducts.map(product => {
      const marginPercent = product.selling_price > 0
        ? ((product.selling_price - product.buying_price) / product.selling_price * 100).toFixed(1)
        : '0.0';
      return [
        product.barcode || 'N/A',
        product.name,
        product.category_name,
        product.buying_price.toFixed(2),
        product.selling_price.toFixed(2),
        `${marginPercent}%`,
        product.stock_quantity,
        product.unit,
        product.stock_quantity <= 0 ? 'Out of stock' : product.stock_quantity <= product.minimum_stock ? 'Low stock' : 'In stock',
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ type: 'success', msg: t('products.exportSuccess') });
  }, [sortedProducts, t]);

  const handleProductSaved = useCallback(async (data: any) => {
    const role = useAuthStore.getState().user?.role;
    try {
      const ok = editingProduct
        ? await updateProduct(editingProduct.id, data, role)
        : await createProduct(data, role);

      if (!ok) {
        setToast({ type: 'error', msg: editingProduct
          ? t('products.failedToSave')
          : t('products.failedToCreate')
        });
        return;
      }
      setToast({ type: 'success', msg: editingProduct
        ? t('products.savedSuccess', { name: data.name })
        : t('products.createdSuccess', { name: data.name })
      });
    } catch (err: any) {
      console.error('[ProductsPage] save error:', err);
      setToast({ type: 'error', msg: err.message || t('common.error') });
    } finally {
      setEditingProduct(null);
      setShowModal(false);
      fetchProducts();
      fetchCategories();
    }
  }, [editingProduct, fetchProducts, fetchCategories, createProduct, updateProduct, t]);

  const pageContent = viewMode === 'grid'
    ? (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
        {pagination.pageItems.map(product => {
          const isHighlighted = highlightProductId === product.id;
          return (
            <article 
              key={product.id} 
              style={{ 
                background: colors.card, 
                border: isHighlighted ? `2px solid ${colors.accent.blue}` : `1px solid ${colors.border}`, 
                borderRadius: radius.xl, 
                padding: '20px', 
                display: 'grid', 
                gap: '16px',
                boxShadow: isHighlighted ? `0 0 0 6px ${colors.accent.blue}15` : 'none',
                transition: 'all 0.2s ease'
              }}
            >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: colors.text1 }}>{product.name}</h2>
                <p style={{ margin: '8px 0 0', color: colors.text3, fontSize: 13 }}>{product.category_name}</p>
              </div>
              <span style={{ padding: '8px 12px', borderRadius: 999, background: product.stock_quantity <= 0 ? colors.accent.redDim : product.stock_quantity <= product.minimum_stock ? colors.accent.amberDim : colors.accent.greenDim, color: product.stock_quantity <= 0 ? colors.accent.red : product.stock_quantity <= product.minimum_stock ? colors.accent.amber : colors.accent.green, fontSize: 12, fontWeight: 700 }}>{product.stock_quantity <= 0 ? 'Out' : product.stock_quantity <= product.minimum_stock ? 'Low' : 'Healthy'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: colors.text3 }}>Cost</p>
                <p style={{ margin: 0, fontWeight: 700, color: colors.text1 }}>${product.buying_price.toFixed(2)}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: colors.text3 }}>Price</p>
                <p style={{ margin: 0, fontWeight: 700, color: colors.text1 }}>${product.selling_price.toFixed(2)}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => handleAdjust(product)} style={{ flex: 1, borderRadius: radius.md, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text2, padding: '12px 0', cursor: 'pointer' }}>{t('products.adjustStock')}</button>
              <button type="button" onClick={() => handleViewDetails(product)} style={{ flex: 1, borderRadius: radius.md, border: 'none', background: colors.accent.blue, color: colors.bg, padding: '12px 0', cursor: 'pointer' }}>View details</button>
            </div>
           </article>
          );
        })}
      </div>
    )
    : (
      <InventoryTable
        products={pagination.pageItems}
        loading={products.length === 0}
        selectedIds={selectedIds}
        onSelectRow={handleSelectRow}
        onSelectAll={handleSelectAll}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onEdit={handleEdit}
        onAdjust={handleAdjust}
        onViewDetails={handleViewDetails}
        onDuplicate={handleDuplicate}
        onArchive={handleArchive}
         onDelete={handleDelete}
         isAdmin={can('product.edit')}
         highlightProductId={highlightProductId}
       />
    );

  // Professional enterprise tab configuration
  const tabs: Array<{ id: InventoryTab; label: string; icon: string }> = [
    { id: 'overview', label: t('products.tabOverview'), icon: '📦' },
    { id: 'analytics', label: t('products.tabAnalytics'), icon: '📊' },
    { id: 'movements', label: t('products.tabMovements'), icon: '📋' },
    { id: 'categories', label: t('products.tabCategories'), icon: '🏷️' },
  ];

  // Render tab content professionally
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            <InventoryStats stats={stats} />

            <InventoryFilters
              categories={categories}
              filters={filteredProductsResult.filters}
              activeFiltersCount={filteredProductsResult.activeFiltersCount}
              onSearchChange={value => filteredProductsResult.updateFilter('search', value)}
              onFilterChange={filteredProductsResult.updateFilter}
              onClearFilters={filteredProductsResult.clearFilters}
            />

            {/* Bulk Action Bar - Enterprise Feature */}
            {selectedIds.length > 0 && (
              <div style={{
                background: colors.accent.blue + '15',
                border: `1px solid ${colors.accent.blue}40`,
                borderRadius: radius.lg,
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                <span style={{ color: colors.text1, fontWeight: 700 }}>
                  {selectedIds.length} {t('products.selected')}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleBulkAdjust} style={{
                    padding: '8px 16px',
                    borderRadius: radius.md,
                    background: colors.accent.amber,
                    border: 'none',
                    color: colors.bg,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}>
                    {t('products.bulkAdjust')}
                  </button>
                  <button onClick={handleBulkArchive} style={{
                    padding: '8px 16px',
                    borderRadius: radius.md,
                    background: colors.accent.gold,
                    border: 'none',
                    color: colors.bg,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}>
                    {t('products.bulkArchive')}
                  </button>
                  <button onClick={handleBulkDelete} style={{
                    padding: '8px 16px',
                    borderRadius: radius.md,
                    background: colors.accent.red,
                    border: 'none',
                    color: colors.bg,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}>
                    {t('products.bulkDelete')}
                  </button>
                  <button onClick={() => setSelectedIds([])} style={{
                    padding: '8px 16px',
                    borderRadius: radius.md,
                    background: 'transparent',
                    border: `1px solid ${colors.border}`,
                    color: colors.text2,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}>
                    {t('common.clear')}
                  </button>
                </div>
              </div>
            )}

            {products.length === 0 ? (
              <EmptyInventoryState onCreate={() => { setEditingProduct(null); setShowModal(true); }} />
            ) : (
              <section style={{ display: 'grid', gap: '20px', background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: '24px' }}>
                {pageContent}
                <InventoryPagination
                  page={pagination.page}
                  pageCount={pagination.pageCount}
                  pageSize={pagination.pageSize}
                  total={pagination.total}
                  hasPrev={pagination.hasPrev}
                  hasNext={pagination.hasNext}
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
                />
              </section>
            )}

            <InventoryActivityPreview movements={movements} loading={movementsLoading} />
          </>
        );

      case 'analytics':
        return <InventoryAnalytics />;

      case 'movements':
        return (
          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: colors.text1 }}>
                {t('products.fullMovementHistory')}
              </h2>
              <span style={{ color: colors.text3, fontSize: '13px' }}>
                {fullMovements.length} {t('products.records')}
              </span>
            </div>
            {fullMovementsLoading ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: colors.text3 }}>
                {t('common.loading')}
              </div>
            ) : (
              <InventoryMovementTable movements={fullMovements} emptyMessage={t('products.noMovements')} />
            )}
          </div>
        );

      case 'categories':
        return <CategoryManager categories={categories} onChanged={fetchCategories} />;

      default:
        return null;
    }
  };

  return (
    <main style={{ background: colors.bg, minHeight: '100vh', padding: '40px 32px' }} className="animate-fade">
      <div style={{ maxWidth: 1600, margin: '0 auto', display: 'grid', gap: '28px' }}>
        <InventoryHeader
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onExport={handleExport}
          onCreate={() => { setEditingProduct(null); setShowModal(true); }}
          activeFiltersCount={filteredProductsResult.activeFiltersCount}
          onClearFilters={filteredProductsResult.clearFilters}
          canCreate={can('product.create')}
        />

        {/* Professional Enterprise Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: `2px solid ${colors.border}`,
          gap: '4px',
          marginBottom: '8px'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '14px 28px',
                background: activeTab === tab.id ? colors.card : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? `3px solid ${colors.accent.gold}` : 'none',
                color: activeTab === tab.id ? colors.text1 : colors.text3,
                fontWeight: activeTab === tab.id ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dynamic Tab Content */}
        {renderTabContent()}
      </div>

      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '14px 24px', borderRadius: 12, fontWeight: 700, fontSize: 14, background: toast.type === 'success' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)', border: `1px solid ${toast.type === 'success' ? colors.accent.green : colors.accent.red}`, color: toast.type === 'success' ? colors.accent.green : colors.accent.red, boxShadow: shadows.hard, maxWidth: 360 }} role="status">
          {toast.msg}
        </div>
      )}

      <ProductModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleProductSaved}
        product={editingProduct}
        categories={categories}
      />

      <StockAdjustmentModal
        isOpen={showStockModal}
        onClose={() => { setShowStockModal(false); setSelectedProduct(null); }}
        product={selectedProduct}
        onConfirm={handleStockConfirm}
      />
    </main>
  );
};

export default ProductsPage;
