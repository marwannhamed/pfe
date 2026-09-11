import { ApiProperty } from '@nestjs/swagger';

export class CreateSpaceFeatureDto {
  @ApiProperty({
    description: 'ID of the space this feature belongs to',
    example: 'space-uuid-123',
  })
  space_id: string;

  @ApiProperty({
    description: 'Type of the feature',
    example: 'CONNECTIVITY',
    enum: [
      'CONNECTIVITY',
      'PARKING',
      'AMENITY',
      'EQUIPMENT',
      'SECURITY',
      'UTILITY',
      'OTHER',
    ],
  })
  feature_type: string;

  @ApiProperty({
    description: 'Name of the feature',
    example: 'High-Speed WiFi',
  })
  feature_name: string;

  @ApiProperty({
    description: 'Quantity of this feature',
    example: 1,
    default: 1,
  })
  quantity?: number;

  @ApiProperty({
    description: 'Whether the feature is currently available',
    example: true,
    default: true,
  })
  is_available?: boolean;
}
