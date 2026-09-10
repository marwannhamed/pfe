import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Space, Form, Input, InputNumber, Select, DatePicker, Typography, Row, Col, Statistic, Alert, Tag, Tooltip, Divider, Empty, Skeleton, Modal } from 'antd';
import { message } from '../../utils/feedback';
import {
  PlusOutlined,
  DeleteOutlined,
  FileTextOutlined,
  DollarOutlined,
  CalendarOutlined,
  PercentageOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { useMutation, useQuery } from '@tanstack/react-query';
import { billingApi } from '../../api/services';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
type InvoiceLine = {
  id: string;
  invoice_id: string;
  invoice_number: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
  due_date?: string;
  status?: string;
};

export default function InvoiceLineItemsPage() {
  const { user } = useAuthStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const isBackOffice = ['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(user?.role || '');
  const canManage = isBackOffice;
  const tenantId = (user as any)?.tenant_id;

  const { data: invoicesRaw, isLoading, isError, refetch } = useQuery({
    queryKey: ['invoice-line-items-live', canManage ? 'all' : tenantId],
    queryFn: () =>
      billingApi
        .getInvoices(canManage ? {} : { tenantId })
        .then((res) => res.data),
  });

  const invoices = useMemo(() => {
    if (!Array.isArray(invoicesRaw)) return [];
    return invoicesRaw;
  }, [invoicesRaw]);

  const lineItems: InvoiceLine[] = useMemo(() => {
    return invoices.flatMap((invoice: any) => {
      const lines = Array.isArray(invoice?.lines) ? invoice.lines : [];
      return lines.map((line: any, lineIndex: number) => ({
        id: line.id ?? `${invoice.id}-line-${lineIndex}`,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        description: line.description,
        quantity: Number(line.quantity ?? 0),
        unit_price: Number(line.unit_price ?? 0),
        tax_rate: Number(line.tax_rate ?? 0),
        line_total: Number(line.line_total ?? 0),
        due_date: invoice.due_date,
        status: invoice.status,
      }));
    });
  }, [invoices]);

  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      billingApi.addInvoiceLine(payload.invoiceId, {
        description: payload.description,
        quantity: payload.quantity,
        unit_price: payload.unitPrice,
        tax_rate: payload.taxRate ?? 0,
      }),
    onSuccess: () => {
      message.success('Invoice line item created successfully');
      setModalVisible(false);
      form.resetFields();
      refetch();
    },
    onError: () => {
      message.error('Failed to create invoice line item');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (payload: { invoiceId: string; lineId: string }) =>
      billingApi.removeInvoiceLine(payload.invoiceId, payload.lineId),
    onSuccess: () => {
      message.success('Invoice line item deleted successfully');
      refetch();
    },
    onError: () => {
      message.error('Failed to delete invoice line item');
    },
  });

  const handleCreate = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    createMutation.mutate(values);
  };

  const handleDelete = async (item: InvoiceLine) => {
    deleteMutation.mutate({ invoiceId: item.invoice_id, lineId: item.id });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'default',
      SENT: 'blue',
      PAID: 'green',
      PARTIALLY_PAID: 'orange',
      OVERDUE: 'red',
      CANCELLED: 'default',
    };
    return colors[status] || 'default';
  };

  const columns = [
    {
      title: 'Invoice',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (invoiceNumber: string) => (
        <Text strong style={{ fontFamily: 'monospace' }}>{invoiceNumber}</Text>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Type',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
    },
    {
      title: 'Unit Price',
      dataIndex: 'unit_price',
      key: 'unit_price',
      align: 'right' as const,
      render: (price: number) => `$${price.toLocaleString()}`,
    },
    {
      title: 'Tax Rate %',
      dataIndex: 'tax_rate',
      key: 'tax_rate',
      align: 'right' as const,
    },
    {
      title: 'Total',
      dataIndex: 'line_total',
      key: 'line_total',
      align: 'right' as const,
      render: (total: number) => (
        <Text strong>${total.toLocaleString()}</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {(status || 'UNKNOWN').replace('_', ' ')}
        </Tag>
      ),
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (date?: string) => (date ? String(date).split('T')[0] : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: InvoiceLine) => (
        <Space>
          {canManage && (
            <>
              <Tooltip title="Delete">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record)}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  const totalRevenue = lineItems
    .filter(item => item.status === 'PAID')
    .reduce((sum, item) => sum + item.line_total, 0);

  const pendingRevenue = lineItems
    .filter(item => ['DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID'].includes(item.status || ''))
    .reduce((sum, item) => sum + item.line_total, 0);

  const overdueAmount = lineItems
    .filter(item => item.status === 'OVERDUE')
    .reduce((sum, item) => sum + item.line_total, 0);

  const totalTax = lineItems.reduce((sum, item) => {
    const subtotal = item.quantity * item.unit_price;
    return sum + (subtotal * item.tax_rate) / 100;
  }, 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          Invoice Line Items
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
          {canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              Add Line Item
            </Button>
          )}
        </Space>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Total Line Items"
              value={lineItems.length}
              prefix={<FileTextOutlined />}
              styles={{ content: { color: '#3f8600'  } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Paid Revenue"
              value={totalRevenue}
              prefix={<DollarOutlined />}
              styles={{ content: { color: '#1890ff'  } }}
              formatter={(value) => `$${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Pending Revenue"
              value={pendingRevenue}
              prefix={<CalendarOutlined />}
              styles={{ content: { color: '#fa8c16'  } }}
              formatter={(value) => `$${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Overdue Amount"
              value={overdueAmount}
              prefix={<PercentageOutlined />}
              styles={{ content: { color: '#cf1322'  } }}
              formatter={(value) => `$${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Estimated Tax Amount"
              value={totalTax}
              prefix={<PercentageOutlined />}
              styles={{ content: { color: '#722ed1'  } }}
              formatter={(value) => `$${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Average Line Item Value"
              value={lineItems.length > 0 ? totalRevenue / lineItems.length : 0}
              prefix={<DollarOutlined />}
              styles={{ content: { color: '#52c41a'  } }}
              formatter={(value) => `$${Number(value).toFixed(2)}`}
            />
          </Card>
        </Col>
      </Row>

      {!isBackOffice && (
        <Alert
          title="Limited Access"
          description="You can view invoice line items but need admin privileges to create or edit them."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : isError ? (
          <Alert type="error" showIcon title="Failed to load invoice line items" />
        ) : lineItems.length === 0 ? (
          <Empty description="No line items found" />
        ) : (
          <Table
            columns={columns}
            dataSource={lineItems}
            rowKey={(record) => record.id}
            loading={isLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} line items`,
            }}
            summary={(pageData) => {
              const totalAmount = pageData.reduce((sum, item) => sum + item.line_total, 0);
              return (
                <Table.Summary>
                  <Table.Summary.Row key="page-total">
                    <Table.Summary.Cell index={0} colSpan={5}>
                      <Text strong>Page Total</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5}>
                      <Text strong>${totalAmount.toLocaleString()}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6} colSpan={3} />
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        title="Add Line Item"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ quantity: 1, taxRate: 0 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="invoiceId"
                label="Invoice ID"
                rules={[{ required: true, message: 'Please enter invoice ID' }]}
              >
                <Select placeholder="Select invoice">
                  {invoices.map((invoice: any) => (
                    <Option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="taxRate"
                label="Tax Rate (%)"
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <TextArea rows={2} placeholder="Detailed description..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="quantity"
                label="Quantity"
                rules={[{ required: true, message: 'Please enter quantity' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="unitPrice"
                label="Unit Price ($)"
                rules={[{ required: true, message: 'Please enter unit price' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Add
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
