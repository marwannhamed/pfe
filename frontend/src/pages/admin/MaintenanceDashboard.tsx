import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import { message } from '../../utils/feedback';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  ToolOutlined, ReloadOutlined, ArrowRightOutlined,
  WarningOutlined, CheckCircleOutlined, ClockCircleOutlined,
  LoadingOutlined, UserOutlined,
} from '@ant-design/icons';
import { maintenanceApi, userApi } from '../../api/services';

function getAssignee(ticket: any) {
  return ticket?.assignedTo ?? ticket?.assignee ?? null;
}
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useAuthReady } from '../../hooks/useAuthReady';
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
function daysSince(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

// ─── Status / Priority configs ─────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  OPEN:        { label: 'Open',        bg: '#fef3c7', color: '#92400e', icon: <ClockCircleOutlined /> },
  ASSIGNED:    { label: 'Assigned',    bg: '#dbeafe', color: '#1d4ed8', icon: <UserOutlined />        },
  IN_PROGRESS: { label: 'In Progress', bg: '#ede9fe', color: '#6d28d9', icon: <LoadingOutlined />     },
  RESOLVED:    { label: 'Resolved',    bg: '#dcfce7', color: '#15803d', icon: <CheckCircleOutlined /> },
  CLOSED:      { label: 'Closed',      bg: '#f1f5f9', color: '#475569', icon: <CheckCircleOutlined /> },
  CANCELLED:   { label: 'Cancelled',   bg: '#fee2e2', color: '#b91c1c', icon: <WarningOutlined />     },
};
const PRIORITY_CFG: Record<string, { label: string; bg: string; color: string; order: number }> = {
  EMERGENCY: { label: 'Emergency', bg: '#fef2f2', color: '#b91c1c', order: 0 },
  URGENT:    { label: 'Urgent',    bg: '#fee2e2', color: '#dc2626', order: 1 },
  HIGH:      { label: 'High',      bg: '#fef3c7', color: '#d97706', order: 2 },
  NORMAL:    { label: 'Normal',    bg: '#dbeafe', color: '#2563eb', order: 3 },
  LOW:       { label: 'Low',       bg: '#f1f5f9', color: '#475569', order: 4 },
};
const PRIORITY_COLORS = {
  EMERGENCY: '#b91c1c', URGENT: '#dc2626', HIGH: '#f59e0b', NORMAL: '#3b82f6', LOW: '#94a3b8',
};
const STATUS_COLORS = {
  OPEN: '#f59e0b', ASSIGNED: '#3b82f6', IN_PROGRESS: '#8b5cf6',
  RESOLVED: '#10b981', CLOSED: '#94a3b8', CANCELLED: '#ef4444',
};

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 14px' }}>
      {label && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#fff' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <strong>{p.value}</strong>
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

// ─── Quick Action Button ───────────────────────────────────────────────────────
function QuickAction({ ticket, onAction, loading }: { ticket: any; onAction: (action: string, id: string) => void; loading: boolean }) {
  const s = ticket.status;
  if (s === 'OPEN' && !getAssignee(ticket)) return (
    <button onClick={() => onAction('accept', ticket.id)} disabled={loading}
      style={{ padding: '5px 10px', borderRadius: 7, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: 11, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
      {loading ? <LoadingOutlined /> : '✓'} Accept
    </button>
  );
  if (s === 'OPEN' || s === 'ASSIGNED') return (
    <button onClick={() => onAction('start', ticket.id)} disabled={loading}
      style={{ padding: '5px 10px', borderRadius: 7, background: '#ede9fe', border: '1px solid #c4b5fd', color: '#7c3aed', fontSize: 11, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
      {loading ? <LoadingOutlined /> : '▶'} Start
    </button>
  );
  if (s === 'IN_PROGRESS') return (
    <button onClick={() => onAction('resolve', ticket.id)} disabled={loading}
      style={{ padding: '5px 10px', borderRadius: 7, background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', fontSize: 11, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
      {loading ? <LoadingOutlined /> : '✓'} Resolve
    </button>
  );
  if (s === 'RESOLVED') return (
    <button onClick={() => onAction('close', ticket.id)} disabled={loading}
      style={{ padding: '5px 10px', borderRadius: 7, background: '#f1f5f9', border: '1px solid #e5e7eb', color: '#475569', fontSize: 11, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
      Close
    </button>
  );
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MaintenanceDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const authReady = useAuthReady();
  const { t }    = useThemeStore();
  const qc = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const opts = (k: string) => ({ queryKey: [k, refreshKey], enabled: authReady });

  const CARD: React.CSSProperties = {
    background: t.cardBg, borderRadius: 14,
    border: `1px solid ${t.cardBorder}`,
    boxShadow: t.cardShadow,
  };

  const { data: ticketsRaw, isLoading: l1 } = useQuery({ ...opts('md-tickets'), queryFn: () => maintenanceApi.getAll().then(r => r.data) });
  const { isLoading: l2 } = useQuery({ ...opts('md-stats'), queryFn: () => maintenanceApi.getStats().then(r => r.data) });
  const { data: usersRaw }                   = useQuery({ ...opts('md-users'),   queryFn: () => userApi.getAll().then(r => r.data) });

  const isLoading = l1 || l2;
  const tickets   = toArray<any>(ticketsRaw);
  const users     = toArray<any>(usersRaw);

  const acceptMut  = useMutation({ mutationFn: (id: string) => maintenanceApi.accept(id),  onSuccess: () => { qc.invalidateQueries({ queryKey: ['md-tickets'] }); message.success('Ticket accepted!'); } });
  const startMut   = useMutation({ mutationFn: (id: string) => maintenanceApi.start(id),   onSuccess: () => { qc.invalidateQueries({ queryKey: ['md-tickets'] }); message.success('Ticket started!');  } });
  const resolveMut = useMutation({ mutationFn: (id: string) => maintenanceApi.resolve(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['md-tickets'] }); message.success('Ticket resolved! ✅'); } });
  const closeMut   = useMutation({ mutationFn: (id: string) => maintenanceApi.close(id),   onSuccess: () => { qc.invalidateQueries({ queryKey: ['md-tickets'] }); message.success('Ticket closed.'); } });

  const handleAction = async (action: string, id: string) => {
    setActionLoading(id);
    try {
      if (action === 'accept')  await acceptMut.mutateAsync(id);
      if (action === 'start')   await startMut.mutateAsync(id);
      if (action === 'resolve') await resolveMut.mutateAsync(id);
      if (action === 'close')   await closeMut.mutateAsync(id);
    } finally {
      setActionLoading(null);
    }
  };

  const open       = tickets.filter(t => t.status === 'OPEN').length;
  const assigned   = tickets.filter(t => t.status === 'ASSIGNED').length;
  const inProgress = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const resolved   = tickets.filter(t => t.status === 'RESOLVED').length;
  const closed     = tickets.filter(t => t.status === 'CLOSED').length;
  const emergency  = tickets.filter(t => t.priority === 'EMERGENCY').length;
  const urgent     = tickets.filter(t => t.priority === 'URGENT').length;
  const avgAge     = tickets.length > 0
    ? Math.round(tickets.filter(t => !['CLOSED','CANCELLED'].includes(t.status)).reduce((s, t) => s + daysSince(t.created_at), 0) / Math.max(1, tickets.filter(t => !['CLOSED','CANCELLED'].includes(t.status)).length))
    : 0;

  const statusDonut = Object.entries(STATUS_COLORS).map(([name, color]) => ({
    name, color, value: tickets.filter(t => t.status === name).length,
  })).filter(s => s.value > 0);

  const priorityDonut = Object.entries(PRIORITY_COLORS).map(([name, color]) => ({
    name, color, value: tickets.filter(t => t.priority === name).length,
  })).filter(s => s.value > 0);

  const byCategory = useMemo(() => {
    const c: Record<string, number> = {};
    tickets.forEach(t => { c[t.category] = (c[t.category] || 0) + 1; });
    return Object.entries(c)
      .map(([name, value]) => ({ name: name.replace(/_/g,' ').toLowerCase(), value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [tickets]);

  const trend = useMemo(() => {
    const b: Record<string, { Created: number; Resolved: number }> = {};
    tickets.forEach(t => {
      const k = fmtMonth(t.created_at);
      if (!b[k]) b[k] = { Created: 0, Resolved: 0 };
      b[k].Created++;
      if (['RESOLVED','CLOSED'].includes(t.status)) b[k].Resolved++;
    });
    return Object.entries(b).slice(-6).map(([date, v]) => ({ date, ...v }));
  }, [tickets]);

  const workload = useMemo(() => {
    const w: Record<string, { name: string; Open: number; InProgress: number; Resolved: number }> = {};
    tickets.forEach(t => {
      if (!t.assigned_to_user_id) return;
      if (!w[t.assigned_to_user_id]) {
        const u = users.find(u => u.id === t.assigned_to_user_id);
        w[t.assigned_to_user_id] = { name: u ? `${u.first_name} ${u.last_name}` : 'Unknown', Open: 0, InProgress: 0, Resolved: 0 };
      }
      if (t.status === 'OPEN' || t.status === 'ASSIGNED') w[t.assigned_to_user_id].Open++;
      else if (t.status === 'IN_PROGRESS') w[t.assigned_to_user_id].InProgress++;
      else if (['RESOLVED','CLOSED'].includes(t.status)) w[t.assigned_to_user_id].Resolved++;
    });
    return Object.values(w).sort((a, b) => (b.Open + b.InProgress) - (a.Open + a.InProgress)).slice(0, 6);
  }, [tickets, users]);

  const activeTickets = tickets
    .filter(t => !['CLOSED','CANCELLED'].includes(t.status))
    .sort((a, b) => {
      const pa = PRIORITY_CFG[a.priority]?.order ?? 5;
      const pb = PRIORITY_CFG[b.priority]?.order ?? 5;
      if (pa !== pb) return pa - pb;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })
    .slice(0, 8);

  const recentResolved = [...tickets]
    .filter(t => ['RESOLVED','CLOSED'].includes(t.status))
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 5);

  return (
    <PageShell>

      <PageHeader
        title="Maintenance Dashboard"
        subtitle={`Welcome, ${user?.first_name ?? 'Technician'} · Tickets, workload & resolution tracking`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/admin/maintenance')}
              style={{ padding: '9px 16px', borderRadius: 9, border: `1px solid ${t.cardBorder}`, background: t.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: t.text }}>
              All Tickets →
            </button>
            <button onClick={() => setRefreshKey(k => k + 1)}
              style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${t.cardBorder}`, background: t.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ReloadOutlined spin={isLoading} /> Refresh
            </button>
          </div>
        }
      />

      <RoleDashboardHero role={user?.role} userName={user?.first_name} />

      {/* Alert banners */}
      {emergency > 0 && (
        <div onClick={() => navigate('/admin/maintenance')}
          style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', animation: 'pulse 2s ease-in-out infinite' }}>
          <span style={{ fontSize: 20 }}>🚨</span>
          <span style={{ fontWeight: 800, color: '#b91c1c', fontSize: 14 }}>
            {emergency} EMERGENCY ticket{emergency > 1 ? 's' : ''} — requires immediate action!
          </span>
          <ArrowRightOutlined style={{ color: '#dc2626', marginLeft: 'auto' }} />
        </div>
      )}
      {urgent > 0 && (
        <div onClick={() => navigate('/admin/maintenance')}
          style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <WarningOutlined style={{ color: '#dc2626', fontSize: 18 }} />
          <span style={{ fontWeight: 600, color: '#dc2626', fontSize: 14 }}>
            {urgent} urgent ticket{urgent > 1 ? 's' : ''} need attention
          </span>
          <ArrowRightOutlined style={{ color: '#dc2626', marginLeft: 'auto' }} />
        </div>
      )}

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Open Tickets"   value={open}       sub={`${assigned} assigned · ${inProgress} in progress`} color="#f59e0b" bg="#fffbeb" icon={<ClockCircleOutlined />} path="/admin/maintenance" loading={isLoading} />
        <KpiCard label="In Progress"    value={inProgress} sub={`${workload.length} staff members active`}           color="#7c3aed" bg="#f5f3ff" icon={<ToolOutlined />}        path="/admin/maintenance" loading={isLoading} />
        <KpiCard label="Resolved"       value={resolved}   sub={`${closed} closed · total done`}                    color="#059669" bg="#f0fdf4" icon={<CheckCircleOutlined />}  path="/admin/maintenance" loading={isLoading} />
        <KpiCard label="Avg Age (days)" value={avgAge}     sub={`Of active tickets`}                                color={avgAge > 7 ? '#dc2626' : '#059669'} bg={avgAge > 7 ? '#fef2f2' : '#f0fdf4'} icon="📅" loading={isLoading} alert={avgAge > 7} />
      </div>

      {/* Stats summary bar */}
      <div style={{ ...CARD, padding: '14px 24px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)' }}>
          {[
            { label: 'Open',        value: open,       color: '#f59e0b' },
            { label: 'Assigned',    value: assigned,   color: '#3b82f6' },
            { label: 'In Progress', value: inProgress, color: '#8b5cf6' },
            { label: 'Resolved',    value: resolved,   color: '#10b981' },
            { label: 'Closed',      value: closed,     color: '#94a3b8' },
            { label: 'Total',       value: tickets.length, color: t.text },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '4px 0', borderRight: i < 5 ? `1px solid ${t.divider}` : 'none' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{isLoading ? '—' : s.value}</div>
              <div style={{ fontSize: 10, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* Resolution progress bar */}
        {tickets.length > 0 && !isLoading && (
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 8, background: t.divider, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
              {[
                { v: open,       c: '#f59e0b' },
                { v: assigned,   c: '#3b82f6' },
                { v: inProgress, c: '#8b5cf6' },
                { v: resolved,   c: '#10b981' },
                { v: closed,     c: '#e5e7eb' },
              ].map((s, i) => (
                <div key={i} style={{ height: '100%', width: `${(s.v / tickets.length) * 100}%`, background: s.c, transition: 'width 0.5s' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 5, fontSize: 10, color: t.textMuted, flexWrap: 'wrap' }}>
              <span style={{ color: '#f59e0b' }}>■ Open</span>
              <span style={{ color: '#3b82f6' }}>■ Assigned</span>
              <span style={{ color: '#8b5cf6' }}>■ In Progress</span>
              <span style={{ color: '#10b981' }}>■ Resolved</span>
              <span style={{ color: '#94a3b8' }}>■ Closed</span>
              <span style={{ marginLeft: 'auto' }}>
                Resolution rate: <strong style={{ color: '#059669' }}>
                  {tickets.length > 0 ? Math.round(((resolved + closed) / tickets.length) * 100) : 0}%
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row 1: Trend + By Category */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Ticket trend */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>📈 Ticket Trend</div>
              <div style={{ fontSize: 12, color: t.textSub }}>Created vs Resolved — last 6 months</div>
            </div>
            <button onClick={() => navigate('/admin/maintenance')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View all →</button>
          </div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : trend.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 28 }}>📈</div><div style={{ fontSize: 12 }}>No ticket data yet</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.divider} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: t.textMuted }} />
                <YAxis tick={{ fontSize: 11, fill: t.textMuted }} width={28} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="Created"  name="Created"  stroke="#f59e0b" strokeWidth={2.5} fill="url(#cGrad)" dot={{ r: 3, fill: '#f59e0b' }} />
                <Area type="monotone" dataKey="Resolved" name="Resolved" stroke="#10b981" strokeWidth={2.5} fill="url(#rGrad)" dot={{ r: 3, fill: '#10b981' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By category */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>🔧 Tickets by Category</div>
              <div style={{ fontSize: 12, color: t.textSub }}>{tickets.length} total tickets</div>
            </div>
          </div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : byCategory.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 28 }}>🔧</div><div style={{ fontSize: 12 }}>No tickets yet</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byCategory} layout="vertical" barSize={12} margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.divider} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: t.textMuted }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: t.textSub }} width={90} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="value" name="Tickets" radius={[0,6,6,0]}>
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={['#f59e0b','#ef4444','#3b82f6','#10b981','#8b5cf6','#0891b2','#d97706','#94a3b8'][i % 8]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2: Status donut + Priority donut + Workload */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Status donut */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: t.text, marginBottom: 4 }}>📊 By Status</div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 12 }}>{tickets.length} total</div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : (
            <>
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={statusDonut} cx="50%" cy="50%" innerRadius={42} outerRadius={60} paddingAngle={3} dataKey="value">
                      {statusDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: t.text }}>{open + inProgress}</div>
                  <div style={{ fontSize: 9, color: t.textMuted }}>Active</div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                {statusDonut.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: t.textSub, textTransform: 'capitalize' }}>{s.name.replace(/_/g,' ').toLowerCase()}</span>
                    <span style={{ fontWeight: 700, color: t.text }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Priority donut */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: t.text, marginBottom: 4 }}>🎯 By Priority</div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 12 }}>
            {emergency > 0 && <span style={{ color: '#b91c1c', fontWeight: 700 }}>{emergency} emergency! · </span>}
            {urgent} urgent
          </div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : (
            <>
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={priorityDonut} cx="50%" cy="50%" innerRadius={42} outerRadius={60} paddingAngle={3} dataKey="value">
                      {priorityDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: emergency > 0 ? '#b91c1c' : t.text }}>
                    {emergency + urgent}
                  </div>
                  <div style={{ fontSize: 9, color: t.textMuted }}>Critical</div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                {priorityDonut.map((s, i) => (
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

        {/* Workload per assignee */}
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: t.text, marginBottom: 4 }}>👷 Team Workload</div>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 12 }}>Active tickets per assignee</div>
          {isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : workload.length === 0 ? (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted, flexDirection: 'column', gap: 6 }}>
              <UserOutlined style={{ fontSize: 28 }} /><div style={{ fontSize: 12 }}>No assigned tickets</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {workload.map((w, i) => {
                const total = w.Open + w.InProgress + w.Resolved;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {w.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{w.name}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>{total}</span>
                    </div>
                    <div style={{ height: 5, background: t.divider, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ height: '100%', width: `${total > 0 ? (w.Open / total) * 100 : 0}%`, background: '#f59e0b' }} />
                      <div style={{ height: '100%', width: `${total > 0 ? (w.InProgress / total) * 100 : 0}%`, background: '#8b5cf6' }} />
                      <div style={{ height: '100%', width: `${total > 0 ? (w.Resolved / total) * 100 : 0}%`, background: '#10b981' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 12, fontSize: 9, color: t.textMuted, marginTop: 4 }}>
                <span style={{ color: '#f59e0b' }}>■ Open</span>
                <span style={{ color: '#8b5cf6' }}>■ In Progress</span>
                <span style={{ color: '#10b981' }}>■ Resolved</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Active tickets queue + Recently resolved */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Active ticket queue */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>⚡ Active Queue</div>
              <span style={{ background: open + inProgress > 0 ? '#fef3c7' : '#f0fdf4', color: open + inProgress > 0 ? '#92400e' : '#15803d', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
                {open + assigned + inProgress} active
              </span>
            </div>
            <button onClick={() => navigate('/admin/maintenance')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View all →</button>
          </div>
          {isLoading ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 5 }} /></div>
            : activeTickets.length === 0
            ? <div style={{ padding: '32px', textAlign: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 32, color: '#22c55e', display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Queue is clear! 🎉</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>No active tickets right now.</div>
              </div>
            : activeTickets.map((tk: any, i: number) => {
              const pm = PRIORITY_CFG[tk.priority] ?? PRIORITY_CFG.NORMAL;
              const sm = STATUS_CFG[tk.status]   ?? STATUS_CFG.OPEN;
              const age = daysSince(tk.created_at);
              return (
                <div key={tk.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px', borderBottom: i < activeTickets.length - 1 ? `1px solid ${t.divider}` : 'none', transition: 'background 0.1s', background: tk.priority === 'EMERGENCY' ? '#fff5f5' : '' }}
                  onMouseEnter={e => (e.currentTarget.style.background = tk.priority === 'EMERGENCY' ? '#fee2e2' : t.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = tk.priority === 'EMERGENCY' ? '#fff5f5' : '')}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: pm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ToolOutlined style={{ color: pm.color, fontSize: 14 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tk.title}</div>
                    <div style={{ fontSize: 10, color: t.textMuted, display: 'flex', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace' }}>{tk.ticket_number}</span>
                      <span>{age}d old</span>
                      {tk.space?.name && <span>· {tk.space.name}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ background: pm.bg, color: pm.color, fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 20 }}>{pm.label}</span>
                    <span style={{ background: sm.bg, color: sm.color, fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 20 }}>{sm.label}</span>
                    <QuickAction ticket={tk} onAction={handleAction} loading={actionLoading === tk.id} />
                  </div>
                </div>
              );
            })}
        </div>

        {/* Recently resolved */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>✅ Recently Resolved</div>
            <button onClick={() => navigate('/admin/maintenance')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View all →</button>
          </div>
          {isLoading ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
            : recentResolved.length === 0
            ? <div style={{ padding: '32px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>No resolved tickets yet</div>
            : recentResolved.map((tk: any, i: number) => {
              const pm = PRIORITY_CFG[tk.priority] ?? PRIORITY_CFG.NORMAL;
              const sm = STATUS_CFG[tk.status]   ?? STATUS_CFG.RESOLVED;
              return (
                <div key={tk.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < recentResolved.length - 1 ? `1px solid ${t.divider}` : 'none' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckCircleOutlined style={{ color: '#15803d', fontSize: 16 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tk.title}</div>
                    <div style={{ fontSize: 10, color: t.textMuted, display: 'flex', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace' }}>{tk.ticket_number}</span>
                      <span>· {tk.category?.replace(/_/g,' ')}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <span style={{ background: pm.bg, color: pm.color, fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 20 }}>{pm.label}</span>
                    <span style={{ background: sm.bg, color: sm.color, fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 20 }}>{sm.label}</span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </PageShell>
  );
}