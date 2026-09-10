import { useNavigate } from 'react-router-dom';
import { RightOutlined } from '@ant-design/icons';
import { getRoleDashboardTheme } from '../constants/dashboards';

interface Props {
  role: string | undefined;
  userName?: string;
}

/** Prominent role-specific banner shown at the top of home dashboards. */
export default function RoleDashboardHero({ role, userName }: Props) {
  const navigate = useNavigate();
  const theme = getRoleDashboardTheme(role);
  if (!theme) return null;

  return (
    <div
      style={{
        background: theme.gradient,
        borderRadius: 14,
        padding: '20px 24px',
        marginBottom: 20,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                background: 'rgba(255,255,255,0.18)',
                padding: '4px 10px',
                borderRadius: 20,
              }}
            >
              Your role
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                background: theme.badgeBg,
                color: theme.badgeColor,
                padding: '4px 12px',
                borderRadius: 20,
              }}
            >
              {theme.label}
            </span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
            {userName ? `Hello, ${userName}` : 'Welcome back'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', maxWidth: 560, lineHeight: 1.5 }}>
            {theme.description}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.75)', marginBottom: 10 }}>
        Quick actions for your role
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {theme.quickActions.map((action) => (
          <button
            key={action.path + action.label}
            type="button"
            onClick={() => navigate(action.path)}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: '#fff',
              color: action.color,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
          >
            {action.label}
            <RightOutlined style={{ fontSize: 10 }} />
          </button>
        ))}
      </div>
    </div>
  );
}
