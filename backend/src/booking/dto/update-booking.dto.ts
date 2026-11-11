import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateBookingDto } from './create-booking.dto';

// status is left out on purpose: a booking changes state only through its
// dedicated routes (approve, reject, cancel, check-in, phone-confirmed,
// finalize…), each of which checks the role and the current state. Accepting
// it here let any booking role — a renter included — set any status directly.
export class UpdateBookingDto extends PartialType(
  OmitType(CreateBookingDto, [
    'tenant_id',
    'space_id',
    'created_by_user_id',
    'status',
  ] as const),
) {}
