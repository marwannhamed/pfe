// Core helpers for the LeaseManager demo recorder: screencast capture piped to
// ffmpeg, a smooth on-screen cursor, captions, cards, spotlight, camera and
// "wait until the page has settled" logic.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// ─── global state ─────────────────────────────────────────────────────────────
export const S = {
  speed: 1,          // >1 shortens every pause and animation (probe runs)
  dry: false,        // skip clicks that change data
  shots: false,      // save a screenshot at each checkpoint
  outDir: '.',
  shotDir: '.',
  rec: null,         // Recorder
  chip: '', chipColor: '#2563eb',
  capPos: 'bottom',  // 'top' on dashboards, where the interesting row sits at the bottom
  report: { checkpoints: [], errors: [], warnings: [] },
  shotIndex: 0,
  logFile: null,
};

const t0 = Date.now();
export function log(...a) {
  const line = `[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s] ${a.join(' ')}`;
  console.log(line);
  if (S.logFile) fs.appendFileSync(S.logFile, line + '\n');
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms / S.speed)));
export const rawSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now() / 1000;

function jpegSize(b) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return '?';
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return `${b.readUInt16BE(i + 7)}x${b.readUInt16BE(i + 5)}`;
    i += 2 + b.readUInt16BE(i + 2);
  }
  return '?';
}

// ─── recorder: CDP screencast → JPEG frames → ffmpeg (constant 30 fps) ────────
export class Recorder {
  constructor({ file, fps = 30, enabled = true, ffmpeg, crf = 16, preset = 'veryfast' }) {
    this.fps = fps;
    this.enabled = enabled;
    this.file = file;
    this.written = 0;
    this.acc = 0;           // recorded seconds in closed segments
    this.segStart = null;   // wall time when the current segment began (null = paused)
    this.lastBuf = null;
    this.cdp = null;
    this.page = null;
    this.frameWaiters = [];
    this.frames = 0;
    this.size = null;
    if (!enabled) return;
    const args = [
      '-hide_banner', '-loglevel', 'warning', '-y',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p',
      '-c:v', 'libx264', '-preset', preset, '-crf', String(crf),
      '-r', String(fps), '-movflags', '+faststart', file,
    ];
    this.ff = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    this.ff.stderr.on('data', (d) => log('[ffmpeg]', String(d).trim()));
    this.ff.stdin.on('error', (e) => log('[ffmpeg stdin]', e.message));
    this.done = new Promise((res) => this.ff.on('close', (code) => res(code)));
    this.timer = setInterval(() => this.flush(), 100);
  }

  clock() { return this.acc + (this.segStart != null ? now() - this.segStart : 0); }
  seconds() { return this.clock(); }

  flush() {
    if (!this.enabled || this.segStart == null || !this.lastBuf) return;
    const target = Math.floor(this.clock() * this.fps);
    while (this.written < target) {
      this.ff.stdin.write(this.lastBuf);
      this.written++;
    }
    const backlog = this.ff.stdin.writableLength;
    if (backlog > 400e6 && !this.warned) { this.warned = true; log('WARN: encoder is falling behind', (backlog / 1e6).toFixed(0), 'MB queued'); }
  }

  onFrame(buf, meta) {
    this.flush();
    this.lastBuf = buf;
    this.frames++;
    if (!this.size) this.size = jpegSize(buf);
    const w = this.frameWaiters; this.frameWaiters = [];
    w.forEach((f) => f());
  }

  nextFrame(timeout = 1500) {
    return new Promise((res) => {
      const t = setTimeout(res, timeout);
      this.frameWaiters.push(() => { clearTimeout(t); res(); });
    });
  }

  async attach(page) {
    if (this.page === page) return;
    if (this.cdp) {
      try { await this.cdp.send('Page.stopScreencast'); } catch { /* page may be gone */ }
      this.cdp.removeAllListeners('Page.screencastFrame');
    }
    this.page = page;
    if (!page.__cdp) page.__cdp = await page.context().newCDPSession(page);
    this.cdp = page.__cdp;
    this.cdp.on('Page.screencastFrame', ({ data, sessionId, metadata }) => {
      this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
      if (this.page !== page) return;
      this.onFrame(Buffer.from(data, 'base64'), metadata);
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    await this.freshFrame();
  }

  async freshFrame() {
    if (!this.page) return;
    const p = this.nextFrame();
    await this.page.evaluate(() => window.__demo && window.__demo.poke()).catch(() => {});
    await p;
  }

  resume() { if (this.segStart == null) this.segStart = now(); }
  pause() { if (this.segStart == null) return; this.flush(); this.acc = this.clock(); this.segStart = null; }
  get paused() { return this.segStart == null; }

  async finish() {
    this.pause();
    clearInterval(this.timer);
    if (this.cdp) { try { await this.cdp.send('Page.stopScreencast'); } catch { /* ignore */ } }
    if (!this.enabled) return 0;
    this.ff.stdin.end();
    return this.done;
  }
}

// ─── network + page settling ──────────────────────────────────────────────────
const IGNORE_URL = /socket\.io|crisp|google|gstatic|unsplash|openstreetmap|sentry|favicon|hot-update/i;

export function trackNetwork(page) {
  const st = { inflight: new Set(), last: Date.now() };
  page.on('request', (r) => {
    const t = r.resourceType();
    if (!['xhr', 'fetch', 'document', 'script'].includes(t) || IGNORE_URL.test(r.url())) return;
    st.inflight.add(r); st.last = Date.now();
  });
  const done = (r) => { if (st.inflight.delete(r)) st.last = Date.now(); };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  page.__net = st;
}

export async function settle(page, { timeout = 20000, quiet = 320, images = true, warn = true } = {}) {
  const start = Date.now();
  let calmSince = null;
  while (Date.now() - start < timeout) {
    const net = page.__net;
    // drop requests that are stuck (long-poll etc.)
    if (net) for (const r of net.inflight) { if (Date.now() - net.last > 8000) net.inflight.delete(r); }
    const busyNet = net ? net.inflight.size > 0 : false;
    let busyDom = true;
    try {
      busyDom = await page.evaluate((checkImages) => {
        const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
        if ([...document.querySelectorAll('.ant-skeleton, .ant-spin-spinning, .ant-btn-loading')].some(vis)) return true;
        // a page that has not drawn yet (or is redirecting) has an empty main column
        const m = document.querySelector('main');
        if (m && (m.innerText || '').trim().length < 12) return true;
        if (checkImages && [...document.images].some((i) => vis(i) && !i.complete)) return true;
        return false;
      }, images);
    } catch { busyDom = true; }
    if (!busyNet && !busyDom) {
      calmSince ??= Date.now();
      if (Date.now() - calmSince >= quiet) return true;
    } else calmSince = null;
    await rawSleep(100);
  }
  if (warn) log('WARN: page did not settle within', timeout, 'ms', page.url());
  return false;
}

/**
 * Leave whatever happens inside fn out of the video — a plain jump cut, no
 * fade. Used for data that is still loading, so the viewer never waits for it.
 */
export async function skip(page, fn) {
  const rec = S.rec && !S.rec.paused ? S.rec : null;
  rec?.pause();
  try { await fn(); } finally {
    if (rec) { await rec.freshFrame(); rec.resume(); }
  }
}

/** Wait for the page; when that takes more than a moment, the wait is cut from the video. */
export async function settleFast(page, { grace = 650 } = {}) {
  if (await settle(page, { timeout: grace, quiet: 220, warn: false })) return false;
  await skip(page, async () => { await settle(page); await rawSleep(120); });
  return true;
}

// ─── cursor ───────────────────────────────────────────────────────────────────
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export async function cursorPos(page) {
  if (!page.__cur) {
    const p = await page.evaluate(() => (window.__demo ? window.__demo.cursorPos() : null)).catch(() => null);
    const vp = page.viewportSize();
    page.__cur = p && p.x > 0 ? p : { x: vp.width * 0.62, y: vp.height * 0.72 };
    await page.mouse.move(page.__cur.x, page.__cur.y);
  }
  return page.__cur;
}

export async function moveTo(page, x, y, { ms } = {}) {
  const from = await cursorPos(page);
  const dx = x - from.x; const dy = y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return;
  const dur = (ms ?? Math.min(850, 260 + dist * 0.38)) / S.speed;
  // a gentle arc rather than a ruler-straight line
  const bend = (Math.random() < 0.5 ? -1 : 1) * Math.min(80, dist * 0.12);
  const cx = from.x + dx / 2 - (dy / (dist || 1)) * bend;
  const cy = from.y + dy / 2 + (dx / (dist || 1)) * bend;
  const start = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - start) / dur);
    const e = easeInOut(t);
    const px = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * cx + e * e * x;
    const py = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * cy + e * e * y;
    await page.mouse.move(px, py);
    page.__cur = { x: px, y: py };
    if (t >= 1) break;
    await rawSleep(14);
  }
}

// ─── element helpers ──────────────────────────────────────────────────────────
export const L = (page, sel) => (typeof sel === 'string' ? page.locator(sel) : sel);

export async function visible(page, sel, timeout = 15000) {
  const loc = L(page, sel).first();
  await loc.waitFor({ state: 'visible', timeout });
  return loc;
}

export async function exists(page, sel, timeout = 2500) {
  try { await L(page, sel).first().waitFor({ state: 'visible', timeout }); return true; } catch { return false; }
}

async function stableBox(loc) {
  let prev = null;
  for (let i = 0; i < 30; i++) {
    const b = await loc.boundingBox();
    if (b && prev && Math.abs(b.x - prev.x) < 0.5 && Math.abs(b.y - prev.y) < 0.5 && Math.abs(b.height - prev.height) < 0.5) return b;
    prev = b;
    await rawSleep(70);
  }
  return prev;
}

export async function ensureInView(page, sel, { block = 'center', top = 72, bottom = 120 } = {}) {
  const loc = L(page, sel).first();
  const scrolled = await loc.evaluate((el, o) => {
    const r = el.getBoundingClientRect();
    if (r.top >= o.top && r.bottom <= innerHeight - o.bottom) return false;
    el.scrollIntoView({ behavior: 'smooth', block: o.block, inline: 'nearest' });
    return true;
  }, { top, bottom, block });
  if (scrolled) await rawSleep(120);
  return stableBox(loc);
}

/** Smoothly scroll the element so its top sits near the top of the screen. */
export async function scrollToTop(page, sel, offset = 16) {
  const loc = L(page, sel).first();
  await loc.evaluate((el, off) => {
    let p = el.parentElement;
    while (p && !(p.scrollHeight > p.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
    if (!p) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const delta = el.getBoundingClientRect().top - p.getBoundingClientRect().top - off;
    p.scrollBy({ top: delta, behavior: 'smooth' });
  }, offset);
  await rawSleep(150);
  await stableBox(loc);
}

export async function scrollMainTo(page, top = 0) {
  await page.evaluate((t) => { const m = document.querySelector('main'); if (m) m.scrollTo({ top: t, behavior: 'smooth' }); }, top);
  await rawSleep(700 / S.speed);
}

/** Move the cursor onto an element and click it (or only hover, in dry runs). */
export async function click(page, sel, { mutating = false, after = 300, hoverOnly = false, dx = 0, dy = 0, timeout = 15000, scroll = true } = {}) {
  const loc = await visible(page, sel, timeout);
  let box = scroll ? await ensureInView(page, loc) : await loc.boundingBox();
  if (!box) throw new Error('no bounding box for click target');
  const jx = (Math.random() - 0.5) * Math.min(10, box.width / 5);
  const jy = (Math.random() - 0.5) * Math.min(6, box.height / 5);
  let x = box.x + box.width / 2 + jx + dx;
  let y = box.y + box.height / 2 + jy + dy;
  await moveTo(page, x, y);
  // Make sure the point really is on the target: a list still scrolling, or an
  // item clipped at the edge of a scroll box, would otherwise send the click to
  // whatever is drawn there (the sidebar's Collapse button, once).
  const onTarget = () => loc.evaluate((el, p) => {
    const h = document.elementFromPoint(p.x, p.y);
    return !!h && (h === el || el.contains(h));
  }, { x, y }).catch(() => true);
  for (let i = 0; !(await onTarget()); i++) {
    if (i >= 3) throw new Error('click target is covered or out of view');
    if (scroll) await loc.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' })).catch(() => {});
    await rawSleep(150);
    box = await stableBox(loc);
    if (!box) throw new Error('no bounding box for click target');
    x = box.x + box.width / 2 + dx;
    y = box.y + box.height / 2 + dy;
    await moveTo(page, x, y, { ms: 220 });
  }
  await sleep(110);
  if (hoverOnly || (mutating && S.dry)) {
    if (mutating && S.dry) log('   (dry run: not clicking a data-changing button)');
    await sleep(after);
    return loc;
  }
  await page.mouse.down();
  await rawSleep(80);
  await page.mouse.up();
  await sleep(after);
  return loc;
}

export async function hover(page, sel, opts = {}) { return click(page, sel, { ...opts, hoverOnly: true }); }

/** Type like a person: steady rhythm with small, natural variations. */
export async function typeText(page, text, { delay = 34 } = {}) {
  for (const ch of text) {
    await page.keyboard.type(ch);
    let d = delay * (0.6 + Math.random() * 0.8);
    if (ch === ' ' && Math.random() < 0.2) d += 50;
    if (/[.,!?]/.test(ch)) d += 80;
    await sleep(d);
  }
}

/** Clear an input and type into it. */
export async function fill(page, sel, text, opts = {}) {
  const loc = await click(page, sel, { after: 200 });
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await typeText(page, text, opts);
  return loc;
}

// ─── overlay API wrappers ─────────────────────────────────────────────────────
export async function demo(page, fn, ...args) {
  try {
    await page.waitForFunction(() => !!(window.__demo && window.__demo.ready()), null, { timeout: 5000 });
  } catch { /* overlay missing — the call below will be a no-op */ }
  return page.evaluate(({ fn: name, args: a }) => window.__demo && window.__demo[name](...a), { fn, args });
}

export function holdFor(text) {
  const words = String(text).replace(/\*\*/g, '').split(/\s+/).length;
  return Math.max(2000, Math.min(5400, 800 + words * 240));
}

/** Show a caption and leave it on screen long enough to read. */
export async function say(page, text, { hold, chip = S.chip, color = S.chipColor, pos = S.capPos } = {}) {
  log('   ▸', text.replace(/\*\*/g, ''));
  await demo(page, 'caption', text, chip, color, pos);
  await sleep(hold ?? holdFor(text));
}
export async function caption(page, text, { chip = S.chip, color = S.chipColor, pos = S.capPos } = {}) {
  if (text) log('   ▸', text.replace(/\*\*/g, ''));
  await demo(page, 'caption', text, chip, color, pos);
}

/**
 * Highlight an element. The page only scrolls when the element is out of sight:
 * scrolling something that is already on screen can pull the known display
 * bugs below it into frame.
 */
export async function spot(page, sel, { pad = 8, nodim = false, radius = 12, ms } = {}) {
  if (!sel) { await demo(page, 'spot', null); await sleep(300); return; }
  const loc = L(page, sel).first();
  await loc.waitFor({ state: 'visible', timeout: 15000 });
  let box = await stableBox(loc);
  if (!box) return;
  const vh = page.viewportSize().height;
  const top = 56;                                        // under the app's top bar
  const bottom = S.capPos === 'bottom' ? vh - 100 : vh;  // above a bottom caption
  const fits = box.height <= bottom - top;
  const hidden = box.y < top - 4 || (box.y + box.height > bottom + 4 && (fits || box.y > bottom - 120));
  if (hidden) {
    box = await ensureInView(page, loc);
    if (!box) return;
    const i = await safeFrameInfo(page);
    if (i.forbid < i.vh - 2) {
      const msg = `spot scrolled ${page.url()} and "${i.reason}" came into view at y=${Math.round(i.forbid)}`;
      log('   WARN:', msg);
      S.report.warnings.push(msg);
    }
  }
  await demo(page, 'spot', box, { pad, nodim, radius });
  if (ms) { await sleep(ms); await demo(page, 'spot', null); await sleep(250); }
}

export async function spotRect(page, box, opts = {}) {
  await demo(page, 'spot', box, opts);
}

// ─── camera ───────────────────────────────────────────────────────────────────
/**
 * Look at the top of the page and work out how far down it is safe to show:
 * nothing at or below a chart, a "$" amount or an "Invalid Date" (known bugs
 * the brief keeps off camera). Returns the camera that hides them.
 */
export async function safeFrameInfo(page, { extra = [] } = {}) {
  return page.evaluate((extraSel) => {
    const main = document.querySelector('main') || document.body;
    const vw = innerWidth; const vh = innerHeight;
    let forbid = vh; let reason = '';
    const cardOf = (el) => {
      let p = el;
      while (p && p !== main) {
        const cs = getComputedStyle(p);
        const rad = parseFloat(cs.borderTopLeftRadius) || 0;
        const boxy = cs.boxShadow !== 'none' || (parseFloat(cs.borderTopWidth) || 0) > 0;
        if (rad >= 9 && boxy && p.getBoundingClientRect().width > 120) return p;
        p = p.parentElement;
      }
      return el;
    };
    // anything scrolled above the main column's top edge is clipped, not visible
    const clipTop = main === document.body ? 0 : Math.max(0, main.getBoundingClientRect().top);
    // text in a hidden tab pane (display:none) is not on screen
    const rendered = (el) => !!el && el.getClientRects().length > 0
      && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true }));
    const consider = (el, why) => {
      if (!rendered(el)) return;
      const r = cardOf(el).getBoundingClientRect();
      if (r.height === 0 || r.bottom <= clipTop + 2 || r.top >= vh) return;
      if (r.top < forbid) { forbid = r.top; reason = why; }
    };
    // (charts used to be on this list; they were fixed in the app)
    const tw = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) {
      const t = tw.currentNode.nodeValue || '';
      if (/\$\s?\d|Invalid Date|NaN/.test(t)) consider(tw.currentNode.parentElement, t.trim().slice(0, 40));
    }
    for (const s of extraSel) document.querySelectorAll(s).forEach((el) => consider(el, s));
    const aside = document.querySelector('aside');
    const left = aside ? aside.getBoundingClientRect().right : 0;
    return { forbid, reason, vw, vh, left };
  }, extra);
}

export async function camera(page, { s = 1, tx = 0, ty = 0, ms = 0 } = {}) {
  await page.evaluate(({ tx, ty, s, ms }) => window.__demo && window.__demo.camera(tx, ty, s, ms), { tx, ty, s, ms: ms / S.speed });
  page.__camera = { s, tx, ty };
  if (ms) await sleep(ms + 60);
}

export async function resetCamera(page, ms = 0) {
  if (!page.__camera || page.__camera.s === 1) return;
  await camera(page, { s: 1, tx: 0, ty: 0, ms });
}

/**
 * Scroll the main column so that `sel` (e.g. a row of KPI cards) ends just above
 * the bottom of the screen; whatever comes after it stays out of frame. Falls back
 * to the camera if something that must stay off camera is still visible.
 */
export async function fitAbove(page, sel, { gap = 10 } = {}) {
  await resetCamera(page);
  const loc = L(page, sel).first();
  await loc.waitFor({ state: 'visible', timeout: 15000 });
  await loc.evaluate((el, g) => {
    const main = document.querySelector('main');
    if (!main) return;
    const r = el.getBoundingClientRect();
    const delta = r.bottom - (innerHeight - g);
    if (delta > 0) main.scrollTop += delta;
  }, gap);
  await rawSleep(150);
  const i = await safeFrameInfo(page);
  if (i.forbid < i.vh - 2) {
    log(`   fitAbove: ${i.reason} still visible at y=${Math.round(i.forbid)} — using the camera`);
    return safeFrame(page);
  }
  log('   fitAbove: clean frame');
  return { s: 1, ok: true, info: i };
}

/** Zoom so that everything at or below the first "forbidden" block is out of frame. */
export async function safeFrame(page, { ms = 0, margin = 12, maxScale = 1.85 } = {}) {
  await resetCamera(page);
  const i = await safeFrameInfo(page);
  if (i.forbid >= i.vh - 2) { log('   camera: nothing to hide'); return { s: 1, ok: true, info: i }; }
  const h = Math.max(50, i.forbid - margin);
  let s = i.vh / h;
  const ok = s <= maxScale;
  s = Math.min(s, maxScale);
  // keep the left edge of the content column in frame (headings stay whole);
  // anything cropped goes off the right-hand side
  let tx = -s * Math.max(0, i.left - 8);
  tx = Math.max(i.vw - s * i.vw, Math.min(0, tx));
  log(`   camera: hide from y=${Math.round(i.forbid)} (${i.reason}) → zoom ${s.toFixed(2)}${ok ? '' : ' (capped!)'}`);
  if (!ok) S.report.warnings.push(`camera capped on ${page.url()} — ${i.reason} at y=${Math.round(i.forbid)}`);
  await camera(page, { s, tx, ty: 0, ms });
  return { s, ok, info: i };
}

/** Zoom onto a rectangle (viewport coordinates at zoom 1). */
export async function frameRect(page, r, { ms = 900, pad = 24, maxScale = 2 } = {}) {
  const vp = page.viewportSize();
  const w = r.width + pad * 2; const h = r.height + pad * 2;
  const s = Math.max(1, Math.min(maxScale, Math.min(vp.width / w, vp.height / h)));
  const cx = r.x + r.width / 2; const cy = r.y + r.height / 2;
  let tx = vp.width / 2 - s * cx; let ty = vp.height / 2 - s * cy;
  tx = Math.max(vp.width - s * vp.width, Math.min(0, tx));
  ty = Math.max(vp.height - s * vp.height, Math.min(0, ty));
  await camera(page, { s, tx, ty, ms });
}

// ─── transitions ──────────────────────────────────────────────────────────────
/** A quick dip to white: everything inside fn happens off camera. */
export async function cut(page, fn) {
  await demo(page, 'dip', true);
  await rawSleep(240);
  S.rec?.pause();
  try { await fn(); } finally {
    await demo(page, 'dip', true, true);
    await S.rec?.freshFrame();
    S.rec?.resume();
    await demo(page, 'dip', false);
    await rawSleep(240);
  }
}

/** Smoothly scroll the app's main column to a position (or by an element). */
export async function scrollMain(page, { to = null, by = null, el = null, offset = 70, ms = 900 } = {}) {
  const loc = el ? L(page, el).first() : null;
  const target = await page.evaluate(({ to, by, offset, hasEl }) => {
    const m = document.querySelector('main');
    if (!m) return null;
    let y = to;
    if (by != null) y = m.scrollTop + by;
    if (hasEl) y = null;
    return y == null ? null : Math.max(0, Math.min(y, m.scrollHeight - m.clientHeight));
  }, { to, by, offset, hasEl: !!loc });
  let y = target;
  if (loc) {
    y = await loc.evaluate((e, off) => {
      const m = document.querySelector('main');
      return Math.max(0, Math.min(m.scrollTop + e.getBoundingClientRect().top - m.getBoundingClientRect().top - off, m.scrollHeight - m.clientHeight));
    }, offset);
  }
  if (y == null) return;
  // eased scroll driven from here so its speed is predictable on camera
  await page.evaluate(({ y, ms }) => new Promise((res) => {
    const m = document.querySelector('main'); const y0 = m.scrollTop; const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = (now) => { const t = Math.min(1, (now - t0) / ms); m.scrollTop = y0 + (y - y0) * ease(t); if (t < 1) requestAnimationFrame(tick); else res(); };
    requestAnimationFrame(tick);
  }), { y, ms: ms / S.speed });
  await rawSleep(80);
}

// ─── checkpoints (probe runs) ────────────────────────────────────────────────
export async function checkpoint(page, name, extra = {}) {
  const entry = { name, url: page.url(), ...extra };
  try {
    const i = await safeFrameInfo(page);
    if (i.forbid < i.vh - 2) entry.offCameraIssue = `${i.reason} visible at y=${Math.round(i.forbid)} of ${i.vh}`;
  } catch { /* ignore */ }
  if (S.shots) {
    const file = path.join(S.shotDir, `${String(++S.shotIndex).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`);
    try { await page.screenshot({ path: file, scale: 'css' }); entry.shot = path.basename(file); } catch (e) { entry.shotError = e.message; }
  }
  S.report.checkpoints.push(entry);
  log('   ✓ checkpoint', name, entry.offCameraIssue ? `(!) ${entry.offCameraIssue}` : '');
}

/** Run one step; on failure log it, keep a screenshot and carry on. */
export async function step(page, name, fn) {
  log(' •', name);
  try { return await fn(); } catch (e) {
    const msg = `${name}: ${e.message.split('\n')[0]}`;
    log('   ✗ FAILED', msg);
    S.report.errors.push(msg);
    try { await page.screenshot({ path: path.join(S.shotDir, `error-${S.report.errors.length}.png`) }); } catch { /* ignore */ }
    return undefined;
  }
}
