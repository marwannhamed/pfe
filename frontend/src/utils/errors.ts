import type { ApiError } from '../types';

/**
 * Pull a human-readable message out of a failed request. The server sends
 * ResponseDto (message may be a string or an array of validation errors), the
 * axios interceptor attaches userMessage, and everything else falls back to
 * the Error's own message. Callers used to type the caught value `any` purely
 * to reach these three places.
 */
export function errorMessage(e: unknown, fallback: string): string {
  const err = e as ApiError | undefined;
  const fromResponse = asApiError(err).response?.data?.message;
  const picked =
    (Array.isArray(fromResponse) ? fromResponse[0] : fromResponse) ??
    err?.userMessage ??
    err?.message;
  return picked || fallback;
}

/** The same value, narrowed, when a caller needs more than the message. */
export function asApiError(e: unknown): ApiError {
  return (e ?? {}) as ApiError;
}
