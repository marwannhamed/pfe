import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsUUID, Min } from 'class-validator';

export class CreateBookingAddonDto {
  @ApiProperty({ example: 'uuid-du-addon-service' })
  @IsUUID()
  addon_service_id: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 50.0 })
  @IsNumber()
  @Min(0)
  unit_price: number;
}
