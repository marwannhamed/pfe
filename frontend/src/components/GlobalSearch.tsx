import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  SearchOutlined, CloseOutlined, LoadingOutlined,
  CalendarOutlined, FileTextOutlined, TeamOutlined,
  CreditCardOutlined, AppstoreOutlined, ToolOutlined,
} from '@ant-design/icons';
import {
  bookingApi, contractApi, tenantApi,
  billingApi, spaceApi, maintenanceApi,
} from '../api/services';
import { useAuthStore } from '../store/authStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toArray<T>(raw: any): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#fef08a', color: '#0f172a', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface SearchResult {
  id:       string;
  type:     'booking' | 'contract' | 'tenant' | 'invoice' | 'space' | 'maintenance';
  title:    string;
  subtitle: string;
  badge?:   { label: string; bg: string; color: string };
  path:     string;
  meta?:    string;
}

const TYPE_CONFIG = {
  booking:     { label: 'Bookings',     icon: <CalendarOutlined />,   color: '#2563eb', bg: '#eff6ff' },
  contract:    { label: 'Contracts',    icon: <FileTextOutlined />,   color: '#059669', bg: '#f0fdf4' },
  tenant:      { label: 'Tenants',      icon: <TeamOutlined />,       color: '#d97706', bg: '#fffbeb' },
  invoice:     { label: 'Invoices',     icon: <CreditCardOutlined />, color: '#7c3aed', bg: '#f5f3ff' },
  space:       { label: 'Spaces',       icon: <AppstoreOutlined />,   color: '#0891b2', bg: '#f0f9ff' },
  maintenance: { label: 'Maintenance',  icon: <ToolOutlined />,       color: '#dc2626', bg: '#fef2f2' },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  CONFIRMED:        { bg: '#dcfce7', color: '#15803d' },
  PENDING_APPROVAL: { bg: '#fef3c7', color: '#92400e' },
  CHECKED_IN:       { bg: '#dbeafe', color: '#1d4ed8' },
  COMPLETED:        { bg: '#ede9fe', color: '#6d28d9' },
  CANCELLED:        { bg: '#fee2e2', color: '#b91c1c' },
  ACTIVE:           { bg: '#dcfce7', color: '#15803d' },
  DRAFT:            { bg: '#f1f5f9', color: '#475569' },
  EXPIRED:          { bg: '#fee2e2', color: '#b91c1c' },
  TERMINATED:       { bg: '#fee2e2', color: '#b91c1c' },
  PAID:             { bg: '#dcfce7', color: '#15803d' },
  ISSUED:           { bg: '#dbeafe', color: '#1d4ed8' },
  OVERDUE:          { bg: '#fee2e2', color: '#b91c1c' },
  PARTIALLY_PAID:   { bg: '#fef3c7', color: '#92400e' },
  AVAILABLE:        { bg: '#dcfce7', color: '#15803d' },
  OCCUPIED:         { bg: '#dbeafe', color: '#1d4ed8' },
  MAINTENANCE:      { bg: '#fee2e2', color: '#b91c1c' },
  TRIAL:            { bg: '#dbeafe', color: '#1d4ed8' },
  SUSPENDED:        { bg: '#fee2e2', color: '#b91c1c' },
  OPEN:             { bg: '#fef3c7', color: '#92400e' },
  IN_PROGRESS:      { bg: '#dbeafe', color: '#1d4ed8' },
  RESOLVED:         { bg: '#dcfce7', color: '#15803d' },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function GlobalSearch() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [focused, setFocused] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  const isBackOffice  = ['SUPER_ADMIN','MANAGER','FINANCE','MAINTENANCE'].includes(user?.role ?? '');
  const isSuperAdmin  = user?.role === 'SUPER_ADMIN';
  const isSiteManager = user?.role === 'MANAGER';
  const isFinance     = user?.role === 'FINANCE';
  const tenantId      = user?.tenant_id ?? '';
  const basePath      = isBackOffice ? '/admin' : '/portal';

  const canSeeAll     = isSuperAdmin || isSiteManager;
  const canSeeBilling = isSuperAdmin || isFinance || isSiteManager;

  // ── Ctrl+K / Cmd+K shortcut ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setTimeout(() => inputRef.current?.focus(), 60);
      }
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ── Click outside to close ────────────────────────────────────────────────
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const enabled = open && query.trim().length >= 2;

  // ── Queries (fire in parallel) ────────────────────────────────────────────
  const { data: bookingsRaw,    isFetching: fb } = useQuery({
    queryKey: ['gs-bookings',    query],
    queryFn:  () => bookingApi.getAll(canSeeAll ? {} : { tenantId }).then(r => r.data),
    enabled:  enabled,
    staleTime: 0,
  });
  const { data: contractsRaw,   isFetching: fc } = useQuery({
    queryKey: ['gs-contracts',   query],
    queryFn:  () => contractApi.getAll(canSeeAll ? {} : { tenantId }).then(r => r.data),
    enabled:  enabled,
    staleTime: 0,
  });
  const { data: tenantsRaw,     isFetching: ft } = useQuery({
    queryKey: ['gs-tenants',     query],
    queryFn:  () => tenantApi.getAll().then(r => r.data),
    enabled:  enabled && (isSuperAdmin || isFinance),
    staleTime: 0,
  });
  const { data: invoicesRaw,    isFetching: fi } = useQuery({
    queryKey: ['gs-invoices',    query],
    queryFn:  () => billingApi.getInvoices(canSeeBilling ? {} : { tenantId }).then(r => r.data),
    enabled:  enabled && (canSeeBilling || !!tenantId),
    staleTime: 0,
  });
  const { data: spacesRaw,      isFetching: fs } = useQuery({
    queryKey: ['gs-spaces',      query],
    queryFn:  () => spaceApi.getAll(),
    enabled:  enabled && isBackOffice,
    staleTime: 0,
  });
  const { data: maintenanceRaw, isFetching: fm } = useQuery({
    queryKey: ['gs-maintenance',  query],
    queryFn:  () => maintenanceApi.getAll().then(r => r.data),
    enabled:  enabled && isBackOffice,
    staleTime: 0,
  });

  const isFetching = fb || fc || ft || fi || fs || fm;
  const q = query.toLowerCase().trim();

  // ── Build flat results array ──────────────────────────────────────────────
  const results: SearchResult[] = [];

  toArray<any>(bookingsRaw)
    .filter(b => b.booking_number?.toLowerCase().includes(q) || b.space?.name?.toLowerCase().includes(q))
    .slice(0, 4)
    .forEach(b => results.push({
      id:       b.id,
      type:     'booking',
      title:    b.booking_number,
      subtitle: `${b.space?.name ?? 'Space'} · ${new Date(b.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      badge:    STATUS_COLORS[b.status] ? { label: b.status.replace(/_/g,' '), ...STATUS_COLORS[b.status] } : undefined,
      path:     `${basePath}/bookings`,
      meta:     `$${parseFloat(b.total_price || '0').toLocaleString()}`,
    }));

  toArray<any>(contractsRaw)
    .filter(c => c.contract_number?.toLowerCase().includes(q) || c.tenant?.name?.toLowerCase().includes(q))
    .slice(0, 4)
    .forEach(c => results.push({
      id:       c.id,
      type:     'contract',
      title:    c.contract_number,
      subtitle: `${c.tenant?.name ?? 'Tenant'} · ${c.currency} ${parseFloat(c.monthly_rent || '0').toLocaleString()}/mo`,
      badge:    STATUS_COLORS[c.status] ? { label: c.status, ...STATUS_COLORS[c.status] } : undefined,
      path:     `${basePath}/contracts`,
      meta:     c.status === 'ACTIVE'
        ? `Ends ${new Date(c.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
        : undefined,
    }));

  toArray<any>(tenantsRaw)
    .filter(t => t.name?.toLowerCase().includes(q) || t.contact_email?.toLowerCase().includes(q))
    .slice(0, 4)
    .forEach(t => results.push({
      id:       t.id,
      type:     'tenant',
      title:    t.name,
      subtitle: t.contact_email ?? '',
      badge:    STATUS_COLORS[t.status] ? { label: t.status, ...STATUS_COLORS[t.status] } : undefined,
      path:     `/admin/tenants/${t.id}`,
      meta:     t.subscription_plan,
    }));

  toArray<any>(invoicesRaw)
    .filter(i => i.invoice_number?.toLowerCase().includes(q) || i.tenant?.name?.toLowerCase().includes(q))
    .slice(0, 4)
    .forEach(i => results.push({
      id:       i.id,
      type:     'invoice',
      title:    i.invoice_number,
      subtitle: `${i.tenant?.name ?? ''} · ${i.type?.replace(/_/g,' ').toLowerCase()}`,
      badge:    STATUS_COLORS[i.status] ? { label: i.status, ...STATUS_COLORS[i.status] } : undefined,
      path:     `${basePath}/billing`,
      meta:     `$${parseFloat(i.total_amount || '0').toLocaleString()}`,
    }));

  toArray<any>(spacesRaw)
    .filter(s => s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q))
    .slice(0, 4)
    .forEach(s => results.push({
      id:       s.id,
      type:     'space',
      title:    s.name,
      subtitle: `${s.type?.replace(/_/g,' ')} · Cap: ${s.capacity}`,
      badge:    STATUS_COLORS[s.status] ? { label: s.status, ...STATUS_COLORS[s.status] } : undefined,
      path:     `${basePath}/spaces/${s.id}`,
      meta:     s.price_per_month ? `$${parseFloat(s.price_per_month).toLocaleString()}/mo` : undefined,
    }));

  toArray<any>(maintenanceRaw)
    .filter(m => m.title?.toLowerCase().includes(q) || m.ticket_number?.toLowerCase().includes(q))
    .slice(0, 3)
    .forEach(m => results.push({
      id:       m.id,
      type:     'maintenance',
      title:    m.title ?? m.ticket_number,
      subtitle: `${m.category ?? ''} · ${m.priority ?? ''} priority`,
      badge:    STATUS_COLORS[m.status] ? { label: m.status.replace(/_/g,' '), ...STATUS_COLORS[m.status] } : undefined,
      path:     `${basePath}/maintenance`,
    }));

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
    if (e.key === 'Enter' && results[focused]) handleSelect(results[focused]);
  };

  const handleSelect = (r: SearchResult) => {
    navigate(r.path);
    setOpen(false);
    setQuery('');
    setFocused(0);
  };

  // Group results by type
  const TYPE_ORDER: SearchResult['type'][] = ['booking','contract','tenant','invoice','space','maintenance'];
  const grouped = TYPE_ORDER.reduce((acc: Record<string, SearchResult[]>, t) => {
    const items = results.filter(r => r.type === t);
    if (items.length) acc[t] = items;
    return acc;
  }, {});

  // Quick access shortcuts
  const quickLinks = [
    { label: 'Bookings',     path: `${basePath}/bookings`,     icon: '📅', show: true },
    { label: 'Contracts',    path: `${basePath}/contracts`,    icon: '📋', show: true },
    { label: 'Billing',      path: `${basePath}/billing`,      icon: '🧾', show: canSeeBilling || !!tenantId },
    { label: 'Maintenance',  path: `${basePath}/maintenance`,  icon: '🔧', show: true },
    { label: 'Tenants',      path: '/admin/tenants',           icon: '🏢', show: canSeeAll },
    { label: 'Spaces',       path: `${basePath}/spaces`,       icon: '🏠', show: isBackOffice },
  ].filter(l => l.show);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>

      {/* ── Trigger button ── */}
      <button
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 60); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 14px', borderRadius: 9,
          border: '1px solid #e5e7eb', background: open ? '#fff' : '#f8fafc',
          cursor: 'pointer', fontSize: 13, color: '#64748b',
          transition: 'all 0.15s', minWidth: 200,
          boxShadow: open ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
          borderColor: open ? '#2563eb' : '#e5e7eb',
        }}
      >
        <SearchOutlined style={{ fontSize: 14, color: open ? '#2563eb' : '#94a3b8' }} />
        <span style={{ flex: 1, textAlign: 'left', color: '#94a3b8' }}>Search anything...</span>
        <kbd style={{ fontSize: 10, background: '#e5e7eb', color: '#64748b', padding: '2px 6px', borderRadius: 5, fontWeight: 600, letterSpacing: '0.02em' }}>⌘K</kbd>
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div style={{
          position: 'fixed',
          top: 70, left: '50%', transform: 'translateX(-50%)',
          width: 600, zIndex: 9999,
          background: '#fff', borderRadius: 16,
          border: '1px solid #e5e7eb',
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}>

          {/* Search input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
            {isFetching
              ? <LoadingOutlined style={{ fontSize: 18, color: '#2563eb', flexShrink: 0 }} spin />
              : <SearchOutlined  style={{ fontSize: 18, color: '#94a3b8', flexShrink: 0 }} />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setFocused(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Search bookings, contracts, tenants, invoices, spaces..."
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#0f172a', background: 'transparent' }}
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button onClick={() => setQuery('')}
                style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexShrink: 0 }}>
                <CloseOutlined style={{ fontSize: 10 }} />
              </button>
            ) : (
              <kbd style={{ fontSize: 10, background: '#f1f5f9', color: '#94a3b8', padding: '3px 7px', borderRadius: 6, flexShrink: 0 }}>ESC</kbd>
            )}
          </div>

          {/* ── Empty state: quick access ── */}
          {!query && (
            <div style={{ padding: '16px 20px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Quick Access
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {quickLinks.map(l => (
                  <button key={l.path} onClick={() => { navigate(l.path); setOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid #f1f5f9', background: '#fafafa', cursor: 'pointer', fontSize: 13, color: '#374151', transition: 'all 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = '#f1f5f9'; }}>
                    <span style={{ fontSize: 18 }}>{l.icon}</span>
                    <span style={{ fontWeight: 500 }}>{l.label}</span>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 14, fontSize: 11, color: '#cbd5e1', textAlign: 'center' }}>
                Type 2+ characters to search · ↑↓ navigate · Enter select
              </div>
            </div>
          )}

          {/* ── Min chars hint ── */}
          {query.length === 1 && (
            <div style={{ padding: '28px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Type <strong style={{ color: '#374151' }}>1 more character</strong> to start searching...
            </div>
          )}

          {/* ── No results ── */}
          {query.length >= 2 && !isFetching && results.length === 0 && (
            <div style={{ padding: '36px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
              <div style={{ fontWeight: 700, color: '#374151', fontSize: 15, marginBottom: 6 }}>No results for "{query}"</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Try a different search term — booking number, tenant name, invoice number...</div>
            </div>
          )}

          {/* ── Results ── */}
          {query.length >= 2 && results.length > 0 && (
            <div ref={listRef} style={{ maxHeight: 500, overflowY: 'auto' }}>
              {(Object.entries(grouped) as [SearchResult['type'], SearchResult[]][]).map(([type, items]) => {
                const cfg = TYPE_CONFIG[type];
                return (
                  <div key={type}>
                    {/* Section header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px 6px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: cfg.color }}>
                        {cfg.icon}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{cfg.label}</span>
                      <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto' }}>{items.length} found</span>
                    </div>

                    {/* Result rows */}
                    {items.map(r => {
                      const globalIdx = results.indexOf(r);
                      const isActive  = globalIdx === focused;
                      return (
                        <div
                          key={r.id}
                          onClick={() => handleSelect(r)}
                          onMouseEnter={() => setFocused(globalIdx)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '11px 20px', cursor: 'pointer',
                            background: isActive ? '#eff6ff' : '#fff',
                            borderLeft: `3px solid ${isActive ? cfg.color : 'transparent'}`,
                            transition: 'background 0.1s',
                          }}
                        >
                          {/* Type icon */}
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: cfg.color, flexShrink: 0 }}>
                            {cfg.icon}
                          </div>

                          {/* Title + subtitle */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: ['booking','contract','invoice'].includes(r.type) ? 'monospace' : undefined }}>
                              {highlight(r.title, query)}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {highlight(r.subtitle, query)}
                            </div>
                          </div>

                          {/* Badge + meta + arrow */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                            {r.badge && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: r.badge.bg, color: r.badge.color, whiteSpace: 'nowrap' }}>
                                {r.badge.label}
                              </span>
                            )}
                            {r.meta && (
                              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{r.meta}</span>
                            )}
                          </div>
                          {isActive && <span style={{ color: cfg.color, fontSize: 14, flexShrink: 0, marginLeft: 4 }}>→</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Footer */}
              <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', background: '#f8fafc' }}>
                <span><strong style={{ color: '#374151' }}>{results.length}</strong> result{results.length !== 1 ? 's' : ''}</span>
                <span>↑↓ navigate · Enter select · Esc close</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}