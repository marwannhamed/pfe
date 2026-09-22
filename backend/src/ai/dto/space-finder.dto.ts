import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SpaceFinderMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsString()
  // Only these two. A caller that could set role:"system" would be writing the
  // instructions the model runs under, on an endpoint that needs no account.
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  // Long enough for a real enquiry, short enough that nobody pastes a book
  // into an unauthenticated endpoint that costs money per token.
  @MaxLength(1500)
  content: string;
}

export class SpaceFinderDto {
  @ApiProperty({ type: [SpaceFinderMessageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SpaceFinderMessageDto)
  messages: SpaceFinderMessageDto[];
}
