import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { HomeOutlined } from '@ant-design/icons';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { hasValidSession } from '../store/authStore';
import { resolveMapPathForRole } from '../utils/mapRoutes';

export default function PublicLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isDark, t, toggle } = useThemeStore();
  const { user, isAuthenticated } = useAuthStore();
  const loggedIn = isAuthenticated && hasValidSession();
  const mapPath = loggedIn ? resolveMapPathForRole(user?.role) : '/map';

  const NAV = [
    { label: 'Find Spaces', path: mapPath },
    { label: 'Pricing',       path: '/pricing' },
    { label: 'About',         path: '/about'   },
  ];

  return (
    <div style={{ minHeight: '100vh', background: t.pageBg, position: 'relative', color: t.text }}>

      {/* ── Sticky navbar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: t.topbar,
        borderBottom: `1px solid ${t.cardBorder}`,
        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.35)' : '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        {/* inner container centered with max-width */}
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px', height: 66, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}>
              <HomeOutlined style={{ color: '#fff', fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: t.text, lineHeight: 1.1 }}>LeaseManager</div>
              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>Property Management Platform</div>
            </div>
          </div>

          {/* Nav links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {NAV.map(item => {
              const active = pathname === item.path || (item.path !== '/map' && pathname.startsWith(item.path));
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  style={{
                    border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, padding: '8px 16px', borderRadius: 8,
                    transition: 'all 0.15s',
                    background: active ? (isDark ? 'rgba(37,99,235,0.25)' : '#eff6ff') : 'transparent',
                    color: active ? '#60a5fa' : t.textSub,
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = t.hover; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Theme + Auth */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={toggle}
              title={isDark ? 'Light mode' : 'Dark mode'}
              style={{
                width: 38, height: 38, borderRadius: 9, cursor: 'pointer', fontSize: 17,
                border: `1px solid ${t.cardBorder}`, background: t.cardBg, color: t.text,
              }}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            {loggedIn ? (
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                style={{ padding: '8px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <button type="button" onClick={() => navigate('/login')} style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: t.cardBg, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: t.text }}>
                  Sign In
                </button>
                <button type="button" onClick={() => navigate('/register')} style={{ padding: '8px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}>
                  Register Company
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Page content — sections control their own width */}
      <main>
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer style={{ background: '#0f172a' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 40 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 30, height: 30, background: '#2563eb', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HomeOutlined style={{ color: '#fff', fontSize: 15 }} />
                </div>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>LeaseManager</span>
              </div>
              <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                A complete platform for finding and managing premium office spaces.
              </p>
            </div>
            {[
              { title: 'Product',  links: [{ label: 'Find Spaces (Map)', path: mapPath }, { label: 'Pricing', path: '/pricing' }] },
              { title: 'Company',  links: [{ label: 'About', path: '/about' }] },
              { title: 'Legal',    links: [{ label: 'Privacy Policy', path: '#' }, { label: 'Terms', path: '#' }] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 14 }}>{col.title}</div>
                {col.links.map(l => (
                  <div
                    key={l.label}
                    role="button"
                    tabIndex={0}
                    onClick={() => l.path !== '#' && navigate(l.path)}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && l.path !== '#') navigate(l.path); }}
                    style={{ color: '#475569', fontSize: 13, marginBottom: 9, cursor: l.path === '#' ? 'default' : 'pointer' }}
                    onMouseEnter={e => { if (l.path !== '#') e.currentTarget.style.color = '#94a3b8'; }}
                    onMouseLeave={e => { if (l.path !== '#') e.currentTarget.style.color = '#475569'; }}
                  >{l.label}</div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#475569', fontSize: 13 }}>© 2026 LeaseManager. All rights reserved.</span>
            <span style={{ color: '#475569', fontSize: 13 }}>Built with ❤️ for modern workplaces</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
