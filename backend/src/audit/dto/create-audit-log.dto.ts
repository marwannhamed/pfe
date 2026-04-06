import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction, AuditSeverity } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAuditLogDto {
  @ApiProperty({ example: 'uuid-du-tenant' })
  @IsUUID()
  tenant_id: string;

  @ApiPropertyOptional({ example: 'uuid-du-user' })
  @IsUUID()
  @IsOptional()
  user_id?: string;

  @ApiProperty({ enum: AuditAction })
  @IsEnum(AuditAction)
  action: AuditAction;

  @ApiProperty({ example: 'Booking' })
  @IsString()
  resource_type: string;

  @ApiProperty({ example: 'uuid-de-la-ressource' })
  @IsUUID()
  resource_id: string;

  @ApiPropertyOptional({ example: { status: 'DRAFT' } })
  @IsOptional()
  old_values?: Record<string, any>;

  @ApiPropertyOptional({ example: { status: 'CONFIRMED' } })
  @IsOptional()
  new_values?: Record<string, any>;

  @ApiPropertyOptional({ example: '192.168.1.1' })
  @IsString()
  @IsOptional()
  ip_address?: string;

  @ApiPropertyOptional({ enum: AuditSeverity, default: AuditSeverity.INFO })
  @IsEnum(AuditSeverity)
  @IsOptional()
  severity?: AuditSeverity;
}
