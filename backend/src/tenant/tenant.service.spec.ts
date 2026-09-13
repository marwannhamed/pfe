import { ForbiddenException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const userWith = (role: string, tenantId = 'tenant-a'): AuthUser => ({
  id: `user-${role}`,
  tenant_id: tenantId,
  role,
  email: `${role}@test.local`,
});

function makeService() {
  const prisma = {
    tenant: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve({ id: where.id, name: 'Org' }),
        ),
    },
  };
  const mail = {};
  return { prisma, service: new TenantService(prisma as any, mail as any) };
}

describe('TenantService.findOneForUser — one organisation per caller', () => {
  // The controller's @Roles omitted CLIENT_ADMIN, so a property manager was
  // 403'd opening their own company's reporting page.
  it('lets a client admin read their own organisation', async () => {
    const { service } = makeService();

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.CLIENT_ADMIN, 'tenant-a'),
        'tenant-a',
      ),
    ).resolves.toMatchObject({ id: 'tenant-a' });
  });

  it.each([
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.TENANT_EMPLOYEE,
    // FINANCE was absent from the old allow-list, so it read every tenant.
    USER_ROLE.FINANCE,
  ])('refuses %s another organisation', async (role) => {
    const { service } = makeService();

    await expect(
      service.findOneForUser(userWith(role, 'tenant-a'), 'tenant-b'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets the platform owner read any organisation', async () => {
    const { service } = makeService();

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.SUPER_ADMIN, 'platform'),
        'tenant-b',
      ),
    ).resolves.toMatchObject({ id: 'tenant-b' });
  });
});
