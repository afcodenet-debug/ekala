import React from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../../lib/i18n';

interface DeleteTableModalProps {
  table: any;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const DeleteTableModal: React.FC<DeleteTableModalProps> = ({
  table,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false
}) => {
  const { t } = useI18n();
  if (!isOpen || !table) return null;
  const statusKeyMap: Record<string, string> = {
    available: 'tables.status.available',
    active: 'tables.status.active',
    reserved: 'tables.status.reserved',
    cleaning: 'tables.status.cleaning',
    out_of_service: 'tables.status.outOfService',
  };
  const statusLabel = statusKeyMap[table.status] ? t(statusKeyMap[table.status]) : table.status;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t('tables.deleteTableTitle')}</h2>
              <p className="text-sm text-gray-600">{t('tables.deleteTableConfirm')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 mb-2">{t('tables.deleteTableWarning')}</h3>
                <p className="text-red-700 text-sm">
                  {t('tables.deleteTableMessage', { tableNumber: table.table_number })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-gray-900 mb-2">{t('tables.tableDetails')}</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p><strong>{t('tables.tableNumberLabel')}:</strong> {table.table_number}</p>
              <p><strong>{t('tables.capacityLabel')}:</strong> {table.capacity} {t('tables.seats')}</p>
              <p><strong>{t('tables.statusLabel')}:</strong> {statusLabel}</p>
              {table.waiter_name && <p><strong>{t('tables.assignedWaiter')}:</strong> {table.waiter_name}</p>}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              {t('tables.cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {t('tables.deleteInProgress')}
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  {t('tables.deleteTable')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};