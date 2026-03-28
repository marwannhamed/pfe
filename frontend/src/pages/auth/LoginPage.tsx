import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  HomeOutlined, EyeOutlined, EyeInvisibleOutlined,
  UserOutlined, LockOutlined,
} from '@ant-design/icons';

export default function LoginPage() {
  const navigate       = useNavigate();
  const { login, user }= useAuthStore() as any;

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setError('');
    setLoading(true);
    try {
      // authStore.login(email, password) handles everything
      await login(email, password);

      // After login, user is in store — redirect based on role
      const u = useAuthStore.getState().user as any;
      const role = u?.role ?? '';

      if      (role === 'SUPER_ADMIN')  navigate('/admin/dashboard',             { replace: true });
      else if (role === 'SITE_MANAGER') navigate('/admin/site-dashboard',         { replace: true });
      else if (role === 'FINANCE')      navigate('/admin/finance-dashboard',      { replace: true });
      else if (role === 'MAINTENANCE')  navigate('/admin/maintenance-dashboard',  { replace: true });
      else                              navigate('/portal/dashboard',             { replace: true });
    } catch (err: any) {
      let message = 'Login failed. Please check your credentials.';
      const data  = err?.response?.data;
      if (data) {
        if (typeof data === 'string' && data.length < 300) message = data;
        else if (data?.message) message = Array.isArray(data.message) ? data.message[0] : String(data.message);
        else if (data?.error)   message = String(data.error);
      } else if (err?.message && !err.message.includes('JSON')) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Left panel ── */}
      <div style={{ width: '38%', background: 'linear-gradient(145deg, #0f172a, #1e3a8a)', display: 'flex', flexDirection: 'column', padding: '40px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

        <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', position: 'relative' }}>
          <div style={{ width: 40, height: 40, background: '#2563eb', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HomeOutlined style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>LeaseManager</div>
            <div style={{ fontSize: 11, color: '#93c5fd' }}>Property Management Platform</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
          <h1 style={{ color: '#fff', fontSize: 36, fontWeight: 800, lineHeight: 1.2, marginBottom: 16 }}>
            Manage your{' '}
            <span style={{ color: '#60a5fa' }}>property portfolio</span>{' '}
            with ease.
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.6, marginBottom: 40 }}>
            A complete platform for managing spaces, contracts, tenants and billing.
          </p>
          {[
            { icon: '🏢', text: 'Site & space management'       },
            { icon: '👥', text: 'Tenant & contract tracking'    },
            { icon: '💳', text: 'Billing & payment management'  },
            { icon: '📊', text: 'Real-time analytics & reports' },
          ].map(f => (
            <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{f.icon}</div>
              <span style={{ color: '#cbd5e1', fontSize: 14 }}>{f.text}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 32, position: 'relative' }}>
          {[['1,200+', 'Offices'], ['98%', 'Satisfaction'], ['24/7', 'Support']].map(([v, l]) => (
            <div key={l}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{v}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Welcome back</h2>
          <p style={{ color: '#64748b', marginBottom: 32, fontSize: 15 }}>Sign in to your management dashboard</p>

          {/* Error */}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span style={{ color: '#b91c1c', fontSize: 14 }}>{error}</span>
              <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Email address</label>
              <div style={{ position: 'relative' }}>
                <UserOutlined style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 15, zIndex: 1 }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  style={{ width: '100%', padding: '12px 14px 12px 42px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', color: '#0f172a', background: '#fff', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = '#2563eb')}
                  onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Password</label>
                <Link to="/forgot-password" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>Forgot password?</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <LockOutlined style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 15, zIndex: 1 }} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  style={{ width: '100%', padding: '12px 44px 12px 42px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', color: '#0f172a', background: '#fff', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = '#2563eb')}
                  onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
                >
                  {showPwd ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '14px', borderRadius: 10, background: loading ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#64748b' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Create one</Link>
          </p>

          {/* Quick test accounts */}
          <div style={{ marginTop: 32, padding: '16px', background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Quick test accounts</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { role: 'Super Admin',  email: 'admin@leasemanager.com'  },
                { role: 'Tenant Admin', email: 'tenant@leasemanager.com' },
                { role: 'Site Manager', email: 'manager@leasemanager.com'},
              ].map(acc => (
                <button
                  key={acc.role}
                  onClick={() => { setEmail(acc.email); setPassword('Password123!'); }}
                  style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f8fafc', fontSize: 11, cursor: 'pointer', color: '#374151', fontWeight: 500 }}
                >
                  {acc.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
