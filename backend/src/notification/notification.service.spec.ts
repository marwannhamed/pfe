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

/** Socket delivery is verified in its own tests; here it only needs to exist. */
const gatewayStub = {
  sendToUser: jest.fn(),
  sendToTenant: jest.fn(),
};

function makePrisma() {
  return {
    notification: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
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
    const service = new NotificationService(
      prisma as any,
      gatewayStub as never,
    );

    // Asking for someone else's notifications must not widen the scope.
    await service.findAll(employee, 'someone-else');

    expect(prisma.notification.findMany.mock.calls[0][0].where).toMatchObject({
      user_id: 'user-1',
    });
  });

  it('lets the platform owner read across users', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      prisma as any,
      gatewayStub as never,
    );

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
    const service = new NotificationService(
      prisma as any,
      gatewayStub as never,
    );

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
    const service = new NotificationService(
      prisma as any,
      gatewayStub as never,
    );

    await expect(service.markAsRead(employee, 'notif-x')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('refuses to delete another user’s notification', async () => {
    const prisma = makePrisma();
    prisma.notification.findFirst.mockResolvedValue(null);
    const service = new NotificationService(
      prisma as any,
      gatewayStub as never,
    );

    await expect(service.remove(employee, 'notif-x')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.notification.delete).not.toHaveBeenCalled();
  });

  it('confines mark-all-as-read to the caller', async () => {
    const prisma = makePrisma();
    const service = new NotificationService(
      prisma as any,
      gatewayStub as never,
    );

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
    const service = new NotificationService(
      prisma as any,
      gatewayStub as never,
    );

    await service.getUnreadCount(employee, 'someone-else');

    expect(prisma.notification.count.mock.calls[0][0].where).toMatchObject({
      user_id: 'user-1',
      is_read: false,
    });
  });
});

describe('NotificationService — a new notification is pushed, not just stored', () => {
  // The gateway exposed sendToUser/sendToTenant but nothing called them, so
  // clients only ever saw a notification on their next 30s poll.
  function make() {
    const prisma = makePrisma();
    const gateway = { sendToUser: jest.fn(), sendToTenant: jest.fn() };
    return {
      prisma,
      gateway,
      service: new NotificationService(prisma as never, gateway as never),
    };
  }

  it('pushes to the recipient when the notification names a user', async () => {
    const { prisma, gateway, service } = make();
    prisma.notification.create.mockResolvedValue({
      id: 'n1',
      user_id: 'user-9',
      tenant_id: 'tenant-a',
      title: 'Invoice overdue',
    });

    await service.create({
      user_id: 'user-9',
      tenant_id: 'tenant-a',
      type: 'INVOICE_OVERDUE',
      title: 'Invoice overdue',
      message: 'Please settle.',
    } as never);

    expect(gateway.sendToUser).toHaveBeenCalledWith(
      'user-9',
      expect.objectContaining({ id: 'n1' }),
    );
    expect(gateway.sendToTenant).not.toHaveBeenCalled();
  });

  it('falls back to the organisation when no user is named', async () => {
    const { prisma, gateway, service } = make();
    prisma.notification.create.mockResolvedValue({
      id: 'n2',
      user_id: null,
      tenant_id: 'tenant-a',
      title: 'Building notice',
    });

    await service.create({
      tenant_id: 'tenant-a',
      type: 'SYSTEM',
      title: 'Building notice',
      message: 'Lift maintenance Friday.',
    } as never);

    expect(gateway.sendToTenant).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({ id: 'n2' }),
    );
    expect(gateway.sendToUser).not.toHaveBeenCalled();
  });

  it('still returns the saved row when the socket throws', async () => {
    // Delivery is best-effort — a websocket problem must not fail a write
    // that already succeeded.
    const { prisma, gateway, service } = make();
    prisma.notification.create.mockResolvedValue({
      id: 'n3',
      user_id: 'user-9',
      tenant_id: 'tenant-a',
    });
    gateway.sendToUser.mockImplementation(() => {
      throw new Error('no clients connected');
    });

    await expect(
      service.create({
        user_id: 'user-9',
        tenant_id: 'tenant-a',
        type: 'SYSTEM',
        title: 'x',
        message: 'y',
      } as never),
    ).resolves.toMatchObject({ id: 'n3' });
  });
});
