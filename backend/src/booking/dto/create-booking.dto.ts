import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BOOKING_STATUS } from '../../constants/enums';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicationAddonDto } from '../../booking-application/dto/application-addon.dto';

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

  @ApiProperty({ example: 500.0 })
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

  @ApiPropertyOptional({ example: 'DRAFT' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'uuid-du-code-promo' })
  @IsUUID()
  @IsOptional()
  promotion_code_id?: string;

  @ApiPropertyOptional({ example: 'uuid-du-parent-booking' })
  @IsUUID()
  @IsOptional()
  parent_booking_id?: string;

  @ApiPropertyOptional({ type: [ApplicationAddonDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationAddonDto)
  addons?: ApplicationAddonDto[];
}
