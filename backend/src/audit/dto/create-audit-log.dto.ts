import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAuditLogDto {
  @ApiProperty({ example: 'uuid-du-tenant' })
  @IsUUID()
  tenant_id: string;

  @ApiPropertyOptional({ example: 'uuid-du-user' })
  @IsUUID()
  @IsOptional()
  user_id?: string;

  @ApiProperty({ example: 'CREATE' })
  @IsString()
  action: string;

  @ApiProperty({ example: 'Booking' })
  @IsString()
  resource_type: string;

  @ApiProperty({ example: 'uuid-de-la-ressource' })
  @IsUUID()
  resource_id: string;

  @ApiPropertyOptional({ example: 'Booking' })
  @IsString()
  @IsOptional()
  entity_type?: string;

  @ApiPropertyOptional({ example: 'uuid-de-la-ressource' })
  @IsString()
  @IsOptional()
  entity_id?: string;

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

  @ApiPropertyOptional({ example: 'Mozilla/5.0...' })
  @IsString()
  @IsOptional()
  user_agent?: string;

  @ApiPropertyOptional({ example: 'INFO' })
  @IsString()
  @IsOptional()
  severity?: string;
}