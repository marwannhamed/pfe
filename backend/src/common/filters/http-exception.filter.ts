import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { LoggingService } from '../../logging/logging.service';

export interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  details?: any;
  correlationId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly loggingService: LoggingService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = this.generateCorrelationId();
    const timestamp = new Date().toISOString();

    let status: HttpStatus;
    let message: string | string[];
    let error: string;
    let details: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || responseObj.error || 'Unknown error';
        details = responseObj.details || null;
      }

      error = exception.constructor.name;
    } else if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      (exception as Error)?.name === 'PrismaClientInitializationError'
    ) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message =
        'Database is not available. Start Docker Desktop, then run: docker compose up -d postgres (in the backend folder).';
      error = 'ServiceUnavailable';
      details = null;
      this.loggingService.error(`Database unavailable: ${(exception as Error).message}`, 'DB_UNAVAILABLE');
    } else {
      // Handle unexpected errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'InternalServerError';
      details = null;

      // Log unexpected errors with full stack trace
      this.loggingService.error(
        `Unexpected error: ${exception}`,
        'UNEXPECTED_ERROR',
        {
          exception: (exception as Error).stack,
          timestamp: new Date().toISOString(),
        },
      );
    }

    const errorResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      message,
      error,
      timestamp,
      path: request.url,
      correlationId,
      ...(details && { details }),
    };

    // Log the error
    this.logError(errorResponse, request, exception);

    // Send the response
    response.status(status).json(errorResponse);
  }

  private generateCorrelationId(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  private logError(
    errorResponse: ErrorResponse,
    request: Request,
    exception: unknown,
  ): void {
    const logData = {
      correlationId: errorResponse.correlationId,
      statusCode: errorResponse.statusCode,
      error: errorResponse.error,
      message: errorResponse.message,
      path: errorResponse.path,
      method: request.method,
      ip: request.ip,
      userAgent: request.get('User-Agent'),
      userId: (request as any).user?.id || 'anonymous',
    };

    if (errorResponse.statusCode >= 500) {
      this.loggingService.error(
        `Server Error: ${JSON.stringify(logData)}`,
        'HTTP_EXCEPTION',
        {
          exception: (exception as Error).stack,
          ...logData,
        },
      );
    } else if (errorResponse.statusCode >= 400) {
      this.loggingService.warn(
        `Client Error: ${JSON.stringify(logData)}`,
        'HTTP_EXCEPTION',
        logData,
      );
    }
  }
}
