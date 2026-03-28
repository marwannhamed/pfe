// ─── AuditPage.tsx ────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input, Select, Skeleton, Empty } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { auditApi } from '../../api/services';
import type { AuditLog, AuditAction, AuditSeverity } from '../../types';

const ACTION_META: Record<AuditAction, { label: string; color: string; bg: string }> = {
  CREATE:  { label: 'Create',  color: '#059669', bg: '#f0fdf4' },
  UPDATE:  { label: 'Update',  color: '#2563eb', bg: '#eff6ff' },
  DELETE:  { label: 'Delete',  color: '#dc2626', bg: '#fef2f2' },
  LOGIN:   { label: 'Login',   color: '#6d28d9', bg: '#ede9fe' },
  LOGOUT:  { label: 'Logout',  color: '#475569', bg: '#f1f5f9' },
  APPROVE: { label: 'Approve', color: '#059669', bg: '#f0fdf4' },
  REJECT:  { label: 'Reject',  color: '#dc2626', bg: '#fef2f2' },
};

const SEVERITY_META: Record<AuditSeverity, { label: string; color: string; bg: string }> = {
  INFO:     { label: 'Info',     color: '#2563eb', bg: '#eff6ff' },
  WARNING:  { label: 'Warning',  color: '#d97706', bg: '#fef3c7' },
  ERROR:    { label: 'Error',    color: '#dc2626', bg: '#fef2f2' },
  CRITICAL: { label: 'Critical', color: '#7f1d1d', bg: '#fecaca' },
};

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const CARD: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

export function AuditPage() {
  const [q,       setQ]       = useState('');
  const [action,  setAction]  = useState('');
  const [severity,setSeverity]= useState('');

  const { data: logs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', action, severity],
    queryFn:  () => auditApi.getAll({ ...(action && { action }), ...(severity && { severity }) }).then(r => r.data),
  });

  const filtered = (logs as AuditLog[]).filter(l => {
    if (!q) return true;
    return l.resource_type.toLowerCase().includes(q.toLowerCase()) ||
           l.resource_id.toLowerCase().includes(q.toLowerCase()) ||
           (l.user_id ?? '').toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
      <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Audit Logs</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Track all system actions and changes</p>
          </div>
          <button onClick={() => refetch()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#64748b' }}><ReloadOutlined /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'Total Logs',  value: (logs as AuditLog[]).length,                                           color: '#2563eb', bg: '#eff6ff' },
            { label: 'Today',       value: (logs as AuditLog[]).filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length, color: '#059669', bg: '#f0fdf4' },
            { label: 'Warnings',    value: (logs as AuditLog[]).filter(l => l.severity === 'WARNING').length,     color: '#d97706', bg: '#fffbeb' },
            { label: 'Critical',    value: (logs as AuditLog[]).filter(l => l.severity === 'CRITICAL').length,    color: '#dc2626', bg: '#fef2f2' },
          ].map(s => (
            <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ margin: '0 0 3px', fontSize: 11, color: '#64748b' }}>{s.label}</p>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: s.color }}>{isLoading ? '—' : s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} placeholder="Search by resource or user..." value={q} onChange={e => setQ(e.target.value)} style={{ width: 240, borderRadius: 8 }} />
        <Select value={action || 'all'} onChange={v => setAction(v === 'all' ? '' : v)} style={{ width: 150 }} options={[{ value: 'all', label: 'All Actions' }, ...Object.entries(ACTION_META).map(([v, m]) => ({ value: v, label: m.label }))]} />
        <Select value={severity || 'all'} onChange={v => setSeverity(v === 'all' ? '' : v)} style={{ width: 150 }} options={[{ value: 'all', label: 'All Severity' }, ...Object.entries(SEVERITY_META).map(([v, m]) => ({ value: v, label: m.label }))]} />
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}><strong style={{ color: '#0f172a' }}>{filtered.length}</strong> logs</div>
      </div>

      {isLoading ? (
        <div style={CARD}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ padding: '14px 20px', borderBottom: i < 5 ? '1px solid #f8fafc' : 'none' }}><Skeleton active paragraph={{ rows: 1 }} /></div>)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...CARD, padding: '60px' }}><Empty description="No audit logs found" /></div>
      ) : (
        <div style={{ ...CARD, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.5fr 1.5fr 0.8fr 0.8fr', padding: '11px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Timestamp</span><span>Action</span><span>Resource</span><span>User</span><span>Severity</span><span>IP</span>
          </div>
          {filtered.map((log: AuditLog, i: number) => {
            const am = ACTION_META[log.action]       ?? { label: log.action,    color: '#475569', bg: '#f1f5f9' };
            const sm = SEVERITY_META[log.severity]   ?? { label: log.severity,  color: '#475569', bg: '#f1f5f9' };
            return (
              <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.5fr 1.5fr 0.8fr 0.8fr', padding: '12px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{ fontSize: 12, color: '#374151' }}>{formatDateTime(log.created_at)}</div>
                <span style={{ background: am.bg, color: am.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, display: 'inline-block' }}>{am.label}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{log.resource_type}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{log.resource_id.substring(0, 12)}...</div>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{log.user_id ? log.user_id.substring(0, 12) + '...' : 'System'}</div>
                <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>{sm.label}</span>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{log.ip_address ?? '—'}</div>
              </div>
            );
          })}
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#94a3b8' }}>Showing {filtered.length} of {(logs as AuditLog[]).length} logs</div>
        </div>
      )}
    </div>
  );
}

export default AuditPage;
