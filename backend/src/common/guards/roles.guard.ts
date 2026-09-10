import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { USER_ROLE, normalizeUserRole } from '../../constants/enums';

type RoleValue = (typeof USER_ROLE)[keyof typeof USER_ROLE];

const ROLES_KEY = 'roles';

/**
 * Runs **after** `JwtAuthGuard` so `request.user` is populated.
 * If a handler has no `@Roles()`, access is allowed (JWT-only).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleValue[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!user?.role) throw new ForbiddenException('Not authenticated');

    const userRole = normalizeUserRole(user.role);
    const allowed = required.map((r) => normalizeUserRole(r));
    if (!allowed.includes(userRole as RoleValue)) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }
    return true;
  }
}
