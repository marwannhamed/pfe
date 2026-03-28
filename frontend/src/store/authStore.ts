import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { authApi } from '../api/services';

interface AuthState {
  user:            User | null;
  access_token:    string | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  login:   (email: string, password: string) => Promise<void>;
  logout:  () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:            null,
      access_token:    null,
      isAuthenticated: false,
      isLoading:       false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await authApi.login({ email, password });
          // Backend returns: { accessToken, refreshToken, user }
          const { accessToken, refreshToken, user } = res.data;
          localStorage.setItem('access_token',  accessToken);
          localStorage.setItem('refresh_token', refreshToken);
          set({ user, access_token: accessToken, isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, access_token: null, isAuthenticated: false });
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user:            state.user,
        access_token:    state.access_token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
