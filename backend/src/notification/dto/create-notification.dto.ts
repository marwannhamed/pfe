import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPE,
} from '../../constants/enums';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ example: 'uuid-du-tenant' })
  @IsUUID()
  tenant_id: string;          // ← added

  @ApiProperty({ example: 'uuid-du-user' })
  @IsUUID()
  @IsOptional()
  user_id?: string;           // ← made optional (notifications can be tenant-wide)

  @ApiProperty({ example: 'BOOKING_CONFIRMATION' })
  @IsString()
  type: string;

  @ApiProperty({ example: 'IN_APP' })
  @IsString()
  channel: string;

  @ApiProperty({ example: 'Réservation confirmée' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Votre réservation BK-2026-001 a été confirmée.' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ example: 'NORMAL' })
  @IsString()
  @IsOptional()
  priority?: string;
}