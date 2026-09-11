import type { Prisma } from '@prisma/client';

/** Delete all spaces (and dependent rows) under the given floors. */
export async function cascadeDeleteSpacesForFloors(
  tx: Prisma.TransactionClient,
  floorIds: string[],
): Promise<number> {
  if (floorIds.length === 0) return 0;

  const spaces = await tx.space.findMany({
    where: { floor_id: { in: floorIds } },
    select: { id: true },
  });
  const spaceIds = spaces.map((s) => s.id);
  if (spaceIds.length === 0) return 0;

  const bookings = await tx.booking.findMany({
    where: { space_id: { in: spaceIds } },
    select: { id: true },
  });
  const bookingIds = bookings.map((b) => b.id);

  if (bookingIds.length) {
    await tx.bookingAddOn.deleteMany({
      where: { booking_id: { in: bookingIds } },
    });
    await tx.maintenanceTicket.updateMany({
      where: { booking_id: { in: bookingIds } },
      data: { booking_id: null },
    });
  }

  await tx.bookingApplication.deleteMany({
    where: {
      OR: [
        { space_id: { in: spaceIds } },
        ...(bookingIds.length ? [{ booking_id: { in: bookingIds } }] : []),
      ],
    },
  });

  if (bookingIds.length) {
    await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
  }

  await tx.maintenanceTicket.updateMany({
    where: { space_id: { in: spaceIds } },
    data: { space_id: null },
  });

  await tx.tenantApplication.updateMany({
    where: { space_id: { in: spaceIds } },
    data: { space_id: null },
  });

  const result = await tx.space.deleteMany({ where: { id: { in: spaceIds } } });
  return result.count;
}
