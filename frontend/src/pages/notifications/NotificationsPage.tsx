import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton, Empty } from 'antd';
import {
  BellOutlined, CheckCircleOutlined, DeleteOutlined,
  ReloadOutlined, MailOutlined,
} from '@ant-design/icons';
import { notificationApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Notification, NotificationType, NotificationPriority } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_META: Record<NotificationType, { label: string; icon: string; color: string; bg: string }> = {
  BOOKING_CONFIRMATION: { label: 'Booking Confirmed',   icon: '📅', color: '#059669', bg: '#f0fdf4' },
  BOOKING_REMINDER:     { label: 'Booking Reminder',    icon: '⏰', color: '#2563eb', bg: '#eff6ff' },
  INVOICE_ISSUED:       { label: 'Invoice Issued',      icon: '🧾', color: '#6d28d9', bg: '#f5f3ff' },
  INVOICE_OVERDUE:      { label: 'Invoice Overdue',     icon: '⚠️', color: '#dc2626', bg: '#fef2f2' },
  PAYMENT_RECEIVED:     { label: 'Payment Received',    icon: '💰', color: '#059669', bg: '#f0fdf4' },
  TICKET_UPDATED:       { label: 'Ticket Updated',      icon: '🔧', color: '#d97706', bg: '#fffbeb' },
  CONTRACT_EXPIRING:    { label: 'Contract Expiring',   icon: '📋', color: '#dc2626', bg: '#fef2f2' },
};

const PRIORITY_META: Record<NotificationPriority, { color: string; dot: string }> = {
  LOW:    { color: '#94a3b8', dot: '#94a3b8' },
  NORMAL: { color: '#2563eb', dot: '#3b82f6' },
  HIGH:   { color: '#d97706', dot: '#f59e0b' },
  URGENT: { color: '#dc2626', dot: '#ef4444' },
};

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const qc       = useQueryClient();
  const { user } = useAuthStore();
  const userId   = user?.id ?? '';

  // ── Fetch notifications for this user ──
  const { data: notifications = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', userId],
    queryFn:  () => notificationApi.getAll({ userId }).then(r => r.data),
    enabled:  !!userId,
    refetchInterval: 30000, // refresh every 30s
  });

  // ── Unread count ──
  const { data: unreadData } = useQuery({
    queryKey: ['unread-count', userId],
    queryFn:  () => notificationApi.getUnreadCount(userId).then(r => r.data),
    enabled:  !!userId,
    refetchInterval: 30000,
  });

  // ── Mutations ──
  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notifications', userId] });
      qc.invalidateQueries({ queryKey: ['unread-count', userId] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationApi.markAllRead(userId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notifications', userId] });
      qc.invalidateQueries({ queryKey: ['unread-count', userId] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => notificationApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
  });

  const all    = notifications as Notification[];
  const unread = unreadData?.unread_count ?? all.filter(n => !n.is_read).length;

  // Group by date
  const grouped = all.reduce((acc: Record<string, Notification[]>, n) => {
    const date = new Date(n.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(n);
    return acc;
  }, {});

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: unread > 0 ? '#fef3c7' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <BellOutlined style={{ fontSize: 22, color: unread > 0 ? '#d97706' : '#94a3b8' }} />
              {unread > 0 && (
                <div style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                  {unread > 9 ? '9+' : unread}
                </div>
              )}
            </div>
            <div>
              <h2 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Notifications</h2>
              <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
                {unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'All caught up!'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#64748b' }}>
              <ReloadOutlined />
            </button>
            {unread > 0 && (
              <button
                onClick={() => markAllMut.mutate()}
                disabled={markAllMut.isPending}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <CheckCircleOutlined style={{ color: '#059669' }} /> Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Stats pills */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Total',   value: all.length,                             color: '#2563eb', bg: '#eff6ff' },
            { label: 'Unread',  value: unread,                                 color: '#d97706', bg: '#fffbeb' },
            { label: 'High Priority', value: all.filter(n => n.priority === 'HIGH' || n.priority === 'URGENT').length, color: '#dc2626', bg: '#fef2f2' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 12, color: s.color, fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load notifications</div>
          <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={CARD}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: '16px 20px', borderBottom: i < 4 ? '1px solid #f8fafc' : 'none' }}>
              <Skeleton avatar active paragraph={{ rows: 1 }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && all.length === 0 && (
        <div style={{ ...CARD, padding: '80px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircleOutlined style={{ fontSize: 32, color: '#22c55e' }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>All caught up!</div>
          <div style={{ fontSize: 14, color: '#64748b' }}>No notifications yet. We'll notify you about bookings, invoices and contracts.</div>
        </div>
      )}

      {/* Grouped notifications */}
      {!isLoading && !isError && all.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              {/* Day header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{date}</div>
                <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{items.length} notification{items.length > 1 ? 's' : ''}</span>
              </div>

              <div style={{ ...CARD, overflow: 'hidden' }}>
                {items.map((n: Notification, i: number) => {
                  const tm = TYPE_META[n.type]         ?? { label: n.type, icon: '🔔', color: '#2563eb', bg: '#eff6ff' };
                  const pm = PRIORITY_META[n.priority] ?? PRIORITY_META.NORMAL;

                  return (
                    <div
                      key={n.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 14,
                        padding: '16px 20px',
                        borderBottom: i < items.length - 1 ? '1px solid #f8fafc' : 'none',
                        background: n.is_read ? '#fff' : '#fafbff',
                        transition: 'background 0.15s',
                        cursor: n.is_read ? 'default' : 'pointer',
                      }}
                      onClick={() => !n.is_read && markReadMut.mutate(n.id)}
                    >
                      {/* Icon */}
                      <div style={{ width: 42, height: 42, borderRadius: 11, background: tm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, position: 'relative' }}>
                        {tm.icon}
                        {/* Priority dot */}
                        {(n.priority === 'HIGH' || n.priority === 'URGENT') && (
                          <div style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: pm.dot, border: '2px solid #fff' }} />
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                          <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize: 14, color: '#0f172a' }}>{n.title}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{timeAgo(n.created_at)}</div>
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 6 }}>{n.message}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: tm.bg, color: tm.color, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{tm.label}</span>
                          <span style={{ background: n.priority === 'LOW' ? '#f1f5f9' : pm.color + '15', color: pm.color, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{n.priority}</span>
                          {!n.is_read && <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>NEW</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        {!n.is_read && (
                          <button
                            onClick={e => { e.stopPropagation(); markReadMut.mutate(n.id); }}
                            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Mark as read"
                          >
                            <CheckCircleOutlined style={{ fontSize: 12, color: '#15803d' }} />
                          </button>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); deleteMut.mutate(n.id); }}
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Delete"
                        >
                          <DeleteOutlined style={{ fontSize: 12, color: '#dc2626' }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
