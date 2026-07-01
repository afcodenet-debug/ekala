import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Ban, CheckCircle, Eye, ChevronLeft, ChevronRight, Building2,
  MoreVertical, Users, FileText, Trash2, Edit, Mail, Plus, X, Loader2,
  Globe, MapPin, UserPlus, Sparkles, Shield, Zap, AlertCircle
} from 'lucide-react';
import { api } from '../../lib/api-client';

interface Tenant {
  id: number;
  name: string;
  slug: string | null;
  owner_email: string;
  country: string;
  city: string | null;
  status: string;
  plan_code: string | null;
  is_provisioned: boolean;
  created_at: string;
  updated_at: string;
  subscription_status: string | null;
  subscription_ends_at: string | null;
  users_count: number;
  sync_status?: string;
}

const styles = `
  .tenants-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }
  .tenants-title {
    font-size: 24px;
    font-weight: 800;
    color: #e8e8f2;
    letter-spacing: -0.02em;
  }
  .tenants-subtitle {
    font-size: 13px;
    color: #6a6a80;
    margin-top: 4px;
  }
  .tenants-filters {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .tenants-search {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
  }
  .tenants-search-icon {
    width: 18px;
    height: 18px;
    color: #6a6a80;
    flex-shrink: 0;
  }
  .tenants-search-input {
    background: transparent;
    border: none;
    outline: none;
    color: #e8e8f2;
    font-size: 13px;
    width: 100%;
  }
  .tenants-search-input::placeholder {
    color: #6a6a80;
  }
  .tenants-filter-select {
    padding: 10px 14px;
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    color: #e8e8f2;
    font-size: 13px;
    min-width: 140px;
    cursor: pointer;
  }
  .tenants-table-container {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    overflow: hidden;
  }
  .tenants-table {
    width: 100%;
    border-collapse: collapse;
  }
  .tenants-table th {
    padding: 12px 16px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #6a6a80;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: rgba(255,255,255,0.02);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .tenants-table td {
    padding: 14px 16px;
    font-size: 13px;
    color: #e8e8f2;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .tenants-table tr:hover td {
    background: rgba(255,255,255,0.02);
  }
  .tenant-name-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .tenant-avatar {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
  }
  .tenant-name {
    font-weight: 600;
    color: #e8e8f2;
  }
  .tenant-slug {
    font-size: 11px;
    color: #6a6a80;
  }
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }
  .status-badge.active {
    background: rgba(34,197,94,0.15);
    color: #22c55e;
  }
  .status-badge.suspended {
    background: rgba(239,68,68,0.15);
    color: #ef4444;
  }
  .status-badge.trial {
    background: rgba(245,158,11,0.15);
    color: #f59e0b;
  }
  .status-badge.cancelled {
    background: rgba(107,114,128,0.15);
    color: #9ca3af;
  }
  .action-btn {
    width: 32px;
    height: 32px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    border-radius: 6px;
    color: #a0a0b8;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 140ms;
  }
  .action-btn:hover {
    background: rgba(255,255,255,0.06);
    color: #e8e8f2;
  }
  .action-btn.danger:hover {
    background: rgba(239,68,68,0.1);
    border-color: rgba(239,68,68,0.3);
    color: #ef4444;
  }
  .action-btn.success:hover {
    background: rgba(34,197,94,0.1);
    border-color: rgba(34,197,94,0.3);
    color: #22c55e;
  }
  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .pagination-info {
    font-size: 12px;
    color: #6a6a80;
  }
  .pagination-buttons {
    display: flex;
    gap: 8px;
  }
  .pagination-btn {
    padding: 6px 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    color: #a0a0b8;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 140ms;
  }
  .pagination-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.06);
    color: #e8e8f2;
  }
  .pagination-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    color: #a0a0b8;
    font-size: 13px;
    cursor: pointer;
    transition: all 140ms;
    text-align: left;
  }
  .dropdown-item:hover {
    background: rgba(255,255,255,0.06);
    color: #e8e8f2;
  }
  .dropdown-item.success:hover {
    background: rgba(34,197,94,0.1);
    color: #22c55e;
  }
  .dropdown-item.warning:hover {
    background: rgba(245,158,11,0.1);
    color: #f59e0b;
  }
  .dropdown-item.danger:hover {
    background: rgba(239,68,68,0.1);
    color: #ef4444;
  }
  .sync-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }
  .sync-badge.syncing {
    background: rgba(59,130,246,0.15);
    color: #3b82f6;
  }
  .sync-badge.error {
    background: rgba(239,68,68,0.15);
    color: #ef4444;
  }
  .sync-badge.success {
    background: rgba(34,197,94,0.15);
    color: #22c55e;
  }
  .sync-badge.idle {
    background: rgba(107,114,128,0.15);
    color: #9ca3af;
  }
  .loading-spinner {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid rgba(255,255,255,0.1);
    border-top-color: #3b82f6;
    animation: spin 0.8s linear infinite;
    margin: 60px auto;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .empty-state {
    text-align: center;
    padding: 60px 24px;
    color: #6a6a80;
  }

  /* Modern Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 200ms ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .modal-container {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 32px;
    width: 90%;
    max-width: 560px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05) inset;
    animation: slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to { 
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .modal-title-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .modal-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);
  }
  .modal-title {
    font-size: 20px;
    font-weight: 700;
    color: #e8e8f2;
    margin: 0;
  }
  .modal-subtitle {
    font-size: 12px;
    color: #6a6a80;
    margin-top: 2px;
  }
  .modal-close {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    color: #a0a0b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 140ms;
  }
  .modal-close:hover {
    background: rgba(239,68,68,0.1);
    border-color: rgba(239,68,68,0.3);
    color: #ef4444;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-group.full-width {
    grid-column: 1 / -1;
  }
  .form-label {
    font-size: 12px;
    font-weight: 600;
    color: #a0a0b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .form-label .required {
    color: #ef4444;
  }
  .form-input {
    padding: 10px 14px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    color: #e8e8f2;
    font-size: 13px;
    transition: all 140ms;
    outline: none;
  }
  .form-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  .form-input::placeholder {
    color: #6a6a80;
  }
  .form-select {
    padding: 10px 14px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    color: #e8e8f2;
    font-size: 13px;
    cursor: pointer;
    outline: none;
    transition: all 140ms;
  }
  .form-select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  .form-hint {
    font-size: 11px;
    color: #6a6a80;
    font-style: italic;
  }
  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.08);
  }
  .btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 140ms;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: none;
  }
  .btn-secondary {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    color: #a0a0b8;
  }
  .btn-secondary:hover {
    background: rgba(255,255,255,0.06);
    color: #e8e8f2;
  }
  .btn-primary {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: #fff;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }
  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  .btn-icon {
    width: 16px;
    height: 16px;
  }
  .add-tenant-btn {
    padding: 10px 20px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 140ms;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }
  .add-tenant-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
  }
  .error-message {
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.3);
    color: #ef4444;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .success-message {
    background: rgba(34,197,94,0.1);
    border: 1px solid rgba(34,197,94,0.3);
    color: #22c55e;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Toast Styles */
  .toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 400px;
  }
  .toast {
    background: linear-gradient(145deg, #1a1a24, #16161e);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    padding: 18px;
    box-shadow: 
      0 0 0 1px rgba(0,0,0,0.3),
      0 12px 32px rgba(0,0,0,0.5),
      0 4px 12px rgba(0,0,0,0.3);
    animation: toast-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    align-items: flex-start;
    gap: 14px;
    position: relative;
    overflow: hidden;
  }
  .toast::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  }
  @keyframes toast-slide-in {
    from {
      opacity: 0;
      transform: translateX(100px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .toast.success {
    border-left: 3px solid #22c55e;
  }
  .toast.error {
    border-left: 3px solid #ef4444;
  }
  .toast.info {
    border-left: 3px solid #3b82f6;
  }
  .toast-icon {
    flex-shrink: 0;
    margin-top: 2px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .toast-content {
    flex: 1;
    min-width: 0;
  }
  .toast-title {
    font-size: 14px;
    font-weight: 800;
    color: #e8e8f2;
    margin-bottom: 4px;
    letter-spacing: -0.01em;
  }
  .toast-message {
    font-size: 13px;
    color: #a0a0b8;
    line-height: 1.5;
  }
  .toast-close {
    flex-shrink: 0;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    color: #6a6a80;
    cursor: pointer;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 200ms;
  }
  .toast-close:hover {
    background: rgba(255,255,255,0.1);
    color: #e8e8f2;
    border-color: rgba(255,255,255,0.15);
    transform: scale(1.05);
  }
  .modal-container-small {
    max-width: 420px;
  }
  .modal-icon-warning {
    background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05));
    box-shadow: 0 0 24px rgba(245,158,11,0.2);
  }
  .modal-message {
    font-size: 14px;
    color: #a0a0b8;
    margin-bottom: 24px;
    line-height: 1.6;
  }
  .btn-warning {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #fff;
    box-shadow: 0 4px 16px rgba(245,158,11,0.3);
  }
  .btn-warning:hover {
    background: linear-gradient(135deg, #d97706, #b45309);
    box-shadow: 0 6px 20px rgba(245,158,11,0.4);
    transform: translateY(-2px);
  }
`;

const TenantsPage = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'info'; title: string; message: string }>>([]);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; title: string; message: string; onConfirm: () => void }>({ show: false, title: '', message: '', onConfirm: () => {} });

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    owner_email: '',
    phone: '',
    country: '',
    city: '',
    plan_id: '',
  });

  useEffect(() => {
    loadTenants();
  }, [page, statusFilter]);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 50,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      };

      const data = await api.platform.getTenants(params);
      if (data.success && Array.isArray(data.tenants)) {
        setTenants(data.tenants);
        setTotalPages(data.pagination?.pages || 0);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error: any) {
      console.error('Failed to load tenants:', error);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  const addToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadTenants();
  };

  const toggleMenu = (tenantId: number, event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
    setOpenMenuId(openMenuId === tenantId ? null : tenantId);
  };

  const handleEdit = (tenantId: number) => {
    navigate(`/platform/tenants/${tenantId}/edit`);
  };

  const handleViewUsers = (tenantId: number) => {
    navigate(`/platform/tenants/${tenantId}?tab=users`);
  };

  const handleViewLogs = (tenantId: number) => {
    navigate(`/platform/audit-logs?tenant_id=${tenantId}`);
  };

  const handleSendEmail = (tenantId: number) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant?.owner_email) {
      window.open(`mailto:${tenant.owner_email}`, '_blank');
    }
  };

  const handleSuspend = async (tenantId: number) => {
    const tenant = tenants.find(t => t.id === tenantId);
    setConfirmModal({
      show: true,
      title: 'Suspendre le tenant',
      message: `Êtes-vous sûr de vouloir suspendre ${tenant?.name} ? Cette action peut être annulée ultérieurement.`,
      onConfirm: async () => {
        setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} });
        try {
          const reason = prompt('Raison de la suspension:') || 'Suspendu par l\'administrateur';
          const data = await api.platform.suspendTenant(tenantId, reason) as any;
          if (data?.success) {
            addToast('success', 'Tenant suspendu', `${tenant?.name} a été suspendu avec succès`);
            loadTenants();
          } else {
            addToast('error', 'Erreur', data?.message || 'Erreur lors de la suspension');
          }
        } catch (error: any) {
          console.error('Failed to suspend tenant:', error);
          addToast('error', 'Erreur', error.message || 'Erreur lors de la suspension');
        }
      }
    });
  };

  const handleActivate = async (tenantId: number) => {
    const tenant = tenants.find(t => t.id === tenantId);
    setConfirmModal({
      show: true,
      title: 'Réactiver le tenant',
      message: `Êtes-vous sûr de vouloir réactiver ${tenant?.name} ?`,
      onConfirm: async () => {
        setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} });
        try {
          const data = await api.platform.activateTenant(tenantId) as any;
          if (data?.success) {
            addToast('success', 'Tenant réactivé', `${tenant?.name} a été réactivé avec succès`);
            loadTenants();
          } else {
            addToast('error', 'Erreur', data?.message || 'Erreur lors de la réactivation');
          }
        } catch (error: any) {
          console.error('Failed to activate tenant:', error);
          addToast('error', 'Erreur', error.message || 'Erreur lors de la réactivation');
        }
      }
    });
  };

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    if (openMenuId === null) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Vérifier si le clic est en dehors du menu et du bouton qui l'a ouvert
      const isMenuClick = target.closest('[data-menu-dropdown]');
      const isButtonClick = target.closest('[data-menu-button]');
      
      if (!isMenuClick && !isButtonClick) {
        setOpenMenuId(null);
      }
    };

    // Ajouter un délai plus long pour éviter que le clic qui ouvre le menu ne le ferme immédiatement
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openMenuId]);

  const handleDelete = async (tenantId: number) => {
    const tenant = tenants.find(t => t.id === tenantId);
    setConfirmModal({
      show: true,
      title: 'Supprimer le tenant',
      message: `ATTENTION: Cette action est irréversible.\n\nÊtes-vous absolument certain de vouloir supprimer ${tenant?.name} ?`,
      onConfirm: async () => {
        setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} });
        try {
          // TODO: Implémenter deleteTenant dans l'API backend
          addToast('info', 'Fonctionnalité à venir', 'La suppression de tenant sera bientôt disponible');
          setOpenMenuId(null);
        } catch (error: any) {
          console.error('Failed to delete tenant:', error);
          addToast('error', 'Erreur', error.message || 'Erreur lors de la suppression');
        }
      }
    });
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active': return 'active';
      case 'suspended': return 'suspended';
      case 'trial': return 'trial';
      case 'cancelled': return 'cancelled';
      default: return '';
    }
  };

  const getToastIcon = (type: 'success' | 'error' | 'info') => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} color="#22c55e" />;
      case 'error':
        return <AlertCircle size={20} color="#ef4444" />;
      case 'info':
        return <AlertCircle size={20} color="#3b82f6" />;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const data = await api.platform.createTenant({
        name: formData.name,
        slug: formData.slug || generateSlug(formData.name),
        owner_email: formData.owner_email,
        phone: formData.phone,
        country: formData.country,
        city: formData.city,
        plan_id: formData.plan_id ? parseInt(formData.plan_id) : undefined,
      });

      if (data?.success) {
        setSuccess('Tenant créé avec succès !');
        setShowAddModal(false);
        setFormData({
          name: '',
          slug: '',
          owner_email: '',
          phone: '',
          country: '',
          city: '',
          plan_id: '',
        });
        loadTenants();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Erreur lors de la création du tenant');
      }
    } catch (error: any) {
      console.error('Failed to create tenant:', error);
      setError(error.message || 'Erreur lors de la création du tenant');
    } finally {
      setSubmitting(false);
    }
  };

  const openAddModal = () => {
    setError(null);
    setSuccess(null);
    setFormData({
      name: '',
      slug: '',
      owner_email: '',
      phone: '',
      country: '',
      city: '',
      plan_id: '',
    });
    setShowAddModal(true);
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div>
      <style>{styles}</style>

      <div className="tenants-header">
        <div>
          <h1 className="tenants-title">Gestion des Tenants</h1>
          <p className="tenants-subtitle">{total} tenants au total</p>
        </div>
        <button className="add-tenant-btn" onClick={openAddModal}>
          <Plus size={18} />
          Nouveau Tenant
        </button>
      </div>

      {error && (
        <div className="error-message">
          <Sparkles size={16} />
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {/* Filters */}
      <form className="tenants-filters" onSubmit={handleSearch}>
        <div className="tenants-search">
          <Search size={18} className="tenants-search-icon" />
          <input
            type="text"
            className="tenants-search-input"
            placeholder="Rechercher par nom, email ou slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="tenants-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="suspended">Suspendu</option>
          <option value="trial">Essai</option>
          <option value="cancelled">Annulé</option>
        </select>
      </form>

      {/* Table */}
      <div className="tenants-table-container">
        <table className="tenants-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Statut</th>
              <th>Plan</th>
              <th>Utilisateurs</th>
              <th>Date création</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <Building2 size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Aucun tenant trouvé</p>
                    <p style={{ fontSize: 12 }}>Commencez par créer votre premier tenant</p>
                  </div>
                </td>
              </tr>
            ) : (
              tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <div className="tenant-name-cell">
                      <div className="tenant-avatar">
                        {tenant.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="tenant-name">{tenant.name}</div>
                        <div className="tenant-slug">{tenant.slug || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusClass(tenant.status)}`}>
                      {tenant.status === 'active' && <CheckCircle size={12} />}
                      {tenant.status === 'suspended' && <Ban size={12} />}
                      {tenant.status}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: '#a0a0b8' }}>
                      {tenant.plan_code || '—'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: '#a0a0b8' }}>
                      {tenant.users_count}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: '#a0a0b8' }}>
                      {new Date(tenant.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        className="action-btn"
                        onClick={() => handleViewUsers(tenant.id)}
                        title="Voir les utilisateurs"
                      >
                        <Users size={16} />
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => handleEdit(tenant.id)}
                        title="Modifier"
                      >
                        <Edit size={16} />
                      </button>
                        <div style={{ position: 'relative' }}>
                        <button
                          className="action-btn"
                          data-menu-button={tenant.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMenu(tenant.id, e);
                          }}
                          title="Plus d'actions"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === tenant.id && menuPosition && (
                          <div
                            data-menu-dropdown={tenant.id}
                            style={{
                              position: 'fixed',
                              top: `${menuPosition.top}px`,
                              right: `${menuPosition.right}px`,
                              background: '#1a1a2e',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: 8,
                              minWidth: 180,
                              zIndex: 99999,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                            }}
                          >
                            <button className="dropdown-item" onClick={() => handleViewLogs(tenant.id)}>
                              <FileText size={14} />
                              Voir les logs
                            </button>
                            <button className="dropdown-item" onClick={() => handleSendEmail(tenant.id)}>
                              <Mail size={14} />
                              Envoyer un email
                            </button>
                            {tenant.status === 'active' ? (
                              <button
                                className="dropdown-item warning"
                                onClick={() => {
                                  handleSuspend(tenant.id);
                                  setOpenMenuId(null);
                                }}
                              >
                                <Ban size={14} />
                                Suspendre
                              </button>
                            ) : (
                              <button
                                className="dropdown-item success"
                                onClick={() => {
                                  handleActivate(tenant.id);
                                  setOpenMenuId(null);
                                }}
                              >
                                <CheckCircle size={14} />
                                Réactiver
                              </button>
                            )}
                            <button
                              className="dropdown-item danger"
                              onClick={() => {
                                handleDelete(tenant.id);
                                setOpenMenuId(null);
                              }}
                            >
                              <Trash2 size={14} />
                              Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-info">
            Page {page} sur {totalPages} • {total} tenants
          </div>
          <div className="pagination-buttons">
            <button
              className="pagination-btn"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="pagination-btn"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              <div className="toast-icon">
                {getToastIcon(toast.type)}
              </div>
              <div className="toast-content">
                <div className="toast-title">{toast.title}</div>
                <div className="toast-message">{toast.message}</div>
              </div>
              <button
                className="toast-close"
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="modal-overlay" onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} })}>
          <div className="modal-container modal-container-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-section">
                <div className="modal-icon modal-icon-warning">
                  <AlertCircle size={20} color="#f59e0b" />
                </div>
                <div>
                  <h2 className="modal-title">{confirmModal.title}</h2>
                  <p className="modal-subtitle">Confirmation requise</p>
                </div>
              </div>
            </div>

            <div className="modal-message">
              {confirmModal.message.split('\n').map((line, i) => (
                <p key={i} style={{ marginBottom: line === '' ? 12 : 8 }}>{line}</p>
              ))}
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} })}
              >
                Annuler
              </button>
              <button
                className="btn btn-warning"
                onClick={confirmModal.onConfirm}
              >
                <AlertCircle size={16} className="btn-icon" />
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tenant Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-section">
                <div className="modal-icon">
                  <Building2 size={20} color="#fff" />
                </div>
                <div>
                  <h2 className="modal-title">Nouveau Tenant</h2>
                  <p className="modal-subtitle">Créez un nouveau tenant sur la plateforme</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {error && (
                <div className="error-message">
                  <Sparkles size={16} />
                  {error}
                </div>
              )}

              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">
                    <Building2 size={14} />
                    Nom du tenant <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    placeholder="Ex: Mon Restaurant"
                    value={formData.name}
                    onChange={handleNameChange}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">
                    <Globe size={14} />
                    Slug (URL)
                  </label>
                  <input
                    type="text"
                    name="slug"
                    className="form-input"
                    placeholder="mon-restaurant"
                    value={formData.slug}
                    onChange={handleInputChange}
                  />
                  <span className="form-hint">Généré automatiquement si vide</span>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Mail size={14} />
                    Email propriétaire <span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    name="owner_email"
                    className="form-input"
                    placeholder="owner@restaurant.com"
                    value={formData.owner_email}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <MapPin size={14} />
                    Pays
                  </label>
                  <input
                    type="text"
                    name="country"
                    className="form-input"
                    placeholder="FR"
                    value={formData.country}
                    onChange={handleInputChange}
                    maxLength={2}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <MapPin size={14} />
                    Ville
                  </label>
                  <input
                    type="text"
                    name="city"
                    className="form-input"
                    placeholder="Paris"
                    value={formData.city}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Shield size={14} />
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    className="form-input"
                    placeholder="+33 6 12 34 56 78"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Zap size={14} />
                    Plan initial
                  </label>
                  <select
                    name="plan_id"
                    className="form-select"
                    value={formData.plan_id}
                    onChange={handleInputChange}
                  >
                    <option value="">Aucun plan</option>
                    <option value="1">STARTER_WEEKLY</option>
                    <option value="2">PRO_MONTHLY</option>
                    <option value="3">ENTERPRISE</option>
                  </select>
                  <span className="form-hint">Peut être modifié ultérieurement</span>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="btn-icon" style={{ animation: 'spin 1s linear infinite' }} />
                      Création...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} className="btn-icon" />
                      Créer le tenant
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantsPage;