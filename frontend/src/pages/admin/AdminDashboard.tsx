import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  BankOutlined, AppstoreOutlined, TeamOutlined,
  CalendarOutlined, CreditCardOutlined, ToolOutlined,
  ArrowRightOutlined, ReloadOutlined, FileTextOutlined,
  WarningOutlined, ClockCircleOutlined,
  BellOutlined,
} from '@ant-design/icons';
import {
  siteApi, spaceApi, tenantApi, bookingApi,
  billingApi, maintenanceApi, userApi, contractApi,
} from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import PageShell from '../../components/ui/PageShell';
import PageHeader from '../../components/ui/PageHeader';
import RoleDashboardHero from '../../components/RoleDashboardHero';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toArray<T>(raw: any): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}
function fmtMonth(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}
function fmtAmt(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function getUrgencyColor(days: number): string {
  if (days <= 0)  return '#b91c1c';
  if (days <= 7)  return '#dc2626';
  if (days <= 30) return '#dc2626';
  if (days <= 60) return '#d97706';
  return '#92400e';
}
function getUrgencyBg(days: number): string {
  if (days <= 30) return '#fef2f2';
  if (days <= 60) return '#fffbeb';
  return '#fefce8';
}

const BOOKING_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  CONFIRMED:        { bg: '#dcfce7', color: '#15803d', label: 'Confirmed'  },
  PENDING_APPROVAL: { bg: '#fef3c7', color: '#92400e', label: 'Pending'    },
  CHECKED_IN:       { bg: '#dbeafe', color: '#1d4ed8', label: 'Checked In' },
  COMPLETED:        { bg: '#ede9fe', color: '#6d28d9', label: 'Completed'  },
  CANCELLED:        { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelled'  },
  DRAFT:            { bg: '#f1f5f9', color: '#475569', label: 'Draft'      },
};
const TENANT_STATUS: Record<string, { bg: string; color: string }> = {
  ACTIVE:    { bg: '#dcfce7', color: '#15803d' },
  TRIAL:     { bg: '#dbeafe', color: '#1d4ed8' },
  SUSPENDED: { bg: '#fee2e2', color: '#b91c1c' },
  CLOSED:    { bg: '#f1f5f9', color: '#475569' },
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, isCurrency = false }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      {label && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#fff' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <strong>{isCurrency ? `$${Number(p.value).toLocaleString()}` : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, bg, icon, path, loading }: {
  label: string; value: string | number; sub: string;
  color: string; bg: string; icon: React.ReactNode;
  path?: string; loading?: boolean;
}) {
  const navigate = useNavigate();
  const { t } = useThemeStore();
  return (
    <div style={{ background: t.cardBg, borderRadius: 14, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardShadow, padding: '18px 20px', cursor: path ? 'pointer' : 'default', transition: 'all 0.15s' }}
      onClick={() => path && navigate(path)}
      onMouseEnter={e => path && (e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)')}
      onMouseLeave={e => path && (e.currentTarget.style.boxShadow = t.cardShadow)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, color }}>{icon}</div>
        {path && <ArrowRightOutlined style={{ color: t.textMuted, fontSize: 13 }} />}
      </div>
      {loading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
        <>
          <div style={{ fontSize: 32, fontWeight: 900, color: t.text, lineHeight: 1, marginBottom: 4 }}>{value}</div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 11, color }}>{sub}</div>
        </>
      )}
      <div style={{ marginTop: 12, height: 3, background: t.divider, borderRadius: 2 }}>
        <div style={{ height: 3, borderRadius: 2, background: color, width: '60%' }} />
      </div>
    </div>
  );
}

// ─── Contract Renewal Widget ───────────────────────────────────────────────────
function ContractRenewalWidget({ contracts, loading, navigate }: { contracts: any[]; loading: boolean; navigate: (p: string) => void }) {
  const { t } = useThemeStore();

  const expiring = contracts
    .filter(c => c.status === 'ACTIVE')
    .map(c => ({ ...c, days: daysUntil(c.end_date) }))
    .filter(c => c.days <= 90)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  const expired = expiring.filter(c => c.days <= 0).length;
  const urgent  = expiring.filter(c => c.days > 0 && c.days <= 30).length;

  return (
    <div style={{ background: t.cardBg, borderRadius: 14, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardShadow }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BellOutlined style={{ color: expired > 0 || urgent > 0 ? '#dc2626' : '#d97706', fontSize: 16 }} />
          <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>Contract Renewals</div>
          {(expired + urgent) > 0 && (
            <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
              {expired + urgent} urgent
            </span>
          )}
        </div>
        <button onClick={() => navigate('/admin/contracts/renewals')}
          style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          View all →
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
      ) : expiring.length === 0 ? (
        <div style={{ padding: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>All clear!</div>
          <div style={{ fontSize: 12, color: t.textMuted }}>No contracts expiring in 90 days</div>
        </div>
      ) : (
        <div style={{ padding: '8px 0' }}>
          {expiring.map((c, i) => {
            const urgColor = getUrgencyColor(c.days);
            const urgBg    = getUrgencyBg(c.days);
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: i < expiring.length - 1 ? `1px solid ${t.divider}` : 'none', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: urgBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileTextOutlined style={{ color: urgColor, fontSize: 14 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.tenant?.name ?? 'Tenant'}
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted, fontFamily: 'monospace' }}>{c.contract_number}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 3 }}>Ends {formatDate(c.end_date)}</div>
                  <span style={{ background: urgBg, color: urgColor, border: `1px solid ${urgColor}33`, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
                    {c.days <= 0 ? 'EXPIRED' : `${c.days}d left`}
                  </span>
                </div>
              </div>
            );
          })}
          <div style={{ padding: '10px 20px 4px' }}>
            <button onClick={() => navigate('/admin/contracts/renewals')}
              style={{ width: '100%', padding: '9px', borderRadius: 9, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Manage All Renewals →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t }    = useThemeStore();
  const billingPath = '/admin/analytics';
  const [refreshKey, setRefreshKey] = useState(0);

  // ── CARD now uses t ──
  const CARD: React.CSSProperties = {
    background: t.cardBg, borderRadius: 14,
    border: `1px solid ${t.cardBorder}`,
    boxShadow: t.cardShadow,
  };

  const opts = (key: string) => ({ queryKey: [key, refreshKey] });
  const { data: sitesRaw,      isLoading: l1 } = useQuery({ ...opts('d-sites'),      queryFn: () => siteApi.getAll() });
  const { data: spacesRaw,     isLoading: l2 } = useQuery({ ...opts('d-spaces'),     queryFn: () => spaceApi.getAll() });
  const { data: tenantsRaw,    isLoading: l3 } = useQuery({ ...opts('d-tenants'),    queryFn: () => tenantApi.getAll().then(r => r.data) });
  const { isLoading: l4 } = useQuery({ ...opts('d-users'), queryFn: () => userApi.getAll().then(r => r.data) });
  const { data: bookingsRaw,   isLoading: l5 } = useQuery({ ...opts('d-bookings'),   queryFn: () => bookingApi.getAll().then(r => r.data) });
  const { data: invoicesRaw,   isLoading: l6 } = useQuery({ ...opts('d-invoices'),   queryFn: () => billingApi.getInvoices().then(r => r.data) });
  const { data: paymentsRaw,   isLoading: l7 } = useQuery({ ...opts('d-payments'),   queryFn: () => billingApi.getPayments().then(r => r.data) });
  const { data: contractsRaw,  isLoading: l8 } = useQuery({ ...opts('d-contracts'),  queryFn: () => contractApi.getAll().then(r => r.data) });
  const { data: mxStats,       isLoading: l9 } = useQuery({ ...opts('d-mx'),         queryFn: () => maintenanceApi.getStats().then(r => r.data) });
  const { data: summary }                       = useQuery({ ...opts('d-summary'),    queryFn: () => billingApi.getFinancialSummary().then(r => r.data) });

  const isLoading = l1||l2||l3||l4||l5||l6||l7||l8||l9;

  const sites     = toArray<any>(sitesRaw);
  const spaces    = toArray<any>(spacesRaw);
  const tenants   = toArray<any>(tenantsRaw);
  const bookings  = toArray<any>(bookingsRaw);
  const invoices  = toArray<any>(invoicesRaw);
  const payments  = toArray<any>(paymentsRaw);
  const contracts = toArray<any>(contractsRaw);

  const available   = spaces.filter(s => s.status === 'AVAILABLE').length;
  const occupied    = spaces.filter(s => s.status === 'OCCUPIED').length;
  const reserved    = spaces.filter(s => s.status === 'RESERVED').length;
  const inMaint     = spaces.filter(s => s.status === 'MAINTENANCE').length;
  const occRate     = spaces.length > 0 ? Math.round((occupied / spaces.length) * 100) : 0;
  const activeTenants   = tenants.filter(t => t.status === 'ACTIVE').length;
  const activeContracts = contracts.filter(c => c.status === 'ACTIVE').length;
  const confirmedBooks  = bookings.filter(b => ['CONFIRMED','CHECKED_IN'].includes(b.status)).length;
  const pendingBooks    = bookings.filter(b => b.status === 'PENDING_APPROVAL').length;
  const overdueInv      = invoices.filter(i => i.status === 'OVERDUE').length;
  const totalRevenue    = Number((summary as any)?.total_paid    ?? 0);
  const totalPending    = Number((summary as any)?.total_pending ?? 0);
  const totalInvoiced   = Number((summary as any)?.total_invoiced ?? 0);
  const collectionRate  = totalInvoiced > 0 ? Math.round((totalRevenue / totalInvoiced) * 100) : 0;
  const completedPays   = payments.filter(p => p.status === 'COMPLETED').reduce((s: number, p: any) => s + parseFloat(p.amount || 0), 0);

  const expiringCount = contracts.filter(c => { const d = daysUntil(c.end_date); return c.status === 'ACTIVE' && d <= 90; }).length;
  const criticalCount = contracts.filter(c => { const d = daysUntil(c.end_date); return c.status === 'ACTIVE' && d <= 30; }).length;

  // Charts
  const revenueChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    payments.filter(p => p.status === 'COMPLETED').forEach(p => {
      const k = fmtMonth(p.payment_date);
      buckets[k] = (buckets[k] || 0) + parseFloat(p.amount || 0);
    });
    return Object.entries(buckets).slice(-6).map(([date, Revenue]) => ({ date, Revenue: Math.round(Revenue) }));
  }, [payments]);

  const bookingChart = useMemo(() => {
    const buckets: Record<string, { Confirmed: number; Pending: number; Cancelled: number }> = {};
    bookings.forEach(b => {
      const k = fmtMonth(b.created_at);
      if (!buckets[k]) buckets[k] = { Confirmed: 0, Pending: 0, Cancelled: 0 };
      if (['CONFIRMED','CHECKED_IN','COMPLETED'].includes(b.status)) buckets[k].Confirmed++;
      else if (b.status === 'PENDING_APPROVAL') buckets[k].Pending++;
      else if (b.status === 'CANCELLED') buckets[k].Cancelled++;
    });
    return Object.entries(buckets).slice(-6).map(([date, v]) => ({ date, ...v }));
  }, [bookings]);

  const spaceStatusChart = [
    { name: 'Available',   value: available, color: '#22c55e' },
    { name: 'Occupied',    value: occupied,  color: '#3b82f6' },
    { name: 'Reserved',    value: reserved,  color: '#f59e0b' },
    { name: 'Maintenance', value: inMaint,   color: '#ef4444' },
  ].filter(s => s.value > 0);

  const invoiceStatusChart = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    const colors: Record<string, string> = { PAID: '#10b981', ISSUED: '#2563eb', SENT: '#8b5cf6', PARTIALLY_PAID: '#f59e0b', OVERDUE: '#ef4444', DRAFT: '#94a3b8', CANCELLED: '#e5e7eb' };
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: colors[name] ?? '#94a3b8' }));
  }, [invoices]);

  const siteOccupancyChart = useMemo(() => {
    return sites.slice(0, 6).map(s => {
      const siteSpaces = spaces.filter(sp => sp.floor?.building?.site_id === s.id);
      const occ = siteSpaces.filter(sp => sp.status === 'OCCUPIED').length;
      const rate = siteSpaces.length > 0 ? Math.round((occ / siteSpaces.length) * 100) : 0;
      return { name: s.name?.length > 10 ? s.name.substring(0, 10) + '…' : s.name, Occupancy: rate };
    });
  }, [sites, spaces]);

  const recentTenants  = [...tenants].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  const recentBookings = [...bookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  const recentInvoices = [...invoices].sort((a, b) => new Date(b.created_at ?? b.issue_date).getTime() - new Date(a.created_at ?? a.issue_date).getTime()).slice(0, 5);

  return (
    <PageShell>

      <PageHeader
        title="Performance Analytics Dashboard"
        subtitle={`Welcome back, ${user?.first_name ?? 'Admin'} · Real-time overview across all sites and tenants`}
        actions={
          <button onClick={() => setRefreshKey(k => k + 1)}
            style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${t.cardBorder}`, background: t.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ReloadOutlined spin={isLoading} /> Refresh
          </button>
        }
      />

      <RoleDashboardHero role={user?.role} userName={user?.first_name} />

      {/* Alert banners */}
      {overdueInv > 0 && (
        <div onClick={() => navigate(billingPath)} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <WarningOutlined style={{ color: '#dc2626', fontSize: 18 }} />
          <span style={{ fontWeight: 600, color: '#b91c1c', fontSize: 14 }}>{overdueInv} overdue invoice{overdueInv > 1 ? 's' : ''} require immediate attention</span>
          <ArrowRightOutlined style={{ color: '#dc2626', marginLeft: 'auto' }} />
        </div>
      )}
      {pendingBooks > 0 && (
        <div onClick={() => navigate('/admin/bookings')} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <ClockCircleOutlined style={{ color: '#d97706', fontSize: 18 }} />
          <span style={{ fontWeight: 600, color: '#92400e', fontSize: 14 }}>{pendingBooks} booking{pendingBooks > 1 ? 's' : ''} awaiting approval</span>
          <ArrowRightOutlined style={{ color: '#d97706', marginLeft: 'auto' }} />
        </div>
      )}
      {criticalCount > 0 && (
        <div onClick={() => navigate('/admin/contracts/renewals')} style={{ background: 'linear-gradient(135deg,#fef2f2,#fff5f5)', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <FileTextOutlined style={{ color: '#dc2626', fontSize: 18 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: '#b91c1c', fontSize: 14 }}>
              {criticalCount} contract{criticalCount > 1 ? 's' : ''} expiring within 30 days!
            </span>
            {expiringCount > criticalCount && (
              <span style={{ color: t.textMuted, fontSize: 12, marginLeft: 8 }}>+{expiringCount - criticalCount} more within 90 days</span>
            )}
          </div>
          <button style={{ padding: '5px 14px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Renew Now →
          </button>
        </div>
      )}

      {/* KPI Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Published Listings" value={spaces.filter((s: any) => s.is_published).length} sub={`${spaces.length} total spaces`} color="#2563eb" bg="#eff6ff" icon={<BankOutlined />} path="/admin/spaces" loading={isLoading} />
        <KpiCard label="Total Spaces"      value={spaces.length}     sub={`${occRate}% occupancy rate`}                                           color="#059669" bg="#f0fdf4" icon={<AppstoreOutlined />}    path="/admin/spaces"       loading={isLoading} />
        <KpiCard label="Active Tenants"    value={activeTenants}     sub={`${tenants.length} total registered`}                                   color="#d97706" bg="#fffbeb" icon={<TeamOutlined />}        path="/admin/tenants"      loading={isLoading} />
        <KpiCard label="Active Contracts"  value={activeContracts}   sub={`${contracts.length} total · ${expiringCount} expiring soon`}           color="#7c3aed" bg="#f5f3ff" icon={<FileTextOutlined />}   path="/admin/contracts"    loading={isLoading} />
      </div>

      {/* KPI Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Revenue Collected" value={`$${Math.round(totalRevenue).toLocaleString()}`}  sub={`${collectionRate}% collection rate`}           color="#059669" bg="#f0fdf4" icon={<CreditCardOutlined />} path={billingPath}      loading={isLoading} />
        <KpiCard label="Pending Revenue"   value={`$${Math.round(totalPending).toLocaleString()}`}  sub="Awaiting payment"                               color="#d97706" bg="#fffbeb" icon={<CreditCardOutlined />} path={billingPath}      loading={isLoading} />
        <KpiCard label="Total Bookings"    value={bookings.length}   sub={`${confirmedBooks} confirmed · ${pendingBooks} pending`}                 color="#2563eb" bg="#eff6ff" icon={<CalendarOutlined />}    path="/admin/bookings"     loading={isLoading} />
        <KpiCard label="Open Tickets"      value={(mxStats as any)?.open ?? 0} sub={`${(mxStats as any)?.in_progress ?? 0} in progress`}          color="#dc2626" bg="#fef2f2" icon={<ToolOutlined />}        path="/admin/maintenance"  loading={isLoading} />
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div><div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>💰 Revenue Collected</div><div style={{ fontSize: 12, color: t.textSub }}>Monthly payments</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 20, fontWeight: 800, color: '#059669' }}>${Math.round(completedPays).toLocaleString()}</div><div style={{ fontSize: 11, color: t.textSub }}>total</div></div>
          </div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : revenueChart.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 8 }}><div style={{ fontSize: 28 }}>📊</div><div style={{ fontSize: 12 }}>No payment data yet</div></div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueChart} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#059669" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.divider} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: t.textMuted }} />
                <YAxis tickFormatter={fmtAmt} tick={{ fontSize: 11, fill: t.textMuted }} width={45} />
                <Tooltip content={<ChartTooltip isCurrency />} />
                <Area type="monotone" dataKey="Revenue" name="Revenue" stroke="#059669" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 3, fill: '#059669' }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div><div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>📅 Booking Trends</div><div style={{ fontSize: 12, color: t.textSub }}>Monthly by status</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb' }}>{bookings.length}</div><div style={{ fontSize: 11, color: t.textSub }}>total</div></div>
          </div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : bookingChart.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 8 }}><div style={{ fontSize: 28 }}>📅</div><div style={{ fontSize: 12 }}>No booking data yet</div></div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bookingChart} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.divider} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: t.textMuted }} />
                <YAxis tick={{ fontSize: 11, fill: t.textMuted }} width={30} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Confirmed" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="Pending"   fill="#f59e0b" radius={[4,4,0,0]} />
                <Bar dataKey="Cancelled" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Space donut */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: t.text, marginBottom: 4 }}>🏢 Space Status</div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 14 }}>{spaces.length} total spaces</div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : (
            <>
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={spaceStatusChart} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value">
                      {spaceStatusChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: t.text }}>{occRate}%</div>
                  <div style={{ fontSize: 10, color: t.textMuted }}>Occupied</div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                {spaceStatusChart.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: t.textSub }}>{s.name}</span>
                    <span style={{ fontWeight: 700, color: t.text }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Invoice donut */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: t.text, marginBottom: 4 }}>🧾 Invoice Status</div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 14 }}>{invoices.length} total · {collectionRate}% collected</div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : invoiceStatusChart.length === 0 ? (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 6 }}><div style={{ fontSize: 28 }}>🧾</div><div style={{ fontSize: 12 }}>No invoices yet</div></div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={invoiceStatusChart} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value">
                    {invoiceStatusChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 10 }}>
                {invoiceStatusChart.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: t.textSub }}>{s.name}</span>
                    <span style={{ fontWeight: 700, color: t.text }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Site occupancy */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: t.text, marginBottom: 4 }}>📍 Occupancy by Site</div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 14 }}>{sites.length} sites · avg {occRate}%</div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : siteOccupancyChart.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 6 }}><div style={{ fontSize: 28 }}>📍</div><div style={{ fontSize: 12 }}>No sites yet</div></div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={siteOccupancyChart} layout="vertical" margin={{ top: 0, right: 30, left: 5, bottom: 0 }} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.divider} horizontal={false} />
                <XAxis type="number" domain={[0,100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: t.textMuted }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: t.textSub }} width={70} />
                <Tooltip formatter={(v) => [`${v}%`, 'Occupancy']} />
                <Bar dataKey="Occupancy" radius={[0,4,4,0]}>
                  {siteOccupancyChart.map((e, i) => (
                    <Cell key={i} fill={e.Occupancy >= 80 ? '#ef4444' : e.Occupancy >= 50 ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Financial summary */}
      <div style={{ ...CARD, padding: '16px 24px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1 }}>
          {[
            { label: 'Total Invoiced',  value: `$${Math.round(totalInvoiced).toLocaleString()}`, color: '#2563eb' },
            { label: 'Collected',       value: `$${Math.round(totalRevenue).toLocaleString()}`,  color: '#059669' },
            { label: 'Pending',         value: `$${Math.round(totalPending).toLocaleString()}`,  color: '#f59e0b' },
            { label: 'Overdue',         value: `${overdueInv} invoices`,                          color: overdueInv > 0 ? '#dc2626' : t.textMuted },
            { label: 'Collection Rate', value: `${collectionRate}%`,                              color: collectionRate >= 80 ? '#059669' : '#d97706' },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '8px 0', borderRight: i < 4 ? `1px solid ${t.divider}` : 'none' }}>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{isLoading ? '—' : item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom tables + Contract Renewal Widget */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Recent Tenants */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>🏢 Recent Tenants</div>
            <button onClick={() => navigate('/admin/tenants')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          {isLoading ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
            : recentTenants.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>No tenants yet</div>
            : recentTenants.map((tn: any, i: number) => {
              const ts = TENANT_STATUS[tn.status] ?? { bg: '#f1f5f9', color: '#475569' };
              return (
                <div key={tn.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px', borderBottom: i < recentTenants.length - 1 ? `1px solid ${t.divider}` : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                  onClick={() => navigate(`/admin/tenants/${tn.id}`)}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff', flexShrink: 0 }}>
                    {tn.name[0]}{tn.name.split(' ')[1]?.[0] ?? ''}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tn.name}</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>{tn.contact_email}</div>
                  </div>
                  <span style={{ background: ts.bg, color: ts.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>{tn.status}</span>
                </div>
              );
            })}
        </div>

        {/* Recent Bookings */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>📅 Recent Bookings</div>
            <button onClick={() => navigate('/admin/bookings')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          {isLoading ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
            : recentBookings.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>No bookings yet</div>
            : recentBookings.map((b: any, i: number) => {
              const bs = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.DRAFT;
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px', borderBottom: i < recentBookings.length - 1 ? `1px solid ${t.divider}` : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CalendarOutlined style={{ color: '#2563eb', fontSize: 14 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: t.text, fontFamily: 'monospace' }}>{b.booking_number}</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>{b.space?.name ?? 'Space'} · {new Date(b.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>${parseFloat(b.total_price).toLocaleString()}</div>
                    <span style={{ background: bs.bg, color: bs.color, fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 20 }}>{bs.label}</span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Contract Renewal Widget */}
        <ContractRenewalWidget contracts={contracts} loading={isLoading} navigate={navigate} />
      </div>

      {/* Recent Invoices */}
      <div style={CARD}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>🧾 Recent Invoices</div>
          <button onClick={() => navigate(billingPath)} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', padding: '10px 20px', background: t.tableHead, borderBottom: `1px solid ${t.divider}`, fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>Invoice #</span><span>Type</span><span>Due Date</span><span>Amount</span><span>Status</span>
        </div>
        {isLoading ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
          : recentInvoices.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>No invoices yet</div>
          : recentInvoices.map((inv: any, i: number) => {
            const isPaid    = inv.status === 'PAID';
            const isOverdue = inv.status === 'OVERDUE';
            return (
              <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', padding: '12px 20px', borderBottom: i < recentInvoices.length - 1 ? `1px solid ${t.divider}` : 'none', alignItems: 'center', background: isOverdue ? '#fff5f5' : '', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = isOverdue ? '#fee2e2' : t.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = isOverdue ? '#fff5f5' : '')}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', fontFamily: 'monospace' }}>{inv.invoice_number}</div>
                <div style={{ fontSize: 11, color: t.textSub }}>{inv.type?.replace(/_/g,' ').toLowerCase()}</div>
                <div style={{ fontSize: 12, color: isOverdue ? '#dc2626' : t.text, fontWeight: isOverdue ? 700 : 400 }}>{formatDate(inv.due_date)}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>${parseFloat(inv.total_amount).toLocaleString()}</div>
                <span style={{ background: isPaid ? '#dcfce7' : isOverdue ? '#fee2e2' : '#dbeafe', color: isPaid ? '#15803d' : isOverdue ? '#b91c1c' : '#1d4ed8', fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 20 }}>
                  {inv.status}
                </span>
              </div>
            );
          })}
      </div>

      {/* Branch overview */}
      {sites.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>📍 Branch Overview</div>
            <button onClick={() => navigate('/admin/spaces')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {sites.slice(0, 4).map((site: any) => {
              const siteSpaces = spaces.filter(sp => sp.floor?.building?.site_id === site.id);
              const siteOcc    = siteSpaces.filter(sp => sp.status === 'OCCUPIED').length;
              const occR       = siteSpaces.length > 0 ? Math.round((siteOcc / siteSpaces.length) * 100) : 0;
              const occColor   = occR >= 80 ? '#22c55e' : occR >= 50 ? '#f59e0b' : '#ef4444';
              return (
                <div key={site.id} style={{ ...CARD, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s' }}
                  onClick={() => navigate('/admin/spaces')}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = t.cardShadow; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: '#fff' }}>{site.code}</div>
                    <span style={{ background: site.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2', color: site.status === 'ACTIVE' ? '#15803d' : '#b91c1c', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{site.status}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: t.text, marginBottom: 2 }}>{site.name}</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}>{site.city}, {site.country}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11 }}>
                    <span style={{ color: t.textSub }}>Occupancy</span>
                    <span style={{ fontWeight: 700, color: occColor }}>{occR}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: t.divider, overflow: 'hidden' }}>
                    <div style={{ width: `${occR}%`, height: '100%', background: occColor, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PageShell>
  );
}