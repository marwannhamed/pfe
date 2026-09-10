import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateMaintenanceTicketDto {
  @ApiProperty({ example: 'uuid-du-space' })
  @IsUUID()
  space_id: string;

  @ApiPropertyOptional({ example: 'uuid-du-user' })
  @IsUUID()
  @IsOptional()
  user_id?: string;

  @ApiPropertyOptional({
    description: 'Alias for user_id (portal sends this as the reporter)',
  })
  @IsUUID()
  @IsOptional()
  created_by_user_id?: string;

  @ApiProperty({ example: "Fuite d'eau dans les sanitaires" })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'PLUMBING' })
  @IsString()
  category: string;

  @ApiPropertyOptional({ example: 'NORMAL' })
  @IsString()
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional({ example: 'OPEN' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'uuid-du-technicien' })
  @IsUUID()
  @IsOptional()
  assigned_to?: string;

  @ApiPropertyOptional({ example: 3.5 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  estimated_hours?: number;

  @ApiPropertyOptional({ example: 250.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  cost?: number;

  @ApiPropertyOptional({ description: 'Crisp session id for support traceability' })
  @IsString()
  @IsOptional()
  crisp_session_id?: string;
}
