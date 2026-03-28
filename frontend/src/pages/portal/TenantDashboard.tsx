import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Skeleton, Empty } from 'antd';
import {
  AppstoreOutlined, FileTextOutlined, CreditCardOutlined,
  ToolOutlined, CalendarOutlined, UserOutlined,
  BarChartOutlined, BellOutlined, PlusOutlined,
  EyeOutlined, EditOutlined, CheckCircleOutlined,
  WarningOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { userApi, bookingApi, maintenanceApi, notificationApi, contractApi } from '../../api/services';
import type { User, Booking, MaintenanceTicket, Notification, LeaseContract } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE:   { bg: '#dcfce7', color: '#15803d' },
  PENDING:  { bg: '#fef3c7', color: '#92400e' },
  INACTIVE: { bg: '#f1f5f9', color: '#475569' },
  SUSPENDED:{ bg: '#fee2e2', color: '#b91c1c' },
  CONFIRMED:{ bg: '#dcfce7', color: '#15803d' },
  DRAFT:    { bg: '#f1f5f9', color: '#475569' },
  CANCELLED:{ bg: '#fee2e2', color: '#b91c1c' },
  OPEN:     { bg: '#fef3c7', color: '#92400e' },
  IN_PROGRESS: { bg: '#dbeafe', color: '#1d4ed8' },
  RESOLVED: { bg: '#dcfce7', color: '#15803d' },
};

const TICKET_PRIO_STYLE: Record<string, { bg: string; color: string }> = {
  EMERGENCY: { bg: '#fee2e2', color: '#b91c1c' },
  URGENT:    { bg: '#fee2e2', color: '#dc2626' },
  HIGH:      { bg: '#fef3c7', color: '#d97706' },
  NORMAL:    { bg: '#dbeafe', color: '#2563eb' },
  LOW:       { bg: '#f1f5f9', color: '#475569' },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const NAV_LINKS = [
  { icon: <AppstoreOutlined />, label: 'Dashboard',   path: '/portal/dashboard'    },
  { icon: <UserOutlined />,     label: 'My Team',      path: '/portal/users'        },
  { icon: <FileTextOutlined />, label: 'Contracts',    path: '/portal/contracts'    },
  { icon: <CreditCardOutlined />,label:'Billing',      path: '/portal/billing'      },
  { icon: <ToolOutlined />,     label: 'Maintenance',  path: '/portal/maintenance'  },
  { icon: <CalendarOutlined />, label: 'Bookings',     path: '/portal/bookings'     },
  { icon: <BellOutlined />,     label: 'Notifications',path: '/portal/notifications'},
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TenantDashboard() {
  const navigate         = useNavigate();
  const { user }         = useAuthStore();
  const tenantId         = user?.tenant_id ?? '';
  const userId           = user?.id ?? '';

  // ── Real API queries ──
  const { data: teamMembers = [], isLoading: loadingTeam } = useQuery({
    queryKey: ['users', tenantId],
    queryFn:  () => userApi.getAll(tenantId).then(r => r.data),
    enabled:  !!tenantId,
  });

  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['bookings', tenantId],
    queryFn:  () => bookingApi.getAll({ tenantId }).then(r => r.data),
    enabled:  !!tenantId,
  });

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['maintenance', tenantId],
    queryFn: () => maintenanceApi.getAll({}).then(r => r.data),
    enabled:  !!userId,
  });

  const { data: notifications = [], isLoading: loadingNotifs } = useQuery({
    queryKey: ['notifications', userId],
    queryFn:  () => notificationApi.getAll().then(r => r.data),
    enabled:  !!userId,
  });

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts', tenantId],
    queryFn:  () => contractApi.getAll({ tenantId }).then(r => r.data),
    enabled:  !!tenantId,
  });

  // Computed stats from real data
  const activeLeases    = contracts.filter((c: LeaseContract) => c.status === 'ACTIVE').length;
  const pendingBookings = bookings.filter((b: Booking) => b.status === 'PENDING_APPROVAL').length;
  const openTickets     = tickets.filter((t: MaintenanceTicket) => ['OPEN','ASSIGNED','IN_PROGRESS'].includes(t.status)).length;
  const unreadNotifs    = notifications.filter((n: Notification) => !n.is_read).length;

  const recentBookings  = [...bookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  const recentTickets   = [...tickets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 4);
  const unreadNotifList = notifications.filter((n: Notification) => !n.is_read).slice(0, 4);

  const isLoading = loadingTeam || loadingBookings || loadingTickets;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

      {/* ── Secondary Sidebar ── */}
      <aside style={{ width: 232, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
        {/* User card */}
        <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff', flexShrink: 0 }}>
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.first_name} {user?.last_name}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Tenant Admin</div>
            </div>
          </div>
          {unreadNotifs > 0 && (
            <div style={{ marginTop: 8, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 7, padding: '5px 10px', fontSize: 11, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <BellOutlined /> {unreadNotifs} unread notification{unreadNotifs > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {NAV_LINKS.map(link => {
            const active = window.location.pathname === link.path;
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 2, textAlign: 'left', fontSize: 13, fontWeight: 500, background: active ? '#eff6ff' : 'transparent', color: active ? '#2563eb' : '#374151', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 15, color: active ? '#2563eb' : '#64748b' }}>{link.icon}</span>
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Browse Spaces CTA */}
        <div style={{ margin: '0 8px 12px', background: 'linear-gradient(135deg,#1e293b,#2563eb)', borderRadius: 10, padding: '14px' }}>
          <div style={{ fontSize: 12, color: '#93c5fd', marginBottom: 6 }}>Ready to expand?</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 10 }}>Browse available spaces</div>
          <button onClick={() => navigate('/portal/spaces')} style={{ width: '100%', padding: '7px', borderRadius: 7, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            Browse Spaces →
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc' }}>

        {/* Page header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 2px', fontSize: 19, fontWeight: 700, color: '#0f172a' }}>Dashboard</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Welcome back, <strong>{user?.first_name}</strong> — here's what's happening today
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/portal/bookings')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
              <CalendarOutlined /> Book a Space
            </button>
            <button onClick={() => navigate('/portal/maintenance')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#2563eb', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>
              <PlusOutlined /> Submit Ticket
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>

          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Team Members',    value: teamMembers.length,  sub: `${teamMembers.filter((u: User) => u.status === 'ACTIVE').length} active`,    color: '#2563eb', bg: '#eff6ff', icon: <UserOutlined />,      loading: loadingTeam     },
              { label: 'Active Leases',   value: activeLeases,         sub: `${contracts.length} total contracts`,                                         color: '#059669', bg: '#f0fdf4', icon: <FileTextOutlined />,  loading: loadingContracts},
              { label: 'Bookings',        value: bookings.length,      sub: `${pendingBookings} pending approval`,                                          color: '#d97706', bg: '#fffbeb', icon: <CalendarOutlined />, loading: loadingBookings },
              { label: 'Open Tickets',    value: openTickets,          sub: `${tickets.length} total submitted`,                                            color: '#dc2626', bg: '#fef2f2', icon: <ToolOutlined />,      loading: loadingTickets  },
            ].map(k => (
              <div key={k.label} style={{ ...CARD, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: k.color }}>
                    {k.icon}
                  </div>
                  {k.loading ? <Skeleton.Button active size="small" /> : (
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{k.sub}</span>
                  )}
                </div>
                {k.loading ? (
                  <Skeleton active paragraph={{ rows: 1 }} />
                ) : (
                  <>
                    <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', lineHeight: 1, marginBottom: 3 }}>{k.value}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{k.label}</div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* ── Main grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18 }}>

            {/* ── Left: Recent Bookings ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div style={CARD}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarOutlined style={{ color: '#2563eb' }} /> Recent Bookings
                  </div>
                  <button onClick={() => navigate('/portal/bookings')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
                </div>

                {loadingBookings ? (
                  <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 4 }} /></div>
                ) : recentBookings.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center' }}>
                    <Empty description="No bookings yet" />
                    <button onClick={() => navigate('/portal/bookings')} style={{ marginTop: 12, padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                      Make a Booking
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Header row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 0.8fr 0.6fr', padding: '8px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <span>Booking #</span><span>Space</span><span>Date</span><span>Status</span><span></span>
                    </div>
                    {recentBookings.map((b: Booking, i: number) => {
                      const ss = STATUS_STYLE[b.status] ?? { bg: '#f1f5f9', color: '#475569' };
                      return (
                        <div
                          key={b.id}
                          style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 0.8fr 0.6fr', padding: '12px 20px', borderBottom: i < recentBookings.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#2563eb', fontWeight: 600 }}>{b.booking_number}</span>
                          <span style={{ fontSize: 12, color: '#374151' }}>{b.space?.name ?? b.space_id.substring(0, 8)}</span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{formatDate(b.start_datetime)}</span>
                          <span style={{ background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-block' }}>{b.status.replace('_', ' ')}</span>
                          <button style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <EyeOutlined style={{ fontSize: 11, color: '#64748b' }} />
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Recent Maintenance Tickets */}
              <div style={CARD}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ToolOutlined style={{ color: '#d97706' }} /> Maintenance Tickets
                  </div>
                  <button onClick={() => navigate('/portal/maintenance')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
                </div>

                {loadingTickets ? (
                  <div style={{ padding: '16px 20px' }}><Skeleton active paragraph={{ rows: 3 }} /></div>
                ) : recentTickets.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center' }}>
                    <Empty description="No maintenance tickets" />
                  </div>
                ) : (
                  <div style={{ padding: '10px 20px' }}>
                    {recentTickets.map((t: MaintenanceTicket, i: number) => {
                      const ps  = TICKET_PRIO_STYLE[t.priority] ?? TICKET_PRIO_STYLE.NORMAL;
                      const ts  = STATUS_STYLE[t.status]  ?? { bg: '#f1f5f9', color: '#475569' };
                      return (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: i < recentTickets.length - 1 ? 10 : 0, borderBottom: i < recentTickets.length - 1 ? '1px solid #f8fafc' : 'none', marginBottom: i < recentTickets.length - 1 ? 10 : 0 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: ps.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <ToolOutlined style={{ color: ps.color, fontSize: 14 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{t.ticket_number} · {t.category.replace('_', ' ')}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                            <span style={{ background: ps.bg, color: ps.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>{t.priority}</span>
                            <span style={{ background: ts.bg, color: ts.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>{t.status.replace('_', ' ')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right sidebar ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Notifications */}
              <div style={CARD}>
                <div style={{ padding: '13px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BellOutlined style={{ color: unreadNotifs > 0 ? '#d97706' : '#64748b' }} />
                    Notifications
                    {unreadNotifs > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>{unreadNotifs}</span>}
                  </div>
                  <button onClick={() => navigate('/portal/notifications')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all</button>
                </div>
                <div style={{ padding: '10px 16px' }}>
                  {loadingNotifs ? (
                    <Skeleton active paragraph={{ rows: 3 }} />
                  ) : unreadNotifList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>
                      <CheckCircleOutlined style={{ fontSize: 24, display: 'block', margin: '0 auto 8px', color: '#22c55e' }} />
                      All caught up!
                    </div>
                  ) : (
                    unreadNotifList.map((n: Notification, i: number) => (
                      <div key={n.id} style={{ display: 'flex', gap: 10, paddingBottom: i < unreadNotifList.length - 1 ? 10 : 0, borderBottom: i < unreadNotifList.length - 1 ? '1px solid #f8fafc' : 'none', marginBottom: i < unreadNotifList.length - 1 ? 10 : 0 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: n.priority === 'HIGH' || n.priority === 'URGENT' ? '#fee2e2' : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>
                          {n.priority === 'HIGH' || n.priority === 'URGENT' ? '⚠️' : '📬'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>{n.title}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Team Members */}
              <div style={CARD}>
                <div style={{ padding: '13px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Team Members</div>
                  <button onClick={() => navigate('/portal/users')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Manage →</button>
                </div>
                <div style={{ padding: '10px 16px' }}>
                  {loadingTeam ? (
                    <Skeleton active paragraph={{ rows: 3 }} />
                  ) : teamMembers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: 13 }}>
                      No team members yet
                      <br />
                      <button onClick={() => navigate('/portal/users')} style={{ marginTop: 8, padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        Invite Members
                      </button>
                    </div>
                  ) : (
                    <>
                      {teamMembers.slice(0, 5).map((member: User) => {
                        const ss = STATUS_STYLE[member.status] ?? { bg: '#f1f5f9', color: '#475569' };
                        return (
                          <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid #f8fafc', marginBottom: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                              {member.first_name[0]}{member.last_name[0]}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.first_name} {member.last_name}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{member.role.replace('_', ' ').toLowerCase()}</div>
                            </div>
                            <span style={{ background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>{member.status}</span>
                          </div>
                        );
                      })}
                      {teamMembers.length > 5 && (
                        <button onClick={() => navigate('/portal/users')} style={{ width: '100%', padding: '7px', border: '1px dashed #e5e7eb', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#64748b' }}>
                          +{teamMembers.length - 5} more members
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div style={CARD}>
                <div style={{ padding: '13px 18px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Quick Actions</div>
                </div>
                <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Browse Spaces',  icon: <AppstoreOutlined />,  path: '/portal/spaces',      bg: '#eff6ff', color: '#1d4ed8' },
                    { label: 'Book a Space',   icon: <CalendarOutlined />,  path: '/portal/bookings',    bg: '#f0fdf4', color: '#15803d' },
                    { label: 'My Contracts',   icon: <FileTextOutlined />,  path: '/portal/contracts',   bg: '#fefce8', color: '#92400e' },
                    { label: 'Billing',        icon: <CreditCardOutlined />,path: '/portal/billing',     bg: '#f5f3ff', color: '#6d28d9' },
                    { label: 'Submit Ticket',  icon: <ToolOutlined />,      path: '/portal/maintenance', bg: '#fef2f2', color: '#b91c1c' },
                    { label: 'Invite Member',  icon: <UserOutlined />,      path: '/portal/users',       bg: '#f0fdf4', color: '#15803d' },
                  ].map(a => (
                    <button
                      key={a.label}
                      onClick={() => navigate(a.path)}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 10px', background: a.bg, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: a.color, transition: 'opacity 0.15s', textAlign: 'left' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      <span style={{ fontSize: 14 }}>{a.icon}</span> {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
