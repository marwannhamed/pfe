import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// ✅ Maintenant on passe des strings enum au lieu d'integers
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
