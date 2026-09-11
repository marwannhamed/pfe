import { OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class InviteUserDto extends OmitType(CreateUserDto, [
  'password',
] as const) {
  @IsOptional()
  @IsBoolean()
  send_email?: boolean;
}
