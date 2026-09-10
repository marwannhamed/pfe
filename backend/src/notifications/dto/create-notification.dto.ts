import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';

export enum NotificationType {
  BOOKING = 'BOOKING',
  MAINTENANCE = 'MAINTENANCE',
  PAYMENT = 'PAYMENT',
  SYSTEM = 'SYSTEM',
  CONTRACT = 'CONTRACT',
  INVOICE = 'INVOICE',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsObject()
  data?: any;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  role?: string;
}
