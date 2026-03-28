import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import {
  ReloadOutlined, AppstoreOutlined, ToolOutlined,
  CalendarOutlined, ArrowRightOutlined, EnvironmentOutlined,
} from '@ant-design/icons';
import { siteApi, spaceApi, maintenanceApi, bookingApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

export default function SiteManagerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: sites    = [], isLoading: l1, refetch } = useQuery({ queryKey: ['sm-sites'],    queryFn: () => siteApi.getAll().then(r => r.data)            });
  const { data: spaces   = [], isLoading: l2 }          = useQuery({ queryKey: ['sm-spaces'],   queryFn: () => spaceApi.getAll().then(r => r.data)           });
  const { data: tickets  = [], isLoading: l3 }          = useQuery({ queryKey: ['sm-tickets'],  queryFn: () => maintenanceApi.getAll({}).then(r => r.data)   });
  const { data: mxStats }                               = useQuery({ queryKey: ['sm-mx-stats'], queryFn: () => maintenanceApi.getStats().then(r => r.data)   });
  const { data: bookings = [], isLoading: l4 }          = useQuery({ queryKey: ['sm-bookings'], queryFn: () => bookingApi.getAll().then(r => r.data)         });

  const isLoading = l1 || l2 || l3 || l4;

  const allSpaces   = spaces   as any[];
  const allTickets  = tickets  as any[];
  const allBookings = bookings as any[];
  const allSites    = sites    as any[];

  const available   = allSpaces.filter(s => s.status === 'AVAILABLE').length;
  const occupied    = allSpaces.filter(s => s.status === 'OCCUPIED').length;
  const maintenance = allSpaces.filter(s => s.status === 'MAINTENANCE').length;
  const occRate     = allSpaces.length > 0 ? Math.round((occupied / allSpaces.length) * 100) : 0;

  const urgentTickets  = allTickets.filter(t => t.priority === 'URGENT' || t.priority === 'EMERGENCY');
  const openTickets    = allTickets.filter(t => t.status === 'OPEN' || t.status === 'ASSIGNED');
  const todayBookings  = allBookings.filter(b => new Date(b.start_datetime).toDateString() === new Date().toDateString());

  const TICKET_PRIO: Record<string, { bg: string; color: string }> = {
    EMERGENCY: { bg: '#fee2e2', color: '#991b1b' },
    URGENT:    { bg: '#fee2e2', color: '#dc2626' },
    HIGH:      { bg: '#fef3c7', color: '#d97706' },
    NORMAL:    { bg: '#dbeafe', color: '#2563eb' },
    LOW:       { bg: '#f1f5f9', color: '#475569' },
  };

  const TICKET_STATUS: Record<string, { bg: string; color: string }> = {
    OPEN:        { bg: '#fef3c7', color: '#92400e' },
    ASSIGNED:    { bg: '#dbeafe', color: '#1d4ed8' },
    IN_PROGRESS: { bg: '#ede9fe', color: '#6d28d9' },
    RESOLVED:    { bg: '#dcfce7', color: '#15803d' },
    CLOSED:      { bg: '#f1f5f9', color: '#475569' },
  };

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Site Manager Dashboard</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
            Welcome back, <strong>{user?.first_name}</strong> · Manage your sites and spaces
          </p>
        </div>
        <button onClick={() => refetch()} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ReloadOutlined /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Sites',    value: allSites.length,   sub: `${allSites.filter((s:any) => s.status==='ACTIVE').length} active`, color: '#2563eb', bg: '#eff6ff', icon: '🏢', path: '/admin/sites'       },
          { label: 'Total Spaces',   value: allSpaces.length,  sub: `${occRate}% occupancy rate`,                                        color: '#059669', bg: '#f0fdf4', icon: '🪑', path: '/admin/spaces'      },
          { label: 'Open Tickets',   value: openTickets.length,sub: `${urgentTickets.length} urgent`,                                    color: '#dc2626', bg: '#fef2f2', icon: '🔧', path: '/admin/maintenance' },
          { label: "Today's Bookings",value: todayBookings.length, sub: `${allBookings.length} total`,                                   color: '#d97706', bg: '#fffbeb', icon: '📅', path: '/admin/maintenance' },
        ].map(k => (
          <div key={k.label} style={{ ...CARD, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s' }}
            onClick={() => navigate(k.path)}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{k.icon}</div>
              <ArrowRightOutlined style={{ color: '#94a3b8', fontSize: 13 }} />
            </div>
            {isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
              <>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{k.label}</div>
                <div style={{ fontSize: 11, color: k.color, fontWeight: 500 }}>{k.sub}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Space status bar */}
      <div style={{ ...CARD, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Space Availability Overview</div>
          <button onClick={() => navigate('/admin/spaces')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Manage spaces →</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'Available',   value: available,   color: '#22c55e', bg: '#f0fdf4', pct: allSpaces.length > 0 ? Math.round((available / allSpaces.length) * 100) : 0 },
            { label: 'Occupied',    value: occupied,    color: '#3b82f6', bg: '#eff6ff', pct: allSpaces.length > 0 ? Math.round((occupied  / allSpaces.length) * 100) : 0 },
            { label: 'Reserved',    value: allSpaces.filter(s => s.status === 'RESERVED').length, color: '#f59e0b', bg: '#fffbeb', pct: allSpaces.length > 0 ? Math.round((allSpaces.filter(s=>s.status==='RESERVED').length / allSpaces.length)*100):0 },
            { label: 'Maintenance', value: maintenance, color: '#ef4444', bg: '#fef2f2', pct: allSpaces.length > 0 ? Math.round((maintenance / allSpaces.length) * 100) : 0 },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 11, color: s.color, marginTop: 4, fontWeight: 600 }}>{s.pct}%</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Sites list */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>My Sites</div>
            <button onClick={() => navigate('/admin/sites')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          {isLoading ? <div style={{ padding: 20 }}><Skeleton active paragraph={{ rows: 3 }} /></div>
          : allSites.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No sites yet</div>
          : allSites.map((site: any, i: number) => (
            <div key={site.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < allSites.length-1 ? '1px solid #f8fafc':'none', cursor: 'pointer' }}
              onClick={() => navigate(`/admin/sites/${site.id}`)}
              onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <div style={{ width: 36, height: 36, borderRadius: 9, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: '#fff', flexShrink: 0 }}>
                {site.code}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{site.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <EnvironmentOutlined style={{ fontSize: 10 }} /> {site.city}, {site.country}
                </div>
              </div>
              <span style={{ background: site.status==='ACTIVE'?'#dcfce7':'#fee2e2', color: site.status==='ACTIVE'?'#15803d':'#b91c1c', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
                {site.status}
              </span>
            </div>
          ))}
        </div>

        {/* Urgent tickets */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
              Maintenance Tickets
              {urgentTickets.length > 0 && <span style={{ marginLeft: 8, background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>{urgentTickets.length} urgent</span>}
            </div>
            <button onClick={() => navigate('/admin/maintenance')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          {isLoading ? <div style={{ padding: 20 }}><Skeleton active paragraph={{ rows: 4 }} /></div>
          : allTickets.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No tickets</div>
          : allTickets.slice(0, 6).map((t: any, i: number) => {
            const ps = TICKET_PRIO[t.priority]   ?? TICKET_PRIO.NORMAL;
            const ts = TICKET_STATUS[t.status]   ?? TICKET_STATUS.OPEN;
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < Math.min(allTickets.length,6)-1 ? '1px solid #f8fafc':'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: ps.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>🔧</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.ticket_number} · {t.space?.name ?? 'Unknown space'}</div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <span style={{ background: ps.bg, color: ps.color, fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 20 }}>{t.priority}</span>
                  <span style={{ background: ts.bg, color: ts.color, fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 20 }}>{t.status.replace('_',' ')}</span>
                </div>
              </div>
            );
          })}
          <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Total: <strong>{mxStats?.total ?? 0}</strong> · Open: <strong style={{ color: '#d97706' }}>{mxStats?.open ?? 0}</strong> · In Progress: <strong style={{ color: '#7c3aed' }}>{mxStats?.in_progress ?? 0}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ ...CARD, padding: '16px 20px', marginTop: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: '+ Add Space',        path: '/admin/spaces',      bg: '#2563eb', color: '#fff',     border: 'none'                  },
            { label: 'View All Sites',      path: '/admin/sites',       bg: '#fff',    color: '#374151',  border: '1px solid #e5e7eb'     },
            { label: 'Maintenance Tickets', path: '/admin/maintenance', bg: '#fff',    color: '#374151',  border: '1px solid #e5e7eb'     },
            { label: 'Price Plans',         path: '/admin/price-plans', bg: '#fff',    color: '#374151',  border: '1px solid #e5e7eb'     },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} style={{ padding: '9px 18px', borderRadius: 8, background: a.bg, color: a.color, border: a.border, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
