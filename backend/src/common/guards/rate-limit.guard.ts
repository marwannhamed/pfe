import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const limit = this.reflector.get<number>('rate_limit', context.getHandler()) || 100;
    const windowMs = this.reflector.get<number>('rate_limit_window', context.getHandler()) || 60000; // 1 minute

    const request = context.switchToHttp().getRequest();
    const clientId = request.ip || request.headers['x-forwarded-for'] || request.connection.remoteAddress;
    
    // In production, use Redis for distributed rate limiting
    // For now, using in-memory storage
    if (!global.rateLimitStore) {
      global.rateLimitStore = new Map();
    }

    const now = Date.now();
    const key = `${clientId}:${context.getHandler().name}`;
    const requests = global.rateLimitStore.get(key) || [];

    // Remove expired requests
    const validRequests = requests.filter((timestamp: number) => now - timestamp < windowMs);

    if (validRequests.length >= limit) {
      throw new HttpException(
        `Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    validRequests.push(now);
    global.rateLimitStore.set(key, validRequests);

    return true;
  }
}

// Extend global type
declare global {
  var rateLimitStore: Map<string, number[]> | undefined;
}
