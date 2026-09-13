import { useState, useMemo, useRef, useEffect, type CSSProperties } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';
import { Input, Select, Skeleton, Empty, Tabs } from 'antd';
import { message, modal } from '../../utils/feedback';
import {
  SearchOutlined, ReloadOutlined, DownloadOutlined,
  DollarOutlined, SendOutlined, WarningOutlined,
  CloseCircleOutlined, EditOutlined, DeleteOutlined,
  CloseOutlined, LoadingOutlined, FileTextOutlined,
  CheckCircleOutlined, EyeOutlined, PlusOutlined, UploadOutlined,
  BankOutlined, CreditCardOutlined, MoneyCollectOutlined, GlobalOutlined,
} from '@ant-design/icons';
import { billingApi, contractApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { InvoiceDownloadButton, InvoicePreviewModal } from '../../components/InvoicePDF';
import type { Invoice, Payment, InvoiceStatus } from '../../types';
import { currencySymbol, DEFAULT_CURRENCY } from '../../constants/qatar';

// --- Helpers ------------------------------------------------------------------
const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; bg: string; color: string }> = {
  DRAFT:          { label: 'Draft',    bg: '#f1f5f9', color: '#475569' },
  ISSUED:         { label: 'Issued',   bg: '#dbeafe', color: '#1d4ed8' },
  SENT:           { label: 'Sent',     bg: '#ede9fe', color: '#6d28d9' },
  PARTIALLY_PAID: { label: 'Partial',  bg: '#fef3c7', color: '#92400e' },
  PAID:           { label: 'Paid',     bg: '#dcfce7', color: '#15803d' },
  OVERDUE:        { label: 'Overdue',  bg: '#fee2e2', color: '#b91c1c' },
  CANCELLED:      { label: 'Cancelled',bg: '#f1f5f9', color: '#94a3b8' },
};

const PAYMENT_METHOD_META: Record<string, {
  label: string;
  bg: string;
  color: string;
  desc: string;
  Icon: typeof DollarOutlined;
}> = {
  CASH:           { label: 'Cash',            bg: '#f0fdf4', color: '#15803d', desc: 'Physical cash payment on site', Icon: MoneyCollectOutlined },
  CHECK:          { label: 'Cheque',          bg: '#eff6ff', color: '#1d4ed8', desc: 'Enter the cheque number now; attach the scanned PDF from the Payments tab after recording', Icon: FileTextOutlined },
  BANK_TRANSFER:  { label: 'Bank Transfer',   bg: '#f5f3ff', color: '#6d28d9', desc: 'Wire/SEPA transfer', Icon: BankOutlined },
  CREDIT_CARD:    { label: 'Credit Card',     bg: '#fef3c7', color: '#92400e', desc: 'Card payment via terminal', Icon: CreditCardOutlined },
  ONLINE_PAYMENT: { label: 'Online Platform', bg: '#f0fdf4', color: '#059669', desc: 'Paid via platform', Icon: GlobalOutlined },
};

function PaymentMethodIcon({ method, size = 20, color }: { method: string; size?: number; color?: string }) {
  const mm = PAYMENT_METHOD_META[method] ?? PAYMENT_METHOD_META.BANK_TRANSFER;
  const { Icon } = mm;
  return <Icon style={{ fontSize: size, color: color ?? mm.color }} />;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatAmt(amount: string | number, currency = DEFAULT_CURRENCY) {
  const sym = currencySymbol(currency);
  return `${sym}${parseFloat(String(amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date();
}
function payMethod(p: Payment) {
  return String((p as any).method ?? p.payment_method ?? 'BANK_TRANSFER');
}
function payTenantLabel(p: Payment) {
  return (p as any).tenant?.name ?? (p as any).invoice?.tenant?.name ?? '—';
}
function payableInvoices(list: Invoice[]) {
  return list.filter((i) => !['PAID', 'CANCELLED'].includes(i.status));
}
function hasPendingPayment(inv: Invoice) {
  return (inv.payments ?? []).some((p) => p.status === 'PENDING');
}
function canTenantPay(inv: Invoice) {
  return payableInvoices([inv]).length > 0 && !hasPendingPayment(inv);
}

function toArray<T>(raw: any): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

// --- Generate Invoice Modal ---------------------------------------------------
function GenerateInvoiceModal({ onClose, tenantId, canManage }: {
  onClose: () => void; userId: string; tenantId: string; canManage: boolean;
}) {
  const { card: CARD, input: INPUT, t: th } = usePageTheme();
  const LABEL: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: th.textSub, display: 'block', marginBottom: 5 };
  const qc = useQueryClient();
  // Computed once per mount: these only seed the form below, and calling
  // Date.now() on every render makes the value drift under the React Compiler.
  const [[today, dueDefault]] = useState(() => [
    new Date().toISOString().split('T')[0],
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  ]);

  const [form, setForm] = useState({ contract_id: '', type: 'MONTHLY_RENT', issue_date: today, due_date: dueDefault, description: '', currency: DEFAULT_CURRENCY, amount: '', tax_rate: '0' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => { const n = { ...e }; delete n[k]; return n; }); };

  const { data: contractsRaw } = useQuery({
    queryKey: ['contracts-for-invoice', canManage ? 'all' : tenantId],
    queryFn: async () => {
      const res = await contractApi.getAll(
        canManage ? undefined : tenantId ? { tenantId } : undefined,
      );
      const list = toArray<any>(res?.data ?? res);
      return list.filter((c) => ['ACTIVE', 'DRAFT'].includes(c.status));
    },
  });
  const contracts = toArray<any>(contractsRaw);
  const selectedContract = contracts.find((c: any) => c.id === form.contract_id);

  const handleContractChange = (v: string) => {
    const c = contracts.find((x: any) => x.id === v);
    setForm(f => ({ ...f, contract_id: v, amount: c ? c.monthly_rent : f.amount, currency: c ? c.currency : f.currency, description: c ? `Monthly rent — ${c.contract_number}` : f.description }));
    setErrors(e => { const n = { ...e }; delete n.contract_id; return n; });
  };

  const mutation = useMutation({
    mutationFn: (d: any) => billingApi.createInvoice(d),
    onSuccess: () => {
      message.success('Invoice generated and sent to tenant admin');
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['billing-summary'] });
      onClose();
    },
    onError: (err: any) => { const msg = err?.response?.data?.message ?? 'Failed'; message.error(Array.isArray(msg) ? msg.join(', ') : msg); },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.contract_id) e.contract_id = 'Select a contract';
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = 'Valid amount required';
    if (!form.issue_date) e.issue_date = 'Required';
    if (!form.due_date)   e.due_date   = 'Required';
    if (form.issue_date && form.due_date && new Date(form.due_date) <= new Date(form.issue_date)) e.due_date = 'Must be after issue date';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const subtotal = parseFloat(form.amount);
    const taxRate = parseFloat(form.tax_rate || '0');
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;
    mutation.mutate({
      contract_id: form.contract_id,
      tenant_id: selectedContract?.tenant_id ?? tenantId,
      type: form.type,
      issue_date: new Date(form.issue_date).toISOString(),
      due_date: new Date(form.due_date).toISOString(),
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      currency: form.currency,
      notes: form.description || undefined,
      status: 'ISSUED',
    });
  };

  const INVOICE_TYPES = [
    { value: 'MONTHLY_RENT',  label: '🏠 Monthly Rent'  },
    { value: 'USAGE_BASED',   label: '📊 Usage Based'   },
    { value: 'DEPOSIT',       label: '🔐 Deposit'       },
    { value: 'ADDON_SERVICE', label: '✨ Addon Service' },
    { value: 'LATE_FEE',      label: '⚠️ Late Fee'      },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: th.cardBg, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${th.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: th.cardBg, zIndex: 1, borderRadius: '16px 16px 0 0' }}>
          <div><h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: th.text }}>Generate Invoice</h2><p style={{ margin: '2px 0 0', fontSize: 12, color: th.textMuted }}>Create invoice from an active lease contract</p></div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.textSub }}><CloseOutlined style={{ fontSize: 13 }} /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Contract */}
          <div style={{ border: '2px solid #2563eb', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>📄 Source Contract</div>
            <Select value={form.contract_id || undefined} onChange={handleContractChange} placeholder="Select active contract..." style={{ width: '100%' }} options={contracts.map((c: any) => ({ value: c.id, label: `${c.contract_number} · ${c.tenant?.name ?? 'Tenant'} · ${c.status} · ${c.currency ?? 'USD'} ${parseFloat(String(c.monthly_rent ?? 0)).toLocaleString()}/mo` }))} />
            {errors.contract_id && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.contract_id}</div>}
            {selectedContract && (
              <div style={{ marginTop: 10, background: '#eff6ff', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#1d4ed8', display: 'flex', gap: 16 }}>
                <span>?? {formatDate(selectedContract.start_date)} ? {formatDate(selectedContract.end_date)}</span>
                <span>?? {selectedContract.currency} {parseFloat(selectedContract.monthly_rent).toLocaleString()}/mo</span>
              </div>
            )}
          </div>
          {/* Type */}
          <div><label style={LABEL}>Invoice Type</label><Select value={form.type} onChange={v => setF('type', v)} style={{ width: '100%' }} options={INVOICE_TYPES} /></div>
          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label style={LABEL}>Issue Date <span style={{ color: '#ef4444' }}>*</span></label><input style={{ ...INPUT, borderColor: errors.issue_date ? '#ef4444' : '#e5e7eb' }} type="date" value={form.issue_date} onChange={e => setF('issue_date', e.target.value)} />{errors.issue_date && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.issue_date}</div>}</div>
            <div><label style={LABEL}>Due Date <span style={{ color: '#ef4444' }}>*</span></label><input style={{ ...INPUT, borderColor: errors.due_date ? '#ef4444' : '#e5e7eb' }} type="date" min={form.issue_date} value={form.due_date} onChange={e => setF('due_date', e.target.value)} />{errors.due_date && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.due_date}</div>}</div>
          </div>
          {/* Amount */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div><label style={LABEL}>Amount <span style={{ color: '#ef4444' }}>*</span></label><input style={{ ...INPUT, borderColor: errors.amount ? '#ef4444' : '#e5e7eb', fontWeight: 700, fontSize: 15 }} type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setF('amount', e.target.value)} />{errors.amount && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.amount}</div>}</div>
            <div><label style={LABEL}>Tax %</label><input style={INPUT} type="number" min="0" step="0.01" placeholder="0" value={form.tax_rate} onChange={e => setF('tax_rate', e.target.value)} /><div style={{ fontSize: 10, color: th.textMuted, marginTop: 3 }}>Qatar: 0% (no VAT on leasing)</div></div>
            <div><label style={LABEL}>Currency</label><Select value={form.currency} onChange={v => setF('currency', v)} style={{ width: '100%' }} options={['QAR','USD','EUR','GBP','AED'].map(c => ({ value: c, label: c }))} /></div>
          </div>
          {/* Description */}
          <div><label style={LABEL}>Description</label><input style={INPUT} type="text" placeholder="e.g. Monthly rent — April 2026" value={form.description} onChange={e => setF('description', e.target.value)} /></div>
          {/* Preview */}
          {form.amount && form.contract_id && (() => {
            const subtotal = parseFloat(form.amount || '0');
            const taxRate = parseFloat(form.tax_rate || '0');
            const taxAmount = (subtotal * taxRate) / 100;
            const total = subtotal + taxAmount;
            return (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', marginBottom: 6 }}>Invoice Preview</div>
              <div style={{ fontSize: 13, color: th.text, lineHeight: 1.8 }}>
                <div>Subtotal: <strong>{formatAmt(subtotal, form.currency)}</strong></div>
                <div>Tax ({taxRate}%): <strong>{formatAmt(taxAmount, form.currency)}</strong></div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Total: {formatAmt(total, form.currency)}</div>
              </div>
            </div>
            );
          })()}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#1d4ed8' }}>
            The invoice will be emailed to the tenant admin. They submit payment from their portal; you confirm it once received.
          </div>
        </div>
        <div style={{ padding: '14px 24px 20px', borderTop: `1px solid ${th.divider}`, display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: th.cardBg, borderRadius: '0 0 16px 16px' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: th.text }}>Cancel</button>
          <button onClick={handleSubmit} disabled={mutation.isPending} style={{ padding: '9px 22px', borderRadius: 8, background: mutation.isPending ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: mutation.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {mutation.isPending ? <><LoadingOutlined /> Processing...</> : <><SendOutlined /> Generate & Send to Tenant</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChequeUploadButton({ paymentId, onDone }: { paymentId: string; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMut = useMutation({
    mutationFn: (file: File) => billingApi.uploadPaymentCheque(paymentId, file),
    onSuccess: () => { message.success('Cheque PDF uploaded'); onDone(); },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Upload failed'),
  });
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadMut.mutate(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={uploadMut.isPending}
        onClick={() => inputRef.current?.click()}
        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', cursor: uploadMut.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        title="Upload cheque PDF"
      >
        {uploadMut.isPending ? <LoadingOutlined style={{ fontSize: 11, color: '#1d4ed8' }} /> : <UploadOutlined style={{ fontSize: 11, color: '#1d4ed8' }} />}
      </button>
    </>
  );
}

// --- Record Payment Modal (single entry point for all payments) ---------------
function RecordPaymentModal({
  invoice: initialInvoice,
  onClose,
  tenantId,
  userId,
  allInvoices,
  mode = 'record',
}: {
  invoice: Invoice | null;
  onClose: () => void;
  tenantId: string;
  userId: string;
  allInvoices: Invoice[];
  mode?: 'submit' | 'record';
}) {
  const isSubmit = mode === 'submit';
  const { input: INPUT, t: th } = usePageTheme();
  const LABEL: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: th.textSub, display: 'block', marginBottom: 5 };
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const [selectedId, setSelectedId] = useState(initialInvoice?.id ?? '');
  const [method, setMethod] = useState<string>('CASH');
  const [form, setForm] = useState({ amount: '', payment_date: today, reference_number: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => { const n = { ...e }; delete n[k]; return n; }); };

  const invoiceRemaining = (inv: Invoice) => {
    const paid = (inv.payments ?? [])
      .filter((p) => p.status === 'COMPLETED')
      .reduce((s, p) => s + parseFloat(String((p as any).amount ?? 0)), 0);
    const rem = parseFloat(String(inv.total_amount)) - paid;
    return rem > 0 ? rem : parseFloat(String(inv.total_amount));
  };

  const unpaid = useMemo(
    () => payableInvoices(allInvoices).filter((i) => isSubmit ? canTenantPay(i) : true),
    [allInvoices, isSubmit],
  );
  const invoice = initialInvoice ?? unpaid.find((i) => i.id === selectedId) ?? null;

  const mutation = useMutation({
    mutationFn: (d: any) => billingApi.createPayment(d).then((res) => res.data),
    onSuccess: () => {
      message.success(isSubmit ? 'Payment submitted — awaiting finance confirmation' : 'Payment recorded!');
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['billing-summary'] });
      onClose();
    },
    onError: (err: any) => {
      if (!err?.response) {
        message.error('Cannot reach the API. Start the backend and try again.');
        return;
      }
      const msg = err?.response?.data?.message ?? err?.userMessage ?? 'Failed to record payment';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  useEffect(() => {
    if (!invoice) return;
    setForm((f) => (f.amount ? f : { ...f, amount: String(invoiceRemaining(invoice)) }));
  }, [invoice]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!invoice) e.invoice = 'Select an invoice';
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = 'Enter how much was paid toward this invoice';
    if (!form.payment_date) e.payment_date = 'Required';
    if (method === 'CHECK' && !form.reference_number) e.reference_number = 'Cheque number required';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const paymentTenantId =
      (invoice as any)?.tenant_id ?? (invoice as any)?.tenant?.id ?? tenantId;
    if (!paymentTenantId) {
      message.error('Could not determine tenant for this invoice');
      return;
    }
    mutation.mutate({
      tenant_id: paymentTenantId,
      invoice_id: invoice!.id,
      recorded_by_user_id: userId,
      payment_method: method,
      amount: parseFloat(form.amount),
      payment_date: new Date(form.payment_date).toISOString(),
      reference_number: form.reference_number || undefined,
    });
  };

  const onPickInvoice = (id: string) => {
    setSelectedId(id);
    const inv = unpaid.find((i) => i.id === id);
    if (!inv) return;
    setForm((f) => ({ ...f, amount: String(invoiceRemaining(inv)) }));
  };

  if (!initialInvoice && unpaid.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ background: th.cardBg, borderRadius: 16, padding: 32, maxWidth: 400, textAlign: 'center' }}>
          <Empty description="No unpaid invoices — all invoices are paid or cancelled." />
          <button onClick={onClose} style={{ marginTop: 16, padding: '9px 20px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    );
  }

  const paidOnInvoice = (invoice?.payments ?? [])
    .filter((p) => p.status === 'COMPLETED')
    .reduce((s, p) => s + parseFloat(String((p as any).amount ?? 0)), 0);
  const remaining = invoice
    ? parseFloat(String(invoice.total_amount)) - paidOnInvoice
    : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: th.cardBg, borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${th.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: th.text }}>{isSubmit ? 'Submit Payment' : 'Record Payment Received'}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: th.textMuted }}>
              {invoice ? `${invoice.invoice_number}${(invoice as any).tenant?.name ? ` · ${(invoice as any).tenant.name}` : ''}` : isSubmit ? 'Tell us how you paid — finance will confirm' : 'Select invoice and payment details'}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.textSub }}><CloseOutlined style={{ fontSize: 13 }} /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!initialInvoice && (
            <div>
              <label style={LABEL}>Invoice <span style={{ color: '#ef4444' }}>*</span></label>
              <Select
                showSearch
                placeholder="Select tenant invoice..."
                value={selectedId || undefined}
                onChange={onPickInvoice}
                style={{ width: '100%' }}
                options={unpaid.map((i) => ({
                  value: i.id,
                  label: `${(i as any).tenant?.name ? `${(i as any).tenant.name} · ` : ''}${i.invoice_number} · ${formatAmt(i.total_amount, i.currency)} (${i.status})`,
                }))}
              />
              {errors.invoice && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.invoice}</div>}
            </div>
          )}
          {invoice && (
          <div style={{ background: th.tableHead, borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontSize: 11, color: th.textMuted, marginBottom: 2 }}>Invoice Total</div><div style={{ fontSize: 20, fontWeight: 800, color: th.text }}>{formatAmt(invoice.total_amount, invoice.currency)}</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: th.textMuted, marginBottom: 2 }}>Remaining</div><div style={{ fontSize: 20, fontWeight: 800, color: remaining > 0 ? '#dc2626' : '#15803d' }}>{formatAmt(remaining, invoice.currency)}</div></div>
          </div>
          )}
          <div>
            <label style={LABEL}>Payment Method <span style={{ color: '#ef4444' }}>*</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
              {Object.entries(PAYMENT_METHOD_META).map(([key, mm]) => (
                <button key={key} onClick={() => setMethod(key)} style={{ padding: '10px 6px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', border: `2px solid ${method === key ? mm.color : '#e5e7eb'}`, background: method === key ? mm.bg : '#fff', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 20, marginBottom: 4, display: 'flex', justifyContent: 'center' }}>
                    <PaymentMethodIcon method={key} color={method === key ? mm.color : '#64748b'} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: method === key ? mm.color : '#64748b', lineHeight: 1.2 }}>{mm.label}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: th.textMuted, marginTop: 6 }}>{PAYMENT_METHOD_META[method]?.desc}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={LABEL}>Payment amount received <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={{ ...INPUT, borderColor: errors.amount ? '#ef4444' : '#e5e7eb', fontWeight: 700, fontSize: 16 }} type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setF('amount', e.target.value)} />
              {errors.amount && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.amount}</div>}
              {invoice && (
                <div style={{ fontSize: 11, color: th.textMuted, marginTop: 4 }}>
                  Amount paid toward invoice {invoice.invoice_number}.{' '}
                  <button type="button" onClick={() => setF('amount', String(remaining))} style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Use full remaining balance ({formatAmt(remaining, invoice.currency)})
                  </button>
                </div>
              )}
            </div>
            <div>
              <label style={LABEL}>Payment Date <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={{ ...INPUT, borderColor: errors.payment_date ? '#ef4444' : '#e5e7eb' }} type="date" value={form.payment_date} onChange={e => setF('payment_date', e.target.value)} />
              {errors.payment_date && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.payment_date}</div>}
            </div>
          </div>
          <div>
            <label style={LABEL}>{method === 'CHECK' ? 'Cheque Number' : 'Reference Number'}{method === 'CHECK' && <span style={{ color: '#ef4444' }}> *</span>}{method !== 'CHECK' && <span style={{ color: th.textMuted, fontWeight: 400 }}> (optional)</span>}</label>
            <input style={{ ...INPUT, borderColor: errors.reference_number ? '#ef4444' : '#e5e7eb' }} type="text" placeholder={method === 'CHECK' ? 'e.g. CHQ-00123' : method === 'ONLINE_PAYMENT' ? 'e.g. TXN-456789' : 'e.g. REF-001'} value={form.reference_number} onChange={e => setF('reference_number', e.target.value)} />
            {errors.reference_number && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.reference_number}</div>}
            {method === 'CHECK' && !isSubmit && (
              <div style={{ fontSize: 11, color: th.textMuted, marginTop: 6 }}>
                Attach the scanned cheque PDF later from the Payments tab (upload icon on the payment row).
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: '14px 24px 20px', borderTop: `1px solid ${th.divider}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text }}>Cancel</button>
          <button onClick={handleSubmit} disabled={mutation.isPending || !invoice} style={{ padding: '9px 22px', borderRadius: 8, background: mutation.isPending || !invoice ? '#93c5fd' : 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: mutation.isPending || !invoice ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {mutation.isPending ? <><LoadingOutlined /> {isSubmit ? 'Submitting...' : 'Recording...'}</> : <><CheckCircleOutlined /> {isSubmit ? 'Submit Payment' : 'Record Payment'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Edit Invoice Modal -------------------------------------------------------
function EditInvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { input: INPUT, t: th } = usePageTheme();
  const LABEL: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: th.textSub, display: 'block', marginBottom: 5 };
  const qc = useQueryClient();
  const [form, setForm] = useState({ issue_date: invoice.issue_date?.split('T')[0] ?? '', due_date: invoice.due_date?.split('T')[0] ?? '', total_amount: invoice.total_amount, currency: invoice.currency, status: invoice.status });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => { const n = { ...e }; delete n[k]; return n; }); };

  const mutation = useMutation({
    mutationFn: (d: any) => billingApi.updateInvoice(invoice.id, d),
    onSuccess: () => { message.success('Invoice updated!'); qc.invalidateQueries({ queryKey: ['invoices'] }); onClose(); },
    onError: (err: any) => { message.error(err?.response?.data?.message ?? 'Failed'); },
  });

  const submit = () => {
    const e: Record<string, string> = {};
    if (!form.issue_date) e.issue_date = 'Required';
    if (!form.due_date)   e.due_date   = 'Required';
    if (!form.total_amount || parseFloat(form.total_amount) <= 0) e.total_amount = 'Valid amount required';
    if (Object.keys(e).length) { setErrors(e); return; }
    mutation.mutate({ ...form, total_amount: parseFloat(form.total_amount) });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: th.cardBg, borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div><h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: th.text }}>Edit Invoice</h2><p style={{ margin: 0, fontSize: 13, color: th.textSub }}>{invoice.invoice_number}</p></div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.textSub }}><CloseOutlined /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={LABEL}>Issue Date *</label><input type="date" style={{ ...INPUT, borderColor: errors.issue_date ? '#ef4444' : '#e5e7eb' }} value={form.issue_date} onChange={e => setF('issue_date', e.target.value)} />{errors.issue_date && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.issue_date}</div>}</div>
            <div><label style={LABEL}>Due Date *</label><input type="date" style={{ ...INPUT, borderColor: errors.due_date ? '#ef4444' : '#e5e7eb' }} value={form.due_date} onChange={e => setF('due_date', e.target.value)} />{errors.due_date && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.due_date}</div>}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={LABEL}>Amount *</label><input type="number" step="0.01" min="0" style={{ ...INPUT, borderColor: errors.total_amount ? '#ef4444' : '#e5e7eb' }} value={form.total_amount} onChange={e => setF('total_amount', e.target.value)} />{errors.total_amount && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.total_amount}</div>}</div>
            <div><label style={LABEL}>Currency</label><select style={INPUT} value={form.currency} onChange={e => setF('currency', e.target.value)}>{['USD','EUR','GBP','AED','TND'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div><label style={LABEL}>Status</label><select style={INPUT} value={form.status} onChange={e => setF('status', e.target.value)}>{Object.entries(INVOICE_STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}</select></div>
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

// --- Invoice Detail Modal -----------------------------------------------------
function InvoiceDetailModal({ invoice, onClose, canManage, onPay, onSubmitPay, onEdit, onPreview }: {
  invoice: Invoice | null; onClose: () => void; canManage: boolean;
  onPay: (inv: Invoice) => void; onSubmitPay: (inv: Invoice) => void; onEdit: (inv: Invoice) => void; onPreview: (inv: Invoice) => void;
}) {
  const { t: th } = usePageTheme();
  if (!invoice) return null;
  const sm        = INVOICE_STATUS_META[invoice.status] ?? INVOICE_STATUS_META.DRAFT;
  const overdueBg = isOverdue(invoice.due_date) && !['PAID','CANCELLED'].includes(invoice.status);
  const canPay    = !['PAID','CANCELLED'].includes(invoice.status);
  const tenantCanSubmit = !canManage && canTenantPay(invoice);
  const awaitingConfirm = hasPendingPayment(invoice);

  const rows: [string, string][] = [
    ['Invoice #',   invoice.invoice_number],
    ['Type',        invoice.type?.replace(/_/g, ' ').toLowerCase()],
    ['Issue Date',  formatDate(invoice.issue_date)],
    ['Due Date',    formatDate(invoice.due_date)],
    ['Status',      invoice.status],
    ['Currency',    invoice.currency],
    ...((invoice as any).contract?.contract_number ? [['Contract', (invoice as any).contract.contract_number]] as [string,string][] : []),
    ...((invoice as any).tenant?.name ? [['Tenant', (invoice as any).tenant.name]] as [string,string][] : []),
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: th.cardBg, borderRadius: 16, width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${th.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: th.text }}>Invoice Details</h2>
            <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{sm.label}</span>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.textSub }}><CloseOutlined style={{ fontSize: 13 }} /></button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ background: overdueBg ? '#fef2f2' : '#f8fafc', border: `1px solid ${overdueBg ? '#fecaca' : '#e5e7eb'}`, borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: th.textMuted, fontWeight: 500, marginBottom: 4 }}>Total Amount</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: th.text }}>{formatAmt(invoice.total_amount, invoice.currency)}</div>
              {overdueBg && <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700, marginTop: 4 }}>⚠ OVERDUE — due {formatDate(invoice.due_date)}</div>}
            </div>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: sm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🧾</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${th.divider}`, fontSize: 13 }}>
                <span style={{ color: th.textSub }}>{k}</span>
                <span style={{ fontWeight: 600, color: th.text, fontFamily: k === 'Invoice #' || k === 'Contract' ? 'monospace' : undefined, textTransform: k === 'Type' ? 'capitalize' : undefined }}>
                  {k === 'Status' ? <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>{sm.label}</span> : v}
                </span>
              </div>
            ))}
          </div>
          {!canManage && awaitingConfirm && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⏳</span><span>Your payment was submitted and is awaiting confirmation from finance.</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {tenantCanSubmit && (
              <button onClick={() => { onClose(); onSubmitPay(invoice); }} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <DollarOutlined /> Submit Payment
              </button>
            )}
            {canManage && canPay && (
              <button onClick={() => { onClose(); onPay(invoice); }} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <DollarOutlined /> Record Payment
              </button>
            )}
            {canManage && (
              <button onClick={() => { onClose(); onEdit(invoice); }} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fbbf24', color: '#f59e0b', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <EditOutlined /> Edit
              </button>
            )}
            {/* -- PDF Preview button — all roles -- */}
            <button onClick={() => { onClose(); onPreview(invoice); }} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              ?? View PDF
            </button>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, background: th.cardBg, border: `1px solid ${th.cardBorder}`, fontSize: 13, cursor: 'pointer', color: th.text }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Page ---------------------------------------------------------------------
export default function BillingPage() {

  const { card: CARD, headerCard, input: INPUT, t: th } = usePageTheme();
  const qc       = useQueryClient();
  const { user } = useAuthStore();

  const tenantId     = (user as any)?.tenant_id ?? '';
  const userId       = user?.id ?? '';
  const isSiteManager= user?.role === 'MANAGER';
  const isClientAdmin= user?.role === 'CLIENT_ADMIN';
  const isTenantAdmin= user?.role === 'TENANT_ADMIN';
  const isFinance    = user?.role === 'FINANCE';
  /** Property manager / finance — not platform owner (Super Admin). */
  const canManage    = isClientAdmin || isSiteManager || isFinance;

  const [q,              setQ]             = useState('');
  const [statusFilt,     setStatus]        = useState('');
  const [generateOpen,   setGenerate]      = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'payments' ? 'payments' : 'invoices';

  const [payInvoice,     setPayInvoice]    = useState<Invoice | null>(null);
  const [recordPayOpen,  setRecordPayOpen] = useState(false);
  const [payMode,        setPayMode]       = useState<'submit' | 'record'>('record');
  const [tenantPayFilt,  setTenantPayFilt] = useState('');
  const [editInvoice,    setEditInvoice]   = useState<Invoice | null>(null);
  const [detailInvoice,  setDetailInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice]= useState<Invoice | null>(null);

  const { data: invoicesRaw = [], isLoading: loadingInv, refetch: refetchInv } = useQuery({
    queryKey: ['invoices', canManage ? 'all' : tenantId, statusFilt],
    queryFn:  () => billingApi.getInvoices({ ...(tenantId && !canManage ? { tenantId } : {}), ...(statusFilt ? { status: statusFilt } : {}) }).then(r => r.data),
  });
  const { data: paymentsRaw = [], isLoading: loadingPay, refetch: refetchPay } = useQuery({
    queryKey: ['payments', canManage ? 'all' : tenantId],
    queryFn:  () => billingApi.getPayments(tenantId && !canManage ? { tenantId } : {}).then(r => r.data),
  });
  const { data: summary } = useQuery({
    queryKey: ['billing-summary', canManage ? 'all' : tenantId],
    queryFn:  () => billingApi.getFinancialSummary(tenantId && !canManage ? tenantId : undefined).then(r => r.data),
  });

  const invoices: Invoice[] = toArray(invoicesRaw);
  const payments: Payment[] = toArray(paymentsRaw);

  const tenants = useMemo(() => {
    const map = new Map<string, string>();
    for (const inv of invoices) {
      const id = (inv as any).tenant_id ?? (inv as any).tenant?.id;
      const name = (inv as any).tenant?.name;
      if (id && name) map.set(id, name);
    }
    for (const pay of payments) {
      if (pay.tenant_id) {
        const name = payTenantLabel(pay);
        if (name && name !== '—') map.set(pay.tenant_id, name);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices, payments]);

  const sendMut   = useMutation({ mutationFn: (id: string) => billingApi.sendInvoice(id),   onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Invoice sent'); }, onError: () => message.error('Failed') });
  const cancelMut = useMutation({ mutationFn: (id: string) => billingApi.cancelInvoice(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Cancelled'); },    onError: () => message.error('Failed') });
  const deleteMut = useMutation({ mutationFn: (id: string) => billingApi.deleteInvoice(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Deleted'); },      onError: () => message.error('Failed') });
  const refundMut  = useMutation({ mutationFn: (id: string) => billingApi.refundPayment(id),  onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['billing-summary'] }); message.success('Refunded'); }, onError: () => message.error('Failed') });
  const confirmMut = useMutation({ mutationFn: (id: string) => billingApi.confirmPayment(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['billing-summary'] }); message.success('Payment confirmed — invoice marked as paid'); }, onError: (err: any) => message.error(err?.response?.data?.message ?? 'Failed to confirm') });

  const filteredInv = invoices.filter(inv => {
    if (q && !inv.invoice_number.toLowerCase().includes(q.toLowerCase()) &&
        !((inv as any).tenant?.name ?? '').toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const filteredPay = payments.filter(pay => {
    if (tenantPayFilt && pay.tenant_id !== tenantPayFilt) return false;
    if (q && !pay.payment_number.toLowerCase().includes(q.toLowerCase()) &&
        !(pay.reference_number ?? '').toLowerCase().includes(q.toLowerCase()) &&
        !payTenantLabel(pay).toLowerCase().includes(q.toLowerCase()) &&
        !((pay as any).invoice?.invoice_number ?? '').toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const paymentsByTenant = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of filteredPay) {
      const key = payTenantLabel(p);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredPay]);

  const overdueCount   = invoices.filter(i => i.status === 'OVERDUE').length;
  const paidCount      = invoices.filter(i => i.status === 'PAID').length;
  const pendingCount   = invoices.filter(i => ['DRAFT','ISSUED','SENT','PARTIALLY_PAID'].includes(i.status)).length;
  const totalCollected = payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + parseFloat(p.amount), 0);
  const byMethod = Object.keys(PAYMENT_METHOD_META).reduce((acc: Record<string, number>, m) => {
    acc[m] = payments.filter((p) => payMethod(p) === m && p.status === 'COMPLETED').length;
    return acc;
  }, {});

  return (
    <PageShell>

      {/* Modals */}
      {generateOpen   && canManage && <GenerateInvoiceModal onClose={() => setGenerate(false)} userId={userId} tenantId={tenantId} canManage={canManage} />}
      {(payInvoice || recordPayOpen) && (
        <RecordPaymentModal
          invoice={payInvoice}
          onClose={() => { setPayInvoice(null); setRecordPayOpen(false); }}
          tenantId={tenantId}
          userId={userId}
          allInvoices={invoices}
          mode={payMode}
        />
      )}
      {editInvoice    && <EditInvoiceModal invoice={editInvoice} onClose={() => setEditInvoice(null)} />}
      {detailInvoice  && (
        <InvoiceDetailModal
          invoice={detailInvoice}
          onClose={() => setDetailInvoice(null)}
          canManage={canManage}
          onPay={inv => { setDetailInvoice(null); setPayMode('record'); setPayInvoice(inv); }}
          onSubmitPay={inv => { setDetailInvoice(null); setPayMode('submit'); setPayInvoice(inv); }}
          onEdit={inv  => { setDetailInvoice(null); setEditInvoice(inv); }}
          onPreview={inv => { setDetailInvoice(null); setPreviewInvoice(inv); }}
        />
      )}
      {/* ? PDF Preview Modal */}
      {previewInvoice && <InvoicePreviewModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} />}

      {/* Header */}
      <div style={headerCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: th.text }}>{isTenantAdmin ? 'My Billing & Payments' : 'Billing & Payments'}</h2>
            <p style={{ margin: 0, color: th.textSub, fontSize: 14 }}>
              {canManage
                ? 'Issue invoices to your tenants and record payments they send you'
                : 'Your invoices and payment history'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { refetchInv(); refetchPay(); }} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', color: th.textSub }}><ReloadOutlined /></button>
            <button style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text, display: 'flex', alignItems: 'center', gap: 6 }}><DownloadOutlined /> Export</button>
            {canManage && (
              <button onClick={() => setGenerate(true)} style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
                <FileTextOutlined /> Generate Invoice
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
          {[
            { label: 'Total Invoiced', value: summary ? formatAmt(summary.total_invoiced ?? 0) : '—', sub: `${invoices.length} invoices`, color: '#2563eb', bg: '#eff6ff', Icon: FileTextOutlined },
            { label: 'Total Paid',     value: summary ? formatAmt(summary.total_paid ?? 0)     : '—', sub: 'Collected', color: '#059669', bg: '#f0fdf4', Icon: CheckCircleOutlined },
            { label: 'Pending',        value: summary ? formatAmt(summary.total_pending ?? 0)  : '—', sub: `${pendingCount} awaiting payment`, color: '#d97706', bg: '#fffbeb', Icon: DollarOutlined },
            { label: 'Overdue',        value: summary ? formatAmt(summary.total_overdue ?? 0)  : '—', sub: `${overdueCount} past due date`, color: '#dc2626', bg: '#fef2f2', Icon: WarningOutlined },
            { label: 'Collected',      value: formatAmt(totalCollected), sub: `${payments.filter(p => p.status === 'COMPLETED').length} payments`, color: '#7c3aed', bg: '#f5f3ff', Icon: CreditCardOutlined },
          ].map(s => (
            <div key={s.label} style={{ border: `1px solid ${th.cardBorder}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div><p style={{ margin: '0 0 3px', fontSize: 11, color: th.textSub, fontWeight: 500 }}>{s.label}</p><p style={{ margin: '0 0 3px', fontSize: 16, fontWeight: 800, color: th.text, lineHeight: 1 }}>{s.value}</p><p style={{ margin: 0, fontSize: 11, color: s.color }}>{s.sub}</p></div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.Icon style={{ fontSize: 16, color: s.color } as CSSProperties} />
                </div>
              </div>
            </div>
          ))}
        </div>
        {payments.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${th.divider}`, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, alignSelf: 'center', marginRight: 4 }}>PAYMENTS BY METHOD:</span>
            {Object.entries(byMethod).filter(([, v]) => v > 0).map(([method, count]) => {
              const mm = PAYMENT_METHOD_META[method];
              return (
                <div key={method} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: mm.bg, border: `1px solid ${mm.color}33` }}>
                  <span><PaymentMethodIcon method={method} size={12} /></span><span style={{ fontSize: 11, fontWeight: 600, color: mm.color }}>{mm.label}</span>
                  <span style={{ fontSize: 11, background: `${mm.color}22`, color: mm.color, padding: '0 5px', borderRadius: 10, fontWeight: 700 }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {overdueCount > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <WarningOutlined style={{ color: '#dc2626', fontSize: 18 }} />
          <span style={{ fontWeight: 600, color: '#b91c1c', fontSize: 14 }}>{overdueCount} overdue invoice{overdueCount > 1 ? 's' : ''} require immediate attention.</span>
          <button onClick={() => setStatus('OVERDUE')} style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 7, background: '#dc2626', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View Overdue →</button>
        </div>
      )}

      <div style={CARD}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setSearchParams(key === 'payments' ? { tab: 'payments' } : {})}
          style={{ padding: '0 24px' }}
          tabBarExtraContent={
            <div style={{ display: 'flex', gap: 8, paddingBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Input prefix={<SearchOutlined style={{ color: th.textMuted }} />} placeholder={activeTab === 'payments' ? 'Search payments, tenant, invoice...' : 'Search invoices...'} value={q} onChange={e => setQ(e.target.value)} style={{ width: 220, borderRadius: 8 }} size="small" />
              {activeTab === 'invoices' && (
                <Select value={statusFilt || 'all'} onChange={v => setStatus(v === 'all' ? '' : v)} style={{ width: 150 }} size="small"
                  options={[{ value: 'all', label: 'All Status' },{ value: 'DRAFT', label: '📝 Draft' },{ value: 'ISSUED', label: '📤 Issued' },{ value: 'SENT', label: '📨 Sent' },{ value: 'PARTIALLY_PAID', label: '🟡 Partial' },{ value: 'PAID', label: '✅ Paid' },{ value: 'OVERDUE', label: '⚠️ Overdue' },{ value: 'CANCELLED', label: '❌ Cancelled' }]}
                />
              )}
              {activeTab === 'payments' && canManage && (
                <Select value={tenantPayFilt || 'all'} onChange={v => setTenantPayFilt(v === 'all' ? '' : v)} style={{ width: 180 }} size="small" placeholder="All tenants"
                  options={[{ value: 'all', label: 'All tenants' }, ...tenants.map((t) => ({ value: t.id, label: t.name }))]}
                />
              )}
              {activeTab === 'payments' && canManage && (
                <button onClick={() => { setPayMode('record'); setRecordPayOpen(true); }} style={{ padding: '6px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PlusOutlined /> Record Payment
                </button>
              )}
            </div>
          }
          items={[
            {
              key: 'invoices',
              label: `Invoices (${invoices.length})`,
              children: (
                <div style={{ paddingBottom: 20 }}>
                  {loadingInv ? (
                    Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ padding: '14px 0', borderBottom: `1px solid ${th.divider}` }}><Skeleton active paragraph={{ rows: 1 }} /></div>)
                  ) : filteredInv.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center' }}>
                      <FileTextOutlined style={{ fontSize: 40, color: '#e5e7eb', display: 'block', margin: '0 auto 12px' }} />
                      <Empty description={invoices.length === 0 ? (canManage ? 'No invoices yet — generate one from an active contract.' : 'No invoices yet.') : 'No invoices match your filters.'} />
                      {canManage && invoices.length === 0 && <button onClick={() => setGenerate(true)} style={{ marginTop: 12, padding: '9px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}><FileTextOutlined style={{ marginRight: 6 }} /> Generate First Invoice</button>}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.8fr 1.6fr', padding: '10px 0', borderBottom: `1px solid ${th.cardBorder}`, fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <span>Invoice #</span><span>Type</span><span>Issue Date</span><span>Due Date</span><span>Amount</span><span>Status</span><span>Actions</span>
                      </div>
                      {filteredInv.map((inv: Invoice, i: number) => {
                        const sm        = INVOICE_STATUS_META[inv.status] ?? INVOICE_STATUS_META.DRAFT;
                        const overdueBg = isOverdue(inv.due_date) && !['PAID','CANCELLED'].includes(inv.status);
                        const canPay    = !['PAID','CANCELLED'].includes(inv.status);
                        const tenantSubmit = !canManage && canTenantPay(inv);
                        const pendingPay   = hasPendingPayment(inv);
                        return (
                          <div key={inv.id}
                            style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.8fr 1.6fr', padding: '13px 0', borderBottom: i < filteredInv.length - 1 ? `1px solid ${th.divider}` : 'none', alignItems: 'center', background: overdueBg ? '#fff5f5' : '', transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = overdueBg ? '#fee2e2' : '#fafafa')}
                            onMouseLeave={e => (e.currentTarget.style.background = overdueBg ? '#fff5f5' : '')}
                          >
                            <div>
                              <div onClick={() => setDetailInvoice(inv)} style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }} title="View details">{inv.invoice_number}</div>
                              {overdueBg && <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>⚠ OVERDUE</div>}
                            </div>
                            <div style={{ fontSize: 11, color: th.textSub, background: th.tableHead, padding: '2px 8px', borderRadius: 6, display: 'inline-block' }}>{inv.type?.replace(/_/g,' ').toLowerCase()}</div>
                            <div style={{ fontSize: 12, color: th.text }}>{formatDate(inv.issue_date)}</div>
                            <div style={{ fontSize: 12, color: overdueBg ? '#dc2626' : '#374151', fontWeight: overdueBg ? 700 : 400 }}>{formatDate(inv.due_date)}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: th.text }}>{formatAmt(inv.total_amount, inv.currency)}</div>
                            <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, display: 'inline-block', whiteSpace: 'nowrap' }}>{sm.label}</span>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {tenantSubmit && (
                                <button onClick={() => { setPayMode('submit'); setPayInvoice(inv); }} style={{ padding: '5px 10px', borderRadius: 6, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} title="Submit payment">
                                  <DollarOutlined /> Pay
                                </button>
                              )}
                              {!canManage && pendingPay && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '3px 8px', borderRadius: 12 }}>Awaiting confirm</span>
                              )}
                              {canPay && canManage && (
                                <button onClick={() => { setPayMode('record'); setPayInvoice(inv); }} style={{ padding: '5px 10px', borderRadius: 6, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} title="Record payment received">
                                  <DollarOutlined /> Record
                                </button>
                              )}
                              {/* ? PDF Preview button */}
                              <button onClick={() => setPreviewInvoice(inv)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Preview PDF">
                                <EyeOutlined style={{ fontSize: 11, color: '#dc2626' }} />
                              </button>
                              {/* ? Direct PDF download */}
                              <InvoiceDownloadButton invoice={inv} />
                              {canManage && (
                                <>
                                  <button onClick={() => setEditInvoice(inv)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fbbf24', background: '#fffbeb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Edit"><EditOutlined style={{ fontSize: 11, color: '#f59e0b' }} /></button>
                                  {['DRAFT','ISSUED'].includes(inv.status) && <button onClick={() => sendMut.mutate(inv.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #ddd6fe', background: '#ede9fe', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Send"><SendOutlined style={{ fontSize: 11, color: '#6d28d9' }} /></button>}
                                  {!['PAID','CANCELLED'].includes(inv.status) && <button onClick={() => modal.confirm({ title: 'Cancel this invoice?', okType: 'danger', okText: 'Cancel Invoice', onOk: () => cancelMut.mutate(inv.id) })} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Cancel"><CloseCircleOutlined style={{ fontSize: 11, color: '#dc2626' }} /></button>}
                                  {['DRAFT','CANCELLED'].includes(inv.status) && <button onClick={() => modal.confirm({ title: 'Delete invoice?', okType: 'danger', okText: 'Delete', onOk: () => deleteMut.mutate(inv.id) })} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete"><DeleteOutlined style={{ fontSize: 11, color: '#dc2626' }} /></button>}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: th.textMuted }}>
                        <span>Showing {filteredInv.length} of {invoices.length} invoices</span>
                        <span>{paidCount} paid · {pendingCount} pending · {overdueCount} overdue</span>
                      </div>
                    </>
                  )}
                </div>
              ),
            },
            {
              key: 'payments',
              label: `Payments (${payments.length})`,
              children: (
                <div style={{ paddingBottom: 20 }}>
                  {loadingPay ? (
                    Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ padding: '14px 0', borderBottom: `1px solid ${th.divider}` }}><Skeleton active paragraph={{ rows: 1 }} /></div>)
                  ) : filteredPay.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center' }}>
                      <Empty description={payments.length === 0 ? 'No payments yet. Record one from an invoice (Pay) or use Record Payment.' : 'No payments match your filters.'} />
                      {canManage && payments.length === 0 && (
                        <button onClick={() => setRecordPayOpen(true)} style={{ marginTop: 12, padding: '9px 20px', background: 'linear-gradient(135deg,#059669,#10b981)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                          <PlusOutlined style={{ marginRight: 6 }} /> Record First Payment
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {paymentsByTenant.map(([tenantName, tenantPayments]) => (
                        <div key={tenantName} style={{ marginBottom: canManage && !tenantPayFilt ? 24 : 0 }}>
                          {canManage && !tenantPayFilt && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 8px', borderBottom: `2px solid ${th.divider}`, marginBottom: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: th.text }}>{tenantName}</span>
                                <span style={{ fontSize: 11, color: th.textMuted, background: th.tableHead, padding: '2px 8px', borderRadius: 10 }}>
                                  {tenantPayments.length} payment{tenantPayments.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>
                                {formatAmt(
                                  tenantPayments.filter((p) => p.status === 'COMPLETED').reduce((s, p) => s + parseFloat(String(p.amount)), 0),
                                )}
                              </span>
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: canManage && tenantPayFilt ? '1.3fr 1.3fr 1.2fr 1fr 1fr 0.8fr 0.6fr' : '1.4fr 1.3fr 1.2fr 1fr 1fr 0.8fr 0.6fr', padding: '10px 0', borderBottom: `1px solid ${th.cardBorder}`, fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <span>Payment #</span>
                            {canManage && tenantPayFilt && <span>Tenant</span>}
                            <span>Invoice</span><span>Method</span><span>Date</span><span>Amount</span><span>Status</span><span></span>
                          </div>
                          {tenantPayments.map((pay: Payment, i: number) => {
                            const mm = PAYMENT_METHOD_META[payMethod(pay)] ?? PAYMENT_METHOD_META.BANK_TRANSFER;
                            const cols = canManage && tenantPayFilt ? '1.3fr 1.3fr 1.2fr 1fr 1fr 0.8fr 0.6fr' : '1.4fr 1.3fr 1.2fr 1fr 1fr 0.8fr 0.6fr';
                            return (
                              <div key={pay.id} style={{ display: 'grid', gridTemplateColumns: cols, padding: '13px 0', borderBottom: i < tenantPayments.length - 1 ? `1px solid ${th.divider}` : 'none', alignItems: 'center' }}
                                onMouseEnter={e => (e.currentTarget.style.background = th.hover)}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                <div><div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{pay.payment_number}</div>{pay.reference_number && <div style={{ fontSize: 10, color: th.textMuted }}>Ref: {pay.reference_number}</div>}</div>
                                {canManage && tenantPayFilt && <div style={{ fontSize: 12, fontWeight: 600, color: th.text }}>{payTenantLabel(pay)}</div>}
                                <div style={{ fontSize: 12, color: th.textSub }}>{(pay as any).invoice?.invoice_number ?? pay.invoice_id?.substring(0, 12)}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 26, height: 26, borderRadius: 6, background: mm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PaymentMethodIcon method={payMethod(pay)} size={13} /></div><span style={{ fontSize: 12 }}>{mm.label}</span></div>
                                <div style={{ fontSize: 12 }}>{formatDate(pay.payment_date)}</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: pay.status === 'REFUNDED' ? '#94a3b8' : '#0f172a', textDecoration: pay.status === 'REFUNDED' ? 'line-through' : 'none' }}>{formatAmt(pay.amount, (pay as any).currency ?? 'USD')}</div>
                                <span style={{ background: pay.status === 'COMPLETED' ? '#dcfce7' : pay.status === 'REFUNDED' ? '#f1f5f9' : '#fef3c7', color: pay.status === 'COMPLETED' ? '#15803d' : pay.status === 'REFUNDED' ? '#475569' : '#92400e', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>{pay.status}</span>
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                  {payMethod(pay) === 'CHECK' && pay.cheque_document_url && (
                                    <a href={pay.cheque_document_url} target="_blank" rel="noreferrer" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} title="View cheque PDF">
                                      <FileTextOutlined style={{ fontSize: 11, color: '#1d4ed8' }} />
                                    </a>
                                  )}
                                  {payMethod(pay) === 'CHECK' && !pay.cheque_document_url && (
                                    <ChequeUploadButton paymentId={pay.id} onDone={() => { qc.invalidateQueries({ queryKey: ['payments'] }); }} />
                                  )}
                                  {pay.status === 'PENDING' && canManage && (
                                    <button onClick={() => modal.confirm({ title: 'Confirm payment received?', content: `${formatAmt(pay.amount)} from ${payTenantLabel(pay)} will be marked as paid.`, okText: 'Confirm', onOk: () => confirmMut.mutate(pay.id) })} style={{ padding: '4px 10px', borderRadius: 6, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} title="Confirm payment">
                                      <CheckCircleOutlined style={{ fontSize: 10 }} /> Confirm
                                    </button>
                                  )}
                                  {pay.status === 'COMPLETED' && canManage && (
                                    <button onClick={() => modal.confirm({ title: 'Refund this payment?', content: `${formatAmt(pay.amount)} will be refunded.`, okType: 'danger', okText: 'Refund', onOk: () => refundMut.mutate(pay.id) })} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Refund"><CloseCircleOutlined style={{ fontSize: 11, color: '#dc2626' }} /></button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                      <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: th.textMuted }}>
                        <span>Showing {filteredPay.length} of {payments.length} payments{tenantPayFilt ? ` · ${tenants.find(t => t.id === tenantPayFilt)?.name ?? 'tenant'}` : ''}</span>
                        <span>Total collected: <strong style={{ color: th.text }}>${totalCollected.toLocaleString()}</strong></span>
                      </div>
                    </>
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
