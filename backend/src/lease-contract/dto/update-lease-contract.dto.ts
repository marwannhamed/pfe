import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateLeaseContractDto } from './create-lease-contract.dto';

export class UpdateLeaseContractDto extends PartialType(
  OmitType(CreateLeaseContractDto, [
    'tenant_id',
    'created_by_user_id',
  ] as const),
) {}
