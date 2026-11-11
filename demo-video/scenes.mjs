// The demo itself: thirteen short chapters covering every account, every
// service and the API. Every chapter can run on its own (--only=3,4); logins
// happen off camera except the owner's.
import {
  S, log, sleep, rawSleep, settle, settleFast, skip, visible, exists, click, hover, fill, typeText, moveTo,
  demo, say, caption, spot, resetCamera, cut, checkpoint, step, ensureInView, L, scrollMain,
} from './lib.mjs';
import { IDENTITIES, ENDPOINTS, apiCheck, swaggerStats, verdict } from './apicheck.mjs';
import { apiCheckHtml } from './apiview.mjs';

export const PASSWORD = 'Password123!';

export const ROLES = {
  guest:       { chip: 'Guest', color: '#2563eb' },
  owner:       { email: 'admin@leasemanager.com',      name: 'Youssef Mansour',    chip: 'Platform owner',          color: '#b91c1c' },
  clientadmin: { email: 'admin@msheireb.test',         name: 'Khalid Al-Mansouri', chip: 'Client admin · Msheireb', color: '#7e22ce' },
  manager:     { email: 'manager@msheireb.test',       name: 'Fatima Al-Kuwari',   chip: 'Manager · Msheireb',      color: '#0369a1' },
  reception:   { email: 'reception@msheireb.test',     name: 'Maria Santos',       chip: 'Reception',               color: '#4f46e5' },
  rival:       { email: 'manager@west-bay.test',       name: 'Sara Al-Emadi',      chip: 'Manager · West Bay',      color: '#0f766e' },
  finance:     { email: 'finance@msheireb.test',       name: 'Omar Haddad',        chip: 'Finance',                 color: '#15803d' },
  tech:        { email: 'tech@msheireb.test',          name: 'Rajesh Nair',        chip: 'Technician',              color: '#b45309' },
  renter:      { email: 'tenant.admin@acme-corp.test', name: 'Noor Al-Hajri',      chip: 'Renter admin · Acme',     color: '#6d28d9' },
  employee:    { email: 'employee@acme-corp.test',     name: 'Karim Saad',         chip: 'Employee · Acme',         color: '#be185d' },
  api:         { chip: 'API', color: '#0f172a' },
};

const FOOT_L = 'LeaseManager · product demo';
const FOOT_R = 'Doha, Qatar';

export const INTRO = {
  kicker: 'Product demo',
  title: 'LeaseManager',
  sub: 'Office lease & workspace management for property companies in Qatar',
  points: [
    'Public map, AI space finder, guest applications',
    'Nine accounts, three competing landlords',
    'Application → phone call → visit → lease',
    'Every API endpoint checked live',
  ],
  footLeft: 'Final-year project · ESPRIT × Quicky Prime',
  footRight: 'Marwan Hamed',
};

export const OUTRO = {
  kicker: 'Thank you',
  title: 'LeaseManager',
  sub: 'One platform, every role, strict isolation between landlords',
  points: [
    'Guests find spaces on a map or by asking the AI',
    'Managers approve; reception confirms; finance confirms payment',
    'Competing landlords never see each other’s data',
    'Every read endpoint answered — no server errors',
  ],
  footLeft: 'Final-year project · ESPRIT × Quicky Prime',
  footRight: 'Marwan Hamed',
};

const TOTAL = 13;
const card = (num, kicker, title, sub, note, acct) => ({ num: `${String(num).padStart(2, '0')} / ${TOTAL}`, kicker, title, sub, note, acct, footLeft: FOOT_L, footRight: FOOT_R });

const CARDS = {
  map:         card(1, 'Guest · no account', 'Find an office', 'The public map and the AI space finder', 'Anyone can browse, ask and apply — no sign-up.'),
  owner:       card(2, 'Platform owner', 'Youssef Mansour', 'Runs the platform for every organisation', 'The only account that reads across organisations.', ROLES.owner.email),
  clientadmin: card(3, 'Client admin', 'Khalid Al-Mansouri', 'Owner of Msheireb Properties', 'Company, team, buildings, spaces and billing.', ROLES.clientadmin.email),
  manager:     card(4, 'Property manager', 'Fatima Al-Kuwari', 'Msheireb Properties', 'Approves tenants, applications and bookings.', ROLES.manager.email),
  reception:   card(5, 'Reception', 'Maria Santos', 'Msheireb Properties · front desk', 'Calls accepted applicants and records visits.', ROLES.reception.email),
  finalize:    card(6, 'Property manager', 'Finalize a lease', 'Fatima Al-Kuwari · after the visit', 'Signed lease and cheque on file — one click activates it.'),
  ai:          card(7, 'Property manager', 'AI maintenance triage', 'Fatima reports an emergency', 'The model suggests category and priority; history picks the technician.'),
  rival:       card(8, 'Competing landlord', 'Sara Al-Emadi', 'West Bay Offices', 'Same screens, different company — nothing from Msheireb.', ROLES.rival.email),
  finance:     card(9, 'Finance', 'Omar Haddad', 'Msheireb Properties · finance', 'Cash, transfer or cheque — finance confirms each one.', ROLES.finance.email),
  tech:        card(10, 'Technician', 'Rajesh Nair', 'Msheireb Properties · maintenance', 'Emergencies first. Accept, then start the work.', ROLES.tech.email),
  renter:      card(11, 'Renter admin', 'Noor Al-Hajri', 'Acme Corp', 'The other side of the lease: team, bookings, invoices.', ROLES.renter.email),
  employee:    card(12, 'Renter employee', 'Karim Saad', 'Acme Corp', 'Sees only his own bookings — and books rooms himself.', ROLES.employee.email),
  api:         card(13, 'Under the hood', 'The API', 'Swagger documentation and a live check', 'Every read endpoint, called as every account.'),
};

// ─── small helpers ────────────────────────────────────────────────────────────
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function setChip(role) { S.chip = ROLES[role].chip; S.chipColor = ROLES[role].color; }

/** Locator for the card-like box (rounded, bordered) around an element. */
async function boxAround(page, inner, { minRadius = 8 } = {}) {
  const loc = L(page, inner).first();
  const id = `d${Math.random().toString(36).slice(2, 9)}`;
  const ok = await loc.evaluate((el, o) => {
    let p = el;
    while (p && p.tagName !== 'MAIN' && p.tagName !== 'BODY') {
      const cs = getComputedStyle(p);
      const rad = parseFloat(cs.borderTopLeftRadius) || 0;
      const boxy = cs.boxShadow !== 'none' || (parseFloat(cs.borderTopWidth) || 0) > 0 || (parseFloat(cs.borderLeftWidth) || 0) > 0;
      if (rad >= o.minRadius && boxy && p.getBoundingClientRect().width > 90) { p.setAttribute('data-demo', o.id); return true; }
      p = p.parentElement;
    }
    return false;
  }, { id, minRadius }).catch(() => false);
  return ok ? page.locator(`[data-demo="${id}"]`) : loc;
}

/** A label in <main>: exact for KPI tiles ("Total Spaces"), loose for titles with an icon. */
const labelIn = (page, label, exact = true) => page.locator('main').getByText(label, { exact }).first();
const titleIn = (page, title) => labelIn(page, title, false);

/** The headline value printed in the card that holds a label (largest digits). */
async function kpiText(page, label) {
  return page.evaluate((label) => {
    const main = document.querySelector('main') || document.body;
    const hits = [...main.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() === label);
    for (const el of hits) {
      let cardEl = el;
      for (let i = 0; i < 7 && cardEl.parentElement; i++) {
        cardEl = cardEl.parentElement;
        const cs = getComputedStyle(cardEl);
        if ((parseFloat(cs.borderTopLeftRadius) || 0) >= 8 && (cs.boxShadow !== 'none' || (parseFloat(cs.borderTopWidth) || 0) > 0)) break;
      }
      let best = null; let size = 0;
      for (const e of cardEl.querySelectorAll('*')) {
        if (e.children.length > 1) continue;
        const t = e.textContent.replace(/\s+/g, ' ').trim();
        if (!/\d/.test(t) || t.length > 22 || t === label) continue;
        const fs = parseFloat(getComputedStyle(e).fontSize);
        if (fs > size) { size = fs; best = t; }
      }
      if (best) return best;
    }
    return null;
  }, label).catch(() => null);
}

async function toast(page, timeout = 12000) {
  if (S.dry) return;
  try {
    await page.locator('.ant-message-notice').first().waitFor({ state: 'visible', timeout });
    await sleep(700);
  } catch { log('   (no toast seen)'); }
}

async function waitTiles(page, timeout = 12000) {
  try {
    await page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll('.leaflet-tile')];
      return tiles.length > 0 && tiles.every((t) => t.classList.contains('leaflet-tile-loaded'));
    }, null, { timeout });
  } catch { log('   (map tiles still loading)'); }
}

const sidebarBtn = (page, label) =>
  page.locator('aside nav button').filter({ hasText: new RegExp(`^\\s*${esc(label)}\\s*$`) }).first();

/** Wait until the address bar stops changing (pages that redirect on load). */
async function urlStable(page, quietMs = 300, maxMs = 4000) {
  const t0 = Date.now();
  let last = page.url(); let since = Date.now();
  while (Date.now() - t0 < maxMs) {
    await rawSleep(60);
    const u = page.url();
    if (u !== last) { last = u; since = Date.now(); } else if (Date.now() - since >= quietMs) return;
  }
}

/** Click a sidebar entry on camera; any loading time is cut from the video. */
async function nav(page, label) {
  await caption(page, '');          // the last caption belonged to the last page
  await click(page, sidebarBtn(page, label), { after: 120 });
  await urlStable(page, 200, 2500);
  await settleFast(page);
  await rawSleep(100);
}

/** Click without animating the cursor (used off camera). */
async function quickClick(page, sel) {
  const loc = L(page, sel).first();
  await loc.waitFor({ state: 'visible', timeout: 15000 });
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  page.__cur = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function mainTop(page) {
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTo({ top: 0 }); });
}

/** Scroll (instantly, off camera) so an element starts near the top of the screen. */
async function jumpTo(page, sel, offset = 14) {
  const loc = L(page, sel).first();
  await loc.waitFor({ state: 'visible', timeout: 15000 });
  await loc.evaluate((el, off) => {
    let p = el.parentElement;
    while (p && !(p.scrollHeight > p.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
    if (!p) { el.scrollIntoView({ block: 'start' }); return; }
    p.scrollTop += el.getBoundingClientRect().top - p.getBoundingClientRect().top - off;
  }, offset);
  await rawSleep(150);
}

/** Read-only API call with the session of the signed-in tab. */
async function apiGet(page, D, path) {
  const token = await page.evaluate(() => sessionStorage.getItem('access_token'));
  const res = await fetch(`${D.api}${path}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  const body = await res.json();
  const data = body && typeof body === 'object' && !Array.isArray(body) && 'data' in body ? body.data : body;
  return Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
}

/**
 * Visit sidebar pages one after the other with a short caption each.
 * item: { nav, say, spot?, before?(page), after?(page), scroll? }
 */
async function tour(page, items) {
  for (const it of items) {
    await step(page, `page: ${it.nav}`, async () => {
      await caption(page, '');
      await nav(page, it.nav);
      await mainTop(page);
      if (it.before) await it.before(page);
      await checkpoint(page, `${S.chip}-${it.nav}`);
      if (it.spot) {
        const target = typeof it.spot === 'function' ? await it.spot(page) : it.spot;
        if (target && await exists(page, target, 2500)) await spot(page, target, { pad: 6 });
      }
      if (it.scroll) await scrollMain(page, { by: it.scroll, ms: 1100 });
      await say(page, typeof it.say === 'function' ? await it.say(page) : it.say, { hold: it.hold });
      await spot(page, null);
      if (it.after) await it.after(page);
    });
  }
}

/** Pick the first option of an antd Select found by its placeholder text. */
async function pickSelect(page, placeholder, optionText) {
  const sel = page.locator('main .ant-select').filter({ hasText: placeholder }).first();
  await click(page, sel, { after: 250 });
  const opts = page.locator('.ant-select-dropdown:visible .ant-select-item-option');
  await opts.first().waitFor({ state: 'visible', timeout: 8000 });
  const opt = optionText ? opts.filter({ hasText: optionText }).first() : opts.first();
  await click(page, (await opt.count()) ? opt : opts.first(), { after: 250, scroll: false });
}

// ─── director: pages, logins and chapter transitions ─────────────────────────
export class Director {
  constructor({ browser, newPage, base, api }) {
    this.browser = browser;
    this.newPage = newPage;
    this.base = base;
    this.api = api;
    this.pages = {};
    this.loggedIn = {};
    this.active = null;
    this.first = true;
  }

  async page(role) {
    if (!this.pages[role]) this.pages[role] = await this.newPage(role);
    return this.pages[role];
  }

  async login(role) {
    const p = await this.page(role);
    if (this.loggedIn[role]) return p;
    log(`   logging in ${ROLES[role].email} (off camera)`);
    await p.goto(`${this.base}/login`, { waitUntil: 'domcontentloaded' });
    await p.locator('input[type=email]').fill(ROLES[role].email);
    await p.locator('input[type=password]').fill(PASSWORD);
    await p.locator('button[type=submit]').click();
    await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
    if (p.url().includes('/change-password')) throw new Error(`${ROLES[role].email} must change password first`);
    await settle(p);
    this.loggedIn[role] = true;
    return p;
  }

  /** Chapter card over the current screen; the next screen is prepared off camera. */
  async enter(toPage, cardData, role, prepare) {
    setChip(role);
    S.capPos = 'bottom';
    const from = this.active;
    if (from) {
      await demo(from, 'caption', '');
      await demo(from, 'spot', null);
      await demo(from, 'card', cardData);
      await sleep(650);
    }
    S.rec?.pause();
    if (prepare) await prepare();
    await demo(toPage, 'caption', '');
    await demo(toPage, 'spot', null);
    await demo(toPage, 'card', this.first ? INTRO : cardData, true);
    await demo(toPage, 'cursorVisible', true);
    if (S.rec) { await S.rec.attach(toPage); await S.rec.freshFrame(); } else await rawSleep(50);
    this.active = toPage;
    S.rec?.resume();
    if (this.first) {
      this.first = false;
      await sleep(4200);
      await demo(toPage, 'card', cardData);
    }
    await sleep(2600);
    await demo(toPage, 'hideCard');
    await sleep(400);
  }

  async outro() {
    const p = this.active;
    if (!p) return;
    await demo(p, 'caption', '');
    await demo(p, 'spot', null);
    await demo(p, 'card', OUTRO);
    await sleep(6000);
  }
}

// ─── 1 · guest ────────────────────────────────────────────────────────────────
async function pickMapSpace(D) {
  try {
    const res = await fetch(`${D.api}/spaces/public/map`);
    const body = await res.json();
    const list = (Array.isArray(body) ? body : body.data ?? []).filter((s) => s.map_lat != null && s.map_lng != null);
    const score = (s) => (s.type === 'DEDICATED_OFFICE' ? 4 : 0) + (/Msheireb/i.test(`${s.address} ${s.city}`) ? 3 : 0)
      + ((s.photos?.length ?? 0) >= 3 ? 2 : 0) + (/Suite/.test(s.name) ? 1 : 0);
    let best = 0;
    list.forEach((s, i) => { if (score(s) > score(list[best])) best = i; });
    log(`   map: ${list.length} published spaces; aiming at #${best} ${list[best]?.name}`);
    return { index: best, name: list[best]?.name ?? 'this space', count: list.length };
  } catch (e) {
    log('   map: could not read the public API —', e.message);
    return { index: 0, name: 'this space', count: 19 };
  }
}

/** Smoothly scroll the window (public pages scroll the whole window). */
async function scrollWin(page, target, offset = 80, ms = 900) {
  const y = typeof target === 'number' ? target
    : await L(page, target).first().evaluate((e, off) => window.scrollY + e.getBoundingClientRect().top - off, offset);
  await page.evaluate(({ y, ms }) => new Promise((res) => {
    const se = document.scrollingElement; const y0 = se.scrollTop; const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = (now) => { const t = Math.min(1, (now - t0) / ms); se.scrollTop = y0 + (y - y0) * ease(t); if (t < 1) requestAnimationFrame(tick); else res(); };
    requestAnimationFrame(tick);
  }), { y, ms: ms / S.speed });
  await rawSleep(60);
}

async function chMap(D) {
  const p = await D.page('guest');
  const target = await pickMapSpace(D);
  const marker = p.locator('.leaflet-marker-pane .leaflet-marker-icon').nth(target.index);
  await D.enter(p, CARDS.map, 'guest', async () => {
    await p.goto(`${D.base}/map`, { waitUntil: 'domcontentloaded' });
    await visible(p, '.leaflet-marker-icon', 30000);
    await waitTiles(p);
    await settle(p);
    // rehearse the zoom off camera so every tile is cached for the real one
    const pin = await marker.boundingBox().catch(() => null);
    if (pin) {
      await p.mouse.move(pin.x + pin.width / 2, pin.y + pin.height - 1);
      for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, -120); await rawSleep(420); }
      await waitTiles(p, 25000);
    }
    // the chapter itself starts on the public home page
    await p.goto(`${D.base}/`, { waitUntil: 'domcontentloaded' });
    await settle(p);
    await p.evaluate(() => window.scrollTo(0, 0));
    const vp = p.viewportSize();
    await p.mouse.move(vp.width * 0.62, vp.height * 0.8);
    p.__cur = { x: vp.width * 0.62, y: vp.height * 0.8 };
  });
  await checkpoint(p, 'home');
  await say(p, 'The public website: anyone can look for an office in Doha — no account needed.');
  await step(p, 'home page', async () => {
    const feat = p.getByText('Premium spaces, ready to book', { exact: true }).first();
    if (await exists(p, feat, 2000)) {
      await scrollWin(p, feat, 150, 1000);
      await say(p, 'Featured offices, with photos and the monthly rent in **QAR**.');
      await scrollWin(p, 0, 0, 700);
    }
    await caption(p, '');
    await click(p, p.getByRole('button', { name: /Explore map/ }).first(), { after: 100, scroll: false });
    await p.waitForURL(/\/map/, { timeout: 15000 });
    await visible(p, '.leaflet-marker-icon', 30000);
    await skip(p, async () => { await waitTiles(p); await settle(p); });
  });
  await checkpoint(p, 'map-overview');
  await say(p, `All **${target.count} spaces** on one map — Msheireb, West Bay and Lusail, three competing landlords.`);

  let shown = target.name;
  await step(p, 'zoom into Msheireb', async () => {
    let b = await marker.boundingBox();
    await moveTo(p, b.x + b.width / 2, b.y + b.height - 1);
    await caption(p, 'Zooming into Msheireb Downtown…');
    for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, -120); await sleep(420); }
    await waitTiles(p);
    await sleep(300);
    b = await marker.boundingBox();
    await moveTo(p, b.x + b.width / 2, b.y + b.height * 0.4);
    await sleep(500);
    const tip = p.locator('.leaflet-tooltip').first();
    if (await exists(p, tip, 2000)) shown = ((await tip.innerText()).split('\n')[0] || shown).trim();
  });
  await say(p, `Each pin shows the space and its rent — here, **${shown}**.`);
  await step(p, 'open the space', async () => {
    const c = p.__cur;
    await p.mouse.down(); await rawSleep(80); await p.mouse.up();
    if (c) p.__cur = c;
    await visible(p, 'aside h2', 10000);
    await p.evaluate(() => window.scrollTo(0, 0));
    await settle(p);
  });
  await checkpoint(p, 'map-space-panel');
  await say(p, 'Photos, rent in **QAR**, the building and transport…');
  await step(p, 'scroll the panel', async () => {
    await p.locator('aside').first().evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
    await sleep(900);
  });
  await say(p, '…and optional add-ons, ticked before applying.');

  await step(p, 'AI space finder', async () => {
    await click(p, p.locator('button[aria-label="Find a space"]'), { after: 250, scroll: false });
    const input = p.locator('#space-finder-input');
    await click(p, input, { after: 80, scroll: false });
    await typeText(p, 'Private office for 6 people in Msheireb, under 15,000 a month');
    await p.keyboard.press('Enter');
    await caption(p, 'Or just ask: the AI assistant understands plain language…');
    const loading = p.getByText('Looking through what is available…');
    const t0 = Date.now();
    await rawSleep(250);
    while (await loading.isVisible().catch(() => false) && Date.now() - t0 < 2200) await rawSleep(100);
    if (await loading.isVisible().catch(() => false)) {
      // the model can take a few seconds: the wait is cut from the video
      await skip(p, async () => { await loading.waitFor({ state: 'hidden', timeout: 90000 }).catch(() => {}); await rawSleep(400); });
    }
    await checkpoint(p, 'map-ai-finder');
    // (textContent runs "QAR/mo" straight into the next line, so no \b here)
    const match = p.locator('button').filter({ hasText: /QAR\s*\/\s*mo/ }).first();
    if (await exists(p, match, 2000)) {
      await spot(p, match, { pad: 4, radius: 10 });
      await say(p, '…and replies with real listings from the database, never invented ones.');
      await spot(p, null);
    } else {
      await say(p, 'The assistant only ever answers with live listings.');
    }
    await click(p, p.locator('button[aria-label="Close"]').last(), { after: 200, scroll: false });
  });

  await step(p, 'apply', async () => {
    await click(p, p.getByRole('button', { name: /Apply for this space|Book this space/ }), { after: 250, scroll: false });
    await p.waitForURL(/\/apply\//, { timeout: 15000 });
    await settle(p);
  });
  await checkpoint(p, 'guest-apply-form');
  await say(p, 'One form, no password: the application goes straight to the landlord.');
}

// ─── 2 · platform owner ──────────────────────────────────────────────────────
async function heatmapLoad(page) {
  await pickSelect(page, 'Site', /Kahraba|Barahat/);
  await click(page, page.locator('main button').filter({ hasText: /^\s*Load\s*$/ }).first(), { after: 150 });
  await settleFast(page);
}

async function chOwner(D) {
  const p = await D.page('owner');
  await D.enter(p, CARDS.owner, 'owner', async () => {
    await p.goto(`${D.base}/login`, { waitUntil: 'domcontentloaded' });
    await visible(p, 'input[type=email]');
    await settle(p);
  });
  await caption(p, 'Signing in as the platform owner.');
  await step(p, 'sign in on camera', async () => {
    await fill(p, 'input[type=email]', ROLES.owner.email);
    await click(p, 'input[type=password]', { after: 80 });
    await typeText(p, PASSWORD, { delay: 45 });
    await click(p, 'button[type=submit]', { after: 100 });
    await cut(p, async () => {
      await p.waitForURL(/\/admin\//, { timeout: 30000 });
      D.loggedIn.owner = true;
      await settle(p);
      await mainTop(p);
    });
  });
  await checkpoint(p, 'owner-dashboard');
  await step(p, 'dashboard', async () => {
    const [spaces, orgs, leases] = [await kpiText(p, 'Total Spaces'), await kpiText(p, 'Active Tenants'), await kpiText(p, 'Active Contracts')];
    await scrollMain(p, { el: labelIn(p, 'Published Listings'), offset: 330, ms: 800 });
    await spot(p, await boxAround(p, labelIn(p, 'Total Spaces')));
    await say(p, spaces && orgs
      ? `The whole platform at a glance: **${spaces} spaces**, **${orgs} organisations**${leases ? `, ${leases} active leases` : ''}.`
      : 'The whole platform at a glance: spaces, organisations and leases.');
    await spot(p, null);
    await scrollMain(p, { el: titleIn(p, 'Booking Trends'), offset: 120, ms: 1000 });
    await say(p, 'Revenue and bookings month by month, May to October.');
    await scrollMain(p, { el: titleIn(p, 'Occupancy by Site'), offset: 120, ms: 900 });
    await spot(p, await boxAround(p, titleIn(p, 'Occupancy by Site')), { pad: 6 });
    await say(p, 'Occupancy for each of the seven buildings.');
    await spot(p, null);
  });
  await tour(p, [
    { nav: 'Clients', say: 'Clients: the landlord companies, each in its own isolated workspace.' },
    { nav: 'Users', say: async (pg) => { const n = await kpiText(pg, 'Total Users'); return `${n ? `**${n} users**` : 'Every user'} across eight roles, managed from one screen.`; } },
    { nav: 'Analytics', say: 'Platform analytics: revenue trend and bookings by status.' },
    { nav: 'Occupancy heat', before: heatmapLoad, say: 'The occupancy heatmap: how much of each space’s bookable time was actually booked.' },
    { nav: 'Predictive MT', say: 'Predictive maintenance ranks open tickets by risk.' },
    { nav: 'Export', say: 'Every dataset exports to Excel or CSV.' },
    { nav: 'Email', say: 'A template for every automatic email.' },
    { nav: 'Audit Logs', say: 'Every action is audited: who did what, when, and from which IP.' },
  ]);
}

// ─── 3 · client admin ────────────────────────────────────────────────────────
async function chClientAdmin(D) {
  const p = await D.page('clientadmin');
  await D.enter(p, CARDS.clientadmin, 'clientadmin', async () => {
    await D.login('clientadmin');
    if (!/site-dashboard/.test(p.url())) await p.goto(`${D.base}/admin/site-dashboard`, { waitUntil: 'domcontentloaded' });
    await settle(p);
    await mainTop(p);
  });
  await checkpoint(p, 'clientadmin-dashboard');
  await step(p, 'dashboard', async () => {
    await say(p, 'Khalid owns **Msheireb Properties**: spaces, team, billing and bookings in one place.');
    await scrollMain(p, { el: titleIn(p, 'Booking Trends'), offset: 150, ms: 1000 });
    await say(p, 'Bookings per month and occupancy for each of his buildings.');
  });
  await tour(p, [
    { nav: 'Team', say: 'His team — manager, finance, maintenance, reception — each with its own rights.' },
    { nav: 'Company', say: 'The company profile, with its Qatar commercial registration.' },
    { nav: 'Buildings', say: 'Three buildings in Msheireb Downtown…' },
    { nav: 'Floors', say: '…their floors…' },
    { nav: 'My Spaces', say: async (pg) => { const n = await kpiText(pg, 'Total'); return `…and ${n ? `**${n} spaces**` : 'every space'}, with photos, price and status.`; } },
    { nav: 'Add-on Services', say: 'Paid add-ons — parking, cleaning, catering — billed with the rent.' },
    { nav: 'Contracts', say: async (pg) => { const r = await kpiText(pg, 'Monthly Rent'); return `Every lease contract${r ? ` — **${r}** of rent a month` : ''}.`; } },
    { nav: 'Billing & Payments', say: 'Invoices and payments for the whole company, in QAR.' },
    { nav: 'Revenue forecast', say: 'And the rent still to come, month by month, from the lease end dates.' },
  ]);
}

// ─── 4 · manager ─────────────────────────────────────────────────────────────
async function chManager(D) {
  const p = await D.page('manager');
  await D.enter(p, CARDS.manager, 'manager', async () => {
    await D.login('manager');
    await p.goto(`${D.base}/admin/site-dashboard`, { waitUntil: 'domcontentloaded' });
    await settle(p);
    await mainTop(p);
  });
  await checkpoint(p, 'manager-dashboard');
  await step(p, 'dashboard', async () => {
    const pend = p.locator('main').getByText(/awaiting your approval/).first();
    if (await exists(p, pend, 1500)) {
      await spot(p, await boxAround(p, pend));
      const txt = (await pend.innerText()).trim();
      await say(p, `**${txt.charAt(0).toUpperCase()}${txt.slice(1)}** — nothing is booked without her.`);
      await spot(p, null);
    }
    await scrollMain(p, { el: titleIn(p, 'Occupancy by Site'), offset: 150, ms: 1000 });
    await spot(p, await boxAround(p, titleIn(p, 'Occupancy by Site')), { pad: 6 });
    await say(p, 'Live occupancy for each of her three buildings.');
    await spot(p, null);
  });

  await step(p, 'tenant application', async () => {
    await caption(p, '');
    await cut(p, async () => {
      await p.goto(`${D.base}/admin/applications`, { waitUntil: 'domcontentloaded' });
      await settle(p);
    });
    await checkpoint(p, 'manager-tenant-applications');
    const row = p.locator('.ant-table-row').filter({ hasText: 'Najma Architects' }).first();
    await spot(p, row, { pad: 4 });
    await say(p, 'A new company, **Najma Architects**, applied for an office.');
    await spot(p, null);
    await click(p, row.getByRole('button', { name: /Approve/ }), { mutating: true, after: 150 });
    await toast(p);
    await say(p, 'Approved: the organisation and its admin are created, with a password-setup email.');
  });

  await step(p, 'booking applications', async () => {
    await nav(p, 'Booking Applications');
    await checkpoint(p, 'manager-booking-applications');
    const hits = p.locator('main').getByText('Suite 502', { exact: true });
    const n = await hits.count();
    if (n >= 2) {
      await spot(p, await boxAround(p, hits.nth(0)));
      await say(p, 'Two companies want the same office, **Suite 502**…');
      await spot(p, await boxAround(p, hits.nth(1)));
      await say(p, '…she compares them side by side.');
      await spot(p, null);
    }
    // accept the applicant who asked for the longer lease
    const cardShah = await boxAround(p, p.locator('main').getByText(/Shahwani Trading/).first());
    const info = await cardShah.innerText().catch(() => '');
    const months = (info.match(/(\d+)\s+months?/) || [])[1];
    const people = (info.match(/(\d+)\s+people/) || [])[1];
    await click(p, cardShah.getByRole('button', { name: /Accept & create booking/ }), { after: 300 });
    const dlg = p.getByRole('dialog').filter({ hasText: 'Accept this application?' });
    await dlg.waitFor({ state: 'visible', timeout: 8000 });
    await caption(p, `She accepts **Shahwani Trading**${months && people ? ` — ${months} months, ${people} people` : ''}.`);
    await sleep(900);
    await click(p, dlg.getByRole('button', { name: /^Accept$/ }), { mutating: true, after: 150 });
    if (S.dry) await p.keyboard.press('Escape');
    await toast(p);
    await say(p, 'The suite is reserved and the booking goes to reception’s call list.');
  });

  await step(p, 'approve a room booking', async () => {
    let acme = null;
    try {
      const list = await apiGet(p, D, '/bookings');
      const hit = list.find((b) => b.status === 'PENDING_APPROVAL' && /Conference 7/.test(b.space?.name ?? '')
        && /acme|hiring/i.test(`${b.tenant?.name ?? ''} ${b.notes ?? ''}`));
      if (hit) acme = { number: hit.booking_number, notes: (hit.notes ?? '').trim(), people: hit.attendee_count };
      log(`   bookings: Acme's Conference 7 request: ${acme ? `${acme.number} (${acme.people} people)` : 'not found'}`);
    } catch (e) { log('   bookings: could not read the API —', e.message); }
    await nav(p, 'Bookings');
    await checkpoint(p, 'manager-bookings');
    await fill(p, p.getByPlaceholder('Search by booking # or space...'), 'Conference 7');
    await sleep(500);
    const btns = p.locator('main button[title="Approve"]');
    const n = await btns.count();
    if (!n) throw new Error('no pending Conference 7 booking found');
    let pick = -1;
    for (let i = 0; i < n && acme; i++) {
      const rowText = await btns.nth(i).locator('xpath=ancestor::div[contains(@style,"grid-template-columns")][1]').innerText();
      if (rowText.includes(acme.number)) { pick = i; break; }
    }
    const btn = btns.nth(Math.max(0, pick));
    const row = btn.locator('xpath=ancestor::div[contains(@style,"grid-template-columns")][1]');
    await spot(p, row, { pad: 2, radius: 6 });
    const purpose = acme?.notes ? acme.notes.split(' - ')[0].trim() : '';
    await say(p, pick >= 0
      ? `Acme Corp asked for **Conference 7**${acme.people > 1 ? ` for ${acme.people} people` : ''}${purpose ? ` — ${purpose.charAt(0).toLowerCase()}${purpose.slice(1)}` : ''}.`
      : 'A renter asked for **Conference 7**.');
    await spot(p, null);
    await click(p, btn, { mutating: true, after: 150 });
    await toast(p);
    await say(p, 'Approved — with the next steps, contract and payment, suggested straight away.');
  });

  await step(p, 'calendar', async () => {
    await caption(p, '');
    await click(p, p.locator('main button').filter({ hasText: /^\s*Calendar\s*$/ }).first(), { after: 150 });
    await settleFast(p);
    await checkpoint(p, 'manager-calendar');
    await say(p, 'The same bookings on a calendar, room by room.');
  });
}

// ─── 5 · reception ───────────────────────────────────────────────────────────
async function chReception(D) {
  const p = await D.page('reception');
  await D.enter(p, CARDS.reception, 'reception', async () => {
    await D.login('reception');
    if (!/\/admin\/reception/.test(p.url())) { await p.goto(`${D.base}/admin/reception`, { waitUntil: 'domcontentloaded' }); await settle(p); }
    await mainTop(p);
    await jumpTo(p, p.locator('main button').filter({ hasText: /^\s*To Call/ }).first(), 230);
  });
  await checkpoint(p, 'reception-dashboard');
  await step(p, 'confirm by phone', async () => {
    const who = p.locator('main').getByText(/Wakra Coffee Roasters|Al-Kubaisi/).first();
    const target = (await exists(p, who, 4000)) ? who : p.locator('main').getByText('Suite 303', { exact: true }).first();
    const cardLoc = await boxAround(p, target);
    await spot(p, cardLoc);
    const who2 = ((await target.innerText()).split('·').pop() || '').trim();
    await say(p, who2 && !/Wakra/.test(who2)
      ? `Maria calls **${who2}** of Wakra Coffee Roasters — the number is on the card.`
      : 'Maria calls **Wakra Coffee Roasters** — the number is on the card.');
    await spot(p, null);
    await click(p, cardLoc.getByRole('button', { name: 'Tenant Confirmed' }), { mutating: true, after: 150 });
    await toast(p);
    await say(p, 'Confirmed: visit instructions are emailed and the booking moves to **Awaiting Visit**.');
  });
  await step(p, 'visit complete', async () => {
    await click(p, p.locator('main button').filter({ hasText: /^\s*Awaiting Visit/ }).first(), { after: 300 });
    await settle(p);
    const btn = p.locator('main button').filter({ hasText: /Visit complete/ });
    const n = await btn.count();
    let pickBtn = btn.first();
    for (let i = 0; i < n; i++) {
      const c = await boxAround(p, btn.nth(i));
      if (!/Wakra|Al-Kubaisi/.test(await c.innerText())) { pickBtn = btn.nth(i); break; }
    }
    const c = await boxAround(p, pickBtn);
    await spot(p, c);
    const suite = ((await c.innerText()).match(/Suite \d+|[A-Z][\w-]+ Room|Flex Zone \w+/) || [''])[0];
    await say(p, `${suite ? `**${suite}**: the` : 'The'} visitor came and signed on site — Maria records the visit.`);
    await spot(p, null);
    await click(p, pickBtn, { mutating: true, after: 150 });
    await toast(p);
    await say(p, 'It now waits for the manager to upload the signed documents.');
  });
}

// ─── 6 · finalize ────────────────────────────────────────────────────────────
async function chFinalize(D) {
  const p = await D.page('manager');
  await D.enter(p, CARDS.finalize, 'manager', async () => {
    await D.login('manager');
    await resetCamera(p);
    await p.goto(`${D.base}/admin/reception`, { waitUntil: 'domcontentloaded' });
    await settle(p);
    await mainTop(p);
    await jumpTo(p, p.locator('main button').filter({ hasText: /^\s*To Call/ }).first(), 230);
  });
  await checkpoint(p, 'manager-reception');
  await step(p, 'documents tab', async () => {
    await click(p, p.locator('main button').filter({ hasText: 'Awaiting Manager Upload' }).first(), { after: 300 });
    await settle(p);
  });
  await step(p, 'open Rumaila', async () => {
    const who = p.locator('main').getByText(/Rumaila Consulting Group|Nadine Saab/).first();
    const target = (await exists(p, who, 4000)) ? who : p.locator('main').getByText('Suite 304', { exact: true }).first();
    const cardLoc = await boxAround(p, target);
    await spot(p, cardLoc);
    await say(p, '**Rumaila Consulting Group** visited, signed the lease and handed over a cheque.');
    await spot(p, null);
    const details = cardLoc.getByRole('button', { name: 'Details' });
    await hover(p, details, { after: 100 });
    await cut(p, async () => {
      await quickClick(p, details);
      await p.waitForURL(/\/admin\/bookings\/[^/]+$/, { timeout: 15000 });
      await settle(p);
      await jumpTo(p, p.locator('.ant-card').filter({ hasText: 'Upload documents' }).first());
    });
  });
  await checkpoint(p, 'manager-booking-documents');
  await step(p, 'finalize', async () => {
    const list = p.locator('.ant-list').first();
    if (await exists(p, list, 3000)) await spot(p, list, { pad: 6 });
    await say(p, 'The scans are on file: CR copy, QID and the **signed lease**.');
    await spot(p, null);
    await click(p, p.getByRole('button', { name: /Finalize booking/ }), { mutating: true, after: 60 });
    await cut(p, async () => {
      if (!S.dry) { try { await p.locator('.ant-message-notice').first().waitFor({ state: 'visible', timeout: 12000 }); } catch { /* ignore */ } }
      await quickClick(p, sidebarBtn(p, 'Bookings'));
      await settle(p);
      await p.getByPlaceholder('Search by booking # or space...').fill('Suite 304');
      await rawSleep(500);
    });
    await checkpoint(p, 'manager-booking-active');
    const row = p.locator('main div[style*="grid-template-columns"]').filter({ hasText: 'Suite 304' }).filter({ hasText: /Active/ }).first();
    if (await exists(p, row, 2500)) await spot(p, row, { pad: 2, radius: 6 });
    await say(p, 'Finalized: an **active lease**, and the suite leaves the public map.');
    await spot(p, null);
  });
}

// ─── 7 · AI maintenance ──────────────────────────────────────────────────────
async function kpiValue(label) {
  const v = label.locator('xpath=following-sibling::p[1]');
  for (let i = 0; i < 25; i++) {
    const t = ((await v.innerText({ timeout: 1000 }).catch(() => '')) || '').trim();
    if (/^\d+$/.test(t)) return Number(t);
    await rawSleep(200);
  }
  return null;
}

async function chAI(D) {
  const p = await D.page('manager');
  await D.enter(p, CARDS.ai, 'manager', async () => {
    await D.login('manager');
    await resetCamera(p);
    await p.goto(`${D.base}/admin/maintenance`, { waitUntil: 'domcontentloaded' });
    await settle(p);
  });
  await checkpoint(p, 'manager-maintenance');
  await step(p, 'ticket count', async () => {
    const label = p.locator('main p').filter({ hasText: /^Total$/ }).first();
    const n = await kpiValue(label);
    await spot(p, await boxAround(p, label));
    await say(p, n != null ? `**${n} tickets** across Msheireb’s buildings.` : 'Every ticket in Msheireb’s buildings.');
    await spot(p, null);
  });
  let suggestion = null;
  const sug = { prio: 'Emergency', tech: null };
  const dialog = p.getByRole('dialog').filter({ hasText: 'Submit Maintenance Request' });
  await step(p, 'describe the problem', async () => {
    await click(p, p.locator('main button').filter({ hasText: 'Submit Ticket' }).first(), { after: 400 });
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    await sleep(300);
    await caption(p, 'A tenant reports a problem — Fatima types it in plain words.');
    await click(p, dialog.getByPlaceholder('e.g. AC not working in Office 201'), { after: 100 });
    await typeText(p, 'Socket sparked when I plugged in the kettle');
    await click(p, dialog.getByPlaceholder(/When did it start/), { after: 100 });
    await typeText(p, 'There was a bang and a burning smell. We unplugged everything.');
    await sleep(200);
    await caption(p, 'Clicking outside the box asks the model for a suggestion…');
    await click(p, dialog.getByText('Report an issue or request maintenance').first(), { after: 150 });
    const sugEl = dialog.getByText('Suggested', { exact: true });
    await sugEl.waitFor({ state: 'visible', timeout: 45000 });
    await sleep(400);
    suggestion = await boxAround(p, sugEl, { minRadius: 6 });
  });
  await checkpoint(p, 'ai-suggestion');
  await step(p, 'read the suggestion', async () => {
    if (!suggestion) throw new Error('no suggestion appeared');
    await spot(p, suggestion, { pad: 6 });
    const pills = await suggestion.locator('span').allInnerTexts();
    const labels = pills.map((x) => x.trim()).filter((x) => x && !/^(Suggested|AI|keyword match|Apply)$/.test(x) && !/^[—-]/.test(x));
    const cat = labels[0] ?? 'Electrical'; const prio = labels[1] ?? 'Emergency';
    sug.prio = prio;
    await say(p, `The model suggests **${cat} · ${prio}**, and says why.`);
    const who = suggestion.locator('b').first();
    if (await exists(p, who, 1000)) {
      const name = (await who.innerText()).trim();
      sug.tech = name;
      const line = (await who.locator('xpath=..').innerText()).replace(name, '').replace(/^\s*[—-]\s*/, '').trim();
      await say(p, `The technician comes from ticket history, not the model: **${name}** — “${line}”.`);
    }
    await spot(p, null);
  });
  await step(p, 'apply and submit', async () => {
    await click(p, dialog.getByRole('button', { name: /^Apply$/ }).first(), { after: 300 });
    const assign = dialog.getByRole('button', { name: /Assign to them/ }).first();
    const assigned = await exists(p, assign, 1500);
    if (assigned) await click(p, assign, { after: 200 });
    await caption(p, assigned ? 'Category, priority and technician filled in — Fatima only picks the space.' : 'Category and priority filled in — Fatima only picks the space.');
    const spaceSel = dialog.locator('.ant-form-item').filter({ hasText: /^Space/ }).locator('.ant-select').first();
    await click(p, spaceSel, { after: 200 });
    await typeText(p, 'kbc-301', { delay: 55 });
    await sleep(500);
    await p.keyboard.press('Enter');
    await sleep(400);
    await click(p, dialog.getByRole('button', { name: /Submit Ticket/ }).last(), { mutating: true, after: 150 });
    await toast(p);
    if (S.dry) await p.keyboard.press('Escape');
    await say(p, assigned && sug.tech ? `Filed as **${sug.prio}** and already on ${sug.tech}’s list.` : `Filed as **${sug.prio}**.`);
  });
}

// ─── 8 · rival landlord ──────────────────────────────────────────────────────
async function chRival(D) {
  const p = await D.page('rival');
  await D.enter(p, CARDS.rival, 'rival', async () => {
    await D.login('rival');
    await p.goto(`${D.base}/admin/maintenance`, { waitUntil: 'domcontentloaded' });
    await settle(p);
  });
  await checkpoint(p, 'rival-maintenance');
  await step(p, 'isolation', async () => {
    const label = p.locator('main p').filter({ hasText: /^Total$/ }).first();
    const n = await kpiValue(label);
    await spot(p, await boxAround(p, label));
    await say(p, n != null ? `Same screen, another company: **${n} tickets** — West Bay’s own.` : 'Same screen, another company: West Bay’s own tickets.');
    await spot(p, null);
    await fill(p, p.getByPlaceholder('Search by title or ticket #...'), 'Socket sparked');
    await sleep(700);
    await checkpoint(p, 'rival-search');
    await say(p, 'Fatima’s emergency from a minute ago? **Not here.** Each landlord sees only its own.');
  });
}

// ─── 9 · finance ─────────────────────────────────────────────────────────────
const PAID_HOW = {
  CHECK:         { how: 'by cheque',        then: 'Once it clears, Omar confirms it.' },
  BANK_TRANSFER: { how: 'by bank transfer', then: 'Once the money arrives, Omar confirms it.' },
  CASH:          { how: 'in cash',          then: 'Omar confirms it once counted.' },
};

async function pendingPayment(p, D) {
  try {
    const list = await apiGet(p, D, '/billing/payments');
    const how = (x) => String(x.method ?? x.payment_method ?? 'BANK_TRANSFER');
    const who = (x) => x.tenant?.name ?? x.invoice?.tenant?.name ?? '';
    const pend = list.filter((x) => x.status === 'PENDING' && x.payment_number);
    log(`   finance: ${pend.length} pending — ${pend.map((x) => `${x.payment_number} ${how(x)} ${x.amount} ${who(x)}`).join(' | ')}`);
    const score = (x) => (/Brightpath/i.test(who(x)) ? 8 : 0) + (how(x) === 'CHECK' ? 4 : 0) + Math.min(1, Number(x.amount) / 100000);
    const x = pend.sort((a, b) => score(b) - score(a))[0];
    if (!x) return null;
    return { number: x.payment_number, invoice: x.invoice?.invoice_number, method: how(x), tenant: who(x) || 'A renter',
      amount: Number(x.amount).toLocaleString('en-US', { maximumFractionDigits: 2 }) };
  } catch (e) { log('   finance: could not read the payments —', e.message); return null; }
}

async function chFinance(D) {
  const p = await D.page('finance');
  let pay = null;
  await D.enter(p, CARDS.finance, 'finance', async () => {
    await D.login('finance');
    if (!/finance-dashboard/.test(p.url())) await p.goto(`${D.base}/admin/finance-dashboard`, { waitUntil: 'domcontentloaded' });
    await settle(p);
    await mainTop(p);
    pay = await pendingPayment(p, D);
  });
  await checkpoint(p, 'finance-dashboard');
  await step(p, 'dashboard', async () => {
    await scrollMain(p, { el: labelIn(p, 'Total Collected'), offset: 200, ms: 800 });
    await say(p, 'Omar’s dashboard: collected, pending and overdue — all in QAR.');
    await scrollMain(p, { el: titleIn(p, 'Revenue vs Refunds'), offset: 120, ms: 1000 });
    await say(p, 'Revenue by month, recurring rent, and how each tenant pays.');
  });
  await step(p, 'confirm the payment', async () => {
    await nav(p, 'Payments');
    await mainTop(p);
    if (!pay) { await say(p, 'Each payment a renter reports waits here for finance.'); return; }
    await fill(p, p.getByPlaceholder('Search payments, tenant, invoice...'), pay.number);
    await sleep(400);
    await checkpoint(p, 'finance-payments');
    const btn = p.locator('main button[title="Confirm payment"]').first();
    const row = btn.locator('xpath=ancestor::div[contains(@style,"grid-template-columns")][1]');
    if (await exists(p, row, 3000)) await spot(p, row, { pad: 2, radius: 6 });
    const m = PAID_HOW[pay.method] ?? PAID_HOW.BANK_TRANSFER;
    await say(p, `**${pay.tenant}** reported **QAR ${pay.amount} ${m.how}**. ${m.then}`);
    await spot(p, null);
    await click(p, btn, { after: 250 });
    const dlg = p.getByRole('dialog').filter({ hasText: 'Confirm payment received?' });
    await dlg.waitFor({ state: 'visible', timeout: 8000 });
    await sleep(500);
    await click(p, dlg.getByRole('button', { name: /^Confirm$/ }).first(), { mutating: true, after: 150 });
    if (S.dry) await p.keyboard.press('Escape');
    await toast(p);
    await say(p, 'Confirmed: the payment is recorded and the invoice is marked **Paid**.');
  });
  await tour(p, [
    { nav: 'Contract renewals', say: 'Renewal alerts for leases ending within 30, 60 and 90 days.' },
    {
      nav: 'Export (CSV/Excel)',
      say: 'And any period exports to Excel for the accountant.',
      after: async (pg) => {
        const xl = pg.locator('main').getByRole('button', { name: /Excel/ }).first();
        if (await exists(pg, xl, 2000)) { await click(pg, xl, { after: 600 }); }
      },
    },
  ]);
}

// ─── 10 · technician ─────────────────────────────────────────────────────────
async function chTech(D) {
  const p = await D.page('tech');
  await D.enter(p, CARDS.tech, 'tech', async () => {
    await D.login('tech');
    await p.goto(`${D.base}/admin/maintenance-dashboard`, { waitUntil: 'domcontentloaded' });
    await settle(p);
    await mainTop(p);
  });
  await checkpoint(p, 'tech-dashboard');
  await step(p, 'dashboard', async () => {
    const em = p.locator('main').getByText(/EMERGENCY ticket|urgent ticket/).first();
    if (await exists(p, em, 1500)) {
      await spot(p, await boxAround(p, em));
      await say(p, 'The emergency Fatima filed is already at the top of **Rajesh’s dashboard**.');
      await spot(p, null);
    }
    await scrollMain(p, { el: titleIn(p, 'Team Workload'), offset: 140, ms: 1100 });
    await say(p, 'Ticket trends, priorities and the team’s workload.');
  });
  await step(p, 'accept the Zubarah Room leak', async () => {
    await nav(p, 'My Tickets');
    const openQ = p.locator('main button').filter({ hasText: /^Open queue$/ }).first();
    if (await exists(p, openQ, 3000)) { await click(p, openQ, { after: 250 }); await settle(p); }
    await checkpoint(p, 'tech-open-queue');
    const row = p.locator('main').getByText(/Water leaking from the AC unit/).first().locator('xpath=ancestor::div[.//button][1]');
    await spot(p, row, { pad: 2, radius: 6 });
    await say(p, 'Water through the ceiling in the **Zubarah Room** — and nobody has taken it yet.');
    await spot(p, null);
    await click(p, row.getByRole('button', { name: /Accept/ }).first(), { mutating: true, after: 150 });
    await toast(p);
  });
  await step(p, 'start work', async () => {
    const mine = p.locator('main button').filter({ hasText: /^My jobs$/ }).first();
    if (await exists(p, mine, 2000)) { await click(p, mine, { after: 250 }); await settle(p); }
    const title = p.locator('main').getByText(/Water leaking from the AC unit/).first();
    if (!(await exists(p, title, 3000))) { await say(p, 'Accepted: the job is his, and no other technician can claim it.'); return; }
    const row = title.locator('xpath=ancestor::div[.//button][1]');
    const eye = row.locator('button:has(.anticon-eye)').first();
    await click(p, (await eye.count()) ? eye : row.locator('button').last(), { after: 400 });
    const start = p.getByRole('button', { name: /Start Work/ }).first();
    if (await exists(p, start, 4000)) {
      await caption(p, 'Accepted — now on his list. Rajesh starts the work…');
      await sleep(600);
      await click(p, start, { mutating: true, after: 150 });
      await toast(p);
      if (S.dry) await p.keyboard.press('Escape');
      await say(p, '…and the status turns **In progress** for everyone following the ticket.');
    } else {
      await p.keyboard.press('Escape');
      await say(p, 'Accepted: the job is his, and no other technician can claim it.');
    }
  });
  await tour(p, [{ nav: 'Risk scoring', say: 'Risk scoring flags the spaces most likely to break down next.' }]);
}

// ─── 11 · renter admin ───────────────────────────────────────────────────────
async function chRenter(D) {
  const p = await D.page('renter');
  await D.enter(p, CARDS.renter, 'renter', async () => {
    await D.login('renter');
    await p.goto(`${D.base}/portal/dashboard`, { waitUntil: 'domcontentloaded' });
    await settle(p);
    await mainTop(p);
  });
  await checkpoint(p, 'renter-dashboard');
  await say(p, 'Noor runs Acme Corp’s side: its team, bookings, lease and invoices — nothing else.');
  await step(p, 'contract', async () => {
    await nav(p, 'Contracts');
    const num = p.locator('main').getByText(/^CT-\d{6}-[0-9A-F]+$/).first();
    if (await exists(p, num, 4000)) {
      const ct = (await num.innerText()).trim();
      const row = num.locator('xpath=ancestor::*[contains(@style,"grid-template-columns") or self::tr][1]');
      const rent = ((await row.innerText().catch(() => '')).match(/QAR\s?[\d,]+/) || [''])[0];
      if (await exists(p, row, 1000)) await spot(p, row, { pad: 2, radius: 6 });
      await say(p, `Their lease **${ct}**${rent ? ` — **${rent} a month**` : ''}: the same contract Msheireb sees.`);
      await spot(p, null);
    }
  });
  await step(p, 'pay an invoice', async () => {
    await nav(p, 'Billing');
    await checkpoint(p, 'renter-billing');
    const payBtn = p.locator('main button').filter({ hasText: /^\s*Pay\s*$/ }).first();
    await click(p, payBtn, { after: 400 });
    // the payment form is the app's own overlay, not an antd modal
    const dlg = p.locator('div[style*="position: fixed"]').filter({ has: p.locator('h2', { hasText: 'Submit Payment' }) }).last();
    await dlg.waitFor({ state: 'visible', timeout: 8000 });
    await caption(p, 'Paying an invoice means telling finance how you paid…');
    const transfer = dlg.getByText('Bank Transfer', { exact: true }).first();
    if (await exists(p, transfer, 1500)) await click(p, transfer, { after: 200 });
    const full = dlg.getByText(/Use full remaining balance/).first();
    if (await exists(p, full, 1500)) await click(p, full, { after: 200 });
    const ref = dlg.getByPlaceholder(/REF-001|TXN|CHQ/).first();
    if (await exists(p, ref, 1500)) { await click(p, ref, { after: 80 }); await typeText(p, 'TRX-88412'); }
    await sleep(300);
    await click(p, dlg.getByRole('button', { name: /Submit Payment/ }).last(), { mutating: true, after: 150 });
    // dry run: this overlay ignores Escape, so close it with its own button
    if (S.dry) await quickClick(p, dlg.getByRole('button', { name: /^Cancel$/ }).first()).catch(() => {});
    await toast(p);
    await say(p, '…and finance confirms it, exactly as Omar did a moment ago.');
  });
  await tour(p, [{ nav: 'My Team', say: 'Her team: Acme’s employees, each with their own login.' }]);
}

// ─── 12 · renter employee ────────────────────────────────────────────────────
async function chEmployee(D) {
  const p = await D.page('employee');
  await D.enter(p, CARDS.employee, 'employee', async () => {
    await D.login('employee');
    await p.goto(`${D.base}/portal/dashboard`, { waitUntil: 'domcontentloaded' });
    await settle(p);
    await mainTop(p);
  });
  await checkpoint(p, 'employee-dashboard');
  await say(p, 'Karim is an Acme employee: he sees his own bookings, not the company’s.');
  await step(p, 'my bookings', async () => {
    await nav(p, 'My Bookings');
    const row = p.locator('main div[style*="grid-template-columns"]').filter({ hasText: 'Conference 7' }).first();
    if (await exists(p, row, 3000)) {
      await spot(p, row, { pad: 2, radius: 6 });
      const st = /Confirmed/i.test(await row.innerText()) ? '**Confirmed**' : 'in his list';
      await say(p, `The Conference 7 request Fatima approved is now ${st}.`);
      await spot(p, null);
    }
  });
  await step(p, 'book a room on the floor map', async () => {
    await caption(p, '');
    await cut(p, async () => {
      await p.goto(`${D.base}/portal/floor-map`, { waitUntil: 'domcontentloaded' });
      await settle(p);
    });
    await checkpoint(p, 'employee-floor-map');
    await say(p, 'On the floor map, every free room shows its capacity and price.');
    // the innermost box holding both the room's name and its "Tap to book"
    const room = p.locator('main div')
      .filter({ has: p.getByText('Al Khor Room', { exact: true }) })
      .filter({ has: p.getByText('Tap to book', { exact: true }) }).last();
    const tap = (await room.count()) ? room.getByText('Tap to book', { exact: true }).first() : p.locator('main').getByText('Tap to book').first();
    await click(p, tap, { after: 400 });
    const date = p.locator('input[type="date"]');
    await date.first().waitFor({ state: 'visible', timeout: 8000 });
    const d = new Date(Date.now() + 2 * 86400000);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await click(p, date.nth(0), { after: 80 }); await date.nth(0).fill(ymd);
    await click(p, date.nth(1), { after: 80 }); await date.nth(1).fill(ymd);
    await sleep(400);
    await caption(p, 'He picks a day; the price is worked out as he goes.');
    await sleep(900);
    await click(p, p.getByRole('button', { name: /Confirm Booking/ }).first(), { mutating: true, after: 150 });
    await toast(p);
    await say(p, 'Booked — and it appears in Fatima’s list if the room needs approval.');
  });
}

// ─── 13 · API ────────────────────────────────────────────────────────────────
async function chApi(D) {
  const p = await D.page('api');
  const swagger = await swaggerStats(D.api);
  await D.enter(p, CARDS.api, 'api', async () => {
    await p.goto(`${D.base}/api`, { waitUntil: 'domcontentloaded' });
    await visible(p, '.opblock-tag', 30000);
    await settle(p);
  });
  await checkpoint(p, 'swagger');
  await step(p, 'swagger', async () => {
    await say(p, swagger?.operations
      ? `The whole API is documented with Swagger: **${swagger.operations} operations** in ${swagger.tags} groups.`
      : 'The whole API is documented with Swagger.');
    await p.evaluate(() => window.scrollTo({ top: 900, behavior: 'smooth' }));
    await sleep(1100);
    const op = p.locator('.opblock-summary').filter({ hasText: '/spaces/public/map' }).first();
    await op.scrollIntoViewIfNeeded();
    await rawSleep(300);
    await click(p, op, { after: 400 });
    await click(p, p.locator('.try-out__btn').first(), { after: 300 });
    await click(p, p.locator('.btn.execute').first(), { after: 600 });
    const status = p.locator('.live-responses-table .response').first();
    await status.waitFor({ state: 'visible', timeout: 15000 });
    await status.evaluate((e) => e.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await sleep(700);
    await spot(p, status, { pad: 6 });
    await say(p, 'Any endpoint can be tried from the browser — here, the public map: **200 OK**.');
    await spot(p, null);
  });

  // the live check: a page served by the recorder, filled as the answers arrive
  await step(p, 'live API check', async () => {
    const url = `${D.base}/__demo/api-check`;
    const html = apiCheckHtml({ identities: IDENTITIES, endpoints: ENDPOINTS, apiUrl: D.api, swagger });
    await p.route(url, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
    await caption(p, '');
    await cut(p, async () => {
      await p.goto(url, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => !!window.__api);
      await rawSleep(300);
    });
    await say(p, `Now every read endpoint, as all **${IDENTITIES.length} identities** — real requests, live.`, { hold: 2600 });
    const report = await apiCheck({
      api: D.api, password: PASSWORD, out: S.outDir, log,
      onRow: async (i, row) => {
        await p.evaluate(({ i, r }) => window.__api.fill(i, r), { i, r: row.results });
        await rawSleep(Math.round(120 / Math.max(1, S.speed / 1.35)));
      },
    });
    await p.evaluate(() => window.__api.clearCur());
    const s = report.summary;
    log(`   api check: ${JSON.stringify(s)}`);
    D.apiReport = report;
    const refused = s.auth + s.denied;
    await p.evaluate((h) => window.__api.done(h), `<div class="big">${s.calls.toLocaleString('en-US')} requests</div>
      <div class="row"><div class="g"><b>${s.ok}</b>allowed</div><div class="s"><b>${refused}</b>refused by the rules</div><div class="r"><b>${s.error + s.client}</b>errors</div></div>`);
    await say(p, `**${s.calls} requests**: ${s.ok} allowed, ${refused} refused by role or company — and **${s.error} server errors**.`);
    await p.evaluate(() => window.__api.hideDone());
    await sleep(400);
    const names = Object.fromEntries(IDENTITIES.map((i) => [i.key, i.short]));
    const explain = async (path, text) => {
      const i = ENDPOINTS.findIndex((e) => e.path === path);
      if (i < 0) return;
      await p.evaluate((i) => window.__api.show(i, 'center'), i);
      await rawSleep(700);
      const r = await p.evaluate((i) => window.__api.rowRect(i), i);
      await demo(p, 'spot', r, { pad: 3, radius: 8 });
      const row = report.rows[i];
      const ok = IDENTITIES.filter((id) => verdict(row.results[id.key]?.status) === 'ok').map((id) => names[id.key]);
      const no = IDENTITIES.filter((id) => ['auth', 'denied'].includes(verdict(row.results[id.key]?.status))).map((id) => names[id.key]);
      await say(p, text(ok, no));
      await demo(p, 'spot', null);
    };
    await explain('/audit', (ok) => `**Audit log**: only ${ok.join(', ')} gets in — every other account is refused.`);
    const usage = report.rows.find((r) => r.path === '/addon-services/{addon}/usage-stats');
    if (usage && verdict(usage.results.rival?.status) === 'denied' && verdict(usage.results.manager?.status) === 'ok') {
      await explain('/addon-services/{addon}/usage-stats', () => '**Add-on revenue** at Msheireb: its own staff only — the competitor and the renters are refused.');
    }
    await explain('/bookings/{booking}', (ok, no) => `**One of Acme’s bookings at Msheireb**: ${no.includes('West Bay') ? 'the competitor, West Bay, is refused' : `refused for ${no.join(', ')}`}.`);
    await explain('/billing/payments', (ok, no) => `**Payments**: refused for ${no.filter((x) => x !== 'Guest').join(' and ')}; renters see only their own.`);
  });
}

export const CHAPTERS = [
  { n: 1, name: 'Guest · map and AI finder', run: chMap },
  { n: 2, name: 'Platform owner', run: chOwner },
  { n: 3, name: 'Client admin', run: chClientAdmin },
  { n: 4, name: 'Property manager · approvals', run: chManager },
  { n: 5, name: 'Reception · call and visit', run: chReception },
  { n: 6, name: 'Manager · finalize lease', run: chFinalize },
  { n: 7, name: 'Manager · AI maintenance', run: chAI },
  { n: 8, name: 'Rival landlord · isolation', run: chRival },
  { n: 9, name: 'Finance · confirm payment', run: chFinance },
  { n: 10, name: 'Technician · accept and start', run: chTech },
  { n: 11, name: 'Renter admin · Acme', run: chRenter },
  { n: 12, name: 'Renter employee · Acme', run: chEmployee },
  { n: 13, name: 'API · Swagger and live check', run: chApi },
];
