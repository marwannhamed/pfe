import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { ReloadOutlined } from '@ant-design/icons';
import { bookingApi, billingApi, contractApi, siteApi, spaceApi, tenantApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { can } from '../../permissions/can';
import type { Booking, ChartTooltipProps, Invoice, LeaseContract, Payment, Site, Space, Tenant } from '../../types';

// --- Types & Helpers ----------------------------------------------------------
type Range = '7d' | '30d' | '3m' | '1y';

const EMPTY_LIST: readonly unknown[] = [];

function toArray<T>(raw: unknown): T[] {
  if (!raw) return EMPTY_LIST as unknown as T[];
  if (Array.isArray(raw)) return raw as T[];
  const nested = (raw as { data?: unknown }).data;
  if (Array.isArray(nested)) return nested as T[];
  return EMPTY_LIST as unknown as T[];
}

function getRangeStart(range: Range): Date {
  const now = new Date();
  if (range === '7d')  return new Date(now.getTime() - 7  * 86400000);
  if (range === '30d') return new Date(now.getTime() - 30 * 86400000);
  if (range === '3m')  return new Date(now.getTime() - 90 * 86400000);
  return new Date(now.getTime() - 365 * 86400000);
}

function fmtMonth(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}
function fmtDay(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtAmt(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

// --- Constants ----------------------------------------------------------------
const PALETTE = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  PAID:           '#10b981',
  ISSUED:         '#2563eb',
  SENT:           '#8b5cf6',
  PARTIALLY_PAID: '#f59e0b',
  OVERDUE:        '#ef4444',
  DRAFT:          '#94a3b8',
  CANCELLED:      '#e5e7eb',
};

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  CASH:           '#10b981',
  CHECK:          '#2563eb',
  BANK_TRANSFER:  '#8b5cf6',
  CREDIT_CARD:    '#f59e0b',
  ONLINE_PAYMENT: '#06b6d4',
};

const METHOD_LABELS: Record<string, string> = {
  CASH:           'Cash',
  CHECK:          'Cheque',
  BANK_TRANSFER:  'Bank Transfer',
  CREDIT_CARD:    'Credit Card',
  ONLINE_PAYMENT: 'Online',
};

// --- Custom Tooltip -----------------------------------------------------------
function ChartTooltip({ active, payload, label, currency = true }: ChartTooltipProps & { currency?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      {label && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#fff', marginBottom: i < payload.length - 1 ? 4 : 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <strong>{currency && p.name !== 'Bookings' && p.name !== 'Count' ? `$${Number(p.value).toLocaleString()}` : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// --- Section Header -----------------------------------------------------------
function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{sub}</p>
    </div>
  );
}

// --- Empty chart placeholder --------------------------------------------------
// Declared here rather than inside ReportsPage: a component created during
// render is a new type on every pass, so React remounts it and it loses state.
function EmptyChart({ height = 200 }: { height?: number }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 32 }}>📊</div>
      <div style={{ fontSize: 12 }}>No data for this period</div>
    </div>
  );
}

// --- KPI Card -----------------------------------------------------------------
function KpiCard({ label, value, sub, color, bg, icon, trend }: {
  label: string; value: string | number; sub: string;
  color: string; bg: string; icon: string; trend?: { value: number; label: string };
}) {
  return (
    <div style={{ ...CARD, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
          <p style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{value}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{sub}</p>
          {trend && (
            <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: trend.value >= 0 ? '#059669' : '#dc2626', background: trend.value >= 0 ? '#f0fdf4' : '#fef2f2', padding: '2px 8px', borderRadius: 20 }}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </div>
          )}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ marginTop: 12, height: 3, background: '#f1f5f9', borderRadius: 2 }}>
        <div style={{ height: 3, borderRadius: 2, background: color, width: '60%' }} />
      </div>
    </div>
  );
}

// --- Page ---------------------------------------------------------------------
export default function ReportsPage() {
  const { user }   = useAuthStore();
  const isSuperAdmin  = user?.role === 'SUPER_ADMIN';
  const isSiteManager = user?.role === 'MANAGER';
  const isFinance     = user?.role === 'FINANCE';
  const canAccess     = isSuperAdmin || isSiteManager || isFinance;

  const [range,        setRange]       = useState<Range>('30d');
  const [refreshKey,   setRefreshKey]  = useState(0);

  const rangeStart = getRangeStart(range);

  // -- Data fetching ------------------------------------------------------------
  const { data: bookingsRaw,  isLoading: l1 } = useQuery({ queryKey: ['rpt-bookings',  refreshKey], queryFn: () => bookingApi.getAll().then(r => r.data) });
  const { data: invoicesRaw,  isLoading: l2 } = useQuery({ queryKey: ['rpt-invoices',  refreshKey], queryFn: () => billingApi.getInvoices().then(r => r.data) });
  const { data: paymentsRaw,  isLoading: l3 } = useQuery({ queryKey: ['rpt-payments',  refreshKey], queryFn: () => billingApi.getPayments().then(r => r.data) });
  const { data: contractsRaw, isLoading: l4 } = useQuery({ queryKey: ['rpt-contracts', refreshKey], queryFn: () => contractApi.getAll().then(r => r.data) });
  const { data: sitesRaw,     isLoading: l5 } = useQuery({ queryKey: ['rpt-sites',     refreshKey], queryFn: () => siteApi.getAll() });
  const canListTenants = can(user?.role, 'tenant.list');
  const { data: tenantsRaw,   isLoading: l6 } = useQuery({
    queryKey: ['rpt-tenants', refreshKey],
    queryFn: () => tenantApi.getAll().then(r => r.data),
    enabled: canListTenants,
  });
  const { data: summaryRaw } = useQuery({ queryKey: ['rpt-summary', refreshKey], queryFn: () => billingApi.getFinancialSummary().then(r => r.data) });
  // Occupancy needs the spaces themselves — see the chart below.
  const { data: spacesRaw } = useQuery({ queryKey: ['rpt-spaces', refreshKey], queryFn: () => spaceApi.getAll() });

  const isLoading = l1 || l2 || l3 || l4 || l5 || (canListTenants && l6);

  const bookings = useMemo(() => toArray<Booking>(bookingsRaw), [bookingsRaw]);
  const invoices = useMemo(() => toArray<Invoice>(invoicesRaw), [invoicesRaw]);
  const payments = useMemo(() => toArray<Payment>(paymentsRaw), [paymentsRaw]);
  const contracts = useMemo(() => toArray<LeaseContract>(contractsRaw), [contractsRaw]);
  const sites = useMemo(() => toArray<Site>(sitesRaw), [sitesRaw]);
  const tenants = useMemo(() => toArray<Tenant>(tenantsRaw), [tenantsRaw]);
  const spaces = useMemo(() => toArray<Space>(spacesRaw), [spacesRaw]);

  // -- Filter by range ----------------------------------------------------------
  const inRange = useCallback((d: string) => new Date(d) >= rangeStart, [rangeStart]);

  // Memoized because every chart below depends on these: as plain filter()
  // results they were a fresh array each render, so the charts' own useMemo
  // could never hold and the React Compiler skipped the whole component.
  const rangeBookings = useMemo(
    () => bookings.filter((b) => inRange(b.created_at)),
    [bookings, inRange],
  );
  const rangeInvoices = useMemo(
    () => invoices.filter((i) => inRange(i.issue_date)),
    [invoices, inRange],
  );
  const rangePayments = useMemo(
    () => payments.filter((p) => inRange(p.payment_date)),
    [payments, inRange],
  );

  // -- KPIs ---------------------------------------------------------------------
  const totalRevenue   = rangePayments.filter(p => p.status === 'COMPLETED').reduce((s: number, p) => s + parseFloat(p.amount || '0'), 0);
  const activeContracts= contracts.filter(c => c.status === 'ACTIVE').length;
  const totalBookings  = rangeBookings.length;
  const confirmedBookings = rangeBookings.filter(b => ['CONFIRMED','CHECKED_IN','COMPLETED'].includes(b.status)).length;
  const paidInvoices   = rangeInvoices.filter(i => i.status === 'PAID').length;
  const overdueInvoices= invoices.filter(i => i.status === 'OVERDUE').length;

  // -- Revenue over time --------------------------------------------------------
  const revenueChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    rangePayments.filter(p => p.status === 'COMPLETED').forEach(p => {
      const key = range === '7d' ? fmtDay(p.payment_date) : fmtMonth(p.payment_date);
      buckets[key] = (buckets[key] || 0) + parseFloat(p.amount || '0');
    });
    return Object.entries(buckets).map(([date, revenue]) => ({ date, Revenue: Math.round(revenue) }));
  }, [rangePayments, range]);

  // -- Booking trends -----------------------------------------------------------
  const bookingChart = useMemo(() => {
    const buckets: Record<string, { Confirmed: number; Pending: number; Cancelled: number }> = {};
    rangeBookings.forEach(b => {
      const key = range === '7d' ? fmtDay(b.created_at) : fmtMonth(b.created_at);
      if (!buckets[key]) buckets[key] = { Confirmed: 0, Pending: 0, Cancelled: 0 };
      if (['CONFIRMED','CHECKED_IN','COMPLETED'].includes(b.status)) buckets[key].Confirmed++;
      else if (b.status === 'PENDING_APPROVAL') buckets[key].Pending++;
      else if (b.status === 'CANCELLED') buckets[key].Cancelled++;
    });
    return Object.entries(buckets).map(([date, v]) => ({ date, ...v }));
  }, [rangeBookings, range]);

  // -- Invoice status breakdown -------------------------------------------------
  const invoiceStatusChart = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: INVOICE_STATUS_COLORS[name] ?? '#94a3b8' }));
  }, [invoices]);

  // -- Payment method breakdown -------------------------------------------------
  const paymentMethodChart = useMemo(() => {
    const counts: Record<string, number> = {};
    payments.filter(p => p.status === 'COMPLETED').forEach(p => {
      const m = p.payment_method;
      counts[m] = (counts[m] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: METHOD_LABELS[name] ?? name, value, color: PAYMENT_METHOD_COLORS[name] ?? '#94a3b8' }));
  }, [payments]);

  // -- Occupancy rate per site --------------------------------------------------
  const occupancyChart = useMemo(() => {
    return sites.map((s) => {
      const siteSpaces = spaces.filter((sp) => sp.floor?.building?.id === s.id);
      const occupied  = siteSpaces.filter((sp) => sp.status === 'OCCUPIED').length;
      const available = siteSpaces.filter((sp) => sp.status === 'AVAILABLE').length;
      const total     = siteSpaces.length;
      return {
        name: s.name?.length > 12 ? s.name.substring(0, 12) + '…' : s.name,
        Occupied:  occupied,
        Available: available,
        Rate: total > 0 ? Math.round((occupied / total) * 100) : 0,
      };
    });
  }, [sites, spaces]);

  // -- Top tenants by revenue ---------------------------------------------------
  const topTenantsChart = useMemo(() => {
    const byTenant: Record<string, number> = {};
    payments.filter(p => p.status === 'COMPLETED').forEach((p) => {
      const tid = p.tenant_id;
      byTenant[tid] = (byTenant[tid] || 0) + parseFloat(p.amount || '0');
    });
    return Object.entries(byTenant)
      .map(([tid, revenue]) => {
        const tenant = tenants.find((t) => t.id === tid);
        return { name: tenant?.name ?? tid.substring(0, 8), Revenue: Math.round(revenue) };
      })
      .sort((a, b) => b.Revenue - a.Revenue)
      .slice(0, 8);
  }, [payments, tenants]);

  // -- Contract status breakdown ------------------------------------------------
  const contractStatusChart = useMemo(() => {
    const counts: Record<string, number> = {};
    contracts.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    const colors: Record<string, string> = { ACTIVE: '#10b981', DRAFT: '#94a3b8', EXPIRED: '#ef4444', TERMINATED: '#f59e0b', RENEWED: '#2563eb' };
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: colors[name] ?? '#94a3b8' }));
  }, [contracts]);

  if (!canAccess) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: '#0f172a' }}>Access Restricted</h2>
        <p style={{ color: '#64748b' }}>Reports are available to Super Admin, Site Manager, and Finance roles only.</p>
      </div>
    );
  }

  const RANGES: { key: Range; label: string }[] = [
    { key: '7d',  label: '7 Days'   },
    { key: '30d', label: '30 Days'  },
    { key: '3m',  label: '3 Months' },
    { key: '1y',  label: '1 Year'   },
  ];

  return (
    <div style={{ padding: 24, minHeight: '100%' }}>

      {/* -- Page Header -- */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Reports & Analytics</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Platform performance, revenue trends and operational insights</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Time range selector */}
            <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#f8fafc' }}>
              {RANGES.map(r => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  style={{
                    padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: range === r.key ? '#2563eb' : 'transparent',
                    color: range === r.key ? '#fff' : '#64748b',
                    transition: 'all 0.15s',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <ReloadOutlined spin={isLoading} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* -- KPI Row -- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        {isLoading ? Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ ...CARD, padding: '16px 18px' }}><Skeleton active paragraph={{ rows: 2 }} /></div>
        )) : <>
          <KpiCard label="Revenue" value={`$${Math.round(totalRevenue).toLocaleString()}`} sub={`Last ${range}`} color="#2563eb" bg="#eff6ff" icon="💰" />
          <KpiCard label="Active Contracts" value={activeContracts} sub={`${contracts.length} total`} color="#059669" bg="#f0fdf4" icon="📋" />
          <KpiCard label="Bookings" value={totalBookings} sub={`${confirmedBookings} confirmed`} color="#f59e0b" bg="#fffbeb" icon="📅" />
          <KpiCard label="Paid Invoices" value={paidInvoices} sub={`${overdueInvoices} overdue`} color="#7c3aed" bg="#f5f3ff" icon="✅" />
          <KpiCard label="Tenants" value={tenants.length} sub={`${activeContracts} with active lease`} color="#0891b2" bg="#f0f9ff" icon="🏢" />
        </>}
      </div>

      {/* -- Row 1: Revenue + Booking Trends -- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Revenue over time */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <SectionHeader title="💰 Revenue Over Time" sub={`Collected payments — Last ${range}`} />
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : revenueChart.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={fmtAmt} tick={{ fontSize: 11, fill: '#94a3b8' }} width={50} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Revenue" stroke="#2563eb" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 3, fill: '#2563eb' }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Booking trends */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <SectionHeader title="📅 Booking Trends" sub={`Bookings by status — Last ${range}`} />
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : bookingChart.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bookingChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={30} allowDecimals={false} />
                <Tooltip content={<ChartTooltip currency={false} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Confirmed" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="Pending"   fill="#f59e0b" radius={[4,4,0,0]} />
                <Bar dataKey="Cancelled" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* -- Row 2: Invoice Status + Payment Methods + Contract Status -- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Invoice status breakdown */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <SectionHeader title="🧾 Invoice Status" sub="All invoices breakdown" />
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : invoiceStatusChart.length === 0 ? <EmptyChart height={180} /> : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={invoiceStatusChart} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {invoiceStatusChart.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
                {invoiceStatusChart.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.color }} />
                    <span style={{ color: '#64748b' }}>{e.name}</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{e.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Payment methods */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <SectionHeader title="💳 Payment Methods" sub="Completed payments breakdown" />
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : paymentMethodChart.length === 0 ? <EmptyChart height={180} /> : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={paymentMethodChart} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {paymentMethodChart.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
                {paymentMethodChart.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.color }} />
                    <span style={{ color: '#64748b' }}>{e.name}</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{e.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Contract status */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <SectionHeader title="📋 Contract Status" sub="All contracts breakdown" />
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : contractStatusChart.length === 0 ? <EmptyChart height={180} /> : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={contractStatusChart} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {contractStatusChart.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
                {contractStatusChart.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.color }} />
                    <span style={{ color: '#64748b' }}>{e.name}</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{e.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* -- Row 3: Occupancy + Top Tenants -- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Occupancy per site */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <SectionHeader title="📍 Occupancy per Site" sub="Occupied vs available spaces" />
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : occupancyChart.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={occupancyChart} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#374151' }} width={80} />
                <Tooltip content={<ChartTooltip currency={false} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Occupied"  fill="#2563eb" radius={[0,4,4,0]} stackId="a" />
                <Bar dataKey="Available" fill="#e5e7eb" radius={[0,4,4,0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Occupancy rate badges */}
          {!isLoading && occupancyChart.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {occupancyChart.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: s.Rate >= 80 ? '#fef2f2' : s.Rate >= 50 ? '#fffbeb' : '#f0fdf4', border: `1px solid ${s.Rate >= 80 ? '#fecaca' : s.Rate >= 50 ? '#fde68a' : '#bbf7d0'}` }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.Rate >= 80 ? '#dc2626' : s.Rate >= 50 ? '#d97706' : '#15803d' }}>{s.name}: {s.Rate}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top tenants by revenue */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <SectionHeader title="🏆 Top Tenants by Revenue" sub="Collected payments per tenant" />
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : topTenantsChart.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topTenantsChart} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={fmtAmt} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#374151' }} width={80} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="Revenue" radius={[0,4,4,0]}>
                  {topTenantsChart.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* -- Summary Table -- */}
      <div style={{ ...CARD, padding: '20px 24px' }}>
        <SectionHeader title="📊 Financial Summary" sub="Aggregated figures across all tenants" />
        {isLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
            {[
              { label: 'Total Invoiced',  value: `$${(summaryRaw?.total_invoiced ?? 0).toLocaleString()}`,  color: '#2563eb' },
              { label: 'Total Collected', value: `$${(summaryRaw?.total_paid ?? 0).toLocaleString()}`,       color: '#059669' },
              { label: 'Outstanding',     value: `$${(summaryRaw?.total_pending ?? 0).toLocaleString()}`,    color: '#f59e0b' },
              { label: 'Overdue',         value: `$${(summaryRaw?.total_overdue ?? 0).toLocaleString()}`,    color: '#dc2626' },
              { label: 'Active Contracts',value: `${activeContracts}`,                                                 color: '#059669' },
              { label: 'Total Contracts', value: `${contracts.length}`,                                                color: '#2563eb' },
              { label: 'Total Tenants',   value: `${tenants.length}`,                                                  color: '#7c3aed' },
              { label: 'Total Sites',     value: `${sites.length}`,                                                    color: '#0891b2' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#fff', padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
