#!/usr/bin/env node
// LeaseManager demo recorder.
//
//   npm run record            reseed the data, record all ten chapters, write out/LeaseManager-demo.mp4
//   npm run probe             quick dry run: no recording, no data changes, screenshots in out/probe
//
// Options:  --only=3,4  --no-seed  --headed  --viewport=1280x720  --keep-raw  --name=MyVideo
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S, Recorder, log, trackNetwork, rawSleep } from './lib.mjs';
import { CHAPTERS, Director, PASSWORD } from './scenes.mjs';
import { diag } from './diag.mjs';
import { survey } from './survey.mjs';
import { apiCheck, textReport } from './apicheck.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ROOT, '..');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const DIAG = !!args.diag;
const SURVEY = !!args.survey && !DIAG;          // read-only tour of every page, for planning
const APICHECK = !!args.apicheck && !DIAG && !SURVEY; // read-only API check, report only
const TOOL = DIAG || SURVEY || APICHECK;
const PROBE = !!args.probe && !TOOL;
const BASE = process.env.DEMO_BASE_URL || args.base || 'http://localhost:5173';
const API = process.env.DEMO_API_URL || args.api || 'http://localhost:6001';
const [VW, VH] = String(args.viewport || '1280x720').split('x').map(Number);
const DPR = 1920 / VW;
const NAME = String(args.name || 'LeaseManager-demo');
const only = args.only ? String(args.only).split(',').map(Number) : null;

const OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });
S.outDir = OUT;
S.shotDir = path.join(OUT, PROBE ? 'probe' : 'shots');
if (!TOOL) {
  fs.rmSync(S.shotDir, { recursive: true, force: true });
  fs.mkdirSync(S.shotDir, { recursive: true });
}
S.logFile = path.join(OUT, DIAG ? 'diag.log' : SURVEY ? 'survey.log' : APICHECK ? 'apicheck.log' : PROBE ? 'probe.log' : 'record.log');
fs.writeFileSync(S.logFile, '');
// recordings run at 1.35× the natural pace: short holds, quick cursor
S.speed = PROBE ? Number(args.speed || 3) : Number(args.speed || 1.35);
S.dry = PROBE || !!args.dry;
S.shots = PROBE || !!args.shots;

function ffmpegPath() {
  try {
    const p = spawnSync(process.execPath, ['-e', 'process.stdout.write(require("ffmpeg-static")||"")'], { cwd: ROOT, encoding: 'utf8' }).stdout;
    if (p && fs.existsSync(p)) return p;
  } catch { /* fall through */ }
  return 'ffmpeg';
}

async function launch() {
  const opts = { headless: !args.headed, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-features=Translate', `--force-device-scale-factor=${DPR}`] };
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      const b = await chromium.launch(channel ? { ...opts, channel } : opts);
      log(`browser: ${channel ?? 'bundled chromium'} ${b.version()}`);
      return b;
    } catch (e) { log(`browser ${channel ?? 'bundled'} unavailable: ${e.message.split('\n')[0]}`); }
  }
  throw new Error('No Chrome or Edge found. Install Google Chrome, then run again.');
}

function seed() {
  return new Promise((resolve, reject) => {
    log('reseeding demo data (npm run db:seed:full)…');
    const child = spawn('npm', ['run', 'db:seed:full'], { cwd: path.join(REPO, 'backend'), shell: process.platform === 'win32' });
    child.stdout.on('data', (d) => fs.appendFileSync(S.logFile, String(d)));
    child.stderr.on('data', (d) => fs.appendFileSync(S.logFile, String(d)));
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`seed failed with exit code ${code} — see ${S.logFile}`))));
  });
}

async function preflight() {
  for (const [what, url] of [['web app', `${BASE}/login`], ['API', `${API}/health`]]) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      throw new Error(`The ${what} is not reachable at ${url} (${e.message}). Start Docker Desktop and the containers first.`);
    }
  }
}

async function finalEncode(raw, out, ff) {
  log('final encode (smaller file, same quality)…');
  const r = spawnSync(ff, ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', 
    '-movflags', '+faststart', out], { stdio: 'inherit' });
  return r.status === 0;
}

async function main() {
  if (DIAG) {
    log('diagnostics…');
    const f = await diag({ base: BASE, api: API, repo: REPO, out: OUT, password: PASSWORD, up: !!args.up, build: args.build ?? null });
    log(`written ${f}`);
    return;
  }
  if (APICHECK) {
    await preflight();
    const rep = await apiCheck({ api: API, password: PASSWORD, out: OUT, log });
    const txt = textReport(rep);
    fs.writeFileSync(path.join(OUT, 'apicheck.txt'), txt);
    log(txt.split('\n')[0]);
    return;
  }
  if (SURVEY) {
    await preflight();
    const b = await launch();
    const only = args['survey-only'] ? String(args['survey-only']).split(',') : null;
    const rep = await survey({ browser: b, base: BASE, out: OUT, password: PASSWORD, only });
    await b.close();
    log(`survey: ${rep.length} pages · ${rep.filter((r) => r.flags?.length).length} with suspicious text · ${rep.filter((r) => r.errors?.length).length} with failed requests`);
    return;
  }
  log(`mode: ${PROBE ? 'PROBE (dry run, screenshots)' : 'RECORD'} · viewport ${VW}x${VH} @${DPR.toFixed(3)} · ${BASE}`);
  await preflight();
  if (!PROBE && !args['no-seed']) await seed();

  const browser = await launch();
  const ver = browser.version();
  const UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`;
  const overlay = fs.readFileSync(path.join(ROOT, 'overlay.js'), 'utf8');

  const newPage = async (role) => {
    const ctx = await browser.newContext({
      viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, userAgent: UA,
      locale: 'en-US', colorScheme: 'light', reducedMotion: 'no-preference',
    });
    await ctx.addInitScript({ content: overlay });
    const page = await ctx.newPage();
    trackNetwork(page);
    page.on('pageerror', (e) => log(`[page error · ${role}]`, e.message.split('\n')[0]));
    page.on('console', (m) => { if (m.type() === 'error') log(`[console · ${role}]`, m.text().replace(/\s+/g, ' ').slice(0, 400)); });
    page.on('response', (r) => {
      const s = r.status();
      if (s >= 500 || (s >= 400 && s !== 401 && !/favicon|hot-update|socket\.io|unsplash|openstreetmap/.test(r.url()))) {
        log(`[http ${s} · ${role}]`, r.request().method(), r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 160));
      }
    });
    page.on('requestfailed', (r) => {
      const u = r.url();
      if (/openstreetmap|unsplash|crisp|google|gstatic|socket\.io/.test(u)) return;
      log(`[request failed · ${role}]`, r.method(), u.slice(0, 160), r.failure()?.errorText ?? '');
    });
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    return page;
  };

  const ff = ffmpegPath();
  const raw = path.join(OUT, `${NAME}.raw.mp4`);
  const final = path.join(OUT, `${NAME}.mp4`);
  if (!PROBE) {
    log(`encoder: ${ff}`);
    S.rec = new Recorder({ file: raw, ffmpeg: ff, enabled: true });
  }

  const D = new Director({ browser, newPage, base: BASE, api: API });
  const list = CHAPTERS.filter((c) => !only || only.includes(c.n));
  D.first = !only || only.includes(1);
  for (const ch of list) {
    log(`── chapter ${ch.n}: ${ch.name}`);
    try { await ch.run(D); } catch (e) {
      log(`chapter ${ch.n} aborted: ${e.message.split('\n')[0]}`);
      S.report.errors.push(`chapter ${ch.n}: ${e.message.split('\n')[0]}`);
    }
  }
  if (!only || only.includes(CHAPTERS[CHAPTERS.length - 1].n)) await D.outro();

  if (S.rec) {
    const seconds = S.rec.seconds();
    log(`recorded ${Math.floor(seconds / 60)}m${Math.round(seconds % 60)}s · ${S.rec.frames} screen frames · capture size ${S.rec.size}`);
    const code = await S.rec.finish();
    log(`raw video written (ffmpeg exit ${code}): ${raw}`);
    S.report.video = { raw, seconds, frames: S.rec.frames, size: S.rec.size };
  }
  await browser.close();

  if (S.rec && fs.existsSync(raw)) {
    if (await finalEncode(raw, final, ff)) {
      if (!args['keep-raw']) fs.rmSync(raw, { force: true });
      log(`DONE → ${final}`);
      S.report.video.final = final;
    } else log(`final encode failed — the raw video is still at ${raw}`);
  }

  fs.writeFileSync(path.join(OUT, PROBE ? 'probe-report.json' : 'record-report.json'), JSON.stringify(S.report, null, 2));
  log(`errors: ${S.report.errors.length} · warnings: ${S.report.warnings.length}`);
  for (const e of S.report.errors) log('  ✗', e);
  for (const w of S.report.warnings) log('  !', w);
  const issues = S.report.checkpoints.filter((c) => c.offCameraIssue);
  for (const c of issues) log('  ⚠ off-camera item visible at', c.name, '—', c.offCameraIssue);
}

main().then(() => process.exit(0)).catch(async (e) => {
  log('FATAL:', e.message);
  try { fs.writeFileSync(path.join(OUT, PROBE ? 'probe-report.json' : 'record-report.json'), JSON.stringify({ fatal: e.message, ...S.report }, null, 2)); } catch { /* ignore */ }
  await rawSleep(100);
  process.exit(1);
});
