import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  HomeOutlined, AppstoreOutlined, FileTextOutlined,
  CreditCardOutlined, ToolOutlined, CalendarOutlined,
  BellOutlined, UserOutlined, LogoutOutlined,
  BankOutlined, TeamOutlined, BarChartOutlined,
  SafetyOutlined, TagOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, ApartmentOutlined, BuildOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import NotificationBell from '../components/NotificationBell';
import GlobalSearch from '../components/GlobalSearch';

// ─── Sidebar menu per role ─────────────────────────────────────────────────────
function getSidebarItems(role: string) {
  if (role === 'SUPER_ADMIN') return [
    { icon: <HomeOutlined />,        label: 'Dashboard',    path: '/admin/dashboard'    },
    { icon: <BankOutlined />,        label: 'Sites',        path: '/admin/sites'        },
    { icon: <AppstoreOutlined />,    label: 'Spaces',       path: '/admin/spaces'       },
    { icon: <TeamOutlined />,        label: 'Tenants',      path: '/admin/tenants'      },
    { icon: <UserOutlined />,        label: 'Users',        path: '/admin/users'        },
    { icon: <CalendarOutlined />,    label: 'Bookings',     path: '/admin/bookings'     },
    { icon: <FileTextOutlined />,    label: 'Contracts',    path: '/admin/contracts'    },
    { icon: <CreditCardOutlined />,  label: 'Billing',      path: '/admin/billing'      },
    { icon: <CreditCardOutlined />,  label: 'Payments',     path: '/admin/payments'     },
    { icon: <ToolOutlined />,        label: 'Maintenance',  path: '/admin/maintenance'  },
    { icon: <TagOutlined />,         label: 'Price Plans',  path: '/admin/price-plans'  },
    { icon: <BarChartOutlined />,    label: 'Reports',      path: '/admin/reports'      },
    { icon: <SafetyOutlined />,      label: 'Audit Logs',   path: '/admin/audit'        },
    { icon: <BellOutlined />,        label: 'Notifications',path: '/admin/notifications'},
    { icon: <ApartmentOutlined />,   label: 'Buildings',    path: '/admin/buildings'    },
    { icon: <BuildOutlined />,       label: 'Floors',       path: '/admin/floors'       },
  ];

  if (role === 'SITE_MANAGER') return [
    { icon: <HomeOutlined />,        label: 'Dashboard',    path: '/admin/site-dashboard' },
    { icon: <BankOutlined />,        label: 'Sites',        path: '/admin/sites'          },
    { icon: <AppstoreOutlined />,    label: 'Spaces',       path: '/admin/spaces'         },
    { icon: <ApartmentOutlined />,   label: 'Buildings',    path: '/admin/buildings'      },
    { icon: <BuildOutlined />,       label: 'Floors',       path: '/admin/floors'         },
    { icon: <ToolOutlined />,        label: 'Maintenance',  path: '/admin/maintenance'    },
    { icon: <TagOutlined />,         label: 'Price Plans',  path: '/admin/price-plans'    },
    { icon: <BarChartOutlined />,    label: 'Reports',      path: '/admin/reports'        },
    { icon: <BellOutlined />,        label: 'Notifications',path: '/admin/notifications'  },
  ];

  if (role === 'FINANCE') return [
    { icon: <HomeOutlined />,        label: 'Dashboard',    path: '/admin/finance-dashboard' },
    { icon: <CreditCardOutlined />,  label: 'Billing',      path: '/admin/billing'           },
    { icon: <CreditCardOutlined />,  label: 'Payments',     path: '/admin/payments'          },
    { icon: <BarChartOutlined />,    label: 'Reports',      path: '/admin/reports'           },
    { icon: <BellOutlined />,        label: 'Notifications',path: '/admin/notifications'     },
  ];

  if (role === 'MAINTENANCE') return [
    { icon: <HomeOutlined />,        label: 'Dashboard',    path: '/admin/maintenance-dashboard' },
    { icon: <ToolOutlined />,        label: 'All Tickets',  path: '/admin/maintenance'           },
    { icon: <BellOutlined />,        label: 'Notifications',path: '/admin/notifications'         },
  ];

  if (role === 'TENANT_ADMIN') return [
    { icon: <HomeOutlined />,        label: 'Dashboard',    path: '/portal/dashboard'    },
    { icon: <AppstoreOutlined />,    label: 'Browse Spaces',path: '/portal/spaces'       },
    { icon: <CalendarOutlined />,    label: 'Bookings',     path: '/portal/bookings'     },
    { icon: <FileTextOutlined />,    label: 'Contracts',    path: '/portal/contracts'    },
    { icon: <CreditCardOutlined />,  label: 'Billing',      path: '/portal/billing'      },
    { icon: <ToolOutlined />,        label: 'Maintenance',  path: '/portal/maintenance'  },
    { icon: <UserOutlined />,        label: 'My Team',      path: '/portal/users'        },
    { icon: <BarChartOutlined />,    label: 'Reports',      path: '/portal/reports'      }, // ✅ NEW
    { icon: <BellOutlined />,        label: 'Notifications',path: '/portal/notifications'},
  ];

  // EMPLOYEE
  return [
    { icon: <HomeOutlined />,        label: 'Dashboard',    path: '/portal/dashboard'    },
    { icon: <AppstoreOutlined />,    label: 'Browse Spaces',path: '/portal/spaces'       },
    { icon: <CalendarOutlined />,    label: 'Bookings',     path: '/portal/bookings'     },
    { icon: <ToolOutlined />,        label: 'Maintenance',  path: '/portal/maintenance'  },
    { icon: <BellOutlined />,        label: 'Notifications',path: '/portal/notifications'},
  ];
}

function getRoleLabel(role: string): { label: string; bg: string; color: string } {
  const MAP: Record<string, { label: string; bg: string; color: string }> = {
    SUPER_ADMIN:  { label: 'Super Admin',  bg: '#fee2e2', color: '#b91c1c' },
    SITE_MANAGER: { label: 'Site Manager', bg: '#dbeafe', color: '#1d4ed8' },
    FINANCE:      { label: 'Finance',      bg: '#f0fdf4', color: '#15803d' },
    MAINTENANCE:  { label: 'Maintenance',  bg: '#fef3c7', color: '#92400e' },
    TENANT_ADMIN: { label: 'Tenant Admin', bg: '#ede9fe', color: '#6d28d9' },
    EMPLOYEE:     { label: 'Employee',     bg: '#f1f5f9', color: '#475569' },
  };
  return MAP[role] ?? { label: role, bg: '#f1f5f9', color: '#475569' };
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function MainLayout() {
  const navigate      = useNavigate();
  const { pathname }  = useLocation();
  const { user, logout } = useAuthStore() as any;
  const { isDark, t, toggle } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);

  const role      = user?.role ?? 'EMPLOYEE';
  const items     = getSidebarItems(role);
  const roleMeta  = getRoleLabel(role);
  const sideWidth = collapsed ? 64 : 220;

  const isBackOffice = ['SUPER_ADMIN', 'SITE_MANAGER', 'FINANCE', 'MAINTENANCE'].includes(role);
  const basePath     = isBackOffice ? '/admin' : '/portal';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: t.pageBg }}>

      {/* ── Sidebar ── (always dark, unchanged) */}
      <aside style={{
        width: sideWidth, minWidth: sideWidth, flexShrink: 0,
        background: '#0f172a',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflowX: 'hidden', overflowY: 'auto',
        zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ padding: collapsed ? '16px 0' : '16px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', justifyContent: collapsed ? 'center' : 'flex-start', flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, background: '#2563eb', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HomeOutlined style={{ color: '#fff', fontSize: 16 }} />
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', lineHeight: 1.1 }}>LeaseManager</div>
              <div style={{ fontSize: 10, color: '#475569' }}>Management Platform</div>
            </div>
          )}
        </div>

        {/* User info */}
        {!collapsed && user && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff', flexShrink: 0 }}>
                {user.first_name?.[0]}{user.last_name?.[0]}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.first_name} {user.last_name}</div>
                <span style={{ fontSize: 10, fontWeight: 600, background: roleMeta.bg, color: roleMeta.color, padding: '1px 6px', borderRadius: 10 }}>{roleMeta.label}</span>
              </div>
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {items.map(item => {
            const isDashboard = [
              '/admin/dashboard', '/portal/dashboard',
              '/admin/site-dashboard', '/admin/finance-dashboard',
              '/admin/maintenance-dashboard',
            ].includes(item.path);

            const active = isDashboard
              ? pathname === item.path
              : pathname === item.path || pathname.startsWith(item.path + '/');

            return (
              <button
                key={item.label + item.path}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '10px 0' : '9px 10px',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  marginBottom: 2, textAlign: 'left', fontSize: 13, fontWeight: 500,
                  background: active ? 'rgba(37,99,235,0.3)' : 'transparent',
                  color: active ? '#60a5fa' : '#94a3b8',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e2e8f0'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; } }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom: collapse + logout */}
        <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748b', fontSize: 13, marginBottom: 4, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e2e8f0'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            {collapsed ? <MenuUnfoldOutlined style={{ fontSize: 16 }} /> : <><MenuFoldOutlined style={{ fontSize: 16 }} /> Collapse</>}
          </button>
          <button
            onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748b', fontSize: 13, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            <LogoutOutlined style={{ fontSize: 16 }} />
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{ height: 56, background: t.topbar, borderBottom: `1px solid ${t.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0, zIndex: 5 }}>
          {/* Breadcrumb */}
          <div style={{ fontSize: 13, color: t.textSub }}>
            {pathname.split('/').filter(Boolean).map((seg, i, arr) => (
              <span key={seg}>
                <span style={{ color: i === arr.length - 1 ? t.text : t.textMuted, fontWeight: i === arr.length - 1 ? 600 : 400, textTransform: 'capitalize' }}>
                  {seg.replace(/-/g, ' ')}
                </span>
                {i < arr.length - 1 && <span style={{ margin: '0 6px', color: t.cardBorder }}>›</span>}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Global Search */}
            <GlobalSearch />

            {/* ✅ Dark mode toggle — only addition to original */}
            <button
              onClick={toggle}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                width: 36, height: 36, borderRadius: 9,
                border: `1px solid ${t.cardBorder}`,
                background: t.cardBg,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = t.cardBg)}
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            {/* NotificationBell */}
            <NotificationBell basePath={basePath} />

            {user && (
              <div
                onClick={() => navigate(`${basePath}/profile`)}
                title="My Profile"
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 9, transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = t.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff' }}>
                  {user.first_name?.[0]}{user.last_name?.[0]}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{user.first_name} {user.last_name}</span>
                  <span style={{ fontSize: 10, color: t.textMuted }}>{roleMeta.label}</span>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: t.pageBg }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}