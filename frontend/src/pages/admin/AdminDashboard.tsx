import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import {
  BankOutlined, AppstoreOutlined, TeamOutlined,
  CalendarOutlined, CreditCardOutlined, ToolOutlined,
  ArrowRightOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { siteApi, spaceApi, tenantApi, bookingApi, billingApi, maintenanceApi, userApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';

// ─── Chart loader ─────────────────────────────────────────────────────────────
function loadChart(cb: (C: any) => void) {
  if ((window as any).Chart) { cb((window as any).Chart); return; }
  if (!document.getElementById('chartjs-cdn')) {
    const s = document.createElement('script');
    s.id  = 'chartjs-cdn';
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js';
    s.onload = () => cb((window as any).Chart);
    document.head.appendChild(s);
  } else {
    const wait = () => (window as any).Chart ? cb((window as any).Chart) : setTimeout(wait, 80);
    wait();
  }
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

// ─── Mini chart: Space status donut ──────────────────────────────────────────
function SpaceStatusChart({ available, occupied, reserved, maintenance }: {
  available: number; occupied: number; reserved: number; maintenance: number;
}) {
  const ref   = useRef<HTMLCanvasElement>(null);
  const inst  = useRef<any>(null);

  useEffect(() => {
    if (!ref.current) return;
    loadChart(C => {
      inst.current?.destroy();
      inst.current = new C(ref.current!, {
        type: 'doughnut',
        data: {
          labels:   ['Available', 'Occupied', 'Reserved', 'Maintenance'],
          datasets: [{
            data:            [available, occupied, reserved, maintenance],
            backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'],
            borderWidth:     0,
            hoverOffset:     6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 8 },
          },
        },
      });
    });
    return () => { inst.current?.destroy(); };
  }, [available, occupied, reserved, maintenance]);

  const total = available + occupied + reserved + maintenance;
  const occRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <div style={{ position: 'relative', height: 160 }}>
      <canvas ref={ref} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{occRate}%</div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>Occupied</div>
      </div>
    </div>
  );
}

// ─── Booking trend bar chart ──────────────────────────────────────────────────
function BookingTrendChart({ bookings }: { bookings: any[] }) {
  const ref  = useRef<HTMLCanvasElement>(null);
  const inst = useRef<any>(null);

  useEffect(() => {
    if (!ref.current || !bookings.length) return;

    // Group by month
    const months: Record<string, number> = {};
    bookings.forEach(b => {
      const m = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      months[m] = (months[m] ?? 0) + 1;
    });

    const labels = Object.keys(months).slice(-6);
    const data   = labels.map(l => months[l]);

    loadChart(C => {
      inst.current?.destroy();
      inst.current = new C(ref.current!, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label:           'Bookings',
            data,
            backgroundColor: '#3b82f6',
            borderRadius:    6,
            borderSkipped:   false,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', cornerRadius: 8 } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
            y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, color: '#94a3b8' }, beginAtZero: true },
          },
        },
      });
    });
    return () => { inst.current?.destroy(); };
  }, [bookings]);

  return <canvas ref={ref} />;
}

// ─── Revenue line chart ────────────────────────────────────────────────────────
function RevenueChart({ invoices }: { invoices: any[] }) {
  const ref  = useRef<HTMLCanvasElement>(null);
  const inst = useRef<any>(null);

  useEffect(() => {
    if (!ref.current || !invoices.length) return;

    const months: Record<string, number> = {};
    invoices.filter(i => i.status === 'PAID').forEach(inv => {
      const m = new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      months[m] = (months[m] ?? 0) + parseFloat(inv.total_amount);
    });

    const labels = Object.keys(months).slice(-6);
    const data   = labels.map(l => months[l]);

    loadChart(C => {
      inst.current?.destroy();
      inst.current = new C(ref.current!, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label:           'Revenue ($)',
            data,
            borderColor:     '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.08)',
            borderWidth:     2.5,
            fill:            true,
            tension:         0.4,
            pointBackgroundColor: '#2563eb',
            pointRadius:     4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', cornerRadius: 8 } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
            y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, color: '#94a3b8' }, beginAtZero: true },
          },
        },
      });
    });
    return () => { inst.current?.destroy(); };
  }, [invoices]);

  return <canvas ref={ref} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate  = useNavigate();
  const { user }  = useAuthStore();

  // ── All real API calls ──
  const { data: sites        = [], isLoading: l1, refetch: r1 } = useQuery({ queryKey: ['dash-sites'],        queryFn: () => siteApi.getAll().then(r => r.data) });
  const { data: spaces       = [], isLoading: l2 }              = useQuery({ queryKey: ['dash-spaces'],       queryFn: () => spaceApi.getAll().then(r => r.data) });
  const { data: tenants      = [], isLoading: l3 }              = useQuery({ queryKey: ['dash-tenants'],      queryFn: () => tenantApi.getAll().then(r => r.data) });
  const { data: users        = [], isLoading: l4 }              = useQuery({ queryKey: ['dash-users'],        queryFn: () => userApi.getAll().then(r => r.data) });
  const { data: bookings     = [], isLoading: l5 }              = useQuery({ queryKey: ['dash-bookings'],     queryFn: () => bookingApi.getAll().then(r => r.data) });
  const { data: invoices     = [], isLoading: l6 }              = useQuery({ queryKey: ['dash-invoices'],     queryFn: () => billingApi.getInvoices().then(r => r.data) });
  const { data: mxStats,          isLoading: l7 }               = useQuery({ queryKey: ['dash-mx-stats'],     queryFn: () => maintenanceApi.getStats().then(r => r.data) });
  const { data: summary }                                        = useQuery({ queryKey: ['dash-summary'],      queryFn: () => billingApi.getFinancialSummary().then(r => r.data) });

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7;

  const refetchAll = () => { r1(); };

  // ── Computed stats ──
  const allSpaces    = spaces    as any[];
  const allTenants   = tenants   as any[];
  const allUsers     = users     as any[];
  const allBookings  = bookings  as any[];
  const allInvoices  = invoices  as any[];
  const allSites     = sites     as any[];

  const available   = allSpaces.filter(s => s.status === 'AVAILABLE').length;
  const occupied    = allSpaces.filter(s => s.status === 'OCCUPIED').length;
  const reserved    = allSpaces.filter(s => s.status === 'RESERVED').length;
  const maintenance = allSpaces.filter(s => s.status === 'MAINTENANCE').length;
  const occRate     = allSpaces.length > 0 ? Math.round((occupied / allSpaces.length) * 100) : 0;

  const activeTenants   = allTenants.filter((t: any) => t.status === 'ACTIVE').length;
  const confirmedBooks  = allBookings.filter((b: any) => b.status === 'CONFIRMED').length;
  const overdueInv      = allInvoices.filter((i: any) => i.status === 'OVERDUE').length;
  const totalRevenue    = summary?.total_paid    ?? 0;
  const totalPending    = summary?.total_pending ?? 0;

  // ── Recent tenants ──
  const recentTenants = [...allTenants]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // ── Recent bookings ──
  const recentBookings = [...allBookings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const BOOKING_STATUS: Record<string, { bg: string; color: string }> = {
    CONFIRMED:        { bg: '#dcfce7', color: '#15803d' },
    PENDING_APPROVAL: { bg: '#fef3c7', color: '#92400e' },
    CHECKED_IN:       { bg: '#dbeafe', color: '#1d4ed8' },
    COMPLETED:        { bg: '#ede9fe', color: '#6d28d9' },
    CANCELLED:        { bg: '#fee2e2', color: '#b91c1c' },
    DRAFT:            { bg: '#f1f5f9', color: '#475569' },
  };

  const TENANT_STATUS: Record<string, { bg: string; color: string }> = {
    ACTIVE:    { bg: '#dcfce7', color: '#15803d' },
    TRIAL:     { bg: '#dbeafe', color: '#1d4ed8' },
    SUSPENDED: { bg: '#fee2e2', color: '#b91c1c' },
    CLOSED:    { bg: '#f1f5f9', color: '#475569' },
  };

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* ── Top header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            Performance Analytics Dashboard
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
            Welcome back, <strong>{user?.first_name}</strong> · Real-time overview across all sites and tenants
          </p>
        </div>
        <button
          onClick={refetchAll}
          style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ReloadOutlined /> Refresh
        </button>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          {
            label:   'Total Sites',
            value:   allSites.length,
            sub:     `${allSites.filter((s: any) => s.status === 'ACTIVE').length} active`,
            color:   '#2563eb', bg: '#eff6ff', icon: <BankOutlined />,
            path:    '/admin/sites',
          },
          {
            label:   'Total Spaces',
            value:   allSpaces.length,
            sub:     `${occRate}% occupancy rate`,
            color:   '#059669', bg: '#f0fdf4', icon: <AppstoreOutlined />,
            path:    '/admin/spaces',
          },
          {
            label:   'Active Tenants',
            value:   activeTenants,
            sub:     `${allTenants.length} total registered`,
            color:   '#d97706', bg: '#fffbeb', icon: <TeamOutlined />,
            path:    '/admin/tenants',
          },
          {
            label:   'Total Users',
            value:   allUsers.length,
            sub:     `${allUsers.filter((u: any) => u.status === 'ACTIVE').length} active`,
            color:   '#7c3aed', bg: '#f5f3ff', icon: <TeamOutlined />,
            path:    '/admin/users',
          },
        ].map(k => (
          <div
            key={k.label}
            style={{ ...CARD, padding: '20px', cursor: 'pointer', transition: 'all 0.15s' }}
            onClick={() => navigate(k.path)}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: k.color }}>
                {k.icon}
              </div>
              <ArrowRightOutlined style={{ color: '#94a3b8', fontSize: 14 }} />
            </div>
            {isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
              <>
                <div style={{ fontSize: 34, fontWeight: 900, color: '#0f172a', lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{k.label}</div>
                <div style={{ fontSize: 11, color: k.color, fontWeight: 500 }}>{k.sub}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Second KPI row: Financial ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Bookings',   value: allBookings.length, sub: `${confirmedBooks} confirmed`,        color: '#2563eb', bg: '#eff6ff', icon: <CalendarOutlined />, path: '/admin/sites' },
          { label: 'Revenue Collected',value: `$${Number(totalRevenue).toLocaleString()}`, sub: 'From paid invoices', color: '#059669', bg: '#f0fdf4', icon: <CreditCardOutlined />, path: '/admin/billing' },
          { label: 'Pending Revenue',  value: `$${Number(totalPending).toLocaleString()}`, sub: 'Awaiting payment',  color: '#d97706', bg: '#fffbeb', icon: <CreditCardOutlined />, path: '/admin/billing' },
          { label: 'Open Tickets',     value: mxStats?.open ?? 0,  sub: `${mxStats?.in_progress ?? 0} in progress`, color: '#dc2626', bg: '#fef2f2', icon: <ToolOutlined />,       path: '/admin/maintenance' },
        ].map(k => (
          <div
            key={k.label}
            style={{ ...CARD, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s' }}
            onClick={() => navigate(k.path)}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b', fontWeight: 500 }}>{k.label}</p>
                {isLoading ? <Skeleton.Button active size="small" /> : (
                  <>
                    <p style={{ margin: '0 0 2px', fontSize: typeof k.value === 'string' ? 20 : 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{k.value}</p>
                    <p style={{ margin: 0, fontSize: 11, color: k.color }}>{k.sub}</p>
                  </>
                )}
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: k.color }}>
                {k.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Overdue alert ── */}
      {overdueInv > 0 && (
        <div
          onClick={() => navigate('/admin/billing')}
          style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontWeight: 600, color: '#b91c1c', fontSize: 14 }}>
            {overdueInv} overdue invoice{overdueInv > 1 ? 's' : ''} require immediate attention
          </span>
          <ArrowRightOutlined style={{ color: '#dc2626', marginLeft: 'auto' }} />
        </div>
      )}

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 20, marginBottom: 24 }}>

        {/* Booking trend */}
        <div style={{ ...CARD, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Booking Trend</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Monthly bookings over time</div>
            </div>
            <button onClick={() => navigate('/admin/sites')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          <div style={{ height: 180 }}>
            {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : <BookingTrendChart bookings={allBookings} />}
          </div>
        </div>

        {/* Revenue trend */}
        <div style={{ ...CARD, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Revenue Collected</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Monthly paid invoices</div>
            </div>
            <button onClick={() => navigate('/admin/billing')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          <div style={{ height: 180 }}>
            {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : <RevenueChart invoices={allInvoices} />}
          </div>
        </div>

        {/* Space status donut */}
        <div style={{ ...CARD, padding: '18px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>Space Status</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>{allSpaces.length} total spaces</div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : (
            <>
              <SpaceStatusChart available={available} occupied={occupied} reserved={reserved} maintenance={maintenance} />
              <div style={{ marginTop: 12 }}>
                {[
                  { label: 'Available',   value: available,   color: '#22c55e' },
                  { label: 'Occupied',    value: occupied,    color: '#3b82f6' },
                  { label: 'Reserved',    value: reserved,    color: '#f59e0b' },
                  { label: 'Maintenance', value: maintenance, color: '#ef4444' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: '#374151' }}>{s.label}</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom tables ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Recent Tenants */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Recent Tenants</div>
            <button onClick={() => navigate('/admin/tenants')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          {isLoading ? (
            <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
          ) : recentTenants.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No tenants yet</div>
          ) : recentTenants.map((t: any, i: number) => {
            const ts = TENANT_STATUS[t.status] ?? { bg: '#f1f5f9', color: '#475569' };
            return (
              <div
                key={t.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < recentTenants.length - 1 ? '1px solid #f8fafc' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
                onClick={() => navigate(`/admin/tenants/${t.id}`)}
              >
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                  {t.name[0]}{t.name.split(' ')[1]?.[0] ?? ''}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.contact_email}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <span style={{ background: ts.bg, color: ts.color, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{t.status}</span>
                  <span style={{ background: '#f1f5f9', color: '#475569', fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{t.subscription_plan}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Bookings */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Recent Bookings</div>
            <button onClick={() => navigate('/admin/sites')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          {isLoading ? (
            <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
          ) : recentBookings.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No bookings yet</div>
          ) : recentBookings.map((b: any, i: number) => {
            const bs = BOOKING_STATUS[b.status] ?? { bg: '#f1f5f9', color: '#475569' };
            return (
              <div
                key={b.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < recentBookings.length - 1 ? '1px solid #f8fafc' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CalendarOutlined style={{ color: '#2563eb', fontSize: 15 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', fontFamily: 'monospace' }}>{b.booking_number}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {b.space?.name ?? 'Space'} · {new Date(b.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>${parseFloat(b.total_price).toLocaleString()}</div>
                  <span style={{ background: bs.bg, color: bs.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>{b.status.replace(/_/g, ' ')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sites grid ── */}
      {allSites.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Branch Overview</div>
            <button onClick={() => navigate('/admin/sites')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>View all sites →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {allSites.slice(0, 4).map((site: any) => {
              const siteSpaces = allSpaces.filter((sp: any) => sp.floor?.building?.site_id === site.id);
              const siteOcc    = siteSpaces.filter((sp: any) => sp.status === 'OCCUPIED').length;
              const occR       = siteSpaces.length > 0 ? Math.round((siteOcc / siteSpaces.length) * 100) : 0;
              const occColor   = occR >= 80 ? '#22c55e' : occR >= 60 ? '#f59e0b' : '#ef4444';
              return (
                <div
                  key={site.id}
                  style={{ ...CARD, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s' }}
                  onClick={() => navigate(`/admin/sites/${site.id}`)}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: '#fff' }}>
                      {site.code}
                    </div>
                    <span style={{ background: site.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2', color: site.status === 'ACTIVE' ? '#15803d' : '#b91c1c', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
                      {site.status}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{site.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>{site.city}, {site.country}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11 }}>
                    <span style={{ color: '#64748b' }}>Occupancy</span>
                    <span style={{ fontWeight: 700, color: occColor }}>{occR}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{ width: `${occR}%`, height: '100%', background: occColor, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
