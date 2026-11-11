// Read-only API check: every GET endpoint of the backend, called as every
// identity (a guest without a token plus the nine demo accounts). Nothing is
// created or changed: endpoints that write data, even behind a GET, are left out.
import fs from 'node:fs';
import path from 'node:path';

export const IDENTITIES = [
  { key: 'guest',       short: 'Guest',       label: 'Guest (no token)',             email: null },
  { key: 'owner',       short: 'Owner',       label: 'Platform owner',               email: 'admin@leasemanager.com' },
  { key: 'clientadmin', short: 'Client adm.', label: 'Client admin · Msheireb',      email: 'admin@msheireb.test' },
  { key: 'manager',     short: 'Manager',     label: 'Manager · Msheireb',           email: 'manager@msheireb.test' },
  { key: 'finance',     short: 'Finance',     label: 'Finance · Msheireb',           email: 'finance@msheireb.test' },
  { key: 'tech',        short: 'Technician',  label: 'Technician · Msheireb',        email: 'tech@msheireb.test' },
  { key: 'reception',   short: 'Reception',   label: 'Reception · Msheireb',         email: 'reception@msheireb.test' },
  { key: 'rival',       short: 'West Bay',    label: 'Manager · West Bay (rival)',   email: 'manager@west-bay.test' },
  { key: 'renter',      short: 'Renter adm.', label: 'Renter admin · Acme',          email: 'tenant.admin@acme-corp.test' },
  { key: 'employee',    short: 'Employee',    label: 'Renter employee · Acme',       email: 'employee@acme-corp.test' },
];

// {name} placeholders are filled from live data before the run; {own.x} is
// filled per identity (each account reads its own notifications, its own id).
export const ENDPOINTS = [
  ['System', '/'], ['System', '/health'], ['System', '/health/detailed'], ['System', '/health/metrics'], ['System', '/health/performance-report'],
  ['Auth', '/auth/me'], ['Auth', '/auth/sessions'], ['Auth', '/auth/login-activity'],
  ['Spaces', '/spaces/public/map'], ['Spaces', '/spaces/public/{publicSpace}'], ['Spaces', '/spaces/{space}'],
  ['Spaces', '/spaces/{publicSpace}/availability?start={start}&end={end}'], ['Spaces', '/spaces'],
  ['Buildings', '/buildings'], ['Buildings', '/buildings/{building}'], ['Buildings', '/floors'], ['Buildings', '/floors/{floor}'],
  ['Organisations', '/tenants'], ['Organisations', '/tenants/{renterTenant}'], ['Organisations', '/tenants/{renterTenant}/active-users'],
  ['Organisations', '/tenants/me/organization'], ['Organisations', '/users'], ['Organisations', '/users/{employeeUser}'],
  ['Organisations', '/tenant-applications/pending'],
  ['Bookings', '/booking-applications'], ['Bookings', '/booking-applications/{bookingApp}'],
  ['Bookings', '/bookings'], ['Bookings', '/bookings/{booking}'], ['Bookings', '/bookings/workflow/queues'],
  ['Contracts', '/lease-contracts'], ['Contracts', '/lease-contracts/{contract}'], ['Contracts', '/lease-contracts/expiring'],
  ['Billing', '/billing/invoices'], ['Billing', '/billing/invoices/{invoice}'], ['Billing', '/billing/invoices/overdue'],
  ['Billing', '/billing/invoices/summary'], ['Billing', '/billing/payments'], ['Billing', '/billing/payments/{payment}'],
  ['Maintenance', '/maintenance'], ['Maintenance', '/maintenance/{ticket}'], ['Maintenance', '/maintenance/stats'],
  ['Maintenance', '/maintenance/accessible-spaces'],
  ['Add-ons', '/addon-services'], ['Add-ons', '/addon-services/{addon}'], ['Add-ons', '/addon-services/{addon}/usage-stats'],
  ['Add-ons', '/addon-services/active'], ['Add-ons', '/addon-services/by-category?category={addonCategory}'],
  ['Add-ons', '/promotion-codes'], ['Add-ons', '/promotion-codes/{promo}'], ['Add-ons', '/promotion-codes/validate/{promoCode}'],
  ['Analytics', '/analytics/overview'], ['Analytics', '/analytics/revenue-trend'], ['Analytics', '/analytics/revenue-by-tenant'],
  ['Analytics', '/analytics/revenue-forecast'], ['Analytics', '/analytics/bookings-trend'], ['Analytics', '/analytics/bookings-by-status'],
  ['Analytics', '/analytics/space-utilization'], ['Analytics', '/analytics/top-spaces'], ['Analytics', '/analytics/occupancy-heatmap?buildingId={building}'],
  ['Analytics', '/analytics/maintenance'], ['Analytics', '/analytics/predictive-maintenance'],
  ['Reports', '/reports'], ['Reports', '/reports/templates'], ['Reports', '/reports/generate/OCCUPANCY_RATE'],
  ['Reports', '/reports/{report}'], ['Reports', '/reports/{report}/download'],
  ['Export', '/export/spaces'], ['Export', '/export/bookings'], ['Export', '/export/invoices'], ['Export', '/export/payments'],
  ['Export', '/export/maintenance'], ['Export', '/export/tenants'],
  ['Notifications', '/notifications'], ['Notifications', '/notifications/{own.notification}'], ['Notifications', '/notifications/unread-count'],
  ['Notifications', '/notifications/stats'], ['Notifications', '/notifications/preferences/me'],
  ['Notifications', '/notifications/preferences/{own.userId}'],
  ['Audit', '/audit'], ['Audit', '/audit/stats'], ['Audit', '/audit/{audit}'], ['Audit', '/audit/{audit}/changes'],
  ['Audit', '/mail/settings'],
  ['Search', '/search/suggestions?q=suite'],
].map(([group, p]) => ({ group, path: p }));

// GET routes deliberately not called, and why (shown in the report)
export const SKIPPED = [
  { path: '/floors/publish-default', why: 'creates a default building and floor when one is missing' },
  { path: '/files/:filepath', why: 'file download, needs a stored file name' },
  { path: '/public/:kind/:filename', why: 'file download, needs a stored file name' },
];

const unwrap = (body) => {
  const data = body && typeof body === 'object' && !Array.isArray(body) && 'data' in body ? body.data : body;
  return data;
};
const asList = (data) => (Array.isArray(data) ? data : (data?.items ?? data?.data ?? data?.results ?? []));

export async function login(api, email, password) {
  const r = await fetch(`${api}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({}));
  const d = unwrap(j) ?? {};
  const token = d.accessToken ?? d.access_token ?? j.accessToken ?? j.access_token;
  if (!r.ok || !token) throw new Error(`login ${email} → ${r.status}`);
  return token;
}

async function get(api, p, token) {
  const r = await fetch(`${api}${p}`, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`GET ${p} → ${r.status}`);
  return unwrap(await r.json());
}

/** Fill the {placeholders} with real records, picked so the isolation rules show. */
export async function resolveParams(api, tokens, log = () => {}) {
  const P = {};
  const tryList = async (who, p) => { try { return asList(await get(api, p, tokens[who])); } catch (e) { log(`   (could not list ${p} as ${who}: ${e.message})`); return []; } };
  const tenants = await tryList('owner', '/tenants');
  P.renterTenant = (tenants.find((t) => /Acme/i.test(t.name)) ?? tenants[0])?.id;
  const users = await tryList('owner', '/users');
  P.employeeUser = (users.find((u) => u.email === 'employee@acme-corp.test') ?? users[0])?.id;
  const audit = await tryList('owner', '/audit');
  P.audit = audit[0]?.id;
  const reports = await tryList('owner', '/reports');
  P.report = reports[0]?.id;
  const bookings = await tryList('manager', '/bookings');
  P.booking = (bookings.find((b) => /Conference 7/.test(b.space?.name ?? '') && /hiring/i.test(b.notes ?? ''))
    ?? bookings.find((b) => /Acme/i.test(b.tenant?.name ?? '')) ?? bookings[0])?.id;
  P.building = (await tryList('manager', '/buildings'))[0]?.id;
  P.floor = (await tryList('manager', '/floors'))[0]?.id;
  const tickets = await tryList('manager', '/maintenance');
  P.ticket = (tickets.find((t) => /Water leaking/i.test(t.title ?? '')) ?? tickets[0])?.id;
  P.bookingApp = (await tryList('manager', '/booking-applications'))[0]?.id;
  const addons = await tryList('manager', '/addon-services');
  P.addon = addons[0]?.id; P.addonCategory = addons[0]?.category;
  const promos = await tryList('manager', '/promotion-codes');
  const now = Date.now();
  const usable = (c) => (c.is_active ?? c.active ?? true) !== false
    && (!c.valid_until || new Date(c.valid_until).getTime() > now) && (!c.valid_from || new Date(c.valid_from).getTime() <= now)
    && (c.max_uses == null || (c.used_count ?? c.times_used ?? 0) < c.max_uses);
  const promo = promos.find(usable) ?? promos[0];
  P.promo = promo?.id; P.promoCode = promo?.code;
  const pub = asList(await get(api, '/spaces/public/map', null).catch(() => []));
  P.publicSpace = pub[0]?.id;
  const contracts = await tryList('manager', '/lease-contracts');
  P.contract = (contracts.find((c) => /Acme/i.test(c.tenant?.name ?? '')) ?? contracts[0])?.id;
  const spaces = await tryList('manager', '/spaces');
  P.space = (spaces.find((s) => s.name === 'Suite 304') ?? spaces[0])?.id;
  const invoices = await tryList('manager', '/billing/invoices');
  P.invoice = (invoices.find((i) => /Acme/i.test(i.tenant?.name ?? '')) ?? invoices[0])?.id;
  const payments = await tryList('finance', '/billing/payments');
  P.payment = (payments.find((x) => /Acme/i.test(x.tenant?.name ?? x.invoice?.tenant?.name ?? '')) ?? payments[0])?.id;
  const day = new Date(Date.now() + 86400000);
  const iso = (h) => { const d = new Date(day); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  P.start = encodeURIComponent(iso(9)); P.end = encodeURIComponent(iso(17));
  // each account's own records
  P.own = {};
  for (const id of IDENTITIES) {
    if (!tokens[id.key]) continue;
    const me = await get(api, '/auth/me', tokens[id.key]).catch(() => null);
    const notes = await tryList(id.key, '/notifications');
    P.own[id.key] = { userId: me?.id ?? me?.user?.id, notification: notes[0]?.id };
  }
  return P;
}

function fill(p, P, who) {
  let missing = null;
  const out = p.replace(/\{([\w.]+)\}/g, (_, k) => {
    let v;
    if (k.startsWith('own.')) v = P.own?.[who]?.[k.slice(4)] ?? P.own?.owner?.[k.slice(4)];
    else v = P[k];
    if (v == null) { missing = k; return `{${k}}`; }
    return v;
  });
  return { url: out, missing };
}

export const verdict = (s) => (s == null ? 'skip' : s >= 200 && s < 300 ? 'ok' : s === 401 ? 'auth' : s === 403 || s === 404 ? 'denied' : s >= 500 || s === 0 ? 'error' : 'client');

/**
 * Call every endpoint as every identity. onRow(rowIndex, row) is called as soon
 * as a row has all its answers (used to fill the on-screen table live).
 */
export async function apiCheck({ api, password, out, log = () => {}, onRow, tokens: given }) {
  const tokens = { ...(given ?? {}) };
  for (const id of IDENTITIES) {
    if (!id.email || tokens[id.key]) continue;
    try { tokens[id.key] = await login(api, id.email, password); } catch (e) { log(`   api check: ${e.message}`); }
  }
  const P = await resolveParams(api, tokens, log);
  log(`   api check: params ${JSON.stringify({ ...P, own: undefined })}`);
  const rows = [];
  for (let i = 0; i < ENDPOINTS.length; i++) {
    const ep = ENDPOINTS[i];
    const results = {};
    await Promise.all(IDENTITIES.map(async (id) => {
      const { url, missing } = fill(ep.path, P, id.key);
      if (missing) { results[id.key] = { status: null, note: `no ${missing} in the data` }; return; }
      const t0 = Date.now();
      try {
        const r = await fetch(`${api}${url}`, { headers: tokens[id.key] ? { authorization: `Bearer ${tokens[id.key]}` } : {}, signal: AbortSignal.timeout(30000) });
        const buf = await r.arrayBuffer();
        results[id.key] = { status: r.status, ms: Date.now() - t0, bytes: buf.byteLength };
        if (r.status >= 500) results[id.key].body = Buffer.from(buf).toString('utf8').slice(0, 300);
      } catch (e) {
        results[id.key] = { status: 0, ms: Date.now() - t0, note: e.name === 'TimeoutError' ? 'timeout' : e.message };
      }
    }));
    const row = { ...ep, results };
    rows.push(row);
    if (onRow) await onRow(i, row);
  }
  const summary = { endpoints: rows.length, identities: IDENTITIES.length, calls: 0, ok: 0, auth: 0, denied: 0, client: 0, error: 0, skip: 0 };
  for (const r of rows) for (const id of IDENTITIES) { const v = verdict(r.results[id.key]?.status); summary[v]++; if (v !== 'skip') summary.calls++; }
  const report = { at: new Date().toISOString(), summary, swagger: await swaggerStats(api), skipped: SKIPPED, identities: IDENTITIES, rows };
  if (out) fs.writeFileSync(path.join(out, 'apicheck.json'), JSON.stringify(report, null, 1));
  return report;
}

/** What the Swagger document declares: operations, read operations and groups. */
export async function swaggerStats(api) {
  try {
    const r = await fetch(`${api}/api-json`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const doc = await r.json();
    const ops = Object.values(doc.paths ?? {}).flatMap((m) => Object.entries(m)
      .filter(([k]) => ['get', 'post', 'put', 'patch', 'delete'].includes(k)).map(([k, v]) => ({ method: k, tags: v.tags ?? [] })));
    const tags = new Set(ops.flatMap((o) => o.tags));
    return { title: doc.info?.title, version: doc.info?.version, paths: Object.keys(doc.paths ?? {}).length, operations: ops.length, reads: ops.filter((o) => o.method === 'get').length, tags: tags.size };
  } catch (e) { return { error: e.message }; }
}

/** Plain-text table for the log. */
export function textReport(rep) {
  const L = [];
  const s = rep.summary;
  L.push(`API check: ${s.endpoints} GET endpoints × ${s.identities} identities = ${s.calls} calls · ok ${s.ok} · 401 ${s.auth} · 403/404 ${s.denied} · other 4xx ${s.client} · errors ${s.error} · skipped ${s.skip}`);
  L.push(`Swagger: ${JSON.stringify(rep.swagger)}`);
  L.push(`${'endpoint'.padEnd(58)} ${rep.identities.map((i) => i.key.slice(0, 6).padStart(6)).join(' ')}`);
  for (const r of rep.rows) {
    L.push(`${r.path.slice(0, 58).padEnd(58)} ${rep.identities.map((i) => String(r.results[i.key]?.status ?? '-').padStart(6)).join(' ')}`);
  }
  const bad = rep.rows.flatMap((r) => rep.identities.filter((i) => ['error', 'client'].includes(verdict(r.results[i.key]?.status)))
    .map((i) => `${r.path} as ${i.key}: ${r.results[i.key].status} ${r.results[i.key].note ?? ''} ${r.results[i.key].body ?? ''}`));
  if (bad.length) { L.push('', 'Errors and other 4xx:'); L.push(...bad); }
  return L.join('\n');
}
