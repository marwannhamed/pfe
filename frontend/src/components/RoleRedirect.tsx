import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { resolvePostAuthPath } from '../utils/authRedirect';

/** Redirect authenticated users to their role-specific home dashboard. */
export default function RoleRedirect() {
  const { user } = useAuthStore();
  return <Navigate to={resolvePostAuthPath(user)} replace />;
}
