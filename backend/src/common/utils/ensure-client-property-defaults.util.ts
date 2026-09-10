import type { Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient | {
  building: Prisma.TransactionClient['building'];
  floor: Prisma.TransactionClient['floor'];
};

/** Hidden portfolio shell so clients publish spaces without managing buildings/floors. */
export async function ensureClientPropertyDefaults(db: Db, tenantId: string) {
  const slug = `portfolio-${tenantId}`;

  let building = await db.building.findFirst({
    where: { tenant_id: tenantId, slug },
    include: { floors: true },
  });

  if (!building) {
    building = await db.building.create({
      data: {
        tenant_id: tenantId,
        name: 'My Portfolio',
        slug,
        description: 'Auto-created container for published spaces',
      },
      include: { floors: true },
    });
  }

  let floor =
    building.floors.find((f) => f.name === 'Default') ??
    (await db.floor.findFirst({
      where: { building_id: building.id, name: 'Default' },
    }));

  if (!floor) {
    floor = await db.floor.create({
      data: {
        building_id: building.id,
        floor_number: 1,
        name: 'Default',
        status: 'ACTIVE',
      },
    });
  }

  return { building, floor };
}
