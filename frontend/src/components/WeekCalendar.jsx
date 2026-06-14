import { useRef, useState, useCallback } from 'react';

const HOUR_START = 7;
const HOUR_END   = 21;
const TOTAL_HRS  = HOUR_END - HOUR_START; // 14
const ROW_H      = 64; // px per hour
const TOTAL_H    = TOTAL_HRS * ROW_H;

const STATUS_COLOR = {
  scheduled: '#378ADD',
  conducted:  '#1D9E75',
  postponed:  '#E0A21C',
  missed:     '#D85A30',
  cancelled:  '#9ca3af',
};

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function snapMin(rawMin) {
  return Math.round(rawMin / 15) * 15;
}

function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

const DOW_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_S   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function WeekCalendar({ weekStart, meetings, onSlotClick, onDragCreate, onEventClick }) {
  const days = getWeekDays(weekStart);
  const now  = new Date();

  const dragRef  = useRef(null);
  const [dragGhost, setDragGhost] = useState(null);

  const colRef = useRef({});

  const minuteFromY = useCallback((y, colEl) => {
    const rect = colEl.getBoundingClientRect();
    const relY  = y - rect.top;
    const frac  = Math.max(0, relY) / TOTAL_H;
    return snapMin(HOUR_START * 60 + frac * TOTAL_HRS * 60);
  }, []);

  const handleMouseDown = useCallback((e, day) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const colEl = colRef.current[isoDate(day)];
    if (!colEl) return;
    const startMin = minuteFromY(e.clientY, colEl);
    dragRef.current = { col: day, startMin };
    setDragGhost({ col: day, startMin, endMin: startMin + 60 });
  }, [minuteFromY]);

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const day   = dragRef.current.col;
    const colEl = colRef.current[isoDate(day)];
    if (!colEl) return;
    const endMin = minuteFromY(e.clientY, colEl);
    if (endMin > dragRef.current.startMin) {
      setDragGhost(g => g ? { ...g, endMin } : null);
    }
  }, [minuteFromY]);

  const handleMouseUp = useCallback((e) => {
    if (!dragRef.current) return;
    const { col, startMin } = dragRef.current;
    const colEl = colRef.current[isoDate(col)];
    const endMin = colEl ? minuteFromY(e.clientY, colEl) : startMin + 60;
    dragRef.current = null;
    setDragGhost(null);

    if (Math.abs(endMin - startMin) < 15) {
      onSlotClick?.(col, startMin, startMin + 60);
    } else {
      onDragCreate?.(col, Math.min(startMin, endMin), Math.max(startMin, endMin));
    }
  }, [minuteFromY, onSlotClick, onDragCreate]);

  const handleMouseLeave = useCallback(() => {
    if (dragRef.current) {
      const { col, startMin } = dragRef.current;
      dragRef.current = null;
      setDragGhost(null);
      onSlotClick?.(col, startMin, startMin + 60);
    }
  }, [onSlotClick]);

  // Group meetings by ISO date
  const byDay = {};
  meetings.forEach(m => {
    (byDay[m.date] = byDay[m.date] || []).push(m);
  });

  const hours = Array.from({ length: TOTAL_HRS }, (_, i) => HOUR_START + i);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', userSelect: 'none', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Day header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', borderBottom: '1px solid var(--line)', background: 'var(--paper)' }}>
        <div style={{ borderRight: '1px solid var(--line)' }} />
        {days.map((d, i) => {
          const isToday = d.toDateString() === now.toDateString();
          return (
            <div key={i} style={{ padding: '10px 0', textAlign: 'center', borderRight: i < 6 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink3)', marginBottom: 2 }}>{DOW_SHORT[i]}</div>
              <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18, lineHeight: 1, color: isToday ? '#fff' : 'var(--ink)', background: isToday ? 'var(--accent)' : 'transparent', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                {d.getDate()}
              </div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--ink3)', marginTop: 1 }}>{MONTH_S[d.getMonth()]}</div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid body */}
      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 320px)', minHeight: 400 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', position: 'relative' }}>
          {/* Time labels column */}
          <div style={{ borderRight: '1px solid var(--line)' }}>
            {hours.map(h => (
              <div key={h} style={{ height: ROW_H, borderBottom: '1px solid var(--line2, #f0f0f0)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, paddingTop: 4 }}>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--ink3)', lineHeight: 1 }}>
                  {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, di) => {
            const iso = isoDate(day);
            const dayMeetings = byDay[iso] || [];

            return (
              <div
                key={di}
                ref={el => colRef.current[iso] = el}
                onMouseDown={e => handleMouseDown(e, day)}
                style={{ position: 'relative', borderRight: di < 6 ? '1px solid var(--line)' : 'none', height: TOTAL_H, cursor: 'crosshair', background: day.toDateString() === now.toDateString() ? '#fafbff' : '#fff' }}
              >
                {/* Hour grid lines */}
                {hours.map(h => (
                  <div key={h} style={{ position: 'absolute', top: (h - HOUR_START) * ROW_H, left: 0, right: 0, height: ROW_H, borderBottom: '1px solid var(--line2, #f0f0f0)' }}>
                    {/* 30-min tick */}
                    <div style={{ position: 'absolute', top: ROW_H / 2, left: 0, right: 0, borderBottom: '1px dashed #e8eaed' }} />
                  </div>
                ))}

                {/* Current time indicator */}
                {day.toDateString() === now.toDateString() && (() => {
                  const nowMin = now.getHours() * 60 + now.getMinutes();
                  const top = (nowMin - HOUR_START * 60) / 60 * ROW_H;
                  if (top < 0 || top > TOTAL_H) return null;
                  return (
                    <div style={{ position: 'absolute', top, left: 0, right: 0, zIndex: 5, pointerEvents: 'none' }}>
                      <div style={{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                      <div style={{ borderTop: '2px solid var(--accent)' }} />
                    </div>
                  );
                })()}

                {/* Drag ghost */}
                {dragGhost && dragGhost.col.toDateString() === day.toDateString() && (() => {
                  const { startMin, endMin } = dragGhost;
                  const top    = (Math.min(startMin, endMin) - HOUR_START * 60) / 60 * ROW_H;
                  const height = Math.abs(endMin - startMin) / 60 * ROW_H;
                  return (
                    <div style={{ position: 'absolute', top, left: 2, right: 2, height: Math.max(height, 20), background: 'rgba(59,91,219,.15)', border: '2px dashed var(--accent)', borderRadius: 6, zIndex: 4, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                        {minToTime(Math.min(startMin, endMin))} – {minToTime(Math.max(startMin, endMin))}
                      </span>
                    </div>
                  );
                })()}

                {/* Meeting event blocks */}
                {dayMeetings.map((m, mi) => {
                  const startMin = m.time ? timeToMin(m.time) : HOUR_START * 60;
                  const endMin   = m.end_time ? timeToMin(m.end_time) : startMin + 60;
                  const top      = (startMin - HOUR_START * 60) / 60 * ROW_H;
                  const height   = Math.max((endMin - startMin) / 60 * ROW_H, 24);
                  const color    = m.pair?.unit_a?.color || STATUS_COLOR[m.status] || '#378ADD';
                  const bg       = color + '1a'; // 10% opacity tint
                  const A = m.pair?.unit_a;
                  const B = m.pair?.unit_b;
                  const label = A && B ? `${A.abbr} × ${B.abbr}` : 'Meeting';
                  const title = m.title || label;

                  return (
                    <div
                      key={mi}
                      onClick={e => { e.stopPropagation(); onEventClick?.(m); }}
                      style={{
                        position: 'absolute',
                        top: Math.max(top, 0),
                        left: 2,
                        right: 2,
                        height,
                        background: bg,
                        borderLeft: `3px solid ${color}`,
                        borderRadius: 5,
                        padding: '2px 5px',
                        zIndex: 3,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        transition: 'box-shadow .1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.12)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {title}
                      </div>
                      {height > 36 && (
                        <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--ink2)', lineHeight: 1.3 }}>
                          {m.time ? minToTime(timeToMin(m.time)) : '—'}{m.end_time ? ` – ${minToTime(timeToMin(m.end_time))}` : ''} · {label}
                        </div>
                      )}
                      {height > 50 && m.status && m.status !== 'scheduled' && (
                        <div style={{ marginTop: 2 }}>
                          <span style={{ background: STATUS_COLOR[m.status] || '#ccc', color: '#fff', borderRadius: 4, padding: '1px 5px', fontSize: 9, fontFamily: 'var(--fm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                            {m.status}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
