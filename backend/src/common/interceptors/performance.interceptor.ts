import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PerformanceService } from '../../performance/performance.service';
import { LoggingService } from '../../logging/logging.service';
import { Request } from 'express';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(
    private readonly performanceService: PerformanceService,
    private readonly loggingService: LoggingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent');
    const userId = (request as any).user?.id || 'anonymous';

    const operation = `${method} ${url}`;
    const metadata = {
      method,
      url,
      ip,
      userAgent,
      userId,
      timestamp: new Date().toISOString(),
    };

    const startHrTime = process.hrtime.bigint();

    return next.handle().pipe(
      tap(() => {
        const endHrTime = process.hrtime.bigint();
        const duration = Number(endHrTime - startHrTime) / 1000000; // Convert to milliseconds

        this.performanceService.recordMetric({
          operation,
          duration,
          timestamp: new Date().toISOString(),
          metadata,
        });

        // Log slow operations
        if (duration > 1000) {
          // 1 second threshold
          this.loggingService.warn(
            `Slow API call: ${operation} took ${duration.toFixed(2)}ms`,
            'PERFORMANCE',
            { operation, duration, metadata },
          );
        }
      }),
      catchError((error) => {
        const endHrTime = process.hrtime.bigint();
        const duration = Number(endHrTime - startHrTime) / 1000000;

        this.performanceService.recordMetric({
          operation,
          duration,
          timestamp: new Date().toISOString(),
          metadata: { ...metadata, error: error.message },
        });

        throw error;
      }),
    );
  }
}
