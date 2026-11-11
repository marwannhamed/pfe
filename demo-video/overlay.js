// In-page layer for the demo recording: fake cursor, click ripple, captions,
// chapter cards, spotlight, dip-to-white transitions and a "camera" (zoom).
// Injected by record.mjs into every page before the app's own scripts run.
// It lives outside <body>, so the camera transform on <body> never moves it.
(() => {
  if (window.top !== window) return;
  if (window.__demo) return;

  const CSS = `
  #__demo_root{position:fixed;inset:0;pointer-events:none;z-index:2147483647;
    font-family:"Segoe UI",Inter,system-ui,-apple-system,Roboto,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;}
  #__demo_root *{box-sizing:border-box;}
  #__demo_spot{position:fixed;left:0;top:0;width:0;height:0;border-radius:12px;opacity:0;
    transition:opacity .35s ease,left .45s cubic-bezier(.4,0,.2,1),top .45s cubic-bezier(.4,0,.2,1),
      width .45s cubic-bezier(.4,0,.2,1),height .45s cubic-bezier(.4,0,.2,1);
    box-shadow:0 0 0 3px #2563eb,0 0 0 9px rgba(37,99,235,.20),0 0 0 9999px rgba(15,23,42,.30);}
  #__demo_spot.show{opacity:1}
  #__demo_spot.nodim{box-shadow:0 0 0 3px #2563eb,0 0 0 9px rgba(37,99,235,.20);}
  #__demo_caption{position:fixed;left:50%;bottom:24px;transform:translate(-50%,14px);
    max-width:min(1040px,82vw);display:flex;align-items:center;gap:12px;
    padding:11px 20px 11px 11px;border-radius:14px;background:rgba(15,23,42,.92);color:#fff;
    font-size:17px;line-height:1.42;font-weight:500;letter-spacing:.005em;
    box-shadow:0 14px 36px rgba(2,6,23,.38);opacity:0;
    transition:opacity .32s ease,transform .32s ease;}
  #__demo_caption.show{opacity:1;transform:translate(-50%,0)}
  #__demo_caption.top{top:66px;bottom:auto;transform:translate(-50%,-14px)}
  #__demo_caption.top.show{transform:translate(-50%,0)}
  #__demo_caption .chip{flex-shrink:0;font-size:11.5px;font-weight:800;letter-spacing:.08em;
    text-transform:uppercase;padding:6px 10px;border-radius:9px;background:#2563eb;color:#fff;white-space:nowrap}
  #__demo_caption .chip:empty{display:none}
  #__demo_caption .txt b{color:#93c5fd;font-weight:700}
  #__demo_card{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
    opacity:0;transition:opacity .45s ease;color:#fff;
    background:radial-gradient(1200px 700px at 18% 12%,#1e3a8a 0%,rgba(30,58,138,0) 60%),
      radial-gradient(900px 600px at 90% 95%,#1d4ed8 0%,rgba(29,78,216,0) 55%),#0b1224;}
  #__demo_card.show{opacity:1}
  #__demo_card.instant{transition:none}
  #__demo_card .brand{position:absolute;left:56px;top:44px;display:flex;align-items:center;gap:12px}
  #__demo_card .logo{width:40px;height:40px;border-radius:10px;background:#2563eb;display:flex;
    align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(37,99,235,.45)}
  #__demo_card .bname{font-weight:800;font-size:18px;line-height:1.1}
  #__demo_card .btag{font-size:11.5px;color:#93c5fd}
  #__demo_card .inner{max-width:980px;padding:0 64px;transform:translateY(8px);transition:transform .6s ease,opacity .25s ease}
  #__demo_card.show .inner{transform:none}
  #__demo_card .kicker{display:inline-flex;align-items:center;gap:10px;font-size:14px;font-weight:800;
    letter-spacing:.14em;text-transform:uppercase;color:#93c5fd;margin-bottom:18px}
  #__demo_card .kicker .num{background:rgba(147,197,253,.16);border:1px solid rgba(147,197,253,.35);
    color:#dbeafe;border-radius:8px;padding:3px 9px;letter-spacing:.06em}
  #__demo_card .title{font-size:58px;font-weight:800;line-height:1.06;letter-spacing:-.02em;margin-bottom:14px}
  #__demo_card .sub{font-size:22px;color:#cbd5e1;font-weight:500;margin-bottom:22px}
  #__demo_card .bar{width:72px;height:4px;border-radius:4px;background:linear-gradient(90deg,#3b82f6,#93c5fd);margin-bottom:22px}
  #__demo_card .note{font-size:19px;color:#94a3b8;line-height:1.5;max-width:820px}
  #__demo_card .acct{margin-top:26px;display:inline-flex;gap:10px;align-items:center;font-size:15px;color:#cbd5e1;
    background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:8px 14px;border-radius:10px;
    font-family:ui-monospace,Consolas,monospace}
  #__demo_card .acct:empty{display:none}
  #__demo_card .points{margin-top:26px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 28px;max-width:860px}
  #__demo_card .points:empty{display:none}
  #__demo_card .points div{font-size:18px;color:#e2e8f0;display:flex;gap:10px;align-items:flex-start}
  #__demo_card .points div:before{content:"";flex-shrink:0;width:8px;height:8px;margin-top:9px;border-radius:50%;background:#60a5fa}
  #__demo_card .foot{position:absolute;left:56px;right:56px;bottom:40px;display:flex;justify-content:space-between;
    font-size:13px;color:#64748b;letter-spacing:.04em}
  #__demo_dip{position:fixed;inset:0;background:#f8fafc;opacity:0;transition:opacity .22s ease}
  #__demo_dip.show{opacity:1}
  #__demo_dip.instant{transition:none}
  #__demo_ripple{position:fixed;left:0;top:0;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
    border:3px solid rgba(37,99,235,.9);background:rgba(37,99,235,.18);opacity:0;transform:scale(.3)}
  #__demo_ripple.go{animation:__demoRipple .6s ease-out forwards}
  @keyframes __demoRipple{0%{opacity:.95;transform:scale(.3)}100%{opacity:0;transform:scale(1.55)}}
  #__demo_cursor{position:fixed;left:0;top:0;width:30px;height:30px;transform:translate(-200px,-200px);
    will-change:transform;transition:opacity .25s ease;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
  #__demo_cursor svg{transition:transform .08s ease;transform-origin:5px 3px}
  #__demo_cursor.down svg{transform:scale(.86)}
  #__demo_cursor.hidden{opacity:0}
  #__demo_poke{position:fixed;right:0;bottom:0;width:2px;height:2px;background:#000;opacity:.001}
  `;

  const CURSOR = `<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 3 L5 23.5 L10.4 18.6 L14.2 26.6 L18 25 L14.3 17.1 L21.4 17.1 Z"
      fill="#0f172a" stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round"/></svg>`;

  const LOGO = `<svg width="20" height="20" viewBox="0 0 1024 1024" fill="#fff" xmlns="http://www.w3.org/2000/svg">
    <path d="M946.5 505L560.1 118.8l-25.9-25.9a31.5 31.5 0 0 0-44.4 0L77.5 505a63.9 63.9 0 0 0-18.8 46c.4 35.2 29.7 63.3 64.9 63.3h42.5V940h691.8V614.3h43.4c17.1 0 33.2-6.7 45.3-18.8a63.6 63.6 0 0 0 18.7-45.3c0-17-6.7-33.1-18.8-45.2zM568 868H456V664h112v204zm217.9-325.7V868H632V640c0-22.1-17.9-40-40-40H432c-22.1 0-40 17.9-40 40v228H238.1V542.3h-96l370-369.7 23.1 23.1L882 542.3h-96.1z"/></svg>`;

  let root, cursorEl, rippleEl, captionEl, cardEl, dipEl, spotEl, pokeEl;
  let pos = { x: -200, y: -200 };
  try {
    const saved = JSON.parse(sessionStorage.getItem('__demo_cursor') || 'null');
    if (saved && typeof saved.x === 'number') pos = saved;
  } catch { /* ignore */ }

  function mount() {
    if (document.getElementById('__demo_root')) return;
    root = document.createElement('div');
    root.id = '__demo_root';
    root.innerHTML = `<style>${CSS}</style>
      <div id="__demo_spot"></div>
      <div id="__demo_caption"><span class="chip"></span><span class="txt"></span></div>
      <div id="__demo_card"><div class="brand"><div class="logo">${LOGO}</div>
        <div><div class="bname">LeaseManager</div><div class="btag">Office lease &amp; workspace management</div></div></div>
        <div class="inner"><div class="kicker"></div><div class="title"></div><div class="sub"></div>
        <div class="bar"></div><div class="note"></div><div class="acct"></div><div class="points"></div></div>
        <div class="foot"><span class="fl"></span><span class="fr"></span></div></div>
      <div id="__demo_dip"></div>
      <div id="__demo_ripple"></div>
      <div id="__demo_cursor">${CURSOR}</div>
      <div id="__demo_poke"></div>`;
    document.documentElement.appendChild(root);
    cursorEl = root.querySelector('#__demo_cursor');
    rippleEl = root.querySelector('#__demo_ripple');
    captionEl = root.querySelector('#__demo_caption');
    cardEl = root.querySelector('#__demo_card');
    dipEl = root.querySelector('#__demo_dip');
    spotEl = root.querySelector('#__demo_spot');
    pokeEl = root.querySelector('#__demo_poke');
    placeCursor(pos.x, pos.y);
  }

  function ensure() {
    if (!document.getElementById('__demo_root')) mount();
  }

  function placeCursor(x, y) {
    pos = { x, y };
    if (cursorEl) cursorEl.style.transform = `translate(${x - 5}px, ${y - 3}px)`;
  }

  // Mount as early as possible, and again if anything ever removes us.
  if (document.documentElement) mount();
  document.addEventListener('DOMContentLoaded', ensure);
  setInterval(ensure, 500);

  window.addEventListener('mousemove', (e) => {
    ensure();
    placeCursor(e.clientX, e.clientY);
  }, { capture: true, passive: true });
  window.addEventListener('mousedown', (e) => {
    ensure();
    cursorEl.classList.add('down');
    rippleEl.style.left = `${e.clientX}px`;
    rippleEl.style.top = `${e.clientY}px`;
    rippleEl.classList.remove('go');
    void rippleEl.offsetWidth;
    rippleEl.classList.add('go');
  }, true);
  window.addEventListener('mouseup', () => { if (cursorEl) cursorEl.classList.remove('down'); }, true);
  window.addEventListener('beforeunload', () => {
    try { sessionStorage.setItem('__demo_cursor', JSON.stringify(pos)); } catch { /* ignore */ }
  });

  let captionTimer = null;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  // **bold** in a caption becomes a highlighted span
  const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  window.__demo = {
    ready: () => { ensure(); return true; },
    cursorPos: () => pos,
    setCursor: (x, y) => { ensure(); placeCursor(x, y); },
    cursorVisible: (v) => { ensure(); cursorEl.classList.toggle('hidden', !v); },

    caption: (text, chip, color, pos) => {
      ensure();
      const txt = captionEl.querySelector('.txt');
      const chipEl = captionEl.querySelector('.chip');
      clearTimeout(captionTimer);
      if (!text) { captionEl.classList.remove('show'); return; }
      const apply = () => {
        txt.innerHTML = fmt(text);
        chipEl.textContent = chip || '';
        chipEl.style.background = color || '#2563eb';
        captionEl.classList.toggle('top', pos === 'top');
        captionEl.classList.add('show');
      };
      if (captionEl.classList.contains('show')) {
        captionEl.classList.remove('show');
        captionTimer = setTimeout(apply, 260);
      } else apply();
    },

    card: (o, instant) => {
      ensure();
      const inner = cardEl.querySelector('.inner');
      if (cardEl.classList.contains('show') && !instant) {
        // already on screen: cross-fade the text only
        inner.style.opacity = '0';
        setTimeout(() => { window.__demo.card(o, true); inner.style.opacity = '1'; }, 260);
        return;
      }
      const q = (s) => cardEl.querySelector(s);
      q('.kicker').innerHTML = o.num ? `<span class="num">${esc(o.num)}</span>${esc(o.kicker || '')}` : esc(o.kicker || '');
      q('.title').textContent = o.title || '';
      q('.sub').textContent = o.sub || '';
      q('.sub').style.display = o.sub ? '' : 'none';
      q('.note').textContent = o.note || '';
      q('.acct').textContent = o.acct || '';
      q('.points').innerHTML = (o.points || []).map((p) => `<div>${esc(p)}</div>`).join('');
      q('.fl').textContent = o.footLeft || '';
      q('.fr').textContent = o.footRight || '';
      cardEl.classList.toggle('instant', !!instant);
      cardEl.classList.add('show');
      if (instant) { void cardEl.offsetWidth; cardEl.classList.remove('instant'); }
    },
    hideCard: () => { ensure(); cardEl.classList.remove('instant'); cardEl.classList.remove('show'); },

    dip: (on, instant) => {
      ensure();
      dipEl.classList.toggle('instant', !!instant);
      dipEl.classList.toggle('show', !!on);
      if (instant) { void dipEl.offsetWidth; dipEl.classList.remove('instant'); }
    },

    spot: (r, opts) => {
      ensure();
      if (!r) { spotEl.classList.remove('show'); return; }
      const pad = (opts && opts.pad != null) ? opts.pad : 8;
      // a spotlight that is not on screen fades in where it belongs, rather
      // than gliding over from wherever the previous one was
      const fresh = !spotEl.classList.contains('show');
      if (fresh) spotEl.style.transition = 'opacity .35s ease';
      spotEl.classList.toggle('nodim', !!(opts && opts.nodim));
      spotEl.style.left = `${r.x - pad}px`;
      spotEl.style.top = `${r.y - pad}px`;
      spotEl.style.width = `${r.width + pad * 2}px`;
      spotEl.style.height = `${r.height + pad * 2}px`;
      spotEl.style.borderRadius = `${(opts && opts.radius) || 12}px`;
      if (fresh) { void spotEl.offsetWidth; spotEl.style.transition = ''; }
      spotEl.classList.add('show');
    },

    // Camera: zoom/pan the page (not the overlay) like an editor would in post.
    camera: (tx, ty, s, ms) => {
      const b = document.body;
      if (!b) return;
      document.documentElement.style.overflow = 'hidden';
      b.style.transformOrigin = '0 0';
      b.style.transition = ms ? `transform ${ms}ms cubic-bezier(.45,0,.2,1)` : 'none';
      b.style.transform = (s === 1 && tx === 0 && ty === 0) ? '' : `translate(${tx}px, ${ty}px) scale(${s})`;
    },

    // Forces a repaint so the screencast emits a fresh frame.
    poke: () => { ensure(); pokeEl.style.opacity = pokeEl.style.opacity === '0.002' ? '0.001' : '0.002'; },
  };
})();
