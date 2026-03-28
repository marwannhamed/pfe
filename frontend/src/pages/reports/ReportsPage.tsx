import { useQuery } from '@tanstack/react-query';
import { Skeleton, Empty } from 'antd';
import { ReloadOutlined, DownloadOutlined, BarChartOutlined } from '@ant-design/icons';
import { reportApi, billingApi, siteApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';

const REPORT_TYPES = [
  { type: 'OCCUPANCY_RATE',     label: 'Occupancy Rate',      icon: '🏢', desc: 'Space utilization across all sites', color: '#2563eb', bg: '#eff6ff' },
  { type: 'REVENUE_BY_SITE',    label: 'Revenue by Site',     icon: '💰', desc: 'Financial performance per location',  color: '#059669', bg: '#f0fdf4' },
  { type: 'BOOKING_ANALYTICS',  label: 'Booking Analytics',   icon: '📅', desc: 'Booking trends and patterns',         color: '#7c3aed', bg: '#f5f3ff' },
  { type: 'PAYMENT_STATUS',     label: 'Payment Status',      icon: '💳', desc: 'Invoice and payment overview',         color: '#d97706', bg: '#fffbeb' },
  { type: 'MAINTENANCE_SUMMARY',label: 'Maintenance Summary', icon: '🔧', desc: 'Ticket resolution and costs',          color: '#dc2626', bg: '#fef2f2' },
  { type: 'FINANCIAL_SUMMARY',  label: 'Financial Summary',   icon: '📊', desc: 'Complete financial overview',          color: '#0369a1', bg: '#f0f9ff' },
];

const CARD: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

export default function ReportsPage() {
  const { user } = useAuthStore();
  const tenantId = user?.tenant_id ?? '';

  const { data: reports = [], isLoading: loadingReports, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn:  () => reportApi.getAll().then(r => r.data),
  });

  const { data: summary } = useQuery({
    queryKey: ['financial-summary-reports'],
    queryFn:  () => billingApi.getFinancialSummary(tenantId || undefined).then(r => r.data),
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['sites-reports'],
    queryFn:  () => siteApi.getAll().then(r => r.data),
  });

  const totalSites   = (sites as any[]).length;
  const totalRevenue = summary?.total_paid     ?? 0;
  const totalOverdue = summary?.total_overdue  ?? 0;

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Reports & Analytics</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Generate and view platform performance reports</p>
          </div>
          <button onClick={() => refetch()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#64748b' }}><ReloadOutlined /></button>
        </div>

        {/* Live summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[
            { label: 'Active Sites',     value: totalSites,                               color: '#2563eb', bg: '#eff6ff', icon: '🏢' },
            { label: 'Revenue Collected',value: `$${Number(totalRevenue).toLocaleString()}`,color: '#059669', bg: '#f0fdf4', icon: '💰' },
            { label: 'Overdue Amount',   value: `$${Number(totalOverdue).toLocaleString()}`,color: '#dc2626', bg: '#fef2f2', icon: '⚠️' },
            { label: 'Reports Generated',value: (reports as any[]).length,                 color: '#7c3aed', bg: '#f5f3ff', icon: '📊' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 11, color: '#64748b' }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</p>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Report type cards */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 14 }}>Available Reports</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {REPORT_TYPES.map(rt => (
            <div
              key={rt.type}
              style={{ ...CARD, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: rt.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {rt.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>{rt.label}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>{rt.desc}</div>
                  <button
                    style={{ width: '100%', padding: '8px', borderRadius: 8, background: rt.bg, border: `1px solid ${rt.color}33`, color: rt.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <DownloadOutlined /> Generate Report
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generated reports history */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 14 }}>Generated Reports History</div>
        {loadingReports ? (
          <div style={CARD}>{Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ padding: '14px 20px', borderBottom: i < 2 ? '1px solid #f8fafc' : 'none' }}><Skeleton active paragraph={{ rows: 1 }} /></div>)}</div>
        ) : (reports as any[]).length === 0 ? (
          <div style={{ ...CARD, padding: '48px', textAlign: 'center' }}>
            <BarChartOutlined style={{ fontSize: 40, color: '#e5e7eb', display: 'block', margin: '0 auto 14px' }} />
            <Empty description="No reports generated yet. Click 'Generate Report' above to create one." />
          </div>
        ) : (
          <div style={{ ...CARD, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.8fr', padding: '11px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>Title</span><span>Type</span><span>Format</span><span>Generated</span><span>Actions</span>
            </div>
            {(reports as any[]).map((r: any, i: number) => {
              const rt = REPORT_TYPES.find(t => t.type === r.report_type);
              return (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.8fr', padding: '13px 20px', borderBottom: i < (reports as any[]).length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{r.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
                    <span>{rt?.icon ?? '📊'}</span> {rt?.label ?? r.report_type}
                  </div>
                  <span style={{ background: '#f1f5f9', color: '#475569', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>{r.format}</span>
                  <div style={{ fontSize: 12, color: '#374151' }}>{new Date(r.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {r.file_url && (
                      <a href={r.file_url} download style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                        <DownloadOutlined style={{ fontSize: 12, color: '#64748b' }} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
