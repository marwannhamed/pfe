import { PartialType } from '@nestjs/swagger';
import { CreatePricePlanDto } from './create-price-plan.dto';

export class UpdatePricePlanDto extends PartialType(CreatePricePlanDto) {}
