import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { ReloadOutlined } from '@ant-design/icons';
import { bookingApi, billingApi, contractApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Booking, ChartTooltipProps, Invoice, LeaseContract, Payment } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  if (range === '7d')  return new Date(now.getTime() - 7   * 86400000);
  if (range === '30d') return new Date(now.getTime() - 30  * 86400000);
  if (range === '3m')  return new Date(now.getTime() - 90  * 86400000);
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
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatAmt(amount: string | number, currency = 'USD') {
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${sym}${parseFloat(String(amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
};

const BOOKING_STATUS_COLORS: Record<string, string> = {
  CONFIRMED:        '#10b981',
  CHECKED_IN:       '#2563eb',
  COMPLETED:        '#8b5cf6',
  PENDING_APPROVAL: '#f59e0b',
  CANCELLED:        '#ef4444',
  DRAFT:            '#94a3b8',
  NO_SHOW:          '#f97316',
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

const RANGES: { key: Range; label: string }[] = [
  { key: '7d',  label: '7 Days'   },
  { key: '30d', label: '30 Days'  },
  { key: '3m',  label: '3 Months' },
  { key: '1y',  label: '1 Year'   },
];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, currency = true }: ChartTooltipProps & { currency?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      {label && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#fff', marginBottom: i < payload.length - 1 ? 4 : 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <strong>{currency && p.name === 'Spent' ? `$${Number(p.value).toLocaleString()}` : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, bg, icon }: {
  label: string; value: string | number; sub: string;
  color: string; bg: string; icon: string;
}) {
  return (
    <div style={{ ...CARD, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
          <p style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{value}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{sub}</p>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{icon}</div>
      </div>
      <div style={{ marginTop: 12, height: 3, background: '#f1f5f9', borderRadius: 2 }}>
        <div style={{ height: 3, borderRadius: 2, background: color, width: '60%' }} />
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{sub}</p>
    </div>
  );
}

function EmptyChart({ height = 200 }: { height?: number }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 32 }}>📊</div>
      <div style={{ fontSize: 12 }}>No data for this period</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TenantReportsPage() {
  const { user }    = useAuthStore();
  const tenantId    = user?.tenant_id ?? '';

  const [range,      setRange]      = useState<Range>('30d');
  const [refreshKey, setRefreshKey] = useState(0);
  const [now] = useState(() => Date.now());

  const rangeStart = getRangeStart(range);
  const inRange = useCallback((d: string) => new Date(d) >= rangeStart, [rangeStart]);

  // ── Fetch only this tenant's data ─────────────────────────────────────────
  const { data: bookingsRaw,  isLoading: l1 } = useQuery({
    queryKey: ['t-rpt-bookings',  tenantId, refreshKey],
    queryFn:  () => bookingApi.getAll({ tenantId }).then(r => r.data),
    enabled:  !!tenantId,
  });
  const { data: invoicesRaw,  isLoading: l2 } = useQuery({
    queryKey: ['t-rpt-invoices',  tenantId, refreshKey],
    queryFn:  () => billingApi.getInvoices({ tenantId }).then(r => r.data),
    enabled:  !!tenantId,
  });
  const { data: paymentsRaw,  isLoading: l3 } = useQuery({
    queryKey: ['t-rpt-payments',  tenantId, refreshKey],
    queryFn:  () => billingApi.getPayments({ tenantId }).then(r => r.data),
    enabled:  !!tenantId,
  });
  const { data: contractsRaw, isLoading: l4 } = useQuery({
    queryKey: ['t-rpt-contracts', tenantId, refreshKey],
    queryFn:  () => contractApi.getAll({ tenantId }).then(r => r.data),
    enabled:  !!tenantId,
  });
  const { data: summaryRaw } = useQuery({
    queryKey: ['t-rpt-summary', tenantId, refreshKey],
    queryFn:  () => billingApi.getFinancialSummary(tenantId).then(r => r.data),
    enabled:  !!tenantId,
  });

  const isLoading = l1 || l2 || l3 || l4;

  const bookings = useMemo(() => toArray<Booking>(bookingsRaw), [bookingsRaw]);
  const invoices = useMemo(() => toArray<Invoice>(invoicesRaw), [invoicesRaw]);
  const payments = useMemo(() => toArray<Payment>(paymentsRaw), [paymentsRaw]);
  const contracts = useMemo(() => toArray<LeaseContract>(contractsRaw), [contractsRaw]);

  // ── Filtered by range ────────────────────────────────────────────────────────
  const rangeBookings = useMemo(() => bookings.filter(b => inRange(b.created_at)), [bookings, inRange]);
  const rangePayments = useMemo(() => payments.filter(p => inRange(p.payment_date)), [payments, inRange]);

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const totalSpent      = rangePayments.filter(p => p.status === 'COMPLETED').reduce((s: number, p) => s + parseFloat(p.amount || '0'), 0);
  const activeContracts = contracts.filter(c => c.status === 'ACTIVE').length;
  const pendingInvoices = invoices.filter(i => ['ISSUED','SENT','PARTIALLY_PAID'].includes(i.status)).length;
  const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE').length;
  const confirmedBk     = rangeBookings.filter(b => ['CONFIRMED','CHECKED_IN','COMPLETED'].includes(b.status)).length;

  // ── Spending over time ───────────────────────────────────────────────────────
  const spendingChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    rangePayments.filter(p => p.status === 'COMPLETED').forEach(p => {
      const key = range === '7d' ? fmtDay(p.payment_date) : fmtMonth(p.payment_date);
      buckets[key] = (buckets[key] || 0) + parseFloat(p.amount || '0');
    });
    return Object.entries(buckets).map(([date, Spent]) => ({ date, Spent: Math.round(Spent) }));
  }, [rangePayments, range]);

  // ── Booking activity ─────────────────────────────────────────────────────────
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

  // ── Booking status breakdown ─────────────────────────────────────────────────
  const bookingStatusChart = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach(b => { counts[b.status] = (counts[b.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: BOOKING_STATUS_COLORS[name] ?? '#94a3b8' }));
  }, [bookings]);

  // ── Invoice status breakdown ─────────────────────────────────────────────────
  const invoiceStatusChart = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: INVOICE_STATUS_COLORS[name] ?? '#94a3b8' }));
  }, [invoices]);

  // ── Monthly cost from active contracts ───────────────────────────────────────
  const monthlyCommitment = contracts.filter(c => c.status === 'ACTIVE').reduce((s: number, c) => s + parseFloat(c.monthly_rent || '0'), 0);

  // ── Upcoming invoices (due in next 30 days) ──────────────────────────────────
  const upcomingInvoices = invoices.filter(i => {
    if (['PAID','CANCELLED'].includes(i.status)) return false;
    const due = new Date(i.due_date);
    const now = new Date();
    return due >= now && due <= new Date(now.getTime() + 30 * 86400000);
  }).slice(0, 5);

  // ── Recent bookings ──────────────────────────────────────────────────────────
  const recentBookings = [...bookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  return (
    <div style={{ padding: 24, minHeight: '100%' }}>

      {/* Header */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>My Reports</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Your spending, bookings and lease activity overview</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#f8fafc' }}>
              {RANGES.map(r => (
                <button key={r.key} onClick={() => setRange(r.key)}
                  style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: range === r.key ? '#2563eb' : 'transparent', color: range === r.key ? '#fff' : '#64748b', transition: 'all 0.15s' }}>
                  {r.label}
                </button>
              ))}
            </div>
            <button onClick={() => setRefreshKey(k => k + 1)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <ReloadOutlined spin={isLoading} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 20 }}>
        {isLoading ? Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ ...CARD, padding: '16px 18px' }}><Skeleton active paragraph={{ rows: 2 }} /></div>
        )) : <>
          <KpiCard label="Total Spent"      value={`$${Math.round(totalSpent).toLocaleString()}`} sub={`Last ${range}`}                    color="#2563eb" bg="#eff6ff" icon="💰" />
          <KpiCard label="Monthly Cost"     value={`$${Math.round(monthlyCommitment).toLocaleString()}`} sub="Active leases"               color="#059669" bg="#f0fdf4" icon="📋" />
          <KpiCard label="My Bookings"      value={rangeBookings.length}   sub={`${confirmedBk} confirmed`}                                 color="#f59e0b" bg="#fffbeb" icon="📅" />
          <KpiCard label="Pending Invoices" value={pendingInvoices}        sub={overdueInvoices > 0 ? `⚠ ${overdueInvoices} overdue` : 'All up to date'} color={overdueInvoices > 0 ? '#dc2626' : '#7c3aed'} bg={overdueInvoices > 0 ? '#fef2f2' : '#f5f3ff'} icon={overdueInvoices > 0 ? '⚠️' : '✅'} />
          <KpiCard label="Active Leases"    value={activeContracts}        sub={`${contracts.length} total contracts`}                      color="#0891b2" bg="#f0f9ff" icon="🏢" />
        </>}
      </div>

      {/* Overdue alert */}
      {overdueInvoices > 0 && !isLoading && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <span style={{ fontWeight: 700, color: '#b91c1c', fontSize: 14 }}>You have {overdueInvoices} overdue invoice{overdueInvoices > 1 ? 's' : ''}</span>
            <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>Please contact your lease manager to arrange payment.</div>
          </div>
        </div>
      )}

      {/* Row 1: Spending over time + Booking activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <SectionHeader title="💰 My Spending" sub={`Payments made · Last ${range}`} />
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : spendingChart.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={spendingChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={fmtAmt} tick={{ fontSize: 11, fill: '#94a3b8' }} width={50} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Spent" stroke="#2563eb" strokeWidth={2.5} fill="url(#spendGrad)" dot={{ r: 3, fill: '#2563eb' }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ ...CARD, padding: '20px 24px' }}>
          <SectionHeader title="📅 My Booking Activity" sub={`Bookings by status · Last ${range}`} />
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

      {/* Row 2: Booking status pie + Invoice status pie */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <SectionHeader title="📊 Booking Status Breakdown" sub="All your bookings" />
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : bookingStatusChart.length === 0 ? <EmptyChart height={200} /> : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={bookingStatusChart} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {bookingStatusChart.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8 }}>
                {bookingStatusChart.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.color }} />
                    <span style={{ color: '#64748b' }}>{e.name.replace(/_/g,' ')}</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{e.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ ...CARD, padding: '20px 24px' }}>
          <SectionHeader title="🧾 Invoice Status Breakdown" sub="All your invoices" />
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : invoiceStatusChart.length === 0 ? <EmptyChart height={200} /> : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={invoiceStatusChart} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {invoiceStatusChart.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8 }}>
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
      </div>

      {/* Row 3: Upcoming invoices + Recent bookings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Upcoming invoices */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <SectionHeader title="📆 Upcoming Invoices" sub="Due in the next 30 days" />
          {isLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : upcomingInvoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 13 }}>No invoices due in the next 30 days</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {upcomingInvoices.map((inv) => {
                const daysLeft = Math.ceil((new Date(inv.due_date).getTime() - now) / 86400000);
                const urgent = daysLeft <= 7;
                return (
                  <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{inv.invoice_number}</div>
                      <div style={{ fontSize: 11, color: urgent ? '#dc2626' : '#94a3b8', fontWeight: urgent ? 600 : 400 }}>Due {formatDate(inv.due_date)} · {daysLeft}d left</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{formatAmt(inv.total_amount, inv.currency)}</div>
                      <div style={{ fontSize: 10, background: urgent ? '#fef2f2' : '#fef3c7', color: urgent ? '#dc2626' : '#92400e', padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>
                        {urgent ? '🔴 Urgent' : '🟡 Due soon'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent bookings */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <SectionHeader title="🕐 Recent Bookings" sub="Your latest space reservations" />
          {isLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : recentBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              <div style={{ fontSize: 13 }}>No bookings yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {recentBookings.map((b) => {
                const statusColors: Record<string, { bg: string; color: string }> = {
                  CONFIRMED:        { bg: '#dcfce7', color: '#15803d' },
                  CHECKED_IN:       { bg: '#dbeafe', color: '#1d4ed8' },
                  COMPLETED:        { bg: '#ede9fe', color: '#6d28d9' },
                  PENDING_APPROVAL: { bg: '#fef3c7', color: '#92400e' },
                  CANCELLED:        { bg: '#fee2e2', color: '#b91c1c' },
                  DRAFT:            { bg: '#f1f5f9', color: '#475569' },
                  NO_SHOW:          { bg: '#fef3c7', color: '#b45309' },
                };
                const sm = statusColors[b.status] ?? statusColors.DRAFT;
                const spaceName = b.space?.name ?? 'Space';
                return (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{b.booking_number}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{spaceName} · {formatDate(b.start_datetime)}</div>
                    </div>
                    <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>
                      {b.status.replace(/_/g,' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Financial summary */}
      <div style={{ ...CARD, padding: '20px 24px' }}>
        <SectionHeader title="📊 Financial Summary" sub="Your billing overview" />
        {isLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
            {[
              { label: 'Total Invoiced',  value: formatAmt(summaryRaw?.total_invoiced ?? 0), color: '#2563eb' },
              { label: 'Total Paid',      value: formatAmt(summaryRaw?.total_paid     ?? 0), color: '#059669' },
              { label: 'Outstanding',     value: formatAmt(summaryRaw?.total_pending  ?? 0), color: '#f59e0b' },
              { label: 'Overdue',         value: formatAmt(summaryRaw?.total_overdue  ?? 0), color: overdueInvoices > 0 ? '#dc2626' : '#94a3b8' },
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