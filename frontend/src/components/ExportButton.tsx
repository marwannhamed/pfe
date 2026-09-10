import { useState } from 'react';
import { message } from '../utils/feedback';
import { DownloadOutlined, LoadingOutlined, FileExcelOutlined, FileTextOutlined } from '@ant-design/icons';
import { api } from '../api/client';

interface ExportButtonProps {
  // Which endpoint to call: 'bookings' | 'invoices' | 'payments' | 'tenants' | 'spaces' | 'maintenance'
  endpoint: string;
  // Extra query params e.g. { tenantId: 'xxx', from: '2026-01-01', to: '2026-12-31' }
  params?:  Record<string, string>;
  label?:   string;
  size?:    'small' | 'default';
}

export default function ExportButton({ endpoint, params = {}, label = 'Export', size = 'default' }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  const download = async (format: 'xlsx' | 'csv') => {
    setOpen(false);
    setLoading(true);
    try {
      const query = new URLSearchParams({ format, ...params }).toString();
      const response = await api.get(`/export/${endpoint}?${query}`, { responseType: 'blob' });

      const ext      = format === 'xlsx' ? 'xlsx' : 'csv';
      const filename = `${endpoint}_${new Date().toISOString().slice(0, 10)}.${ext}`;

      const blob = new Blob([response.data], {
        type: format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
      });

      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      message.success(`${format.toUpperCase()} downloaded!`);
    } catch {
      message.error('Export failed — please try again');
    } finally {
      setLoading(false);
    }
  };

  const isSmall = size === 'small';
  const h = isSmall ? 28 : 34;

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Main button */}
      <button
        disabled={loading}
        onClick={() => setOpen(o => !o)}
        style={{ height: h, padding: isSmall ? '0 10px' : '0 14px', borderRadius: '8px 0 0 8px', border: '1px solid #e5e7eb', borderRight: 'none', background: loading ? '#f8fafc' : '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: isSmall ? 12 : 13, fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
      >
        {loading ? <LoadingOutlined style={{ fontSize: 13 }} /> : <DownloadOutlined style={{ fontSize: 13 }} />}
        {label}
      </button>

      {/* Chevron trigger */}
      <button
        disabled={loading}
        onClick={() => setOpen(o => !o)}
        style={{ height: h, width: isSmall ? 24 : 28, borderRadius: '0 8px 8px 0', border: '1px solid #e5e7eb', background: open ? '#f1f5f9' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#94a3b8' }}
      >
        {open ? '▲' : '▼'}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 99, minWidth: 160, overflow: 'hidden' }}>
            <button
              onClick={() => download('xlsx')}
              style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <FileExcelOutlined style={{ fontSize: 16, color: '#15803d' }} />
              <div>
                <div style={{ fontWeight: 600 }}>Excel (.xlsx)</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Styled spreadsheet</div>
              </div>
            </button>
            <div style={{ height: 1, background: '#f1f5f9' }} />
            <button
              onClick={() => download('csv')}
              style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <FileTextOutlined style={{ fontSize: 16, color: '#2563eb' }} />
              <div>
                <div style={{ fontWeight: 600 }}>CSV (.csv)</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Plain text, any app</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}