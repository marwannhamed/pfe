import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BankOutlined,
  SaveOutlined,
  TeamOutlined,
  BuildOutlined,
  AppstoreOutlined,
  GlobalOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import PageShell from '../../components/ui/PageShell';
import PageHeader from '../../components/ui/PageHeader';
import { usePageTheme } from '../../hooks/usePageTheme';
import { tenantApi } from '../../api/services';
import { message } from '../../utils/feedback';
import { QATAR_ZONES } from '../../constants/qatar';
import type { ApiError } from '../../types';
import { asApiError } from '../../utils/errors';

interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  status: string;
  subscription_plan: string;
  max_users: number;
  max_spaces: number;
  phone: string;
  website: string;
  cr_number: string;
  trade_license: string;
  address: string;
  city: string;
  country: string;
  business_hours: string;
  description: string;
  can_edit: boolean;
  usage: { active_users: number; buildings: number; spaces: number };
}

const LABEL: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  display: 'block',
  marginBottom: 5,
};

function StatPill({
  icon,
  label,
  value,
  sub,
  color,
  bg,
  th,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  color: string;
  bg: string;
  th: ReturnType<typeof usePageTheme>['t'];
}) {
  return (
    <div
      style={{
        background: th.cardBg,
        border: `1px solid ${th.cardBorder}`,
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: bg,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          {icon}
        </div>
        <div style={{ fontSize: 12, color: th.textSub }}>{label}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: th.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: th.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function CompanyProfilePage() {
  const { card, input: INPUT, t: th } = usePageTheme();
  const qc = useQueryClient();

  const { data: orgRaw, isLoading } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => tenantApi.getMyOrganization().then((r) => r.data as CompanyProfile),
  });

  const org = orgRaw;
  const canEdit = org?.can_edit ?? false;

  const [form, setForm] = useState({
    name: '',
    contact_email: '',
    phone: '',
    website: '',
    cr_number: '',
    trade_license: '',
    address: '',
    city: 'Doha',
    country: 'Qatar',
    business_hours: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!org) return;
    setForm({
      name: org.name ?? '',
      contact_email: org.contact_email ?? '',
      phone: org.phone ?? '',
      website: org.website ?? '',
      cr_number: org.cr_number ?? '',
      trade_license: org.trade_license ?? '',
      address: org.address ?? '',
      city: org.city ?? 'Doha',
      country: org.country ?? 'Qatar',
      business_hours: org.business_hours ?? '',
      description: org.description ?? '',
    });
  }, [org]);

  const setF = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const n = { ...e };
      delete n[key];
      return n;
    });
  };

  const saveMut = useMutation({
    mutationFn: () => tenantApi.updateMyOrganization(form),
    onSuccess: () => {
      message.success('Company profile saved');
      qc.invalidateQueries({ queryKey: ['company-profile'] });
      qc.invalidateQueries({ queryKey: ['client-onboarding-spaces'] });
    },
    onError: (err: ApiError) => {
      const msg = err?.userMessage ?? asApiError(err).response?.data?.message ?? 'Failed to save';
      message.error(Array.isArray(msg) ? msg.join(', ') : String(msg));
    },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Company name is required';
    if (!form.contact_email.trim()) e.contact_email = 'Contact email is required';
    else if (!/\S+@\S+\.\S+/.test(form.contact_email)) e.contact_email = 'Invalid email';
    if (form.phone.trim() && !/^\+[1-9]\d{6,14}$/.test(form.phone.trim())) {
      e.phone = 'Use international format e.g. +97412345678';
    }
    return e;
  };

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    saveMut.mutate();
  };

  if (isLoading) {
    return (
      <PageShell maxWidth={960}>
        <PageHeader title="Company profile" subtitle="Loading…" />
      </PageShell>
    );
  }

  if (!org) {
    return (
      <PageShell maxWidth={960}>
        <PageHeader title="Company profile" subtitle="Could not load your organization." />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth={960}>
      <PageHeader
        title="Company profile"
        subtitle={
          canEdit
            ? 'Your property management company details — visible to your team'
            : 'View your organization details (contact a client admin to make changes)'
        }
        actions={
          canEdit ? (
            <button
              type="button"
              disabled={saveMut.isPending}
              onClick={submit}
              style={{
                padding: '10px 18px',
                borderRadius: 9,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: saveMut.isPending ? 0.7 : 1,
              }}
            >
              <SaveOutlined /> Save changes
            </button>
          ) : undefined
        }
      />

      <div
        style={{
          ...card,
          padding: '20px 24px',
          marginBottom: 20,
          borderLeft: '4px solid #2563eb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: '#1e293b',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            <BankOutlined />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: th.text }}>{org.name}</div>
            <div style={{ fontSize: 13, color: th.textSub, marginTop: 4 }}>
              {org.slug} · Plan: {org.subscription_plan} · {org.status}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatPill
          th={th}
          icon={<TeamOutlined />}
          label="Team members"
          value={org.usage.active_users}
          sub={`of ${org.max_users} allowed`}
          color="#2563eb"
          bg="#eff6ff"
        />
        <StatPill
          th={th}
          icon={<BuildOutlined />}
          label="Buildings"
          value={org.usage.buildings}
          color="#059669"
          bg="#f0fdf4"
        />
        <StatPill
          th={th}
          icon={<AppstoreOutlined />}
          label="Spaces"
          value={org.usage.spaces}
          sub={`of ${org.max_spaces} allowed`}
          color="#7c3aed"
          bg="#f5f3ff"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ ...card, padding: '22px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: th.text, marginBottom: 16 }}>
            Company information
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ ...LABEL, color: th.text }}>Company name *</label>
              <input
                style={{ ...INPUT, borderColor: errors.name ? '#ef4444' : th.inputBorder }}
                value={form.name}
                disabled={!canEdit}
                onChange={(e) => setF('name', e.target.value)}
              />
              {errors.name && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.name}</div>}
            </div>
            <div>
              <label style={{ ...LABEL, color: th.text }}>Contact email *</label>
              <input
                type="email"
                style={{ ...INPUT, borderColor: errors.contact_email ? '#ef4444' : th.inputBorder }}
                value={form.contact_email}
                disabled={!canEdit}
                onChange={(e) => setF('contact_email', e.target.value)}
              />
              {errors.contact_email && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.contact_email}</div>
              )}
            </div>
            <div>
              <label style={{ ...LABEL, color: th.text }}>Phone</label>
              <input
                style={{ ...INPUT, borderColor: errors.phone ? '#ef4444' : th.inputBorder }}
                value={form.phone}
                disabled={!canEdit}
                placeholder="+97412345678"
                onChange={(e) => setF('phone', e.target.value)}
              />
              {errors.phone && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.phone}</div>}
            </div>
            <div>
              <label style={{ ...LABEL, color: th.text }}>Website</label>
              <input
                style={INPUT}
                value={form.website}
                disabled={!canEdit}
                placeholder="https://your-company.qa"
                onChange={(e) => setF('website', e.target.value)}
              />
            </div>
            <div>
              <label style={{ ...LABEL, color: th.text }}>Description</label>
              <textarea
                style={{ ...INPUT, minHeight: 80, resize: 'vertical' }}
                value={form.description}
                disabled={!canEdit}
                onChange={(e) => setF('description', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...card, padding: '22px 24px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: th.text, marginBottom: 16 }}>
              Qatar registration
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ ...LABEL, color: th.text }}>CR number</label>
                <input
                  style={INPUT}
                  value={form.cr_number}
                  disabled={!canEdit}
                  placeholder="Commercial registration"
                  onChange={(e) => setF('cr_number', e.target.value)}
                />
              </div>
              <div>
                <label style={{ ...LABEL, color: th.text }}>Trade license</label>
                <input
                  style={INPUT}
                  value={form.trade_license}
                  disabled={!canEdit}
                  onChange={(e) => setF('trade_license', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ ...card, padding: '22px 24px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: th.text, marginBottom: 16 }}>
              Location & hours
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ ...LABEL, color: th.text }}>Address</label>
                <input
                  style={INPUT}
                  value={form.address}
                  disabled={!canEdit}
                  onChange={(e) => setF('address', e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ ...LABEL, color: th.text }}>City / zone</label>
                  <select
                    style={{ ...INPUT, cursor: canEdit ? 'pointer' : 'not-allowed' }}
                    value={form.city}
                    disabled={!canEdit}
                    onChange={(e) => setF('city', e.target.value)}
                  >
                    {QATAR_ZONES.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ ...LABEL, color: th.text }}>Country</label>
                  <input
                    style={INPUT}
                    value={form.country}
                    disabled={!canEdit}
                    onChange={(e) => setF('country', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label style={{ ...LABEL, color: th.text }}>Business hours</label>
                <input
                  style={INPUT}
                  value={form.business_hours}
                  disabled={!canEdit}
                  placeholder="Sun–Thu 8:00–18:00"
                  onChange={(e) => setF('business_hours', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ ...card, padding: '18px 20px', fontSize: 13, color: th.textSub }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: th.text, fontWeight: 600 }}>
              <MailOutlined /> Billing contact
            </div>
            Invoices and platform notices use <strong>{org.contact_email}</strong>.
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <PhoneOutlined />
              <GlobalOutlined />
              <span>Local dev: changes save to your PostgreSQL database on localhost:5433.</span>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
