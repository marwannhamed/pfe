import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PromotionCodeService } from './promotion-code.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const clientAdmin = (tenantId: string): AuthUser => ({
  id: `user-of-${tenantId}`,
  tenant_id: tenantId,
  role: USER_ROLE.CLIENT_ADMIN,
  email: `admin@${tenantId}.test`,
});

const superAdmin: AuthUser = {
  id: 'platform-owner',
  tenant_id: 'platform',
  role: USER_ROLE.SUPER_ADMIN,
  email: 'owner@platform.test',
};

function makePrisma() {
  return {
    promotionCode: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe('PromotionCodeService — tenant isolation', () => {
  it('scopes list queries to the caller’s tenant', async () => {
    const prisma = makePrisma();
    prisma.$transaction.mockResolvedValue([0, []]);
    const service = new PromotionCodeService(prisma as any);

    await service.findAll(clientAdmin('tenant-a'));

    // The where clause handed to both count and findMany must carry the tenant.
    expect(prisma.promotionCode.count.mock.calls[0][0].where).toMatchObject({
      tenant_id: 'tenant-a',
    });
    expect(prisma.promotionCode.findMany.mock.calls[0][0].where).toMatchObject({
      tenant_id: 'tenant-a',
    });
  });

  it('does not scope list queries for SUPER_ADMIN', async () => {
    const prisma = makePrisma();
    prisma.$transaction.mockResolvedValue([0, []]);
    const service = new PromotionCodeService(prisma as any);

    await service.findAll(superAdmin);

    expect(
      prisma.promotionCode.findMany.mock.calls[0][0].where,
    ).not.toHaveProperty('tenant_id');
  });

  it('reads another tenant’s code as not-found rather than returning it', async () => {
    const prisma = makePrisma();
    // Scoped lookup finds nothing because the row belongs to tenant-b.
    prisma.promotionCode.findFirst.mockResolvedValue(null);
    const service = new PromotionCodeService(prisma as any);

    await expect(
      service.findOne(clientAdmin('tenant-a'), 'code-owned-by-tenant-b'),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.promotionCode.findFirst).toHaveBeenCalledWith({
      where: { id: 'code-owned-by-tenant-b', tenant_id: 'tenant-a' },
    });
  });

  it('refuses to validate a code belonging to another tenant', async () => {
    const prisma = makePrisma();
    prisma.promotionCode.findFirst.mockResolvedValue(null);
    const service = new PromotionCodeService(prisma as any);

    await expect(
      service.validate(clientAdmin('tenant-a'), 'SUMMER2026'),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.promotionCode.findFirst).toHaveBeenCalledWith({
      where: { code: 'SUMMER2026', tenant_id: 'tenant-a' },
    });
  });

  it('stamps new codes with the creator’s tenant', async () => {
    const prisma = makePrisma();
    prisma.promotionCode.findFirst.mockResolvedValue(null);
    prisma.promotionCode.create.mockImplementation(({ data }: any) => data);
    const service = new PromotionCodeService(prisma as any);

    await service.create(clientAdmin('tenant-a'), {
      code: 'SUMMER2026',
      type: 'PERCENTAGE',
      discount: 20,
    } as any);

    expect(prisma.promotionCode.create.mock.calls[0][0].data).toMatchObject({
      tenant_id: 'tenant-a',
      code: 'SUMMER2026',
    });
  });

  it('allows two tenants to use the same code text', async () => {
    const prisma = makePrisma();
    // No clash inside tenant-b even though tenant-a already uses this code.
    prisma.promotionCode.findFirst.mockResolvedValue(null);
    prisma.promotionCode.create.mockImplementation(({ data }: any) => data);
    const service = new PromotionCodeService(prisma as any);

    await service.create(clientAdmin('tenant-b'), {
      code: 'SUMMER2026',
      type: 'PERCENTAGE',
      discount: 10,
    } as any);

    // Uniqueness is checked per tenant, not globally.
    expect(prisma.promotionCode.findFirst).toHaveBeenCalledWith({
      where: { tenant_id: 'tenant-b', code: 'SUMMER2026' },
    });
    expect(prisma.promotionCode.create.mock.calls[0][0].data.tenant_id).toBe(
      'tenant-b',
    );
  });

  it('rejects a duplicate code within the same tenant', async () => {
    const prisma = makePrisma();
    prisma.promotionCode.findFirst.mockResolvedValue({ id: 'existing' });
    const service = new PromotionCodeService(prisma as any);

    await expect(
      service.create(clientAdmin('tenant-a'), {
        code: 'SUMMER2026',
        type: 'PERCENTAGE',
        discount: 20,
      } as any),
    ).rejects.toThrow(ConflictException);
  });
});

describe('PromotionCodeService — validation rules', () => {
  const base = {
    id: 'promo-1',
    tenant_id: 'tenant-a',
    code: 'SUMMER2026',
    type: 'PERCENTAGE',
    discount: 20,
    max_uses: null as number | null,
    used_count: 0,
    valid_from: null as Date | null,
    valid_until: null as Date | null,
    is_active: true,
  };

  const serviceWith = (promo: any) => {
    const prisma = makePrisma();
    prisma.promotionCode.findFirst.mockResolvedValue(promo);
    prisma.promotionCode.updateMany.mockResolvedValue({ count: 1 });
    return { prisma, service: new PromotionCodeService(prisma as any) };
  };

  it('rejects an inactive code', async () => {
    const { service } = serviceWith({ ...base, is_active: false });
    await expect(
      service.validate(clientAdmin('tenant-a'), 'SUMMER2026'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an expired code', async () => {
    const { service } = serviceWith({
      ...base,
      valid_until: new Date('2020-01-01'),
    });
    await expect(
      service.validate(clientAdmin('tenant-a'), 'SUMMER2026'),
    ).rejects.toThrow(/expired/i);
  });

  it('rejects a code that has not started', async () => {
    const { service } = serviceWith({
      ...base,
      valid_from: new Date('2999-01-01'),
    });
    await expect(
      service.validate(clientAdmin('tenant-a'), 'SUMMER2026'),
    ).rejects.toThrow(/not active yet/i);
  });

  it('rejects a fully used code', async () => {
    const { service } = serviceWith({ ...base, max_uses: 5, used_count: 5 });
    await expect(
      service.validate(clientAdmin('tenant-a'), 'SUMMER2026'),
    ).rejects.toThrow(/fully used/i);
  });

  it('accepts a code with no date bounds and unlimited uses', async () => {
    const { service } = serviceWith(base);
    await expect(
      service.validate(clientAdmin('tenant-a'), 'SUMMER2026'),
    ).resolves.toMatchObject({ valid: true });
  });
});

describe('PromotionCodeService — applying a discount', () => {
  const promo = {
    id: 'promo-1',
    tenant_id: 'tenant-a',
    code: 'SUMMER2026',
    type: 'PERCENTAGE',
    discount: 20,
    max_uses: 10,
    used_count: 0,
    valid_from: null,
    valid_until: null,
    is_active: true,
  };

  it('applies a percentage discount and consumes one use', async () => {
    const prisma = makePrisma();
    prisma.promotionCode.findFirst.mockResolvedValue(promo);
    prisma.promotionCode.updateMany.mockResolvedValue({ count: 1 });
    const service = new PromotionCodeService(prisma as any);

    const result = await service.apply(
      clientAdmin('tenant-a'),
      'SUMMER2026',
      500,
    );

    expect(result).toMatchObject({
      original_amount: 500,
      discounted_amount: 400,
      saved: 100,
    });
    // Guarded increment: only bumps while the code is still under its cap.
    expect(
      prisma.promotionCode.updateMany.mock.calls[0][0].where,
    ).toMatchObject({
      id: 'promo-1',
      is_active: true,
      used_count: { lt: 10 },
    });
  });

  it('applies a fixed-amount discount', async () => {
    const prisma = makePrisma();
    prisma.promotionCode.findFirst.mockResolvedValue({
      ...promo,
      type: 'FIXED_AMOUNT',
      discount: 75,
    });
    prisma.promotionCode.updateMany.mockResolvedValue({ count: 1 });
    const service = new PromotionCodeService(prisma as any);

    const result = await service.apply(
      clientAdmin('tenant-a'),
      'SUMMER2026',
      200,
    );
    expect(result.discounted_amount).toBe(125);
  });

  it('never discounts below zero', async () => {
    const prisma = makePrisma();
    prisma.promotionCode.findFirst.mockResolvedValue({
      ...promo,
      type: 'FIXED_AMOUNT',
      discount: 500,
    });
    prisma.promotionCode.updateMany.mockResolvedValue({ count: 1 });
    const service = new PromotionCodeService(prisma as any);

    const result = await service.apply(
      clientAdmin('tenant-a'),
      'SUMMER2026',
      100,
    );
    expect(result.discounted_amount).toBe(0);
    expect(result.saved).toBe(100);
  });

  it('loses the race for the last remaining use rather than over-redeeming', async () => {
    const prisma = makePrisma();
    prisma.promotionCode.findFirst.mockResolvedValue({
      ...promo,
      used_count: 9,
    });
    // A concurrent redemption took the last use between validate and update.
    prisma.promotionCode.updateMany.mockResolvedValue({ count: 0 });
    const service = new PromotionCodeService(prisma as any);

    await expect(
      service.apply(clientAdmin('tenant-a'), 'SUMMER2026', 500),
    ).rejects.toThrow(/fully used/i);
  });

  it('rejects a negative amount', async () => {
    const prisma = makePrisma();
    const service = new PromotionCodeService(prisma as any);
    await expect(
      service.apply(clientAdmin('tenant-a'), 'SUMMER2026', -1),
    ).rejects.toThrow(BadRequestException);
  });
});
