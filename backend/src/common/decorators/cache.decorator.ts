import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY = 'cache';
export const CACHE_TTL_KEY = 'cache_ttl';

export const Cache = (ttl?: number) => {
  return SetMetadata(CACHE_KEY, true) && 
         SetMetadata(CACHE_TTL_KEY, ttl || 300000); // 5 minutes default
};
