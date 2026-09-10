import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateMaintenanceTicketDto } from './create-maintenance-ticket.dto';

export class UpdateMaintenanceTicketDto extends PartialType(
  OmitType(CreateMaintenanceTicketDto, [
    'space_id',
    'user_id',
  ] as const),
) {}
