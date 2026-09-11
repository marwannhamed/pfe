import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['tenant_id', 'password'] as const),
) {
  @ApiPropertyOptional({
    description: 'Crisp session id for support correlation',
  })
  @IsOptional()
  @IsString()
  crisp_session_id?: string | null;
}
