import type { Request } from 'express';

export type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

/** Best-effort client IP (works on localhost as ::1 / 127.0.0.1). */
export function getRequestMeta(req: Request): RequestMeta {
  const forwarded = req.headers['x-forwarded-for'];
  const ipFromForwarded =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0]?.trim()
      : Array.isArray(forwarded)
        ? forwarded[0]
        : undefined;

  const ipAddress =
    ipFromForwarded ||
    (typeof req.ip === 'string' ? req.ip : undefined) ||
    req.socket?.remoteAddress ||
    undefined;

  const userAgent =
    typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent']
      : undefined;

  return { ipAddress, userAgent };
}
