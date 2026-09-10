import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, Select, Modal, Form, Skeleton, Empty, Checkbox } from 'antd';
import { message } from '../../utils/feedback';
import {
  SearchOutlined, PlusOutlined, EyeOutlined,
  StopOutlined, CheckCircleOutlined,
  ReloadOutlined, TeamOutlined, FileTextOutlined,
  CreditCardOutlined, DownloadOutlined, EditOutlined, DeleteOutlined, CloseOutlined,
} from '@ant-design/icons';
import { tenantApi } from '../../api/services';
import type { Tenant, TenantStatus } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<TenantStatus, { label: string; bg: string; color: string }> = {
  ACTIVE:    { label: 'Active',    bg: '#dcfce7', color: '#15803d' },
  TRIAL:     { label: 'Trial',     bg: '#dbeafe', color: '#1d4ed8' },
  SUSPENDED: { label: 'Suspended', bg: '#fee2e2', color: '#b91c1c' },
  CLOSED:    { label: 'Closed',    bg: '#f1f5f9', color: '#475569' },
};

const PLAN_META: Record<string, { label: string; bg: string; color: string }> = {
  basic:      { label: 'Basic',      bg: '#f1f5f9', color: '#475569' },
  standard:   { label: 'Standard',   bg: '#dbeafe', color: '#1d4ed8' },
  premium:    { label: 'Premium',    bg: '#fef3c7', color: '#92400e' },
  enterprise: { label: 'Enterprise', bg: '#ede9fe', color: '#6d28d9' },
};

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string): string {
  const COLORS = ['#2563eb','#059669','#d97706','#7c3aed','#dc2626','#0369a1','#0891b2'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

// ─── Create Client Account Modal ──────────────────────────────────────────────
type ProvisionResult = {
  tenant: Tenant;
  admin_user: { id: string; email: string; role: string; must_change_password: boolean };
  temporary_password: string;
  email_sent: boolean;
  message?: string;
};

function CreateClientModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (result: ProvisionResult) => void;
}) {
  const { t: th, btnPrimary } = usePageTheme();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    try {
      await form.validateFields();
      setLoading(true);
      const values = form.getFieldsValue();
      const res = await tenantApi.provisionClient({
        company_name: values.company_name,
        contact_email: values.contact_email,
        subscription_plan: values.subscription_plan ?? 'professional',
        send_welcome_email: values.send_welcome_email ?? true,
      });
      const payload = (res as { data?: ProvisionResult })?.data ?? res;
      onCreated(payload as ProvisionResult);
      onClose();
      form.resetFields();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; userMessage?: string })?.response?.data?.message
        ?? (e as { userMessage?: string })?.userMessage
        ?? 'Failed to create client account';
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
      title={<div style={{ fontWeight: 700, fontSize: 17 }}>Create Client Account</div>}
    >
      <p style={{ margin: '0 0 16px', fontSize: 13, color: th.textSub, lineHeight: 1.5 }}>
        Creates an isolated client workspace and a <strong>Client Admin</strong> login. A temporary password is generated — share it with the client manually or by email.
      </p>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ subscription_plan: 'professional', send_welcome_email: true }}>
        <Form.Item label="Company Name" name="company_name" rules={[{ required: true, message: 'Required' }]}>
          <Input placeholder="e.g. Atlas Property Group" />
        </Form.Item>
        <Form.Item label="Client Admin Email" name="contact_email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
          <Input placeholder="owner@company.com" />
        </Form.Item>
        <Form.Item label="Subscription Plan" name="subscription_plan">
          <Select options={[
            { value: 'basic', label: 'Basic' },
            { value: 'standard', label: 'Standard' },
            { value: 'professional', label: 'Professional' },
            { value: 'enterprise', label: 'Enterprise' },
          ]} />
        </Form.Item>
        <Form.Item name="send_welcome_email" valuePropName="checked">
          <Checkbox>Send welcome email with temporary password</Checkbox>
        </Form.Item>
      </Form>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${th.cardBorder}` }}>
        <button type="button" onClick={() => { onClose(); form.resetFields(); }} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text }}>Cancel</button>
        <button type="button" onClick={handleOk} disabled={loading} style={{ ...btnPrimary, padding: '9px 24px', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Creating...' : 'Create Account'}
        </button>
      </div>
    </Modal>
  );
}

function CredentialsModal({
  result,
  onClose,
}: {
  result: ProvisionResult | null;
  onClose: () => void;
}) {
  const { t: th, card, btnPrimary } = usePageTheme();
  if (!result) return null;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => message.success(`${label} copied`));
  };

  return (
    <Modal
      open={!!result}
      onCancel={onClose}
      footer={null}
      width={560}
      title={<div style={{ fontWeight: 700, fontSize: 17, color: '#15803d' }}>Client account created</div>}
    >
      <p style={{ margin: '0 0 16px', fontSize: 13, color: th.textSub }}>
        Share these credentials with <strong>{result.tenant.name}</strong>. The client must change their password on first login.
      </p>
      <div style={{ ...card, padding: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Login email</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <code style={{ fontSize: 14, color: th.text }}>{result.admin_user.email}</code>
            <button type="button" onClick={() => copy(result.admin_user.email, 'Email')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer' }}>Copy</button>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Temporary password</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <code style={{ fontSize: 15, fontWeight: 700, color: '#b45309', letterSpacing: '0.04em' }}>{result.temporary_password}</code>
            <button type="button" onClick={() => copy(result.temporary_password, 'Password')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer' }}>Copy</button>
          </div>
        </div>
      </div>
      {result.email_sent ? (
        <p style={{ fontSize: 12, color: '#15803d', marginBottom: 12 }}>Welcome email sent to {result.admin_user.email}.</p>
      ) : (
        <p style={{ fontSize: 12, color: '#b45309', marginBottom: 12 }}>Email was not sent — deliver the credentials manually.</p>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={{ ...btnPrimary, padding: '9px 24px' }}>Done</button>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TenantsPage() {
  const { card: CARD, headerCard, t: th } = usePageTheme();
  const navigate  = useNavigate();
  const qc        = useQueryClient();

  const [q,        setQ]       = useState('');
  const [status,   setStatus]  = useState('');
  const [plan,     setPlan]    = useState('');
  const [view,     setView]    = useState<'card' | 'table'>('table');
  const [addOpen,  setAdd]     = useState(false);
  const [credentials, setCredentials] = useState<ProvisionResult | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

  // ── Fetch client accounts only ──
  const { data: tenants = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['tenants', 'CLIENT'],
    queryFn:  () => tenantApi.getAll({ type: 'CLIENT' }).then(r => r.data),
  });

  // ── Suspend / Activate mutations ──
  const suspendMut = useMutation({
    mutationFn: (id: string) => tenantApi.suspend(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['tenants'] }); message.success('Tenant suspended'); },
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => tenantApi.activate(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['tenants'] }); message.success('Tenant activated'); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => tenantApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['tenants'] }); message.success('Tenant deleted'); },
    onError:    () => message.error('Failed to delete tenant'),
  });

  // ── Filter ──
  const filtered = tenants.filter((t: Tenant) => {
    if (t.slug === 'system') return false;
    if (status && t.status !== status) return false;
    if (plan   && t.subscription_plan !== plan) return false;
    if (q && !t.name.toLowerCase().includes(q.toLowerCase()) &&
             !t.contact_email.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  // ── Stats ──
  const stats = {
    total:     tenants.length,
    active:    tenants.filter((t: Tenant) => t.status === 'ACTIVE').length,
    trial:     tenants.filter((t: Tenant) => t.status === 'TRIAL').length,
    suspended: tenants.filter((t: Tenant) => t.status === 'SUSPENDED').length,
  };

  return (
    <PageShell>

      {/* ── Header ── */}
      <div style={headerCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: th.text }}>Client Accounts</h2>
            <p style={{ margin: 0, color: th.textSub, fontSize: 14 }}>
              Create and manage property manager clients (Level 2 workspaces)
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ReloadOutlined /> Refresh
            </button>
            <button style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              <DownloadOutlined /> Export
            </button>
            <button onClick={() => setAdd(true)} style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <PlusOutlined /> Create Client Account
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[
            { label: 'Total Clients', value: stats.total,     sub: 'All registered',      color: '#2563eb', bg: '#eff6ff', icon: '🏢' },
            { label: 'Active',        value: stats.active,    sub: 'Paying customers',     color: '#059669', bg: '#f0fdf4', icon: '✅' },
            { label: 'Trial',         value: stats.trial,     sub: 'Evaluating platform',  color: '#d97706', bg: '#fffbeb', icon: '⏳' },
            { label: 'Suspended',     value: stats.suspended, sub: 'Access restricted',    color: '#dc2626', bg: '#fef2f2', icon: '⛔' },
          ].map(s => (
            <div key={s.label} style={{ border: `1px solid ${th.cardBorder}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 11, color: th.textSub, fontWeight: 500 }}>{s.label}</p>
                  <p style={{ margin: '0 0 3px', fontSize: 26, fontWeight: 800, color: th.text, lineHeight: 1 }}>{isLoading ? '—' : s.value}</p>
                  <p style={{ margin: 0, fontSize: 11, color: s.color }}>{s.sub}</p>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: th.textMuted }} />}
          placeholder="Search by name or email..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ width: 240, borderRadius: 8 }}
        />
        <Select value={status || 'all'} onChange={v => setStatus(v === 'all' ? '' : v)} style={{ width: 160 }}
          options={[{ value: 'all', label: 'All Status' }, { value: 'ACTIVE', label: 'Active' }, { value: 'TRIAL', label: 'Trial' }, { value: 'SUSPENDED', label: 'Suspended' }, { value: 'CLOSED', label: 'Closed' }]}
        />
        <Select value={plan || 'all'} onChange={v => setPlan(v === 'all' ? '' : v)} style={{ width: 160 }}
          options={[{ value: 'all', label: 'All Plans' }, { value: 'basic', label: 'Basic' }, { value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }, { value: 'enterprise', label: 'Enterprise' }]}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', border: `1px solid ${th.cardBorder}`, borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => setView('table')} style={{ padding: '7px 12px', background: view === 'table' ? '#2563eb' : th.cardBg, color: view === 'table' ? '#fff' : th.textSub, border: 'none', cursor: 'pointer', fontSize: 13 }}>☰ Table</button>
          <button onClick={() => setView('card')}  style={{ padding: '7px 12px', background: view === 'card'  ? '#2563eb' : th.cardBg, color: view === 'card'  ? '#fff' : th.textSub, border: 'none', cursor: 'pointer', fontSize: 13 }}>⊞ Cards</button>
        </div>
      </div>

      {!isLoading && (
        <div style={{ fontSize: 13, color: th.textSub, marginBottom: 12 }}>
          Showing <strong style={{ color: th.text }}>{filtered.length}</strong> of {tenants.length} client accounts
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: th.text, marginBottom: 8 }}>Failed to load tenants</div>
          <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div style={CARD}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: '16px 20px', borderBottom: i < 4 ? `1px solid ${th.divider}` : 'none' }}>
              <Skeleton active paragraph={{ rows: 1 }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div style={{ ...CARD, padding: '60px' }}>
          <Empty description={tenants.length === 0 ? 'No tenants yet. Add your first tenant!' : 'No tenants match your filters.'} />
        </div>
      )}

      {/* ════════ TABLE VIEW ════════ */}
      {!isLoading && !isError && filtered.length > 0 && view === 'table' && (
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 1fr 1fr 0.8fr 0.8fr 1fr', padding: '11px 20px', background: th.tableHead, borderBottom: `1px solid ${th.cardBorder}`, fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Company</span>
            <span>Contact</span>
            <span>Status</span>
            <span>Plan</span>
            <span>Users</span>
            <span>Spaces</span>
            <span>Actions</span>
          </div>

          {filtered.map((t: Tenant, i: number) => {
            const sm  = STATUS_META[t.status] ?? STATUS_META.CLOSED;
            const pm  = PLAN_META[t.subscription_plan] ?? PLAN_META.basic;
            const col = getAvatarColor(t.name);
            return (
              <div
                key={t.id}
                style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 1fr 1fr 0.8fr 0.8fr 1fr', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? `1px solid ${th.divider}` : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = th.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {/* Company */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                    {getInitials(t.name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: th.text }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: th.textMuted }}>/{t.slug}</div>
                  </div>
                </div>

                {/* Contact */}
                <div style={{ fontSize: 12, color: th.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.contact_email}</div>

                {/* Status */}
                <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, display: 'inline-block' }}>{sm.label}</span>

                {/* Plan */}
                <span style={{ background: pm.bg, color: pm.color, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, display: 'inline-block', textTransform: 'capitalize' }}>{pm.label}</span>

                {/* Max users */}
                <span style={{ fontSize: 13, color: th.text, fontWeight: 500 }}>{t.max_users}</span>

                {/* Max spaces */}
                <span style={{ fontSize: 13, color: th.text, fontWeight: 500 }}>{t.max_spaces}</span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 5 }}>
                  <button
                    onClick={() => navigate(`/admin/tenants/${t.id}`)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="View details"
                  >
                    <EyeOutlined style={{ fontSize: 12, color: th.textSub }} />
                  </button>
                  <button
                    onClick={() => setEditingTenant(t)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fbbf24', background: '#fffbeb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Edit tenant"
                  >
                    <EditOutlined style={{ fontSize: 12, color: '#f59e0b' }} />
                  </button>
                  <button
                    onClick={() => { if (window.confirm(`Delete ${t.name}?`)) deleteMut.mutate(t.id); }}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Delete tenant"
                  >
                    <DeleteOutlined style={{ fontSize: 12, color: '#dc2626' }} />
                  </button>
                  {t.status === 'SUSPENDED' ? (
                    <button
                      onClick={() => activateMut.mutate(t.id)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Activate"
                    >
                      <CheckCircleOutlined style={{ fontSize: 12, color: '#15803d' }} />
                    </button>
                  ) : (
                    <button
                      onClick={() => suspendMut.mutate(t.id)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Suspend"
                    >
                      <StopOutlined style={{ fontSize: 12, color: '#dc2626' }} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: th.textMuted }}>Showing {filtered.length} of {tenants.length} tenants</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3].map(p => (
                <button key={p} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${th.cardBorder}`, background: p === 1 ? '#2563eb' : '#fff', color: p === 1 ? '#fff' : '#374151', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════ CARD VIEW ════════ */}
      {!isLoading && !isError && filtered.length > 0 && view === 'card' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {filtered.map((t: Tenant) => {
            const sm  = STATUS_META[t.status] ?? STATUS_META.CLOSED;
            const pm  = PLAN_META[t.subscription_plan] ?? PLAN_META.basic;
            const col = getAvatarColor(t.name);
            return (
              <div key={t.id} style={{ ...CARD, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
              >
                {/* Card header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: '#fff' }}>
                      {getInitials(t.name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: th.text }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: th.textMuted }}>{t.contact_email}</div>
                    </div>
                  </div>
                  <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{sm.label}</span>
                </div>

                {/* Card body */}
                <div style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[
                      { icon: <TeamOutlined />,      label: 'Max Users',   value: t.max_users   },
                      { icon: '🏢',                  label: 'Max Spaces',  value: t.max_spaces  },
                      { icon: <FileTextOutlined />,  label: 'Plan',        value: t.subscription_plan },
                      { icon: <CreditCardOutlined />,label: 'Status',      value: t.status      },
                    ].map(item => (
                      <div key={item.label} style={{ background: th.tableHead, borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: th.textMuted, marginBottom: 2 }}>{item.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: th.text, textTransform: 'capitalize' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <span style={{ background: pm.bg, color: pm.color, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, textTransform: 'capitalize', marginBottom: 12, display: 'inline-block' }}>
                    {pm.label} Plan
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginTop: 12 }}>
                    <button
                      onClick={() => navigate(`/admin/tenants/${t.id}`)}
                      style={{ padding: '9px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => setEditingTenant(t)}
                      style={{ padding: '9px', borderRadius: 8, background: '#fef3c7', border: '1px solid #fbbf24', color: '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { if (window.confirm(`Delete ${t.name}?`)) deleteMut.mutate(t.id); }}
                      style={{ padding: '9px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                    {t.status === 'SUSPENDED' ? (
                      <button onClick={() => activateMut.mutate(t.id)} style={{ padding: '9px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Activate
                      </button>
                    ) : (
                      <button onClick={() => suspendMut.mutate(t.id)} style={{ padding: '9px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateClientModal
        open={addOpen}
        onClose={() => setAdd(false)}
        onCreated={(result) => {
          qc.invalidateQueries({ queryKey: ['tenants'] });
          setCredentials(result);
          message.success('Client account created');
        }}
      />
      <CredentialsModal result={credentials} onClose={() => setCredentials(null)} />
      {editingTenant && <EditTenantModal tenant={editingTenant} onClose={() => setEditingTenant(null)} />}
    </PageShell>
  );
}

// ─── Edit Tenant Modal ───────────────────────────────────────────────────────────
function EditTenantModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const { t: th } = usePageTheme();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: tenant.name,
    contact_email: tenant.contact_email,
    subscription_plan: tenant.subscription_plan,
    status: tenant.status,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => { const n = { ...e }; delete n[k]; return n; }); };

  const mutation = useMutation({
    mutationFn: (d: any) => tenantApi.update(tenant.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); onClose(); },
    onError:   (err: any) => { const msg = err?.response?.data?.message ?? 'Failed'; message.error(Array.isArray(msg) ? msg.join(', ') : msg); },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.contact_email.trim()) e.contact_email = 'Required';
    if (!form.subscription_plan) e.subscription_plan = 'Required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.contact_email && !emailRegex.test(form.contact_email)) e.contact_email = 'Invalid email';
    return e;
  };

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    mutation.mutate(form);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: th.cardBg, borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: th.text }}>Edit Tenant</h2>
            <p style={{ margin: 0, fontSize: 13, color: th.textSub }}>Update tenant information</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.textSub }}>
            <CloseOutlined />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: th.text, display: 'block', marginBottom: 5 }}>Tenant Name *</label>
            <input type="text" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.name ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }} value={form.name} onChange={e => setF('name', e.target.value)} />
            {errors.name && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.name}</div>}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: th.text, display: 'block', marginBottom: 5 }}>Contact Email *</label>
            <input type="email" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.contact_email ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }} value={form.contact_email} onChange={e => setF('contact_email', e.target.value)} />
            {errors.contact_email && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.contact_email}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: th.text, display: 'block', marginBottom: 5 }}>Subscription Plan *</label>
              <select style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.subscription_plan ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13 }} value={form.subscription_plan} onChange={e => setF('subscription_plan', e.target.value)}>
                <option value="BASIC">Basic</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="ENTERPRISE">Enterprise</option>
                <option value="CUSTOM">Custom</option>
              </select>
              {errors.subscription_plan && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{errors.subscription_plan}</div>}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: th.text, display: 'block', marginBottom: 5 }}>Status</label>
              <select style={{ width: '100%', padding: '9px 12px', border: `1px solid ${th.cardBorder}`, borderRadius: 8, fontSize: 13 }} value={form.status} onChange={e => setF('status', e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="TRIAL">Trial</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} disabled={mutation.isPending} style={{ flex: 1, padding: '9px 20px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: th.text }}>Cancel</button>
          <button onClick={submit} disabled={mutation.isPending} style={{ flex: 1, padding: '9px 20px', borderRadius: 8, background: mutation.isPending ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
