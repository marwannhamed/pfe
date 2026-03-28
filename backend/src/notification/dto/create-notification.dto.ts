import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@prisma/client';
import {
  IsEnum, IsOptional, IsString, IsUUID,
} from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ example: 'uuid-du-user' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ example: 'Réservation confirmée' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Votre réservation BK-2026-001 a été confirmée.' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ enum: NotificationPriority, default: NotificationPriority.NORMAL })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;
}