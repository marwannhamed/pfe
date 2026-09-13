import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePageTheme } from '../../hooks/usePageTheme';
import { useNavigate } from 'react-router-dom';
import { Input, Select, Skeleton, Empty, Alert, Button } from 'antd';
import { message } from '../../utils/feedback';
import { mapBooking, mapBookings } from '../../utils/booking';
import { prefillFromBooking } from '../../utils/contractFromBooking';
import {
  SearchOutlined, PlusOutlined, ReloadOutlined,
  CalendarOutlined, TeamOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, EnvironmentOutlined,
  DownloadOutlined, EyeOutlined, CloseOutlined, LoadingOutlined,
  DeleteOutlined, FileTextOutlined, PhoneOutlined,
} from '@ant-design/icons';
import { bookingApi, bookingApplicationApi, spaceApi, buildingApi, floorApi, addonServiceApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { ApiError, Booking, BookingStatus, Building, Floor, Space } from '../../types';
import SpaceAddonPicker, { type SelectedAddon } from '../../components/spaces/SpaceAddonPicker';
import { PORTAL_MAP_PATH } from '../../constants/routes';
import PageShell from '../../components/ui/PageShell';
import PageHeader from '../../components/ui/PageHeader';
import { addonLineTotal, addonUnitPriceForLease } from '../../utils/addonPricing';

// --- Helpers ------------------------------------------------------------------
const STATUS_META: Record<BookingStatus, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  DRAFT:                        { label: 'Draft',                 bg: '#f1f5f9', color: '#475569', icon: <ClockCircleOutlined />  },
  PENDING_APPROVAL:             { label: 'Pending Approval',      bg: '#fef3c7', color: '#92400e', icon: <ClockCircleOutlined />  },
  PENDING_PHONE_CONFIRMATION:   { label: 'Awaiting Phone Call',   bg: '#fef9c3', color: '#a16207', icon: <PhoneOutlined />        },
  AWAITING_PHYSICAL_VISIT:      { label: 'Awaiting Visit',        bg: '#dbeafe', color: '#1d4ed8', icon: <EnvironmentOutlined />  },
  DOCUMENTS_PENDING_UPLOAD:     { label: 'Docs Pending',          bg: '#ede9fe', color: '#6d28d9', icon: <FileTextOutlined />     },
  ACTIVE:                       { label: 'Active',                bg: '#dcfce7', color: '#15803d', icon: <CheckCircleOutlined />  },
  CONFIRMED:                    { label: 'Confirmed',             bg: '#dcfce7', color: '#15803d', icon: <CheckCircleOutlined />  },
  CHECKED_IN:                   { label: 'Checked In',            bg: '#dbeafe', color: '#1d4ed8', icon: <CheckCircleOutlined />  },
  COMPLETED:                    { label: 'Completed',             bg: '#ede9fe', color: '#6d28d9', icon: <CheckCircleOutlined />  },
  CANCELLED:                    { label: 'Cancelled',             bg: '#fee2e2', color: '#b91c1c', icon: <CloseCircleOutlined />  },
  REFUSED:                      { label: 'Refused',               bg: '#fee2e2', color: '#b91c1c', icon: <CloseCircleOutlined />  },
  NO_SHOW:                      { label: 'No Show',               bg: '#fef3c7', color: '#b45309', icon: <CloseCircleOutlined />  },
};

const CONTRACT_ELIGIBLE = ['ACTIVE', 'DOCUMENTS_PENDING_UPLOAD', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'];

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
function toArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  const nested = (raw as { data?: unknown }).data;
  if (Array.isArray(nested)) return nested as T[];
  return [];
}
function calcDurationMonths(startDate: string, startTime: string, endDate: string, endTime: string): number {
  if (!startDate || !endDate) return 1;
  const diffDays = Math.max(1, (new Date(`${endDate}T${endTime}`).getTime() - new Date(`${startDate}T${startTime}`).getTime()) / 86400000);
  return Math.max(1, Math.ceil(diffDays / 30));
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

function Field({ label, required, children, error }: { label: string; required?: boolean; children: React.ReactNode; error?: string }) {
  const { t: th } = usePageTheme();
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: th.textSub, display: 'block', marginBottom: 6 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelStyle}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{error}</span>}
    </div>
  );
}

// --- New Booking Modal --------------------------------------------------------
function NewBookingModal({ onClose, tenantId, userId, portalSubmit }: { onClose: () => void; tenantId: string; userId: string; portalSubmit?: boolean }) {
  const { t: th } = usePageTheme();
  const INPUT: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
    border: `1px solid ${th.inputBorder}`, background: th.inputBg, color: th.text,
  };
  const qc = useQueryClient();
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedFloorId,    setSelectedFloorId]    = useState('');
  const [selectedSpaceId,    setSelectedSpaceId]    = useState('');
  const [form, setForm] = useState({ start_date: '', start_time: '09:00', end_date: '', end_time: '10:00', attendee_count: '1', currency: 'USD' });
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => { const n = { ...e }; delete n[k]; return n; }); };

  const { data: buildingsRaw, isLoading: loadingB } = useQuery({ queryKey: ['buildings-bk'], queryFn: () => buildingApi.getAll(), staleTime: 0, gcTime: 0 });
  const { data: floorsRaw,    isLoading: loadingF } = useQuery({ queryKey: ['floors-bk', selectedBuildingId], queryFn: () => floorApi.getAll(selectedBuildingId),          enabled: !!selectedBuildingId, staleTime: 0, gcTime: 0 });
  const { data: spacesRaw,    isLoading: loadingS } = useQuery({ queryKey: ['spaces-bk', selectedFloorId],    queryFn: () => spaceApi.getAll({ floorId: selectedFloorId }), enabled: !!selectedFloorId,    staleTime: 0, gcTime: 0 });

  const buildings = toArray<Building>(buildingsRaw);
  const floors    = toArray<Floor>(floorsRaw);
  const spaces    = toArray<Space>(spacesRaw).filter((s: Space) => s.status === 'AVAILABLE');
  const selectedSpace = spaces.find(s => s.id === selectedSpaceId);
  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);

  const { data: spaceDetailRaw } = useQuery({
    queryKey: ['space-detail-bk', selectedSpaceId],
    queryFn: () => spaceApi.getOne(selectedSpaceId).then(r => r.data),
    enabled: !!selectedSpaceId,
  });
  const spaceDetail = spaceDetailRaw as Space & {
    available_addons?: { id: string; price: number; billing_cycle: string; name: string }[];
    floor?: { building?: { tenant_id?: string } };
  };
  const landlordTenantId =
    selectedBuilding?.tenant_id ?? spaceDetail?.floor?.building?.tenant_id;

  const { data: landlordAddonsRaw } = useQuery({
    queryKey: ['landlord-active-addons', landlordTenantId],
    queryFn: () => addonServiceApi.getActive(landlordTenantId).then(r => {
      const p = r.data;
      return Array.isArray(p) ? p : (p as { data?: unknown[] })?.data ?? [];
    }),
    enabled: !!landlordTenantId,
  });
  const landlordAddons = (landlordAddonsRaw ?? []) as { id: string; price: number; billing_cycle: string; name: string }[];
  const bookableAddons = (spaceDetail?.available_addons?.length ? spaceDetail.available_addons : landlordAddons);
  const allowedAddonIds = bookableAddons.map(a => a.id);

  const autoPrice = calcPrice(selectedSpace, form.start_date, form.start_time, form.end_date, form.end_time);
  const durationMonths = calcDurationMonths(form.start_date, form.start_time, form.end_date, form.end_time);
  const addonById = new Map(bookableAddons.map(a => [a.id, a]));
  const addonsTotal = selectedAddons.reduce((sum, sel) => {
    const svc = addonById.get(sel.addon_service_id);
    if (!svc) return sum;
    return sum + addonLineTotal(sel.quantity, addonUnitPriceForLease(Number(svc.price), svc.billing_cycle, durationMonths));
  }, 0);
  const grandTotal = autoPrice + addonsTotal;

  useEffect(() => { setSelectedAddons([]); }, [selectedSpaceId]);

  useEffect(() => { if (selectedSpace?.currency) setF('currency', selectedSpace.currency); }, [selectedSpace?.id, selectedSpace?.currency]);

  const mutation = useMutation({
    mutationFn: (d: unknown) => bookingApi.create(d),
    onSuccess: () => {
      message.success(portalSubmit ? 'Booking submitted — a combined invoice will be issued after approval' : 'Booking created');
      qc.invalidateQueries({ queryKey: ['bookings'] });
      onClose();
    },
    onError:   (err: ApiError) => { const msg = err?.response?.data?.message ?? 'Failed'; message.error(Array.isArray(msg) ? msg.join(', ') : msg); },
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
      ...(selectedAddons.length && {
        addons: selectedAddons.map(a => ({ addon_service_id: a.addon_service_id, quantity: a.quantity })),
      }),
    });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: th.cardBg, borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: th.cardBg, zIndex: 1, borderRadius: '16px 16px 0 0' }}>
          <div><h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: th.text }}>New Booking</h2><p style={{ margin: '2px 0 0', fontSize: 12, color: th.textMuted }}>Reserve a space</p></div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.textSub }}><CloseOutlined style={{ fontSize: 13 }} /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: th.tableHead, border: `1px solid ${th.cardBorder}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>📍 Building · Floor · Space</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <Field label="Building" required><Select loading={loadingB} value={selectedBuildingId || undefined} onChange={v => { setSelectedBuildingId(v); setSelectedFloorId(''); setSelectedSpaceId(''); }} placeholder="Select building..." style={{ width: '100%' }} options={buildings.map(b => ({ value: b.id, label: b.name }))} /></Field>
              <Field label="Floor" required><Select loading={loadingF} value={selectedFloorId || undefined} onChange={v => { setSelectedFloorId(v); setSelectedSpaceId(''); }} placeholder={selectedBuildingId ? 'Select floor...' : 'Select building first'} disabled={!selectedBuildingId} style={{ width: '100%' }} options={floors.map(f => ({ value: f.id, label: `Floor ${f.floor_number} ? ${f.name}` }))} /></Field>
              <Field label="Space" required error={errors.space}><Select loading={loadingS} value={selectedSpaceId || undefined} onChange={v => { setSelectedSpaceId(v); setErrors(e => { const n = { ...e }; delete n.space; return n; }); }} placeholder={selectedFloorId ? 'Select space...' : 'Select floor first'} disabled={!selectedFloorId} style={{ width: '100%' }} options={spaces.map(s => ({ value: s.id, label: `${s.name} (cap: ${s.capacity})` }))} notFoundContent="No available spaces" /></Field>
            </div>
            {selectedSpace && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 16, fontSize: 12, color: '#1d4ed8', flexWrap: 'wrap' }}>
                <span>🏢 {selectedSpace.name}</span><span>👥 Cap: {selectedSpace.capacity}</span>
                {selectedSpace.price_per_hour  && <span>?? ${parseFloat(selectedSpace.price_per_hour)}/hr</span>}
                {selectedSpace.price_per_day   && <span>?? ${parseFloat(selectedSpace.price_per_day)}/day</span>}
                {selectedSpace.price_per_month && <span>?? ${parseFloat(selectedSpace.price_per_month)}/mo</span>}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>📅 Date & Time</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
              <Field label="Start Date" required error={errors.start_date}><input style={{ ...INPUT, borderColor: errors.start_date ? '#ef4444' : '#e5e7eb' }} type="date" min={today} value={form.start_date} onChange={e => setF('start_date', e.target.value)} /></Field>
              <Field label="Start Time" required><input style={INPUT} type="time" value={form.start_time} onChange={e => setF('start_time', e.target.value)} /></Field>
              <Field label="End Date" required error={errors.end_date}><input style={{ ...INPUT, borderColor: errors.end_date ? '#ef4444' : '#e5e7eb' }} type="date" min={form.start_date || today} value={form.end_date} onChange={e => setF('end_date', e.target.value)} /></Field>
              <Field label="End Time" required><input style={INPUT} type="time" value={form.end_time} onChange={e => setF('end_time', e.target.value)} /></Field>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <Field label="Attendees" required error={errors.attendee_count}><input style={{ ...INPUT, borderColor: errors.attendee_count ? '#ef4444' : '#e5e7eb' }} type="number" min="1" max={selectedSpace?.capacity ?? 999} value={form.attendee_count} onChange={e => setF('attendee_count', e.target.value)} /></Field>
              <Field label="Space rental">
                <div style={{ ...INPUT, background: th.tableHead, display: 'flex', alignItems: 'center', cursor: 'default' }}>
                  <span style={{ fontWeight: 700, color: autoPrice > 0 ? th.text : th.textMuted }}>{autoPrice > 0 ? `${form.currency} ${autoPrice.toFixed(2)}` : '—'}</span>
                </div>
              </Field>
              <Field label="Currency"><Select value={form.currency} onChange={v => setF('currency', v)} style={{ width: '100%' }} options={['USD','EUR','GBP','AED','TND'].map(c => ({ value: c, label: c }))} /></Field>
            </div>
          </div>
          <div style={{ background: th.tableHead, border: `1px solid ${th.cardBorder}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Optional add-on services</div>
            {!selectedBuildingId ? (
              <p style={{ fontSize: 13, color: th.textMuted, margin: 0 }}>Select a building first ? optional services from the property manager will appear here.</p>
            ) : (
              <SpaceAddonPicker
                tenantId={landlordTenantId}
                allowedIds={allowedAddonIds.length > 0 ? allowedAddonIds : undefined}
                value={selectedAddons}
                onChange={setSelectedAddons}
              />
            )}
          </div>
          <div style={{ background: th.tableHead, border: `1px solid ${th.cardBorder}`, borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: th.textSub }}>Total (space + services)</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#2563eb' }}>
              {grandTotal > 0 ? `${form.currency} ${grandTotal.toFixed(2)}` : '—'}
            </span>
          </div>
        </div>
        <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: th.cardBg, borderRadius: '0 0 16px 16px' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: th.text }}>Cancel</button>
          <button onClick={handleSubmit} disabled={mutation.isPending} style={{ padding: '9px 22px', borderRadius: 8, background: mutation.isPending ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: mutation.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {mutation.isPending ? <><LoadingOutlined /> Creating...</> : <><PlusOutlined /> Create Booking</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Booking Detail Modal -----------------------------------------------------
function BookingDetailModal({ booking, onClose, canManage, userId, onCreateContract, onRecordPayment }: {
  booking: Booking | null; onClose: () => void;
  canManage: boolean; userId: string;
  onCreateContract: (b: Booking) => void;
  onRecordPayment: (b: Booking) => void;
}) {
  const { t: th } = usePageTheme();
  const qc = useQueryClient();
  const approveMut  = useMutation({
    mutationFn: (id: string) => bookingApi.approve(id, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      message.success('Approved — create contract & record payment for the tenant');
      onClose();
    },
    onError: (err: ApiError) => message.error(err?.response?.data?.message?.[0] ?? err?.userMessage ?? 'Failed'),
  });
  const rejectMut   = useMutation({
    mutationFn: (id: string) => bookingApi.reject(id, 'Rejected by manager'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Booking rejected'); onClose(); },
    onError: (err: ApiError) => message.error(err?.response?.data?.message?.[0] ?? err?.userMessage ?? 'Failed'),
  });
  const cancelMut   = useMutation({
    mutationFn: (id: string) => bookingApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Cancelled'); onClose(); },
    onError: (err: ApiError) => message.error(err?.response?.data?.message?.[0] ?? err?.userMessage ?? 'Failed'),
  });
  const checkInMut  = useMutation({ mutationFn: (id: string) => bookingApi.checkIn(id),         onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Checked in!'); onClose(); }, onError: () => message.error('Failed') });
  const checkOutMut = useMutation({ mutationFn: (id: string) => bookingApi.checkOut(id),        onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Checked out!');onClose(); }, onError: () => message.error('Failed') });

  if (!booking) return null;
  const sm          = STATUS_META[booking.status] ?? STATUS_META.DRAFT;
  const spaceName   = (booking as any).space?.name ?? `Space ${booking.space_id.substring(0, 8)}`;
  const canCancel   = !['CANCELLED','COMPLETED','NO_SHOW'].includes(booking.status);
  const isPending   = approveMut.isPending || rejectMut.isPending || cancelMut.isPending || checkInMut.isPending || checkOutMut.isPending;
  const canContract = canManage && CONTRACT_ELIGIBLE.includes(booking.status);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: th.cardBg, borderRadius: 16, width: '100%', maxWidth: 540, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: th.text }}>Booking Details</h2>
            <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{sm.label}</span>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.textSub }}><CloseOutlined style={{ fontSize: 13 }} /></button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ background: th.tableHead, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📋</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: th.text }}>{spaceName}</div>
              <div style={{ fontSize: 12, color: th.textSub }}>{(booking as any).space?.type?.replace(/_/g,' ') ?? 'Office Space'}</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: th.text }}>${parseFloat(booking.total_price).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: th.textSub }}>{booking.currency}</div>
            </div>
          </div>
          {canContract && (
            <div style={{ background: 'linear-gradient(135deg,#1e40af,#2563eb)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileTextOutlined style={{ color: '#fff', fontSize: 18 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>Ready to create a lease contract?</div>
                <div style={{ fontSize: 11, color: '#bfdbfe', marginTop: 2 }}>Booking <strong style={{ color: '#fff' }}>{booking.booking_number}</strong> — Dates & tenant will be pre-filled</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => { onClose(); onCreateContract(booking); }} style={{ padding: '8px 16px', borderRadius: 8, background: th.cardBg, border: 'none', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  ?? Contract
                </button>
                <button onClick={() => { onClose(); onRecordPayment(booking); }} style={{ padding: '8px 16px', borderRadius: 8, background: th.cardBg, border: 'none', color: '#15803d', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  ?? Payment
                </button>
              </div>
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
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${th.divider}`, fontSize: 13 }}>
                <span style={{ color: th.textSub }}>{k}</span>
                <span style={{ fontWeight: 600, color: th.text, fontFamily: k === 'Booking #' ? 'monospace' : undefined }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
            {canManage && booking.status === 'PENDING_APPROVAL' && (
              <>
                <button onClick={() => approveMut.mutate(booking.id)} disabled={isPending} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {approveMut.isPending ? <LoadingOutlined /> : <CheckCircleOutlined />} Approve
                </button>
                <button onClick={() => { if (window.confirm('Reject this booking request?')) rejectMut.mutate(booking.id); }} disabled={isPending} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer' }}>
                  {rejectMut.isPending ? 'Rejecting...' : 'Reject'}
                </button>
              </>
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
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, background: th.cardBg, border: `1px solid ${th.cardBorder}`, fontSize: 13, cursor: 'pointer', color: th.text }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Page ---------------------------------------------------------------------
export default function BookingsPage() {
  const { card: CARD, t: th, btnIcon, btnPrimary, btnSecondary } = usePageTheme();
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const tenantId      = (user as any)?.tenant_id ?? '';
  const userId        = user?.id ?? '';
  const canManage     = !!(user?.role && ['SUPER_ADMIN', 'MANAGER'].includes(user.role));
  const isReception   = user?.role === 'RECEPTIONIST';
  const isClientAdmin = user?.role === 'CLIENT_ADMIN';
  const isWorkflowStaff = canManage || isReception || isClientAdmin;
  const canBook       = canManage || user?.role === 'TENANT_ADMIN' || user?.role === 'TENANT_EMPLOYEE';
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';
  const isEmployee    = user?.role === 'TENANT_EMPLOYEE';
  const isBackOffice  = ['SUPER_ADMIN', 'MANAGER', 'FINANCE', 'MAINTENANCE', 'RECEPTIONIST', 'CLIENT_ADMIN'].includes(user?.role ?? '');
  const basePath      = isBackOffice ? '/admin' : '/portal';
  const isPortalBooker = !isBackOffice && (isTenantAdmin || isEmployee);

  const openNewBooking = () => {
    if (isPortalBooker) navigate(PORTAL_MAP_PATH);
    else setNew(true);
  };

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
    }).then(r => mapBookings(r.data)),
  });
  const bookings: Booking[] = mapBookings(bookingsRaw);

  const { data: pendingApps = [] } = useQuery({
    queryKey: ['booking-applications-pending-banner'],
    queryFn: () => bookingApplicationApi.getAll({ status: 'PENDING' }).then((r) => toArray(r)),
    enabled: canManage,
  });

  const cancelMut  = useMutation({
    mutationFn: (id: string) => bookingApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Cancelled'); },
    onError: (err: ApiError) => message.error(err?.response?.data?.message?.[0] ?? err?.userMessage ?? 'Failed'),
  });
  const approveMut = useMutation({
    mutationFn: (id: string) => bookingApi.approve(id, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Approved — create contract & record payment for the tenant'); },
    onError: (err: ApiError) => message.error(err?.response?.data?.message?.[0] ?? err?.userMessage ?? 'Failed'),
  });
  const rejectMut  = useMutation({
    mutationFn: (id: string) => bookingApi.reject(id, 'Rejected by manager'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Booking rejected'); },
    onError: (err: ApiError) => message.error(err?.response?.data?.message?.[0] ?? err?.userMessage ?? 'Failed'),
  });
  const deleteMut  = useMutation({ mutationFn: (id: string) => bookingApi.remove(id),          onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Deleted'); },  onError: () => message.error('Failed') });
  const checkInMut = useMutation({ mutationFn: (id: string) => bookingApi.checkIn(id),         onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Checked in!'); }, onError: (err: ApiError) => message.error(err?.response?.data?.message?.[0] ?? err?.userMessage ?? 'Failed') });
  const checkOutMut= useMutation({ mutationFn: (id: string) => bookingApi.checkOut(id),        onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); message.success('Checked out!'); }, onError: (err: ApiError) => message.error(err?.response?.data?.message?.[0] ?? err?.userMessage ?? 'Failed') });

  const invalidateBookings = () => {
    qc.invalidateQueries({ queryKey: ['bookings'] });
    qc.invalidateQueries({ queryKey: ['booking-workflow-queues'] });
  };
  const confirmPhoneMut = useMutation({
    mutationFn: (id: string) => bookingApi.confirmPhone(id),
    onSuccess: () => { invalidateBookings(); message.success('Tenant confirmed — visit instructions emailed'); },
    onError: (err: ApiError) => message.error(err?.response?.data?.message?.[0] ?? err?.userMessage ?? 'Failed'),
  });
  const phoneUnreachableMut = useMutation({
    mutationFn: (id: string) => bookingApi.phoneUnreachable(id, 'Could not reach tenant'),
    onSuccess: () => { invalidateBookings(); message.success('Booking cancelled — space released'); },
    onError: (err: ApiError) => message.error(err?.response?.data?.message?.[0] ?? err?.userMessage ?? 'Failed'),
  });
  const visitCompleteMut = useMutation({
    mutationFn: (id: string) => bookingApi.markDocumentsPending(id),
    onSuccess: () => { invalidateBookings(); message.success('Visit complete — manager can upload documents'); },
    onError: (err: ApiError) => message.error(err?.response?.data?.message?.[0] ?? err?.userMessage ?? 'Failed'),
  });

  const handleCreateContract = (booking: Booking) => {
    const b = mapBooking(booking as unknown as Record<string, unknown>);
    const prefill = prefillFromBooking(b);
    message.info('Pre-filled from booking — confirm rent & deposit, then create the contract.', 3);
    navigate(`${basePath}/contracts`, { state: { fromBooking: prefill } });
  };

  const handleRecordPayment = (booking: Booking) => {
    const b = mapBooking(booking as unknown as Record<string, unknown>);
    navigate(`${basePath}/billing?tab=payments`, {
      state: { tenantId: b.tenant_id, fromBooking: b.booking_number },
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

  const docsPending = bookings.filter(b => b.status === 'DOCUMENTS_PENDING_UPLOAD').length;
  const awaitingVisit = bookings.filter(b => b.status === 'AWAITING_PHYSICAL_VISIT').length;
  const awaitingCall = bookings.filter(b => b.status === 'PENDING_PHONE_CONFIRMATION').length;
  const confirmed = bookings.filter(b => b.status === 'CONFIRMED').length;
  const pending   = bookings.filter(b => b.status === 'PENDING_APPROVAL').length;

  const openBookingDetail = (b: Booking) => {
    if (isWorkflowStaff) {
      navigate(`${basePath}/bookings/${b.id}`);
    } else {
      setSelected(b);
    }
  };
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
    <PageShell>

      {newOpen && canManage && <NewBookingModal onClose={() => setNew(false)} tenantId={tenantId} userId={userId} portalSubmit={!canManage} />}
      <BookingDetailModal booking={selected} onClose={() => setSelected(null)} canManage={canManage} userId={userId} onCreateContract={handleCreateContract} onRecordPayment={handleRecordPayment} />

      {canManage && pendingApps.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${pendingApps.length} pending booking application${pendingApps.length > 1 ? 's' : ''} — not shown here until you accept them`}
          action={
            <Button size="small" type="primary" onClick={() => navigate('/admin/booking-applications')}>
              Review applications
            </Button>
          }
        />
      )}

      {isWorkflowStaff && (awaitingCall > 0 || awaitingVisit > 0) && (
        <Alert
          type="info"
          showIcon
          icon={<PhoneOutlined />}
          style={{ marginBottom: 16 }}
          title="Reception workflow"
          description={
            awaitingCall > 0 && awaitingVisit > 0
              ? `${awaitingCall} awaiting phone call · ${awaitingVisit} awaiting visit — use the action buttons in the table, or open the Reception queue.`
              : awaitingCall > 0
                ? `${awaitingCall} booking${awaitingCall > 1 ? 's' : ''} need a confirmation call first.`
                : `${awaitingVisit} booking${awaitingVisit > 1 ? 's' : ''} awaiting visit — after the tenant visits and signs on site, click Visit complete.`
          }
          action={
            <Button size="small" onClick={() => navigate('/admin/reception')}>
              Reception queue
            </Button>
          }
        />
      )}

      {canManage && docsPending > 0 && (
        <Alert
          type="info"
          showIcon
          icon={<FileTextOutlined />}
          style={{ marginBottom: 16 }}
          title={`${docsPending} booking${docsPending > 1 ? 's' : ''} ready for contract & cheque upload`}
          description="Open the booking, upload signed contract PDF and cheque scan, then click Finalize."
          action={
            <Button
              size="small"
              type="primary"
              onClick={() => {
                const first = bookings.find((b) => b.status === 'DOCUMENTS_PENDING_UPLOAD');
                if (first) navigate(`${basePath}/bookings/${first.id}`);
              }}
            >
              Upload documents
            </Button>
          }
        />
      )}

      <PageHeader
        title={canManage ? 'All Bookings' : isTenantAdmin ? 'Bookings' : 'My Bookings'}
        subtitle={canManage ? 'All reservations across every tenant' : isTenantAdmin ? 'Your company reservations' : 'Your personal reservations'}
        actions={
          <>
            <button type="button" onClick={() => refetch()} style={btnIcon}><ReloadOutlined /> Refresh</button>
            <button type="button" style={btnSecondary}><DownloadOutlined /> Export</button>
            <button type="button" onClick={() => navigate(`${basePath}/bookings/calendar`)} style={{ ...btnSecondary, borderColor: '#2563eb', color: '#2563eb', background: '#eff6ff' }}>
              <CalendarOutlined /> Calendar
            </button>
            {canBook && (
              <button type="button" onClick={openNewBooking} style={btnPrimary}>
                <PlusOutlined /> {isPortalBooker ? 'Book on map' : 'New Booking'}
              </button>
            )}
          </>
        }
        stats={[
          { label: 'Total', value: isLoading ? '—' : bookings.length, color: '#2563eb' },
          { label: 'Confirmed', value: isLoading ? '—' : confirmed, color: '#059669' },
          { label: 'Pending', value: isLoading ? '—' : pending, color: '#d97706' },
          { label: 'Checked In', value: isLoading ? '—' : checkedIn, color: '#1d4ed8' },
          { label: 'Completed', value: isLoading ? '—' : completed, color: '#7c3aed' },
          { label: 'Cancelled', value: isLoading ? '—' : cancelled, color: '#dc2626' },
        ]}
      />

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input prefix={<SearchOutlined style={{ color: th.textMuted }} />} placeholder="Search by booking # or space..." value={q} onChange={e => setQ(e.target.value)} style={{ width: 260, borderRadius: 8 }} />
        <Select value={statusFilt || 'all'} onChange={v => setStatus(v === 'all' ? '' : v)} style={{ width: 220 }} options={[
          { value: 'all',                        label: 'All Status' },
          { value: 'DOCUMENTS_PENDING_UPLOAD',   label: 'Needs document upload' },
          { value: 'PENDING_PHONE_CONFIRMATION', label: 'Awaiting phone call' },
          { value: 'AWAITING_PHYSICAL_VISIT',    label: 'Awaiting visit' },
          { value: 'ACTIVE',                     label: 'Active lease' },
          { value: 'CONFIRMED',                  label: 'Confirmed' },
          { value: 'PENDING_APPROVAL',           label: 'Pending approval' },
          { value: 'CHECKED_IN',                 label: 'Checked in' },
          { value: 'COMPLETED',                  label: 'Completed' },
          { value: 'CANCELLED',                  label: 'Cancelled' },
          { value: 'REFUSED',                    label: 'Refused' },
          { value: 'DRAFT',                      label: 'Draft' },
        ]} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: th.textSub }}>Showing <strong style={{ color: th.text }}>{filtered.length}</strong> of {bookings.length}</span>
          <div style={{ display: 'flex', border: `1px solid ${th.cardBorder}`, borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('table')}    style={{ padding: '7px 14px', background: view === 'table'    ? '#2563eb' : '#fff', color: view === 'table'    ? '#fff' : '#64748b', border: 'none', cursor: 'pointer', fontSize: 12 }}>List</button>
            <button onClick={() => setView('timeline')} style={{ padding: '7px 14px', background: view === 'timeline' ? '#2563eb' : '#fff', color: view === 'timeline' ? '#fff' : '#64748b', border: 'none', cursor: 'pointer', fontSize: 12 }}>Timeline</button>
          </div>
        </div>
      </div>

      {isError && <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}><div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div><div style={{ fontWeight: 600, color: th.text, marginBottom: 8 }}>Failed to load</div><button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Retry</button></div>}
      {isLoading && <div style={CARD}>{Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ padding: '16px 20px', borderBottom: i < 4 ? `1px solid ${th.divider}` : 'none' }}><Skeleton active paragraph={{ rows: 1 }} /></div>)}</div>}

      {!isLoading && !isError && filtered.length === 0 && (
        <div style={{ ...CARD, padding: '60px', textAlign: 'center' }}>
          <CalendarOutlined style={{ fontSize: 48, color: '#e5e7eb', display: 'block', margin: '0 auto 16px' }} />
          <Empty description={bookings.length === 0 ? (canManage ? 'No bookings yet.' : 'No bookings yet — pick a space on the map to book!') : 'No bookings match your filters.'} />
          {isPortalBooker && bookings.length === 0 && (
            <button onClick={() => navigate(PORTAL_MAP_PATH)} style={{ marginTop: 16, padding: '10px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Open map
            </button>
          )}
        </div>
      )}

      {/* TABLE VIEW */}
      {!isLoading && !isError && filtered.length > 0 && view === 'table' && (
        <div style={{ ...CARD, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1.8fr 0.8fr 0.7fr 1.2fr 2fr', padding: '11px 20px', background: th.tableHead, borderBottom: `1px solid ${th.cardBorder}`, fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Booking #</span><span>Space</span><span>Date & Time</span><span>Duration</span><span>People</span><span>Status</span><span>Actions</span>
          </div>
          {filtered.map((b: Booking, i: number) => {
            const sm        = STATUS_META[b.status] ?? STATUS_META.DRAFT;
            const spaceName = (b as any).space?.name ?? `Space ${b.space_id.substring(0,6)}`;
            const canCancel = !['CANCELLED','COMPLETED','NO_SHOW'].includes(b.status);
            const isEligible = CONTRACT_ELIGIBLE.includes(b.status);
            return (
              <div key={b.id}
                style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1.8fr 0.8fr 0.7fr 1.2fr 2fr', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? `1px solid ${th.divider}` : 'none', alignItems: 'center', transition: 'background 0.1s', cursor: isWorkflowStaff ? 'pointer' : 'default' }}
                onClick={() => { if (isWorkflowStaff) openBookingDetail(b); }}
                onMouseEnter={e => (e.currentTarget.style.background = th.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{b.booking_number}</div>
                  <div style={{ fontSize: 11, color: th.textMuted }}>{formatDate(b.created_at)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><EnvironmentOutlined style={{ color: '#2563eb', fontSize: 13 }} /></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{spaceName}</div>
                    <div style={{ fontSize: 11, color: th.textMuted }}>{(b as any).space?.type?.replace(/_/g,' ') ?? '—'}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: th.text }}>{new Date(b.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  <div style={{ fontSize: 11, color: th.textMuted }}>{new Date(b.start_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} ? {new Date(b.end_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: th.text }}>{getDuration(b.start_datetime, b.end_datetime)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: th.text }}><TeamOutlined style={{ fontSize: 11, color: th.textMuted }} /> {b.attendee_count}</div>
                <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  {sm.icon} {sm.label}
                </span>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openBookingDetail(b)} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="View details"><EyeOutlined style={{ fontSize: 12, color: th.textSub }} /></button>
                  {isWorkflowStaff && b.status === 'PENDING_PHONE_CONFIRMATION' && (
                    <button
                      onClick={() => confirmPhoneMut.mutate(b.id)}
                      disabled={confirmPhoneMut.isPending}
                      style={{ padding: '0 10px', height: 28, borderRadius: 6, border: 'none', background: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#fff', fontSize: 10, fontWeight: 700 }}
                      title="Tenant confirmed by phone"
                    >
                      {confirmPhoneMut.isPending ? <LoadingOutlined style={{ fontSize: 11 }} /> : <PhoneOutlined style={{ fontSize: 11 }} />} Confirmed
                    </button>
                  )}
                  {isWorkflowStaff && b.status === 'AWAITING_PHYSICAL_VISIT' && (
                    <button
                      onClick={() => visitCompleteMut.mutate(b.id)}
                      disabled={visitCompleteMut.isPending}
                      style={{ padding: '0 10px', height: 28, borderRadius: 6, border: 'none', background: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#fff', fontSize: 10, fontWeight: 700 }}
                      title="Tenant visited and signed on site"
                    >
                      {visitCompleteMut.isPending ? <LoadingOutlined style={{ fontSize: 11 }} /> : <CheckCircleOutlined style={{ fontSize: 11 }} />} Visit complete
                    </button>
                  )}
                  {canManage && b.status === 'DOCUMENTS_PENDING_UPLOAD' && (
                    <button onClick={() => navigate(`${basePath}/bookings/${b.id}`)} style={{ padding: '0 10px', height: 28, borderRadius: 6, border: 'none', background: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#fff', fontSize: 10, fontWeight: 700 }} title="Upload contract & cheque">
                      <FileTextOutlined style={{ fontSize: 11 }} /> Upload
                    </button>
                  )}
                  {canBook && b.status === 'CONFIRMED' && (
                    <button onClick={() => checkInMut.mutate(b.id)} disabled={checkInMut.isPending} style={{ padding: '0 10px', height: 28, borderRadius: 6, border: 'none', background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#fff', fontSize: 10, fontWeight: 700 }} title="Check in">
                      {checkInMut.isPending ? <LoadingOutlined style={{ fontSize: 11 }} /> : <CheckCircleOutlined style={{ fontSize: 11 }} />} Check In
                    </button>
                  )}
                  {canBook && b.status === 'CHECKED_IN' && (
                    <button onClick={() => checkOutMut.mutate(b.id)} disabled={checkOutMut.isPending} style={{ padding: '0 10px', height: 28, borderRadius: 6, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#fff', fontSize: 10, fontWeight: 700 }} title="Check out">
                      {checkOutMut.isPending ? <LoadingOutlined style={{ fontSize: 11 }} /> : <CloseCircleOutlined style={{ fontSize: 11 }} />} Check Out
                    </button>
                  )}
                  {canManage && b.status === 'PENDING_APPROVAL' && (
                    <>
                      <button onClick={() => approveMut.mutate(b.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Approve"><CheckCircleOutlined style={{ fontSize: 12, color: '#15803d' }} /></button>
                      <button onClick={() => { if (window.confirm('Reject this booking?')) rejectMut.mutate(b.id); }} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Reject"><CloseCircleOutlined style={{ fontSize: 12, color: '#dc2626' }} /></button>
                    </>
                  )}
                  {canManage && isEligible && (
                    <button onClick={() => handleCreateContract(b)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #2563eb', background: '#eff6ff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Create contract"><FileTextOutlined style={{ fontSize: 12, color: '#2563eb' }} /></button>
                  )}
                  {isWorkflowStaff && b.status === 'PENDING_PHONE_CONFIRMATION' && (
                    <button
                      onClick={() => { if (window.confirm('Mark tenant unreachable and cancel this booking?')) phoneUnreachableMut.mutate(b.id); }}
                      disabled={phoneUnreachableMut.isPending}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Unreachable / cancel"
                    >
                      <CloseCircleOutlined style={{ fontSize: 12, color: '#dc2626' }} />
                    </button>
                  )}
                  {canCancel && !['PENDING_PHONE_CONFIRMATION', 'AWAITING_PHYSICAL_VISIT'].includes(b.status) && (
                    <button onClick={() => { if (window.confirm(`Cancel ${b.booking_number}?`)) cancelMut.mutate(b.id); }} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Cancel"><CloseCircleOutlined style={{ fontSize: 12, color: '#dc2626' }} /></button>
                  )}
                  {canManage && (
                    <button onClick={() => { if (window.confirm(`Delete ${b.booking_number}?`)) deleteMut.mutate(b.id); }} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete"><DeleteOutlined style={{ fontSize: 12, color: '#dc2626' }} /></button>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: th.textMuted }}>
            <span>Showing {filtered.length} of {bookings.length} bookings</span>
            <span>{confirmed} confirmed ? {pending} pending ? {checkedIn} checked in</span>
          </div>
        </div>
      )}

      {/* TIMELINE VIEW */}
      {!isLoading && !isError && filtered.length > 0 && view === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(byDate).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime()).map(([date, dayBookings]) => (
            <div key={date}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: th.text }}>{date}</div>
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
                      onClick={() => openBookingDetail(b)}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}>
                      <div style={{ width: 72, textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: th.text }}>{new Date(b.start_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div style={{ fontSize: 11, color: th.textMuted }}>{getDuration(b.start_datetime, b.end_datetime)}</div>
                      </div>
                      <div style={{ width: 4, height: 48, borderRadius: 2, background: sm.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: th.text, marginBottom: 3 }}>{spaceName}</div>
                        <div style={{ fontSize: 12, color: th.textSub, display: 'flex', gap: 10 }}>
                          <span style={{ fontFamily: 'monospace' }}>{b.booking_number}</span>
                          <span><TeamOutlined style={{ fontSize: 11, marginRight: 3 }} />{b.attendee_count}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-block', marginBottom: 4 }}>{sm.label}</span>
                        <div style={{ fontSize: 14, fontWeight: 700, color: th.text }}>${parseFloat(b.total_price).toLocaleString()}</div>
                      </div>
                      {isWorkflowStaff && b.status === 'AWAITING_PHYSICAL_VISIT' && (
                        <button onClick={e => { e.stopPropagation(); visitCompleteMut.mutate(b.id); }} disabled={visitCompleteMut.isPending} style={{ padding: '6px 12px', borderRadius: 7, background: '#059669', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {visitCompleteMut.isPending ? <LoadingOutlined /> : <CheckCircleOutlined />} Visit complete
                        </button>
                      )}
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
    </PageShell>
  );
}