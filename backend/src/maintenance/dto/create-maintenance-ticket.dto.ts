import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import {
  IsEnum,
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

  @ApiProperty({ example: 'uuid-du-user' })
  @IsUUID()
  created_by_user_id: string;

  @ApiProperty({ example: "Fuite d'eau dans les sanitaires" })
  @IsString()
  title: string;

  @ApiProperty({ enum: TicketCategory })
  @IsEnum(TicketCategory)
  category: TicketCategory;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.NORMAL })
  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @ApiPropertyOptional({ enum: TicketStatus, default: TicketStatus.OPEN })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @ApiPropertyOptional({ example: 'uuid-du-technicien' })
  @IsUUID()
  @IsOptional()
  assigned_to_user_id?: string;

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
}
