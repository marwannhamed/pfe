import { NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const userWith = (role: string, id = 'user-1'): AuthUser => ({
  id,
  tenant_id: 'tenant-a',
  role,
  email: `${id}@test.local`,
});

const employee = userWith(USER_ROLE.TENANT_EMPLOYEE, 'user-1');
const platformOwner = userWith(USER_ROLE.SUPER_ADMIN, 'owner');

function makePrisma() {
  return {
    notification: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('NotificationService — per-user scoping', () => {
  it('pins a list to the caller even when another id is requested', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(prisma as any);

    // Asking for someone else's notifications must not widen the scope.
    await service.findAll(employee, 'someone-else');

    expect(prisma.notification.findMany.mock.calls[0][0].where).toMatchObject({
      user_id: 'user-1',
    });
  });

  it('lets the platform owner read across users', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(prisma as any);

    await service.findAll(platformOwner);
    expect(
      prisma.notification.findMany.mock.calls[0][0].where,
    ).not.toHaveProperty('user_id');

    await service.findAll(platformOwner, 'user-9');
    expect(prisma.notification.findMany.mock.calls[1][0].where).toMatchObject({
      user_id: 'user-9',
    });
  });

  it("reads someone else's notification as not found", async () => {
    const prisma = makePrisma();
    prisma.notification.findFirst.mockResolvedValue(null);
    const service = new NotificationService(prisma as any);

    await expect(service.findOne(employee, 'notif-of-another')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.notification.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'notif-of-another',
      user_id: 'user-1',
    });
  });

  it('refuses to mark another user’s notification as read', async () => {
    const prisma = makePrisma();
    prisma.notification.findFirst.mockResolvedValue(null);
    const service = new NotificationService(prisma as any);

    await expect(service.markAsRead(employee, 'notif-x')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('refuses to delete another user’s notification', async () => {
    const prisma = makePrisma();
    prisma.notification.findFirst.mockResolvedValue(null);
    const service = new NotificationService(prisma as any);

    await expect(service.remove(employee, 'notif-x')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.notification.delete).not.toHaveBeenCalled();
  });

  it('confines mark-all-as-read to the caller', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(prisma as any);

    await service.markAllAsRead(employee, 'someone-else');

    expect(prisma.notification.updateMany.mock.calls[0][0].where).toMatchObject(
      {
        user_id: 'user-1',
        is_read: false,
      },
    );
  });

  it('confines the unread count to the caller', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(prisma as any);

    await service.getUnreadCount(employee, 'someone-else');

    expect(prisma.notification.count.mock.calls[0][0].where).toMatchObject({
      user_id: 'user-1',
      is_read: false,
    });
  });
});
