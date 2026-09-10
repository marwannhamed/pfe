import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PORTAL_MAP_PATH } from '../../constants/routes';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import {
  CalendarOutlined, ToolOutlined, TeamOutlined,
  FileTextOutlined, CreditCardOutlined, AppstoreOutlined,
  BellOutlined, ArrowRightOutlined, CheckCircleOutlined,
  ClockCircleOutlined, WarningOutlined, PlusOutlined, ReloadOutlined,
} from '@ant-design/icons';
import {
  bookingApi, maintenanceApi, userApi,
  contractApi, billingApi, notificationApi,
} from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { usePageTheme } from '../../hooks/usePageTheme';
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
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

// ─── Status configs ───────────────────────────────────────────────────────────
const BOOKING_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  CONFIRMED:        { bg: '#dcfce7', color: '#15803d', label: 'Confirmed'   },
  PENDING_APPROVAL: { bg: '#fef3c7', color: '#92400e', label: 'Pending'     },
  CHECKED_IN:       { bg: '#dbeafe', color: '#1d4ed8', label: 'Checked In'  },
  COMPLETED:        { bg: '#ede9fe', color: '#6d28d9', label: 'Completed'   },
  CANCELLED:        { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelled'   },
  DRAFT:            { bg: '#f1f5f9', color: '#475569', label: 'Draft'       },
};
const TICKET_STATUS: Record<string, { bg: string; color: string }> = {
  OPEN:        { bg: '#fef3c7', color: '#92400e' },
  ASSIGNED:    { bg: '#dbeafe', color: '#1d4ed8' },
  IN_PROGRESS: { bg: '#ede9fe', color: '#6d28d9' },
  RESOLVED:    { bg: '#dcfce7', color: '#15803d' },
  CLOSED:      { bg: '#f1f5f9', color: '#475569' },
};
const TICKET_PRIORITY: Record<string, { bg: string; color: string }> = {
  EMERGENCY: { bg: '#fef2f2', color: '#b91c1c' },
  URGENT:    { bg: '#fee2e2', color: '#dc2626' },
  HIGH:      { bg: '#fef3c7', color: '#d97706' },
  NORMAL:    { bg: '#dbeafe', color: '#2563eb' },
  LOW:       { bg: '#f1f5f9', color: '#475569' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, bg, icon, path, loading, t }: any) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => path && navigate(path)}
      style={{
        background: t.cardBg, borderRadius: 14,
        border: `1px solid ${t.cardBorder}`, boxShadow: t.cardShadow,
        padding: '18px 20px', cursor: path ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => path && (e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)')}
      onMouseLeave={e => path && (e.currentTarget.style.boxShadow = t.cardShadow)}
    >
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
        <div style={{ height: 3, borderRadius: 2, background: color, width: '55%' }} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TenantDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore() as any;
  const authReady = useAuthReady();
  const { t, card: CARD } = usePageTheme();
  const tenantId = user?.tenant_id;
  const isAdmin  = user?.role === 'TENANT_ADMIN';
  const [refreshKey, setRefreshKey] = useState(0);
  const opts = (k: string) => ({ queryKey: [k, tenantId, refreshKey], enabled: authReady && !!tenantId });

  // Queries
  const { data: bookingsRaw,  isLoading: l1 } = useQuery({ ...opts('td-bookings'),  queryFn: () => bookingApi.getAll({ tenantId }).then(r => r.data) });
  const { data: ticketsRaw,   isLoading: l2 } = useQuery({ ...opts('td-tickets'),   queryFn: () => maintenanceApi.getAll().then(r => r.data) });
  const { data: usersRaw,     isLoading: l3 } = useQuery({ ...opts('td-users'),     queryFn: () => userApi.getAll(tenantId).then(r => r.data), enabled: authReady && !!tenantId && isAdmin });
  const { data: contractsRaw, isLoading: l4 } = useQuery({ ...opts('td-contracts'), queryFn: () => contractApi.getAll({ tenantId }).then(r => r.data), enabled: authReady && !!tenantId && isAdmin });
  const { data: invoicesRaw,  isLoading: l5 } = useQuery({ ...opts('td-invoices'),  queryFn: () => billingApi.getInvoices({ tenantId }).then(r => r.data), enabled: authReady && !!tenantId && isAdmin });
  const { data: notifsRaw,    isLoading: l6 } = useQuery({ ...opts('td-notifs'),    queryFn: () => notificationApi.getAll({ userId: user?.id }).then(r => r.data), enabled: authReady && !!user?.id });

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6;

  const bookings  = toArray<any>(bookingsRaw);
  const tickets   = toArray<any>(ticketsRaw);
  const members   = toArray<any>(usersRaw);
  const contracts = toArray<any>(contractsRaw);
  const invoices  = toArray<any>(invoicesRaw);
  const notifs    = toArray<any>(notifsRaw);

  // Derived
  const myBookings       = user?.role === 'TENANT_EMPLOYEE' ? bookings.filter((b: any) => b.created_by_user_id === user?.id) : bookings;
  const myTickets        = user?.role === 'TENANT_EMPLOYEE' ? tickets.filter((t: any) => t.created_by_user_id === user?.id) : tickets;
  const confirmedBooks   = myBookings.filter((b: any) => b.status === 'CONFIRMED').length;
  const pendingBooks     = myBookings.filter((b: any) => b.status === 'PENDING_APPROVAL').length;
  const openTickets      = myTickets.filter((t: any) => !['CLOSED','CANCELLED'].includes(t.status)).length;
  const urgentTickets    = myTickets.filter((t: any) => ['URGENT','EMERGENCY'].includes(t.priority) && !['CLOSED','CANCELLED','RESOLVED'].includes(t.status));
  const activeContracts  = contracts.filter((c: any) => c.status === 'ACTIVE');
  const overdueInvoices  = invoices.filter((i: any) => i.status === 'OVERDUE');
  const unreadNotifs     = notifs.filter((n: any) => !n.is_read).length;
  const onboardingDone   = localStorage.getItem('onboarding_done') === 'true';

  const expiringContracts = activeContracts
    .map((c: any) => ({ ...c, days: daysUntil(c.end_date) }))
    .filter((c: any) => c.days <= 90 && c.days >= 0)
    .sort((a: any, b: any) => a.days - b.days);

  const recentBookings = [...myBookings]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  const recentTickets = [...myTickets]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const recentNotifs = [...notifs]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  const NOTIF_TYPE_ICON: Record<string, { icon: string; color: string; bg: string }> = {
    BOOKING:      { icon: '📅', color: '#2563eb', bg: '#eff6ff' },
    INVOICE:      { icon: '🧾', color: '#d97706', bg: '#fffbeb' },
    MAINTENANCE:  { icon: '🔧', color: '#7c3aed', bg: '#f5f3ff' },
    CONTRACT:     { icon: '📋', color: '#059669', bg: '#f0fdf4' },
    PAYMENT:      { icon: '💳', color: '#0891b2', bg: '#f0f9ff' },
    ANNOUNCEMENT: { icon: '📢', color: '#dc2626', bg: '#fef2f2' },
    SYSTEM:       { icon: '⚙️',  color: '#475569', bg: t.tableHead },
  };

  return (
    <PageShell>
      <div style={{ display: 'flex', minHeight: '100%' }}>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        <PageHeader
          title={isAdmin ? `Welcome back, ${user?.first_name ?? 'there'}!` : `Hi, ${user?.first_name ?? 'there'}!`}
          subtitle={
            isAdmin
              ? `Tenant Admin Portal${user?.tenant?.name ? ` · ${user.tenant.name}` : ''}`
              : `Your bookings & requests${user?.tenant?.name ? ` · ${user.tenant.name}` : ''}`
          }
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => navigate('/portal/bookings/calendar')}
                style={{ padding: '9px 16px', borderRadius: 9, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <PlusOutlined /> New Booking
              </button>
              <button onClick={() => setRefreshKey(k => k + 1)}
                style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${t.cardBorder}`, background: t.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ReloadOutlined spin={isLoading} /> Refresh
              </button>
            </div>
          }
        />

        <RoleDashboardHero role={user?.role} userName={user?.first_name} />

        {isAdmin && contracts.length === 0 && !onboardingDone && (
          <div style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', borderRadius: 14, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 4 }}>🚀 Complete your setup!</div>
              <div style={{ fontSize: 13, color: '#bfdbfe' }}>Set up your workspace, add spaces and invite your team to get started.</div>
            </div>
            <button
              onClick={() => navigate(PORTAL_MAP_PATH)}
              style={{ padding: '10px 20px', borderRadius: 10, background: '#fff', border: 'none', color: '#1d4ed8', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Start Setup →
            </button>
          </div>
        )}

        {/* Alert banners */}
        {overdueInvoices.length > 0 && isAdmin && (
          <div onClick={() => navigate('/portal/billing')} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <WarningOutlined style={{ color: '#dc2626', fontSize: 18 }} />
            <span style={{ fontWeight: 600, color: '#b91c1c', fontSize: 14 }}>
              {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''} — action required
            </span>
            <ArrowRightOutlined style={{ color: '#dc2626', marginLeft: 'auto' }} />
          </div>
        )}
        {urgentTickets.length > 0 && (
          <div onClick={() => navigate('/portal/maintenance')} style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, padding: '12px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <WarningOutlined style={{ color: '#ea580c', fontSize: 18 }} />
            <span style={{ fontWeight: 600, color: '#c2410c', fontSize: 14 }}>
              {urgentTickets.length} urgent maintenance ticket{urgentTickets.length > 1 ? 's' : ''} pending
            </span>
            <ArrowRightOutlined style={{ color: '#ea580c', marginLeft: 'auto' }} />
          </div>
        )}
        {expiringContracts.length > 0 && isAdmin && (
          <div onClick={() => navigate('/portal/contracts')} style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 10, padding: '12px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <FileTextOutlined style={{ color: '#ca8a04', fontSize: 18 }} />
            <span style={{ fontWeight: 600, color: '#854d0e', fontSize: 14 }}>
              {expiringContracts[0].days === 0
                ? 'A contract expires today!'
                : `${expiringContracts.length} contract${expiringContracts.length > 1 ? 's' : ''} expiring within ${expiringContracts[0].days} days`}
            </span>
            <ArrowRightOutlined style={{ color: '#ca8a04', marginLeft: 'auto' }} />
          </div>
        )}

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
          {isAdmin && (
            <KpiCard t={t} label="Team Members"   value={members.length}       sub={`${members.filter((m: any) => m.status === 'ACTIVE').length} active`} color="#2563eb" bg="#eff6ff" icon={<TeamOutlined />}       path="/portal/users"       loading={isLoading} />
          )}
          {isAdmin && (
            <KpiCard t={t} label="Active Leases"  value={activeContracts.length} sub={`${contracts.length} total`}                                         color="#059669" bg="#f0fdf4" icon={<FileTextOutlined />}  path="/portal/contracts"   loading={isLoading} />
          )}
          <KpiCard t={t} label="My Bookings"      value={myBookings.length}    sub={`${confirmedBooks} confirmed · ${pendingBooks} pending`}                color="#7c3aed" bg="#f5f3ff" icon={<CalendarOutlined />}  path="/portal/bookings"    loading={isLoading} />
          <KpiCard t={t} label="Open Tickets"     value={openTickets}          sub={`${urgentTickets.length} urgent`}                                       color={urgentTickets.length > 0 ? '#dc2626' : '#059669'} bg={urgentTickets.length > 0 ? '#fef2f2' : '#f0fdf4'} icon={<ToolOutlined />} path="/portal/maintenance" loading={isLoading} />
          {isAdmin && (
            <KpiCard t={t} label="Pending Invoices" value={overdueInvoices.length + invoices.filter((i: any) => i.status === 'ISSUED' || i.status === 'SENT').length} sub={`${overdueInvoices.length} overdue`} color={overdueInvoices.length > 0 ? '#dc2626' : '#d97706'} bg={overdueInvoices.length > 0 ? '#fef2f2' : '#fffbeb'} icon={<CreditCardOutlined />} path="/portal/billing" loading={isLoading} />
          )}
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Recent Bookings */}
          <div style={CARD}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>📅 My Bookings</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => navigate('/portal/bookings/calendar')}
                  style={{ padding: '5px 10px', borderRadius: 7, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  Calendar
                </button>
                <button onClick={() => navigate('/portal/bookings')}
                  style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  View all →
                </button>
              </div>
            </div>
            {isLoading
              ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
              : recentBookings.length === 0
                ? (
                  <div style={{ padding: '32px', textAlign: 'center' }}>
                    <CalendarOutlined style={{ fontSize: 32, color: t.textMuted, display: 'block', margin: '0 auto 10px' }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>No bookings yet</div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, marginBottom: 16 }}>Browse available spaces to get started</div>
                    <button onClick={() => navigate(PORTAL_MAP_PATH)}
                      style={{ padding: '8px 18px', borderRadius: 9, background: '#2563eb', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Browse on map →
                    </button>
                  </div>
                )
                : recentBookings.map((b: any, i: number) => {
                  const bs = BOOKING_STATUS[b.status] ?? { bg: '#f1f5f9', color: '#475569', label: b.status };
                  return (
                    <div key={b.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < recentBookings.length - 1 ? `1px solid ${t.divider}` : 'none', transition: 'background 0.1s', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: bs.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CalendarOutlined style={{ color: bs.color, fontSize: 14 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.space?.name ?? 'Space'}
                        </div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>
                          {formatDateTime(b.start_datetime)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ background: bs.bg, color: bs.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-block', marginBottom: 3 }}>
                          {bs.label}
                        </span>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.text }}>
                          ${parseFloat(b.total_price || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })
            }
          </div>

          {/* Maintenance Tickets */}
          <div style={CARD}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>🔧 Maintenance</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigate('/portal/maintenance')}
                  style={{ padding: '5px 10px', borderRadius: 7, background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#7c3aed', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  + New Ticket
                </button>
                <button onClick={() => navigate('/portal/maintenance')}
                  style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  View all →
                </button>
              </div>
            </div>
            {isLoading
              ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
              : recentTickets.length === 0
                ? (
                  <div style={{ padding: '32px', textAlign: 'center' }}>
                    <CheckCircleOutlined style={{ fontSize: 32, color: '#22c55e', display: 'block', margin: '0 auto 10px' }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>All clear!</div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>No open maintenance tickets</div>
                  </div>
                )
                : recentTickets.map((tk: any, i: number) => {
                  const ts = TICKET_STATUS[tk.status]     ?? { bg: '#f1f5f9', color: '#475569' };
                  const tp = TICKET_PRIORITY[tk.priority] ?? { bg: '#f1f5f9', color: '#475569' };
                  return (
                    <div key={tk.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < recentTickets.length - 1 ? `1px solid ${t.divider}` : 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: tp.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ToolOutlined style={{ color: tp.color, fontSize: 14 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tk.title}
                        </div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>
                          {tk.ticket_number} · {tk.category?.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <span style={{ background: tp.bg, color: tp.color, fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 20 }}>
                          {tk.priority}
                        </span>
                        <span style={{ background: ts.bg, color: ts.color, fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 20 }}>
                          {tk.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: 16 }}>

          {/* Notifications */}
          <div style={CARD}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>🔔 Notifications</div>
                {unreadNotifs > 0 && (
                  <span style={{ background: '#2563eb', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
                    {unreadNotifs} new
                  </span>
                )}
              </div>
              <button onClick={() => navigate('/portal/notifications')}
                style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                View all →
              </button>
            </div>
            {isLoading
              ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
              : recentNotifs.length === 0
                ? (
                  <div style={{ padding: '28px', textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
                    <BellOutlined style={{ fontSize: 28, display: 'block', margin: '0 auto 8px', color: t.textMuted }} />
                    No notifications
                  </div>
                )
                : recentNotifs.map((n: any, i: number) => {
                  const nm = NOTIF_TYPE_ICON[n.type] ?? { icon: '📣', color: '#475569', bg: t.tableHead };
                  return (
                    <div key={n.id}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 20px', borderBottom: i < recentNotifs.length - 1 ? `1px solid ${t.divider}` : 'none', background: n.is_read ? '' : (t.cardBg === '#fff' ? '#fafbff' : '#1a2744'), transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                      onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? '' : (t.cardBg === '#fff' ? '#fafbff' : '#1a2744'))}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: nm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                        {nm.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize: 12, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 11, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.message}
                        </div>
                      </div>
                      {!n.is_read && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563eb', flexShrink: 0, marginTop: 4 }} />
                      )}
                    </div>
                  );
                })
            }
          </div>

          {/* Team Members (admin only) */}
          {isAdmin && (
            <div style={CARD}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>👥 Team Members</div>
                <button onClick={() => navigate('/portal/users')}
                  style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  Manage →
                </button>
              </div>
              {isLoading
                ? <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
                : members.length === 0
                  ? (
                    <div style={{ padding: '28px', textAlign: 'center' }}>
                      <TeamOutlined style={{ fontSize: 32, color: t.textMuted, display: 'block', margin: '0 auto 10px' }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>No team members yet</div>
                      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Invite your team to collaborate</div>
                    </div>
                  )
                  : members.slice(0, 6).map((m: any, i: number) => {
                    const ROLE_META: Record<string, { bg: string; color: string }> = {
                      TENANT_ADMIN: { bg: '#ede9fe', color: '#6d28d9' },
                      EMPLOYEE:     { bg: '#f1f5f9', color: '#475569' },
                    };
                    const rm = ROLE_META[m.role] ?? { bg: '#f1f5f9', color: '#475569' };
                    const initials = `${m.first_name?.[0] ?? ''}${m.last_name?.[0] ?? ''}`;
                    const colors   = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444'];
                    const color    = colors[i % colors.length];
                    return (
                      <div key={m.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < Math.min(members.length, 6) - 1 ? `1px solid ${t.divider}` : 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.first_name} {m.last_name}
                          </div>
                          <div style={{ fontSize: 11, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.email}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ background: rm.bg, color: rm.color, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
                            {m.role === 'TENANT_ADMIN' ? 'Admin' : 'TENANT_EMPLOYEE'}
                          </span>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: m.status === 'ACTIVE' ? '#22c55e' : '#94a3b8' }} title={m.status} />
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          )}
        </div>
      </div>

      {/* ── Secondary Sidebar ── */}
      <aside style={{ width: 220, flexShrink: 0, borderLeft: `1px solid ${t.cardBorder}`, background: t.cardBg, display: 'flex', flexDirection: 'column', padding: '20px 0' }}>

        {/* Quick Actions */}
        <div style={{ padding: '0 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { icon: <CalendarOutlined />, label: 'Book a Space',      path: '/portal/bookings/calendar', color: '#2563eb', bg: '#eff6ff' },
              { icon: <ToolOutlined />,     label: 'Report Issue',       path: '/portal/maintenance',       color: '#7c3aed', bg: '#f5f3ff' },
              { icon: <BellOutlined />,     label: 'Notifications',      path: '/portal/notifications',     color: '#0891b2', bg: '#f0f9ff', badge: unreadNotifs },
              ...(isAdmin ? [
                { icon: <FileTextOutlined />, label: 'My Contracts', path: '/portal/contracts', color: '#059669', bg: '#f0fdf4' },
                { icon: <CreditCardOutlined />, label: 'Billing',    path: '/portal/billing',   color: '#d97706', bg: '#fffbeb' },
                { icon: <TeamOutlined />,       label: 'My Team',    path: '/portal/users',     color: '#dc2626', bg: '#fef2f2' },
              ] : []),
            ].map(action => (
              <button key={action.label} onClick={() => navigate(action.path)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9, border: `1px solid ${t.cardBorder}`, background: t.cardBg, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: t.textSub, transition: 'all 0.15s', textAlign: 'left' }}
                onMouseEnter={e => { e.currentTarget.style.background = (action as any).bg; e.currentTarget.style.color = (action as any).color; e.currentTarget.style.borderColor = (action as any).color + '40'; }}
                onMouseLeave={e => { e.currentTarget.style.background = t.cardBg; e.currentTarget.style.color = t.textSub; e.currentTarget.style.borderColor = t.cardBorder; }}>
                <span style={{ fontSize: 14, color: (action as any).color }}>{action.icon}</span>
                <span style={{ flex: 1 }}>{action.label}</span>
                {(action as any).badge > 0 && (
                  <span style={{ background: '#2563eb', color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 10 }}>{(action as any).badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: t.divider, margin: '0 16px 20px' }} />

        {/* Contract Status (admin) */}
        {isAdmin && (
          <div style={{ padding: '0 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Contracts</div>
            {isLoading
              ? <Skeleton active paragraph={{ rows: 2 }} />
              : contracts.length === 0
                ? <div style={{ fontSize: 12, color: t.textMuted, textAlign: 'center', padding: '12px 0' }}>No contracts</div>
                : contracts.slice(0, 3).map((c: any) => {
                  const days = daysUntil(c.end_date);
                  const color = c.status !== 'ACTIVE' ? '#94a3b8' : days <= 30 ? '#dc2626' : days <= 90 ? '#d97706' : '#059669';
                  return (
                    <div key={c.id} style={{ background: t.tableHead, borderRadius: 9, padding: '10px 12px', marginBottom: 8, border: `1px solid ${t.cardBorder}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                        {c.contract_number}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: t.textMuted }}>Ends {formatDate(c.end_date)}</span>
                        <span style={{ fontSize: 10, fontWeight: 800, color, background: color + '15', padding: '1px 6px', borderRadius: 8 }}>
                          {c.status !== 'ACTIVE' ? c.status : days <= 0 ? 'Expired' : `${days}d`}
                        </span>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        )}

        {/* Browse Spaces CTA */}
        <div style={{ padding: '0 16px', marginTop: 'auto' }}>
          <div style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
            <AppstoreOutlined style={{ fontSize: 26, color: '#60a5fa', display: 'block', marginBottom: 8 }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>Find a space</div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 12 }}>Find and book the perfect workspace</div>
            <button onClick={() => navigate(PORTAL_MAP_PATH)}
              style={{ width: '100%', padding: '8px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Explore →
            </button>
          </div>
        </div>
      </aside>
    </div>
    </PageShell>
  );
}