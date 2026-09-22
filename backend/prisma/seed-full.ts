/**
 * Full demo dataset — wipes every table and rebuilds it.
 *
 *   npm run db:seed-full
 *
 * Shape: one platform owner, three property companies renting space out, and
 * six renter companies occupying it. Every model in schema.prisma gets rows,
 * and the records join up — a booking leads to a contract, the contract to an
 * invoice, the invoice to a payment — so the app has a real story to show
 * rather than disconnected rows.
 *
 * Every account uses the same password: Password123!
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const PASSWORD = 'Password123!';

const day = 86_400_000;
const now = new Date();
const ago = (d: number) => new Date(now.getTime() - d * day);
const ahead = (d: number) => new Date(now.getTime() + d * day);
const pick = <T>(xs: readonly T[], i: number) => xs[i % xs.length];
const money = (n: number) => Math.round(n * 100) / 100;

/** Wipe in dependency order — children first, parents last. */
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
    prisma.invoiceLine.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.leaseContract.deleteMany(),
    prisma.booking.deleteMany(),
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

const LANDLORDS = [
  { name: 'Msheireb Properties', slug: 'msheireb', city: 'Doha', plan: 'enterprise' },
  { name: 'West Bay Offices', slug: 'west-bay', city: 'Doha', plan: 'pro' },
  { name: 'Lusail Business Hub', slug: 'lusail-hub', city: 'Lusail', plan: 'basic' },
] as const;

const RENTERS = [
  { name: 'Acme Corp', slug: 'acme-corp', domain: 'acme-corp.test' },
  { name: 'Qatar Fintech', slug: 'qatar-fintech', domain: 'qfintech.test' },
  { name: 'Gulf Consulting', slug: 'gulf-consulting', domain: 'gulfco.test' },
  { name: 'Doha Design Studio', slug: 'doha-design', domain: 'dohadesign.test' },
  { name: 'Pearl Logistics', slug: 'pearl-logistics', domain: 'pearllog.test' },
  { name: 'Al Rayyan Legal', slug: 'al-rayyan-legal', domain: 'arlegal.test' },
] as const;

/**
 * Capacity, floor area and price follow from what a space actually is. The
 * first version drew them independently, which produced a phone booth seating
 * fifteen at the same rent as a conference room — nonsense on the public map,
 * and worse in front of the space-finder assistant, which can only be as
 * sensible as the inventory it searches.
 *
 * Rents are monthly QAR and sit in the range Doha grade-A asks.
 */
const SPACE_PROFILES = [
  { type: 'PHONE_BOOTH',      seats: [1, 2],   area: [3, 5],     rent: [900, 1400] },
  { type: 'HOT_DESK',         seats: [1, 1],   area: [4, 6],     rent: [1100, 1800] },
  { type: 'FLEXIBLE_DESK',    seats: [2, 6],   area: [12, 30],   rent: [2600, 5200] },
  { type: 'DEDICATED_OFFICE', seats: [4, 20],  area: [24, 110],  rent: [6000, 24000] },
  { type: 'MEETING_ROOM',     seats: [6, 12],  area: [18, 36],   rent: [4200, 7500] },
  { type: 'CONFERENCE_ROOM',  seats: [14, 30], area: [45, 95],   rent: [9000, 18000] },
  { type: 'EVENT_SPACE',      seats: [40, 120], area: [120, 320], rent: [16000, 38000] },
] as const;

const SPACE_TYPES = SPACE_PROFILES.map((p) => p.type);

const FEATURES = [
  'Fibre internet', 'Air conditioning', 'Standing desk', 'Whiteboard',
  'Video conferencing', 'Natural light', 'Lockable storage', 'Ergonomic chairs',
] as const;

const TICKET_SEEDS = [
  ['HVAC', 'Air conditioning not cooling', 'The unit runs but the room stays warm.'],
  ['PLUMBING', 'Leaking tap in the kitchenette', 'Steady drip, small puddle forming.'],
  ['ELECTRICAL', 'Flickering ceiling light', 'Two panels flicker in the afternoon.'],
  ['IT_EQUIPMENT', 'Meeting room screen will not connect', 'HDMI input shows no signal.'],
  ['CLEANING', 'Bins not emptied', 'Kitchen bins full since Friday.'],
  ['FURNITURE', 'Broken chair castor', 'Chair wobbles and will not roll.'],
  ['OTHER', 'Door badge reader intermittent', 'Sometimes needs three taps.'],
] as const;

async function main() {
  console.log('\nWiping every table…');
  await wipe();

  const hash = await bcrypt.hash(PASSWORD, 10);
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

  // ── 1. platform owner — exactly one organisation, exactly one user ────────
  const platform = await prisma.tenant.create({
    data: {
      name: 'LeaseManager Platform',
      slug: 'platform',
      contact_email: 'admin@leasemanager.com',
      status: 'ACTIVE',
      subscription_plan: 'enterprise',
      organization_type: 'CLIENT',
      max_users: 5,
      max_spaces: 0,
      reporting_embeds: {
        powerBi: { title: 'Platform KPIs', embedUrl: '' },
        tableau: { title: 'Occupancy', embedUrl: '' },
      },
    },
  });
  bump('tenants');

  const owner = await prisma.user.create({
    data: {
      tenant_id: platform.id,
      role: 'SUPER_ADMIN',
      email: 'admin@leasemanager.com',
      password: hash,
      first_name: 'Platform',
      last_name: 'Owner',
      phone_number: '+97455000000',
      status: 'ACTIVE',
      last_login_at: ago(0),
      notification_preferences: { email: true, in_app: true, sms: false },
    },
  });
  bump('users');

  // a live session for the owner, so UserSession is not an empty table
  await prisma.userSession.create({
    data: {
      user_id: owner.id,
      refresh_token: `seed-session-${owner.id}`,
      last_used_at: ago(0),
    },
  });
  bump('sessions');

  // ── 2. landlords: staff, buildings, floors, spaces, add-ons, promos ───────
  const landlords: {
    tenant: any;
    users: any[];
    spaces: any[];
    addons: any[];
    promos: any[];
  }[] = [];

  for (const [li, l] of LANDLORDS.entries()) {
    const tenant = await prisma.tenant.create({
      data: {
        name: l.name,
        slug: l.slug,
        contact_email: `contact@${l.slug}.test`,
        status: 'ACTIVE',
        subscription_plan: l.plan,
        organization_type: 'CLIENT',
        max_users: 25,
        max_spaces: 60,
        application_profile: { sector: 'Real estate', city: l.city },
      },
    });
    bump('tenants');

    const baseline = ago(120 - li * 20);
    await prisma.tenantOnboardingSequence.create({
      data: {
        tenant_id: tenant.id,
        baseline_at: baseline,
        // every landlord has been on the platform long enough to have
        // received the whole drip
        day0_sent_at: baseline,
        day1_sent_at: new Date(baseline.getTime() + day),
        day3_sent_at: new Date(baseline.getTime() + 3 * day),
        day7_sent_at: new Date(baseline.getTime() + 7 * day),
        day30_sent_at: new Date(baseline.getTime() + 30 * day),
      },
    });
    bump('onboarding sequences');

    const staff = [
      ['CLIENT_ADMIN', 'admin', 'Client', 'Admin'],
      ['MANAGER', 'manager', 'Site', 'Manager'],
      ['FINANCE', 'finance', 'Finance', 'Officer'],
      ['MAINTENANCE', 'tech', 'Maintenance', 'Technician'],
      ['RECEPTIONIST', 'reception', 'Front', 'Desk'],
    ] as const;

    const users = [];
    for (const [role, local, first, last] of staff) {
      users.push(
        await prisma.user.create({
          data: {
            tenant_id: tenant.id,
            role,
            email: `${local}@${l.slug}.test`,
            password: hash,
            first_name: first,
            last_name: last,
            phone_number: `+9745510${li}${staff.findIndex((s) => s[0] === role)}00`,
            status: 'ACTIVE',
            last_login_at: ago(li + 1),
            notification_preferences: { email: true, in_app: true, sms: false },
          },
        }),
      );
      bump('users');
    }

    // one extra technician per landlord, so assignment has a choice
    users.push(
      await prisma.user.create({
        data: {
          tenant_id: tenant.id,
          role: 'MAINTENANCE',
          email: `tech2@${l.slug}.test`,
          password: hash,
          first_name: 'Second',
          last_name: 'Technician',
          status: 'ACTIVE',
        },
      }),
    );
    bump('users');

    // add-on services offered by this landlord
    const addons = [];
    for (const [ai, a] of [
      ['Parking bay', 'MONTHLY', 350, 'Facilities'],
      ['Meeting room credits', 'MONTHLY', 200, 'Facilities'],
      ['Extra cleaning', 'WEEKLY', 120, 'Housekeeping'],
      ['Reception mail handling', 'MONTHLY', 90, 'Front desk'],
      ['Catering per head', 'DAILY', 45, 'Catering'],
    ].entries()) {
      const [name, cycle, price, category] = a as [string, string, number, string];
      addons.push(
        await prisma.addOnService.create({
          data: {
            tenant_id: tenant.id,
            name,
            description: `${name} for tenants of ${l.name}.`,
            price,
            billing_cycle: cycle,
            category,
            status: 'ACTIVE',
            is_active: ai !== 4,
          },
        }),
      );
      bump('add-on services');
    }

    // promotion codes
    const promos = [];
    for (const [pi, p] of [
      ['WELCOME10', 'PERCENTAGE', 10, true],
      ['SUMMER25', 'PERCENTAGE', 25, true],
      ['FLAT500', 'FIXED_AMOUNT', 500, true],
      ['EXPIRED15', 'PERCENTAGE', 15, false],
    ].entries()) {
      const [code, type, discount, active] = p as [string, string, number, boolean];
      promos.push(
        await prisma.promotionCode.create({
        data: {
          tenant_id: tenant.id,
          code: `${code}-${l.slug.toUpperCase().slice(0, 3)}`,
          description: `${discount}${type === 'PERCENTAGE' ? '%' : ' QAR'} off for new tenants`,
          discount,
          type,
          valid_from: ago(60),
          valid_until: active ? ahead(90) : ago(5),
          max_uses: 50,
          used_count: pi * 3,
          is_active: active,
        },
        }),
      );
      bump('promotion codes');
    }

    // buildings → floors → spaces → features
    const spaces: any[] = [];
    const buildingCount = 2;
    for (let b = 0; b < buildingCount; b++) {
      const building = await prisma.building.create({
        data: {
          tenant_id: tenant.id,
          name: `${l.name} Tower ${b + 1}`,
          slug: `${l.slug}-tower-${b + 1}`,
          description: `Grade A offices in ${l.city}.`,
          address: `${10 + b * 7} Al Corniche Street, ${l.city}, Qatar`,
          total_area_sqm: 4200 + b * 800,
          total_floors_in_building: 12 + b,
          year_built: 2015 + b,
          status: 'ACTIVE',
        },
      });
      bump('buildings');

      for (let f = 0; f < 3; f++) {
        const floor = await prisma.floor.create({
          data: {
            building_id: building.id,
            name: `Floor ${f + 1}`,
            floor_number: f + 1,
            area_sqm: 1200 + f * 100,
            status: 'ACTIVE',
          },
        });
        bump('floors');

        for (let s = 0; s < 4; s++) {
          const profile = pick(SPACE_PROFILES, li + b + f + s);
          const type = profile.type;
          const idx = spaces.length + 1;
          // deterministic spread inside each profile's own band
          const band = (range: readonly [number, number], salt: number) => {
            const [lo, hi] = range;
            return lo + ((idx * 7 + salt * 13) % Math.max(1, hi - lo + 1));
          };
          const seats = band(profile.seats, 1);
          const area = band(profile.area, 2);
          const monthly = Math.round(band(profile.rent, 3) / 100) * 100;
          const space = await prisma.space.create({
            data: {
              floor_id: floor.id,
              name: `${type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())} ${idx}`,
              slug: `${l.slug}-b${b + 1}-f${f + 1}-s${s + 1}`,
              description: 'Furnished, ready to occupy, fibre connected.',
              type,
              status: pick(
                ['AVAILABLE', 'AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'],
                idx,
              ),
              capacity: seats,
              area_sqm: area,
              // a day is roughly a twentieth of a month, an hour an eighth of a day
              hourly_rate: money(Math.round(monthly / 160)),
              daily_rate: money(Math.round(monthly / 20)),
              monthly_rate: monthly,
              currency: 'QAR',
              map_x: 40 + ((idx * 37) % 600),
              map_y: 40 + ((idx * 53) % 380),
              map_w: 120,
              map_h: 90,
              photos: [],
              is_listed: idx % 3 !== 0,
              is_published: idx % 3 !== 0,
              requires_approval: idx % 4 === 0,
              address: `${10 + b * 7} Al Corniche Street`,
              city: l.city,
              state: l.city,
              zip: `${20000 + idx}`,
              country: 'Qatar',
              map_lat: 25.28 + idx * 0.0012,
              map_lng: 51.52 + idx * 0.0011,
              transportation_notes: 'Metro 6 min walk; parking on site.',
              virtual_tour_url:
                idx % 4 === 0 ? 'https://my.matterport.com/show/?m=SEEDDEMO' : null,
              coworker_listing_id: idx % 5 === 0 ? `cw-${idx}` : null,
              liquidspace_listing_id: idx % 5 === 0 ? `ls-${idx}` : null,
            },
          });
          bump('spaces');
          spaces.push(space);

          for (let x = 0; x < 3; x++) {
            await prisma.spaceFeature.create({
              data: {
                space_id: space.id,
                name: pick(FEATURES, idx + x),
                description: 'Included in the monthly rate.',
              },
            });
            bump('space features');
          }

          // link two add-ons to this space
          for (let a = 0; a < 2; a++) {
            await prisma.spaceAddOnService.create({
              data: {
                space_id: space.id,
                addon_service_id: pick(addons, idx + a).id,
              },
            });
            bump('space add-on links');
          }
        }
      }
    }

    landlords.push({ tenant, users, spaces, addons, promos });
  }

  // ── 3. renters: staff, applications, bookings, contracts, money ───────────
  let invoiceSeq = 1000;
  let bookingSeq = 1000;
  let ticketSeq = 1000;

  for (const [ri, r] of RENTERS.entries()) {
    const landlord = landlords[ri % landlords.length];

    const tenant = await prisma.tenant.create({
      data: {
        name: r.name,
        slug: r.slug,
        contact_email: `hello@${r.domain}`,
        status: ri === 5 ? 'TRIAL' : 'ACTIVE',
        subscription_plan: ri % 2 ? 'pro' : 'basic',
        organization_type: 'RENTER',
        max_users: 15,
        max_spaces: 5,
        application_profile: {
          sector: pick(['Technology', 'Consulting', 'Legal', 'Logistics', 'Design'], ri),
          headcount: 8 + ri * 4,
        },
        application_documents: [
          { kind: 'trade_license', url: 'https://example.test/trade-license.pdf' },
          { kind: 'cr_copy', url: 'https://example.test/cr.pdf' },
        ],
      },
    });
    bump('tenants');

    // renters are mid-drip — the later ones have only had the first mails
    const baseline = ago(90 - ri * 12);
    const sent = (d: number) =>
      baseline.getTime() + d * day <= now.getTime()
        ? new Date(baseline.getTime() + d * day)
        : null;
    await prisma.tenantOnboardingSequence.create({
      data: {
        tenant_id: tenant.id,
        baseline_at: baseline,
        day0_sent_at: sent(0),
        day1_sent_at: sent(1),
        day3_sent_at: sent(3),
        day7_sent_at: sent(7),
        day30_sent_at: sent(30),
      },
    });
    bump('onboarding sequences');

    const admin = await prisma.user.create({
      data: {
        tenant_id: tenant.id,
        tenant_company_id: tenant.id,
        role: 'TENANT_ADMIN',
        email: `tenant.admin@${r.domain}`,
        password: hash,
        first_name: pick(['Alice', 'Noor', 'Omar', 'Sara', 'Yousef', 'Layla'], ri),
        last_name: 'Tenant',
        phone_number: `+9745520${ri}00`,
        status: 'ACTIVE',
        last_login_at: ago(ri),
        notification_preferences: { email: true, in_app: true, sms: false },
      },
    });
    bump('users');

    const employees = [];
    for (let e = 0; e < 2; e++) {
      employees.push(
        await prisma.user.create({
          data: {
            tenant_id: tenant.id,
            tenant_company_id: tenant.id,
            managed_by_id: admin.id,
            role: 'TENANT_EMPLOYEE',
            email: e === 0 ? `employee@${r.domain}` : `employee${e + 1}@${r.domain}`,
            password: hash,
            first_name: pick(['Bob', 'Hana', 'Karim', 'Mona', 'Tariq', 'Dana'], ri + e),
            last_name: 'Employee',
            status: e === 1 && ri === 4 ? 'PENDING' : 'ACTIVE',
            must_change_password: e === 1 && ri === 4,
          },
        }),
      );
      bump('users');
    }

    await prisma.userSession.create({
      data: {
        user_id: admin.id,
        refresh_token: `seed-session-${admin.id}`,
        last_used_at: ago(ri),
      },
    });
    bump('sessions');

    // How this renter originally arrived — a settled record, not an open one.
    // These organisations are live and trading, so their application must read
    // APPROVED or REJECTED: TenantApplicationService only lists an application
    // as pending while the applicant org is still PENDING, and approve()
    // refuses one whose applicant has moved on. Applications still awaiting a
    // decision are seeded further down, with prospects that match that state.
    const targetSpace = pick(landlord.spaces, ri * 3);
    await prisma.tenantApplication.create({
      data: {
        landlord_tenant_id: landlord.tenant.id,
        space_id: targetSpace.id,
        applicant_tenant_id: tenant.id,
        status: pick(['APPROVED', 'APPROVED', 'REJECTED'], ri),
        contact_email: `hello@${r.domain}`,
        company_name: r.name,
        typeform_response_id: `tf-${r.slug}-${ri}`,
        raw_payload: { source: 'typeform', headcount: 8 + ri * 4 },
      },
    });
    bump('tenant applications');

    // booking application from the public map (guest or known user)
    const appSpace = pick(landlord.spaces, ri * 5 + 1);
    const bookingApp = await prisma.bookingApplication.create({
      data: {
        space_id: appSpace.id,
        user_id: ri % 2 ? admin.id : null,
        guest_name: ri % 2 ? null : `${r.name} enquiry`,
        guest_email: ri % 2 ? null : `enquiry@${r.domain}`,
        guest_phone: ri % 2 ? null : `+9745530${ri}00`,
        applicant_type: 'COMPANY',
        company_name: r.name,
        start_date: ahead(14 + ri),
        duration_months: 6 + ri,
        headcount: 6 + ri * 2,
        intended_use: 'Office for our Doha team',
        message: 'Looking to move in at the start of next month.',
        status: pick(['PENDING', 'ACCEPTED', 'REFUSED'], ri),
        reviewed_by_id: ri % 3 === 0 ? null : landlord.users[1].id,
        reviewed_at: ri % 3 === 0 ? null : ago(3),
        refusal_reason: ri % 3 === 2 ? 'Space already committed' : null,
      },
    });
    bump('booking applications');

    // add-ons requested on that application
    const landlordAddons = landlord.addons.slice(0, 2);
    for (const a of landlordAddons) {
      await prisma.bookingApplicationAddOn.create({
        data: {
          application_id: bookingApp.id,
          addon_service_id: a.id,
          quantity: 1 + (ri % 3),
          unit_price: a.price,
        },
      });
      bump('application add-ons');
    }

    // ── bookings, each with documents and add-ons ─────────────────────────
    const bookingStatuses = ['CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'PENDING_APPROVAL', 'CANCELLED'];
    const bookings = [];
    for (let b = 0; b < 3; b++) {
      const space = pick(landlord.spaces, ri * 7 + b);
      const start = ago(30 - b * 10);
      const amount = money(space.monthly_rate ?? 5000);
      const booking = await prisma.booking.create({
        data: {
          tenant_id: tenant.id,
          user_id: b === 0 ? admin.id : pick(employees, b).id,
          space_id: space.id,
          receptionist_id: b === 0 ? landlord.users[4].id : null,
          booking_number: `BK-${++bookingSeq}`,
          start_time: start,
          end_time: new Date(start.getTime() + 30 * day),
          status: pick(bookingStatuses, ri + b),
          total_amount: amount,
          total_price: amount,
          notes: b === 0 ? 'Primary office for the team.' : 'Additional desks.',
        },
      });
      bump('bookings');
      bookings.push(booking);

      await prisma.bookingDocument.create({
        data: {
          booking_id: booking.id,
          file_url: 'https://example.test/signed-lease.pdf',
          file_name: `lease-${booking.booking_number}.pdf`,
          document_type: pick(['signed_lease_contract', 'cr_copy', 'qid_copy', 'payment_proof'], b),
          uploaded_by: admin.id,
        },
      });
      bump('booking documents');

      for (const a of landlordAddons) {
        await prisma.bookingAddOn.create({
          data: {
            booking_id: booking.id,
            addon_service_id: a.id,
            quantity: 1 + (b % 2),
            unit_price: a.price,
          },
        });
        bump('booking add-ons');
      }
    }

    // the accepted application is what produced the first booking
    if (bookingApp.status === 'ACCEPTED') {
      await prisma.bookingApplication.update({
        where: { id: bookingApp.id },
        data: { booking_id: bookings[0].id },
      });
    }

    // ── contract → invoices → lines → payments ────────────────────────────
    const contract = await prisma.leaseContract.create({
      data: {
        tenant_id: tenant.id,
        user_id: admin.id,
        contract_number: `LC-2026-${100 + ri}`,
        start_date: ago(60),
        end_date: ahead(305 - ri * 40),
        monthly_rent: money(bookings[0].total_amount),
        status: pick(['ACTIVE', 'ACTIVE', 'DRAFT', 'EXPIRED', 'RENEWED', 'TERMINATED'], ri),
      },
    });
    bump('contracts');

    const invoiceStates = [
      { status: 'PAID', paid: true, due: ago(20) },
      { status: 'ISSUED', paid: false, due: ahead(12) },
      { status: 'OVERDUE', paid: false, due: ago(9) },
      { status: 'DRAFT', paid: false, due: ahead(30) },
    ];

    for (const [ii, st] of invoiceStates.entries()) {
      const subtotal = money((contract.monthly_rent ?? 5000) + ii * 250);
      const taxRate = 0;
      const tax = money(subtotal * taxRate);
      const total = money(subtotal + tax);

      const invoice = await prisma.invoice.create({
        data: {
          tenant_id: tenant.id,
          user_id: admin.id,
          contract_id: contract.id,
          invoice_number: `INV-${++invoiceSeq}`,
          type: pick(['MONTHLY_RENT', 'ONE_TIME_CHARGE', 'DEPOSIT', 'PENALTY'], ii),
          amount: subtotal,
          subtotal,
          tax_rate: taxRate,
          tax_amount: tax,
          total_amount: total,
          currency: 'QAR',
          promotion_code_id: ii === 1 ? landlord.promos[0].id : null,
          issue_date: ago(35 - ii * 8),
          due_date: st.due,
          status: st.status,
          paid_at: st.paid ? ago(18) : null,
          overdue_reminder_max_day: st.status === 'OVERDUE' ? 7 : 0,
        },
      });
      bump('invoices');

      // Bill each invoice to one of the renter's bookings. This is what ties
      // an invoice to the landlord who owns the space — BillingService and the
      // analytics KPIs both reach a property company's billing this way. The
      // last invoice stays unbilled, which is what a DRAFT should look like.
      if (ii < bookings.length) {
        await prisma.booking.update({
          where: { id: bookings[ii].id },
          data: { invoice_id: invoice.id },
        });
      }

      for (const [li2, line] of [
        ['Monthly rent', 1, subtotal * 0.8],
        ['Parking bay', 1, subtotal * 0.12],
        ['Meeting room credits', 2, (subtotal * 0.08) / 2],
      ].entries()) {
        const [description, qty, unit] = line as [string, number, number];
        await prisma.invoiceLine.create({
          data: {
            invoice_id: invoice.id,
            description,
            quantity: qty,
            unit_price: money(unit),
            tax_rate: taxRate,
            line_total: money(qty * unit),
          },
        });
        bump('invoice lines', 1);
        void li2;
      }

      if (st.paid) {
        const payment = await prisma.payment.create({
          data: {
            tenant_id: tenant.id,
            user_id: admin.id,
            invoice_id: invoice.id,
            recorded_by_id: landlord.users[2].id, // the landlord's finance officer
            payment_number: `PAY-${invoiceSeq}`,
            amount: total,
            method: pick(['CASH', 'BANK_TRANSFER', 'CHECK'], ri),
            status: 'COMPLETED',
            transaction_id: `TXN-${invoiceSeq}-${ri}`,
            payment_date: ago(18),
            paid_at: ago(18),
            bookings: { connect: [{ id: bookings[0].id }] },
          },
        });
        bump('payments');
        void payment;
      }
    }

    // a pending payment awaiting finance confirmation, so that queue is not empty
    await prisma.payment.create({
      data: {
        tenant_id: tenant.id,
        user_id: admin.id,
        payment_number: `PAY-PEND-${ri}`,
        amount: money(1200 + ri * 150),
        method: 'CHECK',
        status: 'PENDING',
        cheque_document_url: 'https://example.test/cheque.pdf',
        payment_date: ago(2),
      },
    });
    bump('payments');

    // ── maintenance tickets across every status ───────────────────────────
    for (let t = 0; t < 3; t++) {
      const [category, title, description] = pick(TICKET_SEEDS, ri + t);
      const status = pick(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], ri + t);
      const resolved = status === 'RESOLVED' || status === 'CLOSED';
      await prisma.maintenanceTicket.create({
        data: {
          tenant_id: tenant.id,
          space_id: pick(landlord.spaces, ri + t).id,
          booking_id: bookings[t % bookings.length].id,
          user_id: admin.id,
          created_by_user_id: admin.id,
          assigned_to: status === 'OPEN' ? null : landlord.users[3].id,
          ticket_number: `MT-${++ticketSeq}`,
          title,
          description,
          category,
          priority: pick(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'EMERGENCY'], ri + t),
          status,
          cost: resolved ? money(150 + t * 90) : null,
          equipment_installed_at: ago(400),
          usage_hours_estimate: 1800 + t * 260,
          reported_at: ago(12 - t * 3),
          resolved_at: resolved ? ago(4) : null,
        },
      });
      bump('maintenance tickets');
    }

    // ── resolved history, so each technician has a specialism ─────────────
    // The triage assistant recommends a technician from what they have
    // actually fixed. With every ticket on one person and one of each
    // category, there is nothing to recommend from — so give the two
    // technicians distinct track records worth reading.
    //   users[3] = tech  — the mechanical one (HVAC, electrical)
    //   users[5] = tech2 — the wet-and-wired one (plumbing, IT)
    const HISTORY: [number, string, string][] = [
      [3, 'HVAC', 'Recharged the split unit and cleared the filters'],
      [3, 'HVAC', 'Replaced a failed compressor fan'],
      [3, 'ELECTRICAL', 'Rewired a spur that kept tripping the breaker'],
      [5, 'PLUMBING', 'Resealed the kitchenette trap and stopped the drip'],
      [5, 'PLUMBING', 'Cleared a blocked riser on the mens washroom'],
      [5, 'IT_EQUIPMENT', 'Reterminated the HDMI run to the meeting room'],
    ];

    for (const [hi, [techIdx, category, title]] of HISTORY.entries()) {
      const closed = hi % 3 === 2;
      await prisma.maintenanceTicket.create({
        data: {
          tenant_id: tenant.id,
          space_id: pick(landlord.spaces, ri * 4 + hi).id,
          user_id: admin.id,
          created_by_user_id: admin.id,
          assigned_to: landlord.users[techIdx].id,
          ticket_number: `MT-${++ticketSeq}`,
          title,
          description: 'Reported by the tenant, attended the same week.',
          category,
          priority: pick(['LOW', 'NORMAL', 'HIGH'], hi),
          status: closed ? 'CLOSED' : 'RESOLVED',
          cost: money(120 + hi * 65),
          reported_at: ago(150 - hi * 18),
          resolved_at: ago(146 - hi * 18),
        },
      });
      bump('maintenance tickets');
    }

    // ── notifications for the renter's admin ──────────────────────────────
    const notes = [
      ['BOOKING_CONFIRMATION', 'Booking confirmed', 'Your booking has been confirmed.', 'NORMAL'],
      ['INVOICE_ISSUED', 'New invoice', 'An invoice has been issued to your organisation.', 'NORMAL'],
      ['INVOICE_OVERDUE', 'Invoice overdue', 'An invoice is past its due date.', 'HIGH'],
      ['TICKET_UPDATED', 'Maintenance update', 'Your maintenance ticket changed status.', 'NORMAL'],
      ['CONTRACT_EXPIRING', 'Contract expiring soon', 'Your lease ends in under 90 days.', 'URGENT'],
      ['LOGIN_SUCCESS', 'New sign-in', 'A new sign-in to your account was recorded.', 'LOW'],
    ] as const;
    for (const [ni, n] of notes.entries()) {
      await prisma.notification.create({
        data: {
          tenant_id: tenant.id,
          user_id: admin.id,
          type: n[0],
          title: n[1],
          message: n[2],
          priority: n[3],
          channel: pick(['IN_APP', 'EMAIL'], ni),
          is_read: ni < 2,
          read_at: ni < 2 ? ago(1) : null,
          data: JSON.stringify({ seeded: true }),
          created_at: ago(ni),
        },
      });
      bump('notifications');
    }

    // ── audit trail ───────────────────────────────────────────────────────
    for (const [ai, a] of [
      ['LOGIN', 'User', 'INFO'],
      ['CREATE', 'Booking', 'INFO'],
      ['UPDATE', 'Invoice', 'INFO'],
      ['APPROVE', 'BookingApplication', 'WARNING'],
      ['DELETE', 'Notification', 'WARNING'],
      ['LOGIN_FAILED', 'User', 'ERROR'],
    ].entries()) {
      const [action, resource, severity] = a as [string, string, string];
      await prisma.auditLog.create({
        data: {
          tenant_id: tenant.id,
          user_id: admin.id,
          action,
          resource_type: resource,
          resource_id: bookings[0].id,
          entity_type: resource,
          entity_id: bookings[0].id,
          severity,
          new_values: JSON.stringify({ seeded: true }),
          ip_address: `10.0.${ri}.${ai + 2}`,
          user_agent: 'Mozilla/5.0 (seed)',
          created_at: ago(ai),
        },
      });
      bump('audit logs');
    }

    // ── a saved report per renter admin ───────────────────────────────────
    await prisma.report.create({
      data: {
        user_id: admin.id,
        type: pick(
          ['OCCUPANCY_RATE', 'REVENUE_BY_SITE', 'BOOKING_ANALYTICS', 'PAYMENT_STATUS', 'MAINTENANCE_SUMMARY', 'FINANCIAL_SUMMARY'],
          ri,
        ),
        title: `${r.name} — monthly summary`,
        format: pick(['PDF', 'CSV', 'EXCEL', 'JSON'], ri),
        status: 'COMPLETED',
        parameters: { from: ago(30).toISOString(), to: now.toISOString() },
        payload: { generated: true, rows: 12 + ri },
      },
    });
    bump('reports');
  }

  // ── 4. prospects still awaiting a decision ────────────────────────────────
  // Each property company needs a non-empty review inbox. A genuinely pending
  // application is an organisation created by the Typeform webhook and left at
  // PENDING with no users, no bookings and no billing — approving it is what
  // creates its first TENANT_ADMIN. Both listPending() and approve() check
  // that PENDING status, so anything else is invisible to the reviewer.
  const PROSPECTS = [
    { name: 'Najma Architects', slug: 'najma-architects', sector: 'Architecture', headcount: 14 },
    { name: 'Souq Digital', slug: 'souq-digital', sector: 'Marketing', headcount: 9 },
    { name: 'Corniche Capital', slug: 'corniche-capital', sector: 'Investment', headcount: 22 },
    { name: 'Barwa Translation', slug: 'barwa-translation', sector: 'Language services', headcount: 6 },
    { name: 'Katara Media', slug: 'katara-media', sector: 'Media production', headcount: 18 },
    { name: 'Doha Dental Group', slug: 'doha-dental', sector: 'Healthcare', headcount: 11 },
  ] as const;

  for (const [pi, p] of PROSPECTS.entries()) {
    const landlord = landlords[pi % landlords.length];

    const prospect = await prisma.tenant.create({
      data: {
        name: p.name,
        slug: p.slug,
        contact_email: `hello@${p.slug}.test`,
        status: 'PENDING',
        subscription_plan: 'basic',
        organization_type: 'RENTER',
        max_users: 10,
        max_spaces: 3,
        application_profile: {
          sector: p.sector,
          headcount: p.headcount,
          moveIn: ahead(30 + pi * 10).toISOString().slice(0, 10),
        },
        application_documents: [
          { kind: 'trade_license', url: 'https://example.test/trade-license.pdf' },
          { kind: 'cr_copy', url: 'https://example.test/cr.pdf' },
        ],
      },
    });
    bump('tenants');

    await prisma.tenantApplication.create({
      data: {
        landlord_tenant_id: landlord.tenant.id,
        space_id: pick(landlord.spaces, pi * 6 + 2).id,
        applicant_tenant_id: prospect.id,
        status: 'SUBMITTED',
        contact_email: `hello@${p.slug}.test`,
        company_name: p.name,
        typeform_response_id: `tf-prospect-${p.slug}`,
        raw_payload: {
          source: 'typeform',
          sector: p.sector,
          headcount: p.headcount,
        },
      },
    });
    bump('tenant applications');

    // the managers who have to act on it
    for (const staff of [landlord.users[0], landlord.users[1]]) {
      await prisma.notification.create({
        data: {
          tenant_id: landlord.tenant.id,
          user_id: staff.id,
          type: 'TENANT_APPLICATION',
          title: 'New tenant application',
          message: `${p.name} applied for space — ${p.headcount} people, ${p.sector}.`,
          priority: 'HIGH',
          channel: 'IN_APP',
          is_read: false,
          created_at: ago(pi),
        },
      });
      bump('notifications');
    }
  }

  // reports and audit entries owned by the platform owner too
  for (const t of ['FINANCIAL_SUMMARY', 'OCCUPANCY_RATE'] as const) {
    await prisma.report.create({
      data: {
        user_id: owner.id,
        type: t,
        title: `Platform — ${t.replace(/_/g, ' ').toLowerCase()}`,
        format: 'JSON',
        status: 'COMPLETED',
        parameters: { scope: 'platform' },
        payload: { generated: true },
      },
    });
    bump('reports');
  }
  await prisma.auditLog.create({
    data: {
      tenant_id: platform.id,
      user_id: owner.id,
      action: 'LOGIN',
      resource_type: 'User',
      // AuthService records the signed-in user as the resource — match it, so
      // the seeded trail looks like one the running app produced
      resource_id: owner.id,
      entity_type: 'User',
      entity_id: owner.id,
      severity: 'INFO',
      ip_address: '10.0.0.1',
      user_agent: 'Mozilla/5.0 (seed)',
    },
  });
  bump('audit logs');

  // ── report ────────────────────────────────────────────────────────────────
  console.log('\nSeeded:');
  for (const [k, v] of Object.entries(counts).sort()) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }

  console.log('\nSign in with any of these — password for all: ' + PASSWORD);
  console.log('  platform owner   admin@leasemanager.com        (the only SUPER_ADMIN)');
  for (const l of LANDLORDS) {
    console.log(`  ${l.name.padEnd(22)} admin@${l.slug}.test / manager@${l.slug}.test / finance@${l.slug}.test`);
  }
  for (const r of RENTERS) {
    console.log(
      `  ${r.name.padEnd(22)} tenant.admin@${r.domain} / employee@${r.domain}`,
    );
  }
  console.log();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
