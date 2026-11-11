import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AppstoreOutlined, FileTextOutlined, BarChartOutlined,
  SafetyOutlined, SearchOutlined, ArrowRightOutlined,
  EnvironmentOutlined, TeamOutlined, StarFilled,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { spaceApi } from '../../api/services';
import { formatMoney } from '../../constants/qatar';
import type { Space } from '../../types';

const FEATURES = [
  { icon: <AppstoreOutlined />, title: 'Smart Space Search',       desc: 'Filter by size, budget, location and amenities. Find your office in seconds.',  color: '#2563eb', bg: '#eff6ff' },
  { icon: <FileTextOutlined />, title: 'Digital Lease Management', desc: 'Sign contracts online, track renewals, manage documents — all in one place.',  color: '#059669', bg: '#f0fdf4' },
  { icon: <BarChartOutlined />, title: 'Financial Tracking',       desc: 'View invoices, track payments, get reminders before due dates automatically.', color: '#d97706', bg: '#fffbeb' },
  { icon: <SafetyOutlined />,   title: 'Secure & Compliant',       desc: 'Bank-grade security. All your documents and payments protected at every step.', color: '#7c3aed', bg: '#f5f3ff' },
];

// Renters from the demo data, describing what the platform does for them.
const TESTIMONIALS = [
  { name: 'Noor Al-Hajri',     company: 'Acme Corp · Al Kahraba Business Centre',     text: 'We applied for our floor online, reception called to book the visit the next day, and the lease, invoices and room bookings have lived in one place since.', rating: 5 },
  { name: 'Ahmed Al-Sulaiti',  company: 'Qatar Fintech · Corniche Tower',             text: 'Paying rent by cheque used to mean chasing receipts. Now finance confirms the cheque and the invoice turns paid in our portal the same day.',                 rating: 5 },
  { name: 'Sara Al-Mohannadi', company: 'Doha Design Studio · Sikkat Al Wadi Offices', text: 'Our team books the meeting rooms itself, and a leak we reported in the morning had a technician on it before lunch.',                                         rating: 5 },
];

const typeLabel = (t: string) => t.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** Up to three listings with photos, the priciest first, one per building. */
function pickFeatured(spaces: Space[]): Space[] {
  const withPhoto = spaces.filter((s) => (s.photos?.length ?? 0) > 0);
  const pool = (withPhoto.length >= 3 ? withPhoto : spaces)
    .slice()
    .sort((a, b) => Number(b.price_per_month ?? 0) - Number(a.price_per_month ?? 0));
  const out: Space[] = [];
  const buildings = new Set<string>();
  for (const s of pool) {
    const b = s.floor?.building_id ?? s.id;
    if (buildings.has(b)) continue;
    buildings.add(b);
    out.push(s);
    if (out.length === 3) break;
  }
  return out;
}

// ── Full-width section helper ─────────────────────────────────────────────────
// Uses the classic CSS trick: position relative + negative margins to break out
// of any parent container and span 100vw
const fullWidthStyle = (bg: string, padding = '0'): React.CSSProperties => ({
  width:       '100vw',
  position:    'relative',
  left:        '50%',
  right:       '50%',
  marginLeft:  '-50vw',
  marginRight: '-50vw',
  background:  bg,
  padding,
  overflowX:   'hidden',
});

const innerStyle: React.CSSProperties = {
  maxWidth: 1280,
  margin:   '0 auto',
  padding:  '0 40px',
};

export default function PublicHomePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  // Figures and featured offices come from the published listings — the same
  // public endpoint as the map. This page used to show placeholder offices in
  // Manhattan, Tokyo and Sydney priced in dollars, and invented counts.
  const { data: spaces = [] } = useQuery({
    queryKey: ['public-home-spaces'],
    queryFn: () => spaceApi.getPublishedMap(),
    staleTime: 60_000,
  });
  const featured = useMemo(() => pickFeatured(spaces), [spaces]);
  const buildingCount = useMemo(() => new Set(spaces.map((s) => s.floor?.building_id ?? s.floor_id)).size, [spaces]);
  const landlordCount = useMemo(() => new Set(spaces.map((s) => s.floor?.building?.tenant_id).filter(Boolean)).size, [spaces]);
  const cities = useMemo(() => [...new Set(spaces.map((s) => s.city).filter(Boolean))] as string[], [spaces]);
  const prices = spaces.map((s) => Number(s.price_per_month)).filter((n) => n > 0);
  const fromPrice = prices.length ? Math.min(...prices) : null;
  const stats = [
    { value: String(spaces.length || '—'), label: 'Spaces available now', color: '#3b82f6' },
    { value: String(buildingCount || '—'), label: 'Buildings with vacancies', color: '#10b981' },
    { value: String(landlordCount || '—'), label: 'Property companies',   color: '#f59e0b' },
    { value: fromPrice ? formatMoney(fromPrice) : '—', label: 'Monthly rent from', color: '#8b5cf6' },
  ];
  const search = () => navigate(q.trim() ? `/map?q=${encodeURIComponent(q.trim())}` : '/map');

  return (
    <div style={{ overflowX: 'hidden' }}>

      {/* ═══════════════════════════════════════════════
          HERO — full viewport width
          ═══════════════════════════════════════════════ */}
      <section style={{
        ...fullWidthStyle('linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)', '100px 0 80px'),
        overflow: 'hidden',
      }}>
        <div style={{ position:'absolute', top:-150, right:-150, width:500, height:500, borderRadius:'50%', background:'rgba(255,255,255,0.03)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-100, left:-100, width:400, height:400, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />

        <div style={{ ...innerStyle, textAlign:'center', position:'relative' }}>
          {/* Badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', color:'#93c5fd', fontSize:13, fontWeight:600, padding:'6px 18px', borderRadius:24, marginBottom:28 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e' }} />
            {spaces.length
              ? `${spaces.length} spaces available now in ${cities.join(' and ') || 'Qatar'}`
              : 'Offices, desks and meeting rooms across Doha'}
          </div>

          <h1 style={{ margin:'0 0 20px', fontSize:60, fontWeight:900, color:'#fff', lineHeight:1.1, letterSpacing:'-1px' }}>
            Find the perfect<br />
            <span style={{ color:'#60a5fa' }}>office space</span>{' '}
            <span style={{ color:'rgba(255,255,255,0.9)' }}>for your team</span>
          </h1>

          <p style={{ margin:'0 0 44px', fontSize:18, color:'#94a3b8', lineHeight:1.7, maxWidth:580, marginLeft:'auto', marginRight:'auto' }}>
            Offices, flexible desks and meeting rooms in Msheireb, West Bay and Lusail. Apply online, book a visit, and sign your lease without an account to start.
          </p>

          {/* Search bar */}
          <div style={{ display:'flex', maxWidth:620, margin:'0 auto 40px', background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ flex:1, padding:'0 18px', display:'flex', alignItems:'center', gap:10 }}>
              <EnvironmentOutlined style={{ color:'#94a3b8', fontSize:16 }} />
              <input
                placeholder="Building, district or space name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
                style={{ border:'none', outline:'none', fontSize:15, color:'#374151', width:'100%', padding:'16px 0', background:'transparent' }}
              />
            </div>
            <button
              onClick={search}
              style={{ padding:'0 28px', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', border:'none', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8, whiteSpace:'nowrap' }}
            >
              <SearchOutlined /> Search on map
            </button>
          </div>

          {/* CTA buttons */}
          <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
            <button
              onClick={() => navigate('/map')}
              style={{ padding:'14px 32px', borderRadius:10, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff', fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}
            >
              <EnvironmentOutlined /> Explore map
            </button>
            <button
              onClick={() => navigate('/register')}
              style={{ padding:'14px 32px', borderRadius:10, background:'#fff', border:'none', color:'#1d4ed8', fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 14px rgba(0,0,0,0.15)' }}
            >
              Register Your Company <ArrowRightOutlined />
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          STATS
          ═══════════════════════════════════════════════ */}
      <section style={fullWidthStyle('#fff')}>
        <div style={innerStyle}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderLeft:'1px solid #f1f5f9' }}>
            {stats.map(s => (
              <div key={s.label} style={{ padding:'32px 24px', textAlign:'center', borderRight:'1px solid #f1f5f9' }}>
                <div style={{ fontSize:38, fontWeight:900, color:s.color, lineHeight:1, marginBottom:6 }}>{s.value}</div>
                <div style={{ fontSize:14, color:'#64748b', fontWeight:500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FEATURED SPACES
          ═══════════════════════════════════════════════ */}
      <section style={fullWidthStyle('#f8fafc', '80px 0')}>
        <div style={innerStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:40, flexWrap:'wrap', gap:16 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Featured Offices</div>
              <h2 style={{ margin:'0 0 8px', fontSize:36, fontWeight:800, color:'#0f172a' }}>Premium spaces, ready to book</h2>
              <p style={{ margin:0, fontSize:15, color:'#64748b' }}>Available now, with photos, monthly rent and transport notes</p>
            </div>
            <button onClick={() => navigate('/map')} style={{ padding:'11px 22px', borderRadius:9, background:'#fff', border:'1px solid #e5e7eb', color:'#374151', fontSize:14, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              View All <ArrowRightOutlined />
            </button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24 }}>
            {featured.map(space => (
              <div
                key={space.id}
                style={{ background:'#fff', borderRadius:14, overflow:'hidden', border:'1px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', cursor:'pointer', transition:'all 0.2s' }}
                onClick={() => navigate(`/map?space_id=${space.id}`)}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(0,0,0,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.06)'; }}
              >
                <div style={{ height:200, overflow:'hidden', position:'relative' }}>
                  <img src={space.photos?.[0] ?? 'https://placehold.co/400x200/1e293b/white?text=Office'} alt={space.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}
                    onError={e => { (e.target as HTMLImageElement).src='https://placehold.co/400x200/1e293b/white?text=Office'; }} />
                  <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:6 }}>
                    <span style={{ background:'#dcfce7', color:'#15803d', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>Available</span>
                    <span style={{ background:'#2563eb', color:'#fff', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>{typeLabel(space.type)}</span>
                  </div>
                </div>
                <div style={{ padding:'18px 20px' }}>
                  <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:700, color:'#0f172a' }}>{space.name}</h3>
                  <p style={{ margin:'0 0 14px', fontSize:13, color:'#64748b', display:'flex', alignItems:'center', gap:5 }}>
                    <EnvironmentOutlined style={{ fontSize:12 }} /> {[space.floor?.building?.name, space.city].filter(Boolean).join(' · ')}
                  </p>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                    <div style={{ display:'flex', gap:14 }}>
                      {space.area_sqm ? <span style={{ fontSize:12, color:'#64748b' }}>📐 {space.area_sqm} m²</span> : null}
                      <span style={{ fontSize:12, color:'#64748b', display:'flex', alignItems:'center', gap:4 }}><TeamOutlined style={{ fontSize:11 }} /> {space.capacity} {space.capacity === 1 ? 'person' : 'people'}</span>
                    </div>
                    <div style={{ fontSize:18, fontWeight:800, color:'#0f172a' }}>{space.price_per_month ? `${formatMoney(space.price_per_month, space.currency)}/mo` : '—'}</div>
                  </div>
                  <button style={{ width:'100%', padding:'10px', borderRadius:8, background:'linear-gradient(135deg,#1d4ed8,#2563eb)', border:'none', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FEATURES
          ═══════════════════════════════════════════════ */}
      <section style={fullWidthStyle('#fff', '80px 0')}>
        <div style={innerStyle}>
          <div style={{ textAlign:'center', marginBottom:56 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Why LeaseManager</div>
            <h2 style={{ margin:'0 0 12px', fontSize:36, fontWeight:800, color:'#0f172a' }}>Everything your team needs</h2>
            <p style={{ margin:0, fontSize:16, color:'#64748b', maxWidth:480, marginLeft:'auto', marginRight:'auto' }}>A complete workspace management platform built for modern businesses</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24 }}>
            {FEATURES.map(f => (
              <div
                key={f.title}
                style={{ padding:'28px 24px', borderRadius:14, border:'1px solid #f1f5f9', background:'#fafafa', textAlign:'center', transition:'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.08)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='#fafafa'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none'; }}
              >
                <div style={{ width:52, height:52, background:f.bg, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:f.color, margin:'0 auto 18px' }}>{f.icon}</div>
                <h3 style={{ margin:'0 0 10px', fontSize:16, fontWeight:700, color:'#0f172a' }}>{f.title}</h3>
                <p style={{ margin:0, fontSize:13, color:'#64748b', lineHeight:1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          TESTIMONIALS
          ═══════════════════════════════════════════════ */}
      <section style={fullWidthStyle('#f8fafc', '80px 0')}>
        <div style={innerStyle}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ margin:'0 0 12px', fontSize:36, fontWeight:800, color:'#0f172a' }}>What renters say</h2>
            <p style={{ margin:0, fontSize:15, color:'#64748b' }}>Companies renting through LeaseManager in Doha and Lusail</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24 }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} style={{ background:'#fff', borderRadius:14, padding:'28px', border:'1px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display:'flex', gap:2, marginBottom:16 }}>
                  {Array.from({ length: t.rating }).map((_, i) => <StarFilled key={i} style={{ color:'#f59e0b', fontSize:14 }} />)}
                </div>
                <p style={{ margin:'0 0 20px', fontSize:14, color:'#374151', lineHeight:1.7, fontStyle:'italic' }}>"{t.text}"</p>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14 }}>{t.name[0]}</div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>{t.name}</div>
                    <div style={{ fontSize:12, color:'#94a3b8' }}>{t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          BOTTOM CTA
          ═══════════════════════════════════════════════ */}
      <section style={{ ...fullWidthStyle('linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%)', '80px 0'), textAlign:'center', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-60, right:-60, width:280, height:280, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
        <div style={{ ...innerStyle, position:'relative' }}>
          <div style={{ maxWidth:600, margin:'0 auto' }}>
            <h2 style={{ margin:'0 0 16px', fontSize:40, fontWeight:800, color:'#fff' }}>Ready to find your space?</h2>
            <p style={{ margin:'0 0 40px', fontSize:16, color:'#94a3b8', lineHeight:1.6 }}>Browse the map without an account, then apply for the space you want. The property manager takes it from there.</p>
            <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={() => navigate('/register')} style={{ padding:'15px 36px', borderRadius:10, background:'#fff', border:'none', color:'#1d4ed8', fontSize:16, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 16px rgba(0,0,0,0.2)' }}>
                Get Started Free <ArrowRightOutlined />
              </button>
              <button onClick={() => navigate('/map')} style={{ padding:'15px 36px', borderRadius:10, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', fontSize:16, fontWeight:600, cursor:'pointer' }}>
                Explore map
              </button>
            </div>
            <p style={{ marginTop:24, fontSize:13, color:'#475569', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <CheckCircleOutlined style={{ color:'#22c55e' }} />
              No credit card required · Free to browse · Cancel anytime
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
