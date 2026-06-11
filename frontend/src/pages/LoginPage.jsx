import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const UNITS = [
  { label: 'VETRI Palligal',  username: 'vp'    },
  { label: 'SMC',             username: 'smc'   },
  { label: 'Career Guidance', username: 'cg'    },
  { label: 'ACIS',            username: 'acis'  },
  { label: 'NSNOP',           username: 'nsnop' },
  { label: 'Alumni',          username: 'alum'  },
  { label: 'Manarkeni',       username: 'man'   },
];

const BULLETS = [
  { icon: '📅', bold: 'Plan meetings.', text: ' Schedule across all 21 unit pairs with agendas and auto-notifications.' },
  { icon: '📋', bold: 'Record minutes.', text: ' File MoMs and capture action points right after each meeting.' },
  { icon: '✅', bold: 'Track action items.', text: ' Pending items surface on your dashboard until closed.' },
  { icon: '📊', bold: 'Convergence matrix.', text: ' 7 × 7 health grid shows pair-wise progress at a glance.' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const toast     = useToast();
  const navigate  = useNavigate();

  const [role,     setRole]    = useState('admin');
  const [unitIdx,  setUnitIdx] = useState(0);
  const [password, setPassword]= useState('');
  const [showPw,   setShowPw]  = useState(false);
  const [loading,  setLoading] = useState(false);

  const username = role === 'admin' ? 'admin' : UNITS[unitIdx].username;
  const defaultPw = role === 'admin' ? 'Admin@1234' : 'Poc@1234';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password || defaultPw);
      navigate('/dashboard');
    } catch {
      toast('Sign-in failed — check your credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0f1135',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      {/* Card */}
      <div style={{
        display: 'flex', width: '100%', maxWidth: 860,
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 40px 100px -20px rgba(0,0,0,.6)',
      }}>

        {/* ── Left panel ── */}
        <div style={{
          flex: '0 0 46%',
          background: 'linear-gradient(145deg, #5b52f0 0%, #4338ca 100%)',
          padding: '44px 40px',
          display: 'flex', flexDirection: 'column', gap: 0,
          color: '#fff',
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: 'rgba(255,255,255,.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7,
                background: 'linear-gradient(135deg,#fff,#c7d2fe)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 13, color: '#4338ca', lineHeight: 1 }}>M</span>
              </div>
            </div>
            <span style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18, letterSpacing: '-.01em' }}>MS - CMS</span>
          </div>

          {/* Headline */}
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 24, lineHeight: 1.28, letterSpacing: '-.02em', marginBottom: 10 }}>
            Convergence Management<br />
            <span style={{ color: '#c7d2fe' }}>System — TN EMIS</span>
          </div>

          {/* What is CMS */}
          <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'rgba(255,255,255,.72)', lineHeight: 1.65, marginBottom: 28 }}>
            The single platform for inter-unit convergence across Tamil Nadu's <strong style={{ color: 'rgba(255,255,255,.9)' }}>7 school-support units</strong> and <strong style={{ color: 'rgba(255,255,255,.9)' }}>21 unit pairs</strong> — meetings, minutes and action points, all in one place.
          </div>

          {/* Bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {BULLETS.map(({ icon, bold, text }) => (
              <div key={bold} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 17, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>{icon}</span>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 13.5, color: 'rgba(255,255,255,.82)', lineHeight: 1.55 }}>
                  <strong style={{ color: '#fff', fontWeight: 700 }}>{bold}</strong>{text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{
          flex: 1,
          background: '#fff',
          padding: '44px 40px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 24, color: '#0f172a', letterSpacing: '-.02em', marginBottom: 6 }}>
            Sign in to MS - CMS
          </div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 13.5, color: '#6366f1', marginBottom: 28 }}>
            Use your assigned TN EMIS credentials to access your workspace.
          </div>

          {/* Role toggle */}
          <div style={{
            display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, gap: 3, marginBottom: 24,
          }}>
            {[['admin','Admin'],['poc','Unit POC']].map(([r, l]) => (
              <button key={r} type="button" onClick={() => setRole(r)}
                style={{
                  flex: 1, border: 'none', borderRadius: 7, padding: '8px 0',
                  fontFamily: 'var(--fb)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                  transition: '.15s',
                  background: role === r ? '#fff' : 'transparent',
                  color: role === r ? '#4f46e5' : '#64748b',
                  boxShadow: role === r ? '0 1px 4px rgba(15,23,42,.1)' : 'none',
                }}
              >{l}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Unit selector (POC only) */}
            {role === 'poc' && (
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                  Your Convergence Unit
                </label>
                <select value={unitIdx} onChange={e => setUnitIdx(+e.target.value)}
                  style={{
                    width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 9,
                    padding: '10px 12px', fontFamily: 'var(--fb)', fontSize: 14,
                    background: '#f8fafc', color: '#0f172a', outline: 'none', cursor: 'pointer',
                  }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                >
                  {UNITS.map((u, i) => <option key={u.username} value={i}>{u.label}</option>)}
                </select>
              </div>
            )}

            {/* Username (read-only display) */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                Username
              </label>
              <input readOnly value={username}
                style={{
                  width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 9,
                  padding: '10px 12px', fontFamily: 'var(--fb)', fontSize: 14,
                  background: '#f8fafc', color: '#475569', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={defaultPw.replace(/./g, '•')}
                  style={{
                    width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 9,
                    padding: '10px 40px 10px 12px', fontFamily: 'var(--fb)', fontSize: 14,
                    background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box', outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4,
                    display: 'flex', alignItems: 'center',
                  }}>
                  {showPw
                    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{
                width: '100%', border: 'none', borderRadius: 10,
                padding: '12px 0', marginTop: 4,
                background: loading ? '#818cf8' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: '#fff', fontFamily: 'var(--fb)', fontSize: 15, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: '.15s', boxShadow: '0 4px 14px rgba(99,102,241,.4)',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,.55)'; }}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,.4)'}
            >
              {loading
                ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> Signing in…</>
                : <>→ Sign in</>
              }
            </button>
          </form>

          <div style={{ fontFamily: 'var(--fm)', fontSize: 12.5, color: '#94a3b8', marginTop: 22, textAlign: 'center' }}>
            Trouble signing in? Contact your administrator.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
