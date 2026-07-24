import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api-client';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useI18n } from '../lib/i18n';
import { formatPrice } from '../lib/i18n/currency';

interface Sale {
  id: number;
  total: number;
  created_at: string;
}

// Rafraîchissement automatique toutes les 5 secondes
const AUTO_REFRESH_INTERVAL = 5000;

const Sales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { currency } = useSettingsStore();
  const { lang } = useI18n();

  // Fonction pour charger les ventes
  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.sales.getAll();
      setSales(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales');
      console.error('[Sales] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Chargement initial + rafraîchissement automatique
  useEffect(() => {
    fetchSales();
    
    // Configurer le polling automatique
    const intervalId = setInterval(() => {
      fetchSales();
    }, AUTO_REFRESH_INTERVAL);
    
    // Nettoyage
    return () => clearInterval(intervalId);
  }, [fetchSales]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Sales</h1>
        <button
          onClick={fetchSales}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-300 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <div className="mb-2 text-sm text-gray-500">
        Auto-refresh every {AUTO_REFRESH_INTERVAL / 1000} seconds
      </div>
      
      <table className="w-full bg-white rounded shadow">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Total</th>
            <th className="p-2 text-left">Date</th>
          </tr>
        </thead>
        <tbody>
          {loading && sales.length === 0 ? (
            <tr>
              <td colSpan={3} className="p-4 text-center text-gray-500">
                Loading sales...
              </td>
            </tr>
          ) : sales.length === 0 ? (
            <tr>
              <td colSpan={3} className="p-4 text-center text-gray-500">
                No sales yet
              </td>
            </tr>
          ) : (
            sales.map(sale => (
              <tr key={sale.id} className="border-b hover:bg-gray-50">
                <td className="p-2">{sale.id}</td>
                <td className="p-2">{formatPrice(sale.total, currency, lang)}</td>
                <td className="p-2">{new Date(sale.created_at).toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Sales;