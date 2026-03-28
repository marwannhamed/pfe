import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface Props {
  allowed: string[];
  children: React.ReactNode;
}

export default function RoleRoute({ allowed, children }: Props) {
  const { user } = useAuthStore();
  const role = user?.role ?? '';

  if (!allowed.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
