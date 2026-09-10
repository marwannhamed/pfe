import { useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Form, Input, InputNumber, DatePicker, Button, Alert, Typography, Spin, Radio } from 'antd';
import {
  HomeOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { spaceApi, bookingApplicationApi } from '../../api/services';
import SpaceAddonPicker, { type SelectedAddon } from '../../components/spaces/SpaceAddonPicker';
import { useAuthStore } from '../../store/authStore';
import { clearPendingBookingSpace } from '../../utils/pendingBookingSpace';
import { PORTAL_MAP_PATH, PUBLIC_MAP_PATH } from '../../constants/routes';
import { addonLineTotal, addonUnitPriceForLease } from '../../utils/addonPricing';
import { currencySymbol, DEFAULT_CURRENCY, isQatarWeekend } from '../../constants/qatar';

const { Title, Text } = Typography;

type AddonSvc = {
  id: string;
  name: string;
  price: number;
  billing_cycle: string;
};

type SpaceDetail = {
  id: string;
  name: string;
  type: string;
  capacity?: number;
  area_sqm?: number;
  description?: string;
  currency?: string;
  price_per_month?: number;
  monthly_rate?: number;
  photos?: string[];
  virtual_tour_url?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  transportation_notes?: string;
  features?: { name: string }[];
  available_addons?: AddonSvc[];
  floor?: { building?: { tenant_id?: string } };
};

function formatPrice(s: SpaceDetail) {
  const amt = s.price_per_month ?? s.monthly_rate ?? 0;
  const sym = currencySymbol(s.currency ?? DEFAULT_CURRENCY);
  return `${sym}${Number(amt).toLocaleString()}/mo`;
}

export default function GuestApplyPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navAddons = (location.state as { addons?: SelectedAddon[] } | null)?.addons;
  const [form] = Form.useForm();
  const { isAuthenticated } = useAuthStore();
  const mapPath = isAuthenticated ? PORTAL_MAP_PATH : PUBLIC_MAP_PATH;
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>(navAddons ?? []);

  const { data: space, isLoading, isError } = useQuery({
    queryKey: ['public-space', spaceId],
    queryFn: () =>
      spaceApi.getPublishedOne(spaceId!).then(
        (r) => ((r as { data?: SpaceDetail })?.data ?? r) as SpaceDetail,
      ),
    enabled: !!spaceId,
  });

  const landlordTenantId = space?.floor?.building?.tenant_id;
  const catalogAddons = (space?.available_addons ?? []) as AddonSvc[];
  const hasAddons = catalogAddons.length > 0;

  const STEPS = isAuthenticated
    ? [
        { title: 'Booking', description: 'Dates & team size' },
        ...(hasAddons ? [{ title: 'Add-ons', description: 'Optional extras' }] : []),
        { title: 'Details', description: 'How you will use it' },
        { title: 'Review', description: 'Confirm & submit' },
      ]
    : [
        { title: 'Contact', description: 'Your details' },
        { title: 'Booking', description: 'Dates & team size' },
        ...(hasAddons ? [{ title: 'Add-ons', description: 'Optional extras' }] : []),
        { title: 'Details', description: 'How you will use it' },
        { title: 'Review', description: 'Confirm & submit' },
      ];

  const addonStep = isAuthenticated ? (hasAddons ? 1 : -1) : (hasAddons ? 2 : -1);
  const detailsStep = isAuthenticated ? (hasAddons ? 2 : 1) : (hasAddons ? 3 : 2);
  const reviewStep = STEPS.length - 1;

  const fieldsPerStep: Record<number, string[]> = {};
  if (!isAuthenticated) fieldsPerStep[0] = ['guest_name', 'guest_email', 'guest_phone', 'applicant_type', 'company_name'];
  const bookingStep = isAuthenticated ? 0 : 1;
  fieldsPerStep[bookingStep] = ['start_date', 'duration_months', 'headcount'];
  fieldsPerStep[detailsStep] = ['intended_use'];
  fieldsPerStep[reviewStep] = [];

  const validateCurrentStep = async (): Promise<boolean> => {
    try {
      await form.validateFields(fieldsPerStep[step]);
      return true;
    } catch {
      return false;
    }
  };

  const next = async () => {
    if (await validateCurrentStep()) setStep((s) => s + 1);
  };
  const prev = () => setStep((s) => s - 1);

  const mutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const allowedIds = new Set(catalogAddons.map((a) => a.id));
      const addons = selectedAddons
        .filter((a) => allowedIds.has(a.addon_service_id))
        .map((a) => ({ addon_service_id: a.addon_service_id, quantity: a.quantity }));

      const payload = {
        space_id: spaceId!,
        start_date: (values.start_date as dayjs.Dayjs).format('YYYY-MM-DD'),
        duration_months: Math.round(Number(values.duration_months)),
        headcount: Math.round(Number(values.headcount)),
        intended_use: values.intended_use as string,
        message: values.message as string | undefined,
        ...(addons.length && { addons }),
      };
      if (isAuthenticated) return bookingApplicationApi.create(payload);
      return bookingApplicationApi.createGuest({
        ...payload,
        guest_name: values.guest_name as string,
        guest_email: values.guest_email as string,
        guest_phone: values.guest_phone as string,
        applicant_type: (values.applicant_type as 'INDIVIDUAL' | 'COMPANY') ?? 'INDIVIDUAL',
        company_name: values.company_name as string | undefined,
      });
    },
    onSuccess: (_data, variables) => {
      clearPendingBookingSpace();
      if (!isAuthenticated && variables.guest_email) {
        setSubmittedEmail(String(variables.guest_email));
      }
      setIsSuccess(true);
    },
    onError: (err: { userMessage?: string; response?: { data?: { message?: string | string[] } } }) => {
      const msg = err?.userMessage ?? err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to submit application'));
    },
  });

  const onSubmit = async () => {
    setError('');
    try {
      await form.validateFields();
    } catch {
      return;
    }
    const values = form.getFieldsValue(true);
    mutation.mutate(values);
  };

  if (isLoading) {
    return (
      <Form form={form} component={false}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <Spin size="large" />
        </div>
      </Form>
    );
  }

  if (isError || !space) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <Title level={4}>Space not available</Title>
          <Text style={{ color: '#64748b', display: 'block', marginBottom: 20 }}>
            This space may no longer be published or is already reserved.
          </Text>
          <Link to={mapPath}>
            <Button type="primary">Back to map</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ width: 440, background: '#fff', borderRadius: 16, textAlign: 'center', padding: '40px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <CheckCircleOutlined style={{ fontSize: 56, color: '#22c55e', marginBottom: 16 }} />
          <Title level={3} style={{ color: '#0f172a', margin: '0 0 8px' }}>
            {isAuthenticated ? 'Booking request sent!' : 'Application sent!'}
          </Title>
          <Text style={{ color: '#64748b', display: 'block', marginBottom: 28 }}>
            {isAuthenticated ? (
              <>Your request for <strong>{space.name}</strong> was submitted. Track it under Bookings — a manager will confirm and issue one combined invoice.</>
            ) : (
              <>
                We received your application for <strong>{space.name}</strong>.
                <br /><br />
                <strong>Sign in:</strong> check <strong>{submittedEmail || 'your email'}</strong> for a message titled
                &nbsp;<em>“Application received”</em> and another email with a <strong>Set password</strong> link
                (or use <strong>Forgot password</strong> on the login page with the same email).
                <br /><br />
                A manager will accept your application before the booking is confirmed.
              </>
            )}
          </Text>
          <Button type="primary" block size="large" onClick={() => navigate(isAuthenticated ? '/portal/bookings' : '/login')} style={{ height: 48, borderRadius: 8, fontWeight: 600, background: '#2563eb', border: 'none', marginBottom: 10 }}>
            {isAuthenticated ? 'View my bookings' : 'Go to login'}
          </Button>
          {isAuthenticated && (
            <Button block size="large" onClick={() => navigate(mapPath)} style={{ height: 48, borderRadius: 8 }}>
              Book another space
            </Button>
          )}
        </div>
      </div>
    );
  }

  const reviewValues = form.getFieldsValue(true);

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
          <Title style={{ color: '#fff', fontSize: 32, fontWeight: 800, lineHeight: 1.2, margin: '0 0 8px' }}>
            {isAuthenticated ? 'Book' : 'Apply for'}<br />{space.name}
          </Title>
          <Text style={{ color: '#94a3b8', fontSize: 14, display: 'block', marginBottom: 8 }}>
            {(space.type ?? 'SPACE').replace(/_/g, ' ')} · {space.capacity ?? '—'} people · {formatPrice(space)}
          </Text>
          {(space.address || space.city) && (
            <Text style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 32 }}>
              {[space.address, space.city, space.state, space.country].filter(Boolean).join(', ')}
            </Text>
          )}

          {space.photos?.[0] && (
            <img src={space.photos[0]} alt={space.name} style={{ width: '100%', maxWidth: 320, height: 140, objectFit: 'cover', borderRadius: 12, marginBottom: 28, border: '1px solid rgba(255,255,255,0.15)' }} />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STEPS.map((s, i) => {
              const isDone = i < step;
              const isActive = i === step;
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
            <Text style={{ color: '#93c5fd', fontSize: 12, display: 'block', marginBottom: 4, fontWeight: 600 }}>After you submit</Text>
            <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>
              {isAuthenticated
                ? 'Your application will be reviewed by a manager before a booking is created.'
                : 'We create your tenant account and email you a link to set your password. A manager will review your application — the booking is confirmed only after they accept it.'}
            </Text>
          </div>
        </div>

        <div style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <Link to={mapPath} style={{ color: '#94a3b8', fontSize: 14 }}>
            ← Back to map
          </Link>
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

        {error && (
          <Alert title={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 20, borderRadius: 8 }} />
        )}

        <Form form={form} layout="vertical" size="large" requiredMark={false} initialValues={{ duration_months: 12, headcount: 4, applicant_type: 'INDIVIDUAL' }}>
          {!isAuthenticated && step === 0 && (
            <>
              <Form.Item name="applicant_type" label="Who is booking?" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio value="INDIVIDUAL">Individual (personal lease)</Radio>
                  <Radio value="COMPANY">Company / society</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.applicant_type !== cur.applicant_type}>
                {({ getFieldValue }) =>
                  getFieldValue('applicant_type') === 'COMPANY' ? (
                    <Form.Item name="company_name" label="Company name" rules={[{ required: true, message: 'Company name is required' }]}>
                      <Input placeholder="Acme Corp" style={{ borderRadius: 8, height: 46 }} />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
              <Form.Item name="guest_name" label="Your full name" rules={[{ required: true, message: 'Name is required' }]}>
                <Input prefix={<UserOutlined style={{ color: '#9ca3af' }} />} placeholder="Jane Doe" style={{ borderRadius: 8, height: 46 }} />
              </Form.Item>
              <Form.Item name="guest_email" label="Email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
                <Input prefix={<MailOutlined style={{ color: '#9ca3af' }} />} type="email" placeholder="you@company.com" style={{ borderRadius: 8, height: 46 }} />
              </Form.Item>
              <Form.Item
                name="guest_phone"
                label="Phone number"
                rules={[
                  { required: true, message: 'Phone is required for confirmation calls' },
                  { pattern: /^\+[1-9]\d{7,14}$/, message: 'Use international format e.g. +97412345678' },
                ]}
              >
                <Input prefix={<PhoneOutlined style={{ color: '#9ca3af' }} />} placeholder="+97412345678" style={{ borderRadius: 8, height: 46 }} />
              </Form.Item>
            </>
          )}

          {step === bookingStep && (
            <>
              <Form.Item name="start_date" label="Desired start date" rules={[{ required: true, message: 'Start date is required' }]}>
                <DatePicker style={{ width: '100%', borderRadius: 8, height: 46 }} disabledDate={(d) => d.isBefore(dayjs(), 'day') || isQatarWeekend(d.toDate())} suffixIcon={<CalendarOutlined />} />
              </Form.Item>
              <Form.Item name="duration_months" label="Duration (months)" rules={[{ required: true, message: 'Duration is required' }]}>
                <InputNumber min={1} max={120} style={{ width: '100%', borderRadius: 8, height: 46 }} />
              </Form.Item>
              <Form.Item name="headcount" label="Number of people" rules={[{ required: true, message: 'Headcount is required' }]}>
                <InputNumber min={1} style={{ width: '100%', borderRadius: 8, height: 46 }} />
              </Form.Item>
            </>
          )}

          {hasAddons && step === addonStep && (
            <>
              <Text style={{ display: 'block', marginBottom: 14, fontSize: 13, color: '#64748b' }}>
                All add-ons are optional. Tick only what you want — leave everything unchecked if you do not need extras.
                Selected add-ons are billed with your space lease on one invoice.
              </Text>
              <SpaceAddonPicker
                tenantId={landlordTenantId}
                catalog={catalogAddons}
                allowedIds={catalogAddons.map((a) => a.id)}
                value={selectedAddons}
                onChange={setSelectedAddons}
                compact
                currency={space.currency ?? DEFAULT_CURRENCY}
              />
              {selectedAddons.length === 0 && (
                <Text style={{ display: 'block', marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
                  No add-ons selected — click Continue to skip this step.
                </Text>
              )}
            </>
          )}

          {step === detailsStep && (
            <>
              <Form.Item name="intended_use" label="Intended use" rules={[{ required: true, message: 'Please describe how you will use the space' }]}>
                <Input placeholder="e.g. Software team office" style={{ borderRadius: 8, height: 46 }} />
              </Form.Item>
              <Form.Item name="message" label="Message to manager (optional)">
                <Input.TextArea rows={4} placeholder="Any details we should know..." style={{ borderRadius: 8 }} />
              </Form.Item>
            </>
          )}

          {step === reviewStep && (() => {
            const duration = Number(reviewValues.duration_months ?? 12);
            const monthly = Number(space.price_per_month ?? space.monthly_rate ?? 0);
            const spaceRent = monthly * duration;
            const addonById = new Map(catalogAddons.map((a) => [a.id, a]));
            let addonsTotal = 0;
            const addonLines = selectedAddons
              .map((sel) => {
                const svc = addonById.get(sel.addon_service_id);
                if (!svc) return null;
                const unit = addonUnitPriceForLease(svc.price, svc.billing_cycle, duration);
                const line = addonLineTotal(sel.quantity, unit);
                addonsTotal += line;
                return { name: svc.name, qty: sel.quantity, line };
              })
              .filter(Boolean) as { name: string; qty: number; line: number }[];
            return (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 2 }}>
                  {!isAuthenticated && (
                    <>
                      <div><strong>Type:</strong> {reviewValues.applicant_type === 'COMPANY' ? 'Company' : 'Individual'}</div>
                      {reviewValues.applicant_type === 'COMPANY' && reviewValues.company_name && (
                        <div><strong>Company:</strong> {reviewValues.company_name}</div>
                      )}
                      <div><strong>Name:</strong> {reviewValues.guest_name}</div>
                      <div><strong>Email:</strong> {reviewValues.guest_email}</div>
                      {reviewValues.guest_phone && <div><strong>Phone:</strong> {reviewValues.guest_phone}</div>}
                    </>
                  )}
                  <div><strong>Start:</strong> {reviewValues.start_date?.format?.('DD/MM/YYYY') ?? '—'}</div>
                  <div><strong>Duration:</strong> {duration} months</div>
                  <div><strong>People:</strong> {reviewValues.headcount}</div>
                  <div><strong>Use:</strong> {reviewValues.intended_use}</div>
                  {reviewValues.message && <div><strong>Message:</strong> {reviewValues.message}</div>}
                  {hasAddons && (
                    <div>
                      <strong>Add-ons:</strong>{' '}
                      {addonLines.length
                        ? addonLines.map((l) => `${l.name} ×${l.qty}`).join(', ')
                        : 'None'}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Estimated total (if accepted)</div>
                  <div style={{ fontSize: 13, color: '#334155' }}>Space lease: <strong>{currencySymbol(space.currency ?? DEFAULT_CURRENCY)}{spaceRent.toLocaleString()}</strong></div>
                  {addonLines.map((l) => (
                    <div key={l.name} style={{ fontSize: 13, color: '#334155' }}>{l.name} ×{l.qty}: <strong>{currencySymbol(space.currency ?? DEFAULT_CURRENCY)}{l.line.toLocaleString()}</strong></div>
                  ))}
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#2563eb', marginTop: 8 }}>
                    {currencySymbol(space.currency ?? DEFAULT_CURRENCY)}{(spaceRent + addonsTotal).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {step > 0 && (
              <Button onClick={prev} style={{ flex: 1, height: 48, borderRadius: 8, fontSize: 15, fontWeight: 500 }}>← Back</Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="primary" onClick={next} style={{ flex: 1, height: 48, borderRadius: 8, fontSize: 15, fontWeight: 600, background: '#2563eb', border: 'none' }}>
                {step === addonStep && selectedAddons.length === 0 ? 'Continue without add-ons →' : 'Continue →'}
              </Button>
            ) : (
              <Button type="primary" loading={mutation.isPending} onClick={onSubmit} style={{ flex: 1, height: 48, borderRadius: 8, fontSize: 15, fontWeight: 600, background: '#2563eb', border: 'none' }}>
                {isAuthenticated ? 'Submit booking request' : 'Submit application'}
              </Button>
            )}
          </div>

          {!isAuthenticated && step === 0 && (
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#64748b' }}>
              Have an account? <Link to={`/login?space_id=${spaceId}`} style={{ color: '#2563eb', fontWeight: 600 }}>Sign in</Link>
            </div>
          )}
        </Form>

        <Text style={{ color: '#cbd5e1', fontSize: 12, textAlign: 'center', marginTop: 32 }}>
          © 2026 LeaseManager · All rights reserved
        </Text>
      </div>
    </div>
  );
}
