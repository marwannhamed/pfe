// The on-screen "live API check": a full-page table that fills in as the real
// requests come back (calls are made by the recorder, results pushed in here).
// Served at <app>/__demo/api-check through page.route, so it is a normal page
// and the overlay (cursor, captions) works as everywhere else.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function apiCheckHtml({ identities, endpoints, apiUrl, swagger }) {
  const head = identities.map((i) => `<th title="${esc(i.label)}">${esc(i.short)}</th>`).join('');
  const rows = endpoints.map((e, n) => `<tr id="r${n}"><td class="ep"><span class="grp">${esc(e.group)}</span><span class="path">GET ${esc(e.path.replace(/\{own\.(\w+)\}/g, '{$1}').replace(/\?.*$/, ''))}</span></td>${identities.map(() => '<td class="c"><i></i></td>').join('')}</tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Live API check · LeaseManager</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#f1f5f9;color:#0f172a;font-family:"Segoe UI",Inter,system-ui,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{position:absolute;inset:0;display:flex;flex-direction:column;padding:18px 26px 92px}
.top{display:flex;align-items:center;justify-content:space-between;gap:20px}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:38px;height:38px;border-radius:10px;background:#2563eb;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;box-shadow:0 6px 16px rgba(37,99,235,.35)}
h1{margin:0;font-size:22px;letter-spacing:-.01em}
.sub{font-size:13px;color:#64748b;margin-top:2px}
.sub code{font-family:ui-monospace,Consolas,monospace;background:#e2e8f0;border-radius:5px;padding:1px 6px;color:#334155}
.stats{display:flex;gap:10px}
.stat{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px 14px;min-width:108px}
.stat b{display:block;font-size:22px;line-height:1.1;font-variant-numeric:tabular-nums}
.stat span{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-weight:700}
.stat.ok b{color:#15803d}.stat.no b{color:#4338ca}.stat.err b{color:#b91c1c}
.legend{display:flex;gap:16px;align-items:center;font-size:12px;color:#475569;margin:12px 2px 8px}
.legend i{display:inline-block;width:26px;height:14px;border-radius:4px;margin-right:6px;vertical-align:-2px}
.box{flex:1;min-height:0;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.scroll{flex:1;overflow:auto;scrollbar-width:none}
.scroll::-webkit-scrollbar{display:none}
table{border-collapse:separate;border-spacing:0;width:100%;font-size:12.5px}
th{position:sticky;top:0;background:#f8fafc;z-index:2;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#475569;font-weight:800;padding:9px 4px;border-bottom:1px solid #e2e8f0;text-align:center;white-space:nowrap}
th:first-child{text-align:left;padding-left:16px;width:390px}
td{padding:3px 4px;border-bottom:1px solid #f1f5f9;height:27px}
td.ep{padding-left:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:390px}
.grp{display:inline-block;min-width:92px;font-size:10.5px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}
.path{font-family:ui-monospace,Consolas,monospace;font-size:12px;color:#1e293b}
td.c{text-align:center}
td.c i{display:inline-block;width:46px;height:19px;line-height:19px;border-radius:6px;font-style:normal;font-weight:800;font-size:11.5px;font-variant-numeric:tabular-nums;background:#f8fafc;color:transparent}
td.c i.ok{background:#dcfce7;color:#15803d}
td.c i.auth{background:#f1f5f9;color:#64748b}
td.c i.denied{background:#e0e7ff;color:#4338ca}
td.c i.client{background:#fef3c7;color:#b45309}
td.c i.error{background:#fee2e2;color:#b91c1c}
td.c i.skip{background:#f8fafc;color:#cbd5e1}
td.c i.pop{animation:pop .28s ease-out}
@keyframes pop{0%{transform:scale(.55);opacity:.2}100%{transform:scale(1);opacity:1}}
tr.cur td{background:#eff6ff}
.done{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.96);opacity:0;transition:all .35s ease;background:#0f172a;color:#fff;border-radius:18px;padding:22px 30px;box-shadow:0 30px 80px rgba(2,6,23,.45);min-width:560px;text-align:center}
.done.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.done .big{font-size:40px;font-weight:800;letter-spacing:-.02em}
.done .row{display:flex;justify-content:center;gap:26px;margin-top:12px;font-size:15px;color:#cbd5e1}
.done .row b{display:block;font-size:26px;color:#fff}
.done .row .g b{color:#4ade80}.done .row .s b{color:#a5b4fc}.done .row .r b{color:#f87171}
</style></head><body>
<div class="wrap">
  <div class="top">
    <div class="brand"><div class="logo">LM</div><div>
      <h1>Live API check</h1>
      <div class="sub">${endpoints.length} read endpoints × ${identities.length} identities — real requests to <code>${esc(apiUrl)}</code>${swagger?.operations ? ` · ${swagger.operations} operations documented in Swagger` : ''}</div>
    </div></div>
    <div class="stats">
      <div class="stat"><b id="n-calls">0</b><span>Requests</span></div>
      <div class="stat ok"><b id="n-ok">0</b><span>Allowed</span></div>
      <div class="stat no"><b id="n-no">0</b><span>Refused</span></div>
      <div class="stat err"><b id="n-err">0</b><span>Errors</span></div>
    </div>
  </div>
  <div class="legend">
    <span><i style="background:#dcfce7"></i>2xx allowed</span>
    <span><i style="background:#f1f5f9"></i>401 no token</span>
    <span><i style="background:#e0e7ff"></i>403 / 404 refused by role or company</span>
    <span><i style="background:#fee2e2"></i>5xx server error</span>
  </div>
  <div class="box"><div class="scroll" id="scroll"><table><thead><tr><th>Endpoint</th>${head}</tr></thead><tbody>${rows}</tbody></table></div></div>
</div>
<div class="done" id="done"></div>
<script>
const KEYS = ${JSON.stringify(identities.map((i) => i.key))};
const n = { calls: 0, ok: 0, no: 0, err: 0 };
function verdict(s){ return s == null ? 'skip' : s >= 200 && s < 300 ? 'ok' : s === 401 ? 'auth' : (s === 403 || s === 404) ? 'denied' : (s >= 500 || s === 0) ? 'error' : 'client'; }
window.__api = {
  fill(i, results) {
    const tr = document.getElementById('r' + i); if (!tr) return;
    document.querySelectorAll('tr.cur').forEach((t) => t.classList.remove('cur'));
    tr.classList.add('cur');
    const cells = tr.querySelectorAll('td.c i');
    KEYS.forEach((k, j) => {
      const r = results[k] || {}; const v = verdict(r.status);
      cells[j].textContent = r.status == null ? '—' : (r.status === 0 ? 'ERR' : r.status);
      cells[j].className = v + ' pop';
      if (v !== 'skip') n.calls++;
      if (v === 'ok') n.ok++; else if (v === 'auth' || v === 'denied') n.no++; else if (v === 'error' || v === 'client') n.err++;
    });
    for (const k of Object.keys(n)) document.getElementById('n-' + k).textContent = n[k].toLocaleString('en-US');
    const sc = document.getElementById('scroll');
    const want = tr.offsetTop - sc.clientHeight + tr.offsetHeight * 3;
    if (want > sc.scrollTop) sc.scrollTo({ top: want, behavior: 'smooth' });
  },
  clearCur() { document.querySelectorAll('tr.cur').forEach((t) => t.classList.remove('cur')); },
  show(i, block) { const tr = document.getElementById('r' + i); const sc = document.getElementById('scroll'); sc.scrollTo({ top: Math.max(0, tr.offsetTop - (block === 'center' ? sc.clientHeight / 2 : 60)), behavior: 'smooth' }); },
  rowRect(i) { const r = document.getElementById('r' + i).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; },
  done(html) { const d = document.getElementById('done'); d.innerHTML = html; d.classList.add('show'); },
  hideDone() { document.getElementById('done').classList.remove('show'); },
  counts() { return { ...n }; },
};
</script></body></html>`;
}
