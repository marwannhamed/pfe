import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateBookingDto } from './create-booking.dto';

export class UpdateBookingDto extends PartialType(
  OmitType(CreateBookingDto, [
    'tenant_id',
    'space_id',
    'created_by_user_id',
  ] as const),
) {}
