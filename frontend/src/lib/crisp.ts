declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

function queue(): unknown[] {
  window.$crisp = window.$crisp || [];
  return window.$crisp;
}

export function loadCrisp(websiteId: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  window.CRISP_WEBSITE_ID = websiteId;
  if (document.getElementById('crisp-chat-script')) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.id = 'crisp-chat-script';
    s.src = 'https://client.crisp.chat/l.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Crisp'));
    document.head.appendChild(s);
  });
}

export function setCrispUserSession(payload: {
  email: string;
  nickname: string;
  tenantName: string;
  role: string;
  plan: string;
}) {
  const $crisp = queue();
  $crisp.push(['set', 'user:email', [payload.email]]);
  $crisp.push(['set', 'user:nickname', [payload.nickname]]);
  $crisp.push([
    'set',
    'session:data',
    [
      [
        ['tenant_name', payload.tenantName],
        ['role', payload.role],
        ['plan', payload.plan],
      ],
    ],
  ]);
}

export function showCrispWidget() {
  queue().push(['do', 'chat:show']);
}

export function hideCrispWidget() {
  queue().push(['do', 'chat:hide']);
}

export function openCrispChat() {
  queue().push(['do', 'chat:open']);
}

export function crispSessionNudge(text: string) {
  queue().push(['do', 'message:show', [text]]);
}

export function getCrispSessionId(cb: (id: string | null) => void) {
  queue().push([
    'get',
    'session:identifier',
    (id: string) => {
      cb(id && typeof id === 'string' ? id : null);
    },
  ]);
}

export function crispReset() {
  queue().push(['do', 'session:reset']);
}
