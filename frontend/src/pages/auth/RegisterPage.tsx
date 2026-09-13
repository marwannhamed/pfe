import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { setPendingBookingSpace, getPendingBookingSpace } from '../../utils/pendingBookingSpace';
import { Form, Input, Button, Alert, Typography, Card } from 'antd';
import {
  HomeOutlined, BankOutlined, UserOutlined,
  LockOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { authApi } from '../../api/services';
import { asApiError } from '../../utils/errors';
import type { FormInstance } from 'antd';

const { Title, Text } = Typography;

function CompanyStep({ form }: { form: FormInstance }) {
  return (
    <>
      <Form.Item
        label={<Text style={{ fontWeight: 600, color: '#374151' }}>Company name</Text>}
        name="company_name"
        rules={[{ required: true, message: 'Company name is required' }]}
      >
        <Input prefix={<BankOutlined style={{ color: '#9ca3af' }} />} placeholder="Acme Corp" style={{ borderRadius: 8, height: 46 }} />
      </Form.Item>

      <Form.Item
        label={
          <span>
            <Text style={{ fontWeight: 600, color: '#374151' }}>Company slug </Text>
            <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: 400 }}>— unique, no spaces (e.g. acme-corp)</Text>
          </span>
        }
        name="slug"
        rules={[
          { required: true, message: 'Slug is required' },
          { pattern: /^[a-z0-9-]+$/, message: 'Lowercase letters, numbers and hyphens only' },
        ]}
      >
        <Input
          prefix={<Text style={{ color: '#9ca3af' }}>@</Text>}
          placeholder="acme-corp"
          style={{ borderRadius: 8, height: 46 }}
          onChange={(e) => {
            const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
            form.setFieldValue('slug', val);
          }}
        />
      </Form.Item>

      <Form.Item
        label={<Text style={{ fontWeight: 600, color: '#374151' }}>Commercial Registration (CR) Number</Text>}
        name="cr_number"
        rules={[{ required: true, message: 'CR number is required' }]}
      >
        <Input placeholder="e.g. 12345678" style={{ borderRadius: 8, height: 46 }} />
      </Form.Item>

      <Form.Item
        label={<Text style={{ fontWeight: 600, color: '#374151' }}>Contact email</Text>}
        name="contact_email"
        rules={[
          { required: true, message: 'Contact email is required' },
          { type: 'email', message: 'Please enter a valid email' },
        ]}
      >
        <Input prefix={<UserOutlined style={{ color: '#9ca3af' }} />} placeholder="contact@acme.com" style={{ borderRadius: 8, height: 46 }} />
      </Form.Item>
    </>
  );
}

function PersonalStep({ companyName }: { companyName: string }) {
  return (
    <>
      {companyName && (
        <div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BankOutlined style={{ color: '#2563eb' }} />
            <div>
              <Text style={{ fontSize: 12, color: '#64748b' }}>You are registering as Tenant Admin for</Text>
              <Text strong style={{ display: 'block', color: '#1e40af' }}>{companyName}</Text>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12 }}>
        <Form.Item label={<Text style={{ fontWeight: 600, color: '#374151' }}>First name</Text>} name="first_name" style={{ flex: 1 }} rules={[{ required: true, message: 'Required' }]}>
          <Input placeholder="John" style={{ borderRadius: 8, height: 46 }} />
        </Form.Item>
        <Form.Item label={<Text style={{ fontWeight: 600, color: '#374151' }}>Last name</Text>} name="last_name" style={{ flex: 1 }} rules={[{ required: true, message: 'Required' }]}>
          <Input placeholder="Smith" style={{ borderRadius: 8, height: 46 }} />
        </Form.Item>
      </div>
      <Form.Item
        label={<Text style={{ fontWeight: 600, color: '#374151' }}>Work email</Text>}
        name="email"
        rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Please enter a valid email' }]}
      >
        <Input prefix={<UserOutlined style={{ color: '#9ca3af' }} />} placeholder="john.smith@acme.com" style={{ borderRadius: 8, height: 46 }} autoComplete="email" />
      </Form.Item>
      <Form.Item
        label={<Text style={{ fontWeight: 600, color: '#374151' }}>Phone number</Text>}
        name="phone_number"
        rules={[
          { required: true, message: 'Phone is required' },
          { pattern: /^\+[1-9]\d{6,14}$/, message: 'Use international format e.g. +97412345678' },
        ]}
      >
        <Input placeholder="+97412345678" style={{ borderRadius: 8, height: 46 }} />
      </Form.Item>
      <Form.Item
        label={<Text style={{ fontWeight: 600, color: '#374151' }}>QID Number (signing representative)</Text>}
        name="qid_number"
        rules={[{ required: true, message: 'QID number is required' }]}
      >
        <Input placeholder="e.g. 28901234567" style={{ borderRadius: 8, height: 46 }} />
      </Form.Item>
      <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, background: '#2563eb', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <UserOutlined style={{ color: '#fff' }} />
        </div>
        <div>
          <Text style={{ fontWeight: 600, color: '#0f172a', display: 'block' }}>Tenant Admin</Text>
          <Text style={{ fontSize: 12, color: '#64748b' }}>Your role is automatically assigned · other roles are created by you or a Super Admin after setup</Text>
        </div>
        <LockOutlined style={{ color: '#cbd5e1', marginLeft: 'auto' }} />
      </div>
    </>
  );
}

function PasswordStep() {
  return (
    <>
      <Form.Item
        label={<Text style={{ fontWeight: 600, color: '#374151' }}>Password</Text>}
        name="password"
        rules={[{ required: true, message: 'Password is required' }, { min: 8, message: 'Must be at least 8 characters' }]}
      >
        <Input.Password prefix={<LockOutlined style={{ color: '#9ca3af' }} />} placeholder="At least 8 characters" style={{ borderRadius: 8, height: 46 }} autoComplete="new-password" />
      </Form.Item>
      <Form.Item
        label={<Text style={{ fontWeight: 600, color: '#374151' }}>Confirm password</Text>}
        name="confirm_password"
        dependencies={['password']}
        rules={[
          { required: true, message: 'Please confirm your password' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) return Promise.resolve();
              return Promise.reject(new Error('Passwords do not match'));
            },
          }),
        ]}
      >
        <Input.Password prefix={<LockOutlined style={{ color: '#9ca3af' }} />} placeholder="Repeat your password" style={{ borderRadius: 8, height: 46 }} autoComplete="new-password" />
      </Form.Item>
      <Form.Item
        name="terms"
        valuePropName="checked"
        rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject('Please accept the terms to continue') }]}
      >
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" style={{ marginTop: 3 }} />
          <Text style={{ color: '#64748b', fontSize: 13 }}>
            I agree to the <Link to="/terms" style={{ color: '#2563eb' }}>Terms of Service</Link> and <Link to="/privacy" style={{ color: '#2563eb' }}>Privacy Policy</Link>
          </Text>
        </label>
      </Form.Item>
    </>
  );
}

export default function RegisterPage() {
  const [form]      = Form.useForm();
  const [step,      setStep]      = useState(0);
  const [error,     setError]     = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pendingSpaceId = searchParams.get('space_id');

  useEffect(() => {
    if (pendingSpaceId) setPendingBookingSpace(pendingSpaceId);
  }, [pendingSpaceId]);

  const STEPS = [
    { title: 'Company',  description: 'Name & contact' },
    { title: 'Account',  description: 'Your details'   },
    { title: 'Security', description: 'Set password'   },
  ];

  const fieldsPerStep: Record<number, string[]> = {
    0: ['company_name', 'slug', 'cr_number', 'contact_email'],
    1: ['first_name', 'last_name', 'email', 'phone_number', 'qid_number'],
    2: ['password', 'confirm_password'],
  };

  const validateCurrentStep = async (): Promise<boolean> => {
    try { await form.validateFields(fieldsPerStep[step]); return true; }
    catch { return false; }
  };

  const next = async () => { if (await validateCurrentStep()) setStep(s => s + 1); };
  const prev = () => setStep(s => s - 1);

  const onFinish = async () => {
    setError('');
    setIsLoading(true);
    try {
      const v = form.getFieldsValue(true);
      await authApi.registerTenant({
        company_name:  v.company_name,
        slug:          v.slug,
        cr_number:     v.cr_number,
        contact_email: v.contact_email,
        first_name:    v.first_name,
        last_name:     v.last_name,
        email:         v.email,
        phone_number:  v.phone_number,
        qid_number:    v.qid_number,
        password:      v.password,
      });
      setIsSuccess(true);
    } catch (err) {
      const msg = asApiError(err).response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Registration failed. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <Card style={{ width: 440, borderRadius: 16, textAlign: 'center', padding: '20px 0', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <CheckCircleOutlined style={{ fontSize: 56, color: '#22c55e', marginBottom: 16 }} />
          <Title level={3} style={{ color: '#0f172a', margin: '0 0 8px' }}>Account created!</Title>
          <Text style={{ color: '#64748b', display: 'block', marginBottom: 8 }}>Welcome to LeaseManager.</Text>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 20, marginBottom: 28 }}>
            <Text style={{ color: '#92400e', fontSize: 13 }}>
              Status: <strong>Pending</strong> — a Super Admin will activate your account shortly.
            </Text>
          </div>
          <Button type="primary" block size="large" onClick={() => {
            const sid = getPendingBookingSpace();
            navigate(sid ? `/login?space_id=${sid}` : '/login');
          }}
            style={{ height: 48, borderRadius: 8, fontSize: 15, fontWeight: 600, background: '#2563eb', border: 'none' }}>
            Go to Sign In
          </Button>
          {getPendingBookingSpace() && (
            <Text style={{ display: 'block', marginTop: 12, fontSize: 12, color: '#64748b' }}>
              After sign-in you can complete your booking application for the selected space.
            </Text>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>

      {/* Left panel */}
      <div style={{ flex: 1, background: 'linear-gradient(145deg, #0f172a 0%, #1e3a8a 55%, #2563eb 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 64px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -120, right: -120, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, background: '#2563eb', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
            <HomeOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 700, display: 'block', lineHeight: 1 }}>LeaseManager</Text>
            <Text style={{ color: '#93c5fd', fontSize: 12 }}>Property Management Platform</Text>
          </div>
        </div>

        <div>
          <Title style={{ color: '#fff', fontSize: 32, fontWeight: 800, lineHeight: 1.2, margin: '0 0 8px' }}>Register your<br />company</Title>
          <Text style={{ color: '#94a3b8', fontSize: 14, display: 'block', marginBottom: 40 }}>Complete the steps to create your Tenant Admin account.</Text>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STEPS.map((s, i) => {
              const isDone = i < step, isActive = i === step;
              return (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isDone ? '#22c55e' : isActive ? '#fff' : 'rgba(255,255,255,0.1)', border: `1.5px solid ${isDone ? '#22c55e' : isActive ? '#fff' : 'rgba(255,255,255,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: isDone ? '#fff' : isActive ? '#2563eb' : 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <div>
                      <Text style={{ color: isActive ? '#fff' : isDone ? '#86efac' : 'rgba(255,255,255,0.5)', fontWeight: 500, display: 'block', fontSize: 14 }}>{s.title}</Text>
                      <Text style={{ color: isActive ? '#93c5fd' : 'rgba(255,255,255,0.35)', fontSize: 12 }}>{s.description}</Text>
                    </div>
                  </div>
                  {i < STEPS.length - 1 && <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', marginLeft: 26 }} />}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 32, padding: '14px 16px', background: 'rgba(255,255,255,0.08)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)' }}>
            <Text style={{ color: '#93c5fd', fontSize: 12, display: 'block', marginBottom: 4, fontWeight: 600 }}>ℹ Tenant Admin account</Text>
            <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>
              This creates a <strong style={{ color: '#fff' }}>Tenant Admin</strong> account. Other roles (Site Manager, Finance, Employee…) are added by you after setup.
            </Text>
          </div>
        </div>

        <div style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <Text style={{ color: '#94a3b8', fontSize: 14 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#fff', fontWeight: 600 }}>Sign in →</Link>
          </Text>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ width: 520, background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 56px', overflowY: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 32 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ height: 6, borderRadius: 3, width: i === step ? 24 : 8, background: i < step ? '#22c55e' : i === step ? '#2563eb' : '#e2e8f0', transition: 'all 0.2s' }} />
          ))}
          <Text style={{ color: '#9ca3af', fontSize: 12, marginLeft: 8 }}>Step {step + 1} of {STEPS.length}</Text>
        </div>

        <div style={{ marginBottom: 28 }}>
          <Title level={2} style={{ margin: '0 0 6px', fontWeight: 700, color: '#0f172a' }}>{STEPS[step].title}</Title>
          <Text style={{ color: '#64748b', fontSize: 15 }}>{STEPS[step].description}</Text>
        </div>

        {/* ✅ Ant Design 6: title instead of message */}
        {error && (
          <Alert
            title={error}
            type="error"
            showIcon
            closable
            onClose={() => setError('')}
            style={{ marginBottom: 20, borderRadius: 8 }}
          />
        )}

        <Form form={form} layout="vertical" size="large" requiredMark={false}>
          {step === 0 && <CompanyStep form={form} />}
          {step === 1 && <PersonalStep companyName={form.getFieldValue('company_name')} />}
          {step === 2 && <PasswordStep />}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {step > 0 && (
              <Button onClick={prev} style={{ flex: 1, height: 48, borderRadius: 8, fontSize: 15, fontWeight: 500 }}>← Back</Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="primary" onClick={next} style={{ flex: 1, height: 48, borderRadius: 8, fontSize: 15, fontWeight: 600, background: '#2563eb', border: 'none' }}>Continue →</Button>
            ) : (
              <Button type="primary" loading={isLoading} onClick={onFinish} style={{ flex: 1, height: 48, borderRadius: 8, fontSize: 15, fontWeight: 600, background: '#2563eb', border: 'none' }}>Create account</Button>
            )}
          </div>
        </Form>

        <Text style={{ color: '#cbd5e1', fontSize: 12, textAlign: 'center', marginTop: 32 }}>
          © 2026 LeaseManager · All rights reserved
        </Text>
      </div>
    </div>
  );
}
