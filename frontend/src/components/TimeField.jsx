import { useState, useRef, useEffect } from 'react';

const TIMES = [
  '07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
  '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
  '15:00','15:30','16:00','16:30','17:00','17:30','18:00',
];

function fmt(t) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export default function TimeField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref  = useRef();
  const listRef = useRef();

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll selected item into view when opening
  useEffect(() => {
    if (open && listRef.current && value) {
      const el = listRef.current.querySelector('[data-selected="true"]');
      if (el) el.scrollIntoView({ block: 'center' });
    }
  }, [open, value]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button — same style as DateField */}
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: '100%', textAlign: 'left',
        border: `1px solid ${open ? 'var(--accent)' : 'var(--cui-input-border-color, rgba(15,23,42,.12))'}`,
        borderRadius: 9, padding: '0.375rem 0.75rem', height: 38, background: '#fff',
        fontFamily: 'var(--fb)', fontSize: 14, color: value ? 'var(--ink)' : 'var(--ink3)',
        cursor: 'pointer', lineHeight: '1.5', outline: 'none',
        boxShadow: open ? '0 0 0 3px rgba(99,102,241,.15)' : 'none',
        transition: 'border-color .15s, box-shadow .15s',
      }}>
        🕐 {value ? fmt(value) : 'Select time'}
      </button>

      {/* Popup panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
          background: '#fff',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: '0 16px 40px -12px rgba(99,102,241,.18)',
          width: 170,
          overflow: 'hidden',
        }}>
          {/* Header — same indigo as calendar */}
          <div style={{
            background: 'var(--accent)', padding: '11px 14px',
            fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600,
            color: 'rgba(255,255,255,.9)', letterSpacing: '.08em', textTransform: 'uppercase',
          }}>
            Select Time
          </div>

          {/* Time list */}
          <div ref={listRef} style={{ maxHeight: 210, overflowY: 'auto', padding: '6px' }}>
            {TIMES.map(t => {
              const sel = value === t;
              return (
                <button key={t} type="button" data-selected={sel}
                  onClick={() => { onChange(t); setOpen(false); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    border: 'none', borderRadius: 7, padding: '7px 11px',
                    fontFamily: 'var(--fm)', fontSize: 13, cursor: 'pointer',
                    background: sel ? 'var(--accent)' : 'transparent',
                    color:      sel ? '#fff' : 'var(--ink)',
                    fontWeight: sel ? 700 : 400,
                    transition: 'background .1s, color .1s',
                  }}
                  onMouseEnter={e => { if (!sel) { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--accent)'; } }}
                  onMouseLeave={e => { if (!sel) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink)'; } }}
                >
                  {fmt(t)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
