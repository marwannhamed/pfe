import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  BankOutlined, AppstoreOutlined, CalendarOutlined,
  ToolOutlined, ReloadOutlined, ArrowRightOutlined,
  CheckCircleOutlined, ClockCircleOutlined, WarningOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import {
  siteApi, spaceApi, bookingApi,
  maintenanceApi, buildingApi,
} from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

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
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function ChartTip({ active, payload, label, isCurrency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 14px' }}>
      {label && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#fff' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <strong>{isCurrency ? `$${Number(p.value).toLocaleString()}` : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ label, value, sub, color, bg, icon, path, loading, alert }: {
  label: string; value: string | number; sub: string;
  color: string; bg: string; icon: React.ReactNode;
  path?: string; loading?: boolean; alert?: boolean;
}) {
  const navigate = useNavigate();
  const { t } = useThemeStore();
  return (
    <div style={{ background: t.cardBg, borderRadius: 14, border: `1px solid ${alert ? '#fca5a5' : t.cardBorder}`, boxShadow: t.cardShadow, padding: '18px 20px', cursor: path ? 'pointer' : 'default', transition: 'all 0.15s' }}
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
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 11, color }}>{sub}</div>
        </>
      )}
      <div style={{ marginTop: 10, height: 3, background: t.divider, borderRadius: 2 }}>
        <div style={{ height: 3, borderRadius: 2, background: color, width: '60%' }} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SiteManagerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t }    = useThemeStore();
  const [refreshKey, setRefreshKey] = useState(0);
  const opts = (k: string) => ({ queryKey: [k, refreshKey] });

  const CARD: React.CSSProperties = {
    background: t.cardBg, borderRadius: 14,
    border: `1px solid ${t.cardBorder}`,
    boxShadow: t.cardShadow,
  };

  const { data: sitesRaw,    isLoading: l1 } = useQuery({ ...opts('sm-sites'),    queryFn: () => siteApi.getAll().then(r => r.data) });
  const { data: spacesRaw,   isLoading: l2 } = useQuery({ ...opts('sm-spaces'),   queryFn: () => spaceApi.getAll().then(r => r.data) });
  const { data: bookingsRaw, isLoading: l3 } = useQuery({ ...opts('sm-bookings'), queryFn: () => bookingApi.getAll().then(r => r.data) });
  const { data: mxRaw,       isLoading: l4 } = useQuery({ ...opts('sm-mx'),       queryFn: () => maintenanceApi.getAll().then(r => r.data) });
  const { data: mxStats,     isLoading: l5 } = useQuery({ ...opts('sm-mxstats'),  queryFn: () => maintenanceApi.getStats().then(r => r.data) });
  const { data: buildingsRaw }               = useQuery({ ...opts('sm-buildings'), queryFn: () => buildingApi.getAll().then(r => r.data) });

  const isLoading = l1 || l2 || l3 || l4 || l5;

  const sites     = toArray<any>(sitesRaw);
  const spaces    = toArray<any>(spacesRaw);
  const bookings  = toArray<any>(bookingsRaw);
  const tickets   = toArray<any>(mxRaw);
  const buildings = toArray<any>(buildingsRaw);

  const available   = spaces.filter(s => s.status === 'AVAILABLE').length;
  const occupied    = spaces.filter(s => s.status === 'OCCUPIED').length;
  const reserved    = spaces.filter(s => s.status === 'RESERVED').length;
  const inMaint     = spaces.filter(s => s.status === 'MAINTENANCE').length;
  const occRate     = spaces.length > 0 ? Math.round((occupied / spaces.length) * 100) : 0;

  const pendingBook  = bookings.filter(b => b.status === 'PENDING_APPROVAL').length;
  const confirmedBook= bookings.filter(b => b.status === 'CONFIRMED').length;
  const checkedIn    = bookings.filter(b => b.status === 'CHECKED_IN').length;

  const openTix      = tickets.filter(t => t.status === 'OPEN').length;
  const inProgTix    = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const urgentTix    = tickets.filter(t => ['URGENT','EMERGENCY'].includes(t.priority)).length;

  const spaceDonut = [
    { name: 'Available',   value: available, color: '#22c55e' },
    { name: 'Occupied',    value: occupied,  color: '#3b82f6' },
    { name: 'Reserved',    value: reserved,  color: '#f59e0b' },
    { name: 'Maintenance', value: inMaint,   color: '#ef4444' },
  ].filter(s => s.value > 0);

  const bookingTrend = useMemo(() => {
    const b: Record<string, { Confirmed: number; Pending: number; Cancelled: number }> = {};
    bookings.forEach(bk => {
      const k = fmtMonth(bk.created_at);
      if (!b[k]) b[k] = { Confirmed: 0, Pending: 0, Cancelled: 0 };
      if (['CONFIRMED','CHECKED_IN','COMPLETED'].includes(bk.status)) b[k].Confirmed++;
      else if (bk.status === 'PENDING_APPROVAL') b[k].Pending++;
      else if (bk.status === 'CANCELLED') b[k].Cancelled++;
    });
    return Object.entries(b).slice(-6).map(([date, v]) => ({ date, ...v }));
  }, [bookings]);

  const mxByCategory = useMemo(() => {
    const c: Record<string, number> = {};
    tickets.forEach(t => { c[t.category] = (c[t.category] || 0) + 1; });
    return Object.entries(c).map(([name, value]) => ({ name: name.replace(/_/g,' ').toLowerCase(), value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [tickets]);

  const siteOcc = useMemo(() =>
    sites.map(s => {
      const ss = spaces.filter(sp => sp.floor?.building?.site_id === s.id);
      const occ = ss.filter(sp => sp.status === 'OCCUPIED').length;
      const rate = ss.length > 0 ? Math.round((occ / ss.length) * 100) : 0;
      return { name: s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name, Occupancy: rate, total: ss.length };
    }), [sites, spaces]);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const thisWeekBookings = bookings.filter(b => new Date(b.start_datetime) >= weekStart);

  const recentBookings = [...bookings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  const urgentTickets = tickets
    .filter(t => ['OPEN','IN_PROGRESS'].includes(t.status) && ['URGENT','EMERGENCY','HIGH'].includes(t.priority))
    .sort((a, b) => {
      const p = { EMERGENCY: 0, URGENT: 1, HIGH: 2 };
      return (p[a.priority as keyof typeof p] ?? 3) - (p[b.priority as keyof typeof p] ?? 3);
    })
    .slice(0, 5);

  const BOOK_STATUS: Record<string, { bg: string; color: string }> = {
    CONFIRMED:        { bg: '#dcfce7', color: '#15803d' },
    PENDING_APPROVAL: { bg: '#fef3c7', color: '#92400e' },
    CHECKED_IN:       { bg: '#dbeafe', color: '#1d4ed8' },
    COMPLETED:        { bg: '#ede9fe', color: '#6d28d9' },
    CANCELLED:        { bg: '#fee2e2', color: '#b91c1c' },
    DRAFT:            { bg: '#f1f5f9', color: '#475569' },
  };
  const PRIO_META: Record<string, { bg: string; color: string }> = {
    EMERGENCY: { bg: '#fef2f2', color: '#b91c1c' },
    URGENT:    { bg: '#fef2f2', color: '#dc2626' },
    HIGH:      { bg: '#fef3c7', color: '#d97706' },
    NORMAL:    { bg: '#dbeafe', color: '#2563eb' },
    LOW:       { bg: '#f1f5f9', color: '#475569' },
  };

  return (
    <div style={{ padding: 24, background: t.pageBg, minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: t.text }}>
            🏗️ Site Manager Dashboard
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: t.textSub }}>
            Welcome, <strong style={{ color: t.text }}>{user?.first_name}</strong> · Spaces, bookings & maintenance overview
          </p>
        </div>
        <button onClick={() => setRefreshKey(k => k + 1)}
          style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${t.cardBorder}`, background: t.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ReloadOutlined spin={isLoading} /> Refresh
        </button>
      </div>

      {/* Alert banners */}
      {pendingBook > 0 && (
        <div onClick={() => navigate('/admin/bookings')}
          style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <ClockCircleOutlined style={{ color: '#d97706', fontSize: 18 }} />
          <span style={{ fontWeight: 600, color: '#92400e', fontSize: 14 }}>
            {pendingBook} booking{pendingBook > 1 ? 's' : ''} awaiting your approval
          </span>
          <ArrowRightOutlined style={{ color: '#d97706', marginLeft: 'auto' }} />
        </div>
      )}
      {urgentTix > 0 && (
        <div onClick={() => navigate('/admin/maintenance')}
          style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <WarningOutlined style={{ color: '#dc2626', fontSize: 18 }} />
          <span style={{ fontWeight: 600, color: '#b91c1c', fontSize: 14 }}>
            {urgentTix} urgent/emergency maintenance ticket{urgentTix > 1 ? 's' : ''} need attention
          </span>
          <ArrowRightOutlined style={{ color: '#dc2626', marginLeft: 'auto' }} />
        </div>
      )}

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Total Sites"    value={sites.length}    sub={`${sites.filter(s => s.status === 'ACTIVE').length} active`}          color="#2563eb" bg="#eff6ff" icon={<BankOutlined />}        path="/admin/sites"       loading={isLoading} />
        <KpiCard label="Total Spaces"   value={spaces.length}   sub={`${occRate}% occupied · ${available} available`}                        color="#059669" bg="#f0fdf4" icon={<AppstoreOutlined />}   path="/admin/spaces"      loading={isLoading} />
        <KpiCard label="This Week"      value={thisWeekBookings.length} sub={`${confirmedBook} confirmed · ${pendingBook} pending`}          color="#d97706" bg="#fffbeb" icon={<CalendarOutlined />}   path="/admin/bookings"    loading={isLoading} />
        <KpiCard label="Open Tickets"   value={(mxStats as any)?.open ?? openTix} sub={`${urgentTix} urgent · ${inProgTix} in progress`}    color="#dc2626" bg="#fef2f2" icon={<ToolOutlined />}       path="/admin/maintenance" loading={isLoading} alert={urgentTix > 0} />
      </div>

      {/* Row 2 — Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 16, marginBottom: 16 }}>

        {/* Booking trend */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>📅 Booking Trends</div>
              <div style={{ fontSize: 12, color: t.textSub }}>Monthly — last 6 months</div>
            </div>
            <button onClick={() => navigate('/admin/bookings')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View all →</button>
          </div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : bookingTrend.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 28 }}>📅</div><div style={{ fontSize: 12 }}>No booking data yet</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bookingTrend} barSize={10} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.divider} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: t.textMuted }} />
                <YAxis tick={{ fontSize: 11, fill: t.textMuted }} width={28} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="Confirmed" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="Pending"   fill="#f59e0b" radius={[4,4,0,0]} />
                <Bar dataKey="Cancelled" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Site occupancy */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>📍 Occupancy by Site</div>
              <div style={{ fontSize: 12, color: t.textSub }}>Current occupancy rate %</div>
            </div>
            <button onClick={() => navigate('/admin/sites')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View sites →</button>
          </div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : siteOcc.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 28 }}>📍</div><div style={{ fontSize: 12 }}>No sites yet</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={siteOcc} layout="vertical" barSize={14} margin={{ top: 0, right: 40, left: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.divider} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: t.textMuted }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: t.textSub }} width={80} />
                <Tooltip formatter={(v: any) => [`${v}%`, 'Occupancy']} />
                <Bar dataKey="Occupancy" radius={[0,6,6,0]}>
                  {siteOcc.map((e, i) => (
                    <Cell key={i} fill={e.Occupancy >= 80 ? '#3b82f6' : e.Occupancy >= 50 ? '#10b981' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Space status donut */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: t.text, marginBottom: 4 }}>🏢 Space Status</div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 14 }}>{spaces.length} spaces total</div>
          {isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : (
            <>
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={spaceDonut} cx="50%" cy="50%" innerRadius={42} outerRadius={60} paddingAngle={3} dataKey="value">
                      {spaceDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
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
                {spaceDonut.map((s, i) => (
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
      </div>

      {/* Row 3 — Maintenance by category + Recent bookings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Maintenance by category */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>🔧 Tickets by Category</div>
              <div style={{ fontSize: 12, color: t.textSub }}>{tickets.length} total tickets</div>
            </div>
            <button onClick={() => navigate('/admin/maintenance')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View all →</button>
          </div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : mxByCategory.length === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 28 }}>🔧</div><div style={{ fontSize: 12 }}>No tickets yet</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={mxByCategory} layout="vertical" barSize={12} margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.divider} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: t.textMuted }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: t.textSub, textTransform: 'capitalize' }} width={90} />
                <Tooltip />
                <Bar dataKey="value" name="Tickets" fill="#f59e0b" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Maintenance stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${t.divider}` }}>
            {[
              { label: 'Open',        value: (mxStats as any)?.open        ?? openTix,    color: '#f59e0b' },
              { label: 'In Progress', value: (mxStats as any)?.in_progress ?? inProgTix,  color: '#3b82f6' },
              { label: 'Resolved',    value: (mxStats as any)?.resolved    ?? 0,          color: '#10b981' },
              { label: 'Urgent',      value: urgentTix,                                    color: '#dc2626' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', background: t.tableHead, borderRadius: 8, padding: '8px 4px' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{isLoading ? '—' : s.value}</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent bookings */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>📅 Recent Bookings</div>
            <button onClick={() => navigate('/admin/bookings')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View all →</button>
          </div>
          {isLoading ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 5 }} /></div>
            : recentBookings.length === 0
            ? <div style={{ padding: '40px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>No bookings yet</div>
            : recentBookings.map((b: any, i: number) => {
              const bs = BOOK_STATUS[b.status] ?? { bg: '#f1f5f9', color: '#475569' };
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < recentBookings.length - 1 ? `1px solid ${t.divider}` : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: bs.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CalendarOutlined style={{ color: bs.color, fontSize: 14 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: t.text, fontFamily: 'monospace' }}>{b.booking_number}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{b.space?.name ?? 'Space'} · {new Date(b.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {fmtTime(b.start_datetime)}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ background: bs.bg, color: bs.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-block', marginBottom: 3 }}>
                      {b.status.replace(/_/g,' ')}
                    </span>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.text }}>${parseFloat(b.total_price || 0).toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Row 4 — Urgent tickets + Sites grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Urgent maintenance tickets */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>🚨 Urgent Tickets</div>
              {urgentTix > 0 && <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>{urgentTix}</span>}
            </div>
            <button onClick={() => navigate('/admin/maintenance')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View all →</button>
          </div>
          {isLoading ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
            : urgentTickets.length === 0
            ? <div style={{ padding: '32px', textAlign: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 32, color: '#22c55e', display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>No urgent tickets!</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>All maintenance is under control.</div>
              </div>
            : urgentTickets.map((tk: any, i: number) => {
              const pm = PRIO_META[tk.priority] ?? PRIO_META.NORMAL;
              return (
                <div key={tk.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < urgentTickets.length - 1 ? `1px solid ${t.divider}` : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: pm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ToolOutlined style={{ color: pm.color, fontSize: 14 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tk.title}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{tk.ticket_number} · {tk.category?.replace(/_/g,' ')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <span style={{ background: pm.bg, color: pm.color, fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20 }}>{tk.priority}</span>
                    <span style={{ background: t.badge, color: t.badgeText, fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>{tk.status.replace(/_/g,' ')}</span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Sites overview */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>📍 My Sites</div>
            <button onClick={() => navigate('/admin/sites')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Manage →</button>
          </div>
          {isLoading ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
            : sites.length === 0
            ? <div style={{ padding: '40px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>No sites assigned</div>
            : sites.slice(0, 5).map((site: any, i: number) => {
              const ss = spaces.filter(sp => sp.floor?.building?.site_id === site.id);
              const occ = ss.filter(sp => sp.status === 'OCCUPIED').length;
              const rate = ss.length > 0 ? Math.round((occ / ss.length) * 100) : 0;
              const rateColor = rate >= 80 ? '#3b82f6' : rate >= 50 ? '#10b981' : '#f59e0b';
              return (
                <div key={site.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < sites.length - 1 ? `1px solid ${t.divider}` : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                  onClick={() => navigate(`/admin/sites/${site.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: '#fff', flexShrink: 0 }}>
                    {site.code}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: t.text, marginBottom: 2 }}>{site.name}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <EnvironmentOutlined style={{ fontSize: 10 }} />{site.city}, {site.country}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: rateColor, marginBottom: 4 }}>{rate}%</div>
                    <div style={{ height: 4, background: t.divider, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${rate}%`, background: rateColor, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 10, color: t.textMuted, marginTop: 3 }}>{ss.length} spaces</div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}