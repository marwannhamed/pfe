import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Checkbox, Alert, Typography } from 'antd';
import {
  UserOutlined, LockOutlined, HomeOutlined,
  AppstoreOutlined, TeamOutlined, FileTextOutlined, BarChartOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const FEATURES = [
  { icon: <AppstoreOutlined />, label: 'Site & space management'      },
  { icon: <TeamOutlined />,     label: 'Tenant & contract tracking'   },
  { icon: <FileTextOutlined />, label: 'Billing & payment management' },
  { icon: <BarChartOutlined />, label: 'Real-time analytics & reports'},
];

export default function LoginPage() {
  const [error, setError]    = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate             = useNavigate();

  const onFinish = async (values: { email: string; password: string }) => {
    setError('');
    try {
      await login(values.email, values.password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Invalid email or password.'));
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>

      {/* ── Left panel ── */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(145deg, #0f172a 0%, #1e3a8a 55%, #2563eb 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 64px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -120, right: -120, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, background: '#2563eb', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
            <HomeOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 700, display: 'block', lineHeight: 1 }}>
              LeaseManager
            </Text>
            <Text style={{ color: '#93c5fd', fontSize: 12 }}>Property Management Platform</Text>
          </div>
        </div>

        {/* Hero */}
        <div>
          <Title style={{ color: '#fff', fontSize: 38, fontWeight: 800, lineHeight: 1.2, margin: '0 0 16px' }}>
            Manage your<br />
            <span style={{ color: '#60a5fa' }}>property portfolio</span><br />
            with ease.
          </Title>
          <Text style={{ color: '#94a3b8', fontSize: 15, display: 'block', marginBottom: 40 }}>
            A complete platform for managing spaces,<br />
            contracts, tenants and billing.
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', fontSize: 16, flexShrink: 0 }}>
                  {f.icon}
                </div>
                <Text style={{ color: '#cbd5e1', fontSize: 14 }}>{f.label}</Text>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          {[['1,200+', 'Spaces managed'], ['98%', 'Platform uptime'], ['24/7', 'Support']].map(([val, lbl]) => (
            <div key={lbl}>
              <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{val}</div>
              <div style={{ color: '#93c5fd', fontSize: 12, marginTop: 2 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ width: 500, background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 56px', overflowY: 'auto' }}>

        <div style={{ marginBottom: 32 }}>
          <Title level={2} style={{ margin: '0 0 6px', fontWeight: 700, color: '#0f172a' }}>Welcome back</Title>
          <Text style={{ color: '#64748b', fontSize: 15 }}>Sign in to your management dashboard</Text>
        </div>

        {/* ✅ Ant Design 6: use title instead of message */}
        {error && (
          <Alert
            title={error}
            type="error"
            showIcon
            closable
            onClose={() => setError('')}
            style={{ marginBottom: 24, borderRadius: 8 }}
          />
        )}

        <Form layout="vertical" onFinish={onFinish} size="large" requiredMark={false}>
          <Form.Item
            label={<Text style={{ fontWeight: 600, color: '#374151' }}>Email address</Text>}
            name="email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email',  message: 'Please enter a valid email' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#9ca3af' }} />}
              placeholder="you@company.com"
              style={{ borderRadius: 8, height: 46 }}
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            label={
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <Text style={{ fontWeight: 600, color: '#374151' }}>Password</Text>
                <Link to="/forgot-password" style={{ color: '#2563eb', fontWeight: 500, fontSize: 14 }}>
                  Forgot password?
                </Link>
              </div>
            }
            name="password"
            rules={[{ required: true, message: 'Password is required' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
              placeholder="Enter your password"
              style={{ borderRadius: 8, height: 46 }}
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 24 }}>
            <Checkbox>
              <Text style={{ color: '#64748b', fontSize: 14 }}>Keep me signed in</Text>
            </Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              style={{ height: 50, borderRadius: 8, fontSize: 16, fontWeight: 600, background: '#2563eb', border: 'none' }}
            >
              Sign In
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 14 }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: '#2563eb', fontWeight: 600 }}>Create one</Link>
            </Text>
          </div>
        </Form>

        <Text style={{ color: '#cbd5e1', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
          © 2026 LeaseManager · All rights reserved
        </Text>
      </div>
    </div>
  );
}
