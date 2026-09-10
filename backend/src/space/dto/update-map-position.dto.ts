import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateMapPositionDto {
  @IsNumber()
  map_x: number;

  @IsNumber()
  map_y: number;

  @IsOptional()
  @IsNumber()
  @Min(60)
  map_w?: number;

  @IsOptional()
  @IsNumber()
  @Min(40)
  map_h?: number;
}