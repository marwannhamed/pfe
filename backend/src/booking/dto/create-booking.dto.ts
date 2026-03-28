import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import {
  IsDateString, IsEnum, IsInt,
  IsNumber, IsOptional, IsString, IsUUID, Min,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: 'uuid-du-tenant' })
  @IsUUID()
  tenant_id: string;

  @ApiProperty({ example: 'uuid-du-space' })
  @IsUUID()
  space_id: string;

  @ApiProperty({ example: 'uuid-du-user' })
  @IsUUID()
  created_by_user_id: string;

  @ApiProperty({ example: '2026-03-10T08:00:00Z' })
  @IsDateString()
  start_datetime: string;

  @ApiProperty({ example: '2026-03-10T18:00:00Z' })
  @IsDateString()
  end_datetime: string;

  @ApiProperty({ example: 500.00 })
  @IsNumber()
  @Min(0)
  total_price: number;

  @ApiPropertyOptional({ example: 'TND' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsInt()
  @Min(1)
  @IsOptional()
  attendee_count?: number;

  @ApiPropertyOptional({ enum: BookingStatus, default: BookingStatus.DRAFT })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @ApiPropertyOptional({ example: 'uuid-du-price-plan' })
  @IsUUID()
  @IsOptional()
  price_plan_id?: string;

  @ApiPropertyOptional({ example: 'uuid-du-code-promo' })
  @IsUUID()
  @IsOptional()
  promotion_code_id?: string;

  @ApiPropertyOptional({ example: 'uuid-du-parent-booking' })
  @IsUUID()
  @IsOptional()
  parent_booking_id?: string;
}