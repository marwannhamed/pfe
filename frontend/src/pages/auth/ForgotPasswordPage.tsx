import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Alert, Typography } from 'antd';
import { MailOutlined, HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { authApi } from '../../api/services';

const { Title, Text } = Typography;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string }) => {
    setError('');
    setLoading(true);
    try {
      await authApi.requestPasswordReset(values.email);
      setSent(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Could not send reset email. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
      <div style={{
        flex: 1,
        background: 'linear-gradient(145deg, #0f172a 0%, #1e3a8a 55%, #2563eb 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 64px',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
          <div style={{ width: 44, height: 44, background: '#2563eb', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HomeOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 700, display: 'block' }}>LeaseManager</Text>
            <Text style={{ color: '#93c5fd', fontSize: 12 }}>Reset your password</Text>
          </div>
        </div>
        <Title style={{ color: '#fff', fontSize: 32, fontWeight: 800, margin: '0 0 12px' }}>Forgot password?</Title>
        <Text style={{ color: '#94a3b8', fontSize: 15, maxWidth: 400, lineHeight: 1.6 }}>
          Enter your email and we will send you a link to choose a new password.
        </Text>
      </div>

      <div style={{ width: 480, background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 56px' }}>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/login')} style={{ alignSelf: 'flex-start', padding: 0, marginBottom: 24 }}>
          Back to sign in
        </Button>

        {sent ? (
          <div>
            <Title level={3} style={{ margin: '0 0 8px' }}>Check your email</Title>
            <Text style={{ color: '#64748b', display: 'block', marginBottom: 24 }}>
              If an account exists for that address, you will receive a reset link shortly.
            </Text>
            <Button type="primary" block size="large" onClick={() => navigate('/login')}>
              Return to sign in
            </Button>
          </div>
        ) : (
          <>
            <Title level={3} style={{ margin: '0 0 8px' }}>Reset password</Title>
            <Text style={{ color: '#64748b', display: 'block', marginBottom: 28 }}>Use the email linked to your account.</Text>
            {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 20 }} />}
            <Form layout="vertical" size="large" onFinish={onFinish} requiredMark={false}>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
                <Input prefix={<MailOutlined style={{ color: '#9ca3af' }} />} placeholder="you@company.com" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                  Send reset link
                </Button>
              </Form.Item>
            </Form>
            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b' }}>
              Remember your password? <Link to="/login" style={{ color: '#2563eb', fontWeight: 600 }}>Sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
