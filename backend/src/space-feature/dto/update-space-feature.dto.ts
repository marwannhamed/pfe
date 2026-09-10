import { PartialType } from '@nestjs/swagger';
import { CreateSpaceFeatureDto } from './create-space-feature.dto';

export class UpdateSpaceFeatureDto extends PartialType(CreateSpaceFeatureDto) {}
