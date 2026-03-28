import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, Select, Modal, Form, DatePicker, InputNumber, Skeleton, Empty, message } from 'antd';
import {
  SearchOutlined, PlusOutlined, ReloadOutlined,
  CalendarOutlined, TeamOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, EnvironmentOutlined,
  DownloadOutlined, EyeOutlined,
} from '@ant-design/icons';
import { bookingApi, spaceApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Booking, BookingStatus, Space } from '../../types';
import dayjs from 'dayjs';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<BookingStatus, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  DRAFT:            { label: 'Draft',            bg: '#f1f5f9', color: '#475569', icon: <ClockCircleOutlined />     },
  PENDING_APPROVAL: { label: 'Pending Approval', bg: '#fef3c7', color: '#92400e', icon: <ClockCircleOutlined />     },
  CONFIRMED:        { label: 'Confirmed',        bg: '#dcfce7', color: '#15803d', icon: <CheckCircleOutlined />     },
  CHECKED_IN:       { label: 'Checked In',       bg: '#dbeafe', color: '#1d4ed8', icon: <CheckCircleOutlined />     },
  COMPLETED:        { label: 'Completed',        bg: '#ede9fe', color: '#6d28d9', icon: <CheckCircleOutlined />     },
  CANCELLED:        { label: 'Cancelled',        bg: '#fee2e2', color: '#b91c1c', icon: <CloseCircleOutlined />     },
  NO_SHOW:          { label: 'No Show',          bg: '#fef3c7', color: '#b45309', icon: <CloseCircleOutlined />     },
};

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDuration(start: string, end: string): string {
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (diff < 60)  return `${diff}min`;
  if (diff < 1440) return `${Math.round(diff / 60)}h`;
  return `${Math.round(diff / 1440)}d`;
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

// ─── New Booking Modal ────────────────────────────────────────────────────────
function NewBookingModal({ open, onClose, tenantId, userId }: {
  open: boolean; onClose: () => void; tenantId: string; userId: string;
}) {
  const [form]    = Form.useForm();
  const qc        = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces-available'],
    queryFn:  () => spaceApi.getAll({ status: 'AVAILABLE' }).then(r => r.data),
    enabled:  open,
  });

  const handleOk = async () => {
    try {
      await form.validateFields();
      setLoading(true);
      const v = form.getFieldsValue();
      await bookingApi.create({
        tenant_id:          tenantId,
        space_id:           v.space_id,
        created_by_user_id: userId,
        start_datetime:     v.start_datetime.toISOString(),
        end_datetime:       v.end_datetime.toISOString(),
        total_price:        v.total_price ?? 0,
        attendee_count:     v.attendee_count ?? 1,
        currency:           'USD',
      });
      message.success('Booking created successfully');
      qc.invalidateQueries({ queryKey: ['bookings'] });
      onClose();
      form.resetFields();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to create booking';
      message.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={() => { onClose(); form.resetFields(); }}
      footer={null}
      width={560}
      title={
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>New Booking</div>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 400, marginTop: 2 }}>Reserve a space for your team</div>
        </div>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item label="Select Space" name="space_id" rules={[{ required: true, message: 'Please select a space' }]}>
          <Select
            showSearch
            placeholder="Search and select a space..."
            filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            options={(spaces as Space[]).map(s => ({
              value: s.id,
              label: `${s.name} (${s.code}) — Cap: ${s.capacity}`,
            }))}
          />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="Start Date & Time" name="start_datetime" rules={[{ required: true, message: 'Required' }]}>
            <DatePicker showTime format="MMM DD, YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="End Date & Time" name="end_datetime" rules={[{ required: true, message: 'Required' }]}>
            <DatePicker showTime format="MMM DD, YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="Number of Attendees" name="attendee_count" initialValue={1}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Total Price (USD)" name="total_price" initialValue={0}>
            <InputNumber min={0} prefix="$" style={{ width: '100%' }} />
          </Form.Item>
        </div>
      </Form>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => { onClose(); form.resetFields(); }} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <button onClick={handleOk} disabled={loading} style={{ padding: '9px 24px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {loading ? 'Creating...' : '+ Create Booking'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Booking Detail Modal ─────────────────────────────────────────────────────
function BookingDetailModal({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const qc = useQueryClient();

  const cancelMut = useMutation({
    mutationFn: (id: string) => bookingApi.cancel(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Booking cancelled'); onClose(); },
    onError:    () => message.error('Failed to cancel booking'),
  });

  const checkInMut = useMutation({
    mutationFn: (id: string) => bookingApi.checkIn(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Checked in!'); onClose(); },
  });

  if (!booking) return null;
  const sm = STATUS_META[booking.status] ?? STATUS_META.DRAFT;

  return (
    <Modal
      open={!!booking}
      onCancel={onClose}
      footer={null}
      width={520}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Booking Details</span>
          <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{sm.label}</span>
        </div>
      }
    >
      <div style={{ marginTop: 16 }}>
        {[
          ['Booking #',   booking.booking_number],
          ['Space',       (booking as any).space?.name ?? booking.space_id.substring(0, 8)],
          ['Start',       formatDateTime(booking.start_datetime)],
          ['End',         formatDateTime(booking.end_datetime)],
          ['Duration',    getDuration(booking.start_datetime, booking.end_datetime)],
          ['Attendees',   booking.attendee_count],
          ['Total Price', `${booking.currency} ${parseFloat(booking.total_price).toLocaleString()}`],
          ['Status',      booking.status.replace(/_/g, ' ')],
          ['Created',     formatDate(booking.created_at)],
          ...(booking.checked_in_at  ? [['Checked In',  formatDateTime(booking.checked_in_at)]]  : []),
          ...(booking.checked_out_at ? [['Checked Out', formatDateTime(booking.checked_out_at)]] : []),
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
            <span style={{ color: '#64748b' }}>{k}</span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {booking.status === 'CONFIRMED' && (
            <button
              onClick={() => checkInMut.mutate(booking.id)}
              style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Check In
            </button>
          )}
          {!['CANCELLED','COMPLETED','NO_SHOW'].includes(booking.status) && (
            <button
              onClick={() => cancelMut.mutate(booking.id)}
              style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel Booking
            </button>
          )}
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb', fontSize: 13, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BookingsPage() {
  const qc           = useQueryClient();
  const { user }     = useAuthStore();
  const tenantId     = user?.tenant_id ?? '';
  const userId       = user?.id ?? '';
  const isAdmin      = user?.role && ['SUPER_ADMIN', 'SITE_MANAGER', 'TENANT_ADMIN'].includes(user.role);

  const [q,          setQ]        = useState('');
  const [statusFilt, setStatus]   = useState('');
  const [newOpen,    setNew]      = useState(false);
  const [selected,   setSelected] = useState<Booking | null>(null);
  const [view,       setView]     = useState<'table' | 'calendar'>('table');

  // ── Fetch bookings ──
  const { data: bookings = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['bookings', tenantId],
    queryFn:  () => bookingApi.getAll({ tenantId: tenantId || undefined }).then(r => r.data),
  });

  // ── Cancel mutation ──
  const cancelMut = useMutation({
    mutationFn: (id: string) => bookingApi.cancel(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Booking cancelled'); },
    onError:    () => message.error('Failed to cancel booking'),
  });

  // ── Filter ──
  const filtered = (bookings as Booking[]).filter(b => {
    if (statusFilt && b.status !== statusFilt) return false;
    if (q) {
      const spaceName = (b as any).space?.name ?? '';
      const num       = b.booking_number;
      if (!spaceName.toLowerCase().includes(q.toLowerCase()) &&
          !num.toLowerCase().includes(q.toLowerCase())) return false;
    }
    return true;
  });

  // ── Stats ──
  const all       = bookings as Booking[];
  const confirmed = all.filter(b => b.status === 'CONFIRMED').length;
  const pending   = all.filter(b => b.status === 'PENDING_APPROVAL').length;
  const completed = all.filter(b => b.status === 'COMPLETED').length;
  const cancelled = all.filter(b => b.status === 'CANCELLED').length;

  // ── Group by date for calendar view ──
  const byDate = filtered.reduce((acc: Record<string, Booking[]>, b) => {
    const date = new Date(b.start_datetime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(b);
    return acc;
  }, {});

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* ── Header ── */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Meeting Room Reservations</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Book and manage your space reservations</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ReloadOutlined />
            </button>
            <button style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
              <DownloadOutlined /> Export
            </button>
            <button
              onClick={() => setNew(true)}
              style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <PlusOutlined /> New Booking
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
          {[
            { label: 'Total',     value: all.length,  sub: 'All bookings',       color: '#2563eb', bg: '#eff6ff', icon: '📅' },
            { label: 'Confirmed', value: confirmed,    sub: 'Ready to check in',  color: '#059669', bg: '#f0fdf4', icon: '✅' },
            { label: 'Pending',   value: pending,      sub: 'Awaiting approval',  color: '#d97706', bg: '#fffbeb', icon: '⏳' },
            { label: 'Completed', value: completed,    sub: 'Successfully done',  color: '#7c3aed', bg: '#f5f3ff', icon: '🎯' },
            { label: 'Cancelled', value: cancelled,    sub: 'Cancelled bookings', color: '#dc2626', bg: '#fef2f2', icon: '❌' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 11, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
                  <p style={{ margin: '0 0 3px', fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{isLoading ? '—' : s.value}</p>
                  <p style={{ margin: 0, fontSize: 11, color: s.color }}>{s.sub}</p>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search by booking # or space..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ width: 260, borderRadius: 8 }}
        />
        <Select
          value={statusFilt || 'all'}
          onChange={v => setStatus(v === 'all' ? '' : v)}
          style={{ width: 190 }}
          options={[
            { value: 'all',             label: 'All Status'       },
            { value: 'CONFIRMED',       label: 'Confirmed'        },
            { value: 'PENDING_APPROVAL',label: 'Pending Approval' },
            { value: 'CHECKED_IN',      label: 'Checked In'       },
            { value: 'COMPLETED',       label: 'Completed'        },
            { value: 'CANCELLED',       label: 'Cancelled'        },
            { value: 'DRAFT',           label: 'Draft'            },
          ]}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Showing <strong style={{ color: '#0f172a' }}>{isLoading ? '—' : filtered.length}</strong> of {all.length}
          </span>
          <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('table')}    style={{ padding: '7px 12px', background: view === 'table'    ? '#2563eb' : '#fff', color: view === 'table'    ? '#fff' : '#64748b', border: 'none', cursor: 'pointer', fontSize: 12 }}>☰ List</button>
            <button onClick={() => setView('calendar')} style={{ padding: '7px 12px', background: view === 'calendar' ? '#2563eb' : '#fff', color: view === 'calendar' ? '#fff' : '#64748b', border: 'none', cursor: 'pointer', fontSize: 12 }}>📅 Timeline</button>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {isError && (
        <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load bookings</div>
          <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div style={CARD}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: '16px 20px', borderBottom: i < 4 ? '1px solid #f8fafc' : 'none' }}>
              <Skeleton active paragraph={{ rows: 1 }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div style={{ ...CARD, padding: '60px', textAlign: 'center' }}>
          <CalendarOutlined style={{ fontSize: 48, color: '#e5e7eb', display: 'block', margin: '0 auto 16px' }} />
          <Empty description={all.length === 0 ? 'No bookings yet. Create your first booking!' : 'No bookings match your filters.'} />
          {all.length === 0 && (
            <button onClick={() => setNew(true)} style={{ marginTop: 16, padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              + New Booking
            </button>
          )}
        </div>
      )}

      {/* ════════ TABLE VIEW ════════ */}
      {!isLoading && !isError && filtered.length > 0 && view === 'table' && (
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1.5fr 1fr 0.8fr 1fr 1fr', padding: '11px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Booking #</span>
            <span>Space</span>
            <span>Date & Time</span>
            <span>Duration</span>
            <span>Attendees</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {filtered.map((b: Booking, i: number) => {
            const sm = STATUS_META[b.status] ?? STATUS_META.DRAFT;
            const spaceName = (b as any).space?.name ?? 'Space ' + b.space_id.substring(0, 6);
            const canCancel = !['CANCELLED','COMPLETED','NO_SHOW'].includes(b.status);
            return (
              <div
                key={b.id}
                style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1.5fr 1fr 0.8fr 1fr 1fr', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {/* Booking # */}
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{b.booking_number}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{formatDate(b.created_at)}</div>
                </div>

                {/* Space */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <EnvironmentOutlined style={{ color: '#2563eb', fontSize: 14 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{spaceName}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{(b as any).space?.type?.replace(/_/g, ' ') ?? 'Office Space'}</div>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <div style={{ fontSize: 12, color: '#374151' }}>{new Date(b.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {new Date(b.start_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} — {new Date(b.end_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* Duration */}
                <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                  {getDuration(b.start_datetime, b.end_datetime)}
                </div>

                {/* Attendees */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#374151' }}>
                  <TeamOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                  {b.attendee_count}
                </div>

                {/* Status */}
                <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  {sm.icon} {sm.label}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 5 }}>
                  <button
                    onClick={() => setSelected(b)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="View details"
                  >
                    <EyeOutlined style={{ fontSize: 12, color: '#64748b' }} />
                  </button>
                  {canCancel && (
                    <button
                      onClick={() => Modal.confirm({
                        title: 'Cancel this booking?',
                        content: `Booking ${b.booking_number} will be cancelled.`,
                        okText: 'Yes, Cancel',
                        okType: 'danger',
                        onOk: () => cancelMut.mutate(b.id),
                      })}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Cancel booking"
                    >
                      <CloseCircleOutlined style={{ fontSize: 12, color: '#dc2626' }} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
            <span>Showing {filtered.length} of {all.length} bookings</span>
            <span>{confirmed} confirmed · {pending} pending</span>
          </div>
        </div>
      )}

      {/* ════════ TIMELINE VIEW ════════ */}
      {!isLoading && !isError && filtered.length > 0 && view === 'calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(byDate).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime()).map(([date, dayBookings]) => (
            <div key={date}>
              {/* Day header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{date}</div>
                <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
                  {dayBookings.length} booking{dayBookings.length > 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dayBookings.map((b: Booking) => {
                  const sm = STATUS_META[b.status] ?? STATUS_META.DRAFT;
                  const spaceName = (b as any).space?.name ?? 'Space';
                  return (
                    <div
                      key={b.id}
                      style={{ ...CARD, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                      onClick={() => setSelected(b)}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
                    >
                      {/* Time */}
                      <div style={{ width: 80, textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                          {new Date(b.start_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {getDuration(b.start_datetime, b.end_datetime)}
                        </div>
                      </div>

                      {/* Color bar */}
                      <div style={{ width: 4, height: 44, borderRadius: 2, background: sm.color, flexShrink: 0 }} />

                      {/* Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: 3 }}>{spaceName}</div>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: 'monospace' }}>{b.booking_number}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><TeamOutlined style={{ fontSize: 11 }} />{b.attendee_count} attendees</span>
                        </div>
                      </div>

                      {/* Status + price */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-block', marginBottom: 4 }}>
                          {sm.label}
                        </span>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                          ${parseFloat(b.total_price).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      <NewBookingModal
        open={newOpen}
        onClose={() => setNew(false)}
        tenantId={tenantId}
        userId={userId}
      />
      <BookingDetailModal
        booking={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
