import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts';
import {
  CreditCardOutlined, FileTextOutlined, ReloadOutlined,
  ArrowRightOutlined, WarningOutlined, CheckCircleOutlined,
  ClockCircleOutlined, RiseOutlined, FallOutlined,
  DollarOutlined, ExportOutlined, FundOutlined, BarChartOutlined,
} from '@ant-design/icons';
import { billingApi, contractApi, tenantApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useAuthReady } from '../../hooks/useAuthReady';
import PageShell from '../../components/ui/PageShell';
import PageHeader from '../../components/ui/PageHeader';
import RoleDashboardHero from '../../components/RoleDashboardHero';
import type { ChartTooltipProps, Invoice, LeaseContract, Payment, Tenant } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EMPTY_LIST: readonly unknown[] = [];

function toArray<T>(raw: unknown): T[] {
  if (!raw) return EMPTY_LIST as unknown as T[];
  if (Array.isArray(raw)) return raw as T[];
  const nested = (raw as { data?: unknown }).data;
  if (Array.isArray(nested)) return nested as T[];
  return EMPTY_LIST as unknown as T[];
}
function fmtMonth(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}
function fmtAmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ChartTip({ active, payload, label, isCurrency = false }: ChartTooltipProps & { isCurrency?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 14px' }}>
      {label && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#fff' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <strong>{isCurrency ? `$${Number(p.value).toLocaleString()}` : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ label, value, sub, color, bg, icon, path, loading, trend }: {
  label: string; value: string | number; sub: string;
  color: string; bg: string; icon: React.ReactNode;
  path?: string; loading?: boolean; trend?: { value: number; label: string };
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
          <div style={{ fontSize: 28, fontWeight: 900, color: t.text, lineHeight: 1, marginBottom: 4 }}>{value}</div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 11, color }}>{sub}</div>
          {trend && (
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: trend.value >= 0 ? '#059669' : '#dc2626', background: trend.value >= 0 ? '#f0fdf4' : '#fef2f2', padding: '2px 8px', borderRadius: 20 }}>
              {trend.value >= 0 ? <RiseOutlined /> : <FallOutlined />} {Math.abs(trend.value)}% {trend.label}
            </div>
          )}
        </>
      )}
      <div style={{ marginTop: 10, height: 3, background: t.divider, borderRadius: 2 }}>
        <div style={{ height: 3, borderRadius: 2, background: color, width: '60%' }} />
      </div>
    </div>
  );
}

const PAYMENT_METHOD_META: Record<string, { label: string; icon: string; color: string }> = {
  CASH:           { label: 'Cash',          icon: '💵', color: '#059669' },
  CHECK:          { label: 'Cheque',         icon: '📄', color: '#2563eb' },
  BANK_TRANSFER:  { label: 'Bank Transfer',  icon: '🏦', color: '#7c3aed' },
  CREDIT_CARD:    { label: 'Credit Card',    icon: '💳', color: '#d97706' },
  ONLINE_PAYMENT: { label: 'Online',         icon: '🌐', color: '#0891b2' },
};

const INV_STATUS_COLORS: Record<string, string> = {
  PAID: '#10b981', ISSUED: '#2563eb', SENT: '#8b5cf6',
  PARTIALLY_PAID: '#f59e0b', OVERDUE: '#ef4444',
  DRAFT: '#94a3b8', CANCELLED: '#e5e7eb',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FinanceDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const authReady = useAuthReady();
  const { t }    = useThemeStore();
  const [refreshKey, setRefreshKey] = useState(0);
  const [revenueRange, setRevenueRange] = useState<6 | 12>(6);
  const [now] = useState(() => Date.now());
  const opts = (k: string) => ({ queryKey: [k, refreshKey], enabled: authReady });

  const CARD: React.CSSProperties = {
    background: t.cardBg, borderRadius: 14,
    border: `1px solid ${t.cardBorder}`,
    boxShadow: t.cardShadow,
  };

  const { data: invoicesRaw,  isLoading: l1 } = useQuery({ ...opts('fd-invoices'),  queryFn: () => billingApi.getInvoices().then(r => r.data) });
  const { data: paymentsRaw,  isLoading: l2 } = useQuery({ ...opts('fd-payments'),  queryFn: () => billingApi.getPayments().then(r => r.data) });
  const { data: summaryRaw }                   = useQuery({ ...opts('fd-summary'),   queryFn: () => billingApi.getFinancialSummary().then(r => r.data) });
  const { data: contractsRaw, isLoading: l3 } = useQuery({ ...opts('fd-contracts'), queryFn: () => contractApi.getAll().then(r => r.data) });
  const { data: tenantsRaw,   isLoading: l4 } = useQuery({ ...opts('fd-tenants'),   queryFn: () => tenantApi.getAll().then(r => r.data) });

  const isLoading = l1 || l2 || l3 || l4;

  const invoices = useMemo(() => toArray<Invoice>(invoicesRaw), [invoicesRaw]);
  const payments = useMemo(() => toArray<Payment>(paymentsRaw), [paymentsRaw]);
  const contracts = useMemo(() => toArray<LeaseContract>(contractsRaw), [contractsRaw]);
  const tenants = useMemo(() => toArray<Tenant>(tenantsRaw), [tenantsRaw]);
  const summary   = summaryRaw;

  const totalRevenue    = Number(summary?.total_paid     ?? 0);
  const totalPending    = Number(summary?.total_pending  ?? 0);
  const totalOverdue    = Number(summary?.total_overdue  ?? 0);
  const totalInvoiced   = Number(summary?.total_invoiced ?? 0);
  const collectionRate  = totalInvoiced > 0 ? Math.round((totalRevenue / totalInvoiced) * 100) : 0;

  const completedPays = useMemo(() => payments.filter(p => p.status === 'COMPLETED'), [payments]);
  const refundedPays  = payments.filter(p => p.status === 'REFUNDED');
  const totalCollected = completedPays.reduce((s, p) => s + parseFloat(p.amount || '0'), 0);
  const totalRefunded  = refundedPays.reduce((s,  p) => s + parseFloat(p.amount || '0'), 0);

  const overdueInvoices   = useMemo(() => invoices.filter(i => i.status === 'OVERDUE'), [invoices]);
  const paidInvoices      = invoices.filter(i => i.status === 'PAID');
  const pendingInvoices   = invoices.filter(i => ['ISSUED','SENT','PARTIALLY_PAID'].includes(i.status));
  const activeContracts   = contracts.filter(c => c.status === 'ACTIVE');
  const monthlyRecurring  = activeContracts.reduce((s, c) => s + parseFloat(c.monthly_rent || '0'), 0);

  const revenueTrend = useMemo(() => {
    const buckets: Record<string, { Revenue: number; Refunds: number }> = {};
    payments.forEach(p => {
      const k = fmtMonth(p.payment_date || p.created_at);
      if (!buckets[k]) buckets[k] = { Revenue: 0, Refunds: 0 };
      if (p.status === 'COMPLETED') buckets[k].Revenue  += parseFloat(p.amount || '0');
      if (p.status === 'REFUNDED')  buckets[k].Refunds  += parseFloat(p.amount || '0');
    });
    return Object.entries(buckets)
      .slice(-revenueRange)
      .map(([date, v]) => ({ date, Revenue: Math.round(v.Revenue), Refunds: Math.round(v.Refunds) }));
  }, [payments, revenueRange]);

  const invoiceStatusChart = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, color: INV_STATUS_COLORS[name] ?? '#94a3b8' }))
      .sort((a, b) => b.value - a.value);
  }, [invoices]);

  const paymentMethodChart = useMemo(() => {
    const counts: Record<string, number> = {};
    const amounts: Record<string, number> = {};
    completedPays.forEach(p => {
      const key = p.payment_method ?? p.method ?? 'OTHER';
      counts[key]  = (counts[key]  || 0) + 1;
      amounts[key] = (amounts[key] || 0) + parseFloat(p.amount || '0');
    });
    return Object.entries(counts).map(([method, count]) => ({
      method,
      count,
      amount: Math.round(amounts[method] || 0),
      ...PAYMENT_METHOD_META[method] ?? { label: method, icon: '💰', color: '#94a3b8' },
    })).sort((a, b) => b.amount - a.amount);
  }, [completedPays]);

  const topTenants = useMemo(() => {
    const byTenant: Record<string, number> = {};
    completedPays.forEach(p => {
      if (p.tenant_id) byTenant[p.tenant_id] = (byTenant[p.tenant_id] || 0) + parseFloat(p.amount || '0');
    });
    return Object.entries(byTenant)
      .map(([id, total]) => ({
        id, total,
        name: tenants.find(tn => tn.id === id)?.name ?? id.slice(0, 8),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [completedPays, tenants]);

  const mrrTrend = useMemo(() => {
    const months: Record<string, number> = {};
    invoices.filter(i => i.status === 'PAID' && i.type === 'MONTHLY_RENT').forEach(inv => {
      const k = fmtMonth(inv.issue_date || inv.created_at);
      months[k] = (months[k] || 0) + parseFloat(inv.total_amount || '0');
    });
    return Object.entries(months).slice(-6).map(([date, MRR]) => ({ date, MRR: Math.round(MRR) }));
  }, [invoices]);

  const recentPayments = [...completedPays]
    .sort((a, b) => new Date(b.payment_date || b.created_at).getTime() - new Date(a.payment_date || a.created_at).getTime())
    .slice(0, 6);

  const recentOverdue = [...overdueInvoices]
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5);

  return (
    <PageShell>

      <PageHeader
        title="Finance Dashboard"
        subtitle={`Welcome, ${user?.first_name ?? 'Finance'} · Revenue, invoices & payments overview`}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/admin/billing')}
              style={{ padding: '9px 16px', borderRadius: 9, border: `1px solid ${t.cardBorder}`, background: t.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: t.text }}>
              Billing →
            </button>
            <button onClick={() => setRefreshKey(k => k + 1)}
              style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${t.cardBorder}`, background: t.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ReloadOutlined spin={isLoading} /> Refresh
            </button>
          </div>
        }
      />

      <RoleDashboardHero role={user?.role} userName={user?.first_name} />

      {/* Quick actions — finance daily workflow */}
      <div style={{ ...CARD, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Quick actions
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: 'Record payment', icon: <DollarOutlined />, path: '/admin/payments', color: '#059669', bg: '#f0fdf4' },
            { label: 'Manage invoices', icon: <CreditCardOutlined />, path: '/admin/billing', color: '#2563eb', bg: '#eff6ff' },
            { label: 'Contract renewals', icon: <FileTextOutlined />, path: '/admin/contracts/renewals', color: '#7c3aed', bg: '#f5f3ff' },
            { label: 'Revenue forecast', icon: <FundOutlined />, path: '/admin/revenue-forecast', color: '#0891b2', bg: '#f0f9ff' },
            { label: 'Financial reports', icon: <BarChartOutlined />, path: '/admin/embedded-reports', color: '#d97706', bg: '#fffbeb' },
            { label: 'Export data', icon: <ExportOutlined />, path: '/admin/export', color: '#475569', bg: '#f1f5f9' },
          ].map((action) => (
            <button
              key={action.path}
              type="button"
              onClick={() => navigate(action.path)}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: `1px solid ${t.cardBorder}`,
                background: action.bg,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: action.color,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert banners */}
      {overdueInvoices.length > 0 && (
        <div onClick={() => navigate('/admin/billing')}
          style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <WarningOutlined style={{ color: '#dc2626', fontSize: 18 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: '#b91c1c', fontSize: 14 }}>
              {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''}
            </span>
            <span style={{ color: '#dc2626', fontSize: 13, marginLeft: 8 }}>
              Total: ${overdueInvoices.reduce((s, i) => s + parseFloat(i.total_amount || '0'), 0).toLocaleString()} outstanding
            </span>
          </div>
          <ArrowRightOutlined style={{ color: '#dc2626' }} />
        </div>
      )}

      {/* KPI Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Total Collected"  value={`$${Math.round(totalCollected).toLocaleString()}`} sub={`${completedPays.length} payments`}           color="#059669" bg="#f0fdf4" icon={<CheckCircleOutlined />}  path="/admin/billing"  loading={isLoading} />
        <KpiCard label="Pending Revenue"  value={`$${Math.round(totalPending).toLocaleString()}`}   sub={`${pendingInvoices.length} open invoices`}     color="#d97706" bg="#fffbeb" icon={<ClockCircleOutlined />}  path="/admin/billing"  loading={isLoading} />
        <KpiCard label="Overdue Amount"   value={`$${Math.round(totalOverdue).toLocaleString()}`}   sub={`${overdueInvoices.length} overdue invoices`}  color="#dc2626" bg="#fef2f2" icon={<WarningOutlined />}      path="/admin/billing"  loading={isLoading} />
        <KpiCard label="Collection Rate"  value={`${collectionRate}%`}                              sub={`${paidInvoices.length} paid of ${invoices.length}`} color={collectionRate >= 80 ? '#059669' : '#d97706'} bg={collectionRate >= 80 ? '#f0fdf4' : '#fffbeb'} icon={<CreditCardOutlined />} loading={isLoading} />
      </div>

      {/* KPI Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Monthly Recurring" value={`$${Math.round(monthlyRecurring).toLocaleString()}`} sub={`${activeContracts.length} active contracts`}  color="#7c3aed" bg="#f5f3ff" icon={<FileTextOutlined />} path="/admin/contracts" loading={isLoading} />
        <KpiCard label="Total Invoiced"    value={`$${Math.round(totalInvoiced).toLocaleString()}`}    sub="All time invoiced"                              color="#2563eb" bg="#eff6ff" icon={<FileTextOutlined />} path="/admin/billing"   loading={isLoading} />
        <KpiCard label="Total Refunded"    value={`$${Math.round(totalRefunded).toLocaleString()}`}    sub={`${refundedPays.length} refunds`}               color="#94a3b8" bg="#f1f5f9" icon={<CreditCardOutlined />} loading={isLoading} />
        <KpiCard label="Active Tenants"    value={tenants.filter(tn => tn.status === 'ACTIVE').length} sub={`${tenants.length} total registered`}           color="#0891b2" bg="#f0f9ff" icon="🏢" loading={isLoading} />
      </div>

      {/* Financial summary bar */}
      <div style={{ ...CARD, padding: '16px 24px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }}>
          {[
            { label: 'Total Invoiced',  value: fmtAmt(totalInvoiced),                    color: '#2563eb' },
            { label: 'Collected',       value: fmtAmt(totalCollected),                   color: '#059669' },
            { label: 'Pending',         value: fmtAmt(totalPending),                     color: '#f59e0b' },
            { label: 'Overdue',         value: fmtAmt(totalOverdue),                     color: '#ef4444' },
            { label: 'MRR',             value: fmtAmt(monthlyRecurring),                 color: '#7c3aed' },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '6px 0', borderRight: i < 4 ? `1px solid ${t.divider}` : 'none' }}>
              <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: item.color }}>{isLoading ? '—' : item.value}</div>
            </div>
          ))}
        </div>
        {/* Visual progress bar */}
        {totalInvoiced > 0 && !isLoading && (
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 8, background: t.divider, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
              <div style={{ height: '100%', width: `${(totalCollected / totalInvoiced) * 100}%`, background: '#059669', transition: 'width 0.6s' }} />
              <div style={{ height: '100%', width: `${(totalPending  / totalInvoiced) * 100}%`, background: '#f59e0b' }} />
              <div style={{ height: '100%', width: `${(totalOverdue  / totalInvoiced) * 100}%`, background: '#ef4444' }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 10, color: t.textMuted }}>
              <span style={{ color: '#059669' }}>■ Collected {collectionRate}%</span>
              <span style={{ color: '#f59e0b' }}>■ Pending {totalInvoiced > 0 ? Math.round((totalPending / totalInvoiced) * 100) : 0}%</span>
              <span style={{ color: '#ef4444' }}>■ Overdue {totalInvoiced > 0 ? Math.round((totalOverdue / totalInvoiced) * 100) : 0}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row 1: Revenue trend + MRR */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Revenue trend */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>💰 Revenue vs Refunds</div>
              <div style={{ fontSize: 12, color: t.textSub }}>Monthly collected payments</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([6, 12] as const).map(r => (
                <button key={r} onClick={() => setRevenueRange(r)}
                  style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${revenueRange === r ? '#2563eb' : t.cardBorder}`, background: revenueRange === r ? '#eff6ff' : t.cardBg, color: revenueRange === r ? '#2563eb' : t.textSub, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {r}M
                </button>
              ))}
            </div>
          </div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : revenueTrend.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 28 }}>💰</div><div style={{ fontSize: 12 }}>No payment data yet</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#059669" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="refGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.divider} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: t.textMuted }} />
                <YAxis tickFormatter={fmtAmt} tick={{ fontSize: 11, fill: t.textMuted }} width={48} />
                <Tooltip content={<ChartTip isCurrency />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="Revenue" name="Revenue" stroke="#059669" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 3, fill: '#059669' }} />
                <Area type="monotone" dataKey="Refunds" name="Refunds" stroke="#ef4444" strokeWidth={2} fill="url(#refGrad)" dot={{ r: 3, fill: '#ef4444' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* MRR trend */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>📈 Monthly Recurring Revenue</div>
              <div style={{ fontSize: 12, color: t.textSub }}>From paid monthly rent invoices</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed' }}>${Math.round(monthlyRecurring).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: t.textSub }}>current MRR</div>
            </div>
          </div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : mrrTrend.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 28 }}>📈</div><div style={{ fontSize: 12 }}>No rent invoice data yet</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={mrrTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.divider} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: t.textMuted }} />
                <YAxis tickFormatter={fmtAmt} tick={{ fontSize: 11, fill: t.textMuted }} width={48} />
                <Tooltip content={<ChartTip isCurrency />} />
                <Line type="monotone" dataKey="MRR" name="MRR" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: '#7c3aed' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2: Invoice status + Payment methods + Top tenants */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Invoice status donut */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: t.text, marginBottom: 4 }}>🧾 Invoice Status</div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 14 }}>{invoices.length} total · {collectionRate}% collected</div>
          {isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : invoiceStatusChart.length === 0 ? (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 28 }}>🧾</div><div style={{ fontSize: 12 }}>No invoices yet</div>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={invoiceStatusChart} cx="50%" cy="50%" innerRadius={42} outerRadius={60} paddingAngle={3} dataKey="value">
                      {invoiceStatusChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: t.text }}>{invoices.length}</div>
                  <div style={{ fontSize: 9, color: t.textMuted }}>Total</div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                {invoiceStatusChart.slice(0, 5).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: t.textSub }}>{s.name}</span>
                    <span style={{ fontWeight: 700, color: t.text }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Payment methods */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: t.text, marginBottom: 4 }}>💳 Payment Methods</div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 16 }}>{completedPays.length} completed payments</div>
          {isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : paymentMethodChart.length === 0 ? (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 28 }}>💳</div><div style={{ fontSize: 12 }}>No payments yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {paymentMethodChart.map((pm, i) => {
                const pct = completedPays.length > 0 ? Math.round((pm.count / completedPays.length) * 100) : 0;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{pm.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>{pm.label}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>${pm.amount.toLocaleString()}</span>
                        <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 6 }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 5, background: t.divider, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pm.color, borderRadius: 3, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top tenants by revenue */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: t.text, marginBottom: 4 }}>🏆 Top Tenants</div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 16 }}>By total revenue paid</div>
          {isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : topTenants.length === 0 ? (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 28 }}>🏆</div><div style={{ fontSize: 12 }}>No data yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topTenants.map((tn, i) => {
                const maxVal = topTenants[0]?.total || 1;
                const pct = Math.round((tn.total / maxVal) * 100);
                const RANK_COLORS = ['#f59e0b','#94a3b8','#cd7c2f','#2563eb','#059669'];
                return (
                  <div key={tn.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: `${RANK_COLORS[i]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: RANK_COLORS[i] }}>
                          {i + 1}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{tn.name}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>${tn.total.toLocaleString()}</span>
                    </div>
                    <div style={{ height: 5, background: t.divider, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: RANK_COLORS[i], borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom tables: Recent payments + Overdue invoices */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Recent payments */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>✅ Recent Payments</div>
            <button onClick={() => navigate('/admin/payments')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View all →</button>
          </div>
          {isLoading ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 5 }} /></div>
            : recentPayments.length === 0
            ? <div style={{ padding: '32px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>No payments yet</div>
            : recentPayments.map((p, i) => {
              const payMethod = p.payment_method ?? p.method;
              const mm = PAYMENT_METHOD_META[payMethod] ?? { icon: '💰', label: payMethod, color: '#94a3b8' };
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < recentPayments.length - 1 ? `1px solid ${t.divider}` : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                    {mm.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: t.text, fontFamily: 'monospace' }}>{p.payment_number}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{mm.label} · {formatDate(p.payment_date || p.created_at)}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>${parseFloat(p.amount || '0').toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>{p.currency}</div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Overdue invoices */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>⚠️ Overdue Invoices</div>
              {recentOverdue.length > 0 && <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>{overdueInvoices.length}</span>}
            </div>
            <button onClick={() => navigate('/admin/billing')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View all →</button>
          </div>
          {isLoading ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 5 }} /></div>
            : recentOverdue.length === 0
            ? <div style={{ padding: '32px', textAlign: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 32, color: '#22c55e', display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>No overdue invoices!</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>All payments are on time.</div>
              </div>
            : recentOverdue.map((inv, i) => {
              const daysLate = Math.ceil((now - new Date(inv.due_date).getTime()) / 86400000);
              return (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < recentOverdue.length - 1 ? `1px solid ${t.divider}` : 'none', background: '#fff9f9', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fee2e2')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff9f9')}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <WarningOutlined style={{ color: '#dc2626', fontSize: 14 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: t.text, fontFamily: 'monospace' }}>{inv.invoice_number}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{inv.tenant?.name ?? 'Tenant'} · Due {formatDate(inv.due_date)}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>${parseFloat(inv.total_amount || '0').toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>{daysLate}d overdue</div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </PageShell>
  );
}