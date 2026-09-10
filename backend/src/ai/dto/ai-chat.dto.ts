import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant', 'system'] })
  @IsIn(['user', 'assistant', 'system'])
  role: 'user' | 'assistant' | 'system';

  @ApiProperty()
  @IsString()
  content: string;
}

export class LeaseAssistantDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
}

export class TenantAssistantDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
}

export class MaintenanceSuggestDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
