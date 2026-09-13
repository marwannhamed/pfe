import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserOutlined,
  LockOutlined,
  BellOutlined,
  RightOutlined,
  DesktopOutlined,
  DeleteOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import PageShell from '../../components/ui/PageShell';
import PageHeader from '../../components/ui/PageHeader';
import UserAvatar from '../../components/UserAvatar';
import { usePageTheme } from '../../hooks/usePageTheme';
import { useAuthStore } from '../../store/authStore';
import { authApi, notificationApi, userApi } from '../../api/services';
import { message } from '../../utils/feedback';
import { formatUserName } from '../../utils/user';
import { isProfileComplete } from '../../utils/clientOnboarding';
import type { ApiError } from '../../types';
import { asApiError } from '../../utils/errors';

type SettingsTab = 'profile' | 'security' | 'notifications';

interface UserSession {
  id: string;
  created_at: string;
  last_used_at: string;
  isCurrent: boolean;
}

interface LoginActivityEntry {
  id: string;
  action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  session_id: string | null;
}

function formatIp(ip: string | null | undefined) {
  if (!ip) return 'Unknown';
  return ip.replace(/^::ffff:/, '');
}

function describeUserAgent(ua: string | null | undefined) {
  if (!ua) return 'Unknown browser';
  if (/Edg\//.test(ua)) return 'Microsoft Edge';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
  return ua.length > 48 ? `${ua.slice(0, 48)}…` : ua;
}

function loginActivityLabel(action: LoginActivityEntry['action']) {
  if (action === 'LOGIN') return 'Successful login';
  if (action === 'LOGOUT') return 'Logged out';
  return 'Failed login attempt';
}

interface NotificationPrefs {
  // index signature so the object satisfies the Record<string, unknown> the API takes
  [key: string]: unknown;
  channels: { in_app: boolean; email: boolean; sms: boolean };
  categories: {
    booking: boolean;
    invoice: boolean;
    contract: boolean;
    maintenance: boolean;
    security: boolean;
  };
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  th,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  th: ReturnType<typeof usePageTheme>['t'];
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 0',
        borderBottom: `1px solid ${th.divider}`,
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, color: th.text }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: th.textMuted, marginTop: 2 }}>{description}</div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 99,
          border: 'none',
          cursor: 'pointer',
          background: checked ? '#2563eb' : th.divider,
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const { card, input: INPUT, t: th } = usePageTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const basePath = location.pathname.startsWith('/portal') ? '/portal' : '/admin';
  const [tab, setTab] = useState<SettingsTab>('profile');

  const userId = user?.id ?? '';

  const { data: sessionsRaw, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () => authApi.getSessions().then((r) => r.data as UserSession[]),
    enabled: !!userId && tab === 'security',
  });

  const sessions = Array.isArray(sessionsRaw) ? sessionsRaw : [];

  const { data: loginActivityRaw, isLoading: loginActivityLoading } = useQuery({
    queryKey: ['auth-login-activity'],
    queryFn: () => authApi.getLoginActivity().then((r) => r.data as LoginActivityEntry[]),
    enabled: !!userId && tab === 'security',
  });

  const loginActivity = Array.isArray(loginActivityRaw) ? loginActivityRaw : [];

  const { data: prefsRaw, isLoading: prefsLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationApi.getMyPreferences().then((r) => r.data as NotificationPrefs),
    enabled: !!userId && tab === 'notifications',
  });

  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const activePrefs = prefs ?? prefsRaw ?? null;

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  const profileDone = isProfileComplete(user);

  const tabs = useMemo(
    () => [
      { id: 'profile' as const, label: 'Profile', icon: <UserOutlined /> },
      { id: 'security' as const, label: 'Security', icon: <LockOutlined /> },
      { id: 'notifications' as const, label: 'Notifications', icon: <BellOutlined /> },
    ],
    [],
  );

  const savePrefsMut = useMutation({
    mutationFn: (data: NotificationPrefs) => notificationApi.updateMyPreferences(data),
    onSuccess: () => {
      message.success('Notification preferences saved');
      qc.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
    onError: () => message.error('Failed to save preferences'),
  });

  const pwMut = useMutation({
    mutationFn: () =>
      userApi.changePassword(userId, {
        currentPassword: pwForm.current,
        newPassword: pwForm.next,
      }),
    onSuccess: () => {
      message.success('Password updated');
      setPwForm({ current: '', next: '', confirm: '' });
      setPwErrors({});
      if (setUser) setUser({ ...user!, must_change_password: false });
    },
    onError: (err: ApiError) => {
      const msg = err?.userMessage ?? asApiError(err).response?.data?.message ?? 'Failed to change password';
      message.error(typeof msg === 'string' ? msg : 'Failed to change password');
    },
  });

  const revokeMut = useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: () => {
      message.success('Session ended');
      refetchSessions();
    },
    onError: () => message.error('Could not end session'),
  });

  const revokeOthersMut = useMutation({
    mutationFn: () => authApi.revokeOtherSessions(),
    onSuccess: () => {
      message.success('Other sessions ended');
      refetchSessions();
    },
    onError: () => message.error('Could not end other sessions'),
  });

  const validatePassword = () => {
    const e: Record<string, string> = {};
    if (!pwForm.current) e.current = 'Required';
    if (!pwForm.next) e.next = 'Required';
    if (pwForm.next.length < 8) e.next = 'Min 8 characters';
    if (!pwForm.confirm) e.confirm = 'Required';
    if (pwForm.next && pwForm.confirm && pwForm.next !== pwForm.confirm) {
      e.confirm = 'Passwords do not match';
    }
    return e;
  };

  const updatePref = (path: string, value: boolean) => {
    if (!activePrefs) return;
    const next = structuredClone(activePrefs) as NotificationPrefs;
    const parts = path.split('.');
    if (parts[0] === 'channels' && parts[1]) {
      next.channels[parts[1] as keyof NotificationPrefs['channels']] = value;
    }
    if (parts[0] === 'categories' && parts[1]) {
      next.categories[parts[1] as keyof NotificationPrefs['categories']] = value;
    }
    setPrefs(next);
  };

  return (
    <PageShell maxWidth={900}>
      <PageHeader
        title="Settings"
        subtitle="Manage your account, security, and notification preferences"
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 10,
                border: `1px solid ${active ? '#2563eb' : th.cardBorder}`,
                background: active ? '#eff6ff' : th.cardBg,
                color: active ? '#1d4ed8' : th.textSub,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'profile' && (
        <div style={{ ...card, padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <UserAvatar
              avatarUrl={user?.avatar_url}
              firstName={user?.first_name}
              lastName={user?.last_name}
              email={user?.email}
              size={56}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: th.text }}>
                {formatUserName(user?.first_name, user?.last_name, user?.email)}
              </div>
              <div style={{ fontSize: 13, color: th.textSub, marginTop: 4 }}>{user?.email}</div>
              <div
                style={{
                  marginTop: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: profileDone ? '#15803d' : '#d97706',
                }}
              >
                {profileDone ? <CheckCircleOutlined /> : null}
                {profileDone ? 'Profile complete' : 'Profile incomplete — add phone & details'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`${basePath}/profile`)}
              style={{
                padding: '10px 16px',
                borderRadius: 9,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Edit profile <RightOutlined />
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: th.textMuted, lineHeight: 1.6 }}>
            Update your name, email, phone number, and avatar on the profile page. A complete profile
            helps your team and tenants reach you.
          </p>
        </div>
      )}

      {tab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...card, padding: '24px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: th.text, marginBottom: 16 }}>
              Change password
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
              {(['current', 'next', 'confirm'] as const).map((field) => (
                <div key={field}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: th.textSub, display: 'block', marginBottom: 4 }}>
                    {field === 'current' ? 'Current password' : field === 'next' ? 'New password' : 'Confirm new password'}
                  </label>
                  <input
                    type="password"
                    style={{ ...INPUT, borderColor: pwErrors[field] ? '#ef4444' : th.inputBorder }}
                    value={pwForm[field]}
                    onChange={(e) => {
                      setPwForm((f) => ({ ...f, [field]: e.target.value }));
                      setPwErrors((er) => {
                        const n = { ...er };
                        delete n[field];
                        return n;
                      });
                    }}
                  />
                  {pwErrors[field] && (
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{pwErrors[field]}</div>
                  )}
                </div>
              ))}
              <button
                type="button"
                disabled={pwMut.isPending}
                onClick={() => {
                  const e = validatePassword();
                  if (Object.keys(e).length) {
                    setPwErrors(e);
                    return;
                  }
                  pwMut.mutate();
                }}
                style={{
                  alignSelf: 'flex-start',
                  padding: '10px 18px',
                  borderRadius: 9,
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  opacity: pwMut.isPending ? 0.7 : 1,
                }}
              >
                Update password
              </button>
            </div>
          </div>

          <div style={{ ...card, padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: th.text }}>Active sessions</div>
                <div style={{ fontSize: 12, color: th.textMuted, marginTop: 4 }}>
                  Each browser tab on localhost keeps its own session. End sessions you do not recognize.
                </div>
              </div>
              {sessions.length > 1 && (
                <button
                  type="button"
                  disabled={revokeOthersMut.isPending}
                  onClick={() => revokeOthersMut.mutate()}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: `1px solid ${th.cardBorder}`,
                    background: th.cardBg,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#dc2626',
                  }}
                >
                  Log out other devices
                </button>
              )}
            </div>

            {sessionsLoading ? (
              <div style={{ fontSize: 13, color: th.textMuted }}>Loading sessions…</div>
            ) : sessions.length === 0 ? (
              <div style={{ fontSize: 13, color: th.textMuted }}>
                No active sessions found. Log in again if this looks wrong (local dev: restart backend after schema changes).
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: `1px solid ${session.isCurrent ? '#93c5fd' : th.cardBorder}`,
                      background: session.isCurrent ? '#eff6ff' : th.tableHead,
                    }}
                  >
                    <DesktopOutlined style={{ fontSize: 18, color: th.textSub }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: th.text }}>
                        {session.isCurrent ? 'This browser' : 'Browser session'}
                        {session.isCurrent && (
                          <span style={{ marginLeft: 8, fontSize: 10, color: '#2563eb', fontWeight: 800 }}>
                            CURRENT
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: th.textMuted }}>
                        Started {formatWhen(session.created_at)} · Last active {formatWhen(session.last_used_at)}
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <button
                        type="button"
                        title="End session"
                        disabled={revokeMut.isPending}
                        onClick={() => revokeMut.mutate(session.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#dc2626',
                          cursor: 'pointer',
                          padding: 6,
                        }}
                      >
                        <DeleteOutlined />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ ...card, padding: '24px' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: th.text }}>Login activity</div>
              <div style={{ fontSize: 12, color: th.textMuted, marginTop: 4 }}>
                Recent sign-ins, sign-outs, and failed attempts on your account.
              </div>
            </div>

            {loginActivityLoading ? (
              <div style={{ fontSize: 13, color: th.textMuted }}>Loading activity…</div>
            ) : loginActivity.length === 0 ? (
              <div style={{ fontSize: 13, color: th.textMuted }}>
                No login events yet. Sign out and back in to record your first entry.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loginActivity.map((entry) => {
                  const actionColor =
                    entry.action === 'LOGIN'
                      ? '#16a34a'
                      : entry.action === 'LOGOUT'
                        ? th.textMuted
                        : '#dc2626';

                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: `1px solid ${th.cardBorder}`,
                        background: th.tableHead,
                      }}
                    >
                      <HistoryOutlined style={{ fontSize: 16, color: actionColor, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: th.text }}>
                          {loginActivityLabel(entry.action)}
                        </div>
                        <div style={{ fontSize: 11, color: th.textMuted, marginTop: 2 }}>
                          {formatWhen(entry.created_at)} · {describeUserAgent(entry.user_agent)} · IP{' '}
                          {formatIp(entry.ip_address)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div style={{ ...card, padding: '24px' }}>
          {prefsLoading && !activePrefs ? (
            <div style={{ fontSize: 13, color: th.textMuted }}>Loading preferences…</div>
          ) : activePrefs ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 15, color: th.text, marginBottom: 8 }}>Channels</div>
              <ToggleRow
                th={th}
                label="In-app notifications"
                description="Show alerts inside the platform"
                checked={activePrefs.channels.in_app}
                onChange={(v) => updatePref('channels.in_app', v)}
              />
              <ToggleRow
                th={th}
                label="Email notifications"
                description="Send updates to your inbox (requires mail config in local dev)"
                checked={activePrefs.channels.email}
                onChange={(v) => updatePref('channels.email', v)}
              />

              <div style={{ fontWeight: 700, fontSize: 15, color: th.text, margin: '20px 0 8px' }}>Categories</div>
              <ToggleRow th={th} label="Bookings" checked={activePrefs.categories.booking} onChange={(v) => updatePref('categories.booking', v)} />
              <ToggleRow th={th} label="Invoices & billing" checked={activePrefs.categories.invoice} onChange={(v) => updatePref('categories.invoice', v)} />
              <ToggleRow th={th} label="Contracts" checked={activePrefs.categories.contract} onChange={(v) => updatePref('categories.contract', v)} />
              <ToggleRow th={th} label="Maintenance" checked={activePrefs.categories.maintenance} onChange={(v) => updatePref('categories.maintenance', v)} />
              <ToggleRow th={th} label="Security & login" checked={activePrefs.categories.security} onChange={(v) => updatePref('categories.security', v)} />

              <button
                type="button"
                disabled={savePrefsMut.isPending}
                onClick={() => savePrefsMut.mutate(activePrefs)}
                style={{
                  marginTop: 20,
                  padding: '10px 18px',
                  borderRadius: 9,
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: savePrefsMut.isPending ? 0.7 : 1,
                }}
              >
                <SaveOutlined /> Save preferences
              </button>
            </>
          ) : (
            <div style={{ fontSize: 13, color: th.textMuted }}>Could not load preferences.</div>
          )}
        </div>
      )}
    </PageShell>
  );
}
