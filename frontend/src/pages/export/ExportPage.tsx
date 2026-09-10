import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';
import { useState } from 'react';
import { message } from '../../utils/feedback';
import {
  DownloadOutlined, FileExcelOutlined, FileTextOutlined,
  CalendarOutlined, LoadingOutlined,
} from '@ant-design/icons';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────
type Format   = 'xlsx' | 'csv';
type Endpoint = 'bookings' | 'invoices' | 'payments' | 'tenants' | 'spaces' | 'maintenance';

interface ExportCard {
  endpoint:    Endpoint;
  icon:        string;
  title:       string;
  description: string;
  color:       string;
  bg:          string;
  hasDate:     boolean;
  roles:       string[];
}

const EXPORTS: ExportCard[] = [
  { endpoint: 'bookings',    icon: '📅', title: 'Bookings',            description: 'Your bookings with space, dates and pricing',                    color: '#2563eb', bg: '#eff6ff', hasDate: true,  roles: ['SUPER_ADMIN','MANAGER','TENANT_ADMIN','TENANT_EMPLOYEE'] },
  { endpoint: 'invoices',    icon: '🧾', title: 'Invoices',            description: 'Your invoices with amounts, status and due dates',                color: '#7c3aed', bg: '#f5f3ff', hasDate: true,  roles: ['SUPER_ADMIN','FINANCE','MANAGER','TENANT_ADMIN'] },
  { endpoint: 'payments',    icon: '💳', title: 'Payments',            description: 'Your recorded payments with invoice and method details',           color: '#059669', bg: '#f0fdf4', hasDate: true,  roles: ['SUPER_ADMIN','FINANCE','TENANT_ADMIN'] },
  { endpoint: 'maintenance', icon: '🔧', title: 'Maintenance Tickets', description: 'Your maintenance requests and their status',                     color: '#dc2626', bg: '#fef2f2', hasDate: true,  roles: ['TENANT_ADMIN','TENANT_EMPLOYEE'] },
  { endpoint: 'tenants',     icon: '🏗️', title: 'Tenants',             description: 'All tenants with contact info, status and activity counts',     color: '#0891b2', bg: '#ecfeff', hasDate: false, roles: ['SUPER_ADMIN'] },
  { endpoint: 'spaces',      icon: '🏢', title: 'Spaces',              description: 'All spaces with type, capacity, pricing and booking counts',    color: '#d97706', bg: '#fffbeb', hasDate: false, roles: ['SUPER_ADMIN','MANAGER'] },
  { endpoint: 'maintenance', icon: '🔧', title: 'Maintenance Tickets', description: 'All tickets with priority, status, assignee and resolution time', color: '#dc2626', bg: '#fef2f2', hasDate: true,  roles: ['SUPER_ADMIN','MANAGER','MAINTENANCE'] },
];

// ─── Download helper ──────────────────────────────────────────────────────────
async function downloadFile(endpoint: Endpoint, format: Format, params: Record<string, string>) {
  const query    = new URLSearchParams({ format, ...params }).toString();
  const response = await api.get(`/export/${endpoint}?${query}`, { responseType: 'blob' });
  const filename = `${endpoint}_${new Date().toISOString().slice(0, 10)}.${format}`;
  const blob     = new Blob([response.data], {
    type: format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv',
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Single export card ───────────────────────────────────────────────────────
function ExportCard({ card, tenantId, defaultFrom, defaultTo }: {
  card: ExportCard; tenantId: string; defaultFrom: string; defaultTo: string;
}) {
  const { card: CARD, t: th } = usePageTheme();
  const [loading, setLoading] = useState(false);
  const [from,    setFrom]    = useState(defaultFrom);
  const [to,      setTo]      = useState(defaultTo);

  const isTenantRole = ['TENANT_ADMIN', 'TENANT_EMPLOYEE'].includes(useAuthStore.getState().user?.role ?? '');

  const doExport = async (format: Format) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (card.hasDate && from) params.from = from;
      if (card.hasDate && to)   params.to   = to;
      // Scope tenant roles to their own data
      if (isTenantRole && tenantId) {
        params.tenantId = tenantId;
      }
      await downloadFile(card.endpoint, format, params);
      message.success(`${card.title} exported as ${format.toUpperCase()}!`);
    } catch {
      message.error('Export failed — please try again');
    } finally {
      setLoading(false);
    }
  };

  const INPUT: React.CSSProperties = {
    padding: '6px 10px', border: `1px solid ${th.cardBorder}`, borderRadius: 7,
    fontSize: 12, outline: 'none', width: '100%', background: th.inputBg, color: th.text,
  };

  return (
    <div style={{ ...CARD, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
          {card.icon}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: th.text }}>{card.title}</div>
          <div style={{ fontSize: 11, color: th.textSub, marginTop: 2 }}>{card.description}</div>
        </div>
      </div>

      {/* Date range (if applicable) */}
      {card.hasDate && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CalendarOutlined style={{ color: th.textMuted, fontSize: 13 }} />
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={INPUT} />
          <span style={{ fontSize: 11, color: th.textMuted, flexShrink: 0 }}>→</span>
          <input type="date" value={to}   onChange={e => setTo(e.target.value)}   style={INPUT} />
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => doExport('xlsx')}
          disabled={loading}
          style={{ flex: 1, height: 36, borderRadius: 8, border: `1px solid ${card.color}`, background: card.bg, color: card.color, fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onMouseEnter={e => (e.currentTarget.style.background = card.color, e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.background = card.bg, e.currentTarget.style.color = card.color)}
        >
          {loading ? <LoadingOutlined /> : <FileExcelOutlined />}
          Excel
        </button>
        <button
          onClick={() => doExport('csv')}
          disabled={loading}
          style={{ flex: 1, height: 36, borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, color: th.text, fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onMouseEnter={e => (e.currentTarget.style.background = th.hover)}
          onMouseLeave={e => (e.currentTarget.style.background = th.cardBg)}
        >
          {loading ? <LoadingOutlined /> : <FileTextOutlined />}
          CSV
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ExportPage() {
  const { card: CARD, headerCard, t: th } = usePageTheme();
  const { user } = useAuthStore();
  const role     = user?.role ?? '';
  const tenantId = (user as any)?.tenant_id ?? '';

  // Default date range: last 30 days
  const defaultTo   = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  // Filter cards by role
  const visibleCards = EXPORTS.filter(c => c.roles.includes(role));

  return (
    <PageShell>

      {/* Header */}
      <div style={headerCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: th.text }}>
              <DownloadOutlined style={{ marginRight: 10, color: '#2563eb' }} />
              Export Center
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: th.textSub }}>
              Download your data as styled Excel spreadsheets or CSV files. Each export includes all relevant fields.
            </p>
          </div>
        </div>

        {/* Tips */}
        <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            { icon: '🟢', text: 'Excel — color-coded, auto-fit columns, ready to share' },
            { icon: '🔵', text: 'CSV — plain text, works in any tool (Python, SQL, etc.)' },
            { icon: '📅', text: 'Date range filters which records are included' },
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: th.textSub }}>
              <span>{tip.icon}</span> {tip.text}
            </div>
          ))}
        </div>
      </div>

      {/* Export cards grid */}
      {visibleCards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: th.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 14 }}>No exports available for your role</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {visibleCards.map(card => (
            <ExportCard
              key={card.endpoint}
              card={card}
              tenantId={tenantId}
              defaultFrom={defaultFrom}
              defaultTo={defaultTo}
            />
          ))}
        </div>
      )}

      {/* Role badge */}
      <div style={{ marginTop: 24, fontSize: 12, color: th.textMuted, textAlign: 'center' }}>
        Showing {visibleCards.length} export{visibleCards.length !== 1 ? 's' : ''} available for your role
        <span style={{ marginLeft: 8, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 8, fontWeight: 600 }}>
          {role.replace(/_/g, ' ')}
        </span>
      </div>
    </PageShell>
  );
}