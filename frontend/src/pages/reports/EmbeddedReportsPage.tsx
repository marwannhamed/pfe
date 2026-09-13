import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Select, Space, Typography } from 'antd';
import { message } from '../../utils/feedback';
import { BarChartOutlined, LineChartOutlined, ExportOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { tenantApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { usePageTheme } from '../../hooks/usePageTheme';
import PageShell from '../../components/ui/PageShell';

const { Title, Paragraph, Text } = Typography;

type Embeds = {
  powerBi?: { title?: string; embedUrl?: string };
  tableau?: { title?: string; embedUrl?: string };
};

export default function EmbeddedReportsPage() {
  const { t: th } = usePageTheme();
  const { user } = useAuthStore();
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [tenantId, setTenantId] = useState<string>('');
  const [embeds, setEmbeds] = useState<Embeds | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const role = user?.role ?? '';
  const isSuper = role === 'SUPER_ADMIN';
  const isFinance = role === 'FINANCE';
  const isViewer = isFinance || role === 'MANAGER';
  const canPickTenant = isSuper || isFinance || role === 'MANAGER';
  const defaultTenant = user?.tenant_id ?? '';

  useEffect(() => {
    if (canPickTenant) {
      tenantApi
        .getAll()
        .then((r) => {
          const list = Array.isArray(r.data) ? r.data : (r.data as { data?: unknown[] })?.data ?? [];
          const mapped = (list as { id: string; name: string }[]).map((t) => ({
            id: t.id,
            name: t.name,
          }));
          setTenants(mapped);
          if (mapped.length > 0) {
            const preferred =
              mapped.find((t) => t.name.toLowerCase().includes('acme')) ??
              mapped.find((t) => !t.name.toLowerCase().includes('leasemanager')) ??
              mapped[0];
            // Functional form keeps the "only if nothing is chosen yet" rule
            // without reading tenantId here — depending on it would refetch
            // the whole tenant list every time the selection changed.
            setTenantId((prev) => prev || preferred.id);
          }
        })
        .catch(() => setTenants([]));
    } else {
      setTenantId(defaultTenant);
    }
  }, [canPickTenant, defaultTenant]);

  const canEdit =
    role === 'SUPER_ADMIN' ||
    role === 'MANAGER' ||
    role === 'TENANT_ADMIN';

  const load = useCallback(async (tid: string) => {
    if (!tid) return;
    setLoading(true);
    try {
      const res = await tenantApi.getOne(tid);
      const t = res.data as { reporting_embeds?: Embeds | null; name?: string };
      const re = (t?.reporting_embeds ?? null) as Embeds | null;
      setEmbeds(re);
      if (canEdit) {
        form.setFieldsValue({
          powerBiTitle: re?.powerBi?.title,
          powerBiUrl: re?.powerBi?.embedUrl,
          tableauTitle: re?.tableau?.title,
          tableauUrl: re?.tableau?.embedUrl,
        });
      }
    } catch {
      message.error('Failed to load tenant');
    } finally {
      setLoading(false);
    }
  }, [canEdit, form]);

  useEffect(() => {
    const tid = canPickTenant ? tenantId : defaultTenant;
    if (tid) load(tid);
  }, [tenantId, defaultTenant, canPickTenant, load]);

  const save = async () => {
    const tid = canPickTenant ? tenantId : defaultTenant;
    if (!tid) {
      message.warning('Select a tenant');
      return;
    }
    const v = await form.validateFields();
    setLoading(true);
    try {
      await tenantApi.updateReportingEmbeds(tid, {
        powerBi: {
          title: v.powerBiTitle,
          embedUrl: v.powerBiUrl || undefined,
        },
        tableau: {
          title: v.tableauTitle,
          embedUrl: v.tableauUrl || undefined,
        },
      });
      message.success('Saved');
      load(tid);
    } catch (e: any) {
      message.error(e?.userMessage || e?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedTenantName = tenants.find((t) => t.id === tenantId)?.name;

  return (
    <PageShell>
      <Space align="start" style={{ marginBottom: 16 }}>
        <BarChartOutlined style={{ fontSize: 28, color: 'var(--ant-color-primary)' }} />
        <div>
          <Title level={3} style={{ margin: 0, color: th.text }}>
            {isFinance ? 'Financial BI dashboards' : 'Owner reports (Power BI / Tableau)'}
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 720 }}>
            {isFinance
              ? 'View portfolio or tenant-level dashboards configured by administrators. Use built-in reports below when no embed is set up yet.'
              : 'Paste public or secured embed URLs from your BI workspace. For production, prefer embed token flows on the vendor side.'}
          </Paragraph>
        </div>
      </Space>

      {isFinance && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Finance workspace"
          description={
            <span>
              Day-to-day work:{' '}
              <Link to="/admin/finance-dashboard">Finance dashboard</Link>,{' '}
              <Link to="/admin/billing">Billing</Link>,{' '}
              <Link to="/admin/payments">Payments</Link>, and{' '}
              <Link to="/admin/revenue-forecast">Revenue forecast</Link>.
            </span>
          }
        />
      )}

      {canPickTenant && (
        <Card style={{ marginBottom: 16 }}>
          <Text strong>{isFinance ? 'Organization' : 'Tenant'}</Text>
          <Select
            style={{ display: 'block', marginTop: 8, maxWidth: 400 }}
            placeholder="Select organization"
            value={tenantId || undefined}
            onChange={(v) => setTenantId(v)}
            loading={loading && tenants.length === 0}
            options={tenants.map((t) => ({ value: t.id, label: t.name }))}
          />
          {isViewer && !canEdit && selectedTenantName && (
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              Viewing dashboards for <Text strong>{selectedTenantName}</Text> (read-only).
            </Paragraph>
          )}
        </Card>
      )}

      {canEdit && (
        <>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title="Security"
            description="Only load embed URLs you trust. Narrow iframe sandboxing may block some vendor scripts."
          />
          <Card style={{ marginBottom: 20 }}>
            <Form form={form} layout="vertical" disabled={loading}>
              <Title level={5}>Power BI</Title>
              <Form.Item label="Title" name="powerBiTitle">
                <Input placeholder="Portfolio KPIs" />
              </Form.Item>
              <Form.Item label="Embed URL" name="powerBiUrl">
                <Input placeholder="https://app.powerbi.com/reportEmbed?..." />
              </Form.Item>
              <Title level={5}>Tableau</Title>
              <Form.Item label="Title" name="tableauTitle">
                <Input placeholder="Occupancy dashboard" />
              </Form.Item>
              <Form.Item label="Embed URL" name="tableauUrl">
                <Input placeholder="https://prod-useast-a.online.tableau.com/t/..." />
              </Form.Item>
              <Button type="primary" onClick={save} loading={loading}>
                Save URLs
              </Button>
            </Form>
          </Card>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        {embeds?.powerBi?.embedUrl && (
          <Card title={embeds.powerBi.title || 'Power BI'}>
            <iframe
              title="power-bi"
              src={embeds.powerBi.embedUrl}
              style={{ width: '100%', height: 480, border: 'none', borderRadius: 8 }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </Card>
        )}
        {embeds?.tableau?.embedUrl && (
          <Card title={embeds.tableau.title || 'Tableau'}>
            <iframe
              title="tableau"
              src={embeds.tableau.embedUrl}
              style={{ width: '100%', height: 480, border: 'none', borderRadius: 8 }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </Card>
        )}
      </div>

      {!embeds?.powerBi?.embedUrl && !embeds?.tableau?.embedUrl && (
        <Card>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            {canEdit
              ? 'No embed URLs configured yet. Add URLs above and save.'
              : isFinance
                ? `No Power BI / Tableau embeds for ${selectedTenantName ?? 'this organization'}. Use the built-in finance tools instead:`
                : 'No embed URLs configured yet.'}
          </Paragraph>
          {isFinance && (
            <Space wrap>
              <Link to="/admin/embedded-reports">
                <Button icon={<BarChartOutlined />}>Financial reports</Button>
              </Link>
              <Link to="/admin/revenue-forecast">
                <Button icon={<LineChartOutlined />}>Revenue forecast</Button>
              </Link>
              <Link to="/admin/analytics">
                <Button icon={<LineChartOutlined />}>Analytics</Button>
              </Link>
              <Link to="/admin/export">
                <Button icon={<ExportOutlined />}>Export invoices & payments</Button>
              </Link>
            </Space>
          )}
        </Card>
      )}
    </PageShell>
  );
}
