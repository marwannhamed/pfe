import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<
    string,
    { data: any; timestamp: number; ttl: number }
  >();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = this.generateCacheKey(request);
    const cached = this.cache.get(cacheKey);

    // Check cache
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return new Observable((observer) => {
        observer.next(cached.data);
        observer.complete();
      });
    }

    return next.handle().pipe(
      map((data) => {
        // Cache the response
        const ttl = this.getTTL(request);
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          ttl,
        });
        return data;
      }),
    );
  }

  private generateCacheKey(request: any): string {
    return `${request.method}:${request.url}:${JSON.stringify(request.query)}`;
  }

  private getTTL(request: any): number {
    // Different TTL for different endpoints
    if (request.url.includes('/analytics')) return 300000; // 5 minutes
    if (request.url.includes('/stats')) return 60000; // 1 minute
    return 300000; // 5 minutes default
  }
}
