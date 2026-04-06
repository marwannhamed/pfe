import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import {
  FileTextOutlined, CloseOutlined, LoadingOutlined,
  ReloadOutlined, WarningOutlined, CheckCircleOutlined,
  ClockCircleOutlined, SearchOutlined, BellOutlined,
} from '@ant-design/icons';
import { contractApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toArray<T>(raw: any): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 14,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
};
const INPUT: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 9,
  fontSize: 13, color: '#0f172a', outline: 'none',
  background: '#fff', boxSizing: 'border-box',
};

// ─── Urgency config ───────────────────────────────────────────────────────────
function getUrgency(days: number): {
  label: string; color: string; bg: string;
  border: string; icon: React.ReactNode; pulse: boolean;
} {
  if (days <= 0)   return { label: 'Expired',      color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', icon: <CloseOutlined />,         pulse: false };
  if (days <= 7)   return { label: 'Critical',     color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5', icon: <WarningOutlined />,        pulse: true  };
  if (days <= 30)  return { label: 'Urgent',       color: '#dc2626', bg: '#fff5f5', border: '#fecaca', icon: <WarningOutlined />,        pulse: true  };
  if (days <= 60)  return { label: 'Soon',         color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: <ClockCircleOutlined />,    pulse: false };
  if (days <= 90)  return { label: 'Upcoming',     color: '#92400e', bg: '#fefce8', border: '#fef08a', icon: <ClockCircleOutlined />,    pulse: false };
  return           { label: 'Active',             color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: <CheckCircleOutlined />,   pulse: false };
}

// ─── Renew Modal ──────────────────────────────────────────────────────────────
function RenewModal({ contract, onClose }: { contract: any; onClose: () => void }) {
  const qc       = useQueryClient();
  const days     = daysUntil(contract.end_date);
  const urgency  = getUrgency(days);

  const defaultNewEnd = addMonths(contract.end_date, 12);
  const [newEndDate, setNewEndDate] = useState(defaultNewEnd);
  const [note,       setNote]       = useState('');
  const [errors,     setErrors]     = useState<Record<string, string>>({});

  const renewMut = useMutation({
    mutationFn: () => contractApi.renew(contract.id, new Date(newEndDate).toISOString()),
    onSuccess: () => {
      message.success(`Contract ${contract.contract_number} renewed until ${formatDate(newEndDate)}! ✅`);
      qc.invalidateQueries({ queryKey: ['renewal-contracts'] });
      qc.invalidateQueries({ queryKey: ['contracts'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to renew';
      message.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!newEndDate) e.date = 'Required';
    if (new Date(newEndDate) <= new Date(contract.end_date)) e.date = 'Must be after current end date';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    renewMut.mutate();
  };

  const extensionDays = newEndDate
    ? Math.ceil((new Date(newEndDate).getTime() - new Date(contract.end_date).getTime()) / 86400000)
    : 0;

  const QUICK_OPTIONS = [
    { label: '+ 3 months',  months: 3  },
    { label: '+ 6 months',  months: 6  },
    { label: '+ 12 months', months: 12 },
    { label: '+ 24 months', months: 24 },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(5px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520, boxShadow: '0 32px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#1e293b,#1e40af)', padding: '20px 26px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileTextOutlined style={{ color: '#fff', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>Renew Contract</div>
                <div style={{ fontSize: 12, color: '#93c5fd', fontFamily: 'monospace' }}>{contract.contract_number}</div>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <CloseOutlined style={{ fontSize: 12 }} />
          </button>
        </div>

        <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Current contract info */}
          <div style={{ background: urgency.bg, border: `1px solid ${urgency.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 2 }}>{contract.tenant?.name ?? 'Tenant'}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Monthly rent: <strong>${parseFloat(contract.monthly_rent || 0).toLocaleString()}</strong> {contract.currency}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ background: urgency.bg, color: urgency.color, border: `1px solid ${urgency.border}`, fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {urgency.icon}
                  {days <= 0 ? 'EXPIRED' : `${days} days left`}
                </span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 12 }}>
              <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ color: '#94a3b8', marginBottom: 2 }}>Start Date</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatDate(contract.start_date)}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ color: '#94a3b8', marginBottom: 2 }}>End Date</div>
                <div style={{ fontWeight: 700, color: urgency.color }}>{formatDate(contract.end_date)}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ color: '#94a3b8', marginBottom: 2 }}>Status</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{contract.status}</div>
              </div>
            </div>
          </div>

          {/* Quick renewal options */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Options</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {QUICK_OPTIONS.map(opt => {
                const newDate   = addMonths(contract.end_date, opt.months);
                const isSelected = newEndDate === newDate;
                return (
                  <button key={opt.label} onClick={() => setNewEndDate(newDate)}
                    style={{ padding: '10px 6px', borderRadius: 10, border: `2px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`, background: isSelected ? '#eff6ff' : '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: isSelected ? '#2563eb' : '#374151', transition: 'all 0.12s', textAlign: 'center' }}>
                    {opt.label}
                    <div style={{ fontSize: 9, color: isSelected ? '#60a5fa' : '#94a3b8', marginTop: 3 }}>
                      until {formatDate(newDate)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom date */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              New End Date <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="date"
              style={{ ...INPUT, borderColor: errors.date ? '#ef4444' : '#e5e7eb' }}
              value={newEndDate}
              min={new Date(contract.end_date).toISOString().split('T')[0]}
              onChange={e => { setNewEndDate(e.target.value); setErrors({}); }}
            />
            {errors.date && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.date}</div>}
          </div>

          {/* Summary */}
          {newEndDate && extensionDays > 0 && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 4 }}>✅ Renewal Summary</div>
                <div style={{ fontSize: 12, color: '#064e3b' }}>
                  Extended by <strong>{extensionDays} days</strong> ({Math.round(extensionDays / 30)} months)
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>New end date</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d' }}>{formatDate(newEndDate)}</div>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Internal Note <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
            </label>
            <textarea
              style={{ ...INPUT, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
              placeholder="e.g. Renewed per tenant request, rate unchanged..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 26px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={renewMut.isPending}
            style={{ flex: 2, padding: '11px', borderRadius: 10, background: renewMut.isPending ? '#93c5fd' : 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: renewMut.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
            {renewMut.isPending ? <><LoadingOutlined /> Renewing...</> : <>🔄 Renew Contract</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Contract Renewal Card ─────────────────────────────────────────────────────
function RenewalCard({ contract, onRenew, onView }: { contract: any; onRenew: (c: any) => void; onView: (c: any) => void }) {
  const days    = daysUntil(contract.end_date);
  const urgency = getUrgency(days);
  const rent    = parseFloat(contract.monthly_rent || 0);

  return (
    <div style={{
      ...CARD,
      borderLeft: `4px solid ${urgency.color}`,
      padding: '16px 20px',
      transition: 'all 0.15s',
      position: 'relative',
      overflow: 'hidden',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.06)')}
    >
      {/* Pulse animation for critical */}
      {urgency.pulse && (
        <div style={{ position: 'absolute', top: 12, right: 12, width: 10, height: 10, borderRadius: '50%', background: urgency.color, animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Icon */}
        <div style={{ width: 46, height: 46, borderRadius: 12, background: urgency.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20, color: urgency.color, border: `1.5px solid ${urgency.border}` }}>
          <FileTextOutlined />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 2 }}>
                {contract.tenant?.name ?? 'Tenant'}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
                {contract.contract_number}
              </div>
            </div>
            <span style={{ background: urgency.bg, color: urgency.color, border: `1px solid ${urgency.border}`, fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {urgency.icon}
              {days <= 0 ? 'EXPIRED' : days === 1 ? '1 day left' : `${days} days left`}
            </span>
          </div>

          {/* Details row */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#64748b', marginBottom: 12 }}>
            <span>📅 Ends <strong style={{ color: urgency.color }}>{formatDate(contract.end_date)}</strong></span>
            <span>💰 <strong style={{ color: '#0f172a' }}>${rent.toLocaleString()}</strong>/mo</span>
            <span>📄 {contract.status}</span>
            {contract.space?.name && <span>🏢 {contract.space.name}</span>}
          </div>

          {/* Progress bar — days remaining */}
          {days > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>
                <span>Time remaining</span>
                <span>{Math.max(0, days)} / 90 days warning period</span>
              </div>
              <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: urgency.color, width: `${Math.min(100, Math.max(0, (days / 90) * 100))}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onRenew(contract)}
              style={{ flex: 1, padding: '8px 14px', borderRadius: 9, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
              🔄 Renew Contract
            </button>
            <button onClick={() => onView(contract)}
              style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
              👁 View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ContractRenewalPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [daysFilter, setDaysFilter] = useState<30 | 60 | 90 | 'all'>(90);
  const [search,     setSearch]     = useState('');
  const [renewingContract, setRenewing] = useState<any | null>(null);

  const { data: raw, isLoading, refetch } = useQuery({
    queryKey: ['renewal-contracts'],
    queryFn:  () => contractApi.getExpiring(90).then(r => r.data),
  });

  const all = toArray<any>(raw);

  const contracts = useMemo(() => {
    return all
      .filter(c => {
        const days = daysUntil(c.end_date);
        if (daysFilter !== 'all' && days > daysFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!c.contract_number?.toLowerCase().includes(q) && !c.tenant?.name?.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => daysUntil(a.end_date) - daysUntil(b.end_date));
  }, [all, daysFilter, search]);

  const expired  = all.filter(c => daysUntil(c.end_date) <= 0).length;
  const crit7    = all.filter(c => { const d = daysUntil(c.end_date); return d > 0 && d <= 7; }).length;
  const in30     = all.filter(c => { const d = daysUntil(c.end_date); return d > 0 && d <= 30; }).length;
  const in60     = all.filter(c => { const d = daysUntil(c.end_date); return d > 0 && d <= 60; }).length;
  const in90     = all.filter(c => { const d = daysUntil(c.end_date); return d > 0 && d <= 90; }).length;
  const totalRevAtRisk = all
    .filter(c => daysUntil(c.end_date) <= 90)
    .reduce((s, c) => s + parseFloat(c.monthly_rent || 0), 0);

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>

      {renewingContract && <RenewModal contract={renewingContract} onClose={() => setRenewing(null)} />}

      {/* ── Header ── */}
      <div style={{ ...CARD, padding: '20px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
              <BellOutlined style={{ color: expired > 0 || crit7 > 0 ? '#dc2626' : '#d97706' }} />
              Contract Renewal Alerts
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Contracts expiring within 90 days · renew before they lapse
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => refetch()}
              style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <ReloadOutlined /> Refresh
            </button>
            <button onClick={() => navigate('/admin/contracts')}
              style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#374151', fontSize: 13, fontWeight: 600 }}>
              All Contracts →
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {[
            { label: 'Expired',       value: expired,    color: '#b91c1c', bg: '#fef2f2', icon: '🔴', filter: 'all'  as const },
            { label: 'Critical (7d)', value: crit7,      color: '#dc2626', bg: '#fff5f5', icon: '🚨', filter: 30    as const },
            { label: 'Expiring 30d',  value: in30,       color: '#d97706', bg: '#fffbeb', icon: '⚠️', filter: 30    as const },
            { label: 'Expiring 60d',  value: in60,       color: '#92400e', bg: '#fefce8', icon: '⏳', filter: 60    as const },
            { label: 'Revenue at Risk',value: `$${Math.round(totalRevAtRisk / 1000)}k/mo`, color: '#7c3aed', bg: '#f5f3ff', icon: '💰', filter: 'all' as const },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 11, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.12s', border: `1px solid ${s.color}22` }}
              onClick={() => setDaysFilter(s.filter)}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1, marginBottom: 3 }}>
                {isLoading ? '—' : s.value}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Expired banner ── */}
      {expired > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 24 }}>🚨</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#b91c1c' }}>{expired} contract{expired > 1 ? 's' : ''} already expired!</div>
            <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>These require immediate action — renew or terminate.</div>
          </div>
          <button onClick={() => setDaysFilter('all')}
            style={{ padding: '8px 16px', borderRadius: 9, background: '#dc2626', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            View Expired →
          </button>
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 300 }}>
          <SearchOutlined style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }} />
          <input
            style={{ ...INPUT, paddingLeft: 36 }}
            placeholder="Search by tenant or contract #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Day filter pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { label: 'All',    value: 'all' as const, color: '#475569', bg: '#f1f5f9' },
            { label: '≤ 30d',  value: 30   as const, color: '#dc2626', bg: '#fee2e2' },
            { label: '≤ 60d',  value: 60   as const, color: '#d97706', bg: '#fef3c7' },
            { label: '≤ 90d',  value: 90   as const, color: '#92400e', bg: '#fefce8' },
          ]).map(f => (
            <button key={f.value} onClick={() => setDaysFilter(f.value)}
              style={{ padding: '7px 16px', borderRadius: 20, border: `1.5px solid ${daysFilter === f.value ? f.color : '#e5e7eb'}`, background: daysFilter === f.value ? f.bg : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: daysFilter === f.value ? f.color : '#64748b', transition: 'all 0.12s' }}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
          <strong style={{ color: '#0f172a' }}>{contracts.length}</strong> contracts shown
        </div>
      </div>

      {/* ── Contract cards ── */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ ...CARD, padding: 20, height: 130, background: '#f8fafc', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <div style={{ ...CARD, padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
            {all.length === 0 ? 'No contracts expiring soon!' : 'No contracts match your filters'}
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
            {all.length === 0 ? 'All contracts are in good shape — nothing due within 90 days.' : 'Try adjusting the filters above.'}
          </div>
          <button onClick={() => navigate('/admin/contracts')}
            style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            View All Contracts
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {contracts.map(c => (
            <RenewalCard
              key={c.id}
              contract={c}
              onRenew={setRenewing}
              onView={c => navigate('/admin/contracts')}
            />
          ))}
        </div>
      )}
    </div>
  );
}