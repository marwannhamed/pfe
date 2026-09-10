import type { User } from '../types';

/**
 * Per-tab session storage — each browser tab keeps its own login.
 * localStorage is shared across tabs, so two accounts in the same browser
 * would overwrite each other on refresh.
 */
const store = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
};

const AUTH_KEYS = ['access_token', 'refresh_token', 'auth_user', 'auth-storage'] as const;

function getItem(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function setItem(key: string, value: string) {
  store()?.setItem(key, value);
}

function removeItem(key: string) {
  store()?.removeItem(key);
}

export function getStoredAccessToken(): string | null {
  return getItem('access_token');
}

export function getStoredRefreshToken(): string | null {
  return getItem('refresh_token');
}

export function readStoredUser(): User | null {
  try {
    const raw = getItem('auth_user');
    if (!raw) return null;
    const user = JSON.parse(raw) as User;
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

export function writeStoredUser(user: User | null) {
  if (user?.id) {
    setItem('auth_user', JSON.stringify(user));
  } else {
    removeItem('auth_user');
  }
}

export function writeTokens(accessToken: string, refreshToken?: string | null) {
  setItem('access_token', accessToken);
  if (refreshToken) setItem('refresh_token', refreshToken);
}

export function clearAuthStorage() {
  for (const key of AUTH_KEYS) {
    removeItem(key);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore — legacy cleanup only
    }
  }
}

export function hasStoredCredentials(): boolean {
  return !!(getStoredAccessToken() || getStoredRefreshToken());
}

export function readPersistedAuthSnapshot() {
  const access_token = getStoredAccessToken();
  const refresh_token = getStoredRefreshToken();
  let user = readStoredUser();

  if (!user) {
    try {
      const raw = getItem('auth-storage');
      if (raw) {
        const parsed = JSON.parse(raw);
        const state = parsed?.state ?? parsed;
        user = (state?.user as User | undefined)?.id ? (state.user as User) : null;
      }
    } catch {
      // ignore
    }
  }

  const token = access_token ?? null;
  const hasCachedSession = !!(token && user?.id);

  return {
    user,
    access_token: token,
    isAuthenticated: hasCachedSession || !!token || !!refresh_token,
    hasCachedSession,
  };
}
