import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, Select, Modal, Form, DatePicker, InputNumber, Skeleton, Empty, message, Tabs } from 'antd';
import {
  SearchOutlined, PlusOutlined, ReloadOutlined,
  CreditCardOutlined, DownloadOutlined, EyeOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SendOutlined,
  DollarOutlined, WarningOutlined,
} from '@ant-design/icons';
import { billingApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Invoice, Payment, InvoiceStatus, PaymentMethod } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; bg: string; color: string }> = {
  DRAFT:         { label: 'Draft',          bg: '#f1f5f9', color: '#475569' },
  ISSUED:        { label: 'Issued',         bg: '#dbeafe', color: '#1d4ed8' },
  SENT:          { label: 'Sent',           bg: '#ede9fe', color: '#6d28d9' },
  PARTIALLY_PAID:{ label: 'Partial',        bg: '#fef3c7', color: '#92400e' },
  PAID:          { label: 'Paid',           bg: '#dcfce7', color: '#15803d' },
  OVERDUE:       { label: 'Overdue',        bg: '#fee2e2', color: '#b91c1c' },
  CANCELLED:     { label: 'Cancelled',      bg: '#f1f5f9', color: '#94a3b8' },
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH:           'Cash',
  CHECK:          'Cheque',
  BANK_TRANSFER:  'Bank Transfer',
  CREDIT_CARD:    'Credit Card',
  ONLINE_PAYMENT: 'Online Payment',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatAmount(amount: string, currency = 'USD') {
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${sym}${parseFloat(amount).toLocaleString()}`;
}

function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date();
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

// ─── Record Payment Modal ─────────────────────────────────────────────────────
function RecordPaymentModal({ invoice, onClose, tenantId, userId }: {
  invoice: Invoice | null; onClose: () => void; tenantId: string; userId: string;
}) {
  const [form]    = Form.useForm();
  const qc        = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    if (!invoice) return;
    try {
      await form.validateFields();
      setLoading(true);
      const v = form.getFieldsValue();
      await billingApi.createPayment({
        tenant_id:           tenantId,
        invoice_id:          invoice.id,
        recorded_by_user_id: userId,
        payment_method:      v.payment_method,
        amount:              v.amount,
        currency:            invoice.currency,
        payment_date:        v.payment_date.toISOString(),
        reference_number:    v.reference_number,
        status:              'COMPLETED',
      });
      message.success('Payment recorded successfully');
      qc.invalidateQueries({ queryKey: ['invoices'] });
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

  if (!invoice) return null;
  return (
    <Modal
      open={!!invoice}
      onCancel={() => { onClose(); form.resetFields(); }}
      footer={null}
      width={480}
      title={
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Record Payment</div>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>
            Invoice {invoice.invoice_number} · Due {formatAmount(invoice.total_amount, invoice.currency)}
          </div>
        </div>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 16 }}>
        <Form.Item label="Payment Method" name="payment_method" rules={[{ required: true }]} initialValue="BANK_TRANSFER">
          <Select options={Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="Amount" name="amount" initialValue={parseFloat(invoice.total_amount)} rules={[{ required: true }]}>
            <InputNumber min={0} prefix="$" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Payment Date" name="payment_date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="MMM DD, YYYY" />
          </Form.Item>
        </div>
        <Form.Item label="Reference Number (optional)" name="reference_number">
          <Input placeholder="e.g. TXN-123456" />
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
export default function BillingPage() {
  const qc           = useQueryClient();
  const { user }     = useAuthStore();
  const tenantId     = user?.tenant_id ?? '';
  const userId       = user?.id ?? '';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [q,           setQ]          = useState('');
  const [statusFilt,  setStatus]     = useState('');
  const [payInvoice,  setPayInvoice] = useState<Invoice | null>(null);

  // ── Fetch invoices ──
  const { data: invoices = [], isLoading: loadingInv, refetch: refetchInv } = useQuery({
    queryKey: ['invoices', tenantId, statusFilt],
    queryFn:  () => billingApi.getInvoices({
      ...(tenantId && !isSuperAdmin ? { tenantId } : {}),
      ...(statusFilt ? { status: statusFilt } : {}),
    }).then(r => r.data),
  });

  // ── Fetch payments ──
  const { data: payments = [], isLoading: loadingPay, refetch: refetchPay } = useQuery({
    queryKey: ['payments', tenantId],
    queryFn:  () => billingApi.getPayments(tenantId && !isSuperAdmin ? { tenantId } : {}).then(r => r.data),
  });

  // ── Fetch financial summary ──
  const { data: summary } = useQuery({
    queryKey: ['billing-summary', tenantId],
    queryFn:  () => billingApi.getFinancialSummary(tenantId && !isSuperAdmin ? tenantId : undefined).then(r => r.data),
  });

  // ── Mutations ──
  const sendMut = useMutation({
    mutationFn: (id: string) => billingApi.sendInvoice(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Invoice sent'); },
    onError:    () => message.error('Failed to send invoice'),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => billingApi.cancelInvoice(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Invoice cancelled'); },
    onError:    () => message.error('Failed to cancel invoice'),
  });

  const refundMut = useMutation({
    mutationFn: (id: string) => billingApi.refundPayment(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['payments'] }); message.success('Payment refunded'); },
    onError:    () => message.error('Failed to refund payment'),
  });

  // ── Filter ──
  const filteredInv = (invoices as Invoice[]).filter(inv => {
    if (!q) return true;
    return inv.invoice_number.toLowerCase().includes(q.toLowerCase());
  });

  const filteredPay = (payments as Payment[]).filter(pay => {
    if (!q) return true;
    return pay.payment_number.toLowerCase().includes(q.toLowerCase());
  });

  // ── Stats ──
  const all      = invoices as Invoice[];
  const overdue  = all.filter(i => i.status === 'OVERDUE').length;
  const paid     = all.filter(i => i.status === 'PAID').length;
  const pending  = all.filter(i => ['DRAFT','ISSUED','SENT','PARTIALLY_PAID'].includes(i.status)).length;

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Billing & Payments</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Manage invoices, track payments and financial overview</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { refetchInv(); refetchPay(); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#64748b' }}>
              <ReloadOutlined />
            </button>
            <button style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
              <DownloadOutlined /> Export
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
          {[
            { label: 'Total Invoiced', value: summary ? formatAmount(String(summary.total_invoiced)) : '—',  sub: 'All invoices',      color: '#2563eb', bg: '#eff6ff', icon: '📄' },
            { label: 'Total Paid',     value: summary ? formatAmount(String(summary.total_paid))     : '—',  sub: 'Collected',         color: '#059669', bg: '#f0fdf4', icon: '✅' },
            { label: 'Pending',        value: summary ? formatAmount(String(summary.total_pending))  : '—',  sub: 'Awaiting payment',  color: '#d97706', bg: '#fffbeb', icon: '⏳' },
            { label: 'Overdue',        value: summary ? formatAmount(String(summary.total_overdue))  : '—',  sub: 'Past due date',     color: '#dc2626', bg: '#fef2f2', icon: '⚠️' },
            { label: 'Invoices',       value: summary?.invoice_count ?? all.length,                          sub: `${paid} paid · ${overdue} overdue`, color: '#7c3aed', bg: '#f5f3ff', icon: '🧾' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 11, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
                  <p style={{ margin: '0 0 3px', fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</p>
                  <p style={{ margin: 0, fontSize: 11, color: s.color }}>{s.sub}</p>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overdue alert */}
      {overdue > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <WarningOutlined style={{ color: '#dc2626', fontSize: 18 }} />
          <span style={{ fontWeight: 600, color: '#b91c1c', fontSize: 14 }}>{overdue} overdue invoice{overdue > 1 ? 's' : ''} require immediate attention.</span>
        </div>
      )}

      {/* Tabs: Invoices | Payments */}
      <div style={CARD}>
        <Tabs
          defaultActiveKey="invoices"
          style={{ padding: '0 24px' }}
          tabBarExtraContent={
            <div style={{ display: 'flex', gap: 8, paddingBottom: 8 }}>
              <Input
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Search..."
                value={q}
                onChange={e => setQ(e.target.value)}
                style={{ width: 200, borderRadius: 8 }}
                size="small"
              />
              <Select
                value={statusFilt || 'all'}
                onChange={v => setStatus(v === 'all' ? '' : v)}
                style={{ width: 150 }}
                size="small"
                options={[
                  { value: 'all',          label: 'All Status'    },
                  { value: 'DRAFT',        label: 'Draft'         },
                  { value: 'ISSUED',       label: 'Issued'        },
                  { value: 'SENT',         label: 'Sent'          },
                  { value: 'PARTIALLY_PAID', label: 'Partial'     },
                  { value: 'PAID',         label: 'Paid'          },
                  { value: 'OVERDUE',      label: 'Overdue'       },
                  { value: 'CANCELLED',    label: 'Cancelled'     },
                ]}
              />
            </div>
          }
          items={[

            // ── INVOICES ──────────────────────────────────────────
            {
              key: 'invoices',
              label: `Invoices (${all.length})`,
              children: (
                <div style={{ paddingBottom: 20 }}>
                  {loadingInv ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid #f8fafc' }}>
                        <Skeleton active paragraph={{ rows: 1 }} />
                      </div>
                    ))
                  ) : filteredInv.length === 0 ? (
                    <Empty description="No invoices found" style={{ padding: '40px 0' }} />
                  ) : (
                    <>
                      {/* Table header */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.8fr 1.2fr', padding: '10px 0', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <span>Invoice #</span><span>Type</span><span>Issue Date</span><span>Due Date</span><span>Amount</span><span>Status</span><span>Actions</span>
                      </div>

                      {filteredInv.map((inv: Invoice, i: number) => {
                        const sm = INVOICE_STATUS_META[inv.status] ?? INVOICE_STATUS_META.DRAFT;
                        const overdueBg = isOverdue(inv.due_date) && !['PAID','CANCELLED'].includes(inv.status);
                        return (
                          <div
                            key={inv.id}
                            style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.8fr 1.2fr', padding: '13px 0', borderBottom: i < filteredInv.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center', background: overdueBg ? '#fff5f5' : '' }}
                          >
                            <div>
                              <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{inv.invoice_number}</div>
                              {overdueBg && <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>⚠ Overdue</div>}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>{inv.type.replace(/_/g, ' ').toLowerCase()}</div>
                            <div style={{ fontSize: 12, color: '#374151' }}>{formatDate(inv.issue_date)}</div>
                            <div style={{ fontSize: 12, color: overdueBg ? '#dc2626' : '#374151', fontWeight: overdueBg ? 600 : 400 }}>{formatDate(inv.due_date)}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{formatAmount(inv.total_amount, inv.currency)}</div>
                            <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, display: 'inline-block' }}>{sm.label}</span>

                            <div style={{ display: 'flex', gap: 4 }}>
                              {/* Pay */}
                              {!['PAID','CANCELLED'].includes(inv.status) && (
                                <button onClick={() => setPayInvoice(inv)} style={{ padding: '5px 9px', borderRadius: 6, background: '#2563eb', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <DollarOutlined /> Pay
                                </button>
                              )}
                              {/* Send */}
                              {['DRAFT','ISSUED'].includes(inv.status) && (
                                <button onClick={() => sendMut.mutate(inv.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Send">
                                  <SendOutlined style={{ fontSize: 11, color: '#6d28d9' }} />
                                </button>
                              )}
                              {/* Cancel */}
                              {!['PAID','CANCELLED'].includes(inv.status) && (
                                <button onClick={() => Modal.confirm({ title: 'Cancel invoice?', okType: 'danger', okText: 'Cancel Invoice', onOk: () => cancelMut.mutate(inv.id) })} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Cancel">
                                  <CloseCircleOutlined style={{ fontSize: 11, color: '#dc2626' }} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
                        <span>Showing {filteredInv.length} of {all.length} invoices</span>
                        <span>{paid} paid · {pending} pending · {overdue} overdue</span>
                      </div>
                    </>
                  )}
                </div>
              ),
            },

            // ── PAYMENTS ──────────────────────────────────────────
            {
              key: 'payments',
              label: `Payments (${(payments as Payment[]).length})`,
              children: (
                <div style={{ paddingBottom: 20 }}>
                  {loadingPay ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid #f8fafc' }}>
                        <Skeleton active paragraph={{ rows: 1 }} />
                      </div>
                    ))
                  ) : filteredPay.length === 0 ? (
                    <Empty description="No payments recorded yet" style={{ padding: '40px 0' }} />
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr 0.8fr 0.8fr', padding: '10px 0', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <span>Payment #</span><span>Invoice</span><span>Method</span><span>Date</span><span>Amount</span><span>Status</span><span>Actions</span>
                      </div>

                      {filteredPay.map((pay: Payment, i: number) => (
                        <div
                          key={pay.id}
                          style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr 0.8fr 0.8fr', padding: '13px 0', borderBottom: i < filteredPay.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center' }}
                        >
                          <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{pay.payment_number}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{(pay as any).invoice?.invoice_number ?? pay.invoice_id.substring(0, 8)}</div>
                          <div style={{ fontSize: 12, color: '#374151' }}>{PAYMENT_METHOD_LABELS[pay.payment_method] ?? pay.payment_method}</div>
                          <div style={{ fontSize: 12, color: '#374151' }}>{formatDate(pay.payment_date)}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{formatAmount(pay.amount, pay.currency)}</div>
                          <span style={{ background: pay.status === 'COMPLETED' ? '#dcfce7' : pay.status === 'REFUNDED' ? '#f1f5f9' : '#fef3c7', color: pay.status === 'COMPLETED' ? '#15803d' : pay.status === 'REFUNDED' ? '#475569' : '#92400e', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, display: 'inline-block' }}>
                            {pay.status}
                          </span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {pay.status === 'COMPLETED' && (
                              <button
                                onClick={() => Modal.confirm({ title: 'Refund this payment?', okType: 'danger', okText: 'Refund', onOk: () => refundMut.mutate(pay.id) })}
                                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Refund"
                              >
                                <CloseCircleOutlined style={{ fontSize: 11, color: '#dc2626' }} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      <div style={{ padding: '12px 0 0', fontSize: 12, color: '#94a3b8' }}>
                        Showing {filteredPay.length} of {(payments as Payment[]).length} payments
                      </div>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      <RecordPaymentModal invoice={payInvoice} onClose={() => setPayInvoice(null)} tenantId={tenantId} userId={userId} />
    </div>
  );
}
