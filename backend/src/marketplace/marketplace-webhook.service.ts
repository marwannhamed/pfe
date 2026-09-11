import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  BOOKING_STATUS,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPE,
  USER_ROLE,
} from '../constants/enums';
import { NotificationService } from '../notification/notification.service';
import { MailService } from '../mail/mail.service';

export type MarketplacePlatform = 'coworker' | 'liquidspace';

@Injectable()
export class MarketplaceWebhookService {
  private readonly logger = new Logger(MarketplaceWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private webhookSecret(platform: MarketplacePlatform): string | undefined {
    const key =
      platform === 'coworker'
        ? 'COWORKER_WEBHOOK_SECRET'
        : 'LIQUIDSPACE_WEBHOOK_SECRET';
    return this.config.get<string>(key)?.trim();
  }

  private verifySignature(
    platform: MarketplacePlatform,
    canonicalPayload: string,
    signatureHeader: string | undefined,
  ): void {
    const skip =
      this.config.get<string>('MARKETPLACE_WEBHOOK_VERIFY') === 'false';
    if (skip) return;
    let secret = this.webhookSecret(platform);
    if (!secret) {
      secret = this.config.get<string>('MARKETPLACE_WEBHOOK_SECRET')?.trim();
    }
    if (!secret) {
      this.logger.warn(`No webhook secret for ${platform} — rejecting`);
      throw new UnauthorizedException('Webhook not configured');
    }
    if (!signatureHeader) throw new UnauthorizedException('Missing signature');
    const expected = createHmac('sha256', secret)
      .update(canonicalPayload)
      .digest('hex');
    const provided = signatureHeader.replace(/^sha256=/i, '').trim();
    if (provided.length !== expected.length || provided !== expected) {
      throw new UnauthorizedException('Invalid signature');
    }
  }

  private canonicalInquiry(body: {
    inquiryId: string;
    listingId?: string;
    spaceId?: string;
    start: string;
    end: string;
  }): string {
    return [
      body.inquiryId,
      body.start,
      body.end,
      body.spaceId ?? '',
      body.listingId ?? '',
    ].join('|');
  }

  private async resolveSpace(
    platform: MarketplacePlatform,
    spaceId: string | undefined,
    listingId: string | undefined,
  ) {
    if (spaceId) {
      const s = await this.prisma.space.findUnique({
        where: { id: spaceId },
        include: { floor: { include: { building: true } } },
      });
      if (s) return s;
    }
    if (listingId) {
      const where =
        platform === 'coworker'
          ? { coworker_listing_id: listingId }
          : { liquidspace_listing_id: listingId };
      const s = await this.prisma.space.findFirst({
        where: where as any,
        include: { floor: { include: { building: true } } },
      });
      if (s) return s;
    }
    throw new BadRequestException('Space not found for marketplace payload');
  }

  private async pickBookingActorUserId(siteTenantId: string): Promise<string> {
    const manager = await this.prisma.user.findFirst({
      where: {
        tenant_id: siteTenantId,
        status: 'ACTIVE',
        role: USER_ROLE.MANAGER,
      },
      orderBy: { created_at: 'asc' },
    });
    if (manager) return manager.id;
    const admin = await this.prisma.user.findFirst({
      where: {
        tenant_id: siteTenantId,
        status: 'ACTIVE',
        role: USER_ROLE.TENANT_ADMIN,
      },
      orderBy: { created_at: 'asc' },
    });
    if (admin) return admin.id;
    const anyUser = await this.prisma.user.findFirst({
      where: { tenant_id: siteTenantId, status: 'ACTIVE' },
      orderBy: { created_at: 'asc' },
    });
    if (!anyUser)
      throw new BadRequestException('No user to attach marketplace booking');
    return anyUser.id;
  }

  private generateBookingNumber(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const r = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `BK-MKT-${y}${m}${day}-${r}`;
  }

  async handleInquiry(
    platform: MarketplacePlatform,
    signatureHeader: string | undefined,
    body: {
      inquiryId: string;
      listingId?: string;
      spaceId?: string;
      start: string;
      end: string;
      guestEmail?: string;
      guestName?: string;
    },
  ) {
    const canonical = this.canonicalInquiry(body);
    this.verifySignature(platform, canonical, signatureHeader);
    if (!body.inquiryId || !body.start || !body.end) {
      throw new BadRequestException('inquiryId, start, and end are required');
    }
    if (!body.spaceId && !body.listingId) {
      throw new BadRequestException('Provide spaceId or listingId');
    }

    const marker = `"inquiryId":"${body.inquiryId}"`;
    const existing = await this.prisma.booking.findFirst({
      where: { notes: { contains: marker } },
    });
    if (existing) {
      return { ok: true, duplicate: true, bookingId: existing.id };
    }

    const space = await this.resolveSpace(
      platform,
      body.spaceId,
      body.listingId,
    );
    const tenantId = space.floor.building.tenant_id;
    const userId = await this.pickBookingActorUserId(tenantId);

    const start = new Date(body.start);
    const end = new Date(body.end);
    if (!(start < end)) throw new BadRequestException('Invalid time range');

    const conflict = await this.prisma.booking.findFirst({
      where: {
        space_id: space.id,
        status: { notIn: [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.NO_SHOW] },
        AND: [{ start_time: { lt: end } }, { end_time: { gt: start } }],
      },
    });
    if (conflict) {
      throw new ConflictException('Requested slot is no longer available');
    }

    const notes = JSON.stringify({
      source: 'marketplace',
      platform,
      inquiryId: body.inquiryId,
      guestEmail: body.guestEmail,
      guestName: body.guestName,
    });

    const booking = await this.prisma.booking.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        space_id: space.id,
        booking_number: this.generateBookingNumber(),
        status: BOOKING_STATUS.PENDING_APPROVAL,
        start_time: start,
        end_time: end,
        total_amount: 0,
        total_price: 0,
        notes,
      },
    });

    const managers = await this.prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        status: 'ACTIVE',
        role: { in: [USER_ROLE.MANAGER, USER_ROLE.TENANT_ADMIN] },
      },
      select: { id: true, email: true, first_name: true },
    });

    const title = `Marketplace inquiry (${platform})`;
    const message = `New pending booking ${booking.booking_number} for "${space.name}". Guest: ${body.guestName ?? '—'} <${body.guestEmail ?? '—'}>.`;

    for (const m of managers) {
      await this.notifications.create({
        tenant_id: tenantId,
        user_id: m.id,
        type: NOTIFICATION_TYPE.MARKETPLACE_INQUIRY,
        channel: NOTIFICATION_CHANNEL.IN_APP,
        title,
        message,
        priority: NOTIFICATION_PRIORITY.HIGH,
      });
    }

    for (const m of managers) {
      if (m.email) {
        await this.mail.sendMarketplaceInquiry({
          to: m.email,
          bookingNumber: booking.booking_number,
          spaceName: space.name,
          platform,
          guestName: body.guestName,
          guestEmail: body.guestEmail,
          start: start.toISOString(),
          end: end.toISOString(),
        });
      }
    }

    return {
      ok: true,
      bookingId: booking.id,
      bookingNumber: booking.booking_number,
    };
  }
}
