import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';
import { Input, Select, Modal, Form, Skeleton, Empty } from 'antd';
import { message } from '../../utils/feedback';
import {
  SearchOutlined, PlusOutlined, EditOutlined,
  StopOutlined, CheckCircleOutlined, ReloadOutlined,
  MailOutlined, UserOutlined, LockOutlined, DownloadOutlined, PhoneOutlined,
} from '@ant-design/icons';
import { userApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { User, UserRole, UserStatus } from '../../types';
import UserAvatar from '../../components/UserAvatar';
import { formatUserName } from '../../utils/user';
import { CLIENT_TEAM_ROLES, PHONE_E164_PATTERN, PHONE_PLACEHOLDER } from '../../constants/team';

// --- Helpers ------------------------------------------------------------------
const STATUS_META: Record<UserStatus, { label: string; bg: string; color: string }> = {
  ACTIVE:    { label: 'Active',    bg: '#dcfce7', color: '#15803d' },
  PENDING:   { label: 'Pending',   bg: '#fef3c7', color: '#92400e' },
  INACTIVE:  { label: 'Inactive',  bg: '#f1f5f9', color: '#475569' },
  SUSPENDED: { label: 'Suspended', bg: '#fee2e2', color: '#b91c1c' },
};

const ROLE_META: Record<UserRole, { label: string; bg: string; color: string }> = {
  SUPER_ADMIN:     { label: 'Super Admin',    bg: '#fee2e2', color: '#b91c1c' },
  CLIENT_ADMIN:    { label: 'Client Admin',   bg: '#dbeafe', color: '#1d4ed8' },
  MANAGER:         { label: 'Manager',        bg: '#e0f2fe', color: '#0369a1' },
  FINANCE:         { label: 'Finance',        bg: '#f0fdf4', color: '#15803d' },
  MAINTENANCE:     { label: 'Maintenance',    bg: '#fef3c7', color: '#92400e' },
  RECEPTIONIST:    { label: 'Reception',      bg: '#e0f2fe', color: '#0369a1' },
  TENANT_ADMIN:    { label: 'Tenant Admin',   bg: '#ede9fe', color: '#6d28d9' },
  TENANT_EMPLOYEE: { label: 'Employee',       bg: '#f1f5f9', color: '#475569' },
  GUEST:           { label: 'Guest',          bg: '#f8fafc', color: '#94a3b8' },
};

const AVATAR_COLORS = ['#2563eb','#059669','#d97706','#7c3aed','#dc2626','#0369a1','#0891b2'];

function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Add/Edit User Modal ------------------------------------------------------
function UserModal({
  open, onClose, editUser, tenantId, allowedRoles, actorId,
}: {
  open: boolean;
  onClose: () => void;
  editUser?: User;
  tenantId: string;
  allowedRoles: UserRole[];
  actorId?: string;
}) {
  const { t: th } = usePageTheme();
  const [form]    = Form.useForm();
  const qc        = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [inviteByEmail, setInviteByEmail] = useState(true);
  const isEdit    = !!editUser;

  const handleOk = async () => {
    try {
      await form.validateFields();
      setLoading(true);
      const values = form.getFieldsValue();
      if (isEdit) {
        await userApi.update(editUser!.id, {
          first_name: values.first_name,
          last_name:  values.last_name,
          role:       values.role,
          phone_number: values.phone_number?.trim(),
        } as unknown);
        message.success('User updated successfully');
      } else {
        const payload: Record<string, unknown> = {
          tenant_id:  tenantId,
          email:      values.email,
          first_name: values.first_name,
          last_name:  values.last_name,
          role:       values.role ?? allowedRoles[0] ?? 'TENANT_EMPLOYEE',
          phone_number: values.phone_number?.trim(),
          send_email: inviteByEmail,
        };
        if (values.role === 'RECEPTIONIST' && actorId) {
          payload.managed_by_id = actorId;
        }
        if (inviteByEmail) {
          const res = await userApi.invite(payload);
          const sent = (res as any)?.data?.invite_email_sent ?? (res as any)?.invite_email_sent;
          message.success(
            sent
              ? 'Invitation sent — they will receive an email to set their password'
              : 'User created — email could not be sent (check mail settings in backend .env)',
          );
        } else {
          payload.password = values.password;
          await userApi.create(payload);
          message.success('User created successfully');
        }
      }
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['client-onboarding-team'] });
      onClose();
      form.resetFields();
    } catch (e) {
      const msg = (e as any)?.response?.data?.message ?? (e as any)?.message ?? 'Something went wrong';
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
      title={
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{isEdit ? 'Edit User' : inviteByEmail ? 'Invite Team Member' : 'Add New User'}</div>
          <div style={{ fontSize: 13, color: th.textSub, fontWeight: 400, marginTop: 2 }}>
            {isEdit
              ? `Editing ${editUser?.first_name} ${editUser?.last_name}`
              : inviteByEmail
                ? 'They will get an email to set their password'
                : 'Create a new user account with a password you choose'}
          </div>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        style={{ marginTop: 16 }}
        initialValues={isEdit ? {
          first_name: editUser?.first_name,
          last_name:  editUser?.last_name,
          role:       editUser?.role,
          phone_number: editUser?.phone_number ?? '',
        } : { role: allowedRoles[0] ?? 'TENANT_EMPLOYEE' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="First Name" name="first_name" rules={[{ required: true, message: 'Required' }]}>
            <Input prefix={<UserOutlined style={{ color: th.textMuted }} />} placeholder="First name" />
          </Form.Item>
          <Form.Item label="Last Name" name="last_name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Last name" />
          </Form.Item>
        </div>

        <Form.Item
          label="Phone number"
          name="phone_number"
          rules={[
            { required: true, message: 'Phone is required' },
            { pattern: PHONE_E164_PATTERN, message: `Use international format e.g. ${PHONE_PLACEHOLDER}` },
          ]}
        >
          <Input prefix={<PhoneOutlined style={{ color: th.textMuted }} />} placeholder={PHONE_PLACEHOLDER} />
        </Form.Item>

        {!isEdit && (
          <>
            <Form.Item label="Email Address" name="email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
              <Input prefix={<MailOutlined style={{ color: th.textMuted }} />} placeholder="user@company.com" />
            </Form.Item>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: th.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={inviteByEmail} onChange={(e) => setInviteByEmail(e.target.checked)} />
              Send invite email (recommended — user sets their own password)
            </label>
            {!inviteByEmail && (
              <Form.Item label="Password" name="password" rules={[{ required: true, min: 8, message: 'Min 8 characters' }]}>
                <Input.Password prefix={<LockOutlined style={{ color: th.textMuted }} />} placeholder="Min. 8 characters" />
              </Form.Item>
            )}
          </>
        )}

        <Form.Item label="Role" name="role" rules={[{ required: true }]}>
          <Select
            options={allowedRoles.map(r => ({
              value: r,
              label: ROLE_META[r]?.label ?? r,
            }))}
          />
        </Form.Item>
      </Form>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => { onClose(); form.resetFields(); }} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text }}>
          Cancel
        </button>
        <button onClick={handleOk} disabled={loading} style={{ padding: '9px 24px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {loading ? 'Saving...' : isEdit ? 'Save Changes' : inviteByEmail ? 'Send Invite' : '+ Create User'}
        </button>
      </div>
    </Modal>
  );
}

// --- Page ---------------------------------------------------------------------
export default function UsersPage() {
  const { card: CARD, headerCard, t: th } = usePageTheme();
  const qc              = useQueryClient();
  const { user: me }    = useAuthStore();
  const isSuperAdmin    = me?.role === 'SUPER_ADMIN';
  const isClientAdmin   = me?.role === 'CLIENT_ADMIN';
  const isManager       = me?.role === 'MANAGER';
  const isTenantAdmin   = me?.role === 'TENANT_ADMIN';
  const tenantId        = me?.tenant_id ?? '';
  const canManageTeam   = isSuperAdmin || isClientAdmin || isManager;

  const [q,         setQ]        = useState('');
  const [roleFilter, setRole]    = useState('');
  const [statusFilter, setStatus]= useState('');
  const [modalOpen, setModal]    = useState(false);
  const [editUser,  setEdit]     = useState<User | undefined>();

  const allowedRoles: UserRole[] = isSuperAdmin
    ? ['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER', 'FINANCE', 'MAINTENANCE', 'RECEPTIONIST', 'TENANT_ADMIN', 'TENANT_EMPLOYEE']
    : isClientAdmin
      ? [...CLIENT_TEAM_ROLES]
      : isManager
        ? ['FINANCE', 'MAINTENANCE', 'RECEPTIONIST']
        : ['TENANT_EMPLOYEE'];

  const roleFilterOptions: UserRole[] = isSuperAdmin
    ? (Object.keys(ROLE_META) as UserRole[])
    : canManageTeam && !isSuperAdmin
      ? allowedRoles
      : [];

  // -- Fetch users --
  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['users', tenantId, isSuperAdmin],
    queryFn:  () => userApi.getAll(isSuperAdmin ? undefined : tenantId).then(r => r.data),
    enabled: !!(isSuperAdmin || isClientAdmin || isManager || isTenantAdmin),
  });

  // -- Delete / suspend user --
  const deleteMut = useMutation({
    mutationFn: (id: string) => userApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); message.success('User removed'); },
    onError:    () => message.error('Failed to remove user'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => userApi.update(id, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); message.success('User updated'); },
  });

  // -- Filter --
  const filtered = (users as User[]).filter(u => {
    if (u.id === me?.id)                                           return false; // hide self
    if (isManager && !['FINANCE', 'MAINTENANCE', 'RECEPTIONIST'].includes(u.role)) return false;
    if (isClientAdmin && !CLIENT_TEAM_ROLES.includes(u.role))      return false;
    if (roleFilter   && u.role   !== roleFilter)                   return false;
    if (statusFilter && u.status !== statusFilter)                 return false;
    if (q && !`${u.first_name ?? ''} ${u.last_name ?? ''} ${u.email}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  // -- Stats --
  const all     = users as User[];
  const active  = all.filter(u => u.status === 'ACTIVE').length;
  const pending = all.filter(u => u.status === 'PENDING').length;
  const counts  = Object.fromEntries(
    Object.keys(ROLE_META).map(r => [r, all.filter(u => u.role === r).length])
  );

  return (
    <PageShell>

      {/* -- Header -- */}
      <div style={headerCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: th.text }}>
              {isSuperAdmin ? 'User & Role Management' : 'Team'}
            </h2>
            <p style={{ margin: 0, color: th.textSub, fontSize: 14 }}>
              {isSuperAdmin
                ? 'Manage all platform users, roles and permissions'
                : isManager
                  ? 'Invite and manage finance, maintenance, and reception staff'
                  : 'Managers, finance, maintenance, reception — all in one place'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ReloadOutlined /> Refresh
            </button>
            <button style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              <DownloadOutlined /> Export
            </button>
            <button
              onClick={() => { setEdit(undefined); setModal(true); }}
              style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <PlusOutlined /> Invite Member
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[
            { label: isSuperAdmin ? 'Total Users' : 'Team members', value: all.length, sub: isSuperAdmin ? 'All accounts' : 'In your organization', color: '#2563eb', bg: '#eff6ff', icon: '👥' },
            { label: 'Active',       value: active,      sub: 'Can log in',      color: '#059669', bg: '#f0fdf4', icon: '✅' },
            { label: 'Pending',      value: pending,     sub: 'Awaiting setup',  color: '#d97706', bg: '#fffbeb', icon: '⏳' },
            { label: 'Roles in use', value: Object.values(counts).filter(v => v > 0).length, sub: 'Distinct roles', color: '#7c3aed', bg: '#f5f3ff', icon: '🔑' },
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

        {/* Role breakdown pills */}
        {isSuperAdmin && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            {(Object.entries(counts) as [UserRole, number][])
              .filter(([, v]) => v > 0)
              .map(([role, count]) => {
                const rm = ROLE_META[role];
                return (
                  <div
                    key={role}
                    onClick={() => setRole(roleFilter === role ? '' : role)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: roleFilter === role ? rm.color : rm.bg, border: `1px solid ${rm.color}44`, cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: roleFilter === role ? '#fff' : rm.color }}>{rm.label}</span>
                    <span style={{ fontSize: 11, background: roleFilter === role ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)', color: roleFilter === role ? '#fff' : rm.color, padding: '0 5px', borderRadius: 10 }}>{count}</span>
                  </div>
                );
              })
            }
          </div>
        )}
      </div>

      {/* -- Toolbar -- */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: th.textMuted }} />}
          placeholder="Search by name or email..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ width: 260, borderRadius: 8 }}
        />
        <Select
          value={statusFilter || 'all'}
          onChange={v => setStatus(v === 'all' ? '' : v)}
          style={{ width: 160 }}
          options={[
            { value: 'all',       label: 'All Status'  },
            { value: 'ACTIVE',    label: 'Active'      },
            { value: 'PENDING',   label: 'Pending'     },
            { value: 'INACTIVE',  label: 'Inactive'    },
            { value: 'SUSPENDED', label: 'Suspended'   },
          ]}
        />
        {roleFilterOptions.length > 0 && (
          <Select
            value={roleFilter || 'all'}
            onChange={v => setRole(v === 'all' ? '' : v)}
            style={{ width: 170 }}
            options={[
              { value: 'all', label: 'All Roles' },
              ...roleFilterOptions.map((r) => ({ value: r, label: ROLE_META[r]?.label ?? r })),
            ]}
          />
        )}
        {(q || roleFilter || statusFilter) && (
          <button
            onClick={() => { setQ(''); setRole(''); setStatus(''); }}
            style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.textSub }}
          >
            Clear filters
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 13, color: th.textSub }}>
          Showing <strong style={{ color: th.text }}>{isLoading ? '—' : filtered.length}</strong> of {all.length} users
        </div>
      </div>

      {/* -- Error -- */}
      {isError && (
        <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: th.text, marginBottom: 8 }}>Failed to load users</div>
          <button onClick={() => refetch()} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* -- Loading -- */}
      {isLoading && (
        <div style={CARD}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ padding: '14px 20px', borderBottom: i < 5 ? `1px solid ${th.divider}` : 'none' }}>
              <Skeleton avatar active paragraph={{ rows: 1 }} />
            </div>
          ))}
        </div>
      )}

      {/* -- Empty -- */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div style={{ ...CARD, padding: '60px' }}>
          <Empty
            description={
              all.length === 0
                ? 'No users yet. Add your first team member!'
                : 'No users match your current filters.'
            }
          />
        </div>
      )}

      {/* -- User Table -- */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isSuperAdmin ? '2.2fr 1.5fr 1.2fr 1fr 1fr 1fr 1fr' : '2.2fr 1.5fr 1.2fr 1fr 1fr 1fr',
            padding: '11px 20px',
            background: th.tableHead,
            borderBottom: `1px solid ${th.cardBorder}`,
            fontSize: 11, fontWeight: 600, color: th.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <span>User</span>
            <span>Email</span>
            <span>Phone</span>
            <span>Role</span>
            <span>Status</span>
            {isSuperAdmin && <span>Last Login</span>}
            <span>Actions</span>
          </div>

          {filtered.map((u: User, i: number) => {
            const sm  = STATUS_META[u.status] ?? STATUS_META.INACTIVE;
            const rm  = ROLE_META[u.role as UserRole] ?? ROLE_META.TENANT_EMPLOYEE;
            const col = getAvatarColor(u.email);
            return (
              <div
                key={u.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isSuperAdmin ? '2.2fr 1.5fr 1.2fr 1fr 1fr 1fr 1fr' : '2.2fr 1.5fr 1.2fr 1fr 1fr 1fr',
                  padding: '13px 20px',
                  borderBottom: i < filtered.length - 1 ? `1px solid ${th.divider}` : 'none',
                  alignItems: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = th.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {/* User */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <UserAvatar
                    avatarUrl={u.avatar_url}
                    firstName={u.first_name}
                    lastName={u.last_name}
                    email={u.email}
                    size={36}
                    style={{ background: col }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: th.text }}>{formatUserName(u.first_name, u.last_name, u.email)}</div>
                    <div style={{ fontSize: 11, color: th.textMuted }}>ID: {u.id.substring(0, 8)}...</div>
                  </div>
                </div>

                {/* Email */}
                <div style={{ fontSize: 12, color: th.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MailOutlined style={{ fontSize: 11, color: th.textMuted, flexShrink: 0 }} />
                  {u.email}
                </div>

                <div style={{ fontSize: 12, color: th.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <PhoneOutlined style={{ fontSize: 11, color: th.textMuted, flexShrink: 0 }} />
                  {u.phone_number ?? '—'}
                </div>

                {/* Role */}
                <span style={{ background: rm.bg, color: rm.color, fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 20, display: 'inline-block', whiteSpace: 'nowrap' }}>
                  {rm.label}
                </span>

                {/* Status */}
                <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-block' }}>
                  {sm.label}
                </span>

                {/* Last login (SUPER_ADMIN only) */}
                {isSuperAdmin && (
                  <div style={{ fontSize: 11, color: th.textMuted }}>
                    {u.last_login_at ? formatDate(u.last_login_at) : 'Never'}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 5 }}>
                  <button
                    onClick={() => { setEdit(u); setModal(true); }}
                    style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Edit user"
                  >
                    <EditOutlined style={{ fontSize: 12, color: th.textSub }} />
                  </button>

                  {u.status === 'SUSPENDED' || u.status === 'INACTIVE' ? (
                    <button
                      onClick={() => updateMut.mutate({ id: u.id, data: { status: 'ACTIVE' } })}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Activate"
                    >
                      <CheckCircleOutlined style={{ fontSize: 12, color: '#15803d' }} />
                    </button>
                  ) : (
                    <button
                      onClick={() => updateMut.mutate({ id: u.id, data: { status: 'SUSPENDED' } })}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Suspend"
                    >
                      <StopOutlined style={{ fontSize: 12, color: '#dc2626' }} />
                    </button>
                  )}

                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        Modal.confirm({
                          title: `Delete ${u.first_name} ${u.last_name}?`,
                          content: 'This action cannot be undone.',
                          okText: 'Delete',
                          okType: 'danger',
                          onOk: () => deleteMut.mutate(u.id),
                        });
                      }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Delete"
                    >
                      <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 700 }}>✕</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: th.textMuted }}>Showing {filtered.length} of {all.length} users</span>
            <span style={{ fontSize: 12, color: th.textSub }}>
              {active} active · {pending} pending
            </span>
          </div>
        </div>
      )}

      {/* -- Modal -- */}
      <UserModal
        open={modalOpen}
        onClose={() => { setModal(false); setEdit(undefined); }}
        editUser={editUser}
        tenantId={tenantId}
        allowedRoles={allowedRoles}
        actorId={me?.id}
      />
    </PageShell>
  );
}
