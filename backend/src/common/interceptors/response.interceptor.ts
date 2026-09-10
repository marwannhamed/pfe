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

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
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
        else if (data && typeof data === 'object' && 'data' in data && 'pagination' in data) {
          responseData = data.data;
          pagination = data.pagination;
        }
        // Handle array responses with pagination info
        else if (Array.isArray(data) && data.length > 0 && 'pagination' in data[0]) {
          pagination = data[0].pagination;
          responseData = data.map(item => {
            const { pagination, ...itemData } = item;
            return itemData;
          });
        }

        const response: ApiResponse<T> = {
          success: true,
          statusCode: context.switchToHttp().getResponse().statusCode,
          message,
          data: responseData,
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
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }
}
