import { useState } from 'react';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from '../../utils/feedback';
import AvatarUpload from '../../components/AvatarUpload';
import { unwrapApiPayload } from '../../api/client';
import {
  UserOutlined, MailOutlined, LockOutlined,
  EditOutlined, SaveOutlined, CloseOutlined,
  CheckCircleOutlined, EyeOutlined, EyeInvisibleOutlined,
  CalendarOutlined, FileTextOutlined, CreditCardOutlined,
  BellOutlined, LoadingOutlined, } from '@ant-design/icons';
import { userApi, bookingApi, contractApi, billingApi, notificationApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { PHONE_E164_PATTERN, PHONE_PLACEHOLDER } from '../../constants/team';
import type { ApiError, Booking, Invoice, LeaseContract, Notification } from '../../types';
import { asApiError } from '../../utils/errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  const nested = (raw as { data?: unknown }).data;
  if (Array.isArray(nested)) return nested as T[];
  return [];
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function timeAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 30)  return `${diff} days ago`;
  return formatDate(d);
}

const ROLE_META: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  SUPER_ADMIN:  { label: 'Super Admin',  bg: '#fee2e2', color: '#b91c1c', icon: '👑' },
  MANAGER: { label: 'Site Manager', bg: '#dbeafe', color: '#1d4ed8', icon: '🏗️' },
  FINANCE:      { label: 'Finance',      bg: '#f0fdf4', color: '#15803d', icon: '💰' },
  MAINTENANCE:  { label: 'Maintenance',  bg: '#fef3c7', color: '#92400e', icon: '🔧' },
  TENANT_ADMIN: { label: 'Tenant Admin', bg: '#ede9fe', color: '#6d28d9', icon: '🏢' },
  EMPLOYEE:     { label: 'TENANT_EMPLOYEE',     bg: '#f1f5f9', color: '#475569', icon: '👤' },
  RECEPTIONIST: { label: 'Reception',    bg: '#e0f2fe', color: '#0369a1', icon: '📞' },
};

// ─── Password input with show/hide ────────────────────────────────────────────
function PasswordInput({ value, onChange, placeholder, error }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; error?: string;
}) {
  const { input: INPUT, t: th } = usePageTheme();
  const [show, setShow] = useState(false);
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          style={{ ...INPUT, borderColor: error ? '#ef4444' : '#e5e7eb', paddingRight: 44 }}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: th.textMuted, fontSize: 16, display: 'flex', alignItems: 'center' }}
        >
          {show ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// ─── Password strength meter ──────────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {

  if (!password) return null;
  const checks = [
    { label: '8+ chars',    ok: password.length >= 8       },
    { label: 'Uppercase',   ok: /[A-Z]/.test(password)    },
    { label: 'Number',      ok: /\d/.test(password)        },
    { label: 'Symbol',      ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < score ? colors[score - 1] : '#e5e7eb', transition: 'background 0.2s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {checks.map((c, i) => (
            <span key={i} style={{ fontSize: 10, color: c.ok ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 2 }}>
              {c.ok ? '✓' : '○'} {c.label}
            </span>
          ))}
        </div>
        {score > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: colors[score - 1] }}>{labels[score - 1]}</span>}
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string | number; color: string; bg: string }) {

  const { card: CARD, t: th } = usePageTheme();
  return (
    <div style={{ ...CARD, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 10, color: th.textMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: th.text, lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { card: CARD, headerCard, input: INPUT, t: th } = usePageTheme();
  const LABEL: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: th.textSub, display: 'block', marginBottom: 5 };
  const qc       = useQueryClient();
  const { user, setUser } = useAuthStore() as any;
  const userId   = user?.id ?? '';
  const tenantId = user?.tenant_id ?? '';
  const roleMeta = ROLE_META[user?.role ?? ''] ?? ROLE_META.EMPLOYEE;
  const isTenant = ['TENANT_ADMIN', 'TENANT_EMPLOYEE'].includes(user?.role ?? '');

  // ── Edit profile state ──────────────────────────────────────────────────────
  const [editing, setEditing]   = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name ?? '',
    last_name:  user?.last_name  ?? '',
    email:      user?.email      ?? '',
    phone_number: user?.phone_number ?? '',
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  // ── Password state ──────────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwSuccess, setPwSuccess] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: bookingsRaw }  = useQuery({ queryKey: ['profile-bookings',  userId],   queryFn: () => bookingApi.getAll(isTenant ? { tenantId } : {}).then(r => r.data),          enabled: !!userId });
  const { data: contractsRaw } = useQuery({ queryKey: ['profile-contracts', tenantId], queryFn: () => contractApi.getAll(tenantId ? { tenantId } : {}).then(r => r.data),          enabled: !!userId });
  const { data: invoicesRaw }  = useQuery({ queryKey: ['profile-invoices',  tenantId], queryFn: () => billingApi.getInvoices(tenantId ? { tenantId } : {}).then(r => r.data),       enabled: !!userId });
  const { data: notifsRaw }    = useQuery({ queryKey: ['profile-notifs',    userId],   queryFn: () => notificationApi.getAll({ userId }).then(r => r.data),                         enabled: !!userId });

  const bookings  = toArray<Booking>(bookingsRaw);
  const contracts = toArray<LeaseContract>(contractsRaw);
  const invoices  = toArray<Invoice>(invoicesRaw);
  const notifs    = toArray<Notification>(notifsRaw);
  const unreadNotifs = notifs.filter(n => !n.is_read).length;

  // ── Update profile mutation ─────────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: (data: unknown) => userApi.update(userId, data),
    onSuccess: (res) => {
      message.success('Profile updated successfully!');
      const updated = unwrapApiPayload(res.data) ?? res.data;
      if (setUser && updated) {
        setUser({ ...user, ...updated });
      }
      qc.invalidateQueries({ queryKey: ['auth-me'] });
      setEditing(false);
    },
    onError: (err: ApiError) => {
      const msg = asApiError(err).response?.data?.message ?? 'Failed to update profile';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // ── Change password mutation ────────────────────────────────────────────────
  const pwMut = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      userApi.changePassword(userId, data),
    onSuccess: (res) => {
      message.success('Password changed successfully!');
      const updated = unwrapApiPayload(res.data) ?? res.data;
      if (setUser && updated) {
        setUser({ ...user, ...updated, must_change_password: false });
      } else if (setUser) {
        setUser({ ...user, must_change_password: false });
      }
      setPwForm({ current: '', next: '', confirm: '' });
      setPwErrors({});
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 4000);
    },
    onError: (err: ApiError) => {
      const msg = asApiError(err).response?.data?.message ?? 'Failed';
      if (typeof msg === 'string' && msg.toLowerCase().includes('incorrect')) {
        setPwErrors(e => ({ ...e, current: 'Current password is incorrect' }));
      } else {
        message.error(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    },
  });

  // ── Validate profile ────────────────────────────────────────────────────────
  const validateProfile = () => {
    const e: Record<string, string> = {};
    if (!profileForm.first_name.trim()) e.first_name = 'Required';
    if (!profileForm.last_name.trim())  e.last_name  = 'Required';
    if (!profileForm.email.trim())      e.email      = 'Required';
    if (profileForm.email && !/\S+@\S+\.\S+/.test(profileForm.email)) e.email = 'Invalid email';
    if (!profileForm.phone_number?.trim()) e.phone_number = 'Required';
    else if (!PHONE_E164_PATTERN.test(profileForm.phone_number.trim())) {
      e.phone_number = `Use international format e.g. ${PHONE_PLACEHOLDER}`;
    }
    return e;
  };

  const handleSaveProfile = () => {
    const e = validateProfile();
    if (Object.keys(e).length) { setProfileErrors(e); return; }
    updateMut.mutate({
      first_name: profileForm.first_name.trim(),
      last_name: profileForm.last_name.trim(),
      email: profileForm.email.trim(),
      phone_number: profileForm.phone_number.trim(),
    });
  };

  const handleAvatarUpdate = (url: string) => {
    if (setUser) setUser({ ...user, avatar_url: url });
    qc.invalidateQueries({ queryKey: ['users'] });
  };

  const handleCancelEdit = () => {
    setProfileForm({ first_name: user?.first_name ?? '', last_name: user?.last_name ?? '', email: user?.email ?? '', phone_number: user?.phone_number ?? '' });
    setProfileErrors({});
    setEditing(false);
  };

  // ── Validate password ───────────────────────────────────────────────────────
  const validatePassword = () => {
    const e: Record<string, string> = {};
    if (!pwForm.current)          e.current  = 'Required';
    if (!pwForm.next)             e.next     = 'Required';
    if (pwForm.next.length < 8)   e.next     = 'Min 8 characters';
    if (!pwForm.confirm)          e.confirm  = 'Required';
    if (pwForm.next && pwForm.confirm && pwForm.next !== pwForm.confirm) e.confirm = 'Passwords do not match';
    return e;
  };

  const handleChangePassword = () => {
    const e = validatePassword();
    if (Object.keys(e).length) { setPwErrors(e); return; }
    pwMut.mutate({ currentPassword: pwForm.current, newPassword: pwForm.next });
  };

  const joinDate = user?.created_at ? formatDate(user.created_at) : '—';

  return (
    <PageShell maxWidth={1000}>

      {/* ── Profile Hero ── */}
      <div style={{ ...headerCard, padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>

          <AvatarUpload
            userId={userId}
            currentAvatarUrl={user?.avatar_url}
            firstName={user?.first_name ?? ''}
            lastName={user?.last_name ?? ''}
            size={90}
            onUpdate={handleAvatarUpdate}
          />

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: th.text }}>
                {user?.first_name} {user?.last_name}
              </h2>
              <span style={{ background: roleMeta.bg, color: roleMeta.color, fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20 }}>
                {roleMeta.icon} {roleMeta.label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: th.textSub }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MailOutlined /> {user?.email}</span>
              {user?.phone_number && <span>📞 {user.phone_number}</span>}
              <span>📅 Joined {joinDate}</span>
              {user?.tenant?.name && <span>🏢 {user.tenant.name}</span>}
            </div>
          </div>

          {/* Edit button */}
          {!editing && (
            <button onClick={() => setEditing(true)}
              style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: th.text, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <EditOutlined /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* ── Activity Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard icon={<CalendarOutlined />}    label="My Bookings"       value={bookings.length}                                   color="#2563eb" bg="#eff6ff" />
        <StatCard icon={<FileTextOutlined />}    label="Contracts"         value={contracts.filter(c => c.status === 'ACTIVE').length} color="#059669" bg="#f0fdf4" />
        <StatCard icon={<CreditCardOutlined />}  label="Invoices"          value={invoices.length}                                   color="#7c3aed" bg="#f5f3ff" />
        <StatCard icon={<BellOutlined />}        label="Unread Notifs"     value={unreadNotifs}                                      color={unreadNotifs > 0 ? '#dc2626' : '#94a3b8'} bg={unreadNotifs > 0 ? '#fef2f2' : '#f8fafc'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* ── Edit Profile Form ── */}
        <div style={CARD}>
          <div style={{ padding: '18px 24px 14px', borderBottom: `1px solid ${th.divider}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserOutlined style={{ color: '#2563eb', fontSize: 16 }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: th.text }}>Personal Information</span>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {editing ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={LABEL}>First Name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      style={{ ...INPUT, borderColor: profileErrors.first_name ? '#ef4444' : '#e5e7eb' }}
                      value={profileForm.first_name}
                      onChange={e => { setProfileForm(f => ({ ...f, first_name: e.target.value })); setProfileErrors(er => { const n = { ...er }; delete n.first_name; return n; }); }}
                      placeholder="First name"
                      autoFocus
                    />
                    {profileErrors.first_name && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{profileErrors.first_name}</div>}
                  </div>
                  <div>
                    <label style={LABEL}>Last Name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      style={{ ...INPUT, borderColor: profileErrors.last_name ? '#ef4444' : '#e5e7eb' }}
                      value={profileForm.last_name}
                      onChange={e => { setProfileForm(f => ({ ...f, last_name: e.target.value })); setProfileErrors(er => { const n = { ...er }; delete n.last_name; return n; }); }}
                      placeholder="Last name"
                    />
                    {profileErrors.last_name && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{profileErrors.last_name}</div>}
                  </div>
                </div>
                <div>
                  <label style={LABEL}>Email Address <span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <MailOutlined style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: th.textMuted, fontSize: 14 }} />
                    <input
                      style={{ ...INPUT, borderColor: profileErrors.email ? '#ef4444' : '#e5e7eb', paddingLeft: 36 }}
                      type="email"
                      value={profileForm.email}
                      onChange={e => { setProfileForm(f => ({ ...f, email: e.target.value })); setProfileErrors(er => { const n = { ...er }; delete n.email; return n; }); }}
                      placeholder="your@email.com"
                    />
                  </div>
                  {profileErrors.email && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{profileErrors.email}</div>}
                </div>
                <div>
                  <label style={LABEL}>Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    style={{ ...INPUT, borderColor: profileErrors.phone_number ? '#ef4444' : '#e5e7eb' }}
                    value={profileForm.phone_number}
                    onChange={e => { setProfileForm(f => ({ ...f, phone_number: e.target.value })); setProfileErrors(er => { const n = { ...er }; delete n.phone_number; return n; }); }}
                    placeholder={PHONE_PLACEHOLDER}
                  />
                  {profileErrors.phone_number && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{profileErrors.phone_number}</div>}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={handleCancelEdit} disabled={updateMut.isPending}
                    style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: th.text, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <CloseOutlined /> Cancel
                  </button>
                  <button onClick={handleSaveProfile} disabled={updateMut.isPending}
                    style={{ flex: 2, padding: '10px', borderRadius: 9, background: updateMut.isPending ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: updateMut.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {updateMut.isPending ? <><LoadingOutlined /> Saving...</> : <><SaveOutlined /> Save Changes</>}
                  </button>
                </div>
              </>
            ) : (
              // Read-only view
              <>
                {[
                  { label: 'First Name',  value: user?.first_name ?? '—',           icon: <UserOutlined /> },
                  { label: 'Last Name',   value: user?.last_name  ?? '—',           icon: <UserOutlined /> },
                  { label: 'Email',       value: user?.email      ?? '—',           icon: <MailOutlined /> },
                  { label: 'Phone',       value: user?.phone_number ?? 'Not set', icon: '📞' },
                  { label: 'Role',        value: `${roleMeta.icon} ${roleMeta.label}`, icon: '🎭' },
                  { label: 'Member Since',value: joinDate,                           icon: '📅' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${th.divider}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: th.textSub }}>
                      <span style={{ width: 18, textAlign: 'center' }}>{row.icon}</span>
                      {row.label}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: th.text, maxWidth: '60%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
                  </div>
                ))}
                <button onClick={() => setEditing(true)}
                  style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 9, border: `1px solid ${th.cardBorder}`, background: th.tableHead, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: th.text, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <EditOutlined /> Edit Profile
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Change Password ── */}
        <div style={CARD}>
          <div style={{ padding: '18px 24px 14px', borderBottom: `1px solid ${th.divider}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <LockOutlined style={{ color: '#7c3aed', fontSize: 16 }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: th.text }}>Change Password</span>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {pwSuccess && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 9, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircleOutlined style={{ color: '#15803d', fontSize: 18 }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#15803d', fontSize: 13 }}>Password changed successfully!</div>
                  <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>Your new password is now active.</div>
                </div>
              </div>
            )}

            <div>
              <label style={LABEL}>Current Password <span style={{ color: '#ef4444' }}>*</span></label>
              <PasswordInput
                value={pwForm.current}
                onChange={v => { setPwForm(f => ({ ...f, current: v })); setPwErrors(e => { const n = { ...e }; delete n.current; return n; }); }}
                placeholder="Your current password"
                error={pwErrors.current}
              />
            </div>

            <div>
              <label style={LABEL}>New Password <span style={{ color: '#ef4444' }}>*</span></label>
              <PasswordInput
                value={pwForm.next}
                onChange={v => { setPwForm(f => ({ ...f, next: v })); setPwErrors(e => { const n = { ...e }; delete n.next; return n; }); }}
                placeholder="Min 8 characters"
                error={pwErrors.next}
              />
              <PasswordStrength password={pwForm.next} />
            </div>

            <div>
              <label style={LABEL}>Confirm New Password <span style={{ color: '#ef4444' }}>*</span></label>
              <PasswordInput
                value={pwForm.confirm}
                onChange={v => { setPwForm(f => ({ ...f, confirm: v })); setPwErrors(e => { const n = { ...e }; delete n.confirm; return n; }); }}
                placeholder="Repeat new password"
                error={pwErrors.confirm}
              />
              {pwForm.confirm && pwForm.next && pwForm.confirm === pwForm.next && (
                <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircleOutlined /> Passwords match
                </div>
              )}
            </div>

            <button
              onClick={handleChangePassword}
              disabled={pwMut.isPending}
              style={{ width: '100%', padding: '11px', borderRadius: 9, background: pwMut.isPending ? '#a78bfa' : 'linear-gradient(135deg,#6d28d9,#7c3aed)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: pwMut.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {pwMut.isPending ? <><LoadingOutlined /> Updating...</> : <><LockOutlined /> Change Password</>}
            </button>

            <div style={{ background: th.tableHead, borderRadius: 9, padding: '12px 14px', fontSize: 12, color: th.textSub }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: th.text }}>💡 Password tips:</div>
              <div>• Use at least 8 characters</div>
              <div>• Mix uppercase, numbers & symbols</div>
              <div>• Avoid using your name or email</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent activity ── */}
      {bookings.length > 0 && (
        <div style={{ ...CARD, marginTop: 20 }}>
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${th.divider}`, fontWeight: 700, fontSize: 15, color: th.text }}>
            🕐 Recent Activity
          </div>
          <div style={{ padding: '8px 0' }}>
            {[...bookings]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 5)
              .map((b, i) => {
                const statusColors: Record<string, { bg: string; color: string }> = {
                  CONFIRMED:        { bg: '#dcfce7', color: '#15803d' },
                  PENDING_APPROVAL: { bg: '#fef3c7', color: '#92400e' },
                  CHECKED_IN:       { bg: '#dbeafe', color: '#1d4ed8' },
                  COMPLETED:        { bg: '#ede9fe', color: '#6d28d9' },
                  CANCELLED:        { bg: '#fee2e2', color: '#b91c1c' },
                };
                const sm = statusColors[b.status] ?? { bg: '#f1f5f9', color: '#475569' };
                return (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 24px', borderBottom: i < 4 ? `1px solid ${th.divider}` : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: sm.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, color: th.text, fontWeight: 500 }}>
                        Booking <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{b.booking_number}</span>
                      </span>
                      <span style={{ fontSize: 12, color: th.textMuted, marginLeft: 8 }}>— {b.space?.name ?? 'Space'}</span>
                    </div>
                    <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20 }}>{b.status.replace(/_/g,' ')}</span>
                    <span style={{ fontSize: 12, color: th.textMuted, flexShrink: 0 }}>{timeAgo(b.created_at)}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </PageShell>
  );
}