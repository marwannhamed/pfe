import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, Skeleton } from 'antd';
import { message } from '../../utils/feedback';
import {
  BellOutlined, CheckCircleOutlined, DeleteOutlined,
  ReloadOutlined, CheckOutlined, } from '@ant-design/icons';
import { notificationApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toArray<T>(raw: any): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function timeAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Notification type metadata ───────────────────────────────────────────────
const TYPE_META: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  BOOKING_APPROVED:    { icon: '✅', color: '#059669', bg: '#f0fdf4', label: 'Booking Approved'    },
  BOOKING_CANCELLED:   { icon: '❌', color: '#dc2626', bg: '#fef2f2', label: 'Booking Cancelled'   },
  BOOKING_CREATED:     { icon: '📅', color: '#2563eb', bg: '#eff6ff', label: 'New Booking'         },
  BOOKING_CHECKED_IN:  { icon: '🔑', color: '#1d4ed8', bg: '#dbeafe', label: 'Checked In'         },
  BOOKING_CHECKED_OUT: { icon: '🚪', color: '#7c3aed', bg: '#f5f3ff', label: 'Checked Out'        },
  CONTRACT_CREATED:    { icon: '📋', color: '#2563eb', bg: '#eff6ff', label: 'Contract Created'    },
  CONTRACT_SIGNED:     { icon: '✍️', color: '#059669', bg: '#f0fdf4', label: 'Contract Signed'     },
  CONTRACT_EXPIRING:   { icon: '⏰', color: '#d97706', bg: '#fffbeb', label: 'Contract Expiring'   },
  CONTRACT_EXPIRED:    { icon: '🔒', color: '#dc2626', bg: '#fef2f2', label: 'Contract Expired'    },
  CONTRACT_TERMINATED: { icon: '🛑', color: '#dc2626', bg: '#fef2f2', label: 'Contract Terminated' },
  INVOICE_CREATED:     { icon: '🧾', color: '#2563eb', bg: '#eff6ff', label: 'Invoice Created'     },
  INVOICE_DUE:         { icon: '💰', color: '#d97706', bg: '#fffbeb', label: 'Invoice Due'         },
  INVOICE_OVERDUE:     { icon: '⚠️', color: '#dc2626', bg: '#fef2f2', label: 'Invoice Overdue'    },
  INVOICE_PAID:        { icon: '💚', color: '#059669', bg: '#f0fdf4', label: 'Invoice Paid'        },
  PAYMENT_RECEIVED:    { icon: '💳', color: '#059669', bg: '#f0fdf4', label: 'Payment Received'    },
  MAINTENANCE_CREATED: { icon: '🔧', color: '#7c3aed', bg: '#f5f3ff', label: 'Maintenance Ticket'  },
  MAINTENANCE_UPDATED: { icon: '🛠️', color: '#7c3aed', bg: '#f5f3ff', label: 'Maintenance Update'  },
  MAINTENANCE_RESOLVED:{ icon: '✅', color: '#059669', bg: '#f0fdf4', label: 'Issue Resolved'      },
  LOGIN_SUCCESS:       { icon: '🔐', color: '#2563eb', bg: '#eff6ff', label: 'Login'               },
  SYSTEM:              { icon: '🔔', color: '#64748b', bg: '#f8fafc', label: 'System'              },
  GENERAL:             { icon: '📢', color: '#64748b', bg: '#f8fafc', label: 'General'             },
};

function getTypeMeta(type: string) {
  return TYPE_META[type] ?? { icon: '🔔', color: '#64748b', bg: '#f8fafc', label: type?.replace(/_/g, ' ') ?? 'Notification' };
}

// ─── Notification Item ────────────────────────────────────────────────────────
function NotifItem({ notif, onRead, onDelete }: {
  notif: any;
  onRead:   (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const meta = getTypeMeta(notif.type);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px',
        background: notif.is_read ? '#fff' : '#f8fbff',
        borderLeft: `4px solid ${notif.is_read ? 'transparent' : meta.color}`,
        borderBottom: '1px solid #f1f5f9',
        transition: 'background 0.15s',
        cursor: 'default',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = notif.is_read ? '#fafafa' : '#f0f7ff')}
      onMouseLeave={e => (e.currentTarget.style.background = notif.is_read ? '#fff' : '#f8fbff')}
    >
      {/* Icon */}
      <div style={{ width: 42, height: 42, borderRadius: 12, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
        {meta.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 20 }}>
            {meta.label}
          </span>
          {!notif.is_read && (
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563eb', display: 'inline-block', flexShrink: 0 }} />
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: notif.is_read ? 400 : 600, color: '#0f172a', marginBottom: 4, lineHeight: 1.4 }}>
          {notif.title ?? notif.message ?? 'Notification'}
        </div>
        {notif.message && notif.title && (
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, lineHeight: 1.4 }}>{notif.message}</div>
        )}
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{timeAgo(notif.created_at)}</div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {!notif.is_read && (
          <button
            onClick={() => onRead(notif.id)}
            style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Mark as read"
          >
            <CheckOutlined style={{ fontSize: 11, color: '#15803d' }} />
          </button>
        )}
        <button
          onClick={() => onDelete(notif.id)}
          style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Delete"
        >
          <DeleteOutlined style={{ fontSize: 11, color: '#dc2626' }} />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { card, headerCard, btnIcon, t: th } = usePageTheme();
  const qc       = useQueryClient();
  const { user } = useAuthStore();
  const userId   = user?.id ?? '';

  const [typeFilt,   setTypeFilt]   = useState('');
  const [readFilt,   setReadFilt]   = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const { data: notifsRaw = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', userId, typeFilt, readFilt],
    queryFn:  () => notificationApi.getAll({
      userId,
      ...(typeFilt  ? { type:   typeFilt  } : {}),
      ...(readFilt  ? { isRead: readFilt  } : {}),
    }).then(r => r.data),
    enabled:  !!userId,
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const notifs = toArray<any>(notifsRaw);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const readMut = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-count'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.userMessage ?? 'Failed to mark as read';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const readAllMut = useMutation({
    mutationFn: () => {
      if (!userId) return Promise.reject(new Error('Not signed in'));
      return notificationApi.markAllRead(userId);
    },
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-count'] });
      message.success('All notifications marked as read');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.userMessage ?? 'Failed to mark all as read';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => notificationApi.remove(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-count'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.userMessage ?? 'Failed to delete';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const unread = notifs.filter(n => !n.is_read).length;
  const total  = notifs.length;

  // ── Group by date ──────────────────────────────────────────────────────────
  const grouped = notifs.reduce((acc: Record<string, any[]>, n) => {
    const d   = new Date(n.created_at);
    const now = new Date();
    let key: string;
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0)       key = 'Today';
    else if (diffDays === 1)  key = 'Yesterday';
    else if (diffDays <= 7)   key = 'This Week';
    else if (diffDays <= 30)  key = 'This Month';
    else                      key = 'Older';
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

  // All unique types for filter
  const allTypes = Array.from(new Set(notifs.map(n => n.type))).filter(Boolean);

  return (
    <PageShell>

      {/* Header */}
      <div style={headerCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: th.text, display: 'flex', alignItems: 'center', gap: 10 }}>
              <BellOutlined />
              Notifications
              {unread > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 800, padding: '2px 10px', borderRadius: 20, lineHeight: 1.4 }}>{unread} new</span>
              )}
            </h2>
            <p style={{ margin: 0, color: th.textSub, fontSize: 14 }}>Stay updated on bookings, contracts, invoices and more</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ ...btnIcon, padding: '8px 12px' }}>
              <ReloadOutlined />
            </button>
            {unread > 0 && (
              <button
                onClick={() => readAllMut.mutate()}
                disabled={readAllMut.isPending || !userId}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <CheckCircleOutlined /> Mark all as read
              </button>
            )}
          </div>
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'Total',    value: total,               color: '#2563eb', bg: '#eff6ff', icon: '🔔' },
            { label: 'Unread',   value: unread,              color: '#dc2626', bg: '#fef2f2', icon: '🔴' },
            { label: 'Read',     value: total - unread,      color: '#059669', bg: '#f0fdf4', icon: '✅' },
            { label: 'Today',    value: (grouped['Today'] ?? []).length, color: '#7c3aed', bg: '#f5f3ff', icon: '📅' },
          ].map(s => (
            <div key={s.label} style={{ border: `1px solid ${th.cardBorder}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{isLoading ? '—' : s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          value={readFilt || 'all'}
          onChange={v => setReadFilt(v === 'all' ? '' : v)}
          style={{ width: 160 }}
          options={[
            { value: 'all',   label: '📬 All'    },
            { value: 'false', label: '🔴 Unread' },
            { value: 'true',  label: '✅ Read'   },
          ]}
        />
        <Select
          value={typeFilt || 'all'}
          onChange={v => setTypeFilt(v === 'all' ? '' : v)}
          style={{ width: 200 }}
          options={[
            { value: 'all', label: 'All Types' },
            ...allTypes.map(t => ({ value: t, label: `${getTypeMeta(t).icon} ${getTypeMeta(t).label}` })),
          ]}
        />
        <div style={{ marginLeft: 'auto', fontSize: 13, color: th.textSub }}>
          <strong style={{ color: th.text }}>{total}</strong> notifications · <strong style={{ color: '#dc2626' }}>{unread}</strong> unread
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div style={{ ...card, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load notifications</div>
          <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ ...card, overflow: 'hidden' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: '16px 20px', borderBottom: i < 4 ? '1px solid #f8fafc' : 'none' }}>
              <Skeleton avatar active paragraph={{ rows: 1 }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && total === 0 && (
        <div style={{ ...card, padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔔</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: th.text, marginBottom: 8 }}>All caught up!</div>
          <div style={{ color: th.textSub, fontSize: 14 }}>No notifications yet. We'll alert you when something important happens.</div>
        </div>
      )}

      {/* Grouped notifications */}
      {!isLoading && !isError && total > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {GROUP_ORDER.filter(g => grouped[g]?.length > 0).map(group => (
            <div key={group}>
              {/* Group header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: th.textSub, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group}</span>
                <div style={{ flex: 1, height: 1, background: th.cardBorder }} />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{grouped[group].length}</span>
              </div>

              {/* Items */}
              <div style={{ ...card, overflow: 'hidden' }}>
                {grouped[group].map((notif: any) => (
                  <NotifItem
                    key={notif.id}
                    notif={notif}
                    onRead={id => readMut.mutate(id)}
                    onDelete={id => deleteMut.mutate(id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
