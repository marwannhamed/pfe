import { HttpException, HttpStatus } from '@nestjs/common';

export interface BusinessErrorDetails {
  field?: string;
  value?: any;
  constraint?: string;
  code?: string;
  resource?: string;
  identifier?: string;
}

export class BusinessException extends HttpException {
  public readonly details: BusinessErrorDetails[];

  constructor(
    message: string | string[],
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: BusinessErrorDetails[],
  ) {
    super(
      {
        success: false,
        statusCode,
        message,
        error: 'BusinessError',
        details,
      },
      statusCode,
    );

    this.details = details || [];
  }

  static withDetails(
    message: string,
    details: BusinessErrorDetails[],
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ): BusinessException {
    return new BusinessException(message, statusCode, details);
  }

  static notFound(resource: string, identifier?: string): BusinessException {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;

    const details: BusinessErrorDetails[] = [
      {
        code: 'NOT_FOUND',
        ...(resource && { resource }),
        ...(identifier && { identifier }),
      },
    ];

    return new BusinessException(message, HttpStatus.NOT_FOUND, details);
  }

  static validationFailed(
    message: string,
    field?: string,
    value?: any,
  ): BusinessException {
    const details: BusinessErrorDetails[] = [
      {
        code: 'VALIDATION_FAILED',
        ...(field && { field }),
        ...(value && { value }),
      },
    ];

    return new BusinessException(message, HttpStatus.BAD_REQUEST, details);
  }

  static conflict(
    message: string,
    details?: BusinessErrorDetails[],
  ): BusinessException {
    return new BusinessException(message, HttpStatus.CONFLICT, details);
  }

  static unauthorized(
    message: string = 'Unauthorized access',
  ): BusinessException {
    return new BusinessException(message, HttpStatus.UNAUTHORIZED, [
      { code: 'UNAUTHORIZED' },
    ]);
  }

  static forbidden(message: string = 'Forbidden access'): BusinessException {
    return new BusinessException(message, HttpStatus.FORBIDDEN, [
      { code: 'FORBIDDEN' },
    ]);
  }

  static paymentRequired(
    message: string = 'Payment required',
  ): BusinessException {
    return new BusinessException(message, HttpStatus.PAYMENT_REQUIRED, [
      { code: 'PAYMENT_REQUIRED' },
    ]);
  }

  static tooManyRequests(
    message: string = 'Too many requests',
    retryAfter?: number,
  ): BusinessException {
    const details: BusinessErrorDetails[] = [{ code: 'TOO_MANY_REQUESTS' }];
    if (retryAfter) {
      details.push({ field: 'retryAfter', value: retryAfter });
    }

    return new BusinessException(
      message,
      HttpStatus.TOO_MANY_REQUESTS,
      details,
    );
  }
}
