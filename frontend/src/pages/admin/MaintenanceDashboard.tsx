import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { maintenanceApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  OPEN:        { label: 'Open',        bg: '#fef3c7', color: '#92400e' },
  ASSIGNED:    { label: 'Assigned',    bg: '#dbeafe', color: '#1d4ed8' },
  IN_PROGRESS: { label: 'In Progress', bg: '#ede9fe', color: '#6d28d9' },
  RESOLVED:    { label: 'Resolved',    bg: '#dcfce7', color: '#15803d' },
  CLOSED:      { label: 'Closed',      bg: '#f1f5f9', color: '#475569' },
  CANCELLED:   { label: 'Cancelled',   bg: '#fee2e2', color: '#b91c1c' },
};

const PRIORITY_META: Record<string, { label: string; bg: string; color: string }> = {
  EMERGENCY: { label: 'Emergency', bg: '#fee2e2', color: '#991b1b' },
  URGENT:    { label: 'Urgent',    bg: '#fee2e2', color: '#dc2626' },
  HIGH:      { label: 'High',      bg: '#fef3c7', color: '#d97706' },
  NORMAL:    { label: 'Normal',    bg: '#dbeafe', color: '#2563eb' },
  LOW:       { label: 'Low',       bg: '#f1f5f9', color: '#475569' },
};

const CATEGORY_ICON: Record<string, string> = {
  PLUMBING: '🚿', ELECTRICAL: '⚡', HVAC: '❄️',
  CLEANING: '🧹', FURNITURE: '🪑', IT_EQUIPMENT: '💻', OTHER: '🔧',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MaintenanceDashboard() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const { user }  = useAuthStore();
  const userId    = user?.id ?? '';

  // My assigned tickets
  const { data: myTickets = [], isLoading: l1, refetch } = useQuery({
    queryKey: ['mx-my-tickets', userId],
    queryFn:  () => maintenanceApi.getAll({ assignedTo: userId }).then(r => r.data),
    enabled:  !!userId,
  });

  // All tickets stats
  const { data: stats } = useQuery({
    queryKey: ['mx-stats'],
    queryFn:  () => maintenanceApi.getStats().then(r => r.data),
  });

  // All open tickets (for awareness)
  const { data: openTickets = [], isLoading: l2 } = useQuery({
    queryKey: ['mx-open'],
    queryFn:  () => maintenanceApi.getAll({ status: 'OPEN' }).then(r => r.data),
  });

  const isLoading = l1 || l2;

  const startMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.start(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['mx-my-tickets'] }); message.success('Work started!'); },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.resolve(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['mx-my-tickets'] }); message.success('Ticket resolved!'); },
  });

  const allMyTickets  = myTickets  as any[];
  const allOpenTickets= openTickets as any[];

  const myActive    = allMyTickets.filter(t => ['ASSIGNED','IN_PROGRESS'].includes(t.status));
  const myResolved  = allMyTickets.filter(t => t.status === 'RESOLVED');
  const myUrgent    = allMyTickets.filter(t => t.priority === 'URGENT' || t.priority === 'EMERGENCY');

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Maintenance Dashboard</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
            Welcome back, <strong>{user?.first_name}</strong> · Your assigned maintenance tasks
          </p>
        </div>
        <button onClick={() => refetch()} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ReloadOutlined /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'My Assignments', value: allMyTickets.length, sub: 'Total assigned to me',  color: '#2563eb', bg: '#eff6ff', icon: '🎫' },
          { label: 'Active Tasks',   value: myActive.length,     sub: 'Need your attention',   color: '#d97706', bg: '#fffbeb', icon: '⚙️' },
          { label: 'Urgent',         value: myUrgent.length,     sub: 'High priority tickets', color: '#dc2626', bg: '#fef2f2', icon: '🚨' },
          { label: 'Resolved',       value: myResolved.length,   sub: 'Completed by me',       color: '#059669', bg: '#f0fdf4', icon: '✅' },
        ].map(k => (
          <div key={k.label} style={{ ...CARD, padding: '18px 20px' }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 12 }}>{k.icon}</div>
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

      {/* Platform-wide stats */}
      <div style={{ ...CARD, padding: '14px 20px', marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>Platform-Wide Stats</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {[
            { label: 'Total',       value: stats?.total       ?? 0, color: '#2563eb' },
            { label: 'Open',        value: stats?.open        ?? 0, color: '#d97706' },
            { label: 'In Progress', value: stats?.in_progress ?? 0, color: '#7c3aed' },
            { label: 'Resolved',    value: stats?.resolved    ?? 0, color: '#059669' },
            { label: 'Total Cost',  value: `$${Number(stats?.total_cost ?? 0).toLocaleString()}`, color: '#0369a1' },
          ].map(s => (
            <div key={s.label} style={{ background: '#f8fafc', borderRadius: 9, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* My assigned tickets */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
              My Assigned Tickets
              {myUrgent.length > 0 && <span style={{ marginLeft: 8, background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>{myUrgent.length} urgent</span>}
            </div>
            <button onClick={() => navigate('/admin/maintenance')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>All tickets →</button>
          </div>
          {isLoading ? <div style={{ padding: 20 }}><Skeleton active paragraph={{ rows: 5 }} /></div>
          : allMyTickets.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
              <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>No assigned tickets!</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>You're all caught up.</div>
            </div>
          ) : allMyTickets.map((t: any, i: number) => {
            const sm = STATUS_META[t.status]      ?? STATUS_META.OPEN;
            const pm = PRIORITY_META[t.priority]  ?? PRIORITY_META.NORMAL;
            const icon = CATEGORY_ICON[t.category] ?? '🔧';
            return (
              <div key={t.id} style={{ padding: '14px 20px', borderBottom: i < allMyTickets.length-1 ? '1px solid #f8fafc':'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: pm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {t.ticket_number} · {t.space?.name ?? 'Unknown'} · {formatDate(t.reported_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <span style={{ background: pm.bg, color: pm.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>{pm.label}</span>
                    <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>{sm.label}</span>
                  </div>
                </div>
                {/* Action buttons per status */}
                <div style={{ display: 'flex', gap: 8, marginLeft: 48 }}>
                  {t.status === 'ASSIGNED' && (
                    <button
                      onClick={() => startMut.mutate(t.id)}
                      disabled={startMut.isPending}
                      style={{ padding: '6px 14px', borderRadius: 7, background: '#ede9fe', border: '1px solid #ddd6fe', color: '#6d28d9', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      ▶ Start Work
                    </button>
                  )}
                  {t.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => resolveMut.mutate(t.id)}
                      disabled={resolveMut.isPending}
                      style={{ padding: '6px 14px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      ✓ Mark Resolved
                    </button>
                  )}
                  {t.status === 'RESOLVED' && (
                    <span style={{ fontSize: 12, color: '#15803d', fontWeight: 500 }}>✅ Awaiting closure by manager</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Open unassigned tickets */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
              Open Unassigned Tickets
              <span style={{ marginLeft: 8, background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>{allOpenTickets.length}</span>
            </div>
            <button onClick={() => navigate('/admin/maintenance')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Manage →</button>
          </div>
          {isLoading ? <div style={{ padding: 20 }}><Skeleton active paragraph={{ rows: 4 }} /></div>
          : allOpenTickets.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
              <div style={{ color: '#374151', fontWeight: 600 }}>No open tickets!</div>
            </div>
          ) : allOpenTickets.map((t: any, i: number) => {
            const pm   = PRIORITY_META[t.priority] ?? PRIORITY_META.NORMAL;
            const icon = CATEGORY_ICON[t.category] ?? '🔧';
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < allOpenTickets.length-1 ? '1px solid #f8fafc':'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: pm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.space?.name ?? 'Unknown'} · {formatDate(t.reported_at)}</div>
                </div>
                <span style={{ background: pm.bg, color: pm.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
                  {pm.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ ...CARD, padding: '16px 20px', marginTop: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/admin/maintenance')} style={{ padding: '9px 18px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            View All Tickets
          </button>
          <button onClick={() => navigate('/admin/maintenance')} style={{ padding: '9px 18px', borderRadius: 8, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Submit New Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
