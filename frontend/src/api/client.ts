import axios, { AxiosError } from 'axios';
import type { User } from '../types';
import { getIsRestoringSession, getRefreshInFlight, setRefreshInFlight } from '../store/authSession';
import {
  clearAuthStorage,
  getStoredAccessToken,
  getStoredRefreshToken,
  writeStoredUser,
  writeTokens,
} from '../store/authStorage';

/** In dev, use Vite proxy (relative URLs). Override with VITE_API_URL if needed. */
export const API_BASE_URL =
  import.meta.env?.VITE_API_URL ??
  (import.meta.env?.DEV ? '' : 'http://localhost:6001');

export const unwrapApiPayload = (payload) => {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload
  ) {
    return payload.data;
  }
  return payload;
};

/** Normalize list endpoints (axios response or bare array). */
export function listFromApi<T>(res: unknown): T[] {
  const payload =
    res && typeof res === 'object' && res !== null && 'data' in res
      ? (res as { data: unknown }).data
      : res;
  return Array.isArray(payload) ? (payload as T[]) : [];
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

/** One refresh at a time — parallel 401s must not invalidate the session. */
async function refreshAccessToken(): Promise<string | null> {
  const inFlight = getRefreshInFlight();
  if (inFlight) return inFlight;

  const refresh = getStoredRefreshToken();
  if (!refresh) return null;

  const promise = (async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken: refresh });
      const payload = unwrapApiPayload(res.data) as {
        accessToken?: string;
        refreshToken?: string;
        user?: User;
      };
      const newToken = payload?.accessToken;
      if (!newToken) return null;
      writeTokens(newToken, payload.refreshToken ?? refresh);
      if (payload.user?.id) writeStoredUser(payload.user);
      return newToken;
    } catch {
      return null;
    } finally {
      setRefreshInFlight(null);
    }
  })();

  setRefreshInFlight(promise);
  return promise;
}

api.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => {
    res.data = unwrapApiPayload(res.data);
    return res;
  },
  async (error: AxiosError) => {
    const req = error.config as any;

    if (error.response?.status === 401 && req && !req._retry) {
      req._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        req.headers.Authorization = `Bearer ${newToken}`;
        return api(req);
      }

      if (!getIsRestoringSession()) {
        clearAuthStorage();
        window.dispatchEvent(new Event('auth:session-expired'));
      }
    }

    let message = 'Something went wrong. Please try again.';
    if (!error.response) {
      const code = (error as AxiosError & { code?: string }).code;
      if (code === 'ERR_NETWORK' || code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        message = `Cannot reach the API. Start the backend: cd backend && npm run start:dev`;
      }
    }
    const data = error.response?.data as any;
    if (data) {
      if (typeof data === 'string' && data.length < 300) message = data;
      else if (data?.message) message = Array.isArray(data.message) ? data.message[0] : String(data.message);
      else if (data?.error) message = String(data.error);
    }
    (error as any).userMessage = message;

    return Promise.reject(error);
  },
);

export default api;
