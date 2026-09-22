import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiService } from './openai.service';
import { SPACE_TYPE, SPACE_STATUS } from '../constants/enums';

/**
 * The public space finder: a visitor describes what they need in their own
 * words and gets real listings back.
 *
 * Three stages, and the middle one is the point:
 *
 *   1. the model turns free text into structured criteria
 *   2. a plain Prisma query finds spaces matching those criteria
 *   3. the model writes a short reply about the rows stage 2 returned
 *
 * The model never selects a space and never sees one that stage 2 did not
 * return. That matters more here than anywhere else in this codebase, because
 * this endpoint is unauthenticated: a visitor can write whatever they like
 * into it, including instructions aimed at the model. They can make the model
 * say anything; they cannot make it read anything, because the only data it
 * ever sees is the output of PUBLIC_WHERE below — the same filter the guest
 * map already applies.
 */

const TYPES = Object.values(SPACE_TYPE) as string[];

/**
 * The entire public surface. Identical to SpaceService.findPublishedForMap:
 * published, currently available, and placed on the map. Nothing else is
 * reachable from here, whatever the conversation asks for.
 */
const PUBLIC_WHERE = {
  is_published: true,
  status: SPACE_STATUS.AVAILABLE,
  map_lat: { not: null },
  map_lng: { not: null },
} as const;

export type SpaceCriteria = {
  type: string | null;
  min_capacity: number | null;
  max_monthly_budget: number | null;
  city: string | null;
  keywords: string[];
};

export type SpaceFinderResult = {
  reply: string;
  criteria: SpaceCriteria;
  matches: {
    id: string;
    name: string;
    slug: string;
    type: string;
    capacity: number | null;
    area_sqm: number | null;
    monthly_rate: number | null;
    currency: string;
    city: string | null;
    building: string | null;
    features: string[];
  }[];
  /** True when nothing matched and the list was widened to show alternatives. */
  relaxed: boolean;
};

@Injectable()
export class SpaceFinderService {
  private readonly logger = new Logger(SpaceFinderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAi: OpenAiService,
  ) {}

  async find(
    messages: { role: string; content: string }[],
  ): Promise<SpaceFinderResult> {
    const criteria = await this.readCriteria(messages);

    let matches = await this.search(criteria);
    let relaxed = false;

    // Something to look at beats "no results" for a visitor who is browsing.
    if (matches.length === 0) {
      matches = await this.search({
        ...criteria,
        max_monthly_budget: null,
        min_capacity: null,
      });
      relaxed = matches.length > 0;
    }

    const reply = await this.writeReply(messages, criteria, matches, relaxed);
    return { reply, criteria, matches, relaxed };
  }

  // ─── 1. what did they ask for ─────────────────────────────────────────────

  private async readCriteria(
    messages: { role: string; content: string }[],
  ): Promise<SpaceCriteria> {
    const empty: SpaceCriteria = {
      type: null,
      min_capacity: null,
      max_monthly_budget: null,
      city: null,
      keywords: [],
    };
    if (!this.openAi.isConfigured()) return empty;

    const system = `You turn an enquiry about renting office space into search criteria.
Reply with ONLY a JSON object, no prose and no code fences:
{"type": <one of ${TYPES.join(' | ')} or null>,
 "min_capacity": <number of people, or null>,
 "max_monthly_budget": <number in QAR per month, or null>,
 "city": <city name, or null>,
 "keywords": [<up to 4 single words describing wants such as "parking", "metro", "quiet">]}

Guidance:
- "a desk for me" is HOT_DESK; "office for my team" is DEDICATED_OFFICE;
  "room for a workshop" or "for an event" is EVENT_SPACE;
  "board meeting" or "big presentation" is CONFERENCE_ROOM.
- Read budgets as monthly QAR. "5k" is 5000. Per-year figures divide by 12.
- Use null for anything the visitor has not said. Never invent a constraint.`;

    const parsed = await this.openAi.chatJson<Partial<SpaceCriteria>>(
      messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      system,
    );
    if (!parsed) return empty;

    const num = (v: unknown) =>
      typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
    const type =
      typeof parsed.type === 'string' &&
      TYPES.includes(parsed.type.toUpperCase())
        ? parsed.type.toUpperCase()
        : null;

    return {
      type,
      min_capacity: num(parsed.min_capacity),
      max_monthly_budget: num(parsed.max_monthly_budget),
      city:
        typeof parsed.city === 'string' && parsed.city.trim()
          ? parsed.city.trim().slice(0, 60)
          : null,
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords
            .filter((k): k is string => typeof k === 'string')
            .slice(0, 4)
            .map((k) => k.trim().slice(0, 24))
            .filter(Boolean)
        : [],
    };
  }

  // ─── 2. what actually exists ──────────────────────────────────────────────

  private async search(c: SpaceCriteria) {
    const rows = await this.prisma.space.findMany({
      where: {
        ...PUBLIC_WHERE,
        ...(c.type && { type: c.type }),
        ...(c.min_capacity && { capacity: { gte: c.min_capacity } }),
        ...(c.max_monthly_budget && {
          monthly_rate: { lte: c.max_monthly_budget },
        }),
        ...(c.city && { city: { contains: c.city, mode: 'insensitive' } }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        capacity: true,
        area_sqm: true,
        monthly_rate: true,
        currency: true,
        city: true,
        features: { select: { name: true } },
        floor: { select: { building: { select: { name: true } } } },
      },
      // cheapest that clears the requirement — what a visitor on a budget wants
      orderBy: [{ monthly_rate: 'asc' }, { capacity: 'asc' }],
      take: 6,
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      type: r.type,
      capacity: r.capacity,
      area_sqm: r.area_sqm,
      monthly_rate: r.monthly_rate,
      currency: r.currency,
      city: r.city,
      building: r.floor?.building?.name ?? null,
      features: r.features.map((f) => f.name),
    }));
  }

  // ─── 3. say something useful about them ───────────────────────────────────

  private async writeReply(
    messages: { role: string; content: string }[],
    criteria: SpaceCriteria,
    matches: SpaceFinderResult['matches'],
    relaxed: boolean,
  ): Promise<string> {
    if (matches.length === 0) {
      return "I could not find anything available that matches. Tell me roughly how many people you need space for and your monthly budget, and I'll look again.";
    }
    if (!this.openAi.isConfigured()) {
      return `I found ${matches.length} available ${matches.length === 1 ? 'space' : 'spaces'}. Have a look below.`;
    }

    // The listings are given as data. The model describes them; it cannot add
    // to them, and it is told so explicitly.
    const listings = matches
      .map(
        (m, i) =>
          `${i + 1}. ${m.name} — ${m.type.replace(/_/g, ' ').toLowerCase()}, seats ${m.capacity ?? '?'}, ${m.area_sqm ?? '?'} sqm, ${m.monthly_rate ?? '?'} ${m.currency}/month, ${m.building ?? 'building'} in ${m.city ?? 'Doha'}${m.features.length ? `, features: ${m.features.join(', ')}` : ''}`,
      )
      .join('\n');

    const system = `You help visitors to an office-rental site in Qatar.
Write at most three sentences about the listings given below. Be warm and plain.

Rules:
- Only ever mention listings from this list. Never invent a space, a price or a feature.
- Do not repeat the whole list — it is shown beside your message. Point out what stands out.
- Prices are monthly QAR.
${relaxed ? '- Nothing matched their exact limits, so say gently that you widened the search.' : ''}
- If something important is still unknown (headcount, budget, area), end by asking for that one thing.

Listings:
${listings}`;

    try {
      const reply = await this.openAi.chat(
        messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        system,
      );
      return reply.slice(0, 700);
    } catch (err) {
      this.logger.warn(`Space finder reply failed: ${(err as Error).message}`);
      void criteria;
      return `I found ${matches.length} available ${matches.length === 1 ? 'space' : 'spaces'} for you. Have a look below.`;
    }
  }
}
