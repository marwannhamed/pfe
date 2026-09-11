import { applyDecorators, SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';
export const RATE_LIMIT_WINDOW_KEY = 'rate_limit_window';

/**
 * This previously read `SetMetadata(A) && SetMetadata(B)`. Both calls return a
 * decorator function, so `&&` discarded the first and returned only the
 * second: the limit was never attached, RateLimitGuard read undefined and fell
 * back to its own default of 100. Every @RateLimit in the codebase was
 * therefore 100 per window regardless of the number written.
 */
export const RateLimit = (limit: number, windowMs = 60_000) =>
  applyDecorators(
    SetMetadata(RATE_LIMIT_KEY, limit),
    SetMetadata(RATE_LIMIT_WINDOW_KEY, windowMs),
  );
