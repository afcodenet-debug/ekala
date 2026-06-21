import React from 'react';
import { useNotificationStore, AppNotification } from '../stores/useNotificationStore';
import { X, Bell, CheckCheck, Package, AlertTriangle, AlertCircle, Info } from 'lucide-react';

// ─── Inject styles once ───────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('nc-styles')) {
  const style = document.createElement('style');
  style.id = 'nc-styles';
  style.textContent = `
    @keyframes nc-slide-in {
      from { opacity: 0; transform: translateX(20px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes nc-backdrop-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .nc-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      z-index: 99999;
      animation: nc-backdrop-in 200ms ease forwards;
    }
    .nc-panel {
      position: fixed;
      top: 0; right: 0; bottom: 0;
      width: 400px;
      background: #0d0d14;
      border-left: 1px solid rgba(255,255,255,0.06);
      z-index: 100000;
      display: flex;
      flex-direction: column;
      box-shadow: -24px 0 60px rgba(0,0,0,0.6), -1px 0 0 rgba(255,255,255,0.04);
      animation: nc-slide-in 260ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    }

    /* ── Header ── */
    .nc-header {
      padding: 20px 20px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
    }
    .nc-header-icon {
      width: 38px; height: 38px;
      border-radius: 10px;
      background: rgba(245,158,11,0.1);
      border: 1px solid rgba(245,158,11,0.18);
      display: flex; align-items: center; justify-content: center;
      color: #f59e0b;
      flex-shrink: 0;
    }
    .nc-header-text { flex: 1; }
    .nc-header-title {
      font-size: 15px; font-weight: 700;
      color: #e8e8f2; letter-spacing: -0.02em;
    }
    .nc-header-sub {
      font-size: 11.5px; color: #4a4a62;
      margin-top: 1px; font-weight: 500;
    }
    .nc-header-actions { display: flex; align-items: center; gap: 8px; }
    .nc-btn-mark-all {
      font-size: 11px; font-weight: 600;
      color: #f59e0b; background: rgba(245,158,11,0.08);
      border: 1px solid rgba(245,158,11,0.2);
      border-radius: 6px; padding: 5px 10px;
      cursor: pointer; letter-spacing: 0.01em;
      transition: background 150ms, color 150ms;
      display: flex; align-items: center; gap: 5px;
      white-space: nowrap;
    }
    .nc-btn-mark-all:hover { background: rgba(245,158,11,0.15); }
    .nc-btn-close {
      width: 30px; height: 30px;
      border-radius: 8px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      color: #4a4a62; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 150ms, color 150ms;
      flex-shrink: 0;
    }
    .nc-btn-close:hover { background: rgba(255,255,255,0.09); color: #8888a8; }

    /* ── Tabs strip (unread / all) ── */
    .nc-tabs {
      display: flex;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    }
    .nc-tab {
      flex: 1; padding: 10px 0;
      font-size: 12px; font-weight: 600;
      letter-spacing: 0.03em; text-transform: uppercase;
      background: none; border: none; cursor: pointer;
      color: #4a4a62;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 150ms, border-color 150ms;
    }
    .nc-tab.active { color: #e8e8f2; border-bottom-color: #f59e0b; }

    /* ── List ── */
    .nc-list {
      flex: 1; overflow-y: auto; padding: 6px 0;
    }
    .nc-list::-webkit-scrollbar { width: 4px; }
    .nc-list::-webkit-scrollbar-track { background: transparent; }
    .nc-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 4px; }

    /* ── Empty state ── */
    .nc-empty {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 12px; padding: 60px 32px;
      color: #2e2e42; text-align: center;
    }
    .nc-empty-icon {
      width: 52px; height: 52px;
      border-radius: 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      display: flex; align-items: center; justify-content: center;
    }
    .nc-empty-title { font-size: 14px; font-weight: 600; color: #3a3a52; }
    .nc-empty-sub { font-size: 12px; color: #28283c; line-height: 1.6; }

    /* ── Notification item ── */
    .nc-item {
      padding: 13px 18px;
      display: flex; gap: 12px; align-items: flex-start;
      cursor: pointer;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      position: relative;
      transition: background 130ms;
    }
    .nc-item:hover { background: rgba(255,255,255,0.025); }
    .nc-item.unread { background: rgba(245,158,11,0.028); }
    .nc-item.unread:hover { background: rgba(245,158,11,0.05); }

    /* Unread indicator dot */
    .nc-unread-dot {
      position: absolute; top: 17px; left: 6px;
      width: 5px; height: 5px; border-radius: 50%;
      background: #f59e0b;
    }

    .nc-item-icon {
      width: 34px; height: 34px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 1px;
    }
    .nc-item-body { flex: 1; min-width: 0; }
    .nc-item-header {
      display: flex; justify-content: space-between;
      align-items: baseline; gap: 8px; margin-bottom: 3px;
    }
    .nc-item-title {
      font-size: 13px; font-weight: 640;
      color: #dcdcee; letter-spacing: -0.01em;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .nc-item-title.read { color: #5a5a78; font-weight: 500; }
    .nc-item-time {
      font-size: 10.5px; color: #3a3a52; font-weight: 500;
      white-space: nowrap; flex-shrink: 0;
    }
    .nc-item-msg {
      font-size: 12px; color: #5a5a78; line-height: 1.55;
    }
    .nc-item-msg.read { color: #38384e; }
    .nc-priority-badge {
      display: inline-flex; align-items: center; gap: 4px;
      margin-top: 6px; padding: 3px 7px;
      border-radius: 5px; font-size: 10px; font-weight: 600;
      letter-spacing: 0.04em; text-transform: uppercase;
    }

    /* ── Footer ── */
    .nc-footer {
      padding: 12px 18px;
      border-top: 1px solid rgba(255,255,255,0.05);
      display: flex; align-items: center; justify-content: center; gap: 6px;
      flex-shrink: 0;
    }
    .nc-footer-dot {
      width: 4px; height: 4px; border-radius: 50%;
      background: rgba(255,255,255,0.12);
    }
    .nc-footer-text {
      font-size: 10.5px; color: #2e2e42; font-weight: 500;
      letter-spacing: 0.02em;
    }
  `;
  document.head.appendChild(style);
}

// ─── Priority config ──────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  critical: {
    color: '#ef4444', bg: 'rgba(239,68,68,0.12)',
    label: 'Critique', icon: <AlertCircle size={15} />,
  },
  high: {
    color: '#f59e0b', bg: 'rgba(245,158,11,0.11)',
    label: 'Priorité haute', icon: <AlertTriangle size={15} />,
  },
  medium: {
    color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',
    label: 'Normale', icon: <Info size={15} />,
  },
  low: {
    color: '#6b7280', bg: 'rgba(107,114,128,0.1)',
    label: 'Basse', icon: <Package size={15} />,
  },
};

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffMin < 1440) return `Il y a ${Math.floor(diffMin / 60)} h`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const [activeTab, setActiveTab] = React.useState<'unread' | 'all'>('all');

  if (!isOpen) return null;

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filtered = activeTab === 'unread' ? sorted.filter((n) => !n.readAt) : sorted;

  const handleItemClick = (notif: AppNotification) => {
    if (!notif.readAt) markAsRead(notif.id);
    if (notif.link) window.location.href = notif.link;
  };

  return (
    <>
      {/* Backdrop */}
      <div className="nc-backdrop" onClick={onClose} />

      {/* Panel */}
      <div className="nc-panel" role="dialog" aria-label="Centre de notifications">
        {/* Header */}
        <div className="nc-header">
          <div className="nc-header-icon">
            <Bell size={18} />
          </div>
          <div className="nc-header-text">
            <div className="nc-header-title">Notifications</div>
            <div className="nc-header-sub">
              {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est à jour'}
            </div>
          </div>
          <div className="nc-header-actions">
            {unreadCount > 0 && (
              <button className="nc-btn-mark-all" onClick={markAllAsRead}>
                <CheckCheck size={12} />
                Tout lire
              </button>
            )}
            <button className="nc-btn-close" onClick={onClose} aria-label="Fermer">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="nc-tabs">
          <button
            className={`nc-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Toutes ({sorted.length})
          </button>
          <button
            className={`nc-tab ${activeTab === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveTab('unread')}
          >
            Non lues{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </button>
        </div>

        {/* List */}
        <div className="nc-list">
          {filtered.length === 0 ? (
            <div className="nc-empty">
              <div className="nc-empty-icon">
                <Bell size={22} />
              </div>
              <div className="nc-empty-title">
                {activeTab === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
              </div>
              <div className="nc-empty-sub">
                {activeTab === 'unread'
                  ? 'Toutes vos notifications ont été lues.'
                  : 'Les nouvelles notifications apparaîtront ici en temps réel.'}
              </div>
            </div>
          ) : (
            filtered.map((notif: AppNotification) => {
              const pConf = PRIORITY_CONFIG[notif.priority] ?? PRIORITY_CONFIG.medium;
              const isUnread = !notif.readAt;
              const isHighPriority = notif.priority === 'high' || notif.priority === 'critical';

              return (
                <div
                  key={notif.id}
                  className={`nc-item ${isUnread ? 'unread' : ''}`}
                  onClick={() => handleItemClick(notif)}
                >
                  {isUnread && <div className="nc-unread-dot" />}

                  {/* Icon */}
                  <div
                    className="nc-item-icon"
                    style={{ background: pConf.bg, color: pConf.color }}
                  >
                    {pConf.icon}
                  </div>

                  {/* Body */}
                  <div className="nc-item-body">
                    <div className="nc-item-header">
                      <div className={`nc-item-title ${!isUnread ? 'read' : ''}`}>
                        {notif.title}
                      </div>
                      <div className="nc-item-time">{formatTime(notif.createdAt)}</div>
                    </div>
                    <div className={`nc-item-msg ${!isUnread ? 'read' : ''}`}>
                      {notif.message}
                    </div>
                    {isHighPriority && (
                      <div
                        className="nc-priority-badge"
                        style={{
                          color: pConf.color,
                          background: pConf.bg,
                          border: `1px solid ${pConf.color}28`,
                        }}
                      >
                        {pConf.icon}
                        {pConf.label}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="nc-footer">
          <div className="nc-footer-dot" />
          <span className="nc-footer-text">Données stockées localement sur cet appareil</span>
          <div className="nc-footer-dot" />
        </div>
      </div>
    </>
  );
};