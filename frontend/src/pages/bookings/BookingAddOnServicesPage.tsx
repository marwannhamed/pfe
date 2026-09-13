import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Statistic, Switch, Table, Tag, Tooltip, Typography, Modal } from 'antd';
import { message } from '../../utils/feedback';

import {
  CalendarOutlined,
  CoffeeOutlined,
  DeleteOutlined,
  DollarOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { addonServiceApi, bookingApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { AddOnService, Booking } from '../../types';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const CATEGORIES = ['BEVERAGE', 'PARKING', 'CONNECTIVITY', 'FACILITY', 'SUPPORT', 'OFFICE_EQUIPMENT', 'OTHER'];
const BILLING_CYCLES = ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];

export default function BookingAddOnServicesPage() {
  const { user } = useAuthStore();
  const isBackOffice = ['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(user?.role || '');

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'services' | 'bookings'>('services');
  const [services, setServices] = useState<AddOnService[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [serviceForm] = Form.useForm();
  const [bookingForm] = Form.useForm();

  const normalizeList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [servicesRes, bookingsRes] = await Promise.all([
        addonServiceApi.getAll(),
        bookingApi.getAll(),
      ]);
      setServices(normalizeList(servicesRes.data));
      setBookings(normalizeList(bookingsRes.data));
    } catch {
      message.error('Failed to load booking add-on data');
      setServices([]);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const bookingAddOns = useMemo(() => {
    return bookings.flatMap((booking) => {
      const addOns = Array.isArray(booking?.addOns) ? booking.addOns : [];
      return addOns.map((addOn) => ({
        ...addOn,
        booking_id: booking.id,
        booking_number: booking.booking_number,
        service_name: addOn?.addonService?.name || 'N/A',
      }));
    });
  }, [bookings]);

  const activeServices = services.filter((s) => s?.is_active).length;
  const totalRevenue = bookingAddOns.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0);

  const handleCreateService = () => {
    serviceForm.resetFields();
    serviceForm.setFieldsValue({ is_active: true, is_recurring: true, billing_cycle: 'MONTHLY' });
    setServiceModalVisible(true);
  };

  const handleSubmitService = async (values) => {
    try {
      await addonServiceApi.create({
        ...values,
        tenant_id: values.tenant_id || user?.tenant_id,
      });
      message.success('Add-on service created successfully');
      setServiceModalVisible(false);
      loadData();
    } catch {
      message.error('Failed to create add-on service');
    }
  };

  const handleToggleServiceStatus = async (record) => {
    try {
      if (record.is_active) {
        await addonServiceApi.deactivate(record.id);
      } else {
        await addonServiceApi.activate(record.id);
      }
      message.success('Service status updated');
      loadData();
    } catch {
      message.error('Failed to update service status');
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await addonServiceApi.remove(id);
      message.success('Add-on service deleted successfully');
      loadData();
    } catch {
      message.error('Failed to delete add-on service');
    }
  };

  const handleCreateBookingAddOn = () => {
    bookingForm.resetFields();
    bookingForm.setFieldsValue({ quantity: 1 });
    setBookingModalVisible(true);
  };

  const handleSubmitBookingAddOn = async (values) => {
    try {
      await bookingApi.addAddon(values.booking_id, {
        addon_service_id: values.addon_service_id,
        quantity: values.quantity,
        unit_price: values.unit_price,
      });
      message.success('Booking add-on created successfully');
      setBookingModalVisible(false);
      loadData();
    } catch {
      message.error('Failed to create booking add-on');
    }
  };

  const handleDeleteBookingAddOn = async (record) => {
    try {
      await bookingApi.removeAddon(record.booking_id, record.id);
      message.success('Booking add-on deleted successfully');
      loadData();
    } catch {
      message.error('Failed to delete booking add-on');
    }
  };

  const serviceColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => <Tag>{category || 'N/A'}</Tag>,
    },
    {
      title: 'Price',
      key: 'price',
      render: (record) => <Text strong>${Number(record.price ?? 0).toLocaleString()}</Text>,
    },
    {
      title: 'Cycle',
      dataIndex: 'billing_cycle',
      key: 'billing_cycle',
    },
    {
      title: 'Status',
      key: 'status',
      render: (record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => (
        <Space>
          {isBackOffice && (
            <>
              <Button size="small" onClick={() => handleToggleServiceStatus(record)}>
                {record.is_active ? 'Deactivate' : 'Activate'}
              </Button>
              <Tooltip title="Delete">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteService(record.id)}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  const bookingColumns = [
    {
      title: 'Booking #',
      dataIndex: 'booking_number',
      key: 'booking_number',
      render: (value: string) => <Text style={{ fontFamily: 'monospace' }}>{value || 'N/A'}</Text>,
    },
    {
      title: 'Service',
      dataIndex: 'service_name',
      key: 'service_name',
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
    },
    {
      title: 'Unit Price',
      key: 'unit_price',
      align: 'right' as const,
      render: (record) => `$${Number(record.unit_price ?? 0).toLocaleString()}`,
    },
    {
      title: 'Total',
      key: 'total_price',
      align: 'right' as const,
      render: (record) => <Text strong>${Number(record.total_price ?? 0).toLocaleString()}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => (
        <Space>
          {isBackOffice && (
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteBookingAddOn(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          <CoffeeOutlined style={{ marginRight: 8 }} />
          Booking Add-On Services
        </Title>
        <Button icon={<ReloadOutlined />} onClick={loadData}>
          Refresh
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Total Services" value={services.length} prefix={<CoffeeOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Active Services" value={activeServices} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Add-On Revenue"
              value={totalRevenue}
              prefix={<DollarOutlined />}
              formatter={(value) => `$${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
      </Row>

      {!isBackOffice && (
        <Alert
          title="Limited Access"
          description="You can view add-on services and booking add-ons, but changes require admin roles."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Button
              type={activeTab === 'services' ? 'primary' : 'default'}
              onClick={() => setActiveTab('services')}
              style={{ marginRight: 8 }}
            >
              Add-On Services
            </Button>
            <Button
              type={activeTab === 'bookings' ? 'primary' : 'default'}
              onClick={() => setActiveTab('bookings')}
            >
              Booking Add-Ons
            </Button>
          </div>
          {isBackOffice && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={activeTab === 'services' ? handleCreateService : handleCreateBookingAddOn}
            >
              Create {activeTab === 'services' ? 'Service' : 'Booking Add-On'}
            </Button>
          )}
        </div>

        {activeTab === 'services' ? (
          <Table dataSource={services} columns={serviceColumns} rowKey="id" loading={loading} />
        ) : (
          <Table dataSource={bookingAddOns} columns={bookingColumns} rowKey="id" loading={loading} />
        )}
      </Card>

      <Modal
        title="Create Add-On Service"
        open={serviceModalVisible}
        onCancel={() => setServiceModalVisible(false)}
        footer={null}
      >
        <Form form={serviceForm} layout="vertical" onFinish={handleSubmitService}>
          <Form.Item name="name" label="Service Name" rules={[{ required: true, message: 'Service name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Description is required' }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Category is required' }]}>
                <Select>
                  {CATEGORIES.map((category) => (
                    <Option key={category} value={category}>
                      {category}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="billing_cycle" label="Billing Cycle" rules={[{ required: true, message: 'Billing cycle is required' }]}>
                <Select>
                  {BILLING_CYCLES.map((cycle) => (
                    <Option key={cycle} value={cycle}>
                      {cycle}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="price" label="Price" rules={[{ required: true, message: 'Price is required' }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tenant_id"
                label="Tenant ID"
                rules={[{ required: !user?.tenant_id, message: 'Tenant ID is required' }]}
              >
                <Input placeholder={user?.tenant_id ? `Current: ${user.tenant_id}` : 'Tenant id'} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="is_recurring" label="Recurring" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                Create
              </Button>
              <Button onClick={() => setServiceModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Add Booking Add-On"
        open={bookingModalVisible}
        onCancel={() => setBookingModalVisible(false)}
        footer={null}
      >
        <Form form={bookingForm} layout="vertical" onFinish={handleSubmitBookingAddOn}>
          <Form.Item name="booking_id" label="Booking ID" rules={[{ required: true, message: 'Booking ID is required' }]}>
            <Select showSearch optionFilterProp="label">
              {bookings.map((booking) => (
                <Option
                  key={booking.id}
                  value={booking.id}
                  label={`${booking.booking_number || booking.id} (${booking.status || 'N/A'})`}
                >
                  {booking.booking_number || booking.id}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="addon_service_id"
            label="Add-On Service"
            rules={[{ required: true, message: 'Add-on service is required' }]}
          >
            <Select showSearch optionFilterProp="label">
              {services
                .filter((service) => service.is_active)
                .map((service) => (
                  <Option
                    key={service.id}
                    value={service.id}
                    label={`${service.name} ($${Number(service.price ?? 0).toLocaleString()})`}
                  >
                    {service.name}
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="quantity" label="Quantity" rules={[{ required: true, message: 'Quantity is required' }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit_price" label="Unit Price" rules={[{ required: true, message: 'Unit price is required' }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                Add
              </Button>
              <Button onClick={() => setBookingModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
