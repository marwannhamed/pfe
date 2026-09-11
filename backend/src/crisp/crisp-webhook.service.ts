import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  TICKET_CATEGORY,
  TICKET_PRIORITY,
  TICKET_STATUS,
} from '../constants/enums';
import { generateMaintenanceTicketNumber } from '../maintenance/ticket-number.util';

const MAINTENANCE_TAG = 'maintenance-request';

@Injectable()
export class CrispWebhookService {
  private readonly logger = new Logger(CrispWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  verifySignature(
    rawBody: string,
    timestamp: string | undefined,
    signature: string | undefined,
  ): void {
    const bypass = this.config.get<string>('CRISP_WEBHOOK_VERIFY') === 'false';
    if (bypass) return;

    const secret = this.config.get<string>('CRISP_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      this.logger.warn('CRISP_WEBHOOK_SECRET not set; rejecting webhook');
      throw new UnauthorizedException('Webhook not configured');
    }
    if (!timestamp || !signature) {
      throw new UnauthorizedException('Missing Crisp signature headers');
    }

    const payload = `${timestamp}${rawBody}`;
    const expected = createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
      .toLowerCase();
    const got = (signature ?? '').trim().toLowerCase();
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(got, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid Crisp signature');
    }
  }

  private collectTags(data: Record<string, unknown>): string[] {
    const out = new Set<string>();
    const add = (v: unknown) => {
      if (typeof v === 'string') out.add(v.toLowerCase());
    };
    const walk = (obj: unknown) => {
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (k.toLowerCase() === 'tags' && Array.isArray(v)) {
          for (const t of v) add(t);
        }
        if (k.toLowerCase() === 'segments' && Array.isArray(v)) {
          for (const seg of v) {
            if (typeof seg === 'string') add(seg);
            if (Array.isArray(seg) && seg[0]) add(String(seg[0]));
          }
        }
        if (typeof v === 'object' && v !== null) walk(v);
      }
    };
    walk(data);
    return [...out];
  }

  private extractVisitorEmail(data: Record<string, unknown>): string | null {
    const tryEmail = (o: unknown): string | null => {
      if (!o || typeof o !== 'object') return null;
      const e = (o as { email?: string }).email;
      return typeof e === 'string' && e.includes('@') ? e : null;
    };
    const direct = tryEmail(data);
    if (direct) return direct;
    const people = data.people as unknown;
    if (Array.isArray(people)) {
      for (const p of people) {
        const person = (p as { person?: { email?: string } })?.person;
        const e = tryEmail(person);
        if (e) return e;
      }
    }
    return null;
  }

  private extractSessionId(payload: Record<string, unknown>): string | null {
    const d = (payload.data ?? payload) as Record<string, unknown>;
    const sid =
      (typeof d.session_id === 'string' && d.session_id) ||
      (typeof (d.session as { session_id?: string } | undefined)?.session_id ===
        'string' &&
        (d.session as { session_id: string }).session_id) ||
      (typeof (d as { session_id?: string }).session_id === 'string' &&
        (d as { session_id: string }).session_id);
    return sid || null;
  }

  private buildTranscript(data: Record<string, unknown>): string {
    const messages = (
      data as { messages?: { content?: string; type?: string }[] }
    ).messages;
    if (Array.isArray(messages) && messages.length) {
      return messages
        .map((m) => (m?.content ? `[${m.type ?? 'text'}] ${m.content}` : ''))
        .filter(Boolean)
        .join('\n')
        .slice(0, 8000);
    }
    return `Crisp payload excerpt:\n${JSON.stringify(data).slice(0, 6000)}`;
  }

  async handleEvent(
    rawBody: string,
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean; created?: string }> {
    const event = String(payload.event ?? '');
    const data = (payload.data ?? {}) as Record<string, unknown>;

    const isSettled =
      event === 'session:settled' ||
      event === 'session:resolved' ||
      event === 'session:expired';

    if (!isSettled) {
      return { ok: true };
    }

    const tags = this.collectTags({ ...data, ...payload });
    if (!tags.includes(MAINTENANCE_TAG)) {
      return { ok: true };
    }

    const email = this.extractVisitorEmail(data);
    const sessionId = this.extractSessionId(payload);
    const transcript = this.buildTranscript(data);

    let tenantId: string | null = null;
    let userId: string | null = null;

    if (email) {
      const user = await this.prisma.user.findFirst({
        where: { email: email.toLowerCase() },
        select: { id: true, tenant_id: true },
      });
      if (user) {
        tenantId = user.tenant_id;
        userId = user.id;
      }
    }

    if (!tenantId) {
      const fallback = this.config
        .get<string>('CRISP_WEBHOOK_FALLBACK_TENANT_ID')
        ?.trim();
      if (!fallback) {
        this.logger.warn(
          'Crisp maintenance-request: no visitor email match and no CRISP_WEBHOOK_FALLBACK_TENANT_ID',
        );
        return { ok: false };
      }
      tenantId = fallback;
    }

    const ticket = await this.prisma.maintenanceTicket.create({
      data: {
        tenant_id: tenantId,
        space_id: null,
        user_id: userId,
        created_by_user_id: userId,
        ticket_number: generateMaintenanceTicketNumber(),
        title: 'Support chat — maintenance request',
        description: transcript,
        category: TICKET_CATEGORY.OTHER,
        priority: TICKET_PRIORITY.NORMAL,
        status: TICKET_STATUS.OPEN,
        crisp_session_id: sessionId ?? null,
      },
    });

    if (sessionId && userId) {
      await this.prisma.user
        .update({
          where: { id: userId },
          data: { crisp_session_id: sessionId },
        })
        .catch(() => undefined);
    }

    this.logger.log(
      `Created maintenance ticket ${ticket.id} from Crisp session ${sessionId ?? 'n/a'}`,
    );
    return { ok: true, created: ticket.id };
  }
}
