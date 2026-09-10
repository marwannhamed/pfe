import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, Select, Skeleton, Empty } from 'antd';
import { message } from '../../utils/feedback';
import {
  SearchOutlined, PlusOutlined, ReloadOutlined,
  FileTextOutlined, CheckCircleOutlined, StopOutlined,
  EyeOutlined, DownloadOutlined, WarningOutlined,
  CloseOutlined, LoadingOutlined, RedoOutlined,
  EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { contractApi, tenantApi, bookingApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { LeaseContract, ContractStatus, Booking } from '../../types';
import { mapBookings } from '../../utils/booking';
import { DEFAULT_CURRENCY } from '../../constants/qatar';
import {
  CONTRACT_BOOKING_STATUSES,
  prefillFromBooking,
  type ContractPrefillFromBooking,
} from '../../utils/contractFromBooking';

// --- Helpers ------------------------------------------------------------------
const STATUS_META: Record<ContractStatus, { label: string; bg: string; color: string }> = {
  DRAFT:      { label: 'Draft',      bg: '#f1f5f9', color: '#475569' },
  ACTIVE:     { label: 'Active',     bg: '#dcfce7', color: '#15803d' },
  EXPIRED:    { label: 'Expired',    bg: '#fee2e2', color: '#b91c1c' },
  TERMINATED: { label: 'Terminated', bg: '#fee2e2', color: '#b91c1c' },
  RENEWED:    { label: 'Renewed',    bg: '#dbeafe', color: '#1d4ed8' },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function toDateInputValue(d: string | undefined) {
  if (!d) return '';
  return d.includes('T') ? d.split('T')[0] : d;
}
function getDaysLeft(endDate: string): number {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
}
function toArray<T>(raw: any): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export type PrefillData = ContractPrefillFromBooking;

function Field({ label, required, children, error }: { label: string; required?: boolean; children: React.ReactNode; error?: string }) {

  const { input: INPUT, t: th } = usePageTheme();
  const LABEL: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: th.textSub, display: 'block', marginBottom: 5 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={LABEL}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{error}</span>}
    </div>
  );
}

// --- New Contract Modal -------------------------------------------------------
function NewContractModal({ onClose, tenantId, userId, isSuperAdmin, prefillData }: {
  onClose: () => void; tenantId: string; userId: string;
  isSuperAdmin: boolean; prefillData?: PrefillData | null;
}) {
  const { card: CARD, input: INPUT, t: th } = usePageTheme();
  const qc  = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const [selectedBookingId, setSelectedBookingId] = useState(prefillData?.booking_id ?? '');
  const [form, setForm] = useState({
    tenant_id:       prefillData?.tenant_id  ?? tenantId,
    start_date:      prefillData?.start_date ?? '',
    end_date:        prefillData?.end_date   ?? '',
    monthly_rent:    prefillData?.monthly_rent ?? '',
    deposit_amount:  '',
    currency:        prefillData?.currency   ?? DEFAULT_CURRENCY,
    payment_due_day: '1',
    auto_renew:      'false',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => { const n = { ...e }; delete n[k]; return n; }); };

  const { data: bookingsRaw } = useQuery({
    queryKey: ['bookings-for-contract'],
    queryFn: () => bookingApi.getAll().then((r) => mapBookings((r as { data?: unknown })?.data ?? r)),
  });
  const contractBookings = (bookingsRaw ?? []).filter((b) => CONTRACT_BOOKING_STATUSES.has(b.status));

  const activeBookingRef = selectedBookingId
    ? contractBookings.find((b) => b.id === selectedBookingId)
    : null;
  const bookingRef = activeBookingRef
    ? prefillFromBooking(activeBookingRef)
    : prefillData ?? null;
  const isFromBooking = !!bookingRef?.booking_number;

  const applyBookingPrefill = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    if (!bookingId) return;
    const b = contractBookings.find((x) => x.id === bookingId);
    if (!b) return;
    const prefill = prefillFromBooking(b);
    setForm((f) => ({
      ...f,
      tenant_id: prefill.tenant_id,
      start_date: prefill.start_date,
      end_date: prefill.end_date,
      currency: prefill.currency,
      monthly_rent: prefill.monthly_rent ?? f.monthly_rent,
    }));
  };

  const { data: tenantsRaw } = useQuery({
    queryKey: ['tenants-for-contract'],
    queryFn:  () => tenantApi.getAll().then(r => r.data),
    enabled:  isSuperAdmin,
  });
  const tenants = toArray<any>(tenantsRaw);

  const mutation = useMutation({
    mutationFn: (d: any) => contractApi.create(d),
    onSuccess: () => { message.success('Contract created!'); qc.invalidateQueries({ queryKey: ['contracts'] }); onClose(); },
    onError:   (err: any) => { const msg = err?.response?.data?.message ?? 'Failed'; message.error(Array.isArray(msg) ? msg.join(', ') : msg); },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.tenant_id)      e.tenant_id      = 'Required';
    if (!form.start_date)     e.start_date     = 'Required';
    if (!form.end_date)       e.end_date       = 'Required';
    if (!form.monthly_rent)   e.monthly_rent   = 'Required';
    if (!form.deposit_amount) e.deposit_amount = 'Required';
    if (form.start_date && form.end_date && new Date(form.end_date) <= new Date(form.start_date))
      e.end_date = 'Must be after start';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    mutation.mutate({
      tenant_id: form.tenant_id, created_by_user_id: userId,
      start_date: new Date(form.start_date).toISOString(),
      end_date:   new Date(form.end_date).toISOString(),
      monthly_rent:    parseFloat(form.monthly_rent),
      deposit_amount:  parseFloat(form.deposit_amount),
      currency:        form.currency,
      payment_due_day: parseInt(form.payment_due_day),
      auto_renew:      form.auto_renew === 'true',
    });
  };

  const durationMonths = form.start_date && form.end_date && new Date(form.end_date) > new Date(form.start_date)
    ? Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (86400000 * 30))
    : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: th.cardBg, borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${th.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: th.cardBg, zIndex: 1, borderRadius: '16px 16px 0 0' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: th.text }}>New Lease Contract</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: isFromBooking ? '#2563eb' : '#94a3b8', fontWeight: isFromBooking ? 600 : 400 }}>
              {isFromBooking ? `Pre-filled from booking ${bookingRef?.booking_number}` : 'Create a new lease agreement'}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.textSub }}>
            <CloseOutlined style={{ fontSize: 13 }} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Link to booking (optional) */}
          <div style={{ border: `2px solid ${selectedBookingId ? '#2563eb' : '#e5e7eb'}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: selectedBookingId ? '#2563eb' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Link to booking (optional)
            </div>
            <Field label="Select a finalized booking">
              <Select
                allowClear
                showSearch
                placeholder={contractBookings.length ? 'Choose booking to pre-fill dates & tenantù' : 'No eligible bookings yet'}
                style={{ width: '100%' }}
                value={selectedBookingId || undefined}
                onChange={(v) => applyBookingPrefill(v ?? '')}
                optionFilterProp="label"
                options={contractBookings.map((b) => {
                  const space = (b as Booking & { space?: { name?: string } }).space?.name ?? 'Space';
                  const statusLabel = b.status.replace(/_/g, ' ').toLowerCase();
                  return {
                    value: b.id,
                    label: `${b.booking_number} ù ${space} ù ${statusLabel}`,
                  };
                })}
              />
            </Field>
            {contractBookings.length === 0 && (
              <p style={{ margin: '10px 0 0', fontSize: 12, color: th.textMuted, lineHeight: 1.5 }}>
                Bookings appear here after reception completes the visit and the booking reaches
                <strong> Docs pending</strong> or <strong> Active</strong>.
                You can also open a booking from <strong>Bookings</strong> and click the contract icon.
              </p>
            )}
          </div>

          {/* -- BOOKING REFERENCE BANNER -- */}
          {isFromBooking && (
            <div style={{ background: 'linear-gradient(135deg,#1e40af,#2563eb)', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                <FileTextOutlined style={{ color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', marginBottom: 4 }}>
                  Contract created from Booking {bookingRef?.booking_number}
                </div>
                <div style={{ fontSize: 12, color: '#bfdbfe', lineHeight: 1.5 }}>
                  Space: <strong style={{ color: '#fff' }}>{bookingRef?.space_name || 'ù'}</strong><br />
                  Tenant, dates and currency have been <strong style={{ color: '#fff' }}>pre-filled automatically</strong>.<br />
                  You only need to fill in the <strong style={{ color: '#fde68a' }}>Monthly Rent</strong> and <strong style={{ color: '#fde68a' }}>Security Deposit</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Tenant */}
          {isSuperAdmin && (
            <div style={{ background: th.tableHead, border: `2px solid ${isFromBooking ? '#2563eb' : '#e5e7eb'}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isFromBooking ? '#2563eb' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                ?? Tenant {isFromBooking && <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '1px 8px', borderRadius: 10, fontSize: 10, marginLeft: 6, fontWeight: 700 }}>PRE-FILLED</span>}
              </div>
              <Field label="Select Tenant" required error={errors.tenant_id}>
                <Select value={form.tenant_id || undefined} onChange={v => setF('tenant_id', v)} placeholder="Select tenant..." style={{ width: '100%' }}
                  options={tenants.map((t: any) => ({ value: t.id, label: `${t.name} (${t.slug})` }))} />
              </Field>
            </div>
          )}

          {/* Contract Period */}
          <div style={{ border: `2px solid ${isFromBooking ? '#059669' : '#e5e7eb'}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: isFromBooking ? '#059669' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              ?? Contract Period {isFromBooking && <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 8px', borderRadius: 10, fontSize: 10, marginLeft: 6, fontWeight: 700 }}>PRE-FILLED FROM BOOKING</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <Field label="Start Date" required error={errors.start_date}>
                  <input
                    style={{ ...INPUT, borderColor: errors.start_date ? '#ef4444' : isFromBooking ? '#059669' : '#e5e7eb', background: isFromBooking ? '#f0fdf4' : '#fff', fontWeight: isFromBooking ? 600 : 400 }}
                    type="date" min={today} value={form.start_date} onChange={e => setF('start_date', e.target.value)}
                  />
                </Field>
                {isFromBooking && <div style={{ fontSize: 11, color: '#15803d', marginTop: 3 }}>? Auto-filled from booking</div>}
              </div>
              <div>
                <Field label="End Date" required error={errors.end_date}>
                  <input
                    style={{ ...INPUT, borderColor: errors.end_date ? '#ef4444' : isFromBooking ? '#059669' : '#e5e7eb', background: isFromBooking ? '#f0fdf4' : '#fff', fontWeight: isFromBooking ? 600 : 400 }}
                    type="date" min={form.start_date || today} value={form.end_date} onChange={e => setF('end_date', e.target.value)}
                  />
                </Field>
                {isFromBooking && <div style={{ fontSize: 11, color: '#15803d', marginTop: 3 }}>? Auto-filled from booking</div>}
              </div>
            </div>
            {durationMonths && (
              <div style={{ marginTop: 10, fontSize: 13, color: '#2563eb', fontWeight: 600 }}>
                ? Duration: {durationMonths} month{durationMonths > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Financials ù needs to be filled manually */}
          <div style={{ border: '2px solid #f59e0b', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              ?? Financials <span style={{ background: '#fef3c7', color: '#92400e', padding: '1px 8px', borderRadius: 10, fontSize: 10, marginLeft: 6, fontWeight: 700 }}>PLEASE FILL IN</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <Field label="Monthly Rent" required error={errors.monthly_rent}>
                  <input
                    style={{ ...INPUT, borderColor: errors.monthly_rent ? '#ef4444' : '#f59e0b', fontSize: 15, fontWeight: 600 }}
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={form.monthly_rent} onChange={e => setF('monthly_rent', e.target.value)}
                    autoFocus={isFromBooking}
                  />
                </Field>
              </div>
              <div>
                <Field label="Security Deposit" required error={errors.deposit_amount}>
                  <input
                    style={{ ...INPUT, borderColor: errors.deposit_amount ? '#ef4444' : '#f59e0b' }}
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={form.deposit_amount} onChange={e => setF('deposit_amount', e.target.value)}
                  />
                </Field>
              </div>
              <div>
                <Field label="Currency">
                  <Select value={form.currency} onChange={v => setF('currency', v)} style={{ width: '100%' }}
                    options={['USD','EUR','GBP','AED','TND'].map(c => ({ value: c, label: c }))} />
                </Field>
                {isFromBooking && <div style={{ fontSize: 11, color: '#15803d', marginTop: 3 }}>? Auto-filled</div>}
              </div>
            </div>
          </div>

          {/* Settings */}
          <div style={{ border: `1px solid ${th.cardBorder}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>?? Settings</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Payment Due Day (1-28)">
                <input style={INPUT} type="number" min="1" max="28" value={form.payment_due_day} onChange={e => setF('payment_due_day', e.target.value)} />
              </Field>
              <Field label="Auto Renew">
                <Select value={form.auto_renew} onChange={v => setF('auto_renew', v)} style={{ width: '100%' }}
                  options={[{ value: 'false', label: '? No ù manual renewal' }, { value: 'true', label: '? Yes ù auto renew' }]} />
              </Field>
            </div>
          </div>

          {/* Summary */}
          {form.monthly_rent && form.deposit_amount && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 10 }}>?? Contract Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <div style={{ background: th.cardBg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: th.textSub, marginBottom: 3 }}>Monthly Rent</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: th.text }}>{form.currency} {parseFloat(form.monthly_rent || '0').toLocaleString()}</div>
                </div>
                <div style={{ background: th.cardBg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: th.textSub, marginBottom: 3 }}>Security Deposit</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: th.text }}>{form.currency} {parseFloat(form.deposit_amount || '0').toLocaleString()}</div>
                </div>
                {durationMonths && (
                  <div style={{ background: th.cardBg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: th.textSub, marginBottom: 3 }}>Total ({durationMonths}mo)</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>{form.currency} {(parseFloat(form.monthly_rent) * durationMonths).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px 20px', borderTop: `1px solid ${th.divider}`, display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: th.cardBg, borderRadius: '0 0 16px 16px' }}>
          <button onClick={onClose} disabled={mutation.isPending} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: th.text }}>Cancel</button>
          <button onClick={handleSubmit} disabled={mutation.isPending} style={{ padding: '9px 22px', borderRadius: 8, background: mutation.isPending ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: mutation.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {mutation.isPending ? <><LoadingOutlined /> Creating...</> : <><PlusOutlined /> Create Contract</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Renew Modal --------------------------------------------------------------
function RenewModal({ contract, onClose }: { contract: LeaseContract; onClose: () => void }) {
  const { input: INPUT, t: th } = usePageTheme();
  const qc = useQueryClient();
  const [newEndDate, setNewEndDate] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: () => contractApi.renew(contract.id, new Date(newEndDate).toISOString()),
    onSuccess: () => { message.success('Contract renewed!'); qc.invalidateQueries({ queryKey: ['contracts'] }); onClose(); },
    onError:   (err: any) => { message.error(err?.response?.data?.message ?? 'Failed'); },
  });
  const handleSubmit = () => {
    if (!newEndDate) { setError('Required'); return; }
    if (new Date(newEndDate) <= new Date(contract.end_date)) { setError('Must be after current end date'); return; }
    mutation.mutate();
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: th.cardBg, borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${th.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: th.text }}>Renew Contract</h2><p style={{ margin: '2px 0 0', fontSize: 12, color: th.textSub }}>{contract.contract_number}</p></div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.textSub }}><CloseOutlined style={{ fontSize: 13 }} /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '10px 14px', background: th.tableHead, borderRadius: 8, fontSize: 13, color: th.textSub }}>
            Current end: <strong style={{ color: th.text }}>{formatDate(contract.end_date)}</strong>
          </div>
          <Field label="New End Date" required error={error}>
            <input style={{ ...INPUT, borderColor: error ? '#ef4444' : '#e5e7eb' }} type="date" min={contract.end_date.split('T')[0]} value={newEndDate} onChange={e => { setNewEndDate(e.target.value); setError(''); }} />
          </Field>
          {newEndDate && new Date(newEndDate) > new Date(contract.end_date) && (
            <div style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}>
              ? Extending by {Math.ceil((new Date(newEndDate).getTime() - new Date(contract.end_date).getTime()) / (86400000 * 30))} months
            </div>
          )}
        </div>
        <div style={{ padding: '14px 24px 20px', borderTop: `1px solid ${th.divider}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text }}>Cancel</button>
          <button onClick={handleSubmit} disabled={mutation.isPending} style={{ padding: '9px 22px', borderRadius: 8, background: mutation.isPending ? '#93c5fd' : 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {mutation.isPending ? <><LoadingOutlined /> Renewing...</> : <><RedoOutlined /> Renew</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Contract Detail Modal ----------------------------------------------------
function ContractDetailModal({ contract, onClose, canManage, isTenantAdmin }: {
  contract: LeaseContract | null; onClose: () => void;
  canManage: boolean; isTenantAdmin: boolean;
}) {
  const { t: th } = usePageTheme();
  const qc = useQueryClient();
  const [showRenew, setShowRenew] = useState(false);
  const signMut = useMutation({
    mutationFn: (id: string) => contractApi.sign(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['contracts'] }); message.success('Contract signed ù now ACTIVE! ??'); onClose(); },
    onError:    () => message.error('Failed to sign'),
  });
  const terminateMut = useMutation({
    mutationFn: (id: string) => contractApi.terminate(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['contracts'] }); message.success('Contract terminated'); onClose(); },
    onError:    () => message.error('Failed'),
  });
  if (!contract) return null;
  const sm        = STATUS_META[contract.status] ?? STATUS_META.DRAFT;
  const daysLeft  = getDaysLeft(contract.end_date);
  const isPending = signMut.isPending || terminateMut.isPending;
  return (
    <>
      {showRenew && canManage && <RenewModal contract={contract} onClose={() => setShowRenew(false)} />}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ background: th.cardBg, borderRadius: 16, width: '100%', maxWidth: 540, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
          <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${th.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: th.text }}>Contract Details</h2>
              <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{sm.label}</span>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.textSub }}><CloseOutlined style={{ fontSize: 13 }} /></button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {isTenantAdmin && contract.status === 'DRAFT' && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ fontSize: 20 }}>??</span>
                <div><div style={{ fontWeight: 700, color: '#1d4ed8' }}>Action required ù please review and sign</div><div style={{ color: '#3b82f6', fontSize: 12, marginTop: 2 }}>This contract is waiting for your signature.</div></div>
              </div>
            )}
            {daysLeft > 0 && daysLeft <= 30 && contract.status === 'ACTIVE' && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <WarningOutlined style={{ color: '#d97706' }} />
                <span style={{ color: '#92400e', fontWeight: 500 }}>Expires in {daysLeft} days{canManage ? ' ù consider renewing' : ' ù contact your manager'}</span>
              </div>
            )}
            <div style={{ background: th.tableHead, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 24 }}>
              <div><div style={{ fontSize: 10, color: th.textMuted, fontWeight: 500, marginBottom: 2 }}>Monthly Rent</div><div style={{ fontSize: 20, fontWeight: 800, color: th.text }}>{contract.currency} {parseFloat(contract.monthly_rent).toLocaleString()}</div></div>
              <div style={{ borderLeft: `1px solid ${th.cardBorder}`, margin: '0 4px' }} />
              <div><div style={{ fontSize: 10, color: th.textMuted, fontWeight: 500, marginBottom: 2 }}>Deposit</div><div style={{ fontSize: 20, fontWeight: 800, color: th.text }}>{contract.currency} {parseFloat(contract.deposit_amount).toLocaleString()}</div></div>
              {contract.auto_renew && <><div style={{ borderLeft: `1px solid ${th.cardBorder}`, margin: '0 4px' }} /><div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#059669', fontWeight: 600 }}><RedoOutlined /> Auto-renew</div></>}
            </div>
            {([
              ['Contract #', contract.contract_number],
              ['Start Date', formatDate(contract.start_date)],
              ['End Date',   formatDate(contract.end_date)],
              ['Days Left',  daysLeft > 0 ? `${daysLeft} days` : `Ended ${Math.abs(daysLeft)} days ago`],
              ['Payment Due',`Day ${contract.payment_due_day} of each month`],
              ['Signed At',  contract.signed_at ? formatDate(contract.signed_at) : 'Not signed yet'],
              ['Created',    formatDate(contract.created_at)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${th.divider}`, fontSize: 13 }}>
                <span style={{ color: th.textSub }}>{k}</span>
                <span style={{ fontWeight: 600, color: th.text, fontFamily: k === 'Contract #' ? 'monospace' : undefined }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
              {isTenantAdmin && contract.status === 'DRAFT' && (
                <button onClick={() => { if (window.confirm(`Sign contract ${contract.contract_number}?`)) signMut.mutate(contract.id); }} disabled={isPending}
                  style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {signMut.isPending ? <><LoadingOutlined /> Signing...</> : <><CheckCircleOutlined /> Sign Contract</>}
                </button>
              )}
              {canManage && contract.status === 'DRAFT' && (
                <button onClick={() => signMut.mutate(contract.id)} disabled={isPending}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {signMut.isPending ? <LoadingOutlined /> : <CheckCircleOutlined />} Sign
                </button>
              )}
              {canManage && (contract.status === 'ACTIVE' || contract.status === 'EXPIRED') && (
                <button onClick={() => setShowRenew(true)} disabled={isPending}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <RedoOutlined /> Renew
                </button>
              )}
              {canManage && contract.status === 'ACTIVE' && (
                <button onClick={() => { if (window.confirm(`Terminate ${contract.contract_number}?`)) terminateMut.mutate(contract.id); }} disabled={isPending}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Terminate
                </button>
              )}
              <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, background: th.cardBg, border: `1px solid ${th.cardBorder}`, fontSize: 13, cursor: 'pointer', color: th.text }}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// --- Edit Contract Modal ------------------------------------------------------
function EditContractModal({ contract, onClose, isSuperAdmin }: { contract: LeaseContract; onClose: () => void; isSuperAdmin: boolean }) {
  const { input: INPUT, t: th } = usePageTheme();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    tenant_id: contract.tenant_id, start_date: contract.start_date, end_date: contract.end_date,
    monthly_rent: contract.monthly_rent, deposit_amount: contract.deposit_amount,
    currency: contract.currency, payment_due_day: contract.payment_due_day.toString(),
    auto_renew: contract.auto_renew.toString(),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => { const n = { ...e }; delete n[k]; return n; }); };
  const { data: tenantsRaw } = useQuery({ queryKey: ['tenants-edit'], queryFn: () => tenantApi.getAll().then(r => r.data), enabled: isSuperAdmin });
  const tenants = toArray<any>(tenantsRaw);
  const mutation = useMutation({
    mutationFn: (d: any) => contractApi.update(contract.id, d),
    onSuccess: () => { message.success('Updated!'); qc.invalidateQueries({ queryKey: ['contracts'] }); onClose(); },
    onError:   (err: any) => { message.error(err?.response?.data?.message ?? 'Failed'); },
  });
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.tenant_id || !form.start_date || !form.end_date || !form.monthly_rent || !form.deposit_amount) Object.assign(e, { tenant_id: 'Required', start_date: 'Required', end_date: 'Required', monthly_rent: 'Required', deposit_amount: 'Required' });
    return e;
  };
  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    mutation.mutate({
      start_date: new Date(form.start_date).toISOString(),
      end_date: new Date(form.end_date).toISOString(),
      monthly_rent: parseFloat(form.monthly_rent),
      deposit_amount: parseFloat(form.deposit_amount),
      currency: form.currency,
      payment_due_day: parseInt(form.payment_due_day, 10),
      auto_renew: form.auto_renew === 'true',
    });
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: th.cardBg, borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div><h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: th.text }}>Edit Contract</h2><p style={{ margin: 0, fontSize: 13, color: th.textSub }}>Update lease agreement</p></div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.textSub }}><CloseOutlined /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isSuperAdmin && <Field label="Tenant" required error={errors.tenant_id}><select style={INPUT} value={form.tenant_id} onChange={e => setF('tenant_id', e.target.value)}><option value="">Select tenant</option>{tenants.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Start Date" required error={errors.start_date}><input type="date" style={INPUT} value={form.start_date} onChange={e => setF('start_date', e.target.value)} /></Field>
            <Field label="End Date" required error={errors.end_date}><input type="date" style={INPUT} value={form.end_date} onChange={e => setF('end_date', e.target.value)} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Monthly Rent" required error={errors.monthly_rent}><input type="number" step="0.01" min="0" style={INPUT} value={form.monthly_rent} onChange={e => setF('monthly_rent', e.target.value)} /></Field>
            <Field label="Deposit" required error={errors.deposit_amount}><input type="number" step="0.01" min="0" style={INPUT} value={form.deposit_amount} onChange={e => setF('deposit_amount', e.target.value)} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Currency"><select style={INPUT} value={form.currency} onChange={e => setF('currency', e.target.value)}>{['USD','EUR','GBP','AED','TND'].map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
            <Field label="Payment Due Day"><select style={INPUT} value={form.payment_due_day} onChange={e => setF('payment_due_day', e.target.value)}>{Array.from({ length: 28 }, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}</select></Field>
          </div>
          <Field label="Auto Renew"><select style={INPUT} value={form.auto_renew} onChange={e => setF('auto_renew', e.target.value)}><option value="false">No</option><option value="true">Yes</option></select></Field>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 20px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text }}>Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} style={{ flex: 1, padding: '9px 20px', borderRadius: 8, background: mutation.isPending ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Page ---------------------------------------------------------------------
export default function ContractsPage() {

  const { card: CARD, headerCard, input: INPUT, t: th } = usePageTheme();
  const qc       = useQueryClient();
  const location = useLocation();
  const { user } = useAuthStore();

  const tenantId      = (user as any)?.tenant_id ?? '';
  const userId        = user?.id ?? '';
  const isSuperAdmin  = user?.role === 'SUPER_ADMIN';
  const isSiteManager = user?.role === 'MANAGER';
  const isClientAdmin = user?.role === 'CLIENT_ADMIN';
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';
  const canManage     = isSuperAdmin || isSiteManager || isClientAdmin;

  const [q,               setQ]              = useState('');
  const [statusFilt,      setStatus]         = useState('');
  const [newOpen,         setNew]            = useState(false);
  const [prefillData,     setPrefillData]    = useState<PrefillData | null>(null);
  const [selected,        setSelected]       = useState<LeaseContract | null>(null);
  const [editingContract, setEditingContract]= useState<LeaseContract | null>(null);

  // Auto-open modal when coming from BookingsPage with prefill state
  useEffect(() => {
    const fromBooking = location.state?.fromBooking as PrefillData | undefined;
    if (fromBooking && canManage) {
      setPrefillData(fromBooking);
      setNew(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, canManage]);

  const { data: contractsRaw = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['contracts', canManage ? 'all' : tenantId, statusFilt],
    queryFn:  () => contractApi.getAll({
      ...(tenantId && !canManage ? { tenantId } : {}),
      ...(statusFilt ? { status: statusFilt } : {}),
    }).then(r => r.data),
  });
  const contracts: LeaseContract[] = toArray(contractsRaw);

  const { data: expiringRaw = [] } = useQuery({
    queryKey: ['contracts-expiring'],
    queryFn:  () => contractApi.getExpiring(30).then(r => r.data),
    enabled:  canManage,
  });
  const expiring: any[] = toArray(expiringRaw);

  const signMut = useMutation({ mutationFn: (id: string) => contractApi.sign(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); message.success('Signed!'); }, onError: () => message.error('Failed') });
  const terminateMut = useMutation({ mutationFn: (id: string) => contractApi.terminate(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); message.success('Terminated'); }, onError: () => message.error('Failed') });
  const deleteMut = useMutation({ mutationFn: (id: string) => contractApi.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); message.success('Deleted'); }, onError: () => message.error('Failed') });

  const filtered     = contracts.filter(c => !q || c.contract_number.toLowerCase().includes(q.toLowerCase()));
  const active       = contracts.filter(c => c.status === 'ACTIVE').length;
  const draft        = contracts.filter(c => c.status === 'DRAFT').length;
  const closed       = contracts.filter(c => c.status === 'EXPIRED' || c.status === 'TERMINATED').length;
  const totalRent    = contracts.filter(c => c.status === 'ACTIVE').reduce((s, c) => s + parseFloat(c.monthly_rent), 0);
  const needsSigning = contracts.filter(c => c.status === 'DRAFT').length;

  const handleCloseNew = () => { setNew(false); setPrefillData(null); };
  const handleOpenNew  = () => { setPrefillData(null); setNew(true); };

  return (
    <PageShell>

      {newOpen && canManage && <NewContractModal onClose={handleCloseNew} tenantId={tenantId} userId={userId} isSuperAdmin={isSuperAdmin} prefillData={prefillData} />}
      {editingContract && canManage && <EditContractModal contract={editingContract} onClose={() => setEditingContract(null)} isSuperAdmin={isSuperAdmin} />}
      <ContractDetailModal contract={selected} onClose={() => setSelected(null)} canManage={canManage} isTenantAdmin={isTenantAdmin} />

      {/* Header */}
      <div style={headerCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: th.text }}>{isTenantAdmin ? 'My Lease Contracts' : 'Lease Contracts'}</h2>
            <p style={{ margin: 0, color: th.textSub, fontSize: 14 }}>{isTenantAdmin ? 'View and sign your lease agreements' : 'Manage all lease agreements and their lifecycle'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text, display: 'flex', alignItems: 'center', gap: 6 }}><ReloadOutlined /></button>
            <button style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text, display: 'flex', alignItems: 'center', gap: 6 }}><DownloadOutlined /> Export</button>
            {canManage && (
              <button onClick={handleOpenNew} style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
                <PlusOutlined /> New Contract
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
          {[
            { label: 'Total',        value: contracts.length, sub: 'All contracts',        color: '#2563eb', bg: '#eff6ff', icon: '??' },
            { label: 'Active',       value: active,           sub: 'Signed & running',     color: '#059669', bg: '#f0fdf4', icon: '?' },
            { label: 'Draft',        value: draft,            sub: isTenantAdmin && draft > 0 ? '? Needs your signature' : 'Pending signature', color: draft > 0 ? '#d97706' : '#94a3b8', bg: draft > 0 ? '#fffbeb' : '#f8fafc', icon: draft > 0 && isTenantAdmin ? '??' : '??' },
            { label: 'Closed',       value: closed,           sub: 'Expired / Terminated', color: '#dc2626', bg: '#fef2f2', icon: '??' },
            { label: canManage ? 'Monthly Rent' : 'Monthly Cost', value: `$${Math.round(totalRent).toLocaleString()}`, sub: 'From active contracts', color: '#7c3aed', bg: '#f5f3ff', icon: '??' },
          ].map(s => (
            <div key={s.label} style={{ border: `1px solid ${s.label === 'Draft' && draft > 0 && isTenantAdmin ? '#fde68a' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 14px', background: s.label === 'Draft' && draft > 0 && isTenantAdmin ? '#fffbeb' : '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 11, color: th.textSub, fontWeight: 500 }}>{s.label}</p>
                  <p style={{ margin: '0 0 3px', fontSize: typeof s.value === 'string' ? 16 : 22, fontWeight: 800, color: th.text, lineHeight: 1 }}>{isLoading ? 'ù' : s.value}</p>
                  <p style={{ margin: 0, fontSize: 11, color: s.color }}>{s.sub}</p>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isTenantAdmin && needsSigning > 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>??</span>
          <div><span style={{ fontWeight: 700, color: '#1d4ed8', fontSize: 14 }}>{needsSigning} contract{needsSigning > 1 ? 's' : ''} waiting for your signature</span><div style={{ color: '#3b82f6', fontSize: 12, marginTop: 2 }}>Click on a Draft contract and sign it to activate your lease.</div></div>
        </div>
      )}
      {canManage && expiring.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <WarningOutlined style={{ color: '#d97706', fontSize: 18 }} />
          <div><span style={{ fontWeight: 600, color: '#92400e', fontSize: 14 }}>{expiring.length} contract{expiring.length > 1 ? 's' : ''} expiring within 30 days</span><span style={{ color: '#92400e', fontSize: 13, marginLeft: 8 }}>Review and renew.</span></div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input prefix={<SearchOutlined style={{ color: th.textMuted }} />} placeholder="Search by contract #..." value={q} onChange={e => setQ(e.target.value)} style={{ width: 240, borderRadius: 8 }} />
        <Select value={statusFilt || 'all'} onChange={v => setStatus(v === 'all' ? '' : v)} style={{ width: 170 }}
          options={[{ value: 'all', label: 'All Status' },{ value: 'DRAFT', label: '?? Draft' },{ value: 'ACTIVE', label: '? Active' },{ value: 'EXPIRED', label: '? Expired' },{ value: 'TERMINATED', label: '?? Terminated' },{ value: 'RENEWED', label: '?? Renewed' }]} />
        <div style={{ marginLeft: 'auto', fontSize: 13, color: th.textSub }}>Showing <strong style={{ color: th.text }}>{filtered.length}</strong> of {contracts.length}</div>
      </div>

      {isError && <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}><div style={{ fontSize: 36, marginBottom: 12 }}>??</div><div style={{ fontWeight: 600, color: th.text, marginBottom: 8 }}>Failed to load</div><button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button></div>}
      {isLoading && <div style={CARD}>{Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ padding: '16px 20px', borderBottom: i < 3 ? `1px solid ${th.divider}` : 'none' }}><Skeleton active paragraph={{ rows: 1 }} /></div>)}</div>}

      {!isLoading && !isError && filtered.length === 0 && (
        <div style={{ ...CARD, padding: '60px', textAlign: 'center' }}>
          <FileTextOutlined style={{ fontSize: 48, color: '#e5e7eb', display: 'block', margin: '0 auto 16px' }} />
          <Empty description={isTenantAdmin ? (contracts.length === 0 ? 'No contracts yet ù your manager will send you one.' : 'No matches.') : (contracts.length === 0 ? 'No contracts yet.' : 'No matches.')} />
          {canManage && contracts.length === 0 && <button onClick={handleOpenNew} style={{ marginTop: 16, padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}><PlusOutlined style={{ marginRight: 6 }} /> New Contract</button>}
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div style={{ ...CARD, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.9fr 1.2fr', padding: '11px 20px', background: th.tableHead, borderBottom: `1px solid ${th.cardBorder}`, fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Contract #</span><span>Start</span><span>End</span><span>Monthly Rent</span><span>Deposit</span><span>Status</span><span>Actions</span>
          </div>
          {filtered.map((c: LeaseContract, i: number) => {
            const sm = STATUS_META[c.status] ?? STATUS_META.DRAFT;
            const daysLeft = getDaysLeft(c.end_date);
            const expiringSoon = c.status === 'ACTIVE' && daysLeft > 0 && daysLeft <= 30;
            const overdue = daysLeft < 0;
            const needsSign = isTenantAdmin && c.status === 'DRAFT';
            return (
              <div key={c.id}
                style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.9fr 1.2fr', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? `1px solid ${th.divider}` : 'none', alignItems: 'center', transition: 'background 0.1s', background: needsSign ? '#fefce8' : expiringSoon ? '#fffbeb' : '' }}
                onMouseEnter={e => (e.currentTarget.style.background = needsSign ? '#fef9c3' : expiringSoon ? '#fef9c3' : '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = needsSign ? '#fefce8' : expiringSoon ? '#fffbeb' : '')}
              >
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{c.contract_number}</div>
                  {needsSign    && <div style={{ fontSize: 10, color: '#d97706', fontWeight: 700 }}>? Awaiting your signature</div>}
                  {expiringSoon && <div style={{ fontSize: 10, color: '#d97706', fontWeight: 600 }}>? {daysLeft}d left</div>}
                  {overdue && c.status === 'ACTIVE' && <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>? Overdue</div>}
                  {c.auto_renew && <div style={{ fontSize: 10, color: '#059669' }}>? Auto-renew</div>}
                </div>
                <div style={{ fontSize: 12, color: th.text }}>{formatDate(c.start_date)}</div>
                <div style={{ fontSize: 12, color: expiringSoon ? '#d97706' : overdue ? '#dc2626' : '#374151', fontWeight: expiringSoon || overdue ? 600 : 400 }}>{formatDate(c.end_date)}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: th.text }}>{c.currency} {parseFloat(c.monthly_rent).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: th.textSub }}>{c.currency} {parseFloat(c.deposit_amount).toLocaleString()}</div>
                <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-block' }}>{sm.label}</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => setSelected(c)} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="View"><EyeOutlined style={{ fontSize: 12, color: th.textSub }} /></button>
                  {isTenantAdmin && c.status === 'DRAFT' && (
                    <button onClick={() => { if (window.confirm(`Sign ${c.contract_number}?`)) signMut.mutate(c.id); }} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Sign"><CheckCircleOutlined style={{ fontSize: 12, color: '#2563eb' }} /></button>
                  )}
                  {canManage && <>
                    <button onClick={() => setEditingContract(c)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fbbf24', background: '#fffbeb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Edit"><EditOutlined style={{ fontSize: 12, color: '#f59e0b' }} /></button>
                    {c.status === 'DRAFT' && <button onClick={() => signMut.mutate(c.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Sign"><CheckCircleOutlined style={{ fontSize: 12, color: '#15803d' }} /></button>}
                    {(c.status === 'ACTIVE' || c.status === 'EXPIRED') && <button onClick={() => setSelected(c)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Renew"><RedoOutlined style={{ fontSize: 12, color: '#059669' }} /></button>}
                    {c.status === 'ACTIVE' && <button onClick={() => { if (window.confirm(`Terminate ${c.contract_number}?`)) terminateMut.mutate(c.id); }} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Terminate"><StopOutlined style={{ fontSize: 12, color: '#dc2626' }} /></button>}
                    {(c.status === 'DRAFT' || c.status === 'EXPIRED' || c.status === 'TERMINATED') && <button onClick={() => { if (window.confirm(`Delete ${c.contract_number}?`)) deleteMut.mutate(c.id); }} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete"><DeleteOutlined style={{ fontSize: 12, color: '#dc2626' }} /></button>}
                  </>}
                </div>
              </div>
            );
          })}
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${th.divider}`, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: th.textMuted }}>
            <span>Showing {filtered.length} of {contracts.length} contracts</span>
            <span>{isTenantAdmin ? `${active} active ù ${draft} pending signature` : `${active} active ù ${draft} pending ù $${Math.round(totalRent).toLocaleString()}/mo`}</span>
          </div>
        </div>
      )}
    </PageShell>
  );
}
