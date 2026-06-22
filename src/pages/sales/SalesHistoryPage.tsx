import { useEffect, useState } from 'react';
import { api } from '../../lib/api-client';

interface Sale {
  id: number;
  invoice_number: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  customer_name?: string;
  items?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

const SalesHistoryPage = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    api.sales.getAll()
      .then((data: any) => {
        setSales(data as Sale[]);
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to fetch sales:', error);
        setLoading(false);
      });
  }, []);

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSale(null);
  };

  const handlePrint = async (saleId: number) => {
    try {
      const receipt = await api.sales.getReceipt(saleId);
      await printReceipt(receipt);
    } catch (error) {
      console.error('Failed to print receipt:', error);
      alert('Failed to print receipt. Please try again.');
    }
  };

  const printReceipt = async (receipt: any) => {
    try {
      const electronWindow = window as any;
      if (electronWindow.electronAPI?.printReceipt) {
        const result = await electronWindow.electronAPI.printReceipt(receipt);
        if (result && !result.success) {
          throw new Error(result.error || 'Unknown printing error');
        }
      } else {
        const receiptHTML = generateReceiptHTML(receipt);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(receiptHTML);
          printWindow.document.close();
          printWindow.print();
        }
      }
    } catch (error: any) {
      console.error('Printing failed:', error);
      alert(`Receipt printing failed: ${error.message}`);
    }
  };

  const generateReceiptHTML = (receipt: any) => {
    return `
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 300px; margin: 0 auto; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 2px 0; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="center bold">${receipt.business.name}</div>
          <div class="center">${receipt.business.address}</div>
          <div class="center">${receipt.business.phone}</div>
          <div class="line"></div>

          <div><strong>Invoice:</strong> ${receipt.invoice.number}</div>
          <div><strong>Date:</strong> ${receipt.invoice.date}</div>
          <div><strong>Table:</strong> ${receipt.invoice.table}</div>
          <div><strong>Waiter:</strong> ${receipt.invoice.waiter}</div>
          <div><strong>Cashier:</strong> ${receipt.invoice.cashier}</div>
          <div class="line"></div>

          <table>
            <thead>
              <tr>
                <td class="bold">Item</td>
                <td class="bold right">Qty</td>
                <td class="bold right">Price</td>
                <td class="bold right">Total</td>
              </tr>
            </thead>
            <tbody>
              ${receipt.items.map((item: any) => `
                <tr>
                  <td>${item.name}</td>
                  <td class="right">${item.quantity}</td>
                  <td class="right">${item.unitPrice.toFixed(2)}</td>
                  <td class="right">${item.totalPrice.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="line"></div>

          <div><strong>Subtotal:</strong> <span class="right">${receipt.totals.subtotal.toFixed(2)}</span></div>
          ${receipt.totals.discount > 0 ? `<div><strong>Discount:</strong> <span class="right">${receipt.totals.discount.toFixed(2)}</span></div>` : ''}
          <div><strong>Tax:</strong> <span class="right">${receipt.totals.tax.toFixed(2)}</span></div>
          <div class="bold"><strong>Total:</strong> <span class="right">${receipt.totals.total.toFixed(2)}</span></div>
          <div class="line"></div>

          <div><strong>Payment:</strong> ${receipt.payment.method.toUpperCase()}</div>
          <div><strong>Amount Paid:</strong> ${receipt.payment.amount.toFixed(2)}</div>
          <div class="line"></div>

          <div class="center">${receipt.footer.replace('\n', '<br>')}</div>
        </body>
      </html>
    `;
  };

  if (loading) {
    return <div className="text-center py-8">Loading sales history...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-olive-800 mb-2">Sales History</h1>
        <p className="text-olive-600">View all completed sales transactions</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-olive-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-olive-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-olive-700 uppercase tracking-wider">
                Invoice
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-olive-700 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-olive-700 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-olive-700 uppercase tracking-wider">
                Payment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-olive-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-olive-200">
            {sales.map(sale => (
              <tr key={sale.id} className="hover:bg-olive-25">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-olive-900">
                  {sale.invoice_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-olive-600">
                  {new Date(sale.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-olive-900">
                  ${sale.total_amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-olive-600">
                  {sale.payment_method}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    onClick={() => handleViewDetails(sale)}
                    className="text-gold-600 hover:text-gold-800 mr-3"
                  >
                    View
                  </button>
                  <button 
                    onClick={() => handlePrint(sale.id)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal pour afficher les détails de la vente */}
      {isModalOpen && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-olive-800">Sale Details</h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Invoice Number</p>
                    <p className="font-medium">{selectedSale.invoice_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="font-medium">{new Date(selectedSale.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Payment Method</p>
                    <p className="font-medium">{selectedSale.payment_method}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="font-medium text-lg">${selectedSale.total_amount.toFixed(2)}</p>
                  </div>
                </div>

                {selectedSale.items && selectedSale.items.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Items</h3>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Item</th>
                          <th className="text-right py-2">Qty</th>
                          <th className="text-right py-2">Price</th>
                          <th className="text-right py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSale.items.map((item, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="py-2">{item.name}</td>
                            <td className="text-right py-2">{item.quantity}</td>
                            <td className="text-right py-2">${item.unitPrice.toFixed(2)}</td>
                            <td className="text-right py-2">${item.totalPrice.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-olive-600 text-white rounded-lg hover:bg-olive-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistoryPage;
