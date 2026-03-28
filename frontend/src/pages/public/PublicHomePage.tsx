import { useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined, FileTextOutlined, BarChartOutlined,
  SafetyOutlined, SearchOutlined, ArrowRightOutlined,
  EnvironmentOutlined, TeamOutlined, StarFilled,
  CheckCircleOutlined,
} from '@ant-design/icons';

const STATS = [
  { value: '1,247', label: 'Office Spaces',    color: '#3b82f6' },
  { value: '24',    label: 'Locations',         color: '#10b981' },
  { value: '850+',  label: 'Happy Companies',   color: '#f59e0b' },
  { value: '98%',   label: 'Satisfaction Rate', color: '#8b5cf6' },
];

const FEATURES = [
  { icon: <AppstoreOutlined />, title: 'Smart Space Search',       desc: 'Filter by size, budget, location and amenities. Find your office in seconds.',  color: '#2563eb', bg: '#eff6ff' },
  { icon: <FileTextOutlined />, title: 'Digital Lease Management', desc: 'Sign contracts online, track renewals, manage documents — all in one place.',  color: '#059669', bg: '#f0fdf4' },
  { icon: <BarChartOutlined />, title: 'Financial Tracking',       desc: 'View invoices, track payments, get reminders before due dates automatically.', color: '#d97706', bg: '#fffbeb' },
  { icon: <SafetyOutlined />,   title: 'Secure & Compliant',       desc: 'Bank-grade security. All your documents and payments protected at every step.', color: '#7c3aed', bg: '#f5f3ff' },
];

const SPACES = [
  { name: 'Executive Suite 1201A', location: 'Manhattan Downtown', price: '$4,200/mo',  size: '850 sq ft',  capacity: '6-8 people',  badge: 'Premium',  img: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/d0aeb9ee80-deaa17ab9c213523c203.png' },
  { name: 'Tech Hub Office 304C',  location: 'Tokyo Shibuya',      price: '¥580,000/mo', size: '600 sq ft',  capacity: '4-6 people',  badge: 'Standard', img: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/003f0a7ed6-51e10a5837f3a2b32d90.png' },
  { name: 'Harbour View Suite',    location: 'Sydney CBD',         price: 'A$5,100/mo', size: '950 sq ft',  capacity: '8-10 people', badge: 'Premium',  img: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/6dda684c29-c0b8088cdd8ac699d9dd.png' },
];

const TESTIMONIALS = [
  { name: 'Sarah Mitchell', company: 'TechVision Inc.',  text: 'Found our dream office in 2 days. The booking process was seamless and the space exceeded our expectations.', rating: 5 },
  { name: 'James Chen',     company: 'StartupLab',       text: 'The contract management feature saved us hours every month. Highly recommend to any growing startup.',       rating: 5 },
  { name: 'Elena Rossi',    company: 'Design Studio Pro',text: 'Professional spaces, fair pricing, and exceptional customer support. LeaseManager is our go-to platform.',    rating: 5 },
];

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
            1,247 Offices Available Now Across 24 Locations
          </div>

          <h1 style={{ margin:'0 0 20px', fontSize:60, fontWeight:900, color:'#fff', lineHeight:1.1, letterSpacing:'-1px' }}>
            Find the perfect<br />
            <span style={{ color:'#60a5fa' }}>office space</span>{' '}
            <span style={{ color:'rgba(255,255,255,0.9)' }}>for your team</span>
          </h1>

          <p style={{ margin:'0 0 44px', fontSize:18, color:'#94a3b8', lineHeight:1.7, maxWidth:580, marginLeft:'auto', marginRight:'auto' }}>
            Browse premium offices, flexible leases, and modern amenities. From hot desks to executive suites — find your workspace in minutes.
          </p>

          {/* Search bar */}
          <div style={{ display:'flex', maxWidth:620, margin:'0 auto 40px', background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ flex:1, padding:'0 18px', display:'flex', alignItems:'center', gap:10 }}>
              <EnvironmentOutlined style={{ color:'#94a3b8', fontSize:16 }} />
              <input
                placeholder="City, location or branch name..."
                style={{ border:'none', outline:'none', fontSize:15, color:'#374151', width:'100%', padding:'16px 0', background:'transparent' }}
              />
            </div>
            <button
              onClick={() => navigate('/spaces')}
              style={{ padding:'0 28px', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', border:'none', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8, whiteSpace:'nowrap' }}
            >
              <SearchOutlined /> Search
            </button>
          </div>

          {/* CTA buttons */}
          <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
            <button
              onClick={() => navigate('/spaces')}
              style={{ padding:'14px 32px', borderRadius:10, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff', fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}
            >
              <AppstoreOutlined /> Browse All Spaces
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
            {STATS.map(s => (
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
              <p style={{ margin:0, fontSize:15, color:'#64748b' }}>Handpicked offices across our top locations</p>
            </div>
            <button onClick={() => navigate('/spaces')} style={{ padding:'11px 22px', borderRadius:9, background:'#fff', border:'1px solid #e5e7eb', color:'#374151', fontSize:14, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              View All <ArrowRightOutlined />
            </button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24 }}>
            {SPACES.map(space => (
              <div
                key={space.name}
                style={{ background:'#fff', borderRadius:14, overflow:'hidden', border:'1px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', cursor:'pointer', transition:'all 0.2s' }}
                onClick={() => navigate('/spaces')}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(0,0,0,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.06)'; }}
              >
                <div style={{ height:200, overflow:'hidden', position:'relative' }}>
                  <img src={space.img} alt={space.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}
                    onError={e => { (e.target as HTMLImageElement).src='https://placehold.co/400x200/1e293b/white?text=Office'; }} />
                  <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:6 }}>
                    <span style={{ background:'#dcfce7', color:'#15803d', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>Available</span>
                    <span style={{ background:'#2563eb', color:'#fff', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>{space.badge}</span>
                  </div>
                </div>
                <div style={{ padding:'18px 20px' }}>
                  <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:700, color:'#0f172a' }}>{space.name}</h3>
                  <p style={{ margin:'0 0 14px', fontSize:13, color:'#64748b', display:'flex', alignItems:'center', gap:5 }}>
                    <EnvironmentOutlined style={{ fontSize:12 }} /> {space.location}
                  </p>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                    <div style={{ display:'flex', gap:14 }}>
                      <span style={{ fontSize:12, color:'#64748b' }}>📐 {space.size}</span>
                      <span style={{ fontSize:12, color:'#64748b', display:'flex', alignItems:'center', gap:4 }}><TeamOutlined style={{ fontSize:11 }} /> {space.capacity}</span>
                    </div>
                    <div style={{ fontSize:18, fontWeight:800, color:'#0f172a' }}>{space.price}</div>
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
            <h2 style={{ margin:'0 0 12px', fontSize:36, fontWeight:800, color:'#0f172a' }}>Trusted by 850+ companies</h2>
            <p style={{ margin:0, fontSize:15, color:'#64748b' }}>See what our clients say about us</p>
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
            <p style={{ margin:'0 0 40px', fontSize:16, color:'#94a3b8', lineHeight:1.6 }}>Register your company for free and start booking premium offices in minutes.</p>
            <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={() => navigate('/register')} style={{ padding:'15px 36px', borderRadius:10, background:'#fff', border:'none', color:'#1d4ed8', fontSize:16, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 16px rgba(0,0,0,0.2)' }}>
                Get Started Free <ArrowRightOutlined />
              </button>
              <button onClick={() => navigate('/spaces')} style={{ padding:'15px 36px', borderRadius:10, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', fontSize:16, fontWeight:600, cursor:'pointer' }}>
                Browse Spaces
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
