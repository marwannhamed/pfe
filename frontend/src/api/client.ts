import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({
  baseURL: 'http://localhost:6001',
  headers: { 'Content-Type': 'application/json' },
});

// â”€â”€ Attach JWT to every request â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
api.interceptors.request.use((config) => {
  // authStore uses access_token (not accessToken)
  const state = useAuthStore.getState() as any;
  const token = state.access_token ?? localStorage.getItem('access_token') ?? null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// â”€â”€ Handle errors + auto refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const req = error.config as any;

    // Auto-refresh on 401
    if (error.response?.status === 401 && !req._retry) {
      req._retry = true;
      try {
        // refreshToken is stored in localStorage by authStore.login()
        const refresh = localStorage.getItem('refresh_token');
        if (refresh) {
          const res = await axios.post(
            'http://localhost:6001/auth/refresh-token',
            { refreshToken: refresh },
          );
          const newToken = res.data.accessToken;
          localStorage.setItem('access_token', newToken);
          // Update store
          const state = useAuthStore.getState() as any;
          if (state.setUser && res.data.user) state.setUser(res.data.user);
          req.headers.Authorization = `Bearer ${newToken}`;
          return api(req);
        }
      } catch {
        // Refresh failed â†’ logout
        const state = useAuthStore.getState() as any;
        if (state.logout) state.logout();
        window.location.href = '/login';
      }
    }

    // Build readable error message
    let message = 'Something went wrong. Please try again.';
    const data  = error.response?.data as any;
    if (data) {
      if (typeof data === 'string' && data.length < 300)  message = data;
      else if (data?.message) message = Array.isArray(data.message) ? data.message[0] : String(data.message);
      else if (data?.error)   message = String(data.error);
    }
    (error as any).userMessage = message;

    return Promise.reject(error);
  }
);

