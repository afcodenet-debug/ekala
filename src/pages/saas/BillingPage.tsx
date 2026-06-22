import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import {
  CreditCard, CheckCircle2, AlertTriangle, Clock, RefreshCw,
  ArrowUpRight, Calendar, Users, LayoutGrid, Package,
  ShieldCheck, XCircle, ArrowLeft, X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../lib/api-client';

const API_BASE = (window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api';

// ─── Inject styles once ───────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('billing-styles')) {
  const style = document.createElement('style');
  style.id = 'billing-styles';
  style.textContent = `
    @keyframes bp-fade-up {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes bp-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes bp-panel-in {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes bp-spin {
      to { transform: rotate(360deg); }
    }

    .bp-shell {
      min-height: 100vh;
      background: #0a0a10;
    }
    .bp-page {
      max-width: 820px;
      margin: 0 auto;
      padding: 40px 24px 100px;
      animation: bp-fade-up 300ms cubic-bezier(0.16,1,0.3,1) both;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      color: #e8e8f2;
    }

    /* ── Header ── */
    .bp-header { margin-bottom: 36px; }
    .bp-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 4px 10px 4px 8px;
      border-radius: 999px;
      background: rgba(245,158,11,0.09);
      border: 1px solid rgba(245,158,11,0.2);
      font-size: 10.5px;
      font-weight: 700;
      color: #f59e0b;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      margin-bottom: 14px;
    }
    .bp-title {
      margin: 0 0 6px;
      font-size: 28px;
      font-weight: 800;
      color: #e8e8f2;
      letter-spacing: -0.03em;
      line-height: 1.1;
    }
    .bp-subtitle {
      margin: 0;
      font-size: 13.5px;
      color: #44445a;
      font-weight: 400;
      line-height: 1.5;
    }

    /* ── Back link ── */
    .bp-back {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: transparent;
      border: none;
      color: #4a4a6a;
      cursor: pointer;
      font-size: 13.5px;
      font-weight: 600;
      padding: 6px 8px;
      margin: -6px 0 28px -8px;
      border-radius: 7px;
      transition: background 140ms, color 140ms;
    }
    .bp-back:hover { background: rgba(255,255,255,0.05); color: #9090b0; }

    /* ── Alert banner ── */
    .bp-alert {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px 18px;
      border-radius: 12px;
      margin-bottom: 32px;
      animation: bp-fade-up 280ms ease both;
    }
    .bp-alert-danger {
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.2);
      color: #ef4444;
    }
    .bp-alert-title {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 720;
      color: #e8e8f2;
    }
    .bp-alert-text { margin: 0; font-size: 13.5px; color: #8d8da8; line-height: 1.55; }

    /* ── Buttons ── */
    .bp-btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 11px 20px;
      border-radius: 10px;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      border: none;
      color: #fff;
      font-size: 13.5px;
      font-weight: 700;
      letter-spacing: -0.01em;
      cursor: pointer;
      white-space: nowrap;
      box-shadow: 0 8px 24px rgba(59,130,246,0.28), 0 2px 6px rgba(59,130,246,0.18);
      transition: filter 140ms, transform 140ms, box-shadow 140ms;
    }
    .bp-btn-primary:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
      box-shadow: 0 12px 28px rgba(59,130,246,0.35), 0 2px 8px rgba(59,130,246,0.2);
    }
    .bp-btn-primary:active { transform: translateY(0); filter: brightness(0.97); }

    .bp-btn-ghost {
      padding: 11px 22px;
      border-radius: 10px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      color: #4a4a6a;
      font-size: 13.5px;
      font-weight: 650;
      font-family: inherit;
      cursor: pointer;
      transition: background 140ms, color 140ms;
    }
    .bp-btn-ghost:hover { background: rgba(255,255,255,0.07); color: #8080a0; }

    .bp-btn-danger {
      padding: 11px 22px;
      border-radius: 10px;
      background: rgba(239,68,68,0.06);
      border: 1px solid rgba(239,68,68,0.18);
      color: #ef4444;
      font-size: 13.5px;
      font-weight: 650;
      font-family: inherit;
      cursor: pointer;
      transition: background 140ms, color 140ms;
    }
    .bp-btn-danger:hover { background: rgba(239,68,68,0.14); }

    .bp-btn-purple {
      padding: 11px 22px;
      border-radius: 10px;
      border: none;
      color: #fff;
      font-size: 13.5px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      background: linear-gradient(135deg, #9b6ff7 0%, #7c3aed 100%);
      box-shadow: 0 8px 22px rgba(155,111,247,0.32);
      transition: filter 140ms, transform 140ms, opacity 140ms;
    }
    .bp-btn-purple:not(:disabled):hover { filter: brightness(1.08); transform: translateY(-1px); }
    .bp-btn-purple:disabled { opacity: 0.6; cursor: wait; }

    .bp-btn-amber-solid {
      padding: 8px 14px;
      border-radius: 8px;
      background: #f59e0b;
      border: none;
      color: #1a1306;
      font-size: 12px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: filter 140ms;
    }
    .bp-btn-amber-solid:hover { filter: brightness(1.08); }

    .bp-icon-btn {
      width: 28px; height: 28px;
      border-radius: 7px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      color: #3a3a52;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 140ms, color 140ms;
      flex-shrink: 0;
    }
    .bp-icon-btn:hover { background: rgba(255,255,255,0.09); color: #7a7a9a; }

    /* ── Status pills ── */
    .bp-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .bp-pill-active     { background: rgba(34,197,94,0.1);  border: 1px solid rgba(34,197,94,0.22);  color: #22c55e; }
    .bp-pill-trialing   { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.22); color: #3b82f6; }
    .bp-pill-past_due   { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.22); color: #f59e0b; }
    .bp-pill-cancelled  { background: rgba(239,68,68,0.1);  border: 1px solid rgba(239,68,68,0.22);  color: #ef4444; }
    .bp-pill-expired    { background: rgba(239,68,68,0.1);  border: 1px solid rgba(239,68,68,0.22);  color: #ef4444; }

    /* ── Card shell (mirrors form-panel pattern: strip + inner) ── */
    .bp-card {
      background: #0f0f18;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px;
      margin-bottom: 16px;
      overflow: hidden;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 20px 50px rgba(0,0,0,0.4);
      animation: bp-panel-in 240ms cubic-bezier(0.16,1,0.3,1) both;
    }
    .bp-card-strip { height: 3px; }
    .bp-strip-active     { background: linear-gradient(90deg, transparent, #22c55e 40%, #22c55e88 100%); }
    .bp-strip-trialing   { background: linear-gradient(90deg, transparent, #3b82f6 40%, #3b82f688 100%); }
    .bp-strip-past_due   { background: linear-gradient(90deg, transparent, #f59e0b 40%, #f59e0b88 100%); }
    .bp-strip-cancelled  { background: linear-gradient(90deg, transparent, #ef4444 40%, #ef444488 100%); }
    .bp-strip-expired    { background: linear-gradient(90deg, transparent, #ef4444 40%, #ef444488 100%); }
    .bp-card-inner { padding: 26px 26px 24px; }

    .bp-card-eyebrow {
      font-size: 10.5px;
      font-weight: 700;
      color: #3a3a58;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 10px;
    }
    .bp-plan-headline {
      font-size: 22px;
      font-weight: 720;
      color: #e0e0f0;
      letter-spacing: -0.02em;
      margin: 0 0 10px;
    }
    .bp-price {
      font-size: 27px;
      font-weight: 800;
      color: #e8e8f2;
      letter-spacing: -0.02em;
    }
    .bp-price-free { font-size: 27px; font-weight: 800; color: #22c55e; }
    .bp-price-period { font-size: 12px; color: #3a3a58; margin-top: 3px; }

    .bp-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 18px 0; }

    /* ── Quota grid ── */
    .bp-quota-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin: 18px 0;
    }
    .bp-quota {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 11px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: border-color 160ms, background 160ms;
    }
    .bp-quota:hover { border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.035); }
    .bp-quota-icon {
      width: 34px; height: 34px;
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .bp-quota-icon-blue   { background: rgba(59,130,246,0.1);  border: 1px solid rgba(59,130,246,0.2);  color: #3b82f6; }
    .bp-quota-icon-purple { background: rgba(155,111,247,0.1); border: 1px solid rgba(155,111,247,0.2); color: #9b6ff7; }
    .bp-quota-icon-amber  { background: rgba(245,158,11,0.1);  border: 1px solid rgba(245,158,11,0.2);  color: #f59e0b; }
    .bp-quota-label { font-size: 11px; color: #3a3a58; margin-bottom: 2px; }
    .bp-quota-value { font-weight: 720; font-size: 17px; color: #e0e0f0; line-height: 1; }

    /* ── Period / cycle progress ── */
    .bp-period-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 16px;
      border-radius: 12px;
      margin-top: 6px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05);
    }
    .bp-period-row-warn { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.2); }
    .bp-period-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; color: #3a3a58; margin-bottom: 4px;
      text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700;
    }
    .bp-period-date { font-size: 14.5px; color: #e0e0f0; font-weight: 650; }
    .bp-period-warn-badge {
      display: flex; align-items: center; gap: 6px;
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.22);
      border-radius: 999px; padding: 5px 12px; font-size: 11px; font-weight: 700;
      color: #ef4444; white-space: nowrap; flex-shrink: 0;
    }
    .bp-ring-track { stroke: rgba(255,255,255,0.08); }
    .bp-ring-fill { stroke: #f59e0b; transition: stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1); }
    .bp-ring-fill-warn { stroke: #ef4444; }
    .bp-ring-num { font-weight: 720; font-size: 17px; color: #e0e0f0; line-height: 1; }
    .bp-ring-unit { font-size: 8px; color: #3a3a58; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 1px; }

    .bp-cta-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px; }

    /* ── Empty / no-subscription state ── */
    .bp-empty {
      background: #0f0f18;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 56px 32px;
      text-align: center;
    }
    .bp-empty-icon {
      width: 56px; height: 56px;
      border-radius: 14px;
      background: rgba(245,158,11,0.1);
      border: 1px solid rgba(245,158,11,0.2);
      color: #f59e0b;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 18px;
    }
    .bp-empty-title {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 720;
      color: #e0e0f0;
      letter-spacing: -0.02em;
    }
    .bp-empty-sub { margin: 0 0 22px; font-size: 13px; color: #3e3e58; line-height: 1.6; }

    /* ── Payment history ── */
    .bp-section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
    .bp-section-icon {
      width: 34px; height: 34px;
      border-radius: 9px;
      background: rgba(245,158,11,0.1);
      border: 1px solid rgba(245,158,11,0.2);
      color: #f59e0b;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .bp-section-title { font-weight: 720; font-size: 15px; color: #e0e0f0; line-height: 1; }
    .bp-section-meta { font-size: 12px; color: #3a3a58; margin-top: 4px; }

    .bp-pay-empty {
      text-align: center;
      padding: 32px 0;
      border: 1px dashed rgba(255,255,255,0.08);
      border-radius: 12px;
    }
    .bp-pay-empty-icon {
      width: 40px; height: 40px;
      border-radius: 11px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      color: #3a3a58;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 12px;
    }

    .bp-pay-list { display: flex; flex-direction: column; gap: 6px; }
    .bp-pay-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 13px 16px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 10px;
      transition: border-color 160ms, background 160ms;
    }
    .bp-pay-row:hover { border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.035); }
    .bp-pay-icon {
      width: 36px; height: 36px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .bp-pay-completed { background: rgba(34,197,94,0.1);  border: 1px solid rgba(34,197,94,0.3);  color: #22c55e; }
    .bp-pay-pending   { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: #f59e0b; }
    .bp-pay-failed    { background: rgba(239,68,68,0.1);  border: 1px solid rgba(239,68,68,0.3);  color: #ef4444; }
    .bp-pay-refunded  { background: rgba(155,111,247,0.1);border: 1px solid rgba(155,111,247,0.3);color: #9b6ff7; }
    .bp-pay-amount { font-weight: 700; font-size: 14px; color: #e0e0f0; }
    .bp-pay-meta { font-size: 11px; color: #3a3a58; margin-top: 2px; }
    .bp-pay-status { padding: 4px 11px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; white-space: nowrap; }

    /* ── Plan selection grid ── */
    .bp-plan-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 40px;
    }
    .bp-plan-card {
      background: #0f0f18;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 22px;
      cursor: pointer;
      position: relative;
      transition: border-color 180ms, box-shadow 180ms, transform 180ms;
    }
    .bp-plan-card:hover {
      border-color: rgba(255,255,255,0.13);
      box-shadow: 0 16px 40px rgba(0,0,0,0.35);
      transform: translateY(-2px);
    }
    .bp-plan-card-selected {
      border-color: rgba(245,158,11,0.4);
      box-shadow: 0 0 0 1px rgba(245,158,11,0.3), 0 16px 40px rgba(0,0,0,0.35);
    }
    .bp-plan-badge {
      position: absolute; top: 14px; right: 14px;
      width: 22px; height: 22px;
      border-radius: 50%;
      background: #f59e0b;
      color: #1a1306;
      display: flex; align-items: center; justify-content: center;
    }
    .bp-plan-icon {
      width: 34px; height: 34px;
      border-radius: 9px;
      background: rgba(245,158,11,0.09);
      border: 1px solid rgba(245,158,11,0.18);
      color: #f59e0b;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 14px;
    }
    .bp-plan-card-name { font-size: 16.5px; font-weight: 720; color: #e0e0f0; letter-spacing: -0.02em; margin-bottom: 10px; }
    .bp-plan-price-row { display: flex; align-items: baseline; gap: 5px; margin-bottom: 12px; }
    .bp-plan-price { font-size: 23px; font-weight: 800; color: #e8e8f2; letter-spacing: -0.01em; }
    .bp-plan-per { font-size: 12px; color: #3a3a58; }
    .bp-plan-desc { font-size: 12.5px; color: #3e3e58; line-height: 1.6; margin-top: 12px; }

    /* ── Modal ── */
    .bp-modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.65);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
      animation: bp-fade-in 180ms ease both;
    }
    .bp-modal {
      background: #0f0f18;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 24px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 30px 70px rgba(0,0,0,0.5);
      animation: bp-panel-in 200ms cubic-bezier(0.16,1,0.3,1) both;
    }
    .bp-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .bp-modal-title { margin: 0; font-size: 17px; font-weight: 720; color: #e8e8f2; }
    .bp-modal-summary {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.07);
      border-left: 3px solid #f59e0b;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 14px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .bp-modal-plan-name { font-size: 15.5px; font-weight: 720; color: #e0e0f0; }
    .bp-modal-plan-per { font-size: 11.5px; color: #3a3a58; margin-top: 2px; }
    .bp-modal-plan-price { font-size: 19px; font-weight: 800; color: #e8e8f2; }
    .bp-modal-note { color: #7a7a9a; font-size: 13px; margin: 0; }
    .bp-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px; }

    /* ── Voucher result ── */
    .bp-voucher-label { font-size: 10.5px; color: #3a3a58; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; font-weight: 700; }
    .bp-voucher-box {
      padding: 16px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(245,158,11,0.25);
      border-radius: 11px;
      margin-bottom: 16px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .bp-voucher-code {
      font-size: 21px; font-weight: 700; color: #e8e8f2; letter-spacing: 0.07em;
      font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
    }
    .bp-voucher-detail { font-size: 13px; color: #8080a0; line-height: 1.7; }
    .bp-voucher-note { color: #3a3a58; margin-top: 6px; }

    /* ── Loader ── */
    .bp-loader { display: flex; align-items: center; justify-content: center; height: 60vh; }
    .bp-spinner {
      width: 36px; height: 36px;
      border-radius: 50%;
      border: 2.5px solid rgba(255,255,255,0.06);
      border-top-color: #f59e0b;
      animation: bp-spin 0.8s linear infinite;
    }
    .bp-spinner-sm {
      width: 24px; height: 24px;
      border-radius: 50%;
      border: 2.5px solid rgba(255,255,255,0.06);
      border-top-color: #9b6ff7;
      animation: bp-spin 0.7s linear infinite;
    }

    /* ── Error screen ── */
    .bp-error-wrap { min-height: 100vh; background: #0a0a10; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .bp-error-icon {
      width: 52px; height: 52px; border-radius: 14px;
      background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
      color: #ef4444;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px;
    }
    .bp-error-text { color: #8d8da8; font-size: 14px; margin: 0 0 24px; line-height: 1.6; }

    @media (prefers-reduced-motion: reduce) {
      .bp-page, .bp-alert, .bp-card, .bp-plan-card, .bp-modal-overlay, .bp-modal,
      .bp-spinner, .bp-spinner-sm, .bp-ring-fill, .bp-quota, .bp-pay-row, .bp-btn-primary {
        animation: none !important;
        transition: none !important;
      }
    }

    button:focus-visible, [tabindex]:focus-visible {
      outline: 2px solid rgba(245,158,11,0.6);
      outline-offset: 2px;
      border-radius: 8px;
    }
  `;
  document.head.appendChild(style);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subscription {
  id: number;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  plan: {
    code: string;
    name: string;
    price_cents: number;
    currency: string;
    period: string;
    max_users: number | null;
    max_tables: number | null;
    max_products: number | null;
    is_trial: boolean;
  };
}

interface Payment {
  id: number;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  paid_at: string | null;
  created_at: string;
}

interface TenantDetail {
  id: number;
  name: string;
  status: string;
  owner_email: string;
  subscriptions?: Subscription[];
  payments?: Payment[];
}

// Interface pour les plans (pour la sélection)
interface Plan {
  id: number;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  period: 'weekly' | 'monthly' | 'annual' | 'lifetime' | 'trial';
  duration_days: number;
  max_users: number | null;
  max_tables: number | null;
  max_products: number | null;
  max_orders_per_month: number | null;
  features: any;
  is_trial: boolean;
  price_display: string;
  per: string;
  sort_order: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Subscription['status'], string> = {
  active: 'Actif',
  trialing: "Période d'essai",
  past_due: 'Paiement en retard',
  cancelled: 'Annulé',
  expired: 'Expiré',
};

function paymentMetaClass(s: Payment['status']): string {
  switch (s) {
    case 'completed': return 'bp-pay-completed';
    case 'pending':   return 'bp-pay-pending';
    case 'failed':    return 'bp-pay-failed';
    case 'refunded':  return 'bp-pay-refunded';
    default:          return 'bp-pay-pending';
  }
}

function paymentLabel(s: Payment['status']): string {
  switch (s) {
    case 'completed': return 'Payé';
    case 'pending':   return 'En attente';
    case 'failed':    return 'Échoué';
    case 'refunded':  return 'Remboursé';
    default:          return s;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function daysLeft(isoEnd: string): number {
  return Math.max(0, Math.ceil((new Date(isoEnd).getTime() - Date.now()) / 86_400_000));
}

function formatAmount(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;
}

function periodLabel(period: string): string {
  if (period === 'weekly')  return '/ semaine';
  if (period === 'monthly') return '/ mois';
  return '/ an';
}

/** Purely presentational: % of the current billing cycle already elapsed. */
function periodProgressPercent(startIso?: string | null, endIso?: string | null): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: Subscription['status'] }> = ({ status }) => {
  const Icon =
    status === 'active' || status === 'trialing' ? CheckCircle2
    : status === 'past_due' ? AlertTriangle
    : XCircle;
  return (
    <span className={`bp-pill bp-pill-${status}`}>
      <Icon size={11} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
};

/** Compact circular progress ring — visualizes the current billing cycle. */
const RadialProgress: React.FC<{
  percent: number;
  warn?: boolean;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}> = ({ percent, warn, size = 56, stroke = 4, children }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = c - (clamped / 100) * c;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle className="bp-ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className={`bp-ring-fill${warn ? ' bp-ring-fill-warn' : ''}`}
          cx={size / 2} cy={size / 2} r={r} fill="none"
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  );
};

const QuotaItem: React.FC<{
  Icon: React.FC<{ size?: number }>;
  label: string;
  value: number | string;
  iconClass: string;
}> = ({ Icon, label, value, iconClass }) => (
  <div className="bp-quota">
    <div className={`bp-quota-icon ${iconClass}`}>
      <Icon size={15} />
    </div>
    <div>
      <div className="bp-quota-label">{label}</div>
      <div className="bp-quota-value">{value}</div>
    </div>
  </div>
);

// ─── Loading screen ───────────────────────────────────────────────────────────

const LoadingScreen = () => (
  <div className="bp-shell bp-loader">
    <div className="bp-spinner" />
  </div>
);

// ─── Error screen ─────────────────────────────────────────────────────────────

const ErrorScreen: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="bp-error-wrap">
    <div className="bp-card" style={{ maxWidth: 440, width: '100%' }}>
      <div className="bp-card-inner" style={{ textAlign: 'center' }}>
        <div className="bp-error-icon">
          <XCircle size={22} />
        </div>
        <p className="bp-error-text">{message}</p>
        <button onClick={onRetry} className="bp-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <RefreshCw size={13} /> Réessayer
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const BillingPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const tenantId = (user as any)?.tenant_id;
  const hasTenant = Boolean(tenantId);

  const [tenant, setTenant]   = useState<TenantDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [plansLoading, setPlansLoading] = useState(false);
  const [voucherResponse, setVoucherResponse] = useState<{ voucherCode: string; amount: { cents: number; currency: string }; plan: any } | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  // Paramètres URL
  const fromParam = searchParams.get('from');
  const modeParam = searchParams.get('mode');
  const fromExpired = fromParam === 'trial_expired' || fromParam === 'expired';
  const fromSuspended = fromParam === 'suspended';
  const modeUpgrade = modeParam === 'upgrade' || searchParams.get('upgrade') === '1';
  const planParam = searchParams.get('plan');

  const load = () => {
    if (!tenantId) {
      setError(t('billing.noTenant'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/tenants/${tenantId}`)
      .then(r => r.json())
      .then(data => {
        if (data?.error) throw new Error(data.error);
        setTenant(data?.tenant ?? data);
      })
      .catch((e: any) => setError(e.message || t('pricing.error.unexpectedFormat')))
      .finally(() => setLoading(false));
  };

  // Charger les plans payants si nécessaire
  useEffect(() => {
    if (!tenantId) return;

    // Si on vient d'un contexte d'upgrade (trial expirée) ou si un plan est pré-sélectionné, charger les plans payants
    if (planParam || fromExpired || fromSuspended || modeUpgrade) {
      setPlansLoading(true);
      fetch(`${API_BASE}/plans?type=paid`)
        .then(r => r.json())
        .then(data => {
          const paidPlans = Array.isArray(data) ? data : data?.plans || [];
          setPlans(paidPlans.filter((p: Plan) => !p.is_trial));
        })
        .catch(() => setPlans([]))
        .finally(() => setPlansLoading(false));
    }
  }, [tenantId, planParam, fromExpired, modeUpgrade]);

  useEffect(() => { load(); }, [tenantId, t]);

  if (loading) return <LoadingScreen />;
  if (error)   return <ErrorScreen message={error} onRetry={load} />;

  const subscription = tenant?.subscriptions?.[0] ?? null;
  const payments     = tenant?.payments ?? [];
  const currentTenantId = tenant?.id ?? null;
  const periodEnd    = subscription?.trial_ends_at ?? subscription?.current_period_end;
  const remaining    = periodEnd ? daysLeft(periodEnd) : null;
  const isLowTime    = remaining !== null && remaining <= 7;
  const isExpired    = subscription?.status === 'expired';
  const progressPercent = subscription && periodEnd
    ? periodProgressPercent(subscription.current_period_start, periodEnd)
    : 0;

  // Trouver le plan pré-sélectionné
  const preselectedPlan = plans.find(p => p.code === planParam);

  // Gérer la sélection d'un plan
  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
  };

  const handleRequestVoucher = async () => {
    if (!selectedPlan || !tenantId) return;
    setVoucherLoading(true);
    try {
      const data = await api.post<any>('/billing/request-voucher', { planId: selectedPlan.id });
      setVoucherResponse(data);
    } catch (e: any) {
      alert(e.message || 'Erreur lors de la génération du code');
    } finally {
      setVoucherLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  // Si on vient pour sélectionner un plan (essai expiré ou paramètre plan), afficher la sélection
  // UNIQUEMENT si l'utilisateur a un tenant
  if ((fromExpired || fromSuspended || modeUpgrade || plans.length > 0 || preselectedPlan) && hasTenant) {
    return (
      <div className="bp-shell">
        <div className="bp-page">
          {/* Header avec retour */}
          <button onClick={() => navigate('/dashboard')} className="bp-back">
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>

          {/* Message d'expiration d'essai */}
          {fromExpired && (
            <div className="bp-alert bp-alert-danger">
              <Clock size={20} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <h2 className="bp-alert-title">{t('billing.trialExpired')}</h2>
                <p className="bp-alert-text">{t('billing.choosePaidPlan')}</p>
              </div>
            </div>
          )}

          {/* Message suspension compte */}
          {fromSuspended && (
            <div className="bp-alert bp-alert-danger">
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <h2 className="bp-alert-title">Compte suspendu</h2>
                <p className="bp-alert-text">
                  Sélectionnez un plan et demandez un code de paiement pour réactiver votre compte.
                </p>
              </div>
            </div>
          )}

          <h1 className="bp-title" style={{ fontSize: 26, marginBottom: 8 }}>
            {t('billing.chooseYourPlan')}
          </h1>
          <p className="bp-subtitle" style={{ marginBottom: 32 }}>
            {t('billing.selectPaidPlanDescription')}
          </p>

          {voucherResponse && fromSuspended ? (
            <div className="bp-card">
              <div className="bp-card-strip bp-strip-active" />
              <div className="bp-card-inner">
                <div className="bp-voucher-label">Code de paiement généré</div>
                <div className="bp-voucher-box">
                  <div className="bp-voucher-code">{voucherResponse.voucherCode}</div>
                  <button onClick={() => copyToClipboard(voucherResponse.voucherCode)} className="bp-btn-amber-solid">
                    Copier
                  </button>
                </div>
                <div className="bp-voucher-detail">
                  <div>Plan : <strong style={{ color: '#e0e0f0' }}>{voucherResponse.plan?.name}</strong></div>
                  <div>Montant : <strong style={{ color: '#e0e0f0' }}>
                    {voucherResponse.amount.currency} {(voucherResponse.amount.cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                  </strong></div>
                  <div className="bp-voucher-note">
                    Utilisez ce code pour votre paiement. Un administrateur validera votre abonnement sous peu.
                  </div>
                </div>
                <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    ⏱️ Important
                  </div>
                  <div style={{ fontSize: 13, color: '#8080a0', lineHeight: 1.6 }}>
                    Veuillez effectuer votre paiement dans les <strong style={{ color: '#e0e0f0' }}>48 heures</strong>.
                    Un administrateur validera votre paiement sous 24h.
                  </div>
                </div>

                <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: '#3b82f6', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    📋 Prochaines étapes
                  </div>
                  <div style={{ fontSize: 13, color: '#8080a0', lineHeight: 1.6 }}>
                    1. Effectuez le paiement avec le code ci-dessus<br/>
                    2. Cliquez sur "J'ai effectué le paiement" ci-dessous<br/>
                    3. Un administrateur validera et activera votre compte
                  </div>
                </div>

                <button
                  onClick={async () => {
                    if (!voucherResponse?.voucherCode || !tenantId) return;
                    if (!window.confirm(`Confirmer que vous avez effectué le paiement avec le code ${voucherResponse.voucherCode} ?`)) return;
                    try {
                      await api.post('/billing/payment-sent', { voucherCode: voucherResponse.voucherCode });
                      alert('Paiement confirmé ! Un administrateur va valider votre demande.');
                    } catch (e: any) {
                      alert(e.message || 'Erreur lors de la confirmation');
                    }
                  }}
                  className="bp-btn-primary"
                  style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
                >
                  <CheckCircle2 size={16} />
                  J'ai effectué le paiement
                </button>
              </div>
            </div>
          ) : (
            <>
              {plansLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <div className="bp-spinner-sm" />
                </div>
              ) : plans.length > 0 ? (
                <div className="bp-plan-grid">
                  {plans.map((plan, i) => {
                    const isPre = preselectedPlan?.code === plan.code;
                    return (
                      <div
                        key={plan.code}
                        onClick={() => handlePlanSelect(plan)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePlanSelect(plan); }}
                        className={`bp-plan-card${isPre ? ' bp-plan-card-selected' : ''}`}
                        style={{ animationDelay: `${i * 40}ms`, animation: 'bp-fade-up 280ms cubic-bezier(0.16,1,0.3,1) both' }}
                      >
                        {isPre && (
                          <div className="bp-plan-badge">
                            <CheckCircle2 size={13} />
                          </div>
                        )}
                        <div className="bp-plan-icon">
                          <Package size={16} />
                        </div>
                        <h3 className="bp-plan-card-name">{t(`pricing.planNames.${plan.code}`)}</h3>
                        <div className="bp-plan-price-row">
                          <span className="bp-plan-price">{plan.price_display}</span>
                          <span className="bp-plan-per">{plan.per}</span>
                        </div>
                        <div className="bp-divider" style={{ margin: '0 0 12px' }} />
                        <p className="bp-plan-desc" style={{ marginTop: 0 }}>
                          {t(`pricing.plans.${plan.code}`)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: '#3a3a58', textAlign: 'center' }}>
                  {t('billing.noPlansAvailable')}
                </p>
              )}
            </>
          )}

          {/* Bouton de retour */}
          <div style={{ textAlign: 'center' }}>
            <button onClick={() => navigate('/dashboard')} className="bp-btn-ghost">
              {t('common.back')}
            </button>
          </div>
        </div>

        {/* Modal de confirmation */}
        {selectedPlan && (
          <div className="bp-modal-overlay" onClick={() => setSelectedPlan(null)}>
            <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="bp-modal-header">
                <h3 className="bp-modal-title">{t('billing.confirmSelection')}</h3>
                <button onClick={() => setSelectedPlan(null)} className="bp-icon-btn" aria-label="Fermer">
                  <X size={13} strokeWidth={2.5} />
                </button>
              </div>

              <p style={{ color: '#8080a0', marginBottom: 10, fontSize: 13.5 }}>
                {t('billing.youSelected')}
              </p>

              <div className="bp-modal-summary">
                <div>
                  <div className="bp-modal-plan-name">{t(`pricing.planNames.${selectedPlan.code}`)}</div>
                  <div className="bp-modal-plan-per">{selectedPlan.per}</div>
                </div>
                <div className="bp-modal-plan-price">{selectedPlan.price_display}</div>
              </div>

              {user?.email && (
                <p className="bp-modal-note">
                  {t('billing.willBeChargedTo')}: <strong style={{ color: '#e0e0f0' }}>{user.email}</strong>
                </p>
              )}

              <div className="bp-modal-actions">
                <button onClick={() => setSelectedPlan(null)} className="bp-btn-ghost">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => {
                    handleRequestVoucher();
                  }}
                  disabled={voucherLoading}
                  className="bp-btn-purple"
                >
                  {voucherLoading ? 'Génération...' : 'Demander un code de paiement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sinon, afficher la page de gestion d'abonnement classique
  return (
    <div className="bp-shell">
      <div className="bp-page">

        {/* ── Page header ── */}
        <div className="bp-header">
          <div className="bp-eyebrow">
            <CreditCard size={11} />
            Facturation
          </div>
          <h1 className="bp-title">Abonnement &amp; Paiements</h1>
          <p className="bp-subtitle">
            Gérez votre plan, consultez l'historique et mettez à jour votre abonnement.
          </p>
        </div>

        {/* ── Subscription card ── */}
        {subscription ? (
          <div className="bp-card">
            <div className={`bp-card-strip bp-strip-${subscription.status}`} />
            <div className="bp-card-inner">

              {/* Top row: plan name + price */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 22 }}>
                <div>
                  <div className="bp-card-eyebrow">Plan actuel</div>
                  <h2 className="bp-plan-headline">{subscription.plan.name}</h2>
                  <StatusPill status={subscription.status} />
                </div>

                <div style={{ textAlign: 'right' }}>
                  {subscription.plan.is_trial ? (
                    <div className="bp-price-free">Gratuit</div>
                  ) : (
                    <>
                      <div className="bp-price">
                        {subscription.plan.currency}&nbsp;
                        {(subscription.plan.price_cents / 100).toLocaleString('fr-FR')}
                      </div>
                      <div className="bp-price-period">{periodLabel(subscription.plan.period)}</div>
                    </>
                  )}
                </div>
              </div>

              <div className="bp-divider" />

              {/* Quotas grid */}
              <div className="bp-quota-grid">
                <QuotaItem
                  Icon={Users} label="Utilisateurs"
                  value={subscription.plan.max_users ?? '∞'}
                  iconClass="bp-quota-icon-blue"
                />
                <QuotaItem
                  Icon={LayoutGrid} label="Tables"
                  value={subscription.plan.max_tables ?? '∞'}
                  iconClass="bp-quota-icon-purple"
                />
                <QuotaItem
                  Icon={Package} label="Produits"
                  value={subscription.plan.max_products?.toLocaleString() ?? '∞'}
                  iconClass="bp-quota-icon-amber"
                />
              </div>

              <div className="bp-divider" />

              {/* Period info — circular progress signature element */}
              {periodEnd && (
                <div className={`bp-period-row${isLowTime ? ' bp-period-row-warn' : ''}`}>
                  <RadialProgress percent={progressPercent} warn={isLowTime}>
                    <div className="bp-ring-num">{remaining}</div>
                    <div className="bp-ring-unit">jours</div>
                  </RadialProgress>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="bp-period-label">
                      <Calendar size={11} />
                      {subscription.status === 'trialing' ? "Fin de l'essai" : 'Prochain renouvellement'}
                    </div>
                    <div className="bp-period-date">{formatDate(periodEnd)}</div>
                  </div>

                  {isLowTime && (
                    <div className="bp-period-warn-badge">
                      <AlertTriangle size={11} /> Bientôt
                    </div>
                  )}
                </div>
              )}

              {/* CTAs */}
              <div className="bp-cta-row">
                {/* Renew inline — for expired we bypass /pricing entirely.
                    Pass tenant_id so the tenant is not recreated. */}
                {isExpired && subscription && (
                  <button
                    onClick={() => {
                      if (!currentTenantId) return;
                      navigate(`/checkout?tenant_id=${currentTenantId}&plan_code=${subscription.plan.code}&method=mobile_money&provider=mtn_zm&from=expired`);
                    }}
                    className="bp-btn-primary"
                  >
                    <CreditCard size={14} />
                    Renouveler mon abonnement
                  </button>
                )}

                {!isExpired && (
                  <button onClick={() => navigate('/pricing')} className="bp-btn-primary">
                    <ArrowUpRight size={14} />
                    {subscription.status === 'trialing' ? 'Choisir un plan payant' : 'Changer de plan'}
                  </button>
                )}

                <button
                  onClick={async () => {
                    if (!window.confirm('Voulez-vous vraiment annuler votre abonnement ?')) return;
                    try {
                      if (!currentTenantId) {
                        alert('Tenant manquant — impossible d’annuler.');
                        return;
                      }
                      await api.saas.cancelSubscription(currentTenantId);
                      await load();
                    } catch (e: any) {
                      alert(e.message || 'Annulation impossible');
                    }
                  }}
                  className="bp-btn-danger"
                >
                  Annuler l'abonnement
                </button>
              </div>
            </div>
          </div>

        ) : (
          /* ── No subscription ── */
          <div className="bp-empty" style={{ marginBottom: 16 }}>
            <div className="bp-empty-icon">
              <ShieldCheck size={24} />
            </div>
            <h3 className="bp-empty-title">Aucun abonnement actif</h3>
            <p className="bp-empty-sub">Choisissez un plan pour débloquer toutes les fonctionnalités.</p>
            <button onClick={() => navigate('/pricing')} className="bp-btn-primary">
              Voir les plans disponibles
            </button>
          </div>
        )}

        {/* ── Payment history ── */}
        <div className="bp-card" style={{ marginBottom: 0 }}>
          <div className="bp-card-inner">
            <div className="bp-section-head">
              <div className="bp-section-icon">
                <CreditCard size={14} />
              </div>
              <div>
                <div className="bp-section-title">Historique des paiements</div>
                <div className="bp-section-meta">
                  {payments.length > 0
                    ? `${payments.length} transaction${payments.length > 1 ? 's' : ''}`
                    : 'Aucun enregistrement'}
                </div>
              </div>
            </div>

            {payments.length === 0 ? (
              <div className="bp-pay-empty">
                <div className="bp-pay-empty-icon">
                  <Clock size={18} />
                </div>
                <p style={{ color: '#3a3a58', fontSize: 13, margin: 0 }}>
                  Aucun paiement enregistré.
                </p>
              </div>
            ) : (
              <div className="bp-pay-list">
                {payments.map((p, idx) => {
                  const cls = paymentMetaClass(p.status);
                  return (
                    <div
                      key={p.id}
                      className="bp-pay-row"
                      style={{ animationDelay: `${Math.min(idx, 6) * 40}ms`, animation: 'bp-fade-up 280ms cubic-bezier(0.16,1,0.3,1) both' }}
                    >
                      {/* Left: amount + date */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className={`bp-pay-icon ${cls}`}>
                          {p.status === 'completed'
                            ? <CheckCircle2 size={15} />
                            : p.status === 'failed'
                            ? <XCircle size={15} />
                            : p.status === 'refunded'
                            ? <RefreshCw size={15} />
                            : <Clock size={15} />}
                        </div>
                        <div>
                          <div className="bp-pay-amount">{formatAmount(p.amount_cents, p.currency)}</div>
                          <div className="bp-pay-meta">
                            {p.paid_at ? formatDate(p.paid_at) : formatDate(p.created_at)}
                            &nbsp;·&nbsp;
                            {p.payment_method.replace(/_/g, ' ')}
                          </div>
                        </div>
                      </div>

                      {/* Right: status pill */}
                      <div className={`bp-pay-status ${cls}`}>
                        {paymentLabel(p.status)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default BillingPage;