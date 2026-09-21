import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiService } from './openai.service';
import {
  TICKET_CATEGORY,
  TICKET_PRIORITY,
  TICKET_STATUS,
  USER_ROLE,
} from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const CATEGORIES = Object.values(TICKET_CATEGORY) as string[];
const PRIORITIES = Object.values(TICKET_PRIORITY) as string[];

/** Mirrors the @Roles on PATCH /maintenance/:id/assign — a suggestion is only
 *  offered to someone who could actually act on it. */
const CAN_ASSIGN: string[] = [
  USER_ROLE.SUPER_ADMIN,
  USER_ROLE.CLIENT_ADMIN,
  USER_ROLE.MANAGER,
];

/**
 * Fallback classification when the model is unavailable or unusable.
 *
 * Nouns carry an explicit `s?` — people write "bins overflowing" and "lights
 * flickering" far more often than the singular, and a bare \b after the stem
 * silently misses every plural.
 */
const KEYWORDS: { re: RegExp; category: string }[] = [
  {
    re: /\b(leaks?|leaking|drips?|dripping|floods?|flooding|water|taps?|faucets?|toilets?|sinks?|drains?|flush|pipes?|plumbing)\b/i,
    category: TICKET_CATEGORY.PLUMBING,
  },
  {
    re: /\b(a\/c|ac|air ?cons?|aircon|hvac|cooling|heating|heaters?|thermostats?|ventilation|stuffy|humid)\b/i,
    category: TICKET_CATEGORY.HVAC,
  },
  {
    re: /\b(lights?|lamps?|bulbs?|sockets?|plugs?|power|electric(?:al|ity)?|outlets?|breakers?|flicker(?:ing)?|wiring|voltage)\b/i,
    category: TICKET_CATEGORY.ELECTRICAL,
  },
  {
    re: /\b(wifi|wi-?fi|internet|networks?|printers?|screens?|monitors?|projectors?|hdmi|laptops?|cables?|ethernet|badge readers?)\b/i,
    category: TICKET_CATEGORY.IT_EQUIPMENT,
  },
  {
    re: /\b(clean(?:ing)?|dirty|rubbish|bins?|trash|waste|vacuum|stains?|smells?|hygiene)\b/i,
    category: TICKET_CATEGORY.CLEANING,
  },
  {
    re: /\b(chairs?|desks?|tables?|drawers?|cabinets?|shel(?:f|ves)|furniture|door handles?|castors?|broken leg)\b/i,
    category: TICKET_CATEGORY.FURNITURE,
  },
];

const URGENT_WORDS =
  /\b(flood|flooding|fire|smoke|burn|burning|spark|sparking|gas|shock|electrocut|danger|hazard|injur|trapped|stuck in|no power|outage|cannot work|unusable|emergency|urgent|asap|immediately)\b/i;
const LOW_WORDS =
  /\b(minor|cosmetic|whenever|no rush|not urgent|small|slight|when convenient)\b/i;

type Classification = {
  category: string;
  priority: string;
  reason: string;
  source: 'model' | 'keywords';
};

export type TriageResult = Classification & {
  suggestedAssignee: {
    id: string;
    name: string;
    basis: string;
    resolvedInCategory: number;
    openAssigned: number;
  } | null;
  similar: {
    id: string;
    ticket_number: string;
    title: string;
    status: string;
    resolved_at: Date | null;
    cost: number | null;
  }[];
};

@Injectable()
export class MaintenanceTriageService {
  private readonly logger = new Logger(MaintenanceTriageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAi: OpenAiService,
  ) {}

  async triage(
    user: AuthUser,
    input: { title: string; description?: string },
  ): Promise<TriageResult> {
    const classification = await this.classify(input);

    // Staffing data belongs to the property company. A renter reporting a
    // fault gets the category and priority — the rest would tell them who
    // works for their landlord and what else is broken in the building.
    if (!CAN_ASSIGN.includes(user.role)) {
      return { ...classification, suggestedAssignee: null, similar: [] };
    }

    const [suggestedAssignee, similar] = await Promise.all([
      this.suggestAssignee(user, classification.category),
      this.similarTickets(user, classification.category),
    ]);

    return { ...classification, suggestedAssignee, similar };
  }

  // ─── classification ───────────────────────────────────────────────────────

  private async classify(input: {
    title: string;
    description?: string;
  }): Promise<Classification> {
    const text = [input.title, input.description]
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!this.openAi.isConfigured()) return this.fromKeywords(text);

    const system = `You triage maintenance requests for an office building.
Reply with ONLY a JSON object, no prose and no code fences:
{"category":"<one of: ${CATEGORIES.join(' | ')}>","priority":"<one of: ${PRIORITIES.join(' | ')}>","reason":"<max 110 chars, why this priority>"}

Priority guide:
- EMERGENCY: danger to people or the building (fire, flood, gas, electric shock)
- URGENT: a space cannot be used at all right now
- HIGH: significantly disrupts work but the space is usable
- NORMAL: ordinary repair
- LOW: cosmetic or can wait

Judge only what the text says. Do not invent details.`;

    const parsed = await this.openAi.chatJson<{
      category?: string;
      priority?: string;
      reason?: string;
    }>([{ role: 'user', content: text }], system);

    if (!parsed) return this.fromKeywords(text);

    const category = String(parsed.category ?? '').toUpperCase();
    const priority = String(parsed.priority ?? '').toUpperCase();

    // A model that returns a value outside the enum is not trusted for the
    // rest of the object either — fall back wholesale rather than mixing.
    if (!CATEGORIES.includes(category) || !PRIORITIES.includes(priority)) {
      this.logger.warn(
        `Triage model returned unknown values (${category}/${priority}); using keywords`,
      );
      return this.fromKeywords(text);
    }

    const reason = String(parsed.reason ?? '')
      .slice(0, 110)
      .trim();
    return {
      category,
      priority,
      reason: reason || 'Classified from the description',
      source: 'model',
    };
  }

  /** Deterministic backstop. Always available, never throws. */
  private fromKeywords(text: string): Classification {
    const hit = KEYWORDS.find((k) => k.re.test(text));
    const category = hit?.category ?? TICKET_CATEGORY.OTHER;

    let priority: string = TICKET_PRIORITY.NORMAL;
    let reason = 'Default priority — no urgency signals in the text';
    if (URGENT_WORDS.test(text)) {
      priority = TICKET_PRIORITY.URGENT;
      reason = 'Text mentions a safety or work-stopping problem';
    } else if (LOW_WORDS.test(text)) {
      priority = TICKET_PRIORITY.LOW;
      reason = 'Text suggests the issue is minor or can wait';
    }

    return { category, priority, reason, source: 'keywords' };
  }

  // ─── who should take it ───────────────────────────────────────────────────

  /**
   * Chosen from ticket history, not by the model: experience in this category,
   * less current workload. A language model asked to name a person invents
   * people who do not work here, and the choice could not be explained to the
   * manager who has to stand behind it.
   */
  private async suggestAssignee(user: AuthUser, category: string) {
    const technicians = await this.prisma.user.findMany({
      where: {
        tenant_id: user.tenant_id,
        role: USER_ROLE.MAINTENANCE,
        status: 'ACTIVE',
      },
      select: { id: true, first_name: true, last_name: true, email: true },
    });
    if (technicians.length === 0) return null;

    const ids = technicians.map((t) => t.id);
    const [resolved, open] = await Promise.all([
      this.prisma.maintenanceTicket.groupBy({
        by: ['assigned_to'],
        where: {
          assigned_to: { in: ids },
          category,
          status: { in: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] },
        },
        _count: { id: true },
      }),
      this.prisma.maintenanceTicket.groupBy({
        by: ['assigned_to'],
        where: {
          assigned_to: { in: ids },
          status: {
            in: [TICKET_STATUS.ASSIGNED, TICKET_STATUS.IN_PROGRESS],
          },
        },
        _count: { id: true },
      }),
    ]);

    const countsFrom = (
      rows: { assigned_to: string | null; _count: { id: number } }[],
    ) => {
      const m: Record<string, number> = {};
      for (const r of rows) if (r.assigned_to) m[r.assigned_to] = r._count.id;
      return m;
    };
    const resolvedBy = countsFrom(resolved);
    const openBy = countsFrom(open);

    const ranked = technicians
      .map((t) => {
        const experience = resolvedBy[t.id] ?? 0;
        const load = openBy[t.id] ?? 0;
        // Experience in the category leads; current load dampens it rather
        // than overriding it. At a heavier penalty a specialist holding two
        // open tickets lost to a colleague who had never done the work,
        // which is not the call a manager would make — but someone genuinely
        // swamped still drops below a free pair of hands.
        return { t, experience, load, score: experience * 10 - load * 6 };
      })
      .sort(
        (a, b) =>
          b.score - a.score || a.load - b.load || a.t.id.localeCompare(b.t.id), // stable when nothing separates them
      );

    const top = ranked[0];
    const name =
      `${top.t.first_name ?? ''} ${top.t.last_name ?? ''}`.trim() ||
      top.t.email;

    const basis =
      top.experience > 0
        ? `${top.experience} ${category.toLowerCase().replace('_', ' ')} ticket${top.experience === 1 ? '' : 's'} resolved, ${top.load} open now`
        : `No ${category.toLowerCase().replace('_', ' ')} history yet — ${top.load} open ticket${top.load === 1 ? '' : 's'}, the lightest load`;

    return {
      id: top.t.id,
      name,
      basis,
      resolvedInCategory: top.experience,
      openAssigned: top.load,
    };
  }

  /**
   * Past fixes on this company's own buildings. Scoped through the building,
   * because a ticket's tenant_id is the renter that raised it — see
   * MaintenanceService.landlordTicketScope.
   */
  private async similarTickets(user: AuthUser, category: string) {
    const rows = await this.prisma.maintenanceTicket.findMany({
      where: {
        category,
        status: { in: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] },
        ...(user.role === USER_ROLE.SUPER_ADMIN
          ? {}
          : { space: { floor: { building: { tenant_id: user.tenant_id } } } }),
      },
      select: {
        id: true,
        ticket_number: true,
        title: true,
        status: true,
        resolved_at: true,
        cost: true,
      },
      orderBy: { resolved_at: 'desc' },
      take: 3,
    });
    return rows;
  }
}
