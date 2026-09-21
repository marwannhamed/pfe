import { MaintenanceTriageService } from './maintenance-triage.service';
import {
  TICKET_CATEGORY,
  TICKET_PRIORITY,
  USER_ROLE,
} from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const userWith = (role: string, tenantId = 'tenant-a'): AuthUser => ({
  id: `user-${role}`,
  tenant_id: tenantId,
  role,
  email: `${role}@test.local`,
});

function makeService(
  opts: {
    json?: unknown;
    configured?: boolean;
    technicians?: unknown[];
    resolved?: unknown[];
    open?: unknown[];
    similar?: unknown[];
  } = {},
) {
  const prisma = {
    user: { findMany: jest.fn().mockResolvedValue(opts.technicians ?? []) },
    maintenanceTicket: {
      groupBy: jest
        .fn()
        .mockResolvedValueOnce(opts.resolved ?? [])
        .mockResolvedValueOnce(opts.open ?? []),
      findMany: jest.fn().mockResolvedValue(opts.similar ?? []),
    },
  };
  const openAi = {
    isConfigured: jest.fn().mockReturnValue(opts.configured ?? true),
    chatJson: jest.fn().mockResolvedValue(opts.json ?? null),
  };
  return {
    prisma,
    openAi,
    service: new MaintenanceTriageService(prisma as never, openAi as never),
  };
}

describe('MaintenanceTriageService — the model is a suggestion, never the authority', () => {
  it('uses a well-formed model answer', async () => {
    const { service } = makeService({
      json: { category: 'HVAC', priority: 'URGENT', reason: 'no cooling' },
    });

    const r = await service.triage(userWith(USER_ROLE.TENANT_ADMIN), {
      title: 'AC dead',
    });

    expect(r.category).toBe(TICKET_CATEGORY.HVAC);
    expect(r.priority).toBe(TICKET_PRIORITY.URGENT);
    expect(r.source).toBe('model');
  });

  it('falls back to keywords when the model invents a category', async () => {
    // Only our own enum may reach the database.
    const { service } = makeService({
      json: { category: 'ROOFING', priority: 'URGENT', reason: 'tiles' },
    });

    const r = await service.triage(userWith(USER_ROLE.TENANT_ADMIN), {
      title: 'Water dripping from the ceiling tap',
    });

    expect(r.source).toBe('keywords');
    expect(r.category).toBe(TICKET_CATEGORY.PLUMBING);
  });

  it('falls back when the model invents a priority', async () => {
    const { service } = makeService({
      json: { category: 'HVAC', priority: 'CATASTROPHIC', reason: 'x' },
    });

    const r = await service.triage(userWith(USER_ROLE.TENANT_ADMIN), {
      title: 'Aircon broken',
    });

    expect(r.source).toBe('keywords');
    expect(r.category).toBe(TICKET_CATEGORY.HVAC);
  });

  it('falls back when the model is unreachable', async () => {
    const { service } = makeService({ json: null });

    const r = await service.triage(userWith(USER_ROLE.TENANT_ADMIN), {
      title: 'Socket sparking badly',
    });

    expect(r.source).toBe('keywords');
    expect(r.category).toBe(TICKET_CATEGORY.ELECTRICAL);
    expect(r.priority).toBe(TICKET_PRIORITY.URGENT);
  });

  it('never calls the model when no key is configured', async () => {
    const { openAi, service } = makeService({ configured: false });

    const r = await service.triage(userWith(USER_ROLE.TENANT_ADMIN), {
      title: 'Bins overflowing in the kitchen',
    });

    expect(openAi.chatJson).not.toHaveBeenCalled();
    expect(r.category).toBe(TICKET_CATEGORY.CLEANING);
  });

  it('raises priority on danger words and lowers it on "cosmetic"', async () => {
    const { service } = makeService({ configured: false });

    const danger = await service.triage(userWith(USER_ROLE.TENANT_ADMIN), {
      title: 'Flooding in the server room',
    });
    const minor = await service.triage(userWith(USER_ROLE.TENANT_ADMIN), {
      title: 'Cosmetic scratch on a desk, no rush',
    });

    expect(danger.priority).toBe(TICKET_PRIORITY.URGENT);
    expect(minor.priority).toBe(TICKET_PRIORITY.LOW);
  });
});

describe('MaintenanceTriageService — staffing data stays with the landlord', () => {
  const technicians = [
    { id: 'tech-1', first_name: 'Ana', last_name: 'Ruiz', email: 'a@x.test' },
    { id: 'tech-2', first_name: 'Ben', last_name: 'Ng', email: 'b@x.test' },
  ];

  it.each([USER_ROLE.TENANT_ADMIN, USER_ROLE.TENANT_EMPLOYEE])(
    'gives %s a classification but no technician and no ticket history',
    async (role) => {
      const { prisma, service } = makeService({
        json: { category: 'HVAC', priority: 'HIGH', reason: 'warm' },
        technicians,
      });

      const r = await service.triage(userWith(role), { title: 'AC warm' });

      expect(r.category).toBe(TICKET_CATEGORY.HVAC);
      expect(r.suggestedAssignee).toBeNull();
      expect(r.similar).toEqual([]);
      // the renter's request must not even query the landlord's staff
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.maintenanceTicket.findMany).not.toHaveBeenCalled();
    },
  );

  it.each([USER_ROLE.MANAGER, USER_ROLE.CLIENT_ADMIN])(
    'gives %s a suggested technician',
    async (role) => {
      const { service } = makeService({
        json: { category: 'HVAC', priority: 'HIGH', reason: 'warm' },
        technicians,
        resolved: [{ assigned_to: 'tech-2', _count: { id: 6 } }],
        open: [{ assigned_to: 'tech-2', _count: { id: 1 } }],
      });

      const r = await service.triage(userWith(role), { title: 'AC warm' });

      expect(r.suggestedAssignee?.id).toBe('tech-2');
      expect(r.suggestedAssignee?.name).toBe('Ben Ng');
      expect(r.suggestedAssignee?.resolvedInCategory).toBe(6);
    },
  );

  it('prefers the lighter workload when experience is equal', async () => {
    const { service } = makeService({
      json: { category: 'HVAC', priority: 'NORMAL', reason: 'x' },
      technicians,
      resolved: [
        { assigned_to: 'tech-1', _count: { id: 3 } },
        { assigned_to: 'tech-2', _count: { id: 3 } },
      ],
      open: [{ assigned_to: 'tech-1', _count: { id: 4 } }],
    });

    const r = await service.triage(userWith(USER_ROLE.MANAGER), {
      title: 'AC warm',
    });

    expect(r.suggestedAssignee?.id).toBe('tech-2');
  });

  it('prefers a specialist carrying a couple of tickets over a free generalist', async () => {
    // The weighting exists to make this call: two relevant fixes and two open
    // tickets beats never having done the work.
    const { service } = makeService({
      json: { category: 'ELECTRICAL', priority: 'NORMAL', reason: 'x' },
      technicians,
      resolved: [{ assigned_to: 'tech-1', _count: { id: 2 } }],
      open: [{ assigned_to: 'tech-1', _count: { id: 2 } }],
    });

    const r = await service.triage(userWith(USER_ROLE.MANAGER), {
      title: 'Socket dead',
    });

    expect(r.suggestedAssignee?.id).toBe('tech-1');
  });

  it('still passes over a specialist who is genuinely swamped', async () => {
    const { service } = makeService({
      json: { category: 'ELECTRICAL', priority: 'NORMAL', reason: 'x' },
      technicians,
      resolved: [{ assigned_to: 'tech-1', _count: { id: 2 } }],
      open: [{ assigned_to: 'tech-1', _count: { id: 9 } }],
    });

    const r = await service.triage(userWith(USER_ROLE.MANAGER), {
      title: 'Socket dead',
    });

    expect(r.suggestedAssignee?.id).toBe('tech-2');
  });

  it('still suggests someone when nobody has history in the category', async () => {
    const { service } = makeService({
      json: { category: 'FURNITURE', priority: 'LOW', reason: 'x' },
      technicians,
    });

    const r = await service.triage(userWith(USER_ROLE.MANAGER), {
      title: 'Wobbly chair',
    });

    expect(r.suggestedAssignee).not.toBeNull();
    expect(r.suggestedAssignee?.basis).toContain('No furniture history');
  });

  it('returns no technician when the company employs none', async () => {
    const { service } = makeService({
      json: { category: 'HVAC', priority: 'NORMAL', reason: 'x' },
      technicians: [],
    });

    const r = await service.triage(userWith(USER_ROLE.MANAGER), {
      title: 'AC warm',
    });

    expect(r.suggestedAssignee).toBeNull();
  });

  it('looks for technicians only inside the caller’s own organisation', async () => {
    const { prisma, service } = makeService({
      json: { category: 'HVAC', priority: 'NORMAL', reason: 'x' },
      technicians,
    });

    await service.triage(userWith(USER_ROLE.MANAGER, 'tenant-a'), {
      title: 'AC warm',
    });

    expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({
      tenant_id: 'tenant-a',
      role: USER_ROLE.MAINTENANCE,
    });
  });

  it('reaches past fixes through the building, not the ticket’s tenant_id', async () => {
    const { prisma, service } = makeService({
      json: { category: 'HVAC', priority: 'NORMAL', reason: 'x' },
      technicians,
    });

    await service.triage(userWith(USER_ROLE.MANAGER, 'tenant-a'), {
      title: 'AC warm',
    });

    expect(
      prisma.maintenanceTicket.findMany.mock.calls[0][0].where,
    ).toMatchObject({
      space: { floor: { building: { tenant_id: 'tenant-a' } } },
    });
  });

  it('leaves the platform owner unscoped', async () => {
    const { prisma, service } = makeService({
      json: { category: 'HVAC', priority: 'NORMAL', reason: 'x' },
      technicians,
    });

    await service.triage(userWith(USER_ROLE.SUPER_ADMIN, 'tenant-a'), {
      title: 'AC warm',
    });

    const where = prisma.maintenanceTicket.findMany.mock.calls[0][0].where;
    expect(where.space).toBeUndefined();
  });
});
