import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Filter, Grid, List } from 'lucide-react';
import { useTableStore, Table } from '../stores/useTableStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useOrderStore } from '../stores/useOrderStore';
import { TableCard } from '../features/tables/components/TableCard';
import { CreateTableModal, EditTableModal } from '../features/tables/components/TableModals';

const Tables: React.FC = () => {
  const { user } = useAuthStore();
  const { tables, isLoading, error, fetchTables, deleteTable, setUserContext } = useTableStore();
  const { activeOrders } = useOrderStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch data on mount
  useEffect(() => {
    if (user) {
      setUserContext(user.id, user.role);
      fetchTables();
    }
  }, [user, fetchTables, setUserContext]);

  // Filter tables based on search and status
  const filteredTables = useMemo(() => {
    return tables.filter(table => {
      const matchesSearch = table.table_number.toString().includes(searchTerm) ||
                          table.waiter_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || table.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tables, searchTerm, statusFilter]);

  // Stats calculations
  const stats = useMemo(() => {
    const total = tables.length;
    const available = tables.filter(t => t.status === 'available').length;
    const active = tables.filter(t => t.status === 'active').length;
    const reserved = tables.filter(t => t.status === 'reserved').length;
    const cleaning = tables.filter(t => t.status === 'cleaning').length;
    const outOfService = tables.filter(t => t.status === 'out_of_service').length;

    return { total, available, active, reserved, cleaning, outOfService };
  }, [tables]);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isWaiter = user?.role === 'waiter';

  // RBAC: admins et managers peuvent faire du CRUD complet
  const canCreate = isAdmin || isManager;
  const canEdit = isAdmin || isManager;
  const canDelete = isAdmin || isManager;
  const canManageStatus = isAdmin || isManager || isWaiter;

  // Tous les rôles peuvent voir les tables (avec filtrage)
  const canView = isAdmin || isManager || isWaiter;

  // Notification helpers
  const showSuccess = (message: string) => {
    setNotification({ type: 'success', message });
    setTimeout(() => setNotification(null), 5000);
  };

  const showError = (message: string) => {
    setNotification({ type: 'error', message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Vérification d'accès
  if (!canView) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const handleDeleteTable = async (tableId: number) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const confirmMessage = `Are you sure you want to delete Table ${table.table_number}?\n\nThis action cannot be undone and will permanently remove the table from the system.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const success = await deleteTable(tableId);
      if (success) {
        showSuccess(`Table ${table.table_number} has been deleted successfully.`);
      } else {
        showError('Failed to delete table. Please try again.');
      }
    } catch (err) {
      showError('An error occurred while deleting the table.');
      console.error('Failed to delete table:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Tables Management
                <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {isAdmin ? 'Admin' : isManager ? 'Manager' : 'Waiter'} Access
                </span>
              </h1>
              <div className="flex flex-wrap gap-2 mt-2">
              {(isAdmin || isManager) && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  Create/Edit/Delete
                </span>
              )}
              {isManager && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  Full Management
                </span>
              )}
                {isWaiter && (
                  <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                    Assigned Tables Only
                  </span>
                )}
              </div>
            </div>

            {canCreate && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium shadow-sm"
              >
                <Plus size={20} />
                Add Table
              </button>
            )}
          </div>

          {/* Permissions Info */}
          <div className={`border rounded-lg p-4 mb-6 ${
            isAdmin ? 'bg-blue-50 border-blue-200' :
            isManager ? 'bg-green-50 border-green-200' :
            'bg-orange-50 border-orange-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${
                isAdmin ? 'bg-blue-500' :
                isManager ? 'bg-green-500' :
                'bg-orange-500'
              }`}></div>
              <span className={`font-medium ${
                isAdmin ? 'text-blue-900' :
                isManager ? 'text-green-900' :
                'text-orange-900'
              }`}>
                {isAdmin ? 'Admin' : isManager ? 'Manager' : 'Waiter'} Permissions
              </span>
            </div>
            <div className={`text-sm ${
              isAdmin ? 'text-blue-700' :
              isManager ? 'text-green-700' :
              'text-orange-700'
            }`}>
              {isAdmin && (
                <ul className="list-disc list-inside space-y-1">
                  <li>Create, edit, and delete tables</li>
                  <li>Manage all table statuses</li>
                  <li>Assign waiters to tables</li>
                  <li>Full system administration</li>
                </ul>
              )}
              {isManager && (
                <ul className="list-disc list-inside space-y-1">
                  <li>Create, edit, and delete tables</li>
                  <li>Manage all table statuses</li>
                  <li>Assign waiters to tables</li>
                  <li>Full operational management</li>
                </ul>
              )}
              {isWaiter && (
                <ul className="list-disc list-inside space-y-1">
                  <li>View only your assigned tables</li>
                  <li>Open tables for service</li>
                  <li>Continue existing orders</li>
                  <li>Close tables after service</li>
                </ul>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              </div>
              <div className="text-sm text-gray-600">Total Tables</div>
              <div className="text-xs text-gray-500 mt-1">System capacity</div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold text-green-700">{stats.available}</div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="text-sm text-green-600">Available</div>
              <div className="text-xs text-green-500 mt-1">Ready for service</div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold text-red-700">{stats.active}</div>
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              </div>
              <div className="text-sm text-red-600">Active</div>
              <div className="text-xs text-red-500 mt-1">In service</div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold text-orange-700">{stats.reserved}</div>
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              </div>
              <div className="text-sm text-orange-600">Reserved</div>
              <div className="text-xs text-orange-500 mt-1">Booked ahead</div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold text-blue-700">{stats.cleaning}</div>
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              </div>
              <div className="text-sm text-blue-600">Cleaning</div>
              <div className="text-xs text-blue-500 mt-1">Post-service</div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold text-gray-700">{stats.outOfService}</div>
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              </div>
              <div className="text-sm text-gray-600">Out of Service</div>
              <div className="text-xs text-gray-500 mt-1">Maintenance</div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder={isWaiter ? "Search your tables..." : "Search tables by number or waiter..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
                  aria-label="Filter tables by status"
                >
                  <option value="all">All Status</option>
                  <option value="available">🟢 Available</option>
                  <option value="active">🔴 Active</option>
                  <option value="reserved">🟠 Reserved</option>
                  <option value="cleaning">🔵 Cleaning</option>
                  <option value="out_of_service">⚫ Out of Service</option>
                </select>

                <div className="flex border border-gray-300 rounded-lg">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-3 rounded-l-lg transition-colors ${
                      viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Grid view"
                  >
                    <Grid size={20} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-3 rounded-r-lg transition-colors ${
                      viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title="List view"
                  >
                    <List size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Search info */}
            {(searchTerm || statusFilter !== 'all') && (
              <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
                <Filter size={14} />
                <span>
                  Showing {filteredTables.length} of {tables.length} tables
                  {searchTerm && ` matching "${searchTerm}"`}
                  {statusFilter !== 'all' && ` with status "${statusFilter}"`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tables Grid */}
        <div className={`grid gap-6 ${
          viewMode === 'grid'
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            : 'grid-cols-1'
        }`}>
          {filteredTables.map(table => (
            <TableCard
              key={table.id}
              table={table}
              onEdit={setEditingTable}
              onDelete={handleDeleteTable}
            />
          ))}
        </div>

        {/* Empty State */}
        {filteredTables.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {searchTerm || statusFilter !== 'all' ? (
                <Search className="w-12 h-12 text-gray-400" />
              ) : (
                <Grid className="w-12 h-12 text-gray-400" />
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' ? 'No tables match your search' : 'No tables found'}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                : isAdmin
                  ? 'Get started by adding your first table to the restaurant layout.'
                  : isManager
                  ? 'Tables will appear here once they are added to the system.'
                  : 'No tables are currently assigned to your account. Contact your manager for table assignments.'
              }
            </p>

            {canCreate && (!searchTerm && statusFilter === 'all') && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
              >
                <Plus size={20} className="inline mr-2" />
                Add Your First Table
              </button>
            )}

            {(searchTerm || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Notifications */}
        {notification && (
          <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 max-w-md ${
            notification.type === 'success'
              ? 'bg-green-100 border border-green-400 text-green-800'
              : 'bg-red-100 border border-red-400 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">{notification.message}</div>
              <button
                onClick={() => setNotification(null)}
                className="ml-2 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg max-w-md">
            <div className="flex items-center gap-2">
              <div className="text-sm">{error}</div>
              <button
                onClick={() => setNotification(null)}
                className="ml-2 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateTableModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(table) => {
          setShowCreateModal(false);
          showSuccess(`Table ${table.table_number} has been created successfully.`);
        }}
      />

      <EditTableModal
        table={editingTable}
        isOpen={!!editingTable}
        onClose={() => setEditingTable(null)}
        onSuccess={(table) => {
          setEditingTable(null);
          showSuccess(`Table ${table.table_number} has been updated successfully.`);
        }}
      />
    </div>
  );
};

export default Tables;