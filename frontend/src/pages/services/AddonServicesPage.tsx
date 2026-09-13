import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Col, Empty, Form, Input, InputNumber, Modal, Popconfirm,
  Row, Select, Space, Switch, Table, Tag,
} from 'antd';
import { message } from '../../utils/feedback';
import {
  DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined,
  ShopOutlined, UnorderedListOutlined, CheckCircleOutlined, PauseCircleOutlined,
} from '@ant-design/icons';
import { addonServiceApi, bookingApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { usePageTheme } from '../../hooks/usePageTheme';
import PageShell from '../../components/ui/PageShell';

const { TextArea } = Input;

const CATEGORIES = [
  { value: 'OFFICE_EQUIPMENT', label: 'Equipment' },
  { value: 'CATERING', label: 'Catering' },
  { value: 'PARKING', label: 'Parking' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'IT_SERVICE', label: 'IT Support' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'TRANSPORTATION', label: 'Transport' },
  { value: 'OTHER', label: 'Other' },
];

const BILLING_CYCLES = [
  { value: 'HOURLY', label: 'Per hour' },
  { value: 'DAILY', label: 'Per day' },
  { value: 'MONTHLY', label: 'Per month' },
];

const CATEGORY_COLORS: Record<string, string> = {
  CATERING: 'orange',
  PARKING: 'geekblue',
  IT_SERVICE: 'blue',
  CLEANING: 'green',
  OFFICE_EQUIPMENT: 'purple',
  SECURITY: 'red',
  TRANSPORTATION: 'cyan',
  OTHER: 'default',
};

type TabKey = 'catalog' | 'bookings';

const normalizeList = (payload: unknown): any[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: any[] }).data;
  }
  return [];
};

function cycleLabel(cycle: string) {
  return BILLING_CYCLES.find((c) => c.value === cycle)?.label ?? cycle;
}

export default function AddonServicesPage() {
  const { user } = useAuthStore();
  const { card: CARD, t: th } = usePageTheme();
  const isBackOffice = ['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER'].includes(user?.role || '');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<TabKey>('catalog');
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceForm] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [servicesRes, bookingsRes] = await Promise.all([
        addonServiceApi.getAll({
          ...(isSuperAdmin ? {} : { tenantId: user?.tenant_id }),
          limit: 100,
        }),
        bookingApi.getAll(),
      ]);
      setServices(normalizeList(servicesRes.data));
      setBookings(normalizeList(bookingsRes.data));
    } catch {
      message.error('Failed to load add-on data');
      setServices([]);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, user?.tenant_id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!serviceModalOpen) return;
    if (editingService) {
      serviceForm.setFieldsValue({
        name: editingService.name,
        description: editingService.description,
        category: editingService.category,
        price: Number(editingService.price || 0),
        billing_cycle: editingService.billing_cycle || 'MONTHLY',
        is_active: editingService.is_active ?? true,
      });
    } else {
      serviceForm.setFieldsValue({
        billing_cycle: 'MONTHLY',
        is_active: true,
      });
    }
  }, [serviceModalOpen, editingService, serviceForm]);

  const stats = useMemo(() => {
    const active = services.filter((svc) => svc.is_active !== false).length;
    return { total: services.length, active, inactive: services.length - active };
  }, [services]);

  const bookingAddOns = useMemo(() => bookings.flatMap((booking: any) => {
    const addOns = Array.isArray(booking?.addOns) ? booking.addOns : [];
    return addOns.map((addOn: any) => ({
      ...addOn,
      booking_id: booking.id,
      booking_number: booking.booking_number,
      service_name: addOn?.addonService?.name || '—',
      line_total: Number(addOn.quantity ?? 0) * Number(addOn.unit_price ?? 0),
    }));
  }), [bookings]);

  const bookingRevenue = bookingAddOns.reduce((sum, item) => sum + item.line_total, 0);

  const openCreateModal = () => {
    setEditingService(null);
    setServiceModalOpen(true);
  };

  const openEditModal = (record: any) => {
    setEditingService(record);
    setServiceModalOpen(true);
  };

  const closeServiceModal = () => {
    setServiceModalOpen(false);
    setEditingService(null);
    serviceForm.resetFields();
  };

  const handleSubmitService = async (values: any) => {
    const payload = {
      name: values.name,
      description: values.description,
      category: values.category,
      price: Number(values.price),
      currency: 'USD',
      billing_cycle: values.billing_cycle,
      is_recurring: values.billing_cycle !== 'HOURLY' && values.billing_cycle !== 'DAILY',
      is_active: values.is_active ?? true,
    };
    try {
      if (editingService) {
        await addonServiceApi.update(editingService.id, payload);
        message.success('Service updated');
      } else {
        await addonServiceApi.create(payload);
        message.success('Service published — tenants can add it when booking');
      }
      closeServiceModal();
      loadData();
    } catch (err: any) {
      const m = err?.response?.data?.message ?? err?.userMessage;
      message.error(Array.isArray(m) ? m[0] : (m || 'Failed to save service'));
    }
  };

  const handleToggleActive = async (record: any) => {
    try {
      if (record.is_active) await addonServiceApi.deactivate(record.id);
      else await addonServiceApi.activate(record.id);
      message.success(record.is_active ? 'Service unpublished' : 'Service published');
      loadData();
    } catch {
      message.error('Failed to update status');
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await addonServiceApi.remove(id);
      message.success('Service deleted');
      loadData();
    } catch {
      message.error('Failed to delete service');
    }
  };

  const bookingColumns = [
    {
      title: 'Booking',
      dataIndex: 'booking_number',
      key: 'booking_number',
      render: (v: string) => <span style={{ fontFamily: 'monospace', color: th.text }}>{v || '—'}</span>,
    },
    { title: 'Service', dataIndex: 'service_name', key: 'service_name' },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', align: 'right' as const },
    {
      title: 'Unit price',
      key: 'unit_price',
      align: 'right' as const,
      render: (_: unknown, r: any) => `$${Number(r.unit_price ?? 0).toFixed(2)}`,
    },
    {
      title: 'Total',
      key: 'line_total',
      align: 'right' as const,
      render: (_: unknown, r: any) => (
        <span style={{ fontWeight: 700, color: th.text }}>${Number(r.line_total ?? 0).toFixed(2)}</span>
      ),
    },
  ];

  if (!isBackOffice) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" showIcon title="Access denied" description="Admin access required." />
      </div>
    );
  }

  const tabBtn = (key: TabKey, label: string, icon: React.ReactNode) => (
    <button
      key={key}
      onClick={() => setActiveTab(key)}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        border: `1px solid ${activeTab === key ? '#2563eb' : th.cardBorder}`,
        background: activeTab === key ? '#eff6ff' : th.cardBg,
        color: activeTab === key ? '#2563eb' : th.textSub,
        fontSize: 13,
        fontWeight: activeTab === key ? 600 : 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {icon} {label}
    </button>
  );

  return (
    <PageShell>

      {/* Header */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: th.text }}>Add-on Services</h2>
            <p style={{ margin: 0, color: th.textSub, fontSize: 14, maxWidth: 560 }}>
              Publish optional services (catering, equipment, parking…). Tenants select them when booking a space — everything appears on one invoice.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={loadData}
              style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${th.cardBorder}`, background: th.cardBg, cursor: 'pointer', fontSize: 13, color: th.text, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ReloadOutlined /> Refresh
            </button>
            {activeTab === 'catalog' && (
              <button
                onClick={openCreateModal}
                style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}
              >
                <PlusOutlined /> Publish service
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { label: 'Published', value: stats.active, color: '#15803d' },
            { label: 'Unpublished', value: stats.inactive, color: '#b45309' },
            { label: 'Total catalog', value: stats.total, color: th.text },
            { label: 'Add-on revenue', value: `$${bookingRevenue.toLocaleString()}`, color: '#2563eb' },
          ].map((stat) => (
            <div key={stat.label} style={{ background: th.tableHead, borderRadius: 10, padding: '12px 16px', border: `1px solid ${th.cardBorder}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, marginTop: 2 }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs + content */}
      <div style={{ ...CARD, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {tabBtn('catalog', 'Service catalog', <ShopOutlined />)}
          {tabBtn('bookings', `Booking add-ons (${bookingAddOns.length})`, <UnorderedListOutlined />)}
        </div>

        {activeTab === 'catalog' && (
          loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: th.textMuted }}>Loading…</div>
          ) : services.length === 0 ? (
            <Empty
              description="No services published yet"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>Publish your first service</Button>
            </Empty>
          ) : (
            <Row gutter={[16, 16]}>
              {services.map((svc) => (
                <Col xs={24} sm={12} lg={8} xl={6} key={svc.id}>
                  <div style={{
                    border: `1px solid ${svc.is_active !== false ? '#bfdbfe' : th.cardBorder}`,
                    borderRadius: 12,
                    padding: 16,
                    background: svc.is_active !== false ? (th.cardBg) : th.tableHead,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'box-shadow 0.15s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: th.text, lineHeight: 1.3 }}>{svc.name}</div>
                      <Tag color={svc.is_active !== false ? 'success' : 'default'} style={{ margin: 0, flexShrink: 0 }}>
                        {svc.is_active !== false ? 'Live' : 'Draft'}
                      </Tag>
                    </div>
                    <Tag color={CATEGORY_COLORS[svc.category] ?? 'default'} style={{ marginBottom: 8, alignSelf: 'flex-start' }}>
                      {CATEGORIES.find((c) => c.value === svc.category)?.label ?? svc.category}
                    </Tag>
                    <p style={{ fontSize: 13, color: th.textSub, margin: '0 0 12px', flex: 1, lineHeight: 1.5 }}>
                      {svc.description || 'No description'}
                    </p>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', marginBottom: 14 }}>
                      ${Number(svc.price ?? 0).toFixed(2)}
                      <span style={{ fontSize: 12, fontWeight: 400, color: th.textMuted, marginLeft: 6 }}>
                        {cycleLabel(svc.billing_cycle)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${th.cardBorder}`, paddingTop: 12 }}>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(svc)} style={{ flex: 1 }}>
                        Edit
                      </Button>
                      <Button
                        size="small"
                        icon={svc.is_active !== false ? <PauseCircleOutlined /> : <CheckCircleOutlined />}
                        onClick={() => handleToggleActive(svc)}
                        style={{ flex: 1 }}
                      >
                        {svc.is_active !== false ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Popconfirm title="Delete this service?" onConfirm={() => handleDeleteService(svc.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          )
        )}

        {activeTab === 'bookings' && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title="Selected by tenants during booking"
              description="Add-ons appear here automatically when a tenant chooses optional services while creating a booking. You do not attach them manually."
            />
            <Table
              rowKey="id"
              dataSource={bookingAddOns}
              columns={bookingColumns}
              loading={loading}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: <Empty description="No add-ons on bookings yet — tenants pick services in the New Booking flow" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </>
        )}
      </div>

      {/* Create / edit service */}
      <Modal
        title={editingService ? 'Edit service' : 'Publish a new service'}
        open={serviceModalOpen}
        onCancel={closeServiceModal}
        footer={null}
        width={560}
        destroyOnHidden
      >
        {!editingService && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title="Published under your organization"
            description="Tenants will see this service when booking a space. No tenant ID needed."
          />
        )}
        <Form form={serviceForm} layout="vertical" onFinish={handleSubmitService} requiredMark="optional">
          <Form.Item name="name" label="Service name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Meeting room catering" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Category is required' }]}>
                <Select placeholder="Select category" options={CATEGORIES} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="billing_cycle" label="Billing cycle" rules={[{ required: true }]}>
                <Select options={BILLING_CYCLES} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Description is required' }]}>
            <TextArea rows={3} placeholder="What is included in this service?" />
          </Form.Item>
          <Form.Item name="price" label="Price (USD)" rules={[{ required: true, message: 'Price is required' }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="is_active" label="Publish immediately" valuePropName="checked">
            <Switch checkedChildren="Live" unCheckedChildren="Draft" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={closeServiceModal}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                {editingService ? 'Save changes' : 'Publish service'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </PageShell>
  );
}
