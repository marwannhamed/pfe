import { Navigate } from 'react-router-dom';
import { useAuthStore, hasValidSession, isAuthPending } from '../store/authStore';
import { mustChangePassword, resolveHomePathForRole } from '../utils/authRedirect';
import { normalizeRole } from '../permissions/can';
import AuthSessionLoader from './AuthSessionLoader';

interface Props {
  allowed: string[];
  children: React.ReactNode;
}

export default function RoleRoute({ allowed, children }: Props) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const user = useAuthStore((s) => s.user);

  if (isAuthPending({ hasHydrated })) {
    return <AuthSessionLoader />;
  }

  if (!hasHydrated) {
    return <AuthSessionLoader />;
  }

  if (!hasValidSession()) return <Navigate to="/login" replace />;

  if (mustChangePassword(user)) {
    return <Navigate to="/change-password" replace />;
  }

  const role = normalizeRole(user?.role) ?? user?.role ?? '';
  const allowedNorm = allowed.map((r) => normalizeRole(r) ?? r);

  if (!allowedNorm.includes(role)) {
    return <Navigate to={resolveHomePathForRole(role)} replace />;
  }

  return <>{children}</>;
}
