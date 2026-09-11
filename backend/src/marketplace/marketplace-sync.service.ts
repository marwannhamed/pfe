import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SPACE_STATUS } from '../constants/enums';
import {
  MarketplaceAdaptersService,
  MarketplaceListingPayload,
} from './marketplace-adapters.service';

@Injectable()
export class MarketplaceSyncService {
  private readonly logger = new Logger(MarketplaceSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapters: MarketplaceAdaptersService,
  ) {}

  /** Next ~60 weekdays, hourly 9–17 slots that do not overlap existing bookings. */
  private async buildAvailabilityCalendar(
    spaceId: string,
  ): Promise<{ start: string; end: string }[]> {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 60);

    const bookings = await this.prisma.booking.findMany({
      where: {
        space_id: spaceId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        AND: [{ start_time: { lt: to } }, { end_time: { gt: from } }],
      },
      select: { start_time: true, end_time: true },
    });

    const slots: { start: string; end: string }[] = [];
    const cursor = new Date(from);
    while (cursor < to) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) {
        for (let h = 9; h < 17; h++) {
          const start = new Date(cursor);
          start.setHours(h, 0, 0, 0);
          const end = new Date(cursor);
          end.setHours(h + 1, 0, 0, 0);
          const overlap = bookings.some(
            (b) => b.start_time < end && b.end_time > start,
          );
          if (!overlap) {
            slots.push({ start: start.toISOString(), end: end.toISOString() });
          }
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return slots.slice(0, 400);
  }

  private toPayload(space: {
    id: string;
    name: string;
    description: string | null;
    photos: string[];
    hourly_rate: number | null;
    daily_rate: number | null;
    monthly_rate: number | null;
    currency: string;
    capacity: number | null;
    type: string;
    features: { name: string }[];
  }): Promise<MarketplaceListingPayload> {
    return this.buildAvailabilityCalendar(space.id).then((availability) => ({
      externalSpaceId: space.id,
      name: space.name,
      description: space.description,
      photos: (space as { photos?: string[] }).photos ?? [],
      pricing: {
        hourly: space.hourly_rate,
        daily: space.daily_rate,
        monthly: space.monthly_rate,
        currency: space.currency ?? 'USD',
      },
      amenities: space.features.map((f) => f.name),
      capacity: space.capacity,
      availability,
      type: space.type,
    }));
  }

  /** Every 15 minutes: push listed available spaces; unpublish when delisted or not available. */
  @Cron('*/15 * * * *')
  async syncMarketplaceListings(): Promise<void> {
    this.logger.log('Marketplace sync started');

    const activeListed = await this.prisma.space.findMany({
      where: {
        is_listed: true,
        status: SPACE_STATUS.AVAILABLE,
      },
      include: { features: true },
    });

    for (const space of activeListed) {
      try {
        const payload = await this.toPayload(space as any);
        const cw = await this.adapters.upsertCoworkerListing(
          space.coworker_listing_id,
          payload,
        );
        const ls = await this.adapters.upsertLiquidspaceListing(
          space.liquidspace_listing_id,
          payload,
        );
        await this.prisma.space.update({
          where: { id: space.id },
          data: {
            coworker_listing_id: cw,
            liquidspace_listing_id: ls,
          },
        });
      } catch (e: any) {
        this.logger.error(`Sync failed for space ${space.id}: ${e?.message}`);
      }
    }

    const toUnpublish = await this.prisma.space.findMany({
      where: {
        OR: [
          { coworker_listing_id: { not: null } },
          { liquidspace_listing_id: { not: null } },
        ],
        NOT: { AND: [{ is_listed: true }, { status: SPACE_STATUS.AVAILABLE }] },
      },
      select: {
        id: true,
        coworker_listing_id: true,
        liquidspace_listing_id: true,
      },
    });

    for (const s of toUnpublish) {
      try {
        if (s.coworker_listing_id) {
          await this.adapters.deleteCoworkerListing(s.coworker_listing_id);
        }
        if (s.liquidspace_listing_id) {
          await this.adapters.deleteLiquidspaceListing(
            s.liquidspace_listing_id,
          );
        }
        await this.prisma.space.update({
          where: { id: s.id },
          data: { coworker_listing_id: null, liquidspace_listing_id: null },
        });
      } catch (e: any) {
        this.logger.error(`Unpublish failed for space ${s.id}: ${e?.message}`);
      }
    }

    this.logger.log(
      `Marketplace sync done: ${activeListed.length} active, ${toUnpublish.length} unpublished`,
    );
  }
}
