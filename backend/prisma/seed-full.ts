/**
 * Full demo dataset — wipes every table and rebuilds a realistic portfolio.
 *
 *   npm run db:seed:full        (from backend/, a few seconds)
 *
 * The story: LeaseManager runs three property companies in Doha and Lusail —
 * seven buildings, ~120 spaces — renting to around thirty organisations at
 * every stage: established tenants on monthly leases, applicants moving
 * through the reception workflow, and prospects waiting for a decision. Six
 * months of history lead up to today: lease periods, invoices and payments,
 * meeting-room and event bookings, maintenance tickets, notifications and an
 * audit trail.
 *
 * Everything is placed relative to the moment the script runs. Re-run it on
 * the day of a demo so "today's" bookings, this week's calendar and the
 * overdue invoices line up with the clock.
 *
 * Shapes the services depend on:
 *  - a property company reaches an invoice only through a booking in one of
 *    its buildings (Booking.invoice_id), and a contract only through those
 *    invoices — so every lease is billed through monthly period bookings;
 *  - dashboards bucket list results by month, so operational history stays
 *    inside the last six calendar months;
 *  - a renter raises tickets on spaces it uses (ticket.tenant_id = renter);
 *    staff raise common-area tickets for their own company (= landlord),
 *    which is what the predictive-maintenance page scores;
 *  - every e-mail address is on the reserved .test domain, except the
 *    long-standing platform owner login.
 *
 * Every account uses the same password: Password123!
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '..', '.env'), quiet: true } as any);

const prisma = new PrismaClient();
const PASSWORD = 'Password123!';

// ─── deterministic randomness ─────────────────────────────────────────────
// Each record draws from a generator seeded by its own stable key, so the
// same booking, invoice or ticket comes out the same on every run — numbers
// rehearsed for a demo stay valid after a reseed.

/** FNV-1a: a stable key becomes a 32-bit seed. */
function hash32(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small and plenty for demo data. */
function rngFrom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const keyed = (key: string): Rng => rngFrom(hash32(key));
const between = (r: Rng, lo: number, hi: number) =>
  lo + Math.floor(r() * (hi - lo + 1));
const pickOne = <T>(r: Rng, xs: readonly T[]): T =>
  xs[Math.floor(r() * xs.length)];
function weighted<T>(r: Rng, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [value, w] of entries) {
    x -= w;
    if (x < 0) return value;
  }
  return entries[entries.length - 1][0];
}
const money = (n: number) => Math.round(n * 100) / 100;
const roundTo = (n: number, step: number) => Math.round(n / step) * step;
/** The 8-character upper-case suffix the app puts on its own numbers. */
const hex8 = (key: string) =>
  hash32(key).toString(16).toUpperCase().padStart(8, '0');

const handedOut = new Set<string>();
/** A number in the app's own format, never issued twice. */
function numbered(make: (salt: string) => string, key: string) {
  let value = make(key);
  for (let n = 1; handedOut.has(value); n++) value = make(`${key}#${n}`);
  handedOut.add(value);
  return value;
}

// ─── time ─────────────────────────────────────────────────────────────────
const NOW = new Date();
const monthStart = (k: number) =>
  new Date(NOW.getFullYear(), NOW.getMonth() + k, 1);
const monthEnd = (k: number) =>
  new Date(NOW.getFullYear(), NOW.getMonth() + k + 1, 0, 23, 59);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);
const at = (d: Date, h: number, m = 0) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
};
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);
const TODAY = at(NOW, 0);
/** First day of operational history: six calendar months, today's included. */
const GO_LIVE = monthStart(-5);
/** Qatar's weekend is Friday and Saturday. */
const isWorkday = (d: Date) => d.getDay() !== 5 && d.getDay() !== 6;
const pad2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) =>
  `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
const ym = (d: Date) => ymd(d).slice(0, 6);
const monthName = (d: Date) =>
  d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const dayLabel = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const timeLabel = (d: Date) =>
  `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
/** A "created" timestamp must never land in the future. */
const notAfterNow = (d: Date) => (d > NOW ? minutesAgo(3) : d);
/** Keep history inside the window the dashboards chart. */
const notBeforeGoLive = (d: Date) =>
  d < GO_LIVE ? at(GO_LIVE, 8, 30 + (d.getMinutes() % 25)) : d;
function nextWorkday(n: number) {
  let d = TODAY;
  let seen = 0;
  while (seen < n) {
    d = addDays(d, 1);
    if (isWorkday(d)) seen++;
  }
  return d;
}

// ─── sample documents ─────────────────────────────────────────────────────
// Booking documents normally live on Cloudinary. The demo serves small,
// clearly labelled PDFs from the API's own public upload route instead, so
// "Download" opens something on camera rather than a dead link.
const DOC_DIR = join(__dirname, '..', 'uploadedFiles', 'spaces');
const PUBLIC_BASE = (process.env.APP_PUBLIC_URL || 'http://localhost:6001').replace(/\/$/, '');

function clearSampleDocs() {
  if (!existsSync(DOC_DIR)) return;
  for (const f of readdirSync(DOC_DIR)) {
    if (f.startsWith('seed-')) unlinkSync(join(DOC_DIR, f));
  }
}

function pdfBytes(title: string, lines: string[]) {
  const clean = (s: string) =>
    s.replace(/[^\x20-\x7e]/g, '-').replace(/[\\()]/g, (c) => `\\${c}`);
  const ops = [
    '0.11 0.25 0.55 rg 0 762 595 80 re f',
    `BT /F2 18 Tf 1 1 1 rg 40 800 Td (${clean(title)}) Tj ET`,
    'BT /F1 10 Tf 0.85 0.9 1 rg 40 780 Td (LeaseManager - document on file) Tj ET',
  ];
  let y = 720;
  for (const line of lines) {
    ops.push(`BT /F1 12 Tf 0.12 0.12 0.12 rg 40 ${y} Td (${clean(line)}) Tj ET`);
    y -= 22;
  }
  ops.push('0.8 0.18 0.18 rg 40 84 515 28 re f');
  ops.push('BT /F2 11 Tf 1 1 1 rg 54 94 Td (SAMPLE - generated demo data, not a real document) Tj ET');
  const stream = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** Writes a sample PDF and returns the URL the API serves it from. */
function samplePdf(name: string, title: string, lines: string[]) {
  mkdirSync(DOC_DIR, { recursive: true });
  const file = `seed-${name.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.pdf`;
  writeFileSync(join(DOC_DIR, file), pdfBytes(title, lines));
  return `${PUBLIC_BASE}/public/spaces/${file}`;
}

// ─── wipe ─────────────────────────────────────────────────────────────────
/** Children first, parents last. */
async function wipe() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.report.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.maintenanceTicket.deleteMany(),
    prisma.bookingAddOn.deleteMany(),
    prisma.bookingApplicationAddOn.deleteMany(),
    prisma.bookingApplication.deleteMany(),
    prisma.bookingDocument.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.invoiceLine.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.leaseContract.deleteMany(),
    prisma.spaceAddOnService.deleteMany(),
    prisma.addOnService.deleteMany(),
    prisma.promotionCode.deleteMany(),
    prisma.spaceFeature.deleteMany(),
    prisma.space.deleteMany(),
    prisma.floor.deleteMany(),
    prisma.building.deleteMany(),
    prisma.tenantApplication.deleteMany(),
    prisma.tenantOnboardingSequence.deleteMany(),
    prisma.userSession.deleteMany(),
    prisma.user.deleteMany(),
    prisma.tenant.deleteMany(),
  ]);
}

// ─── the portfolio ────────────────────────────────────────────────────────

type SpaceType =
  | 'DEDICATED_OFFICE'
  | 'FLEXIBLE_DESK'
  | 'HOT_DESK'
  | 'MEETING_ROOM'
  | 'CONFERENCE_ROOM'
  | 'PHONE_BOOTH'
  | 'EVENT_SPACE';

/** One space on a floor plan: slug suffix, type, name, box on the 900×580 map. */
type Slot = {
  suffix: string;
  type: SpaceType;
  name: string;
  box: [number, number, number, number];
  exec?: boolean;
};

// Names stay within the 14 characters the floor map prints before truncating.
const officeFloor = (f: number, meeting: string): Slot[] => [
  { suffix: `${f}01`, type: 'DEDICATED_OFFICE', name: `Suite ${f}01`, box: [30, 30, 195, 150] },
  { suffix: `${f}02`, type: 'DEDICATED_OFFICE', name: `Suite ${f}02`, box: [240, 30, 195, 150] },
  { suffix: `${f}03`, type: 'DEDICATED_OFFICE', name: `Suite ${f}03`, box: [450, 30, 195, 150] },
  { suffix: `${f}04`, type: 'DEDICATED_OFFICE', name: `Suite ${f}04`, box: [660, 30, 210, 150] },
  { suffix: `${f}fa`, type: 'FLEXIBLE_DESK', name: `Flex Zone ${f}A`, box: [30, 205, 405, 150] },
  { suffix: `${f}h1`, type: 'HOT_DESK', name: `Hot Desk ${f}-01`, box: [450, 205, 150, 110] },
  { suffix: `${f}pa`, type: 'PHONE_BOOTH', name: `Booth ${f}A`, box: [450, 330, 150, 100] },
  { suffix: `${f}m1`, type: 'MEETING_ROOM', name: meeting, box: [615, 205, 255, 150] },
];

const coworkFloor = (f: number, meeting: string, conference: string): Slot[] => [
  { suffix: `${f}fa`, type: 'FLEXIBLE_DESK', name: `Flex Zone ${f}A`, box: [30, 30, 300, 150] },
  { suffix: `${f}fb`, type: 'FLEXIBLE_DESK', name: `Flex Zone ${f}B`, box: [345, 30, 300, 150] },
  { suffix: `${f}c1`, type: 'CONFERENCE_ROOM', name: conference, box: [660, 30, 210, 150] },
  { suffix: `${f}h1`, type: 'HOT_DESK', name: `Hot Desk ${f}-01`, box: [30, 205, 150, 110] },
  { suffix: `${f}h2`, type: 'HOT_DESK', name: `Hot Desk ${f}-02`, box: [195, 205, 150, 110] },
  { suffix: `${f}h3`, type: 'HOT_DESK', name: `Hot Desk ${f}-03`, box: [360, 205, 150, 110] },
  { suffix: `${f}m1`, type: 'MEETING_ROOM', name: meeting, box: [660, 205, 210, 150] },
  { suffix: `${f}pa`, type: 'PHONE_BOOTH', name: `Booth ${f}A`, box: [30, 340, 130, 100] },
  { suffix: `${f}pb`, type: 'PHONE_BOOTH', name: `Booth ${f}B`, box: [175, 340, 130, 100] },
];

const execFloor = (f: number, meeting: string, boardroom: string): Slot[] => [
  { suffix: `${f}01`, type: 'DEDICATED_OFFICE', name: `Suite ${f}01`, box: [30, 30, 260, 180], exec: true },
  { suffix: `${f}02`, type: 'DEDICATED_OFFICE', name: `Suite ${f}02`, box: [305, 30, 260, 180], exec: true },
  { suffix: `${f}03`, type: 'DEDICATED_OFFICE', name: `Suite ${f}03`, box: [580, 30, 290, 180], exec: true },
  { suffix: `${f}c1`, type: 'CONFERENCE_ROOM', name: boardroom, box: [30, 235, 320, 160] },
  { suffix: `${f}m1`, type: 'MEETING_ROOM', name: meeting, box: [365, 235, 220, 160] },
  { suffix: `${f}pa`, type: 'PHONE_BOOTH', name: `Booth ${f}A`, box: [600, 235, 140, 110] },
];

const groundFloor = (meetingA: string, meetingB: string, conference: string, event: string): Slot[] => [
  { suffix: 'ge1', type: 'EVENT_SPACE', name: event, box: [30, 30, 480, 230] },
  { suffix: 'gc1', type: 'CONFERENCE_ROOM', name: conference, box: [525, 30, 345, 150] },
  { suffix: 'gh1', type: 'HOT_DESK', name: 'Hot Desk G-01', box: [525, 205, 200, 120] },
  { suffix: 'gm1', type: 'MEETING_ROOM', name: meetingA, box: [30, 285, 220, 140] },
  { suffix: 'gm2', type: 'MEETING_ROOM', name: meetingB, box: [265, 285, 220, 140] },
];

type Landlord = {
  key: string;
  name: string;
  plan: string;
  monthsOnPlatform: number;
  city: string;
  cr: string;
  ipBase: string;
  priceFactor: number;
  staff: [role: string, local: string, first: string, last: string][];
  /** Categories each technician is strongest in — drives assignment history. */
  specialism: Record<string, string[]>;
};

const LANDLORDS: Landlord[] = [
  {
    key: 'msheireb',
    name: 'Msheireb Properties',
    plan: 'enterprise',
    monthsOnPlatform: 13,
    city: 'Doha',
    cr: '48211',
    ipBase: '203.0.113',
    priceFactor: 1,
    staff: [
      ['CLIENT_ADMIN', 'admin', 'Khalid', 'Al-Mansouri'],
      ['MANAGER', 'manager', 'Fatima', 'Al-Kuwari'],
      ['MANAGER', 'leasing', 'Yousef', 'Al-Obaidli'],
      ['FINANCE', 'finance', 'Omar', 'Haddad'],
      ['MAINTENANCE', 'tech', 'Rajesh', 'Nair'],
      ['MAINTENANCE', 'tech2', 'Joseph', 'Mensah'],
      ['MAINTENANCE', 'tech3', 'Bilal', 'Qureshi'],
      ['RECEPTIONIST', 'reception', 'Maria', 'Santos'],
      ['RECEPTIONIST', 'reception2', 'Grace', 'Okafor'],
    ],
    specialism: {
      tech: ['HVAC', 'ELECTRICAL'],
      tech2: ['PLUMBING', 'IT_EQUIPMENT'],
      tech3: ['FURNITURE', 'CLEANING', 'OTHER'],
    },
  },
  {
    key: 'west-bay',
    name: 'West Bay Offices',
    plan: 'pro',
    monthsOnPlatform: 11,
    city: 'Doha',
    cr: '51907',
    ipBase: '198.51.100',
    priceFactor: 1.08,
    staff: [
      ['CLIENT_ADMIN', 'admin', 'Abdulla', 'Al-Marri'],
      ['MANAGER', 'manager', 'Sara', 'Al-Emadi'],
      ['FINANCE', 'finance', 'Priya', 'Sharma'],
      ['MAINTENANCE', 'tech', 'Mohammed', 'Rafiq'],
      ['MAINTENANCE', 'tech2', 'Daniel', 'Okoro'],
      ['RECEPTIONIST', 'reception', 'Angela', 'Reyes'],
    ],
    specialism: {
      tech: ['HVAC', 'ELECTRICAL', 'OTHER'],
      tech2: ['PLUMBING', 'IT_EQUIPMENT', 'FURNITURE', 'CLEANING'],
    },
  },
  {
    key: 'lusail-hub',
    name: 'Lusail Business Hub',
    plan: 'basic',
    monthsOnPlatform: 8,
    city: 'Lusail',
    cr: '60358',
    ipBase: '192.0.2',
    priceFactor: 0.92,
    staff: [
      ['CLIENT_ADMIN', 'admin', 'Jassim', 'Al-Kaabi'],
      ['MANAGER', 'manager', 'Layla', 'Nasser'],
      ['FINANCE', 'finance', 'Tariq', 'Mahmoud'],
      ['MAINTENANCE', 'tech', 'Suresh', 'Pillai'],
      ['MAINTENANCE', 'tech2', 'Ahmed', 'Farouk'],
      ['RECEPTIONIST', 'reception', 'Joy', 'Mendoza'],
    ],
    specialism: {
      tech: ['HVAC', 'ELECTRICAL', 'PLUMBING'],
      tech2: ['IT_EQUIPMENT', 'FURNITURE', 'CLEANING', 'OTHER'],
    },
  },
];

type BuildingDef = {
  landlord: string;
  code: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  floorsTotal: number;
  built: number;
  area: number;
  transport: string;
  view: string;
  description: string;
  floors: { number: number; slots: Slot[] }[];
};

// Short slugs on purpose: the dashboards print a building's slug inside a
// 34-pixel badge, and real property managers use codes like these anyway.
const BUILDINGS: BuildingDef[] = [
  {
    landlord: 'msheireb',
    code: 'kbc',
    name: 'Al Kahraba Business Centre',
    address: 'Al Kahraba Street, Msheireb Downtown Doha',
    city: 'Doha',
    state: 'Doha',
    lat: 25.2878,
    lng: 51.5242,
    floorsTotal: 14,
    built: 2016,
    area: 9800,
    transport: 'Msheireb Metro (Red, Green & Gold lines) - 4 min walk. Visitor parking beneath Al Kahraba Street.',
    view: 'views over the Msheireb Downtown rooftops',
    description: 'Grade-A business centre on Al Kahraba Street, steps from Msheireb Metro: serviced offices on Level 3 and a coworking floor on Level 7.',
    floors: [
      { number: 3, slots: officeFloor(3, 'Zubarah Room') },
      { number: 7, slots: coworkFloor(7, 'Dukhan Room', 'Conference 7') },
    ],
  },
  {
    landlord: 'msheireb',
    code: 'swo',
    name: 'Sikkat Al Wadi Offices',
    address: 'Sikkat Al Wadi, Msheireb Downtown Doha',
    city: 'Doha',
    state: 'Doha',
    lat: 25.2851,
    lng: 51.5268,
    floorsTotal: 9,
    built: 2018,
    area: 6400,
    transport: 'Msheireb Metro - 6 min walk through the shaded sikka. Valet at the main entrance.',
    view: 'a calm courtyard outlook',
    description: 'Boutique office building on the pedestrian Sikkat Al Wadi. Level 7 reopened this season after a full refurbishment.',
    floors: [
      { number: 5, slots: officeFloor(5, 'Al Wakra Room') },
      { number: 7, slots: officeFloor(7, 'Al Ruwais Room') },
    ],
  },
  {
    landlord: 'msheireb',
    code: 'brt',
    name: 'Barahat Tower',
    address: 'Barahat Msheireb, Msheireb Downtown Doha',
    city: 'Doha',
    state: 'Doha',
    lat: 25.2864,
    lng: 51.5229,
    floorsTotal: 18,
    built: 2019,
    area: 12500,
    transport: 'Msheireb Metro - 3 min walk via Barahat Msheireb square. Basement parking with EV chargers.',
    view: 'views across Barahat Msheireb square',
    description: 'Landmark tower on Barahat Msheireb: an event floor at street level, offices on Level 9 and executive suites on Level 15.',
    floors: [
      { number: 0, slots: groundFloor('Al Khor Room', 'Fuwairit Room', 'Majlis Hall', 'Barahat Hall') },
      { number: 9, slots: officeFloor(9, 'Simaisma Room') },
      { number: 15, slots: execFloor(15, 'Umm Salal Room', 'Boardroom 15') },
    ],
  },
  {
    landlord: 'west-bay',
    code: 'ctw',
    name: 'Corniche Tower',
    address: 'Al Corniche Street, West Bay, Doha',
    city: 'Doha',
    state: 'Doha',
    lat: 25.3218,
    lng: 51.5306,
    floorsTotal: 32,
    built: 2012,
    area: 21000,
    transport: 'DECC Metro (Red line) - 7 min walk. Taxi rank and valet on the Corniche side.',
    view: 'Corniche and Doha Bay views',
    description: 'Glass tower on the West Bay Corniche: serviced offices on Level 12 and an executive floor with a sky lounge on Level 25.',
    floors: [
      { number: 12, slots: officeFloor(12, 'Corniche Room') },
      {
        number: 25,
        slots: [
          ...execFloor(25, 'Katara Room', 'Boardroom 25'),
          { suffix: '25e1', type: 'EVENT_SPACE', name: 'Sky Lounge', box: [30, 420, 420, 140] },
        ],
      },
    ],
  },
  {
    landlord: 'west-bay',
    code: 'dbh',
    name: 'Dafna Business Hub',
    address: 'Omar Al Mukhtar Street, Al Dafna, Doha',
    city: 'Doha',
    state: 'Doha',
    lat: 25.3262,
    lng: 51.5271,
    floorsTotal: 22,
    built: 2015,
    area: 14200,
    transport: 'DECC Metro - 8 min walk. Multi-storey car park next door.',
    view: 'West Bay skyline views',
    description: 'Business hub in Al Dafna with a coworking floor on Level 4 and private offices on Level 10.',
    floors: [
      { number: 4, slots: coworkFloor(4, 'Al Dafna Room', 'Conference 4') },
      { number: 10, slots: officeFloor(10, 'Al Bidda Room') },
    ],
  },
  {
    landlord: 'lusail-hub',
    code: 'm21',
    name: 'Marina Twenty-One',
    address: 'Marina District, Lusail City',
    city: 'Lusail',
    state: 'Al Daayen',
    lat: 25.3869,
    lng: 51.5201,
    floorsTotal: 28,
    built: 2021,
    area: 18000,
    transport: 'Lusail QNB Metro (Red line) - 5 min walk. Marina promenade parking.',
    view: 'Lusail Marina views',
    description: 'Waterfront tower in Lusail Marina: events and meetings at street level, private offices on Level 14 and a new coworking floor on Level 20.',
    floors: [
      { number: 0, slots: groundFloor('Marina Room', 'Qetaifan Room', 'Erkyah Hall', 'Skyline Hall') },
      { number: 14, slots: officeFloor(14, 'Seef Room') },
      { number: 20, slots: coworkFloor(20, 'Wadi Room', 'Conference 20') },
    ],
  },
  {
    landlord: 'lusail-hub',
    code: 'fhw',
    name: 'Fox Hills Workspace',
    address: 'Fox Hills, Lusail City',
    city: 'Lusail',
    state: 'Al Daayen',
    lat: 25.4276,
    lng: 51.4932,
    floorsTotal: 6,
    built: 2022,
    area: 4800,
    transport: 'Lusail Tram (Fox Hills stop) - 2 min walk. Free surface parking.',
    view: 'green Fox Hills park views',
    description: 'Low-rise workspace in Fox Hills built for start-ups: a coworking floor on Level 1 and small offices on Level 3.',
    floors: [
      { number: 1, slots: coworkFloor(1, 'Fox Hills Room', 'Conference 1') },
      { number: 3, slots: officeFloor(3, 'Boulevard Room') },
    ],
  },
];

type RenterDef = {
  slug: string;
  name: string;
  domain: string;
  sector: string;
  headcount: number;
  plan: string;
  status?: string;
  /** local part of the e-mail, first name, last name — the first is the admin */
  people: [string, string, string][];
};

// The first six keep the names and logins the README and demo script use.
const RENTERS: RenterDef[] = [
  { slug: 'acme-corp', name: 'Acme Corp', domain: 'acme-corp.test', sector: 'Software & cloud services', headcount: 28, plan: 'pro',
    people: [['tenant.admin', 'Noor', 'Al-Hajri'], ['employee', 'Karim', 'Saad'], ['ana.lopes', 'Ana', 'Lopes'], ['vikram.rao', 'Vikram', 'Rao'], ['hessa.alnaimi', 'Hessa', 'Al-Naimi']] },
  { slug: 'qatar-fintech', name: 'Qatar Fintech', domain: 'qfintech.test', sector: 'Financial technology', headcount: 35, plan: 'pro',
    people: [['tenant.admin', 'Ahmed', 'Al-Sulaiti'], ['employee', 'Rania', 'Khoury'], ['james.whitfield', 'James', 'Whitfield'], ['mariam.alkhater', 'Mariam', 'Al-Khater'], ['sanjay.iyer', 'Sanjay', 'Iyer']] },
  { slug: 'gulf-consulting', name: 'Gulf Consulting', domain: 'gulfco.test', sector: 'Management consulting', headcount: 18, plan: 'basic',
    people: [['tenant.admin', 'Omar', 'Shehadeh'], ['employee', 'Lina', 'Sabbagh'], ['thomas.weber', 'Thomas', 'Weber']] },
  { slug: 'doha-design', name: 'Doha Design Studio', domain: 'dohadesign.test', sector: 'Architecture & interior design', headcount: 12, plan: 'basic',
    people: [['tenant.admin', 'Sara', 'Al-Mohannadi'], ['employee', 'Marco', 'Bianchi'], ['aisha.rahman', 'Aisha', 'Rahman']] },
  { slug: 'pearl-logistics', name: 'Pearl Logistics', domain: 'pearllog.test', sector: 'Freight & logistics', headcount: 22, plan: 'pro',
    people: [['tenant.admin', 'Yousef', 'Al-Baker'], ['employee', 'Deepak', 'Menon'], ['chen.wei', 'Chen', 'Wei'], ['fatma.yilmaz', 'Fatma', 'Yilmaz']] },
  { slug: 'al-rayyan-legal', name: 'Al Rayyan Legal', domain: 'arlegal.test', sector: 'Legal services', headcount: 9, plan: 'basic', status: 'TRIAL',
    people: [['tenant.admin', 'Layla', 'Al-Sada'], ['employee', 'Hassan', 'Mourad']] },
  { slug: 'sidra-data-labs', name: 'Sidra Data Labs', domain: 'sidralabs.test', sector: 'Data & AI', headcount: 16, plan: 'pro',
    people: [['tenant.admin', 'Dana', 'Al-Khulaifi'], ['employee', 'Arjun', 'Patel'], ['sofia.martins', 'Sofia', 'Martins'], ['kareem.hamdan', 'Kareem', 'Hamdan']] },
  { slug: 'najd-advisory', name: 'Najd Advisory', domain: 'najd-advisory.test', sector: 'Corporate finance advisory', headcount: 7, plan: 'basic',
    people: [['tenant.admin', 'Faisal', 'Al-Shammari'], ['employee', 'Nadia', 'Fares']] },
  { slug: 'al-jasra-engineering', name: 'Al Jasra Engineering', domain: 'aljasra.test', sector: 'Engineering consultancy', headcount: 24, plan: 'pro',
    people: [['tenant.admin', 'Hamad', 'Al-Malki'], ['employee', 'Pradeep', 'Kumar'], ['elena.popescu', 'Elena', 'Popescu'], ['mohammed.alamri', 'Mohammed', 'Al-Amri']] },
  { slug: 'falcon-media', name: 'Falcon Media House', domain: 'falconmedia.test', sector: 'Media production', headcount: 14, plan: 'basic',
    people: [['tenant.admin', 'Reem', 'Al-Sayed'], ['employee', 'Jake', 'Turner'], ['amine.benali', 'Amine', 'Benali']] },
  { slug: 'qitaf-pharma', name: 'Qitaf Pharma Distribution', domain: 'qitaf.test', sector: 'Pharmaceutical distribution', headcount: 20, plan: 'pro',
    people: [['tenant.admin', 'Khalifa', 'Al-Dosari'], ['employee', 'Meera', 'Shetty'], ['john.mwangi', 'John', 'Mwangi']] },
  { slug: 'brightpath-training', name: 'Brightpath Training Institute', domain: 'brightpath.test', sector: 'Professional training', headcount: 10, plan: 'basic',
    people: [['tenant.admin', 'Hala', 'Saleh'], ['employee', 'Ryan', 'Fernandes']] },
  { slug: 'dhow-capital', name: 'Dhow Capital Partners', domain: 'dhowcapital.test', sector: 'Investment management', headcount: 11, plan: 'pro',
    people: [['tenant.admin', 'Nasser', 'Al-Rumaihi'], ['employee', 'Charlotte', 'Evans'], ['rashid.alansari', 'Rashid', 'Al-Ansari']] },
  { slug: 'sealine-energy', name: 'Sealine Energy Services', domain: 'sealine.test', sector: 'Energy services', headcount: 19, plan: 'pro',
    people: [['tenant.admin', 'Majid', 'Al-Hammadi'], ['employee', 'Ivan', 'Petrov'], ['grace.liu', 'Grace', 'Liu']] },
  { slug: 'mawared-hr', name: 'Mawared HR Solutions', domain: 'mawared-hr.test', sector: 'HR & recruitment', headcount: 13, plan: 'basic',
    people: [['tenant.admin', 'Asma', 'Al-Jaber'], ['employee', 'Rohan', 'Desai'], ['hiba.khalil', 'Hiba', 'Khalil']] },
  { slug: 'sadeem-robotics', name: 'Sadeem Robotics', domain: 'sadeem.test', sector: 'Robotics & automation', headcount: 15, plan: 'basic',
    people: [['tenant.admin', 'Saif', 'Al-Hitmi'], ['employee', 'Lucas', 'Moreau'], ['nora.ahmed', 'Nora', 'Ahmed']] },
  { slug: 'zubarah-travel', name: 'Zubarah Travel & Tours', domain: 'zubarahtravel.test', sector: 'Travel & tourism', headcount: 8, plan: 'basic',
    people: [['tenant.admin', 'Mona', 'Al-Rashid'], ['employee', 'Paolo', 'Cruz']] },
  { slug: 'oryx-software', name: 'Oryx Software', domain: 'oryxsoft.test', sector: 'Software development', headcount: 30, plan: 'pro',
    people: [['tenant.admin', 'Ali', 'Al-Ghanim'], ['employee', 'Priyanka', 'Joshi'], ['tom.harris', 'Tom', 'Harris'], ['salma.idris', 'Salma', 'Idris'], ['ben.adeyemi', 'Ben', 'Adeyemi']] },
  { slug: 'qamar-education', name: 'Qamar Education Centre', domain: 'qamar-edu.test', sector: 'Education & tutoring', headcount: 9, plan: 'basic',
    people: [['tenant.admin', 'Huda', 'Al-Fadala'], ['employee', 'Samir', 'Aoun']] },
  { slug: 'gharafa-trading', name: 'Gharafa Trading', domain: 'gharafa-trading.test', sector: 'General trading', headcount: 4, plan: 'basic', status: 'CLOSED',
    people: [['tenant.admin', 'Salem', 'Al-Marzouqi']] },
];

type Payer = 'pdc' | 'prompt' | 'late' | 'struggling';

type LeaseDef = {
  renter: string;
  landlord: string;
  spaces: string[];
  /** month offset of the first day, relative to the current month */
  start: number;
  term: number;
  status: 'ACTIVE' | 'RENEWED' | 'EXPIRED' | 'TERMINATED';
  /** RENEWED: month offset the lease now runs to */
  renewTo?: number;
  /** TERMINATED: month offset of the last billed month */
  endedAt?: number;
  /**
   * pdc = post-dated cheques cashed on the 1st; prompt = transfer within a
   * week; late = pays around the due date; struggling = arrears.
   */
  payer: Payer;
  addons?: [string, number][];
  promo?: string;
};

const LEASES: LeaseDef[] = [
  // Msheireb Properties
  { renter: 'acme-corp', landlord: 'msheireb', spaces: ['kbc-301', 'kbc-302', 'kbc-3fa', 'kbc-3h1'], start: -11, term: 24, status: 'ACTIVE', payer: 'pdc',
    addons: [['Covered parking bay', 3], ['Daily office cleaning', 1], ['Dedicated IT support', 1]] },
  { renter: 'sidra-data-labs', landlord: 'msheireb', spaces: ['kbc-7fa', 'kbc-7fb', 'kbc-7h1'], start: -4, term: 12, status: 'ACTIVE', payer: 'prompt',
    addons: [['Personal locker', 4], ['Meeting room credits (10 h)', 1]], promo: 'WELCOME10' },
  { renter: 'doha-design', landlord: 'msheireb', spaces: ['swo-501', 'swo-5fa'], start: -8, term: 12, status: 'ACTIVE', payer: 'pdc',
    addons: [['Covered parking bay', 1], ['Daily office cleaning', 1]] },
  { renter: 'najd-advisory', landlord: 'msheireb', spaces: ['swo-503', 'swo-5h1'], start: 0, term: 12, status: 'ACTIVE', payer: 'late',
    addons: [['Business address registration', 1]] },
  { renter: 'al-jasra-engineering', landlord: 'msheireb', spaces: ['brt-1501', 'brt-1502'], start: -10, term: 12, status: 'ACTIVE', payer: 'pdc',
    addons: [['Covered parking bay', 4], ['Daily office cleaning', 1]] },
  { renter: 'falcon-media', landlord: 'msheireb', spaces: ['brt-901', 'brt-9h1'], start: -6, term: 6, status: 'RENEWED', renewTo: 5, payer: 'struggling',
    addons: [['Covered parking bay', 1]] },
  { renter: 'qitaf-pharma', landlord: 'msheireb', spaces: ['brt-902', 'brt-903', 'brt-9fa'], start: -5, term: 18, status: 'ACTIVE', payer: 'prompt',
    addons: [['Covered parking bay', 2], ['Mail & courier handling', 1]] },
  { renter: 'qatar-fintech', landlord: 'msheireb', spaces: ['kbc-7h2', 'kbc-7h3'], start: -1, term: 12, status: 'ACTIVE', payer: 'prompt' },
  { renter: 'brightpath-training', landlord: 'msheireb', spaces: ['brt-1503'], start: -7, term: 12, status: 'ACTIVE', payer: 'late',
    addons: [['Covered parking bay', 2]] },
  { renter: 'gulf-consulting', landlord: 'msheireb', spaces: ['swo-502'], start: -14, term: 12, status: 'EXPIRED', payer: 'pdc' },
  // West Bay Offices
  { renter: 'qatar-fintech', landlord: 'west-bay', spaces: ['ctw-1201', 'ctw-1202', 'ctw-12fa'], start: -12, term: 12, status: 'RENEWED', renewTo: 11, payer: 'pdc',
    addons: [['Covered parking bay', 4], ['Daily office cleaning', 1], ['Dedicated IT support', 1]] },
  { renter: 'dhow-capital', landlord: 'west-bay', spaces: ['ctw-2501'], start: -9, term: 24, status: 'ACTIVE', payer: 'pdc',
    addons: [['Covered parking bay', 2], ['Daily office cleaning', 1]] },
  { renter: 'sealine-energy', landlord: 'west-bay', spaces: ['ctw-2502', 'ctw-1203'], start: -11, term: 12, status: 'ACTIVE', payer: 'late',
    addons: [['Covered parking bay', 2]] },
  { renter: 'pearl-logistics', landlord: 'west-bay', spaces: ['dbh-1001', 'dbh-10fa'], start: -7, term: 12, status: 'ACTIVE', payer: 'prompt',
    addons: [['Mail & courier handling', 1]] },
  { renter: 'mawared-hr', landlord: 'west-bay', spaces: ['dbh-1002', 'dbh-4h2', 'dbh-4h3'], start: -5, term: 12, status: 'ACTIVE', payer: 'pdc',
    addons: [['Personal locker', 2]] },
  { renter: 'sadeem-robotics', landlord: 'west-bay', spaces: ['dbh-4fa', 'dbh-4fb', 'dbh-4h1'], start: -3, term: 12, status: 'ACTIVE', payer: 'struggling',
    addons: [['Personal locker', 3]], promo: 'SUMMER25' },
  // Lusail Business Hub
  { renter: 'gulf-consulting', landlord: 'lusail-hub', spaces: ['m21-1401', 'm21-1402'], start: -2, term: 24, status: 'ACTIVE', payer: 'pdc',
    addons: [['Covered parking bay', 3], ['Daily office cleaning', 1]], promo: 'WELCOME10' },
  { renter: 'al-rayyan-legal', landlord: 'lusail-hub', spaces: ['m21-1403', 'm21-14h1'], start: -1, term: 12, status: 'ACTIVE', payer: 'prompt', promo: 'LUSAIL30' },
  { renter: 'qamar-education', landlord: 'lusail-hub', spaces: ['m21-1404', 'm21-14fa'], start: -4, term: 6, status: 'ACTIVE', payer: 'late' },
  { renter: 'oryx-software', landlord: 'lusail-hub', spaces: ['fhw-1fa', 'fhw-1fb', 'fhw-1h1'], start: -8, term: 12, status: 'ACTIVE', payer: 'pdc',
    addons: [['Covered parking bay', 3], ['Personal locker', 4]] },
  { renter: 'zubarah-travel', landlord: 'lusail-hub', spaces: ['fhw-301', 'fhw-3fa', 'fhw-3h1'], start: -7, term: 12, status: 'ACTIVE', payer: 'prompt',
    addons: [['Mail & courier handling', 1]] },
  { renter: 'pearl-logistics', landlord: 'lusail-hub', spaces: ['fhw-1h2', 'fhw-1h3'], start: -5, term: 12, status: 'TERMINATED', endedAt: -2, payer: 'prompt' },
  { renter: 'gharafa-trading', landlord: 'lusail-hub', spaces: ['m21-gh1'], start: -6, term: 3, status: 'EXPIRED', payer: 'late' },
];

type PipelineDef = {
  landlord: string;
  space: string;
  stage: 'PENDING_PHONE_CONFIRMATION' | 'AWAITING_PHYSICAL_VISIT' | 'DOCUMENTS_PENDING_UPLOAD' | 'ACTIVE';
  /** A guest applicant becomes a new TRIAL organisation when accepted… */
  org?: { slug: string; name: string; domain: string; sector: string; headcount: number; admin: [string, string] };
  /** …while an existing renter applies through the portal. */
  renter?: string;
  appliedDaysAgo: number;
  decidedDaysAgo: number;
  months: number;
  use: string;
  message: string;
  addons: [string, number][];
  docs?: string[];
};

// Accepted booking applications at each stage of the reception workflow.
const PIPELINE: PipelineDef[] = [
  { landlord: 'msheireb', space: 'kbc-303', stage: 'PENDING_PHONE_CONFIRMATION',
    org: { slug: 'wakra-coffee', name: 'Wakra Coffee Roasters', domain: 'wakracoffee.test', sector: 'Specialty coffee', headcount: 6, admin: ['Abdulrahman', 'Al-Kubaisi'] },
    appliedDaysAgo: 4, decidedDaysAgo: 1, months: 12, use: 'Head office for the roastery team',
    message: 'We would like to move in on the 1st. Parking for two cars if possible.', addons: [['Covered parking bay', 2]] },
  { landlord: 'msheireb', space: 'swo-504', stage: 'PENDING_PHONE_CONFIRMATION',
    org: { slug: 'hilal-insurance', name: 'Hilal Insurance Brokers', domain: 'hilal-ib.test', sector: 'Insurance brokerage', headcount: 5, admin: ['Samira', 'Darwish'] },
    appliedDaysAgo: 2, decidedDaysAgo: 0, months: 24, use: 'Client-facing brokerage office',
    message: 'Two-year term preferred. Could we view the suite this week?', addons: [['Mail & courier handling', 1]] },
  { landlord: 'msheireb', space: 'brt-904', stage: 'AWAITING_PHYSICAL_VISIT',
    org: { slug: 'simaisma-surveying', name: 'Simaisma Surveying', domain: 'simaisma-survey.test', sector: 'Land surveying', headcount: 7, admin: ['Fahad', 'Al-Yafei'] },
    appliedDaysAgo: 9, decidedDaysAgo: 6, months: 12, use: 'Survey team office and plotting room',
    message: 'We need room for a large-format plotter.', addons: [] },
  { landlord: 'msheireb', space: 'kbc-304', stage: 'DOCUMENTS_PENDING_UPLOAD',
    org: { slug: 'rumaila-consulting', name: 'Rumaila Consulting Group', domain: 'rumaila.test', sector: 'Strategy consulting', headcount: 8, admin: ['Nadine', 'Saab'] },
    appliedDaysAgo: 15, decidedDaysAgo: 12, months: 12, use: 'Consulting team base in Msheireb',
    message: 'Signed lease handed over at the visit.', addons: [['Covered parking bay', 1], ['Daily office cleaning', 1]],
    docs: ['cr_copy', 'qid_copy', 'signed_lease_contract'] },
  { landlord: 'west-bay', space: 'dbh-1003', stage: 'PENDING_PHONE_CONFIRMATION',
    org: { slug: 'rawda-dental', name: 'Rawda Dental Lab', domain: 'rawdadental.test', sector: 'Dental laboratory', headcount: 4, admin: ['Waleed', 'Hassan'] },
    appliedDaysAgo: 3, decidedDaysAgo: 1, months: 12, use: 'Admin and billing office for the lab',
    message: 'Office use only - no clinical work on site.', addons: [] },
  { landlord: 'west-bay', space: 'ctw-1204', stage: 'DOCUMENTS_PENDING_UPLOAD',
    org: { slug: 'corniche-yachts', name: 'Corniche Yacht Charters', domain: 'cornicheyachts.test', sector: 'Marine leisure', headcount: 6, admin: ['Michael', 'Grant'] },
    appliedDaysAgo: 13, decidedDaysAgo: 10, months: 12, use: 'Sales office facing the Corniche',
    message: 'Lease signature pending our board - documents to follow.', addons: [['Covered parking bay', 2]],
    docs: ['cr_copy', 'qid_copy'] },
  { landlord: 'west-bay', space: 'ctw-2503', stage: 'ACTIVE',
    org: { slug: 'al-bidda-advisory', name: 'Al Bidda Advisory', domain: 'albidda-advisory.test', sector: 'Tax & zakat advisory', headcount: 9, admin: ['Lulwa', 'Al-Nuaimi'] },
    appliedDaysAgo: 27, decidedDaysAgo: 24, months: 24, use: 'Executive office for the partners',
    message: 'Moving from Al Sadd - we need the suite from the 1st.', addons: [['Covered parking bay', 3], ['Daily office cleaning', 1]],
    docs: ['cr_copy', 'qid_copy', 'trade_license', 'signed_lease_contract', 'payment_proof'] },
  { landlord: 'lusail-hub', space: 'fhw-304', stage: 'PENDING_PHONE_CONFIRMATION',
    org: { slug: 'qetaifan-realty', name: 'Qetaifan Realty', domain: 'qetaifan-realty.test', sector: 'Real estate brokerage', headcount: 5, admin: ['Bader', 'Al-Mannai'] },
    appliedDaysAgo: 2, decidedDaysAgo: 0, months: 12, use: 'Brokerage office close to the Lusail projects',
    message: 'Please call after 2 pm.', addons: [] },
  { landlord: 'lusail-hub', space: 'fhw-303', stage: 'AWAITING_PHYSICAL_VISIT',
    org: { slug: 'bluefin-marine', name: 'Bluefin Marine Services', domain: 'bluefin-marine.test', sector: 'Marine services', headcount: 6, admin: ['Erik', 'Lindqvist'] },
    appliedDaysAgo: 8, decidedDaysAgo: 5, months: 12, use: 'Operations office for the marina crew',
    message: 'We will bring the first cheque to the visit.', addons: [['Covered parking bay', 1]] },
  { landlord: 'lusail-hub', space: 'fhw-302', stage: 'ACTIVE', renter: 'oryx-software',
    appliedDaysAgo: 30, decidedDaysAgo: 26, months: 12, use: 'Second office for the mobile team',
    message: 'Expansion next to our Level 1 team zones.', addons: [], docs: ['signed_lease_contract', 'payment_proof'] },
];

type OpenAppDef = {
  landlord: string;
  space: string;
  guest?: [first: string, last: string, domain: string];
  company?: string;
  /** an existing renter applying through the portal: [renter slug, local part] */
  user?: [string, string];
  months: number;
  headcount: number;
  use: string;
  message: string;
  daysAgo: number;
  addons?: [string, number][];
  refused?: { daysAgo: number; reason: string };
};

const OPEN_APPLICATIONS: OpenAppDef[] = [
  { landlord: 'msheireb', space: 'swo-502', guest: ['Mohammed', 'Al-Shahwani', 'shahwani-trading.test'], company: 'Shahwani Trading',
    months: 12, headcount: 5, use: 'Regional sales office', message: 'Ready to sign quickly - can we view the suite this week?', daysAgo: 1,
    addons: [['Covered parking bay', 2]] },
  { landlord: 'msheireb', space: 'swo-502', guest: ['Sophie', 'Laurent', 'laurent-parfums.test'], company: 'Laurent Parfums',
    months: 6, headcount: 3, use: 'Back office for our Doha boutiques', message: 'Six months to start, with an option to extend.', daysAgo: 3 },
  { landlord: 'msheireb', space: 'swo-701', guest: ['Hessa', 'Al-Kuwari', 'kuwari-studio.test'], company: 'Kuwari Studio',
    months: 12, headcount: 4, use: 'Photography studio office', message: 'Loved the refurbished floor - is Suite 701 still free?', daysAgo: 0 },
  { landlord: 'msheireb', space: 'brt-gh1', user: ['acme-corp', 'tenant.admin'],
    months: 3, headcount: 1, use: 'Desk for a new hire near a client site', message: 'Starting on the 1st, month to month afterwards.', daysAgo: 2,
    addons: [['Personal locker', 1]] },
  { landlord: 'west-bay', space: 'dbh-1004', guest: ['Hamza', 'Qureshi', 'qtech-services.test'], company: 'QTech Services',
    months: 12, headcount: 6, use: 'IT services team office', message: 'We need fibre and access to the server closet.', daysAgo: 1,
    addons: [['Dedicated IT support', 1]] },
  { landlord: 'west-bay', space: 'ctw-12h1', guest: ['Elena', 'Rossi', 'mail.test'],
    months: 3, headcount: 1, use: 'Freelance design work', message: 'Weekday mornings mostly.', daysAgo: 4 },
  { landlord: 'west-bay', space: 'dbh-10h1', user: ['mawared-hr', 'tenant.admin'],
    months: 6, headcount: 1, use: 'Extra recruiter seat for the hiring season', message: 'Next to our Level 4 desks if possible.', daysAgo: 2 },
  { landlord: 'lusail-hub', space: 'm21-20fa', guest: ['Karim', 'Boukhari', 'boukhari-consult.test'], company: 'Boukhari Consulting',
    months: 6, headcount: 4, use: 'Consulting team base in Lusail', message: 'Can we start mid-month?', daysAgo: 2,
    addons: [['Personal locker', 4]] },
  { landlord: 'lusail-hub', space: 'm21-gh1', guest: ['Mariam', 'Saleh', 'mail.test'],
    months: 1, headcount: 1, use: 'Remote work from Lusail', message: 'Trying it out for a month first.', daysAgo: 5 },
  // already decided
  { landlord: 'msheireb', space: 'kbc-304', guest: ['Tarek', 'Ghanem', 'ghanem-events.test'], company: 'Ghanem Events',
    months: 12, headcount: 12, use: 'Event planning office', message: '', daysAgo: 20,
    refused: { daysAgo: 18, reason: 'Requested 12 seats - Suite 304 is laid out for far fewer.' } },
  { landlord: 'west-bay', space: 'ctw-2503', guest: ['Lara', 'Nassif', 'nassif-law.test'], company: 'Nassif Law',
    months: 12, headcount: 8, use: 'Law office', message: '', daysAgo: 30,
    refused: { daysAgo: 26, reason: 'Suite already committed to another applicant.' } },
  { landlord: 'lusail-hub', space: 'fhw-302', guest: ['Omar', 'Kassem', 'kassem-trading.test'], company: 'Kassem Trading',
    months: 6, headcount: 4, use: 'Trading office', message: '', daysAgo: 33,
    refused: { daysAgo: 31, reason: 'Incomplete company documents - CR copy missing.' } },
];

// Typeform applicants still waiting for a property manager's decision. Each
// is an organisation left at PENDING with no users — approving one is what
// creates its first TENANT_ADMIN (TenantApplicationService.approve).
const PROSPECTS = [
  { slug: 'najma-architects', name: 'Najma Architects', landlord: 'msheireb', space: 'swo-702', sector: 'Architecture', headcount: 14, contact: ['Rana', 'Al-Hashimi'], daysAgo: 1 },
  { slug: 'souq-digital', name: 'Souq Digital', landlord: 'west-bay', space: 'dbh-1004', sector: 'E-commerce marketing', headcount: 9, contact: ['Fadi', 'Karam'], daysAgo: 2 },
  { slug: 'corniche-capital', name: 'Corniche Capital', landlord: 'lusail-hub', space: 'm21-20fb', sector: 'Investment', headcount: 22, contact: ['Mahmoud', 'Al-Sharif'], daysAgo: 4 },
  { slug: 'barwa-translation', name: 'Barwa Translation', landlord: 'msheireb', space: 'swo-7fa', sector: 'Language services', headcount: 6, contact: ['Iman', 'Fakhro'], daysAgo: 5 },
  { slug: 'katara-media', name: 'Katara Media', landlord: 'west-bay', space: 'ctw-12h1', sector: 'Media production', headcount: 18, contact: ['Ziad', 'Mattar'], daysAgo: 6 },
  { slug: 'doha-dental', name: 'Doha Dental Group', landlord: 'lusail-hub', space: 'fhw-1h3', sector: 'Healthcare', headcount: 11, contact: ['Ayesha', 'Siddiqui'], daysAgo: 8 },
] as const;

// ─── space content ────────────────────────────────────────────────────────
const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const PHOTOS: Record<SpaceType, string[]> = {
  DEDICATED_OFFICE: ['1577412647305-991150c7d163', '1497366216548-37526070297c', '1497366811353-6870744d04b2', '1600508774634-4e11d34730e2', '1564069114553-7215e1ff1890', '1524758631624-e2822e304c36'].map(U),
  FLEXIBLE_DESK: ['1504384308090-c894fdcc538d', '1559136555-9303baea8ebd', '1606857521015-7f9fcf423740', '1522071820081-009f0129c71c', '1519389950473-47ba0277781c'].map(U),
  HOT_DESK: ['1497215728101-856f4ea42174', '1527192491265-7e15c55b1ed2', '1568992687947-868a62a9f521', '1497032628192-86f99bcd76bc'].map(U),
  MEETING_ROOM: ['1517502884422-41eaead166d4', '1462826303086-329426d1aef5', '1542744173-8e7e53415bb0', '1556761175-5973dc0f32e7'].map(U),
  CONFERENCE_ROOM: ['1431540015161-0bf868a2d407', '1462826303086-329426d1aef5', '1542744173-8e7e53415bb0'].map(U),
  PHONE_BOOTH: ['1593642632559-0c6d3fc62b89', '1497032628192-86f99bcd76bc', '1524758631624-e2822e304c36'].map(U),
  EVENT_SPACE: ['1511578314322-379afb476865', '1540575467063-178a50c2df87', '1515169067868-5387ec356754', '1528605248644-14dd04022da1', '1505409859467-3a796fd5798e'].map(U),
};

const FEATURES: Record<SpaceType, string[]> = {
  DEDICATED_OFFICE: ['Lockable glass-front office', 'Ergonomic chairs', 'Fibre internet (1 Gbps)', '24/7 keycard access', 'Floor-to-ceiling windows', 'Kitchenette access', 'Daily cleaning'],
  FLEXIBLE_DESK: ['Team zone with lockers', 'Fibre internet (1 Gbps)', 'Ergonomic chairs', 'Shared printer', 'Kitchenette access', 'Natural light'],
  HOT_DESK: ['Open lounge seating', 'Fibre internet (1 Gbps)', 'Lockers available', 'Arabic coffee & tea', 'Natural light'],
  MEETING_ROOM: ['65" display with wireless casting', 'Video conferencing (Teams / Zoom)', 'Whiteboard wall', 'Natural light', 'Catering on request'],
  CONFERENCE_ROOM: ['Boardroom table', 'Dual 75" displays', 'Ceiling microphones', 'Video conferencing (Teams / Zoom)', 'Catering on request', 'Acoustic panels'],
  PHONE_BOOTH: ['Acoustic insulation', 'Power & USB-C', 'Quiet ventilation', 'Adjustable lighting'],
  EVENT_SPACE: ['Stage & lighting rig', 'PA system with wireless mics', 'Projector & 4K screen', 'Theatre or banquet layout', 'Catering kitchen', 'Covered drop-off'],
};

/** Capacity, floor area and price follow from what a space is. Rents in QAR. */
function profileFor(slot: Slot, slug: string, factor: number) {
  const r = keyed(`space:${slug}`);
  const p = (n: number, step: number) => roundTo(n * factor, step);
  switch (slot.type) {
    case 'DEDICATED_OFFICE': {
      const area = slot.exec ? between(r, 80, 140) : between(r, 32, 68);
      const capacity = Math.max(3, Math.round(area / (slot.exec ? 7.5 : 5.5)));
      const monthly = p(area * between(r, slot.exec ? 240 : 205, slot.exec ? 280 : 250), 100);
      return { capacity, area, monthly, daily: roundTo(monthly / 18, 10), hourly: roundTo(monthly / 140, 5) };
    }
    case 'FLEXIBLE_DESK': {
      const capacity = between(r, 4, 8);
      const monthly = p(capacity * between(r, 980, 1150), 100);
      return { capacity, area: capacity * between(r, 5, 6), monthly, daily: roundTo(monthly / 16, 10), hourly: roundTo(monthly / 110, 5) };
    }
    case 'HOT_DESK': {
      const daily = p(between(r, 11, 15) * 10, 5);
      return { capacity: 1, area: between(r, 5, 7), monthly: roundTo(daily * 13, 50), daily, hourly: roundTo(daily / 5, 5) };
    }
    // Shared rooms are booked by the hour; the public map is for leases, so
    // they carry no monthly rate and are not published there.
    case 'MEETING_ROOM': {
      const hourly = p(between(r, 14, 26) * 10, 5);
      return { capacity: between(r, 6, 10), area: between(r, 18, 32), hourly, daily: roundTo(hourly * 6.5, 50), monthly: null };
    }
    case 'CONFERENCE_ROOM': {
      const hourly = p(between(r, 32, 60) * 10, 5);
      return { capacity: between(r, 14, 24), area: between(r, 45, 80), hourly, daily: roundTo(hourly * 6.5, 50), monthly: null };
    }
    case 'PHONE_BOOTH': {
      const hourly = p(between(r, 6, 9) * 5, 5);
      return { capacity: between(r, 1, 2), area: between(r, 3, 5), hourly, daily: hourly * 6, monthly: null };
    }
    case 'EVENT_SPACE': {
      const hourly = p(between(r, 9, 16) * 100, 50);
      return { capacity: between(r, 80, 150), area: between(r, 180, 320), hourly, daily: roundTo(hourly * 7.5, 500), monthly: null };
    }
  }
}

function describe(slot: Slot, b: BuildingDef, capacity: number, floorName: string) {
  switch (slot.type) {
    case 'DEDICATED_OFFICE':
      return slot.exec
        ? `Executive suite for up to ${capacity} on ${floorName} of ${b.name}, with a private meeting corner, reception area and ${b.view}.`
        : `Private ${capacity}-person office on ${floorName} of ${b.name}: furnished desks, lockable storage and ${b.view}. Ready to move in.`;
    case 'FLEXIBLE_DESK':
      return `Team zone for ${capacity} with dedicated desks and lockers, plus access to the kitchenette and meeting rooms of ${b.name}.`;
    case 'HOT_DESK':
      return 'Flexible seat in the open lounge - by the day or the month. Fibre internet, Arabic coffee and printing included.';
    case 'MEETING_ROOM':
      return `Meeting room for up to ${capacity} with a 65" screen, wireless casting and video conferencing.`;
    case 'CONFERENCE_ROOM':
      return `Conference room for up to ${capacity}: dual screens, ceiling microphones and catering on request.`;
    case 'PHONE_BOOTH':
      return 'Soundproof booth for calls and video meetings.';
    case 'EVENT_SPACE':
      return `Event venue for up to ${capacity} guests - launches, town halls and workshops, with stage, AV and a catering kitchen.`;
  }
}

const ADDONS: [name: string, cycle: string, price: number, category: string, description: string][] = [
  ['Covered parking bay', 'MONTHLY', 450, 'Parking', 'Reserved bay in the basement car park, 24/7 access.'],
  ['Meeting room credits (10 h)', 'MONTHLY', 900, 'Workspace', 'Ten hours of meeting-room time every month.'],
  ['Daily office cleaning', 'MONTHLY', 380, 'Housekeeping', 'Desks, bins and kitchenette cleaned every working day.'],
  ['Mail & courier handling', 'MONTHLY', 150, 'Front desk', 'Reception signs for parcels and forwards your mail.'],
  ['Business address registration', 'YEARLY', 3000, 'Administration', 'Use the building as the registered address on your CR.'],
  ['Coffee break catering (per person)', 'DAILY', 45, 'Catering', 'Arabic coffee, tea, dates and pastries.'],
  ['Dedicated IT support', 'MONTHLY', 600, 'IT', 'On-site technician for set-up and troubleshooting.'],
  ['Personal locker', 'MONTHLY', 120, 'Facilities', 'Lockable locker beside the hot-desk lounge.'],
  ['Event AV technician', 'HOURLY', 150, 'Events', 'Sound, lighting and screens run for your event.'],
];

const ADDONS_BY_TYPE: Record<SpaceType, string[]> = {
  DEDICATED_OFFICE: ['Covered parking bay', 'Daily office cleaning', 'Mail & courier handling', 'Business address registration', 'Dedicated IT support'],
  FLEXIBLE_DESK: ['Covered parking bay', 'Mail & courier handling', 'Business address registration', 'Personal locker'],
  HOT_DESK: ['Personal locker', 'Mail & courier handling', 'Meeting room credits (10 h)'],
  MEETING_ROOM: ['Coffee break catering (per person)'],
  CONFERENCE_ROOM: ['Coffee break catering (per person)', 'Event AV technician'],
  EVENT_SPACE: ['Coffee break catering (per person)', 'Event AV technician'],
  PHONE_BOOTH: [],
};

const PROMOS: Record<string, [code: string, type: string, discount: number, description: string, from: Date, until: Date | null, max: number | null, used: number, active: boolean][]> = (() => {
  const y = NOW.getFullYear();
  return {
    msheireb: [
      ['WELCOME10', 'PERCENTAGE', 10, '10% off the first three months for new tenants', new Date(y, 0, 1), new Date(y, 11, 31), 100, 14, true],
      ['SUMMER25', 'PERCENTAGE', 25, 'Summer move-in offer - 25% off the first two months', new Date(y, 5, 1), new Date(y, 9, 31), 40, 9, true],
      ['CORPORATE20', 'PERCENTAGE', 20, 'Corporate rate for leases of 24 months or more', new Date(y - 1, 8, 1), null, null, 6, true],
      ['NATIONALDAY18', 'PERCENTAGE', 18, 'Qatar National Day offer', new Date(y, 11, 1), new Date(y, 11, 31), 50, 0, true],
      ['RAMADAN15', 'PERCENTAGE', 15, 'Ramadan offer on meeting rooms', new Date(y, 1, 15), new Date(y, 2, 25), 60, 31, false],
      ['FLAT1000', 'FIXED_AMOUNT', 1000, 'QAR 1,000 off the first invoice', new Date(y, 2, 1), new Date(y, 8, 30), 20, 20, false],
    ],
    'west-bay': [
      ['WELCOME10', 'PERCENTAGE', 10, '10% off the first three months for new tenants', new Date(y, 0, 1), new Date(y, 11, 31), 80, 11, true],
      ['SUMMER25', 'PERCENTAGE', 25, 'Summer move-in offer - 25% off the first two months', new Date(y, 5, 1), new Date(y, 9, 31), 30, 7, true],
      ['CORNICHE15', 'PERCENTAGE', 15, 'Corniche Tower executive floor launch', new Date(y, 3, 1), new Date(y, 11, 31), 25, 4, true],
      ['FLAT750', 'FIXED_AMOUNT', 750, 'QAR 750 off a first event booking', new Date(y, 0, 15), new Date(y, 4, 31), 30, 18, false],
    ],
    'lusail-hub': [
      ['LUSAIL30', 'PERCENTAGE', 30, 'Lusail launch - 30% off the first three months', new Date(y, 6, 1), new Date(y, 11, 31), 25, 5, true],
      ['WELCOME10', 'PERCENTAGE', 10, '10% off the first three months for new tenants', new Date(y, 0, 1), new Date(y, 11, 31), 60, 8, true],
      ['FOXHILLS500', 'FIXED_AMOUNT', 500, 'QAR 500 off a Fox Hills hot-desk month', new Date(y, 3, 1), new Date(y, 11, 31), 40, 12, true],
      ['EARLYBIRD20', 'PERCENTAGE', 20, 'Pre-opening offer for Marina Twenty-One', new Date(y - 1, 9, 1), new Date(y, 2, 31), 30, 30, false],
    ],
  };
})();

// ─── maintenance catalogue ────────────────────────────────────────────────
const TICKETS: Record<string, [title: string, description: string, priority: string][]> = {
  HVAC: [
    ['AC not cooling', 'The room stays at 27°C even with the AC on full.', 'HIGH'],
    ['Water dripping from AC vent', 'Condensate is dripping onto the desk below the vent.', 'HIGH'],
    ['AC making a rattling noise', 'Constant rattle from the ceiling unit - hard to take calls.', 'NORMAL'],
    ['Thermostat not responding', 'The display is on but changing the set point does nothing.', 'NORMAL'],
    ['Stuffy air in the afternoon', 'Ventilation feels weak after 2 pm and the room gets humid.', 'LOW'],
  ],
  ELECTRICAL: [
    ['Flickering ceiling lights', 'Two LED panels flicker constantly near the window.', 'NORMAL'],
    ['Socket not working', 'The floor-box socket under desk 3 has no power.', 'NORMAL'],
    ['Breaker tripping repeatedly', 'Power to the kitchenette drops whenever the kettle is on.', 'HIGH'],
    ['Emergency exit sign out', 'The exit sign above the stair door is not lit.', 'HIGH'],
    ['Lights stay on after hours', 'The occupancy sensor does not switch the lights off at night.', 'LOW'],
  ],
  PLUMBING: [
    ['Leaking tap in the kitchenette', 'Steady drip, with a small puddle forming under the sink.', 'NORMAL'],
    ['Toilet running continuously', "The cistern in the washroom on this floor won't stop filling.", 'NORMAL'],
    ['Blocked sink drain', 'The kitchenette sink drains very slowly.', 'NORMAL'],
    ['Water leak under the pantry counter', 'Water is pooling under the pantry cabinet.', 'URGENT'],
    ['Low water pressure', 'The washroom taps have had very low pressure since this morning.', 'LOW'],
  ],
  IT_EQUIPMENT: [
    ["Screen won't detect laptops", 'Neither HDMI nor wireless casting shows a picture.', 'HIGH'],
    ['Wi-Fi keeps dropping', 'The connection drops every 10-15 minutes in this area.', 'HIGH'],
    ['Badge reader rejects access cards', 'The reader at the door beeps red for valid cards.', 'HIGH'],
    ['Conference camera offline', "The room camera isn't detected by Teams.", 'NORMAL'],
    ['Printer jammed', "The shared printer shows a paper jam that can't be cleared.", 'LOW'],
  ],
  CLEANING: [
    ['Bins not emptied', 'Kitchen bins have been full since Thursday.', 'NORMAL'],
    ['Coffee spill on the carpet', 'Large coffee stain near the entrance of the room.', 'LOW'],
    ['Washroom needs attention', 'Soap dispensers are empty and the floor is wet.', 'NORMAL'],
    ['Deep clean after an event', "The room needs a full clean before tomorrow morning's booking.", 'HIGH'],
  ],
  FURNITURE: [
    ['Broken chair castor', "The chair wobbles and won't roll.", 'LOW'],
    ['Desk drawer lock stuck', 'The key turns but the pedestal drawer will not open.', 'NORMAL'],
    ['Whiteboard loose on the wall', 'The whiteboard is coming off its brackets.', 'NORMAL'],
    ['Standing desk motor failed', "The electric desk won't go up or down.", 'NORMAL'],
  ],
  OTHER: [
    ['Door closer slamming', 'The office door slams shut and needs adjusting.', 'LOW'],
    ['Blinds stuck half-way', "The roller blind won't go up or down.", 'LOW'],
    ['Pest sighting in the pantry', 'A cockroach was seen near the fridge this morning.', 'HIGH'],
    ['Scuffed wall paint', 'The paint is scuffed along the corridor wall.', 'LOW'],
  ],
};

const COST_RANGE: Record<string, [number, number]> = {
  HVAC: [250, 1800], ELECTRICAL: [120, 900], PLUMBING: [150, 1200], IT_EQUIPMENT: [0, 650],
  CLEANING: [0, 250], FURNITURE: [80, 700], OTHER: [0, 400],
};
const FIX_HOURS: Record<string, [number, number]> = {
  EMERGENCY: [1, 4], URGENT: [3, 12], HIGH: [6, 36], NORMAL: [20, 96], LOW: [48, 168],
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0',
];

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  const t0 = Date.now();
  console.log('\nWiping every table…');
  await wipe();
  clearSampleDocs();

  const hash = await bcrypt.hash(PASSWORD, 10);
  const R = {
    tenants: [] as any[], users: [] as any[], sessions: [] as any[], onboarding: [] as any[],
    buildings: [] as any[], floors: [] as any[], spaces: [] as any[], features: [] as any[],
    addons: [] as any[], spaceAddons: [] as any[], promos: [] as any[], contracts: [] as any[],
    invoices: [] as any[], lines: [] as any[], bookings: [] as any[], bookingAddons: [] as any[],
    documents: [] as any[], applications: [] as any[], applicationAddons: [] as any[],
    tenantApplications: [] as any[], payments: [] as any[], tickets: [] as any[],
    notifications: [] as any[], reports: [] as any[], audit: [] as any[],
  };

  // ── builders ──────────────────────────────────────────────────────────
  const phoneFor = (key: string) => {
    const r = keyed(`phone:${key}`);
    return `+974${pickOne(r, ['3', '5', '6', '7'])}${between(r, 1000000, 9999999)}`;
  };

  function addTenant(t: Record<string, any>) {
    const row = { id: randomUUID(), ...t };
    R.tenants.push(row);
    return row;
  }

  function addUser(u: {
    tenantId: string; role: string; email: string; first: string; last: string; created: Date;
    phone?: string | null; managedBy?: string | null; companyId?: string | null; status?: string; mustChange?: boolean;
  }) {
    const row = {
      id: randomUUID(),
      tenant_id: u.tenantId,
      role: u.role,
      email: u.email.toLowerCase(),
      password: hash,
      first_name: u.first,
      last_name: u.last,
      phone_number: u.phone === undefined ? phoneFor(u.email) : u.phone,
      managed_by_id: u.managedBy ?? null,
      status: u.status ?? 'ACTIVE',
      must_change_password: u.mustChange ?? false,
      tenant_company_id: u.companyId ?? null,
      notification_preferences: { email: true, in_app: true, sms: false },
      last_login_at: null as Date | null,
      created_at: u.created,
      updated_at: u.created,
    };
    R.users.push(row);
    return row;
  }

  // ── 1. platform owner ─────────────────────────────────────────────────
  const platform = addTenant({
    name: 'LeaseManager Platform',
    slug: 'platform',
    contact_email: 'admin@leasemanager.com',
    status: 'ACTIVE',
    subscription_plan: 'enterprise',
    organization_type: 'CLIENT',
    max_users: 5,
    max_spaces: 0,
    reporting_embeds: { powerBi: { title: 'Platform KPIs', embedUrl: '' }, tableau: { title: 'Occupancy', embedUrl: '' } },
    created_at: monthStart(-15),
  });
  const owner = addUser({
    tenantId: platform.id, role: 'SUPER_ADMIN', email: 'admin@leasemanager.com',
    first: 'Youssef', last: 'Mansour', created: monthStart(-15),
  });

  // ── 2. property companies ─────────────────────────────────────────────
  type LandlordCtx = {
    def: Landlord;
    row: any;
    staff: Record<string, any>;
    admin: any;
    manager: any;
    managers: any[];
    finance: any;
    receptionists: any[];
    techs: any[];
    addons: Record<string, any>;
    promos: Record<string, any>;
    spaces: SpaceCtx[];
  };
  type SpaceCtx = {
    row: any;
    slot: Slot;
    landlord: LandlordCtx;
    building: BuildingDef;
    buildingRow: any;
    floorName: string;
  };
  const LL: Record<string, LandlordCtx> = {};
  const SP: Record<string, SpaceCtx> = {};

  for (const def of LANDLORDS) {
    const created = addDays(monthStart(-def.monthsOnPlatform), 6);
    const row = addTenant({
      name: def.name,
      slug: def.key,
      contact_email: `contact@${def.key}.test`,
      status: 'ACTIVE',
      subscription_plan: def.plan,
      organization_type: 'CLIENT',
      max_users: 25,
      max_spaces: 80,
      application_profile: { sector: 'Real estate', city: def.city, cr_number: def.cr, website: `https://www.${def.key}.test` },
      created_at: created,
    });
    const ctx: LandlordCtx = {
      def, row, staff: {}, admin: null, manager: null, managers: [], finance: null,
      receptionists: [], techs: [], addons: {}, promos: {}, spaces: [],
    };
    def.staff.forEach(([role, local, first, last], i) => {
      const u = addUser({
        tenantId: row.id, role, email: `${local}@${def.key}.test`, first, last,
        created: addDays(created, 1 + i),
        managedBy: role === 'RECEPTIONIST' ? ctx.managers[0]?.id : null,
      });
      ctx.staff[local] = u;
      if (role === 'CLIENT_ADMIN') ctx.admin = u;
      if (role === 'MANAGER') ctx.managers.push(u);
      if (role === 'FINANCE') ctx.finance = u;
      if (role === 'RECEPTIONIST') ctx.receptionists.push(u);
      if (role === 'MAINTENANCE') ctx.techs.push(u);
    });
    ctx.manager = ctx.managers[0];

    for (const [name, cycle, price, category, description] of ADDONS) {
      const a = {
        id: randomUUID(),
        tenant_id: row.id,
        name,
        description,
        price: roundTo(price * def.priceFactor, 5),
        billing_cycle: cycle,
        category,
        status: 'ACTIVE',
        // one service paused, so the add-on screens show both states
        is_active: !(def.key === 'lusail-hub' && name === 'Dedicated IT support'),
        created_at: addDays(created, 2),
        updated_at: addDays(created, 2),
      };
      if (!a.is_active) a.status = 'INACTIVE';
      R.addons.push(a);
      ctx.addons[name] = a;
    }

    for (const [code, type, discount, description, from, until, max, used, active] of PROMOS[def.key]) {
      const p = {
        id: randomUUID(), tenant_id: row.id, code, description, discount, type,
        valid_from: from, valid_until: until, max_uses: max, used_count: used, is_active: active,
        created_at: notAfterNow(from < created ? created : from), updated_at: notAfterNow(from < created ? created : from),
      };
      R.promos.push(p);
      ctx.promos[code] = p;
    }
    LL[def.key] = ctx;
  }

  // ── 3. buildings → floors → spaces ────────────────────────────────────
  for (const [bi, b] of BUILDINGS.entries()) {
    const ll = LL[b.landlord];
    const bCreated = addDays(ll.row.created_at, 3 + bi);
    const buildingRow = {
      id: randomUUID(), tenant_id: ll.row.id, name: b.name, slug: b.code, description: b.description,
      address: b.address, total_area_sqm: b.area, total_floors_in_building: b.floorsTotal, year_built: b.built,
      status: 'ACTIVE', created_at: bCreated, updated_at: bCreated,
    };
    R.buildings.push(buildingRow);

    for (const f of b.floors) {
      const floorName = f.number === 0 ? 'Ground Floor' : `Level ${f.number}`;
      const floorRow = {
        id: randomUUID(), building_id: buildingRow.id, name: floorName, floor_number: f.number,
        area_sqm: roundTo((b.area / b.floorsTotal) * 1.05, 10), floor_plan_url: null, status: 'ACTIVE',
        created_at: bCreated, updated_at: bCreated,
      };
      R.floors.push(floorRow);

      f.slots.forEach((slot, i) => {
        const slug = `${b.code}-${slot.suffix}`;
        const p = profileFor(slot, slug, ll.def.priceFactor);
        const r = keyed(`spacemeta:${slug}`);
        const pool = PHOTOS[slot.type];
        const first = hash32(slug) % pool.length;
        const photos = [0, 1, 2].map((k) => pool[(first + k) % pool.length]);
        // spread a building's spaces a few metres apart so each keeps its own pin
        const angle = (hash32(`pin:${slug}`) % 360) * (Math.PI / 180);
        const radius = 0.00012 + (i % 4) * 0.00005;
        const spaceRow = {
          id: randomUUID(),
          floor_id: floorRow.id,
          name: slot.name,
          slug,
          description: describe(slot, b, p.capacity, floorName),
          type: slot.type,
          status: 'AVAILABLE',
          capacity: p.capacity,
          area_sqm: p.area,
          hourly_rate: p.hourly,
          daily_rate: p.daily,
          monthly_rate: p.monthly,
          currency: 'QAR',
          map_x: slot.box[0],
          map_y: slot.box[1],
          map_w: slot.box[2],
          map_h: slot.box[3],
          photos,
          virtual_tour_url: null,
          is_listed: false,
          requires_approval: ['DEDICATED_OFFICE', 'FLEXIBLE_DESK', 'EVENT_SPACE', 'CONFERENCE_ROOM'].includes(slot.type),
          is_published: false,
          address: b.address,
          city: b.city,
          state: b.state,
          zip: null,
          country: 'Qatar',
          map_lat: Number((b.lat + Math.sin(angle) * radius).toFixed(6)),
          map_lng: Number((b.lng + Math.cos(angle) * radius).toFixed(6)),
          transportation_notes: b.transport,
          coworker_listing_id: null,
          liquidspace_listing_id: null,
          created_at: addDays(bCreated, 1),
          updated_at: addDays(bCreated, 1),
        };
        R.spaces.push(spaceRow);
        const ctx: SpaceCtx = { row: spaceRow, slot, landlord: ll, building: b, buildingRow, floorName };
        SP[slug] = ctx;
        ll.spaces.push(ctx);

        const feats = [...FEATURES[slot.type]];
        const count = Math.min(feats.length, between(r, 3, 5));
        for (let k = 0; k < count; k++) {
          const name = feats.splice(Math.floor(r() * feats.length), 1)[0];
          R.features.push({ id: randomUUID(), space_id: spaceRow.id, name, description: 'Included in the rate', created_at: spaceRow.created_at });
        }
        for (const name of ADDONS_BY_TYPE[slot.type]) {
          const a = ll.addons[name];
          if (a?.is_active) R.spaceAddons.push({ id: randomUUID(), space_id: spaceRow.id, addon_service_id: a.id, created_at: spaceRow.created_at });
        }
      });
    }
  }
  const space = (slug: string) => {
    const s = SP[slug];
    if (!s) throw new Error(`Unknown space ${slug}`);
    return s;
  };

  // ── 4. renter organisations ───────────────────────────────────────────
  type RenterCtx = { def: RenterDef | null; row: any; admin: any; users: any[]; payer: Payer; ipBase: string };
  const RT: Record<string, RenterCtx> = {};
  const firstStart: Record<string, number> = {};
  for (const l of LEASES) firstStart[l.renter] = Math.min(firstStart[l.renter] ?? 99, l.start);

  RENTERS.forEach((def, ri) => {
    const joined = addDays(monthStart(firstStart[def.slug] ?? -3), -between(keyed(`join:${def.slug}`), 12, 26));
    const row = addTenant({
      name: def.name,
      slug: def.slug,
      contact_email: `hello@${def.domain}`,
      status: def.status ?? 'ACTIVE',
      subscription_plan: def.plan,
      organization_type: 'RENTER',
      max_users: def.plan === 'pro' ? 25 : 12,
      max_spaces: def.plan === 'pro' ? 8 : 4,
      application_profile: {
        sector: def.sector,
        headcount: def.headcount,
        cr_number: String(100000 + (hash32(`cr:${def.slug}`) % 899999)),
        website: `https://www.${def.domain}`,
      },
      created_at: joined,
    });
    const users = def.people.map(([local, first, last], i) => {
      const isAdmin = i === 0;
      let status = 'ACTIVE';
      let mustChange = false;
      if (def.status === 'CLOSED') status = 'INACTIVE';
      if (def.slug === 'pearl-logistics' && local === 'fatma.yilmaz') { status = 'PENDING'; mustChange = true; }
      if (def.slug === 'qitaf-pharma' && local === 'john.mwangi') status = 'INACTIVE';
      return { local, row: null as any, isAdmin, status, mustChange, first, last, i };
    });
    const admin = addUser({
      tenantId: row.id, role: 'TENANT_ADMIN', email: `${users[0].local}@${def.domain}`,
      first: users[0].first, last: users[0].last, created: addDays(joined, 0),
      companyId: row.id, status: users[0].status,
    });
    const all = [admin];
    for (const u of users.slice(1)) {
      all.push(addUser({
        tenantId: row.id, role: 'TENANT_EMPLOYEE', email: `${u.local}@${def.domain}`,
        first: u.first, last: u.last, created: addDays(joined, 2 + u.i * 3),
        companyId: row.id, managedBy: admin.id, status: u.status, mustChange: u.mustChange,
        phone: u.i % 2 ? null : undefined,
      }));
    }
    const payer = (LEASES.find((l) => l.renter === def.slug)?.payer ?? 'prompt') as Payer;
    RT[def.slug] = { def, row, admin, users: all, payer, ipBase: `10.${20 + ri}.${hash32(def.slug) % 200}` };
  });

  // ── 5. leases → monthly periods → invoices → payments ──────────────────
  type Settled = { status: string; paidAt: Date | null; partial?: number };

  /** How a renter's monthly invoice ends up, given how that renter pays. */
  /** Renters whose current rent is reported and awaiting confirmation, and how they paid. */
  const REPORTED_RENT: Record<string, 'CHECK' | 'BANK_TRANSFER'> = {
    'najd-advisory': 'BANK_TRANSFER',
    'brightpath-training': 'CHECK',
    'sealine-energy': 'CHECK',
    'qamar-education': 'BANK_TRANSFER',
  };

  function settleRent(payer: Payer, k: number, issue: Date, due: Date, r: Rng): Settled {
    let paidAt: Date | null = null;
    if (payer === 'pdc') paidAt = at(addDays(issue, between(r, 0, 1)), between(r, 10, 12), between(r, 0, 59));
    if (payer === 'prompt') paidAt = at(addDays(issue, between(r, 2, 6)), between(r, 9, 16), between(r, 0, 59));
    if (payer === 'late') paidAt = at(addDays(issue, between(r, 8, 14)), between(r, 9, 16), between(r, 0, 59));
    if (payer === 'struggling') {
      if (k === -2) return { status: 'PARTIALLY_PAID', paidAt: at(addDays(issue, 20), 11, 15), partial: 0.5 };
      paidAt = k >= -1 ? null : at(addDays(issue, between(r, 18, 30)), between(r, 9, 16), between(r, 0, 59));
    }
    if (paidAt && paidAt <= NOW) return { status: 'PAID', paidAt };
    return { status: NOW > due ? 'OVERDUE' : r() < 0.75 ? 'SENT' : 'ISSUED', paidAt: null };
  }

  const overdueTier = (due: Date) => {
    const days = Math.floor((NOW.getTime() - due.getTime()) / 86_400_000);
    return days >= 14 ? 14 : days >= 7 ? 7 : days >= 1 ? 1 : 0;
  };

  const methodNumber = (method: string, key: string, when: Date) =>
    numbered((s) => {
      if (method === 'CHECK') return `CHQ-${String(100000 + (hash32(s) % 899999))}`;
      if (method === 'CASH') return `RCPT-${hex8(s).slice(0, 6)}`;
      return `FT${ymd(when).slice(2)}${hex8(s).slice(0, 6)}`;
    }, `txn:${key}`);

  const chequeDocs: string[] = [];
  function addPayment(p: {
    renter: RenterCtx; landlord: LandlordCtx; invoice: any; amount: number; method: string; when: Date;
    status?: string; key: string; reportedBy?: any; withCheque?: boolean;
  }) {
    const status = p.status ?? 'COMPLETED';
    let cheque: string | null = null;
    if (p.method === 'CHECK' && p.withCheque) {
      cheque = samplePdf(`cheque-${hex8(p.key)}`, 'Cheque scan', [
        `Drawer: ${p.renter.row.name}`,
        `Payee: ${p.landlord.row.name}`,
        `Amount: QAR ${p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `Date: ${dayLabel(p.when)}`,
        `Against invoice: ${p.invoice.invoice_number}`,
      ]);
      chequeDocs.push(cheque);
    }
    const row = {
      id: randomUUID(),
      tenant_id: p.renter.row.id,
      user_id: p.reportedBy?.id ?? p.renter.admin.id,
      invoice_id: p.invoice.id,
      recorded_by_id: status === 'PENDING' ? null : p.landlord.finance.id,
      payment_number: numbered((s) => `PAY-${ym(p.when)}-${hex8(s)}`, `pay:${p.key}`),
      amount: money(p.amount),
      method: p.method,
      status,
      transaction_id: methodNumber(p.method, p.key, p.when),
      cheque_document_url: cheque,
      payment_date: p.when,
      paid_at: status === 'PENDING' ? null : p.when,
      created_at: p.when,
      updated_at: p.when,
    };
    R.payments.push(row);
    return row;
  }

  function addInvoice(i: {
    renter: RenterCtx; type: string; issue: Date; due: Date; lines: { description: string; quantity: number; unit_price: number }[];
    status: string; key: string; contractId?: string | null; promoId?: string | null; paidAt?: Date | null;
  }) {
    const id = randomUUID();
    let subtotal = 0;
    for (const l of i.lines) {
      const total = money(l.quantity * l.unit_price);
      subtotal += total;
      R.lines.push({
        id: randomUUID(), invoice_id: id, description: l.description, quantity: l.quantity,
        unit_price: money(l.unit_price), tax_rate: 0, line_total: total, created_at: i.issue, updated_at: i.issue,
      });
    }
    subtotal = money(subtotal);
    const row = {
      id,
      tenant_id: i.renter.row.id,
      user_id: i.renter.admin.id,
      contract_id: i.contractId ?? null,
      promotion_code_id: i.promoId ?? null,
      invoice_number: numbered((s) => `INV-${ym(i.issue)}-${hex8(s)}`, `inv:${i.key}`),
      type: i.type,
      amount: subtotal,
      subtotal,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: subtotal,
      currency: 'QAR',
      due_date: i.due,
      issue_date: i.issue,
      status: i.status,
      paid_at: i.status === 'PAID' ? i.paidAt ?? null : null,
      overdue_reminder_max_day: i.status === 'OVERDUE' ? overdueTier(i.due) : 0,
      created_at: i.issue,
      updated_at: i.paidAt && i.paidAt > i.issue ? i.paidAt : i.issue,
    };
    R.invoices.push(row);
    return row;
  }

  const busy = new Map<string, [number, number][]>();
  const isFree = (spaceId: string, s: Date, e: Date) =>
    !(busy.get(spaceId) ?? []).some(([a, b]) => s.getTime() < b && e.getTime() > a);
  const reserve = (spaceId: string, s: Date, e: Date) => {
    const list = busy.get(spaceId) ?? [];
    list.push([s.getTime(), e.getTime()]);
    busy.set(spaceId, list);
  };

  /** A believable number of people for a booking of this space. */
  function headcountFor(s: SpaceCtx, key: string) {
    const cap = Math.max(1, s.row.capacity ?? 1);
    const r = keyed(`people:${key}`);
    switch (s.slot.type) {
      case 'HOT_DESK':
      case 'PHONE_BOOTH':
        return 1;
      case 'MEETING_ROOM':
        return between(r, 2, Math.min(cap, 8));
      case 'CONFERENCE_ROOM':
        return between(r, Math.min(cap, Math.max(4, Math.round(cap / 3))), cap);
      case 'EVENT_SPACE':
        return fitRoom(s, roundTo(between(r, Math.round(cap * 0.4), Math.round(cap * 0.9)), 10));
      default:
        return between(r, Math.max(1, Math.round(cap * 0.6)), cap);
    }
  }

  /** A guest count that fits the room, in tens for event venues. */
  function fitRoom(s: SpaceCtx, people: number) {
    const cap = Math.max(1, s.row.capacity ?? 1);
    const max = s.slot.type === 'EVENT_SPACE' && cap >= 10 ? Math.floor(cap / 10) * 10 : cap;
    return Math.max(1, Math.min(people, max));
  }

  function addBooking(b: {
    renter: RenterCtx; user: any; space: SpaceCtx; start: Date; end: Date; status: string; created: Date;
    price: number; addons?: { addon: any; quantity: number; unit_price: number }[]; notes?: string | null;
    invoiceId?: string | null; receptionistId?: string | null; key: string; attendees?: number;
  }) {
    const addonTotal = (b.addons ?? []).reduce((s, a) => s + a.quantity * a.unit_price, 0);
    const row = {
      id: randomUUID(),
      tenant_id: b.renter.row.id,
      user_id: b.user.id,
      space_id: b.space.row.id,
      invoice_id: b.invoiceId ?? null,
      receptionist_id: b.receptionistId ?? null,
      booking_number: numbered((s) => `BK-${ymd(b.created)}-${hex8(s)}`, `bk:${b.key}`),
      start_time: b.start,
      end_time: b.end,
      status: b.status,
      total_amount: money(b.price + addonTotal),
      total_price: money(b.price),
      attendee_count: b.attendees ? fitRoom(b.space, b.attendees) : headcountFor(b.space, b.key),
      notes: b.notes ?? null,
      created_at: b.created,
      updated_at: b.created,
    };
    R.bookings.push(row);
    for (const a of b.addons ?? []) {
      R.bookingAddons.push({
        id: randomUUID(), booking_id: row.id, addon_service_id: a.addon.id, quantity: a.quantity,
        unit_price: a.unit_price, created_at: b.created, updated_at: b.created,
      });
    }
    if (!['CANCELLED', 'REFUSED', 'NO_SHOW'].includes(b.status)) reserve(b.space.row.id, b.start, b.end);
    return row;
  }

  type ContractCtx = { row: any; lease: LeaseDef; renter: RenterCtx; landlord: LandlordCtx; spaces: SpaceCtx[] };
  const CONTRACTS: ContractCtx[] = [];

  for (const lease of LEASES) {
    const renter = RT[lease.renter];
    const landlord = LL[lease.landlord];
    const spaces = lease.spaces.map(space);
    for (const s of spaces) {
      if (s.landlord !== landlord) throw new Error(`${s.row.slug} is not a ${lease.landlord} space`);
    }
    const start = monthStart(lease.start);
    const originalEnd = monthEnd(lease.start + lease.term - 1);
    const end = lease.renewTo !== undefined ? monthEnd(lease.renewTo) : originalEnd;
    const rent = spaces.reduce((s, x) => s + x.row.monthly_rate, 0);
    const created = notAfterNow(at(addDays(start, -12), 11, 20));
    const contract = {
      id: randomUUID(),
      tenant_id: renter.row.id,
      user_id: renter.admin.id,
      contract_number: numbered((s) => `CT-${ym(created)}-${hex8(s)}`, `ct:${lease.renter}:${lease.landlord}`),
      start_date: start,
      end_date: end,
      monthly_rent: money(rent),
      status: lease.status,
      created_at: created,
      updated_at: lease.status === 'RENEWED' ? notAfterNow(addDays(originalEnd, -20)) : created,
    };
    R.contracts.push(contract);
    CONTRACTS.push({ row: contract, lease, renter, landlord, spaces });

    if (lease.status === 'ACTIVE' || lease.status === 'RENEWED') {
      for (const s of spaces) s.row.status = 'OCCUPIED';
    }

    const lastK =
      lease.status === 'EXPIRED' ? lease.start + lease.term - 1
      : lease.status === 'TERMINATED' ? lease.endedAt!
      : 0;
    for (let k = Math.max(lease.start, -5); k <= Math.min(lastK, 0); k++) {
      const period = monthStart(k);
      const periodEnd = monthEnd(k);
      const issue = notAfterNow(at(period, 9, 5));
      const due = at(addDays(period, 14), 17, 0);
      const key = `${lease.renter}:${lease.landlord}:${ym(period)}`;
      const r = keyed(`rent:${key}`);
      const month = monthName(period);

      const lines = spaces.map((s) => ({ description: `Rent - ${s.row.name} - ${month}`, quantity: 1, unit_price: s.row.monthly_rate }));
      const periodAddons: { addon: any; quantity: number; unit_price: number }[] = [];
      for (const [name, qty] of lease.addons ?? []) {
        const a = landlord.addons[name];
        if (!a) continue;
        const firstMonth = k === lease.start;
        if (a.billing_cycle === 'MONTHLY' || (a.billing_cycle === 'YEARLY' && firstMonth)) {
          lines.push({ description: qty > 1 ? `${a.name} x ${qty}` : a.name, quantity: qty, unit_price: a.price });
          periodAddons.push({ addon: a, quantity: qty, unit_price: a.price });
        }
      }
      let promoId: string | null = null;
      const promo = lease.promo ? landlord.promos[lease.promo] : null;
      if (promo && k - lease.start < (promo.code === 'SUMMER25' ? 2 : 3)) {
        const off = promo.type === 'PERCENTAGE' ? money((rent * promo.discount) / 100) : promo.discount;
        lines.push({ description: `Promotion ${promo.code} - ${promo.type === 'PERCENTAGE' ? `${promo.discount}% off rent` : `QAR ${promo.discount} off`}`, quantity: 1, unit_price: -off });
        promoId = promo.id;
      }

      // These renters have just reported this month's rent and finance
      // confirms it live in the demo. Settling it by date instead made the
      // cheque flip to paid partway through the month (Brightpath's QAR 29,600
      // cheque was gone on 12 Oct), so it is pinned here.
      const reported = k === 0 ? REPORTED_RENT[lease.renter] : undefined;
      const settled: Settled = reported
        ? { status: NOW > due ? 'OVERDUE' : 'SENT', paidAt: null }
        : settleRent(lease.payer, k, issue, due, r);
      const invoice = addInvoice({
        renter, type: 'MONTHLY_RENT', issue, due, lines, status: settled.status, key,
        contractId: contract.id, promoId, paidAt: settled.paidAt,
      });

      spaces.forEach((s, si) => {
        addBooking({
          renter, user: renter.admin, space: s, start: period, end: periodEnd,
          status: k < 0 ? 'COMPLETED' : 'CHECKED_IN', created: issue, price: s.row.monthly_rate,
          addons: si === 0 ? periodAddons : [], invoiceId: invoice.id,
          attendees: renter.def?.headcount ?? s.row.capacity,
          notes: `Monthly lease period - ${month} (${contract.contract_number})`, key: `period:${s.row.slug}:${ym(period)}`,
        });
      });

      const method = lease.payer === 'pdc' ? 'CHECK'
        : lease.payer === 'struggling' ? pickOne(r, ['CASH', 'CHECK'])
        : lease.payer === 'late' ? pickOne(r, ['BANK_TRANSFER', 'CHECK'])
        : 'BANK_TRANSFER';
      if (settled.status === 'PAID') {
        addPayment({ renter, landlord, invoice, amount: invoice.total_amount, method, when: settled.paidAt!, key, withCheque: method === 'CHECK' && k >= -1 });
      } else if (settled.status === 'PARTIALLY_PAID') {
        addPayment({ renter, landlord, invoice, amount: money(invoice.total_amount * settled.partial!), method, when: settled.paidAt!, key });
      } else if (reported) {
        // reported by the renter, waiting on the finance officer to confirm
        const said = at(addDays(TODAY, -between(r, 0, 2)), between(r, 8, 11), between(r, 0, 59));
        addPayment({
          renter, landlord, invoice, amount: invoice.total_amount, method: reported, status: 'PENDING', key,
          when: notAfterNow(new Date(Math.max(said.getTime(), addHours(issue, 1).getTime()))),
          reportedBy: renter.admin, withCheque: reported === 'CHECK',
        });
      }
    }
  }

  /** Whether a lease (not a pipeline contract) had the space on a given day. */
  const leaseCovers = (c: ContractCtx, d: Date) =>
    !!c.lease && c.row.start_date <= d && c.row.end_date >= d
    && !(c.lease.status === 'TERMINATED' && d > monthEnd(c.lease.endedAt!));

  // ── 6. the reception pipeline (accepted booking applications) ─────────
  const docTitle: Record<string, string> = {
    cr_copy: 'Commercial registration (CR) copy',
    qid_copy: 'Signatory QID copy (placeholder)',
    trade_license: 'Trade licence copy',
    signed_lease_contract: 'Lease agreement - signed copy',
    payment_proof: 'First payment receipt',
  };
  const pipelineBookings: { def: PipelineDef; booking: any; renter: RenterCtx; landlord: LandlordCtx; space: SpaceCtx; app: any }[] = [];

  for (const def of PIPELINE) {
    const landlord = LL[def.landlord];
    const s = space(def.space);
    const applied = notAfterNow(at(addDays(TODAY, -def.appliedDaysAgo), 10 + (def.appliedDaysAgo % 6), 15));
    const decided = notAfterNow(def.decidedDaysAgo === 0 ? minutesAgo(95) : at(addDays(TODAY, -def.decidedDaysAgo), 15, 40));
    let renter: RenterCtx;
    let guest: { name: string; email: string; phone: string } | null = null;
    if (def.org) {
      const o = def.org;
      const row = addTenant({
        name: o.name, slug: o.slug, contact_email: `hello@${o.domain}`, status: 'TRIAL', subscription_plan: 'basic',
        organization_type: 'RENTER', max_users: 10, max_spaces: 3,
        application_profile: { sector: o.sector, headcount: o.headcount, source: 'public map application' },
        created_at: decided,
      });
      const email = `${o.admin[0]}.${o.admin[1]}`.toLowerCase().replace(/[^a-z.]/g, '') + `@${o.domain}`;
      const admin = addUser({ tenantId: row.id, role: 'TENANT_ADMIN', email, first: o.admin[0], last: o.admin[1], created: decided, companyId: row.id });
      renter = { def: null, row, admin, users: [admin], payer: 'prompt', ipBase: `10.90.${hash32(o.slug) % 200}` };
      RT[o.slug] = renter;
      guest = { name: `${o.admin[0]} ${o.admin[1]}`, email, phone: admin.phone_number };
    } else {
      renter = RT[def.renter!];
    }

    const moveIn = monthStart(def.stage === 'PENDING_PHONE_CONFIRMATION' && def.months > 12 ? 2 : 1);
    const moveOut = new Date(moveIn);
    moveOut.setMonth(moveOut.getMonth() + def.months);
    moveOut.setMinutes(moveOut.getMinutes() - 1);
    const addonRows = def.addons.map(([name, qty]) => ({ addon: landlord.addons[name], quantity: qty, unit_price: landlord.addons[name].price }));

    const firstMonth = monthName(moveIn);
    const invoiceLines = [
      { description: `Security deposit (1 month) - ${s.row.name}`, quantity: 1, unit_price: s.row.monthly_rate },
      { description: `First month's rent - ${s.row.name} - ${firstMonth}`, quantity: 1, unit_price: s.row.monthly_rate },
      ...addonRows.filter((a) => a.addon.billing_cycle === 'MONTHLY').map((a) => ({
        description: a.quantity > 1 ? `${a.addon.name} x ${a.quantity}` : a.addon.name, quantity: a.quantity, unit_price: a.unit_price,
      })),
    ];
    const active = def.stage === 'ACTIVE';
    let contractId: string | null = null;
    if (active || def.stage === 'DOCUMENTS_PENDING_UPLOAD') {
      const c = {
        id: randomUUID(), tenant_id: renter.row.id, user_id: renter.admin.id,
        contract_number: numbered((x) => `CT-${ym(decided)}-${hex8(x)}`, `ct:${renter.row.slug}:${def.space}`),
        start_date: moveIn, end_date: new Date(moveOut),
        monthly_rent: s.row.monthly_rate, status: active ? 'ACTIVE' : 'DRAFT',
        created_at: notAfterNow(addDays(decided, active ? 6 : 3)),
        updated_at: notAfterNow(addDays(decided, active ? 9 : 3)),
      };
      R.contracts.push(c);
      contractId = c.id;
      CONTRACTS.push({ row: c, lease: null as any, renter, landlord, spaces: [s] });
    }
    const paidAt = active ? notAfterNow(at(addDays(decided, 8), 11, 30)) : null;
    const invoice = addInvoice({
      renter, type: 'DEPOSIT', issue: decided, due: at(addDays(moveIn, -3), 17), lines: invoiceLines,
      status: active ? 'PAID' : 'ISSUED', key: `deposit:${def.space}`, contractId, paidAt,
    });
    if (active) addPayment({ renter, landlord, invoice, amount: invoice.total_amount, method: 'CHECK', when: paidAt!, key: `deposit:${def.space}`, withCheque: true });

    const booking = addBooking({
      renter, user: renter.admin, space: s, start: moveIn, end: moveOut, status: def.stage, created: decided,
      price: s.row.monthly_rate * def.months, addons: addonRows, invoiceId: invoice.id,
      receptionistId: landlord.receptionists[0].id, notes: def.message, key: `pipeline:${def.space}`,
      attendees: def.org?.headcount ?? 6,
    });
    s.row.status = 'RESERVED';

    const app = {
      id: randomUUID(), space_id: s.row.id, user_id: renter.admin.id,
      guest_name: guest?.name ?? null, guest_email: guest?.email ?? null, guest_phone: guest?.phone ?? null,
      applicant_type: 'COMPANY', company_name: renter.row.name, start_date: moveIn, duration_months: def.months,
      headcount: def.org?.headcount ?? 6, intended_use: def.use, message: def.message, status: 'ACCEPTED',
      reviewed_by_id: landlord.manager.id, reviewed_at: decided, refusal_reason: null, booking_id: booking.id,
      created_at: applied, updated_at: decided,
    };
    R.applications.push(app);
    for (const a of addonRows) {
      R.applicationAddons.push({ id: randomUUID(), application_id: app.id, addon_service_id: a.addon.id, quantity: a.quantity, unit_price: a.unit_price, created_at: applied });
    }

    // documents collected at the visit
    (def.docs ?? []).forEach((type, di) => {
      const url = samplePdf(`${renter.row.slug}-${type}`, docTitle[type], [
        `Organisation: ${renter.row.name}`,
        `Premises: ${s.row.name}, ${s.building.name}`,
        `Booking: ${booking.booking_number}`,
        type === 'signed_lease_contract' ? `Term: ${def.months} months from ${dayLabel(moveIn)}` : `Collected by: ${landlord.receptionists[0].first_name} ${landlord.receptionists[0].last_name}`,
        type === 'signed_lease_contract' ? `Monthly rent: QAR ${s.row.monthly_rate.toLocaleString('en-US')}` : `Date: ${dayLabel(addDays(decided, 3))}`,
      ]);
      R.documents.push({
        id: randomUUID(), booking_id: booking.id, file_url: url,
        file_name: `${renter.row.slug}-${type.replace(/_/g, '-')}.pdf`, document_type: type,
        uploaded_by: landlord.receptionists[0].id, uploaded_at: notAfterNow(addHours(at(addDays(decided, 3), 10), di)),
      });
    });
    pipelineBookings.push({ def, booking, renter, landlord, space: s, app });
  }

  // ── 7. open and refused booking applications ──────────────────────────
  const openApps: { def: OpenAppDef; row: any; landlord: LandlordCtx; space: SpaceCtx }[] = [];
  for (const [i, def] of OPEN_APPLICATIONS.entries()) {
    const landlord = LL[def.landlord];
    const s = space(def.space);
    const created = notAfterNow(def.daysAgo === 0 ? minutesAgo(40 + i * 7) : at(addDays(TODAY, -def.daysAgo), 9 + (i % 8), (i * 13) % 60));
    let user: any = null;
    if (def.user) user = RT[def.user[0]].users.find((u) => u.email.startsWith(`${def.user[1]}@`));
    const guestEmail = def.guest ? `${def.guest[0]}.${def.guest[1]}`.toLowerCase().replace(/[^a-z.]/g, '') + `@${def.guest[2]}` : null;
    const start = monthStart(1);
    const row = {
      id: randomUUID(), space_id: s.row.id, user_id: user?.id ?? null,
      guest_name: def.guest ? `${def.guest[0]} ${def.guest[1]}` : null,
      guest_email: guestEmail,
      guest_phone: def.guest ? phoneFor(guestEmail!) : null,
      applicant_type: def.company || user ? 'COMPANY' : 'INDIVIDUAL',
      company_name: def.company ?? (user ? RT[def.user![0]].row.name : null),
      start_date: start, duration_months: def.months, headcount: def.headcount, intended_use: def.use,
      message: def.message || null,
      status: def.refused ? 'REFUSED' : 'PENDING',
      reviewed_by_id: def.refused ? landlord.manager.id : null,
      reviewed_at: def.refused ? at(addDays(TODAY, -def.refused.daysAgo), 14, 10) : null,
      refusal_reason: def.refused?.reason ?? null,
      booking_id: null,
      created_at: created,
      updated_at: def.refused ? at(addDays(TODAY, -def.refused.daysAgo), 14, 10) : created,
    };
    R.applications.push(row);
    for (const [name, qty] of def.addons ?? []) {
      const a = landlord.addons[name];
      R.applicationAddons.push({ id: randomUUID(), application_id: row.id, addon_service_id: a.id, quantity: qty, unit_price: a.price, created_at: created });
    }
    openApps.push({ def, row, landlord, space: s });
  }

  // ── 8. space visibility ───────────────────────────────────────────────
  // The public map is for leases: available offices and desks are published
  // (and listed on the marketplaces); shared rooms are booked from the portal.
  const MAINTENANCE_ROOMS: Record<string, string> = { msheireb: 'kbc-3m1', 'west-bay': 'dbh-4c1', 'lusail-hub': 'm21-gc1' };
  for (const slug of Object.values(MAINTENANCE_ROOMS)) space(slug).row.status = 'MAINTENANCE';
  for (const s of Object.values(SP)) {
    const leasable = ['DEDICATED_OFFICE', 'FLEXIBLE_DESK', 'HOT_DESK'].includes(s.slot.type);
    if (leasable && s.row.status === 'AVAILABLE') {
      s.row.is_published = true;
      s.row.is_listed = s.slot.type !== 'HOT_DESK';
      if (s.row.is_listed && hash32(`list:${s.row.slug}`) % 2 === 0) {
        s.row.coworker_listing_id = `cw-${hex8(`cw:${s.row.slug}`).toLowerCase()}`;
        s.row.liquidspace_listing_id = `ls-${hex8(`ls:${s.row.slug}`).toLowerCase()}`;
      }
    }
  }

  // ── 9. meeting rooms, events and day passes ───────────────────────────
  const activeUsers = (r: RenterCtx) => r.users.filter((u) => u.status === 'ACTIVE');
  const tradingRenters = Object.values(RT).filter((r) => r.def && r.row.status !== 'CLOSED');
  /** renters holding a lease at this landlord on a given day */
  const leaseholdersOn = (landlord: LandlordCtx, d: Date) =>
    CONTRACTS.filter((c) => c.landlord === landlord && leaseCovers(c, d)).map((c) => c.renter);

  const MEETING_NOTES = ['Weekly team sync', 'Client presentation', 'Interview panel', 'Sprint planning', 'Vendor negotiation',
    'Quarterly business review', 'Training session', 'Board prep', 'Investor call', 'Project kick-off with the client', 'Budget review'];
  const CONFERENCE_NOTES = ['All-hands meeting', 'Workshop with the client team', 'Board meeting - coffee break at 10:30',
    'Partner training day', 'Hiring assessment centre', 'Strategy offsite'];
  const EVENT_NOTES = ['Product launch evening', 'Industry networking night', 'Annual customer forum', 'Graduation ceremony for trainees',
    'Press conference', 'Tech meetup', 'Client appreciation dinner'];

  const shortInvoices: { invoice: any; booking: any; renter: RenterCtx; landlord: LandlordCtx }[] = [];

  function priceFor(s: SpaceCtx, start: Date, end: Date) {
    const hours = (end.getTime() - start.getTime()) / 3_600_000;
    if (s.slot.type === 'HOT_DESK') return { hours, price: s.row.daily_rate, label: 'day pass' };
    if (hours >= 7.5 && s.row.daily_rate) return { hours, price: s.row.daily_rate, label: 'full day' };
    return { hours, price: money(s.row.hourly_rate * hours), label: `${hours % 1 ? hours.toFixed(1) : hours} h` };
  }

  function addShortBooking(o: {
    landlord: LandlordCtx; renter: RenterCtx; user: any; s: SpaceCtx; start: Date; end: Date; key: string;
    status?: string; created?: Date; notes?: string | null; attendees?: number; withAv?: boolean; r: Rng;
  }) {
    const { landlord, renter, user, s, start, end, r } = o;
    const lead: Record<string, [number, number]> = {
      MEETING_ROOM: [1, 7], CONFERENCE_ROOM: [3, 14], EVENT_SPACE: [14, 40], HOT_DESK: [0, 2], PHONE_BOOTH: [0, 1],
    };
    const [lo, hi] = lead[s.slot.type] ?? [1, 5];
    let created = o.created ?? addHours(start, -24 * between(r, lo, hi) - between(r, 1, 9));
    created = notBeforeGoLive(notAfterNow(created));

    let status = o.status;
    if (!status) {
      if (end <= NOW) {
        status = weighted(r, [['COMPLETED', 88], ['CANCELLED', 7], ['NO_SHOW', s.slot.type === 'EVENT_SPACE' ? 0 : 5]] as const);
      } else if (start <= NOW) {
        status = 'CHECKED_IN';
      } else {
        const fresh = NOW.getTime() - created.getTime() < 2.5 * 86_400_000;
        status = fresh && r() < 0.45 ? 'PENDING_APPROVAL' : r() < 0.04 ? 'CANCELLED' : 'CONFIRMED';
      }
    }

    const { hours, price, label } = priceFor(s, start, end);
    const addons: { addon: any; quantity: number; unit_price: number }[] = [];
    const catering = landlord.addons['Coffee break catering (per person)'];
    const av = landlord.addons['Event AV technician'];
    if (o.attendees && catering) addons.push({ addon: catering, quantity: fitRoom(s, o.attendees), unit_price: catering.price });
    if (o.withAv && av) addons.push({ addon: av, quantity: Math.ceil(hours), unit_price: av.price });

    let notes = o.notes ?? null;
    if (status === 'CANCELLED' && !o.status) notes = pickOne(r, ['Cancelled: meeting moved online', 'Cancelled by the tenant', 'Rejected: room held for building management']);

    const billable = ['COMPLETED', 'CHECKED_IN', 'CONFIRMED', 'NO_SHOW'].includes(status);
    const event = s.slot.type === 'EVENT_SPACE';
    // rooms are invoiced on approval; events get their final invoice the week before
    let issue = event ? notBeforeGoLive(at(addDays(start, -7), 10, 15)) : notAfterNow(addHours(created, 2 + between(r, 0, 20)));
    if (issue < created) issue = addHours(created, 1);
    let invoice: any = null;
    if (billable && issue <= NOW) {
      const due = new Date(Math.max(at(addDays(issue, 14), 17).getTime(), at(addDays(end, 7), 17).getTime()));
      const reliability = { pdc: 0.995, prompt: 0.99, late: 0.95, struggling: 0.85 }[renter.payer] ?? 0.97;
      let paidAt: Date | null = null;
      if (event) {
        if (r() < (end <= NOW ? reliability : 0.6)) paidAt = at(addDays(issue, between(r, 0, 4)), between(r, 9, 16), between(r, 0, 59));
      } else if (end <= NOW) {
        if (r() < reliability) paidAt = at(addDays(end, between(r, 0, 5)), between(r, 9, 17), between(r, 0, 59));
      } else if (r() < 0.2) {
        paidAt = at(addDays(issue, between(r, 0, 2)), between(r, 9, 17), between(r, 0, 59));
      }
      if (paidAt && paidAt < issue) paidAt = addHours(issue, 1);
      // a payment is never dated in the future — it simply has not happened yet
      if (paidAt && paidAt > NOW) paidAt = null;
      const settled: Settled = paidAt
        ? { status: 'PAID', paidAt }
        : { status: NOW > due ? 'OVERDUE' : r() < 0.7 ? 'SENT' : 'ISSUED', paidAt: null };
      const lines = [
        { description: `${s.row.name} - ${label} on ${dayLabel(start)}`, quantity: 1, unit_price: price },
        ...addons.map((a) => ({ description: a.addon.name.replace(' (per person)', '') + ` x ${a.quantity}`, quantity: a.quantity, unit_price: a.unit_price })),
      ];
      invoice = addInvoice({ renter, type: 'ONE_TIME_CHARGE', issue, due, lines, status: settled.status, key: o.key, paidAt: settled.paidAt });
      const method = invoice.total_amount < 1200 ? weighted(r, [['BANK_TRANSFER', 6], ['CASH', 4]] as const) : weighted(r, [['BANK_TRANSFER', 7], ['CHECK', 3]] as const);
      if (settled.status === 'PAID') {
        addPayment({ renter, landlord, invoice, amount: invoice.total_amount, method, when: settled.paidAt!, key: o.key });
      } else if (end <= NOW && NOW.getTime() - end.getTime() < 4 * 86_400_000 && method !== 'CASH' && r() < 0.35) {
        // the renter says it has paid; finance still has to confirm
        addPayment({
          renter, landlord, invoice, amount: invoice.total_amount, method, status: 'PENDING', key: o.key,
          when: notAfterNow(addHours(end, between(r, 12, 40))), reportedBy: user, withCheque: method === 'CHECK',
        });
      }
    }
    const booking = addBooking({
      renter, user, space: s, start, end, status, created, price, addons, notes,
      invoiceId: invoice?.id ?? null, key: o.key, attendees: o.attendees,
      receptionistId: ['EVENT_SPACE', 'CONFERENCE_ROOM'].includes(s.slot.type) && billable ? landlord.receptionists[0].id : null,
    });
    if (invoice) shortInvoices.push({ invoice, booking, renter, landlord });
    return booking;
  }

  const userOf = (slug: string, local: string) => RT[slug].users.find((u) => u.email.startsWith(`${local}@`));

  // Scripted first, so the demo accounts always have something to show.
  const scripted: { landlord: string; renter: string; local: string; space: string; day: Date; from: [number, number]; to: [number, number]; status?: string; notes: string; attendees?: number; av?: boolean }[] = [
    { landlord: 'msheireb', renter: 'acme-corp', local: 'employee', space: 'kbc-7m1', day: nextWorkday(1), from: [10, 0], to: [12, 0], status: 'CONFIRMED', notes: 'Sprint review with the client' },
    { landlord: 'msheireb', renter: 'acme-corp', local: 'employee', space: 'kbc-7c1', day: nextWorkday(3), from: [9, 0], to: [13, 0], status: 'PENDING_APPROVAL', notes: 'Hiring assessment morning - 12 candidates', attendees: 14 },
    { landlord: 'msheireb', renter: 'acme-corp', local: 'tenant.admin', space: 'brt-ge1', day: nextWorkday(8), from: [17, 0], to: [22, 0], status: 'PENDING_APPROVAL', notes: 'Acme Corp customer evening - 90 guests', attendees: 90, av: true },
    { landlord: 'msheireb', renter: 'sidra-data-labs', local: 'tenant.admin', space: 'brt-15c1', day: nextWorkday(2), from: [9, 0], to: [17, 0], status: 'CONFIRMED', notes: 'Board meeting - coffee break at 10:30', attendees: 16 },
    { landlord: 'msheireb', renter: 'qitaf-pharma', local: 'employee', space: 'brt-gm1', day: nextWorkday(1), from: [14, 0], to: [16, 0], status: 'PENDING_APPROVAL', notes: 'Distributor onboarding session' },
    { landlord: 'west-bay', renter: 'qatar-fintech', local: 'employee', space: 'ctw-12m1', day: nextWorkday(1), from: [11, 0], to: [12, 30], status: 'CONFIRMED', notes: 'Investor call' },
    { landlord: 'west-bay', renter: 'dhow-capital', local: 'employee', space: 'ctw-25c1', day: nextWorkday(2), from: [9, 0], to: [13, 0], status: 'CONFIRMED', notes: 'Quarterly LP update', attendees: 18 },
    { landlord: 'west-bay', renter: 'mawared-hr', local: 'employee', space: 'dbh-10m1', day: nextWorkday(2), from: [10, 0], to: [11, 0], status: 'PENDING_APPROVAL', notes: 'Candidate interviews' },
    { landlord: 'lusail-hub', renter: 'oryx-software', local: 'employee', space: 'fhw-1m1', day: nextWorkday(1), from: [10, 0], to: [11, 0], status: 'CONFIRMED', notes: 'Daily stand-up with the Doha team' },
    { landlord: 'lusail-hub', renter: 'zubarah-travel', local: 'tenant.admin', space: 'm21-ge1', day: nextWorkday(6), from: [18, 0], to: [22, 0], status: 'PENDING_APPROVAL', notes: 'Winter season launch for travel partners', attendees: 70, av: true },
  ];
  for (const sc of scripted) {
    const s = space(sc.space);
    const start = at(sc.day, ...sc.from);
    const end = at(sc.day, ...sc.to);
    addShortBooking({
      landlord: LL[sc.landlord], renter: RT[sc.renter], user: userOf(sc.renter, sc.local), s, start, end,
      key: `scripted:${sc.space}:${ymd(sc.day)}`, status: sc.status, notes: sc.notes, attendees: sc.attendees, withAv: sc.av,
      created: notAfterNow(at(addDays(TODAY, sc.status === 'PENDING_APPROVAL' ? 0 : -2), 9, 20)),
      r: keyed(`scripted:${sc.space}`),
    });
  }

  // A cancelled event that had been paid for, refunded — so refunds show up.
  {
    const landlord = LL.msheireb;
    const renter = RT['falcon-media'];
    const s = space('brt-ge1');
    let day = addDays(TODAY, -19);
    while (!isWorkday(day)) day = addDays(day, -1);
    const created = at(addDays(day, -30), 12, 10);
    const invoiceDay = at(addDays(created, 0), 15, 0);
    const lines = [
      { description: `${s.row.name} - full day on ${dayLabel(day)}`, quantity: 1, unit_price: s.row.daily_rate },
      { description: 'Coffee break catering x 80', quantity: 80, unit_price: landlord.addons['Coffee break catering (per person)'].price },
    ];
    const invoice = addInvoice({ renter, type: 'ONE_TIME_CHARGE', issue: invoiceDay, due: at(addDays(invoiceDay, 14), 17), lines, status: 'CANCELLED', key: 'falcon-refund' });
    const paid = at(addDays(invoiceDay, 3), 10, 30);
    const pay = addPayment({ renter, landlord, invoice, amount: invoice.total_amount, method: 'BANK_TRANSFER', when: paid, key: 'falcon-refund', status: 'REFUNDED' });
    pay.updated_at = at(addDays(day, -4), 12, 0);
    pay.paid_at = paid;
    addBooking({
      renter, user: renter.admin, space: s, start: at(day, 9), end: at(day, 18), status: 'CANCELLED', created,
      price: s.row.daily_rate, notes: 'Cancelled: launch postponed by the client - payment refunded', invoiceId: invoice.id, key: 'falcon-refund',
      attendees: 80,
    });
  }

  // Events are planned rather than drawn at random: a handful in spring, none
  // in the summer heat, and the autumn season picking up — the way Doha's
  // event calendar actually runs. Negative daysAgo = still to come.
  const EVENTS: { landlord: string; space: string; renter: string; daysAgo: number; evening: boolean; title: string; guests: number; status?: string }[] = [
    { landlord: 'msheireb', space: 'brt-ge1', renter: 'qitaf-pharma', daysAgo: 140, evening: false, title: 'Distributor summit', guests: 110 },
    { landlord: 'msheireb', space: 'brt-ge1', renter: 'doha-design', daysAgo: 124, evening: true, title: 'Exhibition opening night', guests: 90 },
    { landlord: 'msheireb', space: 'brt-ge1', renter: 'al-jasra-engineering', daysAgo: 96, evening: false, title: 'Engineering safety day', guests: 70 },
    { landlord: 'msheireb', space: 'brt-ge1', renter: 'brightpath-training', daysAgo: 17, evening: true, title: 'Graduation ceremony for trainees', guests: 120 },
    { landlord: 'msheireb', space: 'brt-ge1', renter: 'sidra-data-labs', daysAgo: 6, evening: true, title: 'Doha AI meetup', guests: 100 },
    { landlord: 'msheireb', space: 'brt-ge1', renter: 'falcon-media', daysAgo: -12, evening: true, title: 'Documentary screening night', guests: 80, status: 'CONFIRMED' },
    { landlord: 'west-bay', space: 'ctw-25e1', renter: 'dhow-capital', daysAgo: 136, evening: true, title: 'Investor reception', guests: 60 },
    { landlord: 'west-bay', space: 'ctw-25e1', renter: 'sealine-energy', daysAgo: 118, evening: false, title: 'Annual safety awards', guests: 80 },
    { landlord: 'west-bay', space: 'ctw-25e1', renter: 'qatar-fintech', daysAgo: 19, evening: true, title: 'Payments innovation meetup', guests: 110 },
    { landlord: 'west-bay', space: 'ctw-25e1', renter: 'mawared-hr', daysAgo: 1, evening: true, title: 'Graduate career evening', guests: 90 },
    { landlord: 'west-bay', space: 'ctw-25e1', renter: 'pearl-logistics', daysAgo: -9, evening: false, title: 'Customer forum', guests: 70, status: 'CONFIRMED' },
    { landlord: 'lusail-hub', space: 'm21-ge1', renter: 'oryx-software', daysAgo: 131, evening: false, title: 'Hackathon kick-off', guests: 100 },
    { landlord: 'lusail-hub', space: 'm21-ge1', renter: 'gulf-consulting', daysAgo: 13, evening: true, title: 'Client forum', guests: 80 },
    { landlord: 'lusail-hub', space: 'm21-ge1', renter: 'oryx-software', daysAgo: 4, evening: false, title: 'Product demo day', guests: 120 },
  ];
  for (const ev of EVENTS) {
    const s = space(ev.space);
    const renter = RT[ev.renter];
    const r = keyed(`event:${ev.space}:${ev.daysAgo}`);
    let day = addDays(TODAY, -ev.daysAgo);
    let start = at(day, ev.evening ? 17 : 9);
    let end = at(day, ev.evening ? 22 : 18);
    for (let shift = 0; shift < 4 && !isFree(s.row.id, start, end); shift++) {
      day = addDays(day, 1);
      start = at(day, ev.evening ? 17 : 9);
      end = at(day, ev.evening ? 22 : 18);
    }
    addShortBooking({
      landlord: LL[ev.landlord], renter, user: renter.admin, s, start, end, key: `event:${ev.space}:${ymd(day)}`,
      status: ev.status ?? (end <= NOW ? 'COMPLETED' : start <= NOW ? 'CHECKED_IN' : 'CONFIRMED'),
      created: notBeforeGoLive(notAfterNow(at(addDays(start, -between(r, 28, 40)), 11, 30))),
      notes: `${ev.title} - ${fitRoom(s, ev.guests)} guests`, attendees: fitRoom(s, ev.guests), withAv: true, r,
    });
  }

  const SEASON: Record<number, number> = { 0: 1.1, 1: 1.1, 2: 1.05, 3: 1, 4: 1, 5: 0.85, 6: 0.6, 7: 0.5, 8: 1.15, 9: 1.35, 10: 1.3, 11: 1.15 };
  const BASE_RATE: Record<string, number> = { msheireb: 1.5, 'west-bay': 1.15, 'lusail-hub': 0.9 };
  const TYPE_WEIGHTS: [SpaceType, number][] = [['MEETING_ROOM', 54], ['CONFERENCE_ROOM', 18], ['PHONE_BOOTH', 12], ['HOT_DESK', 16]];

  for (const landlord of Object.values(LL)) {
    const byType = (t: SpaceType) => landlord.spaces.filter((s) => s.slot.type === t);
    for (let d = new Date(GO_LIVE); d <= addDays(TODAY, 20); d = addDays(d, 1)) {
      if (!isWorkday(d)) continue;
      const r = keyed(`day:${landlord.def.key}:${ymd(d)}`);
      const ahead = (d.getTime() - TODAY.getTime()) / 86_400_000;
      const fade = ahead > 0 ? Math.max(0.15, 1 - ahead / 24) : 1;
      const n = Math.floor(BASE_RATE[landlord.def.key] * SEASON[d.getMonth()] * fade + r());
      for (let j = 0; j < n; j++) {
        const type = weighted(r, TYPE_WEIGHTS);
        let candidates = byType(type);
        if (type === 'HOT_DESK') candidates = candidates.filter((s) => s.row.status === 'AVAILABLE');
        if (d >= TODAY) candidates = candidates.filter((s) => s.row.status !== 'MAINTENANCE');
        if (!candidates.length) continue;
        const s = pickOne(r, candidates);

        let start: Date | null = null;
        let end: Date | null = null;
        for (let attempt = 0; attempt < 6 && !start; attempt++) {
          let a: Date;
          let b: Date;
          if (type === 'MEETING_ROOM') {
            a = at(d, pickOne(r, [8, 9, 10, 11, 13, 14, 15, 16]), pickOne(r, [0, 0, 30]));
            b = addHours(a, pickOne(r, [1, 1, 1.5, 2, 2, 3]));
          } else if (type === 'CONFERENCE_ROOM') {
            const shape = weighted(r, [['am', 30], ['pm', 30], ['short', 25], ['day', 15]] as const);
            a = shape === 'pm' ? at(d, 13) : shape === 'short' ? at(d, pickOne(r, [9, 11, 14])) : at(d, 9);
            b = shape === 'day' ? at(d, 17) : shape === 'short' ? addHours(a, 2) : addHours(a, 4);
          } else if (type === 'PHONE_BOOTH') {
            a = at(d, between(r, 9, 17), pickOne(r, [0, 30]));
            b = addHours(a, pickOne(r, [0.5, 1, 1]));
          } else if (type === 'HOT_DESK') {
            a = at(d, 8);
            b = at(d, 18);
          } else {
            const evening = r() < 0.5;
            a = evening ? at(d, 17) : at(d, 9);
            b = evening ? at(d, 22) : at(d, 18);
          }
          if (isFree(s.row.id, a, b)) { start = a; end = b; }
        }
        if (!start) continue;

        const holders = leaseholdersOn(landlord, d);
        const renter = holders.length && r() < 0.8 ? pickOne(r, holders) : pickOne(r, tradingRenters);
        const people = activeUsers(renter);
        if (!people.length) continue;
        const user = r() < 0.3 ? renter.admin.status === 'ACTIVE' ? renter.admin : people[0] : pickOne(r, people);
        let notes: string | null = null;
        let attendees: number | undefined;
        if (type === 'MEETING_ROOM') {
          notes = r() < 0.7 ? pickOne(r, MEETING_NOTES) : null;
          if (r() < 0.15) attendees = fitRoom(s, between(r, 4, 8));
        } else if (type === 'CONFERENCE_ROOM') {
          notes = pickOne(r, CONFERENCE_NOTES);
          if (r() < 0.5) attendees = fitRoom(s, between(r, 10, 20));
        } else if (type === 'EVENT_SPACE') {
          const title = pickOne(r, EVENT_NOTES);
          attendees = fitRoom(s, between(r, 4, 12) * 10);
          r(); // formerly a second, unrelated guest count — still drawn so the rows after it keep their values
          notes = `${title} - ${attendees} guests`;
        }
        addShortBooking({
          landlord, renter, user, s, start, end: end!, key: `short:${s.row.slug}:${start.toISOString()}`,
          notes, attendees, withAv: type === 'EVENT_SPACE' && r() < 0.6, r,
        });
      }
    }
  }

  // Every finance officer gets a couple of renter-reported payments to confirm.
  for (const ll of Object.values(LL)) {
    const ours = (invoiceId: string) => R.bookings.some((b) => b.invoice_id === invoiceId && ll.spaces.some((s) => s.row.id === b.space_id));
    const pending = R.payments.filter((p) => p.status === 'PENDING' && ours(p.invoice_id)).length;
    const candidates = shortInvoices
      .filter((x) => x.landlord === ll && ['SENT', 'ISSUED'].includes(x.invoice.status) && x.booking.end_time <= NOW
        && !R.payments.some((p) => p.invoice_id === x.invoice.id))
      .sort((a, b) => b.booking.end_time - a.booking.end_time)
      .slice(0, Math.max(0, 2 - pending));
    for (const c of candidates) {
      const method = c.invoice.total_amount >= 1200 ? 'CHECK' : 'BANK_TRANSFER';
      addPayment({
        renter: c.renter, landlord: ll, invoice: c.invoice, amount: c.invoice.total_amount, method, status: 'PENDING',
        key: `pending:${c.invoice.invoice_number}`, when: notAfterNow(addHours(c.booking.end_time, 20)),
        reportedBy: R.users.find((u) => u.id === c.booking.user_id), withCheque: method === 'CHECK',
      });
    }
  }

  // ── 10. tenant applications (Typeform) and prospects ──────────────────
  for (const c of CONTRACTS) {
    if (!c.lease || !c.renter.def) continue;
    // one settled application per renter — the first landlord it signed with
    if (R.tenantApplications.some((a) => a.applicant_tenant_id === c.renter.row.id)) continue;
    const firstLease = LEASES.filter((l) => l.renter === c.lease.renter).sort((a, b) => a.start - b.start)[0];
    if (firstLease !== c.lease) continue;
    const created = c.renter.row.created_at;
    R.tenantApplications.push({
      id: randomUUID(), landlord_tenant_id: c.landlord.row.id, space_id: c.spaces[0].row.id,
      status: 'APPROVED', typeform_response_id: `tf_${hex8(`tf:${c.renter.row.slug}`).toLowerCase()}`,
      applicant_tenant_id: c.renter.row.id, contact_email: c.renter.row.contact_email, company_name: c.renter.row.name,
      raw_payload: { source: 'typeform', form_id: process.env.TYPEFORM_FORM_ID ?? 'demo', answers: { industry: c.renter.def.sector, headcount: c.renter.def.headcount, preferred_space: c.spaces[0].row.name } },
      created_at: created, updated_at: addDays(created, 2),
    });
  }

  const prospectApps: { name: string; landlord: LandlordCtx; created: Date; space: SpaceCtx; headcount: number; sector: string }[] = [];
  for (const p of PROSPECTS) {
    const landlord = LL[p.landlord];
    const s = space(p.space);
    const created = notAfterNow(at(addDays(TODAY, -p.daysAgo), 8 + (p.daysAgo % 9), 25));
    const docs = [
      { kind: 'CR copy', url: samplePdf(`${p.slug}-cr`, 'Commercial registration (CR) copy', [`Company: ${p.name}`, `Sector: ${p.sector}`, `CR number: ${100000 + (hash32(p.slug) % 899999)}`, 'Issued by: Ministry of Commerce and Industry (sample)']) },
      { kind: 'Trade licence', url: samplePdf(`${p.slug}-licence`, 'Trade licence copy', [`Company: ${p.name}`, `Activity: ${p.sector}`, `Valid until: ${dayLabel(addDays(TODAY, 300))}`]) },
      { kind: 'Signatory QID', url: samplePdf(`${p.slug}-qid`, 'Signatory QID copy (placeholder)', [`Signatory: ${p.contact[0]} ${p.contact[1]}`, `Company: ${p.name}`, 'Placeholder for the authorised signatory ID copy.']) },
    ];
    const prospect = addTenant({
      name: p.name, slug: p.slug, contact_email: `hello@${p.slug}.test`, status: 'PENDING', subscription_plan: 'basic',
      organization_type: 'RENTER', max_users: 10, max_spaces: 3,
      application_profile: {
        sector: p.sector, headcount: p.headcount, moveIn: dayLabel(addDays(TODAY, 25 + p.daysAgo * 3)),
        contact_name: `${p.contact[0]} ${p.contact[1]}`, phone: phoneFor(p.slug), preferred_space: s.row.name,
        budget_qar_month: roundTo(p.headcount * 1100, 500),
      },
      application_documents: docs,
      created_at: created,
    });
    R.tenantApplications.push({
      id: randomUUID(), landlord_tenant_id: landlord.row.id, space_id: s.row.id, status: 'SUBMITTED',
      typeform_response_id: `tf_${hex8(`tf:${p.slug}`).toLowerCase()}`, applicant_tenant_id: prospect.id,
      contact_email: `hello@${p.slug}.test`, company_name: p.name,
      raw_payload: { source: 'typeform', answers: { industry: p.sector, headcount: p.headcount, preferred_space: s.row.name } },
      created_at: created, updated_at: created,
    });
    prospectApps.push({ name: p.name, landlord, created, space: s, headcount: p.headcount, sector: p.sector });
  }

  // a rejected applicant, suspended as TenantApplicationService.reject() leaves it
  const mirage = addTenant({
    name: 'Mirage Events Co.', slug: 'mirage-events', contact_email: 'hello@mirage-events.test', status: 'SUSPENDED',
    subscription_plan: 'basic', organization_type: 'RENTER', max_users: 10, max_spaces: 3,
    application_profile: { sector: 'Events', headcount: 5 }, created_at: at(addDays(TODAY, -22), 13, 5),
  });
  R.tenantApplications.push({
    id: randomUUID(), landlord_tenant_id: LL['west-bay'].row.id, space_id: space('ctw-25e1').row.id, status: 'REJECTED',
    typeform_response_id: 'tf_mirage01', applicant_tenant_id: mirage.id, contact_email: 'hello@mirage-events.test',
    company_name: 'Mirage Events Co.', raw_payload: { source: 'typeform', answers: { industry: 'Events', headcount: 5 } },
    created_at: at(addDays(TODAY, -22), 13, 5), updated_at: at(addDays(TODAY, -20), 10, 0),
  });

  // ── 11. maintenance ───────────────────────────────────────────────────
  type TicketCtx = { row: any; landlord: LandlordCtx; s: SpaceCtx; staffRaised: boolean };
  const TK: TicketCtx[] = [];
  const periodBookingFor = (s: SpaceCtx, when: Date) =>
    R.bookings.find((b) => b.space_id === s.row.id && b.start_time <= when && b.end_time >= when && (b.notes ?? '').startsWith('Monthly lease'));
  const holderOf = (s: SpaceCtx, when: Date) =>
    CONTRACTS.find((c) => c.spaces.includes(s) && leaseCovers(c, when))?.renter ?? null;

  function addTicket(t: {
    landlord: LandlordCtx; s: SpaceCtx; category: string; title: string; description: string; priority: string; status: string;
    reported: Date; reporter: any; reporterTenant: any; assignee?: any; key: string; resolvedAfterHours?: number; staffRaised: boolean;
  }) {
    const r = keyed(`ticket:${t.key}`);
    const resolved = ['RESOLVED', 'CLOSED'].includes(t.status);
    const [lo, hi] = FIX_HOURS[t.priority] ?? [24, 72];
    const resolvedAt = resolved ? notAfterNow(addHours(t.reported, t.resolvedAfterHours ?? between(r, lo, hi))) : null;
    const [c0, c1] = COST_RANGE[t.category] ?? [0, 300];
    const equipment = ['HVAC', 'ELECTRICAL', 'IT_EQUIPMENT'].includes(t.category);
    const booking = t.staffRaised ? null : periodBookingFor(t.s, t.reported);
    const row = {
      id: randomUUID(),
      tenant_id: t.reporterTenant.id,
      space_id: t.s.row.id,
      booking_id: booking?.id ?? null,
      user_id: t.reporter.id,
      created_by_user_id: t.reporter.id,
      ticket_number: numbered((x) => `TK-${ymd(t.reported)}-${hex8(x)}`, `tk:${t.key}`),
      title: t.title,
      description: t.description,
      category: t.category,
      priority: t.priority,
      status: t.status,
      assigned_to: t.assignee?.id ?? null,
      cost: resolved ? roundTo(between(r, c0, c1), 10) : null,
      crisp_session_id: null,
      equipment_installed_at: equipment ? new Date(t.s.building.built + between(r, 0, 3), between(r, 0, 11), 1) : null,
      usage_hours_estimate: t.category === 'HVAC' ? between(r, 30, 92) * 100 : t.category === 'IT_EQUIPMENT' ? between(r, 15, 60) * 100 : null,
      reported_at: t.reported,
      resolved_at: resolvedAt,
      created_at: t.reported,
      updated_at: resolvedAt ?? notAfterNow(addHours(t.reported, t.status === 'OPEN' ? 0 : between(r, 1, 20))),
    };
    R.tickets.push(row);
    TK.push({ row, landlord: t.landlord, s: t.s, staffRaised: t.staffRaised });
    return row;
  }

  const techFor = (landlord: LandlordCtx, category: string, r: Rng) => {
    const fits = Object.entries(landlord.def.specialism).filter(([, cats]) => cats.includes(category)).map(([local]) => landlord.staff[local]);
    return fits.length && r() < 0.85 ? pickOne(r, fits) : pickOne(r, landlord.techs);
  };

  const SCRIPTED_TICKETS: Record<string, { space: string; category: string; priority: string; status: string; title: string; description: string; minutesAgo: number; by: [string, string] | ['staff', string]; tech?: string }[]> = {
    msheireb: [
      { space: 'kbc-3m1', category: 'HVAC', priority: 'EMERGENCY', status: 'OPEN', title: 'Water leaking from the AC unit onto the ceiling tiles', description: 'Water is dripping through two ceiling tiles above the table. We moved the chairs and put a bin underneath.', minutesAgo: 50, by: ['staff', 'reception'] },
      { space: 'kbc-302', category: 'ELECTRICAL', priority: 'URGENT', status: 'IN_PROGRESS', title: 'No power to the sockets along the window wall', description: "Six desks have had no power since the morning and the breaker won't reset.", minutesAgo: 20 * 60, by: ['acme-corp', 'employee'], tech: 'tech' },
      { space: 'kbc-7m1', category: 'IT_EQUIPMENT', priority: 'HIGH', status: 'ASSIGNED', title: "Meeting room screen won't detect laptops", description: 'Neither HDMI nor wireless casting shows a picture on the 65" display.', minutesAgo: 2 * 24 * 60, by: ['sidra-data-labs', 'employee'], tech: 'tech2' },
      { space: 'swo-501', category: 'PLUMBING', priority: 'NORMAL', status: 'OPEN', title: 'Kitchenette tap dripping constantly', description: 'Steady drip from the mixer tap, worse when it is turned off fully.', minutesAgo: 3 * 60, by: ['doha-design', 'employee'] },
      { space: 'kbc-7fa', category: 'FURNITURE', priority: 'NORMAL', status: 'ASSIGNED', title: 'Two chairs with broken gas lifts', description: 'Two task chairs sink to the lowest position when you sit down.', minutesAgo: 26 * 60, by: ['sidra-data-labs', 'tenant.admin'], tech: 'tech3' },
      { space: 'brt-9h1', category: 'IT_EQUIPMENT', priority: 'HIGH', status: 'IN_PROGRESS', title: 'Badge reader at the Level 9 entrance rejects cards', description: 'The reader beeps red for valid cards about half the time; visitors are queuing at the door.', minutesAgo: 2 * 24 * 60 + 200, by: ['staff', 'reception2'], tech: 'tech2' },
      { space: 'brt-15c1', category: 'ELECTRICAL', priority: 'HIGH', status: 'ASSIGNED', title: 'Emergency exit sign above the boardroom door is out', description: 'Found during the weekly walk-round - needs fixing before the fire drill.', minutesAgo: 22 * 60, by: ['staff', 'manager'], tech: 'tech' },
      { space: 'brt-1502', category: 'OTHER', priority: 'LOW', status: 'OPEN', title: 'Scuffed paint along the corridor wall', description: 'Marks from a furniture delivery along the wall outside the suite.', minutesAgo: 4 * 24 * 60, by: ['al-jasra-engineering', 'employee'] },
    ],
    'west-bay': [
      { space: 'dbh-4c1', category: 'ELECTRICAL', priority: 'URGENT', status: 'OPEN', title: 'Projector and ceiling speakers dead after a power surge', description: 'Everything on the AV rack went off during the storm; the room cannot be used for presentations.', minutesAgo: 3 * 60, by: ['staff', 'reception'] },
      { space: 'ctw-1201', category: 'HVAC', priority: 'HIGH', status: 'IN_PROGRESS', title: 'AC not cooling - room at 28°C', description: 'The temperature keeps climbing after lunch even with the thermostat at 21.', minutesAgo: 24 * 60, by: ['qatar-fintech', 'employee'], tech: 'tech' },
      { space: 'dbh-1001', category: 'PLUMBING', priority: 'NORMAL', status: 'ASSIGNED', title: 'Blocked sink drain in the kitchenette', description: 'Water takes several minutes to drain.', minutesAgo: 2 * 24 * 60, by: ['pearl-logistics', 'employee'], tech: 'tech2' },
      { space: 'dbh-4fa', category: 'IT_EQUIPMENT', priority: 'HIGH', status: 'OPEN', title: 'Wi-Fi keeps dropping every few minutes', description: 'The whole team zone loses connection every 5-10 minutes since yesterday.', minutesAgo: 5 * 60, by: ['sadeem-robotics', 'employee'] },
      { space: 'ctw-25e1', category: 'CLEANING', priority: 'HIGH', status: 'ASSIGNED', title: "Deep clean needed after last night's event", description: 'Sky Lounge needs a full clean before tomorrow morning.', minutesAgo: 10 * 60, by: ['staff', 'manager'], tech: 'tech2' },
    ],
    'lusail-hub': [
      { space: 'm21-gc1', category: 'HVAC', priority: 'URGENT', status: 'OPEN', title: 'AC tripped - room unusable in the afternoon heat', description: 'The unit keeps tripping; the room reached 31°C by 2 pm.', minutesAgo: 60, by: ['staff', 'reception'] },
      { space: 'fhw-1fa', category: 'ELECTRICAL', priority: 'NORMAL', status: 'ASSIGNED', title: 'Flickering ceiling lights above the team zone', description: 'Three panels flicker on and off all day.', minutesAgo: 24 * 60, by: ['oryx-software', 'employee'], tech: 'tech' },
      { space: 'm21-1401', category: 'FURNITURE', priority: 'LOW', status: 'OPEN', title: 'Desk drawer lock stuck', description: 'The key turns but the drawer stays locked.', minutesAgo: 2 * 24 * 60, by: ['gulf-consulting', 'employee'] },
      { space: 'fhw-301', category: 'PLUMBING', priority: 'HIGH', status: 'IN_PROGRESS', title: 'Water leak under the pantry counter', description: 'Water is pooling under the cabinet; we put towels down.', minutesAgo: 6 * 60, by: ['zubarah-travel', 'employee'], tech: 'tech' },
    ],
  };

  // Track records the triage assistant reads: past fixes by technician.
  const HISTORY: Record<string, { space: string; category: string; priority: string; title: string; description: string; tech: string; daysAgo: number; status?: string }[]> = {
    msheireb: [
      { space: 'kbc-3m1', category: 'HVAC', priority: 'HIGH', title: 'AC not cooling in Zubarah Room', description: 'Room at 28°C during a client meeting. Fix: low refrigerant, recharged and tested.', tech: 'tech', daysAgo: 78 },
      { space: 'kbc-3m1', category: 'HVAC', priority: 'HIGH', title: 'Condensate drain blocked above Zubarah Room', description: 'Drip tray overflowing into the ceiling void. Fix: drain line flushed and cleared.', tech: 'tech', daysAgo: 41 },
      { space: 'kbc-302', category: 'ELECTRICAL', priority: 'HIGH', title: 'Breaker tripping in the Suite 302 kitchenette', description: 'Power drops when the kettle and microwave run together. Fix: load split onto a second breaker.', tech: 'tech', daysAgo: 64 },
      { space: 'kbc-3fa', category: 'ELECTRICAL', priority: 'NORMAL', title: 'Floor-box socket dead in Flex Zone 3A', description: 'No power at desk 4. Fix: burnt contact in the floor box, socket replaced.', tech: 'tech', daysAgo: 37 },
      { space: 'brt-9pa', category: 'ELECTRICAL', priority: 'HIGH', title: 'Emergency lighting failed the monthly test on Level 9', description: 'Two fittings failed the 3-hour test. Fix: batteries replaced and retested.', tech: 'tech', daysAgo: 23 },
      { space: 'swo-501', category: 'ELECTRICAL', priority: 'NORMAL', title: 'Flickering LED panels in Suite 501', description: 'Two panels flickering near the window. Fix: LED drivers replaced.', tech: 'tech', daysAgo: 12 },
      { space: 'kbc-7pa', category: 'ELECTRICAL', priority: 'NORMAL', title: 'Power keeps tripping in Booth 7A', description: 'Booth loses power a few times a day. Fix: loose termination on the spur, rewired and tested.', tech: 'tech3', daysAgo: 95, status: 'CLOSED' },
      { space: 'brt-1501', category: 'HVAC', priority: 'NORMAL', title: 'Weak cooling in Suite 1501', description: 'The suite gets warm every afternoon. Fix: refrigerant topped up, filters cleaned.', tech: 'tech', daysAgo: 102, status: 'CLOSED' },
      { space: 'swo-5m1', category: 'PLUMBING', priority: 'NORMAL', title: 'Leak under the pantry sink by Al Wakra Room', description: 'Small puddle under the pantry sink. Fix: trap resealed.', tech: 'tech2', daysAgo: 58 },
      { space: 'brt-gm2', category: 'IT_EQUIPMENT', priority: 'HIGH', title: 'No picture on the Fuwairit Room display', description: 'HDMI shows no signal. Fix: faulty wall-plate termination redone.', tech: 'tech2', daysAgo: 30 },
    ],
    'west-bay': [
      { space: 'ctw-1202', category: 'HVAC', priority: 'HIGH', title: 'AC fan stopped in Suite 1202', description: 'No airflow from the vents. Fix: seized fan-coil motor replaced.', tech: 'tech', daysAgo: 70 },
      { space: 'dbh-4m1', category: 'ELECTRICAL', priority: 'NORMAL', title: 'Lights dimming across Level 4', description: 'Lights dim on and off across the floor. Fix: loose neutral re-terminated.', tech: 'tech', daysAgo: 33 },
      { space: 'dbh-10m1', category: 'IT_EQUIPMENT', priority: 'NORMAL', title: 'Casting keeps dropping in Al Bidda Room', description: 'Wireless casting drops every few minutes. Fix: display firmware updated.', tech: 'tech2', daysAgo: 18 },
    ],
    'lusail-hub': [
      { space: 'm21-gc1', category: 'HVAC', priority: 'HIGH', title: 'AC tripping in Erkyah Hall', description: 'Unit trips on high pressure in the afternoon. Fix: condenser coil cleaned.', tech: 'tech', daysAgo: 52 },
      { space: 'fhw-1c1', category: 'IT_EQUIPMENT', priority: 'NORMAL', title: 'Camera drops out in Conference 1', description: 'The camera disconnects during Teams calls. Fix: USB hub replaced.', tech: 'tech2', daysAgo: 27 },
    ],
  };

  const RANDOM_TICKETS: Record<string, number> = { msheireb: 30, 'west-bay': 22, 'lusail-hub': 18 };
  const CATEGORY_WEIGHTS: [string, number][] = [['HVAC', 25], ['ELECTRICAL', 18], ['PLUMBING', 15], ['IT_EQUIPMENT', 17], ['CLEANING', 10], ['FURNITURE', 10], ['OTHER', 5]];

  for (const landlord of Object.values(LL)) {
    const key = landlord.def.key;
    const staffPool = [landlord.manager, ...landlord.receptionists, ...landlord.managers.slice(1)];

    for (const [i, t] of SCRIPTED_TICKETS[key].entries()) {
      const s = space(t.space);
      const reported = minutesAgo(t.minutesAgo);
      const staffRaised = t.by[0] === 'staff';
      const reporter = staffRaised ? landlord.staff[t.by[1]] : userOf(t.by[0], t.by[1]);
      addTicket({
        landlord, s, category: t.category, title: t.title, description: t.description, priority: t.priority, status: t.status,
        reported, reporter, reporterTenant: staffRaised ? landlord.row : RT[t.by[0]].row,
        assignee: t.tech ? landlord.staff[t.tech] : null, key: `scripted:${key}:${i}`, staffRaised,
      });
    }

    for (const [i, h] of HISTORY[key].entries()) {
      const s = space(h.space);
      const reported = at(addDays(TODAY, -h.daysAgo), 9 + (i % 7), (i * 11) % 60);
      const holder = holderOf(s, reported);
      const reporter = holder ? activeUsers(holder)[0] ?? holder.admin : landlord.manager;
      addTicket({
        landlord, s, category: h.category, title: h.title, description: h.description, priority: h.priority,
        status: h.status ?? 'RESOLVED', reported, reporter, reporterTenant: holder ? holder.row : landlord.row,
        assignee: landlord.staff[h.tech], key: `history:${key}:${i}`, staffRaised: !holder,
      });
    }

    for (let i = 0; i < RANDOM_TICKETS[key]; i++) {
      const r = keyed(`randticket:${key}:${i}`);
      const span = NOW.getTime() - GO_LIVE.getTime();
      const reported = new Date(GO_LIVE.getTime() + Math.pow(r(), 0.8) * (span - 4 * 86_400_000));
      // weekend reports roll forward to Sunday, never back out of the window
      while (!isWorkday(reported)) reported.setDate(reported.getDate() + 1);
      reported.setHours(between(r, 8, 17), between(r, 0, 59), 0, 0);
      const category = weighted(r, CATEGORY_WEIGHTS);
      const [title, description, basePriority] = pickOne(r, TICKETS[category]);
      const priority = r() < 0.15 ? pickOne(r, ['URGENT', 'HIGH', 'NORMAL']) : basePriority;
      const s = pickOne(r, landlord.spaces);
      const holder = holderOf(s, reported);
      const staffRaised = !holder || r() < 0.15;
      const reporter = staffRaised ? pickOne(r, staffPool) : pickOne(r, activeUsers(holder!).length ? activeUsers(holder!) : [holder!.admin]);
      const age = (NOW.getTime() - reported.getTime()) / 86_400_000;
      const status = age > 10 ? weighted(r, [['RESOLVED', 55], ['CLOSED', 40], ['CANCELLED', 5]] as const)
        : weighted(r, [['RESOLVED', 50], ['IN_PROGRESS', 20], ['ASSIGNED', 15], ['CLOSED', 15]] as const);
      addTicket({
        landlord, s, category, title, description, priority, status, reported, reporter,
        reporterTenant: staffRaised ? landlord.row : holder!.row,
        assignee: status === 'CANCELLED' && r() < 0.5 ? null : techFor(landlord, category, r),
        key: `random:${key}:${i}`, staffRaised,
      });
    }
  }

  // ── 12. onboarding drip, sessions ─────────────────────────────────────
  const sentBy = (baseline: Date, d: number) => {
    const at_ = addDays(baseline, d);
    return at_ <= NOW ? at_ : null;
  };
  for (const ll of Object.values(LL)) {
    const b = addDays(ll.row.created_at, 1);
    R.onboarding.push({ id: randomUUID(), tenant_id: ll.row.id, baseline_at: b, day0_sent_at: b, day1_sent_at: sentBy(b, 1), day3_sent_at: sentBy(b, 3), day7_sent_at: sentBy(b, 7), day30_sent_at: sentBy(b, 30), created_at: b, updated_at: b });
  }
  for (const renter of Object.values(RT)) {
    const first = CONTRACTS.filter((c) => c.renter === renter && ['ACTIVE', 'RENEWED', 'EXPIRED', 'TERMINATED'].includes(c.row.status) && c.row.start_date <= NOW)
      .sort((a, b) => a.row.start_date - b.row.start_date)[0];
    if (!first) continue;
    const b = first.row.start_date;
    R.onboarding.push({ id: randomUUID(), tenant_id: renter.row.id, baseline_at: b, day0_sent_at: b, day1_sent_at: sentBy(b, 1), day3_sent_at: sentBy(b, 3), day7_sent_at: sentBy(b, 7), day30_sent_at: sentBy(b, 30), created_at: b, updated_at: b });
  }

  // ── 13. notifications ─────────────────────────────────────────────────
  const notify = (n: { user: any; type: string; title: string; message: string; when: Date; priority?: string; channel?: string; read?: boolean; data?: Record<string, unknown> }) => {
    const when = notAfterNow(n.when);
    const read = n.read ?? NOW.getTime() - when.getTime() > 3 * 86_400_000;
    R.notifications.push({
      id: randomUUID(), tenant_id: n.user.tenant_id, user_id: n.user.id, title: n.title, message: n.message, type: n.type,
      channel: n.channel ?? 'IN_APP', priority: n.priority ?? 'NORMAL', is_read: read,
      read_at: read ? addHours(when, 2) : null, data: n.data ? JSON.stringify(n.data) : null, created_at: when,
    });
  };
  const qar = (n: number) => `QAR ${Math.round(n).toLocaleString('en-US')}`;
  const spaceById = new Map(R.spaces.map((s) => [s.id, s]));
  const tenantById = new Map(R.tenants.map((t) => [t.id, t]));
  const userById = new Map(R.users.map((u) => [u.id, u]));

  for (const ll of Object.values(LL)) {
    const reviewers = [ll.admin, ...ll.managers];
    const inLandlord = (b: any) => ll.spaces.some((s) => s.row.id === b.space_id);
    for (const p of prospectApps.filter((x) => x.landlord === ll)) {
      for (const u of reviewers) {
        notify({ user: u, type: 'TENANT_APPLICATION', title: 'New tenant application', priority: 'HIGH', when: addHours(p.created, 0.1),
          message: `${p.name} applied for ${p.space.row.name} - ${p.headcount} people, ${p.sector}.`, read: false });
      }
    }
    for (const a of openApps.filter((x) => x.landlord === ll && x.row.status === 'PENDING')) {
      notify({ user: ll.manager, type: 'BOOKING_CONFIRMATION', title: 'New booking application', when: addHours(a.row.created_at, 0.05),
        message: `${a.row.company_name ?? a.row.guest_name} applied for ${a.space.row.name}. Review it under Booking Applications.`,
        data: { application_id: a.row.id } });
    }
    for (const b of R.bookings.filter((x) => x.status === 'PENDING_APPROVAL' && inLandlord(x))) {
      notify({ user: ll.manager, type: 'BOOKING_REMINDER', title: 'Booking pending approval', when: addHours(b.created_at, 0.02),
        message: `Booking ${b.booking_number} for ${spaceById.get(b.space_id).name} needs your review.`, data: { booking_id: b.id } });
    }
    for (const t of TK.filter((x) => x.landlord === ll && ['URGENT', 'EMERGENCY'].includes(x.row.priority) && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(x.row.status))) {
      for (const u of [ll.manager, ll.admin]) {
        notify({ user: u, type: 'TICKET_UPDATED', title: `${t.row.priority === 'EMERGENCY' ? 'Emergency' : 'Urgent'} ticket ${t.row.ticket_number}`, priority: 'URGENT',
          when: addHours(t.row.reported_at, 0.05), read: false, message: `${t.row.title} - ${t.s.row.name}, ${t.s.building.name}.`, data: { ticket_id: t.row.id } });
      }
    }
    for (const c of CONTRACTS.filter((x) => x.landlord === ll && x.lease && ['ACTIVE'].includes(x.row.status))) {
      const days = Math.ceil((c.row.end_date.getTime() - NOW.getTime()) / 86_400_000);
      if (days < 0 || days > 60) continue;
      for (const u of [ll.manager, ll.finance]) {
        notify({ user: u, type: 'CONTRACT_EXPIRING', title: 'Lease expiring soon', priority: days <= 30 ? 'HIGH' : 'NORMAL', when: at(addDays(TODAY, -1), 8, 0),
          message: `${c.renter.row.name}'s lease ${c.row.contract_number} ends on ${dayLabel(c.row.end_date)} (${days} days).`, data: { contract_id: c.row.id } });
      }
    }
    const ourPayments = R.payments.filter((p) => R.invoices.find((i) => i.id === p.invoice_id) && shortOrRentOf(p, ll));
    const recent = ourPayments.filter((p) => p.status === 'COMPLETED').sort((a, b) => b.payment_date - a.payment_date).slice(0, 6);
    recent.forEach((p, i) => {
      notify({ user: ll.finance, type: 'PAYMENT_RECEIVED', title: 'Payment received', when: addHours(p.payment_date, 0.2), read: i > 1,
        message: `${qar(p.amount)} from ${tenantById.get(p.tenant_id).name} by ${p.method.replace('_', ' ').toLowerCase()} (${p.payment_number}).`, data: { payment_id: p.id } });
    });
    for (const p of ourPayments.filter((x) => x.status === 'PENDING')) {
      notify({ user: ll.finance, type: 'PAYMENT_RECEIVED', title: 'Payment awaiting confirmation', priority: 'HIGH', when: addHours(p.created_at, 0.1), read: false,
        message: `${tenantById.get(p.tenant_id).name} reported ${qar(p.amount)} by ${p.method.replace('_', ' ').toLowerCase()} - confirm it under Payments.`, data: { payment_id: p.id } });
    }
    for (const inv of R.invoices.filter((i) => i.status === 'OVERDUE' && invoiceIsOurs(i, ll))) {
      const days = Math.floor((NOW.getTime() - inv.due_date.getTime()) / 86_400_000);
      notify({ user: ll.finance, type: 'INVOICE_OVERDUE', title: 'Invoice overdue', priority: days > 14 ? 'HIGH' : 'NORMAL', when: at(addDays(inv.due_date, 1), 8, 0),
        message: `${inv.invoice_number} for ${tenantById.get(inv.tenant_id).name} (${qar(inv.total_amount)}) is ${days} days overdue.`, data: { invoice_id: inv.id } });
    }
    for (const tech of ll.techs) {
      for (const t of TK.filter((x) => x.row.assigned_to === tech.id && ['ASSIGNED', 'IN_PROGRESS'].includes(x.row.status))) {
        notify({ user: tech, type: 'TICKET_UPDATED', title: 'Ticket assigned to you', priority: ['URGENT', 'EMERGENCY'].includes(t.row.priority) ? 'URGENT' : 'NORMAL',
          when: addHours(t.row.reported_at, 0.5), message: `${t.row.ticket_number}: ${t.row.title} (${t.s.row.name}).`, data: { ticket_id: t.row.id } });
      }
      for (const t of TK.filter((x) => x.landlord === ll && x.row.status === 'OPEN')) {
        notify({ user: tech, type: 'TICKET_UPDATED', title: 'New ticket available', priority: ['URGENT', 'EMERGENCY'].includes(t.row.priority) ? 'URGENT' : 'NORMAL',
          when: addHours(t.row.reported_at, 0.02), read: false, message: `${t.row.ticket_number}: ${t.row.title} - ${t.s.row.name}. Accept it from the queue.`, data: { ticket_id: t.row.id } });
      }
      // a little history so the bell is not only today's
      TK.filter((x) => x.row.assigned_to === tech.id && x.row.status === 'RESOLVED').slice(0, 3).forEach((t) => {
        notify({ user: tech, type: 'TICKET_UPDATED', title: 'Ticket closed by manager', when: addHours(t.row.resolved_at ?? t.row.reported_at, 20),
          message: `${t.row.ticket_number} was reviewed and closed. Thanks!`, data: { ticket_id: t.row.id } });
      });
    }
    for (const p of pipelineBookings.filter((x) => x.landlord === ll)) {
      if (p.def.stage === 'PENDING_PHONE_CONFIRMATION') {
        notify({ user: ll.receptionists[0], type: 'BOOKING_REMINDER', title: 'New booking to call', priority: 'HIGH', when: addHours(p.booking.created_at, 0.02), read: false,
          message: `Call ${p.renter.row.name} to confirm booking ${p.booking.booking_number} for ${p.space.row.name}.`, data: { booking_id: p.booking.id } });
      }
      if (p.def.stage === 'AWAITING_PHYSICAL_VISIT') {
        notify({ user: ll.receptionists[0], type: 'BOOKING_REMINDER', title: 'Visit expected', when: addHours(p.booking.created_at, 30),
          message: `${p.renter.row.name} confirmed by phone - expect them at the desk with ID and the first cheque (${p.booking.booking_number}).`, data: { booking_id: p.booking.id } });
      }
      if (p.def.stage === 'DOCUMENTS_PENDING_UPLOAD') {
        notify({ user: ll.manager, type: 'BOOKING_REMINDER', title: 'Ready to finalise', when: addHours(p.booking.created_at, 72), read: false,
          message: `Documents for ${p.booking.booking_number} (${p.renter.row.name}) are on file - finalise the booking when the signed lease is in.`, data: { booking_id: p.booking.id } });
      }
    }
    const todayVisits = R.bookings.filter((b) => inLandlord(b) && b.receptionist_id && b.start_time >= TODAY && b.start_time < addDays(TODAY, 2) && ['CONFIRMED', 'CHECKED_IN'].includes(b.status));
    for (const b of todayVisits) {
      notify({ user: ll.receptionists[0], type: 'BOOKING_REMINDER', title: 'Visitors expected', when: at(TODAY, 7, 45),
        message: `${tenantById.get(b.tenant_id).name} - ${spaceById.get(b.space_id).name} at ${timeLabel(b.start_time)} on ${dayLabel(b.start_time)}.`, data: { booking_id: b.id } });
    }
    notify({ user: ll.admin, type: 'SECURITY_ALERT', title: 'New sign-in from a new device', priority: 'LOW', when: at(addDays(TODAY, -5), 8, 12),
      message: 'Your account was used from Safari on macOS. If this was not you, change your password.' });
  }

  function invoiceIsOurs(inv: any, ll: LandlordCtx) {
    return R.bookings.some((b) => b.invoice_id === inv.id && ll.spaces.some((s) => s.row.id === b.space_id));
  }
  function shortOrRentOf(p: any, ll: LandlordCtx) {
    return R.bookings.some((b) => b.invoice_id === p.invoice_id && ll.spaces.some((s) => s.row.id === b.space_id));
  }

  for (const renter of Object.values(RT)) {
    if (!renter.def || renter.row.status === 'CLOSED') continue;
    const admin = renter.admin;
    const invoices = R.invoices.filter((i) => i.tenant_id === renter.row.id).sort((a, b) => b.issue_date - a.issue_date);
    invoices.filter((i) => i.type === 'MONTHLY_RENT').slice(0, 2).forEach((inv, i) => {
      notify({ user: admin, type: 'INVOICE_ISSUED', title: 'New invoice', when: addHours(inv.issue_date, 0.1), read: i > 0 || inv.status === 'PAID',
        message: `${inv.invoice_number} for ${qar(inv.total_amount)} is due on ${dayLabel(inv.due_date)}.`, data: { invoice_id: inv.id } });
    });
    for (const inv of invoices.filter((i) => i.status === 'OVERDUE')) {
      notify({ user: admin, type: 'INVOICE_OVERDUE', title: 'Invoice overdue', priority: 'HIGH', when: at(addDays(inv.due_date, 1), 8, 30), read: false,
        message: `${inv.invoice_number} (${qar(inv.total_amount)}) was due on ${dayLabel(inv.due_date)}. Please arrange payment with the finance team.`, data: { invoice_id: inv.id } });
    }
    R.payments.filter((p) => p.tenant_id === renter.row.id && p.status === 'COMPLETED').sort((a, b) => b.payment_date - a.payment_date).slice(0, 2).forEach((p) => {
      notify({ user: admin, type: 'PAYMENT_RECEIVED', title: 'Payment confirmed', when: addHours(p.payment_date, 1),
        message: `We received ${qar(p.amount)} (${p.payment_number}). Thank you!`, data: { payment_id: p.id } });
    });
    for (const c of CONTRACTS.filter((x) => x.renter === renter && x.row.status === 'ACTIVE')) {
      const days = Math.ceil((c.row.end_date.getTime() - NOW.getTime()) / 86_400_000);
      if (days >= 0 && days <= 60) {
        notify({ user: admin, type: 'CONTRACT_EXPIRING', title: 'Contract expiring soon', priority: 'URGENT', when: at(addDays(TODAY, -2), 9, 0), read: false,
          message: `Your lease ${c.row.contract_number} ends on ${dayLabel(c.row.end_date)} (${days} days). Contact ${c.landlord.row.name} to renew.`, data: { contract_id: c.row.id } });
      }
    }
    for (const u of activeUsers(renter)) {
      const mine = R.bookings.filter((b) => b.user_id === u.id && !(b.notes ?? '').startsWith('Monthly lease'));
      const upcoming = mine.filter((b) => b.start_time > NOW && ['CONFIRMED', 'PENDING_APPROVAL'].includes(b.status)).sort((a, b) => a.start_time - b.start_time).slice(0, 2);
      for (const b of upcoming) {
        const sp = spaceById.get(b.space_id);
        notify(b.status === 'CONFIRMED'
          ? { user: u, type: 'BOOKING_CONFIRMATION', title: 'Booking approved', when: addHours(b.created_at, 1.5), message: `${sp.name} on ${dayLabel(b.start_time)} at ${timeLabel(b.start_time)} is confirmed (${b.booking_number}).`, data: { booking_id: b.id } }
          : { user: u, type: 'BOOKING_REMINDER', title: 'Booking submitted', when: addHours(b.created_at, 0.01), message: `${sp.name} on ${dayLabel(b.start_time)} is waiting for the property manager's approval.`, data: { booking_id: b.id } });
      }
      mine.filter((b) => b.status === 'COMPLETED').sort((a, b) => b.start_time - a.start_time).slice(0, 2).forEach((b) => {
        notify({ user: u, type: 'BOOKING_REMINDER', title: 'Booking reminder', when: addHours(b.start_time, -18),
          message: `Reminder: ${spaceById.get(b.space_id).name} tomorrow at ${timeLabel(b.start_time)}.`, data: { booking_id: b.id } });
      });
      for (const t of TK.filter((x) => x.row.user_id === u.id)) {
        if (t.row.status === 'OPEN') continue;
        notify({ user: u, type: 'TICKET_UPDATED', title: 'Maintenance update', when: t.row.updated_at,
          message: `Your ticket ${t.row.ticket_number} (${t.row.title}) is now ${t.row.status.replace('_', ' ').toLowerCase()}.`, data: { ticket_id: t.row.id } });
      }
    }
    notify({ user: admin, type: 'LOGIN_SUCCESS', title: 'New sign-in', priority: 'LOW', when: at(addDays(TODAY, -1), 8, 40), message: 'A new sign-in to your account was recorded.' });
  }

  notify({ user: owner, type: 'SECURITY_ALERT', title: 'Repeated failed sign-ins', priority: 'URGENT', when: at(addDays(TODAY, -2), 22, 18), read: false,
    message: '5 failed sign-in attempts for finance@west-bay.test from 198.51.100.77 within 10 minutes. A password reset was forced.' });
  notify({ user: owner, type: 'TENANT_APPLICATION', title: 'Applications awaiting review', priority: 'NORMAL', when: at(TODAY, 8, 0), read: false,
    message: `${prospectApps.length} organisations are waiting for a decision across ${LANDLORDS.length} property companies.` });
  notify({ user: owner, type: 'SECURITY_ALERT', title: 'Organisation suspended', priority: 'NORMAL', when: at(addDays(TODAY, -20), 10, 5),
    message: 'Mirage Events Co. was rejected by West Bay Offices and its organisation suspended.' });
  notify({ user: owner, type: 'LOGIN_SUCCESS', title: 'New sign-in', priority: 'LOW', when: at(addDays(TODAY, -1), 9, 2), message: 'A new sign-in to your account was recorded.' });

  // ── 14. audit trail ───────────────────────────────────────────────────
  const AUDIT_DAYS = 21;
  const sessionsByUser = new Map<string, Date>();
  const audit = (a: { tenantId: string; user?: any; action: string; resource: string; resourceId?: string; when: Date; severity?: string; oldValues?: unknown; newValues?: unknown; ip: string; ua: string }) => {
    R.audit.push({
      id: randomUUID(), tenant_id: a.tenantId, user_id: a.user?.id ?? null, action: a.action,
      resource_type: a.resource, resource_id: a.resourceId ?? null, entity_type: a.resource, entity_id: a.resourceId ?? null,
      severity: a.severity ?? 'INFO', old_values: a.oldValues ? JSON.stringify(a.oldValues) : null,
      new_values: a.newValues ? JSON.stringify(a.newValues) : null, ip_address: a.ip, user_agent: a.ua, created_at: notAfterNow(a.when),
    });
  };
  const orgIp = (u: any) => {
    const ll = Object.values(LL).find((x) => x.row.id === u.tenant_id);
    if (ll) return `${ll.def.ipBase}.${10 + (hash32(u.email) % 200)}`;
    const rt = Object.values(RT).find((x) => x.row.id === u.tenant_id);
    if (rt) return `${rt.ipBase}.${10 + (hash32(u.email) % 200)}`;
    return '203.0.113.5';
  };
  const deviceOf = (u: any) => USER_AGENTS[hash32(`ua:${u.email}`) % USER_AGENTS.length];

  for (const u of R.users) {
    if (u.status !== 'ACTIVE') continue;
    const tenant = tenantById.get(u.tenant_id);
    if (tenant.status === 'PENDING') continue;
    const rate = u.role === 'SUPER_ADMIN' ? 0.85
      : ['CLIENT_ADMIN', 'MANAGER', 'FINANCE', 'RECEPTIONIST', 'MAINTENANCE'].includes(u.role) ? 0.55
      : u.role === 'TENANT_ADMIN' ? 0.25 : 0.1;
    const r = keyed(`logins:${u.email}`);
    for (let k = AUDIT_DAYS; k >= 0; k--) {
      const d = addDays(TODAY, -k);
      if (d < u.created_at) continue;
      const staff = !u.role.startsWith('TENANT_');
      if (staff && !isWorkday(d) && r() < 0.85) continue;
      if (r() > rate) continue;
      const when = at(d, between(r, 7, 10), between(r, 0, 59));
      if (when > NOW) continue;
      const mobile = r() < 0.2;
      const ua = mobile ? USER_AGENTS[3 + (hash32(u.email) % 2)] : deviceOf(u);
      const ip = mobile ? `100.64.${hash32(u.email) % 250}.${between(r, 2, 250)}` : orgIp(u);
      audit({ tenantId: u.tenant_id, user: u, action: 'LOGIN', resource: 'USER', resourceId: u.id, when, ip, ua,
        newValues: { last_login_at: when.toISOString(), session_id: randomUUID(), email: u.email } });
      sessionsByUser.set(u.id, when);
      if (r() < 0.2) {
        const out = at(d, between(r, 16, 19), between(r, 0, 59));
        if (out < NOW) audit({ tenantId: u.tenant_id, user: u, action: 'LOGOUT', resource: 'USER', resourceId: u.id, when: out, ip, ua, newValues: { email: u.email } });
      }
    }
  }

  // the failed sign-in burst the owner was alerted about
  const wbFinance = LL['west-bay'].finance;
  for (let i = 0; i < 5; i++) {
    audit({ tenantId: wbFinance.tenant_id, user: wbFinance, action: 'LOGIN_FAILED', resource: 'USER', resourceId: wbFinance.id, severity: 'WARNING',
      when: at(addDays(TODAY, -2), 22, 8 + i * 2), ip: '198.51.100.77', ua: USER_AGENTS[5], newValues: { email: wbFinance.email, reason: 'invalid_password' } });
  }
  audit({ tenantId: platform.id, user: owner, action: 'UPDATE', resource: 'USER', resourceId: wbFinance.id, severity: 'CRITICAL',
    when: at(addDays(TODAY, -2), 22, 31), ip: orgIp(owner), ua: deviceOf(owner),
    oldValues: { must_change_password: false }, newValues: { must_change_password: true, reason: 'Forced reset after repeated failed sign-ins' } });
  // scattered typos
  for (let i = 0; i < 9; i++) {
    const r = keyed(`typo:${i}`);
    const u = pickOne(r, R.users.filter((x) => x.status === 'ACTIVE' && x.role !== 'SUPER_ADMIN'));
    audit({ tenantId: u.tenant_id, user: u, action: 'LOGIN_FAILED', resource: 'USER', resourceId: u.id, severity: 'WARNING',
      when: at(addDays(TODAY, -between(r, 0, AUDIT_DAYS)), between(r, 7, 21), between(r, 0, 59)), ip: orgIp(u), ua: deviceOf(u),
      newValues: { email: u.email, reason: 'invalid_password' } });
  }

  const since = addDays(TODAY, -AUDIT_DAYS);
  for (const b of R.bookings) {
    if (b.created_at < since || (b.notes ?? '').startsWith('Monthly lease')) continue;
    const u = userById.get(b.user_id);
    audit({ tenantId: b.tenant_id, user: u, action: 'CREATE', resource: 'BOOKING', resourceId: b.id, when: b.created_at, ip: orgIp(u), ua: deviceOf(u),
      newValues: { booking_number: b.booking_number, space: spaceById.get(b.space_id).name, start_time: b.start_time.toISOString(), status: 'PENDING_APPROVAL' } });
    if (['CONFIRMED', 'COMPLETED', 'CHECKED_IN'].includes(b.status)) {
      const ll = Object.values(LL).find((x) => x.spaces.some((s) => s.row.id === b.space_id));
      audit({ tenantId: ll.row.id, user: ll.manager, action: 'APPROVE', resource: 'BOOKING', resourceId: b.id, when: addHours(b.created_at, 1.2),
        ip: orgIp(ll.manager), ua: deviceOf(ll.manager), oldValues: { status: 'PENDING_APPROVAL' }, newValues: { status: 'CONFIRMED' } });
    }
  }
  for (const p of R.payments) {
    if (p.created_at < since || p.status === 'PENDING') continue;
    const fin = userById.get(p.recorded_by_id);
    if (!fin) continue;
    audit({ tenantId: fin.tenant_id, user: fin, action: 'CREATE', resource: 'PAYMENT', resourceId: p.id, when: addHours(p.payment_date, 0.3),
      ip: orgIp(fin), ua: deviceOf(fin), newValues: { payment_number: p.payment_number, amount: p.amount, method: p.method } });
  }
  for (const t of TK) {
    if (t.row.updated_at < since || !t.row.assigned_to || t.row.status === 'OPEN') continue;
    const tech = userById.get(t.row.assigned_to);
    audit({ tenantId: tech.tenant_id, user: tech, action: 'UPDATE', resource: 'MAINTENANCE_TICKET', resourceId: t.row.id, when: t.row.updated_at,
      ip: orgIp(tech), ua: deviceOf(tech), oldValues: { status: 'OPEN' }, newValues: { status: t.row.status } });
  }
  for (const a of R.applications) {
    if (!a.reviewed_at || a.reviewed_at < addDays(TODAY, -40)) continue;
    const mgr = userById.get(a.reviewed_by_id);
    audit({ tenantId: mgr.tenant_id, user: mgr, action: a.status === 'REFUSED' ? 'REJECT' : 'APPROVE', resource: 'BOOKING_APPLICATION', resourceId: a.id,
      severity: a.status === 'REFUSED' ? 'WARNING' : 'INFO', when: a.reviewed_at, ip: orgIp(mgr), ua: deviceOf(mgr),
      newValues: { status: a.status, company: a.company_name, ...(a.refusal_reason ? { reason: a.refusal_reason } : {}) } });
  }
  audit({ tenantId: platform.id, user: owner, action: 'REJECT', resource: 'TENANT', resourceId: mirage.id, severity: 'WARNING', when: at(addDays(TODAY, -20), 10, 2),
    ip: orgIp(owner), ua: deviceOf(owner), oldValues: { status: 'PENDING' }, newValues: { status: 'SUSPENDED' } });
  audit({ tenantId: platform.id, user: owner, action: 'UPDATE', resource: 'TENANT', resourceId: RT['gharafa-trading'].row.id, severity: 'WARNING', when: at(addDays(TODAY, -15), 11, 40),
    ip: orgIp(owner), ua: deviceOf(owner), oldValues: { status: 'ACTIVE' }, newValues: { status: 'CLOSED' } });
  audit({ tenantId: platform.id, user: owner, action: 'UPDATE', resource: 'TENANT', resourceId: LL['west-bay'].row.id, when: at(addDays(TODAY, -9), 14, 5),
    ip: orgIp(owner), ua: deviceOf(owner), oldValues: { max_spaces: 60 }, newValues: { max_spaces: 80 } });
  audit({ tenantId: LL.msheireb.row.id, user: LL.msheireb.admin, action: 'CREATE', resource: 'USER', resourceId: LL.msheireb.staff.reception2.id, when: at(addDays(TODAY, -12), 9, 30),
    ip: orgIp(LL.msheireb.admin), ua: deviceOf(LL.msheireb.admin), newValues: { email: LL.msheireb.staff.reception2.email, role: 'RECEPTIONIST' } });
  audit({ tenantId: LL.msheireb.row.id, user: LL.msheireb.manager, action: 'DELETE', resource: 'PROMOTION_CODE', resourceId: randomUUID(), severity: 'WARNING', when: at(addDays(TODAY, -6), 16, 12),
    ip: orgIp(LL.msheireb.manager), ua: deviceOf(LL.msheireb.manager), oldValues: { code: 'EIDOFFER10' } });
  audit({ tenantId: LL['lusail-hub'].row.id, user: LL['lusail-hub'].manager, action: 'UPDATE', resource: 'SPACE', resourceId: space('m21-20fa').row.id, when: at(addDays(TODAY, -11), 12, 0),
    ip: orgIp(LL['lusail-hub'].manager), ua: deviceOf(LL['lusail-hub'].manager), oldValues: { is_published: false }, newValues: { is_published: true } });
  audit({ tenantId: LL['west-bay'].row.id, user: LL['west-bay'].admin, action: 'UPDATE', resource: 'LEASE_CONTRACT', resourceId: CONTRACTS.find((c) => c.lease?.status === 'RENEWED' && c.landlord.def.key === 'west-bay').row.id,
    when: at(addDays(monthEnd(-1), -20), 13, 25), ip: orgIp(LL['west-bay'].admin), ua: deviceOf(LL['west-bay'].admin), oldValues: { status: 'ACTIVE' }, newValues: { status: 'RENEWED' } });

  for (const u of R.users) {
    const last = sessionsByUser.get(u.id);
    if (last) u.last_login_at = last;
  }
  for (const email of ['admin@leasemanager.com', 'manager@msheireb.test', 'finance@msheireb.test', 'tenant.admin@acme-corp.test', 'employee@acme-corp.test', 'manager@west-bay.test']) {
    const u = R.users.find((x) => x.email === email);
    const last = u.last_login_at ?? at(addDays(TODAY, -1), 9);
    R.sessions.push({ id: randomUUID(), user_id: u.id, refresh_token: `seed-session-${randomUUID()}`, created_at: addDays(last, -2), last_used_at: last });
  }

  // ── 15. saved reports ─────────────────────────────────────────────────
  const quarter = Math.floor(monthStart(-1).getMonth() / 3) + 1;
  const report = (u: any, type: string, title: string, format: string, monthsBack: number, payload: Record<string, unknown>) => {
    const created = notAfterNow(at(addDays(monthStart(-monthsBack + 1), between(keyed(title), 0, 3)), 9, 30));
    R.reports.push({
      id: randomUUID(), user_id: u.id, type, title, format, status: 'COMPLETED',
      parameters: { from: monthStart(-monthsBack).toISOString(), to: monthEnd(-1).toISOString() },
      payload: { generated: true, ...payload }, created_at: created, updated_at: created,
    });
  };
  const paidIn = (pred: (i: any) => boolean) => money(R.invoices.filter((i) => i.status === 'PAID' && pred(i)).reduce((s, i) => s + i.total_amount, 0));
  report(owner, 'FINANCIAL_SUMMARY', `Platform revenue - Q${quarter} ${monthStart(-1).getFullYear()}`, 'PDF', 3, { revenue_qar: paidIn(() => true), organisations: R.tenants.length });
  report(owner, 'OCCUPANCY_RATE', `Occupancy across portfolios - ${monthName(monthStart(-1))}`, 'EXCEL', 1, { spaces: R.spaces.length });
  report(owner, 'MAINTENANCE_SUMMARY', `Maintenance SLA review - ${monthName(monthStart(-1))}`, 'PDF', 1, { tickets: R.tickets.length });
  for (const ll of Object.values(LL)) {
    const ours = (i: any) => invoiceIsOurs(i, ll);
    report(ll.admin, 'REVENUE_BY_SITE', `Revenue by building - Q${quarter}`, 'PDF', 3, { revenue_qar: paidIn(ours) });
    report(ll.manager, 'BOOKING_ANALYTICS', `Booking analytics - ${monthName(monthStart(-1))}`, 'CSV', 1, { bookings: R.bookings.filter((b) => ll.spaces.some((s) => s.row.id === b.space_id)).length });
    report(ll.finance, 'PAYMENT_STATUS', `Payment status - ${monthName(monthStart(0))}`, 'EXCEL', 0, { overdue: R.invoices.filter((i) => i.status === 'OVERDUE' && ours(i)).length });
  }
  for (const slug of ['acme-corp', 'qatar-fintech', 'oryx-software', 'sidra-data-labs']) {
    const rt = RT[slug];
    report(rt.admin, 'FINANCIAL_SUMMARY', `${rt.row.name} - office costs Q${quarter}`, 'PDF', 3, { paid_qar: paidIn((i) => i.tenant_id === rt.row.id) });
  }

  // ── 16. write ─────────────────────────────────────────────────────────
  console.log('Writing…');
  const put = async (model: any, rows: any[]) => {
    for (let i = 0; i < rows.length; i += 400) await model.createMany({ data: rows.slice(i, i + 400) });
  };
  await put(prisma.tenant, R.tenants);
  await put(prisma.user, R.users.filter((u) => !u.managed_by_id));
  await put(prisma.user, R.users.filter((u) => u.managed_by_id));
  await put(prisma.userSession, R.sessions);
  await put(prisma.tenantOnboardingSequence, R.onboarding);
  await put(prisma.building, R.buildings);
  await put(prisma.floor, R.floors);
  await put(prisma.space, R.spaces);
  await put(prisma.spaceFeature, R.features);
  await put(prisma.addOnService, R.addons);
  await put(prisma.spaceAddOnService, R.spaceAddons);
  await put(prisma.promotionCode, R.promos);
  await put(prisma.leaseContract, R.contracts);
  await put(prisma.invoice, R.invoices);
  await put(prisma.invoiceLine, R.lines);
  await put(prisma.booking, R.bookings);
  await put(prisma.bookingAddOn, R.bookingAddons);
  await put(prisma.bookingDocument, R.documents);
  await put(prisma.bookingApplication, R.applications);
  await put(prisma.bookingApplicationAddOn, R.applicationAddons);
  await put(prisma.tenantApplication, R.tenantApplications);
  await put(prisma.payment, R.payments);
  await put(prisma.maintenanceTicket, R.tickets);
  await put(prisma.notification, R.notifications);
  await put(prisma.report, R.reports);
  await put(prisma.auditLog, R.audit);

  // ── report ────────────────────────────────────────────────────────────
  const counts: [string, number][] = [
    ['organisations', R.tenants.length], ['users', R.users.length], ['buildings', R.buildings.length], ['floors', R.floors.length],
    ['spaces', R.spaces.length], ['space features', R.features.length], ['add-on services', R.addons.length],
    ['promotion codes', R.promos.length], ['lease contracts', R.contracts.length], ['bookings', R.bookings.length],
    ['booking documents', R.documents.length], ['booking applications', R.applications.length],
    ['tenant applications', R.tenantApplications.length], ['invoices', R.invoices.length], ['invoice lines', R.lines.length],
    ['payments', R.payments.length], ['maintenance tickets', R.tickets.length], ['notifications', R.notifications.length],
    ['audit log entries', R.audit.length], ['saved reports', R.reports.length],
  ];
  console.log(`\nSeeded in ${((Date.now() - t0) / 1000).toFixed(1)} s:`);
  for (const [k, v] of counts) console.log(`  ${String(v).padStart(5)}  ${k}`);

  console.log(`\nSign in with any of these — the password for all is ${PASSWORD}\n`);
  console.log(`  Platform owner          admin@leasemanager.com`);
  for (const ll of Object.values(LL)) {
    console.log(`\n  ${ll.def.name}`);
    for (const [role, local, first, last] of ll.def.staff) console.log(`    ${role.padEnd(14)} ${`${local}@${ll.def.key}.test`.padEnd(30)} ${first} ${last}`);
  }
  console.log('\n  Renter companies (tenant.admin@… and employee@…)');
  for (const r of RENTERS.filter((x) => x.status !== 'CLOSED')) console.log(`    ${r.name.padEnd(30)} tenant.admin@${r.domain}`);
  console.log();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
