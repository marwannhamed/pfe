import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select } from 'antd';
import { message } from '../../utils/feedback';
import { mapBookings } from '../../utils/booking';
import {
  LeftOutlined, RightOutlined, PlusOutlined,
  CloseOutlined, LoadingOutlined, CalendarOutlined,
  AppstoreOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { bookingApi, spaceApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { usePageTheme } from '../../hooks/usePageTheme';
import PageShell from '../../components/ui/PageShell';
import { isQatarWeekend } from '../../constants/qatar';
import type { ApiError, Space } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  const nested = (raw as { data?: unknown }).data;
  if (Array.isArray(nested)) return nested as T[];
  return [];
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function fmt(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  CONFIRMED:        { label: 'Confirmed',  bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
  PENDING_APPROVAL: { label: 'Pending',    bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  CHECKED_IN:       { label: 'Checked In', bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6' },
  COMPLETED:        { label: 'Completed',  bg: '#ede9fe', color: '#6d28d9', dot: '#8b5cf6' },
  CANCELLED:        { label: 'Cancelled',  bg: '#fee2e2', color: '#b91c1c', dot: '#ef4444' },
  DRAFT:            { label: 'Draft',      bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  NO_SHOW:          { label: 'No Show',    bg: '#fef3c7', color: '#b45309', dot: '#f59e0b' },
};

// ─── Quick Book Modal ─────────────────────────────────────────────────────────
function QuickBookModal({ date, spaceId, spaces, onClose, tenantId, userId }: {
  date:     Date;
  spaceId:  string;
  spaces:   any[];
  onClose:  () => void;
  tenantId: string;
  userId:   string;
}) {
  const { card: CARD, input: INPUT, t: th } = usePageTheme();
  const LABEL: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: th.textSub,
    display: 'block', marginBottom: 5,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  };
  const qc   = useQueryClient();
  const dateStr = date.toISOString().split('T')[0];

  const bookableSpaces = spaces.filter((s) => s.status === 'AVAILABLE');
  const defaultSpaceId = spaceId || bookableSpaces[0]?.id || '';

  const [form, setForm] = useState({
    space_id:   defaultSpaceId,
    start_date: dateStr,
    start_time: '09:00',
    end_date:   dateStr,
    end_time:   '10:00',
    attendees:  '1',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (spaceId) {
      setForm((f) => ({
        ...f,
        space_id: spaceId,
        start_date: dateStr,
        end_date: dateStr,
      }));
    }
  }, [spaceId, dateStr]);
  const setF = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => { const n = { ...e }; delete n[k]; return n; }); };

  const selectedSpace = bookableSpaces.find(s => s.id === form.space_id);
  const diffMs   = new Date(`${form.end_date}T${form.end_time}`).getTime() - new Date(`${form.start_date}T${form.start_time}`).getTime();
  const hours    = diffMs > 0 ? diffMs / 3600000 : 0;
  const price    = selectedSpace && hours > 0
    ? hours >= 720 && selectedSpace.price_per_month
      ? parseFloat(selectedSpace.price_per_month) * (hours / 720)
      : selectedSpace.price_per_day
        ? parseFloat(selectedSpace.price_per_day) * Math.ceil(hours / 24)
        : selectedSpace.price_per_hour
          ? parseFloat(selectedSpace.price_per_hour) * hours
          : 0
    : 0;

  const mutation = useMutation({
    mutationFn: (d: unknown) => bookingApi.create(d),
    onSuccess:  () => { message.success('Booking submitted for approval'); qc.invalidateQueries({ queryKey: ['calendar-bookings'] }); qc.invalidateQueries({ queryKey: ['bookings'] }); onClose(); },
    onError:    (err: ApiError) => { const m = err?.response?.data?.message ?? 'Failed'; message.error(Array.isArray(m) ? m.join(', ') : m); },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.space_id) e.space_id = 'Select a space';
    const s = new Date(`${form.start_date}T${form.start_time}`);
    const en = new Date(`${form.end_date}T${form.end_time}`);
    if (en <= s) e.end_time = 'Must be after start';
    if (isQatarWeekend(new Date(`${form.start_date}T12:00:00`))) e.start_date = 'Friday and Saturday are weekends in Qatar';
    if (isQatarWeekend(new Date(`${form.end_date}T12:00:00`))) e.end_date = 'Friday and Saturday are weekends in Qatar';
    if (Number(form.attendees) < 1) e.attendees = 'Min 1';
    if (selectedSpace && Number(form.attendees) > selectedSpace.capacity) e.attendees = `Max ${selectedSpace.capacity}`;
    return e;
  };

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    mutation.mutate({
      tenant_id:          tenantId,
      space_id:           form.space_id,
      created_by_user_id: userId,
      start_datetime:     new Date(`${form.start_date}T${form.start_time}`).toISOString(),
      end_datetime:       new Date(`${form.end_date}T${form.end_time}`).toISOString(),
      total_price:        price,
      attendee_count:     Number(form.attendees),
      currency:           selectedSpace?.currency ?? 'QAR',
    });
  };

  const currSym = selectedSpace?.currency === 'EUR' ? '€' : selectedSpace?.currency === 'GBP' ? '£' : '$';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...CARD, borderRadius: 18, width: '100%', maxWidth: 520, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#1e293b,#2563eb)', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarOutlined /> Quick Book
            </div>
            <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 2 }}>
              {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <CloseOutlined style={{ fontSize: 12 }} />
          </button>
        </div>

        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Space selector */}
          <div>
            <label style={LABEL}>Space <span style={{ color: '#ef4444' }}>*</span></label>
            <Select
              value={form.space_id || undefined}
              onChange={v => setF('space_id', v)}
              placeholder="Select a space..."
              style={{ width: '100%' }}
              options={bookableSpaces.map(s => ({
                value: s.id,
                label: `${s.name} · Cap: ${s.capacity} · ${s.type?.replace(/_/g,' ')}`,
              }))}
            />
            {errors.space_id && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.space_id}</div>}
            {selectedSpace && (
              <div style={{ marginTop: 8, background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#15803d', display: 'flex', gap: 14 }}>
                <span>👥 {selectedSpace.capacity} people</span>
                <span>📐 {selectedSpace.area_sqm}m²</span>
                {selectedSpace.price_per_hour && <span>💰 {currSym}{parseFloat(selectedSpace.price_per_hour)}/hr</span>}
                {selectedSpace.price_per_day  && <span>💰 {currSym}{parseFloat(selectedSpace.price_per_day)}/day</span>}
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Start Date</label>
              <input style={INPUT} type="date" value={form.start_date} onChange={e => setF('start_date', e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>Start Time</label>
              <input style={INPUT} type="time" value={form.start_time} onChange={e => setF('start_time', e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>End Date</label>
              <input style={INPUT} type="date" min={form.start_date} value={form.end_date} onChange={e => setF('end_date', e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>End Time</label>
              <input style={{ ...INPUT, borderColor: errors.end_time ? '#ef4444' : th.cardBorder }} type="time" value={form.end_time} onChange={e => setF('end_time', e.target.value)} />
              {errors.end_time && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.end_time}</div>}
            </div>
          </div>

          {/* Duration + Attendees */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Attendees</label>
              <input style={{ ...INPUT, borderColor: errors.attendees ? '#ef4444' : th.cardBorder }} type="number" min="1" max={selectedSpace?.capacity ?? 999} value={form.attendees} onChange={e => setF('attendees', e.target.value)} />
              {errors.attendees && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.attendees}</div>}
            </div>
            <div>
              <label style={LABEL}>Duration</label>
              <div style={{ ...INPUT, background: '#f8fafc', color: hours > 0 ? '#059669' : '#94a3b8', fontWeight: 700 }}>
                {hours > 0
                  ? hours < 24 ? `${hours.toFixed(1)}h` : `${(hours/24).toFixed(1)} days`
                  : '—'
                }
              </div>
            </div>
          </div>

          {/* Price summary */}
          <div style={{ background: price > 0 ? '#f0fdf4' : th.tableHead, border: `1px solid ${price > 0 ? '#bbf7d0' : th.cardBorder}`, borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: th.textSub }}>Estimated Price</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: price > 0 ? '#15803d' : '#94a3b8' }}>
              {price > 0 ? `${currSym}${price.toFixed(2)}` : '—'}
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 24px 22px', borderTop: `1px solid ${th.cardBorder}`, display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: th.text }}>Cancel</button>
          <button onClick={submit} disabled={mutation.isPending}
            style={{ flex: 2, padding: '11px', borderRadius: 10, background: mutation.isPending ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: mutation.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {mutation.isPending ? <><LoadingOutlined /> Creating...</> : <><PlusOutlined /> Confirm Booking</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Booking Detail Modal ─────────────────────────────────────────────────────
function BookingDetailModal({ booking, onClose }: { booking: any; onClose: () => void }) {
  const { card: CARD, btnSecondary, t: th } = usePageTheme();
  const qc       = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin  = ['SUPER_ADMIN','MANAGER'].includes(user?.role ?? '');
  const cfg      = STATUS_CFG[booking.status] ?? STATUS_CFG.DRAFT;

  const cancelMut = useMutation({
    mutationFn: () => bookingApi.cancel(booking.id),
    onSuccess:  () => { message.success('Booking cancelled'); qc.invalidateQueries({ queryKey: ['calendar-bookings'] }); onClose(); },
    onError:    () => message.error('Failed to cancel'),
  });
  const approveMut = useMutation({
    mutationFn: () => bookingApi.approve(booking.id, user?.id ?? ''),
    onSuccess:  () => { message.success('Booking approved! ✅'); qc.invalidateQueries({ queryKey: ['calendar-bookings'] }); onClose(); },
    onError: (err: ApiError) => {
      const m = err?.userMessage ?? err?.response?.data?.message ?? 'Failed to approve';
      message.error(Array.isArray(m) ? m[0] : m);
    },
  });

  const start = new Date(booking.start_datetime);
  const end   = new Date(booking.end_datetime);
  const hours = (end.getTime() - start.getTime()) / 3600000;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...CARD, borderRadius: 18, width: '100%', maxWidth: 460, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

        {/* Status header */}
        <div style={{ background: cfg.bg, padding: '18px 24px', borderBottom: `3px solid ${cfg.dot}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.dot, boxShadow: `0 0 8px ${cfg.dot}` }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: th.text, fontFamily: 'monospace' }}>{booking.booking_number}</div>
              <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.dot}33`, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>{cfg.label}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ ...btnSecondary, width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.textSub }}>
            <CloseOutlined style={{ fontSize: 12 }} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Space info */}
          <div style={{ background: th.tableHead, borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏢</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: th.text }}>{booking.space?.name ?? 'Space'}</div>
              <div style={{ fontSize: 12, color: th.textSub }}>{booking.space?.type?.replace(/_/g,' ')} · Cap: {booking.space?.capacity}</div>
            </div>
          </div>

          {/* Details grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: '📅 Start',      value: `${start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${fmtTime(start)}` },
              { label: '📅 End',        value: `${end.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${fmtTime(end)}` },
              { label: '⏱ Duration',   value: hours < 24 ? `${hours.toFixed(1)} hours` : `${(hours/24).toFixed(1)} days` },
              { label: '👥 Attendees',  value: `${booking.attendee_count ?? '—'} people` },
              { label: '💰 Price',      value: `$${parseFloat(booking.total_price || 0).toLocaleString()}` },
              ...(booking.tenant?.name ? [{ label: '🏢 Tenant', value: booking.tenant.name }] : []),
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${th.cardBorder}`, fontSize: 13 }}>
                <span style={{ color: th.textSub }}>{row.label}</span>
                <span style={{ fontWeight: 600, color: th.text }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            {isAdmin && booking.status === 'PENDING_APPROVAL' && (
              <button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}
                style={{ flex: 1, padding: '10px', borderRadius: 9, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {approveMut.isPending ? <LoadingOutlined /> : '✅'} Approve
              </button>
            )}
            {!['CANCELLED','COMPLETED'].includes(booking.status) && (
              <button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}
                style={{ flex: 1, padding: '10px', borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {cancelMut.isPending ? <LoadingOutlined /> : '✕'} Cancel
              </button>
            )}
            <button onClick={onClose} style={{ ...btnSecondary, flex: 1, padding: '10px' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────
function MonthView({ year, month, bookings, onDayClick, onBookingClick, today }: {
  year: number; month: number; bookings: any[];
  onDayClick: (d: Date) => void;
  onBookingClick: (b) => void;
  today: Date;
}) {
  const firstDay  = new Date(year, month, 1).getDay();
  const daysCount = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysCount }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad to complete grid
  while (cells.length % 7 !== 0) cells.push(null);

  const getBookingsForDay = (d: Date) =>
    bookings.filter(b => {
      const start = startOfDay(new Date(b.start_datetime));
      const end   = startOfDay(new Date(b.end_datetime));
      const day   = startOfDay(d);
      return day >= start && day <= end;
    });

  return (
    <div>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 2 }}>
        {DAYS.map((d, i) => (
          <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: i === 5 || i === 6 ? '#dc2626' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} style={{ minHeight: 100, background: '#fafafa', borderRadius: 8 }} />;

          const isToday  = sameDay(day, today);
          const isPast   = day < startOfDay(today);
          const isWeekend = isQatarWeekend(day);
          const dayBooks = getBookingsForDay(day);

          return (
            <div
              key={i}
              onClick={() => !isPast && !isWeekend && onDayClick(day)}
              style={{
                minHeight: 100, padding: '6px 8px', borderRadius: 10,
                background: isToday ? '#eff6ff' : isWeekend ? '#fef2f2' : isPast ? '#fafafa' : '#fff',
                border: `1.5px solid ${isToday ? '#2563eb' : isWeekend ? '#fecaca' : '#f1f5f9'}`,
                cursor: isPast || isWeekend ? 'default' : 'pointer',
                transition: 'all 0.12s',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isPast) e.currentTarget.style.borderColor = '#bfdbfe'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isToday ? '#2563eb' : '#f1f5f9'; }}
            >
              {/* Day number */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: isToday ? '#2563eb' : 'transparent',
                  color: isToday ? '#fff' : isPast ? '#cbd5e1' : '#0f172a',
                  fontSize: 13, fontWeight: isToday ? 800 : 400,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {day.getDate()}
                </span>
                {!isPast && !isWeekend && dayBooks.length === 0 && (
                  <span style={{ fontSize: 14, color: '#e5e7eb', opacity: 0 }} className="plus-hint">＋</span>
                )}
              </div>

              {/* Bookings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {dayBooks.slice(0, 3).map(b => {
                  const cfg = STATUS_CFG[b.status] ?? STATUS_CFG.DRAFT;
                  return (
                    <div
                      key={b.id}
                      onClick={e => { e.stopPropagation(); onBookingClick(b); }}
                      style={{
                        padding: '2px 6px', borderRadius: 5,
                        background: cfg.bg, color: cfg.color,
                        fontSize: 10, fontWeight: 700,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        cursor: 'pointer', transition: 'opacity 0.1s',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      title={`${b.space?.name ?? 'Space'} · ${fmtTime(new Date(b.start_datetime))}`}
                    >
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                      {b.space?.name ?? b.booking_number}
                    </div>
                  );
                })}
                {dayBooks.length > 3 && (
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, paddingLeft: 4 }}>
                    +{dayBooks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────
function WeekView({ weekStart, bookings, onDayClick, onBookingClick, today }: {
  weekStart: Date; bookings: any[];
  onDayClick: (d: Date) => void;
  onBookingClick: (b) => void;
  today: Date;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const getBookingsForDay = (d: Date) =>
    bookings.filter(b => {
      const start = startOfDay(new Date(b.start_datetime));
      const end   = startOfDay(new Date(b.end_datetime));
      const day   = startOfDay(d);
      return day >= start && day <= end;
    });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
      {days.map((day, i) => {
        const isToday  = sameDay(day, today);
        const isPast   = day < startOfDay(today);
        const isWeekend = isQatarWeekend(day);
        const dayBooks = getBookingsForDay(day);

        return (
          <div key={i}>
            {/* Day header */}
            <div style={{ textAlign: 'center', marginBottom: 8, padding: '8px 4px', borderRadius: 10, background: isToday ? '#2563eb' : isWeekend ? '#fef2f2' : '#f8fafc' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? '#bfdbfe' : isWeekend ? '#dc2626' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {DAYS[day.getDay()]}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isToday ? '#fff' : isPast ? '#cbd5e1' : '#0f172a' }}>
                {day.getDate()}
              </div>
              <div style={{ fontSize: 10, color: isToday ? '#93c5fd' : '#94a3b8' }}>
                {MONTHS[day.getMonth()].slice(0, 3)}
              </div>
            </div>

            {/* Bookings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 300 }}
              onClick={() => !isPast && !isWeekend && dayBooks.length === 0 && onDayClick(day)}>
              {dayBooks.map(b => {
                const cfg   = STATUS_CFG[b.status] ?? STATUS_CFG.DRAFT;
                const start = new Date(b.start_datetime);
                const end   = new Date(b.end_datetime);
                return (
                  <div key={b.id} onClick={e => { e.stopPropagation(); onBookingClick(b); }}
                    style={{ padding: '8px 10px', borderRadius: 9, background: cfg.bg, border: `1.5px solid ${cfg.dot}44`, cursor: 'pointer', transition: 'all 0.12s', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.space?.name ?? 'Space'}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                      {fmtTime(start)} – {fmtTime(end)}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontFamily: 'monospace' }}>{b.booking_number}</div>
                  </div>
                );
              })}
              {!isPast && !isWeekend && (
                <button onClick={() => onDayClick(day)}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1.5px dashed #e5e7eb', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.background = '#eff6ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}>
                  <PlusOutlined style={{ fontSize: 10 }} /> Book
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BookingCalendarPage() {
  const { card: CARD, headerCard, btnSecondary, t: th } = usePageTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();

  const isBackOffice = ['SUPER_ADMIN','MANAGER'].includes(user?.role ?? '');
  const tenantId     = (user as any)?.tenant_id ?? '';
  const userId       = user?.id ?? '';
  const basePath     = isBackOffice ? '/admin' : '/portal';

  const today = new Date();
  const [view,           setView]       = useState<'month' | 'week'>('month');
  const [currentDate,    setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [statusFilter,   setStatus]     = useState('');
  const [spaceFilter,    setSpaceFilter] = useState('');
  const [quickBookDate,  setQuickBook]  = useState<Date | null>(null);
  const [detailBooking,  setDetail]     = useState<any | null>(null);

  useEffect(() => {
    const preselect = searchParams.get('spaceId');
    if (!preselect) return;
    setSpaceFilter(preselect);
    setQuickBook(new Date());
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  // Week start
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [currentDate]);

  // Queries
  const { data: bookingsRaw, isLoading: loadingB } = useQuery({
    queryKey: ['calendar-bookings', isBackOffice ? 'all' : tenantId, statusFilter],
    queryFn:  () => bookingApi.getAll({
      ...(tenantId && !isBackOffice ? { tenantId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }).then(r => r.data),
  });
  const { data: spacesRaw } = useQuery({
    queryKey: ['calendar-spaces'],
    queryFn:  () => spaceApi.getAll(),
  });

  const allBookings = mapBookings(bookingsRaw);
  const allSpaces   = toArray<Space>(spacesRaw);

  // Filter by space
  const bookings = useMemo(() =>
    spaceFilter
      ? allBookings.filter(b => b.space_id === spaceFilter)
      : allBookings,
    [allBookings, spaceFilter],
  );

  // Stats
  const thisMonthBookings = bookings.filter(b => {
    const d = new Date(b.start_datetime);
    return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
  });

  // Navigate
  const prev = () => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      const d = new Date(weekStart);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    }
  };
  const next = () => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    }
  };
  const goToday = () => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const title = view === 'month'
    ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    : `${fmt(weekStart)} – ${fmt(new Date(weekStart.getTime() + 6 * 86400000))}`;

  return (
    <PageShell>

      {/* Modals */}
      {quickBookDate && (
        <QuickBookModal
          date={quickBookDate}
          spaceId={spaceFilter}
          spaces={allSpaces}
          onClose={() => setQuickBook(null)}
          tenantId={tenantId}
          userId={userId}
        />
      )}
      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          onClose={() => setDetail(null)}
        />
      )}

      {/* ── Header ── */}
      <div style={headerCard}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: th.text, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CalendarOutlined style={{ color: '#2563eb' }} /> Booking Calendar
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: th.textSub }}>
              Visual overview of all bookings · click a day to book · click a booking to view
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setQuickBook(today)}
              style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
              <PlusOutlined /> New Booking
            </button>
            <button onClick={() => navigate(`${basePath}/bookings`)}
              style={{ ...btnSecondary, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <UnorderedListOutlined /> List View
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {[
            { label: 'This Month',   value: thisMonthBookings.length,                                                              color: '#2563eb', bg: '#eff6ff' },
            { label: 'Confirmed',    value: thisMonthBookings.filter(b => b.status === 'CONFIRMED').length,                        color: '#059669', bg: '#f0fdf4' },
            { label: 'Pending',      value: thisMonthBookings.filter(b => b.status === 'PENDING_APPROVAL').length,                 color: '#d97706', bg: '#fffbeb' },
            { label: 'Checked In',   value: thisMonthBookings.filter(b => b.status === 'CHECKED_IN').length,                      color: '#1d4ed8', bg: '#dbeafe' },
            { label: 'Cancelled',    value: thisMonthBookings.filter(b => b.status === 'CANCELLED').length,                        color: '#dc2626', bg: '#fee2e2' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{loadingB ? '—' : s.value}</div>
              <div style={{ fontSize: 11, color: th.textSub, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>

        {/* Nav + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={prev} style={{ ...btnSecondary, width: 34, height: 34, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LeftOutlined style={{ fontSize: 12 }} />
          </button>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: th.text, minWidth: 200, textAlign: 'center' }}>{title}</h3>
          <button onClick={next} style={{ ...btnSecondary, width: 34, height: 34, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RightOutlined style={{ fontSize: 12 }} />
          </button>
          <button onClick={goToday} style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Today
          </button>
        </div>

        {/* Filters + view toggle */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            value={statusFilter || 'all'}
            onChange={v => setStatus(v === 'all' ? '' : v)}
            style={{ width: 150 }} size="small"
            options={[
              { value: 'all',              label: 'All Statuses'  },
              { value: 'CONFIRMED',        label: '✅ Confirmed'  },
              { value: 'PENDING_APPROVAL', label: '⏳ Pending'    },
              { value: 'CHECKED_IN',       label: '🔵 Checked In' },
              { value: 'COMPLETED',        label: '🟣 Completed'  },
              { value: 'CANCELLED',        label: '❌ Cancelled'  },
            ]}
          />
          <Select
            value={spaceFilter || 'all'}
            onChange={v => setSpaceFilter(v === 'all' ? '' : v)}
            style={{ width: 200 }} size="small"
            options={[
              { value: 'all', label: 'All Spaces' },
              ...allSpaces.map(s => ({ value: s.id, label: s.name })),
            ]}
          />

          {/* View toggle */}
          <div style={{ display: 'flex', border: `1px solid ${th.cardBorder}`, borderRadius: 9, overflow: 'hidden' }}>
            <button onClick={() => setView('month')}
              style={{ padding: '6px 14px', background: view === 'month' ? '#2563eb' : th.cardBg, color: view === 'month' ? '#fff' : th.textSub, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <AppstoreOutlined /> Month
            </button>
            <button onClick={() => setView('week')}
              style={{ padding: '6px 14px', background: view === 'week' ? '#2563eb' : th.cardBg, color: view === 'week' ? '#fff' : th.textSub, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <CalendarOutlined /> Week
            </button>
          </div>
        </div>
      </div>

      {/* ── Calendar ── */}
      <div style={CARD}>
        <div style={{ padding: '20px 24px' }}>
          {loadingB ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} style={{ minHeight: 100, background: '#f8fafc', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : view === 'month' ? (
            <MonthView
              year={currentDate.getFullYear()}
              month={currentDate.getMonth()}
              bookings={bookings}
              onDayClick={d => setQuickBook(d)}
              onBookingClick={b => setDetail(b)}
              today={today}
            />
          ) : (
            <WeekView
              weekStart={weekStart}
              bookings={bookings}
              onDayClick={d => setQuickBook(d)}
              onBookingClick={b => setDetail(b)}
              today={today}
            />
          )}
        </div>

        {/* Legend */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${th.cardBorder}`, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Legend:</span>
          {Object.entries(STATUS_CFG).map(([, cfg]) => (
            <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: th.textSub }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot }} />
              {cfg.label}
            </div>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: th.textMuted }}>
            Click any empty day to create a booking
          </span>
        </div>
      </div>
    </PageShell>
  );
}