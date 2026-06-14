export default function LoginPage() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0f1135',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        display: 'flex', width: '100%', maxWidth: 860,
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 40px 100px -20px rgba(0,0,0,.6)',
      }}>

        {/* Left panel — branding */}
        <div style={{
          flex: '0 0 46%',
          background: 'linear-gradient(145deg, #5b52f0 0%, #4338ca 100%)',
          padding: '44px 40px',
          display: 'flex', flexDirection: 'column', gap: 0,
          color: '#fff',
        }}>
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

          <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 24, lineHeight: 1.28, letterSpacing: '-.02em', marginBottom: 10 }}>
            Convergence Management<br />
            <span style={{ color: '#c7d2fe' }}>System — TN EMIS</span>
          </div>

          <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'rgba(255,255,255,.72)', lineHeight: 1.65, marginBottom: 28 }}>
            The single platform for inter-unit convergence across Tamil Nadu's{' '}
            <strong style={{ color: 'rgba(255,255,255,.9)' }}>7 school-support units</strong> and{' '}
            <strong style={{ color: 'rgba(255,255,255,.9)' }}>21 unit pairs</strong> — meetings, minutes and action points, all in one place.
          </div>

          {[
            { icon: '📅', bold: 'Plan meetings.', text: ' Schedule across all 21 unit pairs with agendas and auto-notifications.' },
            { icon: '📋', bold: 'Record minutes.', text: ' File MoMs and capture action points right after each meeting.' },
            { icon: '✅', bold: 'Track action items.', text: ' Pending items surface on your dashboard until closed.' },
            { icon: '📊', bold: 'Convergence matrix.', text: ' 7 × 7 health grid shows pair-wise progress at a glance.' },
          ].map(({ icon, bold, text }) => (
            <div key={bold} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
              <span style={{ fontSize: 17, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>{icon}</span>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 13.5, color: 'rgba(255,255,255,.82)', lineHeight: 1.55 }}>
                <strong style={{ color: '#fff', fontWeight: 700 }}>{bold}</strong>{text}
              </span>
            </div>
          ))}
        </div>

        {/* Right panel — access instruction */}
        <div style={{
          flex: 1,
          background: '#fff',
          padding: '44px 40px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg,#6366f1,#4338ca)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24, flexShrink: 0,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>

          <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 22, color: '#0f172a', letterSpacing: '-.02em', marginBottom: 12 }}>
            Access via TN EMIS Portal
          </div>

          <div style={{ fontFamily: 'var(--fm)', fontSize: 14, color: '#64748b', lineHeight: 1.7, maxWidth: 300, marginBottom: 28 }}>
            This application is accessed through the TN EMIS platform. Please log in to TN EMIS and open <strong style={{ color: '#4f46e5' }}>CMS</strong> from the menu.
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1.5px solid #e2e8f0',
            borderRadius: 12,
            padding: '14px 20px',
            fontFamily: 'var(--fm)',
            fontSize: 13,
            color: '#94a3b8',
            maxWidth: 300,
          }}>
            If you were redirected here from TN EMIS and see this page, your session may have expired. Please return to TN EMIS and click <strong>CMS</strong> again.
          </div>
        </div>
      </div>
    </div>
  );
}
