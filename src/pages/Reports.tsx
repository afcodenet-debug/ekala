import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useReportStore } from '../stores/useReportStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useI18n } from '../lib/i18n';
import { formatPrice } from '../lib/i18n/currency';
import { BarChart3, TrendingUp, DollarSign, Package, Calendar, Download } from 'lucide-react';

const ReportsPage = () => {
  const { user } = useAuthStore();
  const { currency } = useSettingsStore();
  const { lang } = useI18n();
  const {
    dailySales,
    weeklySales,
    monthlySales,
    topProducts,
    lowStock,
    loading,
    fetchDailySales,
    fetchWeeklySales,
    fetchMonthlySales,
    fetchTopProducts,
    fetchLowStock
  } = useReportStore();

  const [activeTab, setActiveTab] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailySales(selectedDate);
    } else if (activeTab === 'weekly') {
      const startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - 7);
      fetchWeeklySales(startDate.toISOString().split('T')[0], selectedDate);
    } else if (activeTab === 'monthly') {
      const date = new Date(selectedDate);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      fetchMonthlySales(month.toString(), year.toString());
    } else if (activeTab === 'products') {
      fetchTopProducts();
    } else if (activeTab === 'inventory') {
      fetchLowStock();
    }
  }, [activeTab, selectedDate]);

  const tabs = [
    { id: 'daily', label: 'Daily Sales', icon: Calendar },
    { id: 'weekly', label: 'Weekly Sales', icon: TrendingUp },
    { id: 'monthly', label: 'Monthly Sales', icon: BarChart3 },
    { id: 'products', label: 'Top Products', icon: Package },
    { id: 'inventory', label: 'Low Stock', icon: Package }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Intelligence Reports</h1>
          <p className="text-olive-500 text-sm font-bold uppercase tracking-widest mt-1">
            Business Analytics & Insights
          </p>
        </div>

        <div className="flex gap-4">
          {activeTab !== 'products' && activeTab !== 'inventory' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-olive-900 border border-olive-800 rounded-xl px-4 py-2 text-white"
            />
          )}
          <button className="flex items-center gap-2 bg-gold-600 text-olive-950 px-4 py-2 rounded-xl font-black text-sm">
            <Download size={16} />
            Export
          </button>
        </div>
      </header>

      <div className="flex gap-2 border-b border-olive-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold text-sm transition-all ${
                isActive
                  ? 'bg-gold-600 text-olive-950 border-b-2 border-gold-600'
                  : 'text-olive-400 hover:text-gold-400 hover:bg-olive-900/50'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-olive-500">Loading reports...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'daily' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dailySales.map((report) => (
                  <div key={report.date} className="bg-olive-900/50 border border-olive-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-white">{report.date}</h3>
                      <DollarSign className="text-gold-500" size={20} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-2xl font-black text-gold-500">{formatPrice(report.total_amount, currency, lang)}</p>
                      <p className="text-sm text-olive-400">{report.transaction_count} transactions</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'weekly' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {weeklySales.map((report) => (
                  <div key={report.date} className="bg-olive-900/50 border border-olive-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-white">Week of {report.date}</h3>
                      <TrendingUp className="text-gold-500" size={20} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-2xl font-black text-gold-500">{formatPrice(report.total_amount, currency, lang)}</p>
                      <p className="text-sm text-olive-400">{report.transaction_count} transactions</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'monthly' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {monthlySales.map((report) => (
                  <div key={report.date} className="bg-olive-900/50 border border-olive-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-white">{report.date}</h3>
                      <BarChart3 className="text-gold-500" size={20} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-2xl font-black text-gold-500">{formatPrice(report.total_amount, currency, lang)}</p>
                      <p className="text-sm text-olive-400">{report.transaction_count} transactions</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'products' && (
              <div className="bg-olive-900/50 border border-olive-800 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-olive-800">
                  <h3 className="text-xl font-black text-white">Top Selling Products</h3>
                </div>
                <div className="divide-y divide-olive-800">
                  {topProducts.map((product, index) => (
                    <div key={product.product_id} className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-gold-600/20 flex items-center justify-center text-gold-500 font-black">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-bold text-white">{product.product_name}</p>
                          <p className="text-sm text-olive-400">{product.quantity_sold} units sold</p>
                        </div>
                      </div>
                      <p className="text-lg font-black text-gold-500">{formatPrice(product.revenue, currency, lang)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="bg-olive-900/50 border border-olive-800 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-olive-800">
                  <h3 className="text-xl font-black text-white">Low Stock Alert</h3>
                  <p className="text-sm text-olive-400">Products below minimum stock level</p>
                </div>
                <div className="divide-y divide-olive-800">
                  {lowStock.map((product) => (
                    <div key={product.id} className="p-6 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white">{product.name}</p>
                        <p className="text-sm text-red-400">Current: {product.stock_quantity} | Min: {product.minimum_stock}</p>
                      </div>
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;