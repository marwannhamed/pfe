import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import { ReloadOutlined, ArrowRightOutlined, WarningOutlined } from '@ant-design/icons';
import { billingApi, tenantApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const INVOICE_STATUS: Record<string, { bg: string; color: string }> = {
  DRAFT:          { bg: '#f1f5f9', color: '#475569' },
  ISSUED:         { bg: '#dbeafe', color: '#1d4ed8' },
  SENT:           { bg: '#ede9fe', color: '#6d28d9' },
  PARTIALLY_PAID: { bg: '#fef3c7', color: '#92400e' },
  PAID:           { bg: '#dcfce7', color: '#15803d' },
  OVERDUE:        { bg: '#fee2e2', color: '#b91c1c' },
  CANCELLED:      { bg: '#f1f5f9', color: '#94a3b8' },
};

const PAYMENT_METHOD: Record<string, string> = {
  CASH: '💵', CHECK: '📄', BANK_TRANSFER: '🏦', CREDIT_CARD: '💳', ONLINE_PAYMENT: '🌐',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: invoices  = [], isLoading: l1, refetch } = useQuery({ queryKey: ['fin-invoices'],  queryFn: () => billingApi.getInvoices().then(r => r.data)                   });
  const { data: payments  = [], isLoading: l2 }          = useQuery({ queryKey: ['fin-payments'],  queryFn: () => billingApi.getPayments().then(r => r.data)                   });
  const { data: summary,        isLoading: l3 }          = useQuery({ queryKey: ['fin-summary'],   queryFn: () => billingApi.getFinancialSummary().then(r => r.data)            });
  const { data: overdue   = [], isLoading: l4 }          = useQuery({ queryKey: ['fin-overdue'],   queryFn: () => billingApi.getOverdueInvoices().then(r => r.data)             });
  const { data: tenants   = [] }                         = useQuery({ queryKey: ['fin-tenants'],   queryFn: () => tenantApi.getAll().then(r => r.data)                         });

  const isLoading = l1 || l2 || l3 || l4;

  const allInvoices = invoices  as any[];
  const allPayments = payments  as any[];
  const allOverdue  = overdue   as any[];

  const recentInvoices = [...allInvoices].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0,6);
  const recentPayments = [...allPayments].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0,5);

  const totalPaid     = Number(summary?.total_paid     ?? 0);
  const totalPending  = Number(summary?.total_pending  ?? 0);
  const totalOverdue  = Number(summary?.total_overdue  ?? 0);
  const totalInvoiced = Number(summary?.total_invoiced ?? 0);

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Finance Dashboard</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
            Welcome back, <strong>{user?.first_name}</strong> · Financial overview and payment management
          </p>
        </div>
        <button onClick={() => refetch()} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ReloadOutlined /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Invoiced',  value: `$${totalInvoiced.toLocaleString()}`, sub: `${allInvoices.length} invoices`,         color: '#2563eb', bg: '#eff6ff', icon: '🧾' },
          { label: 'Collected',       value: `$${totalPaid.toLocaleString()}`,     sub: `${allPayments.length} payments received`, color: '#059669', bg: '#f0fdf4', icon: '✅' },
          { label: 'Pending',         value: `$${totalPending.toLocaleString()}`,  sub: 'Awaiting payment',                        color: '#d97706', bg: '#fffbeb', icon: '⏳' },
          { label: 'Overdue',         value: `$${totalOverdue.toLocaleString()}`,  sub: `${allOverdue.length} overdue invoices`,   color: '#dc2626', bg: '#fef2f2', icon: '⚠️' },
        ].map(k => (
          <div key={k.label} style={{ ...CARD, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{k.icon}</div>
            </div>
            {isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
              <>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{k.label}</div>
                <div style={{ fontSize: 11, color: k.color, fontWeight: 500 }}>{k.sub}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Collection rate bar */}
      <div style={{ ...CARD, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Collection Rate</div>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>
            {totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0}%
          </span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: '#f1f5f9', overflow: 'hidden' }}>
          <div style={{ width: `${totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0}%`, height: '100%', background: 'linear-gradient(90deg,#22c55e,#16a34a)', borderRadius: 5 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#64748b' }}>
          <span>$0</span>
          <span>Collected: <strong style={{ color: '#059669' }}>${totalPaid.toLocaleString()}</strong></span>
          <span>Total: ${totalInvoiced.toLocaleString()}</span>
        </div>
      </div>

      {/* Overdue alert */}
      {allOverdue.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => navigate('/admin/billing')}
        >
          <WarningOutlined style={{ color: '#dc2626', fontSize: 18 }} />
          <span style={{ fontWeight: 600, color: '#b91c1c', fontSize: 14 }}>
            {allOverdue.length} overdue invoice{allOverdue.length > 1 ? 's' : ''} — Total: ${totalOverdue.toLocaleString()} requiring immediate follow-up
          </span>
          <ArrowRightOutlined style={{ color: '#dc2626', marginLeft: 'auto' }} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Recent Invoices */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Recent Invoices</div>
            <button onClick={() => navigate('/admin/billing')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          {isLoading ? <div style={{ padding: 20 }}><Skeleton active paragraph={{ rows: 5 }} /></div>
          : recentInvoices.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No invoices yet</div>
          : recentInvoices.map((inv: any, i: number) => {
            const is = INVOICE_STATUS[inv.status] ?? { bg: '#f1f5f9', color: '#475569' };
            return (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < recentInvoices.length-1 ? '1px solid #f8fafc':'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{inv.invoice_number}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Due {formatDate(inv.due_date)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>${parseFloat(inv.total_amount).toLocaleString()}</div>
                  <span style={{ background: is.bg, color: is.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>{inv.status}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Payments */}
        <div style={CARD}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Recent Payments</div>
            <button onClick={() => navigate('/admin/payments')} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          {isLoading ? <div style={{ padding: 20 }}><Skeleton active paragraph={{ rows: 4 }} /></div>
          : recentPayments.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No payments yet</div>
          : recentPayments.map((pay: any, i: number) => (
            <div key={pay.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < recentPayments.length-1 ? '1px solid #f8fafc':'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {PAYMENT_METHOD[pay.payment_method] ?? '💰'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{pay.payment_number}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{formatDate(pay.payment_date)}</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#059669' }}>+${parseFloat(pay.amount).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ ...CARD, padding: '16px 20px', marginTop: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Invoice Management', path: '/admin/billing',  bg: '#2563eb', color: '#fff',    border: 'none'              },
            { label: 'Payment Management', path: '/admin/payments', bg: '#fff',    color: '#374151', border: '1px solid #e5e7eb' },
            { label: 'Financial Reports',  path: '/admin/reports',  bg: '#fff',    color: '#374151', border: '1px solid #e5e7eb' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} style={{ padding: '9px 18px', borderRadius: 8, background: a.bg, color: a.color, border: a.border, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
