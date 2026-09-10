import { getUserInitials } from '../utils/user';

/** Circular avatar: photo when available, otherwise initials on a gradient. */
export default function UserAvatar({
  avatarUrl,
  firstName = '',
  lastName = '',
  email,
  size = 32,
  style,
}: {
  avatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  size?: number;
  style?: React.CSSProperties;
}) {
  const initials = getUserInitials(firstName, lastName, email);
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
    fontWeight: 700,
    fontSize: Math.max(size * 0.38, 10),
    color: '#fff',
    ...style,
  };

  if (avatarUrl) {
    return (
      <div style={base} aria-hidden>
        <img
          src={avatarUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  return (
    <div style={base}>
      {initials}
    </div>
  );
}
