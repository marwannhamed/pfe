// Read-only tour of the app used to plan the video: signs in as every demo
// account, opens every page in its sidebar, and records what each page shows,
// any request that fails, and any text that looks broken. Never clicks a button
// other than the sidebar, so no data changes.
import fs from 'node:fs';
import path from 'node:path';
import { log, settle, trackNetwork, rawSleep } from './lib.mjs';
import { IDENTITIES } from './apicheck.mjs';

const PUBLIC_PAGES = ['/', '/map', '/spaces', '/pricing', '/about', '/login', '/register'];
const NOISE = /socket\.io|favicon|sentry|crisp|google|gstatic|unsplash|openstreetmap|tile/i;

async function inspect(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const txt = main.innerText || '';
    const flags = [];
    if (/\$\s?\d/.test(txt)) flags.push('$ amount');
    if (/USD/.test(txt)) flags.push('USD');
    if (/Invalid Date/.test(txt)) flags.push('Invalid Date');
    if (/\bNaN\b/.test(txt)) flags.push('NaN');
    if (/\bundefined\b/.test(txt)) flags.push('undefined');
    if (/\bnull\b/.test(txt)) flags.push('null');
    if (/\[object Object\]/.test(txt)) flags.push('[object Object]');
    if (/Something went wrong|Unexpected error|Failed to load|Error loading/i.test(txt)) flags.push('error text');
    const h = main.querySelector('h1, h2, h3');
    const scroller = [main, ...main.querySelectorAll('*')].find((el) => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY));
    return {
      heading: h ? h.innerText.trim().slice(0, 80) : '',
      flags,
      textSample: txt.replace(/\s+/g, ' ').slice(0, 400),
      height: scroller ? scroller.scrollHeight : main.scrollHeight,
      charts: main.querySelectorAll('.recharts-wrapper').length,
      empty: [...main.querySelectorAll('.ant-empty-description')].map((e) => e.innerText.trim()).slice(0, 3),
    };
  }).catch((e) => ({ error: e.message }));
}

async function shoot(page, file, full) {
  await page.screenshot({ path: file, scale: 'css' }).catch(() => {});
  if (!full) return;
  // the app scrolls inside <main>, so grow the window to see the whole page
  const h = await page.evaluate(() => {
    const main = document.querySelector('main');
    return main ? Math.ceil(Math.min(4200, main.scrollHeight + (main.getBoundingClientRect().top || 0) + 8)) : 720;
  }).catch(() => 720);
  if (h > 760) {
    try {
      await page.setViewportSize({ width: 1280, height: h });
      await rawSleep(500);
      await page.screenshot({ path: file.replace(/\.png$/, '-full.png'), scale: 'css' }).catch(() => {});
    } finally {
      await page.setViewportSize({ width: 1280, height: 720 }).catch(() => {});
      await rawSleep(200);
    }
  }
}

export async function survey({ browser, base, out, password, only }) {
  const dir = path.join(out, 'survey');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const report = [];
  const watch = (page, bucket) => {
    page.on('response', (r) => { if (r.status() >= 400 && !NOISE.test(r.url())) bucket.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });
    page.on('console', (m) => { if (m.type() === 'error') bucket.push(`console: ${m.text().replace(/\s+/g, ' ').slice(0, 220)}`); });
    page.on('pageerror', (e) => bucket.push(`page error: ${e.message.split('\n')[0].slice(0, 220)}`));
  };
  const newCtx = () => browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'light' });

  // public pages
  if (!only || only.includes('guest')) {
    const ctx = await newCtx(); const page = await ctx.newPage(); trackNetwork(page);
    const errs = []; watch(page, errs);
    let n = 0;
    for (const p of PUBLIC_PAGES) {
      errs.length = 0;
      await page.goto(`${base}${p}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(page, { timeout: 15000 }); await rawSleep(600);
      const file = path.join(dir, `guest-${String(++n).padStart(2, '0')}${p.replace(/[^a-z0-9]+/gi, '-')}.png`);
      await shoot(page, file, true);
      const info = await inspect(page);
      report.push({ who: 'guest', page: p, url: page.url().replace(base, ''), ...info, errors: [...errs], shot: path.basename(file) });
      log(`   guest ${p} → ${info.heading} ${info.flags?.length ? '⚠ ' + info.flags.join(', ') : ''} ${errs.length ? `(${errs.length} errors)` : ''}`);
    }
    await ctx.close();
  }

  for (const id of IDENTITIES.filter((i) => i.email && (!only || only.includes(i.key)))) {
    const ctx = await newCtx(); const page = await ctx.newPage(); trackNetwork(page);
    const errs = []; watch(page, errs);
    try {
      await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
      await page.locator('input[type=email]').fill(id.email);
      await page.locator('input[type=password]').fill(password);
      await page.locator('button[type=submit]').click();
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
      await settle(page); await rawSleep(500);
    } catch (e) {
      log(`   ${id.key}: login failed — ${e.message.split('\n')[0]}`);
      report.push({ who: id.key, page: 'login', error: e.message.split('\n')[0] });
      await ctx.close(); continue;
    }
    const labels = (await page.locator('aside nav button').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    log(`   ${id.key}: ${labels.length} sidebar items — ${labels.join(' | ')}`);
    let n = 0;
    // the landing page, then every sidebar entry
    for (const label of ['(home)', ...labels]) {
      errs.length = 0;
      if (label !== '(home)') {
        try {
          const btn = page.locator('aside nav button').filter({ hasText: label }).first();
          await btn.click({ timeout: 8000 });
          await rawSleep(300);
        } catch (e) { log(`   ${id.key}: could not open "${label}" — ${e.message.split('\n')[0]}`); continue; }
      }
      await settle(page, { timeout: 15000 }); await rawSleep(700);
      const file = path.join(dir, `${id.key}-${String(++n).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`);
      await shoot(page, file, true);
      const info = await inspect(page);
      report.push({ who: id.key, page: label, url: page.url().replace(base, ''), ...info, errors: [...errs], shot: path.basename(file) });
      log(`   ${id.key} ${label} → ${page.url().replace(base, '')} · ${info.heading}${info.charts ? ` · ${info.charts} charts` : ''}${info.flags?.length ? ' ⚠ ' + info.flags.join(', ') : ''}${errs.length ? ` · ${errs.length} errors: ${errs.slice(0, 3).join(' ; ')}` : ''}`);
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, 'survey.json'), JSON.stringify(report, null, 1));
  return report;
}
