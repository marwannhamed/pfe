#!/usr/bin/env node
/**
 * Tenant-isolation audit against a running API.
 *
 *   npm run audit:access
 *
 * Signs in as the least privileged seeded account — a renter's employee — and
 * checks two things the unit tests cannot: that no endpoint hands back another
 * organisation's rows, and that no write against another organisation's records
 * is accepted. Reads are harmless; the writes below deliberately target records
 * the account must not touch, and every one is expected to be refused. Nothing
 * is created, so a clean run leaves the database exactly as it found it.
 *
 * This exists because unit tests check the scoping helpers in isolation, and
 * the worst hole found in this project was a controller that simply never
 * called them.
 */

const API = process.env.API_URL ?? 'http://localhost:6001';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';

const RENTER_EMPLOYEE = 'employee@acme-corp.test';
const RENTER_ADMIN = 'tenant.admin@acme-corp.test';
const PLATFORM_OWNER = 'admin@leasemanager.com';

/**
 * Two competing property companies. Renter-level isolation was the only thing
 * checked here at first, which is precisely how a set of landlord-level leaks
 * survived: every property manager was being served every other company's
 * maintenance tickets and KPI totals.
 */
const LANDLORD_A = 'manager@msheireb.test';
const LANDLORD_B = 'manager@west-bay.test';

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

async function login(email) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  const body = await res.json();
  const token = body?.data?.accessToken;
  if (!token) throw new Error(`no token returned for ${email}`);
  return { token, user: body.data.user };
}

async function call(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* not every response is JSON */
  }
  return { status: res.status, payload };
}

/**
 * Endpoints that return rows carrying a tenant_id. A renter must never see a
 * row belonging to somebody else — except /buildings, which is the marketplace
 * listing every renter browses to find space, so it is checked for shape only.
 */
const READS = [
  ['/bookings', 'bookings'],
  ['/billing/invoices', 'invoices'],
  ['/billing/payments', 'payments'],
  ['/lease-contracts', 'lease contracts'],
  ['/maintenance', 'maintenance tickets'],
  ['/notifications', 'notifications'],
  ['/analytics/revenue-by-tenant', 'revenue per organisation'],
];

/** Endpoints a renter must not reach at all. */
const FORBIDDEN_READS = [
  ['/users', 'the user directory'],
  ['/tenants', 'the organisation list'],
  ['/audit', 'the audit log'],
  ['/reports', 'generated reports'],
  ['/promotion-codes', 'promotion codes'],
  ['/export/bookings?format=csv', 'a booking export'],
  ['/export/invoices?format=csv', 'an invoice export'],
  ['/mail/settings', 'mail configuration'],
];

async function main() {
  let failures = 0;
  const note = (ok, text) => {
    console.log(`  ${ok ? green('pass') : red('FAIL')}  ${text}`);
    if (!ok) failures++;
  };

  console.log(`\nTenant-isolation audit against ${API}\n`);

  const owner = await login(PLATFORM_OWNER);
  const employee = await login(RENTER_EMPLOYEE);
  const renterAdmin = await login(RENTER_ADMIN);
  const ownTenant = employee.user.tenant_id;

  console.log(
    dim(
      `  acting as ${RENTER_EMPLOYEE} (organisation ${ownTenant.slice(0, 8)}…)\n`,
    ),
  );

  // ── 1. list endpoints must not leak another organisation's rows ───────────
  console.log('Reads — no organisation but our own:');
  for (const [path, what] of READS) {
    const { status, payload } = await call(employee.token, 'GET', path);
    if (status !== 200) {
      note(true, `${path} — ${status}, not readable`);
      continue;
    }
    const rows = payload?.data ?? payload;
    if (!Array.isArray(rows)) {
      note(true, `${path} — not a list, skipped`);
      continue;
    }
    const foreign = rows.filter(
      (r) => r?.tenant_id && r.tenant_id !== ownTenant,
    );
    note(
      foreign.length === 0,
      `${path} — ${rows.length} rows of ${what}` +
        (foreign.length ? `, ${foreign.length} FROM ANOTHER ORGANISATION` : ''),
    );
  }

  // ── 2. a forged tenantId must be refused, not honoured ───────────────────
  console.log('\nReads — a forged tenantId is refused:');
  const otherTenantId = await (async () => {
    const { payload } = await call(owner.token, 'GET', '/tenants');
    const all = payload?.data ?? [];
    return all.find((t) => t.id !== ownTenant)?.id;
  })();
  if (otherTenantId) {
    for (const path of ['/lease-contracts', '/bookings', '/billing/invoices']) {
      const { status } = await call(
        employee.token,
        'GET',
        `${path}?tenantId=${otherTenantId}`,
      );
      note(status >= 400, `${path}?tenantId=<other org> — ${status}`);
    }
  }

  // ── 3. endpoints a renter has no business reaching ───────────────────────
  console.log('\nReads — out of reach entirely:');
  for (const [path, what] of FORBIDDEN_READS) {
    const { status } = await call(employee.token, 'GET', path);
    note(status >= 400, `${path} — ${status} (${what})`);
  }

  // ── 4. writes against another organisation's records ─────────────────────
  console.log('\nWrites — refused against another organisation:');
  const foreignBuilding = await (async () => {
    const { payload } = await call(owner.token, 'GET', '/buildings');
    const all = payload?.data ?? [];
    return all.find((b) => b.tenant_id !== ownTenant);
  })();

  const writes = [];
  if (foreignBuilding) {
    writes.push(
      [
        'PATCH',
        `/buildings/${foreignBuilding.id}`,
        { name: 'audit-probe' },
        "rename another landlord's building",
      ],
      [
        'DELETE',
        `/buildings/${foreignBuilding.id}`,
        null,
        "delete another landlord's building",
      ],
    );
  }
  writes.push(
    [
      'POST',
      '/tenants',
      {
        name: 'audit-probe',
        slug: 'audit-probe',
        contact_email: 'probe@x.test',
      },
      'create an organisation',
    ],
    [
      'POST',
      '/promotion-codes',
      { code: 'AUDITPROBE', discount_type: 'PERCENTAGE', discount_value: 5 },
      'create a promotion code',
    ],
  );

  for (const [who, token] of [
    ['employee', employee.token],
    ['renter admin', renterAdmin.token],
  ]) {
    for (const [method, path, body, what] of writes) {
      const { status } = await call(token, method, path, body);
      note(status >= 400, `${who}: ${what} — ${status}`);
    }
  }

  // ── 5. one property company must not see another's portfolio ─────────────
  console.log('\nProperty companies — each sees only its own portfolio:');
  const a = await login(LANDLORD_A);
  const b = await login(LANDLORD_B);

  // buildings are the ground truth for who owns what
  const ownBuildings = async (who) => {
    const { payload } = await call(who.token, 'GET', '/buildings');
    const all = payload?.data ?? [];
    return all.filter((x) => x.tenant_id === who.user.tenant_id).map((x) => x.id);
  };
  const aBuildings = await ownBuildings(a);
  const bBuildings = await ownBuildings(b);
  note(
    aBuildings.length > 0 && bBuildings.length > 0,
    `both companies own buildings — ${aBuildings.length} and ${bBuildings.length}`,
  );

  // the platform owner's totals are the whole-platform figure; neither
  // company may match it, and the two must not overlap
  const totals = async (token, path, take) => {
    const { payload } = await call(token, 'GET', path);
    return take(payload?.data ?? payload);
  };
  const len = (d) => (Array.isArray(d) ? d.length : -1);

  const ticketsAll = await totals(owner.token, '/maintenance', len);
  const ticketsA = await totals(a.token, '/maintenance', len);
  const ticketsB = await totals(b.token, '/maintenance', len);
  note(
    ticketsA < ticketsAll && ticketsB < ticketsAll,
    `maintenance tickets — platform ${ticketsAll}, each company ${ticketsA} / ${ticketsB}`,
  );

  const idsOf = async (token, path) => {
    const { payload } = await call(token, 'GET', path);
    const rows = payload?.data ?? payload;
    return new Set(Array.isArray(rows) ? rows.map((r) => r.id) : []);
  };
  const aTickets = await idsOf(a.token, '/maintenance');
  const bTickets = await idsOf(b.token, '/maintenance');
  const shared = [...aTickets].filter((id) => bTickets.has(id));
  note(shared.length === 0, `no ticket is served to both companies`);

  // opening the other company's ticket by id
  const foreignTicket = [...bTickets][0];
  if (foreignTicket) {
    const { status } = await call(a.token, 'GET', `/maintenance/${foreignTicket}`);
    note(status >= 400, `company A opens company B's ticket by id — ${status}`);
  }
  const ownTicket = [...aTickets][0];
  if (ownTicket) {
    const { status } = await call(a.token, 'GET', `/maintenance/${ownTicket}`);
    note(status === 200, `company A opens its own ticket by id — ${status}`);
  }

  // KPI cards must not report platform-wide figures to a single company
  const kpi = async (token) => {
    const { payload } = await call(token, 'GET', '/analytics/overview');
    return payload?.data ?? {};
  };
  const kAll = await kpi(owner.token);
  const kA = await kpi(a.token);
  note(
    kA.activeTenants < kAll.activeTenants,
    `active organisations — platform ${kAll.activeTenants}, company A ${kA.activeTenants}`,
  );
  note(
    kA.occupancyRate?.total < kAll.occupancyRate?.total,
    `spaces counted — platform ${kAll.occupancyRate?.total}, company A ${kA.occupancyRate?.total}`,
  );
  note(
    kA.maintenanceTickets?.current < kAll.maintenanceTickets?.current,
    `tickets counted — platform ${kAll.maintenanceTickets?.current}, company A ${kA.maintenanceTickets?.current}`,
  );
  note(
    kA.revenue?.current > 0 && kA.revenue.current < kAll.revenue.current,
    `revenue — platform ${kAll.revenue?.current}, company A ${kA.revenue?.current} (non-zero, not the platform figure)`,
  );

  // ── 6. a user cannot promote themselves ──────────────────────────────────
  console.log('\nPrivilege escalation:');
  await call(employee.token, 'PATCH', `/users/${employee.user.id}`, {
    role: 'SUPER_ADMIN',
  });
  const after = await login(RENTER_EMPLOYEE);
  note(
    after.user.role === 'TENANT_EMPLOYEE',
    `self-promotion to SUPER_ADMIN ignored — role is still ${after.user.role}`,
  );

  console.log(
    failures === 0
      ? green(`\nAll checks passed — no cross-organisation access found.\n`)
      : red(`\n${failures} check(s) failed — see above.\n`),
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(red(`\naudit could not run: ${err.message}`));
  console.error(
    dim('Is the API running, and has the demo seed been applied?\n'),
  );
  process.exit(2);
});
