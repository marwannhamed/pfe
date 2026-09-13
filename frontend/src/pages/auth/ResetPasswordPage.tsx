import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Form, Input, Button, Alert, Typography } from 'antd';
import { message } from '../../utils/feedback';
import {
  LockOutlined, HomeOutlined, ArrowLeftOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import api from '../../api/config';
import { asApiError } from '../../utils/errors';

const { Title, Text } = Typography;

export default function ResetPasswordPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
      setTokenValid(false);
    } else {
      setTokenValid(true);
    }
  }, [token]);

  const onFinish = async (values: { newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        newPassword: values.newPassword,
        resetPasswordToken: token,
      });
      message.success('Password reset successfully!');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const msg = asApiError(err).response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to reset password. The link may have expired.'));
    } finally {
      setLoading(false);
    }
  };

  if (tokenValid === false) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
        <div style={{ flex: 1, background: 'linear-gradient(145deg, #0f172a 0%, #1e3a8a 55%, #2563eb 100%)' }} />
        <div style={{ width: 500, background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 56px' }}>
          <div style={{ textAlign: 'center' }}>
            <Alert
              title="Invalid Reset Link"
              description="This password reset link is invalid or has expired. Please request a new password reset."
              type="error"
              showIcon
              style={{ marginBottom: 24 }}
            />
            <Button 
              type="primary" 
              onClick={() => navigate('/forgot-password')}
              style={{ height: 50, borderRadius: 8, fontSize: 16, fontWeight: 600 }}
            >
              Request New Reset Link
            </Button>
          </div>
        </div>
      </div>
    );
  }

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

        {/* Success Message */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, background: 'rgba(34, 197, 94, 0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircleOutlined style={{ color: '#22c55e', fontSize: 40 }} />
          </div>
          <Title style={{ color: '#fff', fontSize: 32, fontWeight: 700, margin: '0 0 16px' }}>
            Reset Your Password
          </Title>
          <Text style={{ color: '#94a3b8', fontSize: 16, display: 'block', marginBottom: 40 }}>
            Create a new secure password for your account
          </Text>
        </div>

        {/* Security Tips */}
        <div style={{ paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <Text style={{ color: '#cbd5e1', fontSize: 14, display: 'block', marginBottom: 16 }}>Security Tips:</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>• Use at least 8 characters</Text>
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>• Include uppercase and lowercase letters</Text>
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>• Add numbers and special characters</Text>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ width: 500, background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 56px', overflowY: 'auto' }}>

        <div style={{ marginBottom: 32 }}>
          <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', marginBottom: 16 }}>
            <ArrowLeftOutlined />
            <Text style={{ fontSize: 14 }}>Back to login</Text>
          </Link>
          <Title level={2} style={{ margin: '0 0 6px', fontWeight: 700, color: '#0f172a' }}>Create new password</Title>
          <Text style={{ color: '#64748b', fontSize: 15 }}>Enter your new password below</Text>
        </div>

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
            label={<Text style={{ fontWeight: 600, color: '#374151' }}>New Password</Text>}
            name="newPassword"
            rules={[
              { required: true, message: 'New password is required' },
              { min: 6, message: 'Password must be at least 6 characters long' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
              placeholder="Enter new password"
              style={{ borderRadius: 8, height: 46 }}
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            label={<Text style={{ fontWeight: 600, color: '#374151' }}>Confirm Password</Text>}
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Please confirm your new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
              placeholder="Confirm new password"
              style={{ borderRadius: 8, height: 46 }}
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 50, borderRadius: 8, fontSize: 16, fontWeight: 600, background: '#2563eb', border: 'none' }}
            >
              Reset Password
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 14 }}>
              Remember your password?{' '}
              <Link to="/login" style={{ color: '#2563eb', fontWeight: 600 }}>Sign in</Link>
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
