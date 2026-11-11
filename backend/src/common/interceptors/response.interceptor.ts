import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface ApiResponse<T = any> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
  correlationId?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Columns of a user row that must never leave the server. */
const USER_SECRET_FIELDS = [
  'password',
  'refreshToken',
  'session_refresh_token',
] as const;

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/**
 * Services include related users with `user: true`, `assignee: true` and the
 * like, which returns the whole row — password hash and refresh tokens
 * included. GET /maintenance alone handed every caller, renters included,
 * the hash and tokens of every reporter and technician. Rather than trust
 * each include, any object shaped like a user row (it has both `email` and
 * `password`) is copied without those columns on the way out.
 *
 * Copies instead of mutating, so cached service results are left intact. An
 * object reached twice (shared or circular) maps to the same copy.
 */
export function stripUserSecrets<V>(
  value: V,
  copies = new WeakMap<object, unknown>(),
): V {
  if (Array.isArray(value)) {
    return value.map((item) => stripUserSecrets(item, copies)) as V;
  }
  if (!isPlainObject(value)) return value;
  const existing = copies.get(value);
  if (existing) return existing as V;
  const out: Record<string, unknown> = {};
  copies.set(value, out);
  const isUserRow = 'email' in value && 'password' in value;
  for (const [key, child] of Object.entries(value)) {
    if (isUserRow && (USER_SECRET_FIELDS as readonly string[]).includes(key))
      continue;
    out[key] = stripUserSecrets(child, copies);
  }
  return out as V;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const correlationId = this.generateCorrelationId();

    return next.handle().pipe(
      map((data) => {
        // Handle different response formats
        let responseData = data;
        let message = 'Request completed successfully';
        let pagination = undefined;

        // Only unwrap explicit API envelopes (avoid entities with a `data` field, e.g. Notification)
        const isApiEnvelope =
          data &&
          typeof data === 'object' &&
          !Array.isArray(data) &&
          'success' in data &&
          'data' in data;

        if (isApiEnvelope) {
          responseData = data.data;
          message = data.message || message;
          pagination = data.pagination;
        }
        // Handle paginated responses
        else if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          'pagination' in data
        ) {
          responseData = data.data;
          pagination = data.pagination;
        }
        // Handle array responses with pagination info
        else if (
          Array.isArray(data) &&
          data.length > 0 &&
          'pagination' in data[0]
        ) {
          pagination = data[0].pagination;
          responseData = data.map((item) => {
            const { pagination, ...itemData } = item;
            return itemData;
          });
        }

        const response: ApiResponse<T> = {
          success: true,
          statusCode: context.switchToHttp().getResponse().statusCode,
          message,
          data: stripUserSecrets(responseData),
          timestamp: new Date().toISOString(),
          path: request.url,
          correlationId,
          ...(pagination && { pagination }),
        };

        return response;
      }),
    );
  }

  private generateCorrelationId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
