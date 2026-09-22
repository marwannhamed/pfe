import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommentOutlined, CloseOutlined, SendOutlined } from '@ant-design/icons';
import { spaceFinderApi } from '../api/services';
import type { SpaceFinderResult, SpaceMatch } from '../types';
import { errorMessage } from '../utils/errors';

type Msg = { role: 'user' | 'assistant'; content: string; matches?: SpaceMatch[] };

const OPENER =
  'Tell me what you need — how many people, roughly what budget, any part of town — and I will show you what is free right now.';

const EXAMPLES = [
  'A desk for one, as cheap as possible',
  'Office for 12 people, around 7000 a month',
  'A room for a 50-person workshop',
];

const TYPE_LABEL: Record<string, string> = {
  DEDICATED_OFFICE: 'Private office',
  FLEXIBLE_DESK: 'Flexible desks',
  HOT_DESK: 'Hot desk',
  MEETING_ROOM: 'Meeting room',
  CONFERENCE_ROOM: 'Conference room',
  PHONE_BOOTH: 'Phone booth',
  EVENT_SPACE: 'Event space',
};

/**
 * Guest-facing assistant on the public pages. No account needed, so it only
 * ever shows what the public map already shows — the listings come back from
 * the server with the reply, and are rendered from that data rather than from
 * anything the model wrote.
 */
export default function SpaceFinderChat() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: OPENER },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      // Only the conversation goes up; the opener is ours, not the visitor's.
      const res = await spaceFinderApi.find(
        next
          .filter((m, i) => !(i === 0 && m.role === 'assistant'))
          .map((m) => ({ role: m.role, content: m.content })),
      );
      const data = res.data as SpaceFinderResult;
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: data?.reply ?? 'Let me look again — tell me a bit more.',
          matches: data?.matches ?? [],
        },
      ]);
    } catch (e) {
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: errorMessage(e, 'I could not search just now. Please try again.'),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Find a space"
        style={{
          position: 'fixed', right: 22, bottom: 22, zIndex: 1200,
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '13px 20px', borderRadius: 999, border: 'none',
          background: '#0f172a', color: '#fff', cursor: 'pointer',
          fontSize: 14, fontWeight: 600,
          boxShadow: '0 10px 30px -8px rgba(15,23,42,.5)',
        }}
      >
        <CommentOutlined /> Find a space
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', right: 22, bottom: 22, zIndex: 1200,
        width: 'min(410px, calc(100vw - 32px))',
        height: 'min(590px, calc(100vh - 44px))',
        display: 'flex', flexDirection: 'column',
        background: '#fff', borderRadius: 16,
        border: '1px solid #e2e8f0',
        boxShadow: '0 24px 64px -12px rgba(15,23,42,.35)',
        overflow: 'hidden',
      }}
    >
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#0f172a', color: '#fff',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Find a space</div>
          <div style={{ fontSize: 11.5, opacity: .75 }}>Available listings, updated live</div>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 15 }}
        >
          <CloseOutlined />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'grid', gap: 12, background: '#f8fafc' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'grid', gap: 8, justifyItems: m.role === 'user' ? 'end' : 'start' }}>
            <div style={{
              maxWidth: '88%', padding: '9px 13px', borderRadius: 13, fontSize: 13.5, lineHeight: 1.5,
              background: m.role === 'user' ? '#2563eb' : '#fff',
              color: m.role === 'user' ? '#fff' : '#0f172a',
              border: m.role === 'user' ? 'none' : '1px solid #e2e8f0',
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>

            {/* Rendered from the server's listings, never parsed out of the reply. */}
            {m.matches?.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/spaces/${s.id}`)}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderLeft: '3px solid #2563eb', borderRadius: 10, padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap' }}>
                    {s.monthly_rate?.toLocaleString()} {s.currency}<span style={{ fontWeight: 400, color: '#64748b' }}>/mo</span>
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                  {TYPE_LABEL[s.type] ?? s.type} · seats {s.capacity ?? '?'} · {s.area_sqm ?? '?'} sqm
                </div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                  {[s.building, s.city].filter(Boolean).join(' · ')}
                </div>
              </button>
            ))}
          </div>
        ))}

        {messages.length === 1 && (
          <div style={{ display: 'grid', gap: 6, marginTop: 2 }}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => send(ex)}
                style={{
                  textAlign: 'left', fontSize: 12.5, padding: '8px 11px', cursor: 'pointer',
                  background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 9, color: '#475569',
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div style={{ fontSize: 12.5, color: '#64748b' }}>Looking through what is available…</div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ padding: 11, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
        <input
          id="space-finder-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="What are you looking for?"
          style={{
            flex: 1, padding: '9px 12px', borderRadius: 9,
            border: '1px solid #e2e8f0', fontSize: 13.5, outline: 'none',
          }}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          aria-label="Send"
          style={{
            padding: '9px 15px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: loading || !input.trim() ? '#cbd5e1' : '#2563eb', color: '#fff',
          }}
        >
          <SendOutlined />
        </button>
      </div>
    </div>
  );
}
