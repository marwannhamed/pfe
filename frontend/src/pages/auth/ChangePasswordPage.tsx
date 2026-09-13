import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  LockOutlined, EyeOutlined, EyeInvisibleOutlined, HomeOutlined,
} from '@ant-design/icons';
import { useAuthStore, hasValidSession, isAuthPending } from '../../store/authStore';
import { userApi } from '../../api/services';
import { unwrapApiPayload } from '../../api/client';
import { message } from '../../utils/feedback';
import { mustChangePassword, resolvePostAuthPath } from '../../utils/authRedirect';
import AuthSessionLoader from '../../components/AuthSessionLoader';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, hasHydrated, setUser, logout } = useAuthStore();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isAuthPending() || !hasHydrated) {
    return <AuthSessionLoader />;
  }

  if (!hasValidSession() || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!mustChangePassword(user)) {
    return <Navigate to={resolvePostAuthPath(user)} replace />;
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!current.trim()) e.current = 'Required';
    if (!next.trim()) e.next = 'Required';
    else if (next.length < 8) e.next = 'Min 8 characters';
    if (!confirm.trim()) e.confirm = 'Required';
    else if (next && confirm !== next) e.confirm = 'Passwords do not match';
    if (current && next && current === next) e.next = 'Must differ from current password';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) {
      setErrors(v);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await userApi.changePassword(user.id, {
        currentPassword: current,
        newPassword: next,
      });
      const updated = unwrapApiPayload(res.data) ?? res.data;
      setUser({ ...user, ...updated, must_change_password: false });
      message.success('Password updated. Welcome!');
      navigate(resolvePostAuthPath({ ...user, must_change_password: false }), { replace: true });
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const text = Array.isArray(msg) ? msg[0] : msg;
      if (text?.toLowerCase().includes('incorrect')) {
        setErrors({ current: 'Current password is incorrect' });
      } else {
        message.error(text ?? 'Failed to change password');
      }
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 44px 12px 42px',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    fontSize: 14,
    outline: 'none',
    color: '#0f172a',
    background: '#fff',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden' }}>
      <div style={{
        width: '38%',
        background: 'linear-gradient(145deg, #0f172a, #1e3a8a)',
        display: 'flex',
        flexDirection: 'column',
        padding: 40,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, background: '#2563eb', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HomeOutlined style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>LeaseManager</div>
            <div style={{ fontSize: 11, color: '#93c5fd' }}>Security check</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 800, lineHeight: 1.2, marginBottom: 16 }}>
            Set your new password
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.6 }}>
            For security, you must choose a new password before accessing your workspace.
            This is required on your first login with a temporary password.
          </p>
        </div>
      </div>

      <div style={{ flex: 1, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Change password</h2>
          <p style={{ color: '#64748b', marginBottom: 28, fontSize: 14 }}>
            Signed in as <strong>{user.email}</strong>
          </p>

          <form onSubmit={handleSubmit}>
            {([
              { key: 'current', label: 'Current password', value: current, set: setCurrent, show: showCurrent, toggle: () => setShowCurrent(s => !s) },
              { key: 'next', label: 'New password', value: next, set: setNext, show: showNext, toggle: () => setShowNext(s => !s) },
              { key: 'confirm', label: 'Confirm new password', value: confirm, set: setConfirm, show: showConfirm, toggle: () => setShowConfirm(s => !s) },
            ] as const).map(f => (
              <div key={f.key} style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <div style={{ position: 'relative' }}>
                  <LockOutlined style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 15, zIndex: 1 }} />
                  <input
                    type={f.show ? 'text' : 'password'}
                    value={f.value}
                    onChange={e => { f.set(e.target.value); setErrors(er => { const n = { ...er }; delete n[f.key]; return n; }); }}
                    style={{ ...fieldStyle, borderColor: errors[f.key] ? '#ef4444' : '#e5e7eb' }}
                    autoComplete={f.key === 'current' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={f.toggle}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
                  >
                    {f.show ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  </button>
                </div>
                {errors[f.key] && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors[f.key]}</div>}
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 10,
                background: loading ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)',
                border: 'none',
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                marginTop: 8,
              }}
            >
              {loading ? 'Saving...' : 'Update password & continue'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
            style={{ marginTop: 20, background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}
