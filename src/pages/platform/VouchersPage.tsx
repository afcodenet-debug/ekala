import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight, CreditCard, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api-client';

interface Voucher {
  id: number;
  voucher_code: string;
  customer_email: string;
  status: string;
  requested_at: string;
  verification_deadline: string;
  expires_at: string;
  verified_at: string | null;
  amount_cents: number | null;
  currency: string;
  tenant_name: string;
  tenant_id: number;
  plan_name: string;
  plan_code: string;
}

interface VoucherCode {
  id: number;
  code: string;
  plan_id: number;
  plan_name: string;
  plan_code: string;
  amount_cents: number;
  currency: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface PlanOption {
  id: number;
  name: string;
  code: string;
}

const styles = `
  .vouchers-header {
    margin-bottom: 24px;
  }
  .vouchers-title {
    font-size: 24px;
    font-weight: 800;
    color: #e8e8f2;
    letter-spacing: -0.02em;
  }
  .vouchers-subtitle {
    font-size: 13px;
    color: #6a6a80;
    margin-top: 4px;
  }
  .vouchers-filters {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .tab-btn {
    padding: 10px 20px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    color: #a0a0b8;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 200ms;
  }
  .tab-btn:hover {
    color: #e8e8f2;
    border-color: rgba(255,255,255,0.15);
  }
  .tab-btn.active {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: #fff;
    border-color: transparent;
    box-shadow: 0 4px 16px rgba(59,130,246,0.3);
  }
  .codes-toolbar {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    align-items: center;
  }
  .codes-toolbar .spacer { flex: 1; }
  .new-code-btn {
    padding: 10px 18px;
    border-radius: 10px;
    border: none;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 16px rgba(34,197,94,0.3);
    transition: all 200ms;
  }
  .new-code-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(34,197,94,0.4);
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 8px;
  }
  .form-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-field.full { grid-column: 1 / -1; }
  .form-label {
    font-size: 12px;
    font-weight: 600;
    color: #6a6a80;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .form-input, .form-select {
    padding: 12px 14px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    color: #e8e8f2;
    font-size: 14px;
    outline: none;
    transition: all 200ms;
  }
  .form-input:focus, .form-select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
  }
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .toggle {
    position: relative;
    width: 46px;
    height: 26px;
    border-radius: 13px;
    background: rgba(255,255,255,0.1);
    border: none;
    cursor: pointer;
    transition: all 200ms;
    flex-shrink: 0;
  }
  .toggle.on { background: linear-gradient(135deg, #22c55e, #16a34a); }
  .toggle-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    transition: all 200ms;
  }
  .toggle.on .toggle-knob { left: 23px; }
  .uses-bar {
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.08);
    overflow: hidden;
    min-width: 80px;
  }
  .uses-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #22c55e);
  }
  .vouchers-table-container {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    overflow: hidden;
  }
  .vouchers-table {
    width: 100%;
    border-collapse: collapse;
  }
  .vouchers-table th {
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
  .vouchers-table td {
    padding: 14px 16px;
    font-size: 13px;
    color: #e8e8f2;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .vouchers-table tr:hover td {
    background: rgba(255,255,255,0.02);
  }
  .voucher-code {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 12px;
    font-weight: 600;
    color: #3b82f6;
    background: rgba(59,130,246,0.1);
    padding: 4px 8px;
    border-radius: 4px;
  }
  .action-btn {
    padding: 6px 12px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    border-radius: 6px;
    color: #a0a0b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 140ms;
  }
  .action-btn:hover {
    background: rgba(255,255,255,0.06);
    color: #e8e8f2;
  }
  .action-btn.approve:hover {
    background: rgba(34,197,94,0.1);
    border-color: rgba(34,197,94,0.3);
    color: #22c55e;
  }
  .action-btn.reject:hover {
    background: rgba(239,68,68,0.1);
    border-color: rgba(239,68,68,0.3);
    color: #ef4444;
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

  /* Toast Styles */
  .toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
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

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fade-in 0.2s ease-out;
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .modal-content {
    background: linear-gradient(145deg, #1a1a24, #16161e);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px;
    padding: 28px;
    max-width: 520px;
    width: 92%;
    box-shadow: 
      0 0 0 1px rgba(0,0,0,0.4),
      0 24px 80px rgba(0,0,0,0.6),
      0 8px 24px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.05);
    animation: modal-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    overflow: hidden;
  }
  .modal-content::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  }
  .modal-content-large {
    max-width: 580px;
  }
  @keyframes modal-slide-in {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  .modal-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .modal-icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .success-icon {
    background: linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05));
    color: #22c55e;
    box-shadow: 0 0 24px rgba(34,197,94,0.2);
  }
  .error-icon {
    background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05));
    color: #ef4444;
    box-shadow: 0 0 24px rgba(239,68,68,0.2);
  }
  .modal-title-group {
    flex: 1;
  }
  .modal-title {
    font-size: 20px;
    font-weight: 800;
    color: #e8e8f2;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }
  .modal-subtitle {
    font-size: 13px;
    color: #7b7b95;
    font-weight: 500;
  }
  .modal-message {
    font-size: 14px;
    color: #a0a0b8;
    margin-bottom: 24px;
    line-height: 1.6;
  }
  .voucher-details {
    background: rgba(0,0,0,0.2);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
  }
  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .detail-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .detail-label {
    font-size: 12px;
    font-weight: 600;
    color: #6a6a80;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .detail-value {
    font-size: 14px;
    font-weight: 600;
    color: #e8e8f2;
    text-align: right;
  }
  .voucher-code-display {
    font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
    font-size: 13px;
    color: #3b82f6;
    background: rgba(59,130,246,0.1);
    padding: 4px 10px;
    border-radius: 6px;
    letter-spacing: 0.04em;
  }
  .detail-value.amount {
    color: #22c55e;
    font-size: 15px;
    font-weight: 700;
  }
  .reason-input-wrapper {
    margin-top: 16px;
  }
  .reason-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #6a6a80;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .modal-input {
    width: 100%;
    padding: 14px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    color: #e8e8f2;
    font-size: 14px;
    margin-bottom: 0;
    outline: none;
    transition: all 200ms;
  }
  .modal-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
  }
  .modal-textarea {
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
    line-height: 1.5;
  }
  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .modal-btn {
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.01em;
  }
  .modal-btn:active {
    transform: scale(0.97);
  }
  .modal-btn-cancel {
    background: rgba(255,255,255,0.04);
    color: #a0a0b8;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .modal-btn-cancel:hover {
    background: rgba(255,255,255,0.08);
    color: #e8e8f2;
    border-color: rgba(255,255,255,0.15);
    transform: translateY(-1px);
  }
  .modal-btn-confirm {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: #fff;
    box-shadow: 0 4px 16px rgba(34,197,94,0.3);
  }
  .modal-btn-confirm:hover {
    background: linear-gradient(135deg, #16a34a, #15803d);
    box-shadow: 0 6px 20px rgba(34,197,94,0.4);
    transform: translateY(-2px);
  }
  .modal-btn-reject {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #fff;
    box-shadow: 0 4px 16px rgba(239,68,68,0.3);
  }
  .modal-btn-reject:hover:not(:disabled) {
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    box-shadow: 0 6px 20px rgba(239,68,68,0.4);
    transform: translateY(-2px);
  }
  .modal-btn-reject:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  .status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .status-badge.active {
    background: rgba(34,197,94,0.12);
    color: #22c55e;
    border: 1px solid rgba(34,197,94,0.25);
  }
  .status-badge.partial {
    background: rgba(59,130,246,0.12);
    color: #60a5fa;
    border: 1px solid rgba(59,130,246,0.25);
  }
  .status-badge.exhausted {
    background: rgba(245,158,11,0.12);
    color: #fbbf24;
    border: 1px solid rgba(245,158,11,0.25);
  }
  .status-badge.expired {
    background: rgba(239,68,68,0.10);
    color: #f87171;
    border: 1px solid rgba(239,68,68,0.25);
  }
  .status-badge.disabled {
    background: rgba(255,255,255,0.04);
    color: #6a6a80;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .action-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }
`;

const VouchersPage = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'info'; title: string; message: string }>>([]);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; voucher: Voucher | null }>({ show: false, voucher: null });
  const [rejectModal, setRejectModal] = useState<{ show: boolean; voucher: Voucher | null; reason: string }>({ show: false, voucher: null, reason: '' });

  // Vue "Codes Voucher" (CRUD sur le pool de codes)
  const [view, setView] = useState<'requests' | 'codes'>('requests');
  const [codes, setCodes] = useState<VoucherCode[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codeSearch, setCodeSearch] = useState('');
  const [codePlanFilter, setCodePlanFilter] = useState('');
  const [codeActiveFilter, setCodeActiveFilter] = useState('');
  const [codeModal, setCodeModal] = useState<{ show: boolean; editing: VoucherCode | null }>({ show: false, editing: null });
  const [codeForm, setCodeForm] = useState<{ code: string; plan_id: string; amount_cents: string; currency: string; max_uses: string; expires_at: string; is_active: boolean }>({ code: '', plan_id: '', amount_cents: '', currency: 'ZMW', max_uses: '1', expires_at: '', is_active: true });
  const [codeSaving, setCodeSaving] = useState(false);
  const [deleteCodeModal, setDeleteCodeModal] = useState<{ show: boolean; code: VoucherCode | null }>({ show: false, code: null });

  useEffect(() => {
    loadVouchers();
  }, [page, statusFilter]);

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const data = await api.platform.getVouchers({ page, limit: 50, status: statusFilter || undefined });
      if (data.success && Array.isArray(data.vouchers)) {
        setVouchers(data.vouchers);
        setTotalPages(data.pagination?.pages || 0);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error: any) {
      console.error('Failed to load vouchers:', error);
      setVouchers([]);
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

  // ── Gestion du pool de codes voucher ────────────────────────────────────────
  const loadPlans = async () => {
    try {
      const data: any = await api.platform.getPlans();
      if (data?.success && Array.isArray(data.plans)) {
        setPlans(data.plans.map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
      } else if (Array.isArray((data as any)?.data)) {
        setPlans((data as any).data.map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
      }
    } catch (e) { console.error('Failed to load plans:', e); }
  };

  const loadCodes = async () => {
    setCodesLoading(true);
    try {
      const params: any = { limit: 100 };
      if (codePlanFilter) params.planId = parseInt(codePlanFilter);
      if (codeActiveFilter) params.active = codeActiveFilter;
      if (codeSearch) params.search = codeSearch;
      const data: any = await api.platform.getVoucherCodes(params);
      if (data?.success && Array.isArray(data.voucherCodes)) setCodes(data.voucherCodes);
    } catch (e) { console.error('Failed to load voucher codes:', e); setCodes([]); }
    finally { setCodesLoading(false); }
  };

  useEffect(() => {
    if (view === 'codes') {
      loadPlans();
      loadCodes();
    }
  }, [view, codeSearch, codePlanFilter, codeActiveFilter]);

  const openCreateCode = () => {
    setCodeForm({ code: '', plan_id: plans[0]?.id ? String(plans[0].id) : '', amount_cents: '', currency: 'ZMW', max_uses: '1', expires_at: '', is_active: true });
    setCodeModal({ show: true, editing: null });
  };

  const openEditCode = (vc: VoucherCode) => {
    setCodeForm({
      code: vc.code,
      plan_id: String(vc.plan_id),
      amount_cents: String(vc.amount_cents),
      currency: vc.currency,
      max_uses: String(vc.max_uses),
      expires_at: vc.expires_at ? vc.expires_at.slice(0, 16) : '',
      is_active: !!vc.is_active,
    });
    setCodeModal({ show: true, editing: vc });
  };

  const saveCode = async () => {
    if (!codeForm.plan_id) { addToast('error', 'Validation', 'Veuillez sélectionner un plan'); return; }
    setCodeSaving(true);
    try {
      const body: any = {
        code: codeForm.code.trim() || undefined,
        plan_id: parseInt(codeForm.plan_id),
        amount_cents: codeForm.amount_cents ? parseInt(codeForm.amount_cents) : 0,
        currency: codeForm.currency,
        max_uses: parseInt(codeForm.max_uses) || 1,
        expires_at: codeForm.expires_at ? new Date(codeForm.expires_at).toISOString() : null,
        is_active: codeForm.is_active,
      };
      const editing = codeModal.editing;
      const data: any = editing
        ? await api.platform.updateVoucherCode(editing.id, body)
        : await api.platform.createVoucherCode(body);
      if (data?.success) {
        addToast('success', editing ? 'Code modifié' : 'Code créé', `Le code ${data.voucherCode?.code || codeForm.code} a été ${editing ? 'mis à jour' : 'créé'}.`);
        setCodeModal({ show: false, editing: null });
        loadCodes();
      } else {
        addToast('error', 'Erreur', data?.message || 'Opération échouée');
      }
    } catch (e: any) {
      console.error('Failed to save voucher code:', e);
      addToast('error', 'Erreur', e?.message || 'Opération échouée');
    } finally { setCodeSaving(false); }
  };

  const toggleCodeActive = async (vc: VoucherCode) => {
    try {
      const data: any = await api.platform.updateVoucherCode(vc.id, { is_active: !vc.is_active });
      if (data?.success) {
        addToast('success', vc.is_active ? 'Code désactivé' : 'Code activé', `Le code ${vc.code} est ${vc.is_active ? 'désactivé' : 'activé'}.`);
        loadCodes();
      } else {
        addToast('error', 'Erreur', data?.message || 'Opération échouée');
      }
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Opération échouée');
    }
  };

  const confirmDeleteCode = async () => {
    const vc = deleteCodeModal.code;
    if (!vc) return;
    setDeleteCodeModal({ show: false, code: null });
    try {
      const data: any = await api.platform.deleteVoucherCode(vc.id);
      if (data?.success) {
        addToast('success', 'Code supprimé', `Le code ${vc.code} a été supprimé.`);
        loadCodes();
      } else {
        addToast('error', 'Erreur', data?.message || 'Suppression échouée');
      }
    } catch (e: any) {
      addToast('error', 'Erreur', e?.message || 'Suppression échouée');
    }
  };

  const formatCurrencyCode = (cents: number, currency: string) => `${(cents / 100).toFixed(2)} ${currency}`;

  type FunctionalStatus = 'active' | 'partial' | 'exhausted' | 'expired' | 'disabled';

  interface VoucherFunctionalState {
    status: FunctionalStatus;
    label: string;
    className: string;
    canEdit: boolean;
    canToggleActive: boolean;
    canDelete: boolean;
    deletionBlockedReason?: string;
  }

  const getFunctionalState = (vc: VoucherCode): VoucherFunctionalState => {
    const now = Date.now();
    const expiresAt = vc.expires_at ? new Date(vc.expires_at).getTime() : null;
    const expired = expiresAt !== null && expiresAt < now;
    const exhausted = vc.used_count >= vc.max_uses;

    const canEdit = true;
    const canToggleActive = true;
    const canDelete = vc.used_count === 0;

    if (!vc.is_active) {
      return {
        status: 'disabled', label: 'Désactivé', className: 'disabled',
        canEdit, canToggleActive, canDelete,
        deletionBlockedReason: canDelete ? undefined : 'Code déjà utilisé',
      };
    }
    if (exhausted) {
      return {
        status: 'exhausted', label: 'Épuisé', className: 'exhausted',
        canEdit, canToggleActive, canDelete,
        deletionBlockedReason: canDelete ? undefined : 'Code déjà utilisé',
      };
    }
    if (vc.used_count > 0) {
      return {
        status: 'partial', label: 'Partiellement utilisé', className: 'partial',
        canEdit, canToggleActive, canDelete,
        deletionBlockedReason: canDelete ? undefined : 'Code déjà utilisé',
      };
    }
    if (expired) {
      return {
        status: 'expired', label: 'Expiré', className: 'expired',
        canEdit, canToggleActive, canDelete,
        deletionBlockedReason: canDelete ? undefined : 'Code déjà utilisé',
      };
    }
    return {
      status: 'active', label: 'Actif', className: 'active',
      canEdit, canToggleActive, canDelete,
      deletionBlockedReason: undefined,
    };
  };

  const handleApprove = (voucher: Voucher) => {
    setConfirmModal({ show: true, voucher });
  };

  const confirmApprove = async () => {
    const voucher = confirmModal.voucher;
    if (!voucher) return;

    setConfirmModal({ show: false, voucher: null });

    try {
      const data = await api.platform.approveVoucher(voucher.id) as any;
      if (data?.success) {
        const amountInfo = voucher.amount_cents ? formatCurrency(voucher.amount_cents) : voucher.plan_name;
        addToast('success', 'Voucher approuvé', 
          `Le voucher ${voucher.voucher_code} a été activé pour ${voucher.tenant_name} • ${amountInfo}`);
        loadVouchers();
      } else {
        addToast('error', 'Erreur', data?.message || 'Erreur lors de l\'approbation');
        loadVouchers();
      }
    } catch (error: any) {
      console.error('Failed to approve voucher:', error);
      addToast('error', 'Erreur', error.message || 'Erreur lors de l\'approbation');
      loadVouchers();
    }
  };

  const handleReject = (voucher: Voucher) => {
    setRejectModal({ show: true, voucher, reason: '' });
  };

  const confirmReject = async () => {
    const voucher = rejectModal.voucher;
    const reason = rejectModal.reason.trim();

    if (!voucher || !reason) {
      addToast('error', 'Erreur', 'Veuillez fournir une raison de rejet');
      return;
    }

    setRejectModal({ show: false, voucher: null, reason: '' });

    try {
      const data = await api.platform.rejectVoucher(voucher.id, reason) as any;
      if (data?.success) {
        const amountInfo = voucher.amount_cents ? formatCurrency(voucher.amount_cents) : voucher.plan_name;
        addToast('success', 'Voucher rejeté', 
          `Le voucher ${voucher.voucher_code} a été rejeté • ${amountInfo}`);
        loadVouchers();
      } else {
        addToast('error', 'Erreur', data?.message || 'Erreur lors du rejet');
        loadVouchers();
      }
    } catch (error: any) {
      console.error('Failed to reject voucher:', error);
      addToast('error', 'Erreur', error.message || 'Erreur lors du rejet');
      loadVouchers();
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'pending': return 'pending';
      case 'payment_sent': return 'payment_sent';
      case 'verified': return 'verified';
      case 'rejected': return 'rejected';
      case 'expired': return 'expired';
      default: return '';
    }
  };

  const getToastIcon = (type: 'success' | 'error' | 'info') => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={20} color="#22c55e" />;
      case 'error':
        return <AlertCircle size={20} color="#ef4444" />;
      case 'info':
        return <AlertCircle size={20} color="#3b82f6" />;
    }
  };

  const formatCurrency = (cents: number | null) => {
    if (!cents) return '-';
    return `${(cents / 100).toFixed(2)} ZMW`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div>
      <style>{styles}</style>

      <div className="vouchers-header">
        <h1 className="vouchers-title">Gestion des Vouchers</h1>
        <p className="vouchers-subtitle">
          {view === 'requests' ? `${total} demandes au total` : 'Gérez le pool de codes voucher pré-générés'}
        </p>
      </div>

      {/* Tabs */}
      <div className="vouchers-filters">
        <button
          className={`tab-btn ${view === 'requests' ? 'active' : ''}`}
          onClick={() => setView('requests')}
        >
          Demandes
        </button>
        <button
          className={`tab-btn ${view === 'codes' ? 'active' : ''}`}
          onClick={() => setView('codes')}
        >
          Codes Voucher
        </button>
      </div>

      {view === 'requests' && (
      <>
      {/* Filters */}
      <div className="vouchers-filters">
        <select
          style={{
            padding: '10px 14px',
            background: '#0f0f18',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: '#e8e8f2',
            fontSize: 13,
            minWidth: 180,
            cursor: 'pointer',
          }}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="payment_sent">Paiement déclaré</option>
          <option value="verified">Vérifié</option>
          <option value="rejected">Rejeté</option>
          <option value="expired">Expiré</option>
        </select>
      </div>

      {/* Table */}
      <div className="vouchers-table-container">
        <table className="vouchers-table">
          <thead>
            <tr>
              <th>Code Voucher</th>
              <th>Tenant</th>
              <th>Plan</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Date demande</th>
              <th>Expiration</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <CreditCard size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e8e8f2', marginBottom: 8 }}>
                      Aucun voucher trouvé
                    </h3>
                    <p style={{ fontSize: 13 }}>
                      {statusFilter ? 'Essayez de modifier le filtre' : 'Aucune demande de voucher'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              vouchers.map((voucher) => (
                <tr key={voucher.id}>
                  <td>
                    <span className="voucher-code">{voucher.voucher_code}</span>
                  </td>
                  <td>{voucher.tenant_name}</td>
                  <td>{voucher.plan_name}</td>
                  <td>{formatCurrency(voucher.amount_cents)}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(voucher.status)}`}>
                      {voucher.status}
                    </span>
                  </td>
                  <td>{new Date(voucher.requested_at).toLocaleDateString('fr-FR')}</td>
                  <td>{new Date(voucher.expires_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(voucher.status === 'pending' || voucher.status === 'payment_sent') && (
                        <>
                          <button
                            className="action-btn approve"
                            onClick={() => handleApprove(voucher)}
                          >
                            <CheckCircle size={14} />
                            Approuver
                          </button>
                          <button
                            className="action-btn reject"
                            onClick={() => handleReject(voucher)}
                          >
                            <XCircle size={14} />
                            Rejeter
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <div className="pagination-info">
              Page {page} sur {totalPages} • {total} vouchers
            </div>
            <div className="pagination-buttons">
              <button
                className="pagination-btn"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                className="pagination-btn"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
      </>)}
      {/* Codes Voucher (CRUD) */}
      {view === 'codes' && (
        <div>
          <div className="codes-toolbar">
            <input
              className="form-input"
              style={{ minWidth: 200 }}
              placeholder="Rechercher un code…"
              value={codeSearch}
              onChange={(e) => setCodeSearch(e.target.value)}
            />
            <select className="form-select" value={codePlanFilter} onChange={(e) => setCodePlanFilter(e.target.value)}>
              <option value="">Tous les plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select className="form-select" value={codeActiveFilter} onChange={(e) => setCodeActiveFilter(e.target.value)}>
              <option value="">Tous les statuts</option>
              <option value="true">Actif</option>
              <option value="false">Désactivé</option>
            </select>
            <div className="spacer" />
            <button className="new-code-btn" onClick={openCreateCode}>
              <CheckCircle2 size={16} /> Nouveau code
            </button>
          </div>

          <div className="vouchers-table-container">
            <table className="vouchers-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Plan</th>
                  <th>Montant</th>
                  <th>Utilisations</th>
                  <th>Expiration</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {codesLoading ? (
                  <tr><td colSpan={7}><div className="loading-spinner" /></td></tr>
                ) : codes.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <CreditCard size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
                        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e8e8f2', marginBottom: 8 }}>Aucun code voucher</h3>
                        <p style={{ fontSize: 13 }}>Créez un premier code pour alimenter le pool.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  codes.map((vc) => (
                    <tr key={vc.id}>
                      <td><span className="voucher-code">{vc.code}</span></td>
                      <td>{vc.plan_name}</td>
                      <td>{formatCurrencyCode(vc.amount_cents, vc.currency)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="uses-bar"><div className="uses-fill" style={{ width: `${vc.max_uses ? Math.min(100, (vc.used_count / vc.max_uses) * 100) : 0}%` }} /></div>
                          <span style={{ fontSize: 12, color: '#a0a0b8' }}>{vc.used_count}/{vc.max_uses}</span>
                        </div>
                      </td>
                      <td>{vc.expires_at ? new Date(vc.expires_at).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>
                        {(() => {
                          const state = getFunctionalState(vc);
                          return (
                            <span className={`status-badge ${state.className}`} title={state.label}>
                              {state.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        {(() => {
                          const state = getFunctionalState(vc);
                          return (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="action-btn" onClick={() => openEditCode(vc)} title="Modifier ce code">
                                <Eye size={14} /> Modifier
                              </button>
                              <button className="action-btn" onClick={() => toggleCodeActive(vc)} title={state.canToggleActive ? 'Changer le statut actif/désactivé' : 'Action non autorisée'}>
                                {vc.is_active ? <XCircle size={14} /> : <CheckCircle size={14} />} {vc.is_active ? 'Désactiver' : 'Activer'}
                              </button>
                              <button
                                className="action-btn reject"
                                onClick={() => setDeleteCodeModal({ show: true, code: vc })}
                                disabled={!state.canDelete}
                                title={state.deletionBlockedReason || 'Supprimer ce code'}
                              >
                                <XCircle size={14} /> Supprimer
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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

      {/* Confirm Modal */}
      {confirmModal.show && confirmModal.voucher && (
        <div className="modal-overlay" onClick={() => setConfirmModal({ show: false, voucher: null })}>
          <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon success-icon">
                <CheckCircle2 size={28} />
              </div>
              <div className="modal-title-group">
                <div className="modal-title">Confirmer l'approbation</div>
                <div className="modal-subtitle">Cette action activera l'abonnement du tenant</div>
              </div>
            </div>

            <div className="modal-message">
              <div className="voucher-details">
                <div className="detail-row">
                  <span className="detail-label">Code Voucher</span>
                  <span className="detail-value voucher-code-display">{confirmModal.voucher.voucher_code}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Tenant</span>
                  <span className="detail-value">{confirmModal.voucher.tenant_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Plan</span>
                  <span className="detail-value">{confirmModal.voucher.plan_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Montant</span>
                  <span className="detail-value amount">{formatCurrency(confirmModal.voucher.amount_cents)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Date d'expiration</span>
                  <span className="detail-value">{formatDate(confirmModal.voucher.expires_at)}</span>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setConfirmModal({ show: false, voucher: null })}
              >
                Annuler
              </button>
              <button
                className="modal-btn modal-btn-confirm"
                onClick={confirmApprove}
              >
                <CheckCircle2 size={16} />
                Confirmer l'approbation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.show && rejectModal.voucher && (
        <div className="modal-overlay" onClick={() => setRejectModal({ show: false, voucher: null, reason: '' })}>
          <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon error-icon">
                <XCircle size={28} />
              </div>
              <div className="modal-title-group">
                <div className="modal-title">Rejeter le voucher</div>
                <div className="modal-subtitle">Veuillez fournir une raison pour le rejet</div>
              </div>
            </div>

            <div className="modal-message">
              <div className="voucher-details">
                <div className="detail-row">
                  <span className="detail-label">Code Voucher</span>
                  <span className="detail-value voucher-code-display">{rejectModal.voucher.voucher_code}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Tenant</span>
                  <span className="detail-value">{rejectModal.voucher.tenant_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Plan</span>
                  <span className="detail-value">{rejectModal.voucher.plan_name}</span>
                </div>
              </div>

              <div className="reason-input-wrapper">
                <label className="reason-label">Raison du rejet *</label>
                <textarea
                  className="modal-input modal-textarea"
                  placeholder="Expliquez pourquoi ce voucher est rejeté..."
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      confirmReject();
                    } else if (e.key === 'Escape') {
                      setRejectModal({ show: false, voucher: null, reason: '' });
                    }
                  }}
                  autoFocus
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setRejectModal({ show: false, voucher: null, reason: '' })}
              >
                Annuler
              </button>
              <button
                className="modal-btn modal-btn-reject"
                onClick={confirmReject}
                disabled={!rejectModal.reason.trim()}
              >
                <XCircle size={16} />
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code Voucher — Create / Edit Modal */}
      {codeModal.show && (
        <div className="modal-overlay" onClick={() => setCodeModal({ show: false, editing: null })}>
          <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className={`modal-icon ${codeModal.editing ? 'success-icon' : 'success-icon'}`}>
                <CheckCircle2 size={28} />
              </div>
              <div className="modal-title-group">
                <div className="modal-title">{codeModal.editing ? 'Modifier le code voucher' : 'Nouveau code voucher'}</div>
                <div className="modal-subtitle">{codeModal.editing ? `Code ${codeModal.editing.code}` : 'Ajoutez un code au pool de voucher'}</div>
              </div>
            </div>

            <div className="modal-message">
              <div className="form-grid">
                <div className="form-field full">
                  <label className="form-label">Code</label>
                  <input
                    className="form-input"
                    placeholder="Auto-généré si vide (ex: VCH-AB12CD)"
                    value={codeForm.code}
                    onChange={(e) => setCodeForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Plan *</label>
                  <select className="form-select" value={codeForm.plan_id} onChange={(e) => setCodeForm(prev => ({ ...prev, plan_id: e.target.value }))}>
                    <option value="">Sélectionner…</option>
                    {plans.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Devise</label>
                  <input className="form-input" value={codeForm.currency} onChange={(e) => setCodeForm(prev => ({ ...prev, currency: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Montant (en centimes)</label>
                  <input className="form-input" type="number" min={0} placeholder="0" value={codeForm.amount_cents} onChange={(e) => setCodeForm(prev => ({ ...prev, amount_cents: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Utilisations max</label>
                  <input className="form-input" type="number" min={1} value={codeForm.max_uses} onChange={(e) => setCodeForm(prev => ({ ...prev, max_uses: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Expiration</label>
                  <input className="form-input" type="datetime-local" value={codeForm.expires_at} onChange={(e) => setCodeForm(prev => ({ ...prev, expires_at: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Statut</label>
                  <div className="toggle-row">
                    <button type="button" className={`toggle ${codeForm.is_active ? 'on' : ''}`} onClick={() => setCodeForm(prev => ({ ...prev, is_active: !prev.is_active }))}>
                      <span className="toggle-knob" />
                    </button>
                    <span style={{ fontSize: 13, color: '#a0a0b8' }}>{codeForm.is_active ? 'Actif' : 'Désactivé'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setCodeModal({ show: false, editing: null })}>Annuler</button>
              <button className="modal-btn modal-btn-confirm" onClick={saveCode} disabled={codeSaving}>
                <CheckCircle2 size={16} /> {codeSaving ? 'Enregistrement…' : (codeModal.editing ? 'Enregistrer' : 'Créer le code')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code Voucher — Delete Confirm Modal */}
      {deleteCodeModal.show && deleteCodeModal.code && (
        <div className="modal-overlay" onClick={() => setDeleteCodeModal({ show: false, code: null })}>
          <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon error-icon"><XCircle size={28} /></div>
              <div className="modal-title-group">
                <div className="modal-title">Supprimer le code voucher</div>
                <div className="modal-subtitle">Cette action est irréversible</div>
              </div>
            </div>
            <div className="modal-message">
              <div className="voucher-details">
                <div className="detail-row">
                  <span className="detail-label">Code</span>
                  <span className="detail-value voucher-code-display">{deleteCodeModal.code.code}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Plan</span>
                  <span className="detail-value">{deleteCodeModal.code.plan_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Utilisations</span>
                  <span className="detail-value">{deleteCodeModal.code.used_count}/{deleteCodeModal.code.max_uses}</span>
                </div>
              </div>
              {(() => {
                const state = getFunctionalState(deleteCodeModal.code);
                if (!state.canDelete && state.deletionBlockedReason) {
                  return <p style={{ fontSize: 13, color: '#ef4444', marginTop: 12 }}>{state.deletionBlockedReason}</p>;
                }
                return null;
              })()}
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setDeleteCodeModal({ show: false, code: null })}>Annuler</button>
              <button className="modal-btn modal-btn-reject" onClick={confirmDeleteCode} disabled={!(() => { const s = getFunctionalState(deleteCodeModal.code); return s.canDelete; })()}>
                <XCircle size={14} /> Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VouchersPage;