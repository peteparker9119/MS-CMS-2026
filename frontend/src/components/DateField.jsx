import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW          = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstDow(y, m)    { return new Date(y, m, 1).getDay(); }

export default function DateField({ value, onChange, placeholder = 'Pick a date', style }) {
  const parsed   = value ? new Date(value + 'T00:00:00') : null;
  const today    = new Date();
  const todayISO = toISO(today);

  const [open,      setOpen]      = useState(false);
  const [viewYear,  setViewYear]  = useState((parsed ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState((parsed ?? today).getMonth());
  const [showMGrid, setShowMGrid] = useState(false);
  const [popupPos,  setPopupPos]  = useState({ top: 0, left: 0, width: 288 });

  const btnRef  = useRef(null);
  const wrapRef = useRef(null);

  /* position popup via fixed coords to escape any stacking context */
  const calcPos = (r) => {
    const popW = 288;
    // Prefer left-aligned to button; if that overflows right, shift left until it fits
    const ideal = r.left;
    const left  = Math.max(8, Math.min(ideal, window.innerWidth - popW - 8));
    return { top: r.bottom + 6, left, width: popW };
  };

  const openCalendar = () => {
    if (btnRef.current) {
      setPopupPos(calcPos(btnRef.current.getBoundingClientRect()));
    }
    setOpen(o => !o);
    setShowMGrid(false);
  };

  /* close on outside click */
  useEffect(() => {
    if (!open) return;
    const h = e => {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  /* reposition on scroll / resize while open */
  useEffect(() => {
    if (!open) return;
    const repos = () => {
      if (btnRef.current) setPopupPos(calcPos(btnRef.current.getBoundingClientRect()));
    };
    window.addEventListener('scroll', repos, true);
    window.addEventListener('resize', repos);
    return () => {
      window.removeEventListener('scroll', repos, true);
      window.removeEventListener('resize', repos);
    };
  }, [open]);

  /* sync view when value changes from outside */
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (parsed) { setViewYear(parsed.getFullYear()); setViewMonth(parsed.getMonth()); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); } else setViewMonth(m => m-1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); } else setViewMonth(m => m+1); };

  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDow  = firstDow(viewYear, viewMonth);
  const cells     = [];
  for (let i = 0; i < startDow; i++) {
    const d = new Date(viewYear, viewMonth, -startDow + i + 1);
    cells.push({ iso: toISO(d), current: false });
  }
  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(viewYear, viewMonth, d);
    cells.push({ iso: toISO(dt), current: true });
  }
  let trail = 1;
  while (cells.length < 42) {
    const dt = new Date(viewYear, viewMonth + 1, trail++);
    cells.push({ iso: toISO(dt), current: false });
  }

  const selectDay = iso => { onChange(iso); setOpen(false); setShowMGrid(false); };

  const displayLabel = parsed
    ? `${String(parsed.getDate()).padStart(2,'0')} ${MONTHS_SHORT[parsed.getMonth()]} ${parsed.getFullYear()}`
    : placeholder;

  const popup = open && createPortal(
    <div
      ref={wrapRef}
      style={{
        position: 'fixed',
        top: popupPos.top,
        left: popupPos.left,
        width: 288,
        zIndex: 99999,
        background: '#fff',
        borderRadius: 16,
        border: '1px solid rgba(15,23,42,.07)',
        boxShadow: '0 20px 60px -12px rgba(15,23,42,.22), 0 4px 16px -4px rgba(15,23,42,.1)',
        overflow: 'hidden',
        animation: 'calIn .15s cubic-bezier(.4,0,.2,1)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 10px' }}>
        <button type="button" onClick={prevMonth} style={navBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15,18 9,12 15,6"/></svg>
        </button>

        <button
          type="button"
          onClick={() => setShowMGrid(g => !g)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fb)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', padding: '4px 10px', borderRadius: 8, transition: '.13s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--paper)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          {MONTHS_FULL[viewMonth]} {viewYear}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="2.5" strokeLinecap="round" style={{ transform: showMGrid ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>

        <button type="button" onClick={nextMonth} style={navBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>
        </button>
      </div>

      {showMGrid ? (
        <div style={{ padding: '0 12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 10, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <button type="button" onClick={() => setViewYear(y => y-1)} style={navBtn}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15,18 9,12 15,6"/></svg>
            </button>
            <span style={{ fontFamily: 'var(--fb)', fontSize: 15, fontWeight: 700, color: 'var(--ink)', minWidth: 48, textAlign: 'center' }}>{viewYear}</span>
            <button type="button" onClick={() => setViewYear(y => y+1)} style={navBtn}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
            {MONTHS_SHORT.map((m, i) => {
              const isCur = i === viewMonth;
              return (
                <button key={m} type="button"
                  onClick={() => { setViewMonth(i); setShowMGrid(false); }}
                  style={{ border: 'none', borderRadius: 9, padding: '8px 4px', fontFamily: 'var(--fb)', fontSize: 12.5, fontWeight: isCur ? 700 : 500, cursor: 'pointer', transition: '.12s', background: isCur ? 'var(--accent)' : 'var(--paper)', color: isCur ? '#fff' : 'var(--ink)' }}
                  onMouseEnter={e => { if (!isCur) e.currentTarget.style.background = 'var(--accent-light)'; }}
                  onMouseLeave={e => { if (!isCur) e.currentTarget.style.background = 'var(--paper)'; }}
                >{m}</button>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 12px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
            {DOW.map(d => (
              <div key={d} style={{ textAlign: 'center', fontFamily: 'var(--fm)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink3)', padding: '4px 0', letterSpacing: '.04em' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {cells.map(({ iso, current }, idx) => {
              const isSelected = iso === value;
              const isToday    = iso === todayISO;
              return (
                <button key={idx} type="button"
                  onClick={() => selectDay(iso)}
                  style={{
                    border: isToday && !isSelected ? '1.5px solid var(--accent)' : 'none',
                    borderRadius: '50%', width: 34, height: 34, margin: '0 auto',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--fb)', fontSize: 13,
                    fontWeight: isSelected || isToday ? 700 : 400,
                    cursor: 'pointer', transition: '.1s',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? '#fff' : isToday ? 'var(--accent)' : current ? 'var(--ink)' : 'var(--ink3)',
                    opacity: current ? 1 : 0.35,
                  }}
                  onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--accent)'; } }}
                  onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isToday ? 'var(--accent)' : current ? 'var(--ink)' : 'var(--ink3)'; } }}
                >
                  {new Date(iso + 'T00:00:00').getDate()}
                </button>
              );
            })}
          </div>
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 9, textAlign: 'center' }}>
            <button type="button"
              onClick={() => selectDay(todayISO)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--fb)', fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', padding: '4px 14px', borderRadius: 7, transition: '.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >Today</button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );

  return (
    <>
      <div style={{ position: 'relative', display: 'block', width: '100%', ...style }}>
        <button
          ref={btnRef}
          type="button"
          onClick={openCalendar}
          style={{
            width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
            border: open ? '1.5px solid var(--accent)' : '1px solid var(--line)',
            borderRadius: 9, padding: '0 12px', height: 38, background: '#fff',
            fontFamily: 'var(--fb)', fontSize: 13.5,
            color: parsed ? 'var(--ink)' : 'var(--ink3)',
            cursor: 'pointer', transition: 'border-color .15s',
            boxShadow: open ? '0 0 0 3px var(--accent-glow)' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={parsed ? 'var(--accent)' : 'var(--ink3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayLabel}</span>
          {parsed && (
            <span
              onClick={e => { e.stopPropagation(); onChange(''); }}
              style={{ color: 'var(--ink3)', fontSize: 14, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
              title="Clear"
            >×</span>
          )}
        </button>
      </div>

      {popup}

      <style>{`
        @keyframes calIn {
          from { opacity: 0; transform: translateY(-6px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}

const navBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, borderRadius: 8, color: 'var(--ink2)',
  transition: '.13s', flexShrink: 0,
};
