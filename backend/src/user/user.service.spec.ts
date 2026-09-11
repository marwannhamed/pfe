import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const actor = (
  role: string,
  tenantId = 'tenant-a',
  id = `actor-${role}`,
): AuthUser => ({
  id,
  tenant_id: tenantId,
  role,
  email: `${role}@${tenantId}.test`,
});

/** A full row as Prisma returns it — credentials included. */
const row = (over: Record<string, unknown> = {}) => ({
  id: 'target-1',
  tenant_id: 'tenant-a',
  role: USER_ROLE.FINANCE,
  email: 'target@tenant-a.test',
  first_name: 'T',
  password: '$2b$10$hashedsecret',
  refreshToken: 'refresh-token-value',
  session_refresh_token: 'session-token-value',
  ...over,
});

function makeService(target: Record<string, unknown> | null = row()) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(target),
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({}),
      update: jest.fn(),
    },
  };
  const service = new UserService(prisma as any, {} as any, {} as any);
  return { prisma, service };
}

describe('UserService.findOneForUser — credentials never leave', () => {
  it('strips the password and both refresh tokens', async () => {
    const { service } = makeService();

    const result: any = await service.findOneForUser(
      actor(USER_ROLE.CLIENT_ADMIN),
      'target-1',
    );

    // The raw row was returned verbatim before, so a single GET /users/:id
    // handed over a bcrypt hash and the token that mints access tokens.
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('refreshToken');
    expect(result).not.toHaveProperty('session_refresh_token');
    expect(result.email).toBe('target@tenant-a.test');
  });

  it('lets a user read their own record', async () => {
    const { service } = makeService(row({ id: 'self' }));

    await expect(
      service.findOneForUser(
        actor(USER_ROLE.TENANT_EMPLOYEE, 'tenant-z', 'self'),
        'self',
      ),
    ).resolves.toMatchObject({ id: 'self' });
  });

  it('refuses a client admin from another organisation', async () => {
    const { service } = makeService();

    await expect(
      service.findOneForUser(
        actor(USER_ROLE.CLIENT_ADMIN, 'tenant-b'),
        'target-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('limits a manager to the staff roles it supervises', async () => {
    const { service } = makeService(row({ role: USER_ROLE.CLIENT_ADMIN }));

    await expect(
      service.findOneForUser(actor(USER_ROLE.MANAGER), 'target-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('limits a tenant admin to employees', async () => {
    const { service } = makeService(row({ role: USER_ROLE.MANAGER }));

    await expect(
      service.findOneForUser(actor(USER_ROLE.TENANT_ADMIN), 'target-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets the platform owner read anyone', async () => {
    const { service } = makeService(row({ tenant_id: 'tenant-x' }));

    await expect(
      service.findOneForUser(
        actor(USER_ROLE.SUPER_ADMIN, 'platform'),
        'target-1',
      ),
    ).resolves.toMatchObject({ id: 'target-1' });
  });
});

describe('UserService.removeForUser — deletion is bounded', () => {
  it('refuses to delete an account in another organisation', async () => {
    const { prisma, service } = makeService();

    await expect(
      service.removeForUser(
        actor(USER_ROLE.CLIENT_ADMIN, 'tenant-b'),
        'target-1',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete the platform owner', async () => {
    const { prisma, service } = makeService(
      row({ role: USER_ROLE.SUPER_ADMIN }),
    );

    await expect(
      service.removeForUser(actor(USER_ROLE.CLIENT_ADMIN), 'target-1'),
    ).rejects.toThrow(/platform administrator/i);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('refuses self-deletion', async () => {
    const { prisma, service } = makeService(row({ id: 'self' }));

    await expect(
      service.removeForUser(
        actor(USER_ROLE.CLIENT_ADMIN, 'tenant-a', 'self'),
        'self',
      ),
    ).rejects.toThrow(/your own account/i);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('refuses a tenant admin deleting a manager', async () => {
    const { prisma, service } = makeService(row({ role: USER_ROLE.MANAGER }));

    await expect(
      service.removeForUser(actor(USER_ROLE.TENANT_ADMIN), 'target-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('allows a client admin to delete staff in their own organisation', async () => {
    const { prisma, service } = makeService();

    await service.removeForUser(actor(USER_ROLE.CLIENT_ADMIN), 'target-1');
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'target-1' },
    });
  });

  it('reports a missing user as not found', async () => {
    const { service } = makeService(null);

    await expect(
      service.removeForUser(actor(USER_ROLE.SUPER_ADMIN, 'platform'), 'nope'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('UserService.findAllForUser — listing is scoped', () => {
  it('pins a client admin to their organisation', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(actor(USER_ROLE.CLIENT_ADMIN, 'tenant-a'));

    expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({
      tenant_id: 'tenant-a',
    });
  });

  it('refuses a role with no listing rights', async () => {
    const { service } = makeService();

    await expect(
      service.findAllForUser(actor(USER_ROLE.TENANT_EMPLOYEE)),
    ).rejects.toThrow(ForbiddenException);
  });
});
