// Read-only health check used when a run fails: is the app answering, can the
// demo accounts sign in, and what do the containers say. Writes out/diag.txt.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ACCOUNTS = [
  'admin@leasemanager.com', 'manager@msheireb.test', 'reception@msheireb.test', 'manager@west-bay.test',
  'finance@msheireb.test', 'tech@msheireb.test', 'tenant.admin@acme-corp.test',
];

export async function diag({ base, api, repo, out, password, up = false, build = null }) {
  const lines = [`diag at ${new Date().toISOString()}`];
  const timed = async (name, fn) => {
    const s = Date.now();
    try { lines.push(`${name}: ${await fn()} (${Date.now() - s} ms)`); } catch (e) { lines.push(`${name}: ERROR ${e.cause?.code ?? ''} ${e.message} (${Date.now() - s} ms)`); }
  };
  await timed('web /login', async () => (await fetch(`${base}/login`, { signal: AbortSignal.timeout(15000) })).status);
  await timed('api /health', async () => {
    const r = await fetch(`${api}/health`, { signal: AbortSignal.timeout(15000) });
    return `${r.status} ${(await r.text()).slice(0, 300)}`;
  });
  await timed('web → api /health', async () => (await fetch(`${base}/health`, { signal: AbortSignal.timeout(10000) })).status);
  let token = null;
  for (const email of ACCOUNTS) {
    await timed(`login ${email}`, async () => {
      const r = await fetch(`${api}/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(20000),
      });
      const body = await r.text();
      if (email === 'manager@msheireb.test') {
        try { const j = JSON.parse(body); token = j.accessToken ?? j.data?.accessToken ?? j.access_token ?? j.data?.access_token ?? null; } catch { /* ignore */ }
      }
      return `${r.status} ${r.ok ? '' : body.slice(0, 200)}`;
    });
  }
  if (token) {
    for (const p of ['/booking-applications?status=PENDING', '/bookings/workflow/queues', '/maintenance', '/maintenance/stats']) {
      await timed(`manager GET ${p}`, async () => {
        const r = await fetch(`${api}${p}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
        const body = await r.text();
        return `${r.status} ${body.length} bytes ${r.ok ? '' : body.slice(0, 300)}`;
      });
    }
  } else lines.push('(no manager token — skipped API reads)');

  const run = (args, cmd = 'docker', timeout = 90000) => {
    const r = spawnSync(cmd, args, { cwd: repo, encoding: 'utf8', timeout, maxBuffer: 20e6, windowsHide: true });
    return `${r.stdout || ''}${r.stderr || ''}${r.error ? String(r.error) : ''}`;
  };
  lines.push('\n--- docker compose ps -a\n' + run(['compose', 'ps', '-a']));
  lines.push('\n--- containers\n' + run(['inspect', 'leasemanager-api-1', 'leasemanager-postgres-1', 'leasemanager-web-1',
    '--format', '{{.Name}} status={{.State.Status}} oom={{.State.OOMKilled}} exit={{.State.ExitCode}} started={{.State.StartedAt}} finished={{.State.FinishedAt}} restarts={{.RestartCount}}']));
  lines.push('\n--- docker info\n' + run(['info', '--format', 'mem={{.MemTotal}} cpus={{.NCPU}} server={{.ServerVersion}} os={{.OperatingSystem}}']));
  lines.push('\n--- docker stats\n' + run(['stats', '--no-stream', '--format', '{{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}}']));
  if (process.platform === 'win32') {
    lines.push('\n--- windows memory (KB)\n' + run(['-NoProfile', '-Command',
      'Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory | ConvertTo-Json -Compress'], 'powershell', 30000));
    lines.push('\n--- .wslconfig\n' + run(['-NoProfile', '-Command', 'if (Test-Path $env:USERPROFILE\\.wslconfig) { Get-Content $env:USERPROFILE\\.wslconfig } else { "none" }'], 'powershell', 30000));
  }
  lines.push('\n--- api logs (last 400)\n' + run(['compose', 'logs', 'api', '--tail', '400', '--timestamps', '--no-color']));
  lines.push('\n--- postgres logs (last 80)\n' + run(['compose', 'logs', 'postgres', '--tail', '80', '--timestamps', '--no-color']));
  lines.push('\n--- web logs (last 80)\n' + run(['compose', 'logs', 'web', '--tail', '80', '--timestamps', '--no-color']));
  if (up) {
    // --build=api,web rebuilds those images from the current source first
    const svc = build && build !== true ? String(build).split(',').filter((s) => /^[a-z0-9_-]+$/.test(s)) : [];
    const upArgs = ['compose', 'up', '-d', ...(svc.length ? ['--build', ...svc] : [])];
    const t = Date.now();
    lines.push(`\n--- docker ${upArgs.join(' ')}\n` + run(upArgs, 'docker', 1500000));
    lines.push(`(took ${Math.round((Date.now() - t) / 1000)} s)`);
    const start = Date.now();
    let ok = false;
    while (Date.now() - start < 240000) {
      try { const r = await fetch(`${api}/health`, { signal: AbortSignal.timeout(5000) }); if (r.ok) { ok = true; break; } } catch { /* not yet */ }
      await new Promise((r) => setTimeout(r, 3000));
    }
    lines.push(`api healthy after up: ${ok} (${Math.round((Date.now() - start) / 1000)} s)`);
    // nginx resolves the api container once at start-up: if the api came back on a
    // new address, the web container must be restarted to find it again
    const viaWeb = async () => { try { return (await fetch(`${base}/health`, { signal: AbortSignal.timeout(8000) })).status; } catch (e) { return `ERR ${e.cause?.code ?? e.message}`; } };
    let w = await viaWeb();
    lines.push(`web → api /health: ${w}`);
    if (w !== 200) {
      lines.push('\n--- docker compose restart web\n' + run(['compose', 'restart', 'web'], 'docker', 120000));
      for (let i = 0; i < 20 && w !== 200; i++) { await new Promise((r) => setTimeout(r, 3000)); w = await viaWeb(); }
      lines.push(`web → api /health after restart: ${w}`);
    }
    lines.push('\n--- docker compose ps -a (after)\n' + run(['compose', 'ps', '-a']));
  }
  const file = path.join(out, 'diag.txt');
  fs.writeFileSync(file, lines.join('\n'));
  return file;
}
