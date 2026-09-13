import { useState } from 'react';

function apiErrorMessage(e: unknown, fallback: string): string {
  const err = e as { userMessage?: string; response?: { data?: { message?: string | string[] } } };
  if (err?.userMessage) return err.userMessage;
  const msg = asApiError(err).response?.data?.message;
  if (Array.isArray(msg)) return msg[0] ?? fallback;
  if (typeof msg === 'string' && msg.length) return msg;
  return fallback;
}
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Space, Tag, Typography, Input, Empty, Modal, Select } from 'antd';
import { message, modal } from '../../utils/feedback';

import { CheckOutlined, CloseOutlined, ReloadOutlined, LinkOutlined, CopyOutlined } from '@ant-design/icons';
import { applicationFormsApi, spaceApi, tenantApplicationsApi } from '../../api/services';
import PageShell from '../../components/ui/PageShell';
import { usePageTheme } from '../../hooks/usePageTheme';
import { asApiError } from '../../utils/errors';

const { Text, Paragraph } = Typography;

function toArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray((raw as { data?: T[] })?.data)) return (raw as { data: T[] }).data;
  return [];
}

export default function ApplicationsPage() {
  const { headerCard, t: th } = usePageTheme();
  const qc = useQueryClient();
  const [linkOpen, setLinkOpen] = useState(false);
  const [spaceId, setSpaceId] = useState<string>('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [lastInquiryId, setLastInquiryId] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const { data: spacesRaw } = useQuery({
    queryKey: ['spaces-for-application-link'],
    queryFn: () => spaceApi.getAll(),
  });
  const spaces = toArray<{ id: string; name: string; type: string }>(spacesRaw);

  const simulateSubmit = useMutation({
    mutationFn: () => applicationFormsApi.simulateLocal(lastInquiryId),
    onSuccess: () => {
      message.success('Simulated Typeform submission — check pending applications');
      void qc.invalidateQueries({ queryKey: ['tenant-applications-pending'] });
      setLinkOpen(false);
    },
    onError: (e: unknown) => message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Simulate failed'),
  });

  const createLink = useMutation({
    mutationFn: () => applicationFormsApi.createTypeformInquiry({ space_id: spaceId }).then(r => r.data as { typeform_url: string; inquiry_id: string }),
    onSuccess: d => {
      setGeneratedUrl(d.typeform_url);
      setLastInquiryId(d.inquiry_id);
      message.success('Application link created — share it with prospects');
    },
    onError: (e: unknown) => message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create link'),
  });
  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['tenant-applications-pending'],
    queryFn: () => tenantApplicationsApi.listPending().then((r) => toArray(r.data)),
  });

  const approve = useMutation({
    mutationFn: (id: string) => tenantApplicationsApi.approve(id),
    onMutate: (id) => {
      setApprovingId(id);
    },
    onSuccess: (res) => {
      const d = res.data as {
        password_reset_sent?: boolean;
        user_skipped?: boolean;
        message?: string;
      };
      if (d?.user_skipped) {
        message.warning(
          d.message ??
            'Application approved, but this email is already registered elsewhere — no portal user was created.',
        );
      } else if (d?.password_reset_sent) {
        message.success('Application approved. Applicant received password setup email.');
      } else {
        message.success('Application approved.');
      }
      void qc.invalidateQueries({ queryKey: ['tenant-applications-pending'] });
    },
    onError: (e: unknown) =>
      message.error(
        apiErrorMessage(
          e,
          'Approve failed — this email may already belong to another organization.',
        ),
      ),
    onSettled: () => setApprovingId(null),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      tenantApplicationsApi.reject(id, { reason }),
    onSuccess: () => {
      message.success('Application rejected');
      void qc.invalidateQueries({ queryKey: ['tenant-applications-pending'] });
    },
    onError: (e: unknown) => message.error(apiErrorMessage(e, 'Reject failed')),
  });

  const confirmReject = (id: string) => {
    const reasonRef = { current: '' };
    modal.confirm({
      title: 'Reject this application?',
      content: (
        <Input.TextArea
          rows={3}
          placeholder="Optional reason (internal)"
          onChange={(e) => {
            reasonRef.current = e.target.value;
          }}
        />
      ),
      okText: 'Reject',
      okButtonProps: { danger: true },
      onOk: () => reject.mutateAsync({ id, reason: reasonRef.current || undefined }),
    });
  };

  if (isError) {
    return (
      <PageShell>
        <Text type="danger">Could not load applications.</Text>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()} style={{ marginLeft: 12 }}>
          Retry
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div style={headerCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: th.text }}>Applications</h2>
          <Paragraph style={{ margin: '6px 0 0', color: th.textSub }}>
            Pending tenant applications from Typeform. Approve to activate the organization (TRIAL) and email the applicant a password reset link to access the portal.
          </Paragraph>
        </div>
        <Space>
          <Button type="primary" icon={<LinkOutlined />} onClick={() => { setLinkOpen(true); setGeneratedUrl(''); }}>
            Generate application link
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Refresh
          </Button>
        </Space>
        </div>
      </div>

      <Modal
        title="Tenant application link (Typeform)"
        open={linkOpen}
        onCancel={() => setLinkOpen(false)}
        footer={null}
        width={520}
      >
        <Paragraph type="secondary">
          Select a space, then generate a link. On localhost you can use <strong>Simulate submission</strong> instead of Typeform webhook/ngrok.
        </Paragraph>
        <Select
          style={{ width: '100%', marginBottom: 12 }}
          placeholder="Select space"
          value={spaceId || undefined}
          onChange={v => setSpaceId(v)}
          options={spaces.map(s => ({ value: s.id, label: `${s.name} (${s.type})` }))}
        />
        <Button type="primary" block loading={createLink.isPending} disabled={!spaceId} onClick={() => createLink.mutate()}>
          Generate link
        </Button>
        {generatedUrl && (
          <div style={{ marginTop: 16 }}>
            <Input.TextArea rows={3} value={generatedUrl} readOnly />
            <Button
              icon={<CopyOutlined />}
              style={{ marginTop: 8 }}
              onClick={() => {
                void navigator.clipboard.writeText(generatedUrl);
                message.success('Copied to clipboard');
              }}
            >
              Copy link
            </Button>
            {lastInquiryId && (
              <Button
                block
                style={{ marginTop: 8 }}
                loading={simulateSubmit.isPending}
                onClick={() => simulateSubmit.mutate()}
              >
                Simulate submission (local dev)
              </Button>
            )}
          </div>
        )}
      </Modal>

      {!data?.length && !isLoading ? (
        <Empty description="No pending applications" />
      ) : (
        <Table
          rowKey={(row: { id?: string; contact_email?: string; company_name?: string }) =>
            row.id ?? `${row.contact_email ?? ''}-${row.company_name ?? 'app'}`}
          loading={isLoading}
          dataSource={data ?? []}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Applicant',
              key: 'app',
              render: (_: unknown, row: any) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{row.applicant_tenant?.name ?? row.company_name}</div>
                  <Text type="secondary">{row.applicant_tenant?.contact_email ?? row.contact_email}</Text>
                </div>
              ),
            },
            {
              title: 'Status',
              key: 'st',
              width: 120,
              render: (_: unknown, row: any) => (
                <Tag color="gold">{row.applicant_tenant?.status ?? 'PENDING'}</Tag>
              ),
            },
            {
              title: 'Space',
              key: 'loc',
              render: (_: unknown, row: any) => (
                <div>
                  {row.space?.name && (
                    <Text type="secondary">
                      {row.space.name} ({row.space.type})
                    </Text>
                  )}
                </div>
              ),
            },
            {
              title: 'Documents',
              key: 'docs',
              width: 200,
              render: (_: unknown, row: any) => {
                const docs = row.applicant_tenant?.application_documents as { kind?: string; url?: string }[] | undefined;
                if (!docs?.length) return <Text type="secondary">—</Text>;
                return (
                  <Space orientation="vertical" size={0}>
                    {docs.map((d, i) => (
                      <a key={i} href={d.url} target="_blank" rel="noreferrer">
                        {d.kind || 'File'}
                      </a>
                    ))}
                  </Space>
                );
              },
            },
            {
              title: 'Actions',
              key: 'act',
              width: 220,
              render: (_: unknown, row: any) => (
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckOutlined />}
                    loading={approve.isPending && approvingId === row.id}
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(row.id)}
                  >
                    Approve
                  </Button>
                  <Button
                    danger
                    size="small"
                    icon={<CloseOutlined />}
                    loading={reject.isPending}
                    onClick={() => confirmReject(row.id)}
                  >
                    Reject
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      )}
    </PageShell>
  );
}
