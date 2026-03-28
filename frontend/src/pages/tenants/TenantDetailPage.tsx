import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, Skeleton, Badge, message } from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, StopOutlined,
  CheckCircleOutlined, ReloadOutlined, TeamOutlined,
  FileTextOutlined, CreditCardOutlined, WarningOutlined,
  MailOutlined, UserOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { tenantApi, userApi, contractApi, billingApi, bookingApi } from '../../api/services';
import type { Tenant, User, LeaseContract, Invoice, TenantStatus } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<TenantStatus, { label: string; bg: string; color: string }> = {
  ACTIVE:    { label: 'Active',    bg: '#dcfce7', color: '#15803d' },
  TRIAL:     { label: 'Trial',     bg: '#dbeafe', color: '#1d4ed8' },
  SUSPENDED: { label: 'Suspended', bg: '#fee2e2', color: '#b91c1c' },
  CLOSED:    { label: 'Closed',    bg: '#f1f5f9', color: '#475569' },
};

const USER_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE:    { bg: '#dcfce7', color: '#15803d' },
  PENDING:   { bg: '#fef3c7', color: '#92400e' },
  INACTIVE:  { bg: '#f1f5f9', color: '#475569' },
  SUSPENDED: { bg: '#fee2e2', color: '#b91c1c' },
};

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  TENANT_ADMIN: { bg: '#ede9fe', color: '#6d28d9' },
  EMPLOYEE:     { bg: '#dbeafe', color: '#1d4ed8' },
  MAINTENANCE:  { bg: '#fef3c7', color: '#92400e' },
  FINANCE:      { bg: '#f0fdf4', color: '#15803d' },
};

const CONTRACT_STATUS: Record<string, { bg: string; color: string }> = {
  ACTIVE:      { bg: '#dcfce7', color: '#15803d' },
  DRAFT:       { bg: '#f1f5f9', color: '#475569' },
  EXPIRED:     { bg: '#fee2e2', color: '#b91c1c' },
  TERMINATED:  { bg: '#fee2e2', color: '#b91c1c' },
  RENEWED:     { bg: '#dbeafe', color: '#1d4ed8' },
};

const INVOICE_STATUS: Record<string, { bg: string; color: string }> = {
  PAID:          { bg: '#dcfce7', color: '#15803d' },
  ISSUED:        { bg: '#dbeafe', color: '#1d4ed8' },
  SENT:          { bg: '#ede9fe', color: '#6d28d9' },
  OVERDUE:       { bg: '#fee2e2', color: '#b91c1c' },
  PARTIALLY_PAID:{ bg: '#fef3c7', color: '#92400e' },
  CANCELLED:     { bg: '#f1f5f9', color: '#475569' },
  DRAFT:         { bg: '#f1f5f9', color: '#475569' },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TenantDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc       = useQueryClient();

  // ── Fetch tenant ──
  const { data: tenant, isLoading, isError, refetch } = useQuery({
    queryKey: ['tenant', id],
    queryFn:  () => tenantApi.getOne(id!).then(r => r.data),
    enabled:  !!id,
  });

  // ── Fetch related data ──
  const { data: users = [] } = useQuery({
    queryKey: ['users', id],
    queryFn:  () => userApi.getAll(id).then(r => r.data),
    enabled:  !!id,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', id],
    queryFn:  () => contractApi.getAll({ tenantId: id }).then(r => r.data),
    enabled:  !!id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', id],
    queryFn:  () => billingApi.getInvoices({ tenantId: id }).then(r => r.data),
    enabled:  !!id,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', id],
    queryFn:  () => bookingApi.getAll({ tenantId: id }).then(r => r.data),
    enabled:  !!id,
  });

  // ── Suspend / Activate ──
  const suspendMut = useMutation({
    mutationFn: () => tenantApi.suspend(id!),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['tenant', id] }); message.success('Tenant suspended'); },
  });

  const activateMut = useMutation({
    mutationFn: () => tenantApi.activate(id!),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['tenant', id] }); message.success('Tenant activated'); },
  });

  // ── Loading ──
  if (isLoading) return (
    <div style={{ padding: 24 }}>
      <Skeleton active paragraph={{ rows: 3 }} style={{ marginBottom: 20 }} />
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );

  // ── Error ──
  if (isError || !tenant) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <WarningOutlined style={{ fontSize: 40, color: '#d97706', display: 'block', margin: '0 auto 12px' }} />
      <div style={{ fontWeight: 600, color: '#374151', marginBottom: 8 }}>Failed to load tenant</div>
      <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
    </div>
  );

  const sm = STATUS_META[tenant.status as TenantStatus] ?? STATUS_META.CLOSED;

  // Computed financials
  const totalRevenue  = invoices
    .filter((inv: Invoice) => inv.status === 'PAID')
    .reduce((acc: number, inv: Invoice) => acc + parseFloat(inv.total_amount), 0);
  const overdueAmount = invoices
    .filter((inv: Invoice) => inv.status === 'OVERDUE')
    .reduce((acc: number, inv: Invoice) => acc + parseFloat(inv.total_amount), 0);

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* ── Header ── */}
      <div style={{ ...CARD, padding: '18px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button onClick={() => navigate('/admin/tenants')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: 0, marginBottom: 10 }}>
              <ArrowLeftOutlined /> Back to Tenants
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#fff', flexShrink: 0 }}>
                {getInitials(tenant.name)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{tenant.name}</h2>
                  <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{sm.label}</span>
                  <span style={{ background: '#f1f5f9', color: '#475569', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, textTransform: 'capitalize' }}>{tenant.subscription_plan} Plan</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MailOutlined style={{ fontSize: 11 }} />{tenant.contact_email}</span>
                  <span>· /{tenant.slug}</span>
                  <span>· Joined {formatDate(tenant.created_at)}</span>
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => refetch()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#64748b' }}>
              <ReloadOutlined />
            </button>
            <button style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
              <EditOutlined /> Edit
            </button>
            {tenant.status === 'SUSPENDED' ? (
              <button onClick={() => activateMut.mutate()} style={{ padding: '9px 18px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleOutlined /> Activate
              </button>
            ) : (
              <button onClick={() => suspendMut.mutate()} style={{ padding: '9px 18px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <StopOutlined /> Suspend
              </button>
            )}
          </div>
        </div>

        {/* KPI bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginTop: 20 }}>
          {[
            { label: 'Team Members',  value: users.length,           sub: `${tenant.max_users} max`,     color: '#2563eb', bg: '#eff6ff' },
            { label: 'Contracts',     value: contracts.length,       sub: `${contracts.filter((c: LeaseContract) => c.status === 'ACTIVE').length} active`, color: '#059669', bg: '#f0fdf4' },
            { label: 'Invoices',      value: invoices.length,        sub: `${invoices.filter((i: Invoice) => i.status === 'OVERDUE').length} overdue`,       color: '#d97706', bg: '#fffbeb' },
            { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, sub: 'Paid invoices',  color: '#7c3aed', bg: '#f5f3ff' },
            { label: 'Overdue',       value: `$${overdueAmount.toLocaleString()}`, sub: 'Needs attention', color: '#dc2626', bg: '#fef2f2' },
          ].map(k => (
            <div key={k.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ margin: '0 0 3px', fontSize: 11, color: '#64748b' }}>{k.label}</p>
              <p style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{k.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: k.color }}>{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={CARD}>
        <Tabs
          defaultActiveKey="info"
          style={{ padding: '0 24px' }}
          items={[

            // ── Info ──────────────────────────────────────────────
            {
              key: 'info',
              label: 'Overview',
              children: (
                <div style={{ paddingBottom: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>Company Information</div>
                      {[
                        ['Tenant ID',    tenant.id.substring(0, 16) + '...'],
                        ['Name',         tenant.name],
                        ['Slug',         '/' + tenant.slug],
                        ['Contact',      tenant.contact_email],
                        ['Status',       tenant.status],
                        ['Plan',         tenant.subscription_plan],
                        ['Max Users',    tenant.max_users],
                        ['Max Spaces',   tenant.max_spaces],
                        ['Created',      formatDate(tenant.created_at)],
                      ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 }}>
                          <span style={{ color: '#64748b' }}>{k}</span>
                          <span style={{ fontWeight: 600, color: '#0f172a', textTransform: typeof v === 'string' && ['ACTIVE','TRIAL','SUSPENDED','CLOSED'].includes(v) ? 'capitalize' : 'none' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>Quick Stats</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                          { label: 'Active Contracts', value: contracts.filter((c: LeaseContract) => c.status === 'ACTIVE').length,     color: '#059669' },
                          { label: 'Paid Invoices',    value: invoices.filter((i: Invoice)  => i.status === 'PAID').length,             color: '#059669' },
                          { label: 'Overdue Invoices', value: invoices.filter((i: Invoice)  => i.status === 'OVERDUE').length,          color: '#dc2626' },
                          { label: 'Total Bookings',   value: bookings.length,                                                           color: '#2563eb' },
                          { label: 'Active Users',     value: (users as User[]).filter(u => u.status === 'ACTIVE').length,              color: '#059669' },
                          { label: 'Pending Users',    value: (users as User[]).filter(u => u.status === 'PENDING').length,             color: '#d97706' },
                        ].map(s => (
                          <div key={s.label} style={{ background: '#f8fafc', borderRadius: 9, padding: '12px 14px' }}>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>{s.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ),
            },

            // ── Users ─────────────────────────────────────────────
            {
              key: 'users',
              label: <Badge count={(users as User[]).length} size="small" color="#2563eb">Team Members</Badge>,
              children: (
                <div style={{ paddingBottom: 24 }}>
                  {users.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No users in this tenant yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(users as User[]).map(u => {
                        const us = USER_STATUS_STYLE[u.status] ?? { bg: '#f1f5f9', color: '#475569' };
                        const rs = ROLE_STYLE[u.role]         ?? { bg: '#f1f5f9', color: '#475569' };
                        return (
                          <div key={u.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff', flexShrink: 0 }}>
                              {u.first_name[0]}{u.last_name[0]}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{u.first_name} {u.last_name}</div>
                              <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MailOutlined style={{ fontSize: 11 }} /> {u.email}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ background: rs.bg, color: rs.color, fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 20 }}>{u.role.replace('_', ' ')}</span>
                              <span style={{ background: us.bg, color: us.color, fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 20 }}>{u.status}</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>
                              {u.last_login_at ? `Last: ${formatDate(u.last_login_at)}` : 'Never logged in'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ),
            },

            // ── Contracts ─────────────────────────────────────────
            {
              key: 'contracts',
              label: <Badge count={contracts.length} size="small" color="#059669">Contracts</Badge>,
              children: (
                <div style={{ paddingBottom: 24 }}>
                  {contracts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No contracts yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(contracts as LeaseContract[]).map(c => {
                        const cs = CONTRACT_STATUS[c.status] ?? { bg: '#f1f5f9', color: '#475569' };
                        return (
                          <div key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <FileTextOutlined style={{ color: '#15803d', fontSize: 16 }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{c.contract_number}</div>
                              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                {formatDate(c.start_date)} → {formatDate(c.end_date)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>${parseFloat(c.monthly_rent).toLocaleString()}/mo</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>Deposit: ${parseFloat(c.deposit_amount).toLocaleString()}</div>
                            </div>
                            <span style={{ background: cs.bg, color: cs.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{c.status}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ),
            },

            // ── Invoices ──────────────────────────────────────────
            {
              key: 'invoices',
              label: <Badge count={invoices.filter((i: Invoice) => i.status === 'OVERDUE').length} size="small" color="#dc2626">Invoices</Badge>,
              children: (
                <div style={{ paddingBottom: 24 }}>
                  {invoices.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No invoices yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(invoices as Invoice[]).map(inv => {
                        const is = INVOICE_STATUS[inv.status] ?? { bg: '#f1f5f9', color: '#475569' };
                        return (
                          <div key={inv.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <CreditCardOutlined style={{ color: '#d97706', fontSize: 16 }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{inv.invoice_number}</div>
                              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                {inv.type.replace(/_/g, ' ')} · Due {formatDate(inv.due_date)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>${parseFloat(inv.total_amount).toLocaleString()}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{inv.currency}</div>
                            </div>
                            <span style={{ background: is.bg, color: is.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{inv.status}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ),
            },

            // ── Bookings ──────────────────────────────────────────
            {
              key: 'bookings',
              label: <Badge count={bookings.length} size="small" color="#7c3aed">Bookings</Badge>,
              children: (
                <div style={{ paddingBottom: 24 }}>
                  {bookings.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No bookings yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {bookings.map((b: any) => (
                        <div key={b.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <CalendarOutlined style={{ color: '#7c3aed', fontSize: 16 }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{b.booking_number}</div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>
                              {b.space?.name ?? 'Unknown space'} · {new Date(b.start_datetime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>${parseFloat(b.total_price).toLocaleString()}</div>
                          </div>
                          <span style={{ background: '#ede9fe', color: '#6d28d9', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{b.status.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
