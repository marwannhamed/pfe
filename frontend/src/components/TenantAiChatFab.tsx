import { useState } from 'react';
import { Button, Drawer, Input, Space, Typography } from 'antd';
import { message } from '../utils/feedback';
import { CommentOutlined } from '@ant-design/icons';
import { aiApi } from '../api/services';
import { errorMessage } from '../utils/errors';

const { Text } = Typography;

type Msg = { role: 'user' | 'assistant'; content: string };

export default function TenantAiChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg: Msg = { role: 'user', content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await aiApi.tenantAssistant(
        next.map((m) => ({ role: m.role, content: m.content })),
      );
      const reply = (res.data as { reply?: string })?.reply ?? '';
      setMessages([...next, { role: 'assistant', content: reply || '(empty)' }]);
    } catch (e) {
      message.error(errorMessage(e, 'Assistant unavailable'));
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer title="Tenant assistant" placement="right" size={400} onClose={onClose} open={open}>
      <Text type="secondary">Powered by OpenAI when configured on the server.</Text>
      <div style={{ marginTop: 12, maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '92%',
              padding: '8px 12px',
              borderRadius: 10,
              background: m.role === 'user' ? '#2563eb' : 'var(--ant-color-fill-secondary, #f1f5f9)',
              color: m.role === 'user' ? '#fff' : 'inherit',
              whiteSpace: 'pre-wrap',
              fontSize: 13,
            }}
          >
            {m.content}
          </div>
        ))}
      </div>
      <Space.Compact style={{ marginTop: 16, width: '100%' }}>
        <Input
          value={input}
          onPressEnter={send}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about bookings, spaces…"
        />
        <Button type="primary" loading={loading} onClick={send}>
          Send
        </Button>
      </Space.Compact>
    </Drawer>
  );
}

export function TenantAiChatFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<CommentOutlined />}
        onClick={() => setOpen(true)}
        style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 50, boxShadow: '0 8px 24px rgba(37,99,235,0.35)' }}
        aria-label="Open tenant assistant"
      />
      <TenantAiChatDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
