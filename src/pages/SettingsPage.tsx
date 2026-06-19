import React, { useState, useEffect } from 'react';
import { Globe, Building2, Percent, Printer, Save, RefreshCw, CheckCircle2, AlertCircle, Bell } from 'lucide-react';
import { 
  useSettingsStore, 
  NotificationType, 
  RoleNotificationConfig,
  Currency, 
  Language 
} from '../stores/useSettingsStore';
import { useI18n } from '../lib/i18n';
import { EnterpriseTokens } from '../lib/design-system';
import { useAuthStore } from '../stores/useAuthStore';
import { api } from '../lib/api-client';

const { colors, radius } = EnterpriseTokens;

interface CountryOption {
  code: string;
  name: string;
  currency: Currency;
  flag: string;
}

const COUNTRIES: CountryOption[] = [
  { code: 'ZM', name: 'Zambia', currency: 'ZMW', flag: '🇿🇲' },
  { code: 'CD', name: 'DR Congo', currency: 'CDF', flag: '🇨🇩' },
  { code: 'US', name: 'United States', currency: 'USD', flag: '🇺🇸' },
  { code: 'EU', name: 'Europe', currency: 'EUR', flag: '🇪🇺' },
  { code: 'GB', name: 'United Kingdom', currency: 'EUR', flag: '🇬🇧' },
];

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
];

const CURRENCIES: { code: Currency; label: string; symbol: string }[] = [
  { code: 'ZMW', label: 'Zambian Kwacha', symbol: 'ZK' },
  { code: 'CDF', label: 'Franc Congolais', symbol: 'FC' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
];

export const SettingsPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const settings = useSettingsStore();

  const [activeTab, setActiveTab] = useState<'regional' | 'business' | 'financial' | 'receipt' | 'notifications'>('regional');

  // Local form state for business/financial/receipt ( Regional is direct in store )
  const [form, setForm] = useState({
    businessName: settings.businessName,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    taxRate: settings.taxRate,
    serviceCharge: settings.serviceCharge,
    receiptFooter: settings.receiptFooter,
    autoPrint: settings.autoPrint,
    showLogo: settings.showLogo,
    operatingCountry: settings.operatingCountry,
    notificationEmail: settings.emailForwardTo || '',
    emailNotificationsEnabled: settings.emailNotificationsEnabled ?? true,
    additionalForwardEmail: '',
    notifyAdmin: true,
    notifyManager: true,
    notifyServer: true,
    proDigestMode: false,
    proQuietHours: false,
    roleConfigs: {
      ADMIN: { notifications: { lowStock: true, inventory: true, stockAdj: true, sales: true, newProduct: true }, emails: ['admin@olive.com'] },
      MANAGER: { notifications: { lowStock: true, inventory: true, stockAdj: true, sales: true }, emails: [] },
      SERVER: { notifications: { sales: true, orderConfirm: true }, emails: [] },
    },
  });

  // Draft for notifications tab (saved only via global Save button)
  const [notificationDraft, setNotificationDraft] = useState<RoleNotificationConfig>(settings.roleNotificationConfig);

  const [localRates, setLocalRates] = useState(settings.exchangeRates);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [users, setUsers] = useState<any[]>([]);


  const canManageSettings = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    if (canManageSettings) {
      settings.fetchSettings();
    }
  }, [canManageSettings]);

  // Load registered users for notification management
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = (await api.get('/users')) as any;
        setUsers(res?.users ?? res ?? []);
      } catch (e) {
        console.warn('Failed to load users for notifications');
      }
    };
    if (canManageSettings) loadUsers();
  }, [canManageSettings]);

  // Keep draft in sync with store when settings are loaded/refreshed
  useEffect(() => {
    setNotificationDraft(settings.roleNotificationConfig);
  }, [settings.roleNotificationConfig]);

  // No longer needed - the store now manages roleNotificationConfig as a proper object
  // We removed the JSON.parse logic that was causing parse errors.

  const handleCountryChange = (countryCode: string) => {
    const country = COUNTRIES.find(c => c.code === countryCode);
    if (country) {
      setForm(prev => ({ ...prev, operatingCountry: countryCode }));
      settings.updateSettings({ operatingCountry: countryCode, currency: country.currency });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await settings.updateSettings({
        ...form,
        exchangeRates: localRates,
        emailForwardTo: form.notificationEmail,
        emailNotificationsEnabled: form.emailNotificationsEnabled,
        roleNotificationConfig: notificationDraft,
      });

      if (success) {
        await settings.fetchSettings();
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const updateRate = (curr: Currency, rate: number) => {
    setLocalRates(prev => ({ ...prev, [curr]: rate }));
  };

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  const tabList = [
    { id: 'regional', label: t('settings.tabs.regional'), icon: Globe },
    { id: 'business', label: t('settings.tabs.business'), icon: Building2 },
    { id: 'financial', label: t('settings.tabs.financial'), icon: Percent },
    { id: 'receipt', label: t('settings.tabs.receipt'), icon: Printer },
    { id: 'notifications', label: t('settings.tabs.notifications'), icon: Bell },
  ];

  return (
    <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto', animation: 'fade-in 0.4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 300, color: colors.text1, margin: 0, letterSpacing: '-0.02em' }}>
            {t('settings.title')}
          </h1>
          <p style={{ color: colors.text3, marginTop: '8px', fontSize: '15px' }}>
            {t('settings.subtitle')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !isAdmin}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 28px',
            background: saved ? colors.accent.green : colors.accent.gold,
            color: colors.bg,
            border: 'none',
            borderRadius: radius.md,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: '13px',
            cursor: saving || !isAdmin ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: saved ? '0 0 20px rgba(16,185,129,0.3)' : '0 4px 12px rgba(212,175,55,0.2)',
          }}
        >
          {saving ? <RefreshCw size={18} className="animate-spin" /> : saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {saved ? t('common.success') : saving ? t('settings.messages.saving') : t('settings.messages.saveChanges')}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: colors.surface, padding: '4px', borderRadius: radius.lg, marginBottom: '40px', border: `1px solid ${colors.border}` }}>
        {tabList.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: activeTab === tab.id ? colors.card : 'transparent',
              border: 'none',
              borderRadius: radius.md,
              color: activeTab === tab.id ? colors.text1 : colors.text3,
              fontWeight: activeTab === tab.id ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.2s ease',
              fontSize: '14px',
            }}
          >
            <tab.icon size={18} style={{ color: activeTab === tab.id ? colors.accent.gold : colors.text3 }} /> 
            {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-slide">
        {/* REGIONAL */}
        {activeTab === 'regional' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px' }}>
            <div style={{ background: colors.card, padding: '24px', borderRadius: radius.lg, border: `1px solid ${colors.border}` }}>
              <h3 style={{ marginBottom: '20px', color: colors.text1, fontSize: '18px', fontWeight: 600 }}>{t('settings.sections.operatingCountry')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {COUNTRIES.map(country => (
                  <button
                    key={country.code}
                    onClick={() => handleCountryChange(country.code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      background: form.operatingCountry === country.code ? colors.accent.goldDim : colors.surface,
                      border: `1px solid ${form.operatingCountry === country.code ? colors.accent.gold : colors.border}`,
                      borderRadius: radius.md,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '28px' }}>{country.flag}</span>
                      <span style={{ fontWeight: 600, color: colors.text1 }}>{country.name}</span>
                    </span>
                    <span className="mono" style={{ color: colors.accent.gold, fontWeight: 700 }}>{country.currency}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: colors.card, padding: '24px', borderRadius: radius.lg, border: `1px solid ${colors.border}` }}>
              <h3 style={{ marginBottom: '20px', color: colors.text1, fontSize: '18px', fontWeight: 600 }}>{t('settings.sections.languageCurrency')}</h3>

              <div style={{ marginBottom: '32px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: colors.text3, marginBottom: '12px', letterSpacing: '0.1em' }}>{t('settings.labels.displayLanguage')}</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => settings.setLanguage(l.code)}
                      style={{
                        padding: '12px 20px',
                        background: settings.language === l.code ? colors.accent.blueDim : colors.surface,
                        border: `1px solid ${settings.language === l.code ? colors.accent.blue : colors.border}`,
                        borderRadius: radius.md,
                        color: settings.language === l.code ? colors.accent.blue : colors.text2,
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>{l.flag}</span> {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: colors.text3, marginBottom: '12px', letterSpacing: '0.1em' }}>{t('settings.labels.baseCurrency')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  {CURRENCIES.map(c => (
                    <button
                      key={c.code}
                      onClick={() => settings.setCurrency(c.code)}
                      style={{
                        padding: '16px',
                        background: settings.currency === c.code ? colors.accent.goldDim : colors.surface,
                        border: `1px solid ${settings.currency === c.code ? colors.accent.gold : colors.border}`,
                        borderRadius: radius.md,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div className="mono" style={{ fontWeight: 800, fontSize: '18px', color: colors.text1 }}>{c.symbol} {c.code}</div>
                      <div style={{ fontSize: '12px', color: colors.text3, marginTop: '4px' }}>{c.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BUSINESS */}
        {activeTab === 'business' && (
          <div style={{ background: colors.card, padding: '32px', borderRadius: radius.lg, border: `1px solid ${colors.border}`, maxWidth: '800px' }}>
            <div style={{ display: 'grid', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: colors.text2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('settings.labels.restaurantName')}</label>
                  <input
                    aria-label="Restaurant name"
                    title="Restaurant name"
                    value={form.businessName}
                  onChange={e => setForm({ ...form, businessName: e.target.value })}
                  style={{ width: '100%', padding: '14px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, color: colors.text1, fontSize: '15px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: colors.text2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('settings.labels.address')}</label>
                  <input
                    aria-label="Address"
                    title="Address"
                    value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  style={{ width: '100%', padding: '14px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, color: colors.text1, fontSize: '15px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: colors.text2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('settings.labels.phone')}</label>
                    <input
                      aria-label="Phone"
                      title="Phone"
                      value={form.phone} 
                    onChange={e => setForm({ ...form, phone: e.target.value })} 
                    style={{ width: '100%', padding: '14px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, color: colors.text1, fontSize: '15px' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: colors.text2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('settings.labels.email')}</label>
                  <input
                    aria-label="Email"
                    title="Email"
                    value={form.email} 
                    onChange={e => setForm({ ...form, email: e.target.value })} 
                    style={{ width: '100%', padding: '14px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, color: colors.text1, fontSize: '15px' }} 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FINANCIAL */}
        {activeTab === 'financial' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px' }}>
            <div style={{ background: colors.card, padding: '24px', borderRadius: radius.lg, border: `1px solid ${colors.border}` }}>
              <h3 style={{ marginBottom: '24px', color: colors.text1, fontSize: '18px', fontWeight: 600 }}>{t('settings.sections.taxService')}</h3>
              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: colors.text2 }}>{t('settings.labels.taxRate')}</label>
                  <input
                    aria-label="Tax rate"
                    title="Tax rate"
                    type="number" 
                    value={form.taxRate} 
                    onChange={e => setForm({ ...form, taxRate: parseFloat(e.target.value) })} 
                    style={{ width: '100%', padding: '14px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, color: colors.text1, fontSize: '16px' }} 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: colors.text2 }}>{t('settings.labels.serviceCharge')}</label>
                  <input
                    aria-label="Service charge"
                    title="Service charge"
                    type="number" 
                    value={form.serviceCharge} 
                    onChange={e => setForm({ ...form, serviceCharge: parseFloat(e.target.value) })} 
                    style={{ width: '100%', padding: '14px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, color: colors.text1, fontSize: '16px' }} 
                  />
                </div>
              </div>
            </div>

            <div style={{ background: colors.card, padding: '24px', borderRadius: radius.lg, border: `1px solid ${colors.border}` }}>
              <h3 style={{ marginBottom: '24px', color: colors.text1, fontSize: '18px', fontWeight: 600 }}>{t('settings.sections.exchangeRates')}</h3>
              <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: '20px' }}>
                {(['ZMW', 'CDF', 'USD', 'EUR'] as Currency[]).map(curr => (
                  <div key={curr} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ fontWeight: 700, color: colors.text1, fontSize: '15px' }}>{curr}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <span style={{ color: colors.text3, fontSize: '12px' }}>1 ZMW = </span>
                      <input
                        aria-label={`Exchange rate for ${curr}`}
                        title={`Exchange rate for ${curr}`}
                        type="number"
                        step="0.0001"
                        value={localRates[curr]}
                        onChange={e => updateRate(curr, parseFloat(e.target.value))}
                        style={{ width: '140px', padding: '10px', background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.sm, textAlign: 'right', color: colors.accent.gold, fontWeight: 700, fontSize: '15px' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS - Premium Per-User Admin Control */}
        {activeTab === 'notifications' && (
          <div style={{ maxWidth: '1200px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Bell size={28} style={{ color: colors.accent.gold }} />
                  <h2 style={{ fontSize: '26px', fontWeight: 300, color: colors.text1, margin: 0, letterSpacing: '-0.02em' }}>Notification Control Center</h2>
                </div>
                <div style={{ fontSize: '13px', color: colors.accent.gold, fontWeight: 600, marginTop: '4px', letterSpacing: '0.08em' }}>ADMIN • PRECISE USER-LEVEL CONFIGURATION</div>
              </div>
              <div style={{ fontSize: '12px', color: colors.text3, background: colors.surface, padding: '6px 14px', borderRadius: radius.md, border: `1px solid ${colors.border}` }}>
                {users.length} USERS MANAGED
              </div>
            </div>

            {/* Search + Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <input
                type="text"
                aria-label="Search users by name or email"
                title="Search users by name or email"
                placeholder="Search users by name or email..."
                style={{ flex: 1, padding: '14px 20px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, color: colors.text1, fontSize: '15px' }}
                onChange={(e) => {
                  // simple client filter - extend if needed
                }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                {['ALL', 'ADMIN', 'MANAGER', 'CASHIER', 'SERVER', 'WAITER'].map(r => (
                  <button key={r} style={{ padding: '12px 20px', background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.md, color: colors.text2, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>{r}</button>
                ))}
              </div>
            </div>

            {/* Role Email Recipients — Dynamic from users table, filtered by role */}
            <div style={{ marginBottom: '40px' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text2, letterSpacing: '0.08em' }}>ROLE EMAIL RECIPIENTS</div>
                <div style={{ fontSize: '12px', color: colors.text3, marginTop: '4px' }}>
                  Emails are dynamically loaded from the users table and filtered by role. Select recipients for each role.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
                {(['ADMIN', 'MANAGER', 'CASHIER', 'SERVER', 'WAITER'] as const).map(role => {
                  const cfg = notificationDraft[role] || { notifications: {}, emails: [] };
                  const roleUsers = users.filter((u: any) => (u.role || '').toUpperCase() === role);

                  const toggleUserEmail = (email: string, checked: boolean) => {
                    const normalized = email.toLowerCase();
                    let newEmails = [...cfg.emails];
                    if (checked) {
                      if (!newEmails.some(e => e.toLowerCase() === normalized)) newEmails.push(normalized);
                    } else {
                      newEmails = newEmails.filter(e => e.toLowerCase() !== normalized);
                    }
                    setNotificationDraft(prev => ({
                      ...prev,
                      [role]: { ...cfg, emails: newEmails }
                    }));
                  };

                  const enabledNotifs = Object.keys(cfg.notifications || {}).filter((k) => {
                    const notifMap = cfg.notifications as Partial<Record<NotificationType, boolean>>;
                    return notifMap[k as NotificationType];
                  });

                  return (
                    <div key={role} style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: '22px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div style={{ fontWeight: 800, fontSize: '16px', color: colors.text1 }}>{role}</div>
                        <div style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: colors.accent.goldDim, color: colors.accent.gold, fontWeight: 700 }}>
                          {enabledNotifs.length} types
                        </div>
                      </div>

                      {/* Notification Types - Editable per role */}
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '10px', color: colors.text3, marginBottom: '8px', fontWeight: 600 }}>NOTIFICATION TYPES</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          {(['lowStock', 'outOfStock', 'inventory', 'stockAdj', 'newProduct', 'productDeleted', 'sales', 'orderConfirm'] as NotificationType[]).map(key => (
                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: colors.text1 }}>
                              <input
                                type="checkbox"
                                title={`Enable ${key} for ${role}`}
                                aria-label={`Enable ${key} for ${role}`}
                                checked={!!cfg.notifications?.[key]}
                                onChange={e => {
                                  setNotificationDraft(prev => {
                                    const current = prev[role] || { notifications: {}, emails: [] };
                                    return {
                                      ...prev,
                                      [role]: {
                                        ...current,
                                        notifications: {
                                          ...(current.notifications || {}),
                                          [key]: e.target.checked
                                        }
                                      }
                                    };
                                  });
                                }}
                                style={{ width: '16px', height: '16px', accentColor: colors.accent.gold }}
                              />
                              {key.replace(/([A-Z])/g, ' $1')}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Dynamic user list from DB, role-filtered */}
                      <div>
                        <div style={{ fontSize: '10px', color: colors.text3, marginBottom: '8px', fontWeight: 600 }}>
                          SELECT RECIPIENTS ({roleUsers.length} users)
                        </div>

                        {roleUsers.length > 0 ? (
                          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {roleUsers.map((u: any) => {
                              const userEmail = (u.email || '').toLowerCase();
                              const isSelected = cfg.emails.some(e => e.toLowerCase() === userEmail);
                              return (
                                <label
                                  key={u.id}
                                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: colors.surface, borderRadius: radius.sm, cursor: 'pointer' }}
                                >
                                  <input
                                    type="checkbox"
                                    title={`Select recipient ${u.full_name}`}
                                    aria-label={`Select recipient ${u.full_name}`}
                                    checked={isSelected}
                                    onChange={e => toggleUserEmail(userEmail, e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: colors.accent.gold }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '14px', color: colors.text1, fontWeight: 500 }}>{u.full_name}</div>
                                    <div style={{ fontSize: '12px', color: colors.text3, fontFamily: 'monospace' }}>{u.email}</div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: colors.text3, fontStyle: 'italic' }}>
                            No users found for this role.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Master Enable + Info */}
            <div style={{ marginTop: '36px', background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: '22px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  title="Master switch — Enable system-wide notifications"
                  aria-label="Master switch — Enable system-wide notifications"
                  checked={settings.emailNotificationsEnabled}
                  onChange={e => settings.updateSettings({ emailNotificationsEnabled: e.target.checked })}
                  style={{ width: 20, height: 20, accentColor: colors.accent.gold }}
                />
                <span style={{ fontWeight: 700, color: colors.text1, fontSize: '15px' }}>Master switch — Enable system-wide notifications</span>
              </label>
              <div style={{ fontSize: '12px', color: colors.text3 }}>Changes apply instantly on Save</div>
            </div>
          </div>
        )}

        {activeTab === 'receipt' && (
          <div style={{ background: colors.card, padding: '32px', borderRadius: radius.lg, border: `1px solid ${colors.border}`, maxWidth: '800px' }}>
            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px', fontWeight: 700, color: colors.text2, textTransform: 'uppercase' }}>{t('settings.labels.receiptFooter')}</label>
              <textarea
                value={form.receiptFooter}
                onChange={e => setForm({ ...form, receiptFooter: e.target.value })}
                rows={3}
                style={{ width: '100%', padding: '16px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, color: colors.text1, resize: 'vertical', fontSize: '15px', lineHeight: '1.5' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', padding: '16px', background: colors.surface, borderRadius: radius.md, border: `1px solid ${colors.border}`, transition: 'all 0.2s ease' }}>
                <input 
                  type="checkbox" 
                  checked={form.autoPrint} 
                  onChange={e => setForm({ ...form, autoPrint: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: colors.accent.gold }}
                />
                <span style={{ fontSize: '14px', color: colors.text1, fontWeight: 500 }}>{t('settings.labels.autoPrint')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', padding: '16px', background: colors.surface, borderRadius: radius.md, border: `1px solid ${colors.border}`, transition: 'all 0.2s ease' }}>
                <input 
                  type="checkbox" 
                  checked={form.showLogo} 
                  onChange={e => setForm({ ...form, showLogo: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: colors.accent.gold }}
                />
                <span style={{ fontSize: '14px', color: colors.text1, fontWeight: 500 }}>{t('settings.labels.showLogo')}</span>
              </label>
            </div>
          </div>
        )}

        {!isAdmin && (
          <div style={{ marginTop: '40px', padding: '20px', background: colors.accent.redDim, borderRadius: radius.lg, color: colors.accent.red, border: `1px solid ${colors.accent.red}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={20} />
            <span style={{ fontWeight: 600 }}>{t('settings.messages.adminOnly')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;




// Parfait, il faut maintenant que le système  soit au niveau de ce qu'on vient de faire. Que chaque email soit notifié selon son rôle par rapport à la configuration faite et qui est enregistrée dans la BD.. voici à quoi ressemble la valeur json dans la BD : "{"ADMIN":{"notifications":{"lowStock":true,"inventory":true,"stockAdj":true,"sales":true,"newProduct":true,"orderConfirm":true},"emails":["admin@olive.com","imeyinzaji@gmail.com","stevenkabwee@gmail.com"]},
// "MANAGER":{"notifications":{"lowStock":true,"inventory":false,"stockAdj":true,"sales":true,"outOfStock":true,"productDeleted":true,"newProduct":true},"emails":["icmeyinzaji@gmail.com"]},
// "SERVER":{"notifications":{"sales":true,"orderConfirm":true},"emails":[]},
// "WAITER":{"notifications":{"sales":true,"orderConfirm":true,"lowStock":false,"newProduct":false},"emails":["erickmalaba2014@gmail.com"]}}" juste pour que tu aies l’idée enfin de bien configurer le système de notification selon le role et types notification. 
