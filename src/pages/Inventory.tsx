import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';

interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

const Inventory = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.products.getAll()
      .then(data => {
        // Map products to inventory items
        const inventoryItems = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          quantity: p.stock_quantity,
          price: p.buying_price
        }));
        setItems(inventoryItems);
      })
      .catch(console.error);
  }, []);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-olive-800 mb-2">Inventory Management</h1>
        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="Search inventory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-olive-300 rounded-lg focus:ring-2 focus:ring-gold-400 focus:border-transparent"
          />
          <button className="bg-gold-500 hover:bg-gold-600 text-white px-4 py-2 rounded-lg font-medium">
            Add Item
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-lg border border-olive-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-olive-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-olive-700 uppercase tracking-wider">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-olive-700 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-olive-700 uppercase tracking-wider">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-olive-700 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-olive-700 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-olive-200">
            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-olive-25">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-olive-100 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-lg">📦</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-olive-900">{item.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-olive-600">Beverage</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    item.quantity > 10 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {item.quantity}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-olive-900">
                  ${item.price.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button className="text-gold-600 hover:text-gold-800 mr-3">Edit</button>
                  <button className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Inventory;