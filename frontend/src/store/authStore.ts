import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import axios, { AxiosError } from 'axios';
import type { User } from '../types';
import { API_BASE_URL, unwrapApiPayload } from '../api/client';
import { getIsRestoringSession, setIsRestoringSession } from './authSession';
import {
  clearAuthStorage,
  getStoredAccessToken,
  getStoredRefreshToken,
  hasStoredCredentials,
  readPersistedAuthSnapshot,
  readStoredUser,
  writeStoredUser,
  writeTokens,
} from './authStorage';

interface AuthState {
  user: User | null;
  access_token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken?: string) => void;
}

export {
  clearAuthStorage,
  getStoredAccessToken,
  getStoredRefreshToken,
  hasStoredCredentials,
  readPersistedAuthSnapshot,
} from './authStorage';

export function isAuthPending(state?: Pick<AuthState, 'hasHydrated'>): boolean {
  const hasHydrated = state?.hasHydrated ?? useAuthStore.getState().hasHydrated;
  return !hasHydrated && hasStoredCredentials();
}

export function hasValidSession(): boolean {
  const state = useAuthStore.getState();
  if (!state.hasHydrated) return false;
  const token = state.access_token ?? getStoredAccessToken();
  const user = state.user ?? readStoredUser();
  return !!token && !!user?.id;
}

function persistSession(user: User, accessToken: string, refreshToken?: string | null) {
  writeTokens(accessToken, refreshToken);
  writeStoredUser(user);
}

function isAuthHttpError(error: unknown): boolean {
  const status = (error as AxiosError)?.response?.status;
  return status === 401 || status === 404;
}

async function refreshTokensDirect(refreshToken: string) {
  const res = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
  return unwrapApiPayload(res.data) as {
    accessToken: string;
    refreshToken?: string;
    user?: User;
  };
}

async function fetchCurrentUser(accessToken: string): Promise<User> {
  const res = await axios.get(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = unwrapApiPayload(res.data) as { user?: User } | User;
  const user = (data as { user?: User })?.user ?? (data as User);
  if (!user?.id) throw new Error('Invalid user payload from /auth/me');
  return user;
}

function applySession(
  set: (patch: Partial<AuthState>) => void,
  user: User,
  accessToken: string,
  refreshToken?: string | null,
) {
  persistSession(user, accessToken, refreshToken);
  set({
    user,
    access_token: accessToken,
    isAuthenticated: true,
    hasHydrated: true,
    isLoading: false,
  });
}

const boot = readPersistedAuthSnapshot();

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: boot.user,
      access_token: boot.access_token,
      isAuthenticated: boot.isAuthenticated,
      isLoading: false,
      hasHydrated: boot.hasCachedSession || !hasStoredCredentials(),

      restoreSession: async () => {
        if (getIsRestoringSession()) return;

        const snapshot = readPersistedAuthSnapshot();
        const accessToken = getStoredAccessToken() ?? snapshot.access_token;
        const refreshToken = getStoredRefreshToken();
        const cachedUser = get().user ?? snapshot.user;
        const hadCachedSession = !!(cachedUser?.id && accessToken);

        if (!accessToken && !refreshToken) {
          set({
            user: null,
            access_token: null,
            isAuthenticated: false,
            hasHydrated: true,
            isLoading: false,
          });
          return;
        }

        if (hadCachedSession) {
          applySession(set, cachedUser!, accessToken!, refreshToken);
        }

        setIsRestoringSession(true);
        if (!hadCachedSession) {
          set({ isLoading: true, isAuthenticated: !!accessToken, access_token: accessToken });
        }

        try {
          let activeToken = accessToken;

          if (!activeToken && refreshToken) {
            const refreshed = await refreshTokensDirect(refreshToken);
            if (!refreshed?.accessToken) {
              throw Object.assign(new Error('Refresh failed'), { response: { status: 401 } });
            }
            activeToken = refreshed.accessToken;
            const user = refreshed.user?.id ? refreshed.user : await fetchCurrentUser(activeToken);
            applySession(set, user, activeToken, refreshed.refreshToken ?? refreshToken);
            return;
          }

          if (!activeToken) {
            set({ hasHydrated: true, isLoading: false });
            return;
          }

          try {
            const user = await fetchCurrentUser(activeToken);
            applySession(set, user, activeToken, refreshToken);
          } catch (meError) {
            if (refreshToken && isAuthHttpError(meError)) {
              const refreshed = await refreshTokensDirect(refreshToken);
              if (!refreshed?.accessToken) throw meError;
              activeToken = refreshed.accessToken;
              const user = refreshed.user?.id ? refreshed.user : await fetchCurrentUser(activeToken);
              applySession(set, user, activeToken, refreshed.refreshToken ?? refreshToken);
              return;
            }

            if (cachedUser?.id && activeToken) {
              applySession(set, cachedUser, activeToken, refreshToken);
              return;
            }

            throw meError;
          }
        } catch (error) {
          if (cachedUser?.id && accessToken) {
            applySession(set, cachedUser, accessToken, refreshToken);
            return;
          }

          if ((error as AxiosError)?.response?.status === 401) {
            clearAuthStorage();
            set({
              user: null,
              access_token: null,
              isAuthenticated: false,
              hasHydrated: true,
              isLoading: false,
            });
            return;
          }

          set({
            user: cachedUser,
            access_token: accessToken,
            isAuthenticated: !!(accessToken && cachedUser?.id),
            hasHydrated: true,
            isLoading: false,
          });
        } finally {
          setIsRestoringSession(false);
        }
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          clearAuthStorage();
          set({
            user: null,
            access_token: null,
            isAuthenticated: false,
          });

          const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
          const payload = unwrapApiPayload(res.data) as {
            accessToken: string;
            refreshToken: string;
            user: User;
          };

          persistSession(payload.user, payload.accessToken, payload.refreshToken);
          set({
            user: payload.user,
            access_token: payload.accessToken,
            isAuthenticated: true,
            isLoading: false,
            hasHydrated: true,
          });
        } catch (err) {
          clearAuthStorage();
          set({
            user: null,
            access_token: null,
            isAuthenticated: false,
            isLoading: false,
            hasHydrated: true,
          });
          throw err;
        }
      },

      logout: async () => {
        const refresh = getStoredRefreshToken();
        if (refresh) {
          try {
            await axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken: refresh });
          } catch {
            // ignore
          }
        }
        clearAuthStorage();
        set({
          user: null,
          access_token: null,
          isAuthenticated: false,
          hasHydrated: true,
          isLoading: false,
        });
      },

      setUser: (user) => {
        writeStoredUser(user);
        set({ user });
      },

      setTokens: (accessToken, refreshToken) => {
        writeTokens(accessToken, refreshToken);
        set({ access_token: accessToken, isAuthenticated: true });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        access_token: state.access_token,
        isAuthenticated: state.isAuthenticated,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<AuthState>;
        const token = persisted.access_token ?? getStoredAccessToken();
        const user = persisted.user ?? readStoredUser() ?? currentState.user ?? null;

        if (token) writeTokens(token, getStoredRefreshToken());
        if (user?.id) writeStoredUser(user);

        const hasCachedSession = !!(token && user?.id);

        return {
          ...currentState,
          user,
          access_token: token,
          isAuthenticated: hasCachedSession || !!token,
          hasHydrated: hasCachedSession || currentState.hasHydrated || !hasStoredCredentials(),
        };
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          useAuthStore.setState({ hasHydrated: true });
          return;
        }
        void useAuthStore.getState().restoreSession();
      },
    },
  ),
);

if (typeof window !== 'undefined') {
  if (useAuthStore.persist.hasHydrated()) {
    void useAuthStore.getState().restoreSession();
  }

  window.addEventListener('auth:session-expired', () => {
    useAuthStore.setState({
      user: null,
      access_token: null,
      isAuthenticated: false,
      hasHydrated: true,
      isLoading: false,
    });
  });
}
