import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, hasValidSession, isAuthPending } from '../store/authStore';
import { mustChangePassword } from '../utils/authRedirect';
import AuthSessionLoader from './AuthSessionLoader';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (isAuthPending() || !hasHydrated) {
    return <AuthSessionLoader />;
  }

  if (!hasValidSession()) return <Navigate to="/login" replace />;

  if (mustChangePassword(user) && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}
