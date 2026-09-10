import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class ApplicationAddonDto {
  @ApiProperty()
  @IsUUID()
  addon_service_id: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}
