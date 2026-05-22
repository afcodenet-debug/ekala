import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useI18n } from '../lib/i18n';
import { formatPrice } from '../lib/i18n/currency';

interface Sale {
  id: number;
  total: number;
  created_at: string;
}

const Sales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const { currency } = useSettingsStore();
  const { lang } = useI18n();

  useEffect(() => {
    api.sales.getAll().then(setSales);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Sales</h1>
      <table className="w-full bg-white rounded shadow">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Total</th>
            <th className="p-2 text-left">Date</th>
          </tr>
        </thead>
        <tbody>
          {sales.map(sale => (
            <tr key={sale.id} className="border-b">
              <td className="p-2">{sale.id}</td>
              <td className="p-2">{formatPrice(sale.total, currency, lang)}</td>
              <td className="p-2">{new Date(sale.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Sales;