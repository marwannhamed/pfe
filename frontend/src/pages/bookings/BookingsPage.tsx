import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Input, Select, Skeleton, Empty, message } from 'antd';
import {
  SearchOutlined, PlusOutlined, ReloadOutlined,
  CalendarOutlined, TeamOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, EnvironmentOutlined,
  DownloadOutlined, EyeOutlined, CloseOutlined, LoadingOutlined,
  DeleteOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { bookingApi, spaceApi, siteApi, buildingApi, floorApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Booking, BookingStatus, Space, Site, Building, Floor } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<BookingStatus, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  DRAFT:            { label: 'Draft',            bg: '#f1f5f9', color: '#475569', icon: <ClockCircleOutlined />  },
  PENDING_APPROVAL: { label: 'Pending Approval', bg: '#fef3c7', color: '#92400e', icon: <ClockCircleOutlined />  },
  CONFIRMED:        { label: 'Confirmed',        bg: '#dcfce7', color: '#15803d', icon: <CheckCircleOutlined />  },
  CHECKED_IN:       { label: 'Checked In',       bg: '#dbeafe', color: '#1d4ed8', icon: <CheckCircleOutlined />  },
  COMPLETED:        { label: 'Completed',        bg: '#ede9fe', color: '#6d28d9', icon: <CheckCircleOutlined />  },
  CANCELLED:        { label: 'Cancelled',        bg: '#fee2e2', color: '#b91c1c', icon: <CloseCircleOutlined />  },
  NO_SHOW:          { label: 'No Show',          bg: '#fef3c7', color: '#b45309', icon: <CloseCircleOutlined />  },
};

const CONTRACT_ELIGIBLE = ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'];

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function getDuration(start: string, end: string): string {
  const diff = Math.abs(new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (diff < 60)   return `${Math.round(diff)}min`;
  if (diff < 1440) return `${Math.round(diff / 60)}h`;
  return `${Math.round(diff / 1440)}d`;
}
function toArray<T>(raw: any): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}
function calcPrice(space: Space | undefined, startDate: string, startTime: string, endDate: string, endTime: string): number {
  if (!space || !startDate || !endDate) return 0;
  const start = new Date(`${startDate}T${startTime}`);
  const end   = new Date(`${endDate}T${endTime}`);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  const diffHours = diffMs / 3600000;
  const diffDays  = diffMs / 86400000;
  if (space.price_per_month && diffDays >= 28) return parseFloat(space.price_per_month) * (diffDays / 30);
  if (space.price_per_day)  return parseFloat(space.price_per_day) * Math.ceil(diffDays);
  if (space.price_per_hour) return parseFloat(space.price_per_hour) * diffHours;
  return 0;
}

const CARD: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const INPUT: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#0f172a', outline: 'none', background: '#fff', boxSizing: 'border-box' };
const LABEL: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };

function Field({ label, required, children, error }: { label: string; required?: boolean; children: React.ReactNode; error?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={LABEL}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{error}</span>}
    </div>
  );
}

// ─── New Booking Modal ────────────────────────────────────────────────────────
function NewBookingModal({ onClose, tenantId, userId }: { onClose: () => void; tenantId: string; userId: string }) {
  const qc = useQueryClient();
  const [selectedSiteId,     setSelectedSiteId]     = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedFloorId,    setSelectedFloorId]    = useState('');
  const [selectedSpaceId,    setSelectedSpaceId]    = useState('');
  const [form, setForm] = useState({ start_date: '', start_time: '09:00', end_date: '', end_time: '10:00', attendee_count: '1', currency: 'USD' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => { const n = { ...e }; delete n[k]; return n; }); };

  const { data: sitesRaw }    = useQuery({ queryKey: ['sites-bk'],    queryFn: () => siteApi.getAll().then(r => r.data), staleTime: 0 });
  const { data: buildingsRaw, isLoading: loadingB } = useQuery({ queryKey: ['buildings-bk', selectedSiteId],  queryFn: () => buildingApi.getAll(selectedSiteId).then(r => r.data),          enabled: !!selectedSiteId,     staleTime: 0, gcTime: 0 });
  const { data: floorsRaw,    isLoading: loadingF } = useQuery({ queryKey: ['floors-bk', selectedBuildingId], queryFn: () => floorApi.getAll(selectedBuildingId).then(r => r.data),          enabled: !!selectedBuildingId, staleTime: 0, gcTime: 0 });
  const { data: spacesRaw,    isLoading: loadingS } = useQuery({ queryKey: ['spaces-bk', selectedFloorId],    queryFn: () => spaceApi.getAll({ floorId: selectedFloorId }).then(r => r.data), enabled: !!selectedFloorId,    staleTime: 0, gcTime: 0 });

  const sites     = toArray<Site>(sitesRaw);
  const buildings = toArray<Building>(buildingsRaw);
  const floors    = toArray<Floor>(floorsRaw);
  const spaces    = toArray<Space>(spacesRaw).filter((s: Space) => s.status === 'AVAILABLE');
  const selectedSpace = spaces.find(s => s.id === selectedSpaceId);
  const autoPrice = calcPrice(selectedSpace, form.start_date, form.start_time, form.end_date, form.end_time);

  useEffect(() => { if (selectedSpace?.currency) setF('currency', selectedSpace.currency); }, [selectedSpace?.id]);

  const mutation = useMutation({
    mutationFn: (d: any) => bookingApi.create(d),
    onSuccess: () => { message.success('Booking created!'); qc.invalidateQueries({ queryKey: ['bookings'] }); onClose(); },
    onError:   (err: any) => { const msg = err?.response?.data?.message ?? 'Failed'; message.error(Array.isArray(msg) ? msg.join(', ') : msg); },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!selectedSpaceId) e.space = 'Please select a space';
    if (!form.start_date) e.start_date = 'Required';
    if (!form.end_date)   e.end_date   = 'Required';
    if (new Date(`${form.end_date}T${form.end_time}`) <= new Date(`${form.start_date}T${form.start_time}`)) e.end_date = 'Must be after start';
    if (Number(form.attendee_count) < 1) e.attendee_count = 'Min 1';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    mutation.mutate({
      tenant_id: tenantId, space_id: selectedSpaceId, created_by_user_id: userId,
      start_datetime: new Date(`${form.start_date}T${form.start_time}`).toISOString(),
      end_datetime:   new Date(`${form.end_date}T${form.end_time}`).toISOString(),
      total_price: autoPrice, attendee_count: Number(form.attendee_count), currency: form.currency,
    });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
          <div><h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>New Booking</h2><p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Reserve a space</p></div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><CloseOutlined style={{ fontSize: 13 }} /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>📍 Site → Building → Floor → Space</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <Field label="Site" required><Select value={selectedSiteId || undefined} onChange={v => { setSelectedSiteId(v); setSelectedBuildingId(''); setSelectedFloorId(''); setSelectedSpaceId(''); }} placeholder="Select site..." style={{ width: '100%' }} options={sites.map(s => ({ value: s.id, label: `${s.name} (${s.city})` }))} /></Field>
              <Field label="Building" required><Select loading={loadingB} value={selectedBuildingId || undefined} onChange={v => { setSelectedBuildingId(v); setSelectedFloorId(''); setSelectedSpaceId(''); }} placeholder={selectedSiteId ? 'Select building...' : 'Select site first'} disabled={!selectedSiteId} style={{ width: '100%' }} options={buildings.map(b => ({ value: b.id, label: b.name }))} /></Field>
              <Field label="Floor" required><Select loading={loadingF} value={selectedFloorId || undefined} onChange={v => { setSelectedFloorId(v); setSelectedSpaceId(''); }} placeholder={selectedBuildingId ? 'Select floor...' : 'Select building first'} disabled={!selectedBuildingId} style={{ width: '100%' }} options={floors.map(f => ({ value: f.id, label: `Floor ${f.floor_number} — ${f.name}` }))} /></Field>
              <Field label="Space" required error={errors.space}><Select loading={loadingS} value={selectedSpaceId || undefined} onChange={v => { setSelectedSpaceId(v); setErrors(e => { const n = { ...e }; delete n.space; return n; }); }} placeholder={selectedFloorId ? 'Select space...' : 'Select floor first'} disabled={!selectedFloorId} style={{ width: '100%' }} options={spaces.map(s => ({ value: s.id, label: `${s.name} (cap: ${s.capacity})` }))} notFoundContent="No available spaces" /></Field>
            </div>
            {selectedSpace && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 16, fontSize: 12, color: '#1d4ed8', flexWrap: 'wrap' }}>
                <span>🏢 {selectedSpace.name}</span><span>👥 Cap: {selectedSpace.capacity}</span>
                {selectedSpace.price_per_hour  && <span>💰 ${parseFloat(selectedSpace.price_per_hour)}/hr</span>}
                {selectedSpace.price_per_day   && <span>💰 ${parseFloat(selectedSpace.price_per_day)}/day</span>}
                {selectedSpace.price_per_month && <span>💰 ${parseFloat(selectedSpace.price_per_month)}/mo</span>}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>📅 Date & Time</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
              <Field label="Start Date" required error={errors.start_date}><input style={{ ...INPUT, borderColor: errors.start_date ? '#ef4444' : '#e5e7eb' }} type="date" min={today} value={form.start_date} onChange={e => setF('start_date', e.target.value)} /></Field>
              <Field label="Start Time" required><input style={INPUT} type="time" value={form.start_time} onChange={e => setF('start_time', e.target.value)} /></Field>
              <Field label="End Date" required error={errors.end_date}><input style={{ ...INPUT, borderColor: errors.end_date ? '#ef4444' : '#e5e7eb' }} type="date" min={form.start_date || today} value={form.end_date} onChange={e => setF('end_date', e.target.value)} /></Field>
              <Field label="End Time" required><input style={INPUT} type="time" value={form.end_time} onChange={e => setF('end_time', e.target.value)} /></Field>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <Field label="Attendees" required error={errors.attendee_count}><input style={{ ...INPUT, borderColor: errors.attendee_count ? '#ef4444' : '#e5e7eb' }} type="number" min="1" max={selectedSpace?.capacity ?? 999} value={form.attendee_count} onChange={e => setF('attendee_count', e.target.value)} /></Field>
              <Field label="Total Price">
                <div style={{ ...INPUT, background: '#f8fafc', display: 'flex', alignItems: 'center', cursor: 'default' }}>
                  <span style={{ fontWeight: 700, color: autoPrice > 0 ? '#0f172a' : '#94a3b8' }}>{autoPrice > 0 ? `${form.currency} ${autoPrice.toFixed(2)}` : '—'}</span>
                  {autoPrice > 0 && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 'auto' }}>auto</span>}
                </div>
              </Field>
              <Field label="Currency"><Select value={form.currency} onChange={v => setF('currency', v)} style={{ width: '100%' }} options={['USD','EUR','GBP','AED','TND'].map(c => ({ value: c, label: c }))} /></Field>
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff', borderRadius: '0 0 16px 16px' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={mutation.isPending} style={{ padding: '9px 22px', borderRadius: 8, background: mutation.isPending ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: mutation.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {mutation.isPending ? <><LoadingOutlined /> Creating...</> : <><PlusOutlined /> Create Booking</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Booking Detail Modal ─────────────────────────────────────────────────────
function BookingDetailModal({ booking, onClose, canManage, userId, onCreateContract }: {
  booking: Booking | null; onClose: () => void;
  canManage: boolean; userId: string;
  onCreateContract: (b: Booking) => void;
}) {
  const qc = useQueryClient();
  const approveMut  = useMutation({ mutationFn: (id: string) => bookingApi.approve(id, userId), onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Approved!');    onClose(); }, onError: () => message.error('Failed') });
  const cancelMut   = useMutation({ mutationFn: (id: string) => bookingApi.cancel(id),          onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Cancelled');   onClose(); }, onError: () => message.error('Failed') });
  const checkInMut  = useMutation({ mutationFn: (id: string) => bookingApi.checkIn(id),         onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Checked in!'); onClose(); }, onError: () => message.error('Failed') });
  const checkOutMut = useMutation({ mutationFn: (id: string) => bookingApi.checkOut(id),        onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Checked out!');onClose(); }, onError: () => message.error('Failed') });

  if (!booking) return null;
  const sm          = STATUS_META[booking.status] ?? STATUS_META.DRAFT;
  const spaceName   = (booking as any).space?.name ?? `Space ${booking.space_id.substring(0, 8)}`;
  const canCancel   = !['CANCELLED','COMPLETED','NO_SHOW'].includes(booking.status);
  const isPending   = approveMut.isPending || cancelMut.isPending || checkInMut.isPending || checkOutMut.isPending;
  const canContract = canManage && CONTRACT_ELIGIBLE.includes(booking.status);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Booking Details</h2>
            <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{sm.label}</span>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><CloseOutlined style={{ fontSize: 13 }} /></button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏢</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{spaceName}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{(booking as any).space?.type?.replace(/_/g,' ') ?? 'Office Space'}</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>${parseFloat(booking.total_price).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{booking.currency}</div>
            </div>
          </div>
          {canContract && (
            <div style={{ background: 'linear-gradient(135deg,#1e40af,#2563eb)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileTextOutlined style={{ color: '#fff', fontSize: 18 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>Ready to create a lease contract?</div>
                <div style={{ fontSize: 11, color: '#bfdbfe', marginTop: 2 }}>Booking <strong style={{ color: '#fff' }}>{booking.booking_number}</strong> · Dates & tenant will be pre-filled</div>
              </div>
              <button onClick={() => { onClose(); onCreateContract(booking); }} style={{ padding: '8px 16px', borderRadius: 8, background: '#fff', border: 'none', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                📋 Create Contract
              </button>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {([
              ['Booking #',   booking.booking_number],
              ['Start',       formatDateTime(booking.start_datetime)],
              ['End',         formatDateTime(booking.end_datetime)],
              ['Duration',    getDuration(booking.start_datetime, booking.end_datetime)],
              ['Attendees',   `${booking.attendee_count} ${booking.attendee_count === 1 ? 'person' : 'people'}`],
              ['Created',     formatDate(booking.created_at)],
              ...(booking.checked_in_at  ? [['Checked In',  formatDateTime(booking.checked_in_at)]]  as [string,string][] : []),
              ...(booking.checked_out_at ? [['Checked Out', formatDateTime(booking.checked_out_at)]] as [string,string][] : []),
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ fontWeight: 600, color: '#0f172a', fontFamily: k === 'Booking #' ? 'monospace' : undefined }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
            {canManage && booking.status === 'PENDING_APPROVAL' && (
              <button onClick={() => approveMut.mutate(booking.id)} disabled={isPending} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {approveMut.isPending ? <LoadingOutlined /> : <CheckCircleOutlined />} Approve
              </button>
            )}
            {booking.status === 'CONFIRMED' && (
              <button onClick={() => checkInMut.mutate(booking.id)} disabled={isPending} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {checkInMut.isPending ? <LoadingOutlined /> : <CheckCircleOutlined />} Check In
              </button>
            )}
            {booking.status === 'CHECKED_IN' && (
              <button onClick={() => checkOutMut.mutate(booking.id)} disabled={isPending} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {checkOutMut.isPending ? <LoadingOutlined /> : <CloseCircleOutlined />} Check Out
              </button>
            )}
            {canCancel && (
              <button onClick={() => { if (window.confirm(`Cancel booking ${booking.booking_number}?`)) cancelMut.mutate(booking.id); }} disabled={isPending} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer' }}>
                {cancelMut.isPending ? 'Cancelling...' : 'Cancel Booking'}
              </button>
            )}
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BookingsPage() {
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const tenantId      = (user as any)?.tenant_id ?? '';
  const userId        = user?.id ?? '';
  const canManage     = !!(user?.role && ['SUPER_ADMIN', 'SITE_MANAGER'].includes(user.role));
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';
  const isEmployee    = user?.role === 'EMPLOYEE';
  const isBackOffice  = ['SUPER_ADMIN', 'SITE_MANAGER', 'FINANCE', 'MAINTENANCE'].includes(user?.role ?? '');
  const basePath      = isBackOffice ? '/admin' : '/portal';

  const [q,          setQ]        = useState('');
  const [statusFilt, setStatus]   = useState('');
  const [newOpen,    setNew]      = useState(false);
  const [selected,   setSelected] = useState<Booking | null>(null);
  const [view,       setView]     = useState<'table' | 'timeline'>('table');

  const { data: bookingsRaw = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['bookings', canManage ? 'all' : isTenantAdmin ? tenantId : userId],
    queryFn:  () => bookingApi.getAll({
      ...(isTenantAdmin && tenantId ? { tenantId }          : {}),
      ...(isEmployee                ? { createdBy: userId } : {}),
    }).then(r => r.data),
  });
  const bookings: Booking[] = toArray(bookingsRaw);

  const cancelMut  = useMutation({ mutationFn: (id: string) => bookingApi.cancel(id),          onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Cancelled'); } });
  const approveMut = useMutation({ mutationFn: (id: string) => bookingApi.approve(id, userId), onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Approved!'); }, onError: () => message.error('Failed') });
  const deleteMut  = useMutation({ mutationFn: (id: string) => bookingApi.remove(id),          onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Deleted'); },  onError: () => message.error('Failed') });

  const handleCreateContract = (booking: Booking) => {
    message.info('Opening contract form pre-filled from this booking...', 2);
    navigate('/admin/contracts', {
      state: {
        fromBooking: {
          tenant_id:      booking.tenant_id,
          start_date:     booking.start_datetime.split('T')[0],
          end_date:       booking.end_datetime.split('T')[0],
          currency:       booking.currency,
          space_name:     (booking as any).space?.name ?? '',
          booking_number: booking.booking_number,
        },
      },
    });
  };

  const filtered = bookings.filter(b => {
    if (statusFilt && b.status !== statusFilt) return false;
    if (q) {
      const name = (b as any).space?.name ?? '';
      if (!name.toLowerCase().includes(q.toLowerCase()) && !b.booking_number.toLowerCase().includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const confirmed = bookings.filter(b => b.status === 'CONFIRMED').length;
  const pending   = bookings.filter(b => b.status === 'PENDING_APPROVAL').length;
  const checkedIn = bookings.filter(b => b.status === 'CHECKED_IN').length;
  const completed = bookings.filter(b => b.status === 'COMPLETED').length;
  const cancelled = bookings.filter(b => b.status === 'CANCELLED').length;

  const byDate = filtered.reduce((acc: Record<string, Booking[]>, b) => {
    const date = new Date(b.start_datetime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(b);
    return acc;
  }, {});

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {newOpen && <NewBookingModal onClose={() => setNew(false)} tenantId={tenantId} userId={userId} />}
      <BookingDetailModal booking={selected} onClose={() => setSelected(null)} canManage={canManage} userId={userId} onCreateContract={handleCreateContract} />

      {/* Header */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
              {canManage ? 'All Bookings' : isTenantAdmin ? 'Bookings' : 'My Bookings'}
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
              {canManage ? 'All reservations across every tenant' : isTenantAdmin ? 'Your company reservations' : 'Your personal reservations'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => refetch()} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}><ReloadOutlined /></button>
            <button style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}><DownloadOutlined /> Export</button>
            {/* ✅ Calendar View button */}
            <button
              onClick={() => navigate(`${basePath}/bookings/calendar`)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #2563eb', background: '#eff6ff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <CalendarOutlined /> Calendar View
            </button>
            {canManage && (
              <button onClick={() => setNew(true)} style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
                <PlusOutlined /> New Booking
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
          {[
            { label: 'Total',      value: bookings.length, color: '#2563eb', bg: '#eff6ff', icon: '📅' },
            { label: 'Confirmed',  value: confirmed,       color: '#059669', bg: '#f0fdf4', icon: '✅' },
            { label: 'Pending',    value: pending,         color: '#d97706', bg: '#fffbeb', icon: '⏳' },
            { label: 'Checked In', value: checkedIn,       color: '#1d4ed8', bg: '#dbeafe', icon: '🔑' },
            { label: 'Completed',  value: completed,       color: '#7c3aed', bg: '#f5f3ff', icon: '🎯' },
            { label: 'Cancelled',  value: cancelled,       color: '#dc2626', bg: '#fef2f2', icon: '❌' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ margin: '0 0 2px', fontSize: 10, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
              <p style={{ margin: '0 0 1px', fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{isLoading ? '—' : s.value}</p>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: s.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, marginTop: 4 }}>{s.icon}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} placeholder="Search by booking # or space..." value={q} onChange={e => setQ(e.target.value)} style={{ width: 260, borderRadius: 8 }} />
        <Select value={statusFilt || 'all'} onChange={v => setStatus(v === 'all' ? '' : v)} style={{ width: 190 }} options={[
          { value: 'all',              label: 'All Status'         },
          { value: 'CONFIRMED',        label: '✅ Confirmed'        },
          { value: 'PENDING_APPROVAL', label: '⏳ Pending Approval' },
          { value: 'CHECKED_IN',       label: '🔑 Checked In'      },
          { value: 'COMPLETED',        label: '🎯 Completed'       },
          { value: 'CANCELLED',        label: '❌ Cancelled'       },
          { value: 'DRAFT',            label: '📝 Draft'           },
        ]} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>Showing <strong style={{ color: '#0f172a' }}>{filtered.length}</strong> of {bookings.length}</span>
          <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('table')}    style={{ padding: '7px 14px', background: view === 'table'    ? '#2563eb' : '#fff', color: view === 'table'    ? '#fff' : '#64748b', border: 'none', cursor: 'pointer', fontSize: 12 }}>☰ List</button>
            <button onClick={() => setView('timeline')} style={{ padding: '7px 14px', background: view === 'timeline' ? '#2563eb' : '#fff', color: view === 'timeline' ? '#fff' : '#64748b', border: 'none', cursor: 'pointer', fontSize: 12 }}>📅 Timeline</button>
          </div>
        </div>
      </div>

      {isError && <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}><div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div><div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load</div><button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Retry</button></div>}
      {isLoading && <div style={CARD}>{Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ padding: '16px 20px', borderBottom: i < 4 ? '1px solid #f8fafc' : 'none' }}><Skeleton active paragraph={{ rows: 1 }} /></div>)}</div>}

      {!isLoading && !isError && filtered.length === 0 && (
        <div style={{ ...CARD, padding: '60px', textAlign: 'center' }}>
          <CalendarOutlined style={{ fontSize: 48, color: '#e5e7eb', display: 'block', margin: '0 auto 16px' }} />
          <Empty description={bookings.length === 0 ? (canManage ? 'No bookings yet.' : 'No bookings yet — browse a space to book!') : 'No bookings match your filters.'} />
        </div>
      )}

      {/* TABLE VIEW */}
      {!isLoading && !isError && filtered.length > 0 && view === 'table' && (
        <div style={{ ...CARD, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1.8fr 0.8fr 0.7fr 1.2fr 1.4fr', padding: '11px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Booking #</span><span>Space</span><span>Date & Time</span><span>Duration</span><span>People</span><span>Status</span><span>Actions</span>
          </div>
          {filtered.map((b: Booking, i: number) => {
            const sm        = STATUS_META[b.status] ?? STATUS_META.DRAFT;
            const spaceName = (b as any).space?.name ?? `Space ${b.space_id.substring(0,6)}`;
            const canCancel = !['CANCELLED','COMPLETED','NO_SHOW'].includes(b.status);
            const isEligible = CONTRACT_ELIGIBLE.includes(b.status);
            return (
              <div key={b.id}
                style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1.8fr 0.8fr 0.7fr 1.2fr 1.4fr', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{b.booking_number}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{formatDate(b.created_at)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><EnvironmentOutlined style={{ color: '#2563eb', fontSize: 13 }} /></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{spaceName}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{(b as any).space?.type?.replace(/_/g,' ') ?? '—'}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#374151' }}>{new Date(b.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(b.start_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} → {new Date(b.end_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{getDuration(b.start_datetime, b.end_datetime)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#374151' }}><TeamOutlined style={{ fontSize: 11, color: '#94a3b8' }} /> {b.attendee_count}</div>
                <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  {sm.icon} {sm.label}
                </span>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => setSelected(b)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="View"><EyeOutlined style={{ fontSize: 12, color: '#64748b' }} /></button>
                  {canManage && b.status === 'PENDING_APPROVAL' && (
                    <button onClick={() => approveMut.mutate(b.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Approve"><CheckCircleOutlined style={{ fontSize: 12, color: '#15803d' }} /></button>
                  )}
                  {canManage && isEligible && (
                    <button onClick={() => handleCreateContract(b)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #2563eb', background: '#eff6ff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Create contract"><FileTextOutlined style={{ fontSize: 12, color: '#2563eb' }} /></button>
                  )}
                  {canCancel && (
                    <button onClick={() => { if (window.confirm(`Cancel ${b.booking_number}?`)) cancelMut.mutate(b.id); }} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Cancel"><CloseCircleOutlined style={{ fontSize: 12, color: '#dc2626' }} /></button>
                  )}
                  {canManage && (
                    <button onClick={() => { if (window.confirm(`Delete ${b.booking_number}?`)) deleteMut.mutate(b.id); }} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete"><DeleteOutlined style={{ fontSize: 12, color: '#dc2626' }} /></button>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
            <span>Showing {filtered.length} of {bookings.length} bookings</span>
            <span>{confirmed} confirmed · {pending} pending · {checkedIn} checked in</span>
          </div>
        </div>
      )}

      {/* TIMELINE VIEW */}
      {!isLoading && !isError && filtered.length > 0 && view === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(byDate).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime()).map(([date, dayBookings]) => (
            <div key={date}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{date}</div>
                <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{dayBookings.length} booking{dayBookings.length > 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dayBookings.map((b: Booking) => {
                  const sm        = STATUS_META[b.status] ?? STATUS_META.DRAFT;
                  const spaceName = (b as any).space?.name ?? 'Space';
                  const isEligible = CONTRACT_ELIGIBLE.includes(b.status);
                  return (
                    <div key={b.id} style={{ ...CARD, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                      onClick={() => setSelected(b)}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}>
                      <div style={{ width: 72, textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{new Date(b.start_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{getDuration(b.start_datetime, b.end_datetime)}</div>
                      </div>
                      <div style={{ width: 4, height: 48, borderRadius: 2, background: sm.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: 3 }}>{spaceName}</div>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 10 }}>
                          <span style={{ fontFamily: 'monospace' }}>{b.booking_number}</span>
                          <span><TeamOutlined style={{ fontSize: 11, marginRight: 3 }} />{b.attendee_count}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-block', marginBottom: 4 }}>{sm.label}</span>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>${parseFloat(b.total_price).toLocaleString()}</div>
                      </div>
                      {canManage && b.status === 'PENDING_APPROVAL' && (
                        <button onClick={e => { e.stopPropagation(); approveMut.mutate(b.id); }} style={{ padding: '6px 12px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                          <CheckCircleOutlined style={{ marginRight: 4 }} /> Approve
                        </button>
                      )}
                      {canManage && isEligible && (
                        <button onClick={e => { e.stopPropagation(); handleCreateContract(b); }} style={{ padding: '6px 12px', borderRadius: 7, background: '#eff6ff', border: '1px solid #2563eb', color: '#2563eb', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FileTextOutlined /> Contract
                        </button>
                      )}
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