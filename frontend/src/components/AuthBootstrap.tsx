import { useAuthStore, isAuthPending } from '../store/authStore';
import AuthSessionLoader from './AuthSessionLoader';

/** Shows a loader only while we have tokens but no cached session yet. */
export default function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  if (isAuthPending({ hasHydrated })) {
    return <AuthSessionLoader />;
  }

  return <>{children}</>;
}
