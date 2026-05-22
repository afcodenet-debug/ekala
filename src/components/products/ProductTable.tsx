import React from 'react';
import { Edit2, Trash2, RefreshCw, History } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  barcode?: string;
  category_name?: string;
  image_url?: string;
  stock_quantity: number;
  minimum_stock: number;
  buying_price: number;
  selling_price: number;
  unit: string;
}

function ProductAvatar({ imageUrl, name }: { imageUrl?: string; name: string }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover', background: '#111118' }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: '#111118', border: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#44445a' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.2" /><path d="M21 15l-5-5L5 21" />
      </svg>
    </div>
  );
}

interface ProductTableProps {
  products: Product[];
  isAdmin: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
  onAdjustStock: (product: Product) => void;
  onViewHistory: (product: Product) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({ 
  products, 
  isAdmin, 
  onEdit, 
  onDelete, 
  onAdjustStock, 
  onViewHistory 
}) => {
  return (
    <div className="bg-olive-900 border border-olive-800 rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-olive-950 border-b border-olive-800">
          <tr className="text-xs text-olive-400 uppercase tracking-wider">
            <th className="text-left px-6 py-4">Product</th>
            <th className="text-left px-6 py-4">Category</th>
            <th className="text-center px-6 py-4">Stock</th>
            <th className="text-right px-6 py-4">Price</th>
            <th className="text-center px-6 py-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.length > 0 ? (
            products.map(product => (
              <tr key={product.id} className="border-b border-olive-800 hover:bg-white/5">
                <td className="px-6 py-4">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ProductAvatar imageUrl={product.image_url} name={product.name} />
                    <span className="font-medium">{product.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-olive-400">{product.category_name}</td>
                <td className="px-6 py-4 text-center font-mono">
                  {product.stock_quantity} {product.unit}
                </td>
                <td className="px-6 py-4 text-right text-gold-500">
                  ${product.selling_price.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-center">
                  {isAdmin && (
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => onViewHistory(product)} 
                        className="p-2 text-purple-400 hover:bg-purple-600/20 rounded-lg transition-all"
                        title="View Inventory History"
                      >
                        <History size={16} />
                      </button>
                      <button 
                        onClick={() => onAdjustStock(product)} 
                        className="p-2 text-blue-400 hover:bg-blue-600/20 rounded-lg transition-all"
                        title="Adjust Stock"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button 
                        onClick={() => onEdit(product)} 
                        className="p-2 text-olive-400 hover:bg-olive-700 rounded-lg transition-all"
                        title="Edit Product"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => onDelete(product.id)} 
                        className="p-2 text-red-400 hover:bg-red-600/20 rounded-lg transition-all"
                        title="Delete Product"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-olive-500">
                No products found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProductTable;
