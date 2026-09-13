import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BellOutlined, CheckOutlined, CheckCircleOutlined } from '@ant-design/icons';

import { useAuthStore } from '../store/authStore';
import { notificationApi } from '../api/services'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toArray<T>(raw: any): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function timeAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = {
  BOOKING_APPROVED:    { icon: '✅', color: '#059669', bg: '#f0fdf4' },
  BOOKING_CANCELLED:   { icon: '❌', color: '#dc2626', bg: '#fef2f2' },
  BOOKING_CREATED:     { icon: '📅', color: '#2563eb', bg: '#eff6ff' },
  BOOKING_CHECKED_IN:  { icon: '🔑', color: '#1d4ed8', bg: '#dbeafe' },
  BOOKING_CHECKED_OUT: { icon: '🚪', color: '#7c3aed', bg: '#f5f3ff' },
  CONTRACT_CREATED:    { icon: '📋', color: '#2563eb', bg: '#eff6ff' },
  CONTRACT_SIGNED:     { icon: '✍️', color: '#059669', bg: '#f0fdf4' },
  CONTRACT_EXPIRING:   { icon: '⏰', color: '#d97706', bg: '#fffbeb' },
  CONTRACT_EXPIRED:    { icon: '🔒', color: '#dc2626', bg: '#fef2f2' },
  INVOICE_CREATED:     { icon: '🧾', color: '#2563eb', bg: '#eff6ff' },
  INVOICE_DUE:         { icon: '💰', color: '#d97706', bg: '#fffbeb' },
  INVOICE_OVERDUE:     { icon: '⚠️', color: '#dc2626', bg: '#fef2f2' },
  INVOICE_PAID:        { icon: '💚', color: '#059669', bg: '#f0fdf4' },
  PAYMENT_RECEIVED:    { icon: '💳', color: '#059669', bg: '#f0fdf4' },
  MAINTENANCE_CREATED: { icon: '🔧', color: '#7c3aed', bg: '#f5f3ff' },
  MAINTENANCE_RESOLVED:{ icon: '✅', color: '#059669', bg: '#f0fdf4' },
  LOGIN_SUCCESS:       { icon: '🔐', color: '#2563eb', bg: '#eff6ff' },
  SYSTEM:              { icon: '🔔', color: '#64748b', bg: '#f8fafc' },
  GENERAL:             { icon: '📢', color: '#64748b', bg: '#f8fafc' },
};

function getMeta(type: string) {
  return TYPE_META[type] ?? { icon: '🔔', color: '#64748b', bg: '#f8fafc' };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function NotificationBell({ basePath = '/admin' }: { basePath?: string }) {
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId   = user?.id ?? '';

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // ── Unread count ────────────────────────────────────────────────────────────
  const { data: countRaw } = useQuery({
    queryKey: ['notif-count', userId],
    queryFn:  () => notificationApi.getUnreadCount(userId).then(r => r.data),
    enabled:  !!userId,
    refetchInterval: 30000,
  });
  const unreadCount =
    typeof countRaw === 'number'
      ? countRaw
      : (countRaw?.unread_count ?? 0);

  // ── Latest 8 notifications for dropdown ────────────────────────────────────
  const { data: notifsRaw = [] } = useQuery({
    queryKey: ['notifications-preview', userId],
    queryFn:  () => notificationApi.getAll({ userId }).then(r => r.data),
    enabled:  !!userId && open,
  });
  const notifs = toArray<any>(notifsRaw).slice(0, 8);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const readMut = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notif-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-preview'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const readAllMut = useMutation({
    mutationFn: () => notificationApi.markAllRead(userId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notif-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-preview'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const goToAll = () => {
    setOpen(false);
    navigate(`${basePath}/notifications`);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 38, height: 38, borderRadius: 10,
          border: open ? '1.5px solid #2563eb' : '1px solid #e5e7eb',
          background: open ? '#eff6ff' : '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', transition: 'all 0.15s',
        }}
      >
        <BellOutlined style={{ fontSize: 16, color: open ? '#2563eb' : '#64748b' }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: '#fff',
            fontSize: 10, fontWeight: 800,
            minWidth: 18, height: 18, borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid #fff',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 46, right: 0, width: 380, zIndex: 9999,
          background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
          boxShadow: '0 16px 48px rgba(0,0,0,0.14)',
          overflow: 'hidden',
        }}>
          {/* Dropdown header */}
          <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>Notifications</span>
              {unreadCount > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 20 }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => readAllMut.mutate()}
                disabled={readAllMut.isPending}
                style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <CheckCircleOutlined /> Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>All caught up!</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>No notifications yet</div>
              </div>
            ) : (
              notifs.map(notif => {
                const meta = getMeta(notif.type);
                return (
                  <div
                    key={notif.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                      background: notif.is_read ? '#fff' : '#f8fbff',
                      borderBottom: '1px solid #f8fafc',
                      borderLeft: `3px solid ${notif.is_read ? 'transparent' : meta.color}`,
                      cursor: 'default', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = notif.is_read ? '#fafafa' : '#eef5ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = notif.is_read ? '#fff' : '#f8fbff')}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                      {meta.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: notif.is_read ? 400 : 600, color: '#0f172a', lineHeight: 1.4, marginBottom: 2 }}>
                        {notif.title ?? notif.message ?? 'Notification'}
                      </div>
                      {notif.message && notif.title && (
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {notif.message}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{timeAgo(notif.created_at)}</div>
                    </div>
                    {!notif.is_read && (
                      <button
                        onClick={e => { e.stopPropagation(); readMut.mutate(notif.id); }}
                        style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        title="Mark as read"
                      >
                        <CheckOutlined style={{ fontSize: 10, color: '#15803d' }} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={goToAll}
              style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px', borderRadius: 7, transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}