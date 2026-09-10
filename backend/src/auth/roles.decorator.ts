import { SetMetadata } from '@nestjs/common';
import { USER_ROLE } from '../constants/enums';

type UserRoleValue = typeof USER_ROLE[keyof typeof USER_ROLE];

export const Roles = (...roles: UserRoleValue[]) => SetMetadata('roles', roles);