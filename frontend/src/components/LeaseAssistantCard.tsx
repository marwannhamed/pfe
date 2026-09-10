import { useState } from 'react';
import { App, Button, Card, Input, Space, Typography, Alert } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { aiApi } from '../api/services';

const { Text, Paragraph } = Typography;

export default function LeaseAssistantCard() {
  const { message } = App.useApp();
  const [q, setQ] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsApiKey, setNeedsApiKey] = useState(false);

  const ask = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setReply('');
    setNeedsApiKey(false);
    try {
      const res = await aiApi.leaseAssistant([{ role: 'user', content: q.trim() }]);
      setReply((res.data as { reply?: string })?.reply ?? '');
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 503) {
        setNeedsApiKey(true);
        message.warning('AI assistant is not configured on the server yet.');
      } else {
        message.error(e?.userMessage || e?.message || 'Assistant unavailable');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      style={{ marginBottom: 20 }}
      title={
        <Space>
          <RobotOutlined />
          <span>AI lease assistant</span>
        </Space>
      }
    >
      {needsApiKey && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title="AI API not configured"
          description={
            <>
              Add an API key to <Text code>backend/.env</Text> (free option: Groq — see README or
              docs). Restart the backend, then try again.
            </>
          }
        />
      )}
      <Paragraph type="secondary" style={{ marginTop: 0 }}>
        Ask about clauses, renewals, or timelines. Not legal advice.
      </Paragraph>
      <Input.TextArea
        rows={3}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. What should we check before renewing a flex desk lease?"
      />
      <Button type="primary" style={{ marginTop: 10 }} loading={loading} onClick={ask}>
        Ask
      </Button>
      {reply && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            background: 'var(--ant-color-fill-quaternary, #f8fafc)',
            borderRadius: 8,
            whiteSpace: 'pre-wrap',
          }}
        >
          {reply}
        </div>
      )}
    </Card>
  );
}
