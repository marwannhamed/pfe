import { useAuthStore } from '../store/authStore';
import { getStoredAccessToken } from '../store/authStorage';

/** True once this tab has a hydrated session with a user id and access token. */
export function useAuthReady(): boolean {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.access_token);
  const token = accessToken ?? getStoredAccessToken();
  return hasHydrated && !!user?.id && !!token;
}
