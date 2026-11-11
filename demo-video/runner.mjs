#!/usr/bin/env node
// Job runner for the demo recording.
//
// While this window is open, Claude can start a probe or a recording by dropping
// a small job file into demo-video/jobs/. Only the commands listed in ALLOWED
// below can run, and only from this folder. Close the window (Ctrl+C) to stop.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const JOBS = path.join(ROOT, 'jobs');
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(JOBS, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const win = process.platform === 'win32';
const ALLOWED = {
  probe:   (a) => [process.execPath, ['record.mjs', '--probe', ...a], ROOT, false],
  record:  (a) => [process.execPath, ['record.mjs', ...a], ROOT, false],
  seed:    () => ['npm', ['run', 'db:seed:full'], path.join(ROOT, '..', 'backend'), win],
  install: () => ['npm', ['install', '--no-audit', '--no-fund'], ROOT, win],
};
const ARG_OK = /^--[a-z][a-z0-9-]*(=[A-Za-z0-9_.,:x-]+)?$/;

let child = null;
let current = null;

const stamp = () => new Date().toLocaleTimeString();
const status = (id, data) => fs.writeFileSync(path.join(JOBS, `${id}.status.json`), JSON.stringify({ id, ...data }, null, 2));

function take() {
  if (child) {
    // a stop request may arrive while something runs
    const stop = path.join(JOBS, 'stop.job.json');
    if (fs.existsSync(stop)) {
      fs.rmSync(stop, { force: true });
      console.log(`[${stamp()}] stopping ${current}`);
      child.kill();
    }
    return;
  }
  const files = fs.readdirSync(JOBS).filter((f) => f.endsWith('.job.json')).sort();
  if (!files.length) return;
  const file = path.join(JOBS, files[0]);
  let job;
  try { job = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return; }
  fs.renameSync(file, file.replace(/\.job\.json$/, '.taken.json'));
  const id = String(job.id || files[0].replace(/\.job\.json$/, '')).replace(/[^\w.-]/g, '_');
  const make = ALLOWED[job.cmd];
  const jargs = Array.isArray(job.args) ? job.args.map(String) : [];
  if (job.cmd === 'stop') return;
  if (!make || !jargs.every((a) => ARG_OK.test(a))) {
    console.log(`[${stamp()}] refused job ${id}: ${job.cmd} ${jargs.join(' ')}`);
    status(id, { state: 'refused', cmd: job.cmd, args: jargs });
    return;
  }
  const [cmd, cmdArgs, cwd, shell] = make(jargs);
  const logFile = path.join(OUT, `${id}.log`);
  const logStream = fs.createWriteStream(logFile);
  console.log(`[${stamp()}] ▶ ${id}: ${job.cmd} ${jargs.join(' ')}`);
  status(id, { state: 'running', cmd: job.cmd, args: jargs, started: new Date().toISOString(), log: path.relative(ROOT, logFile) });
  current = id;
  child = spawn(cmd, cmdArgs, { cwd, shell });
  const tee = (d) => { process.stdout.write(d); logStream.write(d); };
  child.stdout.on('data', tee);
  child.stderr.on('data', tee);
  child.on('close', (code, signal) => {
    logStream.end();
    console.log(`[${stamp()}] ■ ${id} finished (exit ${code ?? signal})`);
    status(id, { state: code === 0 ? 'done' : 'failed', code, signal, cmd: job.cmd, args: jargs, finished: new Date().toISOString(), log: path.relative(ROOT, logFile) });
    child = null;
    current = null;
  });
}

console.log('LeaseManager demo runner — waiting for jobs in', JOBS);
console.log('Leave this window open while Claude works. Press Ctrl+C to stop.\n');
fs.writeFileSync(path.join(JOBS, 'runner.alive'), new Date().toISOString());
setInterval(() => fs.writeFileSync(path.join(JOBS, 'runner.alive'), new Date().toISOString()), 5000);
setInterval(take, 1000);
