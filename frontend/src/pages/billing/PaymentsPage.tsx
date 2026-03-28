import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, Select, Modal, Form, DatePicker, InputNumber, Skeleton, Empty, message } from 'antd';
import {
  SearchOutlined, PlusOutlined, ReloadOutlined,
  DollarOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import { billingApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Payment, PaymentMethod, PaymentStatus } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<PaymentStatus, { label: string; bg: string; color: string }> = {
  PENDING:   { label: 'Pending',   bg: '#fef3c7', color: '#92400e' },
  COMPLETED: { label: 'Completed', bg: '#dcfce7', color: '#15803d' },
  FAILED:    { label: 'Failed',    bg: '#fee2e2', color: '#b91c1c' },
  REFUNDED:  { label: 'Refunded',  bg: '#f1f5f9', color: '#475569' },
};

const METHOD_META: Record<PaymentMethod, { label: string; icon: string; bg: string; color: string }> = {
  CASH:           { label: 'Cash',           icon: '💵', bg: '#f0fdf4', color: '#15803d' },
  CHECK:          { label: 'Cheque',         icon: '📄', bg: '#eff6ff', color: '#1d4ed8' },
  BANK_TRANSFER:  { label: 'Bank Transfer',  icon: '🏦', bg: '#f5f3ff', color: '#6d28d9' },
  CREDIT_CARD:    { label: 'Credit Card',    icon: '💳', bg: '#fef3c7', color: '#92400e' },
  ONLINE_PAYMENT: { label: 'Online Payment', icon: '🌐', bg: '#f0fdf4', color: '#059669' },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatAmount(amount: string, currency = 'USD') {
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${sym}${parseFloat(amount).toLocaleString()}`;
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

// ─── New Payment Modal ────────────────────────────────────────────────────────
function NewPaymentModal({ open, onClose, tenantId, userId }: {
  open: boolean; onClose: () => void; tenantId: string; userId: string;
}) {
  const [form]    = Form.useForm();
  const qc        = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-unpaid', tenantId],
    queryFn:  () => billingApi.getInvoices({ tenantId: tenantId || undefined }).then(r =>
      r.data.filter((i: any) => !['PAID', 'CANCELLED'].includes(i.status))
    ),
    enabled: open,
  });

  const handleOk = async () => {
    try {
      await form.validateFields();
      setLoading(true);
      const v = form.getFieldsValue();
      await billingApi.createPayment({
        tenant_id:           tenantId,
        invoice_id:          v.invoice_id,
        recorded_by_user_id: userId,
        payment_method:      v.payment_method,
        amount:              v.amount,
        currency:            v.currency ?? 'USD',
        payment_date:        v.payment_date.toISOString(),
        reference_number:    v.reference_number,
      });
      message.success('Payment recorded successfully');
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['billing-summary'] });
      onClose();
      form.resetFields();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to record payment';
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
      width={520}
      title={<div><div style={{ fontWeight: 700, fontSize: 17 }}>Record New Payment</div><div style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>Add a cheque or payment record</div></div>}
    >
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item label="Invoice" name="invoice_id" rules={[{ required: true, message: 'Select an invoice' }]}>
          <Select
            showSearch
            placeholder="Select invoice..."
            filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            options={(invoices as any[]).map(i => ({
              value: i.id,
              label: `${i.invoice_number} — ${formatAmount(i.total_amount, i.currency)} (${i.status})`,
            }))}
          />
        </Form.Item>
        <Form.Item label="Payment Method" name="payment_method" rules={[{ required: true }]} initialValue="CHECK">
          <Select options={Object.entries(METHOD_META).map(([v, m]) => ({ value: v, label: `${m.icon} ${m.label}` }))} />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="Amount" name="amount" rules={[{ required: true }]}>
            <InputNumber min={0} prefix="$" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Currency" name="currency" initialValue="USD">
            <Select options={[{ value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' }, { value: 'TND', label: 'TND' }]} />
          </Form.Item>
        </div>
        <Form.Item label="Payment Date" name="payment_date" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} format="MMM DD, YYYY" />
        </Form.Item>
        <Form.Item label="Reference / Cheque Number (optional)" name="reference_number">
          <Input placeholder="e.g. CHQ-00123 or TXN-456789" />
        </Form.Item>
      </Form>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => { onClose(); form.resetFields(); }} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <button onClick={handleOk} disabled={loading} style={{ padding: '9px 24px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {loading ? 'Recording...' : '✓ Record Payment'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const qc           = useQueryClient();
  const { user }     = useAuthStore();
  const tenantId     = user?.tenant_id ?? '';
  const userId       = user?.id ?? '';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [q,          setQ]       = useState('');
  const [methodFilt, setMethod]  = useState('');
  const [statusFilt, setStatus]  = useState('');
  const [newOpen,    setNew]     = useState(false);

  // ── Fetch payments ──
  const { data: payments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['payments', tenantId, methodFilt],
    queryFn:  () => billingApi.getPayments(
      tenantId && !isSuperAdmin ? { tenantId } : {}
    ).then(r => r.data),
  });

  // ── Refund mutation ──
  const refundMut = useMutation({
    mutationFn: (id: string) => billingApi.refundPayment(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['payments'] }); message.success('Payment refunded'); },
    onError:    () => message.error('Failed to refund payment'),
  });

  // ── Filter ──
  const filtered = (payments as Payment[]).filter(p => {
    if (methodFilt && p.payment_method !== methodFilt) return false;
    if (statusFilt && p.status !== statusFilt) return false;
    if (q && !p.payment_number.toLowerCase().includes(q.toLowerCase()) &&
             !(p.reference_number ?? '').toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  // ── Stats ──
  const all       = payments as Payment[];
  const completed = all.filter(p => p.status === 'COMPLETED');
  const totalPaid = completed.reduce((s, p) => s + parseFloat(p.amount), 0);
  const cheques   = all.filter(p => p.payment_method === 'CHECK').length;
  const refunded  = all.filter(p => p.status === 'REFUNDED').length;

  // Method breakdown
  const byMethod = Object.keys(METHOD_META).reduce((acc: Record<string, number>, m) => {
    acc[m] = all.filter(p => p.payment_method === m).length;
    return acc;
  }, {});

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Payment Management</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Track cheques, transfers and all payment records</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#64748b' }}><ReloadOutlined /></button>
            <button onClick={() => setNew(true)} style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <PlusOutlined /> Record Payment
            </button>
          </div>
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
          {[
            { label: 'Total Payments', value: all.length,                            sub: 'All records',      color: '#2563eb', bg: '#eff6ff', icon: '💳' },
            { label: 'Total Collected',value: `$${totalPaid.toLocaleString()}`,      sub: 'Completed',        color: '#059669', bg: '#f0fdf4', icon: '💰' },
            { label: 'Cheques',        value: cheques,                               sub: 'CHECK method',     color: '#1d4ed8', bg: '#dbeafe', icon: '📄' },
            { label: 'Refunded',       value: refunded,                              sub: 'Returned to client',color: '#d97706', bg: '#fffbeb', icon: '↩️' },
            { label: 'Avg. Payment',   value: all.length > 0 ? `$${Math.round(totalPaid / (completed.length || 1)).toLocaleString()}` : '—', sub: 'Per transaction', color: '#7c3aed', bg: '#f5f3ff', icon: '📊' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 11, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
                  <p style={{ margin: '0 0 3px', fontSize: typeof s.value === 'string' ? 16 : 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{isLoading ? '—' : s.value}</p>
                  <p style={{ margin: 0, fontSize: 11, color: s.color }}>{s.sub}</p>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Method breakdown */}
        {all.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
            {Object.entries(byMethod).filter(([, v]) => v > 0).map(([method, count]) => {
              const mm = METHOD_META[method as PaymentMethod];
              return (
                <div
                  key={method}
                  onClick={() => setMethod(methodFilt === method ? '' : method)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: methodFilt === method ? mm.color : mm.bg, border: `1px solid ${mm.color}44`, cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 14 }}>{mm.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: methodFilt === method ? '#fff' : mm.color }}>{mm.label}</span>
                  <span style={{ fontSize: 11, background: 'rgba(0,0,0,0.1)', color: methodFilt === method ? '#fff' : mm.color, padding: '0 5px', borderRadius: 10 }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} placeholder="Search by payment # or reference..." value={q} onChange={e => setQ(e.target.value)} style={{ width: 260, borderRadius: 8 }} />
        <Select value={statusFilt || 'all'} onChange={v => setStatus(v === 'all' ? '' : v)} style={{ width: 160 }}
          options={[{ value: 'all', label: 'All Status' }, ...Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))]}
        />
        <Select value={methodFilt || 'all'} onChange={v => setMethod(v === 'all' ? '' : v)} style={{ width: 180 }}
          options={[{ value: 'all', label: 'All Methods' }, ...Object.entries(METHOD_META).map(([v, m]) => ({ value: v, label: `${m.icon} ${m.label}` }))]}
        />
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
          <strong style={{ color: '#0f172a' }}>{isLoading ? '—' : filtered.length}</strong> of {all.length}
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load payments</div>
          <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={CARD}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: '16px 20px', borderBottom: i < 4 ? '1px solid #f8fafc' : 'none' }}>
              <Skeleton active paragraph={{ rows: 1 }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div style={{ ...CARD, padding: '60px' }}>
          <Empty description={all.length === 0 ? 'No payments recorded yet.' : 'No payments match your filters.'} />
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div style={{ ...CARD, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1.2fr 1fr 1fr 0.8fr 0.8fr', padding: '11px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Payment #</span><span>Invoice</span><span>Method</span><span>Date</span><span>Amount</span><span>Status</span><span>Actions</span>
          </div>

          {filtered.map((pay: Payment, i: number) => {
            const sm = STATUS_META[pay.status] ?? STATUS_META.PENDING;
            const mm = METHOD_META[pay.payment_method] ?? METHOD_META.BANK_TRANSFER;
            return (
              <div
                key={pay.id}
                style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1.2fr 1fr 1fr 0.8fr 0.8fr', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{pay.payment_number}</div>
                  {pay.reference_number && <div style={{ fontSize: 10, color: '#94a3b8' }}>Ref: {pay.reference_number}</div>}
                </div>

                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {(pay as any).invoice?.invoice_number ?? pay.invoice_id.substring(0, 12) + '...'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: mm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{mm.icon}</div>
                  <span style={{ fontSize: 12, color: '#374151' }}>{mm.label}</span>
                </div>

                <div style={{ fontSize: 12, color: '#374151' }}>{formatDate(pay.payment_date)}</div>

                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{formatAmount(pay.amount, pay.currency)}</div>

                <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-block' }}>{sm.label}</span>

                <div style={{ display: 'flex', gap: 5 }}>
                  {pay.status === 'COMPLETED' && (
                    <button
                      onClick={() => Modal.confirm({ title: 'Refund this payment?', content: `${formatAmount(pay.amount, pay.currency)} will be refunded.`, okType: 'danger', okText: 'Refund', onOk: () => refundMut.mutate(pay.id) })}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Refund"
                    >
                      <CloseCircleOutlined style={{ fontSize: 12, color: '#dc2626' }} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
            <span>Showing {filtered.length} of {all.length} payments</span>
            <span>Total collected: <strong style={{ color: '#0f172a' }}>${totalPaid.toLocaleString()}</strong></span>
          </div>
        </div>
      )}

      <NewPaymentModal open={newOpen} onClose={() => setNew(false)} tenantId={tenantId} userId={userId} />
    </div>
  );
}
