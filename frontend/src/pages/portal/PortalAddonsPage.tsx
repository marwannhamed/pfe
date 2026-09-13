import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Col, Empty, Row, Table, Tag,
} from 'antd';
import { message } from '../../utils/feedback';
import { ReloadOutlined, ShoppingOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { addonServiceApi, bookingApi } from '../../api/services';
import { mapBooking } from '../../utils/booking';
import { PORTAL_MAP_PATH } from '../../constants/routes';
import PageHeader from '../../components/ui/PageHeader';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';
import type { AddOnService, Booking } from '../../types';

type TabKey = 'catalog' | 'bookings';

const normalizeList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
};

const CATEGORY_LABELS: Record<string, string> = {
  OFFICE_EQUIPMENT: 'Equipment',
  CATERING: 'Catering',
  CLEANING: 'Cleaning',
  IT_SERVICE: 'IT',
  SECURITY: 'Security',
  TRANSPORTATION: 'Transport',
  BEVERAGE: 'Beverage',
  PARKING: 'Parking',
  OTHER: 'Other',
};

export default function PortalAddonsPage() {
  const navigate = useNavigate();
  const { t: th, card, ..._s } = usePageTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('catalog');
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<AddOnService[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [svcRes, bookRes] = await Promise.all([
        addonServiceApi.getActive(),
        bookingApi.getAll(),
      ]);
      setServices(normalizeList(svcRes.data));
      setBookings(normalizeList(bookRes.data).map(mapBooking));
    } catch {
      message.error('Failed to load add-ons');
      setServices([]);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const myBookingAddons = useMemo(() => bookings.flatMap((booking) => {
    const addOns = Array.isArray(booking.addOns) ? booking.addOns : [];
    return addOns.map((addOn) => ({
      ...addOn,
      booking_id: booking.id,
      booking_number: booking.booking_number,
      service_name: addOn?.addonService?.name ?? 'Add-on',
      line_total: Number(addOn.quantity ?? 1) * Number(addOn.unit_price ?? 0),
    }));
  }), [bookings]);

  const totalAddonsCost = myBookingAddons.reduce((sum, row) => sum + row.line_total, 0);

  const addonColumns = [
    { title: 'Booking', dataIndex: 'booking_number', key: 'booking_number' },
    { title: 'Service', dataIndex: 'service_name', key: 'service_name' },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 70 },
    {
      title: 'Unit price',
      key: 'unit_price',
      render: (_: unknown, r: any) => `$${Number(r.unit_price ?? 0).toFixed(2)}`,
    },
    {
      title: 'Line total',
      key: 'line_total',
      render: (_: unknown, r: any) => `$${Number(r.line_total ?? 0).toFixed(2)}`,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Add-on Services"
        subtitle="Browse optional services. Select them when you create a booking — space rental and services appear together on one invoice."
        actions={<Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="Add services during booking"
        description="Optional services are chosen on the map when you book a space. They are attached automatically to that booking."
        action={
          <Button size="small" type="primary" onClick={() => navigate(PORTAL_MAP_PATH)}>
            Open map
          </Button>
        }
      />

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Button type={activeTab === 'catalog' ? 'primary' : 'default'} icon={<ShoppingOutlined />} onClick={() => setActiveTab('catalog')}>
          Service catalog
        </Button>
        <Button type={activeTab === 'bookings' ? 'primary' : 'default'} icon={<UnorderedListOutlined />} onClick={() => setActiveTab('bookings')}>
          My booking add-ons ({myBookingAddons.length})
        </Button>
      </div>

      {activeTab === 'catalog' && (
        services.length === 0 && !loading ? (
          <div style={{ ...card, padding: 40, textAlign: 'center' }}>
            <Empty description="No active add-on services yet" />
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {services.map((svc) => (
              <Col xs={24} sm={12} lg={8} key={svc.id}>
                <div style={{ ...card, padding: 18, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: th.text }}>{svc.name}</div>
                    <Tag color="blue">{CATEGORY_LABELS[svc.category] ?? svc.category ?? 'Service'}</Tag>
                  </div>
                  <div style={{ fontSize: 13, color: th.textSub, flex: 1 }}>{svc.description || 'No description'}</div>
                  <div style={{ marginTop: 14, fontSize: 20, fontWeight: 800, color: '#2563eb' }}>
                    ${Number(svc.price ?? 0).toFixed(2)}
                    <span style={{ fontSize: 12, fontWeight: 400, color: th.textMuted, marginLeft: 6 }}>
                      / {String(svc.billing_cycle ?? 'unit').toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        )
      )}

      {activeTab === 'bookings' && (
        <>
          {myBookingAddons.length > 0 && (
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
              title={`${myBookingAddons.length} add-on(s) on your bookings`}
              description={`Add-on total: $${totalAddonsCost.toFixed(2)} — combined with space rental on your billing invoice.`}
            />
          )}
          <div style={{ ...card, padding: 8 }}>
            <Table
              rowKey="id"
              loading={loading}
              dataSource={myBookingAddons}
              columns={addonColumns}
              locale={{
                emptyText: (
                  <Empty description="No add-ons yet — select services when you book on the map">
                    <Button type="primary" onClick={() => navigate(PORTAL_MAP_PATH)}>
                      Open map
                    </Button>
                  </Empty>
                ),
              }}
              pagination={{ pageSize: 8 }}
            />
          </div>
        </>
      )}
    </PageShell>
  );
}
