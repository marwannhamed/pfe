import { ApiProperty } from '@nestjs/swagger';

export class ResponseDto<T = any> {
  @ApiProperty()
  message: string;

  @ApiProperty()
  data?: T;

  @ApiProperty()
  success: boolean;

  @ApiProperty()
  timestamp: string;

  @ApiProperty({ required: false })
  statusCode?: number;

  constructor(
    message: string,
    data?: T,
    success: boolean = true,
    statusCode?: number,
  ) {
    this.message = message;
    this.data = data;
    this.success = success;
    this.timestamp = new Date().toISOString();
    this.statusCode = statusCode;
  }

  static success<T>(message: string, data?: T): ResponseDto<T> {
    return new ResponseDto(message, data, true);
  }

  static error(message: string, statusCode?: number): ResponseDto {
    return new ResponseDto(message, null, false, statusCode);
  }

  static created<T>(message: string, data?: T): ResponseDto<T> {
    return new ResponseDto(message, data, true, 201);
  }

  static updated<T>(message: string, data?: T): ResponseDto<T> {
    return new ResponseDto(message, data, true, 200);
  }

  static deleted(message: string): ResponseDto {
    return new ResponseDto(message, null, true, 200);
  }
}

export class PaginatedResponseDto<T = any> extends ResponseDto<T[]> {
  @ApiProperty()
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };

  constructor(
    message: string,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    },
    success: boolean = true,
  ) {
    super(message, data, success);
    this.pagination = pagination;
  }

  static create<T>(
    message: string,
    data: T[],
    page: number,
    limit: number,
    total: number,
  ): PaginatedResponseDto<T> {
    const totalPages = Math.ceil(total / limit);
    return new PaginatedResponseDto(message, data, {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    });
  }
}

export class ValidationErrorDto extends ResponseDto {
  @ApiProperty()
  errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, null, false, 400);
    this.errors = errors;
  }

  static create(errors: Record<string, string[]>): ValidationErrorDto {
    return new ValidationErrorDto('Validation failed', errors);
  }
}
