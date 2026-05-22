import { useEffect } from 'react';
import { useOrdersStore } from '../shared/ordersStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useI18n } from '../lib/i18n';
import { formatPrice } from '../lib/i18n/currency';
import { Eye, Edit2, Clock } from 'lucide-react';

const Orders = () => {
  const { orders, fetchOrders } = useOrdersStore();
  const { currency } = useSettingsStore();
  const { lang, t } = useI18n();

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'confirmed':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'preparing':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'ready':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'served':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'paid':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const localeMap: Record<string, string> = {
    en: 'en-US',
    fr: 'fr-FR',
    pt: 'pt-PT',
  };

  const timeLocale = localeMap[lang] ?? 'en-US';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
           <h1 className="text-3xl font-light tracking-[-1.5px] text-white">{t('orders.title')}</h1>
           <p className="text-olive-400 mt-1">{t('orders.subtitle')}</p>
        </div>
        <div className="px-5 py-2 bg-[#111118] border border-white/10 rounded-2xl text-sm text-olive-400">
          {t('orders.countToday', { count: orders.length })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111118] border border-white/10 rounded-3xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 text-xs text-olive-400 uppercase tracking-wider">
              <th className="px-8 py-5 text-left font-medium">{t('orders.order')}</th>
              <th className="px-8 py-5 text-left font-medium">{t('orders.table')}</th>
              <th className="px-8 py-5 text-left font-medium">{t('common.status')}</th>
              <th className="px-8 py-5 text-right font-medium">{t('common.total')}</th>
              <th className="px-8 py-5 text-left font-medium">{t('common.time')}</th>
              <th className="px-8 py-5 text-right font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {orders.length > 0 ? (
              orders.map(order => (
                <tr key={order.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="font-mono text-sm text-white">#{order.id}</div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="font-medium text-white">{t('orders.table')} {order.table_id}</div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-medium border ${getStatusStyle(order.status)}`}>
                      {t(`orders.status.${order.status}`)}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="font-semibold text-white">{formatPrice(order.total, currency, lang)}</div>
                  </td>
                  <td className="px-8 py-5 text-sm text-olive-400">
                    {new Date(order.created_at).toLocaleTimeString(timeLocale, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-olive-400 hover:text-white transition-all">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-olive-400 hover:text-white transition-all">
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-8 py-20 text-center">
                  <div className="text-olive-500">
                    <Clock className="mx-auto mb-4" size={40} />
                    <p className="text-sm">{t('orders.noOrders')}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Orders;