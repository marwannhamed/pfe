import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, Skeleton, Badge } from 'antd';
import { message } from '../../utils/feedback';
import {
  ArrowLeftOutlined, EditOutlined, CalendarOutlined,
  EnvironmentOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ReloadOutlined, WarningOutlined, CloseOutlined,
  LoadingOutlined, PlusOutlined,
} from '@ant-design/icons';
import { spaceApi, bookingApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { SpaceStatus, SpaceType, SpaceFeature } from '../../types';
import { usePageTheme } from '../../hooks/usePageTheme';
import PageShell from '../../components/ui/PageShell';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<SpaceStatus, { label: string; bg: string; color: string }> = {
  AVAILABLE:      { label: 'Available',      bg: '#dcfce7', color: '#15803d' },
  OCCUPIED:       { label: 'Occupied',       bg: '#dbeafe', color: '#1d4ed8' },
  RESERVED:       { label: 'Reserved',       bg: '#fef3c7', color: '#92400e' },
  MAINTENANCE:    { label: 'Maintenance',    bg: '#fee2e2', color: '#b91c1c' },
  OUT_OF_SERVICE: { label: 'Out of Service', bg: '#f1f5f9', color: '#475569' },
};

const TYPE_META: Record<SpaceType, { label: string; icon: string }> = {
  DEDICATED_OFFICE: { label: 'Dedicated Office', icon: '🏢' },
  FLEXIBLE_DESK:    { label: 'Flexible Desk',    icon: '🪑' },
  HOT_DESK:         { label: 'Hot Desk',          icon: '💻' },
  MEETING_ROOM:     { label: 'Meeting Room',      icon: '📋' },
  CONFERENCE_ROOM:  { label: 'Conference Room',   icon: '🎯' },
  PHONE_BOOTH:      { label: 'Phone Booth',       icon: '📞' },
  EVENT_SPACE:      { label: 'Event Space',       icon: '🎪' },
};

const SPACE_IMAGES: Partial<Record<SpaceType, string>> = {
  DEDICATED_OFFICE: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/d0aeb9ee80-deaa17ab9c213523c203.png',
  MEETING_ROOM:     'https://storage.googleapis.com/uxpilot-auth.appspot.com/003f0a7ed6-51e10a5837f3a2b32d90.png',
  CONFERENCE_ROOM:  'https://storage.googleapis.com/uxpilot-auth.appspot.com/6dda684c29-c0b8088cdd8ac699d9dd.png',
  HOT_DESK:         'https://storage.googleapis.com/uxpilot-auth.appspot.com/0254182f08-a6d9808c18964b46ecef.png',
};

// ─── Price Calculator ─────────────────────────────────────────────────────────
function calcPrice(space: any, startDate: string, startTime: string, endDate: string, endTime: string): number {
  if (!space || !startDate || !endDate) return 0;
  const start   = new Date(`${startDate}T${startTime}`);
  const end     = new Date(`${endDate}T${endTime}`);
  const diffMs  = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  const hours = diffMs / 3600000;
  const days  = diffMs / 86400000;
  if (space.price_per_month && days >= 28)  return parseFloat(space.price_per_month) * (days / 30);
  if (space.price_per_day)                  return parseFloat(space.price_per_day) * Math.ceil(days);
  if (space.price_per_hour)                 return parseFloat(space.price_per_hour) * hours;
  return 0;
}

function getDuration(startDate: string, startTime: string, endDate: string, endTime: string): string {
  const diff = new Date(`${endDate}T${endTime}`).getTime() - new Date(`${startDate}T${startTime}`).getTime();
  if (diff <= 0) return '';
  const mins = diff / 60000;
  if (mins < 60)   return `${Math.round(mins)}min`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

// ─── Inline Booking Panel ─────────────────────────────────────────────────────
function InlineBookingPanel({ space, tenantId, userId, onClose, onSuccess }: {
  space: any;
  tenantId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { input: INPUT, t: th } = usePageTheme();
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    start_date: '',
    start_time: '09:00',
    end_date:   '',
    end_time:   '10:00',
    attendee_count: '1',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  const autoPrice = calcPrice(space, form.start_date, form.start_time, form.end_date, form.end_time);
  const currency  = space.currency ?? 'USD';
  const currSym   = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  const duration  = getDuration(form.start_date, form.start_time, form.end_date, form.end_time);

  const mutation = useMutation({
    mutationFn: (d: any) => bookingApi.create(d),
    onSuccess: () => {
      message.success('Booking created successfully!');
      qc.invalidateQueries({ queryKey: ['bookings'] });
      onSuccess();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to create booking';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.start_date) e.start_date = 'Required';
    if (!form.end_date)   e.end_date   = 'Required';
    const s = new Date(`${form.start_date}T${form.start_time}`);
    const en = new Date(`${form.end_date}T${form.end_time}`);
    if (form.start_date && form.end_date && en <= s) e.end_date = 'Must be after start';
    if (Number(form.attendee_count) < 1)  e.attendee_count = 'Min 1';
    if (Number(form.attendee_count) > space.capacity) e.attendee_count = `Max ${space.capacity}`;
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    mutation.mutate({
      tenant_id:          tenantId,
      space_id:           space.id,
      created_by_user_id: userId,
      start_datetime:     new Date(`${form.start_date}T${form.start_time}`).toISOString(),
      end_datetime:       new Date(`${form.end_date}T${form.end_time}`).toISOString(),
      total_price:        autoPrice,
      attendee_count:     Number(form.attendee_count),
      currency:           currency,
    });
  };

  return (
    <div style={{
      border: '2px solid #2563eb', borderRadius: 14,
      background: th.cardBg, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(37,99,235,0.12)',
      animation: 'slideDown 0.25s ease',
    }}>
      <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-12px) } to { opacity:1; transform:translateY(0) } }`}</style>

      {/* Panel header */}
      <div style={{ background: 'linear-gradient(135deg,#1e293b,#2563eb)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined /> Book This Space
          </div>
          <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 2 }}>
            {space.name} · Cap: {space.capacity} · {parseFloat(space.area_sqm).toFixed(0)} m²
          </div>
        </div>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <CloseOutlined style={{ fontSize: 12 }} />
        </button>
      </div>

      <div style={{ padding: '20px' }}>

        {/* Approval notice */}
        {space.requires_approval && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#92400e' }}>
            <WarningOutlined /> This space requires approval — your booking will be reviewed before confirmation.
          </div>
        )}

        {/* Date & Time */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>📅 Date & Time</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                Start Date <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                style={{ ...INPUT, borderColor: errors.start_date ? '#ef4444' : th.cardBorder }}
                type="date" min={today}
                value={form.start_date}
                onChange={e => setF('start_date', e.target.value)}
              />
              {errors.start_date && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{errors.start_date}</div>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Start Time</label>
              <input style={INPUT} type="time" value={form.start_time} onChange={e => setF('start_time', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                End Date <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                style={{ ...INPUT, borderColor: errors.end_date ? '#ef4444' : th.cardBorder }}
                type="date" min={form.start_date || today}
                value={form.end_date}
                onChange={e => setF('end_date', e.target.value)}
              />
              {errors.end_date && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{errors.end_date}</div>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>End Time</label>
              <input style={INPUT} type="time" value={form.end_time} onChange={e => setF('end_time', e.target.value)} />
            </div>
          </div>

          {/* Duration badge */}
          {duration && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
              ⏱ Duration: {duration}
            </div>
          )}
        </div>

        {/* Attendees */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
            Attendees <span style={{ color: '#ef4444' }}>*</span>
            <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>(max {space.capacity})</span>
          </label>
          <input
            style={{ ...INPUT, width: '50%', borderColor: errors.attendee_count ? '#ef4444' : th.cardBorder }}
            type="number" min="1" max={space.capacity}
            value={form.attendee_count}
            onChange={e => setF('attendee_count', e.target.value)}
          />
          {errors.attendee_count && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{errors.attendee_count}</div>}
        </div>

        {/* Price summary */}
        <div style={{
          background: autoPrice > 0 ? '#f0fdf4' : '#f8fafc',
          border: `1px solid ${autoPrice > 0 ? '#bbf7d0' : '#e5e7eb'}`,
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>💰 Price Summary</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {space.price_per_hour  && <div>Rate: {currSym}{parseFloat(space.price_per_hour)}/hr</div>}
              {space.price_per_day   && <div>Rate: {currSym}{parseFloat(space.price_per_day)}/day</div>}
              {space.price_per_month && <div>Rate: {currSym}{parseFloat(space.price_per_month)}/mo</div>}
              {!space.price_per_hour && !space.price_per_day && !space.price_per_month && (
                <div style={{ color: '#94a3b8' }}>No pricing set</div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: autoPrice > 0 ? '#15803d' : '#94a3b8' }}>
                {autoPrice > 0 ? `${currSym}${autoPrice.toFixed(2)}` : '—'}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>auto-calculated · {currency}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            style={{
              flex: 2, padding: '10px', borderRadius: 8,
              background: mutation.isPending ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)',
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: mutation.isPending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {mutation.isPending
              ? <><LoadingOutlined /> Creating Booking...</>
              : <><PlusOutlined /> Confirm Booking</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SpaceDetailPage() {
  const { card: CARD, headerCard, btnSecondary, t: th } = usePageTheme();
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  // ── Role checks ──
  const isAdmin      = !!(user?.role && ['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER'].includes(user.role));
  const isTenant     = !!(user?.role && ['TENANT_ADMIN', 'TENANT_EMPLOYEE'].includes(user.role));
  const tenantId     = (user as any)?.tenant_id ?? '';
  const userId       = user?.id ?? '';

  const backPath = isAdmin ? '/admin/spaces' : isAuthenticated ? '/portal/spaces' : '/spaces';

  // ── Booking panel state ──
  const [showBooking,  setShowBooking]  = useState(false);
  const [bookingDone,  setBookingDone]  = useState(false);

  const { data: space, isLoading, isError, refetch } = useQuery({
    queryKey: ['space', id],
    queryFn:  async () => {
      const res = await spaceApi.getOne(id!);
      return (res as { data?: unknown })?.data ?? res;
    },
    enabled:  !!id,
  });

  const handleBookSuccess = () => {
    setShowBooking(false);
    setBookingDone(true);
    setTimeout(() => setBookingDone(false), 5000);
  };

  if (isLoading) return (
    <PageShell>
      <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    </PageShell>
  );

  if (isError || !space) return (
    <PageShell>
      <div style={{ textAlign: 'center' }}>
        <WarningOutlined style={{ fontSize: 40, color: '#d97706', display: 'block', margin: '0 auto 12px' }} />
        <div style={{ fontWeight: 600, color: th.text, marginBottom: 8 }}>Failed to load space</div>
        <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Retry</button>
      </div>
    </PageShell>
  );

  const sm                = STATUS_META[space.status as SpaceStatus] ?? STATUS_META.AVAILABLE;
  const tm                = TYPE_META[space.type as SpaceType]       ?? TYPE_META.DEDICATED_OFFICE;
  const allFeatures       = (space.features ?? []) as SpaceFeature[];
  const availableFeatures = allFeatures.filter(f => f.is_available);
  const currSym           = space.currency === 'EUR' ? '€' : space.currency === 'GBP' ? '£' : '$';
  const canBook           = space.status === 'AVAILABLE' && isAuthenticated;

  return (
    <PageShell>

      {/* ── Success banner ── */}
      {bookingDone && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10,
          padding: '12px 18px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
          animation: 'slideDown 0.3s ease',
        }}>
          <CheckCircleOutlined style={{ color: '#15803d', fontSize: 18 }} />
          <div>
            <strong style={{ color: '#15803d' }}>Booking submitted!</strong>
            <span style={{ color: '#166534', marginLeft: 8 }}>
              {space.requires_approval ? 'Your request is pending approval.' : 'Your booking is confirmed.'}
            </span>
          </div>
          <button onClick={() => navigate('/portal/bookings')} style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 7, background: '#15803d', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            View My Bookings →
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div style={headerCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button
              onClick={() => navigate(backPath)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: th.textSub, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: 0, marginBottom: 10 }}
            >
              <ArrowLeftOutlined /> Back to Spaces
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                {tm.icon}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: th.text }}>{space.name}</h2>
                  <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{sm.label}</span>
                  {space.requires_approval && (
                    <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
                      Requires Approval
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: th.textSub, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace' }}>#{space.slug ?? space.code}</span>
                  <span>· {tm.label}</span>
                  {space.floor && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <EnvironmentOutlined style={{ fontSize: 11 }} />
                      Floor {space.floor.floor_number} — {space.floor.name}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => refetch()} style={{ ...btnSecondary, padding: '8px 12px', color: th.textSub }}>
              <ReloadOutlined />
            </button>

            {/* Admin-only: Edit button */}
            {isAdmin && (
              <button style={{ ...btnSecondary, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <EditOutlined /> Edit
              </button>
            )}

            {/* Tenant/authenticated: Book button — toggles inline form */}
            {canBook && isTenant && (
              <button
                onClick={() => { setShowBooking(v => !v); setBookingDone(false); }}
                style={{
                  padding: '9px 20px', borderRadius: 8,
                  background: showBooking ? '#f1f5f9' : 'linear-gradient(135deg,#1d4ed8,#2563eb)',
                  border: showBooking ? '1px solid #e5e7eb' : 'none',
                  color: showBooking ? '#374151' : '#fff',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: showBooking ? 'none' : '0 2px 8px rgba(37,99,235,0.3)',
                }}
              >
                {showBooking ? <><CloseOutlined /> Cancel</> : <><CalendarOutlined /> Book This Space</>}
              </button>
            )}

            {/* Not logged in */}
            {canBook && !isAuthenticated && (
              <button
                onClick={() => navigate('/register')}
                style={{ padding: '9px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
              >
                <CalendarOutlined /> Register to Book
              </button>
            )}
          </div>
        </div>

        {/* KPI bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 20 }}>
          {[
            { label: 'Monthly Rent', value: space.price_per_month ? `${currSym}${parseFloat(space.price_per_month).toLocaleString()}` : '—', sub: 'Per month',          color: '#2563eb', bg: '#eff6ff' },
            { label: 'Area',         value: `${parseFloat(space.area_sqm).toFixed(0)} m²`,                                                    sub: 'Square meters',     color: '#059669', bg: '#f0fdf4' },
            { label: 'Capacity',     value: space.capacity,                                                                                    sub: `${space.capacity === 1 ? 'person' : 'people'} max`, color: '#d97706', bg: '#fffbeb' },
            { label: 'Features',     value: availableFeatures.length,                                                                          sub: 'Available features', color: '#7c3aed', bg: '#f5f3ff' },
          ].map(k => (
            <div key={k.label} style={{ border: `1px solid ${th.cardBorder}`, borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: th.textSub }}>{k.label}</p>
              <p style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 800, color: th.text, lineHeight: 1 }}>{k.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: k.color }}>{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── INLINE BOOKING PANEL (tenant only, slides in below header) ── */}
      {showBooking && isTenant && (
        <div style={{ marginBottom: 20 }}>
          <InlineBookingPanel
            space={space}
            tenantId={tenantId}
            userId={userId}
            onClose={() => setShowBooking(false)}
            onSuccess={handleBookSuccess}
          />
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={CARD}>
        <Tabs
          defaultActiveKey="overview"
          style={{ padding: '0 24px' }}
          items={[

            // ── Overview ──────────────────────────────────────────
            {
              key: 'overview',
              label: 'Overview',
              children: (
                <div style={{ paddingBottom: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                    {/* Left */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ borderRadius: 12, overflow: 'hidden', height: 220 }}>
                        <img
                          src={SPACE_IMAGES[space.type as SpaceType] ?? 'https://storage.googleapis.com/uxpilot-auth.appspot.com/a2849fd28e-3c00d2788db35a7064dc.png'}
                          alt={space.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x220/1e293b/white?text=Office'; }}
                        />
                      </div>
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>
                          Features & Amenities ({availableFeatures.length})
                        </div>
                        {availableFeatures.length === 0 ? (
                          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>No features listed.</p>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {availableFeatures.map((f: SpaceFeature) => (
                              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                                <CheckCircleOutlined style={{ color: '#22c55e', fontSize: 13, flexShrink: 0 }} />
                                <span>{f.feature_name}</span>
                                {f.quantity > 1 && <span style={{ color: '#94a3b8', fontSize: 11 }}>×{f.quantity}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>Space Details</div>
                        {([
                          ['Code',     space.code],
                          ['Type',     tm.label],
                          ['Area',     `${parseFloat(space.area_sqm).toFixed(2)} m²`],
                          ['Capacity', `${space.capacity} people`],
                          ['Currency', space.currency],
                          ['Approval', space.requires_approval ? 'Required' : 'Not required'],
                          ['Floor',    space.floor ? `Floor ${space.floor.floor_number} — ${space.floor.name}` : 'N/A'],
                          ['Building', (space.floor as any)?.building?.name ?? 'N/A'],
                          ['Created',  new Date(space.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
                            <span style={{ color: '#64748b' }}>{k}</span>
                            <span style={{ fontWeight: 600, color: '#0f172a', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* Pricing card */}
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>Pricing</div>
                        {([
                          ['Hourly Rate',  space.price_per_hour  ? `${currSym}${parseFloat(space.price_per_hour).toLocaleString()}`  : '—'],
                          ['Daily Rate',   space.price_per_day   ? `${currSym}${parseFloat(space.price_per_day).toLocaleString()}`   : '—'],
                          ['Monthly Rate', space.price_per_month ? `${currSym}${parseFloat(space.price_per_month).toLocaleString()}` : '—'],
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
                            <span style={{ color: '#64748b' }}>{k}</span>
                            <span style={{ fontWeight: 700, color: v === '—' ? '#94a3b8' : '#0f172a', fontSize: v === '—' ? 13 : 16 }}>{v}</span>
                          </div>
                        ))}

                        <div style={{ marginTop: 14 }}>
                          {/* ── Tenant: toggle inline booking form ── */}
                          {canBook && isTenant && (
                            <button
                              onClick={() => { setShowBooking(v => !v); setBookingDone(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              style={{
                                width: '100%', padding: '12px', borderRadius: 9,
                                background: showBooking ? '#f1f5f9' : 'linear-gradient(135deg,#1d4ed8,#2563eb)',
                                border: showBooking ? '1px solid #e5e7eb' : 'none',
                                color: showBooking ? '#374151' : '#fff',
                                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                              }}
                            >
                              <CalendarOutlined style={{ marginRight: 6 }} />
                              {showBooking ? 'Cancel Booking' : 'Book This Space'}
                            </button>
                          )}

                          {/* ── Admin: no booking button ── */}
                          {isAdmin && (
                            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                              Bookings are managed by tenants
                            </div>
                          )}

                          {/* ── Not logged in ── */}
                          {!isAuthenticated && canBook && (
                            <button onClick={() => navigate('/register')} style={{ width: '100%', padding: '12px', borderRadius: 9, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                              <CalendarOutlined style={{ marginRight: 6 }} /> Register to Book
                            </button>
                          )}

                          {/* ── Not available ── */}
                          {space.status !== 'AVAILABLE' && (
                            <div style={{ padding: '10px 14px', background: sm.bg, borderRadius: 8, border: `1px solid ${sm.color}44`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                              <WarningOutlined style={{ color: sm.color }} />
                              <span style={{ fontWeight: 500, color: sm.color }}>Currently {sm.label} — not available</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ),
            },

            // ── Features tab ──────────────────────────────────────
            {
              key: 'features',
              label: <Badge count={availableFeatures.length} size="small" color="#059669">Features</Badge>,
              children: (
                <div style={{ paddingBottom: 24 }}>
                  {allFeatures.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
                      <CheckCircleOutlined style={{ fontSize: 36, display: 'block', margin: '0 auto 12px', color: '#e5e7eb' }} />
                      <p style={{ margin: 0, fontSize: 14 }}>No features added yet.</p>
                    </div>
                  ) : (
                    Array.from(new Set(allFeatures.map(f => f.feature_type).filter(Boolean))).map(featureType => {
                      const items = allFeatures.filter(f => f.feature_type === featureType);
                      const label = String(featureType).replace(/_/g, ' ').toLowerCase();
                      return (
                        <div key={featureType} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 14 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12, textTransform: 'capitalize' }}>
                            {label}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                            {items.map((f: SpaceFeature) => (
                              <div
                                key={f.id}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: f.is_available ? '#f0fdf4' : '#f8fafc', borderRadius: 8, border: `1px solid ${f.is_available ? '#bbf7d0' : '#e5e7eb'}` }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {f.is_available
                                    ? <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 13 }} />
                                    : <ClockCircleOutlined style={{ color: '#94a3b8', fontSize: 13 }} />
                                  }
                                  <span style={{ fontSize: 13, color: f.is_available ? '#0f172a' : '#94a3b8', fontWeight: 500 }}>
                                    {f.feature_name}
                                  </span>
                                </div>
                                {f.quantity > 1 && (
                                  <span style={{ fontSize: 11, background: '#e5e7eb', color: '#64748b', padding: '1px 6px', borderRadius: 10 }}>
                                    ×{f.quantity}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </PageShell>
  );
}