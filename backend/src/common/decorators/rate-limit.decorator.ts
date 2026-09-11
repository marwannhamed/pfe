import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';
export const RATE_LIMIT_WINDOW_KEY = 'rate_limit_window';

export const RateLimit = (limit: number, windowMs?: number) => {
  return (
    SetMetadata(RATE_LIMIT_KEY, limit) &&
    SetMetadata(RATE_LIMIT_WINDOW_KEY, windowMs || 60000)
  );
};
