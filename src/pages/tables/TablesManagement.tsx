import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api-client';
import { useNotificationStore } from '../../stores/useNotificationStore';
import { Plus, Edit2, Trash2, User, Table as TableIcon, QrCode, Copy, Download, RefreshCw, X } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

interface Table {
  id: number;
  table_number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  assigned_waiter_id: number | null;
  waiter_name?: string;
  qr_token?: string | null;
}

interface Waiter {
  id: number;
  full_name: string;
}

const TablesManagement = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [qrModalTable, setQrModalTable] = useState<Table | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [formData, setFormData] = useState<{
    table_number: string;
    capacity: number;
    status: Table['status'];
    assigned_waiter_id: number | null;
  }>({
    table_number: '',
    capacity: 4,
    status: 'available',
    assigned_waiter_id: null
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tablesData, usersData] = await Promise.all([
        api.tables.getAll(),
        api.users.getAll()
      ]);
      setTables(tablesData as Table[]);
      setWaiters((usersData as any[]).filter((u: any) => u.role === 'waiter'));
    } catch (error: any) {
      useNotificationStore.getState().addNotification({
        type: 'systemError',
        title: 'Erreur de chargement',
        message: error.message || 'Échec du chargement des données',
        priority: 'high'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTable) {
        await api.tables.update(editingTable.id, formData);
        setShowModal(false);
        setEditingTable(null);
        setFormData({ table_number: '', capacity: 4, status: 'available', assigned_waiter_id: null });
        loadData();
      } else {
        await api.tables.create(formData, 'admin');
        setShowModal(false);
        setEditingTable(null);
        setFormData({ table_number: '', capacity: 4, status: 'available', assigned_waiter_id: null });
        loadData();
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Opération échouée';
      useNotificationStore.getState().addNotification({
        type: 'tableError',
        title: 'Erreur de table',
        message: errorMsg,
        priority: 'high'
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this table?')) return;
    try {
      await api.tables.delete(id, 'admin');
      loadData();
    } catch (error: any) {
      useNotificationStore.getState().addNotification({
        type: 'tableError',
        title: 'Erreur de suppression',
        message: error.message || 'Échec de la suppression de la table',
        priority: 'high'
      });
    }
  };

  const openEdit = (table: Table) => {
    setEditingTable(table);
    setFormData({
      table_number: table.table_number,
      capacity: table.capacity,
      status: table.status,
      assigned_waiter_id: table.assigned_waiter_id
    });
    setShowModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500/10 text-green-500 border border-green-500/20';
      case 'occupied': return 'bg-red-500/10 text-red-500 border border-red-500/20';
      case 'reserved': return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
      case 'cleaning': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  // QR helpers (professional table menu access)
  const getQrUrl = (table: Table) => {
    if (!table.qr_token) return '';
    const base = window.location.origin;
    return `${base}/menu?token=${table.qr_token}`;
  };

  const copyQrLink = async (table: Table) => {
    const url = getQrUrl(table);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      useNotificationStore.getState().addNotification({
        type: 'systemInfo',
        title: 'Lien copié',
        message: 'Le lien a été copié dans le presse-papiers',
        priority: 'low'
      });
    } catch {
      prompt('Copy this link manually:', url);
    }
  };

  const regenerateQr = async (table: Table) => {
    if (!confirm(`Regenerate QR code for Table ${table.table_number}?\n\nThis will immediately invalidate all previously printed or shared QR codes for this table.`)) return;
    try {
      const updated: any = await api.tables.regenerateQr(table.id);
      setTables(prev => prev.map(t => t.id === table.id ? { ...t, qr_token: updated.qr_token } : t));
      setQrModalTable(prev => (prev && prev.id === table.id ? { ...prev, qr_token: updated.qr_token } : prev));
      useNotificationStore.getState().addNotification({
        type: 'systemInfo',
        title: 'QR Code régénéré',
        message: 'Nouveau code QR généré. Les anciens codes sont maintenant invalides.',
        priority: 'medium'
      });
    } catch (e: any) {
      useNotificationStore.getState().addNotification({
        type: 'tableError',
        title: 'Erreur QR',
        message: e?.message || 'Échec de la régénération du QR',
        priority: 'high'
      });
    }
  };

  const downloadQrPng = (table: Table) => {
    const canvas = qrCanvasRef.current;
    if (!canvas) {
      useNotificationStore.getState().addNotification({
        type: 'tableError',
        title: 'Téléchargement',
        message: 'Le téléchargement n\'est pas prêt, veuillez réessayer dans un instant',
        priority: 'medium'
      });
      return;
    }
    const link = document.createElement('a');
    link.download = `table-${table.table_number}-menu-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-gold-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 h-full flex flex-col">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Tables Management</h1>
          <p className="text-olive-500 text-xs font-bold uppercase tracking-widest mt-1">Restaurant floor plan configuration</p>
        </div>
        <button
          onClick={() => { setEditingTable(null); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-gold-600 text-olive-950 rounded-2xl font-black text-sm uppercase shadow-lg hover:bg-gold-500 transition-all"
        >
          <Plus size={18} /> Add Table
        </button>
      </header>

      {/* Tables Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6 flex-1">
        {tables.map(table => (
          <div
            key={table.id}
            className={`group relative bg-olive-900/40 border-2 rounded-3xl p-6 flex flex-col items-center justify-center space-y-3 transition-all hover:scale-105 ${getStatusColor(table.status)}`}
          >
            <button
              onClick={() => setQrModalTable(table)}
              className="absolute top-2 left-2 w-8 h-8 bg-olive-950/80 hover:bg-gold-600 hover:text-olive-950 text-gold-500 rounded-lg flex items-center justify-center transition-all opacity-70 group-hover:opacity-100"
              title="Show QR Code for this table"
            >
              <QrCode size={16} />
            </button>
            <TableIcon size={32} className="text-olive-600" />
            <span className="text-3xl font-black tracking-tighter">{table.table_number}</span>
            <span className="text-[10px] font-black uppercase tracking-wider">Cap: {table.capacity}</span>

            {table.assigned_waiter_id && (
              <div className="flex items-center gap-1 text-xs font-bold text-gold-500 bg-gold-600/10 px-2 py-1 rounded-full">
                <User size={12} />
                {table.waiter_name?.split(' ')[0]}
              </div>
            )}

            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(table)} className="w-8 h-8 bg-olive-800 rounded-lg flex items-center justify-center text-olive-400 hover:text-gold-500">
                <Edit2 size={14} />
              </button>
              <button onClick={() => handleDelete(table.id)} className="w-8 h-8 bg-red-900/30 rounded-lg flex items-center justify-center text-red-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-olive-900 border border-olive-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-black text-white mb-6">
              {editingTable ? 'Edit Table' : 'Add New Table'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-olive-400 mb-1">Table Number *</label>
                <input
                  type="text"
                  required
                  value={formData.table_number}
                  onChange={e => setFormData({ ...formData, table_number: e.target.value })}
                  placeholder="e.g., T1, 1, A1"
                  className="w-full bg-olive-800 border border-olive-700 rounded-xl px-4 py-3 text-white uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-olive-400 mb-1">Capacity</label>
                <input
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) || 4 })}
                  className="w-full bg-olive-800 border border-olive-700 rounded-xl px-4 py-3 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-olive-400 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-olive-800 border border-olive-700 rounded-xl px-4 py-3 text-white"
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                  <option value="cleaning">Cleaning</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-olive-400 mb-1">Assign Waiter</label>
                <select
                  value={formData.assigned_waiter_id || ''}
                  onChange={e => setFormData({ ...formData, assigned_waiter_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full bg-olive-800 border border-olive-700 rounded-xl px-4 py-3 text-white"
                >
                  <option value="">None (unassigned)</option>
                  {waiters.map(w => (
                    <option key={w.id} value={w.id}>{w.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gold-600 text-olive-950 py-3 rounded-xl font-black uppercase tracking-wider hover:bg-gold-500"
                >
                  {editingTable ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 bg-olive-800 text-white rounded-xl font-bold uppercase tracking-wider hover:bg-olive-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
         </div>
       )}

       {/* Professional QR Code Modal */}
       {qrModalTable && qrModalTable.qr_token && (
         <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={() => setQrModalTable(null)}>
           <div
             className="bg-olive-900 border border-olive-700 rounded-3xl p-8 w-full max-w-md shadow-2xl"
             onClick={e => e.stopPropagation()}
           >
             <div className="flex items-center justify-between mb-6">
               <div>
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-gold-600/10 rounded-2xl flex items-center justify-center">
                     <QrCode className="text-gold-500" size={22} />
                   </div>
                   <div>
                     <h2 className="text-2xl font-black text-white tracking-tighter">Table {qrModalTable.table_number}</h2>
                     <p className="text-xs text-olive-400 font-bold uppercase tracking-[3px]">QR MENU ACCESS</p>
                   </div>
                 </div>
               </div>
               <button onClick={() => setQrModalTable(null)} className="w-9 h-9 bg-olive-800 hover:bg-red-900/40 rounded-xl flex items-center justify-center text-olive-400 hover:text-red-400">
                 <X size={18} />
               </button>
             </div>

             {/* Large QR */}
             <div className="flex justify-center bg-white rounded-2xl p-6 mb-6">
               <QRCodeSVG
                 value={getQrUrl(qrModalTable)}
                 size={256}
                 level="M"
                 includeMargin={true}
                 fgColor="#0a2f1f"
                 bgColor="#ffffff"
               />
             </div>

             {/* Hidden canvas for PNG export (must stay mounted while modal open) */}
             <div className="hidden">
               <QRCodeCanvas
                 ref={qrCanvasRef as any}
                 value={getQrUrl(qrModalTable)}
                 size={1024}
                 level="H"
                 includeMargin={true}
                 fgColor="#0a2f1f"
                 bgColor="#ffffff"
               />
             </div>

             <div className="text-center mb-6">
               <div className="text-[10px] font-mono text-olive-500 tracking-[2px] mb-1">SECURE TOKEN</div>
               <div className="font-mono text-sm text-gold-400 break-all select-all">{qrModalTable.qr_token}</div>
             </div>

             <div className="grid grid-cols-2 gap-3">
               <button
                 onClick={() => copyQrLink(qrModalTable)}
                 className="flex items-center justify-center gap-2 px-4 py-3 bg-olive-800 hover:bg-olive-700 rounded-2xl text-white font-bold text-sm"
               >
                 <Copy size={16} /> COPY LINK
               </button>
               <button
                 onClick={() => regenerateQr(qrModalTable)}
                 className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-900/40 hover:bg-amber-900/70 text-amber-400 hover:text-amber-300 rounded-2xl font-bold text-sm"
               >
                 <RefreshCw size={16} /> REGENERATE
               </button>
               <button
                 onClick={() => downloadQrPng(qrModalTable)}
                 className="flex items-center justify-center gap-2 px-4 py-3 bg-olive-800 hover:bg-olive-700 rounded-2xl text-white font-bold text-sm"
               >
                 <Download size={16} /> DOWNLOAD PNG
               </button>
               <button
                 onClick={() => window.open(getQrUrl(qrModalTable), '_blank')}
                 className="flex items-center justify-center gap-2 px-4 py-3 bg-gold-600 hover:bg-gold-500 text-olive-950 rounded-2xl font-black text-sm"
               >
                 OPEN MENU PAGE
               </button>
             </div>

             <div className="mt-6 text-[11px] text-center text-olive-500">
               Anyone who scans this QR (or opens the link) will see the current public menu for this table.
               Regenerating invalidates all previous codes.
             </div>
           </div>
         </div>
       )}
     </div>
   );
 };

export default TablesManagement;